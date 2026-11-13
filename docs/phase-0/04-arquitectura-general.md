# DOCUMENTO 04: ARQUITECTURA GENERAL DEL SISTEMA
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. VISIÓN ARQUITECTÓNICA Y PRINCIPIOS DE DISEÑO

La arquitectura de **MexAgenda** adopta el patrón de **Monolito Modular Tipado de Alto Desempeño**, desacoplado físicamente en dos componentes de ejecución: un Frontend en Next.js y un Backend en NestJS, comunicados exclusivamente mediante una API REST protegida por TLS y políticas de seguridad estrictas.

```
+-----------------------------------------------------------------------------------+
|                        TOPOLOGÍA ARQUITECTÓNICA GLOBAL                            |
+-----------------------------------------------------------------------------------+
| CLIENTES WEB (PC / Mac / iPad / Móvil Android e iOS)                              |
|   └── Navegador Seguro (Chrome, Safari, Edge, Firefox) con HTTPS / TLS 1.3        |
+-----------------------------------------------------------------------------------+
                                    │
                                    ▼
+───────────────────────────────────────────────────────────────────────────────────+
| PERÍMETRO Y SEGURIDAD DE BORDE (EDGE LAYER)                                       |
| - Cloudflare / AWS CloudFront / Reverse Proxy NGINX                               |
| - Terminación TLS 1.3 / HSTS / Mitigación DDoS / WAF (Web Application Firewall)   |
| - CDN para activos estáticos de Next.js (_next/static, SVG, imágenes públicas)     |
+───────────────────────────────────────────────────────────────────────────────────+
            │                                             │
            ▼ (Rutas de UI / SSR)                         ▼ (Rutas de API REST /api/v1)
+────────────────────────────────────────+   +──────────────────────────────────────+
| FRONTEND APP (Next.js + TypeScript)    |   | BACKEND API (NestJS + TypeScript)    |
| - React 19 / Next.js App Router        |   | - Servidor Node.js / NestJS Modular  |
| - Tailwind CSS + Headless UI / Lucide  |   | - Pipes de Validación (class-valid.) |
| - SSR para Renderizado Seguro de Vistas|   | - Guards de Autenticación y RBAC     |
| - Client Components Interactivos       |   | - Interceptor de Auditoría Global    |
| - Cero conexión a Base de Datos        |   | - Lógica de Dominio y Transacciones  |
+────────────────────────────────────────+   +──────────────────────────────────────+
                    │                                             │
                    │ (Fetch interno / Proxied API)               │
                    └─────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴────────────────────────┐
          ▼                                                  ▼
+───────────────────────────────────+      +───────────────────────────────────+
| BASE DE DATOS TRANSACCIONAL       |      | ALMACENAMIENTO DE OBJETOS PRIVADO |
| - Neon PostgreSQL (Serverless)    |      | - S3-Compatible (AWS S3 / R2)     |
| - Connection Pooling (PgBouncer)  |      | - Cifrado del lado del servidor   |
| - Prisma ORM (Acceso tipado)      |      | - Acceso público 100% bloqueado   |
| - Triggers de Inmutabilidad Audit |      | - URLs pre-firmadas temporales    |
+───────────────────────────────────+      +───────────────────────────────────+
```

### Principios Rectores:
1. **Defensa en Profundidad (*Defense-in-Depth*):** Ningún componente confía ciegamente en otro. El frontend valida entradas para mejorar la UX, pero el backend valida de forma exhaustiva e inexorable cada parámetro, tipo, permiso y propiedad de negocio.
2. **Aislamiento de la Base de Datos:** El frontend Next.js **nunca** se conecta a PostgreSQL ni conoce la cadena de conexión de Neon. Todo acceso a datos es monopolizado por la capa de servicios de NestJS a través de Prisma.
3. **Inmutabilidad y Trazabilidad:** Las modificaciones a entidades críticas (anotaciones, minutas, acuerdos, permisos) no destruyen el estado previo; generan snapshots históricos y eventos sellados en la bitácora de auditoría.
4. **Desacoplamiento del Almacenamiento:** Ningún archivo binario se aloja en el sistema de archivos del servidor backend ni como columna BLOB en PostgreSQL. Todo se gestiona en almacenamiento de objetos S3 con acceso mediado por URLs pre-firmadas de vigencia efímera.

---

