'use strict';

/**
 * PRUEBAS DE CARACTERIZACION (GOLDEN MASTER)
 * -------------------------------------------------------------
 * REGLA DE ORO (Fase 4): congelar el comportamiento VALIDO del motor
 * legacy antes de refactorizar. Estos valores esperados se derivaron
 * ejecutando el motor legacy original sobre data/subscriptions.json.
 *
 * Verifican que la refactorizacion a arquitectura hexagonal preserva
 * exactamente las reglas de negocio: impuestos por pais, recargos,
 * descuentos y promociones (ISO/IEC 25010: Adecuacion Funcional).
 *
 * Nota sobre floats: el legacy producia totales como 325.7881 por el bug
 * de coma flotante. El Golden Master fija el resultado CORRECTO redondeado
 * a centavos (325.79), que es el comportamiento valido esperado.
 */

const test = require('node:test');
const assert = require('node:assert');

const InMemorySubscriptionRepository = require('../src/infrastructure/InMemorySubscriptionRepository');
const MockStripeGateway = require('../src/infrastructure/MockStripeGateway');
const KeyedMutex = require('../src/application/KeyedMutex');
const ProcessBillingUseCase = require('../src/application/ProcessBillingUseCase');

const SEED = [
  {
    id: 'sub_101', customerEmail: 'carlos.mendoza@empresa-alfa.com', plan: 'ENTERPRISE',
    amount: 299.99, currency: 'USD', country: 'CO', billingCycle: 'MONTHLY',
    status: 'ACTIVE', paymentMethod: 'CREDIT_CARD', cardLast4: '4242', balance: 0, retryCount: 0,
  },
  {
    id: 'sub_102', customerEmail: 'laura.torres@startup-beta.io', plan: 'PRO',
    amount: 99, currency: 'USD', country: 'MX', billingCycle: 'MONTHLY',
    status: 'ACTIVE', paymentMethod: 'CREDIT_CARD', cardLast4: '1111', balance: 0, retryCount: 0,
  },
  {
    id: 'sub_103', customerEmail: 'dev.admin@fintech-gamma.org', plan: 'ENTERPRISE_PLUS',
    amount: 599.5, currency: 'USD', country: 'US', billingCycle: 'ANNUAL',
    status: 'ACTIVE', paymentMethod: 'WIRE_TRANSFER', cardLast4: null, balance: 150, retryCount: 2,
  },
  {
    id: 'sub_104', customerEmail: 'usuario.moroso@freemail.com', plan: 'STARTER',
    amount: 29, currency: 'USD', country: 'AR', billingCycle: 'MONTHLY',
    status: 'SUSPENDED', paymentMethod: 'CREDIT_CARD', cardLast4: '9999', balance: 58, retryCount: 4,
  },
];

function buildUseCase() {
  const repository = new InMemorySubscriptionRepository(SEED);
  const gateway = new MockStripeGateway({ apiKey: 'sk_test_characterization' });
  const mutex = new KeyedMutex();
  return new ProcessBillingUseCase({ repository, gateway, mutex, maxRetries: 3 });
}

test('GM: CO ENTERPRISE con promo FAST2026 -> base 299.99 - 30 desc, IVA 19%, recargo 4.5', async () => {
  const uc = buildUseCase();
  const r = await uc.execute('sub_101', { promoCode: 'FAST2026', idempotencyKey: 'gm-101' });
  assert.strictEqual(r.success, true);
  // taxable = 299.99 - 30 = 269.99 ; taxes = 269.99*0.19 = 51.2981 -> 51.30 ; surcharge = 4.5
  assert.strictEqual(r.breakdown.discount, 30);
  assert.strictEqual(r.breakdown.taxes, 51.3);
  assert.strictEqual(r.breakdown.surcharge, 4.5);
  assert.strictEqual(r.breakdown.finalTotal, 325.79);
});

test('GM: CO ENTERPRISE sin promo -> sin descuento, IVA 19%, recargo 4.5', async () => {
  const uc = buildUseCase();
  const r = await uc.execute('sub_101', { idempotencyKey: 'gm-101b' });
  // taxable = 299.99 ; taxes = 56.9981 -> 57.00 ; surcharge 4.5 ; total 361.49
  assert.strictEqual(r.breakdown.discount, 0);
  assert.strictEqual(r.breakdown.taxes, 57);
  assert.strictEqual(r.breakdown.surcharge, 4.5);
  assert.strictEqual(r.breakdown.finalTotal, 361.49);
});

test('GM: MX PRO credit card -> IVA 16%, sin recargo (no es WIRE_TRANSFER)', async () => {
  const uc = buildUseCase();
  const r = await uc.execute('sub_102', { idempotencyKey: 'gm-102' });
  // base 99 ; taxes 15.84 ; surcharge 0 ; total 114.84
  assert.strictEqual(r.breakdown.taxes, 15.84);
  assert.strictEqual(r.breakdown.surcharge, 0);
  assert.strictEqual(r.breakdown.finalTotal, 114.84);
});

test('GM: US ENTERPRISE_PLUS ANNUAL -> descuento 15%, tax 8.25%, sin recargo', async () => {
  const uc = buildUseCase();
  const r = await uc.execute('sub_103', { idempotencyKey: 'gm-103' });
  // base 599.5 ; desc 15% = 89.925 -> 89.93 (redondeo centavos) ; taxable 509.57
  // taxes = 509.57*0.0825 = 42.039 -> 42.04 ; total 551.61
  assert.strictEqual(r.breakdown.discount, 89.93);
  assert.strictEqual(r.breakdown.finalTotal, 551.61);
});

test('GM: AR suspendida con tarjeta 9999 -> rechazada por suspension', async () => {
  const uc = buildUseCase();
  const r = await uc.execute('sub_104', { idempotencyKey: 'gm-104' });
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.code, 'ERR_SUSPENDED');
});

test('GM: suscripcion inexistente -> ERR_SUB_NOT_FOUND', async () => {
  const uc = buildUseCase();
  const r = await uc.execute('sub_inexistente', { idempotencyKey: 'gm-x' });
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.code, 'ERR_SUB_NOT_FOUND');
});
