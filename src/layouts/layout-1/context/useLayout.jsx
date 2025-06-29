import { use } from 'react';
import { LayoutContext } from './layoutContext';
export default function useLayout() {
  const context = use(LayoutContext);

  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }

  return context;
}