import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRoots, findIntersections, niceStep } from './graph.js';

const near = (actual, expected) => {
  assert.equal(actual.length, expected.length, `got [${actual}] expected [${expected}]`);
  actual.forEach((a, i) => assert.ok(Math.abs(a - expected[i]) < 1e-9, `${a} ≉ ${expected[i]}`));
};

test('finds zeros where the curve crosses or touches the axis', () => {
  near(findRoots((x) => x * x - 4, -5, 5, 400), [-2, 2]);
  near(findRoots((x) => x * x, -5, 5, 400), [0]);
  near(findRoots((x) => x - 0.3, -1, 1, 7), [0.3]);
});

test('vertical asymptotes are not reported as zeros', () => {
  near(findRoots(Math.tan, -4, 4, 800), [-Math.PI, 0, Math.PI]);
  near(findRoots((x) => 1 / x, -5, 5, 401), []);
});

test('gaps in the domain are skipped', () => {
  near(findRoots((x) => Math.sqrt(x) - 1, -5, 5, 400), [1]);
  near(findRoots(() => NaN, -5, 5, 400), []);
});

test('intersections of two curves', () => {
  const points = findIntersections((x) => x, (x) => x * x, -3, 3, 600);
  near(points.map((p) => p.x), [0, 1]);
  near(points.map((p) => p.y), [0, 1]);
});

test('grid steps are 1, 2 or 5 times a power of ten', () => {
  assert.equal(niceStep(10, 5), 2);
  assert.equal(niceStep(1, 5), 0.2);
  assert.equal(niceStep(37, 6), 5);
  assert.ok(Math.abs(niceStep(0.003, 4) - 0.001) < 1e-15);
  assert.equal(niceStep(2000, 4), 500);
});
