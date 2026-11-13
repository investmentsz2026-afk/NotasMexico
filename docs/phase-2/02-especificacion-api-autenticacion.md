# DOCUMENTO 02: ESPECIFICACIÓN TÉCNICA DE LA API REST DE AUTENTICACIÓN
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 2 — Autenticación, Sesiones Seguras y Control de Acceso (`MOD-01`)  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Prefijo Global:** `/api/v1/auth`  

---

## 1. RESUMEN DE ENDPOINTS

```
+--------+------------------------------------+-----------------------------------------------+---------------------+
| MÉTODO | RUTA                               | DESCRIPCIÓN                                   | SEGURIDAD / ACCESO  |
+--------+------------------------------------+-----------------------------------------------+---------------------+
| `POST` | `/api/v1/auth/login`               | Inicio de sesión primario con email/password  | Público (Rate limit)|
| `POST` | `/api/v1/auth/mfa/verify`          | Verificación de código TOTP o código respaldo | Token efímero MFA   |
| `POST` | `/api/v1/auth/mfa/enroll`          | Inicia enrolamiento y entrega código QR       | Sesión requerida    |
| `POST` | `/api/v1/auth/mfa/confirm`         | Confirma TOTP y entrega 8 códigos de respaldo | Sesión requerida    |
| `GET`  | `/api/v1/auth/me`                  | Datos de perfil y permisos del usuario activo | Sesión requerida    |
| `POST` | `/api/v1/auth/logout`              | Cierre voluntario de la sesión actual         | Sesión requerida    |
| `POST` | `/api/v1/auth/logout-all`          | Revocación masiva de todas las sesiones       | Sesión requerida    |
| `GET`  | `/api/v1/auth/sessions`            | Listado de sesiones activas del usuario       | Sesión requerida    |
| `DELETE`| `/api/v1/auth/sessions/:sessionId`| Revocación de una sesión específica           | Sesión requerida    |
| `POST` | `/api/v1/auth/change-password`     | Cambio voluntario de contraseña del usuario   | Sesión requerida    |
| `POST` | `/api/v1/auth/password-reset/req`  | Solicitud de restablecimiento (envío token)   | Público             |
| `POST` | `/api/v1/auth/password-reset/conf` | Confirmación de restablecimiento con token    | Público             |
| `POST` | `/api/v1/auth/admin-reset`         | Restablecimiento administrativo forzado       | Solo `ROLE_ADMIN`   |
+--------+------------------------------------+-----------------------------------------------+---------------------+
```

---

## 2. DETALLE DE ENDPOINTS

### 2.1. `POST /api/v1/auth/login`
- **Propósito:** Autentica credenciales institucionales y evalúa necesidad de segundo factor.
- **Cuerpo de Solicitud:**
  ```json
  {
    "email": "admin@institucion.gob.mx",
    "password": "MiContraseñaSegura#2026"
  }
  ```
- **Respuesta Exitosa (Requiere MFA):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "mfaRequired": true,
      "mfaToken": "eyJhbGciOiJIUzI1NiJ9....signature",
      "message": "Ingrese el código de su aplicación de autenticación."
    },
    "timestamp": "2026-11-05T04:15:00.000Z"
  }
  ```
- **Respuesta Exitosa (Sin MFA o Usuario Estándar):**
  Emite cabecera `Set-Cookie: __Host-mexagenda_session=...; HttpOnly; Secure; SameSite=Strict; Path=/`
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "mfaRequired": false,
      "user": {
        "id": "f1bce79d-2456-41cd-8d03-24273322feb0",
        "email": "usuario@institucion.gob.mx",
        "firstName": "Usuario",
        "lastName": "Institucional",
        "position": "Consejero Titular",
        "role": "ROLE_USER",
        "status": "ACTIVO",
        "mfaEnabled": false,
        "permissions": ["meeting:read", "agreement:read", "attachment:read"]
      }
    },
    "timestamp": "2026-11-05T04:15:00.000Z"
  }
  ```
- **Error (401 Unauthorized Genérico):**
  ```json
  {
    "type": "https://mexagenda.org/errors/401",
    "title": "Unauthorized",
    "status": 401,
    "detail": "Credenciales no válidas o cuenta no disponible.",
    "instance": "/api/v1/auth/login",
    "timestamp": "2026-11-05T04:15:00.000Z"
  }
  ```

---

### 2.2. `POST /api/v1/auth/mfa/verify`
- **Propósito:** Valida el código TOTP o el código de respaldo entregado frente a un token efímero emitido en el login.
- **Cuerpo de Solicitud:**
  ```json
  {
    "mfaToken": "token_efimero_emitido_en_login",
    "code": "489673"
  }
  ```
- **Respuesta Exitosa (200 OK):**
  Emite cookie de sesión `__Host-mexagenda_session` y devuelve el objeto `AuthUser`.

---

### 2.3. `POST /api/v1/auth/mfa/enroll`
- **Acceso:** Sesión requerida.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "secret": "JDDEWXIESLTM43IFL37XOUUETTDKJKZF",
      "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgo...",
      "uri": "otpauth://totp/MexAgenda:admin%40institucion.gob.mx?secret=JDDEWXIESLTM43IFL37XOUUETTDKJKZF&issuer=MexAgenda"
    },
    "timestamp": "2026-11-05T04:15:00.000Z"
  }
  ```

---

### 2.4. `POST /api/v1/auth/mfa/confirm`
- **Acceso:** Sesión requerida.
- **Cuerpo de Solicitud:**
  ```json
  {
    "code": "123456"
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "success": true,
      "message": "Segundo factor de autenticación configurado exitosamente.",
      "backupCodes": [
        "A3K9-8F2Q",
        "W7M4-L9P1",
        "R2T8-V5C3",
        "H6B1-D4X9",
        "J9E5-N2Z8",
        "K4P7-S1M6",
        "F8Y3-W9T2",
        "C5L1-Q7R4"
      ]
    },
    "timestamp": "2026-11-05T04:15:00.000Z"
  }
  ```

---

### 2.5. `GET /api/v1/auth/sessions`
- **Acceso:** Sesión requerida.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": [
      {
        "id": "e0b9685a-fb48-4cb9-b3a6-b09cf93c0bc5",
        "ipAddress": "189.204.12.44",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
        "isRevoked": false,
        "lastActivityAt": "2026-11-05T04:14:00.000Z",
        "expiresAt": "2026-11-05T12:00:00.000Z",
        "createdAt": "2026-11-05T04:00:00.000Z",
        "isCurrent": true
      }
    ],
    "timestamp": "2026-11-05T04:15:00.000Z"
  }
  ```

