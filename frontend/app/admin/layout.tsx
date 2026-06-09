"use client";

import React from "react";
import "@/app/globals.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#090d16] text-[#f1f5f9] font-sans antialiased">
      {children}
    </div>
  );
}
