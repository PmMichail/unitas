"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Building2, Lock, UserRound, ArrowRight } from "lucide-react";

export default function OsbbMemberLoginPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = String(params.slug || "");
  const [profile, setProfile] = useState<any>(null);
  const [accountNumber, setAccountNumber] = useState(searchParams.get("account") || "");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await api.getOsbbBySlug(slug);
        setProfile(data);
      } catch (err: any) {
        setError(err.response?.data?.detail || "ОСББ не знайдено");
      }
    };
    if (slug) loadProfile();
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "register") {
        const res = await api.memberRegister({
          slug,
          account_number: accountNumber,
          password,
          full_name: fullName,
          phone,
          email
        });
        if (res.member_id) localStorage.setItem("pending_member_id", String(res.member_id));
        localStorage.setItem("pending_phone", res.phone || phone || "");
        router.push(`/osbb/${slug}/pending`);
        return;
      }
      if (mode === "reset") {
        const res = await api.resetMemberPassword({
          slug,
          account_number: accountNumber,
          password_string: password
        });
        if (res.member_id) localStorage.setItem("pending_member_id", String(res.member_id));
        localStorage.setItem("pending_phone", res.phone || "");
        router.push(`/osbb/${slug}/pending`);
        return;
      }
      const data = await api.memberLogin({ slug, phone, password });
      if (data.status === "pending") {
        if (data.member_id) localStorage.setItem("pending_member_id", String(data.member_id));
        localStorage.setItem("pending_phone", data.phone || "");
        router.push(`/osbb/${slug}/pending`);
        return;
      }
      localStorage.setItem("member_token", data.token);
      localStorage.setItem("member_profile_slug", slug);
      router.push(`/osbb/${slug}/dashboard`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Помилка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0C10] px-4 py-10 text-slate-100 flex flex-col justify-center relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />
      
      <div className="mx-auto max-w-md w-full z-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] border border-indigo-500/30" style={{ backgroundColor: profile?.color_theme || "#6366f1" }}>
            <Building2 size={32} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            {profile?.name || "Кабінет мешканця"}
          </h1>
          {profile?.address && <p className="mt-2 text-sm text-slate-400 font-medium">{profile.address}</p>}
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-8 shadow-2xl">
          {mode !== "reset" ? (
            <div className="mb-6 flex rounded-2xl bg-slate-950/60 p-1 border border-white/5">
              <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${mode === "login" ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>Вхід</button>
              <button type="button" onClick={() => setMode("register")} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${mode === "register" ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>Реєстрація</button>
            </div>
          ) : (
            <div className="mb-6 text-center font-bold text-lg text-white">Відновлення паролю</div>
          )}

          {mode === "login" ? (
            <>
              <label className="mb-2 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Номер телефону</label>
              <div className="relative mb-4">
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full rounded-2xl border border-white/10 bg-slate-950/40 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-white placeholder-slate-600 transition" placeholder="+380991234567" />
              </div>
            </>
          ) : (
            <>
              <label className="mb-2 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Особовий рахунок / № квартири</label>
              <div className="relative mb-4">
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required className="w-full rounded-2xl border border-white/10 bg-slate-950/40 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-white placeholder-slate-600 transition" placeholder="Наприклад: 45 або ZK-045" />
              </div>
            </>
          )}

          {mode === "register" && (
            <>
              <label className="mb-2 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Повне ім'я (ПІБ)</label>
              <div className="relative mb-4">
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required={mode === "register"} className="w-full rounded-2xl border border-white/10 bg-slate-950/40 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-white placeholder-slate-600 transition" placeholder="Іванов Іван Іванович" />
              </div>

              <label className="mb-2 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Телефон</label>
              <div className="relative mb-4">
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required={mode === "register"} className="w-full rounded-2xl border border-white/10 bg-slate-950/40 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-white placeholder-slate-600 transition" placeholder="+380991234567" />
              </div>

              <label className="mb-2 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Електронна пошта (Email)</label>
              <div className="relative mb-4">
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={mode === "register"} className="w-full rounded-2xl border border-white/10 bg-slate-950/40 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-white placeholder-slate-600 transition" placeholder="your@email.com" />
              </div>
            </>
          )}

          <label className="mb-2 block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {mode === "reset" ? "Новий пароль" : "Пароль"}
          </label>
          <div className="relative mb-4">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full rounded-2xl border border-white/10 bg-slate-950/40 py-3 pl-12 pr-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-white placeholder-slate-600 transition" placeholder="Введіть пароль" />
          </div>

          {mode === "login" && (
            <div className="mb-5 text-right">
              <button type="button" onClick={() => { setMode("reset"); setPassword(""); }} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline">Забули пароль?</button>
            </div>
          )}

          {error && <div className="mb-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-sm text-rose-400">{error}</div>}

          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 active:scale-98 disabled:opacity-60 disabled:pointer-events-none">
            {loading ? "Зачекайте..." : mode === "login" ? "Увійти" : mode === "reset" ? "Змінити пароль" : "Надіслати заявку"}
            <ArrowRight size={18} />
          </button>

          {mode === "reset" && (
            <div className="mt-5 text-center">
              <button type="button" onClick={() => { setMode("login"); setPassword(""); }} className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition">Повернутися до входу</button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
