"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import { 
  Users, 
  FileText, 
  TrendingUp, 
  AlertCircle,
  Search,
  MessageSquare,
  Building2,
  ArrowLeft,
  Phone,
  Mail
} from "lucide-react";
import Link from "next/link";

interface ClientData {
  profile_id: number;
  name: string;
  type: string;
  tax_id: string;
  tax_system: string;
  accountant: { id: number; name: string } | null;
  bank_status: { status: string; label: string; color: string };
  tax_status: { status: string; label: string; color: string; amount?: number };
  report_status: { status: string; label: string; color: string };
  needs_attention: boolean;
  assigned_at: string | null;
  assignment_id?: number;
  is_suspended?: boolean;
}

interface DashboardData {
  consulting_company: {
    id: number;
    name: string;
  };
  user_role: string;
  clients: ClientData[];
  total_clients: number;
  needs_attention_count: number;
}

export default function AccountantDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [filterNeedsAttention, setFilterNeedsAttention] = useState(false);

  useEffect(() => {
    const init = async () => {
      const telegramId = localStorage.getItem("telegram_id");
      let userId: number | null = null;

      if (telegramId) {
        try {
          const userRes = await axios.get(`${API_BASE_URL}/api/auth/user-by-telegram?telegram_id=${telegramId}`);
          userId = userRes.data.user_id;
          setUserName(userRes.data.name || userRes.data.email || "");
        } catch (err) {
          console.error("Failed to load user:", err);
        }
      }

      if (!userId) {
        const cached = localStorage.getItem("user_id");
        if (cached) userId = parseInt(cached);
      }

      if (userId) {
        setCurrentUserId(userId);
        fetchDashboardData(userId);
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchDashboardData = async (userId: number) => {
    try {
      const response = await axios.get<DashboardData>(`${API_BASE_URL}/api/consulting/dashboard?user_id=${userId}`);
      setDashboardData(response.data);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = (dashboardData?.clients || []).filter((client) => {
    if (filterNeedsAttention && !client.needs_attention) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return client.name.toLowerCase().includes(q) || (client.tax_id || "").includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
          <p className="mt-4 text-sm text-slate-400">Завантаження кабінету бухгалтера...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">Доступ обмежено</h2>
          <p className="text-sm text-slate-500 mt-2">
            Ви не є бухгалтером консалтингової компанії. Якщо ви вважаєте, що це помилка — зверніться до власника компанії.
          </p>
          <Link href="/dashboard" className="inline-block mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
            На головну
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </Link>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white">
                  Кабінет бухгалтера
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {userName || "Бухгалтер"} · {dashboardData.consulting_company.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-xs font-bold">
                Бухгалтер
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Мої клієнти</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{dashboardData.total_clients}</p>
              </div>
              <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Потребують уваги</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{dashboardData.needs_attention_count}</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Активні</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  {dashboardData.clients.filter(c => !c.is_suspended).length}
                </p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук за назвою або ІПН..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-white focus:outline-none focus:border-violet-500"
            />
          </div>
          <button
            onClick={() => setFilterNeedsAttention(!filterNeedsAttention)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              filterNeedsAttention
                ? "bg-amber-500 text-white"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
            }`}
          >
            Потребують уваги
          </button>
        </div>

        {/* Clients Table */}
        {filteredClients.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200/60 dark:border-slate-800">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {dashboardData.total_clients === 0 ? "У вас поки немає клієнтів" : "Нічого не знайдено"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {dashboardData.total_clients === 0
                ? "Клієнти з'являться після призначення компанією"
                : "Спробуйте змінити пошуковий запит"}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Клієнт</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Тип</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Банк</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Податки</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Звіти</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredClients.map((client) => (
                    <tr key={client.profile_id} className="hover:bg-slate-50 dark:hover:bg-slate-950/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{client.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">ІПН: {client.tax_id || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {client.type === "fop" ? "ФОП" : client.type === "company" ? "ТОВ" : client.type === "osbb" ? "ОСББ" : client.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${client.bank_status.color}`}>
                          {client.bank_status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${client.tax_status.color}`}>
                          {client.tax_status.label}
                          {client.tax_status.amount ? ` (${client.tax_status.amount} грн)` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${client.report_status.color}`}>
                          {client.report_status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {client.is_suspended ? (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-bold">
                            Призупинено
                          </span>
                        ) : client.needs_attention ? (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-bold">
                            Потребує уваги
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold">
                            Активний
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Chat hint */}
        <div className="mt-6 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/30 rounded-2xl p-4 flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-violet-600 dark:text-violet-400 flex-shrink-0" />
          <p className="text-xs text-violet-700 dark:text-violet-300">
            Чат з кожним клієнтом доступний в їхньому кабінеті. Клієнти можуть писати вам повідомлення через віджет підтримки.
          </p>
        </div>
      </main>
    </div>
  );
}
