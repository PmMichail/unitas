import os
import re
import csv
import json
import requests
from datetime import datetime
from bs4 import BeautifulSoup
import pypdf

class UniversalParser:
    def __init__(self, ollama_url="http://localhost:11434"):
        self.ollama_url = ollama_url
        self.period_start = None
        self.period_end = None
        self.statement_tax_id = None
        self.bank_name = None

    def _extract_period(self, text):
        match = re.search(r"(\d{2}\.\d{2}\.\d{4})\s*(?:по|до|-|—)\s*(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
        if match:
            start_str, end_str = match.groups()
            try:
                self.period_start = datetime.strptime(start_str, "%d.%m.%Y").date()
                self.period_end = datetime.strptime(end_str, "%d.%m.%Y").date()
            except ValueError:
                pass

    def parse(self, file_path):
        """
        Головний метод парсингу, який визначає формат файлу та відповідний банк.
        """
        self.period_start = None
        self.period_end = None
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Файл не знайдено: {file_path}")

        # Check if the file contains tax cabinet keywords
        is_tax_cabinet = False
        ext = os.path.splitext(file_path)[1].lower()
        try:
            text_preview = ""
            if ext == ".pdf":
                with open(file_path, "rb") as f:
                    reader = pypdf.PdfReader(f)
                    for page in reader.pages[:2]: # check first 2 pages
                        text_preview += (page.extract_text() or "") + "\n"
            else:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    text_preview = f.read(10000)
            
            text_preview = self._normalize_ukrainian_i(text_preview)
            
            if any(keyword in text_preview for keyword in ["Назва платежу", "Податковий борг", "сальдо розрахунків", "Код платежу", "Надміру сплачені"]):
                is_tax_cabinet = True
        except Exception:
            pass

        if is_tax_cabinet:
            self.bank_name = "ДПС Кабінет"
            text_full = ""
            try:
                if ext == ".pdf":
                    with open(file_path, "rb") as f:
                        reader = pypdf.PdfReader(f)
                        for page in reader.pages:
                            text_full += (page.extract_text() or "") + "\n"
                else:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        text_full = f.read()
                
                text_full = self._normalize_ukrainian_i(text_full)
                self.parsed_tax_cabinet_settlements = self._parse_tax_cabinet_extract(text_full)
                if self.parsed_tax_cabinet_settlements:
                    self.period_start = datetime.now().date()
                    self.period_end = self.period_start
                    return [{
                        "date": datetime.now().strftime("%Y-%m-%d"),
                        "amount": 0.0,
                        "direction": "in",
                        "purpose": "Імпорт виписки ДПС",
                        "contragent": "ДПС",
                        "type": "tax_cabinet_import",
                        "taxable": False,
                        "bank_name": "ДПС Кабінет"
                    }]
            except Exception as e:
                print(f"[Parser Error] Failed to parse tax cabinet extract: {e}")

        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == ".csv":
            transactions = self._parse_csv(file_path)
        elif ext in (".html", ".htm"):
            transactions = self._parse_html(file_path)
        elif ext == ".pdf":
            transactions = self._parse_pdf(file_path)
        elif ext == ".txt":
            transactions = self._parse_txt(file_path)
        else:
            transactions = self._parse_with_ai(file_path, "Невідомий формат файлу")

        if not self.period_start and transactions:
            try:
                dates = [datetime.strptime(tx["date"], "%Y-%m-%d").date() for tx in transactions]
                self.period_start = min(dates)
                self.period_end = max(dates)
            except Exception:
                pass

        return transactions

    def _parse_csv(self, file_path):
        """Парсинг CSV виписок (наприклад, monobank)"""
        transactions = []
        try:
            # Читаємо перші кілька рядків для визначення кодування та роздільника
            with open(file_path, "r", encoding="utf-8") as f:
                header = f.readline()
            
            delimiter = ";" if ";" in header else ","
            
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f, delimiter=delimiter)
                for row in reader:
                    # monobank формат
                    if "Дата і час" in row or "Опис" in row:
                        date_str = row.get("Дата і час", "")
                        desc = row.get("Опис", "")
                        
                        # Парсимо дату
                        # Наприклад: "15.03.2025 14:30" -> "2025-03-15"
                        parsed_date = self._clean_date(date_str)
                        amount = self._clean_number(row.get("Сума (грн)", "0"))
                        
                        transactions.append(self._create_transaction_dict(
                            date=parsed_date,
                            amount=amount,
                            purpose=desc,
                            contragent=self._extract_contragent(desc),
                            bank_name="monobank"
                        ))
            return transactions
        except Exception as e:
            # Спробуємо AI парсинг у випадку помилки структури
            return self._parse_with_ai(file_path, f"Помилка парсингу CSV: {str(e)}")

    def _parse_html(self, file_path):
        """Парсинг HTML виписок (наприклад, Ощадбанк)"""
        transactions = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                soup = BeautifulSoup(f.read(), "html.parser")
            
            text_content = soup.get_text()
            self._extract_period(text_content)
            bank_name = "Ощадбанк" if "ощад" in text_content.lower() else "Невідомий HTML Банк"
            
            # Шукаємо таблицю транзакцій
            table = soup.find("table")
            if table:
                rows = table.find_all("tr")
                for row in rows[1:]: # пропускаємо заголовок
                    cols = [td.get_text().strip() for td in row.find_all("td")]
                    if len(cols) >= 4:
                        date_str = cols[0]
                        purpose = cols[1]
                        
                        # Дебет (витрати) та Кредит (надходження)
                        debit = self._clean_number(cols[2]) if cols[2] else 0.0
                        credit = self._clean_number(cols[3]) if cols[3] else 0.0
                        
                        amount = credit if credit > 0 else debit
                        contragent = cols[4] if len(cols) > 4 else self._extract_contragent(purpose)
                        
                        amount = credit if credit > 0 else -debit
                        transactions.append(self._create_transaction_dict(
                            date=self._clean_date(date_str),
                            amount=amount,
                            purpose=purpose,
                            contragent=contragent,
                            bank_name=bank_name
                        ))
            if transactions:
                return transactions
            return self._parse_with_ai(file_path, 'Не вдалося знайти транзакцій в HTML')
        except Exception as e:
            return self._parse_with_ai(file_path, f'Помилка парсингу HTML: {str(e)}')

    def _parse_pdf(self, file_path):
        """Парсинг PDF виписок за допомогою pypdf (Приват24, А-Банк тощо)"""
        transactions = []
        try:
            text = ""
            with open(file_path, "rb") as f:
                reader = pypdf.PdfReader(f)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            
            text = self._normalize_ukrainian_i(text)
            
            # Fix concatenated dates with amount (e.g. "05/02/2026100 000,00" -> "05/02/2026; 100 000,00")
            text = re.sub(r"(\d{2}[./](?:0[1-9]|1[0-2])[./]202\d)(-?\d)", r"\1; \2", text)
            # Fix concatenated times with payment numbers (e.g. "19:40:45858716..." -> "19:40:45; 858716...")
            text = re.sub(r"(\b\d{2}:\d{2}:\d{2})([A-Za-z0-9-])", r"\1; \2", text)
            # Fix concatenated numbers/payment IDs with P2P
            text = re.sub(r"(\b\d+(?:\.\d+)?)(P2P)\b", r"\1 \2", text, flags=re.IGNORECASE)
            # Fix A-Bank hex payment IDs concatenated with Cyrillic names (e.g. "13C7752EЗАГОРУЛЬКО" -> "13C7752E ЗАГОРУЛЬКО")
            text = re.sub(r"(\b1[23][A-Fa-f0-9]{6})([а-яА-ЯёЁіІїЇєЄґҐ])", r"\1 \2", text)
            # Fix digits concatenated with Cyrillic letters (e.g. "2746Картки" -> "2746 Картки")
            text = re.sub(r"(\d+)([а-яА-ЯёЁіІїЇєЄґҐ])", r"\1 \2", text)
            # Fix Latin characters or quotes concatenated with Cyrillic (e.g. "БАНК\"Переказ" -> "БАНК\" Переказ")
            text = re.sub(r"([a-zA-Z0-9\"'`])([а-яА-ЯёЁіІїЇєЄґҐ])", r"\1 \2", text)
            
            self._extract_period(text)
            
            # Визначаємо банк
            bank_name = "ПриватБанк"
            if "а-банк" in text.lower() or "a-bank" in text.lower():
                bank_name = "А-Банк"
            elif "райффайзен" in text.lower() or "aval" in text.lower():
                bank_name = "Райффайзен"
            elif "пумб" in text.lower():
                bank_name = "ПУМБ"
            elif "sense" in text.lower():
                bank_name = "Sense Bank"
            self.bank_name = bank_name

            # Вилучаємо tax_id клієнта
            client_line = None
            for line in text.split("\n"):
                if "клієнт" in line.lower():
                    client_line = line
                    break
            if client_line:
                match_tax_id = re.search(r"(\d{8,10})", client_line)
                if match_tax_id:
                    self.statement_tax_id = match_tax_id.group(1)

            # Розбиваємо текст на рядки
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            
            # Спробуємо розпарсити послідовний макет А-Банку/ПриватБанку (де деталі операції перенесені на нові рядки)
            transactions = self._parse_sequential_lines(lines, bank_name)
                
            # Якщо послідовний макет не знайшов транзакцій, спробуємо старий метод (пошук регулярними виразами на одному рядку)
            if not transactions:
                i = 0
                while i < len(lines):
                    line = lines[i]
                    header_match = re.search(r"\b(\d{2}\s*\.\s*\d{2}\s*\.\s*\d{4})$", line)
                    if header_match:
                        date_str = self._clean_date(header_match.group(1))
                        ignore_keywords = ["період", "виписка", "залишок", "разом за", "єдрпоу", "рнокпп", "поточний рахунок", "рахунок №"]
                        if any(kw in line.lower() for kw in ignore_keywords):
                            i += 1
                            continue
                        if i + 1 < len(lines):
                            next_line = lines[i+1]
                            detail_match = re.match(r"^(\d{2}:\d{2})\s*(-?\d{1,3}(?:\s\d{3})*[\.,]\d{2})(?:\s+(.*))?$", next_line)
                            if detail_match:
                                time_str = detail_match.group(1)
                                amount_str = detail_match.group(2)
                                purpose_start = detail_match.group(3) or ""
                                tx_lines = [purpose_start] if purpose_start else []
                                j = i + 2
                                while j < len(lines):
                                    next_tx_line = lines[j]
                                    if re.search(r"\b(\d{2}\s*\.\s*\d{2}\s*\.\s*\d{4})$", next_tx_line):
                                        if j + 1 < len(lines) and re.match(r"^\d{2}:\d{2}", lines[j+1]):
                                            break
                                    tx_lines.append(next_tx_line)
                                    j += 1
                                amount = self._clean_number(amount_str)
                                purpose, contragent, tx_edrpou, tx_iban = self._extract_details_from_lines(tx_lines)

                                tx_dict = self._create_transaction_dict(
                                    date=self._clean_date(date_str),
                                    amount=amount,
                                    purpose=purpose,
                                    contragent=contragent,
                                    bank_name=bank_name
                                )
                                tx_dict['edrpou'] = tx_edrpou
                                tx_dict['iban'] = tx_iban

                                transactions.append(tx_dict)
                                i = j
                                continue
                    i += 1

            if transactions:
                return transactions

            return self._parse_with_ai(file_path, 'Не вдалося витягти транзакції регулярними виразами з PDF')
        except Exception as e:
            return self._parse_with_ai(file_path, f'Помилка парсингу PDF: {str(e)}')

    def _parse_txt(self, file_path):
        """Парсинг TXT виписок"""
        transactions = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
            
            text = self._normalize_ukrainian_i(text)
            
            # Fix concatenated dates with amount (e.g. "05/02/2026100 000,00" -> "05/02/2026; 100 000,00")
            text = re.sub(r"(\d{2}[./](?:0[1-9]|1[0-2])[./]202\d)(-?\d)", r"\1; \2", text)
            # Fix concatenated times with payment numbers (e.g. "19:40:45858716..." -> "19:40:45; 858716...")
            text = re.sub(r"(\b\d{2}:\d{2}:\d{2})([A-Za-z0-9-])", r"\1; \2", text)
            # Fix concatenated numbers/payment IDs with P2P
            text = re.sub(r"(\b\d+(?:\.\d+)?)(P2P)\b", r"\1 \2", text, flags=re.IGNORECASE)
            # Fix A-Bank hex payment IDs concatenated with Cyrillic names (e.g. "13C7752EЗАГОРУЛЬКО" -> "13C7752E ЗАГОРУЛЬКО")
            text = re.sub(r"(\b1[23][A-Fa-f0-9]{6})([а-яА-ЯёЁіІїЇєЄґҐ])", r"\1 \2", text)
            # Fix digits concatenated with Cyrillic letters (e.g. "2746Картки" -> "2746 Картки")
            text = re.sub(r"(\d+)([а-яА-ЯёЁіІїЇєЄґҐ])", r"\1 \2", text)
            # Fix Latin characters or quotes concatenated with Cyrillic (e.g. "БАНК\"Переказ" -> "БАНК\" Переказ")
            text = re.sub(r"([a-zA-Z0-9\"'`])([а-яА-ЯёЁіІїЇєЄґҐ])", r"\1 \2", text)
            
            self._extract_period(text)
            
            # Визначаємо банк
            bank_name = "ПриватБанк"
            if "а-банк" in text.lower() or "a-bank" in text.lower():
                bank_name = "А-Банк"
            elif "райффайзен" in text.lower() or "aval" in text.lower():
                bank_name = "Райффайзен"
            elif "пумб" in text.lower():
                bank_name = "ПУМБ"
            elif "sense" in text.lower():
                bank_name = "Sense Bank"
            self.bank_name = bank_name

            # Вилучаємо tax_id клієнта
            client_line = None
            for line in text.split("\n"):
                if "клієнт" in line.lower():
                    client_line = line
                    break
            if client_line:
                match_tax_id = re.search(r"(\d{8,10})", client_line)
                if match_tax_id:
                    self.statement_tax_id = match_tax_id.group(1)

            # Розбиваємо текст на рядки
            lines = [line.strip() for line in text.split("\n") if line.strip()]

            # 1. Спробуємо розпарсити послідовний макет А-Банку/ПриватБанку
            transactions = self._parse_sequential_lines(lines, bank_name)

            # 2. Якщо послідовний макет не знайшов транзакцій, спробуємо старий метод (пошук регулярними виразами на одному рядку)
            if not transactions:
                i = 0
                while i < len(lines):
                    line = lines[i]
                    header_match = re.search(r"\b(\d{2}\s*\.\s*\d{2}\s*\.\s*\d{4})$", line)
                    if header_match:
                        date_str = self._clean_date(header_match.group(1))
                        ignore_keywords = ["період", "виписка", "залишок", "разом за", "єдрпоу", "рнокпп", "поточний рахунок", "рахунок №"]
                        if any(kw in line.lower() for kw in ignore_keywords):
                            i += 1
                            continue
                        if i + 1 < len(lines):
                            next_line = lines[i+1]
                            detail_match = re.match(r"^(\d{2}:\d{2})\s*(-?\d{1,3}(?:\s\d{3})*[\.,]\d{2})(?:\s+(.*))?$", next_line)
                            if detail_match:
                                time_str = detail_match.group(1)
                                amount = self._clean_number(detail_match.group(2))
                                purpose_start = detail_match.group(3) or ""
                                tx_lines = [purpose_start] if purpose_start else []
                                j = i + 2
                                while j < len(lines):
                                    next_tx_line = lines[j]
                                    if re.search(r"\b(\d{2}\s*\.\s*\d{2}\s*\.\s*\d{4})$", next_tx_line):
                                        if j + 1 < len(lines) and re.match(r"^\d{2}:\d{2}", lines[j+1]):
                                            break
                                    tx_lines.append(next_tx_line)
                                    j += 1
                                
                                purpose, contragent, tx_edrpou, tx_iban = self._extract_details_from_lines(tx_lines)

                                tx_dict = self._create_transaction_dict(
                                    date=self._clean_date(date_str),
                                    amount=amount,
                                    purpose=purpose,
                                    contragent=contragent,
                                    bank_name=bank_name
                                )
                                tx_dict["edrpou"] = tx_edrpou
                                tx_dict["iban"] = tx_iban

                                transactions.append(tx_dict)
                                i = j
                                continue
                    i += 1

            # 3. Резервний найпростіший рядок-за-рядком пошук
            if not transactions:
                for line in lines:
                    match = re.search(r"(\d{2}\.\d{2}\.\d{4})", line)
                    if match:
                        date_str = match.group(1)
                        line_without_date = line.replace(date_str, "")
                        amounts = re.findall(r"(-?\d+(?:[\s\.,]\d+)*)", line_without_date)
                        valid_amounts = []
                        for amt in amounts:
                            try:
                                val = self._clean_number(amt)
                                if val != 0.0:
                                    valid_amounts.append(val)
                            except ValueError:
                                continue
                        if valid_amounts:
                            amount = valid_amounts[0]
                            purpose = line_without_date
                            for amt in amounts:
                                purpose = purpose.replace(amt, "")
                            purpose = re.sub(r"\s+", " ", purpose).strip()
                            
                            tx_dict = self._create_transaction_dict(
                                date=self._clean_date(date_str),
                                amount=amount,
                                purpose=purpose,
                                contragent=self._extract_contragent(purpose),
                                bank_name=bank_name
                            )
                            transactions.append(tx_dict)

            if transactions:
                return transactions
            return self._parse_with_ai(file_path, "Не знайдено транзакцій у TXT")
        except Exception as e:
            return self._parse_with_ai(file_path, f"Помилка парсингу TXT: {str(e)}")

    def _parse_with_ai(self, file_path, reason):
        """
        Універсальний AI-парсер.
        Якщо локальний Ollama доступний, надсилає запит до Llama3.
        Якщо ні — використовує вбудований симульований AI-парсер
        (який містить базову евристику для вилучення даних з тексту).
        """
        print(f"[AI Parser Triggered] Причина: {reason}. Файл: {file_path}")
        
        # Читаємо текст із файлу
        text_content = ""
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            try:
                with open(file_path, "rb") as f:
                    reader = pypdf.PdfReader(f)
                    for page in reader.pages:
                        text_content += (page.extract_text() or "") + "\n"
            except Exception:
                pass
        else:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    text_content = f.read()
            except Exception:
                pass

        if not text_content:
            text_content = f"[Порожній вміст або бінарний файл {os.path.basename(file_path)}]"

        # Перевірка доступності Ollama
        try:
            prompt = f"""
Твоє завдання — розпарсити виписку банку та повернути JSON список транзакцій.
Кожна транзакція повинна містити поля:
- date: дата у форматі YYYY-MM-DD
- amount: число (float), позитивне для доходів, негативне для витрат
- purpose: призначення платежу українською мовою
- contragent: назва компанії чи ім'я особи контрагента

Текст виписки:
\"\"\"
{text_content[:2000]}
\"\"\"

Поверни ТІЛЬКИ чистий JSON у форматі масиву об'єктів [{{...}}, {{...}}], без жодних вступних чи підсумкових слів.
"""
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": "llama3",
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                },
                timeout=5
            )
            if response.status_code == 200:
                result_json = response.json().get("response", "")
                parsed = json.loads(result_json)
                if isinstance(parsed, list):
                    # Приводимо до стандартного формату
                    transactions = []
                    for tx in parsed:
                        transactions.append(self._create_transaction_dict(
                            date=tx.get("date", datetime.now().strftime("%Y-%m-%d")),
                            amount=float(tx.get("amount", 0)),
                            purpose=tx.get("purpose", ""),
                            contragent=tx.get("contragent", ""),
                            bank_name="AI-Розпізнано"
                        ))
                    return transactions
        except Exception as e:
            # Якщо Ollama недоступний, використовуємо евристичний резервний парсер для тестів
            print(f"[AI Parser Warning] Ollama не відповідає ({str(e)}). Використовуємо евристичний резервний парсер.")
        
        return self._heuristic_fallback_parser(text_content, file_path)

    def _heuristic_fallback_parser(self, text, file_path):
        """
        Евристичний резервний парсер для демонстраційних та тестових цілей.
        Він шукає шаблони дат та сум у тексті, які могли бути пропущені.
        """
        transactions = []
        # Простий парсинг для тестових файлів
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        
        # Спочатку шукаємо блоками (коли комірки у PDF розбиті по рядках)
        i = 0
        while i < len(lines):
            line = lines[i]
            # Дозволяємо опціональний час після дати
            date_match = re.match(r"^\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?$", line)
            if date_match:
                date_str = line.split(" ")[0]
                # Валідація для відсікання помилкових збігів
                try:
                    parts = date_str.split(".")
                    d_val, m_val, y_val = int(parts[0]), int(parts[1]), int(parts[2])
                    if not (1 <= m_val <= 12 and 1 <= d_val <= 31 and 1990 <= y_val <= 2100):
                        i += 1
                        continue
                    datetime(y_val, m_val, d_val)
                except ValueError:
                    i += 1
                    continue
                if i + 1 < len(lines):
                    next1 = lines[i+1]
                    # Наступний рядок є описом
                    if not re.match(r"^\d{2}\.\d{2}\.\d{4}", next1) and not re.match(r"^-?[\d\s\.,]+$", next1):
                        found_amount = None
                        amount_idx = -1
                        for j in range(i+2, min(i+5, len(lines))):
                            cand = lines[j]
                            try:
                                val = self._clean_number(cand)
                                if val != 0.0 and abs(val) < 10000000.0:
                                    found_amount = val
                                    amount_idx = j
                                    break
                            except ValueError:
                                continue
                        
                        if found_amount is not None:
                            transactions.append(self._create_transaction_dict(
                                date=self._clean_date(date_str),
                                amount=found_amount,
                                purpose=next1,
                                contragent=self._extract_contragent(next1),
                                bank_name="Евристичний AI"
                            ))
                            i = amount_idx + 1
                            continue
            i += 1
            
        # Якщо блоками не знайшли, спробуємо знайти в межах одного рядка
        for line in lines:
            # Ігноруємо службові рядки заголовків та підсумків
            ignore_keywords = ["період", "виписка", "залишок", "разом за", "єдрпоу", "рнокпп", "поточний рахунок", "дата останньої", "рахунок №", "обороти"]
            if any(kw in line.lower() for kw in ignore_keywords):
                continue
                
            # Шукаємо дати на кшталт 12.03.2025
            date_match = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", line)
            if date_match:
                day, month, year = date_match.groups()
                
                # Валідація дати для відсікання помилкових збігів (наприклад, 30.89.0000)
                try:
                    d_val = int(day)
                    m_val = int(month)
                    y_val = int(year)
                    # Перевіряємо межі значень
                    if not (1 <= m_val <= 12 and 1 <= d_val <= 31 and 1990 <= y_val <= 2100):
                        continue
                    # Додаткова календарна перевірка
                    datetime(y_val, m_val, d_val)
                except ValueError:
                    continue
                
                date_str = f"{year}-{month}-{day}"
                
                # Вилучаємо дату, щоб дні/місяці не вважались сумою
                clean_line = line.replace(date_match.group(0), "")
                
                # Вилучаємо час, щоб він не вважався сумою
                clean_line = re.sub(r"\b\d{2}:\d{2}(?::\d{2})?\b", "", clean_line)
                
                # Шукаємо числа (наприклад, -500 000.00 або 350.00 або -1250)
                # Використовуємо lookbehind/lookahead, щоб число було окремим токеном
                numbers = re.findall(r"(?<![a-zA-Z0-9])(-?\d+(?:[\s\.,]\d+)*)(?![a-zA-Z0-9])", clean_line)
                money_amounts = []
                for num in numbers:
                    try:
                        val = self._clean_number(num)
                        # Ігноруємо коди контрагентів або ІПН (наприклад, > 10 млн)
                        # А також надто довгі числа без десяткової крапки
                        if "." not in num and "," not in num and len(num) > 6:
                            continue
                        if val != 0.0 and abs(val) < 10000000.0:
                            money_amounts.append(val)
                    except ValueError:
                        continue
                
                if money_amounts:
                    amount = money_amounts[0]
                    # Опис — це все, крім дати та сум
                    purpose = clean_line
                    for num in numbers:
                        purpose = purpose.replace(num, "")
                    purpose = re.sub(r"\s+", " ", purpose).strip()
                    
                    transactions.append(self._create_transaction_dict(
                        date=date_str,
                        amount=amount,
                        purpose=purpose,
                        contragent=self._extract_contragent(purpose),
                        bank_name="Евристичний AI"
                    ))
        
        # Видаляємо дублікати
        seen = set()
        unique_txs = []
        for tx in transactions:
            key = (tx["date"], tx["amount"], tx["purpose"])
            if key not in seen and tx["amount"] != 0:
                seen.add(key)
                unique_txs.append(tx)
        
        return unique_txs

    def _parse_tax_cabinet_extract(self, text: str) -> list:
        """
        Розпарсити витяг/виписку з кабінету платника податків про стан взаєморозрахунків з бюджетом.
        """
        results = []
        lines = text.split("\n")
        
        # Mappings of tax codes to internal tax types
        code_mapping = {
            "18050400": ("unified_tax", "Єдиний податок з фізичних осіб"),
            "11011700": ("military_tax", "Військовий збір"),
            "11011000": ("military_tax", "Військовий збір"),
            "11011001": ("military_tax", "Військовий збір"),
            "71040000": ("esv", "Єдиний соціальний внесок (ЄСВ)"),
            "71010000": ("esv", "Єдиний соціальний внесок (ЄСВ)"),
            "11010100": ("pit", "ПДФО (Податок на доходи фізичних осіб)"),
            "11010500": ("pit", "ПДФО (Податок на доходи фізичних осіб)"),
        }
        
        for line in lines:
            line_clean = line.strip()
            if not line_clean:
                continue
                
            # Find if any tax code matches
            matched_code = None
            for code in code_mapping:
                if code in line_clean:
                    matched_code = code
                    break
                    
            if not matched_code:
                continue
                
            tax_type, tax_name = code_mapping[matched_code]
            
            # Find numbers in the line that come after the tax code
            parts = line_clean.split(matched_code)
            if len(parts) < 2:
                continue
            right_side = parts[1]
            
            # Remove territory code if it exists (e.g. UA12020010000033698)
            right_side = re.sub(r"UA\d{15,20}", "", right_side, flags=re.IGNORECASE)
            
            # Find all numbers like "0,00", "1 729,40", "5 707,02", etc.
            numbers = re.findall(r"(-?\d+(?:\s+\d+)*(?:[.,]\d+)?)", right_side)
            
            # Filter and convert to float
            float_numbers = []
            for num_str in numbers:
                try:
                    # Clean spaces and convert comma to dot
                    clean_num = num_str.replace(" ", "").replace(",", ".")
                    float_numbers.append(float(clean_num))
                except ValueError:
                    continue
            
            # We expect at least three numbers: [overpayment, underpayment, penalty]
            if len(float_numbers) >= 3:
                overpayment = float_numbers[0]
                underpayment = float_numbers[1]
                penalty = float_numbers[2]
            elif len(float_numbers) == 2:
                overpayment = float_numbers[0]
                underpayment = float_numbers[1]
                penalty = 0.0
            elif len(float_numbers) == 1:
                overpayment = float_numbers[0] if float_numbers[0] > 0 else 0.0
                underpayment = abs(float_numbers[0]) if float_numbers[0] < 0 else 0.0
                penalty = 0.0
            else:
                overpayment = 0.0
                underpayment = 0.0
                penalty = 0.0
                
            results.append({
                "tax_type": tax_type,
                "tax_name": tax_name,
                "tax_code": matched_code,
                "overpayment": overpayment,
                "underpayment": underpayment,
                "penalty": penalty
            })
            
        return results

    def _extract_details_from_lines(self, tx_lines):
        purpose_parts = []
        edrpou = None
        iban = None

        for line in tx_lines:
            line_clean = line.strip()
            if not line_clean:
                continue

            # Check for EDRPOU + IBAN on the same line
            match_iban_combined = re.search(r"(\d{8,10})\s*(UA\d{27})", line_clean, re.IGNORECASE)
            if match_iban_combined:
                edrpou = match_iban_combined.group(1)
                iban = match_iban_combined.group(2).upper()
                continue

            # Check for IBAN (UA followed by 27 digits, possibly with spaces/dashes)
            match_iban = re.search(r"\b(UA\s*\d{2}(?:\s*\d{4}){6})\b", line_clean, re.IGNORECASE)
            if not match_iban:
                # Fallback simple search
                match_iban = re.search(r"\b(UA\d{27})\b", line_clean.replace(" ", "").replace("-", ""))
            
            if match_iban:
                iban = match_iban.group(1).replace(" ", "").replace("-", "").upper()
                # If the line also has a tax id / EDRPOU (8 or 10 digits)
                match_tax = re.search(r"\b(\d{8}|\d{10})\b", line_clean)
                if match_tax:
                    edrpou = match_tax.group(1)
                continue

            # Check for tax_id/EDRPOU (8 or 10 digits) anywhere on the line
            match_tax_only = re.search(r"\b(\d{8}|\d{10})\b", line_clean)
            if match_tax_only:
                edrpou = match_tax_only.group(1)
                # We remove the tax id from the line clean so it doesn't clutter purpose
                line_clean = line_clean.replace(match_tax_only.group(0), "").strip()

            # Skip bank name or MFO
            if line_clean in ['АТ КБ "ПРИВАТБАНК"', 'АТ "А - БАНК"', 'КАЗНАЧЕЙСТВО УКРАЇНИ', 'АТ КБ \'ПРИВАТБАНК\'', 'АТ "А-БАНК"', 'АТ «АКЦЕНТ-БАНК»', 'АТ "А - БАНК"', 'АТ "А-БАНК"']:
                continue
            if re.match(r"^\d{4}$", line_clean): # MFO
                continue
            if line_clean == "--- PAGE ---":
                continue

            # Clean trailing/leading spaces but keep commas
            line_clean = line_clean.strip()
            if line_clean:
                purpose_parts.append(line_clean)

        purpose = " ".join(purpose_parts)
        contragent = self._extract_contragent(purpose)

        # If contragent is not found but we have purpose_parts, try to clean it
        if contragent == "Невідомий Контрагент" and purpose_parts:
            # First line of purpose_parts might be the contragent name
            first_line = purpose_parts[0].strip()
            # If it doesn't look like a standard transaction purpose (no verbs, no 'оплата за' etc.)
            first_line_lower = first_line.lower()
            if not any(k in first_line_lower for k in ["оплата", "з/плата", "перерахов", "рахунок", "послуги", "договір"]):
                contragent = self._extract_contragent(first_line)
                if contragent == "Невідомий Контрагент" and len(first_line) > 3:
                    contragent = first_line.upper()

        return purpose, contragent, edrpou, iban

    def _determine_taxable_status(self, purpose: str, amount: float, sender_account: str = "") -> tuple[bool, str]:
        purpose_lower = purpose.lower()
        
        # Власні кошти
        if any(word in purpose_lower for word in ['власні кошти', 'own funds', 'поповнення з картки', 'переказ власних']):
            return False, 'own_funds'
        
        # Повернення
        if any(word in purpose_lower for word in ['повернення', 'refund', 'коригування', 'storno']):
            return False, 'refund'
        
        # Кредити/позики
        if any(word in purpose_lower for word in ['кредит', 'позика', 'loan', 'credit']):
            return False, 'loan'
        
        # Помилкові платежі
        if any(word in purpose_lower for word in ['помилково', 'mistake', 'error']):
            return False, 'refund'
        
        # Перевірка: чи рахунок відправника збігається з особистим рахунком
        if sender_account and self._is_own_account(sender_account):
            return False, 'own_funds'
        
        # За замовчуванням — дохід/витрата (оподатковується)
        if amount > 0:
            return True, 'income'
        else:
            return True, 'expense'
            
    def _is_own_account(self, account: str) -> bool:
        return False

    def _create_transaction_dict(self, date, amount, purpose, contragent, bank_name, sender_account=""):
        """Створення та категоризація транзакції"""
        tx_type = "expense"
        tax_type = None
        purpose_lower = purpose.lower()
        
        # Перевірка на LiqPay / acquiring дохід
        is_liqpay_acquiring = any(k in purpose_lower for k in ["liqpay", "liq pay", "acquiring", "еквайринг"])
        
        clean_amount = abs(amount)
        is_income = amount > 0 or is_liqpay_acquiring
        
        sign_amount = clean_amount if is_income else -clean_amount
        taxable, transaction_type = self._determine_taxable_status(purpose, sign_amount, sender_account)
        
        if is_income:
            tx_type = "income"
            direction_val = "in"
        else:
            tx_type = "expense"
            direction_val = "out"
            
            # Визначаємо, чи це сплата податків
            if re.search(r"\b(єдиний\s+податок|єп|еп|єдиного\s+податку|unified\s+tax|single\s+tax|edynogo\s+podatku|edynyi\s+podatok)\b", purpose_lower):
                tx_type = "tax_payment"
                tax_type = "unified_tax"
                transaction_type = "tax_payment"
            elif re.search(r"\b(єсв|есв|єдиний\s+соціальний|єдиного\s+соціального|esv|social\s+contribution|sotsialnoho\s+vnesku)\b", purpose_lower):
                tx_type = "tax_payment"
                tax_type = "esv"
                transaction_type = "tax_payment"
            elif re.search(r"\b(пдфо|податок\s+на\s+доходи|pit|pdfo)\b", purpose_lower):
                tx_type = "tax_payment"
                tax_type = "pit"
                transaction_type = "tax_payment"
            elif re.search(r"\b(військовий\s+збір|вз|військового\s+збору|military\s+tax|voennyi\s+sbor|vijskovyj\s+zbir|viiskovoho\s+zboru|вiйськовий\s+збiр|вiйськового\s+збору|вiйськовоий\s+збiр|вiйськовий\s+збір|військовоий\s+збір)\b", purpose_lower):
                tx_type = "tax_payment"
                tax_type = "military_tax"
                transaction_type = "tax_payment"
            elif re.search(r"\b(зарплата|заробітна\s+плата|salary|zarplata)\b", purpose_lower):
                tx_type = "salary_payment"
                transaction_type = "salary_payment"
                
        return {
            "date": date,
            "amount": clean_amount,
            "direction": direction_val,
            "purpose": purpose,
            "contragent": contragent,
            "type": tx_type,
            "tax_type": tax_type,
            "bank_name": bank_name,
            "taxable": taxable,
            "transaction_type": transaction_type
        }

    def _is_tx_start(self, lines, idx):
        line = lines[idx]
        # Шукаємо дату у форматі DD.MM.YYYY або DD/MM/YYYY
        dates = re.findall(r"(\d{2}\s*[./]\s*\d{2}\s*[./]\s*\d{4})", line)
        if dates and idx + 1 < len(lines):
            next_line = lines[idx+1]
            if re.match(r"^\d{2}:\d{2}(?::\d{2})?", next_line):
                return dates[-1].replace("/", ".")
        return None

    def _parse_sequential_lines(self, lines, bank_name):
        transactions = []
        i = 0
        while i < len(lines):
            date_str = self._is_tx_start(lines, i)
            if date_str:
                # Знайдено початок транзакції!
                time_line = lines[i+1]
                time_match = re.match(r"^(\d{2}:\d{2}(?::\d{2})?)", time_line)
                time_str = time_match.group(1)
                remainder = time_line[len(time_str):].strip()
                
                # Перевіряємо чи рядок містить суму одразу після часу (як у карткових транзакціях ПриватБанку)
                amount_val = None
                amount_match = re.match(r"^(-?\d+[\s\d]*[.,]\d{2})", remainder)
                amount_extracted = False
                if amount_match:
                    amount_val = self._clean_number(amount_match.group(1))
                    remainder = remainder[len(amount_match.group(0)):].strip()
                    amount_extracted = True
                
                detail_lines = []
                if remainder:
                    # Якщо суму не було вилучено (макет А-Банку), перевіряємо чи remainder є номером платежу
                    if not amount_extracted:
                        if remainder.startswith(";"):
                            remainder = remainder[1:].strip()
                        num_match = re.match(r"^([A-Za-z0-9\s\./_-]+)", remainder)
                        if num_match:
                            remainder_details = remainder[len(num_match.group(0)):].strip()
                            if remainder_details:
                                detail_lines.append(remainder_details)
                        else:
                            detail_lines.append(remainder)
                    else:
                        detail_lines.append(remainder)
                    
                j = i + 2
                
                # Пропускаємо рядок номера документа, якщо він записаний окремим рядком (тільки для макета А-Банку)
                if not amount_extracted:
                    if j < len(lines):
                        line_to_check = lines[j]
                        if line_to_check.startswith(";"):
                            line_to_check = line_to_check[1:].strip()
                        if re.match(r"^[A-Za-z0-9\s\./_-]+$", line_to_check):
                            j += 1
                        
                balance_val = None
                while j < len(lines):
                    # Якщо ми дійшли до наступної транзакції, зупиняємось
                    if self._is_tx_start(lines, j):
                        break
                    
                    next_line = lines[j]
                    
                    if not amount_extracted:
                        # Перевіряємо чи це сума в кінці рядка (як у А-Банку)
                        amount_search = re.search(r"(-?\d+[\s\d]*[.,]\s*\d{2})\s*$", next_line)
                        if amount_search:
                            is_false_match = False
                            if amount_val is None and j + 1 < len(lines):
                                if re.match(r"^\s*UAH", lines[j+1], re.IGNORECASE):
                                    is_false_match = True
                                else:
                                    next_next_line = lines[j+1]
                                    if not re.match(r"^-?[\d\s]+[.,]\s*\d{2}$", next_next_line):
                                        is_false_match = True
                                        
                            if is_false_match:
                                if not any(k in next_line.lower() for k in ["дата та", "час операції", "номер платежу", "реквизити", "призначення"]):
                                    detail_lines.append(next_line)
                            else:
                                val = self._clean_number(amount_search.group(1))
                                if amount_val is None:
                                    amount_val = val
                                    next_line_stripped = next_line[:amount_search.start()].strip()
                                    if next_line_stripped:
                                        if not any(k in next_line_stripped.lower() for k in ["дата та", "час операції", "номер платежу", "реквизити", "призначення"]):
                                            detail_lines.append(next_line_stripped)
                                else:
                                    balance_val = val
                                    j += 1
                                    break
                        else:
                            if not any(k in next_line.lower() for k in ["дата та", "час операції", "номер платежу", "реквизити", "призначення"]):
                                detail_lines.append(next_line)
                    else:
                        # Для ПриватБанку, де суму вже вилучено з першого рядка
                        if not any(k in next_line.lower() for k in ["дата та", "час операції", "номер платежу", "реквизити", "призначення"]):
                            detail_lines.append(next_line)
                    j += 1
                    
                if amount_val is not None:
                    purpose, contragent, tx_edrpou, tx_iban = self._extract_details_from_lines(detail_lines)
                    
                    # Clean up leading semicolon/junk from purpose/contragent if they leaked in
                    purpose = re.sub(r"^;\s*", "", purpose)
                    contragent = re.sub(r"^;\s*", "", contragent)
                    
                    tx_dict = self._create_transaction_dict(
                        date=self._clean_date(date_str),
                        amount=amount_val,
                        purpose=purpose,
                        contragent=contragent,
                        bank_name=bank_name
                    )
                    tx_dict["edrpou"] = tx_edrpou
                    tx_dict["iban"] = tx_iban
                    
                    transactions.append(tx_dict)
                    i = j
                    continue
            i += 1
        return transactions

    def _clean_date(self, date_str):
        """Перетворення дати з DD.MM.YYYY або DD.MM.YYYY HH:MM в YYYY-MM-DD"""
        date_str = date_str.strip()
        # Замінюємо косу риску на крапку
        date_str = date_str.replace("/", ".")
        # Очищаємо пробіли всередині дати (наприклад, "29 .05.2026" -> "29.05.2026")
        date_str = re.sub(r"\s*\.\s*", ".", date_str)
        # Якщо є час, відсікаємо його
        if " " in date_str:
            date_str = date_str.split(" ")[0]
        try:
            dt = datetime.strptime(date_str, "%d.%m.%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                return datetime.now().strftime("%Y-%m-%d")

    def _clean_number(self, value: str) -> float:
        """Очищення рядка числа від пробілів та роздільників тисяч."""
        if not value:
            return 0.0
            
        # Видаляємо всі види пробілів
        value = value.replace(" ", "").replace("\xa0", "").replace("\u2007", "").replace("\u202f", "")
        
        # Видалити крапки-роздільники тисяч
        if "." in value:
            parts = value.split(".")
            if len(parts) == 2 and len(parts[1]) != 2:
                value = value.replace(".", "")
            elif len(parts) > 2:
                # Якщо останній елемент має довжину 2, то це центи/копійки, тому об'єднуємо всі крім останнього
                if len(parts[-1]) == 2:
                    value = "".join(parts[:-1]) + "." + parts[-1]
                else:
                    value = value.replace(".", "")
                    
        value = value.replace(",", ".")
        try:
            return float(value)
        except ValueError:
            return 0.0

    def _normalize_ukrainian_i(self, text: str) -> str:
        """Нормалізація латинської 'i' / 'I' до кириличної 'і' / 'І', якщо вони знаходяться у кириличному контексті"""
        cyr = r"[а-яА-ЯёЁіІїЇєЄґҐ]"
        for _ in range(2):
            text = re.sub(f"({cyr})i({cyr})", r"\1і\2", text)
            text = re.sub(f"({cyr})I({cyr})", r"\1І\2", text)
            text = re.sub(f"({cyr})i", r"\1і", text)
            text = re.sub(f"({cyr})I", r"\1І", text)
            text = re.sub(f"i({cyr})", r"і\1", text)
            text = re.sub(f"I({cyr})", r"І\1", text)
        return text

    def _extract_contragent(self, purpose):
        """Евристичне вилучення назви контрагента з призначення платежу"""
        purpose_clean = purpose.strip()
        purpose_lower = purpose_clean.lower()
        
        # 1. Сплата податків
        if "гук у" in purpose_lower or "казначей" in purpose_lower:
            match_guk = re.search(r'(гук\s+[а-яа-ієґыэя\s\.\/,-]+)', purpose_lower)
            if match_guk:
                return match_guk.group(1).strip().upper()
            return "Казначейство України"
            
        # 2. РКО банку
        if "оплата рко" in purpose_lower or "акцент-банк" in purpose_lower or "а-банк" in purpose_lower:
            if "акцент-банк" in purpose_lower:
                return "АТ «АКЦЕНТ-БАНК»"
            return "АТ «А-БАНК»"

        # 3. Операції з карткою (MasterCard/Visa еквайринг/термінали)
        if "операція з карткою" in purpose_lower or "картка" in purpose_lower:
            match_merchant = re.search(r'(?:№\s*\w+,\s*\d+,\s*|optistroj\d+,\s*|shop\s+)([a-z0-9\s\.-]+?)(?:,\s*[a-z0-9\s\.-]+)?(?:,\s*\d{4}|\b|$)', purpose_clean, re.IGNORECASE)
            if match_merchant:
                cand = match_merchant.group(1).strip()
                if len(cand) > 3 and not cand.isdigit():
                    return cand.upper()
            match_lat = re.search(r'\b([A-Z]{3,15}(?:\s+[A-Z0-9]{2,15})*)\b', purpose_clean)
            if match_lat:
                return match_lat.group(1).upper()
            return "Платіжний термінал"

        # 4. Шаблони ТОВ, ФОП, ПП
        match_tov = re.search(r'\b(тов\s+[^,\n]+|товариство з обмеженою[^,\n]+)', purpose_lower)
        if match_tov:
            return match_tov.group(1).upper()
            
        match_fop = re.search(r'\b(фоп\s+[а-яа-ієґыэя\u0456\u0457\u0454\u0491\s\.]+)', purpose_lower)
        if match_fop:
            return match_fop.group(1).strip().upper()

        match_pp = re.search(r'\b(пп\s+[а-яа-ієґыэя\u0456\u0457\u0454\u0491\s\.]+)', purpose_lower)
        if match_pp:
            return match_pp.group(1).strip().upper()

        # 5. Якщо на початку є ПІБ або назва компанії
        parts = purpose_clean.split(",")
        if parts:
            first_part = parts[0].strip()
            words = first_part.split()
            if len(words) >= 2 and all(re.match(r'^[а-яа-ієґыэя\u0456\u0457\u0454\u0491\.\'-]+$', w, re.IGNORECASE) for w in words):
                return first_part.upper()
            if len(first_part) > 5 and not first_part.isdigit() and not first_part.startswith("IBAN:") and not first_part.startswith("Карти MasterCard"):
                return first_part.upper()

        return "Невідомий Контрагент"



if __name__ == "__main__":
    # Простий тест парсера на згенерованих файлах
    parser = UniversalParser()
    samples_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "samples")
    
    print("=== ТЕСТУВАННЯ ПАРСЕРА ===")
    for filename in ["monobank.csv", "oschad.html", "pryvat24.pdf", "abank.pdf"]:
        path = os.path.join(samples_dir, filename)
        if os.path.exists(path):
            print(f"\nТестуємо: {filename}")
            try:
                txs = parser.parse(path)
                print(f"Знайдено транзакцій: {len(txs)}")
                for t in txs[:2]:
                    print(f"  - Дата: {t['date']}, Сума: {t['amount']} UAH, Тип: {t['type']} ({t['tax_type'] or ''}), Опис: {t['purpose'][:40]}...")
            except Exception as e:
                print(f"  Помилка: {e}")
