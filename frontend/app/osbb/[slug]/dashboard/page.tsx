"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  AlertCircle,
  BarChart3,
  Check,
  CreditCard,
  FileText,
  Gauge,
  Home,
  Lock,
  LogOut,
  MessageSquarePlus,
  Send,
  Users,
  Phone,
  Shield,
  Calendar,
  Download,
  Eye,
  Play,
  Plus,
  Trash2,
  X,
  Info,
  HelpCircle
} from "lucide-react";

const voteLabels: Record<string, string> = { for: "За", against: "Проти", abstain: "Утримався" };

export default function ResidentDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params.slug || "");
  const [token, setToken] = useState("");
  const [dashboard, setDashboard] = useState<any>(null);
  const [transparency, setTransparency] = useState<any>({ debts: [], own_consumption: 0, average_consumption: 0 });
  const [surveys, setSurveys] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [securityDevices, setSecurityDevices] = useState<any[]>([]);
  const [recreationZones, setRecreationZones] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState<"dashboard" | "surveys" | "tickets" | "contacts" | "security" | "bookings" | "documents">("dashboard");

  // Booking Form State
  const [selectedZone, setSelectedZone] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingStartTime, setBookingStartTime] = useState("");
  const [bookingEndTime, setBookingEndTime] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const [meterValues, setMeterValues] = useState<Record<number, string>>({});
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = async (authToken: string) => {
    setLoading(true);
    setError("");
    try {
      const [dash, neighborsResponse, activeSurveys, ticketList, contactList, deviceList, zoneList, bookingList, docList] = await Promise.all([
        api.getMemberDashboard(authToken),
        api.getMemberNeighbors(authToken),
        api.getMemberSurveys(authToken),
        api.getMemberTickets(authToken),
        api.getMemberContacts(authToken),
        api.getMemberSecurityDevices(authToken),
        api.getMemberRecreationZones(authToken),
        api.getMemberBookings(authToken),
        api.getMemberDocuments(authToken),
      ]);
      setDashboard(dash);
      
      const transparencyData = {
        debts: (neighborsResponse.neighbors || []).map((n: any) => ({
          identifier: n.flat_number,
          debt: n.debt
        })),
        own_consumption: `${neighborsResponse.averages?.water_m3 || 4.2} м³ (вода)`,
        average_consumption: `${neighborsResponse.averages?.electricity_kwh || 135.0} кВт·год (ел-ія)`
      };
      setTransparency(transparencyData);
      
      setSurveys(activeSurveys || []);
      setTickets(ticketList || []);
      setContacts(contactList || []);
      setSecurityDevices(deviceList || []);
      setRecreationZones(zoneList || []);
      setMyBookings(bookingList || []);
      setDocuments(docList || []);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push(`/osbb/${slug}/login`);
        return;
      }
      setError(err.response?.data?.detail || "Не вдалося завантажити кабінет");
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = async () => {
    setMessage("");
    setError("");
    try {
      const blob = await api.downloadMemberReceiptPdf(token);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `bill_${member?.identifier || "receipt"}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage("Квитанція успішно завантажена");
    } catch (err: any) {
      setError("Не вдалося завантажити квитанцію");
    }
  };

  const downloadDocument = async (docId: number, filename: string) => {
    setMessage("");
    setError("");
    try {
      const blob = await api.downloadMemberDocument(token, docId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage("Документ успішно завантажено");
    } catch (err: any) {
      setError("Не вдалося завантажити документ");
    }
  };

  const unlockDevice = async (deviceId: number) => {
    setMessage("");
    setError("");
    try {
      const res = await api.unlockMemberSecurityDevice(token, deviceId);
      setMessage(res.message || "Пристрій відчинено успішно!");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не вдалося відчинити пристрій");
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone) return;
    setMessage("");
    setError("");
    setBookingLoading(true);
    try {
      await api.createMemberBooking(token, {
        zone_id: selectedZone.id,
        booking_date: bookingDate,
        start_time: bookingStartTime,
        end_time: bookingEndTime
      });
      setMessage("Бронювання успішно створено!");
      setSelectedZone(null);
      setBookingDate("");
      setBookingStartTime("");
      setBookingEndTime("");
      loadData(token);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не вдалося створити бронювання");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    if (!confirm("Ви впевнені, що хочете скасувати це бронювання?")) return;
    setMessage("");
    setError("");
    try {
      await api.cancelMemberBooking(token, bookingId);
      setMessage("Бронювання скасовано");
      loadData(token);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не вдалося скасувати бронювання");
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("member_token") || "";
    if (!savedToken) {
      router.push(`/osbb/${slug}/login`);
      return;
    }
    setToken(savedToken);
    loadData(savedToken);
  }, [slug]);

  useEffect(() => {
    if (!dashboard?.member?.id) return;
    
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev";
    const wsProtocol = API_BASE_URL.startsWith("https") ? "wss" : "ws";
    const wsHost = API_BASE_URL.replace(/^https?:\/\//, "");
    const wsUrl = `${wsProtocol}://${wsHost}/ws/member/${dashboard.member.id}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === "blocked") {
          localStorage.removeItem("member_token");
          localStorage.removeItem("member_profile_slug");
          router.push(`/osbb/${slug}/login?error=blocked`);
        } else if (data.status === "pending") {
          localStorage.setItem("pending_member_id", String(dashboard.member.id));
          router.push(`/osbb/${slug}/pending`);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };
    
    return () => {
      ws.close();
    };
  }, [dashboard?.member?.id, slug, router]);

  const logout = () => {
    localStorage.removeItem("member_token");
    localStorage.removeItem("member_profile_slug");
    router.push(`/osbb/${slug}/login`);
  };

  const submitMeter = async (meter: any) => {
    setMessage("");
    setError("");
    const value = Number(meterValues[meter.id]);
    if (!Number.isFinite(value)) {
      setError("Введіть коректне показання лічильника");
      return;
    }
    if (value < Number(meter.previous_value || 0)) {
      setError("Нове показання не може бути меншим за попереднє");
      return;
    }
    try {
      await api.submitMemberMeterReading(token, meter.id, { reading_value: value, reading_date: new Date().toISOString().slice(0, 10) });
      setMessage("Показання лічильника збережено");
      setMeterValues((prev) => ({ ...prev, [meter.id]: "" }));
      loadData(token);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не вдалося зберегти показання");
    }
  };

  const vote = async (surveyId: number, value: string) => {
    setMessage("");
    setError("");
    try {
      await api.voteMemberSurvey(token, surveyId, { vote: value });
      setMessage("Ваш голос враховано");
      loadData(token);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не вдалося проголосувати");
    }
  };

  const payMono = async () => {
    setMessage("");
    setError("");
    const amount = Math.abs(Number(dashboard?.member?.balance || 0));
    if (amount <= 0) {
      setError("Немає боргу для оплати");
      return;
    }
    try {
      const res = await api.createMemberMonoInvoice(token, {
        amount,
        charge_type: "regular",
        description: `Оплата за особовим рахунком ${dashboard?.member?.account_number || dashboard?.member?.identifier}`,
      });
      if (res.pageUrl) {
        window.open(res.pageUrl, "_blank");
        setMessage("Рахунок Mono Pay створено. Відкриваємо оплату...");
      } else {
        setError("Не вдалося отримати посилання на оплату");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не вдалося створити рахунок Mono Pay");
    }
  };

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.createMemberTicket(token, { title: ticketTitle, description: ticketDescription });
      setTicketTitle("");
      setTicketDescription("");
      setMessage("Заявку створено");
      loadData(token);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не вдалося створити заявку");
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Завантаження кабінету...</main>;
  }

  const member = dashboard?.member;
  const profile = dashboard?.profile;
  const balance = Number(member?.balance || 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        .font-sans {
          font-family: 'Outfit', sans-serif;
        }
        .glass-panel {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(15, 23, 42, 0.09);
        }
      `}} />

      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundColor: profile?.color_theme || "#3b82f6" }}>
              <Home size={22} />
            </div>
            <div>
              <div className="font-extrabold tracking-tight text-slate-900">{profile?.name}</div>
              <div className="text-xs text-slate-500 font-medium">Кабінет мешканця (Веб-версія)</div>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
            <LogOut size={16} /> Вийти
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {message && <div className="rounded-2xl bg-emerald-50 border border-emerald-250 p-4 text-sm font-semibold text-emerald-800">{message}</div>}
        {error && <div className="rounded-2xl bg-rose-50 border border-rose-250 p-4 text-sm font-semibold text-rose-800">{error}</div>}

        {/* User Card */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Власник / об'єкт</div>
              <h1 className="mt-1 text-2xl font-black text-slate-900">{member?.owner_name || "Мешканець"}</h1>
              <p className="mt-1 text-slate-550 font-semibold">{member?.property_type || "кв."} № {member?.identifier}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={payMono} className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white hover:bg-indigo-500 shadow-md transition-all active:scale-95">
                <CreditCard size={16} /> Сплатити через Mono Pay
              </button>
              <button onClick={downloadReceipt} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95">
                <FileText size={16} /> Завантажити квитанцію (PDF)
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Поточний баланс</div>
              <div className={`mt-3 text-4xl font-black ${balance < 0 ? "text-orange-650" : "text-emerald-600"}`}>
                {balance.toFixed(2)} грн
              </div>
            </div>
            <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl w-fit ${
              balance < 0 ? "bg-orange-50 text-orange-600 border border-orange-200/50" : "bg-emerald-50 text-emerald-600 border border-emerald-200/50"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${balance < 0 ? "bg-orange-550" : "bg-emerald-555"}`} />
              {balance < 0 ? "Борг (необхідно сплатити)" : "Передплата (немає боргу)"}
            </div>
          </div>
        </section>

        {/* Tabbar Navigation */}
        <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "dashboard"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-550 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            📊 Головна
          </button>
          <button
            onClick={() => setActiveTab("surveys")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "surveys"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-550 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            🗳️ Опитування ({surveys.length})
          </button>
          <button
            onClick={() => setActiveTab("tickets")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "tickets"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-550 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            🔧 Заявки ({tickets.length})
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "contacts"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-550 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            📞 Контакти ({contacts.length})
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "security"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-550 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            🛡️ Безпека ({securityDevices.length})
          </button>
          <button
            onClick={() => setActiveTab("bookings")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "bookings"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-550 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            📅 Бронювання ({myBookings.length})
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "documents"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-550 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            📂 Документи ({documents.length})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="transition-all duration-200">
          
          {/* Main Dashboard Tab */}
          {activeTab === "dashboard" && (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2 font-bold text-slate-800"><Gauge size={20} className="text-indigo-600" /> Показання лічильників</div>
                <div className="space-y-3">
                  {(dashboard?.meters || []).map((meter: any) => (
                    <div key={meter.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{meter.name}</div>
                          <div className="text-sm text-slate-500 font-medium">Попереднє: {meter.previous_value} {meter.unit || "м³"}</div>
                        </div>
                        {meter.is_locked && <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-550 font-bold"><Lock size={12} /> Закрито</span>}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input disabled={meter.is_locked} value={meterValues[meter.id] || ""} onChange={(e) => setMeterValues((prev) => ({ ...prev, [meter.id]: e.target.value }))} type="number" min={meter.previous_value} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-500 bg-white disabled:bg-slate-100" placeholder="Нове показання" />
                        <button disabled={meter.is_locked} onClick={() => submitMeter(meter)} className="rounded-xl bg-indigo-600 hover:bg-indigo-550 px-4 py-2 font-bold text-white text-xs disabled:bg-slate-300">Надіслати</button>
                      </div>
                    </div>
                  ))}
                  {(dashboard?.meters || []).length === 0 && <div className="text-sm text-slate-500">Лічильники ще не підключені.</div>}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2 font-bold text-slate-800"><Users size={20} className="text-indigo-600" /> Дошка прозорості</div>
                <div className="mb-4 rounded-2xl bg-indigo-50 border border-indigo-200/50 p-4 text-xs font-semibold text-indigo-900 leading-relaxed">
                  Ваше споживання: <b>{transparency.own_consumption}</b>. Середнє по будинку: <b>{transparency.average_consumption}</b>.
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500"><tr><th className="p-3">№ квартири</th><th className="p-3">Сума боргу</th></tr></thead>
                    <tbody>
                      {(transparency.debts || []).map((row: any) => (
                        <tr key={row.identifier} className="border-t border-slate-100 text-xs font-bold"><td className="p-3 text-slate-700">{row.identifier}</td><td className="p-3 text-orange-600">{row.debt} грн</td></tr>
                      ))}
                      {(transparency.debts || []).length === 0 && <tr><td colSpan={2} className="p-3 text-slate-500">Боргів немає.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Surveys Tab */}
          {activeTab === "surveys" && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-800 mb-2"><BarChart3 size={20} className="text-indigo-600" /> Активні опитування та голосування</div>
              <div className="grid gap-4 md:grid-cols-2">
                {surveys.map((survey) => (
                  <div key={survey.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{survey.title}</div>
                      {survey.description && <p className="mt-2 text-xs font-medium text-slate-550 leading-relaxed">{survey.description}</p>}
                      <div className="mt-4">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, survey.quorum_percent)}%` }} /></div>
                        <div className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Зібрано {survey.quorum_percent}% голосів. Кворум: 50%.</div>
                      </div>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-200/60">
                      {member?.role === "tenant" && (
                        <div className="text-xs text-rose-650 font-semibold mb-2 flex items-center gap-1">
                          <AlertCircle size={14} /> Лише для власників
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {["for", "against", "abstain"].map((value) => (
                          <button
                            key={value}
                            disabled={member?.role === "tenant"}
                            onClick={() => vote(survey.id, value)}
                            className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all active:scale-95 ${
                              survey.own_vote === value
                                ? "bg-indigo-600 text-white shadow-md"
                                : "bg-white border border-slate-200 text-slate-650 hover:bg-slate-50"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={member?.role === "tenant" ? "Лише для власників" : undefined}
                          >
                            {survey.own_vote === value && <Check className="mr-1 inline w-3.5 h-3.5" />}
                            {voteLabels[value]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {surveys.length === 0 && <div className="text-sm text-slate-500 font-semibold py-8 col-span-2 text-center">Активних опитувань немає.</div>}
              </div>
            </div>
          )}

          {/* Tickets Tab */}
          {activeTab === "tickets" && (
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm h-fit">
                <div className="mb-4 flex items-center gap-2 font-bold text-slate-800"><MessageSquarePlus size={20} className="text-indigo-600" /> Створити нову заявку</div>
                <form onSubmit={createTicket} className="space-y-4">
                  <input value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} required className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 bg-slate-50/50" placeholder="Тема заявки (наприклад: Тече дах)" />
                  <textarea value={ticketDescription} onChange={(e) => setTicketDescription(e.target.value)} required className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 bg-slate-50/50" placeholder="Детальний опис проблеми..." />
                  <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-550 px-4 py-3 font-bold text-xs text-white shadow-md active:scale-95 transition-all"><Send size={14} /> Надіслати заявку</button>
                </form>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
                <div className="mb-4 flex items-center gap-2 font-bold text-slate-800"><MessageSquarePlus size={20} className="text-indigo-600" /> Мої активні заявки</div>
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-slate-900">{ticket.title}</div>
                        <div className="text-xs font-semibold text-slate-550 mt-1">{ticket.description}</div>
                        {ticket.contractor_name && (
                          <div className="text-[10px] text-indigo-500 font-extrabold uppercase mt-2">Виконавець: {ticket.contractor_name}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ticket.price > 0 && (
                          <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">{ticket.price} грн</span>
                        )}
                        <span className={`rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
                          ticket.status === "completed" ? "bg-emerald-100 text-emerald-800" :
                          ticket.status === "in_progress" ? "bg-amber-100 text-amber-800" :
                          ticket.status === "cancelled" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
                        }`}>{ticket.status}</span>
                      </div>
                    </div>
                  ))}
                  {tickets.length === 0 && <div className="text-sm text-slate-500 font-semibold py-8 text-center">Заявок поки немає.</div>}
                </div>
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === "contacts" && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-800 mb-2"><Phone size={20} className="text-indigo-600" /> Контакти адміністрації ОСББ</div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="rounded-2xl border border-slate-200 p-5 bg-slate-50/50 flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">{contact.name}</h3>
                      <p className="text-xs font-semibold text-slate-500 mt-1">{contact.role}</p>
                      <p className="text-sm font-bold text-slate-800 mt-3">{contact.phone}</p>
                    </div>
                    <a
                      href={`tel:${contact.phone}`}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2.5 transition-all"
                    >
                      <Phone size={14} /> Зателефонувати
                    </a>
                  </div>
                ))}
                {contacts.length === 0 && <div className="text-sm text-slate-500 font-semibold py-8 col-span-3 text-center">Контакти не додані.</div>}
              </div>
            </div>
          )}

          {/* Security Devices Tab */}
          {activeTab === "security" && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 font-bold text-slate-800 mb-2"><Shield size={20} className="text-indigo-600" /> Системи безпеки та відеонагляд</div>
              
              <div className="grid gap-6 md:grid-cols-2">
                {/* Cameras Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Камери спостереження</h3>
                  <div className="space-y-4">
                    {securityDevices.filter(d => d.device_type === "camera").map((device) => (
                      <div key={device.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-900 relative group">
                        {device.stream_url ? (
                          <video
                            src={device.stream_url}
                            controls
                            muted
                            autoPlay
                            loop
                            className="w-full aspect-video object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-video flex flex-col items-center justify-center text-slate-400">
                            <Eye size={32} className="mb-2" />
                            <p className="text-xs font-bold">Трансляція недоступна</p>
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1 rounded-xl text-[10px] font-bold">
                          {device.name}
                        </div>
                      </div>
                    ))}
                    {securityDevices.filter(d => d.device_type === "camera").length === 0 && (
                      <p className="text-xs text-slate-500 font-semibold py-4 text-center">Камери не підключені.</p>
                    )}
                  </div>
                </div>

                {/* Barriers / Doors Control Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">Контроль доступу (Ворота/Хвіртки)</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {securityDevices.filter(d => d.device_type !== "camera").map((device) => (
                      <div key={device.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex flex-col justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{device.name}</h4>
                          <span className="inline-block mt-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                            {device.device_type === "barrier" ? "Шлагбаум" : "Двері"}
                          </span>
                        </div>
                        <button
                          onClick={() => unlockDevice(device.id)}
                          className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-bold py-2.5 transition-all shadow-sm active:scale-95"
                        >
                          <Play size={14} className="rotate-90" /> Відчинити
                        </button>
                      </div>
                    ))}
                    {securityDevices.filter(d => d.device_type !== "camera").length === 0 && (
                      <p className="text-xs text-slate-500 font-semibold py-4 text-center col-span-2">Пристрої доступу не підключені.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bookings (Recreation Zones) Tab */}
          {activeTab === "bookings" && (
            <div className="space-y-6">
              {/* Recreation Zones List */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 font-bold text-slate-800 mb-2"><Calendar size={20} className="text-indigo-600" /> Доступні зони відпочинку та дозвілля</div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {recreationZones.map((zone) => (
                    <div key={zone.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/30 flex flex-col justify-between">
                      {zone.image_url && (
                        <img src={zone.image_url} alt={zone.name} className="w-full h-44 object-cover" />
                      )}
                      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-base">{zone.name}</h3>
                          {zone.description && <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">{zone.description}</p>}
                          <div className="flex items-center gap-4 mt-4 text-xs font-bold text-slate-600">
                            <span>Місткість: {zone.capacity} осіб</span>
                            <span>Тариф: {zone.price_per_hour} грн/год</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedZone(zone);
                            setBookingDate("");
                            setBookingStartTime("");
                            setBookingEndTime("");
                          }}
                          className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-bold py-2.5 transition-all shadow-sm"
                        >
                          Забронювати
                        </button>
                      </div>
                    </div>
                  ))}
                  {recreationZones.length === 0 && (
                    <div className="text-sm text-slate-500 font-semibold py-8 col-span-3 text-center">Зони відпочинку не додані.</div>
                  )}
                </div>
              </div>

              {/* Booking Modal / Dialog */}
              {selectedZone && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                  <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <h3 className="text-base font-black text-slate-900">Бронювання: {selectedZone.name}</h3>
                      <button onClick={() => setSelectedZone(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateBooking} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-550">Дата бронювання</label>
                        <input
                          type="date"
                          required
                          value={bookingDate}
                          onChange={(e) => setBookingDate(e.target.value)}
                          className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-550">Час початку</label>
                          <input
                            type="time"
                            required
                            value={bookingStartTime}
                            onChange={(e) => setBookingStartTime(e.target.value)}
                            className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-550">Час закінчення</label>
                          <input
                            type="time"
                            required
                            value={bookingEndTime}
                            onChange={(e) => setBookingEndTime(e.target.value)}
                            className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Display tariff info */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1 text-slate-600">
                        <div>Тариф зони: <b>{selectedZone.price_per_hour} грн/година</b>.</div>
                        <div>Оплата списується з особового рахунку мешканця автоматично.</div>
                      </div>

                      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedZone(null)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200"
                        >
                          Скасувати
                        </button>
                        <button
                          type="submit"
                          disabled={bookingLoading}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold disabled:bg-slate-300"
                        >
                          {bookingLoading ? "Створення..." : "Підтвердити"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* My Bookings List */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 font-bold text-slate-800 mb-2"><Calendar size={20} className="text-indigo-600" /> Мої бронювання</div>
                <div className="space-y-3">
                  {myBookings.map((booking) => (
                    <div key={booking.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-slate-900">{booking.zone_name}</div>
                        <div className="text-xs font-semibold text-slate-500 mt-1">
                          Дата: <b>{booking.booking_date}</b> | Час: <b>{booking.start_time} - {booking.end_time}</b>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="rounded-xl border border-emerald-250 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                          {booking.total_price} грн
                        </span>
                        <span className={`rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
                          booking.status === "confirmed" ? "bg-emerald-100 text-emerald-800" :
                          booking.status === "cancelled" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
                        }`}>
                          {booking.status === "confirmed" ? "Підтверджено" : booking.status === "cancelled" ? "Скасовано" : booking.status}
                        </span>
                        {booking.status !== "cancelled" && (
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 border border-transparent hover:border-rose-200 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {myBookings.length === 0 && (
                    <div className="text-sm text-slate-500 font-semibold py-8 text-center">У вас немає активних бронювань.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-800 mb-2"><FileText size={20} className="text-indigo-600" /> Публічні документи правління ОСББ</div>
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        {doc.filename}
                      </div>
                      {doc.description && <p className="text-xs text-slate-500 font-medium leading-relaxed pl-6">{doc.description}</p>}
                      <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-400 tracking-wider pl-6 pt-1">
                        <span>Завантажено: {doc.upload_date}</span>
                        <span>•</span>
                        <span>Категорія: {
                          doc.document_type === "regulatory" ? "Статутні/Протоколи" :
                          doc.document_type === "financial" ? "Фінансові звіти" :
                          doc.document_type === "info" ? "Оголошення" : "Інше"
                        }</span>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadDocument(doc.id, doc.filename)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-4 py-2.5 shrink-0 transition-all active:scale-95"
                    >
                      <Download size={14} /> Завантажити (PDF)
                    </button>
                  </div>
                ))}
                {documents.length === 0 && (
                  <div className="text-sm text-slate-500 font-semibold py-8 text-center">Офіційні документи не додані.</div>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="mt-6 flex items-center gap-2 rounded-2xl bg-slate-100 p-4 text-xs font-bold text-slate-500">
          <AlertCircle size={18} className="text-slate-400" /> У кабінеті немає реклами та чату між мешканцями. Персональні дані сусідів не відображаються.
        </div>
      </div>
    </main>
  );
}
