'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  Sliders,
  Calendar,
  FileCheck,
  BookOpen,
  FolderLock,
  AlertCircle,
  ExternalLink,
  Trash2,
  Check,
  RefreshCw,
  Mail,
  ShieldCheck,
  X,
} from 'lucide-react';
import { apiFetch } from '../../../lib/api-client';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  resourceType?: string;
  resourceId?: string;
  createdAt: string;
}

interface NotificationPreference {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  meetingAlerts: boolean;
  agreementAlerts: boolean;
  minutesAlerts: boolean;
  generalAlerts: boolean;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'MEETINGS' | 'AGREEMENTS' | 'MINUTES'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  // Modal de Preferencias
  const [isPrefOpen, setIsPrefOpen] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreference>({
    emailEnabled: true,
    inAppEnabled: true,
    meetingAlerts: true,
    agreementAlerts: true,
    minutesAlerts: true,
    generalAlerts: true,
  });
  const [isSavingPref, setIsSavingPref] = useState(false);
  const [prefFeedback, setPrefFeedback] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      let queryUrl = `/notifications?page=${page}&limit=15`;
      if (filter === 'UNREAD') queryUrl += '&isRead=false';
      if (filter === 'MEETINGS') queryUrl += '&type=REUNION_CONVOCATORIA';
      if (filter === 'AGREEMENTS') queryUrl += '&type=ACUERDO_ASIGNADO';
      if (filter === 'MINUTES') queryUrl += '&type=ACTA_PUBLICADA';

      const res = await apiFetch<{
        data: {
          items: NotificationItem[];
          meta: { totalPages: number };
        };
      }>(queryUrl);

      if (res?.data) {
        setNotifications(res.data.items || []);
        setTotalPages(res.data.meta?.totalPages || 1);
      }

