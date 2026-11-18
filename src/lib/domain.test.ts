/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  daysBetween,
  describeActivity,
  expiryStatus,
  formatQty,
  groupBy,
  homeStats,
  initials,
  needsAttention,
  recentActivity,
  relativeDay,
  restockQty,
  timeAgo,
  todoBucket,
  tripProgress,
} from './domain.ts';

test('restockQty tops up to keep_min, rounding up partial units', () => {
  assert.equal(restockQty(1, 2), 1);
  assert.equal(restockQty(0, 2), 2);
  assert.equal(restockQty(2, 2), 0);
  assert.equal(restockQty(5, 2), 0);
  assert.equal(restockQty(0.5, 2), 2);
  assert.equal(restockQty(1.9, 2), 1);
});

test('daysBetween and addDays cross month and year boundaries', () => {
  assert.equal(daysBetween('2026-11-18', '2026-11-21'), 3);
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.equal(daysBetween('2026-11-18', '2026-11-10'), -8);
  assert.equal(addDays('2026-11-21', 14), '2026-12-05');
  assert.equal(addDays('2026-12-25', 10), '2027-01-04');
});

test('expiryStatus', () => {
  const today = '2026-11-18';
  assert.deepEqual(expiryStatus(null, today), { kind: 'none' });
  assert.deepEqual(expiryStatus('2026-11-17', today), { kind: 'expired', days: -1 });
  assert.deepEqual(expiryStatus('2026-11-18', today), { kind: 'soon', days: 0 });
  assert.deepEqual(expiryStatus('2026-12-18', today), { kind: 'soon', days: 30 });
  assert.deepEqual(expiryStatus('2027-01-31', today), { kind: 'ok', days: 74 });
});

test('groupBy keeps first-seen order, honours explicit order, puts fallback last', () => {
  const items = [
    { n: 'milk', s: 'Supermarket' },
    { n: 'tp', s: null },
    { n: 'rice', s: 'Patel Brothers' },
    { n: 'bread', s: 'Supermarket' },
  ];
  assert.deepEqual(
    groupBy(items, (i) => i.s).map((g) => [g.key, g.items.map((i) => i.n)]),
    [
      ['Supermarket', ['milk', 'bread']],
      ['Patel Brothers', ['rice']],
      ['Other', ['tp']],
    ],
  );
  assert.deepEqual(
    groupBy(items, (i) => i.s, { order: ['Patel Brothers'], fallback: 'Anywhere' }).map((g) => g.key),
    ['Patel Brothers', 'Supermarket', 'Anywhere'],
  );
});

test('formatQty pluralises countable units only', () => {
  assert.equal(formatQty(1, 'bag'), '1 bag');
  assert.equal(formatQty(3, 'bag'), '3 bags');
  assert.equal(formatQty(2, 'box'), '2 boxes');
  assert.equal(formatQty(1.5, 'kg'), '1.5 kg');
  assert.equal(formatQty(12, 'roll'), '12 rolls');
});

test('todoBucket', () => {
  const today = '2026-11-18';
  assert.equal(todoBucket({ done: true, due_on: '2026-11-01' }, today), 'done');
  assert.equal(todoBucket({ done: false, due_on: null }, today), 'someday');
  assert.equal(todoBucket({ done: false, due_on: '2026-11-17' }, today), 'overdue');
  assert.equal(todoBucket({ done: false, due_on: '2026-11-18' }, today), 'today');
  assert.equal(todoBucket({ done: false, due_on: '2026-11-25' }, today), 'this_week');
  assert.equal(todoBucket({ done: false, due_on: '2026-11-26' }, today), 'later');
});

test('tripProgress multiplies cost by qty', () => {
  assert.deepEqual(
    tripProgress([
      { done: true, cost: 85, qty: 1 },
      { done: false, cost: 150, qty: 1 },
      { done: true, cost: 10, qty: 6 },
      { done: false, cost: null, qty: 1 },
    ]),
    { done: 2, total: 4, spent: 145, planned: 295 },
  );
});

test('relativeDay', () => {
  const today = '2026-11-18';
  assert.equal(relativeDay('2026-11-18', today), 'Today');
  assert.equal(relativeDay('2026-11-19', today), 'Tomorrow');
  assert.equal(relativeDay('2026-11-17', today), 'Yesterday');
  assert.equal(relativeDay('2026-11-21', today), 'in 3 days');
  assert.equal(relativeDay('2026-11-14', today), '4 days ago');
  assert.equal(relativeDay('2026-12-18', today), '18 Dec');
  assert.equal(relativeDay('2027-01-02', today), '2 Jan 2027');
});

test('initials', () => {
  assert.equal(initials('Priya'), 'P');
  assert.equal(initials('  amma appa extra '), 'AA');
  assert.equal(initials(''), '?');
});

// --- Home (M5) ---

const pantryRow = (over: Record<string, unknown>) => ({
  id: 'p', name: 'Rice', unit: 'bag', qty: 3, keep_min: 1, expires_on: null as string | null, ...over,
});

