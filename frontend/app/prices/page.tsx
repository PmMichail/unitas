"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";

interface TariffTier {
  name: string;
  units: number;
  price: number;
}

interface TariffPlan {
  id: number;
  code: string;
  name_uk: string;
  name_ru: string | null;
  monthly_price: number;
  description: string | null;
  is_coming_soon: boolean;
  target_profile_type: string | null;
  requires_member_module: boolean;
  base_resident_count: number | null;
  base_resident_price: number | null;
  additional_resident_tiers: TariffTier[] | null;
}

type ProfileTab = "fop" | "organizations" | "non_profit";

export default function PricesPage() {
  const [tariffs, setTariffs] = useState<TariffPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("fop");
  const [residentModuleEnabled, setResidentModuleEnabled] = useState(false);
  const [selectedTiers, setSelectedTiers] = useState<number[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [selectedPlanName, setSelectedPlanName] = useState("");

  useEffect(() => {
    fetchTariffs();
  }, []);

  useEffect(() => {
    calculateTotal();
  }, [activeTab, residentModuleEnabled, selectedTiers, tariffs]);

  const fetchTariffs = async () => {
    try {
      const response = await axios.get<TariffPlan[]>("/api/tariffs");
      // Sort by monthly price (smaller first)
      const sorted = response.data.sort((a, b) => a.monthly_price - b.monthly_price);
      setTariffs(sorted);
    } catch (error) {
      console.error("Failed to fetch tariffs:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const nonProfitTariff = tariffs.find(t => t.code === "non_profit");
    const residentTariff = tariffs.find(t => t.code === "resident_module");

    if (activeTab === "non_profit" && nonProfitTariff) {
      let total = nonProfitTariff.monthly_price;
      setSelectedPlanName(nonProfitTariff.name_uk);

      if (residentModuleEnabled && residentTariff) {
        total += residentTariff.base_resident_price || 0;
        
        // Add selected tier prices
        selectedTiers.forEach(tierIndex => {
          if (residentTariff.additional_resident_tiers && residentTariff.additional_resident_tiers[tierIndex]) {
            total += residentTariff.additional_resident_tiers[tierIndex].price;
          }
        });
      }

      setTotalPrice(total);
    } else if (activeTab === "fop") {
      const fopTariff = tariffs.find(t => t.code === "fop_1_2");
      if (fopTariff) {
        setTotalPrice(fopTariff.monthly_price);
        setSelectedPlanName(fopTariff.name_uk);
      }
    } else if (activeTab === "organizations") {
      const orgTariff = tariffs.find(t => t.code === "fop_3_tov_ep");
      if (orgTariff) {
        setTotalPrice(orgTariff.monthly_price);
        setSelectedPlanName(orgTariff.name_uk);
      }
    }
  };

  const handleTierToggle = (tierIndex: number) => {
    setSelectedTiers(prev => 
      prev.includes(tierIndex) 
        ? prev.filter(i => i !== tierIndex)
        : [...prev, tierIndex]
    );
  };

  const handleResidentModuleToggle = (enabled: boolean) => {
    setResidentModuleEnabled(enabled);
    if (enabled) {
      // Select first tier by default when enabled
      setSelectedTiers([0]);
    } else {
      setSelectedTiers([]);
    }
  };

  const getFopTariff = () => tariffs.find(t => t.code === "fop_1_2");
  const getOrgTariff = () => tariffs.find(t => t.code === "fop_3_tov_ep");
  const getNonProfitTariff = () => tariffs.find(t => t.code === "non_profit");
  const getResidentTariff = () => tariffs.find(t => t.code === "resident_module");
  const getVatTariff = () => tariffs.find(t => t.code === "tov_general_vat");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p className="mt-3 text-sm text-slate-400 font-semibold">Завантаження тарифів...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Тарифи UniTax
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Оберіть оптимальний план для вашого бізнесу
          </p>
        </div>

        {/* Profile Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setActiveTab("fop")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "fop"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              ФОП / Самозаняті
            </button>
            <button
              onClick={() => setActiveTab("organizations")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "organizations"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              Організації / ТОВ
            </button>
            <button
              onClick={() => setActiveTab("non_profit")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "non_profit"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              Неприбуткові (ОСББ, Садові товариства, Кооперативи)
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === "fop" && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                {getFopTariff() && (
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      {getFopTariff()!.name_uk}
                    </h2>
                    <div className="text-2xl font-bold text-indigo-600 mb-3">
                      {getFopTariff()!.monthly_price} грн/міс
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Повний бухгалтерський облік для ФОП
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Автоматичний імпорт банківських виписок
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Податковий календар та нагадування
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Формування звітів для ДПС
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === "organizations" && (
              <div className="space-y-3">
                {getOrgTariff() && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      {getOrgTariff()!.name_uk}
                    </h2>
                    <div className="text-2xl font-bold text-indigo-600 mb-3">
                      {getOrgTariff()!.monthly_price} грн/міс
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Бухгалтерський облік для ТОВ та ФОП 3 групи
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Облік ПДВ (якщо платник)
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Кадровий облік та зарплата
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Автоматичний імпорт банківських виписок
                      </li>
                    </ul>
                  </div>
                )}

                {getVatTariff() && getVatTariff()!.is_coming_soon && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-slate-100/50 dark:bg-slate-700/50 backdrop-blur-sm flex items-center justify-center">
                      <div className="text-center">
                        <span className="inline-block px-2 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-semibold mb-2">
                          В розробці / Скоро
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Тариф для платників ПДВ на загальній системі
                        </p>
                      </div>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 opacity-50">
                      {getVatTariff()!.name_uk}
                    </h2>
                    <div className="text-2xl font-bold text-indigo-600 mb-3 opacity-50">
                      {getVatTariff()!.monthly_price} грн/міс
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "non_profit" && (
              <div className="space-y-3">
                {/* Sub-block A: Base Bookkeeping Core */}
                {getNonProfitTariff() && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border-2 border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {getNonProfitTariff()!.name_uk}
                      </h2>
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-[10px] font-medium">
                        Базовий пакет
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-indigo-600 mb-3">
                      {getNonProfitTariff()!.monthly_price} грн/міс
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Повний бухгалтерський облік для неприбуткових організацій
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Кадровий облік та відомості про зарплату
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Автоматичний імпорт банківських виписок
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-1.5 text-xs">✓</span>
                        Річний баланс через API ДПС
                      </li>
                    </ul>
                  </div>
                )}

                {/* Sub-block B: Resident Module Addon */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Модуль автоматизації оплат та кабінети мешканців
                      </h3>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Додатковий модуль до основного акаунту
                      </p>
                    </div>
                    <button
                      onClick={() => handleResidentModuleToggle(!residentModuleEnabled)}
                      className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                        residentModuleEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          residentModuleEnabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {residentModuleEnabled && getResidentTariff() && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                      {/* Base Tier - Always Selected */}
                      <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border-2 border-indigo-200 dark:border-indigo-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-xs text-slate-900 dark:text-white">
                              Стартовий пакет: до {getResidentTariff()!.base_resident_count} об'єктів
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">
                              Включено в базову вартість
                            </div>
                          </div>
                          <div className="text-sm font-bold text-indigo-600">
                            {getResidentTariff()!.base_resident_price} грн
                          </div>
                        </div>
                      </div>

                      {/* Additional Tiers */}
                      {getResidentTariff()!.additional_resident_tiers && getResidentTariff()!.additional_resident_tiers.map((tier, index) => (
                        <div
                          key={index}
                          onClick={() => handleTierToggle(index)}
                          className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedTiers.includes(index)
                              ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700"
                              : "bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`w-3.5 h-3.5 rounded border-2 mr-1.5 flex items-center justify-center ${
                                selectedTiers.includes(index)
                                  ? "bg-indigo-600 border-indigo-600"
                                  : "border-slate-300 dark:border-slate-500"
                              }`}>
                                {selectedTiers.includes(index) && (
                                  <span className="text-white text-[9px]">✓</span>
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-xs text-slate-900 dark:text-white">
                                  +{tier.units} об'єктів
                                </div>
                                <div className="text-[10px] text-slate-600 dark:text-slate-400">
                                  {tier.name}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-bold text-indigo-600">
                              {tier.price} грн
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Invoice Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                Ваша підписка
              </h3>
              
              <div className="mb-4">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Обраний план
                </div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {selectedPlanName}
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mb-4">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Деталі:
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  {activeTab === "non_profit" && getNonProfitTariff() && (
                    <>
                      <div>Базовий облік: {getNonProfitTariff()!.monthly_price} грн</div>
                      {residentModuleEnabled && getResidentTariff() && (
                        <>
                          <div>Модуль автоматизації оплат (база): {getResidentTariff()!.base_resident_price} грн</div>
                          {selectedTiers.map(tierIndex => {
                            const tier = getResidentTariff()!.additional_resident_tiers?.[tierIndex];
                            if (tier) {
                              return (
                                <div key={tierIndex}>
                                  +{tier.units} об'єктів: {tier.price} грн
                                </div>
                              );
                            }
                            return null;
                          })}
                        </>
                      )}
                    </>
                  )}
                  {activeTab === "fop" && getFopTariff() && (
                    <div>Повний облік ФОП: {getFopTariff()!.monthly_price} грн</div>
                  )}
                  {activeTab === "organizations" && getOrgTariff() && (
                    <div>Облік організації: {getOrgTariff()!.monthly_price} грн</div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mb-6">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Всього на місяць
                </div>
                <div className="text-3xl font-bold text-indigo-600">
                  {totalPrice} грн
                </div>
              </div>

              <Link
                href="/register"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center block"
              >
                Створити профіль
              </Link>

              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-3">
                Без кредитної картки. Скасуйте в будь-який час.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
