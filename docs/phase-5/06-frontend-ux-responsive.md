# FRONTEND Y EXPERIENCIA DE USUARIO (UX/UI) — MOD-04
## Interfaz Institucional de Anotaciones y Notas de Sesión

### 1. PRINCIPIOS DE DISEÑO Y SISTEMA VISUAL

El diseño de la interfaz de usuario de MOD-04 respeta la identidad gráfica institucional de MexAgenda:
- **Paleta de Colores Institucionales:** Fondo sobrio `institutional-bg` / `slate-950`, tarjetas con bordes definidos `border-slate-800` y fondos `slate-900/80`, acentos en `cyan-400` / `cyan-600` para anotaciones, `amber-400` para sesiones y `purple-400` para intervenciones administrativas.
- **Tipografía y Legibilidad:** Fuentes sans-serif optimizadas para lectura prolongada de documentos legales y notas técnicas, con contraste WCAG 2.1 AA.
- **Micro-interacciones:** Indicadores de estado de carga con animación giratoria, transiciones fluidas de borde al pasar el cursor y modales con desenfoque de fondo (`backdrop-blur-sm`).

---

### 2. ARQUITECTURA DE VISTAS (APP ROUTER)

```
apps/frontend/src/app/(dashboard)/notes/
├── page.tsx          # Catálogo principal con pestañas, filtros y tarjetas responsivas
├── new/
│   └── page.tsx      # Formulario de alta con selectores de contexto y Suspense
└── [id]/
    └── page.tsx      # Expediente integral, visor de contenido, historial y modales
```

#### A. Catálogo Principal (`/notes`)
- **Pestañas de Navegación Operativa:**
  - *Todas mis notas:* Vista unificada de notas privadas y colaborativas.
  - *Notas de Sesión:* Filtra exclusivamente notas vinculadas a órganos colegiados (`noteType = 'SESION'`).
  - *Favoritas:* Acceso directo a anotaciones marcadas con estrella por el usuario.
  - *Archivadas / Papelera:* Vista especial de notas con baja lógica para restauración o depuración.
- **Buscador y Filtros en Tiempo Real:** Búsqueda libre sobre título, contenido y etiquetas (`tags`), selectores de categoría institucional y visibilidad.
- **Tarjetas Informativas:** Visualización de badges temáticos, indicador de intervención administrativa, autor institucional, número de versión y accesos rápidos (favorita, expediente, archivar).

#### B. Formulario de Alta (`/notes/new`)
- Envuelto en frontera `<Suspense>` para evitar advertencias de hidratación de Next.js al leer parámetros de URL (`?meetingId=...`).
- Carga dinámica de reuniones colegiadas y acuerdos vigentes para vinculación con un solo clic.
- Detección contextual: Si se accede desde una reunión, se preselecciona automáticamente el tipo `SESION` y la reunión correspondiente.

#### C. Expediente Integral de la Anotación (`/notes/[id]`)
- **Encabezado Institucional:** Badges de categoría, visibilidad, versión y fechas de creación y actualización.
- **Banner de Alerta Administrativa:** En caso de que la nota haya sido modificada por un administrador, despliega un cuadro de advertencia púrpura con el nombre del interventor y la justificación legal.
- **Pestaña de Contenido:** Renderizado completo del cuerpo de la anotación con preservación de saltos de línea y etiquetas.
- **Pestaña de Historial de Versiones:** Cronología inversa con snapshots de cada versión, autor del cambio, motivo y justificación.
- **Modales Integrados:** Modal de edición ordinaria del autor y modal de intervención administrativa extraordinaria con contador de caracteres (mínimo 15).

---

### 3. RESPONSIVIDAD Y COMPATIBILIDAD MULTI-DISPOSITIVO

La interfaz fue diseñada con enfoque *mobile-first* garantizando usabilidad completa en todas las resoluciones estándar:

| Resolución | Dispositivo de Referencia | Comportamiento de la Interfaz |
| :---: | :--- | :--- |
| **320px** | iPhone SE / Smartphones compactos | Grid a 1 columna. Pestañas con desplazamiento horizontal suave. Botones compactos con iconos legibles. |
| **768px** | Tablets / iPad Portrait | Grid a 2 columnas. Barra de filtros distribuida en dos filas. Modales adaptados al ancho de pantalla. |
| **1024px** | Laptops / iPad Landscape | Grid a 3 columnas. Barra de filtros en una sola fila. Expediente con doble columna para metadatos. |
| **1440px** | Pantallas de escritorio corporativas | Contenedor centrado `max-w-7xl` con márgenes confortables y paneles desplegables amplios. |

---

### 4. NAVEGACIÓN GLOBAL EN CABECERA

Se actualizó el componente `apps/frontend/src/app/header-nav.tsx` incorporando el enlace directo hacia `/notes` con el icono institucional `BookOpen`, disponible inmediatamente tras iniciar sesión institucional.

