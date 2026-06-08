# backend/services/tax_calculator.py

from typing import Dict, List, Optional, Tuple
from datetime import date, datetime
from decimal import Decimal

class TaxCalculator:
    """
    Єдиний сервіс розрахунку податків для UniTax.
    Забезпечує узгоджене обчислення податків на всій платформі.
    """
    
    # Податкові ставки (стандартні значення, можуть бути перекриті конфігурацією)
    DEFAULT_RATES = {
        # Військовий збір
        "military_tax_fop_rate": 1.0,  # 1% для ФОП
        "military_tax_employee_rate": 5.0,  # 5% для працівників
        
        # ПДФО
        "pit_employee_rate": 18.0,  # 18% ПДФО
        
        # ЄСВ
        "esv_employee_rate": 22.0,  # 22% ЄСВ
        "esv_fop_monthly": 1562.0,  # ЄСВ за себе для ФОП
        
        # Єдиний податок
        "unified_tax_rate_group_3": 5.0,  # 5% для 3 групи
        
        # Податок на прибуток
        "profit_tax_rate": 18.0,  # 18% податок на прибуток
        
        # Мінімальна зарплата
        "min_salary": 8647.0,  # Мінімальна зарплата 2026
    }
    
    def __init__(self, config_rates: Optional[Dict] = None):
        """
        Ініціалізація калькулятора.
        
        Args:
            config_rates: Словник з налаштованими ставками (перекривають DEFAULT_RATES)
        """
        self.rates = {**self.DEFAULT_RATES}
        if config_rates:
            self.rates.update(config_rates)
    
    def get_rate(self, key: str) -> float:
        """Отримати ставку за ключем"""
        return self.rates.get(key, 0.0)
    
    def calculate_military_tax_fop(self, taxable_income: float, group: int, num_months: int = 1) -> float:
        """
        Розрахунок військового збору для ФОП.
        
        Args:
            taxable_income: Оподатковуваний дохід
            group: Група ФОП (1, 2, 3)
            num_months: Кількість місяців у періоді
            
        Returns:
            Сума військового збору
        """
        min_sal = self.get_rate("min_salary")
        mil_rate = self.get_rate("military_tax_fop_rate")
        
        if group in (1, 2):
            # Фіксований військовий збір для 1 та 2 груп (10% від мін. зарплати)
            return num_months * (min_sal * 0.10)
        else:
            # 3 група: 1% від доходу
            return taxable_income * (mil_rate / 100.0)
    
    def calculate_military_tax_employee(self, salary: float, num_months: int = 1) -> float:
        """
        Розрахунок військового збору для працівників.
        
        Args:
            salary: Зарплата працівника
            num_months: Кількість місяців у періоді
            
        Returns:
            Сума військового збору
        """
        mil_rate = self.get_rate("military_tax_employee_rate")
        return salary * (mil_rate / 100.0) * num_months
    
    def calculate_pit_employee(self, salary: float, num_months: int = 1) -> float:
        """
        Розрахунок ПДФО для працівників.
        
        Args:
            salary: Зарплата працівника
            num_months: Кількість місяців у періоді
            
        Returns:
            Сума ПДФО
        """
        pit_rate = self.get_rate("pit_employee_rate")
        return salary * (pit_rate / 100.0) * num_months
    
    def calculate_esv_employee(self, salary: float, is_main_job: bool = True, num_months: int = 1) -> float:
        """
        Розрахунок ЄСВ для працівників.
        
        Args:
            salary: Зарплата працівника
            is_main_job: Чи є це основним місцем роботи
            num_months: Кількість місяців у періоді
            
        Returns:
            Сума ЄСВ
        """
        esv_rate = self.get_rate("esv_employee_rate")
        min_sal = self.get_rate("min_salary")
        
        # Якщо основне місце роботи - ЄСВ нараховується на min_sal або зарплату (більше)
        esv_base = max(salary, min_sal) if is_main_job else salary
        return esv_base * (esv_rate / 100.0) * num_months
    
    def calculate_esv_fop(self, num_months: int = 1, esv_paid_by_employer: bool = False) -> float:
        """
        Розрахунок ЄСВ за себе для ФОП.
        
        Args:
            num_months: Кількість місяців у періоді
            esv_paid_by_employer: Чи сплачує ЄСВ роботодавець
            
        Returns:
            Сума ЄСВ
        """
        if esv_paid_by_employer:
            return 0.0
        return self.get_rate("esv_fop_monthly") * num_months
    
    def calculate_unified_tax(self, taxable_income: float, group: int, num_months: int = 1) -> float:
        """
        Розрахунок єдиного податку для ФОП.
        
        Args:
            taxable_income: Оподатковуваний дохід
            group: Група ФОП (1, 2, 3)
            num_months: Кількість місяців у періоді
            
        Returns:
            Сума єдиного податку
        """
        min_sal = self.get_rate("min_salary")
        default_rate = self.get_rate("unified_tax_rate_group_3")
        
        if group == 1:
            # Фіксований єдиний податок 1 групи: 10% від прожиткового мінімуму
            return num_months * 302.80
        elif group == 2:
            # Фіксований єдиний податок 2 групи: 20% від мінімальної зарплати
            return num_months * (min_sal * 0.20)
        else:
            # 3 група: відсоток від доходу
            return taxable_income * (default_rate / 100.0)
    
    def calculate_profit_tax(self, taxable_income: float, taxable_expense: float) -> float:
        """
        Розрахунок податку на прибуток / ПДФО від чистого прибутку.
        
        Args:
            taxable_income: Оподатковуваний дохід
            taxable_expense: Оподатковувані витрати
            
        Returns:
            Сума податку на прибуток
        """
        pit_rate = self.get_rate("profit_tax_rate")
        net_profit = max(0.0, taxable_income - taxable_expense)
        return net_profit * (pit_rate / 100.0)
    
    def calculate_profile_taxes(
        self,
        profile: Dict,
        transactions: List[Dict],
        employees: List[Dict],
        num_months: int = 1
    ) -> Dict:
        """
        Повний розрахунок податків для профілю.
        
        Args:
            profile: Словник з даними профілю (tax_system, group, rate, type, has_employees, etc.)
            transactions: Список транзакцій (direction, amount, taxable, transaction_type)
            employees: Список працівників (salary, is_main_job)
            num_months: Кількість місяців у періоді
            
        Returns:
            Словник з розрахованими податками
        """
        # Розрахунок доходів та витрат
        total_income = sum(t["amount"] for t in transactions if t["direction"] == "in")
        total_expense = sum(t["amount"] for t in transactions if t["direction"] == "out")
        
        # Повернення
        incoming_refunds = sum(t["amount"] for t in transactions if t["direction"] == "in" and t["transaction_type"] == "refund")
        outgoing_refunds = sum(t["amount"] for t in transactions if t["direction"] == "out" and t["transaction_type"] == "refund")
        
        # Оподатковуваний дохід
        taxable_income = sum(t["amount"] for t in transactions if t["direction"] == "in" and t["taxable"] and t["transaction_type"] == "income") - outgoing_refunds
        taxable_income = max(0.0, taxable_income)
        
        # Оподатковувані витрати
        taxable_expense = sum(t["amount"] for t in transactions if t["direction"] == "out" and t["taxable"])
        
        tax_system = str(profile.get("tax_system", "simplified-3-5%")).lower()
        is_simplified = "simplified" in tax_system or tax_system in ["ednuy-3-5%", "single_tax", "fop_ep", "llc_ep", "ep"]
        is_general = "general" in tax_system or tax_system in ["zagalna", "general_tax", "fop_general", "llc_profit", "general"]
        is_fop = profile.get("type", "fop") == "fop"
        group = profile.get("group", 3)
        rate = profile.get("rate", 5.0)
        has_employees = profile.get("has_employees", False)
        esv_paid_by_employer = profile.get("esv_paid_by_employer", False)
        
        # Розрахунок основного податку
        tax_due = 0.0
        if is_simplified:
            if is_fop:
                tax_due = self.calculate_unified_tax(taxable_income, group, num_months)
            else:
                # ТОВ на спрощеній системі
                tax_due = taxable_income * (rate / 100.0)
        elif is_general:
            tax_due = self.calculate_profit_tax(taxable_income, taxable_expense)
        
        # Розрахунок військового збору
        military_tax_due = 0.0
        if is_fop:
            military_tax_due = self.calculate_military_tax_fop(taxable_income, group, num_months)
        elif is_simplified and not is_fop:
            # ТОВ на спрощеній системі - 1% від доходу
            military_tax_due = taxable_income * (self.get_rate("military_tax_fop_rate") / 100.0)
        elif is_general:
            # ТОВ на загальній системі - 1% від чистого прибутку
            net_profit = max(0.0, taxable_income - taxable_expense)
            military_tax_due = net_profit * (self.get_rate("military_tax_fop_rate") / 100.0)
        
        # Розрахунок ЄСВ за себе
        esv_due = 0.0
        if is_fop:
            esv_due = self.calculate_esv_fop(num_months, esv_paid_by_employer)
        
        # Розрахунок податків за працівників
        employee_esv_due = 0.0
        employee_pit_due = 0.0
        employee_mil_due = 0.0
        
        if has_employees or employees:
            for emp in employees:
                salary = emp.get("salary", 0)
                is_main = emp.get("is_main_job", True)
                
                employee_esv_due += self.calculate_esv_employee(salary, is_main, num_months)
                employee_pit_due += self.calculate_pit_employee(salary, num_months)
                employee_mil_due += self.calculate_military_tax_employee(salary, num_months)
        
        return {
            "tax_due": round(tax_due, 2),
            "military_tax_due": round(military_tax_due, 2),
            "esv_due": round(esv_due, 2),
            "employee_esv_due": round(employee_esv_due, 2),
            "employee_pit_due": round(employee_pit_due, 2),
            "employee_mil_due": round(employee_mil_due, 2),
            "total_due": round(tax_due + military_tax_due + esv_due + employee_esv_due + employee_pit_due + employee_mil_due, 2),
            "taxable_income": round(taxable_income, 2),
            "total_income": round(total_income, 2),
            "total_expense": round(total_expense, 2),
        }

    def get_summary(self, profile_id: int, db) -> dict:
        """
        Повертає РОЗРАХУНОК, який ВИКОРИСТОВУЮТЬ ВСІ:
        - дашборд (веб)
        - сторінка податків (веб)
        - мобільний додаток
        - Telegram бот
        """
        # Local imports to avoid circular dependency
        from api.main import Profile, ParsedPayment, Payment, Employee, BankStatement, get_paid_taxes_by_type, get_profile_num_months
        
        profile = db.query(Profile).filter(Profile.id == profile_id).first()
        if not profile:
            return {}
            
        # Get all parsed payments (all time)
        payments = db.query(ParsedPayment).filter(
            (ParsedPayment.profile_id == profile_id) |
            (ParsedPayment.statement.has(BankStatement.profile_id == profile_id))
        ).all()
        
        # Prepare transactions for calculate_profile_taxes
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
        
        # Prepare employees for calculate_profile_taxes
        employees = []
        for emp in profile_employees:
            employees.append({
                "salary": emp.salary,
                "is_main_job": getattr(emp, 'is_main_job', True)
            })
            
        # Calculate number of months using unified helper
        num_months = get_profile_num_months(profile, db, "all")
        
        # Profile dict for calculate_profile_taxes
        profile_dict = {
            "tax_system": profile.tax_system,
            "type": profile.type,
            "group": profile.group,
            "rate": profile.rate,
            "has_employees": profile.has_employees or len(profile_employees) > 0,
            "esv_paid_by_employer": getattr(profile, 'esv_paid_by_employer', False)
        }
        
        # Calculate taxes
        taxes = self.calculate_profile_taxes(
            profile=profile_dict,
            transactions=transactions,
            employees=employees,
            num_months=num_months
        )
        
        # Get all paid taxes using the helper
        tax_paid_dict = get_paid_taxes_by_type(db, profile_id, start_dt=None, end_dt=None)
        
        # Mapping to required structure
        accrued_edp = taxes["tax_due"]
        paid_edp = tax_paid_dict.get("unified_tax", 0.0)
        debt_edp = max(0.0, accrued_edp - paid_edp)
        
        accrued_esv = taxes["esv_due"] + taxes["employee_esv_due"]
        paid_esv = tax_paid_dict.get("esv", 0.0)
        debt_esv = max(0.0, accrued_esv - paid_esv)
        
        accrued_pdfo = taxes["employee_pit_due"]
        paid_pdfo = tax_paid_dict.get("pit", 0.0)
        debt_pdfo = max(0.0, accrued_pdfo - paid_pdfo)
        
        accrued_mil = taxes["military_tax_due"] + taxes["employee_mil_due"]
        paid_mil = tax_paid_dict.get("military_tax", 0.0)
        debt_mil = max(0.0, accrued_mil - paid_mil)
        
        total_debt = round(debt_edp + debt_esv + debt_pdfo + debt_mil, 2)
        
        # Build by_month breakdown
        ukr_months = {
            1: "Січень", 2: "Лютий", 3: "Березень", 4: "Квітень", 
            5: "Травень", 6: "Червень", 7: "Липень", 8: "Серпень", 
            9: "Вересень", 10: "Жовтень", 11: "Листопад", 12: "Грудень"
        }
        
        payments_months = set()
        for p in payments:
            if p.date:
                payments_months.add((p.date.year, p.date.month))
        if not payments_months:
            import datetime
            curr_y = datetime.date.today().year
            for m in range(1, datetime.date.today().month + 1):
                payments_months.add((curr_y, m))
        months_to_gen = sorted(list(payments_months))
        
        def local_is_simplified(tax_system_str):
            if not tax_system_str:
                return False
            return str(tax_system_str).lower() in ["ednuy-3-5%", "single_tax", "fop_ep", "llc_ep", "ep"]

        def local_is_general(tax_system_str):
            if not tax_system_str:
                return False
            return str(tax_system_str).lower() in ["zagalna", "general_tax", "fop_general", "llc_profit", "general"]

        def local_is_fop(p):
            if not p:
                return False
            p_type = str(getattr(p, "type", "") or "").lower()
            p_name = str(getattr(p, "name", "") or "").lower()
            p_tax = str(getattr(p, "tax_system", "") or "").lower()
            if p_type == "fop":
                return True
            if "тов" in p_name or "llc" in p_name or "товариство" in p_name:
                return False
            if p_type == "company" and "llc" in p_tax:
                return False
            if "фоп" in p_name or "fop" in p_name:
                return True
            return True

        by_month = {}
        for y, m in months_to_gen:
            m_payments = [p for p in payments if p.date and p.date.year == y and p.date.month == m]
            m_outgoing_refunds = sum(p.amount for p in m_payments if p.direction == "out" and p.transaction_type == "refund")
            m_taxable_income = sum(p.amount for p in m_payments if p.direction == "in" and p.taxable and p.transaction_type == "income") - m_outgoing_refunds
            m_taxable_income = max(0.0, m_taxable_income)
            
            # Main tax due
            m_tax_due = 0.0
            if local_is_simplified(profile.tax_system):
                if local_is_fop(profile) and profile.group == 1:
                    m_tax_due = 302.80
                elif local_is_fop(profile) and profile.group == 2:
                    m_tax_due = self.get_rate("min_salary") * 0.20
                else:
                    m_tax_due = m_taxable_income * ((profile.rate or self.get_rate("unified_tax_rate_group_3")) / 100.0)
            elif local_is_general(profile.tax_system):
                m_taxable_expense = sum(p.amount for p in m_payments if p.direction == "out" and p.taxable)
                m_net_profit = max(0.0, m_taxable_income - m_taxable_expense)
                m_tax_due = m_net_profit * (self.get_rate("pit_employee_rate") / 100.0)
                
            # Military tax due
            m_mil_due = 0.0
            if local_is_fop(profile):
                if local_is_simplified(profile.tax_system):
                    if profile.group in (1, 2):
                        m_mil_due = self.get_rate("min_salary") * 0.10
                    else:
                        m_mil_due = m_taxable_income * (self.get_rate("military_tax_fop_rate") / 100.0)
                elif local_is_general(profile.tax_system):
                    m_taxable_expense = sum(p.amount for p in m_payments if p.direction == "out" and p.taxable)
                    m_net_profit = max(0.0, m_taxable_income - m_taxable_expense)
                    m_mil_due = m_net_profit * (self.get_rate("military_tax_fop_rate") / 100.0)
            elif local_is_simplified(profile.tax_system) and not local_is_fop(profile):
                # ТОВ на спрощеній системі - 1% від доходу
                m_mil_due = m_taxable_income * (self.get_rate("military_tax_fop_rate") / 100.0)
                    
            # ESV due
            m_esv_due = 0.0
            if local_is_fop(profile) and not getattr(profile, 'esv_paid_by_employer', False):
                m_esv_due = self.get_rate("esv_fop_monthly")
                
            # Employee taxes
            m_emp_esv = 0.0
            m_emp_pit = 0.0
            m_emp_mil = 0.0
            if profile.has_employees or len(profile_employees) > 0:
                for emp in profile_employees:
                    is_main = getattr(emp, 'is_main_job', True)
                    if is_main is None:
                        is_main = True
                    esv_base = max(emp.salary, self.get_rate("min_salary")) if is_main else emp.salary
                    m_emp_esv += esv_base * (self.get_rate("esv_employee_rate") / 100.0)
                    m_emp_pit += emp.salary * (self.get_rate("pit_employee_rate") / 100.0)
                    m_emp_mil += emp.salary * (self.get_rate("military_tax_employee_rate") / 100.0)
                    
            period_key = f"{y}-{m:02d}"
            by_month[period_key] = {
                "period_name": f"{ukr_months[m]} {y}",
                "edp": round(m_tax_due, 2),
                "esv": round(m_esv_due + m_emp_esv, 2),
                "pdfo": round(m_emp_pit, 2),
                "military": round(m_mil_due + m_emp_mil, 2),
                "total": round(m_tax_due + m_esv_due + m_emp_esv + m_emp_pit + m_mil_due + m_emp_mil, 2)
            }
            
        return {
            "edp": {"accrued": round(accrued_edp, 2), "paid": round(paid_edp, 2), "debt": round(debt_edp, 2)},
            "esv": {"accrued": round(accrued_esv, 2), "paid": round(paid_esv, 2), "debt": round(debt_esv, 2)},
            "pdfo": {"accrued": round(accrued_pdfo, 2), "paid": round(paid_pdfo, 2), "debt": round(debt_pdfo, 2)},
            "military": {"accrued": round(accrued_mil, 2), "paid": round(paid_mil, 2), "debt": round(debt_mil, 2)},
            "total_debt": round(total_debt, 2),
            "by_month": by_month,
            "taxable_income": round(taxes["taxable_income"], 2),
            "total_income": round(taxes["total_income"], 2)
        }

    def get_liabilities(self, profile_id: int, db) -> list:
        """
        Повертає список податкових зобов'язань до сплати:
        - edp (id: 1)
        - esv (id: 2)
        - vz (id: 3)
        - pdfo (id: 4)
        """
        summary = self.get_summary(profile_id, db)
        if not summary:
            return []
            
        liabilities = []
        tax_labels = {
            "edp": "Єдиний податок (ЄП)",
            "esv": "ЄСВ за себе",
            "pdfo": "ПДФО",
            "vz": "Військовий збір"
        }
        
        # EDP (Single Tax)
        if summary["edp"]["debt"] > 0:
            liabilities.append({
                "id": 1,
                "profile_id": profile_id,
                "tax_type": "edp",
                "tax_type_name": tax_labels["edp"],
                "amount": summary["edp"]["debt"],
                "period": "Всього",
                "status": "pending"
            })
            
        # ESV
        if summary["esv"]["debt"] > 0:
            liabilities.append({
                "id": 2,
                "profile_id": profile_id,
                "tax_type": "esv",
                "tax_type_name": tax_labels["esv"],
                "amount": summary["esv"]["debt"],
                "period": "Всього",
                "status": "pending"
            })
            
        # Military
        if summary["military"]["debt"] > 0:
            liabilities.append({
                "id": 3,
                "profile_id": profile_id,
                "tax_type": "vz",
                "tax_type_name": tax_labels["vz"],
                "amount": summary["military"]["debt"],
                "period": "Всього",
                "status": "pending"
            })
            
        # PDFO
        if summary["pdfo"]["debt"] > 0:
            liabilities.append({
                "id": 4,
                "profile_id": profile_id,
                "tax_type": "pdfo",
                "tax_type_name": tax_labels["pdfo"],
                "amount": summary["pdfo"]["debt"],
                "period": "Всього",
                "status": "pending"
            })
            
        return liabilities


# Глобальний екземпляр калькулятора
tax_calculator = TaxCalculator()

