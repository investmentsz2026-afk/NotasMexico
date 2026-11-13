import {
  MeetingStatus,
  MeetingModality,
  AttendanceStatus,
  AgendaItemType,
  AgendaItemStatus,
  MinutesStatus,
  ParticipationCondition,
  AgreementStatus,
  AgreementPriority,
  AgreementType,
  NoteCategory,
  NoteType,
  NoteVisibility,
  FileScanStatus,
  StorageProvider,
  DocumentCategory,
} from '../enums';

/**
 * Estructura de respuesta exitosa estandarizada para toda la API REST de MexAgenda.
 */
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
}

/**
 * Estructura de error normalizada bajo el estándar RFC 7807 (Problem Details for HTTP APIs).
 */
export interface ApiErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errorCode?: string;
  timestamp: string;
  invalidParams?: Array<{
    name: string;
    reason: string;
  }>;
}

/**
 * Metadatos de paginación uniforme.
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Respuesta paginada estándar.
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Contrato de verificación de salud (Health Check) de infraestructura.
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  services: {
    api: 'healthy' | 'unhealthy';
    database: 'connected' | 'disconnected' | 'not_configured';
  };
  version: string;
}

/**
 * Usuario autenticado en el contexto de sesión de MexAgenda.
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
  permissions: string[];
}

/**
 * Respuesta del endpoint de Login.
 */
export interface LoginResponse {
  mfaRequired: boolean;
  mfaToken?: string;
  user?: AuthUser;
  message?: string;
}

/**
 * Respuesta de enrolamiento de MFA (secreto y código QR para Google Authenticator).
 */
export interface MfaEnrollResponse {
  secret: string;
  qrCodeDataUrl: string;
  uri: string;
}

/**
 * Respuesta de confirmación exitosa de MFA (entrega 8 códigos de respaldo únicos).
 */
export interface MfaConfirmResponse {
  success: boolean;
  message: string;
  backupCodes: string[];
}

/**
 * Información de una sesión activa para la lista de auditoría del usuario.
 */
