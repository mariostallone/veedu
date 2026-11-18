/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activityBody,
  buildMessages,
  chunk,
  deadTokens,
  digestContent,
  isDigestDue,
  localDateHour,
} from './notify.ts';

test('activityBody', () => {
  assert.equal(activityBody('Priya', ['Ghee']), 'Priya added Ghee to Shopping');
  assert.equal(activityBody('Priya', ['a', 'b', 'c', 'd', 'e']), 'Priya added 5 items to Shopping');
  assert.equal(activityBody('  ', ['a', 'b']), 'Your partner added 2 items to Shopping');
});

test('buildMessages de-duplicates tokens and carries the tap target', () => {
  const m = buildMessages(['T1', 'T2', 'T1'], { body: 'hi', url: '/shop' });
  assert.deepEqual(m.map((x) => x.to), ['T1', 'T2']);
  assert.equal(m[0].data.url, '/shop');
});

test('chunk', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 2), []);
});

test('localDateHour follows the time zone, including the date', () => {
  const t = Date.UTC(2026, 10, 18, 20, 30); // 20:30 UTC on 18 Nov
  assert.deepEqual(localDateHour(t, 'UTC'), { date: '2026-11-18', hour: 20 });
  assert.deepEqual(localDateHour(t, 'Asia/Kolkata'), { date: '2026-11-19', hour: 2 });
  assert.deepEqual(localDateHour(t, 'America/Los_Angeles'), { date: '2026-11-18', hour: 12 });
  assert.deepEqual(localDateHour(Date.UTC(2026, 10, 18, 0, 5), 'UTC'), { date: '2026-11-18', hour: 0 });
  assert.deepEqual(localDateHour(t, 'Not/AZone'), { date: '2026-11-18', hour: 20 });
});

test('isDigestDue matches the local hour only', () => {
  const t = Date.UTC(2026, 10, 18, 2, 40);
  assert.equal(isDigestDue({ digest_hour: 8, timezone: 'Asia/Kolkata' }, t), true); // 08:10 in Kolkata
  assert.equal(isDigestDue({ digest_hour: 8, timezone: 'UTC' }, t), false);
  assert.equal(isDigestDue({ digest_hour: 2, timezone: 'UTC' }, t), true);
});

test('digestContent', () => {
  assert.equal(digestContent([]), null);
  const d = digestContent([
    { kind: 'overdue', title: 'Call Amma', on_date: '2026-11-16' },
    { kind: 'due_today', title: 'Pay rent', on_date: '2026-11-18' },
    { kind: 'expiring', title: 'Milk', on_date: '2026-11-20' },
  ]);
  assert.equal(d?.title, 'Today: 2 to-dos (1 overdue), 1 item expiring');
  assert.equal(d?.body, 'Overdue: Call Amma\nDue today: Pay rent\nExpiring this week: Milk');
  assert.equal(d?.url, '/todo');

  const pantryOnly = digestContent(
    ['a', 'b', 'c', 'd', 'e'].map((title) => ({ kind: 'expiring' as const, title, on_date: '2026-11-20' })),
  );
  assert.equal(pantryOnly?.title, 'Today: 5 items expiring');
  assert.equal(pantryOnly?.body, 'Expiring this week: a, b, c +2 more');
  assert.equal(pantryOnly?.url, '/pantry');
  assert.equal(digestContent([{ kind: 'due_today', title: 'x', on_date: '2026-11-18' }])?.title, 'Today: 1 to-do today');
});

test('deadTokens picks only unregistered devices', () => {
  const msgs = [{ to: 'A' }, { to: 'B' }, { to: 'C' }];
  assert.deepEqual(
    deadTokens(msgs, [
      { status: 'ok' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', details: { error: 'MessageRateExceeded' } },
    ]),
    ['B'],
  );
});
