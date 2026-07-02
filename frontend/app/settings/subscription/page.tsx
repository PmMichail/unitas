"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { 
  Check, 
  Crown, 
  Loader2, 
  Calendar, 
  CreditCard, 
  HelpCircle, 
  AlertCircle, 
  XCircle, 
  CheckCircle2, 
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Mail,
  Send
} from "lucide-react";


export default function SubscriptionPage() {
  const { selectedProfile, refreshProfiles, telegramId } = useApp();
  const [subscription, setSubscription] = useState<any>(null);
  const [prices, setPrices] = useState({ monthly: 299, half_yearly: 1499, yearly: 2999 });
  const [usage, setUsage] = useState({ used: 0, limit: 5 });
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  
  // OSBB Plans States
  const [plans, setPlans] = useState<any[]>([
    { 
      id: 1, 
      name: "Бізнес", 
      price: 299, 
      has_member_module: true, 
      member_module_price: 250,
      prices: { monthly: 299, half_yearly: 1499, yearly: 2999 },
      module_price: { monthly: 250, half_yearly: 1500, yearly: 3000 },
      has_module: true
    }
  ]);
  const [selectedPlanId, setSelectedPlanId] = useState<number>(1);
  const [enableMemberModule, setEnableMemberModule] = useState<boolean>(false);
  
  // New Tariff System States
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [selectedTariff, setSelectedTariff] = useState<any>(null);
  const [enableResidentModule, setEnableResidentModule] = useState<boolean>(false);
  const [residentTiers, setResidentTiers] = useState<any[]>([]);
  const [selectedResidentTiers, setSelectedResidentTiers] = useState<number[]>([]);
  
  // UI States
  const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "half_yearly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [liqpayForm, setLiqpayForm] = useState<any>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  // Send invoice states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceSuccess, setInvoiceSuccess] = useState<string | null>(null);

  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const handleOpenInvoiceModal = () => {
    const savedEmail = localStorage.getItem("notify_email") || "";
    const emailToUse = savedEmail || (telegramId && telegramId.includes("@") ? telegramId : "");
    setInvoiceEmail(emailToUse);
    setInvoiceError(null);
    setInvoiceSuccess(null);
    setShowInvoiceModal(true);
  };

  const getCalculatedPrice = () => {
    if (!selectedTariff) return 0;
    let monthlyTotal = selectedTariff.monthly_price;
    if (selectedProfile?.tax_system === "non_profit" && enableResidentModule) {
      const residentTariff = tariffs.find((t: any) => t.code === "resident_module");
      if (residentTariff) {
        monthlyTotal += residentTariff.base_resident_price || 0;
        selectedResidentTiers.forEach(tierIndex => {
          if (residentTariff.additional_resident_tiers && residentTariff.additional_resident_tiers[tierIndex]) {
            monthlyTotal += residentTariff.additional_resident_tiers[tierIndex].price;
          }
        });
      }
    }
    
    let total = monthlyTotal;
    if (selectedPeriod === "half_yearly") {
      const basePrice = monthlyTotal * 6;
      const discount = selectedTariff.half_yearly_discount || 0;
      total = Math.round(basePrice * (1 - discount / 100));
    } else if (selectedPeriod === "yearly") {
      const basePrice = monthlyTotal * 12;
      const discount = selectedTariff.yearly_discount || 0;
      total = Math.round(basePrice * (1 - discount / 100));
    }
    return total;
  };

  const handleDownloadInvoice = async () => {
    if (!selectedProfile) return;
    setDownloadingInvoice(true);
    setInvoiceError(null);
    setInvoiceSuccess(null);
    try {
      const amount = getCalculatedPrice();
      const tariff_code = selectedTariff?.code;
      const blob = await api.downloadSubscriptionInvoicePDF({
        profile_id: selectedProfile.id,
        plan_type: "business",
        payment_period: selectedPeriod,
        amount,
        tariff_code
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${selectedProfile.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setInvoiceSuccess("Рахунок успішно згенеровано та завантажено!");
      fetchPaymentsHistory();
      setTimeout(() => {
        setShowInvoiceModal(false);
        setInvoiceSuccess(null);
      }, 3000);
    } catch (e: any) {
      console.error(e);
      setInvoiceError("Не вдалося завантажити рахунок");
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!selectedProfile) return;
    if (!invoiceEmail) {
      setInvoiceError("Будь ласка, введіть email");
      return;
    }
    setSendingInvoice(true);
    setInvoiceError(null);
    try {
      const amount = getCalculatedPrice();
      const tariff_code = selectedTariff?.code;
      await api.sendSubscriptionInvoice({
        profile_id: selectedProfile.id,
        plan_type: "business",
        payment_period: selectedPeriod,
        email: invoiceEmail,
        amount,
        tariff_code
      });
      setInvoiceSuccess("Рахунок успішно надіслано на вашу пошту! Також ви можете переглянути його в історії счетов.");
      setTimeout(() => {
        setShowInvoiceModal(false);
        setInvoiceSuccess(null);
        fetchPaymentsHistory(); // refresh payment list
      }, 3000);
    } catch (e: any) {
      console.error(e);
      setInvoiceError(e.response?.data?.detail || "Не вдалося надіслати рахунок");
    } finally {
      setSendingInvoice(false);
    }
  };


  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true") {
        setShowSuccessBanner(true);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, []);

  // Auto-submit LiqPay payment form when it updates
  useEffect(() => {
    if (liqpayForm) {
      const form = document.getElementById("liqpay-submit-form") as HTMLFormElement;
      if (form) {
        form.submit();
      }
    }
  }, [liqpayForm]);

  useEffect(() => {
    loadData();
  }, [selectedProfile]);

  const loadData = async () => {
    if (!selectedProfile) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    try {
      await Promise.all([
        fetchSubscriptionDetails(),
        fetchPricingDetails(),
        fetchUsageDetails(),
        fetchPaymentsHistory(),
        fetchPlans(),
        fetchTariffs()
      ]);
    } catch (error) {
      console.error("Error loading subscription data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const data = await api.getSubscriptionPlans();
      if (data && data.plans && data.plans.length > 0) {
        setPlans(data.plans);
        const premium = data.plans.find((p: any) => p.has_member_module);
        if (premium) {
          setSelectedPlanId(premium.id);
        } else {
          setSelectedPlanId(data.plans[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load subscription plans:", e);
      setPlans([
        { 
          id: 1, 
          name: "Бізнес", 
          price: 299, 
          has_member_module: true, 
          member_module_price: 250,
          prices: { monthly: 299, half_yearly: 1499, yearly: 2999 },
          module_price: { monthly: 250, half_yearly: 1500, yearly: 3000 },
          has_module: true
        }
      ]);
    }
  };

  const fetchSubscriptionDetails = async () => {
    try {
      const subData = await api.getCurrentSubscription(selectedProfile.id);
      setSubscription(subData);
      if (subData.payment_period) {
        setSelectedPeriod(
          subData.payment_period === "yearly" 
            ? "yearly" 
            : subData.payment_period === "half_yearly" 
              ? "half_yearly" 
              : "monthly"
        );
      }
      setEnableMemberModule(!!subData.is_member_module_active || !!subData.has_resident_cabinet);
    } catch (e) {
      console.error("Failed to load subscription details:", e);
    }
  };

  const fetchTariffs = async () => {
    try {
      const response = await fetch("https://unitas-backend.fly.dev/api/tariffs");
      const data = await response.json();
      setTariffs(data || []);
      
      // Initialize resident tiers from data
      const residentTariff = data?.find((t: any) => t.code === "resident_module");
      if (residentTariff?.additional_resident_tiers) {
        setResidentTiers(residentTariff.additional_resident_tiers);
      }
      
      // Select appropriate tariff based on profile type
      if (selectedProfile) {
        if (selectedProfile.tax_system === "non_profit" || selectedProfile.organization_subtype === "osbb" || selectedProfile.organization_subtype === "st" || selectedProfile.organization_subtype === "cooperative" || selectedProfile.organization_subtype === "go" || selectedProfile.organization_subtype === "bf") {
          const nonProfitTariff = data?.find((t: any) => t.code === "non_profit");
          if (nonProfitTariff) {
            setSelectedTariff(nonProfitTariff);
          }
        } else if (subscription?.tariff_code && subscription.tariff_code !== "free" && subscription.tariff_code !== "business" && subscription.tariff_code !== "fop") {
          const existingTariff = data?.find((t: any) => t.code === subscription.tariff_code);
          if (existingTariff) {
            setSelectedTariff(existingTariff);
          } else {
            selectTariffByProfileType(data, selectedProfile);
          }
        } else {
          selectTariffByProfileType(data, selectedProfile);
        }
      }
    } catch (error) {
      console.error("Failed to load tariffs:", error);
    }
  };

  const selectTariffByProfileType = (data: any[], profile: any) => {
    console.log("Selecting tariff for profile:", profile);
    
    if (profile.tax_system === "non_profit" || profile.organization_subtype === "osbb" || profile.organization_subtype === "st" || profile.organization_subtype === "cooperative" || profile.organization_subtype === "go" || profile.organization_subtype === "bf") {
      const nonProfitTariff = data?.find((t: any) => t.code === "non_profit");
      if (nonProfitTariff) setSelectedTariff(nonProfitTariff);
    } else if (profile.type === "company") {
      // For companies, check if they are on simplified tax (єдиний податок) or general
      if (profile.tax_system === "ednuy-3-5%" || profile.tax_system === "single_tax" || profile.tax_system === "fop_ep" || profile.tax_system === "llc_ep" || profile.tax_system === "spilnuy-3-5%") {
        const tovEpTariff = data?.find((t: any) => t.code === "fop_3_tov_ep" || t.code === "tov_ep");
        if (tovEpTariff) setSelectedTariff(tovEpTariff);
      } else {
        const tovGeneralTariff = data?.find((t: any) => t.code === "tov_general_vat");
        if (tovGeneralTariff) setSelectedTariff(tovGeneralTariff);
      }
    } else if (profile.type === "fop") {
      // Select tariff based on FOP group
      const group = profile.group || profile.fop_group;
      console.log("FOP group:", group);
      if (group === 3 || group === "3") {
        const fop3Tariff = data?.find((t: any) => t.code === "fop_3_tov_ep" || t.code === "fop_3");
        if (fop3Tariff) setSelectedTariff(fop3Tariff);
      } else {
        const fop12Tariff = data?.find((t: any) => t.code === "fop_1_2");
        if (fop12Tariff) setSelectedTariff(fop12Tariff);
      }
    } else {
      if (data && data.length > 0) {
        setSelectedTariff(data[0]);
      }
    }
  };

  const fetchPricingDetails = async () => {
    try {
      const priceData = await api.getPricing();
      const monthlyPrice = priceData.find((p: any) => p.plan_type === "business" && p.payment_period === "monthly")?.price || 299;
      const halfYearlyPrice = priceData.find((p: any) => p.plan_type === "business" && p.payment_period === "half_yearly")?.price || 1499;
      const yearlyPrice = priceData.find((p: any) => p.plan_type === "business" && p.payment_period === "yearly")?.price || 2999;
      setPrices({ monthly: monthlyPrice, half_yearly: halfYearlyPrice, yearly: yearlyPrice });
    } catch (e) {
      console.error("Failed to load pricing details:", e);
    }
  };

  const fetchUsageDetails = async () => {
    try {
      const usageData = await api.getSubscriptionUsage(selectedProfile.id);
      setUsage(usageData);
    } catch (e) {
      console.error("Failed to load usage details:", e);
    }
  };

  const fetchPaymentsHistory = async () => {
    try {
      const paymentsData = await api.getProfilePayments(selectedProfile.id);
      setPaymentsList(paymentsData);
    } catch (e) {
      console.error("Failed to load payments history:", e);
    }
  };

  const handleRefreshHistory = async () => {
    setRefreshingHistory(true);
    await fetchPaymentsHistory();
    setRefreshingHistory(false);
  };

  const handleCheckout = async () => {
    if (!selectedProfile || !selectedTariff) return;
    setLoading(true);
    try {
      // Calculate total price based on period
      let monthlyTotal = selectedTariff.monthly_price;
      if (selectedProfile?.tax_system === "non_profit" && enableResidentModule) {
        const residentTariff = tariffs.find((t: any) => t.code === "resident_module");
        if (residentTariff) {
          monthlyTotal += residentTariff.base_resident_price || 0;
          selectedResidentTiers.forEach(tierIndex => {
            if (residentTariff.additional_resident_tiers && residentTariff.additional_resident_tiers[tierIndex]) {
              monthlyTotal += residentTariff.additional_resident_tiers[tierIndex].price;
            }
          });
        }
      }
      
      let total = monthlyTotal;
      if (selectedPeriod === "half_yearly") {
        const basePrice = monthlyTotal * 6;
        const discount = selectedTariff.half_yearly_discount || 0;
        total = Math.round(basePrice * (1 - discount / 100));
      } else if (selectedPeriod === "yearly") {
        const basePrice = monthlyTotal * 12;
        const discount = selectedTariff.yearly_discount || 0;
        total = Math.round(basePrice * (1 - discount / 100));
      }
      
      // Create payment with tariff information
      const res = await api.createPayment({
        profile_id: selectedProfile.id,
        plan_type: "business",
        payment_period: selectedPeriod,
        tariff_code: selectedTariff.code,
        amount: total,
        is_member_module_active: enableResidentModule
      });

      if (res.payment_required) {
        if (res.pageUrl) {
          window.location.href = res.pageUrl;
        } else {
          setLiqpayForm(res);
        }
      } else {
        alert(`Тариф ${selectedTariff.name_uk} успішно активовано!`);
        await loadData();
        await refreshProfiles();
      }
    } catch (error) {
      console.error("Error creating subscription payment:", error);
      alert("Помилка при спробі створити платіж. Спробуйте пізніше.");
    } finally {
      setLoading(false);
    }
  };

  // Demo direct activation bypass
  const handleUpgradeToBusinessDemo = async () => {
    if (!selectedProfile) return;
    setLoading(true);
    try {
      const data = await api.upgradeToBusiness(selectedProfile.id);
      alert(data.message || "Підписку активовано!");
      await loadData();
      await refreshProfiles();
    } catch (error: any) {
      console.error("Error upgrading directly:", error);
      const detail = error.response?.data?.detail || "Помилка при прямому підключенні підписки";
      alert(detail);
    } finally {
      setLoading(false);
    }
  };

  const cancelAutoRenew = async () => {
    if (!selectedProfile) return;
    if (!confirm("Ви впевнені, що хочете вимкнути автопродовження підписки?")) {
      return;
    }
    setLoading(true);
    try {
      await api.cancelSubscription(selectedProfile.id);
      alert("Автопродовження успішно вимкнено. Ваш тариф діятиме до закінчення сплаченого періоду.");
      await fetchSubscriptionDetails();
    } catch (error) {
      console.error("Error canceling subscription:", error);
      alert("Помилка при вимкненні автопродовження");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoRenew = async (currentStatus: boolean) => {
    if (!selectedProfile) return;
    setLoading(true);
    try {
      const updated = await api.enableAutoRenew(selectedProfile.id, !currentStatus);
      alert(updated.auto_renew ? "Автопродовження успішно увімкнено!" : "Автопродовження успішно вимкнено!");
      await fetchSubscriptionDetails();
    } catch (error) {
      console.error("Error toggling auto-renew:", error);
      alert("Помилка при зміні статусу автопродовження");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTariffs = () => {
    if (!tariffs || tariffs.length === 0) return [];
    
    if (selectedProfile?.tax_system === "non_profit") {
      return tariffs.filter(t => t.code === "non_profit");
    } else {
      return tariffs.filter(t => t.code === "fop_1_2" || t.code === "fop_3_tov_ep" || t.code === "tov_general_vat" || t.code === "consulting_partner");
    }
  };

  if (!selectedProfile) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="p-16 text-center bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden">
          <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />
          <Crown className="w-16 h-16 text-slate-700 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-slate-200">Не обрано профіль</h3>
          <p className="text-slate-400 max-w-sm mx-auto mt-2 text-sm leading-relaxed">
            Будь ласка, оберіть компанію або ФОП у верхньому лівому меню, щоб налаштувати тарифний план.
          </p>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="p-24 max-w-5xl mx-auto flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest animate-pulse">Завантаження тарифів та рахунків...</p>
      </div>
    );
  }

  const getPlanName = (planCode: string) => {
    switch (planCode) {
      case "business":
        return "Бізнес";
      case "basic":
        return "Базовий";
      case "premium":
        return "Преміум";
      case "free":
        return "Безкоштовний";
      default:
        return planCode || "Безкоштовний";
    }
  };

  const getPeriodName = (period: string) => {
    switch (period) {
      case "yearly":
        return "Річний";
      case "half_yearly":
        return "Піврічний";
      case "monthly":
        return "Місячний";
      default:
        return period || "";
    }
  };

  // Calculate savings on yearly and half-yearly plans
  const yearlySavings = Math.round((prices.monthly * 12) - prices.yearly);
  const yearlySavingsPercent = Math.round((yearlySavings / (prices.monthly * 12)) * 100);

  const halfYearlySavings = Math.round((prices.monthly * 6) - prices.half_yearly);
  const halfYearlySavingsPercent = Math.round((halfYearlySavings / (prices.monthly * 6)) * 100);

  const paidPlans = ["business", "basic", "premium"];
  const isPaidPlan = paidPlans.includes(subscription?.plan);
  const isActiveBusiness = isPaidPlan && subscription?.status === "active";
  const isPendingBusiness = isPaidPlan && subscription?.status === "pending";
  const isOSBBOrST = selectedProfile?.organization_subtype === "osbb" || selectedProfile?.organization_subtype === "st" || selectedProfile?.tax_system === "non_profit" || selectedProfile?.organization_subtype === "cooperative" || selectedProfile?.organization_subtype === "go" || selectedProfile?.organization_subtype === "bf";

  const getDynamicPricing = () => {
    const plan = plans.find(p => p.id === selectedPlanId) || plans[0];
    if (!plan) return { base: 299, module: 250, total: 549, periodText: "міс", totalText: "всього 549 грн" };

    let base = plan.price || 299;
    let module = plan.member_module_price || 250;

    if (selectedPeriod === "monthly") {
      base = plan.prices?.monthly ?? 299;
      module = plan.module_price?.monthly ?? 250;
    } else if (selectedPeriod === "half_yearly") {
      base = plan.prices?.half_yearly ?? 1499;
      module = plan.module_price?.half_yearly ?? 1500;
    } else if (selectedPeriod === "yearly") {
      base = plan.prices?.yearly ?? 2999;
      module = plan.module_price?.yearly ?? 3000;
    }

    const total = base + (enableMemberModule ? module : 0);
    const periodText = selectedPeriod === "monthly" ? "міс" : selectedPeriod === "half_yearly" ? "6 міс" : "12 міс";
    
    // Total breakdown text
    let totalText = "";
    if (selectedPeriod === "monthly") {
      totalText = enableMemberModule 
        ? `Тариф Business (299 грн) + Кабінет мешканців (250 грн) = 549 грн/міс (всього 549 грн)`
        : `Тариф Business (299 грн) = 299 грн/міс (всього 299 грн)`;
    } else if (selectedPeriod === "half_yearly") {
      totalText = enableMemberModule
        ? `Тариф Business (1499 грн) + Кабінет мешканців (1500 грн) = 2999 грн (всього 2999 грн)`
        : `Тариф Business (1499 грн) = 1499 грн (всього 1499 грн)`;
    } else if (selectedPeriod === "yearly") {
      totalText = enableMemberModule
        ? `Тариф Business (2999 грн) + Кабінет мешканців (3000 грн) = 5999 грн (всього 5999 грн)`
        : `Тариф Business (2999 грн) = 2999 грн (всього 2999 грн)`;
    }

    return { base, module, total, periodText, totalText };
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10">
      
      {/* Success Notification Banner */}
      {showSuccessBanner && (
        <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-250 rounded-3xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-emerald-500/20 rounded-2xl border border-emerald-500/25 shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Оплату успішно отримано! 🎉</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ваш тарифний план <span className="font-bold text-amber-400">Business</span> успішно активовано та продовжено. Дякуємо за довіру!
              </p>
              {subscription && subscription.expires_at && (
                <p className="text-xs font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Термін дії підписки: до {new Date(subscription.expires_at).toLocaleDateString("uk-UA")}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSuccessBanner(false)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-800 transition-all cursor-pointer shadow shrink-0 self-end sm:self-center"
          >
            Зрозуміло
          </button>
        </div>
      )}

      {/* Pending Payment Notification Banner */}
      {isPendingBusiness && (
        <div className="p-5 bg-amber-500/10 border border-amber-500/30 text-amber-250 rounded-3xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-amber-500/20 rounded-2xl border border-amber-500/25 shrink-0">
              <Clock className="w-6 h-6 text-amber-450 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-base text-white">Очікує оплати тарифу ⏳</h3>
              <p className="text-xs text-slate-350">
                Ви замовили тариф <span className="font-bold text-amber-450">{getPlanName(subscription?.plan)}</span> ({getPeriodName(subscription?.payment_period)}). 
                Всі переваги платного тарифу стануть доступними автоматично після підтвердження оплати рахунку.
              </p>
              <p className="text-[11px] text-slate-450">
                Поки що ваш кабінет працює в межах **Безкоштовного тарифу (Free)** (ліміт: 5 банківських виписок на місяць).
              </p>
            </div>
          </div>
          <div className="flex gap-2 self-end sm:self-center shrink-0">
            {paymentsList.find(p => p.status === "pending" && p.payment_type === "subscription") && (
              <button
                type="button"
                onClick={async () => {
                  const pendingPay = paymentsList.find(p => p.status === "pending" && p.payment_type === "subscription");
                  if (pendingPay?.liqpay_order_id) {
                    setLoading(true);
                    try {
                      const res = await api.createPayment({
                        profile_id: selectedProfile.id,
                        plan_type: pendingPay.tax_type || "business",
                        payment_period: pendingPay.period === "yearly" ? "yearly" : pendingPay.period === "half_yearly" ? "half_yearly" : "monthly"
                      });
                      if (res.payment_required) {
                        if (res.pageUrl) {
                          window.location.href = res.pageUrl;
                        } else {
                          setLiqpayForm(res);
                        }
                      }
                    } catch (e) {
                      alert("Не вдалося ініціювати платіж");
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-550 to-amber-600 hover:from-amber-500 hover:to-amber-555 text-white text-xs font-bold rounded-xl border border-amber-600/30 transition-all cursor-pointer shadow flex items-center gap-1.5 active:scale-95"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Сплатити тариф</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expired Notification Banner */}
      {subscription?.status === "expired" && (
        <div className="p-5 bg-rose-500/10 border border-rose-500/30 text-rose-250 rounded-3xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-rose-500/20 rounded-2xl border border-rose-500/25 shrink-0">
              <AlertCircle className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Термін дії підписки закінчився ⚠️</h3>
              <p className="text-xs text-slate-350 mt-0.5">
                Ваш платний тариф <span className="font-bold text-rose-400">{getPlanName(subscription?.plan_type)}</span> закінчився{subscription?.expires_at ? ` ${new Date(subscription.expires_at).toLocaleDateString("uk-UA")}` : ""}.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Кабінет автоматично переведено на **Безкоштовний тариф (Free)**. Модуль білінгу мешканців та автоматичний імпорт виписок деактивовані.
              </p>
            </div>
          </div>
        </div>
      )}


      {/* Hidden LiqPay Submit Form */}
      {liqpayForm && (
        <form id="liqpay-submit-form" method="POST" action={liqpayForm.api_url}>
          <input type="hidden" name="data" value={liqpayForm.liqpay_data} />
          <input type="hidden" name="signature" value={liqpayForm.liqpay_signature} />
        </form>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-800/60">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 dark:from-white dark:via-slate-200 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">
            Керування підпискою
          </h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Керуйте вашим тарифом, налаштовуйте рахунки та переглядайте історію оплат для профілю: <span className="font-bold text-indigo-400">{selectedProfile.name}</span>
          </p>
        </div>
        
        {/* Active plan status badge */}
        <div className="flex items-center gap-3">
          {isActiveBusiness ? (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/35 px-4 py-2 rounded-2xl">
              <Crown className="w-4 h-4 text-amber-400 animate-pulse" />
              <div className="text-left">
                <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Поточний план</p>
                <p className="text-xs font-bold text-amber-400">
                  {getPlanName(subscription.plan)} ({getPeriodName(subscription.payment_period)})
                </p>
              </div>
            </div>
          ) : isPendingBusiness ? (
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2.5">
              <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-4 py-2 rounded-2xl">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <div className="text-left">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Поточний ліміт</p>
                  <p className="text-xs font-bold text-slate-350">Безкоштовний тариф (Free)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/35 px-4 py-2 rounded-2xl animate-pulse">
                <Clock className="w-4 h-4 text-amber-400" />
                <div className="text-left">
                  <p className="text-[9px] uppercase font-black tracking-widest text-amber-505/85">Очікує оплати</p>
                  <p className="text-xs font-bold text-amber-400">
                    {getPlanName(subscription.plan)} ({getPeriodName(subscription.payment_period)})
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-4 py-2 rounded-2xl">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <div className="text-left">
                <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Поточний план</p>
                <p className="text-xs font-bold text-slate-350">Безкоштовний тариф (Free)</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Pricing plans selection (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-6 relative overflow-hidden">
            <div className="absolute top-[-10%] right-[-10%] w-48 h-48 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Доступні плани</h2>
                <p className="text-xs text-slate-500">Оберіть період дії для тарифу Business</p>
              </div>
              
              {/* Sliding Billing Interval Selector */}
              <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("monthly")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    selectedPeriod === "monthly"
                      ? "bg-indigo-650 text-white shadow"
                      : "text-slate-400 hover:text-slate-205"
                  }`}
                >
                  Місяць
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("half_yearly")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                    selectedPeriod === "half_yearly"
                      ? "bg-indigo-650 text-white shadow"
                      : "text-slate-400 hover:text-slate-205"
                  }`}
                >
                  <span>Пів року</span>
                  <span className="bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-1 py-0.5 rounded-md text-[8px] uppercase font-black">-{halfYearlySavingsPercent}%</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("yearly")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                    selectedPeriod === "yearly"
                      ? "bg-indigo-650 text-white shadow"
                      : "text-slate-400 hover:text-slate-205"
                  }`}
                >
                  <span>Рік</span>
                  <span className="bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-1 py-0.5 rounded-md text-[8px] uppercase font-black">-{yearlySavingsPercent}%</span>
                </button>
              </div>
            </div>

            {/* Selected Tariff Display */}
            {selectedTariff && (
              <div className="group relative p-5 bg-slate-900/60 border-2 border-indigo-500 rounded-3xl flex flex-col justify-between overflow-hidden shadow-lg shadow-indigo-500/10">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center text-xl">
                      {selectedTariff.code === "non_profit" ? "🏢" : selectedTariff.code === "resident_module" ? "👥" : "💼"}
                    </div>
                    <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      Ваш тариф
                    </span>
                  </div>
                  <div className="space-y-1 text-left">
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-base">
                      {selectedTariff.name_uk}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                      {selectedTariff.description}
                    </p>
                  </div>
                  <div className="pt-2 text-left">
                    <div className="text-3xl font-black text-indigo-400">
                      {selectedTariff.monthly_price} грн
                    </div>
                    <p className="text-xs text-slate-500">на місяць</p>
                  </div>
                </div>
              </div>
            )}
            {/* Resident Module Checkbox Option (Only for Non-profits) */}
            {selectedTariff && isOSBBOrST && (
              <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-3xl space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={enableResidentModule}
                    onChange={(e) => setEnableResidentModule(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-650 focus:ring-indigo-500 focus:ring-offset-slate-950 bg-slate-900"
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                      Підключити модуль «Мешканці / Клієнти» (+300 грн/міс)
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                      Дозволяє мешканцям бачити квитанції, вносити показники та переглядати рахунки. Включає 60 об'єктів.
                    </p>
                  </div>
                </label>

                {enableResidentModule && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-2.5 text-left">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Кількість об'єктів (мешканців):
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedResidentTiers([])}
                        className={`py-1 px-2 rounded-lg border text-[10px] font-bold text-center transition-all ${
                          selectedResidentTiers.length === 0
                            ? "bg-indigo-650 border-indigo-500 text-white"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-250"
                        }`}
                      >
                        До 60 (Безкоштовно)
                      </button>
                      {residentTiers.map((tier, idx) => {
                        const isTierSelected = selectedResidentTiers.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (isTierSelected) {
                                setSelectedResidentTiers(selectedResidentTiers.filter(t => t !== idx));
                              } else {
                                setSelectedResidentTiers([...selectedResidentTiers, idx]);
                              }
                            }}
                            className={`py-1 px-2 rounded-lg border text-[10px] font-bold text-center transition-all ${
                              isTierSelected
                                ? "bg-indigo-650 border-indigo-500 text-white"
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-255"
                            }`}
                          >
                            +{tier.count} (+{tier.price} грн)
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Selected Tariff Details */}
            {selectedTariff && (
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <div className="flex justify-between items-center px-2">
                  <span className="text-xs font-bold text-slate-400">Загальна сума до сплати:</span>
                  <span className="text-2xl font-black text-indigo-400">
                    {(() => {
                      let monthlyTotal = selectedTariff.monthly_price;
                      if (selectedProfile?.tax_system === "non_profit" && enableResidentModule) {
                        const residentTariff = tariffs.find((t: any) => t.code === "resident_module");
                        if (residentTariff) {
                          monthlyTotal += residentTariff.base_resident_price || 0;
                          selectedResidentTiers.forEach(tierIndex => {
                            if (residentTariff.additional_resident_tiers && residentTariff.additional_resident_tiers[tierIndex]) {
                              monthlyTotal += residentTariff.additional_resident_tiers[tierIndex].price;
                            }
                          });
                        }
                      }
                      
                      let total = monthlyTotal;
                      let periodText = "міс";
                      
                      if (selectedPeriod === "half_yearly") {
                        total = monthlyTotal * 6;
                        periodText = "6 міс";
                      } else if (selectedPeriod === "yearly") {
                        total = monthlyTotal * 12;
                        periodText = "12 міс";
                      }
                      
                      return (
                        <>
                          {total} грн
                          <span className="text-xs text-slate-400 font-normal"> / {periodText}</span>
                        </>
                      );
                    })()}
                  </span>
                </div>
                
                <div className="px-2 pb-2 text-[10px] text-slate-500 font-bold tracking-wide italic leading-relaxed">
                  {(() => {
                    let monthlyTotal = selectedTariff.monthly_price;
                    if (selectedProfile?.tax_system === "non_profit" && enableResidentModule) {
                      const residentTariff = tariffs.find((t: any) => t.code === "resident_module");
                      if (residentTariff) {
                        monthlyTotal += residentTariff.base_resident_price || 0;
                        selectedResidentTiers.forEach(tierIndex => {
                          if (residentTariff.additional_resident_tiers && residentTariff.additional_resident_tiers[tierIndex]) {
                            monthlyTotal += residentTariff.additional_resident_tiers[tierIndex].price;
                          }
                        });
                      }
                    }
                    
                    let periodText = "місяць";
                    if (selectedPeriod === "half_yearly") {
                      periodText = "6 місяців";
                    } else if (selectedPeriod === "yearly") {
                      periodText = "12 місяців";
                    }
                    
                    if (selectedProfile?.tax_system === "non_profit") {
                      let breakdown = `Базовий облік (${selectedTariff.monthly_price} грн/міс × ${selectedPeriod === "monthly" ? 1 : selectedPeriod === "half_yearly" ? 6 : 12} ${periodText})`;
                      if (enableResidentModule) {
                        const residentTariff = tariffs.find((t: any) => t.code === "resident_module");
                        if (residentTariff) {
                          breakdown += ` + Модуль мешканців (база: ${residentTariff.base_resident_price} грн/міс`;
                          selectedResidentTiers.forEach(tierIndex => {
                            if (residentTariff.additional_resident_tiers && residentTariff.additional_resident_tiers[tierIndex]) {
                              breakdown += ` + ${residentTariff.additional_resident_tiers[tierIndex].price} грн`;
                            }
                          });
                          breakdown += ")";
                        }
                      }
                      return breakdown;
                    } else {
                      return `Тариф ${selectedTariff.name_uk} (${selectedTariff.monthly_price} грн/міс × ${selectedPeriod === "monthly" ? 1 : selectedPeriod === "half_yearly" ? 6 : 12} ${periodText})`;
                    }
                  })()}
                </div>
                
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className={`w-full py-3 rounded-xl text-xs font-black transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] ${
                    loading
                      ? "bg-indigo-700/50 text-white/50 cursor-not-allowed"
                      : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-600/20"
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Перейти до оплати тарифу</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenInvoiceModal}
                  disabled={loading}
                  className="w-full mt-2 py-3 rounded-xl text-xs font-bold transition-all border border-slate-800 hover:bg-slate-900/50 text-slate-350 hover:text-white flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  <span>Надіслати рахунок на e-mail</span>
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Active Subscription & usage details (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Active plan status */}
          <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-5">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Деталі підписки</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-900/60">
                <span className="text-xs text-slate-550">План</span>
                <span className="text-xs font-bold text-white capitalize">{getPlanName(subscription?.plan)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-900/60">
                <span className="text-xs text-slate-550">Статус підписки</span>
                <span className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded ${
                  subscription?.status === "active" 
                    ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/20" 
                    : subscription?.status === "pending"
                      ? "bg-amber-500/10 text-amber-450 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-455 border border-rose-500/20"
                }`}>
                  {subscription?.status === "active" ? "Активна" : subscription?.status === "pending" ? "Очікує оплати" : subscription?.status === "expired" ? "Термін закінчився" : subscription?.status || "Free"}
                </span>
              </div>
              
              {isActiveBusiness && (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-slate-900/60">
                    <span className="text-xs text-slate-550">Термін дії</span>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      {subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString("uk-UA") : "Необмежено"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-900/60">
                    <span className="text-xs text-slate-550">Автопродовження</span>
                    <button
                      onClick={() => handleToggleAutoRenew(subscription.auto_renew)}
                      disabled={loading}
                      title="Натисніть для зміни статусу"
                      className={`text-[11px] px-3 py-1 rounded-xl font-bold transition-all border flex items-center gap-1.5 ${
                        subscription.auto_renew 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" 
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${subscription.auto_renew ? "bg-emerald-400 animate-pulse" : "bg-rose-455"}`} />
                      <span>{subscription.auto_renew ? "Увімкнено" : "Вимкнено"}</span>
                      <span className="text-[9px] font-normal opacity-60">(Змінити)</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Resident Cabinet Module Status (only for OSBB/ST) */}
          {isOSBBOrST && (
            <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-4 relative overflow-hidden">
              <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Модуль мешканців</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Білінг-панель та кабінет ОСББ</p>
                </div>
                
                {(() => {
                  const isModuleActive = !!subscription?.is_member_module_active && subscription?.status === "active";
                  const isModulePending = !!subscription?.is_member_module_active && subscription?.status === "pending";
                  return (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      isModuleActive
                        ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/20"
                        : isModulePending
                          ? "bg-amber-500/10 text-amber-450 border border-amber-500/20 animate-pulse"
                          : "bg-rose-500/10 text-rose-455 border border-rose-500/20"
                    }`}>
                      {isModuleActive ? "Активний" : isModulePending ? "Очікує" : "Вимкнено"}
                    </span>
                  );
                })()}
              </div>

              <div className="space-y-3 pt-1">
                {(() => {
                  const isModuleActive = !!subscription?.is_member_module_active && subscription?.status === "active";
                  const isModulePending = !!subscription?.is_member_module_active && subscription?.status === "pending";
                  return (
                    <>
                      <div className="flex justify-between items-center text-xs border-b border-slate-900/60 pb-2">
                        <span className="text-slate-550">Статус підключення:</span>
                        <span className={`font-bold ${isModuleActive ? "text-emerald-400" : isModulePending ? "text-amber-400" : "text-slate-400"}`}>
                          {isModuleActive 
                            ? "✅ Підключено" 
                            : isModulePending 
                              ? "⏳ Очікує оплати підписки" 
                              : "❌ Відключено"}
                        </span>
                      </div>

                      {isModuleActive && subscription?.expires_at && (
                        <div className="flex justify-between items-center text-xs border-b border-slate-900/60 pb-2">
                          <span className="text-slate-550">Діє до:</span>
                          <span className="font-bold text-white">
                            {new Date(subscription.expires_at).toLocaleDateString("uk-UA")}
                          </span>
                        </div>
                      )}

                      {/* Explanation text */}
                      <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-2xl">
                        <p className="text-xs text-slate-350 leading-relaxed font-medium">
                          {isModuleActive ? (
                            "Модуль білінгу мешканців активний. Мешканці мають доступ до особистих кабінетів, можуть передавати показання лічильників та переглядати рахунки."
                          ) : isModulePending ? (
                            `Ви замовили Кабінет мешканців у новому рахунку. Модуль буде активовано одразу після успішної оплати підписки за тарифом Business.`
                          ) : subscription?.status === "expired" ? (
                            `⚠️ Модуль вимкнено через закінчення терміну дії вашої підписки ${subscription.expires_at ? `(${new Date(subscription.expires_at).toLocaleDateString("uk-UA")})` : ""}. Оплатіть новий рахунок, щоб повернути доступ мешканцям.`
                          ) : isPaidPlan && !subscription?.is_member_module_active ? (
                            `ℹ️ Модуль вимкнено, оскільки його не було обрано при оформленні поточної підписки від ${subscription.last_payment_date ? new Date(subscription.last_payment_date).toLocaleDateString("uk-UA") : (subscription.created_at ? new Date(subscription.created_at).toLocaleDateString("uk-UA") : "початку дії підписки")}. Ви можете підключити його під час наступного продовження підписки.`
                          ) : (
                            "Цей модуль дозволяє мешканцям вашого ОСББ бачити свої квитанції, вносити показники лічильників та брати участь в опитуваннях. Модуль доступний лише в платних тарифах."
                          )}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
 
          {/* Usage limit bar */}
          {!isActiveBusiness && (
            <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-350">Використання виписок</span>
                <span className="text-xs font-bold text-white">{usage.used} / {usage.limit}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div 
                  className="bg-indigo-650 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-550 italic leading-relaxed">
                * У тарифі Free ви можете завантажити максимум 5 банківських виписок на місяць. Перейдіть на тариф Business для зняття лімітів.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Invoice and Payments History Table */}
      <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Історія рахунків та оплат</h3>
            <p className="text-xs text-slate-500 mt-0.5">Журнал виставлених рахунків та оплат Mono Pay</p>
          </div>
          <button
            onClick={handleRefreshHistory}
            disabled={refreshingHistory}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 text-slate-400 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingHistory ? "animate-spin" : ""}`} />
          </button>
        </div>

        {paymentsList.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-900 rounded-2xl">
            <Clock className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Журнал рахунків порожній</p>
            <p className="text-[10px] text-slate-600 mt-1">Тут з'являться ваші рахунки за підписку або податкові платежі.</p>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800/60 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-amber-600 text-white dark:bg-slate-900/65 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">ID</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Призначення</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Сума</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Період</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Дата створення</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Статус</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Рахунок Mono Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                {paymentsList.map((p) => {
                  const isSub = p.payment_type === "subscription";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all">
                      <td className="p-4 font-mono text-slate-500">#{p.id}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            isSub 
                              ? "bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20" 
                              : "bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20"
                          }`}>
                            {isSub ? "Підписка" : "Податок"}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {isSub 
                              ? `Upgrade to Business (${p.period === "yearly" ? "Рік" : p.period === "half_yearly" ? "Пів року" : "Місяць"})` 
                              : `Сплата податку: ${p.tax_type.toUpperCase()}`}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-extrabold text-slate-900 dark:text-white">{p.amount} грн</td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-medium capitalize">{p.period || "—"}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-semibold">{p.created_at || "—"}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase inline-flex items-center gap-1 ${
                          p.status === "paid" 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}>
                          {p.status === "paid" ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Сплачено</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>Очікує</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-600 dark:text-slate-400 text-[10px]">
                        {p.liqpay_order_id ? (
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[120px]">{p.liqpay_order_id}</span>
                            {p.status !== "paid" && (
                              <button 
                                onClick={async () => {
                                  // Re-create check-out trigger by generating payment payload
                                  setLoading(true);
                                  try {
                                    const res = await api.createPayment({
                                      profile_id: selectedProfile.id,
                                      plan_type: p.tax_type, // plan type e.g. business
                                      payment_period: p.period === "yearly" ? "yearly" : p.period === "half_yearly" ? "half_yearly" : "monthly"
                                    });
                                    if (res.payment_required) {
                                      if (res.pageUrl) {
                                        window.location.href = res.pageUrl;
                                      } else {
                                        setLiqpayForm(res);
                                      }
                                    }
                                  } catch (e) {
                                    alert("Не вдалося ініціювати платіж");
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                className="text-amber-500 hover:text-amber-400 flex items-center gap-0.5 font-bold hover:underline cursor-pointer ml-2"
                              >
                                <span>Сплатити</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                            
                            {isSub && (
                              <button
                                onClick={async () => {
                                  setLoading(true);
                                  try {
                                    const blob = await api.downloadPaymentPDF(p.id);
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', `Invoice_${p.liqpay_order_id || p.id}.pdf`);
                                    document.body.appendChild(link);
                                    link.click();
                                    link.remove();
                                    window.URL.revokeObjectURL(url);
                                  } catch (err) {
                                    alert("Не вдалося завантажити рахунок");
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-bold hover:underline cursor-pointer ml-3"
                              >
                                <span>Рахунок (PDF)</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          "Внутрішній рахунок"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Modal Popup */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-250">
          <div className="bg-slate-905 border border-slate-800 rounded-3xl p-6 max-w-md w-full relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-455 rounded-xl">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Отримати рахунок</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Служба підписки UniTax</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-350 transition-all"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Ми згенеруємо PDF-рахунок для оплати безконтактним переказом за реквізитами ФОП на суму{" "}
              <span className="font-bold text-white">
                {getCalculatedPrice()} грн
              </span>{" "}
              ({selectedPeriod === "monthly" ? "місячний" : selectedPeriod === "half_yearly" ? "піврічний" : "річний"} тариф {selectedTariff?.name_uk || "Business"}) та надішлемо його на вашу електронну адресу.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">
                  Email одержувача
                </label>
                <input
                  type="email"
                  value={invoiceEmail}
                  onChange={(e) => setInvoiceEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 hover:border-slate-750 focus:border-indigo-550 rounded-2xl text-xs text-slate-200 focus:outline-none transition-all"
                />
              </div>

              {invoiceError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-455 rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{invoiceError}</span>
                </div>
              )}

              {invoiceSuccess && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-455 rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 animate-bounce" />
                  <span>{invoiceSuccess}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-3 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 hover:text-white text-xs font-bold rounded-2xl transition-all"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {downloadingInvoice ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Завантажити PDF</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSendInvoice}
                  disabled={sendingInvoice}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-600 hover:to-violet-600 active:scale-[0.98] text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-650/15 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {sendingInvoice ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Надіслати</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

