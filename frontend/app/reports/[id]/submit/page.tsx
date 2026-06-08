"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api, certificatesApi } from "@/lib/api";
import {
  Shield,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Building,
  ArrowLeft,
  Key,
  HelpCircle
} from "lucide-react";

export default function SubmitReportPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { selectedProfile } = useApp();
  const [report, setReport] = useState<any>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [selectedCert, setSelectedCert] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [taxApiConfigured, setTaxApiConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!selectedProfile) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        // Отримати звіт
        const reportData = await api.getReportDetail(parseInt(params.id));
        setReport(reportData);

        // Отримати сертифікати КЕП для профілю
        const certsData = await certificatesApi.list(selectedProfile.id);
        setCertificates(certsData);

        // Перевірити налаштування API ДПС
        const apiData = await api.getTaxApiStatus(selectedProfile.id);
        setTaxApiConfigured(apiData.configured);
      } catch (err: any) {
        console.error(err);
        setErrorMsg("Помилка завантаження даних. Спробуйте пізніше.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [params.id, selectedProfile]);

  const handleSubmit = async () => {
    if (!selectedCert) {
      alert("Оберіть сертифікат для підпису");
      return;
    }

    setSubmitting(true);
    setResult(null);
    setErrorMsg(null);

    try {
      const data = await api.submitReport(parseInt(params.id), parseInt(selectedCert));
      setResult(data);
      if (!data.success) {
        setErrorMsg(data.detail || data.error || "Помилка відправки звіту.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || err.response?.data?.error || "Не вдалося відправити звіт. Перевірте з'єднання з сервером.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
          <p className="text-xs font-semibold text-slate-400">Завантаження інформації про відправку...</p>
        </div>
      </div>
    );
  }

  if (errorMsg && !report) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold">Виникла помилка</h2>
        <p className="text-sm text-slate-400">{errorMsg}</p>
        <button
          onClick={() => router.push("/reports")}
          className="px-4 py-2 bg-indigo-600 rounded-xl text-xs font-semibold hover:bg-indigo-500 text-white"
        >
          Назад до звітів
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/reports")}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-6 h-6 text-indigo-500" />
            Подання звіту до ДПС
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Накладіть КЕП підпис та надішліть декларацію безпосередньо в електронний кабінет.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Column */}
        <div className="md:col-span-2 space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Інформація про декларацію</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-400">Форма звіту</p>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">{report?.form_code}</p>
              </div>
              <div>
                <p className="text-slate-400">Звітний період</p>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">{report?.period} {report?.year} р.</p>
              </div>
              <div>
                <p className="text-slate-400">Платник</p>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">{selectedProfile?.name}</p>
              </div>
              <div>
                <p className="text-slate-400">ІПН / ЄДРПОУ</p>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 font-mono">{selectedProfile?.tax_id || "Не вказано"}</p>
              </div>
            </div>
          </div>

          {!taxApiConfigured && (
            <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-amber-500">Потрібно підключити API ДПС</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Перед подачею звіту необхідно налаштувати API токен доступу до електронного кабінету платника податків.
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push("/settings/tax-api")}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
              >
                Налаштувати API ДПС
              </button>
            </div>
          )}

          {/* Submission Action */}
          <div className="p-6 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-500" />
              Вибір КЕП для підписання
            </h2>

            {certificates.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <Shield className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-400">У вас немає завантажених ключів КЕП.</p>
                <button
                  onClick={() => router.push("/settings/certificates")}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl"
                >
                  Завантажити КЕП
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1 block">
                    Оберіть електронний цифровий підпис
                  </label>
                  <select
                    value={selectedCert}
                    onChange={(e) => setSelectedCert(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none"
                  >
                    <option value="">Оберіть КЕП...</option>
                    {certificates.map((cert) => (
                      <option key={cert.id} value={cert.id}>
                        {cert.cert_owner_name} ({cert.cert_issuer})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !taxApiConfigured || !selectedCert}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-semibold text-xs transition-all shadow-lg glow-button flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Підписання та відправка...
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5" />
                      Підписати КЕП та надіслати в ДПС
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status / History Column */}
        <div className="space-y-6">
          {result && (
            <div className={`p-6 rounded-2xl border transition-all animate-in fade-in duration-300 ${
              result.success 
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" 
                : "bg-rose-500/5 border-rose-500/20 text-rose-500"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0" />
                )}
                <h3 className="font-bold text-sm">
                  {result.success ? "Успішно відправлено!" : "Помилка подання"}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-2">
                {result.message || (result.success ? "Звіт відправлено до ДПС. Статус оновлюється." : "Не вдалося обробити звіт.")}
              </p>
              {result.confirmation_number && (
                <div className="mt-4 p-3 bg-slate-950/40 rounded-xl font-mono text-[10px] text-slate-300 break-all border border-slate-800">
                  <span className="text-slate-500 block">Номер квитанції:</span>
                  {result.confirmation_number}
                </div>
              )}
            </div>
          )}

          {/* Guidelines */}
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-indigo-500 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              Як відбувається подання?
            </h4>
            <ul className="text-[10px] text-slate-500 dark:text-slate-400 space-y-2 leading-relaxed list-decimal list-inside">
              <li>Клієнт UniTax ініціює подання декларації.</li>
              <li>Файл декларації XML підписується вашим сертифікатом КЕП за допомогою криптографічного алгоритму RSA-SHA256.</li>
              <li>Підписана XML-структура зашифровується та відправляється на шлюз ДПС.</li>
              <li>Квитанція №1 про отримання та Квитанція №2 про прийняття звіту зберігаються в історії UniTax.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
