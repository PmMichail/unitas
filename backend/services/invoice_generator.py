# backend/services/invoice_generator.py

import os
from typing import Dict, List, Optional
from datetime import datetime, date, timedelta
import google.generativeai as genai

class InvoiceGenerator:
    """Сервіс для генерації рахунків з правильними податковими розрахунками"""
    
    def __init__(self):
        self.use_gemini = False
        self.model = None
        
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
            self.use_gemini = True
            print("✅ Invoice Generator налаштовано")
        else:
            print("⚠️ Gemini API ключ не знайдено, генерація рахунків обмежена")
    
    def calculate_tax(self, amount: float, tax_rate: float) -> float:
        """Розрахунок податку"""
        return round(amount * (tax_rate / 100), 2)
    
    def generate_invoice(
        self,
        profile: Dict,
        client_data: Dict,
        items: List[Dict],
        tax_rate: Optional[float] = None
    ) -> Dict:
        """Генерація рахунку з податками"""
        
        # Use profile tax rate if not specified
        if tax_rate is None:
            tax_rate = profile.get("tax_rate", 20)  # Default to 20% (VAT)
        
        # Calculate subtotal
        subtotal = sum(item.get("quantity", 1) * item.get("price", 0) for item in items)
        
        # Calculate tax
        tax_amount = self.calculate_tax(subtotal, tax_rate)
        
        # Calculate total
        total = subtotal + tax_amount
        
        invoice = {
            "invoice_number": f"INV-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "due_date": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
            
            "seller": {
                "name": profile.get("name", ""),
                "tax_system": profile.get("tax_system", ""),
                "tax_id": profile.get("tax_id", ""),
                "address": profile.get("address", ""),
                "phone": profile.get("phone", ""),
                "email": profile.get("email", "")
            },
            
            "buyer": {
                "name": client_data.get("name", ""),
                "tax_id": client_data.get("tax_id", ""),
                "address": client_data.get("address", ""),
                "phone": client_data.get("phone", ""),
                "email": client_data.get("email", "")
            },
            
            "items": [
                {
                    "description": item.get("description", ""),
                    "quantity": item.get("quantity", 1),
                    "price": item.get("price", 0),
                    "total": item.get("quantity", 1) * item.get("price", 0)
                }
                for item in items
            ],
            
            "financials": {
                "subtotal": round(subtotal, 2),
                "tax_rate": tax_rate,
                "tax_amount": tax_amount,
                "total": round(total, 2),
                "currency": "UAH"
            },
            
            "notes": client_data.get("notes", ""),
            "generated_at": datetime.now().isoformat()
        }
        
        return invoice
    
    def generate_invoice_text(self, invoice: Dict) -> str:
        """Генерація текстового представлення рахунку"""
        
        text = f"""
РАХУНОК № {invoice['invoice_number']}
{'='*60}

ПРОДАВЕЦЬ:
{invoice['seller']['name']}
Податкова система: {invoice['seller']['tax_system']}
Податковий номер: {invoice['seller']['tax_id']}
Адреса: {invoice['seller']['address']}
Телефон: {invoice['seller']['phone']}
Email: {invoice['seller']['email']}

ПОКУПЕЦЬ:
{invoice['buyer']['name']}
Податковий номер: {invoice['buyer']['tax_id']}
Адреса: {invoice['buyer']['address']}
Телефон: {invoice['buyer']['phone']}
Email: {invoice['buyer']['email']}

ДАТА: {invoice['date']}
ДО СПЛАТИ ДО: {invoice['due_date']}

{'='*60}
ПОСЛУГИ/ТОВАРИ:
{'='*60}
"""
        
        for i, item in enumerate(invoice['items'], 1):
            text += f"{i}. {item['description']}\n"
            text += f"   Кількість: {item['quantity']} x Ціна: {item['price']} грн = {item['total']} грн\n\n"
        
        text += f"""
{'='*60}
ПІДСУМОК: {invoice['financials']['subtotal']} грн
Податок ({invoice['financials']['tax_rate']}%): {invoice['financials']['tax_amount']} грн
{'='*60}
ВСЬОГО ДО СПЛАТИ: {invoice['financials']['total']} {invoice['financials']['currency']}
{'='*60}
"""
        
        if invoice['notes']:
            text += f"\nПРИМІТКИ:\n{invoice['notes']}\n"
        
        text += f"\nЗГЕНЕРОВАНО: {invoice['generated_at']}\n"
        
        return text
    
    async def suggest_invoice_items(self, description: str) -> List[Dict]:
        """Підказка позицій рахунку на основі опису"""
        
        if not self.use_gemini:
            return []
        
        try:
            prompt = f"""
            На основі опису послуги/товару, запропонуй структуру рахунку:
            
            Опис: {description}
            
            У форматі JSON:
            [
                {{
                    "description": "назва послуги/товару",
                    "quantity": 1,
                    "price": 100.0
                }}
            ]
            """
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.5,
                    max_output_tokens=1024,
                )
            )
            
            import json
            from services.ai_service import AIService
            ai_service = AIService()
            parsed = ai_service._clean_and_parse_json(response.text)
            
            if isinstance(parsed, list):
                return parsed
        except Exception as e:
            print(f"AI invoice suggestion error: {e}")
        
        return []


invoice_service = InvoiceGenerator()
