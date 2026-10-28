// Safe expression engine: tokenizer -> recursive-descent parser -> AST evaluator.
// Never uses eval(). All functions are pure.

/** @typedef {'deg' | 'rad'} AngleMode */

/**
 * @typedef {{ kind: 'num', value: number }
 *   | { kind: 'op', value: string }
 *   | { kind: 'fn', value: string }
 *   | { kind: 'lparen' }
 *   | { kind: 'rparen' }
 *   | { kind: 'var' }} Token
 */

/**
 * @typedef {{ type: 'num', value: number }
 *   | { type: 'neg', arg: Node }
 *   | { type: 'percent', arg: Node }
 *   | { type: 'fact', arg: Node }
 *   | { type: 'sqrt', arg: Node }
 *   | { type: 'call', name: string, arg: Node }
 *   | { type: 'bin', op: string, left: Node, right: Node }
 *   | { type: 'var' }} Node
 */

export class CalcError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'CalcError';
  }
}

const SIGNIFICANT_DIGITS = 15;
const SNAP_TOLERANCE = 1e-14;

// Longest names first so "asin" wins over "sin".
const FUNCTIONS = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sqrt', 'ln', 'log'];
const CONSTANTS = /** @type {const} */ ({ pi: Math.PI, 'π': Math.PI, e: Math.E });

/** @type {Readonly<Record<string, string>>} */
const OPERATOR_ALIASES = { '×': '*', '÷': '/', '−': '-', '*': '*', '/': '/', '-': '-', '+': '+', '^': '^', '%': '%', '!': '!', '√': '√' };

/**
 * @param {string} input
 * @returns {Token[]}
 */
function tokenize(input) {
  /** @type {Token[]} */
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ') { i += 1; continue; }

    if (/[0-9.]/.test(ch)) {
      const match = /^(\d*\.?\d*)(e[+-]\d+)?/.exec(input.slice(i));
      const text = match ? match[0] : '';
      if (text === '.' || /\..*\./.test(match ? match[1] : '') || input[i + text.length] === '.') {
        throw new CalcError('Invalid number');
      }
      tokens.push({ kind: 'num', value: Number(text) });
      i += text.length;
      continue;
    }
    if (ch === '(') { tokens.push({ kind: 'lparen' }); i += 1; continue; }
    if (ch === ')') { tokens.push({ kind: 'rparen' }); i += 1; continue; }
    if (ch in OPERATOR_ALIASES) { tokens.push({ kind: 'op', value: OPERATOR_ALIASES[ch] }); i += 1; continue; }

    if (ch === 'x') { tokens.push({ kind: 'var' }); i += 1; continue; }
    const rest = input.slice(i);
    if (rest.startsWith('mod')) { tokens.push({ kind: 'op', value: 'mod' }); i += 3; continue; }
    const fn = FUNCTIONS.find((name) => rest.startsWith(name));
    if (fn) { tokens.push({ kind: 'fn', value: fn }); i += fn.length; continue; }
    const constant = Object.keys(CONSTANTS).sort((a, b) => b.length - a.length).find((name) => rest.startsWith(name));
    if (constant) {
      tokens.push({ kind: 'num', value: CONSTANTS[/** @type {keyof typeof CONSTANTS} */ (constant)] });
      i += constant.length;
      continue;
    }
    throw new CalcError(`Unexpected "${ch}"`);
  }
  return tokens;
}

/**
 * @param {Token[]} tokens
 * @returns {Node}
 */
