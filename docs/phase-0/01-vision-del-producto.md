# DOCUMENTO 01: VISIÓN DEL PRODUCTO
## Sistema Privado de Gestión Institucional (MexAgenda)
**Fase:** 0 — Análisis, Planificación y Especificación Técnica  
**Versión:** 1.0.0  
**Fecha:** Noviembre 2026  
**Estado:** Para Revisión y Aprobación  

---

## 1. RESUMEN EJECUTIVO

El **Sistema Privado de Gestión Institucional** es una plataforma web colaborativa de acceso estrictamente restringido, concebida para satisfacer las necesidades críticas de gobernanza, documentación, deliberación y seguimiento de acuerdos de cuerpos colegiados, consejos directivos, comités ejecutivos y equipos de alta dirección en instituciones mexicanas.

En el contexto institucional mexicano, la toma de decisiones colegiada genera un caudal significativo de información altamente confidencial: actas, deliberaciones previas, anotaciones individuales de los consejeros, acuerdos vinculantes con plazos legales o estatutarios, y expedientes documentales de soporte. La dispersión de estos activos en correos electrónicos personales, servicios de mensajería instantánea comercial (como WhatsApp o Telegram) o carpetas compartidas sin control de acceso granular expone a la institución a severos riesgos de fuga de información, pérdida de trazabilidad jurídica, incumplimiento de deberes fiduciarios y vulneraciones a la legislación de protección de datos personales.

La plataforma resuelve esta problemática centralizando en un entorno soberano, auditable y seguro el ciclo de vida completo de las sesiones institucionales (ordinarias, extraordinarias, comités de trabajo y sesiones especiales), garantizando el principio de **transparencia interna compartida con estricta soberanía de autoría individual**.

---

## 2. DECLARACIÓN DEL PROBLEMA Y OPORTUNIDAD

### 2.1. Diagnóstico del Estado Actual
1. **Dispersión y Desorganización de la Información:** Las convocatorias, anexos, acuerdos y minutas circulan mediante canales heterogéneos y no correlacionados, imposibilitando la reconstrucción fehaciente de discusiones institucionales pasadas.
2. **Falta de Trazabilidad y Asignación de Compromisos:** Los acuerdos tomados en sesiones carecen de un motor centralizado de monitoreo con asignación nominal de responsables y alertas de vencimiento, derivando en retrasos o incumplimientos institucionales.
3. **Inseguridad en Anotaciones Particulares:** Los consejeros o vocales requieren realizar observaciones personales durante las sesiones, las cuales deben ser legibles para sus pares para enriquecer la deliberación común, pero con la garantía inquebrantable de que ningún tercero pueda alterar, suplantar o borrar sus opiniones.
4. **Ausencia de Auditoría Forense:** Inexistencia de registros de auditoría inmutables que permitan certificar quién accedió, visualizó, descargó o modificó un documento o acuerdo sensible.
5. **Riesgos de Cumplimiento Normativo en México:** Exposición a sanciones derivadas de la *Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)* o la *Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados (LGPDPPSO)*, por carecer de controles de acceso robustos, cifrado de datos en reposo y tránsito, y mecanismos formales de custodia.

### 2.2. La Oportunidad de Solución
La creación de una solución a medida (*custom-built*), sustentada en una arquitectura moderna basada en NestJS, Next.js, PostgreSQL (Neon) y almacenamiento de objetos compatible con S3, que proporcione:
- Privacidad absoluta (cero registro público; aprovisionamiento exclusivo por administración).
- Transparencia deliberativa con inmutabilidad de autoría en anotaciones individuales.
- Control documental con verificación criptográfica y URLs firmadas de vida efímera.
- Auditoría técnica y funcional integral y a prueba de manipulaciones.

---

## 3. PÚBLICO OBJETIVO Y ACTORES DEL SISTEMA

El sistema está diseñado para un grupo selecto y acotado de usuarios institucionales (generalmente entre 10 y 150 miembros concurrentes por instancia), clasificados en dos arquetipos fundamentales:

### 3.1. Arquetipo 1: Administrador Institucional (Superintendente / Secretario de Actas / Oficial de Cumplimiento)
- **Perfil:** Personal técnico o jurídico-administrativo responsable del control operativo, seguridad y gobernanza de la plataforma.
- **Necesidades Clave:**
  - Aprovisionar, suspender o dar de baja cuentas de usuario de forma inmediata.
  - Configurar taxonomías y clasificaciones de sesiones acordes a la normativa de la entidad.
  - Monitorear el registro unificado de auditoría.
  - Realizar intervenciones administrativas de emergencia (con trazabilidad total y retención del histórico original intacto).
  - Gestionar configuraciones de seguridad global (políticas de contraseñas, sesiones, MFA).

### 3.2. Arquetipo 2: Usuario Institucional (Consejero, Director de Área, Vocal, Integrante de Mesa)
- **Perfil:** Miembro activo con voz y/o voto que participa en las reuniones y da seguimiento a compromisos.
- **Necesidades Clave:**
  - Consultar en un único panel la agenda institucional, reuniones programadas, órdenes del día y anexos.
  - Crear y plasmar sus anotaciones y reflexiones en tiempo real o diferido durante una reunión.
  - Leer de forma transparente y abierta las anotaciones de sus pares para una mejor deliberación.
  - Modificar únicamente sus propias anotaciones, con versionado automático.
  - Consultar y actualizar el estado de los acuerdos y compromisos donde fue designado responsable.
  - Descargar expedientes documentales bajo controles de seguridad transparentes y rápidos.

---

## 4. PROPUESTA DE VALOR Y PILARES ESTRATÉGICOS

