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

bank_sync_service = BankSyncService()

# Start sync service on import (optional - can be started manually)
# asyncio.create_task(bank_sync_service.start_daily_sync())
