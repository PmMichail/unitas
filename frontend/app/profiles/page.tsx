"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Building2, 
  User, 
  Briefcase,
  AlertTriangle,
  Calendar,
  CheckCircle,
  HelpCircle,
  Percent,
  Calculator,
  FileText
} from "lucide-react";

export default function Profiles() {
  const { profiles, refreshProfiles, selectedProfile, setSelectedProfile } = useApp();
  const { telegramId } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<{ [key: number]: any }>({});

  // Fetch subscriptions for all profiles
  useEffect(() => {
    const fetchSubscriptions = async () => {
      const subs: { [key: number]: any } = {};
      for (const profile of profiles) {
        try {
          const res = await fetch(`https://unitas-backend.fly.dev/api/subscription/current/${profile.id}`);
          const data = await res.json();
          subs[profile.id] = data;
        } catch (error) {
          subs[profile.id] = { plan: "free" };
        }
      }
      setSubscriptions(subs);
    };
    if (profiles.length > 0) {
      fetchSubscriptions();
    }
  }, [profiles]);

  // Invoices Modal States
  const [isInvoicesModalOpen, setIsInvoicesModalOpen] = useState(false);
  const [invoicesProfile, setInvoicesProfile] = useState<any>(null);
  const [recurringInvoices, setRecurringInvoices] = useState<any[]>([]);
  const [invoicesHistory, setInvoicesHistory] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invActiveTab, setInvActiveTab] = useState<"schedules" | "oneoff" | "history">("schedules");
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);

  // New Recurring Invoice Form States
  const [invClientEmail, setInvClientEmail] = useState("");
  const [invClientTg, setInvClientTg] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invServiceName, setInvServiceName] = useState("");
  const [invIncludeAct, setInvIncludeAct] = useState(true);
  const [invSendDay, setInvSendDay] = useState("1");
  const [invPeriodicity, setInvPeriodicity] = useState<"monthly" | "specific">("monthly");
  const [invSendMonth, setInvSendMonth] = useState<number | null>(null);
  const [invClientName, setInvClientName] = useState("");
  const [invClientTaxId, setInvClientTaxId] = useState("");
  const [invDocumentType, setInvDocumentType] = useState("act");

  // One-off Invoice Form States
  const [oneoffClientEmail, setOneoffClientEmail] = useState("");
  const [oneoffClientTg, setOneoffClientTg] = useState("");
  const [oneoffAmount, setOneoffAmount] = useState("");
  const [oneoffServiceName, setOneoffServiceName] = useState("");
  const [oneoffIncludeAct, setOneoffIncludeAct] = useState(true);
  const [oneoffClientName, setOneoffClientName] = useState("");
  const [oneoffClientTaxId, setOneoffClientTaxId] = useState("");
  const [oneoffDocumentType, setOneoffDocumentType] = useState("act");
  const [sendingOneoff, setSendingOneoff] = useState(false);

  // Immediate Send Modal States
  const [isSendConfirmOpen, setIsSendConfirmOpen] = useState(false);
  const [targetInvoiceId, setTargetInvoiceId] = useState<number | null>(null);
  const [customDateEnabled, setCustomDateEnabled] = useState(false);
  const [customSendDay, setCustomSendDay] = useState("");
  const [customSendMonth, setCustomSendMonth] = useState("");
  const [sendIncludeAct, setSendIncludeAct] = useState(true);
  const [sendingInvoice, setSendingInvoice] = useState(false);

  const handleOpenInvoices = async (profile: any) => {
    setInvoicesProfile(profile);
    setIsInvoicesModalOpen(true);
    setInvActiveTab("schedules");
    setInvoiceFormOpen(false);
    
    // Clear recurring inputs
    setInvClientEmail("");
    setInvClientTg("");
    setInvAmount("");
    setInvServiceName("");
    setInvIncludeAct(true);
    setInvSendDay("1");
    setInvPeriodicity("monthly");
    setInvSendMonth(null);
    setInvClientName("");
    setInvClientTaxId("");
    setInvDocumentType("act");
    
    // Clear one-off inputs
    setOneoffClientEmail("");
    setOneoffClientTg("");
    setOneoffAmount("");
    setOneoffServiceName("");
    setOneoffIncludeAct(true);
    setOneoffClientName("");
    setOneoffClientTaxId("");
    setOneoffDocumentType("act");
    
    fetchInvoicesData(profile.id);
  };

  const fetchInvoicesData = async (profileId: number) => {
    setInvoicesLoading(true);
    try {
      const [recs, hist] = await Promise.all([
        api.getRecurringInvoices(profileId),
        api.getInvoicesHistory(profileId)
      ]);
      setRecurringInvoices(recs);
      setInvoicesHistory(hist);
    } catch (err) {
      console.error("Failed to fetch invoices data:", err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleSaveRecurringInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invClientEmail.trim() || !invAmount.trim() || !invServiceName.trim() || !invSendDay.trim()) {
      alert("Будь ласка, заповніть усі обов'язкові поля");
      return;
    }

    const amountNum = parseFloat(invAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Сума рахунку має бути позитивним числом");
      return;
    }

    const sendDayNum = parseInt(invSendDay, 10);
    if (isNaN(sendDayNum) || sendDayNum < 1 || sendDayNum > 28) {
      alert("День відправки має бути числом від 1 до 28");
      return;
    }

    if (!invoicesProfile) return;

    try {
      await api.createRecurringInvoice({
        profile_id: invoicesProfile.id,
        client_email: invClientEmail.trim(),
        client_telegram_id: invClientTg.trim() || undefined,
        amount: amountNum,
        service_name: invServiceName.trim(),
        send_day: sendDayNum,
        include_act: invIncludeAct,
        send_month: invSendMonth,
        client_name: invClientName.trim() || undefined,
        client_tax_id: invClientTaxId.trim() || undefined,
        document_type: invDocumentType,
      });
      alert("Шаблон створено успішно!");
      setInvoiceFormOpen(false);
      setInvClientEmail("");
      setInvClientTg("");
      setInvAmount("");
      setInvServiceName("");
      setInvIncludeAct(true);
      setInvSendDay("1");
      setInvPeriodicity("monthly");
      setInvSendMonth(null);
      setInvClientName("");
      setInvClientTaxId("");
      setInvDocumentType("act");
      fetchInvoicesData(invoicesProfile.id);
    } catch (err) {
      console.error(err);
      alert("Не вдалося зберегти шаблон");
    }
  };

  const handleSendOneoffInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oneoffClientEmail.trim() || !oneoffAmount.trim() || !oneoffServiceName.trim()) {
      alert("Будь ласка, заповніть усі обов'язкові поля");
      return;
    }

    const amountNum = parseFloat(oneoffAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Сума рахунку має бути позитивним числом");
      return;
    }

    if (!invoicesProfile) return;

    setSendingOneoff(true);
    try {
      await api.sendOneoffInvoice({
        profile_id: invoicesProfile.id,
        client_email: oneoffClientEmail.trim(),
        client_telegram_id: oneoffClientTg.trim() || undefined,
        amount: amountNum,
        service_name: oneoffServiceName.trim(),
        include_act: oneoffIncludeAct,
        client_name: oneoffClientName.trim() || undefined,
        client_tax_id: oneoffClientTaxId.trim() || undefined,
        document_type: oneoffDocumentType,
      });
      alert("Рахунок успішно надіслано клієнту!");
      setOneoffClientEmail("");
      setOneoffClientTg("");
      setOneoffAmount("");
      setOneoffServiceName("");
      setOneoffIncludeAct(true);
      setOneoffClientName("");
      setOneoffClientTaxId("");
      setOneoffDocumentType("act");
      setInvActiveTab("history");
      fetchInvoicesData(invoicesProfile.id);
    } catch (err) {
      console.error(err);
      alert("Не вдалося надіслати рахунок");
    } finally {
      setSendingOneoff(false);
    }
  };

  const handleDeleteRecurringInvoice = async (id: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цей шаблон?")) return;
    try {
      await api.deleteRecurringInvoice(id);
      if (invoicesProfile) fetchInvoicesData(invoicesProfile.id);
    } catch (err) {
      console.error(err);
      alert("Не вдалося видалити шаблон");
    }
  };

  const handleOpenSendConfirm = (id: number, defaultIncludeAct?: boolean) => {
    setTargetInvoiceId(id);
    const today = new Date();
    setCustomSendDay(today.getDate().toString());
    setCustomSendMonth((today.getMonth() + 1).toString());
    setCustomDateEnabled(false);
    
    const rec = recurringInvoices.find(item => item.id === id);
    setSendIncludeAct(defaultIncludeAct !== undefined ? defaultIncludeAct : (rec ? rec.include_act : true));
    
    setIsSendConfirmOpen(true);
  };

  const handleConfirmSendInvoice = async () => {
    if (!targetInvoiceId || !invoicesProfile) return;

    let dayParam: number | undefined = undefined;
    let monthParam: number | undefined = undefined;

    if (customDateEnabled) {
      const parsedDay = parseInt(customSendDay, 10);
      const parsedMonth = parseInt(customSendMonth, 10);

      if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
        alert("День має бути числом від 1 до 31");
        return;
      }
      if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        alert("Місяць має бути числом від 1 до 12");
        return;
      }
      dayParam = parsedDay;
      monthParam = parsedMonth;
    }

    setSendingInvoice(true);
    try {
      await api.sendInvoiceNow(targetInvoiceId, dayParam, monthParam, sendIncludeAct);
      alert("Рахунок та Акт успішно згенеровані та надіслані!");
      setIsSendConfirmOpen(false);
      fetchInvoicesData(invoicesProfile.id);
    } catch (err) {
      console.error(err);
      alert("Не вдалося надіслати рахунок");
    } finally {
      setSendingInvoice(false);
    }
  };

  // Form Fields State
  const [formType, setFormType] = useState<"fop" | "company">("fop");
  const [formName, setFormName] = useState("");
  const [formTaxId, setFormTaxId] = useState("");
  const [formTaxSystem, setFormTaxSystem] = useState("ednuy-3-5%");
  const [formGroup, setFormGroup] = useState<number>(3);
  const [formRate, setFormRate] = useState<number>(5);
  const [formHasEmployees, setFormHasEmployees] = useState(false);
  const [formIsVatPayer, setFormIsVatPayer] = useState(false);
  const [formEsvPaidByEmployer, setFormEsvPaidByEmployer] = useState(false);
  const [formRegDate, setFormRegDate] = useState(new Date().toISOString().split("T")[0]);
  const [formAddress, setFormAddress] = useState("");
  const [formDirectorName, setFormDirectorName] = useState("");
  const [formPhone, setFormPhone] = useState("");

  // Open modal for creation
  const handleOpenCreate = () => {
    setEditingProfile(null);
    setFormType("fop");
    setFormName("");
    setFormTaxId("");
    setFormTaxSystem("ednuy-3-5%");
    setFormGroup(3);
    setFormRate(5);
    setFormHasEmployees(false);
    setFormIsVatPayer(false);
    setFormEsvPaidByEmployer(false);
    setFormRegDate(new Date().toISOString().split("T")[0]);
    setFormAddress("");
    setFormDirectorName("");
    setFormPhone("");
    setError(null);
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (profile: any) => {
    setEditingProfile(profile);
    setFormType(profile.type);
    setFormName(profile.name);
    setFormTaxId(profile.tax_id || "");
    const ts = profile.tax_system || "ednuy-3-5%";
    setFormTaxSystem(["ednuy-3-5%", "single_tax", "fop_ep", "llc_ep"].includes(ts) ? "ednuy-3-5%" : "zagalna");
    setFormGroup(profile.group || 3);
    setFormRate(profile.rate || 5);
    setFormHasEmployees(!!profile.has_employees);
    setFormIsVatPayer(!!profile.is_vat_payer);
    setFormEsvPaidByEmployer(!!profile.esv_paid_by_employer);
    setFormRegDate(profile.reg_date ? profile.reg_date.split("T")[0] : new Date().toISOString().split("T")[0]);
    setFormAddress(profile.address || "");
    setFormDirectorName(profile.director_name || "");
    setFormPhone(profile.phone || "");
    setError(null);
    setIsModalOpen(true);
  };

  // Handle Form Submit (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError("Введіть назву профілю");
      return;
    }
    if (!formTaxId.trim()) {
      setError(formType === "fop" ? "Введіть РНОКПП (ІПН)" : "Введіть код ЄДРПОУ");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      telegram_id: telegramId,
      type: formType,
      name: formName,
      tax_id: formTaxId,
      tax_system: formTaxSystem,
      group: formTaxSystem === "ednuy-3-5%" ? formGroup : undefined,
      rate: formTaxSystem === "ednuy-3-5%" ? formRate : undefined,
      has_employees: formHasEmployees,
      is_vat_payer: formIsVatPayer,
      reg_date: formRegDate,
      esv_paid_by_employer: formType === "fop" ? formEsvPaidByEmployer : false,
      address: formAddress || undefined,
      director_name: formDirectorName || undefined,
      phone: formPhone || undefined
    };

    try {
      if (editingProfile) {
        await api.updateProfile(editingProfile.id, payload);
      } else {
        await api.createProfile(payload);
      }
      await refreshProfiles();
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Помилка при збереженні профілю");
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete
  const handleDelete = async (profileId: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цей профіль? Це видалить усі пов'язані транзакції та звіти.")) {
      return;
    }

    try {
      await api.deleteProfile(profileId);
      if (selectedProfile?.id === profileId) {
        setSelectedProfile(null);
      }
      await refreshProfiles();
    } catch (err) {
      alert("Не вдалося видалити профіль");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400 bg-clip-text text-transparent">
            Управління профілями
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Керуйте своїми суб'єктами господарювання (ФОП та ТОВ) та їхніми податковими режимами.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all glow-button flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Додати профіль
        </button>
      </div>

      {/* Profiles list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((profile) => {
          const isFop = profile.type === "fop";
          const isActive = selectedProfile?.id === profile.id;

          return (
            <div
              key={profile.id}
              className={`p-6 rounded-2xl glass-panel relative border transition-all duration-300 ${
                isActive 
                  ? "border-indigo-500 dark:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 ring-1 ring-indigo-500" 
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              {/* Type indicator */}
              <div className="flex justify-between items-start mb-4">
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  isFop 
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-500/20" 
                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-500/20"
                }`}>
                  {isFop ? <User className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                  {isFop ? "ФОП" : "ТОВ / Компанія"}
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(profile)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                    title="Редагувати"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(profile.id)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                    title="Видалити"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & info */}
              <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate" title={profile.name}>
                {profile.name}
              </h3>
              
              <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>{isFop ? "РНОКПП (ІПН):" : "Код ЄДРПОУ:"}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{profile.tax_id || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Система оподаткування:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {["ednuy-3-5%", "single_tax", "fop_ep", "llc_ep"].includes(profile.tax_system) ? `Єдиний податок (Гр. ${profile.group || 3})` : "Загальна система"}
                  </span>
                </div>
                {["ednuy-3-5%", "single_tax", "fop_ep", "llc_ep"].includes(profile.tax_system) && (
                  <div className="flex justify-between">
                    <span>Ставка податку:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{profile.rate || 5}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Платник ПДВ:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{profile.is_vat_payer ? "Так" : "Ні"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Наймані працівники:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{profile.has_employees ? "Так" : "Ні"}</span>
                </div>
                {profile.type === "fop" && (
                  <div className="flex justify-between">
                    <span>ЄСВ сплачує роботодавець:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{profile.esv_paid_by_employer ? "Так" : "Ні"}</span>
                  </div>
                )}
                {profile.address && (
                  <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400">Юридична адреса:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-350 line-clamp-2">{profile.address}</span>
                  </div>
                )}
                {profile.director_name && (
                  <div className="flex justify-between pt-1">
                    <span>Директор (ПІБ):</span>
                    <span className="font-bold text-slate-705 dark:text-slate-300">{profile.director_name}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex justify-between">
                    <span>Телефон:</span>
                    <span className="font-bold text-slate-705 dark:text-slate-300">{profile.phone}</span>
                  </div>
                )}
              </div>

              {/* Subscription info */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Тариф:</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                    subscriptions[profile.id]?.plan === 'business' 
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' 
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {subscriptions[profile.id]?.plan === 'business' ? 'Business' : 'Free'}
                  </span>
                </div>
                
                {subscriptions[profile.id]?.plan === 'free' && (
                  <button 
                    onClick={() => window.location.href = "/settings/subscription"}
                    className="mt-3 w-full text-xs bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-all font-semibold"
                  >
                    Оновити до Business
                  </button>
                )}
              </div>

              {/* Quick activate button */}
              {!isActive && (
                <button
                  onClick={() => setSelectedProfile(profile)}
                  className="w-full mt-6 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 bg-white/50 dark:bg-slate-900/20 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-center transition-all"
                >
                  Зробити active-профілем
                </button>
              )}
              {isActive && (
                <div className="w-full mt-6 py-2 rounded-xl bg-indigo-500/10 text-xs font-bold text-indigo-600 dark:text-indigo-400 text-center border border-indigo-500/20">
                  Активний профіль
                </div>
              )}

              <button
                onClick={() => handleOpenInvoices(profile)}
                className="w-full mt-2 py-2 rounded-xl border border-amber-500/30 hover:border-amber-500 bg-amber-500/5 dark:bg-amber-950/10 text-xs font-bold text-amber-600 dark:text-amber-400 text-center transition-all flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                Рахунки та Акти (Авто-відправка)
              </button>
            </div>
          );
        })}

        {profiles.length === 0 && (
          <div className="col-span-full py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6 bg-slate-50/50 dark:bg-slate-950/10">
            <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Не додано жодного профілю</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Для того, щоб переглядати аналітику та подавати звіти, будь ласка, додайте свій перший ФОП або підприємство.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Додати профіль
            </button>
          </div>
        )}
      </div>

      {/* Profile Creation/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingProfile ? "Редагувати профіль" : "Новий профіль"}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Заповніть реєстраційні реквізити вашого підприємства чи ФОП.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                Закрити
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-500 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                  Тип організації
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-850">
                  <button
                    type="button"
                    onClick={() => setFormType("fop")}
                    className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      formType === "fop"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    ФОП (Фіз. особа)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("company")}
                    className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      formType === "company"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    ТОВ / Юр. особа
                  </button>
                </div>
              </div>

              {/* Name input */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                  Назва (ПІБ або Найменування компанії)
                </label>
                <input
                  type="text"
                  required
                  placeholder={formType === "fop" ? "ФОП Петренко Іван Васильович" : "ТОВ 'ЮНІТАС КОНСАЛТИНГ'"}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                />
              </div>

              {/* Tax ID input */}
              <div>
                <label className="text-[10px] text-slate-400 text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                  {formType === "fop" ? "РНОКПП (ІПН - 10 цифр)" : "ЄДРПОУ (8 цифр)"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={formType === "fop" ? 10 : 8}
                  placeholder={formType === "fop" ? "1234567890" : "87654321"}
                  value={formTaxId}
                  onChange={(e) => setFormTaxId(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                />
              </div>

              {/* Address input */}
              <div>
                <label className="text-[10px] text-slate-400 text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                  Юридична адреса
                </label>
                <textarea
                  placeholder="вул. Хрещатик, 1, м. Київ, 01001"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold resize-none h-18"
                />
              </div>

              {/* Phone input */}
              <div>
                <label className="text-[10px] text-slate-400 text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                  Номер телефону
                </label>
                <input
                  type="text"
                  placeholder="+380XXXXXXXXX"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                />
              </div>

              {/* Director name input */}
              {formType === "company" && (
                <div>
                  <label className="text-[10px] text-slate-400 text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                    ПІБ Директора
                  </label>
                  <input
                    type="text"
                    placeholder="Іванов Іван Іванович"
                    value={formDirectorName}
                    onChange={(e) => setFormDirectorName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Tax system switcher */}
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                    Оподаткування
                  </label>
                  <select
                    value={formTaxSystem}
                    onChange={(e) => setFormTaxSystem(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  >
                    <option value="ednuy-3-5%">Єдиний податок</option>
                    <option value="zagalna">Загальна система</option>
                  </select>
                </div>

                {/* Reg date picker */}
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                    Дата реєстрації
                  </label>
                  <input
                    type="date"
                    value={formRegDate}
                    onChange={(e) => setFormRegDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Group and rate fields (if EP) */}
              {formTaxSystem === "ednuy-3-5%" && (
                <div className="grid grid-cols-2 gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850">
                  <div>
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                      Група ЄП
                    </label>
                    <select
                      value={formGroup}
                      onChange={(e) => setFormGroup(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold"
                    >
                      <option value={1}>1 група</option>
                      <option value={2}>2 група</option>
                      <option value={3}>3 група</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                      Ставка податку
                    </label>
                    <select
                      value={formRate}
                      onChange={(e) => setFormRate(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold"
                    >
                      <option value={2}>2% (пільгова)</option>
                      <option value={3}>3% (+ПДВ)</option>
                      <option value={5}>5%</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="grid grid-cols-2 gap-4 py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsVatPayer}
                    onChange={(e) => setFormIsVatPayer(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Платник ПДВ</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formHasEmployees}
                    onChange={(e) => setFormHasEmployees(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Наймані працівники</span>
                </label>

                {formType === "fop" && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEsvPaidByEmployer}
                      onChange={(e) => setFormEsvPaidByEmployer(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">ЄСВ сплачує роботодавець (за основним місцем роботи)</span>
                  </label>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg disabled:opacity-50 glow-button"
              >
                {loading ? "Збереження..." : "Зберегти профіль"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invoices Modal */}
      {isInvoicesModalOpen && invoicesProfile && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 my-8">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  Рахунки та Акти: {invoicesProfile.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Налаштовуйте надсилання регулярних та разових інвойсів клієнтам.
                </p>
              </div>
              <button
                onClick={() => setIsInvoicesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-450 dark:hover:text-slate-200 text-sm font-semibold border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-xl"
              >
                Закрити
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-850">
              <button
                onClick={() => { setInvActiveTab("schedules"); setInvoiceFormOpen(false); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  invActiveTab === "schedules" && !invoiceFormOpen
                    ? "bg-white dark:bg-slate-850 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
                }`}
              >
                Авто-відправка
              </button>
              <button
                onClick={() => { setInvActiveTab("oneoff"); setInvoiceFormOpen(false); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  invActiveTab === "oneoff"
                    ? "bg-white dark:bg-slate-850 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
                }`}
              >
                Разовий рахунок
              </button>
              <button
                onClick={() => { setInvActiveTab("history"); setInvoiceFormOpen(false); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  invActiveTab === "history"
                    ? "bg-white dark:bg-slate-855 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
                }`}
              >
                Історія документів
              </button>
            </div>

            {invoicesLoading ? (
              <div className="py-16 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : invoiceFormOpen ? (
              /* Create Template Form */
              <form onSubmit={handleSaveRecurringInvoice} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Новий шаблон авто-надсилання</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Назва або ПІБ клієнта</label>
                    <input
                      type="text"
                      placeholder="Наприклад: ТОВ 'Вектор' або Фізична особа"
                      value={invClientName}
                      onChange={(e) => setInvClientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">ЄДРПОУ / ІПН клієнта</label>
                    <input
                      type="text"
                      placeholder="Наприклад: 12345678"
                      value={invClientTaxId}
                      onChange={(e) => setInvClientTaxId(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Тип операції (супутній документ)</label>
                    <select
                      value={invDocumentType}
                      onChange={(e) => setInvDocumentType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    >
                      <option value="act">Послуга (Акт виконаних робіт)</option>
                      <option value="waybill">Товар (Видаткова накладна)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Email клієнта *</label>
                    <input
                      type="email"
                      required
                      placeholder="client@company.com"
                      value={invClientEmail}
                      onChange={(e) => setInvClientEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Telegram ID клієнта (опціонально)</label>
                    <input
                      type="text"
                      placeholder="58291038"
                      value={invClientTg}
                      onChange={(e) => setInvClientTg(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Сума рахунку (грн) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="15000"
                      value={invAmount}
                      onChange={(e) => setInvAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Опис послуги / Назва товару *</label>
                    <input
                      type="text"
                      required
                      placeholder="Інформаційно-консультаційні послуги"
                      value={invServiceName}
                      onChange={(e) => setInvServiceName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Генерувати акт виконаних робіт</span>
                    <span className="text-[10px] text-slate-400">Автоматично створювати та надсилати акт разом із рахунком</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={invIncludeAct}
                    onChange={(e) => setInvIncludeAct(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-800 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Періодичність</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setInvPeriodicity("monthly"); setInvSendMonth(null); }}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        invPeriodicity === "monthly"
                          ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
                      }`}
                    >
                      Щомісячно
                    </button>
                    <button
                      type="button"
                      onClick={() => { setInvPeriodicity("specific"); setInvSendMonth(new Date().getMonth() + 1); }}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        invPeriodicity === "specific"
                          ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
                      }`}
                    >
                      Один раз на рік
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {invPeriodicity === "specific" && (
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Місяць відправки (1-12) *</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        required
                        value={invSendMonth || ""}
                        onChange={(e) => setInvSendMonth(parseInt(e.target.value, 10) || null)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none"
                      />
                    </div>
                  )}
                  <div className={invPeriodicity === "monthly" ? "col-span-2" : ""}>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Число відправки щомісяця (1-28) *</label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      required
                      placeholder="1"
                      value={invSendDay}
                      onChange={(e) => setInvSendDay(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setInvoiceFormOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs transition-all hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg glow-button"
                  >
                    Створити шаблон
                  </button>
                </div>
              </form>
            ) : invActiveTab === "oneoff" ? (
              /* One-off Invoice Form */
              <form onSubmit={handleSendOneoffInvoice} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Надіслати разовий рахунок</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Назва або ПІБ клієнта</label>
                    <input
                      type="text"
                      placeholder="Наприклад: ТОВ 'Вектор' або Фізична особа"
                      value={oneoffClientName}
                      onChange={(e) => setOneoffClientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">ЄДРПОУ / ІПН клієнта</label>
                    <input
                      type="text"
                      placeholder="Наприклад: 12345678"
                      value={oneoffClientTaxId}
                      onChange={(e) => setOneoffClientTaxId(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Тип операції (супутній документ)</label>
                    <select
                      value={oneoffDocumentType}
                      onChange={(e) => setOneoffDocumentType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    >
                      <option value="act">Послуга (Акт виконаних робіт)</option>
                      <option value="waybill">Товар (Видаткова накладна)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Email клієнта *</label>
                    <input
                      type="email"
                      required
                      placeholder="client@company.com"
                      value={oneoffClientEmail}
                      onChange={(e) => setOneoffClientEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Telegram ID клієнта (опціонально)</label>
                    <input
                      type="text"
                      placeholder="58291038"
                      value={oneoffClientTg}
                      onChange={(e) => setOneoffClientTg(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Сума рахунку (грн) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="15000"
                      value={oneoffAmount}
                      onChange={(e) => setOneoffAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Опис послуги / Назва товару *</label>
                    <input
                      type="text"
                      required
                      placeholder="Інформаційно-консультаційні послуги"
                      value={oneoffServiceName}
                      onChange={(e) => setOneoffServiceName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Генерувати акт виконаних робіт</span>
                    <span className="text-[10px] text-slate-400">Створити та надіслати акт виконаних робіт разом із рахунком</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={oneoffIncludeAct}
                    onChange={(e) => setOneoffIncludeAct(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-800 cursor-pointer"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setInvActiveTab("schedules")}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs transition-all hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={sendingOneoff}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg glow-button disabled:opacity-55"
                  >
                    {sendingOneoff ? "Надсилання..." : "Надіслати разовий рахунок"}
                  </button>
                </div>
              </form>
            ) : invActiveTab === "schedules" ? (
              /* Schedules Tab */
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-semibold">
                    Активних авто-відправок: {recurringInvoices.length}
                  </span>
                  <button
                    onClick={() => setInvoiceFormOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1 shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" /> Створити шаблон
                  </button>
                </div>

                {recurringInvoices.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <Calendar className="w-10 h-10 text-slate-350 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-bold">Немає створених шаблонів</p>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto mt-1">
                      Створивши шаблон, ви зможете автоматично або вручну в один клік виставляти рахунки та акти.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recurringInvoices.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-slate-250 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col justify-between space-y-4"
                      >
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.service_name}</h4>
                          <p className="text-xs text-slate-500 truncate mt-1">
                            Кому: {item.client_email} {item.client_telegram_id ? `(Tg: ${item.client_telegram_id})` : ""}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                              {item.amount.toLocaleString("uk-UA")} ₴
                            </span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold">
                              {item.send_month ? `${item.send_month}-го місяця, ` : ""}{item.send_day}-го числа
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800/60">
                          <button
                            onClick={() => handleOpenSendConfirm(item.id, false)}
                            className="flex-1 py-1.5 rounded-lg border border-slate-400/30 hover:border-slate-400 bg-slate-500/5 hover:bg-slate-500/10 text-[10px] font-extrabold text-slate-600 dark:text-slate-400 transition-all text-center"
                          >
                            Надіслати рахунок
                          </button>
                          <button
                            onClick={() => handleOpenSendConfirm(item.id, true)}
                            className="flex-[1.2] py-1.5 rounded-lg border border-amber-500/30 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 text-[10px] font-extrabold text-amber-600 dark:text-amber-400 transition-all text-center"
                          >
                            Рахунок + Акт
                          </button>
                          <button
                            onClick={() => handleDeleteRecurringInvoice(item.id)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
                            title="Видалити"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* History Tab */
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <span className="text-xs text-slate-400 font-semibold block">Історія згенерованих документів</span>
                
                {invoicesHistory.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    В історії поки немає надісланих документів.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-400">
                      <thead className="text-[10px] text-slate-450 uppercase bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5">Номер</th>
                          <th className="px-4 py-2.5">Опис</th>
                          <th className="px-4 py-2.5">Клієнт</th>
                          <th className="px-4 py-2.5 text-right">Сума</th>
                          <th className="px-4 py-2.5">Дата</th>
                          <th className="px-4 py-2.5">Акт</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoicesHistory.map((inv, idx) => (
                          <tr key={idx} className="border-b border-slate-200 dark:border-slate-800/40 bg-slate-900/5 hover:bg-slate-900/10 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                              {inv.invoice_number}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[150px] truncate font-medium">
                              {inv.service_name}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                              {inv.client_email}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-350 font-extrabold">
                              {inv.amount.toLocaleString("uk-UA")} ₴
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {inv.send_date}
                            </td>
                            <td className="px-4 py-3">
                              {inv.act_number ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 font-bold">
                                  {inv.act_number}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Immediate Send Confirmation Dialog */}
      {isSendConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Підтвердження відправки</h3>
              <p className="text-xs text-slate-400 mt-1">
                Буде негайно згенеровано рахунок та надіслано клієнту на вказаний email.
              </p>
            </div>

            {/* Include act toggler */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Генерувати акт виконаних робіт</span>
              </div>
              <input
                type="checkbox"
                checked={sendIncludeAct}
                onChange={(e) => setSendIncludeAct(e.target.checked)}
                className="w-5 h-5 text-indigo-600 border-slate-350 rounded cursor-pointer"
              />
            </div>

            {/* Custom date toggler */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Встановити дату документа вручную</span>
              </div>
              <input
                type="checkbox"
                checked={customDateEnabled}
                onChange={(e) => setCustomDateEnabled(e.target.checked)}
                className="w-5 h-5 text-indigo-600 border-slate-350 rounded cursor-pointer"
              />
            </div>

            {customDateEnabled && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">День (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={customSendDay}
                    onChange={(e) => setCustomSendDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">Місяць (1-12)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={customSendMonth}
                    onChange={(e) => setCustomSendMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-bold text-center"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={sendingInvoice}
                onClick={() => setIsSendConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs transition-all hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={sendingInvoice}
                onClick={handleConfirmSendInvoice}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg"
              >
                {sendingInvoice ? (
                  <div className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                ) : (
                  "Надіслати"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
