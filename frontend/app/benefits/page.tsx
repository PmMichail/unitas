"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { LiqPayFooter } from "@/components/LiqPayFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  Shield, 
  Zap, 
  Clock, 
  Brain, 
  FileText, 
  Lock,
  ArrowRight,
  CheckCircle,
  Send,
  LogIn,
  Users,
  Mail,
  Award,
  Calendar,
  FolderOpen
} from "lucide-react";

// Local dictionary of services for instant modal view
const servicesDetailMap: Record<string, {
  title: string;
  emoji: string;
  fullDesc: string;
  priorities: string[];
  howItWorks: string;
}> = {
  "ai-assistant": {
    title: "ШІ-асистент та AI-консалтинг",
    emoji: "🧠",
    fullDesc: "Наш ШІ-асистент на базі Google Gemini навчений на актуальному податковому кодексі України та законах. Він здатен розшифровувати складні податкові норми, надавати точні алгоритми дій для ФОП і компаній, а також супроводжувати користувачів.",
    priorities: [
      "Миттєві консультації 24/7 без потреби очікування відповіді бухгалтера.",
      "Аналіз ваших КВЕДів та рекомендації щодо вибору оптимальної групи оподаткування.",
      "Розшифровка складних законодавчих формулювань простою і зрозумілою мовою.",
      "Допомога у розрахунку лімітів доходу та попередження ризиків перевищення."
    ],
    howItWorks: "Ви формулюєте питання звичайною мовою у спеціальному чат-вікні (наприклад: 'Які ліміти доходу для ФОП 3 групи у 2026 році?'). ШІ-асистент миттєво проводить пошук по оновленій базі законів України."
  },
  "auto-reports": {
    title: "Автоматичні звіти та декларації",
    emoji: "📄",
    fullDesc: "UniTax самостійно аналізує доходи на основі підключених банківських виписок, розраховує суму податкових зобов'язань і формує готову декларацію єдиного податку чи звіт ЄСВ. Система автоматично перевіряє документ на логічні помилки перед підписанням.",
    priorities: [
      "Формування декларації єдиного податку ФОП 1-3 груп усього за один клік.",
      "Автоматичний точний розрахунок сум єдиного податку та ЄСВ з урахуванням діючих пільг.",
      "Глибока валідація звітів на помилки, відсутні реквізити чи некоректні періоди.",
      "Миттєве збереження квитанцій №1 та №2 від ДПС безпосередньо у вашому кабінеті."
    ],
    howItWorks: "В кінці кварталу система збирає всі транзакції, що класифіковані як дохід, заповнює відповідні поля звіту, накладає ваш ЕЦП/КЕП локально у браузері та надсилає звіт безпосередньо на шлюз ДПС."
  },
  "osbb": {
    title: "Рішення для ОСББ (Об'єднання співвласників)",
    emoji: "🏢",
    fullDesc: "Комплексний модуль автоматизації для об'єднань співвласників багатоквартирних будинків (ОСББ). Система вирішує ключові болі: ручна рознесення платежів мешканців, затримки з виставленням квитанцій, відсутність зручного кабінету для мешканців.",
    priorities: [
      "Автоматичний імпорт банківських виписок з розпізнаванням призначень платежів.",
      "Миттєва генерація PDF-квитанцій на утримання будинку та ремонтний фонд.",
      "Зручний кабінет для кожного мешканця з історією нарахувань та оплатою в один клік.",
      "Модуль проведення опитувань та електронного голосування мешканців відповідно до закону."
    ],
    howItWorks: "Голова правління імпортує список квартир та налаштовує тарифи. Мешканці отримують квитанції на email та оплачують їх. Завдяки API інтеграції оплати автоматично фіксуються на балансі квартири."
  },
  "st": {
    title: "Рішення для Садівничих Товариств (СТ)",
    emoji: "🏡",
    fullDesc: "Унікальний спеціалізований інструмент для садівничих, дачних товариств, кооперативів та котеджних містечок. Модуль дозволяє легко вирішити проблеми обліку спожитої електроенергії (у тому числі двозонних лічильників 'день/ніч'), води, та членських внесків.",
    priorities: [
      "Зручне та швидке внесення поточних показників індивідуальних лічильників дачників.",
      "Автоматичний розрахунок вартості комунальних послуг згідно із внутрішніми тарифами.",
      "Облік та нарахування цільових внесків у розрізі ділянок.",
      "Створення прозорої фінансової картини для загальних зборів кооперативу."
    ],
    howItWorks: "Дачники надсилають показники лічильників. Система автоматично формує рахунок за світло/воду та внески, відправляє його мешканцю і дозволяє сплатити онлайн. Казначей бачить повний реєстр боржників."
  },
  "auto-mail": {
    title: "Автоматична відправка пошти та повідомлень",
    emoji: "✉️",
    fullDesc: "Модуль розсилки UniTax повністю автоматизує комунікацію з вашими клієнтами, мешканцями ОСББ чи членами кооперативів. Сервіс дбає про те, щоб фінансові документи доставлялися вчасно, а дружні нагадування допомагали уникати заборгованостей.",
    priorities: [
      "Автоматична генерація PDF-рахунків та розсилка на підтверджені email-адреси.",
      "Відправка електронних чеків та підтверджень про отримання оплати (квитанцій).",
      "Налаштування ланцюжків нагадувань про наявність заборгованості.",
      "Повна статистика доставлення, відкриття листів та завантажень вкладених файлів."
    ],
    howItWorks: "Після генерації періодичних платежів або створення рахунку-фактури система автоматично створює лист із персоналізованим текстом, вкладає згенеровану PDF-квитанцію та надсилає її платнику."
  },
  "accountants": {
    title: "Інструменти для професійних бухгалтерів",
    emoji: "💼",
    fullDesc: "Спеціально спроектований багатокористувацький кабінет для бухгалтерів-аутсорсерів та консалтингових фірм. UniTax дозволяє легко підключити десятки кабінетів ваших клієнтів (як ФОП, так і юридичних осіб ТОВ) до єдиної панелі управління.",
    priorities: [
      "Мульти-профільний дашборд: бачте дедлайни, суми до сплати та статуси звітів по всіх клієнтах.",
      "Пакетний імпорт виписок з різних банків для всіх компаній в один клік.",
      "Масова генерація звітів, декларацій та автоматична перевірка реквізитів.",
      "Автоматична щоденна звірка стану рахунків клієнтів із базою ДПС."
    ],
    howItWorks: "Бухгалтер додає профілі клієнтів. Система агрегує дані про транзакції, терміни та податкові борги. Перед відправкою звітів бухгалтер підписує документ ключем КЕП відповідного профілю."
  },
  "tax-calendar": {
    title: "Індивідуальний податковий календар",
    emoji: "📅",
    fullDesc: "UniTax інтегрує автоматизований розумний календар платника податків. Наш календар автоматично синхронізується з вашою групою оподаткування та системою обліку доходів, формуючи чіткі терміни для подання декларацій та сплати податків.",
    priorities: [
      "Автоматичне формування розкладу дедлайнів під вашу групу ФОП (1, 2, 3) або ТОВ.",
      "Миттєве бачення сум податків до сплати на основі реальних доходів з виписок.",
      "Нагадування в Telegram та пошту за 5, 3 та 1 день до завершення терміну.",
      "Швидка сплата податків за реквізитами безпосередньо з інтерфейсу календаря."
    ],
    howItWorks: "Система зчитує ваші КВЕДи та групу ФОП, будує календар податкових подій на рік, розраховує суми ЄСВ та єдиного податку за поточний період та надсилає повідомлення про наближення дедлайнів."
  },
  "electronic-documents": {
    title: "Електронний документообіг та підпис КЕП",
    emoji: "📁",
    fullDesc: "UniTax містить повноцінний вбудований модуль ЕДО (електронного документообігу). Створюйте рахунки-фактури, акти виконаних робіт, договори та додатки за готовими шаблонами. Накладайте будь-які ключі КЕП/ЕЦП безпосередньо у браузері.",
    priorities: [
      "Підписання документів за секунди без встановлення сторонніх програм чи розширень.",
      "Створення фінансових та юридичних документів за перевіреними шаблонами.",
      "Миттєвий обмін посиланням на документ через месенджери або пошту.",
      "Зберігання всієї первинної документації у захищеному хмарному архіві з пошуком."
    ],
    howItWorks: "Ви завантажуєте PDF або створюєте документ за шаблоном, підписуєте його своїм КЕП, після чого система генерує унікальне захищене посилання для вашого контрагента."
  },
  "bank-integration": {
    title: "Інтеграція з українськими банками",
    emoji: "⚡",
    fullDesc: "UniTax забезпечує повну автоматизацію збору фінансових даних завдяки офіційній інтеграції з провідними українськими банками. Більше немає потреби щоразу вручну завантажувати файли виписок CSV чи PDF — система сама отримує транзакції.",
    priorities: [
      "Офіційні API-підключення для Monobank (в т.ч. FOP), ПриватБанк, А-Банк, ПУМБ та Укргазбанк.",
      "Безпечна синхронізація: авторизація відбувається за офіційними токенами без передачі паролів.",
      "Автоматична класифікація доходів та витрат на основі аналізу категорій.",
      "Оновлення фінансових даних у фоновому режимі без вашої безпосередньої участі."
    ],
    howItWorks: "Ви один раз додаєте банківську інтеграцію в налаштуваннях профілю за допомогою токену. Після цього сервер UniTax періодично завантажує нові транзакції, миттєво оновлюючи податкові розрахунки."
  },
  "dps-integration": {
    title: "Пряме підключення до сервісів ДПС",
    emoji: "🔒",
    fullDesc: "Завдяки глибокій інтеграції з електронними сервісами Державної податкової служби (ДПС) України, UniTax надає користувачам можливість отримувати актуальну інформацію безпосередньо з офіційних баз даних ДПС.",
    priorities: [
      "Швидка перевірка стану розрахунків з бюджетом та наявності податкового боргу чи переплат.",
      "Контроль залишків на єдиному податковому рахунку та ПДВ-рахунках.",
      "Миттєве відправлення сформованих декларацій безпосередньо на шлюз ДПС для реєстрації.",
      "Повна безпека: ключі КЕП зчитуються та використовуються виключно локально в браузері."
    ],
    howItWorks: "При переході на вкладку інтеграції з ДПС або при автоматичній перевірці, система робить запит за допомогою сертифікатів КЕП клієнта, зчитує актуальний стан розрахунків по картках платника податків."
  },
  "deadlines": {
    title: "Нагадування про дедлайни та податковий календар",
    emoji: "⏰",
    fullDesc: "Наш інтелектуальний податковий календар автоматично адаптується під вибрану групу оподаткування ФОП чи форму власності ТОВ і проактивно нагадує про важливі події через Telegram-бота.",
    priorities: [
      "Персональні інтерактивні сповіщення у вашому Telegram про дедлайни.",
      "Повідомлення заздалегідь: нагадування за 5 днів, 3 дні та в останній день дедлайну.",
      "Автоматичний підрахунок суми єдиного податку чи ЄСВ до сплати безпосередньо у повідомленні.",
      "Можливість миттєвої сплати податків або подання декларації прямо з чату."
    ],
    howItWorks: "Ви прив'язуєте свій Telegram-аккаунт до UniTax. Коли настає час сплати податків, бот розраховує точну суму і надсилає повідомлення з кнопкою оплати Mono Pay."
  },
  "security": {
    title: "Безпека та захист фінансових даних",
    emoji: "🛡️",
    fullDesc: "Платформа UniTax побудована з використанням найсучасніших криптографічних протоколів та повністю відповідає вимогам законодавства України щодо захисту персональних даних та фінансової інформації.",
    priorities: [
      "Шифрування всіх переданих даних за допомогою протоколу SSL та зберігання у зашифрованому вигляді AES-256.",
      "Локальна робота з КЕП: зчитування ключів, генерація підписів відбувається виключно у вашому браузері.",
      "Щоденне автоматичне резервне копіювання інформації у розподілені хмарні сховища.",
      "Підтримка двофакторної автентифікації для входу в особисті кабінети."
    ],
    howItWorks: "Всі дані шифруються на льоту. Робота з ключами КЕП організована так, що ваші паролі залишаються виключно на вашому пристрої, гарантуючи конфіденційність."
  }
};

