# ARQUITECTURA FRONTEND NEXT.JS 15 Y EXPERIENCIA DE USUARIO — FASE 7
## MEXAGENDA — SISTEMA PRIVADO DE GESTIÓN INSTITUCIONAL
### MÓDULO: MOD-06 — SISTEMA DE NOTIFICACIONES INSTITUCIONALES Y SERVICIO DE CORREO SMTP

---

### 1. ALCANCE Y DISEÑO VISUAL INSTITUCIONAL

La interfaz de notificaciones de MexAgenda está implementada sobre **Next.js 15 (App Router)** y **React 19**, respetando estrictamente la paleta de colores sobria y profesional de la plataforma (Slate 900, Slate 800, detalles en Amber 500 y Emerald 500).

---

### 2. COMPONENTES FRONTEND IMPLEMENTADOS

#### A. Campana de Notificaciones y Panel Desplegable ([`notification-bell.tsx`](file:///d:/MexAgenda/apps/frontend/src/app/notification-bell.tsx))
- **Ubicación:** Integrado en la barra de navegación superior ([`header-nav.tsx`](file:///d:/MexAgenda/apps/frontend/src/app/header-nav.tsx)), accesible desde cualquier pantalla del sistema para usuarios autenticados.
- **Badge Dinámico de No Leídas:** Despliega un distintivo rojo con el número exacto de avisos pendientes (`unreadCount`), con animación suave de pulso.
- **Popover Desplegable:**
  * Al hacer clic, consulta dinámicamente las últimas 5 notificaciones sin recargar la página.
  * Permite marcar avisos individuales como leídos con un solo clic.
  * Botón *"Marcar todas leídas"* en la cabecera del panel.
  * Enlace al pie hacia el Centro de Notificaciones completo.
  * Detección de clics externos para cierre automático.
- **Sondeo Inteligente:** Sondea el endpoint `GET /notifications/unread-count` cada 30 segundos, manteniendo el contador sincronizado con un consumo de ancho de banda insignificante.

#### B. Centro de Notificaciones Completo ([`/notifications/page.tsx`](file:///d:/MexAgenda/apps/frontend/src/app/(dashboard)/notifications/page.tsx))
- **Filtros Rápidos:** Pestañas interactivas para alternar entre:
  * `Todas`
  * `No Leídas` (con contador dinámico)
  * `Reuniones`
  * `Acuerdos`
  * `Actas`
- **Tarjetas de Notificación:**
  * Distintivo visual en color ámbar para avisos no leídos.
  * Iconografía temática institucional (Calendario, Acuerdo, Acta, Libro).
  * Fecha y hora formateada en español institucional (`es-MX`).
  * Botón *"Ver Recurso"* con icono externo que redirige a la reunión, acuerdo o nota vinculada y marca automáticamente el aviso como leído.
  * Botón de descarte individual (*Eliminar de mi bandeja*).
- **Paginación y Estados:**
  * Controles anterior/siguiente con indicador de página activa.
  * Estados de carga mediante spinners estilizados.
  * Estados vacíos con mensaje contextual cuando no existen registros para el filtro seleccionado.

#### C. Modal de Preferencias de Notificación:
- Permite a cada funcionario personalizar de forma granular:
  * Recepción de alertas en la plataforma (In-App).
  * Recepción de avisos por correo electrónico (SMTP).
  * Suscripción por categoría: Sesiones Colegiadas, Acuerdos, Actas y Generales.
- Confirmación asíncrona mediante mensajes de estado sin abandonar la página.

---

### 3. VERIFICACIÓN RESPONSIVA EN 9 FACTORES DE FORMA

| Resolución | Dispositivo | Estado | Adaptaciones Comprobadas |
| :---: | :--- | :---: | :--- |
| **320px** | Mobile Mini (iPhone SE) | **ÓPTIMO** | Botones en fila compacta, acciones de notificación apiladas verticalmente. |
| **360px** | Android Compact | **ÓPTIMO** | Pestañas de filtro con scroll horizontal fluido sin romper el ancho del viewport. |
| **375px** | iPhone Standard | **ÓPTIMO** | Espaciado de 12px entre elementos y tipografía legible en 12px/14px. |
| **390px** | iPhone Modern | **ÓPTIMO** | Modal de preferencias centrado con margen perimetral seguro de 16px. |
| **414px** | iPhone Plus | **ÓPTIMO** | Excelente distribución de botones de acción y metadatos de fecha. |
| **768px** | iPad Portrait | **ÓPTIMO** | Disposición en dos columnas para el encabezado y botones de acción rápida. |
| **1024px**| Laptop Mini / Tablet Landscape | **ÓPTIMO** | Panel desplegable de la campana alineado al borde derecho del menú. |
| **1280px**| Desktop HD | **ÓPTIMO** | Contenedor centrado max-w-6xl con márgenes laterales balanceados. |
| **1440px**| Desktop Full HD / Widescreen | **ÓPTIMO** | Experiencia fluida de alta productividad y contraste visual institucional. |

