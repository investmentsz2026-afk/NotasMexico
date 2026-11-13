'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import {
  AgreementDetailDto,
  AgreementStatus,
  AgreementPriority,
  AgreementCollaboratorDto,
  AgreementProgressDto,
  AgreementEvidenceDto,
  AgreementHistoryDto,
} from '@mexagenda/shared';
import {
  FileCheck2,
  Calendar,
  Clock,
  ArrowLeft,
  Edit2,
  Users,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  Paperclip,
  TrendingUp,
  PauseCircle,
  PlayCircle,
  XCircle,
  Plus,
  Trash2,
  UserCheck,
  Building,
  ShieldCheck,
  AlertCircle,
  Send,
  ExternalLink,
  ChevronRight,
  Archive,
} from 'lucide-react';

interface AssignableUser {
  id: string;
  fullName: string;
  email: string;
  position?: string | null;
}

const STATUS_CONFIG: Record<
  AgreementStatus,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  PENDIENTE: {
    label: 'Pendiente',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    icon: <Clock className="h-3.5 w-3.5 text-amber-700" />,
  },
  EN_PROCESO: {
    label: 'En Proceso',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 font-bold',
    icon: <TrendingUp className="h-3.5 w-3.5 text-blue-700" />,
  },
  CUMPLIDO: {
    label: 'Cumplido',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />,
  },
  COMPLETADO: {
    label: 'Cumplido',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />,
  },
  VENCIDO: {
    label: 'Vencido',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-black',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-rose-700" />,
  },
  SUSPENDIDO: {
    label: 'Suspendido',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
    icon: <PauseCircle className="h-3.5 w-3.5 text-purple-700" />,
  },
  CANCELADO: {
    label: 'Cancelado',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 font-bold',
    icon: <XCircle className="h-3.5 w-3.5 text-slate-600" />,
  },
};

const PRIORITY_CONFIG: Record<
  AgreementPriority,
  { label: string; badgeClass: string }
