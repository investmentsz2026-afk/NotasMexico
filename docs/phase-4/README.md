# FASE 4: GESTIÓN, ASIGNACIÓN Y SEGUIMIENTO DE ACUERDOS INSTITUCIONALES (MOD-03)
## Proyecto: MexAgenda — Sistema Privado de Gestión Institucional

### 1. Resumen Ejecutivo de la Fase 4

La **Fase 4 (MOD-03)** implementa de manera integral el subsistema de administración, asignación colegiada, cumplimiento, trazabilidad y fiscalización de los **Acuerdos Institucionales** adoptados en las reuniones y sesiones del órgano colegiado de MexAgenda.

Todo acuerdo institucional emana obligatoriamente de una sesión colegiada formalmente convocada y documentada (Fase 3: MOD-02), contando con un **folio institucional único e inmutable** (`ACU-[PREFIJO]-[AÑO]-[SECUENCIAL]`), vinculación explícita a puntos del orden del día y actas aprobadas, asignación granular de servidores públicos responsables y colaboradores coadyuvantes, registro acumulativo de avances cualitativos y cuantitativos (0% a 100%), una estricta máquina de estados finita protegida contra saltos arbitrarios, evidencias documentales y una bitácora inmutable append-only con sincronización forense centralizada.

### 2. Índice Documental de la Fase 4

| Documento | Descripción Técnica |
| :--- | :--- |
| [01-arquitectura-acuerdos.md](./01-arquitectura-acuerdos.md) | Arquitectura modular de backend y frontend, componentes y diseño. |
| [02-modelo-datos.md](./02-modelo-datos.md) | Modelo relacional en Neon PostgreSQL, tablas, llaves foráneas e índices. |
| [03-api-acuerdos.md](./03-api-acuerdos.md) | Catálogo exhaustivo de endpoints RESTful, DTOs, validaciones y contratos. |
| [04-permisos-y-auditoria.md](./04-permisos-y-auditoria.md) | Matriz RBAC de 13 permisos, guards y bitácora forense de auditoría. |
| [05-flujos-operativos.md](./05-flujos-operativos.md) | Flujos operativos de emisión, asignación, seguimiento y fiscalización. |
| [06-maquina-estados.md](./06-maquina-estados.md) | Autómata finito de estados (`PENDIENTE`, `EN_PROCESO`, `CUMPLIDO`, `VENCIDO`, `SUSPENDIDO`, `CANCELADO`). |
| [07-matriz-pruebas.md](./07-matriz-pruebas.md) | Evidencia y matriz de 29 pruebas automatizadas superadas al 100%. |
| [08-integracion-reuniones-actas.md](./08-integracion-reuniones-actas.md) | Interoperabilidad con MOD-02 (Reuniones, Agenda, Convocatorias y Actas). |
| [09-pendientes-fases-posteriores.md](./09-pendientes-fases-posteriores.md) | Delimitación estricta de alcance hacia Fases 5, 6 y 7. |
| [10-informe-final.md](./10-informe-final.md) | Dictamen técnico final de certificación de entrega de la Fase 4. |

### 3. Principios y Reglas Innegociables Cumplidas

1. **No Destructividad:** No se alteró ningún esquema ni dato previo; usuarios, sesiones, roles, reuniones y actas de Fases 1, 2 y 3 permanecen intactos.
2. **Generación Concurrente de Folios:** Se implementó una rutina transaccional con reintento automático y captura de código Prisma `P2002` que previene cualquier colisión en concurrencia.
3. **Regla de Oro Institucional de Cumplimiento:** Alcanzar el 100% de avance acumulado en seguimiento **NO** modifica automáticamente el estado a `CUMPLIDO`. El cumplimiento exige un acto formal y deliberado vía endpoint protegido `/complete` con registro del servidor autorizante.
4. **Semáforo Dinámico de Vencimiento:** Se evalúa en tiempo de cómputo y base de datos la condición `dueDate < hoy` para acuerdos no terminales, garantizando que el estado efectivo siempre refleje la realidad temporal institucional.
5. **Justificación Obligatoria en Cambios Críticos:** Toda reasignación de responsable, reducción en porcentaje de avance, suspensión temporal o cancelación definitiva exige obligatoriamente fundamentación textual indeleble.
6. **Trazabilidad Append-Only Inmutable:** La tabla `agreement_history` opera exclusivamente en modo inserción, registrando el valor anterior, el valor nuevo, el actor y el motivo formal.

