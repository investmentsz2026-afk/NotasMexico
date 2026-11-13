'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth-context';
import { apiFetch, ApiClientError } from '../../../../lib/api-client';
import { SessionInfo } from '@mexagenda/shared';
import {
  Laptop,
  Globe,
  Clock,
  ShieldX,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function SessionsManagementPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadSessions();
    }
  }, [user, isAuthLoading]);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SessionInfo[]>('/auth/sessions');
      setSessions(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.problem.detail || 'Error al obtener sesiones.');
      } else {
        setError('No se pudo conectar con el servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSingle = async (sessionId: string) => {
    try {
      await apiFetch(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
      setActionMessage('Sesión revocada exitosamente.');
      await loadSessions();
      setTimeout(() => setActionMessage(null), 3000);
    } catch {
      setError('Fallo al revocar la sesión seleccionada.');
    }
  };

  const handleRevokeAllOther = async () => {
    try {
      await apiFetch('/auth/logout-all', { method: 'POST' });
      // Redirigir al login ya que revoca todas
      router.push('/login');
    } catch {
      setError('Fallo al revocar las sesiones activas.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/profile"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver al perfil</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sesiones Activas y Dispositivos
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Sesiones persistidas en Neon PostgreSQL con tiempo de inactividad máximo de 30 minutos y vida absoluta de 8 horas.
          </p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={loadSessions}
            disabled={isLoading}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          <button
            onClick={handleRevokeAllOther}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition shadow-sm"
          >
            <ShieldX className="h-3.5 w-3.5" />
            <span>Cerrar Todas las Sesiones</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 flex items-center space-x-2 text-emerald-800 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 border border-rose-200 flex items-center space-x-2 text-rose-800 text-xs">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de sesiones */}
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Cargando sesiones desde Neon PostgreSQL...</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No se encontraron sesiones registradas.</div>
        ) : (
          sessions.map((sess) => (
            <div key={sess.id} className="p-5 flex items-center justify-between hover:bg-slate-50/60 transition">
              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 mt-0.5">
                  <Laptop className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {sess.userAgent.includes('Mozilla') ? 'Navegador Web' : sess.userAgent}
                    </span>
                    {sess.isCurrent && (
                      <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                        Esta sesión actual
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 truncate max-w-md font-mono">
                    {sess.userAgent}
                  </p>

                  <div className="flex items-center space-x-4 text-xs text-slate-400 pt-1">
                    <span className="flex items-center space-x-1">
                      <Globe className="h-3 w-3" />
                      <span>IP: {sess.ipAddress}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Actividad: {new Date(sess.lastActivityAt).toLocaleTimeString()} ({new Date(sess.lastActivityAt).toLocaleDateString()})</span>
                    </span>
                  </div>
                </div>
              </div>

              {!sess.isCurrent && (
                <button
                  onClick={() => handleRevokeSingle(sess.id)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-900 transition"
                >
                  Revocar
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

