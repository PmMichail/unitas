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
  Info,
  Download
} from "lucide-react";

export default function TaxesPage() {
  const { selectedProfile } = useApp();
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState("privat24");
  const [selectedRegion, setSelectedRegion] = useState("kyiv");
  const [paymentData, setPaymentData] = useState<any>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [isConfirmingId, setIsConfirmingId] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState("csv");
  
  // Notification states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom budget accounts configurations
  const [showCustomAccounts, setShowCustomAccounts] = useState(false);
  const [customRecipient, setCustomRecipient] = useState("");
  const [customEdrpou, setCustomEdrpou] = useState("");
  const [customIbanEdp, setCustomIbanEdp] = useState("");
  const [customIbanEsv, setCustomIbanEsv] = useState("");
  const [customIbanPdfo, setCustomIbanPdfo] = useState("");
  const [customIbanVz, setCustomIbanVz] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);

  // Modal editing states
  const [modalRecipient, setModalRecipient] = useState("");
  const [modalEdrpou, setModalEdrpou] = useState("");
  const [modalIban, setModalIban] = useState("");
  const [modalPurpose, setModalPurpose] = useState("");
  const [modalAmount, setModalAmount] = useState("");

  // Dynamic QR Code and Deep Link calculations
  const qrCodeValue = paymentData
    ? `BCD\n002\n1\nSCT\n\n${modalRecipient}\n${modalIban}\nUAH${Number(modalAmount || 0).toFixed(2)}\n\n${modalPurpose}`
    : "";

  const currentDeepLink = paymentData
    ? (() => {
        const bank = paymentData.bank_code;
        const urlEncodedPurpose = encodeURIComponent(modalPurpose);
        const amountNum = modalAmount;
        if (bank === "privat24") {
          return `https://link.privatbank.ua/pay?iban=${modalIban}&amount=${amountNum}&purpose=${urlEncodedPurpose}`;
        } else if (bank === "monobank") {
          return `https://send.monobank.ua/pay?iban=${modalIban}&amount=${amountNum}&purpose=${urlEncodedPurpose}`;
        } else if (bank === "abank") {
          return `https://a-bank.com.ua/pay?iban=${modalIban}&amount=${amountNum}&purpose=${urlEncodedPurpose}`;
        }
        return `https://link.privatbank.ua/pay?iban=${modalIban}&amount=${amountNum}&purpose=${urlEncodedPurpose}`;
      })()
    : "";

  // Auto-detect region and load custom budget accounts on profile change
  useEffect(() => {
    if (selectedProfile && selectedProfile.address) {
      const addr = selectedProfile.address.toLowerCase();
      if (addr.includes("дніпро") || addr.includes("dnipro")) {
        setSelectedRegion("dnipro");
      } else if (addr.includes("львів") || addr.includes("lviv")) {
        setSelectedRegion("lviv");
      } else if (addr.includes("одес") || addr.includes("odesa")) {
        setSelectedRegion("odesa");
      } else if (addr.includes("харк") || addr.includes("kharkiv")) {
        setSelectedRegion("kharkiv");
      } else {
        setSelectedRegion("kyiv");
      }
    }

    if (selectedProfile) {
      setCustomRecipient(selectedProfile.custom_recipient || "");
      setCustomEdrpou(selectedProfile.custom_edrpou || "");
      setCustomIbanEdp(selectedProfile.custom_iban_edp || "");
      setCustomIbanEsv(selectedProfile.custom_iban_esv || "");
      setCustomIbanPdfo(selectedProfile.custom_iban_pdfo || "");
      setCustomIbanVz(selectedProfile.custom_iban_vz || "");
    } else {
      setCustomRecipient("");
      setCustomEdrpou("");
      setCustomIbanEdp("");
      setCustomIbanEsv("");
      setCustomIbanPdfo("");
      setCustomIbanVz("");
    }
  }, [selectedProfile]);

  const handleSaveCustomAccounts = async () => {
    if (!selectedProfile) return;
    setSavingCustom(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.updateProfile(selectedProfile.id, {
        custom_recipient: customRecipient.trim(),
        custom_edrpou: customEdrpou.trim(),
        custom_iban_edp: customIbanEdp.trim(),
        custom_iban_esv: customIbanEsv.trim(),
        custom_iban_pdfo: customIbanPdfo.trim(),
        custom_iban_vz: customIbanVz.trim()
      });
      
      // Update local profile fields in-memory
      selectedProfile.custom_recipient = customRecipient.trim();
      selectedProfile.custom_edrpou = customEdrpou.trim();
      selectedProfile.custom_iban_edp = customIbanEdp.trim();
      selectedProfile.custom_iban_esv = customIbanEsv.trim();
      selectedProfile.custom_iban_pdfo = customIbanPdfo.trim();
      selectedProfile.custom_iban_vz = customIbanVz.trim();
      
      setSuccessMsg("Бюджетні рахунки успішно збережено!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Failed to save custom budget accounts:", err);
      setErrorMsg("Помилка при збереженні бюджетних рахунків.");
    } finally {
      setSavingCustom(false);
    }
  };

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
    setGeneratingId(liability.id);
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
      setModalRecipient(data.recipient || "");
      setModalEdrpou(data.edrpou || "");
      setModalIban(data.iban || "");
      setModalPurpose(data.purpose || "");
      setModalAmount(String(data.amount || liability.amount));
    } catch (err) {
      console.error("Failed to generate payment:", err);
      setErrorMsg("Не вдалося згенерувати платіжні реквізити.");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleLiqPay = async (liability: any) => {
    if (!selectedProfile) return;
    setGeneratingId(liability.id);
    setErrorMsg(null);
    try {
      const response = await fetch("https://unitas-backend.fly.dev/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: selectedProfile.id,
          tax_type: liability.tax_type,
          period: liability.period,
          amount: liability.amount
        })
      });
      
      const data = await response.json();
      
      if (data.data && data.signature) {
        // Create LiqPay form and submit
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "https://www.liqpay.ua/api/3/checkout";
        form.acceptCharset = "utf-8";
        
        const dataInput = document.createElement("input");
        dataInput.type = "hidden";
        dataInput.name = "data";
        dataInput.value = data.data;
        
        const signatureInput = document.createElement("input");
        signatureInput.type = "hidden";
        signatureInput.name = "signature";
        signatureInput.value = data.signature;
        
        form.appendChild(dataInput);
        form.appendChild(signatureInput);
        document.body.appendChild(form);
        form.submit();
      } else {
        setErrorMsg("Не вдалося створити платіж LiqPay");
      }
    } catch (err) {
      console.error("Failed to create LiqPay payment:", err);
      setErrorMsg("Помилка при створенні платежу LiqPay");
    } finally {
      setGeneratingId(null);
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

  const handleDirectConfirmPaid = async (liability: any) => {
    if (!selectedProfile) return;
    setIsConfirmingId(liability.id);
    setErrorMsg(null);
    try {
      const payment = await paymentsApi.generatePayment({
        profile_id: selectedProfile.id,
        tax_type: liability.tax_type,
        amount: liability.amount,
        period: liability.period,
        bank_code: selectedBank
      });
      await paymentsApi.confirmPayment(payment.id);
      setSuccessMsg("Податкове зобов'язання позначено як сплачене!");
      fetchLiabilities();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Failed to confirm payment directly:", err);
      setErrorMsg("Не вдалося позначити зобов'язання як сплачене.");
    } finally {
      setIsConfirmingId(null);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleExportTaxes = () => {
    if (!selectedProfile) return;
    const currentYear = new Date().getFullYear();
    const params = new URLSearchParams({
      profile_id: String(selectedProfile.id),
      format: exportFormat,
      year: String(currentYear)
    });
    window.location.href = `/api/export/taxes?${params.toString()}`;
  };

  const handleRegenerateCalendar = async () => {
    if (!selectedProfile) return;
    if (!window.confirm("Ви впевнені, що хочете перегенерувати податковий календар? Всі існуючі події будуть видалені та створені нові.")) {
      return;
    }
    try {
      const data = await paymentsApi.regenerateCalendar(selectedProfile.id);
      setSuccessMsg(data.message || "Календар успішно перегенеровано");
      fetchLiabilities();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Failed to regenerate calendar:", err);
      setErrorMsg(err.response?.data?.detail || "Помилка при перегенерації календаря");
    }
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
        <div className="flex items-center gap-2">
          <select 
            value={exportFormat} 
            onChange={(e) => setExportFormat(e.target.value)}
            className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-sm font-semibold bg-white dark:bg-slate-900"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (XLSX)</option>
          </select>
          
          <button
            onClick={handleExportTaxes}
            disabled={!selectedProfile}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Експорт календаря
          </button>
          
          <button
            onClick={handleRegenerateCalendar}
            disabled={!selectedProfile}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            Оновити календар
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

          {/* Tax Office Region Selector */}
          <div className="p-5 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-500" />
                Податкова інспекція (Регіон)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Оберіть регіон вашої податкової реєстрації для правильного формування реквізитів
              </p>
            </div>
            
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-200"
            >
              <option value="kyiv">м. Київ (Шевченківський р-н)</option>
              <option value="dnipro">ГУ ДПС у Дніпропетровській обл. (м. Дніпро)</option>
              <option value="lviv">ГУ ДПС у Львівській обл. (м. Львів)</option>
              <option value="odesa">ГУ ДПС в Одеській обл. (м. Одеса)</option>
              <option value="kharkiv">ГУ ДПС у Харківській обл. (м. Харків)</option>
            </select>

            {/* Custom budget accounts editor */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
              <button
                type="button"
                onClick={() => setShowCustomAccounts(!showCustomAccounts)}
                className="text-xs font-bold text-indigo-500 hover:text-indigo-400 flex items-center gap-1.5 transition-colors"
              >
                {showCustomAccounts ? "Приховати налаштування рахунків" : "Налаштувати власні бюджетні рахунки (якщо автоматичні невірні)"}
              </button>

              {showCustomAccounts && (
                <div className="mt-4 space-y-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/40 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Отримувач платежу</label>
                      <input
                        type="text"
                        value={customRecipient}
                        onChange={(e) => setCustomRecipient(e.target.value)}
                        placeholder="Наприклад: ГУ ДПС у Львівській області"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-200 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Код ЄДРПОУ отримувача</label>
                      <input
                        type="text"
                        value={customEdrpou}
                        onChange={(e) => setCustomEdrpou(e.target.value)}
                        placeholder="Наприклад: 44081023"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-200 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">IBAN Єдиного податку (ЄП)</label>
                      <input
                        type="text"
                        value={customIbanEdp}
                        onChange={(e) => setCustomIbanEdp(e.target.value)}
                        placeholder="UA..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-200 font-mono font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">IBAN ЄСВ за себе</label>
                      <input
                        type="text"
                        value={customIbanEsv}
                        onChange={(e) => setCustomIbanEsv(e.target.value)}
                        placeholder="UA..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-200 font-mono font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">IBAN Військового збору (ВЗ)</label>
                      <input
                        type="text"
                        value={customIbanVz}
                        onChange={(e) => setCustomIbanVz(e.target.value)}
                        placeholder="UA..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-200 font-mono font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">IBAN ПДФО</label>
                      <input
                        type="text"
                        value={customIbanPdfo}
                        onChange={(e) => setCustomIbanPdfo(e.target.value)}
                        placeholder="UA..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-200 font-mono font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={savingCustom}
                      onClick={handleSaveCustomAccounts}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                      {savingCustom ? "Збереження..." : "Зберегти реквізити"}
                    </button>
                  </div>
                </div>
              )}
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
                        <>
                          <button
                            onClick={() => handleLiqPay(item)}
                            disabled={generatingId !== null || isConfirmingId !== null}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition-all text-xs"
                          >
                            {generatingId === item.id ? "Обробка..." : "LiqPay"}
                          </button>
                          
                          <button
                            onClick={() => handlePay(item)}
                            disabled={generatingId !== null || isConfirmingId !== null}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition-all text-xs"
                          >
                            {generatingId === item.id ? "Зведення..." : "Сплатити"}
                          </button>
                          
                          <button
                            onClick={() => handleDirectConfirmPaid(item)}
                            disabled={generatingId !== null || isConfirmingId !== null}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition-all text-xs"
                          >
                            {isConfirmingId === item.id ? "Позначення..." : "Позначити як сплачений"}
                          </button>
                        </>
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
                      <QRCodeSVG value={qrCodeValue} size={180} />
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

                {currentDeepLink && (
                  <a
                    href={currentDeepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/15 transition-all text-sm"
                  >
                    Відкрити в додатку ({banks.find(b => b.id === paymentData.bank_code)?.name})
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Payment Details */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 pb-1">
                  Реквізити платежу
                </h4>
                
                <div className="space-y-4">
                  {/* Recipient */}
                  <div className="space-y-1 text-left">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Отримувач</label>
                      <button
                        onClick={() => copyToClipboard(modalRecipient, "recipient")}
                        className="text-slate-400 hover:text-indigo-500 p-0.5"
                      >
                        {copiedField === "recipient" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={modalRecipient}
                      onChange={(e) => setModalRecipient(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-semibold"
                    />
                  </div>

                  {/* EDRPOU */}
                  <div className="space-y-1 text-left">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Код ЄДРПОУ</label>
                      <button
                        onClick={() => copyToClipboard(modalEdrpou, "edrpou")}
                        className="text-slate-400 hover:text-indigo-500 p-0.5"
                      >
                        {copiedField === "edrpou" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={modalEdrpou}
                      onChange={(e) => setModalEdrpou(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono font-semibold"
                    />
                  </div>

                  {/* IBAN */}
                  <div className="space-y-1 text-left">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">IBAN отримувача</label>
                      <button
                        onClick={() => copyToClipboard(modalIban, "iban")}
                        className="text-slate-400 hover:text-indigo-500 p-0.5"
                      >
                        {copiedField === "iban" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={modalIban}
                      onChange={(e) => setModalIban(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono font-bold"
                    />
                  </div>

                  {/* Amount */}
                  <div className="space-y-1 text-left">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Сума (грн)</label>
                      <button
                        onClick={() => copyToClipboard(modalAmount, "amount")}
                        className="text-slate-400 hover:text-indigo-500 p-0.5"
                      >
                        {copiedField === "amount" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={modalAmount}
                      onChange={(e) => setModalAmount(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-bold"
                    />
                  </div>

                  {/* Purpose */}
                  <div className="space-y-1 text-left">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Призначення платежу</label>
                      <button
                        onClick={() => copyToClipboard(modalPurpose, "purpose")}
                        className="text-slate-400 hover:text-indigo-500 p-0.5"
                      >
                        {copiedField === "purpose" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={modalPurpose}
                      onChange={(e) => setModalPurpose(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-semibold resize-y"
                    />
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
