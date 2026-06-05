"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { LogIn, KeyRound, Sparkles, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { setTelegramId } = useApp();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (id: string) => {
    const trimmedId = id.trim();
    if (!trimmedId) {
      setError("Будь ласка, введіть ваш Telegram ID.");
      return;
    }

    setIsLoading(true);
    setError("");

    // Simulate network authentication handshake and set state
    setTimeout(() => {
      setTelegramId(trimmedId);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Dynamic ambient background glow grids */}
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin(inputValue);
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
                className="w-full flex justify-center items-center py-3.5 px-4 bg-indigo-650 hover:bg-indigo-600 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-lg shadow-indigo-650/15 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all gap-2 disabled:opacity-50 disabled:pointer-events-none"
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
                onClick={() => handleLogin("1038622739")}
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
