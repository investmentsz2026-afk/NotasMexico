# SEGURIDAD EN LA CARGA DE ARCHIVOS — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)

### 1. MODELO DE AMENAZAS EN CARGA DE ARCHIVOS

La carga de archivos en sistemas institucionales gubernamentales representa un vector crítico de ataque si no se aplican controles rigurosos. MexAgenda mitiga los siguientes riesgos:

1. **MIME Type Spoofing:** Carga de binarios ejecutables (`.exe`, `.sh`, `.elf`, scripts PHP o páginas HTML con JavaScript) renombrados con extensiones inocuas como `.pdf` o `.docx`.
2. **Path Traversal / Directory Traversal:** Nombres de archivo como `../../etc/passwd` o `..\..\..\windows\system32\calc.exe`.
3. **Denegación de Servicio (DoS) por Tamaño Excesivo:** Carga masiva de archivos de gigabytes que agoten el ancho de banda o almacenamiento.
4. **Colisión de Nombres y Sobreescritura:** Archivos homónimos cargados por diferentes usuarios sobreescribiendo dictámenes o actas oficiales.
5. **Carga de Archivos Vacíos:** Archivos de 0 bytes que generen inconsistencias en metadatos y visor documental.

---

### 2. CONTROLES DE SEGURIDAD IMPLEMENTADOS

#### 2.1 Inspección Estricta de Cabeceras Binarias (Magic Bytes)
El módulo `magic-bytes.validator.ts` no confía en la cabecera HTTP `Content-Type` enviada por el navegador (la cual es trivialmente falsificable). En su lugar, inspecciona directamente los primeros bytes del buffer en memoria:

| Formato Permitido | Extensión | Firma Binaria (Magic Bytes) | Tipo MIME Detectado |
| :--- | :--- | :--- | :--- |
| **PDF** | `.pdf` | `25 50 44 46 2D` (`%PDF-`) | `application/pdf` |
| **PNG** | `.png` | `89 50 4E 47 0D 0A 1A 0A` | `image/png` |
| **JPEG** | `.jpg`, `.jpeg` | `FF D8 FF` | `image/jpeg` |
| **Office OpenXML (Word)** | `.docx` | `50 4B 03 04` (`PK..`) | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| **Office OpenXML (Excel)** | `.xlsx` | `50 4B 03 04` (`PK..`) | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| **Office OpenXML (PowerPoint)**| `.pptx` | `50 4B 03 04` (`PK..`) | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| **Texto / CSV** | `.txt`, `.csv` | Texto legible UTF-8 sin caracteres binarios nulos | `text/plain`, `text/csv` |

Cualquier discrepancia entre la extensión y los magic bytes (o cualquier binario no reconocido) es rechazada de inmediato con `400 Bad Request` y mensaje:
> *"Firma binaria de archivo (magic bytes) no coincide con el tipo MIME declarado o formato no permitido (MIME spoofing detectado)"*.

#### 2.2 Lista Blanca de Extensiones Permitidas
Se aplica una lista blanca estricta inmutable:
```typescript
export const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.xlsx', '.pptx', '.png', '.jpg', '.jpeg', '.txt', '.csv'
]);
```
Archivos con extensiones como `.exe`, `.bat`, `.cmd`, `.sh`, `.php`, `.js`, `.vbs`, `.iso` son rechazados antes de ser procesados.

#### 2.3 Límite de Tamaño Máximo
- Límite institucional: **25 MB** (`26,214,400 bytes`).
- Archivos vacíos (`0 bytes`) son rechazados explícitamente.

#### 2.4 Generación de Claves Criptográficas Seguras
El nombre original del archivo **nunca** se utiliza como ruta de almacenamiento física. En su lugar se construye una clave con estructura:
```
vault/{year}/{month}/{UUIDv4}-{sanitizedFilename}
```
Donde `sanitizedFilename` es limpiado de cualquier carácter especial, separadores de directorio (`/`, `\`) o bytes nulos (`\0`).

#### 2.5 Cálculo de Hash Criptográfico SHA-256
Se calcula el hash SHA-256 del contenido antes de almacenarlo y se registra en base de datos. Esto garantiza:
- Verificación de integridad post-descarga.
- Inmutabilidad forense en la bitácora de auditoría.
- Detección de duplicados o modificaciones no autorizadas en reposos.

