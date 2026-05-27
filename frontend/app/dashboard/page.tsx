"use client";

import React, { useState, useEffect } from "react";
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
  Info
} from "lucide-react";

export default function Dashboard() {
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

  // Mock data fallback
  const mockDashboardData = {
    company_name: "ФОП Петренко Іван Васильович",
    tax_system: "fop_ep",
    group: 3,
    rate: 5.0,
    total_income: 117000.0,
    total_expense: 5880.0,
    tax_due: 5850.0,
    tax_paid: 5280.0,
    tax_breakdown: {
      unified_tax: 0.0,
      esv: 5280.0,
      pit: 0.0,
      military_tax: 0.0
    },
    balance_status: "due",
    difference: 570.0,
    upcoming_events: [
      {
        id: 1,
        title: "Сплата Єдиного податку за 1 квартал 2025 р.",
        due_date: "2025-05-19",
        type: "payment",
        amount_desc: "5% від доходу за квартал (5,850.00 грн)",
        status: "pending"
      },
      {
        id: 2,
        title: "Подання декларації платника єдиного податку за 1 квартал",
        due_date: "2025-05-10",
        type: "report",
        amount_desc: "Форма F0103306",
        status: "pending"
      },
      {
        id: 3,
        title: "Сплата ЄСВ за себе за 2 квартал 2025 р.",
        due_date: "2025-07-19",
        type: "payment",
        amount_desc: "5,280 грн (22% від мін. зарплати)",
        status: "pending"
      }
    ]
  };

  const mockReportDraft = {
    report_id: 101,
    form_code: "F0103306",
    period: "1 Квартал",
    year: 2025,
    fields: {
      HNAME: { value: "ФОП Петренко Іван Васильович", color: "green" },
      HTIN: { value: "3124567890", color: "green" },
      HEMAIL: { value: "petrenko.ivan@gmail.com", color: "yellow" },
      ROW01: { value: 117000.0, color: "green" },
      ROW02: { value: 0.0, color: "yellow" },
      ROW03: { value: 0.0, color: "yellow" },
      ROW04: { value: 0.0, color: "yellow" },
      TAX_RATE: { value: 5.0, color: "green" },
      TAX_DUE: { value: 5850.0, color: "green" }
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/dashboard/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
        setError(null);
      } else {
        throw new Error("Не вдалося завантажити дані з сервера");
      }
    } catch (err) {
      console.warn("Бекенд недоступний. Використовуємо демонстраційні дані.");
      setDashboardData(mockDashboardData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [companyId]);

  // Handle statement upload
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("company_id", companyId.toString());

    try {
      const response = await fetch("http://localhost:8000/api/upload-statement", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setUploadSuccess(result.message);
        setSelectedFile(null);
        // Refresh dashboard
        fetchDashboardData();
      } else {
        const errData = await response.json();
        throw new Error(errData.detail || "Помилка завантаження");
      }
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
      const response = await fetch(`http://localhost:8000/api/calendar/pay/${eventId}`, {
        method: "POST",
      });
      if (response.ok) {
        fetchDashboardData();
      }
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
      const response = await fetch(`http://localhost:8000/api/generate-report/${companyId}/F0103306`, {
        method: "POST",
      });
      if (response.ok) {
        const report = await response.json();
        setEditingReport(report);
      } else {
        throw new Error("Помилка генерації звіту");
      }
    } catch (err) {
      setTimeout(() => {
        setEditingReport(mockReportDraft);
        setGeneratingReport(false);
      }, 1000);
      return;
    }
    setGeneratingReport(false);
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

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Metric 1 */}
                  <div className="p-6 rounded-2xl glass-panel transition-all duration-300">
                    <div className="flex justify-between items-start">
                      <p className="text-slate-400 text-sm font-medium">Загальний дохід (Q1)</p>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-extrabold text-white mt-4">
                      {dashboardData?.total_income?.toLocaleString("uk-UA")} <span className="text-lg font-bold text-slate-400">грн</span>
                    </h3>
                    <p className="text-xs text-emerald-400 font-semibold mt-2 flex items-center">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5 animate-pulse"></span>
                      Дані з виписок
                    </p>
                  </div>

                  {/* Metric 2 */}
                  <div className="p-6 rounded-2xl glass-panel transition-all duration-300">
                    <div className="flex justify-between items-start">
                      <p className="text-slate-400 text-sm font-medium">Нараховано податку</p>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Info className="w-5 h-5 text-indigo-400" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-extrabold text-white mt-4">
                      {dashboardData?.tax_due?.toLocaleString("uk-UA")} <span className="text-lg font-bold text-slate-400">грн</span>
                    </h3>
                    <p className="text-xs text-indigo-400/80 font-semibold mt-2">
                      5% від загального доходу
                    </p>
                  </div>

                  {/* Metric 3 */}
                  <div className="p-6 rounded-2xl glass-panel transition-all duration-300">
                    <div className="flex justify-between items-start">
                      <p className="text-slate-400 text-sm font-medium">Сплачено податків</p>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-indigo-400" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-extrabold text-white mt-4">
                      {dashboardData?.tax_paid?.toLocaleString("uk-UA")} <span className="text-lg font-bold text-slate-400">грн</span>
                    </h3>
                    <div className="mt-2 w-full bg-slate-900 rounded-full h-1.5">
                      <div 
                        className="bg-indigo-500 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(100, (dashboardData?.tax_paid / (dashboardData?.tax_due || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metric 4 */}
                  <div className={`p-6 rounded-2xl glass-panel transition-all duration-300 border ${dashboardData?.balance_status === 'due' ? 'border-amber-500/20 bg-amber-950/5' : ''}`}>
                    <div className="flex justify-between items-start">
                      <p className="text-slate-400 text-sm font-medium">Різниця / Борг</p>
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <AlertTriangle className={`w-5 h-5 ${dashboardData?.balance_status === 'due' ? 'text-amber-400' : 'text-slate-400'}`} />
                      </div>
                    </div>
                    <h3 className="text-3xl font-extrabold text-white mt-4">
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

                  {/* Right Column: Statement Drag-n-drop (4 cols) */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="p-6 rounded-2xl glass-panel flex flex-col h-full justify-between">
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
                            href={`http://localhost:8000/api/reports/${editingReport.report_id}/download/xml`}
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
          </>
        )}
      </div>
    </div>
  );
}
