# DOCUMENTO 04: CONFIGURACIÓN TÉCNICA DEL BACKEND (NESTJS)
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 1 — Infraestructura, Monorepo, Neon PostgreSQL y Prisma  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Implementado / En Verificación  

---

## 1. VISIÓN Y ARQUITECTURA DEL BACKEND

El backend de **MexAgenda** se implementa con **NestJS 11**, configurado para operar como una **API REST desacoplada, sin estado (stateless) y fuertemente tipada**. Es la única entidad del sistema autorizada para comunicarse con la base de datos Neon PostgreSQL y gestionar las credenciales de infraestructura.

---

## 2. PIPELINE DE ARRANQUE Y PROCESAMIENTO (`main.ts`)

En el arranque (`bootstrap`):
1. **Validación de Entorno (`loadAndValidateEnv`):** Carga y valida estrictamente las variables requeridas antes de inicializar cualquier módulo de NestJS. Si falta una variable crítica (como `DATABASE_URL` en producción), el proceso aborta con un mensaje de error legible sin exponer secretos.
2. **Helmet:** Inyección obligatoria de cabeceras de seguridad HTTP.
3. **CORS Restrictivo:** Solo se autorizan peticiones provenientes de `FRONTEND_URL` con soporte de credenciales seguras.
4. **Prefijo Global `/api/v1`:** Estandarización de rutas de API conforme a la especificación de Fase 0.
5. **Manejo Global de Excepciones (`GlobalExceptionFilter`):** Todas las respuestas de error se formatean bajo el estándar **RFC 7807 (Problem Details for HTTP APIs)**, redactando detalles internos en producción.
6. **Validación Global de DTOs (`ValidationPipe`):**
   - `whitelist: true`: Descarta propiedades no declaradas explícitamente en el DTO.
   - `forbidNonWhitelisted: true`: Lanza excepción si se envían propiedades no autorizadas (*Mass Assignment protection*).
   - `transform: true`: Convierte automáticamente payloads a instancias de clase.
7. **Documentación OpenAPI Swagger:** Montada automáticamente en `/api/docs`.

---

## 3. MÓDULO DE INFRAESTRUCTURA Y SALUD (`HealthModule`)

### Endpoint `GET /api/v1/health`:
- **Propósito:** Proporcionar diagnósticos del estado del backend y la disponibilidad de conexión a Neon PostgreSQL.
- **Formato de Respuesta (`HealthCheckResponse`):**
```json
{
  "status": "ok",
  "timestamp": "2026-11-04T21:50:00.000Z",
  "uptimeSeconds": 142,
  "environment": "development",
  "services": {
    "api": "healthy",
    "database": "connected"
  },
  "version": "1.0.0"
}
```
- **Seguridad en la Respuesta:**
  - El estado de la base de datos solo reporta valores discretos: `'connected'`, `'disconnected'` o `'not_configured'`.
  - **Bajo ninguna circunstancia** se exponen cadenas de conexión, nombres de hosts, puertos, credenciales ni trazas de error de base de datos en la respuesta HTTP.

---

## 4. INTEGRACIÓN DE PRISMA EN NESTJS (`PrismaService`)

El servicio `PrismaService` en `src/database/prisma.service.ts`:
- Extiende directamente `PrismaClient`.
- Implementa `OnModuleInit` y `OnModuleDestroy` para apertura y cierre limpio de conexiones.
- Si la variable `DATABASE_URL` no está definida, registra una advertencia (*warning*) y continúa operando para permitir diagnósticos y pruebas de infraestructura sin fallar el arranque completo.
- Implementa el método `checkConnection(): Promise<'connected' | 'disconnected' | 'not_configured'>` con un temporizador de seguridad de 2.5 segundos para evitar bloqueos del health check si PostgreSQL se encuentra temporalmente fuera de línea.
