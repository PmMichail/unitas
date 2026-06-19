"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Building2, Search, MapPin } from "lucide-react";

interface OsbbResult {
  id: number;
  name: string;
  address?: string;
  tax_id?: string;
  slug: string;
  color_theme?: string;
  organization_subtype?: string;
}

export default function OsbbSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OsbbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setError("");
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.searchOsbb(term);
        setResults(data.results || []);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Не вдалося виконати пошук");
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm text-white shadow-2xl border border-white/30">
            <Building2 size={40} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Кабінет мешканця UniTax</h1>
          <p className="mt-3 text-lg text-blue-100">Знайдіть ваше ОСББ або садове товариство за назвою, адресою чи ЄДРПОУ</p>
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md p-6 shadow-2xl">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-200" size={22} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Наприклад: Зелений Курган, вул. Шевченка, 12345678"
              className="w-full rounded-2xl border border-white/30 bg-white/20 py-4 pl-14 pr-4 text-base text-white placeholder-blue-200 outline-none transition focus:border-white focus:bg-white/30 focus:ring-4 focus:ring-white/20"
            />
          </div>

          {loading && <p className="mt-4 text-sm text-blue-100">Пошук...</p>}
          {error && <p className="mt-4 text-sm text-red-200">{error}</p>}

          <div className="mt-6 space-y-3">
            {results.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(`/osbb/${item.slug}/login`)}
                className="w-full rounded-2xl border border-white/20 bg-white/10 p-4 text-left transition hover:bg-white/20 hover:border-white/40"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-3 w-3 rounded-full shadow-lg" style={{ backgroundColor: item.color_theme || "#3b82f6" }} />
                  <div>
                    <div className="font-semibold text-white">{item.name}</div>
                    {item.address && (
                      <div className="mt-1 flex items-center gap-1 text-sm text-blue-100">
                        <MapPin size={14} /> {item.address}
                      </div>
                    )}
                    {item.tax_id && <div className="mt-1 text-xs text-blue-200">ЄДРПОУ: {item.tax_id}</div>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-blue-200">
            Сервіс доступний для ОСББ, садових товариств, громадських організацій та благодійних фондів
          </p>
        </div>
      </div>
    </main>
  );
}
