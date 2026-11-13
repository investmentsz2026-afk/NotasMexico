'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import {
  MeetingListItem,
  MeetingCategoryDto,
  PaginatedResponse,
  MeetingStatus,
  MeetingModality,
} from '@mexagenda/shared';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  PlayCircle,
  FolderKanban,
  CheckCircle,
  XCircle,
  AlertCircle,
  CalendarDays,
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

const MODALITY_CONFIG: Record<
  MeetingModality,
  { label: string; icon: React.ReactNode }
> = {
  PRESENCIAL: { label: 'Presencial', icon: <MapPin className="h-3 w-3" /> },
  VIRTUAL: { label: 'Virtual', icon: <Video className="h-3 w-3" /> },
  HIBRIDA: { label: 'Híbrida', icon: <Video className="h-3 w-3" /> },
};

export default function MeetingsListPage() {
  const { user } = useAuth();

  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [categories, setCategories] = useState<MeetingCategoryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [modality, setModality] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Paginación
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const fetchCategories = async () => {
    try {
      const data = await apiFetch<MeetingCategoryDto[]>('/meeting-categories');
      setCategories(data);
    } catch {
      // Ignorar fallback
    }
  };

  const fetchMeetings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(page));
      queryParams.set('limit', String(limit));
      if (search.trim()) queryParams.set('search', search.trim());
      if (categoryId) queryParams.set('categoryId', categoryId);
      if (status) queryParams.set('status', status);
      if (modality) queryParams.set('modality', modality);
      if (startDate) queryParams.set('startDate', startDate);
      if (endDate) queryParams.set('endDate', endDate);

      const res = await apiFetch<PaginatedResponse<MeetingListItem>>(
        `/meetings?${queryParams.toString()}`,
      );
      setMeetings(res.items);
      setMeta({
        total: res.meta.total,
        totalPages: res.meta.totalPages,
        hasNextPage: res.meta.hasNextPage,
        hasPreviousPage: res.meta.hasPreviousPage,
      });
    } catch (err: any) {
      setError(err.message || 'Error al obtener la lista de reuniones institucionales.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, categoryId, status, modality, startDate, endDate]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleResetFilters = () => {
    setSearch('');
    setCategoryId('');
    setStatus('');
    setModality('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Encabezado Institucional */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-4">
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-3 shadow-lg shadow-amber-500/25 text-white ring-4 ring-amber-50">
            <Calendar className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Gestión Institucional de Reuniones
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
              MOD-02: Planificación, convocatorias, actas colegiadas y listas de asistencia.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/meetings/calendar"
            className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <span>Vista Calendario</span>
          </Link>

          {user?.role === 'ROLE_ADMIN' && (
            <Link
              href="/meeting-categories"
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <FolderKanban className="h-4 w-4 text-slate-500" />
              <span>Categorías</span>
            </Link>
          )}

          <Link
            href="/meetings/new"
            className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow-md shadow-amber-500/25"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Sesión</span>
          </Link>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="card-3d rounded-2xl border border-slate-200/80 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <Filter className="h-4 w-4 text-amber-600" />
            <span>Filtros de Búsqueda Institucional</span>
          </div>
          <button
            onClick={handleResetFilters}
            className="btn-3d rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            Limpiar Filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          {/* Búsqueda por texto o folio */}
          <div className="lg:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">
              Buscar (Título o Folio)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Ej: Ordinaria o ORD-2026-001"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Categoría
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Estado
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="">Todos</option>
              {Object.keys(STATUS_CONFIG).map((st) => (
                <option key={st} value={st}>
                  {STATUS_CONFIG[st as MeetingStatus].label}
                </option>
              ))}
            </select>
          </div>

          {/* Modalidad */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Modalidad
            </label>
            <select
              value={modality}
              onChange={(e) => {
                setModality(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="">Todas</option>
              <option value="PRESENCIAL">Presencial</option>
              <option value="VIRTUAL">Virtual</option>
              <option value="HIBRIDA">Híbrida</option>
            </select>
          </div>

          {/* Rango de Fechas */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="flex items-center space-x-2 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Listado de Reuniones (Desktop: Tabla, Móvil: Tarjetas) */}
      <div className="card-3d rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">
            Reuniones Registradas ({meta.total})
          </span>
          <button
            onClick={fetchMeetings}
            className="btn-3d inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 shadow-sm"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
            <span>Cargando reuniones institucionales...</span>
          </div>
        ) : meetings.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-inner">
              <Calendar className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              No se encontraron reuniones institucionales
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No hay sesiones colegiadas registradas que coincidan con los filtros seleccionados.
            </p>
            <Link
              href="/meetings/new"
              className="btn-3d inline-flex items-center space-x-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow-md shadow-amber-500/20"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Programar Primera Reunión</span>
            </Link>
          </div>
        ) : (
          <>
            {/* Vista Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-institutional-border text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-6 py-3">Folio Institucional</th>
                    <th className="px-6 py-3">Título / Asunto</th>
                    <th className="px-6 py-3">Categoría</th>
                    <th className="px-6 py-3">Fecha y Horario</th>
                    <th className="px-6 py-3">Modalidad</th>
                    <th className="px-6 py-3 text-center">Estado</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-institutional-border font-medium text-slate-600">
                  {meetings.map((m) => {
                    const st = STATUS_CONFIG[m.status] || STATUS_CONFIG.PROGRAMADA;
                    const mod = MODALITY_CONFIG[m.modality] || MODALITY_CONFIG.PRESENCIAL;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <Link
                            href={`/meetings/${m.id}`}
                            className="hover:text-amber-700 transition"
                          >
                            {m.folio}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs sm:max-w-md">
                            <Link
                              href={`/meetings/${m.id}`}
                              className="font-bold text-slate-900 hover:text-amber-700 transition line-clamp-1"
                            >
                              {m.title}
                            </Link>
                            <span className="text-[11px] text-slate-400">
                              {m.participantsCount} participante(s) convocados
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className="inline-flex items-center space-x-1.5 rounded px-2 py-0.5 text-[11px] font-semibold text-white shadow-xs"
                            style={{ backgroundColor: m.category.colorHex }}
                          >
                            <span>{m.category.name}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col text-[11px]">
                            <span className="font-semibold text-slate-800">
                              {m.meetingDate}
                            </span>
                            <span className="text-slate-500 font-mono">
                              {m.startTime} — {m.endTime}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1 text-slate-700">
                            {mod.icon}
                            <span className="text-[11px]">{mod.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${st.bg} ${st.text} ${st.border}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                          <Link
                            href={`/meetings/${m.id}`}
                            className="inline-flex items-center space-x-1 text-slate-600 hover:text-slate-900 font-semibold p-1"
                            title="Ver Detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {m.status === 'EN_DESARROLLO' && (
                            <Link
                              href={`/meetings/${m.id}`}
                              className="inline-flex items-center space-x-1 text-emerald-600 hover:text-emerald-800 font-semibold p-1"
                              title="Sesión en Vivo"
                            >
                              <PlayCircle className="h-4 w-4" />
                            </Link>
                          )}
                          {m.status === 'FINALIZADA' && (
                            <Link
                              href={`/meetings/${m.id}`}
                              className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-semibold p-1"
                              title="Acta Institucional"
                            >
                              <FileText className="h-4 w-4" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista Móvil: Cuadrícula de 2 Columnas de Tarjetas 3D Compactas */}
            <div className="grid grid-cols-2 gap-2.5 p-2.5 md:hidden bg-sky-50/40">
              {meetings.map((m) => {
                const st = STATUS_CONFIG[m.status] || STATUS_CONFIG.PROGRAMADA;
                const mod = MODALITY_CONFIG[m.modality] || MODALITY_CONFIG.PRESENCIAL;
                return (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="rounded-2xl bg-white border-2 border-slate-300 border-b-[5px] border-b-blue-700 p-3 flex flex-col justify-between space-y-2 shadow-sm hover:border-blue-500 transition"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-mono text-[9px] font-black text-slate-800 bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 truncate">
                          {m.folio}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-black border ${st.bg} ${st.text} ${st.border}`}
                        >
                          {st.label}
                        </span>
                      </div>

                      <h4 className="text-xs font-black text-slate-900 line-clamp-2 leading-snug">
                        {m.title}
                      </h4>

                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[8px] font-black text-white truncate max-w-full"
                        style={{ backgroundColor: m.category.colorHex }}
                      >
                        {m.category.name}
                      </span>
                    </div>

                    <div className="space-y-1 pt-1.5 border-t border-slate-100 text-[10px] font-bold text-slate-600">
                      <div className="flex items-center space-x-1 text-blue-700 truncate">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="truncate">{m.meetingDate}</span>
                      </div>
                      <div className="flex items-center space-x-1 font-mono text-[9px] text-slate-600 truncate">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {m.startTime} - {m.endTime}
                        </span>
                      </div>
                      <div className="pt-1 flex items-center justify-between text-[10px]">
                        <span className="inline-flex items-center space-x-0.5 text-slate-500 truncate">
                          {mod.icon}
                          <span className="truncate">{mod.label}</span>
                        </span>
                        <span className="inline-flex items-center font-black text-blue-700">
                          <span>Ver</span>
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Paginación */}
            <div className="px-6 py-3 border-t border-institutional-border bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <span>
                Página {page} de {meta.totalPages || 1} ({meta.total} registros en total)
              </span>

              <div className="flex items-center space-x-2">
                <button
                  disabled={!meta.hasPreviousPage}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center space-x-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Anterior</span>
                </button>
                <button
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center space-x-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
