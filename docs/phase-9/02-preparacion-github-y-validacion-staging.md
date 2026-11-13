# INFORME DE PREPARACIÓN PARA GITHUB Y VALIDACIÓN DE STAGING — FASE 9
## MEXAGENDA — CANDIDATO DE PRODUCCIÓN (OPCIÓN A: MÓDULOS MOD-01 A MOD-07)

- **Fecha de emisión:** 9 de noviembre de 2026
- **Candidato original de partida (Fase 9):** `4741c57e40990a82bb62746f26b8d3b1cc8f05cb`
- **Tag auditado de Fase 8 preservado intacto:** `v0.8.0-phase8` -> `e6b90d5da8a8bdfc1f60ea58f8417af6894bca00`
- **Tag histórico de Fase 7 preservado intacto:** `v0.7.1-phase7-fixes` -> `9d2cf017b36c75f3f07d1769f736550c7c466a69`
- **Rama activa:** `master`
- **Estado de remotos (`git remote -v`):** Vacío (sin repositorio remoto conectado aún).

---

## 1. AUDITORÍA DEL CANDIDATO PARA GITHUB (ARCHIVOS E HISTORIAL)

### 1.1 Revisión de Archivos Rastreados e Historial Alcanzable
Se ejecutó una inspección automatizada exhaustiva sobre la totalidad de los archivos rastreados en `HEAD` (**378 archivos**) y sobre el historial completo de commits alcanzables desde `master`, `v0.8.0-phase8` y `v0.7.1-phase7-fixes` (`git log --all -p`):

