import calendar
from datetime import datetime, date, timedelta

class TaxCalendarGenerator:
    def __init__(self):
        # Мінімальна зарплата в Україні (станом на 2025/2026 рік: 8000 грн)
        self.min_salary = 8000.0
        # Ставка ЄСВ за себе (22% від мін. зарплати = 1760 грн на місяць, або 5280 грн на квартал)
        self.esv_rate = 0.22
        self.esv_fop_monthly = self.min_salary * self.esv_rate # 1760 UAH
        self.esv_fop_quarterly = self.esv_fop_monthly * 3 # 5280 UAH

    def generate_calendar(self, tax_system, group=None, rate=None, has_employees=False, reg_date_str=None, start_date=None, is_vat_payer=False):
        """
        Генерує податковий календар на 12 місяців вперед від start_date.
        
        Параметри:
        - tax_system: "fop_ep" (ФОП єдиний податок), "fop_general" (ФОП загальна система),
                      "llc_profit" (ТОВ податок на прибуток), "llc_ep" (ТОВ єдиний податок)
        - group: 1, 2, 3, 4 (для єдиного податку)
        - rate: ставка у відсотках (наприклад: 5, 3, 18)
        - has_employees: наявність працівників (True/False)
        - reg_date_str: дата реєстрації (формат "YYYY-MM-DD")
        - start_date: дата, з якої починати генерацію (datetime або date, default=сьогодні)
        """
        if start_date is None:
            start_date = date.today()
        elif isinstance(start_date, datetime):
            start_date = start_date.date()
        elif isinstance(start_date, str):
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()

        events = []
        
        # Перебираємо 12 місяців вперед
        for i in range(12):
            current_month_date = self._add_months(start_date, i)
            year = current_month_date.year
            month = current_month_date.month
            
            # 1. Події для ФОП на Єдиному податку
            if tax_system == "fop_ep":
                group = int(group) if group else 3
                
                # Групи 1 та 2: сплата єдиного податку щомісяця до 20 числа
                if group in (1, 2):
                    # Щомісячна сплата ЄП за поточний місяць
                    due_date = date(year, month, 20)
                    events.append({
                        "due_date": due_date.strftime("%Y-%m-%d"),
                        "title": f"Сплата Єдиного податку за {self._ukr_month(month)} {year}",
                        "type": "payment",
                        "tax_name": "unified_tax",
                        "description": f"Сплата фіксованої ставки єдиного податку для ФОП {group} групи за поточний місяць.",
                        "amount_desc": "Фіксована ставка (до 10% прожиткового мінімуму для 1 групи, до 20% мін. зарплати для 2 групи)",
                        "form_code": None,
                        "status": "pending"
                    })
                    
                # Група 3: квартальна сплата та звітність
                if group == 3:
                    # Сплата ЄП: протягом 50 днів після закінчення кварталу
                    # Подача декларації: протягом 40 днів після закінчення кварталу
                    # Квартали закінчуються в місяцях 3, 6, 9, 12. Події генеруються в місяцях 4, 7, 10, 1 (наступного року)
                    if month in (4, 7, 10, 1):
                        q_num = 1 if month == 4 else (2 if month == 7 else (3 if month == 10 else 4))
                        q_year = year if month != 1 else year - 1
                        
                        # Декларація єдинника 3 групи (F0103306) - 40 днів
                        dec_day = 9 if q_num == 4 and calendar.isleap(q_year + 1) else 10 # 9 або 10 лютого для 4 кварталу
                        dec_due = date(year, month, 9) if q_num == 4 else date(year, month, 10)
                        if month == 1:
                            dec_due = date(year, 2, 9) # Декларація за 4 кв подається до 9 лютого наступного року
                        else:
                            dec_due = date(year, month + 1, 10) # 10 травня, 10 серпня, 10 листопада
                            
                        # Сплата ЄП - 50 днів
                        pay_due = date(year, month + 1, 20) # 20 травня, 20 серпня, 20 листопада
                        if month == 1:
                            pay_due = date(year, 2, 19) # 19 лютого наступного року
                            
                        events.append({
                            "due_date": dec_due.strftime("%Y-%m-%d"),
                            "title": f"Подання податкової декларації ФОП 3-ї групи за {q_num} квартал {q_year} р.",
                            "type": "report",
                            "tax_name": "unified_tax",
                            "description": "Подання квартальної декларації платника єдиного податку фізичної особи-підприємця.",
                            "amount_desc": "Форма F0103306",
                            "form_code": "F0103306",
                            "status": "pending"
                        })
                        
                        events.append({
                            "due_date": pay_due.strftime("%Y-%m-%d"),
                            "title": f"Сплата Єдиного податку за {q_num} квартал {q_year} р.",
                            "type": "payment",
                            "tax_name": "unified_tax",
                            "description": f"Сплата єдиного податку за ставкою {rate or 5}% від отриманого доходу за квартал.",
                            "amount_desc": f"{rate or 5}% від доходу за квартал",
                            "form_code": None,
                            "status": "pending"
                        })

                # Квартальна сплата ЄСВ за себе (для всіх груп ФОП ЄП)
                # Подається/сплачується до 20 числа місяця, наступного за кварталом (квітень, липень, жовтень, січень)
                if month in (4, 7, 10, 1):
                    q_num = 1 if month == 4 else (2 if month == 7 else (3 if month == 10 else 4))
                    q_year = year if month != 1 else year - 1
                    
                    due_date = date(year, month, 19) # до 20 числа (тобто 19 включно)
                    events.append({
                        "due_date": due_date.strftime("%Y-%m-%d"),
                        "title": f"Сплата ЄСВ за себе за {q_num} квартал {q_year} р.",
                        "type": "payment",
                        "tax_name": "esv",
                        "description": "Сплата єдиного соціального внеску за себе для ФОП.",
                        "amount_desc": f"{int(self.esv_fop_quarterly)} грн (22% від мінімальної зарплати щомісячно)",
                        "form_code": None,
                        "status": "pending"
                    })

                # Річний звіт для 1 та 2 груп ФОП
                if group in (1, 2) and month == 2: # Лютий наступного року
                    due_date = date(year, 2, 28) # Протягом 60 днів після закінчення року (до 1 березня)
                    events.append({
                        "due_date": due_date.strftime("%Y-%m-%d"),
                        "title": f"Подання річної декларації платника єдиного податку за {year - 1} рік",
                        "type": "report",
                        "tax_name": "unified_tax",
                        "description": "Річна податкова декларація єдиного податку для ФОП 1 та 2 груп.",
                        "amount_desc": "Форма F0103406 (разом з Додатком 1 з ЄСВ)",
                        "form_code": "F0103406",
                        "status": "pending"
                    })

            # 2. Події для ФОП на загальній системі
            elif tax_system == "fop_general":
                # Сплата авансових платежів з ПДФО: щоквартально до 20 квітня, 20 липня, 20 жовтня
                if month in (4, 7, 10):
                    q_num = 1 if month == 4 else (2 if month == 7 else 3)
                    due_date = date(year, month, 19)
                    events.append({
                        "due_date": due_date.strftime("%Y-%m-%d"),
                        "title": f"Сплата авансового внеску ПДФО за {q_num} квартал {year} р.",
                        "type": "payment",
                        "tax_name": "pit",
                        "description": "Сплата авансового платежу з податку на доходи фізичних осіб ФОП на загальній системі.",
                        "amount_desc": "18% від чистого прибутку за квартал",
                        "form_code": None,
                        "status": "pending"
                    })
                
                # Квартальна сплата ЄСВ за себе (до 20 числа наступного за кварталом місяця)
                if month in (4, 7, 10, 1):
                    q_num = 1 if month == 4 else (2 if month == 7 else (3 if month == 10 else 4))
                    q_year = year if month != 1 else year - 1
                    due_date = date(year, month, 19)
                    events.append({
                        "due_date": due_date.strftime("%Y-%m-%d"),
                        "title": f"Сплата ЄСВ за себе за {q_num} квартал {q_year} р.",
                        "type": "payment",
                        "tax_name": "esv",
                        "description": "Сплата єдиного соціального внеску за себе для ФОП на загальній системі.",
                        "amount_desc": "22% від чистого прибутку (не менше 1760 грн/місяць)",
                        "form_code": None,
                        "status": "pending"
                    })

                # Річна декларація про майновий стан та доходи (до 1 травня наступного року)
                if month == 4:
                    due_date = date(year, 4, 30)
                    events.append({
                        "due_date": due_date.strftime("%Y-%m-%d"),
                        "title": f"Подання декларації про майновий стан та доходи за {year - 1} рік",
                        "type": "report",
                        "tax_name": "pit",
                        "description": "Річна податкова декларація про майновий стан і доходи для ФОП на загальній системі.",
                        "amount_desc": "Форма F0100114 (з розрахунком ПДФО, ВЗ та ЄСВ)",
                        "form_code": "F0100114",
                        "status": "pending"
                    })

            # 3. Події для Підприємств (ТОВ на загальній системі)
            elif tax_system == "llc_profit":
                # Квартальна сплата податку на прибуток та декларація (40 днів звіт, 50 днів сплата)
                if month in (4, 7, 10, 1):
                    q_num = 1 if month == 4 else (2 if month == 7 else (3 if month == 10 else 4))
                    q_year = year if month != 1 else year - 1
                    
                    if month == 1:
                        dec_due = date(year, 3, 1) # 60 днів для річного звіту
                        pay_due = date(year, 3, 10) # 10 днів після звіту
                    else:
                        dec_due = date(year, month + 1, 9) # 9 травня, 9 серпня, 9 листопада
                        pay_due = date(year, month + 1, 19) # 19 травня, 19 серпня, 19 листопада
                        
                    events.append({
                        "due_date": dec_due.strftime("%Y-%m-%d"),
                        "title": f"Подання Декларації з податку на прибуток підприємства за {q_num} квартал {q_year} р.",
                        "type": "report",
                        "tax_name": "profit_tax",
                        "description": "Подання квартальної декларації з податку на прибуток для юридичних осіб.",
                        "amount_desc": "Форма J0100125",
                        "form_code": "J0100125",
                        "status": "pending"
                    })
                    
                    events.append({
                        "due_date": pay_due.strftime("%Y-%m-%d"),
                        "title": f"Сплата Податку на прибуток за {q_num} квартал {q_year} р.",
                        "type": "payment",
                        "tax_name": "profit_tax",
                        "description": "Сплата податку на прибуток підприємств за ставкою 18%.",
                        "amount_desc": "18% від фінансового прибутку компанії",
                        "form_code": None,
                        "status": "pending"
                    })

            # 4. Щомісячні події по працівниках (якщо вони є)
            if has_employees:
                # Зарплатні податки сплачуються при виплаті зарплати, але крайній термін без виплати - 30 число наступного місяця
                due_pay = date(year, month, 30) if month != 2 else (date(year, 2, 29) if calendar.isleap(year) else date(year, 2, 28))
                
                # Додаємо щомісячний дедлайн сплати ПДФО, ВЗ та ЄСВ за працівників
                events.append({
                    "due_date": due_pay.strftime("%Y-%m-%d"),
                    "title": f"Сплата податків із зарплати працівників за {self._ukr_month(month)} {year}",
                    "type": "payment",
                    "tax_name": "employee_taxes",
                    "description": "Сплата ПДФО (18%), Військового збору (1.5%) та ЄСВ (22%) нарахованих на заробітну плату працівників.",
                    "amount_desc": "ПДФО 18% + ВЗ 1.5% + ЄСВ 22% від фонду оплати праці",
                    "form_code": None,
                    "status": "pending"
                })
                
                # Квартальний Об'єднаний звіт з ЄСВ та ПДФО (подається протягом 40 днів після закінчення кварталу)
                if month in (4, 7, 10, 1):
                    q_num = 1 if month == 4 else (2 if month == 7 else (3 if month == 10 else 4))
                    q_year = year if month != 1 else year - 1
                    dec_due = date(year, month + 1, 9) if month != 1 else date(year, 2, 9)
                    
                    events.append({
                        "due_date": dec_due.strftime("%Y-%m-%d"),
                        "title": f"Подання Податкового розрахунку (Об'єднаний звіт ЄСВ/ПДФО) за {q_num} квартал {q_year} р.",
                        "type": "report",
                        "tax_name": "employee_report",
                        "description": "Податковий розрахунок сум доходу, нарахованого (сплаченого) на користь платників податків - фізичних осіб, і сум утриманого з них податку, а також сум нарахованого єдиного внеску.",
                        "amount_desc": "Форма J0500109 / F0500109 (Об'єднана звітність)",
                        "form_code": "F0500109",
                        "status": "pending"
                    })

            # 5. Події з ПДВ (якщо платник ПДВ)
            if is_vat_payer:
                dec_due = date(year, month, 20)
                pay_due = date(year, month, 30) if month != 2 else (date(year, 2, 29) if calendar.isleap(year) else date(year, 2, 28))
                
                # Попередній місяць
                prev_m = 12 if month == 1 else month - 1
                prev_y = year - 1 if month == 1 else year
                
                events.append({
                    "due_date": dec_due.strftime("%Y-%m-%d"),
                    "title": f"Подання декларації з ПДВ за {self._ukr_month(prev_m)} {prev_y} р.",
                    "type": "report",
                    "tax_name": "vat_report",
                    "description": "Подання щомісячної декларації з податку на додану вартість.",
                    "amount_desc": "Форма F0110210",
                    "form_code": "F0110210",
                    "status": "pending"
                })
                
                events.append({
                    "due_date": pay_due.strftime("%Y-%m-%d"),
                    "title": f"Сплата ПДВ за {self._ukr_month(prev_m)} {prev_y} р.",
                    "type": "payment",
                    "tax_name": "vat_payment",
                    "description": "Сплата податку на додану вартість за минулий місяць.",
                    "amount_desc": "Розраховується як вихідний ПДВ мінус вхідний ПДВ",
                    "form_code": None,
                    "status": "pending"
                })

        # Сортуємо події по даті
        events.sort(key=lambda x: x["due_date"])
        return events

    def _add_months(self, source_date, months):
        month = source_date.month - 1 + months
        year = source_date.year + month // 12
        month = month % 12 + 1
        day = min(source_date.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    def _ukr_month(self, m):
        months = {
            1: "Січень", 2: "Лютий", 3: "Березень", 4: "Квітень",
            5: "Травень", 6: "Червень", 7: "Липень", 8: "Серпень",
            9: "Вересень", 10: "Жовтень", 11: "Листопад", 12: "Грудень"
        }
        return months.get(m, "")

if __name__ == "__main__":
    # Простий тест генератора календаря
    generator = TaxCalendarGenerator()
    
    print("=== ТЕСТУВАННЯ ГЕНЕРАТОРА КАЛЕНДАРЯ ===")
    print("\nТест: ФОП ЄП 3 група 5%, без працівників:")
    evs = generator.generate_calendar(tax_system="fop_ep", group=3, rate=5, has_employees=False, start_date="2025-03-01")
    print(f"Всього подій згенеровано: {len(evs)}")
    for ev in evs[:5]:
        print(f"  - {ev['due_date']}: [{ev['type'].upper()}] {ev['title']} ({ev['amount_desc']})")
        
    print("\nТест: ТОВ на загальній системі, з працівниками:")
    evs_llc = generator.generate_calendar(tax_system="llc_profit", has_employees=True, start_date="2025-03-01")
    print(f"Всього подій згенеровано: {len(evs_llc)}")
    for ev in evs_llc[:5]:
        print(f"  - {ev['due_date']}: [{ev['type'].upper()}] {ev['title']} ({ev['amount_desc']})")
