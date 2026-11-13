# INFORME DE AUDITORÍA FASE 6 — DOCUMENTO 10
## AUDITORÍA DE ELIMINACIÓN LÓGICA (SOFT DELETE) Y RESTAURACIÓN ADMINISTRATIVA
### MÓDULO: MOD-05 — BÓVEDA DIGITAL Y GESTIÓN SEGURA DE ARCHIVOS ADJUNTOS (S3)

---

### 1. PRINCIPIO DE RETENCIÓN DOCUMENTAL Y POLÍTICA DE PURGA

En plataformas de gestión pública institucional, el borrado físico inmediato de expedientes o archivos adjuntos (*Hard Delete*) constituye un riesgo legal crítico que puede violar normativas de transparencia y archivo patrimonial.

Por ello, la Fase 6 de MexAgenda establece que:
1. Ninguna acción de usuario común debe purgar físicamente un archivo o registro relacional.
2. La eliminación debe ser estrictamente lógica (**Soft Delete**).
3. Los objetos binarios deben ser retenidos en el storage para auditorías forenses posteriores.
4. Solo un usuario con privilegios de administración y el permiso `document:admin:manage` puede revertir un borrado lógico mediante un proceso de restauración auditado.

---

### 2. AUDITORÍA DEL MECANISMO DE BORRADO LÓGICO (`DELETE /api/documents/:id`)

Se analizó la implementación en [`documents.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/documents.service.ts):

```typescript
async remove(id: string, user: AuthUser): Promise<void> {
  const doc = await this.prisma.attachment.findUnique({
    where: { id },
  });

  if (!doc || doc.deletedAt) {
    throw new NotFoundException('Documento no encontrado o ya eliminado.');
  }

  // Validación de permisos de autoría o administración
  if (doc.uploadedById !== user.id && user.role !== 'ROLE_ADMIN') {
    throw new ForbiddenException('No tiene privilegios para eliminar este documento.');
  }

  // Soft delete en Neon PostgreSQL
  await this.prisma.attachment.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: user.id,
    },
  });

  await this.auditService.logEvent({
    action: 'DOCUMENT_SOFT_DELETED',
    status: 'SUCCESS',
    userId: user.id,
    entityType: 'ATTACHMENT',
    entityId: id,
  });
}
```

#### Verificaciones Empíricas en Base de Datos:
1. **Conservación del Registro SQL:**
   - Tras ejecutar `DELETE /api/documents/:id`, se constató en PostgreSQL que la fila en `attachments` sigue existiendo.
   - El campo `deleted_at` contiene el timestamp exacto UTC de la operación.
   - El campo `deleted_by_id` conserva la referencia UUID de quien ordenó la baja.
2. **Retención de Versiones:**
   - Las filas en `attachment_versions` correspondientes al documento permanecieron intactas.
3. **Persistencia del Archivo Físico:**
   - Se verificó en el directorio de almacenamiento `storage/vault/` (o bucket S3) que el binario físico **no fue borrado**. Sigue presente y accesible para peritajes forenses.

---

### 3. EXCLUSIÓN EN CONSULTAS GENERALES Y CATÁLOGO ACTIVO

Se auditó el comportamiento de los endpoints de lectura ante documentos con soft delete:

1. **Listado General (`GET /api/documents`):**
   - El servicio inyecta por defecto la condición:
     ```typescript
     where: {
       deletedAt: null,
       ...
     }
     ```
   - El documento eliminado desaparece de la vista de todos los usuarios institucionales regulares y del catálogo de la bóveda digital.
2. **Consulta Directa (`GET /api/documents/:id`):**
   - Al intentar consultar el ID de un documento con `deletedAt IS NOT NULL`, el backend retorna un **HTTP 404 No Encontrado**, impidiendo que usuarios no administradores confirmen la existencia o descarguen el archivo.

---

### 4. AUDITORÍA DEL PROCEDIMIENTO DE RESTAURACIÓN (`POST /api/documents/:id/restore`)

Se evaluó la reversión del borrado lógico en [`documents.service.ts`](file:///d:/MexAgenda/apps/backend/src/modules/documents/documents.service.ts):

1. **Restricción Exclusiva por RBAC:**
   - Protegido por el permiso específico `@RequirePermissions('document:admin:manage')`.
   - Se intentó restaurar utilizando credenciales de un usuario regular (`ROLE_USER`).
   - **Resultado:** **HTTP 403 Forbidden**. El usuario regular no puede auto-restaurar documentos.
2. **Ejecución Administrativa Exitosa:**
   - Invocado por un administrador institucional (`ROLE_ADMIN`):
     ```typescript
     await this.prisma.attachment.update({
       where: { id },
       data: {
         deletedAt: null,
         deletedById: null,
       },
     });
     ```
   - El registro se reactiva en Neon PostgreSQL (`deleted_at = NULL`).
   - El documento reaparece inmediatamente en el catálogo institucional y en los expedientes colegiados asociados.
3. **Trazabilidad Institucional:**
   - La restauración emite un evento en `audit_logs` con la acción `DOCUMENT_RESTORED` y el identificador del administrador responsable.

**Conclusión:** El ciclo de vida de baja y restauración documental garantiza la máxima seguridad jurídica institucional, erradicando el riesgo de destrucción arbitraria o irrecuperable de información.

