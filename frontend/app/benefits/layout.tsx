import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Переваги та послуги платформи UniTax — Чому обирають нас",
  description: "Дізнайтеся про переваги податкового асистента UniTax. Автоматизація обліку та звітів для ФОП, рішення для ОСББ, садівничих товариств (СТ), авто-розсилка квитанцій та кабінет бухгалтера.",
  keywords: "UniTax переваги, податковий асистент ФОП, автоматизація ОСББ, автоматизація СТ, розсилка квитанцій, кабінет бухгалтера, ШІ консалтинг",
  robots: "index, follow",
  openGraph: {
    title: "Переваги та послуги платформи UniTax",
    description: "Сучасний сервіс автоматизації бухгалтерії, звітів, квитанцій та податків для бізнесу в Україні.",
    type: "website",
    url: "https://www.unitax.pro/benefits",
  }
};

export default function BenefitsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
