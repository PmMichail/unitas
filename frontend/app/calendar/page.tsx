"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Calendar as CalendarIcon,
  CheckCircle,
  AlertTriangle,
  Clock,
  Bell,
  Check,
  Filter,
  FileText,
  CreditCard,
  Settings,
  Mail,
  Send,
  TrendingUp,
  Activity,
  RefreshCw
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

export default function CalendarPage() {
  const { selectedProfile, dashboardTrigger, triggerDashboardReload } = useApp();
  const router = useRouter();

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<"all" | "payment" | "report">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");

  // Interaction
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // Reminders Modal
  const [selectedEventForReminder, setSelectedEventForReminder] = useState<any | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState(3);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const activeProfileId = selectedProfile?.id;

  const fetchEvents = async () => {
    if (!activeProfileId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCalendar(activeProfileId);
      setEvents(data || []);
    } catch (err) {
      console.error("Error loading calendar events:", err);
      setError("Не вдалося завантажити календарні події");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchEvents();
  }, [activeProfileId, dashboardTrigger]);

  const handleMarkPaid = async (eventId: number) => {
    try {
      await api.payCalendarEvent(eventId);
      triggerDashboardReload();
      // Show success toast
      setToastMessage("Статус події успішно оновлено!");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      alert("Не вдалося оновити статус події");
    }
  };

  const openReminderModal = (event: any) => {
    setSelectedEventForReminder(event);
    const saved = localStorage.getItem(`reminder_${event.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setEmailEnabled(parsed.email);
        setTelegramEnabled(parsed.telegram);
        setReminderDays(parsed.days);
      } catch (e) {}
    } else {
      setEmailEnabled(true);
      setTelegramEnabled(true);
      setReminderDays(3);
    }
  };

  const handleSaveReminder = () => {
    if (!selectedEventForReminder) return;
    
    localStorage.setItem(
      `reminder_${selectedEventForReminder.id}`,
      JSON.stringify({
        email: emailEnabled,
        telegram: telegramEnabled,
        days: reminderDays
      })
    );
    
    setSelectedEventForReminder(null);
    setToastMessage("Нагадування успішно налаштовано!");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleRegenerateCalendar = async () => {
    if (!activeProfileId) return;
    if (!window.confirm("Ви впевнені, що хочете перегенерувати податковий календар? Всі існуючі події будуть видалені та створені нові.")) {
      return;
    }
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev";
      const response = await axios.post(`${apiUrl}/api/tax-calendar/regenerate`, null, {
        params: { profile_id: activeProfileId }
      });
      setToastMessage(response.data.message);
      fetchEvents();
      triggerDashboardReload();
      setTimeout(() => setShowToast(false), 4000);
    } catch (err) {
      console.error("Failed to regenerate calendar:", err);
      setToastMessage("Помилка при перегенерації календаря");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleNodeClick = (eventId: number) => {
    setSelectedEventId(eventId);
    const element = document.getElementById(`event-card-${eventId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  if (!selectedProfile) {
    return (
      <div className="py-24 text-center max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Профіль не обрано</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Для перегляду податкового календаря, будь ласка, виберіть активний профіль.
        </p>
        <button
          onClick={() => router.push("/profiles")}
          className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-600/20"
        >
          Управління профілями
        </button>
      </div>
    );
  }

  // Filter events
  const filteredEvents = events.filter((ev) => {
    const matchType = typeFilter === "all" || ev.type === typeFilter;
    const matchStatus = statusFilter === "all" || ev.status === statusFilter;
    return matchType && matchStatus;
  });

  // Prepare chronological chart data
  const chartData = [...filteredEvents]
    .filter((ev) => ev && typeof ev.due_date === "string")
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .map((ev) => {
      const isReport = ev.type === "report";
      const isPaid = ev.status === "paid";
      const isOverdue = !isPaid && new Date(ev.due_date) < new Date();
      
      let amount = 1500; // default baseline for visuals
      if (!isReport && ev.amount_desc) {
        const match = ev.amount_desc.match(/([\d\s]+(?:[.,]\d+)?)\s*грн/);
        if (match) {
          amount = parseFloat(match[1].replace(/\s/g, "").replace(",", "."));
        } else {
          amount = 2000;
        }
      } else if (isReport) {
        amount = 1200; // slightly different height baseline for reports
      }

      const parts = ev.due_date.split("-");
      const formattedDate = parts.length > 1 ? parts.slice(1).join(".") : ev.due_date;

      return {
        id: ev.id,
        date: formattedDate, // Format MM.DD or similar safely
        fullName: ev.due_date,
        name: ev.title,
        amount: amount,
        type: ev.type,
        status: ev.status,
        isPaid,
        isOverdue,
        originalEvent: ev
      };
    });

  // Custom Dot component for timeline nodes
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    let fill = "#f59e0b"; // pending (amber)
    if (payload.isPaid) fill = "#10b981"; // paid (emerald)
    else if (payload.isOverdue) fill = "#ef4444"; // overdue (red)

    const isSelected = selectedEventId === payload.id;

    return (
      <g>
        {isSelected && (
          <circle cx={cx} cy={cy} r={8} fill={fill} fillOpacity={0.25} className="animate-ping" />
        )}
        <circle
          cx={cx}
          cy={cy}
          r={isSelected ? 6 : 4.5}
          fill={fill}
          stroke="#0f172a"
          strokeWidth={1.5}
          style={{ cursor: "pointer" }}
          onClick={() => handleNodeClick(payload.id)}
        />
      </g>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950/95 border border-slate-800 p-3.5 rounded-2xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md max-w-[240px]">
          <p className="font-bold text-slate-100">{data.name}</p>
          <p className="text-slate-400">Дедлайн: <span className="text-slate-350 font-semibold">{data.fullName}</span></p>
          <p className="text-slate-400">Тип: <span className="text-indigo-400 font-semibold">{data.type === "report" ? "Звітність" : "Сплата"}</span></p>
          <p className="text-slate-400">Опис: <span className="text-emerald-400 font-bold font-mono">{data.originalEvent.amount_desc}</span></p>
          <div className="pt-1">
            <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[9px] ${
              data.isPaid 
                ? "bg-emerald-950/65 text-emerald-400 border border-emerald-500/20" 
                : data.isOverdue
                ? "bg-rose-950/65 text-rose-450 border border-rose-500/20"
                : "bg-amber-950/65 text-amber-400 border border-amber-500/20"
            }`}>
              {data.isPaid ? "✓ Сплачено" : data.isOverdue ? "⚠️ Протерміновано" : "● Очікує"}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Group events by Month for the bottom list
  const getMonthName = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleString("uk-UA", { month: "long", year: "numeric" });
  };

  const groupedByMonth: { [key: string]: any[] } = {};
  filteredEvents.forEach((ev) => {
    const month = getMonthName(ev.due_date);
    if (!groupedByMonth[month]) {
      groupedByMonth[month] = [];
    }
    groupedByMonth[month].push(ev);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-indigo-650/90 text-white border border-indigo-500/20 backdrop-blur-md shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-5 duration-300 font-semibold text-xs">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 rounded-2xl glass-panel bg-gradient-to-r from-slate-900/90 to-indigo-950/20 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">Календар подій</span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">Податковий календар UniTax</h2>
          <p className="text-xs text-slate-400 mt-1">
            Відстежуйте дедлайни звітів та сплат для профілю: <span className="font-bold text-slate-200">{selectedProfile.name}</span>
          </p>
        </div>
        <button
          onClick={handleRegenerateCalendar}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-colors shadow-lg shadow-amber-600/20"
        >
          <RefreshCw className="w-4 h-4" />
          Оновити календар
        </button>
      </div>

      {/* Interactive Timeline Graph */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-200/50 dark:border-slate-800/50 bg-slate-900/40 backdrop-blur-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          Хронологічний графік подальших подій та дедлайнів
        </h3>
        
        <div className="w-full h-[220px]">
          {!mounted ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Завантаження таймлайну...
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAmount)"
                  dot={<CustomDot />}
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Таймлайн пустий. Немає подій за обраними фільтрами.
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic text-center">
          * Бульбашки на графіку відповідають датам виконання. Зелені — сплачено, жовті — очікує, червоні — протерміновано. Клікніть на вузол, щоб перейти до картки.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl glass-panel bg-white/5 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Тип події:
          </span>
          {[
            { id: "all", label: "Всі" },
            { id: "payment", label: "Платежі" },
            { id: "report", label: "Звіти" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTypeFilter(item.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === item.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/40"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-2 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Статус:
          </span>
          {[
            { id: "all", label: "Усі" },
            { id: "pending", label: "Очікують" },
            { id: "paid", label: "Виконано" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === item.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/40"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-xs font-semibold text-slate-400">Оновлення податкового календаря...</p>
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedByMonth).map(([month, monthEvents]) => (
            <div key={month} className="space-y-4">
              <h3 className="text-sm font-bold text-indigo-400 capitalize border-b border-slate-200 dark:border-slate-800 pb-2">
                {month}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monthEvents.map((ev) => {
                  const isReport = ev.type === "report";
                  const isPaid = ev.status === "paid";
                  const isOverdue = !isPaid && new Date(ev.due_date) < new Date();
                  const isHighlighted = selectedEventId === ev.id;

                  return (
                    <div
                      key={ev.id}
                      id={`event-card-${ev.id}`}
                      className={`p-5 rounded-2xl glass-panel border flex flex-col justify-between min-h-[140px] transition-all duration-305 ${
                        isHighlighted
                          ? "ring-2 ring-indigo-500 border-indigo-500/80 shadow-lg shadow-indigo-500/10 bg-indigo-950/15"
                          : isPaid
                          ? "bg-slate-900/10 border-slate-200/40 dark:border-slate-800/45 opacity-65"
                          : isOverdue
                          ? "border-red-500/30 bg-red-500/5 hover:border-red-500/40 animate-pulse-slow"
                          : "border-slate-200 dark:border-slate-850 hover:border-indigo-500/30"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            isReport 
                              ? "bg-indigo-950 text-indigo-400 border border-indigo-500/20" 
                              : "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                          }`}>
                            {isReport ? "Звіт" : "Сплата"}
                          </span>
                          
                          <span className="flex items-center text-[10px] font-bold text-slate-400">
                            <Clock className="w-3.5 h-3.5 mr-1 shrink-0 text-slate-500" />
                            До: {ev.due_date}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200">{ev.title}</h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed">{ev.amount_desc}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/40 flex justify-between items-center gap-2">
                        <div>
                          {isPaid ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-emerald-500">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Сплачено
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-red-500">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Протерміновано
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold text-slate-400">
                              <Clock className="w-3.5 h-3.5 mr-1" /> Очікує
                            </span>
                          )}
                        </div>

                        {!isPaid && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openReminderModal(ev)}
                              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
                              title="Нагадати"
                            >
                              <Bell className="w-4 h-4" />
                            </button>
                            {isReport ? (
                              <button
                                onClick={() => router.push("/reports")}
                                className="px-3 py-1.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all"
                              >
                                Скласти звіт
                              </button>
                            ) : (
                              <button
                                onClick={() => handleMarkPaid(ev.id)}
                                className="px-3 py-1.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all"
                              >
                                Сплачено
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-slate-500 glass-panel p-8 rounded-2xl">
          Календарних подій за обраними фільтрами не знайдено.
        </div>
      )}

      {/* Reminder Config Modal */}
      {selectedEventForReminder && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Налаштування нагадування</h3>
                <p className="text-xs text-slate-400 mt-1">Оберіть зручний спосіб сповіщення для дедлайну.</p>
              </div>
              <button
                onClick={() => setSelectedEventForReminder(null)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 text-sm font-semibold"
              >
                Скасувати
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 text-xs space-y-1">
              <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block">Подія:</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">{selectedEventForReminder.title}</p>
              <p className="text-slate-400">Дедлайн: {selectedEventForReminder.due_date}</p>
            </div>

            <div className="space-y-4">
              {/* Channel Toggles */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-3 block">
                  Канали нагадувань:
                </label>
                
                <div className="space-y-2">
                  <div
                    onClick={() => setEmailEnabled(!emailEnabled)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      emailEnabled
                        ? "border-indigo-500 bg-indigo-500/5 text-indigo-300"
                        : "border-slate-200 dark:border-slate-800 text-slate-550"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4" />
                      <span className="text-xs font-bold">Email нагадування</span>
                    </div>
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${emailEnabled ? "bg-indigo-600 border-indigo-500" : "border-slate-450"}`}>
                      {emailEnabled && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>

                  <div
                    onClick={() => setTelegramEnabled(!telegramEnabled)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      telegramEnabled
                        ? "border-indigo-500 bg-indigo-500/5 text-indigo-300"
                        : "border-slate-200 dark:border-slate-800 text-slate-550"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Send className="w-4 h-4" />
                      <span className="text-xs font-bold">Telegram нагадування</span>
                    </div>
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${telegramEnabled ? "bg-indigo-600 border-indigo-500" : "border-slate-450"}`}>
                      {telegramEnabled && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Time selection */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                  Нагадати за:
                </label>
                <select
                  value={reminderDays}
                  onChange={(e) => setReminderDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold focus:outline-none"
                >
                  <option value={1}>1 день до дедлайну</option>
                  <option value={3}>3 дні до дедлайну</option>
                  <option value={7}>7 днів до дедлайну</option>
                </select>
              </div>

              <button
                onClick={handleSaveReminder}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg glow-button flex items-center justify-center gap-1.5"
              >
                <Bell className="w-4 h-4" />
                Активувати нагадування
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
