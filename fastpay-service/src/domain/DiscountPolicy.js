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

  /**
   * NUEVA REGLA (demo PR aprobado): bono de fidelidad para ciclo ANUAL.
   * Suma un 5% adicional sobre el descuento base cuando el cliente lleva
   * 12 o más meses de antigüedad y factura de forma anual. Extiende el
   * cálculo sin modificar la regla base (OCP - ISO/IEC 25010: Modificabilidad).
   *
   * @param {Money} baseAmount
   * @param {{plan: string, billingCycle: string}} subscription
   * @param {{promoCode?: string, loyaltyMonths?: number}} options
   * @returns {Money} descuento total (base + bono de fidelidad si aplica)
   */
  static calculateWithLoyalty(baseAmount, subscription, options = {}) {
    const baseDiscount = DiscountPolicy.calculate(baseAmount, subscription, options);
    const qualifies =
      subscription.billingCycle === 'ANNUAL' && (options.loyaltyMonths || 0) >= 12;

    if (!qualifies) {
      return baseDiscount;
    }
    const loyaltyBonus = baseAmount.multiply(0.05);
    return baseDiscount.add(loyaltyBonus);
  }
}

module.exports = DiscountPolicy;
