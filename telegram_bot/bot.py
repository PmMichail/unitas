import os
import logging
import requests
from datetime import date
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup

load_dotenv()
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    filters
)

# Enable logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# Config
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "MOCK_TOKEN_FOR_TESTS")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

# States for Registration Conversation
CHOOSING_TYPE, CHOOSING_GROUP, CHOOSING_VAT, CHOOSING_EMPLOYEES, ENTERING_NAME = range(5)

# States for VAT Declaration Conversation
ENTERING_VAT_OUT, ENTERING_VAT_IN = range(5, 7)

# States for Add Profile Conversation
P_CHOOSING_TYPE, P_ENTERING_NAME, P_ENTERING_TAX_ID, P_CHOOSING_SYSTEM, P_CHOOSING_DIRECTOR = range(10, 15)

# States for Add Employee Conversation
E_CHOOSING_PROFILE, E_ENTERING_NAME, E_ENTERING_TAX_ID, E_ENTERING_SALARY = range(15, 19)

# States for Edit Employee Salary Conversation
ES_CHOOSING_PROFILE, ES_CHOOSING_EMPLOYEE, ES_ENTERING_SALARY = range(20, 23)

# States for Delete Employee Conversation
DE_CHOOSING_PROFILE, DE_CHOOSING_EMPLOYEE = range(23, 25)

# States for AI Chat
AI_CHAT = range(25, 26)


def get_main_menu_keyboard():
    keyboard = [
        ["📊 Дашборд", "📁 Мої дані"],
        ["📤 Завантажити виписку", "📄 Звіти"],
        ["👥 Працівники", "➕ Додати підприємство"],
        ["📊 Податковий аналіз", "💵 Сплата податків"],
        ["📥 Експорт даних", "🔏 Підписати документи"],
        ["❓ Допомога"]
    ]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True, is_persistent=True)

