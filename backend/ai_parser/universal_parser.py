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

    def parse(self, file_path):
        """
        Головний метод парсингу, який визначає формат файлу та відповідний банк.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Файл не знайдено: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == ".csv":
            return self._parse_csv(file_path)
        elif ext in (".html", ".htm"):
            return self._parse_html(file_path)
        elif ext == ".pdf":
            return self._parse_pdf(file_path)
        elif ext == ".txt":
            return self._parse_txt(file_path)
        else:
            return self._parse_with_ai(file_path, "Невідомий формат файлу")

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
                        
                        transactions.append(self._create_transaction_dict(
                            date=self._clean_date(date_str),
                            amount=amount,
                            purpose=purpose,
                            contragent=contragent,
                            bank_name=bank_name
                        ))
                return transactions
            
            return self._parse_with_ai(file_path, "Не знайдено таблицю в HTML")
        except Exception as e:
            return self._parse_with_ai(file_path, f"Помилка парсингу HTML: {str(e)}")

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

            # Парсимо виписку рядок за рядком
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            i = 0
            while i < len(lines):
                line = lines[i]

                # Спочатку спробуємо знайти блок з кількох рядків (якщо комірки таблиці зчитались по черзі на нових рядках)
                if re.match(r"^\d{2}\.\d{2}\.\d{4}$", line):
                    date_str = line
                    # 4-рядковий блок: 1. Дата, 2. Опис, 3. Сума, 4. Баланс
                    if i + 3 < len(lines):
                        next1 = lines[i+1]
                        next2 = lines[i+2]
                        next3 = lines[i+3]
                        try:
                            # Перевіряємо чи next2 та next3 схожі на грошові суми
                            amount = self._clean_number(next2)
                            balance = self._clean_number(next3)
                            # Опис не повинен бути датою або чисто сумою
                            if not re.match(r"^\d{2}\.\d{2}\.\d{4}$", next1) and not re.match(r"^-?[\d\s\.,]+$", next1):
                                transactions.append(self._create_transaction_dict(
                                    date=self._clean_date(date_str),
                                    amount=amount,
                                    purpose=next1,
                                    contragent=self._extract_contragent(next1),
                                    bank_name=bank_name
                                ))
                                i += 4
                                continue
                        except ValueError:
                            pass

                    # 3-рядковий блок: 1. Дата, 2. Опис, 3. Сума
                    if i + 2 < len(lines):
                        next1 = lines[i+1]
                        next2 = lines[i+2]
                        try:
                            amount = self._clean_number(next2)
                            if not re.match(r"^\d{2}\.\d{2}\.\d{4}$", next1) and not re.match(r"^-?[\d\s\.,]+$", next1):
                                transactions.append(self._create_transaction_dict(
                                    date=self._clean_date(date_str),
                                    amount=amount,
                                    purpose=next1,
                                    contragent=self._extract_contragent(next1),
                                    bank_name=bank_name
                                ))
                                i += 3
                                continue
                        except ValueError:
                            pass

                # Спробуємо розпарсити однорядковий формат (коли колони в одному рядку через пробіли)
                # 4 шпальти (Дата, Опис/Призначення, Сума, Баланс)
                match4 = re.match(r"^(\d{2}\.\d{2}\.\d{4})\s+(.*?)\s+(-?\d{1,3}(?:[\s\.,]\d{3})*(?:[\.,]\d{2})?)\s+(-?\d{1,3}(?:[\s\.,]\d{3})*(?:[\.,]\d{2})?)$", line)
                if match4:
                    date_str, purpose, amount_str, balance_str = match4.groups()
                    try:
                        amount = self._clean_number(amount_str)
                        transactions.append(self._create_transaction_dict(
                            date=self._clean_date(date_str),
                            amount=amount,
                            purpose=purpose.strip(),
                            contragent=self._extract_contragent(purpose),
                            bank_name=bank_name
                        ))
                        i += 1
                        continue
                    except ValueError:
                        pass

                # 3 шпальти (Дата, Опис/Призначення, Сума)
                match3 = re.match(r"^(\d{2}\.\d{2}\.\d{4})\s+(.*?)\s+(-?\d{1,3}(?:[\s\.,]\d{3})*(?:[\.,]\d{2})?)$", line)
                if match3:
                    date_str, purpose, amount_str = match3.groups()
                    try:
                        amount = self._clean_number(amount_str)
                        transactions.append(self._create_transaction_dict(
                            date=self._clean_date(date_str),
                            amount=amount,
                            purpose=purpose.strip(),
                            contragent=self._extract_contragent(purpose),
                            bank_name=bank_name
                        ))
                        i += 1
                        continue
                    except ValueError:
                        pass

                i += 1

            if transactions:
                return transactions
                
            return self._parse_with_ai(file_path, "Не вдалося витягти транзакції регулярними виразами з PDF")
        except Exception as e:
            return self._parse_with_ai(file_path, f"Помилка парсингу PDF: {str(e)}")

    def _parse_txt(self, file_path):
        """Парсинг TXT виписок"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
            # Простий рядок-за-рядком пошук
            transactions = []
            lines = text.split("\n")
            for line in lines:
                # Шукаємо дати
                match = re.search(r"(\d{2}\.\d{2}\.\d{4})", line)
                if match:
                    date_str = match.group(1)
                    # Видаляємо дату для уникнення збігів дня/місяця як суми
                    line_without_date = line.replace(date_str, "")
                    # Спробуємо знайти числа (суми)
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
                        transactions.append(self._create_transaction_dict(
                            date=self._clean_date(date_str),
                            amount=amount,
                            purpose=purpose,
                            contragent=self._extract_contragent(purpose),
                            bank_name="Текстова виписка"
                        ))
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
            date_match = re.match(r"^\d{2}\.\d{2}\.\d{4}$", line)
            if date_match:
                date_str = line
                if i + 1 < len(lines):
                    next1 = lines[i+1]
                    # Наступний рядок є описом
                    if not re.match(r"^\d{2}\.\d{2}\.\d{4}$", next1) and not re.match(r"^-?[\d\s\.,]+$", next1):
                        found_amount = None
                        amount_idx = -1
                        for j in range(i+2, min(i+5, len(lines))):
                            cand = lines[j]
                            try:
                                val = self._clean_number(cand)
                                if val != 0.0:
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
            # Шукаємо дати на кшталт 12.03.2025
            date_match = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", line)
            if date_match:
                day, month, year = date_match.groups()
                date_str = f"{year}-{month}-{day}"
                
                # Вилучаємо дату, щоб дні/місяці не вважались сумою
                clean_line = line.replace(date_match.group(0), "")
                
                # Шукаємо числа (наприклад, -500 000.00 або 350.00 або -1250)
                numbers = re.findall(r"(-?\d+(?:[\s\.,]\d+)*)", clean_line)
                money_amounts = []
                for num in numbers:
                    try:
                        val = self._clean_number(num)
                        if val != 0.0:
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

    def _clean_date(self, date_str):
        """Перетворення дати з DD.MM.YYYY або DD.MM.YYYY HH:MM в YYYY-MM-DD"""
        date_str = date_str.strip()
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
        
        # Якщо присутні і крапка, і кома, визначаємо десятковий роздільник за останньою позицією
        if "." in value and "," in value:
            if value.find(",") > value.find("."):
                value = value.replace(".", "").replace(",", ".")
            else:
                value = value.replace(",", "").replace(".", ".")
        
        # Якщо більше ніж одна крапка або кома — це роздільники тисяч
        if value.count(".") > 1:
            value = value.replace(".", "")
        if value.count(",") > 1:
            value = value.replace(",", "")
            
        # Якщо залишилась одна крапка або кома
        if value.count(".") == 1:
            parts = value.split(".")
            if len(parts[1]) == 3:  # роздільник тисяч (наприклад, 500.000)
                value = value.replace(".", "")
        elif value.count(",") == 1:
            parts = value.split(",")
            if len(parts[1]) == 3:  # роздільник тисяч (наприклад, 500,000)
                value = value.replace(",", "")
            else:
                value = value.replace(",", ".")
                
        return float(value)

    def _extract_contragent(self, purpose):
        """Евристичне вилучення назви контрагента з призначення платежу"""
        purpose_lower = purpose.lower()
        
        # Шаблони ТОВ, ФОП, ПП
        match = re.search(r'(тов\s+["\'].*?["\']|фоп\s+[а-яа-ієґыэя\s\.]+)', purpose_lower)
        if match:
            return match.group(1).upper()
            
        # Якщо є слово "від", беремо наступне
        match_vid = re.search(r'від\s+([а-яа-ієґыэя\s"\'\.-]+)', purpose_lower)
        if match_vid:
            words = match_vid.group(1).strip().split()
            if words:
                return " ".join(words[:3]).upper()
                
        return "Невідомий Контрагент"

    def _create_transaction_dict(self, date, amount, purpose, contragent, bank_name):
        """Створення та категоризація транзакції"""
        tx_type = "expense"
        tax_type = None
        
        if amount > 0:
            tx_type = "income"
        else:
            # Визначаємо, чи це сплата податків
            purpose_lower = purpose.lower()
            if any(k in purpose_lower for k in ["єдиний податок", "єп", "єдиного податку", "unified tax", "single tax", "edynogo podatku", "edynyi podatok", "ep "]):
                tx_type = "tax_payment"
                tax_type = "unified_tax"
            elif any(k in purpose_lower for k in ["єсв", "єдиний соціальний", "єдиного соціального", "esv", "social contribution", "sotsialnoho vnesku"]):
                tx_type = "tax_payment"
                tax_type = "esv"
            elif any(k in purpose_lower for k in ["пдфо", "податок на доходи", "pit", "pdfo"]):
                tx_type = "tax_payment"
                tax_type = "pit"
            elif any(k in purpose_lower for k in ["військовий збір", "вз", "військового збору", "military tax", "voennyi sbor", "vijskovyj zbir", "viiskovoho zboru"]):
                tx_type = "tax_payment"
                tax_type = "military_tax"
                
        return {
            "date": date,
            "amount": abs(amount), # зберігаємо суми як позитивні, тип визначає напрямок
            "direction": "in" if amount > 0 else "out",
            "purpose": purpose,
            "contragent": contragent,
            "type": tx_type,
            "tax_type": tax_type,
            "bank_name": bank_name
        }

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
