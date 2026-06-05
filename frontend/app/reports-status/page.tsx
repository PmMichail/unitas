"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { taxCabinetApi } from "@/lib/api";
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Layers,
  Key,
  Info,
  ExternalLink
} from "lucide-react";

export default function ReportsStatusPage() {
  const { selectedProfile } = useApp();
  const activeProfileId = selectedProfile?.id;

  const [reportsData, setReportsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isTokenSet, setIsTokenSet] = useState(false);
  const [token, setToken] = useState("");
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
      console.error("Failed to fetch instructions:", err);
    }
  };

  useEffect(() => {
    fetchTokenStatus();
    fetchInstructions();
    setReportsData(null);
    setSuccessMsg("");
  }, [activeProfileId]);

  const checkReports = async () => {
    if (!activeProfileId) return;
    setChecking(true);
    try {
      const data = await taxCabinetApi.checkReports(activeProfileId);
      setReportsData(data);
    } catch (err) {
      console.error("Failed to check reports status:", err);
      setReportsData({ error: "Не вдалося отримати статус звітів з сервера." });
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
          Статус подачі звітів
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Контролюйте вчасність та статус здачі звітів та декларацій в ДПС для вашого підприємства.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Token settings if not set, or refresh actions */}
        <div className="lg:col-span-1 p-6 rounded-2xl glass-panel space-y-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-4">
              <Key className="w-4 h-4 text-indigo-500" />
              Доступ до кабінету ДПС
            </h3>

            {loading ? (
              <div className="py-8 text-center">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
              </div>
            ) : !isTokenSet ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Для моніторингу подачі звітів необхідно ввести токен відкритої частини Електронного кабінету.
                </p>

                {instructions && (
                  <div className="bg-slate-950/20 border border-slate-200 dark:border-slate-800/40 p-4 rounded-xl space-y-2">
                    <h4 className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      Як отримати токен
                    </h4>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      {instructions.steps.slice(0, 7).map((step: string, i: number) => (
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
                    Підключити кабінет
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  API ДПС підключено
                </div>
                <p className="text-[11px] text-slate-400">
                  Система готова зчитати статус звітів з Електронного кабінету за поточний звітний рік.
                </p>

                <button
                  onClick={checkReports}
                  disabled={checking || !activeProfileId}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg disabled:opacity-50 glow-button flex items-center justify-center gap-1.5"
                >
                  {checking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Перевіряємо звіти...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Перевірити статус звітів
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

        {/* Right Column: Reports Status */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel space-y-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-500" />
            Обов'язкові звіти та декларації
          </h3>

          {!activeProfileId ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              Будь ласка, оберіть активний профіль підприємства.
            </div>
          ) : reportsData ? (
            reportsData.error ? (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/10 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {reportsData.error}
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Consolidation banner */}
                <div
                  className={`p-5 rounded-2xl border flex items-center gap-4 ${
                    reportsData.all_submitted
                      ? "bg-emerald-950/10 border-emerald-500/20 text-emerald-500"
                      : "bg-amber-950/10 border-amber-500/20 text-amber-500"
                  }`}
                >
                  {reportsData.all_submitted ? (
                    <CheckCircle className="w-8 h-8 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider">
                      {reportsData.all_submitted ? "Всі звіти здано вчасно!" : "Увага! Є незавершені звіти"}
                    </h4>
                    <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed font-semibold">
                      {reportsData.all_submitted
                        ? "Усі обов'язкові декларації успішно подані до органів податкової служби."
                        : "Виявлено обов'язкові звіти, які ще не були зафіксовані в податковій системі як прийняті."}
                    </p>
                  </div>
                </div>

                {/* Reports lists */}
                <div className="space-y-3">
                  <h4 className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    Перелік декларацій
                  </h4>
                  <div className="space-y-3">
                    {reportsData.reports.map((report: any, idx: number) => {
                      const isSubmitted = report.submitted;
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                            isSubmitted
                              ? "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10"
                              : "border-amber-500/20 bg-amber-950/5"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-900 dark:text-white">
                                {report.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-indigo-950/40 text-indigo-400 border border-indigo-500/15">
                                {report.type}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              Граничний строк: {report.deadline}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSubmitted ? (
                              <div className="text-right">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Прийнято ДПС
                                </span>
                                {report.submission_date && (
                                  <p className="text-[9px] text-slate-400 mt-1 font-semibold">
                                    Дата: {report.submission_date}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-950 text-amber-500 border border-amber-500/20">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Очікує подачі
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 flex justify-end font-semibold pt-2">
                  <span>
                    Останній запит: {new Date().toLocaleString("uk-UA")}
                  </span>
                </div>
              </div>
            )
          ) : (
            <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-slate-600 animate-pulse" />
              <span>Натисніть кнопку «Перевірити статус звітів» для моніторингу Електронного кабінету.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
