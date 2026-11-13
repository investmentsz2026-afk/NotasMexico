# 06. AUDITORÍA DE BACKEND, CONCURRENCIA Y CONTROL OPTIMISTA (MOD-03)
## MexAgenda — Sistema Privado de Gestión Institucional

### 1. Arquitectura y Calidad de Código en NestJS

La auditoría de la capa backend inspeccionó la totalidad del módulo `AgreementsModule` (`apps/backend/src/modules/agreements/`), evaluando modularidad, tipado estricto en TypeScript, inyección de dependencias, transacciones de base de datos y control de concurrencia.

```
apps/backend/src/modules/agreements/
├── agreements.controller.ts    # Enrutamiento RESTful, guards institucionales y Swagger
├── agreements.service.ts       # Lógica transaccional de acuerdos y orquestación
├── agreements.module.ts        # Declaración modular e inyección de servicios
└── dto/                        # Contratos validados con class-validator
    ├── create-agreement.dto.ts
    ├── update-agreement.dto.ts
    ├── query-agreements.dto.ts
    ├── assign-agreement.dto.ts
    ├── create-progress.dto.ts
    ├── status-transitions.dto.ts
    └── create-evidence.dto.ts
```

---

### 2. Auditoría de Concurrencia y Folios Únicos

#### 2.1. Algoritmo de Generación de Folios Institucionales
- **Formato Normalizado:** `ACU-[PREFIJO]-[AÑO]-[SECUENCIAL]` (ej. `ACU-ORD-2026-0001`).
- **Resiliencia ante Colisiones Concurrentes:**  
  La función `create` ejecuta un bucle de reintento transaccional que captura específicamente el error con código `P2002` de Prisma ORM (violación de restricción única sobre `folio`). Si dos peticiones simultáneas calculan el mismo secuencial, la segunda captura la excepción, recalcula el número disponible e inserta exitosamente sin abortar la solicitud.
- **Resultado de la Prueba `CONCURR-01`:**  
  Se enviaron 4 creaciones simultáneas concurrentes a Neon PostgreSQL (`Promise.all`). Las 4 transacciones concluyeron satisfactoriamente, generando 4 folios únicos distintos sin colisión alguna.

---

### 3. Control de Concurrencia Optimista (*Optimistic Locking*)

#### 3.1. Prevención de Sobrescritura Silenciosa (*Lost Updates*)
- **Mecanismo:** Cada acuerdo dispone de una columna `version INTEGER DEFAULT 1`.
- **Validación:** En las operaciones de actualización (`update`), el cliente proporciona `expectedVersion` (o `version`). El servicio compara la versión recibida con la existente en la base de datos:
  ```typescript
  const expVer = dto.expectedVersion !== undefined ? dto.expectedVersion : dto.version;
  if (expVer !== undefined && existing.version !== expVer) {
    throw new ConflictException(
      `Conflicto de concurrencia optimista: el acuerdo ha sido modificado por otro usuario (versión actual: ${existing.version}, versión esperada: ${expVer}).`,
    );
  }
  ```
- **Resultado de la Prueba `CONCURR-02`:**  
  Se simuló una actualización paralela donde el Usuario 1 incrementó la versión a 2. Cuando el Usuario 2 intentó actualizar enviando la versión 1, el backend arrojó limpiamente `HTTP 409 ConflictException`, protegiendo la integridad del registro.

---

### 4. Orden de Rutas y Prevención de Colisiones en Enrutamiento

En NestJS / Express, declarar rutas parametrizadas (`:id`) antes de rutas estáticas provoca que peticiones como `GET /agreements/dashboard` sean interpretadas erróneamente con `id = 'dashboard'`.

Se certificó que [`AgreementsController`](file:///d:/MexAgenda/apps/backend/src/modules/agreements/agreements.controller.ts) declara estrictamente las rutas en el orden correcto:
1. `GET /agreements/dashboard` (Ruta estática)
2. `GET /agreements/reports` (Ruta estática)
3. `GET /agreements/users` (Ruta estática)
4. `GET /agreements/assigned` (Ruta estática)
5. `GET /agreements` (Listado paginado)
6. `POST /agreements` (Creación)
7. `GET /agreements/:id` (Ruta parametrizada evaluada posteriormente)

---

### 5. Tratamiento Robusto de Fechas Institucionales

- **Riesgo:** Fechas en formatos diversos (cadenas `YYYY-MM-DD` vs timestamps ISO con milisegundos) generan frecuentemente errores de `Invalid Date` o desfases de un día por conversión UTC.
- **Solución Implementada:** El helper privado `parseInstitutionalDate` inspecciona si la cadena ya contiene separadores de tiempo (`'T'`), evitando duplicaciones sintácticas y garantizando compatibilidad determinista entre Prisma, JavaScript y PostgreSQL.

**Dictamen de Backend:** **APROBADO SIN RESERVAS. ARQUITECTURA LIMPIA Y ROBUSTA.**

