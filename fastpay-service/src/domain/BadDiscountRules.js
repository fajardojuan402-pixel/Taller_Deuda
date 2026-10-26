'use strict';

/**
 * ARCHIVO DE DEMOSTRACION - FALLO DELIBERADO
 * -------------------------------------------------------------
 * Este archivo se introduce A PROPOSITO en la rama demo/quality-gate-fail
 * para demostrar que el Quality Gate de CI/CD BLOQUEA el Pull Request.
 *
 * Viola dos gates simultaneamente:
 *  - GATE 1 (ESLint): la funcion tiene complejidad ciclomatica > 8 y
 *    profundidad de anidamiento > 3 (reglas del .eslintrc.json).
 *  - GATE 4 (Cobertura): no tiene pruebas asociadas, bajando la cobertura.
 *
 * NO debe fusionarse a main. Es evidencia de que el pipeline rechaza
 * codigo que no cumple los estandares (ISO/IEC/IEEE 12207).
 */
function computeMessyDiscount(plan, cycle, country, amount, coupon, loyalty) {
  let discount = 0;
  if (plan === 'ENTERPRISE') {
    if (cycle === 'ANNUAL') {
      if (country === 'CO') {
        if (amount > 1000) {
          if (coupon === 'MEGA') {
            if (loyalty > 5) {
              discount = amount * 0.5;
            } else {
              discount = amount * 0.4;
            }
          } else if (coupon === 'MID') {
            discount = amount * 0.3;
          } else {
            discount = amount * 0.2;
          }
        } else if (amount > 500) {
          discount = amount * 0.15;
        } else {
          discount = amount * 0.1;
        }
      } else if (country === 'US') {
        discount = amount * 0.05;
      } else {
        discount = 0;
      }
    } else if (cycle === 'MONTHLY') {
      discount = 5;
    } else {
      discount = 0;
    }
  } else if (plan === 'PRO') {
    discount = 2;
  } else {
    discount = 0;
  }
  return discount;
}

module.exports = { computeMessyDiscount };
