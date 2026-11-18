/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  base64ByteLength,
  buildAnthropicBody,
  buildPrompt,
  extractText,
  MAX_IMAGE_BYTES,
  parseJsonText,
  parseModelReply,
  parseRequest,
} from './parse.ts';

const png = Buffer.from('hello world').toString('base64');

test('parseRequest accepts a valid label request and cleans the hint lists', () => {
  const r = parseRequest({ mode: 'label', image: png, media_type: 'image/png', stores: [' Costco ', 'Costco', 3], categories: ['Spices'] });
  assert.ok(r.ok);
  assert.equal(r.value.mediaType, 'image/png');
  assert.deepEqual(r.value.stores, ['Costco']);
  assert.deepEqual(r.value.categories, ['Spices']);
});

test('parseRequest defaults to jpeg and rejects bad input', () => {
  const ok = parseRequest({ mode: 'note', image: png });
  assert.ok(ok.ok && ok.value.mediaType === 'image/jpeg');
  assert.ok(!parseRequest(null).ok);
  assert.ok(!parseRequest({ mode: 'other', image: png }).ok);
  assert.ok(!parseRequest({ mode: 'note' }).ok);
  assert.ok(!parseRequest({ mode: 'note', image: png, media_type: 'application/pdf' }).ok);
  assert.ok(!parseRequest({ mode: 'note', image: 'data:image/png;base64,' + png }).ok);
});

test('parseRequest rejects images over 5 MB', () => {
  const big = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8);
  const r = parseRequest({ mode: 'label', image: big });
  assert.ok(!r.ok);
  assert.match(r.error, /5 MB/);
  assert.equal(base64ByteLength(png), 'hello world'.length);
});

test('buildPrompt mentions the requested shape and store hints', () => {
  const label = buildPrompt({ mode: 'label', stores: [], categories: ['Frozen'] }, '2026-11-18');
  assert.match(label, /expires_on/);
  assert.match(label, /Frozen/);
  assert.match(label, /2026-11-18/);
  const note = buildPrompt({ mode: 'note', stores: ['Patel Brothers'], categories: [] }, '2026-11-18');
  assert.match(note, /store_guess/);
  assert.match(note, /Patel Brothers/);
});

test('buildAnthropicBody puts the image before the prompt', () => {
  const body = buildAnthropicBody({ mode: 'note', image: png, mediaType: 'image/jpeg', stores: [], categories: [] }, '2026-11-18');
  assert.equal(body.model, 'claude-sonnet-5-5');
  assert.equal(body.messages[0].content[0].type, 'image');
  assert.equal(body.messages[0].content[1].type, 'text');
});

test('extractText joins text blocks and ignores others', () => {
  assert.equal(extractText({ content: [{ type: 'text', text: 'a' }, { type: 'tool_use' }, { type: 'text', text: 'b' }] }), 'a\nb');
  assert.equal(extractText(null), '');
});

test('parseJsonText handles fences and surrounding prose', () => {
  assert.deepEqual(parseJsonText('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonText('Here you go: [{"text":"milk"}] hope that helps'), [{ text: 'milk' }]);
  assert.equal(parseJsonText('no json here'), undefined);
});

test('label replies are validated and normalised', () => {
  const r = parseModelReply(
    'label',
    '{"name":" Basmati rice ","size":"5","unit":"KG","expires_on":"2027-03-31","category":"Grains & pulses"}',
  );
  assert.ok(r.ok);
  assert.deepEqual(r.value, { name: 'Basmati rice', size: 5, unit: 'kg', expires_on: '2027-03-31', category: 'Grains & pulses' });
});

test('label replies drop impossible dates and values, and need a name', () => {
  const r = parseModelReply('label', '{"name":"Ghee","size":-1,"unit":"","expires_on":"2027-02-31","category":null}');
  assert.ok(r.ok);
  assert.deepEqual(r.value, { name: 'Ghee', size: null, unit: null, expires_on: null, category: null });
  assert.ok(!parseModelReply('label', '{"name":null}').ok);
  assert.ok(!parseModelReply('label', 'sorry').ok);
});

test('note replies keep valid items, default qty to 1 and accept {items}', () => {
  const r = parseModelReply(
    'note',
    '[{"text":"Milk","qty":2,"store_guess":"Costco"},{"text":" Onions ","qty":"x"},{"qty":3},"junk",{"text":"Atta","qty":0,"store_guess":""}]',
  );
  assert.ok(r.ok);
  assert.deepEqual(r.value, [
    { text: 'Milk', qty: 2, store_guess: 'Costco' },
    { text: 'Onions', qty: 1, store_guess: null },
    { text: 'Atta', qty: 1, store_guess: null },
  ]);
  const wrapped = parseModelReply('note', '{"items":[{"text":"Eggs","qty":12}]}');
  assert.ok(wrapped.ok && (wrapped.value as unknown[]).length === 1);
  const none = parseModelReply('note', '[]');
  assert.ok(none.ok && (none.value as unknown[]).length === 0);
  assert.ok(!parseModelReply('note', '{"nope":true}').ok);
});
