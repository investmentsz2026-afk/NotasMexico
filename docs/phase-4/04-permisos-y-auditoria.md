# 04. MATRIZ DE PERMISOS (RBAC) Y TRAZABILIDAD DE AUDITORÍA (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Modelo de Control de Acceso Basado en Roles (RBAC)

MexAgenda implementa un control de acceso estricto, desacoplado y granular basado en roles y permisos institucionales. Ningún usuario puede invocar acciones operativas de mutación o lectura sensible sin contar con el permiso explícito en su perfil de sesión.

#### Flujo de Autorización en Backend:
1. `SessionAuthGuard`: Extrae la cookie criptográfica de sesión (`mexagenda_session`), comprueba su vigencia contra la tabla `sessions` en Neon PostgreSQL y asegura que el usuario no esté revocado ni expirado.
2. `PermissionsGuard`: Intercepta la petición, extrae los permisos requeridos mediante el metadato `@RequirePermissions(...)` y verifica si el usuario autenticado cuenta con los códigos autorizados.
3. Si la verificación falla, se emite inmediatamente un error `403 Forbidden` (`INSUFFICIENT_PERMISSIONS`) y se registra el intento no autorizado en la bitácora central de seguridad.

---

### 2. Matriz de Permisos del Módulo MOD-03

El módulo de Acuerdos Institucionales incorpora 13 permisos atómicos catalogados en la base de datos oficial Neon PostgreSQL:

| Código de Permiso | Recurso | Acción | Descripción Institucional |
| :--- | :--- | :--- | :--- |
| `agreement:read` | `agreements` | `read` | Consultar catálogo general, detalles de acuerdos y colaboradores vinculados |
| `agreement:create` | `agreements` | `create` | Registrar nuevos acuerdos institucionales colegiados |
| `agreement:update` | `agreements` | `update` | Modificar datos generales (título, descripción, fecha compromiso, prioridad) |
| `agreement:assign` | `agreements` | `assign` | Asignar y reasignar titulares responsables y agregar/remover colaboradores |
| `agreement:progress:create` | `agreements` | `progress_create` | Registrar avances porcentuales, notas de progreso y referencias de evidencia |
| `agreement:progress:read` | `agreements` | `progress_read` | Consultar la bitácora cronológica de avances de cumplimiento |
| `agreement:complete` | `agreements` | `complete` | Formalizar deliberadamente la culminación satisfactoria de un acuerdo |
| `agreement:suspend` | `agreements` | `suspend` | Suspender temporalmente la ejecución del acuerdo con fundamentación obligatoria |
| `agreement:cancel` | `agreements` | `cancel` | Cancelar formalmente y de manera definitiva un acuerdo con justificación |
| `agreement:reactivate` | `agreements` | `reactivate` | Reanudar la vigencia operativa de un acuerdo suspendido previamente |
| `agreement:history:read` | `agreements` | `history_read` | Consultar el expediente inmutable de auditoría y trazabilidad histórica |
| `agreement:report:read` | `agreements` | `report_read` | Visualizar tableros analíticos (dashboard) y reportes de cumplimiento |
| `agreement:manage` | `agreements` | `manage` | Administración técnica integral, archivo institucional y bajas lógicas |

---

### 3. Asignación Predeterminada por Roles

En el estado inicial de despliegue institucional, los roles del sistema cuentan con las siguientes facultades sobre MOD-03:

| Permiso | Administrador Institucional (`ROLE_ADMIN`) | Servidor Público / Usuario (`ROLE_USER`) |
| :--- | :---: | :---: |
| `agreement:read` | Sí | Sí (Propio y general) |
| `agreement:create` | Sí | No |
| `agreement:update` | Sí | No |
| `agreement:assign` | Sí | No |
| `agreement:progress:create` | Sí | Sí (En acuerdos asignados) |
| `agreement:progress:read` | Sí | Sí |
| `agreement:complete` | Sí | No |
| `agreement:suspend` | Sí | No |
| `agreement:cancel` | Sí | No |
| `agreement:reactivate` | Sí | No |
| `agreement:history:read` | Sí | Sí |
| `agreement:report:read` | Sí | Sí |
| `agreement:manage` | Sí | No |

---

### 4. Sistema Dual de Trazabilidad y Auditoría Forense

Toda mutación de estado en un acuerdo se registra de manera atómica e indivisible en dos niveles complementarios de fiscalización:

#### 4.1. Bitácora Específica del Acuerdo (`agreement_history`)
Es un log institucional append-only (solo inserción) vinculado directamente a la entidad `Agreement`. Almacena:
- `agreementId`: Identificador del acuerdo objeto de la acción.
- `action`: Tipo de evento formal (`CREACION`, `ACTUALIZACION`, `ASIGNACION`, `AVANCE`, `ESTADO_CUMPLIDO`, `ESTADO_SUSPENDIDO`, `ESTADO_REACTIVADO`, `ESTADO_CANCELADO`, `COLABORADOR_AGREGADO`, `COLABORADOR_REMOVIDO`, `EVIDENCIA_REGISTRADA`, `ARCHIVADO`).
- `fieldChanged`: Nombre del campo modificado (ej. `status`, `assignedToId`, `progressPercent`, `dueDate`).
- `oldValue`: Serialización JSON o textual del estado anterior.
- `newValue`: Serialización JSON o textual del nuevo estado adoptado.
- `changeReason`: Fundamentación formal obligatoria en suspensiones, cancelaciones, reasignaciones y decrementos de porcentaje.
- `changedById`: Servidor público que autorizó o ejecutó la acción.
- `createdAt`: Marca temporal inmutable generada por el motor de base de datos.

#### 4.2. Registro Centralizado de Seguridad (`audit_logs`)
Diseñado para la fiscalización del oficial de seguridad de la información (CISO) y auditores del órgano de control interno:
- `userId`: Usuario autenticado.
- `action`: Acción del sistema (ej. `AGREEMENT_STATUS_CHANGE`, `AGREEMENT_ASSIGNMENT`).
- `resource`: Entidad afectada (`agreements`).
- `resourceId`: UUID del acuerdo.
- `details`: Contexto complementario estructurado en JSON.
- `ipAddress`: Dirección IP de origen (con soporte IPv4 e IPv6 detrás de proxies).
- `userAgent`: Identificador del cliente de navegación o sistema consumidor.
- `createdAt`: Sello de tiempo con precisión de microsegundos.

---

### 5. Invariantes de Seguridad y No Repudio

1. **Inmutabilidad Absoluta del Histórico:**  
   No existen endpoints de actualización (`PUT`/`PATCH`) ni de eliminación (`DELETE`) para la entidad `AgreementHistory`. Ningún usuario del sistema, independientemente de su rol, puede alterar retrospectivamente una anotación de auditoría.
2. **Atomicidad Transaccional:**  
   La modificación del estado y la inserción del registro de auditoría ocurren bajo la misma transacción de Prisma (`tx`). Si la inserción del historial fallara, la actualización del acuerdo se revierte automáticamente (`ROLLBACK`).
3. **Indelebilidad de la Justificación:**  
   Toda acción crítica (cancelación, suspensión, reducción de porcentaje) valida a nivel de servicio que el campo `justification` cuente con al menos 5 caracteres válidos no vacíos antes de autorizar la transacción.

