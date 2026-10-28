// Pure maths for the graph: zeros, intersections and grid spacing.

/** @typedef {(x: number) => number} Fn */

const BISECT_STEPS = 100;
const GOLDEN = (Math.sqrt(5) - 1) / 2;

/**
 * @param {Fn} f
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function bisect(f, lo, hi) {
  let a = lo;
  let b = hi;
  let fa = f(a);
  for (let i = 0; i < BISECT_STEPS && b - a > 0; i += 1) {
    const mid = (a + b) / 2;
    if (mid === a || mid === b) break;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = mid;
      fa = fm;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}

/**
 * x in [lo, hi] where |f| is smallest (golden-section search).
 * @param {Fn} f
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function minimiseAbs(f, lo, hi) {
  let a = lo;
  let b = hi;
  for (let i = 0; i < BISECT_STEPS; i += 1) {
    const c = b - GOLDEN * (b - a);
    const d = a + GOLDEN * (b - a);
    if (Math.abs(f(c)) < Math.abs(f(d))) b = d;
    else a = c;
  }
  return (a + b) / 2;
}

/**
 * Zeros of f between a and b, found from n sample intervals: sign changes are refined by
 * bisection, and dips that just touch zero (like x²) by a minimum search. Sign changes
 * caused by vertical asymptotes (tan, 1/x) are rejected because f isn't near zero there.
 * @param {Fn} f
 * @param {number} a
 * @param {number} b
 * @param {number} n
 * @returns {number[]} sorted
 */
export function findRoots(f, a, b, n) {
  const xs = Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  const ys = xs.map(f);
  /** @type {number[]} */
  const found = [];
  for (let i = 0; i <= n; i += 1) {
    const y = ys[i];
    if (y === 0) {
      found.push(xs[i]);
      continue;
    }
    const next = ys[i + 1];
    const scale = Math.max(1, Math.abs(y), Math.abs(next ?? 0));
    if (i < n && Number.isFinite(y) && Number.isFinite(next) && next !== 0 && Math.sign(y) !== Math.sign(next)) {
      const r = bisect(f, xs[i], xs[i + 1]);
      if (Math.abs(f(r)) <= 1e-6 * scale) found.push(r);
    }
    const prev = ys[i - 1];
    const isDip = i > 0 && i < n && Number.isFinite(prev) && Number.isFinite(next)
      && Math.sign(prev) === Math.sign(y) && Math.sign(next) === Math.sign(y)
      && Math.abs(y) < Math.abs(prev) && Math.abs(y) < Math.abs(next);
    if (isDip) {
      const r = minimiseAbs(f, xs[i - 1], xs[i + 1]);
      if (Math.abs(f(r)) <= 1e-12) found.push(r);
    }
  }
  // The same zero can be found twice (exact sample + neighbouring search): keep the best one.
  const minGap = (b - a) / n / 2;
  return found
    .sort((p, q) => p - q)
    .reduce((/** @type {number[]} */ kept, x) => {
      const last = kept[kept.length - 1];
      if (last !== undefined && x - last < minGap) {
        if (Math.abs(f(x)) < Math.abs(f(last))) kept[kept.length - 1] = x;
        return kept;
      }
      return [...kept, x];
    }, []);
}

/**
 * Points where two curves cross.
 * @param {Fn} f
 * @param {Fn} g
 * @param {number} a
 * @param {number} b
 * @param {number} n
 * @returns {{ x: number, y: number }[]}
 */
export function findIntersections(f, g, a, b, n) {
  return findRoots((x) => f(x) - g(x), a, b, n).map((x) => ({ x, y: f(x) }));
}

/**
 * A readable grid spacing (1, 2 or 5 × 10ⁿ) giving about `target` lines across `range`.
 * @param {number} range
 * @param {number} target
 * @returns {number}
 */
export function niceStep(range, target) {
  const raw = range / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  const step = normalised < 1.5 ? 1 : normalised < 3 ? 2 : normalised < 7 ? 5 : 10;
  return Number((step * magnitude).toPrecision(12));
}
