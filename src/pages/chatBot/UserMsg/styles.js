import { styled } from '@mui/material/styles';
export const Text = styled('div')(({
  theme
}) => ({
  fontSize: 14,
  color: 'white',
  textAlign: 'right',
  marginLeft: '2.5rem',
  padding: '0.6rem 1rem',
  borderRadius: '1rem 1rem 0px 1rem',
  backgroundColor: theme.palette.primary.main,
  maxWidth: 'fit-content',
}));