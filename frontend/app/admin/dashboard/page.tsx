"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { 
  Users, 
  CreditCard, 
  Settings2, 
  TrendingUp, 
  LogOut, 
  Search, 
  Calendar, 
  Check, 
  X,
  Edit2,
  AlertCircle,
  Trash2,
  Lock,
  Unlock
} from "lucide-react";

export default function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "payments" | "pricing" | "stats">("users");
  const router = useRouter();

  // Data states
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pricing, setPricing] = useState<any[]>([]);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("");

  // Loading and Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit subscription modal states
  const [selectedProfileForSub, setSelectedProfileForSub] = useState<any | null>(null);
  const [editPlanType, setEditPlanType] = useState("free");
  const [editExpiresAt, setEditExpiresAt] = useState("");

  // Admin Profile Block & Delete states
  const [blockingProfile, setBlockingProfile] = useState<any | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState("");

  // Delete Profile click handler
  const handleDeleteProfileClick = async (profileId: number, name: string) => {
    if (!token) return;
    if (!confirm(`Ви дійсно хочете повністю видалити профіль "${name}"? Це видалить всі його виписки, транзакції, звіти та підписку без можливості відновлення!`)) {
      return;
    }

    setLoading(true);
    try {
      await api.adminDeleteProfile(profileId, token);
      alert("Профіль та всі його дані успішно видалено!");
      const data = await api.adminGetUsers(token);
      setUsers(data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Помилка при видаленні профілю");
    } finally {
      setLoading(false);
    }
  };

  // Block / Unblock click handler
  const handleToggleBlockClick = async (profile: any) => {
    if (!token) return;
    
    if (profile.is_blocked) {
      if (!confirm(`Розблокувати профіль "${profile.name}"?`)) return;
      setLoading(true);
      try {
        await api.adminBlockProfile(profile.id, { is_blocked: false }, token);
        alert("Профіль успішно розблоковано!");
        const data = await api.adminGetUsers(token);
        setUsers(data);
      } catch (err: any) {
        alert(err.response?.data?.detail || "Помилка при розблокуванні");
      } finally {
        setLoading(false);
      }
    } else {
      setBlockingProfile(profile);
      setBlockReasonInput("Порушення умов використання або несплата послуг");
    }
  };

  const handleSaveBlockProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !blockingProfile) return;

    setLoading(true);
    try {
      await api.adminBlockProfile(blockingProfile.id, {
        is_blocked: true,
        block_reason: blockReasonInput.trim() || undefined
      }, token);
      alert("Профіль тимчасово заблоковано!");
      setBlockingProfile(null);
      const data = await api.adminGetUsers(token);
      setUsers(data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Помилка при блокуванні профілю");
    } finally {
      setLoading(false);
    }
  };

  // Edit pricing states
  const [monthlyPriceInput, setMonthlyPriceInput] = useState<string>("499");
  const [yearlyPriceInput, setYearlyPriceInput] = useState<string>("4989");

  // Load and verify Admin token
  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    if (!savedToken) {
      router.push("/admin/login");
    } else {
      setToken(savedToken);
    }
  }, [router]);

  // Load data based on active tab
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === "users") {
          const data = await api.adminGetUsers(token);
          setUsers(data);
        } else if (activeTab === "payments") {
          const data = await api.adminGetPayments(token);
          setPayments(data);
        } else if (activeTab === "pricing") {
          const data = await api.getPricing();
          setPricing(data);
          // Set inputs
          const monthlyObj = data.find((p: any) => p.plan_type === "business" && p.payment_period === "monthly");
          const yearlyObj = data.find((p: any) => p.plan_type === "business" && p.payment_period === "yearly");
          if (monthlyObj) setMonthlyPriceInput(String(monthlyObj.price));
          if (yearlyObj) setYearlyPriceInput(String(yearlyObj.price));
        } else if (activeTab === "stats") {
          const data = await api.adminGetStats(token);
          setStats(data);
        }
      } catch (err: any) {
        console.error("Admin data loading error:", err);
        setError("Помилка завантаження даних. Можливо сесія застаріла.");
        if (err.response?.status === 401) {
          localStorage.removeItem("admin_token");
          router.push("/admin/login");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTab, token, router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    router.push("/admin/login");
  };

  // Filtered Users list based on query and plan filters
  const getFilteredUsers = () => {
    return users.filter((u: any) => {
      const matchesSearch = 
        (u.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
        (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesPlan = planFilter ? u.plan === planFilter : true;
      return matchesSearch && matchesPlan;
    });
  };

  // Open Edit Subscription Modal
  const openEditSubscription = (profile: any) => {
    setSelectedProfileForSub(profile);
    setEditPlanType(profile.plan || "free");
    setEditExpiresAt(profile.expires_at ? profile.expires_at.split(" ")[0] : "");
  };

  // Save customized subscription type/expires_at
  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedProfileForSub) return;

    setLoading(true);
    try {
      await api.adminUpdateUserSubscription(
        selectedProfileForSub.id, 
        {
          plan_type: editPlanType,
          expires_at: editExpiresAt || null
        }, 
        token
      );
      alert("Підписку оновлено!");
      setSelectedProfileForSub(null);
      // Reload users
      const data = await api.adminGetUsers(token);
      setUsers(data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Помилка при оновленні підписки");
    } finally {
      setLoading(false);
    }
  };

  // Update business plan pricing
  const handleUpdatePrice = async (period: "monthly" | "yearly", amountStr: string) => {
    if (!token) return;
    const priceVal = parseInt(amountStr, 10);
    if (isNaN(priceVal) || priceVal <= 0) {
      alert("Сума має бути позитивним числом!");
      return;
    }

    setLoading(true);
    try {
      await api.adminUpdatePricing({
        plan_type: "business",
        payment_period: period,
        price: priceVal
      }, token);
      alert("Ціну успішно оновлено!");
      // Reload pricing
      const data = await api.getPricing();
      setPricing(data);
    } catch (err: any) {
      alert("Помилка при оновленні ціни");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#090d16] text-[#f1f5f9] font-sans antialiased">
      
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950/40 p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg">
              <span className="font-extrabold text-white text-lg">A</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">UniTax Admin</h1>
              <p className="text-[10px] text-indigo-500 uppercase tracking-widest font-black">Панель керування</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-bold transition-all gap-3 ${
                activeTab === "users"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-400 hover:bg-slate-900/60 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              Користувачі
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-bold transition-all gap-3 ${
                activeTab === "payments"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-400 hover:bg-slate-900/60 hover:text-white"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Платежі
            </button>
            <button
              onClick={() => setActiveTab("pricing")}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-bold transition-all gap-3 ${
                activeTab === "pricing"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-400 hover:bg-slate-900/60 hover:text-white"
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Ціни та тарифи
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-bold transition-all gap-3 ${
                activeTab === "stats"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-400 hover:bg-slate-900/60 hover:text-white"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Статистика
            </button>
          </nav>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 text-xs font-bold transition-all gap-2"
        >
          <LogOut className="w-4 h-4" />
          Вийти з кабінету
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto space-y-8">
        
        {/* Header section */}
        <div className="flex justify-between items-center pb-6 border-b border-slate-800/60">
          <div>
            <h2 className="text-2xl font-black capitalize text-white">
              {activeTab === "users" && "Керування користувачами"}
              {activeTab === "payments" && "Транзакції та рахунки"}
              {activeTab === "pricing" && "Налаштування вартості підписок"}
              {activeTab === "stats" && "Аналітика та статистика"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === "users" && "Переглядайте профілі клієнтів, їхні підписки та змінюйте тарифи вручну."}
              {activeTab === "payments" && "Журнал платежів через LiqPay за оренду або заміну тарифу."}
              {activeTab === "pricing" && "Редагуйте вартості бізнес тарифів, які показуються користувачам при виборі."}
              {activeTab === "stats" && "Загальний вигляд основних фінансових та кількісних метрик UniTax."}
            </p>
          </div>
        </div>

        {/* Global Loading / Error Display */}
        {loading && !selectedProfileForSub && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Contents */}
        {!loading && !error && (
          <div className="space-y-6">
            
            {/* 1. USERS TAB */}
            {activeTab === "users" && (
              <div className="space-y-6">
                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-4 bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Пошук за назвою або email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-900/40 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="px-4 py-2 bg-slate-900/40 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="">Всі тарифи</option>
                    <option value="free">Free</option>
                    <option value="business">Business</option>
                  </select>
                </div>

                {/* Profiles Table */}
                <div className="bg-slate-950/20 border border-slate-800/80 rounded-2xl overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-4 font-bold">Профіль</th>
                        <th className="p-4 font-bold">Email користувача</th>
                        <th className="p-4 font-bold">Система</th>
                        <th className="p-4 font-bold">Реєстрація</th>
                        <th className="p-4 font-bold">Тариф</th>
                        <th className="p-4 font-bold">Статус</th>
                        <th className="p-4 font-bold">Діє до</th>
                        <th className="p-4 font-bold text-center">Дія</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {getFilteredUsers().map((u: any) => (
                        <tr key={u.id} className="hover:bg-slate-900/20 transition-all">
                          <td className="p-4 font-bold text-white">{u.name}</td>
                          <td className="p-4 text-slate-400 font-semibold">{u.email || "—"}</td>
                          <td className="p-4 text-slate-400 uppercase font-semibold">{u.tax_system === "ednuy-3-5%" ? "ЄП" : "Загальна"}</td>
                          <td className="p-4 text-slate-400 font-semibold">{u.reg_date || "—"}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                              u.plan === "business" 
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                                : "bg-slate-800 text-slate-400"
                            }`}>
                              {u.plan}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                                u.status === "active" 
                                  ? "bg-emerald-500/10 text-emerald-400" 
                                  : "bg-rose-500/10 text-rose-400"
                              }`}>
                                {u.status}
                              </span>
                              {u.is_blocked && (
                                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1" title={u.block_reason}>
                                  <Lock className="w-2.5 h-2.5" /> Блок
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-slate-400 font-semibold">{u.expires_at || "Безлімітно"}</td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditSubscription(u)}
                                className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 rounded-lg transition-all"
                                title="Редагувати підписку"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleBlockClick(u)}
                                className={`p-1.5 bg-slate-900 border border-slate-800 rounded-lg transition-all ${
                                  u.is_blocked 
                                    ? "text-amber-400 hover:text-amber-300 hover:border-amber-500/40" 
                                    : "text-slate-400 hover:text-rose-400 hover:border-rose-500/40"
                                }`}
                                title={u.is_blocked ? "Розблокувати профіль" : "Заблокувати профіль"}
                              >
                                {u.is_blocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDeleteProfileClick(u.id, u.name)}
                                className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-500 hover:border-rose-500/40 rounded-lg transition-all"
                                title="Видалити профіль"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {getFilteredUsers().length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 font-semibold">
                            Профілів не знайдено за даними фільтрами.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. PAYMENTS TAB */}
            {activeTab === "payments" && (
              <div className="bg-slate-950/20 border border-slate-800/80 rounded-2xl overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-4 font-bold">ID</th>
                      <th className="p-4 font-bold">Профіль</th>
                      <th className="p-4 font-bold">Тариф</th>
                      <th className="p-4 font-bold">Сума</th>
                      <th className="p-4 font-bold">Період оплати</th>
                      <th className="p-4 font-bold">Призначення</th>
                      <th className="p-4 font-bold">LiqPay Order ID</th>
                      <th className="p-4 font-bold">Дата створення</th>
                      <th className="p-4 font-bold">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {payments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-900/20 transition-all">
                        <td className="p-4 font-semibold text-slate-400">{p.id}</td>
                        <td className="p-4 font-bold text-white">{p.profile_name}</td>
                        <td className="p-4 text-slate-400 font-semibold capitalize">
                          {p.tax_type === "business" ? "Business" : p.tax_type === "free" ? "Free" : p.tax_type}
                        </td>
                        <td className="p-4 font-extrabold text-white">{p.amount} грн</td>
                        <td className="p-4 text-slate-400 font-semibold">
                          {p.period === "monthly" ? "Щомісячно" : p.period === "yearly" ? "Щорічно" : p.period}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-md font-bold text-[9px] uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Підписка
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 font-mono text-[10px]">{p.liqpay_order_id || "—"}</td>
                        <td className="p-4 text-slate-400 font-semibold">{p.created_at || "—"}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                            p.status === "paid" 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {p.status === "paid" ? "Сплачено" : "В очікуванні"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-500 font-semibold">
                          Журнал транзакцій порожній.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. PRICING TAB */}
            {activeTab === "pricing" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Monthly Configuration Card */}
                <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-3xl space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-indigo-500 font-black uppercase tracking-wider block">Тариф Business</span>
                    <h3 className="text-lg font-bold text-white">Помісячна оплата (Business Monthly)</h3>
                    <p className="text-xs text-slate-500">Вартість повного доступу за 30 календарних днів.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={monthlyPriceInput}
                        onChange={(e) => setMonthlyPriceInput(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm font-semibold focus:outline-none"
                      />
                      <span className="absolute right-4 top-3 text-slate-500 text-xs font-bold">UAH / міс</span>
                    </div>
                    <button
                      onClick={() => handleUpdatePrice("monthly", monthlyPriceInput)}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10"
                    >
                      Оновити
                    </button>
                  </div>
                </div>

                {/* Yearly Configuration Card */}
                <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-3xl space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-emerald-500 font-black uppercase tracking-wider block">Тариф Business</span>
                    <h3 className="text-lg font-bold text-white">Річна оплата (Business Yearly)</h3>
                    <p className="text-xs text-slate-500">Вартість повного доступу за 365 календарних днів.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={yearlyPriceInput}
                        onChange={(e) => setYearlyPriceInput(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm font-semibold focus:outline-none"
                      />
                      <span className="absolute right-4 top-3 text-slate-500 text-xs font-bold">UAH / рік</span>
                    </div>
                    <button
                      onClick={() => handleUpdatePrice("yearly", yearlyPriceInput)}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10"
                    >
                      Оновити
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* 4. STATS TAB */}
            {activeTab === "stats" && stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Users Count */}
                <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Користувачі в системі</p>
                  <h4 className="text-3xl font-black text-white">{stats.total_users}</h4>
                  <p className="text-[10px] text-slate-600">Загальна кількість зареєстрованих ID</p>
                </div>

                {/* Profiles Count */}
                <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Суб'єкти (Профілі)</p>
                  <h4 className="text-3xl font-black text-white">{stats.total_profiles}</h4>
                  <p className="text-[10px] text-slate-600">Кількість доданих ФОП та ТОВ</p>
                </div>

                {/* Subscriptions Count */}
                <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Активні Business підписки</p>
                  <h4 className="text-3xl font-black text-white text-amber-400">{stats.active_business_subscriptions}</h4>
                  <p className="text-[10px] text-slate-600">Користувачі з платними тарифами</p>
                </div>

                {/* Total Revenue */}
                <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Загальний дохід (LiqPay)</p>
                  <h4 className="text-3xl font-black text-emerald-400">{stats.total_revenue} грн</h4>
                  <p className="text-[10px] text-slate-600">Сума всіх успішних транзакцій</p>
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* Edit Subscription Modal (Overlay) */}
      {selectedProfileForSub && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">Редагувати підписку</h3>
                <p className="text-xs text-slate-500 mt-1">Змініть статус та дату закінчення підписки для профілю: <span className="font-bold text-indigo-400">{selectedProfileForSub.name}</span></p>
              </div>
              <button
                onClick={() => setSelectedProfileForSub(null)}
                className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Тарифний план</label>
                <select
                  value={editPlanType}
                  onChange={(e) => setEditPlanType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="free">Free (Безкоштовно)</option>
                  <option value="business">Business (Платний)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Діє до (Expiry Date)</label>
                <input
                  type="date"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold focus:outline-none"
                />
                <span className="text-[9px] text-slate-500 block">Залиште порожнім для безлімітного безкоштовного тарифу.</span>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setSelectedProfileForSub(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 font-bold text-xs transition-all"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/10"
                >
                  Зберегти зміни
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Block Profile Modal (Overlay) */}
      {blockingProfile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-rose-500" />
                  Блокування профілю
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Будь ласка, вкажіть причину тимчасового блокування для профілю:{" "}
                  <span className="font-bold text-indigo-400">{blockingProfile.name}</span>
                </p>
              </div>
              <button
                onClick={() => setBlockingProfile(null)}
                className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBlockProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Причина блокування</label>
                <textarea
                  value={blockReasonInput}
                  onChange={(e) => setBlockReasonInput(e.target.value)}
                  placeholder="Вкажіть причину (наприклад: Порушення умов використання або несплата послуг)..."
                  className="w-full h-24 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 resize-none text-white"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setBlockingProfile(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 font-bold text-xs transition-all"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-md shadow-rose-600/10 flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Заблокувати
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
