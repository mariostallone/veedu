// Edge Function (Deno): called by a Database Webhook on public.list_items INSERT.
// Waits a short window so a burst of added items becomes one notification, then tells the OTHER
// household members: "Priya added 5 items to Shopping". See README "Notifications".
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { activityBody, BATCH_WINDOW_MS, buildMessages, chunk, deadTokens, EXPO_BATCH_SIZE, EXPO_PUSH_URL, LOOKBACK_MS, type PushTicket } from '../_shared/notify.ts';

type Webhook = {
  type: string;
  table: string;
  record: { id: string; household_id: string; created_by: string | null; created_at: string } | null;
};

Deno.serve(async (req) => {
  // The webhook sends this header (configured in the dashboard); anything else is rejected.
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret && req.headers.get('x-webhook-secret') !== secret) return new Response('forbidden', { status: 403 });

  const payload = (await req.json()) as Webhook;
  const record = payload.record;
  if (payload.type !== 'INSERT' || payload.table !== 'list_items' || !record?.created_by) {
    return Response.json({ skipped: 'not a user-added list item' });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Let more inserts arrive. Every call in the burst then tries to claim the unannounced items;
  // the database hands them all to exactly one caller, the rest get nothing and stop.
  await new Promise((r) => setTimeout(r, BATCH_WINDOW_MS));
  const since = new Date(Date.parse(record.created_at) - LOOKBACK_MS).toISOString();
  const claimed = await db.rpc('claim_activity_items', {
    p_household: record.household_id,
    p_actor: record.created_by,
    p_since: since,
  });
  if (claimed.error) return new Response(claimed.error.message, { status: 500 });
  const items = (claimed.data ?? []) as { id: string; text: string }[];
  if (!items.length) return Response.json({ sent: 0 });

  const [actor, targets] = await Promise.all([
    db.from('household_members').select('display_name').eq('household_id', record.household_id).eq('user_id', record.created_by).maybeSingle(),
    db.rpc('activity_targets', { p_household: record.household_id, p_actor: record.created_by }),
  ]);
  if (targets.error) return new Response(targets.error.message, { status: 500 });

  const body = activityBody(actor.data?.display_name ?? '', items.map((i) => i.text));
  const messages = buildMessages(
    ((targets.data ?? []) as { token: string }[]).map((t) => t.token),
    { title: 'Veedu', body, url: '/shop' },
  );

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
  return Response.json({ sent: messages.length, items: items.length });
});
