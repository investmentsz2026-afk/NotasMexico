# DOCUMENTO 07: PROCEDIMIENTO DE MIGRACIONES Y GESTIÓN DE BASE DE DATOS
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 1 — Infraestructura, Monorepo, Neon PostgreSQL y Prisma  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Implementado / En Verificación  

---

## 1. PRINCIPIOS DE GESTIÓN DE MIGRACIONES

En un sistema institucional que custodia minutas legales y acuerdos vinculantes, la evolución del esquema de base de datos debe ser estrictamente auditable, reproducible e incremental:
- **Prohibición de Comandos Destructivos:** Se prohíbe terminantemente el uso de `prisma db push --force-reset` o `prisma migrate reset` en cualquier entorno con datos persistidos.
- **Migraciones Versionadas:** Toda modificación al archivo `prisma/schema.prisma` genera un archivo SQL numerado cronológicamente en la carpeta `prisma/migrations/`, el cual se commitea en Git.
- **Separación de Privilegios:** En producción, las migraciones se aplican mediante `DIRECT_URL` (conexión no mediada por PgBouncer) empleando `prisma migrate deploy`.

---

## 2. FLUJO DE TRABAJO EN ENTORNO DE DESARROLLO

Cuando se agrega o ajusta una entidad durante las siguientes fases:
1. **Modificar el Esquema:** Editar `prisma/schema.prisma`.
2. **Validar la Sintaxis:**
   ```bash
   pnpm prisma:validate
   ```
3. **Crear y Aplicar la Migración en Desarrollo:**
   ```bash
   pnpm prisma migrate dev --name <nombre_descriptivo>
   ```
   *Ejemplo:* `pnpm prisma migrate dev --name init_mexagenda_schema`
4. **Regenerar el Cliente Tipado:**
   ```bash
   pnpm prisma:generate
   ```

---

## 3. FLUJO DE APLICACIÓN EN STAGING Y PRODUCCIÓN

En los pipelines de despliegue continuo (CI/CD):
1. El pipeline ejecuta el comando idempotente:
   ```bash
   pnpm prisma migrate deploy
   ```
2. Prisma revisa la tabla `_prisma_migrations` en PostgreSQL y aplica únicamente las migraciones pendientes en orden correlativo, dentro de transacciones atómicas seguras.

---

## 4. PROCEDIMIENTO DE RECUPERACIÓN O ROLLBACK

Si una migración fallara durante su ejecución o se requiriera revertir un cambio estructural:
1. **Generar Migración de Compensación:** No se eliminan manualmente archivos de migración aplicados previamente. Se genera una nueva migración que ejecuta el `ALTER TABLE` o `DROP` inverso para preservar la linealidad histórica.
2. **Restauración PITR en Neon:** En caso de incidente grave en desarrollo, se utiliza la consola de Neon para restaurar la base de datos al estado previo en cuestión de segundos (*Point-in-Time Recovery*).
