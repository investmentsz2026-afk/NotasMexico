'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import {
  PersonalNoteDetailDto,
  PersonalNoteVersionDto,
  NoteCategory,
  NoteType,
  NoteVisibility,
} from '@mexagenda/shared';
import {
  BookOpen,
  ArrowLeft,
  Calendar,
  Clock,
  Edit3,
  Archive,
  RotateCcw,
  Star,
  Tag,
  ShieldAlert,
  ShieldCheck,
  History,
  FileCheck2,
  FileText,
  User,
  AlertTriangle,
  Save,
  X,
  Lock,
  Globe,
  Users,
} from 'lucide-react';

const CATEGORY_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  GENERAL: { label: 'General', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' },
  JURIDICO: { label: 'Jurídico', badgeClass: 'bg-purple-100 text-purple-900 border-purple-300' },
  TECNICO: { label: 'Técnico', badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
  PRESUPUESTAL: { label: 'Presupuestal', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  ACUERDO: { label: 'Acuerdo', badgeClass: 'bg-blue-100 text-blue-900 border-blue-300' },
  SESION: { label: 'Sesión', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300' },
  SEGUIMIENTO: { label: 'Seguimiento', badgeClass: 'bg-rose-100 text-rose-900 border-rose-300' },
};

const VISIBILITY_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  PRIVADA: { label: 'Privada', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' },
  REUNION: { label: 'Reunión', badgeClass: 'bg-blue-100 text-blue-900 border-blue-300' },
  PUBLICA: { label: 'Pública', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
};

export default function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const noteId = unwrappedParams.id;

  const router = useRouter();
  const { user } = useAuth();

  const [note, setNote] = useState<PersonalNoteDetailDto | null>(null);
  const [versions, setVersions] = useState<PersonalNoteVersionDto[]>([]);
  const [activeTab, setActiveTab] = useState<'content' | 'versions'>('content');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados de Modales
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<NoteCategory>(NoteCategory.GENERAL);
  const [editVisibility, setEditVisibility] = useState<NoteVisibility>(NoteVisibility.PRIVADA);
  const [editChangeReason, setEditChangeReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal de Intervención Administrativa
  const [isInterveneModalOpen, setIsInterveneModalOpen] = useState(false);
  const [interveneTitle, setInterveneTitle] = useState('');
  const [interveneContent, setInterveneContent] = useState('');
  const [interveneCategory, setInterveneCategory] = useState<NoteCategory>(NoteCategory.GENERAL);
  const [interveneVisibility, setInterveneVisibility] = useState<NoteVisibility>(NoteVisibility.PRIVADA);
  const [interveneJustification, setInterveneJustification] = useState('');
  const [isIntervening, setIsIntervening] = useState(false);

  const loadNoteData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiFetch<PersonalNoteDetailDto>(`/notes/${noteId}`);
      setNote(data);
      setEditTitle(data.title);
      setEditContent(data.content);
      setEditCategory(data.category as NoteCategory);
      setEditVisibility(data.visibility as NoteVisibility);

      setInterveneTitle(data.title);
      setInterveneContent(data.content);
      setInterveneCategory(data.category as NoteCategory);
      setInterveneVisibility(data.visibility as NoteVisibility);

      if (data.versions) {
        setVersions(data.versions);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocurrió un error al cargar la anotación.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    loadNoteData();
  }, [loadNoteData]);

  const loadVersions = async () => {
    try {
      const v = await apiFetch<PersonalNoteVersionDto[]>(`/notes/${noteId}/versions`);
      setVersions(v);
    } catch {
      // Manejo silencioso si ya vienen en el detalle
    }
  };

  const handleToggleFavorite = async () => {
    if (!note) return;
    try {
      await apiFetch(`/notes/${note.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: !note.isFavorite }),
      });
      loadNoteData();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar favorito');
    }
  };

  const handleArchive = async () => {
    if (!note) return;
    if (!confirm('¿Confirma que desea archivar esta anotación institucional?')) return;
    try {
      await apiFetch(`/notes/${note.id}`, { method: 'DELETE' });
      router.push('/notes');
    } catch (err: any) {
      alert(err.message || 'Error al archivar la anotación');
    }
  };

  const handleRestore = async () => {
    if (!note) return;
    try {
      await apiFetch(`/notes/${note.id}/restore`, { method: 'POST' });
      loadNoteData();
    } catch (err: any) {
      alert(err.message || 'Error al restaurar');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      alert('El título es obligatorio.');
      return;
    }
    setIsUpdating(true);
    try {
      await apiFetch(`/notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          category: editCategory,
          visibility: editVisibility,
          changeReason: editChangeReason.trim() || undefined,
        }),
      });
      setIsEditModalOpen(false);
      setEditChangeReason('');
      loadNoteData();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar anotación');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInterveneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interveneJustification || interveneJustification.trim().length < 15) {
      alert('La justificación administrativa debe tener al menos 15 caracteres explicativos.');
      return;
    }
    setIsIntervening(true);
    try {
      await apiFetch(`/notes/${noteId}/intervene`, {
        method: 'POST',
        body: JSON.stringify({
          title: interveneTitle.trim(),
          content: interveneContent.trim(),
          category: interveneCategory,
          visibility: interveneVisibility,
          adminJustification: interveneJustification.trim(),
        }),
      });
      setIsInterveneModalOpen(false);
      setInterveneJustification('');
      loadNoteData();
    } catch (err: any) {
      alert(err.message || 'Error al ejecutar intervención administrativa');
    } finally {
      setIsIntervening(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-xs text-slate-400 font-medium">Cargando expediente de la anotación...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !note) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-rose-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-200">No se pudo acceder a la anotación</h2>
        <p className="mt-1 text-sm text-slate-400">{errorMessage || 'La anotación no existe o no tiene permisos de acceso.'}</p>
        <div className="mt-6">
          <Link
            href="/notes"
            className="inline-flex items-center space-x-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Catálogo</span>
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === note.authorId;
  const canIntervene = (user?.role === 'ROLE_ADMIN' || user?.permissions?.includes('note:override_any')) && !isOwner;
  const catBadge = CATEGORY_CONFIG[note.category] || CATEGORY_CONFIG.GENERAL;
  const visBadge = VISIBILITY_CONFIG[note.visibility] || VISIBILITY_CONFIG.PRIVADA;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Botón Volver y Acciones Superiores */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/notes"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-cyan-700 hover:text-cyan-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>← Volver al Catálogo de Anotaciones</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Favorita */}
          <button
            onClick={handleToggleFavorite}
            className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-xs"
          >
            <Star className={`h-4 w-4 ${note.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
            <span>{note.isFavorite ? 'Favorita' : 'Marcar Favorita'}</span>
          </button>

          {/* Botón Editar (Solo Autor) */}
          {isOwner && !note.deletedAt && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white hover:from-cyan-500 hover:to-blue-500 transition shadow-md shadow-cyan-500/20"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Editar Anotación</span>
            </button>
          )}

          {/* Botón Intervención Administrativa (Admin no autor) */}
          {canIntervene && !note.deletedAt && (
            <button
              onClick={() => setIsInterveneModalOpen(true)}
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 px-4 py-2 text-xs font-bold text-white hover:from-purple-600 hover:to-indigo-600 transition shadow-md shadow-purple-500/20"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Intervención Administrativa</span>
            </button>
          )}

          {/* Botón Archivar / Restaurar */}
          {note.deletedAt ? (
            <button
              onClick={handleRestore}
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition shadow-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restaurar de la Papelera</span>
            </button>
          ) : (
            isOwner && (
              <button
                onClick={handleArchive}
                className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-xs"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Archivar</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Banner de Estado Archivado */}
      {note.deletedAt && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <Archive className="h-4 w-4 text-rose-600" />
            <span>Esta anotación se encuentra en la papelera institucional (archivada el {new Date(note.deletedAt).toLocaleString('es-MX')}).</span>
          </div>
          <button
            onClick={handleRestore}
            className="text-xs font-bold text-rose-700 underline hover:text-rose-900"
          >
            Restaurar ahora
          </button>
        </div>
      )}

      {/* Banner de Intervención Administrativa Extraordinaria */}
      {note.isAdminModified && (
        <div className="rounded-2xl border border-purple-300 bg-purple-50 p-5 text-xs text-purple-900 space-y-1.5 shadow-sm">
          <div className="flex items-center space-x-2 font-black text-purple-950 text-sm">
            <ShieldAlert className="h-5 w-5 text-purple-700" />
            <span>Nota Sujeta a Intervención Administrativa Extraordinaria</span>
          </div>
          <p className="font-semibold text-purple-800">
            Intervenida por: <span className="font-extrabold text-purple-950">{note.lastAdminIntervenor?.fullName || 'Administrador Institucional'}</span>
          </p>
          {note.adminJustification && (
            <p className="bg-white border border-purple-200 p-3 rounded-xl text-purple-950 font-mono text-xs mt-2 shadow-xs">
              <span className="font-bold text-purple-900 font-sans block mb-1">Fundamento legal / Justificación institucional:</span>
              {note.adminJustification}
            </p>
          )}
        </div>
      )}

      {/* Tarjeta Principal del Expediente 3D */}
      <div className="card-3d bg-white p-6 sm:p-8 shadow-xl border border-slate-200 rounded-3xl space-y-6">
        {/* Metadatos y Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-xs font-extrabold shadow-xs ${catBadge.badgeClass}`}>
              {catBadge.label}
            </span>
            <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold shadow-xs ${visBadge.badgeClass}`}>
              {visBadge.label}
            </span>
            <span className="inline-flex items-center rounded-lg bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1 text-xs font-bold shadow-xs">
              Tipo: {note.noteType}
            </span>
            <span className="inline-flex items-center rounded-lg bg-cyan-100 text-cyan-900 border border-cyan-300 px-2.5 py-1 text-xs font-mono font-black shadow-xs">
              Versión {note.version}
            </span>
          </div>

          <div className="text-xs font-semibold text-slate-500 flex items-center space-x-3">
            <span>Creada: {new Date(note.createdAt).toLocaleDateString('es-MX')}</span>
            <span>•</span>
            <span>Última modificación: {new Date(note.updatedAt).toLocaleDateString('es-MX')}</span>
          </div>
        </div>

        {/* Título de la Anotación */}
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {note.title}
          </h1>
          <div className="mt-2.5 flex items-center space-x-2 text-xs font-semibold text-slate-500">
            <User className="h-4 w-4 text-slate-400" />
            <span>Autor institucional: <strong className="text-slate-900 font-extrabold">{note.author.fullName}</strong> ({note.author.position || 'Servidor Público'})</span>
            <span>•</span>
            <span className="font-mono text-slate-700">{note.author.email}</span>
          </div>
        </div>

        {/* Vinculaciones Institucionales */}
        {(note.meeting || note.agreement || note.agendaItem) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 space-y-2.5 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-950">
              Contexto Institucional Vinculado
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
              {note.meeting && (
                <div className="flex items-center space-x-2 text-slate-800 font-bold">
                  <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    Sesión:{' '}
                    <Link href={`/meetings/${note.meeting.id}`} className="text-amber-800 underline hover:text-amber-950 font-black">
                      [{note.meeting.folio}] {note.meeting.title}
                    </Link>
                  </span>
                </div>
              )}
              {note.agreement && (
                <div className="flex items-center space-x-2 text-slate-800 font-bold">
                  <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Acuerdo:{' '}
                    <Link href={`/agreements/${note.agreement.id}`} className="text-emerald-800 underline hover:text-emerald-950 font-black">
                      [{note.agreement.folio}] {note.agreement.title}
                    </Link>
                  </span>
                </div>
              )}
              {note.agendaItem && (
                <div className="flex items-center space-x-2 text-slate-800 sm:col-span-2 font-medium">
                  <Clock className="h-4 w-4 text-cyan-600 shrink-0" />
                  <span>
                    Punto del Orden del Día: <strong className="text-slate-900 font-extrabold">#{note.agendaItem.orderIndex} — {note.agendaItem.title}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pestañas de Vista: Contenido vs Historial */}
        <div className="flex border-b border-slate-200 space-x-6">
          <button
            onClick={() => setActiveTab('content')}
            className={`pb-3.5 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'content'
                ? 'border-cyan-600 text-cyan-800'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Cuerpo de la Anotación</span>
          </button>
          <button
            onClick={() => { setActiveTab('versions'); loadVersions(); }}
            className={`pb-3.5 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'versions'
                ? 'border-cyan-600 text-cyan-800'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Historial de Versiones ({versions.length})</span>
          </button>
        </div>

        {/* Tab 1: Contenido */}
        {activeTab === 'content' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-900 font-sans whitespace-pre-wrap leading-relaxed shadow-xs">
              {note.content}
            </div>

            {/* Etiquetas */}
            {note.tags && (
              <div className="flex items-center space-x-2 pt-2">
                <Tag className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-600 font-bold">Etiquetas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {note.tags.split(',').map((t, idx) => (
                    <span key={idx} className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 border border-slate-200 shadow-xs">
                      {t.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Historial Inmutable de Versiones */}
        {activeTab === 'versions' && (
          <div className="space-y-4">
            {versions.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                Esta anotación se encuentra en su versión inicial. No se registran modificaciones previas.
              </div>
            ) : (
              <div className="space-y-4">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className={`rounded-lg border p-4 transition ${
                      ver.isAdminIntervention
                        ? 'border-purple-800/60 bg-purple-950/20'
                        : 'border-slate-800 bg-slate-800/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-3 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                          Versión {ver.versionNumber}
                        </span>
                        {ver.isAdminIntervention && (
                          <span className="rounded bg-purple-900/80 px-2 py-0.5 text-purple-200 font-semibold border border-purple-700">
                            Intervención Administrativa
                          </span>
                        )}
                        <span className="text-slate-400">
                          Por: <strong className="text-slate-200">{ver.modifiedByName || ver.editorName}</strong>
                        </span>
                      </div>
                      <span className="text-slate-500 font-mono">
                        {new Date(ver.createdAt).toLocaleString('es-MX')}
                      </span>
                    </div>

                    {ver.changeReason && (
                      <p className="text-xs text-slate-300 italic mb-2">
                        Motivo: &quot;{ver.changeReason}&quot;
                      </p>
                    )}

                    {ver.adminJustification && (
                      <div className="mb-3 rounded bg-purple-950/40 border border-purple-800/40 p-2 text-xs text-purple-200 font-mono">
                        <strong>Justificación Administrativa:</strong> {ver.adminJustification}
                      </div>
                    )}

                    {ver.titleSnapshot && ver.titleSnapshot !== note.title && (
                      <p className="text-xs text-slate-400 mb-1">
                        Título en esta versión: <strong className="text-slate-200">{ver.titleSnapshot}</strong>
                      </p>
                    )}

                    <div className="rounded border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                      {ver.contentSnapshot}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Edición Ordinaria del Autor */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Edit3 className="h-5 w-5 text-cyan-400" />
                <span>Modificar Anotación Propia</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as NoteCategory)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value={NoteCategory.GENERAL}>General</option>
                    <option value={NoteCategory.JURIDICO}>Jurídico</option>
                    <option value={NoteCategory.TECNICO}>Técnico</option>
                    <option value={NoteCategory.PRESUPUESTAL}>Presupuestal</option>
                    <option value={NoteCategory.ACUERDO}>Acuerdo</option>
                    <option value={NoteCategory.SESION}>Sesión</option>
                    <option value={NoteCategory.SEGUIMIENTO}>Seguimiento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Visibilidad</label>
                  <select
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value as NoteVisibility)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value={NoteVisibility.PRIVADA}>Privada</option>
                    <option value={NoteVisibility.REUNION}>Reunión</option>
                    <option value={NoteVisibility.PUBLICA}>Pública</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contenido</label>
                <textarea
                  rows={8}
                  required
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motivo o síntesis del cambio (opcional)
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={editChangeReason}
                  onChange={(e) => setEditChangeReason(e.target.value)}
                  placeholder="Ej. Actualización de cifras conforme a la última deliberación"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {isUpdating ? 'Guardando...' : 'Guardar y Generar Versión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Intervención Administrativa Extraordinaria */}
      {isInterveneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-purple-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-purple-800/60 pb-3 mb-4">
              <h3 className="text-lg font-bold text-purple-200 flex items-center space-x-2">
                <ShieldAlert className="h-5 w-5 text-purple-400" />
                <span>Intervención Administrativa Extraordinaria</span>
              </h3>
              <button onClick={() => setIsInterveneModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-purple-700/60 bg-purple-950/40 p-3 text-xs text-purple-200">
              <p className="font-semibold text-purple-300 mb-1">Aviso Institucional de Seguridad y Transparencia:</p>
              Esta acción modificará la anotación institucional de otro usuario. Se generará un snapshot inmutable de la versión previa, la nota quedará identificada con la marca permanente de intervención y se emitirá una bitácora forense de nivel CRITICAL.
            </div>

            <form onSubmit={handleInterveneSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-rose-300 mb-1">
                  Justificación Administrativa Obligatoria (mínimo 15 caracteres) <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={interveneJustification}
                  onChange={(e) => setInterveneJustification(e.target.value)}
                  placeholder="Fundamente con precisión la causa institucional que motiva esta intervención administrativa..."
                  className="w-full rounded-lg border border-purple-700 bg-slate-800 p-2.5 text-xs text-slate-100 placeholder-purple-300/40 focus:border-purple-400 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Caracteres actuales: {interveneJustification.length} / 15 mínimo
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Título corregido</label>
                <input
                  type="text"
                  required
                  value={interveneTitle}
                  onChange={(e) => setInterveneTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contenido corregido</label>
                <textarea
                  rows={6}
                  required
                  value={interveneContent}
                  onChange={(e) => setInterveneContent(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-100 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInterveneModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isIntervening || interveneJustification.trim().length < 15}
                  className="rounded-lg bg-purple-700 px-5 py-2 text-xs font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
                >
                  {isIntervening ? 'Certificando intervención...' : 'Ejecutar Intervención Extraordinaria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