```
+---------------------------------------------------------------------------------+
|                     PILARES DEL SISTEMA MEXAGENDA                               |
+-------------------+--------------------+--------------------+-------------------+
|  1. INTEGRIDAD    |  2. TRANSPARENCIA  |    3. GOBERNANZA   |  4. SIMPLICIDAD   |
|  Y SEGURIDAD      |     DELIBERATIVA   |    Y SEGUIMIENTO   |     Y EFICIENCIA  |
|                   |                    |                    |                   |
| - Cero registro   | - Lectura cruzada  | - Acuerdos con     | - UI minimalista  |
|   abierto.        |   de notas entre   |   responsables y   |   y accesible.    |
| - MFA TOTP        |   miembros.        |   plazos fatales.  | - Rápida curva    |
|   obligatorio.    | - Modificación     | - Ciclo de vida    |   de adopción.    |
| - Argon2id.       |   estrictamente    |   de reuniones.    | - Experiencia     |
| - Cifrado TLS     |   restringida al   | - Historial de     |   óptima en PC,   |
|   1.3 y AES-256.  |   autor original.  |   versiones.       |   tablet y móvil. |
| - Anti-IDOR/BOLA. | - Auditoría total. | - Indicadores.     | - Cero fricción.  |
+-------------------+--------------------+--------------------+-------------------+
```

1. **Integridad y Seguridad por Diseño (*Security by Design*):** Ningún recurso es accesible sin autenticación previa y verificación estricta de permisos en backend. La infraestructura y las políticas de desarrollo mitigan preventivamente las vulnerabilidades de OWASP Top 10 y OWASP API Security Top 10.
2. **Transparencia Deliberativa con Soberanía de Autoría:** Todo integrante puede leer los comentarios de sus compañeros, garantizando alineación y debate constructivo; sin embargo, nadie puede editar las palabras ajenas. Si un administrador requiere intervenir por mandato institucional, la plataforma archiva la versión previa y sella la acción en la bitácora de auditoría.
3. **Gobernanza Institucional y Eficacia Operativa:** Los acuerdos no quedan perdidos en actas en papel o PDFs estáticos; se convierten en entidades vivas con responsables nominales, estados dinámicos (*Pendiente*, *En proceso*, *Completado*, *Cancelado*) y métricas de cumplimiento visibles en el Dashboard.
4. **Experiencia de Usuario Sobria y Adaptativa:** Interfaz gráfica ejecutiva, desarrollada con Tailwind CSS y Next.js, con paleta cromática sobria (azul marino institucional `#0F172A`, gris técnico `#F8FAFC`/`#E2E8F0`, y acentos discretos), perfectamente legible y operable en navegadores de escritorio, tabletas ejecutivas (iPad / Android) y teléfonos móviles.

---

## 5. ALCANCE DEL PRODUCTO (IN-SCOPE VS. OUT-OF-SCOPE)

### 5.1. Dentro del Alcance (Fases 0 a 9)
- Sistema web completo (Frontend Next.js + Backend NestJS + PostgreSQL Neon + Almacenamiento S3).
- Módulo de Autenticación con MFA TOTP y protección contra ataques de fuerza bruta.
- Gestión de Usuarios con perfiles, roles iniciales (`ADMINISTRADOR`, `USUARIO`) y revocación inmediata de sesiones.
- Clasificación dinámica de reuniones con ordenamiento y métricas.
- Gestión integral del ciclo de vida de reuniones (agenda, ubicación/enlace virtual, orden del día, desarrollo, estados).
- Módulo de Anotaciones Personales con visibilidad compartida, bloqueo de edición cruzada y versionado completo.
- Módulo de Acuerdos y Compromisos con asignación nominal, plazos límite y control de cambios.
- Repositorio documental con validación profunda de tipo MIME (magic bytes), escaneo preventivo y pre-firmado de URLs temporales.
- Motor de búsqueda facetado por fechas, categorías, texto libre, participantes y estados.
- Sistema de Auditoría exhaustivo, inmutable y protegido contra borrado o alteración.
- Dashboard ejecutivo con métricas de gestión y accesos rápidos.

### 5.2. Fuera del Alcance Inicial (A evaluar en futuras evoluciones post-lanzamiento)
- Transmisión o videoconferencia nativa integrada (tipo WebRTC / Zoom / Meet): la plataforma contendrá enlaces seguros a salas externas (Teams, Meet, Zoom), pero no procesará flujos de video/audio en vivo.
- Firma Electrónica Avanzada vinculada al SAT/e.firma (FIEL): se contemplará la arquitectura para facilitar su integración futura, pero el alcance base operará con sellos de tiempo y firmas digitales criptográficas internas.
- Aplicaciones móviles nativas (iOS Swift / Android Kotlin): se suministrará una Progressive Web App (PWA) responsiva optimizada para navegadores móviles.
- Registro o autoregistro público de usuarios vía web: expresamente prohibido por mandato institucional.

---

## 6. FACTORES CRÍTICOS DE ÉXITO (CSFs)
1. **Adopción Inmediata por el Consejo / Equipo:** Que los consejeros utilicen activamente la plataforma durante las sesiones para consultar el expediente y plasmar sus notas, prescindiendo del papel o de medios inseguros.
2. **Cero Incidentes de Modificación No Autorizada:** Verificación infalible de que ninguna nota ajena pueda ser adulterada por otro usuario o por inyección de parámetros.
3. **Disponibilidad y Confiabilidad:** Tiempo de actividad (*uptime*) objetivo de 99.9% durante días hábiles y periodos de sesiones convocadas.
4. **Cumplimiento de Plazos de Acuerdos:** Reducción medible del extravío de compromisos institucionales gracias al seguimiento automatizado.
5. **Trazabilidad Forense:** Capacidad de reconstruir con precisión de segundos cualquier evento o cambio ocurrido en la plataforma.

