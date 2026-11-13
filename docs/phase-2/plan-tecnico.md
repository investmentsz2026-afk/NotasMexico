# PLAN TÉCNICO DE FASE 2: AUTENTICACIÓN, SESIONES SEGURAS Y CONTROL DE ACCESO
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 2 — Autenticación y Control de Acceso (`MOD-01`)  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Planificado / Preparado para Implementación  

---

## 1. OBJETIVO GENERAL DE LA FASE 2

Construir la capa de seguridad, identidad, autenticación multifactor y control de acceso granular de **MexAgenda**, garantizando el principio de **confidencialidad absoluta, trazabilidad forense y prevención de intrusiones**.

> [!IMPORTANT]
> **Delimitación de Alcance:** La Fase 2 se enfoca exclusivamente en la autenticación, gestión de sesiones, seguridad de contraseñas, segundo factor MFA TOTP y guardias de autorización RBAC/ABAC. No se implementarán reuniones, anotaciones, documentos ni dashboard definitivo, los cuales corresponden a fases posteriores.

---

## 2. ARQUITECTURA DE AUTENTICACIÓN Y AUTORIZACIÓN

```
[Navegador del Usuario]
           │
           │ (1) POST /api/v1/auth/login { email, password }
           ▼
[NestJS AuthController]
           │
           │ (2) Valida formato con ValidationPipe
           ▼
[NestJS AuthService] ──> Consulta usuario en Neon PostgreSQL (`users`)
           │             Verifica Argon2id.verify(passwordHash, password)
           │
           ├─► Si falla: Incrementa `login_attempts` y registra `LOGIN_FAILED`.
           │             Si alcanza 5 fallos en 15 min: Bloquea cuenta temporalmente.
           │
           └─► Si es exitoso:
                 │
                 ├─► ¿MFA Habilitado / Requerido?
                 │     │
                 │     ├─► SÍ: Emite token temporal efímero (TTL: 5 min)
                 │     │       Frontend despliega pantalla de desafío TOTP (RFC 6238).
                 │     │       POST /api/v1/auth/mfa/verify { mfaToken, totpCode }
                 │     │       Desencripta secreto con AES-256-GCM y valida código.
                 │     │
                 │     └─► NO / Completado:
                 │           Genera identificador criptográfico de sesión (SHA-256 hash).
                 │           Inserta registro en `user_sessions` en Neon PostgreSQL.
                 │           Emite Cookie: `__Host-mexagenda_session` (HttpOnly, Secure, SameSite=Strict).
                 │           Registra evento `LOGIN_SUCCESS` en `audit_logs`.
                 ▼
[Sesión Activa Persistida en Neon]
```

---

## 3. ESPECIFICACIÓN DETALLADA DE COMPONENTES DE SEGURIDAD

### 3.1. Autenticación y Protección de Identidad
- **Sin Registro Público:** Los usuarios son creados exclusivamente por el Administrador. No existen rutas ni enlaces de autorregistro en el frontend.
- **Mensajes Genéricos contra Enumeración de Usuarios:** Ante fallos de credenciales o usuarios inexistentes, el sistema responderá siempre de manera uniforme:  
  `"Credenciales no válidas o cuenta no disponible"`, con código HTTP 401 Unauthorized.
- **Protección contra Fuerza Bruta:**
  - Registro de cada intento en la tabla `login_attempts` (`email`, `ip_address`, `success`, `failure_reason`).
  - Bloqueo temporal automático de **20 minutos** tras 5 fallos consecutivos en una ventana de 15 minutos.
  - Rate limiting a nivel de API (máximo 5 intentos por minuto por dirección IP).

### 3.2. Criptografía de Contraseñas (Argon2id)
- Implementación mediante `@node-rs/argon2` (Rust bindings de alto rendimiento).
- Parámetros conformes a **RFC 9106 / OWASP Password Storage Cheat Sheet**:
  - `memoryCost`: 65536 KiB (64 MB).
  - `timeCost`: 3 iteraciones.
  - `parallelism`: 4 hilos.
  - `salt`: 16 bytes criptográficamente seguros generados aleatoriamente por `crypto.randomBytes()`.
