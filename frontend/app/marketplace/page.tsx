"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { 
  Search, 
  Star, 
  ChevronRight,
  ShieldCheck,
  UserCheck,
  ArrowUpDown,
  Building2,
  Clock,
  Info,
  BadgeCheck
} from "lucide-react";

interface ServiceOffer {
  id: number;
  title: string;
  description: string;
  price: number;
  target_type: string;
}

interface ConsultingCompany {
  consulting_company_id: number;
  company_name: string;
  owner_info: {
    public_bio: string;
    contact_email: string;
    contact_phone: string;
  };
  offers: ServiceOffer[];
  free_slots: number;
  partner_discount: number;
  rating: number;
  review_count: number;
}

export default function MarketplacePage() {
  const { profiles, selectedProfile } = useApp();
  
  const [catalog, setCatalog] = useState<ConsultingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<ConsultingCompany | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<ServiceOffer | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showTariffsModal, setShowTariffsModal] = useState(false);
  const [clientStatus, setClientStatus] = useState<{
    has_active_assignment: boolean;
    has_pending_order: boolean;
    order?: {
      id: number;
      status: string;
      amount: number;
      company_name: string;
      offer_title: string;
      liqpay_checkout_url?: string | null;
    };
    assignment?: {
      id: number;
      company_name: string;
      company_id: number;
      company_phone: string;
      company_email: string;
      is_suspended: boolean;
    };
  } | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [targetFilter, setTargetFilter] = useState<"all" | "fop" | "tov" | "osbb">("all");
  const [sortBy, setSortBy] = useState<"rating" | "price_asc" | "price_desc" | "reviews">("rating");

  // Checkout States
  const [clientProfileId, setClientProfileId] = useState<string>("");
  const [accountants, setAccountants] = useState<any[]>([]);
  const [loadingAccountants, setLoadingAccountants] = useState(false);
  const [chosenAccountantId, setChosenAccountantId] = useState<string>("");
  const [isDiscretion, setIsDiscretion] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (selectedProfile) {
      setClientProfileId(String(selectedProfile.id));
    } else if (profiles && profiles.length > 0) {
      setClientProfileId(String(profiles[0].id));
    }
  }, [profiles, selectedProfile]);

  const fetchClientStatus = async (profileId: string) => {
    try {
      const telegramId = localStorage.getItem("telegram_id");
      let userId = 1;
      if (telegramId) {
        try {
          const userRes = await axios.get(`${API_BASE_URL}/api/auth/user-by-telegram?telegram_id=${telegramId}`);
          userId = userRes.data.user_id;
        } catch (err) {
          console.error("Failed to load user ID by telegram, fallback to 1:", err);
        }
      }
      const response = await axios.get(`${API_BASE_URL}/api/marketplace/client-status?client_profile_id=${profileId}&user_id=${userId}`);
      setClientStatus(response.data);
    } catch (error) {
      console.error("Failed to fetch client status:", error);
    }
  };

  useEffect(() => {
    if (clientProfileId) {
      fetchClientStatus(clientProfileId);
    }
  }, [clientProfileId]);

  const fetchCatalog = async () => {
    try {
      const response = await axios.get<{ catalog: ConsultingCompany[] }>(`${API_BASE_URL}/api/marketplace/catalog`);
      setCatalog(response.data.catalog);
    } catch (error) {
      console.error("Failed to fetch marketplace catalog:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountants = async (companyId: number) => {
    setLoadingAccountants(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/marketplace/companies/${companyId}/accountants`);
      setAccountants(response.data.accountants || []);
    } catch (error) {
      console.error("Failed to fetch accountants:", error);
    } finally {
      setLoadingAccountants(false);
    }
  };

  const handleCheckout = (company: ConsultingCompany, offer: ServiceOffer) => {
    setSelectedCompany(company);
    setSelectedOffer(offer);
    setChosenAccountantId("");
    setIsDiscretion(false);
    fetchAccountants(company.consulting_company_id);
    setShowCheckoutModal(true);
  };

  const handleConfirmCheckout = async () => {
    if (!selectedOffer || !selectedCompany || !clientProfileId) {
      alert("Будь ласка, оберіть профіль підприємства");
      return;
    }

    setSubmitting(true);
    try {
      const telegramId = localStorage.getItem("telegram_id");
      let userId = 1;
      if (telegramId) {
        try {
          const userRes = await axios.get(`${API_BASE_URL}/api/auth/user-by-telegram?telegram_id=${telegramId}`);
          userId = userRes.data.user_id;
        } catch (err) {
          console.error("Failed to load user ID by telegram, fallback to 1:", err);
        }
      }

      await axios.post(`${API_BASE_URL}/api/marketplace/checkout`, {
        service_offer_id: selectedOffer.id,
        client_profile_id: parseInt(clientProfileId),
        user_id: userId,
        requested_accountant_id: !isDiscretion && chosenAccountantId ? parseInt(chosenAccountantId) : null,
        is_at_company_discretion: isDiscretion
      });

      alert("Запит успішно надіслано! Очікуйте підтвердження та рахунок від консалтингової компанії.");
      setShowCheckoutModal(false);
      
      // Redirect to cabinet or dashboard to check status
      window.location.href = "/dashboard";
    } catch (error: any) {
      console.error("Failed to initiate checkout:", error);
      alert(error.response?.data?.detail || "Не вдалося надіслати запит");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter and sort catalog
  const filteredCatalog = catalog
    .map(company => {
      // Filter offers inside the company based on target type
      const filteredOffers = company.offers.filter(offer => 
        targetFilter === "all" || offer.target_type === targetFilter
      );
      return { ...company, offers: filteredOffers };
    })
    // Filter out companies that have no offers matching the target type filter
    .filter(company => company.offers.length > 0)
    // Filter by search query
    .filter(company => 
      company.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.owner_info.public_bio?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    // Sort
    .sort((a, b) => {
      if (sortBy === "rating") {
        return b.rating - a.rating;
      }
      if (sortBy === "reviews") {
        return b.review_count - a.review_count;
      }
      
      const minPriceA = Math.min(...a.offers.map(o => o.price), Infinity);
      const minPriceB = Math.min(...b.offers.map(o => o.price), Infinity);
      
      if (sortBy === "price_asc") {
        return minPriceA - minPriceB;
      }
      if (sortBy === "price_desc") {
        return minPriceB - minPriceA;
      }
      return 0;
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16] flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-650"></div>
          <p className="mt-4 text-xs font-bold text-slate-450 dark:text-slate-400">Завантаження маркетплейсу...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Banner Hero */}
        <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-12 overflow-hidden shadow-2xl border border-indigo-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.08),transparent_50%)]" />
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black tracking-widest text-indigo-400 uppercase bg-indigo-500/10 rounded-full border border-indigo-500/20">
              Вітрина Бухгалтерів
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Маркетплейс бухгалтерських послуг
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed font-medium">
              Оберіть перевірену консалтингову компанію та персонального бухгалтера. Безпечне підключення, автоматичний розрахунок і супровід вашого бізнесу під ключ.
            </p>
          </div>
        </div>

        {/* Filters Controls Panel */}
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Пошук компанії або послуги..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Target Filter Button Group */}
            <div className="flex bg-slate-100 dark:bg-slate-950/65 p-1 rounded-xl gap-1">
              {(["all", "fop", "tov", "osbb"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTargetFilter(type)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    targetFilter === type
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {type === "all" ? "Всі" : type.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Sorting selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold uppercase flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" /> Сортувати:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-bold"
              >
                <option value="rating">За рейтингом</option>
                <option value="reviews">За відгуками</option>
                <option value="price_asc">Ціна: від найдешевшої</option>
                <option value="price_desc">Ціна: від найдорожчої</option>
              </select>
            </div>
          </div>
        </div>

        {/* Catalog Grid */}
        {filteredCatalog.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Пропозицій не знайдено</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              Спробуйте змінити параметри пошуку або обрати іншу категорію фільтрації.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCatalog.map((company) => (
              <div 
                key={company.consulting_company_id} 
                onClick={() => {
                  setSelectedCompany(company);
                  setShowTariffsModal(true);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer"
              >
                {/* Company Header */}
                <div className="p-6 space-y-4 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black text-sm border border-indigo-500/20">
                        {company.company_name.substring(0, 2).toUpperCase()}
                      </div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug">
                        {company.company_name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span className="text-[11px] font-bold">
                        {company.rating.toFixed(1)}
                      </span>
                      <span className="text-[9px] text-slate-450 dark:text-slate-450 font-bold">
                        ({company.review_count})
                      </span>
                    </div>
                  </div>
                  
                  {company.owner_info.public_bio ? (
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                      {company.owner_info.public_bio}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-455 italic leading-relaxed">
                      Опис послуг відсутній
                    </p>
                  )}

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                    {company.owner_info.contact_email && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="text-indigo-500">📧</span> {company.owner_info.contact_email}
                      </div>
                    )}
                    {company.owner_info.contact_phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="text-indigo-500">📱</span> {company.owner_info.contact_phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Compact Proposals Counter */}
                <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/40 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span>Доступно пропозицій:</span>
                  <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-lg border border-indigo-500/20">
                    {company.offers.length}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tariffs Modal Overlay */}
      {showTariffsModal && selectedCompany && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-2xl mx-4 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black text-xs border border-indigo-500/20">
                  {selectedCompany.company_name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {selectedCompany.company_name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">Тарифи та послуги компанії</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTariffsModal(false)}
                className="text-xs text-slate-450 font-bold hover:text-slate-800"
              >
                Закрити
              </button>
            </div>

            {/* If client has pending order or active assignment, show appropriate status block */}
            {clientStatus?.has_pending_order && clientStatus.order?.status === "requested" ? (
              <div className="p-5 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400 rounded-2xl flex flex-col gap-2 items-center text-center">
                <span className="text-2xl">⚠️</span>
                <p className="text-sm font-black">Запит надіслано</p>
                <p className="text-xs font-semibold leading-relaxed">Очікуйте підтвердження та призначення бухгалтера компанією.</p>
                {clientStatus.order?.company_name && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 bg-white/40 dark:bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                    Ви відправили запит до компанії <strong>{clientStatus.order.company_name}</strong> за тарифом "{clientStatus.order.offer_title}".
                  </p>
                )}
              </div>
            ) : clientStatus?.has_active_assignment ? (
              <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded-2xl flex flex-col gap-2 items-center text-center">
                <span className="text-2xl">✅</span>
                <p className="text-sm font-black">Договір активний</p>
                <p className="text-xs font-semibold leading-relaxed">Ви вже обслуговуєтесь у компанії <strong>{clientStatus.assignment?.company_name}</strong>.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-455 uppercase tracking-widest">
                  Оберіть тарифний пакет
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedCompany.offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between gap-4 group/offer hover:border-indigo-500/50 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="text-xs font-black text-slate-900 dark:text-white">
                            {offer.title}
                          </h5>
                          <span className="inline-block px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-md border border-indigo-500/10">
                            {offer.target_type === 'fop' ? 'ФОП' : offer.target_type === 'tov' ? 'ТОВ' : 'ОСББ'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed min-h-[40px]">
                          {offer.description || "Опис послуги відсутній"}
                        </p>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                        <div className="flex items-baseline gap-1.5 justify-between">
                          <span className="text-slate-400 text-[10px] font-bold">Вартість:</span>
                          <div className="text-right">
                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                              {offer.price.toLocaleString('uk-UA')}
                            </span>
                            <span className="text-[10px] text-slate-450 font-bold ml-1">грн/міс</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setShowTariffsModal(false);
                            handleCheckout(selectedCompany, offer);
                          }}
                          className="w-full py-2.5 bg-slate-900 hover:bg-indigo-650 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                        >
                          Замовити супровід <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && selectedCompany && selectedOffer && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg mx-4 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Запит на супровід
              </h3>
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="text-xs text-slate-450 font-bold hover:text-slate-805"
              >
                Закрити
              </button>
            </div>

            {/* Selected Info Summary */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
              <div>
                <p className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider">Компанія</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{selectedCompany.company_name}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider">Тарифний Пакет</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{selectedOffer.title}</p>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200/40">
                <p className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider">Сума до сплати</p>
                <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {selectedOffer.price.toLocaleString('uk-UA')} грн/міс
                </p>
              </div>
            </div>

            {/* Profile Selection Dropdown */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-450 uppercase tracking-wider block">
                Оберіть підприємство для підключення
              </label>
              <select
                value={clientProfileId}
                onChange={(e) => setClientProfileId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold"
              >
                <option value="">-- Оберіть профіль зі списку --</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type.toUpperCase()}) - ІПН {p.tax_id}
                  </option>
                ))}
              </select>
            </div>

            {/* Accountant selection logic */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-450 uppercase tracking-wider">
                  Вибір особистого бухгалтера
                </label>
                
                {/* Discretion checkbox / toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-650 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={isDiscretion}
                    onChange={(e) => setIsDiscretion(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-350 focus:ring-indigo-500"
                  />
                  На розсуд компанії (рекомендовано)
                </label>
              </div>

              {!isDiscretion && (
                <div className="space-y-2">
                  {loadingAccountants ? (
                    <div className="text-xs text-slate-500 text-center py-2">Завантаження спеціалістів...</div>
                  ) : accountants.length === 0 ? (
                    <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-2">
                      <Info className="w-4 h-4" /> У цій компанії наразі немає вільних бухгалтерів.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {accountants.map((acc) => (
                        <button
                          key={acc.id}
                          onClick={() => setChosenAccountantId(String(acc.id))}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                            chosenAccountantId === String(acc.id)
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                              : "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-800 dark:text-white">
                              {acc.name}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {acc.is_verified && (
                                <span className="flex items-center gap-0.5 text-emerald-500 text-[10px] font-bold" title="Договір з компанією підписано">
                                  <BadgeCheck className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <span className="flex items-center gap-0.5 text-amber-500 text-xs font-bold">
                                <Star className="w-3 h-3 fill-amber-500" />
                                {(acc.rating ?? 5.0).toFixed(1)}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                            {acc.email}
                          </div>
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-[10px] font-semibold">
                            {acc.specialization || "Загальна практика"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCheckoutModal(false)}
                disabled={submitting}
                className="flex-1 py-3 bg-slate-105 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs"
              >
                Скасувати
              </button>
              <button
                onClick={handleConfirmCheckout}
                disabled={submitting || !clientProfileId}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
              >
                {submitting ? (
                  <span className="inline-block animate-spin rounded-full h-4.5 w-4.5 border-b-2 border-white"></span>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" /> Надіслати запит
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
