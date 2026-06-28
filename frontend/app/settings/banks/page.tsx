"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Building2, CheckCircle, FileSpreadsheet, Link2, RefreshCw, Upload, AlertTriangle, Clock, Trash2 } from "lucide-react";

const BANKS = [
  { id: "privat", name: "ПриватБанк", mode: "api" },
  { id: "monobank", name: "Monobank", mode: "api" },
  { id: "oshad", name: "Ощадбанк", mode: "manual" },
  { id: "abank", name: "А-Банк", mode: "api" },
  { id: "other", name: "Інший банк", mode: "manual" },
];

export default function BankStatementsPage() {
  const { selectedProfile } = useApp();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"sync" | "connect" | "import" | "journal" | "rules">("sync");
  const [bankCode, setBankCode] = useState("privat");
  const [token, setToken] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [connections, setConnections] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<any>({ connections: [], unmatched_transactions: [], sync_logs: [] });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({ date: "", amount: "", description: "", counterparty: "", balance_after: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const profileId = selectedProfile?.id;

  const loadData = async () => {
    if (!profileId) return;
    try {
      const [connectionsRes, journalRes, syncStatusRes] = await Promise.all([
        api.getBankConnections(profileId),
        api.getBankStatementsJournal(profileId),
        api.getBankSyncStatus(profileId),
      ]);
      setConnections(connectionsRes.connections || []);
      setStatements(journalRes.statements || []);
      setSyncStatus(syncStatusRes || { connections: [], unmatched_transactions: [], sync_logs: [] });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [profileId]);

  useEffect(() => {
    const bank = searchParams.get("bank");
    if (bank && BANKS.some((item) => item.id === bank)) {
      setBankCode(bank);
      setActiveTab("connect");
    }
  }, [searchParams]);

  const showMessage = (type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSetup = async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const authData: Record<string, any> = {};
      if (token) authData.token = token;
      await api.setupBankConnection({
        profile_id: profileId,
        bank_code: bankCode,
        auth_data: authData,
        account_number: accountNumber,
      });
      showMessage("success", "Підключення банку збережено. Облікові дані зашифровані.");
      setToken("");
      setAccountNumber("");
      await loadData();
    } catch (err: any) {
      showMessage("error", err.response?.data?.detail || "Не вдалося зберегти підключення");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!profileId || !selectedFile) return;
    setLoading(true);
    try {
      const data = await api.previewBankStatement(profileId, bankCode, selectedFile);
      setPreview(data);
      const columns = data.columns || [];
      setMapping({
        date: columns.find((c: string) => /дата|date/i.test(c)) || "",
        amount: columns.find((c: string) => /сума|amount|sum/i.test(c)) || "",
        description: columns.find((c: string) => /признач|purpose|description|details/i.test(c)) || "",
        counterparty: columns.find((c: string) => /платник|контрагент|counterparty|payer/i.test(c)) || "",
        balance_after: columns.find((c: string) => /залиш|balance/i.test(c)) || "",
      });
      showMessage("info", "Файл прочитано. Перевірте маппінг колонок перед імпортом.");
    } catch (err: any) {
      showMessage("error", err.response?.data?.detail || "Не вдалося прочитати файл");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!profileId || !selectedFile) return;
    setLoading(true);
    try {
      const result = await api.importBankStatement(profileId, bankCode, selectedFile, mapping);
      showMessage("success", result.message || "Виписку імпортовано");
      setSelectedFile(null);
      setPreview(null);
      await loadData();
      setActiveTab("journal");
    } catch (err: any) {
      showMessage("error", err.response?.data?.detail || "Не вдалося імпортувати виписку");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (connection: any) => {
    if (!profileId) return;
    setLoading(true);
    try {
      const result = await api.syncBank(profileId, connection.bank_name);
      showMessage("success", `Синхронізацію виконано: ${result.transactions_count || 0} нових, ${result.matched_count || 0} зіставлено`);
      await loadData();
    } catch (err: any) {
      showMessage("error", err.response?.data?.detail || "Не вдалося синхронізувати банк");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStatement = async (statementId: number) => {
    if (!window.confirm("Ви впевнені, що хочете видалити цю виписку та всі її транзакції? Баланси мешканців будуть скориговані відповідно.")) return;
    setLoading(true);
    try {
      await api.deleteBankStatement(statementId);
      showMessage("success", "Виписку та її транзакції успішно видалено");
      await loadData();
    } catch (err: any) {
      showMessage("error", err.response?.data?.detail || "Не вдалося видалити виписку");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSyncSettings = async (connection: any) => {
    setLoading(true);
    try {
      await api.updateBankSyncSettings({
        connection_id: connection.id,
        auto_sync_enabled: Boolean(connection.auto_sync_enabled),
        sync_period_days: Number(connection.sync_period_days || 1),
        sync_time: connection.sync_time || "06:00",
        notify_email: Boolean(connection.notify_email),
        notify_push: Boolean(connection.notify_push),
      });
      showMessage("success", "Налаштування автоматичної синхронізації збережено");
      await loadData();
    } catch (err: any) {
      showMessage("error", err.response?.data?.detail || "Не вдалося зберегти налаштування");
    } finally {
      setLoading(false);
    }
  };

  const updateSyncConnection = (id: number, patch: Record<string, any>) => {
    setSyncStatus((prev: any) => ({
      ...prev,
      connections: (prev.connections || []).map((item: any) => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  if (!selectedProfile) {
    return <div className="p-8 text-sm text-slate-500">Оберіть підприємство для роботи з банками.</div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Банки та виписки</h1>
          <p className="text-sm text-slate-500 mt-1">Підключення банків, ручний імпорт CSV/XLSX/DBF та зіставлення платежів мешканців.</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold">
          <RefreshCw className="w-4 h-4" /> Оновити
        </button>
      </div>

      {message && (
        <div className={`rounded-2xl border p-4 text-sm ${message.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300" : message.type === "error" ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300"}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          ["sync", "Автоматична синхронізація"],
          ["connect", "Підключення банку"],
          ["import", "Ручний імпорт"],
          ["journal", "Журнал виписок"],
          ["rules", "Автоматичне зіставлення"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id as any)} className={`px-4 py-2 rounded-xl text-sm font-bold ${activeTab === id ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "sync" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-slate-900 dark:text-white">Автоматична синхронізація</h2>
            </div>
            {(syncStatus.connections || []).filter((connection: any) => ["monobank", "privat"].includes(connection.bank_name)).length === 0 ? (
              <div className="text-sm text-slate-500">Підключіть Monobank або ПриватБанк, щоб увімкнути автоматичну синхронізацію.</div>
            ) : (syncStatus.connections || []).filter((connection: any) => ["monobank", "privat"].includes(connection.bank_name)).map((connection: any) => (
              <div key={connection.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900 dark:text-white">{connection.bank_display_name}</div>
                    <div className="text-xs text-slate-500">Статус: {connection.auto_sync_enabled ? "✅ Активна" : "⏸ Вимкнена"}</div>
                    <div className="text-xs text-slate-500">Остання синхронізація: {connection.last_sync_date ? new Date(connection.last_sync_date).toLocaleString("uk-UA") : "ще не було"}</div>
                    <div className={`text-xs font-bold ${connection.last_sync_status === "error" ? "text-rose-600" : "text-emerald-600"}`}>{connection.last_sync_status || "pending"}: {connection.last_sync_message || "—"}</div>
                  </div>
                  <button disabled={loading} onClick={() => handleSync(connection)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-60">🔄 Синхронізувати зараз</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={Boolean(connection.auto_sync_enabled)} onChange={(e) => updateSyncConnection(connection.id, { auto_sync_enabled: e.target.checked })} /> Увімкнено
                  </label>
                  <select value={connection.sync_period_days || 1} onChange={(e) => updateSyncConnection(connection.id, { sync_period_days: Number(e.target.value) })} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm">
                    {[1, 3, 7, 30].map((days) => <option key={days} value={days}>{days} дн.</option>)}
                  </select>
                  <input type="time" value={connection.sync_time || "06:00"} onChange={(e) => updateSyncConnection(connection.id, { sync_time: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm" />
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={Boolean(connection.notify_email)} onChange={(e) => updateSyncConnection(connection.id, { notify_email: e.target.checked })} /> Email
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={Boolean(connection.notify_push)} onChange={(e) => updateSyncConnection(connection.id, { notify_push: e.target.checked })} /> Push
                  </label>
                </div>
                <button disabled={loading} onClick={() => handleSaveSyncSettings(connection)} className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold disabled:opacity-60">💾 Зберегти налаштування</button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
              <h2 className="font-bold text-slate-900 dark:text-white">Останні не зіставлені транзакції</h2>
              {(syncStatus.unmatched_transactions || []).length === 0 ? <div className="text-sm text-slate-500">Немає незіставлених автотранзакцій.</div> : (syncStatus.unmatched_transactions || []).map((tx: any) => (
                <div key={tx.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{Number(tx.amount || 0).toFixed(2)} грн</div>
                    <div className="text-xs text-slate-500">{tx.date ? new Date(tx.date).toLocaleDateString("uk-UA") : "—"} · {tx.contragent || tx.purpose || "Без опису"}</div>
                  </div>
                  <span className="text-xs text-indigo-600">🔍</span>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
              <h2 className="font-bold text-slate-900 dark:text-white">Журнал синхронізацій</h2>
              {(syncStatus.sync_logs || []).length === 0 ? <div className="text-sm text-slate-500">Логів синхронізації ще немає.</div> : (syncStatus.sync_logs || []).map((log: any) => (
                <div key={log.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className={`text-sm font-bold ${log.status === "error" ? "text-rose-600" : "text-emerald-600"}`}>{log.status}</div>
                  <div className="text-xs text-slate-500">{log.sync_date ? new Date(log.sync_date).toLocaleString("uk-UA") : "—"}</div>
                  <div className="text-xs text-slate-500">Завантажено: {log.transactions_count}, зіставлено: {log.matched_count}</div>
                  {log.error_message && <div className="text-xs text-rose-600 mt-1">{log.error_message}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "connect" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-slate-900 dark:text-white">Нове підключення</h2>
            </div>
            <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm">
              {BANKS.map((bank) => <option key={bank.id} value={bank.id}>{bank.name} — {bank.mode === "api" ? "API" : "ручний імпорт"}</option>)}
            </select>

            {bankCode === "monobank" && (
              <div className="space-y-3">
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Monobank token (ФОП / рахунок)" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm" />
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="IBAN рахунку ФОП" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm" />
              </div>
            )}

            {bankCode === "privat" && (
              <div className="space-y-3">
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Токен API (з Privat24 для бізнесу → Інтеграція → API)" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm" />
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Номер рахунку" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm" />
              </div>
            )}

            {bankCode === "abank" && (
              <div className="space-y-3">
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="A-Bank token (EXAPI0001)" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm" />
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="IBAN рахунку" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm" />
              </div>
            )}

            {BANKS.find(b => b.id === bankCode)?.mode === "manual" && (
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="IBAN / номер рахунку" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm" />
            )}
            <button disabled={loading} onClick={handleSetup} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-60">
              Зберегти підключення
            </button>
            <div className="flex gap-2 text-xs text-slate-500">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Дані доступу зберігаються у зашифрованому вигляді. Для Ощадбанку на першому етапі використовуйте ручний імпорт.
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <h2 className="font-bold text-slate-900 dark:text-white">Активні підключення</h2>
            {connections.length === 0 ? <div className="text-sm text-slate-500">Підключень поки немає.</div> : connections.map((connection) => (
              <div key={connection.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{connection.bank_display_name}</div>
                  <div className="text-xs text-slate-500">{connection.account_number || "Рахунок не вказано"}</div>
                  <div className="text-xs text-slate-400">Остання синхронізація: {connection.last_sync ? new Date(connection.last_sync).toLocaleString("uk-UA") : "ще не було"}</div>
                </div>
                <button onClick={() => handleSync(connection)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Sync</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "import" && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">Ручний імпорт CSV/XLSX/DBF</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm">
              {BANKS.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
            </select>
            <input type="file" accept=".csv,.xlsx,.xls,.dbf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="md:col-span-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm" />
          </div>
          <button disabled={!selectedFile || loading} onClick={handlePreview} className="px-5 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold disabled:opacity-60">Прочитати файл і налаштувати маппінг</button>

          {preview && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {[
                  ["date", "Дата *"],
                  ["amount", "Сума *"],
                  ["description", "Призначення"],
                  ["counterparty", "Платник/контрагент"],
                  ["balance_after", "Залишок"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">{label}</label>
                    <select value={mapping[key] || ""} onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm">
                      <option value="">Не використовувати</option>
                      {(preview.columns || []).map((column: string) => <option key={column} value={column}>{column}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500">
                    <tr>{(preview.columns || []).map((column: string) => <th key={column} className="p-3 text-left font-bold">{column}</th>)}</tr>
                  </thead>
                  <tbody>
                    {(preview.preview || []).map((row: any, index: number) => (
                      <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                        {(preview.columns || []).map((column: string) => <td key={column} className="p-3 text-slate-600 dark:text-slate-300">{String(row[column] ?? "")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button disabled={loading || !mapping.date || !mapping.amount} onClick={handleImport} className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-60">Імпортувати транзакції</button>
            </div>
          )}
        </div>
      )}

      {activeTab === "journal" && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">Журнал виписок</h2>
          </div>
          {statements.length === 0 ? <div className="text-sm text-slate-500">Виписок ще немає.</div> : statements.map((statement) => (
            <div key={statement.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-900 dark:text-white truncate">{statement.file_name}</div>
                <div className="text-xs text-slate-500 mt-1">{statement.bank_name} · {statement.uploaded_at ? new Date(statement.uploaded_at).toLocaleDateString("uk-UA") : "—"}</div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{statement.transactions_count} транз.</div>
                  <div className="text-xs text-emerald-600 mt-0.5">{statement.status}</div>
                </div>
                <button
                  onClick={() => handleDeleteStatement(statement.id)}
                  disabled={loading}
                  className="p-2 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 disabled:opacity-40 transition-colors"
                  title="Видалити виписку"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "rules" && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Link2 className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">Правила автоматичного зіставлення</h2>
          </div>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" /> Система шукає номер квартири/ділянки з поля особового рахунку в призначенні платежу.</div>
            <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" /> Якщо номер не знайдено, система шукає ПІБ власника у призначенні та контрагенті.</div>
            <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" /> Незіставлені транзакції залишаються зі статусом pending і доступні для ручної обробки у транзакціях.</div>
          </div>
        </div>
      )}
    </div>
  );
}
