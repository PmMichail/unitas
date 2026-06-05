# backend/services/validation_service.py

from datetime import datetime
from sqlalchemy.orm import Session
from backend.api.main import BankStatement, OriginalTransaction, ParsedPayment, ValidationError

class ValidationService:
    def __init__(self, db: Session):
        self.db = db
        
    async def validate_statement(self, statement_id: int, parsed_transactions: list) -> list:
        """Порівняти розпізнані транзакції з оригіналом"""
        original_txs = self.db.query(OriginalTransaction).filter(
            OriginalTransaction.statement_id == statement_id
        ).order_by(OriginalTransaction.transaction_index).all()
        
        errors = []
        
        # 1. Перевірка кількості
        if len(original_txs) != len(parsed_transactions):
            self.db.add(ValidationError(
                statement_id=statement_id,
                error_type="count_mismatch",
                original_value=str(len(original_txs)),
                parsed_value=str(len(parsed_transactions)),
                is_resolved=False
            ))
            errors.append({"type": "count_mismatch"})
            
        # 2. Порівняння кожної транзакції по індексу
        # Оскільки обидва списки впорядковані, порівнюємо їх по черзі
        for i, original in enumerate(original_txs):
            if i >= len(parsed_transactions):
                # Ця транзакція є в оригіналі, але відсутня в розпізнаних
                self.db.add(ValidationError(
                    statement_id=statement_id,
                    original_transaction_id=original.id,
                    error_type="missing_in_parsed",
                    original_value=f"Сума: {original.amount}, Призначення: {original.purpose}",
                    parsed_value="Відсутня",
                    is_resolved=False
                ))
                errors.append({"type": "missing_in_parsed", "index": i})
                continue
                
            parsed = parsed_transactions[i]
            
            # Перевірка суми
            # Зверніть увагу: parsed.amount завжди позитивний, тому порівнюємо з abs(original.amount)
            # або приводимо до позитивного значення
            orig_amt = abs(float(original.amount))
            parsed_amt = abs(float(parsed.amount))
            
            if abs(orig_amt - parsed_amt) > 0.01:
                self.db.add(ValidationError(
                    statement_id=statement_id,
                    original_transaction_id=original.id,
                    parsed_transaction_id=parsed.id,
                    error_type="amount_mismatch",
                    original_value=str(orig_amt),
                    parsed_value=str(parsed_amt),
                    is_resolved=False
                ))
                errors.append({"type": "amount_mismatch", "index": i})
                
            # Перевірка дати
            orig_date_str = original.date.strftime("%Y-%m-%d")
            parsed_date_str = parsed.date.strftime("%Y-%m-%d")
            if orig_date_str != parsed_date_str:
                self.db.add(ValidationError(
                    statement_id=statement_id,
                    original_transaction_id=original.id,
                    parsed_transaction_id=parsed.id,
                    error_type="date_mismatch",
                    original_value=orig_date_str,
                    parsed_value=parsed_date_str,
                    is_resolved=False
                ))
                errors.append({"type": "date_mismatch", "index": i})
                
        self.db.commit()
        
        # Оновити статус виписки
        status = "has_errors" if errors else "validated"
        statement = self.db.query(BankStatement).filter(BankStatement.id == statement_id).first()
        if statement:
            statement.validation_status = status
            self.db.commit()
            
        return errors
        
    async def resolve_error(self, error_id: int, correct_value: str, resolved_by: int) -> dict:
        """Виправити помилку вручную"""
        error = self.db.query(ValidationError).filter(ValidationError.id == error_id).first()
        if not error:
            return {"error": "Помилку не знайдено"}
            
        if error.error_type == 'amount_mismatch' and error.parsed_transaction_id:
            parsed_pay = self.db.query(ParsedPayment).filter(ParsedPayment.id == error.parsed_transaction_id).first()
            if parsed_pay:
                parsed_pay.amount = float(correct_value)
                
        elif error.error_type == 'date_mismatch' and error.parsed_transaction_id:
            parsed_pay = self.db.query(ParsedPayment).filter(ParsedPayment.id == error.parsed_transaction_id).first()
            if parsed_pay:
                parsed_pay.date = datetime.strptime(correct_value, "%Y-%m-%d").date()
                
        error.is_resolved = True
        error.resolved_by_user_id = resolved_by
        error.resolved_at = datetime.utcnow()
        self.db.commit()
        
        # Перевірити, чи залишилися невирішені помилки у цій виписці
        statement_id = error.statement_id
        unresolved_count = self.db.query(ValidationError).filter(
            ValidationError.statement_id == statement_id,
            ValidationError.is_resolved == False
        ).count()
        
        if unresolved_count == 0:
            statement = self.db.query(BankStatement).filter(BankStatement.id == statement_id).first()
            if statement:
                statement.validation_status = "validated"
                self.db.commit()
                
        return {"message": "Помилку успішно виправлено"}
