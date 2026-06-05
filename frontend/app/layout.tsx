"use client";

import React, { useState, useEffect } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { ThemeProvider } from "@/components/theme-provider";
import "@/app/globals.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  AlertCircle
} from "lucide-react";

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const {
    profiles,
    selectedProfile,
    setSelectedProfile,
    loadingProfiles,
    telegramId,
    setTelegramId,
  } = useApp();

  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");

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
    { name: "Календар", href: "/calendar", icon: Calendar },
    { name: "Профілі", href: "/profiles", icon: Building2 },
    { name: "Транзакції", href: "/transactions", icon: Receipt },
    { name: "Рахунки", href: "/invoices", icon: FileText },
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
    { name: "Звіти", href: "/reports", icon: FileSpreadsheet },
    { name: "Пошта", href: "/settings/email", icon: Mail },
    { name: "КЕП (Підписи)", href: "/settings/certificates", icon: Shield },
    { name: "Налаштування", href: "/settings", icon: SettingsIcon },
  ];

  if (pathname === "/login") {
    return (
      <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16] text-[#090e1a] dark:text-[#f1f5f9] font-sans">
        {children}
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
            return (
              <Link
                key={item.name}
                href={item.href}
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
                {item.name}
              </Link>
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
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400"
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
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
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
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/40"
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-3" />
                    {item.name}
                  </Link>
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
        <main className="flex-1 overflow-y-auto px-4 py-6 z-10">{children}</main>
      </div>

      {/* Page Content for Desktop */}
      <main className="hidden md:block flex-1 overflow-y-auto h-screen z-10 relative custom-scrollbar">
        {loadingProfiles ? (
          <div className="flex h-full items-center justify-center bg-[#fafbfd] dark:bg-[#090d16]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              <p className="mt-4 text-xs font-semibold text-slate-400">Завантаження кабінету UniTax...</p>
            </div>
          </div>
        ) : (
          <div className="p-8 max-w-7xl mx-auto">{children}</div>
        )}
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Always wrap in ThemeProvider & AppProvider
  return (
    <html lang="uk" className="dark">
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AppProvider>
            <MainLayoutContent>{children}</MainLayoutContent>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
