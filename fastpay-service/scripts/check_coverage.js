'use strict';

/**
 * QUALITY GATE 3 & 4: Pruebas + umbral de cobertura.
 * -------------------------------------------------------------
 * Ejecuta la suite con cobertura nativa de Node y BLOQUEA (exit 1) si:
 *   - Alguna prueba falla, o
 *   - La cobertura global de lineas cae por debajo de THRESHOLD (80%).
 *
 * Este script es el que invoca el pipeline de CI para hacer cumplir el
 * Quality Gate de forma estricta (ISO/IEC/IEEE 12207: control de calidad).
 */

const { spawnSync } = require('node:child_process');

const THRESHOLD = 80;

const result = spawnSync(
  process.execPath,
  ['--test', '--experimental-test-coverage', '--test-reporter=tap'],
  { cwd: process.cwd(), encoding: 'utf-8' }
);

const output = `${result.stdout || ''}${result.stderr || ''}`;
process.stdout.write(output);

// 1) Las pruebas deben pasar.
if (result.status !== 0) {
  console.error('\n[QUALITY GATE] FALLO: hay pruebas que no pasan.');
  process.exit(1);
}

// 2) Parsear la linea "all files" del reporte de cobertura.
//    Formato: # all files | 98.95 | 96.46 | 94.49 |
const match = output.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/i);

if (!match) {
  console.error('\n[QUALITY GATE] FALLO: no se pudo leer el reporte de cobertura.');
  process.exit(1);
}

const lineCoverage = parseFloat(match[1]);
const branchCoverage = parseFloat(match[2]);
const funcCoverage = parseFloat(match[3]);

console.log('\n==================== QUALITY GATE: COBERTURA ====================');
console.log(`Lineas:   ${lineCoverage}%`);
console.log(`Ramas:    ${branchCoverage}%`);
console.log(`Funciones:${funcCoverage}%`);
console.log(`Umbral requerido (lineas): ${THRESHOLD}%`);
console.log('================================================================');

if (lineCoverage < THRESHOLD) {
  console.error(
    `\n[QUALITY GATE] BLOQUEADO: cobertura de lineas ${lineCoverage}% < ${THRESHOLD}%. Merge rechazado.`
  );
  process.exit(1);
}

console.log('\n[QUALITY GATE] APROBADO: cobertura por encima del umbral. ✔');
process.exit(0);
