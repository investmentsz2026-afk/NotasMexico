'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api-client';
import {
  Calendar,
  CalendarDays,
  FileCheck2,
  BookOpen,
  FolderLock,
  BarChart3,
  ArrowRight,
  Plus,
  Upload,
  UserCheck,
  Building2,
  Clock,
  MapPin,
  Sparkles,
  Key,
  Tag,
  Users,
  Layers,
} from 'lucide-react';

interface RecentMeetingItem {
  id: string;
  folio: string;
  title: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  status: string;
  category?: {
    name: string;
    colorHex: string;
  };
}

export default function HomePage() {
  const { user, isLoading } = useAuth();

  const [stats, setStats] = useState({
    meetings: 0,
    agreements: 0,
    documents: 0,
    notes: 0,
  });
  const [recentMeetings, setRecentMeetings] = useState<RecentMeetingItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function loadPortalSummary() {
      setLoadingData(true);
      try {
        const [mRes, aRes, dRes, nRes] = await Promise.all([
          apiFetch<any>('/meetings?limit=5').catch(() => null),
          apiFetch<any>('/agreements?limit=5').catch(() => null),
          apiFetch<any>('/documents?limit=5').catch(() => null),
          apiFetch<any>('/notes?limit=5').catch(() => null),
        ]);

        setStats({
          meetings: mRes?.meta?.total ?? mRes?.items?.length ?? 0,
          agreements: aRes?.meta?.total ?? aRes?.items?.length ?? 0,
          documents: dRes?.meta?.total ?? dRes?.items?.length ?? 0,
          notes: nRes?.meta?.total ?? nRes?.items?.length ?? 0,
        });

        if (mRes?.items) {
          setRecentMeetings(mRes.items.slice(0, 4));
        }
      } finally {
        setLoadingData(false);
      }
    }

    loadPortalSummary();
  }, [user]);

  const formattedToday = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center min-h-[50vh]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#dbeafe] via-[#eaf2fd] to-[#e2edfb] text-slate-800 relative pb-16">
      {/* Luces Ambientales Luminosas y Suaves de Fondo */}
      <div className="pointer-events-none absolute top-0 left-10 sm:left-1/4 h-80 sm:h-96 w-80 sm:w-96 rounded-full bg-white/60 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 right-4 sm:right-16 h-80 sm:h-96 w-80 sm:w-96 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 left-10 h-72 w-72 rounded-full bg-blue-100/50 blur-3xl" />

      <div className="relative z-10 py-4 sm:py-8 px-2.5 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 sm:space-y-9">
        {/* Banner Ejecutivo 3D Corporativo (Vibrante, Luminoso y Responsive) */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 text-white p-4 sm:p-8 lg:p-10 border-2 border-sky-300 border-b-[6px] sm:border-b-[8px] border-b-blue-950 shadow-[0_16px_36px_-8px_rgba(29,78,216,0.3)]">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-8">
            <div className="space-y-2.5 sm:space-y-4 max-w-2xl">
              <div className="inline-flex items-center space-x-1.5 sm:space-x-2 rounded-full bg-slate-900/40 backdrop-blur-md px-3 py-1 sm:px-4 sm:py-1.5 text-[10px] sm:text-xs font-bold text-amber-300 border border-amber-300/40 shadow-sm capitalize">
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-300 shrink-0" />
                <span className="truncate">{formattedToday}</span>
              </div>

              {user ? (
                <>
                  <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-sm leading-tight">
                    Bienvenido(a), {user.firstName} {user.lastName}
                  </h1>
                  <p className="text-xs sm:text-base text-sky-50 font-medium leading-relaxed">
                    Portal Ejecutivo de Gobernanza Institucional, Sesiones Colegiadas y Seguimiento de Acuerdos.
                  </p>
                  <div className="pt-0.5 flex flex-wrap items-center gap-2 text-[10px] sm:text-xs">
                    <span className="inline-flex items-center space-x-1 rounded-full bg-slate-900/50 text-amber-200 border border-amber-400/40 border-b-2 sm:border-b-[3px] border-b-slate-950 px-2.5 py-1 sm:px-3.5 sm:py-1.5 font-bold shadow-sm">
                      <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-300 shrink-0" />
                      <span className="truncate max-w-[140px] sm:max-w-none">
                        {user.position || 'Integrante Institucional'}
                      </span>
                    </span>
                    <span className="inline-flex items-center space-x-1 rounded-full bg-sky-500/90 text-white border border-sky-200 border-b-2 sm:border-b-[3px] border-b-blue-900 px-2.5 py-1 sm:px-3.5 sm:py-1.5 font-bold shadow-sm">
                      <UserCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white shrink-0" />
                      <span>
                        {user.role === 'ROLE_ADMIN'
                          ? 'Administrador General'
                          : 'Integrante Colegiado'}
                      </span>
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-sm">
                    MexAgenda — Gestión Institucional
                  </h1>
                  <p className="text-xs sm:text-base text-sky-50 font-medium leading-relaxed">
                    Plataforma ejecutiva para sesiones colegiadas, acuerdos, bóveda documental y bitácora institucional.
                  </p>
                </>
              )}
            </div>

            {/* Botones 3D Corporativos (En cuadrícula compacta para móvil) */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 shrink-0">
              {user ? (
                <>
                  <Link
                    href="/meetings/new"
                    className="col-span-2 sm:col-span-1 inline-flex items-center justify-center space-x-1.5 rounded-xl sm:rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 px-4 py-2.5 sm:px-5 sm:py-3.5 text-xs sm:text-sm font-black text-slate-950 border-2 border-amber-200 border-b-4 sm:border-b-[5px] border-b-amber-700 shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    <Plus className="h-4 w-4 stroke-[3] shrink-0" />
                    <span>Nueva Reunión</span>
                  </Link>
                  <Link
                    href="/vault"
                    className="inline-flex items-center justify-center space-x-1.5 rounded-xl sm:rounded-2xl bg-slate-800/90 hover:bg-slate-750 px-3 py-2.5 sm:px-5 sm:py-3.5 text-xs sm:text-sm font-bold text-white border-2 border-slate-500 border-b-4 sm:border-b-[5px] border-b-slate-950 shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-sky-300" />
                    <span className="truncate">Subir Bóveda</span>
                  </Link>
                  <Link
                    href="/reports"
                    className="inline-flex items-center justify-center space-x-1.5 rounded-xl sm:rounded-2xl bg-blue-800/90 hover:bg-blue-700 px-3 py-2.5 sm:px-5 sm:py-3.5 text-xs sm:text-sm font-bold text-white border-2 border-sky-300 border-b-4 sm:border-b-[5px] border-b-blue-950 shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-sky-200" />
                    <span className="truncate">Reportes</span>
                  </Link>
                </>
              ) : (
                <Link
                  href="/login"
                  className="col-span-2 inline-flex items-center justify-center space-x-2 rounded-xl sm:rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 px-5 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-black text-slate-950 border-2 border-amber-200 border-b-4 sm:border-b-[5px] border-b-amber-700 shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  <Key className="h-4 w-4" />
                  <span>Iniciar Sesión Institucional</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* 4 Tarjetas KPI 3D Claras, Luminosas y Modernas (grid-cols-2 lg:grid-cols-4) */}
        {user && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
            {/* KPI 1: Reuniones (Celeste Suave / Azul Vívido Claro) */}
            <Link
              href="/meetings"
              className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-sky-50 to-blue-100/90 p-3 sm:p-6 border-2 border-sky-300 border-b-[5px] sm:border-b-[7px] border-b-blue-600 shadow-[0_8px_20px_-4px_rgba(37,99,235,0.18)] hover:border-blue-500 hover:-translate-y-1 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="relative z-10 min-w-0">
                <div className="flex items-center justify-between sm:block">
                  <span className="inline-block rounded-full bg-blue-600 text-white px-2.5 py-0.5 sm:px-3 text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs truncate">
                    Reuniones
                  </span>
                  <div className="flex sm:hidden h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 border border-blue-300 shadow-sm shrink-0">
                    <Calendar className="h-4 w-4 stroke-[2.5]" />
                  </div>
                </div>
                <p className="mt-1.5 sm:mt-3 text-2xl sm:text-4xl font-black text-blue-950">
                  {loadingData ? '—' : stats.meetings}
                </p>
                <span className="mt-1.5 sm:mt-2 inline-flex items-center space-x-1 rounded-full bg-blue-600 group-hover:bg-blue-700 text-white px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold shadow-sm transition">
                  <span className="truncate">Ver agenda</span>
                  <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                </span>
              </div>
              <div className="hidden sm:flex relative z-10 h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 border-2 border-blue-300 border-b-4 border-b-blue-500 p-3 shadow-sm group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                <Calendar className="h-7 w-7 stroke-[2.5]" />
              </div>
            </Link>

            {/* KPI 2: Acuerdos (Plomo Claro / Pizarra Perla) */}
            <Link
              href="/agreements"
              className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-50 to-slate-200/90 p-3 sm:p-6 border-2 border-slate-300 border-b-[5px] sm:border-b-[7px] border-b-slate-600 shadow-[0_8px_20px_-4px_rgba(51,65,85,0.18)] hover:border-slate-500 hover:-translate-y-1 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="relative z-10 min-w-0">
                <div className="flex items-center justify-between sm:block">
                  <span className="inline-block rounded-full bg-slate-700 text-white px-2.5 py-0.5 sm:px-3 text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs truncate">
                    Acuerdos
                  </span>
                  <div className="flex sm:hidden h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-800 border border-slate-300 shadow-sm shrink-0">
                    <FileCheck2 className="h-4 w-4 stroke-[2.5]" />
                  </div>
                </div>
                <p className="mt-1.5 sm:mt-3 text-2xl sm:text-4xl font-black text-slate-900">
                  {loadingData ? '—' : stats.agreements}
                </p>
                <span className="mt-1.5 sm:mt-2 inline-flex items-center space-x-1 rounded-full bg-slate-700 group-hover:bg-amber-500 group-hover:text-slate-950 text-white px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold shadow-sm transition">
                  <span className="truncate">Seguimiento</span>
                  <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                </span>
              </div>
              <div className="hidden sm:flex relative z-10 h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 border-2 border-slate-300 border-b-4 border-b-slate-500 p-3 shadow-sm group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shrink-0">
                <FileCheck2 className="h-7 w-7 stroke-[2.5]" />
              </div>
            </Link>

            {/* KPI 3: Bóveda (Azul Cerúleo Claro / Cian Suave) */}
            <Link
              href="/vault"
              className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-cyan-50 to-sky-100/90 p-3 sm:p-6 border-2 border-sky-300 border-b-[5px] sm:border-b-[7px] border-b-sky-600 shadow-[0_8px_20px_-4px_rgba(2,132,199,0.18)] hover:border-sky-500 hover:-translate-y-1 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="relative z-10 min-w-0">
                <div className="flex items-center justify-between sm:block">
                  <span className="inline-block rounded-full bg-sky-600 text-white px-2.5 py-0.5 sm:px-3 text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs truncate">
                    Bóveda
                  </span>
                  <div className="flex sm:hidden h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 border border-sky-300 shadow-sm shrink-0">
                    <FolderLock className="h-4 w-4 stroke-[2.5]" />
                  </div>
                </div>
                <p className="mt-1.5 sm:mt-3 text-2xl sm:text-4xl font-black text-sky-950">
                  {loadingData ? '—' : stats.documents}
                </p>
                <span className="mt-1.5 sm:mt-2 inline-flex items-center space-x-1 rounded-full bg-sky-600 group-hover:bg-sky-700 text-white px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold shadow-sm transition">
                  <span className="truncate">Ver archivos</span>
                  <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                </span>
              </div>
              <div className="hidden sm:flex relative z-10 h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 border-2 border-sky-300 border-b-4 border-b-sky-500 p-3 shadow-sm group-hover:scale-105 group-hover:bg-sky-600 group-hover:text-white transition-all shrink-0">
                <FolderLock className="h-7 w-7 stroke-[2.5]" />
              </div>
            </Link>

            {/* KPI 4: Anotaciones (Azul Acero Claro / Pizarra Suave) */}
            <Link
              href="/notes"
              className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-indigo-50/70 to-blue-100/80 p-3 sm:p-6 border-2 border-indigo-200 border-b-[5px] sm:border-b-[7px] border-b-indigo-500 shadow-[0_8px_20px_-4px_rgba(79,70,229,0.18)] hover:border-indigo-400 hover:-translate-y-1 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="relative z-10 min-w-0">
                <div className="flex items-center justify-between sm:block">
                  <span className="inline-block rounded-full bg-indigo-600 text-white px-2.5 py-0.5 sm:px-3 text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs truncate">
                    Anotaciones
                  </span>
                  <div className="flex sm:hidden h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm shrink-0">
                    <BookOpen className="h-4 w-4 stroke-[2.5]" />
                  </div>
                </div>
                <p className="mt-1.5 sm:mt-3 text-2xl sm:text-4xl font-black text-indigo-950">
                  {loadingData ? '—' : stats.notes}
                </p>
                <span className="mt-1.5 sm:mt-2 inline-flex items-center space-x-1 rounded-full bg-indigo-600 group-hover:bg-amber-500 group-hover:text-slate-950 text-white px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold shadow-sm transition">
                  <span className="truncate">Ver bitácora</span>
                  <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                </span>
              </div>
              <div className="hidden sm:flex relative z-10 h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 border-2 border-indigo-200 border-b-4 border-b-indigo-400 p-3 shadow-sm group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shrink-0">
                <BookOpen className="h-7 w-7 stroke-[2.5]" />
              </div>
            </Link>
          </div>
        )}

        {/* Módulos Principales de Trabajo (Tarjetas 3D Claras en 2 Columnas para Móvil) */}
        <div className="space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-sky-300 border-b-4 sm:border-b-[6px] border-b-blue-950 shadow-md text-white">
            <div className="flex items-center space-x-2.5 sm:space-x-3">
              <div className="flex h-9 w-9 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-white text-blue-700 border-2 border-sky-200 border-b-4 border-b-blue-300 shadow-md">
                <Layers className="h-4 w-4 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h2 className="text-sm sm:text-xl font-black text-white">
                  Módulos de Gestión Institucional
                </h2>
                <p className="text-[10px] sm:text-xs font-medium text-sky-100">
                  Seleccione un módulo para gestionar sesiones, compromisos, expedientes o reportes.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
            {/* Módulo 1: Reuniones (Tarjeta Clara 3D) */}
            <Link
              href={user ? '/meetings' : '/login'}
              className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-sky-50/80 to-blue-50 p-3 sm:p-6 border-2 border-sky-300 border-b-[5px] sm:border-b-[7px] border-b-blue-500 shadow-md hover:border-blue-500 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-50 text-blue-700 border-2 border-blue-200 border-b-2 sm:border-b-4 border-b-blue-400 p-2 sm:p-3 shadow-sm group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                    <Calendar className="h-4 w-4 sm:h-6 sm:w-6 stroke-[2.5]" />
                  </div>
                  <span className="rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-wider truncate">
                    Sesiones
                  </span>
                </div>
                <h3 className="mt-2.5 sm:mt-5 text-xs sm:text-lg font-black text-slate-900 leading-snug">
                  Reuniones y Sesiones
                </h3>
                <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-slate-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Programe sesiones, emita convocatorias, gestione el orden del día y asistencia en vivo.
                </p>
              </div>
              <div className="mt-3 sm:mt-6">
                <span className="inline-flex w-full items-center justify-between rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 px-2.5 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black text-white border border-sky-300 border-b-2 sm:border-b-4 border-b-blue-900 shadow-sm transition-all">
                  <span className="truncate">Entrar</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                </span>
              </div>
            </Link>

            {/* Módulo 2: Acuerdos (Tarjeta Plomo Claro 3D) */}
            <Link
              href={user ? '/agreements' : '/login'}
              className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-50 to-slate-100 p-3 sm:p-6 border-2 border-slate-300 border-b-[5px] sm:border-b-[7px] border-b-slate-500 shadow-md hover:border-slate-500 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-100 text-slate-700 border-2 border-slate-300 border-b-2 sm:border-b-4 border-b-slate-400 p-2 sm:p-3 shadow-sm group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shrink-0">
                    <FileCheck2 className="h-4 w-4 sm:h-6 sm:w-6 stroke-[2.5]" />
                  </div>
                  <span className="rounded-full bg-slate-200 text-slate-800 border border-slate-300 px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-wider truncate">
                    Acuerdos
                  </span>
                </div>
                <h3 className="mt-2.5 sm:mt-5 text-xs sm:text-lg font-black text-slate-900 leading-snug">
                  Seguimiento de Acuerdos
                </h3>
                <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-slate-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Asigne responsables, fechas compromiso, avances porcentuales y evidencias de cumplimiento.
                </p>
              </div>
              <div className="mt-3 sm:mt-6">
                <span className="inline-flex w-full items-center justify-between rounded-xl sm:rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 px-2.5 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black text-white border border-slate-400 border-b-2 sm:border-b-4 border-b-slate-950 shadow-sm transition-all">
                  <span className="truncate">Entrar</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                </span>
              </div>
            </Link>

            {/* Módulo 3: Bóveda Documental (Tarjeta Clara 3D) */}
            <Link
              href={user ? '/vault' : '/login'}
              className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-cyan-50/80 to-sky-50 p-3 sm:p-6 border-2 border-sky-300 border-b-[5px] sm:border-b-[7px] border-b-sky-600 shadow-md hover:border-sky-500 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-sky-50 text-sky-700 border-2 border-sky-200 border-b-2 sm:border-b-4 border-b-sky-400 p-2 sm:p-3 shadow-sm group-hover:scale-105 group-hover:bg-sky-600 group-hover:text-white transition-all shrink-0">
                    <FolderLock className="h-4 w-4 sm:h-6 sm:w-6 stroke-[2.5]" />
                  </div>
                  <span className="rounded-full bg-sky-100 text-sky-700 border border-sky-200 px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-wider truncate">
                    Archivos
                  </span>
                </div>
                <h3 className="mt-2.5 sm:mt-5 text-xs sm:text-lg font-black text-slate-900 leading-snug">
                  Bóveda Digital
                </h3>
                <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-slate-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Suba archivos, anexos técnicos y dictámenes vinculados al expediente de cada reunión.
                </p>
              </div>
              <div className="mt-3 sm:mt-6">
                <span className="inline-flex w-full items-center justify-between rounded-xl sm:rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 px-2.5 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black text-white border border-sky-300 border-b-2 sm:border-b-4 border-b-blue-900 shadow-sm transition-all">
                  <span className="truncate">Abrir Bóveda</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                </span>
              </div>
            </Link>

            {/* Módulo 4: Anotaciones (Tarjeta Plomo Claro 3D) */}
            <Link
              href={user ? '/notes' : '/login'}
              className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-50 to-indigo-50/70 p-3 sm:p-6 border-2 border-indigo-200 border-b-[5px] sm:border-b-[7px] border-b-indigo-500 shadow-md hover:border-indigo-400 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-700 border-2 border-indigo-200 border-b-2 sm:border-b-4 border-b-indigo-400 p-2 sm:p-3 shadow-sm group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shrink-0">
                    <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 stroke-[2.5]" />
                  </div>
                  <span className="rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-wider truncate">
                    Bitácora
                  </span>
                </div>
                <h3 className="mt-2.5 sm:mt-5 text-xs sm:text-lg font-black text-slate-900 leading-snug">
                  Anotaciones de Sesión
                </h3>
                <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-slate-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Redacte observaciones privadas o compartidas con los integrantes de una sesión.
                </p>
              </div>
              <div className="mt-3 sm:mt-6">
                <span className="inline-flex w-full items-center justify-between rounded-xl sm:rounded-2xl bg-gradient-to-r from-slate-700 to-indigo-700 hover:from-slate-800 hover:to-indigo-800 px-2.5 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black text-white border border-indigo-300 border-b-2 sm:border-b-4 border-b-indigo-950 shadow-sm transition-all">
                  <span className="truncate">Ver Notas</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                </span>
              </div>
            </Link>

            {/* Módulo 5: Reportes y Tableros (Tarjeta Clara 3D) */}
            <Link
              href={user ? '/reports' : '/login'}
              className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-sky-50/80 to-blue-50 p-3 sm:p-6 border-2 border-sky-300 border-b-[5px] sm:border-b-[7px] border-b-blue-600 shadow-md hover:border-blue-500 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-50 text-blue-700 border-2 border-blue-200 border-b-2 sm:border-b-4 border-b-blue-400 p-2 sm:p-3 shadow-sm group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                    <BarChart3 className="h-4 w-4 sm:h-6 sm:w-6 stroke-[2.5]" />
                  </div>
                  <span className="rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-wider truncate">
                    Métricas
                  </span>
                </div>
                <h3 className="mt-2.5 sm:mt-5 text-xs sm:text-lg font-black text-slate-900 leading-snug">
                  Reportes Ejecutivos
                </h3>
                <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-slate-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Consulte indicadores de efectividad, semáforos de vencimiento y asistencia a sesiones.
                </p>
              </div>
              <div className="mt-3 sm:mt-6">
                <span className="inline-flex w-full items-center justify-between rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 px-2.5 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black text-white border border-sky-300 border-b-2 sm:border-b-4 border-b-blue-900 shadow-sm transition-all">
                  <span className="truncate">Ver Reportes</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                </span>
              </div>
            </Link>

            {/* Módulo 6: Calendario (Tarjeta Plomo Claro 3D) */}
            <Link
              href={user ? '/meetings/calendar' : '/login'}
              className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-50 to-slate-100 p-3 sm:p-6 border-2 border-slate-300 border-b-[5px] sm:border-b-[7px] border-b-slate-500 shadow-md hover:border-slate-500 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-100 text-slate-700 border-2 border-slate-300 border-b-2 sm:border-b-4 border-b-slate-400 p-2 sm:p-3 shadow-sm group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shrink-0">
                    <CalendarDays className="h-4 w-4 sm:h-6 sm:w-6 stroke-[2.5]" />
                  </div>
                  <span className="rounded-full bg-slate-200 text-slate-800 border border-slate-300 px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-wider truncate">
                    Agenda
                  </span>
                </div>
                <h3 className="mt-2.5 sm:mt-5 text-xs sm:text-lg font-black text-slate-900 leading-snug">
                  Calendario Mensual
                </h3>
                <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-slate-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Visualice la agenda mensual de sesiones programadas por categoría institucional.
                </p>
              </div>
              <div className="mt-3 sm:mt-6">
                <span className="inline-flex w-full items-center justify-between rounded-xl sm:rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 px-2.5 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black text-white border border-slate-400 border-b-2 sm:border-b-4 border-b-slate-950 shadow-sm transition-all">
                  <span className="truncate">Calendario</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                </span>
              </div>
            </Link>

            {/* Módulos Exclusivos de Administrador */}
            {user?.role === 'ROLE_ADMIN' && (
              <>
                {/* Módulo Admin 7: Categorías (Tarjeta Clara 3D) */}
                <Link
                  href="/meeting-categories"
                  className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-sky-50/80 to-blue-50 p-3 sm:p-6 border-2 border-sky-300 border-b-[5px] sm:border-b-[7px] border-b-blue-600 shadow-md hover:border-blue-500 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-50 text-blue-700 border-2 border-blue-200 border-b-2 sm:border-b-4 border-b-blue-400 p-2 sm:p-3 shadow-sm group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shrink-0">
                        <Tag className="h-4 w-4 sm:h-6 sm:w-6 stroke-[2.5]" />
                      </div>
                      <span className="rounded-full bg-amber-400 text-slate-950 px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-wider border border-amber-300">
                        Admin
                      </span>
                    </div>
                    <h3 className="mt-2.5 sm:mt-5 text-xs sm:text-lg font-black text-slate-900 leading-snug">
                      Categorías de Reunión
                    </h3>
                    <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-slate-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                      Cree y personalice las categorías institucionales con colores e identificadores.
                    </p>
                  </div>
                  <div className="mt-3 sm:mt-6">
                    <span className="inline-flex w-full items-center justify-between rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 px-2.5 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black text-white border border-sky-300 border-b-2 sm:border-b-4 border-b-blue-900 shadow-sm transition-all">
                      <span className="truncate">Categorías</span>
                      <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    </span>
                  </div>
                </Link>

                {/* Módulo Admin 8: Usuarios (Tarjeta Plomo Claro 3D) */}
                <Link
                  href="/users"
                  className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-slate-50 to-slate-100 p-3 sm:p-6 border-2 border-slate-300 border-b-[5px] sm:border-b-[7px] border-b-slate-500 shadow-md hover:border-slate-500 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-100 text-slate-700 border-2 border-slate-300 border-b-2 sm:border-b-4 border-b-slate-400 p-2 sm:p-3 shadow-sm group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shrink-0">
                        <Users className="h-4 w-4 sm:h-6 sm:w-6 stroke-[2.5]" />
                      </div>
                      <span className="rounded-full bg-amber-400 text-slate-950 px-2 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-wider border border-amber-300">
                        Admin
                      </span>
                    </div>
                    <h3 className="mt-2.5 sm:mt-5 text-xs sm:text-lg font-black text-slate-900 leading-snug">
                      Usuarios y Roles
                    </h3>
                    <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium text-slate-600 leading-relaxed line-clamp-2 sm:line-clamp-none">
                      Registre integrantes institucionales y asigne roles de Administrador o Usuario.
                    </p>
                  </div>
                  <div className="mt-3 sm:mt-6">
                    <span className="inline-flex w-full items-center justify-between rounded-xl sm:rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 px-2.5 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black text-white border border-slate-400 border-b-2 sm:border-b-4 border-b-slate-950 shadow-sm transition-all">
                      <span className="truncate">Usuarios</span>
                      <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    </span>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Sección Inferior: Próximas Reuniones / Sesiones Recientes (Tarjeta Clara 3D) */}
        {user && (
          <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-sky-50/70 to-blue-50/70 p-3.5 sm:p-7 border-2 border-sky-300 border-b-[5px] sm:border-b-[8px] border-b-blue-500 shadow-lg space-y-4 sm:space-y-5 text-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b-2 border-sky-200/80 pb-3 sm:pb-4">
              <div>
                <h2 className="text-sm sm:text-lg font-black text-slate-900">
                  Sesiones y Reuniones Recientes
                </h2>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-600">
                  Toque cualquier reunión para ver asistencia, archivos de bóveda y anotaciones.
                </p>
              </div>
              <Link
                href="/meetings/new"
                className="inline-flex items-center justify-center space-x-1.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs font-black text-slate-950 border-2 border-amber-200 border-b-4 border-b-amber-700 hover:scale-105 transition shadow-md self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
                <span>Programar Reunión</span>
              </Link>
            </div>

            {recentMeetings.length === 0 ? (
              <div className="py-8 text-center space-y-3 bg-white/90 rounded-2xl border-2 border-dashed border-sky-200 p-4 sm:p-6 text-slate-600">
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 mx-auto" />
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-black text-slate-900">
                    Aún no hay reuniones registradas
                  </p>
                  <p className="text-[11px] sm:text-xs font-semibold text-slate-600">
                    Comience programando la primera sesión institucional.
                  </p>
                </div>
                <Link
                  href="/meetings/new"
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-black text-slate-950 border-2 border-amber-200 border-b-4 border-b-amber-700 hover:scale-105 transition shadow-md"
                >
                  <Plus className="h-4 w-4" />
                  <span>Crear Primera Reunión</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-5">
                {recentMeetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="group rounded-xl sm:rounded-2xl bg-white hover:bg-sky-50/60 border-2 border-slate-200 border-b-[4px] sm:border-b-[6px] border-b-slate-400 hover:border-blue-400 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between space-y-2 sm:space-y-3 shadow-sm p-3 sm:p-5"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="rounded-md bg-sky-50 border border-sky-200 px-1.5 py-0.5 sm:px-2.5 font-mono text-[9px] sm:text-xs font-black text-blue-700 truncate">
                          {m.folio}
                        </span>
                        {m.category && (
                          <span
                            className="rounded-full px-2 py-0.5 sm:px-3 text-[8px] sm:text-[10px] font-black text-white border border-white/50 shadow-xs uppercase tracking-wider truncate max-w-full"
                            style={{ backgroundColor: m.category.colorHex }}
                          >
                            {m.category.name}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs sm:text-base font-black text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                        {m.title}
                      </h3>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-3 text-[10px] sm:text-xs font-bold text-slate-600 pt-2 border-t border-slate-200">
                      <span className="inline-flex items-center gap-1 text-blue-700 truncate">
                        <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{m.meetingDate}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-600 truncate">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">
                          {m.startTime} - {m.endTime}
                        </span>
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1 text-amber-700 truncate max-w-[190px]">
                        <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">{m.location}</span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
