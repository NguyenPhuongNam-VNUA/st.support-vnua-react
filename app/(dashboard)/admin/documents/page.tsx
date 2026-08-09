'use client';

import Box from '@mui/material/Box';
import DocumentLifecycleView from '@/components/documents/DocumentLifecycleView';

export default function DocumentLibraryPage() {
  return (
    <Box p={1}>
      <DocumentLifecycleView />
    </Box>
  );
}
