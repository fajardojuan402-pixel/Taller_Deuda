'use strict';

/**
 * PRUEBAS DE INTEGRACION - ADAPTADOR HTTP (ExpressController)
 * -------------------------------------------------------------
 * Ejercitan buildApp.js levantando el servidor Express real en un puerto
 * efimero y haciendo peticiones HTTP con el cliente nativo de Node. Validan
 * que el adaptador de entrada (infraestructura) traduce correctamente las
 * peticiones a los casos de uso y serializa las respuestas.
 *
 * Se inyecta un repositorio en memoria y un gateway mock (puertos) para no
 * tocar disco ni red (ISO/IEC 25010: Testeabilidad, Modularidad).
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const { buildApp } = require('../src/infrastructure/buildApp');
const InMemorySubscriptionRepository = require('../src/infrastructure/InMemorySubscriptionRepository');
const MockStripeGateway = require('../src/infrastructure/MockStripeGateway');
const KeyedMutex = require('../src/application/KeyedMutex');

const SEED = [
  {
    id: 'sub_101', customerEmail: 'carlos@empresa-alfa.com', plan: 'ENTERPRISE',
    amount: 299.99, currency: 'USD', country: 'CO', billingCycle: 'MONTHLY',
    status: 'ACTIVE', paymentMethod: 'CREDIT_CARD', cardLast4: '4242', balance: 0, retryCount: 0,
  },
  {
    id: 'sub_104', customerEmail: 'moroso@freemail.com', plan: 'STARTER',
    amount: 29, currency: 'USD', country: 'AR', billingCycle: 'MONTHLY',
    status: 'SUSPENDED', paymentMethod: 'CREDIT_CARD', cardLast4: '9999', balance: 58, retryCount: 4,
  },
];

/** Levanta la app con dobles inyectados y devuelve { server, baseUrl, close }. */
function startServer() {
  const repository = new InMemorySubscriptionRepository(SEED);
  const gateway = new MockStripeGateway({ apiKey: 'sk_test_http' });
  const mutex = new KeyedMutex();
  const config = {
    port: 0,
    nodeEnv: 'test',
    dbFile: '(unused)',
    gateway: { apiKey: 'sk_test_http', timeoutMs: 1000, maxRetries: 3 },
  };
  const { app } = buildApp({ repository, gateway, mutex, config });

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

/** Cliente HTTP minimalista basado en el modulo nativo. */
function request(baseUrl, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(baseUrl + path);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null })
        );
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('GET /health responde 200 con estado del servicio', async () => {
  const srv = await startServer();
  try {
    const res = await request(srv.baseUrl, 'GET', '/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.service, 'fastpay-billing-service');
    assert.strictEqual(res.body.status, 'HEALTHY');
  } finally {
    await srv.close();
  }
});

test('GET /api/subscriptions devuelve el listado con conteo', async () => {
  const srv = await startServer();
  try {
    const res = await request(srv.baseUrl, 'GET', '/api/subscriptions');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.count, 2);
    assert.strictEqual(res.body.data[0].id, 'sub_101');
  } finally {
    await srv.close();
  }
});

test('POST /api/subscriptions/:id/bill cobra una suscripcion activa (200)', async () => {
  const srv = await startServer();
  try {
    const res = await request(srv.baseUrl, 'POST', '/api/subscriptions/sub_101/bill', {});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.code, 'BILLING_PROCESSED');
    assert.strictEqual(res.body.breakdown.finalTotal, 361.49);
  } finally {
    await srv.close();
  }
});

test('POST bill sobre suscripcion suspendida responde 400', async () => {
  const srv = await startServer();
  try {
    const res = await request(srv.baseUrl, 'POST', '/api/subscriptions/sub_104/bill', {});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'ERR_SUSPENDED');
  } finally {
    await srv.close();
  }
});

test('POST bill sobre suscripcion inexistente responde 400 ERR_SUB_NOT_FOUND', async () => {
  const srv = await startServer();
  try {
    const res = await request(srv.baseUrl, 'POST', '/api/subscriptions/nope/bill', {});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'ERR_SUB_NOT_FOUND');
  } finally {
    await srv.close();
  }
});

test('POST /api/subscriptions/batch-run procesa solo las activas', async () => {
  const srv = await startServer();
  try {
    const res = await request(srv.baseUrl, 'POST', '/api/subscriptions/batch-run', {});
    assert.strictEqual(res.status, 200);
    // Solo sub_101 esta ACTIVE; sub_104 esta SUSPENDED y se omite.
    assert.strictEqual(res.body.processedCount, 1);
    assert.strictEqual(res.body.results[0].code, 'BILLING_PROCESSED');
  } finally {
    await srv.close();
  }
});