export interface SessionInfo {
  id: string;
  ipAddress: string;
  userAgent: string;
  isRevoked: boolean;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

// ==============================================================================
// CONTRATOS DE FASE 3: GESTIÓN DE REUNIONES Y SESIONES (MOD-02)
// ==============================================================================

export interface MeetingCategoryDto {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  colorHex: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingListItem {
  id: string;
  folio: string;
  title: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    code: string;
    colorHex: string;
  };
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  modality: MeetingModality;
  virtualUrl?: string | null;
  timezone: string;
  status: MeetingStatus;
  participantsCount: number;
  creator: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MeetingAgendaItemDto {
  id: string;
  meetingId: string;
  orderIndex: number;
  title: string;
  description?: string | null;
  responsibleName?: string | null;
  responsibleUserId?: string | null;
  estimatedMinutes?: number | null;
  itemType: AgendaItemType | string;
  observations?: string | null;
  status: AgendaItemStatus | string;
  isTreated: boolean;
  treatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingParticipantDto {
  id: string;
  meetingId: string;
  userId?: string | null;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    position: string;
  } | null;
  institutionalRole: string;
  participationCondition: ParticipationCondition | string;
  attendanceStatus: AttendanceStatus;
  isExternal: boolean;
  externalName?: string | null;
  externalEmail?: string | null;
  externalOrganization?: string | null;
  arrivalTime?: string | null;
  notes?: string | null;
  confirmedAt?: string | null;
}

export interface AttendanceSummary {
  totalConvocados: number;
  presentes: number;
  ausentes: number;
  justificados: number;
  tardanzas: number;
  participacionRemota: number;
  porcentajeAsistencia: number;
}

export interface MeetingConvocatoriaDto {
  id: string;
  meetingId: string;
  convocatoriaNumber: string;
  issueDate: string;
  noticeText: string;
  isPublished: boolean;
  publishedAt?: string | null;
  publishedBy?: {
    id: string;
    fullName: string;
  } | null;
  recipients?: any;
  observations?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingSessionLogDto {
  id: string;
  meetingId: string;
  entryType: string;
  description: string;
  agendaItemId?: string | null;
  registeredBy: {
    id: string;
    fullName: string;
  };
  timestamp: string;
}

export interface MeetingMinutesDto {
  id: string;
  meetingId: string;
  minutesNumber: string;
  elaborationDate: string;
  realStartTime?: string | null;
  realEndTime?: string | null;
  locationOrModality?: string | null;
  presidedByName?: string | null;
  secretaryByName?: string | null;
  summary: string;
  pointsTreatedSummary?: string | null;
  observations?: string | null;
  incidents?: string | null;
  status: MinutesStatus | string;
  approvedAt?: string | null;
  approvedBy?: {
    id: string;
    fullName: string;
  } | null;
  approvalNotes?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingDetailDto {
  id: string;
  folio: string;
  title: string;
  description?: string | null;
  categoryId: string;
  category: MeetingCategoryDto;
  meetingDate: string;
  startTime: string;
  endTime: string;
  realStartTime?: string | null;
  realEndTime?: string | null;
  location: string;
  modality: MeetingModality;
  virtualUrl?: string | null;
  timezone: string;
  status: MeetingStatus;
  observations?: string | null;
  version: number;
  creator: {
    id: string;
    fullName: string;
    email: string;
    position: string;
  };
  updater?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  presidedBy?: {
    id: string;
    fullName: string;
  } | null;
  secretaryBy?: {
    id: string;
    fullName: string;
  } | null;
  convocatoria?: MeetingConvocatoriaDto | null;
  agendaItems: MeetingAgendaItemDto[];
  participants: MeetingParticipantDto[];
  attendanceSummary: AttendanceSummary;
  minutes?: MeetingMinutesDto | null;
  sessionLogs?: MeetingSessionLogDto[];
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// FASE 4: CONTRATOS DE GESTIÓN Y SEGUIMIENTO DE ACUERDOS (MOD-03)
// -------------------------------------------------------------

export interface AgreementListItem {
  id: string;
  folio: string;
  title: string;
  agreementType: AgreementType | string;
  priority: AgreementPriority;
  status: AgreementStatus;
  progressPercent: number;
  dueDate: string;
  startDate?: string | null;
  completionDate?: string | null;
  meetingId: string;
  meetingFolio: string;
  meetingTitle: string;
  category?: {
    id: string;
    name: string;
    code: string;
    colorHex: string;
  } | null;
  assignee: {
    id: string;
    fullName: string;
    email: string;
    position?: string | null;
  };
  collaboratorsCount: number;
  evidencesCount: number;
  isArchived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgreementCollaboratorDto {
  id: string;
  agreementId: string;
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    position?: string | null;
  };
  assignedAt: string;
  assignedById: string;
  assignedBy?: {
    id: string;
    fullName: string;
  };
  notes?: string | null;
}

export interface AgreementProgressDto {
  id: string;
  agreementId: string;
  reportedById: string;
  reportedBy: {
    id: string;
    fullName: string;
    email: string;
  };
  reportedAt: string;
  previousPercent: number;
  newPercent: number;
  description: string;
  observations?: string | null;
  resultingStatus?: AgreementStatus | null;
  justification?: string | null;
  evidencesCount?: number;
}

export interface AgreementEvidenceDto {
  id: string;
  agreementId: string;
  progressId?: string | null;
  title: string;
  description?: string | null;
  documentReference?: string | null;
  registeredById: string;
  registeredBy: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
}

export interface AgreementHistoryDto {
  id: string;
  agreementId: string;
  actionType: string;
  previousStatus?: AgreementStatus | null;
  newStatus?: AgreementStatus | null;
  previousAssignedTo?: {
    id: string;
    fullName: string;
  } | null;
  newAssignedTo?: {
    id: string;
    fullName: string;
  } | null;
  previousDueDate?: string | null;
  newDueDate?: string | null;
  previousPercent?: number | null;
  newPercent?: number | null;
  progressNotes?: string | null;
  changeReason?: string | null;
  details?: Record<string, any> | null;
  changer: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
}

export interface AgreementDetailDto {
  id: string;
  folio: string;
  title: string;
  description: string;
  agreementType: string;
  priority: AgreementPriority;
  status: AgreementStatus;
  progressPercent: number;
  approvalDate: string;
  startDate?: string | null;
  dueDate: string;
  completionDate?: string | null;
  observations?: string | null;
  changeReason?: string | null;
  version: number;
  isArchived: boolean;
  meetingId: string;
  meeting: {
    id: string;
    folio: string;
    title: string;
    meetingDate: string;
  };
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    code: string;
    colorHex: string;
  } | null;
  agendaItemId?: string | null;
  agendaItem?: {
    id: string;
    orderIndex: number;
    title: string;
  } | null;
  minutesId?: string | null;
  minutes?: {
    id: string;
    minutesNumber: string;
  } | null;
  minutesVersionNumber?: number | null;
  creator: {
    id: string;
    fullName: string;
    email: string;
  };
  assignee: {
    id: string;
    fullName: string;
    email: string;
    position?: string | null;
  };
  completer?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  collaborators: AgreementCollaboratorDto[];
  progressReports: AgreementProgressDto[];
  evidences: AgreementEvidenceDto[];
  history?: AgreementHistoryDto[];
  createdAt: string;
  updatedAt: string;
}

export interface AgreementDashboardMetrics {
  total: number;
  pendientes: number;
  enProceso: number;
  cumplidos: number;
  vencidos: number;
  suspendidos: number;
  cancelados: number;
  porcentajeCumplimientoGlobal: number;
}

export interface AgreementDashboardDto {
  metrics: AgreementDashboardMetrics;
  urgentPending: AgreementListItem[];
  recentProgress: AgreementProgressDto[];
  byAssignee: Array<{
    userId: string;
    fullName: string;
    total: number;
    cumplidos: number;
    pendientes: number;
    vencidos: number;
  }>;
}

export interface AgreementReportsDto {
  metrics: AgreementDashboardMetrics;
  upcomingDue: AgreementListItem[];
  overdue: AgreementListItem[];
  byPriority: Record<string, number>;
  byType: Record<string, number>;
}

/**
 * ==============================================================================
 * FASE 5 — MOD-04: ANOTACIONES PERSONALES Y NOTAS DE SESIÓN
 * ==============================================================================
 */

export interface PersonalNoteListItem {
  id: string;
  title: string;
  content?: string | null;
  category: NoteCategory | string;
  noteType: NoteType | string;
  visibility: NoteVisibility | string;
  isFavorite: boolean;
  tags?: string | null;
  version: number;
  meetingId?: string | null;
  meetingTitle?: string | null;
  meetingFolio?: string | null;
  agendaItemId?: string | null;
  agendaItemTitle?: string | null;
  agreementId?: string | null;
  agreementFolio?: string | null;
  authorId: string;
  authorName: string;
  authorEmail: string;
  isAdminModified: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PersonalNoteVersionDto {
  id: string;
  personalNoteId: string;
  versionNumber: number;
  titleSnapshot?: string | null;
  contentSnapshot: string;
  categorySnapshot?: string | null;
  modifiedById: string;
  modifiedByName: string;
  modifiedByEmail: string;
  changeReason?: string | null;
  adminJustification?: string | null;
  isAdminIntervention: boolean;
  createdAt: string;
  // Aliases de compatibilidad
  noteId?: string;
  editorId?: string;
  editorName?: string;
  editorEmail?: string;
}

export interface PersonalNoteDetailDto {
  id: string;
  title: string;
  content: string;
  category: NoteCategory | string;
  noteType: NoteType | string;
  visibility: NoteVisibility | string;
  isFavorite: boolean;
  tags?: string | null;
  version: number;
  meetingId?: string | null;
  meeting?: {
    id: string;
    folio: string;
    title: string;
    status?: string;
  } | null;
  agendaItemId?: string | null;
  agendaItem?: {
    id: string;
    title: string;
    orderIndex: number;
  } | null;
  agreementId?: string | null;
  agreement?: {
    id: string;
    folio: string;
    title: string;
    status?: string;
  } | null;
  authorId: string;
  author: {
    id: string;
    fullName: string;
    email: string;
    position?: string | null;
  };
  isAdminModified: boolean;
  lastAdminIntervenorId?: string | null;
  lastAdminIntervenor?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  adminJustification?: string | null;
  versions?: PersonalNoteVersionDto[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreatePersonalNoteDto {
  title: string;
  content: string;
  category?: NoteCategory | string;
  noteType?: NoteType | string;
  visibility?: NoteVisibility | string;
  isFavorite?: boolean;
  tags?: string;
  meetingId?: string;
  agendaItemId?: string;
  agreementId?: string;
}

export interface UpdatePersonalNoteDto {
  title?: string;
  content?: string;
  category?: NoteCategory | string;
  noteType?: NoteType | string;
  visibility?: NoteVisibility | string;
  isFavorite?: boolean;
  tags?: string;
  meetingId?: string | null;
  agendaItemId?: string | null;
  agreementId?: string | null;
  changeReason?: string;
}

export interface AdminInterveneNoteDto {
  title?: string;
  content?: string;
  category?: NoteCategory | string;
  visibility?: NoteVisibility | string;
  adminJustification: string;
}

export interface QueryNotesDto {
  page?: number;
  limit?: number;
  search?: string;
  category?: NoteCategory | string;
  noteType?: NoteType | string;
  visibility?: NoteVisibility | string;
  meetingId?: string;
  agreementId?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  authorId?: string;
}

// -------------------------------------------------------------
// FASE 6: CONTRATOS DE BÓVEDA DIGITAL Y GESTIÓN DOCUMENTAL (MOD-05)
// -------------------------------------------------------------

export interface DocumentVersionDto {
  id: string;
  versionNumber: number;
  storageKey: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  uploader: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
}

export interface DocumentListItemDto {
  id: string;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  category: DocumentCategory | string;
  description?: string | null;
  storageProvider: StorageProvider | string;
  bucketName?: string | null;
  scanStatus: FileScanStatus | string;
  isArchived: boolean;
  version: number;
  meetingId?: string | null;
  agreementId?: string | null;
  personalNoteId?: string | null;
  minutesId?: string | null;
  uploader: {
    id: string;
    fullName: string;
    email: string;
  };
  meeting?: {
    id: string;
    folio: string;
    title: string;
  } | null;
  agreement?: {
    id: string;
    folio: string;
    title: string;
  } | null;
  personalNote?: {
    id: string;
    title: string;
    visibility: string;
  } | null;
  minutes?: {
    id: string;
    minutesNumber: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetailDto extends DocumentListItemDto {
  versions?: DocumentVersionDto[];
}

export interface UploadDocumentDto {
  originalFilename?: string;
  category?: DocumentCategory | string;
  description?: string;
  meetingId?: string;
  agreementId?: string;
  personalNoteId?: string;
  minutesId?: string;
}

export interface UpdateDocumentDto {
  originalFilename?: string;
  category?: DocumentCategory | string;
  description?: string;
  isArchived?: boolean;
}

export interface DownloadUrlDto {
  documentId: string;
  downloadUrl: string;
  expiresInSeconds: number;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface QueryDocumentsDto {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  mimeType?: string;
  scanStatus?: string;
  meetingId?: string;
  agreementId?: string;
  personalNoteId?: string;
  minutesId?: string;
  uploaderId?: string;
  isArchived?: boolean;
}

/**
 * ==============================================================================
 * FASE 8 — MOD-07: REPORTES INSTITUCIONALES, MÉTRICAS EJECUTIVAS Y TABLEROS
 * ==============================================================================
 */

export interface ReportCategoryDistribution {
  categoryId: string;
  code: string;
  name: string;
  colorHex: string;
  reuniones: number;
  acuerdos: number;
}

export interface ReportOverdueAlert {
  id: string;
  folio: string;
  title: string;
  dueDate: string;
  diasVencido: number;
  assigneeName: string;
  priority: string;
}

export interface ReportExpirationTrafficLight {
  vencidos: number;
  critico7Dias: number;
  medio15Dias: number;
  lejano30Dias: number;
  enPlazoMas30: number;
  sinPlazo: number;
  suspendidos: number;
}

export interface ExecutiveDashboardDto {
  kpis: {
    totalAcuerdosValidos: number;
    cumplidos: number;
    enProceso: number;
    pendientes: number;
    vencidos: number;
    suspendidos: number;
    cancelados: number;
    tasaCumplimientoGlobal: number | null;
    tasaEfectividadTemporal: number | null;
    totalReunionesPeriodo: number;
    reunionesCelebradas: number;
    reunionesCanceladas: number;
    tasaEfectividadCalendario: number | null;
    tasaAsistenciaPromedio: number | null;
  };
  semaforoVencimiento: ReportExpirationTrafficLight;
  distribucionCategorias: ReportCategoryDistribution[];
  alertasRezago: ReportOverdueAlert[];
}

export interface AgreementsTrackingDto {
  resumenEstados: {
    total: number;
    pendientes: number;
    enProceso: number;
    cumplidos: number;
    vencidos: number;
    suspendidos: number;
    cancelados: number;
  };
  tasaCumplimiento: number | null;
  tasaEfectividadTemporal: number | null;
  tiempoPromedioResolucionDias: number | null;
  semaforo: ReportExpirationTrafficLight;
  porPrioridad: Record<string, number>;
  porTipo: Record<string, number>;
  porCategoria: Array<{
    categoryId: string;
    categoryName: string;
    colorHex: string;
    total: number;
    cumplidos: number;
    vencidos: number;
    pendientes: number;
  }>;
  cargaPorTitular?: Array<{
    userId: string;
    fullName: string;
    email: string;
    totalTitular: number;
    cumplidos: number;
    vencidos: number;
    pendientes: number;
    tasaCumplimiento: number | null;
  }>;
  items: Array<{
    id: string;
    folio: string;
    title: string;
    categoryName: string;
    categoryColorHex: string;
    priority: string;
    status: string;
    effectiveStatus: string;
    dueDate: string;
    daysRemaining: number;
    progressPercent: number;
    assigneeId: string;
    assigneeName: string;
    isCollaborator?: boolean;
  }>;
  totalItems: number;
}

export interface SessionGovernanceDto {
  resumen: {
    totalConvocadas: number;
    celebradas: number;
    canceladas: number;
    programadas: number;
    tasaEfectividadCalendario: number | null;
  };
  asistencia: {
    totalConvocados: number;
    totalAsistencias: number;
    totalInasistencias: number;
    totalJustificadas: number;
    tasaAsistenciaPromedio: number | null;
    tasaJustificacionInasistencias: number | null;
  };
  quorum: {
    sesionesConQuorum: number;
    sesionesSinQuorum: number;
    tasaCumplimientoQuorum: number | null;
    reglaQuorum: string;
  };
  actas: {
    totalActasAprobadas: number;
    totalActasBorrador: number;
    tiempoMedioAprobacionDias: number | null;
  };
  porModalidad: Record<string, number>;
  porCategoria: Array<{
    categoryId: string;
    categoryName: string;
    colorHex: string;
    total: number;
    celebradas: number;
    canceladas: number;
    tasaAsistencia: number | null;
  }>;
  sesionesRecientes: Array<{
    id: string;
    folio: string;
    title: string;
    meetingDate: string;
    status: string;
    modality: string;
    categoryName: string;
    categoryColorHex: string;
    totalConvocados: number;
    totalPresentes: number;
    tasaAsistencia: number | null;
    tieneQuorum: boolean;
    estadoActa: string;
  }>;
}

export interface PersonalConsoleDto {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  acuerdosTitular: {
    total: number;
    pendientes: number;
    enProceso: number;
    cumplidos: number;
    vencidos: number;
    suspendidos: number;
    tasaCumplimiento: number | null;
  };
  acuerdosCoadyuvante: {
    total: number;
    pendientes: number;
    enProceso: number;
    cumplidos: number;
  };
  misAcuerdosPrioritarios: Array<{
    id: string;
    folio: string;
    title: string;
    dueDate: string;
    daysRemaining: number;
    priority: string;
    status: string;
    effectiveStatus: string;
    progressPercent: number;
    rol: 'TITULAR' | 'COADYUVANTE';
  }>;
  proximasSesiones: Array<{
    id: string;
    folio: string;
    title: string;
    meetingDate: string;
    startTime: string;
    location: string;
    modality: string;
    categoryName: string;
  }>;
  asistenciaHistorica: {
    sesionesConvocado: number;
    sesionesAsistidas: number;
    tasaAsistenciaPersonal: number | null;
  };
  notasPrivadas: {
    totalNotas: number;
    notasUltimaSemana: number;
    avisoPrivacidad: string;
  };
}

export interface QueryReportsDto {
  from?: string;
  to?: string;
  categoryId?: string;
  assignedToId?: string;
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
}




