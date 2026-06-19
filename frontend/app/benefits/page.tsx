"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { LiqPayFooter } from "@/components/LiqPayFooter";
import { 
  Shield, 
  Zap, 
  Clock, 
  Brain, 
  FileText, 
  Lock,
  ArrowRight,
  CheckCircle,
  HelpCircle,
  Send,
  LogIn
} from "lucide-react";

export default function BenefitsPage() {
  const { telegramId } = useApp();
  const [businessPrice, setBusinessPrice] = useState<number | null>(null);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch("https://unitas-backend.fly.dev/api/pricing");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const businessMonthly = data.find((p: any) => p.plan_type === "business" && p.payment_period === "monthly");
            if (businessMonthly) {
              setBusinessPrice(businessMonthly.price);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch pricing", err);
      }
    };
    fetchPricing();
  }, []);

  const benefits = [
    {
      emoji: "🧠",
      title: "ШІ-асистент",
      desc: "Персональний податковий чат-бот на базі Gemini AI, який миттєво відповість на будь-які питання про податки, КВЕДи та законодавство.",
      color: "from-indigo-600/20 to-purple-600/20",
      borderColor: "group-hover:border-indigo-500/40",
      icon: Brain,
      iconColor: "text-indigo-400"
    },
    {
      emoji: "📄",
      title: "Автоматичні звіти",
      desc: "Формуйте та перевіряйте декларації, звіти ЄСВ та рахунки на оплату за лічені секунди без ручного введення даних.",
      color: "from-emerald-600/20 to-teal-600/20",
      borderColor: "group-hover:border-emerald-500/40",
      icon: FileText,
      iconColor: "text-emerald-400"
    },
    {
      emoji: "⚡",
      title: "Швидкість роботи",
      desc: "Економте в середньому до 10 годин на місяць на рутинному веденні обліку, виписках та взаємодії з кабінетом платника.",
      color: "from-amber-600/20 to-orange-600/20",
      borderColor: "group-hover:border-amber-500/40",
      icon: Zap,
      iconColor: "text-amber-400"
    },
    {
      emoji: "🛡️",
      title: "Безпека даних",
      desc: "Надійне банківське шифрування, захищені SSL-з'єднання та повна відповідність законодавству України щодо захисту інформації.",
      color: "from-rose-600/20 to-red-600/20",
      borderColor: "group-hover:border-rose-500/40",
      icon: Shield,
      iconColor: "text-rose-400"
    },
    {
      emoji: "⏰",
      title: "Нагадування про дедлайни",
      desc: "Проактивні сповіщення про терміни подачі звітів та сплати податків у Telegram, щоб ви ніколи не отримували штрафів.",
      color: "from-cyan-600/20 to-blue-600/20",
      borderColor: "group-hover:border-cyan-500/40",
      icon: Clock,
      iconColor: "text-cyan-400"
    },
    {
      emoji: "🔒",
      title: "Інтеграція з DPS",
      desc: "Пряме з'єднання з електронними сервісами ДПС України за допомогою API для перевірки стану розрахунків та відправки звітів.",
      color: "from-purple-600/20 to-pink-600/20",
      borderColor: "group-hover:border-purple-500/40",
      icon: Lock,
      iconColor: "text-purple-400"
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
    <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16] text-[#090e1a] dark:text-[#f1f5f9] flex flex-col font-sans transition-colors duration-300">
      
      {/* Standalone Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/60 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <span className="font-extrabold text-white text-lg">U</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-indigo-300 bg-clip-text text-transparent">
                UniTax
              </h1>
              <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider">
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
            {telegramId ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-550 hover:from-indigo-550 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/10 flex items-center gap-1.5"
              >
                <span>У кабінет</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Увійти</span>
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-650 to-purple-650 hover:from-indigo-550 hover:to-purple-550 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/10 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Зареєструватися
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        
        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-8 sm:p-12 md:p-16 text-center shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl mx-auto space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Переваги платформи
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Чому обирають{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-indigo-400 to-purple-500 dark:from-indigo-400 dark:via-indigo-200 dark:to-purple-400 bg-clip-text text-transparent">
                UniTax?
              </span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
              UniTax — це розумний український податковий асистент для ФОП та компаній, який спрощує бухгалтерський облік, автоматизує звітність та допомагає приймати правильні рішення за допомогою штучного інтелекту.
            </p>
            <div className="pt-4">
              <Link
                href={telegramId ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-650 to-purple-650 hover:from-indigo-550 hover:to-purple-550 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/10 hover:scale-[1.02] active:scale-[0.98]"
              >
                {telegramId ? "Перейти в кабінет" : "Спробувати безкоштовно"}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 6 Benefit Cards Grid */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Ключові переваги</h2>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Функції, які допомагають тисячам підприємців забути про складну бухгалтерію
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <div 
                  key={i} 
                  className="group relative p-6 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-3xl hover:border-slate-350 dark:hover:border-slate-800 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5"
                >
                  {/* Visual Glow Layer */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${b.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl pointer-events-none`} />
                  
                  <div className="relative space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-xl shadow-inner">
                        {b.emoji}
                      </div>
                      <Icon className={`w-5 h-5 ${b.iconColor} opacity-40 group-hover:opacity-100 group-hover:rotate-6 transition-all duration-300`} />
                    </div>
                    <div className="space-y-1.5 text-left">
                      <h3 className="font-bold text-slate-800 dark:text-white text-base group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">{b.title}</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{b.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats Section */}
        <div className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-8 sm:p-10 shadow-lg">
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-250 dark:divide-slate-800/80 text-center">
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">10k+</div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">Активних користувачів</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Довіряють нам свій податковий облік</p>
            </div>
            <div className="space-y-1 pt-6 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">50%</div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">Економія часу</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Порівняно з самостійною подачею звітів</p>
            </div>
            <div className="space-y-1 pt-6 md:pt-0">
              <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">24/7</div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">Підтримка користувачів</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Ми завжди на зв'язку, щоб допомогти</p>
            </div>
          </div>
        </div>

        {/* Feature Checklist */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Повний набір інструментів</h2>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Оцініть повні можливості нашого сервісу
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-3.5 p-4 bg-white dark:bg-slate-950/20 border border-slate-200 dark:border-slate-900 rounded-2xl hover:border-slate-350 dark:hover:border-slate-800 transition-colors text-left"
              >
                <div className="p-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-650 dark:text-emerald-400 shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">{f.name}</h4>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-normal">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="relative rounded-3xl overflow-hidden border border-indigo-500/15 bg-gradient-to-tr from-indigo-950/40 via-purple-950/20 to-slate-950/40 p-8 sm:p-12 text-center shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative max-w-xl mx-auto space-y-5">
            <h2 className="text-2xl sm:text-3xl font-black text-white">Ваш онлайн ШІ-бухгалтер 24/7</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              Почніть використовувати UniTax вже сьогодні. Перші 7 днів доступу до тарифу Business надаються абсолютно безкоштовно, далі — всього {businessPrice ?? 499} грн/міс.
            </p>
            <div className="pt-2">
              <Link
                href={telegramId ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-650 to-purple-650 hover:from-indigo-550 hover:to-purple-550 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-600/10 hover:scale-[1.02] active:scale-[0.98]"
              >
                {telegramId ? "Увійти в кабінет" : "Почати безкоштовно"}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <LiqPayFooter />
    </div>
  );
}
