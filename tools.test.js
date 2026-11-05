import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  discount, gstAdd, gstRemove, percentOf, percentRatio, percentChange, tipSplit, loanEmi,
  simpleInterest, compoundInterest, growthRate, timeToReach, sipMaturity, rdMaturity,
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

test('simple interest', () => {
  assert.deepEqual(simpleInterest(10000, 8, 3), { interest: 2400, total: 12400 });
  assert.deepEqual(simpleInterest(10000, 0, 3), { interest: 0, total: 10000 });
});

test('compound interest', () => {
  const yearly = compoundInterest(10000, 10, 2, 1);
  close(yearly.total, 12100);
  close(yearly.interest, 2100);
  close(yearly.effectiveRate, 10);
  const monthly = compoundInterest(100000, 12, 1, 12);
  assert.equal(formatMoney(monthly.total), '112,682.50');
  assert.equal(formatMoney(monthly.effectiveRate), '12.68');
  assert.throws(() => compoundInterest(1000, 10, 1, 0), /at least once a year/);
});

test('rate needed to grow an amount', () => {
  const r = growthRate(1000, 2000, 10);
  close(r.simpleRate, 10);
  assert.equal(formatMoney(r.compoundRate), '7.18');
  close(r.growth, 100);
  assert.throws(() => growthRate(0, 2000, 10), /above zero/);
  assert.throws(() => growthRate(1000, 2000, 0), /above zero/);
});

test('time needed to reach a target', () => {
  const r = timeToReach(1000, 2000, 10, 1);
  close(r.simpleYears, 10);
  assert.equal(formatMoney(r.compoundYears), '7.27');
  assert.throws(() => timeToReach(1000, 2000, 0, 1), /above zero/);
  assert.throws(() => timeToReach(2000, 1000, 10, 1), /above the starting amount/);
});

test('SIP grows monthly, with deposits at the start of each month', () => {
  const r = sipMaturity(1000, 12, 12);
  assert.equal(formatMoney(r.maturity), '12,809.33');
  assert.equal(r.invested, 12000);
  assert.equal(formatMoney(r.interest), '809.33');
  assert.equal(sipMaturity(1000, 0, 12).maturity, 12000);
});

test('RD compounds quarterly', () => {
  let expected = 0;
  for (let monthsLeft = 1; monthsLeft <= 24; monthsLeft += 1) expected += 1000 * (1 + 7 / 400) ** (monthsLeft / 3);
  const r = rdMaturity(1000, 7, 24);
  close(r.maturity, expected);
  assert.equal(r.invested, 24000);
  assert.equal(rdMaturity(1000, 0, 24).maturity, 24000);
});

const SAMPLES = {
  discount: { price: '1000', off: '20' },
  gst: { amount: '1000', rate: '18' },
  percent: { pct: '15', value: '200', part: '30', whole: '200', from: '80', to: '100' },
  tip: { bill: '1000', tip: '10', people: '4' },
  loan: { amount: '1000000', rate: '8.5', years: '20' },
  interest: { amount: '10000', rate: '8', years: '3', times: '4', target: '20000' },
  savings: { monthly: '1000', rate: '12', years: '1' },
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

test('interest and savings forms show the expected values', () => {
  const rows = (toolId, modeId, values) => TOOLS.find((t) => t.id === toolId).modes.find((m) => m.id === modeId).compute(values);
  const main = (toolId, modeId, values) => rows(toolId, modeId, values).find((r) => r.primary).value;
  assert.equal(main('interest', 'simple', SAMPLES.interest), '12,400.00');
  assert.equal(main('interest', 'compound', { amount: '100000', rate: '12', years: '1', times: '12' }), '112,682.50');
  assert.equal(main('interest', 'rate', { amount: '1000', target: '2000', years: '10' }), '7.18%');
  assert.equal(main('interest', 'time', { amount: '1000', target: '2000', rate: '10', times: '1' }), '7 years, 3 months');
  assert.equal(main('interest', 'time', { amount: '1000', target: '1001', rate: '10', times: '1' }), 'Under a month');
  assert.equal(main('savings', 'sip', SAMPLES.savings), '12,809.33');
});

test('interest forms stay empty for inputs with no answer', () => {
  const compute = (toolId, modeId, values) => TOOLS.find((t) => t.id === toolId).modes.find((m) => m.id === modeId).compute(values);
  assert.equal(compute('interest', 'compound', { amount: '1000', rate: '10', years: '1', times: '0' }), null);
  assert.equal(compute('interest', 'compound', { amount: '1000', rate: '-500', years: '1', times: '1' }), null);
  assert.equal(compute('interest', 'compound', { amount: '1000', rate: '1e300', years: '1000', times: '1' }), null);
  assert.equal(compute('interest', 'rate', { amount: '0', target: '2000', years: '10' }), null);
  assert.equal(compute('interest', 'time', { amount: '2000', target: '1000', rate: '10', times: '1' }), null);
  assert.equal(compute('interest', 'time', { amount: '1000', target: '2000', rate: '0', times: '1' }), null);
  assert.equal(compute('savings', 'sip', { monthly: '1000', rate: '12', years: '0' }), null);
  assert.equal(compute('savings', 'rd', { monthly: '1000', rate: '-500', years: '1' }), null);
});

test('tool differences leave no binary noise', () => {
  const rows = TOOLS.find((t) => t.id === 'percent').modes.find((m) => m.id === 'change')
    .compute({ from: '39039.34', to: '39053.21' });
  assert.equal(rows.find((r) => r.label === 'Difference').value, '+13.87');
  assert.equal(discount(1000.1, 99.99).final, 0.10001);
});
