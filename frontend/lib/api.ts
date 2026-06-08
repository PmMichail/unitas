import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev";

const client = axios.create({
  baseURL: API_BASE_URL,
});

// Helper to convert object to FormData for FastAPI Form(...) endpoints
const toFormData = (data: Record<string, any>): FormData => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === "boolean") {
        formData.append(key, value ? "true" : "false");
      } else {
        formData.append(key, String(value));
      }
    }
  });
  return formData;
};

export const api = {
  // Profiles
  getProfiles: async (telegramId: string) => {
    const response = await client.get(`/api/profiles`, {
      params: { telegram_id: telegramId },
    });
    return response.data;
  },

  createProfile: async (data: {
    telegram_id: string;
    type: "fop" | "company";
    name: string;
    tax_id: string;
    tax_system: string;
    is_director?: boolean;
    group?: number;
    rate?: number;
    has_employees?: boolean;
    is_vat_payer?: boolean;
    reg_date?: string;
    esv_paid_by_employer?: boolean;
    address?: string;
    default_bank?: string;
    director_name?: string;
    phone?: string;
  }) => {
    const formData = toFormData(data);
    const response = await client.post("/api/profiles", formData);
    return response.data;
  },

  updateProfile: async (
    profileId: number,
    data: {
      type?: "fop" | "company";
      name?: string;
      tax_id?: string;
      tax_system?: string;
      is_director?: boolean;
      group?: number;
      rate?: number;
      has_employees?: boolean;
      is_vat_payer?: boolean;
      reg_date?: string;
      esv_paid_by_employer?: boolean;
      address?: string;
      default_bank?: string;
      director_name?: string;
      phone?: string;
    }
  ) => {
    const formData = toFormData(data);
    const response = await client.put(`/api/profiles/${profileId}`, formData);
    return response.data;
  },

  deleteProfile: async (profileId: number) => {
    const response = await client.delete(`/api/profiles/${profileId}`);
    return response.data;
  },

  // Dashboard & Analytics
  getDashboard: async (
    profileId: number,
    periodType?: string,
    year?: number,
    periodValue?: number
  ) => {
    const params: any = {};
    if (periodType) params.period_type = periodType;
    if (year !== undefined && year !== null) params.year = year;
    if (periodValue !== undefined && periodValue !== null) params.period_value = periodValue;
    const response = await client.get(`/api/dashboard/${profileId}`, { params });
    return response.data;
  },

  getConsolidatedDashboard: async (telegramId: string) => {
    const response = await client.get(`/api/consolidated-dashboard/${telegramId}`);
    return response.data;
  },

  getTaxAnalysis: async (profileId: number) => {
    const response = await client.get(`/api/tax-analysis/${profileId}`);
    return response.data;
  },

  // Employees
  getEmployees: async (profileId: number) => {
    const response = await client.get(`/api/employees/${profileId}`);
    return response.data;
  },

  createEmployee: async (data: {
    profile_id: number;
    name: string;
    tax_id: string;
    salary: number;
    is_main_job?: boolean;
  }) => {
    const formData = toFormData(data);
    const response = await client.post("/api/employees", formData);
    return response.data;
  },

  updateEmployee: async (
    employeeId: number,
    data: {
      name?: string;
      tax_id?: string;
      salary?: number;
      is_main_job?: boolean;
    }
  ) => {
    const formData = toFormData(data);
    const response = await client.put(`/api/employees/${employeeId}`, formData);
    return response.data;
  },

  deleteEmployee: async (employeeId: number) => {
    const response = await client.delete(`/api/employees/${employeeId}`);
    return response.data;
  },

  // Transactions
  getTransactions: async (profileId: number, startDate?: string, endDate?: string) => {
    const response = await client.get(`/api/transactions`, {
      params: {
        profile_id: profileId,
        start_date: startDate,
        end_date: endDate,
      },
    });
    return response.data;
  },

  updateTransaction: async (
    paymentId: number,
    data: {
      taxable?: boolean;
      transaction_type?: string;
      contragent?: string;
      amount?: number;
      direction?: string;
    }
  ) => {
    const formData = toFormData(data);
    const response = await client.put(`/api/transactions/${paymentId}`, formData);
    return response.data;
  },

  clearStatements: async (profileId: number) => {
    const response = await client.post(`/api/profiles/${profileId}/clear-statements`);
    return response.data;
  },

  uploadStatement: async (profileId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_id", String(profileId)); // standard backend name is company_id
    const response = await client.post("/api/upload-statement", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Calendar
  getCalendar: async (profileId: number) => {
    const response = await client.get(`/api/calendar/${profileId}`);
    return response.data;
  },

  payCalendarEvent: async (eventId: number) => {
    const response = await client.post(`/api/calendar/pay/${eventId}`);
    return response.data;
  },

  // Reports
  getReportsList: async (profileId: number) => {
    const response = await client.get(`/api/reports/${profileId}`);
    return response.data;
  },

  generateReport: async (profileId: number, period: string, formCode: string, year?: number) => {
    const response = await client.post(`/api/generate-report/${profileId}/${formCode}`, null, {
      params: { period, year },
    });
    return response.data;
  },

  getReportDetail: async (reportId: number) => {
    const response = await client.get(`/api/reports/detail/${reportId}`);
    return response.data;
  },

  submitReport: async (reportId: number, certificateId: number) => {
    const response = await client.post(`/api/reports/${reportId}/submit`, {
      certificate_id: certificateId
    });
    return response.data;
  },

  getTaxApiStatus: async (profileId: number) => {
    const response = await client.get(`/api/tax-api/status`, {
      params: { profile_id: profileId }
    });
    return response.data;
  },

  getReportDownloadUrl: (reportId: number, format: "xml" | "json" | "pdf") => {
    return `${API_BASE_URL}/api/reports/${reportId}/download/${format}`;
  },

  // Invoices & Acts
  getRecurringInvoices: async (profileId: number) => {
    const response = await client.get(`/api/invoices/recurring/${profileId}`);
    return response.data;
  },

  createRecurringInvoice: async (data: {
    profile_id: number;
    client_email: string;
    client_telegram_id?: string;
    amount: number;
    service_name: string;
    send_day: number;
    include_act: boolean;
    send_month?: number | null;
    client_name?: string;
    client_tax_id?: string;
    document_type: string;
    client_address?: string;
  }) => {
    const formData = toFormData(data);
    const response = await client.post("/api/invoices/recurring", formData);
    return response.data;
  },

  deleteRecurringInvoice: async (id: number) => {
    const response = await client.delete(`/api/invoices/recurring/${id}`);
    return response.data;
  },

  sendInvoiceNow: async (
    id: number,
    customDay?: number,
    customMonth?: number,
    includeAct?: boolean
  ) => {
    const data: any = {};
    if (customDay !== undefined && customDay !== null) data.custom_day = customDay;
    if (customMonth !== undefined && customMonth !== null) data.custom_month = customMonth;
    if (includeAct !== undefined && includeAct !== null) data.include_act = includeAct;
    
    const formData = toFormData(data);
    const response = await client.post(`/api/invoices/send-now/${id}`, formData);
    return response.data;
  },

  getInvoicesHistory: async (profileId: number) => {
    const response = await client.get(`/api/invoices/${profileId}`);
    return response.data;
  },

  sendOneoffInvoice: async (data: {
    profile_id: number;
    client_email: string;
    client_telegram_id?: string;
    amount: number;
    service_name: string;
    include_act: boolean;
    client_name?: string;
    client_tax_id?: string;
    document_type: string;
    client_address?: string;
  }) => {
    const formData = toFormData(data);
    const response = await client.post("/api/invoices/send-oneoff", formData);
    return response.data;
  },

  telegramLogin: async (telegramId: string) => {
    const formData = toFormData({ telegram_id: telegramId });
    const response = await client.post("/api/auth/telegram-login", formData);
    return response.data;
  },

  verify2FACode: async (identifier: string, code: string, isTelegram: boolean = false) => {
    const params: any = { code };
    if (isTelegram) {
      params.telegram_id = identifier;
    } else {
      params.email = identifier;
    }
    const formData = toFormData(params);
    const response = await client.post("/api/auth/verify-code", formData);
    return response.data;
  },

  deleteReport: async (reportId: number) => {
    const response = await client.delete(`/api/reports/${reportId}`);
    return response.data;
  },

  createCheckoutSession: async (profileId: number, plan: string, successUrl: string, cancelUrl: string) => {
    const response = await client.post("/api/subscriptions/create-checkout", null, {
      params: { profile_id: profileId, plan, success_url: successUrl, cancel_url: cancelUrl }
    });
    return response.data;
  },
  getCurrentSubscription: async (profileId: number) => {
    const response = await client.get(`/api/subscriptions/current/${profileId}`);
    return response.data;
  },
  adminLogin: async (data: Record<string, any>) => {
    const formData = toFormData(data);
    const response = await client.post("/api/admin/login", formData);
    return response.data;
  },
  adminGetUsers: async (token: string) => {
    const response = await client.get("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  adminGetUserDetails: async (userId: number, token: string) => {
    const response = await client.get(`/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  adminUpdateUserSubscription: async (userId: number, data: Record<string, any>, token: string) => {
    const formData = toFormData(data);
    const response = await client.put(`/api/admin/users/${userId}/subscription`, formData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  emailLogin: async (data: Record<string, any>) => {
    const formData = toFormData(data);
    const response = await client.post("/api/auth/login", formData);
    return response.data;
  }
};

export const emailApi = {
  getAuthUrl: async (profileId: number) => {
    const response = await client.get(`/api/auth/google/url/${profileId}`);
    return response.data;
  },
  
  connectStatus: async (profileId: number) => {
    const response = await client.get(`/api/auth/google/status/${profileId}`);
    return response.data;
  },
  
  disconnect: async (profileId: number) => {
    const response = await client.delete(`/api/auth/google/${profileId}`);
    return response.data;
  },

  testEmail: async (profileId: number) => {
    const response = await client.post(`/api/auth/google/test-email/${profileId}`);
    return response.data;
  },
};

export const invoicesApi = {
  getAll: async (filters?: { profile_id?: number; status?: string; client_name?: string }) => {
    const response = await client.get('/api/invoices', { params: filters });
    return response.data;
  },
  
  create: async (data: {
    profile_id: number;
    client_name: string;
    client_tax_id?: string;
    client_email: string;
    client_address?: string;
    due_date?: string;
    vat_rate?: number | null;
    notes?: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      total: number;
    }>;
    send_immediately?: boolean;
  }) => {
    const response = await client.post('/api/invoices', data);
    return response.data;
  },
  
  send: async (invoiceId: number, toEmail: string, subject?: string, message?: string) => {
    const response = await client.post(`/api/invoices/${invoiceId}/send`, {
      toEmail,
      subject,
      message,
    });
    return response.data;
  },
  
  getPdf: async (invoiceId: number) => {
    const response = await client.get(`/api/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
    return response.data;
  },
  
  createDocument: async (invoiceId: number, documentType: string) => {
    const response = await client.post(`/api/invoices/${invoiceId}/document`, { document_type: documentType });
    return response.data;
  },

  getDocumentPdf: async (invoiceId: number) => {
    const response = await client.get(`/api/invoices/${invoiceId}/document/pdf`, { responseType: 'blob' });
    return response.data;
  },

  delete: async (invoiceId: number) => {
    const response = await client.delete(`/api/invoices/${invoiceId}`);
    return response.data;
  },
};

export const paymentsApi = {
  getTaxLiabilities: async (params: { profile_id?: number; telegram_id?: string }) => {
    const response = await client.get('/api/tax-liabilities', { params });
    return response.data;
  },
  generatePayment: async (data: {
    profile_id: number;
    tax_type: string;
    amount: number;
    period: string;
    bank_code?: string;
  }) => {
    const response = await client.post('/api/payments/generate', data);
    return response.data;
  },
  confirmPayment: async (paymentId: number) => {
    const response = await client.post(`/api/payments/${paymentId}/confirm`);
    return response.data;
  },
  regenerateCalendar: async (profileId: number) => {
    const response = await client.post(`/api/tax-calendar/regenerate`, null, {
      params: { profile_id: profileId }
    });
    return response.data;
  },
};

export const certificatesApi = {
  upload: async (profileId: number, certFile: File, password: string) => {
    const formData = new FormData();
    formData.append("profile_id", profileId.toString());
    formData.append("cert_file", certFile);
    formData.append("password", password);
    const response = await client.post("/api/certificates/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  },
  list: async (profileId: number) => {
    const response = await client.get(`/api/certificates/${profileId}`);
    return response.data;
  },
  signDocument: async (docId: number, docType: string, certificateId?: number, useDiia?: boolean) => {
    const response = await client.post(`/api/documents/${docId}/sign`, {
      doc_type: docType,
      certificate_id: certificateId,
      use_diia: useDiia
    });
    return response.data;
  },
  getSignedPdfBlob: async (docId: number, docType: string) => {
    const response = await client.get(`/api/documents/${docId}/signed`, {
      params: { doc_type: docType },
      responseType: 'blob'
    });
    return response.data;
  }
};

export const taxCabinetApi = {
  getInstructions: async () => {
    const response = await client.get("/api/tax/token-instructions");
    return response.data;
  },
  getTokenStatus: async (profileId: number) => {
    const response = await client.get(`/api/tax/token-status/${profileId}`);
    return response.data;
  },
  setToken: async (profileId: number, token: string) => {
    const response = await client.post("/api/tax/set-token", { profile_id: profileId, token });
    return response.data;
  },
  checkDebt: async (profileId: number) => {
    const response = await client.post("/api/tax/check-debt", { profile_id: profileId });
    return response.data;
  },
  checkReports: async (profileId: number) => {
    const response = await client.post("/api/tax/check-reports", { profile_id: profileId });
    return response.data;
  }
};

export const legislationApi = {
  getChanges: async (profileId: number, limit: number = 10) => {
    const response = await client.get("/api/legislation/changes", {
      params: { profile_id: profileId, limit }
    });
    return response.data;
  },
  subscribe: async (profileId: number, notifyTelegram: boolean = true) => {
    const response = await client.post("/api/legislation/subscribe", null, {
      params: { profile_id: profileId, notify_telegram: notifyTelegram }
    });
    return response.data;
  },
  getSubscribeStatus: async (profileId: number) => {
    const response = await client.get(`/api/legislation/subscribe/status/${profileId}`);
    return response.data;
  },
  unsubscribe: async (profileId: number) => {
    const response = await client.delete(`/api/legislation/subscribe/${profileId}`);
    return response.data;
  },
  createCheckoutSession: async (profileId: number, plan: string, successUrl: string, cancelUrl: string) => {
    const response = await client.post("/api/subscriptions/create-checkout", null, {
      params: { profile_id: profileId, plan, success_url: successUrl, cancel_url: cancelUrl }
    });
    return response.data;
  },
  getCurrentSubscription: async (profileId: number) => {
    const response = await client.get(`/api/subscriptions/current/${profileId}`);
    return response.data;
  },
  adminLogin: async (data: Record<string, any>) => {
    const formData = toFormData(data);
    const response = await client.post("/api/admin/login", formData);
    return response.data;
  },
  adminGetUsers: async (token: string) => {
    const response = await client.get("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  adminGetUserDetails: async (userId: number, token: string) => {
    const response = await client.get(`/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  adminUpdateUserSubscription: async (userId: number, data: Record<string, any>, token: string) => {
    const formData = toFormData(data);
    const response = await client.put(`/api/admin/users/${userId}/subscription`, formData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
};

export const agentApi = {
  chat: async (profileId: number, message: string) => {
    const response = await client.post("/api/agent/chat", {
      profile_id: profileId,
      message: message
    });
    return response.data;
  }
};

export const systemConfigApi = {
  getConfig: async () => {
    const response = await client.get("/api/system-config");
    return response.data;
  },
  updateConfig: async (configs: Record<string, string>) => {
    const response = await client.post("/api/system-config", configs);
    return response.data;
  }
};

