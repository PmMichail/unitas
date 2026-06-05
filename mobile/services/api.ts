import axios from 'axios';

const API_BASE_URL = 'https://unitas-backend.fly.dev';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Helper to convert object to FormData for FastAPI Form(...) endpoints
const toFormData = (data: Record<string, any>): FormData => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'boolean') {
        formData.append(key, value ? 'true' : 'false');
      } else {
        formData.append(key, String(value));
      }
    }
  });
  return formData;
};

export interface ProfileData {
  id: number;
  telegram_id: string;
  type: 'fop' | 'company';
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
}

export const api = {
  // Profiles
  getProfiles: async (telegramId: string): Promise<ProfileData[]> => {
    const response = await client.get(`/api/profiles`, {
      params: { telegram_id: telegramId },
    });
    return response.data;
  },

  createProfile: async (data: Omit<ProfileData, 'id'>) => {
    const formData = toFormData(data);
    const response = await client.post('/api/profiles', formData);
    return response.data;
  },

  updateProfile: async (profileId: number, data: Partial<Omit<ProfileData, 'id' | 'telegram_id'>>) => {
    const formData = toFormData(data);
    const response = await client.put(`/api/profiles/${profileId}`, formData);
    return response.data;
  },

  deleteProfile: async (profileId: number) => {
    const response = await client.delete(`/api/profiles/${profileId}`);
    return response.data;
  },

  // Dashboard & Analytics
  getDashboard: async (profileId: number, periodType?: string, year?: number, periodValue?: number) => {
    const response = await client.get(`/api/dashboard/${profileId}`, {
      params: {
        period_type: periodType,
        year,
        period_value: periodValue
      }
    });
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
  }) => {
    const formData = toFormData(data);
    const response = await client.post('/api/employees', formData);
    return response.data;
  },

  updateEmployee: async (
    employeeId: number,
    data: {
      name?: string;
      tax_id?: string;
      salary?: number;
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
      transaction_type?: 'income' | 'expense' | 'own_funds' | 'refund' | 'loan';
      contragent?: string;
      amount?: number;
      direction?: 'in' | 'out';
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

  createTransaction: async (data: {
    profile_id: number;
    date: string;
    amount: number;
    direction: 'in' | 'out';
    purpose: string;
    contragent?: string;
    transaction_type: string;
    taxable: boolean;
  }) => {
    const formData = toFormData(data);
    const response = await client.post('/api/transactions', formData);
    return response.data;
  },

  // File Upload adapted for React Native
  uploadStatement: async (profileId: number, fileUri: string, fileName: string, fileType: string) => {
    const formData = new FormData();
    // React Native FormData expects an object with uri, name, and type for files
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: fileType || 'text/csv',
    } as any);
    formData.append('company_id', String(profileId));

    const response = await client.post('/api/upload-statement', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
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

  generateReport: async (profileId: number, period: string, formCode: string) => {
    const response = await client.post(`/api/generate-report/${profileId}/${formCode}`, null, {
      params: { period },
    });
    return response.data;
  },

  getReportDetail: async (reportId: number) => {
    const response = await client.get(`/api/reports/detail/${reportId}`);
    return response.data;
  },

  updateReportDetail: async (reportId: number, fieldsUpdate: Record<string, any>) => {
    const response = await client.put(`/api/reports/detail/${reportId}`, fieldsUpdate);
    return response.data;
  },

  getReportDownloadUrl: (reportId: number, format: 'xml' | 'json' | 'pdf' | 'csv') => {
    return `${API_BASE_URL}/api/reports/${reportId}/download/${format}`;
  },

  // Auth API
  login: async (email: string, password: string) => {
    const formData = toFormData({ email, password });
    const response = await client.post('/api/auth/login', formData);
    return response.data;
  },

  registerUser: async (data: {
    email: string;
    password: string;
    phone?: string;
    company_name: string;
    tax_id: string;
    tax_system: string;
    group?: number;
    rate?: number;
    has_employees: boolean;
    is_vat_payer: boolean;
    reg_date?: string;
  }) => {
    const formData = toFormData(data);
    const response = await client.post('/api/auth/register', formData);
    return response.data;
  },

  telegramLogin: async (telegramId: string) => {
    const formData = toFormData({ telegram_id: telegramId });
    const response = await client.post('/api/auth/telegram-login', formData);
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
    const response = await client.post('/api/auth/verify-code', formData);
    return response.data;
  },

  deleteUserAccount: async (identifier: string) => {
    const response = await client.delete(`/api/users/${identifier}`);
    return response.data;
  },

  getCurrentUser: async (identifier: string) => {
    const response = await client.get('/api/auth/me', {
      params: { identifier }
    });
    return response.data;
  },

  // Invoice Automation API
  createRecurringInvoice: async (data: {
    profile_id: number;
    client_email: string;
    client_telegram_id?: string;
    amount: number;
    service_name: string;
    send_day: number;
    include_act?: boolean;
    send_month?: number | null;
    client_name?: string;
    client_tax_id?: string;
    document_type: string;
    client_address?: string;
  }) => {
    const formData = toFormData(data);
    const response = await client.post('/api/invoices/recurring', formData);
    return response.data;
  },

  getRecurringInvoices: async (profileId: number) => {
    const response = await client.get(`/api/invoices/recurring/${profileId}`);
    return response.data;
  },

  deleteRecurringInvoice: async (id: number) => {
    const response = await client.delete(`/api/invoices/recurring/${id}`);
    return response.data;
  },

  getInvoicesHistory: async (profileId: number) => {
    const response = await client.get(`/api/invoices/${profileId}`);
    return response.data;
  },

  sendInvoiceNow: async (id: number, customDay?: number, customMonth?: number, includeAct?: boolean) => {
    const formData = toFormData({
      custom_day: customDay,
      custom_month: customMonth,
      include_act: includeAct,
    });
    const response = await client.post(`/api/invoices/send-now/${id}`, formData);
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
    const response = await client.post('/api/invoices/send-oneoff', formData);
    return response.data;
  },

  getInvoicePdfUrl: (invoiceId: number) => {
    return `${API_BASE_URL}/api/invoices/${invoiceId}/pdf`;
  },

  getInvoiceDocumentPdfUrl: (invoiceId: number) => {
    return `${API_BASE_URL}/api/invoices/${invoiceId}/document/pdf`;
  },

  createInvoiceDocument: async (invoiceId: number, documentType: string) => {
    const response = await client.post(`/api/invoices/${invoiceId}/document`, { document_type: documentType });
    return response.data;
  },

  agentChat: async (profileId: number, message: string) => {
    const response = await client.post('/api/agent/chat', {
      profile_id: profileId,
      message,
    });
    return response.data;
  },
};


