'use strict';

/**
 * APLICACIÓN: KeyedMutex
 * -------------------------------------------------------------
 * Serializa operaciones asíncronas por clave (ej. por subId). Resuelve
 * la condición de carrera del legacy, donde 5 peticiones concurrentes
 * leían/escribían el mismo archivo entrelazándose y producían cobros
 * múltiples (ISO/IEC 25010: Fiabilidad - Tolerancia a fallos).
 *
 * Cada clave encadena sus operaciones en una promesa secuencial, de modo
 * que la crítica lectura->decisión->escritura nunca se intercala.
 */
class KeyedMutex {
  constructor() {
    this._chains = new Map();
  }

  /**
   * Ejecuta `task` en exclusión mutua respecto a otras tareas de la misma `key`.
   * @param {string} key
   * @param {() => Promise<T>} task
   * @returns {Promise<T>}
   * @template T
   */
  runExclusive(key, task) {
    const previous = this._chains.get(key) || Promise.resolve();

    const run = previous.then(() => task(), () => task());

    // La cadena guarda el resultado "silenciado" para no romperse ante errores.
    const settled = run.catch(() => {});
    this._chains.set(key, settled);

    // Limpieza: si esta es la última tarea en la cadena, libera la entrada.
    settled.finally(() => {
      if (this._chains.get(key) === settled) {
        this._chains.delete(key);
      }
    });

    return run;
  }
}

module.exports = KeyedMutex;
