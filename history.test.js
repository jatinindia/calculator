import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterHistory, setLabel } from './history.js';

const history = Object.freeze([
  Object.freeze({ id: 'a', expr: '1200×12', result: 14400, at: 1, label: 'Rent for the year' }),
  Object.freeze({ id: 'b', expr: '450×0.8', result: 360, at: 2 }),
  Object.freeze({ id: 'c', expr: '2^20', result: 1048576, at: 3 }),
]);

test('empty query returns everything', () => {
  assert.equal(filterHistory(history, '  ').length, 3);
});

test('search matches labels case-insensitively', () => {
  assert.deepEqual(filterHistory(history, 'rent').map((h) => h.id), ['a']);
});

test('search matches expressions, accepting keyboard operators', () => {
  assert.deepEqual(filterHistory(history, '450').map((h) => h.id), ['b']);
  assert.deepEqual(filterHistory(history, '450*0.8').map((h) => h.id), ['b']);
});

test('search matches results with or without separators', () => {
  assert.deepEqual(filterHistory(history, '1,048,576').map((h) => h.id), ['c']);
  assert.deepEqual(filterHistory(history, '14400').map((h) => h.id), ['a']);
});

test('setLabel adds, trims and removes labels without mutating', () => {
  const labelled = setLabel(history, 'b', '  Discount  ');
  assert.equal(labelled[1].label, 'Discount');
  assert.equal(history[1].label, undefined);
  const cleared = setLabel(labelled, 'b', '   ');
  assert.equal('label' in cleared[1], false);
  assert.throws(() => setLabel(history, 'zzz', 'x'), /History entry "zzz" not found/);
});
