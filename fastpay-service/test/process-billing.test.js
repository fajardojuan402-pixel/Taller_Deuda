'use strict';

const test = require('node:test');
const assert = require('node:assert');

const InMemorySubscriptionRepository = require('../src/infrastructure/InMemorySubscriptionRepository');
const MockStripeGateway = require('../src/infrastructure/MockStripeGateway');
const KeyedMutex = require('../src/application/KeyedMutex');
const ProcessBillingUseCase = require('../src/application/ProcessBillingUseCase');

function buildUseCase(seed) {
  const repository = new InMemorySubscriptionRepository(seed);
  const gateway = new MockStripeGateway({ apiKey: 'sk_test_app' });
  const mutex = new KeyedMutex();
  return {
    uc: new ProcessBillingUseCase({ repository, gateway, mutex, maxRetries: 3 }),
    repository,
  };
}

const activeCO = {
  id: 'sub_101', customerEmail: 'c@a.com', plan: 'ENTERPRISE', amount: 299.99, currency: 'USD',
  country: 'CO', billingCycle: 'MONTHLY', status: 'ACTIVE', paymentMethod: 'CREDIT_CARD',
  cardLast4: '4242', balance: 0, retryCount: 0,
};

test('REGRESION COBRO DUPLICADO: 5 peticiones concurrentes -> 1 solo cobro real', async () => {
  const { uc, repository } = buildUseCase([activeCO]);
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(uc.execute('sub_101', {})); // misma clave de idempotencia por periodo
  }
  const results = await Promise.all(promises);
  const realCharges = results.filter((r) => r.code === 'BILLING_PROCESSED').length;
  const idempotent = results.filter((r) => r.idempotent).length;

  assert.strictEqual(realCharges, 1, 'Debe cobrarse exactamente una vez');
  assert.strictEqual(idempotent, 4, 'Las otras 4 deben ser idempotentes');

  const sub = await repository.findById('sub_101');
  assert.strictEqual(sub.balance.toDecimal(), 361.49, 'El saldo refleja un unico cobro');
});

test('Idempotencia explicita: misma idempotencyKey no vuelve a cobrar', async () => {
  const { uc, repository } = buildUseCase([activeCO]);
  const first = await uc.execute('sub_101', { idempotencyKey: 'k-1' });
  const second = await uc.execute('sub_101', { idempotencyKey: 'k-1' });
  assert.strictEqual(first.code, 'BILLING_PROCESSED');
  assert.strictEqual(second.code, 'BILLING_ALREADY_PROCESSED');
  const sub = await repository.findById('sub_101');
  assert.strictEqual(sub.balance.toDecimal(), 361.49);
});

test('Suscripcion inexistente -> ERR_SUB_NOT_FOUND', async () => {
  const { uc } = buildUseCase([activeCO]);
  const r = await uc.execute('nope', {});
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.code, 'ERR_SUB_NOT_FOUND');
});

test('Suscripcion suspendida sin forceRetry -> ERR_SUSPENDED', async () => {
  const seed = [{ ...activeCO, id: 'sub_s', status: 'SUSPENDED' }];
  const { uc } = buildUseCase(seed);
  const r = await uc.execute('sub_s', {});
  assert.strictEqual(r.code, 'ERR_SUSPENDED');
});

test('Suscripcion suspendida con forceRetry -> se reactiva y cobra', async () => {
  const seed = [{ ...activeCO, id: 'sub_s', status: 'SUSPENDED', cardLast4: '4242' }];
  const { uc } = buildUseCase(seed);
  const r = await uc.execute('sub_s', { forceRetry: true });
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.code, 'BILLING_PROCESSED');
});

test('Suscripcion inactiva -> ERR_INACTIVE', async () => {
  const seed = [{ ...activeCO, id: 'sub_i', status: 'INACTIVE' }];
  const { uc } = buildUseCase(seed);
  const r = await uc.execute('sub_i', {});
  assert.strictEqual(r.code, 'ERR_INACTIVE');
});

test('Fallo de pasarela (tarjeta 9999) incrementa retry y suspende tras maxRetries', async () => {
  const seed = [{ ...activeCO, id: 'sub_g', cardLast4: '9999', retryCount: 2 }];
  const { uc, repository } = buildUseCase(seed);
  const r = await uc.execute('sub_g', { idempotencyKey: 'g-1' });
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.code, 'GATEWAY_TIMEOUT');
  const sub = await repository.findById('sub_g');
  assert.strictEqual(sub.retryCount, 3);
  assert.strictEqual(sub.status, 'SUSPENDED');
});

test('KeyedMutex serializa operaciones de la misma clave', async () => {
  const mutex = new KeyedMutex();
  const order = [];
  const slow = () =>
    mutex.runExclusive('k', async () => {
      order.push('start-slow');
      await new Promise((res) => setTimeout(res, 20));
      order.push('end-slow');
    });
  const fast = () =>
    mutex.runExclusive('k', async () => {
      order.push('fast');
    });
  await Promise.all([slow(), fast()]);
  assert.deepStrictEqual(order, ['start-slow', 'end-slow', 'fast']);
});

test('MockStripeGateway exige apiKey', () => {
  assert.throws(() => new MockStripeGateway({}), /API key/);
});
