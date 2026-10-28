import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, convertUnit, convertCurrency, parseRatesResponse, searchOptions, sanitizeRates, allUnitOptions } from './convert.js';
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

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * 1e-12, `${actual} ≉ ${expected}`);

test('Punjab and Haryana land units chain correctly', () => {
  assert.equal(shown(1, 'area', 'killa', 'kanal'), '8');
  assert.equal(shown(1, 'area', 'killa', 'acre'), '1');
  assert.equal(shown(1, 'area', 'kanal', 'marla'), '20');
  assert.equal(shown(1, 'area', 'marla', 'sarsai'), '9');
  assert.equal(shown(1, 'area', 'kanal', 'ft2'), '5,445');
  assert.equal(shown(1, 'area', 'bigha_pb', 'kanal'), '4');
  assert.equal(shown(1, 'area', 'bigha_pb', 'biswa_pb'), '20');
  assert.equal(shown(1, 'area', 'biswa_pb', 'biswansi_pb'), '20');
});

test('bigha differs by state and each variant is its own unit', () => {
  const sqft = (id) => shown(1, 'area', id, 'ft2');
  assert.equal(sqft('bigha_hp'), '8,712');
  assert.equal(sqft('bigha_uk_hill'), '6,806.25');
  assert.equal(sqft('bigha_uk_plain'), '17,424');
  assert.equal(sqft('bigha_rj_pucca'), '27,225');
  assert.equal(sqft('bigha_rj_kachha'), '17,424');
  assert.equal(sqft('bigha_up_east'), '27,225');
  assert.equal(sqft('bigha_up_west'), '6,806.25');
  assert.equal(sqft('bigha_up_west_b'), '9,075');
  assert.equal(sqft('bigha_mp'), '12,000');
  assert.equal(sqft('bigha_gj'), '17,424');
  assert.equal(sqft('bigha_wb'), '14,400');
  assert.equal(sqft('bigha_assam'), '14,400');
  assert.equal(sqft('bigha_np'), '72,900');
});

test('katha and its sub-units by place', () => {
  assert.equal(shown(1, 'area', 'bigha_patna', 'katha_patna'), '20');
  assert.equal(shown(1, 'area', 'katha_patna', 'dhur_patna'), '20');
  assert.equal(shown(1, 'area', 'dhur_patna', 'dhurki_patna'), '20');
  assert.equal(shown(1, 'area', 'katha_patna', 'ft2'), '1,361.25');
  assert.equal(shown(1, 'area', 'katha_hajipur', 'ft2'), '1,901.25');
  assert.equal(shown(1, 'area', 'katha_chhapra', 'decimal'), '4');
  assert.equal(shown(1, 'area', 'katha_bettiah', 'decimal'), '7.5');
  assert.equal(shown(1, 'area', 'bigha_ranchi', 'katha_ranchi'), '20');
  assert.equal(shown(1, 'area', 'bigha_wb', 'katha_wb'), '20');
  assert.equal(shown(1, 'area', 'katha_wb', 'chatak_wb'), '16');
  assert.equal(shown(1, 'area', 'bigha_assam', 'katha_assam'), '5');
  assert.equal(shown(1, 'area', 'katha_assam', 'lecha_assam'), '20');
  assert.equal(shown(1, 'area', 'pura_assam', 'bigha_assam'), '4');
  assert.equal(shown(1, 'area', 'acre', 'bigha_assam'), '3.025');
  assert.equal(shown(1, 'area', 'bigha_mp', 'katha_mp'), '20');
  assert.equal(shown(1, 'area', 'nali_uk', 'ft2'), '2,160');
  assert.equal(shown(1, 'area', 'biswa_up', 'biswansi_up'), '20');
});

test('south and west Indian, and Nepali, land units', () => {
  assert.equal(shown(1, 'area', 'acre', 'cent'), '100');
  assert.equal(shown(1, 'area', 'cent', 'decimal'), '1');
  assert.equal(shown(1, 'area', 'guntha', 'ft2'), '1,089');
  assert.equal(shown(1, 'area', 'acre', 'guntha'), '40');
  assert.equal(shown(1, 'area', 'ground', 'ft2'), '2,400');
  assert.equal(shown(1, 'area', 'kuncham', 'ft2'), '484');
  assert.equal(shown(1, 'area', 'ankanam', 'ft2'), '72');
  assert.equal(shown(1, 'area', 'gaj', 'yd2'), '1');
  assert.equal(shown(1, 'area', 'ropani', 'aana_np'), '16');
  assert.equal(shown(1, 'area', 'aana_np', 'paisa_np'), '4');
  assert.equal(shown(1, 'area', 'paisa_np', 'daam_np'), '4');
  assert.equal(shown(1, 'area', 'bigha_np', 'katha_np'), '20');
  assert.equal(shown(1, 'area', 'katha_np', 'dhur_np'), '20');
  assert.equal(shown(1, 'area', 'ha', 'are'), '100');
  assert.equal(shown(1, 'area', 'decare', 'are'), '10');
});

