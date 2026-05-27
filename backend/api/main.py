import os
import json
import hashlib
from datetime import datetime, date
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Date, ForeignKey, Text, desc
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from dotenv import load_dotenv

load_dotenv()

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./unitas.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(String, unique=True, index=True, nullable=True)
    role = Column(String, default="user") # user, admin
    language = Column(String, default="uk")
    companies = relationship("Company", back_populates="owner")

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
    is_vat_payer = Column(Boolean, default=False)
    
    owner = relationship("User", back_populates="companies")
    employees = relationship("Employee", back_populates="company")
    tax_events = relationship("TaxEvent", back_populates="company")
    bank_statements = relationship("BankStatement", back_populates="company")
    generated_reports = relationship("GeneratedReport", back_populates="company")

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    name = Column(String)
    salary = Column(Float) # оклад/ставка
    start_date = Column(Date, default=date.today)
    
    company = relationship("Company", back_populates="employees")

class TaxEvent(Base):
    __tablename__ = "tax_events"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    title = Column(String)
    type = Column(String) # payment, report
    tax_name = Column(String) # unified_tax, esv, pit, military_tax, profit_tax, employee_taxes, employee_report
    due_date = Column(Date)
    amount_desc = Column(String, nullable=True)
    form_code = Column(String, nullable=True) # F0103306, etc.
    status = Column(String, default="pending") # pending, paid, submitted
    
    company = relationship("Company", back_populates="tax_events")

class BankStatement(Base):
    __tablename__ = "bank_statements"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    file_name = Column(String)
    file_hash = Column(String, unique=True)
    bank_name = Column(String)
    uploaded_at = Column(Date)
    status = Column(String, default="parsed") # parsed, failed
    
    company = relationship("Company", back_populates="bank_statements")
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
    type = Column(String) # income, tax_payment, expense
    tax_type = Column(String, nullable=True) # unified_tax, esv, pit, military_tax, profit_tax, None
    
    statement = relationship("BankStatement", back_populates="payments")

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
    company_id = Column(Integer, ForeignKey("companies.id"))
    form_code = Column(String)
    period = Column(String) # Q1, Q2, Q3, Q4, Year
    year = Column(Integer)
    data_json = Column(Text) # заповнені поля {field_id: {value, color}}
    xml_content = Column(Text, nullable=True)
    status = Column(String, default="draft") # draft, submitted
    created_at = Column(Date, default=date.today)
    
    company = relationship("Company", back_populates="generated_reports")

# Create tables
Base.metadata.create_all(engine)

# Migrate schema if columns are missing
from sqlalchemy import text
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE companies ADD COLUMN is_vat_payer BOOLEAN DEFAULT FALSE"))
        conn.commit()
    except Exception:
        # column already exists or other databases
        pass

# Seed Report Templates on startup
db = SessionLocal()
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

# Imports from core
from ai_parser.universal_parser import UniversalParser
from tax_calendar.generator import TaxCalendarGenerator

