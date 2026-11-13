'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import {
  ExecutiveDashboardDto,
  AgreementsTrackingDto,
  SessionGovernanceDto,
  PersonalConsoleDto,
} from '@mexagenda/shared';
import {
  LayoutDashboard,
  FileCheck2,
  Calendar,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Download,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  BarChart3,
  PieChart,
  Filter,
  BookOpen,
  Info,
  CalendarDays,
  PauseCircle,
  Check,
  Flame,
  ChevronRight,
  UserCheck,
} from 'lucide-react';

export default function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ROLE_ADMIN' || user?.permissions?.includes('report:view:executive');

  const [activeTab, setActiveTab] = useState<'executive' | 'agreements' | 'sessions' | 'personal'>(
    isAdmin ? 'executive' : 'personal',
  );

  // Filtros globales
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<Array<{ id: string; name: string; colorHex: string }>>([]);

  // Estados de datos
  const [executiveData, setExecutiveData] = useState<ExecutiveDashboardDto | null>(null);
  const [agreementsData, setAgreementsData] = useState<AgreementsTrackingDto | null>(null);
  const [sessionsData, setSessionsData] = useState<SessionGovernanceDto | null>(null);
  const [personalData, setPersonalData] = useState<PersonalConsoleDto | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cargar catálogo de categorías
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await apiFetch<Array<{ id: string; name: string; colorHex: string }>>('/meeting-categories');
        if (Array.isArray(res)) setCategories(res);
      } catch (err) {
        // Fallback silencioso si falla catálogo
      }
    }
    loadCategories();
  }, []);

  // Construir query string de filtros
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (fromDate) params.append('from', fromDate);
    if (toDate) params.append('to', toDate);
    if (selectedCategory) params.append('categoryId', selectedCategory);
    return params.toString() ? `?${params.toString()}` : '';
  }, [fromDate, toDate, selectedCategory]);

  // Carga de datos según la pestaña activa
  const fetchReportData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const query = buildQueryParams();

    try {
      if (activeTab === 'executive' && isAdmin) {
        const data = await apiFetch<ExecutiveDashboardDto>(`/reports/executive${query}`);
        setExecutiveData(data);
      } else if (activeTab === 'agreements') {
        const data = await apiFetch<AgreementsTrackingDto>(`/reports/agreements${query}`);
        setAgreementsData(data);
      } else if (activeTab === 'sessions') {
        const data = await apiFetch<SessionGovernanceDto>(`/reports/sessions${query}`);
        setSessionsData(data);
      } else if (activeTab === 'personal') {
        const data = await apiFetch<PersonalConsoleDto>('/reports/personal');
        setPersonalData(data);
      }
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('No fue posible consultar las métricas institucionales en este momento.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, isAdmin, buildQueryParams]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Manejo de exportación CSV (DEC-08-01)
  const handleExportCsv = async (type: 'agreements' | 'meetings') => {
    setIsExporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const query = buildQueryParams();
      const separator = query ? '&' : '?';
      const url = `/reports/export${query}${separator}type=${type}`;
      
      const baseBackend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || `${baseBackend}/api/v1`;
      const token = typeof window !== 'undefined' ? localStorage.getItem('mexagenda_token') : null;

      const response = await fetch(`${backendUrl}${url}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || 'Error al descargar la exportación CSV.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const today = new Date().toISOString().split('T')[0];
      a.download = `reporte_mexagenda_${type}_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setSuccessMessage(`Exportación CSV de ${type === 'agreements' ? 'Acuerdos' : 'Sesiones'} descargada exitosamente.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error durante la exportación CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 print:border-b-2 print:border-slate-900">
        <div className="flex items-center space-x-4">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-3 shadow-lg shadow-indigo-500/25 text-white ring-4 ring-indigo-50">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 print:text-slate-900 flex items-center gap-2">
              <span>Reportes Institucionales y Tableros</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-500 print:text-slate-700 mt-0.5 font-medium">
              MOD-07: Métricas ejecutivas en tiempo real, seguimiento de acuerdos y gobernanza colegiada
            </p>
          </div>
        </div>

        {/* Botones de Acción (Ocultos en impresión) */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <button
            onClick={fetchReportData}
            disabled={isLoading}
            className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 shadow-sm transition"
            title="Actualizar datos"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-sky-600' : 'text-slate-500'}`} />
            <span>Refrescar</span>
          </button>

          <button
            onClick={() => handleExportCsv(activeTab === 'sessions' ? 'meetings' : 'agreements')}
            disabled={isExporting}
            className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition"
            title="Exportar archivo CSV oficial (RFC 4180)"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? 'Exportando...' : 'Exportar CSV'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-md shadow-slate-900/20 transition"
            title="Imprimir informe oficial o guardar en PDF"
          >
            <Printer className="h-3.5 w-3.5 text-slate-300" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Alertas de Notificación / Errores */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start space-x-3">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Aviso del Sistema:</span> {errorMessage}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center space-x-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Selector de Pestañas / Vistas (Oculto en impresión) */}
      <div className="flex bg-slate-200/60 p-1.5 rounded-2xl gap-1 overflow-x-auto print:hidden border border-slate-200/80 shadow-inner">
        {isAdmin && (
          <button
            onClick={() => setActiveTab('executive')}
            className={`inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === 'executive'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <LayoutDashboard className="h-4 w-4 text-indigo-600" />
            <span>Tablero Ejecutivo</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('agreements')}
          className={`inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'agreements'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FileCheck2 className="h-4 w-4 text-emerald-600" />
          <span>Seguimiento de Acuerdos</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'sessions'
              ? 'bg-white text-sky-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <CalendarDays className="h-4 w-4 text-sky-600" />
          <span>Gobernanza de Sesiones</span>
        </button>

        <button
          onClick={() => setActiveTab('personal')}
          className={`inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'personal'
              ? 'bg-white text-amber-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Users className="h-4 w-4 text-amber-600" />
          <span>Consola Personal</span>
        </button>
      </div>

      {/* Barra de Filtros (Solo para pestañas agregadas, oculta en consola personal e impresión) */}
      {activeTab !== 'personal' && (
        <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80 space-y-3 print:hidden">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <Filter className="h-4 w-4 text-indigo-600" />
            <span>Filtros Institucionales de Periodo y Clasificación</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha Desde</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha Hasta</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setSelectedCategory('');
                }}
                className="btn-3d w-full rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO DE CADA VISTA */}

      {/* 1. TABLERO EJECUTIVO (ROLE_ADMIN) */}
      {activeTab === 'executive' && isAdmin && (
        <div className="space-y-6">
          {isLoading && !executiveData ? (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-sky-400 mx-auto mb-3" />
              <p className="text-xs text-slate-400">Compilando analítica ejecutiva 360° en Neon...</p>
            </div>
          ) : executiveData ? (
            <>
              {/* Tarjetas KPI Superiores */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80 transition-all hover:scale-[1.01]">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Cumplimiento Global
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-emerald-600 font-mono">
                      {executiveData.kpis.tasaCumplimientoGlobal !== null
                        ? `${executiveData.kpis.tasaCumplimientoGlobal}%`
                        : 'Sin datos'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {executiveData.kpis.cumplidos} de {executiveData.kpis.totalAcuerdosValidos - executiveData.kpis.suspendidos}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Excluye suspendidos y cancelados</p>
                </div>

                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80 transition-all hover:scale-[1.01]">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Cartera Vencida
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className={`text-3xl font-extrabold font-mono ${
                      executiveData.kpis.vencidos > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {executiveData.kpis.vencidos}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">acuerdos</span>
                  </div>
                  <p className="text-[11px] font-medium text-rose-600 mt-1">
                    {executiveData.kpis.vencidos > 0 ? 'Requiere atención urgente' : 'Sin rezagos fatales'}
                  </p>
                </div>

                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80 transition-all hover:scale-[1.01]">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Efectividad Calendario
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-sky-600 font-mono">
                      {executiveData.kpis.tasaEfectividadCalendario !== null
                        ? `${executiveData.kpis.tasaEfectividadCalendario}%`
                        : 'Sin datos'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {executiveData.kpis.reunionesCelebradas} celebradas
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {executiveData.kpis.reunionesCanceladas} sesiones canceladas
                  </p>
                </div>

                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80 transition-all hover:scale-[1.01]">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Tasa de Asistencia
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-indigo-600 font-mono">
                      {executiveData.kpis.tasaAsistenciaPromedio !== null
                        ? `${executiveData.kpis.tasaAsistenciaPromedio}%`
                        : 'Sin datos'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">promedio</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">En sesiones celebradas</p>
                </div>
              </div>

              {/* Semáforo Preventivo y Alertas de Rezago */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Semáforo Preventivo */}
                <div className="lg:col-span-1 card-3d bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span>Semáforo Preventivo de Plazos</span>
                  </h2>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                      <div className="flex items-center space-x-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200" />
                        <span className="text-xs text-rose-800 font-semibold">Ya Vencidos</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-rose-700">
                        {executiveData.semaforoVencimiento.vencidos}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center space-x-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200" />
                        <span className="text-xs text-amber-800 font-semibold">Crítico (0 a 7 días)</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-amber-700">
                        {executiveData.semaforoVencimiento.critico7Dias}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-yellow-50 border border-yellow-200">
                      <div className="flex items-center space-x-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 ring-2 ring-yellow-200" />
                        <span className="text-xs text-yellow-800 font-semibold">Medio (8 a 15 días)</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-yellow-700">
                        {executiveData.semaforoVencimiento.medio15Dias}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                      <div className="flex items-center space-x-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500 ring-2 ring-sky-200" />
                        <span className="text-xs text-sky-800 font-semibold">Lejano (16 a 30 días)</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-sky-700">
                        {executiveData.semaforoVencimiento.lejano30Dias}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="flex items-center space-x-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                        <span className="text-xs text-emerald-800 font-semibold">En Plazo (&gt; 30 días)</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-emerald-700">
                        {executiveData.semaforoVencimiento.enPlazoMas30}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                      <div className="flex items-center space-x-2">
                        <PauseCircle className="h-3 w-3 text-slate-500" />
                        <span className="text-xs text-slate-700 font-semibold">En Suspensión Jurídica</span>
                      </div>
                      <span className="text-xs font-bold font-mono text-slate-700">
                        {executiveData.semaforoVencimiento.suspendidos}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Alertas de Rezago / Compromisos Críticos */}
                <div className="lg:col-span-2 card-3d bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <span>Alertas de Rezago Institucional</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {executiveData.alertasRezago.length} casos prioritarios
                    </span>
                  </h2>

                  {executiveData.alertasRezago.length === 0 ? (
                    <div className="py-12 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-800 font-bold">Excelente desempeño institucional</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">No se registran acuerdos con fecha vencida.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                            <th className="py-2.5 font-bold">Folio</th>
                            <th className="py-2.5 font-bold">Título del Acuerdo</th>
                            <th className="py-2.5 font-bold">Responsable</th>
                            <th className="py-2.5 font-bold">Vencimiento</th>
                            <th className="py-2.5 font-bold text-right">Días Rezago</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {executiveData.alertasRezago.map((alert) => (
                            <tr key={alert.id} className="hover:bg-slate-50">
                              <td className="py-2.5 font-mono text-indigo-600 font-bold">{alert.folio}</td>
                              <td className="py-2.5 max-w-xs truncate font-medium text-slate-800" title={alert.title}>
                                {alert.title}
                              </td>
                              <td className="py-2.5 text-slate-600">{alert.assigneeName}</td>
                              <td className="py-2.5 font-mono text-slate-500">{alert.dueDate}</td>
                              <td className="py-2.5 text-right font-mono font-bold text-rose-600">
                                +{alert.diasVencido} d
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Distribución por Categorías */}
              <div className="card-3d bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-indigo-600" />
                  <span>Distribución de Actividad por Órgano Colegiado y Categoría</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {executiveData.distribucionCategorias.map((cat) => (
                    <div
                      key={cat.categoryId}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                          style={{ backgroundColor: cat.colorHex }}
                        />
                        <span className="text-xs font-bold text-slate-900 truncate" title={cat.name}>
                          {cat.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-slate-200/60">
                        <div>
                          <span className="text-slate-500">Sesiones:</span>{' '}
                          <span className="font-bold font-mono text-slate-800">{cat.reuniones}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Acuerdos:</span>{' '}
                          <span className="font-bold font-mono text-slate-800">{cat.acuerdos}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* 2. SEGUIMIENTO DE ACUERDOS */}
      {activeTab === 'agreements' && (
        <div className="space-y-6">
          {isLoading && !agreementsData ? (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400 mx-auto mb-3" />
              <p className="text-xs text-slate-400">Compilando matriz de acuerdos en Neon...</p>
            </div>
          ) : agreementsData ? (
            <>
              {/* Tarjetas de Resumen de Acuerdos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="card-3d bg-white p-4 text-center rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Total Cartera</span>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1">
                    {agreementsData.resumenEstados.total}
                  </div>
                </div>

                <div className="card-3d bg-white p-4 text-center rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase">Cumplidos</span>
                  <div className="text-2xl font-black font-mono text-emerald-600 mt-1">
                    {agreementsData.resumenEstados.cumplidos}
                  </div>
                </div>

                <div className="card-3d bg-white p-4 text-center rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-sky-600 uppercase">En Proceso</span>
                  <div className="text-2xl font-black font-mono text-sky-600 mt-1">
                    {agreementsData.resumenEstados.enProceso}
                  </div>
                </div>

                <div className="card-3d bg-white p-4 text-center rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-amber-600 uppercase">Pendientes</span>
                  <div className="text-2xl font-black font-mono text-amber-600 mt-1">
                    {agreementsData.resumenEstados.pendientes}
                  </div>
                </div>

                <div className="card-3d bg-white p-4 text-center rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-rose-600 uppercase">Vencidos</span>
                  <div className="text-2xl font-black font-mono text-rose-600 mt-1">
                    {agreementsData.resumenEstados.vencidos}
                  </div>
                </div>

                <div className="card-3d bg-white p-4 text-center rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Suspendidos</span>
                  <div className="text-2xl font-black font-mono text-slate-700 mt-1">
                    {agreementsData.resumenEstados.suspendidos}
                  </div>
                </div>
              </div>

              {/* Indicadores de Rendimiento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500">Tasa de Cumplimiento</span>
                  <div className="text-3xl font-black font-mono text-emerald-600 mt-1">
                    {agreementsData.tasaCumplimiento !== null ? `${agreementsData.tasaCumplimiento}%` : 'Sin datos'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Cumplidos vs Exigibles en cartera</p>
                </div>

                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500">Efectividad en Plazo</span>
                  <div className="text-3xl font-black font-mono text-sky-600 mt-1">
                    {agreementsData.tasaEfectividadTemporal !== null
                      ? `${agreementsData.tasaEfectividadTemporal}%`
                      : 'Sin datos'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Cumplidos en o antes de la fecha límite</p>
                </div>

                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500">Tiempo Medio de Atención</span>
                  <div className="text-3xl font-black font-mono text-indigo-600 mt-1">
                    {agreementsData.tiempoPromedioResolucionDias !== null
                      ? `${agreementsData.tiempoPromedioResolucionDias} días`
                      : 'Sin datos'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Días entre aprobación y cumplimiento</p>
                </div>
              </div>

              {/* Carga por Titular (Solo Visible para ROLE_ADMIN) */}
              {isAdmin && agreementsData.cargaPorTitular && (
                <div className="card-3d bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-sky-600" />
                    <span>Carga Operativa por Titular Responsable (Gestión Directiva)</span>
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                          <th className="py-2.5 font-bold">Integrante Titular</th>
                          <th className="py-2.5 font-bold text-center">Total Asignados</th>
                          <th className="py-2.5 font-bold text-center">Cumplidos</th>
                          <th className="py-2.5 font-bold text-center">En Trámite</th>
                          <th className="py-2.5 font-bold text-center">Vencidos</th>
                          <th className="py-2.5 font-bold text-right">Efectividad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {agreementsData.cargaPorTitular.map((u) => (
                          <tr key={u.userId} className="hover:bg-slate-50">
                            <td className="py-2.5 font-semibold text-slate-900">
                              {u.fullName} <span className="text-slate-400 font-normal text-[11px]">({u.email})</span>
                            </td>
                            <td className="py-2.5 text-center font-mono font-bold text-slate-800">{u.totalTitular}</td>
                            <td className="py-2.5 text-center font-mono text-emerald-600 font-bold">{u.cumplidos}</td>
                            <td className="py-2.5 text-center font-mono text-sky-600 font-semibold">{u.pendientes}</td>
                            <td className="py-2.5 text-center font-mono text-rose-600 font-bold">{u.vencidos}</td>
                            <td className="py-2.5 text-right font-mono font-black text-slate-900">
                              {u.tasaCumplimiento !== null ? `${u.tasaCumplimiento}%` : 'Sin datos'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Listado Detallado de Acuerdos */}
              <div className="card-3d bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Expedientes de Acuerdos Filtrados</h2>
                  <span className="text-xs text-slate-500 font-mono">
                    Mostrando {agreementsData.items.length} de {agreementsData.totalItems} registros
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                        <th className="py-2.5 font-bold">Folio</th>
                        <th className="py-2.5 font-bold">Título del Acuerdo</th>
                        <th className="py-2.5 font-bold">Categoría</th>
                        <th className="py-2.5 font-bold">Responsable</th>
                        <th className="py-2.5 font-bold">Fecha Límite</th>
                        <th className="py-2.5 font-bold">Estado</th>
                        <th className="py-2.5 font-bold text-right">Progreso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {agreementsData.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2.5 font-mono text-indigo-600 font-bold">{item.folio}</td>
                          <td className="py-2.5 max-w-sm truncate font-medium text-slate-900" title={item.title}>
                            {item.title}
                          </td>
                          <td className="py-2.5">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                backgroundColor: `${item.categoryColorHex}15`,
                                color: item.categoryColorHex,
                                border: `1px solid ${item.categoryColorHex}30`,
                              }}
                            >
                              {item.categoryName}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-700">
                            {item.assigneeName}{' '}
                            {item.isCollaborator && (
                              <span className="text-[10px] text-amber-600 font-semibold">(Coadyuvante)</span>
                            )}
                          </td>
                          <td className="py-2.5 font-mono text-slate-500">{item.dueDate || 'Sin plazo'}</td>
                          <td className="py-2.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                item.effectiveStatus === 'CUMPLIDO'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : item.effectiveStatus === 'VENCIDO'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : item.effectiveStatus === 'SUSPENDIDO'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : 'bg-sky-50 text-sky-700 border border-sky-200'
                              }`}
                            >
                              {item.effectiveStatus}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-mono font-black text-slate-900">
                            {item.progressPercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* 3. GOBERNANZA DE SESIONES */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {isLoading && !sessionsData ? (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-400 mx-auto mb-3" />
              <p className="text-xs text-slate-400">Compilando gobernanza colegiada en Neon...</p>
            </div>
          ) : sessionsData ? (
            <>
              {/* Tarjetas de Resumen de Sesiones */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500">Sesiones Celebradas</span>
                  <div className="text-3xl font-black font-mono text-indigo-600 mt-1">
                    {sessionsData.resumen.celebradas}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    De {sessionsData.resumen.totalConvocadas} convocadas formalmente
                  </p>
                </div>

                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500">Tasa de Asistencia</span>
                  <div className="text-3xl font-black font-mono text-emerald-600 mt-1">
                    {sessionsData.asistencia.tasaAsistenciaPromedio !== null
                      ? `${sessionsData.asistencia.tasaAsistenciaPromedio}%`
                      : 'Sin datos'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {sessionsData.asistencia.totalAsistencias} asistencias registradas
                  </p>
                </div>

                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500">Quórum Legal Cumplido</span>
                  <div className="text-3xl font-black font-mono text-sky-600 mt-1">
                    {sessionsData.quorum.tasaCumplimientoQuorum !== null
                      ? `${sessionsData.quorum.tasaCumplimientoQuorum}%`
                      : 'Sin datos'}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1" title={sessionsData.quorum.reglaQuorum}>
                    {sessionsData.quorum.sesionesConQuorum} sesiones con quórum legal
                  </p>
                </div>

                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500">Formalización de Actas</span>
                  <div className="text-3xl font-black font-mono text-amber-600 mt-1">
                    {sessionsData.actas.tiempoMedioAprobacionDias !== null
                      ? `${sessionsData.actas.tiempoMedioAprobacionDias} días`
                      : 'Sin datos'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {sessionsData.actas.totalActasAprobadas} actas aprobadas formalmente
                  </p>
                </div>
              </div>

              {/* Bitácora de Sesiones Recientes */}
              <div className="card-3d bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">Expedientes de Sesiones y Quórum Verificado</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[11px]">
                        <th className="py-2.5 font-bold">Folio</th>
                        <th className="py-2.5 font-bold">Título de la Sesión</th>
                        <th className="py-2.5 font-bold">Fecha</th>
                        <th className="py-2.5 font-bold">Modalidad</th>
                        <th className="py-2.5 font-bold text-center">Convocados</th>
                        <th className="py-2.5 font-bold text-center">Presentes</th>
                        <th className="py-2.5 font-bold text-center">Quórum Legal</th>
                        <th className="py-2.5 font-bold text-right">Estado Acta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {sessionsData.sesionesRecientes.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-2.5 font-mono text-indigo-600 font-bold">{s.folio}</td>
                          <td className="py-2.5 max-w-sm truncate font-medium text-slate-900" title={s.title}>
                            {s.title}
                          </td>
                          <td className="py-2.5 font-mono text-slate-500">{s.meetingDate}</td>
                          <td className="py-2.5 text-slate-600">{s.modality}</td>
                          <td className="py-2.5 text-center font-mono font-semibold text-slate-700">{s.totalConvocados}</td>
                          <td className="py-2.5 text-center font-mono font-bold text-emerald-600">
                            {s.totalPresentes}
                          </td>
                          <td className="py-2.5 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                s.tieneQuorum
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {s.tieneQuorum ? 'SÍ' : 'NO'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-medium text-slate-700">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                s.estadoActa === 'APROBADA'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {s.estadoActa}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* 4. CONSOLA PERSONAL (INTEGRANTE / CONSEJERO) */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          {isLoading && !personalData ? (
            <div className="py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-3" />
              <p className="text-xs text-slate-500">Compilando consola operativa individual en Neon...</p>
            </div>
          ) : personalData ? (
            <>
              {/* Tarjeta de Bienvenida Personal */}
              <div className="card-3d bg-white p-6 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-amber-500" />
                    <span>Consola Institucional de {personalData.user.fullName}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {personalData.user.email} • Rol:{' '}
                    <span className="font-semibold text-slate-800">{personalData.user.role}</span>
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl">
                  <Check className="h-4 w-4" />
                  <span>Sesión institucional verificada</span>
                </div>
              </div>

              {/* Indicadores Personales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500">Acuerdos como Titular</span>
                  <div className="text-3xl font-black font-mono text-amber-600 mt-1">
                    {personalData.acuerdosTitular.total}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {personalData.acuerdosTitular.cumplidos} cumplidos • {personalData.acuerdosTitular.vencidos} vencidos
                  </p>
                </div>

                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500">Colaboraciones Coadyuvantes</span>
                  <div className="text-3xl font-black font-mono text-sky-600 mt-1">
                    {personalData.acuerdosCoadyuvante.total}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {personalData.acuerdosCoadyuvante.enProceso} en proceso de atención
                  </p>
                </div>

                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500">Mi Asistencia Histórica</span>
                  <div className="text-3xl font-black font-mono text-emerald-600 mt-1">
                    {personalData.asistenciaHistorica.tasaAsistenciaPersonal !== null
                      ? `${personalData.asistenciaHistorica.tasaAsistenciaPersonal}%`
                      : 'Sin datos'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {personalData.asistenciaHistorica.sesionesAsistidas} de{' '}
                    {personalData.asistenciaHistorica.sesionesConvocado} sesiones
                  </p>
                </div>

                {/* Métrica de Notas Personales con Aislamiento Estricto */}
                <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80 relative overflow-hidden">
                  <span className="text-xs font-bold text-slate-500">Mis Anotaciones Privadas</span>
                  <div className="text-3xl font-black font-mono text-cyan-600 mt-1">
                    {personalData.notasPrivadas.totalNotas}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {personalData.notasPrivadas.notasUltimaSemana} redactadas esta semana
                  </p>
                  <div className="mt-2 flex items-center space-x-1 text-[10px] text-cyan-700 bg-cyan-50 p-1.5 rounded-lg border border-cyan-200">
                    <Info className="h-3 w-3 shrink-0" />
                    <span className="truncate font-medium">Contenido 100% privado e inaccesible para terceros</span>
                  </div>
                </div>
              </div>

              {/* Mis Acuerdos Prioritarios y Próximas Sesiones */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Acuerdos prioritarios */}
                <div className="card-3d bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-emerald-600" />
                      <span>Mis Compromisos Prioritarios</span>
                    </span>
                    <Link href="/agreements" className="text-xs font-bold text-indigo-600 hover:underline">
                      Ver todos
                    </Link>
                  </h3>

                  {personalData.misAcuerdosPrioritarios.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      No tienes acuerdos pendientes ni en riesgo en este momento.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {personalData.misAcuerdosPrioritarios.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 transition"
                        >
                          <div className="space-y-0.5 max-w-xs sm:max-w-md truncate">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs text-indigo-600 font-bold">{item.folio}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                {item.rol}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-900 truncate">{item.title}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`text-xs font-mono font-bold ${
                                item.effectiveStatus === 'VENCIDO'
                                  ? 'text-rose-600'
                                  : item.daysRemaining <= 7
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {item.effectiveStatus === 'VENCIDO'
                                ? 'Vencido'
                                : `En ${item.daysRemaining} días`}
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono font-semibold">{item.progressPercent}% avance</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Próximas sesiones */}
                <div className="card-3d bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-indigo-600" />
                      <span>Próximas Sesiones Convocadas</span>
                    </span>
                    <Link href="/meetings" className="text-xs font-bold text-indigo-600 hover:underline">
                      Ver agenda
                    </Link>
                  </h3>

                  {personalData.proximasSesiones.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      No tienes convocatorias programadas en los próximos días.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {personalData.proximasSesiones.map((ses) => (
                        <div
                          key={ses.id}
                          className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 transition"
                        >
                          <div className="space-y-0.5 max-w-xs sm:max-w-md truncate">
                            <span className="font-mono text-xs text-indigo-600 font-bold">{ses.folio}</span>
                            <p className="text-xs font-medium text-slate-900 truncate">{ses.title}</p>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {ses.categoryName} • {ses.modality}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-bold text-slate-800">{ses.meetingDate}</span>
                            <div className="text-[11px] text-slate-500 font-mono">{ses.startTime} hrs</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Pie de Página Institucional para Impresión Oficial (@media print) */}
      <div className="hidden print:block pt-8 mt-12 border-t-2 border-slate-900 text-slate-800 text-[10px] space-y-1">
        <div className="flex justify-between font-bold">
          <span>MexAgenda — Sistema Privado de Gestión Institucional</span>
          <span>Fecha de Emisión: {new Date().toLocaleDateString('es-MX')}</span>
        </div>
        <div>
          Generado por: {user?.firstName} {user?.lastName} ({user?.email}) • Sello de Autenticidad Digital Neon PostgreSQL
        </div>
        <div className="text-slate-500">
          Documento oficial para uso interno y deliberación del cuerpo colegiado. Prohibida su reproducción no autorizada.
        </div>
      </div>
    </div>
  );
}

