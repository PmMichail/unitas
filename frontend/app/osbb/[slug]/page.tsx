"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function OSBBRootPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params.slug || "");

  useEffect(() => {
    if (slug) {
      router.replace(`/osbb/${slug}/login`);
    }
  }, [slug, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}
