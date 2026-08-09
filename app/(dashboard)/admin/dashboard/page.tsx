'use client';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';

import ConversationCard from '@/components/dashboard/cards/ConversationCard';
import BarCard from '@/components/dashboard/cards/BarCard';
import LineCard from '@/components/dashboard/cards/LineCard';
import AnswerPieChart from '@/components/dashboard/charts/AnswerPieChart';
import EmbedPieChart from '@/components/dashboard/charts/EmbedPieChart';

export default function AdminDashboardPage() {
  return (
    <Box>
      <Typography 
        variant="h4" 
        fontWeight={800} 
        mb={3}
        sx={{ color: '#2563eb', letterSpacing: '-0.02em' }}
      >
        Dashboard <span style={{ color: '#dc2626' }}>•</span>
      </Typography>

      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <AnswerPieChart total={100} doneAnswer={85} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <EmbedPieChart total={50} doneEmbed={42} />
        </Grid>
      </Grid>

      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <BarCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <LineCard />
        </Grid>
      </Grid>

      <Box mb={4}>
        <ConversationCard />
      </Box>
    </Box>
  );
}
