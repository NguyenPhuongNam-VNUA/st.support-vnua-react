'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleHelp, Search, Sparkles, Ban, MessageSquare } from 'lucide-react';
import SectionCard from '@/components/admin/SectionCard';

interface LogItem {
  id: number | string;
  question?: string;
  response_type?: string;
  status?: string;
  created_at?: string;
}

const STATUS_META: Record<string, { title: string; icon: typeof CheckCircle2 }> = {
  answered: { title: 'Đã trả lời', icon: CheckCircle2 },
  not_found: { title: 'Không tìm thấy câu trả lời', icon: CircleHelp },
  auto_generated: { title: 'AI tự sinh câu trả lời', icon: Sparkles },
  out_of_topic: { title: 'Ngoài phạm vi', icon: Ban },
};

const RANGES = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'yesterday', label: 'Hôm qua' },
  { id: 'week', label: 'Tuần này' },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

const startOfDay = (offset = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d;
};

// Kravio "Latest Updates": segmented range, search, timeline of recent conversations.
export default function LatestUpdatesCard({ logs, loading }: { logs: LogItem[]; loading?: boolean }) {
  const [range, setRange] = useState<RangeId>('today');
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const [from, to] =
      range === 'today' ? [startOfDay(0), null] : range === 'yesterday' ? [startOfDay(1), startOfDay(0)] : [startOfDay(6), null];
    const q = query.trim().toLowerCase();
    return logs
      .filter((l) => {
        if (!l.created_at) return false;
        const t = new Date(l.created_at);
        return t >= from && (!to || t < to) && (!q || (l.question || '').toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
      .slice(0, 30);
  }, [logs, range, query]);

  const activeIndex = RANGES.findIndex((r) => r.id === range);
  const rangeText = range === 'today' ? 'hôm nay' : range === 'yesterday' ? 'hôm qua' : 'tuần này';

  return (
    <SectionCard title="Hoạt động mới nhất" className="h-[560px] w-full shrink-0 min-[1400px]:w-[332px]" bodyClassName="gap-4 px-3.5 pb-3.5 pt-4">
      <div className="flex w-full flex-col gap-3">
        <div role="radiogroup" aria-label="Khoảng thời gian hoạt động" className="relative flex w-full items-start gap-2">
          <span
            aria-hidden="true"
            className="absolute top-0 h-7 rounded-lg border border-[#1f2937] bg-[linear-gradient(180deg,#37475d_0%,#1f2937_64.697%)] transition-[left] duration-300 ease-[cubic-bezier(.16,1,.3,1)]"
            style={{ width: 'calc(33.3333% - 5.33333px)', left: `calc(${activeIndex * 33.3333}% + ${activeIndex * 2.6667}px)` }}
          />
          {RANGES.map((r) => {
            const on = r.id === range;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setRange(r.id)}
                className={`relative z-10 flex h-7 min-w-0 flex-1 items-center justify-center rounded-lg border-[0.8px] pl-2.5 pr-2 text-xs font-medium leading-none outline-none transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-[#9ca3af]/40 ${
                  on ? 'border-transparent bg-transparent text-white' : 'border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#fafafa]'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <label className="flex h-8 w-full cursor-text items-center gap-2 overflow-clip rounded-lg border-[0.8px] border-[#e5e7eb] bg-white py-2 pl-2.5 pr-2 transition-[border-color,box-shadow] duration-150 hover:border-[#d1d5db] focus-within:border-[#9ca3af] focus-within:shadow-[0_0_0_3px_rgba(156,163,175,0.18)]">
          <Search size={16} strokeWidth={1.4} className="shrink-0 text-[#4b5563]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm hoạt động"
            aria-label="Tìm hoạt động"
            className="min-w-0 flex-1 bg-transparent text-[13px] leading-none text-[#1f2937] outline-none placeholder:text-[#6b7280] [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
        <p className="whitespace-nowrap text-[13px] leading-none tracking-[-0.16px] text-[#6b7280]">
          <span className="text-base font-medium text-[#1f2937]">{loading ? '—' : items.length}</span> hoạt động {rangeText}
        </p>
        <div className="h-0 w-full border-t border-dashed border-black/10" />
        {items.length === 0 && !loading ? (
          <p className="py-6 text-center text-xs text-[#9ca3af]">Chưa có hoạt động nào.</p>
        ) : (
          <ol className="k-no-scrollbar flex min-h-0 w-full flex-1 flex-col gap-5 overflow-y-auto">
            {items.map((l, i) => {
              const meta = STATUS_META[l.response_type || l.status || 'answered'] || { title: 'Hội thoại mới', icon: MessageSquare };
              const Icon = meta.icon;
              const isLast = i === items.length - 1;
              return (
                <li key={l.id} className="group/item k-rise relative flex w-full items-start gap-3" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
                  <span className="relative z-10 flex items-center rounded-lg border-[0.8px] border-[#0000001a] bg-white p-2 text-[#4b5563] transition-[transform,box-shadow] duration-200 group-hover/item:-translate-y-px group-hover/item:shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]">
                    <Icon size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover/item:scale-110" />
                  </span>
                  {!isLast && <span aria-hidden="true" className="absolute bottom-[-20px] left-[15.5px] top-8 w-px border-l border-dashed border-black/10" />}
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 pt-0.5 text-xs tracking-[-0.12px]">
                    <div className="flex w-full items-center justify-between gap-2 leading-none">
                      <p className="truncate font-medium text-[#1f2937]">{meta.title}</p>
                      <time className="shrink-0 whitespace-nowrap text-[#9ca3af]">
                        {new Date(l.created_at!).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </div>
                    <p className="truncate leading-none text-[#9ca3af]">
                      Hỏi: &quot;<span className="text-[#1f2937]">{l.question || '(trống)'}</span>&quot;
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </SectionCard>
  );
}
