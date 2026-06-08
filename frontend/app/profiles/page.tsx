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
  FileText,
  Crown,
  Loader2,
  CreditCard,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  X
} from "lucide-react";

export default function Profiles() {
  const { profiles, refreshProfiles, selectedProfile, setSelectedProfile } = useApp();
  const { telegramId } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<{ [key: number]: any }>({});

  // Subscription wizard states
  const [modalStep, setModalStep] = useState<"details" | "plan" | "period">("details");
  const [createdProfileId, setCreatedProfileId] = useState<number | null>(null);
  const [pricingOptions, setPricingOptions] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("monthly");
  const [liqpayForm, setLiqpayForm] = useState<any>(null);

  // Subscription management modal states
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subModalProfile, setSubModalProfile] = useState<any>(null);
  const [subModalSubscription, setSubModalSubscription] = useState<any>(null);
  const [subModalUsage, setSubModalUsage] = useState({ used: 0, limit: 5 });
  const [subModalPaymentsList, setSubModalPaymentsList] = useState<any[]>([]);
  const [subModalPeriod, setSubModalPeriod] = useState<"monthly" | "yearly">("monthly");
  const [subModalLoading, setSubModalLoading] = useState(false);
  const [subModalLoadingData, setSubModalLoadingData] = useState(false);
  const [subModalRefreshingHistory, setSubModalRefreshingHistory] = useState(false);
  const [subModalLiqpayForm, setSubModalLiqpayForm] = useState<any>(null);

  // Auto-submit LiqPay payment form when it updates inside sub modal
  useEffect(() => {
    if (subModalLiqpayForm) {
      const form = document.getElementById("sub-modal-liqpay-form") as HTMLFormElement;
      if (form) {
        form.submit();
      }
    }
  }, [subModalLiqpayForm]);

  const handleOpenSubscriptionModal = async (profile: any) => {
    setSubModalProfile(profile);
    setIsSubModalOpen(true);
    setSubModalLoadingData(true);
    setSubModalLiqpayForm(null);
    try {
      const subData = await api.getCurrentSubscription(profile.id);
      setSubModalSubscription(subData);
      if (subData.payment_period) {
        setSubModalPeriod(subData.payment_period === "yearly" ? "yearly" : "monthly");
      } else {
        setSubModalPeriod("monthly");
      }

      const usageData = await api.getSubscriptionUsage(profile.id);
      setSubModalUsage(usageData);

      const paymentsData = await api.getProfilePayments(profile.id);
      setSubModalPaymentsList(paymentsData);
    } catch (err) {
      console.error("Failed to load subscription modal details:", err);
    } finally {
      setSubModalLoadingData(false);
    }
  };

  const handleSubModalCheckout = async () => {
    if (!subModalProfile) return;
    setSubModalLoading(true);
    try {
      const res = await api.createPayment({
        profile_id: subModalProfile.id,
        plan_type: "business",
        payment_period: subModalPeriod
      });

      if (res.payment_required) {
        setSubModalLiqpayForm(res);
      } else {
        alert("Тариф Business успішно активовано!");
        const subData = await api.getCurrentSubscription(subModalProfile.id);
        setSubModalSubscription(subData);
        await refreshProfiles();
      }
    } catch (error) {
      console.error("Error creating subscription payment:", error);
      alert("Помилка при спробі створити платіж. Спробуйте пізніше.");
    } finally {
      setSubModalLoading(false);
    }
  };

  const handleSubModalUpgradeDemo = async () => {
    if (!subModalProfile) return;
    setSubModalLoading(true);
    try {
      const data = await api.upgradeToBusiness(subModalProfile.id);
      alert(data.message || "Підписку активовано!");
      const subData = await api.getCurrentSubscription(subModalProfile.id);
      setSubModalSubscription(subData);
      await refreshProfiles();
    } catch (error) {
      console.error("Error upgrading directly:", error);
      alert("Помилка при прямому підключенні підписки");
    } finally {
      setSubModalLoading(false);
    }
  };

  const handleSubModalCancelAutoRenew = async () => {
    if (!subModalProfile) return;
    if (!confirm("Ви впевнені, що хочете вимкнути автопродовження підписки?")) {
      return;
    }
    setSubModalLoading(true);
    try {
      await api.cancelSubscription(subModalProfile.id);
      alert("Автопродовження успішно вимкнено. Ваш тариф діятиме до закінчення сплаченого періоду.");
      const subData = await api.getCurrentSubscription(subModalProfile.id);
      setSubModalSubscription(subData);
    } catch (error) {
      console.error("Error canceling subscription:", error);
      alert("Помилка при вимкненні автопродовження");
    } finally {
      setSubModalLoading(false);
    }
  };

  const handleSubModalRefreshHistory = async () => {
    if (!subModalProfile) return;
    setSubModalRefreshingHistory(true);
    try {
      const paymentsData = await api.getProfilePayments(subModalProfile.id);
      setSubModalPaymentsList(paymentsData);
    } catch (e) {
      console.error("Failed to load payments history:", e);
    } finally {
      setSubModalRefreshingHistory(false);
    }
  };

  // Fetch pricing options
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const prices = await api.getPricing();
        setPricingOptions(prices);
      } catch (err) {
        console.error("Failed to load pricing options:", err);
      }
    };
    fetchPricing();
  }, []);

  const getPriceVal = (period: "monthly" | "yearly") => {
    const found = pricingOptions.find(p => p.plan_type === "business" && p.payment_period === period);
    return found ? found.price : (period === "monthly" ? 499 : 4989);
  };

  const handleSubscribe = async (planType: string, period: string) => {
    if (!createdProfileId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.createPayment({
        profile_id: createdProfileId,
        plan_type: planType,
        payment_period: period
      });
      if (res.payment_required) {
        setLiqpayForm(res);
      } else {
        alert("Безкоштовний тариф активовано!");
        setIsModalOpen(false);
        await refreshProfiles();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Помилка при активації підписки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (liqpayForm) {
      const form = document.getElementById("liqpay-submit-form") as HTMLFormElement;
      if (form) {
        form.submit();
      }
    }
  }, [liqpayForm]);

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
  const [formBankName, setFormBankName] = useState("");
  const [formMfo, setFormMfo] = useState("");
  const [formIban, setFormIban] = useState("");

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
    setFormBankName("");
    setFormMfo("");
    setFormIban("");
    setError(null);
    setModalStep("details");
    setCreatedProfileId(null);
    setLiqpayForm(null);
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
    setFormBankName(profile.bank_name || "");
    setFormMfo(profile.mfo || "");
    setFormIban(profile.iban || "");
    setError(null);
    setModalStep("details");
    setCreatedProfileId(null);
    setLiqpayForm(null);
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
      phone: formPhone || undefined,
      bank_name: formBankName || undefined,
      mfo: formMfo || undefined,
      iban: formIban || undefined
    };

    try {
      if (editingProfile) {
        await api.updateProfile(editingProfile.id, payload);
        await refreshProfiles();
        setIsModalOpen(false);
      } else {
        const createdProfile = await api.createProfile(payload);
        
        // Find or fallback to retrieve the first profile id
        const firstProfileId = createdProfile?.id;
        
        if (profiles.length === 0) {
          // Refresh profiles state
          await refreshProfiles();
          
          if (firstProfileId) {
            setCreatedProfileId(firstProfileId);
            setModalStep("plan");
          } else {
            // Get profile list from API to find the ID
            const data = await api.getProfiles(telegramId);
            if (data && data.length > 0) {
              setCreatedProfileId(data[0].id);
              setModalStep("plan");
            } else {
              setIsModalOpen(false);
            }
          }
        } else {
          await refreshProfiles();
          setIsModalOpen(false);
        }
      }
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
                  <span 
                    onClick={() => handleOpenSubscriptionModal(profile)}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-lg cursor-pointer hover:scale-[1.03] active:scale-95 transition-all select-none ${
                      subscriptions[profile.id]?.plan === 'business' 
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-500/20' 
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-700/20'
                    }`}
                  >
                    {subscriptions[profile.id]?.plan === 'business' ? 'Business' : 'Free'}
                  </span>
                </div>
                
                {subscriptions[profile.id]?.plan === 'free' && (
                  <button 
                    onClick={() => handleOpenSubscriptionModal(profile)}
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
              </button>
            </div>
          );
        })}

        {profiles.length === 0 && (
          <div className="col-span-full py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6 bg-slate-50/50 dark:bg-slate-950/10">
            <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Не додано жодного профілю</h3>
            <p className="text-xs text-slate-555 dark:text-slate-400 mt-1 max-w-sm mx-auto">
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {liqpayForm ? (
              /* LiqPay Redirect Page */
              <div className="text-center p-8 space-y-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Перенаправлення на LiqPay...</h3>
                <p className="text-xs text-slate-500">Будь ласка, зачекайте. Ми перенаправляємо вас на захищену сторінку оплати.</p>
                <form id="liqpay-submit-form" method="POST" action={liqpayForm.api_url}>
                  <input type="hidden" name="data" value={liqpayForm.liqpay_data} />
                  <input type="hidden" name="signature" value={liqpayForm.liqpay_signature} />
                </form>
              </div>
            ) : modalStep === "plan" ? (
              /* Step 2: Choose Plan (Free vs Business) */
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="text-center">
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Оберіть ваш тарифний план</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Активуйте тариф для профілю, щоб почати користуватися сервісом
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Free Card */}
                  <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">Тариф Free</h4>
                        <p className="text-xs text-slate-500">Базовий функціонал</p>
                      </div>
                      <span className="text-xl font-black text-slate-900 dark:text-white">0 грн</span>
                    </div>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc pl-4">
                      <li>До 5 виписок на місяць</li>
                      <li>Базові розрахунки податків</li>
                      <li>Формування звітів (чернетки)</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleSubscribe("free", "monthly")}
                      disabled={loading}
                      className="w-full py-2 rounded-xl border border-slate-250 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all"
                    >
                      Активувати Free
                    </button>
                  </div>

                  {/* Business Card */}
                  <div className="p-5 rounded-2xl border-2 border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/5 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-lg">
                      Популярно
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">Тариф Business</h4>
                        <p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold">Повний ШІ-функціонал</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-slate-900 dark:text-white">від {getPriceVal("yearly") / 12} грн</span>
                        <span className="text-[10px] text-slate-500 block">/місяць</span>
                      </div>
                    </div>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc pl-4">
                      <li>Безлімітний ШІ-асистент</li>
                      <li>Повна автоматизація звітів та подачі в ДПС</li>
                      <li>Автоматичні рахунки та акти для клієнтів</li>
                      <li>Інтеграція з банками (API)</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => setModalStep("period")}
                      className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/20"
                    >
                      Обрати Business
                    </button>
                  </div>
                </div>
              </div>
            ) : modalStep === "period" ? (
              /* Step 3: Choose Payment Period */
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="text-center">
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Період оплати</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Оберіть зручний період для підписки Business
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Monthly card */}
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod("monthly")}
                    className={`p-5 rounded-2xl border text-left space-y-2 transition-all ${
                      selectedPeriod === "monthly"
                        ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10 ring-1 ring-indigo-500"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-750"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">Помісячно</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{getPriceVal("monthly")} грн</span>
                      <span className="text-[10px] text-slate-400">/міс</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Сплачуйте кожен місяць за повний доступ</p>
                  </button>

                  {/* Yearly card */}
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod("yearly")}
                    className={`p-5 rounded-2xl border text-left space-y-2 transition-all relative overflow-hidden ${
                      selectedPeriod === "yearly"
                        ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10 ring-1 ring-indigo-500"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-750"
                    }`}
                  >
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-bl-lg">
                      Економія ~16%
                    </div>
                    <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Річна підписка</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{getPriceVal("yearly")} грн</span>
                      <span className="text-[10px] text-slate-400">/рік</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Вигідний тариф на 12 місяців</p>
                  </button>
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-500 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalStep("plan")}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubscribe("business", selectedPeriod)}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/20"
                  >
                    {loading ? "Завантаження..." : "Перейти до оплати"}
                  </button>
                </div>
              </div>
            ) : (
              /* Step 1: Details (FOP/Company Profile Form) */
              <>
                <div className="flex justify-between items-start p-6 pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
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
                  <div className="mx-6 mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-500 flex items-start gap-2 shrink-0">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 pr-4 custom-scrollbar">
                    {/* Type Switcher */}
                    <div>
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                        Тип організації
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-855">
                        <button
                          type="button"
                          onClick={() => setFormType("fop")}
                          className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            formType === "fop"
                              ? "bg-white dark:bg-slate-805 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50"
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
                              ? "bg-white dark:bg-slate-805 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50"
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
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">
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
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">
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
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">
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

                    {/* Bank Details section */}
                    <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 space-y-4">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Банківські реквізити (для рахунків-фактур)
                      </h4>

                      <div>
                        <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                          Назва банку отримувача
                        </label>
                        <input
                          type="text"
                          placeholder="АТ 'УНІВЕРСАЛ БАНК'"
                          value={formBankName}
                          onChange={(e) => setFormBankName(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                          <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                            МФО
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="310530"
                            value={formMfo}
                            onChange={(e) => setFormMfo(e.target.value.replace(/\D/g, ""))}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                            Рахунок IBAN (29 знаків)
                          </label>
                          <input
                            type="text"
                            maxLength={29}
                            placeholder="UA89310530000002600XXXXXXXXX"
                            value={formIban}
                            onChange={(e) => setFormIban(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Director name input */}
                    {formType === "company" && (
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5 block">
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
                        <label className="flex items-center gap-2 cursor-pointer col-span-2">
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
                  </div>

                  {/* Pinned Footer Actions */}
                  <div className="p-6 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/10 shrink-0 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
                    >
                      Скасувати
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg disabled:opacity-50 glow-button"
                    >
                      {loading ? "Збереження..." : "Зберегти профіль"}
                    </button>
                  </div>
                </form>
              </>
            )}
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

      {/* Client Profile Subscription Modal */}
      {isSubModalOpen && subModalProfile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Hidden LiqPay Submit Form */}
            {subModalLiqpayForm && (
              <form id="sub-modal-liqpay-form" method="POST" action={subModalLiqpayForm.api_url}>
                <input type="hidden" name="data" value={subModalLiqpayForm.liqpay_data} />
                <input type="hidden" name="signature" value={subModalLiqpayForm.liqpay_signature} />
              </form>
            )}

            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500 animate-pulse" />
                  Керування підпискою: {subModalProfile.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Виберіть тарифний план та переглядайте фінансову історію вашої компанії.
                </p>
              </div>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {subModalLoadingData ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider animate-pulse">Завантаження деталей...</p>
                </div>
              ) : (
                <>
                  {/* Subscription Info cards */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Left side: options */}
                    <div className="md:col-span-7 space-y-6">
                      <div className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 p-4 border border-slate-100 dark:border-slate-800/80 rounded-2xl">
                        <div>
                          <span className="text-[10px] text-indigo-500 dark:text-indigo-400 uppercase font-black tracking-wider block">Тариф Business</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Виберіть період підписки:</span>
                        </div>
                        <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setSubModalPeriod("monthly")}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                              subModalPeriod === "monthly"
                                ? "bg-indigo-600 text-white shadow"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            }`}
                          >
                            Місяць
                          </button>
                          <button
                            type="button"
                            onClick={() => setSubModalPeriod("yearly")}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                              subModalPeriod === "yearly"
                                ? "bg-indigo-600 text-white shadow"
                                : "text-slate-550 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            }`}
                          >
                            <span>Рік</span>
                            <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1 py-0.5 rounded text-[8px] font-black">-16%</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Free card */}
                        <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 ${
                          subModalSubscription?.plan !== "business"
                            ? "bg-slate-50 dark:bg-slate-900/40 border-indigo-500/30"
                            : "bg-slate-50/20 dark:bg-slate-950/20 border-slate-100 dark:border-slate-850/60 opacity-60"
                        }`}>
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Тариф Free</h4>
                              {subModalSubscription?.plan !== "business" && (
                                <span className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/25 px-2 py-0.5 rounded text-[9px] uppercase font-bold">Активний</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-555 block mt-1 uppercase font-bold tracking-wider">Базові функції</span>
                            <div className="mt-4 flex items-baseline gap-1">
                              <span className="text-2xl font-black text-slate-900 dark:text-white">0</span>
                              <span className="text-xs text-slate-400">грн / міс</span>
                            </div>
                            <ul className="mt-4 space-y-2 text-[11px] text-slate-555 dark:text-slate-400">
                              <li className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-405 shrink-0" />
                                <span>До 5 виписок на місяць</span>
                              </li>
                              <li className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-405 shrink-0" />
                                <span>Базові розрахунки податків</span>
                              </li>
                            </ul>
                          </div>

                          <div className="mt-6">
                            {subModalSubscription?.plan !== "business" ? (
                              <button disabled className="w-full py-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-indigo-550 dark:text-indigo-400 text-xs font-bold cursor-default">
                                Поточний тариф
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (confirm("Ви дійсно хочете перейти на безкоштовний тариф? Ваш сплачений Business буде скасовано.")) {
                                    setSubModalLoading(true);
                                    try {
                                      await api.createPayment({
                                        profile_id: subModalProfile.id,
                                        plan_type: "free",
                                        payment_period: "monthly"
                                      });
                                      alert("Перехід на безкоштовний тариф успішно виконано!");
                                      handleOpenSubscriptionModal(subModalProfile);
                                      await refreshProfiles();
                                    } catch (e) {
                                      alert("Не вдалося змінити тариф");
                                    } finally {
                                      setSubModalLoading(false);
                                    }
                                  }
                                }}
                                className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white/50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all"
                              >
                                Перейти на Free
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Business card */}
                        <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 relative ${
                          subModalSubscription?.plan === "business"
                            ? "bg-slate-50 dark:bg-slate-900/40 border-amber-500/35"
                            : "bg-slate-50/20 dark:bg-slate-950/20 border-slate-100 dark:border-slate-850/60 hover:border-slate-200 dark:hover:border-slate-800"
                        }`}>
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                                Тариф Business
                              </h4>
                              {subModalSubscription?.plan === "business" && (
                                <span className="bg-amber-500/10 text-amber-550 border border-amber-500/25 px-2 py-0.5 rounded text-[9px] uppercase font-bold">Активний</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-555 block mt-1 uppercase font-bold tracking-wider">ШІ-асистент без лімітів</span>
                            <div className="mt-4 flex items-baseline gap-1">
                              <span className="text-2xl font-black text-slate-900 dark:text-white">
                                {subModalPeriod === "monthly" ? getPriceVal("monthly") : getPriceVal("yearly")}
                              </span>
                              <span className="text-xs text-slate-400">грн / {subModalPeriod === "monthly" ? "міс" : "рік"}</span>
                            </div>
                            <ul className="mt-4 space-y-2 text-[11px] text-slate-555 dark:text-slate-400">
                              <li className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span>Безлімітні виписки</span>
                              </li>
                              <li className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span>ШІ формування та подача звітів</span>
                              </li>
                            </ul>
                          </div>

                          <div className="mt-6 space-y-2">
                            <button
                              onClick={handleSubModalCheckout}
                              disabled={subModalLoading}
                              className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                subModalLoading
                                  ? "bg-amber-600/50 text-white/50 cursor-not-allowed"
                                  : subModalSubscription?.plan === "business" && subModalSubscription?.payment_period === subModalPeriod
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-805 dark:text-white border border-slate-200 dark:border-slate-700"
                                    : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white"
                              }`}
                            >
                              {subModalLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : subModalSubscription?.plan === "business" && subModalSubscription?.payment_period === subModalPeriod ? (
                                <>
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Продовжити термін</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-3 h-3" />
                                  <span>
                                    {subModalSubscription?.plan === "business" ? "Змінити період" : `Придбати`}
                                  </span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={handleSubModalUpgradeDemo}
                              disabled={subModalLoading}
                              className="w-full py-1.5 rounded-xl text-[9px] font-bold text-indigo-500 hover:text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 transition-all flex items-center justify-center gap-1"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Швидка демо-активація</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side: subscription details */}
                    <div className="md:col-span-5 space-y-6">
                      <div className="p-5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-4">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Деталі підписки</span>
                        
                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-900/60">
                            <span className="text-slate-500">План:</span>
                            <span className="font-bold text-slate-900 dark:text-slate-200 capitalize">{subModalSubscription?.plan || "Free"}</span>
                          </div>
                          
                          <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-900/60">
                            <span className="text-slate-500">Статус:</span>
                            <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                              subModalSubscription?.status === "active"
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : subModalSubscription?.status === "pending"
                                  ? "bg-amber-500/10 text-amber-550 border border-amber-500/20"
                                  : "bg-slate-150 dark:bg-slate-800 text-slate-500"
                            }`}>
                              {subModalSubscription?.status === "active" ? "Активна" : subModalSubscription?.status === "pending" ? "Очікує оплати" : "Free"}
                            </span>
                          </div>

                          {subModalSubscription?.plan === "business" && (
                            <>
                              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-900/60">
                                <span className="text-slate-550">Діє до:</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                  {subModalSubscription.expires_at ? new Date(subModalSubscription.expires_at).toLocaleDateString("uk-UA") : "Необмежено"}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-900/60">
                                <span className="text-slate-550">Автопродовження:</span>
                                <span className={`font-bold ${subModalSubscription.auto_renew ? "text-emerald-500" : "text-rose-500"}`}>
                                  {subModalSubscription.auto_renew ? "Увімкнено" : "Вимкнено"}
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {subModalSubscription?.plan === "business" && subModalSubscription.auto_renew && (
                          <button
                            onClick={handleSubModalCancelAutoRenew}
                            disabled={subModalLoading}
                            className="w-full py-2.5 rounded-xl border border-rose-500/15 bg-rose-500/5 hover:bg-rose-500/10 text-rose-550 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Вимкнути автопродовження</span>
                          </button>
                        )}
                      </div>

                      {/* Usage details for Free tariff */}
                      {subModalSubscription?.plan !== "business" && (
                        <div className="p-5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Використання виписок:</span>
                            <span className="font-bold text-slate-900 dark:text-white">{subModalUsage.used} / {subModalUsage.limit}</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2">
                            <div
                              className="bg-indigo-650 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, (subModalUsage.used / subModalUsage.limit) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed italic">
                            * Ліміт оновлюється щомісяця. Придбайте підписку Business, щоб зняти будь-які обмеження на обсяг виписок.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Billing Invoices Table */}
                  <div className="p-6 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Історія рахунків та оплат</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Журнал виписаних рахунків та оплат через LiqPay.</p>
                      </div>
                      <button
                        onClick={handleSubModalRefreshHistory}
                        disabled={subModalRefreshingHistory}
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-slate-350 dark:hover:border-slate-700 text-slate-450 hover:text-slate-800 dark:hover:text-white transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${subModalRefreshingHistory ? "animate-spin" : ""}`} />
                      </button>
                    </div>

                    {subModalPaymentsList.length === 0 ? (
                      <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-500">
                        <Clock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                        <span>Журнал оплат порожній</span>
                      </div>
                    ) : (
                      <div className="border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-900/65 text-slate-500 border-b border-slate-250 dark:border-slate-800">
                            <tr>
                              <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Призначення</th>
                              <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Сума</th>
                              <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Період</th>
                              <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Дата</th>
                              <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Статус</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 dark:divide-slate-800/40">
                            {subModalPaymentsList.map((p) => {
                              const isSub = p.payment_type === "subscription";
                              return (
                                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all">
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                        isSub
                                          ? "bg-amber-100 text-amber-700 border border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
                                          : "bg-indigo-100 text-indigo-700 border border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400"
                                      }`}>
                                        {isSub ? "Підписка" : "Податок"}
                                      </span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {isSub ? `Upgrade to Business (${p.period === "yearly" ? "Рік" : "Місяць"})` : `Податок: ${p.tax_type.toUpperCase()}`}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 font-extrabold text-slate-800 dark:text-white">{p.amount} грн</td>
                                  <td className="p-3 text-slate-550 dark:text-slate-400 capitalize">{p.period || "—"}</td>
                                  <td className="p-3 text-slate-550 dark:text-slate-400 font-semibold">{p.created_at || "—"}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase inline-flex items-center gap-0.5 ${
                                      p.status === "paid"
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                                        : "bg-amber-100 text-amber-700 border border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
                                    }`}>
                                      {p.status === "paid" ? "Сплачено" : "Очікує"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/10 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSubModalOpen(false)}
                className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
              >
                Закрити
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
