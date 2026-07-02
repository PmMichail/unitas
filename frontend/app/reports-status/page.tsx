"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Upload,
  Lock,
  FileKey,
  X,
  ShieldAlert,
} from "lucide-react";

export default function ReportsStatusPage() {
  const { selectedProfile } = useApp();
  const activeProfileId = selectedProfile?.id;

  const [reportsData, setReportsData] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // JKS state
  const [hasJks, setHasJks] = useState(false);
  const [jksUpdatedAt, setJksUpdatedAt] = useState<string | null>(null);
  const [jksFile, setJksFile] = useState<File | null>(null);
  const [jksPassword, setJksPassword] = useState("");
  const [uploadingJks, setUploadingJks] = useState(false);
  const jksInputRef = useRef<HTMLInputElement>(null);

  const fetchJksStatus = async () => {
    if (!activeProfileId) return;
    try {
      const res = await taxCabinetApi.getJksStatus(activeProfileId);
      setHasJks(res.has_jks);
      setJksUpdatedAt(res.updated_at);
    } catch {}
  };

  useEffect(() => {
    fetchJksStatus();
    setReportsData(null);
    setSuccessMsg("");
    setErrorMsg("");
  }, [activeProfileId]);

  const checkReports = async () => {
    if (!activeProfileId) return;
    setChecking(true);
    setErrorMsg("");
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

  const handleJksUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfileId || !jksFile || !jksPassword) return;
    setUploadingJks(true);
    setErrorMsg("");
    try {
      const res = await taxCabinetApi.uploadJks(activeProfileId, jksFile, jksPassword);
      setHasJks(true);
      setJksFile(null);
      setJksPassword("");
      if (jksInputRef.current) jksInputRef.current.value = "";
      setSuccessMsg(res.message || "JKS ключ успішно збережено!");
      setTimeout(() => setSuccessMsg(""), 5000);
      checkReports();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Не вдалося завантажити JKS ключ.");
    } finally {
      setUploadingJks(false);
    }
  };

  const handleDeleteJks = async () => {
    if (!activeProfileId || !confirm("Видалити збережений JKS ключ ДПС?")) return;
    try {
      await taxCabinetApi.deleteJks(activeProfileId);
      setHasJks(false);
      setJksUpdatedAt(null);
      setReportsData(null);
      setSuccessMsg("JKS ключ видалено.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch {}
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
        {/* Left Column: JKS auth */}
        <div className="lg:col-span-1 space-y-4">
          {successMsg && (
            <div className="p-3 text-xs bg-emerald-950/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="p-3 text-xs bg-red-950/20 text-red-400 border border-red-500/20 rounded-xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileKey className="w-4 h-4 text-indigo-500" />
              КЕП-ключ (JKS) для ДПС
            </h3>

            {hasJks ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <div>
                    <div>КЕП підключено — запит активний</div>
                    {jksUpdatedAt && (
                      <div className="text-[10px] font-normal opacity-70 mt-0.5">
                        Оновлено: {new Date(jksUpdatedAt).toLocaleString("uk-UA")}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={checkReports}
                  disabled={checking || !activeProfileId}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg disabled:opacity-50 glow-button flex items-center justify-center gap-1.5"
                >
                  {checking ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Перевіряємо...</>
                  ) : (
                    <><RefreshCw className="w-3.5 h-3.5" />Перевірити статус звітів</>
                  )}
                </button>

                <button
                  onClick={handleDeleteJks}
                  className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-red-500 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  Видалити JKS ключ
                </button>
              </div>
            ) : (
              <form onSubmit={handleJksUpload} className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Завантажте JKS-файл вашого КЕП для автоматичного підпису запитів до API ДПС.
                </p>

                <div
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                  onClick={() => jksInputRef.current?.click()}
                >
                  {jksFile ? (
                    <div className="text-xs text-indigo-400 font-semibold flex items-center justify-center gap-2">
                      <Key className="w-4 h-4" />
                      {jksFile.name}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 font-semibold">
                      <Upload className="w-5 h-5 mx-auto mb-1 opacity-50" />
                      Клацніть щоб обрати .jks файл
                    </div>
                  )}
                  <input
                    ref={jksInputRef}
                    type="file"
                    accept=".jks,.dat,.pfx,.p12"
                    className="hidden"
                    onChange={(e) => setJksFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Пароль до JKS файлу"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    value={jksPassword}
                    onChange={(e) => setJksPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploadingJks || !jksFile || !jksPassword}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg disabled:opacity-50 glow-button flex items-center justify-center gap-1.5"
                >
                  {uploadingJks ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Перевіряємо ключ...</>
                  ) : (
                    <><FileKey className="w-3.5 h-3.5" />Зберегти та підключити</>
                  )}
                </button>
              </form>
            )}
          </div>
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
            (reportsData.error || !Array.isArray(reportsData.reports)) ? (
              reportsData.error?.includes("КЕП") || reportsData.error?.includes("Немає") || reportsData.error?.includes("ключ") ? (
                <div className="py-12 flex flex-col items-center gap-4 text-center">
                  <FileKey className="w-10 h-10 text-indigo-400 opacity-60" />
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Дані відсутні</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                      Завантажте JKS-файл КЕП у лівій панелі для автоматичного запиту статусу звітів до ДПС.
                    </p>
                  </div>
                </div>
              ) : (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/10 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {reportsData.error || "Отримано некоректні дані про звіти від сервера."}
              </div>
              )
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
