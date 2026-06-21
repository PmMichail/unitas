"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { useDropzone } from "react-dropzone";
import {
  Receipt,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Upload,
  CheckCircle,
  AlertTriangle,
  Info,
  Edit2,
  Calendar,
  X,
  Trash2,
  Download
} from "lucide-react";

export default function Transactions() {
  const { profiles, selectedProfile } = useApp();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");

  // Statement Upload State
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Edit State
  const [editingTx, setEditingTx] = useState<any>(null);
  const [editTaxable, setEditTaxable] = useState(true);
  const [editTxType, setEditTxType] = useState<any>("income");
  const [editContragent, setEditContragent] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDirection, setEditDirection] = useState("in");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Manual Transaction State
  const [isAddingManualTx, setIsAddingManualTx] = useState(false);
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [manualAmount, setManualAmount] = useState("");
  const [manualDirection, setManualDirection] = useState<"in" | "out">("in");
  const [manualPurpose, setManualPurpose] = useState("");
  const [manualContragent, setManualContragent] = useState("");
  const [manualMemberId, setManualMemberId] = useState<number>(0);
  const [manualTaxable, setManualTaxable] = useState(true);
  const [manualTxType, setManualTxType] = useState("income");
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Members & Splitting State
  const [members, setMembers] = useState<any[]>([]);
  const [splittingTx, setSplittingTx] = useState<any>(null);
  const [splitRows, setSplitRows] = useState<{ member_id: number; amount: string }[]>([{ member_id: 0, amount: "" }]);
  const [submittingSplit, setSubmittingSplit] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

  const activeProfileId = selectedProfile?.id;

  const fetchTransactions = async () => {
    if (!activeProfileId) return;
    setLoading(true);
    try {
      const data = await api.getTransactions(activeProfileId, startDate || undefined, endDate || undefined);
      setTransactions(data);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!activeProfileId) return;
    try {
      const data = await api.getMembers(activeProfileId);
      setMembers(data || []);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [activeProfileId, startDate, endDate]);

  useEffect(() => {
    fetchMembers();
  }, [activeProfileId]);

  const openSplitModal = (tx: any) => {
    setSplittingTx(tx);
    setSplitRows([{ member_id: 0, amount: "" }]);
    setSplitError(null);
  };

  const handleAddSplitRow = () => {
    setSplitRows([...splitRows, { member_id: 0, amount: "" }]);
  };

  const handleRemoveSplitRow = (index: number) => {
    setSplitRows(splitRows.filter((_, i) => i !== index));
  };

  const handleSplitRowChange = (index: number, field: "member_id" | "amount", value: any) => {
    const updated = [...splitRows];
    if (field === "member_id") {
      updated[index].member_id = parseInt(value) || 0;
    } else {
      updated[index].amount = value;
    }
    setSplitRows(updated);
    setSplitError(null);
  };

  const handleSaveSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splittingTx) return;

    // Validation
    const validSplits = splitRows.filter(r => r.member_id > 0 && parseFloat(r.amount) > 0);
    if (validSplits.length === 0) {
      setSplitError("Будь ласка, вкажіть хоча б одного мешканця та суму більше 0");
      return;
    }

    const totalSplit = validSplits.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    if (totalSplit > splittingTx.amount + 0.01) {
      setSplitError(`Сума розподілу (${totalSplit} грн) не може бути більшою за суму транзакції (${splittingTx.amount} грн)`);
      return;
    }

    setSubmittingSplit(true);
    setSplitError(null);
    try {
      await api.splitTransaction(
        splittingTx.id,
        validSplits.map(r => ({
          member_id: r.member_id,
          amount: parseFloat(r.amount)
        }))
      );
      setSplittingTx(null);
      fetchTransactions();
    } catch (err: any) {
      console.error(err);
      setSplitError(err.response?.data?.detail || "Не вдалося розподілити транзакцію");
    } finally {
      setSubmittingSplit(false);
    }
  };

  const openManualModal = () => {
    setIsAddingManualTx(true);
    setManualDate(new Date().toISOString().split("T")[0]);
    setManualAmount("");
    setManualDirection("in");
    setManualPurpose("");
    setManualContragent("");
    setManualMemberId(0);
    setManualTaxable(true);
    setManualTxType("income");
    setManualError(null);
  };

  const handleManualMemberChange = (memberIdVal: number) => {
    setManualMemberId(memberIdVal);
    if (memberIdVal > 0) {
      const selectedMember = members.find(m => m.id === memberIdVal);
      if (selectedMember) {
        const name = selectedMember.owner_name || selectedMember.identifier || "";
        const property = selectedMember.property_type || "кв.";
        const ident = selectedMember.identifier || "";
        setManualContragent(`${property} ${ident} ${name}`.trim());
      }
    } else {
      setManualContragent("");
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfileId) return;

    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0) {
      setManualError("Сума повинна бути більшою за 0");
      return;
    }

    if (!manualPurpose.trim()) {
      setManualError("Призначення платежу обов'язкове");
      return;
    }

    setSubmittingManual(true);
    setManualError(null);

    try {
      await api.addManualTransaction({
        profile_id: activeProfileId,
        date: manualDate,
        amount: amt,
        direction: manualDirection,
        purpose: manualPurpose,
        contragent: manualContragent || undefined,
        transaction_type: manualTxType,
        taxable: manualTaxable,
        member_id: manualMemberId > 0 ? manualMemberId : undefined
      });
      setIsAddingManualTx(false);
      fetchTransactions();
    } catch (err: any) {
      console.error(err);
      setManualError(err.response?.data?.detail || "Не вдалося зберегти транзакцію");
    } finally {
      setSubmittingManual(false);
    }
  };

  // Dropzone setup
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "text/csv": [".csv"],
      "text/html": [".html", ".htm"],
      "text/plain": [".txt"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"]
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (!activeProfileId || acceptedFiles.length === 0) return;
      
      const file = acceptedFiles[0];
      setIsUploading(true);
      setUploadSuccess(null);
      setUploadError(null);

      try {
        const res = await api.uploadStatement(activeProfileId, file);
        setUploadSuccess(res.message || "Виписку успішно завантажено та розпізнано!");
        fetchTransactions();
      } catch (err: any) {
        setUploadError(err.response?.data?.detail || "Помилка при завантаженні або розпізнаванні виписки");
      } finally {
        setIsUploading(false);
      }
    }
  });

  // Handle Edit Save
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    setSubmittingEdit(true);
    try {
      await api.updateTransaction(editingTx.id, {
        taxable: editTaxable,
        transaction_type: editTxType,
        contragent: editContragent,
        amount: editAmount ? parseFloat(editAmount) : undefined,
        direction: editDirection
      });
      setEditingTx(null);
      fetchTransactions();
    } catch (err) {
      alert("Не вдалося оновити транзакцію");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Open edit modal
  const openEditModal = (tx: any) => {
    setEditingTx(tx);
    setEditTaxable(tx.taxable);
    setEditTxType(tx.transaction_type || tx.type || "income");
    setEditContragent(tx.contragent || "");
    setEditAmount(String(tx.amount || ""));
    setEditDirection(tx.direction || "in");
  };

  // Period change helpers
  const handlePeriodChange = (period: string) => {
    setPeriodFilter(period);
    const today = new Date();
    const year = today.getFullYear();
    
    if (period === "all" || period === "") {
      setStartDate("");
      setEndDate("");
      return;
    }

    let start = "";
    let end = "";

    const pad = (num: number) => String(num).padStart(2, '0');

    if (period === "current_month") {
      const month = today.getMonth() + 1;
      start = `${year}-${pad(month)}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      end = `${year}-${pad(month)}-${pad(lastDay)}`;
    } else if (period === "prev_month") {
      let month = today.getMonth();
      let yr = year;
      if (month === 0) {
        month = 12;
        yr = year - 1;
      }
      start = `${yr}-${pad(month)}-01`;
      const lastDay = new Date(yr, month, 0).getDate();
      end = `${yr}-${pad(month)}-${pad(lastDay)}`;
    } else if (period === "q1") {
      start = `${year}-01-01`;
      end = `${year}-03-31`;
    } else if (period === "q2") {
      start = `${year}-04-01`;
      end = `${year}-06-30`;
    } else if (period === "q3") {
      start = `${year}-07-01`;
      end = `${year}-09-30`;
    } else if (period === "q4") {
      start = `${year}-10-01`;
      end = `${year}-12-31`;
    } else if (period === "current_year") {
      start = `${year}-01-01`;
      end = `${year}-12-31`;
    } else if (period === "prev_year") {
      start = `${year - 1}-01-01`;
      end = `${year - 1}-12-31`;
    }

    setStartDate(start);
    setEndDate(end);
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setPeriodFilter("custom");
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setPeriodFilter("custom");
  };

  const handleClearStatements = async () => {
    if (!activeProfileId) return;
    if (!window.confirm("Ви впевнені, що хочете видалити всі завантажені виписки та транзакції для цього профілю? Цю дію неможливо скасувати.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await api.clearStatements(activeProfileId);
      alert(res.message || "Усі виписки успішно видалено");
      fetchTransactions();
    } catch (err) {
      console.error("Failed to clear statements:", err);
      alert("Не вдалося видалити виписки");
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!activeProfileId) return;
    const params = new URLSearchParams({
      profile_id: String(activeProfileId),
      format: exportFormat,
      start_date: startDate || "",
      end_date: endDate || ""
    });
    window.location.href = `/api/export/transactions?${params.toString()}`;
  };

  // Filter local results by search and transaction type
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = 
      (tx.purpose || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.contragent || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(tx.amount).includes(searchTerm);
    
    const matchesType = typeFilter === "all" || tx.transaction_type === typeFilter || tx.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400 bg-clip-text text-transparent">
          Транзакції
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Аналізуйте доходи та витрати, імпортуйте банківські виписки та оптимізуйте taxable-статуси.
        </p>
      </div>

      {/* Grid: Left - Upload, Right - Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload card (1 col) */}
        <div className="p-6 rounded-2xl glass-panel flex flex-col justify-between min-h-[220px]">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-2">
              <Upload className="w-4 h-4 text-indigo-500" />
              Імпорт виписки
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Завантажте виписку ПриватБанк, Монобанк або А-Банк. AI автоматично категоризує кожну транзакцію.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <div
              {...getRootProps()}
              className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                isDragActive
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-slate-300 dark:border-slate-800 hover:border-indigo-500/40 bg-slate-50/50 dark:bg-slate-950/20"
              }`}
            >
              <input {...getInputProps()} />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {isUploading ? "Обробка AI..." : "Перетягніть виписку сюди"}
              </p>
              <p className="text-[9px] text-slate-400 mt-1">або натисніть для вибору файлу</p>
            </div>

            {uploadSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 flex items-start gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {uploadError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <button
              onClick={openManualModal}
              className="w-full py-2 px-4 rounded-xl border border-indigo-500/25 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              + Додати транзакцію вручну
            </button>

            {transactions.length > 0 && (
              <button
                onClick={handleClearStatements}
                className="w-full py-2 px-4 mt-2 rounded-xl border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Видалити всі виписки
              </button>
            )}
          </div>
        </div>

        {/* Filters card (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-indigo-500" />
              Пошук та фільтрація
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                  Період
                </label>
                <select
                  value={periodFilter}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
                >
                  <option value="all">За весь час</option>
                  <option value="current_month">Поточний місяць</option>
                  <option value="prev_month">Попередній місяць</option>
                  <option value="q1">1 Квартал</option>
                  <option value="q2">2 Квартал</option>
                  <option value="q3">3 Квартал</option>
                  <option value="q4">4 Квартал</option>
                  <option value="current_year">Поточний рік</option>
                  <option value="prev_year">Попередній рік</option>
                  <option value="custom">Довільний</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                  Дата з
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                  Дата по
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1 block">
                  Категорія
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
                >
                  <option value="all">Всі транзакції</option>
                  <option value="income">Оподатковувані доходи</option>
                  <option value="expense">Витрати</option>
                  <option value="own_funds">Власні кошти / Поповнення</option>
                  <option value="refund">Повернення</option>
                  <option value="loan">Позики / Кредити</option>
                  <option value="tax_payment">Сплачені податки</option>
                  <option value="salary_payment">Виплата зарплати</option>
                </select>
              </div>
            </div>
          </div>

          <div className="relative mt-4">
            <input
              type="text"
              placeholder="Пошук за призначенням, контрагентом або сумою..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>

          <div className="flex gap-2 mt-4">
            <select 
              value={exportFormat} 
              onChange={(e) => setExportFormat(e.target.value)}
              className="border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900"
            >
              <option value="csv">CSV (Excel)</option>
              <option value="xlsx">Excel (XLSX)</option>
            </select>
            
            <button
              onClick={handleExport}
              disabled={!activeProfileId || transactions.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Експорт
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Transactions Table */}
      <div className="p-6 rounded-2xl glass-panel">
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left text-slate-400">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Дата / Час</th>
                  <th className="px-6 py-4">Контрагент / Призначення</th>
                  <th className="px-6 py-4">Тип</th>
                  <th className="px-6 py-4 text-right">Сума</th>
                  <th className="px-6 py-4">Оподатковується</th>
                  <th className="px-6 py-4">Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.direction === "in";
                  
                  // Label translations
                  const typeLabels: Record<string, string> = {
                    income: "Дохід",
                    expense: "Витрата",
                    own_funds: "Власні кошти",
                    refund: "Повернення",
                    loan: "Позика",
                    tax_payment: "Податок",
                    salary_payment: "Зарплата"
                  };

                  return (
                    <tr key={tx.id} className="border-b border-slate-200 dark:border-slate-800/40 bg-slate-900/5 hover:bg-slate-900/10 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-300">
                        {tx.date || "—"}
                      </td>
                      <td className="px-6 py-4 max-w-sm truncate">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {tx.contragent || "Невідомий контрагент"}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5" title={tx.purpose}>
                          {tx.purpose}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {typeLabels[tx.transaction_type || tx.type] || tx.transaction_type || tx.type}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-extrabold ${isIncome ? "text-emerald-500" : "text-slate-800 dark:text-slate-200"}`}>
                        <div className="flex items-center justify-end gap-1">
                          {isIncome ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {tx.amount.toLocaleString("uk-UA")} грн
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          tx.taxable
                            ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-500/20"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-500 border border-slate-500/20"
                        }`}>
                          {tx.taxable ? "Так" : "Ні"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => openEditModal(tx)}
                            className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Змінити
                          </button>
                          {isIncome && (
                            <button
                              onClick={() => openSplitModal(tx)}
                              className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-450 hover:text-emerald-500 transition-all"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" /> Розподілити
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-24 text-center text-slate-500">
            Транзакцій за обраний період не виявлено. Будь ласка, завантажте виписку банку.
          </div>
        )}
      </div>

      {/* Edit transaction modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Редагувати транзакцію</h3>
                <p className="text-xs text-slate-400 mt-1">Категоризація та статус оподаткування для розрахунків.</p>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                Закрити
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 space-y-2">
              <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Опис платежу</div>
              <div className="text-xs text-slate-800 dark:text-slate-200 font-semibold">{editingTx.purpose}</div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-bold">Сума:</span>
                <span className="text-sm font-extrabold text-indigo-500">{editingTx.amount.toLocaleString("uk-UA")} грн</span>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Contragent edit */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                  Контрагент
                </label>
                <input
                  type="text"
                  value={editContragent}
                  onChange={(e) => setEditContragent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  placeholder="Введіть назву контрагента"
                />
              </div>

              {/* Grid for Amount and Direction */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                    Сума
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    placeholder="Сума в грн"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                    Напрямок платежу
                  </label>
                  <select
                    value={editDirection}
                    onChange={(e) => setEditDirection(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  >
                    <option value="in">Надходження (дохід)</option>
                    <option value="out">Витрата (списання)</option>
                  </select>
                </div>
              </div>

              {/* Type select */}
              <div>
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                  Тип / Категорія транзакції
                </label>
                <select
                  value={editTxType}
                  onChange={(e) => setEditTxType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                >
                  <option value="income">Дохід від бізнесу</option>
                  <option value="expense">Витрати господарські</option>
                  <option value="own_funds">Власні кошти (не оклад)</option>
                  <option value="refund">Повернення коштів</option>
                  <option value="loan">Позики, кредити, фіндопомога</option>
                  <option value="tax_payment">Сплачені податки / бюджет</option>
                  <option value="salary_payment">Виплата зарплати</option>
                </select>
              </div>

              {/* Taxable checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="taxableCheckbox"
                  checked={editTaxable}
                  onChange={(e) => setEditTaxable(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                />
                <label htmlFor="taxableCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Ця операція підлягає оподаткуванню (Taxable)
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submittingEdit}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg disabled:opacity-50 glow-button"
              >
                {submittingEdit ? "Збереження..." : "Зберегти зміни"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Split transaction modal */}
      {splittingTx && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Розподілити платіж</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Розподіліть суму консолідованого платежу LiqPay/Mono Pay між мешканцями.
                </p>
              </div>
              <button
                onClick={() => setSplittingTx(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                Закрити
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 shrink-0 space-y-1 text-xs">
              <div><span className="text-slate-400 font-bold">Опис:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{splittingTx.purpose}</span></div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Загальна сума:</span>
                <span className="text-sm font-extrabold text-indigo-500">{splittingTx.amount.toLocaleString("uk-UA")} грн</span>
              </div>
            </div>

            {/* Split rows container */}
            <form onSubmit={handleSaveSplit} className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[150px]">
              <div className="space-y-3">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block">
                  Розподіл суми
                </label>

                {splitRows.map((row, idx) => (
                  <div key={idx} className="flex gap-3 items-center">
                    <div className="flex-1">
                      <select
                        value={row.member_id}
                        onChange={(e) => handleSplitRowChange(idx, "member_id", e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
                        required
                      >
                        <option value={0}>Оберіть мешканця / об'єкт...</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.property_type || "кв."} {m.identifier} — {m.owner_name || "Невідомо"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-36">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Сума"
                        value={row.amount}
                        onChange={(e) => handleSplitRowChange(idx, "amount", e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
                        required
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSplitRow(idx)}
                      disabled={splitRows.length === 1}
                      className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 shrink-0"
                      title="Видалити рядок"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSplitRow}
                className="w-full py-2 border border-dashed border-indigo-500/30 rounded-xl text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-500/5 transition-all"
              >
                + Додати мешканця
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4 shrink-0">
              {/* Calculate remainder */}
              {(() => {
                const totalSplit = splitRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                const remainder = splittingTx.amount - totalSplit;
                const isOver = remainder < -0.01;

                return (
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-400">Розподілено: </span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{totalSplit.toFixed(2)} грн</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Залишок: </span>
                      <span className={`font-black ${isOver ? "text-rose-500" : "text-emerald-500"}`}>
                        {remainder.toFixed(2)} / {splittingTx.amount.toFixed(2)} грн
                      </span>
                    </div>
                  </div>
                );
              })()}

              {splitError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-500 flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{splitError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveSplit}
                disabled={submittingSplit}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg disabled:opacity-50"
              >
                {submittingSplit ? "Збереження..." : "Підтвердити розподіл"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Transaction Modal */}
      {isAddingManualTx && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Додати транзакцію вручну</h3>
                <p className="text-xs text-slate-400 mt-1">Створіть новий запис про платіж та оновіть баланси.</p>
              </div>
              <button
                onClick={() => setIsAddingManualTx(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                Закрити
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[150px]">
              <div className="grid grid-cols-2 gap-4">
                {/* Direction */}
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block mb-1.5">
                    Напрямок платежу
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setManualDirection("in");
                        if (["expense", "tax_payment", "salary_payment"].includes(manualTxType)) {
                          setManualTxType("income");
                        }
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        manualDirection === "in"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "border-slate-250 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400"
                      }`}
                    >
                      Вхідний платіж (Дохід)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualDirection("out");
                        if (manualTxType === "income") {
                          setManualTxType("expense");
                        }
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        manualDirection === "out"
                          ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
                          : "border-slate-250 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400"
                      }`}
                    >
                      Вихідний платіж (Витрата)
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block mb-1.5">
                    Сума (грн)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-250"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block mb-1.5">
                    Дата платежу
                  </label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-250"
                  />
                </div>

                {/* Resident / Member dropdown */}
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block mb-1.5">
                    Мешканець / Об'єкт (Оновлює баланс)
                  </label>
                  <select
                    value={manualMemberId}
                    onChange={(e) => handleManualMemberChange(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-250"
                  >
                    <option value={0}>Не вказано (загальний платіж)</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.property_type || "кв."} {m.identifier} — {m.owner_name || "Невідомо"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Contragent text input */}
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block mb-1.5">
                    Контрагент / Одержувач
                  </label>
                  <input
                    type="text"
                    placeholder="Введіть назву контрагента або ПІБ"
                    value={manualContragent}
                    onChange={(e) => setManualContragent(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-250"
                  />
                </div>

                {/* Purpose */}
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block mb-1.5">
                    Призначення платежу
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Наприклад: Внески за утримання будинку за червень 2026"
                    value={manualPurpose}
                    onChange={(e) => setManualPurpose(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-250"
                  />
                </div>

                {/* Category Type */}
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block mb-1.5">
                    Категорія
                  </label>
                  <select
                    value={manualTxType}
                    onChange={(e) => setManualTxType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-250"
                  >
                    {manualDirection === "in" ? (
                      <>
                        <option value="income">Дохід</option>
                        <option value="own_funds">Власні кошти / Поповнення</option>
                        <option value="refund">Повернення</option>
                        <option value="loan">Позики / Кредити</option>
                      </>
                    ) : (
                      <>
                        <option value="expense">Витрата</option>
                        <option value="tax_payment">Сплата податків</option>
                        <option value="salary_payment">Виплата зарплати</option>
                        <option value="own_funds">Власні кошти / Вилучення</option>
                        <option value="refund">Повернення</option>
                        <option value="loan">Позики / Кредити</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Taxable Checkbox */}
                <div className="flex items-center pt-5 pl-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={manualTaxable}
                      onChange={(e) => setManualTaxable(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 bg-slate-50 dark:bg-slate-900"
                    />
                    Оподатковуваний платіж
                  </label>
                </div>
              </div>

              {manualError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-500 flex items-start gap-1.5 shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{manualError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingManual}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg disabled:opacity-50 shrink-0"
              >
                {submittingManual ? "Створення..." : "Зберегти транзакцію"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
