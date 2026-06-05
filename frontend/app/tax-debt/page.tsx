"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { taxCabinetApi } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Info,
  Building,
  Key,
  DollarSign
} from "lucide-react";

export default function TaxDebtPage() {
  const { selectedProfile } = useApp();
  const activeProfileId = selectedProfile?.id;

  const [debtInfo, setDebtInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [token, setToken] = useState("");
  const [isTokenSet, setIsTokenSet] = useState(false);
  const [instructions, setInstructions] = useState<any>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchTokenStatus = async () => {
    if (!activeProfileId) return;
    setLoading(true);
    try {
      const res = await taxCabinetApi.getTokenStatus(activeProfileId);
      setIsTokenSet(res.has_token);
    } catch (err) {
      console.error("Failed to fetch token status:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructions = async () => {
    try {
      const res = await taxCabinetApi.getInstructions();
      setInstructions(res);
    } catch (err) {
      console.error("Failed to load instructions:", err);
    }
  };

  useEffect(() => {
    fetchTokenStatus();
    fetchInstructions();
    setDebtInfo(null);
    setSuccessMsg("");
  }, [activeProfileId]);

  const checkDebt = async () => {
    if (!activeProfileId) return;
    setChecking(true);
    try {
      const data = await taxCabinetApi.checkDebt(activeProfileId);
      setDebtInfo(data);
    } catch (err) {
      console.error("Failed to check tax debt:", err);
      setDebtInfo({ error: "Не вдалося з'єднатися з сервером." });
    } finally {
      setChecking(false);
    }
  };

  const saveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfileId || !token.trim()) return;
    setLoading(true);
    try {
      await taxCabinetApi.setToken(activeProfileId, token.trim());
      setIsTokenSet(true);
      setSuccessMsg("Токен ДПС успішно збережено!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Failed to save token:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400 bg-clip-text text-transparent">
          Перевірка податкового боргу
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Контролюйте стан взаєморозрахунків з бюджетом та наявність заборгованостей через API Електронного кабінету ДПС.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: API connection */}
        <div className="lg:col-span-1 p-6 rounded-2xl glass-panel space-y-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-4">
              <Key className="w-4 h-4 text-indigo-500" />
              Підключення API ДПС
            </h3>

            {loading ? (
              <div className="py-8 text-center">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
              </div>
            ) : !isTokenSet ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Для перевірки стану розрахунків та наявності податкового боргу необхідно ввести токен відкритої частини Електронного кабінету.
                </p>

                {instructions && (
                  <div className="bg-slate-950/20 border border-slate-200 dark:border-slate-800/40 p-4 rounded-xl space-y-2">
                    <h4 className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      Покрокова інструкція
                    </h4>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      {instructions.steps.map((step: string, i: number) => (
                        <li key={i} className="leading-tight">{step}</li>
                      ))}
                    </ol>
                    <a
                      href="https://cabinet.tax.gov.ua"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1 mt-3 font-semibold transition-colors"
                    >
                      Перейти до Електронного кабінету
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <form onSubmit={saveToken} className="space-y-2 pt-2">
                  <input
                    type="password"
                    placeholder="Вставте токен доступу ДПС"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg glow-button"
                  >
                    Підключити API
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  API ДПС успішно підключено
                </div>
                <p className="text-[11px] text-slate-400">
                  Ви можете в будь-який момент перевірити наявність боргу. Запити кешуються на 24 години для уникнення блокування.
                </p>

                <button
                  onClick={checkDebt}
                  disabled={checking || !activeProfileId}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg disabled:opacity-50 glow-button flex items-center justify-center gap-1.5"
                >
                  {checking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Запитуємо ДПС...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Перевірити наявність боргу
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {successMsg && (
            <div className="p-3 text-xs bg-emerald-950/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold animate-pulse mt-4">
              {successMsg}
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel space-y-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-indigo-500" />
            Результати запиту розрахунків
          </h3>

          {!activeProfileId ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              Будь ласка, оберіть активний профіль підприємства для роботи.
            </div>
          ) : debtInfo ? (
            debtInfo.error ? (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/10 text-red-400 text-xs flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <div>
                  <span className="font-bold">Помилка підключення:</span> {debtInfo.error}
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Consolidation Banner */}
                <div
                  className={`p-5 rounded-2xl border flex items-center gap-4 ${
                    debtInfo.has_debt
                      ? "bg-rose-950/10 border-rose-500/20 text-rose-500"
                      : "bg-emerald-950/10 border-emerald-500/20 text-emerald-500"
                  }`}
                >
                  {debtInfo.has_debt ? (
                    <AlertCircle className="w-8 h-8 shrink-0" />
                  ) : (
                    <CheckCircle className="w-8 h-8 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider">
                      {debtInfo.has_debt ? "Знайдено податковий борг!" : "Податковий борг відсутній"}
                    </h4>
                    <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed font-semibold">
                      {debtInfo.has_debt
                        ? `Зафіксовано заборгованість перед бюджетом на загальну суму ${debtInfo.total_debt.toLocaleString("uk-UA")} грн.`
                        : "Ви не маєте прострочених платежів та боргів перед податковою службою України."}
                    </p>
                  </div>
                </div>

                {/* Details list */}
                {debtInfo.debt_details && Object.keys(debtInfo.debt_details).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      Деталізація заборгованості
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(debtInfo.debt_details).map(([taxName, amount]: any) => (
                        <div
                          key={taxName}
                          className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/10 text-xs"
                        >
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{taxName}</span>
                          <span className="font-extrabold text-rose-500 bg-rose-950/10 border border-rose-500/10 px-2.5 py-0.5 rounded-lg">
                            {parseFloat(amount).toLocaleString("uk-UA")} грн
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Settlement Table status */}
                {debtInfo.settlement_status && debtInfo.settlement_status.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      Картка розрахунків з бюджетом
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-xs text-left text-slate-400">
                        <thead className="bg-slate-950/20 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Назва податку</th>
                            <th className="px-4 py-3 text-right">Нараховано</th>
                            <th className="px-4 py-3 text-right">Сплачено</th>
                            <th className="px-4 py-3 text-right">Переплата</th>
                            <th className="px-4 py-3 text-right">Недоплата</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debtInfo.settlement_status.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b border-slate-200 dark:border-slate-800/40 hover:bg-slate-900/5 transition-colors">
                              <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-300">{item.tax_name}</td>
                              <td className="px-4 py-3.5 text-right font-medium text-slate-700 dark:text-slate-400">{item.accrued.toLocaleString("uk-UA")}</td>
                              <td className="px-4 py-3.5 text-right font-medium text-slate-700 dark:text-slate-400">{item.paid.toLocaleString("uk-UA")}</td>
                              <td className="px-4 py-3.5 text-right font-extrabold text-emerald-500">{item.overpayment > 0 ? `+${item.overpayment}` : "0"}</td>
                              <td className="px-4 py-3.5 text-right font-extrabold text-rose-500">{item.underpayment > 0 ? `-${item.underpayment}` : "0"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Footer metadata info */}
                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800/60 font-semibold">
                  <span>
                    Статус: {debtInfo.cached ? "🟢 Кешовані дані" : "⚡ Отримано наживо"}
                  </span>
                  <span>
                    Оновлено: {new Date(debtInfo.checked_at).toLocaleString("uk-UA")}
                  </span>
                </div>
              </div>
            )
          ) : (
            <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
              <DollarSign className="w-8 h-8 text-slate-600 animate-pulse" />
              <span>Натисніть кнопку «Перевірити наявність боргу» для формування звіту з ДПС.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
