"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  AlertCircle, 
  CheckCircle2, 
  Edit2, 
  ArrowLeft, 
  Download, 
  ShieldAlert, 
  RefreshCw, 
  Check, 
  X,
  FileSpreadsheet
} from "lucide-react";

export default function ValidateStatementPage({ params }: { params: { id: string } }) {
  const [validation, setValidation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingErrorId, setEditingErrorId] = useState<number | null>(null);
  const [correctValue, setCorrectValue] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchValidation = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/statements/${params.id}/validation`);
      if (!res.ok) throw new Error("Не вдалося завантажити статус валідації");
      const data = await res.json();
      setValidation(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Не вдалося завантажити дані валідації виписки.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchValidation();
  }, [fetchValidation]);

  const handleResolve = async (errorId: number) => {
    if (!correctValue.trim()) {
      alert("Будь ласка, введіть коректне значення.");
      return;
    }

    setSavingId(errorId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/statements/${params.id}/errors/${errorId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correct_value: correctValue,
          profile_id: 1 // default profile id
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Не вдалося зберегти зміни");
      }

      setSuccessMsg("Помилку успішно виправлено!");
      setEditingErrorId(null);
      setCorrectValue("");
      fetchValidation();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Помилка при збереженні виправлення.");
    } finally {
      setSavingId(null);
    }
  };

  const getErrorLabel = (type: string) => {
    switch (type) {
      case "amount_mismatch":
        return "Розбіжність суми";
      case "date_mismatch":
        return "Розбіжність дати";
      case "count_mismatch":
        return "Невідповідність кількості транзакцій";
      case "missing_in_parsed":
        return "Відсутня в розпізнаних";
      default:
        return type;
    }
  };

  if (loading && !validation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Завантажуємо дані валідації...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Back to dashboard */}
      <div>
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад до дашборду
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-indigo-500" />
            Валідація банківської виписки
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Порівняння розпізнаних транзакцій з оригінальним документом та корекція розбіжностей.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/statements/${params.id}/download`}
            download
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700/60"
          >
            <Download className="w-3.5 h-3.5" />
            Скачати оригінал
          </a>
          <button
            onClick={fetchValidation}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Оновити
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium text-sm">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Status Card */}
      {validation && (
        <div className="grid grid-cols-1 gap-6">
          <div className="p-6 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              {validation.status === "validated" ? (
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              ) : (
                <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500 animate-pulse">
                  <ShieldAlert className="w-8 h-8" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {validation.status === "validated" 
                    ? "Успішно валідовано" 
                    : "Виявлено розбіжності"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {validation.status === "validated" 
                    ? "Всі дані розпізнано вірно відповідно до банківського оригіналу." 
                    : `Кількість активних розбіжностей: ${validation.errors_count}. Виправте їх нижче.`}
                </p>
              </div>
            </div>
            
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${
              validation.status === "validated" 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            }`}>
              {validation.status === "validated" ? "Перевірено" : "Потрібна увага"}
            </span>
          </div>

          {/* Discrepancies List */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Список помилок та розбіжностей</h3>
            
            {validation.errors_count === 0 ? (
              <div className="p-12 text-center bg-slate-50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-800/40 rounded-2xl">
                <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Нічого виправляти</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Виписка повністю відповідає оригіналу, жодних відхилень чи помилок не знайдено.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {validation.errors.map((error: any) => (
                  <div 
                    key={error.id}
                    className="p-5 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700/60 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          {getErrorLabel(error.error_type)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-900">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block mb-1">
                            Оригінальне значення
                          </span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {error.original_value}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-900">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block mb-1">
                            Розпізнане значення
                          </span>
                          <span className="text-sm font-bold text-rose-500 dark:text-rose-400 font-mono">
                            {error.parsed_value}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {editingErrorId === error.id ? (
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <input
                            type="text"
                            placeholder="Коректне значення"
                            value={correctValue}
                            onChange={(e) => setCorrectValue(e.target.value)}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors w-full md:w-36 font-mono"
                          />
                          <button
                            onClick={() => handleResolve(error.id)}
                            disabled={savingId === error.id}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-colors disabled:opacity-50"
                            title="Зберегти"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingErrorId(null);
                              setCorrectValue("");
                            }}
                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl transition-colors"
                            title="Скасувати"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingErrorId(error.id);
                            setCorrectValue(error.original_value);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all w-full md:w-auto justify-center"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Виправити
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
