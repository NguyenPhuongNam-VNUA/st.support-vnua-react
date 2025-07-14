import { styled } from '@mui/material/styles';
export const Text = styled('div')(({
  theme
}) => ({
  fontSize: 14,
  marginLeft: '1.5rem',
  padding: '0.6rem 1rem',
  borderRadius: '0px 1rem 1rem 1rem',
  backgroundColor: theme.palette.grey[100],
  maxWidth: 'fit-content',
}));