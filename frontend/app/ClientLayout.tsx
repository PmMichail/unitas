"use client";

import React, { useState, useEffect } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { ThemeProvider } from "@/components/theme-provider";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { LiqPayFooter } from "@/components/LiqPayFooter";
import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  FileSpreadsheet,
  Settings as SettingsIcon,
  Menu,
  X,
  Sun,
  Moon,
  Plus,
  ChevronsUpDown,
  Check,
  FileText,
  Mail,
  Calendar,
  LogOut,
  CreditCard,
  Shield,
  AlertCircle,
  Cpu,
  Bot,
  Inbox,
  Lock,
  Crown,
  HelpCircle,
  Sparkles,
  Send
} from "lucide-react";

function SubscriptionLockedView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div className="w-full max-w-lg p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/55 dark:bg-slate-900/30 backdrop-blur-xl shadow-2xl relative overflow-hidden space-y-6">
        <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-amber-500/5 blur-[100px] pointer-events-none" />
        
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/5 animate-bounce">
          <Crown className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black bg-gradient-to-r from-slate-900 via-slate-700 to-amber-500 dark:from-white dark:via-slate-200 dark:to-amber-400 bg-clip-text text-transparent tracking-tight">
            Функція недоступна у тарифі Free
          </h2>
          <p className="text-xs text-slate-550 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Робота з календарем, транзакціями, податковими розрахунками, звітами та КЕП доступна тільки в рамках тарифу <span className="font-extrabold text-amber-500">Business</span>.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/15 text-left text-xs space-y-3">
          <span className="text-[10px] text-slate-550 dark:text-slate-500 font-bold uppercase tracking-wider block">З підпискою Business ви отримаєте:</span>
          <ul className="space-y-2 text-slate-650 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Повний податковий календар та розрахунки боргів</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Створення, перевірка та авто-подача звітів через ДПС API</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Автоматична синхронізація з банками та необмежений імпорт</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Розрахунок зарплат, податків за найманих працівників</span>
            </li>
          </ul>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row gap-3">
          <Link
            href="/settings/subscription"
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/10"
          >
            <CreditCard className="w-4 h-4" /> Оновити тариф
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          >
            <LayoutDashboard className="w-4 h-4" /> На дашборд
          </Link>
        </div>
      </div>
    </div>
  );
}

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const {
    profiles,
    selectedProfile,
    setSelectedProfile,
    loadingProfiles,
    loadingSubscription,
    telegramId,
    setTelegramId,
    subscription,
  } = useApp();

  const pathname = usePathname();
  const router = useRouter();
  
  const isFree = subscription !== null && subscription.plan === "free";
  const isAllowedPathForFree = (path: string) => {
    const allowed = [
      "/dashboard",
      "/profiles",
      "/settings",
      "/settings/subscription",
      "/benefits",
    ];
    return allowed.includes(path) || path.startsWith("/statements/") || path.startsWith("http");
  };
  const showLockScreen = isFree && !isAllowedPathForFree(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");

  // Polling for blocked status
  useEffect(() => {
    if (!selectedProfile?.is_blocked || !telegramId) return;
    
    const interval = setInterval(async () => {
      try {
        const updatedProfiles = await api.getProfiles(telegramId);
        const current = updatedProfiles.find((p: any) => p.id === selectedProfile.id);
        if (current && !current.is_blocked) {
          window.location.reload();
        }
      } catch (e) {
        console.error("Error polling block status:", e);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [selectedProfile, telegramId]);

  const handleCheckUnblock = async () => {
    if (!telegramId || !selectedProfile) return;
    try {
      const updatedProfiles = await api.getProfiles(telegramId);
      const current = updatedProfiles.find((p: any) => p.id === selectedProfile.id);
      if (current && !current.is_blocked) {
        alert("Ваш профіль успішно розблоковано!");
        window.location.reload();
      } else {
        alert("Профіль все ще заблоковано. Якщо ви здійснили оплату, зачекайте кілька хвилин або зверніться в чат підтримки.");
      }
    } catch (e) {
      alert("Помилка під час перевірки статусу.");
    }
  };

  // Track visits once per session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasVisited = sessionStorage.getItem("unitas_visited_session");
      if (!hasVisited) {
        api.postVisit().catch((err) => console.error("Error logging visit:", err));
        sessionStorage.setItem("unitas_visited_session", "true");
      }
    }
  }, []);

  // Redirect to profiles if logged in but has no profiles to prevent infinite loading spinners
  useEffect(() => {
    const isExempt = ["/", "/login", "/register", "/privacy", "/terms", "/refund", "/benefits"].includes(pathname) || pathname.startsWith("/admin");
    if (!loadingProfiles && profiles.length === 0 && !isExempt && pathname !== "/profiles") {
      router.push("/profiles");
    }
  }, [loadingProfiles, profiles, pathname, router]);


  // Sync theme with next-themes/document element
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setThemeState(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setThemeState(nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  };

  const navItems = [
    { name: "Дашборд", href: "/dashboard", icon: LayoutDashboard },
    ...(selectedProfile?.tax_system === "non_profit"
      ? [
          {
            name: "Білінг та Мешканці",
            href: "/billing",
            icon: FileSpreadsheet,
          },
        ]
      : []),
    { name: "Календар", href: "/calendar", icon: Calendar },
    { name: "Профілі", href: "/profiles", icon: Building2 },
    { name: "Транзакції", href: "/transactions", icon: Receipt },
    { name: "Податки", href: "/taxes", icon: CreditCard },
    { name: "Податковий борг", href: "/tax-debt", icon: AlertCircle },
    { name: "Статус звітів", href: "/reports-status", icon: FileText },
    ...((selectedProfile?.type === "company" || selectedProfile?.has_employees)
      ? [
          {
            name: "Працівники",
            href: `/profiles/${selectedProfile.id}/employees`,
            icon: Users,
          },
        ]
      : []),
    { name: "Відправити контрагенту", href: "/invoices", icon: FileText },
    { name: "Вхідні документи", href: "/incoming", icon: Inbox },
    { name: "Пошта", href: "/settings/email", icon: Mail },
    { name: "КЕП (Підписи)", href: "/settings/certificates", icon: Shield },
    { name: "API ДПС", href: "/settings/tax-api", icon: Cpu },
    { name: "Тариф та оплата", href: "/settings/subscription", icon: Crown },
    { name: "Налаштування", href: "/settings", icon: SettingsIcon },
  ];

  const isNoLayout = ["/", "/login", "/register", "/privacy", "/terms", "/refund", "/benefits"].includes(pathname) || pathname.startsWith("/admin") || pathname.startsWith("/osbb");
  if (isNoLayout) {
    return (
      <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16] text-[#090e1a] dark:text-[#f1f5f9] font-sans">
        {children}
      </div>
    );
  }

  const isBlocked = selectedProfile?.is_blocked === true;
  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafbfd] dark:bg-[#090d16] p-4 text-[#090e1a] dark:text-[#f1f5f9] font-sans transition-colors duration-300">
        <div className="w-full max-w-lg p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center space-y-6">
          <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-rose-500/5 blur-[100px] pointer-events-none" />
          
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-500/5 animate-pulse">
            <Shield className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black bg-gradient-to-r from-slate-900 via-slate-700 to-rose-600 dark:from-white dark:via-slate-200 dark:to-rose-450 bg-clip-text text-transparent tracking-tight">
              Кабінет тимчасово заблоковано
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-405">
              Доступ до підприємства <span className="font-bold text-indigo-550 dark:text-indigo-400">{selectedProfile.name}</span> тимчасово обмежено адміністратором.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/15 text-left text-xs space-y-1.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Причина блокування:</span>
            <p className="font-semibold text-rose-600 dark:text-rose-400 leading-relaxed">
              {selectedProfile.block_reason || "Порушення правил користування сервісом або несплата послуг."}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row gap-3">
            {profiles.length > 1 && (
              <div className="flex-1 relative">
                <select
                  value={selectedProfile?.id || ""}
                  onChange={(e) => {
                    const found = profiles.find((p) => String(p.id) === e.target.value);
                    if (found) {
                      setSelectedProfile(found);
                      router.push("/dashboard");
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold focus:outline-none focus:border-indigo-550 transition-all text-left"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.is_blocked ? " (Заблоковано)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <button
              onClick={handleCheckUnblock}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              Перевірити статус
            </button>

            <button
              onClick={() => setTelegramId("")}
              className="flex-1 py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Вийти з акаунта
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fafbfd] dark:bg-[#090d16] text-[#090e1a] dark:text-[#f1f5f9] font-sans transition-colors duration-300">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/30 backdrop-blur-md z-20">
        {/* Logo */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800/60">
          <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <span className="font-extrabold text-white text-lg">U</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-indigo-300 bg-clip-text text-transparent">
                UniTax
              </h1>
              <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider">
                Податковий Асистент
              </p>
            </div>
          </Link>
        </div>

        {/* Profile Switcher */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/60 relative">
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 text-left text-sm font-semibold hover:border-indigo-500/30 transition-all"
          >
            <div className="truncate pr-2">
              <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                Активний Профіль
              </div>
              <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                {selectedProfile ? selectedProfile.name : "Немає профілів"}
              </div>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {profileDropdownOpen && (
            <div className="absolute left-4 right-4 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 p-1.5 space-y-1">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProfile(p);
                    setProfileDropdownOpen(false);
                    router.push("/dashboard");
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-semibold transition-all ${
                    selectedProfile?.id === p.id
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <span className="truncate pr-1">{p.name}</span>
                  {selectedProfile?.id === p.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
              <div className="border-t border-slate-100 dark:border-slate-850 my-1.5" />
              <Link
                href="/profiles"
                onClick={() => setProfileDropdownOpen(false)}
                className="w-full flex items-center justify-center p-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Додати профіль
              </Link>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const isLocked = isFree && !isAllowedPathForFree(item.href);
            const isExternal = item.href.startsWith("http");
            
            const linkProps = isExternal
              ? { href: item.href, target: "_blank", rel: "noopener noreferrer" }
              : { href: item.href };
            
            const Tag: any = isExternal ? "a" : Link;

            return (
              <Tag
                key={item.name}
                {...linkProps}
                className={`flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon
                  className={`w-4 h-4 mr-3 transition-colors ${
                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                  }`}
                />
                <span className="flex-1">{item.name}</span>
                {isLocked && <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-550 shrink-0 ml-2" />}
              </Tag>
            );
          })}
        </nav>

        {/* Footer info & theme toggle */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/60 space-y-2.5">
          {telegramId && (
            <div className="px-2 py-1.5 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-805 rounded-xl text-[10px] text-slate-400 dark:text-slate-500 truncate">
              Telegram ID: <span className="font-bold text-slate-600 dark:text-slate-400">{telegramId}</span>
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold transition-all gap-2"
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-3.5 h-3.5" /> Світла тема
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" /> Темна тема
              </>
            )}
          </button>
          {telegramId && (
            <button
              onClick={() => setTelegramId("")}
              className="w-full flex items-center justify-center py-2 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 text-xs font-bold transition-all gap-2"
            >
              <LogOut className="w-3.5 h-3.5" /> Вийти з акаунта
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Top Navbar */}
      <div className="flex md:hidden flex-col w-full min-h-screen relative">
        <header className="flex justify-between items-center px-4 py-3 bg-white/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800/60 backdrop-blur-md z-30">
          <Link href="/dashboard" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-lg flex items-center justify-center shadow-md">
              <span className="font-bold text-white text-base">U</span>
            </div>
            <h1 className="text-base font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-indigo-300 bg-clip-text text-transparent">
              UniTax
            </h1>
          </Link>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-405"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-405"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Mobile Dropdown menu */}
        {mobileMenuOpen && (
          <div className="absolute top-14 left-0 right-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-4 shadow-xl z-20 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
            {/* Active profile picker */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                Активний Профіль
              </label>
              <select
                value={selectedProfile?.id || ""}
                onChange={(e) => {
                  const found = profiles.find((p) => String(p.id) === e.target.value);
                  if (found) {
                    setSelectedProfile(found);
                    setMobileMenuOpen(false);
                    router.push("/dashboard");
                  }
                }}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-905 text-xs font-semibold"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="" disabled>
                  {profiles.length === 0 ? "Немає профілів" : "Оберіть профіль"}
                </option>
              </select>
            </div>

            {/* Nav list */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                const isLocked = isFree && !isAllowedPathForFree(item.href);
                const isExternal = item.href.startsWith("http");
                
                const linkProps = isExternal
                  ? { href: item.href, target: "_blank", rel: "noopener noreferrer" }
                  : { href: item.href };
                
                const Tag: any = isExternal ? "a" : Link;

                return (
                  <Tag
                    key={item.name}
                    {...linkProps}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/40"
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-3" />
                    <span className="flex-1">{item.name}</span>
                    {isLocked && <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-550 shrink-0 ml-2" />}
                  </Tag>
                );
              })}
              {telegramId && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setTelegramId("");
                  }}
                  className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-500/10 transition-all text-left gap-3"
                >
                  <LogOut className="w-4 h-4" />
                  Вийти з акаунта
                </button>
              )}
            </nav>
          </div>
        )}

        {/* Page Content for Mobile */}
        <main className="flex-1 overflow-y-auto px-4 py-6 z-10 flex flex-col justify-between">
          <div className="flex-1">
            {loadingProfiles || loadingSubscription ? (
              <div className="flex h-full items-center justify-center bg-[#fafbfd] dark:bg-[#090d16] py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                </div>
              </div>
            ) : showLockScreen ? (
              <SubscriptionLockedView />
            ) : (
              children
            )}
          </div>
          <LiqPayFooter />
        </main>
      </div>

      {/* Page Content for Desktop */}
      <main className="hidden md:flex flex-col justify-between flex-1 overflow-y-auto h-screen z-10 relative custom-scrollbar">
        <div className="p-8 max-w-7xl w-full mx-auto flex-1">
          {loadingProfiles || loadingSubscription ? (
            <div className="flex h-full items-center justify-center bg-[#fafbfd] dark:bg-[#090d16] py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <p className="mt-4 text-xs font-semibold text-slate-400">Завантаження кабінету UniTax...</p>
              </div>
            </div>
          ) : showLockScreen ? (
            <SubscriptionLockedView />
          ) : (
            children
          )}
        </div>
        <LiqPayFooter />
      </main>

      <SupportChatWidget />
    </div>
  );
}

function SupportChatWidget() {
  const { selectedProfile } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!selectedProfile) return;
    
    fetchMessages();
    
    const interval = setInterval(() => {
      fetchMessages(true);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [selectedProfile]);

  useEffect(() => {
    if (isOpen) {
      const container = document.getElementById("support-chat-messages-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, isOpen]);

  const fetchMessages = async (isPoll = false) => {
    if (!selectedProfile) return;
    try {
      const msgs = await api.getSupportMessages(selectedProfile.id);
      
      if (isPoll && msgs.length > messages.length) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.is_from_admin && !isOpen) {
          setUnreadCount(prev => prev + 1);
        }
      }
      
      setMessages(msgs);
    } catch (e) {
      console.error("Failed to load chat messages:", e);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedProfile) return;
    
    const textToSend = inputText.trim();
    setInputText("");
    setLoading(true);
    
    try {
      const tempMsg = {
        id: Date.now(),
        profile_id: selectedProfile.id,
        is_from_admin: false,
        text: textToSend,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempMsg]);
      
      await api.postSupportMessage(selectedProfile.id, textToSend);
      await fetchMessages();
    } catch (err) {
      console.error("Failed to send support message:", err);
      alert("Не вдалося надіслати повідомлення");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedProfile) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setUnreadCount(0);
          }}
          className="relative w-14 h-14 bg-gradient-to-tr from-indigo-650 to-indigo-500 hover:from-indigo-550 hover:to-indigo-450 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all duration-300 group border border-indigo-400/20"
        >
          <Mail className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950 animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className="w-80 sm:w-96 h-[450px] bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 bg-slate-950/80 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
                <Bot className="w-4.5 h-4.5 text-indigo-400" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-white font-sans">Чат з адміністратором</h4>
                <p className="text-[9px] text-emerald-450 font-semibold flex items-center gap-1 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-555 animate-pulse" />
                  Адміністратор в мережі
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-450 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div 
            id="support-chat-messages-container"
            className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-slate-900/10 flex flex-col"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 my-auto">
                <HelpCircle className="w-8 h-8 text-slate-755 mb-2" />
                <p className="text-xs font-bold text-slate-400 font-sans">Почати діалог</p>
                <p className="text-[10px] text-slate-500 max-w-[180px] mt-1 leading-relaxed font-sans">
                  Напишіть нам ваше питання. Адміністратор відповість вам найближчим часом.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isAgent = m.is_from_admin;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[85%] ${isAgent ? "self-start" : "self-end ml-auto"}`}
                  >
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed font-sans ${
                        isAgent
                          ? "bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-none"
                          : "bg-indigo-650 text-white rounded-tr-none shadow-md"
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className={`text-[8px] text-slate-500 mt-1 font-mono ${isAgent ? "text-left" : "text-right"}`}>
                      {new Date(m.created_at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 bg-slate-950/80 border-t border-slate-800/60 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Напишіть повідомлення..."
              className="flex-1 px-3.5 py-2 bg-slate-900/60 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-550 text-xs text-slate-250 placeholder-slate-500 font-sans"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 font-sans"
            >
              Надіслати
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AppProvider>
        <MainLayoutContent>{children}</MainLayoutContent>
      </AppProvider>
    </ThemeProvider>
  );
}
