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

// --- Pantry (M1) ---

export const DEFAULT_PANTRY_CATEGORIES = [
  'Grains & pulses',
  'Spices',
  'Oils & ghee',
  'Snacks',
  'Household',
  'Toiletries',
  'Other',
] as const;

export const DEFAULT_PANTRY_UNITS = ['pack', 'bag', 'box', 'bottle', 'roll', 'kg', 'g'] as const;

export const DEFAULT_STORES = ['Supermarket', 'Local kirana', 'Online'] as const;

export type QuickAddPantry = { name: string; category: string; unit: string; keep_min: number };

export const QUICK_ADD_PANTRY: readonly QuickAddPantry[] = [
  { name: 'Basmati rice', category: 'Grains & pulses', unit: 'bag', keep_min: 1 },
  { name: 'Toor dal', category: 'Grains & pulses', unit: 'pack', keep_min: 1 },
  { name: 'Atta', category: 'Grains & pulses', unit: 'bag', keep_min: 1 },
  { name: 'Haldi', category: 'Spices', unit: 'pack', keep_min: 1 },
  { name: 'Garam masala', category: 'Spices', unit: 'pack', keep_min: 1 },
  { name: 'Ghee', category: 'Oils & ghee', unit: 'bottle', keep_min: 1 },
  { name: 'Toilet paper', category: 'Household', unit: 'roll', keep_min: 4 },
];

/** Existing values first (sorted, de-duplicated ignoring case), then any defaults not already present. */
export function mergeSuggestions(existing: readonly (string | null | undefined)[], defaults: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (v: string | null | undefined) => {
    const t = v?.trim();
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(t);
  };
  [...existing].sort((a, b) => (a ?? '').localeCompare(b ?? '')).forEach(add);
  defaults.forEach(add);
  return out;
}

/** Case-insensitive search on name, category and store, optionally narrowed to one category. */
export function filterPantry<T extends { name: string; category: string; store: string | null }>(
  items: readonly T[],
  query: string,
  category: string | null = null,
): T[] {
  const q = query.trim().toLowerCase();
  return items.filter((it) => {
    if (category && (it.category.trim() || 'Other') !== category) return false;
    if (!q) return true;
    return [it.name, it.category, it.store ?? ''].some((s) => s.toLowerCase().includes(q));
  });
}

/** Fill level for the progress bar: qty relative to keep_min (full at or above it). */
export function stockLevel(qty: number, keepMin: number): number {
  if (keepMin <= 0) return qty > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, qty / keepMin));
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(Date.UTC(+value.slice(0, 4), +value.slice(5, 7) - 1, +value.slice(8, 10)));
  return d.toISOString().slice(0, 10) === value;
}

/** Parses a non-negative number typed by a person ("2", "1.5", "1,5"); null when invalid. Blank is 0. */
export function parseQty(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return 0;
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Short chip text for an expiry status, or null when nothing needs flagging. */
export function expiryLabel(status: ExpiryStatus): string | null {
  if (status.kind === 'expired') return status.days === -1 ? 'Expired yesterday' : `Expired ${-status.days}d ago`;
  if (status.kind === 'soon') return status.days === 0 ? 'Expires today' : `Expires in ${status.days}d`;
  return null;
}
