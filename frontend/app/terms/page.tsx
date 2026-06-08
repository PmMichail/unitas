"use client";

import React from "react";
import { FileText, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function TermsPage() {
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
            <FileText className="h-6 w-6" />
            <span className="font-bold tracking-wider uppercase text-xs">Правила користування</span>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl shadow-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent mb-8">
            Умови використання сервісу
          </h1>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-white mb-2">1. Загальні положення</h2>
              <p>
                Створюючи обліковий запис у UniTax, ви погоджуєтеся з цими Умовами використання. Сервіс надає інструменти для полегшення податкового обліку, проте остаточна відповідальність за правильність подання звітів лежить на платнику податків.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-2">2. Оплата та підписки</h2>
              <p>
                Деякі функції сервісу доступні виключно за платною підпискою (Pro або Business). Оплата знімається автоматично щомісяця відповідно до обраного тарифу. Ви можете скасувати підписку в будь-який момент.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-2">3. Політика повернення коштів</h2>
              <p>
                Повернення коштів за оплачені періоди підписки не передбачено, крім випадків виникнення технічних проблем з боку нашого сервісу, що унеможливили надання послуги.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-2">4. Зміни до умов</h2>
              <p>
                UniTax залишає за собою право вносити зміни до цих умов. Усі оновлення публікуються на цій сторінці. Подальше використання сервісу після внесення змін означає згоду з оновленими правилами.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
