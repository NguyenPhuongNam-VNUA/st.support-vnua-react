import { Outlet } from 'react-router-dom'; 
import { Box } from '@mui/material';

// CUSTOM COMPONENTS
import DashboardHeader from './components/DashboardHeader';
import DashboardSidebar from './components/DashboardSidebar';
import LayoutBodyWrapper from './components/LayoutBodyWrapper';

import LayoutProvider from './context/layoutContext';
import BreadcrumbsWrapper from '@/components/BreadcrumbsWrapper';

export default function DashboardLayoutV1() {
  return (
    <LayoutProvider>
      <DashboardSidebar />

      <LayoutBodyWrapper>
        <DashboardHeader />

        <Box px={3}>
          <BreadcrumbsWrapper />
        </Box>
        <Outlet />

      </LayoutBodyWrapper>
    </LayoutProvider>
  );
}
