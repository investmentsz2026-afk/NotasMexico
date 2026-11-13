# DOCUMENTO 05: DIAGRAMAS DE ARQUITECTURA Y SECUENCIA
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. DIAGRAMA DE ARQUITECTURA GENERAL Y TOPOLOGÍA

El siguiente diagrama detalla la interacción entre los clientes, las capas de borde (*edge*), el servidor de frontend Next.js, el API backend en NestJS y los servicios de persistencia en Neon PostgreSQL y almacenamiento S3.

```mermaid
flowchart TD
    subgraph CLIENT_TIER["Capa de Clientes Institucionales"]
        UserBrowser["Navegador Usuario / Consejero<br/>(Escritorio / Tablet / Móvil)"]
        AdminBrowser["Navegador Administrador<br/>(Consola de Control)"]
    end

    subgraph EDGE_SECURITY["Capa de Seguridad de Borde (Edge / WAF / CDN)"]
        WAF["WAF & Reverse Proxy (Cloudflare / NGINX)<br/>- Terminación TLS 1.3 / HSTS<br/>- Mitigación DDoS / Rate Limiting IP<br/>- CDN para activos estáticos"]
    end

    subgraph FRONTEND_TIER["Capa de Frontend (Next.js App Router)"]
        NextServer["Servidor Web Next.js (Node.js)<br/>- Server Components (SSR)<br/>- Middleware de Sesión y Redirección<br/>- BFF Proxy a API"]
    end

    subgraph BACKEND_TIER["Capa de Aplicación y Dominio (NestJS REST API)"]
        NestApp["Servidor Backend NestJS"]
        Guards["Guardias de Seguridad<br/>- AuthGuard (Cookie / Session)<br/>- RolesGuard & PermissionsGuard<br/>- RateLimitGuard"]
        Modules["Módulos de Negocio<br/>- AuthModule (Argon2id, TOTP)<br/>- UsersModule & RolesModule<br/>- MeetingsModule<br/>- NotesModule (Soberanía y Versionado)<br/>- AgreementsModule<br/>- AttachmentsModule<br/>- AuditModule (Inmutable)"]
        AuditInterceptor["Interceptor de Auditoría Global<br/>(Captura síncrona de eventos y diffs)"]
    end

    subgraph PERSISTENCE_TIER["Capa de Persistencia y Almacenamiento"]
        NeonPooler["Neon Connection Pooler (PgBouncer)"]
        PostgresDB[("Neon PostgreSQL Serverless<br/>- Tablas de Negocio<br/>- Control de Concurrencia Optimista<br/>- Triggers de Protección Audit")]
        S3Storage[("Almacenamiento de Objetos S3 Privado<br/>- Cifrado en Reposo (AES-256)<br/>- URLs Pre-firmadas efímeras<br/>- Cero Acceso Público")]
    end

    UserBrowser -->|HTTPS / TLS 1.3| WAF
    AdminBrowser -->|HTTPS / TLS 1.3| WAF
    WAF -->|Rutas de Interfaz / Static| NextServer
    WAF -->|Rutas de API REST /api/v1| NestApp
    NextServer -->|Proxy API interno / Fetch con Cookie| NestApp

    NestApp --> Guards
    Guards --> Modules
    Modules --> AuditInterceptor
    Modules -->|Prisma Client (Pooling)| NeonPooler
    NeonPooler --> PostgresDB
    AuditInterceptor -->|Persistencia Síncrona| PostgresDB
    Modules -->|AWS SDK v3 (Pre-signed URLs / Metadatos)| S3Storage
    UserBrowser -.->|Upload directo PUT con URL pre-firmada| S3Storage
    UserBrowser -.->|Download directo GET con URL pre-firmada| S3Storage
```

---

## 2. FLUJO DE AUTENTICACIÓN, RETO MFA Y CREACIÓN DE SESIÓN

