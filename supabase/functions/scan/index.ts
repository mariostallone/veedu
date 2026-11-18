// Supabase Edge Function (Deno): reads a product label or a shopping note from a photo with Claude.
// Deploy:  supabase functions deploy scan
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Only signed-in household members may call it. All parsing/validation lives in parse.ts.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { buildAnthropicBody, extractText, parseModelReply, parseRequest } from './parse.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  // 1. The caller must be a signed-in household member (RLS lets members read their own membership row).
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sign in first.' }, 401);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Sign in first.' }, 401);
  const { data: memberships, error: memberError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userData.user.id)
    .limit(1);
  if (memberError) return json({ error: 'Could not check your household.' }, 500);
  if (!memberships || memberships.length === 0) return json({ error: 'Only household members can scan.' }, 403);

  // 2. Validate the request (mode, media type, base64, size).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send a JSON body.' }, 400);
  }
  const parsed = parseRequest(body);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.error.includes('5 MB') ? 413 : 400);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Scanning is not set up: ANTHROPIC_API_KEY is missing.' }, 500);

  // 3. Ask Claude and validate what comes back.
  const today = new Date().toISOString().slice(0, 10);
  let upstream: Response;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(buildAnthropicBody(parsed.value, today)),
    });
  } catch {
    return json({ error: 'Could not reach the scanning service. Try again.' }, 502);
  }
  if (!upstream.ok) {
    console.error('Anthropic error', upstream.status, await upstream.text().catch(() => ''));
    return json({ error: 'The scanning service failed. Try again in a moment.' }, 502);
  }
  const result = parseModelReply(parsed.value.mode, extractText(await upstream.json()));
  if (!result.ok) return json({ error: result.error }, 422);
  return json({ mode: parsed.value.mode, result: result.value });
});
