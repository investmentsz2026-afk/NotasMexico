# 04. AUDITORÍA DE ZONA HORARIA Y TRATAMIENTO TEMPORAL
## Proyecto: MexAgenda — Sistema Privado de Gestión Institucional
### Módulo: MOD-02 — Gestión Institucional de Reuniones y Sesiones

---

## 1. OBJETIVO DE LA AUDITORÍA TEMPORAL

Las instituciones públicas y privadas en México operan bajo marcos jurídicos donde la precisión de las fechas y horarios de convocatoria, quórum y firma de actas es crítica. Errores comunes de software en la conversión entre la zona local (`America/Mexico_City`) y el tiempo universal coordinado (`UTC`) suelen generar:
1. Desplazamientos de fechas al día anterior o posterior (por ejemplo, una reunión del 15 de diciembre mostrándose como 14 de diciembre a las 18:00 UTC-6).
2. Pérdida de registros en consultas filtradas por rangos de fecha en los extremos del día.
3. Descoordinación de horarios de inicio y término.

El objetivo de esta auditoría fue verificar que MexAgenda gestione de forma determinista y consistente la zona horaria oficial `America/Mexico_City`.

---

## 2. POLÍTICA ARQUITECTÓNICA DE MANEJO TEMPORAL

### 2.1 Zona Horaria Oficial del Sistema
La plataforma define como estándar soberano:
- **Identificador IANA:** `America/Mexico_City`.
- **Configuración por defecto:** Todo registro de reunión asume `timezone: 'America/Mexico_City'` salvo especificación expresa en sesiones de comisiones en husos de la frontera norte o península de Yucatán.

### 2.2 Estrategia de Persistencia y Normalización
1. **Fechas de Reunión (`meetingDate`):**
   - El cliente envía la fecha en formato estricto ISO `YYYY-MM-DD`.
   - Se normaliza a medianoche UTC: `new Date(`${dto.meetingDate}T00:00:00.000Z`)`.
   - Al devolverse al cliente, se serializa como cadena limpia `meetingDate.toISOString().split('T')[0]`, garantizando que en cualquier cliente web o móvil represente exactamente el día acordado, sin sufrir alteraciones por el huso local del navegador.

2. **Horarios de Inicio y Cierre (`startTime`, `endTime`):**
   - Se validan mediante expresión regular `^([01]\d|2[0-3]):([0-5]\d)$` (`HH:mm` en formato de 24 horas).
   - Se almacenan sobre la fecha base Unix `1970-01-01T${HH:mm}:00.000Z`.
   - Se formatean en la respuesta de la API mediante la función determinista `formatTime`:
     ```typescript
     private formatTime(timeVal: Date | string): string {
       if (typeof timeVal === 'string') return timeVal.substring(0, 5);
       if (timeVal instanceof Date) {
         return timeVal.toISOString().substring(11, 16);
       }
       return '00:00';
     }
     ```

3. **Filtro por Rango de Fechas con Cobertura de Límites de Día:**
   En [`MeetingsService.findAll`](file:///d:/MexAgenda/apps/backend/src/modules/meetings/meetings.service.ts), para evitar que reuniones programadas en una fecha sean omitidas al consultar `startDate` y `endDate`, se normalizan los límites:
   ```typescript
   if (query.startDate || query.endDate) {
     where.meetingDate = {};
     if (query.startDate) {
       const startStr = query.startDate.includes('T') ? query.startDate : `${query.startDate}T00:00:00.000Z`;
       where.meetingDate.gte = new Date(startStr);
     }
     if (query.endDate) {
       const endStr = query.endDate.includes('T') ? query.endDate : `${query.endDate}T23:59:59.999Z`;
       where.meetingDate.lte = new Date(endStr);
     }
   }
   ```

4. **Validación de Coherencia Horaria (`validateStartEndTimes`):**
   Se rechaza en el backend cualquier solicitud donde la hora de finalización sea menor o igual a la hora de inicio:
   ```typescript
   private validateStartEndTimes(start: string, end: string): void {
     const [startH, startM] = start.split(':').map(Number);
     const [endH, endM] = end.split(':').map(Number);
     const startMinutes = startH * 60 + startM;
     const endMinutes = endH * 60 + endM;

     if (endMinutes <= startMinutes) {
       throw new BadRequestException(
         `La hora de finalización (${end}) no puede ser anterior ni igual a la hora de inicio (${start}).`,
       );
     }
   }
   ```

---

## 3. EVIDENCIAS DE PRUEBAS TEMPORALES EJECUTADAS

### 3.1 TZ-AUDIT-01: Preservación de Fecha y Horario en America/Mexico_City
- **Escenario:** Creación de reunión para el `2026-12-15` de `18:00` a `20:00` con `timezone: "America/Mexico_City"`.
- **Resultado Verificado:**
  - `meetingDate`: exactamente `"2026-12-15"` (sin desplazamiento a 14 o 16 de diciembre).
  - `startTime`: exactamente `"18:00"`.
  - `endTime`: exactamente `"20:00"`.
  - `timezone`: `"America/Mexico_City"`.
- **Duración:** 1784ms. **Estado:** APROBADO.

### 3.2 TZ-AUDIT-02: Filtro por Rango en Límites de Día
- **Escenario:** Consulta con `startDate: "2026-12-15"` y `endDate: "2026-12-15"`.
- **Resultado Verificado:** Recuperó con éxito la reunión creada en dicho día, confirmando que la normalización a `23:59:59.999Z` abarca la totalidad de la jornada sin desfasamientos.
- **Duración:** 711ms. **Estado:** APROBADO.

### 3.3 TZ-AUDIT-03: Rechazo de Horarios Invertidos
- **Escenario:** Intento de crear reunión con `startTime: "14:00"` y `endTime: "13:00"`.
- **Resultado Verificado:** Rechazada con HTTP 400 Bad Request (`BadRequestException: La hora de finalización (13:00) no puede ser anterior ni igual a la hora de inicio (14:00).`).
- **Duración:** 0ms. **Estado:** APROBADO.

---

## 4. CONCLUSIÓN DEL CAPÍTULO DE ZONA HORARIA

MexAgenda cuenta con un esquema temporal robusto y calibrado para México. Las fechas de sesión, horas de desahogo y convocatorias son deterministas, no presentan desfasamientos por conversiones automáticas del cliente y cumplen con la certidumbre jurídica institucional exigida.

