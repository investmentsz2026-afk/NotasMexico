# 09. MATRIZ DE HALLAZGOS Y PLAN DE REMEDIACIÓN TÉCNICA (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Criterios de Clasificación de Severidad

Los hallazgos del Comité de Auditoría Independiente se clasifican conforme a las mejores prácticas de ingeniería de software y seguridad (CVSS v3.1 / OWASP):

- **CRÍTICO:** Vulnerabilidad explotable remotamente, pérdida o corrupción de datos institucionales, omisión total de controles de acceso. **Bloqueante.**
- **ALTO:** Falla severa de seguridad, falta de consistencia transaccional o ruptura de reglas de negocio institucionales sin mitigación. **Bloqueante.**
- **MEDIO:** Desviación en autorizaciones a nivel de objeto o áreas de oportunidad en controles que cuentan con mitigación parcial o trazabilidad. **No bloqueante si existe mitigación comprobada.**
- **BAJO:** Mejoras de arquitectura, hardening preventivo de bases de datos o refinamientos de usabilidad. **No bloqueante.**
- **INFORMATIVO:** Observaciones técnicas positivas o decisiones de diseño destacadas.

---

### 2. Matriz Consolidada de Hallazgos

| ID | Severidad | Módulo / Componente | Descripción Resumida | Estado |
| :--- | :---: | :--- | :--- | :---: |
| **H-01** | **MEDIO** | Backend / Seguridad (BOLA) | Validación de titularidad a nivel de objeto en registro de avances y evidencias (`addProgress`, `addEvidence`). | Mitigado por trazabilidad / Recomendado endurecer |
| **H-02** | **BAJO** | Base de Datos (Neon) | Inmutabilidad de `agreement_history` asegurada por la aplicación, sin trigger nativo en PostgreSQL. | Estable / Recomendado para Fase 8 |
| **H-03** | **BAJO** | Frontend / Enrutamiento | Acciones del expediente concentradas en pestañas y modales de `/agreements/[id]` sin URLs profundas dedicadas. | Funcional / Sugerido query params |
| **H-04** | **INFORMATIVO** | Backend / Fechas | Implementación del helper `parseInstitutionalDate` previno con éxito errores de zona horaria y formatos mixtos. | Destacado |
| **H-05** | **INFORMATIVO** | Backend / Concurrencia | Rutina de reintento transaccional sobre folio (`P2002`) demostró cero colisiones en pruebas concurrentes. | Destacado |

---

### 3. Detalle de Hallazgos y Plan de Remediación

#### 3.1. Hallazgo H-01 (MEDIO): Verificación BOLA a Nivel de Objeto en Avances y Evidencias
- **Diagnóstico:**  
  Cualquier usuario con rol `ROLE_USER` posee el permiso funcional `agreement:progress:create`. El endpoint `POST /agreements/:id/progress` verifica este permiso, pero no comprueba si el usuario autenticado es el titular asignado (`assignedToId`) o uno de los colaboradores (`collaborators`) de ese acuerdo en particular.
- **Factor Mitigante Actual:**  
  El avance se asienta de forma obligatoria con el `reportedById` del usuario real en sesión, y la bitácora `agreement_history` y `audit_logs` graban indeleblemente su autoría e IP, impidiendo el anonimato o el repudio.
- **Plan de Remediación Recomendado (No bloqueante para Fase 4):**  
  Incorporar una validación explícita de pertenencia en `AgreementsService`:
  ```typescript
  // Remedición técnica recomendada para H-01
  const isAssignee = agreement.assignedToId === userId;
  const isCollaborator = agreement.collaborators.some((c) => c.userId === userId);
  const isAdmin = currentUser.role?.code === 'ROLE_ADMIN';

  if (!isAssignee && !isCollaborator && !isAdmin) {
    throw new ForbiddenException(
      'Solo el servidor público titular o los colaboradores designados pueden registrar avances o evidencias en este acuerdo.',
    );
  }
  ```

#### 3.2. Hallazgo H-02 (BAJO): Hardening de Inmutabilidad con Triggers en PostgreSQL
- **Diagnóstico:**  
  La inmutabilidad de `agreement_history` está garantizada al 100% en la API (no existen rutas ni controladores de mutación/borrado). Sin embargo, a nivel de motor PostgreSQL no existe un trigger que bloquee `UPDATE` o `DELETE` directos en consola de base de datos.
- **Plan de Remediación Recomendado (Fase 8):**  
  Desplegar una función PL/pgSQL y trigger `BEFORE UPDATE OR DELETE ON agreement_history` que arroje una excepción si un DBA intentara alterar un registro histórico.

#### 3.3. Hallazgo H-03 (BAJO): Soporte de Enlaces Profundos (*Deep-Linking*) en Expedientes
- **Diagnóstico:**  
  El expediente `/agreements/[id]` contiene pestañas reactivas para Información General, Avances, Colaboradores, Evidencias e Historial. Si bien esto proporciona una experiencia fluida sin recargas, no permite compartir enlaces que abran directamente la pestaña de "Historial" o "Avances".
- **Plan de Remediación Recomendado (Fase 8 / UX Polish):**  
  Sincronizar el estado de la pestaña con la URL mediante query params: `/agreements/[id]?tab=progress`.

---

### 4. Conclusión del Comité

Al no existir hallazgos de severidad **CRÍTICA** ni **ALTA**, y encontrándose el hallazgo **MEDIO** debidamente mitigado por el sistema de auditoría forense con trazabilidad de identidad, el Comité determina que **los hallazgos encontrados NO son bloqueantes** y no impiden la autorización formal de la Fase 5.

