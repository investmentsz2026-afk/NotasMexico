# DOCUMENTO 16: ESTRUCTURA Y GOBERNANZA DEL MONOREPO
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. EVALUACIÓN Y SELECCIÓN DE HERRAMIENTAS DE MONOREPO

Para garantizar una experiencia de desarrollo ágil, builds ultrarrápidos con caché inteligente y tipado integral compartido entre Frontend y Backend, se selecciona:

- **Gestor de Paquetes:** **pnpm** (mediante pnpm Workspaces). Justificación: Ahorro masivo de espacio en disco mediante enlaces duros (*hard links*), resolución de dependencias estricta y aislamiento que evita dependencias fantasma (*phantom dependencies*).
- **Orquestador de Tareas y Build Pipeline:** **Turborepo**. Justificación: Caché local y remoto de compilaciones, ejecución paralela optimizada (`turbo run build`, `turbo run test`, `turbo run lint`).

---

## 2. ÁRBOL COMPLETO DE DIRECTORIOS DEL PROYECTO

La siguiente estructura organiza el repositorio de forma modular, desacoplada y mantenible para entornos de producción:

```
gestion-institucional/                  # Raíz del Monorepo (MexAgenda)
├── .github/                            # Pipelines de CI/CD (GitHub Actions)
│   └── workflows/
│       ├── ci.yml                      # Lint, typecheck, test unitarios en cada PR
│       ├── security-scan.yml           # Análisis de vulnerabilidades y SAST
│       └── deploy.yml                  # Despliegue automatizado por ambientes
├── apps/                               # Aplicaciones ejecutables
│   ├── backend/                        # Backend API (NestJS + TypeScript)
│   │   ├── src/
│   │   │   ├── common/                 # Interceptors, Filters, Guards, Decorators
│   │   │   ├── config/                 # Validación de variables de entorno
│   │   │   ├── modules/                # Módulos de dominio (auth, users, meetings, etc.)
│   │   │   ├── providers/              # PrismaService, StorageService (S3), Mailer
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/                       # Pruebas e2e y de integración (Jest / Supertest)
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                       # Frontend Web (Next.js App Router + Tailwind)
│       ├── public/                     # Activos estáticos públicos (logos, favicon)
│       ├── src/
│       │   ├── app/                    # App Router: (auth), (dashboard), api proxy
│       │   ├── components/             # UI Components (Radix/Tailwind, Modales, Muros)
│       │   ├── hooks/                  # Custom Hooks (useAuth, useSessionTimeout)
│       │   ├── lib/                    # Clientes de API, utilerías de fecha, helpers
│       │   └── types/                  # Tipos específicos de vistas
│       ├── next.config.mjs
│       ├── package.json
│       ├── postcss.config.js
│       ├── tailwind.config.ts
│       └── tsconfig.json
│
├── packages/                           # Paquetes y bibliotecas internas compartidas
│   ├── config/                         # Configuraciones compartidas de herramientas
│   │   ├── eslint-preset/              # Reglas ESLint institucionales
│   │   ├── tsconfig-base/              # tsconfig base estricto
│   │   └── package.json
│   │
│   ├── shared-types/                   # Fuente única de verdad tipada (DTOs y Enums)
│   │   ├── src/
│   │   │   ├── enums/                  # MeetingStatus, AgreementStatus, Roles
│   │   │   ├── dtos/                   # CreateMeetingDto, UpdateNoteDto, etc.
│   │   │   └── api/                    # Contratos de respuesta estandarizados
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── validation/                     # Reglas de validación isomórficas (Zod / RegEx)
│       ├── src/
│       │   ├── password.rules.ts       # Expresiones regulares de contraseñas robustas
│       │   ├── meeting.schemas.ts      # Validadores compartidos
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── prisma/                             # Capa de Persistencia y Migraciones Relacionales
│   ├── migrations/                     # Historial de migraciones SQL aplicadas
│   ├── schema.prisma                   # Esquema maestro de entidades de datos
│   └── seed.ts                         # Semilla para roles y administrador inicial
│
├── docs/                               # Documentación Técnica Oficial
│   ├── phase-0/                        # Entregables oficiales de la Fase 0 (1 a 20)
│   ├── architecture.md
│   ├── requirements.md
│   ├── permissions.md
│   ├── database.md
│   ├── security.md
│   ├── api.md
│   ├── testing.md
│   └── deployment.md
│
├── .editorconfig                       # Estandarización de saltos de línea y tabulación
├── .env.example                        # Plantilla documentada de variables de entorno
├── .gitignore                          # Exclusiones de Git (node_modules, .env, dist)
├── package.json                        # Raíz: scripts de orquestación global
├── pnpm-lock.yaml                      # Árbol de dependencias inmutable
├── pnpm-workspace.yaml                 # Definición de workspaces ('apps/*', 'packages/*')
├── README.md                           # Guía general de arquitectura y desarrollo
└── turbo.json                          # Configuración de pipelines y dependencias de build
```

---

## 3. AISLAMIENTO Y FRONTERAS ESTRICTAS DE CÓDIGO

Para evitar fugas de seguridad y acoplamiento indebido, el monorepo implementa directivas de frontera rigurosas:

```
+-----------------------------------------------------------------------------------+
|                     REGLAS DE AISLAMIENTO EN EL MONOREPO                          |
+-----------------------------------------------------------------------------------+
| 1. apps/frontend NUNCA importa @prisma/client ni accede a DATABASE_URL.           |
| 2. apps/frontend se comunica con apps/backend ÚNICAMENTE mediante HTTP REST.     |
| 3. packages/shared-types contiene tipos puros sin dependencias pesadas de runtime.|
| 4. Las variables con credenciales de base de datos o secretos S3 residen          |
|    exclusivamente en el entorno de ejecución de apps/backend.                     |
+-----------------------------------------------------------------------------------+
```

---

## 4. PIPELINE TURBOREPO (`turbo.json`)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

Esta configuración garantiza que al compilar `apps/frontend` o `apps/backend`, Turborepo compile primero los paquetes compartidos (`packages/shared-types`, `packages/validation`) y aproveche la caché en caso de que los archivos fuente no hayan variado.

