# FASE 6: BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL

**Módulo:** MOD-05 — Bóveda Digital y Gestión Documental  
**Estado:** IMPLEMENTADA Y LISTA PARA AUDITORÍA INDEPENDIENTE  
**Base de Datos:** Neon PostgreSQL Serverless  
**Almacenamiento:** Compatible con AWS S3 (AWS S3 / Cloudflare R2 / MinIO / Local Sandbox HMAC)  
**Backend:** NestJS + AWS SDK v3 + Prisma ORM  
**Frontend:** Next.js 15 + TypeScript + Tailwind CSS  

---

### 1. PROPÓSITO DEL MÓDULO

El módulo **MOD-05 — Bóveda Digital y Gestión Documental** incorpora a MexAgenda la capacidad de almacenar, custodiar, versionar y descargar de forma criptográficamente segura archivos institucionales vinculados a las diferentes entidades del sistema:

- **Reuniones y Sesiones Colegiadas:** Anexos de convocatoria, presentaciones y material de trabajo.
- **Actas Oficiales:** Documentos oficiales aprobados con respaldo inmutable.
- **Acuerdos Institucionales:** Evidencias documentales y sustentos probatorios de cumplimiento.
- **Anotaciones Personales y de Sesión:** Archivos privados con herencia estricta de aislamiento Anti-IDOR.
- **Bóveda Institucional General:** Dictámenes, normatividad y documentación general.

---

### 2. ESTRUCTURA DOCUMENTAL DE LA FASE 6

| Archivo | Contenido Principal |
| :--- | :--- |
| [`00-diagnostico-arquitectura.md`](./00-diagnostico-arquitectura.md) | Diagnóstico inicial, componentes existentes, riesgos y plan de ejecución. |
| [`01-arquitectura-almacenamiento.md`](./01-arquitectura-almacenamiento.md) | Arquitectura del subsistema de almacenamiento, abstracción `StorageDriver`, soporte dual S3/Sandbox. |
| [`02-modelo-datos-y-migraciones.md`](./02-modelo-datos-y-migraciones.md) | Evolución no destructiva del esquema Prisma, migración SQL y relaciones en Neon PostgreSQL. |
| [`03-seguridad-carga-archivos.md`](./03-seguridad-carga-archivos.md) | Detección estricta de Magic Bytes, prevención de MIME Spoofing, límites de tamaño y hashing SHA-256. |
| [`04-seguridad-descargas-y-permisos.md`](./04-seguridad-descargas-y-permisos.md) | URLs presignadas con TTL de 300s, firmas temporales HMAC y prevención de descargas no autorizadas. |
| [`05-rbac-y-matriz-permisos.md`](./05-rbac-y-matriz-permisos.md) | Matriz RBAC para los 8 permisos `document:*`, asignaciones a `ROLE_ADMIN` y `ROLE_USER`. |
| [`06-api-backend.md`](./06-api-backend.md) | Especificación de endpoints RESTful, controladores NestJS, DTOs y respuestas normalizadas. |
| [`07-frontend-y-experiencia.md`](./07-frontend-y-experiencia.md) | Interfaz de usuario en `/vault` y `/vault/[id]`, navegación y modales de carga y versionado. |
| [`08-auditoria-e-historial.md`](./08-auditoria-e-historial.md) | Trazabilidad forense inmutable en `audit_logs` y versionado histórico en `attachment_versions`. |
| [`09-pruebas-funcionales.md`](./09-pruebas-funcionales.md) | Resultados de las pruebas funcionales automatizadas de carga, descarga y ciclo de vida. |
| [`10-pruebas-seguridad.md`](./10-pruebas-seguridad.md) | Pruebas de seguridad Anti-IDOR, Anti-Spoofing, Anti-Tampering y herencia de privacidad. |
| [`11-pruebas-responsive.md`](./11-pruebas-responsive.md) | Matriz de compatibilidad responsiva (320px, 768px, 1024px, 1440px). |
| [`12-hallazgos-y-limitaciones.md`](./12-hallazgos-y-limitaciones.md) | Registro de hallazgos, deuda técnica controlada y observaciones históricas conservadas. |
| [`13-dictamen-implementacion.md`](./13-dictamen-implementacion.md) | Dictamen técnico final: **IMPLEMENTADA Y LISTA PARA AUDITORÍA INDEPENDIENTE**. |

---

### 3. COMANDOS DE VERIFICACIÓN RÁPIDA

```bash
# Ejecutar suite de pruebas de Fase 6
pnpm test:phase6

# Ejecutar suite completa de regresión histórica
pnpm test:phase5-audit
pnpm test:phase5
pnpm test:phase4-audit
pnpm test:phase4
pnpm test:phase3-audit
pnpm test:phase3
pnpm test:phase2

# Compilación total del monorepo
pnpm build
```

