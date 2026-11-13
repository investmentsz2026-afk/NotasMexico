import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from './storage/storage.service';
import { validateFile, sanitizeFilename, scanFileContent } from './security/magic-bytes.validator';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import {
  AuthUser,
  DocumentListItemDto,
  DocumentDetailDto,
  DownloadUrlDto,
  PaginatedResponse,
  FileScanStatus,
} from '@mexagenda/shared';
import { AuditOutcome, Prisma } from '@prisma/client';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  private mapToListItem(doc: any): DocumentListItemDto {
    return {
      id: doc.id,
      originalFilename: doc.originalFilename,
      storageKey: doc.storageKey,
      mimeType: doc.mimeType,
      fileSizeBytes: Number(doc.fileSizeBytes),
      sha256Checksum: doc.sha256Checksum,
      category: doc.category,
      description: doc.description,
      storageProvider: doc.storageProvider,
      bucketName: doc.bucketName,
      scanStatus: doc.scanStatus,
      isArchived: doc.isArchived,
      version: doc.version,
      meetingId: doc.meetingId,
      agreementId: doc.agreementId,
      personalNoteId: doc.personalNoteId,
      minutesId: doc.minutesId,
      uploader: {
        id: doc.uploader?.id || doc.uploadedById,
        fullName: doc.uploader ? `${doc.uploader.firstName} ${doc.uploader.lastName}`.trim() : 'Usuario',
        email: doc.uploader?.email || '',
      },
      meeting: doc.meeting ? { id: doc.meeting.id, folio: doc.meeting.folio, title: doc.meeting.title } : null,
      agreement: doc.agreement ? { id: doc.agreement.id, folio: doc.agreement.folio, title: doc.agreement.title } : null,
      personalNote: doc.personalNote ? { id: doc.personalNote.id, title: doc.personalNote.title, visibility: doc.personalNote.visibility } : null,
      minutes: doc.minutes ? { id: doc.minutes.id, minutesNumber: doc.minutes.minutesNumber } : null,
      createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  private mapToDetail(doc: any): DocumentDetailDto {
    const base = this.mapToListItem(doc);
    return {
      ...base,
      versions: doc.versions?.map((v: any) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        storageKey: v.storageKey,
        fileSizeBytes: Number(v.fileSizeBytes),
        sha256Checksum: v.sha256Checksum,
        uploader: {
          id: v.uploader?.id || v.uploadedById,
          fullName: v.uploader ? `${v.uploader.firstName} ${v.uploader.lastName}`.trim() : 'Usuario',
          email: v.uploader?.email || '',
        },
        createdAt: v.createdAt?.toISOString() || new Date().toISOString(),
      })) || [],
    };
  }

  async upload(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    dto: UploadDocumentDto,
    user: AuthUser,
    ipAddress = '127.0.0.1',
    userAgent = 'MexAgenda-Client',
  ): Promise<DocumentDetailDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No se ha proporcionado ningún archivo para cargar.');
    }

    // 1. Validación de seguridad binaria (Magic Bytes, extensión, tamaño)
    const validation = validateFile(file.buffer, file.originalname, file.mimetype);
    if (!validation.isValid) {
      this.logger.warn(`Intento de carga rechazado (${validation.error}) por usuario ${user.id}`);
      throw new BadRequestException(validation.error);
    }

    // 2. Validación de coherencia y permisos con entidades padre
    if (dto.personalNoteId) {
      const note = await this.prisma.personalNote.findUnique({
        where: { id: dto.personalNoteId },
      });
      if (!note || note.deletedAt) {
        throw new NotFoundException('La anotación institucional especificada no existe.');
      }
      if (note.visibility === 'PRIVADA' && note.authorId !== user.id && user.role !== 'ROLE_ADMIN') {
        throw new ForbiddenException('No tiene autorización para adjuntar documentos a una nota privada de otro usuario.');
      }
    }

    if (dto.meetingId) {
      const meeting = await this.prisma.meeting.findUnique({
        where: { id: dto.meetingId },
      });
      if (!meeting) {
        throw new NotFoundException('La reunión institucional especificada no existe.');
      }
    }

    if (dto.agreementId) {
      const agreement = await this.prisma.agreement.findUnique({
        where: { id: dto.agreementId },
      });
      if (!agreement) {
        throw new NotFoundException('El acuerdo institucional especificado no existe.');
      }
    }

    if (dto.minutesId) {
      const minutes = await this.prisma.meetingMinutes.findUnique({
        where: { id: dto.minutesId },
      });
      if (!minutes) {
        throw new NotFoundException('El acta oficial especificada no existe.');
      }
    }

    // 3. Cálculo de SHA-256 e inmutabilidad
    const sha256Checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 4. Generación de storage key única con partición temporal
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storageKey = `vault/${year}/${month}/${crypto.randomUUID()}-${validation.sanitizedFilename}`;

    // 5. Carga a través del StorageDriver (S3 / Local)
    await this.storageService.upload({
      key: storageKey,
      buffer: file.buffer,
      mimeType: validation.detectedMime,
      originalFilename: validation.sanitizedFilename,
      metadata: {
        uploaderId: user.id,
        sha256: sha256Checksum,
      },
    });

    // 5.1 Escaneo de seguridad de firmas maliciosas (OBS-06-01)
    const contentScan = scanFileContent(file.buffer);
    let initialScanStatus: FileScanStatus = FileScanStatus.LIMPIO;
    if (!contentScan.isClean) {
      initialScanStatus = FileScanStatus.INFECTADO;
      this.logger.warn(
        `[Security] Archivo puesto en cuarentena (INFECTADO - ${contentScan.threatSignature}): ${validation.sanitizedFilename}`,
      );
    } else if (process.env.AV_SCAN_MODE === 'ASYNC') {
      initialScanStatus = FileScanStatus.PENDIENTE_REVISION;
    }

    // 6. Registro transaccional en Neon PostgreSQL
    const doc = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.attachment.create({
        data: {
          originalFilename: validation.sanitizedFilename,
          storageKey,
          mimeType: validation.detectedMime,
          fileSizeBytes: BigInt(file.buffer.length),
          sha256Checksum,
          category: dto.category || 'GENERAL',
          description: dto.description || null,
          storageProvider: this.storageService.getProviderName(),
          bucketName: this.storageService.getBucketName() || null,
          scanStatus: initialScanStatus,
          meetingId: dto.meetingId || null,
          agreementId: dto.agreementId || null,
          personalNoteId: dto.personalNoteId || null,
          minutesId: dto.minutesId || null,
          uploadedById: user.id,
        },
        include: {
          uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
          meeting: { select: { id: true, folio: true, title: true } },
          agreement: { select: { id: true, folio: true, title: true } },
          personalNote: { select: { id: true, title: true, visibility: true } },
          minutes: { select: { id: true, minutesNumber: true } },
          versions: {
            include: {
              uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      });

      // Crear versión inicial
      await tx.attachmentVersion.create({
        data: {
          attachmentId: created.id,
          versionNumber: 1,
          storageKey,
          fileSizeBytes: BigInt(file.buffer.length),
          sha256Checksum,
          uploadedById: user.id,
        },
      });

      return created;
    });

    // 7. Registro de auditoría forense inmutable
    await this.auditService.logEvent({
      actorId: user.id,
      action: 'DOCUMENT_UPLOADED',
      entity: 'Attachment',
      entityId: doc.id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        filename: doc.originalFilename,
        sizeBytes: Number(doc.fileSizeBytes),
        mimeType: doc.mimeType,
        sha256Checksum: doc.sha256Checksum,
        storageKey: doc.storageKey,
        category: doc.category,
      },
    });

    return this.mapToDetail(doc);
  }

  async findAll(query: QueryDocumentsDto, user: AuthUser): Promise<PaginatedResponse<DocumentListItemDto>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
    };

    if (query.isArchived !== undefined) {
      where.isArchived = query.isArchived;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.mimeType) {
      where.mimeType = { contains: query.mimeType, mode: 'insensitive' };
    }

    if (query.scanStatus) {
      where.scanStatus = query.scanStatus;
    }

    if (query.meetingId) {
      where.meetingId = query.meetingId;
    }

    if (query.agreementId) {
      where.agreementId = query.agreementId;
    }

    if (query.personalNoteId) {
      where.personalNoteId = query.personalNoteId;
    }

    if (query.minutesId) {
      where.minutesId = query.minutesId;
    }

    if (query.uploaderId) {
      where.uploadedById = query.uploaderId;
    }

    if (query.search) {
      where.OR = [
        { originalFilename: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Anti-IDOR y herencia de privacidad institucional
    if (user.role !== 'ROLE_ADMIN') {
      const privacyCondition = {
        OR: [
          { personalNoteId: null },
          {
            personalNote: {
              OR: [
                { authorId: user.id },
                { visibility: { not: 'PRIVADA' } },
              ],
            },
          },
        ],
      };

      if (where.OR) {
        where.AND = [{ OR: where.OR }, privacyCondition];
        delete where.OR;
      } else {
        where.AND = [privacyCondition];
      }
    }

    const [total, items] = await Promise.all([
      this.prisma.attachment.count({ where }),
      this.prisma.attachment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
          meeting: { select: { id: true, folio: true, title: true } },
          agreement: { select: { id: true, folio: true, title: true } },
          personalNote: { select: { id: true, title: true, visibility: true } },
          minutes: { select: { id: true, minutesNumber: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items.map((doc: any) => this.mapToListItem(doc)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(
    id: string,
    user: AuthUser,
    ipAddress = '127.0.0.1',
    userAgent = 'MexAgenda-Client',
  ): Promise<DocumentDetailDto> {
    const doc = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
        meeting: { select: { id: true, folio: true, title: true } },
        agreement: { select: { id: true, folio: true, title: true } },
        personalNote: { select: { id: true, title: true, visibility: true, authorId: true } },
        minutes: { select: { id: true, minutesNumber: true } },
        versions: {
          include: {
            uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!doc || (doc.isDeleted && user.role !== 'ROLE_ADMIN')) {
      throw new NotFoundException(`El documento institucional con ID ${id} no existe o fue eliminado.`);
    }

    // Control estricto de privacidad heredada de notas
    if (doc.personalNote && doc.personalNote.visibility === 'PRIVADA') {
      if (doc.personalNote.authorId !== user.id && user.role !== 'ROLE_ADMIN') {
        await this.auditService.logEvent({
          actorId: user.id,
          action: 'UNAUTHORIZED_DOCUMENT_ACCESS_ATTEMPT',
          entity: 'Attachment',
          entityId: id,
          ipAddress,
          userAgent,
          outcome: AuditOutcome.DENIED,
          diffPayload: { reason: 'Intento de acceso a archivo de nota privada ajena' },
        });
        throw new ForbiddenException('Acceso denegado: este archivo pertenece a una anotación privada institucional.');
      }
    }

    return this.mapToDetail(doc);
  }

  async getDownloadUrl(
    id: string,
    user: AuthUser,
    ipAddress = '127.0.0.1',
    userAgent = 'MexAgenda-Client',
  ): Promise<DownloadUrlDto> {
    const doc = await this.findOne(id, user, ipAddress, userAgent);

    if (doc.scanStatus === FileScanStatus.INFECTADO) {
      await this.auditService.logEvent({
        actorId: user.id,
        action: 'UNAUTHORIZED_DOCUMENT_ACCESS_ATTEMPT',
        entity: 'Attachment',
        entityId: id,
        ipAddress,
        userAgent,
        outcome: AuditOutcome.DENIED,
        diffPayload: { reason: 'Intento de descarga de archivo bloqueado por malware (cuarentena)' },
      });
      throw new ForbiddenException('Descarga bloqueada: el archivo ha sido marcado como infectado por la inspección de seguridad y permanece en cuarentena.');
    }

    if (
      doc.scanStatus === FileScanStatus.PENDIENTE_REVISION ||
      doc.scanStatus === FileScanStatus.ERROR_ESCANEO
    ) {
      await this.auditService.logEvent({
        actorId: user.id,
        action: 'UNAUTHORIZED_DOCUMENT_ACCESS_ATTEMPT',
        entity: 'Attachment',
        entityId: id,
        ipAddress,
        userAgent,
        outcome: AuditOutcome.DENIED,
        diffPayload: { reason: `Intento de descarga de archivo en cuarentena (${doc.scanStatus})` },
      });
      throw new ForbiddenException('Descarga bloqueada: el archivo se encuentra pendiente de análisis de seguridad y permanece en cuarentena preventiva.');
    }

    const expiresInSeconds = 300; // 5 minutos exactos
    const downloadUrl = await this.storageService.getDownloadPresignedUrl(
      doc.storageKey,
      doc.originalFilename,
      expiresInSeconds,
    );

    // Auditoría forense de descarga autorizada
    await this.auditService.logEvent({
      actorId: user.id,
      action: 'DOCUMENT_DOWNLOADED',
      entity: 'Attachment',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        filename: doc.originalFilename,
        expiresInSeconds,
        storageKey: doc.storageKey,
      },
    });

    return {
      documentId: doc.id,
      downloadUrl,
      expiresInSeconds,
      filename: doc.originalFilename,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
    };
  }

  async update(
    id: string,
    dto: UpdateDocumentDto,
    user: AuthUser,
    ipAddress = '127.0.0.1',
    userAgent = 'MexAgenda-Client',
  ): Promise<DocumentDetailDto> {
    const existing = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      throw new NotFoundException(`El documento con ID ${id} no existe.`);
    }

    if (existing.uploadedById !== user.id && user.role !== 'ROLE_ADMIN') {
      throw new ForbiddenException('Solo el usuario que subió el archivo o el Administrador puede modificar sus metadatos.');
    }

    const updated = await this.prisma.attachment.update({
      where: { id },
      data: {
        originalFilename: dto.originalFilename ? sanitizeFilename(dto.originalFilename) : undefined,
        category: dto.category,
        description: dto.description,
        isArchived: dto.isArchived,
      },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
        meeting: { select: { id: true, folio: true, title: true } },
        agreement: { select: { id: true, folio: true, title: true } },
        personalNote: { select: { id: true, title: true, visibility: true } },
        minutes: { select: { id: true, minutesNumber: true } },
        versions: {
          include: {
            uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    await this.auditService.logEvent({
      actorId: user.id,
      action: 'DOCUMENT_METADATA_UPDATED',
      entity: 'Attachment',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        before: {
          originalFilename: existing.originalFilename,
          category: existing.category,
          isArchived: existing.isArchived,
        },
        after: {
          originalFilename: updated.originalFilename,
          category: updated.category,
          isArchived: updated.isArchived,
        },
      },
    });

    return this.mapToDetail(updated);
  }

  async softDelete(
    id: string,
    user: AuthUser,
    ipAddress = '127.0.0.1',
    userAgent = 'MexAgenda-Client',
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      throw new NotFoundException(`El documento con ID ${id} no existe o ya fue eliminado.`);
    }

    if (existing.uploadedById !== user.id && user.role !== 'ROLE_ADMIN') {
      throw new ForbiddenException('Solo el propietario del documento o un Administrador institucional puede eliminarlo.');
    }

    await this.prisma.attachment.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: user.id,
      },
    });

    await this.auditService.logEvent({
      actorId: user.id,
      action: 'DOCUMENT_DELETED',
      entity: 'Attachment',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        filename: existing.originalFilename,
        storageKey: existing.storageKey,
      },
    });

    return {
      success: true,
      message: `El documento '${existing.originalFilename}' fue eliminado suavemente de forma satisfactoria.`,
    };
  }

  async restore(
    id: string,
    user: AuthUser,
    ipAddress = '127.0.0.1',
    userAgent = 'MexAgenda-Client',
  ): Promise<DocumentDetailDto> {
    const existing = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`El documento con ID ${id} no existe.`);
    }

    if (!existing.isDeleted) {
      throw new BadRequestException('El documento no se encuentra en estado eliminado.');
    }

    const restored = await this.prisma.attachment.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
      },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
        meeting: { select: { id: true, folio: true, title: true } },
        agreement: { select: { id: true, folio: true, title: true } },
        personalNote: { select: { id: true, title: true, visibility: true } },
        minutes: { select: { id: true, minutesNumber: true } },
        versions: {
          include: {
            uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    await this.auditService.logEvent({
      actorId: user.id,
      action: 'DOCUMENT_RESTORED',
      entity: 'Attachment',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { filename: restored.originalFilename },
    });

    return this.mapToDetail(restored);
  }

  async updateScanStatus(
    id: string,
    scanStatus: FileScanStatus,
    user: AuthUser,
    ipAddress = '127.0.0.1',
    userAgent = 'MexAgenda-Client',
  ): Promise<DocumentDetailDto> {
    const existing = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`El documento con ID ${id} no existe.`);
    }

    const updated = await this.prisma.attachment.update({
      where: { id },
      data: {
        scanStatus,
      },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
        meeting: { select: { id: true, folio: true, title: true } },
        agreement: { select: { id: true, folio: true, title: true } },
        personalNote: { select: { id: true, title: true, visibility: true } },
        minutes: { select: { id: true, minutesNumber: true } },
        versions: {
          include: {
            uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    await this.auditService.logEvent({
      actorId: user.id,
      action: 'DOCUMENT_SCAN_STATUS_UPDATED',
      entity: 'Attachment',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: { previous: existing.scanStatus, updated: scanStatus },
    });

    return this.mapToDetail(updated);
  }

  async uploadNewVersion(
    id: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    user: AuthUser,
    ipAddress = '127.0.0.1',
    userAgent = 'MexAgenda-Client',
  ): Promise<DocumentDetailDto> {
    const existing = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      throw new NotFoundException(`El documento con ID ${id} no existe.`);
    }

    if (existing.uploadedById !== user.id && user.role !== 'ROLE_ADMIN') {
      throw new ForbiddenException('Solo el propietario o un Administrador puede cargar una nueva versión de este documento.');
    }

    const validation = validateFile(file.buffer, file.originalname, file.mimetype);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const sha256Checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const newStorageKey = `vault/${year}/${month}/${crypto.randomUUID()}-${validation.sanitizedFilename}`;

    await this.storageService.upload({
      key: newStorageKey,
      buffer: file.buffer,
      mimeType: validation.detectedMime,
      originalFilename: validation.sanitizedFilename,
      metadata: {
        uploaderId: user.id,
        sha256: sha256Checksum,
      },
    });

    const newVersionNumber = existing.version + 1;
    const versionScan = scanFileContent(file.buffer);
    let versionScanStatus: FileScanStatus = FileScanStatus.LIMPIO;
    if (!versionScan.isClean) {
      versionScanStatus = FileScanStatus.INFECTADO;
    } else if (process.env.AV_SCAN_MODE === 'ASYNC') {
      versionScanStatus = FileScanStatus.PENDIENTE_REVISION;
    }

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const doc = await tx.attachment.update({
        where: { id },
        data: {
          storageKey: newStorageKey,
          originalFilename: validation.sanitizedFilename,
          mimeType: validation.detectedMime,
          fileSizeBytes: BigInt(file.buffer.length),
          sha256Checksum,
          version: newVersionNumber,
          scanStatus: versionScanStatus,
        },
        include: {
          uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
          meeting: { select: { id: true, folio: true, title: true } },
          agreement: { select: { id: true, folio: true, title: true } },
          personalNote: { select: { id: true, title: true, visibility: true } },
          minutes: { select: { id: true, minutesNumber: true } },
          versions: {
            include: {
              uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
            orderBy: { versionNumber: 'desc' },
          },
        },
      });

      await tx.attachmentVersion.create({
        data: {
          attachmentId: id,
          versionNumber: newVersionNumber,
          storageKey: newStorageKey,
          fileSizeBytes: BigInt(file.buffer.length),
          sha256Checksum,
          uploadedById: user.id,
        },
      });

      return doc;
    });

    await this.auditService.logEvent({
      actorId: user.id,
      action: 'DOCUMENT_VERSION_UPLOADED',
      entity: 'Attachment',
      entityId: id,
      ipAddress,
      userAgent,
      outcome: AuditOutcome.SUCCESS,
      diffPayload: {
        versionNumber: newVersionNumber,
        newStorageKey,
        sha256Checksum,
      },
    });

    return this.mapToDetail(updated);
  }
}
