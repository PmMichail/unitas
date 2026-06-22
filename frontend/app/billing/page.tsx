"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import {
  Users,
  Plus,
  Search,
  Trash2,
  Edit,
  CheckCircle,
  AlertTriangle,
  FileText,
  Mail,
  RefreshCw,
  CreditCard,
  Building,
  TrendingUp,
  Percent,
  Check,
  X,
  Send,
  DollarSign,
  Phone,
  Settings,
  Layers,
  Cpu,
  ArrowRight,
  ChevronRight,
  Copy,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  Eye,
  Crown,
  Clock,
  Printer,
  Download,
  History as HistoryIcon
} from "lucide-react";

interface Member {
  id: number;
  profile_id: number;
  identifier: string;
  owner_name?: string;
  area?: number;
  rate_per_sqm?: number;
  fixed_monthly_fee?: number;
  email?: string;
  phone?: string;
  balance: number;
  property_type?: string;
  parent_id?: number | null;
}

interface Transaction {
  id: number;
  date: string;
  amount: number;
  direction: string;
  purpose: string;
  contragent: string;
  type: string;
  taxable: boolean;
  transaction_type: string;
  profile_id: number;
  member_id?: number | null;
}

interface Meter {
  id: number;
  profile_id: number;
  name: string;
  type: string; // electricity, water, gas, heat
  parent_id?: number | null;
  parent_name?: string | null;
  member_id?: number | null;
  member_identifier?: string | null;
  tariff: number;
  initial_reading?: number;
  last_reading_value?: number;
  last_reading_date?: string | null;
}

