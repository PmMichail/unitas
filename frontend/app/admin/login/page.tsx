"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Lock, Mail, AlertCircle, ShieldAlert } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("admin@unitas.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.adminLogin({ email, password });
      if (data && data.token) {
        localStorage.setItem("admin_token", data.token);
        router.push("/admin/dashboard");
      } else {
        setError("Помилка авторизації. Токен відсутній.");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        "Не вдалося підключитися до сервера. Перевірте правильність введених даних."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial-at-t from-slate-900 via-[#0a0f1d] to-[#050811] px-4">
      <div className="w-full max-w-md bg-slate-950/40 border border-slate-800/80 p-8 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 mb-3 border border-indigo-500/30">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">
            Панель Адміністратора
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
            Вхід в систему UniTax Admin
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block ml-1">
              Електронна пошта
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@unitas.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all font-semibold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block ml-1">
              Пароль доступу
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all font-semibold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/10 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-b-white rounded-full animate-spin" />
                Авторизація...
              </>
            ) : (
              "Увійти в кабінет"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