- Prohibición absoluta de almacenar o transmitir contraseñas en texto plano.

### 3.3. Segundo Factor de Autenticación (MFA / TOTP)
- **Estándar:** TOTP conforme a **RFC 6238** (Periodo: 30 segundos, Ventana de tolerancia: ±1 intervalo, Longitud: 6 dígitos numéricos).
- **Obligatoriedad:** Obligatorio para el rol `ROLE_ADMIN`; configurable para usuarios institucionales.
- **Cifrado del Secreto TOTP:** El secreto base32 se almacena en la tabla `user_mfa` cifrado en reposo mediante **AES-256-GCM** utilizando un vector de inicialización (IV) de 12 bytes y etiqueta de autenticación (*Auth Tag*).
- **Códigos de Respaldo (*Backup Codes*):** 8 códigos alfanuméricos de un solo uso generados al enrolar, almacenados como hashes criptográficos con salt individual.
- **Protección contra Replay:** Cada código TOTP validado registra su marca de tiempo para impedir la reutilización dentro del mismo intervalo de 30 segundos.

### 3.4. Gestión y Persistencia de Sesiones
- **Cookie Blindada:**
  - Nombre: `__Host-mexagenda_session` (el prefijo `__Host-` garantiza que no pueda ser sobreescrita por subdominios y solo viaje por HTTPS).
  - `HttpOnly: true` (inaccesible desde JavaScript en el navegador, mitigando robo por XSS).
  - `Secure: true` (forzado en producción por canal TLS 1.3).
  - `SameSite: 'strict'` (neutraliza ataques CSRF).
  - `Path: '/'`.
  - **Prohibición:** Prohibido almacenar tokens o IDs de sesión en `localStorage` o `sessionStorage`.
- **Persistencia en Base de Datos (`user_sessions`):**
  - Cada sesión guarda: `id`, `user_id`, `session_token_hash` (SHA-256 del token entregado al cliente), `ip_address`, `user_agent`, `is_revoked`, `last_activity_at`, `expires_at`.
  - **Inactividad:** Caduca tras 30 minutos sin solicitudes authenticated.
  - **Vida Máxima:** 8 horas continuas.
  - **Revocación Instantánea:** Si el administrador suspende una cuenta (`status = 'INACTIVO'`) o el usuario hace logout, se ejecuta `UPDATE user_sessions SET is_revoked = true`, revocando el acceso en la siguiente petición HTTP.

### 3.5. Autorización Granular en Backend (RBAC / ABAC)
- Ninguna verificación de permisos depende de la visibilidad de componentes en el frontend.
- Jerarquía de guardias en NestJS:
  1. `SessionAuthGuard`: Extrae cookie, busca sesión activa en `user_sessions` de Neon, verifica que el usuario esté `ACTIVO`.
  2. `RolesGuard`: Comprueba que el usuario posea el rol mínimo requerido (`@Roles('ROLE_ADMIN')`).
  3. `PermissionsGuard`: Valida privilegios a nivel de recurso (`@RequirePermission('user:create')`).
  4. `OwnershipGuard` (ABAC): Valida que las operaciones sobre recursos propios coincidan con `session.user_id` (sentando la base para la soberanía de notas en Fase 5).

### 3.6. Bitácora de Auditoría Forense (`MOD-09` en Auth)
- Eventos registrados de forma síncrona en `audit_logs`:
  - `LOGIN_SUCCESS`, `LOGIN_FAILED`, `MFA_CHALLENGE_FAILED`, `ACCOUNT_TEMPORARY_LOCK`, `LOGOUT`, `LOGOUT_ALL_SESSIONS`, `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED`.
- **Filtro de Cero Secretos (*Zero Secrets Sanitizer*):** El interceptor elimina y sustituye por `[REDACTADO_POR_SEGURIDAD]` cualquier campo denominado `password`, `token`, `secret`, `totp`, `backup_codes`.

---

## 4. ENDPOINTS REST DE LA FASE 2 (`/api/v1/auth`)