      // Obtener conteo de no leídas
      const countRes = await apiFetch<{ data: { unreadCount: number } }>('/notifications/unread-count');
      if (countRes?.data) {
        setUnreadCount(countRes.data.unreadCount);
      }
    } catch {
      // Silencioso
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await apiFetch<{ data: NotificationPreference }>('/notifications/preferences');
      if (res?.data) {
        setPreferences(res.data);
      }
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [page, filter]);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const handleMarkAsRead = async (id: string, actionUrl?: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (actionUrl) {
        router.push(actionUrl);
      }
    } catch {
      // Silencioso
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Silencioso
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // Silencioso
    }
  };

  const handleSavePreferences = async () => {
    setIsSavingPref(true);
    setPrefFeedback(null);
    try {
      await apiFetch('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(preferences),
      });
      setPrefFeedback('Preferencias institucionales actualizadas exitosamente');
      setTimeout(() => {
        setIsPrefOpen(false);
        setPrefFeedback(null);
      }, 1200);
    } catch {
      setPrefFeedback('Error al actualizar preferencias');
    } finally {
      setIsSavingPref(false);
    }
  };

  const getIconForType = (type: string) => {
    if (type.startsWith('REUNION_')) return <Calendar className="h-4 w-4 text-amber-400" />;
    if (type.startsWith('ACUERDO_')) return <FileCheck className="h-4 w-4 text-emerald-400" />;
    if (type.startsWith('ACTA_')) return <FileCheck className="h-4 w-4 text-purple-400" />;
    if (type.startsWith('NOTA_')) return <BookOpen className="h-4 w-4 text-cyan-400" />;
    if (type.startsWith('DOCUMENTO_')) return <FolderLock className="h-4 w-4 text-indigo-400" />;
    return <AlertCircle className="h-4 w-4 text-slate-400" />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center space-x-2.5">
            <Bell className="h-6 w-6 text-amber-400" />
            <span>Centro de Notificaciones Institucionales</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Bandeja unificada de convocatorias, actas, acuerdos y avisos de órganos colegiados.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsPrefOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition border border-slate-700"
          >
            <Sliders className="h-3.5 w-3.5 text-amber-400" />
            <span>Preferencias</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center space-x-1.5 rounded-md bg-amber-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition shadow-sm"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Marcar todas leídas</span>
            </button>
          )}

          <button
            onClick={fetchNotifications}
            title="Refrescar"
            className="inline-flex items-center justify-center rounded-md bg-slate-800 p-1.5 text-slate-400 hover:text-white transition border border-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin">
        {[
          { key: 'ALL', label: 'Todas' },
          { key: 'UNREAD', label: `No Leídas (${unreadCount})` },
          { key: 'MEETINGS', label: 'Reuniones' },
          { key: 'AGREEMENTS', label: 'Acuerdos' },
          { key: 'MINUTES', label: 'Actas' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setFilter(tab.key as any);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition border ${
              filter === tab.key
                ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista de Notificaciones */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent mb-2" />
            <p className="text-xs">Consultando bandeja de notificaciones...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <Bell className="h-10 w-10 mx-auto text-slate-600 opacity-60" />
            <h3 className="text-sm font-semibold text-slate-300">No hay notificaciones disponibles</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No se encontraron avisos institucionales para el filtro seleccionado.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-850/60 ${
                  !notif.isRead ? 'bg-amber-950/15 border-l-4 border-amber-500' : 'opacity-90'
                }`}
              >
                <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                  <div className="mt-0.5 rounded-lg p-2 bg-slate-800 border border-slate-700 shrink-0">
                    {getIconForType(notif.type)}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h4
                        className={`text-sm truncate ${
                          !notif.isRead ? 'text-slate-100 font-semibold' : 'text-slate-300 font-medium'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>
                    <span className="text-[11px] text-slate-500 block">
                      {new Date(notif.createdAt).toLocaleDateString('es-MX', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Acciones de la Notificación */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  {notif.actionUrl && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id, notif.actionUrl)}
                      className="inline-flex items-center space-x-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-slate-700 hover:text-amber-300 transition border border-slate-700"
                    >
                      <span>Ver Recurso</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      title="Marcar como leída"
                      className="inline-flex items-center justify-center rounded-md bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition border border-slate-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(notif.id)}
                    title="Eliminar de mi bandeja"
                    className="inline-flex items-center justify-center rounded-md bg-rose-950/20 p-1.5 text-rose-400 hover:bg-rose-900/40 hover:text-rose-200 transition border border-rose-900/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-850 px-4 py-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition disabled:opacity-40 disabled:pointer-events-none border border-slate-700"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-400">
              Página {page} de {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition disabled:opacity-40 disabled:pointer-events-none border border-slate-700"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Modal de Preferencias de Notificación */}
      {isPrefOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Preferencias de Notificación</h3>
              </div>
              <button
                onClick={() => setIsPrefOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-slate-400 leading-relaxed">
              Configure los canales y eventos en los cuales desea recibir alertas institucionales.
            </p>

            <div className="space-y-4">
              <div className="rounded-md bg-slate-850 p-3 border border-slate-800 space-y-3">
                <h4 className="font-semibold text-slate-200 text-xs flex items-center space-x-1.5">
                  <Mail className="h-3.5 w-3.5 text-amber-400" />
                  <span>Canales de Distribución</span>
                </h4>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Notificaciones Internas (In-App)</span>
                  <input
                    type="checkbox"
                    checked={preferences.inAppEnabled}
                    onChange={(e) =>
                      setPreferences({ ...preferences, inAppEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-700 text-amber-600 focus:ring-amber-500 bg-slate-800"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Avisos por Correo Electrónico (SMTP)</span>
                  <input
                    type="checkbox"
                    checked={preferences.emailEnabled}
                    onChange={(e) =>
                      setPreferences({ ...preferences, emailEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-700 text-amber-600 focus:ring-amber-500 bg-slate-800"
                  />
                </label>
              </div>

              <div className="rounded-md bg-slate-850 p-3 border border-slate-800 space-y-3">
                <h4 className="font-semibold text-slate-200 text-xs flex items-center space-x-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Categorías Institucionales</span>
                </h4>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Convocatorias y Sesiones Colegiadas</span>
                  <input
                    type="checkbox"
                    checked={preferences.meetingAlerts}
                    onChange={(e) =>
                      setPreferences({ ...preferences, meetingAlerts: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-700 text-amber-600 focus:ring-amber-500 bg-slate-800"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Asignación y Avances de Acuerdos</span>
                  <input
                    type="checkbox"
                    checked={preferences.agreementAlerts}
                    onChange={(e) =>
                      setPreferences({ ...preferences, agreementAlerts: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-700 text-amber-600 focus:ring-amber-500 bg-slate-800"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Publicación Formal de Actas</span>
                  <input
                    type="checkbox"
                    checked={preferences.minutesAlerts}
                    onChange={(e) =>
                      setPreferences({ ...preferences, minutesAlerts: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-700 text-amber-600 focus:ring-amber-500 bg-slate-800"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">Avisos Institucionales Generales</span>
                  <input
                    type="checkbox"
                    checked={preferences.generalAlerts}
                    onChange={(e) =>
                      setPreferences({ ...preferences, generalAlerts: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-700 text-amber-600 focus:ring-amber-500 bg-slate-800"
                  />
                </label>
              </div>
            </div>

            {prefFeedback && (
              <p
                className={`text-xs text-center font-medium ${
                  prefFeedback.includes('exitosamente') ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {prefFeedback}
              </p>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsPrefOpen(false)}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition border border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingPref}
                onClick={handleSavePreferences}
                className="rounded-md bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition shadow-sm disabled:opacity-50"
              >
                {isSavingPref ? 'Guardando...' : 'Guardar Preferencias'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

