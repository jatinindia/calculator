import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressKey, backspace, seedFromResult, insertValue, pressKeyAt, backspaceAt, insertValueAt, snapCursor } from './editor.js';

const typeKeys = (keys) => keys.reduce((expr, key) => pressKey(expr, key), '');

test('digits and decimals', () => {
  assert.equal(typeKeys(['1', '2', '.', '5']), '12.5');
  assert.equal(typeKeys(['.', '5']), '0.5');
  assert.equal(typeKeys(['1', '.', '.', '2', '.']), '1.2');
  assert.equal(typeKeys(['0', '0', '7']), '7');
  assert.equal(typeKeys(['1', '+', '0', '5']), '1+5');
  assert.equal(typeKeys(['1', '0', '0']), '100');
  assert.equal(typeKeys(['0', '.', '0', '5']), '0.05');
});

test('operators replace each other instead of stacking', () => {
  assert.equal(typeKeys(['+']), '');
  assert.equal(typeKeys(['5', '+', '×']), '5×');
  assert.equal(typeKeys(['5', '×', '−']), '5×−');
  assert.equal(typeKeys(['5', '×', '−', '+']), '5+');
  assert.equal(typeKeys(['−', '5']), '−5');
  assert.equal(typeKeys(['5', '−', '−']), '5−');
  assert.equal(typeKeys(['(', '×']), '(');
});

test('postfix keys need a value before them', () => {
  assert.equal(typeKeys(['%']), '');
  assert.equal(typeKeys(['5', '%']), '5%');
  assert.equal(typeKeys(['5', '+', '!']), '5+');
  assert.equal(typeKeys(['5', 'square']), '5^2');
  assert.equal(typeKeys(['4', 'reciprocal']), '4^(−1)');
});

test('smart parenthesis key opens or closes based on context', () => {
  assert.equal(typeKeys(['paren']), '(');
  assert.equal(typeKeys(['paren', '2', '+', '3', 'paren']), '(2+3)');
  assert.equal(typeKeys(['2', 'paren']), '2(');
  assert.equal(typeKeys(['paren', '2', '+', 'paren']), '(2+(');
  assert.equal(typeKeys([')']), '');
});

test('functions and constants', () => {
  assert.equal(typeKeys(['sin', '3', '0']), 'sin(30');
  assert.equal(typeKeys(['2', 'π']), '2π');
  assert.equal(typeKeys(['exp', '2']), 'e^(2');
  assert.equal(typeKeys(['pow10', '3']), '10^(3');
});

test('backspace removes function names as a unit', () => {
  assert.equal(backspace('12'), '1');
  assert.equal(backspace('2+sin('), '2+');
  assert.equal(backspace('asin('), '');
  assert.equal(backspace(''), '');
});

test('continuing from a result', () => {
  assert.equal(seedFromResult('5', 42), '');
  assert.equal(seedFromResult('sin', 42), '');
  assert.equal(seedFromResult('+', 42), '42');
  assert.equal(seedFromResult('%', 42), '42');
  assert.equal(seedFromResult('square', -3), '(−3)');
  assert.equal(seedFromResult('×', 1e21), '1e+21');
});

test('inserting a value (Ans, memory, history) never destroys what was typed', () => {
  assert.equal(insertValue('', 42), '42');
  assert.equal(insertValue('5+', 42), '5+42');
  assert.equal(insertValue('(', -3), '((−3)');
  assert.equal(insertValue('12', 42), '12×42');
  assert.equal(insertValue('√', 16), '√16');
});

test('± flips the sign of the number being typed', () => {
  assert.equal(typeKeys(['neg']), '−');
  assert.equal(typeKeys(['5', 'neg']), '−5');
  assert.equal(typeKeys(['5', 'neg', 'neg']), '5');
  assert.equal(typeKeys(['3', '×', '5', 'neg']), '3×(−5');
  assert.equal(typeKeys(['3', '×', '5', 'neg', '6']), '3×(−56');
  assert.equal(typeKeys(['3', '×', '5', 'neg', 'neg']), '3×5');
  assert.equal(typeKeys(['3', '−', '5', 'neg']), '3−(−5');
  assert.equal(typeKeys(['3', '×', '−', '5', 'neg']), '3×5');
  assert.equal(typeKeys(['3', '+', 'neg']), '3+−');
  assert.equal(pressKey('(−3)', 'neg'), '3');
  assert.equal(pressKey('(2+3)', 'neg'), '(2+3)');
  assert.equal(seedFromResult('neg', 42), '42');
});

