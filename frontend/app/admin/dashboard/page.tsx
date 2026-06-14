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
  Mail,
  X,
  Edit2,
  AlertCircle,
  Trash2,
  Lock,
  Unlock,
  Send,
  MessageSquare
} from "lucide-react";

export default function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "payments" | "pricing" | "stats" | "support">("users");
  const router = useRouter();

  // Data states
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pricing, setPricing] = useState<any[]>([]);

  // Support Chat states
  const [supportChats, setSupportChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInputText, setChatInputText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

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
  
  // Custom confirmation modal states
  const [deleteConfirmProfile, setDeleteConfirmProfile] = useState<any | null>(null);
  const [unblockConfirmProfile, setUnblockConfirmProfile] = useState<any | null>(null);

  // Delete Profile click handler
  const handleDeleteProfileClick = (e: React.MouseEvent, profileId: number, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;
    setDeleteConfirmProfile({ id: profileId, name });
  };

  const confirmDeleteProfile = async () => {
    if (!token || !deleteConfirmProfile) return;
    
    setLoading(true);
    try {
      await api.adminDeleteProfile(deleteConfirmProfile.id, token);
      alert("Профіль та всі його дані успішно видалено!");
      const data = await api.adminGetUsers(token);
      setUsers(data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Помилка при видаленні профілю");
    } finally {
      setLoading(false);
      setDeleteConfirmProfile(null);
    }
  };

  // Block / Unblock click handler
  const handleToggleBlockClick = (e: React.MouseEvent, profile: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;
    
    if (profile.is_blocked) {
      setUnblockConfirmProfile(profile);
    } else {
      setBlockingProfile(profile);
      setBlockReasonInput("Порушення умов використання або несплата послуг");
    }
  };

  const confirmUnblockProfile = async () => {
    if (!token || !unblockConfirmProfile) return;
    
    setLoading(true);
    try {
      await api.adminBlockProfile(unblockConfirmProfile.id, { is_blocked: false }, token);
      alert("Профіль успішно розблоковано!");
      const data = await api.adminGetUsers(token);
      setUsers(data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Помилка при розблокуванні");
    } finally {
      setLoading(false);
      setUnblockConfirmProfile(null);
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
        } else if (activeTab === "support") {
          const data = await api.adminGetSupportChats(token);
          setSupportChats(data);
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

  const fetchChatMessages = async (profileId: number) => {
    try {
      const msgs = await api.getSupportMessages(profileId);
      setChatMessages(msgs);
    } catch (e) {
      console.error("Failed to load support messages:", e);
    }
  };

  const handleSelectChat = (chat: any) => {
    setSelectedChat(chat);
    fetchChatMessages(chat.profile_id);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedChat || !chatInputText.trim()) return;

    setSendingReply(true);
    try {
      await api.adminReplySupportMessage(selectedChat.profile_id, chatInputText.trim(), token);
      setChatInputText("");
      await fetchChatMessages(selectedChat.profile_id);
      
      const data = await api.adminGetSupportChats(token);
      setSupportChats(data);
    } catch (err: any) {
      alert("Не вдалося надіслати відповідь");
    } finally {
      setSendingReply(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "support" || !selectedChat) return;

    const interval = setInterval(() => {
      fetchChatMessages(selectedChat.profile_id);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab, selectedChat]);

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
            <button
              onClick={() => setActiveTab("support")}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-bold transition-all gap-3 ${
                activeTab === "support"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-400 hover:bg-slate-900/60 hover:text-white"
              }`}
            >
              <Mail className="w-4 h-4" />
              Чат підтримки
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
                                onClick={(e) => handleToggleBlockClick(e, u)}
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
                                onClick={(e) => handleDeleteProfileClick(e, u.id, u.name)}
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

            {/* 5. SUPPORT TAB */}
            {activeTab === "support" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-14rem)] min-h-[480px]">
                
                {/* Left Column: Chats list (cols-5) */}
                <div className="lg:col-span-5 bg-slate-950/40 border border-slate-800 rounded-3xl flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-800/80 bg-slate-950/20">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-400" />
                      Активні діалоги ({supportChats.length})
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
                    {supportChats.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500 text-xs">
                        <MessageSquare className="w-8 h-8 text-slate-700 mb-2" />
                        Немає активних діалогів
                      </div>
                    ) : (
                      supportChats.map((chat) => {
                        const isSelected = selectedChat?.profile_id === chat.profile_id;
                        return (
                          <button
                            key={chat.profile_id}
                            onClick={() => handleSelectChat(chat)}
                            className={`w-full text-left p-3 rounded-2xl transition-all duration-200 flex items-start gap-3 ${
                              isSelected
                                ? "bg-slate-800/60 border border-slate-700/60 text-white"
                                : "hover:bg-slate-900/40 border border-transparent text-slate-300"
                            }`}
                          >
                            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full shrink-0 mt-1.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline gap-2">
                                <span className="font-bold text-xs truncate">{chat.profile_name}</span>
                                {chat.last_message_time && (
                                  <span className="text-[10px] text-slate-500 shrink-0">
                                    {new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {chat.last_message_from_admin && <span className="text-slate-500 font-medium">Ви: </span>}
                                {chat.last_message_text}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                {chat.is_blocked ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    Блокований
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Активний
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Active Dialog (cols-7) */}
                <div className="lg:col-span-7 bg-slate-950/40 border border-slate-800 rounded-3xl flex flex-col overflow-hidden">
                  {selectedChat ? (
                    <>
                      {/* Header */}
                      <div className="p-4 border-b border-slate-800/80 bg-slate-950/20 flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-bold text-white">{selectedChat.profile_name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] text-slate-400">Діалог відкритий</span>
                          </div>
                        </div>
                        {selectedChat.is_blocked && (
                          <span className="px-2 py-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/10 rounded-full border border-rose-500/20">
                            Користувач заблокований
                          </span>
                        )}
                      </div>

                      {/* Messages scrollable area */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/10">
                        {chatMessages.map((msg) => {
                          const isAdmin = msg.is_from_admin;
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2 text-xs font-medium space-y-1 ${
                                  isAdmin
                                    ? "bg-indigo-600 text-white rounded-br-none"
                                    : "bg-slate-800/80 text-slate-100 rounded-bl-none border border-slate-700/40"
                                }`}
                              >
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                <span
                                  className={`block text-[9px] text-right font-normal ${
                                    isAdmin ? "text-indigo-200" : "text-slate-400"
                                  }`}
                                >
                                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {chatMessages.length === 0 && (
                          <div className="text-center text-slate-500 text-xs py-8">
                            Немає повідомлень у цьому діалозі.
                          </div>
                        )}
                      </div>

                      {/* Send Form */}
                      <form onSubmit={handleSendReply} className="p-3 border-t border-slate-800 bg-slate-950/20 flex gap-2">
                        <input
                          type="text"
                          value={chatInputText}
                          onChange={(e) => setChatInputText(e.target.value)}
                          placeholder="Введіть повідомлення для користувача..."
                          className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-medium focus:outline-none focus:border-indigo-500 placeholder-slate-500 text-white"
                        />
                        <button
                          type="submit"
                          disabled={sendingReply || !chatInputText.trim()}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl flex items-center justify-center transition-all shadow-md shadow-indigo-600/10 shrink-0 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 text-xs">
                      <MessageSquare className="w-12 h-12 text-slate-800 mb-3" />
                      <p className="font-bold text-slate-400">Діалог не обрано</p>
                      <p className="text-slate-600 mt-1 max-w-xs">Оберіть користувача зі списку ліворуч, щоб почати листування.</p>
                    </div>
                  )}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-500" />
                  Видалення профілю
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Ви дійсно хочете повністю видалити профіль:{" "}
                  <span className="font-bold text-indigo-400">{deleteConfirmProfile.name}</span>?
                </p>
              </div>
              <button
                onClick={() => setDeleteConfirmProfile(null)}
                className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-4">
              <p className="text-xs text-rose-400 font-semibold">
                ⚠️ Це видалить всі виписки, транзакції, звіти та підписку без можливості відновлення!
              </p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-800/60">
              <button
                onClick={() => setDeleteConfirmProfile(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 font-bold text-xs transition-all"
              >
                Скасувати
              </button>
              <button
                onClick={confirmDeleteProfile}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-md shadow-rose-600/10 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Confirmation Modal */}
      {unblockConfirmProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Unlock className="w-5 h-5 text-emerald-500" />
                  Розблокування профілю
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Розблокувати профіль:{" "}
                  <span className="font-bold text-indigo-400">{unblockConfirmProfile.name}</span>?
                </p>
              </div>
              <button
                onClick={() => setUnblockConfirmProfile(null)}
                className="p-1 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-800/60">
              <button
                onClick={() => setUnblockConfirmProfile(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 font-bold text-xs transition-all"
              >
                Скасувати
              </button>
              <button
                onClick={confirmUnblockProfile}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" />
                Розблокувати
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
