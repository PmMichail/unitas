"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";

interface Profile {
  id: number;
  user_id: number;
  type: "fop" | "company";
  name: string;
  tax_id: string;
  tax_system: string;
  is_director: boolean;
  group?: number;
  rate?: number;
  has_employees: boolean;
  is_vat_payer: boolean;
  reg_date?: string;
  esv_paid_by_employer?: boolean;
  address?: string;
  default_bank?: string;
  director_name?: string;
  phone?: string;
  is_blocked?: boolean;
  block_reason?: string;
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
  parent_profile_id?: number | null;
  has_resident_cabinet?: boolean;
  is_member_module_active?: boolean;
  slug?: string;
  color_theme?: string;
  lat?: number | null;
  lon?: number | null;
  is_consulting_company?: boolean;
  is_managed_client?: boolean;
}

interface SubscriptionInfo {
  plan: string;
  status: string;
  expires_at: string | null;
  features: Record<string, boolean>;
}

interface AppContextType {
  telegramId: string;
  setTelegramId: (id: string) => void;
  profiles: Profile[];
  selectedProfile: Profile | null;
  setSelectedProfile: (profile: Profile | null) => void;
  loadingProfiles: boolean;
  refreshProfiles: () => Promise<void>;
  dashboardTrigger: number;
  triggerDashboardReload: () => void;
  subscription: SubscriptionInfo | null;
  refreshSubscription: () => Promise<void>;
  loadingSubscription: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [telegramId, setTelegramIdState] = useState<string>("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfileState] = useState<Profile | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState<boolean>(true);
  const [dashboardTrigger, setDashboardTrigger] = useState<number>(0);

  // Load telegram_id from URL or localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get("telegram_id");
      const savedId = localStorage.getItem("telegram_id");
      const finalId = urlId || savedId;

      if (finalId) {
        setTelegramIdState(finalId);
        localStorage.setItem("telegram_id", finalId);
      } else {
        const path = window.location.pathname;
        const isExempt = path.startsWith("/admin") || path.startsWith("/osbb") || ["/", "/login", "/register", "/privacy", "/terms", "/refund", "/benefits"].includes(path);
        if (!isExempt) {
          window.location.href = "/login";
        }
      }
    }
  }, []);

  const setTelegramId = (id: string) => {
    setTelegramIdState(id);
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem("telegram_id", id);
        window.location.href = "/dashboard";
      } else {
        localStorage.removeItem("telegram_id");
        localStorage.removeItem("selected_profile_id");
        window.location.href = "/login";
      }
    }
  };

  const refreshProfiles = async () => {
    if (!telegramId) return;
    setLoadingProfiles(true);
    try {
      const data = await api.getProfiles(telegramId);
      setProfiles(data);
      
      // Auto-select profile if none selected or the selected one is no longer present
      const savedProfileId = localStorage.getItem("selected_profile_id");
      if (data.length > 0) {
        const found = data.find((p: Profile) => String(p.id) === savedProfileId);
        if (found) {
          setSelectedProfileState(found);
        } else {
          setSelectedProfileState(data[0]);
          localStorage.setItem("selected_profile_id", String(data[0].id));
        }
      } else {
        setSelectedProfileState(null);
      }
    } catch (err) {
      console.error("Failed to load profiles:", err);
      setProfiles([]);
      setSelectedProfileState(null);
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    if (telegramId) {
      refreshProfiles();
    }
  }, [telegramId]);

  const setSelectedProfile = (profile: Profile | null) => {
    setSelectedProfileState(profile);
    if (profile && typeof window !== "undefined") {
      localStorage.setItem("selected_profile_id", String(profile.id));
    }
  };

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState<boolean>(true);

  const refreshSubscription = async () => {
    if (!selectedProfile) {
      setSubscription(null);
      setLoadingSubscription(false);
      return;
    }
    setLoadingSubscription(true);
    try {
      const data = await api.getCurrentSubscription(selectedProfile.id);
      setSubscription(data);
    } catch (err) {
      console.error("Failed to load subscription in context:", err);
      // Fail secure: default to free plan if error loading subscription
      setSubscription({
        plan: "free",
        status: "active",
        expires_at: null,
        features: {}
      });
    } finally {
      setLoadingSubscription(false);
    }
  };

  useEffect(() => {
    refreshSubscription();
  }, [selectedProfile]);

  const triggerDashboardReload = () => {
    setDashboardTrigger((prev) => prev + 1);
  };

  return (
    <AppContext.Provider
      value={{
        telegramId,
        setTelegramId,
        profiles,
        selectedProfile,
        setSelectedProfile,
        loadingProfiles,
        refreshProfiles,
        dashboardTrigger,
        triggerDashboardReload,
        subscription,
        refreshSubscription,
        loadingSubscription,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
