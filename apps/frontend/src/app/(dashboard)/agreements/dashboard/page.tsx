'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '../../../../lib/api-client';
import { AgreementDashboardDto } from '@mexagenda/shared';
import {
  LayoutDashboard,
  FileCheck2,
  Calendar,
  Clock,
  ArrowLeft,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  TrendingUp,
  PauseCircle,
  XCircle,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  BarChart3,
  Flame,
} from 'lucide-react';

export default function AgreementsDashboardPage() {
  const [dashboard, setDashboard] = useState<AgreementDashboardDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AgreementDashboardDto>('/agreements/dashboard');
      setDashboard(data);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Error al consultar métricas del tablero.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading && !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center p-20 rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
        <p className="text-xs text-slate-400">Generando métricas ejecutivas en Neon...</p>
      </div>
    );
  }

  const m = dashboard?.metrics || {
    total: 0,
    pendientes: 0,
    enProceso: 0,
    cumplidos: 0,
    vencidos: 0,
    suspendidos: 0,
    cancelados: 0,
    porcentajeCumplimientoGlobal: 0,
  };

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
              <LayoutDashboard className="h-6 w-6 text-sky-400" />
              <span>Tablero Ejecutivo de Acuerdos</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Supervisión de cumplimiento colegiado, semáforo de plazos y actividad reciente
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/agreements/reports"
            className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-medium text-slate-200 border border-slate-700 transition shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>Ver Reportes</span>
          </Link>
          <button
            onClick={() => fetchDashboard()}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 p-2 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-4 text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* KPI CARDS (7 Métricas Clave) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400">Total Acuerdos</span>
          <div className="text-2xl font-bold text-slate-100 font-mono">{m.total}</div>
        </div>

        {/* Pendientes */}
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/15 p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-amber-400">Pendientes</span>
          <div className="text-2xl font-bold text-amber-300 font-mono">{m.pendientes}</div>
        </div>

        {/* En Proceso */}
        <div className="rounded-xl border border-blue-900/30 bg-blue-950/15 p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-blue-400">En Proceso</span>
          <div className="text-2xl font-bold text-blue-300 font-mono">{m.enProceso}</div>
        </div>

        {/* Cumplidos */}
        <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/15 p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-emerald-400">Cumplidos</span>
          <div className="text-2xl font-bold text-emerald-300 font-mono">{m.cumplidos}</div>
        </div>

        {/* Vencidos */}
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/25 p-3.5 space-y-1">
          <span className="text-[11px] font-semibold text-rose-400">Vencidos</span>
          <div className="text-2xl font-bold text-rose-300 font-mono">{m.vencidos}</div>
        </div>

        {/* Suspendidos */}
        <div className="rounded-xl border border-purple-900/30 bg-purple-950/15 p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-purple-400">Suspendidos</span>
          <div className="text-2xl font-bold text-purple-300 font-mono">{m.suspendidos}</div>
        </div>

        {/* Tasa Cumplimiento */}
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-sky-900/40 bg-sky-950/20 p-3.5 space-y-1">
          <span className="text-[11px] font-bold text-sky-400">Cumplimiento Global</span>
          <div className="text-2xl font-bold text-sky-300 font-mono">
            {m.porcentajeCumplimientoGlobal}%
          </div>
        </div>
      </div>

      {/* Grid de Contenido: Urgentes & Actividad Reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Acuerdos Pendientes Urgentes */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-400" />
              <span>Acuerdos de Prioridad Alta o Urgente</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {dashboard?.urgentPending?.length || 0} activos
            </span>
          </div>

          {!dashboard?.urgentPending || dashboard.urgentPending.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No hay acuerdos urgentes o de alta prioridad pendientes.
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.urgentPending.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-800 bg-slate-800/50 p-3 flex items-center justify-between gap-3 hover:border-slate-700 transition"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-amber-400">
                        {item.folio}
                      </span>
                      <span className="rounded px-1.5 py-0.2 text-[9px] bg-red-950 text-red-200 border border-red-800">
                        {item.priority}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Resp: {item.assignee.fullName} • Vence:{' '}
                      <span className="font-mono text-slate-300">
                        {new Date(item.dueDate).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/agreements/${item.id}`}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 p-2 text-slate-300 border border-slate-700 shrink-0"
                  >
                    <Eye className="h-4 w-4 text-amber-400" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Flujo de Avances Recientes */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <span>Bitácora de Avances Recientes</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Últimos registros
            </span>
          </div>

          {!dashboard?.recentProgress || dashboard.recentProgress.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Sin actividad reciente de avances.
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.recentProgress.map((pr) => (
                <div
                  key={pr.id}
                  className="rounded-lg border border-slate-800 bg-slate-800/40 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        {pr.newPercent}%
                      </span>
                      <span className="font-medium text-slate-200">
                        {pr.reportedBy.fullName}
                      </span>
                    </div>
                    <span className="text-slate-500 font-mono">
                      {new Date(pr.reportedAt).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">
                    {pr.observations || pr.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desglose por Responsables */}
      {dashboard?.byAssignee && dashboard.byAssignee.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Users className="h-4 w-4 text-sky-400" />
            <span>Carga y Cumplimiento por Responsable Institucional</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400">
                  <th className="py-2.5 px-3">Servidor Público</th>
                  <th className="py-2.5 px-2 text-center">Total</th>
                  <th className="py-2.5 px-2 text-center text-emerald-400">Cumplidos</th>
                  <th className="py-2.5 px-2 text-center text-amber-400">Pendientes</th>
                  <th className="py-2.5 px-2 text-center text-rose-400">Vencidos</th>
                  <th className="py-2.5 px-3 text-right">Efectividad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dashboard.byAssignee.map((a) => {
                  const rate = a.total > 0 ? Math.round((a.cumplidos / a.total) * 100) : 0;
                  return (
                    <tr key={a.userId} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-medium text-slate-200">{a.fullName}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-300">{a.total}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-emerald-400 font-semibold">{a.cumplidos}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-amber-400">{a.pendientes}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-rose-400 font-semibold">{a.vencidos}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`font-mono font-bold ${rate >= 80 ? 'text-emerald-400' : rate >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
