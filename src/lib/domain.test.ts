/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  daysBetween,
  daysToGo,
  expiryStatus,
  formatQty,
  groupBy,
  formatMoney,
  initials,
  isValidIsoDate,
  parseAmount,
  relativeDay,
  restockQty,
  templateItems,
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

test('isValidIsoDate rejects impossible dates', () => {
  assert.equal(isValidIsoDate('2027-02-28'), true);
  assert.equal(isValidIsoDate('2027-02-30'), false);
  assert.equal(isValidIsoDate('2027-2-3'), false);
  assert.equal(isValidIsoDate('abc'), false);
});

test('parseAmount handles commas, blanks and junk', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('1,200'), 1200);
  assert.equal(parseAmount('45.5'), 45.5);
  assert.ok(Number.isNaN(parseAmount('-3')));
  assert.ok(Number.isNaN(parseAmount('12a')));
});

test('formatMoney groups thousands', () => {
  assert.equal(formatMoney(1200), '1,200');
  assert.equal(formatMoney(4.5), '4.50');
  assert.equal(formatMoney(0), '0');
});

test('daysToGo describes the countdown', () => {
  assert.equal(daysToGo(null, '2026-11-18'), null);
  assert.equal(daysToGo('2026-11-18', '2026-11-18'), 'Departs today');
  assert.equal(daysToGo('2026-11-19', '2026-11-18'), 'Departs tomorrow');
  assert.equal(daysToGo('2026-12-18', '2026-11-18'), '30 days to go');
  assert.equal(daysToGo('2026-11-10', '2026-11-18'), 'Started 8 days ago');
});

test('templateItems copies content but unchecks everything', () => {
  const out = templateItems([
    { text: 'Saree', qty: 2, note: 'silk', category: 'gifts', group_name: 'Amma', owner_id: 'u1', cost: 50, done: true },
  ] as never[]);
  assert.deepEqual(out, [
    { text: 'Saree', qty: 2, note: 'silk', category: 'gifts', group_name: 'Amma', owner_id: 'u1', cost: 50, done: false },
  ]);
});
