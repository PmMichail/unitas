"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#fafbfd] dark:bg-[#090d16] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
        <p className="mt-3 text-xs text-slate-400 font-semibold">Перенаправлення до кабінету UniTax...</p>
      </div>
    </div>
  );
}
