#!/usr/bin/env python3
"""
Скрипт для створення тестових даних для консалтинг дашборду
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, date, timedelta
import random

# Import from main application
from api.main import db, User, Profile, ConsultingCompany, ConsultingClientAssignment

def seed_consulting_data():
    """Створення тестових даних для консалтинг дашборду"""
    db = db
    
    try:
        # 1. Знайдемо або створимо консалтинг компанію
        consulting_company = db.query(ConsultingCompany).first()
        if not consulting_company:
            consulting_company = ConsultingCompany(
                company_name="Тестова Консалтинг Компанія",
                is_active=True,
                free_fop_slots_included=5,
                partner_discount_percentage=10.0
            )
            db.add(consulting_company)
            db.commit()
            db.refresh(consulting_company)
            print(f"✅ Створено консалтинг компанію: {consulting_company.company_name} (ID: {consulting_company.id})")
        else:
            print(f"✅ Використовуємо існуючу компанію: {consulting_company.company_name} (ID: {consulting_company.id})")
        
        # 2. Знайдемо або створимо користувача-власника
        owner = db.query(User).filter(User.account_type == "consulting").first()
        if not owner:
            # Створимо тестового власника
            owner = User(
                email="owner@consulting.com",
                hashed_password="test_hash",
                account_type="consulting",
                consulting_company_id=consulting_company.id,
                role_in_company="owner"
            )
            db.add(owner)
            db.commit()
            db.refresh(owner)
            print(f"✅ Створено власника: {owner.email} (ID: {owner.id})")
        else:
            # Оновимо існуючого користувача
            owner.account_type = "consulting"
            owner.consulting_company_id = consulting_company.id
            owner.role_in_company = "owner"
            db.commit()
            print(f"✅ Оновлено користувача як власника: {owner.email} (ID: {owner.id})")
        
        # 3. Створимо бухгалтерів
        accountant1 = db.query(User).filter(User.email == "accountant1@consulting.com").first()
        if not accountant1:
            accountant1 = User(
                email="accountant1@consulting.com",
                hashed_password="test_hash",
                account_type="consulting",
                consulting_company_id=consulting_company.id,
                role_in_company="accountant"
            )
            db.add(accountant1)
            db.commit()
            db.refresh(accountant1)
            print(f"✅ Створено бухгалтера 1: {accountant1.email} (ID: {accountant1.id})")
        
        accountant2 = db.query(User).filter(User.email == "accountant2@consulting.com").first()
        if not accountant2:
            accountant2 = User(
                email="accountant2@consulting.com",
                hashed_password="test_hash",
                account_type="consulting",
                consulting_company_id=consulting_company.id,
                role_in_company="accountant"
            )
            db.add(accountant2)
            db.commit()
            db.refresh(accountant2)
            print(f"✅ Створено бухгалтера 2: {accountant2.email} (ID: {accountant2.id})")
        
        # 4. Створимо тестові профілі клієнтів
        client_profiles = []
        for i in range(1, 11):
            profile = db.query(Profile).filter(Profile.name == f"Тестовий Клієнт {i}").first()
            if not profile:
                profile = Profile(
                    user_id=owner.id,  # тимчасово прив'яжемо до власника
                    type="fop",
                    name=f"Тестовий Клієнт {i}",
                    tax_id=f"1234567890{i}",
                    tax_system="fop_ep",
                    group=3,
                    rate=5,
                    has_employees=False,
                    is_vat_payer=False,
                    reg_date=date.today() - timedelta(days=random.randint(30, 365))
                )
                db.add(profile)
                db.commit()
                db.refresh(profile)
                print(f"✅ Створено профіль клієнта: {profile.name} (ID: {profile.id})")
            client_profiles.append(profile)
        
        # 5. Створимо прив'язки клієнтів до консалтинг компанії
        for i, profile in enumerate(client_profiles):
            # Перевіримо чи існує прив'язка
            existing = db.query(ConsultingClientAssignment).filter(
                ConsultingClientAssignment.profile_id == profile.id
            ).first()
            
            if not existing:
                # Призначимо бухгалтерів (чергово)
                accountant_id = accountant1.id if i % 2 == 0 else accountant2.id
                
                assignment = ConsultingClientAssignment(
                    consulting_company_id=consulting_company.id,
                    profile_id=profile.id,
                    assigned_accountant_id=accountant_id,
                    assigned_at=datetime.now() - timedelta(days=random.randint(1, 30)),
                    status="active"
                )
                db.add(assignment)
                db.commit()
                print(f"✅ Прив'язано клієнта {profile.name} до бухгалтера {accountant_id}")
        
        print("\n🎉 Тестові дані успішно створено!")
        print(f"📊 Консалтинг компанія ID: {consulting_company.id}")
        print(f"👤 Власник ID: {owner.id}")
        print(f"👨‍💼 Бухгалтер 1 ID: {accountant1.id}")
        print(f"👨‍💼 Бухгалтер 2 ID: {accountant2.id}")
        print(f"👥 Клієнтів: {len(client_profiles)}")
        
    except Exception as e:
        print(f"❌ Помилка: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_consulting_data()