test('Indian weights follow the 1833 British India tola', () => {
  assert.equal(shown(1, 'weight', 'tola', 'g'), '11.6638038');
  assert.equal(shown(1, 'weight', 'tola', 'masha'), '12');
  assert.equal(shown(1, 'weight', 'masha', 'ratti'), '8');
  assert.equal(shown(1, 'weight', 'chhatank', 'tola'), '5');
  assert.equal(shown(1, 'weight', 'seer', 'tola'), '80');
  assert.equal(shown(1, 'weight', 'maund', 'seer'), '40');
  assert.equal(shown(1, 'weight', 'maund', 'kg'), '37.32417216');
  assert.equal(shown(1, 'weight', 'quintal', 'kg'), '100');
  assert.equal(shown(1, 'weight', 'ozt', 'g'), '31.1034768');
});

test('Indian lengths and number words', () => {
  assert.equal(shown(1, 'length', 'gaj', 'ft'), '3');
  assert.equal(shown(1, 'length', 'karam', 'ft'), '5.5');
  assert.equal(shown(1, 'length', 'hath', 'in'), '18');
  assert.equal(shown(1, 'numbers', 'crore', 'lakh'), '100');
  assert.equal(shown(1, 'numbers', 'crore', 'million'), '10');
  assert.equal(shown(45, 'numbers', 'million', 'crore'), '4.5');
  assert.equal(shown(1, 'numbers', 'arab', 'crore'), '100');
  assert.equal(shown(1, 'numbers', 'kharab', 'arab'), '100');
  assert.equal(shown(1, 'numbers', 'gross', 'dozen'), '12');
});

test('new categories: force, fuel economy, power', () => {
  assert.equal(shown(1, 'force', 'kgf', 'n'), '9.80665');
  assert.equal(shown(1, 'force', 'lbf', 'n'), '4.4482216152605');
  assert.equal(shown(10, 'fuel', 'kml', 'l100km'), '10');
  assert.equal(shown(5, 'fuel', 'l100km', 'kml'), '20');
  near(convertUnit(1, 'fuel', 'mpgus', 'kml'), 1.609344 / 3.785411784);
  near(convertUnit(1, 'fuel', 'mpguk', 'kml'), 1.609344 / 4.54609);
  assert.equal(shown(1, 'power', 'kw', 'w'), '1,000');
  near(convertUnit(1, 'power', 'hp', 'w'), 745.69987158227022);
  assert.equal(shown(1, 'power', 'ps', 'w'), '735.49875');
});

test('more units in existing categories', () => {
  assert.equal(shown(0, 'temperature', 'c', 'r'), '491.67');
  assert.equal(shown(100, 'temperature', 'c', 're'), '80');
  assert.equal(shown(1, 'data', 'pb', 'tb'), '1,000');
  assert.equal(shown(1, 'data', 'nibble', 'bit'), '4');
  assert.equal(shown(1, 'angle', 'deg', 'arcmin'), '60');
  assert.equal(shown(1, 'pressure', 'torr', 'pa'), '133.322368421053');
  assert.equal(shown(1, 'volume', 'bbl', 'l'), '158.987294928');
  assert.equal(shown(1, 'time', 'fortnight', 'd'), '14');
  assert.equal(shown(1, 'energy', 'kwh', 'mj'), '3.6');
  assert.equal(shown(1, 'speed', 'c0', 'kms'), '299,792.458');
});

test('names and symbols are unique within each category, so no unit is ambiguous', () => {
  for (const category of CATEGORIES) {
    for (const key of ['name', 'symbol']) {
      const values = category.units.map((u) => u[key]);
      const dupes = values.filter((v, i) => values.indexOf(v) !== i);
      assert.deepEqual(dupes, [], `duplicate ${key} in ${category.id}`);
    }
  }
});

test('search across every category finds regional units by name or place', () => {
  const all = allUnitOptions();
  assert.ok(all.every((o) => typeof o.category === 'string'));
  assert.deepEqual(searchOptions(all, 'kanal').map((o) => `${o.category}/${o.id}`)[0], 'area/kanal');
  const assam = searchOptions(all, 'assam').map((o) => o.id);
  assert.deepEqual(assam.sort(), ['bigha_assam', 'katha_assam', 'lecha_assam', 'pura_assam']);
  assert.ok(searchOptions(all, 'horsepower').some((o) => o.category === 'power'));
});
