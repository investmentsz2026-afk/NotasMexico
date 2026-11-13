# DOCUMENTO 08: CONFIGURACIÓN DE ENTORNOS Y GESTIÓN DE VARIABLES
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 1 — Infraestructura, Monorepo, Neon PostgreSQL y Prisma  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Implementado / En Verificación  

---

## 1. MATRIZ DE ENTORNOS DE EJECUCIÓN

El sistema contempla cuatro entornos de ejecución estrictamente aislados:

```
+-----------------------------------------------------------------------------------+
|                        MATRIZ DE ENTORNOS DE EJECUCIÓN                            |
+-------------------+-------------------+--------------------+----------------------+
| VARIABLE          | DEVELOPMENT (DEV) | STAGING (QA)       | PRODUCTION (PROD)    |
+-------------------+-------------------+--------------------+----------------------+
| `NODE_ENV`        | `development`     | `staging`          | `production`         |
| `PORT`            | `4000`            | `4000`             | `4000` / Asignado    |
| `FRONTEND_URL`    | `http://localhost:3000` | `https://qa.mexagenda.org` | `https://app.mexagenda.org` |
| `DATABASE_URL`    | Neon Branch 'dev' | Neon Branch 'staging' | Neon Main / Primary |
| `DIRECT_URL`      | Neon Branch 'dev' (5432) | Neon Branch 'staging' (5432) | Neon Main (5432) |
| Errores RFC 7807  | Con detalles      | Con detalles       | Sin stacktraces      |
| Swagger Docs      | Activo (/api/docs)| Activo (Protegido) | Inactivo / Protegido |
| CORS              | Origen Local      | Subdominio Staging | Subdominio Prod      |
+-------------------+-------------------+--------------------+----------------------+
```

---

## 2. VALIDADOR ESTRICTO DE ENTORNO (`@mexagenda/validation`)

Para evitar fallos silenciosos en producción por variables ausentes o mal formadas:
- La función `validateEnvironment(process.env)` en `packages/validation/src/env.schema.ts` se ejecuta de forma síncrona en el arranque del backend.
- Comprueba:
  1. `NODE_ENV`: Obligatoriamente uno de `development`, `staging`, `production`, `test`.
  2. `PORT`: Entero válido entre 1 y 65535.
  3. `FRONTEND_URL` y `BACKEND_URL`: URLs válidas con protocolo HTTP/HTTPS.
  4. `DATABASE_URL`: Exigida terminantemente en entorno `production`.
- **Protección contra Fuga de Secretos:** Si una variable falla, el mensaje de error lista únicamente el nombre de la variable y la razón del fallo, **sin imprimir jamás su valor** en terminales ni registros de error.

---

## 3. POLÍTICA DE RESGUARDO DE ARCHIVOS `.ENV`

1. **Rastreo Prohibido:** `.env`, `.env.local` y cualquier archivo con extensión `.env*` (salvo `.env.example`) están declarados en `.gitignore`.
2. **Plantilla Documentada:** `.env.example` contiene la referencia completa con valores de marcador de posición (*placeholders*) y comentarios técnicos de configuración.
3. **Inyección en Servidores / Contenedores:** En producción, las variables se inyectan mediante el gestor de secretos de la plataforma de despliegue (ej. Railway, AWS Secrets Manager, Vercel Environment Variables o Docker Secrets), nunca mediante archivos transferidos al repositorio.
