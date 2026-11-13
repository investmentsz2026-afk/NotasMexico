# DOCUMENTO 11: POLÍTICA DE SEGURIDAD Y PROTECCIÓN DE DATOS
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. MARCO DE CIBERSEGURIDAD Y DEFENSA EN PROFUNDIDAD

La seguridad de **MexAgenda** se estructura bajo el estándar internacional **OWASP Application Security Verification Standard (ASVS) Nivel 2**, diseñado para salvaguardar información institucional clasificada, minutas de deliberación privada y datos personales contra amenazas avanzadas internas y externas.

```
+-----------------------------------------------------------------------------------+
|               ARQUITECTURA DE SEGURIDAD EN CAPAS (DEFENSE IN DEPTH)               |
+-----------------------------------------------------------------------------------+
| 1. CAPA DE BORDE (EDGE)    | WAF, TLS 1.3 Forzado, HSTS, Rate Limiting por IP     |
| 2. CAPA DE APLICACIÓN      | Helmet, CORS Restrictivo, Sanitización DTO, Anti-CSRF|
| 3. CAPA DE AUTORIZACIÓN    | RBAC Granular + ABAC (Soberanía Anti-IDOR en Backend)|
| 4. CAPA DE CRIPTOGRAFÍA    | Argon2id (RFC 9106), TOTP (RFC 6238), AES-256-GCM     |
| 5. CAPA DE PERSISTENCIA    | Neon Cifrado en Reposo, Pooler Seguro, Triggers Audit|
| 6. CAPA DE ARCHIVOS        | S3 Privado, URLs Pre-firmadas efímeras, Magic Bytes   |
| 7. CAPA DE CUMPLIMIENTO    | LFPDPPP / LGPDPPSO (México), Derechos ARCO, Trazabilidad|
+-----------------------------------------------------------------------------------+
```

---

## 2. ANÁLISIS DE AMENAZAS Y MITIGACIONES OWASP (WEB & API TOP 10)

### 2.1. Mitigación contra BOLA / IDOR (Broken Object Level Authorization)
- **Riesgo:** Un consejero malicioso o atacante altera el identificador de una anotación (`PUT /api/v1/notes/:id`) o documento para modificar o borrar el registro de otro integrante.
- **Mitigación Arquitectónica:**
  - El backend **nunca** confía en que el usuario tiene derecho sobre el recurso solo por estar autenticado.
  - Se implementa verificación de dominio estricta en el servicio: `if (note.authorId !== session.userId) throw new ForbiddenException()`.
  - La única excepción es la intervención administrativa formal, la cual exige el rol `ROLE_ADMIN`, justificación obligatoria y generación de auditoría crítica.

### 2.2. Mitigación contra Autenticación Rota (Broken Authentication)
- **Riesgo:** Ataques de diccionario, fuerza bruta, secuestro de sesión (*session hijacking*) o reutilización de credenciales vulneradas.
- **Mitigación:**
  - **Argon2id:** Algoritmo resistente a GPUs y ASICs (memoria: 64 MB, iteraciones: 3, paralelismo: 4).
  - **MFA / TOTP Obligatorio:** Segundo factor basado en tiempo con secretos cifrados en reposo mediante AES-256-GCM.
  - **Bloqueo Progresivo:** Bloqueo temporal de cuenta de 20 minutos tras 5 fallos consecutivos en 15 minutos.
  - **Expiración de Sesión:** Inactividad de 30 minutos y vida máxima de 8 horas.
  - **Cookies Blindadas:** `__Host-` prefix, `HttpOnly`, `Secure`, `SameSite=Strict`.

### 2.3. Mitigación contra Inyección de Código (SQLi, NoSQLi, XSS)
- **SQL Injection:** El uso exclusivo de **Prisma ORM** garantiza consultas 100% parametrizadas en PostgreSQL, eliminando la concatenación manual de cadenas SQL.
- **Cross-Site Scripting (XSS):**
  - Next.js escapa de forma nativa todo contenido renderizado en JSX.
  - Las notas enriquecidas en Markdown se procesan mediante un pipeline sanitizador (`rehype-sanitize`) que elimina etiquetas `<script>`, `<iframe>`, `onload`, `onerror` y protocolos peligrosos (`javascript:`).
  - Encabezado `Content-Security-Policy (CSP)` estricto que prohíbe scripts externos no autorizados.

### 2.4. Mitigación contra Manipulación Masiva de Propiedades (Mass Assignment)
- **Riesgo:** Envío de campos privilegiados en payloads (ej. `{ "role": "ROLE_ADMIN" }` o `{ "author_id": "victima" }`).
- **Mitigación:**
  - `ValidationPipe` global en NestJS configurado con:
    ```typescript
    new ValidationPipe({
      whitelist: true,              // Descarta propiedades no declaradas en DTO
      forbidNonWhitelisted: true,    // Lanza excepción si se envían campos extras
      transform: true,
    })
    ```
  - Todos los DTOs definen con precisión los tipos y decoradores (`@IsString()`, `@IsUUID()`, `@MaxLength()`).

