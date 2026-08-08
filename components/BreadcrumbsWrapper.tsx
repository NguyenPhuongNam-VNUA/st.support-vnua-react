'use client';

import { Breadcrumbs, Typography, Link as MuiLink } from '@mui/material';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import HomeIcon from '@mui/icons-material/Home';

const labelMap = {
    admin: <HomeIcon fontSize="small" />,
    add: 'Thêm câu hỏi',
    edit: 'Chỉnh sửa câu hỏi',
    questions: 'Danh sách câu hỏi',
    documents: 'Danh sách tài liệu',
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
          <Typography color="text.primary" key={to}>
            {label}
          </Typography>
        ) : (
          <MuiLink key={to} underline="hover" color="inherit" component={Link} href={to}>
            {label}
          </MuiLink>
        );
      })}
    </Breadcrumbs>
  );
}
