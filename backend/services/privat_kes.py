import os
import httpx
import base64
from typing import Optional

class PrivatKESService:
    """
    Інтеграція з АЦСК ПриватБанку
    Документація: https://api.privatbank.ua/kes
    """
    def __init__(self):
        self.base_url = "https://api.privatbank.ua/kes"
        self.api_key = os.getenv("PRIVAT_KES_API_KEY")
        self.is_sandbox = not self.api_key
        
    async def get_certificate_status(self, serial: str) -> dict:
        """Перевірити статус сертифіката (чинний/скасований)"""
        if self.is_sandbox:
            return {
                "status": "active",
                "serial": serial,
                "owner": "Тестовий Власник КЕП",
                "issuer": "АЦСК АТ КБ 'ПРИВАТБАНК'",
                "valid": True
            }
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/certificate/{serial}/status",
                    headers={"X-API-KEY": self.api_key},
                    timeout=5
                )
                if response.status_code == 200:
                    return response.json()
            except Exception:
                pass
            return {"status": "unknown", "valid": False}
            
    async def sign_hash(self, hash_data: str, cert_serial: str) -> str:
        """Підписати хеш документа через API ПриватБанку"""
        if self.is_sandbox:
            mock_sig = f"PRIVAT_KES_SIGNATURE_FOR_HASH_{hash_data}_SIGNED_BY_SERIAL_{cert_serial}"
            return base64.b64encode(mock_sig.encode()).decode()
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/sign-hash",
                headers={"X-API-KEY": self.api_key},
                json={
                    "hash": hash_data,
                    "serial": cert_serial
                },
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            return data.get("signature")
