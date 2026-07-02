import axios from 'axios';
import { Platform } from 'react-native';

export const API_BASE_URL = 'https://api.unitax.pro';

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
  calculation_start_date?: string;
  starting_debt_edp?: number;
  starting_debt_esv?: number;
  starting_debt_vz?: number;
  starting_debt_pdfo?: number;
  is_blocked?: boolean;
  block_reason?: string;
  custom_recipient?: string;
  custom_edrpou?: string;
  custom_iban_edp?: string;
  custom_iban_esv?: string;
  custom_iban_vz?: string;
  custom_iban_pdfo?: string;
  organization_subtype?: string;
  non_profit_code?: string;
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
    is_main_job?: boolean;
    contract_type?: string;
    esv_paid_by_other?: boolean;
    is_archived?: boolean;
    start_date?: string | null;
    end_date?: string | null;
    active_months_json?: string | null;
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
      is_main_job?: boolean;
      contract_type?: string;
      esv_paid_by_other?: boolean;
      is_archived?: boolean;
      start_date?: string | null;
      end_date?: string | null;
      active_months_json?: string | null;
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

  // Non-profit Members & Billing
  getMembers: async (profileId: number, userId?: number) => {
    const response = await client.get(`/api/profiles/${profileId}/members`, {
      params: userId ? { user_id: userId } : undefined,
    });
    return response.data;
  },

  createMember: async (profileId: number, data: {
    identifier: string;
    owner_name?: string;
    area?: number;
    rate_per_sqm?: number;
    fixed_monthly_fee?: number;
    email?: string;
    phone?: string;
    balance?: number;
    user_id?: number;
    property_type?: string;
    parent_id?: number;
  }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/profiles/${profileId}/members`, formData);
    return response.data;
  },

  updateMember: async (profileId: number, memberId: number, data: {
    identifier?: string;
    owner_name?: string;
    area?: number;
    rate_per_sqm?: number;
    fixed_monthly_fee?: number;
    email?: string;
    phone?: string;
    balance?: number;
    user_id?: number;
    property_type?: string;
    parent_id?: number;
  }) => {
    const formData = toFormData(data);
    const response = await client.put(`/api/profiles/${profileId}/members/${memberId}`, formData);
    return response.data;
  },

  deleteMember: async (profileId: number, memberId: number, userId?: number) => {
    const response = await client.delete(`/api/profiles/${profileId}/members/${memberId}`, {
      params: userId ? { user_id: userId } : undefined,
    });
    return response.data;
  },

  chargeMembers: async (profileId: number, data: {
    description?: string;
    user_id?: number;
    charge_type?: string;
    period_type?: string;
    multiplier?: number;
    amount?: number;
    member_id?: number;
  }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/profiles/${profileId}/billing/charge`, formData);
    return response.data;
  },

  reconcilePayment: async (profileId: number, data: {
    payment_id: number;
    member_id: number;
    user_id?: number;
  }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/profiles/${profileId}/billing/reconcile-payment`, formData);
    return response.data;
  },

  matchPayments: async (profileId: number, data: { user_id?: number }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/profiles/${profileId}/billing/match-payments`, formData);
    return response.data;
  },

  getMemberDetails: async (profileId: number, memberId: number) => {
    const response = await client.get(`/api/profiles/${profileId}/members/${memberId}/details`);
    return response.data;
  },

  createMonoInvoice: async (profileId: number, data: {
    member_id: number;
    amount: number;
    charge_type: string;
    description?: string;
  }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/profiles/${profileId}/billing/invoice`, formData);
    return response.data;
  },

  getMeters: async (profileId: number) => {
    const response = await client.get(`/api/profiles/${profileId}/meters`);
    return response.data;
  },

  createMeter: async (profileId: number, data: {
    name: string;
    type: string;
    parent_id?: number;
    member_id?: number;
    tariff?: number;
    initial_reading?: number;
  }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/profiles/${profileId}/meters`, formData);
    return response.data;
  },

  updateMeter: async (profileId: number, meterId: number, data: {
    name?: string;
    type?: string;
    parent_id?: number;
    member_id?: number;
    tariff?: number;
    initial_reading?: number;
  }) => {
    const formData = toFormData(data);
    const response = await client.put(`/api/profiles/${profileId}/meters/${meterId}`, formData);
    return response.data;
  },

  deleteMeter: async (profileId: number, meterId: number) => {
    const response = await client.delete(`/api/profiles/${profileId}/meters/${meterId}`);
    return response.data;
  },

  addMeterReading: async (profileId: number, meterId: number, data: {
    reading_value: number;
    reading_date?: string;
  }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/profiles/${profileId}/meters/${meterId}/readings`, formData);
    return response.data;
  },

  getMeterReadings: async (profileId: number, meterId: number) => {
    const response = await client.get(`/api/profiles/${profileId}/meters/${meterId}/readings`);
    return response.data;
  },

  lockReadings: async (profileId: number, data: { month: number; year: number }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/profiles/${profileId}/meters/lock-readings`, formData);
    return response.data;
  },

  deleteMeterReading: async (profileId: number, meterId: number, readingId: number) => {
    const response = await client.delete(`/api/profiles/${profileId}/meters/${meterId}/readings/${readingId}`);
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

  loginAsGuest: async () => {
    const response = await client.post('/api/auth/guest');
    return response.data;
  },

  deleteUserAccount: async (identifier: string) => {
    const response = await client.delete(`/api/users/${identifier}`);
    return response.data;
  },

  deleteReport: async (reportId: number) => {
    const response = await client.delete(`/api/reports/${reportId}`);
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

  agentChat: async (profileId: number, message: string, history?: Array<{ sender: string; text: string }>) => {
    const response = await client.post('/api/agent/chat', {
      profile_id: profileId,
      message,
      history,
    });
    return response.data;
  },

  // Taxes & Payments
  getTaxLiabilities: async (profileId: number) => {
    const response = await client.get('/api/tax-liabilities', {
      params: { profile_id: profileId },
    });
    return response.data;
  },

  generatePayment: async (data: {
    profile_id: number;
    tax_type: string;
    amount: number;
    period: string;
    bank_code?: string;
    region?: string;
  }) => {
    const response = await client.post('/api/payments/generate', data);
    return response.data;
  },

  createMonoPayPayment: async (data: {
    profile_id: number;
    tax_type: string;
    period: string;
    amount: number;
  }) => {
    const response = await client.post('/api/payments/create', data);
    return response.data;
  },

  confirmPayment: async (paymentId: number) => {
    const response = await client.post(`/api/payments/${paymentId}/confirm`);
    return response.data;
  },

  // Templated Documents
  createTemplatedDocument: async (data: {
    profile_id: number;
    template_name: string;
    client_name: string;
    contract_number: string;
    client_email: string;
    amount: number;
    content?: string;
  }) => {
    const response = await client.post('/api/documents/template', data);
    return response.data;
  },

  // Send Invoice / Document via Email
  sendInvoice: async (invoiceId: number, toEmail: string, subject: string, message: string) => {
    const response = await client.post(`/api/invoices/${invoiceId}/send`, {
      to_email: toEmail,
      subject,
      message,
    });
    return response.data;
  },

  // Enterprise Documents
  getProfileDocuments: async (profileId: number) => {
    const response = await client.get(`/api/profiles/${profileId}/documents`);
    return response.data;
  },

  deleteProfileDocument: async (profileId: number, docId: number) => {
    const response = await client.delete(`/api/profiles/${profileId}/documents/${docId}`);
    return response.data;
  },

  sendProfileDocument: async (docId: number, data: { toEmail: string; subject?: string; message?: string }) => {
    const response = await client.post(`/api/profiles/documents/${docId}/send`, data);
    return response.data;
  },

  uploadProfileDocument: async (profileId: number, fileUri: string, fileName: string, fileType: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: fileType,
    } as any);
    const response = await client.post(`/api/profiles/${profileId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Support Chat
  getSupportMessages: async (profileId: number) => {
    const response = await client.get(`/api/support/messages/${profileId}`);
    return response.data;
  },

  sendSupportMessage: async (profileId: number, text: string) => {
    const response = await client.post('/api/support/message', {
      profile_id: profileId,
      text,
    });
    return response.data;
  },

  // Resident Member APIs
  searchOsbb: async (query: string) => {
    const response = await client.get(`/api/osbb/search`, { params: { query } });
    return response.data;
  },

  getOsbbBySlug: async (slug: string) => {
    const response = await client.get(`/api/osbb/by-slug/${slug}`);
    return response.data;
  },

  getOsbbAvailableAddresses: async (slug: string) => {
    const response = await client.get(`/api/osbb/by-slug/${slug}/available-addresses`);
    return response.data;
  },

  memberRegister: async (data: { slug: string; account_number: string; password: string; full_name?: string; phone?: string; email?: string; push_token?: string; platform?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/auth/member/register`, formData);
    return response.data;
  },

  memberLogin: async (data: { slug: string; phone: string; password: string; push_token?: string; platform?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/auth/member/login`, formData);
    return response.data;
  },

  getMemberDashboard: async (token: string) => {
    const response = await client.get(`/api/member/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getAnnouncements: async (profileId: number) => {
    const response = await client.get(`/api/profiles/${profileId}/announcements`);
    return response.data;
  },

  getMemberBillingHistory: async (token: string) => {
    const response = await client.get(`/api/member/billing/history`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  submitMemberMeterReading: async (token: string, meterId: number, data: { reading_value: number; reading_date?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/meters/${meterId}/readings`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMemberTransparency: async (token: string) => {
    const response = await client.get(`/api/member/transparency`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMemberNeighbors: async (token: string) => {
    const response = await client.get(`/api/member/neighbors`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMemberSurveys: async (token: string) => {
    const response = await client.get(`/api/member/surveys`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  voteMemberSurvey: async (token: string, surveyId: number, data: { vote: string; comment?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/surveys/${surveyId}/vote`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMemberMeetings: async (token: string) => {
    const response = await client.get(`/api/member/meetings`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  voteMemberMeeting: async (token: string, meetingId: number, answers: any, signatureInfo?: any) => {
    const response = await client.post(
      `/api/member/meetings/${meetingId}/vote`,
      { answers, signature_info: signatureInfo },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  getMemberTickets: async (token: string) => {
    const response = await client.get(`/api/member/tickets`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  createMemberTicket: async (token: string, data: { title: string; description: string; photo_url?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/tickets`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  createMemberMonoInvoice: async (token: string, data: { amount: number; charge_type?: string; description?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/billing/invoice`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  createMemberLiqpayCheckout: async (token: string, data: { amount: number; charge_type?: string; description?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/billing/liqpay/checkout`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  saveMemberPushToken: async (token: string, data: { token: string; platform?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/push-token`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  // Premium Features
  getMemberDocuments: async (token: string) => {
    const response = await client.get(`/api/member/documents`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMemberNotificationSettings: async (token: string) => {
    const response = await client.get(`/api/member/notifications/settings`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  updateMemberNotificationSettings: async (token: string, data: { email_reminders_enabled: boolean; push_reminders_enabled: boolean; payment_reminder_days: number; meter_reminder_days: number }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/notifications/settings`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  triggerTestMemberNotification: async (token: string) => {
    const response = await client.post(`/api/member/notifications/test`, null, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  simulateNotificationCheck: async (token: string) => {
    const response = await client.post(`/api/member/notifications/check-reminders`, null, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMemberSecurityDevices: async (token: string) => {
    const response = await client.get(`/api/member/security/devices`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  unlockMemberSecurityDevice: async (token: string, deviceId: number) => {
    const response = await client.post(`/api/member/security/unlock/${deviceId}`, null, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMemberRecreationZones: async (token: string) => {
    const response = await client.get(`/api/member/bookings/zones`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMyBookings: async (token: string) => {
    const response = await client.get(`/api/member/bookings/my`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  createMemberBooking: async (token: string, data: { zone_id: number; booking_date: string; start_time: string; end_time: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/bookings`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  cancelMemberBooking: async (token: string, bookingId: number) => {
    const response = await client.post(`/api/member/bookings/${bookingId}/cancel`, null, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMyServices: async (token: string) => {
    const response = await client.get(`/api/member/services/my`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  createMemberServiceOrder: async (token: string, data: { service_type: string; description: string; preferred_time?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/services/order`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMemberHeatingDevice: async (token: string) => {
    const response = await client.get(`/api/member/smart/heating`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  controlMemberHeating: async (token: string, data: { target_temperature: number; mode: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/smart/heating/control`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getSmartMetersTransmissionLogs: async (token: string) => {
    const response = await client.get(`/api/member/smart/meters/logs`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getMemberContacts: async (token: string) => {
    const response = await client.get(`/api/member/contacts`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  searchNearbyOsbb: async (lat: number, lon: number, radius?: number) => {
    const response = await client.get(`/api/osbb/nearby`, { params: { lat, lon, radius } });
    return response.data;
  },

  getBoardIssues: async (token: string) => {
    const response = await client.get(`/api/board/issues`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },
  createBoardIssue: async (token: string, data: { title: string; description?: string }) => {
    const response = await client.post(`/api/board/issues`, data, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },
  startBoardVoting: async (token: string, issueId: number) => {
    const response = await client.post(`/api/board/issues/${issueId}/vote-start`, null, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },
  voteBoardIssue: async (token: string, issueId: number, data: { vote_value: string; comment?: string }) => {
    const response = await client.post(`/api/board/issues/${issueId}/vote`, data, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },
  endBoardVoting: async (token: string, issueId: number) => {
    const response = await client.post(`/api/board/issues/${issueId}/vote-end`, null, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },
  signBoardProtocol: async (token: string, issueId: number, data: { password?: string; certificate_id?: number }) => {
    const response = await client.post(`/api/board/issues/${issueId}/sign`, data, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },
  getCertificates: async (profileId?: number) => {
    const response = await client.get(`/api/certificates`, { params: { profile_id: profileId } });
    return response.data;
  },
};


