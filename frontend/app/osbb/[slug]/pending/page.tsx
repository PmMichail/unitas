"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, ShieldCheck, LogOut, MessageCircle, PhoneCall } from "lucide-react";

export default function OsbbPendingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params.slug || "");
  const [memberId, setMemberId] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = localStorage.getItem("pending_member_id") || "";
      const storedPhone = localStorage.getItem("pending_phone") || "";
      setMemberId(storedId);
      setPhone(storedPhone);

      if (!storedId) {
        // Fallback to login if no pending ID found
        router.push(`/osbb/${slug}/login`);
        return;
      }

      // Initialize WebSocket connection to listen for approval
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.unitax.pro";
      const wsProtocol = API_BASE_URL.startsWith("https") ? "wss" : "ws";
      const wsHost = API_BASE_URL.replace(/^https?:\/\//, "");
      const wsUrl = `${wsProtocol}://${wsHost}/ws/member/${storedId}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected to listen for approval status");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === "approved") {
            // Clear pending items and redirect to login with query param to notify user
            localStorage.removeItem("pending_member_id");
            router.push(`/osbb/${slug}/login?approved=true&account=${localStorage.getItem("pending_account") || ""}`);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
      };

      return () => {
        ws.close();
      };
    }
  }, [slug, router]);

  const handleLogout = () => {
    localStorage.removeItem("pending_member_id");
    localStorage.removeItem("pending_phone");
    router.push(`/osbb/${slug}/login`);
  };

  const handleContactSupport = () => {
    // Open Telegram Bot link as the SOS support option
    window.open("https://t.me/UniTaxUA_Bot", "_blank");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0C10] px-4 py-10 text-slate-100 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-1/3 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />

      <div className="max-w-md w-full rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-8 text-center shadow-2xl z-10">
        
        {/* Secure Pulse Shield */}
        <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
          {/* Pulsing ring 1 */}
          <div className="absolute inset-0 rounded-3xl bg-indigo-500/20 animate-ping opacity-75" />
          {/* Pulsing ring 2 */}
          <div className="absolute inset-2 rounded-3xl bg-indigo-500/10 animate-pulse border border-indigo-500/30" />
          
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-950/80 border border-indigo-500/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <Clock size={36} className="animate-spin-slow text-indigo-400" />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          Заявку надіслано
        </h1>
        
        <p className="mt-4 text-sm text-slate-400 leading-relaxed text-justify px-2">
          Дякуємо за реєстрацію! Для захисту фінансових та персональних даних вашої організації, ми наразі проводимо верифікацію особового рахунку. Адміністратор підтвердить ваш профіль найближчим часом. Ви отримаєте push-сповіщення та email-підтвердження.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-slate-950/60 border border-white/5 p-4 text-xs text-slate-400">
          <ShieldCheck size={20} className="text-emerald-500 shrink-0" />
          <span className="text-left leading-normal">
            Доступ до балансу, лічильників та голосувань відкривається після модерації головою правління.
          </span>
        </div>

        <div className="mt-8 space-y-3">
          {/* Action Support Buttons */}
          <button 
            onClick={handleContactSupport}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 active:scale-98"
          >
            <MessageCircle size={18} />
            Зв'язатися з підтримкою (Telegram)
          </button>

          {phone && (
            <a 
              href={`tel:${phone}`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/30 py-3.5 font-semibold text-slate-300 hover:bg-slate-900/50 transition"
            >
              <PhoneCall size={18} className="text-slate-400" />
              Зателефонувати в ОСББ
            </a>
          )}

          <button 
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/10 py-3 text-sm font-semibold text-slate-400 hover:text-slate-200 hover:border-white/20 transition mt-4"
          >
            <LogOut size={16} />
            Увійти в інший профіль
          </button>
        </div>
      </div>
    </main>
  );
}
