"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { Check, Crown, Loader2 } from "lucide-react";

export default function SubscriptionPage() {
  const { selectedProfile } = useApp();
  const [subscription, setSubscription] = useState<any>(null);
  const [prices, setPrices] = useState({ business: 499 });
  const [usage, setUsage] = useState({ used: 0, limit: 5 });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

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
      // Get current subscription
      const subRes = await fetch(`https://unitas-backend.fly.dev/api/subscription/current/${selectedProfile.id}`);
      const subData = await subRes.json();
      setSubscription(subData);
      
      // Get prices
      const priceRes = await fetch("https://unitas-backend.fly.dev/api/pricing/");
      const priceData = await priceRes.json();
      setPrices(priceData);
      
      // Get usage
      const usageRes = await fetch(`https://unitas-backend.fly.dev/api/subscription/usage/${selectedProfile.id}`);
      const usageData = await usageRes.json();
      setUsage(usageData);
    } catch (error) {
      console.error("Error loading subscription data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const upgradeToBusiness = async () => {
    if (!selectedProfile) return;
    setLoading(true);
    try {
      const res = await fetch(`https://unitas-backend.fly.dev/api/subscription/upgrade/${selectedProfile.id}`, { 
        method: "POST" 
      });
      const data = await res.json();
      alert(data.message);
      loadData();
    } catch (error) {
      console.error("Error upgrading subscription:", error);
      alert("Помилка при оновленні підписки");
    } finally {
      setLoading(false);
    }
  };

  const cancelAutoRenew = async () => {
    if (!selectedProfile) return;
    try {
      await fetch(`https://unitas-backend.fly.dev/api/subscription/cancel/${selectedProfile.id}`, { 
        method: "POST" 
      });
      alert("Автопродовження вимкнено");
      loadData();
    } catch (error) {
      console.error("Error canceling subscription:", error);
      alert("Помилка при вимкненні автопродовження");
    }
  };

  if (!selectedProfile) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="p-12 text-center bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm">
          <Crown className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Не обрано профіль</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">
            Будь ласка, оберіть компанію або ФОП у верхньому меню, щоб переглянути тарифний план.
          </p>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400 bg-clip-text text-transparent">
          Тарифний план
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Оберіть тариф, який найкраще підходить для вашого бізнесу
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free */}
        <div className={`p-6 rounded-2xl glass-panel ${subscription?.plan === 'free' ? 'border-2 border-indigo-500' : ''}`}>
          <h2 className="text-xl font-bold mb-2 text-slate-800 dark:text-slate-200">Free</h2>
          <p className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">0 грн/міс</p>
          <ul className="space-y-3 mb-6 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Дашборд
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Завантаження виписок (5/міс)
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Налаштування
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Історія транзакцій (30 днів)
            </li>
          </ul>
          {subscription?.plan === 'free' && (
            <div className="mt-4 text-center text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
              Поточний тариф
            </div>
          )}
        </div>
        
        {/* Business */}
        <div className={`p-6 rounded-2xl glass-panel border-2 ${subscription?.plan === 'business' ? 'border-amber-500' : 'border-slate-200 dark:border-slate-800'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Business</h2>
          </div>
          <p className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">{prices.business} грн/міс</p>
          <ul className="space-y-3 mb-6 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Всі функції Free без лімітів
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Генерація звітів
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Управління працівниками
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Авто-синхронізація з банком
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Експорт в Excel/CSV
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              Пріоритетна підтримка
            </li>
          </ul>
          
          {subscription?.plan === 'business' ? (
            <div>
              <div className="text-center text-amber-600 dark:text-amber-400 font-semibold mb-2 text-sm">
                Активний тариф
              </div>
              <button
                onClick={cancelAutoRenew}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all border border-slate-200 dark:border-slate-700"
              >
                Вимкнути автопродовження
              </button>
            </div>
          ) : (
            <button
              onClick={upgradeToBusiness}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Обробка...
                </span>
              ) : (
                `Оновити до Business за ${prices.business} грн/міс`
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Usage for free plan */}
      {subscription?.plan === 'free' && (
        <div className="p-6 rounded-2xl glass-panel">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Використано виписок цього місяця: <span className="font-bold text-slate-900 dark:text-white">{usage.used}</span> з <span className="font-bold text-slate-900 dark:text-white">{usage.limit}</span>
          </p>
        </div>
      )}
      
      {/* Admin info */}
      <div className="p-6 rounded-2xl glass-panel bg-slate-50 dark:bg-slate-900/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          💡 Для зміни ціни тарифу Business виконайте SQL запит в базі даних:<br/>
          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">UPDATE pricing SET price = НОВА_ЦІНА WHERE plan = 'business';</code>
        </p>
      </div>
    </div>
  );
}
