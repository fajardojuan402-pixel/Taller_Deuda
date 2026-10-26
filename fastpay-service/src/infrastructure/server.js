'use strict';

const { buildApp } = require('./buildApp');

/**
 * PUNTO DE ENTRADA HTTP
 * -------------------------------------------------------------
 * Arranca el servidor Express ensamblado en buildApp. Separar el arranque
 * del ensamblado permite importar `app` en pruebas sin abrir un puerto.
 */
const { app, config } = buildApp();

if (require.main === module) {
  app.listen(config.port, () => {
    console.log('=======================================================');
    console.log(`[FASTPAY] Servidor en http://localhost:${config.port}`);
    console.log(`Entorno: ${config.nodeEnv}`);
    console.log('- GET  /health');
    console.log('- GET  /api/subscriptions');
    console.log('- POST /api/subscriptions/:id/bill');
    console.log('- POST /api/subscriptions/batch-run');
    console.log('=======================================================');
  });
}

module.exports = app;
