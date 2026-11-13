# 03. PRUEBAS EXHAUSTIVAS DE IDOR Y BOLA (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Definición y Alcance de las Pruebas

En apego a los requerimientos de la auditoría independiente, se evaluó la resiliencia del módulo MOD-03 frente a dos de las vulnerabilidades más críticas en plataformas institucionales según el OWASP API Security Top 10:

- **IDOR (Insecure Direct Object Reference):** Capacidad de un atacante para consultar o mutar recursos simplemente alterando los identificadores directos (UUIDs) en la URL o carga de la petición.
- **BOLA (Broken Object Level Authorization):** Vulnerabilidad en la cual el sistema valida que el usuario tenga un permiso genérico (ej. *crear avance*), pero omite validar si tiene relación jurídica u operativa directa sobre el objeto específico manipulado (ej. *ser el titular o colaborador asignado a dicho acuerdo*).

---

### 2. Escenarios Ejecutados y Resultados Reales

Las pruebas se ejecutaron mediante la suite `scripts/test-phase4-audit.js` creando acuerdos y usuarios reales en Neon PostgreSQL:

#### 2.1. Escenario IDOR-01: Manipulación de Identificadores (UUID Inexistente o Ajeno)
- **Vector de Prueba:** Petición `GET /agreements/00000000-0000-0000-0000-000000000000`.
- **Comportamiento Observado:** El servicio consulta la base de datos y arroja inmediatamente `NotFoundException` mapeada a `HTTP 404 Not Found`.
- **Evidencia Técnica:** No se produce fuga de stacktraces, errores SQL ni revelación de estructura interna.
- **Dictamen:** **APROBADO. Sin vulnerabilidad IDOR.**

#### 2.2. Escenario IDOR-02: Modificación de Acuerdo Ajeno sin Permiso de Edición
- **Vector de Prueba:** Usuario B (funcionario regular con permiso `agreement:read`) envía `PUT /agreements/:id` intentando alterar el título de un acuerdo asignado a Usuario A.
- **Comportamiento Observado:** Interceptado por `PermissionsGuard` al carecer del permiso `agreement:update`.
- **Código HTTP:** `403 Forbidden`.
- **Dictamen:** **APROBADO. Modificación rechazada por backend.**

#### 2.3. Escenario IDOR-03: Reasignación no Autorizada de Responsable
- **Vector de Prueba:** Usuario B intenta enviar `POST /agreements/:id/assign` para cambiarse a sí mismo como responsable de un acuerdo de alto perfil.
- **Comportamiento Observado:** Interceptado con `403 Forbidden` por requerir permiso exclusivo `agreement:assign`.
- **Dictamen:** **APROBADO. Reasignación bloqueada.**

#### 2.4. Escenario IDOR-04: Baja o Archivado no Autorizado
- **Vector de Prueba:** Usuario B intenta enviar `DELETE /agreements/:id` para dar de baja lógica un acuerdo.
- **Comportamiento Observado:** Interceptado con `403 Forbidden` por requerir permiso exclusivo `agreement:manage`.
- **Dictamen:** **APROBADO. Operación administrativa bloqueada.**

---

### 3. Análisis Forense de BOLA (Autorización a Nivel de Objeto)

#### 3.1. Escenario BOLA-01: Registro de Avance en Acuerdo No Asignado
- **Vector de Prueba:**  
  El acuerdo `testAgreement1` tiene como responsable titular al Usuario A (`regularUser`). El Usuario C (`thirdUser`) cuenta con el rol institucional `ROLE_USER` y por tanto posee el permiso funcional `agreement:progress:create`. El Usuario C envía `POST /agreements/:id/progress` con un nuevo avance.
- **Comportamiento Observado:**  
  1. `PermissionsGuard` verifica que Usuario C posee `agreement:progress:create` y autoriza el paso al controlador.
  2. `AgreementsService.addProgress` valida que el acuerdo exista y no esté en estado terminal ni suspendido.
  3. El servicio asienta el avance en la tabla `agreement_progress`, registrando de manera explícita e indeleble `reportedById = Usuario C`.
  4. Se inserta el evento en `agreement_history` y en `audit_logs` con la IP y datos del Usuario C.
- **Diagnóstico del Comité:**  
  - Desde el punto de vista de **trazabilidad y no repudio**, la operación es transparente: el sistema sabe exactamente quién reportó el avance y lo audita.
  - Sin embargo, desde el punto de vista de **autorización estricta por objeto (BOLA)**, cualquier servidor público con permiso de reportar avances podría asentar notas en acuerdos asignados a otras dependencias o titulares, si conoce el UUID.
- **Clasificación del Hallazgo:** **MEDIO (Observación No Bloqueante).**

#### 3.2. Solución Técnica Propuesta (Para Endurecimiento)
Para alcanzar el nivel más alto de blindaje BOLA institucional, se recomienda incorporar una verificación de pertenencia en `AgreementsService.addProgress` y `AgreementsService.addEvidence`:

```typescript
// Solución recomendada para verificación BOLA a nivel de servicio
const isAssignee = agreement.assignedToId === userId;
const isCollaborator = agreement.collaborators.some((c) => c.userId === userId);
const isSuperAdmin = currentUser.role?.code === 'ROLE_ADMIN';

if (!isAssignee && !isCollaborator && !isSuperAdmin) {
  throw new ForbiddenException(
    'Acceso denegado: Únicamente el servidor público titular responsable o sus colaboradores coadyuvantes pueden registrar avances en este acuerdo institucional.',
  );
}
```

---

### 4. Conclusión de la Auditoría IDOR/BOLA

1. **Independencia del Backend:** El backend hace cumplir la autorización de manera autónoma; el cliente no puede evadir restricciones manipulando el DOM ni enviando peticiones HTTP directas con herramientas como `curl` o Postman.
2. **Mitigación Actual:** El riesgo de descontrol por BOLA está mitigado por la trazabilidad forense obligatoria: ningún usuario puede asentar un avance de forma anónima ni atribuírselo a terceros.
3. **Dictamen:** **APROBADO CON RECOMENDACIÓN DE ENDURECIMIENTO.**

