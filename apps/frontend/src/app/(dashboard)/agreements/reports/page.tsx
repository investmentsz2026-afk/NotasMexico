'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '../../../../lib/api-client';
import { AgreementReportsDto } from '@mexagenda/shared';
import {
  FileSpreadsheet,
  Calendar,
  Clock,
  ArrowLeft,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Printer,
  PieChart,
  Tag,
  Building,
} from 'lucide-react';

export default function AgreementReportsPage() {
  const [reports, setReports] = useState<AgreementReportsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AgreementReportsDto>('/agreements/reports');
      setReports(data);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Error al consultar reportes de acuerdos.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (isLoading && !reports) {
    return (
      <div className="flex flex-col items-center justify-center p-20 rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
        <p className="text-xs text-slate-400">Compilando informe institucional en Neon...</p>
      </div>
    );
  }

  const m = reports?.metrics || {
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
              <FileSpreadsheet className="h-6 w-6 text-emerald-400" />
              <span>Informe Institucional de Acuerdos Colegiados</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Análisis de cumplimiento, acuerdos vencidos y semáforo preventivo de plazos
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-medium text-slate-200 border border-slate-700 transition shadow-sm"
          >
            <Printer className="h-4 w-4 text-amber-400" />
            <span>Imprimir / PDF</span>
          </button>
          <button
            onClick={() => fetchReports()}
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

      {/* Resumen Ejecutivo */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Resumen Ejecutivo de Gestión Colegiada
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <span className="text-slate-400 block text-[11px]">Total Acuerdos Emitidos:</span>
            <span className="font-mono text-xl font-bold text-slate-100">{m.total}</span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
            <span className="text-emerald-400 block text-[11px]">Cumplidos Formalmente:</span>
            <span className="font-mono text-xl font-bold text-emerald-300">{m.cumplidos}</span>
          </div>
          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40">
            <span className="text-rose-400 block text-[11px]">Acuerdos Vencidos:</span>
            <span className="font-mono text-xl font-bold text-rose-300">{m.vencidos}</span>
          </div>
          <div className="p-3 rounded-lg bg-sky-950/30 border border-sky-800/40">
            <span className="text-sky-400 block text-[11px]">Tasa Global de Éxito:</span>
            <span className="font-mono text-xl font-bold text-sky-300">
              {m.porcentajeCumplimientoGlobal}%
            </span>
          </div>
        </div>
      </div>

      {/* Bloque 1: Acuerdos Vencidos */}
      <div className="rounded-xl border border-rose-900/40 bg-slate-900/70 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span>Acuerdos con Plazo Vencido ({reports?.overdue?.length || 0})</span>
          </h3>
          <span className="text-xs text-rose-400/80 font-medium">Requieren atención prioritaria</span>
        </div>

        {!reports?.overdue || reports.overdue.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Excelente: no hay acuerdos con plazo vencido en la institución.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400">
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Título del Acuerdo</th>
                  <th className="py-2.5 px-3">Responsable</th>
                  <th className="py-2.5 px-3">Fecha Vencimiento</th>
                  <th className="py-2.5 px-3">Avance</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reports.overdue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{item.folio}</td>
                    <td className="py-2.5 px-3 text-slate-200 font-medium">{item.title}</td>
                    <td className="py-2.5 px-3 text-slate-300">{item.assignee.fullName}</td>
                    <td className="py-2.5 px-3 font-mono text-rose-400 font-semibold">
                      {new Date(item.dueDate).toLocaleDateString('es-MX')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{item.progressPercent}%</td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/agreements/${item.id}`}
                        className="inline-flex items-center space-x-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-200 border border-slate-700"
                      >
                        <Eye className="h-3 w-3 text-amber-400" />
                        <span>Ver</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bloque 2: Acuerdos Próximos a Vencer (Próximos 15 días) */}
      <div className="rounded-xl border border-amber-900/40 bg-slate-900/70 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span>Acuerdos Próximos a Vencer en los Siguientes 15 Días ({reports?.upcomingDue?.length || 0})</span>
          </h3>
          <span className="text-xs text-amber-400/80 font-medium">Semáforo de advertencia</span>
        </div>

        {!reports?.upcomingDue || reports.upcomingDue.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No hay acuerdos con vencimiento en los próximos 15 días naturales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400">
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Título</th>
                  <th className="py-2.5 px-3">Responsable</th>
                  <th className="py-2.5 px-3">Vence el</th>
                  <th className="py-2.5 px-3">Avance Actual</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reports.upcomingDue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{item.folio}</td>
                    <td className="py-2.5 px-3 text-slate-200 font-medium">{item.title}</td>
                    <td className="py-2.5 px-3 text-slate-300">{item.assignee.fullName}</td>
                    <td className="py-2.5 px-3 font-mono text-amber-300 font-semibold">
                      {new Date(item.dueDate).toLocaleDateString('es-MX')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{item.progressPercent}%</td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/agreements/${item.id}`}
                        className="inline-flex items-center space-x-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-200 border border-slate-700"
                      >
                        <Eye className="h-3 w-3 text-amber-400" />
                        <span>Ver</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bloque 3: Distribución por Prioridad y Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Distribución por Prioridad */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-2">
            <Tag className="h-4 w-4 text-sky-400" />
            <span>Distribución por Nivel de Prioridad</span>
          </h3>
          <div className="space-y-2 text-xs">
            {Object.entries(reports?.byPriority || {}).map(([key, count]) => (
              <div key={key} className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300 font-medium">{key}:</span>
                <span className="font-mono font-bold text-slate-100 bg-slate-800 px-2 py-0.5 rounded">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Distribución por Tipo de Acuerdo */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-2">
            <Building className="h-4 w-4 text-emerald-400" />
            <span>Distribución por Carácter / Tipo de Acuerdo</span>
          </h3>
          <div className="space-y-2 text-xs">
            {Object.entries(reports?.byType || {}).map(([key, count]) => (
              <div key={key} className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300 font-medium">{key.replace(/_/g, ' ')}:</span>
                <span className="font-mono font-bold text-slate-100 bg-slate-800 px-2 py-0.5 rounded">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