test('mod behaves like the other binary operators', () => {
  assert.equal(typeKeys(['7', 'mod', '3']), '7mod3');
  assert.equal(typeKeys(['mod']), '');
  assert.equal(typeKeys(['7', '+', 'mod']), '7mod');
  assert.equal(typeKeys(['7', 'mod', '+']), '7+');
  assert.equal(typeKeys(['7', 'mod', '−', '2']), '7mod−2');
  assert.equal(backspace('7mod'), '7');
  assert.equal(insertValue('7mod', 3), '7mod3');
});

test('wrap puts the whole expression in brackets', () => {
  assert.equal(pressKey('2+3', 'wrap'), '(2+3)');
  assert.equal(pressKey('2×(3+4', 'wrap'), '(2×(3+4))');
  assert.equal(pressKey('', 'wrap'), '');
  assert.equal(seedFromResult('wrap', 42), '42');
});

test('typing at a cursor in the middle', () => {
  assert.deepEqual(pressKeyAt('12+34', 2, '5'), { expr: '125+34', cursor: 3 });
  assert.deepEqual(pressKeyAt('1234', 2, '+'), { expr: '12+34', cursor: 3 });
  assert.deepEqual(pressKeyAt('1234', 0, '('), { expr: '(1234', cursor: 1 });
  assert.deepEqual(pressKeyAt('(12+3', 3, ')'), { expr: '(12)+3', cursor: 4 });
  assert.deepEqual(pressKeyAt('2×4', 1, ')'), { expr: '2×4', cursor: 1 });
  assert.deepEqual(pressKeyAt('2+3', 1, 'wrap'), { expr: '(2+3)', cursor: 5 });
});

test('deleting at a cursor', () => {
  assert.deepEqual(backspaceAt('12+34', 3), { expr: '1234', cursor: 2 });
  assert.deepEqual(backspaceAt('2+sin(30)', 6), { expr: '2+30)', cursor: 2 });
  assert.deepEqual(backspaceAt('12', 0), { expr: '12', cursor: 0 });
});

test('inserting a stored value at a cursor never glues digits', () => {
  assert.deepEqual(insertValueAt('5+', 2, 42), { expr: '5+42', cursor: 4 });
  assert.deepEqual(insertValueAt('2+', 0, 42), { expr: '42×2+', cursor: 3 });
  assert.deepEqual(insertValueAt('7mod3', 1, 2), { expr: '7×2mod3', cursor: 3 });
});

test('the cursor never lands inside sin( or mod', () => {
  assert.equal(snapCursor('2+sin(30)', 3), 2);
  assert.equal(snapCursor('2+sin(30)', 5), 6);
  assert.equal(snapCursor('7mod3', 2), 1);
  assert.equal(snapCursor('7mod3', 3), 4);
  assert.equal(snapCursor('123', 9), 3);
  assert.equal(snapCursor('123', -2), 0);
});

test('new scientific keys', () => {
  assert.equal(typeKeys(['sinh', '1']), 'sinh(1');
  assert.equal(typeKeys(['atanh']), 'atanh(');
  assert.equal(typeKeys(['cbrt', '2', '7']), '∛27');
  assert.equal(typeKeys(['4', 'yroot', '8', '1']), '4ʸ√81');
  assert.equal(typeKeys(['yroot']), '');
  assert.equal(typeKeys(['4', 'yroot', '+']), '4+');
  assert.equal(typeKeys(['6', '.', '0', '2', 'ee', '2', '3']), '6.02×10^23');
  assert.equal(typeKeys(['ee', '5']), '10^5');
  assert.equal(typeKeys(['2', '+', 'ee']), '2+10^');
  assert.equal(seedFromResult('yroot', 81), '81');
  assert.equal(seedFromResult('ee', 42), '42');
});

test('new tokens delete and hold the cursor as single units', () => {
  assert.equal(backspace('4ʸ√'), '4');
  assert.equal(backspace('2+sinh('), '2+');
  assert.equal(backspace('acosh('), '');
  assert.equal(snapCursor('4ʸ√81', 2), 1);
  assert.equal(snapCursor('2+tanh(1)', 4), 2);
  assert.equal(insertValue('4ʸ√', 2), '4ʸ√2');
});
