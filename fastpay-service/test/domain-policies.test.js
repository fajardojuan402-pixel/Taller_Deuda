'use strict';

const test = require('node:test');
const assert = require('node:assert');

const Money = require('../src/domain/Money');
const TaxPolicy = require('../src/domain/TaxPolicy');
const DiscountPolicy = require('../src/domain/DiscountPolicy');
const BillingCalculator = require('../src/domain/BillingCalculator');
const Subscription = require('../src/domain/Subscription');

// ---------- TaxPolicy ----------
test('TaxPolicy CO aplica IVA 19% y recargo 4.5 si base > 200', () => {
  const policy = new TaxPolicy('CO');
  assert.strictEqual(policy.getTaxRate(), 0.19);
  const surcharge = policy.calculateSurcharge(Money.fromDecimal(300), {});
  assert.strictEqual(surcharge.toDecimal(), 4.5);
  const noSurcharge = policy.calculateSurcharge(Money.fromDecimal(100), {});
  assert.strictEqual(noSurcharge.toDecimal(), 0);
});

test('TaxPolicy MX aplica recargo 8.0 solo con WIRE_TRANSFER', () => {
  const policy = new TaxPolicy('MX');
  assert.strictEqual(
    policy.calculateSurcharge(Money.fromDecimal(99), { paymentMethod: 'WIRE_TRANSFER' }).toDecimal(),
    8.0
  );
  assert.strictEqual(
    policy.calculateSurcharge(Money.fromDecimal(99), { paymentMethod: 'CREDIT_CARD' }).toDecimal(),
    0
  );
});

test('TaxPolicy AR aplica 56% y recargo fijo 12.5', () => {
  const policy = new TaxPolicy('AR');
  assert.ok(Math.abs(policy.getTaxRate() - 0.56) < 1e-9);
  assert.strictEqual(policy.calculateSurcharge(Money.fromDecimal(29), {}).toDecimal(), 12.5);
});

test('TaxPolicy pais desconocido usa default 10%', () => {
  const policy = new TaxPolicy('BR');
  assert.strictEqual(policy.getTaxRate(), 0.1);
});

// ---------- DiscountPolicy ----------
test('DiscountPolicy ENTERPRISE_PLUS ANNUAL -> 15%', () => {
  const d = DiscountPolicy.calculate(Money.fromDecimal(599.5), { plan: 'ENTERPRISE_PLUS', billingCycle: 'ANNUAL' }, {});
  assert.strictEqual(d.toDecimal(), 89.93);
});

test('DiscountPolicy ENTERPRISE_PLUS mensual -> plano 25', () => {
  const d = DiscountPolicy.calculate(Money.fromDecimal(599.5), { plan: 'ENTERPRISE_PLUS', billingCycle: 'MONTHLY' }, {});
  assert.strictEqual(d.toDecimal(), 25);
});

test('DiscountPolicy ENTERPRISE con promo FAST2026 -> 30', () => {
  const d = DiscountPolicy.calculate(Money.fromDecimal(299.99), { plan: 'ENTERPRISE', billingCycle: 'MONTHLY' }, { promoCode: 'FAST2026' });
  assert.strictEqual(d.toDecimal(), 30);
});

test('DiscountPolicy sin plan especial -> 0', () => {
  const d = DiscountPolicy.calculate(Money.fromDecimal(99), { plan: 'PRO', billingCycle: 'MONTHLY' }, {});
  assert.strictEqual(d.toDecimal(), 0);
});

// ---------- BillingCalculator ----------
test('BillingCalculator compone descuento, impuestos y recargo (CO con promo)', () => {
  const sub = new Subscription({
    id: 's', customerEmail: 'a@b.c', plan: 'ENTERPRISE', amount: 299.99, currency: 'USD',
    country: 'CO', billingCycle: 'MONTHLY', status: 'ACTIVE', paymentMethod: 'CREDIT_CARD', balance: 0,
  });
  const r = BillingCalculator.calculate(sub, { promoCode: 'FAST2026' });
  assert.strictEqual(r.discount.toDecimal(), 30);
  assert.strictEqual(r.taxes.toDecimal(), 51.3);
  assert.strictEqual(r.surcharge.toDecimal(), 4.5);
  assert.strictEqual(r.finalTotal.toDecimal(), 325.79);
});

// ---------- Subscription ----------
test('Subscription detecta estados y serializa a JSON', () => {
  const sub = new Subscription({
    id: 's1', customerEmail: 'a@b.c', plan: 'PRO', amount: 99, currency: 'USD',
    country: 'MX', billingCycle: 'MONTHLY', status: 'ACTIVE', paymentMethod: 'CREDIT_CARD', balance: 10,
  });
  assert.ok(sub.isActive());
  assert.ok(!sub.isSuspended());
  const json = sub.toJSON();
  assert.strictEqual(json.amount, 99);
  assert.strictEqual(json.balance, 10);
});

test('Subscription forceReactivate y suspend cambian estado', () => {
  const sub = new Subscription({
    id: 's1', customerEmail: 'a@b.c', plan: 'PRO', amount: 99, currency: 'USD',
    country: 'MX', billingCycle: 'MONTHLY', status: 'SUSPENDED', paymentMethod: 'CREDIT_CARD', balance: 0,
  });
  assert.ok(sub.isSuspended());
  sub.forceReactivate();
  assert.ok(sub.isActive());
  sub.suspend();
  assert.ok(sub.isSuspended());
});

test('Subscription registra cobro exitoso acumulando saldo', () => {
  const sub = new Subscription({
    id: 's1', customerEmail: 'a@b.c', plan: 'PRO', amount: 99, currency: 'USD',
    country: 'MX', billingCycle: 'MONTHLY', status: 'ACTIVE', paymentMethod: 'CREDIT_CARD', balance: 0, retryCount: 2,
  });
  sub.registerSuccessfulCharge(Money.fromDecimal(114.84), 'TX_1', 'key-1', '2026-01-01T00:00:00Z');
  assert.strictEqual(sub.balance.toDecimal(), 114.84);
  assert.strictEqual(sub.lastTransactionRef, 'TX_1');
  assert.strictEqual(sub.retryCount, 0);
});
