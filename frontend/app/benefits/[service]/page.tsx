import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  ArrowLeft, 
  ArrowRight,
  Brain, 
  FileText, 
  Zap, 
  Shield, 
  Clock, 
  Lock, 
  Users, 
  Mail, 
  Award,
  Check,
  CheckCircle2,
  Database,
  Sparkles,
  Bell,
  Key
} from "lucide-react";

// Service structure definition
interface ServiceDetail {
  title: string;
  description: string;
  keywords: string;
  emoji: string;
  name: string;
  fullDesc: string;
  iconName: string;
  priorities: string[];
  howItWorks: string;
  forWhom: string;
}

// Database of services for SEO and rendering
const servicesData: Record<string, ServiceDetail> = {
  "ai-assistant": {
    title: "ШІ-асистент для податків — Податковий асистент UniTax",
    description: "Персональний податковий чат-бот на базі Gemini AI від UniTax. Миттєві відповіді на будь-які питання про податки, КВЕДи та законодавство України.",
    keywords: "податковий чат-бот, ШІ консультант, податки ФОП, КВЕД, законодавство України, штучний інтелект податки",
    emoji: "🧠",
    name: "ШІ-асистент та AI-консалтинг",
    iconName: "brain",
    fullDesc: "UniTax інтегрує найсучасніші технології штучного інтелекту для надання миттєвої податкової допомоги. Наш ШІ-асистент на базі Google Gemini навчений на актуальному податковому кодексі України та законах. Він здатен розшифровувати складні податкові норми, надавати точні алгоритми дій для ФОП і компаній, а також супроводжувати користувачів під час вирішення спірних питань з податковою службою.",
    priorities: [
      "Миттєві консультації 24/7 без потреби очікування відповіді живого бухгалтера.",
      "Аналіз ваших КВЕДів та рекомендації щодо вибору оптимальної групи оподаткування чи переходу на іншу систему.",
      "Розшифровка складних законодавчих формулювань простою і зрозумілою мовою для підприємців.",
      "Допомога у розрахунку лімітів доходу та попередження ризиків перевищення допустимих обсягів."
    ],
    howItWorks: "Ви формулюєте питання звичайною мовою у спеціальному чат-вікні (наприклад: 'Які ліміти доходу для ФОП 3 групи у 2026 році?'). ШІ-асистент миттєво проводить пошук по оновленій базі законів України, аналізує ваш профіль та формує детальну відповідь зі структурованими інструкціями.",
    forWhom: "Для підприємців-початківців, які ще не орієнтуються у тонкощах податкового обліку, та для досвідчених бізнесменів і бухгалтерів як швидкий інструмент перевірки законодавчих норм."
  },
  "auto-reports": {
    title: "Автоматичні податкові звіти та декларації — UniTax",
    description: "Формуйте та перевіряйте податкові декларації, звіти ЄСВ та платіжні документи за лічені секунди. Пряма відправка до ДПС без помилок.",
    keywords: "автоматичні звіти, декларація фоп, звіт єсв, податкова звітність, здати звіт онлайн, кабінет платника",
    emoji: "📄",
    name: "Автоматичні звіти та декларації",
    iconName: "file-text",
    fullDesc: "Забудьте про ручне заповнення паперових бланків або складні заплутані форми в кабінеті платника податків. UniTax самостійно аналізує доходи на основі підключених банківських виписок, розраховує суму податкових зобов'язань і формує готову декларацію єдиного податку чи звіт ЄСВ. Система автоматично перевіряє документ на логічні помилки перед підписанням.",
    priorities: [
      "Формування декларації єдиного податку ФОП 1-3 груп усього за один клік.",
      "Автоматичний точний розрахунок сум єдиного податку та ЄСВ з урахуванням діючих пільг.",
      "Глибока валідація звітів на помилки, відсутні реквізити чи некоректні періоди.",
      "Миттєве збереження квитанцій №1 та №2 від ДПС безпосередньо у вашому кабінеті."
    ],
    howItWorks: "В кінці кварталу система збирає всі транзакції, що класифіковані як дохід, заповнює відповідні поля звіту, накладає ваш ЕЦП/КЕП локально у браузері без передачі паролів на сервер та надсилає звіт безпосередньо на шлюз Державної податкової служби.",
    forWhom: "ФОП будь-якої групи, які хочуть вести облік самостійно, здавати звіти вчасно без остраху зробити помилку та економити гроші на послугах бухгалтерів."
  },
  "osbb": {
    title: "Автоматизація ОСББ: облік внесків та платежів — UniTax",
    description: "Сучасна система управління для ОСББ. Автоматичний облік внесків, формування квитанцій, розподіл платежів, прозорі фінансові реєстри та опитування мешканців.",
    keywords: "осбб автоматизація, облік внесків осбб, квитанції осбб, програма для осбб, кабінет мешканця осбб, платежі осбб",
    emoji: "🏢",
    name: "Рішення для ОСББ (Об'єднання співвласників)",
    iconName: "users",
    fullDesc: "UniTax пропонує комплексний модуль автоматизації для об'єднань співвласників багатоквартирних будинків (ОСББ). Система вирішує ключові болі: ручна рознесення платежів мешканців, затримки з виставленням квитанцій, відсутність зручного кабінету для мешканців та складнощі у проведенні зборів та голосувань.",
    priorities: [
      "Автоматичний імпорт банківських виписок з розпізнаванням призначень платежів (номери квартир чи особових рахунків) та автоматичним закриттям боргів.",
      "Миттєва генерація PDF-квитанцій на утримання будинку та прибудинкової території, ремонтний фонд, опалення, воду та інші послуги.",
      "Зручний кабінет для кожного мешканця з історією нарахувань, оплат та можливістю сплатити карткою в один клік.",
      "Модуль проведення опитувань та електронного голосування мешканців відповідно до законодавства України."
    ],
    howItWorks: "Голова правління імпортує список квартир, власників та налаштовує тарифи. Щомісяця система генерує нарахування. Мешканці отримують квитанції на email або у месенджер та оплачують їх. Завдяки API інтеграції з банком оплати автоматично фіксуються на балансі квартири.",
    forWhom: "Голови правління ОСББ, члени правління, управителі багатоквартирних будинків та житлових комплексів, які прагнуть навести лад у фінансах та підвищити збори платежів."
  },
  "st": {
    title: "Рішення для Садівничих Товариств (СТ): облік та комунальні — UniTax",
    description: "Автоматизація обліку для садівничих товариств, дачних кооперативів та котеджних містечок. Точний облік електроенергії, води та членських внесків.",
    keywords: "садівниче товариство облік, дачний кооператив програма, облік електроенергії ст, членські внески садівництво",
    emoji: "🏡",
    name: "Рішення для Садівничих Товариств (СТ)",
    iconName: "zap",
    fullDesc: "Унікальний спеціалізований інструмент для садівничих, дачних товариств, кооперативів та котеджних містечок. Модуль дозволяє легко вирішити проблеми обліку спожитої електроенергії (у тому числі двозонних лічильників 'день/ніч'), води, вивезення сміття та нарахування щорічних або щомісячних членських внесків на розвиток інфраструктури.",
    priorities: [
      "Зручне та швидке внесення поточних показників індивідуальних лічильників дачників через інтерфейс або Telegram-бот.",
      "Автоматичний розрахунок вартості комунальних послуг згідно із внутрішніми тарифами товариства та лімітами втрат мережі.",
      "Облік та нарахування цільових внесків (ремонт доріг, приватизація, охорона) у розрізі ділянок.",
      "Створення прозорої фінансової картини для загальних зборів кооперативу з публікацією кошторисів та звітів."
    ],
    howItWorks: "Голова або казначей вносить тарифи на енергоносії та членські внески. Дачники надсилають показники лічильників. Система автоматично формує рахунок за світло/воду та внески, відправляє його мешканцю і дозволяє сплатити онлайн. Казначей бачить повний реєстр боржників у реальному часі.",
    forWhom: "Голови правління садівничих некомерційних товариств (СНТ/СТ), дачних кооперативів, котеджних містечок, казначеї та ревізійні комісії."
  },
  "auto-mail": {
    title: "Автоматична розсилка пошти та квитанцій — UniTax",
    description: "Автоматизуйте комунікацію з клієнтами чи мешканцями. Відправка рахунків, квитанцій про оплату та нагадувань на email та у месенджери.",
    keywords: "автоматична розсилка квитанцій, відправка рахунків email, сповіщення про борг, автоматичні повідомлення",
    emoji: "✉️",
    name: "Автоматична відправка пошти та повідомлень",
    iconName: "mail",
    fullDesc: "Більше немає потреби надсилати кожен рахунок чи квитанцію вручну. Модуль розсилки UniTax повністю автоматизує комунікацію з вашими клієнтами, мешканцями ОСББ чи членами кооперативів. Сервіс дбає про те, щоб фінансові документи доставлялися вчасно, а дружні нагадування допомагали уникати протермінувань платежів.",
    priorities: [
      "Автоматична генерація PDF-рахунків та розсилка на підтверджені email-адреси мешканців одразу після проведення нарахувань.",
      "Відправка електронних чеків та підтверджень про отримання оплати (квитанцій) на пошту або в Telegram-бот.",
      "Налаштування ланцюжків нагадувань про наявність заборгованості за ККД (корисним коефіцієнтом дії) доставки листів.",
      "Повна статистика доставлення, відкриття листів та завантажень вкладених файлів."
    ],
    howItWorks: "Після генерації періодичних платежів або створення рахунку-фактури система автоматично створює лист із персоналізованим текстом, вкладає згенеровану PDF-квитанцію та надсилає через надійні поштові шлюзи з високою репутацією, гарантуючи потрапляння листів у 'Вхідні'.",
    forWhom: "Голови ОСББ, кооперативів, компанії з надання періодичних послуг (оренда, інтернет, навчання), що працюють з регулярними платежами."
  },
  "accountants": {
    title: "Кабінет професійного бухгалтера — UniTax",
    description: "Професійні інструменти для бухгалтерів та аутсорсингових компаній. Ведення багатьох клієнтів (ФОП, ТОВ) в одному вікні з авто-звіркою.",
    keywords: "кабінет бухгалтера, ведення фоп програма, програма для бухгалтерів, аутсорсинг бухгалтерії, пакетна звітність",
    emoji: "💼",
    name: "Інструменти для професійних бухгалтерів",
    iconName: "award",
    fullDesc: "Спеціально спроектований багатокористувацький кабінет для бухгалтерів-аутсорсерів та консалтингових фірм. UniTax дозволяє легко підключити десятки кабінетів ваших клієнтів (як ФОП, так і юридичних осіб ТОВ) до єдиної панелі управління. Ви зможете вести повноцінний облік, контролювати ліміти та здавати звіти без потреби постійно виходити та заходити під різними ключами КЕП.",
    priorities: [
      "Мульти-профільний дашборд: бачте критичні дедлайни, суми до сплати та статуси звітів по всіх клієнтах на одному екрані.",
      "Пакетний імпорт банківських виписок для всіх підключених компаній одночасно в один клік.",
      "Масова генерація звітів, декларацій та автоматична перевірка реквізитів.",
      "Автоматична щоденна звірка стану рахунків клієнтів із базою ДПС для виявлення неочікуваних штрафів або недоїмок."
    ],
    howItWorks: "Бухгалтер додає профілі клієнтів у свій кабінет. Система агрегує дані про транзакції, терміни та податкові борги. Перед відправкою звітів бухгалтер завантажує ключ КЕП відповідного ФОП та підписує документ локально.",
    forWhom: "Аутсорсингові бухгалтерські фірми, приватні бухгалтери, аудитори та фінансові консультанти, які ведуть облік кількох підприємств."
  },
  "bank-integration": {
    title: "Автоматична інтеграція з українськими банками — UniTax",
    description: "Безпечне підключення ПриватБанку, Monobank, А-Банку, ПУМБ, Укргазбанку. Автоматичний імпорт транзакцій та розрахунок податків.",
    keywords: "інтеграція з банками, монобанк апі, приват24 імпорт, виписка банку автоматично, банківська синхронізація",
    emoji: "⚡",
    name: "Інтеграція з українськими банками",
    iconName: "zap",
    fullDesc: "UniTax забезпечує повну автоматизацію збору фінансових даних завдяки офіційній інтеграції з провідними українськими банками. Більше немає потреби щоразу вручну завантажувати файли виписок CSV чи PDF та імпортувати їх у програму — система сама отримує інформацію про транзакції.",
    priorities: [
      "Офіційні API-підключення для Monobank (в т.ч. FOP), ПриватБанк (Приват24 для бізнесу), А-Банк, ПУМБ та Укргазбанк.",
      "Безпечна синхронізація: авторизація відбувається за офіційними токенами доступу без передачі паролів чи логінів.",
      "Автоматична класифікація доходів та витрат на основі аналізу категорій та призначення платежів.",
      "Оновлення фінансових даних у фоновому режимі без вашої безпосередньої участі."
    ],
    howItWorks: "Ви один раз додаєте банківську інтеграцію в налаштуваннях профілю за допомогою токену або QR-коду. Сервер UniTax періодично робить запит до банку та безпечно завантажує нові транзакції, миттєво оновлюючи податкові розрахунки.",
    forWhom: "Підприємці та бухгалтери, які бажають бачити актуальний фінансовий стан у режимі реального часу та економити час на рутинних імпортах."
  },
  "dps-integration": {
    title: "Пряма інтеграція з ДПС України — UniTax",
    description: "З'єднання з сервісами Державної податкової служби. Перевірка податкового боргу, стану рахунків та реєстрація документів через API.",
    keywords: "інтеграція дпс, кабінет платника податків апі, стан розрахунків дпс, податковий борг перевірка",
    emoji: "🔒",
    name: "Пряме підключення до сервісів ДПС",
    iconName: "lock",
    fullDesc: "Завдяки глибокій інтеграції з електронними сервісами Державної податкової служби (ДПС) України, UniTax надає користувачам можливість отримувати актуальну інформацію безпосередньо з офіційних баз даних. Це дозволяє уникнути сюрпризів у вигляді накопичених пеней або блокування рахунків.",
    priorities: [
      "Швидка перевірка стану розрахунків з бюджетом та наявності податкового боргу чи переплат.",
      "Контроль залишків на єдиному податковому рахунку та ПДВ-рахунках.",
      "Миттєве відправлення сформованих декларацій безпосередньо на шлюз ДПС для реєстрації.",
      "Повна безпека: ключі КЕП зчитуються та використовуються виключно локально в браузері."
    ],
    howItWorks: "При переході на вкладку інтеграції з ДПС або при автоматичній перевірці, система робить запит за допомогою сертифікатів КЕП клієнта, зчитує актуальний стан розрахунків по картках платника податків та виводить структурований звіт.",
    forWhom: "Підприємці та власники компаній, які хочуть тримати під повним контролем свої взаєморозрахунки з бюджетом та спати спокійно."
  },
  "deadlines": {
    title: "Нагадування про податкові дедлайни у Telegram — UniTax",
    description: "Проактивний календар та Telegram-бот для нагадувань про терміни здачі звітів та сплати податків. Захист від штрафів.",
    keywords: "календар фоп, податкові дедлайни, нагадування телеграм, бот податковий, терміни сплати податків",
    emoji: "⏰",
    name: "Нагадування про дедлайни та податковий календар",
    iconName: "clock",
    fullDesc: "Забудьте про необхідність вручну відслідковувати дати подання звітів або сплати податків. Наш інтелектуальний податковий календар автоматично адаптується під вибрану групу оподаткування ФОП чи форму власності ТОВ і проактивно нагадує про важливі події через Telegram-бота.",
    priorities: [
      "Персональні інтерактивні сповіщення у вашому Telegram про терміни подання звітів.",
      "Повідомлення заздалегідь: нагадування за 5 днів, 3 дні та в останній день дедлайну.",
      "Автоматичний підрахунок суми єдиного податку чи ЄСВ до сплати безпосередньо у тексті сповіщення.",
      "Можливість миттєвої сплати податків або подання декларації прямо з чату месенджера."
    ],
    howItWorks: "Ви прив'язуєте свій Telegram-аккаунт до UniTax. Коли настає час сплати податків, бот розраховує точну суму на основі ваших доходів і надсилає повідомлення з кнопкою оплати Mono Pay або реквізитами.",
    forWhom: "Для активних підприємців, які цінують свій спокій і не бажають платити штрафи через випадково забутий звіт."
  },
  "security": {
    title: "Безпека та конфіденційність банківського рівня — UniTax",
    description: "Надійний захист ваших фінансових та персональних даних. Шифрування SSL/AES-256, резервне копіювання та локальне підписання КЕП.",
    keywords: "безпека даних, шифрування даних, збереження кеп, конфіденційність фінансів, хмарна бухгалтерія безпека",
    emoji: "🛡️",
    name: "Безпека та захист фінансових даних",
    iconName: "shield",
    fullDesc: "Безпека даних та конфіденційність вашого бізнесу — це наш головний пріоритет. Платформа UniTax побудована з використанням найсучасніших криптографічних протоколів та повністю відповідає вимогам законодавства України щодо захисту персональних даних та конфіденційної інформації.",
    priorities: [
      "Шифрування всіх переданих даних за допомогою протоколу SSL та зберігання фінансової інформації у зашифрованому вигляді AES-256.",
      "Локальна робота з КЕП: зчитування ключів, генерація підписів відбувається виключно у вашому браузері. Ми ніколи не зберігаємо ваші паролі на серверах.",
      "Щоденне автоматичне резервне копіювання (backups) інформації у розподілені хмарні сховища для запобігання втратам.",
      "Підтримка двофакторної автентифікації для входу в особистий кабінет користувача."
    ],
    howItWorks: "Коли ви завантажуєте ключ КЕП, JS-бібліотека у вашому браузері розшифровує його за допомогою вашого паролю, підписує хеш декларації та відправляє підписаний пакет на наш сервер для подальшої ретрансляції в ДПС. Пароль та приватний ключ залишаються у вас.",
    forWhom: "Всі підприємці, управителі ОСББ та бухгалтери, які цінують безпеку своєї фінансової звітності та персональних даних клієнтів/мешканців."
  },
  "tax-calendar": {
    title: "Податковий календар ФОП 2026: терміни подачі та сплати — UniTax",
    description: "Персональний податковий календар для ФОП 1, 2, 3 груп та компаній. Своєчасні нагадування про звіти, розрахунок сум податків та швидка сплата.",
    keywords: "податковий календар, календар фоп 2026, сплатити податки фоп, терміни подання декларації, календар бухгалтера",
    emoji: "📅",
    name: "Індивідуальний податковий календар",
    iconName: "clock",
    fullDesc: "UniTax інтегрує автоматизований розумний календар платника податків. Більше не потрібно вручну шукати дати дедлайнів на сайтах ДПС чи у календарях бухгалтерів. Наш календар автоматично синхронізується з вашою групою оподаткування та системою обліку доходів, формуючи чіткі терміни для подання декларацій та сплати податків.",
    priorities: [
      "Автоматичне формування розкладу дедлайнів під вашу групу ФОП (1, 2, 3) або ТОВ.",
      "Миттєве бачення сум податків до сплати на основі реальних доходів з виписок.",
      "Нагадування в Telegram та пошту за 5, 3 та 1 день до завершення терміну.",
      "Швидка сплата податків за реквізитами безпосередньо з інтерфейсу календаря."
    ],
    howItWorks: "Система зчитує ваші КВЕДи та групу ФОП, будує календар податкових подій на рік, розраховує суми ЄСВ та єдиного податку за поточний період та надсилає повідомлення про наближення дедлайнів.",
    forWhom: "Для всіх підприємців та бухгалтерів, які цінують свій час та прагнуть убезпечити бізнес від штрафів та пені через прострочення."
  },
  "electronic-documents": {
    title: "Електронний документообіг: підпис КЕП онлайн — UniTax",
    description: "Зручний онлайн документообіг для бізнесу. Створення, підписання КЕП (ЕЦП) та обмін договорами, актами, рахунками з контрагентами в один клік.",
    keywords: "електронний документообіг, підписати кеп онлайн, обмін документами, акти онлайн, договір едо, підпис документів",
    emoji: "📁",
    name: "Електронний документообіг та підпис КЕП",
    iconName: "file-text",
    fullDesc: "UniTax містить повноцінний вбудований модуль ЕДО (електронного документообігу). Створюйте рахунки-фактури, акти виконаних робіт, договори та додатки за готовими шаблонами. Накладайте будь-які ключі КЕП/ЕЦП безпосередньо у браузері та миттєво відправляйте контрагентам для двостороннього підписання.",
    priorities: [
      "Підписання документів за секунди без встановлення сторонніх програм чи розширень.",
      "Створення фінансових та юридичних документів за перевіреними шаблонами.",
      "Миттєвий обмін посиланням на документ через месенджери або пошту.",
      "Зберігання всієї первинної документації у захищеному хмарному архіві з пошуком."
    ],
    howItWorks: "Ви завантажуєте PDF або створюєте документ за шаблоном, підписуєте його своїм КЕП, після чого система генерує унікальне захищене посилання для вашого контрагента. Він переходить за посиланням, перевіряє документ та підписує його своїм КЕП.",
    forWhom: "Для ФОП, малого та середнього бізнесу, компаній сфери послуг та ІТ, яким важливо швидко та легально оформлювати угоди та оплатні звіти."
  }
};

