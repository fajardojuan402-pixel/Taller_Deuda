'use strict';

const Money = require('./Money');

/**
 * DOMINIO: Políticas tributarias por país.
 * -------------------------------------------------------------
 * Elimina los números mágicos y la cadena if/else-if del God Method.
 * Abierto a extensión (agregar países) y cerrado a modificación del
 * cálculo central (OCP - ISO/IEC 25010: Modificabilidad).
 *
 * Reglas preservadas EXACTAMENTE del motor legacy (Golden Master):
 *   CO -> IVA 19% + recargo 4.5 si base > 200
 *   MX -> IVA 16% + recargo 8.0 si método = WIRE_TRANSFER
 *   AR -> 56% carga impositiva + recargo fijo 12.5
 *   US -> 8.25%
 *   default internacional -> 10%
 */
const COUNTRY_RULES = {
  CO: {
    taxRate: 0.19,
    surcharge: (base) => (base.toDecimal() > 200 ? 4.5 : 0),
  },
  MX: {
    taxRate: 0.16,
    surcharge: (_base, ctx) => (ctx.paymentMethod === 'WIRE_TRANSFER' ? 8.0 : 0),
  },
  AR: {
    taxRate: 0.21 + 0.35, // 56% de carga impositiva acumulada
    surcharge: () => 12.5,
  },
  US: {
    taxRate: 0.0825,
    surcharge: () => 0,
  },
};

const DEFAULT_RULE = {
  taxRate: 0.1, // Default internacional no documentado en el legacy
  surcharge: () => 0,
};

class TaxPolicy {
  /**
   * @param {string} country  Código de país (CO, MX, AR, US, ...).
   */
  constructor(country) {
    this.country = country;
    this.rule = COUNTRY_RULES[country] || DEFAULT_RULE;
  }

  /** Tasa de impuesto aplicable (decimal). */
  getTaxRate() {
    return this.rule.taxRate;
  }

  /**
   * Calcula los impuestos sobre un monto gravable.
   * @param {Money} taxableAmount
   * @returns {Money}
   */
  calculateTax(taxableAmount) {
    return taxableAmount.multiply(this.rule.taxRate);
  }

  /**
   * Calcula el recargo bancario según contexto.
   * @param {Money} baseAmount
   * @param {{paymentMethod?: string}} context
   * @returns {Money}
   */
  calculateSurcharge(baseAmount, context = {}) {
    const surchargeDecimal = this.rule.surcharge(baseAmount, context);
    return Money.fromDecimal(surchargeDecimal, baseAmount.currency);
  }
}

module.exports = TaxPolicy;
