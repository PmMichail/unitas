import os
import httpx
from typing import Optional

class DiiaSignatureService:
    def __init__(self):
        self.base_url = "https://api.diia.gov.ua/api/v1"
        self.client_id = os.getenv("DIIA_CLIENT_ID")
        self.client_secret = os.getenv("DIIA_CLIENT_SECRET")
        self.is_sandbox = not (self.client_id and self.client_secret and self.client_id != "ваш_client_id")
        
    async def get_auth_url(self, state: str, redirect_uri: str = "https://unitas-backend.fly.dev/api/diia/callback") -> str:
        """Отримати URL для авторизації через Дія.Підпис"""
        if self.is_sandbox:
            # Для пісочниці використовуємо внутрішній симуляційний URL нашого бекенду
            # Ми замінимо його динамічно у клієнті або перенаправимо на сторінку симулятора
            return f"/api/diia/mock-sign?state={state}&redirect_uri={redirect_uri}"
        
        return f"https://diia.gov.ua/auth?client_id={self.client_id}&state={state}&response_type=code&redirect_uri={redirect_uri}"
    
    async def exchange_code(self, code: str) -> dict:
        """Обміняти код на токен доступу"""
        if self.is_sandbox:
            return {
                "access_token": f"mock_token_diia_{code}",
                "expires_in": 3600,
                "token_type": "Bearer"
            }
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/token",
                json={
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "authorization_code"
                },
                timeout=10
            )
            response.raise_for_status()
            return response.json()
    
    async def sign_document(self, doc_hash: str, token: str) -> str:
        """Підписати хеш документа через Дія.Підпис"""
        if self.is_sandbox or token.startswith("mock_token_diia_"):
            # Повертаємо тестовий підпис у форматі Base64
            import base64
            mock_sig = f"DIIA_SIGNATURE_FOR_HASH_{doc_hash}_SIGNED_BY_DIIAPIDPYS"
            return base64.b64encode(mock_sig.encode()).decode()
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/documents/sign-hash",
                headers={"Authorization": f"Bearer {token}"},
                json={"hash": doc_hash},
                timeout=10
            )
            response.raise_for_status()
            # Повертає підпис у форматі base64
            data = response.json()
            return data.get("signature")
