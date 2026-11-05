// Everyday calculators (discount, GST, percent, tip, loan, interest, savings, dates). Pure functions + form definitions.

import { add, formatNumber, subtract } from './calc.js';

/** @typedef {{ id: string, label: string, kind: 'number' | 'date' | 'count', suffix: string, presets: number[], placeholder: string }} ToolField */
/** @typedef {{ label: string, value: string, primary: boolean }} ToolRow */
/** @typedef {{ id: string, label: string, fields: ToolField[], compute: (values: Readonly<Record<string, string>>) => ToolRow[] | null }} ToolMode */
/** @typedef {{ id: string, name: string, modes: ToolMode[] }} Tool */

// ---------- Calculations ----------

/**
 * @param {number} price
 * @param {number} percentOff
 */
export function discount(price, percentOff) {
  const saved = (price * percentOff) / 100;
  return { saved, final: subtract(price, saved) };
}

/**
 * GST added on top of a price.
 * @param {number} net
 * @param {number} rate
 */
export function gstAdd(net, rate) {
  const tax = (net * rate) / 100;
  return { net, tax, gross: add(net, tax) };
}

/**
 * GST taken out of a price that already includes it.
 * @param {number} gross
 * @param {number} rate
 */
export function gstRemove(gross, rate) {
  const net = gross / (1 + rate / 100);
  return { net, tax: subtract(gross, net), gross };
}

/**
 * @param {number} percent
 * @param {number} value
 */
export function percentOf(percent, value) {
  return (percent * value) / 100;
}

/**
 * What percent `part` is of `whole`.
 * @param {number} part
 * @param {number} whole
 */
export function percentRatio(part, whole) {
  if (whole === 0) throw new Error('Can’t take a percentage of zero');
  return (part / whole) * 100;
}

/**
 * @param {number} from
 * @param {number} to
 */
export function percentChange(from, to) {
  if (from === 0) throw new Error('Can’t measure a percentage change from zero');
  return ((to - from) / Math.abs(from)) * 100;
}

/**
 * @param {number} bill
 * @param {number} tipPercent
 * @param {number} people
 */
export function tipSplit(bill, tipPercent, people) {
  if (!Number.isInteger(people) || people < 1) throw new Error(`Need a whole number of people, got ${people}`);
  const tip = (bill * tipPercent) / 100;
  const total = add(bill, tip);
  return { tip, total, perPerson: total / people };
}

/**
 * Standard reducing-balance EMI.
 * @param {number} principal
 * @param {number} annualRatePercent
 * @param {number} months
 */
export function loanEmi(principal, annualRatePercent, months) {
  if (!Number.isInteger(months) || months < 1) throw new Error(`Loan needs at least one month, got ${months}`);
  const r = annualRatePercent / 1200;
  const emi = r === 0 ? principal / months : (principal * r * (1 + r) ** months) / ((1 + r) ** months - 1);
  const totalPayment = emi * months;
  return { emi, totalPayment, totalInterest: subtract(totalPayment, principal) };
}

/**
 * @param {number} principal
 * @param {number} annualRatePercent
 * @param {number} years
 */
export function simpleInterest(principal, annualRatePercent, years) {
  const interest = (principal * annualRatePercent * years) / 100;
  return { interest, total: add(principal, interest) };
}

/**
 * @param {number} principal
 * @param {number} annualRatePercent
 * @param {number} years
 * @param {number} timesPerYear how often interest is added
 */
export function compoundInterest(principal, annualRatePercent, years, timesPerYear) {
  if (timesPerYear < 1) throw new Error(`Interest must compound at least once a year, got ${timesPerYear}`);
  const perPeriod = 1 + annualRatePercent / (100 * timesPerYear);
  const total = principal * perPeriod ** (timesPerYear * years);
  return { total, interest: subtract(total, principal), effectiveRate: (perPeriod ** timesPerYear - 1) * 100 };
}

/**
 * Yearly rate that turns `start` into `end`. The compound rate is the CAGR.
 * @param {number} start
 * @param {number} end
 * @param {number} years
 */
export function growthRate(start, end, years) {
  if (start <= 0 || end <= 0 || years <= 0) throw new Error(`Amounts and years must be above zero, got ${start}, ${end}, ${years}`);
  const ratio = end / start;
  return { compoundRate: (ratio ** (1 / years) - 1) * 100, simpleRate: ((ratio - 1) * 100) / years, growth: (ratio - 1) * 100 };
}