export default function BenefitsPage() {
  const { telegramId } = useApp();
  const [businessPrice, setBusinessPrice] = useState<number | null>(null);
  
  // Modal Window States
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch("https://api.unitax.pro/api/pricing");
        if (!res.ok) {
          const altRes = await fetch("https://unitas-backend.fly.dev/api/pricing");
          if (altRes.ok) {
            const data = await altRes.json();
            if (Array.isArray(data)) {
              const businessMonthly = data.find((p: any) => p.plan_type === "business" && p.payment_period === "monthly");
              if (businessMonthly) {
                setBusinessPrice(businessMonthly.price);
              }
            }
            return;
          }
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          const businessMonthly = data.find((p: any) => p.plan_type === "business" && p.payment_period === "monthly");
          if (businessMonthly) {
            setBusinessPrice(businessMonthly.price);
          }
        }
      } catch (err) {
        console.error("Failed to fetch pricing", err);
      }
    };
    fetchPricing();
  }, []);

  const openServiceModal = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Prevent standard page navigation for humans
    setSelectedService(id);
    setIsModalOpen(true);
  };

  const benefits = [
    {
      id: "ai-assistant",
      emoji: "🧠",
      title: "ШІ-асистент",
      desc: "Персональний податковий чат-бот на базі Gemini AI, який миттєво відповість на будь-які питання про податки, КВЕДи та законодавство.",
      color: "from-indigo-500/20 to-purple-500/20",
      icon: Brain,
      iconColor: "text-indigo-450 dark:text-indigo-300"
    },
    {
      id: "auto-reports",
      emoji: "📄",
      title: "Автоматичні звіти",
      desc: "Формуйте та перевіряйте декларації, звіти ЄСВ та рахунки на оплату за лічені секунди без ручного введення даних.",
      color: "from-emerald-500/20 to-teal-500/20",
      icon: FileText,
      iconColor: "text-emerald-500 dark:text-emerald-400"
    },
    {
      id: "osbb",
      emoji: "🏢",
      title: "Рішення для ОСББ",
      desc: "Автоматизація обліку внесків, формування квитанцій, розподіл платежів, прозорі фінансові реєстри та опитування мешканців будинку.",
      color: "from-blue-500/20 to-indigo-500/20",
      icon: Users,
      iconColor: "text-blue-500 dark:text-blue-400"
    },
    {
      id: "st",
      emoji: "🏡",
      title: "Рішення для СТ",
      desc: "Облік показників лічильників електроенергії та води, автоматичний розрахунок за тарифами, облік цільових та членських внесків.",
      color: "from-amber-500/20 to-orange-500/20",
      icon: Zap,
      iconColor: "text-amber-500 dark:text-amber-400"
    },
    {
      id: "auto-mail",
      emoji: "✉️",
      title: "Авто-розсилка пошти",
      desc: "Автоматична розсилка рахунків, квитанцій про оплату та нагадувань про заборгованість на email або в месенджери клієнтів.",
      color: "from-pink-500/20 to-rose-500/20",
      icon: Mail,
      iconColor: "text-pink-500 dark:text-pink-400"
    },
    {
      id: "accountants",
      emoji: "💼",
      title: "Для бухгалтерів",
      desc: "Професійний кабінет бухгалтера: ведення багатьох клієнтів (ФОП, ТОВ) в одному вікні, імпорт виписок, пакетна звітність.",
      color: "from-cyan-500/20 to-sky-500/20",
      icon: Award,
      iconColor: "text-cyan-500 dark:text-cyan-400"
    },
    {
      id: "tax-calendar",
      emoji: "📅",
      title: "Податковий календар",
      desc: "Персональний розклад дедлайнів, звітів та платежів. Нагадування в Telegram та можливість швидкої сплати податків.",
      color: "from-blue-500/20 to-teal-500/20",
      icon: Calendar,
      iconColor: "text-blue-500 dark:text-blue-400"
    },
    {
      id: "electronic-documents",
      emoji: "📁",
      title: "Електронні документи",
      desc: "Зручний онлайн документообіг. Створення рахунків, актів та підписання будь-якими ключами КЕП онлайн.",
      color: "from-indigo-500/20 to-purple-500/20",
      icon: FolderOpen,
      iconColor: "text-indigo-500 dark:text-indigo-400"
    },
    {
      id: "bank-integration",
      emoji: "⚡",
      title: "Інтеграція з банками",
      desc: "Безпечне підключення ПриватБанку, Monobank, А-Банку, ПУМБ для автоматичного отримання транзакцій та розрахунку податків.",
      color: "from-yellow-500/20 to-amber-500/20",
      icon: Zap,
      iconColor: "text-yellow-500 dark:text-yellow-400"
    },
    {
      id: "dps-integration",
      emoji: "🔒",
      title: "З'єднання з ДПС",
      desc: "Пряме підключення до сервісів ДПС через API для перевірки стану розрахунків з бюджетом, переплат та сплати боргу.",
      color: "from-purple-500/20 to-fuchsia-500/20",
      icon: Lock,
      iconColor: "text-purple-500 dark:text-purple-400"
    },
    {
      id: "deadlines",
      emoji: "⏰",
      title: "Нагадування дедлайнів",
      desc: "Проактивні сповіщення про терміни подачі звітів та сплати податків у Telegram, щоб ви ніколи не отримували штрафів.",
      color: "from-teal-500/20 to-emerald-500/20",
      icon: Clock,
      iconColor: "text-teal-500 dark:text-teal-400"
    },
    {
      id: "security",
      emoji: "🛡️",
      title: "Безпека даних",
      desc: "Надійне шифрування банківського рівня AES-256, SSL-з'єднання та локальна робота з ключами КЕП без передачі на сервер.",
      color: "from-rose-500/20 to-red-500/20",
      icon: Shield,
      iconColor: "text-rose-500 dark:text-rose-400"
    }
  ];

  const features = [
    { name: "ШІ-аналіз транзакцій", desc: "Автоматична класифікація доходів і витрат за допомогою AI" },
    { name: "Семантичний пошук", desc: "Пошук по законодавству та інструкціях звичайною мовою" },
    { name: "Створення та сплата рахунків", desc: "Швидка генерація інвойсів та платіжних доручень" },
    { name: "Аналіз податкових ризиків", desc: "Автоматичний моніторинг перевищення лімітів ФОП" },
    { name: "Імпорт банківських виписок", desc: "Завантаження виписок популярних українських банків (Monobank, Privat24)" },
    { name: "Зіставлення транзакцій (Reconciliation)", desc: "Контроль відповідності надходжень на рахунок поданим звітам" },
    { name: "Проактивні рекомендації", desc: "Поради щодо оптимізації податкового навантаження" },
    { name: "Інтеграція з українськими банками", desc: "Автоматична синхронізація балансів та транзакцій" }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/60 via-slate-50 to-white dark:from-[#0f152d] dark:via-[#070a13] dark:to-[#03050a] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300 relative overflow-x-hidden">
      
      {/* Decorative blurred background shapes */}
      <div className="absolute top-0 right-1/4 w-[50%] h-[30%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[40%] h-[30%] rounded-full bg-amber-500/5 dark:bg-amber-500/5 blur-[120px] pointer-events-none" />

      {/* Standalone Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-white/5 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
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

          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/benefits" className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              Переваги
            </Link>
            <a 
              href="https://t.me/unitas_tax_bot" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <span>Мій Telegram</span>
              <Send className="w-3.5 h-3.5" />
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
            {telegramId ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-400 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-650/10 flex items-center gap-1.5"
              >
                <span>У кабінет</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 text-slate-650 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Увійти</span>
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-400 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-650/15 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Зареєструватися
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20 relative z-10">
        
        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-950/20 p-8 sm:p-12 md:p-16 text-center shadow-xl backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-amber-500/5 pointer-events-none" />
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl mx-auto space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-650 dark:text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Переваги платформи
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Чому обирають{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-indigo-400 to-amber-500 dark:from-indigo-400 dark:via-indigo-200 dark:to-amber-400 bg-clip-text text-transparent">
                UniTax?
              </span>
            </h1>
            <p className="text-slate-650 dark:text-slate-400 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
              UniTax — це розумний український податковий асистент для ФОП, компаній, ОСББ та садівничих товариств, який спрощує бухгалтерський облік, автоматизує звітність та допомагає приймати правильні фінансові рішення за допомогою штучного інтелекту.
            </p>
            <div className="pt-4">
              <Link
                href={telegramId ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-400 hover:to-indigo-550 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-600/15 hover:scale-[1.02] active:scale-[0.98]"
              >
                {telegramId ? "Перейти в кабінет" : "Спробувати безкоштовно"}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 12 Benefit Cards Grid */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-white">
              Ключові послуги та переваги
            </h2>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Натисніть на будь-яку картку переваги, щоб переглянути детальний опис у 3D-модальному вікні
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <Link 
                  key={i} 
                  href={`/benefits/${b.id}`}
                  onClick={(e) => openServiceModal(e, b.id)}
                  className="group relative p-6 bg-white dark:bg-slate-950/30 border-2 border-amber-600/80 dark:border-amber-500/70 hover:border-amber-600 dark:hover:border-amber-500 rounded-3xl transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1.5 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/15 flex flex-col justify-between overflow-hidden"
                >
                  {/* Decorative Glow Layer */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${b.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none`} />
                  
                  <div className="relative space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/5 rounded-2xl flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                        {b.emoji}
                      </div>
                      <Icon className={`w-5 h-5 ${b.iconColor} opacity-50 group-hover:opacity-100 group-hover:rotate-6 transition-all duration-300`} />
                    </div>
                    <div className="space-y-1.5 text-left">
                      <h3 className="font-extrabold text-slate-800 dark:text-white text-base group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
                        {b.title}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-450 text-xs leading-relaxed">
                        {b.desc}
                      </p>
                    </div>
                  </div>

                  <div className="relative pt-4 flex items-center text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                    <span>Детальний опис переваги</span>
                    <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Premium Stats Section */}
        <div className="relative rounded-3xl border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-slate-950/20 p-8 sm:p-10 shadow-lg backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-white/5 text-center">
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">10,000+</div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">Активних користувачів</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Довіряють нам свій податковий облік</p>
            </div>
            <div className="space-y-1 pt-6 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-purple-500 to-amber-500 dark:from-purple-400 dark:to-amber-400 bg-clip-text text-transparent">50%</div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">Економія часу</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Порівняно з самостійною подачею звітів</p>
            </div>
            <div className="space-y-1 pt-6 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">24/7</div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">ШІ-підтримка та чат</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Ми завжди на зв'язку, щоб допомогти</p>
            </div>
          </div>
        </div>

        {/* Feature Checklist */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Повний набір інструментів</h2>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Оцініть повні можливості нашого сервісу
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-3.5 p-4 bg-white/70 dark:bg-slate-950/10 border border-slate-200 dark:border-white/5 rounded-2xl hover:border-indigo-500/20 dark:hover:border-indigo-500/20 transition-all text-left"
              >
                <div className="p-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">{f.name}</h4>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-450 leading-normal">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="relative rounded-3xl overflow-hidden border border-indigo-500/15 bg-gradient-to-tr from-indigo-950/20 via-purple-950/10 to-slate-950/30 p-8 sm:p-12 text-center shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-amber-500/5 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative max-w-xl mx-auto space-y-5">
            <h2 className="text-2xl sm:text-3xl font-black text-white">Ваш онлайн ШІ-бухгалтер 24/7</h2>
            <p className="text-xs sm:text-sm text-slate-350 leading-relaxed max-w-md mx-auto">
              Почніть використовувати UniTax вже сьогодні. Перші 7 днів доступу до тарифу Business надаються абсолютно безкоштовно, далі — всього {businessPrice ?? 499} грн/міс.
            </p>
            <div className="pt-2">
              <Link
                href={telegramId ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-400 hover:to-indigo-550 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-600/10 hover:scale-[1.02] active:scale-[0.98]"
              >
                {telegramId ? "Увійти в кабінет" : "Почати безкоштовно"}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

      </main>

      {/* 3D Cube Assembly Modal Window */}
      {isModalOpen && selectedService && servicesDetailMap[selectedService] && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-cube-container" onClick={(e) => e.stopPropagation()}>
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

            {/* Modal Content */}
            <div className="modal-content-box p-6 sm:p-8 bg-slate-50 dark:bg-slate-900 border-2 border-amber-500 text-slate-800 dark:text-slate-100 flex flex-col justify-between">
              
              <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-2xl shadow-inner">
                      {servicesDetailMap[selectedService].emoji}
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block">Переваги платформи</span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {servicesDetailMap[selectedService].title}
                      </h3>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Details Section */}
                <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1.5 custom-scrollbar text-xs sm:text-sm leading-relaxed text-left text-slate-650 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {servicesDetailMap[selectedService].fullDesc}
                  </p>

                  <div className="space-y-2 border-t border-slate-200 dark:border-white/5 pt-3">
                    <h4 className="font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider text-[10px]">Головні пріоритети системи:</h4>
                    <ul className="space-y-1.5">
                      {servicesDetailMap[selectedService].priorities.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-350">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1 border-t border-slate-200 dark:border-white/5 pt-3">
                    <h4 className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px]">Як це працює:</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-350">{servicesDetailMap[selectedService].howItWorks}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row gap-3 mt-4">
                <Link
                  href={`/benefits/${selectedService}`}
                  className="flex-1 py-2 rounded-xl border border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-300 text-xs font-bold text-center transition-all hover:scale-[1.01]"
                >
                  Окрема сторінка послуги (SEO)
                </Link>
                <Link
                  href="/register"
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-400 hover:to-indigo-550 text-white text-xs font-bold text-center transition-all shadow-md shadow-indigo-600/10 hover:scale-[1.01]"
                >
                  Спробувати безкоштовно
                </Link>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <LiqPayFooter />
    </div>
  );
}
