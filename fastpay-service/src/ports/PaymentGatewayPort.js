'use strict';

/* eslint-disable no-unused-vars */

/**
 * PUERTO: PaymentGatewayPort
 * -------------------------------------------------------------
 * Contrato de la pasarela de pago externa. Permite sustituir el
 * adaptador real (Stripe) por un mock en memoria sin tocar el dominio
 * (ISO/IEC 25010: Fiabilidad - Recuperabilidad, al poder simular fallos).
 */
class PaymentGatewayPort {
  /**
   * Ejecuta el cobro contra la pasarela externa.
   * @param {object} params
   * @param {import('../domain/Subscription')} params.subscription
   * @param {import('../domain/Money')} params.amount
   * @param {string} params.idempotencyKey
   * @returns {Promise<{success: boolean, transactionReference?: string, errorCode?: string}>}
   */
  async charge(params) {
    throw new Error('No implementado: charge');
  }
}

module.exports = PaymentGatewayPort;
