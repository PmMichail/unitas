import type { Metadata } from "next";
import React from "react";
import ClientLayout from "./ClientLayout";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "UniTax — Податковий асистент для ФОП та компаній в Україні",
  description: "Сучасна система автоматизації податків, звітності, інвойсингу та ШІ-консалтингу для підприємців в Україні. Зручний кабінет платника, авторозрахунки та інтеграція з ДПС.",
  keywords: "UniTax, податки, податковий асистент, ФОП, звітність, декларація, ДПС, рахунки, інвойси, податки України, ШІ-асистент",
  robots: "index, follow",
  openGraph: {
    title: "UniTax — Розумний податковий асистент",
    description: "Автоматизуйте податкову звітність та облік для ФОП. Сплачуйте податки, генеруйте рахунки та отримуйте консультації від ШІ-асистента.",
    type: "website",
    url: "https://www.unitax.pro",
  },
  twitter: {
    card: "summary_large_image",
    title: "UniTax — Податковий асистент для ФОП",
    description: "Автоматизація обліку, звітів та інвойсингу для бізнесу в Україні.",
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className="dark">
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
