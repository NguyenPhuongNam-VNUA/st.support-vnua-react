import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme';
import { AuthProvider } from '@/contexts/AuthContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
        <AuthProvider>
          <App />
        </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
