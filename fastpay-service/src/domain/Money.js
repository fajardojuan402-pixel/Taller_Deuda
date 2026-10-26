'use strict';

/**
 * VALUE OBJECT: Money
 * -------------------------------------------------------------
 * Resuelve el smell de Primitive Obsession y el bug de coma flotante
 * (IEEE 754: 0.1 + 0.2 !== 0.3) representando internamente el valor
 * en CENTAVOS ENTEROS. Todas las operaciones son inmutables.
 *
 * ISO/IEC 25010: Adecuación Funcional (Exactitud) y Mantenibilidad (Reusabilidad).
 */
class Money {
  /**
   * @param {number} cents  Cantidad en centavos (entero).
   * @param {string} currency  Código ISO 4217 (ej. "USD").
   */
  constructor(cents, currency = 'USD') {
    if (!Number.isInteger(cents)) {
      throw new TypeError(`Money requiere centavos enteros, recibido: ${cents}`);
    }
    if (typeof currency !== 'string' || currency.length !== 3) {
      throw new TypeError(`Moneda ISO 4217 inválida: ${currency}`);
    }
    this.cents = cents;
    this.currency = currency.toUpperCase();
    Object.freeze(this);
  }

  /**
   * Construye Money desde un importe decimal (ej. 299.99 -> 29999 centavos).
   * Usa redondeo bancario seguro para evitar errores de representación binaria.
   */
  static fromDecimal(amount, currency = 'USD') {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new TypeError(`Importe decimal inválido: ${amount}`);
    }
    const cents = Math.round((amount + Number.EPSILON) * 100);
    return new Money(cents, currency);
  }

  static zero(currency = 'USD') {
    return new Money(0, currency);
  }

  _assertSameCurrency(other) {
    if (!(other instanceof Money)) {
      throw new TypeError('La operación requiere otra instancia de Money.');
    }
    if (other.currency !== this.currency) {
      throw new Error(
        `No se pueden operar monedas distintas: ${this.currency} vs ${other.currency}`
      );
    }
  }

  add(other) {
    this._assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other) {
    this._assertSameCurrency(other);
    return new Money(this.cents - other.cents, this.currency);
  }

  /**
   * Multiplica por un factor (ej. tasa de impuesto 0.19).
   * Redondea a centavos enteros de forma segura.
   */
  multiply(factor) {
    if (typeof factor !== 'number' || Number.isNaN(factor)) {
      throw new TypeError(`Factor inválido: ${factor}`);
    }
    return new Money(Math.round(this.cents * factor), this.currency);
  }

  isGreaterThan(other) {
    this._assertSameCurrency(other);
    return this.cents > other.cents;
  }

  equals(other) {
    return (
      other instanceof Money &&
      other.cents === this.cents &&
      other.currency === this.currency
    );
  }

  /** Devuelve el importe decimal (ej. 29999 -> 299.99). Solo para presentación. */
  toDecimal() {
    return this.cents / 100;
  }

  toString() {
    return `${this.toDecimal().toFixed(2)} ${this.currency}`;
  }
}

module.exports = Money;
