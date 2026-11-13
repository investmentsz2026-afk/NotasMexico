'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import {
  AgreementListItem,
  PaginatedResponse,
  AgreementStatus,
  AgreementPriority,
} from '@mexagenda/shared';
import {
  FileCheck2,
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
  CheckCircle2,
  Hourglass,
  PauseCircle,
  XCircle,
  TrendingUp,
  LayoutDashboard,
  FileSpreadsheet,
  UserCheck,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  AgreementStatus,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  PENDIENTE: {
    label: 'Pendiente',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    icon: <Hourglass className="h-3 w-3 text-amber-700" />,
  },
  EN_PROCESO: {
    label: 'En Proceso',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 font-bold',
    icon: <TrendingUp className="h-3 w-3 text-blue-700" />,
  },
  CUMPLIDO: {
    label: 'Cumplido',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
    icon: <CheckCircle2 className="h-3 w-3 text-emerald-700" />,
  },
  COMPLETADO: {
    label: 'Cumplido',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
    icon: <CheckCircle2 className="h-3 w-3 text-emerald-700" />,
  },
  VENCIDO: {
    label: 'Vencido',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-black',
    icon: <AlertTriangle className="h-3 w-3 text-rose-700" />,
  },
  SUSPENDIDO: {
    label: 'Suspendido',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
    icon: <PauseCircle className="h-3 w-3 text-purple-700" />,
  },
  CANCELADO: {
    label: 'Cancelado',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 font-bold',
    icon: <XCircle className="h-3 w-3 text-slate-600" />,
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

export default function AgreementsListPage() {
  const { user } = useAuth();

  const [agreements, setAgreements] = useState<AgreementListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [selectedPriority, setSelectedPriority] = useState<string>('TODAS');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAgreements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (selectedStatus !== 'TODOS') params.set('status', selectedStatus);
      if (selectedPriority !== 'TODAS') params.set('priority', selectedPriority);

      const res = await apiFetch<PaginatedResponse<AgreementListItem>>(
        `/agreements?${params.toString()}`
      );
      setAgreements(res.items || []);
      setTotal(res.meta?.total || 0);
      setTotalPages(res.meta?.totalPages || 1);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Error al conectar con el servidor institucional.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, searchTerm, selectedStatus, selectedPriority]);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAgreements();
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const hasCreatePermission = user?.permissions?.includes('agreement:create') || user?.role === 'ROLE_ADMIN';
  const hasReportPermission = user?.permissions?.includes('agreement:report:read') || user?.role === 'ROLE_ADMIN';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Institucional con Efecto 3D y Contraste Total */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25 ring-4 ring-amber-50">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Acuerdos Institucionales
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Gestión, asignación colegiada, cumplimiento y trazabilidad de acuerdos
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {hasReportPermission && (
            <>
              <Link
                href="/agreements/dashboard"
                className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-sky-600 transition border border-slate-200 shadow-sm"
              >
                <LayoutDashboard className="h-4 w-4 text-sky-500" />
                <span>Tablero</span>
              </Link>
              <Link
                href="/agreements/reports"
                className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-emerald-600 transition border border-slate-200 shadow-sm"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                <span>Reportes</span>
              </Link>
            </>
          )}

          <Link
            href="/agreements/assigned"
            className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-amber-600 transition border border-slate-200 shadow-sm"
          >
            <UserCheck className="h-4 w-4 text-amber-500" />
            <span>Mis Acuerdos</span>
          </Link>

          {hasCreatePermission && (
            <Link
              href="/agreements/new"
              className="btn-3d inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Acuerdo</span>
            </Link>
          )}
        </div>
      </div>

      {/* Barra de Filtros en Tarjeta 3D Blanca y Nítida */}
      <div className="card-3d bg-white p-5 space-y-4">
        {/* Píldoras de Estado Rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-slate-500 font-bold text-xs mr-1 hidden sm:inline">Estado:</span>
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'PENDIENTE', label: 'Pendientes' },
            { id: 'EN_PROCESO', label: 'En Proceso' },
            { id: 'CUMPLIDO', label: 'Cumplidos' },
            { id: 'VENCIDO', label: 'Vencidos' },
            { id: 'SUSPENDIDO', label: 'Suspendidos' },
            { id: 'CANCELADO', label: 'Cancelados' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => handleStatusFilterChange(st.id)}
              className={`rounded-xl px-3.5 py-1.5 transition text-xs font-bold whitespace-nowrap border ${
                selectedStatus === st.id
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-slate-100/80 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Buscador y Prioridad */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 border-t border-slate-100">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por folio, título, descripción o reunión..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition"
            />
          </form>

          <div className="flex items-center gap-2">
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setPage(1);
              }}
              className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:border-amber-500 focus:outline-none transition"
            >
              <option value="TODAS">Prioridad: Todas</option>
              <option value="URGENTE">Urgente</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>

            <button
              onClick={() => fetchAgreements()}
              title="Recargar catálogo"
              className="rounded-xl bg-slate-50 hover:bg-slate-100 p-2 text-slate-600 border border-slate-200 transition"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mensajes de Error */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 flex items-center space-x-3 text-xs md:text-sm shadow-sm">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Contenido Principal: Listado */}
      {isLoading && agreements.length === 0 ? (
        <div className="card-3d flex flex-col items-center justify-center p-16 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mb-4" />
          <p className="text-sm font-semibold text-slate-600">Consultando acuerdos institucionales...</p>
        </div>
      ) : agreements.length === 0 ? (
        <div className="card-3d flex flex-col items-center justify-center p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-8 ring-amber-50/60 mb-4">
            <FileCheck2 className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No se encontraron acuerdos</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
            No hay acuerdos institucionales registrados que coincidan con los criterios seleccionados.
          </p>
          {hasCreatePermission && (
            <Link
              href="/agreements/new"
              className="btn-3d mt-5 inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Acuerdo</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Vista Escritorio: Tabla Elegante 3D */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  <th className="py-3 px-4">Folio / Título</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3">Prioridad</th>
                  <th className="py-3 px-3">Responsable</th>
                  <th className="py-3 px-3">Avance</th>
                  <th className="py-3 px-3">Vencimiento</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {agreements.map((item) => {
                  const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDIENTE;
                  const priorityInfo = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.MEDIA;
                  const isOverdue = item.status === 'VENCIDO';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-amber-700 transition">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span className="font-mono text-amber-700 font-semibold">
                            {item.folio}
                          </span>
                          <span>•</span>
                          <span className="truncate max-w-[200px]" title={item.meetingTitle}>
                            {item.meetingFolio}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${statusInfo.badgeClass}`}
                        >
                          {statusInfo.icon}
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] border ${priorityInfo.badgeClass}`}
                        >
                          {priorityInfo.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="text-slate-900 font-extrabold">
                          {item.assignee.fullName}
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono font-medium">
                          {item.assignee.email}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500 font-bold">Progreso</span>
                            <span className="font-extrabold text-slate-900">{item.progressPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 border border-slate-200 rounded-full h-2 overflow-hidden p-0.5">
                            <div
                              className={`h-full rounded-full ${
                                item.progressPercent === 100
                                  ? 'bg-emerald-500'
                                  : item.progressPercent >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${item.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className={`font-mono text-xs font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-900'}`}>
                          {new Date(item.dueDate).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        {isOverdue && (
                          <div className="text-[10px] text-rose-600 flex items-center gap-1 font-extrabold">
                            <AlertTriangle className="h-3 w-3" />
                            Plazo vencido
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/agreements/${item.id}`}
                          className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition shadow-sm"
                        >
                          <Eye className="h-3.5 w-3.5 text-amber-400" />
                          <span>Expediente</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Móvil: Tarjetas 3D en 2 Columnas < 768px */}
          <div className="grid grid-cols-2 gap-2.5 md:hidden">
            {agreements.map((item) => {
              const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDIENTE;
              const priorityInfo = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.MEDIA;
              const isOverdue = item.status === 'VENCIDO';

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border-2 border-slate-300 border-b-[5px] border-b-slate-700 bg-white p-3 flex flex-col justify-between space-y-2.5 shadow-md"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-mono text-[9px] font-black text-blue-800 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 truncate">
                        {item.folio}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[8px] border shrink-0 ${statusInfo.badgeClass}`}
                      >
                        <span>{statusInfo.label}</span>
                      </span>
                    </div>

                    <h4 className="text-xs font-extrabold text-slate-900 line-clamp-2 leading-snug">
                      {item.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-1 text-[9px]">
                      <span className={`rounded px-1.5 py-0.5 border ${priorityInfo.badgeClass}`}>
                        {priorityInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-slate-500 font-bold">Avance</span>
                        <span className="font-black text-slate-900">{item.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-100 border border-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.progressPercent === 100
                              ? 'bg-emerald-500'
                              : item.progressPercent >= 50
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${item.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 text-[9px] space-y-0.5">
                      <div className="font-bold text-slate-800 truncate">{item.assignee.fullName}</div>
                      <div className={`font-mono font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
                        Vence: {new Date(item.dueDate).toLocaleDateString('es-MX')}
                      </div>
                    </div>

                    <Link
                      href={`/agreements/${item.id}`}
                      className="w-full inline-flex items-center justify-center space-x-1 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 py-1.5 text-[10px] font-black text-white transition border border-sky-200 border-b-2 border-b-blue-950 shadow-xs"
                    >
                      <Eye className="h-3 w-3 text-amber-200 shrink-0" />
                      <span className="truncate">Ver Expediente</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginación 3D */}
          <div className="card-3d flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-600 shadow-md">
            <div>
              Mostrando <strong className="text-slate-900 font-extrabold">{agreements.length}</strong> de{' '}
              <strong className="text-slate-900 font-extrabold">{total}</strong> acuerdos institucionales
            </div>

            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-3d inline-flex items-center space-x-1 rounded-xl bg-slate-100 px-3.5 py-2 font-bold text-slate-800 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition border border-slate-300 shadow-xs"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Anterior</span>
              </button>

              <span className="px-2 font-bold text-slate-700">
                Página <strong className="text-slate-900 font-black">{page}</strong> de{' '}
                <strong className="text-slate-900 font-black">{totalPages || 1}</strong>
              </span>

              <button
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn-3d inline-flex items-center space-x-1 rounded-xl bg-slate-100 px-3.5 py-2 font-bold text-slate-800 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition border border-slate-300 shadow-xs"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
