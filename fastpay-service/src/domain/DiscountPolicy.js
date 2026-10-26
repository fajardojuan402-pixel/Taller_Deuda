'use strict';

const Money = require('./Money');

/**
 * DOMINIO: Políticas de descuento por plan.
 * -------------------------------------------------------------
 * Reglas preservadas EXACTAMENTE del motor legacy (Golden Master):
 *   ENTERPRISE_PLUS + ANNUAL  -> 15% sobre la base
 *   ENTERPRISE_PLUS + (otro)  -> descuento plano de 25.0
 *   ENTERPRISE + promo FAST2026 -> descuento plano de 30.0
 *   resto -> sin descuento
 */
class DiscountPolicy {
  /**
   * @param {Money} baseAmount
   * @param {{plan: string, billingCycle: string}} subscription
   * @param {{promoCode?: string}} options
   * @returns {Money} descuento a aplicar
   */
  static calculate(baseAmount, subscription, options = {}) {
    const { plan, billingCycle } = subscription;
    const currency = baseAmount.currency;

    if (plan === 'ENTERPRISE_PLUS') {
      if (billingCycle === 'ANNUAL') {
        return baseAmount.multiply(0.15);
      }
      return Money.fromDecimal(25.0, currency);
    }

    if (plan === 'ENTERPRISE' && options.promoCode === 'FAST2026') {
      return Money.fromDecimal(30.0, currency);
    }

    return Money.zero(currency);
  }
}

module.exports = DiscountPolicy;
