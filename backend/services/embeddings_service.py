# backend/services/embeddings_service.py

import os
import json
from typing import List, Dict, Optional
from datetime import datetime
import google.generativeai as genai

class EmbeddingsService:
    """Vector embeddings service for semantic search"""
    
    def __init__(self):
        self.use_gemini = False
        self.embeddings_model = None
        self.embeddings_cache = {}  # Simple in-memory cache
        
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.embeddings_model = genai.GenerativeModel('gemini-2.5-flash')
            self.use_gemini = True
            print("✅ Embeddings Service налаштовано")
        else:
            print("⚠️ Gemini API ключ не знайдено, embeddings недоступні")
    
    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Генерація embedding для тексту"""
        if not self.use_gemini:
            return None
        
        # Check cache
        cache_key = hash(text)
        if cache_key in self.embeddings_cache:
            return self.embeddings_cache[cache_key]
        
        try:
            # Use Gemini for embedding generation
            # Note: Gemini doesn't have direct embedding API, so we'll use a workaround
            # For production, consider using OpenAI embeddings or sentence-transformers
            result = self.embeddings_model.generate_content(
                f"Generate a semantic representation of this text: {text}"
            )
            
            # Simple hash-based embedding as fallback
            # In production, use proper embedding model
            embedding = self._text_to_embedding(text)
            
            self.embeddings_cache[cache_key] = embedding
            return embedding
        except Exception as e:
            print(f"Embedding generation error: {e}")
            return self._text_to_embedding(text)
    
    def _text_to_embedding(self, text: str, dim: int = 384) -> List[float]:
        """Простий text-to-embedding на основі хешу (fallback)"""
        import hashlib
        text_bytes = text.encode('utf-8')
        hash_obj = hashlib.sha256(text_bytes)
        hash_hex = hash_obj.hexdigest()
        
        # Convert hash to float vector
        embedding = []
        for i in range(0, len(hash_hex), 2):
            byte_val = int(hash_hex[i:i+2], 16)
            normalized = byte_val / 255.0
            embedding.append(normalized)
        
        # Pad or truncate to desired dimension
        while len(embedding) < dim:
            embedding.append(0.0)
        return embedding[:dim]
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Обчислення косинусної подібності"""
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = sum(a * a for a in vec1) ** 0.5
        norm2 = sum(b * b for b in vec2) ** 0.5
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    async def search_similar(
        self, 
        query: str, 
        documents: List[Dict], 
        top_k: int = 5
    ) -> List[Dict]:
        """Пошук схожих документів"""
        if not documents:
            return []
        
        query_embedding = await self.generate_embedding(query)
        if not query_embedding:
            return documents[:top_k]
        
        scored_docs = []
        for doc in documents:
            doc_text = doc.get("text", doc.get("content", doc.get("purpose", "")))
            doc_embedding = await self.generate_embedding(doc_text)
            
            if doc_embedding:
                similarity = self.cosine_similarity(query_embedding, doc_embedding)
                scored_docs.append({
                    "doc": doc,
                    "score": similarity
                })
        
        # Sort by similarity
        scored_docs.sort(key=lambda x: x["score"], reverse=True)
        
        return [item["doc"] for item in scored_docs[:top_k]]
    
    async def index_transaction(self, transaction: Dict) -> Dict:
        """Індексація транзакції для пошуку"""
        text = f"""
        Транзакція: {transaction.get('purpose', '')}
        Сума: {transaction.get('amount', 0)}
        Дата: {transaction.get('date', '')}
        Тип: {transaction.get('type', '')}
        """
        
        embedding = await self.generate_embedding(text)
        
        return {
            "id": transaction.get("id"),
            "text": text,
            "embedding": embedding,
            "metadata": transaction
        }
    
    async def index_invoice(self, invoice: Dict) -> Dict:
        """Індексація рахунку для пошуку"""
        text = f"""
        Рахунок: {invoice.get('number', '')}
        Клієнт: {invoice.get('client_name', '')}
        Сума: {invoice.get('amount', 0)}
        Послуги: {invoice.get('services', '')}
        """
        
        embedding = await self.generate_embedding(text)
        
        return {
            "id": invoice.get("id"),
            "text": text,
            "embedding": embedding,
            "metadata": invoice
        }


embeddings_service = EmbeddingsService()
