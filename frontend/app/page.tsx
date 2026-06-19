"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("telegram_id");
      if (savedId) {
        router.replace("/dashboard");
      } else {
        router.replace("/benefits");
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
        <p className="mt-3 text-xs text-slate-400 font-semibold font-sans">Завантаження UniTax...</p>
      </div>
    </div>
  );
}
