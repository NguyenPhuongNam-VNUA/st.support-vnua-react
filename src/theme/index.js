import { createTheme } from '@mui/material/styles';
import componentsOverride from './components'; // Nếu có
import shadows from './shadows'; // Nếu có

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6950E8'
    },
    secondary: {
      main: '#FF8C00'
    }
  },
  typography: {
    fontFamily: "'Public Sans', sans-serif",
    body1: {
      fontSize: 16
    },
    body2: {
      fontSize: 14
    },
    h1: {
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 1.5
    },
    h2: {
      fontSize: 40,
      fontWeight: 700,
      lineHeight: 1.5
    },
    h3: {
      fontSize: 36,
      fontWeight: 700,
      lineHeight: 1.5
    },
    h4: {
      fontSize: 32,
      fontWeight: 600
    },
    h5: {
      fontSize: 28,
      fontWeight: 600,
      lineHeight: 1
    },
    h6: {
      fontSize: 18,
      fontWeight: 500
    }
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536
    }
  }
});

// Nếu bạn có override thì giữ lại
theme.components = componentsOverride?.(theme);
theme.shadows = shadows?.(theme);

export default theme;
