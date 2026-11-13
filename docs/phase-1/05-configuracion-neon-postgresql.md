# DOCUMENTO 05: CONFIGURACIÓN DE NEON POSTGRESQL Y CONNECTION POOLING
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 1 — Infraestructura, Monorepo, Neon PostgreSQL y Prisma  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Implementado / En Verificación  

---

## 1. ARQUITECTURA DE BASE DE DATOS SERVERLESS (NEON)

**MexAgenda** utiliza **Neon PostgreSQL**, una plataforma serverless que desacopla la capa de cómputo (*Compute Layer*) de la capa de almacenamiento (*Storage Layer*). Esta arquitectura ofrece ventajas operativas críticas para la gobernanza institucional:
1. **Connection Pooling Nativo (PgBouncer):** Permite sostener decenas o cientos de conexiones efímeras sin agotar los límites del motor PostgreSQL.
2. **Database Branching (Ramas Aisladas):** Facilita la creación instantánea de copias idénticas de la base de datos para pruebas aisladas y validación previa de migraciones.
3. **Point-in-Time Recovery (PITR):** Respaldo continuo a nivel de WAL para recuperación precisa a nivel de segundo.

---

## 2. SEPARACIÓN DE CONEXIONES: POOLED VS. DIRECTA

Prisma ORM y Neon requieren una separación técnica explícita en el archivo `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

```
+-----------------------------------------------------------------------------------+
|               ESTRATEGIA DE CONEXIONES EN NEON POSTGRESQL                         |
+---------------------+-------------------------------+-----------------------------+
| PARÁMETRO           | `DATABASE_URL` (Pooled)       | `DIRECT_URL` (Unpooled)     |
+---------------------+-------------------------------+-----------------------------+
| Puerto              | `6543` (o sufijo `-pooler`)   | `5432`                      |
| Mediador            | PgBouncer en Neon             | Motor PostgreSQL Directo    |
| Uso en MexAgenda    | Backend NestJS en runtime     | Prisma Migrate en CI / CLI  |
| Justificación       | Absorbe concurrencia de       | Permite comandos DDL que    |
|                     | consultas sin saturar RAM     | PgBouncer no admite en modo |
|                     | del motor PostgreSQL.         | de transacción (ej. locks). |
+---------------------+-------------------------------+-----------------------------+
```

---

## 3. GUÍA PASO A PASO PARA CONFIGURAR NEON DESDE CERO

Cuando el responsable de infraestructura o el cliente aprovisione la instancia en Neon:
1. **Crear Proyecto en Neon:**
   - Nombre: `mexagenda-db`.
   - Región recomendada: `us-east-2` (Ohio) o la más próxima a la institución en México.
   - Versión: PostgreSQL 16+.
2. **Obtener las Cadenas de Conexión en el Dashboard de Neon:**
   - En la sección **Connection Details**, copiar la opción **Pooled connection** y asignarla a `DATABASE_URL`.
   - Cambiar el selector a **Direct connection**, copiar la cadena y asignarla a `DIRECT_URL`.
3. **Configurar el archivo `.env.local` en el servidor o entorno local:**
   ```env
   DATABASE_URL="postgresql://[user]:[pass]@[host]-pooler.us-east-2.aws.neon.tech/mexagenda_db?sslmode=require"
   DIRECT_URL="postgresql://[user]:[pass]@[host].us-east-2.aws.neon.tech/mexagenda_db?sslmode=require"
   ```
4. **Verificar la Conexión:**
   - Ejecutar `pnpm prisma:validate` para comprobar sintaxis.
   - Ejecutar `pnpm dev:backend` y consultar `GET /api/v1/health` para verificar que `services.database` reporte `"connected"`.
