import os
import httpx
from typing import Dict, List, Optional
from datetime import datetime, timedelta

BANKS = {
    "privat": {
        "name": "ПриватБанк",
        "auth_url": "https://auth.privatbank.ua/oauth2/authorize",
        "token_url": "https://auth.privatbank.ua/oauth2/token",
        "scope": "statements payments",
        "client_id": os.getenv("PRIVAT_CLIENT_ID"),
        "client_secret": os.getenv("PRIVAT_CLIENT_SECRET")
    },
    "monobank": {
        "name": "Monobank",
        "auth_url": "https://api.monobank.ua/oauth/authorize",
        "token_url": "https://api.monobank.ua/oauth/token",
        "scope": "personal",
        "client_id": os.getenv("MONOBANK_CLIENT_ID"),
        "client_secret": os.getenv("MONOBANK_CLIENT_SECRET")
    },
    "abank": {
        "name": "А-Банк",
        "auth_url": "https://api.abank.ua/oauth/authorize",
        "token_url": "https://api.abank.ua/oauth/token",
        "scope": "accounts statements",
        "client_id": os.getenv("ABANK_CLIENT_ID"),
        "client_secret": os.getenv("ABANK_CLIENT_SECRET")
    },
    "ukrgas": {
        "name": "УКРГАЗБАНК",
        "auth_url": "https://api.ukrgasbank.com/oauth/authorize",
        "token_url": "https://api.ukrgasbank.com/oauth/token",
        "scope": "statements",
        "client_id": os.getenv("UKRGAS_CLIENT_ID"),
        "client_secret": os.getenv("UKRGAS_CLIENT_SECRET")
    },
    "pumb": {
        "name": "ПУМБ",
        "auth_url": "https://api.pumb.ua/oauth/authorize",
        "token_url": "https://api.pumb.ua/oauth/token",
        "scope": "accounts statements",
        "client_id": os.getenv("PUMB_CLIENT_ID"),
        "client_secret": os.getenv("PUMB_CLIENT_SECRET")
    }
}

class BankOAuthService:
    def __init__(self):
        self.redirect_uri = os.getenv("BANK_REDIRECT_URI", "https://unitas-backend.fly.dev/api/banks/{bank_name}/callback")
    
    def get_auth_url(self, bank_name: str, state: str) -> str:
        """Generate OAuth authorization URL"""
        bank = BANKS.get(bank_name)
        if not bank:
            raise ValueError(f"Unknown bank: {bank_name}")
        
        return f"{bank['auth_url']}?client_id={bank['client_id']}&response_type=code&scope={bank['scope']}&state={state}&redirect_uri={self.redirect_uri.format(bank_name=bank_name)}"
    
    async def exchange_code_for_token(self, bank_name: str, code: str) -> Dict:
        """Exchange authorization code for access token"""
        bank = BANKS.get(bank_name)
        if not bank:
            raise ValueError(f"Unknown bank: {bank_name}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                bank['token_url'],
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": bank['client_id'],
                    "client_secret": bank['client_secret'],
                    "redirect_uri": self.redirect_uri.format(bank_name=bank_name)
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def refresh_token(self, bank_name: str, refresh_token: str) -> Dict:
        """Refresh access token using refresh token"""
        bank = BANKS.get(bank_name)
        if not bank:
            raise ValueError(f"Unknown bank: {bank_name}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                bank['token_url'],
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": bank['client_id'],
                    "client_secret": bank['client_secret']
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def get_bank_accounts(self, bank_name: str, access_token: str) -> List[Dict]:
        """Get user's bank accounts"""
        # This would be implemented based on each bank's API
        # For now, return a placeholder
        return [
            {
                "id": "acc_001",
                "number": "UA633077700000026008511244373",
                "currency": "UAH",
                "balance": 0.0
            }
        ]
    
    async def get_bank_transactions(
        self, 
        bank_name: str, 
        access_token: str, 
        account_id: str, 
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> List[Dict]:
        """Get bank transactions for a specific account"""
        if from_date is None:
            from_date = datetime.now() - timedelta(days=30)
        if to_date is None:
            to_date = datetime.now()
        
        # This would be implemented based on each bank's API
        # For now, return placeholder data
        return [
            {
                "id": f"tx_{i}",
                "date": (from_date + timedelta(days=i)).isoformat(),
                "amount": 1000.0,
                "purpose": "Payment for services",
                "type": "income"
            }
            for i in range(10)
        ]

bank_oauth_service = BankOAuthService()
