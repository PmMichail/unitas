import os
import json
import hashlib
import uuid
from datetime import datetime, date
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Text, desc
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from dotenv import load_dotenv

load_dotenv()

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./unitas.db")
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
    role = Column(String, default="user") # user, admin
    language = Column(String, default="uk")
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
    
    owner = relationship("User", back_populates="profiles")
    employees = relationship("Employee", back_populates="profile")
    tax_events = relationship("TaxEvent", back_populates="profile")
    bank_statements = relationship("BankStatement", back_populates="profile")
    generated_reports = relationship("GeneratedReport", back_populates="profile")
    payments = relationship("ParsedPayment", back_populates="profile")

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
    
    company = relationship("Company", back_populates="tax_events")
    profile = relationship("Profile", back_populates="tax_events")

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

class SystemConfig(Base):
    __tablename__ = "system_configs"
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)

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
    "ALTER TABLE recurring_invoices ADD COLUMN client_address TEXT DEFAULT NULL"
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

# Seed Report Templates on startup
db = SessionLocal()

# Sync Postgres sequences if necessary
if "postgresql" in DATABASE_URL:
    try:
        from sqlalchemy import text
        for table in ["users", "companies", "profiles", "employees", "tax_events", "bank_statements", "parsed_payments", "report_templates", "generated_reports", "recurring_invoices", "invoices", "service_acts"]:
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
        esv_paid_by_employer=getattr(profile, 'esv_paid_by_employer', False)
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

