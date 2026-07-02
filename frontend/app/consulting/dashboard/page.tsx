"use client";

import { useEffect, useState } from "react";
import axios from "axios";
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
}

interface DashboardData {
  consulting_company: {
    id: number;
    name: string;
    free_slots: number;
    partner_discount: number;
  };
  user_role: string;
  clients: ClientData[];
  total_clients: number;
  needs_attention_count: number;
}

interface StaffMember {
  user_id: number;
  email: string;
  phone: string | null;
  role: string;
  language: string;
  assigned_clients_count: number;
  is_active: boolean;
}

type ConsultingTab = "clients" | "staff" | "billing" | "marketplace";

export default function ConsultingDashboard() {
  const [activeTab, setActiveTab] = useState<ConsultingTab>("clients");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [staffData, setStaffData] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [selectedProfileName, setSelectedProfileName] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [billingData, setBillingData] = useState<any>(null);
  const [marketplaceOffers, setMarketplaceOffers] = useState<any[]>([]);
  const [marketplaceListing, setMarketplaceListing] = useState<any>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [newOffer, setNewOffer] = useState({ title: "", description: "", price: "", target_type: "fop" });
  const [filterMyClients, setFilterMyClients] = useState(false);
  const [filterNeedsAttention, setFilterNeedsAttention] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    fetchCurrentUserId();
  }, []);

  const fetchCurrentUserId = async () => {
    try {
      const telegramId = localStorage.getItem("telegram_id");
      if (!telegramId) {
        console.error("No telegram_id found in localStorage");
        return;
      }
      const response = await axios.get(`/api/auth/user-by-telegram?telegram_id=${telegramId}`);
      setCurrentUserId(response.data.user_id);
      fetchDashboardData(response.data.user_id);
    } catch (error) {
      console.error("Failed to fetch user_id:", error);
      // Fallback to user_id=1 for development
      setCurrentUserId(1);
      fetchDashboardData(1);
    }
  };

  const handleSeedTestData = async () => {
    setIsSeeding(true);
    try {
      const response = await axios.post("/api/consulting/seed-test-data");
      console.log("Test data seeded:", response.data);
      alert("Тестові дані успішно створено!");
      // Refresh dashboard data
      if (currentUserId) {
        fetchDashboardData(currentUserId);
      }
    } catch (error) {
      console.error("Failed to seed test data:", error);
      alert("Помилка при створенні тестових даних");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleInviteClient = async () => {
    try {
      if (!inviteEmail) {
        alert("Введіть email клієнта");
        return;
      }
      // For now, just show a success message
      alert(`Запрошення відправлено на ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail("");
      setInvitePhone("");
    } catch (error) {
      console.error("Failed to invite client:", error);
      alert("Помилка при відправці запрошення");
    }
  };

  const fetchDashboardData = async (userId: number) => {
    try {
      const response = await axios.get<DashboardData>(`/api/consulting/dashboard?user_id=${userId}`);
      setDashboardData(response.data);
      setIsOwner(response.data.user_role === "owner");
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffData = async () => {
    try {
      if (!currentUserId) return;
      const response = await axios.get<{ team: StaffMember[] }>(`/api/consulting/team?user_id=${currentUserId}`);
      setStaffData(response.data.team);
    } catch (error) {
      console.error("Failed to fetch staff data:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "staff" && isOwner) {
      fetchStaffData();
    }
  }, [activeTab, isOwner]);

  useEffect(() => {
    if (activeTab === "billing" && isOwner) {
      fetchBillingData();
    }
  }, [activeTab, isOwner]);

  useEffect(() => {
    if (activeTab === "marketplace" && isOwner) {
      fetchMarketplaceData();
    }
  }, [activeTab, isOwner]);

  const handleContextSwitch = (client: ClientData) => {
    setSelectedProfileId(client.profile_id);
    setSelectedProfileName(client.name);
    // Store in localStorage for global context
    localStorage.setItem("selected_profile_id", client.profile_id.toString());
    localStorage.setItem("selected_profile_name", client.name);
  };

  const handleReturnToConsulting = () => {
    setSelectedProfileId(null);
    setSelectedProfileName("");
    localStorage.removeItem("selected_profile_id");
    localStorage.removeItem("selected_profile_name");
  };

  const handleInviteAccountant = async () => {
    try {
      const userId = 1; // TODO: Replace with actual user_id from auth
      const formData = new FormData();
      formData.append("email", inviteEmail);
      if (invitePhone) formData.append("phone", invitePhone);
      formData.append("user_id", userId.toString());
      
      await axios.post("/api/consulting/add-team-member", formData);
      setShowInviteModal(false);
      setInviteEmail("");
      setInvitePhone("");
      fetchStaffData();
    } catch (error) {
      console.error("Failed to invite accountant:", error);
    }
  };

  const fetchBillingData = async () => {
    try {
      if (!currentUserId) return;
      const response = await axios.get(`/api/consulting/billing?user_id=${currentUserId}`);
      setBillingData(response.data);
    } catch (error) {
      console.error("Failed to fetch billing data:", error);
    }
  };

  const fetchMarketplaceData = async () => {
    try {
      if (!currentUserId) return;
      const [offersRes, userRes] = await Promise.all([
        axios.get(`/api/consulting/marketplace/offers?user_id=${currentUserId}`),
        axios.get(`/api/consulting/dashboard?user_id=${currentUserId}`)
      ]);
      setMarketplaceOffers(offersRes.data.offers);
      setMarketplaceListing(userRes.data);
    } catch (error) {
      console.error("Failed to fetch marketplace data:", error);
    }
  };

  const handleCreateOffer = async () => {
    try {
      if (!currentUserId) return;
      const formData = new FormData();
      formData.append("title_uk", newOffer.title);
      formData.append("description_uk", newOffer.description);
      formData.append("price_uah", newOffer.price);
      formData.append("target_type", newOffer.target_type);
      formData.append("user_id", currentUserId.toString());
      
      await axios.post("/api/consulting/marketplace/offers", formData);
      setShowOfferModal(false);
      setNewOffer({ title: "", description: "", price: "", target_type: "fop" });
      fetchMarketplaceData();
    } catch (error) {
      console.error("Failed to create offer:", error);
    }
  };

  const handleToggleListing = async () => {
    try {
      if (!currentUserId) return;
      const formData = new FormData();
      formData.append("is_listed", (!marketplaceListing?.is_listed_in_marketplace).toString());
      formData.append("user_id", currentUserId.toString());
      
      await axios.put("/api/consulting/marketplace/listing", formData);
      fetchMarketplaceData();
    } catch (error) {
      console.error("Failed to toggle listing:", error);
    }
  };

  const handleDeleteOffer = async (offerId: number) => {
    try {
      if (!currentUserId) return;
      await axios.delete(`/api/consulting/marketplace/offers/${offerId}?user_id=${currentUserId}`);
      fetchMarketplaceData();
    } catch (error) {
      console.error("Failed to delete offer:", error);
    }
  };

  const getBankSyncBadge = (status: string) => {
    switch (status) {
      case "synced":
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">🟢 Синхронізовано</span>;
      case "outdated":
      case "no_statements":
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium animate-pulse">🔴 Потрібен імпорт</span>;
      case "not_connected":
        return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium">⚪ Не підключено</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium">⚪ Невідомо</span>;
    }
  };

  const getTaxStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">🟢 Сплачено</span>;
      case "calculation":
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">🟡 Розрахунок зарплати</span>;
      case "debt":
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">🔴 Борг!</span>;
      case "no_data":
        return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium">⚪ Немає даних</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium">⚪ Невідомо</span>;
    }
  };

  const getDpsReportBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">🟢 Прийнято</span>;
      case "pending":
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">🟡 На перевірці</span>;
      case "not_submitted":
      case "overdue":
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">🔴 Не відправлено</span>;
      case "upcoming":
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">🟡 Дедлайн</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium">⚪ Невідомо</span>;
    }
  };

  const filteredClients = dashboardData?.clients.filter(client => {
    // Search filter
    const matchesSearch = 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.tax_id && client.tax_id.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    // "Тільки мої" filter - for non-owners only
    if (filterMyClients && !isOwner) {
      if (!currentUserId || !client.accountant || client.accountant.id !== currentUserId) {
        return false;
      }
    }
    
    // "Потрібно уваги" filter - clients with at least one RED status
    if (filterNeedsAttention) {
      const hasRedStatus = 
        client.bank_status.status === "outdated" ||
        client.bank_status.status === "no_statements" ||
        client.tax_status.status === "debt" ||
        client.report_status.status === "not_submitted" ||
        client.report_status.status === "overdue";
      
      if (!hasRedStatus) return false;
    }
    
    return true;
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p className="mt-3 text-sm text-slate-400 font-semibold">Завантаження дашборду...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16]">
      {/* Context Switch Banner */}
      {selectedProfileId && (
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <span className="font-medium">
              Ви працюєте в кабінеті клієнта: <strong>{selectedProfileName}</strong>
            </span>
            <div className="flex gap-2">
              <Link
                href="/reports"
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Звіти
              </Link>
              <Link
                href="/taxes"
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Податки
              </Link>
              <Link
                href="/settings"
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Налаштування
              </Link>
            </div>
          </div>
          <button
            onClick={handleReturnToConsulting}
            className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
          >
            Повернутися в панель консалтингу
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Кабінет Партнера
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {dashboardData?.consulting_company.name} • {dashboardData?.total_clients} клієнтів
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSeedTestData}
                disabled={isSeeding}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
              >
                {isSeeding ? "Створення..." : "Створити тестові дані"}
              </button>
              {isOwner && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  + Додати клієнта
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="inline-flex bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setActiveTab("clients")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "clients"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              Матриця клієнтів
            </button>
            {isOwner && (
              <button
                onClick={() => setActiveTab("staff")}
                className={`px-6 py-3 rounded-md font-medium transition-all ${
                  activeTab === "staff"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                Управління командою
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setActiveTab("billing")}
                className={`px-6 py-3 rounded-md font-medium transition-all ${
                  activeTab === "billing"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                Білінг та Ліцензії
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setActiveTab("marketplace")}
                className={`px-6 py-3 rounded-md font-medium transition-all ${
                  activeTab === "marketplace"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                Мій Маркетплейс
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "clients" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm">
            {/* Search and Filters */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Пошук за назвою або ЄДРПОУ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterMyClients(false);
                      setFilterNeedsAttention(false);
                    }}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      !filterMyClients && !filterNeedsAttention
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    Всі
                  </button>
                  {!isOwner && (
                    <button
                      onClick={() => setFilterMyClients(!filterMyClients)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        filterMyClients
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      Тільки мої
                    </button>
                  )}
                  <button
                    onClick={() => setFilterNeedsAttention(!filterNeedsAttention)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      filterNeedsAttention
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    Потрібно уваги
                  </button>
                </div>
              </div>
            </div>

            {/* Client Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Клієнт
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Бухгалтер
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Банк
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Податки
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Звіти ДПС
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Дії
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredClients.map((client) => (
                    <tr key={client.profile_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {client.name}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {client.type} • {client.tax_id || "Без ЄДРПОУ"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          {client.accountant ? client.accountant.name : "Не призначено"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getBankSyncBadge(client.bank_status.status)}
                      </td>
                      <td className="px-6 py-4">
                        {getTaxStatusBadge(client.tax_status.status)}
                      </td>
                      <td className="px-6 py-4">
                        {getDpsReportBadge(client.report_status.status)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleContextSwitch(client)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                          Увійти в кабінет
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredClients.length === 0 && (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                Клієнтів не знайдено
              </div>
            )}
          </div>
        )}

        {activeTab === "staff" && isOwner && (
          <div className="space-y-6">
            {/* Invite Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center"
              >
                <span className="mr-2">+</span> Додати бухгалтера
              </button>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {staffData.map((staff) => (
                <div key={staff.user_id} className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                        {staff.email}
                      </h3>
                      {staff.phone && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{staff.phone}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      staff.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"
                    }`}>
                      {staff.is_active ? "Активний" : "Неактивний"}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Клієнтів на обслуговуванні
                      </span>
                      <span className="text-lg font-bold text-indigo-600">
                        {staff.assigned_clients_count}
                      </span>
                    </div>
                  </div>
                  <button className="w-full mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                    Налаштувати доступи
                  </button>
                </div>
              ))}
            </div>

            {staffData.length === 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400">
                Команда ще не сформована. Додайте першого бухгалтера.
              </div>
            )}
          </div>
        )}

        {activeTab === "billing" && isOwner && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Білінг та Ліцензії
            </h2>
            
            {billingData ? (
              <div className="space-y-6">
                {/* Slots Usage */}
                <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                    Використання слотів
                  </h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      Безкоштовні слоти
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {billingData.usage.free_slots_used} з {billingData.consulting_company.free_slots}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mb-4">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${(billingData.usage.free_slots_used / billingData.consulting_company.free_slots) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      Платні слоти
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {billingData.usage.paid_slots} з ∞
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>Всього клієнтів: {billingData.usage.total_clients}</span>
                    <span>Залишилось безкоштовних: {billingData.usage.free_slots_remaining}</span>
                  </div>
                </div>

                {/* Partner Discount */}
                <div className="p-6 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                        Партнерська знижка
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Знижка на додаткових клієнтів
                      </p>
                    </div>
                    <div className="text-3xl font-bold text-indigo-600">
                      {billingData.consulting_company.partner_discount}%
                    </div>
                  </div>
                </div>

                {/* Next Billing */}
                <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                    Наступне списання
                  </h3>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                    {billingData.billing.monthly_cost.toLocaleString('uk-UA')} грн
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Базова ціна: {billingData.billing.base_price_per_slot} грн/слот • 
                    Зі знижкою: {billingData.billing.discounted_price} грн/слот
                  </p>
                </div>

                {/* Payment Method */}
                <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                    Спосіб оплати
                  </h3>
                  <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                    Прив'язати корпоративну картку
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                Завантаження даних білінгу...
              </div>
            )}
          </div>
        )}

        {activeTab === "marketplace" && isOwner && (
          <div className="space-y-6">
            {/* Listing Toggle */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    Відображення в маркетплейсі
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {marketplaceListing?.is_listed_in_marketplace 
                      ? "Ваша компанія відображається в маркетплейсі" 
                      : "Ваша компанія прихована в маркетплейсі"}
                  </p>
                </div>
                <button
                  onClick={handleToggleListing}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    marketplaceListing?.is_listed_in_marketplace
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {marketplaceListing?.is_listed_in_marketplace ? "Приховати" : "Показати"}
                </button>
              </div>
            </div>

            {/* Service Offers */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Тарифні пакети
                </h3>
                <button
                  onClick={() => setShowOfferModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  + Додати пакет
                </button>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {marketplaceOffers.map((offer) => (
                  <div key={offer.id} className="p-6 flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white mb-1">
                        {offer.title}
                      </h4>
                      {offer.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          {offer.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-lg font-bold text-indigo-600">
                          {offer.price.toLocaleString('uk-UA')} грн
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {offer.target_type === 'fop' ? 'ФОП' : offer.target_type === 'tov' ? 'ТОВ' : 'ОСББ'}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          offer.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"
                        }`}>
                          {offer.is_active ? "Активний" : "Неактивний"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteOffer(offer.id)}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                    >
                      Видалити
                    </button>
                  </div>
                ))}
                {marketplaceOffers.length === 0 && (
                  <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                    Немає тарифних пакетів. Додайте перший пакет.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {activeTab === "staff" ? "Додати бухгалтера" : "Додати клієнта"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  placeholder={activeTab === "staff" ? "accountant@example.com" : "client@example.com"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Телефон (необов'язково)
                </label>
                <input
                  type="tel"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  placeholder="+380 50 123 4567"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={activeTab === "staff" ? handleInviteAccountant : handleInviteClient}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                {activeTab === "staff" ? "Надіслати запрошення" : "Додати клієнта"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Додати тарифний пакет
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Назва
                </label>
                <input
                  type="text"
                  value={newOffer.title}
                  onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  placeholder="Базовий пакет для ФОП"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Опис
                </label>
                <textarea
                  value={newOffer.description}
                  onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  placeholder="Опис послуг..."
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ціна (грн)
                </label>
                <input
                  type="number"
                  value={newOffer.price}
                  onChange={(e) => setNewOffer({ ...newOffer, price: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                  placeholder="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Тип клієнта
                </label>
                <select
                  value={newOffer.target_type}
                  onChange={(e) => setNewOffer({ ...newOffer, target_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                >
                  <option value="fop">ФОП</option>
                  <option value="tov">ТОВ</option>
                  <option value="osbb">ОСББ</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowOfferModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={handleCreateOffer}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Додати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
