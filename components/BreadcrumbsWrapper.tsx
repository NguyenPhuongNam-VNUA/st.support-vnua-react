'use client';

import { Breadcrumbs, Typography, Link as MuiLink } from '@mui/material';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home } from 'lucide-react';

const labelMap: Record<string, any> = {
    admin: <Home className="w-4 h-4 inline-block text-[#006837]" />,
    dashboard: 'Dashboard Điều Hành',
    add: 'Thêm câu hỏi',
    edit: 'Chỉnh sửa câu hỏi',
    questions: 'Quản lý câu hỏi',
    documents: 'Thư viện tài liệu RAG',
    training: 'Huấn luyện Agent',
    settings: 'Cấu hình Agent',
    conversations: 'Lịch sử hội thoại',
    import: 'Import từ Excel'
};

export default function BreadcrumbsWrapper() {
  const pathname = usePathname() || '';
  const pathnames = pathname.split('/').filter(x => x);

  return (
    <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
      {pathnames.map((value, index) => {
        const isNumeric = !isNaN(Number(value));
        if (isNumeric) return null;

        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const label = labelMap[value] || decodeURIComponent(value);

        const isLast = index === pathnames.length - 1;
        const isNonClickable = value === 'edit';

        return isLast || isNonClickable ? (
          <Typography color="#006837" key={to} sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
            {label}
          </Typography>
        ) : (
          <MuiLink 
            key={to} 
            underline="hover" 
            color="#64748b" 
            component={Link} 
            href={to}
            sx={{ 
              fontSize: '0.8rem', 
              fontWeight: 600,
              '&:hover': { color: '#006837' } 
            }}
          >
            {label}
          </MuiLink>
        );
      })}
    </Breadcrumbs>
  );
}