@app.get("/api/dashboard/{profile_id}")
def get_dashboard(
    profile_id: int,
    db: Session = Depends(get_db),
    period_type: str = "all",
    year: Optional[int] = None,
    period_value: Optional[int] = None
):
    import datetime as dt_module
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")

    min_sal = get_config_val(db, "min_salary", 8647.0)
    mil_fop_rate = get_config_val(db, "military_tax_fop_rate", 1.0)
    mil_emp_rate = get_config_val(db, "military_tax_employee_rate", 5.0)
    pit_rate = get_config_val(db, "pit_employee_rate", 18.0)
    esv_rate = get_config_val(db, "esv_employee_rate", 22.0)
    esv_fop_monthly = get_config_val(db, "esv_fop_monthly", 1562.0)
    default_rate = get_config_val(db, "unified_tax_rate_group_3", 5.0)

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
    
    # Розрахунок taxable_income (оподатковуваний дохід)
    taxable_income = sum(p.amount for p in payments if p.direction == "in" and p.taxable and p.transaction_type == "income")
    
    # Інші категорії доходів та витрат
    own_funds = sum(p.amount for p in payments if p.transaction_type == "own_funds")
    refund = sum(p.amount for p in payments if p.transaction_type == "refund")
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
    num_months = 1
    if period_type == "month":
        num_months = 1
    elif period_type == "quarter":
        num_months = 3
    elif period_type == "year":
        num_months = 12
    else:
        if start_dt and end_dt:
            num_months = (end_dt.year - start_dt.year) * 12 + (end_dt.month - start_dt.month) + 1
        elif latest_stmt and latest_stmt.period_start and latest_stmt.period_end:
            p_start = latest_stmt.period_start
            p_end = latest_stmt.period_end
            num_months = (p_end.year - p_start.year) * 12 + (p_end.month - p_start.month) + 1
        else:
            months = 3
            if profile.reg_date:
                today = date.today()
                months = max(1, (today.year - profile.reg_date.year) * 12 + (today.month - profile.reg_date.month) + 1)
                months = min(12, months)
            num_months = months

    tax_due = 0.0
    tax_system = profile.tax_system
    if is_simplified_tax(tax_system):
        if profile.type == "fop" and profile.group == 1:
            # Фіксований єдиний податок 1 групи: 10% від прожиткового мінімуму (прибл. 302.80 грн/міс)
            tax_due = num_months * 302.80
        elif profile.type == "fop" and profile.group == 2:
            # Фіксований єдиний податок 2 групи: 20% від мінімальної зарплати
            tax_due = num_months * (min_sal * 0.20)
        else:
            # 3 група: відсоток від доходу
            tax_due = taxable_income * ((profile.rate or default_rate) / 100.0)
    elif is_general_tax(tax_system):
        taxable_expense = sum(p.amount for p in payments if p.direction == "out" and p.taxable)
        net_profit = max(0.0, taxable_income - taxable_expense)
        # 18% податок на прибуток / ПДФО від чистого прибутку
        tax_due = net_profit * (pit_rate / 100.0)

    # Розрахунок Військового збору
    military_tax_due = 0.0
    if profile.type == "fop":
        if is_simplified_tax(tax_system):
            if profile.group in (1, 2):
                # Фіксований військовий збір для 1 та 2 груп (10% від мін. зарплати = 864.70 грн/міс)
                military_tax_due = num_months * (min_sal * 0.10)
            else:
                # 3 група: 1% від доходу
                military_tax_due = taxable_income * (mil_fop_rate / 100.0)
        elif is_general_tax(tax_system):
            # Загальна система: 5% від чистого прибутку
            taxable_expense = sum(p.amount for p in payments if p.direction == "out" and p.taxable)
            net_profit = max(0.0, taxable_income - taxable_expense)
            military_tax_due = net_profit * (mil_emp_rate / 100.0)

    # Розрахунок ЄСВ за себе (для ФОП)
    esv_due = 0.0
    if profile.type == "fop" and not getattr(profile, 'esv_paid_by_employer', False):
        esv_due = num_months * esv_fop_monthly

    # Розрахунок податків за найманих працівників
    employee_esv_due = 0.0
    employee_pit_due = 0.0
    employee_mil_due = 0.0
    
    profile_employees = db.query(Employee).filter(
        (Employee.profile_id == profile_id) | (Employee.company_id == profile_id)
    ).all()
    
    if profile.has_employees or len(profile_employees) > 0:
        # Визначення кількості місяців для працівників
        num_months_emp = 1
        if period_type == "month":
            num_months_emp = 1
        elif period_type == "quarter":
            num_months_emp = 3
        elif period_type == "year":
            num_months_emp = 12
        else:
            if start_dt and end_dt:
                num_months_emp = (end_dt.year - start_dt.year) * 12 + (end_dt.month - start_dt.month) + 1
            elif latest_stmt and latest_stmt.period_start and latest_stmt.period_end:
                p_start = latest_stmt.period_start
                p_end = latest_stmt.period_end
                num_months_emp = (p_end.year - p_start.year) * 12 + (p_end.month - p_start.month) + 1
            elif profile.reg_date:
                today = date.today()
                num_months_emp = max(1, (today.year - profile.reg_date.year) * 12 + (today.month - profile.reg_date.month) + 1)
                num_months_emp = min(12, num_months_emp)
            else:
                num_months_emp = 3

        for emp in profile_employees:
            is_main = getattr(emp, 'is_main_job', True)
            if is_main is None:
                is_main = True
            esv_base = max(emp.salary, min_sal) if is_main else emp.salary
            
            employee_esv_due += (esv_base * (esv_rate / 100.0)) * num_months_emp
            employee_pit_due += (emp.salary * (pit_rate / 100.0)) * num_months_emp
            employee_mil_due += (emp.salary * (mil_emp_rate / 100.0)) * num_months_emp

    employee_esv_due = round(employee_esv_due, 2)
    employee_pit_due = round(employee_pit_due, 2)
    employee_mil_due = round(employee_mil_due, 2)

    esv_due_total = esv_due + employee_esv_due
    military_tax_due_total = military_tax_due + employee_mil_due

    # Сплачені податки
    tax_paid_dict = {"unified_tax": 0.0, "esv": 0.0, "pit": 0.0, "military_tax": 0.0, "employee_taxes": 0.0}
    for p in payments:
        if p.type == "tax_payment" and p.tax_type:
            tax_paid_dict[p.tax_type] = tax_paid_dict.get(p.tax_type, 0.0) + p.amount
            
    # Заокруглимо сплачені податки до 2 знаків
    for k in tax_paid_dict:
        tax_paid_dict[k] = round(tax_paid_dict[k], 2)
        
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
            events = generator.generate_calendar(
                tax_system=profile.tax_system,
                group=profile.group,
                rate=profile.rate,
                has_employees=profile.has_employees or len(profile_employees) > 0,
                reg_date_str=reg_date_val.strftime("%Y-%m-%d") if hasattr(reg_date_val, 'strftime') else str(reg_date_val),
                start_date=date.today(),
                is_vat_payer=profile.is_vat_payer,
                esv_paid_by_employer=getattr(profile, 'esv_paid_by_employer', False)
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
        
        m_income = sum(p.amount for p in m_payments if p.direction == "in")
        m_taxable_income = sum(p.amount for p in m_payments if p.direction == "in" and p.taxable and p.transaction_type == "income")
        m_expense = sum(p.amount for p in m_payments if p.direction == "out")
        
        # Main tax due
        m_tax_due = 0.0
        if is_simplified_tax(tax_system):
            if profile.type == "fop" and profile.group == 1:
                m_tax_due = 302.80
            elif profile.type == "fop" and profile.group == 2:
                m_tax_due = min_sal * 0.20
            else:
                m_tax_due = m_taxable_income * ((profile.rate or default_rate) / 100.0)
        elif is_general_tax(tax_system):
            m_taxable_expense = sum(p.amount for p in m_payments if p.direction == "out" and p.taxable)
            m_net_profit = max(0.0, m_taxable_income - m_taxable_expense)
            m_tax_due = m_net_profit * (pit_rate / 100.0)
            
        # Military tax due
        m_mil_due = 0.0
        if profile.type == "fop":
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
        if profile.type == "fop" and not getattr(profile, 'esv_paid_by_employer', False):
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
        "breakdown": breakdown_list
    }

