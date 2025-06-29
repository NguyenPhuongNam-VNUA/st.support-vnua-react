import { Breadcrumbs, Typography, Link as MuiLink } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';

// Map từ segment => label
const labelMap = {
    admin: <HomeIcon fontSize="small" />,
    add: 'Thêm câu hỏi',
    edit: 'Chỉnh sửa câu hỏi',
    questions: 'Danh sách câu hỏi',
    documents: 'Danh sách tài liệu',
};

export default function BreadcrumbsWrapper() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  return (
    <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
      {pathnames.map((value, index) => {
        const isNumeric = !isNaN(value);
        if (isNumeric) return null; // Bỏ qua id

        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const label = labelMap[value] || decodeURIComponent(value);

        const isLast = index === pathnames.length - 1;

        // Nếu là 'edit' thì KHÔNG được click vì route /edit không tồn tại
        const isNonClickable = value === 'edit';

        return isLast || isNonClickable ? (
          <Typography color="text.primary" key={to}>
            {label}
          </Typography>
        ) : (
          <MuiLink key={to} underline="hover" color="inherit" component={Link} to={to}>
            {label}
          </MuiLink>
        );
      })}
    </Breadcrumbs>
  );
}
