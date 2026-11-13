# 03. AUDITORÍA DE CONCURRENCIA, FOLIOS Y COLISIONES
## Proyecto: MexAgenda — Sistema Privado de Gestión Institucional
### Módulo: MOD-02 — Gestión Institucional de Reuniones y Sesiones

---

## 1. OBJETIVO DE LA AUDITORÍA DE CONCURRENCIA

En un entorno institucional colegiado, múltiples secretarios, relatores y vocales pueden interactuar simultáneamente con la plataforma:
1. Crear reuniones al mismo tiempo con la misma categoría y fecha.
2. Actualizar metadatos de una reunión mientras otro usuario guarda cambios concurrentes.
3. Agregar puntos al orden del día de forma simultánea durante el desarrollo en vivo.

El objetivo de esta auditoría fue evaluar la solidez transaccional en **Neon PostgreSQL**, verificar que no ocurran sobreescrituras sucias (*dirty writes*), que los folios institucionales únicos no colisionen y que los errores de concurrencia se traduzcan en respuestas HTTP limpias (409 Conflict) en lugar de caídas 500 no controladas.

---

## 2. MECANISMOS DE RESILIENCIA IMPLEMENTADOS

### 2.1 Reintento Transaccional Automático en Folios Autogenerados
El folio institucional tiene el formato `[PREFIJO_CATEGORÍA]-[AÑO]-[SECUENCIAL]` (por ejemplo: `ORD-2026-001`). En Neon PostgreSQL, la columna `folio` posee una restricción `UNIQUE` estricta a nivel de base de datos.

Si dos solicitudes concurrentes intentan calcular y guardar el mismo folio en la misma fracción de milisegundo, la base de datos permite la primera y rechaza la segunda con la excepción de unicidad `P2002`.

