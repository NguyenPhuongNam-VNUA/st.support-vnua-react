import { styled } from '@mui/material/styles';

export const Text = styled('div')(({ theme }) => ({
  fontSize: 14,
  marginLeft: '1.5rem',
  padding: '0.6rem 1rem',
  borderRadius: '0px 1rem 1rem 1rem',
  backgroundColor: theme.palette.grey[50],
  maxWidth: 'fit-content',
  whiteSpace: 'pre-wrap', // Giữ nguyên xuống dòng và khoảng trắng
  wordBreak: 'break-word', // Tự động xuống dòng khi text quá dài
  overflowWrap: 'break-word', // Đảm bảo từ dài không bị tràn
}));