/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  daysBetween,
  DEFAULT_STORES,
  expiryLabel,
  expiryStatus,
  filterPantry,
  findDuplicateItem,
  formatQty,
  groupBy,
  groupShopping,
  initials,
  isValidIsoDate,
  mergeSuggestions,
  parseQty,
  parseQuickAdd,
  relativeDay,
  restockQty,
  stockLevel,
  storeOptions,
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

test('mergeSuggestions puts existing values first and skips case-insensitive duplicates', () => {
  assert.deepEqual(mergeSuggestions(['Spices', ' pulses ', null, 'Spices'], ['spices', 'Snacks']), [
    'pulses',
    'Spices',
    'Snacks',
  ]);
});

test('filterPantry searches name, category and store and narrows by category', () => {
  const items = [
    { name: 'Basmati rice', category: 'Grains & pulses', store: 'Patel Brothers' },
    { name: 'Haldi', category: 'Spices', store: null },
    { name: 'Soap', category: '', store: null },
  ];
  assert.equal(filterPantry(items, '').length, 3);
  assert.deepEqual(filterPantry(items, ' RICE ').map((i) => i.name), ['Basmati rice']);
  assert.deepEqual(filterPantry(items, 'patel').map((i) => i.name), ['Basmati rice']);
  assert.deepEqual(filterPantry(items, '', 'Spices').map((i) => i.name), ['Haldi']);
  assert.deepEqual(filterPantry(items, '', 'Other').map((i) => i.name), ['Soap']);
  assert.deepEqual(filterPantry(items, 'rice', 'Spices'), []);
});

test('stockLevel', () => {
  assert.equal(stockLevel(1, 2), 0.5);
  assert.equal(stockLevel(3, 2), 1);
  assert.equal(stockLevel(0, 2), 0);
  assert.equal(stockLevel(2, 0), 1);
  assert.equal(stockLevel(0, 0), 0);
});

test('isValidIsoDate and parseQty', () => {
  assert.equal(isValidIsoDate('2026-11-18'), true);
  assert.equal(isValidIsoDate('2026-02-30'), false);
  assert.equal(isValidIsoDate('18-11-2026'), false);
  assert.equal(parseQty('2'), 2);
  assert.equal(parseQty('1,5'), 1.5);
  assert.equal(parseQty(''), 0);
  assert.equal(parseQty('-1'), null);
  assert.equal(parseQty('abc'), null);
});

test('expiryLabel', () => {
  assert.equal(expiryLabel({ kind: 'none' }), null);
  assert.equal(expiryLabel({ kind: 'ok', days: 90 }), null);
  assert.equal(expiryLabel({ kind: 'expired', days: -1 }), 'Expired yesterday');
  assert.equal(expiryLabel({ kind: 'expired', days: -5 }), 'Expired 5d ago');
  assert.equal(expiryLabel({ kind: 'soon', days: 0 }), 'Expires today');
  assert.equal(expiryLabel({ kind: 'soon', days: 12 }), 'Expires in 12d');
});

// --- Shopping (M2) ---

test('parseQuickAdd reads trailing and leading quantities', () => {
  assert.deepEqual(parseQuickAdd('milk x2'), { text: 'milk', qty: 2 });
  assert.deepEqual(parseQuickAdd('Milk ×2'), { text: 'Milk', qty: 2 });
  assert.deepEqual(parseQuickAdd('basmati rice X 3'), { text: 'basmati rice', qty: 3 });
  assert.deepEqual(parseQuickAdd('2 milk'), { text: 'milk', qty: 2 });
  assert.deepEqual(parseQuickAdd('2x milk'), { text: 'milk', qty: 2 });
  assert.deepEqual(parseQuickAdd('3 x toor dal'), { text: 'toor dal', qty: 3 });
  assert.deepEqual(parseQuickAdd('1.5 onions'), { text: 'onions', qty: 1.5 });
  assert.deepEqual(parseQuickAdd('  eggs  '), { text: 'eggs', qty: 1 });
});

test('parseQuickAdd leaves numbers that belong to the name', () => {
  assert.deepEqual(parseQuickAdd('2% milk'), { text: '2% milk', qty: 1 });
  assert.deepEqual(parseQuickAdd('7up'), { text: '7up', qty: 1 });
  assert.deepEqual(parseQuickAdd('2'), { text: '2', qty: 1 });
  assert.deepEqual(parseQuickAdd('x2'), { text: 'x2', qty: 1 });
  assert.deepEqual(parseQuickAdd('0 milk'), { text: 'milk', qty: 1 });
});

test('findDuplicateItem matches unchecked items by name', () => {
  const items = [
    { text: 'Milk', done: false },
    { text: 'Eggs', done: true },
  ];
  assert.equal(findDuplicateItem(items, '  milk '), items[0]);
  assert.equal(findDuplicateItem(items, 'eggs'), undefined);
  assert.equal(findDuplicateItem(items, 'bread'), undefined);
  assert.equal(findDuplicateItem(items, ''), undefined);
});

test('storeOptions puts used stores first, then unused defaults', () => {
  const items = [{ group_name: 'Lidl' }, { group_name: 'Costco' }, { group_name: 'Lidl' }, { group_name: null }];
  assert.deepEqual(storeOptions(items), ['Lidl', 'Costco', 'Indian grocery', 'Supermarket']);
  assert.deepEqual(storeOptions([]), [...DEFAULT_STORES]);
});

test('groupShopping groups unchecked by store and separates the cart', () => {
  const items = [
    { id: 1, done: false, group_name: 'Costco' },
    { id: 2, done: true, group_name: 'Costco' },
    { id: 3, done: false, group_name: null },
    { id: 4, done: false, group_name: 'Costco' },
  ];
  const { toBuy, inCart } = groupShopping(items);
  assert.deepEqual(
    toBuy.map((g) => [g.key, g.items.map((i) => i.id)]),
    [
      ['Costco', [1, 4]],
      ['No store', [3]],
    ],
  );
  assert.deepEqual(inCart.map((i) => i.id), [2]);
});
