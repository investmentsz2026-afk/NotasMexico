# AUDITORÍA DE VULNERABILIDADES IDOR / BOLA Y AISLAMIENTO — FASE 5
## Módulo MOD-04: Anotaciones Personales y Notas de Sesión

### 1. OBJETIVO Y METODOLOGÍA DE LAS PRUEBAS DE INTRUSIÓN

El Comité Auditor configuró un laboratorio de pruebas de penetración en caja gris utilizando dos identidades institucionales aisladas con rol operativo estándar (`ROLE_USER`):
- **Usuario A (`Mariana Zavala` / `auditor.autor.a@institucion.gob.mx`):** Servidora pública autora de notas confidenciales.
- **Usuario B (`Carlos Mendoza` / `auditor.tercero.b@institucion.gob.mx`):** Servidor público no autorizado utilizado como atacante simulado para evaluar vectores de elevación horizontal de privilegios (IDOR / BOLA).

Se ejecutaron pruebas negativas contra cada vector de ataque estipulado en el prompt maestro de auditoría.

---

### 2. MATRIZ DE VECTORES EVALUADOS Y COMPORTAMIENTO OBSERVADO

| # | Vector de Prueba Evaluado | Acción Ejecutada | Respuesta HTTP | Resultado de Auditoría |
| :-: | :--- | :--- | :---: | :---: |
| **1** | A crea sus propias anotaciones | `POST /notes` con credenciales de A. | **201 Created** | **APROBADO:** Nota creada con `authorId = A.id`, v1. |
| **2** | A edita sus propias anotaciones | `PUT /notes/:id` con credenciales de A. | **200 OK** | **APROBADO:** Nota actualizada, snapshot v1 creado, versión avanza a v2. |
| **3** | A (o B) intenta editar notas ajenas | B ejecuta `PUT /notes/:id` sobre la nota de A. | **403 Forbidden** | **APROBADO:** Bloqueo Anti-IDOR con mensaje explícito. Genera log `DENIED`. |
| **4** | B intenta archivar notas de A | B ejecuta `DELETE /notes/:id` sobre la nota de A. | **403 Forbidden** | **APROBADO:** Bloqueo de baja ajena. Registro `deletedAt` permanece intacto. |
| **5** | B intenta cambiar el propietario | B o A envían payload `{ authorId: 'otro-uuid' }`. | **201 / 200** | **APROBADO:** Inmunidad a Mass Assignment. El backend ignora `authorId` del payload. |
| **6** | B intenta intervenir administrativamente | B ejecuta `POST /notes/:id/intervene`. | **403 Forbidden** | **APROBADO:** Bloqueado por `PermissionsGuard` (falta `note:override_any`). |
| **7** | B accede a notas privadas de A | B ejecuta `GET /notes/:id` con UUID de nota privada de A. | **403 Forbidden** | **APROBADO:** Bloqueado con mensaje: *"Anotación de carácter estrictamente privado"*. |
| **8** | Fuga de información por búsquedas | B ejecuta `GET /notes?search=SECRET_FLAG`. | **200 OK (0 items)** | **APROBADO:** Las cláusulas `where` aíslan notas privadas ajenas del motor de búsqueda. |
| **9** | Fuga de información por filtros | B ejecuta `GET /notes?category=JURIDICO`. | **200 OK** | **APROBADO:** El listado omite por completo notas privadas de otros usuarios. |
| **10**| B consulta historial ajeno | B ejecuta `GET /notes/:id/versions` de nota privada de A. | **403 Forbidden** | **APROBADO:** `getVersions` invoca previamente `findById`, heredando el bloqueo. |
| **11**| B modifica visibilidad ajena | B ejecuta `PATCH /notes/:id` con `{ visibility: 'PUBLICA' }`.| **403 Forbidden** | **APROBADO:** Solo el autor o un administrador con override pueden alterar visibilidad. |
| **12**| Manipulación directa de UUID | Acceso con UUID inexistente o manipulado. | **404 Not Found** | **APROBADO:** Respuesta limpia RFC 7807 sin divulgar trazas de error internas. |

---

### 3. AUDITORÍA FORENSE DE LOS INTENTOS BLOQUEADOS

Se constató que cada intento de vulneración horizontal activa una respuesta defensiva en el `AuditService`:

```json
{
  "action": "UNAUTHORIZED_NOTE_MUTATION_ATTEMPT",
  "entity": "PersonalNote",
  "entityId": "eaf2fc60-7835-49fe-98d2-74166a9edbe5",
  "actorId": "9ef6a570-3498-4c07-b2fa-90812b3c4d5e",
  "ipAddress": "192.168.1.99",
  "userAgent": "PenTest-Agent/1.0",
  "outcome": "DENIED",
  "diffPayload": {
    "motivo": "Intento de modificación de nota ajena sin intervención administrativa",
    "targetAuthorId": "942fda50-2a8b-4390-b6df-a30810d2ecda",
    "attackerId": "9ef6a570-3498-4c07-b2fa-90812b3c4d5e"
  }
}
```

---

### 4. COHERENCIA DE CÓDIGOS DE ESTADO HTTP

El Comité Auditor comprobó que el backend distingue con precisión la semántica de errores de acceso:
- **`401 Unauthorized`:** Peticiones sin cookie de sesión o con sesión expirada/revocada en Neon.
- **`403 Forbidden`:** Peticiones autenticadas donde el usuario carece del permiso RBAC o de la titularidad de autoría sobre el objeto.
- **`404 Not Found`:** Notas con UUID inexistente o notas en papelera cuando el solicitante carece de privilegios para consultarlas.

---

### 5. CONCLUSIÓN DEL CAPÍTULO IDOR / BOLA

El módulo MOD-04 exhibe una arquitectura defensiva sólida contra ataques de objeto directo y elevación horizontal de privilegios. **No se detectó ninguna vulnerabilidad IDOR o BOLA en los 11 endpoints auditados.**