export default function BillingPage() {
  const { selectedProfile } = useApp();
  const router = useRouter();
  
  // State
  const [members, setMembers] = useState<Member[]>([]);
  const [moderationMembers, setModerationMembers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingMono, setPayingMono] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true") {
        setShowSuccessBanner(true);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, []);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "debt" | "prepaid">("all");
  const [activeTab, setActiveTab] = useState<"members" | "contractors" | "payments" | "meters" | "moderation" | "resident_cabinet">("members");
  const [expandedMeters, setExpandedMeters] = useState<Record<number, boolean>>({});

  // Modals
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  
  // Member Form Fields
  const [identifier, setIdentifier] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [area, setArea] = useState<number>(0);
  const [ratePerSqm, setRatePerSqm] = useState<number>(0);
  const [fixedFee, setFixedFee] = useState<number>(0);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [balance, setBalance] = useState<number>(0);
  const [propertyType, setPropertyType] = useState("кв.");
  const [parentId, setParentId] = useState<number>(-1);

  // Charge Modal & Accrual Config
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [chargeDescription, setChargeDescription] = useState("Щомісячний внесок за утримання будинку");
  const [chargeType, setChargeType] = useState("regular");
  const [periodType, setPeriodType] = useState("monthly");
  const [chargeMultiplier, setChargeMultiplier] = useState(1);
  const [chargeAmountOverride, setChargeAmountOverride] = useState("");
  const [chargeMemberId, setChargeMemberId] = useState<number>(-1);
  const [charging, setCharging] = useState(false);
  
  // Manual Payment Matching State
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<Record<number, number>>({});
  
  // Meter Modals & Reading submission
  const [readingModalOpen, setReadingModalOpen] = useState(false);
  const [selectedMeterForReading, setSelectedMeterForReading] = useState<Meter | null>(null);
  const [readingValue, setReadingValue] = useState("");
  
  const [meterModalOpen, setMeterModalOpen] = useState(false);
  const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
  const [meterName, setMeterName] = useState("");
  const [meterType, setMeterType] = useState("water");
  const [meterParentId, setMeterParentId] = useState<number>(-1);
  const [meterMemberId, setMeterMemberId] = useState<number>(-1);
  const [meterTariff, setMeterTariff] = useState<number>(0);

  // Auto-matching State
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<{ count: number; amount: number } | null>(null);

  // Meter Initial Reading
  const [meterInitialReading, setMeterInitialReading] = useState<number>(0);

  // Member details modal state
  const [memberDetailsModalOpen, setMemberDetailsModalOpen] = useState(false);
  const [selectedMemberDetails, setSelectedMemberDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Lock readings state
  const [lockMonth, setLockMonth] = useState<number>(new Date().getMonth() + 1);
  const [lockYear, setLockYear] = useState<number>(new Date().getFullYear());
  const [lockLoading, setLockLoading] = useState(false);
  
  // Custom reading date
  const [readingDate, setReadingDate] = useState("");

  // Notifications/Toasts
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Resident Cabinet Module State
  const [residentCabinetStatus, setResidentCabinetStatus] = useState<any>(null);
  const [residentCabinetModalOpen, setResidentCabinetModalOpen] = useState(false);
  const [rcModalStep, setRcModalStep] = useState<"configure" | "review" | "payment">("configure");
  const [rcSlug, setRcSlug] = useState("");
  const [rcMonoApiToken, setRcMonoApiToken] = useState("");
  const [rcColorTheme, setRcColorTheme] = useState("#3b82f6");
  const [rcPurchasing, setRcPurchasing] = useState(false);
  const [rcLoading, setRcLoading] = useState(false);

  // Contractors Module State
  const [contractors, setContractors] = useState<any[]>([]);
  const [contractorSearchTerm, setContractorSearchTerm] = useState("");
  const [contractorTypeFilter, setContractorTypeFilter] = useState("all");
  const [contractorModalOpen, setContractorModalOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<any | null>(null);
  const [contractorName, setContractorName] = useState("");
  const [contractorType, setContractorType] = useState("provider");
  const [contractorTaxId, setContractorTaxId] = useState("");
  const [contractorPhone, setContractorPhone] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [contractorAddress, setContractorAddress] = useState("");
  const [contractorInitialBalance, setContractorInitialBalance] = useState<number>(0);

  const [contractorTxModalOpen, setContractorTxModalOpen] = useState(false);
  const [selectedContractorForTx, setSelectedContractorForTx] = useState<any | null>(null);
  const [contractorTxType, setContractorTxType] = useState<"income" | "expense">("expense");
  const [contractorTxAmount, setContractorTxAmount] = useState("");
  const [contractorTxDescription, setContractorTxDescription] = useState("");
  const [contractorTxDate, setContractorTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [contractorTxDocumentUrl, setContractorTxDocumentUrl] = useState("");

  const [contractorHistoryModalOpen, setContractorHistoryModalOpen] = useState(false);
  const [selectedContractorForHistory, setSelectedContractorForHistory] = useState<any | null>(null);
  const [contractorHistoryData, setContractorHistoryData] = useState<any[]>([]);
  const [loadingContractorHistory, setLoadingContractorHistory] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const loadData = async () => {
    if (!selectedProfile) return;
    setLoading(true);
    try {
      const fetchedMembers = await api.getMembers(selectedProfile.id);
      setMembers(fetchedMembers || []);

      const fetchedModerationMembers = await api.getMembersModeration(selectedProfile.id);
      setModerationMembers(fetchedModerationMembers || []);

      const fetchedTx = await api.getTransactions(selectedProfile.id);
      setTransactions(fetchedTx || []);

      const fetchedMeters = await api.getMeters(selectedProfile.id);
      setMeters(fetchedMeters || []);

      const fetchedContractors = await api.getContractors(selectedProfile.id);
      setContractors(fetchedContractors || []);

      setError(null);
    } catch (err: any) {
      console.error("Error fetching billing data", err);
      setError("Не вдалося завантажити дані. Будь ласка, перевірте з'єднання.");
    } finally {
      setLoading(false);
    }
  };

  const getContractorTypeLabel = (type: string) => {
    switch (type) {
      case "provider":
        return "Постачальник послуг";
      case "contractor":
        return "Підрядник";
      case "tenant":
        return "Орендар";
      case "bank":
        return "Банк";
      default:
        return "Інше";
    }
  };

  const renderContractorBalance = (balance: number) => {
    if (balance > 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold">
          +{balance.toLocaleString("uk-UA")} грн (передплата)
        </span>
      );
    } else if (balance < 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold">
          {balance.toLocaleString("uk-UA")} грн (борг)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 font-extrabold">
          0 грн
        </span>
      );
    }
  };

  const loadResidentCabinetStatus = async () => {
    if (!selectedProfile) return;
    setRcLoading(true);
    try {
      const status = await api.getResidentCabinetStatus(selectedProfile.id);
      setResidentCabinetStatus(status);
      if (status.is_active) {
        setRcSlug(status.slug || "");
        setRcColorTheme(status.color_theme || "#3b82f6");
      }
    } catch (err: any) {
      console.error("Error fetching resident cabinet status", err);
    } finally {
      setRcLoading(false);
    }
  };

  const handleOpenResidentCabinetModal = () => {
    if (!selectedProfile) return;
    // Auto-fill data from profile registration
    setRcSlug(selectedProfile.name?.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "");
    setRcColorTheme("#3b82f6");
    setRcMonoApiToken("");
    setRcModalStep("configure");
    setResidentCabinetModalOpen(true);
  };

  const handlePurchaseResidentCabinet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    
    if (rcModalStep === "configure") {
      if (!rcSlug.trim()) {
        showToast("Вкажіть slug для URL", "error");
        return;
      }
      if (!rcMonoApiToken.trim()) {
        showToast("Вкажіть Mono API Token", "error");
        return;
      }
      setRcModalStep("review");
      return;
    }

    if (rcModalStep === "review") {
      setRcPurchasing(true);
      try {
        await api.purchaseResidentCabinet(selectedProfile.id, {
          slug: rcSlug,
          mono_api_token: rcMonoApiToken,
          color_theme: rcColorTheme,
        });
        showToast("Налаштування кабінету мешканця успішно збережено!", "success");
        setResidentCabinetModalOpen(false);
        loadResidentCabinetStatus();
      } catch (err: any) {
        console.error(err);
        showToast(err.response?.data?.detail || "Помилка при збереженні налаштувань", "error");
      } finally {
        setRcPurchasing(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProfile?.id]);

  useEffect(() => {
    if (selectedProfile) {
      loadResidentCabinetStatus();
    }
  }, [selectedProfile?.id]);

  const handleOpenAddModal = () => {
    setEditingMember(null);
    setIdentifier("");
    setOwnerName("");
    setArea(0);
    setRatePerSqm(0);
    setFixedFee(0);
    setEmail("");
    setPhone("");
    setBalance(0);
    setPropertyType(activeTab === "contractors" ? "провайдер" : "кв.");
    setParentId(-1);
    setMemberModalOpen(true);
  };

  const handleOpenEditModal = (member: Member) => {
    setEditingMember(member);
    setIdentifier(member.identifier);
    setOwnerName(member.owner_name || "");
    setArea(member.area || 0);
    setRatePerSqm(member.rate_per_sqm || 0);
    setFixedFee(member.fixed_monthly_fee || 0);
    setEmail(member.email || "");
    setPhone(member.phone || "");
    setBalance(member.balance || 0);
    setPropertyType(member.property_type || "кв.");
    setParentId(member.parent_id || -1);
    setMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    if (!identifier.trim()) {
      showToast("Вкажіть номер квартири/ділянки/об'єкта", "error");
      return;
    }

    try {
      const payload: any = {
        identifier,
        owner_name: ownerName || undefined,
        area: area || 0,
        rate_per_sqm: ratePerSqm || 0,
        fixed_monthly_fee: fixedFee || 0,
        email: email || undefined,
        phone: phone || undefined,
        balance: balance || 0,
        property_type: propertyType,
        parent_id: parentId !== -1 ? parentId : undefined
      };

      if (editingMember) {
        await api.updateMember(selectedProfile.id, editingMember.id, payload);
        showToast("Дані об'єкта успішно оновлено!");
      } else {
        await api.createMember(selectedProfile.id, payload);
        showToast("Новий об'єкт успішно додано!");
      }

      setMemberModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Помилка при збереженні об'єкта", "error");
    }
  };

  const handleDeleteMember = async (memberId: number) => {
    if (!selectedProfile) return;
    if (!confirm("Ви впевнені, що хочете видалити цей об'єкт зі списку?")) return;

    try {
      await api.deleteMember(selectedProfile.id, memberId);
      showToast("Об'єкт успішно видалено");
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast("Помилка при видаленні об'єкта", "error");
    }
  };

  const handleOpenAddContractorModal = () => {
    setEditingContractor(null);
    setContractorName("");
    setContractorType("provider");
    setContractorTaxId("");
    setContractorPhone("");
    setContractorEmail("");
    setContractorAddress("");
    setContractorInitialBalance(0);
    setContractorModalOpen(true);
  };

  const handleOpenEditContractorModal = (c: any) => {
    setEditingContractor(c);
    setContractorName(c.name || "");
    setContractorType(c.type || "provider");
    setContractorTaxId(c.tax_id || "");
    setContractorPhone(c.phone || "");
    setContractorEmail(c.email || "");
    setContractorAddress(c.address || "");
    setContractorInitialBalance(c.initial_balance || 0);
    setContractorModalOpen(true);
  };

  const handleSaveContractor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    if (!contractorName.trim()) {
      showToast("Вкажіть назву контрагента", "error");
      return;
    }

    try {
      const payload = {
        profile_id: selectedProfile.id,
        name: contractorName,
        type: contractorType,
        tax_id: contractorTaxId || undefined,
        phone: contractorPhone || undefined,
        email: contractorEmail || undefined,
        address: contractorAddress || undefined,
        initial_balance: Number(contractorInitialBalance) || 0,
      };

      if (editingContractor) {
        await api.updateContractor(editingContractor.id, payload);
        showToast("Контрагента успішно оновлено!");
      } else {
        await api.createContractor(payload);
        showToast("Контрагента успішно додано!");
      }

      setContractorModalOpen(false);
      const fetchedContractors = await api.getContractors(selectedProfile.id);
      setContractors(fetchedContractors || []);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Помилка збереження контрагента", "error");
    }
  };

  const handleDeleteContractor = async (id: number) => {
    if (!selectedProfile) return;
    if (!confirm("Ви впевнені, що хочете видалити цього контрагента?")) return;

    try {
      await api.deleteContractor(id);
      showToast("Контрагента видалено");
      const fetchedContractors = await api.getContractors(selectedProfile.id);
      setContractors(fetchedContractors || []);
    } catch (err: any) {
      console.error(err);
      showToast("Помилка при видаленні контрагента", "error");
    }
  };

  const handleOpenContractorTxModal = (c: any, type: "income" | "expense") => {
    setSelectedContractorForTx(c);
    setContractorTxType(type);
    setContractorTxAmount("");
    setContractorTxDescription("");
    setContractorTxDate(new Date().toISOString().split("T")[0]);
    setContractorTxDocumentUrl("");
    setContractorTxModalOpen(true);
  };

  const handleSaveContractorTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractorForTx) return;
    if (!contractorTxAmount.trim() || isNaN(Number(contractorTxAmount)) || Number(contractorTxAmount) <= 0) {
      showToast("Вкажіть коректну суму операції", "error");
      return;
    }
    if (!contractorTxDescription.trim()) {
      showToast("Вкажіть призначення платежу", "error");
      return;
    }

    try {
      const payload = {
        type: contractorTxType,
        amount: Number(contractorTxAmount),
        description: contractorTxDescription,
        transaction_date: contractorTxDate,
        document_url: contractorTxDocumentUrl || undefined,
        user_id: selectedProfile?.user_id
      };

      await api.createContractorTransaction(selectedContractorForTx.id, payload);
      showToast("Транзакцію успішно додано!");
      setContractorTxModalOpen(false);

      const fetchedContractors = await api.getContractors(selectedProfile.id);
      setContractors(fetchedContractors || []);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Помилка при збереженні транзакції", "error");
    }
  };

  const handleOpenContractorHistoryModal = async (c: any) => {
    setSelectedContractorForHistory(c);
    setHistoryStartDate("");
    setHistoryEndDate("");
    setLoadingContractorHistory(true);
    setContractorHistoryModalOpen(true);
    try {
      const res = await api.getContractorTransactions(c.id);
      setContractorHistoryData(res.transactions || []);
    } catch (err: any) {
      console.error(err);
      showToast("Не вдалося завантажити історію транзакцій", "error");
    } finally {
      setLoadingContractorHistory(false);
    }
  };

  const handleExportContractorCSV = () => {
    if (!selectedContractorForHistory) return;
    const filteredTxs = contractorHistoryData.filter((t) => {
      if (historyStartDate && t.transaction_date < historyStartDate) return false;
      if (historyEndDate && t.transaction_date > historyEndDate) return false;
      return true;
    });

    const headers = ["ID", "Дата", "Тип", "Сума (грн)", "Призначення", "Документ"];
    const rows = filteredTxs.map((t) => [
      t.id,
      t.transaction_date,
      t.type === "income" ? "Прихід" : "Видаток",
      t.amount,
      t.description.replace(/"/g, '""'),
      t.document_url || ""
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `contractor_${selectedContractorForHistory.id}_transactions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintContractorHistory = () => {
    if (!selectedContractorForHistory) return;
    const filteredTxs = contractorHistoryData.filter((t) => {
      if (historyStartDate && t.transaction_date < historyStartDate) return false;
      if (historyEndDate && t.transaction_date > historyEndDate) return false;
      return true;
    });
    const totalIn = filteredTxs.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    const totalOut = filteredTxs.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    const balanceDiff = ["provider", "contractor", "bank"].includes(selectedContractorForHistory.type)
      ? totalOut - totalIn
      : totalIn - totalOut;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Історія транзакцій - ${selectedContractorForHistory.name}</title>
          <style>
            body { font-family: 'Outfit', 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #1e293b; }
            h2 { margin-bottom: 5px; }
            .meta { color: #64748b; font-size: 14px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 14px; }
            th { background-color: #f8fafc; font-weight: bold; }
            .income { color: #16a34a; font-weight: bold; }
            .expense { color: #dc2626; font-weight: bold; }
            .totals { margin-top: 30px; font-size: 14px; width: 300px; float: right; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1; }
            .totals-row.final { font-weight: bold; border-bottom: 2px solid #1e293b; font-size: 16px; }
          </style>
        </head>
        <body>
          <h2>Історія транзакцій: ${selectedContractorForHistory.name}</h2>
          <div class="meta">
            Період: ${historyStartDate || "початок"} — ${historyEndDate || "сьогодні"}<br/>
            Сгенеровано: ${new Date().toLocaleDateString("uk-UA")}
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Дата</th>
                <th>Тип</th>
                <th>Сума</th>
                <th>Призначення</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTxs.map(t => `
                <tr>
                  <td>#${t.id}</td>
                  <td>${t.transaction_date}</td>
                  <td>${t.type === "income" ? "Прихід" : "Видаток"}</td>
                  <td class="${t.type === "income" ? "income" : "expense"}">
                    ${t.type === "income" ? "+" : "-"}${t.amount.toLocaleString("uk-UA")} грн
                  </td>
                  <td>${t.description}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="totals">
            <div class="totals-row">
              <span>Прихід:</span>
              <span class="income">+${totalIn.toLocaleString("uk-UA")} грн</span>
            </div>
            <div class="totals-row">
              <span>Видаток:</span>
              <span class="expense">-${totalOut.toLocaleString("uk-UA")} грн</span>
            </div>
            <div class="totals-row final">
              <span>Сальдо змін:</span>
              <span class="${balanceDiff >= 0 ? "income" : "expense"}">
                ${balanceDiff >= 0 ? "+" : ""}${balanceDiff.toLocaleString("uk-UA")} грн
              </span>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCharge = async () => {
    if (!selectedProfile) return;
    setCharging(true);
    try {
      const payload: any = {
        description: chargeDescription,
        charge_type: chargeType,
        period_type: periodType,
        multiplier: chargeMultiplier,
      };
      if (chargeAmountOverride.trim() !== "") {
        payload.amount = parseFloat(chargeAmountOverride) || 0;
      }
      if (chargeMemberId !== -1) {
        payload.member_id = chargeMemberId;
      }
      const res = await api.chargeMembers(selectedProfile.id, payload);
      showToast(res.message || "Нарахування внесків успішно виконано!");
      setChargeModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast("Помилка нарахування внесків", "error");
    } finally {
      setCharging(false);
    }
  };

  const handleMatchPayments = async () => {
    if (!selectedProfile) return;
    setMatching(true);
    setMatchResult(null);
    try {
      const res = await api.matchPayments(selectedProfile.id, {});
      setMatchResult({
        count: res.matched_count || 0,
        amount: res.matched_amount || 0,
      });
      showToast(res.message || "Зіставлення виписок завершено!");
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast("Помилка під час автоматичного зіставлення платежів", "error");
    } finally {
      setMatching(false);
    }
  };

  const handleManualReconcile = async (paymentId: number) => {
    const memberId = selectedMemberForPayment[paymentId];
    if (!memberId) {
      showToast("Оберіть мешканця для зіставлення", "error");
      return;
    }
    if (!selectedProfile) return;
    try {
      await api.reconcilePayment(selectedProfile.id, {
        payment_id: paymentId,
        member_id: memberId,
      });
      showToast("Платіж успішно проведено на обраного абонента!");
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast("Помилка ручного проведення платежу", "error");
    }
  };

  const handleOpenAddMeterModal = () => {
    setEditingMeter(null);
    setMeterName("");
    setMeterType("water");
    setMeterParentId(-1);
    setMeterMemberId(-1);
    setMeterTariff(0);
    setMeterInitialReading(0);
    setMeterModalOpen(true);
  };

  const handleOpenEditMeterModal = (meter: Meter) => {
    setEditingMeter(meter);
    setMeterName(meter.name);
    setMeterType(meter.type);
    setMeterParentId(meter.parent_id || -1);
    setMeterMemberId(meter.member_id || -1);
    setMeterTariff(meter.tariff);
    setMeterInitialReading(meter.initial_reading || 0);
    setMeterModalOpen(true);
  };

  const handleSaveMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    if (!meterName.trim()) {
      showToast("Вкажіть назву лічильника", "error");
      return;
    }
    try {
      const payload = {
        name: meterName,
        type: meterType,
        parent_id: meterParentId !== -1 ? meterParentId : undefined,
        member_id: meterMemberId !== -1 ? meterMemberId : undefined,
        tariff: meterTariff || 0,
        initial_reading: meterInitialReading || 0,
      };

      if (editingMeter) {
        await api.updateMeter(selectedProfile.id, editingMeter.id, payload);
        showToast("Лічильник оновлено!");
      } else {
        await api.createMeter(selectedProfile.id, payload);
        showToast("Лічильник успішно створено!");
      }
      setMeterModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast("Помилка збереження лічильника", "error");
    }
  };

  const handleDeleteMeter = async (meterId: number) => {
    if (!selectedProfile) return;
    if (!confirm("Ви впевнені, що хочете видалити цей лічильник?")) return;
    try {
      await api.deleteMeter(selectedProfile.id, meterId);
      showToast("Лічильник успішно видалено");
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast("Помилка видалення лічильника", "error");
    }
  };

  const handleOpenReadingModal = (meter: Meter) => {
    setSelectedMeterForReading(meter);
    setReadingValue("");
    setReadingDate(new Date().toISOString().split('T')[0]);
    setReadingModalOpen(true);
  };

  const handleAddReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile || !selectedMeterForReading) return;
    if (readingValue === "") {
      showToast("Вкажіть значення лічильника", "error");
      return;
    }
    try {
      await api.addMeterReading(selectedProfile.id, selectedMeterForReading.id, {
        reading_value: parseFloat(readingValue),
        reading_date: readingDate || undefined
      });
      showToast("Показники лічильника додано успішно!");
      setReadingModalOpen(false);
      setReadingValue("");
      loadData();
      if (selectedMemberDetails) {
        handleOpenMemberDetails(selectedMemberDetails.member.id);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Помилка при додаванні показників", "error");
    }
  };

  const handleLockReadings = async () => {
    if (!selectedProfile) return;
    setLockLoading(true);
    try {
      const res = await api.lockReadings(selectedProfile.id, {
        month: lockMonth,
        year: lockYear
      });
      showToast(res.message || "Покази успішно зафіксовані!");
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Помилка при фіксації показів", "error");
    } finally {
      setLockLoading(false);
    }
  };

  const handleDeleteMeterReading = async (meterId: number, readingId: number) => {
    if (!selectedProfile) return;
    if (!confirm("Ви впевнені, що хочете видалити цей показ?")) return;
    try {
      await api.deleteMeterReading(selectedProfile.id, meterId, readingId);
      showToast("Показ успішно видалено");
      loadData();
      if (selectedMemberDetails) {
        handleOpenMemberDetails(selectedMemberDetails.member.id);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Помилка при видаленні показу", "error");
    }
  };

  const handleOpenMemberDetails = async (memberId: number) => {
    if (!selectedProfile) return;
    setLoadingDetails(true);
    setSelectedMemberDetails(null);
    setMemberDetailsModalOpen(true);
    try {
      const details = await api.getMemberDetails(selectedProfile.id, memberId);
      setSelectedMemberDetails(details);
    } catch (err: any) {
      console.error("Error loading member details", err);
      showToast("Не вдалося завантажити картку абонента", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleModerateMember = async (memberId: number, status: "approved" | "blocked" | "pending") => {
    if (!selectedProfile) return;
    try {
      await api.updateMemberModeration(selectedProfile.id, memberId, { status });
      showToast(status === "approved" ? "Мешканця підтверджено" : status === "blocked" ? "Мешканця заблоковано" : "Статус повернено в очікування");
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Помилка модерації мешканця", "error");
    }
  };

  const handlePayMonoInvoice = async (member: any) => {
    if (!selectedProfile) return;
    const amountToPay = Math.abs(member.balance);
    if (amountToPay <= 0) {
      showToast("Баланс позитивний або нульовий", "info");
      return;
    }
    setPayingMono(true);
    try {
      const res = await api.createMonoInvoice(selectedProfile.id, {
        member_id: member.id,
        amount: amountToPay,
        charge_type: "regular",
        description: `Оплата заборгованості особового рахунку ${member.identifier}`
      });
      if (res.pageUrl) {
        window.open(res.pageUrl, "_blank");
        showToast("Рахунок Mono Pay створено. Відкриваємо сторінку оплати...", "success");
      } else {
        showToast("Не вдалося отримати посилання на оплату", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Помилка при створенні рахунку", "error");
    } finally {
      setPayingMono(false);
    }
  };

  // Calculations for stats
  const totalDebt = members
    .filter((m) => m.property_type !== "провайдер" && m.balance < 0)
    .reduce((sum, m) => sum + Math.abs(m.balance), 0);
  
  const totalPrepaid = members
    .filter((m) => m.property_type !== "провайдер" && m.balance > 0)
    .reduce((sum, m) => sum + m.balance, 0);

  const estimatedMonthlyAccruals = members
    .filter((m) => m.property_type !== "провайдер")
    .reduce((sum, m) => {
      if (m.rate_per_sqm && m.area) {
        return sum + m.rate_per_sqm * m.area;
      }
      return sum + (m.fixed_monthly_fee || 0);
    }, 0);

  // Filtered members list
  const filteredMembers = members.filter((m) => {
    const isProvider = m.property_type === "провайдер";
    if (isProvider) return false;

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      m.identifier.toLowerCase().includes(searchLower) ||
      (m.owner_name && m.owner_name.toLowerCase().includes(searchLower)) ||
      (m.email && m.email.toLowerCase().includes(searchLower)) ||
      (m.phone && m.phone.toLowerCase().includes(searchLower)) ||
      (m.property_type && m.property_type.toLowerCase().includes(searchLower));

    if (balanceFilter === "debt") return matchesSearch && m.balance < 0;
    if (balanceFilter === "prepaid") return matchesSearch && m.balance > 0;
    return matchesSearch;
  });

  const getMemberIdentifier = (memberId?: number | null) => {
    if (!memberId) return null;
    const member = members.find((m) => m.id === memberId);
    return member ? `${member.property_type || "кв."} ${member.identifier}` : `ID: ${memberId}`;
  };

  if (!selectedProfile || selectedProfile.tax_system !== "non_profit") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Доступ обмежено</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Цей розділ доступний лише для неприбуткових організацій (ОСББ, СТ, ГО тощо). Будь ласка, оберіть відповідний профіль.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-12 text-slate-850 dark:text-slate-100 font-sans relative">
      {/* Custom Styles Injection */}
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
          border-color: rgba(79, 70, 229, 0.15);
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
        }
        .dark .glass-panel:hover {
          border-color: rgba(99, 102, 241, 0.2);
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.7);
        }
      `}} />

      {/* Decorative Gradients */}
      <div className="absolute top-0 left-0 w-full h-[350px] bg-gradient-to-b from-indigo-500/5 dark:from-indigo-950/20 via-transparent to-transparent pointer-events-none z-0" />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-slide-in">
          <div className={`flex items-center space-x-3 px-5 py-4 rounded-2xl shadow-xl backdrop-blur-md border ${
            toast.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
              : toast.type === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
          }`}>
            {toast.type === "success" && <CheckCircle className="w-5 h-5" />}
            {toast.type === "error" && <AlertTriangle className="w-5 h-5" />}
            {toast.type === "info" && <RefreshCw className="w-5 h-5 animate-spin" />}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 relative z-10 space-y-8">
        
        {/* Success Notification Banner */}
        {showSuccessBanner && (
          <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-250 rounded-3xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-in fade-in duration-300">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-emerald-500/20 rounded-2xl border border-emerald-500/25 shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Оплату успішно зараховано! 🎉</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Платіж за особовим рахунком успішно проведено через Mono Pay та зараховано на баланс абонента. Дякуємо!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSuccessBanner(false)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-800 transition-all cursor-pointer shadow shrink-0 self-end sm:self-center"
            >
              Зрозуміло
            </button>
          </div>
        )}

        {/* Profile Card Header */}
        <div className="p-6 rounded-3xl glass-panel bg-gradient-to-r from-slate-100/90 to-indigo-50/40 dark:from-slate-900/80 dark:to-indigo-950/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">Панель білінгу</span>
            <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400 bg-clip-text text-transparent">
              {selectedProfile.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs px-3 py-1 rounded-full border border-indigo-500/20 font-semibold uppercase">
                {selectedProfile.organization_subtype || "Неприбуткова"}
              </span>
              <span className="bg-slate-500/10 text-slate-600 dark:text-slate-300 text-xs px-3 py-1 rounded-full border border-slate-500/20 font-semibold">
                Код ознаки: {selectedProfile.non_profit_code || "0046"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <button
              onClick={handleOpenAddModal}
              className="flex-1 md:flex-initial flex items-center justify-center space-x-2 bg-indigo-650 hover:bg-indigo-650/95 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-indigo-600/15"
            >
              <Plus className="w-4 h-4" />
              <span>{activeTab === "contractors" ? "Додати контрагента" : "Додати об'єкт"}</span>
            </button>
            
            <button
              onClick={() => {
                setChargeDescription("Чергове нарахування внесків");
                setChargeType("regular");
                setPeriodType("monthly");
                setChargeMultiplier(1);
                setChargeAmountOverride("");
                setChargeMemberId(-1);
                setChargeModalOpen(true);
              }}
              className="flex-1 md:flex-initial flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-550 text-white rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:scale-[1.02]"
            >
              <FileText className="w-4 h-4" />
              <span>Нарахувати внески</span>
            </button>

            <button
              onClick={handleMatchPayments}
              disabled={matching}
              className="flex-1 md:flex-initial flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${matching ? "animate-spin" : ""}`} />
              <span>Зіставити виписку</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl glass-panel">
            <div className="flex justify-between items-start">
              <p className="text-slate-400 text-sm font-medium">Загальний борг мешканців</p>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-4">
              -{totalDebt.toLocaleString("uk-UA")} <span className="text-sm font-medium">грн</span>
            </h3>
            <p className="text-xs text-slate-400 mt-2">Кошти, що очікують до сплати</p>
          </div>

          <div className="p-6 rounded-2xl glass-panel">
            <div className="flex justify-between items-start">
              <p className="text-slate-400 text-sm font-medium">Загальна переплата</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-4">
              +{totalPrepaid.toLocaleString("uk-UA")} <span className="text-sm font-medium">грн</span>
            </h3>
            <p className="text-xs text-slate-400 mt-2">Передплата на особових рахунках</p>
          </div>

          <div className="p-6 rounded-2xl glass-panel">
            <div className="flex justify-between items-start">
              <p className="text-slate-400 text-sm font-medium">Планові щомісячні внески</p>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-indigo-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-4">
              {estimatedMonthlyAccruals.toLocaleString("uk-UA")} <span className="text-sm font-medium">грн</span>
            </h3>
            <p className="text-xs text-slate-400 mt-2">Розрахункова сума щомісячних зборів</p>
          </div>

          <div className="p-6 rounded-2xl glass-panel">
            <div className="flex justify-between items-start">
              <p className="text-slate-400 text-sm font-medium">Зареєстровано об'єктів</p>
              <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-4">
              {members.length} <span className="text-sm font-medium">од.</span>
            </h3>
            <p className="text-xs text-slate-400 mt-2">Квартири, ділянки, паркомісця тощо</p>
          </div>
        </div>

        {/* Matching Result Notification Card */}
        {matchResult !== null && (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-emerald-555" />
              <div>
                <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Автоматичне зіставлення завершено!</h4>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-450">
                  Успішно ідентифіковано <span className="font-extrabold">{matchResult.count}</span> платежів на загальну суму <span className="font-extrabold">{matchResult.amount.toLocaleString("uk-UA")} грн</span>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setMatchResult(null)}
              className="text-emerald-500 hover:text-emerald-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tabs and Filtering */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/60 pb-4">
          <div className="flex space-x-2 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800/40 w-full md:w-auto">
            <button
              onClick={() => setActiveTab("members")}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "members" 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-250"
              }`}
            >
              Список мешканців ({members.filter(m => m.property_type !== "провайдер").length})
            </button>
            <button
              onClick={() => setActiveTab("contractors")}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "contractors" 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-250"
              }`}
            >
              Контрагенти ({contractors.length})
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "payments" 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-250"
              }`}
            >
              Зіставлення платежів ({transactions.filter(t => t.direction === "in").length})
            </button>
            <button
              onClick={() => setActiveTab("meters")}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "meters" 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-250"
              }`}
            >
              Лічильники ({meters.length})
            </button>
            <button
              onClick={() => setActiveTab("moderation")}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "moderation"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-250"
              }`}
            >
              Модерація ({moderationMembers.filter(m => m.status === "pending").length})
            </button>
            <button
              onClick={() => setActiveTab("resident_cabinet")}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "resident_cabinet"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-250"
              }`}
            >
              Кабінет мешканця
            </button>
          </div>

          {activeTab === "members" && (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleOpenAddModal}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Додати мешканця</span>
              </button>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Пошук об'єкта, ПІБ, типу..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <select
                value={balanceFilter}
                onChange={(e: any) => setBalanceFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Усі баланси</option>
                <option value="debt">Тільки боржники</option>
                <option value="prepaid">Тільки з передплатою</option>
              </select>
            </div>
          )}

          {activeTab === "contractors" && (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleOpenAddContractorModal}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Додати контрагента</span>
              </button>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Пошук за назвою, ЄДРПОУ..."
                  value={contractorSearchTerm}
                  onChange={(e) => setContractorSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <select
                value={contractorTypeFilter}
                onChange={(e: any) => setContractorTypeFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Усі типи</option>
                <option value="provider">Постачальник послуг</option>
                <option value="contractor">Підрядник</option>
                <option value="tenant">Орендар</option>
                <option value="bank">Банк</option>
                <option value="other">Інше</option>
              </select>
            </div>
          )}

          {activeTab === "moderation" && (
            <div className="text-xs text-slate-500 dark:text-slate-400 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              Pending-акаунти не мають доступу до кабінету мешканця до підтвердження.
            </div>
          )}

          {activeTab === "meters" && (
            <button
              onClick={handleOpenAddMeterModal}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Додати лічильник</span>
            </button>
          )}
        </div>

        {/* Moderation Table */}
        {activeTab === "moderation" && (
          <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800/60 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/60 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <th className="px-6 py-4">Об'єкт</th>
                    <th className="px-6 py-4">Власник</th>
                    <th className="px-6 py-4">Особовий рахунок</th>
                    <th className="px-6 py-4">Статус</th>
                    <th className="px-6 py-4">Підтверджено</th>
                    <th className="px-6 py-4 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 text-sm">
                  {moderationMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">Заявок на модерацію немає</td>
                    </tr>
                  ) : (
                    moderationMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors duration-150">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{m.property_type || "кв."} {m.identifier}</td>
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                          <div className="font-medium">{m.owner_name || "—"}</div>
                          <div className="text-xs text-slate-400">{m.email || m.phone || "контакти не вказано"}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{m.account_number || "не зареєстровано"}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${m.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : m.status === "blocked" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                            {m.status === "approved" ? "approved" : m.status === "blocked" ? "blocked" : "pending"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{m.verified_at ? new Date(m.verified_at).toLocaleString("uk-UA") : "—"}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {m.status !== "approved" && (
                              <button onClick={() => handleModerateMember(m.id, "approved")} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                                Підтвердити
                              </button>
                            )}
                            {m.status !== "blocked" && (
                              <button onClick={() => handleModerateMember(m.id, "blocked")} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">
                                Заблокувати
                              </button>
                            )}
                            {m.status !== "pending" && (
                              <button onClick={() => handleModerateMember(m.id, "pending")} className="px-3 py-2 rounded-xl bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold">
                                В очікування
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Resident Cabinet Module Tab */}
        {activeTab === "resident_cabinet" && (
          <div className="space-y-6">
            {rcLoading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="w-8 h-8 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider animate-pulse">Завантаження інформації...</p>
              </div>
            ) : (
              <>
                {/* Subscription Details & Cabinet Status Card */}
                <div className="glass-panel rounded-3xl p-6 border border-slate-200 dark:border-slate-800/60 shadow-xl space-y-6 relative overflow-hidden">
                  <div className="absolute top-[-10%] right-[-10%] w-48 h-48 bg-indigo-500/5 rounded-full blur-[85px] pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800/40">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${residentCabinetStatus?.is_active ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                        {residentCabinetStatus?.is_active ? (
                          <CheckCircle className="w-6 h-6 text-emerald-500" />
                        ) : (
                          <Lock className="w-6 h-6 text-rose-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          Кабінет мешканців
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            residentCabinetStatus?.is_active 
                              ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-455 border border-rose-500/20'
                          }`}>
                            {residentCabinetStatus?.is_active ? 'Модуль активовано' : 'Модуль неактивний'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => router.push("/settings/subscription")}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.01]"
                      >
                        <Settings className="w-4 h-4" />
                        <span>📋 Скасувати модуль</span>
                      </button>
                      <button
                        onClick={() => router.push("/settings/subscription")}
                        className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/10 hover:scale-[1.01]"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>🔄 Змінити тариф</span>
                      </button>
                    </div>
                  </div>

                  {/* Pricing and tier details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/40 rounded-2xl p-5 space-y-1">
                      <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">Тарифний план</p>
                      <p className="text-base font-extrabold text-slate-900 dark:text-white capitalize">
                        {(() => {
                          const plan = residentCabinetStatus?.subscription?.plan;
                          if (plan === "premium") return "Преміум";
                          if (plan === "basic") return "Базовий";
                          if (plan === "business") return "Бізнес";
                          return "Безкоштовний";
                        })()}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Оновлення та техпідтримка</p>
                    </div>

                    <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/40 rounded-2xl p-5 space-y-1">
                      <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">Статус кабінету</p>
                      <p className="text-base font-extrabold text-slate-900 dark:text-white">
                        {residentCabinetStatus?.is_active ? (
                          <span className="text-emerald-500">Активний (+{residentCabinetStatus?.pricing?.price || 250} грн/міс)</span>
                        ) : (
                          <span className="text-rose-500">Неактивний</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {residentCabinetStatus?.is_active ? "Додано до поточної підписки" : "Модуль не підключений"}
                      </p>
                    </div>

                    <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/40 rounded-2xl p-5 space-y-1">
                      <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">Наступна оплата</p>
                      <p className="text-base font-extrabold text-slate-900 dark:text-white">
                        {residentCabinetStatus?.subscription?.expires_at ? (
                          new Date(residentCabinetStatus.subscription.expires_at).toLocaleDateString("uk-UA")
                        ) : (
                          "Не вимагається"
                        )}
                      </p>
                      {residentCabinetStatus?.subscription?.expires_at && (
                        <p className="text-xs text-indigo-500 dark:text-indigo-400 font-bold mt-1">
                          Загальна сума: {(() => {
                            const plan = residentCabinetStatus?.subscription?.plan;
                            const period = residentCabinetStatus?.subscription?.payment_period;
                            const hasModule = residentCabinetStatus?.subscription?.is_member_module_active;
                            
                            if (plan === "business") {
                              if (period === "yearly") {
                                return hasModule ? "5999 UAH/рік" : "2999 UAH/рік";
                              }
                              if (period === "half_yearly" || period === "halfyearly") {
                                return hasModule ? "2999 UAH/6 міс" : "1499 UAH/6 міс";
                              }
                              return hasModule ? "549 UAH/міс" : "299 UAH/міс";
                            }
                            
                            if (plan === "premium") {
                              return hasModule ? "1499 UAH/міс" : "999 UAH/міс";
                            }
                            if (plan === "basic") return "499 UAH/міс";
                            return "0 UAH";
                          })()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resident statistics Card */}
                <div className="glass-panel rounded-3xl p-6 border border-slate-200 dark:border-slate-800/60 shadow-xl space-y-5">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-sm font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                      Статистика особових рахунків мешканців
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/20 text-center">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black mb-1">
                        Всього особових рахунків
                      </div>
                      <div className="text-3xl font-black text-slate-900 dark:text-white">
                        {moderationMembers.length}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Кількість заведених об'єктів</div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/20 text-center">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black mb-1">
                        Зареєстровано кабінетів
                      </div>
                      <div className="text-3xl font-black text-indigo-500 dark:text-indigo-400">
                        {moderationMembers.filter(m => m.account_number).length}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Створили акаунт та пароль</div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/20 text-center">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black mb-1">
                        Очікують підтвердження
                      </div>
                      <div className="text-3xl font-black text-amber-500 dark:text-amber-400">
                        {moderationMembers.filter(m => m.account_number && m.status === "pending").length}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Потребують схвалення головою</div>
                    </div>
                  </div>
                </div>

                {/* Configuration and Domain Section */}
                {residentCabinetStatus?.is_active && (
                  <div className="glass-panel rounded-3xl p-6 border border-slate-200 dark:border-slate-800/60 shadow-xl space-y-6">
                    <h3 className="text-sm font-black text-slate-400 dark:text-slate-450 uppercase tracking-widest">
                      Доступ та налаштування кабінету
                    </h3>

                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-extrabold text-indigo-850 dark:text-indigo-300">
                            Адреса входу для мешканців
                          </div>
                          <div className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                            Мешканці вашого будинку можуть зареєструватись або авторизуватись за цією адресою:
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const url = `https://unitax.pro/osbb/${residentCabinetStatus.slug}`;
                            navigator.clipboard.writeText(url);
                            showToast("Посилання скопійовано!", "success");
                          }}
                          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 shrink-0 hover:scale-[1.01]"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Копіювати посилання</span>
                        </button>
                      </div>

                      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                        <div className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 break-all">
                          https://unitax.pro/osbb/{residentCabinetStatus.slug}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-5 border border-slate-105 dark:border-slate-800/20">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black mb-1">
                          Slug організації
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {residentCabinetStatus.slug}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Використовується в унікальному URL вашого кабінету
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-5 border border-slate-105 dark:border-slate-800/20">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black mb-1">
                          Колір інтерфейсу
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
                            style={{ backgroundColor: residentCabinetStatus.color_theme }}
                          />
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {residentCabinetStatus.color_theme || "Не встановлено"}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Основний бренд-колір кабінету мешканця
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 1: Members Table */}
        {activeTab === "members" && (
          <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800/60 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/60 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <th className="px-6 py-4">Об'єкт / Тип</th>
                    <th className="px-6 py-4">Власник</th>
                    <th className="px-6 py-4">Зв'язок (Батьківський)</th>
                    <th className="px-6 py-4">Контакти</th>
                    <th className="px-6 py-4">Параметри внеску</th>
                    <th className="px-6 py-4">Поточний баланс</th>
                    <th className="px-6 py-4 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mb-2"></div>
                        <p>Завантаження даних...</p>
                      </td>
                    </tr>
                  ) : filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                        <p>Нічого не знайдено</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const hasDebt = m.balance < 0;
                      const hasPrepay = m.balance > 0;
                      const parentMember = m.parent_id ? members.find(p => p.id === m.parent_id) : null;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors duration-150">
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                            <button
                              type="button"
                              onClick={() => handleOpenMemberDetails(m.id)}
                              className="flex items-center space-x-2.5 text-left hover:text-indigo-650 transition-colors"
                            >
                              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex flex-col items-center justify-center text-[10px] font-black">
                                <span className="uppercase text-[9px] font-medium tracking-tight text-slate-400">{(m.property_type || "кв.")}</span>
                                <span className="text-xs -mt-1 font-bold">{m.identifier}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-slate-800 dark:text-white font-bold hover:underline">
                                  {(m.property_type || "кв.")} {m.identifier}
                                </span>
                              </div>
                            </button>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">
                            <button
                              type="button"
                              onClick={() => handleOpenMemberDetails(m.id)}
                              className="hover:underline hover:text-indigo-650 transition-colors font-semibold text-left"
                            >
                              {m.owner_name || <span className="text-slate-400 italic">Не вказано</span>}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {parentMember ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400">
                                Прив'язка до: {parentMember.property_type || "кв."} {parentMember.identifier}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Немає</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 space-y-1">
                            {m.email && (
                              <div className="flex items-center">
                                <Mail className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                <a href={`mailto:${m.email}`} className="hover:text-indigo-650 hover:underline">{m.email}</a>
                              </div>
                            )}
                            {m.phone && (
                              <div className="flex items-center">
                                <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                <a href={`tel:${m.phone}`} className="font-semibold text-indigo-600 hover:underline">{m.phone}</a>
                              </div>
                            )}
                            {!m.email && !m.phone && <span className="text-slate-400 italic">-</span>}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 space-y-1">
                            {m.area && m.rate_per_sqm ? (
                              <div>
                                <span className="font-semibold text-slate-700 dark:text-slate-355">{m.area} кв.м</span> @ <span className="font-semibold text-indigo-550 dark:text-indigo-400">{m.rate_per_sqm} грн/кв.м</span>
                                <div className="text-[10px] text-slate-450 mt-0.5">(= {(m.area * m.rate_per_sqm).toFixed(2)} грн/міс)</div>
                              </div>
                            ) : m.fixed_monthly_fee ? (
                              <div>
                                Фіксований: <span className="font-semibold text-indigo-550 dark:text-indigo-400">{m.fixed_monthly_fee} грн/міс</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Не встановлено</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-bold">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs ${
                              hasDebt 
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" 
                                : hasPrepay 
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }`}>
                              {m.balance > 0 ? "+" : ""}
                              {m.balance.toLocaleString("uk-UA")} грн
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {m.email && (
                                <button
                                  onClick={() => showToast(`Рахунок надіслано на email: ${m.email}`)}
                                  title="Надіслати квитанцію"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                >
                                  <Mail className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditModal(m)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteMember(m.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 1.5: Contractors Grid */}
        {activeTab === "contractors" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full text-center py-12 text-slate-400">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mb-2"></div>
                <p>Завантаження даних...</p>
              </div>
            ) : (() => {
              const filteredContractors = contractors.filter((c) => {
                const searchLower = contractorSearchTerm.toLowerCase();
                const matchesSearch =
                  c.name.toLowerCase().includes(searchLower) ||
                  (c.tax_id && c.tax_id.toLowerCase().includes(searchLower)) ||
                  (c.email && c.email.toLowerCase().includes(searchLower)) ||
                  (c.phone && c.phone.toLowerCase().includes(searchLower));

                if (contractorTypeFilter !== "all" && c.type !== contractorTypeFilter) return false;
                return matchesSearch;
              });

              if (filteredContractors.length === 0) {
                return (
                  <div className="col-span-full text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-xl">
                    <Users className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Контрагентів не знайдено</p>
                    <p className="text-xs text-slate-400 mt-1">Додайте нового контрагента, щоб розпочати роботу</p>
                  </div>
                );
              }

              return filteredContractors.map((c) => {
                return (
                  <div key={c.id} className="glass-panel bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/60 p-6 shadow-xl hover:shadow-2xl transition-all duration-350 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
                    <div>
                      {/* Badge and Name */}
                      <div className="flex justify-between items-start mb-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                          c.type === "provider" 
                            ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-650 dark:text-indigo-400" 
                            : c.type === "contractor" 
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-650 dark:text-amber-400"
                              : c.type === "tenant" 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : c.type === "bank" 
                                  ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-650 dark:text-cyan-400"
                                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-600 dark:text-slate-400"
                        }`}>
                          {getContractorTypeLabel(c.type)}
                        </span>
                        <div className="flex space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => handleOpenEditContractorModal(c)}
                            className="p-1 rounded-lg text-slate-400 hover:text-amber-505 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            title="Редагувати"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContractor(c.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            title="Видалити"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {c.name}
                      </h4>

                      {/* Details list */}
                      <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 mb-6">
                        {c.tax_id && (
                          <div className="flex items-center">
                            <span className="font-semibold text-slate-400 dark:text-slate-500 w-16">ЄДРПОУ:</span>
                            <span className="font-mono text-slate-800 dark:text-slate-200">{c.tax_id}</span>
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center">
                            <span className="font-semibold text-slate-400 dark:text-slate-500 w-16">Тел:</span>
                            <a href={`tel:${c.phone}`} className="text-indigo-600 hover:underline">{c.phone}</a>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center">
                            <span className="font-semibold text-slate-400 dark:text-slate-500 w-16">Email:</span>
                            <a href={`mailto:${c.email}`} className="text-indigo-650 hover:underline">{c.email}</a>
                          </div>
                        )}
                        {c.address && (
                          <div className="flex items-start">
                            <span className="font-semibold text-slate-400 dark:text-slate-500 w-16 flex-shrink-0">Адреса:</span>
                            <span className="truncate" title={c.address}>{c.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Balance and Actions */}
                    <div className="border-t border-slate-150 dark:border-slate-800/60 pt-4 mt-auto">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Поточний баланс:</span>
                        {renderContractorBalance(c.balance)}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleOpenContractorTxModal(c, "expense")}
                          className="flex items-center justify-center space-x-1 py-2 text-[11px] font-black uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl transition-all"
                        >
                          <DollarSign className="w-3 h-3" />
                          <span>Сплатити</span>
                        </button>
                        <button
                          onClick={() => handleOpenContractorTxModal(c, "income")}
                          className="flex items-center justify-center space-x-1 py-2 text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-450 rounded-xl transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Отримати</span>
                        </button>
                        <button
                          onClick={() => handleOpenContractorHistoryModal(c)}
                          className="flex items-center justify-center space-x-1 py-2 text-[11px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-650 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/50 transition-all"
                        >
                          <HistoryIcon className="w-3 h-3" />
                          <span>Історія</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Tab 2: Bank Payments Matching View */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl glass-panel bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/60">
              <h3 className="text-md font-bold text-slate-900 dark:text-white flex items-center mb-2">
                <CheckCircle className="w-5 h-5 text-indigo-500 mr-2" />
                Ручне проведення та розпізнавання платежів
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-4xl">
                Нижче наведено перелік вхідних платежів по банку. Якщо автоматична система не розпізнала призначення, 
                ви можете самостійно вибрати мешканця/об'єкт зі списку і зв'язати платіж для зарахування коштів на його баланс.
              </p>
            </div>

            <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800/60 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/60 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <th className="px-6 py-4">Дата</th>
                      <th className="px-6 py-4">Платник</th>
                      <th className="px-6 py-4">Призначення платежу</th>
                      <th className="px-6 py-4">Сума</th>
                      <th className="px-6 py-4">Статус зіставлення</th>
                      <th className="px-6 py-4 text-right">Зв'язати вручну</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mb-2"></div>
                          <p>Завантаження операцій...</p>
                        </td>
                      </tr>
                    ) : transactions.filter(t => t.direction === "in").length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                          <CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                          <p>Надходжень по банку не знайдено.</p>
                        </td>
                      </tr>
                    ) : (
                      transactions.filter(t => t.direction === "in").map((t) => {
                        const matchedIdent = getMemberIdentifier(t.member_id);
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors duration-150">
                            <td className="px-6 py-4 text-slate-400 font-medium text-xs whitespace-nowrap">
                              {t.date}
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                              {t.contragent || <span className="text-slate-400 italic">Невідомий</span>}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title={t.purpose}>
                              {t.purpose}
                            </td>
                            <td className="px-6 py-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                              +{t.amount.toLocaleString("uk-UA")} грн
                            </td>
                            <td className="px-6 py-4">
                              {matchedIdent ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  <Check className="w-3.5 h-3.5 mr-1" /> Зіставлено: {matchedIdent}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                  Не розпізнано
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {t.member_id ? (
                                <span className="text-xs text-slate-400 italic">Проведено</span>
                              ) : (
                                <div className="flex items-center justify-end space-x-2">
                                  <select
                                    onChange={(e) => setSelectedMemberForPayment(prev => ({
                                      ...prev,
                                      [t.id]: parseInt(e.target.value)
                                    }))}
                                    value={selectedMemberForPayment[t.id] || ""}
                                    className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="">-- Оберіть --</option>
                                    {members.map(m => (
                                      <option key={m.id} value={m.id}>
                                        {m.property_type || "кв."} {m.identifier} ({m.owner_name || "Без імені"})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleManualReconcile(t.id)}
                                    className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-550"
                                  >
                                    Провести
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Meters Tab */}
        {activeTab === "meters" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl glass-panel bg-indigo-50/10 border border-indigo-500/10">
              <h3 className="text-md font-bold text-slate-900 dark:text-white flex items-center mb-1">
                <Cpu className="w-5 h-5 text-indigo-500 mr-2" />
                Багаторівнева система обліку комунальних послуг
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-4xl">
                Підтримуються загальнобудинкові (основні), проміжні (вуличні/під'їздні) та індивідуальні (квартирні/дільничі) лічильники.
                При додаванні нових показників індивідуального лічильника система автоматично розраховує споживання за встановленим тарифом і списує суму з балансу абонента.
              </p>
            </div>

            {/* Monthly lock panel */}
            <div className="p-6 rounded-2xl glass-panel bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center">
                  <Lock className="w-4 h-4 text-indigo-550 mr-1.5" />
                  Фіксація та закриття показів за місяць
                </h4>
                <p className="text-xs text-slate-450 dark:text-slate-400">
                  Зафіксовані показники закриваються для будь-якого редагування або видалення.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={lockMonth}
                  onChange={(e) => setLockMonth(parseInt(e.target.value))}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                >
                  <option value={1}>Січень</option>
                  <option value={2}>Лютий</option>
                  <option value={3}>Березень</option>
                  <option value={4}>Квітень</option>
                  <option value={5}>Травень</option>
                  <option value={6}>Червень</option>
                  <option value={7}>Липень</option>
                  <option value={8}>Серпень</option>
                  <option value={9}>Вересень</option>
                  <option value={10}>Жовтень</option>
                  <option value={11}>Листопад</option>
                  <option value={12}>Грудень</option>
                </select>
                <select
                  value={lockYear}
                  onChange={(e) => setLockYear(parseInt(e.target.value))}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
                <button
                  type="button"
                  onClick={handleLockReadings}
                  disabled={lockLoading}
                  className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-650/15 disabled:opacity-50"
                >
                  {lockLoading ? "Фіксація..." : "Зафіксувати покази"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800/60 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/60 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <th className="px-6 py-4">Лічильник</th>
                        <th className="px-6 py-4">Тип послуги</th>
                        <th className="px-6 py-4">Рівень / Ієрархія</th>
                        <th className="px-6 py-4">Прив'язка до абонента</th>
                        <th className="px-6 py-4">Тариф</th>
                        <th className="px-6 py-4">Показники (Початкові / Поточні)</th>
                        <th className="px-6 py-4 text-right">Дії</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 text-sm">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                          </td>
                        </tr>
                      ) : meters.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400">
                            <Cpu className="w-8 h-8 mx-auto mb-2 text-slate-350" />
                            <p>Лічильники підприємства не налаштовані. Натисніть "Додати лічильник", щоб почати облік.</p>
                          </td>
                        </tr>
                      ) : (
                        meters.map((meter) => {
                          return (
                            <tr key={meter.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors duration-150">
                              <td className="px-6 py-4 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${
                                  meter.type === "electricity" ? "bg-amber-500" :
                                  meter.type === "water" ? "bg-blue-500" :
                                  meter.type === "gas" ? "bg-emerald-500" : "bg-rose-500"
                                }`} />
                                <span>{meter.name}</span>
                              </td>
                              <td className="px-6 py-4 text-xs font-semibold">
                                {meter.type === "electricity" && "⚡ Електроенергія"}
                                {meter.type === "water" && "💧 Водопостачання"}
                                {meter.type === "gas" && "🔥 Газ"}
                                {meter.type === "heat" && "🌡️ Теплопостачання"}
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500">
                                {meter.parent_id ? (
                                  <span className="flex items-center">
                                    <Layers className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                    Підпорядкований: {meter.parent_name || `ID: ${meter.parent_id}`}
                                  </span>
                                ) : (
                                  <span className="text-slate-700 font-bold dark:text-indigo-400 flex items-center">
                                    <Building className="w-3.5 h-3.5 mr-1" />
                                    Головний підприємства
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">
                                {meter.member_id ? (
                                  <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-150/10">
                                    {meter.member_identifier}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Загальний лічильник</span>
                                )}
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                                {meter.tariff} <span className="text-[10px] font-medium text-slate-400">грн/од.</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-slate-900 dark:text-white">{meter.last_reading_value || 0}</span>
                                  {meter.last_reading_date && <span className="text-[10px] text-slate-450">{meter.last_reading_date}</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end space-x-1.5">
                                  <button
                                    onClick={() => handleOpenReadingModal(meter)}
                                    title="Внести нові показники"
                                    className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 rounded-lg text-xs font-bold hover:bg-indigo-100"
                                  >
                                    Внести показники
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditMeterModal(meter)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-amber-500"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMeter(meter.id)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Add / Edit Member Modal */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-panel bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl animate-fade-in border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800/60">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingMember ? (editingMember.property_type === "провайдер" ? "Редагувати контрагента" : "Редагувати об'єкт") : (activeTab === "contractors" ? "Додати контрагента" : "Додати об'єкт (квартиру, ділянку тощо)")}
              </h3>
              <button
                onClick={() => setMemberModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Тип об'єкта *
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="кв.">Квартира (кв.)</option>
                    <option value="дл.">Ділянка (дл.)</option>
                    <option value="п/м">Паркомісце (п/м)</option>
                    <option value="провайдер">Контрагент (провайдер, оренда тощо)</option>
                    <option value="інше">Інше</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Номер / Назва об'єкта *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="напр: 14 або ділянка 25"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    ПІБ власника / Назва компанії
                  </label>
                  <input
                    type="text"
                    placeholder="напр: Шевченко Т.Г. або ТОВ Провайдер"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Прив'язати до головного об'єкта
                  </label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="-1">Немає (Самостійний об'єкт)</option>
                    {members
                      .filter(m => !editingMember || m.id !== editingMember.id)
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.property_type || "кв."} {m.identifier} ({m.owner_name || "Не вказано"})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Площа (кв.м)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={area}
                    onChange={(e) => setArea(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Тариф (грн/кв.м)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={ratePerSqm}
                    onChange={(e) => setRatePerSqm(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Фікс. внесок (грн)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={fixedFee}
                    onChange={(e) => setFixedFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Ел. пошта
                  </label>
                  <input
                    type="email"
                    placeholder="owner@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Номер телефону
                  </label>
                  <input
                    type="tel"
                    placeholder="+380..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Початковий баланс (грн)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={balance}
                  onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block leading-tight">Вкажіть суму зі знаком мінус "-", якщо є стартовий борг</span>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setMemberModalOpen(false)}
                  className="flex-1 py-3 text-sm font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 rounded-xl transition-all"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
                >
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Charge Dues Modal (Accruals configuration) */}
      {chargeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-panel bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl animate-fade-in border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800/60">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <FileText className="w-5 h-5 text-amber-500 mr-2" />
                Нарахування внесків / платежів
              </h3>
              <button
                onClick={() => setChargeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Стаття нарахування *</label>
                  <select
                    value={chargeType}
                    onChange={(e) => {
                      setChargeType(e.target.value);
                      if (e.target.value === "target") {
                        setChargeDescription("Цільовий внесок (ремонт / модернізація)");
                      } else if (e.target.value === "charitable") {
                        setChargeDescription("Благодійний внесок");
                      } else if (e.target.value === "waste_removal") {
                        setChargeDescription("Вивіз побутових відходів");
                      } else if (e.target.value === "provider_fee") {
                        setChargeDescription("Плата за договором контрагента (оренда тощо)");
                      } else {
                        setChargeDescription("Щомісячний внесок за утримання будинку");
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="regular">Регулярний внесок</option>
                    <option value="target">Цільовий внесок</option>
                    <option value="charitable">Благодійний внесок</option>
                    <option value="waste_removal">Вивіз відходів</option>
                    <option value="provider_fee">Оренда контрагентів</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Періодичність нарахування *</label>
                  <select
                    value={periodType}
                    onChange={(e) => {
                      setPeriodType(e.target.value);
                      if (e.target.value === "quarterly") {
                        setChargeMultiplier(3);
                      } else if (e.target.value === "annual") {
                        setChargeMultiplier(12);
                      } else {
                        setChargeMultiplier(1);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="monthly">За місяць</option>
                    <option value="quarterly">За квартал</option>
                    <option value="annual">За рік</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Множник тарифу (періоду)</label>
                  <input
                    type="number"
                    value={chargeMultiplier}
                    onChange={(e) => setChargeMultiplier(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Фіксована сума (опціонально)</label>
                  <input
                    type="number"
                    placeholder="напр. 150"
                    value={chargeAmountOverride}
                    onChange={(e) => setChargeAmountOverride(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Особовий рахунок (опціонально для одного)</label>
                <select
                  value={chargeMemberId}
                  onChange={(e) => setChargeMemberId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="-1">Для всіх об'єктів</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.property_type || "кв."} {m.identifier} ({m.owner_name || "Не вказано"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Опис нарахування</label>
                <input
                  type="text"
                  value={chargeDescription}
                  onChange={(e) => setChargeDescription(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setChargeModalOpen(false)}
                  className="flex-1 py-3 text-sm font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 rounded-xl"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleCharge}
                  disabled={charging}
                  className="flex-1 py-3 text-sm font-semibold bg-amber-600 hover:bg-amber-550 text-white rounded-xl disabled:opacity-50"
                >
                  {charging ? "Нараховується..." : "Виконати нарахування"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Meter Modal */}
      {meterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800/60">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingMeter ? "Редагувати лічильник" : "Додати лічильник"}
              </h3>
              <button onClick={() => setMeterModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMeter} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Назва лічильника *</label>
                <input
                  type="text"
                  required
                  placeholder="напр: Загальний лічильник води, Кв. 14 Електро"
                  value={meterName}
                  onChange={(e) => setMeterName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Тип послуги *</label>
                  <select
                    value={meterType}
                    onChange={(e) => setMeterType(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="water">💧 Вода</option>
                    <option value="electricity">⚡ Електро</option>
                    <option value="gas">🔥 Газ</option>
                    <option value="heat">🌡️ Тепло</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Тариф *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={meterTariff}
                    onChange={(e) => setMeterTariff(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Початкові покази</label>
                  <input
                    type="number"
                    step="0.01"
                    value={meterInitialReading}
                    onChange={(e) => setMeterInitialReading(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Прив'язка до абонента (якщо індивідуальний)</label>
                <select
                  value={meterMemberId}
                  onChange={(e) => setMeterMemberId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="-1">Ні (Загальний підприємства / Проміжний)</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.property_type || "кв."} {m.identifier} ({m.owner_name || "Не вказано"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Головний лічильник (ієрархія)</label>
                <select
                  value={meterParentId}
                  onChange={(e) => setMeterParentId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="-1">Немає (Це головний лічильник)</option>
                  {meters
                    .filter(m => !editingMeter || m.id !== editingMeter.id)
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.type})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setMeterModalOpen(false)}
                  className="flex-1 py-3 text-sm font-semibold border border-slate-200 rounded-xl"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
                >
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enter Reading Modal */}
      {readingModalOpen && selectedMeterForReading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800/60">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Внести показники: {selectedMeterForReading.name}
              </h3>
              <button onClick={() => setReadingModalOpen(false)} className="text-slate-400 hover:text-slate-650">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddReading} className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Попереднє показання:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{selectedMeterForReading.last_reading_value || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Тариф:</span>
                  <span className="font-bold text-indigo-550">{selectedMeterForReading.tariff} грн / од.</span>
                </div>
                {selectedMeterForReading.member_id && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Абонент для нарахування:</span>
                    <span className="font-bold text-slate-750 dark:text-slate-300">{selectedMeterForReading.member_identifier}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Нове показання *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Поточне значення"
                    value={readingValue}
                    onChange={(e) => setReadingValue(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Дата зняття *</label>
                  <input
                    type="date"
                    required
                    value={readingDate}
                    onChange={(e) => setReadingDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReadingModalOpen(false)}
                  className="flex-1 py-3 text-sm font-semibold border border-slate-200 rounded-xl"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
                >
                  Внести
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Details Modal / Card */}
      {memberDetailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl glass-panel bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800/60">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Картка абонента: {selectedMemberDetails ? `${selectedMemberDetails.member.property_type || "кв."} ${selectedMemberDetails.member.identifier}` : "Завантаження..."}
                </h3>
              </div>
              <button
                onClick={() => setMemberDetailsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetails || !selectedMemberDetails ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
                  <p>Завантаження інформації про абонента...</p>
                </div>
              ) : (
                <>
                  {/* Subscriber Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/55 dark:bg-slate-950/20 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {selectedMemberDetails.member.property_type === "провайдер" ? "Контрагент / Організація" : "Власник / Організація"}
                      </span>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {selectedMemberDetails.member.owner_name || "Не вказано"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {selectedMemberDetails.member.phone || "Немає телефону"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {selectedMemberDetails.member.property_type === "провайдер" ? "Умови договору" : "Параметри внеску"}
                      </span>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {selectedMemberDetails.member.property_type === "провайдер" ? (
                          <span>Орендна плата</span>
                        ) : selectedMemberDetails.member.area ? (
                          <span>Площа: {selectedMemberDetails.member.area} кв.м</span>
                        ) : (
                          <span>Фіксований внесок</span>
                        )}
                      </p>
                      <p className="text-xs text-indigo-550 dark:text-indigo-400 font-medium">
                        {selectedMemberDetails.member.property_type === "провайдер"
                          ? `${selectedMemberDetails.member.fixed_monthly_fee || 0} грн/міс`
                          : selectedMemberDetails.member.rate_per_sqm 
                            ? `${selectedMemberDetails.member.rate_per_sqm} грн/кв.м` 
                            : `${selectedMemberDetails.member.fixed_monthly_fee || 0} грн/міс`}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Поточний баланс особового рахунку</span>
                      <p className={`text-lg font-black ${
                        selectedMemberDetails.member.balance < 0 
                          ? "text-rose-600 dark:text-rose-450" 
                          : selectedMemberDetails.member.balance > 0 
                            ? "text-emerald-600 dark:text-emerald-450" 
                            : "text-slate-600 dark:text-slate-400"
                      }`}>
                        {selectedMemberDetails.member.balance.toLocaleString("uk-UA")} грн
                      </p>
                      <span className="text-[9px] text-slate-400">
                        {selectedMemberDetails.member.balance < 0 ? "Наявна заборгованість" : "Передплата за послуги"}
                      </span>

                    </div>
                  </div>

                  {/* 3 Columns details grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Meter readings */}
                    <div className="space-y-3 lg:col-span-1">
                      <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider flex items-center">
                        <Cpu className="w-3.5 h-3.5 mr-1" />
                        Показники лічильників
                      </h4>
                      {selectedMemberDetails.meters.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Немає прив'язаних лічильників</p>
                      ) : (
                        <div className="space-y-4">
                          {selectedMemberDetails.meters.map((m: any) => (
                            <div key={m.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-800 dark:text-white">{m.name}</span>
                                <span className="text-[10px] bg-slate-200/50 dark:bg-slate-850 px-2 py-0.5 rounded text-slate-500">
                                  {m.tariff} грн/од
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Початкові покази: <span className="font-semibold text-slate-600 dark:text-slate-300">{m.initial_reading}</span>
                              </div>
                              {m.readings && m.readings.length > 0 ? (
                                <div className="space-y-2">
                                  {/* Latest Reading Card */}
                                  <div className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/40 flex justify-between items-center text-xs">
                                    <div>
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Останній показник</span>
                                      <span className="font-extrabold text-slate-900 dark:text-white text-sm">{m.readings[0].reading_value}</span>
                                      <span className="text-[10px] text-slate-400 ml-1.5">({m.readings[0].reading_date})</span>
                                    </div>
                                    <div className="text-right flex items-center space-x-1.5">
                                      <div>
                                        <span className="text-[9px] uppercase font-bold text-slate-400 block font-normal text-right">Нараховано</span>
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{(m.readings[0].charge_amount || 0).toFixed(2)} грн</span>
                                      </div>
                                      {m.readings[0].is_locked ? (
                                        <span title="Показник заблоковано">
                                          <Lock className="w-3.5 h-3.5 text-slate-400 ml-1" />
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteMeterReading(m.id, m.readings[0].id)}
                                          className="text-slate-400 hover:text-rose-500 p-0.5"
                                          title="Видалити цей показник"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Collapsible history for older readings */}
                                  {m.readings.length > 1 && (
                                    <div className="space-y-1">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedMeters(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                                        className="w-full flex items-center justify-between py-1 px-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-slate-100/60 dark:bg-slate-900/60 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                                      >
                                        <span>{expandedMeters[m.id] ? "Приховати історію" : `Історія показників (${m.readings.length - 1})`}</span>
                                        {expandedMeters[m.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                      </button>

                                      {expandedMeters[m.id] && (
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800/40 max-h-[140px] overflow-y-auto pr-1 mt-1 border-t border-slate-200 dark:border-slate-850">
                                          {m.readings.slice(1).map((r: any) => (
                                            <div key={r.id} className="flex justify-between items-center py-1.5 text-[11px] text-slate-650 dark:text-slate-350">
                                              <div className="flex flex-col">
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">{r.reading_value}</span>
                                                <span className="text-[9px] text-slate-400">{r.reading_date}</span>
                                              </div>
                                              <div className="flex items-center space-x-1.5">
                                                <span className="text-slate-505 font-medium">
                                                  {r.charge_amount.toFixed(2)} грн
                                                </span>
                                                {r.is_locked ? (
                                                  <Lock className="w-3 h-3 text-slate-400" />
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteMeterReading(m.id, r.id)}
                                                    className="text-slate-400 hover:text-rose-500 p-0.5"
                                                    title="Видалити показники"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400 italic py-2 text-center bg-slate-50 dark:bg-slate-900/20 rounded-lg">Поки що показів не вносили</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Accruals History */}
                    <div className="space-y-3 lg:col-span-1">
                      <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider flex items-center">
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        Історія нарахувань
                      </h4>
                      <div className="border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden divide-y divide-slate-150 dark:divide-slate-800/40 max-h-[380px] overflow-y-auto pr-1">
                        {selectedMemberDetails.charges.length === 0 ? (
                          <p className="text-xs text-slate-400 italic p-4 text-center">Нарахування відсутні</p>
                        ) : (
                          selectedMemberDetails.charges.map((c: any) => (
                            <div key={c.id} className="p-3 text-xs flex justify-between items-start hover:bg-slate-50/20">
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{c.description}</span>
                                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                                  <span>{c.date}</span>
                                  <span>•</span>
                                  <span className="uppercase text-[9px]">{c.charge_type}</span>
                                </div>
                              </div>
                              <span className="font-extrabold text-rose-600 dark:text-rose-450 ml-2 whitespace-nowrap">
                                -{c.amount.toLocaleString("uk-UA")} грн
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Payments History */}
                    <div className="space-y-3 lg:col-span-1">
                      <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider flex items-center">
                        <CreditCard className="w-3.5 h-3.5 mr-1" />
                        Надходження оплат
                      </h4>
                      <div className="border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden divide-y divide-slate-150 dark:divide-slate-800/40 max-h-[380px] overflow-y-auto pr-1">
                        {selectedMemberDetails.payments.length === 0 ? (
                          <p className="text-xs text-slate-400 italic p-4 text-center">Оплат від абонента не надходило</p>
                        ) : (
                          selectedMemberDetails.payments.map((p: any) => (
                            <div key={p.id} className="p-3 text-xs flex justify-between items-start hover:bg-slate-50/20">
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-800 dark:text-slate-200">Оплата через банк</span>
                                <div className="text-[10px] text-slate-400 leading-tight">
                                  {p.date} • {p.contragent || "Платник не вказаний"}
                                </div>
                                {p.purpose && <p className="text-[9px] text-slate-450 italic leading-snug">{p.purpose}</p>}
                              </div>
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-450 ml-2 whitespace-nowrap">
                                +{p.amount.toLocaleString("uk-UA")} грн
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/20 flex justify-end">
              <button
                type="button"
                onClick={() => setMemberDetailsModalOpen(false)}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-semibold rounded-xl transition-all"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resident Cabinet Purchase Modal */}
      {residentCabinetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800/60">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {rcModalStep === "configure" && "Налаштування кабінету мешканця"}
                {rcModalStep === "review" && "Перевірка даних"}
              </h3>
              <button onClick={() => setResidentCabinetModalOpen(false)} className="text-slate-400 hover:text-slate-650">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePurchaseResidentCabinet} className="p-6 space-y-5">
              {/* Step 1: Configure */}
              {rcModalStep === "configure" && (
                <>
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <DollarSign className="w-5 h-5 text-indigo-600 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                          Помісячна оплата
                        </div>
                        <div className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                          Вартість: {residentCabinetStatus?.pricing?.price || 250} {residentCabinetStatus?.pricing?.currency || 'UAH'}
                        </div>
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-2">
                          Після налаштування мешканці зможуть переглядати баланс, вносити показники лічильників та оплачувати послуги через Monobank.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Slug (URL-ідентифікатор) *</label>
                    <input
                      type="text"
                      required
                      placeholder="osbb-zelenyi-kurhan"
                      value={rcSlug}
                      onChange={(e) => setRcSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="text-[10px] text-slate-400 space-y-1">
                      <p>Використовується для URL: <span className="font-mono text-indigo-600">unitax.pro/osbb/{rcSlug || "slug"}</span></p>
                      <p>Тільки латинські літери, цифри та дефіс. Наприклад: <span className="font-mono">osbb-zelenyi-kurhan</span></p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Mono API Token *</label>
                    <input
                      type="text"
                      required
                      placeholder="u_token_..."
                      value={rcMonoApiToken}
                      onChange={(e) => setRcMonoApiToken(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="text-[10px] text-slate-400 space-y-1">
                      <p>Токен від Monobank для прийому платежів від мешканців.</p>
                      <p>Отримати токен можна в <a href="https://api.monobank.ua/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">особистому кабінеті Monobank</a> → Налаштування → API токени.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Колір інтерфейсу</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={rcColorTheme}
                        onChange={(e) => setRcColorTheme(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer"
                      />
                      <input
                        type="text"
                        placeholder="#3b82f6"
                        value={rcColorTheme}
                        onChange={(e) => setRcColorTheme(e.target.value)}
                        className="flex-1 px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">Основний колір для особистого кабінету мешканців.</p>
                  </div>

                  <div className="flex space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => setResidentCabinetModalOpen(false)}
                      className="flex-1 py-3 text-sm font-semibold border border-slate-200 rounded-xl"
                    >
                      Скасувати
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
                    >
                      Далі
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Review */}
              {rcModalStep === "review" && (
                <>
                  <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Перевірте дані перед збереженням</h4>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Назва ОСББ:</span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">{selectedProfile?.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">ЄДРПОУ:</span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">{selectedProfile?.tax_id}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Адреса:</span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">{selectedProfile?.address || "—"}</span>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">Slug (URL):</span>
                          <span className="text-xs font-semibold text-indigo-600">{rcSlug}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-slate-500">URL кабінету:</span>
                          <span className="text-xs font-semibold text-indigo-600">unitax.pro/osbb/{rcSlug}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-slate-500">Колір:</span>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: rcColorTheme }} />
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">{rcColorTheme}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                    <p className="text-xs text-indigo-750 dark:text-indigo-405 leading-relaxed">
                      Після підтвердження особистий кабінет мешканців буде створено або оновлено з вказаними налаштуваннями.
                      Мешканці зможуть переглядати баланс, вносити показники лічильників та оплачувати послуги через Monobank.
                    </p>
                  </div>

                  <div className="flex space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => setRcModalStep("configure")}
                      className="flex-1 py-3 text-sm font-semibold border border-slate-200 rounded-xl"
                      disabled={rcPurchasing}
                    >
                      Назад
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center gap-1.5"
                      disabled={rcPurchasing}
                    >
                      {rcPurchasing ? "Збереження..." : "Зберегти налаштування"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Contractor Modal */}
      {contractorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-panel bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl animate-fade-in border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800/60">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingContractor ? "Редагувати контрагента" : "Додати контрагента"}
              </h3>
              <button
                onClick={() => setContractorModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContractor} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Назва контрагента / Організації *
                </label>
                <input
                  type="text"
                  required
                  placeholder="напр: ДТЕК Київські електромережі, ФОП Іванов"
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Тип контрагента *
                  </label>
                  <select
                    value={contractorType}
                    onChange={(e) => setContractorType(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="provider">Постачальник послуг</option>
                    <option value="contractor">Підрядник</option>
                    <option value="tenant">Орендар</option>
                    <option value="bank">Банк</option>
                    <option value="other">Інше</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Код ЄДРПОУ / ІПН
                  </label>
                  <input
                    type="text"
                    placeholder="8 або 10 цифр"
                    value={contractorTaxId}
                    onChange={(e) => setContractorTaxId(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Номер телефону
                  </label>
                  <input
                    type="tel"
                    placeholder="+380..."
                    value={contractorPhone}
                    onChange={(e) => setContractorPhone(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Електронна пошта
                  </label>
                  <input
                    type="email"
                    placeholder="partner@example.com"
                    value={contractorEmail}
                    onChange={(e) => setContractorEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Юридична адреса
                </label>
                <input
                  type="text"
                  placeholder="напр: м. Київ, вул. Хрещатик, 1"
                  value={contractorAddress}
                  onChange={(e) => setContractorAddress(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Початковий баланс (грн)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={contractorInitialBalance}
                  onChange={(e) => setContractorInitialBalance(parseFloat(e.target.value) || 0)}
                  disabled={!!editingContractor}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className="text-[10px] text-slate-400 block leading-tight">
                  Коригується стартовий борг (зі знаком "-") чи передплата (зі знаком "+").
                </span>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setContractorModalOpen(false)}
                  className="flex-1 py-3 text-sm font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 rounded-xl transition-all"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
                >
                  Зберегти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conduct Contractor Transaction Modal */}
      {contractorTxModalOpen && selectedContractorForTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800/60">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {contractorTxType === "expense" ? "Провести видаток (сплатити)" : "Провести прихід (отримати)"}
              </h3>
              <button onClick={() => setContractorTxModalOpen(false)} className="text-slate-400 hover:text-slate-650">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContractorTx} className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Контрагент:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{selectedContractorForTx.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Поточний баланс:</span>
                  <span className={`font-bold ${selectedContractorForTx.balance < 0 ? "text-rose-600" : "text-emerald-650"}`}>
                    {selectedContractorForTx.balance.toLocaleString("uk-UA")} грн
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">IBAN організації:</span>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-350">{selectedProfile.iban || "Не вказано в профілі"}</span>
                </div>
              </div>

              {/* Dynamic expected balance preview */}
              {(() => {
                const amountVal = parseFloat(contractorTxAmount) || 0;
                let expectedBal = selectedContractorForTx.balance;
                if (["provider", "contractor", "bank"].includes(selectedContractorForTx.type)) {
                  expectedBal = selectedContractorForTx.balance - (contractorTxType === "income" ? amountVal : 0) + (contractorTxType === "expense" ? amountVal : 0);
                } else {
                  expectedBal = selectedContractorForTx.balance + (contractorTxType === "income" ? amountVal : 0) - (contractorTxType === "expense" ? amountVal : 0);
                }
                return (
                  <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/40 space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Очікуваний баланс після операції:</span>
                      <span className={`font-extrabold text-sm ${expectedBal < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {expectedBal.toLocaleString("uk-UA")} грн
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Сума операції (грн) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={contractorTxAmount}
                    onChange={(e) => setContractorTxAmount(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Дата операції *</label>
                  <input
                    type="date"
                    required
                    value={contractorTxDate}
                    onChange={(e) => setContractorTxDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Призначення платежу / Опис *</label>
                <input
                  type="text"
                  required
                  placeholder="напр: Оплата за ремонт ліфта згідно акту №4"
                  value={contractorTxDescription}
                  onChange={(e) => setContractorTxDescription(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Посилання на документ (PDF тощо)</label>
                <input
                  type="url"
                  placeholder="https://example.com/invoice.pdf"
                  value={contractorTxDocumentUrl}
                  onChange={(e) => setContractorTxDocumentUrl(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setContractorTxModalOpen(false)}
                  className="flex-1 py-3 text-sm font-semibold border border-slate-200 rounded-xl"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
                >
                  Провести
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contractor History Modal */}
      {contractorHistoryModalOpen && selectedContractorForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl glass-panel bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800/60">
              <div className="flex items-center space-x-2">
                <HistoryIcon className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Історія взаєморозрахунків: {selectedContractorForHistory.name}
                </h3>
              </div>
              <button
                onClick={() => setContractorHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date Filters & Exports Header */}
            <div className="p-6 bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-200/60 dark:border-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">З</span>
                  <input
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => setHistoryStartDate(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">По</span>
                  <input
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => setHistoryEndDate(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintContractorHistory}
                  className="flex items-center gap-1 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Друк</span>
                </button>
                <button
                  onClick={handleExportContractorCSV}
                  className="flex items-center gap-1 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Експорт CSV</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingContractorHistory ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
                  <p>Завантаження історії транзакцій...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Dynamic calculation of stats */}
                  {(() => {
                    const filteredTxs = contractorHistoryData.filter((t) => {
                      if (historyStartDate && t.transaction_date < historyStartDate) return false;
                      if (historyEndDate && t.transaction_date > historyEndDate) return false;
                      return true;
                    });
                    const totalIn = filteredTxs.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
                    const totalOut = filteredTxs.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
                    const balanceDiff = ["provider", "contractor", "bank"].includes(selectedContractorForHistory.type)
                      ? totalOut - totalIn
                      : totalIn - totalOut;

                    return (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-905/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-850 text-center">
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">Отримано (прихід)</div>
                            <div className="text-xl font-black text-emerald-600 dark:text-emerald-450">
                              +{totalIn.toLocaleString("uk-UA")} грн
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-905/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-850 text-center">
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">Сплачено (видаток)</div>
                            <div className="text-xl font-black text-rose-600 dark:text-rose-450">
                              -{totalOut.toLocaleString("uk-UA")} грн
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-905/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-850 text-center">
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">Зміна сальдо</div>
                            <div className={`text-xl font-black ${balanceDiff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {balanceDiff >= 0 ? "+" : ""}{balanceDiff.toLocaleString("uk-UA")} грн
                            </div>
                          </div>
                        </div>

                        {/* Transaction Table */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-left border-collapse text-xs sm:text-sm">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">Дата</th>
                                <th className="px-4 py-3">Тип</th>
                                <th className="px-4 py-3">Сума</th>
                                <th className="px-4 py-3">Призначення</th>
                                <th className="px-4 py-3 text-right">Документ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                              {filteredTxs.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="text-center py-8 text-slate-450 italic">
                                    Операцій за вказаний період не знайдено
                                  </td>
                                </tr>
                              ) : (
                                filteredTxs.map((t) => (
                                  <tr key={t.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                                    <td className="px-4 py-3 font-semibold text-slate-400">#{t.id}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{t.transaction_date}</td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                                        t.type === "income" 
                                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-450" 
                                          : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-450"
                                      }`}>
                                        {t.type === "income" ? "Прихід" : "Видаток"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-bold whitespace-nowrap">
                                      {t.type === "income" ? "+" : "-"}
                                      {t.amount.toLocaleString("uk-UA")} грн
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-350">{t.description}</td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                      {t.document_url ? (
                                        <a
                                          href={t.document_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center text-indigo-650 hover:underline hover:text-indigo-500 font-bold"
                                        >
                                          <FileText className="w-3.5 h-3.5 mr-1" />
                                          <span>PDF</span>
                                        </a>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/20 flex justify-end">
              <button
                type="button"
                onClick={() => setContractorHistoryModalOpen(false)}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-semibold rounded-xl transition-all"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
