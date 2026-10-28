// Pure functions describing what each key does to the expression string.

import { toExpressionString } from './calc.js';

const BINARY_OPS = ['+', '−', '×', '÷', '^', 'mod'];
// Text after which a new operand (or a unary minus) can start.
const EXPECTS_OPERAND = /(^|mod|[+−×÷^(√∛])$/;
const FUNCTIONS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'ln', 'log'];
// Function names as a regex alternation, longest first so "asinh" isn't read as "asin".
const FUNCTION_NAMES = 'asinh|acosh|atanh|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|ln|log';
const POSTFIX_SUFFIX = /** @type {Readonly<Record<string, string>>} */ ({
  '%': '%',
  '!': '!',
  square: '^2',
  cube: '^3',
  reciprocal: '^(−1)',
});
const PLAIN_INSERTS = /** @type {Readonly<Record<string, string>>} */ ({
  '(': '(',
  'π': 'π',
  e: 'e',
  cbrt: '∛',
  '√': '√',
  exp: 'e^(',
  pow10: '10^(',
});
// Keys that, pressed right after "=", continue from the previous result.
const CONTINUING_KEYS = [...BINARY_OPS, ...Object.keys(POSTFIX_SUFFIX), 'neg', 'wrap', 'yroot', 'ee'];

/**
 * @param {string} expr
 * @returns {boolean}
 */
function endsWithOperand(expr) {
  return /[0-9.)πe%!]$/.test(expr);
}

/**
 * @param {string} expr
 * @returns {number}
 */
function openParens(expr) {
  return [...expr].reduce((depth, ch) => depth + (ch === '(' ? 1 : ch === ')' ? -1 : 0), 0);
}

/**
 * @param {string} expr
 * @param {string} digit
 * @returns {string}
 */
function pressDigit(expr, digit) {
  const currentNumber = (/[0-9.]*$/.exec(expr) ?? [''])[0];
  return currentNumber === '0' ? expr.slice(0, -1) + digit : expr + digit;
}

/**
 * @param {string} expr
 * @returns {string}
 */
function pressDecimal(expr) {
  const currentNumber = (/[0-9.]*$/.exec(expr) ?? [''])[0];
  if (currentNumber.includes('.')) return expr;
  return currentNumber === '' ? `${expr}0.` : `${expr}.`;
}

/**
 * @param {string} expr
 * @param {string} op
 * @returns {string}
 */
