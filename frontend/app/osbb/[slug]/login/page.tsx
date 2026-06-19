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
  const [mode, setMode] = useState<"login" | "register">("login");
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
        await api.memberRegister({ slug, account_number: accountNumber, password });
        router.push(`/osbb/${slug}/pending`);
        return;
      }
      const data = await api.memberLogin({ slug, account_number: accountNumber, password });
      if (data.status === "pending") {
        router.push(`/osbb/${slug}/pending`);
        return;
      }
      localStorage.setItem("member_token", data.token);
      localStorage.setItem("member_profile_slug", slug);
      router.push(`/osbb/${slug}/dashboard`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Помилка входу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundColor: profile?.color_theme || "#3b82f6" }}>
            <Building2 size={28} />
          </div>
          <h1 className="text-2xl font-bold">{profile?.name || "Кабінет мешканця"}</h1>
          {profile?.address && <p className="mt-1 text-sm text-slate-500">{profile.address}</p>}
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex rounded-2xl bg-slate-100 p-1">
            <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${mode === "login" ? "bg-white shadow-sm" : "text-slate-500"}`}>Вхід</button>
            <button type="button" onClick={() => setMode("register")} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${mode === "register" ? "bg-white shadow-sm" : "text-slate-500"}`}>Перша реєстрація</button>
          </div>

          <label className="mb-2 block text-sm font-medium text-slate-700">Особовий рахунок / № квартири</label>
          <div className="relative mb-4">
            <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Наприклад: 45 або ZK-045" />
          </div>

          <label className="mb-2 block text-sm font-medium text-slate-700">Пароль</label>
          <div className="relative mb-4">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Ваш пароль" />
          </div>

          {error && <div className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
            {loading ? "Зачекайте..." : mode === "login" ? "Увійти" : "Надіслати заявку"}
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </main>
  );
}
