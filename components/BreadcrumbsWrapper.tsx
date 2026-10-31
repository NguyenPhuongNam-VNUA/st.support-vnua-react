'use client';

import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const labelMap: Record<string, string> = {
  admin: 'Tổng quan',
  dashboard: 'Dashboard',
  add: 'Thêm câu hỏi',
  edit: 'Chỉnh sửa câu hỏi',
  questions: 'Quản lý câu hỏi',
  documents: 'Thư viện tài liệu RAG',
  training: 'Huấn luyện Agent',
  settings: 'Cấu hình Agent',
  conversations: 'Lịch sử hội thoại',
  accounts: 'Quản lý tài khoản',
  import: 'Import từ Excel',
};

// Kravio breadcrumb: muted links, small chevron, current page in medium foreground.
export default function BreadcrumbsWrapper() {
  const pathname = usePathname() || '';
  const parts = pathname.split('/').filter(Boolean);
  const crumbs = parts
    .map((value, index) => ({
      value,
      href: value === 'admin' ? '/admin/dashboard' : `/${parts.slice(0, index + 1).join('/')}`,
      label: labelMap[value] || decodeURIComponent(value),
    }))
    .filter((c) => isNaN(Number(c.value)));

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-4">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <Fragment key={c.href + i}>
            {i > 0 && (
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none" aria-hidden="true" className="shrink-0">
                <path d="M1 1L5 5L1 9" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {isLast || c.value === 'edit' ? (
              <span aria-current={isLast ? 'page' : undefined} className="truncate whitespace-nowrap text-sm font-medium leading-none text-[#1f2937]">
                {c.label}
              </span>
            ) : (
              <Link
                href={c.href}
                className="whitespace-nowrap rounded-md text-sm leading-none text-[#6b7280] outline-none transition-colors hover:text-[#1f2937] focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40"
              >
                {c.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
