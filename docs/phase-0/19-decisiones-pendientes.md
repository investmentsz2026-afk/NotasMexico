# DOCUMENTO 19: LISTA DE DECISIONES TÉCNICAS PENDIENTES Y RECOMENDACIONES
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. INTRODUCCIÓN

En apego a la **Regla de Trabajo 1 y 14** (*"No inventar requisitos que el cliente no haya confirmado, presentar recomendaciones justificadas y alternativas"*), este documento consolida las cinco decisiones de ingeniería y operativas que quedan sujetas a ratificación del comité de dirección técnica antes o durante la ejecución de las fases correspondientes.

---

## 2. CATÁLOGO DE DECISIONES TÉCNICAS

```
+-----------------------------------------------------------------------------------+
|                        MATRIZ DE DECISIONES TÉCNICAS                              |
+----+---------------------------------------------------+--------------------------+
| ID | Decisión Técnica Evaluada                         | Recomendación Senior     |
+----+---------------------------------------------------+--------------------------+
| D1 | Estrategia de Sesiones: Sesiones BD vs JWT Puro   | Sesión Híbrida en BD     |
| D2 | Proveedor Específico de Almacenamiento S3         | Cloudflare R2 / AWS S3   |
| D3 | Motor de Escaneo Antivirus para la Bóveda         | Worker ClamAV Aislado    |
| D4 | Mecanismo de Sincronización en Vivo de Sesiones   | Polling SWR / SSE        |
| D5 | Motor de Edición Enriquecida para Minutas y Notas | TipTap / ProseMirror     |
+----+---------------------------------------------------+--------------------------+
```

---

### DECISIÓN D1: Estrategia de Sesión y Manejo de Tokens
- **Contexto:** La plataforma exige la revocación inmediata e incontestable de sesiones cuando un usuario es suspendido o bloqueado administrativamente.
- **Alternativas Evaluadas:**
  - *Alternativa A (JWT Puro sin Estado):* Tokens autocontenidos. **Desventaja:** No permite la invalidación instantánea antes de que expire el TTL del token sin incorporar una lista de revocación pesada.
  - *Alternativa B (Sesiones 100% en Base de Datos):* Cada petición valida el token en la tabla `user_sessions`. **Ventaja:** Revocación instantánea garantizada al actualizar `is_revoked = true`.
  - *Alternativa C (Híbrido con Redis / Cache en Memoria):* Sesiones en memoria. **Desventaja:** Añade un componente de infraestructura adicional (Redis) que incrementa costos y complejidad operativa.
- **Recomendación del Equipo Senior:** **Alternativa B (Sesiones en Neon PostgreSQL mediante la tabla `user_sessions` y Connection Pooler).**
- **Justificación:** Dado el tamaño acotado de usuarios institucionales (10 a 150 concurrentes), una consulta indexada por llave primaria sobre la tabla `user_sessions` toma menos de 2 milisegundos en Neon. Garantiza revocación inmediata sin requerir infraestructura externa de Redis.

---

### DECISIÓN D2: Proveedor Específico de Almacenamiento Compatible con S3
- **Contexto:** Se requiere almacenamiento privado para los anexos de reuniones y notas, compatible con la API de AWS S3 para generación de URLs pre-firmadas.
- **Alternativas Evaluadas:**
  - *Alternativa A (AWS S3 Estándar):* Máxima madurez y cumplimiento normativo en Norteamérica. Costos por transferencia de salida (*egress*).
  - *Alternativa B (Cloudflare R2):* 100% compatible con API S3, excelente integración con la red perimetral de Cloudflare y **cero costos de transferencia de salida (*zero egress fees*)**.
  - *Alternativa C (MinIO Autogestionado):* Alojado en servidor propio. Requiere administración manual de parches de seguridad y almacenamiento físico.
