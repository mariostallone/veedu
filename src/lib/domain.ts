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
