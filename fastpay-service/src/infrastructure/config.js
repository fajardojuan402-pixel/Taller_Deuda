'use strict';

const path = require('path');

/**
 * INFRAESTRUCTURA: Configuración centralizada.
 * -------------------------------------------------------------
 * Toda la configuración sensible proviene de variables de entorno, con
 * valores por defecto seguros para desarrollo. Resuelve la deuda de
 * secretos hardcodeados (ISO/IEC 25010: Seguridad - Confidencialidad).
 */
function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 4000,
    nodeEnv: env.NODE_ENV || 'development',
    dbFile: env.DB_FILE || path.join(__dirname, '../../data/subscriptions.json'),
    gateway: {
      apiKey: env.PAYMENT_GATEWAY_API_KEY || 'sk_test_mock_secret_key_12345',
      timeoutMs: Number(env.PAYMENT_GATEWAY_TIMEOUT_MS) || 3000,
      maxRetries: Number(env.PAYMENT_GATEWAY_MAX_RETRIES) || 3,
    },
  };
}

module.exports = { loadConfig };