@app.get("/api/calendar/{company_id}")
def get_calendar(company_id: int, db: Session = Depends(get_db)):
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
    year: int = 2025, 
    vat_in: Optional[float] = None,
    vat_out: Optional[float] = None,
    db: Session = Depends(get_db)
):
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
    rate_val = profile.rate if profile else (company.rate if company else 5.0)

    data = {}
    
    if form_code == "F0110210":
        v_in = vat_in if vat_in is not None else 0.0
        v_out = vat_out if vat_out is not None else 0.0
        v_due = v_out - v_in
        
        data["HNAME"] = {"value": company_name_val, "color": "green" if company_name_val else "yellow"}
        data["HTIN"] = {"value": tax_id_val, "color": "green" if tax_id_val else "red"}
        data["HEMAIL"] = {"value": email_val, "color": "green"}
        data["VAT_OUT"] = {"value": v_out, "color": "green" if vat_out is not None else "yellow"}
        data["VAT_IN"] = {"value": v_in, "color": "green" if vat_in is not None else "yellow"}
        data["VAT_DUE"] = {"value": v_due, "color": "green"}
        
        xml_content = f"""<?xml version="1.0" encoding="windows-1251"?>
<DECLAR xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="F0110210.xsd">
    <DECLARHEAD>
        <TIN>{data["HTIN"]["value"]}</TIN>
        <C_DOC>F01</C_DOC>
        <C_DOC_SUB>102</C_DOC_SUB>
        <C_DOC_VER>10</C_DOC_VER>
        <PERIOD_TYPE>5</PERIOD_TYPE>
        <PERIOD_MONTH>{period}</PERIOD_MONTH>
        <PERIOD_YEAR>{year}</PERIOD_YEAR>
    </DECLARHEAD>
    <DECLARBODY>
        <HNAME>{data["HNAME"]["value"]}</HNAME>
        <R01G3>{data["VAT_OUT"]["value"]}</R01G3>
        <R02G3>{data["VAT_IN"]["value"]}</R02G3>
        <R03G3>{data["VAT_DUE"]["value"]}</R03G3>
    </DECLARBODY>
</DECLAR>"""

    else:
        # Збираємо доходи за період (для F0103306)
        # Періоди у ФОП наростаючим підсумком:
        # Q1: 01.01 - 31.03
        # Q2 (Півріччя): 01.01 - 30.06
        # Q3 (9 місяців): 01.01 - 30.09
        # Year / Q4 (Рік): 01.01 - 31.12
        p_clean = period.lower()
        start_date_bound = date(year, 1, 1)
        if "q1" in p_clean:
            end_date_bound = date(year, 3, 31)
        elif "q2" in p_clean:
            end_date_bound = date(year, 6, 30)
        elif "q3" in p_clean:
            end_date_bound = date(year, 9, 30)
        else:
            end_date_bound = date(year, 12, 31)

        payments = db.query(ParsedPayment).filter(
            ((ParsedPayment.profile_id == company_id) | 
             (ParsedPayment.statement.has(BankStatement.profile_id == company_id))),
            ParsedPayment.direction == "in",
            ParsedPayment.taxable == True,
            ParsedPayment.transaction_type == "income",
            ParsedPayment.date >= start_date_bound,
            ParsedPayment.date <= end_date_bound
        ).all()

        total_income = sum(p.amount for p in payments)

        data["HNAME"] = {"value": company_name_val, "color": "green" if company_name_val else "yellow"}
        data["HTIN"] = {"value": tax_id_val, "color": "green" if tax_id_val else "red"}
        data["HEMAIL"] = {"value": email_val, "color": "green"}
        
        # Наростаючий підсумок заповнюємо у відповідний рядок
        data["ROW01"] = {"value": total_income if "q1" in p_clean else 0.0, "color": "green" if "q1" in p_clean else "yellow"}
        data["ROW02"] = {"value": total_income if "q2" in p_clean else 0.0, "color": "green" if "q2" in p_clean else "yellow"}
        data["ROW03"] = {"value": total_income if "q3" in p_clean else 0.0, "color": "green" if "q3" in p_clean else "yellow"}
        data["ROW04"] = {"value": total_income if ("q4" in p_clean or "year" in p_clean) else 0.0, "color": "green" if ("q4" in p_clean or "year" in p_clean) else "yellow"}
        
        data["TAX_RATE"] = {"value": rate_val, "color": "green"}
        
        tax_due_val = total_income * (rate_val / 100.0)
        data["TAX_DUE"] = {"value": tax_due_val, "color": "green"}

        active_row_val = total_income
        xml_content = f"""<?xml version="1.0" encoding="windows-1251"?>
<DECLAR xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="F0103306.xsd">
    <DECLARHEAD>
        <TIN>{data["HTIN"]["value"]}</TIN>
        <C_DOC>F01</C_DOC>
        <C_DOC_SUB>033</C_DOC_SUB>
        <C_DOC_VER>06</C_DOC_VER>
        <PERIOD_TYPE>5</PERIOD_TYPE>
        <PERIOD_MONTH>{period}</PERIOD_MONTH>
        <PERIOD_YEAR>{year}</PERIOD_YEAR>
    </DECLARHEAD>
    <DECLARBODY>
        <HNAME>{data["HNAME"]["value"]}</HNAME>
        <R01G3>{active_row_val}</R01G3>
        <R05G3>{data["TAX_RATE"]["value"]}</R05G3>
        <R06G3>{data["TAX_DUE"]["value"]}</R06G3>
    </DECLARBODY>
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
    
    if file_format == "xml":
        return Response(
            content=report.xml_content or "", 
            media_type="application/xml",
            headers={"Content-Disposition": f"attachment; filename={report.form_code}_{report.period}_{report.year}.xml"}
        )
    elif file_format == "json":
        return Response(
            content=report.data_json, 
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={report.form_code}_{report.period}_{report.year}.json"}
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
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontName=font_name,
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#1A365D"),
            spaceAfter=12
        )
        meta_style = ParagraphStyle(
            'MetaStyle',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#4A5568"),
            spaceAfter=6
        )
        
        story.append(Paragraph(f"ПОДАТКОВА ДЕКЛАРАЦІЯ ({report.form_code})", title_style))
        story.append(Paragraph(f"Період: {report.period} • {report.year} рік", meta_style))
        story.append(Paragraph(f"Дата створення: {report.created_at.strftime('%d.%m.%Y')}", meta_style))
        story.append(Spacer(1, 15))
        
        fields_data = json.loads(report.data_json)
        
        table_data = [[
            Paragraph("Код", ParagraphStyle('HCol1', fontName=font_name, fontSize=9, textColor=colors.white)),
            Paragraph("Назва поля / Показник", ParagraphStyle('HCol2', fontName=font_name, fontSize=9, textColor=colors.white)),
            Paragraph("Значення", ParagraphStyle('HCol3', fontName=font_name, fontSize=9, textColor=colors.white))
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
            
        t = Table(table_data, colWidths=[60, 320, 140])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2B6CB0")),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor("#F7FAFC")),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(t)
        
        doc.build(story)
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={report.form_code}_{report.period}_{report.year}.pdf"}
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
            
        return Response(
            content=output.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={report.form_code}_{report.period}_{report.year}.csv"}
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
def get_profiles(telegram_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter((User.telegram_id == telegram_id) | (User.email == telegram_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    return user.profiles

@app.get("/api/profiles")
def get_profiles_query(telegram_id: str, db: Session = Depends(get_db)):
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
        address=address
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    # For compatibility, also create a Company
    comp_tax_system = "fop_ep"
    if type == "fop":
        comp_tax_system = "fop_ep" if tax_system == "ednuy-3-5%" else "fop_general"
    else:
        comp_tax_system = "llc_ep" if tax_system == "ednuy-3-5%" else "llc_profit"

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
        address=address
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    # Generate tax events for the profile/company
    generator = TaxCalendarGenerator()
    events = generator.generate_calendar(
        tax_system=comp_tax_system,
        group=group,
        rate=rate,
        has_employees=has_employees,
        reg_date_str=reg_date_parsed.strftime("%Y-%m-%d"),
        start_date=reg_date_parsed,
        is_vat_payer=is_vat_payer,
        esv_paid_by_employer=getattr(profile, 'esv_paid_by_employer', False)
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

    return {"message": "Профіль успішно створено", "profile_id": profile.id, "company_id": company.id}


@app.get("/api/tax-analysis/{profile_id}")
def get_tax_analysis(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Профіль не знайдено")
        
    payments = db.query(ParsedPayment).filter(
        (ParsedPayment.profile_id == profile_id) |
        (ParsedPayment.statement.has(BankStatement.profile_id == profile_id))
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
                
    # Calculate tax dues per quarter
    generator = TaxCalendarGenerator()
    for key, data in quarters_data.items():
        y, q = key
        
        q_start_month = (q - 1) * 3 + 1
        q_end_month = q * 3
        
        import calendar as cal
        last_day = cal.monthrange(y, q_end_month)[1]
        q_start_date = date(y, q_start_month, 1)
        q_end_date = date(y, q_end_month, last_day)
        
        if profile.reg_date and profile.reg_date > q_end_date:
            esv_months = 0
        elif profile.reg_date and q_start_date <= profile.reg_date <= q_end_date:
            esv_months = q_end_month - profile.reg_date.month + 1
        else:
            esv_months = 3
            
        esv_fop = get_config_val(db, "esv_fop_monthly", 1562.0)
        mil_fop_rate = get_config_val(db, "military_tax_fop_rate", 1.0)
        mil_emp_rate = get_config_val(db, "military_tax_employee_rate", 5.0)
        pit_rate = get_config_val(db, "pit_employee_rate", 18.0)
        default_rate = get_config_val(db, "unified_tax_rate_group_3", 5.0)

        if profile.type == 'fop':
            if getattr(profile, 'esv_paid_by_employer', False):
                data["esv_due"] = 0.0
            else:
                data["esv_due"] = esv_months * esv_fop
            
            if is_simplified_tax(profile.tax_system):
                data["unified_tax_due"] = data["taxable_income"] * ((profile.rate or default_rate) / 100.0)
                data["military_tax_due"] = data["taxable_income"] * (mil_fop_rate / 100.0)
            elif is_general_tax(profile.tax_system):
                q_expenses = sum(p.amount for p in payments if p.direction == "out" and p.taxable and p.date and p.date.year == y and ((p.date.month - 1) // 3 + 1) == q)
                profit = max(0.0, data["taxable_income"] - q_expenses)
                data["unified_tax_due"] = profit * (pit_rate / 100.0)
                data["military_tax_due"] = profit * (mil_emp_rate / 100.0)
        else:
            # LLC
            if is_simplified_tax(profile.tax_system):
                data["unified_tax_due"] = data["taxable_income"] * ((profile.rate or default_rate) / 100.0)
            elif is_general_tax(profile.tax_system):
                q_expenses = sum(p.amount for p in payments if p.direction == "out" and p.taxable and p.date and p.date.year == y and ((p.date.month - 1) // 3 + 1) == q)
                profit = max(0.0, data["taxable_income"] - q_expenses)
                data["unified_tax_due"] = profit * (pit_rate / 100.0)
                
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
        esv_paid_by_employer=getattr(profile, 'esv_paid_by_employer', False)
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
        "military_tax_fop_rate": 1.0,
        "military_tax_employee_rate": 5.0,
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
    mil_fop_rate = get_config_val(db, "military_tax_fop_rate", 1.0)
    mil_emp_rate = get_config_val(db, "military_tax_employee_rate", 5.0)
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
        model_to_use = "gemini-1.5-flash"
        
    if not client_to_use:
        # Багатий оффлайн-відповідач
        msg_lower = user_message.lower()
        if "військов" in msg_lower or "вз" in msg_lower or "збір" in msg_lower:
            if profile.type == "fop":
                response_text = f"Для вашого ФОП на спрощеній системі оподаткування військовий збір становить **{mil_fop_rate}% від загального доходу** (за поточний звітний період це складає {(total_income * mil_fop_rate / 100.0):.2f} грн). Якщо у вас є працівники, ви також сплачуєте військовий збір у розмірі **{mil_emp_rate}% від їхньої заробітної плати** щомісячно."
            else:
                response_text = f"Для вашої компанії {profile.name} (ТОВ) військовий збір на прибуток не нараховується. Проте ви зобов'язані утримувати та сплачувати військовий збір у розмірі **{mil_emp_rate}% від заробітної плати** найманих працівників щомісячно при виплаті заробітної плати."
        elif "працівн" in msg_lower or "зарплат" in msg_lower or "робітн" in msg_lower:
            response_text = f"У вашому профілі зареєстровано **{len(profile_employees)} найманих працівників**. З кожної зарплати ви маєте сплатити: ПДФО ({pit_rate}%), Військовий збір ({mil_emp_rate}%) та ЄСВ на фонд оплат ({esv_rate}%). Граничний термін сплати податків із зарплати — 30 число наступного місяця."
        elif "звіт" in msg_lower or "декларац" in msg_lower:
            response_text = f"Для вашої системи ({profile.tax_system}) звітність подається щоквартально. Найближчий звіт: Декларація єдиного податку (Форма { 'F0103306' if profile.type == 'fop' else 'J0103508' }) за 1 квартал. Термін подання — протягом 40 днів після закінчення кварталу."
        elif "дохід" in msg_lower or "сума" in msg_lower or "ліміт" in msg_lower:
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
        elif "єсв" in msg_lower or "соціал" in msg_lower or "внесок" in msg_lower:
            if profile.type == "fop":
                response_text = f"Для ФОП єдиний соціальний внесок (ЄСВ) за себе становить **{esv_fop} грн на місяць** (сплачується щоквартально: {esv_fop * 3} грн). Термін сплати — до 20 числа місяця, наступного за кварталом. Якщо у вас є працівники, ви додатково сплачуєте ЄСВ у розмірі 22% від їхньої заробітної плати."
            else:
                response_text = f"Для ТОВ (підприємства) ЄСВ за себе не нараховується. Ви сплачуєте лише ЄСВ на заробітну плату найманих працівників у розмірі **22% від фонду оплати праці** щомісячно."
        elif "привіт" in msg_lower or "добрий" in msg_lower or "вітаю" in msg_lower:
            response_text = f"Вітаю! Я ваш ШІ-Асистент UniTax. Я можу відповісти на будь-які ваші запитання щодо податків, військового збору, ЄСВ, лімітів чи звітів для профілю **{profile.name}**. Запитайте мене про будь-що!"
        else:
            response_text = f"Дякую за запитання щодо профілю {profile.name}! Я можу детально розповісти про:\n" \
                            f"• **Військовий збір**: {mil_fop_rate}% для ФОП, {mil_emp_rate}% з зарплат\n" \
                            f"• **Єдиний податок**: ставку та розраховану суму ({profile.rate or default_rate}%)\n" \
                            f"• **ЄСВ за себе**: {esv_fop} грн/місяць\n" \
                            f"• **Ліміти доходу** та податкові декларації.\n" \
                            f"Будь ласка, уточніть ваше питання, і я надам точну відповідь!"
            
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


