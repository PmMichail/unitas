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
  MessageSquare,
  RefreshCw
} from "lucide-react";

export default function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "payments" | "pricing" | "stats" | "support" | "emails">("users");
  const router = useRouter();

  // Data states
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [statsPeriod, setStatsPeriod] = useState<"day" | "week" | "month">("day");
  const [pricing, setPricing] = useState<any[]>([]);

  // Edit pricing states
  const [monthlyPriceInput, setMonthlyPriceInput] = useState<string>("499");
  const [halfYearlyPriceInput, setHalfYearlyPriceInput] = useState<string>("2499");
  const [yearlyPriceInput, setYearlyPriceInput] = useState<string>("4989");
  const [residentCabinetPriceInput, setResidentCabinetPriceInput] = useState<string>("500");

  // Email connection and sent emails log states
  const [emails, setEmails] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [isEmailConnected, setIsEmailConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [loadingEmailStatus, setLoadingEmailStatus] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

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
  const [editPaymentPeriod, setEditPaymentPeriod] = useState("monthly");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editIsMemberModuleActive, setEditIsMemberModuleActive] = useState(false);

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

  // Email connection status, connect status loading, disconnect, test email and log fetching functions
  const fetchEmailStatus = async () => {
    if (!token) return;
    setLoadingEmailStatus(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev"}/api/auth/google/status/0`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
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
    if (!token) return;
    setLoadingEmails(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev"}/api/admin/emails`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setEmails(data || []);
    } catch (error) {
      console.error("Error fetching admin emails:", error);
    } finally {
      setLoadingEmails(false);
    }
  };

  const handleConnectEmail = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev"}/api/auth/google/url/0?token=${token}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data && data.url) {
        window.location.href = data.url;
      } else {
        alert("Не вдалося отримати URL авторизації");
      }
    } catch (error) {
      console.error("Error during email connect:", error);
      alert("Помилка при підключенні пошти");
    }
  };

  const handleDisconnectEmail = async () => {
    if (!token) return;
    if (!confirm("Ви впевнені, що хочете відключити пошту Gmail адміністратора?")) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev"}/api/auth/google/0`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setIsEmailConnected(false);
        setConnectedEmail("");
        alert("Gmail адміністратора відключено");
      } else {
        alert("Не вдалося відключити пошту");
      }
    } catch (error) {
      console.error("Error disconnecting email:", error);
      alert("Помилка при відключенні пошти");
    }
  };

  const handleTestEmail = async () => {
    if (!token) return;
    setIsTestingEmail(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev"}/api/auth/google/test-email/0`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        alert(`Тестовий лист успішно надіслано на ${connectedEmail}!`);
        fetchEmails();
      } else {
        const data = await response.json();
        alert(data.detail || "Не вдалося надіслати тестовий лист");
      }
    } catch (error) {
      console.error("Error testing email:", error);
      alert("Помилка при надсиланні тестового листа");
    } finally {
      setIsTestingEmail(false);
    }
  };

  // Handle URL callback parameters (success or error)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("success") === "email_connected") {
        alert("Gmail успішно підключено!");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (urlParams.get("error")) {
        alert(`Помилка авторизації: ${urlParams.get("error")}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

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
          const halfYearlyObj = data.find((p: any) => p.plan_type === "business" && p.payment_period === "half_yearly");
          const yearlyObj = data.find((p: any) => p.plan_type === "business" && p.payment_period === "yearly");
          const residentObj = data.find((p: any) => p.plan_type === "resident_cabinet" && p.payment_period === "monthly");
          if (monthlyObj) setMonthlyPriceInput(String(monthlyObj.price));
          if (halfYearlyObj) setHalfYearlyPriceInput(String(halfYearlyObj.price));
          if (yearlyObj) setYearlyPriceInput(String(yearlyObj.price));
          if (residentObj) setResidentCabinetPriceInput(String(residentObj.price));
        } else if (activeTab === "stats") {
          const data = await api.adminGetStats(token);
          setStats(data);
        } else if (activeTab === "support") {
          const data = await api.adminGetSupportChats(token);
          setSupportChats(data);
        } else if (activeTab === "emails") {
          await fetchEmailStatus();
          await fetchEmails();
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

  // Get subscription status formatting details for table row status column
  const getSubscriptionStatusInfo = (u: any) => {
    // Use the color_marker from subscription if available
    if (u.subscription && u.subscription.color_marker) {
      const colorMarker = u.subscription.color_marker;
      
      switch (colorMarker) {
        case "red":
          return { color: "red", text: "Просрочено", bg: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
        case "orange":
          return { 
            color: "orange", 
            text: u.subscription.days_until_expiry !== null 
              ? `Закінчується за ${u.subscription.days_until_expiry} дн.` 
              : "Закінчується", 
            bg: "bg-amber-500/10 text-amber-500 border-amber-500/20" 
          };
        case "blue":
          return { color: "blue", text: "Лист надіслано", bg: "bg-sky-500/10 text-sky-400 border-sky-500/20" };
        case "green":
          return { 
            color: "green", 
            text: u.subscription.status === "trial" ? "Пробний період" : "Оплачено", 
            bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
          };
        case "gray":
          return { color: "gray", text: "Скасовано", bg: "bg-slate-500/10 text-slate-400 border-slate-800/40" };
        default:
          return { color: "slate", text: "Не активовано", bg: "bg-slate-500/10 text-slate-400 border-slate-800/40" };
      }
    }
    
    // Fallback to old logic for backward compatibility
    if (!u || u.plan !== "business") {
      if (u && u.free_status === "downgraded_unpaid") {
        return { color: "orange", text: "Переключено за несплату", bg: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
      }
      return { color: "slate", text: "Не активовано", bg: "bg-slate-500/10 text-slate-400 border-slate-850 border-slate-800/40" };
    }
    
    if (u.status === "pending") {
      return {
        color: "orange",
        text: "Очікує оплату",
        bg: "bg-amber-500/10 text-amber-500 border-amber-500/20"
      };
    }
    
    const now = new Date();
    const expiresAt = u.expires_at ? new Date(u.expires_at) : null;
    
    // 1. Check if expired
    if (u.status === "expired" || (expiresAt && expiresAt < now)) {
      return {
        color: "red",
        text: "Прострочено",
        bg: "bg-rose-500/10 text-rose-500 border-rose-500/20"
      };
    }
    
    // 2. Check if warning was sent for the CURRENT expiration cycle (within the active window)
    const warningSentForCurrentCycle = u.warning_sent_at && expiresAt && 
      (new Date(u.warning_sent_at).getTime() >= expiresAt.getTime() - 5 * 24 * 60 * 60 * 1000);

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
    if (u.status === "active") {
      return {
        color: "green",
        text: u.demo_activated ? "Демо-доступ" : "Активний",
        bg: "bg-emerald-500/10 text-emerald-500 border-emerald-550 border-emerald-500/20"
      };
    }
    
    return {
      color: "green",
      text: u.demo_activated ? "Демо-доступ" : "Business",
      bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
    };
  };

  const getSubscriptionPeriodDatesText = (u: any) => {
    if (!u.expires_at) return "Безлімітно";
    const expiresAt = new Date(u.expires_at);
    const startAt = new Date(expiresAt);
    
    if (u.demo_activated) {
      startAt.setDate(expiresAt.getDate() - 7);
    } else if (u.payment_period === "monthly") {
      startAt.setMonth(expiresAt.getMonth() - 1);
    } else if (u.payment_period === "half_yearly") {
      startAt.setMonth(expiresAt.getMonth() - 6);
    } else if (u.payment_period === "yearly") {
      startAt.setFullYear(expiresAt.getFullYear() - 1);
    } else {
      startAt.setMonth(expiresAt.getMonth() - 1);
    }
    
    const startStr = startAt.toLocaleDateString('uk-UA');
    const endStr = expiresAt.toLocaleDateString('uk-UA');
    
    return `з ${startStr} по ${endStr}${u.demo_activated ? " (Пробний)" : ""}`;
  };

  // Open Edit Subscription Modal
  const openEditSubscription = (profile: any) => {
    setSelectedProfileForSub(profile);
    setEditPlanType(profile.plan || "free");
    setEditPaymentPeriod(profile.payment_period || "monthly");
    setEditExpiresAt(profile.expires_at ? profile.expires_at.split(" ")[0] : "");
    setEditIsMemberModuleActive(profile.is_member_module_active || false);
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
          payment_period: editPaymentPeriod,
          expires_at: editExpiresAt || null,
          is_member_module_active: editIsMemberModuleActive
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
  const handleUpdatePrice = async (period: "monthly" | "half_yearly" | "yearly" | "resident_cabinet", amountStr: string) => {
    if (!token) return;
    const priceVal = parseInt(amountStr, 10);
    if (isNaN(priceVal) || priceVal <= 0) {
      alert("Сума має бути позитивним числом!");
      return;
    }

    setLoading(true);
    try {
      await api.adminUpdatePricing({
        plan_type: period === "resident_cabinet" ? "resident_cabinet" : "business",
        payment_period: period === "resident_cabinet" ? "monthly" : period,
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
              <MessageSquare className="w-4 h-4" />
              Чат підтримки
            </button>
            <button
              onClick={() => setActiveTab("emails")}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-bold transition-all gap-3 ${
                activeTab === "emails"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-400 hover:bg-slate-900/60 hover:text-white"
              }`}
            >
              <Mail className="w-4 h-4" />
              Пошта
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
              {activeTab === "emails" && "Керування системною поштою"}
              {activeTab === "support" && "Чат підтримки клієнтів"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === "users" && "Переглядайте профілі клієнтів, їхні підписки та змінюйте тарифи вручну."}
              {activeTab === "payments" && "Журнал платежів через Mono Pay за оренду або заміну тарифу."}
              {activeTab === "pricing" && "Редагуйте вартості бізнес тарифів, які показуються користувачам при виборі."}
              {activeTab === "stats" && "Загальний вигляд основних фінансових та кількісних метрик UniTax."}
              {activeTab === "emails" && "OAuth підключення Gmail, відправка тестових листів та перегляд журналу логів."}
              {activeTab === "support" && "Переписка з користувачами та відповіді на повідомлення техпідтримки."}
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
                        <th className="p-4 font-bold">Email</th>
                        <th className="p-4 font-bold">Тариф</th>
                        <th className="p-4 font-bold">Статус підписки</th>
                        <th className="p-4 font-bold">Остання оплата</th>
                        <th className="p-4 font-bold">Діє до</th>
                        <th className="p-4 font-bold">Нагадування</th>
                        <th className="p-4 font-bold text-center">Дії</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {getFilteredUsers().map((u: any) => (
                        <tr key={u.id} className="hover:bg-slate-900/20 transition-all">
                          <td className="p-4 font-bold text-white">{u.name}</td>
                          <td className="p-4 text-slate-400 font-semibold">{u.email || "—"}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                                u.plan === "business" 
                                  ? u.demo_activated
                                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                  : u.free_status === "downgraded_unpaid"
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : "bg-slate-800 text-slate-400"
                              }`}>
                                {u.demo_activated 
                                  ? "business (пробний)" 
                                  : u.plan === "business"
                                    ? u.payment_period === "yearly"
                                      ? "business (річна)"
                                      : u.payment_period === "half_yearly"
                                        ? "business (піврічна)"
                                        : u.payment_period === "monthly"
                                          ? "business (місячна)"
                                          : "business"
                                    : u.free_status === "downgraded_unpaid"
                                      ? "free (несплата)"
                                      : u.plan}
                              </span>
                              {u.payment_period && u.plan === "business" && (
                                <span className="text-[9px] text-slate-500">
                                  {u.payment_period === "monthly" ? "1 місяць" : u.payment_period === "half_yearly" ? "6 місяців" : "1 рік"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              {(() => {
                                const statusInfo = getSubscriptionStatusInfo(u);
                                return (
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${statusInfo.bg}`}>
                                    {statusInfo.text}
                                  </span>
                                );
                              })()}
                              {u.is_blocked && (
                                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1" title={u.block_reason}>
                                  <Lock className="w-2.5 h-2.5" /> Блок
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-slate-400 font-semibold text-xs">
                            {u.subscription && u.subscription.last_payment_date 
                              ? new Date(u.subscription.last_payment_date).toLocaleDateString('uk-UA')
                              : "—"}
                          </td>
                          <td className="p-4 text-slate-400 font-semibold text-xs">
                            {u.plan === "free"
                              ? u.free_status === "downgraded_unpaid"
                                ? `Завершено: ${u.expires_at ? new Date(u.expires_at).toLocaleDateString('uk-UA') : "—"}`
                                : "Не активовано"
                              : u.subscription && u.subscription.expires_at
                                ? `До ${new Date(u.subscription.expires_at).toLocaleDateString('uk-UA')}`
                                : "Не активовано"}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              {u.subscription && u.subscription.reminder_email_sent_at ? (
                                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                                  <Mail className="w-2.5 h-2.5" /> {new Date(u.subscription.reminder_email_sent_at).toLocaleDateString('uk-UA')}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px]">—</span>
                              )}
                              {u.subscription && u.subscription.auto_renew && (
                                <span className="px-2 py-0.5 rounded-md font-bold text-[9px] uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                  Автопродовження
                                </span>
                              )}
                            </div>
                          </td>
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
                      <th className="p-4 font-bold">Mono Invoice ID</th>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
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

                {/* Half-Yearly Configuration Card */}
                <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-3xl space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-amber-500 font-black uppercase tracking-wider block">Тариф Business</span>
                    <h3 className="text-lg font-bold text-white">Піврічна оплата (Business Half-Yearly)</h3>
                    <p className="text-xs text-slate-500">Вартість повного доступу за 180 календарних днів.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={halfYearlyPriceInput}
                        onChange={(e) => setHalfYearlyPriceInput(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm font-semibold focus:outline-none"
                      />
                      <span className="absolute right-4 top-3 text-slate-500 text-xs font-bold">UAH / 6 міс</span>
                    </div>
                    <button
                      onClick={() => handleUpdatePrice("half_yearly", halfYearlyPriceInput)}
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

                {/* Resident Cabinet Module Configuration Card */}
                <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-3xl space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-rose-500 font-black uppercase tracking-wider block">Модуль кабінету мешканця</span>
                    <h3 className="text-lg font-bold text-white">Помісячна оплата (Resident Cabinet)</h3>
                    <p className="text-xs text-slate-500">Вартість щомісячної підписки на особистий кабінет для мешканців ОСББ.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={residentCabinetPriceInput}
                        onChange={(e) => setResidentCabinetPriceInput(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm font-semibold focus:outline-none"
                      />
                      <span className="absolute right-4 top-3 text-slate-500 text-xs font-bold">UAH / міс</span>
                    </div>
                    <button
                      onClick={() => handleUpdatePrice("resident_cabinet", residentCabinetPriceInput)}
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
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  
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
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Загальний дохід (Mono Pay)</p>
                    <h4 className="text-3xl font-black text-emerald-400">{stats.total_revenue} грн</h4>
                    <p className="text-[10px] text-slate-600">Сума всіх успішних транзакцій</p>
                  </div>

                  {/* Visits Count */}
                  <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Кількість відвідувань</p>
                    <h4 className="text-3xl font-black text-sky-400">{stats.visit_count || 0}</h4>
                    <p className="text-[10px] text-slate-600">Загальний лічильник відвідувань сайту</p>
                  </div>

                </div>

                {/* Visits Analytics Chart */}
                <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-3xl space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900/60 pb-4">
                    <div>
                      <h4 className="text-base font-bold text-white">Аналітика відвідувань сайту</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Перегляд активності користувачів та трафіку за вибраний період.</p>
                    </div>

                    {/* Period Switcher */}
                    <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800/80 shrink-0">
                      <button
                        type="button"
                        onClick={() => setStatsPeriod("day")}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                          statsPeriod === "day"
                            ? "bg-indigo-650 text-white shadow"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        По днях
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatsPeriod("week")}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                          statsPeriod === "week"
                            ? "bg-indigo-650 text-white shadow"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        По тижнях
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatsPeriod("month")}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                          statsPeriod === "month"
                            ? "bg-indigo-650 text-white shadow"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        По місяцях
                      </button>
                    </div>
                  </div>

                  {/* Chart representation */}
                  {(() => {
                    const currentDataset = 
                      statsPeriod === "day" 
                        ? (stats.visits_by_day || [])
                        : statsPeriod === "week"
                          ? (stats.visits_by_week || [])
                          : (stats.visits_by_month || []);

                    const maxCount = Math.max(...currentDataset.map((d: any) => d.count), 1);

                    if (currentDataset.length === 0) {
                      return (
                        <div className="py-12 text-center text-xs text-slate-500 font-semibold uppercase tracking-wider">
                          Немає даних за цей період
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {currentDataset.map((item: any, idx: number) => {
                          const percentage = Math.round((item.count / maxCount) * 100);
                          return (
                            <div key={idx} className="flex items-center gap-4 text-xs">
                              {/* Label */}
                              <div className="w-28 text-slate-400 font-semibold truncate text-left shrink-0">
                                {item.label}
                              </div>
                              
                              {/* Bar */}
                              <div className="flex-1 bg-slate-900/60 border border-slate-850 h-8 rounded-xl overflow-hidden relative flex items-center px-3 group hover:border-slate-705 transition-all">
                                <div 
                                  className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-indigo-600/30 to-indigo-500/40 border-r-2 border-indigo-400/50 rounded-l-xl transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                                <span className="relative font-bold text-white z-10">{item.count} відвідувань</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
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

            {/* 6. EMAILS TAB */}
            {activeTab === "emails" && (
              <div className="space-y-6">
                
                {/* Gmail Connection Status Card */}
                <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-3xl space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                        <Mail className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Gmail OAuth 2.0 (Адміністратор)</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Підключіть системну пошту адміністратора для надсилання рахунків підписок та повідомлень про закінчення.
                        </p>
                      </div>
                    </div>

                    {loadingEmailStatus ? (
                      <div className="w-6 h-6 border-2 border-indigo-500/30 border-b-indigo-500 rounded-full animate-spin shrink-0" />
                    ) : isEmailConnected ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 flex items-center gap-1.5 shrink-0">
                        <Check className="w-3.5 h-3.5 text-emerald-455" />
                        Активно
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-750 flex items-center gap-1.5 shrink-0">
                        Не підключено
                      </span>
                    )}
                  </div>

                  <div className="border-t border-slate-800/60 pt-6">
                    {loadingEmailStatus ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
                      </div>
                    ) : isEmailConnected ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-950/20 border border-slate-850 rounded-2xl max-w-xl">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Підключена пошта</span>
                          <span className="text-base font-bold text-white mt-1 block">{connectedEmail}</span>
                          <span className="text-[11px] text-slate-500 mt-1 block">Всі автоматичні листи про оновлення підписок надсилатимуться з цієї адреси.</span>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={handleTestEmail}
                            disabled={isTestingEmail}
                            className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center gap-2"
                          >
                            {isTestingEmail ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-b-white rounded-full animate-spin" />
                                <span>Надсилання...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>Надіслати тестовий лист</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={handleDisconnectEmail}
                            className="px-4 py-2.5 bg-slate-950/60 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/50 text-slate-400 hover:text-rose-455 font-bold text-xs rounded-xl transition-all flex items-center gap-2"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Відключити Gmail</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                          Щоб UniTax міг автоматично відправляти інвойси, квитанції про сплату та попередження про завершення підписки, вам потрібно авторизувати поштову скриньку адміністратора через Google OAuth 2.0.
                        </p>
                        <button
                          onClick={handleConnectEmail}
                          className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-600/10 transition-all flex items-center gap-2"
                        >
                          <Mail className="w-4 h-4" />
                          <span>Підключити пошту Gmail</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Logs Table Card */}
                <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-3xl space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-bold text-white">Журнал відправлених повідомлень</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Логи останніх системних повідомлень, надісланих користувачам.</p>
                    </div>
                    <button
                      onClick={fetchEmails}
                      disabled={loadingEmails}
                      className="px-3.5 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingEmails ? "animate-spin" : ""}`} />
                      Оновити
                    </button>
                  </div>

                  <div className="border border-slate-855 rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-4 font-bold">ID</th>
                          <th className="p-4 font-bold">Одержувач (Recipient)</th>
                          <th className="p-4 font-bold">Тема листа (Subject)</th>
                          <th className="p-4 font-bold">Статус</th>
                          <th className="p-4 font-bold">Дата відправки</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {emails.map((e: any) => (
                          <tr key={e.id} className="hover:bg-slate-900/20 transition-all">
                            <td className="p-4 font-mono text-slate-500">#{e.id}</td>
                            <td className="p-4 font-semibold text-white">{e.recipient}</td>
                            <td className="p-4 text-slate-300 font-semibold">{e.subject}</td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${
                                  e.status === "success"
                                    ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/25"
                                    : "bg-rose-500/10 text-rose-455 border-rose-500/25"
                                }`}>
                                  {e.status === "success" ? "Успішно" : "Помилка"}
                                </span>
                                {e.error_message && (
                                  <span className="text-[9px] text-rose-400 font-medium max-w-[200px] truncate" title={e.error_message}>
                                    {e.error_message}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-slate-400 font-semibold">{e.sent_at || "—"}</td>
                          </tr>
                        ))}
                        {emails.length === 0 && !loadingEmails && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500 font-semibold italic">
                              Логи надісланих повідомлень відсутні.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
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
                {selectedProfileForSub.tax_system === "non_profit" || selectedProfileForSub.organization_subtype === "osbb" || selectedProfileForSub.organization_subtype === "st" ? (
                  <select
                    value={editPlanType}
                    onChange={(e) => setEditPlanType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="free">Безкоштовно (Free)</option>
                    <option value="basic">Базовий (Basic) — 499 грн/міс</option>
                    <option value="premium">Преміум (Premium) — 999 грн/міс</option>
                  </select>
                ) : (
                  <select
                    value={editPlanType}
                    onChange={(e) => setEditPlanType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="free">Free (Безкоштовно)</option>
                    <option value="business">Business (Платний)</option>
                  </select>
                )}
              </div>

              {(editPlanType === "business" || editPlanType === "basic" || editPlanType === "premium") && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Період оплати</label>
                  <select
                    value={editPaymentPeriod}
                    onChange={(e) => setEditPaymentPeriod(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="monthly">Щомісячно (30 днів)</option>
                    <option value="half_yearly">Піврічно (6 місяців)</option>
                    <option value="yearly">Щорічно (365 днів)</option>
                  </select>
                </div>
              )}

              {(selectedProfileForSub.tax_system === "non_profit" || selectedProfileForSub.organization_subtype === "osbb" || selectedProfileForSub.organization_subtype === "st") && (
                <div className="flex items-center gap-2.5 py-1 select-none">
                  <input
                    type="checkbox"
                    id="editIsMemberModuleActive"
                    checked={editIsMemberModuleActive}
                    onChange={(e) => setEditIsMemberModuleActive(e.target.checked)}
                    className="w-4 h-4 rounded border border-slate-800 accent-indigo-650 bg-slate-950 transition-all cursor-pointer focus:ring-0"
                  />
                  <label htmlFor="editIsMemberModuleActive" className="text-xs font-bold text-slate-200 cursor-pointer">
                    📱 Активований кабінет мешканців (+500 грн/міс)
                  </label>
                </div>
              )}

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
