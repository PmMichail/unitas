import type { Metadata } from "next";
import React from "react";
import ClientLayout from "./ClientLayout";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "UniTax — Податковий асистент для ФОП та компаній в Україні",
  description: "Сучасна система автоматизації податків, звітності, інвойсингу та ШІ-консалтингу для підприємців в Україні. Зручний кабінет платника, авторозрахунки та інтеграція з ДПС.",
  manifest: "/manifest.json",
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
    <html lang="uk" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18255140291"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18255140291');
          `
        }} />
        {/* Event snippet for Просмотр страницы conversion page */}
        <script dangerouslySetInnerHTML={{
          __html: `
            gtag('event', 'conversion', {
                'send_to': 'AW-18255140291/RQYLCLLjrcIcEMOr3YBE',
                'value': 1.0,
                'currency': 'UAH'
            });
          `
        }} />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
