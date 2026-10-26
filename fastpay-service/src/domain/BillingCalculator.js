'use strict';

const TaxPolicy = require('./TaxPolicy');
const DiscountPolicy = require('./DiscountPolicy');

/**
 * SERVICIO DE DOMINIO: BillingCalculator
 * -------------------------------------------------------------
 * Función pura que descompone el cálculo financiero que antes vivía
 * dentro del God Method. No tiene efectos secundarios, no toca disco
 * ni red. Esto baja la complejidad ciclomática y hace el cálculo
 * 100% testeable (ISO/IEC 25010: Testeabilidad, Modularidad).
 *
 * Preserva el orden de operaciones del legacy:
 *   taxable = base - discount
 *   taxes   = taxable * taxRate
 *   total   = taxable + taxes + surcharge
 */
class BillingCalculator {
  /**
   * @param {import('./Subscription')} subscription
   * @param {{promoCode?: string}} options
   * @returns {{base, discount, taxableAmount, taxes, surcharge, finalTotal}}
   *          Todos los campos son Value Objects Money.
   */
  static calculate(subscription, options = {}) {
    const base = subscription.amount;
    const taxPolicy = new TaxPolicy(subscription.country);

    const discount = DiscountPolicy.calculate(base, subscription, options);
    const taxableAmount = base.subtract(discount);
    const taxes = taxPolicy.calculateTax(taxableAmount);
    const surcharge = taxPolicy.calculateSurcharge(base, {
      paymentMethod: subscription.paymentMethod,
    });

    const finalTotal = taxableAmount.add(taxes).add(surcharge);

    return { base, discount, taxableAmount, taxes, surcharge, finalTotal };
  }
}

module.exports = BillingCalculator;
