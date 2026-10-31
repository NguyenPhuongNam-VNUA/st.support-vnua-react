'use client';

import { useMemo, useState } from 'react';
import SectionCard from '@/components/admin/SectionCard';

interface VolumeTrendCardProps {
  logs: { created_at?: string }[];
  loading?: boolean;
}

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Kravio "volume trend": total + delta vs previous period, gradient bars per day.
export default function VolumeTrendCard({ logs, loading }: VolumeTrendCardProps) {
  const [active, setActive] = useState<number | null>(null);

  const { bars, total, delta } = useMemo(() => {
    const counts = new Map<string, number>();
    logs.forEach((l) => {
      if (!l.created_at) return;
      const k = dayKey(new Date(l.created_at));
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const at = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return { date: d, count: counts.get(dayKey(d)) || 0 };
    };
    const current = [6, 5, 4, 3, 2, 1, 0].map(at);
    const previous = [13, 12, 11, 10, 9, 8, 7].map(at);
    const sum = current.reduce((s, b) => s + b.count, 0);
    const prev = previous.reduce((s, b) => s + b.count, 0);
    return {
      bars: current,
      total: sum,
      delta: prev === 0 ? null : ((sum - prev) / prev) * 100,
    };
  }, [logs]);

  const max = Math.max(4, ...bars.map((b) => b.count));
  const niceMax = Math.ceil(max / 4) * 4;
  const ticks = [4, 3, 2, 1, 0].map((i) => (niceMax / 4) * i);
  const shown = active ?? bars.length - 1;

  return (
    <SectionCard title="Lượt hội thoại theo ngày" bodyClassName="px-3.5 pb-3.5 pt-4 gap-5" className="min-h-[404px]">
      <div className="flex items-end gap-3 whitespace-nowrap leading-none">
        <p className="text-[32px] font-medium text-[#1f2937]">{loading ? '—' : total.toLocaleString('vi-VN')}</p>
        <p className="flex items-center gap-1.5 pb-1">
          {delta !== null && (
            <span className={`text-xs font-medium ${delta >= 0 ? 'text-[#059669]' : 'text-[#ef4444]'}`}>
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </span>
          )}
          <span className="text-[13px] tracking-[-0.13px] text-[#6b7280]">so với 7 ngày trước</span>
        </p>
      </div>

      <div className="flex w-full flex-1 gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div
            role="group"
            tabIndex={0}
            aria-label="Lượt hội thoại theo ngày. Dùng phím mũi tên trái phải để xem từng cột."
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
                    aria-label={`${b.date.toLocaleDateString('vi-VN')}: ${b.count} hội thoại`}
                    onMouseEnter={() => setActive(i)}
                    className="relative h-full w-full max-w-[56px] outline-none"
                  >
                    {on && (
                      <span className="k-rise absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1f2937] px-2 py-1 text-[11px] font-medium leading-none text-white" style={{ bottom: `calc(${(b.count / niceMax) * 100}% + 8px)` }}>
                        {DAY_LABELS[b.date.getDay()]} : {b.count}
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
            {bars[shown] && `${bars[shown].date.toLocaleDateString('vi-VN')}: ${bars[shown].count} hội thoại`}
          </p>
          <div className="flex justify-around px-[1%]" aria-hidden="true">
            {bars.map((b, i) => (
              <p key={i} className={`w-full max-w-[56px] text-center text-xs leading-none ${i === shown ? 'text-[#1f2937]' : 'text-[#9ca3af]'}`}>
                {DAY_LABELS[b.date.getDay()]}
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
