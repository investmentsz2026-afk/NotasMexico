# DOCUMENTO 03: CONFIGURACIÓN TÉCNICA DEL FRONTEND (NEXT.JS)
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 1 — Infraestructura, Monorepo, Neon PostgreSQL y Prisma  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Implementado / En Verificación  

---

## 1. VISIÓN DEL FRONTEND INSTITUCIONAL

El frontend de **MexAgenda** se implementa con **Next.js 15 (App Router)**, **TypeScript en modo estricto** y **Tailwind CSS**. Está diseñado para ofrecer una experiencia ejecutiva rápida, sobria y accesible en cuerpos colegiados de México, soportando pantallas desde teléfonos inteligentes de 320px hasta monitores de escritorio de alta resolución.

### Principios de Implementación:
- **Server Components por Defecto:** Reduce la cantidad de JavaScript transmitido al navegador y acelera los tiempos de renderizado inicial (*FCP < 1.2s*).
- **Client Components Estratégicos:** Reservados para componentes con interacción en tiempo real (ej. panel de diagnóstico `/status` y futuros muros deliberativos interactivos).
- **Cero Credenciales:** El frontend no aloja credenciales de base de datos ni tokens fijos; opera con cookies seguras `HttpOnly` y variables públicas prefijadas con `NEXT_PUBLIC_`.

---

## 2. CONFIGURACIÓN DE NEXT.JS (`next.config.ts`)

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Oculta encabezado 'x-powered-by: Next.js'
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' }, // Previene Clickjacking
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 3. IDENTIDAD VISUAL Y TAILWIND CSS

El archivo `tailwind.config.ts` define los tokens cromáticos institucionales aprobados:

- **Azul Marino Institucional (`#0F172A` - `institutional.navy`):** Color dominante en cabeceras, botones primarios y títulos principales.
- **Pizarra Obscura (`#1E293B` - `institutional.slate`):** Contenedores secundarios y tarjetas de contraste.
- **Gris Claro de Fondo (`#F8FAFC` - `institutional.bg`):** Fondo general limpio y descansado para lectura prolongada de actas y minutas.
- **Bordes y Separadores (`#E2E8F0` - `institutional.border`):** Delimitación nítida de cuadrículas y tablas.
- **Acentos Institucionales (`#1E3A8A` / `#2563EB`):** Enlaces e indicadores de foco accesibles.

---

## 4. ESTRUCTURA DE PÁGINAS Y RUTAS (FASE 1)

```text
apps/frontend/src/app/
├── globals.css          # Directivas Tailwind y variables de tema
├── layout.tsx           # Layout raíz con cabecera institucional, metadata y footer
├── page.tsx             # Página principal ejecutiva con resumen de Fase 1
├── status/
│   └── page.tsx         # Panel interactivo de diagnóstico (/status)
├── not-found.tsx        # Vista institucional de recurso no encontrado (404)
└── error.tsx            # Capturador de excepciones y límites de error (Error Boundary)
```

### Funcionalidad del Panel de Diagnóstico (`/status`):
- Consulta de forma asíncrona el endpoint `GET /api/v1/health` del backend NestJS.
- Muestra el estado operativo de los cuatro pilares: Frontend, Backend API, Neon PostgreSQL y Gobernanza de Seguridad.
- Ofrece actualización manual y despliegue del payload JSON crudo para auditoría técnica.
