# DOCUMENTO 04: MATRIZ DE PRUEBAS DE FASE 2 Y EVIDENCIAS EN NEON
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 2 — Autenticación, Sesiones Seguras y Control de Acceso (`MOD-01`)  
**Versión:** 1.0.0  
**Fecha de Ejecución:** Noviembre 2026  
**Resultado Global:** 17 de 17 Pruebas Aprobadas (100% PASS)  
**Base de Datos Oficial:** Neon PostgreSQL (`ep-plain-hill-benz8lhm-pooler.c-9.us-east-2.aws.neon.tech`)  

---

## 1. MATRIZ CONSOLIDADA DE PRUEBAS OBLIGATORIAS (TC-001 a TC-017)

```
+--------+-------------------------------------------------------------+-------------------------------+-----------+
| ID     | ESCENARIO DE PRUEBA EVALUADO                                | CRITERIO DE VERIFICACIÓN      | RESULTADO |
+--------+-------------------------------------------------------------+-------------------------------+-----------+
| TC-001 | Usuario institucional válido inicia sesión exitosamente     | HTTP 200, Token de 256 bits   |  ✓ PASS   |
| TC-002 | Contraseña incorrecta rechazada con mensaje genérico        | HTTP 401 Anti-enumeración     |  ✓ PASS   |
| TC-003 | Usuario institucional desactivado (INACTIVO) es rechazado   | HTTP 401 Mensaje genérico     |  ✓ PASS   |
| TC-004 | Bloqueo por fuerza bruta tras 5 intentos fallidos           | Lockout 20 min en 5to intento |  ✓ PASS   |
| TC-005 | Administrador institucional forzado a completar MFA         | Desafío TOTP emitido (TTL 5m) |  ✓ PASS   |
| TC-006 | Enrolamiento MFA genera secreto AES-256-GCM y 8 códigos     | Cifrado verificado en Neon    |  ✓ PASS   |
| TC-007 | Verificación de código TOTP con protección anti-replay      | Replay rechazado en ventana   |  ✓ PASS   |
| TC-008 | Código de respaldo consumido de un solo uso                 | Invalida código usado (8->7)  |  ✓ PASS   |
| TC-009 | Sesión activa es validada directamente desde Neon           | Consulta hash SHA-256 en BD   |  ✓ PASS   |
| TC-010 | Sesión revocada voluntariamente rechaza nuevas peticiones   | HTTP 401 en siguiente llamada |  ✓ PASS   |
| TC-011 | Sesión expirada por inactividad (>30 min) es invalidada     | Marcado is_revoked = true     |  ✓ PASS   |
| TC-012 | Cambio de contraseña valida política RFC 9106 y revoca      | Valida reglas y limpia sesión |  ✓ PASS   |
| TC-013 | Restablecimiento de contraseña por token único              | Consumo único de token        |  ✓ PASS   |
| TC-014 | Bitácora en audit_logs sanitiza contraseñas y secretos     | [REDACTADO_POR_SEGURIDAD]     |  ✓ PASS   |
| TC-015 | Catálogo RBAC asignado correctamente en Neon               | 15 ROLE_ADMIN / 3 ROLE_USER   |  ✓ PASS   |
| TC-016 | Validación de cookies seguras (__Host- en producción)      | HttpOnly; Secure; Strict      |  ✓ PASS   |
| TC-017 | Integración transaccional con Neon PostgreSQL demostrada    | Consultas y conteos en vivo   |  ✓ PASS   |
+--------+-------------------------------------------------------------+-------------------------------+-----------+
```

---

## 2. EVIDENCIA DE EJECUCIÓN DIRECTA DEL SUITE DE PRUEBAS

A continuación se transcribe la salida real y reproducible del script de pruebas ejecutado mediante `node scripts/test-phase2.js` contra la base de datos de Neon:

```
================================================================
  EJECUCIÓN DE PRUEBAS DE FASE 2 — MEXAGENDA (NEON POSTGRESQL)  
================================================================

Ejecutando [TC-001] Usuario institucional válido inicia sesión exitosamente... ✓ PASS
Ejecutando [TC-002] Contraseña incorrecta es rechazada con mensaje genérico... ✓ PASS
Ejecutando [TC-003] Usuario con estatus INACTIVO es rechazado... ✓ PASS
Ejecutando [TC-004] Protección contra fuerza bruta se activa tras 5 intentos fallidos... 
[AuthService] WARN: Bloqueo temporal por fuerza bruta activado para correo [brute.1793852106461@institucion.gob.mx] o IP [192.168.1.100]
✓ PASS
Ejecutando [TC-005] Administrador institucional está forzado a completar MFA... ✓ PASS
Ejecutando [TC-006] Enrolamiento MFA genera secreto AES-256-GCM, QR y 8 códigos de respaldo... ✓ PASS
Ejecutando [TC-007] Verificación de TOTP y protección contra Replay Attack... 
[MfaService] WARN: Detección de intento de Replay Attack en TOTP para usuario f640f343-65b9-400c-8133-6a6101987201
✓ PASS
Ejecutando [TC-008] Código de respaldo funciona y se invalida tras su consumo único... ✓ PASS
Ejecutando [TC-009] Sesión activa es validada desde Neon PostgreSQL... ✓ PASS
Ejecutando [TC-010] Sesión revocada voluntariamente rechaza peticiones subsiguientes... ✓ PASS
Ejecutando [TC-011] Sesión con inactividad superior a 30 minutos se invalida... ✓ PASS
Ejecutando [TC-012] Cambio de contraseña aplica validación RFC 9106 y revoca sesiones activas... ✓ PASS
Ejecutando [TC-013] Restablecimiento de contraseña por token con SHA-256 e invalidación única... ✓ PASS
Ejecutando [TC-014] Bitácora forense en audit_logs sanitiza contraseñas y secretos ([REDACTADO])... ✓ PASS
Ejecutando [TC-015] Catálogo de permisos RBAC asignado correctamente en Neon... ✓ PASS
Ejecutando [TC-016] Validación de nombres de cookies seguras (__Host- en producción)... ✓ PASS
Ejecutando [TC-017] Integración y consistencia transaccional con Neon PostgreSQL demostrada... 
  [Evidencia Neon en Vivo: Users=2, Sessions=2, AuditLogs=13]
✓ PASS

================================================================
              RESUMEN DE PRUEBAS DE FASE 2                      
================================================================
Total de pruebas: 17
Aprobadas:        17
Fallidas:         0
================================================================
```

---

## 3. AUDITORÍA FORENSE DE LA TABLA `audit_logs` EN NEON POSTGRESQL

Se comprobó que ninguna columna `diff_payload` ni registro de auditoría almacena credenciales en texto plano:
- Todo intento de inyectar campos como `password`, `totpSecret` o `sessionToken` es transformado automáticamente a `"[REDACTADO_POR_SEGURIDAD]"`.
- Las acciones `LOGIN_SUCCESS`, `LOGIN_FAILED`, `MFA_CHALLENGE_FAILED`, `ACCOUNT_TEMPORARY_LOCK`, `LOGOUT`, `PASSWORD_CHANGED` y `PASSWORD_RESET_COMPLETED` se registran con sus respectivas direcciones IP y User Agents.

