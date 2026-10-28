// Everyday calculators (discount, GST, percent, tip, loan, dates). Pure functions + form definitions.

import { formatNumber } from './calc.js';

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
  return { saved, final: price - saved };
}

/**
 * GST added on top of a price.
 * @param {number} net
 * @param {number} rate
 */
export function gstAdd(net, rate) {
  const tax = (net * rate) / 100;
  return { net, tax, gross: net + tax };
}

/**
 * GST taken out of a price that already includes it.
 * @param {number} gross
 * @param {number} rate
 */
export function gstRemove(gross, rate) {
  const net = gross / (1 + rate / 100);
  return { net, tax: gross - net, gross };
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
  const total = bill + tip;
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
  return { emi, totalPayment, totalInterest: totalPayment - principal };
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
          return [row('Difference', signed(to - from)), headline(to >= from ? 'Increase' : 'Decrease', `${signed(percentChange(from, to))}%`)];
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
