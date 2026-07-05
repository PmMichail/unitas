#!/usr/bin/env python3
"""
Seed script for tariff plans.
Run this script to populate the tariff_plans table with the 6 approved tariff plans.
Uses SQLAlchemy to match the main.py database configuration.
"""

import json
import os
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# Database setup - use the same configuration as main.py
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://unitas_backend:6VMY9QUVKZWJgRL@213.188.223.177:5432/unitas_backend?sslmode=disable")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Define TariffPlan model
class TariffPlan(Base):
    __tablename__ = "tariff_plans"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    name_uk = Column(String, nullable=False)
    name_ru = Column(String, nullable=True)
    monthly_price = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    is_coming_soon = Column(Boolean, default=False)
    target_profile_type = Column(String, nullable=True)
    requires_member_module = Column(Boolean, default=False)
    base_resident_count = Column(Integer, nullable=True)
    base_resident_price = Column(Float, nullable=True)
    additional_resident_tiers = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def seed_tariff_plans():
    """Seed the tariff_plans table with the 6 approved tariff plans using SQLAlchemy."""
    
    db = SessionLocal()
    
    # Create table if not exists
    Base.metadata.create_all(bind=engine)
    
    # Define the 6 tariff plans
    tariff_plans_data = [
        {
            "code": "fop_1_2",
            "name_uk": "ФОП 1–2 група",
            "name_ru": "ФЛП 1–2 группа",
            "monthly_price": 200.0,
            "description": "Базовий тариф для ФОП 1-2 групи (єдиний податок)",
            "is_active": True,
            "is_coming_soon": False,
            "target_profile_type": "fop",
            "requires_member_module": False,
            "base_resident_count": None,
            "base_resident_price": None,
            "additional_resident_tiers": None,
        },
        {
            "code": "fop_3_tov_ep",
            "name_uk": "ФОП 3 група + ТОВ (єдиний податок)",
            "name_ru": "ФЛП 3 группа + ООО (единый налог)",
            "monthly_price": 450.0,
            "description": "Тариф для ФОП 3 групи та ТОВ на спрощеній системі оподаткування",
            "is_active": True,
            "is_coming_soon": False,
            "target_profile_type": "fop",
            "requires_member_module": False,
            "base_resident_count": None,
            "base_resident_price": None,
            "additional_resident_tiers": None,
        },
        {
            "code": "non_profit",
            "name_uk": "Неприбуткова організація",
            "name_ru": "Неприбыльная организация",
            "monthly_price": 250.0,
            "description": "Базовий бухгалтерський облік для неприбуткових організацій (ОСББ, СТ, ГО, БФ)",
            "is_active": True,
            "is_coming_soon": False,
            "target_profile_type": "non_profit",
            "requires_member_module": False,
            "base_resident_count": None,
            "base_resident_price": None,
            "additional_resident_tiers": None,
        },
        {
            "code": "resident_module",
            "name_uk": "Модуль «Мешканці / Клієнти»",
            "name_ru": "Модуль «Жители / Клиенты»",
            "monthly_price": 300.0,
            "description": "Пакетна набивка: старт 60 об'єктів за 300 грн, далі кроками +10, +30, +50, +100, +200 по фіксованій ціні",
            "is_active": True,
            "is_coming_soon": False,
            "target_profile_type": "osbb",
            "requires_member_module": True,
            "base_resident_count": 60,
            "base_resident_price": 300.0,
            "additional_resident_tiers": json.dumps([
                {"count": 10, "price": 50.0},
                {"count": 30, "price": 150.0},
                {"count": 50, "price": 250.0},
                {"count": 100, "price": 500.0},
                {"count": 200, "price": 1000.0}
            ]),
        },
        {
            "code": "tov_general_vat",
            "name_uk": "ТОВ / ФОП (Загальна система + ПДВ)",
            "name_ru": "ООО / ФЛП (Общая система + НДС)",
            "monthly_price": 950.0,
            "description": "Повний бухгалтерський облік із ПДВ та загальною системою оподаткування",
            "is_active": True,
            "is_coming_soon": True,  # This tariff is "coming soon"
            "target_profile_type": "company",
            "requires_member_module": False,
            "base_resident_count": None,
            "base_resident_price": None,
            "additional_resident_tiers": None,
        },
        {
            "code": "consulting_partner",
            "name_uk": "Консалтинговий партнер",
            "name_ru": "Консалтинговый партнер",
            "monthly_price": 1200.0,
            "description": "Партнерський тариф для консалтингових компаній. Включає 3 безкоштовні ФОП 1-2 та 30% знижку на додаткових клієнтів",
            "is_active": True,
            "is_coming_soon": False,
            "target_profile_type": "consulting",
            "requires_member_module": False,
            "base_resident_count": None,
            "base_resident_price": None,
            "additional_resident_tiers": None,
        },
    ]
    
    # Insert or update tariff plans
    for plan_data in tariff_plans_data:
        code = plan_data["code"]
        
        # Check if plan exists
        existing = db.query(TariffPlan).filter(TariffPlan.code == code).first()
        
        if existing:
            # Update existing plan
            for key, value in plan_data.items():
                if key != "code":
                    setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            print(f"Updated tariff plan: {code}")
        else:
            # Create new plan
            tariff = TariffPlan(**plan_data)
            db.add(tariff)
            print(f"Created tariff plan: {code}")
    
    try:
        db.commit()
        count = db.query(TariffPlan).count()
        print(f"\n✅ Successfully seeded tariff plans!")
        print(f"Total tariff plans in database: {count}")
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error seeding tariff plans: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_tariff_plans()
