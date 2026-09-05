'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';

import AgentStatusHeader from '@/components/dashboard/AgentStatusHeader';
import AgentQualityMetrics from '@/components/dashboard/AgentQualityMetrics';
import ConversationHeatmap from '@/components/dashboard/ConversationHeatmap';
import ConversationCard from '@/components/dashboard/cards/ConversationCard';
import BarCard from '@/components/dashboard/cards/BarCard';
import LineCard from '@/components/dashboard/cards/LineCard';

export default function AdminDashboardPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeDrillDown, setActiveDrillDown] = useState<string | null>(null);

  const handleDrillDown = (filterType: string) => {
    setActiveDrillDown(filterType);
    const element = document.getElementById('conversation-logs-table');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleHeatmapSlotSelect = (day: string, hour: number) => {
    handleDrillDown(`slot_${day}_${hour}h`);
  };

  return (
    <Box>
      {/* 2.1 Command Center Header with Global Time Filter & Server Health */}
      <AgentStatusHeader
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onDrillDown={handleDrillDown}
      />

      {/* Quality Metrics & Top Unanswered Questions */}
      <AgentQualityMetrics
        onDrillDownFallback={() => handleDrillDown('not_found')}
      />

      {/* 24h x 7d Conversation Heatmap Timeline */}
      <ConversationHeatmap onSelectSlot={handleHeatmapSlotSelect} />

      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <BarCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <LineCard />
        </Grid>
      </Grid>

      {/* Interactive Conversation Log Table */}
      <Box mb={4} id="conversation-logs-table">
        <ConversationCard
          activeFilter={activeDrillDown}
          timeRange={timeRange}
          startDate={startDate}
          endDate={endDate}
        />
      </Box>
    </Box>
  );
}