function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  /** @param {string} value */
  const isOp = (value) => { const t = peek(); return t !== undefined && t.kind === 'op' && t.value === value; };
  const startsOperand = () => {
    const t = peek();
    return t !== undefined && (t.kind === 'num' || t.kind === 'var' || t.kind === 'fn' || t.kind === 'lparen' || (t.kind === 'op' && t.value === '√'));
  };

  /** @returns {Node} */
  function expression() {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = /** @type {{ value: string }} */ (tokens[pos]).value;
      pos += 1;
      left = { type: 'bin', op, left, right: term() };
    }
    return left;
  }

  /** @returns {Node} */
  function term() {
    let left = unary();
    for (;;) {
      if (isOp('*') || isOp('/') || isOp('mod')) {
        const op = /** @type {{ value: string }} */ (tokens[pos]).value;
        pos += 1;
        left = { type: 'bin', op, left, right: unary() };
      } else if (startsOperand()) {
        left = { type: 'bin', op: '*', left, right: power() };
      } else {
        return left;
      }
    }
  }

  /** @returns {Node} */
  function unary() {
    if (isOp('-')) { pos += 1; return { type: 'neg', arg: unary() }; }
    if (isOp('+')) { pos += 1; return unary(); }
    return power();
  }

  /** @returns {Node} */
  function power() {
    const base = postfix();
    if (isOp('^')) { pos += 1; return { type: 'bin', op: '^', left: base, right: unary() }; }
    return base;
  }

  /** @returns {Node} */
  function postfix() {
    let node = primary();
    while (isOp('!') || isOp('%')) {
      node = isOp('!') ? { type: 'fact', arg: node } : { type: 'percent', arg: node };
      pos += 1;
    }
    return node;
  }

  /** @returns {Node} */
  function group() {
    pos += 1; // consume '('
    const inner = expression();
    const t = peek();
    if (t === undefined) return inner; // auto-close at end of input
    if (t.kind !== 'rparen') throw new CalcError('Missing )');
    pos += 1;
    return inner;
  }

  /** @returns {Node} */
  function primary() {
    const t = peek();
    if (t === undefined) throw new CalcError('Incomplete expression');
    if (t.kind === 'num') { pos += 1; return { type: 'num', value: t.value }; }
    if (t.kind === 'var') { pos += 1; return { type: 'var' }; }
    if (t.kind === 'lparen') return group();
    if (t.kind === 'op' && t.value === '√') {
      pos += 1;
      const arg = isOp('-') ? (pos += 1, /** @type {Node} */ ({ type: 'neg', arg: postfix() })) : postfix();
      return { type: 'sqrt', arg };
    }
    if (t.kind === 'fn') {
      pos += 1;
      const next = peek();
      if (next === undefined || next.kind !== 'lparen') throw new CalcError(`${t.value} needs (`);
      const arg = group();
      return t.value === 'sqrt' ? { type: 'sqrt', arg } : { type: 'call', name: t.value, arg };
    }
    throw new CalcError('Incomplete expression');
  }

  if (tokens.length === 0) throw new CalcError('Empty expression');
  const tree = expression();
  if (pos < tokens.length) throw new CalcError('Unexpected )');
  return tree;
}

/**
 * Snap values that are within float noise of a multiple of 0.5 (e.g. sin 30° = 0.49999999999999994).
 * @param {number} value
 * @returns {number}
 */
function snapHalf(value) {
  const snapped = Math.round(value * 2) / 2;
  return Math.abs(value - snapped) < SNAP_TOLERANCE ? snapped + 0 : value;
}

/**
 * @param {string} name
 * @param {number} x
 * @param {AngleMode} mode
 * @returns {number}
 */
function callFunction(name, x, mode) {
  const toRad = mode === 'deg' ? Math.PI / 180 : 1;
  const fromRad = mode === 'deg' ? 180 / Math.PI : 1;
  const forward = (/** @type {(r: number) => number} */ f) => (mode === 'deg' ? snapHalf(f(x * toRad)) : f(x * toRad));
  const inverse = (/** @type {(v: number) => number} */ f) => {
    const r = f(x) * fromRad;
    return mode === 'deg' ? Number(r.toPrecision(SIGNIFICANT_DIGITS)) : r;
  };
  switch (name) {
    case 'sin': return forward(Math.sin);
    case 'cos': return forward(Math.cos);
    case 'tan':
      if (mode === 'deg' && ((x % 180) + 180) % 180 === 90) throw new CalcError('Undefined');
      return forward(Math.tan);
    case 'asin': return inverse(Math.asin);
    case 'acos': return inverse(Math.acos);
    case 'atan': return inverse(Math.atan);
    case 'ln': return Math.log(x);
    case 'log': return Math.log10(x);
    default: throw new CalcError(`Unknown function ${name}`);
  }
}