# Commands
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Початок діалогу, вибір типу платника."""
    telegram_id = str(update.effective_user.id)
    
    # Перевіряємо, чи користувач вже зареєстрований
    try:
        response = requests.get(f"{BACKEND_URL}/api/companies/{telegram_id}", timeout=2)
        if response.status_code == 200 and len(response.json()) > 0:
            company = response.json()[0]
            await update.message.reply_text(
                f"Вітаємо знову! Ви вже зареєстровані як: **{company['name']}**.\n"
                f"Тип податкової системи: {company['tax_system']} (група {company['group'] or 'загальна'}).\n\n"
                f"Оберіть потрібну дію в меню нижче:",
                reply_markup=get_main_menu_keyboard()
            )
            return ConversationHandler.END
    except Exception:
        # Бекенд недоступний або користувача немає
        pass

    keyboard = [
        [
            InlineKeyboardButton("ФОП (Фізична особа-підприємець)", callback_data="fop"),
            InlineKeyboardButton("ТОВ (Підприємство)", callback_data="llc"),
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "👋 Вітаємо в **UniTax** — вашому універсальному податковому AI-асистенті!\n\n"
        "Давайте проведемо швидке налаштування вашого профілю.\n"
        "Оберіть ваш тип платника податків:",
        reply_markup=reply_markup
    )
    return CHOOSING_TYPE

async def choose_type(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору типу платника."""
    query = update.callback_query
    await query.answer()
    
    user_type = query.data
    context.user_data["type"] = user_type
    
    if user_type == "fop":
        keyboard = [
            [
                InlineKeyboardButton("1 група", callback_data="1"),
                InlineKeyboardButton("2 група", callback_data="2"),
            ],
            [
                InlineKeyboardButton("3 група (5%)", callback_data="3_5"),
                InlineKeyboardButton("3 група (3% + ПДВ)", callback_data="3_3"),
            ],
            [
                InlineKeyboardButton("Загальна система", callback_data="general")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            "Оберіть групу Єдиного податку або загальну систему для вашого ФОП:",
            reply_markup=reply_markup
        )
        return CHOOSING_GROUP
    else:
        # Для ТОВ
        keyboard = [
            [
                InlineKeyboardButton("Податок на прибуток (18%)", callback_data="llc_profit"),
                InlineKeyboardButton("Єдиний податок 3 група (5%)", callback_data="llc_ep"),
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            "Оберіть систему оподаткування для ТОВ:",
            reply_markup=reply_markup
        )
        return CHOOSING_GROUP

async def choose_group(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору групи/ставки."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    context.user_data["tax_system"] = context.user_data.get("type")
    
    if context.user_data["type"] == "fop":
        if data == "1":
            context.user_data["tax_system"] = "fop_ep"
            context.user_data["group"] = 1
            context.user_data["rate"] = 10.0 # фіксований відсоток
        elif data == "2":
            context.user_data["tax_system"] = "fop_ep"
            context.user_data["group"] = 2
            context.user_data["rate"] = 20.0
        elif data == "3_5":
            context.user_data["tax_system"] = "fop_ep"
            context.user_data["group"] = 3
            context.user_data["rate"] = 5.0
        elif data == "3_3":
            context.user_data["tax_system"] = "fop_ep"
            context.user_data["group"] = 3
            context.user_data["rate"] = 3.0
        elif data == "general":
            context.user_data["tax_system"] = "fop_general"
            context.user_data["group"] = None
            context.user_data["rate"] = 18.0
    else:
        # Для ТОВ
        if data == "llc_profit":
            context.user_data["tax_system"] = "llc_profit"
            context.user_data["group"] = None
            context.user_data["rate"] = 18.0
        elif data == "llc_ep":
            context.user_data["tax_system"] = "llc_ep"
            context.user_data["group"] = 3
            context.user_data["rate"] = 5.0
            
    keyboard = [
        [
            InlineKeyboardButton("Так", callback_data="yes"),
            InlineKeyboardButton("Ні", callback_data="no")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(
        "Чи є ви платником ПДВ (Податку на додану вартість)?",
        reply_markup=reply_markup
    )
    return CHOOSING_VAT

async def choose_vat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору статусу платника ПДВ."""
    query = update.callback_query
    await query.answer()
    
    context.user_data["is_vat_payer"] = (query.data == "yes")
    
    keyboard = [
        [
            InlineKeyboardButton("Так", callback_data="yes"),
            InlineKeyboardButton("Ні", callback_data="no")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(
        "Чи є у вашій компанії наймані працівники?",
        reply_markup=reply_markup
    )
    return CHOOSING_EMPLOYEES

async def choose_employees(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка наявності працівників."""
    query = update.callback_query
    await query.answer()
    
    context.user_data["has_employees"] = (query.data == "yes")
    
    await query.edit_message_text(
        "Будь ласка, введіть назву компанії або ваше ПІБ для створення кабінету:"
    )
    return ENTERING_NAME

async def enter_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Завершення реєстрації, відправка запиту на бекенд."""
    company_name = update.message.text
    telegram_id = str(update.effective_user.id)
    
    tax_system = context.user_data.get("tax_system")
    group = context.user_data.get("group")
    rate = context.user_data.get("rate")
    has_employees = context.user_data.get("has_employees")
    is_vat_payer = context.user_data.get("is_vat_payer", False)
    
    # Відправка на бекенд
    try:
        payload = {
            "telegram_id": telegram_id,
            "company_name": company_name,
            "tax_system": tax_system,
            "group": group,
            "rate": rate,
            "has_employees": int(has_employees),
            "is_vat_payer": int(is_vat_payer),
            "reg_date": date.today().strftime("%Y-%m-%d")
        }
        res = requests.post(f"{BACKEND_URL}/api/register", data=payload, timeout=5)
        if res.status_code == 200:
            res_data = res.json()
            context.user_data["company_id"] = res_data["company_id"]
            await update.message.reply_text(
                f"🎉 Вітаємо! Реєстрація пройшла успішно.\n\n"
                f"🏢 Компанія: **{company_name}**\n"
                f"⚙️ Система: {tax_system} (група {group or 'загальна'})\n"
                f"👥 Наймані працівники: {'Так' if has_employees else 'Ні'}\n"
                f"🛡️ Платник ПДВ: {'Так' if is_vat_payer else 'Ні'}\n\n"
                f"Ми автоматично згенерували податковий календар на 12 місяців!\n"
                f"Оберіть потрібний пункт меню нижче або напишіть /menu.",
                reply_markup=get_main_menu_keyboard()
            )
        else:
            await update.message.reply_text(
                "⚠️ Виникла помилка під час реєстрації на сервері. Будь ласка, спробуйте пізніше або зверніться в /support."
            )
    except Exception as e:
        logger.error(f"Помилка реєстрації: {e}")
        await update.message.reply_text(
            "⚠️ Помилка реєстрації: Сервер бекенду зараз недоступний. Спробуйте пізніше або зверніться до підтримки /support."
        )
        
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Реєстрацію скасовано.")
    context.user_data['awaiting_ai_question'] = False
    return ConversationHandler.END

async def ai_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Чат з ШІ-асистентом"""
    context.user_data['awaiting_ai_question'] = True
    await update.message.reply_text(
        "🤖 *ШІ-асистент з податків*\n\n"
        "Задайте мені будь-яке питання про податки, звіти або законодавство.\n"
        "Наприклад:\n"
        "- Які терміни сплати ЄП для ФОП 3 групи?\n"
        "- Як змінився військовий збір у 2026?\n"
        "- Чи потрібно подавати звіт якщо доходу не було?\n\n"
        "Надішлішіть /cancel щоб вийти.",
        parse_mode="Markdown"
    )

async def handle_ai_question(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка питання до ШІ"""
    if not context.user_data.get('awaiting_ai_question'):
        return
        
    question = update.message.text
    await update.message.reply_text("🤔 Аналізую питання...")
    
    try:
        # Отримуємо profile_id
        telegram_id = str(update.effective_user.id)
        res_profiles = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res_profiles.status_code != 200 or len(res_profiles.json()) == 0:
            await update.message.reply_text("Спершу зареєструйте профіль через /start")
            context.user_data['awaiting_ai_question'] = False
            return
            
        profile_id = res_profiles.json()[0]["id"]
        
        response = requests.post(
            f"{BACKEND_URL}/api/ai/chat",
            json={"profile_id": profile_id, "question": question},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            await update.message.reply_text(f"🤖 *Відповідь:*\n\n{data.get('answer', 'Відповідь не отримана')}", parse_mode="Markdown")
        else:
            await update.message.reply_text("⚠️ Не вдалося отримати відповідь від ШІ-асистента")
    except Exception as e:
        logger.error(f"Помилка ШІ-чату: {e}")
        await update.message.reply_text("⚠️ Сервер бекенду зараз недоступний")
    
    context.user_data['awaiting_ai_question'] = False

# Інші команди бота
async def mydata(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показ інформації про поточну компанію."""
    telegram_id = str(update.effective_user.id)
    try:
        response = requests.get(f"{BACKEND_URL}/api/companies/{telegram_id}", timeout=3)
        if response.status_code == 200 and len(response.json()) > 0:
            company = response.json()[0]
            emp_status = "Так" if company["has_employees"] else "Ні"
            vat_status = "Так" if company.get("is_vat_payer", False) else "Ні"
            await update.message.reply_text(
                f"📋 **Ваші реєстраційні дані:**\n\n"
                f"🏢 Назва: {company['name']}\n"
                f"⚖️ Система оподаткування: {company['tax_system']}\n"
                f"📦 Група: {company['group'] or 'Не вказано'}\n"
                f"📈 Ставка: {company['rate']}%\n"
                f"📅 Дата реєстрації: {company['reg_date']}\n"
                f"👥 Наймані працівники: {emp_status}\n"
                f"🛡️ Платник ПДВ: {vat_status}"
            )
        else:
            await update.message.reply_text("Поки немає зареєстрованої компанії. Напишіть /start для реєстрації.")
    except Exception:
        await update.message.reply_text("Помилка зв'язку з бекендом. Перевірте, чи запущено backend/api/main.py")

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отримання фінансового статусу для всіх профілів користувача."""
    telegram_id = str(update.effective_user.id)
    try:
        from datetime import datetime
        res_profiles = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res_profiles.status_code != 200 or len(res_profiles.json()) == 0:
            await update.message.reply_text(
                "У вас поки немає зареєстрованих профілів.\n"
                "Будь ласка, почніть з реєстрації через /start або додайте новий профіль через /add_profile."
            )
            return
            
        profiles = res_profiles.json()
        await update.message.reply_text(f"📊 **Аналіз фінансового та податкового стану по {len(profiles)} профілях...**")
        
        for p in profiles:
            profile_id = p["id"]
            res_dash = requests.get(f"{BACKEND_URL}/api/dashboard/{profile_id}", timeout=5)
            if res_dash.status_code != 200:
                await update.message.reply_text(f"⚠️ Не вдалося завантажити дашборд для профілю: **{p['name']}**")
                continue
                
            data = res_dash.json()
            p_start = data.get("period_start")
            p_end = data.get("period_end")
            if p_start and p_end:
                try:
                    p_start_formatted = datetime.strptime(p_start, "%Y-%m-%d").strftime("%d.%m.%Y")
                    p_end_formatted = datetime.strptime(p_end, "%Y-%m-%d").strftime("%d.%m.%Y")
                    period_text = f"з {p_start_formatted} по {p_end_formatted}"
                except Exception:
                    period_text = f"з {p_start} по {p_end}"
            else:
                period_text = "немає завантажених виписок"
                
            balance_mark = "🟢 Сплачено повністю" if data["balance_status"] == "paid" else "🔴 Є заборгованість"
            profile_type_str = "ФОП" if p["type"] == "fop" else "ТОВ"
            tax_id_str = p.get("tax_id") or "Не вказано"
            
            group_text = f", {p['group']} група" if p.get('group') else ""
            
            ep_due = data.get("tax_due", 0.0)
            ep_paid = data.get("ep_paid", 0.0)
            ep_diff = data.get("ep_diff", 0.0)
            
            mil_due = data.get("military_tax_due", 0.0)
            mil_paid = data.get("mil_paid", 0.0)
            mil_diff = data.get("mil_diff", 0.0)
            
            esv_due = data.get("esv_due", 0.0)
            esv_paid = data.get("esv_paid", 0.0)
            esv_diff = data.get("esv_diff", 0.0)
            
            tax_system_name = "Єдиний податок" if p['tax_system'] in ["fop_ep", "llc_ep", "ednuy-3-5%"] else "Загальна система"
            
            msg = (
                f"🏢 **{profile_type_str}:** {p['name']}\n"
                f"🔢 **Tax ID (ЄДРПОУ/РНОКПП):** `{tax_id_str}`\n"
                f"⚖️ **Система:** {tax_system_name}{group_text} ({p['rate']}%)\n"
                f"📅 **Період виписки:** {period_text}\n\n"
                f"📊 **Податковий статус:**\n"
            )
            
            # 1. ЄП або Податок на прибуток
            ep_status = "сплачено повністю"
            if ep_diff > 0:
                ep_status = f"недоплата {ep_diff:,.2f} грн"
            elif ep_diff < 0:
                ep_status = f"переплата {abs(ep_diff):,.2f} грн"
                
            tax_label = "Єдиний податок (ЄП)" if p['tax_system'] in ["fop_ep", "llc_ep", "ednuy-3-5%"] else "Податок на прибуток"
            msg += f"• Податкове зобов'язання ({tax_label}): {ep_due:,.2f} грн — сплачено {ep_paid:,.2f} грн ({ep_status})\n"
            
            # 2. Військовий збір (якщо є)
            if mil_due > 0 or mil_paid > 0:
                mil_status = "сплачено повністю"
                if mil_diff > 0:
                    mil_status = f"недоплата {mil_diff:,.2f} грн"
                elif mil_diff < 0:
                    mil_status = f"переплата {abs(mil_diff):,.2f} грн"
                msg += f"• Військовий збір (1%): {mil_due:,.2f} грн — сплачено {mil_paid:,.2f} грн ({mil_status})\n"
                
            # 3. ЄСВ за себе (якщо ФОП)
            if p["type"] == "fop":
                esv_status = "сплачено повністю"
                if esv_diff > 0:
                    esv_status = f"недоплата {esv_diff:,.2f} грн"
                elif esv_diff < 0:
                    esv_status = f"переплата {abs(esv_diff):,.2f} грн"
                msg += f"• ЄСВ за себе: {esv_due:,.2f} грн — сплачено {esv_paid:,.2f} грн ({esv_status})\n"
                
            msg += (
                f"\n💰 Оподатковуваний дохід: **{data['taxable_income']:,.2f} UAH**\n"
                f"💸 Всього сплачено податків: **{data['tax_paid']:,.2f} UAH**\n"
                f"📉 Загальна різниця: **{data['difference']:,.2f} UAH** ({balance_mark})\n"
            )
            
            # Якщо є працівники
            employees = data.get("employees", [])
            if employees:
                msg += "\n👥 **Статус працівників (останній місяць):**\n"
                for emp in employees:
                    sal_status = "✅ Сплачено" if emp["salary_paid"] else "❌ Не сплачено"
                    esv_status_emp = "✅ Сплачено" if emp["esv_paid"] else "❌ Не сплачено"
                    pit_status_emp = "✅ Сплачено" if emp["pit_paid"] else "❌ Не сплачено"
                    vz_status_emp = "✅ Сплачено" if emp.get("military_tax_paid", emp["pit_paid"]) else "❌ Не сплачено"
                    msg += (
                        f"- 👤 **{emp['name']}** (Оклад: {emp['salary']:,.2f} UAH)\n"
                        f"  • Чиста зарплата (до виплати): {emp['salary'] * 0.77:,.2f} UAH ({sal_status})\n"
                        f"  • ЄСВ (22%): {emp['esv_amount']:,.2f} UAH ({esv_status_emp})\n"
                        f"  • ПДФО (18%): {emp['pit_amount']:,.2f} UAH ({pit_status_emp})\n"
                        f"  • Військовий збір (5%): {emp['military_tax_amount']:,.2f} UAH ({vz_status_emp})\n"
                    )
            
            # Контрагенти
            contractor_total = data.get("contractor_payments_total", 0.0)
            if contractor_total > 0:
                msg += f"\n💼 **Цивільно-правові договори (ФОП-контрагенти):**\n"
                msg += f"  • Виплачено за послуги: **{contractor_total:,.2f} грн** (без нарахування зарплатних податків)\n"

            # Додамо найближчі події календаря
            upcoming = data.get("upcoming_events", [])
            if upcoming:
                msg += "\n📅 **Найближчі події:**\n"
                for ev in upcoming[:2]:
                    type_icon = "📝 Звіт" if ev["type"] == "report" else "💵 Сплата"
                    status_icon = "✅" if ev["status"] == "paid" else "⏳"
                    msg += f"- {status_icon} {ev['due_date']} — {type_icon}: {ev['title']} ({ev['amount_desc']})\n"
                    
            await update.message.reply_text(msg)
            
        # Консолідований звіт при кількох профілях
        if len(profiles) > 1:
            res_con = requests.get(f"{BACKEND_URL}/api/consolidated-dashboard/{telegram_id}", timeout=5)
            if res_con.status_code == 200:
                con = res_con.json()
                con_msg = (
                    f"🌐 **КОНСОЛІДОВАНИЙ ЗВІТ (всі підприємства):**\n\n"
                    f"💰 Сумарний дохід: **{con['total_income']:,.2f} UAH**\n"
                    f"⚖️ Сумарні зобов'язання: **{con['total_tax_due']:,.2f} UAH**\n"
                    f"💸 Сумарно сплачено: **{con['total_tax_paid']:,.2f} UAH**\n"
                    f"📉 Сумарний борг: **{con['total_difference']:,.2f} UAH**\n"
                )
                
                cross_flows = con.get("cross_flows", [])
                if cross_flows:
                    con_msg += f"\n🔄 **Внутрішні фінансові потоки:**\n"
                    for cf in cross_flows:
                        con_msg += f"  • {cf['from_profile_name']} ➡️ {cf['to_profile_name']}: **{cf['amount']:,.2f} грн**\n"
                    con_msg += f"\n💡 **Оптимізація податків (заощаджено на ПДФО/ЄСВ):** 🎉 **{con['total_tax_savings']:,.2f} UAH**\n"
                    
                await update.message.reply_text(con_msg)
            
    except Exception as e:
        logger.error(f"Помилка отримання статусу: {e}")
        await update.message.reply_text(
            "⚠️ Не вдалося отримати фінансовий статус: Сервер бекенду зараз недоступний."
        )


async def tax_analysis_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Детальний аналіз податків за періодами."""
    telegram_id = str(update.effective_user.id)
    try:
        res_profiles = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res_profiles.status_code != 200 or len(res_profiles.json()) == 0:
            await update.message.reply_text("У вас поки немає зареєстрованих профілів.")
            return
            
        profiles = res_profiles.json()
        await update.message.reply_text("📊 **Складання детального квартального податкового аналізу...**")
        
        for p in profiles:
            profile_id = p["id"]
            res_analysis = requests.get(f"{BACKEND_URL}/api/tax-analysis/{profile_id}", timeout=5)
            if res_analysis.status_code != 200:
                await update.message.reply_text(f"⚠️ Не вдалося отримати аналіз для профілю: **{p['name']}**")
                continue
                
            quarters = res_analysis.json()
            if not quarters:
                await update.message.reply_text(f"📂 У профілі **{p['name']}** немає транзакцій для аналізу.")
                continue
                
            msg = f"📋 **Податковий аналіз по періодах для {p['name']}:**\n\n"
            
            for q in quarters:
                msg += f"📅 **{q['year']} р. — {q['quarter']} квартал:**\n"
                msg += f"  • Оподатковуваний дохід: **{q['taxable_income']:,.2f} UAH**\n"
                
                # EP
                ep_due = q["unified_tax_due"]
                ep_paid = q["unified_tax_paid"]
                ep_diff = ep_due - ep_paid
                ep_status = "сплачено повністю"
                if ep_diff > 0:
                    ep_status = f"недоплата {ep_diff:,.2f} грн"
                elif ep_diff < 0:
                    ep_status = f"переплата {abs(ep_diff):,.2f} грн"
                    
                tax_label = "Єдиний податок" if p['tax_system'] in ["fop_ep", "llc_ep", "ednuy-3-5%"] else "Податок на прибуток"
                msg += f"  • {tax_label}: зобов'язання **{ep_due:,.2f} грн** — сплачено **{ep_paid:,.2f} грн** ({ep_status})\n"
                
                # Military
                if q["military_tax_due"] > 0 or q["military_tax_paid"] > 0:
                    mil_due = q["military_tax_due"]
                    mil_paid = q["military_tax_paid"]
                    mil_diff = mil_due - mil_paid
                    mil_status = "сплачено повністю"
                    if mil_diff > 0:
                        mil_status = f"недоплата {mil_diff:,.2f} грн"
                    elif mil_diff < 0:
                        mil_status = f"переплата {abs(mil_diff):,.2f} грн"
                    msg += f"  • Військовий збір (1%): зобов'язання **{mil_due:,.2f} грн** — сплачено **{mil_paid:,.2f} грн** ({mil_status})\n"
                    
                # ESV
                if q["esv_due"] > 0 or q["esv_paid"] > 0:
                    esv_due = q["esv_due"]
                    esv_paid = q["esv_paid"]
                    esv_diff = esv_due - esv_paid
                    esv_status = "сплачено повністю"
                    if esv_diff > 0:
                        esv_status = f"недоплата {esv_diff:,.2f} грн"
                    elif esv_diff < 0:
                        esv_status = f"переплата {abs(esv_diff):,.2f} грн"
                    msg += f"  • ЄСВ за себе: зобов'язання **{esv_due:,.2f} грн** — сплачено **{esv_paid:,.2f} грн** ({esv_status})\n"
                    
                q_diff = q["total_due"] - q["total_paid"]
                q_balance = "🟢 Без боргів" if q_diff <= 0 else f"🔴 Заборгованість {q_diff:,.2f} грн"
                msg += f"  👉 **Всього за квартал:** зобов'язання {q['total_due']:,.2f} грн — сплачено {q['total_paid']:,.2f} грн ({q_balance})\n\n"
                
            await update.message.reply_text(msg)
    except Exception as e:
        logger.error(f"Помилка податкового аналізу: {e}")
        await update.message.reply_text("⚠️ Сервер бекенду зараз недоступний.")


async def upload_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Інструкція до завантаження виписки."""
    await update.message.reply_text(
        "📎 **Завантаження банківської виписки**\n\n"
        "Будь ласка, надішліть файл виписки (PDF, CSV, HTML) прямо у цей чат.\n\n"
        "Підтримувані банки:\n"
        "- monobank (CSV)\n"
        "- Приват24 (PDF)\n"
        "- А-Банк (PDF)\n"
        "- ПУМБ (PDF, CSV)\n"
        "- Райффайзен Банк Аваль (PDF, Excel)\n"
        "- Sense Bank (PDF, Excel)\n"
        "- Ощадбанк (HTML)"
    )

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка надісланого файлу виписки."""
    telegram_id = str(update.effective_user.id)
    doc = update.message.document
    
    await update.message.reply_text("⏳ Розпізнаємо та парсимо виписку...")

    try:
        # Отримуємо ID компанії
        res_comp = requests.get(f"{BACKEND_URL}/api/companies/{telegram_id}", timeout=2)
        if res_comp.status_code == 200 and len(res_comp.json()) > 0:
            company_id = res_comp.json()[0]["id"]
            
            # Завантажуємо файл від Телеграму
            file = await context.bot.get_file(doc.file_id)
            os.makedirs("./temp_bot", exist_ok=True)
            local_path = f"./temp_bot/{doc.file_name}"
            await file.download_to_drive(local_path)
            
            # Відправляємо на бекенд
            with open(local_path, "rb") as f:
                files = {"file": (doc.file_name, f)}
                data = {"company_id": company_id}
                res_upload = requests.post(f"{BACKEND_URL}/api/upload-statement", files=files, data=data, timeout=10)
                
            if os.path.exists(local_path):
                os.remove(local_path)
                
            if res_upload.status_code == 200:
                result = res_upload.json()
                await update.message.reply_text(
                    f"✅ **Успішно завантажено!**\n\n"
                    f"Вміст виписки розпізнано та додано до бази даних:\n"
                    f"📎 {result['message']}\n\n"
                    f"Використовуйте /status для оновленого балансу."
                )
            else:
                await update.message.reply_text(
                    f"❌ **Помилка парсингу:** {res_upload.json().get('detail', 'Невідома помилка бекенду')}"
                )
            return
        await update.message.reply_text("Спершу зареєструйте компанію за допомогою /start")
    except Exception as e:
        logger.error(f"Помилка завантаження виписки: {e}")
        await update.message.reply_text(
            "⚠️ Не вдалося обробити виписку: Сервер бекенду зараз недоступний."
        )

async def generate_report_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Генерація звітів."""
    telegram_id = str(update.effective_user.id)
    try:
        res_comp = requests.get(f"{BACKEND_URL}/api/companies/{telegram_id}", timeout=2)
        if res_comp.status_code == 200 and len(res_comp.json()) > 0:
            company = res_comp.json()[0]
            
            # Якщо платник ПДВ, запитуємо який звіт згенерувати
            if company.get("is_vat_payer", False):
                keyboard = [
                    [
                        InlineKeyboardButton("Декларація Єдиного податку / Прибутку", callback_data=f"rep_tax_{company['id']}"),
                        InlineKeyboardButton("Декларація з ПДВ (F0110210)", callback_data=f"rep_vat_{company['id']}"),
                    ]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "📊 **Виберіть звіт для генерації:**\n\n"
                    "Оскільки ви зареєстровані як платник ПДВ, ви можете обрати податкову декларацію або декларацію з ПДВ.",
                    reply_markup=reply_markup
                )
                return
            
            # Для неплатників ПДВ - одразу генеруємо податковий звіт
            await update.message.reply_text("⏳ AI генерує чернетку податкової декларації...")
            form_code = "F0103306"
            
            res_rep = requests.post(
                f"{BACKEND_URL}/api/generate-report/{company['id']}/{form_code}", 
                params={"period": "Q1", "year": 2025},
                timeout=5
            )
            if res_rep.status_code == 200:
                report = res_rep.json()
                fields = report["fields"]
                msg = (
                    f"📝 **Чернетка податкової декларації ({form_code}):**\n\n"
                    f"🟢 ПІБ платника: {fields['HNAME']['value']}\n"
                    f"🟢 ІПН: {fields['HTIN']['value']}\n"
                    f"🟢 Дохід за 1 квартал: **{fields['ROW01']['value']:,.2f} UAH**\n"
                    f"🟢 Ставка податку: {fields['TAX_RATE']['value']}%\n"
                    f"🟢 Сума податку: **{fields['TAX_DUE']['value']:,.2f} UAH**\n\n"
                    f"Виберіть формат для завантаження:"
                )
                
                keyboard = [
                    [
                        InlineKeyboardButton("Завантажити XML (для ДПС)", callback_data=f"dl_xml_{report['report_id']}"),
                        InlineKeyboardButton("Завантажити JSON", callback_data=f"dl_json_{report['report_id']}"),
                    ],
                    [
                        InlineKeyboardButton("🚀 Подати до ДПС", callback_data=f"txsub_start_{report['report_id']}")
                    ]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(msg, reply_markup=reply_markup)
                return
                
        await update.message.reply_text("Будь ласка, спершу зареєструйте компанію в /start")
    except Exception as e:
        logger.error(f"Помилка генерації звіту: {e}")
        await update.message.reply_text(
            "⚠️ Не вдалося згенерувати звіт: Сервер бекенду зараз недоступний."
        )

async def handle_callback_download(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка кліку на завантаження звіту."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    if data.startswith("dl_"):
        parts = data.split("_")
        file_format = parts[1]
        report_id = parts[2]
        
        try:
            # Завантажуємо файл з бекенду
            url = f"{BACKEND_URL}/api/reports/{report_id}/download/{file_format}"
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                # Зберігаємо файл локально
                os.makedirs("./temp_bot", exist_ok=True)
                ext = "xml" if file_format == "xml" else "json"
                file_path = f"./temp_bot/report_{report_id}.{ext}"
                with open(file_path, "wb") as f:
                    f.write(res.content)
                
                # Відправляємо користувачу
                with open(file_path, "rb") as f:
                    await query.message.reply_document(
                        document=f,
                        filename=f"F0103306_Q1_2025.{ext}",
                        caption=f"Ваш звіт у форматі {file_format.upper()} готовий для подачі!"
                    )
                os.remove(file_path)
                return
        except Exception as e:
            logger.error(f"Помилка завантаження файлу: {e}")
            
        await query.message.reply_text("Не вдалося завантажити файл з сервера. Можливо, сервер офлайн.")

async def alerts(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Керування сповіщеннями."""
    # Заглушка для сповіщень
    status_alert = context.user_data.get("alerts_enabled", True)
    context.user_data["alerts_enabled"] = not status_alert
    new_status = "Увімкнено" if not status_alert else "Вимкнено"
    await update.message.reply_text(f"🔔 Нагадування про дедлайни податків: **{new_status}**.")

async def debug(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показ інформації про останню розпізнану виписку для дебагу."""
    telegram_id = str(update.effective_user.id)
    try:
        # Отримуємо компанію
        res_comp = requests.get(f"{BACKEND_URL}/api/companies/{telegram_id}", timeout=2)
        if res_comp.status_code != 200 or len(res_comp.json()) == 0:
            await update.message.reply_text("Спершу зареєструйте компанію за допомогою /start")
            return
            
        company = res_comp.json()[0]
        company_id = company["id"]
        
        # Отримуємо дебаг виписки
        res_debug = requests.get(f"{BACKEND_URL}/api/statements/debug/{company_id}", timeout=5)
        if res_debug.status_code == 404:
            await update.message.reply_text("Поки немає завантажених виписок для перевірки. Надішліть файл виписки спочатку.")
            return
        elif res_debug.status_code != 200:
            await update.message.reply_text("⚠️ Не вдалося отримати дані дебагу з сервера бекенду.")
            return
            
        data = res_debug.json()
        
        period_str = f"з {data['period_start']} по {data['period_end']}" if data.get('period_start') else "Не визначено"
        
        msg = (
            f"🔍 **Дебаг останньої завантаженої виписки:**\n\n"
            f"📁 Файл: `{data['file_name']}`\n"
            f"🏦 Банк: **{data['bank_name']}**\n"
            f"📅 Дата завантаження: {data['uploaded_at']}\n"
            f"⏳ Період виписки: **{period_str}**\n"
            f"📊 Всього транзакцій: {data['total_txs']}\n"
            f"🟢 Загальний дохід: **{data['total_income']:,.2f} UAH**\n"
            f"🔴 Загальні витрати: **{data['total_expense']:,.2f} UAH**\n\n"
            f"📋 **Останні платежі (до 10 шт):**\n"
        )
        
        for idx, p in enumerate(data.get("payments", [])):
            dir_icon = "🟢" if p["direction"] == "in" else "🔴"
            type_str = "Дохід" if p["type"] == "income" else ("Податок" if p["type"] == "tax_payment" else "Витрата")
            msg += (
                f"{idx+1}. {dir_icon} {p['date']} — **{p['amount']:,.2f} UAH** ({type_str})\n"
                f"   👤 Контрагент: {p['contragent']}\n"
                f"   📝 Призначення: _{p['purpose'][:60]}..._\n\n"
            )
            
        await update.message.reply_text(msg, parse_mode="Markdown")
        
    except Exception as e:
        logger.error(f"Помилка в дебаг-команді: {e}")
        await update.message.reply_text("⚠️ Виникла помилка зв'язку з бекендом під час виконання дебагу.")

async def support(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Контакти техпідтримки."""
    await update.message.reply_text(
        "👨‍💻 **Служба підтримки UniTax**\n\n"
        "Якщо у вас виникли технічні проблеми або питання щодо розрахунку податків:\n"
        "- Telegram: @unitax_support_bot\n"
        "- Email: support@unitax.ai\n"
        "- Гаряча лінія: 0 800 500 600 (безкоштовно по Україні)"
    )

async def menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показ головного меню з кнопками."""
    await update.message.reply_text(
        "📋 Головне меню UniTax:",
        reply_markup=get_main_menu_keyboard()
    )

async def employees_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Меню для керування працівниками."""
    await update.message.reply_text(
        "👥 **Керування працівниками підприємства**\n\n"
        "Для роботи з найманими працівниками використовуйте наступні команди:\n"
        "➕ /add_employee — додати нового працівника (для ТОВ)\n"
        "✏️ /edit_salary — змінити оклад працівника\n"
        "❌ /delete_employee — видалити працівника\n"
        "🔍 /check_employees — перевірити сплату зарплати та податків за останній місяць\n"
    )



async def add_profile_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Початок додавання нового профілю."""
    keyboard = [
        [
            InlineKeyboardButton("ФОП (Фізична особа-підприємець)", callback_data="add_p_fop"),
            InlineKeyboardButton("ТОВ (Підприємство)", callback_data="add_p_llc"),
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "📝 **Додавання нового профілю**\n\n"
        "Оберіть тип підприємства:",
        reply_markup=reply_markup
    )
    return P_CHOOSING_TYPE

async def add_profile_type(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору типу профілю."""
    query = update.callback_query
    await query.answer()
    
    p_type = "fop" if query.data == "add_p_fop" else "company"
    context.user_data["new_profile"] = {"type": p_type}
    
    await query.edit_message_text(
        "Введіть назву підприємства (наприклад, ТОВ 'Вектор' або ФОП Шевченко):"
    )
    return P_ENTERING_NAME

async def add_profile_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка введення назви."""
    name = update.message.text.strip()
    context.user_data["new_profile"]["name"] = name
    
    await update.message.reply_text(
        "Введіть податковий номер (ЄДРПОУ для ТОВ або РНОКПП для ФОП):\n"
        "*(Це допоможе автоматично визначати профіль при завантаженні виписок)*"
    )
    return P_ENTERING_TAX_ID

async def add_profile_tax_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка введення податкового номера."""
    tax_id = update.message.text.strip()
    context.user_data["new_profile"]["tax_id"] = tax_id
    
    p_type = context.user_data["new_profile"]["type"]
    if p_type == "fop":
        keyboard = [
            [
                InlineKeyboardButton("1 група", callback_data="sys_fop_1"),
                InlineKeyboardButton("2 група", callback_data="sys_fop_2"),
            ],
            [
                InlineKeyboardButton("3 група (5%)", callback_data="sys_fop_3_5"),
                InlineKeyboardButton("3 група (3% + ПДВ)", callback_data="sys_fop_3_3"),
            ],
            [
                InlineKeyboardButton("Загальна система", callback_data="sys_fop_general")
            ]
        ]
    else:
        keyboard = [
            [
                InlineKeyboardButton("Податок на прибуток (18%)", callback_data="sys_llc_profit"),
                InlineKeyboardButton("Єдиний податок 3 група (5%)", callback_data="sys_llc_ep"),
            ]
        ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "Оберіть систему оподаткування:",
        reply_markup=reply_markup
    )
    return P_CHOOSING_SYSTEM

async def add_profile_system(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору системи оподаткування."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    profile_data = context.user_data["new_profile"]
    
    # Defaults
    profile_data["group"] = None
    profile_data["rate"] = 0.0
    profile_data["is_vat_payer"] = False
    
    if data == "sys_fop_1":
        profile_data["tax_system"] = "ednuy-3-5%"
        profile_data["group"] = 1
        profile_data["rate"] = 10.0
    elif data == "sys_fop_2":
        profile_data["tax_system"] = "ednuy-3-5%"
        profile_data["group"] = 2
        profile_data["rate"] = 20.0
    elif data == "sys_fop_3_5":
        profile_data["tax_system"] = "ednuy-3-5%"
        profile_data["group"] = 3
        profile_data["rate"] = 5.0
    elif data == "sys_fop_3_3":
        profile_data["tax_system"] = "ednuy-3-5%"
        profile_data["group"] = 3
        profile_data["rate"] = 3.0
        profile_data["is_vat_payer"] = True
    elif data == "sys_fop_general":
        profile_data["tax_system"] = "zagalna"
        profile_data["rate"] = 18.0
    elif data == "sys_llc_profit":
        profile_data["tax_system"] = "zagalna"
        profile_data["rate"] = 18.0
    elif data == "sys_llc_ep":
        profile_data["tax_system"] = "ednuy-3-5%"
        profile_data["group"] = 3
        profile_data["rate"] = 5.0
        
    if profile_data["type"] == "company":
        keyboard = [
            [
                InlineKeyboardButton("Так", callback_data="dir_yes"),
                InlineKeyboardButton("Ні", callback_data="dir_no")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            "Чи є ви директором цього підприємства?",
            reply_markup=reply_markup
        )
        return P_CHOOSING_DIRECTOR
    else:
        profile_data["is_director"] = False
        return await save_profile(query.message, context)

async def add_profile_director(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору ролі директора та збереження."""
    query = update.callback_query
    await query.answer()
    
    context.user_data["new_profile"]["is_director"] = (query.data == "dir_yes")
    return await save_profile(query.message, context)

async def save_profile(message, context) -> int:
    """Збереження профілю на бекенді."""
    profile_data = context.user_data.get("new_profile")
    telegram_id = str(message.chat_id)
    
    try:
        payload = {
            "telegram_id": telegram_id,
            "type": profile_data["type"],
            "name": profile_data["name"],
            "tax_id": profile_data["tax_id"],
            "tax_system": profile_data["tax_system"],
            "is_director": int(profile_data["is_director"]),
            "group": profile_data["group"] if profile_data["group"] is not None else "",
            "rate": profile_data["rate"] if profile_data["rate"] is not None else "",
            "has_employees": 0,
            "is_vat_payer": int(profile_data["is_vat_payer"]),
            "reg_date": date.today().strftime("%Y-%m-%d")
        }
        
        res = requests.post(f"{BACKEND_URL}/api/profiles", data=payload, timeout=5)
        if res.status_code == 200:
            await message.reply_text(
                f"🎉 **Профіль успішно створено!**\n\n"
                f"🏢 Назва: {profile_data['name']}\n"
                f"🔢 Tax ID: {profile_data['tax_id']}\n"
                f"⚖️ Система: {profile_data['tax_system']} (група {profile_data['group'] or 'загальна'})\n"
                f"👤 Директор: {'Так' if profile_data['is_director'] else 'Ні'}"
            )
        else:
            await message.reply_text("⚠️ Не вдалося зберегти профіль на сервері.")
    except Exception as e:
        logger.error(f"Помилка створення профілю: {e}")
        await message.reply_text("⚠️ Помилка зв'язку з бекендом.")
        
    return ConversationHandler.END

async def cancel_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Створення профілю скасовано.")
    return ConversationHandler.END

# Employee Conversation
async def add_employee_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Початок додавання працівника. Вибір профілю."""
    telegram_id = str(update.effective_user.id)
    
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res.status_code == 200:
            profiles = res.json()
            llc_profiles = [p for p in profiles if p["type"] == "company"]
            
            if not llc_profiles:
                await update.message.reply_text(
                    "⚠️ У вас немає зареєстрованих профілів типу ТОВ.\n"
                    "Працівників можна додавати тільки для підприємств (ТОВ).\n"
                    "Створіть профіль ТОВ за допомогою /add_profile."
                )
                return ConversationHandler.END
                
            keyboard = [
                [InlineKeyboardButton(p["name"], callback_data=f"emp_prof_{p['id']}")]
                for p in llc_profiles
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(
                "👥 **Додавання працівника**\n\n"
                "Оберіть підприємство (ТОВ) для працівника:",
                reply_markup=reply_markup
            )
            return E_CHOOSING_PROFILE
        else:
            await update.message.reply_text("⚠️ Не вдалося завантажити профілі з сервера.")
            return ConversationHandler.END
    except Exception as e:
        logger.error(f"Помилка завантаження профілів: {e}")
        await update.message.reply_text("⚠️ Сервер бекенду зараз недоступний.")
        return ConversationHandler.END

async def add_employee_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору профілю."""
    query = update.callback_query
    await query.answer()
    
    profile_id = int(query.data.split("_")[2])
    context.user_data["new_employee"] = {"profile_id": profile_id}
    
    await query.edit_message_text(
        "Введіть ПІБ працівника (наприклад, Шевченко Тарас Григорович):"
    )
    return E_ENTERING_NAME

async def add_employee_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка введення імені працівника."""
    name = update.message.text.strip()
    context.user_data["new_employee"]["name"] = name
    
    await update.message.reply_text(
        "Введіть РНОКПП (ІПН) працівника:\n"
        "*(Це необхідно для автоматичного розпізнавання виплат у банківських виписках)*"
    )
    return E_ENTERING_TAX_ID

async def add_employee_tax_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка введення податкового номера працівника."""
    tax_id = update.message.text.strip()
    context.user_data["new_employee"]["tax_id"] = tax_id
    
    await update.message.reply_text(
        "Введіть оклад/ставку працівника в UAH (числом, наприклад, 20000):"
    )
    return E_ENTERING_SALARY

async def add_employee_salary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка введення окладу та збереження."""
    try:
        salary = float(update.message.text.replace(" ", "").replace(",", "."))
    except ValueError:
        await update.message.reply_text("⚠️ Некоректне число. Спробуйте ще раз:")
        return E_ENTERING_SALARY
        
    emp_data = context.user_data.get("new_employee")
    emp_data["salary"] = salary
    
    try:
        payload = {
            "profile_id": emp_data["profile_id"],
            "name": emp_data["name"],
            "tax_id": emp_data["tax_id"],
            "salary": salary
        }
        res = requests.post(f"{BACKEND_URL}/api/employees", data=payload, timeout=5)
        if res.status_code == 200:
            await update.message.reply_text(
                f"👥 **Працівника успішно додано!**\n\n"
                f"👤 ПІБ: {emp_data['name']}\n"
                f"🔢 РНОКПП: {emp_data['tax_id']}\n"
                f"💰 Оклад: {salary:,.2f} UAH\n"
                f"📈 ЄСВ (22%): {salary * 0.22:,.2f} UAH\n"
                f"📉 ПДФО + ВЗ (19.5%): {salary * 0.195:,.2f} UAH"
            )
        else:
            await update.message.reply_text("⚠️ Не вдалося зберегти працівника на сервері.")
    except Exception as e:
        logger.error(f"Помилка створення працівника: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")
        
    return ConversationHandler.END

async def cancel_employee(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Додавання працівника скасовано.")
    return ConversationHandler.END


# Edit Employee Salary Conversation
async def edit_salary_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Початок редагування окладу працівника. Вибір підприємства."""
    telegram_id = str(update.effective_user.id)
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res.status_code == 200:
            profiles = res.json()
            llc_profiles = [p for p in profiles if p["type"] == "company"]
            if not llc_profiles:
                await update.message.reply_text(
                    "⚠️ У вас немає зареєстрованих профілів типу ТОВ.\n"
                    "Працівників можна редагувати тільки для підприємств (ТОВ)."
                )
                return ConversationHandler.END
            keyboard = [
                [InlineKeyboardButton(p["name"], callback_data=f"edit_sal_prof_{p['id']}")]
                for p in llc_profiles
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(
                "✏️ **Редагування окладу працівника**\n\n"
                "Оберіть підприємство (ТОВ):",
                reply_markup=reply_markup
            )
            return ES_CHOOSING_PROFILE
        else:
            await update.message.reply_text("⚠️ Не вдалося завантажити профілі з сервера.")
            return ConversationHandler.END
    except Exception as e:
        logger.error(f"Помилка завантаження профілів: {e}")
        await update.message.reply_text("⚠️ Сервер бекенду зараз недоступний.")
        return ConversationHandler.END

async def edit_salary_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору профілю. Відображення списку працівників."""
    query = update.callback_query
    await query.answer()
    profile_id = int(query.data.split("_")[3])
    context.user_data["edit_salary"] = {"profile_id": profile_id}
    try:
        res = requests.get(f"{BACKEND_URL}/api/employees/{profile_id}", timeout=3)
        if res.status_code == 200:
            employees = res.json()
            if not employees:
                await query.edit_message_text("⚠️ У цьому підприємстві немає доданих працівників.")
                return ConversationHandler.END
            keyboard = [
                [InlineKeyboardButton(f"{emp['name']} ({emp['salary']} UAH)", callback_data=f"edit_sal_emp_{emp['id']}")]
                for emp in employees
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.edit_message_text(
                "Оберіть працівника для зміни окладу:",
                reply_markup=reply_markup
            )
            return ES_CHOOSING_EMPLOYEE
        else:
            await query.edit_message_text("⚠️ Не вдалося завантажити працівників.")
            return ConversationHandler.END
    except Exception as e:
        logger.error(f"Помилка завантаження працівників: {e}")
        await query.edit_message_text("⚠️ Помилка зв'язку з бекендом.")
        return ConversationHandler.END

async def edit_salary_employee(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору працівника. Запит нового окладу."""
    query = update.callback_query
    await query.answer()
    employee_id = int(query.data.split("_")[3])
    context.user_data["edit_salary"]["employee_id"] = employee_id
    await query.edit_message_text(
        "Введіть новий оклад працівника в UAH (числом, наприклад, 25000):"
    )
    return ES_ENTERING_SALARY

async def edit_salary_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка введення окладу та збереження змін."""
    try:
        salary = float(update.message.text.replace(" ", "").replace(",", "."))
    except ValueError:
        await update.message.reply_text("⚠️ Некоректне число. Спробуйте ще раз:")
        return ES_ENTERING_SALARY
    emp_data = context.user_data.get("edit_salary")
    employee_id = emp_data["employee_id"]
    try:
        payload = {
            "salary": salary
        }
        res = requests.put(f"{BACKEND_URL}/api/employees/{employee_id}", data=payload, timeout=5)
        if res.status_code == 200:
            updated_emp = res.json().get("employee", {})
            await update.message.reply_text(
                f"💰 **Оклад працівника успішно оновлено!**\n\n"
                f"👤 Працівник: {updated_emp.get('name')}\n"
                f"💰 Новий оклад: {salary:,.2f} UAH\n"
                f"📈 Новий ЄСВ (22%): {salary * 0.22:,.2f} UAH\n"
                f"📉 Новий ПДФО + ВЗ (19.5%): {salary * 0.195:,.2f} UAH"
            )
        else:
            detail = res.json().get("detail", "Невідома помилка на бекенді.")
            await update.message.reply_text(f"⚠️ Не вдалося оновити оклад: {detail}")
    except Exception as e:
        logger.error(f"Помилка оновлення окладу: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")
    return ConversationHandler.END

async def cancel_edit_salary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Зміну окладу скасовано.")
    return ConversationHandler.END


# Delete Employee Conversation
async def delete_employee_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Початок видалення працівника. Вибір підприємства."""
    telegram_id = str(update.effective_user.id)
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res.status_code == 200:
            profiles = res.json()
            llc_profiles = [p for p in profiles if p["type"] == "company"]
            if not llc_profiles:
                await update.message.reply_text(
                    "⚠️ У вас немає зареєстрованих профілів типу ТОВ.\n"
                    "Працівників можна видаляти тільки для підприємств (ТОВ)."
                )
                return ConversationHandler.END
            keyboard = [
                [InlineKeyboardButton(p["name"], callback_data=f"del_emp_prof_{p['id']}")]
                for p in llc_profiles
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(
                "❌ **Видалення працівника**\n\n"
                "Оберіть підприємство (ТОВ):",
                reply_markup=reply_markup
            )
            return DE_CHOOSING_PROFILE
        else:
            await update.message.reply_text("⚠️ Не вдалося завантажити профілі з сервера.")
            return ConversationHandler.END
    except Exception as e:
        logger.error(f"Помилка завантаження профілів: {e}")
        await update.message.reply_text("⚠️ Сервер бекенду зараз недоступний.")
        return ConversationHandler.END

async def delete_employee_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору профілю. Відображення списку працівників."""
    query = update.callback_query
    await query.answer()
    profile_id = int(query.data.split("_")[3])
    context.user_data["delete_employee"] = {"profile_id": profile_id}
    try:
        res = requests.get(f"{BACKEND_URL}/api/employees/{profile_id}", timeout=3)
        if res.status_code == 200:
            employees = res.json()
            if not employees:
                await query.edit_message_text("⚠️ У цьому підприємстві немає доданих працівників.")
                return ConversationHandler.END
            keyboard = [
                [InlineKeyboardButton(emp["name"], callback_data=f"del_emp_emp_{emp['id']}")]
                for emp in employees
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.edit_message_text(
                "Оберіть працівника для видалення з бази:",
                reply_markup=reply_markup
            )
            return DE_CHOOSING_EMPLOYEE
        else:
            await query.edit_message_text("⚠️ Не вдалося завантажити працівників.")
            return ConversationHandler.END
    except Exception as e:
        logger.error(f"Помилка завантаження працівників: {e}")
        await query.edit_message_text("⚠️ Помилка зв'язку з бекендом.")
        return ConversationHandler.END

async def delete_employee_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обробка вибору працівника для видалення."""
    query = update.callback_query
    await query.answer()
    employee_id = int(query.data.split("_")[3])
    try:
        res = requests.delete(f"{BACKEND_URL}/api/employees/{employee_id}", timeout=5)
        if res.status_code == 200:
            await query.edit_message_text("❌ **Працівника успішно видалено з бази!**")
        else:
            detail = res.json().get("detail", "Невідома помилка на бекенді.")
            await query.edit_message_text(f"⚠️ Не вдалося видалити працівника: {detail}")
    except Exception as e:
        logger.error(f"Помилка видалення працівника: {e}")
        await query.edit_message_text("⚠️ Помилка зв'язку з бекендом.")
    return ConversationHandler.END

async def cancel_delete_employee(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Видалення працівника скасовано.")
    return ConversationHandler.END

# Check Employees Status
async def check_employees_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Перевірка сплати податків та зарплати працівникам за останні 30 днів."""
    telegram_id = str(update.effective_user.id)
    
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res.status_code == 200:
            profiles = res.json()
            llc_profiles = [p for p in profiles if p["type"] == "company"]
            
            if not llc_profiles:
                await update.message.reply_text("У вас немає профілів підприємств (ТОВ).")
                return
                
            msg = "👥 **Перевірка виплат працівникам (за останні 30 днів):**\n\n"
            has_employees_data = False
            
            for p in llc_profiles:
                res_dash = requests.get(f"{BACKEND_URL}/api/dashboard/{p['id']}", timeout=3)
                if res_dash.status_code == 200:
                    data = res_dash.json()
                    employees = data.get("employees", [])
                    
                    if employees:
                        has_employees_data = True
                        msg += f"🏢 **Підприємство:** {p['name']}\n"
                        for emp in employees:
                            sal_status = "✅ Сплачено" if emp["salary_paid"] else "❌ Не сплачено"
                            esv_status = "✅ Сплачено" if emp["esv_paid"] else "❌ Не сплачено"
                            pit_status = "✅ Сплачено" if emp["pit_paid"] else "❌ Не сплачено"
                            
                            msg += (
                                f"  👤 **{emp['name']}** (Оклад: {emp['salary']:,.2f} UAH)\n"
                                f"    💵 Зарплата: {sal_status}\n"
                                f"    🛡️ ЄСВ (22%): {esv_status} ({emp['esv_amount']:,.2f} UAH)\n"
                                f"    📊 ПДФО+ВЗ (19.5%): {pit_status} ({emp['pit_amount']:,.2f} UAH)\n\n"
                            )
            
            if not has_employees_data:
                msg += "Не знайдено доданих працівників у ваших профілях ТОВ."
                
            await update.message.reply_text(msg)
        else:
            await update.message.reply_text("⚠️ Не вдалося отримати профілі з бекенду.")
    except Exception as e:
        logger.error(f"Помилка перевірки працівників: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

# Edit Transaction Logic
async def edit_transaction_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Початок редагування транзакцій. Вибір профілю."""
    telegram_id = str(update.effective_user.id)
    
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("У вас немає зареєстрованих профілів.")
                return
                
            if len(profiles) == 1:
                await show_transactions_for_edit(update.message, profiles[0]["id"], profiles[0]["name"])
                return
                
            keyboard = [
                [InlineKeyboardButton(p["name"], callback_data=f"tx_edit_p_{p['id']}")]
                for p in profiles
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(
                "🔍 **Редагування транзакцій**\n\n"
                "Оберіть профіль для перегляду останніх транзакцій:",
                reply_markup=reply_markup
            )
        else:
            await update.message.reply_text("⚠️ Не вдалося завантажити профілі.")
    except Exception as e:
        logger.error(f"Помилка завантаження профілів: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_tx_profile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка вибору профілю для транзакцій."""
    query = update.callback_query
    await query.answer()
    
    profile_id = int(query.data.split("_")[3])
    
    # Отримуємо назву профілю
    telegram_id = str(update.effective_user.id)
    res = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
    profile_name = "Профіль"
    if res.status_code == 200:
        for p in res.json():
            if p["id"] == profile_id:
                profile_name = p["name"]
                break
                
    await show_transactions_for_edit(query.message, profile_id, profile_name)

async def show_transactions_for_edit(message, profile_id: int, profile_name: str):
    """Показ останніх транзакцій профілю для вибору."""
    try:
        res = requests.get(f"{BACKEND_URL}/api/statements/debug/{profile_id}", timeout=5)
        if res.status_code == 404:
            await message.reply_text(f"У профілі '{profile_name}' поки немає завантажених виписок.")
            return
        elif res.status_code != 200:
            await message.reply_text("⚠️ Не вдалося отримати транзакції для цього профілю.")
            return
            
        data = res.json()
        payments = data.get("payments", [])
        
        if not payments:
            await message.reply_text(f"У профілі '{profile_name}' немає транзакцій.")
            return
            
        msg = f"🔍 **Останні транзакції профілю '{profile_name}':**\n\nОберіть транзакцію для редагування:\n"
        
        keyboard = []
        for p in payments:
            tax_status = "Оподатк." if p["taxable"] else "Не оподатк."
            label = f"{p['date']} | {p['amount']:,.2f} UAH | {p['transaction_type']} ({tax_status})"
            keyboard.append([InlineKeyboardButton(label, callback_data=f"tx_sel_{p['id']}")])
            
        reply_markup = InlineKeyboardMarkup(keyboard)
        await message.edit_text(msg, reply_markup=reply_markup) if message.text else await message.reply_text(msg, reply_markup=reply_markup)
    except Exception as e:
        logger.error(f"Помилка показу транзакцій: {e}")
        await message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_tx_selection_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка вибору конкретної транзакції для редагування."""
    query = update.callback_query
    await query.answer()
    
    payment_id = int(query.data.split("_")[2])
    
    try:
        res = requests.get(f"{BACKEND_URL}/api/transactions/{payment_id}", timeout=5)
        if res.status_code == 200:
            p = res.json()
            
            taxable_str = "Так" if p["taxable"] else "Ні"
            msg = (
                f"📝 **Редагування транзакції**\n\n"
                f"📅 Дата: {p['date']}\n"
                f"💰 Сума: **{p['amount']:,.2f} UAH**\n"
                f"👤 Контрагент: {p['contragent']}\n"
                f"📝 Призначення: _{p['purpose']}_\n\n"
                f"⚙️ **Поточні налаштування:**\n"
                f"• Оподатковувана: **{taxable_str}**\n"
                f"• Тип: **{p['transaction_type']}**\n\n"
                f"Виберіть дію:"
            )
            
            keyboard = [
                [
                    InlineKeyboardButton(
                        f"Змінити статус (поточна: {taxable_str})", 
                        callback_data=f"tx_tog_{p['id']}_{1 if not p['taxable'] else 0}"
                    )
                ],
                [
                    InlineKeyboardButton("Дохід (income)", callback_data=f"tx_typ_{p['id']}_income"),
                    InlineKeyboardButton("Витрата (expense)", callback_data=f"tx_typ_{p['id']}_expense"),
                ],
                [
                    InlineKeyboardButton("Власні кошти", callback_data=f"tx_typ_{p['id']}_own_funds"),
                    InlineKeyboardButton("Повернення (refund)", callback_data=f"tx_typ_{p['id']}_refund"),
                ],
                [
                    InlineKeyboardButton("Позика (loan)", callback_data=f"tx_typ_{p['id']}_loan"),
                    InlineKeyboardButton("Податок", callback_data=f"tx_typ_{p['id']}_tax_payment"),
                ],
                [
                    InlineKeyboardButton("Зарплата", callback_data=f"tx_typ_{p['id']}_salary_payment"),
                ],
                [
                    InlineKeyboardButton("◀️ Назад до списку", callback_data=f"tx_edit_p_{p['profile_id']}")
                ]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.edit_message_text(msg, reply_markup=reply_markup)
        else:
            await query.message.reply_text("⚠️ Не вдалося отримати деталі транзакції.")
    except Exception as e:
        logger.error(f"Помилка вибору транзакції: {e}")
        await query.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_tx_toggle_taxable_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Зміна статусу taxable для транзакції."""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split("_")
    payment_id = int(parts[2])
    new_taxable = bool(int(parts[3]))
    
    try:
        payload = {"taxable": int(new_taxable)}
        res = requests.put(f"{BACKEND_URL}/api/transactions/{payment_id}", data=payload, timeout=5)
        if res.status_code == 200:
            query.data = f"tx_sel_{payment_id}"
            await handle_tx_selection_callback(update, context)
        else:
            await query.message.reply_text("⚠️ Не вдалося оновити статус оподаткування на сервері.")
    except Exception as e:
        logger.error(f"Помилка оновлення taxable: {e}")
        await query.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_tx_change_type_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Зміна типу транзакції."""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split("_")
    payment_id = int(parts[2])
    new_type = "_".join(parts[3:])
    
    try:
        payload = {"transaction_type": new_type}
        res = requests.put(f"{BACKEND_URL}/api/transactions/{payment_id}", data=payload, timeout=5)
        if res.status_code == 200:
            query.data = f"tx_sel_{payment_id}"
            await handle_tx_selection_callback(update, context)
        else:
            await query.message.reply_text("⚠️ Не вдалося оновити тип транзакції на сервері.")
    except Exception as e:
        logger.error(f"Помилка оновлення типу транзакції: {e}")
        await query.message.reply_text("⚠️ Помилка зв'язку з бекендом.")


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Інструкція з використання бота."""
    await update.message.reply_text(
        "❓ **Довідка UniTaxUA Bot**\n\n"
        "Цей бот допомагає автоматизувати податкову звітність:\n"
        "- **Дашборд**: фінансові показники та податки за поточний період.\n"
        "- **Мої дані**: перегляд вашого профілю оподаткування.\n"
        "- **Завантажити виписку**: відправте файл виписки (PDF, CSV, HTML), щоб розрахувати ваші доходи автоматично.\n"
        "- **Звіти**: згенерувати чернетку декларації F0103306 (для ФОП) або подати ПДВ-звіт.\n"
        "- **Налаштування**: змінити ваші реєстраційні дані.\n"
        "- **Нагадування**: увімкнути/вимкнути щотижневі сповіщення про податкові дедлайни."
    )

async def sign_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Пошук непідписаних документів для користувача та відображення їх списку."""
    telegram_id = str(update.effective_user.id)
    is_callback = update.callback_query is not None
    query = update.callback_query if is_callback else None
    
    if is_callback:
        await query.answer()

    message = query.message if is_callback else update.message

    try:
        # 1. Отримуємо профілі користувача
        res_profiles = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res_profiles.status_code != 200 or len(res_profiles.json()) == 0:
            msg_text = (
                "У вас поки немає зареєстрованих профілів.\n"
                "Будь ласка, почніть з реєстрації через /start або додайте новий профіль через /add_profile."
            )
            if is_callback:
                await query.edit_message_text(msg_text)
            else:
                await update.message.reply_text(msg_text)
            return

        profiles = res_profiles.json()
        unsigned_docs = []

        # 2. Для кожного профілю шукаємо непідписані документи
        for p in profiles:
            profile_id = p["id"]
            res_inv = requests.get(f"{BACKEND_URL}/api/invoices/{profile_id}", timeout=3)
            if res_inv.status_code == 200:
                invoices = res_inv.json()
                for inv in invoices:
                    # Перевіряємо рахунок
                    if inv["status"] != "signed":
                        unsigned_docs.append({
                            "profile_name": p["name"],
                            "profile_id": profile_id,
                            "doc_type": "invoice",
                            "doc_id": inv["id"],
                            "number": inv["invoice_number"],
                            "amount": inv["amount"],
                            "service": inv["service_name"],
                            "date": inv["send_date"]
                        })
                    # Перевіряємо акт
                    act = inv.get("act")
                    if act and act["status"] != "signed":
                        unsigned_docs.append({
                            "profile_name": p["name"],
                            "profile_id": profile_id,
                            "doc_type": "act",
                            "doc_id": act["id"],
                            "number": act["act_number"],
                            "amount": inv["amount"],
                            "service": inv["service_name"],
                            "date": act["created_at"]
                        })

        if not unsigned_docs:
            msg_text = "🎉 Усі ваші документи підписані КЕП!"
            if is_callback:
                await query.edit_message_text(msg_text)
            else:
                await update.message.reply_text(msg_text)
            return

        # 3. Виводимо список непідписаних документів з inline кнопками
        msg_text = "📂 **Непідписані документи:**\n\n"
        keyboard = []
        for doc in unsigned_docs:
            doc_label = "Рахунок" if doc["doc_type"] == "invoice" else "Акт/Накладна"
            msg_text += (
                f"• **{doc_label} №{doc['number']}** ({doc['profile_name']})\n"
                f"  Послуга: {doc['service']}\n"
                f"  Сума: {doc['amount']:,.2f} грн від {doc['date']}\n\n"
            )
            button_text = f"🔏 Підписати {doc_label} №{doc['number']}"
            callback_data = f"sig_sel_{doc['doc_type']}_{doc['doc_id']}_{doc['profile_id']}"
            keyboard.append([InlineKeyboardButton(button_text, callback_data=callback_data)])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        if is_callback:
            await query.edit_message_text(msg_text, reply_markup=reply_markup, parse_mode="Markdown")
        else:
            await update.message.reply_text(msg_text, reply_markup=reply_markup, parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Помилка в sign_cmd: {e}")
        msg_err = "⚠️ Не вдалося отримати документи: Сервер бекенду зараз недоступний."
        if is_callback:
            await query.edit_message_text(msg_err)
        else:
            await update.message.reply_text(msg_err)

async def handle_signing_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка вибору конкретного документу для підписання (показ методів підпису)."""
    query = update.callback_query
    await query.answer()

    data = query.data
    # data: sig_sel_{doc_type}_{doc_id}_{profile_id}
    parts = data.split("_")
    if len(parts) < 5:
        return
    
    doc_type = parts[2]
    doc_id = int(parts[3])
    profile_id = int(parts[4])

    try:
        # 1. Отримуємо сертифікати для профілю
        res_certs = requests.get(f"{BACKEND_URL}/api/certificates/{profile_id}", timeout=3)
        certs = []
        if res_certs.status_code == 200:
            certs = res_certs.json()

        keyboard = []
        
        # 2. Додаємо кнопки для сертифікатів
        for cert in certs:
            btn_label = f"🔑 КЕП: {cert['cert_owner_name']} ({cert['cert_issuer']})"
            callback_data = f"sigmeth_cert_{doc_type}_{doc_id}_{cert['id']}"
            keyboard.append([InlineKeyboardButton(btn_label, callback_data=callback_data)])

        # 3. Додаємо кнопку для Дія.Підпис
        callback_data = f"sigmeth_diia_{doc_type}_{doc_id}"
        keyboard.append([InlineKeyboardButton("📱 Дія.Підпис", callback_data=callback_data)])
        
        # Кнопка Повернутися назад
        keyboard.append([InlineKeyboardButton("⬅️ Назад до списку", callback_data="sig_back")])

        reply_markup = InlineKeyboardMarkup(keyboard)
        doc_label = "Рахунок" if doc_type == "invoice" else "Акт/накладну"
        await query.edit_message_text(
            f"Оберіть метод підписання для: **{doc_label} (ID: {doc_id})**\n\n"
            f"Ви можете використати завантажений КЕП сертифікат або підтвердити підпис через Дія.Підпис.",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"Помилка handle_signing_selection: {e}")
        await query.edit_message_text("⚠️ Помилка зв'язку з бекендом під час завантаження методів підпису.")

async def handle_signing_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Виконання підписання через обраний метод (КЕП сертифікат або Дія.Підпис)."""
    query = update.callback_query
    await query.answer()

    data = query.data
    parts = data.split("_")
    if len(parts) < 4:
        return
        
    method = parts[1] # "cert" або "diia"
    doc_type = parts[2]
    doc_id = int(parts[3])

    try:
        if method == "cert":
            cert_id = int(parts[4])
            payload = {
                "doc_type": doc_type,
                "certificate_id": cert_id,
                "use_diia": False
            }
        else:
            payload = {
                "doc_type": doc_type,
                "certificate_id": None,
                "use_diia": True
            }

        res = requests.post(f"{BACKEND_URL}/api/documents/{doc_id}/sign", json=payload, timeout=10)
        
        if res.status_code == 200:
            result = res.json()
            if result.get("diia_flow"):
                auth_url = result["auth_url"]
                
                telegram_id = str(update.effective_user.id)
                profile_id = None
                res_profiles = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
                if res_profiles.status_code == 200:
                    for p in res_profiles.json():
                        res_inv = requests.get(f"{BACKEND_URL}/api/invoices/{p['id']}", timeout=3)
                        if res_inv.status_code == 200:
                            for inv in res_inv.json():
                                if doc_type == "invoice" and inv["id"] == doc_id:
                                    profile_id = p["id"]
                                    break
                                elif doc_type == "act" and inv.get("act") and inv["act"]["id"] == doc_id:
                                    profile_id = p["id"]
                                    break
                        if profile_id:
                            break

                keyboard = [
                    [InlineKeyboardButton("📱 Підписати в Дія", url=auth_url)],
                    [InlineKeyboardButton("🔄 Перевірити статус підпису", callback_data=f"sigcheck_{doc_type}_{doc_id}_{profile_id or 0}")],
                    [InlineKeyboardButton("⬅️ Назад до списку", callback_data="sig_back")]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await query.edit_message_text(
                    "📱 **Підтвердження Дія.Підпис**\n\n"
                    "Для завершення підписання перейдіть за посиланням нижче у додаток Дія та підтвердіть запит.\n"
                    "Після цього натисніть кнопку **Перевірити статус підпису**.",
                    reply_markup=reply_markup,
                    parse_mode="Markdown"
                )
            else:
                keyboard = [[InlineKeyboardButton("⬅️ До списку документів", callback_data="sig_back")]]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await query.edit_message_text(
                    "✅ **Документ успішно підписано КЕП!**\n\n"
                    "Електронний цифровий підпис накладено, візуальний штамп додано в PDF.",
                    reply_markup=reply_markup,
                    parse_mode="Markdown"
                )
        else:
            err_msg = res.json().get("detail", "Помилка сервера")
            await query.edit_message_text(
                f"❌ **Помилка підписання:**\n{err_msg}\n\n"
                "Спробуйте пізніше або зверніться до підтримки.",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="sig_back")]])
            )
    except Exception as e:
        logger.error(f"Помилка при підписанні: {e}")
        await query.edit_message_text(
            "⚠️ Виникла помилка зв'язку з бекендом під час підписання.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="sig_back")]])
        )

async def handle_signing_check(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Перевірка статусу підписання через Дія.Підпис."""
    query = update.callback_query
    await query.answer()

    data = query.data
    parts = data.split("_")
    if len(parts) < 4:
        return
        
    doc_type = parts[1]
    doc_id = int(parts[2])
    profile_id = int(parts[3])

    if profile_id == 0:
        telegram_id = str(update.effective_user.id)
        res_profiles = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res_profiles.status_code == 200:
            for p in res_profiles.json():
                res_inv = requests.get(f"{BACKEND_URL}/api/invoices/{p['id']}", timeout=3)
                if res_inv.status_code == 200:
                    for inv in res_inv.json():
                        if doc_type == "invoice" and inv["id"] == doc_id:
                            profile_id = p["id"]
                            break
                        elif doc_type == "act" and inv.get("act") and inv["act"]["id"] == doc_id:
                            profile_id = p["id"]
                            break
                if profile_id:
                    break

    signed = False
    try:
        if profile_id and profile_id != 0:
            res_inv = requests.get(f"{BACKEND_URL}/api/invoices/{profile_id}", timeout=3)
            if res_inv.status_code == 200:
                for inv in res_inv.json():
                    if doc_type == "invoice" and inv["id"] == doc_id:
                        if inv["status"] == "signed":
                            signed = True
                        break
                    elif doc_type == "act" and inv.get("act") and inv["act"]["id"] == doc_id:
                        if inv["act"]["status"] == "signed":
                            signed = True
                        break

        if signed:
            keyboard = [[InlineKeyboardButton("⬅️ До списку документів", callback_data="sig_back")]]
            await query.edit_message_text(
                "✅ **Документ успішно підписано через Дія.Підпис!**\n\n"
                "Статус документа оновлено.",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode="Markdown"
            )
        else:
            await query.answer("⏳ Документ все ще не підписано. Спробуйте через кілька секунд.", show_alert=True)
    except Exception as e:
        logger.error(f"Помилка перевірки підпису: {e}")
        await query.answer("⚠️ Помилка зв'язку з бекендом.", show_alert=True)

async def connect_tax_api_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Інструкція для підключення API ДПС"""
    try:
        res = requests.get(f"{BACKEND_URL}/api/tax/token-instructions", timeout=3)
        if res.status_code == 200:
            instructions = res.json()
            message = "🔐 **Підключення до API ДПС**\n\n"
            for step in instructions['steps']:
                message += f"{step}\n"
            
            message += "\nПісля отримання токена, надішліть його командою:\n"
            message += "`/set_tax_token ваш_токен`"
            await update.message.reply_text(message, parse_mode="Markdown", disable_web_page_preview=True)
        else:
            await update.message.reply_text("⚠️ Не вдалося отримати інструкцію з сервера.")
    except Exception as e:
        logger.error(f"Error in connect_tax_api_command: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def set_tax_token_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Зберегти токен доступу до API ДПС"""
    token = ' '.join(context.args).strip()
    if not token:
        await update.message.reply_text("Будь ласка, вкажіть токен: `/set_tax_token ваш_токен`", parse_mode="Markdown")
        return
    
    telegram_id = str(update.effective_user.id)
    context.user_data["temp_tax_token"] = token

    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles?telegram_id={telegram_id}", timeout=5)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("⚠️ У вас немає зареєстрованих профілів. Спочатку додайте підприємство.")
                return
            
            if len(profiles) == 1:
                profile_id = profiles[0]["id"]
                payload = {"profile_id": profile_id, "token": token}
                save_res = requests.post(f"{BACKEND_URL}/api/tax/set-token", json=payload, timeout=5)
                if save_res.status_code == 200:
                    await update.message.reply_text("✅ API ДПС підключено для вашого підприємства! Тепер ви можете перевіряти податковий борг командою /check_debt")
                else:
                    await update.message.reply_text(f"⚠️ Не вдалося зберегти токен: {save_res.text}")
            else:
                keyboard = [
                    [InlineKeyboardButton(p["name"], callback_data=f"linktoken_p_{p['id']}")]
                    for p in profiles
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "🔐 **Підключення API ДПС**\n\nВиберіть підприємство, до якого слід прив'язати цей токен:",
                    reply_markup=reply_markup
                )
        else:
            await update.message.reply_text("⚠️ Не вдалося отримати список профілів.")
    except Exception as e:
        logger.error(f"Error in set_tax_token_command: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_link_token_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка вибору підприємства для прив'язки токена."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    parts = data.split("_")
    if len(parts) < 3:
        return
        
    profile_id = int(parts[2])
    token = context.user_data.get("temp_tax_token")
    if not token:
        await query.edit_message_text("⚠️ Термін дії токена в пам'яті минув. Будь ласка, введіть команду /set_tax_token знову.")
        return
        
    try:
        payload = {"profile_id": profile_id, "token": token}
        save_res = requests.post(f"{BACKEND_URL}/api/tax/set-token", json=payload, timeout=5)
        if save_res.status_code == 200:
            context.user_data.pop("temp_tax_token", None)
            await query.edit_message_text("✅ API ДПС підключено для обраного підприємства! Тепер ви можете перевіряти податковий борг командою /check_debt")
        else:
            await query.edit_message_text(f"⚠️ Не вдалося зберегти токен: {save_res.text}")
    except Exception as e:
        logger.error(f"Error in handle_link_token_callback: {e}")
        await query.edit_message_text("⚠️ Виникла помилка зв'язку з бекендом.")

async def check_debt_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Перевірити наявність податкового боргу"""
    telegram_id = str(update.effective_user.id)
    
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles?telegram_id={telegram_id}", timeout=5)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("⚠️ У вас немає зареєстрованих профілів.")
                return
                
            if len(profiles) == 1:
                await execute_debt_check(update.message, profiles[0]["id"])
            else:
                keyboard = [
                    [InlineKeyboardButton(p["name"], callback_data=f"checkdebt_p_{p['id']}")]
                    for p in profiles
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "📊 **Перевірка податкового боргу**\n\nОберіть підприємство/профіль для перевірки:",
                    reply_markup=reply_markup
                )
        else:
            await update.message.reply_text("⚠️ Не вдалося отримати список профілів.")
    except Exception as e:
        logger.error(f"Error in check_debt_command: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_check_debt_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка вибору підприємства для перевірки боргу."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    parts = data.split("_")
    if len(parts) < 3:
        return
        
    profile_id = int(parts[2])
    await query.edit_message_text("⏳ Запитуємо Електронний кабінет ДПС...")
    await execute_debt_check(query.message, profile_id, edit_message=True)

async def execute_debt_check(message, profile_id: int, edit_message: bool = False):
    """Викликає API перевірки боргу та виводить результат."""
    try:
        payload = {"profile_id": profile_id}
        res = requests.post(f"{BACKEND_URL}/api/tax/check-debt", json=payload, timeout=10)
        
        if res.status_code == 200:
            response = res.json()
            if response.get("error"):
                msg = (
                    f"❌ {response['error']}\n\n"
                    f"Для перевірки необхідно підключити API Електронного кабінету.\n"
                    f"Інструкція: /connect_tax_api"
                )
            else:
                status = "✅ Податковий борг відсутній" if not response['has_debt'] else "⚠️ Знайдено податковий борг!"
                msg = f"{status}\n\n"
                
                if response['total_debt'] > 0:
                    msg += f"Загальна сума заборгованості: **{response['total_debt']:,.2f} грн**\n"
                    
                    if response.get('debt_details'):
                        msg += "\nДеталі боргу:\n"
                        for tax, amount in response['debt_details'].items():
                            msg += f"• {tax}: **{amount:,.2f} грн**\n"
                
                msg += f"\n🕐 Стан розрахунків актуальний на: {response['checked_at']}"
                if response.get('cached'):
                    msg += " (дані з кешу)"
            
            if edit_message:
                await message.edit_text(msg, parse_mode="Markdown")
            else:
                await message.reply_text(msg, parse_mode="Markdown")
        else:
            err_msg = "⚠️ Виникла помилка при перевірці боргу на сервері."
            if edit_message:
                await message.edit_text(err_msg)
            else:
                await message.reply_text(err_msg)
    except Exception as e:
        logger.error(f"Error in execute_debt_check: {e}")
        err_msg = "⚠️ Не вдалося зв'язатися з бекендом для перевірки боргу."
        if edit_message:
            await message.edit_text(err_msg)
        else:
            await message.reply_text(err_msg)

async def validate_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Перевірити останню виписку на помилки парсингу"""
    telegram_id = str(update.effective_user.id)
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles?telegram_id={telegram_id}", timeout=5)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("⚠️ У вас немає зареєстрованих профілів.")
                return
            if len(profiles) == 1:
                await execute_validation_check(update.message, profiles[0]["id"])
            else:
                keyboard = [
                    [InlineKeyboardButton(p["name"], callback_data=f"valst_p_{p['id']}")]
                    for p in profiles
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "📁 **Валідація виписки**\n\nОберіть профіль для перевірки статусу останньої виписки:",
                    reply_markup=reply_markup
                )
        else:
            await update.message.reply_text("⚠️ Не вдалося отримати список профілів.")
    except Exception as e:
        logger.error(f"Error in validate_command: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_validate_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    parts = query.data.split("_")
    if len(parts) < 3:
        return
    profile_id = int(parts[2])
    await query.edit_message_text("⏳ Перевіряємо статус валідації...")
    await execute_validation_check(query.message, profile_id, edit_message=True)

async def execute_validation_check(message, profile_id: int, edit_message: bool = False):
    try:
        res = requests.get(f"{BACKEND_URL}/api/statements/latest?profile_id={profile_id}", timeout=5)
        if res.status_code == 200:
            response = res.json()
            if not response:
                msg = "У вас ще немає завантажених виписок для цього профілю."
            else:
                if response['validation_status'] == 'validated':
                    msg = f"✅ **Остання виписка розпізнана без помилок!**\n\n📄 Файл: `{response['file_name']}`\n📅 Статус: Валідовано"
                else:
                    errors_count = response['errors_count']
                    msg = (
                        f"⚠️ **Виявлено {errors_count} помилок при розпізнаванні виписки!**\n\n"
                        f"📄 Файл: `{response['file_name']}`\n"
                        f"Для перегляду та ручного виправлення перейдіть у веб-додаток: "
                        f"https://unitas-frontend.fly.dev/statements/{response['id']}/validate"
                    )
            if edit_message:
                await message.edit_text(msg, parse_mode="Markdown")
            else:
                await message.reply_text(msg, parse_mode="Markdown")
        else:
            err_msg = "⚠️ Не вдалося перевірити статус валідації виписки."
            if edit_message:
                await message.edit_text(err_msg)
            else:
                await message.reply_text(err_msg)
    except Exception as e:
        logger.error(f"Error in execute_validation_check: {e}")
        err_msg = "⚠️ Не вдалося зв'язатися з бекендом."
        if edit_message:
            await message.edit_text(err_msg)
        else:
            await message.reply_text(err_msg)

async def tax_news_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Останні зміни в податковому законодавстві"""
    telegram_id = str(update.effective_user.id)
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles?telegram_id={telegram_id}", timeout=5)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("⚠️ У вас немає зареєстрованих профілів.")
                return
            if len(profiles) == 1:
                await execute_tax_news(update.message, profiles[0]["id"])
            else:
                keyboard = [
                    [InlineKeyboardButton(p["name"], callback_data=f"taxnews_p_{p['id']}")]
                    for p in profiles
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "📢 **Зміни у законодавстві**\n\nОберіть профіль для перегляду новин:",
                    reply_markup=reply_markup
                )
        else:
            await update.message.reply_text("⚠️ Не вдалося отримати список профілів.")
    except Exception as e:
        logger.error(f"Error in tax_news_command: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_tax_news_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    parts = query.data.split("_")
    if len(parts) < 3:
        return
    profile_id = int(parts[2])
    await query.edit_message_text("⏳ Завантажуємо новини...")
    await execute_tax_news(query.message, profile_id, edit_message=True)

async def execute_tax_news(message, profile_id: int, edit_message: bool = False):
    try:
        res = requests.get(f"{BACKEND_URL}/api/legislation/changes?profile_id={profile_id}&limit=5", timeout=5)
        if res.status_code == 200:
            changes = res.json()
            if not changes:
                msg = "Наразі немає нових змін у законодавстві для вашого профілю."
            else:
                msg = "📢 **Останні зміни в податковому законодавстві:**\n\n"
                for change in changes:
                    severity_emoji = "🔴" if change['severity'] == 'critical' else "🟠" if change['severity'] == 'important' else "🔵"
                    msg += f"{severity_emoji} *{change['title']}*\n"
                    msg += f"📝 {change['summary']}\n"
                    msg += f"💡 *Порада від ШІ:* {change['recommendations']}\n"
                    if change.get('document_url'):
                        msg += f"[Офіційне джерело]({change['document_url']})\n"
                    msg += "\n"
            if edit_message:
                await message.edit_text(msg, parse_mode="Markdown", disable_web_page_preview=True)
            else:
                await message.reply_text(msg, parse_mode="Markdown", disable_web_page_preview=True)
        else:
            err_msg = "⚠️ Не вдалося отримати новини законодавства."
            if edit_message:
                await message.edit_text(err_msg)
            else:
                await message.reply_text(err_msg)
    except Exception as e:
        logger.error(f"Error in execute_tax_news: {e}")
        err_msg = "⚠️ Не вдалося зв'язатися з бекендом."
        if edit_message:
            await message.edit_text(err_msg)
        else:
            await message.reply_text(err_msg)

async def tax_subscribe_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Підписатися на сповіщення про зміни"""
    telegram_id = str(update.effective_user.id)
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles?telegram_id={telegram_id}", timeout=5)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("⚠️ У вас немає зареєстрованих профілів.")
                return
            if len(profiles) == 1:
                await execute_tax_subscribe(update.message, profiles[0]["id"])
            else:
                keyboard = [
                    [InlineKeyboardButton(p["name"], callback_data=f"taxsub_p_{p['id']}")]
                    for p in profiles
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "🔔 **Підписка на новини**\n\nОберіть профіль для оформлення підписки:",
                    reply_markup=reply_markup
                )
        else:
            await update.message.reply_text("⚠️ Не вдалося отримати список профілів.")
    except Exception as e:
        logger.error(f"Error in tax_subscribe_command: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_tax_subscribe_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    parts = query.data.split("_")
    if len(parts) < 3:
        return
    profile_id = int(parts[2])
    await query.edit_message_text("⏳ Оформлюємо підписку...")
    await execute_tax_subscribe(query.message, profile_id, edit_message=True)

async def execute_tax_subscribe(message, profile_id: int, edit_message: bool = False):
    try:
        res = requests.post(f"{BACKEND_URL}/api/legislation/subscribe?profile_id={profile_id}&notify_telegram=true", timeout=5)
        if res.status_code == 200:
            msg = "✅ **Ви успішно підписалися на Telegram-сповіщення про зміни в законодавстві!**\n\nПри виявленні критичних або важливих податкових змін ШІ-агент надішле вам сповіщення з порадами."
            if edit_message:
                await message.edit_text(msg, parse_mode="Markdown")
            else:
                await message.reply_text(msg, parse_mode="Markdown")
        else:
            err_msg = "⚠️ Не вдалося оформити підписку."
            if edit_message:
                await message.edit_text(err_msg)
            else:
                await message.reply_text(err_msg)
    except Exception as e:
        logger.error(f"Error in execute_tax_subscribe: {e}")
        err_msg = "⚠️ Не вдалося зв'язатися з бекендом."
        if edit_message:
            await message.edit_text(err_msg)
        else:
            await message.reply_text(err_msg)

async def handle_menu_click(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробник натискань кнопок головного меню."""
    text = update.message.text
    if text == "📊 Дашборд":
        await status(update, context)
    elif text == "📁 Мої дані":
        await mydata(update, context)
    elif text == "📤 Завантажити виписку":
        await upload_prompt(update, context)
    elif text == "📄 Звіти":
        await generate_report_cmd(update, context)
    elif text == "👥 Працівники":
        await employees_cmd(update, context)
    elif text == "➕ Додати підприємство":
        return await add_profile_start(update, context)
    elif text == "📊 Податковий аналіз":
        await tax_analysis_cmd(update, context)
    elif text == "💵 Сплата податків":
        await pay_cmd(update, context)
    elif text == "🔏 Підписати документи":
        await sign_cmd(update, context)
    elif text == "❓ Допомога":
        await help_cmd(update, context)

# Callback report selection handler
async def handle_report_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка вибору типу звіту з inline кнопок."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    if data.startswith("rep_tax_"):
        company_id = int(data.split("_")[2])
        await query.edit_message_text("⏳ AI генерує чернетку декларації F0103306...")
        try:
            res_rep = requests.post(
                f"{BACKEND_URL}/api/generate-report/{company_id}/F0103306", 
                params={"period": "Q1", "year": 2025},
                timeout=5
            )
            if res_rep.status_code == 200:
                report = res_rep.json()
                fields = report["fields"]
                msg = (
                    f"📝 **Чернетка податкової декларації (F0103306):**\n\n"
                    f"🟢 ПІБ платника: {fields['HNAME']['value']}\n"
                    f"🟢 ІПН: {fields['HTIN']['value']}\n"
                    f"🟢 Дохід за 1 квартал: **{fields['ROW01']['value']:,.2f} UAH**\n"
                    f"🟢 Ставка податку: {fields['TAX_RATE']['value']}%\n"
                    f"🟢 Сума податку: **{fields['TAX_DUE']['value']:,.2f} UAH**\n\n"
                    f"Виберіть формат для завантаження:"
                )
                keyboard = [
                    [
                        InlineKeyboardButton("Завантажити XML (для ДПС)", callback_data=f"dl_xml_{report['report_id']}"),
                        InlineKeyboardButton("Завантажити JSON", callback_data=f"dl_json_{report['report_id']}"),
                    ],
                    [
                        InlineKeyboardButton("🚀 Подати до ДПС", callback_data=f"txsub_start_{report['report_id']}")
                    ]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await query.message.reply_text(msg, reply_markup=reply_markup)
        except Exception as e:
            logger.error(f"Помилка генерації податкового звіту: {e}")
            await query.message.reply_text("⚠️ Помилка генерації звіту на сервері.")
            
    elif data.startswith("rep_vat_"):
        await query.edit_message_text(
            "Для формування декларації з ПДВ необхідно ввести суми податкового кредиту та зобов'язань.\n\n"
            "Напишіть команду /pdv для початку інтерактивного заповнення."
        )

# Conversation handlers for VAT
async def pdv_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Початок формування ПДВ декларації, запит вихідного ПДВ."""
    telegram_id = str(update.effective_user.id)
    try:
        res = requests.get(f"{BACKEND_URL}/api/companies/{telegram_id}", timeout=2)
        if res.status_code != 200 or len(res.json()) == 0:
            await update.message.reply_text("Спершу зареєструйте компанію за допомогою /start")
            return ConversationHandler.END
        company = res.json()[0]
        context.user_data["pdv_company_id"] = company["id"]
    except Exception:
        await update.message.reply_text("Помилка зв'язку з бекендом. Спробуйте пізніше.")
        return ConversationHandler.END

    await update.message.reply_text(
        "📝 **Формування Декларації з ПДВ (F0110210)**\n\n"
        "Будь ласка, введіть суму **вихідного ПДВ** (податкове зобов'язання) в UAH:\n"
        "*(або напишіть /cancel для скасування)*"
    )
    return ENTERING_VAT_OUT

async def enter_vat_out(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Отримання вихідного ПДВ, запит вхідного ПДВ."""
    try:
        vat_out = float(update.message.text.replace(" ", "").replace(",", "."))
        context.user_data["vat_out"] = vat_out
    except ValueError:
        await update.message.reply_text("⚠️ Некоректне число. Спробуйте ще раз або введіть /cancel:")
        return ENTERING_VAT_OUT

    await update.message.reply_text(
        "Будь ласка, введіть суму **вхідного ПДВ** (податковий кредит) в UAH:\n"
        "*(або напишіть /cancel для скасування)*"
    )
    return ENTERING_VAT_IN

async def enter_vat_in(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Отримання вхідного ПДВ, генерація декларації."""
    try:
        vat_in = float(update.message.text.replace(" ", "").replace(",", "."))
        context.user_data["vat_in"] = vat_in
    except ValueError:
        await update.message.reply_text("⚠️ Некоректне число. Спробуйте ще раз або введіть /cancel:")
        return ENTERING_VAT_IN

    company_id = context.user_data.get("pdv_company_id")
    vat_out = context.user_data.get("vat_out", 0.0)
    
    await update.message.reply_text("⏳ AI генерує чернетку ПДВ-декларації F0110210...")
    
    try:
        res_rep = requests.post(
            f"{BACKEND_URL}/api/generate-report/{company_id}/F0110210",
            params={"period": "Q1", "year": 2025, "vat_in": vat_in, "vat_out": vat_out},
            timeout=5
        )
        if res_rep.status_code == 200:
            report = res_rep.json()
            fields = report["fields"]
            msg = (
                f"📝 **Чернетка декларації з ПДВ (F0110210):**\n\n"
                f"🏢 Платник: {fields['HNAME']['value']}\n"
                f"🟢 ІПН: {fields['HTIN']['value']}\n"
                f"🟢 Вихідний ПДВ: **{fields['VAT_OUT']['value']:,.2f} UAH**\n"
                f"🟢 Вхідний ПДВ: **{fields['VAT_IN']['value']:,.2f} UAH**\n"
                f"🟢 ПДВ до сплати: **{fields['VAT_DUE']['value']:,.2f} UAH**\n\n"
                f"Виберіть формат для завантаження:"
            )
            
            keyboard = [
                [
                    InlineKeyboardButton("Завантажити XML (для ДПС)", callback_data=f"dl_xml_{report['report_id']}"),
                    InlineKeyboardButton("Завантажити JSON", callback_data=f"dl_json_{report['report_id']}"),
                ]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(msg, reply_markup=reply_markup)
        else:
            await update.message.reply_text("⚠️ Помилка на бекенді при генерації декларації.")
    except Exception as e:
        logger.error(f"Помилка генерації звіту ПДВ: {e}")
        await update.message.reply_text("⚠️ Не вдалося зв'язатися з сервером для генерації звіту.")

    return ConversationHandler.END

async def cancel_vat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Формування ПДВ декларації скасовано.")
    return ConversationHandler.END

async def link_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Підключення Telegram акаунта до мобільного додатка за email та кодом."""
    if not context.args or len(context.args) < 2:
        await update.message.reply_text(
            "⚠️ **Для підключення акаунта вкажіть ваш email та 6-значний код безпеки з додатка.**\n\n"
            "Наприклад:\n`/link user@example.com 123456`\n\n"
            "Код безпеки можна знайти в мобільному додатку в розділі **Налаштування** -> **Синхронізація з Telegram**.",
            parse_mode="Markdown"
        )
        return
        
    email = context.args[0].strip().lower()
    code = context.args[1].strip()
    telegram_id = str(update.effective_chat.id)
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/bot/link",
            json={"telegram_id": telegram_id, "email": email, "code": code}
        )
        if response.status_code == 200:
            await update.message.reply_text(
                f"🎉 Акаунт *{email}* успішно підключено!\nТепер ви будете отримувати сповіщення та коди входу в цей чат.",
                parse_mode="Markdown"
            )
        else:
            detail = response.json().get("detail", "Невідома помилка на бекенді.")
            await update.message.reply_text(f"❌ Помилка: {detail}")
    except Exception as e:
        logger.error(f"Error in link_cmd: {e}")
        await update.message.reply_text("❌ Не вдалося з'єднатися з бекендом. Спробуйте пізніше.")

async def connect_gmail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Надає посилання для підключення Gmail"""
    telegram_id = str(update.effective_user.id)
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles?telegram_id={telegram_id}", timeout=5)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("⚠️ У вас немає зареєстрованих профілів. Будь ласка, спочатку створіть профіль.")
                return
            
            text = "🔐 **Підключення Gmail для надсилання рахунків**\n\nОберіть профіль, для якого ви хочете підключити пошту:\n\n"
            for p in profiles:
                url_res = requests.get(f"{BACKEND_URL}/api/auth/google/url/{p['id']}", timeout=3)
                if url_res.status_code == 200:
                    url = url_res.json().get("url")
                    text += f"▪️ **{p['name']}**: [Підключити Gmail]({url})\n"
                else:
                    text += f"▪️ **{p['name']}**: _Не вдалося згенерувати посилання (перевірте налаштування Google OAuth)_\n"
            
            await update.message.reply_text(
                text,
                parse_mode="Markdown",
                disable_web_page_preview=True
            )
        else:
            await update.message.reply_text("⚠️ Не вдалося завантажити ваші профілі з сервера.")
    except Exception as e:
        logger.error(f"Помилка в connect_gmail: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def pay_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Початок процесу сплати податків."""
    telegram_id = str(update.effective_user.id)
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles?telegram_id={telegram_id}", timeout=5)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("⚠️ У вас немає зареєстрованих профілів. Спочатку додайте підприємство.")
                return
            
            if len(profiles) == 1:
                await show_profile_liabilities(update.message, profiles[0]["id"], profiles[0]["name"])
            else:
                keyboard = [
                    [InlineKeyboardButton(p["name"], callback_data=f"pay_p_{p['id']}")]
                    for p in profiles
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "💵 **Сплата податків**\n\nОберіть підприємство/профіль для сплати:",
                    reply_markup=reply_markup
                )
        else:
            await update.message.reply_text("⚠️ Не вдалося завантажити ваші профілі з сервера.")
    except Exception as e:
        logger.error(f"Error in pay_cmd: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def show_profile_liabilities(message, profile_id: int, profile_name: str):
    """Показує податкові зобов'язання для обраного профілю."""
    try:
        res = requests.get(f"{BACKEND_URL}/api/tax-liabilities?profile_id={profile_id}", timeout=5)
        if res.status_code == 200:
            liabilities = res.json()
            pending = [l for l in liabilities if l["status"] != "paid"]
            if not pending:
                await message.reply_text(f"🎉 **{profile_name}**: Усі податки сплачено! Заборгованостей немає.")
                return
            
            tax_labels = {
                "edp": "Єдиний податок (ЄП)",
                "esv": "ЄСВ за себе",
                "pdfo": "ПДФО",
                "vz": "Військовий збір"
            }
            
            keyboard = []
            msg = f"📋 **Податкові зобов'язання для {profile_name}:**\n\nОберіть податок для сплати:\n"
            for idx, l in enumerate(pending):
                label = tax_labels.get(l["tax_type"], l["tax_type_name"])
                msg += f"{idx+1}. {label} за {l['period']} — **{l['amount']:,.2f} грн**\n"
                keyboard.append([
                    InlineKeyboardButton(
                        f"Сплатити {label} ({l['amount']:,.0f} грн)", 
                        callback_data=f"pay_l_{profile_id}_{l['tax_type']}_{l['amount']}_{l['period']}"
                    )
                ])
                
            reply_markup = InlineKeyboardMarkup(keyboard)
            await message.reply_text(msg, reply_markup=reply_markup)
        else:
            await message.reply_text("⚠️ Не вдалося отримати зобов'язання для профілю.")
    except Exception as e:
        logger.error(f"Error in show_profile_liabilities: {e}")
        await message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_payment_callbacks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка callback запитів для сплати податків."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    if data.startswith("pay_p_"):
        profile_id = int(data.split("_")[2])
        telegram_id = str(update.effective_user.id)
        res = requests.get(f"{BACKEND_URL}/api/profiles?telegram_id={telegram_id}", timeout=3)
        profile_name = "Підприємство"
        if res.status_code == 200:
            for p in res.json():
                if p["id"] == profile_id:
                    profile_name = p["name"]
        await show_profile_liabilities(query.message, profile_id, profile_name)
        
    elif data.startswith("pay_l_"):
        parts = data.split("_")
        profile_id = parts[2]
        tax_type = parts[3]
        amount = parts[4]
        period = parts[5]
        
        keyboard = [
            [
                InlineKeyboardButton("Приват24", callback_data=f"pay_b_{profile_id}_{tax_type}_{amount}_{period}_privat24"),
                InlineKeyboardButton("monobank", callback_data=f"pay_b_{profile_id}_{tax_type}_{amount}_{period}_monobank")
            ],
            [
                InlineKeyboardButton("А-Банк", callback_data=f"pay_b_{profile_id}_{tax_type}_{amount}_{period}_abank")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            f"🏦 **Вибір банку для оплати**\n\n"
            f"Податок: {tax_type.upper()}\n"
            f"Сума: {float(amount):,.2f} грн\n"
            f"Період: {period}\n\n"
            f"Оберіть банк:",
            reply_markup=reply_markup
        )
        
    elif data.startswith("pay_b_"):
        parts = data.split("_")
        profile_id = int(parts[2])
        tax_type = parts[3]
        amount = float(parts[4])
        period = parts[5]
        bank_code = parts[6]
        
        try:
            payload = {
                "profile_id": profile_id,
                "tax_type": tax_type,
                "amount": amount,
                "period": period,
                "bank_code": bank_code
            }
            res = requests.post(f"{BACKEND_URL}/api/payments/generate", json=payload, timeout=5)
            if res.status_code == 200:
                pay_data = res.json()
                
                msg = (
                    f"💵 **Реквізити для сплати податку**\n\n"
                    f"🏢 **Отримувач:** {pay_data['recipient']}\n"
                    f"🔢 **Код ЄДРПОУ:** `{pay_data['edrpou']}`\n"
                    f"🏦 **IBAN:** `{pay_data['iban']}`\n"
                    f"💰 **Сума до сплати:** *{pay_data['amount']:,.2f} UAH*\n"
                    f"📝 **Призначення:** `{pay_data['purpose']}`\n\n"
                )
                
                method = pay_data["methods"].get(bank_code, {})
                msg += f"💡 **Інструкція:** {method.get('instructions', 'Сплатіть за вказаними реквізитами')}"
                
                keyboard = []
                deep_link = method.get("deep_link")
                if deep_link:
                    keyboard.append([InlineKeyboardButton(f"🔗 Відкрити {bank_code.capitalize()}", url=deep_link)])
                    
                keyboard.append([
                    InlineKeyboardButton("✅ Позначити як сплачено", callback_data=f"pay_c_{pay_data['id']}")
                ])
                
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                qr_image_b64 = method.get("qr_image")
                if qr_image_b64:
                    import base64
                    from io import BytesIO
                    qr_bytes = base64.b64decode(qr_image_b64)
                    qr_file = BytesIO(qr_bytes)
                    qr_file.name = "qr.png"
                    
                    await query.message.delete()
                    await query.message.reply_photo(
                        photo=qr_file,
                        caption=msg,
                        reply_markup=reply_markup,
                        parse_mode="Markdown"
                    )
                else:
                    await query.edit_message_text(
                        text=msg,
                        reply_markup=reply_markup,
                        parse_mode="Markdown"
                    )
            else:
                await query.edit_message_text("⚠️ Не вдалося згенерувати платіжні реквізити.")
        except Exception as e:
            logger.error(f"Error generating payment in bot: {e}")
            await query.edit_message_text("⚠️ Виникла помилка під час генерації реквізитів.")
            
    elif data.startswith("pay_c_"):
        payment_id = int(data.split("_")[2])
        try:
            res = requests.post(f"{BACKEND_URL}/api/payments/{payment_id}/confirm", timeout=5)
            if res.status_code == 200:
                if query.message.caption:
                    await query.edit_message_caption(
                        caption=query.message.caption + "\n\n✅ **Сплачено та підтверджено у додатку!**",
                        reply_markup=None,
                        parse_mode="Markdown"
                    )
                else:
                    await query.edit_message_text(
                        text=query.message.text + "\n\n✅ **Сплачено та підтверджено у додатку!**",
                        reply_markup=None,
                        parse_mode="Markdown"
                    )
            else:
                await query.message.reply_text("⚠️ Не вдалося підтвердити сплату на сервері.")
        except Exception as e:
            logger.error(f"Error confirming payment in bot: {e}")
            await query.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

# --- DPS integration commands ---

async def submit_report_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Відправити звіт до ДПС (вибір профілю)"""
    telegram_id = str(update.effective_user.id)
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("⚠️ У вас немає зареєстрованих профілів.")
                return
            
            if len(profiles) == 1:
                await list_ready_reports(update.message, profiles[0]["id"])
            else:
                keyboard = [
                    [InlineKeyboardButton(p["name"], callback_data=f"subrep_p_{p['id']}")]
                    for p in profiles
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "📄 **Відправка звіту до ДПС**\n\nОберіть підприємство/профіль:",
                    reply_markup=reply_markup
                )
        else:
            await update.message.reply_text("⚠️ Не вдалося отримати профілі з бекенду.")
    except Exception as e:
        logger.error(f"Error in submit_report_command: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def list_ready_reports(message, profile_id: int):
    try:
        res = requests.get(f"{BACKEND_URL}/api/reports/ready?profile_id={profile_id}", timeout=5)
        if res.status_code == 200:
            reports = res.json()
            if not reports:
                await message.reply_text("Немає готових звітів для відправки.")
                return
            
            msg = "📄 *Готові звіти для відправки:*\n\n"
            for report in reports:
                msg += f"• {report['report_name']} ({report['period']})\n"
                msg += f"  /submit_{report['id']}\n\n"
            
            await message.reply_text(msg, parse_mode="Markdown")
        else:
            await message.reply_text("⚠️ Не вдалося отримати готові звіти.")
    except Exception as e:
        logger.error(f"Error in list_ready_reports: {e}")
        await message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_submit_report_profile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    profile_id = int(query.data.split("_")[2])
    await list_ready_reports(query.message, profile_id)

async def report_status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Перевірити статус поданих звітів"""
    telegram_id = str(update.effective_user.id)
    try:
        res = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("⚠️ У вас немає зареєстрованих профілів.")
                return
            
            if len(profiles) == 1:
                await show_submissions_status(update.message, profiles[0]["id"])
            else:
                keyboard = [
                    [InlineKeyboardButton(p["name"], callback_data=f"substat_p_{p['id']}")]
                    for p in profiles
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "📊 **Статус поданих звітів**\n\nОберіть підприємство/профіль:",
                    reply_markup=reply_markup
                )
        else:
            await update.message.reply_text("⚠️ Не вдалося отримати профілі з бекенду.")
    except Exception as e:
        logger.error(f"Error in report_status_command: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def show_submissions_status(message, profile_id: int):
    try:
        res = requests.get(f"{BACKEND_URL}/api/reports/submissions?profile_id={profile_id}", timeout=5)
        if res.status_code == 200:
            submissions = res.json()
            if not submissions:
                await message.reply_text("Немає поданих звітів.")
                return
            
            msg = "📊 *Статус поданих звітів:*\n\n"
            for sub in submissions:
                emoji = "✅" if sub['submission_status'] == 'accepted' else "⏳" if sub['submission_status'] == 'sent' else "❌"
                msg += f"{emoji} *{sub['report_name']}* ({sub['report_period']})\n"
                msg += f"   Статус: {sub['submission_status']}\n"
                if sub['confirmation_number']:
                    msg += f"   Квитанція: {sub['confirmation_number']}\n"
                msg += "\n"
            
            await message.reply_text(msg, parse_mode="Markdown")
        else:
            await message.reply_text("⚠️ Не вдалося отримати статус звітів.")
    except Exception as e:
        logger.error(f"Error in show_submissions_status: {e}")
        await message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_report_status_profile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    profile_id = int(query.data.split("_")[2])
    await show_submissions_status(query.message, profile_id)

async def export_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Експорт даних - вибір типу експорту"""
    keyboard = [
        [InlineKeyboardButton("📊 Транзакції CSV", callback_data="exp_tx_csv")],
        [InlineKeyboardButton("📊 Транзакції Excel", callback_data="exp_tx_xlsx")],
        [InlineKeyboardButton("📄 Звіти CSV", callback_data="exp_rep_csv")],
        [InlineKeyboardButton("📄 Звіти Excel", callback_data="exp_rep_xlsx")],
        [InlineKeyboardButton("📅 Податковий календар", callback_data="exp_tax")],
        [InlineKeyboardButton("❌ Скасувати", callback_data="exp_cancel")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "📥 **Експорт даних**\n\nОберіть тип даних для експорту:",
        reply_markup=reply_markup
    )

async def handle_export_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка вибору типу експорту"""
    query = update.callback_query
    await query.answer()
    
    action = query.data
    telegram_id = str(update.effective_user.id)
    
    try:
        # Отримати профілі користувача
        res = requests.get(f"{BACKEND_URL}/api/profiles/{telegram_id}", timeout=3)
        if res.status_code != 200 or not res.json():
            await query.edit_message_text("⚠️ У вас немає зареєстрованих профілів.")
            return
        
        profiles = res.json()
        if len(profiles) == 1:
            profile_id = profiles[0]["id"]
            await perform_export(query.message, action, profile_id)
        else:
            # Показати вибір профілю
            keyboard = [
                [InlineKeyboardButton(p["name"], callback_data=f"exp_prof_{action}_{p['id']}")]
                for p in profiles
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.edit_message_text(
                "Оберіть профіль для експорту:",
                reply_markup=reply_markup
            )
    except Exception as e:
        logger.error(f"Error in handle_export_callback: {e}")
        await query.edit_message_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_export_profile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка вибору профілю для експорту"""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split("_")
    action = "_".join(parts[2:4])  # exp_tx_csv or exp_tx_xlsx
    profile_id = int(parts[4])
    
    await perform_export(query.message, action, profile_id)

async def perform_export(message, action: str, profile_id: int):
    """Виконання експорту"""
    try:
        export_url = None
        filename = ""
        
        if action == "exp_tx_csv":
            export_url = f"{BACKEND_URL}/api/export/transactions?profile_id={profile_id}&format=csv"
            filename = "transactions.csv"
        elif action == "exp_tx_xlsx":
            export_url = f"{BACKEND_URL}/api/export/transactions?profile_id={profile_id}&format=xlsx"
            filename = "transactions.xlsx"
        elif action == "exp_rep_csv":
            export_url = f"{BACKEND_URL}/api/export/reports?profile_id={profile_id}&format=csv"
            filename = "reports.csv"
        elif action == "exp_rep_xlsx":
            export_url = f"{BACKEND_URL}/api/export/reports?profile_id={profile_id}&format=xlsx"
            filename = "reports.xlsx"
        elif action == "exp_tax":
            current_year = date.today().year
            export_url = f"{BACKEND_URL}/api/export/taxes?profile_id={profile_id}&format=csv&year={current_year}"
            filename = f"taxes_{current_year}.csv"
        elif action == "exp_cancel":
            await message.reply_text("Експорт скасовано.", reply_markup=get_main_menu_keyboard())
            return
        else:
            await message.reply_text("⚠️ Невідомий тип експорту.")
            return
        
        # Отримати файл з бекенду
        res = requests.get(export_url, timeout=30)
        if res.status_code == 200:
            # Надіслати файл користувачу
            await message.reply_document(
                document=res.content,
                filename=filename,
                caption=f"✅ Експорт успішно завершено: {filename}"
            )
        else:
            await message.reply_text(f"⚠️ Помилка експорту: {res.text}")
    except Exception as e:
        logger.error(f"Error in perform_export: {e}")
        await message.reply_text("⚠️ Помилка при виконанні експорту.")

async def subscribe_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показати тарифи та посилання на оплату"""
    telegram_id = str(update.effective_user.id)
    try:
        # Fetch profiles to see which one to subscribe
        res = requests.get(f"{BACKEND_URL}/api/profiles?telegram_id={telegram_id}", timeout=5)
        if res.status_code == 200:
            profiles = res.json()
            if not profiles:
                await update.message.reply_text("⚠️ У вас немає зареєстрованих профілів. Будь ласка, спочатку створіть профіль.")
                return
            
            keyboard = []
            for p in profiles:
                try:
                    payload = {
                        "profile_id": p['id'],
                        "plan": "pro",
                        "success_url": "https://unitas-frontend.fly.dev/dashboard",
                        "cancel_url": "https://unitas-frontend.fly.dev/dashboard"
                    }
                    res_pro = requests.post(f"{BACKEND_URL}/api/subscriptions/create-checkout", params=payload, timeout=5)
                    url_pro = res_pro.json().get("checkout_url") if res_pro.status_code == 200 else None
                    
                    payload["plan"] = "business"
                    res_biz = requests.post(f"{BACKEND_URL}/api/subscriptions/create-checkout", params=payload, timeout=5)
                    url_biz = res_biz.json().get("checkout_url") if res_biz.status_code == 200 else None
                    
                    buttons = []
                    if url_pro:
                        buttons.append(InlineKeyboardButton(f"💰 Pro ({p['name']})", url=url_pro))
                    if url_biz:
                        buttons.append(InlineKeyboardButton(f"🏢 Business ({p['name']})", url=url_biz))
                    if buttons:
                        keyboard.append(buttons)
                except Exception as err:
                    logger.error(f"Error fetching checkout URL for profile {p['id']}: {err}")
            
            if not keyboard:
                await update.message.reply_text("⚠️ Не вдалося згенерувати посилання на оплату. Перевірте з'єднання з сервером.")
                return
                
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(
                "💎 *Платні тарифи UniTax*\n\n"
                "• *Pro* (299 грн/міс): безліміт транзакцій, всі звіти, синхронізація з банком\n"
                "• *Business* (899 грн/міс): Pro + працівники, API доступ, пріоритетна підтримка\n\n"
                "Оберіть тариф для оформлення підписки:",
                parse_mode="Markdown",
                reply_markup=reply_markup
            )
        else:
            await update.message.reply_text("⚠️ Не вдалося завантажити ваші профілі з сервера.")
    except Exception as e:
        logger.error(f"Error in subscribe_command: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def my_subscription_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Перевірити статус підписки"""
    telegram_id = str(update.effective_user.id)
    try:
        res_prof = requests.get(f"{BACKEND_URL}/api/profiles?telegram_id={telegram_id}", timeout=5)
        if res_prof.status_code == 200:
            profiles = res_prof.json()
            if not profiles:
                await update.message.reply_text("🆓 *Безкоштовний доступ*\n\nУ вас немає активних профілів. Демо-доступ діє 30 хвилин.")
                return
                
            text = "📋 *Статус підписок ваших підприємств:*\n\n"
            for p in profiles:
                res_sub = requests.get(f"{BACKEND_URL}/api/subscriptions/current/{p['id']}", timeout=5)
                if res_sub.status_code == 200:
                    sub = res_sub.json()
                    plan = sub.get("plan", "free").upper()
                    status = sub.get("status", "active")
                    expires = sub.get("expires_at")
                    
                    text += f"▪️ *{p['name']}*:\n"
                    if plan == "FREE":
                        text += f"   Тариф: `Безкоштовний` (Демо-режим)\n"
                    else:
                        text += f"   Тариф: *{plan}* ({status})\n"
                        if expires:
                            from datetime import datetime
                            try:
                                dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
                                text += f"   Діє до: {dt.strftime('%d.%m.%Y')}\n"
                            except Exception:
                                text += f"   Діє до: {expires}\n"
                    text += "\n"
            
            await update.message.reply_text(text, parse_mode="Markdown")
        else:
            await update.message.reply_text("⚠️ Не вдалося завантажити статус з бекенду.")
    except Exception as e:
        logger.error(f"Error in my_subscription_command: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_submit_by_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Початок підписання звіту за ID (вибір сертифіката КЕП)"""
    text = update.message.text
    try:
        report_id = int(text.split("_")[1])
    except (IndexError, ValueError):
        await update.message.reply_text("❌ Неправильний формат команди.")
        return
        
    try:
        # 1. Отримати деталі звіту
        res = requests.get(f"{BACKEND_URL}/api/reports/detail/{report_id}", timeout=5)
        if res.status_code != 200:
            await update.message.reply_text("❌ Звіт не знайдено.")
            return
            
        report = res.json()
        profile_id = report.get("profile_id")
        
        # 2. Отримати сертифікати КЕП для профілю
        res_certs = requests.get(f"{BACKEND_URL}/api/certificates/{profile_id}", timeout=5)
        certs = []
        if res_certs.status_code == 200:
            certs = res_certs.json()
            
        if not certs:
            await update.message.reply_text(
                f"⚠️ **У вас немає завантажених КЕП сертифікатів для цього профілю.**\n\n"
                f"Будь ласка, завантажте ваш КЕП у веб-кабінеті UniTax: /settings/certificates"
            )
            return
            
        keyboard = []
        for cert in certs:
            keyboard.append([
                InlineKeyboardButton(
                    f"🔑 {cert['cert_owner_name']} ({cert['cert_issuer']})",
                    callback_data=f"txsub_cert_{report_id}_{cert['id']}"
                )
            ])
            
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            f"✍️ **Відправка звіту {report.get('form_code')} ({report.get('period')} {report.get('year')} р.)**\n\n"
            f"Оберіть сертифікат для підпису та відправки до ДПС:",
            reply_markup=reply_markup
        )
    except Exception as e:
        logger.error(f"Error in handle_submit_by_id: {e}")
        await update.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

async def handle_submit_report_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка відправки звіту після вибору КЕП"""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split("_")
    report_id = int(parts[2])
    cert_id = int(parts[3])
    
    await query.edit_message_text("⏳ Підписуємо звіт та надсилаємо до ДПС...")
    
    try:
        payload = {"certificate_id": cert_id}
        res = requests.post(f"{BACKEND_URL}/api/reports/{report_id}/submit", json=payload, timeout=15)
        if res.status_code == 200:
            result = res.json()
            if result.get("success"):
                msg = (
                    f"✅ **Звіт успішно відправлено до ДПС!**\n\n"
                    f"Номер квитанції: `{result.get('confirmation_number')}`\n"
                    f"Повідомлення: {result.get('message', 'Прийнято до обробки')}"
                )
            else:
                msg = f"❌ **Помилка відправки:**\n{result.get('message', 'Невідома помилка')}"
        else:
            msg = f"⚠️ Помилка сервера: {res.text}"
            
        await query.edit_message_text(msg, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Error in handle_submit_report_callback: {e}")
        await query.edit_message_text("⚠️ Виникла помилка зв'язку з бекендом.")

async def handle_txsub_start_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обробка старту підписання з inline кнопки під звітом"""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split("_")
    report_id = int(parts[2])
    
    try:
        # 1. Отримати деталі звіту
        res = requests.get(f"{BACKEND_URL}/api/reports/detail/{report_id}", timeout=5)
        if res.status_code != 200:
            await query.message.reply_text("❌ Звіт не знайдено.")
            return
            
        report = res.json()
        profile_id = report.get("profile_id")
        
        # 2. Отримати сертифікати КЕП для профілю
        res_certs = requests.get(f"{BACKEND_URL}/api/certificates/{profile_id}", timeout=5)
        certs = []
        if res_certs.status_code == 200:
            certs = res_certs.json()
            
        if not certs:
            await query.message.reply_text(
                f"⚠️ **У вас немає завантажених КЕП сертифікатів для цього профілю.**\n\n"
                f"Будь ласка, завантажте ваш КЕП у веб-кабінеті UniTax: /settings/certificates"
            )
            return
            
        keyboard = []
        for cert in certs:
            keyboard.append([
                InlineKeyboardButton(
                    f"🔑 {cert['cert_owner_name']} ({cert['cert_issuer']})",
                    callback_data=f"txsub_cert_{report_id}_{cert['id']}"
                )
            ])
            
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.message.reply_text(
            f"✍️ **Відправка звіту {report.get('form_code')} ({report.get('period')} {report.get('year')} р.)**\n\n"
            f"Оберіть сертифікат для підпису та відправки до ДПС:",
            reply_markup=reply_markup
        )
    except Exception as e:
        logger.error(f"Error in handle_txsub_start_callback: {e}")
        await query.message.reply_text("⚠️ Помилка зв'язку з бекендом.")

def main() -> None:
    """Запуск бота."""
    if TOKEN == "MOCK_TOKEN_FOR_TESTS":
        print("[WARNING] TELEGRAM_BOT_TOKEN не задано. Бот запущено в демо-режимі логування.")
        return

    # Create the Application and pass it your bot's token.
    application = Application.builder().token(TOKEN).build()

    # Add conversation handler for registration
    conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler("start", start),
            MessageHandler(filters.Text(["⚙️ Налаштування"]), start)
        ],
        states={
            CHOOSING_TYPE: [CallbackQueryHandler(choose_type)],
            CHOOSING_GROUP: [CallbackQueryHandler(choose_group)],
            CHOOSING_VAT: [CallbackQueryHandler(choose_vat)],
            CHOOSING_EMPLOYEES: [CallbackQueryHandler(choose_employees)],
            ENTERING_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, enter_name)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,
    )

    vat_conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler("pdv", pdv_start),
            CommandHandler("pda", pdv_start)
        ],
        states={
            ENTERING_VAT_OUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, enter_vat_out)],
            ENTERING_VAT_IN: [MessageHandler(filters.TEXT & ~filters.COMMAND, enter_vat_in)],
        },
        fallbacks=[CommandHandler("cancel", cancel_vat)],
        allow_reentry=True,
    )

    add_profile_conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler("add_profile", add_profile_start),
            MessageHandler(filters.Text(["➕ Додати підприємство"]), add_profile_start)
        ],
        states={
            P_CHOOSING_TYPE: [CallbackQueryHandler(add_profile_type, pattern="^add_p_")],
            P_ENTERING_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_profile_name)],
            P_ENTERING_TAX_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_profile_tax_id)],
            P_CHOOSING_SYSTEM: [CallbackQueryHandler(add_profile_system, pattern="^sys_")],
            P_CHOOSING_DIRECTOR: [CallbackQueryHandler(add_profile_director, pattern="^dir_")],
        },
        fallbacks=[CommandHandler("cancel", cancel_profile)],
        allow_reentry=True,
    )

    add_employee_conv_handler = ConversationHandler(
        entry_points=[CommandHandler("add_employee", add_employee_start)],
        states={
            E_CHOOSING_PROFILE: [CallbackQueryHandler(add_employee_profile, pattern="^emp_prof_")],
            E_ENTERING_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_employee_name)],
            E_ENTERING_TAX_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_employee_tax_id)],
            E_ENTERING_SALARY: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_employee_salary)],
        },
        fallbacks=[CommandHandler("cancel", cancel_employee)],
        allow_reentry=True,
    )

    edit_salary_conv_handler = ConversationHandler(
        entry_points=[CommandHandler("edit_salary", edit_salary_start)],
        states={
            ES_CHOOSING_PROFILE: [CallbackQueryHandler(edit_salary_profile, pattern="^edit_sal_prof_")],
            ES_CHOOSING_EMPLOYEE: [CallbackQueryHandler(edit_salary_employee, pattern="^edit_sal_emp_")],
            ES_ENTERING_SALARY: [MessageHandler(filters.TEXT & ~filters.COMMAND, edit_salary_amount)],
        },
        fallbacks=[CommandHandler("cancel", cancel_edit_salary)],
        allow_reentry=True,
    )

    delete_employee_conv_handler = ConversationHandler(
        entry_points=[CommandHandler("delete_employee", delete_employee_start)],
        states={
            DE_CHOOSING_PROFILE: [CallbackQueryHandler(delete_employee_profile, pattern="^del_emp_prof_")],
            DE_CHOOSING_EMPLOYEE: [CallbackQueryHandler(delete_employee_confirm, pattern="^del_emp_emp_")],
        },
        fallbacks=[CommandHandler("cancel", cancel_delete_employee)],
        allow_reentry=True,
    )

    application.add_handler(conv_handler)
    application.add_handler(vat_conv_handler)
    application.add_handler(add_profile_conv_handler)
    application.add_handler(add_employee_conv_handler)
    application.add_handler(edit_salary_conv_handler)
    application.add_handler(delete_employee_conv_handler)
    application.add_handler(CommandHandler("mydata", mydata))
    application.add_handler(CommandHandler("status", status))
    application.add_handler(CommandHandler("upload", upload_prompt))
    application.add_handler(CommandHandler("alerts", alerts))
    application.add_handler(CommandHandler("report", generate_report_cmd))
    application.add_handler(CommandHandler("support", support))
    application.add_handler(CommandHandler("debug", debug))
    application.add_handler(CommandHandler("menu", menu))
    application.add_handler(CommandHandler("check_employees", check_employees_cmd))
    application.add_handler(CommandHandler("edit_transaction", edit_transaction_start))
    application.add_handler(CommandHandler("tax_analysis", tax_analysis_cmd))
    application.add_handler(CommandHandler("link", link_cmd))
    application.add_handler(CommandHandler("connect_gmail", connect_gmail))
    application.add_handler(CommandHandler("pay", pay_cmd))
    application.add_handler(CommandHandler("sign", sign_cmd))
    application.add_handler(CommandHandler("check_debt", check_debt_command))
    application.add_handler(CommandHandler("connect_tax_api", connect_tax_api_command))
    application.add_handler(CommandHandler("set_tax_token", set_tax_token_command))
    application.add_handler(CommandHandler("validate", validate_command))
    application.add_handler(CommandHandler("tax_news", tax_news_command))
    application.add_handler(CommandHandler("tax_subscribe", tax_subscribe_command))
    application.add_handler(CommandHandler("submit_report", submit_report_command))
    application.add_handler(CommandHandler("report_status", report_status_command))
    application.add_handler(CommandHandler("export", export_command))
    application.add_handler(CommandHandler("ai", ai_command))
    application.add_handler(CommandHandler("subscribe", subscribe_command))
    application.add_handler(CommandHandler("my_subscription", my_subscription_command))
    
    # Dynamic /submit_{id} command handler
    application.add_handler(MessageHandler(filters.Regex(r"^/submit_(\d+)$"), handle_submit_by_id))
    
    # Callback handlers
    application.add_handler(CallbackQueryHandler(handle_callback_download, pattern="^dl_"))
    application.add_handler(CallbackQueryHandler(handle_report_selection, pattern="^rep_"))
    application.add_handler(CallbackQueryHandler(handle_tx_profile_callback, pattern="^tx_edit_p_"))
    application.add_handler(CallbackQueryHandler(handle_tx_selection_callback, pattern="^tx_sel_"))
    application.add_handler(CallbackQueryHandler(handle_tx_toggle_taxable_callback, pattern="^tx_tog_"))
    application.add_handler(CallbackQueryHandler(handle_tx_change_type_callback, pattern="^tx_typ_"))
    application.add_handler(CallbackQueryHandler(handle_payment_callbacks, pattern="^pay_"))
    application.add_handler(CallbackQueryHandler(handle_signing_selection, pattern="^sig_sel_"))
    application.add_handler(CallbackQueryHandler(handle_signing_action, pattern="^sigmeth_"))
    application.add_handler(CallbackQueryHandler(handle_signing_check, pattern="^sigcheck_"))
    application.add_handler(CallbackQueryHandler(sign_cmd, pattern="^sig_back$"))
    application.add_handler(CallbackQueryHandler(handle_link_token_callback, pattern="^linktoken_p_"))
    application.add_handler(CallbackQueryHandler(handle_check_debt_callback, pattern="^checkdebt_p_"))
    application.add_handler(CallbackQueryHandler(handle_validate_callback, pattern="^valst_p_"))
    application.add_handler(CallbackQueryHandler(handle_tax_news_callback, pattern="^taxnews_p_"))
    application.add_handler(CallbackQueryHandler(handle_tax_subscribe_callback, pattern="^taxsub_p_"))
    application.add_handler(CallbackQueryHandler(handle_submit_report_profile_callback, pattern="^subrep_p_"))
    application.add_handler(CallbackQueryHandler(handle_report_status_profile_callback, pattern="^substat_p_"))
    application.add_handler(CallbackQueryHandler(handle_submit_report_callback, pattern="^txsub_cert_"))
    application.add_handler(CallbackQueryHandler(handle_txsub_start_callback, pattern="^txsub_start_"))
    application.add_handler(CallbackQueryHandler(handle_export_callback, pattern="^exp_"))
    application.add_handler(CallbackQueryHandler(handle_export_profile_callback, pattern="^exp_prof_"))

    # Handle menu buttons
    application.add_handler(MessageHandler(
        filters.Text([
            "📊 Дашборд", 
            "📁 Мої дані", 
            "📤 Завантажити виписку", 
            "📄 Звіти", 
            "👥 Працівники", 
            "➕ Додати підприємство",
            "📊 Податковий аналіз",
            "💵 Сплата податків",
            "📥 Експорт даних",
            "🔏 Підписати документи",
            "❓ Допомога"
        ]), 
        handle_menu_click
    ))

    # Handle files
    application.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    
    # Handle AI chat
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_ai_question))

    # Run the bot
    print(f"Бот запускається з BACKEND_URL: {BACKEND_URL}...")
    logger.info(f"Запуск з BACKEND_URL: {BACKEND_URL}")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
