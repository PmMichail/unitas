"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { taxCabinetApi } from "@/lib/api";
import {
  Lock,
  Key,
  CheckCircle,
  AlertCircle,
  Building,
  HelpCircle,
  RefreshCw,
  Cpu
} from "lucide-react";

export default function TaxApiSettingsPage() {
  const { selectedProfile } = useApp();
  const [token, setToken] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const instructions = [
    "Увійдіть в Електронний кабінет платника податків: https://cabinet.tax.gov.ua",
    "Використовуйте ваш КЕП для входу в систему",
    "В лівому меню перейдіть у розділ «Налаштування»",
    "Оберіть вкладку «Токени відкритої частини»",
    "Натисніть кнопку «Створити новий токен»",
    "Виберіть права: «Подання звітності», «Перевірка статусу»",
    "Скопіюйте згенерований токен",
    "Вставте токен в поле нижче та збережіть налаштування"
  ];

  const checkStatus = async () => {
    if (!selectedProfile) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await taxCabinetApi.getTokenStatus(selectedProfile.id);
      setConfigured(data.configured);
    } catch (err) {
      console.error("Failed to fetch tax token status:", err);
      setErrorMsg("Не вдалося завантажити статус підключення.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [selectedProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    if (!token.trim()) {
      setErrorMsg("Будь ласка, введіть токен доступу.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await taxCabinetApi.setToken(selectedProfile.id, token.trim());
      setSuccessMsg("Інтеграцію з API ДПС успішно налаштовано!");
      setConfigured(true);
      setToken("");
    } catch (err: any) {
      console.error("Save failed:", err);
      setErrorMsg("Помилка збереження токена. Спробуйте пізніше.");
    } finally {
      setSaving(false);
    }
  };

  if (!selectedProfile) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm max-w-lg mx-auto mt-8">
        <Building className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Не обрано профіль</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2 text-xs leading-relaxed">
          Будь ласка, оберіть компанію або ФОП у меню зліва, щоб налаштувати інтеграцію з кабінетом ДПС.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Cpu className="w-8 h-8 text-indigo-500" />
            Інтеграція з API ДПС
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Налаштуйте автоматичний обмін даними з Електронним кабінетом ДПС України.
          </p>
        </div>
        <button
          onClick={checkStatus}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700/60"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Оновити статус
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium text-sm">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium text-sm">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Token input form */}
        <div className="md:col-span-2 space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-500" />
              Токен кабінету ДПС
            </h3>

            {loading ? (
              <p className="text-xs text-slate-400">Перевірка конфігурації...</p>
            ) : (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block">
                  Статус підключення
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full text-xs font-bold ${
                  configured 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${configured ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {configured ? "API ДПС підключено" : "Потрібне налаштування"}
                </span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block">
                  Токен відкритої частини API
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder={configured ? "••••••••••••••••••••••••" : "Вставте ваш токен з кабінету"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors pl-10"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all text-sm flex items-center justify-center gap-2"
              >
                {saving ? "Збереження..." : "Зберегти токен доступу"}
              </button>
            </form>
          </div>
        </div>

        {/* Instructions */}
        <div className="md:col-span-3 space-y-4">
          <div className="p-6 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-500" />
              Інструкція: Як отримати API токен?
            </h3>
            <div className="space-y-3 pt-2">
              {instructions.map((step, idx) => (
                <div key={idx} className="flex gap-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  <div className="w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 font-bold text-[10px]">
                    {idx + 1}
                  </div>
                  <p className="flex-1 mt-0.5">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
