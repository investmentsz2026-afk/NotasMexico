# DOCUMENTO 01: ARQUITECTURA DE AUTENTICACIÓN, SESIONES Y CRIPTOGRAFÍA
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 2 — Autenticación, Sesiones Seguras y Control de Acceso (`MOD-01`)  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Implementado y Verificado en Neon PostgreSQL  

---

## 1. INTRODUCCIÓN Y PRINCIPIOS DE DISEÑO

El subsistema de identidad y seguridad de **MexAgenda** fue concebido bajo el principio de **Confidencialidad Absoluta y Privacidad Institucional**. Al tratarse de una plataforma privada para consejeros y directivos de un órgano institucional mexicano:

1. **Inexistencia de Autorregistro Público:** No existen rutas, endpoints ni formularios de registro autónomo. Los usuarios son provisionados exclusivamente por la autoridad institucional administrativa.
2. **Protección Anti-Enumeración:** Los errores de autenticación o bloqueo retornan siempre un mensaje uniforme y genérico:
   ```json
   {
     "type": "https://mexagenda.org/errors/401",
     "title": "Unauthorized",
     "status": 401,
     "detail": "Credenciales no válidas o cuenta no disponible.",
     "instance": "/api/v1/auth/login"
   }
   ```
   Esto imposibilita a atacantes determinar si un correo institucional existe o si una cuenta está activa/inactiva.
3. **Cero Tokens en Almacenamiento Web (No LocalStorage/SessionStorage):** Los tokens de sesión nunca son almacenados en `localStorage` ni `sessionStorage` para evitar el robo de credenciales mediante ataques Cross-Site Scripting (XSS).

---

## 2. ESPECIFICACIÓN CRIPTOGRÁFICA DE CONTRASEÑAS (ARGON2ID)

Conforme a las recomendaciones de **RFC 9106** y la guía oficial **OWASP Password Storage Cheat Sheet**, el hashing de contraseñas se ejecuta con **Argon2id**:

- **Parámetros Criptográficos:**
  - `memoryCost`: 65,536 KiB (64 MiB de memoria por derivación).
  - `timeCost`: 3 iteraciones secuenciales.
  - `parallelism`: 4 hilos de ejecución concurrentes.
  - `outputLen`: 32 bytes (256 bits).
  - `salt`: 16 bytes generados criptográficamente de manera independiente para cada hash.
- **Implementación:** Módulo nativo compilado en Rust (`@node-rs/argon2`), optimizado para alto rendimiento y resistencia física frente a clústeres de computación paralela basada en GPUs/ASICs.
- **Política Institucional de Contraseñas:**
  - Longitud mínima: 12 caracteres (máximo 128).
  - Al menos 1 letra mayúscula (`A-Z`).
  - Al menos 1 letra minúscula (`a-z`).
  - Al menos 1 dígito numérico (`0-9`).
  - Al menos 1 carácter especial (`!@#$%^&*()_+-=[]{}|;:,.<>?`).

---

## 3. SEGUNDO FACTOR DE AUTENTICACIÓN (MFA / TOTP)

El segundo factor se rige por el estándar **RFC 6238 (Time-Based One-Time Password Algorithm)**:

```
[Usuario Solicita Enrolamiento]
            │
            ▼
[Generación de Secreto Base32] (20 bytes criptográficos)
            │
            ├─► Cifrado Simétrico AES-256-GCM ──► Almacenamiento en `user_mfa` (Neon)
            │
            └─► Generación de URI y Código QR ──► Escaneo en App Móvil
```

### 3.1. Cifrado de Secretos en Reposo (AES-256-GCM)
Para prevenir el compromiso de los secretos TOTP ante copias de seguridad o volcados de base de datos no autorizados:
- El secreto base32 se cifra con **AES-256-GCM** antes de guardarse en la columna `encrypted_secret` de `user_mfa`.
- **Clave Simétrica:** Clave de 256 bits derivada de la variable de entorno protegida `MFA_ENCRYPTION_KEY`.
- **Vector de Inicialización (IV):** 12 bytes aleatorios generados de forma independiente por cada operación de cifrado.
- **Etiqueta de Autenticación (Auth Tag):** 16 bytes (128 bits) que validan la integridad y autenticidad del texto cifrado, impidiendo manipulaciones maliciosas de bits en reposo.
- **Estructura Serializada:** `v1:${ivHex}:${authTagHex}:${ciphertextHex}`.

