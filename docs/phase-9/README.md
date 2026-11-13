# Fase 9 — Aseguramiento Final, Preparación para GitHub y Validación de Staging (Opción A)

## Índice de Entregables

1. [01-informe-aseguramiento-final-y-preparacion-produccion.md](./01-informe-aseguramiento-final-y-preparacion-produccion.md): Informe técnico inicial de la Fase 9 (arquitectura de despliegue, cierre en código de `OBS-06-01` a `OBS-08-02`, auditoría de dependencias `DEF-09-01` a `DEF-09-03`, regresión completa de Fases 2 a 9, E2E Playwright y prueba de carga).
2. [02-preparacion-github-y-validacion-staging.md](./02-preparacion-github-y-validacion-staging.md): Auditoría del candidato para GitHub (archivos e historial), comandos exactos de publicación, resolución técnica y experimental de `AES256` (`SSE-S3`) vs `SSE-KMS` (`aws:kms`), validación de transporte SMTP (Mock vs Socket TCP RFC 5321 real), análisis de interrupción post-SMTP del worker, repetición de carga de 50 VUs con umbrales predefinidos (`p95` lecturas vs escrituras) y restauración en base Neon aislada (`WAL LSN`, `RTO` y `RPO = 0`).

## Scripts de Verificación de Fase 9

- `pnpm test:phase9` (`node scripts/test-phase9.js`): Ejecuta las 29 pruebas automatizadas de endurecimiento de producción (`OBS-06-01`, `OBS-06-02` `AES256` vs `SSE-KMS`, `FIND-06-02`, `OBS-07-01`, `OBS-07-02` incluyendo caída post-SMTP, `OBS-07-03` Mock y TCP RFC 5321 real, `OBS-08-02` y restauración en base Neon aislada).
- `pnpm test:e2e:phase9` (`node scripts/e2e-playwright-phase9.js`): Levanta el servidor HTTP NestJS, conecta Playwright con Google Chrome Headless para validar las 30 aserciones E2E (incluyendo CORS, MFA TOTP, cookies `HttpOnly`, documentos, notificaciones, CSV) y ejecuta la prueba de carga concurrente de 50 VUs (260 peticiones HTTP con desglose de `p95` de lecturas y escrituras).
- `scripts/load-test.k6.js`: Script declarativo para pruebas de carga con binario `k6` (rampa de 50 VUs).