> = {
  URGENTE: { label: 'Urgente', badgeClass: 'bg-red-100 text-red-900 border-red-300 font-black' },
  ALTA: { label: 'Alta', badgeClass: 'bg-orange-100 text-orange-900 border-orange-300 font-bold' },
  MEDIA: { label: 'Media', badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 font-bold' },
  BAJA: { label: 'Baja', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 font-bold' },
};

export default function AgreementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();

  const [agreement, setAgreement] = useState<AgreementDetailDto | null>(null);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tabs
  type TabType = 'general' | 'progress' | 'collaborators' | 'evidences' | 'history';
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Modales
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [newPercent, setNewPercent] = useState<number>(0);
  const [progressNotes, setProgressNotes] = useState('');
  const [progressJustification, setProgressJustification] = useState('');

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [assignReason, setAssignReason] = useState('');

  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [newCollabUserId, setNewCollabUserId] = useState('');
  const [collabNotes, setCollabNotes] = useState('');

  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [evidenceMimeType, setEvidenceMimeType] = useState('application/pdf');

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');

  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  const [reactivateReason, setReactivateReason] = useState('');

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Carga de datos
  const fetchAgreement = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AgreementDetailDto>(`/agreements/${id}`);
      setAgreement(data);
      setNewPercent(data.progressPercent);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Error al cargar el expediente del acuerdo institucional.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchAgreement();
  }, [id, fetchAgreement]);

  // Cargar usuarios para modales
  useEffect(() => {
    async function loadUsers() {
      try {
        const u = await apiFetch<AssignableUser[]>('/agreements/users');
        setUsers(u || []);
      } catch (e) {
        console.error('Error cargando usuarios:', e);
      }
    }
    loadUsers();
  }, []);

  // Handlers para acciones
  const handleAddProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreement) return;

    if (newPercent < agreement.progressPercent && !progressJustification.trim()) {
      setError('Debes proporcionar una justificación obligatoria al reducir el porcentaje de avance.');
      return;
    }

    setIsSubmittingAction(true);
    setError(null);
    try {
      await apiFetch(`/agreements/${id}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          progressPercent: Number(newPercent),
          observations: progressNotes.trim(),
          justification: progressJustification.trim() || undefined,
        }),
      });
      setSuccessMessage('Avance institucional registrado con éxito.');
      setIsProgressModalOpen(false);
      setProgressNotes('');
      setProgressJustification('');
      await fetchAgreement();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el avance.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssigneeId) {
      setError('Debes seleccionar al nuevo responsable.');
      return;
    }
    if (!assignReason.trim()) {
      setError('La justificación del cambio de asignación es obligatoria.');
      return;
    }

    setIsSubmittingAction(true);
    setError(null);
    try {
      await apiFetch(`/agreements/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          assignedToId: newAssigneeId,
          changeReason: assignReason.trim(),
        }),
      });
      setSuccessMessage('Responsable institucional actualizado con éxito.');
      setIsAssignModalOpen(false);
      setAssignReason('');
      await fetchAgreement();
    } catch (err: any) {
      setError(err.message || 'Error al reasignar el acuerdo.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollabUserId) {
      setError('Debes seleccionar un usuario colaborador.');
      return;
    }

    setIsSubmittingAction(true);
    setError(null);
    try {
      await apiFetch(`/agreements/${id}/collaborators`, {
        method: 'POST',
        body: JSON.stringify({
          userId: newCollabUserId,
          notes: collabNotes.trim() || undefined,
        }),
      });
      setSuccessMessage('Colaborador institucional agregado exitosamente.');
      setIsCollabModalOpen(false);
      setNewCollabUserId('');
      setCollabNotes('');
      await fetchAgreement();
    } catch (err: any) {
      setError(err.message || 'Error al agregar colaborador.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleRemoveCollaborator = async (collabUserId: string) => {
    if (!confirm('¿Confirmas remover a este colaborador institucional del acuerdo?')) return;

    setError(null);
    try {
      await apiFetch(`/agreements/${id}/collaborators/${collabUserId}`, {
        method: 'DELETE',
      });
      setSuccessMessage('Colaborador removido exitosamente.');
      await fetchAgreement();
    } catch (err: any) {
      setError(err.message || 'Error al remover colaborador.');
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceTitle.trim()) {
      setError('El título de la evidencia es obligatorio.');
      return;
    }
    if (!evidenceFileName.trim()) {
      setError('El nombre del archivo o referencia es obligatorio.');
      return;
    }

    setIsSubmittingAction(true);
    setError(null);
    try {
      await apiFetch(`/agreements/${id}/evidences`, {
        method: 'POST',
        body: JSON.stringify({
          title: evidenceTitle.trim(),
          description: evidenceDesc.trim() || undefined,
          documentReference: evidenceFileName.trim() || undefined,
        }),
      });
      setSuccessMessage('Evidencia documental vinculada correctamente.');
      setIsEvidenceModalOpen(false);
      setEvidenceTitle('');
      setEvidenceDesc('');
      setEvidenceFileName('');
      await fetchAgreement();
    } catch (err: any) {
      setError(err.message || 'Error al vincular evidencia documental.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAction(true);
    setError(null);
    try {
      await apiFetch(`/agreements/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          observations: completeNotes.trim() || undefined,
        }),
      });
      setSuccessMessage('El acuerdo institucional ha sido declarado formalmente CUMPLIDO.');
      setIsCompleteModalOpen(false);
      setCompleteNotes('');
      await fetchAgreement();
    } catch (err: any) {
      setError(err.message || 'Error al formalizar el cumplimiento del acuerdo.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendReason.trim()) {
      setError('La justificación de la suspensión temporal es obligatoria.');
      return;
    }

    setIsSubmittingAction(true);
    setError(null);
    try {
      await apiFetch(`/agreements/${id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: suspendReason.trim() }),
      });
      setSuccessMessage('Acuerdo suspendido temporalmente.');
      setIsSuspendModalOpen(false);
      setSuspendReason('');
      await fetchAgreement();
    } catch (err: any) {
      setError(err.message || 'Error al suspender el acuerdo.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAction(true);
    setError(null);
    try {
      await apiFetch(`/agreements/${id}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ reason: reactivateReason.trim() || undefined }),
      });
      setSuccessMessage('Acuerdo reactivado exitosamente.');
      setIsReactivateModalOpen(false);
      setReactivateReason('');
      await fetchAgreement();
    } catch (err: any) {
      setError(err.message || 'Error al reactivar el acuerdo.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setError('La fundamentación institucional de la cancelación es obligatoria.');
      return;
    }

    setIsSubmittingAction(true);
    setError(null);
    try {
      await apiFetch(`/agreements/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      setSuccessMessage('El acuerdo institucional ha sido CANCELADO.');
      setIsCancelModalOpen(false);
      setCancelReason('');
      await fetchAgreement();
    } catch (err: any) {
      setError(err.message || 'Error al cancelar el acuerdo.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('¿Deseas archivar este acuerdo institucional del padrón activo?')) return;
    try {
      await apiFetch(`/agreements/${id}`, { method: 'DELETE' });
      router.push('/agreements');
    } catch (err: any) {
      setError(err.message || 'Error al archivar el acuerdo.');
    }
  };

  // Permisos
  const perms = user?.permissions || [];
  const isAdmin = user?.role === 'ROLE_ADMIN';
  const canUpdate = perms.includes('agreement:update') || isAdmin;
  const canAssign = perms.includes('agreement:assign') || isAdmin;
  const canProgress = perms.includes('agreement:progress:create') || isAdmin;
  const canComplete = perms.includes('agreement:complete') || isAdmin;
  const canSuspend = perms.includes('agreement:suspend') || isAdmin;
  const canReactivate = perms.includes('agreement:reactivate') || isAdmin;
  const canCancel = perms.includes('agreement:cancel') || isAdmin;
  const canManage = perms.includes('agreement:manage') || isAdmin;

  if (isLoading && !agreement) {
    return (
      <div className="flex flex-col items-center justify-center p-20 rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
        <p className="text-xs text-slate-400">Consultando expediente en Neon PostgreSQL...</p>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-semibold text-slate-200">Acuerdo no encontrado</h2>
        <p className="text-xs text-slate-400">{error || 'El identificador proporcionado no existe en el sistema.'}</p>
        <Link
          href="/agreements"
          className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al Catálogo</span>
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[agreement.status] || STATUS_CONFIG.PENDIENTE;
  const priorityInfo = PRIORITY_CONFIG[agreement.priority] || PRIORITY_CONFIG.MEDIA;
  const isTerminal = agreement.status === 'CUMPLIDO' || agreement.status === 'CANCELADO';
  const isOverdue = agreement.status === 'VENCIDO';

  return (
    <div className="space-y-6">
      {/* Botón Volver y Header de Expediente 3D */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <Link
              href="/agreements"
              className="btn-3d rounded-xl bg-white p-2.5 text-slate-700 hover:bg-slate-50 transition border border-slate-200 shadow-sm"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-black text-amber-950 bg-amber-100 px-3 py-1 rounded-xl border border-amber-300 shadow-xs">
                {agreement.folio}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs border shadow-xs ${statusInfo.badgeClass}`}>
                {statusInfo.icon}
                <span>{statusInfo.label}</span>
              </span>
              <span className={`inline-flex items-center rounded-xl px-2.5 py-1 text-xs border shadow-xs ${priorityInfo.badgeClass}`}>
                {priorityInfo.label}
              </span>
            </div>
          </div>
          <h1 className="text-xl md:text-3xl font-black tracking-tight text-slate-900">
            {agreement.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
            <span>
              Origen Colegiado:{' '}
              <Link
                href={`/meetings/${agreement.meetingId}`}
                className="text-amber-700 hover:text-amber-900 font-extrabold underline inline-flex items-center gap-0.5"
              >
                <span>{agreement.meeting.folio}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </span>
            <span>•</span>
            <span>Versión: <strong className="text-slate-900">v{agreement.version}</strong></span>
            <span>•</span>
            <span>
              Responsable: <strong className="text-slate-900 font-bold">{agreement.assignee.fullName}</strong>
            </span>
          </div>
        </div>

        {/* Acciones de Estado Formal 3D */}
        <div className="flex flex-wrap items-center gap-2">
          {canProgress && !isTerminal && (
            <button
              onClick={() => setIsProgressModalOpen(true)}
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 transition"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Reportar Avance</span>
            </button>
          )}

          {canAssign && (
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-800 border border-slate-300 transition shadow-xs"
            >
              <UserCheck className="h-4 w-4 text-sky-600" />
              <span>Reasignar</span>
            </button>
          )}

          {canComplete && !isTerminal && (
            <button
              onClick={() => setIsCompleteModalOpen(true)}
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold shadow-md shadow-emerald-500/20 transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Completar</span>
            </button>
          )}

          {canSuspend && (agreement.status === 'PENDIENTE' || agreement.status === 'EN_PROCESO') && (
            <button
              onClick={() => setIsSuspendModalOpen(true)}
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-purple-500/20 transition"
            >
              <PauseCircle className="h-4 w-4" />
              <span>Suspender</span>
            </button>
          )}

          {canReactivate && agreement.status === 'SUSPENDIDO' && (
            <button
              onClick={() => setIsReactivateModalOpen(true)}
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-blue-500/20 transition"
            >
              <PlayCircle className="h-4 w-4" />
              <span>Reactivar</span>
            </button>
          )}

          {canCancel && !isTerminal && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-2 text-xs font-bold transition shadow-xs"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancelar</span>
            </button>
          )}

          {canManage && (
            <button
              onClick={handleArchive}
              title="Archivar acuerdo"
              className="btn-3d rounded-xl bg-slate-100 hover:bg-slate-200 p-2 text-slate-500 hover:text-slate-800 border border-slate-300 transition shadow-xs"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-4 text-rose-200 flex items-center justify-between text-xs md:text-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs text-rose-400 hover:underline">
            Cerrar
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-emerald-200 flex items-center justify-between text-xs md:text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-xs text-emerald-400 hover:underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Barra de Progreso Principal 3D */}
      <div className="card-3d bg-white p-5 border border-slate-200 rounded-3xl shadow-md space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">
            Avance Institucional Global
          </span>
          <span className="font-mono text-base font-black text-slate-900">
            {agreement.progressPercent}%
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              agreement.progressPercent === 100
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : agreement.progressPercent >= 50
                ? 'bg-gradient-to-r from-amber-500 to-blue-500'
                : 'bg-gradient-to-r from-amber-400 to-amber-500'
            }`}
            style={{ width: `${agreement.progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
          <span>0% Inicio</span>
          <span>50% En Proceso</span>
          <span>100% Meta Cumplida</span>
        </div>
      </div>

      {/* Navegación por Pestañas 3D */}
      <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto text-xs">
        {[
          { id: 'general', label: 'Información General', icon: <FileText className="h-4 w-4" /> },
          {
            id: 'progress',
            label: `Avances (${agreement.progressReports?.length || 0})`,
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            id: 'collaborators',
            label: `Colaboradores (${agreement.collaborators?.length || 0})`,
            icon: <Users className="h-4 w-4" />,
          },
          {
            id: 'evidences',
            label: `Evidencias (${agreement.evidences?.length || 0})`,
            icon: <Paperclip className="h-4 w-4" />,
          },
          {
            id: 'history',
            label: `Historial / Auditoría (${agreement.history?.length || 0})`,
            icon: <History className="h-4 w-4" />,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`inline-flex items-center space-x-2 border-b-2 px-4 py-2.5 font-bold transition whitespace-nowrap rounded-t-xl ${
              activeTab === tab.id
                ? 'border-amber-500 text-amber-950 bg-amber-50/80 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* PESTAÑA 1: INFORMACIÓN GENERAL 3D */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Alcance y Observaciones */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card-3d bg-white p-6 shadow-md border border-slate-200 rounded-3xl space-y-3">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Descripción y Alcance Institucional
              </h3>
              <p className="text-sm font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">
                {agreement.description}
              </p>
            </div>

            {agreement.observations && (
              <div className="card-3d bg-white p-6 shadow-md border border-slate-200 rounded-3xl space-y-2">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Observaciones Colegiadas
                </h3>
                <p className="text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {agreement.observations}
                </p>
              </div>
            )}

            {agreement.changeReason && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-1 shadow-xs">
                <h4 className="text-xs font-bold text-amber-900">
                  Motivo de la Última Modificación Formal:
                </h4>
                <p className="text-xs text-amber-950 font-medium italic">
                  "{agreement.changeReason}"
                </p>
              </div>
            )}
          </div>

          {/* Columna Derecha: Metadatos y Origen */}
          <div className="space-y-6">
            {/* Responsable Principal */}
            <div className="card-3d bg-white p-6 shadow-md border border-slate-200 rounded-3xl space-y-3">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-amber-600" />
                <span>Responsable Designado</span>
              </h3>
              <div className="space-y-1">
                <div className="text-sm font-extrabold text-slate-900">
                  {agreement.assignee.fullName}
                </div>
                <div className="text-xs font-mono text-slate-600">{agreement.assignee.email}</div>
                {agreement.assignee.position && (
                  <div className="text-xs text-amber-800 font-bold pt-1">
                    {agreement.assignee.position}
                  </div>
                )}
              </div>
            </div>

            {/* Calendario y Plazos */}
            <div className="card-3d bg-white p-6 shadow-md border border-slate-200 rounded-3xl space-y-3">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-sky-600" />
                <span>Calendario de Cumplimiento</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Fecha de Aprobación:</span>
                  <span className="font-mono text-slate-900 font-bold">
                    {new Date(agreement.approvalDate).toLocaleDateString('es-MX')}
                  </span>
                </div>
                {agreement.startDate && (
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-semibold">Inicio de Ejecución:</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {new Date(agreement.startDate).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Fecha Límite:</span>
                  <span className={`font-mono font-extrabold ${isOverdue ? 'text-rose-600' : 'text-slate-900'}`}>
                    {new Date(agreement.dueDate).toLocaleDateString('es-MX')}
                  </span>
                </div>
                {agreement.completionDate && (
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-semibold">Cumplido el:</span>
                    <span className="font-mono text-emerald-700 font-bold">
                      {new Date(agreement.completionDate).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Vinculación Colegiada */}
            <div className="rounded-3xl border border-teal-200 bg-teal-50/70 p-6 space-y-3 shadow-xs">
              <h3 className="text-xs font-black text-teal-950 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="h-4 w-4 text-teal-700" />
                <span>Vinculación Colegiada</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-teal-700 block text-[11px] font-bold">Reunión Institucional:</span>
                  <Link
                    href={`/meetings/${agreement.meetingId}`}
                    className="text-teal-950 hover:underline font-extrabold inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>{agreement.meeting.folio}</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                  <p className="text-[11px] text-teal-800 font-medium truncate mt-0.5">{agreement.meeting.title}</p>
                </div>

                {agreement.agendaItem && (
                  <div className="pt-2 border-t border-teal-200">
                    <span className="text-teal-700 block text-[11px] font-bold">Punto de Orden del Día:</span>
                    <div className="text-teal-950 font-bold mt-0.5">
                      #{agreement.agendaItem.orderIndex} — {agreement.agendaItem.title}
                    </div>
                  </div>
                )}

                {agreement.minutes && (
                  <div className="pt-2 border-t border-teal-200">
                    <span className="text-teal-700 block text-[11px] font-bold">Acta Aprobada:</span>
                    <div className="text-slate-200 font-mono mt-0.5">
                      {agreement.minutes.minutesNumber}
                      {agreement.minutesVersionNumber ? ` (v${agreement.minutesVersionNumber})` : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: AVANCES Y SEGUIMIENTO */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Línea de Tiempo de Avances Reportados
              </h3>
              <p className="text-xs text-slate-400">
                Historial acumulativo de reportes cualitativos y porcentuales del acuerdo
              </p>
            </div>
            {canProgress && !isTerminal && (
              <button
                onClick={() => setIsProgressModalOpen(true)}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                <span>Reportar Nuevo Avance</span>
              </button>
            )}
          </div>

          {!agreement.progressReports || agreement.progressReports.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
              <TrendingUp className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Aún no se han registrado avances formales para este acuerdo.</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
              {agreement.progressReports.map((pr, index) => {
                const isFirst = index === 0;
                return (
                  <div key={pr.id} className="relative group">
                    <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-amber-400" />
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {pr.newPercent}%
                          </span>
                          <span className="text-xs font-medium text-slate-200">
                            {pr.reportedBy.fullName}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(pr.reportedAt).toLocaleString('es-MX')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {pr.observations || pr.description}
                      </p>

                      {pr.justification && (
                        <div className="rounded-lg bg-rose-950/20 border border-rose-900/30 p-2 text-[11px] text-rose-300">
                          <strong>Justificación por reducción:</strong> {pr.justification}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: COLABORADORES */}
      {activeTab === 'collaborators' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Colaboradores Institucionales Asignados
              </h3>
              <p className="text-xs text-slate-400">
                Servidores y miembros colegiados coadyuvantes en la ejecución del acuerdo
              </p>
            </div>
            {canAssign && (
              <button
                onClick={() => setIsCollabModalOpen(true)}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                <span>Agregar Colaborador</span>
              </button>
            )}
          </div>

          {!agreement.collaborators || agreement.collaborators.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
              <Users className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No hay colaboradores coadyuvantes asignados actualmente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agreement.collaborators.map((collab) => (
                <div
                  key={collab.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-200">
                      {collab.user.fullName}
                    </div>
                    <div className="text-[11px] text-slate-400">{collab.user.email}</div>
                    {collab.user.position && (
                      <div className="text-[11px] text-amber-400/90">{collab.user.position}</div>
                    )}
                    {collab.notes && (
                      <div className="text-[11px] text-slate-400 italic">"{collab.notes}"</div>
                    )}
                  </div>
                  {canAssign && (
                    <button
                      onClick={() => handleRemoveCollaborator(collab.userId)}
                      className="p-1.5 rounded-md bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 hover:text-white transition border border-rose-900/40"
                      title="Remover colaborador"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 4: EVIDENCIAS DOCUMENTALES */}
      {activeTab === 'evidences' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Evidencias Documentales y Entregables
              </h3>
              <p className="text-xs text-slate-400">
                Registro de metadatos de soporte para acreditar el cumplimiento del mandato
              </p>
            </div>
            {canProgress && (
              <button
                onClick={() => setIsEvidenceModalOpen(true)}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                <span>Vincular Evidencia</span>
              </button>
            )}
          </div>

          {!agreement.evidences || agreement.evidences.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
              <Paperclip className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No se han registrado evidencias documentales vinculadas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agreement.evidences.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 text-amber-400" />
                      <span>{ev.title}</span>
                    </div>
                    {ev.description && (
                      <p className="text-[11px] text-slate-400">{ev.description}</p>
                    )}
                    {ev.documentReference && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span>Ref: {ev.documentReference}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-400 shrink-0">
                    <div>Registrado por: {ev.registeredBy.fullName}</div>
                    <div className="font-mono text-slate-500">
                      {new Date(ev.createdAt).toLocaleDateString('es-MX')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 5: HISTORIAL Y TRAZABILIDAD APPEND-ONLY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Trazabilidad Institucional Append-Only</span>
            </h3>
            <p className="text-xs text-slate-400">
              Registro inmutable de auditoría institucional conforme a la normativa de archivo y transparencia
            </p>
          </div>

          {!agreement.history || agreement.history.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
              <History className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Sin eventos de trazabilidad registrados.</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-slate-800 space-y-4">
              {agreement.history.map((h) => (
                <div key={h.id} className="relative group">
                  <div className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-slate-500 group-hover:bg-amber-400 transition" />
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-semibold text-amber-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {h.actionType}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(h.createdAt).toLocaleString('es-MX')}
                      </span>
                    </div>

                    <div className="text-slate-300">
                      Por: <strong className="text-slate-100">{h.changer.fullName}</strong> ({h.changer.email})
                    </div>

                    {(h.previousStatus || h.newStatus) && (
                      <div className="text-[11px] text-slate-400">
                        Estado: <span className="font-mono text-slate-300">{h.previousStatus || 'N/A'}</span> &rarr;{' '}
                        <span className="font-mono text-amber-300 font-semibold">{h.newStatus}</span>
                      </div>
                    )}

                    {(h.previousPercent !== null || h.newPercent !== null) && (
                      <div className="text-[11px] text-slate-400">
                        Avance: <span className="font-mono text-slate-300">{h.previousPercent ?? 0}%</span> &rarr;{' '}
                        <span className="font-mono text-emerald-300 font-semibold">{h.newPercent}%</span>
                      </div>
                    )}

                    {h.changeReason && (
                      <div className="rounded bg-slate-800/80 p-2 text-[11px] text-slate-300 italic border border-slate-700/50">
                        Justificación: "{h.changeReason}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: REPORTAR AVANCE */}
      {isProgressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-400" />
              <span>Registrar Avance de Cumplimiento</span>
            </h3>

            <form onSubmit={handleAddProgress} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Porcentaje de Cumplimiento (%)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={newPercent}
                    onChange={(e) => setNewPercent(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="font-mono font-bold text-amber-400 text-sm w-12 text-right">
                    {newPercent}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Observaciones y Logros Alcanzados <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={progressNotes}
                  onChange={(e) => setProgressNotes(e.target.value)}
                  placeholder="Detalla las actividades ejecutadas, entregables parciales o gestiones realizadas..."
                  required
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2.5 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {newPercent < agreement.progressPercent && (
                <div className="space-y-1 rounded-lg bg-rose-950/30 border border-rose-800/40 p-3">
                  <label className="block text-rose-300 font-semibold">
                    Justificación Obligatoria por Reducción de Avance
                  </label>
                  <textarea
                    rows={2}
                    value={progressJustification}
                    onChange={(e) => setProgressJustification(e.target.value)}
                    placeholder="Explica el motivo técnico o legal por el cual se reduce el porcentaje reportado previamente..."
                    required
                    className="w-full rounded-lg bg-slate-800 border border-rose-700/60 p-2 text-slate-200 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProgressModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 font-semibold text-white shadow-sm"
                >
                  {isSubmittingAction ? 'Guardando...' : 'Registrar Avance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REASIGNAR RESPONSABLE */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-sky-400" />
              <span>Reasignar Responsable Principal</span>
            </h3>

            <form onSubmit={handleAssign} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Nuevo Responsable Institucional <span className="text-amber-400">*</span>
                </label>
                <select
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                  required
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Seleccionar servidor o miembro --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email}){u.position ? ` — ${u.position}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Justificación Formal del Cambio <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="Motivo formal de reasignación (cambio de área, delegación, etc.)..."
                  required
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 font-semibold text-white shadow-sm"
                >
                  {isSubmittingAction ? 'Reasignando...' : 'Confirmar Reasignación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR COLABORADOR */}
      {isCollabModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-400" />
              <span>Agregar Colaborador Institucional</span>
            </h3>

            <form onSubmit={handleAddCollaborator} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Servidor o Miembro Coadyuvante <span className="text-amber-400">*</span>
                </label>
                <select
                  value={newCollabUserId}
                  onChange={(e) => setNewCollabUserId(e.target.value)}
                  required
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Seleccionar colaborador --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email}){u.position ? ` — ${u.position}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Rol o Notas de Apoyo (Opcional)
                </label>
                <input
                  type="text"
                  value={collabNotes}
                  onChange={(e) => setCollabNotes(e.target.value)}
                  placeholder="Ej. Revisión técnica de entregables, enlace jurídico..."
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCollabModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 font-semibold text-white shadow-sm"
                >
                  {isSubmittingAction ? 'Agregando...' : 'Agregar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR EVIDENCIA */}
      {isEvidenceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-amber-400" />
              <span>Vincular Evidencia Documental</span>
            </h3>

            <form onSubmit={handleAddEvidence} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Título de la Evidencia <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  placeholder="Ej. Oficio de entrega-recepción formal dictamen..."
                  required
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Referencia Documental / Folio / Nombre del Archivo <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={evidenceFileName}
                  onChange={(e) => setEvidenceFileName(e.target.value)}
                  placeholder="Ej. Oficio-DG-2026-149.pdf o Folio Archivo #332"
                  required
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Descripción del Entregable (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={evidenceDesc}
                  onChange={(e) => setEvidenceDesc(e.target.value)}
                  placeholder="Anotaciones sobre sellos, folios o validez del documento..."
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEvidenceModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 font-semibold text-white shadow-sm"
                >
                  {isSubmittingAction ? 'Vinculando...' : 'Registrar Evidencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DECLARAR CUMPLIDO */}
      {isCompleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span>Formalizar Cumplimiento Institucional</span>
            </h3>

            <form onSubmit={handleComplete} className="space-y-4 text-xs">
              <p className="text-slate-300">
                Al declarar formalmente cumplido este acuerdo, el avance se fijará automáticamente en el <strong>100%</strong> y se registrará tu firma institucional como autorizante de la conclusión.
              </p>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Anotaciones de Conclusión o Dictamen Final (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  placeholder="Detalles del cumplimiento, entrega a satisfacción o número de oficio conclusivo..."
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-semibold text-white shadow-sm"
                >
                  {isSubmittingAction ? 'Formalizando...' : 'Declarar Cumplido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUSPENDER ACUERDO */}
      {isSuspendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-purple-400" />
              <span>Suspender Temporalmente Acuerdo</span>
            </h3>

            <form onSubmit={handleSuspend} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Justificación Obligatoria de Suspensión <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Fundamenta las causales sobrevenidas o la orden del órgano de gobierno que suspende la ejecución..."
                  required
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSuspendModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 font-semibold text-white shadow-sm"
                >
                  {isSubmittingAction ? 'Suspendiendo...' : 'Confirmar Suspensión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REACTIVAR ACUERDO */}
      {isReactivateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-blue-400" />
              <span>Reactivar Acuerdo Institucional</span>
            </h3>

            <form onSubmit={handleReactivate} className="space-y-4 text-xs">
              <p className="text-slate-300">
                El acuerdo saldrá del estado de suspensión y retornará a su estado activo para dar continuidad al cumplimiento.
              </p>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Motivo o Precisiones de Reactivación (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={reactivateReason}
                  onChange={(e) => setReactivateReason(e.target.value)}
                  placeholder="Superadas las causales que motivaron la suspensión..."
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReactivateModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 font-semibold text-white shadow-sm"
                >
                  {isSubmittingAction ? 'Reactivando...' : 'Reactivar Acuerdo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCELAR ACUERDO */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-400" />
              <span>Cancelar Acuerdo Institucional</span>
            </h3>

            <form onSubmit={handleCancel} className="space-y-4 text-xs">
              <p className="text-rose-300">
                Esta acción es formal y definitiva. El acuerdo pasará al estado terminal CANCELADO con registro indeleble en la bitácora de auditoría.
              </p>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Fundamentación Obligatoria de Cancelación <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Indica la resolución del pleno, revocación formal o motivo institucional que deja sin efectos el acuerdo..."
                  required
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2 font-semibold text-white shadow-sm"
                >
                  {isSubmittingAction ? 'Cancelando...' : 'Confirmar Cancelación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
