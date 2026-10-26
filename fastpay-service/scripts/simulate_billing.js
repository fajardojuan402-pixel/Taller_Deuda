'use strict';

/**
 * SIMULADOR DE CONCURRENCIA - FASTPAY GLOBAL (REFACTORIZADO)
 * -------------------------------------------------------------
 * Reproduce el mismo escenario que el simulador legacy (5 peticiones
 * casi simultáneas sobre la misma suscripción), pero contra la nueva
 * arquitectura hexagonal. Demuestra que:
 *   1. El mutex por suscripción serializa la concurrencia.
 *   2. La idempotencia descarta los reintentos: un solo cobro real.
 *   3. El Value Object Money elimina el error de coma flotante.
 */

const fs = require('fs');
const path = require('path');

const { loadConfig } = require('../src/infrastructure/config');
const FileSubscriptionRepository = require('../src/infrastructure/FileSubscriptionRepository');
const MockStripeGateway = require('../src/infrastructure/MockStripeGateway');
const KeyedMutex = require('../src/application/KeyedMutex');
const ProcessBillingUseCase = require('../src/application/ProcessBillingUseCase');

const BACKUP_FILE = path.join(__dirname, '../data/subscriptions_backup.json');

async function runSimulation() {
  console.log('===============================================================');
  console.log('INICIANDO SIMULACION DE FACTURACION CONCURRENTE (HEXAGONAL)');
  console.log('===============================================================');

  const config = loadConfig();
  const repository = new FileSubscriptionRepository(config.dbFile);
  const gateway = new MockStripeGateway({ apiKey: config.gateway.apiKey });
  const mutex = new KeyedMutex();
  const useCase = new ProcessBillingUseCase({
    repository,
    gateway,
    mutex,
    maxRetries: config.gateway.maxRetries,
  });

  // Respaldo del estado original
  const originalRaw = fs.readFileSync(config.dbFile, 'utf-8');
  fs.writeFileSync(BACKUP_FILE, originalRaw);

  const targetSubId = 'sub_101';
  const original = await repository.findById(targetSubId);
  console.log(`\nObjetivo: Procesar cobro para [${targetSubId}]`);
  console.log(`Cliente: ${original.customerEmail}`);
  console.log(`Saldo inicial: ${original.balance.toString()}`);

  console.log('\nDisparando 5 solicitudes de cobro casi simultaneas...');
  console.log('(reintentos de webhook + clic impaciente del usuario)\n');

  const promises = [];
  for (let i = 1; i <= 5; i++) {
    const delay = Math.floor(Math.random() * 15);
    promises.push(
      new Promise((resolve) => {
        setTimeout(async () => {
          const start = Date.now();
          const result = await useCase.execute(targetSubId, {
            promoCode: i === 1 ? 'FAST2026' : undefined,
          });
          resolve({ attempt: i, result, duration: Date.now() - start });
        }, delay);
      })
    );
  }

  const results = await Promise.all(promises);

  console.log('RESULTADOS DE LAS 5 PETICIONES:');
  console.log('---------------------------------------------------------------');
  let realCharges = 0;
  let idempotentHits = 0;
  results.forEach((res) => {
    const r = res.result;
    if (r.success && r.code === 'BILLING_PROCESSED') {
      realCharges++;
      console.log(
        `[Intento #${res.attempt}] COBRO REAL: $${r.breakdown.finalTotal.toFixed(2)} USD | Ref: ${r.transactionReference} (${res.duration}ms)`
      );
    } else if (r.success && r.idempotent) {
      idempotentHits++;
      console.log(
        `[Intento #${res.attempt}] IDEMPOTENTE (descartado, no se cobra de nuevo) | Ref: ${r.transactionReference}`
      );
    } else {
      console.log(`[Intento #${res.attempt}] RECHAZADO: ${r.code}`);
    }
  });

  const updated = await repository.findById(targetSubId);
  console.log('\n===============================================================');
  console.log('EVIDENCIA FORENSE (DESPUES DE LA REMEDIACION):');
  console.log('===============================================================');
  console.log(`Cobros REALES ejecutados: ${realCharges} de 5 (esperado: 1)`);
  console.log(`Peticiones idempotentes descartadas: ${idempotentHits}`);
  console.log(`Saldo final en base de datos: ${updated.balance.toString()}`);

  if (realCharges === 1) {
    console.log('\nOK: Cobro duplicado ELIMINADO. Solo se cobro una vez al cliente.');
  } else {
    console.log('\nALERTA: Se detectaron multiples cobros reales.');
  }

  // Restaurar estado original
  fs.writeFileSync(config.dbFile, originalRaw);
  if (fs.existsSync(BACKUP_FILE)) {
    fs.unlinkSync(BACKUP_FILE);
  }
  console.log('\n[INFO] subscriptions.json restaurado al estado base inicial.');
  console.log('===============================================================\n');
}

runSimulation();
