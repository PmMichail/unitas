"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Building2, Globe, CreditCard, CheckCircle, ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";

export default function ModuleSetupWizard() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = Number(params.step || 1);

  const [profileId, setProfileId] = useState<number | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Step 2 Form States
  const [slug, setSlug] = useState("");
  const [colorTheme, setColorTheme] = useState("#3b82f6");
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);

  // Load profile details
  const loadProfileData = async (pid: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getAdminProfileDetail(pid);
      setProfile(data);
      if (data.slug) {
        setSlug(data.slug);
      } else {
        // Auto-generate slug on load if empty
        const slugData = await api.generateModuleSlug(pid, data.name);
        setSlug(slugData.slug);
      }
    } catch (err: any) {
      setError("Не вдалося завантажити профіль організації.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedId = localStorage.getItem("selected_profile_id");
    if (!savedId) {
      router.push("/login");
      return;
    }
    const pid = Number(savedId);
    setProfileId(pid);
    loadProfileData(pid);

    if (searchParams.get("success") === "true") {
      setSuccess("Monobank успішно підключено!");
    }
  }, [params.step]);

  const handleGenerateSlug = async () => {
    if (!profileId || !profile) return;
    setIsCheckingSlug(true);
    try {
      const data = await api.generateModuleSlug(profileId, profile.name);
      setSlug(data.slug);
    } catch (err) {
      setError("Не вдалося згенерувати URL-адресу.");
    } finally {
      setIsCheckingSlug(false);
    }
  };

  const handleConnectMonobank = async () => {
    if (!profileId) return;
    try {
      const res = await api.getMonobankAuthorizeUrl(profileId);
      if (res?.authorize_url) {
        window.location.href = res.authorize_url;
      } else {
        setError("Не вдалося отримати посилання на авторизацію Monobank.");
      }
    } catch (err: any) {
      setError("Помилка підключення до Monobank.");
    }
  };

  const handleActivate = async () => {
    if (!profileId) return;
    setLoading(true);
    setError("");
    try {
      await api.activateModule(profileId, slug, colorTheme);
      setSuccess("Модуль кабінету мешканця активовано!");
      // Re-load data and stay on step 4 to show final instructions
      loadProfileData(profileId);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Помилка активації модуля.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step < 4) router.push(`/admin/module/${step + 1}`);
  };

  const prevStep = () => {
    if (step > 1) router.push(`/admin/module/${step - 1}`);
  };

  if (loading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090d16] text-[#f1f5f9]">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  // Progress Bar Steps helper
  const steps = [
    { num: 1, label: "Дані ОСББ", icon: <Building2 size={18} /> },
    { num: 2, label: "Налаштування URL", icon: <Globe size={18} /> },
    { num: 3, label: "Платежі Monobank", icon: <CreditCard size={18} /> },
    { num: 4, label: "Активація", icon: <CheckCircle size={18} /> },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Title */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-3">
          <Sparkles className="text-yellow-500" /> Майстер підключення кабінету
        </h1>
        <p className="mt-2 text-slate-400">Встановіть кабінет мешканців для вашого ОСББ/СТ за 4 простих кроки</p>
      </div>

      {/* Progress Stepper */}
      <div className="mb-10 flex items-center justify-between rounded-3xl border border-[#1e293b] bg-[#0f172a]/40 p-4 backdrop-blur-md">
        {steps.map((s, idx) => (
          <React.Fragment key={s.num}>
            <div className="flex flex-1 items-center gap-3 px-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl transition font-bold ${
                  step >= s.num
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-[#1e293b] text-slate-500"
                }`}
              >
                {s.icon}
              </div>
              <div className="hidden sm:block">
                <div className={`text-xs ${step >= s.num ? "text-slate-300 font-semibold" : "text-slate-500"}`}>Крок {s.num}</div>
                <div className={`text-sm ${step === s.num ? "text-white font-bold" : "text-slate-400"}`}>{s.label}</div>
              </div>
            </div>
            {idx < steps.length - 1 && <div className="h-[2px] w-8 bg-[#1e293b]" />}
          </React.Fragment>
        ))}
      </div>

      {/* Error / Success Alerts */}
      {error && <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-400 text-sm font-medium">{error}</div>}
      {success && <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-400 text-sm font-medium">{success}</div>}

      {/* Wizard Step Card */}
      <div className="rounded-3xl border border-[#1e293b] bg-[#0f172a]/60 p-8 shadow-2xl backdrop-blur-xl min-h-[300px] flex flex-col justify-between">
        
        {/* Step 1 Content */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Крок 1: Перевірка даних вашої організації</h2>
            <p className="text-slate-400 mb-6">Будь ласка, переконайтеся, що дані вашого ОСББ введені вірно. Ці реквізити будуть використовуватися для формування квитанцій.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#090d16] p-4 border border-[#1e293b]">
                <div className="text-xs text-slate-500">Назва організації</div>
                <div className="text-lg font-bold text-slate-200 mt-1">{profile?.name}</div>
              </div>
              <div className="rounded-2xl bg-[#090d16] p-4 border border-[#1e293b]">
                <div className="text-xs text-slate-500">Код ЄДРПОУ / ЗКПО</div>
                <div className="text-lg font-bold text-slate-200 mt-1">{profile?.tax_id}</div>
              </div>
              <div className="rounded-2xl bg-[#090d16] p-4 border border-[#1e293b] sm:col-span-2">
                <div className="text-xs text-slate-500">Юридична адреса</div>
                <div className="text-lg font-bold text-slate-200 mt-1">{profile?.address || "Не вказано"}</div>
              </div>
              <div className="rounded-2xl bg-[#090d16] p-4 border border-[#1e293b] sm:col-span-2">
                <div className="text-xs text-slate-500">Банківський рахунок (IBAN)</div>
                <div className="text-lg font-bold text-slate-200 mt-1">{profile?.iban || "Не підключено"}</div>
              </div>
            </div>
            {!profile?.iban && (
              <div className="mt-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-amber-400 text-sm">
                <b>Увага:</b> Реквізити IBAN відсутні. Ви можете активувати кабінет, але мешканці не бачитимуть вашого розрахункового рахунку в квитанціях доки ви не вкажете його в профілі організації.
              </div>
            )}
          </div>
        )}

        {/* Step 2 Content */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Крок 2: Адреса кабінету та колірна схема</h2>
            <p className="text-slate-400 mb-6">Налаштуйте унікальну URL-адресу, за якою мешканці зможуть заходити до кабінету, та виберіть колір інтерфейсу.</p>
            
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-slate-300">Ваша URL-адреса для мешканців</label>
              <div className="flex items-center rounded-2xl border border-[#1e293b] bg-[#090d16] px-4 py-3">
                <span className="text-slate-500 select-none">unitax.pro/osbb/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ""))}
                  className="flex-1 bg-transparent text-white outline-none font-semibold ml-1"
                  placeholder="my-osbb-slug"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">Дозволені лише малі латинські літери, цифри та дефіс.</p>
              <button
                type="button"
                onClick={handleGenerateSlug}
                disabled={isCheckingSlug}
                className="mt-3 text-sm font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1.5"
              >
                {isCheckingSlug ? "Генерація..." : "Згенерувати автоматично"}
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-300">Колір кабінету</label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={colorTheme}
                  onChange={(e) => setColorTheme(e.target.value)}
                  className="h-12 w-20 cursor-pointer rounded-xl border border-[#1e293b] bg-transparent p-1"
                />
                <div>
                  <div className="font-semibold text-slate-200">Виберіть бренд-колір вашого ОСББ</div>
                  <div className="text-xs text-slate-500">Цей колір буде використано для кнопок та елементів інтерфейсу кабінету.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 Content */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Крок 3: Налаштування прийому платежів Monobank</h2>
            <p className="text-slate-400 mb-6">Підключіть свій мерчант-рахунок Monobank, щоб мешканці могли оплачувати квитанції онлайн, а кошти надходили безпосередньо на ваш рахунок ОСББ.</p>
            
            <div className="rounded-3xl border border-[#1e293b] bg-[#090d16] p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-white">
                <CreditCard size={32} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Мерчант-інтеграція з Monobank</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                Авторизуйте UniTax в кабінеті ФОП/підприємства Monobank. Наш додаток отримає токен автоматично. Токен зберігається у зашифрованому вигляді за стандартом AES-256.
              </p>
              {profile?.is_member_module_active || profile?.mono_api_token ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle size={16} /> Monobank успішно підключено
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectMonobank}
                  className="rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                >
                  Підключити Monobank Merchant
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 4 Content */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Крок 4: Активація та огляд</h2>
            <p className="text-slate-400 mb-6">Все готово до підключення кабінету мешканця. Ознайомтеся з підсумком та підтвердіть активацію.</p>
            
            <div className="rounded-3xl border border-[#1e293b] bg-[#090d16] p-6 mb-6">
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between border-b border-[#1e293b] pb-2">
                  <span className="text-slate-500">Назва організації</span>
                  <span className="font-semibold text-white">{profile?.name}</span>
                </div>
                <div className="flex justify-between border-b border-[#1e293b] pb-2">
                  <span className="text-slate-500">Адреса кабінету</span>
                  <span className="font-semibold text-blue-400">unitax.pro/osbb/{slug}</span>
                </div>
                <div className="flex justify-between border-b border-[#1e293b] pb-2">
                  <span className="text-slate-500">Бренд-колір</span>
                  <span className="font-semibold flex items-center gap-1.5 text-white">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorTheme }} /> {colorTheme}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Онлайн оплата (Monobank)</span>
                  <span className={`font-semibold ${profile?.mono_api_token || profile?.is_member_module_active ? "text-emerald-400" : "text-rose-400"}`}>
                    {profile?.mono_api_token || profile?.is_member_module_active ? "Підключено" : "Не підключено"}
                  </span>
                </div>
              </div>
            </div>

            {profile?.is_member_module_active ? (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
                <CheckCircle className="text-emerald-500 mx-auto mb-3" size={48} />
                <h3 className="text-xl font-bold text-white mb-2">Кабінет успішно активовано!</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Поділіться цим посиланням з мешканцями для входу та передачі показань:
                </p>
                <div className="bg-[#090d16] p-3 rounded-xl font-mono text-blue-400 select-all border border-[#1e293b] mb-4">
                  https://unitax.pro/osbb/{slug}
                </div>
                <p className="text-xs text-slate-500">
                  Мешканці зможуть зареєструватися, ввівши свій номер квартири та вказавши новий пароль. Усі нові реєстрації будуть з'являтися у вашій вкладці "Модерація мешканців".
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleActivate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
              >
                {loading ? "Активація..." : "Активувати кабінет мешканців"}
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between border-t border-[#1e293b] pt-6">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1 || profile?.is_member_module_active}
            className="flex items-center gap-1.5 rounded-xl border border-[#1e293b] bg-transparent px-4 py-2.5 font-semibold text-slate-400 hover:text-white disabled:opacity-30"
          >
            <ArrowLeft size={16} /> Назад
          </button>
          
          {step < 4 && (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20"
            >
              Далі <ArrowRight size={16} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
