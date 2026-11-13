# MexAgenda — Sistema Privado de Gestión Institucional

Plataforma privada, multiusuario y colaborativa para la gestión de sesiones colegiadas, minutas, acuerdos institucionales, anotaciones individuales con estricta soberanía de autoría, notificaciones institucionales y tableros analíticos de control ejecutivo.

---

## 1. ESTADO DE IMPLEMENTACIÓN Y MÓDULOS ACTIVOS (FASES 1 A 8)

| Fase | Módulo | Descripción Funcional | Cobertura de Pruebas |
|---|---|---|---|
| **Fase 1** | Infraestructura | Monorepo pnpm, Turborepo, Neon PostgreSQL Serverless, Prisma ORM. | `verify-infra` |
| **Fase 2** | `MOD-01` | Autenticación robusta, Argon2id, MFA TOTP (AES-256-GCM), sesiones HttpOnly. | `pnpm test:phase2` (17/17) |
| **Fase 3** | `MOD-02` / `MOD-03` | Administración de usuarios, RBAC institucional y taxonomía dinámica de reuniones. | `pnpm test:phase3` & audit (73/73) |
| **Fase 4** | `MOD-04` | Ciclo de vida de reuniones, convocatorias, control de concurrencia optimista y actas. | `pnpm test:phase4` & audit (66/66) |
| **Fase 5** | `MOD-05` | Anotaciones deliberativas individuales, soberanía de autoría ABAC y versionado inmutable. | `pnpm test:phase5` & audit (40/40) |
| **Fase 6** | `MOD-06` / `MOD-07` | Acuerdos vinculantes, seguimiento de compromisos y bóveda documental privada. | `pnpm test:phase6` & audit (36/36) |
| **Fase 7** | `MOD-06` | Sistema de notificaciones institucionales, outbox transaccional y servicio SMTP. | `pnpm test:phase7` & fixes (72/72) |
| **Fase 8** | `MOD-07` | Tableros ejecutivos, métricas de gobernanza, quórum legal y exportación CSV sanitizada. | `pnpm test:phase8` (35/35) |

---

## 2. ARQUITECTURA DEL MONOREPO

```text
mexagenda/
├── apps/
│   ├── frontend/         # Next.js 15 (App Router, React 19, Tailwind CSS, TypeScript)
│   └── backend/          # NestJS 11 (REST API, Helmet, CORS, PrismaService, Auth, Reports)
├── packages/
│   ├── shared/           # Contratos de API, interfaces DTO, enums institucionales
│   └── validation/       # Reglas de validación isomórficas (Password, EnvSchema)
├── prisma/
│   ├── schema.prisma     # Esquema relacional maestro (19 entidades normalizadas)
│   └── migrations/       # Historial de migraciones SQL inmutables
├── docs/                 # Documentación técnica, planes y dictámenes de auditoría (Fases 0 a 8)
├── scripts/              # Suites de prueba automatizadas y utilitarios de mantenimiento
├── .env.example          # Plantilla completa de variables de entorno (con marcadores seguros)
├── pnpm-workspace.yaml   # Configuración de workspaces de pnpm
└── package.json          # Orquestador raíz de scripts del monorepo
```

---

## 3. REQUISITOS PREVIOS

- **Node.js:** Versión `>= 20.0.0` (recomendado v22 o v24 LTS).
- **pnpm:** Versión `>= 9.0.0` (ej. `npm install -g pnpm`).
- **Base de Datos:** Instancia de **Neon PostgreSQL Serverless** con cadenas `DATABASE_URL` (Pooled/PgBouncer) y `DIRECT_URL` (Directa para migraciones DDL).

---

## 4. INSTALACIÓN Y CONFIGURACIÓN LOCAL

### 4.1. Instalación de Dependencias
```bash
pnpm install
```

