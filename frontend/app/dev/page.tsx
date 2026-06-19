"use client";

import { useState, useEffect } from "react";
import { 
  Shield, 
  Crown, 
  Users, 
  CreditCard, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Plus, 
  X, 
  Ban,
  TrendingUp,
  Activity,
  DollarSign,
  Briefcase,
  Mail,
  Send,
  RefreshCw,
  LogOut
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev";

export default function DevPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [pricing, setPricing] = useState({ business: 499 });
  const [newPrice, setNewPrice] = useState(499);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  
  const [activeTab, setActiveTab] = useState("pricing");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Email connection and sent emails log states
  const [emails, setEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [isEmailConnected, setIsEmailConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [loadingEmailStatus, setLoadingEmailStatus] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  const processAndSetUsers = (profilesList: any[]) => {
    const usersMap: Record<string, any> = {};
    (profilesList || []).forEach((profile: any) => {
      const email = profile.email || "unknown@unitax.pro";
      if (!usersMap[email]) {
        usersMap[email] = {
          id: profile.id,
          email: email,
          telegram_id: profile.telegram_id,
          created_at: profile.created_at,
          profiles: []
        };
      }
      usersMap[email].profiles.push({
        id: profile.id,
        name: profile.name,
        type: profile.type || "fop",
        tax_id: profile.tax_id,
        subscription: {
          plan: profile.plan,
          status: profile.status,
          expires_at: profile.expires_at,
          warning_sent_at: profile.warning_sent_at,
          auto_renew: true
        }
      });
    });
    setUsers(Object.values(usersMap) as any);
  };

  const getSubscriptionStatusInfo = (sub: any) => {
    if (!sub || sub.plan !== "business") {
      return { color: "slate", text: "Free", bg: "bg-slate-500/10 text-slate-400 border-slate-800" };
    }
    
    const now = new Date();
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
    
    // 1. Check if expired
    if (sub.status === "expired" || (expiresAt && expiresAt < now)) {
      return {
        color: "red",
        text: "Прострочено",
        bg: "bg-rose-500/10 text-rose-500 border-rose-500/20"
      };
    }
    
    // 2. Check if warning was sent for the CURRENT expiration cycle (within the active window)
    const warningSentForCurrentCycle = sub.warning_sent_at && expiresAt && 
      (new Date(sub.warning_sent_at).getTime() >= expiresAt.getTime() - 5 * 24 * 60 * 60 * 1000);

    if (warningSentForCurrentCycle) {
      return {
        color: "blue",
        text: "Лист надіслано",
        bg: "bg-sky-500/10 text-sky-400 border-sky-500/20"
      };
    }
    
    // 3. Check if expiring within 7 days
    if (expiresAt) {
      const diffTime = expiresAt.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7 && diffDays >= 0) {
        return {
          color: "orange",
          text: `Закінчується за ${diffDays} дн.`,
          bg: "bg-amber-500/10 text-amber-500 border-amber-500/20"
        };
      }
    }
    
    // 4. Default to active/green
    if (sub.status === "active") {
      return {
        color: "green",
        text: "Активний",
        bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      };
    }
    
    return {
      color: "green",
      text: "Business",
      bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
    };
  };

  useEffect(() => {
    const savedKey = localStorage.getItem("dev_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      
      const autoLogin = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/admin/pricing`, {
            headers: { "X-API-Key": savedKey }
          });
          if (res.ok) {
            setIsAuthenticated(true);
            
            const fetchAll = async () => {
              // 1. Pricing
              try {
                const r = await fetch(`${API_BASE_URL}/api/admin/pricing`, { headers: { "X-API-Key": savedKey } });
                const d = await r.json();
                if (d && d.length > 0) {
                  const bp = d.find((p: any) => p.plan === "business");
                  if (bp) {
                    setPricing({ business: bp.price });
                    setNewPrice(bp.price);
                  }
                }
              } catch (e) { console.error(e); }

              // 2. Users
              setLoadingUsers(true);
              try {
                const r = await fetch(`${API_BASE_URL}/api/admin/users`, { headers: { "X-API-Key": savedKey } });
                const d = await r.json();
                processAndSetUsers(d || []);
              } catch (e) { console.error(e); }
              finally { setLoadingUsers(false); }

              // 3. Payments
              setLoadingPayments(true);
              try {
                const r = await fetch(`${API_BASE_URL}/api/admin/payments`, { headers: { "X-API-Key": savedKey } });
                const d = await r.json();
                setPayments(d || []);
              } catch (e) { console.error(e); }
              finally { setLoadingPayments(false); }

              // 4. Stats
              setLoadingStats(true);
              try {
                const r = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers: { "X-API-Key": savedKey } });
                const d = await r.json();
                setStats(d || null);
              } catch (e) { console.error(e); }
              finally { setLoadingStats(false); }

              // 5. Email status
              setLoadingEmailStatus(true);
              try {
                const r = await fetch(`${API_BASE_URL}/api/auth/google/status/0`, { headers: { "X-API-Key": savedKey } });
                const d = await r.json();
                if (d && d.connected) {
                  setIsEmailConnected(true);
                  setConnectedEmail(d.email || "");
                } else {
                  setIsEmailConnected(false);
                  setConnectedEmail("");
                }
              } catch (e) { console.error(e); }
              finally { setLoadingEmailStatus(false); }

              // 6. Emails list
              setLoadingEmails(true);
              try {
                const r = await fetch(`${API_BASE_URL}/api/admin/emails`, { headers: { "X-API-Key": savedKey } });
                const d = await r.json();
                setEmails(d || []);
              } catch (e) { console.error(e); }
              finally { setLoadingEmails(false); }
            };
            
            fetchAll();
          }
        } catch (error) {
          console.error("Auto login error:", error);
        }
      };
      
      autoLogin();
    }

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("success") === "email_connected") {
        setMessage({ type: "success", text: "Gmail розробника успішно підключено!" });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (urlParams.get("error")) {
        setMessage({ type: "error", text: `Помилка авторизації: ${urlParams.get("error")}` });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pricing`, {
        headers: { "X-API-Key": apiKey }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem("dev_api_key", apiKey);
        fetchPricing();
        fetchUsers();
        fetchPayments();
        fetchStats();
        fetchEmailStatus();
        fetchEmails();
      } else {
        setMessage({ type: "error", text: "Невірний API ключ" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Помилка з'єднання" });
    }
  };

  const fetchPricing = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pricing`, {
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
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      processAndSetUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/payments`, {
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      setPayments(data || []);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/stats`, {
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      setStats(data || null);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchEmailStatus = async () => {
    setLoadingEmailStatus(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google/status/0`, {
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      if (data && data.connected) {
        setIsEmailConnected(true);
        setConnectedEmail(data.email || "");
      } else {
        setIsEmailConnected(false);
        setConnectedEmail("");
      }
    } catch (error) {
      console.error("Error fetching email status:", error);
    } finally {
      setLoadingEmailStatus(false);
    }
  };

  const fetchEmails = async () => {
    setLoadingEmails(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/emails`, {
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      setEmails(data || []);
    } catch (error) {
      console.error("Error fetching admin emails:", error);
    } finally {
      setLoadingEmails(false);
    }
  };

  const handleConnectEmail = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google/url/0?token=${apiKey}`);
      const data = await res.json();
      if (data && data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: "error", text: "Не вдалося отримати URL авторизації" });
      }
    } catch (error) {
      console.error("Error during email connect:", error);
      setMessage({ type: "error", text: "Помилка при підключенні пошти" });
    }
  };

  const handleDisconnectEmail = async () => {
    if (!confirm("Ви впевнені, що хочете відключити пошту Gmail розробника?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google/0`, {
        method: "DELETE",
        headers: { "X-API-Key": apiKey }
      });
      if (res.ok) {
        setIsEmailConnected(false);
        setConnectedEmail("");
        setMessage({ type: "success", text: "Gmail розробника відключено" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: "Не вдалося відключити пошту" });
      }
    } catch (error) {
      console.error("Error disconnecting email:", error);
      setMessage({ type: "error", text: "Помилка при відключенні пошти" });
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google/test-email/0`, {
        method: "POST",
        headers: { "X-API-Key": apiKey }
      });
      if (res.ok) {
        setMessage({ type: "success", text: `Тестовий лист успішно надіслано на ${connectedEmail}!` });
        fetchEmails();
        setTimeout(() => setMessage(null), 4000);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.detail || "Не вдалося надіслати тестовий лист" });
      }
    } catch (error) {
      console.error("Error testing email:", error);
      setMessage({ type: "error", text: "Помилка при надсиланні тестового листа" });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const updatePrice = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pricing/business`, {
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

  const extendSubscription = async (profileId: number, days: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/subscription/extend/${profileId}`, {
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
        fetchPayments();
        fetchStats();
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
      const res = await fetch(`${API_BASE_URL}/api/admin/subscription/cancel/${profileId}`, {
        method: "POST",
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchUsers();
        fetchPayments();
        fetchStats();
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
      const res = await fetch(`${API_BASE_URL}/api/admin/subscription/block/${profileId}`, {
        method: "POST",
        headers: { "X-API-Key": apiKey }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchUsers();
        fetchPayments();
        fetchStats();
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
      
      <div className="flex gap-2 flex-wrap">
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
          onClick={() => {
            setActiveTab("users");
            fetchUsers();
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "users"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <Users className="w-4 h-4 mr-2 inline" /> Користувачі
        </button>
        <button
          onClick={() => {
            setActiveTab("payments");
            fetchPayments();
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "payments"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <DollarSign className="w-4 h-4 mr-2 inline" /> Платежі
        </button>
        <button
          onClick={() => {
            setActiveTab("stats");
            fetchStats();
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "stats"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <Activity className="w-4 h-4 mr-2 inline" /> Статистика
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
        <button
          onClick={() => {
            setActiveTab("emails");
            fetchEmailStatus();
            fetchEmails();
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "emails"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <Mail className="w-4 h-4 mr-2 inline" /> Пошта
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
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Користувачі та профілі</h2>
            {loadingUsers && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
          </div>
          
          <div className="space-y-4">
            {users.map((user: any) => (
              <div key={user.id} className="border border-slate-250 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/40 dark:bg-slate-900/10">
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="font-extrabold text-slate-900 dark:text-white">{user.email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Telegram ID: <span className="font-mono">{user.telegram_id || '—'}</span></p>
                    <p className="text-xs text-slate-500">Створено: {user.created_at ? new Date(user.created_at).toLocaleString('uk-UA') : '—'}</p>
                  </div>
                </div>
                
                {user.profiles && user.profiles.length > 0 ? (
                  <div className="space-y-3 mt-3">
                    {user.profiles.map((profile: any) => (
                      <div key={profile.id} className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-extrabold text-slate-900 dark:text-white">{profile.name}</p>
                            <p className="text-xs text-slate-550 mt-0.5 capitalize">{profile.type} • {profile.tax_id || '—'}</p>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            {(() => {
                              const statusInfo = getSubscriptionStatusInfo(profile.subscription);
                              return (
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${statusInfo.bg}`}>
                                  {statusInfo.text}
                                </span>
                              );
                            })()}
                            
                            {profile.subscription && profile.subscription.plan === 'business' && (
                              <span className={`text-[8px] font-black uppercase px-1 rounded ${
                                profile.subscription.auto_renew 
                                  ? 'bg-emerald-500/10 text-emerald-500' 
                                  : 'bg-rose-500/10 text-rose-500'
                              }`}>
                                {profile.subscription.auto_renew ? 'Автоподовження' : 'Без автоподовження'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {profile.subscription && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 space-y-1 bg-slate-950/20 p-2.5 rounded-lg border border-slate-900">
                            <div className="flex justify-between">
                              <span>Статус:</span>
                              <span className={`font-bold capitalize ${
                                getSubscriptionStatusInfo(profile.subscription).color === 'red' ? 'text-rose-500' :
                                getSubscriptionStatusInfo(profile.subscription).color === 'orange' ? 'text-amber-500' :
                                getSubscriptionStatusInfo(profile.subscription).color === 'blue' ? 'text-sky-400' : 'text-emerald-500'
                              }`}>
                                {profile.subscription.status}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Діє до:</span>
                              <span className="font-bold">
                                {profile.subscription.expires_at ? new Date(profile.subscription.expires_at).toLocaleString('uk-UA') : 'Необмежено'}
                              </span>
                            </div>
                            {profile.subscription.warning_sent_at && (
                              <div className="flex justify-between text-sky-400 font-bold text-[10px]">
                                <span>Повідомлення:</span>
                                <span>Лист надіслано ({new Date(profile.subscription.warning_sent_at).toLocaleDateString('uk-UA')})</span>
                              </div>
                            )}
                            {profile.subscription.liqpay_order_id && (
                              <div className="flex justify-between text-[10px]">
                                <span>Ref:</span>
                                <span className="font-mono select-all truncate max-w-[200px]">{profile.subscription.liqpay_order_id}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => extendSubscription(profile.id, 30)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-all flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> +30 днів
                          </button>
                          <button
                            onClick={() => extendSubscription(profile.id, 90)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-all flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> +90 днів
                          </button>
                          {profile.subscription && profile.subscription.status === 'active' && (
                            <>
                              <button
                                onClick={() => cancelSubscription(profile.id)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Скасувати
                              </button>
                              <button
                                onClick={() => blockSubscription(profile.id)}
                                className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 text-xs font-bold hover:bg-rose-500/20 transition-all flex items-center gap-1"
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
                  <p className="text-xs text-slate-500 mt-2 italic">Немає зареєстрованих профілів</p>
                )}
              </div>
            ))}
            {users.length === 0 && !loadingUsers && (
              <p className="text-slate-500 text-center py-8">Немає зареєстрованих користувачів</p>
            )}
          </div>
        </div>
      )}
      
      {activeTab === "payments" && (
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Журнал рахунків та оплат (Subscription)</h2>
            <div className="flex items-center gap-3">
              {loadingPayments && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
              <button 
                onClick={fetchPayments}
                className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all"
              >
                Оновити
              </button>
            </div>
          </div>
          
          <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px]">ID</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Профіль</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Тариф/Послуга</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Сума</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Період</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Дата створення</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Статус</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Референс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-900/10">
                    <td className="p-3 font-mono text-slate-500">#{p.id}</td>
                    <td className="p-3 font-semibold text-slate-200">{p.profile_name}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] uppercase font-bold">
                        {p.tax_type}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-white">{p.amount} грн</td>
                    <td className="p-3 font-medium capitalize">{p.period || "—"}</td>
                    <td className="p-3 text-slate-400 font-semibold">{p.created_at || "—"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                        p.status === "paid" 
                          ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/25" 
                          : "bg-amber-500/10 text-amber-450 border-amber-500/25"
                      }`}>
                        {p.status === "paid" ? "Сплачено" : "Очікує"}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[10px] select-all truncate max-w-[150px]">{p.liqpay_order_id || "Внутрішній"}</td>
                  </tr>
                ))}
                {payments.length === 0 && !loadingPayments && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 italic">Немає записів про оплати</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {activeTab === "stats" && (
        <div className="p-6 rounded-2xl glass-panel space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Метрики та аналітика</h2>
            {loadingStats && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-450 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-slate-550">Всього користувачів</p>
                <p className="text-2xl font-black text-white mt-0.5">{stats?.total_users ?? 0}</p>
              </div>
            </div>
            
            <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 rounded-xl">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-slate-550">Всього підприємств/ФОП</p>
                <p className="text-2xl font-black text-white mt-0.5">{stats?.total_profiles ?? 0}</p>
              </div>
            </div>
            
            <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-450 rounded-xl">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-slate-550">Активні підписки Business</p>
                <p className="text-2xl font-black text-white mt-0.5">{stats?.active_business_subs ?? 0}</p>
              </div>
            </div>
            
            <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-teal-500/10 border border-teal-500/20 text-teal-450 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-slate-550">Загальний дохід (Revenue)</p>
                <p className="text-2xl font-black text-white mt-0.5">{stats?.total_revenue ?? 0} грн</p>
              </div>
            </div>
          </div>
          
          <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center gap-4 max-w-sm">
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 text-sky-450 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-slate-550">Кількість візитів сайту</p>
              <p className="text-2xl font-black text-white mt-0.5">{stats?.visit_count ?? 0}</p>
            </div>
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

      {activeTab === "emails" && (
        <div className="space-y-6">
          {/* Gmail API Connection card */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl">
                  <Mail className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-200">Gmail OAuth 2.0 (Розробник)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Підключення системної пошти розробника для надсилання рахунків підписок</p>
                </div>
              </div>

              {loadingEmailStatus ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400"></div>
              ) : isEmailConnected ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-450" />
                  Активно
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-750 gap-1.5">
                  Не підключено
                </span>
              )}
            </div>

            <div className="mt-8 border-t border-slate-800/80 pt-6">
              {loadingEmailStatus ? (
                <div className="h-20 flex items-center justify-center">
                  <p className="text-xs text-slate-500">Перевірка з'єднання...</p>
                </div>
              ) : isEmailConnected ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                    <p className="text-xs text-slate-550 uppercase tracking-wider font-bold">Підключена пошта розробника</p>
                    <p className="text-base font-bold text-slate-200 mt-1">{connectedEmail}</p>
                    <p className="text-[11px] text-slate-550 mt-1">Системні рахунки підписок надсилаються з цієї пошти.</p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={handleTestEmail}
                      disabled={isTestingEmail}
                      className="inline-flex items-center py-2.5 px-4 bg-indigo-650 hover:bg-indigo-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all gap-2 disabled:opacity-50"
                    >
                      {isTestingEmail ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Надсилання...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Перевірити пошту (тестовий лист)</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleDisconnectEmail}
                      className="inline-flex items-center py-2.5 px-4 bg-slate-950/60 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/50 text-slate-455 hover:text-rose-400 text-xs font-bold rounded-xl transition-all gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Відключити Gmail</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Підключіть Gmail розробника через Google OAuth 2.0 для автоматичного надсилання рахунків клієнтам.
                  </p>
                  <button
                    onClick={handleConnectEmail}
                    className="inline-flex items-center py-3 px-6 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-600 hover:to-violet-600 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-lg shadow-indigo-650/15 transition-all gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Підключити пошту Gmail розробника</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sent emails log table */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Журнал надісланих листів (EmailLog)</h2>
              <div className="flex items-center gap-3">
                {loadingEmails && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
                <button 
                  onClick={fetchEmails}
                  className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-350 hover:text-white text-xs font-semibold rounded-lg transition-all"
                >
                  Оновити
                </button>
              </div>
            </div>
            
            <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">ID</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Відправник</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Одержувач</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Тема</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Статус</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Дата відправки</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {emails.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-900/10">
                      <td className="p-3 font-mono text-slate-500">#{e.id}</td>
                      <td className="p-3 text-slate-450 truncate max-w-[150px]">{e.sender || "—"}</td>
                      <td className="p-3 font-semibold text-slate-200">{e.recipient}</td>
                      <td className="p-3 text-slate-300 font-medium">{e.subject}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                          e.status === "success" 
                            ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/25" 
                            : "bg-rose-500/10 text-rose-455 border-rose-500/25"
                        }`}>
                          {e.status === "success" ? "Успішно" : "Помилка"}
                        </span>
                        {e.error_message && (
                          <p className="text-[9px] text-rose-450 mt-1 max-w-[200px] truncate" title={e.error_message}>
                            {e.error_message}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 font-semibold">{e.sent_at || "—"}</td>
                    </tr>
                  ))}
                  {emails.length === 0 && !loadingEmails && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 italic">Немає записів про відправлені листи</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
