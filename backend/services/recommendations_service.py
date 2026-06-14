# backend/services/recommendations_service.py

import os
from typing import List, Dict, Optional
from datetime import datetime, date, timedelta
import google.generativeai as genai

class RecommendationsService:
    """Проактивні рекомендації для підприємців"""
    
    def __init__(self):
        self.use_gemini = False
        self.model = None
        
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
            self.use_gemini = True
            print("✅ Recommendations Service налаштовано")
        else:
            print("⚠️ Gemini API ключ не знайдено, рекомендації недоступні")
    
    def generate_tax_deadline_reminders(self, profile: Dict) -> List[Dict]:
        """Генерація нагадувань про податкові дедлайни"""
        today = date.today()
        reminders = []
        
        # Quarterly deadlines (20th of month following quarter)
        quarters = [
            ("Q1", date(today.year, 4, 20)),
            ("Q2", date(today.year, 7, 20)),
            ("Q3", date(today.year, 10, 20)),
            ("Q4", date(today.year + 1, 1, 20))
        ]
        
        for quarter, deadline in quarters:
            days_until = (deadline - today).days
            if 0 <= days_until <= 7:
                reminders.append({
                    "type": "tax_deadline",
                    "priority": "high" if days_until <= 3 else "medium",
                    "title": f"Дедлайн сплати податків {quarter}",
                    "message": f"Подайте звітність та сплатіть податки за {quarter} до {deadline.strftime('%d.%m.%Y')}",
                    "days_until": days_until,
                    "deadline": deadline.isoformat()
                })
        
        # Monthly deadlines (20th of next month)
        next_month_deadline = date(today.year, today.month + 1, 20) if today.month < 12 else date(today.year + 1, 1, 20)
        days_until_monthly = (next_month_deadline - today).days
        if 0 <= days_until_monthly <= 5:
            reminders.append({
                "type": "monthly_deadline",
                "priority": "high" if days_until_monthly <= 2 else "medium",
                "title": "Місячний дедлайн податків",
                "message": f"Подайте місячну звітність до {next_month_deadline.strftime('%d.%m.%Y')}",
                "days_until": days_until_monthly,
                "deadline": next_month_deadline.isoformat()
            })
        
        return reminders
    
    def analyze_income_trends(self, transactions: List[Dict]) -> List[Dict]:
        """Аналіз тенденцій доходу"""
        if not transactions:
            return []
        
        recommendations = []
        
        # Calculate monthly income
        monthly_income = {}
        for tx in transactions:
            if tx.get("type") == "income" and tx.get("date"):
                month_key = tx["date"][:7]  # YYYY-MM
                monthly_income[month_key] = monthly_income.get(month_key, 0) + tx.get("amount", 0)
        
        if len(monthly_income) >= 2:
            months = sorted(monthly_income.keys())
            last_month = monthly_income[months[-1]]
            prev_month = monthly_income[months[-2]]
            
            if last_month < prev_month * 0.8:
                recommendations.append({
                    "type": "income_alert",
                    "priority": "medium",
                    "title": "Зниження доходу",
                    "message": f"Дохід за останній місяць знизився на {((1 - last_month/prev_month) * 100):.1f}% порівняно з попереднім",
                    "current_income": last_month,
                    "previous_income": prev_month
                })
            elif last_month > prev_month * 1.2:
                recommendations.append({
                    "type": "income_growth",
                    "priority": "low",
                    "title": "Зростання доходу",
                    "message": f"Дохід за останній місяць зріс на {((last_month/prev_month - 1) * 100):.1f}% порівняно з попереднім",
                    "current_income": last_month,
                    "previous_income": prev_month
                })
        
        return recommendations
    
    def check_tax_limit_risk(self, profile: Dict, current_income: float) -> List[Dict]:
        """Перевірка ризику перевищення лімітів доходу"""
        recommendations = []
        
        tax_system = profile.get("tax_system", "").lower()
        group = profile.get("group")
        
        if "єдиний податок" in tax_system or "edp" in tax_system:
            limits = {
                1: 294000,  # Group 1
                2: 2208000,  # Group 2
                3: float('inf')  # Group 3 - no limit
            }
            
            if group and group in limits:
                limit = limits[group]
                if limit != float('inf'):
                    year_progress = (date.today().month - 1) / 12
                    projected_annual = current_income / year_progress if year_progress > 0 else current_income * 12
                    
                    if projected_annual > limit * 0.9:
                        recommendations.append({
                            "type": "limit_risk",
                            "priority": "high",
                            "title": "Ризик перевищення ліміту доходу",
                            "message": f"Прогнозований річний дохід {projected_annual:.0f} грн близький до ліміту групи {group} ({limit} грн)",
                            "current_income": current_income,
                            "projected_annual": projected_annual,
                            "limit": limit,
                            "group": group
                        })
        
        return recommendations
    
    async def generate_smart_recommendations(self, profile: Dict, transactions: List[Dict]) -> List[Dict]:
        """Генерація розумних рекомендацій з використанням ШІ"""
        all_recommendations = []
        
        # Rule-based recommendations
        all_recommendations.extend(self.generate_tax_deadline_reminders(profile))
        all_recommendations.extend(self.analyze_income_trends(transactions))
        
        # Calculate current year income
        current_year = date.today().year
        current_income = sum(
            tx.get("amount", 0) 
            for tx in transactions 
            if tx.get("type") == "income" and tx.get("date", "").startswith(str(current_year))
        )
        all_recommendations.extend(self.check_tax_limit_risk(profile, current_income))
        
        # AI-powered recommendations
        if self.use_gemini and transactions:
            try:
                ai_recommendations = await self._generate_ai_recommendations(profile, transactions)
                all_recommendations.extend(ai_recommendations)
            except Exception as e:
                print(f"AI recommendations error: {e}")
        
        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        all_recommendations.sort(key=lambda x: priority_order.get(x.get("priority", "low"), 2))
        
        return all_recommendations
    
    async def _generate_ai_recommendations(self, profile: Dict, transactions: List[Dict]) -> List[Dict]:
        """Генерація рекомендацій за допомогою ШІ"""
        recent_transactions = transactions[:20]  # Last 20 transactions
        
        prompt = f"""
        Проаналізуй фінансову діяльність підприємця і дай рекомендації:
        
        Профіль:
        - Тип: {profile.get('tax_system', 'ФОП')}
        - Група: {profile.get('group', 'невідомо')}
        - Ставка: {profile.get('tax_rate', '5')}%
        
        Останні транзакції:
        {json.dumps(recent_transactions, ensure_ascii=False)[:2000]}
        
        Дай 3-5 рекомендацій у форматі JSON:
        [
            {{
                "type": "optimization/risk/alert",
                "priority": "high/medium/low",
                "title": "короткий заголовок",
                "message": "детальне пояснення"
            }}
        ]
        """
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=2048,
                )
            )
            
            # Parse JSON response
            import json
            from services.ai_service import AIService
            ai_service = AIService()
            parsed = ai_service._clean_and_parse_json(response.text)
            
            if isinstance(parsed, list):
                return parsed
        except Exception as e:
            print(f"AI recommendation parsing error: {e}")
        
        return []


recommendations_service = RecommendationsService()
