"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { invoicesApi, certificatesApi } from "@/lib/api";
import Link from "next/link";
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Send, 
  Trash2, 
  Mail, 
  RefreshCw, 
  Shield, 
  CheckCircle, 
  X, 
  UploadCloud, 
  FilePlus, 
  FileSignature, 
  Clock, 
  Loader2,
  Sparkles,
  AlertCircle,
  Briefcase
} from "lucide-react";

const defaultTemplates: Record<string, string> = {
  "Договір про надання послуг": `ДОГОВІР ПРО НАДАННЯ ПОСЛУГ № {{Номер}}

м. Київ                                 {{Дата}}

Цей Договір про надання послуг (надалі — "Договір") укладений між:
Виконавець: діючий суб'єкт господарювання, зареєстрований відповідно до законодавства України,
та
Замовник: {{Клієнт}}

1. ПРЕДМЕТ ДОГОВОРУ
1.1. Виконавець зобов'язується надати послуги, а Замовник зобов'язується прийняти та оплатити їх у порядку та на умовах, визначених цим Договором.
1.2. Виконавець надає послуги з розробки програмного забезпечення, маркетингу або консультування.
1.3. Вартість послуг за цим Договором становить {{Сума}} грн.

2. ПОРЯДОК НАДАННЯ ПОСЛУГ
2.1. Послуги надаються Виконавцем на основі узгодженого Сторонами завдання.
2.2. Після завершення надання послуг Виконавець надає Замовнику Акт приймання-передачі виконаних робіт.

3. ВІДПОВІДАЛЬНІСТЬ СТОРІН
3.1. За невиконання або неналежне виконання зобов'язань за цим Договором сторони несуть відповідальність згідно з чинним законодавством України.`,

  "Акт прийому-передачі виконаних робіт": `АКТ ПРИЙМАННЯ-ПЕРЕДАЧІ ВИКОНАНИХ РОБІТ
до Договору № {{Номер}} від {{Дата}}

м. Київ                                 {{Дата}}

Ми, що нижче підписалися, Виконавець з однієї сторони, та Замовник {{Клієнт}} з іншої сторони, склали цей Акт про те, що:
1. Виконавець здав, а Замовник прийняв роботи (послуги) згідно з Договором.
2. Загальна вартість виконаних робіт (наданих послуг) становить {{Сума}} грн.
3. Роботи (послуги) виконані в повному обсязі, якісно та в строк. Сторони не мають одна до одної жодних претензій.`,

  "Додаткова угода": `ДОДАТКОВА УГОДА № 1
до Договору про надання послуг № {{Номер}} від {{Дата}}

м. Київ                                 {{Дата}}

Ця Додаткова угода укладена між Виконавцем та Замовником {{Клієнт}}:
1. Сторони дійшли згоди змінити платіжні реквізити Виконавця та викласти їх у такій редакції:
   Отримувач: Виконавець
   Банк: АТ "Банк"
   IBAN: UA000000000000000000000000000
2. Ця Додаткова угода є невід'ємною частиною Договору.
3. Усі інші умови Договору залишаються без змін.`,

  "Трудовий договір": `ТРУДОВИЙ ДОГОВІР № {{Номер}}

м. Київ                                 {{Дата}}

Роботодавець: діючий суб'єкт господарювання, зареєстрований відповідно до законодавства України, в особі директора, з однієї сторони,
та
Працівник: {{Клієнт}}, з другої сторони,
уклали цей Трудовий договір про наступне:

1. ПРЕДМЕТ ДОГОВОРУ
1.1. Працівник приймається на роботу на посаду фахівця.
1.2. Працівник зобов'язується виконувати роботу, визначену цією угодою та посадовою інструкцією, а Роботодавець зобов'язується забезпечити належні умови праці та виплачувати заробітну плату.

2. УМОВИ ОПЛАТИ ПРАЦІ
2.1. За виконання обов'язків Працівнику встановлюється посадовий оклад (заробітна плата) у розмірі {{Сума}} грн на місяць.
2.2. Виплата заробітної плати здійснюється регулярно в строки, встановлені чинним законодавством України.

3. СТРОК ДІЇ ДОГОВОРУ ТА РЕЖИМ РОБОТИ
3.1. Цей договір є безстроковим і набирає чинності з дня його підписання Сторонами.
3.2. Робочий час та час відпочинку встановлюються згідно з Правилами внутрішнього трудового розпорядку.`,

  "Договір про повну матеріальну відповідальність": `ДОГОВІР ПРО ПОВНУ ІНДИВІДУАЛЬНУ МАТЕРІАЛЬНУ ВІДПОВІДАЛЬНІСТЬ № {{Номер}}

м. Київ                                 {{Дата}}

Роботодавець: діючий суб'єкт господарювання в особі керівника, з однієї сторони,
та
Працівник (Матеріально відповідальна особа): {{Клієнт}}, з другої сторони,
уклали цей Договір про наступне:

1. ПРЕДМЕТ ДОГОВОРУ
1.1. З метою забезпечення збереження матеріальних цінностей, що належать Роботодавцю, Працівник приймає на себе повну індивідуальну матеріальну відповідальність за незабезпечення збереження майна та інших цінностей, переданих йому для зберігання або для інших цілей.
1.2. Обмеження матеріальної відповідальності регулюється чинним законодавством України про працю.
1.3. Оціночна вартість майна, що передається під відповідальність, становить {{Сума}} грн.

2. ЗОБОВ'ЯЗАННЯ СТОРІН
2.1. Працівник зобов'язується дбайливо ставитися до переданих йому на зберігання цінностей і вживати всіх заходів для запобігання шкоді.
2.2. Роботодавець зобов'язується створювати Працівникові умови, необхідні для забезпечення збереження майна.`,

  "Цивільно-правовий договір (ЦПХ)": `ЦИВІЛЬНО-ПРАВОВИЙ ДОГОВІР ПРО НАДАННЯ ПОСЛУГ № {{Номер}}

м. Київ                                 {{Дата}}

Замовник: діючий суб'єкт господарювання, з однієї сторони,
та
Виконавець: {{Клієнт}}, з другої сторони,
уклали цей Договір про наступне:

1. ПРЕДМЕТ ДОГОВОРУ
1.1. Виконавець зобов'язується за завданням Замовника надати послуги, а саме: консультаційні, технічні або інші послуги, а Замовник зобов'язується прийняти та оплатити їх.
1.2. Цей договір є цивільно-правовим і регулюється нормами Цивільного кодексу України, не є трудовим договором.

2. ВАРТІСТЬ РОБІТ ТА ПОРЯДОК РОЗРАХУНКІВ
2.1. Загальна вартість послуг за цим Договором становить {{Сума}} грн.
2.2. Розрахунок здійснюється протягом 5 банківських днів після підписання Акта приймання-передачі виконаних робіт.`,

  "Договір поставки": `ДОГОВІР ПОСТАВКИ ТОВАРУ № {{Номер}}

м. Київ                                 {{Дата}}

Постачальник: діючий суб'єкт господарювання, з однієї сторони,
та
Покупець: {{Клієнт}}, з другої сторони,
уклали цей Договір про наступне:

1. ПРЕДМЕТ ДОГОВОРУ
1.1. Постачальник зобов'язується поставити та передати у власність Покупцю товар, а Покупець зобов'язується прийняти вказаний товар та оплатити його на умовах цього Договору.
1.2. Найменування, кількість та ціна товару визначаються у специфікаціях чи накладних, які є невід'ємною частиною цього Договору.
1.3. Загальна вартість поставки за цим Договором становить {{Сума}} грн.

2. УМОВИ ПОСТАВКИ ТА ОПЛАТИ
2.1. Поставка товару здійснюється протягом 10 днів з моменту отримання попередньої оплати або згідно з погодженим графіком.
2.2. Оплата здійснюється у національній валюті України шляхом безготівкового перерахунку на рахунок Постачальника.`,

  "Договір купівлі-продажу": `ДОГОВІР КУПІВЛІ-ПРОДАЖУ № {{Номер}}

м. Київ                                 {{Дата}}

Продавець: діючий суб'єкт господарювання, з однієї сторони,
та
Покупець: {{Клієнт}}, з другої сторони,
уклали цей Договір про наступне:

1. ПРЕДМЕТ ДОГОВОРУ
1.1. Продавець зобов'язується передати майно (товар) у власність Покупцеві, а Покупець зобов'язується прийняти майно (товар) і сплатити за нього певну грошову суму.
1.2. Загальна вартість майна за цим Договором становить {{Сума}} грн.

2. ПЕРЕДАЧА ТОВАРУ ТА ПЕРЕХІД ПРАВА ВЛАСНОСТІ
2.1. Передача товару оформлюється шляхом підписання Сторонами видаткової накладної або акту приймання-передачі.
2.2. Ризик випадкової загибелі або пошкодження товару переходить до Покупця з моменту передачі йому товару.`,

  "Договір оренди": `ДОГОВІР ОРЕНДИ НЕЖИТЛОВОГО ПРИМІЩЕННЯ № {{Номер}}

м. Київ                                 {{Дата}}

Орендодавець: діючий суб'єкт господарювання, з однієї сторони,
та
Орендар: {{Клієнт}}, з другої сторони,
уклали цей Договір про наступне:

1. ПРЕДМЕТ ДОГОВОРУ
1.1. Орендодавець передає, а Орендар приймає у строкове платне користування (оренду) нежитлове приміщення (офіс/склад), площею згідно технічного паспорта.
1.2. Приміщення передається для використання під комерційні цілі Орендаря.

2. ОРЕНДНА ПЛАТА ТА РОЗРАХУНКИ
2.1. Орендна плата за користування приміщенням становить {{Сума}} грн за один місяць.
2.2. Орендна плата сплачується Орендарем щомісячно не пізніше 5 числа поточного місяця оренди.`,

  "Угода про нерозголошення (NDA)": `ДОГОВІР ПРО НЕРОЗГОЛОШЕННЯ КОНФІДЕНЦІЙНОЇ ІНФОРМАЦІЇ (NDA) № {{Номер}}

м. Київ                                 {{Дата}}

Розкриваюча Сторона: діючий суб'єкт господарювання, з однієї сторони,
та
Отримуюча Сторона: {{Клієнт}}, з другої сторони,
уклали цей Договір про наступне:

1. ПРЕДМЕТ ДОГОВОРУ
1.1. Метою цього Договору є захист Конфіденційної інформації, що розкриється Сторонами в ході співпраці.
1.2. Конфіденційною вважається будь-яка комерційна, технічна, фінансова інформація, ноу-хау або персональні дані.
1.3. У разі порушення зобов'язань щодо конфіденційності, винна сторона сплачує штраф у розмірі {{Сума}} грн.

2. ЗОБОВ'ЯЗАННЯ СТОРІН
2.1. Отримуюча Сторона зобов'язується зберігати інформацію в таємниці та не розголошувати її третім особам без письмової згоди Розкриваючої Сторони.`
};

