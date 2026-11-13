# DOCUMENTO 03: REQUISITOS NO FUNCIONALES Y ATRIBUTOS DE CALIDAD
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. INTRODUCCIÓN

Los requisitos no funcionales (RNF) definen las restricciones de ingeniería, estándares de calidad, parámetros de rendimiento y directrices de ciberseguridad que gobernarán el ciclo de vida del sistema. Están estructurados bajo el estándar internacional **ISO/IEC 25010 (System and Software Quality Requirements and Evaluation - SQuaRE)**.

---

## 2. MATRIZ DE REQUISITOS NO FUNCIONALES

```
+-----------------------------------------------------------------------------------+
|               ESTRUCTURA DE ATRIBUTOS DE CALIDAD (ISO/IEC 25010)                  |
+---------------------+---------------------+-------------------+-------------------+
| 1. SEGURIDAD        | 2. RENDIMIENTO      | 3. FIABILIDAD     | 4. USABILIDAD     |
| - OWASP ASVS L2     | - Latencia < 200ms  | - Uptime 99.9%    | - WCAG 2.1 AA     |
| - Argon2id / TOTP   | - SSR / FCP < 1.2s  | - RPO < 1 hora    | - Responsive total|
| - Cifrado en reposo | - Optimistic Lock   | - RTO < 4 horas   | - Cero fricción   |
+---------------------+---------------------+-------------------+-------------------+
| 5. MANTENIBILIDAD   | 6. ESCALABILIDAD    | 7. PORTABILIDAD   | 8. CUMPLIMIENTO   |
| - Monorepo tipado   | - Backend Stateless | - Navegadores Web | - LFPDPPP México  |
| - Cobertura > 85%   | - Neon Serverless   | - PWA Móvil/Tablet| - Trazabilidad    |
+---------------------+---------------------+-------------------+-------------------+
```

---

### 2.1. SEGURIDAD Y PRIVACIDAD DE LA INFORMACIÓN (RNF-SEC)

#### RNF-SEC-001: Nivel de Verificación de Seguridad (OWASP ASVS Nivel 2)
- El sistema cumplirá con los controles del **OWASP Application Security Verification Standard (ASVS) Nivel 2**, correspondiente a aplicaciones que gestionan transacciones comerciales críticas o información confidencial sensible.
- Ninguna vulnerabilidad catalogada en OWASP Top 10 (Web) ni OWASP API Security Top 10 será admitida en ambientes de despliegue.

#### RNF-SEC-002: Cifrado en Tránsito y Configuración TLS
- Todas las comunicaciones frontend-backend y backend-servicios externos se ejecutarán estrictamente sobre **HTTPS con TLS 1.3** (admitiendo TLS 1.2 como umbral mínimo).
- Se configurará **HSTS (HTTP Strict Transport Security)** con directiva `max-age=31536000; includeSubDomains; preload` para forzar conexiones seguras.
- Se inhabilitarán suites de cifrado débiles o deprecadas (RC4, 3DES, CBC).

#### RNF-SEC-003: Cifrado en Reposo (Data at Rest)
- Las bases de datos en Neon PostgreSQL utilizarán almacenamiento cifrado nativamente mediante AES-256.
- Los secretos de negocio (secretos TOTP MFA, tokens de recuperación y llaves de integración) serán cifrados a nivel de aplicación (*envelope encryption* o columna cifrada) mediante **AES-256-GCM** antes de ser persistidos.
- Los archivos en almacenamiento de objetos S3 contarán con cifrado obligatorio del lado del servidor (*Server-Side Encryption* SSE-S3 o SSE-KMS).

#### RNF-SEC-004: Políticas de Cookies y Mitigación CSRF
- Las cookies de sesión se emitirán con las directivas:
  - `HttpOnly`: Previene lectura y manipulación desde JavaScript del navegador (mitigando robo de sesión por XSS).
  - `Secure`: Solo transmisible por canal cifrado HTTPS.
  - `SameSite=Strict`: Evita el envío de cookies en solicitudes de origen cruzado, neutralizando ataques CSRF (*Cross-Site Request Forgery*).
  - Prefijo de cookie recomendado: `__Host-` para garantizar que no sea sobrescrita por subdominios y se vincule estrictamente al host emisor.

#### RNF-SEC-005: Cabeceras de Seguridad HTTP (Security Headers)
El backend NestJS (mediante Helmet) y el frontend Next.js inyectarán obligatoriamente en cada respuesta:
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-...'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; frame-ancestors 'none';
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

### 2.2. RENDIMIENTO Y EFICIENCIA (RNF-PERF)

#### RNF-PERF-001: Tiempos de Respuesta en API REST
- **Lecturas simples e indexadas:** El percentil 95 (P95) de las respuestas de lectura (ej. `GET /meetings`, `GET /notes`) no superará los **200 milisegundos**.
- **Escrituras y transacciones:** El P95 de operaciones de escritura (`POST /meetings`, `PUT /notes`) no superará los **400 milisegundos**, incluyendo la persistencia en base de datos y la emisión síncrona del registro de auditoría.
- **Generación de URLs pre-firmadas:** Menor a **150 milisegundos**.

#### RNF-PERF-002: Métricas de Carga Web (Core Web Vitals)
El frontend desarrollado en Next.js (utilizando SSR / Server Components en rutas estratégicas y client components interactivos) cumplirá con:
- **First Contentful Paint (FCP):** < 1.2 segundos en conexiones de banda ancha estándar.
- **Largest Contentful Paint (LCP):** < 2.0 segundos.
- **Cumulative Layout Shift (CLS):** < 0.05.
- **Interaction to Next Paint (INP):** < 150 milisegundos.