Para evitar que el segundo usuario reciba un error, el servicio [`MeetingsService.create`](file:///d:/MexAgenda/apps/backend/src/modules/meetings/meetings.service.ts) implementa un bucle de reintento automático con regeneración secuencial:

```typescript
let created: any = null;
let attempts = 0;
const maxAttempts = 3;

while (!created && attempts < maxAttempts) {
  try {
    created = await this.prisma.meeting.create({
      data: {
        folio,
        title: dto.title.trim(),
        categoryId: dto.categoryId,
        meetingDate,
        startTime: startTimeDate,
        endTime: endTimeDate,
        location: dto.location.trim(),
        modality: dto.modality || 'PRESENCIAL',
        virtualUrl: dto.virtualUrl?.trim() || null,
        timezone: dto.timezone?.trim() || 'America/Mexico_City',
        description: dto.description?.trim() || null,
        observations: dto.observations?.trim() || null,
        status: 'PROGRAMADA',
        createdById: userId,
      },
    });
  } catch (err: any) {
    // Si hay colisión de folio por concurrencia y fue autogenerado, regenerar y reintentar
    if (err.code === 'P2002' && (!dto.folio || attempts > 0)) {
      attempts++;
      folio = await this.generateUniqueFolio(category.code, dto.meetingDate);
    } else if (err.code === 'P2002') {
      throw new ConflictException(`El folio institucional [${folio}] ya se encuentra registrado.`);
    } else {
      throw err;
    }
  }
}
```

### 2.2 Control de Concurrencia Optimista (`expectedVersion`)
Cada reunión posee un campo numérico entero `version` que inicia en `1` y se incrementa automáticamente con cada actualización exitosa (`version: { increment: 1 }`).

Para proteger operaciones concurrentes donde dos operadores editan simultáneamente la misma sesión, el DTO [`UpdateMeetingDto`](file:///d:/MexAgenda/apps/backend/src/modules/meetings/dto/update-meeting.dto.ts) admite el parámetro opcional `expectedVersion`:

```typescript
// En MeetingsService.update:
if (dto.expectedVersion !== undefined && existing.version !== dto.expectedVersion) {
  throw new ConflictException(
    `Conflicto de concurrencia optimista: el registro ha sido modificado por otro usuario (versión actual: ${existing.version}, versión esperada: ${dto.expectedVersion}).`,
  );
}
```

Si un cliente intenta guardar cambios basándose en una versión desactualizada, el sistema rechaza la operación inmediatamente con HTTP 409 Conflict, protegiendo los cambios previos.

### 2.3 Manejo de Errores Prisma en `GlobalExceptionFilter`
Para garantizar que ninguna excepción nativa de base de datos escape como un error genérico 500, [`GlobalExceptionFilter`](file:///d:/MexAgenda/apps/backend/src/common/filters/global-exception.filter.ts) traduce los códigos de Prisma ORM:

| Código Prisma | Excepción Mapeada | Código HTTP | Mensaje Institucional |
| :--- | :--- | :--- | :--- |
| `P2002` | `DUPLICATE_RESOURCE_CONFLICT` | **409 Conflict** | Conflicto de unicidad en la base de datos (registro duplicado o colisión concurrente). |
| `P2025` | `RESOURCE_NOT_FOUND` | **404 Not Found** | El registro solicitado no existe en la base de datos o fue eliminado previamente. |
| `P2003` | `FOREIGN_KEY_VIOLATION` | **400 Bad Request** | Violación de restricción de clave foránea o relación institucional inválida. |

---

## 3. EVIDENCIAS DE PRUEBAS DE CONCURRENCIA EJECUTADAS

### 3.1 CONCURR-AUDIT-01: Creación Concurrente Simultánea de Reuniones
- **Escenario:** Ejecución paralela con `Promise.all` de dos peticiones de creación para la misma categoría (`AUD-xxxx`) y fecha (`2026-11-28`).
- **Comportamiento Observado:**
  - Ambas peticiones completaron con éxito sin lanzar error 500.
  - La primera sesión obtuvo folio `AUD-2026-001`.
  - La segunda sesión detectó la colisión en vuelo, reintentó automáticamente y obtuvo el folio `AUD-2026-002`.
- **Duración:** 4287ms. **Estado:** APROBADO.

### 3.2 CONCURR-AUDIT-02: Rechazo Explícito de Folio Duplicado
- **Escenario:** Creación intencional enviando un folio ya existente en el sistema.
- **Resultado Obtenido:** HTTP 409 Conflict (`ConflictException: El folio institucional [ORD-2026-xxx] ya se encuentra registrado.`).
- **Duración:** 357ms. **Estado:** APROBADO.

### 3.3 CONCURR-AUDIT-03: Rechazo por Concurrencia Optimista
- **Escenario:** Petición de actualización enviando `expectedVersion: N-1` (versión obsoleta).
- **Resultado Obtenido:** HTTP 409 Conflict (`ConflictException: Conflicto de concurrencia optimista: el registro ha sido modificado por otro usuario...`).
- **Duración:** 1538ms. **Estado:** APROBADO.

### 3.4 CONCURR-AUDIT-04: Transformación Controlada de P2002 en Filtro Global
- **Escenario:** Inyección de error `P2002` en el filtro de excepciones global de NestJS.
- **Resultado Obtenido:** Respuesta estandarizada RFC 7807 con código HTTP 409, `errorCode: "DUPLICATE_RESOURCE_CONFLICT"` y detalle institucional claro.
- **Duración:** 1ms. **Estado:** APROBADO.

### 3.5 CONCURR-AUDIT-05: Inserción Simultánea de Puntos de Agenda
- **Escenario:** Dos peticiones paralelas agregando puntos de agenda a la misma sesión institucional.
- **Resultado Obtenido:** Ambos puntos fueron insertados con identificadores únicos y orden secuencial consistente, sin colisiones de clave foránea.
- **Duración:** 834ms. **Estado:** APROBADO.

---

## 4. CONCLUSIÓN DEL CAPÍTULO DE CONCURRENCIA

MexAgenda demuestra una resiliencia sobresaliente ante condiciones de alta concurrencia. Las colisiones en folios se resuelven de forma transparente mediante reintento transaccional, y las colisiones de edición se gestionan limpiamente con bloqueo optimista y códigos 409, garantizando la integridad de los datos en Neon PostgreSQL.

