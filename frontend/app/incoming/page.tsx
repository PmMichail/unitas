"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { invoicesApi, certificatesApi } from "@/lib/api";
import { 
  FileText, 
  Download, 
  PenTool, 
  Search, 
  MailOpen, 
  CheckCircle, 
  X, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  Clock, 
  Check, 
  FileCheck,
  Eye
} from "lucide-react";

export default function IncomingDocuments() {
  const { selectedProfile } = useApp();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);

  // KEP signing modal states
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signingDocId, setSigningDocId] = useState<number | null>(null);
  const [signingDocType, setSigningDocType] = useState<string | null>(null);
  const [certificatesList, setCertificatesList] = useState<any[]>([]);
  const [selectedCertId, setSelectedCertId] = useState<number | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signModalError, setSignModalError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!selectedProfile) return;
    setLoading(true);
    try {
      const data = await invoicesApi.getIncoming(selectedProfile.id);
      setDocuments(data);
    } catch (err) {
      console.error("Failed to fetch incoming documents:", err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProfile]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleRowClick = async (doc: any) => {
    const isCurrentlyExpanded = expandedDocId === doc.id;
    setExpandedDocId(isCurrentlyExpanded ? null : doc.id);

    // If expanding and not viewed, mark as viewed
    if (!isCurrentlyExpanded && !doc.viewed && selectedProfile) {
      try {
        await invoicesApi.markIncomingViewed(doc.id, selectedProfile.id);
        // Update local state to show it is viewed
        setDocuments(prev => 
          prev.map(d => d.id === doc.id ? { ...d, viewed: true } : d)
        );
      } catch (err) {
        console.error("Failed to mark document as viewed:", err);
      }
    }
  };

  const handleDownloadPdf = async (id: number, number: string, status?: string, isSigned?: boolean) => {
    try {
      let blob;
      if (isSigned || status === "signed") {
        blob = await certificatesApi.getSignedPdfBlob(id, "invoice");
      } else {
        blob = await invoicesApi.getPdf(id);
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoice_${number}${isSigned || status === "signed" ? "_signed" : ""}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download PDF:", err);
      alert("Не вдалося завантажити PDF рахунку.");
    }
  };

  const handleDownloadDocumentPdf = async (invoiceId: number, actId: number, number: string, status?: string, isSigned?: boolean) => {
    try {
      let blob;
      if (isSigned || status === "signed") {
        blob = await certificatesApi.getSignedPdfBlob(actId, "act");
      } else {
        blob = await invoicesApi.getDocumentPdf(invoiceId);
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `act_${number}${isSigned || status === "signed" ? "_signed" : ""}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download document PDF:", err);
      alert("Не вдалося завантажити PDF акта.");
    }
  };

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
        fetchDocuments();
      }
    } catch (err: any) {
      console.error("Failed to sign document:", err);
      setSignModalError(err.response?.data?.detail || "Помилка підписання документа.");
    } finally {
      setIsSigning(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const query = searchQuery.toLowerCase();
    return (
      doc.invoice_number.toLowerCase().includes(query) ||
      doc.sender_name.toLowerCase().includes(query) ||
      doc.amount.toString().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto z-10 relative">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 dark:from-white dark:via-slate-100 dark:to-indigo-200 bg-clip-text text-transparent">
              Вхідні документи
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Переглядайте, завантажуйте та підписуйте КЕП документи від ваших контрагентів
            </p>
          </div>
        </div>

        {!selectedProfile ? (
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 text-center max-w-md mx-auto my-12">
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Профіль не обрано</h3>
            <p className="text-slate-400 text-sm mb-6">
              Будь ласка, оберіть або створіть робочий профіль у бічному меню для перегляду вхідних документів.
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <p className="text-slate-400 text-sm">Завантаження вхідних документів...</p>
          </div>
        ) : (
          <>
            {/* Search and Filters */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center shadow-lg">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Пошук за номером, відправником або сумою..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {filteredDocs.length === 0 ? (
              <div className="bg-slate-900/20 backdrop-blur-xl border border-slate-900 rounded-3xl p-16 text-center shadow-xl">
                <MailOpen className="w-14 h-14 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-300 mb-2">Вхідна скринька порожня</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  Тут з'являться документи, надіслані вашими партнерами. Ви отримаєте email сповіщення про нові документи.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredDocs.map((doc) => {
                  const isExpanded = expandedDocId === doc.id;
                  const hasAct = !!doc.act;
                  
                  return (
                    <div 
                      key={doc.id}
                      className={`bg-slate-900/40 backdrop-blur-xl border rounded-2xl transition-all overflow-hidden ${
                        isExpanded ? 'border-indigo-500/50 shadow-indigo-950/20 shadow-xl' : 'border-slate-800/80 hover:border-slate-700/80'
                      }`}
                    >
                      {/* Header row */}
                      <div 
                        onClick={() => handleRowClick(doc)}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                      >
                        <div className="flex items-start gap-3.5">
                          {/* Unread indicator */}
                          <div className="pt-1.5">
                            {!doc.viewed ? (
                              <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                              </span>
                            ) : (
                              <span className="block h-3 w-3 bg-transparent" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-lg">
                                Рахунок №{doc.invoice_number}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                {doc.document_type === "waybill" ? "з накладною" : (hasAct ? "з актом" : "тільки рахунок")}
                              </span>
                            </div>
                            <div className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                              <span>Від: <strong className="text-slate-300">{doc.sender_name}</strong></span>
                              <span className="text-slate-600">•</span>
                              <span>{doc.send_date ? new Date(doc.send_date).toLocaleDateString("uk-UA") : ""}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6">
                          <div className="text-right">
                            <span className="block text-xl font-black text-white">
                              {doc.amount.toLocaleString("uk-UA")} грн.
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                              {doc.is_signed || doc.status === "signed" ? (
                                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                  <Check className="w-3.5 h-3.5" /> Підписано
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-amber-400 font-medium">
                                  <Clock className="w-3.5 h-3.5" /> Очікує підпису
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="text-slate-500 hover:text-slate-300 transition-colors">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>
                      </div>

                      {/* Detail row */}
                      {isExpanded && (
                        <div className="border-t border-slate-800/80 bg-slate-950/40 p-6 flex flex-col md:flex-row md:items-start gap-8 justify-between">
                          <div className="flex-1 space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Перелік документів</h4>
                              <div className="space-y-2.5">
                                {/* Invoice Card */}
                                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-indigo-400" />
                                    <div>
                                      <div className="font-semibold text-slate-200">Рахунок-фактура №{doc.invoice_number}</div>
                                      <div className="text-xs text-slate-400 mt-0.5">Основний платіжний документ</div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleDownloadPdf(doc.id, doc.invoice_number, doc.status, doc.is_signed)}
                                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                                      title="Скачати PDF"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                    {!(doc.is_signed || doc.status === "signed") ? (
                                      <button
                                        onClick={() => openSignModal(doc.id, "invoice")}
                                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                                      >
                                        <PenTool className="w-3.5 h-3.5" /> Підписати КЕП
                                      </button>
                                    ) : (
                                      <span className="px-3.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-lg flex items-center gap-1">
                                        <Check className="w-3.5 h-3.5" /> Підписано
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Service Act or Waybill Card */}
                                {hasAct && (
                                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                      <FileCheck className="w-5 h-5 text-emerald-400" />
                                      <div>
                                        <div className="font-semibold text-slate-200">
                                          {doc.document_type === "waybill" ? "Видаткова накладна" : "Акт виконаних робіт"} №{doc.act.act_number}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">Документ про виконання / передачу</div>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleDownloadDocumentPdf(doc.id, doc.act.id, doc.act.act_number, doc.act.status, doc.act.is_signed)}
                                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                                        title="Скачати PDF"
                                      >
                                        <Download className="w-4 h-4" />
                                      </button>
                                      {!(doc.act.is_signed || doc.act.status === "signed") ? (
                                        <button
                                          onClick={() => openSignModal(doc.act.id, "act")}
                                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                          <PenTool className="w-3.5 h-3.5" /> Підписати КЕП
                                        </button>
                                      ) : (
                                        <span className="px-3.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-lg flex items-center gap-1">
                                          <Check className="w-3.5 h-3.5" /> Підписано
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* KEP Signing Modal */}
      {signModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setSignModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
                  <PenTool className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Підписати документ КЕП</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Оберіть ваш підпис для накладання електронного ключа
                  </p>
                </div>
              </div>

              {signModalError && (
                <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>{signModalError}</span>
                </div>
              )}

              {certificatesList.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-800 rounded-2xl mb-6">
                  <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-slate-300">Сертифікат не знайдено</div>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto px-4">
                    У вас немає завантажених КЕП сертифікатів у налаштуваннях цього профілю. Завантажте файл КЕП (.jks, .pfx, .dat) у розділі "Налаштування".
                  </p>
                </div>
              ) : (
                <div className="mb-6 space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Оберіть сертифікат
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {certificatesList.map((cert) => (
                      <div
                        key={cert.id}
                        onClick={() => setSelectedCertId(cert.id)}
                        className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                          selectedCertId === cert.id
                            ? "border-indigo-500 bg-indigo-500/5"
                            : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-200">{cert.owner_name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{cert.serial_number}</div>
                        </div>
                        {selectedCertId === cert.id && (
                          <CheckCircle className="w-5 h-5 text-indigo-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => handleSign(false)}
                  disabled={isSigning || certificatesList.length === 0}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
                >
                  {isSigning && !signingDocType?.includes("diia") ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Накладання підпису...</span>
                    </>
                  ) : (
                    <>
                      <PenTool className="w-4 h-4" />
                      <span>Підписати обраним КЕП</span>
                    </>
                  )}
                </button>

                <div className="relative my-2.5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="px-2 bg-slate-900 text-slate-500">або</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSign(true)}
                  disabled={isSigning}
                  className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  {isSigning && signingDocType?.includes("diia") ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-teal-400/20 border border-teal-400 flex items-center justify-center text-[8px] text-teal-400 font-black">Д</span>
                  )}
                  <span>Підписати через Дія.Підпис</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
