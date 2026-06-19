"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export function LiqPayFooter() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <footer className="w-full bg-slate-950/80 backdrop-blur-md border-t border-slate-900/60 py-8 px-4 mt-12">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-xs text-slate-400">
        {/* Column 1: Logo & Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-tr from-indigo-650 to-indigo-500 rounded-lg flex items-center justify-center font-extrabold text-white text-xs">U</div>
            <span className="font-bold text-white text-sm">UniTax</span>
          </div>
          <p className="leading-relaxed">
            Сучасна система автоматизації податків, звітності та інвойсингу для ФОП та ТОВ в Україні.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <div className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-white tracking-wider">
              VISA
            </div>
            <div className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-white tracking-wider">
              MC
            </div>
            <div className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-white tracking-wider">
              Mono Pay
            </div>
          </div>
        </div>

        {/* Column 2: Contacts & Details */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-between w-full md:w-auto text-left text-white font-bold uppercase tracking-wider text-[10px] hover:text-indigo-400 transition-colors focus:outline-none"
          >
            <span>Контакти та реквізити</span>
            <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </button>
          
          <div className={`transition-all duration-300 overflow-hidden ${isOpen ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0 pointer-events-none"}`}>
            <ul className="space-y-1.5 pt-1 text-slate-400">
              <li className="font-bold text-slate-200">ФОП Повєткін М.М.</li>
              <li>Код ЄДРПОУ/ІПН: 2800003498</li>
              <li>Адреса: м. Дніпро вул. Романа Самокиша 1</li>
              <li>
                Тел: <a href="tel:+380671579211" className="hover:text-indigo-400 transition-colors">+38 (067) 1579211</a>
              </li>
              <li>
                Email: <a href="mailto:support@unitax.pro" className="hover:text-indigo-400 transition-colors">support@unitax.pro</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Column 3: Legal Documents */}
        <div className="space-y-2.5">
          <h4 className="text-white font-bold uppercase tracking-wider text-[10px]">Правова інформація</h4>
          <ul className="space-y-1.5">
            <li>
              <Link href="/privacy" className="hover:text-indigo-400 hover:underline transition-all">
                Політика конфіденційності
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-indigo-400 hover:underline transition-all">
                Угода користувача та Публічна оферта
              </Link>
            </li>
            <li>
              <Link href="/refund" className="hover:text-indigo-400 hover:underline transition-all">
                Правила повернення коштів
              </Link>
            </li>
            <li>
              <Link href="/support.html" className="hover:text-indigo-400 hover:underline transition-all">
                Служба підтримки (Support)
              </Link>
            </li>
            <li>
              <span className="text-slate-500">
                Умови оплати та надання послуг
              </span>
            </li>
          </ul>
        </div>

        {/* Column 4: Mobile Apps (App Store / Google Play Badges) */}
        <div className="space-y-3">
          <h4 className="text-white font-bold uppercase tracking-wider text-[10px]">Мобільні додатки</h4>
          <p className="leading-relaxed text-[11px] text-slate-400">
            Завантажуйте UniTax на свій смартфон:
          </p>
          <div className="flex flex-col gap-2 pt-1">
            {/* App Store Badge */}
            <a 
              href="#" 
              onClick={(e) => e.preventDefault()}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors text-left w-fit max-w-[170px]"
            >
              <svg className="w-5 h-5 fill-current text-white shrink-0" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.69-1.12 1.83-.98 2.94.1.08.2.12.3.12.87 0 1.93-.56 2.51-1.45z"/>
              </svg>
              <div>
                <div className="text-[7px] text-slate-400 font-bold uppercase tracking-wider leading-none">Завантажити з</div>
                <div className="text-[10px] text-white font-bold leading-tight mt-0.5">App Store</div>
              </div>
            </a>
            {/* Google Play Badge */}
            <a 
              href="#" 
              onClick={(e) => e.preventDefault()}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors text-left w-fit max-w-[170px]"
            >
              <svg className="w-5 h-5 fill-current text-white shrink-0" viewBox="0 0 24 24">
                <path d="M5 3.25c-.28 0-.5.22-.5.5v16.5c0 .28.22.5.5.5.12 0 .23-.04.32-.12L15.35 12 5.32 3.37c-.09-.08-.2-.12-.32-.12zm1.5 1.9L14.05 12 6.5 18.85V5.15zM16.8 10.75l-2.05-1.78L6.87 4.1l9.93 6.65zm1.9 1.25L6.87 19.9l7.88-4.88 2.05-1.78-.1-.1-.12-.12z"/>
              </svg>
              <div>
                <div className="text-[7px] text-slate-400 font-bold uppercase tracking-wider leading-none">Доступно в</div>
                <div className="text-[10px] text-white font-bold leading-tight mt-0.5">Google Play</div>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom copyright and status indicator */}
      <div className="max-w-6xl mx-auto border-t border-slate-900/60 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[10px] text-slate-500">
          &copy; {new Date().getFullYear()} UniTax. Всі права захищено.
        </p>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/40 border border-slate-800/60 rounded-full text-[10px] text-slate-350 font-semibold shadow-inner">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Моніторинг сервісів ДПС: Активний</span>
        </div>
      </div>
    </footer>
  );
}
