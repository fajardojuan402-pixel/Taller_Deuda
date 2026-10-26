'use strict';

/* eslint-disable no-unused-vars */

/**
 * PUERTO: SubscriptionRepositoryPort
 * -------------------------------------------------------------
 * Contrato de persistencia. El dominio y la aplicación dependen de
 * esta abstracción, nunca de fs ni de un archivo JSON concreto
 * (Inversión de Dependencias - ISO/IEC 25010: Modularidad).
 */
class SubscriptionRepositoryPort {
  /**
   * @param {string} id
   * @returns {Promise<import('../domain/Subscription')|null>}
   */
  async findById(id) {
    throw new Error('No implementado: findById');
  }

  /**
   * @returns {Promise<import('../domain/Subscription')[]>}
   */
  async findAll() {
    throw new Error('No implementado: findAll');
  }

  /**
   * @param {import('../domain/Subscription')} subscription
   * @returns {Promise<void>}
   */
  async save(subscription) {
    throw new Error('No implementado: save');
  }
}

module.exports = SubscriptionRepositoryPort;
