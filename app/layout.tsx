import React from 'react';
import './globals.css';
import ClientProviders from './ClientProviders';

export const metadata = {
  title: 'ST-Support VNUA',
  description: 'Hệ thống hỗ trợ sinh viên VNUA - AI RAG Chatbot & Quản lý tri thức',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
