"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, ShieldCheck } from "lucide-react";

export default function OsbbPendingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params.slug || "");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <Clock size={34} />
        </div>
        <h1 className="text-2xl font-bold">Заявку надіслано</h1>
        <p className="mt-3 text-slate-600">Очікуйте підтвердження головою правління або бухгалтером. Після підтвердження ви зможете увійти до кабінету мешканця.</p>
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">
          <ShieldCheck size={18} /> Доступ до балансу та даних відкривається тільки після модерації.
        </div>
        <button onClick={() => router.push(`/osbb/${slug}/login`)} className="mt-6 w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700">Повернутися до входу</button>
      </div>
    </main>
  );
}