function pressBinary(expr, op) {
  const last = expr.slice(-1);
  if (op === '−') {
    return last === '−' || last === '+' ? expr.slice(0, -1) + op : expr + op;
  }
  // Replace a trailing operator (and any unary minus after it) instead of stacking.
  const stripped = expr.replace(/(?:mod|ʸ√|[+−×÷^])−?$/, '');
  if (stripped === '' || /[(√∛]$/.test(stripped)) return stripped;
  return stripped + op;
}

/**
 * @param {string} expr
 * @returns {string}
 */
function pressSmartParen(expr) {
  return openParens(expr) > 0 && endsWithOperand(expr) ? `${expr})` : `${expr}(`;
}

/**
 * ± : flip the sign of the number being typed (or start a negative one).
 * @param {string} expr
 * @returns {string}
 */
function toggleSign(expr) {
  const bracketed = /\(−([0-9.]+|π|e)\)$/.exec(expr);
  if (bracketed) return expr.slice(0, -bracketed[0].length) + bracketed[1];
  const operand = /([0-9.]+|π|e)$/.exec(expr);
  if (!operand) {
    if (expr.endsWith('−') && EXPECTS_OPERAND.test(expr.slice(0, -1))) return expr.slice(0, -1);
    return EXPECTS_OPERAND.test(expr) ? `${expr}−` : expr;
  }
  const num = operand[1];
  const before = expr.slice(0, -num.length);
  if (before.endsWith('(−')) return before.slice(0, -2) + num;
  if (before.endsWith('−') && EXPECTS_OPERAND.test(before.slice(0, -1))) return before.slice(0, -1) + num;
  return before === '' ? `−${num}` : `${before}(−${num}`;
}

/**
 * Wrap the whole expression in brackets, closing any left open.
 * @param {string} expr
 * @returns {string}
 */
function wrapAll(expr) {
  return expr === '' ? expr : `(${expr}${')'.repeat(Math.max(openParens(expr), 0))})`;
}

/**
 * Apply one key press to the expression.
 * @param {string} expr
 * @param {string} key
 * @returns {string}
 */
export function pressKey(expr, key) {
  if (/^[0-9]$/.test(key)) return pressDigit(expr, key);
  if (key === '.') return pressDecimal(expr);
  if (BINARY_OPS.includes(key)) return pressBinary(expr, key);
  if (key in POSTFIX_SUFFIX) return endsWithOperand(expr) ? expr + POSTFIX_SUFFIX[key] : expr;
  if (key === 'paren') return pressSmartParen(expr);
  if (key === 'neg') return toggleSign(expr);
  if (key === 'wrap') return wrapAll(expr);
  if (key === 'yroot') return pressBinary(expr, 'ʸ√');
  // EE: scientific notation, written out as ×10^ so it reads and edits like any other power.
  if (key === 'ee') return endsWithOperand(expr) ? `${expr}×10^` : `${expr}10^`;
  if (key === ')') return openParens(expr) > 0 && endsWithOperand(expr) ? `${expr})` : expr;
  if (FUNCTIONS.includes(key)) return `${expr}${key}(`;
  if (key in PLAIN_INSERTS) return expr + PLAIN_INSERTS[key];
  throw new Error(`Unknown key "${key}"`);
}

/**
 * Delete the last character, or a whole "sin(" / "mod" as one unit.
 * @param {string} expr
 * @returns {string}
 */
export function backspace(expr) {
  const fn = new RegExp(`(?:(?:${FUNCTION_NAMES})\\(|mod|ʸ√)$`).exec(expr);
  return fn ? expr.slice(0, -fn[0].length) : expr.slice(0, -1);
}

/**
 * Starting expression for a key pressed right after "=".
 * Operators continue from the previous result; anything else starts fresh.
 * @param {string} key
 * @param {number} result
 * @returns {string}
 */
export function seedFromResult(key, result) {
  return CONTINUING_KEYS.includes(key) ? valueText(result) : '';
}

/**
 * A number as expression text; negatives are bracketed so "-3^2" can't misparse.
 * @param {number} value
 * @returns {string}
 */
function valueText(value) {
  const text = toExpressionString(value);
  return text.startsWith('-') ? `(−${text.slice(1)})` : text;
}

/**
 * Insert a stored value (Ans, memory, history). After a number it multiplies
 * instead of gluing digits together, so nothing typed is lost.
 * @param {string} expr
 * @param {number} value
 * @returns {string}
 */
export function insertValue(expr, value) {
  const needsOperator = !EXPECTS_OPERAND.test(expr);
  return `${expr}${needsOperator ? '×' : ''}${valueText(value)}`;
}

// ---------- Editing at a cursor ----------
// Every rule above looks at the text before the cursor; the text after it is carried along.

/** @typedef {{ expr: string, cursor: number }} Edit */

// Multi-character tokens the cursor must not split.
const WORD_TOKENS = new RegExp(`(?:${FUNCTION_NAMES})\\(|mod|ʸ√`, 'g');

/**
 * Move a cursor position to the nearest spot that isn't inside "sin(" or "mod".
 * @param {string} expr
 * @param {number} pos
 * @returns {number}
 */
export function snapCursor(expr, pos) {
  const clamped = Math.min(Math.max(pos, 0), expr.length);
  for (const match of expr.matchAll(WORD_TOKENS)) {
    const start = match.index;
    const end = start + match[0].length;
    if (clamped > start && clamped < end) return clamped - start <= end - clamped ? start : end;
  }
  return clamped;
}

/**
 * @param {string} expr
 * @param {number} cursor
 * @param {string} key
 * @returns {Edit}
 */
export function pressKeyAt(expr, cursor, key) {
  if (key === 'wrap') {
    const wrapped = pressKey(expr, key);
    return { expr: wrapped, cursor: wrapped.length };
  }
  const before = pressKey(expr.slice(0, cursor), key);
  return { expr: before + expr.slice(cursor), cursor: before.length };
}

/**
 * @param {string} expr
 * @param {number} cursor
 * @returns {Edit}
 */
export function backspaceAt(expr, cursor) {
  const before = backspace(expr.slice(0, cursor));
  return { expr: before + expr.slice(cursor), cursor: before.length };
}

/**
 * @param {string} expr
 * @param {number} cursor
 * @param {number} value
 * @returns {Edit}
 */
export function insertValueAt(expr, cursor, value) {
  const after = expr.slice(cursor);
  const before = insertValue(expr.slice(0, cursor), value) + (/^(?!mod)[0-9.(πe√a-z]/.test(after) ? '×' : '');
  return { expr: before + after, cursor: before.length };
}
