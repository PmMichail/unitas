"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api, legislationApi, agentApi, API_BASE_URL } from "@/lib/api";
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
  MessageSquare,
  Trash2,
  AlertCircle
} from "lucide-react";

// Counter animation hook
function useCounter(end: number, duration: number = 1000, start: number = 0) {
  const [count, setCount] = useState(start);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (start === end) return;
    setIsAnimating(true);
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(start + (end - start) * easeOutQuart);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [start, end, duration]);

  return { count, isAnimating };
}

export default function Dashboard() {
  const { selectedProfile } = useApp();

  // States
  const [companyId, setCompanyId] = useState<number>(1);
  const [statements, setStatements] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [unapprovedCount, setUnapprovedCount] = useState<number>(0);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editingReport, setEditingReport] = useState<any>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeModal, setActiveModal] = useState<"income" | "tax_due" | "tax_paid" | "debt" | null>(null);

  // Board Workspace States
  const [boardIssues, setBoardIssues] = useState<any[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDesc, setNewIssueDesc] = useState("");
  const [certificates, setCertificates] = useState<any[]>([]);
  const [signingIssueId, setSigningIssueId] = useState<number | null>(null);
  const [signingPassword, setSigningPassword] = useState("");
  const [selectedCertId, setSelectedCertId] = useState<number | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  // Announcements States
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState("");
  const [newAnnContent, setNewAnnContent] = useState("");
  const [newAnnPinned, setNewAnnPinned] = useState(false);
  const [isConsultingUser, setIsConsultingUser] = useState(false);

  const simplifiedSystems = ["ednuy-3-5%", "single_tax", "fop_ep", "llc_ep", "ep"];
  const isSimplified = simplifiedSystems.includes((dashboardData?.tax_system || selectedProfile?.tax_system || "").toLowerCase());
  const isFop = (dashboardData?.type === "fop" || selectedProfile?.type === "fop" || 
                 String(dashboardData?.name || selectedProfile?.name || "").toLowerCase().includes("фоп") ||
                 String(dashboardData?.name || selectedProfile?.name || "").toLowerCase().includes("fop") ||
                 String(dashboardData?.tax_system || "").includes("fop") || String(selectedProfile?.tax_system || "").includes("fop")) &&
                !(String(dashboardData?.name || selectedProfile?.name || "").toLowerCase().includes("тов") ||
                  String(dashboardData?.name || selectedProfile?.name || "").toLowerCase().includes("llc") ||
                  String(dashboardData?.name || selectedProfile?.name || "").toLowerCase().includes("товариство") ||
                  dashboardData?.type === "company" || selectedProfile?.type === "company");
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

  const getDpsValue = (taxType: string) => {
    if (!dashboardData?.dps_info?.settlements) return { debt: 0, overpaid: 0, paid: 0, found: false };
    const settlements = dashboardData.dps_info.settlements;
    let matched = settlements.find((s: any) => {
      const name = s.tax_name.toLowerCase();
      const code = s.tax_code || "";
      if (taxType === "unified_tax") {
        return name.includes("єдиний податок") || name.includes("єп") || code.includes("18050400") || code.includes("18050300");
      }
      if (taxType === "esv") {
        return name.includes("соціальний") || name.includes("єсв") || code.includes("71040000") || code.includes("71010000");
      }
      if (taxType === "military_tax") {
        return name.includes("військовий") || name.includes("вз") || code.includes("11011700") || code.includes("11011800") || code.includes("11011000") || code.includes("11011001");
      }
      if (taxType === "pit") {
        return name.includes("пдфо") || name.includes("доходи фізичних") || code.includes("11010100") || code.includes("11010500");
      }
      return false;
    });
    if (matched) {
      return { debt: matched.debt, overpaid: matched.overpaid, paid: matched.paid, found: true };
    }
    return { debt: 0, overpaid: 0, paid: 0, found: false };
  };

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

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat containers when messages or state change
  useEffect(() => {
    if (activeAiTab === "chat" && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [chatMessages, sendingChat, activeAiTab]);

  // Sync active profile from context and load chat history
  useEffect(() => {
    if (selectedProfile) {
      setCompanyId(selectedProfile.id);
      const saved = localStorage.getItem(`chat_history_${selectedProfile.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChatMessages(parsed);
            return;
          }
        } catch (e) {
          console.error("Failed to parse saved chat history", e);
        }
      }
      setChatMessages([
        {
          sender: "agent",
          text: `Вітаю! Я ваш персональний ШІ-Асистент UniTax для профілю **${selectedProfile.name}**. Я знаю все про ваші податки, доходи, працівників та військовий збір. Запитайте мене про будь-що, наприклад:\n\n• *«Який військовий збір мені потрібно сплатити?»*\n• *«Який мій дохід та поточний ліміт?»*\n• *«Які податки треба сплатити за працівників?»*`
        }
      ]);
    }
  }, [selectedProfile?.id]);

  // Board Workspace Actions
  const fetchBoardIssues = async () => {
    setBoardLoading(true);
    try {
      const data = await api.getBoardIssues(undefined, companyId);
      if (Array.isArray(data)) {
        setBoardIssues(data);
      }
    } catch (err) {
      console.error("Error fetching board issues:", err);
    } finally {
      setBoardLoading(false);
    }
  };

  const fetchCertificates = async () => {
    try {
      const data = await api.getCertificates(companyId);
      if (Array.isArray(data)) {
        setCertificates(data);
        if (data.length > 0) {
          setSelectedCertId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching certificates:", err);
    }
  };

  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const data = await api.getAnnouncements(companyId);
      if (Array.isArray(data)) {
        setAnnouncements(data);
      }
    } catch (err) {
      console.error("Error fetching announcements:", err);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueTitle.trim()) return;
    try {
      await api.createBoardIssue(undefined, {
        title: newIssueTitle,
        description: newIssueDesc
      }, companyId);
      setNewIssueTitle("");
      setNewIssueDesc("");
      setIsCreatingIssue(false);
      fetchBoardIssues();
    } catch (err) {
      console.error("Error creating issue:", err);
    }
  };

  const handleStartVoting = async (issueId: number) => {
    try {
      await api.startBoardVoting(undefined, issueId);
      fetchBoardIssues();
    } catch (err) {
      console.error("Error starting voting:", err);
    }
  };

  const handleEndVoting = async (issueId: number) => {
    try {
      await api.endBoardVoting(undefined, issueId);
      fetchBoardIssues();
    } catch (err) {
      console.error("Error ending voting:", err);
    }
  };

  const handleSignProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signingIssueId) return;
    setIsSigning(true);
    try {
      await api.signBoardProtocol(undefined, signingIssueId, {
        password: signingPassword,
        certificate_id: selectedCertId || undefined
      });
      setSigningPassword("");
      setSigningIssueId(null);
      fetchBoardIssues();
      alert("Протокол успішно підписано КЕП та опубліковано для мешканців!");
    } catch (err: any) {
      console.error("Error signing protocol:", err);
      alert(err.response?.data?.detail || "Помилка при підписі протоколу");
    } finally {
      setIsSigning(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) return;
    try {
      await api.createAnnouncement(companyId, {
        title: newAnnTitle,
        content: newAnnContent,
        is_pinned: newAnnPinned
      });
      setNewAnnTitle("");
      setNewAnnContent("");
      setNewAnnPinned(false);
      setIsCreatingAnnouncement(false);
      fetchAnnouncements();
    } catch (err) {
      console.error("Error creating announcement:", err);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (confirm("Ви впевнені, що хочете видалити це оголошення?")) {
      try {
        await api.deleteAnnouncement(companyId, id);
        fetchAnnouncements();
      } catch (err) {
        console.error("Error deleting announcement:", err);
      }
    }
  };

  // Load board issues and announcements when active tab changes
  useEffect(() => {
    if (companyId) {
      if (activeTab === "board") {
        fetchBoardIssues();
        fetchCertificates();
      } else if (activeTab === "announcements") {
        fetchAnnouncements();
      }
    }
  }, [activeTab, companyId]);

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

  const fetchStatements = async () => {
    if (!companyId) return;
    try {
      const data = await api.getStatements(companyId);
      setStatements(data);
    } catch (err) {
      console.warn("Помилка завантаження виписок, використовуємо порожній список.");
      setStatements([]);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [companyId, periodType, selectedYear, selectedMonth, selectedQuarter]);

  const fetchModerationCount = async () => {
    if (!companyId || selectedProfile?.organization_subtype !== "osbb") {
      setUnapprovedCount(0);
      setPendingRequests([]);
      return;
    }
    try {
      const data = await api.getMembersModeration(companyId, "pending");
      if (Array.isArray(data)) {
        setUnapprovedCount(data.length);
        setPendingRequests(data);
      } else {
        setUnapprovedCount(0);
        setPendingRequests([]);
      }
    } catch (err) {
      console.warn("Failed to load moderation members for count check");
      setUnapprovedCount(0);
      setPendingRequests([]);
    }
  };

  const handleDashboardVerify = async (memberId: number) => {
    try {
      await api.updateMemberModeration(companyId, memberId, { status: "approved" });
      fetchModerationCount();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDashboardReject = async (memberId: number) => {
    if (confirm("Ви впевнені, що хочете видалити цей запит на реєстрацію?")) {
      try {
        await api.deleteMember(companyId, memberId);
        fetchModerationCount();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Перевірка консалтинг статусу користувача
  const fetchConsultingStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/consulting/check-status`);
      const data = await response.json();
      setIsConsultingUser(data.is_consulting || false);
    } catch (err) {
      console.error("Error checking consulting status:", err);
      setIsConsultingUser(false);
    }
  };

  useEffect(() => {
    fetchLegislationData();
    fetchStatements();
    fetchModerationCount();
    fetchConsultingStatus();
  }, [companyId]);

  useEffect(() => {
    if (activeTab === "statements") {
      fetchStatements();
    }
  }, [activeTab, companyId]);

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
      // Refresh dashboard & statements
      fetchDashboardData();
      fetchStatements();
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

  // Handle Clear Chat
  const handleClearChat = () => {
    if (selectedProfile) {
      localStorage.removeItem(`chat_history_${selectedProfile.id}`);
      setChatMessages([
        {
          sender: "agent",
          text: `Вітаю! Я ваш персональний ШІ-Асистент UniTax для профілю **${selectedProfile.name}**. Я знаю все про ваші податки, доходи, працівників та військовий збір. Запитайте мене про будь-що, наприклад:\n\n• *«Який військовий збір мені потрібно сплатити?»*\n• *«Який мій дохід та поточний ліміт?»*\n• *«Які податки треба сплатити за працівників?»*`
        }
      ]);
    }
  };

  // Handle Send Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sendingChat) return;

    const userMsg = inputMessage.trim();
    setInputMessage("");
    
    // Add user message to state
    const updatedMessages = [...chatMessages, { sender: "user" as const, text: userMsg }];
    setChatMessages(updatedMessages);
    setSendingChat(true);

    // Get the last 10 messages as history
    const history = chatMessages.slice(-10).map(msg => ({
      sender: msg.sender,
      text: msg.text
    }));

    try {
      const res = await agentApi.chat(companyId, userMsg, history);
      const agentAnswer = res.response || res.answer || "Не вдалося отримати відповідь від ШІ-агента.";
      setChatMessages((prev) => [...prev, { sender: "agent", text: agentAnswer }]);
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
    <div className="pb-12 text-slate-850 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Styles Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        
        .font-sans {
          font-family: 'Outfit', sans-serif;
        }

        .glass-panel {
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(15, 23, 42, 0.07);
        }

        .dark .glass-panel {
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .glass-panel:hover {
          border-color: rgba(99, 102, 241, 0.15);
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05), 0 0 20px -5px rgba(99, 102, 241, 0.03);
          transform: translateY(-2px);
        }

        .dark .glass-panel:hover {
          border-color: rgba(99, 102, 241, 0.2);
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.7), 0 0 20px -5px rgba(99, 102, 241, 0.1);
        }

        .glow-button {
          box-shadow: 0 0 15px -3px rgba(99, 102, 241, 0.25);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .dark .glow-button {
          box-shadow: 0 0 15px -3px rgba(99, 102, 241, 0.5);
        }

        .glow-button:hover {
          box-shadow: 0 0 25px 0px rgba(99, 102, 241, 0.45);
        }

        .dark .glow-button:hover {
          box-shadow: 0 0 25px 0px rgba(99, 102, 241, 0.7);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.02);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.2);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.5);
        }

        @keyframes modalBackdropIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-modal-backdrop {
          animation: modalBackdropIn 0.15s ease-out forwards;
        }

        .animate-modal-fade {
          animation: modalFadeIn 0.25s ease-out forwards;
        }
      `}} />

      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-500/5 dark:from-indigo-950/20 via-transparent to-transparent pointer-events-none z-0" />
      <div className="absolute top-20 right-10 w-[300px] h-[300px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[400px] left-10 w-[300px] h-[300px] bg-emerald-500/3 dark:bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

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
              type="button"
              onClick={() => setActiveTab("dashboard")} 
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === "dashboard" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-slate-200"}`}
            >
              Дашборд
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab("statements")} 
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === "statements" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-slate-200"}`}
            >
              Виписки
            </button>
            <Link 
              href="/benefits" 
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all duration-200"
            >
              Переваги
            </Link>
            <Link 
              href="/marketplace" 
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all duration-200"
            >
              Маркетплейс
            </Link>
            {/* Кнопка Консалтинг показується тимчасово всім користувачам для налаштування */}
            <Link 
              href="/consulting/dashboard" 
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all duration-200"
            >
              Консалтинг
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            <a 
              href="https://t.me/unitas_tax_bot" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center space-x-2 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-md shadow-indigo-600/10 transition-all hover:scale-[1.03] active:scale-95"
            >
              <Send className="w-3.5 h-3.5 text-indigo-200" />
              <span>Мій Telegram</span>
            </a>
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
                
                {pendingRequests && pendingRequests.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <AlertCircle className="text-amber-500 w-4 h-4" />
                        Запити на реєстрацію ({pendingRequests.length})
                      </h3>
                      <Link href="/billing?tab=moderation" className="text-xs text-indigo-500 hover:text-indigo-400 font-bold transition">
                        Усі запити →
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pendingRequests.map((req) => (
                        <div key={req.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-md hover:shadow-lg transition flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex items-start justify-between">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 uppercase tracking-wide">
                                {req.role === "owner" ? "Власник" : "Орендар"}
                              </span>
                              <span className="text-xs font-semibold text-slate-450 dark:text-slate-400">
                                {req.property_type || "кв."} № {req.identifier}
                              </span>
                            </div>
                            <h4 className="font-extrabold text-slate-800 dark:text-white mt-3 text-base">
                              {req.owner_name || "Невідоме ім'я"}
                            </h4>
                            {req.street && req.number && (
                              <p className="text-xs text-slate-400 mt-1">
                                вул. {req.street}, буд. {req.number}
                              </p>
                            )}
                            <div className="mt-3.5 space-y-1 text-xs text-slate-500">
                              <div>📞 {req.phone || "Телефон не вказано"}</div>
                              {req.email && <div>✉️ {req.email}</div>}
                            </div>
                          </div>
                          
                          <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-3">
                            <button
                              onClick={() => handleDashboardVerify(req.id)}
                              className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition"
                            >
                              Підтвердити
                            </button>
                            <button
                              onClick={() => handleDashboardReject(req.id)}
                              className="flex-1 py-2 text-xs font-bold text-rose-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
                            >
                              Відхилити
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                 {/* Intro Card */}
                 <div className="p-6 rounded-2xl glass-panel bg-gradient-to-r from-slate-100/90 to-indigo-50/40 dark:from-slate-900/80 dark:to-indigo-950/30 flex flex-col md:flex-row md:justify-between md:items-center transition-all duration-300">
                   <div className="space-y-1">
                     <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">Особистий кабінет</span>
                     <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{dashboardData?.company_name}</h2>
                     <div className="flex flex-wrap items-center gap-2 mt-2">
                       <span className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-md border border-indigo-150 dark:border-indigo-500/20 font-medium">
                         {isFop 
                           ? (isSimplified ? "ФОП Спрощена система" : "ФОП Загальна система")
                           : (isSimplified ? "ТОВ Спрощена система" : "ТОВ Загальна система")}
                       </span>
                       {isFop && dashboardData?.group && (
                         <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-transparent font-medium">
                           Група {dashboardData.group}
                         </span>
                       )}
                       {(dashboardData?.rate !== undefined && dashboardData?.rate !== null && !(isFop && (dashboardData?.group === 1 || dashboardData?.group === 2))) ? (
                         <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-transparent font-medium">
                           Ставка {dashboardData.rate}%
                         </span>
                       ) : (isFop && (dashboardData?.group === 1 || dashboardData?.group === 2) && (
                         <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-transparent font-medium">
                           Фіксована ставка
                         </span>
                       ))}
                     </div>
                   </div>
                   <div className="mt-4 md:mt-0 flex space-x-3">
                     <button 
                       onClick={() => setActiveTab("statements")}
                       className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-white text-sm font-semibold transition-all flex items-center border border-slate-200 dark:border-slate-700/50"
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
                    
                    {/* Taxable Income Block */}
                    <div className="mt-4 pt-4 border-t border-slate-800/60">
                      <div className="bg-blue-950/30 rounded-lg p-3 border border-blue-500/30">
                        <p className="text-xs text-blue-400 font-medium">Оподатковуваний дохід:</p>
                        <p className="text-lg font-bold text-blue-300">{dashboardData?.taxable_income?.toLocaleString("uk-UA")} грн</p>
                        <p className="text-xs text-blue-500/80 mt-1">* Власні кошти та повернення виключено</p>
                      </div>
                    </div>
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
                      {((dashboardData?.tax_due || 0) + 
                        (dashboardData?.military_tax_due || 0) + 
                        (dashboardData?.esv_due || 0) + 
                        (dashboardData?.pit_due || 0)
                      ).toLocaleString("uk-UA")} <span className="text-lg font-bold text-slate-400">грн</span>
                    </h3>
                    <p className="text-xs text-indigo-400/80 font-semibold mt-2">
                      {isSimplified 
                        ? (dashboardData?.group === 1 
                          ? "Фіксована сума (1 група)" 
                          : dashboardData?.group === 2 
                            ? "Фіксована сума (2 група)" 
                            : `${dashboardData?.rate || selectedProfile?.rate || 5}% від оподатковуваного доходу`)
                        : (isFop ? "18% ПДФО від чистого прибутку" : "18% податок на прибуток")}
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

                {/* Comparison Card: Unitas vs DPS */}
                {dashboardData?.dps_info && (
                  <div className="p-6 rounded-2xl glass-panel mb-8 border border-indigo-500/10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div className="flex items-center space-x-2">
                        <ShieldAlert className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-lg font-bold text-white">Порівняльний аналіз: Сайт vs ДПС</h3>
                      </div>
                      <span className="text-slate-400 text-xs font-semibold bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/80">
                        Оновлено з ДПС: {new Date(dashboardData.dps_info.recorded_at).toLocaleDateString("uk-UA")}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="text-xs uppercase bg-slate-950/40 text-slate-400 rounded-lg">
                          <tr>
                            <th className="px-4 py-3 rounded-l-lg">Податок / Збір</th>
                            <th className="px-4 py-3 text-center">Розрахунок сайту (по виписках)</th>
                            <th className="px-4 py-3 text-center rounded-r-lg">Дані кабінету ДПС (офіційні)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {[
                            { id: "unified_tax", name: "Єдиний податок" },
                            { id: "esv", name: "Єдиний соціальний внесок (ЄСВ)" },
                            { id: "military_tax", name: "Військовий збір" },
                            { id: "pit", name: "ПДФО (прибутковий податок)" }
                          ].map((tax) => {
                            const uDue = tax.id === "unified_tax" ? dashboardData.tax_due :
                                          tax.id === "esv" ? dashboardData.esv_due :
                                          tax.id === "military_tax" ? dashboardData.military_tax_due :
                                          dashboardData.pit_due;
                            const uPaid = tax.id === "unified_tax" ? dashboardData.ep_paid :
                                          tax.id === "esv" ? dashboardData.esv_paid :
                                          tax.id === "military_tax" ? dashboardData.mil_paid :
                                          dashboardData.pit_paid;
                            const uDiff = tax.id === "unified_tax" ? dashboardData.ep_diff :
                                          tax.id === "esv" ? dashboardData.esv_diff :
                                          tax.id === "military_tax" ? dashboardData.mil_diff :
                                          dashboardData.pit_diff;

                            const dps = getDpsValue(tax.id);

                            return (
                              <tr key={tax.id} className="hover:bg-slate-900/10 transition-colors">
                                <td className="px-4 py-4 font-semibold text-white">{tax.name}</td>
                                <td className="px-4 py-4 text-center">
                                  <div className="space-y-1">
                                    <div className="text-xs text-slate-400">Нараховано: <span className="text-white font-semibold">{uDue?.toLocaleString("uk-UA")} грн</span></div>
                                    <div className="text-xs text-slate-400">Сплачено: <span className="text-emerald-400 font-semibold">{uPaid?.toLocaleString("uk-UA")} грн</span></div>
                                    {uDiff > 0 ? (
                                      <div className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded inline-block">Борг: {uDiff?.toLocaleString("uk-UA")} грн</div>
                                    ) : (
                                      <div className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded inline-block">✅ Сплачено</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  {dps.found ? (
                                    <div className="space-y-1">
                                      {dps.overpaid > 0 && (
                                        <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded inline-block">Переплата: {dps.overpaid?.toLocaleString("uk-UA")} грн</div>
                                      )}
                                      {dps.debt > 0 && (
                                        <div className="text-xs text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded inline-block">Борг: {dps.debt?.toLocaleString("uk-UA")} грн</div>
                                      )}
                                      {dps.debt === 0 && dps.overpaid === 0 && (
                                        <div className="text-xs text-slate-400 bg-slate-800/40 px-2 py-0.5 rounded inline-block">Закрито (0.00 грн)</div>
                                      )}
                                      <div className="text-[10px] text-slate-500 mt-1">Остання сплата: {dps.paid?.toLocaleString("uk-UA")} грн</div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-500">Немає даних</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

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
                        <div className="flex justify-between items-start w-full">
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
                          {activeAiTab === "chat" && (
                            <button
                              type="button"
                              onClick={handleClearChat}
                              className="text-[11px] px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-red-500/30 hover:bg-red-950/10 hover:text-red-400 text-slate-400 rounded-lg transition-all flex items-center gap-1.5 shadow-sm font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Очистити
                            </button>
                          )}
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
                          <div
                            ref={chatContainerRef}
                            className="space-y-4 h-[320px] overflow-y-auto custom-scrollbar pr-1 mb-4 flex flex-col gap-3"
                          >
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
                        {statements.map((stmt: any) => (
                          <tr key={stmt.id} className="border-b border-slate-800/40 bg-slate-900/10">
                            <td className="px-6 py-4 font-semibold text-white">{stmt.file_name}</td>
                            <td className="px-6 py-4 capitalize">{stmt.bank_name}</td>
                            <td className="px-6 py-4">{stmt.uploaded_at || "—"}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                stmt.status === "parsed"
                                  ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"
                                  : stmt.status === "failed"
                                  ? "bg-rose-950/40 text-rose-400 border border-rose-500/20"
                                  : "bg-amber-950/40 text-amber-400 border border-amber-500/20"
                              }`}>
                                {stmt.status === "parsed" ? "Розпізнано AI" : stmt.status === "failed" ? "Помилка" : "Обробка"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => setActiveTab("dashboard")} 
                                className="text-indigo-400 hover:text-indigo-300 font-semibold"
                              >
                                Перейти до дашборду
                              </button>
                            </td>
                          </tr>
                        ))}
                        {statements.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-semibold">
                              У вас немає завантажених виписок для цього профілю.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Board Workspace View */}
            {activeTab === "board" && (
              <div className="mt-8 space-y-6">
                <div className="rounded-3xl glass-panel p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      🏛️ Робочий простір правління ОСББ
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Обговорення питань, голосування та автоматичне формування протоколів засідань.
                    </p>
                  </div>
                  {!isCreatingIssue && (
                    <button
                      onClick={() => setIsCreatingIssue(true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-3 transition-all active:scale-95 shadow-lg shadow-indigo-600/10"
                    >
                      <Plus size={16} /> Створити питання
                    </button>
                  )}
                </div>

                {/* Create Issue Form */}
                {isCreatingIssue && (
                  <div className="rounded-3xl glass-panel p-6 shadow-sm border border-indigo-500/10 bg-slate-950/40">
                    <h3 className="text-base font-bold text-white mb-4">Нове питання на порядок денний</h3>
                    <form onSubmit={handleCreateIssue} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Тема питання</label>
                        <input
                          type="text"
                          required
                          value={newIssueTitle}
                          onChange={(e) => setNewIssueTitle(e.target.value)}
                          placeholder="Наприклад: Про ремонт покрівлі другого під'їзду"
                          className="w-full px-4 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Опис питання / Пропозиція</label>
                        <textarea
                          rows={4}
                          value={newIssueDesc}
                          onChange={(e) => setNewIssueDesc(e.target.value)}
                          placeholder="Детально опишіть суть питання, пропозиції членів правління та очікувані результати..."
                          className="w-full px-4 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          type="submit"
                          className="flex-1 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition"
                        >
                          Опублікувати питання
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingIssue(false);
                            setNewIssueTitle("");
                            setNewIssueDesc("");
                          }}
                          className="flex-1 py-3 text-sm font-semibold border border-slate-800 hover:bg-slate-900 rounded-xl text-slate-400 transition"
                        >
                          Скасувати
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Issues List */}
                {boardLoading ? (
                  <div className="py-12 text-center text-slate-400">Завантаження питань...</div>
                ) : boardIssues.length === 0 ? (
                  <div className="rounded-3xl glass-panel p-12 text-center text-slate-500 font-semibold border border-slate-800/40 bg-slate-950/20">
                    Питання для обговорення правлінням ще не створені.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {boardIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="rounded-3xl glass-panel p-6 shadow-sm border border-slate-855 bg-[#0f172a]/60 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              issue.status === "discussion"
                                ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                : issue.status === "voting"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : issue.is_signed
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : "bg-slate-500/10 text-slate-400 border-slate-800"
                            }`}
                          >
                            {issue.status === "discussion" && "💬 Обговорення"}
                            {issue.status === "voting" && "🗳️ Голосування"}
                            {issue.status === "completed" && (issue.is_signed ? "✅ Підписано КЕП" : "📄 Очікує підпису")}
                          </span>
                          <span className="text-xs text-slate-500">{new Date(issue.created_at).toLocaleDateString("uk-UA")}</span>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-white">{issue.title}</h3>
                          {issue.description && (
                            <p className="text-sm text-slate-400 mt-1 whitespace-pre-line">{issue.description}</p>
                          )}
                        </div>

                        {/* Votes Stats */}
                        {issue.status !== "discussion" && (
                          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-850 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex gap-4">
                              <span className="text-xs text-emerald-400 font-bold">👍 ЗА: {issue.stats?.yes || 0}</span>
                              <span className="text-xs text-rose-450 font-bold">👎 ПРОТИ: {issue.stats?.no || 0}</span>
                              <span className="text-xs text-slate-400 font-bold">😐 УТРИМАЛИСЬ: {issue.stats?.abstain || 0}</span>
                            </div>
                            <span className="text-xs text-indigo-400 font-medium">Всього голосів: {issue.stats?.total || 0}</span>
                          </div>
                        )}

                        {/* AI generated Protocol Minutes */}
                        {issue.ai_protocol && (
                          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/10 space-y-2">
                            <div className="flex justify-between items-center">
                              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">📄 Сформований ШІ-протокол</h4>
                              {issue.document_id && (
                                <a
                                  href={`${API_BASE_URL}/api/documents/download/${issue.document_id}`}
                                  target="_blank"
                                  className="text-xs text-indigo-455 hover:text-indigo-300 font-semibold flex items-center gap-1"
                                >
                                  Завантажити <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                            <pre className="text-xs text-slate-350 overflow-x-auto whitespace-pre-wrap max-h-48 custom-scrollbar border-t border-indigo-500/5 pt-2">
                              {issue.ai_protocol}
                            </pre>
                          </div>
                        )}

                        {/* Admin Action Buttons */}
                        <div className="flex gap-3 pt-2">
                          {issue.status === "discussion" && (
                            <button
                              onClick={() => handleStartVoting(issue.id)}
                              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                            >
                              Запустити голосування
                            </button>
                          )}
                          {issue.status === "voting" && (
                            <button
                              onClick={() => handleEndVoting(issue.id)}
                              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                            >
                              Завершити голосування та створити протокол AI
                            </button>
                          )}
                        </div>

                        {/* Sign Protocol Block */}
                        {issue.status === "completed" && !issue.is_signed && (
                          <div className="pt-2 border-t border-slate-800/40">
                            {signingIssueId === issue.id ? (
                              <form onSubmit={handleSignProtocol} className="space-y-3 p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/10">
                                <h4 className="text-xs font-bold text-indigo-400 uppercase">Підписання протоколу КЕП</h4>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-1">Оберіть сертифікат</label>
                                  <select
                                    value={selectedCertId || ""}
                                    onChange={(e) => setSelectedCertId(Number(e.target.value))}
                                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300"
                                  >
                                    {certificates.map((c) => (
                                      <option key={c.id} value={c.id}>{c.cert_owner_name} ({c.cert_serial})</option>
                                    ))}
                                    {certificates.length === 0 && (
                                      <option value="">Немає сертифікатів КЕП</option>
                                    )}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-1">Пароль захисту КЕП</label>
                                  <input
                                    type="password"
                                    required
                                    value={signingPassword}
                                    onChange={(e) => setSigningPassword(e.target.value)}
                                    placeholder="Введіть пароль ключа..."
                                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                  />
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="submit"
                                    disabled={isSigning}
                                    className="flex-1 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                                  >
                                    {isSigning ? "Підписання..." : "Підписати протокол"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSigningIssueId(null)}
                                    className="px-3 py-2 text-xs font-semibold border border-slate-800 hover:bg-slate-900 rounded-lg text-slate-400 transition"
                                  >
                                    Скасувати
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <button
                                onClick={() => {
                                  setSigningIssueId(issue.id);
                                  if (certificates.length > 0 && !selectedCertId) {
                                    setSelectedCertId(certificates[0].id);
                                  }
                                }}
                                className="w-full py-2 rounded-xl bg-indigo-650/40 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-250 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                              >
                                <ShieldAlert size={14} /> Підписати протокол КЕП
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Announcements View */}
            {activeTab === "announcements" && (
              <div className="mt-8 space-y-6">
                <div className="rounded-3xl glass-panel p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      📢 Оголошення ОСББ
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Створюйте оголошення, які будуть показані усім мешканцам на головній сторінці кабінету та в додатку.
                    </p>
                  </div>
                  {!isCreatingAnnouncement && (
                    <button
                      onClick={() => setIsCreatingAnnouncement(true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-3 transition-all active:scale-95 shadow-lg shadow-indigo-600/10"
                    >
                      <Plus size={16} /> Нове оголошення
                    </button>
                  )}
                </div>

                {/* Create Announcement Form */}
                {isCreatingAnnouncement && (
                  <div className="rounded-3xl glass-panel p-6 shadow-sm border border-indigo-500/10 bg-slate-950/40">
                    <h3 className="text-base font-bold text-white mb-4">Створення нового оголошення</h3>
                    <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Заголовок</label>
                        <input
                          type="text"
                          required
                          value={newAnnTitle}
                          onChange={(e) => setNewAnnTitle(e.target.value)}
                          placeholder="Наприклад: Планове відключення води"
                          className="w-full px-4 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Текст оголошення</label>
                        <textarea
                          rows={4}
                          required
                          value={newAnnContent}
                          onChange={(e) => setNewAnnContent(e.target.value)}
                          placeholder="Текст повідомлення для мешканців..."
                          className="w-full px-4 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_pinned"
                          checked={newAnnPinned}
                          onChange={(e) => setNewAnnPinned(e.target.checked)}
                          className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="is_pinned" className="text-xs font-semibold text-slate-300 cursor-pointer">
                          Закріпити вгорі списку
                        </label>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          type="submit"
                          className="flex-1 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition"
                        >
                          Опублікувати
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingAnnouncement(false);
                            setNewAnnTitle("");
                            setNewAnnContent("");
                            setNewAnnPinned(false);
                          }}
                          className="flex-1 py-3 text-sm font-semibold border border-slate-800 hover:bg-slate-900 rounded-xl text-slate-400 transition"
                        >
                          Скасувати
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Announcements List */}
                {announcementsLoading ? (
                  <div className="py-12 text-center text-slate-400">Завантаження оголошень...</div>
                ) : announcements.length === 0 ? (
                  <div className="rounded-3xl glass-panel p-12 text-center text-slate-500 font-semibold border border-slate-800/40 bg-slate-950/20">
                    Немає активних оголошень.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className={`rounded-3xl glass-panel p-6 shadow-sm border ${
                          ann.is_pinned ? "border-indigo-500/30 bg-indigo-950/10" : "border-slate-800 bg-[#0f172a]/60"
                        } flex justify-between items-start gap-4`}
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {ann.is_pinned && (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                📌 Закріплено
                              </span>
                            )}
                            <span className="text-xs text-slate-500">
                              {new Date(ann.created_at).toLocaleString("uk-UA", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-white">{ann.title}</h3>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">{ann.content}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-2 rounded-lg bg-red-950/20 hover:bg-red-500/20 border border-red-500/10 text-red-400 hover:text-red-300 transition"
                          title="Видалити оголошення"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

            {/* Metric Detail Modals - AI/Nano Tech Style */}
            {activeModal && activeModal !== "income" && (
              <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modal-backdrop"
                onClick={() => setActiveModal(null)}
              >
                <div
                  className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-lg max-w-[500px] w-full max-h-[85vh] flex flex-col shadow-sm relative overflow-hidden animate-modal-fade"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#0a0a0a] flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        {activeModal === "tax_due" && <AlertTriangle className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
                        {activeModal === "tax_paid" && <CheckCircle className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
                        {activeModal === "debt" && <AlertCircle className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {activeModal === "tax_due" && "Нараховано податку"}
                          {activeModal === "tax_paid" && "Сплачено податків"}
                          {activeModal === "debt" && "Різниця / Борг"}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-500">{getPeriodLabel()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveModal(null)}
                      className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 overflow-y-auto flex-1 custom-scrollbar bg-white dark:bg-[#0a0a0a]">
                    {false && (
                      <div className="space-y-4">
                        <p>
                          <strong>Загальний дохід</strong> — це сумарний обсяг коштів, отриманих {isFop ? 'ФОП' : 'ТОВ'} на розрахункові рахунки протягом звітного періоду ({getPeriodLabel()}).
                        </p>
                        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/10 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Загальний дохід:</span>
                            <span className="font-semibold text-slate-100">{dashboardData?.total_income?.toLocaleString("uk-UA")} грн</span>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-blue-400 font-medium">Оподатковуваний дохід:</span>
                            <span className="font-semibold text-blue-300">{dashboardData?.taxable_income?.toLocaleString("uk-UA")} грн</span>
                          </div>
                          <p className="text-xs text-blue-500/80">* Доходи, що не оподатковуються (власні кошти, повернення) виключено</p>
                        </div>

                        {isSimplified && (
                          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/10 space-y-2">
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                {isFop 
                                  ? `Річний ліміт ФОП (${dashboardData?.group || selectedProfile?.group || 3} група):`
                                  : `Річний ліміт ТОВ (Спрощена система):`}
                              </span>
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
                        )}

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
                        {/* Main Number */}
                        <div className="mb-4">
                          <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider">Нараховано податку</span>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                              {((dashboardData?.tax_due || 0) + (dashboardData?.military_tax_due || 0) + (dashboardData?.esv_due || 0) + (dashboardData?.pit_due || 0)).toLocaleString("uk-UA")}
                            </span>
                            <span className="text-sm text-slate-500 dark:text-slate-500">грн</span>
                          </div>
                        </div>

                        {/* Business Taxes */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider block mb-2">Податки бізнесу</span>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                {isSimplified
                                  ? (isFop && (dashboardData?.group === 1 || dashboardData?.group === 2 || selectedProfile?.group === 1 || selectedProfile?.group === 2)
                                      ? "Єдиний податок (фіксована)"
                                      : `Єдиний податок (${dashboardData?.rate || selectedProfile?.rate || 5}%)`)
                                  : isFop
                                    ? "ПДФО від прибутку (18%)"
                                    : "Податок на прибуток (18%)"}
                              </span>
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{(dashboardData?.tax_due || 0).toLocaleString("uk-UA")} грн</span>
                            </div>
                            {isFop && (
                              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                                <span className="text-xs text-slate-600 dark:text-slate-400">Військовий збір за себе</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {Math.max(0, (dashboardData?.military_tax_due || 0) - (dashboardData?.employee_mil_due || 0)).toLocaleString("uk-UA")} грн
                                </span>
                              </div>
                            )}
                            {!isFop && (
                              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                                <span className="text-xs text-slate-600 dark:text-slate-400">Військовий збір (ТОВ)</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {Math.max(0, (dashboardData?.military_tax_due || 0) - (dashboardData?.employee_mil_due || 0)).toLocaleString("uk-UA")} грн
                                </span>
                              </div>
                            )}
                            {isFop && (
                              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                                <span className="text-xs text-slate-600 dark:text-slate-400">ЄСВ за себе</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {Math.max(0, (dashboardData?.esv_due || 0) - (dashboardData?.employee_esv_due || 0)).toLocaleString("uk-UA")} грн
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Employee Taxes */}
                        {((dashboardData?.employee_pit_due || 0) > 0 || (dashboardData?.employee_mil_due || 0) > 0 || (dashboardData?.employee_esv_due || 0) > 0) && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800">
                            <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider block mb-2">Податки за працівників</span>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-600 dark:text-slate-400">ПДФО із зарплат (18%)</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{(dashboardData?.employee_pit_due || 0).toLocaleString("uk-UA")} грн</span>
                              </div>
                              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                                <span className="text-xs text-slate-600 dark:text-slate-400">Військовий збір із зарплат (5%)</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{(dashboardData?.employee_mil_due || 0).toLocaleString("uk-UA")} грн</span>
                              </div>
                              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                                <span className="text-xs text-slate-600 dark:text-slate-400">ЄСВ на зарплату (22%)</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{(dashboardData?.employee_esv_due || 0).toLocaleString("uk-UA")} грн</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Monthly Breakdown */}
                        {dashboardData?.breakdown && dashboardData.breakdown.length > 1 && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800">
                            <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider block mb-2">Розшифровка по місяцях</span>
                            <div className="overflow-y-auto max-h-[150px] custom-scrollbar pr-1">
                              <table className="w-full text-xs text-left text-slate-600 dark:text-slate-400">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-medium">
                                    <th className="pb-1.5">Період</th>
                                    <th className="pb-1.5 text-right">Основний</th>
                                    <th className="pb-1.5 text-right">Військовий</th>
                                    <th className="pb-1.5 text-right">ЄСВ</th>
                                    <th className="pb-1.5 text-right">Всього</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                  {dashboardData.breakdown.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/30">
                                      <td className="py-1.5 text-slate-700 dark:text-slate-300">{item.period_name}</td>
                                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{item.tax_due?.toLocaleString("uk-UA")} грн</td>
                                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{item.military_tax_due?.toLocaleString("uk-UA")} грн</td>
                                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{item.esv_due?.toLocaleString("uk-UA")} грн</td>
                                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{item.total_due?.toLocaleString("uk-UA")} грн</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeModal === "tax_paid" && (
                      <div className="space-y-4">
                        {/* Main Number */}
                        <div className="mb-4">
                          <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider">Сплачено податків</span>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                              {(dashboardData?.tax_paid || 0).toLocaleString("uk-UA")}
                            </span>
                            <span className="text-sm text-slate-500 dark:text-slate-500">грн</span>
                          </div>
                        </div>

                        {/* Tax Breakdown */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider block mb-2">Розподіл по видах податків</span>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-600 dark:text-slate-400">Сплачено ЄСВ</span>
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{(dashboardData?.tax_breakdown?.esv || 0).toLocaleString("uk-UA")} грн</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                              <span className="text-xs text-slate-600 dark:text-slate-400">Сплачено Єдиного податку / Прибутку</span>
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{(dashboardData?.tax_breakdown?.unified_tax || 0).toLocaleString("uk-UA")} грн</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                              <span className="text-xs text-slate-600 dark:text-slate-400">Сплачено Військового збору</span>
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{(dashboardData?.tax_breakdown?.military_tax || 0).toLocaleString("uk-UA")} грн</span>
                            </div>
                            {(!isFop || dashboardData?.has_employees || selectedProfile?.has_employees || (dashboardData?.tax_breakdown?.pit || 0) > 0) && (
                              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                                <span className="text-xs text-slate-600 dark:text-slate-400">Сплачено ПДФО</span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{(dashboardData?.tax_breakdown?.pit || 0).toLocaleString("uk-UA")} грн</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Monthly Breakdown */}
                        {dashboardData?.breakdown && dashboardData.breakdown.length > 1 && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800">
                            <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider block mb-2">Розшифровка по місяцях</span>
                            <div className="overflow-y-auto max-h-[150px] custom-scrollbar pr-1">
                              <table className="w-full text-xs text-left text-slate-600 dark:text-slate-400">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-medium">
                                    <th className="pb-1.5">Період</th>
                                    <th className="pb-1.5 text-right">Сума сплати</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                  {dashboardData.breakdown.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/30">
                                      <td className="py-1.5 text-slate-700 dark:text-slate-300">{item.period_name}</td>
                                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{item.tax_paid?.toLocaleString("uk-UA")} грн</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeModal === "debt" && (
                      <div className="space-y-4">
                        {/* Main Number */}
                        <div className="mb-4">
                          <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider">Різниця / Борг</span>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                              {(dashboardData?.difference || 0).toLocaleString("uk-UA")}
                            </span>
                            <span className="text-sm text-slate-500 dark:text-slate-500">грн</span>
                          </div>
                        </div>

                        {/* Tax Balance */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider block mb-2">Баланс по видах податків</span>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-xs text-slate-600 dark:text-slate-400 block">
                                  {isSimplified ? "Єдиний податок" : isFop ? "ПДФО від прибутку" : "Податок на прибуток"}
                                </span>
                                <span className="text-[10px] text-slate-400">Нараховано: {(dashboardData?.tax_due || 0).toLocaleString("uk-UA")} грн | Сплачено: {(dashboardData?.ep_paid || 0).toLocaleString("uk-UA")} грн</span>
                              </div>
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {dashboardData?.ep_diff > 0 ? `+${dashboardData?.ep_diff?.toLocaleString("uk-UA")} грн` : dashboardData?.ep_diff < 0 ? `Переплата: ${Math.abs(dashboardData?.ep_diff)?.toLocaleString("uk-UA")} грн` : `Сплачено`}
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                              <div>
                                <span className="text-xs text-slate-600 dark:text-slate-400 block">Військовий збір (ФОП + працівники)</span>
                                <span className="text-[10px] text-slate-400">Нараховано: {(dashboardData?.military_tax_due || 0).toLocaleString("uk-UA")} грн | Сплачено: {(dashboardData?.mil_paid || 0).toLocaleString("uk-UA")} грн</span>
                              </div>
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {dashboardData?.mil_diff > 0 ? `+${dashboardData?.mil_diff?.toLocaleString("uk-UA")} грн` : dashboardData?.mil_diff < 0 ? `Переплата: ${Math.abs(dashboardData?.mil_diff)?.toLocaleString("uk-UA")} грн` : `Сплачено`}
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                              <div>
                                <span className="text-xs text-slate-600 dark:text-slate-400 block">ЄСВ</span>
                                <span className="text-[10px] text-slate-400">Нараховано: {(dashboardData?.esv_due || 0).toLocaleString("uk-UA")} грн | Сплачено: {(dashboardData?.esv_paid || 0).toLocaleString("uk-UA")} грн</span>
                              </div>
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {dashboardData?.esv_diff > 0 ? `+${dashboardData?.esv_diff?.toLocaleString("uk-UA")} грн` : dashboardData?.esv_diff < 0 ? `Переплата: ${Math.abs(dashboardData?.esv_diff)?.toLocaleString("uk-UA")} грн` : `Сплачено`}
                              </span>
                            </div>
                            {((dashboardData?.employee_pit_due || 0) > 0 || (dashboardData?.pit_diff || 0) > 0) && (
                              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2">
                                <div>
                                  <span className="text-xs text-slate-600 dark:text-slate-400 block">ПДФО з зарплати працівників</span>
                                  <span className="text-[10px] text-slate-400">Нараховано: {(dashboardData?.employee_pit_due || 0).toLocaleString("uk-UA")} грн | Сплачено: {(dashboardData?.pit_paid || 0).toLocaleString("uk-UA")} грн</span>
                                </div>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {dashboardData?.pit_diff > 0 ? `+${dashboardData?.pit_diff?.toLocaleString("uk-UA")} грн` : dashboardData?.pit_diff < 0 ? `Переплата: ${Math.abs(dashboardData?.pit_diff)?.toLocaleString("uk-UA")} грн` : `Сплачено`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Monthly Breakdown */}
                        {dashboardData?.breakdown && dashboardData.breakdown.length > 1 && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800">
                            <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider block mb-2">Розшифровка по місяцях</span>
                            <div className="overflow-y-auto max-h-[150px] custom-scrollbar pr-1">
                              <table className="w-full text-xs text-left text-slate-600 dark:text-slate-400">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-medium">
                                    <th className="pb-1.5">Період</th>
                                    <th className="pb-1.5 text-right">Нараховано</th>
                                    <th className="pb-1.5 text-right">Сплачено</th>
                                    <th className="pb-1.5 text-right">Різниця</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                  {dashboardData.breakdown.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/30">
                                      <td className="py-1.5 text-slate-700 dark:text-slate-300">{item.period_name}</td>
                                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{item.total_due?.toLocaleString("uk-UA")} грн</td>
                                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{item.tax_paid?.toLocaleString("uk-UA")} грн</td>
                                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">
                                        {item.difference > 0 ? `${item.difference?.toLocaleString("uk-UA")} грн` : 'Сплачено'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0a0a0a] flex-shrink-0">
                    <button
                      onClick={() => setActiveModal(null)}
                      className="w-full py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
                    >
                      Зрозуміло
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Premium "Total Income" Modal - AI/Nano Tech Style */}
            {activeModal === "income" && (
              <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modal-backdrop"
                onClick={() => setActiveModal(null)}
              >
                <div
                  className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-lg max-w-[500px] w-full max-h-[85vh] flex flex-col shadow-sm relative overflow-hidden animate-modal-fade"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#0a0a0a] flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Загальний дохід</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-500">за весь час</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveModal(null)}
                      className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 overflow-y-auto flex-1 custom-scrollbar bg-white dark:bg-[#0a0a0a]">
                    {/* Main Number */}
                    <div className="mb-5">
                      <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider">Загальний дохід</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                          {dashboardData?.total_income?.toLocaleString("uk-UA")}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-500">грн</span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-500 block mb-1">Оподатковуваний</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {dashboardData?.taxable_income?.toLocaleString("uk-UA")} грн
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-500 block mb-1">Нараховано податку</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {((dashboardData?.tax_due || 0) + (dashboardData?.military_tax_due || 0) + (dashboardData?.esv_due || 0)).toLocaleString("uk-UA")} грн
                        </span>
                      </div>
                    </div>

                    {/* Annual Limit */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800 mb-5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-slate-500 dark:text-slate-500">
                          {isFop ? `ФОП (${dashboardData?.group || selectedProfile?.group || 3} група)` : 'ТОВ'}
                        </span>
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {fopLimit.toLocaleString("uk-UA")} грн
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded h-1.5 overflow-hidden">
                        <div
                          className="bg-slate-600 dark:bg-slate-400 h-full rounded transition-all duration-500"
                          style={{ width: `${Math.min(((dashboardData?.total_income || 0) / fopLimit) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Використано</span>
                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
                          {(((dashboardData?.total_income || 0) / fopLimit) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Monthly Breakdown */}
                    {dashboardData?.breakdown && dashboardData.breakdown.length > 1 && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider block mb-2">Розшифровка по місяцях</span>
                        <div className="overflow-y-auto max-h-[120px] custom-scrollbar pr-1">
                          <table className="w-full text-xs text-left text-slate-600 dark:text-slate-400">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-medium">
                                <th className="pb-1.5">Місяць</th>
                                <th className="pb-1.5 text-right">Дохід</th>
                                <th className="pb-1.5 text-right">Оподаткування</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                              {dashboardData.breakdown.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/30">
                                  <td className="py-1.5 text-slate-700 dark:text-slate-300">{item.period_name}</td>
                                  <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{item.total_income?.toLocaleString("uk-UA")} грн</td>
                                  <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{item.taxable_income?.toLocaleString("uk-UA")} грн</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0a0a0a] flex-shrink-0">
                    <button
                      onClick={() => setActiveModal(null)}
                      className="w-full py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
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
    </div>
  );
}
