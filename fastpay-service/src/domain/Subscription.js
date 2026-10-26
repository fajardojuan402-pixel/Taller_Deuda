'use strict';

const Money = require('./Money');

const STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
});

/**
 * DOMINIO: Entidad Subscription (pura, sin Express ni fs).
 * -------------------------------------------------------------
 * Encapsula el estado e invariantes de una suscripción. El saldo se
 * representa con el Value Object Money (centavos enteros).
 */
/** Normaliza el objeto de entrada aplicando valores por defecto seguros. */
function withDefaults(props) {
  const currency = props.currency || 'USD';
  return {
    id: props.id,
    customerEmail: props.customerEmail,
    plan: props.plan,
    currency,
    country: props.country,
    billingCycle: props.billingCycle,
    status: props.status,
    paymentMethod: props.paymentMethod,
    cardLast4: props.cardLast4 ?? null,
    amount: props.amount,
    balance: props.balance || 0,
    lastBilledAt: props.lastBilledAt || null,
    retryCount: props.retryCount || 0,
    lastTransactionRef: props.lastTransactionRef || null,
    lastIdempotencyKey: props.lastIdempotencyKey || null,
  };
}

class Subscription {
  constructor(props) {
    const p = withDefaults(props);
    this.id = p.id;
    this.customerEmail = p.customerEmail;
    this.plan = p.plan;
    this.currency = p.currency;
    this.country = p.country;
    this.billingCycle = p.billingCycle;
    this.status = p.status;
    this.paymentMethod = p.paymentMethod;
    this.cardLast4 = p.cardLast4;
    this.amount = Money.fromDecimal(p.amount, p.currency);
    this.balance = Money.fromDecimal(p.balance, p.currency);
    this.lastBilledAt = p.lastBilledAt;
    this.retryCount = p.retryCount;
    this.lastTransactionRef = p.lastTransactionRef;
    this.lastIdempotencyKey = p.lastIdempotencyKey;
  }

  isActive() {
    return this.status === STATUS.ACTIVE;
  }

  isSuspended() {
    return this.status === STATUS.SUSPENDED;
  }

  /** Reactivación forzada controlada (preserva el comportamiento legacy forceRetry). */
  forceReactivate() {
    this.status = STATUS.ACTIVE;
  }

  suspend() {
    this.status = STATUS.SUSPENDED;
  }

  registerSuccessfulCharge(total, transactionReference, idempotencyKey, billedAt) {
    this.balance = this.balance.add(total);
    this.lastBilledAt = billedAt;
    this.lastTransactionRef = transactionReference;
    this.lastIdempotencyKey = idempotencyKey;
    this.retryCount = 0;
  }

  incrementRetry() {
    this.retryCount += 1;
  }

  /** Serializa de vuelta al formato de persistencia (decimales en JSON). */
  toJSON() {
    return {
      id: this.id,
      customerEmail: this.customerEmail,
      plan: this.plan,
      amount: this.amount.toDecimal(),
      currency: this.currency,
      country: this.country,
      billingCycle: this.billingCycle,
      status: this.status,
      paymentMethod: this.paymentMethod,
      cardLast4: this.cardLast4,
      balance: this.balance.toDecimal(),
      lastBilledAt: this.lastBilledAt,
      retryCount: this.retryCount,
      lastTransactionRef: this.lastTransactionRef,
      lastIdempotencyKey: this.lastIdempotencyKey,
    };
  }
}

Subscription.STATUS = STATUS;

module.exports = Subscription;
