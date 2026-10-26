'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Money = require('../src/domain/Money');

test('Money.fromDecimal convierte a centavos enteros', () => {
  assert.strictEqual(Money.fromDecimal(299.99).cents, 29999);
  assert.strictEqual(Money.fromDecimal(99).cents, 9900);
  assert.strictEqual(Money.fromDecimal(0).cents, 0);
});

test('Money elimina el bug de coma flotante (0.1 + 0.2 === 0.3)', () => {
  const a = Money.fromDecimal(0.1);
  const b = Money.fromDecimal(0.2);
  assert.strictEqual(a.add(b).toDecimal(), 0.3);
  assert.strictEqual(a.add(b).cents, 30);
});

test('Money es inmutable (las operaciones devuelven nuevas instancias)', () => {
  const a = Money.fromDecimal(10);
  const b = a.add(Money.fromDecimal(5));
  assert.strictEqual(a.toDecimal(), 10);
  assert.strictEqual(b.toDecimal(), 15);
  assert.notStrictEqual(a, b);
});

test('Money.subtract resta correctamente', () => {
  const r = Money.fromDecimal(299.99).subtract(Money.fromDecimal(30));
  assert.strictEqual(r.toDecimal(), 269.99);
});

test('Money.multiply redondea a centavos seguros', () => {
  // 269.99 * 0.19 = 51.2981 -> 51.30
  const r = Money.fromDecimal(269.99).multiply(0.19);
  assert.strictEqual(r.toDecimal(), 51.3);
});

test('Money.isGreaterThan compara montos', () => {
  assert.strictEqual(Money.fromDecimal(200.01).isGreaterThan(Money.fromDecimal(200)), true);
  assert.strictEqual(Money.fromDecimal(200).isGreaterThan(Money.fromDecimal(200)), false);
});

test('Money.equals compara valor y moneda', () => {
  assert.ok(Money.fromDecimal(10).equals(Money.fromDecimal(10)));
  assert.ok(!Money.fromDecimal(10).equals(Money.fromDecimal(10.01)));
});

test('Money.zero crea cero', () => {
  assert.strictEqual(Money.zero().cents, 0);
});

test('Money rechaza centavos no enteros en el constructor', () => {
  assert.throws(() => new Money(10.5), TypeError);
});

test('Money rechaza moneda invalida', () => {
  assert.throws(() => new Money(100, 'US'), TypeError);
});

test('Money rechaza operaciones entre monedas distintas', () => {
  const usd = Money.fromDecimal(10, 'USD');
  const eur = Money.fromDecimal(10, 'EUR');
  assert.throws(() => usd.add(eur), /monedas distintas/);
});

test('Money.fromDecimal rechaza valores no numericos', () => {
  assert.throws(() => Money.fromDecimal('abc'), TypeError);
  assert.throws(() => Money.fromDecimal(NaN), TypeError);
});

test('Money.toString formatea con 2 decimales y moneda', () => {
  assert.strictEqual(Money.fromDecimal(299.9).toString(), '299.90 USD');
});
