"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { invoicesApi, certificatesApi } from "@/lib/api";
import Link from "next/link";
import { FileText, Plus, Search, Filter, Download, Send, Trash2, Mail, ExternalLink, RefreshCw, Shield, CheckCircle, X } from "lucide-react";

export default function InvoicesList() {
  const { selectedProfile } = useApp();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Modal states for sending
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<any>(null);
  const [toEmail, setToEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modal states for KEP signing
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signingDocId, setSigningDocId] = useState<number | null>(null);
  const [signingDocType, setSigningDocType] = useState<string | null>(null);
  const [certificatesList, setCertificatesList] = useState<any[]>([]);
  const [selectedCertId, setSelectedCertId] = useState<number | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signModalError, setSignModalError] = useState<string | null>(null);

  const openSignModal = async (docId: number, docType: string) => {
    if (!selectedProfile) return;
    setSigningDocId(docId);
    setSigningDocType(docType);
    setSignModalError(null);
    setSelectedCertId(null);
    setSignModalOpen(true);
    
    try {
      const list = await certificatesApi.list(selectedProfile.id);
      setCertificatesList(list);
      if (list.length > 0) {
        setSelectedCertId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load certificates:", err);
      setSignModalError("Не вдалося завантажити список КЕП.");
    }
  };

  const handleSign = async (useDiia: boolean = false) => {
    if (!signingDocId || !signingDocType) return;
    if (!useDiia && !selectedCertId) {
      setSignModalError("Будь ласка, оберіть сертифікат для підписання.");
      return;
    }

    setIsSigning(true);
    setSignModalError(null);

    try {
      const res = await certificatesApi.signDocument(
        signingDocId,
        signingDocType,
        useDiia ? undefined : (selectedCertId || undefined),
        useDiia
      );

      if (res.diia_flow && res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        alert("Документ успішно підписано КЕП!");
        setSignModalOpen(false);
        fetchInvoices();
      }
    } catch (err: any) {
      console.error("Failed to sign document:", err);
      setSignModalError(err.response?.data?.detail || "Помилка підписання документа.");
    } finally {
      setIsSigning(false);
    }
  };

  const fetchInvoices = useCallback(async () => {
    if (!selectedProfile) return;
    setLoading(true);
    try {
      const data = await invoicesApi.getAll({ profile_id: selectedProfile.id });
      setInvoices(data);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProfile]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleDelete = async (id: number, num: string) => {
    if (!confirm(`Ви впевнені, що хочете видалити рахунок ${num}?`)) return;
    try {
      await invoicesApi.delete(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err) {
      console.error("Failed to delete invoice:", err);
      alert("Не вдалося видалити рахунок.");
    }
  };

  const handleDownloadPdf = async (id: number, number: string, status?: string) => {
    try {
      let blob;
      if (status === "signed") {
        blob = await certificatesApi.getSignedPdfBlob(id, "invoice");
      } else {
        blob = await invoicesApi.getPdf(id);
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoice_${number}${status === "signed" ? "_signed" : ""}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download PDF:", err);
      alert("Не вдалося завантажити PDF.");
    }
  };

  const handleCreateDocument = async (invoiceId: number, docType: string) => {
    try {
      await invoicesApi.createDocument(invoiceId, docType);
      fetchInvoices(); // Refresh list to show the newly generated document
    } catch (err) {
      console.error("Failed to create document:", err);
      alert("Не вдалося створити документ.");
    }
  };

  const handleDownloadDocumentPdf = async (invoiceId: number, actId: number, number: string, docType: string, status?: string) => {
    try {
      let blob;
      if (status === "signed") {
        blob = await certificatesApi.getSignedPdfBlob(actId, "act");
      } else {
        blob = await invoicesApi.getDocumentPdf(invoiceId);
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const label = docType === "waybill" ? "waybill" : "act";
      link.setAttribute("download", `${label}_${number}${status === "signed" ? "_signed" : ""}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download document PDF:", err);
      alert("Не вдалося завантажити PDF документа.");
    }
  };

  const openSendModal = (invoice: any) => {
    setCurrentInvoice(invoice);
    setToEmail(invoice.client_email || "");
    
    const docLabel = invoice.act 
      ? (invoice.document_type === "waybill" ? " та видаткова накладна" : " та акт виконаних робіт")
      : "";
    setEmailSubject(`Рахунок №${invoice.invoice_number}${docLabel}`);
    
    const docDesc = invoice.act 
      ? (invoice.document_type === "waybill" ? "\nТакож додається видаткова накладна №" + invoice.act.act_number + "." : "\nТакож додається акт виконаних робіт №" + invoice.act.act_number + ".")
      : "";
      
    setEmailMessage(
      `Доброго дня!\n\nВам виставлено рахунок №${invoice.invoice_number} на суму ${invoice.amount.toLocaleString("uk-UA")} грн.${docDesc}\n\nДокументи у форматі PDF прикріплено до листа.\n\nДякуємо за співпрацю!`
    );
    setModalMessage(null);
    setSendModalOpen(true);
  };

  const handleSendInvoice = async () => {
    if (!currentInvoice) return;
    setIsSending(true);
    setModalMessage(null);
    try {
      await invoicesApi.send(currentInvoice.id, toEmail, emailSubject, emailMessage);
      setModalMessage({ text: "Рахунок успішно надіслано контрагенту!", type: "success" });
      setTimeout(() => {
        setSendModalOpen(false);
        fetchInvoices(); // Refresh status from draft to sent
      }, 1500);
    } catch (err: any) {
      setModalMessage({
        text: `Не вдалося надіслати: ${err?.response?.data?.detail || err.message}`,
        type: "error",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Filter invoices locally based on UI inputs
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.service_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "sent":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "draft":
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      case "cancelled":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-700 text-slate-300 border-slate-650";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return "Сплачено";
      case "sent":
        return "Надіслано";
      case "draft":
        return "Чернетка";
      case "cancelled":
        return "Скасовано";
      default:
        return status;
    }
  };

  if (!selectedProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <FileText className="w-16 h-16 text-slate-600 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-slate-300">Профіль не обрано</h2>
        <p className="text-sm text-slate-500 max-w-sm mt-2">
          Будь ласка, оберіть активний профіль ТОВ або ФОП у лівій панелі навігації, щоб розпочати роботу з рахунками.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Управління рахунками</h1>
          <p className="text-sm text-slate-400 mt-1">
            Створюйте деталізовані рахунки з товарними позиціями та надсилайте їх клієнтам.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/15 transition-all gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Створити рахунок
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 placeholder-slate-600 text-xs transition-all"
            placeholder="Пошук рахунка, клієнта..."
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <span className="text-xs text-slate-500 flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Фільтр статусу:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/60 border border-slate-850 text-slate-300 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">Всі статуси</option>
            <option value="draft">Чернетки</option>
            <option value="sent">Надіслано</option>
            <option value="paid">Сплачено</option>
            <option value="cancelled">Скасовано</option>
          </select>
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-xs text-slate-400 font-semibold">Завантаження рахунків...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-20 text-center max-w-md mx-auto px-4">
            <FileText className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-300">Рахунків не знайдено</p>
            <p className="text-xs text-slate-500 mt-1.5">
              Створіть свій перший деталізований рахунок-фактуру з позиціями, щоб надіслати клієнту на email.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/20 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">Номер</th>
                  <th className="py-4 px-6">Контрагент</th>
                  <th className="py-4 px-6">Дата</th>
                  <th className="py-4 px-6">Сума</th>
                  <th className="py-4 px-6 text-center">Статус</th>
                  <th className="py-4 px-6 text-center">Документ</th>
                  <th className="py-4 px-6 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-xs font-medium text-slate-200">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/20 transition-all">
                    <td className="py-4 px-6 font-bold text-slate-100">{inv.invoice_number}</td>
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-bold text-slate-300">{inv.client_name || "Фізична особа"}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{inv.client_email}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-400">
                      {new Date(inv.send_date).toLocaleDateString("uk-UA")}
                    </td>
                    <td className="py-4 px-6 font-bold text-indigo-400">
                      {inv.amount.toLocaleString("uk-UA", { minimumFractionDigits: 2 })} ₴
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(inv.status)}`}>
                        {getStatusLabel(inv.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {inv.act ? (
                        <div className="flex items-center justify-center gap-1.5 animate-in fade-in duration-200">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                            {inv.document_type === "waybill" ? "Накладна" : "Акт"} №{inv.act.act_number}
                          </span>
                          <button
                            onClick={() => handleDownloadDocumentPdf(inv.id, inv.act.id, inv.invoice_number, inv.document_type || "act", inv.act.status)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-md transition-all"
                            title="Завантажити PDF документа"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {inv.act.status !== "signed" ? (
                            <button
                              onClick={() => openSignModal(inv.act.id, "act")}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-md transition-all"
                              title="Підписати КЕП"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="p-1 text-emerald-500 rounded-md inline-block" title="Підписано КЕП">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <button
                            onClick={() => openSendModal(inv)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-md transition-all"
                            title="Надіслати документи контрагенту"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleCreateDocument(inv.id, "act")}
                            className="px-2 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-md text-[10px] font-bold transition-all"
                          >
                            + Акт
                          </button>
                          <button
                            onClick={() => handleCreateDocument(inv.id, "waybill")}
                            className="px-2 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-md text-[10px] font-bold transition-all"
                          >
                            + Накладна
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleDownloadPdf(inv.id, inv.invoice_number, inv.status)}
                        className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                        title="Завантажити PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {inv.status !== "signed" ? (
                        <button
                          onClick={() => openSignModal(inv.id, "invoice")}
                          className="p-2 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition-all"
                          title="Підписати КЕП"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="p-2 text-emerald-500 rounded-lg inline-block" title="Підписано КЕП">
                          <CheckCircle className="w-4 h-4" />
                        </span>
                      )}
                      <button
                        onClick={() => openSendModal(inv)}
                        className="p-2 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg transition-all"
                        title="Надіслати на email"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id, inv.invoice_number)}
                        className="p-2 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
                        title="Видалити"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send Invoice Modal */}
      {sendModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-slate-100 animate-in fade-in duration-200">
                  Надіслати рахунок {currentInvoice?.invoice_number}
                  {currentInvoice?.act && ` та ${currentInvoice.document_type === "waybill" ? "накладну" : "акт"} №${currentInvoice.act.act_number}`}
                </h3>
              </div>
              <button
                onClick={() => setSendModalOpen(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                &times;
              </button>
            </div>

            {modalMessage && (
              <div className={`p-4 text-xs font-semibold ${
                modalMessage.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
              }`}>
                {modalMessage.text}
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email отримувача</label>
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs"
                  placeholder="client@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Тема листа</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Супровідний текст</label>
                <textarea
                  rows={5}
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/20 flex justify-end space-x-3">
              <button
                onClick={() => setSendModalOpen(false)}
                className="px-4 py-2 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl"
              >
                Скасувати
              </button>
              <button
                onClick={handleSendInvoice}
                disabled={isSending}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5"
              >
                {isSending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Надіслати</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Document Modal */}
      {signModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[#111625] border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-500" />
                  Підписання КЕП
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Оберіть спосіб підписання документа
                </p>
              </div>
              <button
                onClick={() => setSignModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {signModalError && (
              <div className="p-4 text-xs font-semibold bg-rose-500/10 text-rose-400 border-b border-rose-500/20">
                {signModalError}
              </div>
            )}

            <div className="p-6 space-y-6">
              {/* Option 1: Loaded certificates */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Варіант 1: Завантажений КЕП (.p12/.pfx/.dat/.jks тощо)
                </label>
                {certificatesList.length === 0 ? (
                  <div className="p-4 bg-slate-900/50 border border-slate-850 rounded-xl text-center">
                    <p className="text-xs text-slate-500">Немає завантажених КЕП для цього профілю.</p>
                    <Link
                      href="/settings/certificates"
                      className="text-xs text-indigo-400 hover:underline font-bold mt-2 inline-block"
                      onClick={() => setSignModalOpen(false)}
                    >
                      + Налаштувати КЕП
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedCertId || ""}
                      onChange={(e) => setSelectedCertId(Number(e.target.value))}
                      className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs"
                    >
                      {certificatesList.map((cert) => (
                        <option key={cert.id} value={cert.id}>
                          {cert.cert_owner_name} ({cert.cert_issuer.slice(0, 15)}...)
                        </option>
                      ))}
                    </select>
                    
                    <button
                      onClick={() => handleSign(false)}
                      disabled={isSigning}
                      className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all text-xs flex items-center justify-center gap-1.5"
                    >
                      {isSigning ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Shield className="w-3.5 h-3.5" />
                      )}
                      <span>Підписати завантаженим КЕП</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider">або</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Option 2: Diia Sign */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Варіант 2: Дія.Підпис (через додаток Дія)
                </label>
                <button
                  onClick={() => handleSign(true)}
                  disabled={isSigning}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  <span className="font-bold text-sm mr-1">Дія</span>
                  <span>Підписати через Дія.Підпис</span>
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/20 flex justify-end">
              <button
                onClick={() => setSignModalOpen(false)}
                className="px-4 py-2 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl"
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
