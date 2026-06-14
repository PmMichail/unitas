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
  ExternalLink
} from "lucide-react";

export default function SubscriptionPage() {
  const { selectedProfile, refreshProfiles } = useApp();
  const [subscription, setSubscription] = useState<any>(null);
  const [prices, setPrices] = useState({ monthly: 499, yearly: 4989 });
  const [usage, setUsage] = useState({ used: 0, limit: 5 });
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  
  // UI States
  const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [liqpayForm, setLiqpayForm] = useState<any>(null);

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
        fetchPaymentsHistory()
      ]);
    } catch (error) {
      console.error("Error loading subscription data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchSubscriptionDetails = async () => {
    try {
      const subData = await api.getCurrentSubscription(selectedProfile.id);
      setSubscription(subData);
      if (subData.payment_period) {
        setSelectedPeriod(subData.payment_period === "yearly" ? "yearly" : "monthly");
      }
    } catch (e) {
      console.error("Failed to load subscription details:", e);
    }
  };

  const fetchPricingDetails = async () => {
    try {
      const priceData = await api.getPricing();
      const monthlyPrice = priceData.find((p: any) => p.plan_type === "business" && p.payment_period === "monthly")?.price || 499;
      const yearlyPrice = priceData.find((p: any) => p.plan_type === "business" && p.payment_period === "yearly")?.price || 4989;
      setPrices({ monthly: monthlyPrice, yearly: yearlyPrice });
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
    if (!selectedProfile) return;
    setLoading(true);
    try {
      const res = await api.createPayment({
        profile_id: selectedProfile.id,
        plan_type: "business",
        payment_period: selectedPeriod
      });

      if (res.payment_required) {
        setLiqpayForm(res);
      } else {
        alert("Тариф Business успішно активовано!");
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

  // Calculate savings on yearly plan
  const yearlySavings = Math.round((prices.monthly * 12) - prices.yearly);
  const yearlySavingsPercent = Math.round((yearlySavings / (prices.monthly * 12)) * 100);

  const isActiveBusiness = subscription?.plan === "business";
  const isPendingBusiness = subscription?.status === "pending" && subscription?.plan === "business";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10">
      
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
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent tracking-tight">
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
                <p className="text-xs font-bold text-amber-400">Business ({subscription.payment_period === "yearly" ? "Річний" : "Місячний"})</p>
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
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Місяць
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("yearly")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                    selectedPeriod === "yearly"
                      ? "bg-indigo-650 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>Рік</span>
                  <span className="bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-1 py-0.5 rounded-md text-[8px] uppercase font-black">-{yearlySavingsPercent}%</span>
                </button>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* 1. Free plan option */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 ${
                !isActiveBusiness 
                  ? "bg-slate-900/40 border-indigo-500/30" 
                  : "bg-slate-950/20 border-slate-800/60 opacity-60 hover:opacity-85"
              }`}>
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-base font-bold text-slate-200">Тариф Free</h3>
                    {!isActiveBusiness && (
                      <span className="bg-indigo-500/10 text-indigo-450 border border-indigo-500/20 px-2 py-0.5 rounded-md text-[9px] uppercase font-bold">Активний</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">Базовий функціонал</p>
                  
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">0</span>
                    <span className="text-xs text-slate-400">грн / назавжди</span>
                  </div>
                  
                  <ul className="mt-5 space-y-2.5 text-xs text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Інтерактивний дашборд</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Імпорт до 5 виписок на місяць</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Історія транзакцій за 30 днів</span>
                    </li>
                  </ul>
                </div>
                
                <div className="mt-6">
                  {!isActiveBusiness ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-xl border border-indigo-500/20 bg-indigo-550/10 text-indigo-400 text-xs font-bold cursor-default"
                    >
                      Поточний тариф
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        if (confirm("Ви дійсно хочете перейти на безкоштовний тариф? Ваш сплачений Business буде скасовано.")) {
                          setLoading(true);
                          try {
                            await api.createPayment({
                              profile_id: selectedProfile.id,
                              plan_type: "free",
                              payment_period: "monthly"
                            });
                            alert("Перехід на безкоштовний тариф активовано!");
                            loadData();
                          } catch (e) {
                            alert("Помилка при зміні тарифу");
                          } finally {
                            setLoading(false);
                          }
                        }
                      }}
                      className="w-full py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900 text-slate-350 text-xs font-semibold transition-all"
                    >
                      Перейти на Free
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Business plan option */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 relative ${
                isActiveBusiness 
                  ? "bg-slate-900/40 border-amber-500/30" 
                  : "bg-slate-950/20 border-slate-800/60 hover:border-slate-700/60"
              }`}>
                {selectedPeriod === "yearly" && (
                  <div className="absolute top-2 right-2 bg-emerald-500/10 text-emerald-450 border border-emerald-500/25 px-2 py-0.5 rounded-lg text-[8px] uppercase font-black tracking-widest animate-bounce">
                    Економія {yearlySavings} грн
                  </div>
                )}
                
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <h3 className="text-base font-bold text-slate-200">Тариф Business</h3>
                    </div>
                    {isActiveBusiness && (
                      <span className="bg-amber-500/10 text-amber-450 border border-amber-500/20 px-2 py-0.5 rounded-md text-[9px] uppercase font-bold">Активний</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">Безлімітний AI доступ</p>
                  
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">
                      {selectedPeriod === "monthly" ? prices.monthly : prices.yearly}
                    </span>
                    <span className="text-xs text-slate-400">
                      грн / {selectedPeriod === "monthly" ? "міс" : "рік"}
                    </span>
                  </div>
                  
                  <ul className="mt-5 space-y-2.5 text-xs text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Всі функції Free без лімітів</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>AI генерація та авто-заповнення звітів</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Управління найманими працівниками</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Автоматична банківська синхронізація</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Експорт даних в Excel/CSV</span>
                    </li>
                  </ul>
                </div>
                
                <div className="mt-6 space-y-2">
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-1.5 ${
                      loading 
                        ? "bg-amber-600/50 text-white/50 cursor-not-allowed" 
                        : isActiveBusiness && subscription.payment_period === selectedPeriod
                          ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                          : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-amber-600/10 hover:scale-[1.01]"
                    }`}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isActiveBusiness && subscription.payment_period === selectedPeriod ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Продовжити термін</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>
                          {isActiveBusiness ? "Змінити період" : `Придбати за ${selectedPeriod === "monthly" ? prices.monthly : prices.yearly} грн`}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Direct Demo Upgrader */}
                  <button
                    onClick={handleUpgradeToBusinessDemo}
                    disabled={loading}
                    className="w-full py-2 rounded-xl text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/5 border border-indigo-500/10 hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span>Швидка демо-активація (без оплат)</span>
                  </button>
                </div>

              </div>

            </div>

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
                <span className="text-xs font-bold text-white capitalize">{subscription?.plan}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-900/60">
                <span className="text-xs text-slate-550">Статус підписки</span>
                <span className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded ${
                  subscription?.status === "active" 
                    ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/20" 
                    : subscription?.status === "pending"
                      ? "bg-amber-500/10 text-amber-450 border border-amber-500/20"
                      : "bg-slate-800 text-slate-400"
                }`}>
                  {subscription?.status === "active" ? "Активна" : subscription?.status === "pending" ? "Очікує оплати" : subscription?.status || "Free"}
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
            <h3 className="text-lg font-bold text-white">Історія рахунків та оплат</h3>
            <p className="text-xs text-slate-500 mt-0.5">Журнал виставлених счетов та LiqPay оплат</p>
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
          <div className="border border-slate-800/60 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-900/65 text-slate-450 border-b border-slate-800">
                <tr>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">ID</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Призначення</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Сума</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Період</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Дата створення</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Статус</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Рахунок LiqPay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {paymentsList.map((p) => {
                  const isSub = p.payment_type === "subscription";
                  return (
                    <tr key={p.id} className="hover:bg-slate-900/20 transition-all">
                      <td className="p-4 font-mono text-slate-500">#{p.id}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            isSub 
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                              : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          }`}>
                            {isSub ? "Підписка" : "Податок"}
                          </span>
                          <span className="font-semibold text-slate-200">
                            {isSub 
                              ? `Upgrade to Business (${p.period === "yearly" ? "Рік" : "Місяць"})` 
                              : `Сплата податку: ${p.tax_type.toUpperCase()}`}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-extrabold text-white">{p.amount} грн</td>
                      <td className="p-4 text-slate-400 font-medium capitalize">{p.period || "—"}</td>
                      <td className="p-4 text-slate-400 font-semibold">{p.created_at || "—"}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase inline-flex items-center gap-1 ${
                          p.status === "paid" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {p.status === "paid" ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Сплачено</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Очікує</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-450 text-[10px]">
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
                                      payment_period: p.period === "yearly" ? "yearly" : "monthly"
                                    });
                                    if (res.payment_required) {
                                      setLiqpayForm(res);
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

    </div>
  );
}
