# DOCUMENTO 02: ARQUITECTURA Y GOBERNANZA DEL MONOREPO
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 1 — Infraestructura, Monorepo, Neon PostgreSQL y Prisma  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Implementado / En Verificación  

---

## 1. JUSTIFICACIÓN DE LA ARQUITECTURA MONOREPO

Para un sistema institucional que comparte contratos de API, enumeraciones de estado, reglas de validación de contraseñas y modelos de datos entre el Frontend (Next.js) y el Backend (NestJS), la arquitectura Monorepo ofrece beneficios contundentes:
1. **Tipado de Extremo a Extremo (Single Source of Truth):** Las interfaces y enumeraciones se definen una única vez en `packages/shared/` y son consumidas inmediatamente por frontend y backend sin desfases de sincronización.
2. **Eficiencia en Dependencias con pnpm:** Uso de *hard links* y *symlinks* que reducen el consumo en disco y garantizan resolución inmutable sin dependencias fantasma.
3. **Control de Cambios Unificado:** Cada Pull Request o commit puede auditar cambios atómicos que involucren esquemas de base de datos, endpoints del backend y vistas del frontend simultáneamente.

---

## 2. GOBERNANZA DE WORKSPACES (`pnpm-workspace.yaml`)

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 2.1. Aplicaciones (`apps/*`):
- **`apps/frontend` (`@mexagenda/frontend`):** Aplicación web Next.js orientada al usuario y al administrador. Responsable de la experiencia de usuario, renderizado accesible y consumo de la API REST.
- **`apps/backend` (`@mexagenda/backend`):** Servidor HTTP NestJS. Monopoliza el acceso a la base de datos a través de Prisma y expone la API REST segura en `/api/v1`.

### 2.2. Paquetes Compartidos (`packages/*`):
- **`packages/shared` (`@mexagenda/shared`):** Paquete puro de TypeScript (sin dependencias pesadas de runtime) que exporta:
  - Enums de dominio (`UserStatus`, `MeetingStatus`, `AgreementStatus`, `AuditOutcome`, `SystemRole`, etc.).
  - Contratos estandarizados de respuesta (`ApiResponse<T>`, `ApiErrorResponse`, `HealthCheckResponse`).
  - Metadatos de paginación (`PaginationMeta`, `PaginatedResponse<T>`).
- **`packages/validation` (`@mexagenda/validation`):** Reglas de validación isomórficas:
  - `validatePasswordPolicy`: Validador de política de contraseñas de al menos 12 caracteres, mayúsculas, minúsculas, números y símbolos.
  - `validateEnvironment`: Validador estricto de variables de entorno para el backend.

---

## 3. POLÍTICA DE AISLAMIENTO Y FRONTERAS DE CÓDIGO

```
+-----------------------------------------------------------------------------------+
|               BARRERAS ARQUITECTÓNICAS ESTRICTAS DEL MONOREPO                     |
+-----------------------------------------------------------------------------------+
| 1. apps/frontend NUNCA importa @prisma/client ni accede a la base de datos.       |
| 2. apps/frontend no conoce DATABASE_URL ni DIRECT_URL.                            |
| 3. Toda comunicación entre frontend y backend transcurre mediante HTTP REST       |
|    utilizando la biblioteca apiFetch (src/lib/api-client.ts).                     |
| 4. packages/shared y packages/validation son librerías portables sin efectos       |
|    secundarios en su inicialización.                                              |
+-----------------------------------------------------------------------------------+
```

---

## 4. SCRIPTS DE ORQUESTACIÓN RAÍZ

En el `package.json` raíz se configuran los scripts de control global:

- `pnpm dev`: Inicia en paralelo el backend y el frontend.
- `pnpm build`: Ejecuta secuencialmente la compilación de paquetes compartidos, generación de Prisma Client, compilación del backend y compilación del frontend.
- `pnpm typecheck`: Ejecuta `tsc --noEmit` en todos los workspaces para garantizar cero errores de tipos.
- `pnpm prisma:validate`: Valida la integridad sintáctica del esquema de Prisma.
- `pnpm prisma:generate`: Genera el cliente tipado de Prisma en `node_modules/@prisma/client`.
- `pnpm verify:infra`: Ejecuta la prueba automatizada de integridad de componentes.
