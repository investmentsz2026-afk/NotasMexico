'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import {
  AgreementListItem,
  PaginatedResponse,
  AgreementStatus,
  AgreementPriority,
} from '@mexagenda/shared';
import {
  UserCheck,
  Calendar,
  Clock,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  TrendingUp,
  PauseCircle,
  XCircle,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  AgreementStatus,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  PENDIENTE: {
    label: 'Pendiente',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: <Hourglass className="h-3 w-3" />,
  },
  EN_PROCESO: {
    label: 'En Proceso',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    icon: <TrendingUp className="h-3 w-3" />,
  },
  CUMPLIDO: {
    label: 'Cumplido',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  COMPLETADO: {
    label: 'Cumplido',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  VENCIDO: {
    label: 'Vencido',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  SUSPENDIDO: {
    label: 'Suspendido',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    icon: <PauseCircle className="h-3 w-3" />,
  },
  CANCELADO: {
    label: 'Cancelado',
    badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    icon: <XCircle className="h-3 w-3" />,
  },
};

const PRIORITY_CONFIG: Record<
  AgreementPriority,
  { label: string; badgeClass: string }
> = {
  URGENTE: { label: 'Urgente', badgeClass: 'bg-red-950/80 text-red-200 border-red-700/60 font-semibold' },
  ALTA: { label: 'Alta', badgeClass: 'bg-orange-950/80 text-orange-200 border-orange-700/60' },
  MEDIA: { label: 'Media', badgeClass: 'bg-sky-950/80 text-sky-200 border-sky-700/60' },
  BAJA: { label: 'Baja', badgeClass: 'bg-slate-800 text-slate-300 border-slate-700' },
};

export default function AssignedAgreementsPage() {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState<AgreementListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');

  const fetchAssigned = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (selectedStatus !== 'TODOS') params.set('status', selectedStatus);

      const res = await apiFetch<PaginatedResponse<AgreementListItem>>(
        `/agreements/assigned?${params.toString()}`
      );
      setAgreements(res.items || []);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Error al consultar acuerdos asignados.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    fetchAssigned();
  }, [fetchAssigned]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <Link
            href="/agreements"
            className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 transition border border-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-amber-400" />
              <span>Mis Acuerdos Asignados</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Acuerdos institucionales bajo tu responsabilidad directa o coadyuvancia colegiada
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchAssigned()}
          className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-medium text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Píldoras de Filtro */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {['TODOS', 'PENDIENTE', 'EN_PROCESO', 'CUMPLIDO', 'VENCIDO'].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`rounded-lg px-3 py-1.5 transition text-xs font-medium border ${
              selectedStatus === st
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {st === 'TODOS' ? 'Todos Mis Acuerdos' : st}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-4 text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
          <p className="text-xs text-slate-400">Cargando tus acuerdos institucionales...</p>
        </div>
      ) : agreements.length === 0 ? (
        <div className="p-16 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/20">
          <UserCheck className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">Sin acuerdos asignados</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Actualmente no tienes acuerdos pendientes de cumplimiento o con el filtro seleccionado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agreements.map((item) => {
            const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDIENTE;
            const priorityInfo = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.MEDIA;
            const isOverdue = item.status === 'VENCIDO';

            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-3 shadow-md hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {item.folio}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-100 mt-1 line-clamp-2">
                      {item.title}
                    </h3>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] border shrink-0 ${statusInfo.badgeClass}`}>
                    {statusInfo.icon}
                    <span>{statusInfo.label}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] border ${priorityInfo.badgeClass}`}>
                    {priorityInfo.label}
                  </span>
                  <span className="text-slate-400 text-xs">
                    Reunión: <strong className="text-slate-300">{item.meetingFolio}</strong>
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Avance de cumplimiento</span>
                    <span className="font-semibold text-slate-200">{item.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${
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

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <div className="text-slate-400">
                    Vencimiento:{' '}
                    <span className={`font-mono ${isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-200'}`}>
                      {new Date(item.dueDate).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                  <Link
                    href={`/agreements/${item.id}`}
                    className="inline-flex items-center space-x-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 px-3 py-1.5 text-xs font-medium border border-amber-500/30 transition"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Abrir Expediente</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
