# backend/services/ai_service.py

import os
import json
import google.generativeai as genai
from typing import Optional, Dict, List
from datetime import datetime

class AIService:
    def __init__(self):
        self.use_gemini = False
        self.use_openai = False
        self.model = None
        
        gemini_key = os.getenv("GEMINI_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")
        
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.model = genai.GenerativeModel('gemini-flash-latest')
            self.use_gemini = True
            print("✅ Gemini API налаштовано")
        elif openai_key:
            import openai
            openai.api_key = openai_key
            self.use_openai = True
            print("✅ OpenAI API налаштовано")
        else:
            print("⚠️ API ключ не знайдено, ШІ-функції недоступні")
    
    def _clean_and_parse_json(self, text: str):
        """Очищення тексту від markdown-розмітки ```json та парсинг JSON"""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()
        try:
            return json.loads(cleaned)
        except Exception as e:
            print(f"Помилка парсингу JSON: {e}\nОригінальний текст: {text}")
            return None

    async def analyze_transaction(self, purpose: str, amount: float) -> Dict:
        """Аналіз транзакції: тип, категорія, чи є податком"""
        
        if not self.use_gemini and not self.use_openai:
            return self._fallback_analysis(purpose, amount)
        
        prompt = f"""
        Проаналізуй банківську транзакцію:
        Сума: {amount} грн
        Призначення: {purpose}
        
        Визнач у форматі JSON:
        {{
            "type": "income або expense",
            "category": "tax/salary/goods/services/other",
            "tax_type": "edp/esv/pdfo/vz/null",
            "confidence": 0.0-1.0,
            "explanation": "коротке пояснення українською"
        }}
        """
        
        if self.use_gemini:
            try:
                response = self.model.generate_content(prompt)
                parsed = self._clean_and_parse_json(response.text)
                if parsed:
                    return parsed
            except Exception as e:
                print(f"Error calling Gemini in analyze_transaction: {e}")
            return self._fallback_analysis(purpose, amount)
        return self._fallback_analysis(purpose, amount)
    
    async def chat_assistant(self, question: str, profile: Dict) -> str:
        """Чат-асистент для податкових питань"""
        
        if not self.use_gemini and not self.use_openai:
            return self._fallback_chat(question, profile)
        
        system_prompt = f"""
        Ти — експерт з податкового законодавства України.
        Допомагаєш підприємцю з такими даними:
        - Тип платника: {profile.get('tax_system', 'ФОП')}
        - Ставка податку: {profile.get('tax_rate', '5')}%
        - Працівники: {profile.get('has_employees', 'ні')}
        
        Відповідай коротко, по суті, українською мовою.
        Якщо не знаєш точної відповіді — скажи, що потрібно звернутися до ДПС.
        """
        
        full_prompt = f"{system_prompt}\n\nКористувач: {question}\nВідповідь:"
        
        if self.use_gemini:
            try:
                response = self.model.generate_content(full_prompt)
                return response.text
            except Exception as e:
                print(f"Gemini API Error: {e}")
                return self._fallback_chat(question, profile)
        return self._fallback_chat(question, profile)
    
    async def get_relevant_changes(self, profile: Dict, changes: List[Dict]) -> List[Dict]:
        """Отримати релевантні зміни в законодавстві"""
        
        if not self.use_gemini and not self.use_openai:
            return changes[:3] if changes else []
        
        if not changes:
            return []
        
        prompt = f"""
        Ти — експерт з податкового законодавства.
        Ось список останніх змін:
        {json.dumps(changes, ensure_ascii=False)}
        
        Визнач, які з цих змін стосуються підприємця з параметрами:
        - Тип: {profile.get('tax_system', 'ФОП')}
        - Ставка: {profile.get('tax_rate', '5')}%
        
        Поверни JSON-масив з ID змін, які релевантні.
        """
        
        if self.use_gemini:
            try:
                response = self.model.generate_content(prompt)
                relevant_ids = self._clean_and_parse_json(response.text)
                if isinstance(relevant_ids, list):
                    return [c for c in changes if c.get('id') in relevant_ids]
            except Exception as e:
                print(f"Error calling Gemini in get_relevant_changes: {e}")
        
        return changes[:3] if changes else []
    
    def _fallback_analysis(self, purpose: str, amount: float) -> Dict:
        """Аналіз без ШІ"""
        purpose_lower = purpose.lower()
        tax_keywords = {
            "edp": ["єдиний податок", "єп"],
            "esv": ["єсв", "есв"],
            "pdfo": ["пдфо", "ндфл"],
            "vz": ["військовий збір", "вз"]
        }
        
        tax_type = None
        for t, keywords in tax_keywords.items():
            if any(k in purpose_lower for k in keywords):
                tax_type = t
                break
        
        return {
            "type": "income" if amount > 0 else "expense",
            "category": "tax" if tax_type else "other",
            "tax_type": tax_type,
            "confidence": 0.7 if tax_type else 0.5,
            "explanation": "Визначено за ключовими словами"
        }
    
    def _fallback_chat(self, question: str, profile: Dict) -> str:
        """Чат без ШІ"""
        question_lower = question.lower()
        
        # Прості відповіді на основі контексту профілю
        if "військовий" in question_lower or "вз" in question_lower:
            return f"Військовий збір для {profile.get('tax_system', 'ФОП')} становить 1% від доходу або 5% від зарплат працівників."
        elif "дохід" in question_lower or "прибуток" in question_lower:
            return f"Ваш поточний дохід та ліміт для {profile.get('tax_system', 'ФОП')} можна переглянути на сторінці дашборду."
        elif "працівник" in question_lower:
            return f"За працівників потрібно сплачувати ПДФО (18%), Військовий збір (5%) та ЄСВ (22%)."
        elif "подат" in question_lower:
            return f"Податкова ставка для вашого профілю: {profile.get('tax_rate', '5')}%. Деталі на сторінці сплати податків."
        
        return f"Я можу відповісти на питання про податки, дохід та працівників для профілю {profile.get('tax_system', 'ФОП')}."


ai_service = AIService()
