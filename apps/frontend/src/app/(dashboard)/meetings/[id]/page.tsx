'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import {
  MeetingDetailDto,
  MeetingStatus,
  MeetingModality,
  AttendanceStatus,
  DocumentListItemDto,
  DownloadUrlDto,
  PersonalNoteListItem,
  PaginatedResponse,
} from '@mexagenda/shared';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  FileText,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Edit2,
  Send,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  ShieldCheck,
  Archive,
  XCircle,
  History,
  FileCheck,
  MessageSquare,
  Tag,
  FolderLock,
  Upload,
  Download,
  BookOpen,
  User,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  MeetingStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  BORRADOR: {
    label: 'Borrador',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
  },
  PROGRAMADA: {
    label: 'Programada',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  CONVOCADA: {
    label: 'Convocada',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  EN_DESARROLLO: {
    label: 'En Desarrollo',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
  },
  FINALIZADA: {
    label: 'Finalizada',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300',
  },
  CANCELADA: {
    label: 'Cancelada',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  ARCHIVADA: {
    label: 'Archivada',
    bg: 'bg-zinc-100',
    text: 'text-zinc-600',
    border: 'border-zinc-300',
  },
};

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();

  const isAdmin =
    user?.role === 'ROLE_ADMIN' ||
    (Array.isArray(user?.permissions) && user.permissions.includes('admin:all'));

  // Modal para justificar asistencia
  const [justificationModal, setJustificationModal] = useState<{
    open: boolean;
    isSelf?: boolean;
    participantId?: string;
    participantName?: string;
  } | null>(null);
  const [justificationText, setJustificationText] = useState('');

  const [meeting, setMeeting] = useState<MeetingDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pestañas del módulo
  type TabType =
    | 'general'
    | 'convocatoria'
    | 'agenda'
    | 'participants'
    | 'session'
    | 'minutes'
    | 'documents'
    | 'notes';
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Documentos y Anotaciones vinculados a esta reunión
  const [meetingDocuments, setMeetingDocuments] = useState<DocumentListItemDto[]>([]);
  const [meetingNotes, setMeetingNotes] = useState<PersonalNoteListItem[]>([]);

  // Modal de subida directa de documento a la reunión
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [uploadDocFile, setUploadDocFile] = useState<globalThis.File | null>(null);
  const [uploadDocCategory, setUploadDocCategory] = useState('ANEXO');
  const [uploadDocDesc, setUploadDocDesc] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Modal de registro directo de anotación de la reunión
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('SESION');
  const [newNoteVisibility, setNewNoteVisibility] = useState('REUNION');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Modales y formularios de sub-recursos
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Agenda Form
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaDesc, setAgendaDesc] = useState('');
  const [agendaResponsible, setAgendaResponsible] = useState('');
  const [agendaMinutes, setAgendaMinutes] = useState(15);

  // Participant Form
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  const [partIsExternal, setPartIsExternal] = useState(false);
  const [partExternalName, setPartExternalName] = useState('');
  const [partExternalEmail, setPartExternalEmail] = useState('');
  const [partExternalOrg, setPartExternalOrg] = useState('');
  const [partRole, setPartRole] = useState('Vocal');
  const [partCondition, setPartCondition] = useState('TITULAR');

  // Convocatoria Form
  const [convNoticeText, setConvNoticeText] = useState('');
  const [convNumber, setConvNumber] = useState('');

  // Session Log Form
  const [sessionLogType, setSessionLogType] = useState('DELIBERACION');
  const [sessionLogDesc, setSessionLogDesc] = useState('');

  // Minutes Form
  const [minutesNumber, setMinutesNumber] = useState('');
  const [minutesSummary, setMinutesSummary] = useState('');
  const [minutesPoints, setMinutesPoints] = useState('');
  const [minutesIncidents, setMinutesIncidents] = useState('');
  const [minutesStatus, setMinutesStatus] = useState('BORRADOR');
  const [minutesApprovalNotes, setMinutesApprovalNotes] = useState('');

  const fetchMeeting = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, docsRes, notesRes] = await Promise.all([
        apiFetch<MeetingDetailDto>(`/meetings/${id}`),
        apiFetch<PaginatedResponse<DocumentListItemDto>>(`/documents?meetingId=${id}&limit=50`).catch(
          () => ({ items: [], meta: { total: 0, page: 1, limit: 50, totalPages: 1 } }),
        ),
        apiFetch<PaginatedResponse<PersonalNoteListItem>>(`/notes?meetingId=${id}&limit=50`).catch(
          () => ({ items: [], meta: { total: 0, page: 1, limit: 50, totalPages: 1 } }),
        ),
      ]);
      setMeeting(data);
      setMeetingDocuments(docsRes?.items || []);
      setMeetingNotes(notesRes?.items || []);
      if (data.convocatoria) {
        setConvNumber(data.convocatoria.convocatoriaNumber);
        setConvNoticeText(data.convocatoria.noticeText);
      }
      if (data.minutes) {
        setMinutesNumber(data.minutes.minutesNumber);
        setMinutesSummary(data.minutes.summary);
        setMinutesPoints(data.minutes.pointsTreatedSummary || '');
        setMinutesIncidents(data.minutes.incidents || '');
        setMinutesStatus(data.minutes.status);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar los detalles de la reunión.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Subir documento directamente vinculado a esta reunión
  const handleUploadMeetingDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadDocFile) return;
    try {
      setIsUploadingDoc(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', uploadDocFile);
      formData.append('category', uploadDocCategory);
      formData.append('meetingId', id);
      if (uploadDocDesc.trim()) {
        formData.append('description', uploadDocDesc.trim());
      }
      await apiFetch('/documents/upload', {
        method: 'POST',
        body: formData,
      });
      setIsUploadDocModalOpen(false);
      setUploadDocFile(null);
      setUploadDocDesc('');
      setSuccessMessage('Documento cargado y vinculado al expediente de esta reunión.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al subir el documento a la reunión.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Descargar documento de la reunión
  const handleDownloadMeetingDocument = async (docId: string) => {
    try {
      const res = await apiFetch<DownloadUrlDto>(`/documents/${docId}/download`);
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setError(err.message || 'Error al generar enlace de descarga.');
    }
  };

  // Crear anotación directamente vinculada a esta reunión
  const handleCreateMeetingNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    try {
      setIsSavingNote(true);
      setError(null);
      await apiFetch('/notes', {
        method: 'POST',
        body: JSON.stringify({
          title: newNoteTitle.trim(),
          content: newNoteContent.trim(),
          category: newNoteCategory,
          noteType: 'SESION',
          visibility: newNoteVisibility,
          meetingId: id,
        }),
      });
      setIsNoteModalOpen(false);
      setNewNoteTitle('');
      setNewNoteContent('');
      setSuccessMessage('Anotación registrada exitosamente en el expediente de esta reunión.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al registrar la anotación en la reunión.');
    } finally {
      setIsSavingNote(false);
    }
  };

  useEffect(() => {
    if (id) fetchMeeting();
  }, [id, fetchMeeting]);

  // Transiciones de estado
  const handleStatusChange = async (targetStatus: MeetingStatus, reason?: string) => {
    try {
      await apiFetch(`/meetings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus, reason }),
      });
      setSuccessMessage(`Estado actualizado a ${targetStatus} correctamente.`);
      setIsCancelModalOpen(false);
      setCancelReason('');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al cambiar el estado de la sesión.');
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('¿Desea archivar formalmente esta reunión en el acervo institucional?')) {
      return;
    }
    try {
      await apiFetch(`/meetings/${id}/archive`, { method: 'POST' });
      setSuccessMessage('Reunión archivada correctamente.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al archivar la reunión.');
    }
  };

  // Agregar Punto al Orden del Día
  const handleAddAgendaItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/meetings/${id}/agenda`, {
        method: 'POST',
        body: JSON.stringify({
          title: agendaTitle.trim(),
          description: agendaDesc.trim() || undefined,
          responsibleName: agendaResponsible.trim() || undefined,
          estimatedMinutes: Number(agendaMinutes),
        }),
      });
      setAgendaTitle('');
      setAgendaDesc('');
      setAgendaResponsible('');
      setIsAgendaModalOpen(false);
      setSuccessMessage('Punto del orden del día agregado.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al agregar punto del orden del día.');
    }
  };

  // Tratar Punto de Agenda
  const handleToggleTreated = async (itemId: string, currentTreated: boolean) => {
    try {
      await apiFetch(`/meetings/${id}/agenda/${itemId}/treated`, {
        method: 'PATCH',
        body: JSON.stringify({ isTreated: !currentTreated }),
      });
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar estado del punto de agenda.');
    }
  };

  // Agregar Participante
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/meetings/${id}/participants`, {
        method: 'POST',
        body: JSON.stringify({
          isExternal: partIsExternal,
          externalName: partIsExternal ? partExternalName.trim() : undefined,
          externalEmail: partIsExternal ? partExternalEmail.trim() : undefined,
          externalOrganization: partIsExternal ? partExternalOrg.trim() : undefined,
          institutionalRole: partRole.trim(),
          participationCondition: partCondition,
        }),
      });
      setIsParticipantModalOpen(false);
      setPartExternalName('');
      setPartExternalEmail('');
      setPartExternalOrg('');
      setSuccessMessage('Participante registrado en la sesión.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al agregar participante.');
    }
  };

  // Auto-registro o actualización de mi propia asistencia
  const handleSelfAttendance = async (
    newStatus: AttendanceStatus,
    justification?: string,
  ) => {
    try {
      setError(null);
      await apiFetch(`/meetings/${id}/attendance/self`, {
        method: 'POST',
        body: JSON.stringify({ attendanceStatus: newStatus, justification }),
      });
      setSuccessMessage('Tu asistencia ha sido registrada exitosamente.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al registrar tu asistencia.');
    }
  };

  // Actualizar Asistencia (Administrador o participante propio)
  const handleUpdateAttendance = async (
    participantId: string,
    newStatus: AttendanceStatus,
    justification?: string,
  ) => {
    try {
      setError(null);
      await apiFetch(`/meetings/${id}/participants/${participantId}/attendance`, {
        method: 'PATCH',
        body: JSON.stringify({ attendanceStatus: newStatus, justification }),
      });
      setSuccessMessage('Asistencia actualizada correctamente.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar asistencia.');
    }
  };

  // Guardar o Publicar Convocatoria
  const handleSaveConvocatoria = async (publish: boolean) => {
    try {
      await apiFetch(`/meetings/${id}/convocatoria`, {
        method: 'PUT',
        body: JSON.stringify({
          convocatoriaNumber: convNumber.trim() || `CONV-${meeting?.folio}`,
          noticeText: convNoticeText.trim(),
        }),
      });

      if (publish) {
        await apiFetch(`/meetings/${id}/convocatoria/publish`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        setSuccessMessage('Convocatoria publicada oficialmente y estado actualizado a CONVOCADA.');
      } else {
        setSuccessMessage('Borrador de convocatoria guardado.');
      }
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al procesar la convocatoria.');
    }
  };

  // Iniciar Sesión en Vivo
  const handleStartSession = async () => {
    if (!window.confirm('¿Desea dar apertura formal a la sesión institucional en desarrollo?')) {
      return;
    }
    try {
      await apiFetch(`/meetings/${id}/session/start`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSuccessMessage('Sesión formalmente iniciada y marcada EN_DESARROLLO.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al iniciar la sesión.');
    }
  };

  // Finalizar Sesión
  const handleEndSession = async () => {
    if (!window.confirm('¿Desea dar por clausurada formalmente la sesión colegiada?')) {
      return;
    }
    try {
      await apiFetch(`/meetings/${id}/session/end`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSuccessMessage('Sesión formalmente concluida y marcada como FINALIZADA.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al concluir la sesión.');
    }
  };

  // Registrar Evento en Bitácora
  const handleAddSessionLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/meetings/${id}/session/logs`, {
        method: 'POST',
        body: JSON.stringify({
          entryType: sessionLogType,
          description: sessionLogDesc.trim(),
        }),
      });
      setSessionLogDesc('');
      setSuccessMessage('Evento asentado en la bitácora de sesión.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al registrar evento de sesión.');
    }
  };

  // Guardar o Actualizar Acta
  const handleSaveMinutes = async () => {
    try {
      await apiFetch(`/meetings/${id}/minutes`, {
        method: 'PUT',
        body: JSON.stringify({
          minutesNumber: minutesNumber.trim() || `ACTA-${meeting?.folio}`,
          summary: minutesSummary.trim(),
          pointsTreatedSummary: minutesPoints.trim() || undefined,
          incidents: minutesIncidents.trim() || undefined,
          status: minutesStatus,
        }),
      });
      setSuccessMessage('Acta institucional guardada correctamente.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el acta institucional.');
    }
  };

  // Aprobar Acta
  const handleApproveMinutes = async () => {
    if (!window.confirm('¿Desea aprobar formalmente el acta institucional?')) {
      return;
    }
    try {
      await apiFetch(`/meetings/${id}/minutes/approve`, {
        method: 'POST',
        body: JSON.stringify({
          approvalNotes: minutesApprovalNotes.trim() || undefined,
        }),
      });
      setSuccessMessage('Acta institucional aprobada exitosamente.');
      await fetchMeeting();
    } catch (err: any) {
      setError(err.message || 'Error al aprobar acta.');
    }
  };

  if (isLoading && !meeting) {
    return (
      <div className="py-20 text-center text-sm text-slate-500 flex items-center justify-center space-x-2">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        <span>Cargando expediente institucional de la reunión...</span>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Reunión no encontrada</h2>
        <p className="text-xs text-slate-500">
          El expediente solicitado no existe o ha sido eliminado.
        </p>
        <Link
          href="/meetings"
          className="inline-flex items-center space-x-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Regresar a la lista</span>
        </Link>
      </div>
    );
  }

  const st = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.PROGRAMADA;

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Barra de Navegación Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-institutional-border pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-1">
            <Link href="/meetings" className="hover:text-institutional-navy transition flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Volver a Reuniones</span>
            </Link>
            <span>/</span>
            <span className="font-mono text-slate-700">{meeting.folio}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-institutional-navy">
              {meeting.title}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${st.bg} ${st.text} ${st.border}`}
            >
              {st.label}
            </span>
            <span
              className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold text-white shadow-2xs"
              style={{ backgroundColor: meeting.category.colorHex }}
            >
              {meeting.category.name}
            </span>
          </div>
        </div>

        {/* Acciones del Ciclo de Vida */}
        <div className="flex flex-wrap items-center gap-2">
          {meeting.status === 'PROGRAMADA' && (
            <button
              onClick={() => setActiveTab('convocatoria')}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Emitir Convocatoria</span>
            </button>
          )}

          {(meeting.status === 'CONVOCADA' || meeting.status === 'PROGRAMADA') && (
            <button
              onClick={handleStartSession}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition shadow-sm"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              <span>Abrir Sesión</span>
            </button>
          )}

          {meeting.status === 'EN_DESARROLLO' && (
            <button
              onClick={handleEndSession}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Clausurar Sesión</span>
            </button>
          )}

          {meeting.status !== 'CANCELADA' && meeting.status !== 'ARCHIVADA' && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition shadow-sm"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Cancelar</span>
            </button>
          )}

          {(meeting.status === 'FINALIZADA' || meeting.status === 'CANCELADA') && (
            <button
              onClick={handleArchive}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Archivar</span>
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="flex items-center space-x-2 rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center space-x-2 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Navegación por Pestañas Institucionales */}
      <div className="border-b border-institutional-border">
        <nav className="flex space-x-6 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 px-1 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'border-institutional-navy text-institutional-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>General y Horario</span>
          </button>

          <button
            onClick={() => setActiveTab('convocatoria')}
            className={`py-3 px-1 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'convocatoria'
                ? 'border-institutional-navy text-institutional-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="h-4 w-4" />
            <span>Convocatoria Oficial</span>
            {meeting.convocatoria?.isPublished && (
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('agenda')}
            className={`py-3 px-1 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'agenda'
                ? 'border-institutional-navy text-institutional-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Orden del Día ({meeting.agendaItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('participants')}
            className={`py-3 px-1 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'participants'
                ? 'border-institutional-navy text-institutional-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Participantes y Asistencia ({meeting.attendanceSummary.porcentajeAsistencia}%)</span>
          </button>

          <button
            onClick={() => setActiveTab('session')}
            className={`py-3 px-1 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'session'
                ? 'border-institutional-navy text-institutional-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlayCircle className="h-4 w-4" />
            <span>Desarrollo de Sesión ({meeting.sessionLogs?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('minutes')}
            className={`py-3 px-1 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'minutes'
                ? 'border-institutional-navy text-institutional-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="h-4 w-4" />
            <span>Acta Institucional</span>
            {meeting.minutes?.status === 'APROBADA' && (
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-1 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'documents'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderLock className="h-4 w-4" />
            <span>Archivos en Bóveda ({meetingDocuments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 px-1 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'notes'
                ? 'border-cyan-600 text-cyan-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Anotaciones ({meetingNotes.length})</span>
          </button>
        </nav>
      </div>

      {/* Contenido de la Pestaña Activa */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-institutional-navy border-b border-slate-100 pb-2">
                  Descripción y Antecedentes Institucionales
                </h2>
                <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                  {meeting.description || 'Sin descripción detallada registrada.'}
                </p>
                {meeting.observations && (
                  <div className="rounded-lg bg-amber-50/60 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
                    <span className="font-bold">Observaciones Institucionales:</span>
                    <p className="whitespace-pre-line font-mono text-[11px]">{meeting.observations}</p>
                  </div>
                )}
              </div>

              {/* Cuadro de Horarios y Ubicación */}
              <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-institutional-navy border-b border-slate-100 pb-2">
                  Programación de la Sesión
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <div>
                      <span className="block text-slate-400 text-[10px]">Fecha</span>
                      <span className="font-semibold text-slate-800">{meeting.meetingDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <div>
                      <span className="block text-slate-400 text-[10px]">Horario Programado</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {meeting.startTime} — {meeting.endTime} ({meeting.timezone})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <div>
                      <span className="block text-slate-400 text-[10px]">Sede / Recinto</span>
                      <span className="font-semibold text-slate-800">{meeting.location}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Video className="h-4 w-4 text-slate-400" />
                    <div>
                      <span className="block text-slate-400 text-[10px]">Modalidad</span>
                      <span className="font-semibold text-slate-800">{meeting.modality}</span>
                    </div>
                  </div>
                </div>

                {meeting.virtualUrl && (
                  <div className="pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-400 text-[10px]">Enlace Virtual: </span>
                    <a
                      href={meeting.virtualUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-amber-700 hover:underline break-all"
                    >
                      {meeting.virtualUrl}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Lateral: Autoridades y Metadatos */}
            <div className="space-y-6">
              <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-4 text-xs">
                <h2 className="text-sm font-bold text-institutional-navy border-b border-slate-100 pb-2">
                  Autoridades de la Sesión
                </h2>

                <div>
                  <span className="block text-slate-400 text-[10px]">Preside</span>
                  <span className="font-semibold text-slate-800">
                    {meeting.presidedBy ? meeting.presidedBy.fullName : 'No asignado'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-400 text-[10px]">Secretaría de Actas</span>
                  <span className="font-semibold text-slate-800">
                    {meeting.secretaryBy ? meeting.secretaryBy.fullName : 'No asignado'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="block text-slate-400 text-[10px]">Registrado por</span>
                  <span className="font-semibold text-slate-800">
                    {meeting.creator.fullName} ({meeting.creator.email})
                  </span>
                </div>

                <div>
                  <span className="block text-slate-400 text-[10px]">Versión del Registro</span>
                  <span className="font-mono text-slate-600">v{meeting.version}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resumen Colaborativo: Documentos Subidos y Anotaciones de esta Reunión */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tarjeta de Archivos Subidos a esta Reunión */}
            <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <FolderLock className="h-4 w-4 text-purple-600" />
                  <h2 className="text-sm font-bold text-institutional-navy">
                    Archivos y Documentos de la Reunión ({meetingDocuments.length})
                  </h2>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsUploadDocModalOpen(true)}
                    className="inline-flex items-center space-x-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition shadow-sm"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Subir Archivo</span>
                  </button>
                </div>
              </div>

              {meetingDocuments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <p>Aún no se han cargado archivos para esta reunión.</p>
                  <p className="text-[11px]">
                    Puede subirlos desde aquí o desde la Bóveda seleccionando esta reunión.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {meetingDocuments.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/vault/${doc.id}`}
                            className="font-bold text-slate-900 hover:text-purple-600 truncate"
                          >
                            {doc.originalFilename}
                          </Link>
                          <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                            {doc.category}
                          </span>
                        </div>
                        {doc.description && (
                          <p className="text-[11px] text-slate-600 line-clamp-2">{doc.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center space-x-1 font-medium text-slate-700">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>Subido por: {doc.uploader?.fullName || 'Integrante'}</span>
                          </span>
                          <span>•</span>
                          <span>{new Date(doc.createdAt).toLocaleString('es-MX')}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadMeetingDocument(doc.id)}
                        disabled={doc.scanStatus === 'INFECTADO'}
                        className="shrink-0 inline-flex items-center space-x-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5 text-purple-600" />
                        <span>Descargar</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tarjeta de Anotaciones Registradas para esta Reunión */}
            <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4 text-cyan-600" />
                  <h2 className="text-sm font-bold text-institutional-navy">
                    Anotaciones de los Integrantes ({meetingNotes.length})
                  </h2>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsNoteModalOpen(true)}
                    className="inline-flex items-center space-x-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Nueva Anotación</span>
                  </button>
                </div>
              </div>

              {meetingNotes.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <p>No hay anotaciones registradas para esta reunión.</p>
                  <p className="text-[11px]">
                    Los participantes pueden registrar apuntes de sesión desde aquí o desde Anotaciones.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {meetingNotes.map((note) => (
                    <div key={note.id} className="py-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/notes/${note.id}`}
                          className="font-bold text-slate-900 hover:text-cyan-700"
                        >
                          {note.title}
                        </Link>
                        <div className="flex items-center space-x-1.5">
                          <span className="rounded bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700">
                            {note.category}
                          </span>
                          <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {note.visibility}
                          </span>
                        </div>
                      </div>
                      {note.content && (
                        <p className="text-slate-700 whitespace-pre-line bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                          {note.content}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500">
                        <span className="inline-flex items-center space-x-1 font-medium text-slate-700">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>Autor: {note.authorName} ({note.authorEmail})</span>
                        </span>
                        <span>{new Date(note.createdAt).toLocaleString('es-MX')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pestaña: Convocatoria */}
      {activeTab === 'convocatoria' && (
        <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-institutional-navy">
                Convocatoria Institucional
              </h2>
              <p className="text-xs text-slate-500">
                Cédula formal de citación a miembros colegiados e invitados.
              </p>
            </div>
            <div>
              {meeting.convocatoria?.isPublished ? (
                <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Publicada el {meeting.convocatoria.publishedAt}</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                  <span>Borrador No Publicado</span>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Número o Folio de Convocatoria *
              </label>
              <input
                type="text"
                value={convNumber}
                onChange={(e) => setConvNumber(e.target.value)}
                placeholder={`CONV-${meeting.folio}`}
                disabled={meeting.convocatoria?.isPublished}
                className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-900 font-mono focus:border-institutional-navy focus:outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Texto de la Convocatoria / Cédula Notificatoria *
              </label>
              <textarea
                rows={8}
                value={convNoticeText}
                onChange={(e) => setConvNoticeText(e.target.value)}
                disabled={meeting.convocatoria?.isPublished}
                placeholder="Por medio de la presente, se convoca a los miembros del órgano colegiado a la sesión..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-institutional-navy focus:outline-none disabled:bg-slate-50 font-serif leading-relaxed"
              />
            </div>

            {!meeting.convocatoria?.isPublished && (
              <div className="flex items-center space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleSaveConvocatoria(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Guardar Borrador
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConvocatoria(true)}
                  className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
                >
                  Publicar Convocatoria Oficial
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pestaña: Orden del Día */}
      {activeTab === 'agenda' && (
        <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-institutional-navy">
                Orden del Día ({meeting.agendaItems.length} puntos)
              </h2>
              <p className="text-xs text-slate-500">
                Temas a tratar, expositores y registro de desahogo colegiado.
              </p>
            </div>
            <button
              onClick={() => setIsAgendaModalOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-institutional-navy px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agregar Punto</span>
            </button>
          </div>

          {meeting.agendaItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <p>No se han registrado puntos para el orden del día de esta reunión.</p>
              <button
                onClick={() => setIsAgendaModalOpen(true)}
                className="inline-flex items-center space-x-1 text-amber-700 font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Agregar el primer punto</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-3 w-16 text-center">Nº</th>
                    <th className="px-4 py-3">Punto / Asunto</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3 text-center">Tiempo Estimado</th>
                    <th className="px-4 py-3 text-center">Desahogado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-600">
                  {meeting.agendaItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-center font-bold text-slate-800">
                        {item.orderIndex}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{item.title}</div>
                        {item.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.responsibleName || '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {item.estimatedMinutes ? `${item.estimatedMinutes} min` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleTreated(item.id, item.isTreated)}
                          className={`inline-flex items-center space-x-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                            item.isTreated
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {item.isTreated ? (
                            <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-slate-400" />
                          )}
                          <span>{item.isTreated ? 'Desahogado' : 'Pendiente'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pestaña: Participantes y Asistencia */}
      {activeTab === 'participants' && (
        <div className="space-y-6">
          {/* Métricas de Asistencia 3D */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-center shadow-xs hover:shadow-md transition">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Convocados</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {meeting.attendanceSummary.totalConvocados}
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-emerald-50/30 p-4 text-center shadow-xs hover:shadow-md transition">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-700">Presentes</span>
              <span className="text-2xl font-black text-emerald-800 mt-1 block">
                {meeting.attendanceSummary.presentes}
              </span>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-gradient-to-b from-rose-50/80 to-rose-50/30 p-4 text-center shadow-xs hover:shadow-md transition">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-rose-700">Ausentes</span>
              <span className="text-2xl font-black text-rose-800 mt-1 block">
                {meeting.attendanceSummary.ausentes}
              </span>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/80 to-amber-50/30 p-4 text-center shadow-xs hover:shadow-md transition">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-700">Justificados</span>
              <span className="text-2xl font-black text-amber-800 mt-1 block">
                {meeting.attendanceSummary.justificados}
              </span>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/80 to-blue-50/30 p-4 text-center shadow-xs hover:shadow-md transition">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-blue-700">Tardanzas</span>
              <span className="text-2xl font-black text-blue-800 mt-1 block">
                {meeting.attendanceSummary.tardanzas}
              </span>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/80 to-indigo-50/30 p-4 text-center shadow-xs hover:shadow-md transition">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-indigo-700">% Asistencia</span>
              <span className="text-2xl font-black text-indigo-800 mt-1 block">
                {meeting.attendanceSummary.porcentajeAsistencia}%
              </span>
            </div>
          </div>

          {/* Panel 3D: Mi Asistencia a esta Sesión (Auto-gestión de Asistencia) */}
          {(() => {
            const myParticipant = meeting.participants.find(
              (p) =>
                p.userId === user?.id ||
                (p.user && p.user.id === user?.id) ||
                (user?.email && p.externalEmail?.toLowerCase() === user.email.toLowerCase()),
            );
            const myStatus = myParticipant?.attendanceStatus;
            const hasMarked =
              myStatus &&
              myStatus !== 'CONVOCADO' &&
              myStatus !== 'PENDIENTE';

            return (
              <div className="relative overflow-hidden rounded-2xl border-2 border-sky-400/50 border-b-[6px] border-b-slate-950 bg-gradient-to-r from-slate-800 via-blue-800 to-slate-900 p-4 sm:p-6 text-white shadow-xl">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 rounded-full bg-sky-400/15 blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
                  {/* Identidad del usuario */}
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
                    <div className="relative flex-shrink-0">
                      <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-black text-lg sm:text-xl shadow-lg border-2 border-sky-200">
                        {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div
                        className="absolute -bottom-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-900"
                        title="Sesión activa"
                      >
                        <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-white animate-pulse" />
                      </div>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-sky-200">
                          Mi Perfil en esta Sesión
                        </span>
                        <span className="rounded-full bg-sky-500/30 border border-sky-300/40 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-amber-200 uppercase">
                          {isAdmin ? 'Administrador' : 'Usuario'}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex flex-wrap items-center gap-1.5">
                        <span className="truncate">{user ? `${user.firstName} ${user.lastName}` : 'Usuario Conectado'}</span>
                        <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-white uppercase tracking-wider shadow-sm">
                          TÚ
                        </span>
                      </h3>
                      <div className="text-[11px] sm:text-xs text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="truncate">{user?.email}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>
                          {myParticipant?.institutionalRole ||
                            (isAdmin ? 'Administrador Institucional' : 'Vocal / Colegiado')}
                        </span>
                      </div>

                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] sm:text-xs text-slate-300 font-medium">Estado actual:</span>
                        {!hasMarked ? (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-amber-500/20 border border-amber-400/50 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-amber-300 shadow-sm animate-pulse">
                            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                            <span>Todavía no registra asistencia</span>
                          </span>
                        ) : myStatus === 'PRESENTE' || myStatus === 'ASISTIO' ? (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-500/30 border border-emerald-400/60 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-emerald-300 shadow-sm">
                            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                            <span>Presente (Registrada)</span>
                          </span>
                        ) : myStatus === 'AUSENTE' ? (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-rose-500/30 border border-rose-400/60 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-rose-300 shadow-sm">
                            <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                            <span>Ausente</span>
                          </span>
                        ) : myStatus === 'JUSTIFICADO' ? (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-amber-500/30 border border-amber-400/60 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-amber-300 shadow-sm">
                            <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                            <span>Asistencia Justificada</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-blue-500/30 border border-blue-400/60 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-blue-300 shadow-sm">
                            <span>{myStatus}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción propios (En cuadrícula 2 columnas para celulares pequeños) */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-row items-stretch sm:items-center gap-2 pt-1 lg:pt-0">
                    <button
                      type="button"
                      onClick={() => handleSelfAttendance(AttendanceStatus.PRESENTE)}
                      className={`col-span-2 sm:col-span-1 inline-flex items-center justify-center space-x-1.5 rounded-xl font-bold text-xs px-3.5 py-2.5 transition shadow-lg active:scale-95 ${
                        myStatus === 'PRESENTE' || myStatus === 'ASISTIO'
                          ? 'bg-emerald-500 text-white ring-2 ring-emerald-300'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Marcar Presente</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelfAttendance(AttendanceStatus.AUSENTE)}
                      className={`inline-flex items-center justify-center space-x-1.5 rounded-xl font-bold text-xs px-3 py-2.5 transition shadow-lg active:scale-95 ${
                        myStatus === 'AUSENTE'
                          ? 'bg-rose-500 text-white ring-2 ring-rose-300'
                          : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white'
                      }`}
                    >
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>Ausente</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setJustificationModal({
                          open: true,
                          isSelf: true,
                          participantId: myParticipant?.id,
                          participantName: user ? `${user.firstName} ${user.lastName}` : 'Mi Asistencia',
                        })
                      }
                      className={`inline-flex items-center justify-center space-x-1.5 rounded-xl font-bold text-xs px-3 py-2.5 transition shadow-lg active:scale-95 ${
                        myStatus === 'JUSTIFICADO'
                          ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                          : 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white'
                      }`}
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <span>Justificar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Tabla de Participantes */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-black text-institutional-navy flex items-center space-x-2">
                  <span>Padrón de Convocados y Asistencia</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAdmin
                    ? 'Supervisión ejecutiva: como Administrador puedes actualizar la asistencia de todos los participantes.'
                    : 'Padrón colegiado en tiempo real. Puedes ver las asistencias de todos los convocados; cada usuario registra su propio estado.'}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setIsParticipantModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-institutional-navy px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Agregar Convocado</span>
                </button>
              )}
            </div>

            {meeting.participants.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-3">
                <p className="text-slate-500 font-medium">No se han registrado participantes para esta sesión institucional.</p>
                {isAdmin && (
                  <button
                    onClick={() => setIsParticipantModalOpen(true)}
                    className="inline-flex items-center space-x-1.5 text-indigo-700 font-bold hover:text-indigo-800"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Convocar al primer participante</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-5 py-3.5">Participante</th>
                      <th className="px-5 py-3.5">Rol Institucional</th>
                      <th className="px-5 py-3.5">Condición</th>
                      <th className="px-5 py-3.5 text-center">Estado de Asistencia</th>
                      <th className="px-5 py-3.5 text-right">
                        {isAdmin ? 'Acciones (Admin)' : 'Mi Asistencia'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {meeting.participants.map((p) => {
                      const name = p.user
                        ? `${p.user.firstName} ${p.user.lastName}`
                        : p.externalName || 'Participante Externo';
                      const email = p.user ? p.user.email : p.externalEmail;
                      const isSelfRow = Boolean(
                        p.userId === user?.id ||
                        (p.user && p.user.id === user?.id) ||
                        (user?.email && p.externalEmail && p.externalEmail.toLowerCase() === user.email.toLowerCase()),
                      );
                      const canEditRow = isAdmin || isSelfRow;

                      const isPresent =
                        p.attendanceStatus === 'PRESENTE' || p.attendanceStatus === 'ASISTIO';
                      const isAbsent =
                        p.attendanceStatus === 'AUSENTE' || p.attendanceStatus === 'FALTA_INJUSTIFICADA';
                      const isJustified =
                        p.attendanceStatus === 'JUSTIFICADO' || p.attendanceStatus === 'FALTA_JUSTIFICADA';
                      const isLate = p.attendanceStatus === 'TARDANZA';

                      return (
                        <tr
                          key={p.id}
                          className={`transition ${
                            isSelfRow
                              ? 'bg-indigo-50/60 hover:bg-indigo-50 font-semibold border-l-4 border-l-indigo-600'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-[13px]">{name}</span>
                              {isSelfRow && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-600 text-white shadow-xs">
                                  Tú
                                </span>
                              )}
                            </div>
                            {email && (
                              <div className="text-[11px] text-slate-400 font-normal">{email}</div>
                            )}
                            {p.isExternal && (
                              <span className="inline-block mt-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 text-[9px] font-bold">
                                EXTERNO ({p.externalOrganization || 'Invitado'})
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-800 font-semibold">{p.institutionalRole}</td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-[11px] font-bold text-slate-600 px-2.5 py-0.5 bg-slate-100 rounded-md">
                              {p.participationCondition}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {isPresent ? (
                              <span className="inline-flex items-center space-x-1.5 rounded-full px-3 py-1 text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Presente</span>
                              </span>
                            ) : isAbsent ? (
                              <span className="inline-flex items-center space-x-1.5 rounded-full px-3 py-1 text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-xs">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Ausente</span>
                              </span>
                            ) : isJustified ? (
                              <span className="inline-flex items-center space-x-1.5 rounded-full px-3 py-1 text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Justificado</span>
                              </span>
                            ) : isLate ? (
                              <span className="inline-flex items-center space-x-1.5 rounded-full px-3 py-1 text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-300 shadow-xs">
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                <span>Tardanza</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1.5 rounded-full px-3 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-xs">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span>Todavía no registra asistencia</span>
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {canEditRow ? (
                              <div className="inline-flex items-center justify-end space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isSelfRow
                                      ? handleSelfAttendance(AttendanceStatus.PRESENTE)
                                      : handleUpdateAttendance(p.id, AttendanceStatus.PRESENTE)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-[11px] transition shadow-xs active:scale-95"
                                  title="Marcar Presente"
                                >
                                  Presente
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    isSelfRow
                                      ? handleSelfAttendance(AttendanceStatus.AUSENTE)
                                      : handleUpdateAttendance(p.id, AttendanceStatus.AUSENTE)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-[11px] transition shadow-xs active:scale-95"
                                  title="Marcar Ausente"
                                >
                                  Ausente
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setJustificationModal({
                                      open: true,
                                      isSelf: isSelfRow,
                                      participantId: p.id,
                                      participantName: name,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-bold text-[11px] transition shadow-xs active:scale-95"
                                  title="Justificar Inasistencia"
                                >
                                  Justificar
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400 italic">
                                Solo lectura
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pestaña: Desarrollo de Sesión */}
      {activeTab === 'session' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-institutional-navy border-b border-slate-100 pb-2">
              Estado Operativo de la Sesión Colegiada
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="block text-slate-400 text-[10px]">Apertura Real</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {meeting.realStartTime ? new Date(meeting.realStartTime).toLocaleTimeString() : 'No iniciada'}
                </span>
              </div>

              <div>
                <span className="block text-slate-400 text-[10px]">Clausura Real</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {meeting.realEndTime ? new Date(meeting.realEndTime).toLocaleTimeString() : 'En curso / Pendiente'}
                </span>
              </div>

              <div>
                <span className="block text-slate-400 text-[10px]">Eventos Asentados</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {meeting.sessionLogs?.length || 0} anotaciones
                </span>
              </div>
            </div>
          </div>

          {/* Formulario de Asentamiento de Evento */}
          {meeting.status === 'EN_DESARROLLO' && (
            <form onSubmit={handleAddSessionLog} className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-institutional-navy">
                Asentar Hecho, Receso o Deliberación en Vivo
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Evento</label>
                  <select
                    value={sessionLogType}
                    onChange={(e) => setSessionLogType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                  >
                    <option value="DELIBERACION">Deliberación</option>
                    <option value="INCIDENTE">Incidente / Suceso</option>
                    <option value="RECESO">Receso</option>
                    <option value="REANUDACION">Reanudación</option>
                    <option value="VOTACION">Votación</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Descripción de la Deliberación *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={sessionLogDesc}
                      onChange={(e) => setSessionLogDesc(e.target.value)}
                      placeholder="Describa el hecho ocurrido, moción o intervención..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-institutional-navy px-4 py-2 font-semibold text-white hover:bg-slate-800 shrink-0"
                    >
                      Asentar
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Historial Cronológico de Bitácora */}
          <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-institutional-navy border-b border-slate-100 pb-2">
              Bitácora Cronológica de la Sesión
            </h3>

            {(!meeting.sessionLogs || meeting.sessionLogs.length === 0) ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No se han registrado eventos o incidencias en la bitácora de esta sesión.
              </div>
            ) : (
              <div className="space-y-3">
                {meeting.sessionLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-slate-200 p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-mono font-bold text-slate-700 border border-slate-200">
                        {log.entryType}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium">{log.description}</p>
                    <span className="block text-[10px] text-slate-400">
                      Asentado por {log.registeredBy.fullName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pestaña: Acta Institucional */}
      {activeTab === 'minutes' && (
        <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-institutional-navy">
                Acta Institucional Oficial
              </h2>
              <p className="text-xs text-slate-500">
                Documento legal y testimonial de las deliberaciones y resoluciones adoptadas.
              </p>
            </div>
            <div>
              {meeting.minutes?.status === 'APROBADA' ? (
                <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Acta Aprobada (Versión {meeting.minutes.version})</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                  <span>Estado: {meeting.minutes?.status || 'BORRADOR'}</span>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Número Oficial del Acta *
                </label>
                <input
                  type="text"
                  value={minutesNumber}
                  onChange={(e) => setMinutesNumber(e.target.value)}
                  placeholder={`ACTA-${meeting.folio}`}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Estado del Acta
                </label>
                <select
                  value={minutesStatus}
                  onChange={(e) => setMinutesStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                >
                  <option value="BORRADOR">BORRADOR (Elaboración interna)</option>
                  <option value="EN_REVISION">EN_REVISION (Sometida a observaciones)</option>
                  <option value="APROBADA">APROBADA (Formalmente validada)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Resumen Ejecutivo de la Sesión *
              </label>
              <textarea
                rows={4}
                value={minutesSummary}
                onChange={(e) => setMinutesSummary(e.target.value)}
                placeholder="En la Ciudad de México, siendo las horas..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 font-serif leading-relaxed focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Desahogo de los Puntos Tratados
              </label>
              <textarea
                rows={4}
                value={minutesPoints}
                onChange={(e) => setMinutesPoints(e.target.value)}
                placeholder="Punto 1: Aprobación... Punto 2: Presentación del informe..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 font-serif leading-relaxed focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Incidencias y Resoluciones Asentadas
              </label>
              <textarea
                rows={3}
                value={minutesIncidents}
                onChange={(e) => setMinutesIncidents(e.target.value)}
                placeholder="Incidencias ocurridas durante la deliberación..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 font-serif leading-relaxed focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleSaveMinutes}
                className="rounded-lg bg-institutional-navy px-5 py-2 font-semibold text-white hover:bg-slate-800 transition"
              >
                Guardar Acta Institucional
              </button>

              {meeting.minutes && meeting.minutes.status !== 'APROBADA' && (
                <button
                  type="button"
                  onClick={handleApproveMinutes}
                  className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-500 transition shadow-sm"
                >
                  Aprobar Acta Formalmente
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pestaña: Archivos en Bóveda vinculados a esta Reunión */}
      {activeTab === 'documents' && (
        <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-institutional-navy flex items-center gap-2">
                <FolderLock className="h-4 w-4 text-purple-600" />
                <span>Archivos y Documentos Subidos para esta Reunión ({meetingDocuments.length})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Todos los documentos cargados por los diversos integrantes vinculados al expediente de esta sesión.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/vault?meetingId=${id}`}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <span>Ver en Bóveda</span>
              </Link>
              <button
                onClick={() => setIsUploadDocModalOpen(true)}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition shadow-sm"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Subir Archivo a esta Reunión</span>
              </button>
            </div>
          </div>

          {meetingDocuments.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <p>No se han subido archivos para esta reunión todavía.</p>
              <button
                onClick={() => setIsUploadDocModalOpen(true)}
                className="inline-flex items-center space-x-1 text-purple-700 font-semibold"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Subir el primer documento a esta reunión</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Archivo</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Subido por</th>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {meetingDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <Link href={`/vault/${doc.id}`} className="hover:text-purple-600">
                          {doc.originalFilename}
                        </Link>
                        <span className="ml-2 text-[10px] font-mono text-slate-400">v{doc.version}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                          {doc.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs">
                        {doc.description || <span className="text-slate-400 italic">Sin descripción</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {doc.uploader?.fullName || 'Integrante'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(doc.createdAt).toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDownloadMeetingDocument(doc.id)}
                          disabled={doc.scanStatus === 'INFECTADO'}
                          className="inline-flex items-center space-x-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Descargar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pestaña: Anotaciones vinculadas a esta Reunión */}
      {activeTab === 'notes' && (
        <div className="rounded-xl border border-institutional-border bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-institutional-navy flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-600" />
                <span>Anotaciones y Observaciones de la Reunión ({meetingNotes.length})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Apuntes, observaciones técnicas y comentarios registrados por los participantes para esta sesión.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/notes/new?meetingId=${id}`}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <span>Editor Completo</span>
              </Link>
              <button
                onClick={() => setIsNoteModalOpen(true)}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Registrar Anotación</span>
              </button>
            </div>
          </div>

          {meetingNotes.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <p>No se han registrado anotaciones para esta reunión todavía.</p>
              <button
                onClick={() => setIsNoteModalOpen(true)}
                className="inline-flex items-center space-x-1 text-cyan-700 font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Registrar la primera anotación</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {meetingNotes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/notes/${note.id}`}
                      className="text-sm font-bold text-slate-900 hover:text-cyan-700"
                    >
                      {note.title}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                        {note.category}
                      </span>
                      <span className="rounded bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        Visibilidad: {note.visibility}
                      </span>
                    </div>
                  </div>
                  {note.content && (
                    <p className="text-slate-700 whitespace-pre-line bg-white rounded-lg p-3 border border-slate-200 leading-relaxed">
                      {note.content}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="font-semibold text-slate-700">
                      Registrado por: {note.authorName} ({note.authorEmail})
                    </span>
                    <span>{new Date(note.createdAt).toLocaleString('es-MX')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Subir Documento Directamente a esta Reunión */}
      {isUploadDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-slate-300 border-b-[6px] border-b-slate-700">
            <h3 className="text-base font-bold text-institutional-navy mb-1">
              Subir Documento a esta Reunión
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Reunión vinculada: <span className="font-semibold text-slate-800">[{meeting.folio}] {meeting.title}</span>
            </p>

            <form onSubmit={handleUploadMeetingDocument} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Seleccionar Archivo *
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setUploadDocFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-purple-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Categoría Documental
                </label>
                <select
                  value={uploadDocCategory}
                  onChange={(e) => setUploadDocCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                >
                  <option value="ANEXO">Anexo Técnico</option>
                  <option value="DICTAMEN">Dictamen</option>
                  <option value="ACTA">Acta Oficial</option>
                  <option value="CONVOCATORIA">Convocatoria</option>
                  <option value="EVIDENCIA">Evidencia</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descripción / Observación del Archivo
                </label>
                <textarea
                  rows={3}
                  value={uploadDocDesc}
                  onChange={(e) => setUploadDocDesc(e.target.value)}
                  placeholder="Indique el contenido o propósito de este documento para la reunión..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsUploadDocModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDoc || !uploadDocFile}
                  className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-500 transition disabled:opacity-50"
                >
                  {isUploadingDoc ? 'Subiendo...' : 'Subir a la Reunión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Anotación Directamente en esta Reunión */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-slate-300 border-b-[6px] border-b-slate-700">
            <h3 className="text-base font-bold text-institutional-navy mb-1">
              Registrar Anotación en la Reunión
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Reunión vinculada: <span className="font-semibold text-slate-800">[{meeting.folio}] {meeting.title}</span>
            </p>

            <form onSubmit={handleCreateMeetingNote} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Título de la Anotación *
                </label>
                <input
                  type="text"
                  required
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Ej: Observaciones sobre el punto 2 del orden del día"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={newNoteCategory}
                    onChange={(e) => setNewNoteCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                  >
                    <option value="SESION">Sesión</option>
                    <option value="TECNICO">Técnico</option>
                    <option value="JURIDICO">Jurídico</option>
                    <option value="PRESUPUESTAL">Presupuestal</option>
                    <option value="ACUERDO">Acuerdo</option>
                    <option value="SEGUIMIENTO">Seguimiento</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Visibilidad
                  </label>
                  <select
                    value={newNoteVisibility}
                    onChange={(e) => setNewNoteVisibility(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                  >
                    <option value="REUNION">Compartida en la Reunión</option>
                    <option value="PUBLICA">Pública Institucional</option>
                    <option value="PRIVADA">Privada (Solo yo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contenido / Apuntes *
                </label>
                <textarea
                  rows={4}
                  required
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Escriba aquí las observaciones, posicionamientos o notas de la reunión..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNote || !newNoteTitle.trim() || !newNoteContent.trim()}
                  className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 transition disabled:opacity-50"
                >
                  {isSavingNote ? 'Guardando...' : 'Guardar Anotación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cancelar Reunión */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-institutional-border">
            <h3 className="text-base font-bold text-rose-800 mb-2">
              Cancelar Reunión Institucional
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Indique obligatoriamente el motivo colegiado por el cual se suspende o cancela la sesión.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo de Cancelación *
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej: Falta de quórum legal requerido o causa de fuerza mayor."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(MeetingStatus.CANCELADA, cancelReason)}
                  className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-500 transition"
                >
                  Confirmar Cancelación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Punto Orden del Día */}
      {isAgendaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-slate-300 border-b-[6px] border-b-slate-700">
            <h3 className="text-base font-bold text-institutional-navy mb-4">
              Agregar Punto al Orden del Día
            </h3>

            <form onSubmit={handleAddAgendaItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Título del Asunto *
                </label>
                <input
                  type="text"
                  required
                  value={agendaTitle}
                  onChange={(e) => setAgendaTitle(e.target.value)}
                  placeholder="Ej: Lectura y aprobación del acta anterior"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descripción o Alcance
                </label>
                <textarea
                  rows={2}
                  value={agendaDesc}
                  onChange={(e) => setAgendaDesc(e.target.value)}
                  placeholder="Detalles sobre el punto a deliberar..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Expositor / Responsable
                  </label>
                  <input
                    type="text"
                    value={agendaResponsible}
                    onChange={(e) => setAgendaResponsible(e.target.value)}
                    placeholder="Ej: Mtro. Juan Pérez"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Minutos Estimados
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={agendaMinutes}
                    onChange={(e) => setAgendaMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAgendaModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-institutional-navy px-4 py-2 font-semibold text-white hover:bg-slate-800 transition"
                >
                  Agregar Punto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agregar Participante */}
      {isParticipantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-slate-300 border-b-[6px] border-b-slate-700">
            <h3 className="text-base font-bold text-institutional-navy mb-4">
              Registrar Convocado a la Sesión
            </h3>

            <form onSubmit={handleAddParticipant} className="space-y-4 text-xs">
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                <input
                  type="checkbox"
                  id="externalCheck"
                  checked={partIsExternal}
                  onChange={(e) => setPartIsExternal(e.target.checked)}
                  className="rounded border-slate-300 text-institutional-navy focus:ring-0"
                />
                <label htmlFor="externalCheck" className="font-semibold text-slate-800">
                  Participante Externo (Invitado / Perito / Dependencia)
                </label>
              </div>

              {partIsExternal && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={partExternalName}
                      onChange={(e) => setPartExternalName(e.target.value)}
                      placeholder="Ej: Lic. Roberto Gómez"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={partExternalEmail}
                      onChange={(e) => setPartExternalEmail(e.target.value)}
                      placeholder="roberto@entidad.gob.mx"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Institución / Organización
                    </label>
                    <input
                      type="text"
                      value={partExternalOrg}
                      onChange={(e) => setPartExternalOrg(e.target.value)}
                      placeholder="Ej: Auditoría Superior de la Federación"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Rol Institucional
                  </label>
                  <input
                    type="text"
                    value={partRole}
                    onChange={(e) => setPartRole(e.target.value)}
                    placeholder="Ej: Vocal, Secretario"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Condición
                  </label>
                  <select
                    value={partCondition}
                    onChange={(e) => setPartCondition(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none"
                  >
                    <option value="TITULAR">TITULAR</option>
                    <option value="SUPLENTE">SUPLENTE</option>
                    <option value="INVITADO">INVITADO</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsParticipantModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-institutional-navy px-4 py-2 font-semibold text-white hover:bg-slate-800 transition"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para ingresar justificación de inasistencia */}
      {justificationModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Justificar Inasistencia
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {justificationModal.isSelf
                      ? 'Registro personal de justificación'
                      : `Convocado: ${justificationModal.participantName || 'Participante'}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setJustificationModal(null);
                  setJustificationText('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Motivo o Folio de Justificación Institucional:
              </label>
              <textarea
                rows={3}
                value={justificationText}
                onChange={(e) => setJustificationText(e.target.value)}
                placeholder="Ej: Oficio SG-2026-049 por comisión oficial fuera de sede / Motivos de salud reglamentarios."
                className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400"
              />
              <p className="text-[11px] text-slate-400">
                Esta justificación quedará auditada forensemente en el historial de la sesión colegiada.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setJustificationModal(null);
                  setJustificationText('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const just = justificationText.trim() || 'Justificación reglamentaria';
                  if (justificationModal.isSelf) {
                    await handleSelfAttendance(AttendanceStatus.JUSTIFICADO, just);
                  } else if (justificationModal.participantId) {
                    await handleUpdateAttendance(
                      justificationModal.participantId,
                      AttendanceStatus.JUSTIFICADO,
                      just,
                    );
                  }
                  setJustificationModal(null);
                  setJustificationText('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 shadow-md transition active:scale-95"
              >
                Confirmar Justificación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
