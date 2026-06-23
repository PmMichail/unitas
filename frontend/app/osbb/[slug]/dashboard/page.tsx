"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AlertCircle, BarChart3, Check, CreditCard, FileText, Gauge, Home, Lock, LogOut, MessageSquarePlus, Send, Users } from "lucide-react";

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
      const [dash, neighborsResponse, activeSurveys, ticketList] = await Promise.all([
        api.getMemberDashboard(authToken),
        api.getMemberNeighbors(authToken),
        api.getMemberSurveys(authToken),
        api.getMemberTickets(authToken),
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: profile?.color_theme || "#3b82f6" }}>
              <Home size={22} />
            </div>
            <div>
              <div className="font-bold">{profile?.name}</div>
              <div className="text-xs text-slate-500">Кабінет мешканця</div>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            <LogOut size={16} /> Вийти
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {message && <div className="mb-4 rounded-2xl bg-green-50 p-3 text-sm text-green-700">{message}</div>}
        {error && <div className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
            <div className="text-sm text-slate-500">Власник / об'єкт</div>
            <h1 className="mt-1 text-2xl font-bold">{member?.owner_name || "Мешканець"}</h1>
            <p className="mt-1 text-slate-500">{member?.property_type || "кв."} № {member?.identifier}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={payMono} className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700">
                <CreditCard size={18} /> Сплатити через Mono Pay
              </button>
              <button onClick={downloadReceipt} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 font-semibold hover:bg-slate-50">
                <FileText size={18} /> Завантажити квитанцію (PDF)
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-slate-500">Поточний баланс</div>
            <div className={`mt-2 text-4xl font-black ${balance < 0 ? "text-red-600" : "text-green-600"}`}>{balance.toFixed(2)} грн</div>
            <div className="mt-2 text-sm text-slate-500">{balance < 0 ? "Борг" : "Передплата / немає боргу"}</div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-bold"><Gauge size={20} /> Показання лічильників</div>
            <div className="space-y-3">
              {(dashboard?.meters || []).map((meter: any) => (
                <div key={meter.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{meter.name}</div>
                      <div className="text-sm text-slate-500">Попереднє: {meter.previous_value}</div>
                    </div>
                    {meter.is_locked && <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500"><Lock size={12} /> Закрито</span>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input disabled={meter.is_locked} value={meterValues[meter.id] || ""} onChange={(e) => setMeterValues((prev) => ({ ...prev, [meter.id]: e.target.value }))} type="number" min={meter.previous_value} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 disabled:bg-slate-100" placeholder="Нове показання" />
                    <button disabled={meter.is_locked} onClick={() => submitMeter(meter)} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:bg-slate-300">OK</button>
                  </div>
                </div>
              ))}
              {(dashboard?.meters || []).length === 0 && <div className="text-sm text-slate-500">Лічильники ще не підключені.</div>}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-bold"><Users size={20} /> Дошка прозорості</div>
            <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
              Ваше споживання: <b>{transparency.own_consumption}</b>. Середнє по будинку: <b>{transparency.average_consumption}</b>.
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">№ квартири</th><th className="p-3">Сума боргу</th></tr></thead>
                <tbody>
                  {(transparency.debts || []).map((row: any) => (
                    <tr key={row.identifier} className="border-t border-slate-100"><td className="p-3">{row.identifier}</td><td className="p-3 font-semibold text-red-600">{row.debt} грн</td></tr>
                  ))}
                  {(transparency.debts || []).length === 0 && <tr><td colSpan={2} className="p-3 text-slate-500">Боргів немає.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-bold"><BarChart3 size={20} /> Опитування та голосування</div>
            <div className="space-y-3">
              {surveys.map((survey) => (
                <div key={survey.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-semibold">{survey.title}</div>
                  {survey.description && <p className="mt-1 text-sm text-slate-500">{survey.description}</p>}
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${Math.min(100, survey.quorum_percent)}%` }} /></div>
                  <div className="mt-1 text-xs text-slate-500">Зібрано {survey.quorum_percent}% голосів. Для кворуму потрібно 50%.</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["for", "against", "abstain"].map((value) => (
                      <button key={value} onClick={() => vote(survey.id, value)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${survey.own_vote === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                        {survey.own_vote === value && <Check className="mr-1 inline" size={14} />}{voteLabels[value]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {surveys.length === 0 && <div className="text-sm text-slate-500">Активних опитувань немає.</div>}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-bold"><MessageSquarePlus size={20} /> Диспетчер заявок</div>
            <form onSubmit={createTicket} className="mb-4 space-y-3">
              <input value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} required className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" placeholder="Тема заявки" />
              <textarea value={ticketDescription} onChange={(e) => setTicketDescription(e.target.value)} required className="min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" placeholder="Опис проблеми" />
              <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"><Send size={16} /> Створити заявку</button>
            </form>
            <div className="space-y-2">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{ticket.title}</div>
                      <div className="text-sm text-slate-500">{ticket.description}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{ticket.status}</span>
                  </div>
                </div>
              ))}
              {tickets.length === 0 && <div className="text-sm text-slate-500">Заявок поки немає.</div>}
            </div>
          </div>
        </section>

        <div className="mt-6 flex items-center gap-2 rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">
          <AlertCircle size={18} /> У кабінеті немає реклами та чату між мешканцями. Персональні дані сусідів не відображаються.
        </div>
      </div>
    </main>
  );
}
