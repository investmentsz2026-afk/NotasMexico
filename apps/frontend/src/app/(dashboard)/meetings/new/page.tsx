'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../../lib/api-client';
import { MeetingCategoryDto, MeetingDetailDto } from '@mexagenda/shared';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

function NewMeetingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultDateParam = searchParams.get('defaultDate');

  const [categories, setCategories] = useState<MeetingCategoryDto[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos del formulario
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [meetingDate, setMeetingDate] = useState(
    defaultDateParam || new Date().toISOString().split('T')[0],
  );
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [location, setLocation] = useState('Sala de Juntas Principal');
  const [modality, setModality] = useState<'PRESENCIAL' | 'VIRTUAL' | 'HIBRIDA'>('PRESENCIAL');
  const [virtualUrl, setVirtualUrl] = useState('');
  const [timezone, setTimezone] = useState('America/Mexico_City');
  const [description, setDescription] = useState('');
  const [initialStatus, setInitialStatus] = useState<'BORRADOR' | 'PROGRAMADA'>('PROGRAMADA');

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await apiFetch<MeetingCategoryDto[]>('/meeting-categories');
        setCategories(cats);
        if (cats.length > 0) {
          setCategoryId(cats[0].id);
        }
      } catch (err: any) {
        setError('No fue posible cargar el catálogo de categorías institucionales.');
      } finally {
        setIsLoadingCategories(false);
      }
    }
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validación de horario
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (endMins <= startMins) {
      setError('La hora de finalización debe ser estrictamente posterior a la hora de inicio.');
      return;
    }

    if (!categoryId) {
      setError('Debe seleccionar una categoría institucional válida.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        categoryId,
        meetingDate,
        startTime,
        endTime,
        location: location.trim(),
        modality,
        virtualUrl: virtualUrl.trim() || undefined,
        timezone,
        description: description.trim() || undefined,
        status: initialStatus,
      };

      const created = await apiFetch<MeetingDetailDto>('/meetings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      router.push(`/meetings/${created.id}`);
    } catch (err: any) {
      if (err instanceof ApiClientError && err.problem?.invalidParams?.length) {
        const details = err.problem.invalidParams.map((p) => p.reason).join(' • ');
        setError(`${err.message}: ${details}`);
      } else {
        setError(err.message || 'Error al programar la reunión institucional.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-2">
          <Link href="/meetings" className="hover:text-amber-700 transition flex items-center gap-1 font-bold">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver a Reuniones</span>
          </Link>
          <span>/</span>
          <span>Nueva Sesión</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-3 shadow-lg shadow-amber-500/25 text-white ring-4 ring-amber-50">
            <Calendar className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Programar Nueva Reunión Institucional
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
              Registre los parámetros colegiados, convocatoria inicial y orden del día.
            </p>
          </div>
        </div>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="flex items-center space-x-2 rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-xl border border-institutional-border p-6 shadow-sm">
        {/* Sección: Datos Generales */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-institutional-navy border-b border-slate-100 pb-2">
            1. Identificación y Taxonomía de la Sesión
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título o Asunto de la Reunión *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Primera Sesión Ordinaria del Consejo Directivo 2026"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-institutional-navy focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría Institucional *
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isLoadingCategories}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-institutional-navy focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estado Inicial del Registro
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-institutional-navy focus:outline-none"
              >
                <option value="PROGRAMADA">PROGRAMADA (Oficialmente agendada)</option>
                <option value="BORRADOR">BORRADOR (Trabajo interno previo)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sección: Cronograma y Ubicación */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-sm font-bold text-institutional-navy border-b border-slate-100 pb-2">
            2. Programación, Horario y Modalidad
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha de la Reunión *
              </label>
              <input
                type="date"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-institutional-navy focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hora de Inicio *
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-institutional-navy focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hora Estimada de Conclusión *
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-institutional-navy focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Modalidad de la Sesión *
              </label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-institutional-navy focus:outline-none"
              >
                <option value="PRESENCIAL">Presencial</option>
                <option value="VIRTUAL">Virtual (Videoconferencia)</option>
                <option value="HIBRIDA">Híbrida (Presencial y Remota)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sede / Recinto o Enlace *
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej: Sala de Juntas A, Piso 3"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-institutional-navy focus:outline-none"
              />
            </div>
          </div>

          {(modality === 'VIRTUAL' || modality === 'HIBRIDA') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enlace de Videoconferencia (Seguro)
              </label>
              <input
                type="url"
                value={virtualUrl}
                onChange={(e) => setVirtualUrl(e.target.value)}
                placeholder="https://meet.google.com/... o enlace privado"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-institutional-navy focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Zona Horaria Institucional
            </label>
            <input
              type="text"
              readOnly
              value={timezone}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600"
            />
          </div>
        </div>

        {/* Sección: Descripción u Observaciones */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-sm font-bold text-institutional-navy border-b border-slate-100 pb-2">
            3. Contexto y Objetivos Institucionales
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descripción o Antecedentes de la Convocatoria
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Indique los asuntos prioritarios a tratar o contexto colegiado."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-institutional-navy focus:outline-none"
            />
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100">
          <Link
            href="/meetings"
            className="btn-3d rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-3d inline-flex items-center space-x-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition disabled:opacity-50 shadow-md shadow-amber-500/20"
          >
            {isSubmitting ? 'Guardando...' : 'Crear y Continuar a Orden del Día'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewMeetingPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-slate-500">
          Cargando formulario institucional...
        </div>
      }
    >
      <NewMeetingForm />
    </Suspense>
  );
}
