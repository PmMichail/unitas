import asyncio
import json
import os
import re
import uuid
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from api.main import BankConnection, ParsedPayment, SessionLocal, SyncLog, UnitOrMember, decrypt_token, BankStatement
from services.bank_oauth import bank_oauth_service


class BankSyncService:
    def __init__(self):
        self.is_running = False

    async def sync_all_banks(self):
        if self.is_running:
            print("Bank sync already running, skipping")
            return {"status": "skipped", "message": "Bank sync already running"}

        self.is_running = True
        db = SessionLocal()
        results = []
        try:
            connections = db.query(BankConnection).filter(
                BankConnection.is_active == True,
                BankConnection.status == "active",
                BankConnection.auto_sync_enabled == True,
                BankConnection.bank_name.in_(["monobank", "privat", "abank"])
            ).all()
            connection_ids = [conn.id for conn in connections]
        finally:
            db.close()

        try:
            for connection_id in connection_ids:
                try:
                    results.append(await self.sync_single_bank_by_id(connection_id))
                except Exception as e:
                    print(f"Error syncing bank connection {connection_id}: {e}")
                    results.append({"connection_id": connection_id, "status": "error", "error": str(e)})
            return {"status": "completed", "results": results}
        finally:
            self.is_running = False

    async def sync_single_bank_by_id(self, connection_id: int) -> Dict:
        db = SessionLocal()
        sync_batch_id = f"bank_sync_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
        try:
            conn = db.query(BankConnection).filter(BankConnection.id == connection_id).first()
            if not conn:
                raise ValueError("Bank connection not found")
            return await self.sync_single_bank(conn, db, sync_batch_id)
        finally:
            db.close()

    async def sync_single_bank(self, conn: BankConnection, db, sync_batch_id: Optional[str] = None) -> Dict:
        if conn.bank_name not in ["monobank", "privat", "abank"]:
            return {"connection_id": conn.id, "status": "skipped", "message": "Automatic sync is not supported for this bank"}

        sync_batch_id = sync_batch_id or f"bank_sync_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
        now = datetime.now()
        # Use 30 days for Monobank Merchant API, 7 days for others
        period_days = 30 if conn.bank_name == "monobank" else max(7, int(conn.sync_period_days or 1))
        from_date = now - timedelta(days=period_days)
        if conn.last_sync_date:
            from_date = min(from_date, conn.last_sync_date)

        try:
            token_payload = self._get_decrypted_bank_payload(conn)
            # For PrivatBank, use account_number instead of account_id
            # For Monobank, use account_number as terminal code for Merchant API
            if conn.bank_name in ["privat", "abank"]:
                account_to_use = conn.account_number
            elif conn.bank_name == "monobank":
                account_to_use = conn.account_number or conn.account_id
            else:
                account_to_use = conn.account_id
            transactions = await bank_oauth_service.get_bank_transactions(
                conn.bank_name,
                token_payload,
                account_to_use,
                from_date=from_date,
                to_date=now
            )

            new_payments = []
            statement = None
            for tx in transactions:
                external_id = str(tx.get("id") or "").strip()
                if not external_id:
                    continue
                existing = db.query(ParsedPayment).filter(
                    ParsedPayment.external_id == external_id,
                    ParsedPayment.bank_name == conn.bank_name,
                    ParsedPayment.profile_id == conn.profile_id
                ).first()
                if existing:
                    continue

                if statement is None:
                    bank_display = {"privat": "ПриватБанк", "monobank": "Monobank", "abank": "А-Банк"}.get(conn.bank_name, conn.bank_name)
                    stmt_file_name = f"Синхронізація {bank_display} ({now.strftime('%d.%m.%Y %H:%M')})"
                    statement = BankStatement(
                        company_id=conn.profile_id,
                        profile_id=conn.profile_id,
                        file_name=stmt_file_name,
                        file_hash=sync_batch_id,
                        bank_name=bank_display,
                        uploaded_at=now.date(),
                        status="parsed"
                    )
                    db.add(statement)
                    db.flush()

                amount = float(tx.get("amount") or 0)
                tx_date = self._parse_transaction_date(tx.get("date"))
                
                # Determine transaction types and tax types
                direction_val = "in" if amount >= 0 else "out"
                tx_type = "income" if amount >= 0 else "expense"
                transaction_type = "income" if amount >= 0 else "expense"
                tax_type = None
                
                if amount < 0:
                    purpose_lower = (tx.get("purpose") or "").lower()
                    import re
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

                payment = ParsedPayment(
                    profile_id=conn.profile_id,
                    statement_id=statement.id,
                    bank_connection_id=conn.id,
                    date=tx_date,
                    amount=abs(amount),
                    direction=direction_val,
                    purpose=tx.get("purpose") or "",
                    contragent=tx.get("counterparty") or "",
                    balance_after=tx.get("balance_after"),
                    type=tx_type,
                    transaction_type=transaction_type,
                    tax_type=tax_type,
                    external_id=external_id,
                    bank_name=conn.bank_name,
                    match_status="pending",
                    is_auto_synced=True,
                    sync_batch_id=sync_batch_id,
                    raw_data=json.dumps(tx.get("raw") or tx, ensure_ascii=False, default=str),
                    taxable=True if amount >= 0 else False
                )
                db.add(payment)
                db.flush()
                new_payments.append(payment)

            matched_count = self.auto_match_transactions(conn.profile_id, new_payments, db)
            conn.last_sync = now
            conn.last_sync_date = now
            conn.last_sync_status = "success"
            conn.last_sync_message = f"Завантажено {len(new_payments)} нових транзакцій. Зіставлено {matched_count}."
            db.add(SyncLog(
                bank_connection_id=conn.id,
                profile_id=conn.profile_id,
                sync_date=now,
                status="success",
                transactions_count=len(new_payments),
                matched_count=matched_count,
                sync_batch_id=sync_batch_id
            ))
            db.commit()
            self.notify_accountant(conn.profile_id, conn.bank_name, len(new_payments), matched_count, db)
            return {
                "connection_id": conn.id,
                "bank_name": conn.bank_name,
                "status": "success",
                "transactions_count": len(new_payments),
                "matched_count": matched_count,
                "sync_batch_id": sync_batch_id
            }
        except Exception as e:
            db.rollback()
            conn = db.query(BankConnection).filter(BankConnection.id == conn.id).first()
            if conn:
                conn.last_sync_date = now
                conn.last_sync_status = "error"
                conn.last_sync_message = str(e)
                db.add(SyncLog(
                    bank_connection_id=conn.id,
                    profile_id=conn.profile_id,
                    sync_date=now,
                    status="error",
                    transactions_count=0,
                    matched_count=0,
                    error_message=str(e),
                    sync_batch_id=sync_batch_id
                ))
                db.commit()
            raise e

    async def start_daily_sync(self):
        while True:
            now = datetime.now()
            next_sync = now.replace(hour=6, minute=0, second=0, microsecond=0)
            if now >= next_sync:
                next_sync = next_sync + timedelta(days=1)
            seconds_until_sync = (next_sync - now).total_seconds()
            print(f"Next bank sync scheduled for {next_sync} (in {seconds_until_sync} seconds)")
            await asyncio.sleep(seconds_until_sync)
            await self.sync_all_banks()

    def _get_decrypted_bank_payload(self, conn: BankConnection) -> str:
        auth_data = {}
        if conn.auth_data:
            try:
                auth_data = json.loads(decrypt_token(conn.auth_data))
            except Exception:
                auth_data = {}
        if conn.bank_name == "privat" and auth_data:
            return json.dumps(auth_data, ensure_ascii=False)
        token = ""
        if auth_data:
            token = auth_data.get("token") or auth_data.get("access_token") or auth_data.get("password") or ""
        if not token and conn.access_token:
            token = decrypt_token(conn.access_token)
        if conn.bank_name == "privat" and token:
            payload = dict(auth_data)
            payload["token"] = token
            return json.dumps(payload, ensure_ascii=False)
        return token

    def _parse_transaction_date(self, value) -> date:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        text_value = str(value or "").strip()
        for fmt in ["%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(text_value.split("T")[0].split(" ")[0], fmt).date()
            except Exception:
                pass
        try:
            return datetime.fromisoformat(text_value).date()
        except Exception:
            return date.today()

    def auto_match_transactions(self, profile_id: int, transactions: List[ParsedPayment], db) -> int:
        matched_count = 0
        members = db.query(UnitOrMember).filter(UnitOrMember.profile_id == profile_id).all()
        for tx in transactions:
            if tx.direction != "in":
                continue
            text = f"{tx.purpose or ''} {tx.contragent or ''}".lower()
            member = self.match_by_flat_number(members, text)
            rule = "by_flat" if member else None
            if not member:
                member = self.match_by_name(members, text)
                rule = "by_name" if member else None
            if member:
                tx.member_id = member.id
                tx.match_status = "matched"
                tx.matched_rule = rule
                member.balance = float(member.balance or 0) - float(tx.amount or 0)
                matched_count += 1
            else:
                tx.match_status = "pending"
        return matched_count

    def match_by_flat_number(self, members: List[UnitOrMember], text: str):
        for member in members:
            identifier = str(member.identifier or "").strip().lower()
            if not identifier:
                continue
            escaped = re.escape(identifier)
            patterns = [
                rf"(?:кв\.?|квартира|№|n|номер)\s*{escaped}(?!\d)",
                rf"\b{escaped}\b"
            ]
            if any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns):
                return member
        return None

    def match_by_name(self, members: List[UnitOrMember], text: str):
        normalized_text = re.sub(r"\s+", " ", text.lower()).strip()
        for member in members:
            owner_name = re.sub(r"\s+", " ", str(member.owner_name or "").lower()).strip()
            if owner_name and owner_name in normalized_text:
                return member
        return None

    def notify_accountant(self, profile_id: int, bank_name: str, transactions_count: int, matched_count: int, db):
        if transactions_count <= 0:
            return
        unmatched_count = transactions_count - matched_count
        print(
            f"[BANK SYNC NOTIFY] profile_id={profile_id} bank={bank_name}: "
            f"Завантажено {transactions_count}, зіставлено {matched_count}, не зіставлено {unmatched_count}"
        )
    
    async def import_statement_from_file(self, profile_id: int, file_content: str, bank_name: str) -> Dict:
        db = SessionLocal()
        try:
            transactions = self._parse_statement_file(file_content, bank_name)
            
            imported_count = 0
            for tx in transactions:
                existing = db.query(ParsedPayment).filter(
                    ParsedPayment.external_id == tx.get('id', ''),
                    ParsedPayment.profile_id == profile_id
                ).first()
                
                if not existing:
                    parsed_payment = ParsedPayment(
                        profile_id=profile_id,
                        date=datetime.fromisoformat(tx['date']).date() if isinstance(tx['date'], str) else tx['date'],
                        amount=abs(tx['amount']),
                        purpose=tx.get('purpose', ''),
                        type='income' if tx['amount'] > 0 else 'expense',
                        external_id=tx.get('id', f"manual_{datetime.now().timestamp()}"),
                        bank_name=bank_name
                    )
                    db.add(parsed_payment)
                    imported_count += 1
            
            db.commit()
            
            return {
                "success": True,
                "imported_count": imported_count,
                "total_count": len(transactions),
                "bank_name": bank_name
            }
        
        except Exception as e:
            db.rollback()
            return {
                "success": False,
                "error": str(e),
                "imported_count": 0
            }
        finally:
            db.close()
    
    def _parse_statement_file(self, file_content: str, bank_name: str) -> List[Dict]:
        """Парсинг файлу виписки залежно від банку"""
        transactions = []
        
        if "csv" in file_content.lower():
            lines = file_content.split('\n')
            for line in lines[1:]:
                parts = line.split(',')
                if len(parts) >= 3:
                    try:
                        transactions.append({
                            "date": parts[0],
                            "amount": float(parts[1]),
                            "purpose": parts[2] if len(parts) > 2 else "",
                            "id": f"{bank_name}_{len(transactions)}"
                        })
                    except ValueError:
                        continue
        
        return transactions
    
    def reconcile_tax_payments(self, profile_id: int) -> Dict:
        db = SessionLocal()
        try:
            transactions = db.query(ParsedPayment).filter(
                ParsedPayment.profile_id == profile_id
            ).all()
            
            tax_keywords = ["податок", "єдиний", "військовий", "пдфо", "єсв", "дпс"]
            tax_payments = []
            unmatched_payments = []
            
            for tx in transactions:
                purpose_lower = tx.purpose.lower()
                is_tax_payment = any(keyword in purpose_lower for keyword in tax_keywords)
                
                if is_tax_payment:
                    tax_payments.append({
                        "id": tx.id,
                        "date": tx.date.isoformat() if tx.date else None,
                        "amount": tx.amount,
                        "purpose": tx.purpose,
                        "type": tx.type,
                        "matched": False
                    })
                else:
                    unmatched_payments.append({
                        "id": tx.id,
                        "date": tx.date.isoformat() if tx.date else None,
                        "amount": tx.amount,
                        "purpose": tx.purpose,
                        "type": tx.type
                    })
            
            total_tax_paid = sum(tx["amount"] for tx in tax_payments if tx["type"] == "expense")
            
            return {
                "success": True,
                "tax_payments": tax_payments,
                "unmatched_payments": unmatched_payments,
                "total_tax_paid": total_tax_paid,
                "tax_payment_count": len(tax_payments),
                "unmatched_count": len(unmatched_payments)
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            db.close()

bank_sync_service = BankSyncService()

# Start sync service on import (optional - can be started manually)
# asyncio.create_task(bank_sync_service.start_daily_sync())
