"use client";

import { useEffect, useState } from "react";
import axios from "axios";

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
  const [catalog, setCatalog] = useState<ConsultingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<ConsultingCompany | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<ServiceOffer | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const response = await axios.get<{ catalog: ConsultingCompany[] }>("/api/marketplace/catalog");
      setCatalog(response.data.catalog);
    } catch (error) {
      console.error("Failed to fetch marketplace catalog:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = (company: ConsultingCompany, offer: ServiceOffer) => {
    setSelectedCompany(company);
    setSelectedOffer(offer);
    setShowCheckoutModal(true);
  };

  const handleConfirmCheckout = async () => {
    if (!selectedOffer || !selectedCompany) return;

    try {
      // TODO: Replace with actual profile_id from auth
      const clientProfileId = 1;
      const userId = 1;

      const response = await axios.post("/api/marketplace/checkout", {
        service_offer_id: selectedOffer.id,
        client_profile_id: clientProfileId,
        user_id: userId,
      });

      // Redirect to LiqPay checkout
      if (response.data.liqpay_checkout_url) {
        window.location.href = response.data.liqpay_checkout_url;
      }
    } catch (error) {
      console.error("Failed to initiate checkout:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p className="mt-3 text-sm text-slate-400 font-semibold">Завантаження маркетплейсу...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Маркетплейс бухгалтерських послуг
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Знайдіть професійного бухгалтера для вашого бізнесу
          </p>
        </div>

        {/* Catalog Grid */}
        {catalog.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400">
            Наразі немає доступних пропозицій
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {catalog.map((company) => (
              <div key={company.consulting_company_id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                {/* Company Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {company.company_name}
                    </h3>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500">⭐</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {company.rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({company.review_count})
                      </span>
                    </div>
                  </div>
                  {company.owner_info.public_bio && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      {company.owner_info.public_bio}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                    {company.owner_info.contact_email && (
                      <span>📧 {company.owner_info.contact_email}</span>
                    )}
                    {company.owner_info.contact_phone && (
                      <span>📱 {company.owner_info.contact_phone}</span>
                    )}
                  </div>
                </div>

                {/* Service Offers */}
                <div className="p-6">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-4">
                    Тарифні пакети
                  </h4>
                  <div className="space-y-3">
                    {company.offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-medium text-slate-900 dark:text-white">
                            {offer.title}
                          </h5>
                          <span className="text-lg font-bold text-indigo-600">
                            {offer.price.toLocaleString('uk-UA')} грн
                          </span>
                        </div>
                        {offer.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            {offer.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {offer.target_type === 'fop' ? 'ФОП' : offer.target_type === 'tov' ? 'ТОВ' : 'ОСББ'}
                          </span>
                          <button
                            onClick={() => handleCheckout(company, offer)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                          >
                            Замовити супровід
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Company Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-700 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      Безкоштовних слотів: {company.free_slots}
                    </span>
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      Знижка {company.partner_discount}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && selectedCompany && selectedOffer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Підтвердження замовлення
            </h3>
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Компанія</p>
                <p className="font-medium text-slate-900 dark:text-white">{selectedCompany.company_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Тариф</p>
                <p className="font-medium text-slate-900 dark:text-white">{selectedOffer.title}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Сума</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {selectedOffer.price.toLocaleString('uk-UA')} грн
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={handleConfirmCheckout}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Оплатити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
