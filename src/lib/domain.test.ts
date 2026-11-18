/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  cacheBuster,
  isReachable,
  retryDelay,
  daysBetween,
  daysToGo,
  DEFAULT_STORES,
  describeActivity,
  expiryLabel,
  expiryStatus,
  filterPantry,
  filterTodosByOwner,
  findDuplicateItem,
  formatMoney,
  formatQty,
  groupBy,
  groupShopping,
  homeStats,
  initials,
  isValidIsoDate,
  mergeSuggestions,
  monthGrid,
  monthTitle,
  needsAttention,
  parseAmount,
  parseQty,
  parseQuickAdd,
  quickPickDate,
  recentActivity,
  recentlyDone,
  relativeDay,
  repeatLabel,
  restockQty,
  shiftMonth,
  stockLevel,
  storeOptions,
  templateItems,
  timeAgo,
  todoBucket,
  tripProgress,
  weekdayOf,
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

test('cacheBuster changes with the app version', () => {
  assert.equal(cacheBuster('1.0.0'), 'veedu-cache-v1.0.0');
  assert.notEqual(cacheBuster('1.0.0'), cacheBuster('1.0.1'));
  assert.equal(cacheBuster(undefined), 'veedu-cache-v0');
});

test('retryDelay backs off exponentially and caps', () => {
  assert.equal(retryDelay(0), 1000);
  assert.equal(retryDelay(1), 2000);
  assert.equal(retryDelay(3), 8000);
  assert.equal(retryDelay(10), 30_000);
  assert.equal(retryDelay(-2), 1000);
});

test('isReachable treats unknown as online', () => {
  assert.equal(isReachable({ isConnected: true, isInternetReachable: true }), true);
  assert.equal(isReachable({ isConnected: true, isInternetReachable: null }), true);
  assert.equal(isReachable({ isConnected: false, isInternetReachable: false }), false);
  assert.equal(isReachable({ isConnected: true, isInternetReachable: false }), false);
});
