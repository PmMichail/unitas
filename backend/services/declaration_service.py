# backend/services/declaration_service.py

import os
from typing import Dict, List, Optional
from datetime import datetime, date
import google.generativeai as genai

class DeclarationService:
    """Сервіс для генерації податкових декларацій"""
    
    def __init__(self):
        self.use_gemini = False
        self.model = None
        
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
            self.use_gemini = True
            print("✅ Declaration Service налаштовано")
        else:
            print("⚠️ Gemini API ключ не знайдено, генерація декларацій недоступна")
    
    def generate_fop_declaration(
        self,
        profile: Dict,
        period: str,
        transactions: List[Dict]
    ) -> Dict:
        """Генерація декларації для ФОП"""
        
        # Calculate totals
        total_income = sum(tx.get("amount", 0) for tx in transactions if tx.get("type") == "income")
        total_expense = sum(tx.get("amount", 0) for tx in transactions if tx.get("type") == "expense")
        
        # Calculate taxes
        tax_rate = profile.get("tax_rate", 5) / 100
        tax_amount = total_income * tax_rate
        
        # Military tax
        military_tax_rate = 0.015  # 1.5%
        military_tax = total_income * military_tax_rate
        
        declaration = {
            "type": "fop_declaration",
            "profile": {
                "name": profile.get("name", ""),
                "tax_system": profile.get("tax_system", ""),
                "group": profile.get("group", ""),
                "tax_id": profile.get("tax_id", "")
            },
            "period": period,
            "financials": {
                "total_income": round(total_income, 2),
                "total_expense": round(total_expense, 2),
                "net_income": round(total_income - total_expense, 2)
            },
            "taxes": {
                "single_tax": {
                    "rate": profile.get("tax_rate", 5),
                    "amount": round(tax_amount, 2)
                },
                "military_tax": {
                    "rate": 1.5,
                    "amount": round(military_tax, 2)
                },
                "total_tax": round(tax_amount + military_tax, 2)
            },
            "transactions_count": len(transactions),
            "generated_at": datetime.now().isoformat()
        }
        
        return declaration
    
    async def generate_declaration_with_ai(
        self,
        profile: Dict,
        period: str,
        transactions: List[Dict]
    ) -> Dict:
        """Генерація декларації з використанням ШІ для детального аналізу"""
        
        base_declaration = self.generate_fop_declaration(profile, period, transactions)
        
        if not self.use_gemini:
            return base_declaration
        
        try:
            prompt = f"""
            Проаналізуй фінансову діяльність ФОП і сформуй детальну податкову декларацію:
            
            Профіль:
            - ПІБ: {profile.get('name', '')}
            - Податкова система: {profile.get('tax_system', '')}
            - Група: {profile.get('group', '')}
            - Ставка: {profile.get('tax_rate', 5)}%
            
            Період: {period}
            
            Транзакції:
            {json.dumps(transactions[:50], ensure_ascii=False)[:3000]}
            
            Додай до декларації:
            1. Детальний аналіз доходів за категоріями
            2. Аналіз витрат за категоріями
            3. Рекомендації щодо оптимізації
            4. Потенційні ризики
            
            У форматі JSON:
            {{
                "income_analysis": {{"category": "amount"}},
                "expense_analysis": {{"category": "amount"}},
                "recommendations": ["рекомендація 1", "рекомендація 2"],
                "risks": ["ризик 1", "ризик 2"]
            }}
            """
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.5,
                    max_output_tokens=4096,
                )
            )
            
            # Parse AI response
            import json
            from services.ai_service import AIService
            ai_service = AIService()
            parsed = ai_service._clean_and_parse_json(response.text)
            
            if parsed and isinstance(parsed, dict):
                base_declaration["ai_analysis"] = parsed
        
        except Exception as e:
            print(f"AI declaration generation error: {e}")
        
        return base_declaration
    
    def generate_declaration_text(self, declaration: Dict) -> str:
        """Генерація текстового представлення декларації"""
        
        text = f"""
ПОДАТКОВА ДЕКЛАРАЦІЯ ФОП
{'='*50}

ПЛАТНИК ПОДАТКУ:
- ПІБ: {declaration['profile']['name']}
- Податкова система: {declaration['profile']['tax_system']}
- Група: {declaration['profile']['group']}
- Податковий номер: {declaration['profile']['tax_id']}

ПЕРІОД: {declaration['period']}

ФІНАНСОВІ ПОКАЗНИКИ:
- Загальний дохід: {declaration['financials']['total_income']} грн
- Загальні витрати: {declaration['financials']['total_expense']} грн
- Чистий дохід: {declaration['financials']['net_income']} грн

ПОДАТКИ:
- Єдиний податок ({declaration['taxes']['single_tax']['rate']}%): {declaration['taxes']['single_tax']['amount']} грн
- Військовий збір (1.5%): {declaration['taxes']['military_tax']['amount']} грн
- Всього до сплати: {declaration['taxes']['total_tax']} грн

КІЛЬКІСТЬ ТРАНЗАКЦІЙ: {declaration['transactions_count']}

ЗГЕНЕРОВАНО: {declaration['generated_at']}
"""
        
        if "ai_analysis" in declaration:
            analysis = declaration["ai_analysis"]
            text += f"\nАНАЛІЗ ШІ:\n{'='*50}\n"
            
            if "income_analysis" in analysis:
                text += "\nАналіз доходів:\n"
                for category, amount in analysis["income_analysis"].items():
                    text += f"- {category}: {amount} грн\n"
            
            if "expense_analysis" in analysis:
                text += "\nАналіз витрат:\n"
                for category, amount in analysis["expense_analysis"].items():
                    text += f"- {category}: {amount} грн\n"
            
            if "recommendations" in analysis:
                text += "\nРекомендації:\n"
                for rec in analysis["recommendations"]:
                    text += f"- {rec}\n"
            
            if "risks" in analysis:
                text += "\nРизики:\n"
                for risk in analysis["risks"]:
                    text += f"- {risk}\n"
        
        return text
    
    def parse_period(self, period: str) -> tuple:
        """Парсинг періоду (наприклад, '2024-Q1', '2024-01')"""
        if "Q" in period:
            year, quarter = period.split("-Q")
            quarter_map = {"1": (1, 3), "2": (4, 6), "3": (7, 9), "4": (10, 12)}
            start_month, end_month = quarter_map[quarter]
            return int(year), start_month, end_month
        else:
            year, month = period.split("-")
            return int(year), int(month), int(month)


declaration_service = DeclarationService()
