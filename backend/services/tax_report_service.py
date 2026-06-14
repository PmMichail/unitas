# backend/services/tax_report_service.py

import os
from typing import Dict, List, Optional
from datetime import datetime, date
import google.generativeai as genai

class TaxReportService:
    """Сервіс для генерації звітів для податкової"""
    
    def __init__(self):
        self.use_gemini = False
        self.model = None
        
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
            self.use_gemini = True
            print("✅ Tax Report Service налаштовано")
        else:
            print("⚠️ Gemini API ключ не знайдено, генерація звітів обмежена")
    
    def generate_quarterly_report(
        self,
        profile: Dict,
        quarter: int,
        year: int,
        transactions: List[Dict]
    ) -> Dict:
        """Генерація квартального звіту"""
        
        quarter_months = {1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]}
        months = quarter_months.get(quarter, [1])
        
        quarter_transactions = [
            tx for tx in transactions
            if tx.get("date") and any(tx["date"].startswith(f"{year}-{m:02d}") for m in months)
        ]
        
        total_income = sum(tx.get("amount", 0) for tx in quarter_transactions if tx.get("type") == "income")
        total_expense = sum(tx.get("amount", 0) for tx in quarter_transactions if tx.get("type") == "expense")
        
        tax_rate = profile.get("tax_rate", 5) / 100
        single_tax = total_income * tax_rate
        military_tax = total_income * 0.015
        
        return {
            "report_type": "quarterly",
            "quarter": quarter,
            "year": year,
            "profile": {
                "name": profile.get("name", ""),
                "tax_id": profile.get("tax_id", ""),
                "group": profile.get("group", ""),
                "tax_system": profile.get("tax_system", "")
            },
            "financials": {
                "total_income": round(total_income, 2),
                "total_expense": round(total_expense, 2),
                "net_income": round(total_income - total_expense, 2)
            },
            "taxes": {
                "single_tax": round(single_tax, 2),
                "military_tax": round(military_tax, 2),
                "total_tax": round(single_tax + military_tax, 2)
            },
            "transactions_count": len(quarter_transactions),
            "generated_at": datetime.now().isoformat()
        }
    
    def generate_annual_report(
        self,
        profile: Dict,
        year: int,
        transactions: List[Dict]
    ) -> Dict:
        """Генерація річного звіту"""
        
        year_transactions = [tx for tx in transactions if tx.get("date") and tx["date"].startswith(str(year))]
        
        quarterly_income = [0, 0, 0, 0]
        quarterly_expense = [0, 0, 0, 0]
        
        for tx in year_transactions:
            if not tx.get("date"):
                continue
            month = int(tx["date"][5:7])
            quarter = (month - 1) // 3
            
            if tx.get("type") == "income":
                quarterly_income[quarter] += tx.get("amount", 0)
            elif tx.get("type") == "expense":
                quarterly_expense[quarter] += tx.get("amount", 0)
        
        total_income = sum(quarterly_income)
        total_expense = sum(quarterly_expense)
        
        tax_rate = profile.get("tax_rate", 5) / 100
        total_single_tax = total_income * tax_rate
        total_military_tax = total_income * 0.015
        
        return {
            "report_type": "annual",
            "year": year,
            "profile": {
                "name": profile.get("name", ""),
                "tax_id": profile.get("tax_id", ""),
                "group": profile.get("group", ""),
                "tax_system": profile.get("tax_system", "")
            },
            "quarterly_breakdown": [
                {"quarter": i + 1, "income": round(quarterly_income[i], 2), "expense": round(quarterly_expense[i], 2)}
                for i in range(4)
            ],
            "financials": {
                "total_income": round(total_income, 2),
                "total_expense": round(total_expense, 2),
                "net_income": round(total_income - total_expense, 2)
            },
            "taxes": {
                "single_tax": round(total_single_tax, 2),
                "military_tax": round(total_military_tax, 2),
                "total_tax": round(total_single_tax + total_military_tax, 2)
            },
            "transactions_count": len(year_transactions),
            "generated_at": datetime.now().isoformat()
        }
    
    def generate_report_text(self, report: Dict) -> str:
        if report["report_type"] == "quarterly":
            return self._generate_quarterly_text(report)
        elif report["report_type"] == "annual":
            return self._generate_annual_text(report)
        return "Невідомий тип звіту"
    
    def _generate_quarterly_text(self, report: Dict) -> str:
        return f"""
КВАРТАЛЬНИЙ ПОДАТКОВИЙ ЗВІТ
{'='*60}

ПЛАТНИК ПОДАТКУ:
- ПІБ: {report['profile']['name']}
- Податковий номер: {report['profile']['tax_id']}
- Група: {report['profile']['group']}
- Податкова система: {report['profile']['tax_system']}

ПЕРІОД: {report['quarter']} квартал {report['year']} року

ФІНАНСОВІ ПОКАЗНИКИ:
- Загальний дохід: {report['financials']['total_income']} грн
- Загальні витрати: {report['financials']['total_expense']} грн
- Чистий дохід: {report['financials']['net_income']} грн

ПОДАТКИ:
- Єдиний податок: {report['taxes']['single_tax']} грн
- Військовий збір: {report['taxes']['military_tax']} грн
- Всього до сплати: {report['taxes']['total_tax']} грн

КІЛЬКІСТЬ ТРАНЗАКЦІЙ: {report['transactions_count']}

ЗГЕНЕРОВАНО: {report['generated_at']}
"""
    
    def _generate_annual_text(self, report: Dict) -> str:
        text = f"""
РІЧНИЙ ПОДАТКОВИЙ ЗВІТ
{'='*60}

ПЛАТНИК ПОДАТКУ:
- ПІБ: {report['profile']['name']}
- Податковий номер: {report['profile']['tax_id']}
- Група: {report['profile']['group']}
- Податкова система: {report['profile']['tax_system']}

ПЕРІОД: {report['year']} рік

КВАРТАЛЬНИЙ РОЗБИТТЯ:
"""
        for q in report["quarterly_breakdown"]:
            text += f"- {q['quarter']} квартал: дохід {q['income']} грн, витрати {q['expense']} грн\n"
        
        text += f"""
{'='*60}
ЗАГАЛЬНІ ПОКАЗНИКИ:
- Загальний дохід: {report['financials']['total_income']} грн
- Загальні витрати: {report['financials']['total_expense']} грн
- Чистий дохід: {report['financials']['net_income']} грн

ПОДАТКИ:
- Єдиний податок: {report['taxes']['single_tax']} грн
- Військовий збір: {report['taxes']['military_tax']} грн
- Всього до сплати: {report['taxes']['total_tax']} грн

КІЛЬКІСТЬ ТРАНЗАКЦІЙ: {report['transactions_count']}

ЗГЕНЕРОВАНО: {report['generated_at']}
"""
        return text


tax_report_service = TaxReportService()