| Método | Ruta | Descripción | Acceso |
|---|---|---|:---:|
| `POST` | `/api/v1/auth/login` | Inicio de sesión primario con correo y contraseña | Público (Rate limited) |
| `POST` | `/api/v1/auth/mfa/verify` | Verificación de código TOTP de 6 dígitos o código de respaldo | Público (con mfaToken) |
| `POST` | `/api/v1/auth/mfa/enroll` | Generación de Secreto TOTP y Código QR (Primer ingreso) | Sesión requerida |
| `POST` | `/api/v1/auth/mfa/confirm` | Confirmación de sincronización de TOTP para activar MFA | Sesión requerida |
| `GET`  | `/api/v1/auth/me` | Retorna los datos del perfil y roles de la sesión activa | Sesión requerida |
| `POST` | `/api/v1/auth/logout` | Revoca la sesión actual y limpia la cookie | Sesión requerida |
| `POST` | `/api/v1/auth/logout-all` | Revoca todas las sesiones activas del usuario | Sesión requerida |
| `POST` | `/api/v1/auth/change-password` | Cambio voluntario de contraseña por el usuario activo | Sesión requerida |
| `POST` | `/api/v1/auth/admin-reset` | Restablecimiento administrativo de credenciales | Solo `ROLE_ADMIN` |

---

## 5. MATRIZ DE PRUEBAS OBLIGATORIAS DE FASE 2 (17 CASOS)

```
+-----------------------------------------------------------------------------------+
|               MATRIZ DE CASOS DE PRUEBA OBLIGATORIOS (FASE 2)                     |
+--------+--------------------------------------------------+-----------------------+
| ID     | Descripción del Escenario de Prueba              | Criterio de Éxito     |
+--------+--------------------------------------------------+-----------------------+
| TC-001 | Usuario válido puede iniciar sesión              | HTTP 200 / Cookie OK  |
| TC-002 | Contraseña incorrecta no permite acceso          | HTTP 401 Genérico     |
| TC-003 | Usuario desactivado (INACTIVO) no puede login    | HTTP 401 Genérico     |
| TC-004 | Usuario sin MFA completado no accede a API       | HTTP 403 Forbidden    |
| TC-005 | Administrador está forzado a completar MFA       | Desafío TOTP emitido  |
| TC-006 | Usuario puede cerrar su sesión voluntariamente   | Cookie destruida / 200|
| TC-007 | Sesión revocada deja de ser válida de inmediato  | HTTP 401 en siguiente |
| TC-008 | Sesión expirada (> 30 min inactividad) es nula   | HTTP 401 en siguiente |
| TC-009 | Reutilización de token de sesión revocado falla  | HTTP 401 Unauthorized |
| TC-010 | Usuario normal no puede crear ni editar usuarios | HTTP 403 Forbidden    |
| TC-011 | Usuario normal no puede modificar roles          | HTTP 403 Forbidden    |
| TC-012 | Manipulación de ID ajeno no permite acceso (BOLA)| HTTP 403 Forbidden    |
| TC-013 | Intentos de autenticación se registran en BD     | Registro en audit_logs|
| TC-014 | Logs de auditoría no contienen secretos          | [REDACTADO] verificado|
| TC-015 | Endpoints protegidos rechazan sin autenticación  | HTTP 401 Unauthorized |
| TC-016 | Cookies presentan HttpOnly, Secure, SameSite=Str | Atributos validados   |
| TC-017 | Autenticación opera contra PostgreSQL de Neon    | Consultas Neon reales |
+--------+--------------------------------------------------+-----------------------+
```

---

## 6. DEPENDENCIAS TÉCNICAS A INSTALAR EN FASE 2

Para implementar la Fase 2 sin introducir microservicios ni dependencias innecesarias:
- `@node-rs/argon2`: Motor nativo en Rust para hash Argon2id seguro.
- `otplib`: Motor de generación y verificación de contraseñas TOTP bajo RFC 6238.
- `qrcode`: Generación segura de imágenes SVG o Data URLs para el código QR de enrolamiento.
- `cookie-parser` y `@types/cookie-parser`: Manejo de cookies firmadas y `HttpOnly` en Express/NestJS.

