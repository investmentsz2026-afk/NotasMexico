# 09. DELIMITACIÓN DE ALCANCE Y PENDIENTES PARA FASES POSTERIORES (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Respeto Estricto a la Delimitación por Fases

Conforme al mandamiento de ingeniería y las reglas innegociables establecidas para el proyecto MexAgenda, la **Fase 4 (MOD-03: Gestión, Asignación y Seguimiento de Acuerdos Institucionales)** ha sido implementada en su totalidad sin invadir los alcances correspondientes a fases subsiguientes.

A continuación se formaliza el inventario de funcionalidades deliberadamente reservadas para su desarrollo en los módulos especializados subsecuentes.

---

### 2. Matriz de Alcance y Deslinde Técnico

| Módulo / Fase Futura | Alcance Reservado | Estado Actual en Fase 4 |
| :--- | :--- | :--- |
| **FASE 5 (MOD-04): Anotaciones Personales y Notas Privadas** | Bloc de notas institucional privado para cada funcionario colegiado, apuntes confidenciales por punto de agenda y notas personales no visibles para el pleno. | **NO IMPLEMENTADO en Fase 4.** Los acuerdos son colegiados, públicos e institucionales. Se mantiene la estructura relacional lista para enlazar notas en Fase 5. |
| **FASE 6 (MOD-05): Bóveda de Almacenamiento Seguro (S3 / MinIO)** | Almacenamiento físico de archivos binarios (PDFs, escaneos, oficios firmados) cifrados en reposo (AES-256), con URLs pre-firmadas y cuotas por dependencia. | **EN FASE 4:** La tabla `agreement_evidences` almacena las referencias documentales institucionales (números de oficio, actas, decretos y URLs descriptivas). La carga física de binarios a buckets S3 se activará en Fase 6. |
| **FASE 7 (MOD-06): Notificaciones Automatizadas (SMTP y WebPush)** | Envío automático de correos electrónicos transaccionales al asignar acuerdos, recordatorios de alerta temprana (15 y 5 días antes del vencimiento) y avisos de reuniones. | **EN FASE 4:** Todo el seguimiento se realiza de manera centralizada en la plataforma web mediante las vistas `/agreements/assigned`, `/agreements/dashboard` y semáforo dinámico. El despachador de colas SMTP se integrará en Fase 7. |
| **FASE 8: Auditoría Integral y Despliegue a Producción** | Pruebas de estrés, auditoría de penetración externa (pentest), hardening de contenedores Docker y puesta en marcha definitiva. | **EN FASE 4:** Se realizaron pruebas automatizadas unitarias, de integración y de seguridad RBAC sobre Neon PostgreSQL con 100% de éxito. |

---

### 3. Puntos de Extensibilidad Preparados en Fase 4

1. **Entidad de Evidencias (`agreement_evidences`):**  
   El modelo relacional incluye campos preparados para recibir `fileId`, `storagePath`, `mimeType` y `fileSizeBytes` cuando el módulo de almacenamiento seguro (Fase 6) sea desplegado, garantizando una migración limpia sin alterar llaves foráneas.
2. **Eventos y Auditoría:**  
   Los eventos emitidos por `AgreementsService` (`agreement:created`, `agreement:assigned`, `agreement:status_changed`) ya registran la metadata requerida para ser consumidos por el futuro microservicio de notificaciones por correo (Fase 7).
3. **Mantenimiento de la Arquitectura Limpia:**  
   No existen dependencias circulares, llamadas fantasma ni acoplamientos a librerías de terceros inexistentes. El código compila limpiamente bajo `pnpm build` sin emitir advertencias de tipos en TypeScript.

