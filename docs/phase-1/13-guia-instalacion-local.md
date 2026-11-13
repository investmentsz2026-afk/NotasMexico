# DOCUMENTO 13: GUÍA DE INSTALACIÓN, CONFIGURACIÓN Y EJECUCIÓN LOCAL
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 1 — Infraestructura, Monorepo, Neon PostgreSQL y Prisma  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Documentado y Verificado  

---

## 1. REQUISITOS PREVIOS DEL SISTEMA

Antes de comenzar, asegúrese de contar con las siguientes herramientas en su estación de trabajo:

- **Node.js:** Versión 20.x, 22.x LTS o 24.x.
  - Verificación: `node -v`
- **pnpm:** Versión 9.x o 12.x instalada globalmente.
  - Instalación si no está presente: `npm install -g pnpm`
  - Verificación: `pnpm -v`
- **Git:** Versión 2.30+.
  - Verificación: `git --version`

---

## 2. PROCEDIMIENTO DE INSTALACIÓN PASO A PASO

### 2.1. Clonación o Acceso al Directorio del Proyecto
```bash
cd d:\MexAgenda
```

### 2.2. Instalación de Dependencias del Monorepo
Ejecute la instalación con pnpm (los paquetes de todos los workspaces se vincularán automáticamente):
```bash
pnpm install
```

### 2.3. Configuración de Variables de Entorno Locales
Cree el archivo `.env.local` a partir de la plantilla `.env.example`:

**En Windows (PowerShell):**
```powershell
Copy-Item .env.example .env.local
```

**En Linux / macOS (Bash):**
```bash
cp .env.example .env.local
```

Abra `.env.local` con su editor de preferencia y configure las credenciales correspondientes a su instancia de desarrollo en Neon PostgreSQL:
```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
DATABASE_URL="postgresql://[user]:[password]@[host]-pooler.us-east-2.aws.neon.tech/mexagenda_db?sslmode=require"
DIRECT_URL="postgresql://[user]:[password]@[host].us-east-2.aws.neon.tech/mexagenda_db?sslmode=require"
```

---

## 3. VALIDACIÓN Y GENERACIÓN DE MODELOS

Ejecute la comprobación del esquema y la generación del cliente tipado de Prisma:

```bash
# Validar la sintaxis del esquema
pnpm prisma:validate

# Generar el cliente @prisma/client
pnpm prisma:generate

# Verificar integridad estructural
pnpm verify:infra
```

---

## 4. EJECUCIÓN EN MODO DESARROLLO

Para iniciar simultáneamente el Backend (NestJS en puerto 4000) y el Frontend (Next.js en puerto 3000):

```bash
pnpm dev
```

### Ejecución de Servicios de Forma Individual:
- **Solo Backend NestJS:**
  ```bash
  pnpm dev:backend
  ```
  *URL de la API:* `http://localhost:4000/api/v1`  
  *Documentación Swagger:* `http://localhost:4000/api/docs`  
  *Health Check:* `http://localhost:4000/api/v1/health`

- **Solo Frontend Next.js:**
  ```bash
  pnpm dev:frontend
  ```
  *URL de la Aplicación:* `http://localhost:3000`  
  *Panel de Diagnóstico:* `http://localhost:3000/status`

---

## 5. COMPILACIÓN Y VERIFICACIÓN DE PRODUCCIÓN

Para simular la compilación del pipeline de integración continua:

```bash
# 1. Comprobación estricta de tipos de TypeScript
pnpm typecheck

# 2. Compilación completa de todos los paquetes y aplicaciones
pnpm build
```

---

## 6. RESOLUCIÓN DE PROBLEMAS COMUNES (TROUBLESHOOTING)

1. **Error `Environment variable not found: DIRECT_URL`:**
   - Causa: Ejecutó directamente `npx prisma validate` en lugar de los scripts del proyecto.
   - Solución: Utilice siempre `pnpm prisma:validate` o `node scripts/prisma-runner.js validate`.
2. **Error `ERR_PNPM_IGNORED_BUILDS` en instalación limpia:**
   - Causa: pnpm v12 bloquea scripts postinstall de paquetes recién agregados.
   - Solución: Ejecute `pnpm approve-builds --all -y`.
3. **El backend reporta `database: "disconnected"` en `/health`:**
   - Causa: La cadena `DATABASE_URL` no es válida o Neon PostgreSQL está pausado.
   - Solución: Verifique la conectividad de red con Neon o revise las credenciales en `.env.local`.
