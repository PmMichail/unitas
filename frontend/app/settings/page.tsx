"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { systemConfigApi } from "@/lib/api";
import {
  Settings as SettingsIcon,
  Bell,
  Mail,
  User,
  Shield,
  Moon,
  Sun,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Info
} from "lucide-react";

export default function Settings() {
  const { telegramId, setTelegramId } = useApp();
  
  const [tempId, setTempId] = useState(telegramId);
  const [email, setEmail] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");

  const [configs, setConfigs] = useState<Record<string, string>>({
    min_salary: "8647.0",
    fop_limit_group_1: "1444049.0",
    fop_limit_group_2: "7211598.0",
    fop_limit_group_3: "10091049.0",
    military_tax_fop_rate: "1.0",
    military_tax_employee_rate: "5.0",
    unified_tax_rate_group_3: "5.0",
    esv_fop_monthly: "1562.0",
    pit_employee_rate: "18.0",
    esv_employee_rate: "22.0"
  });
  const [configSuccess, setConfigSuccess] = useState(false);
  const [configError, setConfigError] = useState("");
  const [isEditable, setIsEditable] = useState(false);
  const [originalConfigs, setOriginalConfigs] = useState<Record<string, string>>({});

  useEffect(() => {
    setTempId(telegramId);
  }, [telegramId]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setThemeState(isDark ? "dark" : "light");
    
    // Load email if saved
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("notify_email");
      if (savedEmail) setEmail(savedEmail);
    }

    // Load configs from API
    systemConfigApi.getConfig()
      .then((data) => {
        if (data) {
          setConfigs(data);
          setOriginalConfigs(data);
        }
      })
      .catch((err) => console.error("Помилка завантаження конфігів:", err));
  }, []);

  const handleSaveConfigs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await systemConfigApi.updateConfig(configs);
      setOriginalConfigs(configs);
      setIsEditable(false);
      setConfigSuccess(true);
      setConfigError("");
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err: any) {
      setConfigError("Не вдалося зберегти налаштування");
      console.error(err);
    }
  };

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempId.trim()) return;
    setTelegramId(tempId);
    alert("Telegram ID успішно збережено та активовано.");
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("notify_email", email);
      setEmailSuccess(true);
      setTimeout(() => setEmailSuccess(false), 3000);
    }
  };

  const selectTheme = (nextTheme: "dark" | "light") => {
    setThemeState(nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400 bg-clip-text text-transparent">
          Налаштування
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Керуйте каналами сповіщень, системними параметрами та темою інтерфейсу.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Notifications */}
        <div className="space-y-6">
          {/* Telegram link */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-indigo-500" />
              Інтеграція з Telegram-ботом
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Підключіть свій Telegram ID для автоматичного отримання сповіщень про наближення дедлайнів та сплату податків.
            </p>

            <form onSubmit={handleSaveTelegram} className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                  Ваш Telegram ID
                </label>
                <input
                  type="text"
                  placeholder="Наприклад: 8566492902"
                  value={tempId}
                  onChange={(e) => setTempId(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg glow-button"
              >
                Зберегти Telegram ID
              </button>
            </form>

            <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-[10px] text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span>Для реєстрації відправте команду <b>/start</b> нашому боту в Telegram: </span>
                <a
                  href="https://t.me/unitas_tax_bot"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:underline font-bold"
                >
                  @unitas_tax_bot
                </a>
              </div>
            </div>
          </div>

          {/* Email notifications */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-indigo-500" />
              Email сповіщення (опціонально)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Отримуйте щомісячні звіти про доходи та розраховані суми податків на електронну скриньку.
            </p>

            <form onSubmit={handleSaveEmail} className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                  Адреса електронної пошти
                </label>
                <input
                  type="email"
                  placeholder="ivan@petrenko.ua"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                />
              </div>

              {emailSuccess && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Email успішно збережено!</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg glow-button"
              >
                Зберегти Email
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Style & Theme */}
        <div className="space-y-6">
          {/* Theme switch */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-indigo-500" />
              Колірна тема інтерфейсу
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Виберіть оформлення кабінету UniTax. За замовчуванням встановлено преміум темний режим.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => selectTheme("dark")}
                className={`py-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  theme === "dark"
                    ? "border-indigo-500 bg-indigo-950/20 text-indigo-400"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-350 text-slate-500"
                }`}
              >
                <Moon className="w-5 h-5" />
                <span className="text-xs font-bold">Темна тема</span>
              </button>
              <button
                onClick={() => selectTheme("light")}
                className={`py-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  theme === "light"
                    ? "border-indigo-500 bg-indigo-50/20 text-indigo-600"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-350 text-slate-500"
                }`}
              >
                <Sun className="w-5 h-5" />
                <span className="text-xs font-bold">Світла тема</span>
              </button>
            </div>
          </div>

          {/* Security details */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-500" />
              Безпека та конфіденційність
            </h3>
            <div className="text-xs text-slate-400 space-y-3 leading-relaxed">
              <p>
                Ваші банківські транзакції обробляються локально за допомогою навчених AI парсерів. Вони не передаються стороннім особам чи сервісам аналітики.
              </p>
              <p>
                Авторизація через Telegram ID є спрощеною. Найближчим часом буде додано захищений вхід через NextAuth з використанням електронного підпису (КЕП).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Panel Legislation Config */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Shield className="w-4.5 h-4.5 text-indigo-500" />
          Параметри законодавства (Адмін-панель)
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Налаштуйте актуальні ліміти та ставки податків України для розрахунків на дашборді та в модулях.
        </p>

        <form onSubmit={handleSaveConfigs} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Field: min_salary */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                Мін. зарплата (грн)
              </label>
              <input
                type="number"
                step="0.01"
                disabled={!isEditable}
                value={configs.min_salary}
                onChange={(e) => setConfigs({ ...configs, min_salary: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Field: esv_fop_monthly */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                ЄСВ ФОП за себе (грн/міс)
              </label>
              <input
                type="number"
                step="0.01"
                disabled={!isEditable}
                value={configs.esv_fop_monthly}
                onChange={(e) => setConfigs({ ...configs, esv_fop_monthly: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Field: military_tax_fop_rate */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                Військовий збір ФОП (%)
              </label>
              <input
                type="number"
                step="0.01"
                disabled={!isEditable}
                value={configs.military_tax_fop_rate}
                onChange={(e) => setConfigs({ ...configs, military_tax_fop_rate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Field: military_tax_employee_rate */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                ВЗ з зарплати (%)
              </label>
              <input
                type="number"
                step="0.01"
                disabled={!isEditable}
                value={configs.military_tax_employee_rate}
                onChange={(e) => setConfigs({ ...configs, military_tax_employee_rate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Field: unified_tax_rate_group_3 */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                Єдиний податок 3 група (%)
              </label>
              <input
                type="number"
                step="0.01"
                disabled={!isEditable}
                value={configs.unified_tax_rate_group_3}
                onChange={(e) => setConfigs({ ...configs, unified_tax_rate_group_3: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Field: fop_limit_group_1 */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                Ліміт доходу 1 група (грн)
              </label>
              <input
                type="number"
                step="1"
                disabled={!isEditable}
                value={configs.fop_limit_group_1}
                onChange={(e) => setConfigs({ ...configs, fop_limit_group_1: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Field: fop_limit_group_2 */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                Ліміт доходу 2 група (грн)
              </label>
              <input
                type="number"
                step="1"
                disabled={!isEditable}
                value={configs.fop_limit_group_2}
                onChange={(e) => setConfigs({ ...configs, fop_limit_group_2: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Field: fop_limit_group_3 */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                Ліміт доходу 3 група (грн)
              </label>
              <input
                type="number"
                step="1"
                disabled={!isEditable}
                value={configs.fop_limit_group_3}
                onChange={(e) => setConfigs({ ...configs, fop_limit_group_3: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Field: pit_employee_rate */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                ПДФО з зарплати (%)
              </label>
              <input
                type="number"
                step="0.01"
                disabled={!isEditable}
                value={configs.pit_employee_rate}
                onChange={(e) => setConfigs({ ...configs, pit_employee_rate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Field: esv_employee_rate */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                ЄСВ на зарплату (%)
              </label>
              <input
                type="number"
                step="0.01"
                disabled={!isEditable}
                value={configs.esv_employee_rate}
                onChange={(e) => setConfigs({ ...configs, esv_employee_rate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {configSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 flex items-center gap-1.5 w-full">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Параметри законодавства успішно оновлено!</span>
            </div>
          )}

          {configError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-500 flex items-center gap-1.5 w-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{configError}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {!isEditable ? (
              <button
                type="button"
                onClick={() => setIsEditable(true)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg glow-button flex items-center gap-2"
              >
                Змінити
                <SettingsIcon className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setConfigs(originalConfigs);
                    setIsEditable(false);
                    setConfigError("");
                  }}
                  className="px-6 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-all border border-slate-800"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg flex items-center gap-2"
                >
                  Зберегти
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