export default function InvoicesList() {
  const { selectedProfile } = useApp();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<"list" | "upload" | "template" | "company_docs">("list");
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Custom Document Upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNumber, setUploadNumber] = useState("");
  const [uploadEmail, setUploadEmail] = useState("");
  const [uploadAmount, setUploadAmount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadType, setUploadType] = useState<string>("contract");

  // Templated Document states
  const [templateName, setTemplateName] = useState("Договір про надання послуг");
  const [templateClientName, setTemplateClientName] = useState("");
  const [templateContractNumber, setTemplateContractNumber] = useState("");
  const [templateEmail, setTemplateEmail] = useState("");
  const [templateAmount, setTemplateAmount] = useState(0);
  const [templateBody, setTemplateBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [templateError, setTemplateError] = useState("");

  // Enterprise Documents states
  const [profileDocs, setProfileDocs] = useState<any[]>([]);
  const [profileDocsLoading, setProfileDocsLoading] = useState(false);
  const [docUploadFile, setDocUploadFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState("");
  
  // Enterprise Document Send states
  const [sendDocModalOpen, setSendDocModalOpen] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<any>(null);
  const [docEmail, setDocEmail] = useState("");
  const [docSubject, setDocSubject] = useState("");
  const [docMessage, setDocMessage] = useState("");
  const [isSendingDoc, setIsSendingDoc] = useState(false);
  const [sendDocError, setSendDocError] = useState("");

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

  const fetchProfileDocs = useCallback(async () => {
    if (!selectedProfile) return;
    setProfileDocsLoading(true);
    try {
      const data = await invoicesApi.getProfileDocuments(selectedProfile.id);
      setProfileDocs(data);
    } catch (err) {
      console.error("Failed to fetch profile documents:", err);
      setProfileDocs([]);
    } finally {
      setProfileDocsLoading(false);
    }
  }, [selectedProfile]);

  useEffect(() => {
    fetchInvoices();
    if (selectedProfile) {
      fetchProfileDocs();
    }
  }, [selectedProfile, fetchInvoices, fetchProfileDocs]);

  useEffect(() => {
    if (activeTab === "company_docs") {
      fetchProfileDocs();
    }
  }, [activeTab, fetchProfileDocs]);

  useEffect(() => {
    if (defaultTemplates[templateName]) {
      setTemplateBody(defaultTemplates[templateName]);
    }
  }, [templateName]);

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

  const handleDelete = async (id: number, num: string) => {
    if (!confirm(`Ви впевнені, що хочете видалити цей документ ${num}?`)) return;
    try {
      await invoicesApi.delete(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err) {
      console.error("Failed to delete document:", err);
      alert("Не вдалося видалити документ.");
    }
  };

  const handleDownloadPdf = async (id: number, number: string, docType: string = "invoice", status?: string, isSigned?: boolean) => {
    try {
      let blob;
      if (isSigned || status === "signed") {
        blob = await certificatesApi.getSignedPdfBlob(id, docType);
      } else {
        blob = await invoicesApi.getPdf(id);
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `document_${number}${isSigned || status === "signed" ? "_signed" : ""}.pdf`);
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
      fetchInvoices();
    } catch (err) {
      console.error("Failed to create document:", err);
      alert("Не вдалося створити документ.");
    }
  };

  const handleDownloadDocumentPdf = async (invoiceId: number, actId: number, number: string, docType: string, status?: string, isSigned?: boolean) => {
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
      const label = docType === "waybill" ? "waybill" : "act";
      link.setAttribute("download", `${label}_${number}${isSigned || status === "signed" ? "_signed" : ""}.pdf`);
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
    
    const titleSubject = invoice.document_type === "contract" 
      ? `Документ №${invoice.invoice_number}`
      : `Рахунок №${invoice.invoice_number}${docLabel}`;
      
    setEmailSubject(titleSubject);
    
    const docDesc = invoice.act 
      ? (invoice.document_type === "waybill" ? "\nТакож додається видаткова накладна №" + invoice.act.act_number + "." : "\nТакож додається акт виконаних робіт №" + invoice.act.act_number + ".")
      : "";
      
    const initialMsg = invoice.document_type === "contract"
      ? `Доброго дня!\n\nВам надіслано документ: ${invoice.service_name} №${invoice.invoice_number}.\n\nФайл прикріплено до листа.\n\nДякуємо за співпрацю!`
      : `Доброго дня!\n\nВам виставлено рахунок №${invoice.invoice_number} на суму ${invoice.amount.toLocaleString("uk-UA")} грн.${docDesc}\n\nДокументи у форматі PDF прикріплено до листа.\n\nДякуємо за співпрацю!`;
      
    setEmailMessage(initialMsg);
    setModalMessage(null);
    setSendModalOpen(true);
  };

  const handleSendInvoice = async () => {
    if (!currentInvoice) return;
    setIsSending(true);
    setModalMessage(null);
    try {
      await invoicesApi.send(currentInvoice.id, toEmail, emailSubject, emailMessage);
      setModalMessage({ text: "Документ успішно надіслано контрагенту!", type: "success" });
      setTimeout(() => {
        setSendModalOpen(false);
        fetchInvoices();
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

  // Upload Custom Document
  const handleUploadCustomDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    setUploadError("");
    
    if (!uploadFile) {
      setUploadError("Будь ласка, оберіть файл для завантаження.");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError("Будь ласка, вкажіть назву документа.");
      return;
    }
    if (!uploadNumber.trim()) {
      setUploadError("Будь ласка, вкажіть номер документа.");
      return;
    }
    if (!uploadEmail.trim()) {
      setUploadError("Будь ласка, вкажіть email отримувача.");
      return;
    }

    setIsUploading(true);
    try {
      const res = await invoicesApi.uploadCustomDocument(
        uploadFile,
        selectedProfile.id,
        uploadTitle.trim(),
        uploadNumber.trim(),
        uploadEmail.trim(),
        uploadAmount,
        uploadType
      );
      
      alert("Документ успішно завантажено!");
      // Reset form
      setUploadFile(null);
      setUploadTitle("");
      setUploadNumber("");
      setUploadEmail("");
      setUploadAmount(0);
      
      // Refresh list
      await fetchInvoices();
      setActiveTab("list");
      
      // Auto open KEP signing modal for this document
      if (res.id) {
        openSignModal(res.id, uploadType);
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadError(err.response?.data?.detail || "Помилка при завантаженні документа.");
    } finally {
      setIsUploading(false);
    }
  };

  // Generate Templated Document
  const handleGenerateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    setTemplateError("");

    if (!templateClientName.trim()) {
      setTemplateError("Будь ласка, вкажіть назву контрагента.");
      return;
    }
    if (!templateContractNumber.trim()) {
      setTemplateError("Будь ласка, вкажіть номер договору.");
      return;
    }
    if (!templateEmail.trim()) {
      setTemplateError("Будь ласка, вкажіть email отримувача.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await invoicesApi.createTemplatedDocument({
        profile_id: selectedProfile.id,
        template_name: templateName,
        client_name: templateClientName.trim(),
        contract_number: templateContractNumber.trim(),
        client_email: templateEmail.trim(),
        amount: templateAmount,
        content: templateBody
      });

      alert("Договір успішно згенеровано з шаблону!");
      // Reset form
      setTemplateClientName("");
      setTemplateContractNumber("");
      setTemplateEmail("");
      setTemplateAmount(0);
      if (defaultTemplates[templateName]) {
        setTemplateBody(defaultTemplates[templateName]);
      }
      
      await fetchInvoices();
      setActiveTab("list");

      // Auto open KEP signing modal for this document
      if (res.id) {
        openSignModal(res.id, "contract");
      }
    } catch (err: any) {
      console.error("Template generation failed:", err);
      setTemplateError(err.response?.data?.detail || "Помилка при генерації шаблону.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile || !docUploadFile) return;
    setIsUploadingDoc(true);
    setDocUploadError("");
    try {
      await invoicesApi.uploadProfileDocument(selectedProfile.id, docUploadFile);
      setDocUploadFile(null);
      const fileInput = document.getElementById("doc-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      fetchProfileDocs();
      alert("Документ підприємства успішно завантажено!");
    } catch (err: any) {
      console.error("Upload document failed:", err);
      setDocUploadError(err.response?.data?.detail || "Не вдалося завантажити файл.");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: number, name: string) => {
    if (!selectedProfile) return;
    if (!confirm(`Ви впевнені, що хочете видалити документ "${name}"?`)) return;
    try {
      await invoicesApi.deleteProfileDocument(selectedProfile.id, docId);
      setProfileDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Failed to delete profile document:", err);
      alert("Не вдалося видалити документ.");
    }
  };

  const handleDownloadDoc = async (docId: number, filename: string) => {
    try {
      const blob = await invoicesApi.getProfileDocumentPdf(docId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download document:", err);
      alert("Не вдалося завантажити документ.");
    }
  };

  const openSendDocModal = (doc: any) => {
    setCurrentDoc(doc);
    setDocEmail("");
    setDocSubject(`Документ підприємства: ${doc.filename}`);
    setDocMessage(`Доброго дня!\n\nНадсилаю вам документ нашого підприємства: ${doc.filename}.\n\nЗ повагою,\n${selectedProfile?.name || "Команда UniTax"}`);
    setSendDocError("");
    setSendDocModalOpen(true);
  };

  const handleSendDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDoc || !docEmail.trim()) return;
    setIsSendingDoc(true);
    setSendDocError("");
    try {
      await invoicesApi.sendProfileDocument(currentDoc.id, {
        toEmail: docEmail.trim(),
        subject: docSubject.trim() || undefined,
        message: docMessage.trim() || undefined
      });
      setSendDocModalOpen(false);
      alert("Документ успішно надіслано контрагенту!");
    } catch (err: any) {
      console.error("Failed to send document:", err);
      setSendDocError(err.response?.data?.detail || "Не вдалося надіслати документ.");
    } finally {
      setIsSendingDoc(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "signed":
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
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
      case "signed":
        return "Підписано";
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

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.service_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (!selectedProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <Shield className="w-16 h-16 text-slate-600 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-slate-300">Профіль не обрано</h2>
        <p className="text-sm text-slate-500 max-w-sm mt-2">
          Будь ласка, оберіть активний профіль ТОВ або ФОП у лівій панелі навігації, щоб розпочати роботу з документами.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Відправити контрагенту
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Створюйте та надсилайте рахунки, акти або договори, підписуючи їх вашим КЕП
          </p>
        </div>
        
        {activeTab === "list" && (
          <Link
            href="/invoices/new"
            className="inline-flex items-center justify-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/15 transition-all gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Створити рахунок
          </Link>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("list")}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "list"
              ? "border-indigo-550 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          Всі збережені та відправлені
        </button>
        <button
          onClick={() => setActiveTab("upload")}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "upload"
              ? "border-indigo-550 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          Завантажити та підписати КЕП
        </button>
        <button
          onClick={() => setActiveTab("template")}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "template"
              ? "border-indigo-550 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FilePlus className="w-4 h-4" />
          Договір з шаблону
        </button>
        <button
          onClick={() => setActiveTab("company_docs")}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "company_docs"
              ? "border-indigo-550 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Документи підприємства
        </button>
      </div>

      {/* Tab 1: Invoices and Acts List */}
      {activeTab === "list" && (
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-500" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук за контрагентом чи номером..."
                className="block w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-550 text-slate-200 text-xs placeholder-slate-650 transition-all"
              />
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-40 p-2.5 rounded-xl border border-slate-850 bg-slate-950/60 text-xs font-semibold focus:outline-none text-slate-300"
              >
                <option value="all">Усі статуси</option>
                <option value="draft">Чернетка</option>
                <option value="sent">Надіслано</option>
                <option value="signed">Підписано</option>
                <option value="paid">Сплачено</option>
                <option value="cancelled">Скасовано</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              <p className="text-slate-400 text-sm">Завантаження документів...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-16 text-center shadow-xl">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-300 mb-1">Документів не знайдено</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                Створіть новий рахунок, завантажте PDF або згенеруйте договір з шаблону.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/20 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-4 px-6">Номер / Дата</th>
                      <th className="py-4 px-6">Опис / Контрагент</th>
                      <th className="py-4 px-6">Сума</th>
                      <th className="py-4 px-6">Документи для підпису</th>
                      <th className="py-4 px-6 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60 text-xs font-medium text-slate-200">
                    {filteredInvoices.map((inv) => {
                      const isContract = inv.document_type === "contract";
                      
                      const getMainDocLabel = (type: string) => {
                        switch (type) {
                          case "contract": return "Договір";
                          case "invoice": return "Рахунок-фактура";
                          case "act": return "Акт виконаних робіт";
                          case "waybill": return "Видаткова накладна";
                          default: return "Документ";
                        }
                      };
                      
                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/20 transition-all">
                          <td className="py-4 px-6 font-bold text-slate-100">
                            <div>
                              <div>{inv.invoice_number}</div>
                              <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                {inv.send_date ? new Date(inv.send_date).toLocaleDateString("uk-UA") : ""}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div>
                              <div className="font-bold text-slate-305 text-sm">{inv.service_name || "Без назви"}</div>
                              <div className="text-[10px] text-slate-400 mt-1">
                                Клієнт: {inv.client_name || "Фізична особа"} ({inv.client_email})
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-bold text-indigo-400">
                            {inv.amount.toLocaleString("uk-UA", { minimumFractionDigits: 2 })} ₴
                          </td>
                          <td className="py-4 px-6 w-96">
                            <div className="space-y-2">
                              {/* Main Document Block */}
                              <div className="bg-slate-950/40 border border-slate-850/80 rounded-xl p-2.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                                  <div className="truncate max-w-[150px]">
                                    <span className="font-semibold text-slate-200 block text-xs truncate">
                                      {getMainDocLabel(inv.document_type || "invoice")}
                                    </span>
                                    <span className="text-[9px] text-slate-500 block truncate">{inv.invoice_number}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Download Button */}
                                  <button
                                    onClick={() => handleDownloadPdf(inv.id, inv.invoice_number, inv.document_type || "invoice", inv.status, inv.is_signed)}
                                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-md transition-colors"
                                    title="Завантажити оригінал"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                  
                                  {/* Sign Button */}
                                  {!(inv.is_signed || inv.status === "signed") ? (
                                    <button
                                      onClick={() => openSignModal(inv.id, inv.document_type || "invoice")}
                                      className="px-2 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold transition-all flex items-center gap-1"
                                    >
                                      <Shield className="w-3 h-3" />
                                      <span>Підписати КЕП</span>
                                    </button>
                                  ) : (
                                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-md flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      <span>Підписано</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Linked Act/Waybill Block */}
                              {inv.act ? (
                                <div className="bg-slate-950/40 border border-slate-850/80 rounded-xl p-2.5 flex items-center justify-between gap-3 animate-in fade-in duration-200">
                                  <div className="flex items-center gap-2">
                                    <FilePlus className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <div className="truncate max-w-[150px]">
                                      <span className="font-semibold text-slate-200 block text-xs truncate">
                                        {inv.document_type === "waybill" ? "Видаткова накладна" : "Акт робіт"}
                                      </span>
                                      <span className="text-[9px] text-slate-500 block truncate">№ {inv.act.act_number}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Download Act PDF */}
                                    <button
                                      onClick={() => handleDownloadDocumentPdf(inv.id, inv.act.id, inv.invoice_number, inv.document_type || "act", inv.act.status, inv.act.is_signed)}
                                      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-md transition-colors"
                                      title="Завантажити PDF"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    {/* Sign Act Button */}
                                    {!(inv.act.is_signed || inv.act.status === "signed") ? (
                                      <button
                                        onClick={() => openSignModal(inv.act.id, "act")}
                                        className="px-2 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold transition-all flex items-center gap-1"
                                      >
                                        <Shield className="w-3 h-3" />
                                        <span>Підписати КЕП</span>
                                      </button>
                                    ) : (
                                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-md flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        <span>Підписано</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                !isContract && inv.document_type !== "act" && inv.document_type !== "waybill" && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleCreateDocument(inv.id, "act")}
                                      className="flex-1 py-1 px-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-lg text-[9px] font-bold transition-all"
                                    >
                                      + Акт
                                    </button>
                                    <button
                                      onClick={() => handleCreateDocument(inv.id, "waybill")}
                                      className="flex-1 py-1 px-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-lg text-[9px] font-bold transition-all"
                                    >
                                      + Видаткова накладна
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right space-x-1 shrink-0">
                            <button
                              onClick={() => openSendModal(inv)}
                              className="p-2.5 hover:bg-indigo-600/10 text-slate-400 hover:text-indigo-400 rounded-xl transition-all"
                              title="Надіслати контрагенту"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(inv.id, inv.invoice_number)}
                              className="p-2.5 hover:bg-rose-500/10 hover:text-rose-450 text-slate-500 rounded-xl transition-all"
                              title="Видалити"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Upload Custom PDF Document & Sign */}
      {activeTab === "upload" && (
        <div className="max-w-xl mx-auto">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-600/5 blur-[100px] pointer-events-none" />
            
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              Завантажити документ КЕП
            </h3>
            <p className="text-slate-400 text-xs mb-6">
              Завантажте будь-яку угоду, договір чи акт у форматі PDF, накладіть КЕП підпис та надішліть його вашому клієнту.
            </p>

            {uploadError && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs flex items-start gap-2.5 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadCustomDoc} className="space-y-4">
              {/* Dropzone */}
              <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/30 rounded-2xl p-6 text-center cursor-pointer transition-all relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <UploadCloud className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                {uploadFile ? (
                  <div>
                    <span className="block text-sm font-bold text-indigo-400 truncate max-w-xs mx-auto">
                      {uploadFile.name}
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1">
                      {(uploadFile.size / 1024 / 1024).toFixed(2)} MB • Натисніть, щоб обрати інший
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="block text-xs font-bold text-slate-350">
                      Перетягніть PDF файл сюди або натисніть для огляду
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1">
                      Максимальний розмір файлу: 10 MB
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Тип документа *
                </label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs font-semibold mb-4"
                  disabled={isUploading}
                >
                  <option value="contract">Договір</option>
                  <option value="invoice">Рахунок-фактура</option>
                  <option value="act">Акт виконаних робіт</option>
                  <option value="waybill">Видаткова накладна</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Назва документа *
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Договір оренди приміщення, Угода про конфіденційність тощо"
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs placeholder-slate-650"
                  disabled={isUploading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Номер документа *
                  </label>
                  <input
                    type="text"
                    value={uploadNumber}
                    onChange={(e) => setUploadNumber(e.target.value)}
                    placeholder="№ 12-А"
                    className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs placeholder-slate-650"
                    disabled={isUploading}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Сума документа (грн, якщо є)
                  </label>
                  <input
                    type="number"
                    value={uploadAmount || ""}
                    onChange={(e) => setUploadAmount(Number(e.target.value))}
                    placeholder="0.00"
                    className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs placeholder-slate-650 text-right"
                    disabled={isUploading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Email контрагента *
                </label>
                <input
                  type="email"
                  value={uploadEmail}
                  onChange={(e) => setUploadEmail(e.target.value)}
                  placeholder="partner@company.com"
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs placeholder-slate-650"
                  disabled={isUploading}
                />
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full flex items-center justify-center py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg transition-all gap-1.5 disabled:opacity-50 mt-4"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Завантаження документа...</span>
                  </>
                ) : (
                  <>
                    <FileSignature className="w-4 h-4" />
                    <span>Завантажити та підписати КЕП</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Create Document from Template & Sign */}
      {activeTab === "template" && (
        <div className="max-w-xl mx-auto">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-emerald-600/5 blur-[100px] pointer-events-none" />
            
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <FilePlus className="w-5 h-5 text-indigo-400" />
              Згенерувати договір з шаблону
            </h3>
            <p className="text-slate-400 text-xs mb-6">
              Виберіть один із юридично вивірених шаблонів договорів, введіть дані клієнта та миттєво підпишіть його КЕП.
            </p>

            {templateError && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs flex items-start gap-2.5 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{templateError}</span>
              </div>
            )}

            <form onSubmit={handleGenerateTemplate} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Виберіть шаблон договору *
                </label>
                <select
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs font-semibold"
                  disabled={isGenerating}
                >
                  <option value="Договір про надання послуг">Договір про надання послуг (стандартний)</option>
                  <option value="Акт прийому-передачі виконаних робіт">Акт прийому-передачі виконаних робіт</option>
                  <option value="Додаткова угода">Додаткова угода про зміну реквізитів</option>
                  <option value="Трудовий договір">Трудовий договір</option>
                  <option value="Договір про повну матеріальну відповідальність">Договір про повну матеріальну відповідальність</option>
                  <option value="Цивільно-правовий договір (ЦПХ)">Цивільно-правовий договір (ЦПХ)</option>
                  <option value="Договір поставки">Договір поставки</option>
                  <option value="Договір купівлі-продажу">Договір купівлі-продажу</option>
                  <option value="Договір оренди">Договір оренди (приміщення, офісу, складу)</option>
                  <option value="Угода про нерозголошення (NDA)">Угода про нерозголошення (NDA)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Текст шаблону (можна редагувати) *
                </label>
                <textarea
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  rows={8}
                  className="block w-full px-4 py-3 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs font-mono leading-relaxed resize-y"
                  disabled={isGenerating}
                  required
                  placeholder="Введіть текст договору..."
                />
                <span className="text-[9px] text-slate-500 block mt-1">
                  Доступні змінні: {"{{Клієнт}}"}, {"{{Сума}}"}, {"{{Номер}}"}, {"{{Дата}}"} (вони заміняться автоматично)
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Назва контрагента (Замовника) *
                </label>
                <input
                  type="text"
                  value={templateClientName}
                  onChange={(e) => setTemplateClientName(e.target.value)}
                  placeholder="ТОВ 'Авангард' або ФОП Коваленко"
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs placeholder-slate-650"
                  disabled={isGenerating}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Номер договору *
                  </label>
                  <input
                    type="text"
                    value={templateContractNumber}
                    onChange={(e) => setTemplateContractNumber(e.target.value)}
                    placeholder="№ Д-55"
                    className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs placeholder-slate-650"
                    disabled={isGenerating}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Сума договору (грн)
                  </label>
                  <input
                    type="number"
                    value={templateAmount || ""}
                    onChange={(e) => setTemplateAmount(Number(e.target.value))}
                    placeholder="0.00"
                    className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs placeholder-slate-650 text-right"
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Email контрагента *
                </label>
                <input
                  type="email"
                  value={templateEmail}
                  onChange={(e) => setTemplateEmail(e.target.value)}
                  placeholder="partner@company.com"
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs placeholder-slate-650"
                  disabled={isGenerating}
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full flex items-center justify-center py-3 bg-gradient-to-r from-emerald-600 to-indigo-650 hover:from-emerald-500 hover:to-indigo-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg transition-all gap-1.5 disabled:opacity-50 mt-4"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Створення документа...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Згенерувати та підписати КЕП</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: Enterprise Documents (Документи підприємства) */}
      {activeTab === "company_docs" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Form */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-600/5 blur-[100px] pointer-events-none" />
              
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-400" />
                Завантажити документ
              </h3>
              <p className="text-slate-400 text-[11px] mb-6">
                Завантажуйте документи вашого підприємства (статут, виписки, реквізити IBAN), щоб вони завжди були під рукою.
              </p>

              {docUploadError && (
                <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs flex items-start gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{docUploadError}</span>
                </div>
              )}

              <form onSubmit={handleUploadDoc} className="space-y-4">
                <div className="border-2 border-dashed border-slate-800 hover:border-indigo-550/40 rounded-2xl p-6 text-center relative transition-all bg-slate-950/20 hover:bg-slate-950/40 cursor-pointer">
                  <input
                    type="file"
                    id="doc-file-input"
                    onChange={(e) => setDocUploadFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={isUploadingDoc}
                    required
                  />
                  <UploadCloud className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  {docUploadFile ? (
                    <div>
                      <span className="block text-xs font-bold text-indigo-400 truncate max-w-xs mx-auto">
                        {docUploadFile.name}
                      </span>
                      <span className="block text-[9px] text-slate-500 mt-1">
                        {(docUploadFile.size / 1024 / 1024).toFixed(2)} MB • Обрати інший
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="block text-xs font-bold text-slate-350">
                        Оберіть файл для завантаження
                      </span>
                      <span className="block text-[9px] text-slate-500 mt-1">
                        PDF, DOCX, PNG, JPG (макс. 10 MB)
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isUploadingDoc || !docUploadFile}
                  className="w-full flex items-center justify-center py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg transition-all gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Завантаження...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Додати до сховища</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Documents List */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl min-h-[400px]">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-400" />
                Сховище документів підприємства
              </h3>

              {profileDocsLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                  <p className="text-slate-400 text-xs">Завантаження сховища...</p>
                </div>
              ) : profileDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-800/60 rounded-2xl bg-slate-950/10">
                  <FileText className="w-10 h-10 text-slate-650 mb-3" />
                  <h4 className="text-sm font-semibold text-slate-400">Сховище порожнє</h4>
                  <p className="text-slate-500 text-xs max-w-xs mt-1">
                    Тут з'являться ваші завантажені документи, які ви зможете швидко надіслати контрагентам.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profileDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-slate-950/40 border border-slate-850/80 rounded-2xl p-4 flex flex-col justify-between gap-4 hover:border-slate-800 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-650/10 text-indigo-400 rounded-xl group-hover:bg-indigo-600/20 transition-all shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="truncate w-full">
                          <span className="block text-xs font-bold text-slate-200 truncate" title={doc.filename}>
                            {doc.filename}
                          </span>
                          <span className="block text-[9px] text-slate-500 mt-0.5">
                            Завантажено: {new Date(doc.upload_date).toLocaleDateString("uk-UA")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t border-slate-900/60 pt-3">
                        {/* Download */}
                        <button
                          onClick={() => handleDownloadDoc(doc.id, doc.filename)}
                          className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-850 active:scale-[0.98] border border-slate-850 text-slate-300 hover:text-slate-100 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Завантажити</span>
                        </button>
                        
                        {/* Send */}
                        <button
                          onClick={() => openSendDocModal(doc)}
                          className="flex-1 py-1.5 bg-indigo-650/10 hover:bg-indigo-600/20 active:scale-[0.98] text-indigo-400 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Надіслати</span>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteDoc(doc.id, doc.filename)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 active:scale-[0.95] text-rose-400 rounded-lg transition-all shrink-0"
                          title="Видалити"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Sending Modal */}
      {sendModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-slate-100 animate-in fade-in duration-200">
                  Надіслати {currentInvoice?.document_type === "contract" ? "договір" : "документ"} {currentInvoice?.invoice_number}
                  {currentInvoice?.act && ` та ${currentInvoice.document_type === "waybill" ? "накладну" : "акт"} №${currentInvoice.act.act_number}`}
                </h3>
              </div>
              <button
                onClick={() => setSendModalOpen(false)}
                className="text-slate-500 hover:text-slate-350"
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
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Надсилання...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Надіслати лист</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Profile Document Modal */}
      {sendDocModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-slate-100">
                  Надіслати документ підприємства
                </h3>
              </div>
              <button
                onClick={() => setSendDocModalOpen(false)}
                className="text-slate-500 hover:text-slate-350"
              >
                &times;
              </button>
            </div>

            {sendDocError && (
              <div className="p-4 text-xs font-semibold bg-rose-500/10 text-rose-400">
                {sendDocError}
              </div>
            )}

            <form onSubmit={handleSendDoc}>
              <div className="p-6 space-y-4">
                <div>
                  <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Файл для відправки</span>
                  <span className="text-xs text-slate-300 font-semibold">{currentDoc?.filename}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email отримувача *</label>
                  <input
                    type="email"
                    value={docEmail}
                    onChange={(e) => setDocEmail(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs"
                    placeholder="client@company.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Тема листа</label>
                  <input
                    type="text"
                    value={docSubject}
                    onChange={(e) => setDocSubject(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs"
                    placeholder="Тема листа"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Супровідний текст</label>
                  <textarea
                    rows={5}
                    value={docMessage}
                    onChange={(e) => setDocMessage(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-200 text-xs resize-none"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-800 bg-slate-950/20 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setSendDocModalOpen(false)}
                  className="px-4 py-2 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={isSendingDoc}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                >
                  {isSendingDoc ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Надсилання...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Надіслати лист</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <FileSignature className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Підписати документ КЕП</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Накладіть підпис на документ ({signingDocType === "contract" ? "договір" : (signingDocType === "act" ? "акт" : "рахунок")})
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
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-slate-350">Сертифікат не знайдено</div>
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
                            ? "border-indigo-550 bg-indigo-500/5"
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
                      <FileSignature className="w-4 h-4" />
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
                  className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-slate-350 border border-slate-800 text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <span className="w-4 h-4 rounded-full bg-teal-400/20 border border-teal-400 flex items-center justify-center text-[8px] text-teal-400 font-black">Д</span>
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
