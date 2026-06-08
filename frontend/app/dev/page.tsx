"use client";

import { useState, useEffect } from "react";
import { Shield, Crown, Users, CreditCard, Loader2, AlertCircle, CheckCircle, Plus, X, Ban } from "lucide-react";

export default function DevPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [pricing, setPricing] = useState({ business: 499 });
  const [newPrice, setNewPrice] = useState(499);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("pricing");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleLogin = async () => {
    try {
      const res = await fetch("https://unitas-backend.fly.dev/api/admin/pricing", {
        headers: { "X-API-Key": apiKey }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        fetchPricing();
        fetchUsers();
      } else {
        setMessage({ type: "error", text: "Невірний API ключ" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Помилка з'єднання" });
    }
  };

  const fetchPricing = async () => {
    try {
      const res = await fetch("https://unitas-backend.fly.dev/api/admin/pricing", {
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const businessPricing = data.find((p: any) => p.plan === "business");
        if (businessPricing) {
          setPricing({ business: businessPricing.price });
          setNewPrice(businessPricing.price);
        }
      }
    } catch (error) {
      console.error("Error fetching pricing:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("https://unitas-backend.fly.dev/api/admin/users", {
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const updatePrice = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://unitas-backend.fly.dev/api/admin/pricing/business", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({ price: newPrice })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        setPricing({ business: newPrice });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: data.detail || "Помилка оновлення ціни" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Помилка оновлення ціни" });
    } finally {
      setLoading(false);
    }
  };

  const activateBusinessForUser = async (profileId: number) => {
    try {
      const res = await fetch("https://unitas-backend.fly.dev/api/admin/subscription/extend/" + profileId, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({ days: 90 })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchUsers();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: "Помилка активації" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Помилка активації" });
    }
  };

  const extendSubscription = async (profileId: number, days: number) => {
    try {
      const res = await fetch("https://unitas-backend.fly.dev/api/admin/subscription/extend/" + profileId, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({ days })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchUsers();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: "Помилка продовження" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Помилка продовження" });
    }
  };

  const cancelSubscription = async (profileId: number) => {
    if (!confirm("Ви впевнені, що хочете скасувати підписку?")) return;
    try {
      const res = await fetch("https://unitas-backend.fly.dev/api/admin/subscription/cancel/" + profileId, {
        method: "POST",
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchUsers();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: "Помилка скасування" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Помилка скасування" });
    }
  };

  const blockSubscription = async (profileId: number) => {
    if (!confirm("Ви впевнені, що хочете заблокувати підписку?")) return;
    try {
      const res = await fetch("https://unitas-backend.fly.dev/api/admin/subscription/block/" + profileId, {
        method: "POST",
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchUsers();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: "Помилка блокування" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Помилка блокування" });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="p-6 rounded-2xl glass-panel">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-6 h-6 text-indigo-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dev Panel</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Введіть API ключ для доступу</p>
          {message && (
            <div className={`p-3 rounded-lg mb-4 flex items-center gap-2 text-sm ${
              message.type === 'success' 
                ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' 
                : 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'
            }`}>
              {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}
          <input
            type="password"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-semibold mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleLogin}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg"
          >
            Увійти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
        <Shield className="w-6 h-6 text-indigo-500" /> Dev Panel
      </h1>
      
      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' 
            : 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}
      
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("pricing")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "pricing"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <CreditCard className="w-4 h-4 mr-2 inline" /> Ціни
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "users"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <Users className="w-4 h-4 mr-2 inline" /> Користувачі
        </button>
        <button
          onClick={() => setActiveTab("apple")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "apple"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <Crown className="w-4 h-4 mr-2 inline" /> Apple Review
        </button>
      </div>
      
      {activeTab === "pricing" && (
        <div className="p-6 rounded-2xl glass-panel">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Управління цінами</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                Тариф Business (грн/міс)
              </label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(parseInt(e.target.value) || 0)}
                min={0}
                step={50}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={updatePrice}
              disabled={loading}
              className="mt-6 py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Збереження...
                </>
              ) : (
                "Зберегти"
              )}
            </button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
            Поточна ціна: <strong className="text-slate-900 dark:text-white">{pricing.business} грн/міс</strong>
          </p>
        </div>
      )}
      
      {activeTab === "users" && (
        <div className="p-6 rounded-2xl glass-panel">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Користувачі</h2>
          <div className="space-y-4">
            {users.map((user: any) => (
              <div key={user.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{user.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Telegram: {user.telegram_id || '—'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Створено: {user.created_at ? new Date(user.created_at).toLocaleDateString('uk-UA') : '—'}</p>
                  </div>
                </div>
                
                {user.profiles && user.profiles.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    {user.profiles.map((profile: any) => (
                      <div key={profile.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">{profile.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{profile.type} • {profile.tax_id || '—'}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                            profile.subscription?.plan === 'business' 
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' 
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {profile.subscription?.plan === 'business' ? 'Business' : 'Free'}
                          </span>
                        </div>
                        
                        {profile.subscription && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            <p>Статус: {profile.subscription.status}</p>
                            {profile.subscription.expires_at && (
                              <p>До: {new Date(profile.subscription.expires_at).toLocaleDateString('uk-UA')}</p>
                            )}
                          </div>
                        )}
                        
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => extendSubscription(profile.id, 30)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-all flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> +30 днів
                          </button>
                          <button
                            onClick={() => extendSubscription(profile.id, 90)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-all flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> +90 днів
                          </button>
                          {profile.subscription && profile.subscription.status === 'active' && (
                            <>
                              <button
                                onClick={() => cancelSubscription(profile.id)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Скасувати
                              </button>
                              <button
                                onClick={() => blockSubscription(profile.id)}
                                className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-950/50 transition-all flex items-center gap-1"
                              >
                                <Ban className="w-3 h-3" /> Заблокувати
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Немає профілів</p>
                )}
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">Немає користувачів</p>
            )}
          </div>
        </div>
      )}
      
      {activeTab === "apple" && (
        <div className="p-6 rounded-2xl glass-panel border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-emerald-500" /> Apple Review Account
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <span className="text-slate-600 dark:text-slate-400">Email:</span>
              <span className="font-mono text-slate-900 dark:text-white">apple_review@unitas.com</span>
              
              <span className="text-slate-600 dark:text-slate-400">Password:</span>
              <span className="font-mono text-slate-900 dark:text-white">AppleReviewer2026!</span>
              
              <span className="text-slate-600 dark:text-slate-400">Тариф:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Business (активовано на 90 днів)</span>
            </div>
            <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-950/30 rounded-xl text-sm text-amber-700 dark:text-amber-400">
              ⚠️ Цей акаунт автоматично отримує Business тариф при старті бекенду. Використовуйте для модерації Apple.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
