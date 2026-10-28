# Taller Casa — Auditoría Forense, Gobernanza y Quality Gates (FastPay Global)

Solución del **Taller 2 (Para Casa)** del curso de Deuda Técnica en Software:
auditoría forense del microservicio `fastpay-billing-service`, remediación con
**Arquitectura Hexagonal**, **Value Objects** e **idempotencia**, y blindaje con
un pipeline de **Quality Gates en GitHub Actions**.

## Entregables

- **`INFORME_AUDITORIA.md`** — informe completo: inventario de deuda, análisis
  forense de incidentes, TDR, ROI, matriz de priorización, Technical Debt Register
  y conclusiones de gobernanza (ISO/IEC 25010 e ISO/IEC/IEEE 12207).
- **`fastpay-service/`** — microservicio refactorizado a arquitectura hexagonal.
- **`.github/workflows/quality-gate.yml`** — pipeline de CI con 4 gates.

## Estructura

```text
.
├── INFORME_AUDITORIA.md
├── GUIA_TALLER_CASA.md
├── INFORME_AUDITORIA_TEMPLATE.md
├── .github/workflows/quality-gate.yml
└── fastpay-service/
    ├── src/
    │   ├── domain/         # Money, Subscription, TaxPolicy, DiscountPolicy, BillingCalculator
    │   ├── application/    # ProcessBillingUseCase, ListSubscriptionsUseCase, KeyedMutex
    │   ├── ports/          # SubscriptionRepositoryPort, PaymentGatewayPort
    │   └── infrastructure/ # File/InMemory repos, MockStripeGateway, config, buildApp, server
    ├── test/               # 44 pruebas (caracterización + unitarias + integración)
    ├── scripts/            # simulate_billing.js, check_coverage.js
    └── data/               # subscriptions.json, incidents-history.json
```

## Puesta en marcha

```bash
cd fastpay-service
npm install

# Arrancar el servicio
npm start

# Ejecutar la suite de pruebas (50 tests: unitarias, caracterizacion e integracion)
npm test

# Pruebas con cobertura
npm run test:coverage

# Quality Gate de cobertura (falla si < 80%)
node scripts/check_coverage.js

# Análisis estático
npm run lint

# Auditoría de seguridad
npm audit --audit-level=high

# Simular 5 cobros concurrentes (demuestra que el cobro duplicado quedó resuelto)
npm run simulate
```

## Resultados clave de la remediación

| Métrica | Legacy | Refactorizado |
| :--- | :--- | :--- |
| Complejidad ciclomática máx. | 22 | ≤ 8 |
| Cobertura de pruebas | ~0% | 97.74% líneas (50 tests) |
| Cobros duplicados (5 concurrentes) | 5 de 5 | 1 de 5 |
| Secretos hardcodeados | 1 | 0 |
| Vulnerabilidades altas | 0 | 0 |
| TDR | 13.3% | ~0% |

## Evidencia de los Quality Gates (Fase 5)

El repositorio incluye dos ramas de demostración para evidenciar que el pipeline
de GitHub Actions bloquea o aprueba un Pull Request según cumpla los estándares:

| Rama | Propósito | Resultado esperado |
| :--- | :--- | :--- |
| `demo/quality-gate-fail` | Introduce una función con complejidad 12 y anidamiento 6 (viola ESLint) | **PR bloqueado** (check en rojo) |
| `feature/annual-discount-rule` | Nueva regla de descuento con pruebas (OCP) | **PR aprobado** (checks en verde) |

Para generar las capturas de evidencia:

1. Abre el PR bloqueado:
   `https://github.com/fajardojuan402-pixel/Taller_Deuda/compare/main...demo/quality-gate-fail`
   → espera a que GitHub Actions corra y muestre el check en **rojo**.
2. Abre el PR aprobado:
   `https://github.com/fajardojuan402-pixel/Taller_Deuda/compare/main...feature/annual-discount-rule`
   → los checks saldrán en **verde** y el merge quedará habilitado.

Recomendado: en *Settings → Branches* crea una *branch protection rule* para `main`
que exija pasar el check **"Quality Gate - FastPay Billing Service"** antes de fusionar.

## Variables de entorno

Copia `fastpay-service/.env.example` a `fastpay-service/.env` y ajusta los valores.
El secreto de la pasarela se lee de `PAYMENT_GATEWAY_API_KEY`; nunca se versiona.
