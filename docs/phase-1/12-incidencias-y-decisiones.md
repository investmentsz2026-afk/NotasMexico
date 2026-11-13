# DOCUMENTO 12: REGISTRO DE INCIDENCIAS TÉCNICAS Y DECISIONES DE IMPLEMENTACIÓN
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 1 — Infraestructura, Monorepo, Neon PostgreSQL y Prisma  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Documentado y Resuelto  

---

## 1. INCIDENCIAS ENCONTRADAS Y RESOLUCIONES DE INGENIERÍA

Durante la ejecución de la Fase 1 se identificaron y solventaron tres incidencias técnicas críticas, documentadas transparentemente a continuación:

---

### INCIDENCIA 1: Bloqueo de Scripts de Build por Nueva Política de Seguridad en pnpm v12
- **Síntoma:** Al ejecutar la instalación inicial de dependencias, pnpm v12.16.1 interrumpió el proceso con el error:  
  `ERR_PNPM_IGNORED_BUILDS: Ignored build scripts: @prisma/client, @prisma/engines, prisma`.
- **Causa Raíz:** A partir de la versión 12, pnpm deshabilita por defecto la ejecución de scripts `postinstall` de terceros para mitigar ataques a la cadena de suministro (*Supply Chain Attacks*).
- **Resolución Técnica:**
  1. Se configuró el archivo `.npmrc` en la raíz con la directiva `only-built-dependencies`:
     ```ini
     only-built-dependencies[]=@prisma/client
     only-built-dependencies[]=@prisma/engines
     only-built-dependencies[]=prisma
     ```
  2. Se ejecutó la aprobación explícita mediante `pnpm approve-builds --all -y`, permitiendo a los motores de Prisma compilar sus binarios de consulta de forma controlada y segura.

---

### INCIDENCIA 2: Exigencia de `DIRECT_URL` en Prisma CLI para Validación Estática
- **Síntoma:** El comando `prisma validate` fallaba con `Error P1012: Environment variable not found: DIRECT_URL`, debido a que el bloque `datasource db` define `directUrl = env("DIRECT_URL")`.
- **Causa Raíz:** Prisma exige que las variables referenciadas en el bloque `datasource` existan en el entorno de ejecución, incluso para operaciones estáticas de solo análisis sintáctico que no abren conexiones de red.
- **Resolución Técnica:**
  1. Se diseñó el script `scripts/prisma-runner.js`, el cual:
     - Carga de forma segura `.env.local` o `.env` si existen.
     - Provee valores de sustitución estáticos inofensivos (`postgresql://placeholder_user:...`) si no existen variables en el entorno local.
  2. Se configuraron los scripts `prisma:validate` y `prisma:generate` en `package.json` para ejecutarse a través de este runner, garantizando que el pipeline de CI/CD valide el esquema sin requerir credenciales reales.

---

### INCIDENCIA 3: Desfase de Versiones de Prisma ORM
- **Síntoma:** Intento de instalación de `@prisma/client` versión 7.x mientras el CLI `prisma` utilizaba la rama 6.x.
- **Causa Raíz:** La resolución de dependencias de npm instaló temporalmente la versión `latest` (v7) en la raíz del workspace, incompatible con el generador de la v6.
- **Resolución Técnica:**
  - Se fijó de forma estricta la versión `6.19.3` tanto en `package.json` (raíz) como en `apps/backend/package.json`.
  - Se regeneró el archivo de bloqueo `pnpm-lock.yaml`, logrando una sincronización al 100%.

---

## 2. DECISIONES TÉCNICAS DE IMPLEMENTACIÓN RATIFICADAS

1. **Degradación Elegante en el Arranque de NestJS:**
   - Si `DATABASE_URL` no está definida, `PrismaService` no aborta el proceso con una excepción no controlada; emite un registro de advertencia y permite que el servidor web continúe operando para servir rutas de diagnóstico `/health` y documentación OpenAPI.
2. **Estructura Isomórfica de Paquetes:**
   - La división entre `@mexagenda/shared` (tipos puros) y `@mexagenda/validation` (lógica de validación) garantiza que el frontend Next.js no incorpore dependencias innecesarias de Node.js, manteniendo los bundles de cliente ligeros (*First Load JS < 110 kB*).
