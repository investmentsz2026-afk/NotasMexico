# PRUEBAS FUNCIONALES AUTOMATIZADAS — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)

### 1. ALCANCE Y METODOLOGÍA

Las pruebas funcionales de la Fase 6 fueron implementadas en el script automatizado `scripts/test-phase6.js` y ejecutadas directamente contra la base de datos de producción **Neon PostgreSQL Serverless**, verificando la funcionalidad completa de la bóveda documental y su ciclo de vida.

Comando de ejecución:
```bash
pnpm test:phase6
```

---

### 2. MATRIZ DE RESULTADOS DE PRUEBAS FUNCIONALES

| Código | Prueba Funcional | Comportamiento Esperado | Resultado | Latencia |
| :--- | :--- | :--- | :---: | :---: |
| **DOC-01** | Integridad del esquema en Neon | Tablas `attachments` y `attachment_versions` operativas con claves foráneas. | **PASSED** | 3,242 ms |
| **DOC-02** | Catálogo de permisos RBAC | 8 permisos `document:*` registrados y asignados a `ROLE_ADMIN` y `ROLE_USER`. | **PASSED** | 1,443 ms |
| **DOC-03** | Carga de PDF legítimo (%PDF-) | Registro exitoso, cálculo exacto de SHA-256 y versionado inicial `v1`. | **PASSED** | 4,002 ms |
| **DOC-06** | Límite máximo de tamaño | Archivo de 26 MB es rechazado antes de consumir almacenamiento. | **PASSED** | 1 ms |
| **DOC-07** | Control de archivo vacío | Archivo de 0 bytes es rechazado con mensaje descriptivo. | **PASSED** | 1 ms |
| **DOC-08** | Generación de URL presignada | Devuelve URL firmada temporal con TTL estricto de 300 segundos. | **PASSED** | 1,021 ms |
| **DOC-09** | Integridad de descarga | Contenido descargado coincide byte por byte con el hash SHA-256 registrado. | **PASSED** | 2 ms |
| **DOC-13** | Descarga por autor de nota | Autor de la nota privada descarga exitosamente su archivo adjunto. | **PASSED** | 685 ms |
| **DOC-14** | Supervisión administrativa | `ROLE_ADMIN` accede a archivo adjunto de nota privada para auditoría. | **PASSED** | 683 ms |
| **DOC-15** | Vinculación institucional | Documento vinculado a reunión (`Meeting`) y acuerdo colegiado (`Agreement`). | **PASSED** | 1,813 ms |
| **DOC-16** | Versionado incremental v2 | Carga de nueva versión genera `v2` con nuevo hash y registro histórico. | **PASSED** | 1,362 ms |
| **DOC-17** | Historial de versiones | Consulta de versiones devuelve registros inmutables ordenados descendente. | **PASSED** | 563 ms |
| **DOC-18** | Modificación de metadatos | Propietario actualiza metadatos y tercero no autorizado es bloqueado. | **PASSED** | 1,482 ms |
| **DOC-19** | Eliminación suave (Soft Delete)| Archivo marcado con `isDeleted=true` y retirado de consultas ordinarias. | **PASSED** | 2,110 ms |
| **DOC-20** | Restauración administrativa | `ROLE_ADMIN` restaura documento eliminado mediante `document:admin:manage`.| **PASSED** | 2,758 ms |
| **DOC-22** | Auditoría forense | Verificación de asientos `DOCUMENT_UPLOADED` y `DOCUMENT_DOWNLOADED`. | **PASSED** | 457 ms |

---

### 3. RESUMEN DE EJECUCIÓN

- **Total Pruebas Funcionales Evaluadas:** 16 pruebas funcionales directas (dentro de la suite de 22 pruebas globales).
- **Pruebas Aprobadas:** 16 (100%).
- **Pruebas Fallidas:** 0.
- **Estatus Funcional:** SATISFACTORIO.

