# backend/services/monobank_service.py

import os
import requests
import base64
from typing import Optional
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import HTTPException

class MonobankService:
    BASE_URL = "https://api.monobank.ua/api/merchant"
    
    def __init__(self):
        self.token = os.getenv("MONO_API_TOKEN", "mw_SVDrEb6rVLX6ax79tQcA")
        self._cached_public_keys: dict[str, ec.EllipticCurvePublicKey] = {}

    def _resolve_token(self, token: Optional[str] = None) -> str:
        resolved = (token or self.token or "").strip()
        if not resolved:
            raise HTTPException(status_code=400, detail="Monobank token is not configured")
        return resolved

    def create_invoice(self, amount_uah: float, reference: str, redirect_url: str, webhook_url: str, token: Optional[str] = None) -> str:
        """
        Створення рахунку в Монобанку.
        amount_uah: сума в гривнях (автоматично переводиться в копійки)
        """
        mono_token = self._resolve_token(token)
        url = f"{self.BASE_URL}/invoice/create"
        headers = {"X-Token": mono_token}
        
        payload = {
            "amount": int(amount_uah * 100), # Моно приймає ТІЛЬКИ цілі числа в копійках
            "ccy": 980,                      # Код гривні
            "redirectUrl": redirect_url,
            "webHookUrl": webhook_url,
            "reference": reference,
            "saveCard": True                 # Активуємо токенізацію для майбутніх автосписань підписок
        }
        
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Mono API Error: {response.text}")
            
        return response.json()["pageUrl"]

    def _get_public_key(self, token: Optional[str] = None, force_refresh: bool = False) -> ec.EllipticCurvePublicKey:
        """Отримання та декодування публічного ключа Монобанку з кешуванням"""
        mono_token = self._resolve_token(token)
        if mono_token in self._cached_public_keys and not force_refresh:
            return self._cached_public_keys[mono_token]
            
        url = f"{self.BASE_URL}/pubkey"
        headers = {"X-Token": mono_token}
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Не вдалося отримати публічний ключ Монобанку")
            
        key_data = response.json()
        # Монобанк повертає ключ у форматі випуску, декодуємо з Base64
        der_key = base64.b64decode(key_data["key"])
        
        public_key = load_pem_public_key(der_key)
        self._cached_public_keys[mono_token] = public_key
        return public_key

    def verify_signature(self, x_sign_base64: str, request_body: bytes, token: Optional[str] = None) -> bool:
        """
        Верифікація ECDSA підпису від Монобанку.
        x_sign_base64: значення з заголовка 'x-sign'
        request_body: сирі байти тіла запиту (raw body)
        """
        if not x_sign_base64:
            return False
            
        try:
            signature = base64.b64decode(x_sign_base64)
            public_key = self._get_public_key(token=token)
            
            # Перевірка підпису алгоритмом ECDSA з SHA256
            public_key.verify(
                signature,
                request_body,
                ec.ECDSA(hashes.SHA256())
            )
            return True
        except Exception:
            # Якщо верифікація не пройшла, пробуємо один раз оновити ключ 
            # (на випадок, якщо Монобанк планово змінив/ротував свій ключ)
            try:
                public_key = self._get_public_key(token=token, force_refresh=True)
                public_key.verify(signature, request_body, ec.ECDSA(hashes.SHA256()))
                return True
            except Exception:
                return False

monobank_service = MonobankService()
