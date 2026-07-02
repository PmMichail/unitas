"use client";

import React, { useState, useEffect } from "react";
import { Check, Crown, User, Building2, Briefcase, Loader2, CreditCard, MessageCircle, ArrowRight } from "lucide-react";

export default function TariffsPage() {
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "half_yearly" | "yearly">("monthly");
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);

  useEffect(() => {
    const fetchTariffs = async () => {
      try {
        const response = await fetch("https://unitas-backend.fly.dev/api/tariffs");
        const data = await response.json();
        setTariffs(data || []);
      } catch (error) {
        console.error("Failed to load tariffs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTariffs();
  }, []);

  const getPeriodPrice = (tariff: any) => {
    const monthly = tariff.monthly_price || 0;
    if (selectedPeriod === "half_yearly") {
      const basePrice = tariff.half_yearly_price || monthly * 6;
      const discount = tariff.half_yearly_discount || 0;
      return Math.round(basePrice * (1 - discount / 100));
    }
    if (selectedPeriod === "yearly") {
      const basePrice = tariff.yearly_price || monthly * 12;
      const discount = tariff.yearly_discount || 0;
      return Math.round(basePrice * (1 - discount / 100));
    }
    return monthly;
  };

  const getPeriodText = () => {
    if (selectedPeriod === "monthly") return "місяць";
    if (selectedPeriod === "half_yearly") return "6 місяців";
    return "рік";
  };

  const getTariffIcon = (code: string) => {
    if (code.includes("fop_1_2")) return <User className="w-6 h-6" />;
    if (code.includes("fop_3")) return <User className="w-6 h-6" />;
    if (code.includes("tov") || code.includes("company")) return <Building2 className="w-6 h-6" />;
    if (code.includes("non_profit")) return <Building2 className="w-6 h-6" />;
    if (code.includes("resident")) return <User className="w-6 h-6" />;
    if (code.includes("consulting")) return <Briefcase className="w-6 h-6" />;
    return <Crown className="w-6 h-6" />;
  };

  const getTariffFeatures = (code: string) => {
    if (code === "resident_module") {
      return [
        "Оплата внесків онлайн",
        "Голосування за рішення",
        "Подача показників лічильників",
        "Створення заявок та скарг",
        "Отримання сповіщень",
        "Перегляд документів ОСББ"
      ];
    }
    return [
      "Повний бухгалтерський облік",
      "Кадровий облік та зарплата",
      "Автоматичний імпорт виписок",
      "Генерація звітів",
      "Експорт даних"
    ];
  };

  const handleSendSupport = async () => {
    if (!supportName || !supportEmail || !supportMessage) {
      alert("Будь ласка, заповніть всі поля");
      return;
    }

    setSendingSupport(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://api.unitax.pro"}/api/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supportName,
          email: supportEmail,
          message: supportMessage
        })
      });

      if (response.ok) {
        setSupportSuccess(true);
        setSupportName("");
        setSupportEmail("");
        setSupportMessage("");
        setTimeout(() => {
          setShowSupportModal(false);
          setSupportSuccess(false);
        }, 3000);
      } else {
        alert("Помилка відправки запиту. Спробуйте пізніше.");
      }
    } catch (error) {
      console.error("Failed to send support request:", error);
      alert("Помилка відправки запиту. Спробуйте пізніше.");
    } finally {
      setSendingSupport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 dark:from-white dark:via-slate-200 dark:to-indigo-400 bg-clip-text text-transparent mb-4">
            Тарифні плани
          </h1>
          <p className="text-slate-400 text-lg">
            Оберіть оптимальний тариф для вашого бізнесу
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex justify-center mb-12">
          <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setSelectedPeriod("monthly")}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                selectedPeriod === "monthly"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Місяць
            </button>
            <button
              onClick={() => setSelectedPeriod("half_yearly")}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                selectedPeriod === "half_yearly"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Пів року</span>
            </button>
            <button
              onClick={() => setSelectedPeriod("yearly")}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                selectedPeriod === "yearly"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Рік</span>
            </button>
          </div>
        </div>

        {/* Tariffs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tariffs.map((tariff) => (
            <div
              key={tariff.code}
              className={`group relative p-4 bg-white dark:bg-slate-950/30 border-2 transition-all duration-300 rounded-3xl flex flex-col justify-between overflow-hidden ${
                tariff.is_coming_soon
                  ? "border-slate-200 dark:border-white/10 opacity-60"
                  : "border-slate-200 dark:border-white/10 hover:border-indigo-500 dark:hover:border-indigo-500 hover:scale-[1.03] hover:-translate-y-1.5 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/15"
              }`}
            >
              {/* Decorative Glow Layer */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />
              
              {tariff.is_coming_soon && (
                <div className="absolute top-4 right-4 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider z-10">
                  Скоро
                </div>
              )}
              
              <div className="relative space-y-3">
                <div className="flex justify-between items-center">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/5 rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                    💼
                  </div>
                  {!tariff.is_coming_soon && (
                    <div className="w-4 h-4 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-left">
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-sm group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
                    {tariff.name_uk}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-450 text-[10px] leading-relaxed line-clamp-2">
                    {tariff.description}
                  </p>
                </div>
                <div className="pt-1">
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {tariff.monthly_price} грн
                  </div>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500">на місяць</p>
                </div>
              </div>

              <div className="relative pt-3">
                <button
                  disabled={tariff.is_coming_soon}
                  className={`w-full py-2 rounded-xl text-[10px] font-bold text-center transition-all shadow-md flex items-center justify-center gap-1.5 ${
                    tariff.is_coming_soon
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-400 hover:to-indigo-550 text-white shadow-indigo-600/10 hover:scale-[1.01]"
                  }`}
                >
                  {tariff.is_coming_soon ? (
                    <span>Скоро доступно</span>
                  ) : (
                    <>
                      <span>Створити профіль</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-16 p-8 bg-amber-500/10 border border-amber-500/30 rounded-3xl">
          <h3 className="text-xl font-bold text-amber-400 mb-4">Потрібна допомога з вибором?</h3>
          <p className="text-slate-300 mb-4">
            Наша команда допоможе вам підібрати оптимальний тариф відповідно до потреб вашого бізнесу.
          </p>
          <div className="flex gap-4 flex-wrap">
            <button 
              onClick={() => window.open('https://t.me/unitax_support', '_blank')}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Чат підтримки
            </button>
            <button 
              onClick={() => setShowSupportModal(true)}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all"
            >
              Написати нам
            </button>
            <a 
              href="/admin/dashboard"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all"
            >
              Адмін-панель
            </a>
          </div>
        </div>
      </div>

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-6">Написати в підтримку</h3>
            
            {supportSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-emerald-400 font-semibold mb-2">Повідомлення відправлено!</p>
                <p className="text-slate-400 text-sm">Ми відповімо вам найближчим часом.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Ім'я</label>
                    <input
                      type="text"
                      value={supportName}
                      onChange={(e) => setSupportName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ваше ім'я"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Повідомлення</label>
                    <textarea
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Опишіть ваше питання..."
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSupportModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={handleSendSupport}
                    disabled={sendingSupport}
                    className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {sendingSupport ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Відправка...
                      </>
                    ) : (
                      "Відправити"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
