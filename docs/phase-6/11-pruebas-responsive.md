# PRUEBAS DE ADAPTABILIDAD RESPONSIVA — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)

### 1. OBJETIVO Y METODOLOGÍA

Validar que las interfaces de usuario desarrolladas para la Bóveda Digital (`/vault` y `/vault/[id]`) ofrezcan una experiencia visual limpia, legible, accesible y plenamente interactiva en todos los anchos de pantalla especificados en los lineamientos institucionales (desde 320px hasta 1440px).

---

### 2. MATRIZ DE COMPATIBILIDAD POR RESOLUCIÓN

| Resolución / Dispositivo | Ancho (px) | Comportamiento en `/vault` (Catálogo) | Comportamiento en `/vault/[id]` (Ficha Técnica) | Estatus |
| :--- | :---: | :--- | :--- | :---: |
| **Mobile Extra Pequeño** | **320px** | - Cabecera apilada verticalmente.<br>- Botón de carga ocupa ancho completo.<br>- Filtros en columna única.<br>- Tabla con desplazamiento horizontal suave (`overflow-x-auto`). | - Metadatos en columna única.<br>- Botones de descarga y versionado apilados.<br>- Hash SHA-256 trunca con puntos suspensivos.<br>- Botón copiar operativo. | **CONFORME** |
| **Mobile Estándar** | **375px - 425px** | - Acceso ágil a búsqueda rápida.<br>- Paginación legible con botones táctiles de 44px.<br>- Modal de carga centrado con márgenes seguros. | - Encabezado con icono y nombre visible.<br>- Vinculaciones institucionales envueltas en flex-wrap. | **CONFORME** |
| **Tablet Vertical** | **768px** | - Barra de filtros en cuadrícula de 2 columnas.<br>- Paginación muestra conteo total y botones Anterior/Siguiente alineados.<br>- Tabla muestra columnas de fecha y tamaño. | - Cuadrícula de metadatos en 2 columnas.<br>- Historial de versiones en tabla completa legible sin scroll forzado. | **CONFORME** |
| **Desktop / Laptop** | **1024px** | - Barra de filtros integrada en una sola fila (5 cols búsqueda, 4 cols categoría, 3 cols estado).<br>- Acciones alineadas a la derecha con textos completos. | - Cuadrícula de metadatos en 4 columnas.<br>- Ficha técnica con visualización horizontal de trazabilidad criptográfica. | **CONFORME** |
| **Monitor Ultrawide** | **1440px+** | - Contenedor con ancho máximo institucional (`max-w-7xl`).<br>- Tipografía balanceada, ausencia de espacios en blanco desproporcionados. | - Trazabilidad SHA-256 visible en su totalidad sin truncamiento. | **CONFORME** |

---

### 3. COMPONENTES CLAVE Y SOLUCIONES TÉCNICAS

1. **Tabla de Documentos:**
   Implementada con `overflow-x-auto` y contenedores con `min-w-full`, permitiendo consultar todas las columnas críticas (archivo, categoría, tamaño, seguridad, vinculación, cargado por, acciones) en dispositivos móviles sin desbordar el viewport ni provocar desplazamiento horizontal no deseado en el cuerpo de la página.
2. **Modal de Carga:**
   Diseñado con `fixed inset-0 z-50 flex items-center justify-center p-4`, asegurando que en pantallas pequeñas el modal se mantenga dentro del área visible y permita hacer scroll si el teclado virtual se despliega.
3. **Copiado de Hash SHA-256:**
   En resoluciones pequeñas donde el hash de 64 caracteres se trunca visualmente (`truncate`), el botón de copiado (`Copy` / `Check`) interactúa con la API del portapapeles del navegador (`navigator.clipboard.writeText`), garantizando que el usuario obtenga el hash íntegro sin errores de selección táctil.

