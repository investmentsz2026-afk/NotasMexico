'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import {
  PersonalNoteListItem,
  PaginatedResponse,
  NoteCategory,
  NoteType,
  NoteVisibility,
} from '@mexagenda/shared';
import {
  BookOpen,
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertTriangle,
  Star,
  Archive,
  RotateCcw,
  Tag,
  ShieldAlert,
  FileCheck2,
  FileText,
  User,
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

function NotesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [notes, setNotes] = useState<PersonalNoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros
  const [activeTab, setActiveTab] = useState<'all' | 'session' | 'favorites' | 'archived'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');

  const meetingIdParam = searchParams.get('meetingId') || '';

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '12');

      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter) params.append('category', categoryFilter);
      if (visibilityFilter) params.append('visibility', visibilityFilter);
      if (meetingIdParam) params.append('meetingId', meetingIdParam);

      if (activeTab === 'session') {
        params.append('noteType', NoteType.SESION);
      } else if (activeTab === 'favorites') {
        params.append('isFavorite', 'true');
      } else if (activeTab === 'archived') {
        params.append('isArchived', 'true');
      }

      const res = await apiFetch<PaginatedResponse<PersonalNoteListItem>>(
        `/notes?${params.toString()}`
      );
      setNotes(res.items);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocurrió un error al cargar las anotaciones.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, categoryFilter, visibilityFilter, activeTab, meetingIdParam]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput.trim());
    setPage(1);
  };

  const handleToggleFavorite = async (note: PersonalNoteListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await apiFetch(`/notes/${note.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: !note.isFavorite }),
      });
      loadNotes();
    } catch {
      // Ignorar fallo puntual
    }
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('¿Confirma que desea archivar esta anotación institucional?')) return;
    try {
      await apiFetch(`/notes/${id}`, { method: 'DELETE' });
      loadNotes();
    } catch (err: any) {
      alert(err.message || 'Error al archivar la anotación');
    }
  };

  const handleRestore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await apiFetch(`/notes/${id}/restore`, { method: 'POST' });
      loadNotes();
    } catch (err: any) {
      alert(err.message || 'Error al restaurar la anotación');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Cabecera Principal 3D */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/25 ring-4 ring-cyan-50">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Anotaciones y Notas de Sesión
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
                Bitácora institucional privada, observaciones colegiadas y notas vinculadas a reuniones y acuerdos
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/notes/new"
            className="btn-3d inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Anotación</span>
          </Link>
        </div>
      </div>

      {/* Pestañas de Navegación Rápida */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-2">
        <button
          onClick={() => { setActiveTab('all'); setPage(1); }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-cyan-500 text-cyan-700 bg-cyan-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Todas mis notas
        </button>
        <button
          onClick={() => { setActiveTab('session'); setPage(1); }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'session'
              ? 'border-amber-500 text-amber-700 bg-amber-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="h-4 w-4 text-amber-500" />
          <span>Notas de Sesión</span>
        </button>
        <button
          onClick={() => { setActiveTab('favorites'); setPage(1); }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'favorites'
              ? 'border-yellow-500 text-yellow-700 bg-yellow-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          <span>Favoritas</span>
        </button>
        <button
          onClick={() => { setActiveTab('archived'); setPage(1); }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'archived'
              ? 'border-rose-500 text-rose-700 bg-rose-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Archive className="h-4 w-4 text-rose-500" />
          <span>Archivadas / Papelera</span>
        </button>
      </div>

      {/* Barra de Filtros y Búsqueda 3D */}
      <div className="card-3d bg-white p-5 shadow-lg border border-slate-200">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por título, contenido o etiquetas..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition"
            />
          </div>

          <div className="flex flex-wrap gap-2 sm:items-center">
            {/* Categoría */}
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:border-cyan-500 focus:outline-none transition"
            >
              <option value="">Todas las categorías</option>
              {Object.keys(CATEGORY_CONFIG).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_CONFIG[cat].label}
                </option>
              ))}
            </select>

            {/* Visibilidad */}
            <select
              value={visibilityFilter}
              onChange={(e) => { setVisibilityFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:border-cyan-500 focus:outline-none transition"
            >
              <option value="">Cualquier visibilidad</option>
              {Object.keys(VISIBILITY_CONFIG).map((vis) => (
                <option key={vis} value={vis}>
                  {VISIBILITY_CONFIG[vis].label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="btn-3d rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Buscar
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchTerm('');
                setCategoryFilter('');
                setVisibilityFilter('');
                setPage(1);
              }}
              title="Limpiar filtros"
              className="rounded-xl bg-slate-50 hover:bg-slate-100 p-2 text-slate-600 border border-slate-200 transition"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Errores */}
      {errorMessage && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-4 text-sm text-rose-200 flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Listado de Anotaciones */}
      {isLoading ? (
        <div className="card-3d flex h-64 items-center justify-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
            <p className="text-xs text-slate-500 font-semibold">Consultando bitácora de anotaciones...</p>
          </div>
        </div>
      ) : notes.length === 0 ? (
        <div className="card-3d bg-white py-16 text-center border border-slate-200 shadow-lg">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-500 ring-8 ring-cyan-50/60 mx-auto mb-4">
            <BookOpen className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No se encontraron anotaciones</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {activeTab === 'archived'
              ? 'La papelera institucional se encuentra vacía.'
              : 'No hay notas registradas que coincidan con los criterios de búsqueda seleccionados.'}
          </p>
          {activeTab !== 'archived' && (
            <div className="mt-6">
              <Link
                href="/notes/new"
                className="btn-3d inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Crear mi primera anotación</span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-3">
          {notes.map((note) => {
            const catBadge = CATEGORY_CONFIG[note.category] || CATEGORY_CONFIG.GENERAL;
            const visBadge = VISIBILITY_CONFIG[note.visibility] || VISIBILITY_CONFIG.PRIVADA;

            return (
              <div
                key={note.id}
                className="card-3d group relative flex flex-col justify-between bg-white p-3 sm:p-6 border-2 border-slate-300 border-b-[5px] sm:border-b-[7px] border-b-slate-600 rounded-2xl sm:rounded-3xl shadow-md hover:shadow-xl hover:border-blue-500 hover:border-b-blue-800 transition-all duration-200"
              >
                <div>
                  {/* Encabezado de la Tarjeta */}
                  <div className="flex items-start justify-between gap-1 mb-2 sm:mb-3">
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className={`inline-flex items-center rounded-md sm:rounded-lg border px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[11px] font-extrabold shadow-xs ${catBadge.badgeClass}`}>
                        {catBadge.label}
                      </span>
                      <span className={`inline-flex items-center rounded-md sm:rounded-lg border px-1.5 py-0.5 sm:px-2 text-[8px] sm:text-[10px] font-bold shadow-xs ${visBadge.badgeClass}`}>
                        {visBadge.label}
                      </span>
                      {note.noteType === 'SESION' && (
                        <span className="inline-flex items-center rounded-md sm:rounded-lg bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 sm:px-2 text-[8px] sm:text-[10px] font-black shadow-xs">
                          Sesión
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleToggleFavorite(note, e)}
                      title={note.isFavorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
                      className="text-slate-400 hover:text-amber-500 transition p-0.5 sm:p-1 shrink-0"
                    >
                      <Star className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${note.isFavorite ? 'text-amber-500 fill-amber-500' : ''}`} />
                    </button>
                  </div>

                  {/* Alerta de Intervención Administrativa */}
                  {note.isAdminModified && (
                    <div className="mb-2 sm:mb-3 flex items-center space-x-1 rounded-lg sm:rounded-xl bg-amber-50 border border-amber-300 px-2 py-1 text-[9px] sm:text-[11px] font-bold text-amber-900 shadow-xs">
                      <ShieldAlert className="h-3 w-3 sm:h-4 sm:w-4 text-amber-700 shrink-0" />
                      <span className="truncate">Intervenida por Admin</span>
                    </div>
                  )}

                  {/* Título */}
                  <Link
                    href={`/notes/${note.id}`}
                    className="block group-hover:text-blue-700 transition"
                  >
                    <h3 className="text-xs sm:text-base font-extrabold text-slate-900 line-clamp-2 leading-snug">
                      {note.title}
                    </h3>
                  </Link>

                  {/* Contenido preview si existe */}
                  {note.content && (
                    <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-slate-600 line-clamp-2 sm:line-clamp-3 leading-relaxed">
                      {note.content}
                    </p>
                  )}

                  {/* Vinculaciones institucionales */}
                  {(note.meetingTitle || note.agreementFolio || note.agendaItemTitle) && (
                    <div className="mt-2 sm:mt-3.5 space-y-1 text-[10px] sm:text-xs text-slate-600 border-t border-slate-200 pt-2 sm:pt-3">
                      {note.meetingTitle && (
                        <div className="flex items-center space-x-1 text-blue-900 font-bold truncate">
                          <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{note.meetingTitle}</span>
                        </div>
                      )}
                      {note.agreementFolio && (
                        <div className="flex items-center space-x-1 text-emerald-900 font-bold truncate">
                          <FileCheck2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{note.agreementFolio}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Pie de la tarjeta */}
                <div className="mt-3 sm:mt-5 pt-2 sm:pt-3.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 text-[9px] sm:text-[11px] text-slate-500 font-semibold">
                  <span className="font-extrabold text-slate-800 truncate max-w-full sm:max-w-[150px]">
                    {note.authorName}
                  </span>
                  <span>{new Date(note.createdAt).toLocaleDateString('es-MX')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginador */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-400">
            Mostrando página <span className="font-semibold text-slate-200">{page}</span> de{' '}
            <span className="font-semibold text-slate-200">{totalPages}</span> ({total} resultados)
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center space-x-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 disabled:opacity-50 hover:bg-slate-700"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Anterior</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center space-x-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 disabled:opacity-50 hover:bg-slate-700"
            >
              <span>Siguiente</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        </div>
      }
    >
      <NotesContent />
    </Suspense>
  );
}

