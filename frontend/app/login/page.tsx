"use client";
import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { LogIn, KeyRound, Sparkles, AlertCircle, ShieldCheck, ChevronLeft, Mail } from "lucide-react";

export default function LoginPage() {
  const { setTelegramId } = useApp();
  const [loginMode, setLoginMode] = useState<"email" | "telegram">("email");
  const [step, setStep] = useState<"id" | "code">("id");
  const [inputValue, setInputValue] = useState(""); // Telegram ID
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [isTelegramLogin, setIsTelegramLogin] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [codeValue, setCodeValue] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleTelegramLogin = async (id: string) => {
    const trimmedId = id.trim();
    if (!trimmedId) {
      setError("Будь ласка, введіть ваш Telegram ID.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await api.telegramLogin(trimmedId);
      if (res.status === "verification_required") {
        setVerificationId(trimmedId);
        setIsTelegramLogin(true);
        setStep("code");
      } else {
        setTelegramId(trimmedId);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Помилка авторизації. Перевірте, чи зареєстровані ви в Telegram-боті.";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = emailValue.trim();
    const trimmedPassword = passwordValue.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError("Будь ласка, заповніть Email та пароль.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await api.emailLogin({ email: trimmedEmail, password: trimmedPassword });
      if (res.status === "verification_required") {
        setVerificationId(trimmedEmail);
        setIsTelegramLogin(false);
        setStep("code");
      } else if (res.status === "success") {
        setTelegramId(trimmedEmail);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Неправильний Email або пароль.";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestTempPassword = async () => {
    const trimmedEmail = emailValue.trim();
    if (!trimmedEmail) {
      setError("Будь ласка, введіть ваш Email для запиту тимчасового коду.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await api.emailLogin({ email: trimmedEmail, password: "temp_password_request" });
      if (res.status === "verification_required") {
        setVerificationId(trimmedEmail);
        setIsTelegramLogin(false);
        setStep("code");
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Не вдалося надіслати тимчасовий код.";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeValue.trim()) {
      setError("Будь ласка, введіть код підтвердження.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await api.verify2FACode(verificationId, codeValue.trim(), isTelegramLogin);
      if (res.status === "success") {
        setTelegramId(verificationId);
      } else {
        setError("Не вдалося підтвердити код. Спробуйте ще раз.");
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Неправильний код підтвердження.";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    setStep("id");
    setCodeValue("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/25">
            <span className="font-extrabold text-white text-2xl">U</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
          Вхід до UniTax
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Ваш автоматизований податковий та інвойсинг асистент
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 py-8 px-6 shadow-2xl rounded-3xl sm:px-10">
          
          {step === "id" && (
            <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800/80 mb-6">
              <button
                type="button"
                onClick={() => {
                  setLoginMode("email");
                  setError("");
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  loginMode === "email"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Email / Пароль
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode("telegram");
                  setError("");
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  loginMode === "telegram"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Telegram ID
              </button>
            </div>
          )}

          {step === "id" ? (
            loginMode === "telegram" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleTelegramLogin(inputValue);
                }}
                className="space-y-6"
              >
                <div>
                  <label htmlFor="telegram_id" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Telegram ID
                  </label>
                  <div className="relative rounded-2xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <KeyRound className="h-5 w-5 text-slate-500" aria-hidden="true" />
                    </div>
                    <input
                      type="text"
                      name="telegram_id"
                      id="telegram_id"
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        if (error) setError("");
                      }}
                      className="block w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 placeholder-slate-600 text-sm transition-all"
                      placeholder="Введіть ваш Telegram ID..."
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                      <p className="text-xs font-semibold text-rose-200">{error}</p>
                    </div>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-3.5 px-4 bg-indigo-650 hover:bg-indigo-600 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4" />
                        <span>Отримати код</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEmailLogin} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Email
                    </label>
                    <div className="relative rounded-2xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-slate-500" aria-hidden="true" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        value={emailValue}
                        onChange={(e) => {
                          setEmailValue(e.target.value);
                          if (error) setError("");
                        }}
                        className="block w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 placeholder-slate-600 text-sm transition-all"
                        placeholder="user@example.com"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Пароль
                    </label>
                    <div className="relative rounded-2xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <KeyRound className="h-5 w-5 text-slate-500" aria-hidden="true" />
                      </div>
                      <input
                        type="password"
                        name="password"
                        id="password"
                        value={passwordValue}
                        onChange={(e) => {
                          setPasswordValue(e.target.value);
                          if (error) setError("");
                        }}
                        className="block w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 placeholder-slate-600 text-sm transition-all"
                        placeholder="••••••••"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs mt-2">
                  <button
                    type="button"
                    onClick={handleRequestTempPassword}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold underline"
                    disabled={isLoading}
                  >
                    Отримати тимчасовий код у Telegram
                  </button>
                </div>

                {error && (
                  <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                      <p className="text-xs font-semibold text-rose-200">{error}</p>
                    </div>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-3.5 px-4 bg-indigo-650 hover:bg-indigo-600 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4" />
                        <span>Увійти</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="auth_code" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Код підтвердження
                  </label>
                  <button
                    type="button"
                    onClick={goBack}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    disabled={isLoading}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Назад</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Код підтвердження надіслано на ваш Telegram-акаунт `{verificationId}`.
                </p>
                <div className="relative rounded-2xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <ShieldCheck className="h-5 w-5 text-slate-500" aria-hidden="true" />
                  </div>
                  <input
                    type="text"
                    name="auth_code"
                    id="auth_code"
                    value={codeValue}
                    onChange={(e) => {
                      setCodeValue(e.target.value);
                      if (error) setError("");
                    }}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 placeholder-slate-600 text-sm transition-all"
                    placeholder="Введіть 6-значний код..."
                    maxLength={6}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4">
                  <div className="flex items-center space-x-3">
                    <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                    <p className="text-xs font-semibold text-rose-200">{error}</p>
                  </div>
                </div>
              )}

              <div className="text-[11px] text-slate-500 italic text-center">
                Для тестування підійде код: <span className="font-bold text-indigo-400">123456</span>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-3.5 px-4 bg-indigo-650 hover:bg-indigo-600 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>Авторизуватися</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-y-0 flex items-center w-full">
                <div className="w-full border-t border-slate-800/80"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider font-bold">
                <span className="px-3 bg-[#0a0f1d] text-slate-500">Або для тесту</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  setInputValue("1038622739");
                  handleTelegramLogin("1038622739");
                }}
                disabled={isLoading}
                className="w-full flex items-center justify-center py-3.5 px-4 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 text-indigo-400 hover:text-indigo-300 text-xs font-bold rounded-2xl transition-all gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>Швидкий вхід з тестовим акаунтом</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
