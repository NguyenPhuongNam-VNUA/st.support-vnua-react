'use client';

import { Box, Typography } from '@mui/material';
import ConversationCard from '@/components/dashboard/cards/ConversationCard';
import { CartoonHistoryClockArrowIcon } from '@/components/icons/SidebarIcons';

export default function DetailedConversationsPage() {
  return (
    <Box p={1}>
      <Box mb={3.5} display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" alignItems="center" gap={2}>
          <CartoonHistoryClockArrowIcon
            size={42}
            className="text-[#0d8a4f] flex-shrink-0 transition-transform hover:scale-105"
          />
          <Box>
            <Typography
              variant="h5"
              fontWeight={900}
              sx={{ color: '#0d8a4f', letterSpacing: '-0.02em', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
            >
              Lịch sử hội thoại
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Tra cứu log thực tế giữa người dùng và AI Agent từ Supabase PostgreSQL.
            </Typography>
          </Box>
        </Box>
      </Box>

      <ConversationCard noCardContainer />
    </Box>
  );
}
