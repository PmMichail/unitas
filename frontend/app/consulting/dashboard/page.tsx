"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

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

  // New state variables for documents and online agreements
  const [agreements, setAgreements] = useState<Record<string, any>>({});
  const [expandedStaffDocs, setExpandedStaffDocs] = useState<Record<number, boolean>>({});
  const [staffDocs, setStaffDocs] = useState<Record<number, any[]>>({});
  const [uploadingDocType, setUploadingDocType] = useState<Record<number, string>>({});
  const [uploadingDocName, setUploadingDocName] = useState<Record<number, string>>({});

  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementModalType, setAgreementModalType] = useState<"company_client" | "company_accountant" | null>(null);
  const [agreementModalPartyId, setAgreementModalPartyId] = useState<number | null>(null);
  const [agreementModalText, setAgreementModalText] = useState("");
  const [agreementModalStatus, setAgreementModalStatus] = useState("pending");
  const [signConsentChecked, setSignConsentChecked] = useState(false);

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
      const response = await axios.get(`${API_BASE_URL}/api/auth/user-by-telegram?telegram_id=${telegramId}`);
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
      const response = await axios.post(`${API_BASE_URL}/api/consulting/seed-test-data`);
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

  const handleSetupCompany = async () => {
    setIsSeeding(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/consulting/setup-company?user_id=${currentUserId || 1}`);
      console.log("Company setup:", response.data);
      alert("Консалтинг компанія успішно налаштована!");
      // Refresh dashboard data
      if (currentUserId) {
        fetchDashboardData(currentUserId);
      }
    } catch (error) {
      console.error("Failed to setup company:", error);
      alert("Помилка при налаштуванні компанії");
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
      const response = await axios.get<DashboardData>(`${API_BASE_URL}/api/consulting/dashboard?user_id=${userId}`);
      setDashboardData(response.data);
      setIsOwner(response.data.user_role === "owner");
      if (response.data.clients) {
        fetchClientAgreements(response.data.clients, userId);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffData = async () => {
    try {
      if (!currentUserId) return;
      const response = await axios.get<{ team: StaffMember[] }>(`${API_BASE_URL}/api/consulting/team?user_id=${currentUserId}`);
      setStaffData(response.data.team);
      if (response.data.team) {
        fetchStaffAgreements(response.data.team, currentUserId);
      }
    } catch (error) {
      console.error("Failed to fetch staff data:", error);
    }
  };

  const fetchClientAgreements = async (clients: ClientData[], userId: number) => {
    try {
      const agreementsMap: Record<string, any> = {};
      await Promise.all(
        clients.map(async (client) => {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/consulting/agreements?party_id=${client.profile_id}&agreement_type=company_client&user_id=${userId}`);
            agreementsMap[`company_client_${client.profile_id}`] = res.data;
          } catch (e) {
            console.error(e);
          }
        })
      );
      setAgreements((prev) => ({ ...prev, ...agreementsMap }));
    } catch (error) {
      console.error("Failed to fetch client agreements:", error);
    }
  };

  const fetchStaffAgreements = async (staff: StaffMember[], userId: number) => {
    try {
      const agreementsMap: Record<string, any> = {};
      await Promise.all(
        staff.map(async (member) => {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/consulting/agreements?party_id=${member.user_id}&agreement_type=company_accountant&user_id=${userId}`);
            agreementsMap[`company_accountant_${member.user_id}`] = res.data;
          } catch (e) {
            console.error(e);
          }
        })
      );
      setAgreements((prev) => ({ ...prev, ...agreementsMap }));
    } catch (error) {
      console.error("Failed to fetch staff agreements:", error);
    }
  };

  const toggleStaffDocs = async (staffId: number) => {
    const isExpanded = !expandedStaffDocs[staffId];
    setExpandedStaffDocs((prev) => ({ ...prev, [staffId]: isExpanded }));
    
    if (isExpanded) {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/consulting/accountant/documents?accountant_id=${staffId}&user_id=${currentUserId}`);
        setStaffDocs((prev) => ({ ...prev, [staffId]: response.data.documents }));
      } catch (error) {
        console.error("Failed to fetch staff documents:", error);
      }
    }
  };

  const handleUploadDocument = async (staffId: number) => {
    const docType = uploadingDocType[staffId] || "diploma";
    const docName = uploadingDocName[staffId];
    if (!docName) {
      alert("Введіть назву документа");
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append("accountant_id", staffId.toString());
      formData.append("document_type", docType);
      formData.append("document_name", docName);
      
      await axios.post(`${API_BASE_URL}/api/consulting/accountant/documents?user_id=${currentUserId}`, formData);
      setUploadingDocName((prev) => ({ ...prev, [staffId]: "" }));
      
      const response = await axios.get(`${API_BASE_URL}/api/consulting/accountant/documents?accountant_id=${staffId}&user_id=${currentUserId}`);
      setStaffDocs((prev) => ({ ...prev, [staffId]: response.data.documents }));
      alert("Документ додано успішно!");
    } catch (error) {
      console.error("Failed to upload document:", error);
      alert("Помилка завантаження документа");
    }
  };

  const handleDeleteDocument = async (staffId: number, docId: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цей документ?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/consulting/accountant/documents/${docId}?user_id=${currentUserId}`);
      const response = await axios.get(`${API_BASE_URL}/api/consulting/accountant/documents?accountant_id=${staffId}&user_id=${currentUserId}`);
      setStaffDocs((prev) => ({ ...prev, [staffId]: response.data.documents }));
    } catch (error) {
      console.error("Failed to delete document:", error);
      alert("Помилка видалення документа");
    }
  };

  const openAgreementModal = async (partyId: number, type: "company_client" | "company_accountant") => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/consulting/agreements?party_id=${partyId}&agreement_type=${type}&user_id=${currentUserId}`);
      setAgreementModalType(type);
      setAgreementModalPartyId(partyId);
      setAgreementModalText(res.data.contract_text);
      setAgreementModalStatus(res.data.status);
      setSignConsentChecked(false);
      setShowAgreementModal(true);
    } catch (error) {
      console.error("Failed to load agreement:", error);
      alert("Помилка завантаження договору");
    }
  };

  const handleSignAgreement = async () => {
    if (!signConsentChecked) {
      alert("Будь ласка, поставте прапорець згоди перед підписанням");
      return;
    }
    if (!agreementModalPartyId || !agreementModalType) return;
    
    try {
      const formData = new FormData();
      formData.append("party_id", agreementModalPartyId.toString());
      formData.append("agreement_type", agreementModalType);
      
      const res = await axios.post(`${API_BASE_URL}/api/consulting/agreements/sign?user_id=${currentUserId}`, formData);
      const key = `${agreementModalType}_${agreementModalPartyId}`;
      setAgreements((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          status: "signed",
          signed_at: res.data.signed_at
        }
      }));
      setShowAgreementModal(false);
      setSignConsentChecked(false);
      alert("Договір успішно підписано онлайн!");
    } catch (error) {
      console.error("Failed to sign agreement:", error);
      alert("Помилка підписання договору");
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
      const userId = currentUserId || 1;
      const formData = new FormData();
      formData.append("email", inviteEmail);
      if (invitePhone) formData.append("phone", invitePhone);
      
      await axios.post(`${API_BASE_URL}/api/consulting/add-team-member?user_id=${userId}`, formData);
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
      const response = await axios.get(`${API_BASE_URL}/api/consulting/billing?user_id=${currentUserId}`);
      setBillingData(response.data);
    } catch (error) {
      console.error("Failed to fetch billing data:", error);
    }
  };

  const fetchMarketplaceData = async () => {
    try {
      if (!currentUserId) return;
      const [offersRes, userRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/consulting/marketplace/offers?user_id=${currentUserId}`),
        axios.get(`${API_BASE_URL}/api/consulting/dashboard?user_id=${currentUserId}`)
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
      
      await axios.post(`${API_BASE_URL}/api/consulting/marketplace/offers?user_id=${currentUserId}`, formData);
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
      
      await axios.put(`${API_BASE_URL}/api/consulting/marketplace/listing?user_id=${currentUserId}`, formData);
      fetchMarketplaceData();
    } catch (error) {
      console.error("Failed to toggle listing:", error);
    }
  };

  const handleDeleteOffer = async (offerId: number) => {
    try {
      if (!currentUserId) return;
      await axios.delete(`${API_BASE_URL}/api/consulting/marketplace/offers/${offerId}?user_id=${currentUserId}`);
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
                {dashboardData?.consulting_company.name || "Консалтинг Компанія"} • {dashboardData?.total_clients || 0} клієнтів
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-slate-500 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors"
              >
                ← Повернутися в дашборд
              </Link>
              <button
                onClick={handleSetupCompany}
                disabled={isSeeding}
                className="px-4 py-2 border border-violet-600 text-violet-600 dark:text-violet-400 rounded-lg font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50"
              >
                {isSeeding ? "Налаштування..." : "Налаштувати компанію"}
              </button>
              {isOwner && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  + Додати клієнта
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="inline-flex bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm border border-orange-500/20">
            <button
              onClick={() => setActiveTab("clients")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "clients"
                  ? "bg-gradient-to-r from-violet-600 to-orange-500 text-white"
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
                    ? "bg-gradient-to-r from-violet-600 to-orange-500 text-white"
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
                    ? "bg-gradient-to-r from-violet-600 to-orange-500 text-white"
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
                    ? "bg-gradient-to-r from-violet-600 to-orange-500 text-white"
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
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-orange-500/20">
            {/* Search and Filters */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Пошук за назвою або ЄДРПОУ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                        ? "bg-violet-600 text-white"
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
                          ? "bg-violet-600 text-white"
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
                        ? "bg-violet-600 text-white"
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
                      Договір
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
                        {(() => {
                          const agreementKey = `company_client_${client.profile_id}`;
                          const agreement = agreements[agreementKey];
                          if (agreement && agreement.status === "signed") {
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                  Підписано
                                </span>
                                {agreement.signed_at && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {new Date(agreement.signed_at).toLocaleDateString("uk-UA")}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                Не підписано
                              </span>
                              <button
                                onClick={() => openAgreementModal(client.profile_id, "company_client")}
                                className="text-xs text-orange-500 hover:text-orange-600 font-medium underline text-left"
                              >
                                Переглянути й підписати
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleContextSwitch(client)}
                          className="px-4 py-2 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
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
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600 text-white rounded-lg font-medium transition-colors flex items-center"
              >
                <span className="mr-2">+</span> Додати бухгалтера
              </button>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {staffData.map((staff) => (
                <div key={staff.user_id} className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-orange-500/20">
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
                      <span className="text-lg font-bold text-violet-600 dark:text-violet-400">
                        {staff.assigned_clients_count}
                      </span>
                    </div>
                  </div>

                  {/* Partnership Agreement Block */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Договір з компанією
                      </span>
                      {(() => {
                        const agreementKey = `company_accountant_${staff.user_id}`;
                        const agreement = agreements[agreementKey];
                        if (agreement && agreement.status === "signed") {
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              Підписано
                            </span>
                          );
                        }
                        return (
                          <button
                            onClick={() => openAgreementModal(staff.user_id, "company_accountant")}
                            className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-medium rounded transition-colors"
                          >
                            Підписати угоду
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Documents Accordion */}
                  <button 
                    onClick={() => toggleStaffDocs(staff.user_id)}
                    className="w-full mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-between"
                  >
                    <span>Документи бухгалтера</span>
                    <span>{expandedStaffDocs[staff.user_id] ? "▲" : "▼"}</span>
                  </button>

                  {expandedStaffDocs[staff.user_id] && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
                      {/* Upload new document form */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Додати новий документ:</p>
                        <div className="flex gap-2">
                          <select
                            value={uploadingDocType[staff.user_id] || "diploma"}
                            onChange={(e) => setUploadingDocType({ ...uploadingDocType, [staff.user_id]: e.target.value })}
                            className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white"
                          >
                            <option value="diploma">Диплом</option>
                            <option value="license">Ліцензія</option>
                            <option value="experience">Досвід</option>
                            <option value="cv">Резюме</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Назва (напр. Диплом КНУ)"
                            value={uploadingDocName[staff.user_id] || ""}
                            onChange={(e) => setUploadingDocName({ ...uploadingDocName, [staff.user_id]: e.target.value })}
                            className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white flex-1"
                          />
                          <button
                            onClick={() => handleUploadDocument(staff.user_id)}
                            className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded transition-colors"
                          >
                            Додати
                          </button>
                        </div>
                      </div>

                      {/* Documents List */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Завантажені документи:</p>
                        {staffDocs[staff.user_id] && staffDocs[staff.user_id].length > 0 ? (
                          <div className="divide-y divide-slate-200 dark:divide-slate-700">
                            {staffDocs[staff.user_id].map((doc) => (
                              <div key={doc.id} className="py-2 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                                <div>
                                  <span className="font-semibold capitalize text-indigo-600 dark:text-indigo-400 mr-1.5">
                                    {doc.document_type === "diploma" ? "Диплом" : doc.document_type === "license" ? "Ліцензія" : doc.document_type === "experience" ? "Досвід" : "Резюме"}:
                                  </span>
                                  <span>{doc.document_name}</span>
                                </div>
                                <div className="flex gap-2">
                                  <a
                                    href={`${API_BASE_URL}${doc.file_url}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-orange-500 hover:text-orange-600 underline font-medium"
                                  >
                                    Скачати
                                  </a>
                                  <button
                                    onClick={() => handleDeleteDocument(staff.user_id, doc.id)}
                                    className="text-red-500 hover:text-red-600 font-medium"
                                  >
                                    Видалити
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic">Немає завантажених документів</p>
                        )}
                      </div>
                    </div>
                  )}
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
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-orange-500/20 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Білінг та Ліцензії
            </h2>
            
            {billingData ? (
              <div className="space-y-6">
                {/* Slots Usage */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-orange-500/10">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                    Використання слотів
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Всього клієнтів на обслуговуванні
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {billingData.usage.total_clients}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Безкоштовні слоти (кожен 10-й безкоштовно)
                      </span>
                      <span className="font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-2.5 py-0.5 rounded-full">
                        {billingData.usage.free_slots_used}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Платні слоти
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {billingData.usage.paid_slots}
                      </span>
                    </div>
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
                className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600 text-white rounded-lg font-medium transition-colors"
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
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4 border border-orange-500/20 shadow-lg">
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
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
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
                className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600 text-white rounded-lg font-medium transition-colors"
              >
                Додати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agreement Modal */}
      {showAgreementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl mx-4 border border-orange-500/30 shadow-xl max-h-[85vh] flex flex-col">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {agreementModalType === "company_client" ? "Електронний договір з клієнтом" : "Угода про партнерство з бухгалтером"}
            </h3>
            
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-orange-500/20 text-sm text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap mb-4">
              {agreementModalText}
            </div>

            {agreementModalStatus === "signed" ? (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 rounded-lg text-center font-medium mb-4">
                Цей договір вже підписано електронним підписом.
              </div>
            ) : (
              <div className="space-y-4 mb-4">
                <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={signConsentChecked}
                    onChange={(e) => setSignConsentChecked(e.target.checked)}
                    className="mt-1 rounded border-slate-300 dark:border-slate-600 text-orange-600 focus:ring-orange-500"
                  />
                  <span>
                    Я підтверджую та заявляю, що повністю ознайомлений(а) з умовами договору і висловлюю свою повну згоду на його підписання в електронній формі.
                  </span>
                </label>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowAgreementModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Закрити
              </button>
              {agreementModalStatus !== "signed" && (
                <button
                  onClick={handleSignAgreement}
                  className="px-6 py-2 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  Підписати договір
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