| Vector Auditado | Resultado en `HEAD` y en el Historial Git | Veredicto |
| :--- | :--- | :---: |
| **Archivos de entorno reales (`.env`, `.env.local`, `.env.production`, `.env.staging`)** | **0 archivos** rastreados actualmente o en commits históricos. Solo existe la plantilla sanitizada [`.env.example`](file:///d:/MexAgenda/.env.example). | **LIMPIO** |
| **Secretos locales contrastados contra el historial Git** | Se contrastaron todos los valores reales presentes en `.env.local` (credenciales de Neon, secretos de sesión/CSRF y claves hexadecimales) contra `git ls-files` y `git log --all -p`: **0 coincidencias**. | **LIMPIO** |
| **Patrones de llaves y tokens (`npg_`, `AKIA`, `ASIA`, `BEGIN PRIVATE KEY`, `ghp_`)** | **0 coincidencias** de llaves reales en el árbol ni en el historial. *(El identificador de ejemplo `AKIAIOSFODNN7EXAMPLE` documentado por AWS para pruebas unitarias sin valor real solo se emplea en memoria dentro de `scripts/test-phase9.js`)*. | **LIMPIO** |
| **Volcados de base de datos (`.dump`, `.bak`, `.sqlite`, `.db`) y archivos de usuarios (`storage/vault/`)** | **0 archivos** rastreados. El directorio `storage/` y los artefactos de compilación están excluidos en [`.gitignore`](file:///d:/MexAgenda/.gitignore). | **LIMPIO** |
| **Nombres de host en documentación histórica** | 6 archivos de documentación histórica (`docs/phase-5/03-migraciones-neon.md`, `docs/phase-5/12-dictamen-entrega.md`, `docs/phase-5-audit/09-resultados-pruebas.md`, `docs/phase-5-audit/11-dictamen-final.md`, `docs/phase-5-audit/README.md`, `docs/phase-7/14-evidencias.md`) contienen únicamente el hostname DNS público impreso por Prisma CLI (`ep-...-pooler.us-east-1.aws.neon.tech`), **sin usuario, sin contraseña y sin cadena de conexión**. | **SEGURO** |

### 1.2 Diferencias Respecto al Candidato Original (`4741c57e40990a82bb62746f26b8d3b1cc8f05cb`)
Sobre el candidato `4741c57e40990a82bb62746f26b8d3b1cc8f05cb` se aplicaron y consolidaron los siguientes ajustes defensivos y de verificación:
1. **Soporte explícito de `AES256` (`SSE-S3`) y `aws:kms` (`SSE-KMS`) en S3 (`OBS-06-02`):**
   - En [`apps/backend/src/modules/documents/storage/s3-storage.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/s3-storage.service.ts) y [`storage.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/storage.service.ts): añadido soporte para `S3_SSE_MODE` (`'AES256' | 'aws:kms' | 'NONE'`) y `S3_KMS_KEY_ID`, inyectando explícitamente `ServerSideEncryption` y `SSEKMSKeyId` en `PutObjectCommand`. Documentado en [`.env.example`](file:///d:/MexAgenda/.env.example).
2. **Validación de longitud y formato hexadecimal en firmas HMAC locales (`FIND-06-02`):**
   - En [`apps/backend/src/modules/documents/storage/local-storage.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/local-storage.service.ts): validación previa de paridad, formato hexadecimal y longitud de buffer antes de `crypto.timingSafeEqual()`, evitando excepciones `RangeError` (`500`) ante firmas manipuladas de longitud impar.
3. **Homologación de variable `SMTP_PASSWORD` / `SMTP_PASS` (`DEF-09-04`):**
   - En [`apps/backend/src/modules/notifications/smtp/smtp.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/notifications/smtp/smtp.service.ts): lectura compatible con `SMTP_PASSWORD` o `SMTP_PASS` para evitar que diferencias de nomenclatura en variables de entorno impidan activar el transporte real.
4. **Apagado elegante (*Graceful Shutdown*) en el Worker de Outbox (`DEF-09-05`):**
   - En [`apps/backend/src/modules/notifications/queue/outbox-worker.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/notifications/queue/outbox-worker.service.ts): `onModuleDestroy()` ahora activa la bandera `isShuttingDown` y aguarda hasta 3 segundos a que concluya cualquier ciclo `isProcessing` en vuelo antes de permitir el cierre del motor de Prisma.
5. **Ampliación de las suites `scripts/test-phase9.js` (29 pruebas) y `scripts/e2e-playwright-phase9.js` (30 aserciones):**
   - Verificación de `AES256` vs `SSE-KMS`, ventana de interrupción post-SMTP del worker, transporte `nodemailer` sobre servidor TCP RFC 5321 real, restauración completa en base Neon aislada (`CREATE DATABASE`) con verificación de flujos sobre la base restaurada, validación explícita de preflight CORS y desglose de latencias `p95` de lecturas vs escrituras bajo 50 VUs.

### 1.3 Rama, Tags y Comandos Exactos para Subir a GitHub Privado
- **Rama que debe subirse:** `master`
- **Tags que deben subirse:** `v0.7.1-phase7-fixes` y `v0.8.0-phase8`

Una vez creado el repositorio privado vacío en GitHub (sin inicializar con `README`, `.gitignore` ni licencia), ejecute desde `d:\MexAgenda`:

```bash
# 1. Registrar el repositorio remoto privado
git remote add origin <URL_REPOSITORIO_PRIVADO_GITHUB>

# 2. Verificar que el remoto quedó configurado
git remote -v

# 3. Subir la rama principal consolidada (incluye Fase 9)
git push -u origin master

# 4. Subir los tags auditados de Fase 7 y Fase 8
git push origin v0.7.1-phase7-fixes v0.8.0-phase8
```

---

## 2. PREPARACIÓN Y VALIDACIÓN DE STAGING

### 2.1 Configuración Verificada de Entornos (Vercel Preview + Servidor Persistente NestJS + Neon Staging)

| Capa de Staging | Configuración y Comandos Reales Verificados | Variables de Entorno Requeridas en Staging | Estado Actual |
| :--- | :--- | :--- | :--- |
| **Frontend (Vercel Preview)** | **Root Directory:** `.`<br>**Install Command:** `pnpm install --frozen-lockfile`<br>**Build Command:** `pnpm --filter @mexagenda/shared build && pnpm --filter @mexagenda/validation build && pnpm --filter @mexagenda/frontend build`<br>**Output Directory:** `apps/frontend/.next` | `BACKEND_INTERNAL_URL=https://api-staging.<dominio>`<br>`NEXT_PUBLIC_API_URL=/api/v1`<br>`NEXT_PUBLIC_APP_NAME="MexAgenda Staging"` | Build y proxy verificados localmente (`27/27` rutas Next.js). Pendiente conectar GitHub a Vercel. |
| **Backend + Worker (Servicio Persistente)** | **Build Command:** `pnpm --filter @mexagenda/shared build && pnpm --filter @mexagenda/validation build && pnpm prisma:generate && pnpm --filter @mexagenda/backend build`<br>**Start Command:** `node apps/backend/dist/main.js` | `NODE_ENV=production`<br>`PORT=4000`<br>`FRONTEND_URL=https://staging.<dominio>`<br>`DATABASE_URL` (pooled Neon staging)<br>`DIRECT_URL` (direct Neon staging)<br>`SESSION_SECRET`, `CSRF_SECRET`, `MFA_ENCRYPTION_KEY`<br>`S3_*`, `SMTP_*` | Compilación, API, CORS, cookies y worker verificados en servidor local. Pendiente aprovisionar host persistente de staging. |
| **Base de Datos (Neon Staging)** | **Migraciones DDL:** `npx prisma migrate deploy` (8 migraciones aplicadas sin errores)<br>**Semilla RBAC y Admin:** `node scripts/bootstrap-admin.js` | Base/rama aislada en Neon (ej. `mexagenda_staging`), separada físicamente de `neondb` / producción. | Creación y migración de base aislada en Neon verificadas en vivo (`TEST-28` y `TEST-29`). |

### 2.2 Verificación en Navegador (Playwright Chrome Headless): Login, MFA, Cookies y CORS
En `scripts/e2e-playwright-phase9.js` (`30/30 PASS`) se verificó desde **Google Chrome Headless `156.0.8078.80`** contra el servidor NestJS:
- **CORS y Preflight (`E2E-04`):** Solicitud `OPTIONS /api/v1/health` con cabecera `Origin: http://localhost:3000` devuelve `Access-Control-Allow-Origin: http://localhost:3000` y `Access-Control-Allow-Credentials: true`.
- **Login, Desafío MFA TOTP y Cookies (`E2E-05` a `E2E-09`):**
  - Contraseña inválida rechazada con `401 Unauthorized`.
  - Login primario de `ROLE_ADMIN` devuelve `mfaRequired: true` y `mfaToken` efímero firmado.
  - Verificación de segundo factor en `POST /api/v1/auth/mfa/verify` emite cookie `mexagenda_session` (`HttpOnly; SameSite=Strict; Path=/`; en `NODE_ENV=production` se renombra automáticamente a `__Host-mexagenda_session` con atributo `Secure`).
  - `GET /api/v1/auth/me` autentica automáticamente usando la cookie del navegador.
- **Flujos Principales (`E2E-10` a `E2E-28`):** Ciclo completo de reunión + quórum + aprobación de acta, acuerdo + avance 100%, aislamiento ABAC `403` en notas privadas, carga y descarga de PDF limpio vs bloqueo `403` de archivo EICAR, notificaciones automáticas y exportación CSV sanitizada.
- **Lo que queda pendiente en dominios reales de Staging:** Repetir este mismo smoke test apuntando a las URLs HTTPS definitivas de Vercel Preview (`https://<preview>.vercel.app`) y del servidor backend de staging una vez desplegados.

### 2.3 Resolución con Evidencia: Diferencia entre `AES256` (`SSE-S3`) y `SSE-KMS` (`aws:kms`)

#### Análisis Técnico y Arquitectónico
En la especificación de Fase 0 ([`docs/phase-0/13-almacenamiento-documental.md`](file:///d:/MexAgenda/docs/phase-0/13-almacenamiento-documental.md#L95-L96)) se estableció: *"Cifrado forzado con AES-256 (`aws:kms` o `AES256`)"*. Aunque ambos modos cifran los bytes físicos en reposo utilizando el algoritmo simétrico **AES-256**, existen diferencias técnicas críticas en la gestión criptográfica y en las cabeceras del SDK de S3:

| Criterio Técnico | `AES256` (`SSE-S3`) | `aws:kms` (`SSE-KMS`) |
| :--- | :--- | :--- |
| **Cabecera en `PutObjectCommand`** | `ServerSideEncryption: "AES256"` | `ServerSideEncryption: "aws:kms"` + `SSEKMSKeyId: "<KMS_KEY_ARN>"` |
| **Custodia y Rotación de la Llave Maestra** | Gestionada internamente por AWS S3 / Cloudflare R2 sin configuración adicional. | Gestionada en **AWS KMS** (*Customer Managed Key* — CMK), con rotación anual controlable, revocación inmediata y trazabilidad de cada uso de llave en AWS CloudTrail. |
| **Requisito IAM para URLs Prefirmadas (`GetObjectCommand`)** | Basta con `s3:GetObject` sobre el ARN del bucket. | El rol/usuario IAM que firma la URL prefirmada debe poseer simultáneamente `s3:GetObject` en el bucket **y** `kms:Decrypt` / `kms:GenerateDataKey` en la política de la llave KMS, firmando obligatoriamente con **AWS Signature Version 4 (SigV4)**. |
| **Compatibilidad Multi-Cloud** | Soportado nativamente en AWS S3, Cloudflare R2 y MinIO. | Exclusivo de AWS S3 con AWS KMS (o MinIO configurado con KES/Vault). |

#### Evidencia de Implementación y Verificación en Código
En el candidato anterior (`4741c57`), `S3StorageService.upload()` delegaba el cifrado a la configuración por defecto del bucket sin enviar la cabecera `ServerSideEncryption`. En esta entrega se actualizó [`S3StorageService`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/s3-storage.service.ts#L13-L84) y [`StorageService`](file:///d:/MexAgenda/apps/backend/src/modules/documents/storage/storage.service.ts#L16-L48) para soportar ambos modos de forma explícita mediante `S3_SSE_MODE` y `S3_KMS_KEY_ID`, verificándose en `scripts/test-phase9.js`:
- **`TEST-10` (Modo `AES256`):** Comprobado que `S3StorageService` con `sseMode: 'AES256'` inyecta `ServerSideEncryption: "AES256"` y `SSEKMSKeyId: undefined` en `PutObjectCommand`.
- **`TEST-11` (Modo `SSE-KMS` para Producción):** Comprobado que `S3StorageService` con `sseMode: 'aws:kms'` y `kmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/mrk-mexagenda-prod-cmk'` inyecta `ServerSideEncryption: "aws:kms"`, `SSEKMSKeyId: "arn:aws:kms:..."` en `PutObjectCommand` y firma las URLs de descarga con `X-Amz-Algorithm=AWS4-HMAC-SHA256` y `X-Amz-Expires=300`.
- **Bloqueo de archivos pendientes o rechazados (`TEST-03` a `TEST-09` y `E2E-23`):** Comprobado que cualquier archivo en estado `INFECTADO`, `PENDIENTE_REVISION` o `ERROR_ESCANEO` permanece bloqueado con `403 Forbidden` en `/api/v1/documents/:id/download`.
- **Pendiente Externo:** Aprovisionar las credenciales de un bucket privado real en la nube (`S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_SSE_MODE`, `S3_KMS_KEY_ID`) para repetir la carga física en el proveedor cloud.

### 2.4 Validación de Transporte SMTP: Evidencia con Mock vs Socket TCP Real vs Proveedor Externo
Para separar rigurosamente las capas probadas:

| Nivel de Prueba SMTP | Estado | Evidencia Registrada (`scripts/test-phase9.js`) |
| :--- | :---: | :--- |
| **1. `MockTransporter` (`jsonTransport: true`)** | **VERIFICADO (`TEST-21`, `TEST-22`)** | Valida formato de correo, rechazo previo de sintaxis inválida, enmascaramiento de destinatario en logs (`u***6@mexagenda.gob.mx`) y generación de `Message-ID` determinista. |
| **2. Transporte `nodemailer` Real sobre Socket TCP RFC 5321 (`isMock = false`)** | **VERIFICADO (`TEST-23`)** | Se levantó un servidor TCP ESMTP real en `127.0.0.1` (puerto `54977`) con handshake completo RFC 5321 (`220`, `EHLO`, `AUTH PLAIN`, `235 2.7.0 Authentication successful`, `MAIL FROM`, `RCPT TO`, `DATA`, `250 2.0.0 OK`). `SmtpService` se conectó en modo real (`isMock = false`), transmitió el mensaje por red TCP y el servidor capturó el flujo MIME íntegro incluyendo `Message-ID: <f9-tcp-wire-wzog4wn6@mexagenda.institucional.gob.mx>`. |
| **3. Proveedor SMTP Externo Autorizado y Buzón Real (Staging/Producción)** | **PENDIENTE DE CREDENCIALES** | En `.env.local` no existen credenciales de un relay SMTP externo (`SES`, `SendGrid`, `Mailtrap`, `O365`). Queda pendiente que la Coordinación aporte `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y un buzón de prueba para certificar entrega externa y cabeceras `SPF/DKIM/DMARC`. |

### 2.5 Recuperación de Entrega Atascada e Interrupción Post-SMTP (`OBS-07-01` vs `OBS-07-02`)

Se verificó y documentó la diferencia arquitectónica entre ambos escenarios:

1. **Reclamación Concurrente en Operación Normal (`OBS-07-01` — `TEST-13` y `TEST-14`):**
   - Cuando dos o más instancias de `OutboxWorkerService` están activas simultáneamente y leen el mismo lote de entregas en estado `PENDIENTE`, cada worker intenta reclamar la fila mediante una sentencia atómica condicional en PostgreSQL:
     ```sql
     UPDATE notification_deliveries
     SET status = 'EN_PROCESO', next_attempt_at = NOW()
     WHERE id = $1 AND status = 'PENDIENTE';
     ```
   - PostgreSQL serializa el `UPDATE` a nivel de fila: exactamente **un** worker obtiene `claimed.count === 1` y procede a despachar por SMTP; los demás obtienen `claimed.count === 0` y omiten la fila antes de invocar `smtpService.sendMail()`.
   - **Resultado:** **Cero duplicación** (semántica *Exactly-Once* frente a concurrencia entre workers activos).

2. **Fallo / Interrupción del Worker DESPUÉS de que SMTP acepta el mensaje y ANTES de actualizar BD (`OBS-07-02` — `TEST-20`):**
   - **¿Qué ocurre exactamente en esta ventana de fallo?**
     1. `Worker A` reclama la entrega (`status = 'EN_PROCESO'`, `attempts = 0`), invoca `smtpService.sendMail()` y el servidor SMTP remoto acepta el correo (`250 OK`).
     2. Antes de que `Worker A` pueda ejecutar `UPDATE notification_deliveries SET status = 'ENVIADO', sent_at = NOW(), attempts = 1`, el proceso de `Worker A` se interrumpe abruptamente (`SIGKILL`, corte de red o reinicio forzado que supere la ventana de 3s del *graceful shutdown*).
     3. Como el protocolo SMTP (RFC 5321) no participa en transacciones distribuidas `2PC/XA` con PostgreSQL, la fila queda huérfana en la base de datos con `status = 'EN_PROCESO'` y `sentAt = null`.
     4. Transcurridos **15 minutos** (`staleThresholdMinutes = 15`), el barrido `recoverStuckDeliveries(15)` de `Worker B` detecta la fila estancada en `EN_PROCESO`, incrementa `attempts` a `1` (contabilizando el intento interrumpido) y, dado que `1 < maxAttempts (3)`, la revierte a `status = 'PENDIENTE'`.
     5. En el ciclo inmediato, `Worker B` reclama la fila y ejecuta el reenvío por SMTP, tras lo cual actualiza la fila a `status = 'ENVIADO'` con `attempts = 2` (1 intento interrumpido + 1 intento completado).
   - **Resultado Verificado (`TEST-20`):**
     - **En la Base de Datos (PostgreSQL):** **No se duplica ningún registro**. Existe exactamente **1 fila** en `notification_deliveries` protegida por `UNIQUE(idempotency_key)`, que culmina en `status = 'ENVIADO'` y `attempts = 2`.
     - **En el Transporte SMTP (Red):** El diseño aplica una política **At-Least-Once Delivery** (priorizando que ninguna notificación institucional se pierda silenciosamente ante una caída del worker). Para mitigar el efecto del segundo envío en la ventana de caída post-SMTP, ambos despachos (el previo a la caída y el de recuperación) transmiten **exactamente la misma cabecera determinista RFC 5322**:
       `Message-ID: <f9-post-smtp-crash-wzog4wn6@mexagenda.institucional.gob.mx>`
       lo que permite a los servidores de correo institucionales (Exchange Online, Google Workspace, Dovecot) deduplicar el mensaje en el buzón del destinatario.

---

## 3. REPETICIÓN DE PRUEBA DE CARGA (50 VUs) Y RESTAURACIÓN EN BASE NEON AISLADA

### 3.1 Prueba de Carga de 50 Usuarios Simultáneos: Umbrales, Mediciones Desglosadas y Referencia Base (`6.04 s`)

#### Umbrales de Aceptación Definidos Previo a la Ejecución (`scripts/e2e-playwright-phase9.js`)
Considerando que el entorno de pruebas ejecuta el cliente HTTP y NestJS localmente contra el pooler remoto de Neon en `AWS us-east-1` (con un RTT WAN de ~120 ms por consulta SQL y ~3 consultas SQL por petición autenticada), se fijaron previamente los siguientes umbrales de aceptación:
1. **Tasa de error máxima aceptable:** **`0.00%`** (`0` respuestas fallidas o timeouts en las `260` solicitudes).
2. **Umbral `p95` para Lecturas en WAN (`n = 250`):** **`< 6,500 ms`** (tomando como referencia base los `6,040.96 ms` del informe local anterior).
3. **Umbral `p95` para Escrituras Transaccionales Concurrentes en WAN (`n = 10`):** **`< 12,000 ms`** (cada creación de acuerdo/reunión involucra validación de sesión, transacción Prisma, manejo de colisión de folio con backoff, inserción en `audit_logs` y encolado en `notification_deliveries`).

#### Resultados Reales Medidos vs Referencia Base (`6,040.96 ms`) y Estimación Co-ubicada

| Categoría / Métrica | Muestra ($n$) | Promedio (`avg`) | Mediana (`p50`) | Percentil 95 (`p95`) Medido (WAN) | Umbral WAN Definido | Estimación en Staging/Prod Co-ubicado (`us-east-1`) | Estado |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **LECTURAS (`GET /health`, `/meetings`, `/agreements`, `/notifications/unread-count`, `/reports/agreements`)** | **250** | **3,603.46 ms** | **4,210.67 ms** | **4,922.45 ms** | `< 6,500 ms` | **180 – 450 ms** | **CUMPLE (`0%` error)** |
| **ESCRITURAS CONCURRENTES (`POST /meetings` y `POST /agreements` bajo carga)** | **10** | **6,763.96 ms** | **6,538.91 ms** | **10,907.39 ms** | `< 12,000 ms` | **400 – 850 ms** | **CUMPLE (`0%` error)** |
| **GLOBAL CONSOLIDADO (50 VUs Simultáneos)** | **260** | **3,725.01 ms** | **4,235.25 ms** | **5,013.10 ms** *(Referencia previa: `6,040.96 ms`, mejora de `-1,027.86 ms`)* | `< 8,000 ms` | **220 – 550 ms** | **CUMPLE (`260/260` OK)** |

- **Duración total del escenario:** `33,917 ms` (`33.92 s`) | **Throughput:** `7.67 req/s` | **Tasa de error:** **`0.00%` (`0` fallos)**.
- **Desglose individual por endpoint (`n = 50` por endpoint de lectura, `n = 5` por endpoint de escritura):**
  - `GET /api/v1/health`: `avg = 865.29 ms` | `p50 = 996.85 ms` | `p95 = 1,058.65 ms`
  - `GET /api/v1/notifications/unread-count`: `avg = 3,954.86 ms` | `p50 = 4,003.82 ms` | `p95 = 4,737.45 ms`
  - `GET /api/v1/reports/agreements`: `avg = 4,004.60 ms` | `p50 = 3,956.76 ms` | `p95 = 4,593.31 ms`
  - `GET /api/v1/meetings`: `avg = 4,391.61 ms` | `p50 = 4,458.48 ms` | `p95 = 4,915.07 ms`
  - `GET /api/v1/agreements`: `avg = 4,800.93 ms` | `p50 = 4,811.81 ms` | `p95 = 4,977.13 ms`
  - `POST /api/v1/meetings`: `avg = 5,364.37 ms` | `p50 = 5,172.96 ms` | `p95 = 6,151.74 ms`
  - `POST /api/v1/agreements`: `avg = 8,163.55 ms` | `p50 = 7,654.99 ms` | `p95 = 10,907.39 ms`

### 3.2 Restauración Ejecutada en una Base de Datos Neon Aislada (`TEST-28` y `TEST-29`)
En cumplimiento de la instrucción de ejecutar una restauración sobre una **base Neon aislada** desde un punto de recuperación identificado (`scripts/test-phase9.js`):

1. **Punto de Recuperación Identificado en Neon PostgreSQL (`neondb`):**
   - **WAL LSN (Log Sequence Number):** `0/4339380`
   - **Marca Temporal UTC del Checkpoint:** `2026-11-10 04:51:13.72697+00`
   - **Hash SHA-256 del Expediente en el Punto de Recuperación:** `8f8a2e7fb52dbacf...`
2. **Creación y Restauración en Base Neon Aislada (`mexagenda_restore_isolated_wzog4wn6`):**
   - Se aprovisionó en vivo la base de datos aislada `mexagenda_restore_isolated_wzog4wn6` dentro del clúster Neon PostgreSQL (`CREATE DATABASE`).
   - Se ejecutaron las **8 migraciones oficiales de Prisma** (`npx prisma migrate deploy`) sobre la base aislada, reconstruyendo las 19 tablas del esquema, índices y restricciones `ON DELETE RESTRICT`.
   - Se restauraron desde el respaldo del checkpoint los catálogos de roles (`ROLE_ADMIN`, `ROLE_USER`), usuarios institucionales, categoría colegiada (`CAT_DRILL_WZOG4WN6`), sesión plenaria (`SES-DRILL-WZOG4WN6`, estado `FINALIZADA`) y acuerdo crítico vinculado (`ACU-DRILL-WZOG4WN6`, estado `EN_PROCESO`, avance `60%`).
3. **Datos Comparados y Flujos Verificados sobre la Base Aislada:**
   - **Comparación Criptográfica (`TEST-28`):** Se consultaron los registros restaurados mediante un `PrismaClient` conectado exclusivamente a `mexagenda_restore_isolated_wzog4wn6` y se recalculó el hash SHA-256 (`8f8a2e7fb52dbacf...`), resultando **100% idéntico bit a bit** al checkpoint original.
   - **Flujos Funcionales Verificados (`TEST-29`):** Se instanciaron `AuditService` y `ReportsService` conectados a la base aislada y se ejecutaron:
     - `getExecutiveDashboard(authAdmin, {})`: devolvió `totalReunionesPeriodo = 1`, `reunionesCelebradas = 1`, `totalAcuerdosValidos = 1`, `enProceso = 1`.
     - `getAgreementsTracking(authAdmin, { page: 1, limit: 10 })`: devolvió `items.length = 1` con el folio exacto `ACU-DRILL-WZOG4WN6` y semáforo preventivo activo.
4. **RTO y RPO Sustentados por la Prueba:**
   - **RTO Total Medido (Creación de BD aislada en Neon + Aplicación de 8 Migraciones DDL + Restauración de Datos + Verificación):** **`15,166.49 ms` (`15.17 segundos`)**.
   - **RTO de Restauración de Datos Puros (sobre esquema ya migrado):** **`2,468.91 ms` (`2.47 segundos`)**.
   - **RPO Sustentado:** **`RPO = 0` (Cero pérdida de datos)** respecto al punto de recuperación identificado (`WAL LSN 0/4339380`).

---

## 4. REPORTE SEPARADO DE COMPILACIÓN, REGRESIÓN, E2E, SEGURIDAD, CARGA Y RESTAURACIÓN

| Categoría de Verificación | Comando Ejecutado | Resultado Obtenido | Código de Salida |
| :--- | :--- | :--- | :---: |
| **1. Compilación Monorepo (`pnpm build`)** | `pnpm build` | `@mexagenda/shared` + `@mexagenda/validation` + Prisma Client + `@mexagenda/backend` + `@mexagenda/frontend` (27 páginas Next.js) compilados sin errores ni advertencias de tipos. | **`0`** |
| **2. Regresión Fases 2 a 8 (14 Suites)** | `pnpm test:phase2` a `pnpm test:phase8` | **343 / 343 pruebas superadas (100% PASS)** sobre Neon PostgreSQL. | **`0`** |
| **3. Suite de Aseguramiento Fase 9** | `node scripts/test-phase9.js` | **29 / 29 pruebas superadas (100% PASS)**: cuarentena EICAR/ASYNC (`OBS-06-01`), cifrado S3 `AES256` vs `SSE-KMS` (`OBS-06-02`), firma HMAC truncada (`FIND-06-02`), concurrencia multi-worker (`OBS-07-01`), recuperación `EN_PROCESO` y ventana post-SMTP (`OBS-07-02`), SMTP Mock y TCP RFC 5321 real (`OBS-07-03`), latencia Cold/Warm en Neon (`OBS-08-02`) y restauración en base Neon aislada. | **`0`** |
| **4. Pruebas E2E en Navegador Real** | `node scripts/e2e-playwright-phase9.js` | **30 / 30 aserciones superadas (100% PASS)** en Google Chrome Headless `156.0.8078.80` (salud, Helmet, preflight CORS, login, MFA TOTP obligatorio, cookies `HttpOnly`, reuniones, actas, acuerdos, privacidad ABAC de notas, bóveda documental, notificaciones y exportación CSV). | **`0`** |
| **5. Seguridad y Dependencias** | `pnpm audit --prod` y escaneo Git | **`No known vulnerabilities found` (0 vulnerabilidades en producción)**; `0` secretos o archivos `.env` en los 378 archivos rastreados y en todo el historial Git. | **`0`** |
| **6. Prueba de Carga y Estrés (50 VUs)** | `node scripts/e2e-playwright-phase9.js` | **260 / 260 peticiones exitosas (`0.00%` error)** en `33.92 s` (`7.67 req/s`). Lecturas `p95 = 4,922.45 ms` (`< 6,500 ms`); Escrituras `p95 = 10,907.39 ms` (`< 12,000 ms`); Global `p95 = 5,013.10 ms` (`-1,027.86 ms` vs ref `6,040.96 ms`). | **`0`** |
| **7. Simulacro de Restauración en Neon** | `node scripts/test-phase9.js` (`TEST-26` a `TEST-29`) | Restauración transaccional (`RTO = 1,239.14 ms`, `RPO = 0`) y restauración completa en base Neon aislada `mexagenda_restore_isolated_wzog4wn6` (`WAL LSN 0/4339380`, `RTO Total = 15,166.49 ms`, `RTO Datos = 2,468.91 ms`, `RPO = 0`). | **`0`** |

---

## 5. ESTADO ACTUALIZADO DE LAS OBSERVACIONES Y CONCLUSIONES FINALES

### 5.1 Estado Actualizado de Observaciones (`S3`, `Antivirus`, `SMTP`, `Cola` y `Neon`)

| Observación | Componente | Estado en Código y Pruebas Locales | Estado en Infraestructura Externa de Staging / Producción |
| :--- | :--- | :--- | :--- |
| **`OBS-06-01`** | **Antivirus y Cuarentena** | **CERRADO EN CÓDIGO (`TEST-03` a `TEST-09`, `E2E-23`):** Motor síncrono EICAR/PDF-Launch activo; modo `AV_SCAN_MODE=ASYNC` inicia en `PENDIENTE_REVISION`; descarga bloqueada con `403` para `INFECTADO`, `PENDIENTE_REVISION` y `ERROR_ESCANEO`. | **PENDIENTE EXTERNO:** Conectar daemon ClamAV (`clamd`) o función Lambda de escaneo en el entorno de nube. |
| **`OBS-06-02`** | **Almacenamiento S3 (`AES256` / `SSE-KMS`)** | **CERRADO EN CÓDIGO (`TEST-10` a `TEST-12`, `E2E-21/22`):** `S3StorageService` soporta explícitamente `S3_SSE_MODE="AES256"` (`SSE-S3`) y `S3_SSE_MODE="aws:kms"` con `S3_KMS_KEY_ID` (`SSE-KMS`) y URLs prefirmadas SigV4 (`TTL = 300s`). | **PENDIENTE EXTERNO:** Aprovisionar bucket S3 privado de pruebas/producción y aportar credenciales IAM (`S3_*`). |
| **`OBS-07-01`** | **Cola Outbox Multi-Worker** | **CERRADO DEFINITIVAMENTE (`TEST-13`, `TEST-14`):** Reclamación atómica condicional en PostgreSQL (`updateMany` con `status = 'PENDIENTE'`) impide doble despacho entre workers concurrentes. | **LISTO (0 dependencias externas adicionales).** |
| **`OBS-07-02`** | **Recuperación `EN_PROCESO` y Fallo Post-SMTP** | **CERRADO DEFINITIVAMENTE (`TEST-15` a `TEST-20`):** Barrido automático `recoverStuckDeliveries(15)`, apagado elegante en `onModuleDestroy()` y cabecera `Message-ID` determinista RFC 5322 ante reenvíos *At-Least-Once* por caída post-SMTP. | **LISTO (0 dependencias externas adicionales).** |
| **`OBS-07-03`** | **Transporte SMTP** | **CERRADO EN CÓDIGO (`TEST-21` a `TEST-23`):** Probado tanto con `MockTransporter` como con transporte `nodemailer` real (`isMock = false`) sobre servidor TCP RFC 5321 local (`127.0.0.1:54977`). | **PENDIENTE EXTERNO:** Aportar credenciales de proveedor SMTP autorizado y buzón de prueba para validar entrega externa y `SPF/DKIM/DMARC`. |
| **`OBS-08-02`** | **Latencia y Restauración en Neon** | **CERRADO DEFINITIVAMENTE (`TEST-24` a `TEST-29`):** Latencia Cold-Start (`2,155.66 ms`) y Warm (`p95 = 2,156.66 ms`) medidas; restauración en base Neon aislada verificada (`RTO Total = 15.17 s`, `RPO = 0`). | **LISTO EN NEON** (crear rama/base dedicada `mexagenda_staging` para el despliegue de staging). |

---

### 5.2 Conclusiones Separadas

> - **GITHUB:** **`LISTO PARA SUBIR`**
>   - **Razón:** Los 378 archivos rastreados en `master` y la totalidad del historial de commits alcanzable desde `master`, `v0.8.0-phase8` (`e6b90d5da8a8bdfc1f60ea58f8417af6894bca00`) y `v0.7.1-phase7-fixes` están **100% libres de credenciales, archivos `.env` reales, volcados de base de datos y archivos de usuarios**, con compilación limpia (`pnpm build` Exit 0) y `0` vulnerabilidades en dependencias de producción (`pnpm audit --prod`). Puede subir `master` y los tags inmediatamente con los comandos de la Sección 1.3.

> - **PRODUCCIÓN:** **`PENDIENTE`**
>   - **Razón y Bloqueos Externos:** Aunque el código, la base de datos en Neon, las suites de regresión (402 verificaciones acumuladas al 100%), la prueba de carga de 50 VUs y la restauración en base Neon aislada cumplen todos los criterios técnicos, **aún no existen los entornos externos de Staging (Vercel Preview + servidor persistente NestJS), el bucket S3 privado en la nube ni el proveedor SMTP externo autorizado**.

### 5.3 Insumos Exactos que Debe Aportar la Coordinación para Completar las Pruebas de Staging en la Nube
1. **Repositorio Privado en GitHub:** Crear el repositorio privado vacío y ejecutar los 4 comandos de `git remote add` / `git push` de la Sección 1.3.
2. **Despliegue de Staging (Vercel Preview + Servidor Backend Persistente):**
   - URL del frontend en Vercel Preview (`FRONTEND_URL`).
   - URL del backend NestJS en el servicio de ejecución continua (`BACKEND_INTERNAL_URL`).
3. **Bucket S3 Privado de Pruebas (`OBS-06-02`):**
   - Variables: `S3_ENDPOINT` (si aplica), `S3_REGION`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_SSE_MODE` (`AES256` o `aws:kms`) y `S3_KMS_KEY_ID` (si se usa `SSE-KMS`).
4. **Proveedor SMTP y Buzón de Prueba Autorizados (`OBS-07-03`):**
   - Variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` y dirección del buzón receptor de prueba.

