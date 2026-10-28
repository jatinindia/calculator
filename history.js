// Pure helpers for searching and labelling history entries.

import { formatNumber, toExpressionString } from './calc.js';

/** @typedef {{ id: string, expr: string, result: number, at: number, label?: string }} HistoryEntry */

/**
 * Turn keyboard operators into the symbols stored in expressions.
 * @param {string} text
 * @returns {string}
 */
function normalizeOperators(text) {
  return text.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
}

/**
 * @param {readonly HistoryEntry[]} history
 * @param {string} query
 * @returns {readonly HistoryEntry[]}
 */
export function filterHistory(history, query) {
  const q = query.trim().toLowerCase().replace(/\s+/g, '');
  if (q === '') return history;
  const exprQuery = normalizeOperators(q);
  const numberQuery = q.replace(/,/g, '');
  return history.filter((entry) =>
    (entry.label ?? '').toLowerCase().replace(/\s+/g, '').includes(q)
    || entry.expr.toLowerCase().includes(exprQuery)
    || formatNumber(entry.result).includes(q)
    || (numberQuery !== '' && toExpressionString(entry.result).includes(numberQuery)));
}

/**
 * Set or clear (blank text) the label on one entry.
 * @param {readonly HistoryEntry[]} history
 * @param {string} id
 * @param {string} label
 * @returns {HistoryEntry[]}
 */
export function setLabel(history, id, label) {
  if (!history.some((h) => h.id === id)) throw new Error(`History entry "${id}" not found`);
  const text = label.trim();
  return history.map((entry) => {
    if (entry.id !== id) return entry;
    const { label: _old, ...rest } = entry;
    return text === '' ? rest : { ...rest, label: text };
  });
}