// Map icons dynamic names to components
const IconMap = (name: string, className: string) => {
  const props = { className };
  switch (name) {
    case "brain": return <Brain {...props} />;
    case "file-text": return <FileText {...props} />;
    case "zap": return <Zap {...props} />;
    case "shield": return <Shield {...props} />;
    case "clock": return <Clock {...props} />;
    case "lock": return <Lock {...props} />;
    case "users": return <Users {...props} />;
    case "mail": return <Mail {...props} />;
    case "award": return <Award {...props} />;
    default: return <Sparkles {...props} />;
  }
};

// Generate static routes during build time for SEO efficiency
export async function generateStaticParams() {
  return Object.keys(servicesData).map((key) => ({
    service: key,
  }));
}

// Generate dynamic metadata for Googlebot
export async function generateMetadata({ params }: { params: { service: string } }): Promise<Metadata> {
  const serviceKey = params.service;
  const data = servicesData[serviceKey];

  if (!data) {
    return {
      title: "Послуга не знайдена — UniTax",
      description: "Запитувана сторінка не знайдена на порталі UniTax."
    };
  }

  return {
    title: data.title,
    description: data.description,
    keywords: data.keywords,
    robots: "index, follow",
    openGraph: {
      title: data.title,
      description: data.description,
      type: "website",
      url: `https://www.unitax.pro/benefits/${serviceKey}`,
    }
  };
}

