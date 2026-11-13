'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import {
  MeetingListItem,
  MeetingDetailDto,
  AgreementDetailDto,
  AgreementPriority,
  AgreementType,
} from '@mexagenda/shared';
import {
  FileCheck2,
  Calendar,
  Clock,
  ArrowLeft,
  Save,
  AlertCircle,
  HelpCircle,
  Users,
  CheckCircle2,
  Tag,
} from 'lucide-react';

interface AssignableUser {
  id: string;
  fullName: string;
  email: string;
  position?: string | null;
}

function NewAgreementFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultMeetingId = searchParams.get('meetingId') || '';
  const defaultAgendaItemId = searchParams.get('agendaItemId') || '';

  const { user } = useAuth();

  // Estados de datos
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [selectedMeetingDetail, setSelectedMeetingDetail] = useState<MeetingDetailDto | null>(null);
  const [users, setUsers] = useState<AssignableUser[]>([]);

  // Estados de formulario
  const [meetingId, setMeetingId] = useState(defaultMeetingId);
  const [agendaItemId, setAgendaItemId] = useState(defaultAgendaItemId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agreementType, setAgreementType] = useState<string>('ACUERDO_ORDINARIO');
  const [priority, setPriority] = useState<AgreementPriority>(AgreementPriority.MEDIA);
  const [assignedToId, setAssignedToId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [observations, setObservations] = useState('');

  // Estados de UI
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar reuniones disponibles
  useEffect(() => {
    async function loadMeetings() {
      try {
        const res = await apiFetch<any>('/meetings?limit=100');
        const list = Array.isArray(res) ? res : res?.items || res?.data || [];
        setMeetings(list);
      } catch (err: any) {
        console.error('Error cargando reuniones:', err);
      } finally {
        setIsLoadingMeetings(false);
      }
    }
    loadMeetings();
  }, []);

  // Cargar usuarios asignables
  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await apiFetch<AssignableUser[]>('/agreements/users');
        setUsers(res || []);
        if (res && res.length > 0 && !assignedToId) {
          // Si el usuario actual está en la lista, pre-seleccionarlo
          const currentUserMatch = res.find((u) => u.id === user?.id);
          if (currentUserMatch) {
            setAssignedToId(currentUserMatch.id);
          } else {
            setAssignedToId(res[0].id);
          }
        }
      } catch (err: any) {
        console.error('Error cargando usuarios asignables:', err);
      } finally {
        setIsLoadingUsers(false);
      }
    }
    loadUsers();
  }, [user]);

  // Al cambiar la reunión, cargar sus puntos de orden del día
  useEffect(() => {
    if (!meetingId) {
      setSelectedMeetingDetail(null);
      return;
    }
    async function loadMeetingDetail() {
      try {
        const data = await apiFetch<MeetingDetailDto>(`/meetings/${meetingId}`);
        setSelectedMeetingDetail(data);
      } catch (err) {
        console.error('Error cargando detalle de reunión:', err);
      }
    }
    loadMeetingDetail();
  }, [meetingId]);

  // Validaciones y Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!meetingId) {
      setError('Debes seleccionar la reunión institucional de origen.');
      return;
    }
    if (!title.trim() || title.trim().length < 3) {
      setError('El título del acuerdo debe contener al menos 3 caracteres.');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setError('La descripción institucional del acuerdo debe contener al menos 10 caracteres.');
      return;
    }
    if (!assignedToId) {
      setError('Debes designar un servidor público o miembro responsable del acuerdo.');
      return;
    }
    if (!dueDate) {
      setError('Debes establecer una fecha límite de cumplimiento (vencimiento).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        meetingId,
        title: title.trim(),
        description: description.trim(),
        agreementType,
        priority,
        assignedToId,
        dueDate: new Date(dueDate).toISOString(),
      };

      if (agendaItemId) payload.agendaItemId = agendaItemId;
      if (startDate) payload.startDate = new Date(startDate).toISOString();
      if (observations.trim()) payload.observations = observations.trim();
      if (selectedMeetingDetail?.categoryId) payload.categoryId = selectedMeetingDetail.categoryId;

      const created = await apiFetch<AgreementDetailDto>('/agreements', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      router.push(`/agreements/${created.id}`);
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Error al crear el acuerdo institucional.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Botón Volver y Título 3D */}
      <div className="flex items-center space-x-3 border-b border-slate-200 pb-5">
        <Link
          href="/agreements"
          className="btn-3d rounded-xl bg-white p-2.5 text-slate-700 hover:bg-slate-50 transition border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <span>Registrar Nuevo Acuerdo Institucional</span>
          </h1>
          <p className="text-xs md:text-sm font-semibold text-slate-500 mt-0.5">
            El sistema generará un folio institucional único verificable con trazabilidad inmutable
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-800 flex items-center space-x-3 text-xs md:text-sm font-semibold shadow-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloque 1: Origen Institucional */}
        <div className="card-3d bg-white p-6 sm:p-7 shadow-xl border border-slate-200 rounded-3xl space-y-4">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <Calendar className="h-4 w-4 text-amber-600" />
            <span>1. Origen Colegiado e Institucional</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Reunión de Origen <span className="text-amber-600">*</span>
              </label>
              <select
                value={meetingId}
                onChange={(e) => {
                  setMeetingId(e.target.value);
                  setAgendaItemId('');
                }}
                disabled={isLoadingMeetings}
                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition"
              >
                <option value="">-- Seleccionar reunión colegiada --</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.folio} — {m.title} ({new Date(m.meetingDate).toLocaleDateString('es-MX')})
                  </option>
                ))}
              </select>
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                Todo acuerdo institucional debe emanar formalmente de una sesión colegiada.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Punto del Orden del Día (Opcional)
              </label>
              <select
                value={agendaItemId}
                onChange={(e) => setAgendaItemId(e.target.value)}
                disabled={!selectedMeetingDetail || selectedMeetingDetail.agendaItems?.length === 0}
                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition disabled:opacity-50"
              >
                <option value="">-- Sin vinculación específica a un punto --</option>
                {selectedMeetingDetail?.agendaItems?.map((it) => (
                  <option key={it.id} value={it.id}>
                    #{it.orderIndex} — {it.title}
                  </option>
                ))}
              </select>
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                Vincula el acuerdo directamente al tema deliberado en la orden del día.
              </p>
            </div>
          </div>
        </div>

        {/* Bloque 2: Definición del Acuerdo */}
        <div className="card-3d bg-white p-6 sm:p-7 shadow-xl border border-slate-200 rounded-3xl space-y-4">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <Tag className="h-4 w-4 text-sky-600" />
            <span>2. Definición del Acuerdo</span>
          </h2>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Título o Síntesis del Acuerdo <span className="text-amber-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Aprobación del dictamen de reforma presupuestal ejercicio 2026..."
              className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Descripción y Alcance Institucional <span className="text-amber-600">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalla de manera exhaustiva el mandato, alcances, entregables requeridos y condiciones del acuerdo colegiado..."
              className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tipo de Acuerdo
              </label>
              <select
                value={agreementType}
                onChange={(e) => setAgreementType(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition"
              >
                <option value="ACUERDO_ORDINARIO">Acuerdo Ordinario</option>
                <option value="ACUERDO_EXTRAORDINARIO">Acuerdo Extraordinario</option>
                <option value="MANDATO_DIRECTIVO">Mandato Directivo</option>
                <option value="RESOLUCION_COLEGIADA">Resolución Colegiada</option>
                <option value="SEGUIMIENTO_ESPECIAL">Seguimiento Especial</option>
                <option value="OTRO">Otro Carácter</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nivel de Prioridad
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as AgreementPriority)}
                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition"
              >
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bloque 3: Asignación y Plazos */}
        <div className="card-3d bg-white p-6 sm:p-7 shadow-xl border border-slate-200 rounded-3xl space-y-4">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <Users className="h-4 w-4 text-emerald-600" />
            <span>3. Asignación y Calendario de Cumplimiento</span>
          </h2>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Responsable Principal <span className="text-amber-600">*</span>
            </label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              disabled={isLoadingUsers}
              className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition"
            >
              <option value="">-- Designar servidor o responsable --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.email}){u.position ? ` — ${u.position}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] font-medium text-slate-500 mt-1">
              Servidor público o miembro institucional con la encomienda principal de reportar avances y asegurar el cumplimiento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Fecha de Inicio de Ejecución (Opcional)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Fecha Límite de Cumplimiento (Vencimiento) <span className="text-amber-600">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition"
              />
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                Al sobrepasar esta fecha sin ser formalmente cumplido, el acuerdo pasará a estado VENCIDO.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Observaciones Iniciales o Instrucciones Particulares (Opcional)
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Instrucciones colegiadas, condicionantes previas o precisiones sobre el plazo..."
              className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:outline-none transition"
            />
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <Link
            href="/agreements"
            className="rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition border border-slate-300"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-3d inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 px-6 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 transition"
          >
            <Save className="h-4 w-4" />
            <span>{isSubmitting ? 'Generando Acuerdo Institucional...' : 'Crear Acuerdo Institucional'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewAgreementPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-slate-500">
          Cargando formulario institucional de acuerdos...
        </div>
      }
    >
      <NewAgreementFormContent />
    </Suspense>
  );
}
