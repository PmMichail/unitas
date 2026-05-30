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

def get_main_menu_keyboard():
    keyboard = [
        ["📊 Дашборд", "📁 Мої дані"],
        ["📤 Завантажити виписку", "📄 Звіти"],
        ["👥 Працівники", "⚙️ Налаштування"],
        ["🔔 Нагадування", "❓ Допомога"]
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
    return ConversationHandler.END

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
    """Отримання фінансового статусу компанії (Оплачено vs Має бути)."""
    telegram_id = str(update.effective_user.id)
    try:
        # Отримуємо ID компанії
        res_comp = requests.get(f"{BACKEND_URL}/api/companies/{telegram_id}", timeout=2)
        if res_comp.status_code == 200 and len(res_comp.json()) > 0:
            company_id = res_comp.json()[0]["id"]
            
            # Отримуємо статус дашборду
            res_dash = requests.get(f"{BACKEND_URL}/api/dashboard/{company_id}", timeout=3)
            if res_dash.status_code == 200:
                data = res_dash.json()
                
                # Текст статусу
                balance_mark = "🟢 Повністю сплачено" if data["balance_status"] == "paid" else "🔴 Маєте заборгованість"
                
                msg = (
                    f"📊 **Податковий статус за березень 2025:**\n\n"
                    f"💰 Отриманий дохід: **{data['total_income']:,.2f} UAH**\n"
                    f"⚖️ Податкове зобов'язання: **{data['tax_due']:,.2f} UAH**\n"
                    f"💸 Сплачено податків: **{data['tax_paid']:,.2f} UAH**\n"
                    f"📉 Різниця: **{data['difference']:,.2f} UAH** ({balance_mark})\n\n"
                    f"📅 **Найближчі дедлайни:**\n"
                )
                
                for ev in data["upcoming_events"][:3]:
                    type_icon = "📝 Звіт" if ev["type"] == "report" else "💵 Сплата"
                    status_icon = "✅" if ev["status"] == "paid" else "⏳"
                    msg += f"- {status_icon} {ev['due_date']} — {type_icon}: {ev['title']} ({ev['amount_desc']})\n"
                
                await update.message.reply_text(msg)
                return
        await update.message.reply_text("Будь ласка, спочатку зареєструйтеся через /start")
    except Exception as e:
        logger.error(f"Помилка отримання статусу: {e}")
        await update.message.reply_text(
            "⚠️ Не вдалося отримати фінансовий статус: Сервер бекенду зараз недоступний."
        )

async def upload_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Інструкція до завантаження виписки."""
    await update.message.reply_text(
        "📎 **Завантаження банківської виписки**\n\n"
        "Будь ласка, надішліть файл виписки (PDF, CSV, HTML) прямо у цей чат.\n\n"
        "Підтримувані банки:\n"
        "- monobank (CSV)\n"
        "- Приват24 (PDF)\n"
        "- А-Банк (PDF)\n"
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
    """Заглушка для працівників."""
    await update.message.reply_text(
        "👥 **Розділ 'Наймані працівники' знаходиться в розробці**\n\n"
        "У наступних оновленнях ви зможете додавати працівників, розраховувати їхні зарплатні податки (ПДФО, ВЗ, ЄСВ) та автоматично формувати Об'єднану звітність!"
    )

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
    elif text == "⚙️ Налаштування":
        await start(update, context)
    elif text == "🔔 Нагадування":
        await alerts(update, context)
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
    )

    application.add_handler(conv_handler)
    application.add_handler(vat_conv_handler)
    application.add_handler(CommandHandler("mydata", mydata))
    application.add_handler(CommandHandler("status", status))
    application.add_handler(CommandHandler("upload", upload_prompt))
    application.add_handler(CommandHandler("alerts", alerts))
    application.add_handler(CommandHandler("report", generate_report_cmd))
    application.add_handler(CommandHandler("support", support))
    application.add_handler(CommandHandler("menu", menu))
    
    # Callback handlers
    application.add_handler(CallbackQueryHandler(handle_callback_download, pattern="^dl_"))
    application.add_handler(CallbackQueryHandler(handle_report_selection, pattern="^rep_"))
    
    # Handle menu buttons
    application.add_handler(MessageHandler(
        filters.Text([
            "📊 Дашборд", 
            "📁 Мої дані", 
            "📤 Завантажити виписку", 
            "📄 Звіти", 
            "👥 Працівники", 
            "⚙️ Налаштування",
            "🔔 Нагадування",
            "❓ Допомога"
        ]), 
        handle_menu_click
    ))

    # Handle files
    application.add_handler(MessageHandler(filters.Document.ALL, handle_document))

    # Run the bot
    print(f"Бот запускається з BACKEND_URL: {BACKEND_URL}...")
    logger.info(f"Запуск з BACKEND_URL: {BACKEND_URL}")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