- **Recomendación del Equipo Senior:** **Alternativa B (Cloudflare R2) o Alternativa A (AWS S3) según contratos existentes de la institución.**
- **Justificación:** El uso de la biblioteca oficial `@aws-sdk/client-s3` en NestJS permite que el backend sea agnóstico; la elección final de R2 o AWS S3 solo variará una variable de entorno (`S3_ENDPOINT`) sin modificar una sola línea de código.

---

### DECISIÓN D3: Motor de Escaneo Antivirus para la Bóveda Documental
- **Contexto:** Validar que los archivos PDF, Word o Excel cargados no contengan código malicioso incrustado.
- **Alternativas Evaluadas:**
  - *Alternativa A (APIs Públicas de Terceros, ej. VirusTotal):* **Inadmisible:** Violaría el deber de confidencialidad y la legislación de protección de datos al transmitir documentos institucionales reservados a terceros.
  - *Alternativa B (Worker Interno con ClamAV en Contenedor):* Motor de código abierto ejecutado en la red privada de la institución. Cero fuga de información.
  - *Alternativa C (AWS GuardDuty para S3):* Escaneo nativo en la nube gestionado por AWS si se elige AWS S3.
- **Recomendación del Equipo Senior:** **Alternativa B (Contenedor ClamAV en red privada) o Alternativa C si la institución opera en AWS.**
- **Justificación:** Garantiza la soberanía y confidencialidad absoluta de los expedientes deliberativos.

---

### DECISIÓN D4: Mecanismo de Sincronización en Vivo durante Sesiones Concurrentes
- **Contexto:** Durante una sesión en curso, múltiples integrantes agregan notas o se registran acuerdos. ¿Cómo se refresca la vista de los demás consejeros?
- **Alternativas Evaluadas:**
  - *Alternativa A (WebSockets Bidireccionales continuos):* Mantiene conexiones TCP persistentes. Requiere gestión de estados de reconexión y balanceo de carga con *sticky sessions*.
  - *Alternativa B (Server-Sent Events - SSE):* Flujo unidireccional ligero desde el servidor. Ideal para actualizaciones de estado.
  - *Alternativa C (Polling Inteligente con TanStack Query / SWR):* Sondeo periódico cada 10 a 15 segundos únicamente mientras la pestaña del navegador está activa y la sesión está en estado `EN_DESARROLLO`.
- **Recomendación del Equipo Senior:** **Alternativa C (Polling Inteligente con SWR/React Query) para la Fase 4 y 5, con evolución a SSE en caso de requerirse mayor inmediatez.**
- **Justificación:** Con un número reducido de miembros (10 a 150), un polling cada 15 segundos genera una carga trivial sobre el backend NestJS (menos de 5 peticiones ligeras por segundo en total) y ofrece una resiliencia inmensamente superior frente a microcortes de red en dispositivos móviles o Wi-Fi institucional.

---

### DECISIÓN D5: Motor de Edición Enriquecida para Minutas y Anotaciones
- **Contexto:** Consejeros y secretarios requieren formatear texto (negritas, viñetas, listas ordenadas, citas de artículos).
- **Alternativas Evaluadas:**
  - *Alternativa A (Markdown Puro en Textarea):* Extremadamente ligero y seguro, pero puede resultar incómodo para consejeros no técnicos.
  - *Alternativa B (TipTap / ProseMirror):* Editor WYSIWYG headless moderno, accesible y tipado, que genera y consume Markdown o JSON estructurado.
  - *Alternativa C (CKEditor / TinyMCE Clásico):* Genera código HTML complejo con riesgo de desbordamientos de estilo y mayor superficie de XSS.
- **Recomendación del Equipo Senior:** **Alternativa B (TipTap basado en ProseMirror).**
- **Justificación:** Ofrece una experiencia ejecutiva intuitiva tipo Notion o Google Docs para los consejeros, pero persiste el contenido como Markdown estructurado limpio o JSON sanitizado, permitiendo calcular fácilmente diffs de versiones y garantizando máxima seguridad contra XSS.

