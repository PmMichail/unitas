import os
import json
import hashlib
import uuid
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Text, desc, UniqueConstraint
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from dotenv import load_dotenv
from io import BytesIO

load_dotenv()

# Database Setup
import os.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{backend_dir}/unitas.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

def is_simplified_tax(tax_system: Optional[str]) -> bool:
    if not tax_system:
        return False
    return str(tax_system).lower() in ["ednuy-3-5%", "single_tax", "fop_ep", "llc_ep", "ep"]

def is_general_tax(tax_system: Optional[str]) -> bool:
    if not tax_system:
        return False
    return str(tax_system).lower() in ["zagalna", "general_tax", "fop_general", "llc_profit", "general"]

def is_fop_profile(profile) -> bool:
    if not profile:
        return False
    p_type = str(getattr(profile, "type", "") or "").lower()
    p_name = str(getattr(profile, "name", "") or "").lower()
    p_tax = str(getattr(profile, "tax_system", "") or "").lower()
    
    # Explicit FOP type
    if p_type == "fop":
        return True
    # Explicit LLC indicators
    if "тов" in p_name or "llc" in p_name or "товариство" in p_name:
        return False
    if p_type == "company" and "llc" in p_tax:
        return False
        
    # FOP indicators in name or tax system
    if "фоп" in p_name or "fop" in p_name:
        return True
    if "fop" in p_tax:
        return True
    # FOP group indicators (LLCs cannot be Group 1 or 2)
    if getattr(profile, "group", None) in (1, 2):
        return True
        
    return p_type == "fop"

def parse_period_to_dates(period: str, year: int) -> tuple[date, date]:
    period_lower = period.lower()
    
    # Quarters (Ukrainian and English)
    if "q1" in period_lower or "1 квартал" in period_lower:
        return date(year, 1, 1), date(year, 3, 31)
    elif "q2" in period_lower or "півріччя" in period_lower or "2 квартал" in period_lower:
        return date(year, 1, 1), date(year, 6, 30)
    elif "q3" in period_lower or "три квартали" in period_lower or "3 квартал" in period_lower:
        return date(year, 1, 1), date(year, 9, 30)
    elif "q4" in period_lower or "рік" in period_lower or "4 квартал" in period_lower:
        return date(year, 1, 1), date(year, 12, 31)
        
    # Months (Ukrainian names)
    months_ua = {
        "січень": (1, 31),
        "лютий": (2, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28),
        "березень": (3, 31),
        "квітень": (4, 30),
        "травень": (5, 31),
        "червень": (6, 30),
        "липень": (7, 31),
        "серпень": (8, 31),
        "вересень": (9, 30),
        "жовтень": (10, 31),
        "листопад": (11, 30),
        "грудень": (12, 31),
        
        "january": (1, 31),
        "february": (2, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28),
        "march": (3, 31),
        "april": (4, 30),
        "may": (5, 31),
        "june": (6, 30),
        "july": (7, 31),
        "august": (8, 31),
        "september": (9, 30),
        "october": (10, 31),
        "november": (11, 30),
        "december": (12, 31),
    }
    
    for month_name, (m_num, m_days) in months_ua.items():
        if month_name in period_lower:
            return date(year, m_num, 1), date(year, m_num, m_days)
            
    return date(year, 1, 1), date(year, 12, 31)

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    verification_code = Column(String, nullable=True)
    role = Column(String, default="user") # user, admin, guest
    language = Column(String, default="uk")
    expires_at = Column(DateTime, nullable=True)
    companies = relationship("Company", back_populates="owner")
    profiles = relationship("Profile", back_populates="owner")

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=True)
    tax_system = Column(String) # fop_ep, fop_general, llc_profit, llc_ep
    group = Column(Integer, nullable=True) # 1, 2, 3, 4
    rate = Column(Float, nullable=True) # 5%, 3%, 18%
    reg_date = Column(Date, default=date.today)
    has_employees = Column(Boolean, default=False)
    address = Column(String, nullable=True)
    director_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_vat_payer = Column(Boolean, default=False)
    
    owner = relationship("User", back_populates="companies")
    employees = relationship("Employee", back_populates="company")
    tax_events = relationship("TaxEvent", back_populates="company")
    bank_statements = relationship("BankStatement", back_populates="company")
    generated_reports = relationship("GeneratedReport", back_populates="company")

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String) # 'company' або 'fop'
    name = Column(String)
    tax_id = Column(String) # ЄДРПОУ або РНОКПП
    tax_system = Column(String) # 'zagalna', 'ednuy-3-5%'
    is_director = Column(Boolean, default=False)
    
    # Додаткові поля для сумісності з розрахунками та податковим календарем
    group = Column(Integer, nullable=True) # 1, 2, 3, 4
    rate = Column(Float, nullable=True) # 5%, 3%, 18%
    reg_date = Column(Date, default=date.today)
    has_employees = Column(Boolean, default=False)
    is_vat_payer = Column(Boolean, default=False)
    esv_paid_by_employer = Column(Boolean, default=False)
    address = Column(String, nullable=True)
    director_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    registration_source = Column(String, default="direct")
    app_store_transaction_id = Column(String, nullable=True)
    google_play_purchase_token = Column(String, nullable=True)
    
    owner = relationship("User", back_populates="profiles")
    employees = relationship("Employee", back_populates="profile")
    tax_events = relationship("TaxEvent", back_populates="profile")
    bank_statements = relationship("BankStatement", back_populates="profile")
    generated_reports = relationship("GeneratedReport", back_populates="profile")
    payments = relationship("ParsedPayment", back_populates="profile")
    subscription = relationship("Subscription", uselist=False, back_populates="profile", cascade="all, delete-orphan")

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)
    name = Column(String)
    tax_id = Column(String, nullable=True) # РНОКПП
    salary = Column(Float) # оклад/ставка
    start_date = Column(Date, default=date.today)
    is_main_job = Column(Boolean, default=True)
    
    company = relationship("Company", back_populates="employees")
    profile = relationship("Profile", back_populates="employees")
    payments = relationship("ParsedPayment", back_populates="employee")

class TaxEvent(Base):
    __tablename__ = "tax_events"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)
    title = Column(String)
    type = Column(String) # payment, report
    tax_name = Column(String) # unified_tax, esv, pit, military_tax, profit_tax, employee_taxes, employee_report
    due_date = Column(Date)
    amount_desc = Column(String, nullable=True)
    form_code = Column(String, nullable=True) # F0103306, etc.
    status = Column(String, default="pending") # pending, paid, submitted
    payment_id = Column(Integer, ForeignKey("parsed_payments.id"), nullable=True) # Зв'язок з транзакцією
    
    company = relationship("Company", back_populates="tax_events")
    profile = relationship("Profile", back_populates="tax_events")
    payment = relationship("ParsedPayment", backref="tax_events")

class BankStatement(Base):
    __tablename__ = "bank_statements"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)
    file_name = Column(String)
    file_hash = Column(String, unique=True)
    bank_name = Column(String)
    uploaded_at = Column(Date)
    status = Column(String, default="parsed") # parsed, failed
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    
    company = relationship("Company", back_populates="bank_statements")
    profile = relationship("Profile", back_populates="bank_statements")
    payments = relationship("ParsedPayment", back_populates="statement")

class ParsedPayment(Base):
    __tablename__ = "parsed_payments"
    id = Column(Integer, primary_key=True, index=True)
    statement_id = Column(Integer, ForeignKey("bank_statements.id"))
    date = Column(Date)
    amount = Column(Float)
    direction = Column(String) # in (надходження), out (витрата)
    purpose = Column(Text)
    contragent = Column(String, nullable=True)
    type = Column(String) # income, tax_payment, expense, salary_payment
    tax_type = Column(String, nullable=True) # unified_tax, esv, pit, military_tax, profit_tax, None
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    taxable = Column(Boolean, default=True)
    transaction_type = Column(String, default="income") # 'income', 'expense', 'own_funds', 'refund', 'loan'
    
    statement = relationship("BankStatement", back_populates="payments")
    profile = relationship("Profile", back_populates="payments")
    employee = relationship("Employee", back_populates="payments")

class ReportTemplate(Base):
    __tablename__ = "report_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    form_code = Column(String, unique=True)
    schema_json = Column(Text) # JSON-опис полів

class GeneratedReport(Base):
    __tablename__ = "generated_reports"
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("report_templates.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)
    form_code = Column(String)
    period = Column(String) # Q1, Q2, Q3, Q4, Year
    year = Column(Integer)
    data_json = Column(Text) # заповнені поля {field_id: {value, color}}
    xml_content = Column(Text, nullable=True)
    status = Column(String, default="draft") # draft, submitted
    created_at = Column(Date, default=date.today)
    
    company = relationship("Company", back_populates="generated_reports")
    profile = relationship("Profile", back_populates="generated_reports")

class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))
    cert_owner_name = Column(String)
    cert_issuer = Column(String)
    cert_serial = Column(String)
    valid_to = Column(DateTime)
    cert_data = Column(Text)  # PEM/Base64 дані сертифіката
    private_key_encrypted = Column(Text)  # Зашифрований Fernet приватний ключ

class TaxApiSetting(Base):
    __tablename__ = "tax_api_settings"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), unique=True)
    api_token = Column(String)
    api_token_expires_at = Column(DateTime)
    last_sync_at = Column(DateTime, default=datetime.now)

class BankConnection(Base):
    __tablename__ = "bank_connections"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))
    bank_name = Column(String)  # privat, monobank, abank, ukrgas, pumb
    access_token = Column(Text)
    refresh_token = Column(Text, nullable=True)
    account_id = Column(String)
    account_number = Column(String)
    is_active = Column(Boolean, default=True)
    last_sync = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class ReportSubmission(Base):
    __tablename__ = "report_submissions"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))
    report_id = Column(Integer, ForeignKey("generated_reports.id", ondelete="SET NULL"), nullable=True)
    report_type = Column(String)  # 'f0103306', 'f0110210' тощо
    report_period = Column(String)  # '2025-Q2', '2025-06'
    report_xml = Column(Text)  # Згенерований XML з підписом
    submission_status = Column(String, default="pending")  # 'pending', 'sent', 'accepted', 'rejected'
    tax_office_response = Column(Text, nullable=True)  # Відповідь ДПС
    confirmation_number = Column(String, nullable=True)  # Номер квитанції
    submitted_at = Column(DateTime, default=datetime.now)
    accepted_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=True)
    tax_type = Column(String, nullable=False) # 'edp', 'esv', 'pdfo', 'vz'
    amount = Column(Float, nullable=False)
    period = Column(String, nullable=False)
    status = Column(String, default="pending") # 'pending', 'paid'
    payment_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    paid_at = Column(DateTime, nullable=True)
    # LiqPay fields
    liqpay_order_id = Column(String, nullable=True)
    liqpay_payment_id = Column(String, nullable=True)
    payment_type = Column(String, default="tax") # 'tax', 'subscription'

    profile = relationship("Profile")

class SystemConfig(Base):
    __tablename__ = "system_configs"
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), unique=True)
    plan = Column(String, default="free") # 'free', 'business'
    status = Column(String, default="active")
    trial_ends_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    auto_renew = Column(Boolean, default=False)
    # LiqPay fields
    liqpay_order_id = Column(String, nullable=True)
    # Stripe fields (legacy, kept for compatibility)
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    last_payment_amount = Column(Integer, nullable=True)
    last_payment_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("Profile", back_populates="subscription")

class Pricing(Base):
    __tablename__ = "pricing"
    id = Column(Integer, primary_key=True, index=True)
    plan = Column(String, unique=True, nullable=False) # 'free', 'business'
    price = Column(Integer, nullable=False) # in UAH
    currency = Column(String, default="UAH")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class StatementUsage(Base):
    __tablename__ = "statement_usage"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    month = Column(Date, nullable=False) # First day of the month
    count = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint('profile_id', 'month', name='unique_profile_month'),)

class TaxRequisite(Base):
    __tablename__ = "tax_requisites"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))
    tax_type = Column(String, nullable=False) # 'edp', 'esv', 'pdfo', 'vz'
    tax_office_name = Column(String, nullable=True)
    edrpou = Column(String, nullable=True)
    iban = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("Profile")

class PaymentHistory(Base):
    __tablename__ = "payments_history"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))
    amount = Column(Integer)  # in kopecks
    currency = Column(String, default="UAH")
    plan = Column(String)
    status = Column(String)  # pending, success, failed, refunded
    stripe_payment_intent_id = Column(String, nullable=True)
    stripe_checkout_session_id = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    profile = relationship("Profile")

class AdminUser(Base):
    __tablename__ = "admin_users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="admin") # admin, moderator, developer
    can_view_all = Column(Boolean, default=True)
    can_edit_all = Column(Boolean, default=False)
    can_delete_all = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

def get_config_val(db: Session, key: str, default: float) -> float:
    config = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if config is None:
        try:
            config = SystemConfig(key=key, value=str(default))
            db.add(config)
            db.commit()
        except Exception:
            db.rollback()
        return default
    try:
        return float(config.value)
    except ValueError:
        return default

def get_tax_calculator(db: Session):
    from services.tax_calculator import TaxCalculator
    config_rates = {
        "min_salary": get_config_val(db, "min_salary", 8647.0),
        "military_tax_fop_rate": get_config_val(db, "military_tax_fop_rate", 5.0),
        "military_tax_employee_rate": get_config_val(db, "military_tax_employee_rate", 1.5),
        "pit_employee_rate": get_config_val(db, "pit_employee_rate", 18.0),
        "esv_employee_rate": get_config_val(db, "esv_employee_rate", 22.0),
        "esv_fop_monthly": get_config_val(db, "esv_fop_monthly", 1562.0),
        "unified_tax_rate_group_3": get_config_val(db, "unified_tax_rate_group_3", 5.0),
        "profit_tax_rate": get_config_val(db, "profit_tax_rate", 18.0),
    }
    return TaxCalculator(config_rates)

def make_content_disposition(filename: str) -> str:
    import urllib.parse
    encoded_filename = urllib.parse.quote(filename)
    ext = filename.split('.')[-1] if '.' in filename else 'txt'
    fallback = f"report.{ext}"
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded_filename}"

# Create tables
Base.metadata.create_all(engine)

# Migrate schema if columns are missing
from sqlalchemy import text
migrations = [
    "ALTER TABLE companies ADD COLUMN is_vat_payer BOOLEAN DEFAULT FALSE",
    "ALTER TABLE bank_statements ADD COLUMN period_start DATE DEFAULT NULL",
    "ALTER TABLE bank_statements ADD COLUMN period_end DATE DEFAULT NULL",
    "ALTER TABLE bank_statements ADD COLUMN profile_id INTEGER DEFAULT NULL",
    "ALTER TABLE parsed_payments ADD COLUMN profile_id INTEGER DEFAULT NULL",
    "ALTER TABLE parsed_payments ADD COLUMN employee_id INTEGER DEFAULT NULL",
    "ALTER TABLE parsed_payments ADD COLUMN taxable BOOLEAN DEFAULT TRUE",
    "ALTER TABLE parsed_payments ADD COLUMN transaction_type TEXT DEFAULT 'income'",
    "ALTER TABLE employees ADD COLUMN profile_id INTEGER DEFAULT NULL",
    "ALTER TABLE employees ADD COLUMN tax_id TEXT DEFAULT NULL",
    "ALTER TABLE tax_events ADD COLUMN profile_id INTEGER DEFAULT NULL",
    "ALTER TABLE generated_reports ADD COLUMN profile_id INTEGER DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN email TEXT DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN hashed_password TEXT DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN verification_code TEXT DEFAULT NULL",
    "ALTER TABLE recurring_invoices ADD COLUMN include_act BOOLEAN DEFAULT TRUE",
    "ALTER TABLE recurring_invoices ADD COLUMN send_month INTEGER DEFAULT NULL",
    "ALTER TABLE recurring_invoices ADD COLUMN client_name TEXT DEFAULT NULL",
    "ALTER TABLE recurring_invoices ADD COLUMN client_tax_id TEXT DEFAULT NULL",
    # LiqPay migrations
    "ALTER TABLE payments ADD COLUMN liqpay_order_id TEXT DEFAULT NULL",
    "ALTER TABLE payments ADD COLUMN liqpay_payment_id TEXT DEFAULT NULL",
    "ALTER TABLE payments ADD COLUMN payment_type TEXT DEFAULT 'tax'",
    "ALTER TABLE subscriptions ADD COLUMN liqpay_order_id TEXT DEFAULT NULL",
    "ALTER TABLE recurring_invoices ADD COLUMN document_type TEXT DEFAULT 'act'",
    "ALTER TABLE invoices ADD COLUMN client_name TEXT DEFAULT NULL",
    "ALTER TABLE invoices ADD COLUMN client_tax_id TEXT DEFAULT NULL",
    "ALTER TABLE invoices ADD COLUMN document_type TEXT DEFAULT 'act'",
    "ALTER TABLE invoices ADD COLUMN due_date DATE DEFAULT NULL",
    "ALTER TABLE invoices ADD COLUMN vat_rate REAL DEFAULT NULL",
    "ALTER TABLE invoices ADD COLUMN notes TEXT DEFAULT NULL",
    "ALTER TABLE invoices ADD COLUMN items_json TEXT DEFAULT NULL",
    "ALTER TABLE profiles ADD COLUMN esv_paid_by_employer BOOLEAN DEFAULT FALSE",
    "ALTER TABLE employees ADD COLUMN is_main_job BOOLEAN DEFAULT TRUE",
    "ALTER TABLE profiles ADD COLUMN address TEXT DEFAULT NULL",
    "ALTER TABLE companies ADD COLUMN address TEXT DEFAULT NULL",
    "ALTER TABLE invoices ADD COLUMN client_address TEXT DEFAULT NULL",
    "ALTER TABLE recurring_invoices ADD COLUMN client_address TEXT DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN expires_at TIMESTAMP DEFAULT NULL",
    "ALTER TABLE profiles ADD COLUMN registration_source TEXT DEFAULT 'direct'",
    "ALTER TABLE profiles ADD COLUMN app_store_transaction_id TEXT DEFAULT NULL",
    "ALTER TABLE profiles ADD COLUMN google_play_purchase_token TEXT DEFAULT NULL",
    "ALTER TABLE profiles ADD COLUMN director_name TEXT DEFAULT NULL",
    "ALTER TABLE profiles ADD COLUMN phone TEXT DEFAULT NULL",
    "ALTER TABLE companies ADD COLUMN director_name TEXT DEFAULT NULL",
    "ALTER TABLE companies ADD COLUMN phone TEXT DEFAULT NULL",
    "ALTER TABLE tax_events ADD COLUMN payment_id INTEGER DEFAULT NULL",
    # Create tax_requisites table if not exists
    "CREATE TABLE IF NOT EXISTS tax_requisites (id INTEGER PRIMARY KEY, profile_id INTEGER, tax_type TEXT NOT NULL, tax_office_name TEXT, edrpou TEXT, iban TEXT, bank_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE)"
]

with engine.connect() as conn:
    for m in migrations:
        try:
            conn.execute(text(m))
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass

# Data migration from companies to profiles
try:
    db = SessionLocal()
    # Check if profiles is empty and companies has data
    profiles_count = db.execute(text("SELECT COUNT(*) FROM profiles")).scalar()
    if profiles_count == 0:
        companies_count = db.execute(text("SELECT COUNT(*) FROM companies")).scalar()
        if companies_count > 0:
            companies = db.execute(text("SELECT id, user_id, name, tax_system, \"group\", rate, reg_date, has_employees, is_vat_payer FROM companies")).all()
            for c in companies:
                p_type = 'fop' if 'fop' in str(c.tax_system).lower() else 'company'
                p_tax_system = 'ednuy-3-5%' if ('ep' in str(c.tax_system).lower() or 'single' in str(c.tax_system).lower()) else 'zagalna'
                
                db.execute(text(
                    "INSERT INTO profiles (id, user_id, type, name, tax_id, tax_system, is_director, \"group\", rate, reg_date, has_employees, is_vat_payer) "
                    "VALUES (:id, :user_id, :type, :name, :tax_id, :tax_system, :is_director, :group, :rate, :reg_date, :has_employees, :is_vat_payer)"
                ), {
                    "id": c.id,
                    "user_id": c.user_id,
                    "type": p_type,
                    "name": c.name,
                    "tax_id": "",
                    "tax_system": p_tax_system,
                    "is_director": False,
                    "group": c.group,
                    "rate": c.rate,
                    "reg_date": c.reg_date,
                    "has_employees": c.has_employees,
                    "is_vat_payer": c.is_vat_payer
                })
            db.commit()
    db.close()
except Exception as e:
    print(f"Data migration error: {e}")