### 2.5. Mitigación contra Carga de Archivos Maliciosos (Malicious File Upload)
- **Riesgo:** Carga de ejecutables (.exe, .sh), scripts o exploits dentro de archivos que simulan ser PDFs.
- **Mitigación:**
  - Inspección de **Magic Bytes** binarios (no se confía en la extensión ni en el MIME declarado por el cliente).
  - Aislamiento en bucket S3 privado; los archivos nunca se ejecutan en el servidor web.
  - Nombre aleatorio UUID en el almacenamiento físico para prevenir ataques de Directory Traversal (`../../etc/passwd`).

---

## 3. ESPECIFICACIÓN CRIPTOGRÁFICA Y GESTIÓN DE SECRETOS

| Elemento Criptográfico | Estándar / Algoritmo | Parámetros Técnicos | Justificación |
|---|---|---|---|
| **Hash de Contraseñas** | Argon2id | RFC 9106 (m=65536, t=3, p=4) | Estándar de oro de OWASP; inmune a ataques con matrices aceleradas. |
| **Segundo Factor (MFA)** | TOTP (RFC 6238) | SHA-1 / SHA-256, 6 dígitos, periodo 30s | Compatibilidad universal con Google/Microsoft Authenticator. |
| **Cifrado de Secretos en BD** | AES-256-GCM | Vector de Inicialización (IV) de 96 bits | Cifrado autenticado que garantiza confidencialidad e integridad. |
| **Integridad Documental** | SHA-256 | Digest binario de 256 bits | Verificación de que los archivos no fueron alterados en reposo. |
| **Cifrado en Tránsito** | TLS 1.3 | ECDHE-RSA-AES256-GCM-SHA384 | Máxima velocidad de enlace y confidencialidad hacia adelante (*Forward Secrecy*). |

---

## 4. PROTECCIÓN DE DATOS PERSONALES EN MÉXICO (LFPDPPP / LGPDPPSO)

### 4.1. Ámbito de Aplicación Legal
Dependiendo de la naturaleza jurídica de la entidad usuaria:
- **Sector Privado (Empresas, Asociaciones Civiles, Fideicomisos):** Sujeto a la *Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)* y su Reglamento.
- **Sector Público (Organismos Autónomos, Dependencias, Descentralizados):** Sujeto a la *Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados (LGPDPPSO)*.

### 4.2. Principios y Deberes Legales Instrumentados Técnicamente:

1. **Principio de Licitud y Finalidad:** Los datos recabados (nombres, cargos, correos, asistencias y votos) se procesan estrictamente para la gobernanza institucional y el cumplimiento de acuerdos.
2. **Principio de Proporcionalidad y Calidad:** Se prohíbe solicitar o registrar datos personales sensibles no estrictamente indispensables (datos biométricos no requeridos, estado de salud o afiliaciones políticas/sindicales).
3. **Deber de Seguridad:** Adopción de medidas técnicas y administrativas equivalentes a las exigidas por el INAI para bases de datos de seguridad alta:
   - Cifrado robusto en tránsito y en reposo.
   - Perfiles de acceso diferenciados (RBAC/ABAC).
   - Trazabilidad y bitácoras inmutables de acceso y modificación.
4. **Deber de Confidencialidad:** Todos los integrantes con acceso a la plataforma están obligados a guardar estricta reserva de la información institucional deliberada. La plataforma muestra avisos legales de confidencialidad al ingreso.
5. **Procedimiento para el Ejercicio de Derechos ARCO:**
   - **Acceso:** El Administrador puede generar un extracto consolidado en PDF de toda la información y notas asociadas a un consejero.
   - **Rectificación:** Herramientas para actualizar de forma inmediata cargos, nombres o correos desactualizados.
   - **Cancelación:** En caso de baja o solicitud formal, se ejecuta el borrado lógico (*soft delete*) o disociación de la cuenta, manteniendo la integridad de las actas históricas en cumplimiento de deberes fiduciarios de conservación documental.
   - **Oposición:** Posibilidad de suspender el procesamiento activo de una cuenta.

> [!WARNING] **AVISO DE RESPONSABILIDAD LEGAL**  
> El presente diseño técnico proporciona los controles de ciberseguridad y gobernanza idóneos para facilitar el cumplimiento normativo mexicano; sin embargo, **no constituye asesoría legal vinculante**. La institución deberá someter las políticas de privacidad y reglamentos internos a revisión de su departamento jurídico u Oficial de Privacidad para adecuar el Aviso de Privacidad Institucional a su objeto social específico.

