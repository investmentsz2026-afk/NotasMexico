# PRUEBAS DE SEGURIDAD Y CONTROL DE PRIVACIDAD — FASE 6
## MEXAGENDA: BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)

### 1. OBJETIVO DE LAS PRUEBAS DE SEGURIDAD

Comprobar mediante pruebas negativas y vectores de ataque simulados que la bóveda digital es inmune a las vulnerabilidades más comunes en sistemas de gestión documental:

- Ataques de suplantación de tipo MIME (MIME Spoofing / Polyglot files).
- Carga de extensiones peligrosas (.exe, .sh, .bat).
- Denegación de servicio por agotamiento de almacenamiento.
- Acceso no autorizado a documentos de notas privadas (Anti-IDOR / Anti-BOLA).
- Descargas mediante enlaces manipulados (Anti-Tampering).
- Descarga de archivos marcados como malware (Quarantine Enforcement).

---

### 2. MATRIZ DE PRUEBAS DE SEGURIDAD (NEGATIVAS Y DE INTRUSIÓN)

| Código | Vector de Ataque / Prueba de Seguridad | Comportamiento Esperado | Resultado | Latencia |
| :--- | :--- | :--- | :---: | :---: |
| **DOC-04** | Carga de archivo malicioso con extensión `.exe` | Rechazo inmediato con error 400 Bad Request antes de procesar el archivo. | **PASSED** | 3 ms |
| **DOC-05** | MIME Spoofing: Payload HTML/Script camuflado con extensión `.pdf` | Detección de magic bytes inválidos (`<html` vs `%PDF-`) y rechazo con error 400. | **PASSED** | 0 ms |
| **DOC-06** | Carga de archivo gigante que supera límite de 25 MB | Rechazo inmediato con error 400 sin guardar en almacenamiento ni base de datos. | **PASSED** | 1 ms |
| **DOC-07** | Carga de archivo vacío (0 bytes) | Rechazo con error 400 ("El archivo está vacío"). | **PASSED** | 1 ms |
| **DOC-10** | Anti-Tampering: Descarga con firma HMAC adulterada en URL presignada | Validación criptográfica en tiempo constante rechaza el enlace con HTTP 403. | **PASSED** | 1 ms |
| **DOC-11** | Anti-IDOR: Usuario B intenta adjuntar archivo a nota privada de Usuario A | Validación de autoría bloquea la operación con HTTP 403 Forbidden. | **PASSED** | 113 ms |
| **DOC-12** | Anti-IDOR: Usuario B intenta generar URL de descarga para nota privada ajena | Bloqueo estricto con HTTP 403 Forbidden y registro de auditoría `DENIED`. | **PASSED** | 681 ms |
| **DOC-21** | Cuarentena de Malware: Descarga de archivo marcado como `INFECTADO` | Bloqueo estricto para usuarios ordinarios con HTTP 403 Forbidden. | **PASSED** | 3,373 ms |
| **DOC-22** | Registro forense de ataques | Confirmación en `audit_logs` del evento `UNAUTHORIZED_DOCUMENT_ACCESS_ATTEMPT`. | **PASSED** | 457 ms |

---

### 3. EVIDENCIAS FORENSES EN BASE DE DATOS (NEON POSTGRESQL)

Durante la ejecución de las pruebas `DOC-11` y `DOC-12`, se constató la inserción automática del registro forense en la tabla `audit_logs`:

```json
{
  "actorId": "39596f92-dbdc-4760-bd2a-ec9b56160692",
  "action": "UNAUTHORIZED_DOCUMENT_ACCESS_ATTEMPT",
  "entity": "Attachment",
  "entityId": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
  "outcome": "DENIED",
  "diffPayload": {
    "reason": "Intento de acceso a archivo de nota privada ajena"
  },
  "ipAddress": "127.0.0.1",
  "createdAt": "2026-11-05T20:09:59.000Z"
}
```

---

### 4. DICTAMEN DE SEGURIDAD

- **Inmunidad a MIME Spoofing:** Verificada (100%).
- **Aislamiento Anti-IDOR en notas privadas:** Verificado (100%).
- **Anti-Tampering en enlaces temporales:** Verificado (100%).
- **Estatus de Seguridad:** APROBADA SIN VULNERABILIDADES CRÍTICAS.

