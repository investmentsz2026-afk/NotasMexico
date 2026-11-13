# EXPERIENCIA DE USUARIO Y FRONTEND — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)

### 1. ARQUITECTURA DE INTERFAZ EN NEXT.JS 15

El frontend de la Bóveda Digital fue desarrollado siguiendo la directriz institucional de sobriedad, claridad y alto rendimiento, empleando React 19, Next.js 15 (App Router), TypeScript y Tailwind CSS.

Rutas incorporadas:
- `/vault`: Catálogo general de la bóveda documental, filtros multifactoriales, paginación y modal de carga.
- `/vault/[id]`: Ficha técnica de expediente, trazabilidad criptográfica SHA-256, vínculos institucionales, historial de versiones y acciones de gestión.
- Barra de navegación (`header-nav.tsx`): Acceso directo mediante el botón "Bóveda" con icono institucional `FolderLock`.

---

### 2. COMPONENTES Y FLUJOS DE USUARIO

#### 2.1 Catálogo Documental (`/vault`)
- **Cabecera Institucional:** Título, descripción técnica, contador de documentos y botón de acción principal *"Cargar Documento"*.
- **Barra de Búsqueda y Filtros Combinados:**
  * Búsqueda por coincidencia de texto en nombre de archivo y descripción.
  * Selector por categoría documental (`General`, `Acta Oficial`, `Acuerdo`, `Nota`, `Convocatoria`, `Evidencia`, `Anexo Técnico`, `Dictamen`).
  * Selector por estado de inspección (`Limpio`, `Pendiente de revisión`, `Infectado`).
- **Tabla Responsiva:**
  * Iconografía diferenciada por tipo de contenido (PDF rojo, Excel verde, Word azul, Imagen púrpura, Archivo genérico).
  * Insignias de versión (`v1`, `v2`, etc.) y estado de seguridad.
  * Píldoras de vinculación institucional con enlaces directos hacia reuniones (`/meetings/:id`), acuerdos (`/agreements/:id`) o notas (`/notes/:id`).
  * Botones de acción directa: *Descargar* (con spinner mientras se solicita la URL presignada), *Ficha Técnica* y *Eliminar* (con confirmación modal).

#### 2.2 Modal de Carga Asíncrona Segura
- Permite seleccionar archivos mediante explorador del sistema.
- Valida en el navegador antes de enviar:
  * Límite estricto de 25 MB.
  * Formatos permitidos.
- Provee selector de categoría y campo de justificación/descripción.
- Estado de carga con indicador visual *"Cargando y Cifrando..."* y captura limpia de errores de seguridad devueltos por el backend (e.g. rechazo por MIME spoofing).

#### 2.3 Ficha Técnica del Expediente (`/vault/[id]`)
- **Metadatos Detallados:** Tamaño formateado en bytes/KB/MB, MIME declarado, fecha de registro, usuario que subió el archivo.
- **Trazabilidad Criptográfica:** Hash SHA-256 con botón de copiado al portapapeles y clave de objeto en la bóveda (`storageKey`).
- **Historial Completo de Versiones:** Tabla histórica con monotonicidad (`v1`, `v2`), fecha, tamaño y checksum individual de cada versión previa.
- **Acción de Versionado:** Modal para subir una nueva versión incremental (`v(N+1)`).

---

### 3. ACCESIBILIDAD Y RESPONSIVIDAD

- **Contraste y Legibilidad:** Paleta institucional basada en `slate-900` con textos en `slate-200` y acentos púrpuras para la bóveda documental.
- **Micro-interacciones:** Indicadores de estado de carga en todas las acciones asíncronas para evitar dobles envíos.
- **Compatibilidad de Pantallas:** Diseñado bajo paradigma Mobile-First, adaptándose fluidamente desde smartphones de 320px hasta monitores ultrawide de 1440px o superiores.

