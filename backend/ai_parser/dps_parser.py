import io
import re
import openpyxl
import xlrd
import pypdf
from datetime import datetime
from typing import List, Dict, Any

def parse_amount(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s or s == '-' or s == '—':
        return 0.0
    # Remove spaces, non-breaking spaces, and convert comma to dot
    s = s.replace(" ", "").replace("\xa0", "").replace(",", ".")
    # If there are multiple dots, keep only the last one (or clean up)
    try:
        return float(s)
    except ValueError:
        # Try extracting the first valid float pattern
        match = re.search(r"[-+]?\d*\.\d+|\d+", s)
        if match:
            try:
                return float(match.group())
            except ValueError:
                return 0.0
        return 0.0

def parse_date(val: Any) -> datetime:
    """Parse date from Excel cell or string"""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, (int, float)):
        try:
            return xlrd.xldate_as_datetime(val, 0)
        except Exception:
            try:
                from datetime import timedelta
                return datetime(1899, 12, 30) + timedelta(days=val)
            except Exception:
                pass
    s = str(val).strip()
    # Check if the string itself is a float value (e.g. "46193.0")
    try:
        f_val = float(s)
        try:
            return xlrd.xldate_as_datetime(f_val, 0)
        except Exception:
            try:
                from datetime import timedelta
                return datetime(1899, 12, 30) + timedelta(days=f_val)
            except Exception:
                pass
    except ValueError:
        pass

    if not s:
        return None
    # Try DD.MM.YYYY format
    match = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", s)
    if match:
        try:
            return datetime(int(match.group(3)), int(match.group(2)), int(match.group(1)))
        except ValueError:
            pass
    # Try YYYY-MM-DD format
    match = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if match:
        try:
            return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
        except ValueError:
            pass
    return None

# Code mapping to canonical tax names (if needed)
CODE_MAPPING = {
    "18050400": "Єдиний податок з фізичних осіб",
    "11011700": "Військовий збір",
    "11011000": "Військовий збір",
    "11011001": "Військовий збір",
    "71040000": "Єдиний соціальний внесок (ЄСВ)",
    "71010000": "Єдиний соціальний внесок (ЄСВ)",
    "11010100": "ПДФО (Податок на доходи фізичних осіб)",
    "11010500": "ПДФО (Податок на доходи фізичних осіб)",
}

