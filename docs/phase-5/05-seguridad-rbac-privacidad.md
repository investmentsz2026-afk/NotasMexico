# SEGURIDAD, RBAC Y PRIVACIDAD DE DATOS — MOD-04
## MexAgenda: Anotaciones Personales y Notas de Sesión

### 1. MARCO NORMATIVO Y PRINCIPIOS DE PROTECCIÓN

El módulo **MOD-04** ha sido diseñado bajo los principios de protección de datos personales y secrecía de deliberaciones preparatorias, en congruencia con la **Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados (LGPDPPSO)** y la normativa de transparencia aplicable a la administración pública en México.

Las notas de trabajo y observaciones individuales de los servidores públicos gozan de presunción de privacidad institucional hasta en tanto no sean expresamente publicadas o formalizadas en acuerdos o dictámenes colegiados.

---

### 2. MATRIZ DE PERMISOS GRANULARES (RBAC)

Se crearon e integraron en la base de datos Neon PostgreSQL 8 permisos granulares específicos para el recurso `personal_notes`:

| Código del Permiso | Recurso | Acción | Descripción Institucional | `ROLE_USER` | `ROLE_ADMIN` |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `note:read` | `personal_notes` | `read` | Consultar catálogo de anotaciones y notas institucionales. | **SÍ** | **SÍ** |
| `note:create` | `personal_notes` | `create` | Redactar y registrar notas personales o de sesión propias. | **SÍ** | **SÍ** |
| `note:update_own` | `personal_notes` | `update_own` | Modificar exclusivamente anotaciones propias. | **SÍ** | **SÍ** |
| `note:delete_own` | `personal_notes` | `delete_own` | Archivar o eliminar anotaciones propias. | **SÍ** | **SÍ** |
| `note:history:read`| `personal_notes` | `history_read`| Consultar historial de versiones de anotaciones accesibles. | **SÍ** | **SÍ** |
| `note:visibility:manage`| `personal_notes` | `visibility_manage`| Configurar nivel de visibilidad (Privada, Reunión, Pública). | **SÍ** | **SÍ** |
| `note:override_any`| `personal_notes` | `override_any`| Intervención administrativa extraordinaria justificada. | **NO** | **SÍ** |
| `note:admin:read` | `personal_notes` | `admin_read` | Auditoría administrativa de notas institucionales. | **NO** | **SÍ** |

---

### 3. MECANISMOS DE DEFENSA ANTI-IDOR / ANTI-BOLA

La arquitectura de seguridad implementa controles rigurosos para erradicar las vulnerabilidades IDOR (Insecure Direct Object Reference) y BOLA (Broken Object Level Authorization):

```
                                  Petición Entrante (PUT /notes/:id)
                                                  |
                                                  v
                                      +-----------------------+
                                      |   SessionAuthGuard    | ---> Valida cookie __Host-session en Neon
                                      +-----------------------+
                                                  |
                                                  v
                                      +-----------------------+
                                      |   PermissionsGuard    | ---> Valida permiso 'note:update_own'
                                      +-----------------------+
                                                  |
                                                  v
                                      +-----------------------+
                                      |     NotesService      |
                                      +-----------------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
             ¿note.authorId === user.id?                      ¿note.authorId !== user.id?
                         |                                                 |
                         v                                                 v
             +-----------------------+                         +-----------------------+
             |   Permitir Mutación   |                         |   Bloqueo Inmediato   |
             | - Genera snapshot v(N)|                         | - 403 Forbidden       |
             | - Avanza a v(N+1)     |                         | - AuditLog: DENIED    |
             | - AuditLog: SUCCESS   |                         | - Evento: UNAUTHORIZED|
             +-----------------------+                         +-----------------------+
```

1. **Inyección Inmutable de Autor:** El campo `authorId` jamás se acepta desde el cliente HTTP. Se obtiene de manera forzosa desde la entidad `User` vinculada a la sesión criptográficamente validada.
2. **Aislamiento en Consultas Multiusuario:**
   - Si el usuario es `ROLE_USER`, la consulta SQL en Prisma inyecta forzosamente la condición:
     `OR: [{ authorId: user.id }, { visibility: 'PUBLICA' }, { visibility: 'REUNION' }]`.
   - Una anotación `PRIVADA` de otro usuario es completamente invisible e inaccesible.
3. **Registro Forense de Ataques:** Cualquier intento de mutación cruzada registra de inmediato en `audit_logs`:
   ```json
   {
     "action": "UNAUTHORIZED_NOTE_MUTATION_ATTEMPT",
     "entity": "PersonalNote",
     "entityId": "uuid-objetivo",
     "actorId": "uuid-atacante",
     "outcome": "DENIED",
     "diffPayload": {
       "motivo": "Intento de modificación de nota ajena sin intervención administrativa",
       "targetAuthorId": "uuid-autor-real",
       "attackerId": "uuid-atacante"
     }
   }
   ```

---

### 4. PROTOCOLO DE INTERVENCIÓN ADMINISTRATIVA EXTRAORDINARIA

Para evitar la impunidad administrativa y preservar la transparencia institucional, la intervención sobre una anotación por parte de un administrador requiere el cumplimiento de las siguientes condiciones concurrentes:

1. **Permiso Explícito:** El operador debe poseer el permiso `note:override_any`.
2. **Justificación Sustantiva Obligatoria:** El campo `adminJustification` debe contar con un mínimo de 15 caracteres explicativos. Justificaciones vacías, genéricas o insuficientes son rechazadas con error HTTP `400 Bad Request`.
3. **Snapshot Histórico Inmutable:** El sistema guarda una copia fiel del estado anterior en `personal_note_versions` con el campo `isAdminIntervention = true`.
4. **Marca Indeble:** La nota se marca con `isAdminModified = true` y `lastAdminIntervenorId = user.id`.
5. **Auditoría de Máxima Severidad:** Se genera un asiento en `audit_logs` con `action: 'NOTE_ADMIN_OVERRIDE'` y `severidad: 'CRITICAL'`.

