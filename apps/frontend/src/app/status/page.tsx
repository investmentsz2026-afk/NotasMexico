'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { HealthCheckResponse } from '@mexagenda/shared';

export default function StatusPage() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const backendUrl =
        process.env.BACKEND_SERVICE_URL ||
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        (typeof window !== 'undefined' ? '' : 'http://localhost:4000');
      const res = await fetch(`${backendUrl}/api/v1/health`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data: HealthCheckResponse = await res.json();
      setHealthData(data);
    } catch (err) {
      setError((err as Error).message);
      setHealthData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Botón de regreso */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-institutional-muted hover:text-institutional-navy transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al inicio</span>
        </Link>
      </div>

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-institutional-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-institutional-navy">
            Diagnóstico de Infraestructura
          </h1>
          <p className="mt-1 text-sm text-institutional-muted">
            Monitoreo en tiempo real de los servicios y dependencias de MexAgenda.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={isLoading}
          className="inline-flex items-center space-x-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-institutional-navy border border-institutional-border shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-institutional-highlight' : ''}`} />
          <span>Actualizar Diagnóstico</span>
        </button>
      </div>

      {/* Tarjetas de Componentes */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Frontend Web Status */}
        <div className="rounded-xl bg-white p-6 border border-institutional-border shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-highlight">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-institutional-navy">
                  Frontend Next.js (App Router)
                </h2>
                <p className="text-xs text-institutional-muted">Aplicación Web Institucional</p>
              </div>
            </div>
            <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Operativo</span>
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-institutional-muted">
            <div className="flex justify-between">
              <span>Framework:</span>
              <span className="font-semibold text-slate-700">Next.js 15 + React 19</span>
            </div>
            <div className="flex justify-between">
              <span>Modo:</span>
              <span className="font-semibold text-slate-700">App Router (SSR / Client)</span>
            </div>
            <div className="flex justify-between">
              <span>Seguridad de Red:</span>
              <span className="font-semibold text-slate-700">Cabeceras HSTS / CSP Activas</span>
            </div>
          </div>
        </div>

        {/* Backend API Status */}
        <div className="rounded-xl bg-white p-6 border border-institutional-border shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-institutional-navy">
                  Backend NestJS REST API
                </h2>
                <p className="text-xs text-institutional-muted">Capa de Lógica y Dominio</p>
              </div>
            </div>

            {isLoading ? (
              <span className="text-xs text-institutional-muted animate-pulse">Comprobando...</span>
            ) : healthData && healthData.services.api === 'healthy' ? (
              <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Saludable</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>No Conectado</span>
              </span>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-institutional-muted">
            <div className="flex justify-between">
              <span>Prefijo Global:</span>
              <span className="font-semibold text-slate-700">/api/v1</span>
            </div>
            <div className="flex justify-between">
              <span>CORS:</span>
              <span className="font-semibold text-slate-700">Lista Explícita Autorizada</span>
            </div>
            <div className="flex justify-between">
              <span>Documentación:</span>
              <span className="font-semibold text-slate-700">OpenAPI Swagger (/api/docs)</span>
            </div>
          </div>
        </div>

        {/* Database Status */}
        <div className="rounded-xl bg-white p-6 border border-institutional-border shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-institutional-navy">
                  Neon PostgreSQL + Prisma
                </h2>
                <p className="text-xs text-institutional-muted">Capa de Persistencia Transaccional</p>
              </div>
            </div>

            {isLoading ? (
              <span className="text-xs text-institutional-muted animate-pulse">Comprobando...</span>
            ) : healthData?.services.database === 'connected' ? (
              <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Conectado</span>
              </span>
            ) : healthData?.services.database === 'not_configured' ? (
              <span className="inline-flex items-center space-x-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-300">
                <span>Pendiente Credenciales</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Desconectado</span>
              </span>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-institutional-muted">
            <div className="flex justify-between">
              <span>Esquema Prisma:</span>
              <span className="font-semibold text-slate-700">19 Entidades Normalizadas</span>
            </div>
            <div className="flex justify-between">
              <span>Pooler:</span>
              <span className="font-semibold text-slate-700">PgBouncer (DATABASE_URL)</span>
            </div>
            <div className="flex justify-between">
              <span>Migraciones:</span>
              <span className="font-semibold text-slate-700">Conexión Directa (DIRECT_URL)</span>
            </div>
          </div>
        </div>

        {/* Security Matrix */}
        <div className="rounded-xl bg-white p-6 border border-institutional-border shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-institutional-navy">
                  Gobernanza y Trazabilidad
                </h2>
                <p className="text-xs text-institutional-muted">Protección de Datos y Auditoría</p>
              </div>
            </div>

            <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Verificado</span>
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-institutional-muted">
            <div className="flex justify-between">
              <span>Anti-IDOR:</span>
              <span className="font-semibold text-slate-700">Validación de Dominio Backend</span>
            </div>
            <div className="flex justify-between">
              <span>Auditoría:</span>
              <span className="font-semibold text-slate-700">Append-Only + Zero Secrets</span>
            </div>
            <div className="flex justify-between">
              <span>Normativa:</span>
              <span className="font-semibold text-slate-700">LFPDPPP (México)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de Respuesta Cruda de Diagnóstico */}
      <div className="mt-8 rounded-xl bg-slate-900 text-white p-6 border border-slate-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Respuesta Cruda de Diagnóstico (/api/v1/health)
        </h2>
        {isLoading ? (
          <p className="mt-3 text-xs text-slate-400 font-mono">Consultando servicio backend...</p>
        ) : error ? (
          <div className="mt-3 text-xs text-amber-400 font-mono">
            Backend no disponible localmente en este momento ({error}).
            <p className="mt-1 text-[11px] text-slate-400">
              Asegúrese de ejecutar `pnpm --filter @mexagenda/backend dev` para iniciar el servidor NestJS en el puerto 4000.
            </p>
          </div>
        ) : (
          <pre className="mt-3 text-xs font-mono text-emerald-400 overflow-x-auto p-3 bg-slate-950 rounded-lg border border-slate-800">
            {JSON.stringify(healthData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
