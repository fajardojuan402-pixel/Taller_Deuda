'use strict';

const express = require('express');

const { loadConfig } = require('./config');
const FileSubscriptionRepository = require('./FileSubscriptionRepository');
const MockStripeGateway = require('./MockStripeGateway');
const KeyedMutex = require('../application/KeyedMutex');
const ProcessBillingUseCase = require('../application/ProcessBillingUseCase');
const ListSubscriptionsUseCase = require('../application/ListSubscriptionsUseCase');

/**
 * COMPOSITION ROOT + ADAPTADOR HTTP (ExpressController)
 * -------------------------------------------------------------
 * Ensambla las dependencias (puertos -> adaptadores) e inyecta los
 * casos de uso en los controladores Express. El dominio y la aplicación
 * no conocen Express; este archivo es el único punto de acoplamiento con
 * el framework (ISO/IEC 25010: Modularidad, Modificabilidad).
 *
 * @param {object} [overrides]  Permite inyectar dobles en pruebas.
 */
function buildApp(overrides = {}) {
  const config = overrides.config || loadConfig();

  const repository =
    overrides.repository || new FileSubscriptionRepository(config.dbFile);
  const gateway =
    overrides.gateway ||
    new MockStripeGateway({
      apiKey: config.gateway.apiKey,
      timeoutMs: config.gateway.timeoutMs,
    });
  const mutex = overrides.mutex || new KeyedMutex();

  const processBilling = new ProcessBillingUseCase({
    repository,
    gateway,
    mutex,
    maxRetries: config.gateway.maxRetries,
  });
  const listSubscriptions = new ListSubscriptionsUseCase({ repository });

  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      service: 'fastpay-billing-service',
      version: '2.0.0',
      status: 'HEALTHY',
      uptime: process.uptime(),
    });
  });

  app.get('/api/subscriptions', async (req, res) => {
    try {
      const data = await listSubscriptions.execute();
      res.json({ count: data.length, data });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  app.post('/api/subscriptions/:id/bill', async (req, res) => {
    try {
      const options = req.body || {};
      const result = await processBilling.execute(req.params.id, options);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
      // No se filtra el stack ni mensajes internos (Seguridad).
      return res.status(500).json({ error: 'INTERNAL_BILLING_FAILURE' });
    }
  });

  app.post('/api/subscriptions/batch-run', async (req, res) => {
    try {
      const all = await repository.findAll();
      const results = [];
      for (const sub of all) {
        if (sub.isActive()) {
          // eslint-disable-next-line no-await-in-loop
          results.push(await processBilling.execute(sub.id, {}));
        }
      }
      res.json({ processedCount: results.length, results });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  return { app, config };
}

module.exports = { buildApp };