class DPSParser:
    """
    Парсер виписки "Стан розрахунків з бюджетом" з Електронного кабінету
    """
    
    async def parse(self, file_content: bytes, filename: str) -> list:
        """
        Розпізнає таблицю:
        | Назва | Код | Надміру сплачені | Податковий борг | Пеня |
        """
        # Для Excel/CSV
        if filename.endswith(('.xlsx', '.xls')):
            return await self._parse_excel(file_content)
        # Для PDF
        elif filename.endswith('.pdf'):
            return await self._parse_pdf(file_content)
        # Для текстового файлу (скопійовано з сайту)
        else:
            return await self._parse_text(file_content)
            
    async def _parse_excel(self, file_content: bytes) -> list:
        """Розпізнає Excel виписку"""
        try:
            # Try xlrd for .xls files first
            try:
                wb = xlrd.open_workbook(file_contents=file_content)
                results = []
                print(f"[DPSParser] Opened workbook with {wb.nsheets} sheets")
                for sheet_idx, sheet in enumerate(wb.sheets()):
                    print(f"[DPSParser] Processing sheet {sheet_idx}: {sheet.name}, rows: {sheet.nrows}, cols: {sheet.ncols}")
                    
                    # Find header row to map columns
                    header_row_idx = -1
                    col_mapping = {}
                    for row_idx in range(min(10, sheet.nrows)):
                        row = sheet.row(row_idx)
                        row_vals = [str(cell.value).lower().strip() for cell in row]
                        if any('надмір' in v or 'борг' in v or 'пеня' in v or 'нарахован' in v or 'сплачен' in v or 'термін' in v or 'дата' in v for v in row_vals):
                            header_row_idx = row_idx
                            for col_idx, val in enumerate(row_vals):
                                if 'надмір' in val or 'перепла' in val:
                                    col_mapping['overpaid'] = col_idx
                                elif 'борг' in val:
                                    col_mapping['debt'] = col_idx
                                elif 'пеня' in val:
                                    col_mapping['penalty'] = col_idx
                                elif 'нарахован' in val:
                                    col_mapping['accrued'] = col_idx
                                elif 'сплачен' in val:
                                    col_mapping['paid'] = col_idx
                                elif 'термін' in val or 'дата' in val:
                                    col_mapping['deadline'] = col_idx
                            print(f"[DPSParser] Found header row {row_idx}, mapping: {col_mapping}")
                            break
                    
                    for row_idx in range(sheet.nrows):
                        if row_idx <= header_row_idx:
                            continue
                        row = sheet.row(row_idx)
                        row_vals = [cell.value if cell.value is not None else "" for cell in row]
                        if not any(val != "" for val in row_vals):
                            continue
                        
                        # Search for 8-digit tax code in any cell
                        tax_code = None
                        tax_code_idx = -1
                        for idx, val in enumerate(row_vals):
                            if val is not None and re.match(r"^\b\d{8}\b$", str(val).strip()):
                                tax_code = str(val).strip()
                                tax_code_idx = idx
                                break
                                
                        if tax_code:
                            # Find tax name
                            tax_name = ""
                            for val in row_vals[tax_code_idx + 1:]:
                                if val and isinstance(val, str) and not val.strip().startswith("UA") and not re.match(r"^\b\d+\b$", val.strip()):
                                    tax_name = val.strip()
                                    break
                            if not tax_name and tax_code in CODE_MAPPING:
                                tax_name = CODE_MAPPING[tax_code]
                            elif not tax_name:
                                tax_name = f"Податок {tax_code}"
                            
                            # Extract values based on column mapping
                            overpaid = 0.0
                            debt = 0.0
                            penalty = 0.0
                            accrued = 0.0
                            paid = 0.0
                            payment_deadline = None
                            
                            if col_mapping:
                                if 'overpaid' in col_mapping and col_mapping['overpaid'] < len(row_vals):
                                    overpaid = parse_amount(row_vals[col_mapping['overpaid']])
                                if 'debt' in col_mapping and col_mapping['debt'] < len(row_vals):
                                    debt = parse_amount(row_vals[col_mapping['debt']])
                                if 'penalty' in col_mapping and col_mapping['penalty'] < len(row_vals):
                                    penalty = parse_amount(row_vals[col_mapping['penalty']])
                                if 'accrued' in col_mapping and col_mapping['accrued'] < len(row_vals):
                                    accrued = parse_amount(row_vals[col_mapping['accrued']])
                                if 'paid' in col_mapping and col_mapping['paid'] < len(row_vals):
                                    paid = parse_amount(row_vals[col_mapping['paid']])
                                if 'deadline' in col_mapping and col_mapping['deadline'] < len(row_vals):
                                    payment_deadline = parse_date(row_vals[col_mapping['deadline']])
                            else:
                                # Fallback: find numbers in the row
                                nums = []
                                for val in row_vals:
                                    if val is not None and val != tax_code and not str(val).startswith("UA"):
                                        num_val = parse_amount(val)
                                        if num_val != 0.0 or str(val).strip() in ("0", "0,00", "0.00"):
                                            nums.append(num_val)
                                
                                if len(nums) >= 3:
                                    if len(nums) >= 5:
                                        accrued = nums[0]
                                        paid = nums[1]
                                        overpaid = nums[2]
                                        debt = nums[3]
                                        penalty = nums[4]
                                    else:
                                        overpaid = nums[0]
                                        debt = nums[1]
                                        penalty = nums[2]
                                elif len(nums) == 2:
                                    overpaid = nums[0]
                                    debt = nums[1]
                                elif len(nums) == 1:
                                    overpaid = nums[0]
                                
                            results.append({
                                "tax_code": tax_code,
                                "tax_name": tax_name,
                                "overpaid": overpaid,
                                "debt": debt,
                                "penalty": penalty,
                                "accrued": accrued,
                                "paid": paid,
                                "payment_deadline": payment_deadline
                            })
                return results
            except Exception as xlrd_error:
                print(f"[DPSParser] xlrd failed, trying openpyxl: {xlrd_error}")
                # Fallback to openpyxl for .xlsx files
                wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
                results = []
                for sheet in wb.worksheets:
                    # Find header row to map columns
                    header_row_idx = -1
                    col_mapping = {}
                    rows = list(sheet.iter_rows(values_only=True))
                    
                    for r_idx in range(min(10, len(rows))):
                        row = rows[r_idx]
                        if not row:
                            continue
                        row_vals = [str(cell).lower().strip() for cell in row if cell is not None]
                        if any('надмір' in v or 'борг' in v or 'пеня' in v or 'нарахован' in v or 'сплачен' in v or 'термін' in v or 'дата' in v for v in row_vals):
                            header_row_idx = r_idx
                            for col_idx, cell in enumerate(row):
                                if cell is None:
                                    continue
                                val = str(cell).lower().strip()
                                if 'надмір' in val or 'перепла' in val:
                                    col_mapping['overpaid'] = col_idx
                                elif 'борг' in val:
                                    col_mapping['debt'] = col_idx
                                elif 'пеня' in val:
                                    col_mapping['penalty'] = col_idx
                                elif 'нарахован' in val:
                                    col_mapping['accrued'] = col_idx
                                elif 'сплачен' in val:
                                    col_mapping['paid'] = col_idx
                                elif 'термін' in val or 'дата' in val:
                                    col_mapping['deadline'] = col_idx
                            print(f"[DPSParser] openpyxl found header row {r_idx}, mapping: {col_mapping}")
                            break
                            
                    for r_idx in range(len(rows)):
                        if r_idx <= header_row_idx:
                            continue
                        row = rows[r_idx]
                        if not row:
                            continue
                        row_vals = [r if r is not None else "" for r in row]
                        if not any(val != "" for val in row_vals):
                            continue
                        
                        # Search for 8-digit tax code in any cell
                        tax_code = None
                        tax_code_idx = -1
                        for idx, val in enumerate(row):
                            if val is not None and re.match(r"^\b\d{8}\b$", str(val).strip()):
                                tax_code = str(val).strip()
                                tax_code_idx = idx
                                break
                                
                        if tax_code:
                            # Find tax name
                            tax_name = ""
                            for val in row[tax_code_idx + 1:]:
                                if val and isinstance(val, str) and not val.strip().startswith("UA") and not re.match(r"^\b\d+\b$", val.strip()):
                                    tax_name = val.strip()
                                    break
                            if not tax_name and tax_code in CODE_MAPPING:
                                tax_name = CODE_MAPPING[tax_code]
                            elif not tax_name:
                                tax_name = f"Податок {tax_code}"
                                
                            overpaid = 0.0
                            debt = 0.0
                            penalty = 0.0
                            accrued = 0.0
                            paid = 0.0
                            payment_deadline = None
                            
                            if col_mapping:
                                if 'overpaid' in col_mapping and col_mapping['overpaid'] < len(row):
                                    overpaid = parse_amount(row[col_mapping['overpaid']])
                                if 'debt' in col_mapping and col_mapping['debt'] < len(row):
                                    debt = parse_amount(row[col_mapping['debt']])
                                if 'penalty' in col_mapping and col_mapping['penalty'] < len(row):
                                    penalty = parse_amount(row[col_mapping['penalty']])
                                if 'accrued' in col_mapping and col_mapping['accrued'] < len(row):
                                    accrued = parse_amount(row[col_mapping['accrued']])
                                if 'paid' in col_mapping and col_mapping['paid'] < len(row):
                                    paid = parse_amount(row[col_mapping['paid']])
                                if 'deadline' in col_mapping and col_mapping['deadline'] < len(row):
                                    payment_deadline = parse_date(row[col_mapping['deadline']])
                            else:
                                # Fallback: find numbers in the row
                                nums = []
                                for val in row:
                                    if val is not None and val != tax_code and not str(val).startswith("UA"):
                                        num_val = parse_amount(val)
                                        if num_val != 0.0 or str(val).strip() in ("0", "0,00", "0.00"):
                                            nums.append(num_val)
                                            
                                if len(nums) >= 3:
                                    if len(nums) >= 5:
                                        accrued = nums[0]
                                        paid = nums[1]
                                        overpaid = nums[2]
                                        debt = nums[3]
                                        penalty = nums[4]
                                    else:
                                        overpaid = nums[0]
                                        debt = nums[1]
                                        penalty = nums[2]
                                elif len(nums) == 2:
                                    overpaid = nums[0]
                                    debt = nums[1]
                                elif len(nums) == 1:
                                    overpaid = nums[0]
                                
                            results.append({
                                "tax_code": tax_code,
                                "tax_name": tax_name,
                                "overpaid": overpaid,
                                "debt": debt,
                                "penalty": penalty,
                                "accrued": accrued,
                                "paid": paid,
                                "payment_deadline": payment_deadline
                            })
                return results
        except Exception as e:
            print(f"[DPSParser] Excel parse error: {e}")
            return []

    async def _parse_pdf(self, file_content: bytes) -> list:
        """Розпізнає PDF виписку за допомогою pypdf"""
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_content))
            text = ""
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
            return await self._parse_text(text.encode('utf-8'))
        except Exception as e:
            print(f"[DPSParser] PDF parse error: {e}")
            return []

    async def _parse_text(self, content: bytes) -> list:
        """Розпізнає текст, скопійований з Електронного кабінету"""
        text = content.decode('utf-8', errors='ignore')
        lines = text.split("\n")
        results = []
        
        for line in lines:
            line_clean = line.strip()
            if not line_clean:
                continue
                
            # Search for 8-digit code
            match_code = re.search(r"\b\d{8}\b", line_clean)
            if not match_code:
                # If no code but matches general text patterns, try regex
                # e.g., "ВIЙСЬКОВИЙ ЗБIР... 0,00 7 557,61 0,00"
                # We can match words at start and then numbers
                m = re.match(r'^([A-Za-zА-Яа-яІіЇїЄєҐґ\'\"\s.,\-()]+?)\s+([\d\s,.-]+)\s+([\d\s,.-]+)\s+([\d\s,.-]+)$', line_clean)
                if m:
                    tax_name = m.group(1).strip()
                    overpaid = parse_amount(m.group(2))
                    debt = parse_amount(m.group(3))
                    penalty = parse_amount(m.group(4))
                    
                    results.append({
                        "tax_code": None,
                        "tax_name": tax_name,
                        "overpaid": overpaid,
                        "debt": debt,
                        "penalty": penalty,
                        "accrued": 0.0,
                        "paid": 0.0
                    })
                continue
                
            tax_code = match_code.group(0)
            
            # Find the position of tax code in the line
            code_start, code_end = match_code.span()
            
            # The part after the tax code contains UA-territory-code, tax name, and values
            rest = line_clean[code_end:].strip()
            
            # Remove territory code e.g. UA12000000000090473
            rest_clean = re.sub(r"UA\d{10,20}", "", rest, flags=re.IGNORECASE).strip()
            
            # Find all numbers like "0,00" or "7 557,61" or "-100.00" at the end of the text
            # A number in this context has digits, optionally spaces, a comma or dot, and decimals
            num_pattern = r'(-?\d+(?:\s+\d+)*(?:[.,]\d+)?)'
            numbers = re.findall(num_pattern, rest_clean)
            
            # Tax name is whatever text is left before the first number
            tax_name_part = rest_clean
            first_num_match = re.search(num_pattern, rest_clean)
            if first_num_match:
                tax_name_part = rest_clean[:first_num_match.start()].strip()
            
            # Clean tax name
            tax_name = re.sub(r'\s+', ' ', tax_name_part).strip()
            if not tax_name and tax_code in CODE_MAPPING:
                tax_name = CODE_MAPPING[tax_code]
            elif not tax_name:
                tax_name = f"Податок {tax_code}"
                
            # Parse numbers
            float_numbers = [parse_amount(n) for n in numbers]
            
            overpaid = 0.0
            debt = 0.0
            penalty = 0.0
            accrued = 0.0
            paid = 0.0
            
            if len(float_numbers) >= 3:
                if len(float_numbers) >= 5:
                    accrued = float_numbers[0]
                    paid = float_numbers[1]
                    overpaid = float_numbers[2]
                    debt = float_numbers[3]
                    penalty = float_numbers[4]
                else:
                    overpaid = float_numbers[0]
                    debt = float_numbers[1]
                    penalty = float_numbers[2]
            elif len(float_numbers) == 2:
                overpaid = float_numbers[0]
                debt = float_numbers[1]
            elif len(float_numbers) == 1:
                overpaid = float_numbers[0]
                
            results.append({
                "tax_code": tax_code,
                "tax_name": tax_name,
                "overpaid": overpaid,
                "debt": debt,
                "penalty": penalty,
                "accrued": accrued,
                "paid": paid
            })
            
        return results
