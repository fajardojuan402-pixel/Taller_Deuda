'use strict';

/**
 * CASO DE USO: ListSubscriptionsUseCase
 * -------------------------------------------------------------
 * Devuelve todas las suscripciones en formato serializable.
 */
class ListSubscriptionsUseCase {
  /**
   * @param {object} deps
   * @param {import('../ports/SubscriptionRepositoryPort')} deps.repository
   */
  constructor({ repository }) {
    this.repository = repository;
  }

  async execute() {
    const subs = await this.repository.findAll();
    return subs.map((s) => s.toJSON());
  }
}

module.exports = ListSubscriptionsUseCase;
