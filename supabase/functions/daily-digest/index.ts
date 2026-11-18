// Edge Function (Deno): invoked every hour (pg_cron / Supabase Scheduler). Sends each person a digest
// when their own local clock is at their chosen digest hour: pantry items expiring within 7 days,
// to-dos due today and overdue to-dos. See README "Notifications".
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { buildMessages, chunk, deadTokens, digestContent, EXPO_BATCH_SIZE, EXPO_PUSH_URL, isDigestDue, localDateHour, type DigestEntry, type PushMessage, type PushTicket } from '../_shared/notify.ts';

type Target = { user_id: string; token: string; digest_hour: number; timezone: string };

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret && req.headers.get('x-webhook-secret') !== secret) return new Response('forbidden', { status: 403 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now = Date.now();

  const targets = await db.rpc('digest_targets');
  if (targets.error) return new Response(targets.error.message, { status: 500 });

  // Group devices by person, keeping only people whose local hour matches right now.
  const byUser = new Map<string, { tokens: string[]; timezone: string }>();
  for (const t of (targets.data ?? []) as Target[]) {
    if (!isDigestDue(t, now)) continue;
    const entry = byUser.get(t.user_id) ?? { tokens: [], timezone: t.timezone };
    entry.tokens.push(t.token);
    byUser.set(t.user_id, entry);
  }

  const messages: PushMessage[] = [];
  for (const [userId, { tokens, timezone }] of byUser) {
    const digest = await db.rpc('digest_for', { p_user: userId, p_today: localDateHour(now, timezone).date });
    if (digest.error) continue;
    const content = digestContent((digest.data ?? []) as DigestEntry[]);
    if (content) messages.push(...buildMessages(tokens, content));
  }

  const dead: string[] = [];
  for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) continue;
    const { data } = (await res.json()) as { data: PushTicket[] };
    dead.push(...deadTokens(batch, data ?? []));
  }
  if (dead.length) await db.rpc('prune_push_tokens', { p_tokens: dead });
  return Response.json({ people: byUser.size, sent: messages.length });
});
