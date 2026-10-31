'use client';

import { useMemo, useState } from 'react';
import SectionCard from '@/components/admin/SectionCard';
import { DateRange, inRange, previousRange } from '@/lib/dashboard/time-range';

interface VolumeTrendCardProps {
  /** Logs covering `range` and, when available, the previous period of the same length. */
  logs: { created_at?: string }[];
  range: DateRange;
  loading?: boolean;
}

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_BARS = 15;

interface Bar {
  start: Date;
  label: string;
  tooltip: string;
  count: number;
}

// Hourly buckets for a single day, daily buckets up to MAX_BARS days, multi-day buckets beyond.
function buildBars(range: DateRange, times: number[]): Bar[] {
  const to = range.to.getTime();
  let from = range.from?.getTime() ?? (times.length ? Math.min(...times) : to - 7 * DAY_MS);
  const span = to - from;
  let size: number;
  let fixedCount: number | null = null;
  if (span <= DAY_MS) {
    // One day: always show the whole day in 2-hour slots, later slots stay empty.
    size = 2 * HOUR_MS;
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    from = d.getTime();
    fixedCount = 12;
  } else {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    from = d.getTime();
    size = Math.ceil((to - from) / DAY_MS / MAX_BARS) * DAY_MS;
  }
  const count = fixedCount ?? Math.max(1, Math.ceil((to - from) / size));
  const bars: Bar[] = Array.from({ length: count }, (_, i) => {
    const start = new Date(from + i * size);
    const ddmm = start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    if (size < DAY_MS) return { start, label: `${start.getHours()}h`, tooltip: `${start.getHours()}h–${start.getHours() + 2}h`, count: 0 };
    if (size === DAY_MS) {
      const label = count <= 7 ? DAY_LABELS[start.getDay()] : ddmm;
      return { start, label, tooltip: `${DAY_LABELS[start.getDay()]} ${ddmm}`, count: 0 };
    }
    return { start, label: ddmm, tooltip: `Từ ${ddmm} (${size / DAY_MS} ngày)`, count: 0 };
  });
  times.forEach((t) => {
    if (t < from || t > to) return;
    const i = Math.min(count - 1, Math.floor((t - from) / size));
    bars[i].count += 1;
  });
  return bars;
}

// Kravio "volume trend": total + delta vs previous period, gradient bars per time bucket.
export default function VolumeTrendCard({ logs, range, loading }: VolumeTrendCardProps) {
  const [active, setActive] = useState<number | null>(null);

  const { bars, total, delta } = useMemo(() => {
    const times = logs.filter((l) => l.created_at).map((l) => new Date(l.created_at as string).getTime());
    const current = times.filter((t) => inRange(new Date(t).toISOString(), range));
    const prevRange = previousRange(range);
    const prev = prevRange ? times.filter((t) => t >= prevRange.from!.getTime() && t < prevRange.to.getTime()).length : 0;
    return {
      bars: buildBars(range, current),
      total: current.length,
      delta: !prevRange || prev === 0 ? null : ((current.length - prev) / prev) * 100,
    };
  }, [logs, range]);

  const max = Math.max(4, ...bars.map((b) => b.count));
  const niceMax = Math.ceil(max / 4) * 4;
  const ticks = [4, 3, 2, 1, 0].map((i) => (niceMax / 4) * i);
  const shown = active ?? bars.length - 1;

  return (
    <SectionCard title="Lượt hội thoại" bodyClassName="px-3.5 pb-3.5 pt-4 gap-5" className="min-h-[404px]">
      <div className="flex items-end gap-3 whitespace-nowrap leading-none">
        <p className="text-[32px] font-medium text-[#1f2937]">{loading ? '—' : total.toLocaleString('vi-VN')}</p>
        <p className="flex items-center gap-1.5 pb-1">
          {delta !== null && (
            <span className={`text-xs font-medium ${delta >= 0 ? 'text-[#059669]' : 'text-[#ef4444]'}`}>
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </span>
          )}
          <span className="text-[13px] tracking-[-0.13px] text-[#6b7280]">so với kỳ trước</span>
        </p>
      </div>

      <div className="flex w-full flex-1 gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div
            role="group"
            tabIndex={0}
            aria-label="Lượt hội thoại theo thời gian. Dùng phím mũi tên trái phải để xem từng cột."
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setActive(Math.max(0, shown - 1));
              if (e.key === 'ArrowRight') setActive(Math.min(bars.length - 1, shown + 1));
            }}
            onMouseLeave={() => setActive(null)}
            className="relative h-[216px] w-full rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40"
          >
            {/* grid lines */}
            {ticks.map((t, i) => (
              <span key={t} className="pointer-events-none absolute left-0 w-full border-t border-dashed border-[#f2f2f3]" style={{ top: `${(i / 4) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end justify-around gap-[2%] px-[1%]">
              {bars.map((b, i) => {
                const on = i === shown;
                return (
                  <button
                    key={i}
                    type="button"
                    tabIndex={-1}
                    aria-label={`${b.tooltip}: ${b.count} hội thoại`}
                    onMouseEnter={() => setActive(i)}
                    className="relative h-full w-full max-w-[56px] outline-none"
                  >
                    {on && (
                      <span className="k-rise absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1f2937] px-2 py-1 text-[11px] font-medium leading-none text-white" style={{ bottom: `calc(${(b.count / niceMax) * 100}% + 8px)` }}>
                        {b.tooltip} : {b.count}
                      </span>
                    )}
                    <span
                      className="absolute bottom-0 left-0 w-full transition-[height] duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
                      style={{ height: `${Math.max(2, (b.count / niceMax) * 100)}%` }}
                    >
                      <span
                        className={`absolute inset-0 rounded-b-[4px] rounded-t-[8px] bg-gradient-to-b from-[#e6e6e6] to-[rgba(230,230,230,0.6)] shadow-[inset_0_0_0_0.444px_#d8d8d8,inset_0px_0px_0px_1px_white] transition-opacity duration-300 ${on ? 'opacity-0' : 'opacity-100'}`}
                      />
                      <span
                        className={`absolute inset-0 origin-bottom rounded-b-[4px] rounded-t-[8px] bg-[linear-gradient(180deg,#37475d_0%,#1f2937_64.697%)] shadow-[inset_0_0_0_0.44px_#1f2937,0px_2px_10px_0px_rgba(31,41,55,0.08)] transition-[opacity,transform] duration-300 ${on ? 'scale-y-100 opacity-100' : 'scale-y-[0.98] opacity-0'}`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p aria-live="polite" className="sr-only">
            {bars[shown] && `${bars[shown].tooltip}: ${bars[shown].count} hội thoại`}
          </p>
          <div className="flex justify-around px-[1%]" aria-hidden="true">
            {bars.map((b, i) => (
              <p key={i} className={`w-full max-w-[56px] text-center text-xs leading-none ${i === shown ? 'text-[#1f2937]' : 'text-[#9ca3af]'}`}>
                {b.label}
              </p>
            ))}
          </div>
        </div>
        <div className="flex h-[216px] flex-col justify-between text-right" aria-hidden="true">
          {ticks.map((t) => (
            <p key={t} className="-translate-y-1/2 text-xs leading-none text-[#9ca3af] first:translate-y-0 last:translate-y-0">
              {t}
            </p>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
