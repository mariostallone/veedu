// Pure household logic shared by screens. No imports, so it runs under `node --test` as-is.
// Dates are ISO calendar dates ('YYYY-MM-DD'); "today" is always passed in so results are testable.

export type IsoDate = string;

/** How many units to buy to get back to the keep-at-least level. 0 when nothing is needed. */
export function restockQty(qty: number, keepMin: number): number {
  if (qty >= keepMin) return 0;
  return Math.max(1, Math.ceil(keepMin - qty));
}

export function isLow(item: { qty: number; keep_min: number }): boolean {
  return item.qty < item.keep_min;
}

/** Whole days from `today` to `date` (negative when in the past). */
export function daysBetween(today: IsoDate, date: IsoDate): number {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + days));
  return d.toISOString().slice(0, 10);
}

/** Local calendar date for a JS Date (not UTC), as 'YYYY-MM-DD'. */
export function toIsoDate(d: Date): IsoDate {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export type ExpiryStatus =
  | { kind: 'none' }
  | { kind: 'expired'; days: number }
  | { kind: 'soon'; days: number }
  | { kind: 'ok'; days: number };

/** 'soon' means within `soonDays` (default 30) days, including today. */
export function expiryStatus(expiresOn: IsoDate | null | undefined, today: IsoDate, soonDays = 30): ExpiryStatus {
  if (!expiresOn) return { kind: 'none' };
  const days = daysBetween(today, expiresOn);
  if (days < 0) return { kind: 'expired', days };
  if (days <= soonDays) return { kind: 'soon', days };
  return { kind: 'ok', days };
}

export type Group<T> = { key: string; items: T[] };

/**
 * Groups items by a key, keeping first-seen order. Items with no key go in `fallback`, which
 * is always last. Keys listed in `order` come first, in that order.
 */
export function groupBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string | null | undefined,
  options: { fallback?: string; order?: readonly string[] } = {},
): Group<T>[] {
  const fallback = options.fallback ?? 'Other';
  const map = new Map<string, T[]>();
  for (const item of items) {
    const raw = keyOf(item);
    const key = raw && raw.trim() ? raw.trim() : fallback;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  const order = options.order ?? [];
  const rank = (k: string) => {
    if (k === fallback) return Number.MAX_SAFE_INTEGER;
    const i = order.indexOf(k);
    return i === -1 ? order.length : i;
  };
  return [...map.entries()]
    .map(([key, list], index) => ({ key, items: list, index }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.index - b.index)
    .map(({ key, items: list }) => ({ key, items: list }));
}

const IRREGULAR_PLURALS: Record<string, string> = { box: 'boxes', pouch: 'pouches', bunch: 'bunches' };
const UNCOUNTABLE = new Set(['kg', 'g', 'lb', 'oz', 'l', 'ml']);

/** "1 bag", "3 bags", "1.5 kg". */
export function formatQty(qty: number, unit: string): string {
  const n = Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
  if (!unit) return n;
  if (qty === 1 || UNCOUNTABLE.has(unit.toLowerCase())) return `${n} ${unit}`;
  return `${n} ${IRREGULAR_PLURALS[unit] ?? `${unit}s`}`;
}

export type TodoBucket = 'overdue' | 'today' | 'this_week' | 'later' | 'someday' | 'done';

export function todoBucket(item: { done: boolean; due_on: IsoDate | null }, today: IsoDate): TodoBucket {
  if (item.done) return 'done';
  if (!item.due_on) return 'someday';
  const days = daysBetween(today, item.due_on);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'this_week';
  return 'later';
}

export function tripProgress(
  items: readonly { done: boolean; cost: number | null; qty: number }[],
): { done: number; total: number; spent: number; planned: number } {
  let done = 0;
  let spent = 0;
  let planned = 0;
  for (const it of items) {
    const cost = (it.cost ?? 0) * it.qty;
    planned += cost;
    if (it.done) {
      done += 1;
      spent += cost;
    }
  }
  return { done, total: items.length, spent, planned };
}

/** "Today", "Tomorrow", "Yesterday", "in 3 days", "3 days ago", or a short date beyond a week. */
export function relativeDay(date: IsoDate, today: IsoDate): string {
  const d = daysBetween(today, date);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d > 1 && d <= 7) return `in ${d} days`;
  if (d < -1 && d >= -7) return `${-d} days ago`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${+date.slice(8, 10)} ${months[+date.slice(5, 7) - 1]}`;
  return date.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${date.slice(0, 4)}`;
}

/** First letter of each of the first two words, upper-cased: "Priya" -> "P", "Amma Appa" -> "AA". */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

// --- To-dos (M3) ---

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Day of week for an ISO date: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: IsoDate): number {
  return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))).getUTCDay();
}

export type RepeatOption = { days: number | null; label: string };

/** Repeat choices offered when editing a to-do. Monthly is a fixed 30 days. */
export const REPEAT_OPTIONS: readonly RepeatOption[] = [
  { days: null, label: 'Never' },
  { days: 1, label: 'Daily' },
  { days: 7, label: 'Weekly' },
  { days: 14, label: 'Every 2 weeks' },
  { days: 30, label: 'Monthly' },
];

/**
 * Label for the repeat indicator on a row: "Every Sunday" (weekly, when the due date is known),
 * "Every 2 weeks", "Every month", "Every 3 days". Null when the task does not repeat.
 */
export function repeatLabel(days: number | null | undefined, dueOn?: IsoDate | null): string | null {
  if (!days || days < 1) return null;
  if (days === 1) return 'Every day';
  if (days === 7) return dueOn ? `Every ${WEEKDAYS[weekdayOf(dueOn)]}` : 'Every week';
  if (days % 7 === 0) return `Every ${days / 7} weeks`;
  if (days === 30) return 'Every month';
  return `Every ${days} days`;
}

export type DueQuickPick = 'today' | 'tomorrow' | 'weekend' | 'next_week';

/** Dates for the due-date quick picks: weekend = the coming Saturday (today if it is the weekend), next week = next Monday. */
export function quickPickDate(pick: DueQuickPick, today: IsoDate): IsoDate {
  const dow = weekdayOf(today);
  switch (pick) {
    case 'today':
      return today;
    case 'tomorrow':
      return addDays(today, 1);
    case 'weekend':
      return dow === 0 ? today : addDays(today, (6 - dow + 7) % 7);
    case 'next_week':
      return addDays(today, ((1 - dow + 7) % 7) || 7);
  }
}

/** "November 2026" for a 0-based month. */
export function monthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** Shifts a year/0-based month pair by whole months. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

/** Weeks (Monday first) of a month for a calendar; days outside the month are null. */
export function monthGrid(year: number, month: number): (IsoDate | null)[][] {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lead = (weekdayOf(first) + 6) % 7;
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (IsoDate | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 0; d < count; d++) cells.push(addDays(first, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type TodoFilter = 'mine' | 'partner' | 'everyone';

/** Applies the Mine / partner / Everyone filter. `partnerIds` are the other members' user ids. */
export function filterTodosByOwner<T extends { owner_id: string | null }>(
  items: readonly T[],
  filter: TodoFilter,
  me: string,
  partnerIds: readonly string[],
): T[] {
  if (filter === 'everyone') return [...items];
  if (filter === 'mine') return items.filter((i) => i.owner_id === me);
  return items.filter((i) => i.owner_id !== null && partnerIds.includes(i.owner_id));
}

/** Most recently completed items first, capped at `limit`. */
export function recentlyDone<T extends { done_at: string | null }>(items: readonly T[], limit = 10): T[] {
  return [...items].sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')).slice(0, limit);
}
