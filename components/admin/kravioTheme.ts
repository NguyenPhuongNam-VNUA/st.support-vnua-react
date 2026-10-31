import { createTheme } from '@mui/material/styles';

// Tokens from docs/UI_mau (Kravio). Component shapes live in globals.css under `.kravio`.
const kravioTheme = createTheme({
  palette: {
    primary: { main: '#1f2937', dark: '#111827', light: '#37475d', contrastText: '#ffffff' },
    secondary: { main: '#4b5563', contrastText: '#ffffff' },
    success: { main: '#059669' },
    error: { main: '#ef4444' },
    warning: { main: '#4b5563', contrastText: '#ffffff' },
    info: { main: '#4b5563', contrastText: '#ffffff' },
    text: { primary: '#1f2937', secondary: '#6b7280', disabled: '#9ca3af' },
    divider: '#e5e7eb',
    background: { default: '#f8f8f8', paper: '#ffffff' },
    action: { hover: 'rgba(0,0,0,0.04)', selected: 'rgba(0,0,0,0.06)' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize: 13,
    fontWeightBold: 600,
    h1: { fontWeight: 500 },
    h2: { fontWeight: 500 },
    h3: { fontWeight: 500 },
    h4: { fontWeight: 500, fontSize: '1.5rem' },
    h5: { fontWeight: 500, fontSize: '1.25rem' },
    h6: { fontWeight: 500, fontSize: '1rem' },
    subtitle1: { fontWeight: 500, fontSize: '0.875rem' },
    subtitle2: { fontWeight: 500, fontSize: '0.8125rem' },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.8125rem' },
    caption: { fontSize: '0.75rem' },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { defaultProps: { elevation: 0 } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiTextField: { defaultProps: { size: 'small' } },
  },
});

export default kravioTheme;
