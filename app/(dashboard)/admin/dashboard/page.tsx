'use client';

import { useEffect, useState } from 'react';

import AgentStatusHeader from '@/components/dashboard/AgentStatusHeader';
import AgentQualityMetrics from '@/components/dashboard/AgentQualityMetrics';
import ConversationHeatmap from '@/components/dashboard/ConversationHeatmap';
import ConversationCard from '@/components/dashboard/cards/ConversationCard';
import BarCard from '@/components/dashboard/cards/BarCard';
import VolumeTrendCard from '@/components/dashboard/VolumeTrendCard';
import LatestUpdatesCard from '@/components/dashboard/LatestUpdatesCard';
import conversationApi from '@/api/chatbot/conversationApi';

export default function AdminDashboardPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeDrillDown, setActiveDrillDown] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // One fetch shared by trend, latest updates and heatmap.
  useEffect(() => {
    let alive = true;
    conversationApi
      .getAll()
      .then((res: any) => alive && setLogs(Array.isArray(res?.data) ? res.data : []))
      .catch((err) => console.warn('Lỗi tải hội thoại cho dashboard:', err))
      .finally(() => alive && setLogsLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const handleDrillDown = (filterType: string) => {
    setActiveDrillDown(filterType);
    document.getElementById('conversation-logs-table')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <AgentStatusHeader
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onDrillDown={handleDrillDown}
        aside={<LatestUpdatesCard logs={logs} loading={logsLoading} />}
      >
        <VolumeTrendCard logs={logs} loading={logsLoading} />
      </AgentStatusHeader>

      <AgentQualityMetrics onDrillDownFallback={() => handleDrillDown('not_found')} />

      <ConversationHeatmap logs={logs} onSelectSlot={(day, hour) => handleDrillDown(`slot_${day}_${hour}h`)} />

      <BarCard />

      <div id="conversation-logs-table">
        <ConversationCard activeFilter={activeDrillDown} timeRange={timeRange} startDate={startDate} endDate={endDate} />
      </div>
    </div>
  );
}