/**
 * Years for `start` to reach `target`.
 * @param {number} start
 * @param {number} target
 * @param {number} annualRatePercent
 * @param {number} timesPerYear how often interest is added
 */
export function timeToReach(start, target, annualRatePercent, timesPerYear) {
  if (start <= 0 || annualRatePercent <= 0 || timesPerYear < 1) {
    throw new Error(`Amount, rate and compounding must be above zero, got ${start}, ${annualRatePercent}, ${timesPerYear}`);
  }
  if (target <= start) throw new Error(`Target must be above the starting amount, got ${target} from ${start}`);
  const ratio = target / start;
  return {
    compoundYears: Math.log(ratio) / (timesPerYear * Math.log(1 + annualRatePercent / (100 * timesPerYear))),
    simpleYears: ((ratio - 1) * 100) / annualRatePercent,
  };
}

/**
 * Value of equal deposits made at the start of each period.
 * @param {number} deposit
 * @param {number} growth multiplier per period (1.01 for 1%)
 * @param {number} periods
 */
function depositsValue(deposit, growth, periods) {
  return growth === 1 ? deposit * periods : (deposit * growth * (growth ** periods - 1)) / (growth - 1);
}

/**
 * @param {number} maturity
 * @param {number} monthly
 * @param {number} months
 */
function savingsResult(maturity, monthly, months) {
  const invested = monthly * months;
  return { maturity, invested, interest: subtract(maturity, invested) };
}

/**
 * SIP: returns compound monthly and each deposit goes in at the start of the month.
 * @param {number} monthly
 * @param {number} annualRatePercent
 * @param {number} months
 */
export function sipMaturity(monthly, annualRatePercent, months) {
  return savingsResult(depositsValue(monthly, 1 + annualRatePercent / 1200, months), monthly, months);
}

/**
 * Recurring deposit: Indian banks compound quarterly, so each month grows by a third of a quarter.
 * @param {number} monthly
 * @param {number} annualRatePercent
 * @param {number} months
 */
export function rdMaturity(monthly, annualRatePercent, months) {
  return savingsResult(depositsValue(monthly, (1 + annualRatePercent / 400) ** (1 / 3), months), monthly, months);
}

/**
 * @param {string} iso YYYY-MM-DD
 * @returns {{ y: number, m: number, d: number }} month is 0-based
 */
function parseDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const parts = match ? { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) } : null;
  const check = parts ? new Date(Date.UTC(parts.y, parts.m, parts.d)) : null;
  if (!parts || !check || check.getUTCMonth() !== parts.m || check.getUTCDate() !== parts.d) {
    throw new Error(`Invalid date "${iso}"`);
  }
  return parts;
}

/** @param {string} iso */
function isValidDate(iso) {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(iso) && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`))
    && new Date(`${iso}T00:00:00Z`).toISOString().startsWith(iso);
}

/**
 * Signed day count plus a calendar breakdown of the gap.
 * @param {string} fromIso
 * @param {string} toIso
 */
export function dateDiff(fromIso, toIso) {
  const a = parseDate(fromIso);
  const b = parseDate(toIso);
  const totalDays = Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86400000);
  const [start, end] = totalDays < 0 ? [b, a] : [a, b];
  let years = end.y - start.y;
  let months = end.m - start.m;
  let days = end.d - start.d;
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(end.y, end.m, 0)).getUTCDate(); // days in the month before `end`
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { totalDays, years, months, days };
}

/**
 * @param {string} iso
 * @param {number} days
 * @returns {string}
 */
export function addDays(iso, days) {
  const { y, m, d } = parseDate(iso);
  return new Date(Date.UTC(y, m, d + days)).toISOString().slice(0, 10);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * @param {string} iso
 * @returns {string} e.g. "Sat, 6 Feb 2027"
 */
export function formatDate(iso) {
  const { y, m, d } = parseDate(iso);
  const weekday = new Date(Date.UTC(y, m, d)).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${d} ${MONTHS[m]} ${y}`;
}

/**
 * Two decimal places with thousands separators.
 * @param {number} n
 * @returns {string}
 */
