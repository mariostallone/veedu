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

// --- Shopping (M2) ---

/**
 * Splits quick-add text into a name and quantity: "milk x2", "milk ×2", "2 milk" and "2x milk"
 * all give { text: 'milk', qty: 2 }. No quantity means 1. A number that is part of the name
 * ("7up", "2% milk") is left alone.
 */
export function parseQuickAdd(input: string): { text: string; qty: number } {
  const s = input.trim().replace(/\s+/g, ' ');
  const trailing = s.match(/^(.*\S)\s+[x×]\s?(\d+(?:\.\d+)?)$/i);
  if (trailing) return finishQuickAdd(trailing[1], trailing[2]);
  const leading = s.match(/^(\d+(?:\.\d+)?)\s?(?:[x×]\s+|[x×](?=[a-z])|\s)(.*\S)$/i);
  if (leading) return finishQuickAdd(leading[2], leading[1]);
  return { text: s, qty: 1 };
}

function finishQuickAdd(text: string, rawQty: string): { text: string; qty: number } {
  const qty = Number(rawQty);
  return { text, qty: qty > 0 ? qty : 1 };
}

/** The unchecked item with the same name (ignoring case and spacing), if any. */
export function findDuplicateItem<T extends { text: string; done: boolean }>(
  items: readonly T[],
  text: string,
): T | undefined {
  const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();
  const wanted = norm(text);
  if (!wanted) return undefined;
  return items.find((i) => !i.done && norm(i.text) === wanted);
}

export const DEFAULT_STORES: readonly string[] = ['Indian grocery', 'Supermarket', 'Costco'];

/** Store chips: stores already used on the list first (most used first), then the defaults. */
export function storeOptions(
  items: readonly { group_name: string | null }[],
  defaults: readonly string[] = DEFAULT_STORES,
): string[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const name = it.group_name?.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const used = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const seen = new Set(used.map((n) => n.toLowerCase()));
  return [...used, ...defaults.filter((d) => !seen.has(d.toLowerCase()))];
}