## 2. ARQUITECTURA DEL FRONTEND (NEXT.JS)

### 2.1. Pila Tecnológica
- **Framework:** Next.js (versión 15+ con App Router y React Server Components).
- **Lenguaje:** TypeScript (estricto).
- **Estilos:** Tailwind CSS con configuración de tokens semánticos institucionales (colores corporativos, espaciados y tipografía tipificada).
- **Componentes Base:** Arquitectura modular inspirada en Shadcn UI / Radix Primitives para máxima accesibilidad (ARIA) y ligereza.
- **Iconografía:** Lucide React (vectorial y con bajo peso de empaquetado).
- **Gestión de Estado y Servidor:** TanStack Query (React Query) para sincronización de caché en cliente, paginación y mutaciones optimistas.

### 2.2. Estructura de Directorios del Frontend (`apps/frontend/`)
```
apps/frontend/
├── src/
│   ├── app/                               # App Router de Next.js
│   │   ├── (auth)/                        # Grupo de rutas públicas/autenticación
│   │   │   ├── login/page.tsx
│   │   │   ├── mfa-challenge/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (dashboard)/                   # Grupo de rutas protegidas de la aplicación
│   │   │   ├── layout.tsx                 # Layout con Navbar, Sidebar y Session Guard
│   │   │   ├── page.tsx                   # Dashboard principal
│   │   │   ├── meetings/                  # Gestión de reuniones
│   │   │   │   ├── page.tsx               # Listado y buscador de reuniones
│   │   │   │   ├── new/page.tsx           # Creación de reunión
│   │   │   │   └── [id]/                  # Detalle integral de la reunión
│   │   │   │       ├── page.tsx           # Pestañas: Info, Minuta, Notas, Docs, Acuerdos
│   │   │   │       └── edit/page.tsx
│   │   │   ├── agreements/page.tsx        # Seguimiento general de acuerdos
│   │   │   ├── admin/                     # Módulos de administración (Admin Only)
│   │   │   │   ├── users/page.tsx         # Gestión de usuarios
│   │   │   │   ├── categories/page.tsx    # Gestión de taxonomías
│   │   │   │   └── audit/page.tsx         # Visualizador de auditoría
│   │   │   └── profile/page.tsx           # Perfil del usuario y configuración MFA
│   │   ├── api/                           # Route Handlers para BFF / Proxy seguro
│   │   ├── layout.tsx                     # Root Layout con fuentes y proveedores
│   │   └── globals.css                    # Directivas de Tailwind CSS
│   ├── components/                        # Componentes UI reutilizables
│   │   ├── ui/                            # Botones, modales, tablas, badges, inputs
│   │   ├── layout/                        # Sidebar, Navbar, MobileMenu, Breadcrumbs
│   │   ├── meetings/                      # Componentes de reunión, notas, acuerdos
│   │   └── security/                      # SessionTimeoutModal, MfaInput
│   ├── hooks/                             # Custom hooks (useAuth, useSessionTimeout)
│   ├── lib/                               # Clientes HTTP (Ky/Axios), utilerías de fecha
│   └── types/                             # Definiciones de tipos TypeScript de UI
```

### 2.3. Estrategia de Autenticación en Frontend
- El frontend gestiona la sesión mediante cookies seguras `HttpOnly`.
- Un `middleware.ts` en la raíz de Next.js intercepta todas las peticiones a rutas protegidas (`(dashboard)/*`):
  - Verifica la presencia de la cookie de sesión.
  - Valida el token o consulta un endpoint ligero `/api/v1/auth/me`.
  - Si no existe sesión válida o el usuario está inactivo, redirige de forma transparente a `/login`.
  - Si el usuario tiene sesión activa pero requiere completar el reto MFA, redirige forzosamente a `/mfa-challenge`.

---

## 3. ARQUITECTURA DEL BACKEND (NESTJS)

