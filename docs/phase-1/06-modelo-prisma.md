# DOCUMENTO 06: MODELO DE DATOS PRISMA Y ENTIDADES NORMALIZADAS
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 1 — Infraestructura, Monorepo, Neon PostgreSQL y Prisma  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Implementado / En Verificación  

---

## 1. IMPLEMENTACIÓN DEL ESQUEMA PRISMA

El archivo `prisma/schema.prisma` implementa las **19 entidades normalizadas en Tercera Forma Normal (3NF)** requeridas por la especificación de la Fase 0, preservando íntegramente las relaciones, índices, enumeraciones y llaves foráneas:

```
+-----------------------------------------------------------------------------------+
|                        CATÁLOGO DE LAS 19 ENTIDADES EN PRISMA                     |
+----+-----------------------+------------------------------------------------------+
| #  | Modelo Prisma         | Propósito Institucional                              |
+----+-----------------------+------------------------------------------------------+
| 01 | `Role`                | Catálogo de roles institucionales (ADMIN, USER)      |
| 02 | `Permission`          | Catálogo granular de operaciones y recursos          |
| 03 | `RolePermission`      | Asociación Muchos a Muchos (N:M) de roles y permisos |
| 04 | `User`                | Perfiles de integrantes y consejeros institucionales |
| 05 | `UserSession`         | Persistencia y estado en tiempo real de sesiones     |
| 06 | `UserMfa`             | Secreto criptográfico TOTP y códigos de respaldo     |
| 07 | `LoginAttempt`        | Registro forense para protección contra fuerza bruta |
| 08 | `PasswordResetToken`  | Tokens de un solo uso para recuperación asistida     |
| 09 | `MeetingCategory`     | Taxonomía configurable de reuniones institucionales  |
| 10 | `Meeting`             | Convocatorias, órdenes del día y minutas de sesión   |
| 11 | `MeetingParticipant`  | Convocados, roles de sesión y registro de asistencia |
| 12 | `PersonalNote`        | Anotaciones deliberativas con soberanía de autoría   |
| 13 | `PersonalNoteVersion` | Historial inmutable de versiones de anotaciones      |
| 14 | `Agreement`           | Acuerdos y compromisos formales vinculantes          |
| 15 | `AgreementHistory`    | Bitácora de transiciones y evidencias de acuerdos    |
| 16 | `Attachment`          | Metadatos de expedientes documentales en S3 privado  |
| 17 | `AttachmentVersion`   | Versionado de documentos y fe de erratas             |
| 18 | `AuditLog`            | Bitácora inmutable de eventos de negocio y seguridad |
| 19 | `SystemSetting`       | Directivas y parámetros configurables de plataforma  |
+----+-----------------------+------------------------------------------------------+
```

---

## 2. REGLAS DE INTEGRIDAD REFERENCIAL Y CONCURRENCIA

1. **Restricción de Borrado (`ON DELETE RESTRICT`):**
   - No se permite la eliminación de un usuario si ha convocado reuniones, redactado notas o tiene acuerdos asignados.
   - No se permite borrar categorías que posean reuniones asociadas.
2. **Control de Concurrencia Optimista:**
   - Modelos colaborativos (`Meeting`, `PersonalNote`, `Agreement`, `Attachment`) incorporan el campo `version Int @default(1)`. En cada mutación, el backend verifica que la versión provista coincida con la versión en base de datos antes de incrementar, evitando el problema de la sobreescritura accidental (*Lost Update*).
3. **Mapeo Físico de Nombres (`@@map` y `@map`):**
   - Los modelos de Prisma utilizan PascalCase en TypeScript (`PersonalNote`), pero se mapean estrictamente a snake_case en PostgreSQL (`personal_notes`, `author_id`, `created_at`), asegurando cumplimiento con convenciones de base de datos relacionales estándar.
