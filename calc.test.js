import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, formatNumber, toExpressionString, compileFunction, CalcError } from './calc.js';

const deg = (expr) => evaluate(expr, 'deg');
const rad = (expr) => evaluate(expr, 'rad');
const shown = (expr) => formatNumber(deg(expr));

test('operator precedence and parentheses', () => {
  assert.equal(deg('2+3*4'), 14);
  assert.equal(deg('(2+3)*4'), 20);
  assert.equal(deg('2+3×4−1'), 13);
  assert.equal(deg('8÷2÷2'), 2);
  assert.equal(deg('10-4-3'), 3);
});

test('powers are right-associative and bind tighter than unary minus', () => {
  assert.equal(deg('2^3^2'), 512);
  assert.equal(deg('-2^2'), -4);
  assert.equal(deg('(-2)^2'), 4);
  assert.equal(deg('2^-1'), 0.5);
});

test('floating point noise is hidden in display', () => {
  assert.equal(shown('0.1+0.2'), '0.3');
  assert.equal(shown('1.1*3'), '3.3');
});

test('percent behaves like a phone calculator', () => {
  assert.equal(deg('10%'), 0.1);
  assert.equal(deg('50+10%'), 55);
  assert.equal(deg('50−10%'), 45);
  assert.equal(deg('50×10%'), 5);
  assert.equal(deg('200÷50%'), 400);
});

test('implicit multiplication', () => {
  assert.equal(deg('2(3)'), 6);
  assert.equal(deg('(2)(3)'), 6);
  assert.equal(shown('2π'), '6.28318530717959');
  assert.equal(deg('3√4'), 6);
});

test('functions, constants and angle modes', () => {
  assert.equal(deg('sin(30)'), 0.5);
  assert.equal(deg('cos(90)'), 0);
  assert.equal(deg('cos(60)'), 0.5);
  assert.equal(rad('sin(π/2)'), 1);
  assert.equal(deg('asin(1)'), 90);
  assert.equal(deg('√16'), 4);
  assert.equal(deg('√(9+16)'), 5);
  assert.equal(deg('log(1000)'), 3);
  assert.equal(deg('ln(e)'), 1);
  assert.equal(deg('5!'), 120);
  assert.equal(deg('0!'), 1);
  assert.equal(deg('3!^2'), 36);
});

test('unclosed parentheses are closed automatically', () => {
  assert.equal(deg('sin(30'), 0.5);
  assert.equal(deg('2*(3+4'), 14);
});

test('invalid input raises CalcError with a readable message', () => {
  assert.throws(() => deg('1÷0'), { name: 'CalcError', message: "Can't divide by zero" });
  assert.throws(() => deg('2+'), CalcError);
  assert.throws(() => deg(''), CalcError);
  assert.throws(() => deg('3.5!'), CalcError);
  assert.throws(() => deg('√-4'), CalcError);
  assert.throws(() => deg('tan(90)'), CalcError);
  assert.throws(() => deg('1..2'), CalcError);
  assert.throws(() => deg('2)'), CalcError);
  assert.throws(() => deg('alert(1)'), CalcError);
});

test('formatNumber groups digits and switches to exponent for extremes', () => {
  assert.equal(formatNumber(1234567.5), '1,234,567.5');
  assert.equal(formatNumber(-0), '0');
  assert.equal(formatNumber(-1500), '-1,500');
  assert.equal(formatNumber(1e21), '1e21');
  assert.equal(formatNumber(1.5e-12), '1.5e-12');
  assert.equal(formatNumber(1 / 3), '0.333333333333333');
  assert.equal(formatNumber(123456789012345), '123,456,789,012,345');
});

test('results round-trip back into expressions', () => {
  assert.equal(toExpressionString(0.1 + 0.2), '0.3');
  assert.equal(toExpressionString(-1500), '-1500');
  assert.equal(deg(toExpressionString(1e21) + '+1'), 1e21);
  assert.equal(deg(toExpressionString(1.5e-12) + '*2'), 3e-12);
  assert.equal(deg('2e'), 2 * Math.E);
});

test('mod is a floored remainder with × ÷ precedence', () => {
  assert.equal(deg('7mod3'), 1);
  assert.equal(deg('34mod5'), 4);
  assert.equal(deg('7.5mod2'), 1.5);
  assert.equal(deg('-7mod3'), 2);
  assert.equal(deg('2+7mod3'), 3);
  assert.equal(deg('2×7mod3'), 2);
  assert.throws(() => deg('5mod0'), { message: "Can't divide by zero" });
  assert.throws(() => deg('5mod'), CalcError);
});

