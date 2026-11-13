# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 07
## PRUEBAS DE PENETRACIÓN CONTRA IDOR / BOLA (OWASP API1:2023)
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. OBJETIVO DE LAS PRUEBAS IDOR / BOLA

El riesgo **BOLA (Broken Object Level Authorization)** / **IDOR (Insecure Direct Object References)** es la vulnerabilidad número uno en APIs modernas (OWASP Top 10 API Security). Ocurre cuando un usuario autenticado puede acceder o manipular recursos de otro usuario simplemente conociendo o alterando el identificador del objeto en la URL.

Se diseñó una batería de pruebas de penetración cruzada utilizando dos identidades distintas creadas en Neon PostgreSQL:
- **Usuario A:** Usuario regular institucional (`ROLE_USER`), propietario legítimo del documento privado.
- **Usuario B:** Usuario regular institucional ajeno (`ROLE_USER`), sin relación con el documento ni los órganos colegiados del Usuario A.
- **Usuario Admin:** Administrador institucional (`ROLE_ADMIN`).

---

### 2. ESCENARIO DE PRUEBA: DOCUMENTO VINCULADO A NOTA PRIVADA

El Usuario A generó una nota de sesión privada (`visibility = 'PRIVADA'`) y adjuntó un documento confidencial (`doc_id_A = att_priv_001`).

A continuación, el Usuario B ejecutó los siguientes vectores de ataque contra el identificador `att_priv_001`:

#### Vector 1: Extracción de Metadatos (`GET /api/documents/:id`)
- **Petición del Usuario B:** `GET /api/documents/att_priv_001`
- **Comportamiento en Backend:**
  El método `findOne` en `documents.service.ts` ejecuta la regla de privacidad heredada:
  ```typescript
  if (doc.personalNote && doc.personalNote.visibility === 'PRIVADA') {
    if (doc.personalNote.userId !== user.id && user.role !== 'ROLE_ADMIN') {
      throw new ForbiddenException('No tiene permisos para acceder a este documento adjunto');
    }
  }
  ```
- **Resultado:** **HTTP 403 Forbidden** ("No tiene permisos para acceder a este documento adjunto").
- **Trazabilidad:** Se registró evento en `audit_logs` con `action = 'DOCUMENT_READ_ATTEMPT'`, `status = 'DENIED'`.

#### Vector 2: Generación Fraudulenta de URL de Descarga (`GET /api/documents/:id/download-url`)
- **Petición del Usuario B:** `GET /api/documents/att_priv_001/download-url`
- **Comportamiento en Backend:** Se evalúan las mismas reglas de control de acceso antes de invocar al storage driver.
- **Resultado:** **HTTP 403 Forbidden**. No se genera URL presignada ni firma temporal en ningún momento.

#### Vector 3: Modificación no Autorizada de Metadatos (`PATCH /api/documents/:id`)
- **Petición del Usuario B:**
  ```http
  PATCH /api/documents/att_priv_001
  Content-Type: application/json

  { "description": "Modificado por atacante" }
  ```
- **Comportamiento en Backend:** La función valida la propiedad del adjunto:
  ```typescript
  if (doc.uploadedById !== user.id && user.role !== 'ROLE_ADMIN') {
    throw new ForbiddenException('No tiene privilegios para modificar este documento.');
  }
  ```
- **Resultado:** **HTTP 403 Forbidden**. La descripción original permanece inalterada en Neon PostgreSQL.

#### Vector 4: Borrado no Autorizado (`DELETE /api/documents/:id`)
- **Petición del Usuario B:** `DELETE /api/documents/att_priv_001`
- **Resultado:** **HTTP 403 Forbidden**. El documento no sufre soft delete y su estado en base de datos permanece intacto.

#### Vector 5: Inyección de Nueva Versión Documental (`POST /api/documents/:id/versions`)
- **Petición del Usuario B:** Intento de cargar un archivo binario malicioso como versión `v2` del documento del Usuario A.
- **Resultado:** **HTTP 403 Forbidden**. Se bloquea la inserción en `attachment_versions` y el storage driver no almacena ningún binario nuevo.

---

### 3. RESUMEN DE LA MATRIZ DE PRUEBAS BOLA / IDOR

| Operación Evaluada | Identidad Solicitante | Resultado Esperado | Resultado Observado | Estado de Seguridad |
| :--- | :--- | :---: | :---: | :---: |
| Lectura de Metadatos | Usuario B (Ajeno) | 403 Prohibido | **403 Prohibido** | **PROTEGIDO** |
| Descarga de Archivo | Usuario B (Ajeno) | 403 Prohibido | **403 Prohibido** | **PROTEGIDO** |
| Edición de Metadatos | Usuario B (Ajeno) | 403 Prohibido | **403 Prohibido** | **PROTEGIDO** |
| Eliminación Lógica | Usuario B (Ajeno) | 403 Prohibido | **403 Prohibido** | **PROTEGIDO** |
| Carga de Versión | Usuario B (Ajeno) | 403 Prohibido | **403 Prohibido** | **PROTEGIDO** |
| Restauración Admin | Usuario B (Regular) | 403 Prohibido | **403 Prohibido** | **PROTEGIDO** |
| Descarga por Propietario| Usuario A (Dueño) | 200 OK + URL | **200 OK + URL** | **FUNCIONAL** |
| Descarga por Auditor | Admin (`ROLE_ADMIN`)| 200 OK + URL | **200 OK + URL** | **FUNCIONAL** |

**Conclusión:** El módulo MOD-05 demostró una resistencia efectiva contra vectores IDOR/BOLA entre usuarios de igual rango. No fue posible evadir los controles mediante manipulación de CUIDs o identificadores de ruta.