test('homeStats counts low, expiring, shopping and to-dos this week', () => {
  const today = '2026-11-18';
  const stats = homeStats(
    [
      pantryRow({ qty: 0, keep_min: 2 }),
      pantryRow({ expires_on: '2026-12-10' }),
      pantryRow({ expires_on: '2026-11-01' }),
      pantryRow({ expires_on: '2027-03-01' }),
    ],
    [
      { done: false, due_on: '2026-11-10' },
      { done: false, due_on: '2026-11-25' },
      { done: false, due_on: '2026-11-26' },
      { done: false, due_on: null },
      { done: true, due_on: '2026-11-19' },
    ],
    4,
    today,
  );
  assert.deepEqual(stats, { low: 1, expiring: 2, shopping: 4, todosThisWeek: 2 });
});

test('needsAttention orders by urgency, caps at max and reports the total', () => {
  const today = '2026-11-18';
  const pantry = [
    pantryRow({ id: 'low', name: 'Dal', qty: 1, keep_min: 2 }),
    pantryRow({ id: 'soon', name: 'Milk', expires_on: '2026-11-20' }),
    pantryRow({ id: 'old', name: 'Curd', expires_on: '2026-11-15' }),
    pantryRow({ id: 'far', name: 'Ghee', expires_on: '2026-12-30' }),
    pantryRow({ id: 'both', name: 'Bread', qty: 0, keep_min: 1, expires_on: '2026-11-19' }),
  ];
  const todos = [
    { id: 't1', text: 'Pay rent', done: false, due_on: '2026-11-17' },
    { id: 't2', text: 'Call Amma', done: false, due_on: '2026-11-18' },
    { id: 't3', text: 'Old thing', done: true, due_on: '2026-11-01' },
  ];
  const r = needsAttention(pantry, todos, today, 5);
  assert.equal(r.total, 5);
  assert.deepEqual(r.items.map((i) => i.key), ['todo:t1', 'expiry:old', 'expiry:both', 'expiry:soon', 'low:low']);
  assert.equal(r.items[0].detail, 'Due yesterday');
  assert.equal(r.items[1].detail, 'Expired 3 days ago');
  assert.equal(r.items[3].detail, 'Expires in 2 days');
  assert.equal(r.items[4].detail, '1 bag left, keep 2 bags');
  const capped = needsAttention(pantry, todos, today, 2);
  assert.equal(capped.items.length, 2);
  assert.equal(capped.total, 5);
  assert.equal(capped.all.length, 5);
});

test('recentActivity groups per person, list, verb and hour', () => {
  const now = Date.parse('2026-11-18T12:00:00Z');
  const item = (text: string, over: Record<string, unknown> = {}) => ({
    text,
    list_id: 'shop',
    created_by: 'priya',
    created_at: '2026-11-18T10:05:00Z',
    done: false,
    done_at: null as string | null,
    done_by: null as string | null,
    ...over,
  });
  const lists = [{ id: 'shop', title: 'Shopping' }, { id: 'trip', title: 'India trip' }];
  const entries = recentActivity(
    [
      item('Milk'),
      item('Eggs', { created_at: '2026-11-18T10:50:00Z' }),
      item('Ghee', { created_at: '2026-11-18T11:10:00Z' }),
      item('Pashmina shawl', {
        list_id: 'trip',
        created_by: 'arjun',
        created_at: '2026-11-01T10:00:00Z',
        done: true,
        done_at: '2026-11-18T09:30:00Z',
        done_by: 'arjun',
      }),
      item('Ancient', { created_at: '2026-10-01T10:00:00Z' }),
      item('Orphan', { list_id: 'gone' }),
    ],
    lists,
    [
      {
        name: 'Rice',
        created_by: 'arjun',
        created_at: '2026-10-01T10:00:00Z',
        updated_by: 'arjun',
        updated_at: '2026-11-17T08:00:00Z',
      },
    ],
    now,
  );
  assert.deepEqual(
    entries.map((e) => [e.userId, e.verb, e.target, e.count]),
    [
      ['priya', 'added', 'Shopping', 1],
      ['priya', 'added', 'Shopping', 2],
      ['arjun', 'checked_off', 'India trip', 1],
      ['arjun', 'updated', 'Pantry', 1],
    ],
  );
  assert.equal(describeActivity(entries[1], 'Priya'), 'Priya added 2 items to Shopping');
  assert.equal(describeActivity(entries[0], 'Priya'), 'Priya added Ghee to Shopping');
  assert.equal(describeActivity(entries[2], 'Arjun'), 'Arjun checked off Pashmina shawl');
  assert.equal(describeActivity(entries[3], 'Arjun'), 'Arjun updated Rice');
});

test('timeAgo', () => {
  const now = 10_000_000_000;
  assert.equal(timeAgo(now - 20_000, now), 'just now');
  assert.equal(timeAgo(now - 5 * 60_000, now), '5m ago');
  assert.equal(timeAgo(now - 3 * 3_600_000, now), '3h ago');
  assert.equal(timeAgo(now - 50 * 3_600_000, now), '2d ago');
});
