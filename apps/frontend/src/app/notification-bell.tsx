'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, ExternalLink, Calendar, FileCheck, BookOpen, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api-client';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Cargar contador de no leídas
  const fetchUnreadCount = async () => {
    try {
      const res = await apiFetch<{ data: { unreadCount: number } }>('/notifications/unread-count');
      if (res?.data) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // Ignorar errores de sondeo en segundo plano
    }
  };

  // Cargar notificaciones recientes al abrir el panel
  const fetchRecent = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: { items: NotificationItem[] } }>('/notifications?limit=5');
      if (res?.data?.items) {
        setRecentNotifications(res.data.items);
      }
    } catch {
      // Silencioso
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleOpen = () => {
    if (!isOpen) {
      fetchRecent();
    }
    setIsOpen(!isOpen);
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, actionUrl?: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (actionUrl) {
        setIsOpen(false);
        router.push(actionUrl);
      }
    } catch {
      // Silencioso
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Silencioso
    }
  };

  const getIconForType = (type: string) => {
    if (type.startsWith('REUNION_')) return <Calendar className="h-3.5 w-3.5 text-amber-400" />;
    if (type.startsWith('ACUERDO_')) return <FileCheck className="h-3.5 w-3.5 text-emerald-400" />;
    if (type.startsWith('NOTA_')) return <BookOpen className="h-3.5 w-3.5 text-cyan-400" />;
    return <AlertCircle className="h-3.5 w-3.5 text-slate-400" />;
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        onClick={toggleOpen}
        title="Notificaciones Institucionales"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/80 text-amber-300 hover:bg-slate-700 hover:text-amber-200 border-2 border-slate-500/60 border-b-4 border-b-slate-950 shadow-md hover:scale-105 active:scale-95 transition-all focus:outline-none"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 rounded-2xl bg-slate-900 border-2 border-slate-600 border-b-4 border-b-slate-950 shadow-2xl z-50 overflow-hidden text-xs">
          {/* Cabecera del Panel */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-850 px-4 py-2.5">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-200">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/30">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] text-slate-400 hover:text-amber-400 transition"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* Lista de Notificaciones Recientes */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {isLoading ? (
              <div className="p-4 text-center text-slate-400">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent mr-2 align-middle" />
                Cargando avisos...
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
                No hay notificaciones pendientes
              </div>
            ) : (
              recentNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id, notif.actionUrl)}
                  className={`p-3 transition cursor-pointer flex items-start space-x-3 hover:bg-slate-800/80 ${
                    !notif.isRead ? 'bg-amber-950/20 border-l-2 border-amber-500' : 'opacity-85'
                  }`}
                >
                  <div className="mt-0.5 rounded p-1 bg-slate-800 border border-slate-700">
                    {getIconForType(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${!notif.isRead ? 'text-slate-100 font-semibold' : 'text-slate-300'}`}>
                      {notif.title}
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {new Date(notif.createdAt).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {!notif.isRead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif.id);
                      }}
                      title="Marcar como leída"
                      className="text-slate-400 hover:text-amber-400 p-1"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pie del Panel */}
          <div className="border-t border-slate-800 bg-slate-850 p-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition py-1"
            >
              <span>Ver centro de notificaciones</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

