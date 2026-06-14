# backend/services/rag_service.py

import os
import json
from typing import List, Dict, Optional
from datetime import datetime
import google.generativeai as genai

class RAGService:
    """Retrieval-Augmented Generation for Ukrainian tax legislation"""
    
    def __init__(self):
        self.knowledge_base = []
        self.use_gemini = False
        self.embeddings_model = None
        
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.embeddings_model = genai.GenerativeModel('gemini-2.5-flash')
            self.use_gemini = True
            self._load_knowledge_base()
            print("✅ RAG Service налаштовано")
        else:
            print("⚠️ Gemini API ключ не знайдено, RAG недоступний")
    
    def _load_knowledge_base(self):
        """Завантаження бази знань з податковим законодавством"""
        # Основні податкові поняття для ФОП
        self.knowledge_base = [
            {
                "id": 1,
                "category": "податкові ставки",
                "content": """
                Податкові ставки для ФОП на єдиному податку:
                - Група 1: до 10% від доходу (максимум 29400 грн/рік)
                - Група 2: до 20% від доходу (максимум 2208000 грн/рік)
                - Група 3: до 5% від доходу (без обмежень)
                """,
                "tags": ["фоп", "єдиний податок", "ставки", "групи"]
            },
            {
                "id": 2,
                "category": "військовий збір",
                "content": """
                Військовий збір для ФОП:
                - Ставка: 1.5% від доходу
                - Сплачується щоквартально разом з єдиним податком
                - Не застосовується до групи 1 (до 29400 грн/рік)
                """,
                "tags": ["військовий збір", "вз", "фоп", "податки"]
            },
            {
                "id": 3,
                "category": "єсв",
                "content": """
                Єдиний соціальний внесок (ЄСВ) для ФОП:
                - Група 1: 22% від мінімальної зарплати (9288 грн/міс у 2024)
                - Група 2: 22% від мінімальної зарплати (9288 грн/міс у 2024)
                - Група 3: 22% від мінімальної зарплати (9288 грн/міс у 2024)
                - Якщо є працівники: 22% від фонду оплати праці
                """,
                "tags": ["єсв", "соціальний внесок", "фоп", "працівники"]
            },
            {
                "id": 4,
                "category": "пдфо",
                "content": """
                Податок на доходи фізичних осіб (ПДФО) для ФОП:
                - Ставка: 18% від доходу
                - Застосовується при загальній системі оподаткування
                - Військовий збір: 1.5% від доходу
                """,
                "tags": ["пдфо", "податок на доходи", "загальна система", "фоп"]
            },
            {
                "id": 5,
                "category": "звітність",
                "content": """
                Терміни подання звітності для ФОП:
                - Єдиний податок: щоквартально до 20 числа місяця, що наступає за звітним кварталом
                - ПДФО: щомісяця до 20 числа наступного місяця
                - ЄСВ: щоквартально до 20 числа місяця, що наступає за звітним кварталом
                """,
                "tags": ["звітність", "терміни", "фоп", "податки"]
            },
            {
                "id": 6,
                "category": "ліміти",
                "content": """
                Доходні ліміти для груп ФОП (2024):
                - Група 1: до 294,000 грн/рік
                - Група 2: до 2,208,000 грн/рік
                - Група 3: без обмежень
                При перевищенні ліміту необхідно перейти до вищої групи
                """,
                "tags": ["ліміти", "доход", "групи", "фоп"]
            },
            {
                "id": 7,
                "category": "працівники",
                "content": """
                Податки за працівників ФОП:
                - ПДФО: 18% від зарплати
                - Військовий збір: 1.5% від зарплати
                - ЄСВ: 22% від зарплати (роботодавець)
                ФОП-роботодавець сплачує податки за працівників
                """,
                "tags": ["працівники", "пдфо", "військовий збір", "єсв", "фоп"]
            },
            {
                "id": 8,
                "category": "рахунки",
                "content": """
                Вимоги до рахунків ФОП:
                - Обов'язково вказати назву: "ФОП [ПІБ]"
                - Вказати податкову групу
                - Вказати номер рахунку в ДПС
                - Вказати номер телефону
                - Вказати дату та номер рахунку
                """,
                "tags": ["рахунки", "фоп", "документи", "вимоги"]
            },
            {
                "id": 9,
                "category": "касові апарати",
                "content": """
                Використання касових апаратів для ФОП:
                - Група 1: не обов'язково
                - Група 2: обов'язково з 01.01.2022
                - Група 3: обов'язково з 01.01.2022
                Виключення: торгівля на ринках, надання побутових послуг населенню
                """,
                "tags": ["касові апарати", "прро", "фоп", "групи"]
            },
            {
                "id": 10,
                "category": "зміни 2024",
                "content": """
                Зміни в податковому законодавстві 2024:
                - Збільшено військовий збір до 1.5%
                - Змінено ліміти доходів для груп ФОП
                - Нові вимоги до ПРРО
                - Змінено порядок сплати ЄСВ
                """,
                "tags": ["зміни", "2024", "податки", "новини"]
            }
        ]
    
    def search_knowledge_base(self, query: str, top_k: int = 3) -> List[Dict]:
        """Пошук релевантної інформації в базі знань"""
        if not self.knowledge_base:
            return []
        
        query_lower = query.lower()
        scored_results = []
        
        for item in self.knowledge_base:
            score = 0
            
            # Пошук за тегами
            for tag in item.get("tags", []):
                if tag.lower() in query_lower:
                    score += 3
            
            # Пошук за категорією
            if item.get("category", "").lower() in query_lower:
                score += 2
            
            # Пошук за контентом
            content_lower = item.get("content", "").lower()
            if any(word in content_lower for word in query_lower.split()):
                score += 1
            
            if score > 0:
                scored_results.append({
                    "item": item,
                    "score": score
                })
        
        # Сортуємо за релевантністю
        scored_results.sort(key=lambda x: x["score"], reverse=True)
        
        return [r["item"] for r in scored_results[:top_k]]
    
    async def generate_rag_response(self, query: str, profile: Dict) -> str:
        """Генерація відповіді з використанням RAG"""
        if not self.use_gemini:
            return "RAG недоступний без Gemini API"
        
        # Пошук релевантної інформації
        relevant_docs = self.search_knowledge_base(query, top_k=3)
        
        context = ""
        if relevant_docs:
            context = "\n\n".join([
                f"Категорія: {doc['category']}\n{doc['content']}"
                for doc in relevant_docs
            ])
        
        system_prompt = f"""
        Ти — експерт з податкового законодавства України.
        Допомагаєш підприємцю з такими даними:
        - Тип платника: {profile.get('tax_system', 'ФОП')}
        - Ставка податку: {profile.get('tax_rate', '5')}%
        - Працівники: {profile.get('has_employees', 'ні')}
        
        Використовуй наступну інформацію з бази знань:
        {context if context else "Інформація не знайдена"}
        
        Відповідай повно та по суті, українською мовою.
        Завжди завершуй думки до кінця, не обривай речення посередині.
        Якщо інформації недостатньо — порад звернутися до ДПС.
        """
        
        full_prompt = f"{system_prompt}\n\nКористувач: {query}\nВідповідь:"
        
        try:
            response = self.embeddings_model.generate_content(
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
            print(f"RAG Error: {e}")
            return "Помилка генерації відповіді"


rag_service = RAGService()
