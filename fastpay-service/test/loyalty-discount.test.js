'use strict';

const test = require('node:test');
const assert = require('node:assert');

const Money = require('../src/domain/Money');
const DiscountPolicy = require('../src/domain/DiscountPolicy');

test('Loyalty: ENTERPRISE_PLUS ANNUAL con 12+ meses suma bono 5%', () => {
  const base = Money.fromDecimal(599.5);
  const sub = { plan: 'ENTERPRISE_PLUS', billingCycle: 'ANNUAL' };
  // base discount 15% = 89.93 ; bono 5% = 29.98 (599.5*0.05=29.975 -> 29.98)
  const d = DiscountPolicy.calculateWithLoyalty(base, sub, { loyaltyMonths: 18 });
  assert.strictEqual(d.toDecimal(), 119.91);
});

test('Loyalty: sin 12 meses no aplica bono (devuelve descuento base)', () => {
  const base = Money.fromDecimal(599.5);
  const sub = { plan: 'ENTERPRISE_PLUS', billingCycle: 'ANNUAL' };
  const d = DiscountPolicy.calculateWithLoyalty(base, sub, { loyaltyMonths: 6 });
  assert.strictEqual(d.toDecimal(), 89.93);
});

test('Loyalty: ciclo MONTHLY nunca recibe bono aunque tenga antiguedad', () => {
  const base = Money.fromDecimal(299.99);
  const sub = { plan: 'ENTERPRISE', billingCycle: 'MONTHLY' };
  const d = DiscountPolicy.calculateWithLoyalty(base, sub, { promoCode: 'FAST2026', loyaltyMonths: 24 });
  assert.strictEqual(d.toDecimal(), 30);
});

test('Loyalty: sin loyaltyMonths equivale a descuento base', () => {
  const base = Money.fromDecimal(599.5);
  const sub = { plan: 'ENTERPRISE_PLUS', billingCycle: 'ANNUAL' };
  const d = DiscountPolicy.calculateWithLoyalty(base, sub, {});
  assert.strictEqual(d.toDecimal(), 89.93);
});
