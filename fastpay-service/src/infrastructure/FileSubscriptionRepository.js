'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const SubscriptionRepositoryPort = require('../ports/SubscriptionRepositoryPort');
const Subscription = require('../domain/Subscription');

/**
 * ADAPTADOR: FileSubscriptionRepository
 * -------------------------------------------------------------
 * Implementa el puerto de persistencia sobre un archivo JSON, pero:
 *  - Usa I/O ASÍNCRONO (fs/promises) en vez de fs.readFileSync, evitando
 *    el bloqueo del Event Loop que colapsaba el microservicio.
 *  - Escribe de forma ATÓMICA (archivo temporal + rename) para no dejar
 *    el JSON corrupto a medias ante fallos (ISO/IEC 25010: Fiabilidad).
 *
 * Deuda táctica deliberada y prudente (ver INFORME_AUDITORIA, TDR-DEC-01):
 * se mantiene la persistencia en archivo plano en lugar de migrar a una
 * base de datos distribuida. La atomicidad + el mutex de aplicación
 * mitigan el riesgo hasta el Debt Ceiling definido.
 */
class FileSubscriptionRepository extends SubscriptionRepositoryPort {
  /**
   * @param {string} dbFile  Ruta absoluta al archivo JSON de datos.
   */
  constructor(dbFile) {
    super();
    this.dbFile = dbFile;
  }

  async _readAll() {
    const raw = await fs.readFile(this.dbFile, 'utf-8');
    return JSON.parse(raw);
  }

  async _writeAllAtomic(records) {
    const dir = path.dirname(this.dbFile);
    const tmp = path.join(dir, `.${path.basename(this.dbFile)}.${process.pid}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(records, null, 2) + os.EOL, 'utf-8');
    await fs.rename(tmp, this.dbFile); // rename es atómico dentro del mismo volumen
  }

  async findById(id) {
    const records = await this._readAll();
    const record = records.find((r) => r.id === id);
    return record ? new Subscription(record) : null;
  }

  async findAll() {
    const records = await this._readAll();
    return records.map((r) => new Subscription(r));
  }

  async save(subscription) {
    const records = await this._readAll();
    const index = records.findIndex((r) => r.id === subscription.id);
    const serialized = subscription.toJSON();
    if (index === -1) {
      records.push(serialized);
    } else {
      records[index] = serialized;
    }
    await this._writeAllAtomic(records);
  }
}

module.exports = FileSubscriptionRepository;
