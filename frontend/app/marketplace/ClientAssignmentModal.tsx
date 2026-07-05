"use client";

import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import {
  X,
  Building2,
  User,
  MessageSquare,
  FileText,
  Shield,
  Download,
  Edit3,
  Check,
  AlertTriangle,
  Send,
  Calendar,
  DollarSign,
  Phone,
  Mail
} from "lucide-react";

interface AssignmentData {
  id: number;
  company_name: string;
  company_id: number;
  company_phone: string;
  company_email: string;
  accountant: {
    id: number;
    name: string;
    email: string;
    phone: string;
  } | null;
  is_suspended: boolean;
  assigned_at: string | null;
  offer_title: string;
  offer_description: string;
  price: number;
  target_type: string;
}

interface Props {
  assignment: AssignmentData;
  clientProfileId: number;
  userId: number;
  onClose: () => void;
  onTerminated: () => void;
}

type Tab = "info" | "chat_company" | "chat_accountant" | "agreement_company" | "agreement_accountant";

export default function ClientAssignmentModal({ assignment, clientProfileId, userId, onClose, onTerminated }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [duration, setDuration] = useState<number>(1);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [terminating, setTerminating] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Agreement state
  const [agreement, setAgreement] = useState<any>(null);
  const [editingAgreement, setEditingAgreement] = useState(false);
  const [agreementText, setAgreementText] = useState("");
  const [agreementLoading, setAgreementLoading] = useState(false);

  const chatRoomType = activeTab === "chat_company" ? "client_company" : "client_accountant";
  const chatRecipientId = activeTab === "chat_company" ? assignment.company_id : assignment.accountant?.id;

  // Fetch messages when chat tab is active
  useEffect(() => {
    if (activeTab !== "chat_company" && activeTab !== "chat_accountant") return;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/support/messages/${clientProfileId}`, {
          params: { room_type: chatRoomType, recipient_id: chatRecipientId, _t: Date.now() }
        });
        setMessages(res.data);
      } catch (e) {
        console.error("Failed to load messages:", e);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [activeTab, clientProfileId, chatRoomType, chatRecipientId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch agreement when agreement tab is active
  useEffect(() => {
    if (activeTab !== "agreement_company" && activeTab !== "agreement_accountant") return;

    const agreementType = activeTab === "agreement_company" ? "company_client" : "company_accountant";
    const partyId = activeTab === "agreement_company" ? clientProfileId : assignment.accountant?.id;

    const fetchAgreement = async () => {
      setAgreementLoading(true);
      try {
        if (activeTab === "agreement_company") {
          const res = await axios.get(`${API_BASE_URL}/api/marketplace/client-agreement`, {
            params: { client_profile_id: clientProfileId, agreement_type: "company_client", user_id: userId }
          });
          setAgreement(res.data);
          setAgreementText(res.data.contract_text || "");
        } else {
          // For accountant agreement, use consulting endpoint
          const res = await axios.get(`${API_BASE_URL}/api/consulting/agreements`, {
            params: { party_id: assignment.accountant?.id, agreement_type: "company_accountant", user_id: userId }
          });
          setAgreement(res.data);
          setAgreementText(res.data.contract_text || "");
        }
      } catch (e) {
        console.error("Failed to load agreement:", e);
      } finally {
        setAgreementLoading(false);
      }
    };

    fetchAgreement();
  }, [activeTab, clientProfileId, assignment.accountant?.id, userId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText("");
    setChatLoading(true);

    // Optimistic
    const tempMsg = {
      id: Date.now(),
      is_from_admin: false,
      text,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await axios.post(`${API_BASE_URL}/api/support/message`, {
        profile_id: clientProfileId,
        text,
        room_type: chatRoomType,
        recipient_id: chatRecipientId
      });
    } catch (e) {
      console.error("Failed to send:", e);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveAgreement = async () => {
    setAgreementLoading(true);
    try {
      if (activeTab === "agreement_company") {
        // Use consulting endpoint (client can't update, only company can)
        // For now, just show a message
        alert("Редагування договору доступне з боку консалтингової компанії.");
      } else {
        await axios.put(`${API_BASE_URL}/api/consulting/agreements/update`,
          new URLSearchParams({
            party_id: String(assignment.accountant?.id),
            agreement_type: "company_accountant",
            contract_text: agreementText
          }),
          { params: { user_id: userId } }
        );
        setEditingAgreement(false);
        setAgreement({ ...agreement, contract_text: agreementText });
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || "Помилка збереження");
    } finally {
      setAgreementLoading(false);
    }
  };

  const handleDownloadAgreement = () => {
    const agreementType = activeTab === "agreement_company" ? "company_client" : "company_accountant";
    const partyId = activeTab === "agreement_company" ? clientProfileId : assignment.accountant?.id;
    window.open(`${API_BASE_URL}/api/consulting/agreements/download?party_id=${partyId}&agreement_type=${agreementType}&user_id=${userId}`, "_blank");
  };

  const handleTerminate = async () => {
    setTerminating(true);
    try {
      await axios.post(`${API_BASE_URL}/api/marketplace/terminate`, {
        client_profile_id: clientProfileId
      }, { params: { user_id: userId } });
      onTerminated();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Помилка");
    } finally {
      setTerminating(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" });
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "info", label: "Інформація", icon: Building2 },
    { id: "chat_company", label: "Чат з компанією", icon: MessageSquare },
    { id: "chat_accountant", label: "Чат з бухгалтером", icon: User },
    { id: "agreement_company", label: "Договір з компанією", icon: FileText },
    { id: "agreement_accountant", label: "Договір з бухгалтером", icon: Shield },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl mx-4 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black text-sm border border-indigo-500/20">
              {assignment.company_name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">{assignment.company_name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {assignment.is_suspended ? "Призупинено" : "Активне обслуговування"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info Tab */}
          {activeTab === "info" && (
            <div className="space-y-6">
              {/* Company info card */}
              <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center border border-indigo-500/20">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">{assignment.company_name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{assignment.offer_title}</p>
                      {assignment.offer_description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{assignment.offer_description}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-bold">{assignment.price.toLocaleString("uk-UA")}</span> грн/міс
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        З: <span className="font-bold">{formatDate(assignment.assigned_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Duration selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Тривалість угоди
                </label>
                <div className="flex gap-2">
                  {[1, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => setDuration(m)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        duration === m
                          ? "bg-indigo-600 text-white shadow-md"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {m} міс
                    </button>
                  ))}
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl p-3 mt-2">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                    Загальна вартість: {(assignment.price * duration).toLocaleString("uk-UA")} грн за {duration} міс.
                  </p>
                </div>
              </div>

              {/* Accountant info */}
              {assignment.accountant && (
                <div className="bg-violet-50 dark:bg-violet-950/20 rounded-2xl p-5 border border-violet-200 dark:border-violet-900/30">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center border border-violet-500/20">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">{assignment.accountant.name}</h3>
                      <p className="text-xs text-slate-500">Ваш персональний бухгалтер</p>
                      <div className="flex flex-wrap gap-3 pt-2">
                        {assignment.accountant.email && (
                          <a href={`mailto:${assignment.accountant.email}`} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600">
                            <Mail className="w-3.5 h-3.5" /> {assignment.accountant.email}
                          </a>
                        )}
                        {assignment.accountant.phone && (
                          <a href={`tel:${assignment.accountant.phone}`} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600">
                            <Phone className="w-3.5 h-3.5" /> {assignment.accountant.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact info */}
              <div className="flex flex-wrap gap-3">
                {assignment.company_phone && (
                  <a href={`tel:${assignment.company_phone}`} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <Phone className="w-4 h-4" /> {assignment.company_phone}
                  </a>
                )}
                {assignment.company_email && (
                  <a href={`mailto:${assignment.company_email}`} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <Mail className="w-4 h-4" /> {assignment.company_email}
                  </a>
                )}
              </div>

              {/* Terminate button */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                {!showTerminateConfirm ? (
                  <button
                    onClick={() => setShowTerminateConfirm(true)}
                    className="px-4 py-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-xl text-xs font-bold hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Прекратити відносини з компанією
                  </button>
                ) : (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400">
                      Ви впевнені? Припинення відносин призведе до призупинення обслуговування.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowTerminateConfirm(false)}
                        className="flex-1 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700"
                      >
                        Скасувати
                      </button>
                      <button
                        onClick={handleTerminate}
                        disabled={terminating}
                        className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                      >
                        {terminating ? "Виконується..." : "Підтвердити"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Tabs */}
          {(activeTab === "chat_company" || activeTab === "chat_accountant") && (
            <div className="flex flex-col h-[450px]">
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <MessageSquare className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-400">Повідомлень поки немає</p>
                    <p className="text-xs text-slate-500 mt-1">Напишіть перше повідомлення</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isAgent = m.is_from_admin;
                    return (
                      <div key={m.id} className={`flex flex-col max-w-[80%] ${isAgent ? "self-start" : "self-end ml-auto"}`}>
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isAgent
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none"
                            : "bg-indigo-600 text-white rounded-tr-none"
                        }`}>
                          {m.text}
                        </div>
                        <span className={`text-[10px] text-slate-400 mt-1 ${isAgent ? "text-left" : "text-right"}`}>
                          {new Date(m.created_at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 mt-3">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Напишіть повідомлення..."
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-700 dark:text-white"
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !inputText.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Надіслати
                </button>
              </form>
            </div>
          )}

          {/* Agreement Tabs */}
          {(activeTab === "agreement_company" || activeTab === "agreement_accountant") && (
            <div className="space-y-4">
              {agreementLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                </div>
              ) : agreement ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        agreement.status === "signed"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      }`}>
                        {agreement.status === "signed" ? "Підписано" : "Чернетка"}
                      </span>
                      {agreement.signed_at && (
                        <span className="text-xs text-slate-500">
                          {new Date(agreement.signed_at).toLocaleDateString("uk-UA")}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadAgreement}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Завантажити
                      </button>
                      {agreement.status !== "signed" && activeTab === "agreement_accountant" && (
                        <button
                          onClick={() => setEditingAgreement(!editingAgreement)}
                          className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-200 flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> {editingAgreement ? "Скасувати" : "Редагувати"}
                        </button>
                      )}
                    </div>
                  </div>

                  {editingAgreement ? (
                    <div className="space-y-3">
                      <textarea
                        value={agreementText}
                        onChange={(e) => setAgreementText(e.target.value)}
                        rows={16}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500 resize-y"
                      />
                      <button
                        onClick={handleSaveAgreement}
                        disabled={agreementLoading}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Зберегти
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                      <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {agreement.contract_text}
                      </pre>
                    </div>
                  )}

                  {agreement.status !== "signed" && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Договір ще не підписано. Після погодження тексту, договір можна підписати електронним підписом (КЕП).
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-400">Договір не знайдено</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
