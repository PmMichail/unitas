"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Check, X, Search, RefreshCw, UserCheck, AlertCircle, ArrowLeft } from "lucide-react";

export default function MembersModerationPage() {
  const router = useRouter();
  const [profileId, setProfileId] = useState<number | null>(null);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadPendingMembers = async (pid: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getPendingMembers(pid);
      setPendingMembers(data || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не вдалося завантажити список заявок");
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
    loadPendingMembers(pid);
  }, []);

  const handleVerify = async (memberId: number) => {
    setError("");
    setSuccessMessage("");
    try {
      await api.verifyMember(memberId);
      setSuccessMessage("Мешканця успішно підтверджено!");
      if (profileId) loadPendingMembers(profileId);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не вдалося підтвердити мешканця");
    }
  };

  const handleReject = async (memberId: number) => {
    setError("");
    setSuccessMessage("");
    try {
      await api.rejectMember(memberId);
      setSuccessMessage("Заявку мешканця відхилено.");
      if (profileId) loadPendingMembers(profileId);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не вдалося відхилити заявку");
    }
  };

  const filteredMembers = pendingMembers.filter((m) => {
    const term = searchQuery.toLowerCase();
    return (
      (m.owner_name || "").toLowerCase().includes(term) ||
      (m.identifier || "").toLowerCase().includes(term) ||
      (m.phone || "").toLowerCase().includes(term) ||
      (m.email || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between border-b border-[#1e293b] pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e293b] bg-[#0f172a] text-slate-400 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Модерація мешканців</h1>
            <p className="mt-1 text-sm text-slate-400">Підтвердження заявок на доступ до кабінету мешканця</p>
          </div>
        </div>
        <button
          onClick={() => profileId && loadPendingMembers(profileId)}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-[#1e293b] bg-[#0f172a] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-[#1e293b] disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Оновити
        </button>
      </div>

      {/* Alert notifications */}
      {successMessage && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-400">
          <UserCheck size={20} />
          <div className="text-sm font-medium">{successMessage}</div>
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-400">
          <AlertCircle size={20} />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Main Content Card */}
      <div className="rounded-3xl border border-[#1e293b] bg-[#0f172a]/60 backdrop-blur-xl p-6 shadow-2xl">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук за квартирою, ім'ям, телефоном або email..."
            className="w-full rounded-2xl border border-[#1e293b] bg-[#090d16] py-3 pl-12 pr-4 text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Pending Requests List */}
        {loading ? (
          <div className="py-12 text-center text-slate-500">Завантаження...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            {searchQuery ? "Нічого не знайдено за вашим запитом" : "Немає нових заявок на модерацію"}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#1e293b]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#090d16] text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-4">Квартира</th>
                  <th className="p-4">Мешканець</th>
                  <th className="p-4">Контакти</th>
                  <th className="p-4">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-[#1e293b]/20">
                    <td className="p-4 font-semibold text-white">
                      {member.property_type || "кв."} № {member.identifier}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-200">{member.owner_name || "Не вказано"}</div>
                      <div className="text-xs text-slate-400">Рахунок: {member.account_number}</div>
                    </td>
                    <td className="p-4 text-slate-300">
                      <div>{member.phone || "Немає телефону"}</div>
                      <div className="text-xs text-slate-500">{member.email || "Немає email"}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerify(member.id)}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 font-semibold text-white hover:bg-emerald-500"
                        >
                          <Check size={16} /> Підтвердити
                        </button>
                        <button
                          onClick={() => handleReject(member.id)}
                          className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 font-semibold text-rose-400 hover:bg-slate-700"
                        >
                          <X size={16} /> Відхилити
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