Secuencia paso a paso que describe la validación de credenciales con Argon2id, el desafío TOTP obligatorio y la emisión de cookies seguras con registro en `user_sessions`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario Institucional
    participant FE as Frontend (Next.js)
    participant BE as Backend (NestJS AuthModule)
    participant DB as Neon PostgreSQL
    participant AUD as AuditModule

    U->>FE: Ingresa correo y contraseña
    FE->>BE: POST /api/v1/auth/login { email, password }
    
    activate BE
    BE->>DB: SELECT * FROM users WHERE email = :email
    DB-->>BE: Retorna registro (o null)

    alt Usuario no existe o cuenta inactiva / bloqueada
        BE->>AUD: Registrar LOGIN_FAILED (Motivo genérico)
        BE-->>FE: HTTP 401 Unauthorized ("Credenciales no válidas")
    else Credenciales válidas
        BE->>BE: Verificar hash con Argon2id.verify(user.password_hash, password)
        alt Contraseña incorrecta
            BE->>DB: Incrementar login_attempts para usuario e IP
            BE->>AUD: Registrar LOGIN_FAILED
            BE-->>FE: HTTP 401 Unauthorized ("Credenciales no válidas")
        else Contraseña correcta
            BE->>DB: SELECT * FROM user_mfa WHERE user_id = :userId AND is_enabled = true
            DB-->>BE: Retorna configuración MFA
            
            alt MFA configurado y activo
                BE->>BE: Generar token temporal efímero (MFA_CHALLENGE_TOKEN, TTL: 5 min)
                BE-->>FE: HTTP 200 OK { mfa_required: true, mfa_token: "..." }
                FE->>U: Desplegar pantalla de Desafío TOTP (código de 6 dígitos)
                
                U->>FE: Ingresa código TOTP de Google/Microsoft Authenticator
                FE->>BE: POST /api/v1/auth/mfa/verify { mfa_token, totp_code }
                
                BE->>BE: Desencriptar secreto MFA (AES-256-GCM) y validar TOTP (ventana +-1)
                alt Código TOTP incorrecto
                    BE->>AUD: Registrar MFA_CHALLENGE_FAILED
                    BE-->>FE: HTTP 401 Unauthorized ("Código de verificación incorrecto")
                else Código TOTP válido
                    BE->>DB: INSERT INTO user_sessions (user_id, token_hash, ip, expires_at)
                    BE->>AUD: Registrar LOGIN_SUCCESS (Con MFA exitoso)
                    BE-->>FE: HTTP 200 OK + Set-Cookie: __Host-mexagenda_session=...; HttpOnly; Secure; SameSite=Strict
                    FE->>U: Redirigir al Dashboard principal
                end
            else MFA no enrolado (Primer ingreso)
                BE-->>FE: HTTP 200 OK { mfa_enrollment_required: true }
                FE->>U: Forzar pantalla de enrolamiento con Código QR y Backup Codes
            end
        end
    end
    deactivate BE
