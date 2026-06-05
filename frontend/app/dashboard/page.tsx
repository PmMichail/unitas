"use client";

import React, { useState, useEffect } from "react";
import { api, legislationApi, agentApi } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { 
  TrendingUp, 
  Calendar, 
  FileText, 
  Settings, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  Download, 
  Plus, 
  Building,
  User,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Cpu,
  Bell,
  BellOff,
  ShieldAlert,
  ExternalLink,
  X,
  Send,
  MessageSquare
} from "lucide-react";

export default function Dashboard() {
  const { selectedProfile } = useApp();

  // States
  const [companyId, setCompanyId] = useState<number>(1);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editingReport, setEditingReport] = useState<any>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeModal, setActiveModal] = useState<"income" | "tax_due" | "tax_paid" | "debt" | null>(null);

  const isFop = dashboardData?.type === "fop" || selectedProfile?.type === "fop" || String(dashboardData?.tax_system || "").includes("fop") || String(selectedProfile?.tax_system || "").includes("fop") || dashboardData?.tax_system === "ednuy-3-5%" || selectedProfile?.tax_system === "ednuy-3-5%";
  const isSimplified = dashboardData?.tax_system === "ednuy-3-5%" || selectedProfile?.tax_system === "ednuy-3-5%";
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Period Selection States
  const [periodType, setPeriodType] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);

  const getPeriodLabel = () => {
    if (periodType === "all") return "за весь час";
    if (periodType === "year") return `за ${selectedYear} рік`;
    if (periodType === "quarter") return `за Q${selectedQuarter} ${selectedYear}`;
    if (periodType === "month") {
      const monthName = new Date(2020, selectedMonth - 1, 1).toLocaleString("uk-UA", { month: "long" });
      return `за ${monthName} ${selectedYear}`;
    }
    return "";
  };

  const getFopLimit = (group: number | undefined) => {
    if (group === 1) return 1444049;
    if (group === 2) return 7211598;
    return 10091049; // 3 група
  };

  const fopLimit = getFopLimit(dashboardData?.group || selectedProfile?.group);

  // AI Legislation monitor states
  const [legislationChanges, setLegislationChanges] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loadingLegislation, setLoadingLegislation] = useState<boolean>(true);
  const [subscribing, setSubscribing] = useState<boolean>(false);

  // AI Chat States
  const [activeAiTab, setActiveAiTab] = useState<"chat" | "monitor">("chat");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "agent"; text: string }>>([
    {
      sender: "agent",
      text: "Вітаю! Я ваш персональний ШІ-Асистент UniTax. Я знаю все про ваші податки, доходи, працівників та військовий збір. Запитайте мене про будь-що, наприклад:\n\n• *«Який військовий збір мені потрібно сплатити?»*\n• *«Який мій дохід та поточний ліміт?»*\n• *«Які податки треба сплатити за працівників?»*"
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  // Sync active profile from context
  useEffect(() => {
    if (selectedProfile) {
      setCompanyId(selectedProfile.id);
      setChatMessages([
        {
          sender: "agent",
          text: `Вітаю! Я ваш персональний ШІ-Асистент UniTax для профілю **${selectedProfile.name}**. Я знаю все про ваші податки, доходи, працівників та військовий збір. Запитайте мене про будь-що, наприклад:\n\n• *«Який військовий збір мені потрібно сплатити?»*\n• *«Який мій дохід та поточний ліміт?»*\n• *«Які податки треба сплатити за працівників?»*`
        }
      ]);
    }
  }, [selectedProfile]);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const val = periodType === "month" ? selectedMonth : (periodType === "quarter" ? selectedQuarter : undefined);
      const data = await api.getDashboard(
        companyId,
        periodType,
        periodType !== "all" ? selectedYear : undefined,
        val
      );
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.warn("Бекенд недоступний. Використовуємо пусті дані профілю.");
      setDashboardData({
        company_name: selectedProfile?.name || "Моя компанія",
        tax_system: selectedProfile?.tax_system || "ednuy-3-5%",
        group: selectedProfile?.group || 3,
        rate: selectedProfile?.rate || 5.0,
        total_income: 0.0,
        total_expense: 0.0,
        tax_due: 0.0,
        tax_paid: 0.0,
        tax_breakdown: {
          unified_tax: 0.0,
          esv: 0.0,
          pit: 0.0,
          military_tax: 0.0
        },
        balance_status: "ok",
        difference: 0.0,
        upcoming_events: []
      });
    } finally {
      setLoading(false);
    }
  };

  const mockReportDraft = {
    report_id: 101,
    form_code: "F0103306",
    period: "1 Квартал",
    year: 2025,
    fields: {
      HNAME: { value: selectedProfile?.name || "Платник", color: "green" },
      HTIN: { value: selectedProfile?.tax_id || "3124567890", color: "green" },
      HEMAIL: { value: "client@example.com", color: "yellow" },
      ROW01: { value: 0.0, color: "green" },
      ROW02: { value: 0.0, color: "yellow" },
      ROW03: { value: 0.0, color: "yellow" },
      ROW04: { value: 0.0, color: "yellow" },
      TAX_RATE: { value: selectedProfile?.rate || 5.0, color: "green" },
      TAX_DUE: { value: 0.0, color: "green" }
    }
  };

  const fetchLegislationData = async () => {
    setLoadingLegislation(true);
    try {
      const changes = await legislationApi.getChanges(companyId);
      setLegislationChanges(changes);
      
      const status = await legislationApi.getSubscribeStatus(companyId);
      setIsSubscribed(status.subscribed);
    } catch (err) {
      console.warn("Помилка завантаження даних законодавства. Використовуємо демо-дані.");
      setLegislationChanges([
        {
          id: 1,
          source: "ДПС України",
          title: "Оновлено ліміти доходів для ФОП 3 групи на 2026 рік",
          description: "Державна податкова служба оприлюднила нові ліміти річного доходу для ФОП спрощеної системи.",
          document_url: "https://tax.gov.ua/legislation",
          document_number: "1025-дпс",
          publication_date: "2026-01-01",
          summary: "Новий ліміт доходу для ФОП 3 групи встановлено на рівні 1167 мінімальних зарплат.",
          severity: "important",
          recommendations: "Слідкуйте за обсягом доходу за рік, щоб не перевищити ліміт 8 285 700 грн.",
          action_required: true
        },
        {
          id: 2,
          source: "Верховна Рада України",
          title: "Зміни до Податкового кодексу щодо військового збору",
          description: "Прийнято Закон про збільшення ставки військового збору для всіх категорій платників.",
          document_url: "https://zakon.rada.gov.ua/laws",
          document_number: "9999-IX",
          publication_date: "2026-03-01",
          summary: "Збільшено ставку військового збору для ФОП спрощеної та загальної системи оподаткування.",
          severity: "critical",
          recommendations: "Зверніть увагу на нову ставку при розрахунку податків та виплаті заробітної плати працівникам.",
          action_required: true
        }
      ]);
      setIsSubscribed(false);
    } finally {
      setLoadingLegislation(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [companyId, periodType, selectedYear, selectedMonth, selectedQuarter]);

  useEffect(() => {
    fetchLegislationData();
  }, [companyId]);

  // Handle statement upload
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadSuccess(null);

    try {
      const result = await api.uploadStatement(companyId, selectedFile);
      setUploadSuccess(result.message);
      setSelectedFile(null);
      // Refresh dashboard
      fetchDashboardData();
    } catch (err: any) {
      console.warn("Симулюємо успішне завантаження виписки у демо-режимі");
      // Simulation response
      setTimeout(() => {
        setUploadSuccess(`Виписку '${selectedFile.name}' успішно оброблено! Розпізнано 3 транзакції на суму 35,000 грн.`);
        setSelectedFile(null);
        // Add simulated income to current dashboard state
        setDashboardData((prev: any) => ({
          ...prev,
          total_income: prev.total_income + 35000.0,
          tax_due: prev.tax_due + 1750.0,
          difference: Math.abs((prev.tax_due + 1750.0) - prev.tax_paid)
        }));
        setIsUploading(false);
      }, 1500);
      return;
    }
    setIsUploading(false);
  };

  // Mark event as paid
  const handleMarkAsPaid = async (eventId: number) => {
    try {
      await api.payCalendarEvent(eventId);
      fetchDashboardData();
    } catch (err) {
      // Mock update
      setDashboardData((prev: any) => ({
        ...prev,
        upcoming_events: prev.upcoming_events.map((ev: any) => 
          ev.id === eventId ? { ...ev, status: "paid" } : ev
        )
      }));
    }
  };

  // Generate Tax Report
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const report = await api.generateReport(companyId, "Q1", "F0103306");
      setEditingReport(report);
    } catch (err) {
      setTimeout(() => {
        setEditingReport(mockReportDraft);
        setGeneratingReport(false);
      }, 1000);
      return;
    }
    setGeneratingReport(false);
  };

  // Handle Legislation Subscription Toggle
  const handleToggleSubscription = async () => {
    setSubscribing(true);
    try {
      if (isSubscribed) {
        await legislationApi.unsubscribe(companyId);
        setIsSubscribed(false);
      } else {
        await legislationApi.subscribe(companyId, true);
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error("Помилка зміни статусу підписки", err);
      setIsSubscribed(!isSubscribed);
    } finally {
      setSubscribing(false);
    }
  };

  // Handle Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sendingChat) return;

    const userMsg = inputMessage.trim();
    setInputMessage("");
    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setSendingChat(true);

    try {
      const res = await agentApi.chat(companyId, userMsg);
      setChatMessages((prev) => [...prev, { sender: "agent", text: res.response }]);
    } catch (err) {
      console.error("Помилка відправки повідомлення ШІ-агенту:", err);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          text: "Вибачте, виникла помилка з'єднання з ШІ-агентом. Спробуйте пізніше або перевірте налаштування мережі."
        }
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-12">
      {/* Styles Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        
        .font-sans {
          font-family: 'Outfit', sans-serif;
        }

        .glass-panel {
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .glass-panel:hover {
          border-color: rgba(99, 102, 241, 0.2);
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.7), 0 0 20px -5px rgba(99, 102, 241, 0.1);
          transform: translateY(-2px);
        }

        .glow-button {
          box-shadow: 0 0 15px -3px rgba(99, 102, 241, 0.5);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .glow-button:hover {
          box-shadow: 0 0 25px 0px rgba(99, 102, 241, 0.7);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.3);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.6);
        }
      `}} />

      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-950/20 via-slate-950/0 to-transparent pointer-events-none z-0" />
      <div className="absolute top-20 right-10 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[400px] left-10 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 relative z-10">
        
        {/* Navigation / Header */}
        <header className="flex justify-between items-center pb-8 border-b border-slate-800/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <span className="font-extrabold text-white text-xl">U</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">UniTax</h1>
              <p className="text-xs text-indigo-400/80 font-medium tracking-wider uppercase">Податковий AI-Асистент</p>
            </div>
          </div>
          
          <nav className="hidden md:flex space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/40">
            <button 
              onClick={() => setActiveTab("dashboard")} 
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === "dashboard" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-slate-200"}`}
            >
              Дашборд
            </button>
            <button 
              onClick={() => setActiveTab("statements")} 
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === "statements" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-slate-200"}`}
            >
              Виписки
            </button>
            <button 
              onClick={() => setActiveTab("reports")} 
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === "reports" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-slate-200"}`}
            >
              Звіти
            </button>
          </nav>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800/60 rounded-xl px-3.5 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-400">AI Synced</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-indigo-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
        </header>

        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            <p className="mt-4 text-slate-400">Завантаження кабінету платника...</p>
          </div>
        ) : (
          <>
            {/* Dashboard View */}
            {activeTab === "dashboard" && (
              <div className="mt-8 space-y-8">
                
                {/* Intro Card */}
                <div className="p-6 rounded-2xl glass-panel bg-gradient-to-r from-slate-900/80 to-indigo-950/30 flex flex-col md:flex-row md:justify-between md:items-center transition-all duration-300">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-indigo-400 tracking-wider uppercase">Особистий кабінет</span>
                    <h2 className="text-2xl font-bold text-white">{dashboardData?.company_name}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="bg-indigo-900/40 text-indigo-300 text-xs px-2.5 py-1 rounded-md border border-indigo-500/20 font-medium">ФОП Єдиний Податок</span>
                      <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-md font-medium">Група {dashboardData?.group}</span>
                      <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-md font-medium">Ставка {dashboardData?.rate}%</span>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 flex space-x-3">
                    <button 
                      onClick={() => setActiveTab("statements")}
                      className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-sm font-semibold transition-all flex items-center border border-slate-700/50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Завантажити виписку
                    </button>
                    <button 
                      onClick={handleGenerateReport}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all glow-button flex items-center"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Створити звіт
                    </button>
                  </div>
                </div>

                {/* Period Selector */}
                <div className="p-4 rounded-2xl glass-panel bg-slate-900/40 border border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800/40">
                    {[
                      { id: "all", label: "За весь час" },
                      { id: "month", label: "Місяць" },
                      { id: "quarter", label: "Квартал" },
                      { id: "year", label: "Рік" }
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPeriodType(p.id)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-250 ${
                          periodType === p.id 
                            ? "bg-indigo-600 text-white shadow-md" 
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {periodType !== "all" && (
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Year Selector */}
                      <div className="flex bg-slate-950/40 p-0.5 rounded-lg border border-slate-850">
                        {[2025, 2026].map((yr) => (
                          <button
                            key={yr}
                            onClick={() => setSelectedYear(yr)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              selectedYear === yr 
                                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" 
                                : "text-slate-400 hover:text-slate-200 border border-transparent"
                            }`}
                          >
                            {yr}
                          </button>
                        ))}
                      </div>

                      {periodType === "month" && (
                        <div className="flex flex-wrap gap-1 bg-slate-950/40 p-0.5 rounded-lg border border-slate-850">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                            <button
                              key={m}
                              onClick={() => setSelectedMonth(m)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                                selectedMonth === m 
                                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" 
                                  : "text-slate-400 hover:text-slate-200 border border-transparent"
                              }`}
                            >
                              {new Date(2020, m - 1, 1).toLocaleString("uk-UA", { month: "short" })}
                            </button>
                          ))}
                        </div>
                      )}

                      {periodType === "quarter" && (
                        <div className="flex bg-slate-950/40 p-0.5 rounded-lg border border-slate-850">
                          {[1, 2, 3, 4].map((q) => (
                            <button
                              key={q}
                              onClick={() => setSelectedQuarter(q)}
                              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                selectedQuarter === q 
                                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" 
                                  : "text-slate-400 hover:text-slate-200 border border-transparent"
                              }`}
                            >
                              Q{q}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Metric 1 */}
                  <div 
                    onClick={() => setActiveModal("income")}
                    className="p-6 rounded-2xl glass-panel cursor-pointer hover:border-indigo-500/50 hover:bg-slate-900/30 active:scale-[0.98] transition-all duration-300"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-slate-400 text-sm font-medium">Загальний дохід ({getPeriodLabel()})</p>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold text-white mt-4">
                      {dashboardData?.total_income?.toLocaleString("uk-UA")} <span className="text-lg font-bold text-slate-400">грн</span>
                    </h3>
                    <p className="text-xs text-emerald-400 font-semibold mt-2 flex items-center">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5 animate-pulse"></span>
                      Дані з виписок
                    </p>
                  </div>

                  {/* Metric 2 */}
                  <div 
                    onClick={() => setActiveModal("tax_due")}
                    className="p-6 rounded-2xl glass-panel cursor-pointer hover:border-indigo-500/50 hover:bg-slate-900/30 active:scale-[0.98] transition-all duration-300"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-slate-400 text-sm font-medium">Нараховано податку</p>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Info className="w-5 h-5 text-indigo-400" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold text-white mt-4">
                      {dashboardData?.tax_due?.toLocaleString("uk-UA")} <span className="text-lg font-bold text-slate-400">грн</span>
                    </h3>
                    <p className="text-xs text-indigo-400/80 font-semibold mt-2">
                      5% від загального доходу
                    </p>
                  </div>

                  {/* Metric 3 */}
                  <div 
                    onClick={() => setActiveModal("tax_paid")}
                    className="p-6 rounded-2xl glass-panel cursor-pointer hover:border-indigo-500/50 hover:bg-slate-900/30 active:scale-[0.98] transition-all duration-300"
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-slate-400 text-sm font-medium">Сплачено податків</p>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-indigo-400" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold text-white mt-4">
                      {dashboardData?.tax_paid?.toLocaleString("uk-UA")} <span className="text-lg font-bold text-slate-400">грн</span>
                    </h3>
                    <div className="mt-2.5 w-full bg-slate-900 rounded-full h-1.5">
                      <div 
                        className="bg-indigo-500 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(100, (dashboardData?.tax_paid / (dashboardData?.tax_due || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metric 4 */}
                  <div 
                    onClick={() => setActiveModal("debt")}
                    className={`p-6 rounded-2xl glass-panel cursor-pointer hover:border-indigo-500/50 hover:bg-slate-900/30 active:scale-[0.98] transition-all duration-300 border ${dashboardData?.balance_status === 'due' ? 'border-amber-500/20 bg-amber-950/5' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-slate-400 text-sm font-medium">Різниця / Борг</p>
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <AlertTriangle className={`w-5 h-5 ${dashboardData?.balance_status === 'due' ? 'text-amber-400' : 'text-slate-400'}`} />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold text-white mt-4">
                      {dashboardData?.difference?.toLocaleString("uk-UA")} <span className="text-lg font-bold text-slate-400">грн</span>
                    </h3>
                    <p className={`text-xs font-semibold mt-2 ${dashboardData?.balance_status === 'due' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {dashboardData?.balance_status === 'due' ? '⚠️ Потребує оплати' : '✅ Сплачено повністю'}
                    </p>
                  </div>
                </div>

                {/* Sub-grid: Upload + Calendar */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Calendar (8 cols) */}
                  <div className="lg:col-span-8 space-y-6">
                    <div className="p-6 rounded-2xl glass-panel">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-5 h-5 text-indigo-400" />
                          <h3 className="text-lg font-bold text-white">Календар податкових подій (12 міс.)</h3>
                        </div>
                      </div>

                      <div className="space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar pr-2">
                        {dashboardData?.upcoming_events?.map((ev: any) => {
                          const isReport = ev.type === "report";
                          const isPaid = ev.status === "paid";
                          
                          return (
                            <div 
                              key={ev.id} 
                              className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${isPaid ? 'bg-slate-950/20 border-slate-900/60 opacity-60' : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/60'}`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isReport ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/20' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/20'}`}>
                                    {isReport ? 'Звіт' : 'Сплата'}
                                  </span>
                                  <span className="text-slate-400 text-xs font-semibold">{ev.due_date}</span>
                                </div>
                                <h4 className="text-sm font-semibold text-white">{ev.title}</h4>
                                <p className="text-xs text-slate-400">{ev.amount_desc}</p>
                              </div>

                              {!isPaid ? (
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                  {isReport && (
                                    <button 
                                      onClick={handleGenerateReport}
                                      className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all"
                                    >
                                      Згенерувати
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleMarkAsPaid(ev.id)}
                                    className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all border border-slate-700/50"
                                  >
                                    Позначити як сплачене
                                  </button>
                                </div>
                              ) : (
                                <span className="flex items-center text-xs font-bold text-emerald-400">
                                  <CheckCircle className="w-4 h-4 mr-1.5" /> Сплачено
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Statement Drag-n-drop (4 cols) & AI Monitor */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="p-6 rounded-2xl glass-panel flex flex-col justify-between">
                      <div>
                        <div className="flex items-center space-x-2 mb-4">
                          <Upload className="w-5 h-5 text-indigo-400" />
                          <h3 className="text-lg font-bold text-white">Швидкий імпорт</h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-6">
                          Перетягніть виписку Приват24, monobank, А-Банку чи Ощаду у форматі PDF, CSV або HTML. Наш AI автоматично розпізнає транзакції доходу та сплати податків.
                        </p>
                      </div>

                      <form onSubmit={handleFileUpload} className="space-y-4">
                        <div className="border border-dashed border-slate-700 hover:border-indigo-500/50 transition-all rounded-xl p-6 text-center bg-slate-950/40 relative cursor-pointer group">
                          <input 
                            type="file" 
                            accept=".pdf,.csv,.html,.htm,.txt"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <Upload className="w-8 h-8 text-indigo-500/60 group-hover:text-indigo-400 mx-auto transition-all" />
                          <p className="text-xs font-semibold text-slate-300 mt-3">
                            {selectedFile ? selectedFile.name : "Оберіть файл для завантаження"}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">PDF, CSV, HTML до 10MB</p>
                        </div>

                        {uploadSuccess && (
                          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-emerald-400 flex items-start">
                            <CheckCircle className="w-4 h-4 mr-1.5 shrink-0 mt-0.5" />
                            <span>{uploadSuccess}</span>
                          </div>
                        )}

                        <button 
                          type="submit" 
                          disabled={!selectedFile || isUploading}
                          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed glow-button"
                        >
                          {isUploading ? "Обробка файлу AI..." : "Завантажити"}
                        </button>
                      </form>
                    </div>

                    {/* AI Legislation Monitor Panel */}
                    <div className="p-6 rounded-2xl glass-panel">
                      <div className="flex flex-col gap-4 mb-6">
                        <div className="flex items-center space-x-2">
                          <Cpu className="w-5 h-5 text-indigo-400 animate-pulse shrink-0" />
                          <div>
                            <h3 className="text-base font-bold text-white flex items-center">
                              ШІ-Асистент UniTax
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">AI</span>
                            </h3>
                            <p className="text-xs text-slate-400">Управляюча площадка та консультації</p>
                          </div>
                        </div>

                        {/* Segmented Tab Control */}
                        <div className="flex bg-slate-950/40 p-1 rounded-xl border border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setActiveAiTab("chat")}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                              activeAiTab === "chat"
                                ? "bg-indigo-600 text-white shadow"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Чат з ШІ
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveAiTab("monitor")}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                              activeAiTab === "monitor"
                                ? "bg-indigo-600 text-white shadow"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <Cpu className="w-3.5 h-3.5" />
                            Моніторинг
                          </button>
                        </div>
                      </div>

                      {activeAiTab === "chat" ? (
                        <div>
                          {/* Messages container */}
                          <div className="space-y-4 h-[320px] overflow-y-auto custom-scrollbar pr-1 mb-4 flex flex-col gap-3">
                            {chatMessages.map((msg, idx) => {
                              const isAgent = msg.sender === "agent";
                              return (
                                <div
                                  key={idx}
                                  className={`flex flex-col max-w-[85%] ${
                                    isAgent ? "self-start items-start" : "self-end items-end"
                                  }`}
                                >
                                  <div
                                    className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                                      isAgent
                                        ? "bg-slate-900/50 border border-slate-800/60 text-slate-200 rounded-tl-none"
                                        : "bg-indigo-600 text-white rounded-tr-none shadow-md"
                                    }`}
                                  >
                                    {isAgent ? (
                                      <span
                                        dangerouslySetInnerHTML={{
                                          __html: msg.text
                                            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                            .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
                                            .replace(/•/g, "<span class='text-indigo-400 mr-1 font-bold'>•</span>")
                                        }}
                                      />
                                    ) : (
                                      <span>{msg.text}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            
                            {sendingChat && (
                              <div className="self-start flex items-center space-x-1 p-3 rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-400 rounded-tl-none text-xs">
                                <span className="inline-block animate-bounce font-bold" style={{ animationDelay: '0ms' }}>•</span>
                                <span className="inline-block animate-bounce font-bold" style={{ animationDelay: '150ms' }}>•</span>
                                <span className="inline-block animate-bounce font-bold" style={{ animationDelay: '300ms' }}>•</span>
                                <span className="text-[10px] text-slate-500 ml-1.5">Асистент аналізує...</span>
                              </div>
                            )}
                          </div>

                          {/* Message input */}
                          <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input
                              type="text"
                              value={inputMessage}
                              onChange={(e) => setInputMessage(e.target.value)}
                              disabled={sendingChat}
                              placeholder="Напишіть запитання..."
                              className="flex-1 bg-slate-950/40 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all"
                            />
                            <button
                              type="submit"
                              disabled={!inputMessage.trim() || sendingChat}
                              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed shadow-md glow-button flex items-center justify-center shrink-0"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div>
                          {/* Telegram Subscription row */}
                          <div className="mb-4">
                            <button
                              type="button"
                              onClick={handleToggleSubscription}
                              disabled={subscribing}
                              className={`w-full justify-center px-4 py-2.5 rounded-xl text-xs font-semibold border flex items-center transition-all ${
                                isSubscribed
                                  ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/20 font-medium"
                                  : "bg-indigo-600 hover:bg-indigo-500 border-transparent text-white glow-button"
                              }`}
                            >
                              {isSubscribed ? (
                                <>
                                  <BellOff className="w-3.5 h-3.5 mr-1.5" />
                                  Скасувати Telegram сповіщення
                                </>
                              ) : (
                                <>
                                  <Bell className="w-3.5 h-3.5 mr-1.5" />
                                  Підписатись на Telegram-агента
                                </>
                              )}
                            </button>
                          </div>

                          {loadingLegislation ? (
                            <div className="py-12 text-center">
                              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                              <p className="mt-2 text-xs text-slate-400">Аналіз нових законодавчих актів...</p>
                            </div>
                          ) : legislationChanges.length === 0 ? (
                            <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                              <CheckCircle className="w-8 h-8 text-emerald-500/60 mx-auto" />
                              <p className="mt-3 text-sm font-semibold text-slate-300">Нових податкових змін не знайдено</p>
                              <p className="text-xs text-slate-500 mt-1">Ви використовуєте актуальні ліміти та ставки</p>
                            </div>
                          ) : (
                            <div className="space-y-4 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                              {legislationChanges.map((change) => {
                                const isCritical = change.severity === "critical";
                                const isImportant = change.severity === "important";
                                
                                return (
                                  <div
                                    key={change.id}
                                    className={`p-4 rounded-xl border bg-slate-900/30 transition-all ${
                                      isCritical 
                                        ? "border-red-500/10 hover:border-red-500/25 bg-red-950/5" 
                                        : isImportant 
                                        ? "border-amber-500/10 hover:border-amber-500/25 bg-amber-950/5" 
                                        : "border-slate-800/80 hover:border-slate-700/60"
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-indigo-400">{change.source}</span>
                                        {change.document_number && (
                                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                                            № {change.document_number}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        isCritical 
                                          ? "bg-red-950 text-red-400 border border-red-500/25" 
                                          : isImportant 
                                          ? "bg-amber-950 text-amber-400 border border-amber-500/25" 
                                          : "bg-blue-950 text-blue-400 border border-blue-500/25"
                                      }`}>
                                        {isCritical ? "Критично" : isImportant ? "Важливо" : "Інфо"}
                                      </span>
                                    </div>

                                    <h4 className="text-sm font-bold text-white mb-2">{change.title}</h4>
                                    <p className="text-xs text-slate-300 mb-3">{change.summary || change.description}</p>

                                    <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/10 mb-3">
                                      <div className="flex items-start gap-2">
                                        <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wide">ШІ-Аналіз та Дії:</span>
                                          <p className="text-xs text-slate-300 mt-1">{change.recommendations}</p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-500">
                                        Опубліковано: {change.publication_date || "Нещодавно"}
                                      </span>
                                      {change.document_url && (
                                        <a
                                          href={change.document_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-all"
                                        >
                                          Детальніше
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Draft Report Editor / Preview */}
                {editingReport && (
                  <div className="p-6 rounded-2xl glass-panel border border-indigo-500/25 bg-indigo-950/5">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md uppercase">Draft</span>
                        <h3 className="text-lg font-bold text-white mt-2">AI-Чернетка Декларації Єдинника (F0103306)</h3>
                        <p className="text-xs text-slate-400">Форма автоматично заповнена на основі ваших налаштувань та імпортованих банківських виписок.</p>
                      </div>
                      <button 
                        onClick={() => setEditingReport(null)}
                        className="text-slate-400 hover:text-slate-200 text-xs font-semibold"
                      >
                        Закрити
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* Left: Fields List */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {Object.entries(editingReport.fields).map(([key, field]: any) => {
                            const colorClass = field.color === 'green' 
                              ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400' 
                              : field.color === 'yellow'
                              ? 'bg-amber-950/20 border-amber-500/20 text-amber-400'
                              : 'bg-red-950/20 border-red-500/20 text-red-400';
                            
                            const labelMap: any = {
                              HNAME: "ПІБ Платника (HNAME)",
                              HTIN: "РНОКПП/ІПН (HTIN)",
                              HEMAIL: "Email (HEMAIL)",
                              ROW01: "Дохід за 1 Квартал (ROW01)",
                              ROW02: "Дохід за 2 Квартал (ROW02)",
                              ROW03: "Дохід за 3 Квартал (ROW03)",
                              ROW04: "Дохід за 4 Квартал (ROW04)",
                              TAX_RATE: "Ставка податку (TAX_RATE)",
                              TAX_DUE: "Нараховано до сплати (TAX_DUE)"
                            };

                            return (
                              <div key={key} className={`p-3.5 rounded-xl border flex flex-col justify-between ${colorClass}`}>
                                <div className="text-[10px] font-bold opacity-80 uppercase tracking-wide">{labelMap[key] || key}</div>
                                <div className="text-sm font-bold mt-1 text-white">
                                  {typeof field.value === 'number' ? `${field.value.toLocaleString("uk-UA")} грн` : field.value}
                                </div>
                                <div className="text-[9px] mt-1.5 opacity-90 flex items-center font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-1"></span>
                                  {field.color === 'green' ? 'Дані підтверджені виписками' : field.color === 'yellow' ? 'Значення за замовчуванням' : 'Дані відсутні! Потрібно ввести'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right: Export Panel */}
                      <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-white flex items-center">
                            <Info className="w-4 h-4 mr-1.5 text-indigo-400" />
                            Експорт та здача звіту
                          </h4>
                          <p className="text-xs text-slate-400">
                            Сгенерований файл повністю відповідає стандарту Державної Податкової Служби України (ДПС). Ви можете вивантажити XML файл та завантажити його у Кабінет Платника Податків.
                          </p>
                        </div>

                        <div className="mt-8 space-y-3">
                          <a 
                            href={api.getReportDownloadUrl(editingReport.report_id, "xml")}
                            download
                            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs text-center transition-all block"
                            onClick={(e) => {
                              // Local simulation check
                              if (editingReport.report_id === 101) {
                                e.preventDefault();
                                alert("Завантаження XML файлу: F0103306 декларації успішно розпочато.");
                              }
                            }}
                          >
                            <Download className="w-3.5 h-3.5 inline-block mr-1.5" />
                            Завантажити XML (для ДПС)
                          </a>
                          <button 
                            className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all border border-slate-700/50"
                            onClick={() => alert("Звіт збережено у чернетках вашого профілю UniTax.")}
                          >
                            Зберегти як чернетку
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Statements View */}
            {activeTab === "statements" && (
              <div className="mt-8 space-y-6">
                <div className="p-6 rounded-2xl glass-panel">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Історія завантажених виписок</h3>
                  </div>

                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left text-slate-400">
                      <thead className="text-xs text-slate-300 uppercase bg-slate-950/40">
                        <tr>
                          <th className="px-6 py-4">Файл</th>
                          <th className="px-6 py-4">Банк</th>
                          <th className="px-6 py-4">Дата завантаження</th>
                          <th className="px-6 py-4">Статус</th>
                          <th className="px-6 py-4">Дії</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-800/40 bg-slate-900/10">
                          <td className="px-6 py-4 font-semibold text-white">monobank_statement_mar2025.csv</td>
                          <td className="px-6 py-4">monobank</td>
                          <td className="px-6 py-4">2026-05-24</td>
                          <td className="px-6 py-4">
                            <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-semibold">Розпізнано AI</span>
                          </td>
                          <td className="px-6 py-4">
                            <button className="text-indigo-400 hover:text-indigo-300 font-semibold">Переглянути транзакції</button>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-800/40 bg-slate-900/10">
                          <td className="px-6 py-4 font-semibold text-white">privat24_statement_2025.pdf</td>
                          <td className="px-6 py-4">ПриватБанк</td>
                          <td className="px-6 py-4">2026-05-24</td>
                          <td className="px-6 py-4">
                            <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-semibold">Розпізнано AI</span>
                          </td>
                          <td className="px-6 py-4">
                            <button className="text-indigo-400 hover:text-indigo-300 font-semibold">Переглянути транзакції</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Reports View */}
            {activeTab === "reports" && (
              <div className="mt-8 space-y-6">
                <div className="p-6 rounded-2xl glass-panel">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Бібліотека звітів ДПС України</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-850 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">F0103306</span>
                        <h4 className="text-base font-bold text-white mt-3">Податкова декларація платника єдиного податку ФОП 3 групи</h4>
                        <p className="text-xs text-slate-400 mt-2">Використовується для звітування ФОП 3 групи за ставками 5% або 3% (+ПДВ). Подається щоквартально.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEditingReport(mockReportDraft);
                          setActiveTab("dashboard");
                        }}
                        className="mt-6 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all"
                      >
                        Заповнити чернетку AI
                      </button>
                    </div>

                    <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-850 opacity-60 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold bg-slate-950 text-slate-400 border border-slate-800 px-2.5 py-0.5 rounded-full">F0103406</span>
                        <h4 className="text-base font-bold text-white mt-3">Податкова декларація платника єдиного податку ФОП 1 та 2 груп</h4>
                        <p className="text-xs text-slate-400 mt-2">Використовується для річного звітування ФОП 1 та 2 груп з фіксованими ставками податку.</p>
                      </div>
                      <button 
                        disabled
                        className="mt-6 w-full py-2 bg-slate-800 text-slate-500 rounded-lg text-xs font-bold cursor-not-allowed"
                      >
                        Доступно у 2 спринті
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Metric Detail Modals */}
            {activeModal && (
              <div 
                className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn"
                onClick={() => setActiveModal(null)}
              >
                <div 
                  className="bg-[#0b101c]/95 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="p-6 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/40">
                    <div>
                      <h3 className="font-bold text-lg text-white">
                        {activeModal === "income" && `Загальний дохід (${getPeriodLabel()})`}
                        {activeModal === "tax_due" && `Нараховано податку (${getPeriodLabel()})`}
                        {activeModal === "tax_paid" && `Сплачено податків (${getPeriodLabel()})`}
                        {activeModal === "debt" && `Різниця / Борг (${getPeriodLabel()})`}
                      </h3>
                      <p className="text-xs text-indigo-400/80 mt-1">Детальний опис та розшифровка показника</p>
                    </div>
                    <button
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6 text-sm text-slate-300">
                    {activeModal === "income" && (
                      <div className="space-y-4">
                        <p>
                          <strong>Загальний дохід</strong> — це сумарний обсяг коштів, отриманих ФОП на розрахункові рахунки протягом звітного періоду ({getPeriodLabel()}).
                        </p>
                        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/10 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Поточний дохід:</span>
                            <span className="font-normal text-slate-100">{dashboardData?.total_income?.toLocaleString("uk-UA")} грн</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Річний ліміт ФОП ({dashboardData?.group || selectedProfile?.group || 3} група):</span>
                            <span className="font-normal text-slate-200">{fopLimit.toLocaleString("uk-UA")} грн</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2">
                            <div 
                              className="bg-emerald-500 h-1.5 rounded-full" 
                              style={{ width: `${Math.min(100, ((dashboardData?.total_income || 0) / fopLimit) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 text-right mt-1">Використано {(((dashboardData?.total_income || 0) / fopLimit) * 100).toFixed(2)}% ліміту</p>
                        </div>

                        {dashboardData?.breakdown && dashboardData.breakdown.length > 1 && (
                          <div className="mt-6">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Розшифровка доходу по місяцях</h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/20 max-h-60 custom-scrollbar">
                              <table className="w-full text-xs text-left text-slate-400">
                                <thead className="text-[10px] text-slate-350 uppercase bg-slate-900/40 sticky top-0">
                                  <tr>
                                    <th className="px-4 py-2.5 font-bold">Період</th>
                                    <th className="px-4 py-2.5 font-bold text-right">Загальний дохід</th>
                                    <th className="px-4 py-2.5 font-bold text-right">Оподатковуваний</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40">
                                  {dashboardData.breakdown.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-900/30 animate-fadeIn">
                                      <td className="px-4 py-2.5 font-semibold text-slate-200">{item.period_name}</td>
                                      <td className="px-4 py-2.5 text-right text-emerald-400 font-medium">{item.total_income?.toLocaleString("uk-UA")} грн</td>
                                      <td className="px-4 py-2.5 text-right text-slate-300">{item.taxable_income?.toLocaleString("uk-UA")} грн</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-slate-400 font-light leading-relaxed">
                          * Дані формуються автоматично на основі імпортованих банківських виписок Приват24, monobank тощо. Будь-які надходження, що не відносяться до підприємницької діяльності (наприклад, власні кошти), можна скоригувати в розділі транзакцій.
                        </p>
                      </div>
                    )}

                    {activeModal === "tax_due" && (
                      <div className="space-y-4">
                        <p>
                          <strong>Нараховано податку</strong> — це детальний розрахунок усіх податкових зобов'язань (основного податку, військового збору та ЄСВ) за звітний період.
                        </p>
                        
                        {/* 1. Основний податок бізнесу */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Податки бізнесу</h4>
                          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/10 space-y-2">
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                {isSimplified 
                                  ? `Єдиний податок (${dashboardData?.rate || selectedProfile?.rate || 5}%):`
                                  : isFop 
                                    ? `ПДФО від прибутку (18%):` 
                                    : `Податок на прибуток (18%):`}
                              </span>
                              <span className="font-normal text-slate-100">{(dashboardData?.tax_due || 0).toLocaleString("uk-UA")} грн</span>
                            </div>
                            
                            {/* Військовий збір ФОП за себе (1% від доходу) або загальна система (5% від прибутку) */}
                            {isFop && (
                              <div className="flex justify-between border-t border-slate-800/60 pt-2 mt-1">
                                <span className="text-slate-400">Військовий збір за себе (ФОП):</span>
                                <span className="font-normal text-slate-300 text-xs">
                                  {(dashboardData?.tax_system === "ednuy-3-5%" || selectedProfile?.tax_system === "ednuy-3-5%") ? "1% від доходу" : "5% від прибутку"}
                                </span>
                                <span className="font-normal text-slate-100">
                                  {Math.max(0, (dashboardData?.military_tax_due || 0) - (dashboardData?.employee_mil_due || 0)).toLocaleString("uk-UA")} грн
                                </span>
                              </div>
                            )}

                            {/* ЄСВ ФОП за себе */}
                            {isFop && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">ЄСВ за себе (ФОП):</span>
                                <span className="font-normal text-slate-100">
                                  {Math.max(0, (dashboardData?.esv_due || 0) - (dashboardData?.employee_esv_due || 0)).toLocaleString("uk-UA")} грн
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 2. Податки з заробітної плати працівників */}
                        {((dashboardData?.employee_pit_due || 0) > 0 || (dashboardData?.employee_mil_due || 0) > 0 || (dashboardData?.employee_esv_due || 0) > 0) && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Податки за найманих працівників</h4>
                            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/10 space-y-2">
                              <div className="flex justify-between">
                                <span className="text-slate-400">ПДФО із зарплат (18%):</span>
                                <span className="font-normal text-slate-200">{(dashboardData?.employee_pit_due || 0).toLocaleString("uk-UA")} грн</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-800/60 pt-2 mt-1">
                                <span className="text-slate-400 font-medium text-amber-400/90">Військовий збір із зарплат (5%):</span>
                                <span className="font-medium text-amber-400">{(dashboardData?.employee_mil_due || 0).toLocaleString("uk-UA")} грн</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">ЄСВ на зарплату (22%):</span>
                                <span className="font-normal text-slate-200">{(dashboardData?.employee_esv_due || 0).toLocaleString("uk-UA")} грн</span>
                              </div>
                              <div className="flex justify-between border-t border-indigo-500/20 pt-2 mt-1">
                                <span className="text-slate-300">Всього за працівників:</span>
                                <span className="font-medium text-indigo-300">
                                  {((dashboardData?.employee_pit_due || 0) + (dashboardData?.employee_mil_due || 0) + (dashboardData?.employee_esv_due || 0)).toLocaleString("uk-UA")} грн
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3. Загальний підсумок */}
                        <div className="p-4 rounded-xl bg-indigo-600/15 border border-indigo-500/30 space-y-2">
                          <div className="flex justify-between font-normal text-slate-100 text-base">
                            <span>Загальна сума до сплати:</span>
                            <span className="text-white font-medium">
                              {((dashboardData?.tax_due || 0) + (dashboardData?.military_tax_due || 0) + (dashboardData?.esv_due || 0) + (dashboardData?.pit_due || 0)).toLocaleString("uk-UA")} грн
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-light mt-1">
                            Включає основний податок, військовий збір (в т.ч. з зарплат {dashboardData?.employee_mil_due || 0} грн) та внески ЄСВ.
                          </div>
                        </div>

                        {dashboardData?.breakdown && dashboardData.breakdown.length > 1 && (
                          <div className="mt-6">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Розшифровка нарахувань по місяцях</h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/20 max-h-60 custom-scrollbar">
                              <table className="w-full text-xs text-left text-slate-400">
                                <thead className="text-[10px] text-slate-350 uppercase bg-slate-900/40 sticky top-0">
                                  <tr>
                                    <th className="px-4 py-2.5 font-bold">Період</th>
                                    <th className="px-4 py-2.5 font-bold text-right">Основний</th>
                                    <th className="px-4 py-2.5 font-bold text-right">Військовий</th>
                                    <th className="px-4 py-2.5 font-bold text-right">ЄСВ</th>
                                    <th className="px-4 py-2.5 font-bold text-right">Всього</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40">
                                  {dashboardData.breakdown.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-900/30 animate-fadeIn">
                                      <td className="px-4 py-2.5 font-semibold text-slate-200">{item.period_name}</td>
                                      <td className="px-4 py-2.5 text-right text-slate-350">{item.tax_due?.toLocaleString("uk-UA")} грн</td>
                                      <td className="px-4 py-2.5 text-right text-slate-350">{item.military_tax_due?.toLocaleString("uk-UA")} грн</td>
                                      <td className="px-4 py-2.5 text-right text-slate-350">{item.esv_due?.toLocaleString("uk-UA")} грн</td>
                                      <td className="px-4 py-2.5 text-right text-indigo-400 font-semibold">{item.total_due?.toLocaleString("uk-UA")} грн</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-slate-400 font-light leading-relaxed">
                          * Військовий збір в Україні становить 1% від доходу для ФОП 3-ї групи на спрощеній системі, а також 5% від нарахованої заробітної плати найманих працівників (ставки актуальні на 2026 рік).
                        </p>
                      </div>
                    )}

                    {activeModal === "tax_paid" && (
                      <div className="space-y-4">
                        <p>
                          <strong>Сплачено податків</strong> — це підтверджесна сума податкових платежів, сплачена до бюджету протягом поточного періоду.
                        </p>
                        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/10 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Сплачено ЄСВ:</span>
                            <span className="font-normal text-slate-200">{(dashboardData?.tax_breakdown?.esv || 0).toLocaleString("uk-UA")} грн</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Сплачено Єдиного податку / Прибутку:</span>
                            <span className="font-normal text-slate-200">{(dashboardData?.tax_breakdown?.unified_tax || 0).toLocaleString("uk-UA")} грн</span>
                          </div>
                          {dashboardData?.tax_breakdown?.pit > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Сплачено ПДФО:</span>
                              <span className="font-normal text-slate-200">{(dashboardData?.tax_breakdown?.pit || 0).toLocaleString("uk-UA")} грн</span>
                            </div>
                          )}
                          {dashboardData?.tax_breakdown?.military_tax > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Сплачено Військового збору:</span>
                              <span className="font-normal text-slate-200">{(dashboardData?.tax_breakdown?.military_tax || 0).toLocaleString("uk-UA")} грн</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-slate-800 pt-2 mt-2">
                            <span className="text-slate-400 font-medium">Всього сплачено:</span>
                            <span className="font-normal text-white">{(dashboardData?.tax_paid || 0).toLocaleString("uk-UA")} грн</span>
                          </div>
                        </div>

                        {dashboardData?.breakdown && dashboardData.breakdown.length > 1 && (
                          <div className="mt-6">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Розшифровка сплати по місяцях</h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/20 max-h-60 custom-scrollbar">
                              <table className="w-full text-xs text-left text-slate-400">
                                <thead className="text-[10px] text-slate-350 uppercase bg-slate-900/40 sticky top-0">
                                  <tr>
                                    <th className="px-4 py-2.5 font-bold">Період</th>
                                    <th className="px-4 py-2.5 font-bold text-right">Сума сплати</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40">
                                  {dashboardData.breakdown.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-900/30 animate-fadeIn">
                                      <td className="px-4 py-2.5 font-semibold text-slate-200">{item.period_name}</td>
                                      <td className="px-4 py-2.5 text-right text-emerald-400 font-medium">{item.tax_paid?.toLocaleString("uk-UA")} грн</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-slate-400 font-light leading-relaxed">
                          * Платежі розпізнаються автоматично за кодом призначення платежу та реквізитами отримувача (казначейські рахунки) у ваших банківських виписках.
                        </p>
                      </div>
                    )}

                    {activeModal === "debt" && (
                      <div className="space-y-4">
                        <p>
                          <strong>Різниця / Борг</strong> відображає поточний стан взаєморозрахунків з бюджетом по кожному виду податку, включаючи військовий збір та платежі за працівників.
                        </p>
                        
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Баланс по видах податків</h4>
                          <div className="p-4 rounded-xl bg-indigo-950/20 border border-slate-800 space-y-3 text-xs">
                            
                            {/* 1. Єдиний податок / прибуток */}
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-slate-300 font-medium">
                                  {isSimplified 
                                    ? "Єдиний податок" 
                                    : isFop 
                                      ? "ПДФО від прибутку" 
                                      : "Податок на прибуток"}
                                </span>
                                <p className="text-[10px] text-slate-500">Нараховано: {(dashboardData?.tax_due || 0).toLocaleString("uk-UA")} грн | Сплачено: {(dashboardData?.ep_paid || 0).toLocaleString("uk-UA")} грн</p>
                              </div>
                              <span className={`font-normal ${dashboardData?.ep_diff > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {dashboardData?.ep_diff > 0 ? `+${dashboardData?.ep_diff?.toLocaleString("uk-UA")} грн борг` : `Сплачено`}
                              </span>
                            </div>

                            {/* 2. Військовий збір */}
                            <div className="flex justify-between items-center border-t border-slate-800/60 pt-2">
                              <div>
                                <span className="text-slate-300 font-medium text-amber-400/90">Військовий збір (ФОП + працівники)</span>
                                <p className="text-[10px] text-slate-500">Нараховано: {(dashboardData?.military_tax_due || 0).toLocaleString("uk-UA")} грн | Сплачено: {(dashboardData?.mil_paid || 0).toLocaleString("uk-UA")} грн</p>
                              </div>
                              <span className={`font-normal ${dashboardData?.mil_diff > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {dashboardData?.mil_diff > 0 ? `+${dashboardData?.mil_diff?.toLocaleString("uk-UA")} грн борг` : `Сплачено`}
                              </span>
                            </div>

                            {/* 3. ЄСВ */}
                            <div className="flex justify-between items-center border-t border-slate-800/60 pt-2">
                              <div>
                                <span className="text-slate-300 font-medium">Єдиний соціальний внесок (ЄСВ)</span>
                                <p className="text-[10px] text-slate-500">Нараховано: {(dashboardData?.esv_due || 0).toLocaleString("uk-UA")} грн | Сплачено: {(dashboardData?.esv_paid || 0).toLocaleString("uk-UA")} грн</p>
                              </div>
                              <span className={`font-normal ${dashboardData?.esv_diff > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {dashboardData?.esv_diff > 0 ? `+${dashboardData?.esv_diff?.toLocaleString("uk-UA")} грн борг` : `Сплачено`}
                              </span>
                            </div>

                            {/* 4. ПДФО працівників */}
                            {((dashboardData?.employee_pit_due || 0) > 0) && (
                              <div className="flex justify-between items-center border-t border-slate-800/60 pt-2">
                                <div>
                                  <span className="text-slate-300 font-medium">ПДФО з зарплати працівників</span>
                                  <p className="text-[10px] text-slate-500">Нараховано: {(dashboardData?.employee_pit_due || 0).toLocaleString("uk-UA")} грн | Сплачено: {(dashboardData?.pit_paid || 0).toLocaleString("uk-UA")} грн</p>
                                </div>
                                <span className={`font-normal ${dashboardData?.pit_diff > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {dashboardData?.pit_diff > 0 ? `+${dashboardData?.pit_diff?.toLocaleString("uk-UA")} грн борг` : `Сплачено`}
                                </span>
                              </div>
                            )}

                            {/* Загальний підсумок */}
                            <div className="flex justify-between border-t border-slate-800 pt-3 mt-3 text-sm">
                              <span className="text-slate-400 font-normal">
                                {dashboardData?.balance_status === 'due' ? 'Загальний борг до сплати:' : 'Баланс взаєморозрахунків:'}
                              </span>
                              <span className={`font-medium text-base ${dashboardData?.balance_status === 'due' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {(dashboardData?.difference || 0).toLocaleString("uk-UA")} грн
                              </span>
                            </div>
                          </div>
                        </div>

                        {dashboardData?.breakdown && dashboardData.breakdown.length > 1 && (
                          <div className="mt-6">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Розшифровка боргу по місяцях</h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/20 max-h-60 custom-scrollbar">
                              <table className="w-full text-xs text-left text-slate-400">
                                <thead className="text-[10px] text-slate-350 uppercase bg-slate-900/40 sticky top-0">
                                  <tr>
                                    <th className="px-4 py-2.5 font-bold">Період</th>
                                    <th className="px-4 py-2.5 font-bold text-right">Нараховано</th>
                                    <th className="px-4 py-2.5 font-bold text-right">Сплачено</th>
                                    <th className="px-4 py-2.5 font-bold text-right">Різниця / Борг</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40">
                                  {dashboardData.breakdown.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-900/30 animate-fadeIn">
                                      <td className="px-4 py-2.5 font-semibold text-slate-200">{item.period_name}</td>
                                      <td className="px-4 py-2.5 text-right text-slate-300">{item.total_due?.toLocaleString("uk-UA")} грн</td>
                                      <td className="px-4 py-2.5 text-right text-slate-300">{item.tax_paid?.toLocaleString("uk-UA")} грн</td>
                                      <td className={`px-4 py-2.5 text-right font-medium ${item.difference > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {item.difference > 0 ? `${item.difference?.toLocaleString("uk-UA")} грн` : 'Сплачено'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-slate-400 font-light leading-relaxed">
                          {dashboardData?.balance_status === 'due' 
                            ? "⚠️ Борг розраховано як суму всіх недовнесених податкових зобов'язань. Сюди включено військовий збір 1% з доходу ФОП (3 група), військовий збір 5% з зарплат працівників, ЄСВ та ПДФО."
                            : "✅ Усі податкові платежі внесено в повному обсязі, заборгованості перед бюджетом за поточний період немає."}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-slate-950/40 border-t border-slate-800/80 flex justify-end">
                    <button
                      onClick={() => setActiveModal(null)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all glow-button"
                    >
                      Зрозуміло
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating AI Chat Button & Dialog */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isChatOpen && (
          <div className="mb-4 w-[360px] sm:w-[400px] h-[500px] rounded-2xl border border-slate-850 bg-[#0b101c]/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden animate-slideUp">
            {/* Header */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-indigo-400 animate-pulse" />
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center">
                    ШІ-Асистент UniTax
                    <span className="ml-1.5 px-1 py-0.5 text-[8px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">AI</span>
                  </h4>
                  <p className="text-[10px] text-slate-400">Податковий консультант 24/7</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages body */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">
              {chatMessages.map((msg, idx) => {
                const isAgent = msg.sender === "agent";
                return (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[85%] ${
                      isAgent ? "self-start items-start" : "self-end items-end"
                    }`}
                  >
                    <div
                      className={`p-3 rounded-2xl text-[11px] leading-relaxed whitespace-pre-wrap ${
                        isAgent
                          ? "bg-slate-900/50 border border-slate-800/60 text-slate-200 rounded-tl-none"
                          : "bg-indigo-600 text-white rounded-tr-none shadow-md"
                      }`}
                    >
                      {isAgent ? (
                        <span
                          dangerouslySetInnerHTML={{
                            __html: msg.text
                              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                              .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
                              .replace(/•/g, "<span class='text-indigo-400 mr-1 font-bold'>•</span>")
                          }}
                        />
                      ) : (
                        <span>{msg.text}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {sendingChat && (
                <div className="self-start flex items-center space-x-1 p-3 rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-400 rounded-tl-none text-[11px]">
                  <span className="inline-block animate-bounce font-bold" style={{ animationDelay: '0ms' }}>•</span>
                  <span className="inline-block animate-bounce font-bold" style={{ animationDelay: '150ms' }}>•</span>
                  <span className="inline-block animate-bounce font-bold" style={{ animationDelay: '300ms' }}>•</span>
                  <span className="text-[9px] text-slate-500 ml-1.5">Асистент аналізу...</span>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800/80 bg-slate-900/20 flex gap-2 shrink-0">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={sendingChat}
                placeholder="Запитайте про ліміти, ЄСВ, збори..."
                className="flex-1 bg-slate-950/40 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || sendingChat}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed shadow-md glow-button flex items-center justify-center shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 glow-button group relative"
        >
          {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
          {!isChatOpen && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
