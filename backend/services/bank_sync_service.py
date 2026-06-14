import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from api.main import BankConnection, db, ParsedPayment
from services.bank_oauth import bank_oauth_service

class BankSyncService:
    def __init__(self):
        self.is_running = False
    
    async def sync_all_banks(self):
        """Sync all active bank connections"""
        if self.is_running:
            print("Bank sync already running, skipping")
            return
        
        self.is_running = True
        try:
            connections = db.query(BankConnection).filter(
                BankConnection.is_active == True
            ).all()
            
            print(f"Starting bank sync for {len(connections)} connections")
            
            for conn in connections:
                try:
                    await self.sync_single_bank(conn)
                except Exception as e:
                    print(f"Error syncing {conn.bank_name} for profile {conn.profile_id}: {e}")
            
            print("Bank sync completed")
        
        finally:
            self.is_running = False
    
    async def sync_single_bank(self, conn: BankConnection):
        """Sync a single bank connection"""
        try:
            # Get transactions since last sync (or last 30 days if never synced)
            from_date = conn.last_sync if conn.last_sync else datetime.now() - timedelta(days=30)
            
            transactions = await bank_oauth_service.get_bank_transactions(
                conn.bank_name,
                conn.access_token,
                conn.account_id,
                from_date=from_date
            )
            
            # Save transactions
            synced_count = 0
            for tx in transactions:
                existing = db.query(ParsedPayment).filter(
                    ParsedPayment.external_id == tx['id'],
                    ParsedPayment.bank_name == conn.bank_name
                ).first()
                
                if not existing:
                    parsed_payment = ParsedPayment(
                        profile_id=conn.profile_id,
                        date=datetime.fromisoformat(tx['date']).date(),
                        amount=abs(tx['amount']),
                        purpose=tx.get('purpose', ''),
                        type='income' if tx['amount'] > 0 else 'expense',
                        external_id=tx['id'],
                        bank_name=conn.bank_name
                    )
                    db.add(parsed_payment)
                    synced_count += 1
            
            # Update last sync
            conn.last_sync = datetime.now()
            db.commit()
            
            print(f"Synced {synced_count} transactions for {conn.bank_name} (profile {conn.profile_id})")
        
        except Exception as e:
            db.rollback()
            raise e
    
    async def start_daily_sync(self):
        """Start daily sync at 9:00 AM"""
        while True:
            now = datetime.now()
            
            # Calculate time until next 9:00 AM
            next_sync = now.replace(hour=9, minute=0, second=0, microsecond=0)
            if now >= next_sync:
                next_sync = next_sync + timedelta(days=1)
            
            seconds_until_sync = (next_sync - now).total_seconds()
            print(f"Next bank sync scheduled for {next_sync} (in {seconds_until_sync} seconds)")
            
            await asyncio.sleep(seconds_until_sync)
            
            await self.sync_all_banks()
    
    async def import_statement_from_file(self, profile_id: int, file_content: str, bank_name: str) -> Dict:
        """Імпорт виписки з файлу (PDF/Excel) для українських банків"""
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
        """Зіставлення банківських транзакцій з податковими платежами"""
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

bank_sync_service = BankSyncService()

# Start sync service on import (optional - can be started manually)
# asyncio.create_task(bank_sync_service.start_daily_sync())