#### RNF-PERF-003: Concurrencia y Capacidad de Carga
- El sistema soportará de manera estable un mínimo de **100 usuarios activos simultáneos** operando durante sesiones en tiempo real (creación de notas, consulta simultánea de anexos PDF de hasta 25 MB y actualización de acuerdos) sin degradación de latencia superior al 15%.

---

### 2.3. FIABILIDAD, DISPONIBILIDAD Y RESILIENCIA (RNF-REL)

#### RNF-REL-001: Disponibilidad Operativa (Uptime)
- El sistema ofrecerá una disponibilidad mínima garantizada del **99.9%** en el horario operativo hábil institucional (07:00 a 22:00 horas, huso horario Ciudad de México, UTC-6).
- Las ventanas de mantenimiento preventivo se programarán fuera de dicho horario y con aviso previo en plataforma.

#### RNF-REL-002: Objetivos de Recuperación ante Desastres
- **Recovery Point Objective (RPO):** Menor a **1 hora** (pérdida máxima admisible de datos ante catástrofe mayor). En condiciones normales, el motor de replicación y WAL de Neon PostgreSQL reduce este umbral a minutos.
- **Recovery Time Objective (RTO):** Menor a **4 horas** para el restablecimiento completo del servicio en caso de fallo total de la infraestructura primaria.

#### RNF-REL-003: Degradación Elegante y Manejo de Errores
- En caso de indisponibilidad temporal del almacenamiento S3, la plataforma continuará permitiendo la consulta de minutas, notas y acuerdos, notificando al usuario de forma clara sobre la suspensión temporal del visor documental sin generar pantallas en blanco ni excepciones no controladas (*unhandled exceptions*).

---

### 2.4. MANTENIBILIDAD Y CALIDAD DEL SOFTWARE (RNF-MAINT)

#### RNF-MAINT-001: Arquitectura de Código y Tipado Estricto
- Implementación 100% en **TypeScript** con modo estricto (`"strict": true` en `tsconfig.json`).
- Prohibición del uso del tipo `any` sin justificación explícita documentada.
- Separación arquitectónica limpia en tres capas: Controladores / API, Servicios de Dominio / Lógica de Negocio, y Repositorios / Acceso a Datos (Prisma).

#### RNF-MAINT-002: Cobertura de Pruebas Automatizadas
- Cobertura de código mínima exigida en pipelines de CI/CD:
  - Pruebas unitarias en servicios de backend: **> 85%**.
  - Pruebas de integración sobre controladores y guardias de seguridad: **> 80%**.
  - Pruebas End-to-End (E2E) sobre los 10 flujos críticos de negocio: **100% de éxito**.

#### RNF-MAINT-003: Documentación y Versionado Semántico
- Los contratos de API estarán documentados automáticamente mediante **OpenAPI 3.0 (Swagger)** generado desde decoradores NestJS (`@ApiProperty`, `@ApiOperation`).
- El proyecto adoptará **Semantic Versioning (SemVer 2.0.0)** y **Conventional Commits** para el control de versiones.

---

### 2.5. USABILIDAD, ACCESIBILIDAD Y EXPERIENCIA DE USUARIO (RNF-UX)

#### RNF-UX-001: Accesibilidad Digital (WCAG 2.1 AA)
- La interfaz de usuario cumplirá con las pautas de accesibilidad **WCAG 2.1 nivel AA**.
- Contraste de texto mínimo de 4.5:1 respecto al fondo en texto regular y 3:1 en texto de gran tamaño.
- Soporte para navegación integral por teclado (tabulación lógica, indicadores de foco visibles y atajos para cierre de modales).

#### RNF-UX-002: Diseño Responsivo Adaptativo (Multi-Dispositivo)
- Interfaz gráfica fluida diseñada bajo la estrategia *Desktop-First with Mobile-Parity*:
  - Pantallas de escritorio / laptops (1920x1080, 1440x900, 1366x768).
  - Tabletas en orientación vertical y horizontal (iPad Pro 11"/12.9", Galaxy Tab, 768px a 1024px).
  - Teléfonos móviles inteligentes (360px a 430px de ancho).
- **Regla institucional:** Ninguna función operativa ni columna de información crítica será excluida en vistas móviles; los componentes se reordenarán mediante diseño adaptativo (carruseles táctiles, paneles plegables y acordeones).

---

### 2.6. CUMPLIMIENTO LEGAL Y NORMATIVO EN MÉXICO (RNF-LEGAL)

#### RNF-LEGAL-001: Cumplimiento de la Legislación Mexicana de Protección de Datos
- **Marco Regulatorio:**
  - *Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)* y su Reglamento (en caso de que la institución sea privada).
  - *Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados (LGPDPPSO)* (si la institución forma parte del sector público).
- **Principios de Protección Aplicados:**
  1. **Licitud y Consentimiento:** Todo usuario es enrolado bajo un propósito institucional legítimo.
  2. **Finalidad y Proporcionalidad:** Solo se recaban los datos estrictamente necesarios (Nombre, Correo Institucional, Cargo, Asistencia, Opiniones vertidas).
  3. **Seguridad y Confidencialidad:** Establecimiento de medidas de seguridad administrativas, físicas y técnicas (cifrado, perfiles de acceso y bitácoras de auditoría) para evitar daño, pérdida, alteración o uso indebido.
  4. **Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición):** El Administrador contará con herramientas operativas para extraer el expediente de datos de un usuario o rectificar sus campos a solicitud formal.
  5. **Aviso de Privacidad:** La plataforma presentará el Aviso de Privacidad Institucional en el primer inicio de sesión para aceptación expresa del usuario.

