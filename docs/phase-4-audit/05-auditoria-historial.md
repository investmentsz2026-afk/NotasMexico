# 05. AUDITORÍA DE HISTORIAL Y TRAZABILIDAD APPEND-ONLY (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Sistema Dual de Registro Forense

El sistema MexAgenda implementa un mecanismo dual de auditoría para garantizar el principio institucional de **no repudio** e inalterabilidad de los acuerdos colegiados:

1. **Bitácora Específica del Acuerdo (`agreement_history`):**  
   Almacena la línea de tiempo de cada expediente institucional: quién creó el acuerdo, quién fue asignado, quiénes fungieron como colaboradores, cuándo se modificaron plazos, cuándo se asentaron avances y los motivos de suspensiones, reactivaciones o cancelaciones.
2. **Registro Forense Centralizado (`audit_logs`):**  
   Diseñado para el oficial de seguridad de la información (CISO) y los órganos de control interno. Captura IP de origen, User-Agent, sello de tiempo con microsegundos y contexto JSON de la operación.

---

### 2. Evidencia de Inmutabilidad y Sincronización Transaccional

A través de las pruebas `IMMUT-01` a `IMMUT-04` en Neon PostgreSQL, se certificó lo siguiente:

```
[Operación en AgreementsService]
             │
             ├──▶ prisma.$transaction(async (tx) => {
             │        tx.agreement.update(...)
             │        tx.agreementHistory.create(...)  <── Inserción atómica local
             │    })
             │
             └──▶ auditService.logEvent(...)          <── Sincronización forense central
```

#### 2.1. Cobertura de Eventos Auditados (`IMMUT-01`)
Se comprobó que el ciclo de vida del acuerdo `fsmAgreement` generó asientos históricos secuenciales e indelebles:
- `CREATION`: Asentó el creador, titular inicial y plazo.
- `PROGRESS_UPDATE`: Asentó el porcentaje anterior (0%), el nuevo (25%), el responsable y la narrativa.
- `PROGRESS_UPDATE`: Asentó el incremento al 100%.
- `SUSPENSION`: Asentó el cambio a `SUSPENDIDO` y la justificación obligatoria.
- `REACTIVATION`: Asentó el retorno a `EN_PROCESO` y el motivo formal.
- `COMPLETION_CONFIRMED`: Asentó el paso definitivo a `CUMPLIDO`, la autoridad certificadora y notas de resolución.

#### 2.2. Sincronización con `audit_logs` (`IMMUT-02`)
Se comprobó la existencia de eventos correlacionados en `audit_logs` con `entity = 'agreements'` y `entityId = fsmAgreement.id`, garantizando que toda mutación operativa tenga su contraparte forense para fiscalización externa.

---

### 3. Evaluación de Protección Append-Only: Aplicación vs Motor de Base de Datos

El comité evaluó rigurosamente si la inmutabilidad es efectiva en la práctica:

#### 3.1. Protección a Nivel de Aplicación y API (`IMMUT-03`)
- **Comprobación:** Se inspeccionó el prototipo de `AgreementsController` y `AgreementsService`.
- **Hallazgo:** **CERO RUTAS DE MUTACIÓN.** No existen métodos `updateHistory`, `deleteHistory`, `patchHistory` ni endpoints HTTP expuestos para alterar o purgar filas de `agreement_history`.
- **Resultado:** Ningún usuario o atacante a través de la web o de peticiones REST puede alterar el histórico.

#### 3.2. Evaluación a Nivel de Motor PostgreSQL (`IMMUT-04`)
- **Comprobación:** Se inspeccionó si la tabla `agreement_history` en Neon cuenta con un trigger o regla nativa en PostgreSQL que impida sentencias directas `UPDATE` o `DELETE` emitidas por conexiones SQL directas.
- **Hallazgo:** Actualmente la tabla no dispone de un trigger `BEFORE UPDATE OR DELETE` en PostgreSQL. La protección *append-only* recae en la capa de software y Prisma ORM.
- **Impacto y Severidad:** **BAJO (Observación No Bloqueante).** En el entorno de producción, las credenciales directas de Neon solo son accesibles por el pipeline de despliegue y no por los usuarios del sistema.
- **Recomendación de Hardening Técnico (Para Fase 8):**  
  Incorporar un trigger nativo en PostgreSQL para sellar la tabla a nivel de motor de datos:
  ```sql
  CREATE OR REPLACE FUNCTION prevent_agreement_history_mutation()
  RETURNS TRIGGER AS $$
  BEGIN
      RAISE EXCEPTION 'VIOLACIÓN INSTITUCIONAL: La tabla agreement_history es inmutable (append-only). No se permiten operaciones de UPDATE o DELETE.';
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_prevent_agreement_history_mutation
  BEFORE UPDATE OR DELETE ON agreement_history
  FOR EACH ROW EXECUTE FUNCTION prevent_agreement_history_mutation();
  ```

---

### 4. Dictamen de Historial y Trazabilidad

**APROBADO CON OBSERVACIÓN NO BLOQUEANTE.** La trazabilidad es integral, atómica y sincronizada en todas las operaciones del módulo MOD-03.

