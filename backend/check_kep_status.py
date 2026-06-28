#!/usr/bin/env python3
"""
Скрипт для перевірки стану КЕП-ключів в базі даних
Використання: python check_kep_status.py --profile_id <id>
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import argparse

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./unitas.db")

def check_kep_status(profile_id=None):
    """Перевіряє стан КЕП-ключів в базі даних"""
    
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        if profile_id:
            # Перевірити конкретний профіль
            query = text("""
                SELECT id, profile_id, is_active, private_key_encrypted IS NOT NULL as has_key, 
                       cert_data IS NOT NULL as has_cert, created_at
                FROM certificates 
                WHERE profile_id = :profile_id
                ORDER BY created_at DESC
            """)
            result = conn.execute(query, {"profile_id": profile_id})
        else:
            # Перевірити всі профілі
            query = text("""
                SELECT id, profile_id, is_active, private_key_encrypted IS NOT NULL as has_key, 
                       cert_data IS NOT NULL as has_cert, created_at
                FROM certificates 
                ORDER BY profile_id, created_at DESC
            """)
            result = conn.execute(query)
        
        rows = result.fetchall()
        
        if not rows:
            print("❌ КЕП-ключі не знайдено в базі даних")
            return
        
        print(f"📋 Знайдено {len(rows)} записів КЕП:\n")
        
        for row in rows:
            cert_id, pid, is_active, has_key, has_cert, created_at = row
            status = "✅ Активний" if is_active else "❌ Неактивний"
            key_status = "✅ Є ключ" if has_key else "❌ Немає ключа"
            cert_status = "✅ Є сертифікат" if has_cert else "❌ Немає сертифіката"
            
            print(f"ID: {cert_id}")
            print(f"Profile ID: {pid}")
            print(f"Статус: {status}")
            print(f"Приватний ключ: {key_status}")
            print(f"Сертифікат: {cert_status}")
            print(f"Створено: {created_at}")
            print("-" * 50)
        
        # Перевірити профілі без КЕП
        if not profile_id:
            profiles_query = text("""
                SELECT DISTINCT p.id, p.name, p.tax_id
                FROM profiles p
                LEFT JOIN certificates c ON p.id = c.profile_id AND c.is_active = TRUE AND c.private_key_encrypted IS NOT NULL
                WHERE c.id IS NULL
            """)
            profiles_result = conn.execute(profiles_query)
            profiles = profiles_result.fetchall()
            
            if profiles:
                print(f"\n⚠️  Профілі без активного КЕП ({len(profiles)}):\n")
                for pid, name, tax_id in profiles:
                    print(f"ID: {pid}, Назва: {name}, Tax ID: {tax_id}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Перевірити стан КЕП-ключів")
    parser.add_argument("--profile_id", type=int, help="ID профілю для перевірки")
    args = parser.parse_args()
    
    check_kep_status(args.profile_id)
