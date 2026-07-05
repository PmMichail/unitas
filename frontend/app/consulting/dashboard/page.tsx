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
  assignment_id?: number;
  is_suspended?: boolean;
}

interface DashboardData {
  consulting_company: {
    id: number;
    name: string;
    free_slots: number;
    partner_discount: number;
    owner_email: string | null;
    description?: string;
  };
  user_role: string;
  clients: ClientData[];
  total_clients: number;
  needs_attention_count: number;
  is_listed_in_marketplace: boolean;
}

interface StaffMember {
  user_id: number;
  email: string;
  phone: string | null;
  role: string;
  language: string;
  assigned_clients_count: number;
  is_active: boolean;
  rating?: number;
  specialization?: string;
}

type ConsultingTab = "clients" | "staff" | "billing" | "marketplace" | "chats" | "requests";

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
  const [inviteName, setInviteName] = useState("");
  const [billingData, setBillingData] = useState<any>(null);
  const [marketplaceOffers, setMarketplaceOffers] = useState<any[]>([]);
  const [marketplaceListing, setMarketplaceListing] = useState<any>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [newOffer, setNewOffer] = useState({ title: "", description: "", price: "", target_type: "fop" });
  const [editingOfferId, setEditingOfferId] = useState<number | null>(null);
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
  const [specializationDrafts, setSpecializationDrafts] = useState<Record<number, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<number, File | null>>({});
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsFreeSlots, setSettingsFreeSlots] = useState(3);
  const [settingsDiscount, setSettingsDiscount] = useState(30.0);
  const [settingsDescription, setSettingsDescription] = useState("");
  
  // Card payment modal states
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");

  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementModalType, setAgreementModalType] = useState<"company_client" | "company_accountant" | null>(null);
  const [agreementModalPartyId, setAgreementModalPartyId] = useState<number | null>(null);
  const [agreementModalText, setAgreementModalText] = useState("");
  const [agreementModalStatus, setAgreementModalStatus] = useState("pending");
  const [signConsentChecked, setSignConsentChecked] = useState(false);

  // Chat / communication states
  const [chatsList, setChatsList] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Marketplace incoming requests states
  const [marketplaceRequests, setMarketplaceRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestAccountants, setRequestAccountants] = useState<Record<number, string>>({});

  useEffect(() => {
    if (activeTab === "chats") {
      fetchChatsList();
    }
  }, [activeTab, dashboardData, currentUserId]);

  useEffect(() => {
    let interval: any;
    if (activeTab === "chats" && selectedChatId) {
      fetchChatMessages(selectedChatId);
      interval = setInterval(() => {
        fetchChatMessages(selectedChatId);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, selectedChatId, dashboardData, currentUserId]);

  useEffect(() => {
    if (isOwner && currentUserId) {
      fetchMarketplaceRequests();
    }
  }, [isOwner, currentUserId]);

  const fetchMarketplaceRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/consulting/marketplace/requests`, {
        params: { user_id: currentUserId }
      });
      setMarketplaceRequests(res.data.requests);
    } catch (e) {
      console.error("Failed to fetch marketplace requests:", e);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveRequest = async (orderId: number, confirmedAccountantId: number | null) => {
    try {
      await axios.post(`${API_BASE_URL}/api/consulting/marketplace/requests/${orderId}/approve?user_id=${currentUserId}`, {
        confirmed_accountant_id: confirmedAccountantId
      });
      alert("Запит успішно підтверджено! Клієнту виставлено рахунок.");
      fetchMarketplaceRequests();
      if (currentUserId) {
        fetchDashboardData(currentUserId);
      }
    } catch (e) {
      console.error("Failed to approve marketplace request:", e);
      alert("Не вдалося підтвердити запит");
    }
  };

  const fetchChatsList = async () => {
    if (!dashboardData || !currentUserId) return;
    try {
      const isCompanyRoom = dashboardData.user_role === "owner";
      const roomType = isCompanyRoom ? "client_company" : "client_accountant";
      const recipientId = isCompanyRoom ? dashboardData.consulting_company.id : currentUserId;

      const res = await axios.get(`${API_BASE_URL}/api/support/partner/chats`, {
        params: {
          room_type: roomType,
          recipient_id: recipientId
        }
      });
      
      if (dashboardData.clients) {
        const clientMap = new Map(dashboardData.clients.map(c => [c.profile_id, c.name]));
        
        // Filter chats to only include our clients
        const activeChats = res.data.filter((chat: any) => clientMap.has(chat.profile_id));
        const activeIds = new Set(activeChats.map((c: any) => c.profile_id));
        
        // Add empty chats for other clients so accountant can start chat with them
        const allChats = [...activeChats];
        for (const client of dashboardData.clients) {
          if (!activeIds.has(client.profile_id)) {
            allChats.push({
              profile_id: client.profile_id,
              profile_name: client.name,
              last_message_text: "Немає повідомлень",
              last_message_time: null,
              last_message_from_admin: false
            });
          }
        }
        setChatsList(allChats);
      } else {
        setChatsList([]);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    }
  };

  const fetchChatMessages = async (profileId: number) => {
    if (!dashboardData || !currentUserId) return;
    try {
      const isCompanyRoom = dashboardData.user_role === "owner";
      const roomType = isCompanyRoom ? "client_company" : "client_accountant";
      const recipientId = isCompanyRoom ? dashboardData.consulting_company.id : currentUserId;

      const res = await axios.get(`${API_BASE_URL}/api/support/messages/${profileId}`, {
        params: {
          room_type: roomType,
          recipient_id: recipientId
        }
      });
      setChatMessages(res.data);
    } catch (err) {
      console.error("Failed to fetch chat messages:", err);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChatId || !dashboardData || !currentUserId) return;
    setSendingReply(true);
    try {
      const isCompanyRoom = dashboardData.user_role === "owner";
      const roomType = isCompanyRoom ? "client_company" : "client_accountant";
      const recipientId = isCompanyRoom ? dashboardData.consulting_company.id : currentUserId;

      await axios.post(`${API_BASE_URL}/api/support/reply`, {
        profile_id: selectedChatId,
        text: replyText.trim(),
        room_type: roomType,
        recipient_id: recipientId
      });
      setReplyText("");
      fetchChatMessages(selectedChatId);
      fetchChatsList();
    } catch (err) {
      console.error("Failed to send reply:", err);
      alert("Не вдалося надіслати повідомлення");
    } finally {
      setSendingReply(false);
    }
  };

  useEffect(() => {
    fetchCurrentUserId();
  }, []);

  const fetchCurrentUserId = async () => {
    try {
      const telegramId = localStorage.getItem("telegram_id");
      if (!telegramId) {
        console.warn("No telegram_id found in localStorage, fallback to user_id=1");
        setCurrentUserId(1);
        fetchDashboardData(1);
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





  const openSettingsModal = () => {
    if (dashboardData?.consulting_company) {
      setSettingsName(dashboardData.consulting_company.name);
      setSettingsFreeSlots(dashboardData.consulting_company.free_slots);
      setSettingsDiscount(dashboardData.consulting_company.partner_discount);
      setSettingsDescription(dashboardData.consulting_company.description || "");
      setShowSettingsModal(true);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const formData = new FormData();
      formData.append("company_name", settingsName);
      formData.append("description", settingsDescription);
      
      await axios.put(`${API_BASE_URL}/api/consulting/update-company?user_id=${currentUserId || 1}`, formData);
      alert("Налаштування компанії успішно оновлено!");
      setShowSettingsModal(false);
      if (currentUserId) {
        fetchDashboardData(currentUserId);
      }
    } catch (error) {
      console.error("Failed to update company settings:", error);
      alert("Помилка при оновленні налаштувань");
    }
  };

  const handleInviteClient = async () => {
    try {
      if (!inviteEmail) {
        alert("Введіть email клієнта");
        return;
      }
      if (!inviteName) {
        alert("Введіть ім'я клієнта (ФОП / Назва)");
        return;
      }
      const formData = new FormData();
      formData.append("email", inviteEmail);
      if (invitePhone) formData.append("phone", invitePhone);
      formData.append("client_name", inviteName);
      
      await axios.post(`${API_BASE_URL}/api/consulting/invite-client?user_id=${currentUserId || 1}`, formData);
      alert(`Запрошення та лист підтвердження надіслано на ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail("");
      setInvitePhone("");
      setInviteName("");
      if (currentUserId) {
        fetchDashboardData(currentUserId);
      }
    } catch (error) {
      console.error("Failed to invite client:", error);
      alert("Помилка при відправці запрошення");
    }
  };

  const fetchDashboardData = async (userId: number) => {
    try {
      const response = await axios.get<DashboardData>(`${API_BASE_URL}/api/consulting/dashboard?user_id=${userId}`);
      setDashboardData(response.data);
      const userIsOwner = response.data.user_role === "owner";
      setIsOwner(userIsOwner);
      if (response.data.clients) {
        fetchClientAgreements(response.data.clients, userId);
      }
      if (userIsOwner) {
        const staffRes = await axios.get<{ team: StaffMember[] }>(`${API_BASE_URL}/api/consulting/team?user_id=${userId}`);
        setStaffData(staffRes.data.team || []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAccountant = async (profileId: number, accountantId: number | null) => {
    try {
      const userId = currentUserId || 1;
      await axios.post(`${API_BASE_URL}/api/consulting/assign-accountant?profile_id=${profileId}&accountant_id=${accountantId || 0}&user_id=${userId}`);
      alert("Бухгалтера успішно призначено клієнту!");
      fetchDashboardData(userId);
    } catch (error) {
      console.error("Failed to assign accountant:", error);
      alert("Помилка при призначенні бухгалтера");
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
    const file = selectedFiles[staffId];
    if (!docName) {
      alert("Введіть назву документа");
      return;
    }
    if (!file) {
      alert("Виберіть файл для завантаження");
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append("accountant_id", staffId.toString());
      formData.append("document_type", docType);
      formData.append("document_name", docName);
      formData.append("file", file);
      
      await axios.post(`${API_BASE_URL}/api/consulting/accountant/documents?user_id=${currentUserId}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      setUploadingDocName((prev) => ({ ...prev, [staffId]: "" }));
      setSelectedFiles((prev) => ({ ...prev, [staffId]: null }));
      
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
      
      // Refresh team and dashboard data
      fetchStaffData();
      if (currentUserId) {
        fetchDashboardData(currentUserId);
      }
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
    window.location.href = "/dashboard";
  };

  const handleSendClientInvoice = async (profileId: number) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/consulting/clients/${profileId}/send-invoice?user_id=${currentUserId || 1}`);
      alert(`Рахунок № ${res.data.invoice_number} на суму ${res.data.amount} грн успішно виставлено та відправлено клієнту на email!`);
    } catch (error: any) {
      console.error("Failed to send client invoice:", error);
      alert(error.response?.data?.detail || "Помилка при виставленні рахунку клієнту");
    }
  };

  const handleDeleteClient = async (assignmentId: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цього клієнта та припинити обслуговування?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/consulting/clients/${assignmentId}?user_id=${currentUserId || 1}`);
      alert("Клієнта успішно видалено з консалтингової компанії!");
      if (currentUserId) fetchDashboardData(currentUserId);
    } catch (error) {
      console.error("Failed to delete client:", error);
      alert("Помилка при видаленні клієнта");
    }
  };

  const handleSaveSpecialization = async (memberId: number, specialization: string) => {
    try {
      const formData = new FormData();
      formData.append("specialization", specialization);
      await axios.post(`${API_BASE_URL}/api/consulting/team/${memberId}/specialization?user_id=${currentUserId || 1}`, formData);
      fetchStaffData();
    } catch (error) {
      console.error("Failed to update specialization:", error);
      alert("Не вдалося зберегти напрямок спеціалізації");
    }
  };

  const handleRemoveTeamMember = async (memberId: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цього бухгалтера з команди?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/consulting/team-members/${memberId}?user_id=${currentUserId || 1}`);
      alert("Бухгалтера видалено з команди!");
      fetchStaffData();
    } catch (error) {
      console.error("Failed to remove team member:", error);
      alert("Помилка видалення члена команди");
    }
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



  const handleSaveCard = async () => {
    try {
      if (!cardNumber || !expiryMonth || !expiryYear || !cvv) {
        alert("Будь ласка, заповніть всі поля");
        return;
      }
      const formData = new FormData();
      formData.append("card_number", cardNumber);
      formData.append("expiry_month", expiryMonth);
      formData.append("expiry_year", expiryYear);
      formData.append("cvv", cvv);
      
      await axios.post(`${API_BASE_URL}/api/consulting/billing/card?user_id=${currentUserId || 1}`, formData);
      alert("Картку успішно прив'язано!");
      setShowCardModal(false);
      setCardNumber("");
      setExpiryMonth("");
      setExpiryYear("");
      setCvv("");
      fetchBillingData();
    } catch (error: any) {
      console.error("Failed to save card:", error);
      alert(error.response?.data?.detail || "Помилка при збереженні картки");
    }
  };

  const handleToggleSuspension = async (assignmentId: number, currentSuspended: boolean) => {
    try {
      const action = currentSuspended ? "unfreeze" : "freeze";
      if (!confirm(`Ви впевнені, що хочете ${action === "freeze" ? "заморозити" : "відновити"} обслуговування цього клієнта?`)) {
        return;
      }
      
      await axios.put(`${API_BASE_URL}/api/consulting/billing/suspension?assignment_id=${assignmentId}&is_suspended=${!currentSuspended}&user_id=${currentUserId || 1}`);
      alert(currentSuspended ? "Обслуговування відновлено!" : "Клієнта успішно заморожено!");
      fetchBillingData();
      if (currentUserId) {
        fetchDashboardData(currentUserId);
      }
    } catch (error) {
      console.error("Failed to toggle suspension:", error);
      alert("Помилка при зміні статусу обслуговування");
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
      alert("Помилка при створенні тарифу");
    }
  };

  const handleEditOffer = (offer: any) => {
    setEditingOfferId(offer.id);
    setNewOffer({
      title: offer.title,
      description: offer.description || "",
      price: String(offer.price),
      target_type: offer.target_type
    });
    setShowOfferModal(true);
  };

  const handleUpdateOffer = async () => {
    if (!editingOfferId || !currentUserId) return;
    try {
      const formData = new FormData();
      formData.append("title_uk", newOffer.title);
      formData.append("description_uk", newOffer.description);
      formData.append("price_uah", newOffer.price);
      formData.append("target_type", newOffer.target_type);
      
      await axios.put(`${API_BASE_URL}/api/consulting/marketplace/offers/${editingOfferId}?user_id=${currentUserId}`, formData);
      setShowOfferModal(false);
      setEditingOfferId(null);
      setNewOffer({ title: "", description: "", price: "", target_type: "fop" });
      fetchMarketplaceData();
    } catch (error) {
      console.error("Failed to update offer:", error);
      alert("Помилка при оновленні тарифу");
    }
  };

  const openCreateOfferModal = () => {
    setEditingOfferId(null);
    setNewOffer({ title: "", description: "", price: "", target_type: "fop" });
    setShowOfferModal(true);
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

  const pendingRequestsCount = marketplaceRequests.filter(r => r.status === "requested").length;

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
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow-lg flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-medium">
              Ви працюєте в кабінеті клієнта: <strong>{selectedProfileName}</strong>
            </span>
            <div className="flex gap-2 flex-wrap">
              <Link
                href="/dashboard"
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Дашборд
              </Link>
              <Link
                href="/transactions"
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Транзакції
              </Link>
              <Link
                href={`/profiles/${selectedProfileId}/employees`}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Працівники
              </Link>
              <Link
                href="/settings/banks"
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Банк та виписки
              </Link>
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
            className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors shrink-0"
          >
            Повернутися в панель консалтингу
          </button>
        </div>
      )}

      {/* Background Decorative Blur Globs */}
      <div className="absolute top-0 left-1/4 w-80 h-80 bg-violet-600/5 dark:bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-80 h-80 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Header */}
        <div className="mb-8 p-6 bg-white/60 dark:bg-slate-950/30 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/60 rounded-3xl shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider">Кабінет Управління</span>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                Кабінет Партнера
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                <span className="text-slate-800 dark:text-slate-200 font-bold">
                  {dashboardData?.consulting_company.name || "Консалтинг Компанія"}
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span>{dashboardData?.total_clients || 0} клієнтів на обслуговуванні</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-800"
              >
                <span>← Повернутися в дашборд</span>
              </Link>
              <button
                onClick={openSettingsModal}
                disabled={isSeeding}
                className="px-4 py-2.5 border border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/20 text-violet-600 dark:text-violet-450 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Умови співпраці
              </button>
              {isOwner && activeTab === "clients" && (
                <button
                  onClick={() => {
                    setInviteEmail("");
                    setInvitePhone("");
                    setShowInviteModal(true);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-500 hover:to-orange-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-violet-600/10 hover:shadow-violet-600/20 transition-all flex items-center gap-1"
                >
                  <span>+ Додати клієнта</span>
                </button>
              )}
              {isOwner && activeTab === "staff" && (
                <button
                  onClick={() => {
                    setInviteEmail("");
                    setInvitePhone("");
                    setShowInviteModal(true);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-500 hover:to-orange-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-violet-600/10 hover:shadow-violet-600/20 transition-all flex items-center gap-1"
                >
                  <span>+ Додати бухгалтера</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="inline-flex bg-slate-100/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-1.5 border border-slate-200/50 dark:border-slate-800/80 shadow-inner">
            <button
              onClick={() => setActiveTab("clients")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "clients"
                  ? "bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-400 shadow-md shadow-slate-200/50 dark:shadow-none border border-slate-200/40 dark:border-slate-750"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Матриця клієнтів
            </button>
            {isOwner && (
              <button
                onClick={() => setActiveTab("staff")}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "staff"
                    ? "bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-400 shadow-md shadow-slate-200/50 dark:shadow-none border border-slate-200/40 dark:border-slate-750"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Управління командою
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setActiveTab("billing")}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "billing"
                    ? "bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-400 shadow-md shadow-slate-200/50 dark:shadow-none border border-slate-200/40 dark:border-slate-750"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Білінг та Ліцензії
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setActiveTab("marketplace")}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "marketplace"
                    ? "bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-400 shadow-md shadow-slate-200/50 dark:shadow-none border border-slate-200/40 dark:border-slate-750"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Мій Маркетплейс
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setActiveTab("requests")}
                className={`relative px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "requests"
                    ? "bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-400 shadow-md shadow-slate-200/50 dark:shadow-none border border-slate-200/40 dark:border-slate-750"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Вхідні запити
                {pendingRequestsCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded-full border border-white dark:border-slate-900 animate-bounce">
                    {pendingRequestsCount}
                  </span>
                )}
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
                        {isOwner ? (
                          <select
                            value={client.accountant?.id || ""}
                            onChange={(e) => handleAssignAccountant(client.profile_id, parseInt(e.target.value) || null)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-xl px-2 py-1.5 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                          >
                            <option value="">Не призначено</option>
                            {staffData.map((staff) => (
                              <option key={staff.user_id} value={staff.user_id}>
                                {staff.email}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-sm text-slate-700 dark:text-slate-300">
                            {client.accountant ? client.accountant.name : "Не призначено"}
                          </div>
                        )}
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleContextSwitch(client)}
                            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            Увійти в кабінет
                          </button>
                          {isOwner && (
                            <button
                              onClick={() => handleDeleteClient(client.profile_id)}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-700 rounded-lg transition-colors"
                              title="Видалити клієнта"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
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
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        staff.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"
                      }`}>
                        {staff.is_active ? "Активний" : "Неактивний"}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => handleRemoveTeamMember(staff.user_id)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-700 rounded transition-colors"
                          title="Видалити бухгалтера"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
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

                  {/* Rating (visible to client on the marketplace) */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Рейтинг на маркетплейсі
                      </span>
                      <span className="flex items-center gap-1 text-amber-500 font-semibold text-sm">
                        ★ {(staff.rating ?? 5.0).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Specialization editor */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      Напрямок / спеціалізація
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="напр. ФОП 3 група, ЗЕД, зарплата"
                        value={specializationDrafts[staff.user_id] ?? staff.specialization ?? ""}
                        onChange={(e) => setSpecializationDrafts({ ...specializationDrafts, [staff.user_id]: e.target.value })}
                        className="flex-1 text-xs px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white"
                      />
                      <button
                        onClick={() => handleSaveSpecialization(staff.user_id, specializationDrafts[staff.user_id] ?? staff.specialization ?? "")}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded transition-colors"
                      >
                        Зберегти
                      </button>
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

                  {/* Remove Accountant Button */}
                  {staff.user_id !== currentUserId && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4 flex justify-end">
                      <button
                        onClick={() => handleRemoveTeamMember(staff.user_id)}
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800/60 transition-colors"
                      >
                        Видалити з команди
                      </button>
                    </div>
                  )}

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
                        <div className="flex flex-col gap-2">
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
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="file"
                              onChange={(e) => setSelectedFiles({ ...selectedFiles, [staff.user_id]: e.target.files?.[0] || null })}
                              className="text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                            />
                            <button
                              onClick={() => handleUploadDocument(staff.user_id)}
                              className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded transition-colors"
                            >
                              Додати
                            </button>
                          </div>
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
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-orange-500/20 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Білінг та Ліцензії
              </h2>
              <button
                onClick={openSettingsModal}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-750 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold transition"
              >
                Умови співпраці
              </button>
            </div>
            
            {billingData ? (
              <div className="space-y-6">
                
                {/* Summary Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Total clients */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-850">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Всього клієнтів</span>
                    <span className="text-3xl font-black text-slate-850 dark:text-white mt-2 block">
                      {billingData.summary.total_clients}
                    </span>
                  </div>
                  {/* Active clients */}
                  <div className="p-5 bg-emerald-50/15 dark:bg-emerald-950/10 rounded-xl border border-emerald-500/10">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-450 font-bold uppercase tracking-wider block">Активні ліцензії</span>
                    <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-2 block">
                      {billingData.summary.active_clients || 0}
                    </span>
                  </div>
                  {/* Partner discount */}
                  <div className="p-5 bg-indigo-50/20 dark:bg-indigo-900/20 rounded-xl border border-indigo-200/20">
                    <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block">Партнерська знижка</span>
                    <span className="text-3xl font-black text-indigo-650 dark:text-indigo-455 mt-2 block">
                      {billingData.consulting_company.partner_discount}%
                    </span>
                  </div>
                  {/* Monthly Cost */}
                  <div className="p-5 bg-gradient-to-r from-violet-600/10 to-orange-500/10 rounded-xl border border-orange-500/20">
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider block">Наступне списання</span>
                    <span className="text-3xl font-black text-slate-850 dark:text-white mt-2 block">
                      {billingData.summary.monthly_cost.toLocaleString('uk-UA')} грн
                    </span>
                  </div>
                </div>

                {/* Billing Details breakdown */}
                <div className="p-6 bg-slate-55/30 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-850 space-y-4">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                    Деталізований розрахунок вартості
                  </h3>
                  
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          <th className="pb-3">Клієнт</th>
                          <th className="pb-3">ЄДРПОУ / РНОКПП</th>
                          <th className="pb-3">Тарифний план</th>
                          <th className="pb-3 text-right">Базова ціна</th>
                          <th className="pb-3 text-center">Знижка</th>
                          <th className="pb-3 text-center">Статус</th>
                          <th className="pb-3 text-right">Вартість</th>
                          <th className="pb-3 text-right">Дії</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-400">
                        {billingData.clients?.map((client: any, idx: number) => (
                          <tr key={client.profile_id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/20 ${client.is_suspended ? "opacity-60 bg-rose-50/5 dark:bg-rose-950/5" : ""}`}>
                            <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">
                              {client.client_name}
                            </td>
                            <td className="py-3 font-mono text-[11px]">
                              {client.tax_id || "—"}
                            </td>
                            <td className="py-3 font-medium text-indigo-650 dark:text-indigo-400">
                              {client.tariff_name}
                            </td>
                            <td className="py-3 text-right font-semibold">
                              {client.base_price} грн
                            </td>
                            <td className="py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                client.is_suspended
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
                                  : client.is_tenth 
                                    ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 border border-emerald-500/20"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}>
                                {client.is_suspended ? "—" : client.is_tenth ? "Кожен 10-й (-50%)" : `Партнерська (-${client.applied_discount_percentage}%)`}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                client.is_suspended
                                  ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-450 border border-rose-500/20"
                                  : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-750 dark:text-emerald-400 border border-emerald-500/20"
                              }`}>
                                {client.is_suspended ? "Заморожено" : "Активний"}
                              </span>
                            </td>
                            <td className="py-3 text-right font-black text-slate-800 dark:text-slate-200">
                              {client.final_price} грн
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => handleToggleSuspension(client.assignment_id, client.is_suspended)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                  client.is_suspended
                                    ? "bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 border-emerald-600/25"
                                    : "bg-rose-600/10 text-rose-600 hover:bg-rose-600/20 border-rose-600/25"
                                }`}
                              >
                                {client.is_suspended ? "Розморозити" : "Заморозити"}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!billingData.clients || billingData.clients.length === 0) && (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-500 font-semibold italic">
                              Немає підключених клієнтів для розрахунку.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Total breakdown info */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col items-end gap-2 text-xs">
                    <div className="flex justify-between w-64 text-slate-550">
                      <span>Сума без знижок:</span>
                      <span className="font-semibold">{billingData.summary.total_base_cost} грн</span>
                    </div>
                    <div className="flex justify-between w-64 text-emerald-600 dark:text-emerald-450 font-semibold">
                      <span>Загальна знижка:</span>
                      <span>-{billingData.summary.total_discount_amount} грн</span>
                    </div>
                    <div className="flex justify-between w-64 text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span>Разом до сплати:</span>
                      <span>{billingData.summary.monthly_cost} грн/міс</span>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-850">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                    Спосіб оплати
                  </h3>
                  
                  {billingData.consulting_company.has_card ? (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-650 text-white rounded-lg shadow-sm border border-slate-700 flex items-center justify-center font-bold text-xs uppercase tracking-widest min-w-[70px]">
                          {billingData.consulting_company.card_type}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                            {billingData.consulting_company.card_masked}
                          </span>
                          <span className="text-[10px] text-emerald-650 dark:text-emerald-450 block font-medium mt-0.5">
                            ✓ Автоматичне щомісячне списання активне
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowCardModal(true)}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:text-slate-950 dark:hover:text-white rounded-lg text-xs font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        Змінити картку
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-rose-500 font-semibold">
                        ⚠️ Немає прив'язаної платіжної картки для автоматичної оплати ліцензій. Будь ласка, додайте картку, щоб уникнути призупинення доступу до сервісу.
                      </p>
                      <button 
                        onClick={() => setShowCardModal(true)}
                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600 text-white rounded-xl font-bold transition-all shadow-md"
                      >
                        Прив'язати корпоративну картку
                      </button>
                    </div>
                  )}
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
          <div className="space-y-8 animate-fadeIn">
            {/* Listing Toggle (Premium Glassmorphic Banner) */}
            <div className="bg-white/60 dark:bg-slate-950/20 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/60 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className={`p-3.5 rounded-2xl ${
                  marketplaceListing?.is_listed_in_marketplace
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450"
                    : "bg-slate-500/10 text-slate-550 dark:text-slate-400"
                }`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Відображення в маркетплейсі
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Клієнти зможуть знаходити вашу компанію, переглядати пакети послуг та надсилати запити на співпрацю.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${marketplaceListing?.is_listed_in_marketplace ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {marketplaceListing?.is_listed_in_marketplace 
                        ? "Ваша компанія активна в каталозі послуг" 
                        : "Ваша компанія прихована з каталогу"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleToggleListing}
                className={`w-full md:w-auto px-6 py-3 rounded-xl text-xs font-bold transition-all ${
                  marketplaceListing?.is_listed_in_marketplace
                    ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 hover:bg-rose-100 dark:hover:bg-rose-900/30 border border-rose-200/50 dark:border-rose-800/40"
                    : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
                }`}
              >
                {marketplaceListing?.is_listed_in_marketplace ? "Призупинити показ" : "Опублікувати в Маркетплейсі"}
              </button>
            </div>

            {/* Service Offers Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Пакети Послуг & Пропозиції
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-405">
                    Створюйте та керуйте пакетами обслуговування, які відображатимуться на вашій сторінці.
                  </p>
                </div>
                <button
                  onClick={openCreateOfferModal}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-500 hover:to-orange-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-600/10 flex items-center gap-1"
                >
                  <span>+ Додати пакет</span>
                </button>
              </div>

              {marketplaceOffers.length === 0 ? (
                <div className="bg-white/40 dark:bg-slate-950/10 border border-slate-200/50 dark:border-slate-800/60 rounded-3xl p-12 text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-250">Немає тарифних пакетів</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Створіть свій перший тарифний пакет (наприклад, для ФОП чи ТОВ), щоб залучати нових клієнтів з маркетплейсу.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {marketplaceOffers.map((offer) => (
                    <div 
                      key={offer.id} 
                      className="bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/70 rounded-3xl p-6 hover:shadow-lg hover:shadow-slate-100 dark:hover:shadow-none hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Target badge & Active badge */}
                        <div className="flex items-center justify-between mb-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            offer.target_type === 'fop' 
                              ? "bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30" 
                              : offer.target_type === 'tov'
                              ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30"
                              : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30"
                          }`}>
                            {offer.target_type === 'fop' ? 'ФОП' : offer.target_type === 'tov' ? 'ТОВ' : 'ОСББ'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            offer.is_active 
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" 
                              : "bg-slate-105 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          }`}>
                            {offer.is_active ? "Активний" : "Неактивний"}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                          {offer.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 min-h-[48px]">
                          {offer.description || "Опис пакету послуг відсутній."}
                        </p>
                      </div>

                      {/* Pricing and Actions */}
                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-2xl font-black text-slate-900 dark:text-white">
                            {offer.price.toLocaleString('uk-UA')}
                          </span>
                          <span className="text-[10px] text-slate-450 dark:text-slate-400 ml-1">грн/міс</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditOffer(offer)}
                            className="px-3.5 py-1.5 text-indigo-500 hover:text-white hover:bg-indigo-500 border border-indigo-200/50 hover:border-transparent rounded-xl text-xs font-bold transition-all"
                          >
                            Редагувати
                          </button>
                          <button
                            onClick={() => handleDeleteOffer(offer.id)}
                            className="px-3.5 py-1.5 text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-200/50 hover:border-transparent rounded-xl text-xs font-bold transition-all"
                          >
                            Видалити
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "requests" && isOwner && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Вхідні запити від клієнтів
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-405 mt-1">
                Тут відображаються нові заявки від клієнтів з маркетплейсу. Будь ласка, призначте персонального бухгалтера для кожного запиту та підтвердіть співпрацю.
              </p>
            </div>

            {loadingRequests ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-650"></div>
                <p className="mt-2 text-xs text-slate-500">Завантаження запитів...</p>
              </div>
            ) : marketplaceRequests.filter(r => r.status === "requested").length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
                <div className="w-12 h-12 bg-slate-105 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-405">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-250">Немає нових запитів</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Усі вхідні запити оброблені. Нові запити від клієнтів з'являться тут автоматично.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {marketplaceRequests.filter(r => r.status === "requested").map((req) => {
                  const selectedAccId = requestAccountants[req.order_id] || "";
                  const activeAccountants = staffData.filter(s => s.is_active);

                  return (
                    <div 
                      key={req.order_id} 
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                    >
                      <div className="space-y-2.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-500/20">
                            Новий запит
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {new Date(req.created_at).toLocaleDateString('uk-UA')}
                          </span>
                        </div>
                        <h4 className="font-black text-slate-900 dark:text-white text-base">
                          {req.client_name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <div>
                            Тариф: <strong className="text-slate-700 dark:text-slate-300">"{req.offer_title}"</strong>
                          </div>
                          <div>
                            Вартість: <strong className="text-indigo-650 dark:text-indigo-400">{req.amount} грн/міс</strong>
                          </div>
                          {req.is_at_company_discretion ? (
                            <div className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 font-bold">
                              На розсуд компанії
                            </div>
                          ) : (
                            <div className="text-[10px] bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 rounded text-violet-600 dark:text-violet-400 font-bold border border-violet-100 dark:border-violet-900/30">
                              Бажаний бухгалтер: {req.requested_accountant?.email || "Не вказано"}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Accountant Assignment and Approve Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 min-w-[300px]">
                        <div className="flex-1">
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Призначити виконавця:
                          </label>
                          <select
                            value={selectedAccId}
                            onChange={(e) => setRequestAccountants(prev => ({ ...prev, [req.order_id]: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold"
                          >
                            <option value="">На розсуд компанії (без призначення)</option>
                            {activeAccountants.map((acc) => (
                              <option key={acc.user_id} value={acc.user_id}>
                                {acc.email} (клієнтів: {acc.assigned_clients_count})
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          onClick={() => handleApproveRequest(req.order_id, selectedAccId ? parseInt(selectedAccId) : null)}
                          className="px-5 py-3.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-650/10 flex items-center justify-center gap-1.5 self-end"
                        >
                          Підтвердити
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "chats" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-orange-500/20 overflow-hidden flex flex-col md:flex-row h-[600px]">
            {/* Sidebar with active chats list */}
            <div className="w-full md:w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-white">Чат з клієнтами</h3>
                <p className="text-xs text-slate-500">Виберіть клієнта для початку спілкування</p>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {chatsList.map((chat) => {
                  const isActive = selectedChatId === chat.profile_id;
                  const isNewMessage = chat.last_message_text !== "Немає повідомлень" && !chat.last_message_from_admin;
                  
                  return (
                    <button
                      key={chat.profile_id}
                      onClick={() => setSelectedChatId(chat.profile_id)}
                      className={`w-full text-left p-4 hover:bg-slate-105 dark:hover:bg-slate-800 transition-all flex items-start gap-3 ${
                        isActive ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-l-4 border-indigo-500" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                            {chat.profile_name}
                          </span>
                          {chat.last_message_time && (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate mt-1 ${isNewMessage ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}`}>
                          {chat.last_message_text}
                        </p>
                      </div>
                      {isNewMessage && (
                        <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })}
                {chatsList.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Немає доступних клієнтів
                  </div>
                )}
              </div>
            </div>

            {/* Chat conversation area */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-800">
              {selectedChatId ? (
                <>
                  {/* Chat header */}
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between shadow-sm">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white">
                        {chatsList.find(c => c.profile_id === selectedChatId)?.profile_name || "Діалог"}
                      </span>
                      <p className="text-[10px] text-green-500 font-medium">Активний зв'язок</p>
                    </div>
                  </div>

                  {/* Message bubbles */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-900/10">
                    {chatMessages.map((msg) => {
                      const isAdmin = msg.is_from_admin;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${
                            isAdmin
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-750"
                          }`}>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            <span className={`text-[9px] block text-right mt-1.5 ${isAdmin ? "text-indigo-200" : "text-slate-450"}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {chatMessages.length === 0 && (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                        Почніть діалог, надіславши перше повідомлення клієнту.
                      </div>
                    )}
                  </div>

                  {/* Input form */}
                  <form onSubmit={handleSendReply} className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-3">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Введіть повідомлення для клієнта..."
                      className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      disabled={sendingReply}
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all"
                    >
                      {sendingReply ? "..." : "Надіслати"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 mb-3">
                    💬
                  </div>
                  <span className="text-sm font-semibold">Не вибрано діалог</span>
                  <p className="text-xs text-slate-400 mt-1">Оберіть клієнта зі списку ліворуч, щоб переглянути листування та відповісти</p>
                </div>
              )}
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
              {activeTab !== "staff" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Ім'я клієнта (ФОП / Назва)
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                    placeholder="ФОП Петренко І.І. / ТОВ Альфа"
                  />
                </div>
              )}
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
              {editingOfferId ? "Редагувати тарифний пакет" : "Додати тарифний пакет"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Назва пакету
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
                onClick={editingOfferId ? handleUpdateOffer : handleCreateOffer}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600 text-white rounded-lg font-medium transition-colors"
              >
                {editingOfferId ? "Зберегти" : "Додати"}
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

      {/* Company Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Параметри та умови співпраці
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider block">Назва компанії</span>
                  <span className="text-sm font-bold text-slate-905 dark:text-white mt-0.5 block">
                    {dashboardData?.consulting_company?.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider block">Власник кабінету</span>
                  <span className="text-slate-700 dark:text-slate-350 mt-0.5 block font-semibold">
                    {dashboardData?.consulting_company?.owner_email || "Не вказано"}
                  </span>
                </div>
              </div>
              
              <div className="pt-2 space-y-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Розрахунок вартості ліцензій
                </h3>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Кожен 10-й клієнт:</span>
                      <span className="font-bold text-emerald-650 dark:text-emerald-450">-50% знижка</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      При послідовному додаванні клієнтів кожен 10-й (10-й, 20-й, 30-й тощо) отримує знижку 50% від базової вартості тарифу.
                    </p>
                  </div>
                  
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Базова партнерська знижка:</span>
                      <span className="font-bold text-indigo-650 dark:text-indigo-400">-{settingsDiscount}%</span>
                    </div>
                    <p className="text-[11px] text-slate-555 dark:text-slate-400 leading-relaxed">
                      Надається на всі інші (некратні десяти) клієнтські слоти компанії. Встановлюється індивідуально розробником.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-6 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 font-bold text-xs rounded-xl transition"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Card Modal */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Прив'язка платіжної картки
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Номер картки
                </label>
                <input
                  type="text"
                  maxLength={19}
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-650"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Місяць
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="MM"
                    value={expiryMonth}
                    onChange={(e) => setExpiryMonth(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-650 text-center"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Рік
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="YY"
                    value={expiryYear}
                    onChange={(e) => setExpiryYear(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-650 text-center"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    CVV
                  </label>
                  <input
                    type="password"
                    maxLength={3}
                    placeholder="***"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-650 text-center"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCardModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold text-xs rounded-xl transition"
              >
                Скасувати
              </button>
              <button
                onClick={handleSaveCard}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-orange-500 hover:from-violet-700 hover:to-orange-600 text-white font-bold text-xs rounded-xl transition shadow-md"
              >
                Зберегти картку
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}