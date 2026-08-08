'use client';

import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from '@/theme';
import { AuthProvider } from '@/contexts/AuthContext';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