### 4.2. Variables de Entorno Locales
Copiar la plantilla de referencia a `.env.local` (ignorado por Git):
```bash
cp .env.example .env.local
```
Configurar las variables requeridas en `.env.local`:
```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
DATABASE_URL="postgresql://[user]:[password]@[host]-pooler.[region].aws.neon.tech/[dbname]?sslmode=require"
DIRECT_URL="postgresql://[user]:[password]@[host].[region].aws.neon.tech/[dbname]?sslmode=require"
MFA_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
SESSION_SECRET="desarrollo_local_secreto_seguro_cambiar_en_produccion"
NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"
NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
```

### 4.3. Inicialización y Migraciones de Base de Datos
```bash
# Validar esquema de Prisma
pnpm prisma:validate

# Generar cliente tipado
pnpm prisma:generate

# Aplicar migraciones pendientes
pnpm prisma:migrate:deploy

# Opcional: Crear usuario administrador inicial
pnpm bootstrap:admin
```

---

## 5. SCRIPTS DE EJECUCIÓN Y PRUEBAS

| Comando | Descripción |
|---|---|
| `pnpm dev` | Inicia simultáneamente Backend (puerto 4000) y Frontend (puerto 3000). |
| `pnpm dev:backend` | Inicia únicamente el backend NestJS con recarga en vivo (`watch`). |
| `pnpm dev:frontend` | Inicia únicamente la aplicación web Next.js (`next dev`). |
| `pnpm build` | Compila packages compartidos, cliente Prisma, backend y frontend. |
| `pnpm typecheck` | Ejecuta verificación estricta de tipos de TypeScript en todos los workspaces. |
| `pnpm test:phase8` | Ejecuta la suite de pruebas automatizadas de Fase 8 (MOD-07). |
| `pnpm verify:infra` | Ejecuta validación estática de integridad de componentes. |

---

## 6. GUÍA DE DESPLIEGUE EN PRODUCCIÓN

### 6.1. Frontend en Vercel
- **Root Directory:** Raíz del proyecto (`.`) o `apps/frontend`.
- **Install Command:** `pnpm install`
- **Build Command:** `pnpm build:packages && pnpm --filter @mexagenda/frontend build`
- **Output Directory:** `apps/frontend/.next`
- **Variables de Entorno en Vercel:**
  - `NEXT_PUBLIC_BACKEND_URL`: URL pública del backend (ej. `https://api.mexagenda.gob.mx`).
  - `NEXT_PUBLIC_API_URL`: URL pública con versión de API (ej. `https://api.mexagenda.gob.mx/api/v1`).

### 6.2. Backend NestJS y Worker de Notificaciones
- **Entorno Recomendado:** Proceso persistente en contenedor Docker (AWS App Runner / ECS, Railway, Render o VPS institucional).
- **Worker Outbox:** Requiere proceso en ejecución continua para sondeo y despacho asíncrono de correos.
- **Políticas CORS y Cookies:** En producción, `FRONTEND_URL` debe coincidir con el dominio del frontend, con `credentials: true` y cookies seguras con atributo `SameSite=Lax` y `Secure`.

### 6.3. Neon PostgreSQL Serverless
- **Runtime:** `DATABASE_URL` con PgBouncer habilitado (`-pooler.`) para multiplexar conexiones concurrentes.
- **Migraciones:** `DIRECT_URL` (conexión directa sin pooler) consumida por `pnpm prisma:migrate:deploy` en paso previo de despliegue.

---

## 7. GOBERNANZA DE SEGURIDAD

- **Cero Secretos en Repositorio:** Ningún archivo `.env` o credencial real se versiona en Git.
- **Aislamiento de Persistencia:** El frontend nunca se conecta a PostgreSQL ni conoce la cadena de conexión.
- **Auditoría Inmutable:** Todo evento operativo y de exportación queda registrado en `audit_logs` con trigger PostgreSQL inmutable.
- **Cumplimiento Normativo:** Alineado con OWASP ASVS Nivel 2 y la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) en México.
