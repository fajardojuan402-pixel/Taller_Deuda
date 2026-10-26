'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FileSubscriptionRepository = require('../src/infrastructure/FileSubscriptionRepository');
const InMemorySubscriptionRepository = require('../src/infrastructure/InMemorySubscriptionRepository');
const ListSubscriptionsUseCase = require('../src/application/ListSubscriptionsUseCase');
const Subscription = require('../src/domain/Subscription');

function makeTempDb(records) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastpay-'));
  const file = path.join(dir, 'subscriptions.json');
  fs.writeFileSync(file, JSON.stringify(records, null, 2));
  return file;
}

const seed = [
  { id: 'a1', customerEmail: 'a@x.com', plan: 'PRO', amount: 99, currency: 'USD', country: 'MX', billingCycle: 'MONTHLY', status: 'ACTIVE', paymentMethod: 'CREDIT_CARD', balance: 0, retryCount: 0 },
  { id: 'a2', customerEmail: 'b@x.com', plan: 'ENTERPRISE', amount: 200, currency: 'USD', country: 'US', billingCycle: 'MONTHLY', status: 'INACTIVE', paymentMethod: 'CREDIT_CARD', balance: 50, retryCount: 0 },
];

test('FileSubscriptionRepository findById devuelve Subscription', async () => {
  const file = makeTempDb(seed);
  const repo = new FileSubscriptionRepository(file);
  const sub = await repo.findById('a1');
  assert.ok(sub instanceof Subscription);
  assert.strictEqual(sub.customerEmail, 'a@x.com');
  assert.strictEqual(await repo.findById('nope'), null);
});

test('FileSubscriptionRepository findAll mapea todos', async () => {
  const file = makeTempDb(seed);
  const repo = new FileSubscriptionRepository(file);
  const all = await repo.findAll();
  assert.strictEqual(all.length, 2);
});

test('FileSubscriptionRepository save persiste de forma atomica y el JSON queda valido', async () => {
  const file = makeTempDb(seed);
  const repo = new FileSubscriptionRepository(file);
  const sub = await repo.findById('a1');
  sub.registerSuccessfulCharge(sub.amount, 'TX_X', 'k', '2026-01-01T00:00:00Z');
  await repo.save(sub);

  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  assert.strictEqual(parsed.length, 2);
  const updated = parsed.find((r) => r.id === 'a1');
  assert.strictEqual(updated.lastTransactionRef, 'TX_X');
});

test('ListSubscriptionsUseCase devuelve registros serializados', async () => {
  const repo = new InMemorySubscriptionRepository(seed);
  const uc = new ListSubscriptionsUseCase({ repository: repo });
  const list = await uc.execute();
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].amount, 99);
});
