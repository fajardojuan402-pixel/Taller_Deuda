'use strict';

const BillingCalculator = require('../domain/BillingCalculator');

/**
 * CASO DE USO: ProcessBillingUseCase
 * -------------------------------------------------------------
 * Orquesta el cobro de una suscripción desacoplado de infraestructura.
 * Recibe sus dependencias por inyección (puertos), lo que lo hace
 * 100% testeable con mocks (ISO/IEC 25010: Testeabilidad, Modularidad).
 *
 * Resuelve dos deudas críticas del legacy:
 *  - COBRO DUPLICADO: combina un mutex por suscripción (serializa la
 *    concurrencia) con una clave de idempotencia (descarta reintentos
 *    del mismo período/operación).
 *  - FLOATS: delega todo el cálculo monetario en el Value Object Money.
 */
class ProcessBillingUseCase {
  /**
   * @param {object} deps
   * @param {import('../ports/SubscriptionRepositoryPort')} deps.repository
   * @param {import('../ports/PaymentGatewayPort')} deps.gateway
   * @param {import('./KeyedMutex')} deps.mutex
   * @param {number} [deps.maxRetries]
   */
  constructor({ repository, gateway, mutex, maxRetries = 3 }) {
    this.repository = repository;
    this.gateway = gateway;
    this.mutex = mutex;
    this.maxRetries = maxRetries;
  }

  /**
   * @param {string} subId
   * @param {{forceRetry?: boolean, promoCode?: string, idempotencyKey?: string}} options
   */
  async execute(subId, options = {}) {
    // Sección crítica serializada por suscripción: elimina la race condition.
    return this.mutex.runExclusive(subId, () => this._process(subId, options));
  }

  async _process(subId, options) {
    const subscription = await this.repository.findById(subId);

    if (!subscription) {
      return { success: false, code: 'ERR_SUB_NOT_FOUND', msg: 'Suscripcion no existe' };
    }

    const statusResult = this._ensureBillable(subscription, options);
    if (statusResult) {
      return statusResult;
    }

    // IDEMPOTENCIA: si ya se procesó esta misma clave, devolver el resultado
    // previo sin volver a cobrar (descarta reintentos de webhook / doble clic).
    const idempotencyKey = options.idempotencyKey || this._defaultIdempotencyKey(subscription);
    if (subscription.lastIdempotencyKey === idempotencyKey) {
      return {
        success: true,
        code: 'BILLING_ALREADY_PROCESSED',
        idempotent: true,
        subId: subscription.id,
        customer: subscription.customerEmail,
        transactionReference: subscription.lastTransactionRef,
      };
    }

    const breakdown = BillingCalculator.calculate(subscription, options);

    const gatewayResult = await this.gateway.charge({
      subscription,
      amount: breakdown.finalTotal,
      idempotencyKey,
    });

    if (!gatewayResult.success) {
      return this._handleGatewayFailure(subscription, gatewayResult);
    }

    const billedAt = new Date().toISOString();
    subscription.registerSuccessfulCharge(
      breakdown.finalTotal,
      gatewayResult.transactionReference,
      idempotencyKey,
      billedAt
    );
    await this.repository.save(subscription);

    return {
      success: true,
      code: 'BILLING_PROCESSED',
      subId: subscription.id,
      customer: subscription.customerEmail,
      breakdown: {
        baseAmount: breakdown.base.toDecimal(),
        discount: breakdown.discount.toDecimal(),
        taxes: breakdown.taxes.toDecimal(),
        surcharge: breakdown.surcharge.toDecimal(),
        finalTotal: breakdown.finalTotal.toDecimal(),
      },
      transactionReference: gatewayResult.transactionReference,
      processedAt: billedAt,
    };
  }

  /** Valida el estado de la suscripción. Devuelve una respuesta de error o null si es cobrable. */
  _ensureBillable(subscription, options) {
    if (subscription.isActive()) {
      return null;
    }
    if (subscription.isSuspended()) {
      if (options.forceRetry === true) {
        subscription.forceReactivate();
        return null;
      }
      return { success: false, code: 'ERR_SUSPENDED', msg: 'Cuenta suspendida por mora' };
    }
    return { success: false, code: 'ERR_INACTIVE', msg: 'Suscripcion inactiva' };
  }

  async _handleGatewayFailure(subscription, gatewayResult) {
    subscription.incrementRetry();
    if (subscription.retryCount >= this.maxRetries) {
      subscription.suspend();
    }
    await this.repository.save(subscription);
    return {
      success: false,
      code: gatewayResult.errorCode || 'GATEWAY_TIMEOUT',
      retryCount: subscription.retryCount,
    };
  }

  /** Clave de idempotencia por período de facturación (año-mes) y suscripción. */
  _defaultIdempotencyKey(subscription) {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    return `${subscription.id}:${period}`;
  }
}

module.exports = ProcessBillingUseCase;
