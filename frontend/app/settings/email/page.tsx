"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { emailApi } from "@/lib/api";
import { Mail, CheckCircle2, AlertTriangle, RefreshCw, LogOut, Send, Sparkles } from "lucide-react";

export default function EmailSettings() {
  const { selectedProfile } = useApp();
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isTestingMail, setIsTestingMail] = useState(false);

  const fetchConnectionStatus = useCallback(async () => {
    if (!selectedProfile) return;
    setLoading(true);
    try {
      const res = await emailApi.connectStatus(selectedProfile.id);
      if (res.connected) {
        setIsConnected(true);
        setEmail(res.email);
      } else {
        setIsConnected(false);
        setEmail("");
      }
    } catch (err) {
      console.error("Failed to load Gmail connection status:", err);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [selectedProfile]);

  useEffect(() => {
    fetchConnectionStatus();
  }, [fetchConnectionStatus]);

  // Check URL parameters for OAuth status updates
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("success") === "true") {
        setStatusMessage({ text: "Gmail успішно підключено!", type: "success" });
        // Clear url parameters to clean history
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (urlParams.get("error")) {
        setStatusMessage({ text: `Помилка авторизації: ${urlParams.get("error")}`, type: "error" });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleConnect = async () => {
    if (!selectedProfile) return;
    try {
      const { url } = await emailApi.getAuthUrl(selectedProfile.id);
      if (url) {
        window.location.href = url;
      } else {
        setStatusMessage({ text: "Не вдалося отримати URL авторизації від сервера.", type: "error" });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Помилка: ${err?.response?.data?.detail || err.message}`, type: "error" });
    }
  };

  const handleDisconnect = async () => {
    if (!selectedProfile) return;
    if (!confirm("Ви впевнені, що хочете відключити пошту Gmail? Ви більше не зможете надсилати рахунки від вашого імені.")) return;
    try {
      await emailApi.disconnect(selectedProfile.id);
      setIsConnected(false);
      setEmail("");
      setStatusMessage({ text: "Gmail успішно відключено.", type: "success" });
    } catch (err: any) {
      setStatusMessage({ text: `Не вдалося відключити пошту: ${err?.response?.data?.detail || err.message}`, type: "error" });
    }
  };

  const handleTestEmail = async () => {
    if (!selectedProfile) return;
    setIsTestingMail(true);
    setStatusMessage(null);
    try {
      await emailApi.testEmail(selectedProfile.id);
      setStatusMessage({ text: `Тестовий лист успішно надіслано на вашу поштову скриньку: ${email}`, type: "success" });
    } catch (err: any) {
      setStatusMessage({ text: `Помилка надсилання: ${err?.response?.data?.detail || err.message}`, type: "error" });
    } finally {
      setIsTestingMail(false);
    }
  };

  if (!selectedProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Mail className="w-16 h-16 text-slate-600 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-slate-300">Профіль не обрано</h2>
        <p className="text-sm text-slate-500 max-w-sm mt-2">
          Будь ласка, оберіть активний профіль ТОВ або ФОП у лівій панелі навігації, щоб налаштувати Gmail API.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Налаштування пошти (Gmail API)</h1>
        <p className="text-sm text-slate-400 mt-1">
          Підключіть ваш акаунт Google, щоб надсилати документи контрагентам безпосередньо з вашого Gmail.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl">
                  <Mail className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-200">Gmail OAuth 2.0</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Сумісно з будь-яким особистим чи корпоративним Google Workspace</p>
                </div>
              </div>

              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400"></div>
              ) : isConnected ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Активно
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 gap-1.5">
                  Не підключено
                </span>
              )}
            </div>

            <div className="mt-8 border-t border-slate-800/80 pt-6">
              {loading ? (
                <div className="h-24 flex items-center justify-center">
                  <p className="text-xs text-slate-500">Перевірка з'єднання...</p>
                </div>
              ) : isConnected ? (
                <div className="space-y-6">
                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Підключена пошта</p>
                    <p className="text-base font-bold text-slate-200 mt-1">{email}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Всі автоматичні та разові рахунки для профілю <b>{selectedProfile.name}</b> надсилатимуться з цієї адреси.</p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={handleTestEmail}
                      disabled={isTestingMail}
                      className="inline-flex items-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all gap-2 disabled:opacity-50"
                    >
                      {isTestingMail ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Надсилання...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Перевірити з'єднання (тестовий лист)</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleDisconnect}
                      className="inline-flex items-center py-2.5 px-4 bg-slate-950/60 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/50 text-slate-400 hover:text-rose-400 text-xs font-bold rounded-xl transition-all gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Відключити Gmail</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Підключіть ваш Gmail-акаунт за допомогою безпечного протоколу Google OAuth 2.0. UniTax не отримує доступу до вашого пароля. Ви зможете скасувати авторизацію в будь-який момент.
                  </p>
                  <button
                    onClick={handleConnect}
                    className="inline-flex items-center py-3 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-550 hover:to-violet-550 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-lg shadow-indigo-600/15 transition-all gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Підключити пошту Gmail</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6">
            <h4 className="font-bold text-slate-200">Чому Gmail API?</h4>
            <ul className="mt-4 space-y-3.5 text-xs text-slate-400">
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                <span><b>Високий рівень доставки</b>: Листи, надіслані через API вашої пошти, не потрапляють у спам.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                <span><b>Історія листів</b>: Кожен надісланий рахунок зберігатиметься у вашій папці "Надіслані" в Gmail.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                <span><b>Безпека</b>: Авторизація проходить на серверах Google, UniTax отримує лише обмежений токен для надсилання пошти.</span>
              </li>
            </ul>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Примітка</h4>
              <p className="text-[11px] text-amber-500/80 leading-relaxed mt-1">
                Якщо ви підключаєте звичайний (@gmail.com) акаунт, під час входу Google може показати попередження "Додаток не перевірено". Це пов'язано з тим, що додаток працює в тестовому режимі. Просто натисніть "Додатково" -&gt; "Перейти до сайту unitas (небезпечно)", щоб підтвердити авторизацію.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
