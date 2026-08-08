import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ST - Care | Trợ Lý AI Chatbot Học Viện Nông Nghiệp Việt Nam (VNUA)',
  description:
    'ST - Care là hệ thống AI Chatbot thông minh hỗ trợ giải đáp 24/7 về tuyển sinh, quy chế đào tạo, học phí, lịch học và thông tin sinh viên tại Học viện Nông nghiệp Việt Nam (VNUA).',
  keywords: [
    'ST - Care',
    'ST Care VNUA',
    'VNUA',
    'Học viện Nông nghiệp Việt Nam',
    'Chatbot VNUA',
    'AI Support VNUA',
    'Tuyển sinh VNUA',
    'Học phí VNUA',
    'Quy chế đào tạo VNUA',
    'Tư vấn học tập VNUA',
    'Hỗ trợ sinh viên VNUA',
  ],
  authors: [{ name: 'ST-Support Team - VNUA' }],
  creator: 'Học viện Nông nghiệp Việt Nam',
  publisher: 'Học viện Nông nghiệp Việt Nam',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'ST - Care | Trợ Lý AI Chatbot Học Viện Nông Nghiệp Việt Nam',
    description:
      'Trải nghiệm hệ thống tư vấn AI ST - Care mượt mà chuẩn Apple interface cho sinh viên Học viện Nông nghiệp Việt Nam.',
    url: 'https://vnua.edu.vn',
    siteName: 'ST - Care VNUA AI Support',
    images: [
      {
        url: '/background.jpg',
        width: 1920,
        height: 1080,
        alt: 'Tòa nhà trung tâm Học viện Nông nghiệp Việt Nam (VNUA)',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ST - Care | Trợ Lý AI Chatbot Học Viện Nông Nghiệp Việt Nam',
    description:
      'Hỗ trợ tư vấn tuyển sinh và học tập 24/7 với ST - Care AI Chatbot Học viện Nông nghiệp Việt Nam.',
    images: ['/background.jpg'],
  },
  alternates: {
    canonical: '/chatbot',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ST - Care - VNUA AI Chatbot Assistant',
  operatingSystem: 'All',
  applicationCategory: 'EducationalApplication',
  description:
    'Hệ thống AI Chatbot ST - Care hỗ trợ học tập, tuyển sinh và quy chế đào tạo tại Học viện Nông nghiệp Việt Nam (VNUA).',
  provider: {
    '@type': 'EducationalOrganization',
    name: 'Học viện Nông nghiệp Việt Nam',
    alternateName: 'Vietnam National University of Agriculture',
    url: 'https://vnua.edu.vn',
    logo: 'https://vnua.edu.vn/public/st.png',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Trâu Quỳ, Gia Lâm',
      addressLocality: 'Hà Nội',
      addressCountry: 'VN',
    },
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'VND',
  },
};

export default function ChatbotLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