### 3.1. Pila Tecnológica
- **Framework:** NestJS (versión 10+ / 11).
- **Lenguaje:** TypeScript (estricto).
- **Motor HTTP:** Express o Fastify subyacente.
- **ORM / Acceso a Datos:** Prisma Client optimizado para PostgreSQL.
- **Seguridad Criptográfica:** `@node-rs/argon2` (implementación de alto rendimiento en Rust) y biblioteca estándar `crypto` de Node.js.
- **Validación y Transformación:** `class-validator` y `class-transformer` con `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.

### 3.2. Módulos del Backend (`apps/backend/src/`)
```
apps/backend/src/
├── app.module.ts                          # Módulo raíz de la aplicación
├── main.ts                                # Punto de entrada, bootstrap, middleware, CORS
├── common/                                # Componentes transversales
│   ├── decorators/                        # @CurrentUser(), @Roles(), @RequirePermissions()
│   ├── filters/                           # GlobalExceptionFilter (RFC 7807)
│   ├── guards/                            # AuthGuard, RolesGuard, PermissionsGuard
│   ├── interceptors/                      # AuditInterceptor, LoggingInterceptor, TransformInterceptor
│   └── pipes/                             # FileSignatureValidationPipe, SanitizeInputPipe
├── config/                                # Carga y validación tipada de variables de entorno
├── modules/                               # Módulos de dominio
│   ├── auth/                              # Autenticación, MFA, tokens, hashing Argon2id
│   ├── users/                             # CRUD usuarios, estados, contraseñas
│   ├── roles/                             # RBAC, asignación y consulta de permisos
│   ├── categories/                        # Taxonomía y ordenamiento de reuniones
│   ├── meetings/                          # Ciclo de vida de reuniones, participantes
│   ├── notes/                             # Anotaciones individuales, versionado, anti-IDOR
│   ├── agreements/                        # Acuerdos, compromisos y bitácora de avances
│   ├── attachments/                       # Carga documental, metadatos, pre-signed URLs
│   ├── audit/                             # Servicio e ingesta de logs de auditoría
│   └── dashboard/                         # Métricas agregadas y analítica institucional
└── providers/                             # Servicios de infraestructura
    ├── prisma/                            # PrismaModule y PrismaService con logging
    ├── storage/                           # StorageService (Adaptador S3 / AWS SDK v3)
    └── email/                             # Servicio de notificaciones institucionales
```

### 3.3. Pipeline de Procesamiento de una Petición HTTP en NestJS
```
[Petición Entrante HTTP]
         │
         ▼
[1. Helmet & CORS Middleware] ──> Valida orígenes permitidos y cabeceras de seguridad
         │
         ▼
[2. Logging & Tracing Interceptor] ──> Asigna `x-correlation-id` y registra inicio
         │
         ▼
[3. Global Auth Guard] ──> Extrae cookie de sesión, consulta `user_sessions` en caché/DB,
                           valida estado del usuario (rechaza INACTIVO/BLOQUEADO)
         │
         ▼
[4. Roles & Permissions Guard] ──> Comprueba si el usuario tiene los permisos requeridos
         │
         ▼
[5. Validation Pipe] ──> Sanitiza body/query, valida DTOs mediante class-validator
         │
         ▼
[6. Controlador (Controller)] ──> Despacha al método del servicio correspondiente
         │
         ▼
[7. Servicio de Negocio (Service)] ──> Ejecuta lógica, valida ownership (Anti-IDOR),
                                      abre transacción Prisma
         │
         ▼
[8. Audit Interceptor] ──> Captura resultado, calcula diff y persiste en `audit_logs`
         │
         ▼
