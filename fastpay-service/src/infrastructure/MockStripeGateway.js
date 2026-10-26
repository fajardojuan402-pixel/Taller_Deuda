'use strict';

const PaymentGatewayPort = require('../ports/PaymentGatewayPort');

/**
 * ADAPTADOR: MockStripeGateway
 * -------------------------------------------------------------
 * Simula la pasarela externa de pago. Sustituye al SDK real de Stripe
 * (deuda táctica deliberada TDR-DEC-01). El secreto de API se lee de la
 * configuración inyectada, nunca hardcodeado ni impreso en logs
 * (ISO/IEC 25010: Seguridad - Confidencialidad).
 *
 * Reproduce la regla legacy: la tarjeta terminada en "9999" simula una
 * pasarela caída (GATEWAY_TIMEOUT), pero ahora de forma controlada y
 * desacoplada del motor de negocio.
 */
class MockStripeGateway extends PaymentGatewayPort {
  /**
   * @param {object} config
   * @param {string} config.apiKey  Secreto inyectado desde variables de entorno.
   * @param {number} [config.timeoutMs]
   */
  constructor({ apiKey, timeoutMs = 3000 } = {}) {
    super();
    if (!apiKey) {
      throw new Error('MockStripeGateway requiere una API key (PAYMENT_GATEWAY_API_KEY).');
    }
    this._apiKey = apiKey; // privado, nunca se expone en respuestas ni logs
    this.timeoutMs = timeoutMs;
    this._counter = 0;
  }

  async charge({ subscription }) {
    const gatewayDown = subscription.cardLast4 === '9999';
    if (gatewayDown) {
      return { success: false, errorCode: 'GATEWAY_TIMEOUT' };
    }
    this._counter += 1;
    const transactionReference = `TX_${Date.now()}_${this._counter}`;
    return { success: true, transactionReference };
  }
}

module.exports = MockStripeGateway;