```

---

## 3. GESTIÓN DE ANOTACIONES INDIVIDUALES (SOBERANÍA Y CONTROL ANTI-IDOR)

Demostración del control de soberanía: el Consejero A actualiza su nota exitosamente con versionado automático, mientras que un intento del Consejero B de modificar la nota de A es bloqueado tajantemente por el backend.

```mermaid
sequenceDiagram
    autonumber
    actor A as Consejero A (Autor)
    actor B as Consejero B (Tercero)
    participant FE as Frontend (Next.js)
    participant BE as Backend (NestJS NotesModule)
    participant DB as Neon PostgreSQL
    participant AUD as AuditModule

    Note over A, FE: ESCENARIO 1: Modificación Legítima por el Autor Original
    A->>FE: Edita su propia anotación (Note #101) y hace clic en "Guardar"
    FE->>BE: PUT /api/v1/notes/101 { content: "Nuevo texto...", version: 1 } (Cookie Sesión A)
    activate BE
    BE->>DB: SELECT * FROM personal_notes WHERE id = '101'
    DB-->>BE: Retorna { id: 101, author_id: 'user_A', version: 1, content: "Texto previo..." }
    
    BE->>BE: Validar ownership: session.user_id ('user_A') == note.author_id ('user_A') -> AUTORIZADO
    BE->>BE: Validar concurrencia optimista: dto.version (1) == note.version (1) -> VÁLIDO
    
    BE->>DB: TRANSACTION INICIO
    BE->>DB: INSERT INTO personal_note_versions (note_id, version_number, content_snapshot, modified_by_id) VALUES (101, 1, 'Texto previo...', 'user_A')
    BE->>DB: UPDATE personal_notes SET content = 'Nuevo texto...', version = 2, updated_at = NOW() WHERE id = '101'
    BE->>AUD: Registrar NOTE_UPDATED { note_id: 101, actor: 'user_A', version: 2 }
    BE->>DB: TRANSACTION COMMIT
    
    BE-->>FE: HTTP 200 OK { id: 101, version: 2, content: "Nuevo texto..." }
    FE->>A: Muestra confirmación de actualización exitosa
    deactivate BE

    Note over B, FE: ESCENARIO 2: Intento Malicioso o Cruzado de Modificación (Anti-IDOR)
    B->>FE: Intenta enviar modificación a la nota de A (Note #101) manipulando la llamada
    FE->>BE: PUT /api/v1/notes/101 { content: "Texto alterado..." } (Cookie Sesión B)
    activate BE
    BE->>DB: SELECT * FROM personal_notes WHERE id = '101'
    DB-->>BE: Retorna { id: 101, author_id: 'user_A' }
    
    BE->>BE: Validar ownership: session.user_id ('user_B') != note.author_id ('user_A') -> RECHAZADO
    BE->>AUD: Registrar ALERTA_SEGURIDAD / PERMISSION_DENIED (Posible ataque IDOR sobre Note 101 por user_B)
    BE-->>FE: HTTP 403 Forbidden ("No cuenta con autorización para modificar esta anotación")
    FE->>B: Notifica error de permisos y bloquea la interfaz
    deactivate BE
```

---

## 4. INTERVENCIÓN ADMINISTRATIVA EXTRAORDINARIA CON TRAZABILIDAD

Flujo especial en el que un Administrador interviene sobre una nota ajena, obligando a ingresar una justificación institucional, archivando el texto original y generando una alerta de auditoría crítica.

```mermaid
sequenceDiagram
    autonumber
    actor ADM as Administrador Institucional
    participant FE as Frontend (Next.js)
    participant BE as Backend (NestJS NotesModule)
    participant DB as Neon PostgreSQL
    participant AUD as AuditModule

    ADM->>FE: Selecciona "Intervención Administrativa" en Anotación #101 (Autor: Consejero A)
    FE->>ADM: Solicita obligatoriamente: Nuevo Contenido y "Justificación Institucional / Motivo Legal"
    ADM->>FE: Envía nuevo contenido + justificación: "Corrección ordenada por Oficio Jurídico #089/2026"
    
    FE->>BE: PUT /api/v1/notes/101/admin-override { content: "...", justification: "..." } (Cookie Sesión Admin)
    activate BE
    BE->>BE: Validar rol: session.role == 'ADMINISTRADOR'
    BE->>BE: Validar que 'justification' no esté vacía (mínimo 15 caracteres)
    
    BE->>DB: SELECT * FROM personal_notes WHERE id = '101'
    DB-->>BE: Retorna { id: 101, author_id: 'user_A', content: "Contenido original...", version: 2 }
    
    BE->>DB: TRANSACTION INICIO
    BE->>DB: INSERT INTO personal_note_versions (note_id, version_number, content_snapshot, modified_by_id, change_reason, is_admin_intervention) VALUES (101, 2, 'Contenido original...', 'admin_ID', 'Corrección ordenada por Oficio...', true)
    BE->>DB: UPDATE personal_notes SET content = 'Nuevo contenido...', version = 3, is_admin_modified = true, last_admin_intervenor_id = 'admin_ID' WHERE id = '101'
    BE->>AUD: Registrar ADMIN_NOTE_OVERRIDE (Severidad: CRITICAL, Note: 101, Admin: admin_ID, Justificación: "...", Diff: {...})
    BE->>DB: TRANSACTION COMMIT
    
    BE-->>FE: HTTP 200 OK (Nota actualizada con marca de agua institucional)
    FE->>ADM: Confirmación y notificación de evento auditado
    deactivate BE
```

---

## 5. CICLO DE VIDA DE UNA REUNIÓN (DIAGRAMA DE ESTADOS)

```mermaid
stateDiagram-v2
    [*] --> PROGRAMADA: Creación / Convocatoria formal
    
    PROGRAMADA --> EN_DESARROLLO: Inicio formal de la sesión
    PROGRAMADA --> CANCELADA: Anulación por falta de quórum o fuerza mayor
    
    EN_DESARROLLO --> FINALIZADA: Conclusión formal de la sesión y firma de acuerdos
    
    FINALIZADA --> ARCHIVADA: Cierre del expediente documental y acta oficial
    CANCELADA --> ARCHIVADA: Registro en histórico
    
    ARCHIVADA --> [*]: Consulta histórica inmutable (Sólo lectura)
```

---

## 6. CICLO DE VIDA DE UN ACUERDO INSTITUCIONAL (DIAGRAMA DE ESTADOS)

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE: Registro del acuerdo en la reunión
    
    PENDIENTE --> EN_PROCESO: Asignado inicia gestiones / evidencias de avance
    PENDIENTE --> CANCELADA: Dejado sin efecto por el Consejo o Administrador
    
    EN_PROCESO --> COMPLETADO: Compromiso cumplido a cabalidad con entrega
    EN_PROCESO --> CANCELADA: Cancelado con justificación asentada
    
    COMPLETADO --> [*]: Registro formal de cumplimiento en expediente
    CANCELADA --> [*]: Registro con bitácora de cancelación
```

---

## 7. DEPENDENCIAS INTERNAS EN EL MONOREPO

```mermaid
graph LR
    subgraph APPS["Aplicaciones (Apps)"]
        Frontend["apps/frontend<br/>(Next.js 15 App Router)"]
        Backend["apps/backend<br/>(NestJS API Server)"]
    end

    subgraph PACKAGES["Paquetes Compartidos (Packages)"]
        SharedTypes["packages/shared-types<br/>- Interfaces y DTOs comunes<br/>- Enums (MeetingStatus, Roles)<br/>- Contratos de API"]
        ValidationRules["packages/validation<br/>- Esquemas Zod / class-validator<br/>- Expresiones regulares comunes"]
        Config["packages/config<br/>- Constantes del sistema<br/>- Códigos de error estandarizados"]
    end

    subgraph PRISMA_LAYER["Capa de Base de Datos"]
        PrismaSchema["prisma/schema.prisma<br/>- Definición única de entidades<br/>- Migraciones relacionales"]
        PrismaClient["@prisma/client<br/>(Tipos generados automáticamente)"]
    end

    PrismaSchema -->|prisma generate| PrismaClient
    PrismaClient --> SharedTypes
    SharedTypes --> Frontend
    SharedTypes --> Backend
    ValidationRules --> Frontend
    ValidationRules --> Backend
    Config --> Frontend
    Config --> Backend
    PrismaClient --> Backend
```

