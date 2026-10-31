'use client';

import { useEffect, useMemo, useState } from 'react';

import AgentStatusHeader from '@/components/dashboard/AgentStatusHeader';
import AgentQualityMetrics from '@/components/dashboard/AgentQualityMetrics';
import ConversationHeatmap from '@/components/dashboard/ConversationHeatmap';
import ConversationCard from '@/components/dashboard/cards/ConversationCard';
import BarCard from '@/components/dashboard/cards/BarCard';
import VolumeTrendCard from '@/components/dashboard/VolumeTrendCard';
import LatestUpdatesCard from '@/components/dashboard/LatestUpdatesCard';
import conversationApi from '@/api/chatbot/conversationApi';
import { inRange, previousRange, resolveDateRange } from '@/lib/dashboard/time-range';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function AdminDashboardPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeDrillDown, setActiveDrillDown] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Memoized so cards that refetch on range change do not loop on a fresh `now` every render.
  const range = useMemo(() => resolveDateRange(timeRange, startDate, endDate), [timeRange, startDate, endDate]);

  // One fetch for every card: the selected window, the previous window (trend delta)
  // and the last 7 days (latest updates card has its own today/yesterday/week tabs).
  useEffect(() => {
    let alive = true;
    const prev = previousRange(range);
    const weekStart = new Date(Date.now() - 7 * DAY_MS);
    const fetchFrom = prev?.from ? new Date(Math.min(prev.from.getTime(), weekStart.getTime())) : null;
    setLogsLoading(true);
    conversationApi
      .getAll({ from: fetchFrom?.toISOString(), to: range.to.toISOString(), limit: 1000 })
      .then((res: any) => alive && setLogs(Array.isArray(res?.data) ? res.data : []))
      .catch((err) => console.warn('Lỗi tải hội thoại cho dashboard:', err))
      .finally(() => alive && setLogsLoading(false));
    return () => {
      alive = false;
    };
  }, [range]);

  const rangeLogs = useMemo(() => logs.filter((log) => inRange(log.created_at, range)), [logs, range]);

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
        <VolumeTrendCard logs={logs} range={range} loading={logsLoading} />
      </AgentStatusHeader>

      <AgentQualityMetrics
        logs={rangeLogs}
        range={range}
        loading={logsLoading}
        onDrillDownFallback={() => handleDrillDown('not_found')}
      />

      <ConversationHeatmap logs={rangeLogs} onSelectSlot={(day, hour) => handleDrillDown(`slot_${day}_${hour}h`)} />

      <BarCard logs={rangeLogs} loading={logsLoading} />

      <div id="conversation-logs-table">
        <ConversationCard activeFilter={activeDrillDown} timeRange={timeRange} startDate={startDate} endDate={endDate} />
      </div>
    </div>
  );
}
