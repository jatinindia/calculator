import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  discount, gstAdd, gstRemove, percentOf, percentRatio, percentChange, tipSplit, loanEmi,
  dateDiff, addDays, formatDate, formatMoney, TOOLS,
} from './tools.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

test('discount', () => {
  assert.deepEqual(discount(1000, 20), { saved: 200, final: 800 });
});

test('GST added on top and taken out of an inclusive price', () => {
  assert.deepEqual(gstAdd(1000, 18), { net: 1000, tax: 180, gross: 1180 });
  const r = gstRemove(1180, 18);
  close(r.net, 1000);
  close(r.tax, 180);
  assert.equal(r.gross, 1180);
});

test('percent helpers', () => {
  assert.equal(percentOf(15, 200), 30);
  assert.equal(percentRatio(30, 200), 15);
  assert.equal(percentChange(80, 100), 25);
  assert.equal(percentChange(100, 80), -20);
  assert.throws(() => percentChange(0, 5), /from zero/);
  assert.throws(() => percentRatio(1, 0), /of zero/);
});

test('tip and split', () => {
  assert.deepEqual(tipSplit(1000, 10, 4), { tip: 100, total: 1100, perPerson: 275 });
  assert.throws(() => tipSplit(100, 10, 0), /whole number of people/);
  assert.throws(() => tipSplit(100, 10, 2.5), /whole number of people/);
});

test('loan EMI matches the standard formula', () => {
  const r = loanEmi(1000000, 8.5, 240);
  assert.equal(Math.round(r.emi), 8678);
  close(r.totalPayment, r.emi * 240);
  close(r.totalInterest, r.emi * 240 - 1000000);
  assert.equal(loanEmi(12000, 0, 12).emi, 1000);
  assert.throws(() => loanEmi(1000, 5, 0), /at least one month/);
});

test('date difference in days and calendar parts', () => {
  assert.deepEqual(dateDiff('2026-01-10', '2026-03-25'), { totalDays: 74, years: 0, months: 2, days: 15 });
  assert.deepEqual(dateDiff('2026-03-25', '2026-01-10'), { totalDays: -74, years: 0, months: 2, days: 15 });
  assert.deepEqual(dateDiff('2020-05-15', '2026-10-29'), { totalDays: 2358, years: 6, months: 5, days: 14 });
  assert.throws(() => dateDiff('2026-13-01', '2026-01-01'), /Invalid date "2026-13-01"/);
});

test('adding days and formatting dates', () => {
  assert.equal(addDays('2026-10-29', 100), '2027-02-06');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(formatDate('2027-02-06'), 'Sat, 6 Feb 2027');
});

test('money formatting', () => {
  assert.equal(formatMoney(1234.5), '1,234.50');
  assert.equal(formatMoney(-0.004), '0.00');
  assert.equal(formatMoney(1000000), '1,000,000.00');
  assert.equal(formatMoney(-1500.256), '-1,500.26');
});

const SAMPLES = {
  discount: { price: '1000', off: '20' },
  gst: { amount: '1000', rate: '18' },
  percent: { pct: '15', value: '200', part: '30', whole: '200', from: '80', to: '100' },
  tip: { bill: '1000', tip: '10', people: '4' },
  loan: { amount: '1000000', rate: '8.5', years: '20' },
  date: { from: '2026-01-10', to: '2026-03-25', start: '2026-10-29', days: '100' },
};

test('every tool returns nothing until filled in, then exactly one headline result', () => {
  for (const tool of TOOLS) {
    for (const mode of tool.modes) {
      assert.equal(mode.compute({}), null, `${tool.id}/${mode.id} with no input`);
      const rows = mode.compute(SAMPLES[tool.id]);
      assert.ok(rows !== null, `${tool.id}/${mode.id} gave no result`);
      assert.equal(rows.filter((r) => r.primary).length, 1, `${tool.id}/${mode.id} headline count`);
    }
  }
});

test('tool rows show the expected headline values', () => {
  const headline = (toolId, modeId, values) => {
    const mode = TOOLS.find((t) => t.id === toolId).modes.find((m) => m.id === modeId);
    return mode.compute(values).find((r) => r.primary).value;
  };
  assert.equal(headline('discount', 'discount', SAMPLES.discount), '800.00');
  assert.equal(headline('gst', 'add', SAMPLES.gst), '1,180.00');
  assert.equal(headline('gst', 'remove', { amount: '1180', rate: '18' }), '1,000.00');
  assert.equal(headline('percent', 'ratio', SAMPLES.percent), '15%');
  assert.equal(headline('percent', 'change', SAMPLES.percent), '+25%');
  assert.equal(headline('tip', 'tip', SAMPLES.tip), '275.00');
  assert.equal(headline('loan', 'emi', SAMPLES.loan), '8,678.23');
  assert.equal(headline('date', 'between', SAMPLES.date), '74 days');
  assert.equal(headline('date', 'add', SAMPLES.date), 'Sat, 6 Feb 2027');
});
