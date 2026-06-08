"use client";

import React from "react";
import { Shield, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow grids */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto w-full z-10">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/login"
            className="flex items-center text-sm font-semibold text-slate-400 hover:text-indigo-400 transition-all gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Назад</span>
          </Link>
          <div className="flex items-center gap-2 text-indigo-400">
            <Shield className="h-6 w-6" />
            <span className="font-bold tracking-wider uppercase text-xs">Безпека даних</span>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl shadow-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent mb-8">
            Політика конфіденційності
          </h1>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-white mb-2">1. Які дані ми збираємо</h2>
              <p>
                UniTax збирає лише ті дані, які необхідні для коректної роботи сервісу та розрахунку податків: адреса електронної пошти, контактний номер телефону, податкова інформація, завантажені банківські виписки та дані по операціях.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-2">2. Як ми використовуємо дані</h2>
              <p>
                Вся інформація використовується виключно для автоматизованого розрахунку податків, формування звітів, нагадування про терміни сплати через Telegram-бота та забезпечення доступу до функцій системи.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-2">3. Передача даних третім особам</h2>
              <p>
                Ми не продаємо, не передаємо та не розголошуємо ваші дані третім особам, крім випадків, які прямо передбачені чинним законодавством України для виконання податкових зобов'язань.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-2">4. Видалення даних</h2>
              <p>
                Кожен користувач має право на повне видалення свого акаунта та всіх пов'язаних даних. Ви можете надіслати запит на видалення або виконати його самостійно в налаштуваннях профілю.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
