"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { paymentsApi, api } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw,
  Wallet,
  Building,
  Info
} from "lucide-react";

export default function TaxesPage() {
  const { selectedProfile } = useApp();
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState("privat24");
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Notification states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLiabilities = useCallback(async () => {
    if (!selectedProfile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await paymentsApi.getTaxLiabilities({ profile_id: selectedProfile.id });
      setLiabilities(data);
    } catch (err) {
      console.error("Failed to fetch tax liabilities:", err);
      setErrorMsg("Не вдалося завантажити податкові зобов'язання.");
    } finally {
      setLoading(false);
    }
  }, [selectedProfile]);

  useEffect(() => {
    fetchLiabilities();
  }, [fetchLiabilities]);

  // Sync bank default on load
  useEffect(() => {
    if (selectedProfile && selectedProfile.default_bank) {
      setSelectedBank(selectedProfile.default_bank);
    }
  }, [selectedProfile]);

  const handleUpdateDefaultBank = async (bank: string) => {
    setSelectedBank(bank);
    if (!selectedProfile) return;
    try {
      const formData = new FormData();
      formData.append("default_bank", bank);
      // Update profile default bank
      await api.updateProfile(selectedProfile.id, { default_bank: bank });
      selectedProfile.default_bank = bank; // update context ref local
    } catch (err) {
      console.error("Failed to update default bank:", err);
    }
  };

  const handlePay = async (liability: any) => {
    if (!selectedProfile) return;
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const data = await paymentsApi.generatePayment({
        profile_id: selectedProfile.id,
        tax_type: liability.tax_type,
        amount: liability.amount,
        period: liability.period,
        bank_code: selectedBank
      });
      setPaymentData(data);
    } catch (err) {
      console.error("Failed to generate payment:", err);
      setErrorMsg("Не вдалося згенерувати платіжні реквізити.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmPaid = async () => {
    if (!paymentData) return;
    try {
      await paymentsApi.confirmPayment(paymentData.id);
      setSuccessMsg("Податкове зобов'язання успішно сплачено!");
      setPaymentData(null);
      fetchLiabilities();
      // Auto clear message
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Failed to confirm payment:", err);
      setErrorMsg("Не вдалося підтвердити оплату.");
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const banks = [
    { id: "privat24", name: "Приват24", color: "border-green-500 text-green-500 bg-green-50/10" },
    { id: "monobank", name: "monobank", color: "border-pink-500 text-pink-500 bg-pink-50/10" },
    { id: "abank", name: "А-Банк", color: "border-lime-500 text-lime-500 bg-lime-50/10" }
  ];

  const getTaxTypeLabel = (code: string) => {
    const labels: Record<string, string> = {
      edp: "Єдиний податок (ЄП)",
      esv: "Єдиний соціальний внесок (ЄСВ)",
      pdfo: "ПДФО",
      vz: "Військовий збір"
    };
    return labels[code] || code;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-indigo-500" />
            Сплата податків
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Швидка оплата зобов'язань через українські банки без ручного введення реквізитів
          </p>
        </div>
        <button
          onClick={fetchLiabilities}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700/60"
        >
          <RefreshCw className="w-4 h-4" />
          Оновити
        </button>
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

      {/* Profile Check */}
      {!selectedProfile ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm">
          <Building className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Не обрано профіль</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">
            Будь ласка, оберіть компанію або ФОП у верхньому меню, щоб переглянути зобов'язання.
          </p>
        </div>
      ) : (
        <>
          {/* Default Bank Selector */}
          <div className="p-5 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-500" />
                Банк для сплати податків
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Оберіть банк, через який ви хочете сплачувати податки за замовчуванням
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {banks.map((bank) => (
                <button
                  key={bank.id}
                  onClick={() => handleUpdateDefaultBank(bank.id)}
                  className={`p-3 text-sm font-semibold rounded-xl border text-center transition-all ${
                    selectedBank === bank.id
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {bank.name}
                </button>
              ))}
            </div>
          </div>

          {/* Liabilities List */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Поточні зобов'язання</h3>
            
            {loading ? (
              <div className="p-8 text-center text-slate-400">Завантаження...</div>
            ) : liabilities.length === 0 ? (
              <div className="p-12 text-center bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Усі податки сплачено!</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Немає нерозглянутих податкових зобов'язань для профілю <strong>{selectedProfile.name}</strong>.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {liabilities.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-slate-300 dark:hover:border-slate-700/60 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          item.status === "paid" 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}>
                          {item.status === "paid" ? "Сплачено" : "Очікує сплати"}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          Період: {item.period}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 mt-2">
                        {getTaxTypeLabel(item.tax_type)}
                      </h4>
                      <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">
                        {item.amount.toLocaleString("uk-UA", { minimumFractionDigits: 2 })} грн
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.status !== "paid" ? (
                        <button
                          onClick={() => handlePay(item)}
                          disabled={isGenerating}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all text-sm"
                        >
                          {isGenerating ? "Зведення..." : "Сплатити"}
                        </button>
                      ) : (
                        <span className="text-slate-400 text-sm font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Сплачено
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Payment Modal */}
      {paymentData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                  Сплата: {getTaxTypeLabel(paymentData.tax_type)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Банк: {banks.find(b => b.id === paymentData.bank_code)?.name} (реквізити сформовано)
                </p>
              </div>
              <button
                onClick={() => setPaymentData(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
              {/* QR Code and deep link section */}
              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-5 border border-slate-100 dark:border-slate-800/40 text-center space-y-4">
                {paymentData.methods[paymentData.bank_code]?.qr_code ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-white dark:bg-white inline-block rounded-xl shadow-sm border border-slate-200/50">
                      <QRCodeSVG value={paymentData.methods[paymentData.bank_code].qr_code} size={180} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      {paymentData.methods[paymentData.bank_code].instructions}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-slate-500">
                    Для цього банку доступна пряма оплата в додатку
                  </div>
                )}

                {paymentData.methods[paymentData.bank_code]?.deep_link && (
                  <a
                    href={paymentData.methods[paymentData.bank_code].deep_link}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/15 transition-all text-sm"
                  >
                    Відкрити в додатку
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Payment Details */}
              <div className="space-y-3.5">
                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 pb-1">
                  Реквізити платежу
                </h4>
                
                <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-slate-400 flex-shrink-0 w-24">Отримувач:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 text-right">{paymentData.recipient}</span>
                  </div>

                  <div className="flex justify-between items-center gap-4">
                    <span className="text-slate-400 flex-shrink-0">Код ЄДРПОУ:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{paymentData.edrpou}</span>
                      <button
                        onClick={() => copyToClipboard(paymentData.edrpou, "edrpou")}
                        className="text-slate-400 hover:text-indigo-500 p-0.5"
                      >
                        {copiedField === "edrpou" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <span className="text-slate-400 flex-shrink-0">IBAN:</span>
                    <div className="flex items-start gap-1.5 max-w-[260px] text-right">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 break-all">{paymentData.iban}</span>
                      <button
                        onClick={() => copyToClipboard(paymentData.iban, "iban")}
                        className="text-slate-400 hover:text-indigo-500 p-0.5 mt-0.5 flex-shrink-0"
                      >
                        {copiedField === "iban" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center gap-4">
                    <span className="text-slate-400 flex-shrink-0">Сума:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{paymentData.amount.toFixed(2)} грн</span>
                      <button
                        onClick={() => copyToClipboard(paymentData.amount.toFixed(2), "amount")}
                        className="text-slate-400 hover:text-indigo-500 p-0.5"
                      >
                        {copiedField === "amount" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <span className="text-slate-400 flex-shrink-0">Призначення:</span>
                    <div className="flex items-start gap-1.5 text-right max-w-[260px]">
                      <span className="font-medium text-slate-800 dark:text-slate-200 break-words">{paymentData.purpose}</span>
                      <button
                        onClick={() => copyToClipboard(paymentData.purpose, "purpose")}
                        className="text-slate-400 hover:text-indigo-500 p-0.5 flex-shrink-0"
                      >
                        {copiedField === "purpose" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleConfirmPaid}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all text-sm shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20"
              >
                Позначити сплаченим
              </button>
              <button
                onClick={() => setPaymentData(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all text-sm border border-slate-200 dark:border-slate-700"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple helper icon because X was missing from standard imports list of main layout
function X(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
