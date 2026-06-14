"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export function LiqPayFooter() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <footer className="w-full bg-slate-950/80 backdrop-blur-md border-t border-slate-900/60 py-8 px-4 mt-12">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-xs text-slate-400">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-tr from-indigo-650 to-indigo-500 rounded-lg flex items-center justify-center font-extrabold text-white text-xs">U</div>
            <span className="font-bold text-white text-sm">UniTax</span>
          </div>
          <p className="leading-relaxed">
            Сучасна система автоматизації податків, звітності та інвойсингу для ФОП та ТОВ в Україні.
          </p>
          <p className="text-[10px] text-slate-550">
            &copy; {new Date().getFullYear()} UniTax. Всі права захищено.
          </p>
        </div>
        
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
            <ul className="space-y-1.5 pt-1 text-slate-405 dark:text-slate-400">
              <li className="font-bold text-slate-200">ФОП Повєткін М.М.</li>
              <li>Код ЄДРПОУ/ІПН: 2900003498</li>
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

        <div className="space-y-2.5">
          <h4 className="text-white font-bold uppercase tracking-wider text-[10px]">Документи</h4>
          <ul className="space-y-1.5">
            <li>
              <Link href="/privacy" className="hover:text-indigo-400 hover:underline transition-all">
                Політика конфіденційності
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-indigo-400 hover:underline transition-all">
                Публічна оферта (Умови надання послуг)
              </Link>
            </li>
            <li>
              <Link href="/refund" className="hover:text-indigo-400 hover:underline transition-all">
                Політика повернення коштів
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-white font-bold uppercase tracking-wider text-[10px]">Оплата</h4>
          <p className="leading-relaxed">
            Оплата здійснюється за допомогою платіжних систем LiqPay, Visa та Mastercard. Безпека платежів гарантована.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <div className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-white tracking-wider">
              VISA
            </div>
            <div className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-white tracking-wider">
              MC
            </div>
            <div className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-bold text-white tracking-wider">
              LiqPay
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