/**
 * @param {number} n
 * @returns {number}
 */
function factorial(n) {
  if (!Number.isInteger(n) || n < 0) throw new CalcError('Factorial needs a whole number ≥ 0');
  if (n > 170) throw new CalcError('Number too large');
  let result = 1;
  for (let k = 2; k <= n; k += 1) result *= k;
  return result;
}

/**
 * @param {Node} node
 * @param {AngleMode} mode
 * @param {number | null} x value of the graph variable; null outside graphs
 * @returns {number}
 */
function evalNode(node, mode, x) {
  switch (node.type) {
    case 'num': return node.value;
    case 'var':
      if (x === null) throw new CalcError('x only works in graphs');
      return x;
    case 'neg': return -evalNode(node.arg, mode, x);
    case 'percent': return evalNode(node.arg, mode, x) / 100;
    case 'fact': return factorial(evalNode(node.arg, mode, x));
    case 'sqrt': return Math.sqrt(evalNode(node.arg, mode, x));
    case 'call': return callFunction(node.name, evalNode(node.arg, mode, x), mode);
    case 'bin': {
      const left = evalNode(node.left, mode, x);
      // Phone-calculator percent: 50 + 10% means 50 + (10% of 50).
      if ((node.op === '+' || node.op === '-') && node.right.type === 'percent') {
        const share = left * evalNode(node.right.arg, mode, x) / 100;
        return node.op === '+' ? left + share : left - share;
      }
      const right = evalNode(node.right, mode, x);
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/':
          if (right === 0) throw new CalcError("Can't divide by zero");
          return left / right;
        case 'mod':
          if (right === 0) throw new CalcError("Can't divide by zero");
          return left - right * Math.floor(left / right);
        case '^': return Math.pow(left, right);
        default: throw new CalcError(`Unknown operator ${node.op}`);
      }
    }
    default: throw new CalcError('Invalid expression');
  }
}

/**
 * Evaluate a calculator expression. Throws CalcError for anything invalid.
 * @param {string} expression
 * @param {AngleMode} mode
 * @returns {number}
 */
export function evaluate(expression, mode) {
  const result = evalNode(parse(tokenize(expression)), mode, null);
  if (Number.isNaN(result)) throw new CalcError('Undefined');
  if (!Number.isFinite(result)) throw new CalcError('Number too large');
  return result;
}

/**
 * Compile "y = …" in terms of x for graphing (radians). Throws CalcError if the formula
 * can't be parsed; points outside the function's domain evaluate to NaN.
 * @param {string} formula
 * @returns {(x: number) => number}
 */
export function compileFunction(formula) {
  const tree = parse(tokenize(formula.trim().toLowerCase().replace(/^y\s*=\s*/, '')));
  return (x) => {
    try {
      const y = evalNode(tree, 'rad', x);
      return Number.isFinite(y) ? y : NaN;
    } catch (err) {
      if (err instanceof CalcError) return NaN;
      throw err;
    }
  };
}

/**
 * Strip float noise (0.30000000000000004 -> 0.3).
 * @param {number} n
 * @returns {number}
 */
function clean(n) {
  return Number(n.toPrecision(SIGNIFICANT_DIGITS)) + 0;
}

/**
 * Plain string that `evaluate` can parse back, used when reusing a result.
 * @param {number} n
 * @returns {string}
 */
export function toExpressionString(n) {
  return String(clean(n));
}

/**
 * Human-friendly display string with thousands separators.
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
  const value = clean(n);
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) {
    return value.toExponential().replace('e+', 'e');
  }
  const [intPart, fracPart] = String(value).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart === undefined ? grouped : `${grouped}.${fracPart}`;
}