/** Shopping list layout: unchecked items grouped by store, checked items in one "in the cart" list. */
export function groupShopping<T extends { done: boolean; group_name: string | null }>(
  items: readonly T[],
): { toBuy: Group<T>[]; inCart: T[] } {
  return {
    toBuy: groupBy(
      items.filter((i) => !i.done),
      (i) => i.group_name,
      { fallback: 'No store' },
    ),
    inCart: items.filter((i) => i.done),
  };
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

// --- Trips (M4) ---

/** Parses a typed amount ("1,200", "45.5"); empty gives null, junk or negatives give NaN. */
export function parseAmount(text: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (!t) return null;
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return NaN;
  return Number(t);
}

/** Whole numbers without decimals, otherwise two decimals: 1200 -> "1,200", 4.5 -> "4.50". */
export function formatMoney(amount: number): string {
  const whole = Number.isInteger(amount);
  const [int, frac] = Math.abs(amount).toFixed(whole ? 0 : 2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${amount < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/** "5 days to go", "Tomorrow", "Today", "Started 3 days ago" for a trip start date. */
export function daysToGo(startsOn: IsoDate | null, today: IsoDate): string | null {
  if (!startsOn) return null;
  const d = daysBetween(today, startsOn);
  if (d === 0) return 'Departs today';
  if (d === 1) return 'Departs tomorrow';
  if (d > 1) return `${d} days to go`;
  return d === -1 ? 'Started yesterday' : `Started ${-d} days ago`;
}

/** The copy of a trip's items used as a template: same content, nothing checked off. */
export function templateItems<
  T extends {
    text: string;
    qty: number;
    note: string | null;
    category: string | null;
    group_name: string | null;
    owner_id: string | null;
    cost: number | null;
  },
>(items: readonly T[]) {
  return items.map((i) => ({
    text: i.text,
    qty: i.qty,
    note: i.note,
    category: i.category as T['category'],
    group_name: i.group_name,
    owner_id: i.owner_id,
    cost: i.cost,
    done: false,
  }));
}

// --- Home (M5) ---

export type HomeStats = {
  /** Pantry items below their keep-at-least level. */
  low: number;
  /** Pantry items expired or expiring within 30 days. */
  expiring: number;
  /** Unchecked items on the shopping list. */
  shopping: number;
  /** Unchecked to-dos that are overdue or due within the next 7 days. */
  todosThisWeek: number;
};

export function homeStats(
  pantry: readonly { qty: number; keep_min: number; expires_on: IsoDate | null }[],
  todos: readonly { done: boolean; due_on: IsoDate | null }[],
  shoppingOpen: number,
  today: IsoDate,
): HomeStats {
  let low = 0;
  let expiring = 0;
  for (const p of pantry) {
    if (isLow(p)) low += 1;
    const kind = expiryStatus(p.expires_on, today).kind;
    if (kind === 'soon' || kind === 'expired') expiring += 1;
  }
  const todosThisWeek = todos.filter((t) => {
    const b = todoBucket(t, today);
    return b === 'overdue' || b === 'today' || b === 'this_week';
  }).length;
  return { low, expiring, shopping: shoppingOpen, todosThisWeek };
}

export type AttentionKind = 'overdue' | 'expired' | 'expiring' | 'low';

export type AttentionItem = {
  key: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  /** Tab the item lives on. */
  tab: 'pantry' | 'todo';
};

/**
 * Everything that needs a look, most urgent first: overdue to-dos, expired, expiring within
 * 7 days (soonest first), then low stock. Returns the first `max` plus the full list length.
 */
export function needsAttention(
  pantry: readonly {
    id: string;
    name: string;
    unit: string;
    qty: number;
    keep_min: number;
    expires_on: IsoDate | null;
  }[],
  todos: readonly { id: string; text: string; done: boolean; due_on: IsoDate | null }[],
  today: IsoDate,
  max = 5,
): { items: AttentionItem[]; all: AttentionItem[]; total: number } {
  const overdue: (AttentionItem & { days: number })[] = [];
  for (const t of todos) {
    if (todoBucket(t, today) !== 'overdue' || !t.due_on) continue;
    overdue.push({
      key: `todo:${t.id}`,
      kind: 'overdue',
      title: t.text,
      detail: `Due ${relativeDay(t.due_on, today).toLowerCase()}`,
      tab: 'todo',
      days: daysBetween(today, t.due_on),
    });
  }
  overdue.sort((a, b) => a.days - b.days);

  const expiry: (AttentionItem & { days: number })[] = [];
  const low: AttentionItem[] = [];
  for (const p of pantry) {
    const status = expiryStatus(p.expires_on, today, 7);
    if (status.kind === 'expired' || status.kind === 'soon') {
      const when = p.expires_on ? relativeDay(p.expires_on, today).toLowerCase() : '';
      expiry.push({
        key: `expiry:${p.id}`,
        kind: status.kind === 'expired' ? 'expired' : 'expiring',
        title: p.name,
        detail: status.kind === 'expired' ? `Expired ${when}` : `Expires ${when}`,
        tab: 'pantry',
        days: status.days,
      });
    } else if (isLow(p)) {
      low.push({
        key: `low:${p.id}`,
        kind: 'low',
        title: p.name,
        detail: `${formatQty(p.qty, p.unit)} left, keep ${formatQty(p.keep_min, p.unit)}`,
        tab: 'pantry',
      });
    }
  }
  expiry.sort((a, b) => a.days - b.days);
  const strip = ({ days: _days, ...rest }: AttentionItem & { days: number }): AttentionItem => rest;
  const all = [...overdue.map(strip), ...expiry.map(strip), ...low];
  return { items: all.slice(0, max), all, total: all.length };
}

export type ActivityVerb = 'added' | 'checked_off' | 'updated';

export type ActivityEntry = {
  key: string;
  userId: string | null;
  verb: ActivityVerb;
  /** List title, or "Pantry". */
  target: string;
  count: number;
  /** Item names, newest first (up to 3). */
  texts: string[];
  /** Latest event time, epoch ms. */
  atMs: number;
};

const HOUR_MS = 3_600_000;

/**
 * Who did what in the last 7 days, from created_at/created_by and done_at/done_by on list
 * items and created/updated on pantry items. Events by the same person, on the same list and
 * of the same kind within the same clock hour (UTC) are merged. Newest first.
 */
export function recentActivity(
  listItems: readonly {
    text: string;
    list_id: string;
    created_by: string | null;
    created_at: string;
    done: boolean;
    done_at: string | null;
    done_by: string | null;
  }[],
  lists: readonly { id: string; title: string }[],
  pantry: readonly {
    name: string;
    created_by: string | null;
    created_at: string;
    updated_by: string | null;
    updated_at: string;
  }[],
  nowMs: number,
  days = 7,
): ActivityEntry[] {
  const since = nowMs - days * 24 * HOUR_MS;
  const titles = new Map(lists.map((l) => [l.id, l.title]));
  const events: { userId: string | null; verb: ActivityVerb; target: string; text: string; at: number }[] = [];
  const within = (at: number) => Number.isFinite(at) && at >= since && at <= nowMs + HOUR_MS;

  for (const it of listItems) {
    const target = titles.get(it.list_id);
    if (!target) continue;
    const created = Date.parse(it.created_at);
    if (within(created)) events.push({ userId: it.created_by, verb: 'added', target, text: it.text, at: created });
    if (it.done && it.done_at) {
      const done = Date.parse(it.done_at);
      if (within(done)) events.push({ userId: it.done_by, verb: 'checked_off', target, text: it.text, at: done });
    }
  }
  for (const p of pantry) {
    const created = Date.parse(p.created_at);
    const updated = Date.parse(p.updated_at);
    if (within(created)) events.push({ userId: p.created_by, verb: 'added', target: 'Pantry', text: p.name, at: created });
    // Ignore the touch that happens within a minute of creation (triggers, initial edits).
    if (within(updated) && updated - created > 60_000) {
      events.push({ userId: p.updated_by, verb: 'updated', target: 'Pantry', text: p.name, at: updated });
    }
  }

  events.sort((a, b) => b.at - a.at);
  const merged = new Map<string, ActivityEntry>();
  for (const e of events) {
    const key = `${e.userId ?? '-'}|${e.verb}|${e.target}|${Math.floor(e.at / HOUR_MS)}`;
    const entry = merged.get(key);
    if (entry) {
      entry.count += 1;
      if (entry.texts.length < 3) entry.texts.push(e.text);
    } else {
      merged.set(key, { key, userId: e.userId, verb: e.verb, target: e.target, count: 1, texts: [e.text], atMs: e.at });
    }
  }
  return [...merged.values()].sort((a, b) => b.atMs - a.atMs);
}

/** "Priya added 5 items to Shopping", "Arjun checked off Pashmina shawl". */
export function describeActivity(entry: ActivityEntry, who: string): string {
  const one = entry.count === 1;
  const items = `${entry.count} items`;
  const pantry = entry.target === 'Pantry';
  switch (entry.verb) {
    case 'added':
      return `${who} added ${one ? entry.texts[0] : items} to ${entry.target}`;
    case 'checked_off':
      return one ? `${who} checked off ${entry.texts[0]}` : `${who} checked off ${items} on ${entry.target}`;
    case 'updated':
      return one ? `${who} updated ${entry.texts[0]}` : `${who} updated ${items} in ${pantry ? 'the Pantry' : entry.target}`;
  }
}

/** "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(atMs: number, nowMs: number): string {
  const mins = Math.floor((nowMs - atMs) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// --- Offline (M8) ---

/** Cache key for the persisted query cache; changes with the app version so old caches are dropped. */
export function cacheBuster(appVersion: string | null | undefined): string {
  return `veedu-cache-v${appVersion || '0'}`;
}

/** Exponential retry delay in ms for a failed request: 1s, 2s, 4s ... capped at 30s. */
export function retryDelay(attempt: number): number {
  const n = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  return Math.min(1000 * 2 ** n, 30_000);
}

/** True when the device can reach the network, given NetInfo's (possibly unknown) flags. */
export function isReachable(state: { isConnected: boolean | null; isInternetReachable?: boolean | null }): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

// --- Scanning (M6) ---

/** Digits only; 12-digit UPC-A becomes 13-digit EAN-13 so one product has one code. Null if not a usable barcode. */
export function normaliseBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}

/** The pantry item that remembers this barcode, if any. */
export function findByBarcode<T extends { barcode: string | null }>(items: readonly T[], code: string): T | undefined {
  const wanted = normaliseBarcode(code);
  if (!wanted) return undefined;
  return items.find((i) => i.barcode !== null && normaliseBarcode(i.barcode) === wanted);
}

/** Lower-case, letters and digits only, each word singularised crudely ("Onions" and "onion" match). */
function matchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

/** The pantry item with the same name as a scanned text (ignoring case, punctuation and plurals). */
export function matchPantryName<T extends { name: string }>(items: readonly T[], text: string): T | undefined {
  const key = matchKey(text);
  if (!key) return undefined;
  return items.find((i) => matchKey(i.name) === key);
}

export type NoteRow<P> = {
  text: string;
  qty: number;
  store: string | null;
  /** Pantry item with the same name, so the list item links to it. */
  pantry: P | null;
  /** Already unchecked on the shopping list. */
  duplicate: boolean;
  /** Checked by default unless it is already on the list. */
  selected: boolean;
};

/** Turns scanned note items into checklist rows, matched against pantry names and the open shopping list. */
export function planNoteItems<P extends { name: string }>(
  scanned: readonly { text: string; qty: number; store_guess: string | null }[],
  pantry: readonly P[],
  shopping: readonly { text: string; done: boolean }[],
): NoteRow<P>[] {
  return scanned.map((s) => {
    const pantryItem = matchPantryName(pantry, s.text) ?? null;
    const name = pantryItem?.name ?? s.text;
    const duplicate = !!findDuplicateItem(shopping, name);
    return { text: name, qty: s.qty, store: s.store_guess, pantry: pantryItem, duplicate, selected: !duplicate };
  });
}

/** Fields of the pantry editor that a scan filled in; the editor marks them "read". */
export type ReadField = 'name' | 'category' | 'unit' | 'qty' | 'expiry';

export type EditorPrefill = {
  name?: string;
  category?: string;
  unit?: string;
  qty?: string;
  expires?: string;
  barcode?: string;
  /** Comma-separated ReadField names. */
  read?: string;
};

/** Which fields were read, from the editor's `read` route param. */
export function parseReadFields(param: string | undefined): Set<string> {
  return new Set((param ?? '').split(',').filter(Boolean));
}

/** Pantry category for a free-text hint, using only categories the pantry offers. */
export function pickCategory(hint: string | null | undefined, known: readonly string[]): string | null {
  const h = (hint ?? '').trim().toLowerCase();
  if (!h) return null;
  return known.find((k) => k.toLowerCase() === h) ?? null;
}

/** Route params for the pantry editor from a label scan. Only fields that were read are set. */
export function labelToPrefill(
  label: { name: string; size: number | null; unit: string | null; expires_on: string | null; category: string | null },
  knownCategories: readonly string[],
): EditorPrefill {
  const read: ReadField[] = ['name'];
  const out: EditorPrefill = { name: label.name };
  const category = pickCategory(label.category, knownCategories);
  if (category) {
    out.category = category;
    read.push('category');
  }
  if (label.unit) {
    out.unit = label.unit;
    read.push('unit');
  }
  if (label.size !== null) {
    out.qty = String(label.size);
    read.push('qty');
  }
  if (label.expires_on && isValidIsoDate(label.expires_on)) {
    out.expires = label.expires_on;
    read.push('expiry');
  }
  out.read = read.join(',');
  return out;
}

export type ProductInfo = { name: string; size: number | null; unit: string | null; category: string | null };

const CATEGORY_HINTS: readonly [string, RegExp][] = [
  ['Spices', /spice|masala|seasoning|herb/],
  ['Oils & ghee', /\boils?\b|ghee|butter/],
  ['Grains & pulses', /rice|flour|atta|lentil|dal\b|pulse|cereal|grain|bean/],
  ['Snacks', /snack|biscuit|cookie|chips|crisps|chocolate|candy|sweet/],
  ['Toiletries', /soap|shampoo|toothpaste|hygiene|cosmetic/],
  ['Household', /clean|detergent|laundry|household|paper/],
];

/** Reads an Open Food Facts v2 product response; null when the product is unknown. */
export function parseOpenFoodFacts(json: unknown): ProductInfo | null {
  if (typeof json !== 'object' || json === null) return null;
  const root = json as { status?: unknown; product?: unknown };
  if (root.status === 0 || typeof root.product !== 'object' || root.product === null) return null;
  const p = root.product as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const name = str(p.product_name_en) || str(p.product_name) || str(p.generic_name);
  if (!name) return null;
  const qty = str(p.quantity).match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/i);
  const tags = Array.isArray(p.categories_tags) ? p.categories_tags.filter((t) => typeof t === 'string').join(' ') : '';
  const haystack = `${tags} ${str(p.categories)}`.toLowerCase();
  return {
    name: name.slice(0, 80),
    size: qty ? Number(qty[1].replace(',', '.')) : null,
    unit: qty ? qty[2].toLowerCase() : null,
    category: CATEGORY_HINTS.find(([, re]) => re.test(haystack))?.[0] ?? null,
  };
}

/** Editor params for a barcode that is not in the pantry yet. */
export function barcodeToPrefill(code: string, product: ProductInfo | null): EditorPrefill {
  if (!product) return { barcode: code };
  const read: ReadField[] = ['name'];
  const out: EditorPrefill = { barcode: code, name: product.name };
  if (product.category) {
    out.category = product.category;
    read.push('category');
  }
  if (product.unit) {
    out.unit = product.unit;
    read.push('unit');
  }
  if (product.size !== null) {
    out.qty = String(product.size);
    read.push('qty');
  }
  out.read = read.join(',');
  return out;
}

// --- Notifications (M7) ---

export type NotificationRoute = '/' | '/pantry' | '/shop' | '/trips' | '/todo';

const NOTIFICATION_ROUTES: readonly NotificationRoute[] = ['/', '/pantry', '/shop', '/trips', '/todo'];

/** Which tab a tapped notification opens, from its `data.url`; null when it names no known tab. */
export function notificationRoute(data: unknown): NotificationRoute | null {
  if (typeof data !== 'object' || data === null) return null;
  const url = (data as { url?: unknown }).url;
  return NOTIFICATION_ROUTES.find((r) => r === url) ?? null;
}

/** 0 -> "12:00 AM", 8 -> "8:00 AM", 18 -> "6:00 PM". */
export function formatDigestHour(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Hours offered for the daily digest, 5 AM to 10 PM. */
export const DIGEST_HOURS: readonly number[] = Array.from({ length: 18 }, (_, i) => i + 5);