[Respuesta HTTP 200/201] (o GlobalExceptionFilter si ocurrió un error)
```

---

## 4. ARQUITECTURA DE DATOS (NEON POSTGRESQL + PRISMA)

### 4.1. Neon PostgreSQL Serverless
- **Alojamiento:** Neon PostgreSQL, aprovechando su arquitectura desacoplada de cómputo y almacenamiento (*separation of compute and storage*).
- **Connection Pooling:** Uso del Connection Pooler integrado de Neon (basado en PgBouncer) para evitar el agotamiento de conexiones en escenarios concurrentes.
- **Ramas de Base de Datos (*Database Branching*):** Capacidad de crear copias instantáneas de datos aisladas (*branches*) para ambientes de staging, pruebas automatizadas y validación de migraciones sin impactar la base principal.

### 4.2. Estrategia con Prisma ORM
- **Tipado Integral de Extremo a Extremo:** Los esquemas definidos en `prisma/schema.prisma` generan los tipos exactos de TypeScript utilizados tanto por los servicios del backend como por los paquetes compartidos del monorepo.
- **Transacciones Interactivas:** Las operaciones complejas (ej. actualizar una reunión, registrar una versión de nota y crear el registro de auditoría) se ejecutan dentro de bloques `prisma.$transaction()` para garantizar atomicidad estricta (ACID).
- **Control de Concurrencia Optimista:** Tablas sujetas a edición colaborativa (`meetings`, `personal_notes`) incorporan un campo entero `version` que incrementa en cada actualización. Si dos usuarios intentan guardar simultáneamente, la cláusula `WHERE id = :id AND version = :currentVersion` previene la condición de carrera.

---

## 5. ARQUITECTURA DE ALMACENAMIENTO DE OBJETOS (COMPATIBLE CON S3)

```
+-----------------------------------------------------------------------------------+
|               FLUJO DE GESTIÓN DOCUMENTAL MEDIADO POR URLs PRE-FIRMADAS           |
+-----------------------------------------------------------------------------------+
| [1. NAVEGADOR]  ──> Solicita subir anexo (POST /attachments/upload-intent)        |
|                            │ (Envía: filename, mime_type, file_size, meeting_id)  |
|                            ▼                                                      |
| [2. BACKEND]    ──> Valida cuota, extensión, permisos de la reunión.              |
|                 ──> Genera S3 Pre-signed PUT URL con vigencia de 5 minutos.       |
|                 ──> Devuelve a navegador: { upload_url, attachment_id }           |
|                            │                                                      |
|                            ▼                                                      |
| [3. NAVEGADOR]  ──> Realiza PUT directo del archivo al Bucket S3 Privado           |
|                            │                                                      |
|                            ▼                                                      |
| [4. NAVEGADOR]  ──> Notifica confirmación (POST /attachments/:id/confirm-upload)  |
|                            │                                                      |
|                            ▼                                                      |
| [5. BACKEND]    ──> Lee primeros bytes desde S3, valida Magic Bytes con buffer.   |
|                 ──> Si es válido: marca attachment como CONFIRMADO y genera audit.|
|                 ──> Si es inválido: borra archivo de S3 y rechaza con alerta.     |
+-----------------------------------------------------------------------------------+
```

### Ventajas de este Diseño:
1. **Rendimiento:** El backend NestJS no sufre saturación de CPU ni memoria por transferencia de archivos grandes de 25 MB, ya que el binario fluye directamente desde el navegador al almacenamiento de objetos.
2. **Seguridad Absoluta:** El bucket S3 es 100% privado. Ningún archivo tiene acceso público.
3. **Descargas Seguras:** Para descargar, el navegador solicita un token al backend (`GET /attachments/:id/download-url`). El backend evalúa si el usuario activo tiene permiso para ver esa reunión y emite una S3 Pre-signed GET URL con vigencia de solo 10 minutos.

---

## 6. ESTRATEGIA DE RED, INFRAESTRUCTURA Y ENTORNOS

```
+-----------------------------------------------------------------------------------+
|                         MATRIZ DE ENTORNOS DE DESPLIEGUE                          |
+-------------------+--------------------+--------------------+---------------------+
| ATRIBUTO          | DESARROLLO (DEV)   | STAGING / QA       | PRODUCCIÓN (PROD)   |
+-------------------+--------------------+--------------------+---------------------+
| Dominio           | dev.mexagenda.org  | qa.mexagenda.org   | app.mexagenda.org   |
| Base de Datos     | Neon Branch 'dev'  | Neon Branch 'qa'   | Neon Primary (Main) |
| Almacenamiento S3 | Bucket dev-vault   | Bucket qa-vault    | Bucket prod-vault   |
| Modo de Errores   | Stacktrace visible | Mensajes depurados | RFC 7807 sin stack  |
| Cifrado de Datos  | Llaves locales     | KMS Staging        | KMS Producción      |
| MFA               | Requerido          | Requerido          | Requerido estricto  |
| Auditoría         | Ingesta activa     | Ingesta activa     | Ingesta sellada     |
+-------------------+--------------------+--------------------+---------------------+
```

### Configuración de Red:
- El backend y la base de datos se comunican mediante túneles seguros con TLS forzado (`sslmode=require`).
- **CORS Configurado de Forma Restrictiva:**
  `origin: ['https://app.mexagenda.org']`, `credentials: true`, `methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']`, `allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id']`.
  Se prohíbe terminantemente el uso de comodines (`*`) en `Access-Control-Allow-Origin` cuando se emplean credenciales.