@app.post("/api/register")
def register_user(
    telegram_id: Optional[str] = Form(None),
    company_name: str = Form("Моя компанія"),
    tax_system: str = Form("fop_ep"),
    group: Optional[int] = Form(3),
    rate: Optional[float] = Form(5.0),
    has_employees: bool = Form(False),
    is_vat_payer: bool = Form(False),
    reg_date: str = Form(None),
    db: Session = Depends(get_db)
):
    # Шукаємо або створюємо користувача
    user = None
    if telegram_id:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
    
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
        is_vat_payer=is_vat_payer
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    # Генеруємо податковий календар на 12 місяців
    generator = TaxCalendarGenerator()
    events = generator.generate_calendar(
        tax_system=tax_system,
        group=group,
        rate=rate,
        has_employees=has_employees,
        reg_date_str=reg_date_parsed.strftime("%Y-%m-%d"),
        start_date=reg_date_parsed,
        is_vat_payer=is_vat_payer
    )
    
    for ev in events:
        db_ev = TaxEvent(
            company_id=company.id,
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

    return {"message": "Успішно зареєстровано", "user_id": user.id, "company_id": company.id}

@app.get("/api/companies/{telegram_id}")
def get_user_companies(telegram_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    return user.companies

@app.post("/api/upload-statement")
async def upload_statement(
    company_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Компанію не знайдено")

    file_content = await file.read()
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

    # Визначаємо банк з першої транзакції
    bank_name = parsed_txs[0]["bank_name"] if parsed_txs else "Невідомий Банк"

    # Створюємо запис про виписку
    statement = BankStatement(
        company_id=company_id,
        file_name=file.filename,
        file_hash=file_hash,
        bank_name=bank_name,
        uploaded_at=date.today(),
        status="parsed"
    )
    db.add(statement)
    db.commit()
    db.refresh(statement)

    # Зберігаємо платежі
    for tx in parsed_txs:
        db_payment = ParsedPayment(
            statement_id=statement.id,
            date=datetime.strptime(tx["date"], "%Y-%m-%d").date(),
            amount=tx["amount"],
            direction=tx["direction"],
            purpose=tx["purpose"],
            contragent=tx["contragent"],
            type=tx["type"],
            tax_type=tx["tax_type"]
        )
        db.add(db_payment)
    db.commit()

    return {"message": f"Завантажено {len(parsed_txs)} транзакцій з {bank_name}", "statement_id": statement.id}

@app.get("/api/dashboard/{company_id}")
def get_dashboard(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Компанію не знайдено")

    # Збираємо всі транзакції компанії
    payments = db.query(ParsedPayment).join(BankStatement).filter(BankStatement.company_id == company_id).all()
    
    total_income = sum(p.amount for p in payments if p.direction == "in")
    total_expense = sum(p.amount for p in payments if p.direction == "out" and p.type != "tax_payment")
    
    # Розрахунок податку до сплати
    tax_due = 0.0
    if company.tax_system == "fop_ep":
        if company.group == 3:
            tax_due = total_income * ((company.rate or 5.0) / 100.0)
    elif company.tax_system == "fop_general":
        # Спрощений ПДФО + ВЗ (19.5% від чистого прибутку)
        tax_due = max(0.0, total_income - total_expense) * 0.195

    # Сплачені податки
    tax_paid_dict = {"unified_tax": 0.0, "esv": 0.0, "pit": 0.0, "military_tax": 0.0, "employee_taxes": 0.0}
    for p in payments:
        if p.type == "tax_payment" and p.tax_type:
            tax_paid_dict[p.tax_type] = tax_paid_dict.get(p.tax_type, 0.0) + p.amount
            
    total_tax_paid = sum(tax_paid_dict.values())

    # Наступні події календаря
    upcoming_events = db.query(TaxEvent).filter(
        TaxEvent.company_id == company_id, 
        TaxEvent.due_date >= date.today()
    ).order_by(TaxEvent.due_date).limit(5).all()

    return {
        "company_name": company.name,
        "tax_system": company.tax_system,
        "group": company.group,
        "rate": company.rate,
        "total_income": total_income,
        "total_expense": total_expense,
        "tax_due": tax_due,
        "tax_paid": total_tax_paid,
        "tax_breakdown": tax_paid_dict,
        "balance_status": "due" if tax_due > total_tax_paid else "paid",
        "difference": abs(tax_due - total_tax_paid),
        "upcoming_events": [{
            "id": ev.id,
            "title": ev.title,
            "due_date": ev.due_date.strftime("%Y-%m-%d"),
            "type": ev.type,
            "amount_desc": ev.amount_desc,
            "status": ev.status
        } for ev in upcoming_events]
    }

@app.get("/api/calendar/{company_id}")
def get_calendar(company_id: int, db: Session = Depends(get_db)):
    events = db.query(TaxEvent).filter(TaxEvent.company_id == company_id).order_by(TaxEvent.due_date).all()
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
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Компанію не знайдено")

    template = db.query(ReportTemplate).filter(ReportTemplate.form_code == form_code).first()
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон звіту не знайдено")

    owner = company.owner
    data = {}
    
    if form_code == "F0110210":
        v_in = vat_in if vat_in is not None else 0.0
        v_out = vat_out if vat_out is not None else 0.0
        v_due = v_out - v_in
        
        data["HNAME"] = {"value": company.name or "ТОВ Моя Компанія", "color": "yellow"}
        data["HTIN"] = {"value": owner.telegram_id or "", "color": "red" if not owner.telegram_id else "green"}
        data["HEMAIL"] = {"value": "client@example.com", "color": "yellow"}
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
        payments = db.query(ParsedPayment).join(BankStatement).filter(
            BankStatement.company_id == company_id,
            ParsedPayment.direction == "in"
        ).all()

        total_income = sum(p.amount for p in payments)

        data["HNAME"] = {"value": company.name or "ФОП Петренко Іван", "color": "yellow"}
        data["HTIN"] = {"value": owner.telegram_id or "", "color": "red" if not owner.telegram_id else "green"}
        data["HEMAIL"] = {"value": "client@example.com", "color": "yellow"}
        
        data["ROW01"] = {"value": total_income if period == "Q1" else 0.0, "color": "green" if total_income > 0 else "yellow"}
        data["ROW02"] = {"value": total_income if period == "Q2" else 0.0, "color": "green" if period == "Q2" else "yellow"}
        data["ROW03"] = {"value": total_income if period == "Q3" else 0.0, "color": "green" if period == "Q3" else "yellow"}
        data["ROW04"] = {"value": total_income if period == "Year" else 0.0, "color": "green" if period == "Year" else "yellow"}
        
        data["TAX_RATE"] = {"value": company.rate or 5.0, "color": "green"}
        
        tax_due_val = total_income * ((company.rate or 5.0) / 100.0)
        data["TAX_DUE"] = {"value": tax_due_val, "color": "green"}

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
        <R01G3>{data["ROW01"]["value"]}</R01G3>
        <R05G3>{data["TAX_RATE"]["value"]}</R05G3>
        <R06G3>{data["TAX_DUE"]["value"]}</R06G3>
    </DECLARBODY>
</DECLAR>"""

    # Зберігаємо чернетку
    report = GeneratedReport(
        template_id=template.id,
        company_id=company_id,
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
    reports = db.query(GeneratedReport).filter(GeneratedReport.company_id == company_id).order_by(desc(GeneratedReport.created_at)).all()
    return [{
        "id": r.id,
        "form_code": r.form_code,
        "period": r.period,
        "year": r.year,
        "status": r.status,
        "created_at": r.created_at.strftime("%Y-%m-%d")
    } for r in reports]

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
    else:
        # Mock інший формат
        return {"id": report.id, "format": file_format, "content": "Симуляція PDF файлу"}
