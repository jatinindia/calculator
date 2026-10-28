import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, convertUnit, convertCurrency, parseRatesResponse, searchOptions, sanitizeRates } from './convert.js';
import { formatNumber } from './calc.js';

const shown = (value, category, from, to) => formatNumber(convertUnit(value, category, from, to));

test('length, weight, area, volume, speed', () => {
  assert.equal(shown(1, 'length', 'km', 'm'), '1,000');
  assert.equal(shown(1, 'length', 'mi', 'km'), '1.609344');
  assert.equal(shown(12, 'length', 'in', 'ft'), '1');
  assert.equal(shown(1, 'weight', 'kg', 'lb'), '2.20462262184878');
  assert.equal(shown(1, 'area', 'acre', 'm2'), '4,046.8564224');
  assert.equal(shown(1, 'volume', 'gal', 'l'), '3.785411784');
  assert.equal(shown(100, 'speed', 'kmh', 'ms'), '27.7777777777778');
});

test('temperature uses offsets, not just factors', () => {
  assert.equal(shown(100, 'temperature', 'c', 'f'), '212');
  assert.equal(shown(32, 'temperature', 'f', 'c'), '0');
  assert.equal(shown(0, 'temperature', 'c', 'k'), '273.15');
  assert.equal(shown(-40, 'temperature', 'c', 'f'), '-40');
});

test('time and data', () => {
  assert.equal(shown(1, 'time', 'h', 'min'), '60');
  assert.equal(shown(1, 'data', 'gib', 'b'), '1,073,741,824');
  assert.equal(shown(1, 'data', 'gb', 'mb'), '1,000');
});

test('unknown category or unit throws with context', () => {
  assert.throws(() => convertUnit(1, 'nope', 'm', 'km'), /Unknown category "nope"/);
  assert.throws(() => convertUnit(1, 'length', 'm', 'parsec'), /Unknown unit "parsec" in length/);
});

test('every unit round-trips and ids are unique within a category', () => {
  for (const category of CATEGORIES) {
    const ids = category.units.map((u) => u.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate unit id in ${category.id}`);
    for (const unit of category.units) {
      const back = unit.fromBase(unit.toBase(5));
      assert.ok(Math.abs(back - 5) < 1e-9, `${category.id}/${unit.id} round trip gave ${back}`);
    }
  }
});

test('currency converts through the common base', () => {
  const rates = { USD: 1, EUR: 0.9, INR: 83 };
  assert.equal(convertCurrency(100, 'USD', 'INR', rates), 8300);
  assert.equal(formatNumber(convertCurrency(100, 'EUR', 'INR', rates)), '9,222.22222222222');
  assert.equal(convertCurrency(5, 'INR', 'INR', rates), 5);
  assert.throws(() => convertCurrency(1, 'USD', 'XYZ', rates), /No rate for XYZ/);
});

test('rates response is validated', () => {
  const ok = parseRatesResponse({
    result: 'success', base_code: 'USD', time_last_update_unix: 1700000000, rates: { USD: 1, INR: 83.1 },
  });
  assert.deepEqual(ok, { base: 'USD', updatedAt: 1700000000000, rates: { USD: 1, INR: 83.1 } });
  assert.throws(() => parseRatesResponse({ result: 'error', 'error-type': 'unsupported-code' }), /unsupported-code/);
  assert.throws(() => parseRatesResponse({ result: 'success', base_code: 'USD', rates: { INR: 'x' } }), /Unexpected rates response/);
});

test('picker search ranks code matches before name matches', () => {
  const options = [
    { id: 'USD', code: 'USD', name: 'US Dollar' },
    { id: 'INR', code: 'INR', name: 'Indian Rupee' },
    { id: 'IDR', code: 'IDR', name: 'Indonesian Rupiah' },
    { id: 'AUD', code: 'AUD', name: 'Australian Dollar' },
    { id: 'SGD', code: 'SGD', name: 'Singapore Dollar' },
  ];
  const ids = (q) => searchOptions(options, q).map((o) => o.id);
  assert.equal(searchOptions(options, '  ').length, 5);
  assert.deepEqual(ids('inr'), ['INR']);
  assert.deepEqual(ids('dollar'), ['USD', 'AUD', 'SGD']);
  assert.deepEqual(ids('rup'), ['INR', 'IDR']);
  assert.deepEqual(ids('i'), ['INR', 'IDR', 'AUD', 'SGD']);
  assert.deepEqual(ids('xyz'), []);
  assert.deepEqual(searchOptions([{ id: 'ft', code: 'ft', name: 'Foot' }], 'FOO').map((o) => o.id), ['ft']);
});

test('rates from the network or storage keep only real currency codes and positive numbers', () => {
  const parsed = parseRatesResponse({
    result: 'success', base_code: 'USD', time_last_update_unix: 1700000000,
    rates: { USD: 1, INR: 83, '<img src=x onerror=alert(1)>': 2, __proto__x: 3, toString: 4, eur: 5 },
  });
  assert.deepEqual(Object.keys(parsed.rates), ['USD', 'INR']);
  assert.throws(() => parseRatesResponse({ result: 'success', base_code: 'USD', time_last_update_unix: 1, rates: { INR: -1 } }), /Unexpected rates response/);
  assert.throws(() => parseRatesResponse({ result: 'success', base_code: 'USD', time_last_update_unix: 1, rates: { INR: Infinity } }), /Unexpected rates response/);
  assert.deepEqual(sanitizeRates({ USD: 1, INR: 83 }), { USD: 1, INR: 83 });
  assert.equal(sanitizeRates({ USD: '1' }), null);
  assert.equal(sanitizeRates('nope'), null);
  assert.equal(sanitizeRates({}), null);
});

test('currency lookups ignore inherited object properties', () => {
  assert.throws(() => convertCurrency(1, 'toString', 'USD', { USD: 1 }), /No rate for toString/);
  assert.throws(() => convertCurrency(1, 'USD', 'constructor', { USD: 1 }), /No rate for constructor/);
});
