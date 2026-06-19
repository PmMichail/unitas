"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, ShieldCheck, HelpCircle } from "lucide-react";

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-650/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto z-10 relative">
        <div className="mb-8">
          <Link href="/login" className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-all">
            <ChevronLeft className="w-4 h-4" />
            <span>Повернутися на головну</span>
          </Link>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 md:p-10 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 pb-6 border-b border-slate-800/60">
            <div className="w-10 h-10 bg-indigo-600/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-455" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Політика повернення коштів</h1>
              <p className="text-xs text-slate-500 mt-1">Останнє оновлення: 13 червня 2026 року</p>
            </div>
          </div>

          <div className="space-y-4 text-xs leading-relaxed">
            <p>
              Цей документ визначає умови та порядок повернення грошових коштів, сплачених Користувачами за надання доступу до сервісу UniTax (надалі — "Сервіс").
            </p>

            <h3 className="text-sm font-bold text-white pt-2">1. Загальні положення</h3>
            <p>
              1.1. Послуги Сервісу надаються за передплатою (щомісячною або щорічною). Передплата надає Користувачу доступ до додаткового функціоналу тарифного плану Business.
            </p>
            <p>
              1.2. Сплачуючи передплату, Користувач погоджується з умовами цієї Політики повернення коштів та Публічною офертою Сервісу.
            </p>

            <h3 className="text-sm font-bold text-white pt-2">2. Умови повернення коштів</h3>
            <p>
              2.1. Користувач має право подати запит на повернення сплачених коштів протягом 14 календарних днів з моменту здійснення першої оплати (згідно із Законом України «Про захист прав споживачів»).
            </p>
            <p>
              2.2. Запит на повернення коштів після завершення 14-денного терміну розглядається в індивідуальному порядку, якщо:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Послуга не була надана або надання послуги було технічно неможливим з вини Сервісу.</li>
              <li>Виникли підтверджені технічні збої, які тривали більше 48 годин і унеможливили використання ключового функціоналу Сервісу.</li>
            </ul>

            <h3 className="text-sm font-bold text-white pt-2">3. Випадки, коли кошти не повертаються</h3>
            <p>
              3.1. Кошти не підлягають поверненню у таких випадках:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Якщо Користувач подав запит пізніше ніж через 14 днів після оплати без об'єктивних технічних причин.</li>
              <li>Якщо акаунт Користувача було заблоковано за порушення умов Публічної оферти або правил користування Сервісом.</li>
              <li>Якщо Користувач не скористався наданим доступом з особистих причин (незатребуваність сервісу).</li>
            </ul>

            <h3 className="text-sm font-bold text-white pt-2">4. Процедура оформлення запиту на повернення</h3>
            <p>
              4.1. Для оформлення повернення Користувач має надіслати запит на електронну адресу <span className="font-bold text-indigo-400">support@unitax.pro</span> або звернутися в чат підтримки в особистому кабінеті.
            </p>
            <p>
              4.2. У запиті необхідно вказати:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email акаунту в Сервісі.</li>
              <li>Дату та суму платежу.</li>
              <li>Номер транзакції (Invoice ID або Reference з Mono Pay).</li>
              <li>Причину запиту на повернення коштів.</li>
            </ul>
            <p>
              4.3. Термін розгляду запиту становить до 5 робочих днів з моменту його отримання. Повернення коштів здійснюється на ту саму банківську картку, з якої було здійснено платіж, протягом 5-10 банківських днів після схвалення запиту.
            </p>
 
            <h3 className="text-sm font-bold text-white pt-2">5. Контактна інформація</h3>
            <p>
              ФОП Повєткін М.М.<br />
              Код ЄДРПОУ/ІПН: 2800003498<br />
              Адреса: м. Дніпро вул. Романа Самокиша 1<br />
              Email: support@unitax.pro<br />
              Тел: +38 (067) 1579211
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
