'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../../lib/api-client';
import {
  NoteCategory,
  NoteType,
  NoteVisibility,
  PersonalNoteDetailDto,
} from '@mexagenda/shared';
import {
  BookOpen,
  ArrowLeft,
  Save,
  AlertTriangle,
  Calendar,
  FileCheck2,
  Tag,
  Star,
  Lock,
  Globe,
  Users,
} from 'lucide-react';

function NewNoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>(NoteCategory.GENERAL);
  const [noteType, setNoteType] = useState<NoteType>(NoteType.PERSONAL);
  const [visibility, setVisibility] = useState<NoteVisibility>(NoteVisibility.PRIVADA);
  const [isFavorite, setIsFavorite] = useState(false);
  const [tags, setTags] = useState('');

  // Vínculos institucionales opcionales
  const [meetingId, setMeetingId] = useState(searchParams.get('meetingId') || '');
  const [agendaItemId, setAgendaItemId] = useState(searchParams.get('agendaItemId') || '');
  const [agreementId, setAgreementId] = useState(searchParams.get('agreementId') || '');

  // Opciones de reuniones para desplegable
  const [availableMeetings, setAvailableMeetings] = useState<Array<{ id: string; folio: string; title: string }>>([]);
  const [availableAgreements, setAvailableAgreements] = useState<Array<{ id: string; folio: string; title: string }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Si viene meetingId por URL, establecer noteType a SESION automáticamente
    if (searchParams.get('meetingId')) {
      setNoteType(NoteType.SESION);
    }

    // Cargar listas breves para vincular
    async function loadLinkableData() {
      try {
        const meetingsRes = await apiFetch<any>('/meetings?limit=50');
        if (meetingsRes?.items) {
          setAvailableMeetings(meetingsRes.items.map((m: any) => ({
            id: m.id,
            folio: m.folio,
            title: m.title,
          })));
        }
      } catch {
        // Fallback no bloqueante
      }

      try {
        const agreementsRes = await apiFetch<any>('/agreements?limit=50');
        if (agreementsRes?.items) {
          setAvailableAgreements(agreementsRes.items.map((a: any) => ({
            id: a.id,
            folio: a.folio,
            title: a.title,
          })));
        }
      } catch {
        // Fallback no bloqueante
      }
    }

    loadLinkableData();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('El título de la anotación es obligatorio.');
      return;
    }
    if (!content.trim()) {
      setErrorMessage('El contenido de la anotación es obligatorio.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: any = {
        title: title.trim(),
        content: content.trim(),
        category,
        noteType,
        visibility,
        isFavorite,
        tags: tags.trim() || undefined,
        meetingId: meetingId || undefined,
        agendaItemId: agendaItemId || undefined,
        agreementId: agreementId || undefined,
      };

      const res = await apiFetch<PersonalNoteDetailDto>('/notes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      router.push(`/notes/${res.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocurrió un error al guardar la anotación.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Botón Volver y Cabecera */}
      <div>
        <Link
          href="/notes"
          className="inline-flex items-center space-x-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver al Catálogo de Anotaciones</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center space-x-2">
          <BookOpen className="h-6 w-6 text-cyan-400" />
          <span>Nueva Anotación Institucional</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Registre notas de trabajo, reflexiones colegiadas o bitácora de seguimiento institucional.
        </p>
      </div>

      {/* Alerta de Error */}
      {errorMessage && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-4 text-sm text-rose-200 flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-700/80 bg-slate-900/60 p-6 shadow-sm backdrop-blur">
        {/* Título */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-1">
            Título Institucional <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={250}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Observaciones preliminares sobre el dictamen financiero"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Metadatos en Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Categoría Temática
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NoteCategory)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value={NoteCategory.GENERAL}>General</option>
              <option value={NoteCategory.JURIDICO}>Jurídico</option>
              <option value={NoteCategory.TECNICO}>Técnico</option>
              <option value={NoteCategory.PRESUPUESTAL}>Presupuestal</option>
              <option value={NoteCategory.ACUERDO}>Acuerdo</option>
              <option value={NoteCategory.SESION}>Sesión</option>
              <option value={NoteCategory.SEGUIMIENTO}>Seguimiento</option>
            </select>
          </div>

          {/* Tipo de Nota */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Tipo de Nota
            </label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as NoteType)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value={NoteType.PERSONAL}>Personal / Individual</option>
              <option value={NoteType.SESION}>Nota de Sesión Colegiada</option>
              <option value={NoteType.OBSERVACION}>Observación Técnica</option>
              <option value={NoteType.PENDIENTE}>Asunto Pendiente</option>
            </select>
          </div>

          {/* Visibilidad */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nivel de Visibilidad
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as NoteVisibility)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value={NoteVisibility.PRIVADA}>Privada (Solo yo)</option>
              <option value={NoteVisibility.REUNION}>Reunión (Participantes convocados)</option>
              <option value={NoteVisibility.PUBLICA}>Pública (Toda la institución)</option>
            </select>
          </div>
        </div>

        {/* Vinculaciones Institucionales */}
        <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Calendar className="h-4 w-4 text-amber-400" />
            <span>Vinculación con Sesiones y Acuerdos (Opcional)</span>
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Vinculación con Reunión */}
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Reunión Colegiada
              </label>
              <select
                value={meetingId}
                onChange={(e) => {
                  setMeetingId(e.target.value);
                  if (e.target.value) setNoteType(NoteType.SESION);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Sin reunión vinculada</option>
                {availableMeetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.folio}] {m.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Vinculación con Acuerdo */}
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Acuerdo Institucional
              </label>
              <select
                value={agreementId}
                onChange={(e) => setAgreementId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Sin acuerdo vinculado</option>
                {availableAgreements.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.folio}] {a.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-1">
            Cuerpo y Detalle de la Anotación <span className="text-rose-400">*</span>
          </label>
          <textarea
            required
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Redacte aquí el contenido institucional de la anotación, observaciones o puntos clave..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans"
          />
        </div>

        {/* Etiquetas y Favorita */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-center">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Etiquetas (separadas por coma)
            </label>
            <input
              type="text"
              maxLength={255}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="financiero, dictamen, 2026"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 pt-4 sm:pt-0">
            <input
              type="checkbox"
              id="isFavorite"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
            />
            <label htmlFor="isFavorite" className="text-xs font-medium text-slate-200 flex items-center space-x-1 cursor-pointer">
              <Star className={`h-3.5 w-3.5 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-slate-400'}`} />
              <span>Marcar inmediatamente como favorita</span>
            </label>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end space-x-3 border-t border-slate-800 pt-6">
          <Link
            href="/notes"
            className="rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 border border-slate-700 transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center space-x-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-500 transition disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSubmitting ? 'Guardando anotación...' : 'Guardar Anotación'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewNotePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        </div>
      }
    >
      <NewNoteForm />
    </Suspense>
  );
}

