import React from "react";
import "./globals.css";
import ClientProviders from "./ClientProviders";
import { Inter, Montserrat } from "next/font/google";

// Admin (Kravio skin) font; only applied under .kravio
const inter = Inter({
  subsets: ["vietnamese", "latin"],
  display: "swap",
  variable: "--font-inter",
});

const montserrat = Montserrat({
  subsets: ["vietnamese", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-montserrat",
});

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: "ST - Care | Khoa CNTT VNUA",
  description:
    "Hệ thống hỗ trợ sinh viên VNUA - AI RAG Chatbot & Quản lý tri thức",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${montserrat.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className={montserrat.className} suppressHydrationWarning>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
