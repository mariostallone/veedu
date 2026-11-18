/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  daysBetween,
  expiryStatus,
  filterTodosByOwner,
  formatQty,
  groupBy,
  initials,
  monthGrid,
  monthTitle,
  quickPickDate,
  recentlyDone,
  repeatLabel,
  shiftMonth,
  weekdayOf,
  relativeDay,
  restockQty,
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

// --- To-dos (M3) ---

test('repeatLabel', () => {
  assert.equal(repeatLabel(null), null);
  assert.equal(repeatLabel(1), 'Every day');
  assert.equal(repeatLabel(7, '2026-11-22'), 'Every Sunday');
  assert.equal(repeatLabel(7, null), 'Every week');
  assert.equal(repeatLabel(14, '2026-11-22'), 'Every 2 weeks');
  assert.equal(repeatLabel(30), 'Every month');
  assert.equal(repeatLabel(5), 'Every 5 days');
});

test('weekdayOf', () => {
  assert.equal(weekdayOf('2026-11-18'), 3);
  assert.equal(weekdayOf('2026-11-22'), 0);
});

test('quickPickDate (Wed 2026-11-18)', () => {
  const today = '2026-11-18';
  assert.equal(quickPickDate('today', today), '2026-11-18');
  assert.equal(quickPickDate('tomorrow', today), '2026-11-19');
  assert.equal(quickPickDate('weekend', today), '2026-11-21');
  assert.equal(quickPickDate('next_week', today), '2026-11-23');
  assert.equal(quickPickDate('weekend', '2026-11-21'), '2026-11-21');
  assert.equal(quickPickDate('weekend', '2026-11-22'), '2026-11-22');
  assert.equal(quickPickDate('next_week', '2026-11-23'), '2026-11-30');
});

test('monthGrid starts on Monday and pads with nulls', () => {
  const weeks = monthGrid(2026, 10); // November 2026 starts on a Sunday
  assert.equal(weeks[0].filter((d) => d === null).length, 6);
  assert.equal(weeks[0][6], '2026-11-01');
  assert.equal(weeks.at(-1)?.includes('2026-11-30'), true);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks.flat().filter(Boolean).length, 30);
});

test('shiftMonth and monthTitle wrap years', () => {
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
  assert.equal(monthTitle(2026, 10), 'November 2026');
});

test('filterTodosByOwner', () => {
  const items = [{ owner_id: 'a' }, { owner_id: 'b' }, { owner_id: null }];
  assert.equal(filterTodosByOwner(items, 'everyone', 'a', ['b']).length, 3);
  assert.deepEqual(filterTodosByOwner(items, 'mine', 'a', ['b']), [{ owner_id: 'a' }]);
  assert.deepEqual(filterTodosByOwner(items, 'partner', 'a', ['b']), [{ owner_id: 'b' }]);
});

test('recentlyDone returns newest first, capped', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ done_at: `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00Z` }));
  const out = recentlyDone(items, 10);
  assert.equal(out.length, 10);
  assert.equal(out[0].done_at, '2026-11-12T10:00:00Z');
});
