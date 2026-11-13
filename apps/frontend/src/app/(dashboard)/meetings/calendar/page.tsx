'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api-client';
import { MeetingListItem, PaginatedResponse, MeetingCategoryDto } from '@mexagenda/shared';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Clock,
  MapPin,
  Video,
  Plus,
  Eye,
} from 'lucide-react';

export default function MeetingsCalendarPage() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [categories, setCategories] = useState<MeetingCategoryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fecha actual del calendario (año y mes)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0..11

  const fetchMonthMeetings = async () => {
    setIsLoading(true);
    try {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];

      const res = await apiFetch<PaginatedResponse<MeetingListItem>>(
        `/meetings?startDate=${startDate}&endDate=${endDate}&limit=100`,
      );
      setMeetings(res.items);
    } catch {
      // Ignorar fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthMeetings();
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Nombres de meses y días en español
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // Generar cuadrícula del mes
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0..6
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: Array<{ dayNumber: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push({ dayNumber: null, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    calendarDays.push({ dayNumber: d, dateStr: `${year}-${mm}-${dd}` });
  }

  // Agrupar reuniones por fecha YYYY-MM-DD
  const meetingsByDate: Record<string, MeetingListItem[]> = {};
  for (const m of meetings) {
    const d = m.meetingDate;
    if (!meetingsByDate[d]) meetingsByDate[d] = [];
    meetingsByDate[d].push(m);
  }

  const selectedDayMeetings = meetingsByDate[selectedDateStr] || [];

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-institutional-border pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-1">
            <Link href="/meetings" className="hover:text-institutional-navy transition flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Volver a Lista de Reuniones</span>
            </Link>
            <span>/</span>
            <span>Calendario</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-institutional-navy flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-institutional-navy" />
            <span>Calendario Institucional de Sesiones</span>
          </h1>
          <p className="text-sm text-institutional-muted mt-1">
            Programación cronológica de sesiones colegiadas y comités.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleToday}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Hoy
          </button>
          <div className="flex items-center space-x-1 border border-slate-300 rounded-lg bg-white p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-100 rounded text-slate-600 transition"
              title="Mes Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-bold text-slate-800 min-w-[110px] sm:min-w-[120px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-100 rounded text-slate-600 transition"
              title="Mes Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Link
            href="/meetings/new"
            className="inline-flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:from-blue-500 hover:to-sky-500 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nueva Sesión</span>
          </Link>
        </div>
      </div>

      {/* Cuadrícula Principal del Calendario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 rounded-2xl border-2 border-slate-300 border-b-[6px] border-b-slate-700 bg-white p-2.5 sm:p-5 shadow-md">
          <div className="grid grid-cols-7 gap-px text-center text-[10px] sm:text-xs font-bold text-slate-600 border-b border-slate-200 pb-2 sm:pb-3 mb-2">
            {dayNames.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cd, idx) => {
              if (!cd.dayNumber || !cd.dateStr) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[48px] sm:min-h-[75px] rounded-lg bg-slate-50/50 p-1 sm:p-2 opacity-50"
                  />
                );
              }

              const hasMeetings = meetingsByDate[cd.dateStr];
              const isSelected = selectedDateStr === cd.dateStr;
              const isToday = cd.dateStr === new Date().toISOString().split('T')[0];

              return (
                <button
                  key={cd.dateStr}
                  onClick={() => setSelectedDateStr(cd.dateStr!)}
                  className={`min-h-[48px] sm:min-h-[75px] rounded-lg p-1 sm:p-2 text-left transition flex flex-col justify-between border ${
                    isSelected
                      ? 'border-blue-600 bg-sky-50 ring-2 ring-blue-500/20'
                      : isToday
                      ? 'border-amber-400 bg-amber-50/40'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] sm:text-xs font-bold ${
                        isToday ? 'text-amber-800' : 'text-slate-700'
                      }`}
                    >
                      {cd.dayNumber}
                    </span>
                    {hasMeetings && (
                      <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-blue-600" />
                    )}
                  </div>

                  {hasMeetings && (
                    <div className="space-y-0.5 sm:space-y-1 mt-0.5 sm:mt-1">
                      {hasMeetings.slice(0, 2).map((m) => (
                        <div
                          key={m.id}
                          className="truncate rounded px-1 py-0.5 text-[8px] sm:text-[9px] font-semibold text-white shadow-2xs"
                          style={{ backgroundColor: m.category.colorHex }}
                          title={m.title}
                        >
                          {m.folio}
                        </div>
                      ))}
                      {hasMeetings.length > 2 && (
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400">
                          +{hasMeetings.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel Lateral: Sesiones del Día Seleccionado */}
        <div className="rounded-2xl border-2 border-slate-300 border-b-[6px] border-b-slate-700 bg-white p-3.5 sm:p-5 shadow-md space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Sesiones para el Día
              </h2>
              <span className="text-xs font-semibold text-slate-500 font-mono">
                {selectedDateStr}
              </span>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">
              {selectedDayMeetings.length}
            </span>
          </div>

          {selectedDayMeetings.length === 0 ? (
            <div className="py-8 sm:py-12 text-center text-xs text-slate-400 space-y-2">
              <p>No hay sesiones programadas en esta fecha.</p>
              <Link
                href={`/meetings/new?defaultDate=${selectedDateStr}`}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                <Plus className="h-3 w-3" />
                <span>Programar para este día</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 sm:gap-3">
              {selectedDayMeetings.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border-2 border-slate-300 border-b-4 border-b-blue-700 p-2.5 sm:p-3 space-y-2 hover:border-blue-500 transition flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-slate-800">
                      {m.folio}
                    </span>
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: m.category.colorHex }}
                    >
                      {m.category.name}
                    </span>
                  </div>

                  <Link
                    href={`/meetings/${m.id}`}
                    className="block text-xs font-bold text-slate-900 hover:text-amber-700 transition"
                  >
                    {m.title}
                  </Link>

                  <div className="text-[11px] text-slate-500 space-y-1">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="font-mono">
                        {m.startTime} — {m.endTime}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {m.modality === 'VIRTUAL' ? (
                        <Video className="h-3 w-3 text-slate-400" />
                      ) : (
                        <MapPin className="h-3 w-3 text-slate-400" />
                      )}
                      <span className="truncate">{m.location}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400">
                      {m.status}
                    </span>
                    <Link
                      href={`/meetings/${m.id}`}
                      className="inline-flex items-center space-x-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ver Sesión</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

