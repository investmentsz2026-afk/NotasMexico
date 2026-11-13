'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { MeetingCategoryDto } from '@mexagenda/shared';
import {
  Tag,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Power,
  RefreshCw,
  FolderKanban,
} from 'lucide-react';

export default function MeetingCategoriesPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== 'ROLE_ADMIN') {
      router.push('/meetings');
    }
  }, [user, router]);

  const [categories, setCategories] = useState<MeetingCategoryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Formulario crear / editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColorHex, setFormColorHex] = useState('#0F172A');
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<MeetingCategoryDto[]>('/meeting-categories?includeInactive=true');
      setCategories(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las categorías institucionales.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormColorHex('#0F172A');
    setFormDisplayOrder(categories.length + 1);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: MeetingCategoryDto) => {
    setEditingId(cat.id);
    setFormName(cat.name);
    setFormCode(cat.code);
    setFormDescription(cat.description || '');
    setFormColorHex(cat.colorHex);
    setFormDisplayOrder(cat.displayOrder);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (editingId) {
        await apiFetch(`/meeting-categories/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            colorHex: formColorHex,
            displayOrder: Number(formDisplayOrder),
          }),
        });
        setSuccessMessage('Categoría institucional actualizada exitosamente.');
      } else {
        await apiFetch('/meeting-categories', {
          method: 'POST',
          body: JSON.stringify({
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            description: formDescription.trim() || undefined,
            colorHex: formColorHex,
            displayOrder: Number(formDisplayOrder),
          }),
        });
        setSuccessMessage('Categoría institucional creada exitosamente.');
      }
      setIsModalOpen(false);
      await fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la categoría.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    if (!window.confirm(`¿Desea ${currentActive ? 'desactivar' : 'activar'} esta categoría institucional?`)) {
      return;
    }
    setError(null);
    try {
      await apiFetch(`/meeting-categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !currentActive }),
      });
      setSuccessMessage(`Categoría institucional ${currentActive ? 'desactivada' : 'activada'} correctamente.`);
      await fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Error al modificar el estado de la categoría.');
    }
  };

  if (user && user.role !== 'ROLE_ADMIN') {
    return (
      <div className="py-16 px-4 max-w-xl mx-auto text-center space-y-4">
        <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-sm">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Acceso Restringido a Administradores</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          El módulo de configuración y taxonomía de categorías institucionales está reservado exclusivamente para el perfil Administrador.
        </p>
        <div className="pt-2">
          <Link
            href="/meetings"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Reuniones</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 mb-1.5">
            <Link href="/meetings" className="hover:text-slate-900 transition flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Volver a Reuniones</span>
            </Link>
            <span>/</span>
            <span className="text-teal-700">Configuración</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white font-black shadow-md shadow-teal-500/20">
              <FolderKanban className="h-5 w-5" />
            </div>
            <span>Taxonomía y Categorías de Reuniones</span>
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Gestión de tipos de sesiones colegiadas (Ordinarias, Extraordinarias, Solemnes y Comités para el orden del día).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchCategories}
            className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          {user?.role === 'ROLE_ADMIN' && (
            <button
              onClick={openCreateModal}
              className="btn-3d inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2 text-xs font-bold text-white hover:from-teal-400 hover:to-emerald-500 transition shadow-md shadow-teal-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>+ Nueva Categoría</span>
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="flex items-center space-x-2 rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center space-x-2 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tabla de Categorías 3D */}
      <div className="card-3d overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900">
            Catálogo Institucional ({categories.length})
          </h2>
          <span className="text-xs font-semibold text-slate-500">Orden jerárquico y vigencia operativa</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500 flex items-center justify-center space-x-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            <span>Cargando catálogo institucional...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No se han registrado categorías institucionales.
          </div>
        ) : (
          <>
          {/* Vista Escritorio */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-institutional-border text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-6 py-3">Código</th>
                  <th className="px-6 py-3">Nombre</th>
                  <th className="px-6 py-3">Color Institucional</th>
                  <th className="px-6 py-3">Descripción</th>
                  <th className="px-6 py-3 text-center">Orden</th>
                  <th className="px-6 py-3 text-center">Estado</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-institutional-border font-medium text-slate-600">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      {cat.code}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <span
                          className="h-3 w-3 rounded-full border border-slate-300"
                          style={{ backgroundColor: cat.colorHex }}
                        />
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center space-x-1.5 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 border border-slate-200">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cat.colorHex }}
                        />
                        <span>{cat.colorHex}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                      {cat.description || '—'}
                    </td>
                    <td className="px-6 py-4 text-center font-mono">
                      {cat.displayOrder}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          cat.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {cat.isActive ? 'ACTIVA' : 'INACTIVA'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {user?.role === 'ROLE_ADMIN' && (
                        <>
                          <button
                            onClick={() => openEditModal(cat)}
                            className="inline-flex items-center space-x-1 text-slate-600 hover:text-slate-900 font-semibold p-1"
                            title="Editar"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(cat.id, cat.isActive)}
                            className={`p-1 transition ${
                              cat.isActive
                                ? 'text-rose-500 hover:text-rose-700'
                                : 'text-emerald-600 hover:text-emerald-800'
                            }`}
                            title={cat.isActive ? 'Desactivar' : 'Activar'}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vista Móvil: Cuadrícula de 2 Columnas de Tarjetas 3D Compactas */}
          <div className="grid grid-cols-2 gap-2.5 p-2.5 md:hidden bg-sky-50/40">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="rounded-2xl bg-white border-2 border-slate-300 border-b-[5px] border-b-slate-700 p-3 flex flex-col justify-between space-y-2 shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black text-white truncate"
                      style={{ backgroundColor: cat.colorHex }}
                    >
                      {cat.code}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-black ${
                        cat.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {cat.isActive ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                  </div>

                  <h3 className="text-xs font-black text-slate-900 line-clamp-2">
                    {cat.name}
                  </h3>

                  {cat.description && (
                    <p className="text-[10px] text-slate-500 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                  <span className="text-[9px] font-mono font-bold text-slate-500">
                    Orden #{cat.displayOrder}
                  </span>
                  {user?.role === 'ROLE_ADMIN' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="rounded-lg bg-slate-100 hover:bg-slate-200 p-1.5 text-slate-700 border border-slate-300"
                        title="Editar"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(cat.id, cat.isActive)}
                        className={`rounded-lg p-1.5 border ${
                          cat.isActive
                            ? 'bg-rose-50 text-rose-600 border-rose-200'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        }`}
                        title={cat.isActive ? 'Desactivar' : 'Activar'}
                      >
                        <Power className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-institutional-border">
            <h3 className="text-base font-bold text-institutional-navy mb-4">
              {editingId ? 'Editar Categoría Institucional' : 'Nueva Categoría Institucional'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Sesión Ordinaria de Consejo"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-institutional-navy focus:outline-none"
                />
              </div>

              {!editingId && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Código Identificador (Único) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Ej: ORDINARIA"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase font-mono text-slate-900 focus:border-institutional-navy focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descripción Operativa
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Finalidad y alcance institucional de las sesiones en esta categoría."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-institutional-navy focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Color Institucional
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={formColorHex}
                      onChange={(e) => setFormColorHex(e.target.value)}
                      className="h-8 w-12 rounded cursor-pointer border border-slate-300"
                    />
                    <span className="font-mono text-slate-600">{formColorHex}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Orden de Visualización
                  </label>
                  <input
                    type="number"
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-institutional-navy focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-institutional-navy px-4 py-2 font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

