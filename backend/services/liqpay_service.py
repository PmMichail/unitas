# backend/services/liqpay_service.py

import os
import hashlib
import base64
import json
from datetime import datetime
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

class LiqPayService:
    """
    Сервіс для інтеграції з LiqPay
    Документація: https://www.liqpay.ua/ru/doc
    """
    
    def __init__(self):
        self.public_key = os.getenv("LIQPAY_PUBLIC_KEY", "")
        self.private_key = os.getenv("LIQPAY_PRIVATE_KEY", "")
        self.api_url = "https://www.liqpay.ua/api/3/checkout"
        
    def _sign(self, data: Dict) -> str:
        """Підписання даних приватним ключем"""
        encoded_data = base64.b64encode(json.dumps(data).encode('utf-8')).decode('utf-8')
        sign_str = self.private_key + encoded_data + self.private_key
        return hashlib.sha1(sign_str.encode('utf-8')).hexdigest()
    
    def _cnb_form(self, data: Dict) -> Dict:
        """Створення форми для CNB (Checkout Native Button)"""
        data["public_key"] = self.public_key
        data["version"] = "3"
        signature = self._sign(data)
        
        return {
            "data": base64.b64encode(json.dumps(data).encode('utf-8')).decode('utf-8'),
            "signature": signature,
            "api_url": self.api_url
        }
    
    def create_tax_payment(
        self, 
        profile_id: int, 
        tax_type: str, 
        amount: float, 
        period: str,
        description: Optional[str] = None
    ) -> Dict:
        """
        Створити платіж для сплати податку
        
        Args:
            profile_id: ID профілю
            tax_type: Тип податку ('edp', 'esv', 'pdfo', 'vz')
            amount: Сума в гривнях
            period: Період (наприклад, '2025-06')
            description: Опис платежу
            
        Returns:
            Dict з data та signature для CNB форми
        """
        if not description:
            tax_names = {
                "edp": "Єдиний податок",
                "esv": "ЄСВ",
                "pdfo": "ПДФО",
                "vz": "Військовий збір"
            }
            description = f"Сплата {tax_names.get(tax_type, tax_type)} за {period}"
        
        order_id = f"tax_{profile_id}_{tax_type}_{period}_{int(datetime.now().timestamp())}"
        
        data = {
            "action": "pay",
            "amount": str(amount),
            "currency": "UAH",
            "description": description,
            "order_id": order_id,
            "server_url": f"{os.getenv('API_BASE_URL', 'https://unitas-backend.fly.dev')}/api/liqpay/callback",
            "result_url": f"{os.getenv('FRONTEND_URL', 'https://unitas-frontend.fly.dev')}/payment-success",
            "language": "uk"
        }
        
        return self._cnb_form(data)
    
    def create_subscription_payment(
        self, 
        profile_id: int, 
        plan: str, 
        period: str = "month",
        amount: Optional[float] = None
    ) -> Dict:
        """
        Створити рекурентний платіж для підписки
        
        Args:
            profile_id: ID профілю
            plan: План підписки ('free', 'business')
            period: Період ('month', 'year')
            amount: Опціональна сума платежу
            
        Returns:
            Dict з data та signature для CNB форми
        """
        if amount is None:
            if plan == "free":
                amount = 0
            elif plan == "business":
                amount = 499 if period == "month" else 4989  # Default prices
            else:
                raise ValueError(f"Unknown plan: {plan}")
        
        if amount == 0:
            # Free plan - no payment needed
            return {"amount": 0, "message": "Free plan requires no payment"}
        
        order_id = f"sub_{profile_id}_{plan}_{period}_{int(datetime.now().timestamp())}"
        
        data = {
            "action": "subscribe",
            "amount": str(amount),
            "currency": "UAH",
            "description": f"Підписка UniTax {plan} ({period})",
            "order_id": order_id,
            "server_url": f"{os.getenv('API_BASE_URL', 'https://unitas-backend.fly.dev')}/api/liqpay/callback",
            "result_url": f"{os.getenv('FRONTEND_URL', 'https://unitas-frontend.fly.dev')}/settings/subscription",
            "language": "uk",
            "subscribe": "1",
            "subscribe_periodicity": "month" if period == "month" else "year"
        }
        
        form = self._cnb_form(data)
        form["order_id"] = order_id
        form["amount"] = amount
        return form
    
    def verify_callback(self, data: str, signature: str) -> bool:
        """
        Перевірити підпис callback від LiqPay
        
        Args:
            data: Base64-encoded JSON data
            signature: Signature from LiqPay
            
        Returns:
            True if signature is valid
        """
        sign_str = self.private_key + data + self.private_key
        expected_signature = hashlib.sha1(sign_str.encode('utf-8')).hexdigest()
        return signature == expected_signature
    
    def decode_callback_data(self, data: str) -> Dict:
        """
        Декодувати дані callback
        
        Args:
            data: Base64-encoded JSON data
            
        Returns:
            Decoded dict
        """
        decoded = base64.b64decode(data).decode('utf-8')
        return json.loads(decoded)


# Глобальний екземпляр сервісу
liqpay_service = LiqPayService()
