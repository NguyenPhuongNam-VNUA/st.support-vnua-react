// Shared by the dashboard cards and the conversation table so every card filters the same window.

export interface DateRange {
  /** null = no lower bound (custom range without a start date). */
  from: Date | null;
  to: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveDateRange(timeRange: string | undefined, startDate?: string, endDate?: string, now = new Date()): DateRange {
  if (timeRange === 'today') {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (timeRange === '30d') return { from: new Date(now.getTime() - 30 * DAY_MS), to: now };
  if (timeRange === 'custom') {
    let from = startDate ? new Date(`${startDate}T00:00:00`) : null;
    let to = endDate ? new Date(`${endDate}T23:59:59.999`) : now;
    if (from && Number.isNaN(from.getTime())) from = null;
    if (Number.isNaN(to.getTime())) to = now;
    if (from && from > to && endDate) {
      // Dates picked in reverse order: swap the days, keeping whole-day bounds.
      return { from: new Date(`${endDate}T00:00:00`), to: new Date(`${startDate}T23:59:59.999`) };
    }
    return { from, to };
  }
  return { from: new Date(now.getTime() - 7 * DAY_MS), to: now }; // '7d' and unknown values
}

/** Same-length window right before `range`, for "vs previous period" deltas. */
export function previousRange(range: DateRange): DateRange | null {
  if (!range.from) return null;
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: range.from };
}

export function inRange(dateStr: string | undefined, range: DateRange): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  return (!range.from || t >= range.from.getTime()) && t <= range.to.getTime();
}