export function formatMoney(n) {
  const rounded = Math.round(n * 100) / 100;
  if (rounded === 0) return '0.00';
  const [intPart, frac] = Math.abs(rounded).toFixed(2).split('.');
  return `${rounded < 0 ? '-' : ''}${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}

// ---------- Form definitions ----------

/**
 * @param {string | undefined} text
 * @returns {number | null}
 */
function num(text) {
  if (text === undefined || text.trim() === '') return null;
  const value = Number(text.replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {string} id
 * @param {string} label
 * @param {string} suffix
 * @param {number[]} presets
 * @returns {ToolField}
 */
function numberField(id, label, suffix, presets) {
  return { id, label, kind: 'number', suffix, presets, placeholder: '0' };
}

/**
 * @param {string} id
 * @param {string} label
 * @returns {ToolField}
 */
function dateField(id, label) {
  return { id, label, kind: 'date', suffix: '', presets: [], placeholder: '' };
}

/**
 * @param {string} label
 * @param {string} value
 * @returns {ToolRow}
 */
const row = (label, value) => ({ label, value, primary: false });
/**
 * @param {string} label
 * @param {string} value
 * @returns {ToolRow}
 */
const headline = (label, value) => ({ label, value, primary: true });

/**
 * @param {number} n
 * @param {string} word
 */
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;

/** @param {number} n */
const signed = (n) => `${n > 0 ? '+' : ''}${formatNumber(n)}`;

const GST_RATES = [3, 5, 18, 40];

/**
 * @param {{ net: number, tax: number, gross: number }} r
 * @param {number} rate
 * @returns {ToolRow[]}
 */
function gstSplitRows(r, rate) {
  const half = `${formatNumber(rate / 2)}%`;
  return [row(`CGST (${half})`, formatMoney(r.tax / 2)), row(`SGST (${half})`, formatMoney(r.tax / 2)), row('Total GST', formatMoney(r.tax))];
}

/**
 * @param {string} fromIso
 * @param {string} toIso
 * @returns {ToolRow[]}
 */
function betweenRows(fromIso, toIso) {
  const diff = dateDiff(fromIso, toIso);
  const abs = Math.abs(diff.totalDays);
  const parts = [[diff.years, 'year'], [diff.months, 'month'], [diff.days, 'day']]
    .filter(([n]) => n !== 0)
    .map(([n, word]) => plural(/** @type {number} */ (n), /** @type {string} */ (word)));
  return [
    headline(diff.totalDays < 0 ? 'Days (end is before start)' : 'Days', plural(abs, 'day')),
    row('Weeks', `${plural(Math.floor(abs / 7), 'week')}, ${plural(abs % 7, 'day')}`),
    row('Calendar', parts.length === 0 ? 'Same day' : parts.join(', ')),
  ];
}

const INTEREST_RATE_FIELD = numberField('rate', 'Interest rate', '% / yr', []);
const YEARS_FIELD = numberField('years', 'Time', 'years', [1, 3, 5, 10, 20]);
const TIMES_FIELD = numberField('times', 'Compounded', 'times / yr', [1, 2, 4, 12]);

/**
 * @param {number} years
 * @returns {string} e.g. "7 years, 3 months"
 */
function durationText(years) {
  const months = Math.round(years * 12);
  if (months === 0) return 'Under a month';
  const parts = [[Math.floor(months / 12), 'year'], [months % 12, 'month']]
    .filter(([n]) => n !== 0)
    .map(([n, word]) => plural(/** @type {number} */ (n), /** @type {string} */ (word)));
  return parts.join(', ');
}

/**
 * @param {Readonly<Record<string, string>>} v
 * @param {(monthly: number, rate: number, months: number) => { maturity: number, invested: number, interest: number }} grow
 * @returns {ToolRow[] | null}
 */
function savingsRows(v, grow) {
  const monthly = num(v.monthly);
  const rate = num(v.rate);
  const years = num(v.years);
  const months = years === null ? 0 : Math.round(years * 12);
  if (monthly === null || rate === null || rate < 0 || months < 1) return null;
  const r = grow(monthly, rate, months);
  if (!Number.isFinite(r.maturity)) return null;
  return [headline('Maturity value', formatMoney(r.maturity)), row('Total deposited', formatMoney(r.invested)), row('Interest earned', formatMoney(r.interest))];
}

const SAVINGS_FIELDS = [numberField('monthly', 'Monthly deposit', '', []), INTEREST_RATE_FIELD, YEARS_FIELD];

/** @type {readonly Tool[]} */
export const TOOLS = [
  {
    id: 'discount', name: 'Discount', modes: [{
      id: 'discount', label: 'Discount',
      fields: [numberField('price', 'Price', '', []), numberField('off', 'Discount', '%', [10, 20, 25, 50])],
      compute: (v) => {
        const price = num(v.price);
        const off = num(v.off);
        if (price === null || off === null) return null;
        const r = discount(price, off);
        return [row('You save', formatMoney(r.saved)), headline('Final price', formatMoney(r.final))];
      },
    }],
  },
  {
    id: 'gst', name: 'GST', modes: [
      {
        id: 'add', label: 'Add GST',
        fields: [numberField('amount', 'Amount before GST', '', []), numberField('rate', 'GST rate', '%', GST_RATES)],
        compute: (v) => {
          const amount = num(v.amount);
          const rate = num(v.rate);
          if (amount === null || rate === null) return null;
          const r = gstAdd(amount, rate);
          return [row('Amount before GST', formatMoney(r.net)), ...gstSplitRows(r, rate), headline('Total with GST', formatMoney(r.gross))];
        },
      },
      {
        id: 'remove', label: 'Remove GST',
        fields: [numberField('amount', 'Amount including GST', '', []), numberField('rate', 'GST rate', '%', GST_RATES)],
        compute: (v) => {
          const amount = num(v.amount);
          const rate = num(v.rate);
          if (amount === null || rate === null) return null;
          const r = gstRemove(amount, rate);
          return [row('Amount including GST', formatMoney(r.gross)), ...gstSplitRows(r, rate), headline('Amount before GST', formatMoney(r.net))];
        },
      },
    ],
  },
  {
    id: 'percent', name: 'Percent', modes: [
      {
        id: 'of', label: 'X% of Y',
        fields: [numberField('pct', 'Percent', '%', []), numberField('value', 'Of', '', [])],
        compute: (v) => {
          const pct = num(v.pct);
          const value = num(v.value);
          if (pct === null || value === null) return null;
          return [headline(`${formatNumber(pct)}% of ${formatNumber(value)}`, formatNumber(percentOf(pct, value)))];
        },
      },
      {
        id: 'ratio', label: 'X is ?% of Y',
        fields: [numberField('part', 'Value', '', []), numberField('whole', 'Of total', '', [])],
        compute: (v) => {
          const part = num(v.part);
          const whole = num(v.whole);
          if (part === null || whole === null || whole === 0) return null;
          return [headline(`${formatNumber(part)} of ${formatNumber(whole)} is`, `${formatNumber(percentRatio(part, whole))}%`)];
        },
      },
      {
        id: 'change', label: 'Change',
        fields: [numberField('from', 'From', '', []), numberField('to', 'To', '', [])],
        compute: (v) => {
          const from = num(v.from);
          const to = num(v.to);
          if (from === null || to === null || from === 0) return null;
          return [row('Difference', signed(subtract(to, from))), headline(to >= from ? 'Increase' : 'Decrease', `${signed(percentChange(from, to))}%`)];
        },
      },
    ],
  },
  {
    id: 'tip', name: 'Tip & split', modes: [{
      id: 'tip', label: 'Tip & split',
      fields: [
        numberField('bill', 'Bill', '', []),
        numberField('tip', 'Tip', '%', [0, 5, 10, 15, 20]),
        { id: 'people', label: 'People', kind: 'count', suffix: '', presets: [], placeholder: '1' },
      ],
      compute: (v) => {
        const bill = num(v.bill);
        const tip = num(v.tip) ?? 0;
        const people = num(v.people) ?? 1;
        if (bill === null || !Number.isInteger(people) || people < 1) return null;
        const r = tipSplit(bill, tip, people);
        return [row('Tip', formatMoney(r.tip)), row('Total', formatMoney(r.total)), headline(people === 1 ? 'You pay' : 'Each person pays', formatMoney(r.perPerson))];
      },
    }],
  },
  {
    id: 'loan', name: 'Loan EMI', modes: [{
      id: 'emi', label: 'Loan EMI',
      fields: [
        numberField('amount', 'Loan amount', '', []),
        numberField('rate', 'Interest rate', '% / yr', []),
        numberField('years', 'Tenure', 'years', [1, 3, 5, 10, 20]),
      ],
      compute: (v) => {
        const amount = num(v.amount);
        const rate = num(v.rate);
        const years = num(v.years);
        const months = years === null ? 0 : Math.round(years * 12);
        if (amount === null || rate === null || months < 1) return null;
        const r = loanEmi(amount, rate, months);
        return [
          headline('Monthly EMI', formatMoney(r.emi)),
          row('Total interest', formatMoney(r.totalInterest)),
          row('Total payment', formatMoney(r.totalPayment)),
          row('Number of EMIs', formatNumber(months)),
        ];
      },
    }],
  },
  {
    id: 'interest', name: 'Interest', modes: [
      {
        id: 'simple', label: 'Simple',
        fields: [numberField('amount', 'Amount', '', []), INTEREST_RATE_FIELD, YEARS_FIELD],
        compute: (v) => {
          const amount = num(v.amount);
          const rate = num(v.rate);
          const years = num(v.years);
          if (amount === null || rate === null || years === null || rate < 0 || years < 0) return null;
          const r = simpleInterest(amount, rate, years);
          if (!Number.isFinite(r.total)) return null;
          return [headline('Total amount', formatMoney(r.total)), row('Interest', formatMoney(r.interest))];
        },
      },
      {
        id: 'compound', label: 'Compound',
        fields: [numberField('amount', 'Amount', '', []), INTEREST_RATE_FIELD, YEARS_FIELD, TIMES_FIELD],
        compute: (v) => {
          const amount = num(v.amount);
          const rate = num(v.rate);
          const years = num(v.years);
          const times = num(v.times);
          if (amount === null || rate === null || years === null || times === null || rate < 0 || years < 0 || times < 1) return null;
          const r = compoundInterest(amount, rate, years, times);
          if (!Number.isFinite(r.total)) return null;
          return [
            headline('Total amount', formatMoney(r.total)),
            row('Interest', formatMoney(r.interest)),
            row('Effective yearly rate', `${formatMoney(r.effectiveRate)}%`),
          ];
        },
      },
      {
        id: 'rate', label: 'Find rate',
        fields: [numberField('amount', 'Starting amount', '', []), numberField('target', 'Final amount', '', []), YEARS_FIELD],
        compute: (v) => {
          const amount = num(v.amount);
          const target = num(v.target);
          const years = num(v.years);
          if (amount === null || target === null || years === null || amount <= 0 || target <= 0 || years <= 0) return null;
          const r = growthRate(amount, target, years);
          if (!Number.isFinite(r.compoundRate) || !Number.isFinite(r.growth)) return null;
          return [
            headline('Compound rate (CAGR)', `${formatMoney(r.compoundRate)}%`),
            row('Simple rate', `${formatMoney(r.simpleRate)}%`),
            row('Total growth', `${formatMoney(r.growth)}%`),
          ];
        },
      },
      {
        id: 'time', label: 'Find time',
        fields: [numberField('amount', 'Starting amount', '', []), numberField('target', 'Target amount', '', []), INTEREST_RATE_FIELD, TIMES_FIELD],
        compute: (v) => {
          const amount = num(v.amount);
          const target = num(v.target);
          const rate = num(v.rate);
          const times = num(v.times);
          if (amount === null || target === null || rate === null || times === null) return null;
          if (amount <= 0 || target <= amount || rate <= 0 || times < 1) return null;
          const r = timeToReach(amount, target, rate, times);
          if (!Number.isFinite(r.compoundYears) || !Number.isFinite(r.simpleYears)) return null;
          return [headline('With compound interest', durationText(r.compoundYears)), row('With simple interest', durationText(r.simpleYears))];
        },
      },
    ],
  },
  {
    id: 'savings', name: 'Savings', modes: [
      { id: 'sip', label: 'SIP', fields: SAVINGS_FIELDS, compute: (v) => savingsRows(v, sipMaturity) },
      { id: 'rd', label: 'RD', fields: SAVINGS_FIELDS, compute: (v) => savingsRows(v, rdMaturity) },
    ],
  },
  {
    id: 'date', name: 'Date', modes: [
      {
        id: 'between', label: 'Between dates',
        fields: [dateField('from', 'From'), dateField('to', 'To')],
        compute: (v) => (v.from && v.to && isValidDate(v.from) && isValidDate(v.to) ? betweenRows(v.from, v.to) : null),
      },
      {
        id: 'add', label: 'Add days',
        fields: [dateField('start', 'Start date'), numberField('days', 'Days to add', 'days', [7, 30, 90, 180])],
        compute: (v) => {
          const days = num(v.days);
          if (!v.start || !isValidDate(v.start) || days === null || !Number.isInteger(days)) return null;
          return [headline(`${plural(days, 'day')} after`, formatDate(addDays(v.start, days)))];
        },
      },
      {
        id: 'subtract', label: 'Subtract days',
        fields: [dateField('start', 'Start date'), numberField('days', 'Days to subtract', 'days', [7, 30, 90, 180])],
        compute: (v) => {
          const days = num(v.days);
          if (!v.start || !isValidDate(v.start) || days === null || !Number.isInteger(days)) return null;
          return [headline(`${plural(days, 'day')} before`, formatDate(addDays(v.start, -days)))];
        },
      },
    ],
  },
];
