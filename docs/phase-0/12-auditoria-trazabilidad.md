# DOCUMENTO 12: AUDITORÍA FORENSE, TRAZABILIDAD E INMUTABILIDAD
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. INTRODUCCIÓN Y PRINCIPIOS DE AUDITORÍA

La auditoría en **MexAgenda** no es un componente periférico de registro de logs de depuración, sino un **pilar de gobernanza legal y forense institucional**. Su objetivo es registrar con certeza inmutable la autoría, momento exacto, contexto técnico y resultado de cada acción ejecutada en la plataforma.

### Principios Rectores:
1. **Append-Only Estricto:** La bitácora solo admite inserciones (`INSERT`). Las modificaciones (`UPDATE`) y eliminaciones (`DELETE`) están físicamente revocadas en la base de datos.
2. **Cero Secretos en Registros (*Zero-Knowledge Audit*):** El interceptor de auditoría filtra y enmascara de manera ineludible contraseñas, secretos TOTP, tokens de sesión y llaves criptográficas antes de persistir cualquier registro.
3. **No Repudio:** Todo cambio a un acuerdo, reunión o anotación queda indisolublemente vinculado al actor autenticado mediante su identificador de sesión y credenciales.
4. **Visibilidad Asimétrica:** La bitácora es consultable de forma exclusiva por el Administrador Institucional (`ROLE_ADMIN`); los usuarios normales carecen de acceso a esta interfaz para proteger la intimidad operativa de la administración.

---

## 2. CATÁLOGO MAESTRO DE EVENTOS AUDITADOS

| Código del Evento | Severidad | Módulo | Descripción |
|---|:---:|---|---|
| `LOGIN_SUCCESS` | INFO | Autenticación | Inicio de sesión exitoso con contraseña y MFA validado. |
| `LOGIN_FAILED` | WARNING | Autenticación | Fallo de contraseña o correo inexistente. |
| `MFA_CHALLENGE_FAILED` | WARNING | Autenticación | Código TOTP incorrecto tras credenciales válidas. |
| `ACCOUNT_TEMPORARY_LOCK` | CRITICAL | Seguridad | Cuenta bloqueada automáticamente por 5 fallos consecutivos. |
| `LOGOUT` | INFO | Autenticación | Cierre voluntario de sesión en dispositivo actual. |
| `LOGOUT_ALL_SESSIONS` | INFO | Autenticación | Cierre forzado de todas las sesiones de un usuario. |
| `USER_CREATED` | INFO | Usuarios | Alta de nuevo integrante por administración. |
| `USER_STATUS_CHANGED` | CRITICAL | Usuarios | Cuenta activada, inactivada o bloqueada por administrador. |
| `USER_MFA_RESET` | CRITICAL | Seguridad | Restablecimiento administrativo del secreto MFA de un usuario. |
| `MEETING_CREATED` | INFO | Reuniones | Convocatoria y alta de una nueva reunión. |
| `MEETING_UPDATED` | INFO | Reuniones | Modificación de orden del día o desarrollo de minuta. |
| `MEETING_STATUS_CHANGED`| INFO | Reuniones | Transición de estado (ej. de EN_DESARROLLO a FINALIZADA). |
| `NOTE_CREATED` | INFO | Anotaciones | Creación de anotación propia por un integrante. |
| `NOTE_UPDATED` | INFO | Anotaciones | Edición de anotación por su autor original (genera versión). |
| `ADMIN_NOTE_OVERRIDE` | **CRITICAL** | Anotaciones | Intervención administrativa sobre nota ajena (exige motivo). |
| `AGREEMENT_CREATED` | INFO | Acuerdos | Formalización de nuevo compromiso institucional. |
| `AGREEMENT_STATUS_CHANGED`| INFO | Acuerdos | Avance o conclusión de acuerdo con notas de evidencia. |
| `FILE_UPLOAD_CONFIRMED` | INFO | Documentos | Subida exitosa y validada de archivo adjunto a S3. |
| `FILE_DOWNLOAD_URL_ISSUED`| INFO | Documentos | Emisión de URL pre-firmada para visualización o descarga. |
| `FILE_DELETED_LOGICAL` | WARNING | Documentos | Eliminación lógica de un expediente documental. |
| `SECURITY_VIOLATION_ATTEMPT`| **CRITICAL**| Seguridad | Intento de manipulación de ID ajeno (Anti-IDOR detectado). |

---

## 3. ARQUITECTURA DE INMUTABILIDAD EN BASE DE DATOS

Para impedir que incluso un desarrollador con acceso a la aplicación o un administrador comprometido altere el historial de auditoría desde el backend, se implementan tres niveles de aseguramiento:

```
+-----------------------------------------------------------------------------------+
|               BARRERAS DE PROTECCIÓN DE LA TABLA AUDIT_LOGS                       |
+-----------------------------------------------------------------------------------+
| 1. NIVEL DE APLICACIÓN: NestJS AuditService no expone métodos update() ni delete()|
| 2. NIVEL DE PRIVILEGIOS POSTGRESQL: REVOKE UPDATE, DELETE FROM app_user           |
| 3. NIVEL DE BASE DE DATOS: Trigger PL/pgSQL que aborta cualquier intento de cambio|
+-----------------------------------------------------------------------------------+
```

### Definición del Trigger de Inmutabilidad en PostgreSQL:
```sql
-- Función de protección que lanza una excepción irrevocable
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'VIOLACIÓN DE INTEGRIDAD FORENSE: La tabla audit_logs es inmutable y no admite modificaciones (UPDATE) ni borrados (DELETE). Operación denegada.'
    USING ERRCODE = 'restrict_violation';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Disparador aplicado a la tabla audit_logs
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();
```

---

## 4. FILTRADO ESTRICTO DE SECRETOS (SANITIZATION ENGINE)

El `AuditInterceptor` de NestJS analiza cada payload y aplica una regla de enmascaramiento recursivo antes de construir el campo `diff_payload`:

```typescript
export class AuditSanitizer {
  private static readonly BLACKLISTED_KEYS = new Set([
    'password',
    'passwordhash',
    'password_hash',
    'token',
    'sessiontoken',
    'session_token',
    'encryptedsecret',
    'encrypted_secret',
    'backupcodes',
    'backup_codes_hashes',
    'totpcode',
    'totp_code',
    'secret',
    'authorization',
  ]);

  public static sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sanitize(item));

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (this.BLACKLISTED_KEYS.has(normalizedKey)) {
        cleaned[key] = '[REDACTADO_POR_SEGURIDAD]';
      } else if (typeof value === 'object') {
        cleaned[key] = this.sanitize(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}
```

---

## 5. ESTRATEGIA DE RETENCIÓN, POLÍTICA DE RESGUARDO Y EXPORTACIÓN

1. **Vigencia en Base de Datos Viva:** Los registros de auditoría permanecerán en la base de datos transaccional de Neon durante un periodo activo de **36 meses (3 años)**.
2. **Archivado Frío (*Cold Storage*):** Cada fin de mes, un proceso programado de mantenimiento extraerá los registros con más de 36 meses, generará un archivo JSON sellado criptográficamente con SHA-256 y firma digital, y lo transferirá a un almacenamiento S3 con política de retención inmutable (*Object Lock / WORM - Write Once, Read Many*) por un plazo adicional de **5 años**, en observancia de las mejores prácticas de gobernanza documental en México.
3. **Capacidad de Exportación:** La consola del Administrador permite exportar filtros de auditoría en formato CSV o PDF foliado con sellos de tiempo para auditorías externas o requerimientos de órganos de control institucional.

