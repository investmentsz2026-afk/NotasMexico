# DOCUMENTO 09: SEGURIDAD DE INFRAESTRUCTURA Y BLINDAJE TÉCNICO
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 1 — Infraestructura, Monorepo, Neon PostgreSQL y Prisma  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Implementado / En Verificación  

---

## 1. PRINCIPIO DE SEGURIDAD POR DISEÑO (*SECURITY BY DESIGN*)

La infraestructura técnica de **MexAgenda** implementa controles de ciberseguridad proactivos desde la Fase 1, sentando las bases para cumplir con el estándar **OWASP ASVS Nivel 2** y prevenir las vulnerabilidades más comunes en entornos institucionales.

```
+-----------------------------------------------------------------------------------+
|               CONTROLES DE CIBERSEGURIDAD EN INFRAESTRUCTURA (FASE 1)             |
+---------------------+-------------------------------------------------------------+
| CONTROL             | MECANISMO TÉCNICO IMPLEMENTADO                              |
+---------------------+-------------------------------------------------------------+
| Cero Secretos       | .gitignore integral, .env.example sin credenciales reales   |
| Prevención IDOR     | Backend valida ownership; Frontend desacoplado de Postgres  |
| Cabeceras HTTP      | Helmet (X-Frame-Options: DENY, X-Content-Type-Options: nosniff)|
| Política CORS       | Orígenes autorizados explícitos (FRONTEND_URL) con credenciales|
| Prevención Inyección| Prisma ORM con consultas 100% parametrizadas                |
| Mass Assignment     | ValidationPipe con whitelist: true y forbidNonWhitelisted   |
| Fuga de Información | GlobalExceptionFilter RFC 7807 (sin stack traces en prod)   |
| Diagnóstico Seguro  | Health check no expone credenciales ni datos de conexión    |
+---------------------+-------------------------------------------------------------+
```

---

## 2. BLINDAJE DE CABECERAS HTTP (HELMET Y NEXT.JS)

### 2.1. En Backend NestJS:
```typescript
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  }),
);
```

### 2.2. En Frontend Next.js (`next.config.ts`):
Se inyectan cabeceras estrictas en todas las rutas:
- `X-Frame-Options: DENY`: Mitiga ataques de Clickjacking impidiendo que la plataforma sea embebida en `<iframe>` externos.
- `X-Content-Type-Options: nosniff`: Evita la reinterpretación errónea de tipos MIME por parte del navegador.
- `Referrer-Policy: strict-origin-when-cross-origin`: Limita la exposición de URLs en solicitudes de origen cruzado.
- `Permissions-Policy`: Deshabilita explícitamente el acceso a cámara, micrófono y geolocalización.

---

## 3. AISLAMIENTO TOTAL DE LA BASE DE DATOS

> **Regla de Oro Institucional:**  
> El Frontend Next.js **NUNCA** se conecta a PostgreSQL ni aloja dependencias de `@prisma/client`.

- Si un atacante comprometiera el código del frontend o inspeccionara los paquetes compilados en el cliente, no encontrará cadenas de conexión, contraseñas de PostgreSQL ni endpoints directos a la base de datos.
- Toda operación de datos transita inexorablemente por el Backend NestJS, donde se evalúan las guardias de seguridad, validaciones de DTO y políticas de auditoría.

---

## 4. SANITIZACIÓN DE ERRORES Y DIAGNÓSTICOS SEGUROS

1. **RFC 7807 Problem Details:** La captura centralizada de errores en `GlobalExceptionFilter` intercepta cualquier fallo del sistema:
   - Errores de validación devuelven el listado de campos no válidos sin exponer la lógica interna.
   - Excepciones no controladas devuelven un mensaje genérico (*"Ha ocurrido un error inesperado en el servidor"*) y registran el stack trace exclusivamente en los logs internos del servidor.
2. **Health Check Público (`GET /api/v1/health`):**
   - No imprime variables de entorno.
   - No expone hosts, puertos ni usuarios de Neon PostgreSQL.
   - Informa únicamente si los servicios están operativos mediante estados controlados (`healthy`, `connected`, `disconnected`).