### 3.2. Códigos de Respaldo de Emergencia (8 Códigos)
- Al confirmarse el enrolamiento, el sistema genera exactamente **8 códigos de un solo uso** con formato legible `XXXX-XXXX` (alfanumérico en base32 segura, sin caracteres confusos como 0, O, 1 o I).
- En la base de datos se almacena únicamente el hash **SHA-256** de cada código.
- Cada código utilizado es eliminado inmediatamente de la lista JSON persistida en Neon (*Single-Use Consumption*).

### 3.3. Prevención de Replay Attacks
- Se registra la marca de tiempo `last_used_at` en `user_mfa`.
- Si se detecta un intento de ingreso con el mismo código dentro del intervalo temporal de 30 segundos, el sistema rechaza la solicitud y alerta un intento de repetición.

---

## 4. GESTIÓN Y PERSISTENCIA DE SESIONES EN NEON POSTGRESQL

A diferencia de los esquemas tradicionales con JWT apátridas (que no pueden ser revocados de inmediato si una credencial se compromete), MexAgenda utiliza **Sesiones Persistidas con Tokens Opacos**:

```
+---------------------------------------------------------------------------------+
|                       ESTRUCTURA DE SESIÓN EN NEON                             |
+-------------------+-------------------------------------------------------------+
| Columna           | Propósito y Especificación Técnica                         |
+-------------------+-------------------------------------------------------------+
| `id`              | Identificador UUID v4 de la sesión en base de datos         |
| `user_id`         | Referencia al usuario institucional (`users.id`)            |
| `session_token_hash`| Hash SHA-256 del token entregado a la cookie del cliente  |
| `ip_address`      | Dirección IP pública/local desde la que se originó          |
| `user_agent`      | Identificador del cliente HTTP o navegador (máx 300 chars)  |
| `is_revoked`      | Indicador booleano de revocación forzada                    |
| `last_activity_at`| Marca de tiempo de última solicitud (actualizada cada 60s)  |
| `expires_at`      | Límite absoluto de vida de la sesión (máximo 8 horas)       |
| `created_at`      | Fecha y hora exacta de creación                             |
+-------------------+-------------------------------------------------------------+
```

### 4.1. Ciclo de Vida y Reglas de Expiración
1. **Generación Criptográfica:** El token de sesión es generado mediante `crypto.randomBytes(32)` (256 bits de entropía). Al cliente se le entrega la versión hexadecimal de 64 caracteres; a la base de datos se guarda únicamente su hash SHA-256.
2. **Tiempo Máximo de Inactividad:** **30 minutos**. Si la diferencia entre la hora actual y `last_activity_at` supera los 30 minutos, la sesión es invalidada automáticamente (`is_revoked = true`).
3. **Vida Absoluta Máxima:** **8 horas**. Ninguna sesión puede extenderse más allá de 8 horas continuas desde su creación original.
4. **Actualización Amortiguada de Actividad:** Para evitar una sobrecarga de escrituras transaccionales sobre Neon PostgreSQL en peticiones concurrentes continuas, `last_activity_at` solo se actualiza si han transcurrido más de **60 segundos** desde la última marca registrada.
5. **Revocación Instantánea:** Si el usuario hace logout, si un administrador desactiva su cuenta (`status != 'ACTIVO'`), o si se cambia la contraseña, la base de datos actualiza `is_revoked = true`, revocando inmediatamente el acceso en la petición HTTP subsiguiente.

---

## 5. DIRECTIVAS DE COOKIES SEGURAS

El backend transmite el identificador de sesión a través del encabezado HTTP `Set-Cookie` con directivas blindadas:

- **Nombre en Producción:** `__Host-mexagenda_session`  
  *(El prefijo `__Host-` está normado por el estándar IETF RFC 6265bis: exige canal seguro TLS, prohíbe el atributo `Domain` y restringe la ruta a `Path=/`, previniendo inyecciones de cookies desde subdominios).*
- **`HttpOnly: true`:** Impide que cualquier script JavaScript ejecutado en el contexto del navegador (por ejemplo ante una vulnerabilidad XSS) pueda leer o clonar la cookie.
- **`Secure: true`:** Obliga a que la cookie solo viaje por conexiones cifradas HTTPS/TLS 1.3.
- **`SameSite: Strict`:** Neutraliza de forma absoluta los ataques de Falsificación de Peticiones en Sitios Cruzados (CSRF), ya que el navegador no adjuntará la cookie en solicitudes iniciadas desde sitios web externos.
- **`Path: '/'`:** Alcance limitado a la raíz institucional.
- **`Max-Age: 28800`:** 8 horas de vigencia máxima sincronizada con la base de datos.

