#!/usr/bin/env python3
"""
Скрипт для перевірки налаштувань Tax API (токени)
Використання: python check_tax_api_settings.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./unitas.db")

def check_tax_api_settings():
    """Перевіряє налаштування Tax API в базі даних"""
    
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Перевірити всі налаштування Tax API
        query = text("""
            SELECT id, profile_id, api_token
            FROM tax_api_settings
            ORDER BY profile_id
        """)
        result = conn.execute(query)
        rows = result.fetchall()
        
        if not rows:
            print("❌ Налаштування Tax API не знайдено в базі даних")
            print("💡 Потрібно додати токен в таблицю tax_api_settings для fallback на токен-базований API")
            return
        
        print(f"📋 Знайдено {len(rows)} налаштувань Tax API:\n")
        
        for row in rows:
            setting_id, pid, api_token = row
            token_status = "✅ Є токен" if api_token else "❌ Немає токена"
            token_preview = api_token[:20] + "..." if api_token and len(api_token) > 20 else api_token
            
            print(f"ID: {setting_id}")
            print(f"Profile ID: {pid}")
            print(f"Токен: {token_status}")
            print(f"Прев'ю токена: {token_preview}")
            print("-" * 50)
        
        # Перевірити профілі без токена
        profiles_query = text("""
            SELECT DISTINCT p.id, p.name, p.tax_id
            FROM profiles p
            LEFT JOIN tax_api_settings t ON p.id = t.profile_id
            WHERE t.id IS NULL
        """)
        profiles_result = conn.execute(profiles_query)
        profiles = profiles_result.fetchall()
        
        if profiles:
            print(f"\n⚠️  Профілі без налаштувань Tax API ({len(profiles)}):\n")
            for pid, name, tax_id in profiles:
                print(f"ID: {pid}, Назва: {name}, Tax ID: {tax_id}")

if __name__ == "__main__":
    check_tax_api_settings()
