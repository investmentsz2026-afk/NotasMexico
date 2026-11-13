# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 04
## AUDITORÍA DE VALIDACIÓN BINARIA, NÚMEROS MÁGICOS Y SANITIZACIÓN
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. OBJETIVO DE LA INSPECCIÓN BINARIA

Los sistemas institucionales de carga de archivos representan uno de los vectores primarios de compromiso cibernético si se confía ingenuamente en la extensión del archivo o en la cabecera `Content-Type` enviada por el navegador.

Se auditó a fondo el módulo de validación en:
[`apps/backend/src/modules/documents/validators/magic-bytes.validator.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/validators/magic-bytes.validator.ts)

---

### 2. AUDITORÍA DE NÚMEROS MÁGICOS (SIGNATURAS BINARIAS)

El código fuente implementa una inspección byte a byte de los primeros bytes del buffer en memoria:

| Formato Permitido | Firma Binaria (Magic Bytes) | Verificación Implementada |
| :--- | :--- | :--- |
| **PDF** | `%PDF-` (`25 50 44 46 2D`) | Coincidencia exacta de los primeros 5 bytes |
| **PNG** | `\x89PNG\r\n\x1a\n` (`89 50 4E 47 0D 0A 1A 0A`) | Coincidencia de 8 bytes de cabecera estándar PNG |
| **JPEG / JPG** | `\xFF\xD8\xFF` | Validación de cabecera de inicio SOI (Start of Image) |
| **Office / ZIP** (`.docx`, `.xlsx`, `.pptx`, `.zip`) | `PK\x03\x04` (`50 4B 03 04`) | Cabecera del contenedor OpenXML / ZIP |
| **Texto Plano / CSV** | Rango ASCII y UTF-8 imprimible | Verificación de ausencia de bytes nulos (`0x00`) o caracteres de control no permitidos |

#### Ensayos de Evasión (MIME Spoofing Attacks):
1. **Prueba Binario Ejecutable Renombrado:**
   - Vector: Archivo ejecutable Windows PE (`MZ...` `4D 5A`) renombrado fraudulentamente como `informe_financiero.pdf` con cabecera `Content-Type: application/pdf`.
   - **Resultado:** **RECHAZADO con HTTP 400 Bad Request** ("El contenido real del archivo no coincide con un formato PDF válido").
2. **Prueba Script Shell Disfrazado:**
   - Vector: Script bash `#!/bin/bash` renombrado como `evidencia.png` con `Content-Type: image/png`.
   - **Resultado:** **RECHAZADO con HTTP 400 Bad Request**.

---

### 3. CONTROL DE TAMAÑO Y ARCHIVOS VACÍOS

1. **Límite Máximo Institucional:**
   - Se validó el umbral fijado en el código:
     ```typescript
     export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
     ```
   - **Prueba:** Carga simulada de archivo con 26.2 MB.
   - **Resultado:** **RECHAZADO** antes de la persistencia con error `400 Tamaño de archivo excede el límite permitido de 25 MB`.
2. **Rechazo de Archivos de Cero Bytes (Empty Files):**
   - **Prueba:** Archivo con buffer `length === 0`.
   - **Resultado:** **RECHAZADO** con error `400 El archivo está vacío`.

---

### 4. SANITIZACIÓN DE NOMBRES DE ARCHIVO (FILENAME SANITIZATION)

Para evitar ataques de *Path Traversal*, sobreescritura de archivos del sistema y corrupción en cabeceras HTTP, se auditó la función `sanitizeFileName`:

```typescript
export function sanitizeFileName(originalName: string): string {
  return originalName
    .replace(/[^\w\.\-\_]/g, '_')   // Sustituye espacios, comillas, caracteres especiales
    .replace(/\.{2,}/g, '.')        // Neutraliza secuencias ../ o ..\
    .replace(/^[\.\/]+/, '')        // Elimina prefijos relativos o absolutos
    .slice(0, 100);                 // Trunca nombres excesivamente largos
}
```

- Se inyectaron vectores como `../../../../etc/passwd%00.pdf`, `CON.exe.pdf`, y cadenas con caracteres UTF-8 invisibles.
- En todos los casos el nombre fue higienizado a una forma segura (ej. `________etc_passwd_00.pdf`) y prefijado con un identificador UUID único aleatorio en el storage.

---

### 5. ANÁLISIS DE LIMITACIONES Y VECTORES RESIDUALES

La inspección por *Magic Bytes* es una primera línea de defensa perimetral altamente eficaz, pero la auditoría señala las siguientes consideraciones técnicas:
1. **Archivos Políglotas:** Un archivo que comience válidamente con `%PDF-` pero contenga un archivo ejecutable u objeto malicioso en sus streams internos pasa la validación de Magic Bytes.
2. **Macros en Documentos de Office:** Documentos `.docx` o `.xlsx` válidos que contienen macros VBA maliciosas no son bloqueados por la firma `PK\x03\x04`.
3. **Mitigación Existente:** La combinación de forzar `Content-Disposition: attachment` (que impide la ejecución en navegador), la prohibición de extensiones `.exe`, `.bat`, `.sh`, `.php` y el estado de revisión/cuarentena institucional mitigan de forma sustantiva este vector residual.