test('functions of x compile once and evaluate in radians', () => {
  assert.equal(compileFunction('x^2-4')(3), 5);
  assert.equal(compileFunction('y = 2x')(3), 6);
  assert.equal(compileFunction(' Y=x+1 ')(1), 2);
  assert.equal(compileFunction('3')(100), 3);
  assert.equal(compileFunction('xsin(x)')(0), 0);
  assert.equal(compileFunction('sin(x)')(Math.PI / 2), 1);
  assert.equal(compileFunction('2(x+1)')(1), 4);
  assert.equal(compileFunction('x*2/4-1')(2), 0);
});

test('points outside a function\'s domain are NaN, not errors', () => {
  assert.ok(Number.isNaN(compileFunction('1/x')(0)));
  assert.ok(Number.isNaN(compileFunction('√x')(-1)));
  assert.ok(Number.isNaN(compileFunction('ln(x)')(0)));
});

test('bad formulas fail when compiled; x is not allowed in normal sums', () => {
  assert.throws(() => compileFunction('x+'), CalcError);
  assert.throws(() => compileFunction(''), CalcError);
  assert.throws(() => compileFunction('y='), CalcError);
  assert.throws(() => deg('x+1'), { name: 'CalcError', message: 'x only works in graphs' });
});

test('absurdly deep nesting is rejected cleanly instead of overflowing the stack', () => {
  assert.equal(deg(`${'('.repeat(100)}1${')'.repeat(100)}`), 1);
  assert.equal(deg(`${'−'.repeat(50)}1`), 1);
  assert.throws(() => deg(`${'('.repeat(600)}1`), { name: 'CalcError', message: 'Too deeply nested' });
  assert.throws(() => deg(`${'−'.repeat(600)}1`), { name: 'CalcError', message: 'Too deeply nested' });
  assert.throws(() => deg(`${'√'.repeat(600)}4`), { name: 'CalcError', message: 'Too deeply nested' });
  assert.throws(() => deg(`2${'^2'.repeat(400)}`), { name: 'CalcError' }); // within limits: just too large
  assert.throws(() => compileFunction(`${'('.repeat(600)}x`), { name: 'CalcError', message: 'Too deeply nested' });
  assert.throws(() => deg(`${'('.repeat(20000)}1`), { name: 'CalcError', message: 'Expression too long' });
  assert.throws(() => deg(`${'1+'.repeat(20000)}1`), { name: 'CalcError', message: 'Expression too long' });
  assert.equal(deg(`${'1+'.repeat(300)}1`), 301);
});

test('reused answers keep real digits but drop floating-point noise', () => {
  assert.equal(toExpressionString(0.1 + 0.2), '0.3');
  assert.equal(toExpressionString(1.1 * 3), '3.3');
  assert.equal(toExpressionString(2500000 / 240), '10416.666666666666');
  assert.equal(toExpressionString(1 / 3), '0.3333333333333333');
  assert.equal(formatNumber(deg(`75×4×${toExpressionString(2500000 / 240)}`)), '3,125,000');
  assert.equal(formatNumber(deg(`${toExpressionString(1 / 3)}×3`)), '1');
});

test('hyperbolic functions ignore the angle mode', () => {
  assert.equal(deg('sinh(0)'), 0);
  assert.equal(deg('cosh(0)'), 1);
  assert.equal(deg('tanh(0)'), 0);
  assert.equal(deg('sinh(1)'), Math.sinh(1));
  assert.equal(rad('cosh(2)'), Math.cosh(2));
  assert.equal(deg('asinh(0)'), 0);
  assert.equal(deg('acosh(1)'), 0);
  assert.equal(shown('atanh(0.5)'), '0.549306144334055');
  assert.ok(Math.abs(deg('asinh(sinh(1.5))') - 1.5) < 1e-12);
  assert.throws(() => deg('acosh(0.5)'), CalcError);
  assert.throws(() => deg('atanh(1)'), CalcError);
});

test('cube root and y-th root', () => {
  assert.equal(deg('∛27'), 3);
  assert.equal(deg('∛−8'), -2);
  assert.equal(deg('∛(64)'), 4);
  assert.equal(deg('2∛8'), 4);
  assert.equal(deg('4ʸ√81'), 3);
  assert.equal(deg('3ʸ√−8'), -2);
  assert.equal(deg('2ʸ√16+1'), 5);
  assert.equal(deg('2×3ʸ√27'), 6);
  assert.throws(() => deg('2ʸ√−4'), CalcError);
  assert.throws(() => deg('0ʸ√5'), CalcError);
});

test('scientific notation via ×10^', () => {
  assert.equal(shown('6.02×10^23'), '6.02e23');
  assert.equal(deg('1.5×10^−3'), 0.0015);
});