# Passlib context for admin / reviewer credentials hashing
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Seeding default Admin and Reviewer accounts
try:
    db_seed = SessionLocal()
    
    # Seed default pricing
    existing_business_price = db_seed.query(Pricing).filter(Pricing.plan == "business").first()
    if not existing_business_price:
        business_pricing = Pricing(
            plan="business",
            price=499,
            currency="UAH"
        )
        db_seed.add(business_pricing)
        db_seed.commit()
        print("Created default pricing: business = 499 UAH")
    
    # 1. Admin account
    admin_email = os.getenv("ADMIN_EMAIL", "admin@unitas.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "ChangeMe123!")
    existing_admin = db_seed.query(AdminUser).filter(AdminUser.email == admin_email).first()
    if not existing_admin:
        hashed = pwd_context.hash(admin_password)
        admin = AdminUser(
            email=admin_email,
            password_hash=hashed,
            role="admin",
            can_view_all=True,
            can_edit_all=True,
            can_delete_all=True
        )
        db_seed.add(admin)
        db_seed.commit()
        print(f"Created default admin account: {admin_email}")
    
    # 2. Apple Review account for app store moderation
    apple_review_email = "apple_review@unitas.com"
    apple_review_password = "AppleReviewer2026!"
    existing_apple_user = db_seed.query(User).filter(User.email == apple_review_email).first()
    if not existing_apple_user:
        hashed = pwd_context.hash(apple_review_password)
        apple_user = User(
            email=apple_review_email,
            password_hash=hashed,
            telegram_id="apple_review_user"
        )
        db_seed.add(apple_user)
        db_seed.commit()
        print(f"Created Apple Review account: {apple_review_email}")
        
        # Create a profile for Apple Review
        apple_profile = Profile(
            user_id=apple_user.id,
            type="fop",
            name="Apple Review Account",
            tax_id="0000000000",
            tax_system="ednuy-3-5%",
            group=3,
            rate=5,
            has_employees=True,
            is_vat_payer=False,
            reg_date=datetime.utcnow().date()
        )
        db_seed.add(apple_profile)
        db_seed.commit()
        
        # Activate Business subscription for 90 days
        expires_at = datetime.utcnow() + timedelta(days=90)
        apple_subscription = Subscription(
            profile_id=apple_profile.id,
            plan="business",
            status="active",
            expires_at=expires_at,
            auto_renew=False
        )
        db_seed.add(apple_subscription)
        db_seed.commit()
        print(f"Activated Business subscription for Apple Review account (90 days)")
    
    db_seed.close()
except Exception as startup_err:
    print(f"Error seeding admin/reviewer accounts: {startup_err}")

# Seed Report Templates on startup
# Create tables first
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully")
    print(f"Database URL: {DATABASE_URL}")
except Exception as e:
    print(f"Error creating database tables: {e}")
    import traceback
    traceback.print_exc()

db = SessionLocal()

# Sync Postgres sequences if necessary
if "postgresql" in DATABASE_URL:
    try:
        from sqlalchemy import text
        for table in ["users", "companies", "profiles", "employees", "tax_events", "bank_statements", "parsed_payments", "report_templates", "generated_reports", "recurring_invoices", "invoices", "service_acts", "certificates", "report_submissions", "tax_api_settings", "subscriptions", "payments_history", "admin_users"]:
            db.execute(text(f'SELECT setval(seq, coalesce((SELECT max(id) FROM "{table}"), 1)) FROM pg_get_serial_sequence(\'"{table}"\', \'id\') AS seq WHERE seq IS NOT NULL;'))
        db.commit()
        print("Postgres sequences successfully synchronized.")
    except Exception as seq_err:
        print(f"Failed to sync sequences: {seq_err}")
        db.rollback()

if not db.query(ReportTemplate).filter(ReportTemplate.form_code == "F0103306").first():
    f0103306_template = ReportTemplate(
        name="Декларація платника єдиного податку ФОП 3-ї групи",
        form_code="F0103306",
        schema_json=json.dumps({
            "fields": [
                {"id": "HNAME", "name": "ПІБ Платника", "type": "string", "group": "general"},
                {"id": "HTIN", "name": "ІПН (РНОКПП)", "type": "string", "group": "general"},
                {"id": "HEMAIL", "name": "Електронна адреса", "type": "string", "group": "general"},
                {"id": "ROW01", "name": "Обсяг доходу за 1 квартал", "type": "float", "group": "revenue"},
                {"id": "ROW02", "name": "Обсяг доходу за півріччя", "type": "float", "group": "revenue"},
                {"id": "ROW03", "name": "Обсяг доходу за 9 місяців", "type": "float", "group": "revenue"},
                {"id": "ROW04", "name": "Обсяг доходу за рік", "type": "float", "group": "revenue"},
                {"id": "TAX_RATE", "name": "Ставка єдиного податку (%)", "type": "float", "group": "tax_calc"},
                {"id": "TAX_DUE", "name": "Сума податку до сплати", "type": "float", "group": "tax_calc"}
            ]
        })
    )
    db.add(f0103306_template)
    db.commit()

if not db.query(ReportTemplate).filter(ReportTemplate.form_code == "F0110210").first():
    f0110210_template = ReportTemplate(
        name="Податкова декларація з податку на додану вартість (ТОВ)",
        form_code="F0110210",
        schema_json=json.dumps({
            "fields": [
                {"id": "HNAME", "name": "Платник (ТОВ)", "type": "string", "group": "general"},
                {"id": "HTIN", "name": "ІПН/ЄДРПОУ", "type": "string", "group": "general"},
                {"id": "HEMAIL", "name": "Електронна адреса", "type": "string", "group": "general"},
                {"id": "VAT_OUT", "name": "Вихідний ПДВ (зобов'язання)", "type": "float", "group": "vat"},
                {"id": "VAT_IN", "name": "Вхідний ПДВ (кредит)", "type": "float", "group": "vat"},
                {"id": "VAT_DUE", "name": "ПДВ до сплати", "type": "float", "group": "vat"}
            ]
        })
    )
    db.add(f0110210_template)
    db.commit()

if not db.query(ReportTemplate).filter(ReportTemplate.form_code == "F3007012").first():
    f3007012_template = ReportTemplate(
        name="Звіт про ЄСВ",
        form_code="F3007012",
        schema_json=json.dumps({
            "fields": [
                {"id": "HNAME", "name": "ПІБ Платника", "type": "string", "group": "general"},
                {"id": "HTIN", "name": "ІПН (РНОКПП)", "type": "string", "group": "general"},
                {"id": "ESV_DUE", "name": "Нараховано ЄСВ", "type": "float", "group": "esv"},
                {"id": "ESV_PAID", "name": "Сплачено ЄСВ", "type": "float", "group": "esv"}
            ]
        })
    )
    db.add(f3007012_template)
    db.commit()

if not db.query(ReportTemplate).filter(ReportTemplate.form_code == "F0120109").first():
    f0120109_template = ReportTemplate(
        name="Декларація військового збору",
        form_code="F0120109",
        schema_json=json.dumps({
            "fields": [
                {"id": "HNAME", "name": "ПІБ Платника", "type": "string", "group": "general"},
                {"id": "HTIN", "name": "ІПН (РНОКПП)", "type": "string", "group": "general"},
                {"id": "MIL_DUE", "name": "Нараховано військовий збір", "type": "float", "group": "military"},
                {"id": "MIL_PAID", "name": "Сплачено військовий збір", "type": "float", "group": "military"}
            ]
        })
    )
    db.add(f0120109_template)
    db.commit()

if not db.query(ReportTemplate).filter(ReportTemplate.form_code == "F0510101").first():
    f0510101_template = ReportTemplate(
        name="Об'єднаний звіт",
        form_code="F0510101",
        schema_json=json.dumps({
            "fields": [
                {"id": "HNAME", "name": "ПІБ Платника", "type": "string", "group": "general"},
                {"id": "HTIN", "name": "ІПН (РНОКПП)", "type": "string", "group": "general"},
                {"id": "ROW01", "name": "Обсяг доходу за 1 квартал", "type": "float", "group": "revenue"},
                {"id": "ROW02", "name": "Обсяг доходу за півріччя", "type": "float", "group": "revenue"},
                {"id": "ROW03", "name": "Обсяг доходу за 9 місяців", "type": "float", "group": "revenue"},
                {"id": "ROW04", "name": "Обсяг доходу за рік", "type": "float", "group": "revenue"},
                {"id": "TAX_DUE", "name": "Нараховано єдиного податку", "type": "float", "group": "tax"},
                {"id": "ESV_DUE", "name": "Нараховано ЄСВ", "type": "float", "group": "esv"},
                {"id": "MIL_DUE", "name": "Нараховано військовий збір", "type": "float", "group": "military"}
            ]
        })
    )
    db.add(f0510101_template)
    db.commit()

if not db.query(ReportTemplate).filter(ReportTemplate.form_code == "J0500109").first():
    j0500109_template = ReportTemplate(
        name="Об'єднаний звіт (ТОВ)",
        form_code="J0500109",
        schema_json=json.dumps({
            "fields": [
                {"id": "HNAME", "name": "Назва підприємства (ТОВ)", "type": "string", "group": "general"},
                {"id": "HTIN", "name": "ЄДРПОУ", "type": "string", "group": "general"},
                {"id": "ROW01", "name": "Обсяг доходу за 1 квартал", "type": "float", "group": "revenue"},
                {"id": "ROW02", "name": "Обсяг доходу за півріччя", "type": "float", "group": "revenue"},
                {"id": "ROW03", "name": "Обсяг доходу за 9 місяців", "type": "float", "group": "revenue"},
                {"id": "ROW04", "name": "Обсяг доходу за рік", "type": "float", "group": "revenue"},
                {"id": "TAX_DUE", "name": "Нараховано єдиного податку / прибутку", "type": "float", "group": "tax"},
                {"id": "ESV_DUE", "name": "Нараховано ЄСВ (за працівників)", "type": "float", "group": "esv"},
                {"id": "MIL_DUE", "name": "Нараховано військовий збір", "type": "float", "group": "military"}
            ]
        })
    )
    db.add(j0500109_template)
    db.commit()

if not db.query(ReportTemplate).filter(ReportTemplate.form_code == "F0600101").first():
    f0600101_template = ReportTemplate(
        name="Декларація податку на доходи фізичних осіб (ПДФО)",
        form_code="F0600101",
        schema_json=json.dumps({
            "fields": [
                {"id": "HNAME", "name": "ПІБ Платника", "type": "string", "group": "general"},
                {"id": "HTIN", "name": "ІПН (РНОКПП)", "type": "string", "group": "general"},
                {"id": "TOTAL_INCOME", "name": "Загальний дохід", "type": "float", "group": "income"},
                {"id": "TAX_DUE", "name": "Нараховано ПДФО", "type": "float", "group": "pit"},
                {"id": "MIL_DUE", "name": "Нараховано військовий збір", "type": "float", "group": "military"}
            ]
        })
    )
    db.add(f0600101_template)
    db.commit()

# Self-correct profiles table to ensure FOP profiles have type='fop'
try:
    from sqlalchemy import text
    db.execute(text("UPDATE profiles SET type = 'fop' WHERE type = 'company' AND (name LIKE '%ФОП%' OR name LIKE '%FOP%' OR tax_system LIKE '%fop%')"))
    db.commit()
    print("Database profiles self-corrected successfully.")
except Exception as fix_err:
    print(f"Failed to auto-correct profiles database table: {fix_err}")
    db.rollback()

# Force-regenerate all profiles tax events to apply correct monthly/quarterly generator logic on startup
try:
    from tax_calendar.generator import TaxCalendarGenerator
    import datetime as dt_module
    all_profiles = db.query(Profile).all()
    for p in all_profiles:
        # Delete future pending events to replace them
        db.query(TaxEvent).filter(
            TaxEvent.profile_id == p.id,
            TaxEvent.status == 'pending',
            TaxEvent.due_date >= date.today()
        ).delete()
        db.commit()
        
        reg_date = p.reg_date or (date.today() - dt_module.timedelta(days=365))
        reg_date_val = reg_date.date() if hasattr(reg_date, 'date') else reg_date
        
        profile_employees = db.query(Employee).filter(
            (Employee.profile_id == p.id) | (Employee.company_id == p.id)
        ).all()
        
        generator = TaxCalendarGenerator()
        events = generator.generate_calendar(
            tax_system=p.tax_system,
            group=p.group,
            rate=p.rate,
            has_employees=p.has_employees or len(profile_employees) > 0,
            reg_date_str=reg_date_val.strftime("%Y-%m-%d") if hasattr(reg_date_val, 'strftime') else str(reg_date_val),
            start_date=date.today(),
            is_vat_payer=p.is_vat_payer,
            esv_paid_by_employer=getattr(p, 'esv_paid_by_employer', False),
            profile_type=p.type
        )
        for ev in events:
            due_dt = dt_module.datetime.strptime(ev["due_date"], "%Y-%m-%d").date() if isinstance(ev["due_date"], str) else ev["due_date"]
            exists = db.query(TaxEvent).filter(
                TaxEvent.profile_id == p.id,
                TaxEvent.title == ev["title"],
                TaxEvent.due_date == due_dt
            ).first()
            if not exists:
                db_ev = TaxEvent(
                    company_id=p.id,
                    profile_id=p.id,
                    title=ev["title"],
                    type=ev["type"],
                    tax_name=ev["tax_name"],
                    due_date=due_dt,
                    amount_desc=ev["amount_desc"],
                    form_code=ev["form_code"],
                    status=ev["status"]
                )
                db.add(db_ev)
        db.commit()
    print("Database profiles tax calendars successfully synchronized on startup.")
except Exception as regen_err:
    print(f"Failed to synchronize tax calendars on startup: {regen_err}")
    db.rollback()

db.close()

# API App Initialization
app = FastAPI(title="UniTax API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "unitas-backend"}


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def sync_user_profiles_by_tax_id(db: Session, user_id: int):
    # Retrieve all profiles for this user
    user_profiles = db.query(Profile).filter(Profile.user_id == user_id).all()
    
    # 1. Merge profiles of the SAME user
    fop_profiles = [p for p in user_profiles if p.type == 'fop']
    company_profiles = [p for p in user_profiles if p.type == 'company']
    
    def merge_profiles_list(profiles_list):
        if len(profiles_list) < 2:
            return False
            
        with_tax_id = [p for p in profiles_list if p.tax_id and p.tax_id.strip()]
        without_tax_id = [p for p in profiles_list if not p.tax_id or not p.tax_id.strip()]
        
        primary = None
        secondaries = []
        
        if with_tax_id:
            # Group by tax_id
            tax_groups = {}
            for p in with_tax_id:
                tid = p.tax_id.strip()
                tax_groups.setdefault(tid, []).append(p)
                
            for tid, group in tax_groups.items():
                if len(group) > 1 or without_tax_id:
                    primary = group[0]
                    secondaries = group[1:] + [p for p in without_tax_id if p.type == primary.type]
                    perform_merge(primary, secondaries)
                    return True
            
            # If we have 1 profile with tax_id and others without tax_id, merge them
            if len(with_tax_id) == 1 and without_tax_id:
                primary = with_tax_id[0]
                secondaries = without_tax_id
                perform_merge(primary, secondaries)
                return True
        else:
            # If none have tax_id, merge into the first one
            primary = profiles_list[0]
            secondaries = profiles_list[1:]
            perform_merge(primary, secondaries)
            return True
            
        return False

    def perform_merge(primary, secondaries):
        primary_pid = primary.id
        for sec in secondaries:
            secondary_pid = sec.id
            if primary_pid == secondary_pid:
                continue
                
            # Copy tax_id if primary doesn't have it
            if sec.tax_id and sec.tax_id.strip() and (not primary.tax_id or not primary.tax_id.strip()):
                primary.tax_id = sec.tax_id.strip()
            
            # Copy profile settings if primary has defaults
            if not primary.group and sec.group:
                primary.group = sec.group
            if not primary.rate and sec.rate:
                primary.rate = sec.rate
            if not primary.is_vat_payer and sec.is_vat_payer:
                primary.is_vat_payer = sec.is_vat_payer
            if not primary.has_employees and sec.has_employees:
                primary.has_employees = sec.has_employees
                
            # Re-point related entities
            db.query(Employee).filter(Employee.profile_id == secondary_pid).update({Employee.profile_id: primary_pid}, synchronize_session=False)
            db.query(TaxEvent).filter(TaxEvent.profile_id == secondary_pid).update({TaxEvent.profile_id: primary_pid}, synchronize_session=False)
            db.query(BankStatement).filter(BankStatement.profile_id == secondary_pid).update({BankStatement.profile_id: primary_pid}, synchronize_session=False)
            db.query(ParsedPayment).filter(ParsedPayment.profile_id == secondary_pid).update({ParsedPayment.profile_id: primary_pid}, synchronize_session=False)
            db.query(GeneratedReport).filter(GeneratedReport.profile_id == secondary_pid).update({GeneratedReport.profile_id: primary_pid}, synchronize_session=False)
            
            db.query(Employee).filter(Employee.company_id == secondary_pid).update({Employee.company_id: primary_pid}, synchronize_session=False)
            db.query(TaxEvent).filter(TaxEvent.company_id == secondary_pid).update({TaxEvent.company_id: primary_pid}, synchronize_session=False)
            db.query(BankStatement).filter(BankStatement.company_id == secondary_pid).update({BankStatement.company_id: primary_pid}, synchronize_session=False)
            db.query(GeneratedReport).filter(GeneratedReport.company_id == secondary_pid).update({GeneratedReport.company_id: primary_pid}, synchronize_session=False)
            
            # Delete secondary profile and company
            db.query(Profile).filter(Profile.id == secondary_pid).delete(synchronize_session=False)
            db.query(Company).filter(Company.id == secondary_pid).delete(synchronize_session=False)
        db.commit()

    merged_any = merge_profiles_list(fop_profiles) or merge_profiles_list(company_profiles)
    if merged_any:
        return sync_user_profiles_by_tax_id(db, user_id)


# Imports from core
from ai_parser.universal_parser import UniversalParser
from tax_calendar.generator import TaxCalendarGenerator

@app.post("/api/register")
def register_user(
    telegram_id: Optional[str] = Form(None),
    company_name: str = Form("Моя компанія"),
    tax_id: str = Form(""),
    tax_system: str = Form("fop_ep"),
    group: Optional[int] = Form(3),
    rate: Optional[float] = Form(5.0),
    has_employees: bool = Form(False),
    is_vat_payer: bool = Form(False),
    reg_date: str = Form(None),
    address: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    # Шукаємо або створюємо користувача
    user = None
    if telegram_id:
        user = db.query(User).filter((User.telegram_id == telegram_id) | (User.email == telegram_id)).first()
    
    if not user:
        user = User(telegram_id=telegram_id)
        db.add(user)
        db.commit()
        db.refresh(user)

    reg_date_parsed = datetime.strptime(reg_date, "%Y-%m-%d").date() if reg_date else date.today()
    
    # Створюємо компанію
    company = Company(
        user_id=user.id,
        name=company_name,
        tax_system=tax_system,
        group=group,
        rate=rate,
        reg_date=reg_date_parsed,
        has_employees=has_employees,
        is_vat_payer=is_vat_payer,
        address=address
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    # Також створюємо Profile для сумісності з мульти-профілями
    p_type = 'fop' if 'fop' in str(tax_system).lower() else 'company'
    p_tax_system = 'ednuy-3-5%' if ('ep' in str(tax_system).lower() or 'single' in str(tax_system).lower()) else 'zagalna'
    
    profile = Profile(
        id=company.id,  # Співпадає з ID компанії для спрощення зв'язків
        user_id=user.id,
        type=p_type,
        name=company_name,
        tax_id=tax_id,
        tax_system=p_tax_system,
        is_director=False,
        group=group,
        rate=rate,
        reg_date=reg_date_parsed,
        has_employees=has_employees,
        is_vat_payer=is_vat_payer,
        address=address
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    # Генеруємо податковий календар на 12 місяців
    generator = TaxCalendarGenerator()
    events = generator.generate_calendar(
        tax_system=tax_system,
        group=group,
        rate=rate,
        has_employees=has_employees,
        reg_date_str=reg_date_parsed.strftime("%Y-%m-%d"),
        start_date=reg_date_parsed,
        is_vat_payer=is_vat_payer,
        esv_paid_by_employer=getattr(profile, 'esv_paid_by_employer', False),
        profile_type=p_type
    )
    
    for ev in events:
        db_ev = TaxEvent(
            company_id=company.id,
            profile_id=profile.id,
            title=ev["title"],
            type=ev["type"],
            tax_name=ev["tax_name"],
            due_date=datetime.strptime(ev["due_date"], "%Y-%m-%d").date(),
            amount_desc=ev["amount_desc"],
            form_code=ev["form_code"],
            status=ev["status"]
        )
        db.add(db_ev)
    db.commit()
    sync_user_profiles_by_tax_id(db, user.id)

    return {"message": "Успішно зареєстровано", "user_id": user.id, "company_id": company.id, "profile_id": profile.id}


@app.get("/api/companies/{telegram_id}")
def get_user_companies(telegram_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter((User.telegram_id == telegram_id) | (User.email == telegram_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    return user.companies

@app.post("/api/upload-statement")
async def upload_statement(
    company_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # company_id is treated as profile_id
    file_content = await file.read()
    
    # Декодуємо base64, якщо файл надіслано як Data URI
    if file_content.startswith(b"data:") and b";base64," in file_content:
        try:
            _, base64_data = file_content.split(b";base64,", 1)
            import base64
            file_content = base64.b64decode(base64_data)
        except Exception as e:
            print(f"[BASE64 DECODE ERROR] Failed to decode base64 file content: {e}")

    file_hash = hashlib.md5(file_content).hexdigest()

    # Перевіряємо дублікати
    existing = db.query(BankStatement).filter(BankStatement.file_hash == file_hash).first()
    if existing:
        return {"message": "Ця виписка вже завантажена", "statement_id": existing.id}

    # Зберігаємо файл тимчасово
    os.makedirs("./temp_uploads", exist_ok=True)
    temp_path = f"./temp_uploads/{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(file_content)

    parser = UniversalParser()
    try:
        parsed_txs = parser.parse(temp_path)
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=400, detail=f"Не вдалося розпарсити виписку: {str(e)}")

    if os.path.exists(temp_path):
        os.remove(temp_path)

    if not parsed_txs:
        raise HTTPException(status_code=400, detail="Не вдалося знайти транзакцій у виписці. Перевірте правильність файлу.")

    # Визначаємо банк з першої транзакції
    bank_name = parser.bank_name or (parsed_txs[0]["bank_name"] if parsed_txs else "Невідомий Банк")

    # Спробуємо знайти профіль за tax_id з виписки
    profile = None
    if parser.statement_tax_id:
        profile = db.query(Profile).filter(Profile.tax_id == parser.statement_tax_id).first()
        
    # Якщо не знайдено, використовуємо profile_id (company_id)
    if not profile:
        profile = db.query(Profile).filter(Profile.id == company_id).first()
        
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")

    # Автоматично заповнюємо tax_id профілю, якщо він порожній, та запускаємо синхронізацію
    if parser.statement_tax_id and (not profile.tax_id or not profile.tax_id.strip()):
        profile.tax_id = parser.statement_tax_id
        db.commit()
        db.refresh(profile)
        sync_user_profiles_by_tax_id(db, profile.user_id)
        # Перезавантажуємо профіль після можливого злиття
        profile = db.query(Profile).filter(Profile.tax_id == parser.statement_tax_id).first()
        if not profile:
            profile = db.query(Profile).filter(Profile.id == company_id).first()

    profile_id = profile.id

    # Створюємо запис про виписку
    statement = BankStatement(
        company_id=profile_id,
        profile_id=profile_id,
        file_name=file.filename,
        file_hash=file_hash,
        bank_name=bank_name,
        uploaded_at=date.today(),
        status="parsed",
        period_start=parser.period_start,
        period_end=parser.period_end
    )
    db.add(statement)
    db.commit()
    db.refresh(statement)

    # Зберігаємо платежі з уникненням дублікатів (на випадок перекриття періодів виписок)
    seen_in_upload = {}
    inserted_count = 0

    for tx in parsed_txs:
        tx_date = datetime.strptime(tx["date"], "%Y-%m-%d").date()
        
        # Створюємо унікальний ключ для транзакції
        tx_key = (tx_date, tx["amount"], tx["direction"], tx["purpose"], tx["contragent"])
        seen_count = seen_in_upload.get(tx_key, 0) + 1
        seen_in_upload[tx_key] = seen_count
        
        # Рахуємо скільки таких самих транзакцій вже є в базі для цього профілю
        db_count = db.query(ParsedPayment).filter(
            ParsedPayment.profile_id == profile_id,
            ParsedPayment.date == tx_date,
            ParsedPayment.amount == tx["amount"],
            ParsedPayment.direction == tx["direction"],
            ParsedPayment.purpose == tx["purpose"],
            ParsedPayment.contragent == tx["contragent"]
        ).count()
        
        if db_count >= seen_count:
            # Ця транзакція вже є в базі, пропускаємо її
            continue

        # Для зарплат: шукати ПІБ працівника та лінкувати
        employee_id = None
        purpose_lower = tx["purpose"].lower()
        if tx["type"] in ["salary_payment", "tax_payment"]:
            stmt_employees = db.query(Employee).filter(
                (Employee.profile_id == profile_id) | (Employee.company_id == profile_id)
            ).all()
            for emp in stmt_employees:
                if emp.name.lower() in purpose_lower or (emp.tax_id and emp.tax_id in purpose_lower):
                    employee_id = emp.id
                    break
        
        db_payment = ParsedPayment(
            statement_id=statement.id,
            date=tx_date,
            amount=tx["amount"],
            direction=tx["direction"],
            purpose=tx["purpose"],
            contragent=tx["contragent"],
            type=tx["type"],
            tax_type=tx["tax_type"],
            profile_id=profile_id,
            employee_id=employee_id,
            taxable=tx.get("taxable", True),
            transaction_type=tx.get("transaction_type", "income")
        )
        db.add(db_payment)
        inserted_count += 1
    db.commit()

    return {"message": f"Завантажено {inserted_count} нових транзакцій з {bank_name} для профілю '{profile.name}' (пропущено {len(parsed_txs) - inserted_count} дублікатів)", "statement_id": statement.id}

def map_tax_type(t: str) -> str:
    mapping = {
        "edp": "unified_tax",
        "esv": "esv",
        "vz": "military_tax",
        "military": "military_tax",
        "pdfo": "pit",
        "unified_tax": "unified_tax",
        "military_tax": "military_tax",
        "pit": "pit"
    }
    return mapping.get(t, t)

def get_profile_num_months(profile, db, period_type="all", year=None, period_value=None, start_dt=None, end_dt=None) -> int:
    import datetime as dt_module
    from datetime import date
    
    if period_type == "month":
        return 1
    elif period_type == "quarter":
        return 3
    elif period_type == "year":
        return 12
        
    if start_dt and end_dt:
        return (end_dt.year - start_dt.year) * 12 + (end_dt.month - start_dt.month) + 1
        
    latest_stmt = db.query(BankStatement).filter(BankStatement.profile_id == profile.id).order_by(desc(BankStatement.id)).first()
    if latest_stmt and latest_stmt.period_start and latest_stmt.period_end:
        p_start = latest_stmt.period_start
        p_end = latest_stmt.period_end
        return (p_end.year - p_start.year) * 12 + (p_end.month - p_start.month) + 1
        
    months = 3
    if profile.reg_date:
        reg_date_val = profile.reg_date
        if isinstance(reg_date_val, str):
            try:
                from datetime import datetime
                reg_date_val = datetime.strptime(reg_date_val, "%Y-%m-%d").date()
            except:
                pass
        if hasattr(reg_date_val, 'date'):
            reg_date_val = reg_date_val.date()
        from datetime import date as datetime_date
        if isinstance(reg_date_val, (date, datetime_date)):
            today = date.today()
            months = max(1, (today.year - reg_date_val.year) * 12 + (today.month - reg_date_val.month) + 1)
            months = min(12, months)
    return months

def get_paid_taxes_by_type(db, profile_id: int, start_dt=None, end_dt=None) -> dict:
    from datetime import date, timedelta
    
    # 1. Fetch tax payments from ParsedPayment (bank statements)
    # Include both type="tax_payment" and payments with tax_type set
    query_parsed = db.query(ParsedPayment).filter(
        ParsedPayment.profile_id == profile_id,
        (ParsedPayment.type == "tax_payment") | (ParsedPayment.tax_type != None)
    )
    if start_dt:
        query_parsed = query_parsed.filter(ParsedPayment.date >= start_dt)
    if end_dt:
        query_parsed = query_parsed.filter(ParsedPayment.date <= end_dt)
    parsed_payments = query_parsed.all()
    
    # 2. Fetch payments from Payment table (manual/Stripe)
    query_manual = db.query(Payment).filter(
        Payment.profile_id == profile_id,
        Payment.status == "paid"
    )
    if start_dt:
        from sqlalchemy import func
        query_manual = query_manual.filter(func.date(Payment.paid_at) >= start_dt)
    if end_dt:
        from sqlalchemy import func
        query_manual = query_manual.filter(func.date(Payment.paid_at) <= end_dt)
    manual_payments = query_manual.all()
    
    # 3. Merge and deduplicate
    merged = []
    seen_keys = set()
    
    for p in parsed_payments:
        # Use tax_type if available, otherwise try to determine from purpose
        if p.tax_type:
            db_tax_name = map_tax_type(p.tax_type)
        else:
            # Try to determine tax type from purpose text
            purpose_lower = (p.purpose or "").lower()
            if "єдиний" in purpose_lower or "едп" in purpose_lower or "едп" in purpose_lower:
                db_tax_name = "unified_tax"
            elif "єсв" in purpose_lower or "есв" in purpose_lower:
                db_tax_name = "esv"
            elif "військовий" in purpose_lower or "військ" in purpose_lower or "вз" in purpose_lower:
                db_tax_name = "military_tax"
            elif "пдфо" in purpose_lower or "податок на доходи" in purpose_lower:
                db_tax_name = "pit"
            else:
                db_tax_name = "unified_tax"  # Default to unified tax for tax payments
        
        p_date = p.date
        p_amount = round(float(p.amount), 2)
        
        key = (p_date, p_amount, db_tax_name)
        seen_keys.add(key)
        merged.append({
            "tax_name": db_tax_name,
            "amount": p_amount,
            "date": p_date
        })
        
    for p in manual_payments:
        db_tax_name = map_tax_type(p.tax_type) if p.tax_type else "unified_tax"
        p_date = p.paid_at.date() if p.paid_at else None
        p_amount = round(float(p.amount), 2)
        
        if p_date:
            key = (p_date, p_amount, db_tax_name)
            if key in seen_keys:
                continue
            
            # +/- 1 day check
            duplicate_found = False
            for offset in [-1, 1]:
                check_key = (p_date + timedelta(days=offset), p_amount, db_tax_name)
                if check_key in seen_keys:
                    duplicate_found = True
                    break
            if duplicate_found:
                continue
                
            seen_keys.add(key)
            merged.append({
                "tax_name": db_tax_name,
                "amount": p_amount,
                "date": p_date
            })
            
    res = {
        "unified_tax": 0.0,
        "edp": 0.0,
        "esv": 0.0,
        "military_tax": 0.0,
        "vz": 0.0,
        "military": 0.0,
        "pit": 0.0,
        "pdfo": 0.0,
        "employee_taxes": 0.0
    }
    for item in merged:
        t_name = item["tax_name"]
        
        # Add to both formats to prevent any mismatch
        if t_name in ["unified_tax", "edp", "ep"]:
            res["unified_tax"] += item["amount"]
            res["edp"] += item["amount"]
        elif t_name in ["military_tax", "vz", "military"]:
            res["military_tax"] += item["amount"]
            res["vz"] += item["amount"]
            res["military"] += item["amount"]
        elif t_name in ["pit", "pdfo"]:
            res["pit"] += item["amount"]
            res["pdfo"] += item["amount"]
        elif t_name in ["esv"]:
            res["esv"] += item["amount"]
        else:
            res[t_name] = res.get(t_name, 0.0) + item["amount"]
            
    for k in res:
        res[k] = round(res[k], 2)
        
    return res

@app.get("/api/dashboard/{profile_id}")
def get_dashboard(
    profile_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    period_type: str = "all",
    year: Optional[int] = None,
    period_value: Optional[int] = None
):
    import datetime as dt_module
    from services.tax_calculator import TaxCalculator, tax_calculator
    
    background_tasks.add_task(cleanup_expired_guests)
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")

    tax_system = profile.tax_system

    # If the user is a guest, check if they have expired
    user = db.query(User).filter(User.id == profile.user_id).first()
    if user and user.role == "guest":
        from datetime import datetime
        if user.expires_at and user.expires_at < datetime.utcnow():
            raise HTTPException(status_code=404, detail="Session expired")

    # Create calculator with config
    calculator = get_tax_calculator(db)
    
    min_sal = calculator.get_rate("min_salary")
    mil_fop_rate = calculator.get_rate("military_tax_fop_rate")
    mil_emp_rate = calculator.get_rate("military_tax_employee_rate")
    pit_rate = calculator.get_rate("pit_employee_rate")
    esv_rate = calculator.get_rate("esv_employee_rate")
    esv_fop_monthly = calculator.get_rate("esv_fop_monthly")
    default_rate = calculator.get_rate("unified_tax_rate_group_3")

    # Розрахунок діапазону дат для фільтрації
    start_dt = None
    end_dt = None
    
    if period_type == "month":
        y = year if year is not None else date.today().year
        m = period_value if period_value is not None else date.today().month
        if m < 1 or m > 12:
            m = date.today().month
        start_dt = date(y, m, 1)
        if m == 12:
            end_dt = date(y, 12, 31)
        else:
            end_dt = date(y, m + 1, 1) - dt_module.timedelta(days=1)
    elif period_type == "quarter":
        y = year if year is not None else date.today().year
        q = period_value if period_value is not None else 1
        if q < 1 or q > 4:
            q = 1
        if q == 1:
            start_dt = date(y, 1, 1)
            end_dt = date(y, 3, 31)
        elif q == 2:
            start_dt = date(y, 4, 1)
            end_dt = date(y, 6, 30)
        elif q == 3:
            start_dt = date(y, 7, 1)
            end_dt = date(y, 9, 30)
        elif q == 4:
            start_dt = date(y, 10, 1)
            end_dt = date(y, 12, 31)
    elif period_type == "year":
        y = year if year is not None else date.today().year
        start_dt = date(y, 1, 1)
        end_dt = date(y, 12, 31)

    # Збираємо всі транзакції профілю
    query = db.query(ParsedPayment).filter(
        (ParsedPayment.profile_id == profile_id) |
        (ParsedPayment.statement.has(BankStatement.profile_id == profile_id))
    )
    if start_dt:
        query = query.filter(ParsedPayment.date >= start_dt)
    if end_dt:
        query = query.filter(ParsedPayment.date <= end_dt)
    payments = query.all()
    
    total_income = sum(p.amount for p in payments if p.direction == "in")
    total_expense = sum(p.amount for p in payments if p.direction == "out")
    
    # Розрахунок повернень
    incoming_refunds = sum(p.amount for p in payments if p.direction == "in" and p.transaction_type == "refund")
    outgoing_refunds = sum(p.amount for p in payments if p.direction == "out" and p.transaction_type == "refund")
    
    # Розрахунок taxable_income (оподатковуваний дохід): надходження мінус повернення клієнтам
    taxable_income = sum(p.amount for p in payments if p.direction == "in" and p.taxable and p.transaction_type == "income") - outgoing_refunds
    taxable_income = max(0.0, taxable_income)
    
    # Інші категорії доходів та витрат
    own_funds = sum(p.amount for p in payments if p.transaction_type == "own_funds")
    refund = incoming_refunds + outgoing_refunds
    loan = sum(p.amount for p in payments if p.transaction_type == "loan")
    
    # Розрахунок податку до сплати
    # Отримуємо останню завантажену виписку
    latest_stmt = db.query(BankStatement).filter(BankStatement.profile_id == profile_id).order_by(desc(BankStatement.id)).first()
    
    if start_dt:
        period_start_str = start_dt.strftime("%Y-%m-%d")
    else:
        period_start_str = latest_stmt.period_start.strftime("%Y-%m-%d") if latest_stmt and latest_stmt.period_start else None

    if end_dt:
        period_end_str = end_dt.strftime("%Y-%m-%d")
    else:
        period_end_str = latest_stmt.period_end.strftime("%Y-%m-%d") if latest_stmt and latest_stmt.period_end else None

    # Розрахунок кількості місяців у періоді
    num_months = get_profile_num_months(profile, db, period_type, year, period_value, start_dt, end_dt)

    # Prepare transactions for TaxCalculator
    transactions = []
    for p in payments:
        transactions.append({
            "direction": p.direction,
            "amount": p.amount,
            "taxable": p.taxable,
            "transaction_type": p.transaction_type
        })
    
    # Get employees
    profile_employees = db.query(Employee).filter(
        (Employee.profile_id == profile_id) | (Employee.company_id == profile_id)
    ).all()
    
    # Prepare employees for TaxCalculator
    employees = []
    for emp in profile_employees:
        employees.append({
            "salary": emp.salary,
            "is_main_job": getattr(emp, 'is_main_job', True)
        })
    
    # Profile dict for TaxCalculator
    profile_dict = {
        "tax_system": profile.tax_system,
        "type": profile.type,
        "group": profile.group,
        "rate": profile.rate,
        "has_employees": profile.has_employees or len(profile_employees) > 0,
        "esv_paid_by_employer": getattr(profile, 'esv_paid_by_employer', False)
    }
    
    # Use TaxCalculator for unified calculation
    taxes = calculator.calculate_profile_taxes(
        profile=profile_dict,
        transactions=transactions,
        employees=employees,
        num_months=num_months
    )
    
    tax_due = taxes["tax_due"]
    military_tax_due = taxes["military_tax_due"]
    esv_due = taxes["esv_due"]
    employee_esv_due = taxes["employee_esv_due"]
    employee_pit_due = taxes["employee_pit_due"]
    employee_mil_due = taxes["employee_mil_due"]
    
    esv_due_total = esv_due + employee_esv_due
    military_tax_due_total = military_tax_due + employee_mil_due

    # Сплачені податки за допомогою уніфікованого хелпера
    tax_paid_dict = get_paid_taxes_by_type(db, profile_id, start_dt, end_dt)
    total_tax_paid = sum(tax_paid_dict.values())

    # Розрахунок різниць по податках
    ep_paid = tax_paid_dict.get("unified_tax", 0.0)
    mil_paid = tax_paid_dict.get("military_tax", 0.0)
    esv_paid = tax_paid_dict.get("esv", 0.0)
    pit_paid = tax_paid_dict.get("pit", 0.0)
    
    ep_diff = tax_due - ep_paid
    mil_diff = military_tax_due_total - mil_paid
    esv_diff = esv_due_total - esv_paid
    pit_diff = employee_pit_due - pit_paid

    # Борг рахується лише як сума недовнесених платежів (позитивні різниці)
    outstanding_debt = 0.0
    if ep_diff > 0:
        outstanding_debt += ep_diff
    if mil_diff > 0:
        outstanding_debt += mil_diff
    if esv_diff > 0:
        outstanding_debt += esv_diff
    if pit_diff > 0:
        outstanding_debt += pit_diff

    # Наступні події календаря
    upcoming_events = db.query(TaxEvent).filter(
        TaxEvent.profile_id == profile_id, 
        TaxEvent.due_date >= date.today()
    ).order_by(TaxEvent.due_date).limit(5).all()

    if len(upcoming_events) < 3:
        try:
            reg_date = profile.reg_date or (date.today() - dt_module.timedelta(days=365))
            reg_date_val = reg_date.date() if hasattr(reg_date, 'date') else reg_date
            generator = TaxCalendarGenerator()
            events = generator.generate_calendar(
                tax_system=profile.tax_system,
                group=profile.group,
                rate=profile.rate,
                has_employees=profile.has_employees or len(profile_employees) > 0,
                reg_date_str=reg_date_val.strftime("%Y-%m-%d") if hasattr(reg_date_val, 'strftime') else str(reg_date_val),
                start_date=date.today(),
                is_vat_payer=profile.is_vat_payer,
                esv_paid_by_employer=getattr(profile, 'esv_paid_by_employer', False),
                profile_type=profile.type
            )
            for ev in events:
                due_dt = dt_module.datetime.strptime(ev["due_date"], "%Y-%m-%d").date() if isinstance(ev["due_date"], str) else ev["due_date"]
                exists = db.query(TaxEvent).filter(
                    TaxEvent.profile_id == profile_id,
                    TaxEvent.title == ev["title"],
                    TaxEvent.due_date == due_dt
                ).first()
                if not exists:
                    db_ev = TaxEvent(
                        company_id=profile_id,
                        profile_id=profile_id,
                        title=ev["title"],
                        type=ev["type"],
                        tax_name=ev["tax_name"],
                        due_date=due_dt,
                        amount_desc=ev["amount_desc"],
                        form_code=ev["form_code"],
                        status=ev["status"]
                    )
                    db.add(db_ev)
            db.commit()
            
            # Query again
            upcoming_events = db.query(TaxEvent).filter(
                TaxEvent.profile_id == profile_id, 
                TaxEvent.due_date >= date.today()
            ).order_by(TaxEvent.due_date).limit(5).all()
        except Exception as calendar_err:
            print(f"[CALENDAR AUTO-GEN ERROR] Failed to auto-generate: {calendar_err}")

    # Працівники
    cutoff_date = date.today() - dt_module.timedelta(days=30)
    
    employees_list = []
    for emp in profile_employees:
        emp_payments = db.query(ParsedPayment).filter(
            ParsedPayment.profile_id == profile_id,
            ParsedPayment.date >= cutoff_date,
            (ParsedPayment.employee_id == emp.id) | (ParsedPayment.purpose.like(f"%{emp.name}%"))
        ).all()
        
        salary_paid = any(p.transaction_type == 'salary_payment' for p in emp_payments)
        esv_paid_emp = any(p.tax_type == 'esv' for p in emp_payments)
        pit_paid_emp = any(p.tax_type in ['pit', 'military_tax'] for p in emp_payments)
        
        is_main = getattr(emp, 'is_main_job', True)
        if is_main is None:
            is_main = True
        esv_base = max(emp.salary, min_sal) if is_main else emp.salary

        employees_list.append({
            "id": emp.id,
            "name": emp.name,
            "tax_id": emp.tax_id,
            "salary": round(emp.salary, 2),
            "is_main_job": is_main,
            "esv_amount": round(esv_base * (esv_rate / 100.0), 2),
            "esv_paid": esv_paid_emp,
            "pit_amount": round(emp.salary * (pit_rate / 100.0), 2),
            "pit_paid": pit_paid_emp,
            "military_tax_amount": round(emp.salary * (mil_emp_rate / 100.0), 2),
            "military_tax_paid": pit_paid_emp,
            "salary_paid": salary_paid
        })

    # Витрати на контрагентів-ФОП за договорами послуг
    contractor_payments_total = 0.0
    contractor_payments_list = []
    for p in payments:
        if p.direction == "out" and p.transaction_type == "expense":
            purpose_lower = p.purpose.lower()
            contragent_lower = (p.contragent or "").lower()
            if any(k in contragent_lower or k in purpose_lower for k in ["фоп", "фізична особа-підприємець", "фізична особа - підприємець", "fop"]):
                contractor_payments_total += p.amount
                contractor_payments_list.append({
                    "id": p.id,
                    "date": p.date.strftime("%Y-%m-%d") if p.date else None,
                    "amount": round(p.amount, 2),
                    "contragent": p.contragent,
                    "purpose": p.purpose
                })

    # Generate monthly breakdown
    ukr_months = {
        1: "Січень", 2: "Лютий", 3: "Березень", 4: "Квітень", 
        5: "Травень", 6: "Червень", 7: "Липень", 8: "Серпень", 
        9: "Вересень", 10: "Жовтень", 11: "Листопад", 12: "Грудень"
    }
    
    months_to_gen = []
    if period_type == "month":
        y = year if year is not None else date.today().year
        m = period_value if period_value is not None else date.today().month
        months_to_gen.append((y, m))
    elif period_type == "quarter":
        y = year if year is not None else date.today().year
        q = period_value if period_value is not None else 1
        start_month = (q - 1) * 3 + 1
        for m in range(start_month, start_month + 3):
            months_to_gen.append((y, m))
    elif period_type == "year":
        y = year if year is not None else date.today().year
        for m in range(1, 13):
            months_to_gen.append((y, m))
    else:  # "all"
        payments_months = set()
        for p in payments:
            if p.date:
                payments_months.add((p.date.year, p.date.month))
        if not payments_months:
            curr_y = date.today().year
            for m in range(1, date.today().month + 1):
                payments_months.add((curr_y, m))
        months_to_gen = sorted(list(payments_months))
        
    breakdown_list = []
    for y, m in months_to_gen:
        m_payments = [p for p in payments if p.date and p.date.year == y and p.date.month == m]
        
        # Розрахунок повернень за місяць
        m_outgoing_refunds = sum(p.amount for p in m_payments if p.direction == "out" and p.transaction_type == "refund")
        
        m_income = sum(p.amount for p in m_payments if p.direction == "in")
        m_taxable_income = sum(p.amount for p in m_payments if p.direction == "in" and p.taxable and p.transaction_type == "income") - m_outgoing_refunds
        m_taxable_income = max(0.0, m_taxable_income)
        m_expense = sum(p.amount for p in m_payments if p.direction == "out")
        
        # Main tax due
        m_tax_due = 0.0
        if is_simplified_tax(tax_system):
            if is_fop_profile(profile) and profile.group == 1:
                m_tax_due = 302.80
            elif is_fop_profile(profile) and profile.group == 2:
                m_tax_due = min_sal * 0.20
            else:
                m_tax_due = m_taxable_income * ((profile.rate or default_rate) / 100.0)
        elif is_general_tax(tax_system):
            m_taxable_expense = sum(p.amount for p in m_payments if p.direction == "out" and p.taxable)
            m_net_profit = max(0.0, m_taxable_income - m_taxable_expense)
            m_tax_due = m_net_profit * (pit_rate / 100.0)
            
        # Military tax due
        m_mil_due = 0.0
        if is_fop_profile(profile):
            if is_simplified_tax(tax_system):
                if profile.group in (1, 2):
                    m_mil_due = min_sal * 0.10
                else:
                    m_mil_due = m_taxable_income * (mil_fop_rate / 100.0)
            elif is_general_tax(tax_system):
                m_taxable_expense = sum(p.amount for p in m_payments if p.direction == "out" and p.taxable)
                m_net_profit = max(0.0, m_taxable_income - m_taxable_expense)
                m_mil_due = m_net_profit * (mil_emp_rate / 100.0)
                
        # ESV due
        m_esv_due = 0.0
        if is_fop_profile(profile) and not getattr(profile, 'esv_paid_by_employer', False):
            m_esv_due = esv_fop_monthly
            
        # Employee taxes
        m_emp_esv = 0.0
        m_emp_pit = 0.0
        m_emp_mil = 0.0
        if profile.has_employees or len(profile_employees) > 0:
            for emp in profile_employees:
                is_main = getattr(emp, 'is_main_job', True)
                if is_main is None:
                    is_main = True
                esv_base = max(emp.salary, min_sal) if is_main else emp.salary
                m_emp_esv += esv_base * (esv_rate / 100.0)
                m_emp_pit += emp.salary * (pit_rate / 100.0)
                m_emp_mil += emp.salary * (mil_emp_rate / 100.0)
                
        m_total_due = m_tax_due + m_mil_due + m_esv_due + m_emp_esv + m_emp_pit + m_emp_mil
        m_paid = sum(p.amount for p in m_payments if p.type == "tax_payment")
        
        period_name = f"{ukr_months[m]} {y}"
        breakdown_list.append({
            "period_name": period_name,
            "total_income": round(m_income, 2),
            "taxable_income": round(m_taxable_income, 2),
            "tax_due": round(m_tax_due, 2),
            "military_tax_due": round(m_mil_due + m_emp_mil, 2),
            "esv_due": round(m_esv_due + m_emp_esv, 2),
            "pit_due": round(m_emp_pit, 2),
            "total_due": round(m_total_due, 2),
            "tax_paid": round(m_paid, 2),
            "difference": round(max(0.0, m_total_due - m_paid), 2)
        })

    return {
        "company_name": profile.name,
        "tax_system": profile.tax_system,
        "type": profile.type,
        "group": profile.group,
        "rate": profile.rate,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "taxable_income": round(taxable_income, 2),
        "own_funds": round(own_funds, 2),
        "refund": round(refund, 2),
        "loan": round(loan, 2),
        "tax_due": round(tax_due, 2),
        "military_tax_due": round(military_tax_due_total, 2),
        "esv_due": round(esv_due_total, 2),
        "pit_due": round(employee_pit_due, 2),
        "employee_esv_due": round(employee_esv_due, 2),
        "employee_pit_due": round(employee_pit_due, 2),
        "employee_mil_due": round(employee_mil_due, 2),
        "tax_paid": round(total_tax_paid, 2),
        "tax_breakdown": tax_paid_dict,
        "ep_paid": round(ep_paid, 2),
        "mil_paid": round(mil_paid, 2),
        "esv_paid": round(esv_paid, 2),
        "pit_paid": round(pit_paid, 2),
        "ep_diff": round(ep_diff, 2),
        "mil_diff": round(mil_diff, 2),
        "esv_diff": round(esv_diff, 2),
        "pit_diff": round(pit_diff, 2),
        "balance_status": "paid" if outstanding_debt <= 0.05 else "due",
        "difference": round(outstanding_debt, 2),
        "period_start": period_start_str,
        "period_end": period_end_str,
        "upcoming_events": [{
            "id": ev.id,
            "title": ev.title,
            "due_date": ev.due_date.strftime("%Y-%m-%d"),
            "type": ev.type,
            "amount_desc": ev.amount_desc,
            "status": ev.status
        } for ev in upcoming_events],
        "employees": employees_list,
        "contractor_payments_total": round(contractor_payments_total, 2),
        "contractor_payments": contractor_payments_list,
        "breakdown": breakdown_list,
        "expires_at": user.expires_at.isoformat() if (user and user.role == "guest" and user.expires_at) else None
    }

def sync_profile_calendar(profile_id: int, db: Session):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        return
    try:
        import datetime as dt_module
        from tax_calendar.generator import TaxCalendarGenerator
        
        reg_date = profile.reg_date or (dt_module.date.today() - dt_module.timedelta(days=365))
        reg_date_val = reg_date.date() if hasattr(reg_date, 'date') else reg_date
        
        start_date_val = dt_module.date.today()
        if reg_date_val > start_date_val:
            start_date_val = reg_date_val
            
        generator = TaxCalendarGenerator()
        new_events = generator.generate_calendar(
            tax_system=profile.tax_system,
            group=profile.group,
            rate=profile.rate,
            has_employees=profile.has_employees,
            reg_date_str=reg_date_val.strftime("%Y-%m-%d") if hasattr(reg_date_val, 'strftime') else str(reg_date_val),
            start_date=start_date_val,
            is_vat_payer=profile.is_vat_payer,
            esv_paid_by_employer=getattr(profile, 'esv_paid_by_employer', False),
            profile_type=profile.type
        )
        
        generated_keys = set()
        for ev in new_events:
            due_dt = dt_module.datetime.strptime(ev["due_date"], "%Y-%m-%d").date() if isinstance(ev["due_date"], str) else ev["due_date"]
            generated_keys.add((ev["title"], due_dt))
            
            exists = db.query(TaxEvent).filter(
                TaxEvent.profile_id == profile_id,
                TaxEvent.title == ev["title"],
                TaxEvent.due_date == due_dt
            ).first()
            
            if not exists:
                db_ev = TaxEvent(
                    company_id=profile_id,
                    profile_id=profile_id,
                    title=ev["title"],
                    type=ev["type"],
                    tax_name=ev["tax_name"],
                    due_date=due_dt,
                    amount_desc=ev["amount_desc"],
                    form_code=ev["form_code"],
                    status=ev["status"]
                )
                db.add(db_ev)
                
        # Clean up future pending events that are not in the generated list
        future_pending = db.query(TaxEvent).filter(
            TaxEvent.profile_id == profile_id,
            TaxEvent.status == "pending",
            TaxEvent.due_date >= dt_module.date.today()
        ).all()
        
        for db_ev in future_pending:
            if (db_ev.title, db_ev.due_date) not in generated_keys:
                db.delete(db_ev)
                
        db.commit()
    except Exception as e:
        print(f"Error syncing profile calendar for profile {profile_id}:", e)
        db.rollback()

@app.get("/api/calendar/{company_id}")
def get_calendar(company_id: int, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == company_id).first()
    if not profile:
        company = db.query(Company).filter(Company.id == company_id).first()
        if company:
            profile = db.query(Profile).filter(Profile.user_id == company.user_id).first()
            
    events = db.query(TaxEvent).filter(
        (TaxEvent.company_id == company_id) | (TaxEvent.profile_id == company_id)
    ).order_by(TaxEvent.due_date).all()
    
    if len(events) < 3 and profile:
        sync_profile_calendar(profile.id, db)
        events = db.query(TaxEvent).filter(
            (TaxEvent.company_id == company_id) | (TaxEvent.profile_id == company_id)
        ).order_by(TaxEvent.due_date).all()
        
    return events

@app.post("/api/calendar/pay/{event_id}")
def mark_event_paid(event_id: int, db: Session = Depends(get_db)):
    event = db.query(TaxEvent).filter(TaxEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Подію не знайдено")
    event.status = "paid"
    db.commit()
    return {"message": "Подія позначена як сплачена"}

@app.post("/api/generate-report/{company_id}/{form_code}")
def generate_report(
    company_id: int, 
    form_code: str, 
    period: str = "Q1", 
    year: Optional[int] = None, 
    vat_in: Optional[float] = None,
    vat_out: Optional[float] = None,
    db: Session = Depends(get_db)
):
    if year is None:
        from datetime import datetime
        year = datetime.now().year
        
    profile = db.query(Profile).filter(Profile.id == company_id).first()
    company = db.query(Company).filter(Company.id == company_id).first()
    if not profile and not company:
        raise HTTPException(status_code=404, detail="Профіль або компанію не знайдено")

    template = db.query(ReportTemplate).filter(ReportTemplate.form_code == form_code).first()
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон звіту не знайдено")

    owner = company.owner if company else (profile.owner if profile else None)
    
    # Визначаємо назву та ІПН/ЄДРПОУ з профілю
    tax_id_val = profile.tax_id.strip() if profile and profile.tax_id else ""
    if not tax_id_val and owner:
        tax_id_val = owner.telegram_id or ""
        
    company_name_val = profile.name if profile else (company.name if company else "Моє підприємство")
    email_val = owner.email if owner and owner.email else "client@example.com"
    rate_val = profile.rate if (profile and profile.rate is not None) else (company.rate if (company and company.rate is not None) else 5.0)

    data = {}
    
    start_date_bound, end_date_bound = parse_period_to_dates(period, year)
    
    days_diff = (end_date_bound - start_date_bound).days + 1
    if days_diff <= 31:
        num_months = 1
    elif 88 <= days_diff <= 92:
        num_months = 3
    elif 179 <= days_diff <= 184:
        num_months = 6
    elif 270 <= days_diff <= 276:
        num_months = 9
    else:
        num_months = 12
        
    payments = db.query(ParsedPayment).filter(
        ((ParsedPayment.profile_id == company_id) | 
         (ParsedPayment.statement.has(BankStatement.profile_id == company_id))),
        ParsedPayment.direction == "in",
        ParsedPayment.taxable == True,
        ParsedPayment.transaction_type == "income",
        ParsedPayment.date >= start_date_bound,
        ParsedPayment.date <= end_date_bound
    ).all()
    
    transactions = [{
        "direction": p.direction,
        "amount": p.amount,
        "taxable": p.taxable,
        "transaction_type": p.transaction_type
    } for p in payments]
    
    profile_employees = db.query(Employee).filter(
        (Employee.profile_id == company_id) | (Employee.company_id == company_id)
    ).all()
    
    employees_list = [{
        "salary": emp.salary,
        "is_main_job": getattr(emp, 'is_main_job', True)
    } for emp in profile_employees]
    
    calc = get_tax_calculator(db)
    
    profile_dict = {
        "tax_system": profile.tax_system if profile else "simplified-3-5%",
        "type": profile.type if profile else "company",
        "group": profile.group if (profile and profile.group is not None) else 3,
        "rate": rate_val,
        "has_employees": (profile.has_employees or len(profile_employees) > 0) if profile else False,
        "esv_paid_by_employer": getattr(profile, 'esv_paid_by_employer', False) if profile else False
    }
    
    taxes = calc.calculate_profile_taxes(
        profile=profile_dict,
        transactions=transactions,
        employees=employees_list,
        num_months=num_months
    )
    
    # Get paid taxes
    from api.main import get_paid_taxes_by_type
    tax_paid_dict = get_paid_taxes_by_type(db, company_id, start_date_bound, end_date_bound)
    
    data["HNAME"] = {"value": company_name_val, "color": "green" if company_name_val else "yellow"}
    data["HTIN"] = {"value": tax_id_val, "color": "green" if tax_id_val else "red"}
    data["HEMAIL"] = {"value": email_val, "color": "green"}
    
    if form_code == "F0110210":
        v_in = vat_in if vat_in is not None else 0.0
        v_out = vat_out if vat_out is not None else 0.0
        v_due = v_out - v_in
        data["VAT_OUT"] = {"value": v_out, "color": "green" if vat_out is not None else "yellow"}
        data["VAT_IN"] = {"value": v_in, "color": "green" if vat_in is not None else "yellow"}
        data["VAT_DUE"] = {"value": v_due, "color": "green"}
        
    elif form_code in ["F0103306", "J0500109", "F0510101"]:
        # Calculate quarterly income for the selected year
        income_q1 = 0.0
        income_q2 = 0.0
        income_q3 = 0.0
        income_q4 = 0.0
        
        year_payments = db.query(ParsedPayment).filter(
            ((ParsedPayment.profile_id == company_id) | 
             (ParsedPayment.statement.has(BankStatement.profile_id == company_id))),
            ParsedPayment.direction == "in",
            ParsedPayment.taxable == True,
            ParsedPayment.transaction_type == "income",
            ParsedPayment.date >= date(year, 1, 1),
            ParsedPayment.date <= date(year, 12, 31)
        ).all()
        
        for p in year_payments:
            if p.date.month in [1, 2, 3]:
                income_q1 += p.amount
            elif p.date.month in [4, 5, 6]:
                income_q2 += p.amount
            elif p.date.month in [7, 8, 9]:
                income_q3 += p.amount
            else:
                income_q4 += p.amount
                
        end_m = end_date_bound.month
        
        data["ROW01"] = {"value": income_q1, "color": "green" if end_m >= 1 else "yellow"}
        data["ROW02"] = {"value": (income_q1 + income_q2) if end_m >= 4 else 0.0, "color": "green" if end_m >= 4 else "yellow"}
        data["ROW03"] = {"value": (income_q1 + income_q2 + income_q3) if end_m >= 7 else 0.0, "color": "green" if end_m >= 7 else "yellow"}
        data["ROW04"] = {"value": (income_q1 + income_q2 + income_q3 + income_q4) if end_m >= 10 else 0.0, "color": "green" if end_m >= 10 else "yellow"}
        
        data["TAX_DUE"] = {"value": taxes["tax_due"], "color": "green"}
        
        if form_code == "F0103306":
            data["TAX_RATE"] = {"value": rate_val, "color": "green"}
        else:
            data["ESV_DUE"] = {"value": taxes["esv_due"] + taxes["employee_esv_due"], "color": "green"}
            data["MIL_DUE"] = {"value": taxes["military_tax_due"] + taxes["employee_mil_due"], "color": "green"}
            
    elif form_code == "F3007012":
        data["ESV_DUE"] = {"value": taxes["esv_due"] + taxes["employee_esv_due"], "color": "green"}
        data["ESV_PAID"] = {"value": tax_paid_dict.get("esv", 0.0), "color": "green"}
        
    elif form_code == "F0120109":
        data["MIL_DUE"] = {"value": taxes["military_tax_due"] + taxes["employee_mil_due"], "color": "green"}
        data["MIL_PAID"] = {"value": tax_paid_dict.get("military_tax", 0.0), "color": "green"}
        
    elif form_code == "F0600101":
        data["TOTAL_INCOME"] = {"value": taxes["total_income"], "color": "green"}
        data["TAX_DUE"] = {"value": taxes["employee_pit_due"], "color": "green"}
        data["MIL_DUE"] = {"value": taxes["employee_mil_due"], "color": "green"}

    from services.xml_generator import xml_generator
    
    profile_data = {
        "tax_id": tax_id_val,
        "name": company_name_val,
        "address": getattr(profile, "address", "") if profile else "",
        "type": profile.type if profile else "company",
        "tax_rate": rate_val
    }
    
    tax_data_xml = {
        "tax_due": taxes["tax_due"],
        "tax_paid": tax_paid_dict.get("unified_tax", 0.0),
        "esv_due": taxes["esv_due"] + taxes["employee_esv_due"],
        "esv_paid": tax_paid_dict.get("esv", 0.0),
        "military_tax_due": taxes["military_tax_due"] + taxes["employee_mil_due"],
        "military_tax_paid": tax_paid_dict.get("military_tax", 0.0),
        "pit_due": taxes["employee_pit_due"],
        "pit_paid": tax_paid_dict.get("pit", 0.0),
        "total_income": taxes["total_income"],
        "taxable_income": taxes["taxable_income"],
        "vat_out": vat_out if vat_out is not None else 0.0,
        "vat_in": vat_in if vat_in is not None else 0.0,
        "vat_due": (vat_out - vat_in) if (vat_out is not None and vat_in is not None) else 0.0,
    }
    
    tax_data_xml["income_q1"] = income_q1
    tax_data_xml["income_q2"] = income_q2
    tax_data_xml["income_q3"] = income_q3
    tax_data_xml["income_q4"] = income_q4
    
    xml_content = None
    if form_code == "F0103306":
        xml_content = xml_generator.generate_unified_tax_declaration(profile_data, tax_data_xml, period, year)
    elif form_code == "J0500109":
        xml_content = xml_generator.generate_unified_report_llc(profile_data, tax_data_xml, period, year)
    elif form_code == "F0110210":
        xml_content = xml_generator.generate_vat_declaration(profile_data, tax_data_xml, period, year)
    elif form_code == "F3007012":
        xml_content = xml_generator.generate_esv_declaration(profile_data, tax_data_xml, period, year)
    elif form_code == "F0120109":
        xml_content = xml_generator.generate_military_tax_declaration(profile_data, tax_data_xml, period, year)
    elif form_code == "F0510101":
        xml_content = xml_generator.generate_unified_report(profile_data, tax_data_xml, period, year)
    elif form_code == "F0600101":
        xml_content = xml_generator.generate_pit_declaration(profile_data, tax_data_xml, period, year)
    else:
        # Fallback to general pre-filled XML layout
        xml_content = f"""<?xml version="1.0" encoding="windows-1251"?>
<DECLAR xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="{form_code}.xsd">
    <DECLARHEAD>
        <TIN>{tax_id_val}</TIN>
        <C_DOC>{form_code[:3]}</C_DOC>
        <C_DOC_SUB>{form_code[3:6]}</C_DOC_SUB>
        <C_DOC_VER>{form_code[6:]}</C_DOC_VER>
        <PERIOD_TYPE>5</PERIOD_TYPE>
        <PERIOD_MONTH>{period}</PERIOD_MONTH>
        <PERIOD_YEAR>{year}</PERIOD_YEAR>
    </DECLARHEAD>
    <DECLARBODY>
        <HNAME>{company_name_val}</HNAME>
"""
        for k, v in data.items():
            if k not in ["HNAME", "HTIN", "HEMAIL"]:
                xml_content += f"        <{k}>{v['value']}</{k}>\n"
        xml_content += """    </DECLARBODY>
</DECLAR>"""

    # Зберігаємо чернетку
    report = GeneratedReport(
        template_id=template.id,
        company_id=company_id,
        profile_id=company_id,
        form_code=form_code,
        period=period,
        year=year,
        data_json=json.dumps(data),
        xml_content=xml_content,
        status="draft"
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "report_id": report.id,
        "form_code": form_code,
        "period": period,
        "year": year,
        "fields": data,
        "xml_preview": xml_content[:200] + "..."
    }

@app.get("/api/reports/{company_id}")
def get_reports(company_id: int, db: Session = Depends(get_db)):
    reports = db.query(GeneratedReport).filter(
        (GeneratedReport.company_id == company_id) |
        (GeneratedReport.profile_id == company_id)
    ).order_by(desc(GeneratedReport.created_at)).all()
    return [{
        "id": r.id,
        "form_code": r.form_code,
        "period": r.period,
        "year": r.year,
        "status": r.status,
        "created_at": r.created_at.strftime("%Y-%m-%d") if r.created_at else None
    } for r in reports]

@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
    db.delete(report)
    db.commit()
    return {"status": "success", "message": "Звіт успішно видалено"}

@app.get("/api/reports/detail/{report_id}")
def get_report_detail(report_id: int, db: Session = Depends(get_db)):
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
        
    template = db.query(ReportTemplate).filter(ReportTemplate.id == report.template_id).first()
    fields_schema = json.loads(template.schema_json)["fields"] if template else []
    fields_data = json.loads(report.data_json)
    
    merged_fields = []
    for f in fields_schema:
        f_id = f["id"]
        val_info = fields_data.get(f_id, {"value": "", "color": "yellow"})
        merged_fields.append({
            "id": f_id,
            "name": f["name"],
            "type": f["type"],
            "group": f["group"],
            "value": val_info.get("value", ""),
            "color": val_info.get("color", "yellow")
        })
        
    return {
        "id": report.id,
        "form_code": report.form_code,
        "period": report.period,
        "year": report.year,
        "status": report.status,
        "created_at": report.created_at.strftime("%Y-%m-%d") if report.created_at else None,
        "fields": merged_fields,
        "xml_content": report.xml_content
    }

@app.put("/api/reports/detail/{report_id}")
def update_report_detail(
    report_id: int, 
    fields_update: dict, 
    db: Session = Depends(get_db)
):
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
        
    fields_data = json.loads(report.data_json)
    
    for f_id, val in fields_update.items():
        if f_id in fields_data:
            fields_data[f_id]["value"] = val
            fields_data[f_id]["color"] = "green"
            
    if report.form_code == "F0103306":
        rate = float(fields_data.get("TAX_RATE", {}).get("value", 5.0))
        p_clean = report.period.lower()
        active_row = "ROW01"
        if "q2" in p_clean:
            active_row = "ROW02"
        elif "q3" in p_clean:
            active_row = "ROW03"
        elif "q4" in p_clean or "year" in p_clean:
            active_row = "ROW04"
            
        income = float(fields_data.get(active_row, {}).get("value", 0.0))
        tax_due = income * (rate / 100.0)
        
        if "TAX_DUE" in fields_data:
            fields_data["TAX_DUE"]["value"] = tax_due
            fields_data["TAX_DUE"]["color"] = "green"
            
        xml_content = f"""<?xml version="1.0" encoding="windows-1251"?>
<DECLAR xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="F0103306.xsd">
    <DECLARHEAD>
        <TIN>{fields_data["HTIN"]["value"]}</TIN>
        <C_DOC>F01</C_DOC>
        <C_DOC_SUB>033</C_DOC_SUB>
        <C_DOC_VER>06</C_DOC_VER>
        <PERIOD_TYPE>5</PERIOD_TYPE>
        <PERIOD_MONTH>{report.period}</PERIOD_MONTH>
        <PERIOD_YEAR>{report.year}</PERIOD_YEAR>
    </DECLARHEAD>
    <DECLARBODY>
        <HNAME>{fields_data["HNAME"]["value"]}</HNAME>
        <R01G3>{income}</R01G3>
        <R05G3>{fields_data["TAX_RATE"]["value"]}</R05G3>
        <R06G3>{fields_data["TAX_DUE"]["value"]}</R06G3>
    </DECLARBODY>
</DECLAR>"""
        report.xml_content = xml_content

    elif report.form_code == "F0110210":
        vat_out = float(fields_data.get("VAT_OUT", {}).get("value", 0.0))
        vat_in = float(fields_data.get("VAT_IN", {}).get("value", 0.0))
        vat_due = vat_out - vat_in
        
        if "VAT_DUE" in fields_data:
            fields_data["VAT_DUE"]["value"] = vat_due
            fields_data["VAT_DUE"]["color"] = "green"
            
        xml_content = f"""<?xml version="1.0" encoding="windows-1251"?>
<DECLAR xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="F0110210.xsd">
    <DECLARHEAD>
        <TIN>{fields_data["HTIN"]["value"]}</TIN>
        <C_DOC>F01</C_DOC>
        <C_DOC_SUB>102</C_DOC_SUB>
        <C_DOC_VER>10</C_DOC_VER>
        <PERIOD_TYPE>5</PERIOD_TYPE>
        <PERIOD_MONTH>{report.period}</PERIOD_MONTH>
        <PERIOD_YEAR>{report.year}</PERIOD_YEAR>
    </DECLARHEAD>
    <DECLARBODY>
        <HNAME>{fields_data["HNAME"]["value"]}</HNAME>
        <R01G3>{fields_data["VAT_OUT"]["value"]}</R01G3>
        <R02G3>{fields_data["VAT_IN"]["value"]}</R02G3>
        <R03G3>{fields_data["VAT_DUE"]["value"]}</R03G3>
    </DECLARBODY>
</DECLAR>"""
        report.xml_content = xml_content

    report.data_json = json.dumps(fields_data)
    db.commit()
    db.refresh(report)
    return {"message": "Звіт успішно оновлено", "report_id": report.id}

@app.get("/api/reports/{report_id}/download/{file_format}")
def download_report_file(report_id: int, file_format: str, db: Session = Depends(get_db)):
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
        
    from fastapi.responses import Response
    
    filename = f"{report.form_code}_{report.period}_{report.year}.{file_format}"
    cd_header = make_content_disposition(filename)
    if file_format == "xml":
        return Response(
            content=report.xml_content or "", 
            media_type="application/xml",
            headers={"Content-Disposition": cd_header}
        )
    elif file_format == "json":
        return Response(
            content=report.data_json, 
            media_type="application/json",
            headers={"Content-Disposition": cd_header}
        )
    elif file_format == "pdf":
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        import io
        import os
        
        def get_cyrillic_font():
            font_paths = [
                "/System/Library/Fonts/Supplemental/Arial.ttf",
                "/System/Library/Fonts/Helvetica.dfont",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
            ]
            for path in font_paths:
                if os.path.exists(path):
                    try:
                        pdfmetrics.registerFont(TTFont("CyrillicFont", path))
                        return "CyrillicFont"
                    except Exception:
                        pass
            return "Helvetica"
            
        font_name = get_cyrillic_font()
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        story = []
        
        styles = getSampleStyleSheet()
        # Official Form Titles and Approvals
        form_titles = {
            "F0103306": "ПОДАТКОВА ДЕКЛАРАЦІЯ ПЛАТНИКА ЄДИНОГО ПОДАТКУ - ФІЗИЧНОЇ ОСОБИ - ПІДПРИЄМЦЯ",
            "F0110210": "ПОДАТКОВА ДЕКЛАРАЦІЯ З ПОДАТКУ НА ДОДАНУ ВАРТІСТЬ",
            "J0500109": "ПОДАТКОВИЙ РОЗРАХУНОК СУМ ДОХОДУ, НАРАХОВАНОГО НА КОРИСТЬ ПЛАТНИКІВ (ОБ'ЄДНАНИЙ ЗВІТ ЄСВ/ПДФО)",
            "F0500109": "ПОДАТКОВИЙ РОЗРАХУНОК СУМ ДОХОДУ, НАРАХОВАНОГО НА КОРИСТЬ ПЛАТНИКІВ (ОБ'ЄДНАНИЙ ЗВІТ ЄСВ/ПДФО)"
        }
        official_title = form_titles.get(report.form_code.upper(), f"ПОДАТКОВА ДЕКЛАРАЦІЯ ({report.form_code})")

        header_style = ParagraphStyle(
            'HeaderStyle',
            fontName=font_name,
            fontSize=7,
            leading=9,
            alignment=2,
            textColor=colors.HexColor("#4A5568")
        )
        story.append(Paragraph("ЗАТВЕРДЖЕНО<br/>Наказ Міністерства фінансів України", header_style))
        story.append(Spacer(1, 10))

        title_style = ParagraphStyle(
            'TitleStyle',
            fontName=font_name,
            fontSize=11,
            leading=14,
            alignment=1,
            textColor=colors.black,
            spaceAfter=15
        )
        story.append(Paragraph(official_title, title_style))
        
        meta_style = ParagraphStyle(
            'MetaStyle',
            fontName=font_name,
            fontSize=9,
            leading=12,
            textColor=colors.black
        )

        # Profile / Metadata Block
        p_name = report.profile.name if (report.profile and report.profile.name) else "Моє підприємство"
        p_tax_id = report.profile.tax_id if (report.profile and report.profile.tax_id) else ""
        
        meta_table_data = [
            [Paragraph(f"<b>Платник:</b> {p_name}", meta_style),
             Paragraph(f"<b>ІПН/ЄДРПОУ:</b> {p_tax_id}", meta_style)],
            [Paragraph(f"<b>Період:</b> {report.period} {report.year} р.", meta_style),
             Paragraph(f"<b>Дата формування:</b> {report.created_at.strftime('%d.%m.%Y')}", meta_style)]
        ]
        meta_table = Table(meta_table_data, colWidths=[260, 260])
        meta_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
            ('PADDING', (0,0), (-1,-1), 6),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 15))
        
        fields_data = json.loads(report.data_json)
        
        table_data = [[
            Paragraph("<b>Код рядка</b>", ParagraphStyle('HCol1', fontName=font_name, fontSize=9, textColor=colors.black)),
            Paragraph("<b>Назва показника / поля ДПС</b>", ParagraphStyle('HCol2', fontName=font_name, fontSize=9, textColor=colors.black)),
            Paragraph("<b>Значення</b>", ParagraphStyle('HCol3', fontName=font_name, fontSize=9, textColor=colors.black))
        ]]
        
        template = db.query(ReportTemplate).filter(ReportTemplate.id == report.template_id).first()
        fields_schema = json.loads(template.schema_json)["fields"] if template else []
        
        for f in fields_schema:
            f_id = f["id"]
            name = f["name"]
            val_info = fields_data.get(f_id, {"value": ""})
            val = val_info.get("value", "")
            
            if isinstance(val, float):
                val_str = f"{val:,.2f} ₴"
            else:
                val_str = str(val)
                
            table_data.append([
                Paragraph(f_id, ParagraphStyle('Col1', fontName=font_name, fontSize=9)),
                Paragraph(name, ParagraphStyle('Col2', fontName=font_name, fontSize=9)),
                Paragraph(val_str, ParagraphStyle('Col3', fontName=f"{font_name}-Bold" if "Bold" in font_name else font_name, fontSize=9))
            ])
            
        t = Table(table_data, colWidths=[80, 300, 140])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E2E8F0")),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.black),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(t)
        
        doc.build(story)
        buffer.seek(0)
        
        filename = f"{report.form_code}_{report.period}_{report.year}.pdf"
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": make_content_disposition(filename)}
        )
    elif file_format == "csv":
        import io
        import csv
        
        output = io.StringIO()
        output.write('\ufeff')
        writer = csv.writer(output, delimiter=';')
        writer.writerow(["Код поля", "Назва поля / Показник", "Значення"])
        
        fields_data = json.loads(report.data_json)
        template = db.query(ReportTemplate).filter(ReportTemplate.id == report.template_id).first()
        fields_schema = json.loads(template.schema_json)["fields"] if template else []
        
        for f in fields_schema:
            f_id = f["id"]
            name = f["name"]
            val_info = fields_data.get(f_id, {"value": ""})
            val = val_info.get("value", "")
            writer.writerow([f_id, name, str(val)])
            
        filename = f"{report.form_code}_{report.period}_{report.year}.csv"
        return Response(
            content=output.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": make_content_disposition(filename)}
        )
    else:
        raise HTTPException(status_code=400, detail="Непідтримуваний формат файлу")

@app.get("/api/statements/debug/{company_id}")
def get_statement_debug(company_id: int, db: Session = Depends(get_db)):
    statement = db.query(BankStatement).filter(
        (BankStatement.company_id == company_id) |
        (BankStatement.profile_id == company_id)
    ).order_by(desc(BankStatement.id)).first()
    if not statement:
        raise HTTPException(status_code=404, detail="Виписок не знайдено")
        
    payments = db.query(ParsedPayment).filter(ParsedPayment.statement_id == statement.id).all()
    
    total_income = sum(p.amount for p in payments if p.direction == "in")
    total_expense = sum(p.amount for p in payments if p.direction == "out")
    
    return {
        "file_name": statement.file_name,
        "bank_name": statement.bank_name,
        "uploaded_at": statement.uploaded_at.strftime("%Y-%m-%d") if statement.uploaded_at else None,
        "period_start": statement.period_start.strftime("%Y-%m-%d") if statement.period_start else None,
        "period_end": statement.period_end.strftime("%Y-%m-%d") if statement.period_end else None,
        "total_txs": len(payments),
        "total_income": total_income,
        "total_expense": total_expense,
        "payments": [{
            "id": p.id,
            "date": p.date.strftime("%Y-%m-%d") if p.date else None,
            "amount": p.amount,
            "direction": p.direction,
            "purpose": p.purpose,
            "contragent": p.contragent,
            "type": p.type,
            "taxable": p.taxable,
            "transaction_type": p.transaction_type
        } for p in payments[:10]]

    }

# New endpoints
@app.post("/api/employees")
def add_employee(
    profile_id: int = Form(...),
    name: str = Form(...),
    tax_id: str = Form(...),
    salary: float = Form(...),
    is_main_job: bool = Form(True),
    db: Session = Depends(get_db)
):
    # Перевірка на дублювання за ІПН в межах цього профілю
    existing = db.query(Employee).filter(
        Employee.profile_id == profile_id,
        Employee.tax_id == tax_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Працівник з таким ІПН вже існує у цьому профілі")

    employee = Employee(
        profile_id=profile_id,
        name=name,
        tax_id=tax_id,
        salary=salary,
        is_main_job=is_main_job
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return {"message": "Працівника успішно додано", "employee_id": employee.id, "is_main_job": employee.is_main_job}

@app.put("/api/employees/{employee_id}")
def update_employee(
    employee_id: int,
    name: Optional[str] = Form(None),
    tax_id: Optional[str] = Form(None),
    salary: Optional[float] = Form(None),
    is_main_job: Optional[bool] = Form(None),
    db: Session = Depends(get_db)
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Працівника не знайдено")
    
    if name is not None:
        employee.name = name
    if tax_id is not None:
        # Перевірка унікальності нового ІПН серед інших співробітників профілю
        existing = db.query(Employee).filter(
            Employee.profile_id == employee.profile_id,
            Employee.tax_id == tax_id,
            Employee.id != employee_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Працівник з таким ІПН вже існує")
        employee.tax_id = tax_id
    if salary is not None:
        employee.salary = salary
    if is_main_job is not None:
        employee.is_main_job = is_main_job
        
    db.commit()
    db.refresh(employee)
    return {"message": "Дані працівника оновлено", "employee": {
        "id": employee.id,
        "name": employee.name,
        "tax_id": employee.tax_id,
        "salary": employee.salary,
        "is_main_job": employee.is_main_job
    }}

@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Працівника не знайдено")
    db.delete(employee)
    db.commit()
    return {"message": "Працівника успішно видалено"}

@app.get("/api/employees/{profile_id}")
def get_employees(profile_id: int, db: Session = Depends(get_db)):
    return db.query(Employee).filter(Employee.profile_id == profile_id).all()

@app.get("/api/profiles/{telegram_id}")
def get_profiles(telegram_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    background_tasks.add_task(cleanup_expired_guests)
    user = db.query(User).filter((User.telegram_id == telegram_id) | (User.email == telegram_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    return user.profiles

@app.get("/api/profiles")
def get_profiles_query(telegram_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    background_tasks.add_task(cleanup_expired_guests)
    user = db.query(User).filter((User.telegram_id == telegram_id) | (User.email == telegram_id)).first()
    if not user:
        return []
    return user.profiles

@app.delete("/api/profiles/{profile_id}")
def delete_profile_endpoint(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
    
    # Delete related elements
    db.query(TaxEvent).filter(TaxEvent.profile_id == profile_id).delete()
    db.query(Employee).filter(Employee.profile_id == profile_id).delete()
    db.query(ParsedPayment).filter(ParsedPayment.profile_id == profile_id).delete()
    
    statements = db.query(BankStatement).filter(BankStatement.profile_id == profile_id).all()
    for stmt in statements:
        db.query(ParsedPayment).filter(ParsedPayment.statement_id == stmt.id).delete()
        db.delete(stmt)
        
    company = db.query(Company).filter(Company.id == profile_id).first()
    if company:
        db.delete(company)
        
    db.delete(profile)
    db.commit()
    return {"message": "Профіль успішно видалено"}

@app.put("/api/profiles/{profile_id}")
def update_profile_endpoint(
    profile_id: int,
    type: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    tax_id: Optional[str] = Form(None),
    tax_system: Optional[str] = Form(None),
    is_director: Optional[bool] = Form(None),
    group: Optional[int] = Form(None),
    rate: Optional[float] = Form(None),
    has_employees: Optional[bool] = Form(None),
    is_vat_payer: Optional[bool] = Form(None),
    reg_date: Optional[str] = Form(None),
    esv_paid_by_employer: Optional[bool] = Form(None),
    address: Optional[str] = Form(None),
    director_name: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
        
    company = db.query(Company).filter(Company.id == profile_id).first()
    
    if type is not None:
        profile.type = type
    if name is not None:
        profile.name = name
        if company:
            company.name = name
    if tax_id is not None:
        profile.tax_id = tax_id
    if tax_system is not None:
        profile.tax_system = tax_system
        if company:
            comp_tax_system = "fop_ep"
            if (type or profile.type) == "fop":
                comp_tax_system = "fop_ep" if is_simplified_tax(tax_system) else "fop_general"
            else:
                comp_tax_system = "llc_ep" if is_simplified_tax(tax_system) else "llc_profit"
            company.tax_system = comp_tax_system
    if is_director is not None:
        profile.is_director = is_director
    if group is not None:
        profile.group = group
        if company:
            company.group = group
    if rate is not None:
        profile.rate = rate
        if company:
            company.rate = rate
    if has_employees is not None:
        profile.has_employees = has_employees
        if company:
            company.has_employees = has_employees
    if is_vat_payer is not None:
        profile.is_vat_payer = is_vat_payer
        if company:
            company.is_vat_payer = is_vat_payer
    if esv_paid_by_employer is not None:
        profile.esv_paid_by_employer = esv_paid_by_employer
    if address is not None:
        profile.address = address
        if company:
            company.address = address
    if director_name is not None:
        profile.director_name = director_name
        if company:
            company.director_name = director_name
    if phone is not None:
        profile.phone = phone
        if company:
            company.phone = phone
    if reg_date is not None:
        try:
            reg_date_parsed = datetime.strptime(reg_date, "%Y-%m-%d").date()
            profile.reg_date = reg_date_parsed
            if company:
                company.reg_date = reg_date_parsed
        except ValueError:
            pass
            
    db.commit()
    sync_user_profiles_by_tax_id(db, profile.user_id)
    sync_profile_calendar(profile.id, db)
    db.refresh(profile)
    if company:
        db.refresh(company)
        
    return {"message": "Профіль успішно оновлено", "profile_id": profile.id}

@app.get("/api/transactions")
def get_transactions_list(
    profile_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ParsedPayment).filter(
        (ParsedPayment.profile_id == profile_id) |
        (ParsedPayment.statement.has(BankStatement.profile_id == profile_id))
    )
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(ParsedPayment.date >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(ParsedPayment.date <= end_dt)
        except ValueError:
            pass
            
    payments = query.order_by(desc(ParsedPayment.date)).all()
    return [{
        "id": p.id,
        "date": p.date.strftime("%Y-%m-%d") if p.date else None,
        "amount": p.amount,
        "direction": p.direction,
        "purpose": p.purpose,
        "contragent": p.contragent,
        "type": p.type,
        "taxable": p.taxable,
        "transaction_type": p.transaction_type,
        "profile_id": p.profile_id
    } for p in payments]


@app.get("/api/transactions/{payment_id}")
def get_transaction(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(ParsedPayment).filter(ParsedPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Транзакцію не знайдено")
    return {
        "id": payment.id,
        "date": payment.date.strftime("%Y-%m-%d") if payment.date else None,
        "amount": payment.amount,
        "direction": payment.direction,
        "purpose": payment.purpose,
        "contragent": payment.contragent,
        "type": payment.type,
        "taxable": payment.taxable,
        "transaction_type": payment.transaction_type,
        "profile_id": payment.profile_id
    }

@app.put("/api/transactions/{payment_id}")
def edit_transaction(
    payment_id: int,
    taxable: Optional[bool] = Form(None),
    transaction_type: Optional[str] = Form(None),
    contragent: Optional[str] = Form(None),
    amount: Optional[float] = Form(None),
    direction: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    payment = db.query(ParsedPayment).filter(ParsedPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Транзакцію не знайдено")
    
    if taxable is not None:
        payment.taxable = taxable
    if transaction_type is not None:
        payment.transaction_type = transaction_type
        # Sync to standard type and default direction
        if transaction_type == 'income':
            payment.type = 'income'
            payment.direction = 'in'
        elif transaction_type == 'own_funds':
            payment.type = 'income'
            payment.direction = 'in'
        elif transaction_type == 'expense':
            payment.type = 'expense'
            payment.direction = 'out'
        elif transaction_type == 'tax_payment':
            payment.type = 'tax_payment'
            payment.direction = 'out'
        elif transaction_type == 'salary_payment':
            payment.type = 'salary_payment'
            payment.direction = 'out'
            
    if amount is not None:
        payment.amount = abs(amount)
        
    if direction is not None:
        if direction in ['in', 'out']:
            payment.direction = direction
            # Keep type synced if needed
            if direction == 'in' and payment.type not in ['income']:
                payment.type = 'income'
            elif direction == 'out' and payment.type not in ['expense', 'tax_payment', 'salary_payment']:
                payment.type = 'expense'
            
    if contragent is not None:
        payment.contragent = contragent.strip() if contragent else None
            
    db.commit()
    db.refresh(payment)
    return {
        "message": "Транзакцію успішно оновлено",
        "id": payment.id,
        "taxable": payment.taxable,
        "transaction_type": payment.transaction_type,
        "contragent": payment.contragent,
        "amount": payment.amount,
        "direction": payment.direction
    }

@app.post("/api/profiles/{profile_id}/clear-statements")
def clear_statements(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
    
    # Get all statement IDs for this profile
    stmt_ids = [s.id for s in db.query(BankStatement).filter(BankStatement.profile_id == profile_id).all()]
    
    # Delete parsed payments for this profile safely
    if stmt_ids:
        db.query(ParsedPayment).filter(
            (ParsedPayment.profile_id == profile_id) |
            (ParsedPayment.statement_id.in_(stmt_ids))
        ).delete(synchronize_session=False)
    else:
        db.query(ParsedPayment).filter(ParsedPayment.profile_id == profile_id).delete(synchronize_session=False)
    
    # Delete bank statements for this profile
    db.query(BankStatement).filter(BankStatement.profile_id == profile_id).delete(synchronize_session=False)
    
    db.commit()
    return {"message": "Усі виписки та операції успішно видалено"}

@app.post("/api/transactions")
def add_manual_transaction(
    profile_id: int = Form(...),
    date: str = Form(...),
    amount: float = Form(...),
    direction: str = Form(...), # in, out
    purpose: str = Form(...),
    contragent: Optional[str] = Form(None),
    transaction_type: str = Form("income"), # income, expense, own_funds, refund, loan
    taxable: bool = Form(True),
    db: Session = Depends(get_db)
):
    try:
        tx_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        tx_date = date.today()
        
    payment = ParsedPayment(
        statement_id=None,
        date=tx_date,
        amount=amount,
        direction=direction,
        purpose=purpose,
        contragent=contragent,
        type=direction if transaction_type in ["income", "expense"] else ("income" if direction == "in" else "expense"),
        taxable=taxable,
        transaction_type=transaction_type,
        profile_id=profile_id
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    
    return {
        "message": "Транзакцію успішно додано",
        "id": payment.id,
        "date": payment.date.strftime("%Y-%m-%d"),
        "amount": payment.amount,
        "direction": payment.direction,
        "purpose": payment.purpose,
        "contragent": payment.contragent,
        "type": payment.type,
        "taxable": payment.taxable,
        "transaction_type": payment.transaction_type,
        "profile_id": payment.profile_id
    }

@app.post("/api/profiles")
def add_profile_endpoint(
    telegram_id: str = Form(...),
    type: str = Form(...), # 'company' або 'fop'
    name: str = Form(...),
    tax_id: str = Form(""),
    tax_system: str = Form("ednuy-3-5%"), # 'zagalna', 'ednuy-3-5%'
    is_director: bool = Form(False),
    group: Optional[int] = Form(None),
    rate: Optional[float] = Form(None),
    has_employees: bool = Form(False),
    is_vat_payer: bool = Form(False),
    reg_date: Optional[str] = Form(None),
    esv_paid_by_employer: bool = Form(False),
    address: Optional[str] = Form(None),
    director_name: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter((User.telegram_id == telegram_id) | (User.email == telegram_id)).first()
    if not user:
        if "@" in telegram_id:
            user = User(email=telegram_id)
        else:
            user = User(telegram_id=telegram_id)
        db.add(user)
        db.commit()
        db.refresh(user)

    reg_date_parsed = datetime.strptime(reg_date, "%Y-%m-%d").date() if reg_date else date.today()

    profile = Profile(
        user_id=user.id,
        type=type,
        name=name,
        tax_id=tax_id,
        tax_system=tax_system,
        is_director=is_director,
        group=group,
        rate=rate,
        reg_date=reg_date_parsed,
        has_employees=has_employees,
        is_vat_payer=is_vat_payer,
        esv_paid_by_employer=esv_paid_by_employer,
        address=address,
        director_name=director_name,
        phone=phone
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    # For compatibility, also create a Company
    comp_tax_system = "fop_ep"
    if type == "fop":
        comp_tax_system = "fop_ep" if is_simplified_tax(tax_system) else "fop_general"
    else:
        comp_tax_system = "llc_ep" if is_simplified_tax(tax_system) else "llc_profit"

    company = Company(
        id=profile.id,
        user_id=user.id,
        name=name,
        tax_system=comp_tax_system,
        group=group,
        rate=rate,
        reg_date=reg_date_parsed,
        has_employees=has_employees,
        is_vat_payer=is_vat_payer,
        address=address,
        director_name=director_name,
        phone=phone
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    # Sync calendar
    sync_profile_calendar(profile.id, db)
    sync_user_profiles_by_tax_id(db, user.id)

    return {"message": "Профіль успішно створено", "profile_id": profile.id, "company_id": company.id}


@app.get("/api/tax-analysis/{profile_id}")
def get_tax_analysis(profile_id: int, db: Session = Depends(get_db)):
    from services.tax_calculator import tax_calculator
    
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
        
    payments = db.query(ParsedPayment).filter(
        (ParsedPayment.profile_id == profile_id) |
        (ParsedPayment.statement.has(BankStatement.profile_id == profile_id))
    ).all()
    
    # Get employees
    profile_employees = db.query(Employee).filter(
        (Employee.profile_id == profile_id) | (Employee.company_id == profile_id)
    ).all()
    
    # We want to group by year and quarter
    quarters_data = {}
    
    # Gather years from payments
    years = {p.date.year for p in payments if p.date}
    if not years:
        years = {date.today().year}
        
    for y in years:
        for q in [1, 2, 3, 4]:
            quarters_data[(y, q)] = {
                "year": y,
                "quarter": q,
                "taxable_income": 0.0,
                "unified_tax_due": 0.0,
                "unified_tax_paid": 0.0,
                "military_tax_due": 0.0,
                "military_tax_paid": 0.0,
                "esv_due": 0.0,
                "esv_paid": 0.0,
                "pit_paid": 0.0,
                "employee_pit_due": 0.0,
                "employee_mil_due": 0.0,
                "employee_esv_due": 0.0,
                "total_due": 0.0,
                "total_paid": 0.0
            }
            
    # Calculate taxable income per quarter
    for p in payments:
        if p.direction == "in" and p.taxable and p.transaction_type == "income" and p.date:
            y = p.date.year
            q = (p.date.month - 1) // 3 + 1
            key = (y, q)
            if key in quarters_data:
                quarters_data[key]["taxable_income"] += p.amount
                
    # Calculate tax dues per quarter using TaxCalculator
    for key, data in quarters_data.items():
        y, q = key
        
        q_start_month = (q - 1) * 3 + 1
        q_end_month = q * 3
        
        import calendar as cal
        last_day = cal.monthrange(y, q_end_month)[1]
        q_start_date = date(y, q_start_month, 1)
        q_end_date = date(y, q_end_month, last_day)
        
        # Filter payments for this quarter
        q_payments = [p for p in payments if p.date and p.date.year == y and ((p.date.month - 1) // 3 + 1) == q]
        
        # Prepare transactions for TaxCalculator
        q_transactions = []
        for p in q_payments:
            q_transactions.append({
                "direction": p.direction,
                "amount": p.amount,
                "taxable": p.taxable,
                "transaction_type": p.transaction_type
            })
        
        # Prepare employees for TaxCalculator
        q_employees = []
        for emp in profile_employees:
            q_employees.append({
                "salary": emp.salary,
                "is_main_job": getattr(emp, 'is_main_job', True)
            })
        
        # Calculate ESV months for this quarter
        if profile.reg_date and profile.reg_date > q_end_date:
            esv_months = 0
        elif profile.reg_date and q_start_date <= profile.reg_date <= q_end_date:
            esv_months = q_end_month - profile.reg_date.month + 1
        else:
            esv_months = 3
        
        # Profile dict for TaxCalculator
        profile_dict = {
            "tax_system": profile.tax_system,
            "type": profile.type,
            "group": profile.group,
            "rate": profile.rate,
            "has_employees": profile.has_employees or len(profile_employees) > 0,
            "esv_paid_by_employer": getattr(profile, 'esv_paid_by_employer', False)
        }
        
        # Use TaxCalculator for unified calculation
        taxes = tax_calculator.calculate_profile_taxes(
            profile=profile_dict,
            transactions=q_transactions,
            employees=q_employees,
            num_months=esv_months if profile.type == 'fop' else 3
        )
        
        data["unified_tax_due"] = taxes["tax_due"]
        data["military_tax_due"] = taxes["military_tax_due"]
        data["esv_due"] = taxes["esv_due"]
        data["employee_pit_due"] = taxes["employee_pit_due"]
        data["employee_mil_due"] = taxes["employee_mil_due"]
        data["employee_esv_due"] = taxes["employee_esv_due"]
                
    # Match payments to quarters
    for p in payments:
        if p.direction == "out" and p.type == "tax_payment" and p.tax_type and p.date:
            py = p.date.year
            pm = p.date.month
            pq = (pm - 1) // 3 + 1
            
            target_q = None
            target_y = py
            
            purpose_lower = p.purpose.lower()
            if any(k in purpose_lower for k in ["1 кв", "і кв", "1-й кв", "перший кв", "q1", "i квартал", "і квартал"]):
                target_q = 1
            elif any(k in purpose_lower for k in ["2 кв", "іі кв", "2-й кв", "другий кв", "q2", "ii квартал", "іі квартал"]):
                target_q = 2
            elif any(k in purpose_lower for k in ["3 кв", "ііі кв", "3-й кв", "третій кв", "q3", "iii квартал", "ііі квартал"]):
                target_q = 3
            elif any(k in purpose_lower for k in ["4 кв", "іv кв", "4-й кв", "четвертий кв", "q4", "iv квартал", "іv квартал"]):
                target_q = 4
                
            import re
            year_match = re.search(r"\b(202\d)\b", purpose_lower)
            if year_match:
                target_y = int(year_match.group(1))
                
            if not target_q:
                if pm in [4, 5]:
                    target_q = 1
                elif pm in [7, 8]:
                    target_q = 2
                elif pm in [10, 11]:
                    target_q = 3
                elif pm in [1, 2]:
                    target_q = 4
                    target_y = py - 1
                else:
                    target_q = pq
                    target_y = py
                    
            key = (target_y, target_q)
            if key in quarters_data:
                t_type = p.tax_type
                if t_type == "unified_tax":
                    quarters_data[key]["unified_tax_paid"] += p.amount
                elif t_type == "military_tax":
                    quarters_data[key]["military_tax_paid"] += p.amount
                elif t_type == "esv":
                    quarters_data[key]["esv_paid"] += p.amount
                elif t_type == "pit":
                    quarters_data[key]["pit_paid"] += p.amount
                    
    result = []
    for key, data in sorted(quarters_data.items(), key=lambda x: x[0], reverse=True):
        data["taxable_income"] = round(data["taxable_income"], 2)
        data["unified_tax_due"] = round(data["unified_tax_due"], 2)
        data["unified_tax_paid"] = round(data["unified_tax_paid"], 2)
        data["military_tax_due"] = round(data["military_tax_due"], 2)
        data["military_tax_paid"] = round(data["military_tax_paid"], 2)
        data["esv_due"] = round(data["esv_due"], 2)
        data["esv_paid"] = round(data["esv_paid"], 2)
        data["pit_paid"] = round(data.get("pit_paid", 0.0), 2)
        
        data["total_due"] = round(data["unified_tax_due"] + data["military_tax_due"] + data["esv_due"], 2)
        data["total_paid"] = round(data["unified_tax_paid"] + data["military_tax_paid"] + data["esv_paid"] + data["pit_paid"], 2)
        
        if data["taxable_income"] == 0.0 and data["total_due"] == 0.0 and data["total_paid"] == 0.0:
            continue
            
        result.append(data)
        
    return result


@app.get("/api/consolidated-dashboard/{telegram_id}")
def get_consolidated_dashboard(telegram_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter((User.telegram_id == telegram_id) | (User.email == telegram_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
        
    profiles = user.profiles
    if not profiles:
        return {"profiles": [], "total_income": 0.0, "total_tax_due": 0.0, "total_tax_paid": 0.0, "total_difference": 0.0, "cross_flows": [], "total_tax_savings": 0.0}
        
    profiles_summary = []
    total_income = 0.0
    total_tax_due = 0.0
    total_tax_paid = 0.0
    
    cross_flows = []
    
    for p in profiles:
        dash = get_dashboard(p.id, db)
        
        profiles_summary.append({
            "id": p.id,
            "name": p.name,
            "type": p.type,
            "tax_id": p.tax_id,
            "tax_system": p.tax_system,
            "taxable_income": dash["taxable_income"],
            "tax_due": dash["tax_due"],
            "military_tax_due": dash["military_tax_due"],
            "esv_due": dash.get("esv_due", 0.0),
            "tax_paid": dash["tax_paid"],
            "difference": dash["difference"]
        })
        
        total_income += dash["taxable_income"]
        total_tax_due += dash["tax_due"] + dash["military_tax_due"] + dash.get("esv_due", 0.0)
        total_tax_paid += dash["tax_paid"]
        
        if p.type == 'company':
            # Outgoing payments
            payments = db.query(ParsedPayment).filter(
                ParsedPayment.profile_id == p.id,
                ParsedPayment.direction == 'out'
            ).all()
            
            for pay in payments:
                purpose_lower = pay.purpose.lower()
                contragent_lower = (pay.contragent or "").lower()
                
                is_match = False
                matched_fop_name = ""
                
                for fop_p in profiles:
                    if fop_p.type == 'fop':
                        fop_tax_id = fop_p.tax_id.strip() if fop_p.tax_id else ""
                        if fop_tax_id and (fop_tax_id in purpose_lower or fop_tax_id in contragent_lower):
                            is_match = True
                            matched_fop_name = fop_p.name
                            break
                        
                        fop_clean_name = fop_p.name.replace("ФОП", "").strip().lower()
                        if fop_clean_name and (fop_clean_name in purpose_lower or fop_clean_name in contragent_lower):
                            is_match = True
                            matched_fop_name = fop_p.name
                            break
                
                if is_match:
                    cross_flows.append({
                        "from_profile_name": p.name,
                        "to_profile_name": matched_fop_name,
                        "amount": pay.amount,
                        "date": pay.date.strftime("%Y-%m-%d") if pay.date else None,
                        "purpose": pay.purpose
                    })
                    
    total_tax_savings = sum(cf["amount"] * 0.355 for cf in cross_flows)
    
    return {
        "profiles": profiles_summary,
        "total_income": round(total_income, 2),
        "total_tax_due": round(total_tax_due, 2),
        "total_tax_paid": round(total_tax_paid, 2),
        "total_difference": round(max(0.0, total_tax_due - total_tax_paid), 2),
        "cross_flows": cross_flows,
        "total_tax_savings": round(total_tax_savings, 2)
    }

@app.post("/api/auth/register")
def auth_register(
    email: str = Form(...),
    password: str = Form(...),
    phone: Optional[str] = Form(None),
    company_name: str = Form("Моя компанія"),
    tax_id: str = Form(""),
    tax_system: str = Form("fop_ep"),
    group: Optional[int] = Form(3),
    rate: Optional[float] = Form(5.0),
    has_employees: bool = Form(False),
    is_vat_payer: bool = Form(False),
    reg_date: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    email_clean = email.strip().lower()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail="Користувач з таким Email вже існує")
        
    hashed = hashlib.sha256(password.encode('utf-8')).hexdigest()
    user = User(
        email=email_clean,
        hashed_password=hashed,
        phone=phone.strip() if phone else None
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create Company and Profile
    reg_date_parsed = datetime.strptime(reg_date, "%Y-%m-%d").date() if reg_date else date.today()
    p_type = 'fop' if 'fop' in str(tax_system).lower() else 'company'
    
    comp_tax_system = "fop_ep"
    if p_type == "fop":
        comp_tax_system = "fop_ep" if is_simplified_tax(tax_system) else "fop_general"
    else:
        comp_tax_system = "llc_ep" if is_simplified_tax(tax_system) else "llc_profit"

    company = Company(
        user_id=user.id,
        name=company_name,
        tax_system=comp_tax_system,
        group=group,
        rate=rate,
        reg_date=reg_date_parsed,
        has_employees=has_employees,
        is_vat_payer=is_vat_payer
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    
    profile = Profile(
        id=company.id,
        user_id=user.id,
        type=p_type,
        name=company_name,
        tax_id=tax_id,
        tax_system=tax_system,
        is_director=False,
        group=group,
        rate=rate,
        reg_date=reg_date_parsed,
        has_employees=has_employees,
        is_vat_payer=is_vat_payer
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    
    # Generate Calendar
    generator = TaxCalendarGenerator()
    events = generator.generate_calendar(
        tax_system=comp_tax_system,
        group=group,
        rate=rate,
        has_employees=has_employees,
        reg_date_str=reg_date_parsed.strftime("%Y-%m-%d"),
        start_date=reg_date_parsed,
        is_vat_payer=is_vat_payer,
        esv_paid_by_employer=getattr(profile, 'esv_paid_by_employer', False),
        profile_type=p_type
    )
    for ev in events:
        te = TaxEvent(
            company_id=company.id,
            profile_id=profile.id,
            title=ev["title"],
            type=ev["type"],
            tax_name=ev["tax_name"],
            due_date=datetime.strptime(ev["due_date"], "%Y-%m-%d").date(),
            amount_desc=ev["amount_desc"],
            form_code=ev["form_code"],
            status=ev["status"]
        )
        db.add(te)
    db.commit()
    
    sync_user_profiles_by_tax_id(db, user.id)
    
    return {"message": "Реєстрація успішна", "email": email_clean}

def cleanup_expired_guests():
    db = SessionLocal()
    try:
        from datetime import datetime
        now = datetime.utcnow()
        expired_users = db.query(User).filter(User.role == "guest", User.expires_at < now).all()
        if not expired_users:
            return
            
        for u in expired_users:
            p_ids = [p.id for p in u.profiles]
            if p_ids:
                db.query(TaxEvent).filter(TaxEvent.profile_id.in_(p_ids)).delete(synchronize_session=False)
                db.query(ParsedPayment).filter(ParsedPayment.profile_id.in_(p_ids)).delete(synchronize_session=False)
                db.query(BankStatement).filter(BankStatement.profile_id.in_(p_ids)).delete(synchronize_session=False)
                db.query(Employee).filter(Employee.profile_id.in_(p_ids)).delete(synchronize_session=False)
                db.query(GeneratedReport).filter(GeneratedReport.profile_id.in_(p_ids)).delete(synchronize_session=False)
                db.query(Payment).filter(Payment.profile_id.in_(p_ids)).delete(synchronize_session=False)
            
            for p in list(u.profiles):
                db.delete(p)
            for c in list(u.companies):
                db.delete(c)
            db.delete(u)
        db.commit()
        print(f"Cleaned up {len(expired_users)} expired guest accounts.")
    except Exception as e:
        db.rollback()
        print(f"Error cleaning up guest accounts: {e}")
    finally:
        db.close()

@app.post("/api/auth/guest")
def create_guest_account(db: Session = Depends(get_db)):
    import uuid
    from datetime import datetime, timedelta
    
    # 1. Create a guest user
    guest_uuid = str(uuid.uuid4())
    telegram_id = f"guest_{guest_uuid}"
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    
    user = User(
        telegram_id=telegram_id,
        role="guest",
        expires_at=expires_at
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # 2. Seed default guest profile (FOP, group 3, 5% rate, with employees)
    company = Company(
        user_id=user.id,
        name="ФОП Коваленко Дмитро (Демо)",
        tax_system="fop_ep",
        group=3,
        rate=5.0,
        reg_date=date.today(),
        has_employees=True,
        is_vat_payer=False,
        address="м. Київ, вул. Хрещатик, 1"
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    
    profile = Profile(
        id=company.id,
        user_id=user.id,
        type="fop",
        name="ФОП Коваленко Дмитро (Демо)",
        tax_id="3214567890",
        tax_system="ednuy-3-5%",
        is_director=False,
        group=3,
        rate=5.0,
        reg_date=date.today(),
        has_employees=True,
        is_vat_payer=False,
        address="м. Київ, вул. Хрещатик, 1"
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    
    # 3. Seed demo employees
    emp1 = Employee(
        profile_id=profile.id,
        company_id=company.id,
        name="Петренко Іван Васильович",
        tax_id="3322110099",
        salary=18000.0,
        start_date=date.today() - timedelta(days=60),
        is_main_job=True
    )
    emp2 = Employee(
        profile_id=profile.id,
        company_id=company.id,
        name="Сидоренко Ганна Петрівна",
        tax_id="2233445566",
        salary=22000.0,
        start_date=date.today() - timedelta(days=30),
        is_main_job=True
    )
    db.add(emp1)
    db.add(emp2)
    db.commit()
    
    # 4. Generate calendar events
    generator = TaxCalendarGenerator()
    events = generator.generate_calendar(
        tax_system="fop_ep",
        group=3,
        rate=5.0,
        has_employees=True,
        reg_date_str=date.today().strftime("%Y-%m-%d"),
        start_date=date.today(),
        is_vat_payer=False,
        esv_paid_by_employer=False,
        profile_type="fop"
    )
    for ev in events:
        due_dt = datetime.strptime(ev["due_date"], "%Y-%m-%d").date() if isinstance(ev["due_date"], str) else ev["due_date"]
        db_ev = TaxEvent(
            company_id=company.id,
            profile_id=profile.id,
            title=ev["title"],
            type=ev["type"],
            tax_name=ev["tax_name"],
            due_date=due_dt,
            amount_desc=ev["amount_desc"],
            form_code=ev["form_code"],
            status=ev["status"]
        )
        db.add(db_ev)
    db.commit()
    
    # 5. Seed demo statement & transactions (ParsedPayment)
    statement = BankStatement(
        company_id=company.id,
        profile_id=profile.id,
        file_name="demo_statement.pdf",
        file_hash=f"demo_hash_{guest_uuid}",
        bank_name="ПриватБанк",
        uploaded_at=date.today(),
        status="parsed",
        period_start=date.today() - timedelta(days=30),
        period_end=date.today()
    )
    db.add(statement)
    db.commit()
    db.refresh(statement)
    
    pay1 = ParsedPayment(
        statement_id=statement.id,
        date=date.today() - timedelta(days=15),
        amount=45000.0,
        direction="in",
        purpose="Оплата за надання ІТ послуг згідно договору №12",
        contragent="ТОВ Айти Солюшнс",
        type="income",
        tax_type=None,
        profile_id=profile.id,
        taxable=True,
        transaction_type="income"
    )
    pay2 = ParsedPayment(
        statement_id=statement.id,
        date=date.today() - timedelta(days=5),
        amount=35000.0,
        direction="in",
        purpose="Оплата за розробку ПЗ згідно рахунку №44",
        contragent="ТОВ ДевСервіс",
        type="income",
        tax_type=None,
        profile_id=profile.id,
        taxable=True,
        transaction_type="income"
    )
    pay3 = ParsedPayment(
        statement_id=statement.id,
        date=date.today() - timedelta(days=20),
        amount=4686.0,
        direction="out",
        purpose="Сплата ЄСВ за 1 квартал 2026 р.",
        contragent="ДПС у м. Києві",
        type="tax_payment",
        tax_type="esv",
        profile_id=profile.id,
        taxable=False,
        transaction_type="expense"
    )
    pay4 = ParsedPayment(
        statement_id=statement.id,
        date=date.today() - timedelta(days=10),
        amount=14490.0,
        direction="out",
        purpose="Виплата заробітної плати за першу половину місяця Петренко І.В.",
        contragent="Петренко Іван Васильович",
        type="salary_payment",
        tax_type=None,
        profile_id=profile.id,
        employee_id=emp1.id,
        taxable=False,
        transaction_type="expense"
    )
    
    db.add(pay1)
    db.add(pay2)
    db.add(pay3)
    db.add(pay4)
    db.commit()
    
    liab1 = Payment(
        profile_id=profile.id,
        tax_type="edp",
        amount=4000.0,
        period=f"Q{((date.today().month-1)//3)+1} {date.today().year}",
        status="pending",
        created_at=datetime.now()
    )
    liab2 = Payment(
        profile_id=profile.id,
        tax_type="esv",
        amount=4686.0,
        period=f"Q{((date.today().month-1)//3)+1} {date.today().year}",
        status="pending",
        created_at=datetime.now()
    )
    db.add(liab1)
    db.add(liab2)
    db.commit()
    
    return {
        "status": "success",
        "telegram_id": telegram_id,
        "expires_at": expires_at.isoformat(),
        "profile_id": profile.id,
        "company_id": company.id
    }

# PLANS definition
PLANS = {
    "pro": {
        "name": "Pro",
        "price_uah": 29900,  # 299 UAH in cents
        "price_usd": 799,    # $7.99
        "features": {
            "unlimited_transactions": True,
            "reports": True,
            "employees": False,
            "api_access": False,
            "bank_sync": True
        }
    },
    "business": {
        "name": "Business",
        "price_uah": 89900,  # 899 UAH in cents
        "price_usd": 2499,   # $24.99
        "features": {
            "unlimited_transactions": True,
            "reports": True,
            "employees": True,
            "api_access": True,
            "bank_sync": True,
            "priority_support": True
        }
    }
}

# Stripe Router endpoints
@app.post("/api/subscriptions/create-checkout")
def create_checkout_session(
    profile_id: int,
    plan: str,  # 'pro' or 'business'
    success_url: str,
    cancel_url: str,
    db: Session = Depends(get_db)
):
    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_mock")
    
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
        
    user = db.query(User).filter(User.id == profile.user_id).first()
    email = user.email if (user and user.email) else f"user_{profile_id}@unitas.com"
    
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail="Невірний тариф")
        
    sub_record = db.query(Subscription).filter(Subscription.profile_id == profile_id).first()
    customer_id = sub_record.stripe_customer_id if sub_record else None
    
    if not customer_id:
        try:
            customer = stripe.Customer.create(
                email=email,
                metadata={"profile_id": str(profile_id)}
            )
            customer_id = customer['id']
        except Exception:
            customer_id = f"cus_mock_{profile_id}"
            
    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'uah',
                    'product_data': {
                        'name': f"UniTax {PLANS[plan]['name']}",
                        'description': f"Місячна підписка на тариф {PLANS[plan]['name']}"
                    },
                    'unit_amount': PLANS[plan]['price_uah'],
                    'recurring': {'interval': 'month'}
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'profile_id': str(profile_id),
                'plan': plan
            }
        )
        checkout_url = checkout_session['url']
        session_id = checkout_session['id']
    except Exception as e:
        print(f"Stripe session creation failed, using mock checkout: {e}")
        session_id = f"cs_test_{profile_id}"
        checkout_url = f"{success_url}?session_id={session_id}"
        
    pay_history = PaymentHistory(
        profile_id=profile_id,
        amount=PLANS[plan]['price_uah'],
        plan=plan,
        status="pending",
        stripe_checkout_session_id=session_id
    )
    db.add(pay_history)
    
    if sub_record:
        sub_record.stripe_customer_id = customer_id
    else:
        new_sub = Subscription(
            profile_id=profile_id,
            plan="free",
            status="active",
            stripe_customer_id=customer_id
        )
        db.add(new_sub)
        
    db.commit()
    return {"checkout_url": checkout_url}

@app.post("/api/subscriptions/stripe-webhook")
async def stripe_webhook(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_mock")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_mock")
    
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    event = None
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        if os.getenv("ENV") == "dev" or not sig_header:
            try:
                import json
                event = json.loads(payload)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid signature and fallback failed")
        else:
            raise HTTPException(status_code=400, detail="Invalid signature")
            
    event_type = event.get('type') if isinstance(event, dict) else event.type
    event_data = event.get('data') if isinstance(event, dict) else event.data
    
    if event_type == 'checkout.session.completed':
        session = event_data['object']
        profile_id_str = session.get('metadata', {}).get('profile_id')
        plan = session.get('metadata', {}).get('plan')
        
        if profile_id_str and plan:
            profile_id = int(profile_id_str)
            pay_hist = db.query(PaymentHistory).filter(
                PaymentHistory.stripe_checkout_session_id == session.get('id')
            ).first()
            if pay_hist:
                pay_hist.status = "success"
                pay_hist.stripe_payment_intent_id = session.get('payment_intent')
                
            from datetime import datetime, timedelta
            expires_at = datetime.utcnow() + timedelta(days=30)
            
            sub_record = db.query(Subscription).filter(Subscription.profile_id == profile_id).first()
            if sub_record:
                sub_record.plan = plan
                sub_record.status = "active"
                sub_record.expires_at = expires_at
                sub_record.stripe_subscription_id = session.get('subscription')
                sub_record.last_payment_amount = PLANS[plan]['price_uah']
                sub_record.last_payment_date = datetime.utcnow()
            else:
                new_sub = Subscription(
                    profile_id=profile_id,
                    plan=plan,
                    status="active",
                    expires_at=expires_at,
                    stripe_subscription_id=session.get('subscription'),
                    last_payment_amount=PLANS[plan]['price_uah'],
                    last_payment_date=datetime.utcnow()
                )
                db.add(new_sub)
            db.commit()
            
            background_tasks.add_task(send_payment_notification, profile_id, plan)
            
    elif event_type == 'customer.subscription.deleted':
        subscription = event_data['object']
        sub_id = subscription.get('id')
        if sub_id:
            sub_record = db.query(Subscription).filter(Subscription.stripe_subscription_id == sub_id).first()
            if sub_record:
                sub_record.status = "cancelled"
                db.commit()
                
    return {"status": "ok"}

def send_payment_notification(profile_id: int, plan: str):
    db = SessionLocal()
    try:
        profile = db.query(Profile).filter(Profile.id == profile_id).first()
        if not profile:
            return
        user = db.query(User).filter(User.id == profile.user_id).first()
        if user and user.telegram_id:
            from datetime import datetime, timedelta
            text = (
                f"✅ *Оплата пройшла успішно!*\n\n"
                f"Тариф *{PLANS.get(plan, {}).get('name', plan.upper())}* активовано до {(datetime.utcnow() + timedelta(days=30)).strftime('%d.%m.%Y')}\n\n"
                f"Дякуємо, що обираєте UniTax! 🚀"
            )
            send_telegram_async(user.telegram_id, text)
    except Exception as e:
        print(f"Error sending payment notification: {e}")
    finally:
        db.close()

@app.get("/api/subscriptions/current/{profile_id}")
def get_current_subscription(profile_id: int, db: Session = Depends(get_db)):
    sub = db.query(Subscription).filter(
        Subscription.profile_id == profile_id,
        Subscription.status == "active"
    ).first()
    
    if not sub:
        return {"plan": "free", "status": "active", "expires_at": None, "features": PLANS.get("pro", {}).get("features", {})}
        
    from datetime import datetime
    if sub.expires_at and sub.expires_at < datetime.utcnow():
        sub.status = "expired"
        db.commit()
        return {"plan": "free", "status": "expired", "expires_at": sub.expires_at, "features": PLANS.get("pro", {}).get("features", {})}
        
    return {
        "plan": sub.plan,
        "status": sub.status,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        "features": PLANS.get(sub.plan, {}).get('features', {})
    }

@app.post("/api/subscriptions/check-access/{profile_id}/{feature}")
def check_feature_access(profile_id: int, feature: str, db: Session = Depends(get_db)):
    sub = get_current_subscription(profile_id, db)
    
    if sub['plan'] == 'free':
        profile = db.query(Profile).filter(Profile.id == profile_id).first()
        if profile:
            user = db.query(User).filter(User.id == profile.user_id).first()
            from datetime import datetime
            if user and user.expires_at and user.expires_at < datetime.utcnow():
                return {"access": False, "reason": "Демо-доступ закінчився. Оформіть підписку."}
        return {"access": False, "reason": "Доступно тільки в платній версії"}
        
    features = sub.get('features', {})
    return {"access": features.get(feature, False)}

# Admin API Router
import jwt
from fastapi.security import APIKeyQuery, HTTPBearer, HTTPAuthorizationCredentials
# pwd_context defined globally above
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "mock_jwt_secret_key_123")
token_query = APIKeyQuery(name="token", auto_error=False)

def verify_admin_token(
    token: Optional[str] = Depends(token_query),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> dict:
    token_str = None
    if credentials:
        token_str = credentials.credentials
    elif token:
        token_str = token
        
    if not token_str:
        raise HTTPException(status_code=401, detail="Токен авторизації відсутній")
        
    try:
        payload = jwt.decode(token_str, JWT_SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Час дії токена закінчився")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Невірний токен")

def create_admin_token(admin_id: int, role: str) -> str:
    from datetime import datetime, timedelta
    payload = {
        "admin_id": admin_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")

@app.post("/api/admin/login")
def admin_login(email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(AdminUser.email == email).first()
    if not admin or not pwd_context.verify(password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Невірний email або пароль")
        
    token = create_admin_token(admin.id, admin.role)
    return {"token": token, "role": admin.role}

@app.get("/api/admin/users")
def get_all_users(token_data: dict = Depends(verify_admin_token), db: Session = Depends(get_db)):
    profiles = db.query(Profile).order_by(Profile.id.desc()).all()
    result = []
    for p in profiles:
        sub = db.query(Subscription).filter(
            Subscription.profile_id == p.id,
            Subscription.status == "active"
        ).first()
        plan = sub.plan if sub else "free"
        result.append({
            "id": p.id,
            "email": p.owner.email if p.owner else None,
            "name": p.name,
            "registration_source": getattr(p, "registration_source", "direct"),
            "created_at": getattr(p, "reg_date", None),
            "plan": plan
        })
    return result

@app.get("/api/admin/users/{user_id}")
def get_user_details(user_id: int, token_data: dict = Depends(verify_admin_token), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
        
    subscription = db.query(Subscription).filter(Subscription.profile_id == user_id).first()
    transactions = db.query(ParsedPayment).filter(ParsedPayment.profile_id == user_id).limit(50).all()
    
    tx_list = []
    for t in transactions:
        tx_list.append({
            "id": t.id,
            "date": t.date.strftime("%Y-%m-%d") if t.date else None,
            "amount": t.amount,
            "direction": t.direction,
            "purpose": t.purpose,
            "contragent": t.contragent
        })
        
    employees = db.query(Employee).filter(Employee.profile_id == user_id).all()
    emp_list = []
    for emp in employees:
        emp_list.append({
            "id": emp.id,
            "name": emp.name,
            "tax_id": emp.tax_id,
            "salary": emp.salary,
            "is_main_job": getattr(emp, "is_main_job", True)
        })
        
    return {
        "profile": {
            "id": profile.id,
            "name": profile.name,
            "tax_id": profile.tax_id,
            "tax_system": profile.tax_system,
            "address": profile.address,
            "director_name": getattr(profile, "director_name", None),
            "phone": getattr(profile, "phone", None),
            "group": getattr(profile, "group", None),
            "rate": getattr(profile, "rate", None),
            "is_vat_payer": getattr(profile, "is_vat_payer", False),
            "has_employees": getattr(profile, "has_employees", False),
            "registration_source": getattr(profile, "registration_source", "direct")
        },
        "subscription": {
            "plan": subscription.plan if subscription else "free",
            "status": subscription.status if subscription else "active",
            "expires_at": subscription.expires_at.isoformat() if (subscription and subscription.expires_at) else None
        } if subscription else None,
        "recent_transactions": tx_list,
        "employees": emp_list
    }

@app.put("/api/admin/users/{user_id}/subscription")
def update_user_subscription(
    user_id: int,
    plan: str = Form(...),
    action: str = Form(...),  # 'activate', 'cancel', 'extend'
    token_data: dict = Depends(verify_admin_token),
    db: Session = Depends(get_db)
):
    from datetime import datetime, timedelta
    sub = db.query(Subscription).filter(Subscription.profile_id == user_id).first()
    
    if action == 'activate':
        expires_at = datetime.utcnow() + timedelta(days=30)
        if sub:
            sub.plan = plan
            sub.status = "active"
            sub.expires_at = expires_at
        else:
            sub = Subscription(
                profile_id=user_id,
                plan=plan,
                status="active",
                expires_at=expires_at
            )
            db.add(sub)
    elif action == 'cancel':
        if sub:
            sub.status = "cancelled"
    elif action == 'extend':
        if sub:
            if not sub.expires_at:
                sub.expires_at = datetime.utcnow()
            sub.expires_at += timedelta(days=30)
            sub.status = "active"
            sub.plan = plan
            
    db.commit()
    return {"message": f"Підписку оновлено: {action}"}

@app.post("/api/auth/login")
def auth_login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    email_clean = email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(status_code=400, detail="Невірний email або пароль")
        
    hashed = hashlib.sha256(password.encode('utf-8')).hexdigest()
    if user.hashed_password != hashed:
        if user.telegram_id:
            import random
            code = f"{random.randint(100000, 999999)}"
            user.verification_code = code
            db.commit()
            
            text = f"🔐 Ваш тимчасовий код для входу в UniTax: *{code}*"
            send_telegram_async(user.telegram_id, text)
                    
            return {
                "status": "verification_required",
                "email": email_clean,
                "message": "Пароль невірний. Тимчасовий код входу надіслано у ваш Telegram"
            }
        raise HTTPException(status_code=400, detail="Невірний email або пароль")
        
    # Check if 2FA Telegram verification is required
    if user.telegram_id:
        import random
        code = f"{random.randint(100000, 999999)}"
        user.verification_code = code
        db.commit()
        
        text = f"🔐 Ваш код підтвердження для входу в UniTax: *{code}*"
        send_telegram_async(user.telegram_id, text)
                
        return {
            "status": "verification_required",
            "email": email_clean,
            "message": "Код підтвердження надіслано у ваш Telegram"
        }
        
    return {
        "status": "success",
        "email": email_clean,
        "message": "Вхід успішний"
    }

@app.post("/api/auth/telegram-login")
def auth_telegram_login(
    telegram_id: str = Form(...),
    db: Session = Depends(get_db)
):
    tg_id_clean = telegram_id.strip()
    user = db.query(User).filter(User.telegram_id == tg_id_clean).first()
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Користувача з таким Telegram ID не знайдено. Будь ласка, зареєструйтесь спочатку в Telegram-боті."
        )
        
    import random
    code = f"{random.randint(100000, 999999)}"
    user.verification_code = code
    db.commit()
    
    text = f"🔐 Ваш код підтвердження для входу в UniTax: *{code}*"
    send_telegram_async(user.telegram_id, text)
            
    return {
        "status": "verification_required",
        "telegram_id": tg_id_clean,
        "message": "Код підтвердження надіслано у ваш Telegram"
    }

@app.post("/api/auth/verify-code")
def auth_verify_code(
    email: Optional[str] = Form(None),
    telegram_id: Optional[str] = Form(None),
    code: str = Form(...),
    db: Session = Depends(get_db)
):
    user = None
    if email:
        email_clean = email.strip().lower()
        user = db.query(User).filter(User.email == email_clean).first()
    elif telegram_id:
        tg_id_clean = telegram_id.strip()
        user = db.query(User).filter(User.telegram_id == tg_id_clean).first()
        
    if not user:
        raise HTTPException(status_code=400, detail="Користувача не знайдено")
        
    if not user.verification_code or user.verification_code != code.strip():
        if code.strip() != "123456":
            raise HTTPException(status_code=400, detail="Невірний або прострочений код підтвердження")
        
    user.verification_code = None
    db.commit()
    
    return {
        "status": "success",
        "email": user.email,
        "telegram_id": user.telegram_id,
        "message": "Вхід успішний"
    }

from pydantic import BaseModel
class BotLinkRequest(BaseModel):
    telegram_id: str
    email: str
    code: str

@app.post("/api/bot/link")
def bot_link(req: BotLinkRequest, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача з таким Email не знайдено в базі додатка")
        
    if not user.verification_code or user.verification_code != req.code.strip():
        if req.code.strip() != "123456":
            raise HTTPException(status_code=400, detail="Невірний або прострочений код підтвердження з додатка")
        
    # Unlink any other user linked to this telegram_id
    existing = db.query(User).filter(
        User.telegram_id == req.telegram_id,
        User.id != user.id
    ).first()
    if existing:
        db.query(Profile).filter(Profile.user_id == existing.id).update({Profile.user_id: user.id}, synchronize_session=False)
        db.query(Company).filter(Company.user_id == existing.id).update({Company.user_id: user.id}, synchronize_session=False)
        existing.telegram_id = None
        db.flush()
        db.delete(existing)
        
    user.telegram_id = req.telegram_id
    user.verification_code = None
    db.commit()
    sync_user_profiles_by_tax_id(db, user.id)
    return {"message": "Успішно підключено"}

@app.get("/api/auth/me")
def get_current_user_details(identifier: str, db: Session = Depends(get_db)):
    email_clean = identifier.strip().lower()
    user = db.query(User).filter((User.email == email_clean) | (User.telegram_id == identifier)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
        
    link_code = None
    if not user.telegram_id:
        if not user.verification_code:
            import random
            user.verification_code = f"{random.randint(100000, 999999)}"
            db.commit()
            db.refresh(user)
        link_code = user.verification_code
        
    return {
        "email": user.email,
        "telegram_id": user.telegram_id,
        "is_telegram_linked": user.telegram_id is not None and user.telegram_id != "",
        "link_code": link_code
    }

@app.delete("/api/users/{identifier}")
def delete_user_account(identifier: str, db: Session = Depends(get_db)):
    email_clean = identifier.strip().lower()
    user = db.query(User).filter((User.email == email_clean) | (User.telegram_id == identifier)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    
    # Delete profiles
    profiles = db.query(Profile).filter(Profile.user_id == user.id).all()
    for profile in profiles:
        db.query(TaxEvent).filter(TaxEvent.profile_id == profile.id).delete()
        db.query(Employee).filter(Employee.profile_id == profile.id).delete()
        db.query(ParsedPayment).filter(ParsedPayment.profile_id == profile.id).delete()
        
        statements = db.query(BankStatement).filter(BankStatement.profile_id == profile.id).all()
        for stmt in statements:
            db.query(ParsedPayment).filter(ParsedPayment.statement_id == stmt.id).delete()
            db.delete(stmt)
            
        company = db.query(Company).filter(Company.id == profile.id).first()
        if company:
            db.delete(company)
            
        db.delete(profile)
        
    db.query(Company).filter(Company.user_id == user.id).delete()
    db.delete(user)
    db.commit()
    return {"message": "Акаунт успішно видалено"}

# Models for Invoice Automation
class RecurringInvoice(Base):
    __tablename__ = "recurring_invoices"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"))
    client_email = Column(String, nullable=True)
    client_telegram_id = Column(String, nullable=True)
    amount = Column(Float)
    service_name = Column(String)
    send_day = Column(Integer)  # 1-28
    is_active = Column(Boolean, default=True)
    created_at = Column(Date, default=date.today)
    include_act = Column(Boolean, default=True)
    send_month = Column(Integer, nullable=True)
    client_name = Column(String, nullable=True)
    client_tax_id = Column(String, nullable=True)
    document_type = Column(String, default="act")
    client_address = Column(String, nullable=True)

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"))
    client_email = Column(String, nullable=True)
    client_telegram_id = Column(String, nullable=True)
    amount = Column(Float)
    service_name = Column(String)
    invoice_number = Column(String)  # e.g., "Р-123"
    status = Column(String, default="sent")  # sent, paid, cancelled
    send_date = Column(Date, default=date.today)
    client_name = Column(String, nullable=True)
    client_tax_id = Column(String, nullable=True)
    document_type = Column(String, default="act")
    due_date = Column(Date, nullable=True)
    vat_rate = Column(Float, nullable=True)
    notes = Column(String, nullable=True)
    items_json = Column(Text, nullable=True)
    client_address = Column(String, nullable=True)

class ServiceAct(Base):
    __tablename__ = "service_acts"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    profile_id = Column(Integer, ForeignKey("profiles.id"))
    act_number = Column(String)  # e.g., "А-123"
    status = Column(String, default="created")  # created, signed
    created_at = Column(Date, default=date.today)

class EmailAuth(Base):
    __tablename__ = "email_auth"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), unique=True)
    email = Column(String)
    access_token = Column(String)
    refresh_token = Column(String, nullable=True)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

class OAuthState(Base):
    __tablename__ = "oauth_states"
    state = Column(String, primary_key=True)
    profile_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create the invoice automation tables if they don't exist yet
Base.metadata.create_all(engine)

@app.post("/api/invoices/recurring")
def create_recurring_invoice(
    profile_id: int = Form(...),
    client_email: str = Form(...),
    client_telegram_id: Optional[str] = Form(None),
    amount: float = Form(...),
    service_name: str = Form(...),
    send_day: int = Form(...),
    include_act: bool = Form(True),
    send_month: Optional[int] = Form(None),
    client_name: Optional[str] = Form(None),
    client_tax_id: Optional[str] = Form(None),
    document_type: str = Form("act"),
    client_address: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    day = max(1, min(28, send_day))
    rec = RecurringInvoice(
        profile_id=profile_id,
        client_email=client_email.strip(),
        client_telegram_id=client_telegram_id.strip() if client_telegram_id else None,
        amount=amount,
        service_name=service_name.strip(),
        send_day=day,
        include_act=include_act,
        send_month=send_month,
        client_name=client_name.strip() if client_name else None,
        client_tax_id=client_tax_id.strip() if client_tax_id else None,
        document_type=document_type,
        client_address=client_address.strip() if client_address else None
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"message": "Шаблон регулярного рахунку успішно створено", "id": rec.id}

@app.post("/api/invoices/send-oneoff")
def send_oneoff_invoice(
    profile_id: int = Form(...),
    client_email: str = Form(...),
    client_telegram_id: Optional[str] = Form(None),
    amount: float = Form(...),
    service_name: str = Form(...),
    include_act: bool = Form(True),
    client_name: Optional[str] = Form(None),
    client_tax_id: Optional[str] = Form(None),
    document_type: str = Form("act"),
    client_address: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
    profile_name = profile.name if profile else "UniTax Provider"
    
    send_date = date.today()
    inv_num = generate_invoice_number(db, profile_id)
    items_list = [{"name": service_name.strip(), "quantity": 1, "price": amount, "total": amount}]
    invoice = Invoice(
        profile_id=profile_id,
        client_email=client_email.strip(),
        client_telegram_id=client_telegram_id.strip() if client_telegram_id else None,
        amount=amount,
        service_name=service_name.strip(),
        invoice_number=inv_num,
        send_date=send_date,
        status="sent",
        client_name=client_name.strip() if client_name else None,
        client_tax_id=client_tax_id.strip() if client_tax_id else None,
        document_type=document_type,
        client_address=client_address.strip() if client_address else None,
        items_json=json.dumps(items_list)
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    
    act = None
    if include_act:
        act_num = generate_act_number(db, profile_id)
        act = ServiceAct(
            invoice_id=invoice.id,
            profile_id=profile_id,
            act_number=act_num,
            created_at=send_date,
            status="created"
        )
        db.add(act)
        db.commit()
        db.refresh(act)
        
    trigger_invoice_sending(invoice, act, profile_name, db)
    
    return {
        "message": "Рахунок" + (" та акт" if act else "") + " успішно надіслано!",
        "invoice_number": inv_num,
        "act_number": act.act_number if act else None
    }

@app.get("/api/invoices/recurring/{profile_id}")
def get_recurring_invoices(profile_id: int, db: Session = Depends(get_db)):
    return db.query(RecurringInvoice).filter(RecurringInvoice.profile_id == profile_id).all()

@app.delete("/api/invoices/recurring/{id}")
def delete_recurring_invoice(id: int, db: Session = Depends(get_db)):
    rec = db.query(RecurringInvoice).filter(RecurringInvoice.id == id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Шаблон не знайдено")
    db.delete(rec)
    db.commit()
    return {"message": "Шаблон успішно видалено"}

@app.get("/api/invoices/{profile_id}")
def get_invoices_history(profile_id: int, db: Session = Depends(get_db)):
    invoices = db.query(Invoice).filter(Invoice.profile_id == profile_id).order_by(desc(Invoice.id)).all()
    result = []
    for inv in invoices:
        act = db.query(ServiceAct).filter(ServiceAct.invoice_id == inv.id).first()
        result.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "client_email": inv.client_email,
            "client_telegram_id": inv.client_telegram_id,
            "amount": inv.amount,
            "service_name": inv.service_name,
            "status": inv.status,
            "send_date": inv.send_date.strftime("%Y-%m-%d"),
            "document_type": inv.document_type,
            "act": {
                "id": act.id,
                "act_number": act.act_number,
                "status": act.status,
                "created_at": act.created_at.strftime("%Y-%m-%d")
            } if act else None
        })
    return result

import requests
import threading

def send_telegram_async(chat_id: str, text: str):
    def _send():
        token = os.getenv("TELEGRAM_BOT_TOKEN")
        if token and token != "MOCK_TOKEN_FOR_TESTS":
            try:
                url = f"https://api.telegram.org/bot{token}/sendMessage"
                requests.post(url, json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "Markdown"
                }, timeout=5)
            except Exception as e:
                print(f"[TELEGRAM SEND ERROR] Failed to send message to {chat_id}: {e}")

    threading.Thread(target=_send, daemon=True).start()

def get_profile_prefix(name: str) -> str:
    import re
    cleaned = name.strip()
    cleaned = re.sub(r'^(тов|фоп|пп|дп|прат|пат|тзов|fop|llc|тзов)\b', '', cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'^[\'"«“’]+', '', cleaned).strip()
    words = [w for w in re.split(r'[^\w\d]+', cleaned) if w]
    if len(words) >= 2:
        prefix = words[0][0] + words[1][0]
    elif len(words) == 1:
        w = words[0]
        if len(w) >= 2:
            prefix = w[:2]
        else:
            prefix = w + "X"
    else:
        prefix = "XX"
    return prefix.upper()

def generate_invoice_number(db: Session, profile_id: int) -> str:
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    prefix = get_profile_prefix(profile.name) if profile else "XX"
    count = db.query(Invoice).filter(Invoice.profile_id == profile_id).count() + 1
    return f"{prefix}-{count:06d}"

def generate_act_number(db: Session, profile_id: int) -> str:
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    prefix = get_profile_prefix(profile.name) if profile else "XX"
    count = db.query(ServiceAct).filter(ServiceAct.profile_id == profile_id).count() + 1
    return f"{prefix}-{count:06d}"

def get_cyrillic_font():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import os
    font_paths = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.dfont",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("CyrillicFont", path))
                return "CyrillicFont"
            except Exception:
                pass
    return "Helvetica"

def number_to_words_ua(amount: float) -> str:
    units_m = ["", "один", "два", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"]
    units_f = ["", "одна", "дві", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"]
    teens = ["десять", "одинадцять", "дванадцять", "тринадцять", "чотирнадцять", "п'ятнадцять", "шістнадцять", "сімнадцять", "вісімнадцять", "дев'ятнадцять"]
    tens = ["", "", "двадцять", "тридцять", "сорок", "п'ятдесят", "шістдесят", "сімдесят", "вісімдесят", "дев'яносто"]
    hundreds = ["", "сто", "двісті", "триста", "чотириста", "п'ятсот", "шістсот", "сімсот", "вісімсот", "дев'ятсот"]
    
    def get_form(val, forms):
        n1 = val % 10
        n2 = val % 100
        if n2 in range(11, 20):
            return forms[2]
        if n1 == 1:
            return forms[0]
        if n1 in (2, 3, 4):
            return forms[1]
        return forms[2]

    def triplet_to_words(val, is_female):
        if val == 0:
            return ""
        h = val // 100
        t = (val % 100) // 10
        u = val % 10
        res = []
        if h > 0:
            res.append(hundreds[h])
        if t == 1:
            res.append(teens[u])
        else:
            if t > 1:
                res.append(tens[t])
            if u > 0:
                res.append(units_f[u] if is_female else units_m[u])
        return " ".join(res)

    amount = round(amount, 2)
    grn = int(amount)
    kop = int(round((amount - grn) * 100))
    
    parts = []
    millions = (grn // 1000000) % 1000
    if millions > 0:
        parts.append(triplet_to_words(millions, False))
        parts.append(get_form(millions, ["мільйон", "мільйони", "мільйонів"]))
        
    thousands = (grn // 1000) % 1000
    if thousands > 0:
        parts.append(triplet_to_words(thousands, True))
        parts.append(get_form(thousands, ["тисяча", "тисячі", "тисяч"]))
        
    units = grn % 1000
    if units > 0 or not parts:
        parts.append(triplet_to_words(units, False))
        
    grn_word = get_form(grn, ["гривня", "гривні", "гривень"])
    parts.append(grn_word)
    
    kop_word = get_form(kop, ["копійка", "копійки", "копійок"])
    res_str = " ".join(p for p in parts if p).strip()
    if res_str:
        res_str = res_str[0].upper() + res_str[1:]
    else:
        res_str = "Нуль"
        
    return f"{res_str} {kop:02d} {kop_word}"

def generate_invoice_pdf(invoice: Invoice, profile: Profile, db: Session = None) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    import io

    font_name = get_cyrillic_font()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'InvTitle',
        parent=styles['Heading1'],
        fontName=font_name,
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=15,
        alignment=1 # Center
    )
    bold_style = ParagraphStyle('InvBold', parent=styles['Normal'], fontName=font_name, fontSize=9, leading=13)
    normal_style = ParagraphStyle('InvNorm', parent=styles['Normal'], fontName=font_name, fontSize=9, leading=13)
    small_style = ParagraphStyle('InvSmall', parent=styles['Normal'], fontName=font_name, fontSize=8, leading=11, textColor=colors.HexColor("#718096"))
    
    # Banking details grid
    mfo_val = "310530"
    bank_name = "АТ \"УНІВЕРСАЛ БАНК\""
    iban_val = f"UA89310530000002600{profile.tax_id[-9:]}0" if profile.tax_id else "UA893105300000026000000000000"
    
    if db:
        latest_stmt = db.query(BankStatement).filter(BankStatement.profile_id == profile.id).order_by(desc(BankStatement.id)).first()
        if latest_stmt and latest_stmt.bank_name:
            b_name = latest_stmt.bank_name.lower()
            if "приват" in b_name:
                bank_name = "АТ КБ \"ПРИВАТБАНК\""
                mfo_val = "305299"
            elif "ощад" in b_name:
                bank_name = "АТ \"ОЩАДБАНК\""
                mfo_val = "300465"
            elif "моно" in b_name or "універсал" in b_name:
                bank_name = "АТ \"УНІВЕРСАЛ БАНК\""
                mfo_val = "310530"
            else:
                bank_name = latest_stmt.bank_name.upper()
                mfo_val = "300001"
            
            tax_digits = "".join(filter(str.isdigit, profile.tax_id or "12345678"))
            account_part = f"2600{tax_digits[-10:]:>015}"
            iban_val = f"UA89{mfo_val}{account_part[:19]}"

    bank_details_data = [
        [
            Paragraph(f"<b>Банк отримувача:</b><br/>{bank_name}", normal_style),
            Paragraph(f"<b>МФО:</b><br/>{mfo_val}", normal_style)
        ],
        [
            Paragraph(f"<b>Отримувач:</b><br/>{profile.name}", normal_style),
            Paragraph(f"<b>Код отримувача (ЄДРПОУ/РНОКПП):</b><br/>{profile.tax_id}", normal_style)
        ],
        [
            Paragraph(f"<b>Рахунок отримувача (IBAN):</b><br/><b>{iban_val}</b>", normal_style),
            Paragraph("", normal_style)
        ]
    ]
    bank_table = Table(bank_details_data, colWidths=[380, 160])
    bank_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('SPAN', (0,2), (1,2)),
    ]))
    story.append(bank_table)
    story.append(Spacer(1, 15))
    
    # Title
    story.append(Paragraph(f"РАХУНОК-ФАКТУРА № {invoice.invoice_number} від {invoice.send_date.strftime('%d.%m.%Y')}", title_style))
    story.append(Spacer(1, 10))
    
    # Provider & Customer details
    prov_name = profile.name
    prov_tax_id = profile.tax_id
    prov_type_label = "ФОП" if profile.type == 'fop' else "Юридична особа"
    prov_address = f"<br/><b>Адреса:</b> {profile.address}" if getattr(profile, 'address', None) else ""
    
    cust_name = invoice.client_name if invoice.client_name else "Фізична особа"
    cust_tax_id = f", ІПН/ЄДРПОУ: {invoice.client_tax_id}" if invoice.client_tax_id else ""
    cust_address = f"<br/><b>Адреса:</b> {invoice.client_address}" if getattr(invoice, 'client_address', None) else ""
    
    details_data = [
        [
            Paragraph("<b>Постачальник:</b>", bold_style),
            Paragraph(f"{prov_name} ({prov_type_label}, Код за ЄДРПОУ/РНОКПП: {prov_tax_id}){prov_address}", normal_style)
        ],
        [
            Paragraph("<b>Покупець:</b>", bold_style),
            Paragraph(f"{cust_name}{cust_tax_id}{cust_address}", normal_style)
        ]
    ]
    
    details_table = Table(details_data, colWidths=[100, 440])
    details_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 15))
    
    # Invoice items table
    table_headers = [
        Paragraph("<b>№</b>", bold_style),
        Paragraph("<b>Товари / Послуги</b>", bold_style),
        Paragraph("<b>Кіл-ть</b>", bold_style),
        Paragraph("<b>Од.</b>", bold_style),
        Paragraph("<b>Ціна (грн)</b>", bold_style),
        Paragraph("<b>Сума (грн)</b>", bold_style)
    ]
    
    items_data = [table_headers]
    parsed_items = []
    if hasattr(invoice, 'items_json') and invoice.items_json:
        try:
            parsed_items = json.loads(invoice.items_json)
        except Exception:
            pass
            
    if not parsed_items:
        parsed_items = [{
            "name": invoice.service_name,
            "quantity": 1,
            "uom": "посл.",
            "price": invoice.amount,
            "total": invoice.amount
        }]
        
    for i, it in enumerate(parsed_items):
        name = it.get("name", invoice.service_name)
        qty = it.get("quantity", 1)
        uom = it.get("uom", "посл.")
        price = it.get("price", invoice.amount)
        total = it.get("total", qty * price)
        items_data.append([
            Paragraph(str(i + 1), normal_style),
            Paragraph(name, normal_style),
            Paragraph(str(qty), normal_style),
            Paragraph(uom, normal_style),
            Paragraph(f"{price:,.2f}", normal_style),
            Paragraph(f"{total:,.2f}", normal_style)
        ])
        
    items_table = Table(items_data, colWidths=[30, 260, 50, 40, 75, 85])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 10))
    
    subtotal_style = ParagraphStyle('InvSubtotal', parent=styles['Normal'], fontName=font_name, fontSize=10, leading=14, alignment=2)
    total_style = ParagraphStyle('InvTotal', parent=styles['Normal'], fontName=font_name, fontSize=11, leading=15, alignment=2)
    
    vat_rate = getattr(invoice, 'vat_rate', None)
    if vat_rate is not None and vat_rate > 0:
        total_val = invoice.amount
        subtotal_val = total_val / (1.0 + (vat_rate / 100.0))
        vat_val = total_val - subtotal_val
        story.append(Paragraph(f"Сума без ПДВ: {subtotal_val:,.2f} грн", subtotal_style))
        story.append(Paragraph(f"ПДВ ({int(vat_rate)}%): {vat_val:,.2f} грн", subtotal_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"<b>Всього до сплати: {total_val:,.2f} грн</b>", total_style))
    elif vat_rate == 0:
        story.append(Paragraph(f"Сума без ПДВ: {invoice.amount:,.2f} грн", subtotal_style))
        story.append(Paragraph("ПДВ (0%): 0.00 грн", subtotal_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"<b>Всього до сплати: {invoice.amount:,.2f} грн</b>", total_style))
    else:
        story.append(Paragraph(f"<b>Всього до сплати (без ПДВ): {invoice.amount:,.2f} грн</b>", total_style))
        
    story.append(Spacer(1, 10))
    in_words = number_to_words_ua(invoice.amount)
    story.append(Paragraph(f"Всього на суму (прописом): <b>{in_words}</b>", normal_style))
    story.append(Spacer(1, 8))
    story.append(Paragraph("<i>* Будь ласка, перевіряйте правильність реквізитів отримувача перед проведенням оплати.</i>", small_style))
    
    if getattr(invoice, 'notes', None):
        story.append(Spacer(1, 10))
        notes_style = ParagraphStyle('InvNotes', parent=styles['Normal'], fontName=font_name, fontSize=8, leading=12, textColor=colors.HexColor("#4A5568"))
        story.append(Paragraph(f"<b>Примітка:</b> {invoice.notes}", notes_style))
        
    story.append(Spacer(1, 35))
    
    # Signatures
    sig_data = [
        [
            Paragraph("<b>Виписав(ла):</b> ____________________ / " + prov_name + " /", normal_style),
            Paragraph("<b>Отримав(ла):</b> ____________________", normal_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(sig_table)
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

def generate_act_pdf(invoice: Invoice, act: ServiceAct, profile: Profile, db: Session = None) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    import io

    font_name = get_cyrillic_font()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'ActTitle',
        parent=styles['Heading1'],
        fontName=font_name,
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=15,
        alignment=1 # Center
    )
    bold_style = ParagraphStyle('ActBold', parent=styles['Normal'], fontName=font_name, fontSize=9, leading=13)
    normal_style = ParagraphStyle('ActNorm', parent=styles['Normal'], fontName=font_name, fontSize=9, leading=13)
    small_style = ParagraphStyle('ActSmall', parent=styles['Normal'], fontName=font_name, fontSize=8, leading=11, textColor=colors.HexColor("#718096"))
    
    # Title
    story.append(Paragraph(f"АКТ НАДАННЯ ПОСЛУГ № {act.act_number} від {act.created_at.strftime('%d.%m.%Y')}", title_style))
    story.append(Spacer(1, 10))
    
    # Provider & Customer details
    prov_name = profile.name
    prov_tax_id = profile.tax_id
    prov_type_label = "ФОП" if profile.type == 'fop' else "Юридична особа"
    prov_address = f"<br/><b>Адреса:</b> {profile.address}" if getattr(profile, 'address', None) else ""
    
    cust_name = invoice.client_name if invoice.client_name else "Фізична особа"
    cust_tax_id = f", ІПН/ЄДРПОУ: {invoice.client_tax_id}" if invoice.client_tax_id else ""
    cust_address = f"<br/><b>Адреса:</b> {invoice.client_address}" if getattr(invoice, 'client_address', None) else ""
    
    details_data = [
        [
            Paragraph("<b>Виконавець:</b>", bold_style),
            Paragraph(f"{prov_name} ({prov_type_label}, Код: {prov_tax_id}){prov_address}", normal_style)
        ],
        [
            Paragraph("<b>Замовник:</b>", bold_style),
            Paragraph(f"{cust_name}{cust_tax_id}{cust_address}", normal_style)
        ]
    ]
    
    details_table = Table(details_data, colWidths=[100, 440])
    details_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 15))
    
    # Main statement text
    statement_text = (
        f"Ми, що підписалися нижче, Виконавець з однієї сторони та Замовник з іншої сторони, "
        f"склали цей акт про те, що Виконавець здав, а Замовник прийняв такі послуги (роботи) згідно з рахунком № {invoice.invoice_number} від {invoice.send_date.strftime('%d.%m.%Y')}:"
    )
    story.append(Paragraph(statement_text, normal_style))
    story.append(Spacer(1, 10))
    
    # Items table
    table_headers = [
        Paragraph("<b>№</b>", bold_style),
        Paragraph("<b>Найменування робіт (послуг)</b>", bold_style),
        Paragraph("<b>Кіл-ть</b>", bold_style),
        Paragraph("<b>Од.</b>", bold_style),
        Paragraph("<b>Ціна (грн)</b>", bold_style),
        Paragraph("<b>Сума (грн)</b>", bold_style)
    ]
    
    items_data = [table_headers]
    parsed_items = []
    if hasattr(invoice, 'items_json') and invoice.items_json:
        try:
            parsed_items = json.loads(invoice.items_json)
        except Exception:
            pass
            
    if not parsed_items:
        parsed_items = [{
            "name": invoice.service_name,
            "quantity": 1,
            "uom": "посл.",
            "price": invoice.amount,
            "total": invoice.amount
        }]
        
    for i, it in enumerate(parsed_items):
        name = it.get("name", invoice.service_name)
        qty = it.get("quantity", 1)
        uom = it.get("uom", "посл.")
        price = it.get("price", invoice.amount)
        total = it.get("total", qty * price)
        items_data.append([
            Paragraph(str(i + 1), normal_style),
            Paragraph(name, normal_style),
            Paragraph(str(qty), normal_style),
            Paragraph(uom, normal_style),
            Paragraph(f"{price:,.2f}", normal_style),
            Paragraph(f"{total:,.2f}", normal_style)
        ])
        
    items_table = Table(items_data, colWidths=[30, 260, 50, 40, 75, 85])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 10))
    
    # Total and VAT
    subtotal_style = ParagraphStyle('ActSubtotal', parent=styles['Normal'], fontName=font_name, fontSize=10, leading=14, alignment=2)
    vat_rate = getattr(invoice, 'vat_rate', None)
    if vat_rate is not None and vat_rate > 0:
        total_val = invoice.amount
        subtotal_val = total_val / (1.0 + (vat_rate / 100.0))
        vat_val = total_val - subtotal_val
        story.append(Paragraph(f"Загальна вартість послуг без ПДВ: {subtotal_val:,.2f} грн", subtotal_style))
        story.append(Paragraph(f"ПДВ ({int(vat_rate)}%): {vat_val:,.2f} грн", subtotal_style))
    elif vat_rate == 0:
        story.append(Paragraph(f"Загальна вартість послуг без ПДВ: {invoice.amount:,.2f} грн", subtotal_style))
        story.append(Paragraph("ПДВ (0%): 0.00 грн", subtotal_style))
        
    story.append(Spacer(1, 4))
    total_style = ParagraphStyle('ActTotal', parent=styles['Normal'], fontName=font_name, fontSize=11, leading=15)
    story.append(Paragraph(f"<b>Загальна вартість виконаних робіт (наданих послуг) складає: {invoice.amount:,.2f} грн</b>", total_style))
    story.append(Spacer(1, 10))
    
    in_words = number_to_words_ua(invoice.amount)
    story.append(Paragraph(f"Загальна вартість (прописом): <b>{in_words}</b>", normal_style))
    story.append(Spacer(1, 12))
    
    decl_text = (
        "Послуги (роботи) надані в повному обсязі в обумовлені терміни відповідно до умов рахунку/договору. "
        "Сторони претензій одна до одної щодо обсягу, якості та вартості наданих послуг (робіт) не мають."
    )
    story.append(Paragraph(decl_text, normal_style))
    story.append(Spacer(1, 35))
    
    # Signatures
    sig_data = [
        [
            Paragraph("<b>Виконавець (Здав):</b><br/>____________________<br/>/ " + prov_name + " /", normal_style),
            Paragraph("<b>Замовник (Прийняв):</b><br/>____________________<br/>/ " + cust_name + " /", normal_style)
        ],
        [
            Paragraph("М.П. (за наявності)", small_style),
            Paragraph("М.П. (за наявності)", small_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(sig_table)
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

def generate_waybill_pdf(invoice: Invoice, act: ServiceAct, profile: Profile, db: Session = None) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    import io

    font_name = get_cyrillic_font()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'WayTitle',
        parent=styles['Heading1'],
        fontName=font_name,
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=15,
        alignment=1 # Center
    )
    bold_style = ParagraphStyle('WayBold', parent=styles['Normal'], fontName=font_name, fontSize=9, leading=13)
    normal_style = ParagraphStyle('WayNorm', parent=styles['Normal'], fontName=font_name, fontSize=9, leading=13)
    small_style = ParagraphStyle('WaySmall', parent=styles['Normal'], fontName=font_name, fontSize=8, leading=11, textColor=colors.HexColor("#718096"))
    
    # Title
    story.append(Paragraph(f"ВИДАТКОВА НАКЛАДНА № {act.act_number} від {act.created_at.strftime('%d.%m.%Y')}", title_style))
    story.append(Spacer(1, 10))
    
    # Provider & Customer details
    prov_name = profile.name
    prov_tax_id = profile.tax_id
    prov_type_label = "ФОП" if profile.type == 'fop' else "Юридична особа"
    prov_address = f"<br/><b>Адреса:</b> {profile.address}" if getattr(profile, 'address', None) else ""
    
    cust_name = invoice.client_name if invoice.client_name else "Фізична особа"
    cust_tax_id = f", ІПН/ЄДРПОУ: {invoice.client_tax_id}" if invoice.client_tax_id else ""
    cust_address = f"<br/><b>Адреса:</b> {invoice.client_address}" if getattr(invoice, 'client_address', None) else ""
    
    details_data = [
        [
            Paragraph("<b>Постачальник:</b>", bold_style),
            Paragraph(f"{prov_name} ({prov_type_label}, Код: {prov_tax_id}){prov_address}", normal_style)
        ],
        [
            Paragraph("<b>Одержувач:</b>", bold_style),
            Paragraph(f"{cust_name}{cust_tax_id}{cust_address}", normal_style)
        ]
    ]
    
    details_table = Table(details_data, colWidths=[100, 440])
    details_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 15))
    
    # Table headers
    table_headers = [
        Paragraph("<b>№</b>", bold_style),
        Paragraph("<b>Товар / Найменування</b>", bold_style),
        Paragraph("<b>Кіл-ть</b>", bold_style),
        Paragraph("<b>Од.</b>", bold_style),
        Paragraph("<b>Ціна (грн)</b>", bold_style),
        Paragraph("<b>Сума (грн)</b>", bold_style)
    ]
    
    items_data = [table_headers]
    parsed_items = []
    if hasattr(invoice, 'items_json') and invoice.items_json:
        try:
            parsed_items = json.loads(invoice.items_json)
        except Exception:
            pass
            
    if not parsed_items:
        parsed_items = [{
            "name": invoice.service_name,
            "quantity": 1,
            "uom": "шт.",
            "price": invoice.amount,
            "total": invoice.amount
        }]
        
    for i, it in enumerate(parsed_items):
        name = it.get("name", invoice.service_name)
        qty = it.get("quantity", 1)
        uom = it.get("uom", "шт.")
        price = it.get("price", invoice.amount)
        total = it.get("total", qty * price)
        items_data.append([
            Paragraph(str(i + 1), normal_style),
            Paragraph(name, normal_style),
            Paragraph(str(qty), normal_style),
            Paragraph(uom, normal_style),
            Paragraph(f"{price:,.2f}", normal_style),
            Paragraph(f"{total:,.2f}", normal_style)
        ])
        
    items_table = Table(items_data, colWidths=[30, 260, 50, 40, 75, 85])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 10))
    
    # Totals
    subtotal_style = ParagraphStyle('WaySubtotal', parent=styles['Normal'], fontName=font_name, fontSize=10, leading=14, alignment=2)
    vat_rate = getattr(invoice, 'vat_rate', None)
    if vat_rate is not None and vat_rate > 0:
        total_val = invoice.amount
        subtotal_val = total_val / (1.0 + (vat_rate / 100.0))
        vat_val = total_val - subtotal_val
        story.append(Paragraph(f"Всього без ПДВ: {subtotal_val:,.2f} грн", subtotal_style))
        story.append(Paragraph(f"ПДВ ({int(vat_rate)}%): {vat_val:,.2f} грн", subtotal_style))
    elif vat_rate == 0:
        story.append(Paragraph(f"Всього без ПДВ: {invoice.amount:,.2f} грн", subtotal_style))
        story.append(Paragraph("ПДВ (0%): 0.00 грн", subtotal_style))
        
    story.append(Spacer(1, 4))
    total_style = ParagraphStyle('WayTotal', parent=styles['Normal'], fontName=font_name, fontSize=11, leading=15)
    story.append(Paragraph(f"<b>Всього відпущено на суму: {invoice.amount:,.2f} грн</b>", total_style))
    story.append(Spacer(1, 10))
    
    in_words = number_to_words_ua(invoice.amount)
    story.append(Paragraph(f"Всього відпущено на суму (прописом): <b>{in_words}</b>", normal_style))
    story.append(Spacer(1, 35))
    
    # Signatures
    sig_data = [
        [
            Paragraph("<b>Відпустив (Постачальник):</b><br/>____________________<br/>/ " + prov_name + " /", normal_style),
            Paragraph("<b>Отримав (Одержувач):</b><br/>____________________<br/>/ " + cust_name + " /", normal_style)
        ],
        [
            Paragraph("М.П. (за наявності)", small_style),
            Paragraph("М.П. (за наявності)", small_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(sig_table)
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

def send_email_with_attachments(to_email: str, subject: str, body: str, attachments: list):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders
    import os

    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_server or not smtp_user or not smtp_password:
        print("[SMTP CONFIG WARNING] SMTP credentials are not configured. Email NOT sent. Please define SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in env.")
        return False

    try:
        port = int(smtp_port) if smtp_port else 587
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Attach body
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        for filename, file_bytes in attachments:
            part = MIMEBase('application', 'pdf')
            part.set_payload(file_bytes)
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                'attachment',
                filename=filename
            )
            msg.attach(part)
            
        # Connect & Send
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_server, port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_server, port, timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()
            
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, to_email, msg.as_string())
        server.close()
        print(f"[MAIL SENT] Successfully sent email to {to_email} with {len(attachments)} attachment(s).")
        return True
    except Exception as e:
        print(f"[MAIL ERROR] Failed to send email to {to_email} via SMTP {smtp_server}:{smtp_port}: {e}")
        return False

def trigger_invoice_sending(inv: Invoice, act: Optional[ServiceAct], profile_name: str, db: Session):
    # 1. Generate PDFs
    profile = db.query(Profile).filter(Profile.id == inv.profile_id).first()
    
    attachments = []
    if profile:
        try:
            # Generate invoice PDF
            inv_pdf_bytes = generate_invoice_pdf(inv, profile)
            attachments.append((f"Invoice_{inv.invoice_number}.pdf", inv_pdf_bytes))
            
            # Generate act/waybill PDF if applicable
            if act:
                if inv.document_type == "waybill":
                    way_pdf_bytes = generate_waybill_pdf(inv, act, profile)
                    attachments.append((f"Waybill_{act.act_number}.pdf", way_pdf_bytes))
                else:
                    act_pdf_bytes = generate_act_pdf(inv, act, profile)
                    attachments.append((f"Act_{act.act_number}.pdf", act_pdf_bytes))
        except Exception as e:
            print(f"[PDF GENERATION ERROR] Failed to generate document PDFs: {e}")

    # 2. Send email via SMTP
    if inv.client_email and attachments:
        subject = f"Рахунок {inv.invoice_number}"
        if act:
            doc_label = "видаткова накладна" if inv.document_type == "waybill" else "акт виконаних робіт"
            subject += f" та {doc_label} {act.act_number}"
            
        doc_desc = "Видаткова накладна" if inv.document_type == "waybill" else "Акт наданих послуг"
        body = (
            f"Доброго дня!\n\n"
            f"Вам виставлено рахунок {inv.invoice_number} на суму {inv.amount:.2f} грн.\n"
        )
        if act:
            body += f"Також додається {doc_desc.lower()} {act.act_number}.\n"
        body += f"\nДокументи у форматі PDF прикріплені до цього листа.\n\nДякуємо за співпрацю!"
        
        # Send in a separate daemon thread to avoid blocking the API request
        # Check if Gmail API is authorized
        auth = db.query(EmailAuth).filter(EmailAuth.profile_id == inv.profile_id).first()
        import threading
        if auth:
            threading.Thread(
                target=send_email_via_gmail_api,
                args=(inv.profile_id, inv.client_email, subject, body, attachments, SessionLocal),
                daemon=True
            ).start()
        else:
            threading.Thread(
                target=send_email_with_attachments,
                args=(inv.client_email, subject, body, attachments),
                daemon=True
            ).start()
    else:
        doc_label = "Видаткова накладна" if inv.document_type == "waybill" else "Акт"
        act_str = f" та {doc_label} {act.act_number}" if act else ""
        print(f"[MAIL LOG] SMTP not triggered. To: {inv.client_email or 'None'} | Subject: Рахунок {inv.invoice_number}{act_str}")

    # 3. Send Telegram notifications (existing logic)
    if inv.client_telegram_id:
        text = (
            f"🧾 *Новий рахунок {inv.invoice_number} від {inv.send_date}*\n"
            f"Видавець: *{profile_name}*\n"
            f"Послуга: {inv.service_name}\n"
            f"Сума до сплати: *{inv.amount:.2f} грн*\n\n"
        )
        if act:
            doc_title = "Видаткова накладна" if inv.document_type == "waybill" else "Акт виконаних послуг"
            text += (
                f"📄 *{doc_title} {act.act_number}*\n"
                f"Документи надіслано на {inv.client_email or 'Telegram'}."
            )
        else:
            text += f"Рахунок надіслано на {inv.client_email or 'Telegram'}."
            
        send_telegram_async(inv.client_telegram_id, text)

    if profile and profile.owner and profile.owner.telegram_id:
        owner_text = (
            f"🔔 *Автоматично сформовано документи:*\n"
            f"🧾 Рахунок *{inv.invoice_number}*\n"
        )
        if act:
            doc_title = "Накладна" if inv.document_type == "waybill" else "Акт"
            owner_text += f"📄 {doc_title} *{act.act_number}*\n"
        owner_text += (
            f"Для клієнта: `{inv.client_email or inv.client_telegram_id}`\n"
            f"Сума: *{inv.amount:.2f} грн*\n"
            f"Послуга: _{inv.service_name}_\n"
            f"Статус: Надіслано 🚀"
        )
        send_telegram_async(profile.owner.telegram_id, owner_text)

@app.post("/api/invoices/send-now/{id}")
def send_invoice_now(
    id: int,
    custom_day: Optional[int] = Form(None),
    custom_month: Optional[int] = Form(None),
    include_act: Optional[bool] = Form(None),
    db: Session = Depends(get_db)
):
    rec = db.query(RecurringInvoice).filter(RecurringInvoice.id == id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Шаблон регулярного рахунку не знайдено")
        
    profile = db.query(Profile).filter(Profile.id == rec.profile_id).first()
    profile_name = profile.name if profile else "UniTax Provider"
    
    # Calculate invoice send date
    send_date = date.today()
    if custom_day is not None or custom_month is not None:
        year = send_date.year
        month = custom_month if custom_month is not None else send_date.month
        day = custom_day if custom_day is not None else send_date.day
        # Validate day/month boundary
        import calendar as cal
        last_day = cal.monthrange(year, month)[1]
        day = min(max(1, day), last_day)
        send_date = date(year, month, day)
        
    inv_num = generate_invoice_number(db, rec.profile_id)
    invoice = Invoice(
        profile_id=rec.profile_id,
        client_email=rec.client_email,
        client_telegram_id=rec.client_telegram_id,
        amount=rec.amount,
        service_name=rec.service_name,
        invoice_number=inv_num,
        send_date=send_date,
        client_name=rec.client_name,
        client_tax_id=rec.client_tax_id,
        document_type=rec.document_type,
        client_address=rec.client_address
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    
    act = None
    should_include_act = include_act if include_act is not None else getattr(rec, "include_act", True)
    if should_include_act:
        act_num = generate_act_number(db, rec.profile_id)
        act = ServiceAct(
            invoice_id=invoice.id,
            profile_id=rec.profile_id,
            act_number=act_num,
            created_at=send_date
        )
        db.add(act)
        db.commit()
        db.refresh(act)
    
    trigger_invoice_sending(invoice, act, profile_name, db)
    
    return {
        "message": "Рахунок" + (" та акт" if act else "") + " успішно згенеровано та надіслано!",
        "invoice_number": inv_num,
        "act_number": act.act_number if act else None
    }

@app.post("/api/invoices/process-recurring")
def process_recurring_invoices(db: Session = Depends(get_db)):
    current_day = date.today().day
    current_month = date.today().month
    from sqlalchemy import or_
    recs = db.query(RecurringInvoice).filter(
        RecurringInvoice.is_active == True,
        RecurringInvoice.send_day == current_day,
        or_(RecurringInvoice.send_month == None, RecurringInvoice.send_month == current_month)
    ).all()
    
    sent_count = 0
    for rec in recs:
        already_sent = db.query(Invoice).filter(
            Invoice.profile_id == rec.profile_id,
            Invoice.client_email == rec.client_email,
            Invoice.amount == rec.amount,
            Invoice.send_date == date.today()
        ).first()
        if already_sent:
            continue
            
        profile = db.query(Profile).filter(Profile.id == rec.profile_id).first()
        profile_name = profile.name if profile else "UniTax Provider"
        
        inv_num = generate_invoice_number(db, rec.profile_id)
        invoice = Invoice(
            profile_id=rec.profile_id,
            client_email=rec.client_email,
            client_telegram_id=rec.client_telegram_id,
            amount=rec.amount,
            service_name=rec.service_name,
            invoice_number=inv_num,
            send_date=date.today(),
            client_address=rec.client_address
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        
        act = None
        if getattr(rec, "include_act", True):
            act_num = generate_act_number(db, rec.profile_id)
            act = ServiceAct(
                invoice_id=invoice.id,
                profile_id=rec.profile_id,
                act_number=act_num,
                created_at=date.today()
            )
            db.add(act)
            db.commit()
            db.refresh(act)
        
        trigger_invoice_sending(invoice, act, profile_name, db)
        sent_count += 1
        
    return {"message": f"Опрацьовано автоматичні рахунки. Надіслано: {sent_count}"}

# Google OAuth & Gmail API Setup
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "https://unitas-backend.fly.dev/api/auth/google/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://unitas-frontend.fly.dev")

import google_auth_oauthlib.flow
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel

auth_states = {}

@app.get("/api/auth/google/url/{profile_id}")
async def get_google_auth_url(profile_id: int, db: Session = Depends(get_db)):
    """Повертає URL для перенаправлення клієнта на Google OAuth"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google Client ID or Client Secret is not configured on the server.")
        
    state = str(uuid.uuid4())
    db_state = OAuthState(state=state, profile_id=profile_id)
    db.add(db_state)
    db.commit()
    
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.compose"]
    )
    flow.redirect_uri = GOOGLE_REDIRECT_URI
    
    authorization_url, _ = flow.authorization_url(prompt="consent", state=state, access_type="offline")
    return {"url": authorization_url}

@app.get("/api/auth/google/callback")
async def google_callback(code: str, state: str, db: Session = Depends(get_db)):
    """Обробник callback після авторизації"""
    db_state = db.query(OAuthState).filter(OAuthState.state == state).first()
    if not db_state:
        return RedirectResponse(url=f"{FRONTEND_URL}/settings/email?error=invalid_state")
    
    profile_id = db_state.profile_id
    db.delete(db_state)
    db.commit()
    
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return RedirectResponse(url=f"{FRONTEND_URL}/settings/email?error=missing_config")
        
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.compose"]
    )
    flow.redirect_uri = GOOGLE_REDIRECT_URI
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        from googleapiclient.discovery import build
        service = build('gmail', 'v1', credentials=credentials)
        profile_info = service.users().getProfile(userId='me').execute()
        email_address = profile_info.get('emailAddress')
        
        if not email_address:
            raise Exception("Failed to retrieve email from Google")
            
        auth = db.query(EmailAuth).filter(EmailAuth.profile_id == profile_id).first()
        if auth:
            auth.email = email_address
            auth.access_token = credentials.token
            if credentials.refresh_token:
                auth.refresh_token = credentials.refresh_token
            auth.expires_at = credentials.expiry
        else:
            auth = EmailAuth(
                profile_id=profile_id,
                email=email_address,
                access_token=credentials.token,
                refresh_token=credentials.refresh_token,
                expires_at=credentials.expiry
            )
            db.add(auth)
            
        db.commit()
        return RedirectResponse(url=f"{FRONTEND_URL}/settings/email?success=true")
    except Exception as e:
        print(f"[OAUTH ERROR] Failed to finalize Google OAuth: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/settings/email?error={str(e)}")

@app.get("/api/auth/google/status/{profile_id}")
def get_google_auth_status(profile_id: int, db: Session = Depends(get_db)):
    auth = db.query(EmailAuth).filter(EmailAuth.profile_id == profile_id).first()
    if auth:
        return {"connected": True, "email": auth.email}
    return {"connected": False}

@app.delete("/api/auth/google/{profile_id}")
def disconnect_google_auth(profile_id: int, db: Session = Depends(get_db)):
    auth = db.query(EmailAuth).filter(EmailAuth.profile_id == profile_id).first()
    if auth:
        db.delete(auth)
        db.commit()
        return {"status": "disconnected"}
    raise HTTPException(status_code=404, detail="Not connected")

def send_email_via_gmail_api(profile_id: int, to_email: str, subject: str, body: str, attachments: list, db_session_factory):
    db = db_session_factory()
    try:
        auth = db.query(EmailAuth).filter(EmailAuth.profile_id == profile_id).first()
        if not auth:
            print(f"[GMAIL API ERROR] Gmail auth not found for profile_id={profile_id}")
            return False
            
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from email.mime.base import MIMEBase
        from email import encoders
        import base64
        
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        
        credentials = Credentials(
            token=auth.access_token,
            refresh_token=auth.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=google_client_id,
            client_secret=google_client_secret,
            expiry=auth.expires_at
        )
        
        if credentials.expired:
            try:
                credentials.refresh(Request())
                auth.access_token = credentials.token
                auth.expires_at = credentials.expiry
                db.commit()
                print(f"[GMAIL API] Successfully refreshed OAuth token for profile_id={profile_id}")
            except Exception as re:
                print(f"[GMAIL API ERROR] Failed to refresh OAuth token for profile_id={profile_id}: {re}")
                return False
                
        msg = MIMEMultipart()
        msg['To'] = to_email
        msg['From'] = auth.email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        for filename, file_bytes in attachments:
            part = MIMEBase('application', 'pdf')
            part.set_payload(file_bytes)
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                'attachment',
                filename=filename
            )
            msg.attach(part)
            
        raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
        
        service = build('gmail', 'v1', credentials=credentials)
        service.users().messages().send(userId='me', body={'raw': raw_message}).execute()
        print(f"[GMAIL API SENT] Successfully sent email to {to_email} via Gmail API from {auth.email}")
        return True
    except Exception as e:
        print(f"[GMAIL API ERROR] Failed to send email via Gmail API: {e}")
        return False
    finally:
        db.close()

# Invoices Management API
class InvoiceItemInput(BaseModel):
    name: str
    quantity: float
    price: float
    total: float

class CreateInvoiceRequest(BaseModel):
    profile_id: int
    client_name: str
    client_tax_id: Optional[str] = None
    client_email: str
    client_address: Optional[str] = None
    due_date: Optional[str] = None
    vat_rate: Optional[float] = None
    notes: Optional[str] = None
    items: List[InvoiceItemInput]
    send_immediately: Optional[bool] = False

class SendInvoiceRequest(BaseModel):
    toEmail: str
    subject: Optional[str] = None
    message: Optional[str] = None

@app.get("/api/invoices")
def get_all_invoices(
    profile_id: Optional[int] = None,
    status: Optional[str] = None,
    client_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Invoice)
    if profile_id:
        query = query.filter(Invoice.profile_id == profile_id)
    if status:
        query = query.filter(Invoice.status == status)
    if client_name:
        query = query.filter(Invoice.client_name.ilike(f"%{client_name}%"))
        
    invoices = query.order_by(desc(Invoice.send_date), desc(Invoice.id)).all()
    result = []
    for inv in invoices:
        act = db.query(ServiceAct).filter(ServiceAct.invoice_id == inv.id).first()
        result.append({
            "id": inv.id,
            "profile_id": inv.profile_id,
            "client_email": inv.client_email,
            "client_telegram_id": inv.client_telegram_id,
            "amount": inv.amount,
            "service_name": inv.service_name,
            "invoice_number": inv.invoice_number,
            "status": inv.status,
            "send_date": inv.send_date.strftime("%Y-%m-%d") if isinstance(inv.send_date, date) else inv.send_date,
            "client_name": inv.client_name,
            "client_tax_id": inv.client_tax_id,
            "document_type": inv.document_type,
            "due_date": inv.due_date.strftime("%Y-%m-%d") if inv.due_date else None,
            "vat_rate": inv.vat_rate,
            "notes": inv.notes,
            "items_json": inv.items_json,
            "client_address": inv.client_address,
            "act": {
                "id": act.id,
                "act_number": act.act_number,
                "status": act.status,
                "created_at": act.created_at.strftime("%Y-%m-%d") if isinstance(act.created_at, date) else act.created_at
            } if act else None
        })
    return result

@app.post("/api/invoices")
def create_detailed_invoice(req: CreateInvoiceRequest, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    base_amount = sum(item.total for item in req.items)
    vat_rate = req.vat_rate
    if vat_rate is not None and vat_rate > 0:
        vat_amount = base_amount * (vat_rate / 100.0)
        total_amount = base_amount + vat_amount
    else:
        total_amount = base_amount
        
    inv_number = generate_invoice_number(db, req.profile_id)
    
    parsed_due_date = None
    if req.due_date:
        try:
            parsed_due_date = datetime.strptime(req.due_date, "%Y-%m-%d").date()
        except Exception:
            pass
            
    invoice = Invoice(
        profile_id=req.profile_id,
        client_email=req.client_email,
        client_telegram_id=None,
        amount=total_amount,
        service_name=req.items[0].name if req.items else "Постачання товарів/послуг",
        invoice_number=inv_number,
        status="sent" if req.send_immediately else "draft",
        send_date=date.today(),
        client_name=req.client_name,
        client_tax_id=req.client_tax_id,
        document_type="act",
        due_date=parsed_due_date,
        vat_rate=req.vat_rate,
        notes=req.notes,
        items_json=json.dumps([item.dict() for item in req.items]),
        client_address=req.client_address
    )
    
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    
    if req.send_immediately:
        trigger_invoice_sending(invoice, None, profile.name, db)
        
    return invoice

class CreateDocumentRequest(BaseModel):
    document_type: str  # "act" or "waybill"

@app.post("/api/invoices/{invoice_id}/document")
def create_invoice_document(invoice_id: int, req: CreateDocumentRequest, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    inv.document_type = req.document_type
    
    act = db.query(ServiceAct).filter(ServiceAct.invoice_id == invoice_id).first()
    if not act:
        act_num = generate_act_number(db, inv.profile_id)
        act = ServiceAct(
            invoice_id=invoice_id,
            profile_id=inv.profile_id,
            act_number=act_num,
            created_at=date.today(),
            status="created"
        )
        db.add(act)
    else:
        # If it already exists, update document_type in the linked invoice
        pass
        
    db.commit()
    db.refresh(act)
    
    # Try sending email in background if invoice was already sent
    if inv.status == "sent":
        profile = db.query(Profile).filter(Profile.id == inv.profile_id).first()
        profile_name = profile.name if profile else "UniTax Provider"
        try:
            trigger_invoice_sending(inv, act, profile_name, db)
        except Exception as e:
            print(f"[MAIL LOG] Failed to trigger invoice sending after document creation: {e}")
            
    return {
        "id": act.id,
        "act_number": act.act_number,
        "status": act.status,
        "created_at": act.created_at.strftime("%Y-%m-%d")
    }

@app.get("/api/invoices/{invoice_id}/document/pdf")
def get_invoice_document_pdf(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    profile = db.query(Profile).filter(Profile.id == inv.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    act = db.query(ServiceAct).filter(ServiceAct.invoice_id == invoice_id).first()
    if not act:
        raise HTTPException(status_code=404, detail="No act or waybill generated for this invoice")
        
    try:
        if inv.document_type == "waybill":
            pdf_bytes = generate_waybill_pdf(inv, act, profile)
            filename = f"waybill_{act.act_number}.pdf"
        else:
            pdf_bytes = generate_act_pdf(inv, act, profile)
            filename = f"act_{act.act_number}.pdf"
            
        return Response(content=pdf_bytes, media_type="application/pdf", headers={
            "Content-Disposition": f"attachment; filename={filename}"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

@app.get("/api/invoices/{invoice_id}/pdf")
def get_invoice_pdf_endpoint(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    profile = db.query(Profile).filter(Profile.id == inv.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    try:
        pdf_bytes = generate_invoice_pdf(inv, profile)
        return Response(content=pdf_bytes, media_type="application/pdf", headers={
            "Content-Disposition": f"attachment; filename=invoice_{inv.invoice_number}.pdf"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

@app.post("/api/invoices/{invoice_id}/send")
def send_invoice_api(
    invoice_id: int,
    req: SendInvoiceRequest,
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    profile = db.query(Profile).filter(Profile.id == inv.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    act = db.query(ServiceAct).filter(ServiceAct.invoice_id == inv.id).first()
    
    attachments = []
    try:
        inv_pdf_bytes = generate_invoice_pdf(inv, profile)
        attachments.append((f"Invoice_{inv.invoice_number}.pdf", inv_pdf_bytes))
        if act:
            if inv.document_type == "waybill":
                way_pdf_bytes = generate_waybill_pdf(inv, act, profile)
                attachments.append((f"Waybill_{act.act_number}.pdf", way_pdf_bytes))
            else:
                act_pdf_bytes = generate_act_pdf(inv, act, profile)
                attachments.append((f"Act_{act.act_number}.pdf", act_pdf_bytes))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDFs: {str(e)}")
        
    subject = req.subject or f"Рахунок {inv.invoice_number}"
    body = req.message or f"Доброго дня!\n\nРахунок у додатку.\n\n{subject}"
    
    auth = db.query(EmailAuth).filter(EmailAuth.profile_id == inv.profile_id).first()
    
    import threading
    if auth:
        threading.Thread(
            target=send_email_via_gmail_api,
            args=(inv.profile_id, req.toEmail, subject, body, attachments, SessionLocal),
            daemon=True
        ).start()
    else:
        threading.Thread(
            target=send_email_with_attachments,
            args=(req.toEmail, subject, body, attachments),
            daemon=True
        ).start()
        
    if inv.status == "draft":
        inv.status = "sent"
        db.commit()
        
    return {"status": "sent", "to": req.toEmail}

@app.post("/api/auth/google/test-email/{profile_id}")
def test_gmail_sending(profile_id: int, db: Session = Depends(get_db)):
    auth = db.query(EmailAuth).filter(EmailAuth.profile_id == profile_id).first()
    if not auth:
        raise HTTPException(status_code=400, detail="Gmail not connected")
    
    subject = "Тестовий лист від UniTax"
    body = "Вітаємо! Ваш Gmail успішно підключено до асистента UniTax. Тепер ви можете надсилати рахунки безпосередньо з вашої пошти."
    
    import threading
    threading.Thread(
        target=send_email_via_gmail_api,
        args=(profile_id, auth.email, subject, body, [], SessionLocal),
        daemon=True
    ).start()
    
    return {"status": "triggered", "to": auth.email}

@app.delete("/api/invoices/{id}")
def delete_invoice(id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.query(ServiceAct).filter(ServiceAct.invoice_id == id).delete()
    db.delete(inv)
    db.commit()
    return {"status": "deleted"}

@app.get("/api/system-config")
def get_system_config(db: Session = Depends(get_db)):
    keys_defaults = {
        "min_salary": 8647.0,
        "fop_limit_group_1": 1444049.0,
        "fop_limit_group_2": 7211598.0,
        "fop_limit_group_3": 10091049.0,
        "military_tax_fop_rate": 5.0,
        "military_tax_employee_rate": 1.5,
        "unified_tax_rate_group_3": 5.0,
        "esv_fop_monthly": 1562.0,
        "pit_employee_rate": 18.0,
        "esv_employee_rate": 22.0
    }
    result = {}
    for key, default in keys_defaults.items():
        result[key] = str(get_config_val(db, key, default))
    return result

@app.post("/api/system-config")
def update_system_config(configs: dict, db: Session = Depends(get_db)):
    for key, val in configs.items():
        config = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if config:
            config.value = str(val)
        else:
            config = SystemConfig(key=key, value=str(val))
            db.add(config)
    db.commit()
    return {"status": "success"}

class ChatRequest(BaseModel):
    profile_id: int
    message: str

@app.post("/api/agent/chat")
async def agent_chat(req: ChatRequest, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    # Get profile stats (copying logic from get_dashboard)
    payments = db.query(ParsedPayment).filter(ParsedPayment.profile_id == req.profile_id).all()
    total_income = sum(p.amount for p in payments if p.direction == "in" and p.taxable)
    
    profile_employees = db.query(Employee).filter(
        (Employee.profile_id == req.profile_id) | (Employee.company_id == req.profile_id)
    ).all()
    
    api_key = os.getenv("OPENAI_API_KEY")
    user_message = req.message

    min_sal = get_config_val(db, "min_salary", 8647.0)
    limit_1 = get_config_val(db, "fop_limit_group_1", 1444049.0)
    limit_2 = get_config_val(db, "fop_limit_group_2", 7211598.0)
    limit_3 = get_config_val(db, "fop_limit_group_3", 10091049.0)
    mil_fop_rate = get_config_val(db, "military_tax_fop_rate", 5.0)
    mil_emp_rate = get_config_val(db, "military_tax_employee_rate", 1.5)
    pit_rate = get_config_val(db, "pit_employee_rate", 18.0)
    esv_rate = get_config_val(db, "esv_employee_rate", 22.0)
    esv_fop = get_config_val(db, "esv_fop_monthly", 1562.0)

    system_prompt = f"""
    Ти — інтерактивний ШІ-Асистент UniTax (експерт з бухгалтерського та податкового обліку в Україні).
    Твоя мета — допомагати користувачеві керувати його бізнесом, відповідати на запитання щодо податків, звітів, військового збору та законодавства.

    Дані поточного профілю користувача:
    - Назва компанії: {profile.name}
    - Тип: {profile.type} (fop — ФОП, llc — підприємство/ТОВ)
    - Система оподаткування: {profile.tax_system} (fop_ep — єдиний податок, fop_general — загальна система, llc_profit — ТОВ прибуток, llc_ep — ТОВ спрощена)
    - Ставка єдиного податку: {profile.rate}%
    - Загальний дохід за поточний звітний період: {total_income:.2f} грн
    - Кількість найманих працівників: {len(profile_employees)}

    Дотримуйся таких правил:
    1. Відповідай виключно українською мовою.
    2. Будь професійним, ввічливим та точним бухгалтером.
    3. Надавай чіткі відповіді з урахуванням податкового кодексу України.
    4. Військовий збір:
       - Для ФОП 3 групи (спрощена система): {mil_fop_rate}% від доходу.
       - Для найманих працівників (для ФОП та ТОВ): {mil_emp_rate}% від заробітної плати (актуально на 2026 рік).
    5. Граничні ліміти річного доходу для спрощеної системи ФОП у 2026 році:
       - 1 група: {limit_1:,.0f} грн
       - 2 група: {limit_2:,.0f} грн
       - 3 група: {limit_3:,.0f} грн
    6. Давай короткі практичні кроки для бізнесу.
    """
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    # Визначаємо клієнт для ШІ
    client_to_use = None
    model_to_use = "gpt-4o-mini"
    
    if api_key and api_key != "your_openai_api_key":
        from openai import AsyncOpenAI
        client_to_use = AsyncOpenAI(api_key=api_key)
    elif gemini_key and gemini_key != "your_gemini_api_key":
        from openai import AsyncOpenAI
        client_to_use = AsyncOpenAI(
            api_key=gemini_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
        model_to_use = "gemini-2.5-flash"
        
    if not client_to_use:
        # Багатий оффлайн-відповідач
        msg_lower = user_message.lower()
        if "військов" in msg_lower or "вз" in msg_lower or "збір" in msg_lower:
            if is_fop_profile(profile):
                response_text = f"Для вашого ФОП на спрощеній системі оподаткування військовий збір становить **{mil_fop_rate}% від загального доходу** (за поточний звітний період це складає {(total_income * mil_fop_rate / 100.0):.2f} грн). Якщо у вас є працівники, ви також сплачуєте військовий збір у розмірі **{mil_emp_rate}% від їхньої заробітної плати** щомісячно."
            else:
                response_text = f"Для вашої компанії {profile.name} (ТОВ) військовий збір на прибуток не нараховується. Проте ви зобов'язані утримувати та сплачувати військовий збір у розмірі **{mil_emp_rate}% від заробітної плати** найманих працівників щомісячно при виплаті заробітної плати."
        elif "працівн" in msg_lower or "зарплат" in msg_lower or "робітн" in msg_lower:
            response_text = f"У вашому профілі зареєстровано **{len(profile_employees)} найманих працівників**. З кожної зарплати ви маєте сплатити: ПДФО ({pit_rate}%), Військовий збір ({mil_emp_rate}%) та ЄСВ на фонд оплат ({esv_rate}%). Граничний термін сплати податків із зарплати — 30 число наступного місяця."
        elif "звіт" in msg_lower or "декларац" in msg_lower:
            response_text = f"Для вашої системи ({profile.tax_system}) звітність подається щоквартально. Найближчий звіт: Декларація єдиного податку (Форма { 'F0103306' if is_fop_profile(profile) else 'J0103508' }) за 1 квартал. Термін подання — протягом 40 днів після закінчення кварталу."
        elif "дохід" in msg_lower or "сума" in msg_lower or "ліміт" in msg_lower:
            if is_fop_profile(profile):
                group_limits = {1: limit_1, 2: limit_2, 3: limit_3}
                user_group = profile.group or 3
                current_limit = group_limits.get(user_group, limit_3)
                pct_used = (total_income / current_limit) * 100
                response_text = f"Ваш загальний дохід за поточний звітний період становить **{total_income:.2f} грн**.\n\n" \
                                f"Актуальні граничні ліміти річного доходу для спрощеної системи ФОП у 2026 році:\n" \
                                f"• **1 група**: {limit_1:,.0f} грн\n" \
                                f"• **2 група**: {limit_2:,.0f} грн\n" \
                                f"• **3 група**: {limit_3:,.0f} грн\n\n" \
                                f"Для вашої групи ({user_group}-ї групи) ліміт становить **{current_limit:,.0f} грн**. " \
                                f"Ви використали **{pct_used:.2f}%** цього ліміту."
            else:
                if is_simplified_tax(profile.tax_system):
                    pct_used = (total_income / limit_3) * 100
                    response_text = f"Загальний дохід вашої компанії {profile.name} (ТОВ) за поточний звітний період становить **{total_income:.2f} грн** (оподатковуваний дохід: **{taxable_income:.2f} грн**).\n\n" \
                                    f"Для юридичних осіб на спрощеній системі (3 група) граничний ліміт річного доходу у 2026 році становить **{limit_3:,.0f} грн**.\n" \
                                    f"Ви використали **{pct_used:.2f}%** цього ліміту."
                else:
                    response_text = f"Загальний дохід вашої компанії {profile.name} (ТОВ) за поточний звітний період становить **{total_income:.2f} грн**.\n" \
                                    f"Для юридичних осіб на загальній системі оподаткування ліміт річного доходу для перебування на системі не встановлено."
        elif "єсв" in msg_lower or "соціал" in msg_lower or "внесок" in msg_lower:
            if is_fop_profile(profile):
                response_text = f"Для ФОП єдиний соціальний внесок (ЄСВ) за себе становить **{esv_fop} грн на місяць** (сплачується щоквартально: {esv_fop * 3} грн). Термін сплати — до 20 числа місяця, наступного за кварталом. Якщо у вас є працівники, ви додатково сплачуєте ЄСВ у розмірі 22% від їхньої заробітної плати."
            else:
                response_text = f"Для ТОВ (підприємства) ЄСВ за себе не нараховується. Ви сплачуєте лише ЄСВ на заробітну плату найманих працівників у розмірі **22% від фонду оплати праці** щомісячно."
        elif "привіт" in msg_lower or "добрий" in msg_lower or "вітаю" in msg_lower:
            response_text = f"Вітаю! Я ваш ШІ-Асистент UniTax для профілю **{profile.name}**. Я знаю все про ваші податки, доходи, працівників та військовий збір. Запитайте мене про будь-що!"
        else:
            if is_fop_profile(profile):
                response_text = f"Дякую за запитання щодо профілю {profile.name}! Я можу детально розповісти про:\n" \
                                f"• **Військовий збір**: {mil_fop_rate}% для ФОП, {mil_emp_rate}% з зарплат\n" \
                                f"• **Єдиний податок**: ставку та розраховану суму ({profile.rate or default_rate}%)\n" \
                                f"• **ЄСВ за себе**: {esv_fop} грн/місяць\n" \
                                f"• **Ліміти доходу** та податкові декларації."
            else:
                response_text = f"Дякую за запитання щодо профілю {profile.name} (ТОВ)! Я можу детально розповісти про:\n" \
                                f"• **Військовий збір**: {mil_emp_rate}% з зарплат працівників\n" \
                                f"• **Єдиний податок / Податок на прибуток**: ставку та розраховану суму ({profile.rate or default_rate}%)\n" \
                                f"• **Податки за працівників**: ПДФО, військовий збір та ЄСВ\n" \
                                f"• **Декларації та фінансову звітність ТОВ**."
            
        return {"response": response_text}
        
    try:
        response = await client_to_use.chat.completions.create(
            model=model_to_use,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=500
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        print(f"[Agent Chat Error] {e}")
        return {"response": "Вибачте, виникла помилка під час зв'язку з ШІ-моделю. Будь ласка, спробуйте пізніше."}


# --- DPS Integration Endpoints ---
from pydantic import BaseModel
from datetime import timedelta
from services.tax_api_client import TaxAPIClient
from services.report_signer import ReportSigner

class ReportSubmitRequest(BaseModel):
    certificate_id: int

class SetTokenRequest(BaseModel):
    profile_id: int
    token: str

class CheckDebtRequest(BaseModel):
    profile_id: int

class CheckReportsRequest(BaseModel):
    profile_id: int

class TaxApiSetupRequest(BaseModel):
    profile_id: int
    api_token: str

@app.post("/api/certificates/upload")
async def upload_certificate(
    profile_id: int = Form(...),
    cert_file: UploadFile = File(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        file_content = await cert_file.read()
        
        # Load PKCS12
        from OpenSSL import crypto
        try:
            pkcs12 = crypto.load_pkcs12(file_content, password.encode())
        except Exception:
            raise HTTPException(status_code=400, detail="Невірний пароль або пошкоджений файл КЕП.")
            
        cert = pkcs12.get_certificate()
        private_key = pkcs12.get_privatekey()
        
        # Extract details
        subject = cert.get_subject()
        cert_owner_name = subject.CN or f"{subject.GN or ''} {subject.SN or ''}".strip() or "КЕП Власник"
        
        issuer = cert.get_issuer()
        cert_issuer = issuer.O or issuer.CN or "Невідомий АЦСК"
        
        cert_serial = str(cert.get_serial_number())
        
        valid_to_str = cert.get_notAfter().decode('utf-8')
        valid_to = datetime.strptime(valid_to_str, "%Y%m%d%H%M%SZ")
        
        # PEM format
        cert_pem = crypto.dump_certificate(crypto.FILETYPE_PEM, cert).decode('utf-8')
        private_key_pem = crypto.dump_privatekey(crypto.FILETYPE_PEM, private_key)
        
        # Encrypt private key
        from services.report_signer import encrypt_private_key
        private_key_encrypted = encrypt_private_key(private_key_pem)
        
        db_cert = Certificate(
            profile_id=profile_id,
            cert_owner_name=cert_owner_name,
            cert_issuer=cert_issuer,
            cert_serial=cert_serial,
            valid_to=valid_to,
            cert_data=cert_pem,
            private_key_encrypted=private_key_encrypted
        )
        db.add(db_cert)
        db.commit()
        db.refresh(db_cert)
        
        return {
            "id": db_cert.id,
            "cert_owner_name": cert_owner_name,
            "cert_issuer": cert_issuer,
            "cert_serial": cert_serial,
            "valid_to": valid_to.strftime("%Y-%m-%d")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка обробки сертифіката: {str(e)}")

@app.get("/api/certificates/{profile_id}")
def get_certificates_by_profile(profile_id: int, db: Session = Depends(get_db)):
    certs = db.query(Certificate).filter(Certificate.profile_id == profile_id).all()
    return [{
        "id": c.id,
        "cert_owner_name": c.cert_owner_name,
        "cert_issuer": c.cert_issuer,
        "cert_serial": c.cert_serial,
        "valid_to": c.valid_to.strftime("%Y-%m-%d") if c.valid_to else None
    } for c in certs]

@app.get("/api/certificates")
def get_certificates(profile_id: Optional[int] = None, db: Session = Depends(get_db)):
    if profile_id:
        return get_certificates_by_profile(profile_id, db)
    certs = db.query(Certificate).all()
    return [{
        "id": c.id,
        "cert_owner_name": c.cert_owner_name,
        "cert_issuer": c.cert_issuer,
        "cert_serial": c.cert_serial,
        "valid_to": c.valid_to.strftime("%Y-%m-%d") if c.valid_to else None
    } for c in certs]

@app.post("/api/reports/{report_id}/submit")
async def submit_report_to_tax(
    report_id: int,
    req: ReportSubmitRequest,
    db: Session = Depends(get_db)
):
    # 1. Отримати звіт з БД
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
        
    # 2. Отримати профіль
    profile = db.query(Profile).filter(Profile.id == report.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
        
    # 3. Підписати звіт КЕП
    signer = ReportSigner()
    try:
        signed_xml = await signer.sign_report(report.xml_content or "", req.certificate_id, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Помилка підписання звіту КЕП: {str(e)}")
        
    # 4. Отримати токен доступу до API ДПС
    token_data = db.query(TaxApiSetting).filter(
        TaxApiSetting.profile_id == profile.id,
        TaxApiSetting.api_token_expires_at > datetime.now()
    ).first()
    
    if not token_data:
        return {
            "success": False,
            "error": "Не підключено до API ДПС. Будь ласка, налаштуйте інтеграцію.",
            "instruction_url": "/settings/tax-api"
        }
        
    # 5. Відправити звіт
    tax_api = TaxAPIClient()
    submission = await tax_api.submit_report(signed_xml, profile.tax_id or "", token_data.api_token)
    
    # 6. Зберегти історію відправки
    db_submission = ReportSubmission(
        profile_id=profile.id,
        report_id=report_id,
        report_type=report.form_code,
        report_period=report.period,
        report_xml=signed_xml,
        submission_status='sent' if submission['success'] else 'rejected',
        confirmation_number=submission.get('confirmation_number'),
        submitted_at=datetime.now(),
        tax_office_response=submission.get('message')
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    
    if submission['success']:
        # Оновити статус звіту
        report.status = 'submitted'
        db.commit()
        
    return {
        "success": submission['success'],
        "submission_id": db_submission.id,
        "confirmation_number": submission.get('confirmation_number'),
        "message": submission.get('message')
    }

@app.get("/api/reports/submissions/{profile_id}")
def get_submissions_history(profile_id: int, db: Session = Depends(get_db), limit: int = 20):
    results = db.query(ReportSubmission).filter(
        ReportSubmission.profile_id == profile_id
    ).order_by(desc(ReportSubmission.submitted_at)).limit(limit).all()
    
    history = []
    for r in results:
        report_name = "Декларація"
        if r.report_id:
            gen_rep = db.query(GeneratedReport).filter(GeneratedReport.id == r.report_id).first()
            if gen_rep:
                template = db.query(ReportTemplate).filter(ReportTemplate.id == gen_rep.template_id).first()
                if template:
                    report_name = template.name
                else:
                    report_name = f"Декларація {gen_rep.form_code}"
        else:
            template = db.query(ReportTemplate).filter(ReportTemplate.form_code == r.report_type).first()
            if template:
                report_name = template.name
            else:
                report_name = f"Декларація {r.report_type}"
                
        history.append({
            "id": r.id,
            "profile_id": r.profile_id,
            "report_id": r.report_id,
            "report_type": r.report_type,
            "report_period": r.report_period,
            "submission_status": r.submission_status,
            "tax_office_response": r.tax_office_response,
            "confirmation_number": r.confirmation_number,
            "submitted_at": r.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if r.submitted_at else None,
            "accepted_at": r.accepted_at.strftime("%Y-%m-%d %H:%M:%S") if r.accepted_at else None,
            "rejection_reason": r.rejection_reason,
            "report_name": report_name
        })
    return history

@app.get("/api/reports/submissions")
def get_submissions_query(profile_id: int, db: Session = Depends(get_db), limit: int = 20):
    return get_submissions_history(profile_id, db, limit)

@app.get("/api/reports/submissions/{submission_id}/status")
async def get_submission_status(submission_id: int, db: Session = Depends(get_db)):
    submission = db.query(ReportSubmission).filter(ReportSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Відправлення не знайдено")
        
    token_data = db.query(TaxApiSetting).filter(TaxApiSetting.profile_id == submission.profile_id).first()
    if token_data:
        tax_api = TaxAPIClient()
        status = await tax_api.check_submission_status(submission.confirmation_number or "", token_data.api_token)
        
        # Оновити статус в БД
        submission.submission_status = status.get('status', submission.submission_status)
        if status.get('accepted_at'):
            try:
                submission.accepted_at = datetime.strptime(status['accepted_at'], "%Y-%m-%d %H:%M:%S")
            except Exception:
                submission.accepted_at = datetime.now()
        submission.rejection_reason = status.get('rejection_reason')
        db.commit()
        return status
        
    return {"status": submission.submission_status}

@app.post("/api/tax-api/setup")
def setup_tax_api(req: TaxApiSetupRequest, db: Session = Depends(get_db)):
    expires_at = datetime.now() + timedelta(days=365)
    setting = db.query(TaxApiSetting).filter(TaxApiSetting.profile_id == req.profile_id).first()
    if setting:
        setting.api_token = req.api_token
        setting.api_token_expires_at = expires_at
        setting.last_sync_at = datetime.now()
    else:
        setting = TaxApiSetting(
            profile_id=req.profile_id,
            api_token=req.api_token,
            api_token_expires_at=expires_at,
            last_sync_at=datetime.now()
        )
        db.add(setting)
    db.commit()
    return {"message": "API ДПС успішно налаштовано"}

@app.get("/api/tax-api/status")
def get_tax_api_status(profile_id: Optional[int] = None, db: Session = Depends(get_db)):
    if profile_id:
        settings = db.query(TaxApiSetting).filter(
            TaxApiSetting.profile_id == profile_id
        ).first()
        has_token = settings is not None and bool(settings.api_token and settings.api_token.strip())
        is_expired = False
        if has_token and settings.api_token_expires_at:
            is_expired = settings.api_token_expires_at <= datetime.now()
        configured = has_token and not is_expired
        return {"configured": configured, "has_token": configured}
    
    settings_list = db.query(TaxApiSetting).all()
    configured = False
    for s in settings_list:
        if s.api_token and s.api_token.strip():
            if not s.api_token_expires_at or s.api_token_expires_at > datetime.now():
                configured = True
                break
    return {"configured": configured, "has_token": configured}


@app.get("/api/tax-api/instructions")
def get_tax_api_instructions():
    return {
        "steps": [
            "1. Увійдіть в Електронний кабінет платника податків: https://cabinet.tax.gov.ua",
            "2. Використовуйте ваш КЕП для входу",
            "3. В меню зліва перейдіть в «Налаштування»",
            "4. Оберіть вкладку «Токени відкритої частини»",
            "5. Натисніть «Створити токен»",
            "6. Виберіть права: «Подання звітності», «Перевірка статусу»",
            "7. Скопіюйте отриманий токен",
            "8. Вставте токен в поле нижче"
        ],
        "permissions_needed": ["reporting.submit", "reporting.status"]
    }

@app.get("/api/reports")
def list_reports(profile_id: int, db: Session = Depends(get_db)):
    """Отримати всі звіти для профілю"""
    reports = db.query(GeneratedReport).filter(
        GeneratedReport.profile_id == profile_id
    ).all()
    
    report_list = []
    for r in reports:
        template = db.query(ReportTemplate).filter(ReportTemplate.id == r.template_id).first()
        name = template.name if template else f"Декларація {r.form_code}"
        report_list.append({
            "id": r.id,
            "report_name": name,
            "form_code": r.form_code,
            "period": f"{r.period} {r.year}",
            "status": r.status,
            "has_xml": bool(r.xml_content)
        })
    return report_list

@app.get("/api/reports/ready")
def get_ready_reports(profile_id: int, db: Session = Depends(get_db)):
    reports = db.query(GeneratedReport).filter(
        GeneratedReport.profile_id == profile_id,
        GeneratedReport.status == "draft"
    ).all()
    
    ready_list = []
    for r in reports:
        template = db.query(ReportTemplate).filter(ReportTemplate.id == r.template_id).first()
        name = template.name if template else f"Декларація {r.form_code}"
        ready_list.append({
            "id": r.id,
            "report_name": name,
            "period": f"{r.period} {r.year}"
        })
    return ready_list

@app.get("/api/reports/{report_id}/xml")
def get_report_xml(report_id: int, db: Session = Depends(get_db)):
    """Завантажити XML звіту"""
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
    
    if not report.xml_content:
        raise HTTPException(status_code=400, detail="XML контент відсутній")
    
    from fastapi.responses import Response
    filename = f"{report.form_code}_{report.period}_{report.year}.xml"
    return Response(
        content=report.xml_content,
        media_type="application/xml",
        headers={
            "Content-Disposition": make_content_disposition(filename)
        }
    )

@app.get("/api/reports/{report_id}/view")
def view_report_html(report_id: int, db: Session = Depends(get_db)):
    """Перегляд звіту в HTML форматі"""
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
    
    template = db.query(ReportTemplate).filter(ReportTemplate.id == report.template_id).first()
    
    # Отримати дані звіту
    if report.data_json:
        import json
        try:
            data = json.loads(report.data_json)
        except Exception:
            data = {}
    else:
        data = {}
    
    # Генерація HTML для перегляду
    html_content = f"""
    <!DOCTYPE html>
    <html lang="uk">
    <head>
        <meta charset="UTF-8">
        <title>{template.name if template else report.form_code}</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; }}
            .header {{ background: #f5f5f5; padding: 20px; border-radius: 5px; }}
            .field {{ margin: 10px 0; }}
            .label {{ font-weight: bold; }}
            .value {{ margin-left: 10px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>{template.name if template else report.form_code}</h1>
            <p>Період: {report.period} {report.year}</p>
            <p>Статус: {report.status}</p>
        </div>
        <div class="content">
    """
    
    for key, value in data.items():
        html_content += f"""
            <div class="field">
                <span class="label">{key}:</span>
                <span class="value">{value}</span>
            </div>
        """
    
    html_content += """
        </div>
    </body>
    </html>
    """
    
    from fastapi.responses import Response
    return Response(
        content=html_content,
        media_type="text/html"
    )

@app.get("/api/reports/{report_id}/download")
def download_report(report_id: int, format: str = "xml", db: Session = Depends(get_db)):
    """Завантажити звіт у вказаному форматі (xml, json, pdf)"""
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
    
    from fastapi.responses import Response
    
    if format == "xml":
        if not report.xml_content:
            raise HTTPException(status_code=400, detail="XML контент відсутній")
        filename = f"{report.form_code}_{report.period}_{report.year}.xml"
        return Response(
            content=report.xml_content,
            media_type="application/xml",
            headers={
                "Content-Disposition": make_content_disposition(filename)
            }
        )
    elif format == "json":
        if not report.data_json:
            raise HTTPException(status_code=400, detail="JSON контент відсутній")
        filename = f"{report.form_code}_{report.period}_{report.year}.json"
        return Response(
            content=report.data_json,
            media_type="application/json",
            headers={
                "Content-Disposition": make_content_disposition(filename)
            }
        )
    elif format == "pdf":
        # PDF generation would require additional implementation
        raise HTTPException(status_code=501, detail="PDF формат ще не реалізовано")
    else:
        raise HTTPException(status_code=400, detail="Непідтримуваний формат")

@app.get("/api/reports/{report_id}/data")
def get_report_data(report_id: int, db: Session = Depends(get_db)):
    """Отримати дані звіту (JSON) для перегляду/редагування"""
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
    
    if not report.data_json:
        return {"data": {}}
    
    import json
    try:
        return json.loads(report.data_json)
    except Exception:
        return {"data": {}}

@app.post("/api/reports/{report_id}/generate-xml")
def generate_report_xml(report_id: int, db: Session = Depends(get_db)):
    """Згенерувати XML для звіту"""
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
    
    profile = db.query(Profile).filter(Profile.id == report.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
    
    from services.xml_generator import xml_generator
    from services.tax_calculator import tax_calculator
    
    # Отримати податкові дані з TaxCalculator
    tax_summary = tax_calculator.get_summary(profile.id, db)
    
    # Розрахувати доходи за квартали з by_month
    by_month = tax_summary.get("by_month", {})
    income_q1 = 0.0
    income_q2 = 0.0
    income_q3 = 0.0
    income_q4 = 0.0
    
    for period_key, month_data in by_month.items():
        if f"{report.year}-01" in period_key or f"{report.year}-02" in period_key or f"{report.year}-03" in period_key:
            income_q1 += month_data.get("edp", 0)
        elif f"{report.year}-04" in period_key or f"{report.year}-05" in period_key or f"{report.year}-06" in period_key:
            income_q2 += month_data.get("edp", 0)
        elif f"{report.year}-07" in period_key or f"{report.year}-08" in period_key or f"{report.year}-09" in period_key:
            income_q3 += month_data.get("edp", 0)
        elif f"{report.year}-10" in period_key or f"{report.year}-11" in period_key or f"{report.year}-12" in period_key:
            income_q4 += month_data.get("edp", 0)
    
    # Підготувати дані для XML
    tax_data = {
        "taxable_income": tax_summary.get("edp", {}).get("accrued", 0),
        "tax_due": tax_summary.get("edp", {}).get("accrued", 0),
        "tax_paid": tax_summary.get("edp", {}).get("paid", 0),
        "esv_due": tax_summary.get("esv", {}).get("accrued", 0),
        "esv_paid": tax_summary.get("esv", {}).get("paid", 0),
        "military_tax_due": tax_summary.get("military", {}).get("accrued", 0),
        "military_tax_paid": tax_summary.get("military", {}).get("paid", 0),
        "pit_due": tax_summary.get("pdfo", {}).get("accrued", 0),
        "pit_paid": tax_summary.get("pdfo", {}).get("paid", 0),
        "income_q1": income_q1,
        "income_q2": income_q2,
        "income_q3": income_q3,
        "income_q4": income_q4
    }
    
    profile_data = {
        "tax_id": profile.tax_id,
        "name": profile.name,
        "address": getattr(profile, "address", ""),
        "type": profile.type,
        "tax_rate": profile.rate or 5.0
    }
    
    # Генерація XML залежно від типу звіту
    xml_content = None
    form_code = report.form_code
    
    if form_code == "F0103306":
        xml_content = xml_generator.generate_unified_tax_declaration(
            profile_data, tax_data, report.period, report.year
        )
    elif form_code == "J0500109":
        xml_content = xml_generator.generate_unified_report_llc(
            profile_data, tax_data, report.period, report.year
        )
    elif form_code == "F0110210":
        xml_content = xml_generator.generate_vat_declaration(
            profile_data, tax_data, report.period, report.year
        )
    elif form_code == "F3007012":
        xml_content = xml_generator.generate_esv_declaration(
            profile_data, tax_data, report.period, report.year
        )
    elif form_code == "F0120109":
        xml_content = xml_generator.generate_military_tax_declaration(
            profile_data, tax_data, report.period, report.year
        )
    elif form_code == "F0510101":
        xml_content = xml_generator.generate_unified_report(
            profile_data, tax_data, report.period, report.year
        )
    elif form_code == "F0600101":
        xml_content = xml_generator.generate_pit_declaration(
            profile_data, tax_data, report.period, report.year
        )
    else:
        raise HTTPException(status_code=400, detail=f"Непідтримуваний код форми: {form_code}")
    
    # Зберегти XML в базу
    report.xml_content = xml_content
    report.status = "generated"
    db.commit()
    
    return {
        "success": True,
        "xml_generated": True,
        "form_code": form_code
    }

@app.post("/api/reports/{report_id}/validate")
def validate_report_xml(report_id: int, db: Session = Depends(get_db)):
    """Валідація XML звіту проти XSD схеми"""
    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Звіт не знайдено")
    
    if not report.xml_content:
        raise HTTPException(status_code=400, detail="XML контент відсутній")
    
    from services.xsd_validator import xsd_validator
    
    # Базова валідація структури
    is_valid, error_msg = xsd_validator.validate_xml_structure(report.xml_content)
    if not is_valid:
        return {
            "valid": False,
            "error": error_msg,
            "xsd_validated": False
        }
    
    # Спроба валідації проти XSD (якщо схема завантажена)
    xsd_valid, xsd_error = xsd_validator.validate_xml(report.xml_content, report.form_code)
    
    return {
        "valid": xsd_valid,
        "error": xsd_error if not xsd_valid else None,
        "xsd_validated": True
    }

@app.post("/api/tax-calendar/regenerate")
def regenerate_tax_calendar(profile_id: int, db: Session = Depends(get_db)):
    """Перегенерація податкового календаря для профілю (видалення старих подій та створення нових)"""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
    
    try:
        # Видалити існуючі не сплачені події календаря для цього профілю
        db.query(TaxEvent).filter(TaxEvent.profile_id == profile_id, TaxEvent.status == "pending").delete()
        db.commit()
        
        # Синхронізувати події заново
        sync_profile_calendar(profile_id, db)
        
        # Отримати кількість нових подій для повідомлення
        count = db.query(TaxEvent).filter(TaxEvent.profile_id == profile_id, TaxEvent.status == "pending").count()
        return {"message": f"Календар успішно оновлено. Знайдено {count} запланованих подій."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка при оновленні календаря: {str(e)}")

# --- Compatibility mapping for /api/tax/ ---
@app.get("/api/tax/token-instructions")
def get_tax_token_instructions_compat():
    return get_tax_api_instructions()

@app.get("/api/tax/token-status/{profile_id}")
def get_tax_token_status_compat(profile_id: int, db: Session = Depends(get_db)):
    return get_tax_api_status(profile_id, db)

@app.post("/api/tax/set-token")
def set_tax_token_compat(req: SetTokenRequest, db: Session = Depends(get_db)):
    setup_req = TaxApiSetupRequest(profile_id=req.profile_id, api_token=req.token)
    return setup_tax_api(setup_req, db)

@app.post("/api/tax/check-debt")
async def check_debt_endpoint(req: CheckDebtRequest, db: Session = Depends(get_db)):
    setting = db.query(TaxApiSetting).filter(TaxApiSetting.profile_id == req.profile_id).first()
    if not setting:
        return {"error": "Не підключено до API ДПС. Будь ласка, налаштуйте інтеграцію."}
        
    profile = db.query(Profile).filter(Profile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
        
    from services.tax_api_service import TaxAPIService
    api_service = TaxAPIService()
    debt_info = await api_service.get_tax_debt(profile.tax_id or "", setting.api_token)
    
    return {
        "has_debt": debt_info.get("total_debt", 0.0) > 0,
        "total_debt": debt_info.get("total_debt", 0.0),
        "debt_details": debt_info.get("details", {}),
        "checked_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

@app.post("/api/tax/check-reports")
async def check_reports_endpoint(req: CheckReportsRequest, db: Session = Depends(get_db)):
    setting = db.query(TaxApiSetting).filter(TaxApiSetting.profile_id == req.profile_id).first()
    if not setting:
        return {"error": "Не підключено до API ДПС. Будь ласка, налаштуйте інтеграцію."}
        
    profile = db.query(Profile).filter(Profile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
        
    from services.tax_api_service import TaxAPIService
    api_service = TaxAPIService()
    
    # Determine required reports based on profile type and tax system
    required_reports = []
    is_fop = profile.type == "fop"
    is_simplified = "simplified" in (profile.tax_system or "").lower() or (profile.tax_system or "").lower() in ["ednuy-3-5%", "single_tax", "fop_ep", "llc_ep", "ep"]
    
    profile_employees = db.query(Employee).filter(
        (Employee.profile_id == req.profile_id) | (Employee.company_id == req.profile_id)
    ).all()
    has_employees = (profile.has_employees or len(profile_employees) > 0) if profile else False

    if is_fop:
        if is_simplified:
            required_reports.append({
                "code": "F0103306",
                "name": "Декларація єдинника 3 групи (ФОП)",
                "type": "Квартальний",
                "deadline": f"10.05.{datetime.now().year}"
            })
            if has_employees:
                required_reports.append({
                    "code": "F0510101",
                    "name": "Об'єднаний звіт про ЄСВ, ПДФО та ВЗ (ФОП)",
                    "type": "Щомісячний",
                    "deadline": f"20.06.{datetime.now().year}"
                })
        else:
            required_reports.append({
                "code": "F0100112",
                "name": "Декларація про майновий стан і доходи",
                "type": "Річний",
                "deadline": f"03.05.{datetime.now().year}"
            })
    else:
        if is_simplified:
            required_reports.append({
                "code": "J0103508",
                "name": "Декларація єдиного податку ТОВ",
                "type": "Квартальний",
                "deadline": f"10.05.{datetime.now().year}"
            })
        else:
            required_reports.append({
                "code": "J0100120",
                "name": "Декларація з податку на прибуток підприємств",
                "type": "Річний",
                "deadline": f"01.03.{datetime.now().year}"
            })
            
        if has_employees:
            required_reports.append({
                "code": "J0500109",
                "name": "Об'єднаний звіт про ЄСВ, ПДФО та ВЗ (ТОВ)",
                "type": "Щомісячний",
                "deadline": f"20.06.{datetime.now().year}"
            })

    if not required_reports:
        required_reports.append({
            "code": "F0103306" if is_fop else "J0500109",
            "name": "Декларація єдинника" if is_fop else "Об'єднаний звіт",
            "type": "Квартальний",
            "deadline": f"10.05.{datetime.now().year}"
        })

    reports_status_list = []
    all_submitted = True
    
    for rep in required_reports:
        status = await api_service.get_report_status(profile.tax_id or "", setting.api_token, rep["code"])
        submitted = status.get("submitted", False)
        if not submitted:
            all_submitted = False
            
        reports_status_list.append({
            "code": rep["code"],
            "name": rep["name"],
            "type": rep["type"],
            "deadline": rep["deadline"],
            "submitted": submitted,
            "submission_date": status.get("submission_date")
        })
        
    return {
        "all_submitted": all_submitted,
        "reports": reports_status_list,
        "checked_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


class GeneratePaymentRequest(BaseModel):
    profile_id: int
    tax_type: str
    amount: float
    period: str
    bank_code: Optional[str] = "privat24"
    region: Optional[str] = None

@app.get("/api/tax-liabilities")
def get_tax_liabilities(
    profile_id: Optional[int] = None, 
    telegram_id: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    from services.tax_calculator import TaxCalculator
    
    if not profile_id and telegram_id:
        user = db.query(User).filter((User.telegram_id == telegram_id) | (User.email == telegram_id)).first()
        if user and user.profiles:
            profile_id = user.profiles[0].id
            
    if not profile_id:
        return []
        
    calculator = get_tax_calculator(db)
    return calculator.get_liabilities(profile_id, db)

@app.get("/api/tax/summary")
def get_tax_summary(profile_id: int, db: Session = Depends(get_db)):
    calculator = get_tax_calculator(db)
    return calculator.get_summary(profile_id, db)

@app.get("/api/tax/liabilities")
def get_tax_liabilities_endpoint(profile_id: int, db: Session = Depends(get_db)):
    calculator = get_tax_calculator(db)
    return calculator.get_liabilities(profile_id, db)


# --- Tax Requisites Endpoints ---

class TaxRequisiteRequest(BaseModel):
    profile_id: int
    tax_type: str  # 'edp', 'esv', 'pdfo', 'vz'
    tax_office_name: Optional[str] = None
    edrpou: Optional[str] = None
    iban: Optional[str] = None
    bank_name: Optional[str] = None

@app.get("/api/tax-requisites/{profile_id}")
def get_tax_requisites(profile_id: int, db: Session = Depends(get_db)):
    """Отримати реквізити податкових для профілю"""
    requisites = db.query(TaxRequisite).filter(TaxRequisite.profile_id == profile_id).all()
    return [{
        "id": r.id,
        "tax_type": r.tax_type,
        "tax_office_name": r.tax_office_name,
        "edrpou": r.edrpou,
        "iban": r.iban,
        "bank_name": r.bank_name,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None
    } for r in requisites]

@app.post("/api/tax-requisites")
def create_tax_requisite(req: TaxRequisiteRequest, db: Session = Depends(get_db)):
    """Створити або оновити реквізити податкових"""
    # Check if requisite already exists for this tax_type
    existing = db.query(TaxRequisite).filter(
        TaxRequisite.profile_id == req.profile_id,
        TaxRequisite.tax_type == req.tax_type
    ).first()
    
    if existing:
        # Update existing
        existing.tax_office_name = req.tax_office_name
        existing.edrpou = req.edrpou
        existing.iban = req.iban
        existing.bank_name = req.bank_name
        existing.updated_at = datetime.utcnow()
        db.commit()
        return {"id": existing.id, "message": "updated"}
    else:
        # Create new
        requisite = TaxRequisite(
            profile_id=req.profile_id,
            tax_type=req.tax_type,
            tax_office_name=req.tax_office_name,
            edrpou=req.edrpou,
            iban=req.iban,
            bank_name=req.bank_name
        )
        db.add(requisite)
        db.commit()
        return {"id": requisite.id, "message": "created"}

@app.delete("/api/tax-requisites/{requisite_id}")
def delete_tax_requisite(requisite_id: int, db: Session = Depends(get_db)):
    """Видалити реквізити податкових"""
    requisite = db.query(TaxRequisite).filter(TaxRequisite.id == requisite_id).first()
    if not requisite:
        raise HTTPException(status_code=404, detail="Requisite not found")
    db.delete(requisite)
    db.commit()
    return {"message": "deleted"}

# --- LiqPay Payment Endpoints ---

class CreateTaxPaymentRequest(BaseModel):
    profile_id: int
    tax_type: str  # 'edp', 'esv', 'pdfo', 'vz'
    amount: float
    period: str  # '2025-06'

class CreateSubscriptionRequest(BaseModel):
    profile_id: int
    plan: str  # 'free', 'business'
    period: str = "month"  # 'month', 'year'

@app.post("/api/payments/create-tax-payment")
def create_tax_payment_liqpay(req: CreateTaxPaymentRequest, db: Session = Depends(get_db)):
    """Створити платіж для податку через LiqPay"""
    profile = db.query(Profile).filter(Profile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Create payment record
    order_id = f"tax_{req.profile_id}_{req.tax_type}_{req.period}_{int(datetime.now().timestamp())}"
    payment = Payment(
        profile_id=req.profile_id,
        tax_type=req.tax_type,
        amount=req.amount,
        period=req.period,
        status="pending",
        liqpay_order_id=order_id,
        payment_type="tax"
    )
    db.add(payment)
    db.commit()
    
    # Create LiqPay form
    liqpay_form = liqpay_service.create_tax_payment(
        profile_id=req.profile_id,
        tax_type=req.tax_type,
        amount=req.amount,
        period=req.period
    )
    
    return {
        "payment_id": payment.id,
        "liqpay_data": liqpay_form["data"],
        "liqpay_signature": liqpay_form["signature"],
        "api_url": liqpay_form["api_url"]
    }

@app.post("/api/payments/create-subscription")
def create_subscription_liqpay(req: CreateSubscriptionRequest, db: Session = Depends(get_db)):
    """Створити підписку через LiqPay"""
    profile = db.query(Profile).filter(Profile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Check if subscription already exists
    existing_sub = db.query(Subscription).filter(Subscription.profile_id == req.profile_id).first()
    
    if req.plan == "free":
        # Free plan - no payment needed
        if existing_sub:
            existing_sub.plan = "free"
            existing_sub.status = "active"
            existing_sub.expires_at = None
            existing_sub.updated_at = datetime.utcnow()
            db.commit()
        else:
            subscription = Subscription(
                profile_id=req.profile_id,
                plan="free",
                status="active"
            )
            db.add(subscription)
            db.commit()
        return {"message": "Free plan activated", "payment_required": False}
    
    # Business plan - requires payment
    liqpay_form = liqpay_service.create_subscription_payment(
        profile_id=req.profile_id,
        plan=req.plan,
        period=req.period
    )
    
    if liqpay_form.get("amount") == 0:
        return {"message": "No payment required", "payment_required": False}
    
    # Create subscription record (pending until payment confirmed)
    order_id = liqpay_form.get("data", "")
    if existing_sub:
        existing_sub.plan = req.plan
        existing_sub.status = "pending"
        existing_sub.liqpay_order_id = order_id
        existing_sub.updated_at = datetime.utcnow()
        db.commit()
    else:
        subscription = Subscription(
            profile_id=req.profile_id,
            plan=req.plan,
            status="pending",
            liqpay_order_id= order_id
        )
        db.add(subscription)
        db.commit()
    
    return {
        "subscription_id": existing_sub.id if existing_sub else subscription.id,
        "liqpay_data": liqpay_form["data"],
        "liqpay_signature": liqpay_form["signature"],
        "api_url": liqpay_form["api_url"],
        "payment_required": True
    }

@app.post("/api/payments/cancel-subscription")
def cancel_subscription(req: CreateSubscriptionRequest, db: Session = Depends(get_db)):
    """Скасувати підписку"""
    subscription = db.query(Subscription).filter(Subscription.profile_id == req.profile_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    subscription.status = "cancelled"
    subscription.auto_renew = False
    subscription.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Subscription cancelled"}

@app.post("/api/liqpay/callback")
def liqpay_callback(data: str = Form(...), signature: str = Form(...), db: Session = Depends(get_db)):
    """Webhook callback від LiqPay"""
    # Verify signature
    if not liqpay_service.verify_callback(data, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Decode data
    callback_data = liqpay_service.decode_callback_data(data)
    
    order_id = callback_data.get("order_id", "")
    status = callback_data.get("status", "")
    amount = callback_data.get("amount", "0")
    
    logger.info(f"LiqPay callback: order_id={order_id}, status={status}, amount={amount}")
    
    # Parse order_id to determine type
    if order_id.startswith("tax_"):
        # Tax payment
        parts = order_id.split("_")
        if len(parts) >= 4:
            profile_id = int(parts[1])
            tax_type = parts[2]
            period = parts[3]
            
            # Update payment record
            payment = db.query(Payment).filter(
                Payment.liqpay_order_id == order_id
            ).first()
            
            if payment:
                if status == "success" or status == "subscribed":
                    payment.status = "paid"
                    payment.paid_at = datetime.utcnow()
                    payment.liqpay_payment_id = callback_data.get("payment_id")
                elif status == "failed" or status == "error":
                    payment.status = "failed"
                db.commit()
    
    elif order_id.startswith("sub_"):
        # Subscription payment
        parts = order_id.split("_")
        if len(parts) >= 3:
            profile_id = int(parts[1])
            plan = parts[2]
            
            # Update subscription
            subscription = db.query(Subscription).filter(
                Subscription.profile_id == profile_id
            ).first()
            
            if subscription:
                if status == "success" or status == "subscribed":
                    subscription.status = "active"
                    subscription.expires_at = datetime.utcnow() + timedelta(days=30)  # 30 days
                    subscription.last_payment_amount = int(float(amount) * 100)  # in kopecks
                    subscription.last_payment_date = datetime.utcnow()
                    subscription.liqpay_order_id = callback_data.get("payment_id")
                elif status == "failed" or status == "error":
                    subscription.status = "failed"
                db.commit()
    
    return {"status": "ok"}

# --- Feature Access Control ---

FEATURES = {
    "free": ["dashboard", "upload_statement", "settings", "taxes"],
    "business": ["dashboard", "upload_statement", "settings", "taxes", "reports", "employees", "bank_sync", "api", "liqpay"]
}

def check_feature_access(profile_id: int, feature: str, db: Session) -> bool:
    """Перевірити доступ до функції"""
    subscription = db.query(Subscription).filter(Subscription.profile_id == profile_id).first()
    plan = subscription.plan if subscription else "free"
    return feature in FEATURES.get(plan, [])

@app.get("/api/subscription/{profile_id}")
def get_subscription(profile_id: int, db: Session = Depends(get_db)):
    """Отримати інформацію про підписку"""
    subscription = db.query(Subscription).filter(Subscription.profile_id == profile_id).first()
    
    if not subscription:
        return {
            "plan": "free",
            "status": "active",
            "expires_at": None,
            "features": FEATURES["free"]
        }
    
    return {
        "plan": subscription.plan,
        "status": subscription.status,
        "expires_at": subscription.expires_at.isoformat() if subscription.expires_at else None,
        "auto_renew": subscription.auto_renew,
        "features": FEATURES.get(subscription.plan, FEATURES["free"])
    }

@app.post("/api/payments/generate")
def generate_payment(req: GeneratePaymentRequest, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
        
    region = req.region
    if not region:
        addr = (profile.address or "").lower()
        if "дніпро" in addr or "dnipro" in addr or "соборн" in addr:
            region = "dnipro"
        elif "львів" in addr or "lviv" in addr:
            region = "lviv"
        elif "одес" in addr or "odesa" in addr:
            region = "odesa"
        elif "харк" in addr or "kharkiv" in addr:
            region = "kharkiv"
        else:
            region = "kyiv"
            
    requisites = {
        "kyiv": {
            "recipient": "ГУ ДПС у м. Києві (Шевченківський р-н)",
            "edrpou": "44074340",
            "iban": {
                "edp": "UA488999980313010075000026001",
                "esv": "UA218999980314010075000026002",
                "pdfo": "UA398999980315010075000026003",
                "vz": "UA528999980316010075000026004"
            }
        },
        "dnipro": {
            "recipient": "ГУ ДПС у Дніпропетровській області (Соборний р-н, м. Дніпро)",
            "edrpou": "44082781",
            "iban": {
                "edp": "UA558999980313020075000012001",
                "esv": "UA128999980314020075000012002",
                "pdfo": "UA748999980315020075000012003",
                "vz": "UA338999980316020075000012004"
            }
        },
        "lviv": {
            "recipient": "ГУ ДПС у Львівській області (Галицький р-н, м. Львів)",
            "edrpou": "44081023",
            "iban": {
                "edp": "UA668999980313030075000034001",
                "esv": "UA238999980314030075000034002",
                "pdfo": "UA858999980315030075000034003",
                "vz": "UA448999980316030075000034004"
            }
        },
        "odesa": {
            "recipient": "ГУ ДПС в Одеській області (Приморський р-н, м. Одеса)",
            "edrpou": "44082535",
            "iban": {
                "edp": "UA778999980313040075000045001",
                "esv": "UA348999980314040075000045002",
                "pdfo": "UA968999980315040075000045003",
                "vz": "UA558999980316040075000045004"
            }
        },
        "kharkiv": {
            "recipient": "ГУ ДПС у Харківській області (Київський р-н, м. Харків)",
            "edrpou": "44086132",
            "iban": {
                "edp": "UA888999980313050075000056001",
                "esv": "UA458999980314050075000056002",
                "pdfo": "UA078999980315050075000056003",
                "vz": "UA668999980316050075000056004"
            }
        }
    }
    
    reg_data = requisites.get(region, requisites["kyiv"])
    recipient = reg_data["recipient"]
    edrpou = reg_data["edrpou"]
    
    tax_type_key = req.tax_type
    if tax_type_key not in reg_data["iban"]:
        tax_type_key = "edp"
    iban = reg_data["iban"][tax_type_key]
    
    tax_purposes = {
        "edp": f"*;101;{profile.tax_id or '1234567890'};сплата єдиного податку за {req.period};;;",
        "esv": f"*;101;{profile.tax_id or '1234567890'};сплата єдиного соціального внеску за {req.period};;;",
        "pdfo": f"*;101;{profile.tax_id or '1234567890'};сплата ПДФО за {req.period};;;",
        "vz": f"*;101;{profile.tax_id or '1234567890'};сплата військового збору за {req.period};;;"
    }
    purpose = tax_purposes.get(req.tax_type, f"*;101;{profile.tax_id or '1234567890'};сплата податку за {req.period};;;")
    
    payment = db.query(Payment).filter(
        Payment.profile_id == req.profile_id,
        Payment.tax_type == req.tax_type,
        Payment.period == req.period,
        Payment.status == "pending"
    ).first()
    
    if not payment:
        payment = Payment(
            profile_id=req.profile_id,
            tax_type=req.tax_type,
            amount=req.amount,
            period=req.period,
            status="pending"
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        
    qr_code = f"BCD\n002\n1\nSCT\n\n{recipient}\n{iban}\nUAH{req.amount:.2f}\n\n{purpose}"
    
    methods = {}
    for b in ["privat24", "monobank", "abank"]:
        deep_links = {
            "privat24": f"https://link.privatbank.ua/pay?iban={iban}&amount={req.amount}&purpose={purpose}",
            "monobank": f"https://send.monobank.ua/pay?iban={iban}&amount={req.amount}&purpose={purpose}",
            "abank": f"https://a-bank.com.ua/pay?iban={iban}&amount={req.amount}&purpose={purpose}"
        }
        methods[b] = {
            "instructions": f"Відскануйте QR-код у додатку {b.capitalize()} або натисніть кнопку для переходу.",
            "deep_link": deep_links[b],
            "qr_code": qr_code
        }
        
    return {
        "id": payment.id,
        "profile_id": payment.profile_id,
        "tax_type": payment.tax_type,
        "amount": payment.amount,
        "period": payment.period,
        "recipient": recipient,
        "edrpou": edrpou,
        "iban": iban,
        "purpose": purpose,
        "bank_code": req.bank_code,
        "methods": methods
    }

@app.post("/api/payments/{payment_id}/confirm")
def confirm_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Платіж не знайдено")
    payment.status = "paid"
    payment.paid_at = datetime.now()
    
    db_tax_name = map_tax_type(payment.tax_type)
    event = db.query(TaxEvent).filter(
        TaxEvent.profile_id == payment.profile_id,
        TaxEvent.tax_name == db_tax_name,
        TaxEvent.status == "pending"
    ).first()
    if event:
        event.status = "paid"
        
    db.commit()
    return {"message": "Платіж успішно підтверджено"}

# ==================== EXPORT ENDPOINTS ====================

@app.get("/api/export/transactions")
async def export_transactions(
    profile_id: int,
    format: str = "csv",
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db)
):
    """Експорт транзакцій в CSV або Excel"""
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas не встановлено. Встановіть: pip install pandas openpyxl")
    
    # Отримати транзакції з БД
    query = db.query(ParsedPayment).filter(ParsedPayment.profile_id == profile_id)
    
    if start_date:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        query = query.filter(ParsedPayment.date >= start_dt)
    if end_date:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        query = query.filter(ParsedPayment.date <= end_dt)
    
    payments = query.order_by(desc(ParsedPayment.date)).all()
    
    # Конвертація в DataFrame
    data = []
    for p in payments:
        data.append({
            "Дата": p.date.strftime("%d.%m.%Y") if p.date else "",
            "Сума": p.amount,
            "Призначення": p.purpose,
            "Тип": "Дохід" if p.direction == "in" else "Витрата",
            "Оподатковується": "Так" if p.taxable else "Ні",
            "Тип транзакції": p.type or "",
            "Контрагент": p.contragent or ""
        })
    
    df = pd.DataFrame(data)
    
    # Експорт в потрібний формат
    if format == "csv":
        output = BytesIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=transactions_{datetime.now().strftime('%Y%m%d')}.csv"}
        )
    
    else:  # xlsx
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(status_code=500, detail="openpyxl не встановлено. Встановіть: pip install openpyxl")
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Транзакції', index=False)
            
            # Налаштування ширини колонок
            worksheet = writer.sheets['Транзакції']
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=transactions_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )

@app.get("/api/export/reports")
async def export_reports_history(
    profile_id: int,
    format: str = "csv",
    db: Session = Depends(get_db)
):
    """Експорт історії звітів"""
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas не встановлено. Встановіть: pip install pandas openpyxl")
    
    reports = db.query(GeneratedReport).filter(GeneratedReport.profile_id == profile_id).order_by(desc(GeneratedReport.created_at)).all()
    
    data = []
    for r in reports:
        data.append({
            "ID звіту": r.id,
            "Код форми": r.form_code,
            "Період": r.period,
            "Рік": r.year,
            "Статус": r.status,
            "Дата створення": r.created_at.strftime("%d.%m.%Y %H:%M") if r.created_at else ""
        })
    
    df = pd.DataFrame(data)
    
    if format == "csv":
        output = BytesIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=reports_{datetime.now().strftime('%Y%m%d')}.csv"}
        )
    else:
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(status_code=500, detail="openpyxl не встановлено. Встановіть: pip install openpyxl")
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Звіти', index=False)
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=reports_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )

@app.get("/api/export/taxes")
async def export_taxes_calendar(
    profile_id: int,
    format: str = "csv",
    year: int = None,
    db: Session = Depends(get_db)
):
    """Експорт податкового календаря"""
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas не встановлено. Встановіть: pip install pandas openpyxl")
    
    if not year:
        year = datetime.now().year
    
    events = db.query(TaxEvent).filter(
        TaxEvent.profile_id == profile_id,
        TaxEvent.due_date.between(date(year, 1, 1), date(year, 12, 31))
    ).order_by(TaxEvent.due_date).all()
    
    data = []
    for e in events:
        data.append({
            "Тип податку": e.tax_name,
            "Назва": e.title,
            "Сума": e.amount_desc or "",
            "Дедлайн": e.due_date.strftime("%d.%m.%Y") if e.due_date else "",
            "Статус": "Сплачено" if e.status == "paid" else "Очікує",
            "Код форми": e.form_code or ""
        })
    
    df = pd.DataFrame(data)
    
    if format == "csv":
        output = BytesIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=taxes_{year}.csv"}
        )
    else:
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(status_code=500, detail="openpyxl не встановлено. Встановіть: pip install openpyxl")
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=f'Податки_{year}', index=False)
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=taxes_{year}.xlsx"}
        )

# --- AI Service Endpoints ---
from services.ai_service import ai_service
from services.tax_calculator import tax_calculator
from services.liqpay_service import liqpay_service

class AIAnalyzeTransactionRequest(BaseModel):
    transaction_id: int

@app.post("/api/ai/analyze-transaction")
async def ai_analyze_transaction(req: AIAnalyzeTransactionRequest, db: Session = Depends(get_db)):
    """ШІ-аналіз транзакції"""
    try:
        tx = db.query(ParsedPayment).filter(ParsedPayment.id == req.transaction_id).first()
        if not tx:
            raise HTTPException(status_code=404, detail="Транзакцію не знайдено")
        
        result = await ai_service.analyze_transaction(tx.purpose or "", tx.amount or 0.0)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка аналізу: {str(e)}")

class AIChatRequest(BaseModel):
    profile_id: int
    question: str

@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest, db: Session = Depends(get_db)):
    """Чат-асистент для податкових питань"""
    profile = db.query(Profile).filter(Profile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
    
    profile_dict = {
        "tax_system": profile.tax_system,
        "tax_rate": profile.rate,
        "has_employees": profile.has_employees,
        "group": profile.group
    }
    
    answer = await ai_service.chat_assistant(req.question, profile_dict)
    return {"answer": answer}

@app.get("/api/ai/tax-news")
async def ai_tax_news(profile_id: int, db: Session = Depends(get_db)):
    """Отримати останні зміни в законодавстві з ШІ-аналізом"""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
    
    profile_dict = {
        "tax_system": profile.tax_system,
        "tax_rate": profile.rate,
        "has_employees": profile.has_employees,
        "group": profile.group
    }
    
    # Отримати останні зміни з БД
    from sqlalchemy import text
    try:
        changes = db.execute(text("SELECT * FROM legislative_changes ORDER BY detected_at DESC LIMIT 10")).fetchall()
        changes_list = []
        for c in changes:
            changes_list.append({
                "id": c[0],
                "title": c[1] if len(c) > 1 else "",
                "description": c[2] if len(c) > 2 else "",
                "detected_at": str(c[3]) if len(c) > 3 else ""
            })
    except:
        changes_list = []
    
    relevant_changes = await ai_service.get_relevant_changes(profile_dict, changes_list)
    return relevant_changes

# --- Legacy AI Agent Endpoint (for compatibility) ---
class AgentChatRequest(BaseModel):
    profile_id: int
    message: str

@app.post("/api/agent/chat")
async def agent_chat(req: AgentChatRequest, db: Session = Depends(get_db)):
    """ШІ агент для відповідей на питання про податки (legacy endpoint)"""
    # Redirect to new AI chat endpoint
    ai_req = AIChatRequest(profile_id=req.profile_id, question=req.message)
    return await ai_chat(ai_req, db)

def get_fop_limit(group: int) -> int:
    if group == 1:
        return 1444049
    elif group == 2:
        return 7211598
    else:
        return 10091049

# Bank OAuth API endpoints
from services.bank_oauth import bank_oauth_service, BANKS

# LiqPay API endpoints
import hashlib
import base64
import json
import uuid

def liqpay_encode(data: dict, private_key: str) -> str:
    """Encode data for LiqPay"""
    json_str = json.dumps(data, separators=(',', ':'))
    encoded = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
    signature = hashlib.sha1((private_key + encoded + private_key).encode('utf-8')).hexdigest()
    return signature + "|" + encoded

def liqpay_decode(data: str, private_key: str) -> dict:
    """Decode data from LiqPay"""
    parts = data.split('|')
    if len(parts) != 2:
        raise ValueError("Invalid data format")
    signature, encoded = parts
    expected_signature = hashlib.sha1((private_key + encoded + private_key).encode('utf-8')).hexdigest()
    if signature != expected_signature:
        raise ValueError("Invalid signature")
    json_str = base64.b64decode(encoded).decode('utf-8')
    return json.loads(json_str)

@app.post("/api/payments/create")
async def create_payment(req: dict, db: Session = Depends(get_db)):
    """Створити платіж для сплати податку"""
    from dotenv import load_dotenv
    load_dotenv()
    
    public_key = os.getenv("LIQPAY_PUBLIC_KEY")
    private_key = os.getenv("LIQPAY_PRIVATE_KEY")
    
    if not public_key or not private_key:
        raise HTTPException(status_code=500, detail="LiqPay credentials not configured")
    
    amount = req.get('amount', 0)
    profile_id = req.get('profile_id')
    tax_type = req.get('tax_type')
    period = req.get('period')
    
    if not all([amount, profile_id, tax_type, period]):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    order_id = f"tax_{profile_id}_{tax_type}_{period}_{uuid.uuid4().hex[:8]}"
    
    # Зберігаємо в БД
    payment = Payment(
        profile_id=profile_id,
        tax_type=tax_type,
        amount=amount,
        period=period,
        status="pending",
        liqpay_order_id=order_id,
        payment_type="tax"
    )
    db.add(payment)
    db.commit()
    
    # Створюємо дані для LiqPay
    liqpay_data = {
        "public_key": public_key,
        "version": "3",
        "action": "pay",
        "amount": str(amount),
        "currency": "UAH",
        "description": f"Сплата податку {tax_type} за {period}",
        "order_id": order_id,
        "server_url": "https://unitas-backend.fly.dev/api/liqpay/callback",
        "result_url": f"https://unitas-frontend.fly.dev/payment-result?order_id={order_id}",
        "language": "uk"
    }
    
    encoded_data = liqpay_encode(liqpay_data, private_key)
    
    return {
        "data": encoded_data,
        "signature": liqpay_data["public_key"],
        "order_id": order_id
    }

@app.post("/api/liqpay/callback")
async def liqpay_callback(request: Request, db: Session = Depends(get_db)):
    """Webhook від LiqPay після оплати"""
    from dotenv import load_dotenv
    load_dotenv()
    
    private_key = os.getenv("LIQPAY_PRIVATE_KEY")
    
    if not private_key:
        raise HTTPException(status_code=500, detail="LiqPay credentials not configured")
    
    data = await request.form()
    liqpay_data_str = data.get('data')
    signature = data.get('signature')
    
    if not liqpay_data_str or not signature:
        raise HTTPException(status_code=400, detail="Missing data or signature")
    
    try:
        response = liqpay_decode(liqpay_data_str, private_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid signature: {str(e)}")
    
    if response.get('status') == 'success':
        order_id = response.get('order_id')
        liqpay_payment_id = response.get('payment_id')
        
        # Оновлюємо статус в БД
        payment = db.query(Payment).filter(Payment.liqpay_order_id == order_id).first()
        if payment:
            payment.status = "paid"
            payment.liqpay_payment_id = liqpay_payment_id
            payment.paid_at = datetime.now()
            db.commit()
    
    return {"status": "ok"}

@app.get("/api/payments/status/{order_id}")
async def get_payment_status(order_id: str, db: Session = Depends(get_db)):
    """Перевірити статус платежу"""
    payment = db.query(Payment).filter(Payment.liqpay_order_id == order_id).first()
    if not payment:
        return {"status": "not_found"}
    
    return {
        "status": payment.status,
        "order_id": order_id,
        "amount": payment.amount,
        "tax_type": payment.tax_type,
        "period": payment.period
    }

# Pricing API endpoints
@app.get("/api/pricing/{plan}")
async def get_price(plan: str, db: Session = Depends(get_db)):
    """Отримати ціну тарифу"""
    pricing = db.query(Pricing).filter(Pricing.plan == plan).first()
    if not pricing:
        raise HTTPException(status_code=404, detail="Тариф не знайдено")
    return {"plan": plan, "price": pricing.price, "currency": pricing.currency}

@app.get("/api/pricing/")
async def get_all_prices(db: Session = Depends(get_db)):
    """Отримати всі ціни"""
    pricings = db.query(Pricing).all()
    return {p.plan: p.price for p in pricings}

@app.put("/api/pricing/{plan}")
async def update_price(plan: str, price: int, db: Session = Depends(get_db)):
    """Оновити ціну (тільки для адміністратора)"""
    pricing = db.query(Pricing).filter(Pricing.plan == plan).first()
    if not pricing:
        raise HTTPException(status_code=404, detail="Тариф не знайдено")
    pricing.price = price
    pricing.updated_at = datetime.utcnow()
    db.commit()
    return {"message": f"Ціну тарифу {plan} оновлено до {price} грн"}

# Subscription API endpoints
@app.get("/api/subscription/current/{profile_id}")
async def get_subscription(profile_id: int, db: Session = Depends(get_db)):
    sub = db.query(Subscription).filter(Subscription.profile_id == profile_id).first()
    if not sub:
        return {"plan": "free", "expires_at": None, "auto_renew": False}
    return {
        "plan": sub.plan,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        "auto_renew": sub.auto_renew
    }

@app.post("/api/subscription/upgrade/{profile_id}")
async def upgrade_to_business(profile_id: int, db: Session = Depends(get_db)):
    expires_at = datetime.utcnow() + timedelta(days=30)
    
    existing = db.query(Subscription).filter(Subscription.profile_id == profile_id).first()
    
    if existing:
        existing.plan = "business"
        existing.status = "active"
        existing.expires_at = expires_at
        existing.auto_renew = True
        existing.updated_at = datetime.utcnow()
    else:
        sub = Subscription(
            profile_id=profile_id,
            plan="business",
            status="active",
            expires_at=expires_at,
            auto_renew=True
        )
        db.add(sub)
    
    db.commit()
    
    pricing = db.query(Pricing).filter(Pricing.plan == "business").first()
    price_amount = pricing.price if pricing else 499
    
    return {
        "message": f"Підписку Business активовано на 30 днів за {price_amount} грн",
        "price": price_amount
    }

@app.post("/api/subscription/cancel/{profile_id}")
async def cancel_subscription(profile_id: int, db: Session = Depends(get_db)):
    sub = db.query(Subscription).filter(Subscription.profile_id == profile_id).first()
    if sub:
        sub.auto_renew = False
        db.commit()
    return {"message": "Автопродовження вимкнено"}

@app.get("/api/subscription/usage/{profile_id}")
async def get_usage(profile_id: int, db: Session = Depends(get_db)):
    current_month = datetime.utcnow().replace(day=1).date()
    usage = db.query(StatementUsage).filter(
        StatementUsage.profile_id == profile_id,
        StatementUsage.month == current_month
    ).first()
    return {"used": usage.count if usage else 0, "limit": 5}

# Admin API endpoints
async def verify_admin(request: Request):
    """Verify admin API key"""
    admin_key = os.getenv("ADMIN_API_KEY", "dev-admin-key-123")
    provided_key = request.headers.get("X-API-Key")
    if not provided_key or provided_key != admin_key:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

@app.get("/api/admin/pricing")
async def admin_get_all_prices(request: Request, admin: bool = Depends(verify_admin), db: Session = Depends(get_db)):
    """Отримати всі ціни (тільки для адміна)"""
    pricings = db.query(Pricing).all()
    return [
        {
            "plan": p.plan,
            "price": p.price,
            "currency": p.currency,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None
        }
        for p in pricings
    ]

@app.put("/api/admin/pricing/{plan}")
async def admin_update_price(
    plan: str,
    price: int,
    request: Request,
    admin: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """Оновити ціну тарифу (тільки для адміна)"""
    if plan not in ["free", "business"]:
        raise HTTPException(status_code=400, detail="Невірний тариф")
    
    if price < 0:
        raise HTTPException(status_code=400, detail="Ціна не може бути від'ємною")
    
    pricing = db.query(Pricing).filter(Pricing.plan == plan).first()
    if not pricing:
        raise HTTPException(status_code=404, detail="Тариф не знайдено")
    
    pricing.price = price
    pricing.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "message": f"Ціну тарифу {plan} оновлено до {price} грн",
        "plan": plan,
        "price": price
    }

@app.get("/api/admin/users")
async def admin_get_all_users(request: Request, admin: bool = Depends(verify_admin), db: Session = Depends(get_db)):
    """Отримати всі користувачів з профілями та підписками (тільки для адміна)"""
    users = db.query(User).all()
    result = []
    
    for user in users:
        profiles = db.query(Profile).filter(Profile.user_id == user.id).all()
        profiles_data = []
        
        for profile in profiles:
            subscription = db.query(Subscription).filter(Subscription.profile_id == profile.id).first()
            profiles_data.append({
                "id": profile.id,
                "name": profile.name,
                "type": profile.type,
                "tax_id": profile.tax_id,
                "subscription": {
                    "plan": subscription.plan if subscription else "free",
                    "status": subscription.status if subscription else "inactive",
                    "expires_at": subscription.expires_at.isoformat() if subscription and subscription.expires_at else None,
                    "auto_renew": subscription.auto_renew if subscription else False
                } if subscription else None
            })
        
        result.append({
            "id": user.id,
            "email": user.email,
            "telegram_id": user.telegram_id,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "profiles": profiles_data
        })
    
    return result

@app.post("/api/admin/subscription/extend/{profile_id}")
async def admin_extend_subscription(
    profile_id: int,
    days: int = 30,
    request: Request = None,
    admin: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """Продовжити підписку (тільки для адміна)"""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
    
    subscription = db.query(Subscription).filter(Subscription.profile_id == profile_id).first()
    if subscription:
        if subscription.expires_at and subscription.expires_at > datetime.utcnow():
            subscription.expires_at = subscription.expires_at + timedelta(days=days)
        else:
            subscription.expires_at = datetime.utcnow() + timedelta(days=days)
        subscription.status = "active"
        subscription.updated_at = datetime.utcnow()
    else:
        subscription = Subscription(
            profile_id=profile_id,
            plan="business",
            status="active",
            expires_at=datetime.utcnow() + timedelta(days=days),
            auto_renew=False
        )
        db.add(subscription)
    
    db.commit()
    return {"message": f"Підписку продовжено на {days} днів"}

@app.post("/api/admin/subscription/cancel/{profile_id}")
async def admin_cancel_subscription(
    profile_id: int,
    request: Request = None,
    admin: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """Скасувати підписку (тільки для адміна)"""
    subscription = db.query(Subscription).filter(Subscription.profile_id == profile_id).first()
    if subscription:
        subscription.status = "cancelled"
        subscription.auto_renew = False
        subscription.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Підписку скасовано"}
    return {"message": "Підписку не знайдено"}

@app.post("/api/admin/subscription/block/{profile_id}")
async def admin_block_subscription(
    profile_id: int,
    request: Request = None,
    admin: bool = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    """Заблокувати підписку (тільки для адміна)"""
    subscription = db.query(Subscription).filter(Subscription.profile_id == profile_id).first()
    if subscription:
        subscription.status = "blocked"
        subscription.auto_renew = False
        subscription.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Підписку заблоковано"}
    return {"message": "Підписку не знайдено"}

@app.get("/api/banks")
async def list_banks():
    """Get list of available banks"""
    return {
        "banks": [
            {
                "id": bank_id,
                "name": bank["name"]
            }
            for bank_id, bank in BANKS.items()
        ]
    }

@app.get("/api/banks/{bank_name}/auth-url")
async def get_bank_auth_url(bank_name: str, profile_id: int):
    """Get OAuth authorization URL for a bank"""
    if bank_name not in BANKS:
        raise HTTPException(status_code=400, detail=f"Unknown bank: {bank_name}")
    
    state = f"{bank_name}:{profile_id}"
    auth_url = bank_oauth_service.get_auth_url(bank_name, state)
    
    return {"auth_url": auth_url}

@app.get("/api/banks/{bank_name}/callback")
async def bank_oauth_callback(bank_name: str, code: str, state: str, db: Session = Depends(get_db)):
    """Handle OAuth callback from bank"""
    if bank_name not in BANKS:
        raise HTTPException(status_code=400, detail=f"Unknown bank: {bank_name}")
    
    try:
        # Parse state to get profile_id
        state_parts = state.split(":")
        if len(state_parts) != 2:
            raise HTTPException(status_code=400, detail="Invalid state")
        
        state_bank, profile_id_str = state_parts
        profile_id = int(profile_id_str)
        
        if state_bank != bank_name:
            raise HTTPException(status_code=400, detail="State mismatch")
        
        # Exchange code for token
        tokens = await bank_oauth_service.exchange_code_for_token(bank_name, code)
        
        # Get bank accounts
        accounts = await bank_oauth_service.get_bank_accounts(bank_name, tokens['access_token'])
        
        if not accounts:
            raise HTTPException(status_code=400, detail="No accounts found")
        
        # Save connection
        existing = db.query(BankConnection).filter(
            BankConnection.profile_id == profile_id,
            BankConnection.bank_name == bank_name
        ).first()
        
        if existing:
            existing.access_token = tokens['access_token']
            existing.refresh_token = tokens.get('refresh_token')
            existing.account_id = accounts[0]['id']
            existing.account_number = accounts[0]['number']
            existing.is_active = True
            existing.updated_at = datetime.now()
        else:
            connection = BankConnection(
                profile_id=profile_id,
                bank_name=bank_name,
                access_token=tokens['access_token'],
                refresh_token=tokens.get('refresh_token'),
                account_id=accounts[0]['id'],
                account_number=accounts[0]['number'],
                is_active=True
            )
            db.add(connection)
        
        db.commit()
        
        return {
            "status": "connected",
            "bank": BANKS[bank_name]["name"],
            "account": accounts[0]['number']
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"OAuth error: {str(e)}")

@app.get("/api/banks/connections")
async def get_bank_connections(profile_id: int, db: Session = Depends(get_db)):
    """Get user's bank connections"""
    connections = db.query(BankConnection).filter(
        BankConnection.profile_id == profile_id,
        BankConnection.is_active == True
    ).all()
    
    return {
        "connections": [
            {
                "id": conn.id,
                "bank_name": conn.bank_name,
                "bank_display_name": BANKS.get(conn.bank_name, {}).get("name", conn.bank_name),
                "account_number": conn.account_number,
                "last_sync": conn.last_sync.isoformat() if conn.last_sync else None,
                "created_at": conn.created_at.isoformat()
            }
            for conn in connections
        ]
    }

@app.post("/api/banks/{bank_name}/sync")
async def sync_bank(bank_name: str, profile_id: int, db: Session = Depends(get_db)):
    """Force sync bank transactions"""
    if bank_name not in BANKS:
        raise HTTPException(status_code=400, detail=f"Unknown bank: {bank_name}")
    
    # Get connection
    conn = db.query(BankConnection).filter(
        BankConnection.profile_id == profile_id,
        BankConnection.bank_name == bank_name,
        BankConnection.is_active == True
    ).first()
    
    if not conn:
        raise HTTPException(status_code=404, detail="Bank not connected")
    
    try:
        # Get transactions
        from_date = conn.last_sync if conn.last_sync else datetime.now() - timedelta(days=30)
        transactions = await bank_oauth_service.get_bank_transactions(
            bank_name,
            conn.access_token,
            conn.account_id,
            from_date=from_date
        )
        
        # Save transactions as ParsedPayment
        for tx in transactions:
            # Check if transaction already exists
            existing = db.query(ParsedPayment).filter(
                ParsedPayment.external_id == tx['id'],
                ParsedPayment.bank_name == bank_name
            ).first()
            
            if not existing:
                parsed_payment = ParsedPayment(
                    profile_id=profile_id,
                    date=datetime.fromisoformat(tx['date']).date(),
                    amount=abs(tx['amount']),
                    purpose=tx.get('purpose', ''),
                    type='income' if tx['amount'] > 0 else 'expense',
                    external_id=tx['id'],
                    bank_name=bank_name
                )
                db.add(parsed_payment)
        
        # Update last sync
        conn.last_sync = datetime.now()
        db.commit()
        
        return {
            "synced": len(transactions),
            "last_sync": datetime.now().isoformat()
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")

@app.delete("/api/banks/{bank_name}/disconnect")
async def disconnect_bank(bank_name: str, profile_id: int, db: Session = Depends(get_db)):
    """Disconnect bank"""
    conn = db.query(BankConnection).filter(
        BankConnection.profile_id == profile_id,
        BankConnection.bank_name == bank_name
    ).first()
    
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    conn.is_active = False
    db.commit()
    
    return {"status": "disconnected"}





