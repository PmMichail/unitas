"use client";
 
import React from "react";
import { FileText, ChevronLeft, Download } from "lucide-react";
import Link from "next/link";
 
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden print:bg-white print:text-black print:py-0 print:px-0">
      {/* Background glow grids */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none print:hidden" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none print:hidden" />
 
      <div className="max-w-3xl mx-auto w-full z-10">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <Link
            href="/login"
            className="flex items-center text-sm font-semibold text-slate-400 hover:text-indigo-400 transition-all gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Назад</span>
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-400 bg-slate-900/60 border border-slate-800 hover:border-emerald-500/30 px-3 py-1.5 rounded-full transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Завантажити PDF</span>
            </button>
            <div className="flex items-center gap-2 text-indigo-400">
              <FileText className="h-6 w-6" />
              <span className="font-bold tracking-wider uppercase text-xs">Правова інформація</span>
            </div>
          </div>
        </div>
 
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl shadow-2xl print:bg-white print:border-none print:shadow-none print:p-0 print:text-black">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent mb-4 print:text-black print:from-black print:to-black">
            Публічний договір (Оферта)
          </h1>
          <p className="text-xs text-slate-400 mb-8 print:text-slate-600">
            pro надання послуг з доступу до програмного забезпечення «UniTax»
          </p>
 
          <div className="space-y-6 text-sm text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent print:max-h-none print:overflow-visible print:text-slate-800 print:pr-0">
            <p className="italic text-slate-400 print:text-slate-600">
              Цей документ є офіційною публічною пропозицією (офертою) Фізичної особи-підприємця Повєткіна Михайла Михайловича (надалі — «Виконавець») для будь-якої фізичної або юридичної особи (надалі — «Користувач»), яка приймає умови цього Договору.
            </p>
 
            <section>
              <h2 className="text-base font-bold text-white mb-2 print:text-black">1. Загальні положення</h2>
              <p className="mb-2">
                1.1. Відповідно до ст. 633, 641, 642 Цивільного кодексу України цей документ є Публічною офертою. Повна згода з усіма умовами (акцепт) здійснюється шляхом реєстрації Користувача в сервісі «UniTax» або здійсненням оплати за доступ до платних функцій.
              </p>
              <p>
                1.2. Після акцепту оферти цей Договір набуває чинності договору приєднання та має юридичну силу договору, підписаного обома сторонами.
              </p>
            </section>
 
            <section>
              <h2 className="text-base font-bold text-white mb-2 print:text-black">2. Предмет договору</h2>
              <p>
                2.1. Виконавець надає Користувачеві послуги з доступу до програмного забезпечення (хмарного сервісу) «UniTax» на умовах ліцензії SaaS (Software as a Service) для автоматизації податкового обліку, формування звітів та інвойсингу.
              </p>
            </section>
 
            <section>
              <h2 className="text-base font-bold text-white mb-2 print:text-black">3. Інтелектуальна власність та авторські права</h2>
              <p className="mb-2">
                3.1. Фізична особа Повєткін Михайло Михайлович є одноосібним автором, розробником та законним володільцем усіх виключних майнових і немайнових прав інтелектуальної власності на програмне забезпечення «UniTax» (включаючи дизайн, вихідний код, бази даних та алгоритми).
              </p>
              <p className="mb-2">
                3.2. Виконавець гарантує, що володіє всіма необхідними правами для надання доступу до програмного забезпечення та його використання не порушує права інтелектуальної власності третіх осіб.
              </p>
              <p className="mb-2 font-semibold text-indigo-300 print:text-black print:font-bold">
                3.3. Виконавець бере на себе повну фінансову та юридичну відповідальність за будь-які спори, претензії третіх осіб щодо авторських прав чи прав інтелектуальної власності, пов'язані з використанням програмного продукту «UniTax», та зобов'язується врегулювати їх самостійно за власний рахунок.
              </p>
              <p>
                3.4. Користувачеві надається лише право особистого некомерційного використання сервісу відповідно до обраного тарифного плану. Жодні права на вихідний код чи інтелектуальну власність за цим Договором не передаються.
              </p>
            </section>
 
            <section>
              <h2 className="text-base font-bold text-white mb-2 print:text-black">4. Порядок надання послуг та оплата</h2>
              <p className="mb-2">
                4.1. Доступ до розширених функцій сервісу надається відповідно до тарифних планів (Pro або Business), опублікованих у кабінеті Користувача.
              </p>
              <p className="mb-2">
                4.2. Оплата послуг здійснюється Користувачем шляхом безготівкового перерахунку коштів через платіжну систему Mono Pay відповідно до інструкцій у додатку.
              </p>
              <p>
                4.3. Активація платного тарифу відбувається автоматично протягом кількох хвилин після підтвердження транзакції банком-еквайєром.
              </p>
            </section>
 
            <section>
              <h2 className="text-base font-bold text-white mb-2 print:text-black">5. Відповідальність сторін та обмеження</h2>
              <p className="mb-2">
                5.1. Сервіс «UniTax» надається на умовах «як є» (as is). Виконавець робить все можливе для стабільної роботи, але не несе відповідальності за тимчасові технічні збої на стороні провайдерів зв'язку, хостингу чи державних сервісів ДПС.
              </p>
              <p>
                5.2. Виконавець не несе відповідальності за правильність та своєчасність сплати податків чи подання декларацій Користувачем, оскільки сервіс є лише допоміжним автоматизованим інструментом обліку.
              </p>
            </section>
 
            <section>
              <h2 className="text-base font-bold text-white mb-2 print:text-black">6. Повернення коштів</h2>
              <p>
                6.1. Правила та умови повернення грошових коштів регулюються окремим документом — «Правила повернення коштів», опублікованим на сайті, який є невід'ємною частиною цього Договору.
              </p>
            </section>
 
            <section className="pt-4 border-t border-slate-800 print:border-slate-300">
              <h2 className="text-base font-bold text-white mb-2 print:text-black">Реквізити Виконавця</h2>
              <p className="font-semibold text-white print:text-black">ФОП Повєткін Михайло Михайлович</p>
              <p>Адреса реєстрації: м. Дніпро, вул. Романа Самокиша, 1</p>
              <p>Email: support@unitax.pro</p>
              <p>Телефон: +38 (067) 1579211</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
