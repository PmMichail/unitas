# backend/services/statement_storage.py

import os
import re
import hashlib
from pathlib import Path
from datetime import datetime, date
from sqlalchemy.orm import Session
from backend.api.main import BankStatement, OriginalTransaction

class StatementStorage:
    def __init__(self, db: Session):
        self.db = db
        self.storage_path = Path(os.getenv("STATEMENTS_STORAGE_PATH", "./data/statements"))
        self.storage_path.mkdir(parents=True, exist_ok=True)
    
    async def save_original(self, profile_id: int, file_content: bytes, filename: str) -> dict:
        """Зберегти оригінальну виписку"""
        file_hash = hashlib.md5(file_content).hexdigest()
        
        existing = self.db.query(BankStatement).filter(BankStatement.file_hash == file_hash).first()
        if existing:
            return {"exists": True, "statement_id": existing.id}
        
        safe_filename = f"{profile_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        file_path = self.storage_path / safe_filename
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Create a statement record in DB
        statement = BankStatement(
            company_id=profile_id,
            profile_id=profile_id,
            file_name=filename,
            file_hash=file_hash,
            bank_name="Невідомий Банк",
            uploaded_at=date.today(),
            status="pending",
            original_file_path=str(file_path)
        )
        self.db.add(statement)
        self.db.commit()
        self.db.refresh(statement)
        
        return {"exists": False, "statement_id": statement.id, "file_path": str(file_path)}
    
    async def extract_raw_transactions(self, statement_id: int, file_path: str, bank_name: str) -> list:
        """Витягти всі транзакції з оригінальної виписки"""
        transactions = []
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == ".pdf":
            try:
                try:
                    import PyPDF2
                except ImportError:
                    import pypdf as PyPDF2
                    
                with open(file_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    idx = 0
                    for page_num, page in enumerate(reader.pages):
                        text = page.extract_text()
                        if not text:
                            continue
                        lines = text.split('\n')
                        for line in lines:
                            line = line.strip()
                            if self._is_transaction_line(line):
                                transactions.append({
                                    "index": idx,
                                    "raw_text": line,
                                    "date": self._extract_date_from_line(line),
                                    "amount": self._extract_amount_from_line(line),
                                    "purpose": line[:500]
                                })
                                idx += 1
            except Exception as e:
                print(f"[StatementStorage] PDF extraction error: {e}")
        else:
            # For non-PDF files, read line-by-line
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                    idx = 0
                    for line in lines:
                        line = line.strip()
                        if self._is_transaction_line(line):
                            transactions.append({
                                "index": idx,
                                "raw_text": line,
                                "date": self._extract_date_from_line(line),
                                "amount": self._extract_amount_from_line(line),
                                "purpose": line[:500]
                            })
                            idx += 1
            except Exception as e:
                print(f"[StatementStorage] Text extraction error: {e}")
        
        # Save to DB
        for tx in transactions:
            ot = OriginalTransaction(
                statement_id=statement_id,
                transaction_index=tx['index'],
                date=tx['date'],
                amount=tx['amount'],
                purpose=tx['purpose'],
                raw_text=tx['raw_text']
            )
            self.db.add(ot)
        self.db.commit()
        
        return transactions

    def _is_transaction_line(self, line: str) -> bool:
        # Check if line contains a date like 12.03.2025 or 12/03/2025
        return bool(re.search(r"\b\d{2}[\./]\d{2}[\./]\d{4}\b", line))
    
    def _extract_date_from_line(self, line: str) -> date:
        match = re.search(r"\b(\d{2})[\./](\d{2})[\./](\d{4})\b", line)
        if match:
            day, month, year = match.groups()
            try:
                return date(int(year), int(month), int(day))
            except ValueError:
                pass
        return date.today()
        
    def _extract_amount_from_line(self, line: str) -> float:
        # Remove date and time to prevent misinterpretation
        clean_line = re.sub(r"\b\d{2}[\./]\d{2}[\./]\d{4}\b", "", line)
        clean_line = re.sub(r"\b\d{2}:\d{2}(?::\d{2})?\b", "", clean_line)
        
        amounts = re.findall(r"(-?\d+(?:\s*\d*)*[\.,]\d{2})", clean_line)
        if amounts:
            amt_str = amounts[0].replace(" ", "").replace(",", ".")
            try:
                return float(amt_str)
            except ValueError:
                pass
        return 0.0
