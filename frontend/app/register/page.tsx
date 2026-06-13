"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

function RegisterRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    let target = "/login?register=true";
    if (ref) {
      target += `&ref=${encodeURIComponent(ref)}`;
    }
    
    // We add a tiny delay to show the beautiful premium welcome UI
    const timer = setTimeout(() => {
      router.replace(target);
    }, 1200);

    return () => clearTimeout(timer);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />

      <div className="z-10 w-full max-w-md text-center px-4">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Decorative glass reflection */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none" />
          
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/25 animate-pulse">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-950 rounded-full flex items-center justify-center border border-slate-800">
                <Loader2 className="w-4.5 h-4.5 text-indigo-400 animate-spin" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent mb-3">
            Вітаємо в UniTax!
          </h2>
          
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Ваш контрагент надіслав вам документ. Ми налаштовуємо ваш кабінет для безпечного перегляду та підписання.
          </p>

          <div className="flex items-center justify-center gap-2 text-xs text-indigo-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            Перенаправлення на сторінку реєстрації...
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    }>
      <RegisterRedirect />
    </Suspense>
  );
}
