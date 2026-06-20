import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://unitas-backend.fly.dev";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  },
});

// Log all requests for debugging
client.interceptors.request.use((config) => {
  console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data);
  return config;
});

client.interceptors.response.use((response) => {
  console.log(`[API Response] ${response.config.url}`, response.data);
  return response;
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
  searchOsbb: async (query: string) => {
    const response = await client.get(`/api/osbb/search`, { params: { query } });
    return response.data;
  },

  getOsbbBySlug: async (slug: string) => {
    const response = await client.get(`/api/osbb/by-slug/${slug}`);
    return response.data;
  },

  memberRegister: async (data: { slug: string; account_number: string; password: string; full_name?: string; phone?: string; email?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/auth/member/register`, formData);
    return response.data;
  },

  memberLogin: async (data: { slug: string; account_number: string; password: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/auth/member/login`, formData);
    return response.data;
  },

  getMemberDashboard: async (token: string) => {
    const response = await client.get(`/api/member/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
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

  getMemberSurveys: async (token: string) => {
    const response = await client.get(`/api/member/surveys`, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  voteMemberSurvey: async (token: string, surveyId: number, data: { vote: string; comment?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/surveys/${surveyId}/vote`, formData, { headers: { Authorization: `Bearer ${token}` } });
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

  saveMemberPushToken: async (token: string, data: { token: string; platform?: string }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/member/push-token`, formData, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  // Profiles
  getProfiles: async (telegramId: string) => {
    const response = await client.get(`/api/profiles`, {
      params: { telegram_id: telegramId, _t: Date.now() },
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
    bank_name?: string;
    mfo?: string;
    iban?: string;
    custom_recipient?: string;
    custom_edrpou?: string;
    custom_iban_edp?: string;
    custom_iban_esv?: string;
    custom_iban_pdfo?: string;
    custom_iban_vz?: string;
    organization_subtype?: string;
    non_profit_code?: string;
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
      bank_name?: string;
      mfo?: string;
      iban?: string;
      custom_recipient?: string;
      custom_edrpou?: string;
      custom_iban_edp?: string;
      custom_iban_esv?: string;
      custom_iban_pdfo?: string;
      custom_iban_vz?: string;
      calculation_start_date?: string;
      starting_debt_edp?: number;
      starting_debt_esv?: number;
      starting_debt_vz?: number;
      starting_debt_pdfo?: number;
      organization_subtype?: string;
      non_profit_code?: string;
      mono_api_token?: string;
      slug?: string;
      color_theme?: string;
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

  getMembersModeration: async (profileId: number, status?: string, userId?: number) => {
    const response = await client.get(`/api/profiles/${profileId}/members/moderation`, {
      params: { ...(status ? { status } : {}), ...(userId ? { user_id: userId } : {}) },
    });
    return response.data;
  },

  updateMemberModeration: async (profileId: number, memberId: number, data: { status: string; verified_by?: number; user_id?: number }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/profiles/${profileId}/members/${memberId}/moderation`, formData);
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
    contract_type?: string;
    esv_paid_by_other?: boolean;
    is_archived?: boolean;
    start_date?: string | null;
    end_date?: string | null;
    active_months_json?: string | null;
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

  getStatements: async (profileId: number) => {
    const response = await client.get(`/api/profiles/${profileId}/statements`);
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
    const response = await client.get(`/api/subscription/current/${profileId}`);
    return response.data;
  },
  getSubscriptionUsage: async (profileId: number) => {
    const response = await client.get(`/api/subscription/usage/${profileId}`);
    return response.data;
  },
  cancelSubscription: async (profileId: number) => {
    const response = await client.post(`/api/subscription/cancel/${profileId}`);
    return response.data;
  },
  upgradeToBusiness: async (profileId: number) => {
    const response = await client.post(`/api/subscription/upgrade/${profileId}`);
    return response.data;
  },
  getProfilePayments: async (profileId: number) => {
    const response = await client.get(`/api/payments/profile/${profileId}`);
    return response.data;
  },
  adminLogin: async (data: Record<string, any>) => {
    const formData = toFormData(data);
    const response = await client.post("/api/admin/login", formData);
    return response.data;
  },
  adminGetUsers: async (token: string) => {
    const response = await client.get("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
      params: { _t: Date.now() }
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
    const response = await client.put(`/api/admin/users/${userId}/subscription`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  adminDeleteProfile: async (profileId: number, token: string) => {
    const response = await client.delete(`/api/admin/profiles/${profileId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  adminBlockProfile: async (profileId: number, data: { is_blocked: boolean; block_reason?: string }, token: string) => {
    const response = await client.post(`/api/admin/profiles/${profileId}/block`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  getPricing: async () => {
    const response = await client.get("/api/pricing");
    return response.data;
  },
  createPayment: async (data: { profile_id: number; plan_type: string; payment_period: string }) => {
    const response = await client.post("/api/payments/create", data);
    return response.data;
  },
  adminUpdatePricing: async (data: { plan_type: string; payment_period: string; price: number }, token: string) => {
    const response = await client.put("/api/admin/pricing", data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  adminGetPayments: async (token: string) => {
    const response = await client.get("/api/admin/payments", {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  adminGetStats: async (token: string) => {
    const response = await client.get("/api/admin/stats", {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  emailLogin: async (data: Record<string, any>) => {
    const formData = toFormData(data);
    const response = await client.post("/api/auth/login", formData);
    return response.data;
  },
  registerUser: async (data: Record<string, any>) => {
    const formData = toFormData(data);
    const response = await client.post("/api/auth/register", formData);
    return response.data;
  },
  forgotPassword: async (email: string) => {
    const formData = new FormData();
    formData.append("email", email);
    const response = await client.post("/api/auth/forgot-password", formData);
    return response.data;
  },
  resetPassword: async (data: Record<string, any>) => {
    const formData = toFormData(data);
    const response = await client.post("/api/auth/reset-password", formData);
    return response.data;
  },
  enableAutoRenew: async (profileId: number, autoRenew: boolean) => {
    const response = await client.post(`/api/subscriptions/enable-autorenew/${profileId}`, {
      auto_renew: autoRenew
    });
    return response.data;
  },
  sendSubscriptionInvoice: async (data: { profile_id: number; plan_type: string; payment_period: string; email: string }) => {
    const response = await client.post("/api/subscriptions/send-invoice", data);
    return response.data;
  },
  sendPasswordToEmail: async (email: string) => {
    const response = await client.post(`/api/auth/send-password-to-email`, { email });
    return response.data;
  },
  getSupportMessages: async (profileId: number) => {
    const response = await client.get(`/api/support/messages/${profileId}`, {
      params: { _t: Date.now() }
    });
    return response.data;
  },
  postSupportMessage: async (profileId: number, text: string) => {
    const response = await client.post(`/api/support/message`, {
      profile_id: profileId,
      text: text
    });
    return response.data;
  },
  adminGetSupportChats: async (token: string) => {
    const response = await client.get(`/api/support/chats`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { _t: Date.now() }
    });
    return response.data;
  },
  adminReplySupportMessage: async (profileId: number, text: string, token: string) => {
    const response = await client.post(`/api/support/reply`, {
      profile_id: profileId,
      text: text
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  postVisit: async () => {
    const response = await client.post("/api/stats/visit");
    return response.data;
  },

  // Resident Cabinet Module
  purchaseResidentCabinet: async (profileId: number, data: {
    slug: string;
    mono_api_token: string;
    color_theme?: string;
    user_id?: number;
  }) => {
    const formData = toFormData(data);
    const response = await client.post(`/api/profiles/${profileId}/purchase-resident-cabinet`, formData);
    return response.data;
  },

  getResidentCabinetStatus: async (profileId: number, userId?: number) => {
    const response = await client.get(`/api/profiles/${profileId}/resident-cabinet-status`, {
      params: userId ? { user_id: userId } : undefined,
    });
    return response.data;
  },

  getSubscriptionPlans: async () => {
    const response = await client.get("/api/subscription/plans");
    return response.data;
  },

  createSubscription: async (data: {
    plan_id: number;
    enable_member_module: boolean;
    profile_id: number;
  }) => {
    const response = await client.post("/api/subscription/create", data);
    return response.data;
  },
  getNearbyOsbb: async (lat: number, lon: number) => {
    const response = await client.get("/api/osbb/nearby", { params: { lat, lon } });
    return response.data;
  },
  resetMemberPassword: async (data: { slug: string; account_number: string; password_string: string }) => {
    const formData = new FormData();
    formData.append("slug", data.slug);
    formData.append("account_number", data.account_number);
    formData.append("password", data.password_string);
    const response = await client.post("/api/auth/member/reset-password", formData);
    return response.data;
  },
  getPendingMembers: async (profileId: number) => {
    const response = await client.get("/api/admin/members/pending", { params: { profile_id: profileId } });
    return response.data;
  },
  verifyMember: async (memberId: number, userId?: number) => {
    const formData = new FormData();
    if (userId) formData.append("user_id", String(userId));
    const response = await client.post(`/api/admin/members/${memberId}/verify`, formData);
    return response.data;
  },
  rejectMember: async (memberId: number) => {
    const response = await client.post(`/api/admin/members/${memberId}/reject`);
    return response.data;
  },
  getModuleStatus: async (profileId: number) => {
    const response = await client.get("/api/admin/module/status", { params: { profile_id: profileId } });
    return response.data;
  },
  generateModuleSlug: async (profileId: number, name: string) => {
    const formData = new FormData();
    formData.append("profile_id", String(profileId));
    formData.append("name", name);
    const response = await client.post("/api/admin/module/generate-slug", formData);
    return response.data;
  },
  activateModule: async (profileId: number, slug: string, colorTheme?: string) => {
    const formData = new FormData();
    formData.append("profile_id", String(profileId));
    formData.append("slug", slug);
    if (colorTheme) formData.append("color_theme", colorTheme);
    const response = await client.post("/api/admin/module/activate", formData);
    return response.data;
  },
  updateTicketStatus: async (ticketId: number, status: string) => {
    const formData = new FormData();
    formData.append("status", status);
    const response = await client.post(`/api/admin/tickets/${ticketId}/status`, formData);
    return response.data;
  },
  createMemberPayment: async (amount: number, chargeType: string = "regular", description: string = "Оплата внеску") => {
    const formData = new FormData();
    formData.append("amount", String(amount));
    formData.append("charge_type", chargeType);
    formData.append("description", description);
    const response = await client.post("/api/member/billing/invoice", formData);
    return response.data;
  },
  getMemberNeighbors: async (token: string) => {
    const response = await client.get("/api/member/neighbors", { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },
  downloadMemberReceiptPdf: async (token?: string) => {
    const response = await client.get("/api/member/receipt/pdf", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      params: token ? { token } : undefined,
      responseType: 'blob'
    });
    return response.data;
  },
  getAdminProfileDetail: async (profileId: number) => {
    const response = await client.get(`/api/admin/profile/${profileId}`);
    return response.data;
  },
  getMonobankAuthorizeUrl: async (profileId: number) => {
    const response = await client.get("/api/monobank/oauth/authorize", { params: { profile_id: profileId } });
    return response.data;
  },
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
  uploadCustomDocument: async (
    file: File,
    profileId: number,
    title: string,
    number: string,
    clientEmail: string,
    amount: number,
    documentType?: string
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("profile_id", String(profileId));
    formData.append("title", title);
    formData.append("number", number);
    formData.append("client_email", clientEmail);
    formData.append("amount", String(amount));
    if (documentType) {
      formData.append("document_type", documentType);
    }
    const response = await client.post("/api/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  },
  createTemplatedDocument: async (data: {
    profile_id: number;
    template_name: string;
    client_name: string;
    contract_number: string;
    client_email: string;
    amount: number;
    content?: string;
  }) => {
    const response = await client.post("/api/documents/template", data);
    return response.data;
  },
  getIncoming: async (profileId: number) => {
    const response = await client.get(`/api/invoices/incoming/${profileId}`);
    return response.data;
  },
  markIncomingViewed: async (invoiceId: number, profileId: number) => {
    const response = await client.post(`/api/invoices/incoming/${invoiceId}/view`, null, {
      params: { profile_id: profileId }
    });
    return response.data;
  },
  getProfileDocuments: async (profileId: number) => {
    const response = await client.get(`/api/profiles/${profileId}/documents`);
    return response.data;
  },
  uploadProfileDocument: async (profileId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await client.post(`/api/profiles/${profileId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  },
  deleteProfileDocument: async (profileId: number, docId: number) => {
    const response = await client.delete(`/api/profiles/${profileId}/documents/${docId}`);
    return response.data;
  },
  getProfileDocumentPdf: async (docId: number) => {
    const response = await client.get(`/api/profiles/documents/${docId}/download`, { responseType: 'blob' });
    return response.data;
  },
  sendProfileDocument: async (docId: number, data: { toEmail: string; subject?: string; message?: string }) => {
    const response = await client.post(`/api/profiles/documents/${docId}/send`, data);
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
  resetPayments: async (data: {
    profile_id: number;
    period_type: string;
    year: number;
    period_value: number;
  }) => {
    const response = await client.post('/api/payments/reset', data);
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
  delete: async (certId: number) => {
    const response = await client.delete(`/api/certificates/${certId}`);
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
  },
  uploadDpsStatement: async (profileId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("profile_id", String(profileId));
    const response = await client.post("/api/dps/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
  recalculateDpsDebt: async (profileId: number) => {
    const response = await client.post(`/api/dps/recalculate?profile_id=${profileId}`);
    return response.data;
  },
  fetchDpsData: async (profileId: number) => {
    const response = await client.post("/api/dps/fetch", { profile_id: profileId });
    return response.data;
  },
  fetchRealDpsData: async (profileId: number) => {
    const response = await client.post("/api/dps/fetch-real", { profile_id: profileId });
    return response.data;
  },
  fetchDetailedDpsData: async (profileId: number) => {
    const response = await client.post("/api/dps/fetch-detailed", { profile_id: profileId, _t: Date.now() });
    return response.data;
  },
  getDpsStatements: async (profileId: number) => {
    const response = await client.get(`/api/dps/statements?profile_id=${profileId}`);
    return response.data;
  },
  deleteDpsStatement: async (profileId: number, recordedAt: string) => {
    const response = await client.delete(`/api/dps/statements?profile_id=${profileId}&recorded_at=${encodeURIComponent(recordedAt)}`);
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
  }
};

export const agentApi = {
  chat: async (profileId: number, message: string, history?: any[]) => {
    const response = await client.post("/api/agent/chat", {
      profile_id: profileId,
      message: message,
      history: history
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

