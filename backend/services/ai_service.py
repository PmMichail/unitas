# backend/services/ai_service.py

import os
import json
import google.generativeai as genai
from typing import Optional, Dict, List
from datetime import datetime
from services.rag_service import rag_service

class AIService:
    def __init__(self):
        self.use_gemini = False
        self.use_openai = False
        self.model = None
        
        gemini_key = os.getenv("GEMINI_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")
        
        if gemini_key:
            genai.configure(api_key=gemini_key)
            # Configure generation settings for complete responses
            generation_config = genai.types.GenerationConfig(
                temperature=0.7,
                top_p=0.9,
                top_k=40,
                max_output_tokens=8192,  # Increased for longer responses
            )
            self.model = genai.GenerativeModel(
                'gemini-2.5-flash',
                generation_config=generation_config
            )
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
            return self._enhanced_fallback_analysis(purpose, amount)
        
        # Enhanced prompt with more tax categories
        prompt = f"""
        Проаналізуй банківську транзакцію українською мовою:
        Сума: {amount} грн
        Призначення: {purpose}
        
        Визнач у форматі JSON:
        {{
            "type": "income або expense",
            "category": "tax/salary/goods/services/rent/utilities/marketing/other",
            "tax_type": "edp/esv/pdfo/vz/rent_tax/land_tax/null",
            "confidence": 0.0-1.0,
            "explanation": "коротке пояснення українською",
            "is_tax_payment": true/false,
            "is_salary": true/false
        }}
        
        Податкові типи:
        - edp: єдиний податок
        - esv: єдиний соціальний внесок
        - pdfo: податок на доходи фізичних осіб
        - vz: військовий збір
        - rent_tax: податок на нерухомість
        - land_tax: податок на землю
        """
        
        if self.use_gemini:
            try:
                response = self.model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.3,  # Lower temperature for more consistent classification
                        top_p=0.8,
                        top_k=30,
                        max_output_tokens=1024,
                    )
                )
                parsed = self._clean_and_parse_json(response.text)
                if parsed:
                    return parsed
            except Exception as e:
                print(f"Error calling Gemini in analyze_transaction: {e}")
            return self._enhanced_fallback_analysis(purpose, amount)
        return self._enhanced_fallback_analysis(purpose, amount)
    
    async def chat_assistant(self, question: str, profile: Dict, history: Optional[List[Dict]] = None) -> str:
        """Чат-асистент для податкових питань з RAG"""
        
        # Спробуємо використати RAG якщо доступний
        if rag_service.use_gemini:
            try:
                rag_response = await rag_service.generate_rag_response(question, profile, history)
                return rag_response
            except Exception as e:
                print(f"RAG Error: {e}")
        
        if not self.use_gemini and not self.use_openai:
            return self._fallback_chat(question, profile, history)
        
        system_prompt = f"""
        Ти — експерт з податкового законодавства України.
        Допомагаєш підприємцю з такими даними:
        - Тип платника: {profile.get('tax_system', 'ФОП')}
        - Ставка податку: {profile.get('tax_rate', '5')}%
        - Працівники: {profile.get('has_employees', 'ні')}
        
        Відповідай повно та по суті, українською мовою.
        Завжди завершуй думки до кінця, не обривай речення посередині.
        Якщо не знаєш точної відповіді — скажи, що потрібно звернутися до ДПС.
        """
        
        history_context = ""
        if history:
            history_context = "\nІсторія діалогу:\n" + "\n".join([
                f"{'Користувач' if h.get('role') == 'user' or h.get('sender') == 'user' else 'Асистент'}: {h.get('content') or h.get('text', '')}"
                for h in history
            ]) + "\n"
        
        full_prompt = f"{system_prompt}\n{history_context}\nКористувач: {question}\nВідповідь:"
        
        if self.use_gemini:
            try:
                response = self.model.generate_content(
                    full_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        top_p=0.9,
                        top_k=40,
                        max_output_tokens=8192,
                    )
                )
                return response.text
            except Exception as e:
                print(f"Gemini API Error: {e}")
                return self._fallback_chat(question, profile, history)
        return self._fallback_chat(question, profile, history)
    
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
    
    def _enhanced_fallback_analysis(self, purpose: str, amount: float) -> Dict:
        """Покращений аналіз без ШІ з більш детальною класифікацією"""
        purpose_lower = purpose.lower()
        
        # Extended tax keywords
        tax_keywords = {
            "edp": ["єдиний податок", "єп", "edp", "single tax"],
            "esv": ["єсв", "есв", "esv", "соціальний внесок"],
            "pdfo": ["пдфо", "ндфл", "pdfo", "податок на доходи"],
            "vz": ["військовий збір", "вз", "vz", "військовий"],
            "rent_tax": ["податок на нерухомість", "оренда", "rent"],
            "land_tax": ["податок на землю", "land", "земля"]
        }
        
        # Category keywords
        category_keywords = {
            "salary": ["зарплата", "зп", "salary", "оклад", "винагорода"],
            "rent": ["оренда", "rent", "квартира", "офіс"],
            "utilities": ["комунальні", "світло", "вода", "газ", "utilities"],
            "marketing": ["реклама", "маркетинг", "marketing", "піар"],
            "goods": ["товари", "goods", "матеріали", "сировина"],
            "services": ["послуги", "services", "консультації"]
        }
        
        tax_type = None
        for t, keywords in tax_keywords.items():
            if any(k in purpose_lower for k in keywords):
                tax_type = t
                break
        
        category = "other"
        for cat, keywords in category_keywords.items():
            if any(k in purpose_lower for k in keywords):
                category = cat
                break
        
        if tax_type:
            category = "tax"
        
        is_tax_payment = tax_type is not None
        is_salary = category == "salary"
        
        return {
            "type": "income" if amount > 0 else "expense",
            "category": category,
            "tax_type": tax_type,
            "confidence": 0.8 if tax_type else 0.6,
            "explanation": "Визначено за ключовими словами",
            "is_tax_payment": is_tax_payment,
            "is_salary": is_salary
        }
    
    async def generate_board_minutes(self, issue_title: str, issue_description: str, votes_summary: List[dict], profile_name: str) -> str:
        if not self.use_gemini and not self.use_openai:
            return f"ПРОТОКОЛ ЗАСІДАННЯ ПРАВЛІННЯ ОСББ '{profile_name}'\n\nТема: {issue_title}\nОпис: {issue_description}\n\nРезультати голосування:\n" + "\n".join([f"- {v['name']}: {v['vote']} ({v['comment'] or 'без коментарів'})" for v in votes_summary])

        prompt = f"""
        Ти — досвідчений юрист та секретар ОСББ. Тобі потрібно скласти офіційний Протокол засідання правління ОСББ/організації на основі результатів обговорення та голосування.
        
        Назва організації: ОСББ "{profile_name}"
        Тема засідання: {issue_title}
        Опис питання/Порядок денний: {issue_description}
        Дата засідання: {datetime.now().strftime('%d.%m.%Y')}
        
        Результати голосування членів правління:
        {json.dumps(votes_summary, ensure_ascii=False, indent=2)}
        
        Сформуй офіційний, структурований текст протоколу українською мовою. Протокол має містити:
        1. Шапку протоколу (назва, дата, місце засідання).
        2. Список присутніх членів правління.
        3. Порядок денний (обговорення питання: {issue_title}).
        4. Слухали (короткий виклад обговорення на основі опису та коментарів до голосів).
        5. Ухвалили (рішення, яке було прийнято на основі результатів голосування: якщо більшість 'За', то рішення прийнято, інакше відхилено).
        6. Підсумки голосування ('За', 'Проти', 'Утрималися').
        7. Місце для підписів голови та членів правління.
        
        Пиши у сухому юридичному офіційно-діловому стилі.
        """
        
        if self.use_gemini:
            try:
                response = self.model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.5,
                        top_p=0.9,
                        top_k=40,
                        max_output_tokens=4096,
                    )
                )
                return response.text
            except Exception as e:
                print(f"Error calling Gemini in generate_board_minutes: {e}")
                
        return f"ПРОТОКОЛ ЗАСІДАННЯ ПРАВЛІННЯ ОСББ '{profile_name}'\n\nТема: {issue_title}\nОпис: {issue_description}\n\nРезультати голосування:\n" + "\n".join([f"- {v['name']}: {v['vote']} ({v['comment'] or 'без коментарів'})" for v in votes_summary])

    async def generate_general_meeting_minutes(self, meeting_title: str, meeting_description: str, questions_with_votes: List[dict], profile_name: str) -> str:
        if not self.use_gemini and not self.use_openai:
            fallback = f"ПРОТОКОЛ ЗАГАЛЬНИХ ЗБОРІВ СТ/ОСББ '{profile_name}'\n\nТема: {meeting_title}\nПорядок денний: {meeting_description}\n\nРезультати голосування:\n"
            for q in questions_with_votes:
                fallback += f"\nПитання: {q['question_text']}\n"
                fallback += f"- За: {q['yes_area']:.2f} кв.м ({q['yes_percent']:.1f}%)\n"
                fallback += f"- Проти: {q['no_area']:.2f} кв.м ({q['no_percent']:.1f}%)\n"
                fallback += f"- Утрималися: {q['abstain_area']:.2f} кв.м ({q['abstain_percent']:.1f}%)\n"
            return fallback

        prompt = f"""
        Ти — досвідчений юрист та секретар ОСББ. Тобі потрібно скласти офіційний Протокол Загальних Зборів ОСББ/організації на основі результатів письмового голосування мешканців (співвласників).
        
        Назва організації: ОСББ/СТ "{profile_name}"
        Тема зборів: {meeting_title}
        Порядок денний: {meeting_description}
        Дата зборів: {datetime.now().strftime('%d.%m.%Y')}
        
        Результати голосування співвласників по кожному питанню порядку денного (підраховано пропорційно до площі квартир/об'єктів):
        {json.dumps(questions_with_votes, ensure_ascii=False, indent=2)}
        
        Сформуй офіційний, структурований текст протоколу українською мовою. Протокол має містити:
        1. Шапку протоколу (назва, дата, місце проведення).
        2. Відомості про загальну площу будинку/кооперативу, загальну кількість співвласників, кількість учасників зборів та їхню сукупну площу (для підтвердження кворуму).
        3. Порядок денний (перелік питань: {meeting_title}).
        4. Хід обговорення по кожному питанню порядку денного.
        5. Результати голосування по кожному питанню порядку денного:
           - Проголосували "За", "Проти", "Утрималися" (вказати площу в кв.м та відсоток).
           - Рішення прийнято (якщо більше 50% від загальної площі будинку проголосували "За"), або рішення не прийнято.
        6. Місце для підпису голови зборів та секретаря.
        
        Пиши у сухому юридичному офіційно-діловому стилі.
        """
        
        if self.use_gemini:
            try:
                response = self.model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.5,
                        top_p=0.9,
                        top_k=40,
                        max_output_tokens=4096,
                    )
                )
                return response.text
            except Exception as e:
                print(f"Error calling Gemini in generate_general_meeting_minutes: {e}")
                
        fallback = f"ПРОТОКОЛ ЗАГАЛЬНИХ ЗБОРІВ СТ/ОСББ '{profile_name}'\n\nТема: {meeting_title}\nПорядок денний: {meeting_description}\n\nРезультати голосування:\n"
        for q in questions_with_votes:
            fallback += f"\nПитання: {q['question_text']}\n"
            fallback += f"- За: {q['yes_area']:.2f} кв.м ({q['yes_percent']:.1f}%)\n"
            fallback += f"- Проти: {q['no_area']:.2f} кв.м ({q['no_percent']:.1f}%)\n"
            fallback += f"- Утрималися: {q['abstain_area']:.2f} кв.м ({q['abstain_percent']:.1f}%)\n"
        return fallback

    def _fallback_chat(self, question: str, profile: Dict, history: Optional[List[Dict]] = None) -> str:
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
