export type FreshnessStatus = 'unknown' | 'resting' | 'peak' | 'fading' | 'stale';
export type FreshnessUse = 'espresso' | 'filter';

const DAY_MS = 86_400_000;

/** Whole days between an ISO date (YYYY-MM-DD) and `now`, in local time. */
export function daysSince(isoDate: string | undefined, now: Date = new Date()): number | undefined {
  if (!isoDate) return undefined;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const then = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((today - then) / DAY_MS));
}

/**
 * Degassing rest: ~4 days for filter, ~7 for espresso.
 * Peak until ~30 days, fading until 45, stale afterwards.
 */
export function freshnessStatus(days: number | undefined, use: FreshnessUse = 'filter'): FreshnessStatus {
  if (days === undefined) return 'unknown';
  if (days < (use === 'espresso' ? 7 : 4)) return 'resting';
  if (days <= 30) return 'peak';
  if (days <= 45) return 'fading';
  return 'stale';
}

export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