export default function ServiceDetailPage({ params }: { params: { service: string } }) {
  const data = servicesData[params.service];

  if (!data) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/60 via-slate-50 to-white dark:from-[#0f152d] dark:via-[#070a13] dark:to-[#03050a] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300 relative overflow-x-hidden">
      
      {/* Background glow animations */}
      <div className="absolute top-0 left-1/4 w-[40%] h-[40%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[40%] h-[40%] rounded-full bg-amber-500/3 dark:bg-amber-500/5 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-white/5 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/benefits" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="font-extrabold text-white text-lg">U</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-indigo-300 bg-clip-text text-transparent">
                UniTax
              </h1>
              <p className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold uppercase tracking-wider">
                Податковий Асистент
              </p>
            </div>
          </Link>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <Link
              href="/register"
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-400 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-650/15"
            >
              Спробувати безкоштовно
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 relative z-10 flex items-center justify-center">
        
        <div className="modal-cube-container w-full min-h-[620px] my-4">
          {/* 16 Cube parts for 4x4 grid 3D assembly animation */}
          <div className="cube-block cube-pos-1" style={{ "--delay": "0.02s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-2" style={{ "--delay": "0.04s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-3" style={{ "--delay": "0.06s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-4" style={{ "--delay": "0.08s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-5" style={{ "--delay": "0.10s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-6" style={{ "--delay": "0.12s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-7" style={{ "--delay": "0.14s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-8" style={{ "--delay": "0.16s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-9" style={{ "--delay": "0.18s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-10" style={{ "--delay": "0.20s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-11" style={{ "--delay": "0.22s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-12" style={{ "--delay": "0.24s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-13" style={{ "--delay": "0.26s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-14" style={{ "--delay": "0.28s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-15" style={{ "--delay": "0.30s" } as React.CSSProperties} />
          <div className="cube-block cube-pos-16" style={{ "--delay": "0.32s" } as React.CSSProperties} />

          {/* Modal Content Box */}
          <div className="modal-content-box p-6 sm:p-10 bg-slate-50 dark:bg-slate-900 border-2 border-amber-500 text-slate-800 dark:text-slate-100 flex flex-col justify-between space-y-8 text-left">
            
            {/* Navigation Breadcrumb */}
            <div>
              <Link 
                href="/benefits" 
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-650 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>Назад до всіх переваг</span>
              </Link>
            </div>

            {/* Header section inside box */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-200 dark:border-white/5">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 dark:border-indigo-500/30 rounded-2xl flex items-center justify-center text-3xl shadow-inner shrink-0">
                {data.emoji}
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">
                  Переваги UniTax
                </span>
                <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-slate-900 via-slate-700 to-indigo-650 dark:from-white dark:via-slate-200 dark:to-indigo-300 bg-clip-text text-transparent leading-tight">
                  {data.name}
                </h2>
              </div>
            </div>

            {/* Main Desc */}
            <p className="text-slate-650 dark:text-slate-300 text-sm sm:text-base leading-relaxed font-medium">
              {data.fullDesc}
            </p>

            {/* Detail Priorities & Working Process */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Priorities card */}
              <div className="p-6 rounded-3xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Award className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Основні пріоритети системи</span>
                </h3>
                <ul className="space-y-3">
                  {data.priorities.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      <div className="w-4 h-4 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Details flow card */}
              <div className="p-6 rounded-3xl border border-slate-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] space-y-6 shadow-sm">
                
                {/* How it works */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Як це працює:</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {data.howItWorks}
                  </p>
                </div>

                {/* Who is it for */}
                <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-white/5">
                  <h3 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider">Для кого підходить:</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    {data.forWhom}
                  </p>
                </div>

              </div>

            </div>

            {/* CTA section */}
            <div className="relative rounded-3xl border border-indigo-500/10 bg-gradient-to-tr from-indigo-50/20 via-purple-50/10 to-slate-50/30 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-slate-950/30 p-6 sm:p-10 text-center shadow-md">
              <div className="relative max-w-xl mx-auto space-y-5">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Автоматизуйте свій бізнес з UniTax вже сьогодні
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                  Реєстрація займає менше хвилини. Отримайте повний доступ до всіх можливостей системи безкоштовно протягом перших 7 днів.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/register"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-400 hover:to-indigo-550 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-650/10"
                  >
                    <span>Зареєструватися</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/benefits"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 dark:border-white/10 bg-slate-100/50 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 rounded-xl font-semibold text-xs text-slate-700 dark:text-slate-300 transition-all"
                  >
                    Всі переваги
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-white/5 py-8 mt-12 bg-slate-50 dark:bg-slate-950/30">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          <p>&copy; 2026 UniTax — Податковий помічник нового покоління. Всі права захищені.</p>
        </div>
      </footer>
    </div>
  );
}
