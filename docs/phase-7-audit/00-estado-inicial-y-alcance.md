# Auditoría Fase 7 — 00. Diagnóstico Inicial, Entorno y Alcance

## 1. Identificación del Entorno y Estado del Repositorio

- **Rama Git:** `master`
- **Commit Base:** `40d300c22b1d4e596a0f8e16f60821e43dbd53de` (docs(phase-1-2): auditoria final de Fase 1 con Neon PostgreSQL y plan tecnico de Fase 2).
- **Estado del Árbol de Trabajo:** Modificaciones acumuladas de Fase 2 a Fase 7 presentes en el working tree sin comprometer la integridad histórica.
- **Entorno de Base de Datos:** Neon PostgreSQL Serverless (`neondb` en `ep-plain-hill-benz8lhm.c-9.us-east-2.aws.neon.tech`).
- **Entorno de Cola / Worker:** PostgreSQL Transactional Outbox (`notification_deliveries`) con `OutboxWorkerService` en segundo plano. Sockets locales `127.0.0.1:6379` inactivos (Redis no presente localmente).
- **Entorno de Correo SMTP:** Nodemailer con detección automática de credenciales; activo en **Mock Transporter** en memoria debido a la ausencia de servidor SMTP de retransmisión real en desarrollo local.

> [!NOTE]
> **Declaración de Limitación:** El informe entregado por el equipo de implementación no especificaba un hash de commit aislado, dado que el desarrollo se mantuvo en el árbol de trabajo continuo sobre `master`. El equipo auditor auditó el estado reproducible disponible en dicho árbol de trabajo, manteniendo el código fuente intacto.

---

## 2. Alcance de la Auditoría Independiente

La auditoría independiente abarca la comprobación rigurosa de:
1. **Control de Acceso y RBAC:** Existencia y correcta asignación de los 4 permisos `notification:*`, así como la validación negativa frente a usuarios ordinarios.
2. **Aislamiento Multi-usuario (Anti-IDOR):** Imposibilidad de consultar, marcar como leídas o eliminar notificaciones pertenecientes a terceros.
3. **Privacidad Institucional de Notas:** Cumplimiento de la regla innegociable de no emitir notificaciones para notas personales con visibilidad `PRIVADA`.
4. **Resiliencia del Transactional Outbox:** Idempotencia, política de reintentos máximos (3), retroceso exponencial (`2^attempts` minutos) y recuperación ante caídas.
5. **Servicio SMTP y Sanitización:** Comportamiento del Mock Transporter, validación sintáctica de buzones y enmascaramiento de PII en registros.
6. **Compilación y Regresión Histórica:** Ejecución completa de las suites históricas (Fases 2, 3, 4, 5, 6 y 7) y verificación del build de producción del monorepo.

