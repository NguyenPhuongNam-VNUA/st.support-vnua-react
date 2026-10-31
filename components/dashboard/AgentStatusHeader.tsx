import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import statsApi, { SystemStats } from '@/api/admin/statsApi';

interface AgentStatusHeaderProps {
  timeRange: string;
  setTimeRange: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  onDrillDown?: (filter: string) => void;
  /** Rendered under the KPI row in the left column. */
  children?: React.ReactNode;
  /** Right column (e.g. latest updates), beside KPIs on wide screens. */
  aside?: React.ReactNode;
}

const RANGES = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7d', label: '7 ngày' },
  { id: '30d', label: '30 ngày' },
  { id: 'custom', label: 'Tuỳ chọn' },
];

const hoverShadow =
  'group-hover/kpi:-translate-y-px group-hover/kpi:shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]';

interface KpiProps {
  title: string;
  value: React.ReactNode;
  note: React.ReactNode;
  noteTone?: 'success' | 'destructive' | 'muted';
  hint: string;
  delay: number;
  onClick?: () => void;
}

// Kravio KPI tile: muted shell + title, white panel with value and a toned note line.
function Kpi({ title, value, note, noteTone = 'success', hint, delay, onClick }: KpiProps) {
  const tone = noteTone === 'success' ? 'text-[#059669]' : noteTone === 'destructive' ? 'text-[#ef4444]' : 'text-[#6b7280]';
  const Tag = onClick ? 'button' : 'section';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={title}
      className="group/kpi k-rise relative flex h-[140px] min-w-0 flex-1 flex-col items-start overflow-clip rounded-xl bg-[#f6f6f6] p-1 text-left shadow-[inset_0_0_0_0.8px_#e5e7eb] outline-none focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative flex w-full shrink-0 items-center justify-between p-2">
        <h2 className="truncate whitespace-nowrap text-sm font-medium leading-none text-[#4b5563]">{title}</h2>
      </div>
      <div className={`relative flex min-h-px w-full flex-1 items-end justify-between rounded-[10px] border-[0.8px] border-[#e5e7eb] bg-white px-3 pb-3 transition-[box-shadow,transform] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${hoverShadow}`}>
        <div className="flex min-w-0 flex-col items-start gap-3 whitespace-nowrap leading-none">
          <p className="text-2xl font-medium text-[#1f2937]">{value}</p>
          <p className="flex min-w-0 items-center gap-1.5">
            <span className={`text-xs font-medium ${tone}`}>{note}</span>
            <span className="truncate text-[13px] text-[#6b7280]">{hint}</span>
          </p>
        </div>
      </div>
    </Tag>
  );
}

export default function AgentStatusHeader({
  timeRange,
  setTimeRange,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onDrillDown,
  children,
  aside,
}: AgentStatusHeaderProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      try {
        const res = await statsApi.getSystemStats();
        if (isMounted && res?.data) {
          setStats(res.data);
        }
      } catch (err) {
        console.warn('Không thể tải chỉ số hệ thống:', err);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 15000); // 15s refresh
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const status = stats?.agent_status;
  const dash = loadingStats ? '—' : null;
  const activeIndex = Math.max(0, RANGES.findIndex((r) => r.id === timeRange));

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="k-rise flex flex-col items-start gap-4 leading-none">
          <h1 className="flex min-h-6 flex-wrap items-center gap-[0.25em] text-2xl font-medium text-[#1f2937]">
            Xin chào, {user?.full_name || 'Admin VNUA'}
            <span aria-hidden="true" className="k-wave">👋</span>
          </h1>
          <p className="text-[13px] text-[#4b5563]">Đây là tổng quan mới nhất về hoạt động hỏi đáp của AI Agent khoa CNTT.</p>
        </div>

        <div className="k-rise flex flex-col items-end gap-2" style={{ animationDelay: '60ms' }}>
          <div role="radiogroup" aria-label="Khoảng thời gian" className="relative flex items-start gap-2">
            <span
              aria-hidden="true"
              className="absolute top-0 h-8 w-[76px] rounded-lg border border-[#1f2937] bg-[linear-gradient(180deg,#37475d_0%,#1f2937_64.697%)] transition-[left] duration-300 ease-[cubic-bezier(.16,1,.3,1)]"
              style={{ left: activeIndex * 84 }}
            />
            {RANGES.map((r) => {
              const on = r.id === timeRange;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTimeRange(r.id)}
                  className={`relative z-10 flex h-8 w-[76px] items-center justify-center rounded-lg border-[0.8px] text-xs font-medium leading-none outline-none transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40 ${
                    on ? 'border-transparent bg-transparent text-white' : 'border-[#e5e7eb] bg-white text-[#4b5563] hover:border-[#d1d5db] hover:bg-[#fcfcfc]'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {timeRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#4b5563]">
              <Calendar size={16} strokeWidth={1.5} className="text-[#4b5563]" />
              {[startDate, endDate].map((val, i) => (
                <React.Fragment key={i}>
                  {i === 1 && <span>đến</span>}
                  <input
                    type="date"
                    value={val}
                    aria-label={i === 0 ? 'Từ ngày' : 'Đến ngày'}
                    onChange={(e) => (i === 0 ? setStartDate(e.target.value) : setEndDate(e.target.value))}
                    className="h-8 rounded-lg border-[0.8px] border-[#e5e7eb] bg-white px-2.5 text-[13px] text-[#1f2937] outline-none transition-[border-color,box-shadow] hover:border-[#d1d5db] focus:border-[#9ca3af] focus:shadow-[0_0_0_3px_rgba(156,163,175,0.18)]"
                  />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full flex-col gap-4 min-[1400px]:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="Trạng thái AI Agent"
          delay={80}
          value={dash ?? (status === 'online' ? 'Trực tuyến' : status === 'degraded' ? 'Dự phòng' : 'Ngoại tuyến')}
          noteTone={status === 'online' ? 'success' : 'destructive'}
          note={status === 'online' ? '● Healthy' : status === 'degraded' ? '● Degraded' : '● Offline'}
          hint={status === 'online' ? 'RAG pipeline & model' : 'Core AI không ổn định'}
        />
        <Kpi
          title="Độ trễ trung bình"
          delay={150}
          value={dash ?? (stats?.latency_ms && stats.latency_ms > 0 ? `${stats.latency_ms} ms` : 'N/A')}
          noteTone={stats?.latency_ms && stats.latency_ms < 500 ? 'success' : 'destructive'}
          note={stats?.latency_ms && stats.latency_ms < 500 ? 'Nhanh' : 'Chậm'}
          hint="roundtrip tới Core AI"
        />
        <Kpi
          title="Phiên đang hoạt động"
          delay={220}
          onClick={onDrillDown ? () => onDrillDown('active') : undefined}
          value={dash ?? (stats?.active_sessions ?? 0).toLocaleString('vi-VN')}
          noteTone="muted"
          note={`${(stats?.total_conversations ?? 0).toLocaleString('vi-VN')}`}
          hint="tổng hội thoại"
        />
        <Kpi
          title="Bộ nhớ Vector DB"
          delay={290}
          value={dash ?? (stats?.vector_chunks ?? 0).toLocaleString('vi-VN')}
          noteTone="muted"
          note={`${stats?.active_documents ?? 0} tài liệu`}
          hint="chunks đã embed"
        />
      </div>
      {children}
      </div>
      {aside}
      </div>
    </div>
  );
}
