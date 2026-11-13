# 01. ARQUITECTURA DE ACUERDOS INSTITUCIONALES (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Visión General de la Arquitectura

El módulo **MOD-03** ha sido diseñado bajo los principios de arquitectura limpia, desacoplamiento modular, seguridad por diseño y consistencia transaccional. Opera de manera coordinada entre el backend en NestJS y el frontend en Next.js 15:

```
+-------------------------------------------------------------------------+
|                          CLIENTE (NEXT.JS 15)                           |
|  - /agreements             : Catálogo institucional reactivo            |
|  - /agreements/new         : Registro colegiado con validaciones        |
|  - /agreements/[id]        : Expediente institucional (5 pestañas)      |
|  - /agreements/assigned    : Vista personalizada "Mis Acuerdos"         |
|  - /agreements/dashboard   : Tablero ejecutivo (7 KPIs + actividad)     |
|  - /agreements/reports     : Informes ejecutivos y semáforo preventivo  |
+-------------------------------------------------------------------------+
                                    │  HTTP / JSON (Cookies seguras)
                                    ▼
+-------------------------------------------------------------------------+
|                           BACKEND (NESTJS)                              |
|  [SessionAuthGuard]  ──▶  Valida sesión activa en Neon PostgreSQL       |
|  [PermissionsGuard] ──▶  Inspecciona 13 permisos RBAC granulares       |
|  [AgreementsController]                                                 |
|       │                                                                 |
|       ▼                                                                 |
|  [AgreementsService]                                                    |
|       ├─ Transacciones ACID (Prisma $transaction)                       |
|       ├─ Generador de Folios Únicos con Reintento Automático (P2002)     |
|       ├─ Máquina de Estados Finita y Validación de Transiciones        |
|       ├─ Auditoría Dual (agreement_history + audit_logs)                |
|       └─ Motor de Vencimientos Dinámicos                                |
+-------------------------------------------------------------------------+
                                    │  Prisma ORM (Pooler & Direct)
                                    ▼
+-------------------------------------------------------------------------+
|                     BASE DE DATOS (NEON POSTGRESQL)                     |
|  - agreements               - agreement_collaborators                   |
|  - agreement_progress       - agreement_evidences                       |
|  - agreement_history        - audit_logs                                |
+-------------------------------------------------------------------------+
```

### 2. Estructura de Archivos del Backend

```
apps/backend/src/modules/agreements/
├── agreements.controller.ts            # Enrutamiento RESTful, guards y Swagger
├── agreements.service.ts               # Lógica de negocio institucional
├── agreements.module.ts                # Configuración e inyección de dependencias
└── dto/
    ├── create-agreement.dto.ts         # Contrato de creación de acuerdos
    ├── update-agreement.dto.ts         # Contrato de actualización y versión
    ├── query-agreements.dto.ts         # Contrato de filtros y paginación
    ├── assign-agreement.dto.ts         # Contrato de asignación y colaboradores
    ├── create-progress.dto.ts          # Contrato de avances acumulativos
    ├── status-transitions.dto.ts       # Contratos de cambio formal de estado
    └── create-evidence.dto.ts          # Contrato de metadatos de evidencia
```

### 3. Patrones de Diseño e Integridad

1. **Optimistic Locking (Control de Concurrencia Optimista):**  
   Cada acuerdo dispone de un campo `version INT DEFAULT 1`. Al invocar operaciones de modificación general o formalización, el cliente envía la versión esperada; si otro usuario ha modificado el registro concurrentemente, el backend arroja inmediatamente `ConflictException (409)` impidiendo sobrescrituras silenciosas.

2. **Transacciones ACID Atómicas:**  
   Toda operación que altere el estado del acuerdo, asigne un responsable o registre un avance se ejecuta dentro de un bloque `prisma.$transaction(async (tx) => ...)`. Esto garantiza que la actualización del registro principal y la inserción del evento histórico en `agreement_history` se comprometan de manera indivisible.

3. **Reintento Transaccional de Folio Único:**  
   Ante cargas concurrentes simultáneas, la función `create` ejecuta un bucle de reintento que captura el código de error `P2002` de Prisma (violación de restricción única sobre `folio`), recalculando de manera autónoma el siguiente número secuencial disponible sin abortar la operación ni requerir intervención del usuario.

