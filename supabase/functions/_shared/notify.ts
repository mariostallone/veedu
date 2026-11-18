// Pure logic for the notification Edge Functions: no Deno or npm imports, so `node --test` runs it.

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_BATCH_SIZE = 100;
/** How long notify-activity waits so a burst of added items becomes one notification. */
export const BATCH_WINDOW_MS = 20_000;
/** How far back notify-activity looks for items by the same person to batch together. */
export const LOOKBACK_MS = 2 * 60_000;

export type PushMessage = {
  to: string;
  title?: string;
  body: string;
  sound: 'default';
  data: { url: string };
  channelId: string;
};

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// --- Partner activity ---------------------------------------------------------------------

/** "Priya added 5 items to Shopping" / "Priya added Ghee to Shopping". */
export function activityBody(actor: string, texts: readonly string[]): string {
  const who = actor.trim() || 'Your partner';
  return texts.length === 1
    ? `${who} added ${texts[0]} to Shopping`
    : `${who} added ${texts.length} items to Shopping`;
}

export function buildMessages(tokens: readonly string[], content: { title?: string; body: string; url: string }): PushMessage[] {
  return [...new Set(tokens)].map((to) => ({
    to,
    title: content.title,
    body: content.body,
    sound: 'default',
    data: { url: content.url },
    channelId: 'default',
  }));
}

// --- Daily digest -------------------------------------------------------------------------

export type DigestEntry = { kind: 'expiring' | 'due_today' | 'overdue'; title: string; on_date: string };

export type DigestPrefs = { digest_hour: number; timezone: string };

/** The date (YYYY-MM-DD) and hour (0-23) it is right now in an IANA time zone; unknown zones fall back to UTC. */
export function localDateHour(nowMs: number, timeZone: string): { date: string; hour: number } {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    return localDateHour(nowMs, 'UTC');
  }
  const parts = Object.fromEntries(fmt.formatToParts(new Date(nowMs)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}

/** True when it is currently the person's chosen digest hour in their own time zone. */
export function isDigestDue(prefs: DigestPrefs, nowMs: number): boolean {
  return localDateHour(nowMs, prefs.timezone).hour === prefs.digest_hour;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function names(titles: string[], max = 3): string {
  const shown = titles.slice(0, max).join(', ');
  return titles.length > max ? `${shown} +${titles.length - max} more` : shown;
}

/** Digest text, or null when there is nothing to say (no notification is sent then). */
export function digestContent(entries: readonly DigestEntry[]): { title: string; body: string; url: string } | null {
  const of = (kind: DigestEntry['kind']) => entries.filter((e) => e.kind === kind).map((e) => e.title);
  const expiring = of('expiring');
  const today = of('due_today');
  const overdue = of('overdue');
  const lines: string[] = [];
  if (overdue.length) lines.push(`Overdue: ${names(overdue)}`);
  if (today.length) lines.push(`Due today: ${names(today)}`);
  if (expiring.length) lines.push(`Expiring this week: ${names(expiring)}`);
  if (!lines.length) return null;

  const todoCount = overdue.length + today.length;
  const headline: string[] = [];
  if (todoCount) headline.push(plural(todoCount, 'to-do', 'to-dos') + (overdue.length ? ` (${overdue.length} overdue)` : ' today'));
  if (expiring.length) headline.push(`${plural(expiring.length, 'item', 'items')} expiring`);
  return {
    title: `Today: ${headline.join(', ')}`,
    body: lines.join('\n'),
    url: todoCount ? '/todo' : '/pantry',
  };
}

// --- Expo responses -----------------------------------------------------------------------

export type PushTicket = { status: 'ok' | 'error'; details?: { error?: string } };

/** Tokens Expo says are dead (app uninstalled, token revoked); the function deletes them. */
export function deadTokens(messages: readonly { to: string }[], tickets: readonly PushTicket[]): string[] {
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i]) dead.push(messages[i].to);
  });
  return dead;
}
