'use strict';

const SubscriptionRepositoryPort = require('../ports/SubscriptionRepositoryPort');
const Subscription = require('../domain/Subscription');

/**
 * ADAPTADOR: InMemorySubscriptionRepository
 * -------------------------------------------------------------
 * Implementación en memoria del puerto de persistencia. Se usa en las
 * pruebas para aislar el dominio del sistema de archivos
 * (ISO/IEC 25010: Testeabilidad).
 */
class InMemorySubscriptionRepository extends SubscriptionRepositoryPort {
  /**
   * @param {object[]} seed  Registros iniciales (formato JSON plano).
   */
  constructor(seed = []) {
    super();
    this.store = new Map();
    for (const record of seed) {
      this.store.set(record.id, { ...record });
    }
  }

  async findById(id) {
    const record = this.store.get(id);
    return record ? new Subscription({ ...record }) : null;
  }

  async findAll() {
    return Array.from(this.store.values()).map((r) => new Subscription({ ...r }));
  }

  async save(subscription) {
    this.store.set(subscription.id, subscription.toJSON());
  }
}

module.exports = InMemorySubscriptionRepository;
