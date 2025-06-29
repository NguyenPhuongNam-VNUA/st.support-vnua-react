import { alpha } from '@mui/material/styles';
export const Backdrop = theme => {
  const low = alpha(theme.palette.grey[600], 0.8);
  const high = alpha(theme.palette.grey[700], 0.4);
  return {
    styleOverrides: {
      root: {
        backgroundColor: 'transparent',
        background: [alpha(theme.palette.grey[900], 0.5), `linear-gradient(90deg, ${low} 0%, ${high} 100%)`, `-moz-linear-gradient(90deg, ${low} 0%, ${high} 100%)`, `-webkit-linear-gradient(90deg, ${low} 0%, ${high} 100%)`]
      },
      invisible: {
        background: 'transparent'
      }
    }
  };
};