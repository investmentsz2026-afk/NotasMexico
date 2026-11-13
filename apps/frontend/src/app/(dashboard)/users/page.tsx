'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  RotateCcw,
  Edit2,
  Trash2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Mail,
  Briefcase,
  Phone,
  UserCheck,
} from 'lucide-react';

interface RoleItem {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  phone?: string | null;
  status: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO' | 'PENDIENTE_ACTIVACION';
  role: {
    id: string;
    code: string;
    name: string;
  };
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal Crear
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFirstName, setCreateFirstName] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPosition, setCreatePosition] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createRoleId, setCreateRoleId] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createStatus, setCreateStatus] = useState<'ACTIVO' | 'PENDIENTE_ACTIVACION'>('ACTIVO');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Modal Editar
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editStatus, setEditStatus] = useState<string>('ACTIVO');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const fetchRoles = async () => {
    try {
      const res = await apiFetch<RoleItem[]>('/users/roles');
      setRoles(res || []);
      if (res && res.length > 0 && !createRoleId) {
        const defaultRole = res.find((r) => r.code === 'ROLE_USER') || res[0];
        setCreateRoleId(defaultRole.id);
      }
    } catch (err: any) {
      console.error('Error cargando roles:', err);
    }
  };

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (roleFilter) params.set('roleId', roleFilter);
      if (statusFilter) params.set('status', statusFilter);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await apiFetch<UserItem[]>(`/users${qs}`);
      setUsers(data || []);
    } catch (err: any) {
      setError(err?.message || 'Error al consultar la nómina de usuarios institucionales.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenCreateModal = () => {
    setCreateFirstName('');
    setCreateLastName('');
    setCreateEmail('');
    setCreatePosition('');
    setCreatePhone('');
    setCreatePassword('');
    setCreateStatus('ACTIVO');
    if (roles.length > 0) {
      const defaultRole = roles.find((r) => r.code === 'ROLE_USER') || roles[0];
      setCreateRoleId(defaultRole.id);
    }
    setError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail.trim() || !createFirstName.trim() || !createLastName.trim() || !createPosition.trim()) {
      setError('Por favor complete todos los campos obligatorios (*).');
      return;
    }
    if (createPassword.length < 8) {
      setError('La contraseña inicial debe tener al menos 8 caracteres.');
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: createEmail.trim().toLowerCase(),
          password: createPassword,
          firstName: createFirstName.trim(),
          lastName: createLastName.trim(),
          position: createPosition.trim(),
          phone: createPhone.trim() || undefined,
          roleId: createRoleId,
          status: createStatus,
        }),
      });

      setSuccessMessage('Usuario institucional registrado exitosamente.');
      setIsCreateModalOpen(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar el nuevo usuario institucional.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleOpenEditModal = (u: UserItem) => {
    setEditingUserId(u.id);
    setEditFirstName(u.firstName);
    setEditLastName(u.lastName);
    setEditEmail(u.email);
    setEditPosition(u.position);
    setEditPhone(u.phone || '');
    setEditRoleId(u.role.id);
    setEditStatus(u.status);
    setEditNewPassword('');
    setError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;

    setIsSubmittingEdit(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const body: any = {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim().toLowerCase(),
        position: editPosition.trim(),
        phone: editPhone.trim() || undefined,
        roleId: editRoleId,
        status: editStatus,
      };

      if (editNewPassword.trim()) {
        if (editNewPassword.trim().length < 8) {
          setError('La nueva contraseña debe tener al menos 8 caracteres.');
          setIsSubmittingEdit(false);
          return;
        }
        body.password = editNewPassword.trim();
      }

      await apiFetch(`/users/${editingUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      setSuccessMessage('Usuario institucional actualizado correctamente.');
      setIsEditModalOpen(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar el usuario institucional.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteUser = async (u: UserItem) => {
    if (u.id === currentUser?.id) {
      alert('No puedes desactivar tu propia cuenta administrativa.');
      return;
    }

    if (!confirm(`¿Confirmas desactivar al usuario ${u.fullName} (${u.email})? Sus sesiones activas serán revocadas inmediatamente.`)) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await apiFetch(`/users/${u.id}`, {
        method: 'DELETE',
      });
      setSuccessMessage(`Usuario ${u.fullName} desactivado correctamente.`);
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || 'Error al desactivar el usuario institucional.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal 3D */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Directorio y Gestión de Usuarios
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Control de Identidad, Nombramientos y Asignación de Roles RBAC
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="btn-3d inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 transition"
        >
          <UserPlus className="h-4 w-4" />
          <span>+ Nuevo Usuario Institucional</span>
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center space-x-2.5 shadow-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center space-x-2.5 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda 3D */}
      <div className="card-3d bg-white p-5 shadow-lg border border-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, apellidos, cargo o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition"
            />
          </div>

          <div className="flex flex-wrap gap-2 sm:items-center">
            {/* Rol */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:border-amber-500 focus:outline-none transition"
            >
              <option value="">Todos los roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>

            {/* Estado */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:border-amber-500 focus:outline-none transition"
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="INACTIVO">Inactivos</option>
              <option value="BLOQUEADO">Bloqueados</option>
              <option value="PENDIENTE_ACTIVACION">Pendiente Activación</option>
            </select>

            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('');
                setStatusFilter('');
              }}
              title="Restablecer filtros"
              className="rounded-xl bg-slate-50 hover:bg-slate-100 p-2 text-slate-600 border border-slate-200 transition"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Usuarios 3D */}
      <div className="card-3d bg-white shadow-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center space-y-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
              <p className="text-xs text-slate-500 font-semibold">Cargando directorio de servidores públicos...</p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No se encontraron usuarios institucionales</h3>
            <p className="text-xs text-slate-500 mt-1">Pruebe ajustando los filtros de búsqueda o registre un nuevo usuario.</p>
          </div>
        ) : (
          <>
          {/* Vista Escritorio */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50/90 font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Servidor Público / Cargo</th>
                  <th className="px-6 py-4">Correo Institucional</th>
                  <th className="px-6 py-4">Rol Asignado</th>
                  <th className="px-6 py-4 text-center">MFA (TOTP)</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {users.map((u) => {
                  const isCurrentUser = u.id === currentUser?.id;
                  const isAdminRole = u.role.code === 'ROLE_ADMIN';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      {/* Nombre y Cargo */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-black text-xs ${
                            isAdminRole
                              ? 'bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 shadow-sm'
                              : 'bg-gradient-to-tr from-sky-400 to-blue-500 text-white shadow-sm'
                          }`}>
                            {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              {isCurrentUser && (
                                <span className="rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black px-1.5 py-0.2">
                                  TÚ
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {u.position || 'Servidor Público'}
                              {u.phone && ` • Tel: ${u.phone}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Correo */}
                      <td className="px-6 py-4 font-mono font-semibold text-slate-800">
                        {u.email}
                      </td>

                      {/* Rol */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center space-x-1 rounded-lg px-2.5 py-1 text-[11px] font-bold border shadow-xs ${
                            isAdminRole
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-sky-100 text-sky-900 border-sky-300'
                          }`}
                        >
                          <Shield className="h-3 w-3 shrink-0" />
                          <span>{u.role.name}</span>
                        </span>
                      </td>

                      {/* MFA */}
                      <td className="px-6 py-4 text-center">
                        {u.mfaEnabled ? (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            <span>Activo</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-slate-100 border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            <ShieldAlert className="h-3 w-3 text-slate-400" />
                            <span>Pendiente</span>
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                            u.status === 'ACTIVO'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : u.status === 'BLOQUEADO'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="btn-3d inline-flex items-center space-x-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-800 transition"
                          title="Editar usuario y rol"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-sky-600" />
                          <span>Editar</span>
                        </button>

                        {!isCurrentUser && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="btn-3d inline-flex items-center space-x-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 transition"
                            title="Desactivar usuario institucional"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Baja</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Móvil: Cuadrícula de 2 Columnas de Tarjetas 3D Compactas */}
          <div className="grid grid-cols-2 gap-2.5 p-2.5 md:hidden bg-sky-50/40">
            {users.map((u) => {
              const isCurrentUser = u.id === currentUser?.id;
              const isAdminRole = u.role.code === 'ROLE_ADMIN';

              return (
                <div
                  key={u.id}
                  className="rounded-2xl bg-white border-2 border-slate-300 border-b-[5px] border-b-slate-700 p-3 flex flex-col justify-between space-y-2.5 shadow-sm"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 border-2 border-white shadow-xs ${
                          isAdminRole
                            ? 'bg-gradient-to-b from-amber-500 to-amber-700 text-white'
                            : 'bg-gradient-to-b from-sky-500 to-blue-700 text-white'
                        }`}
                      >
                        {u.firstName.charAt(0)}
                        {u.lastName.charAt(0)}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-black border ${
                          u.status === 'ACTIVO'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-black text-slate-900 line-clamp-1">
                        {u.fullName}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500 truncate">
                        {u.position || 'Servidor Público'}
                      </p>
                      <p className="text-[9px] font-mono text-blue-700 truncate mt-0.5">
                        {u.email}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center space-x-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold border ${
                        isAdminRole
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-sky-100 text-sky-900 border-sky-300'
                      }`}
                    >
                      <Shield className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{isAdminRole ? 'Admin' : 'Usuario'}</span>
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(u)}
                      className="flex-1 inline-flex items-center justify-center space-x-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-2 py-1.5 text-[10px] font-black text-white border border-sky-200 border-b-2 border-b-blue-950"
                    >
                      <Edit2 className="h-3 w-3 shrink-0" />
                      <span>Editar</span>
                    </button>
                    {!isCurrentUser && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="inline-flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 p-1.5 text-rose-700 border border-rose-200"
                        title="Dar de baja"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      {/* MODAL: CREAR NUEVO USUARIO */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Registrar Nuevo Usuario Institucional
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Asigne credenciales y privilegios conforme al rol institucional.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nombre(s) *
                  </label>
                  <input
                    type="text"
                    required
                    value={createFirstName}
                    onChange={(e) => setCreateFirstName(e.target.value)}
                    placeholder="Ej. Roberto"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    required
                    value={createLastName}
                    onChange={(e) => setCreateLastName(e.target.value)}
                    placeholder="Ej. Sánchez Morales"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Correo Institucional Oficial *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="usuario@institucion.gob.mx"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Cargo o Nombramiento *
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={createPosition}
                      onChange={(e) => setCreatePosition(e.target.value)}
                      placeholder="Ej. Consejero Vocal"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Teléfono Institucional
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      value={createPhone}
                      onChange={(e) => setCreatePhone(e.target.value)}
                      placeholder="+52 55 1234 5678"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Rol Institucional (RBAC) *
                  </label>
                  <select
                    required
                    value={createRoleId}
                    onChange={(e) => setCreateRoleId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Estado Inicial
                  </label>
                  <select
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition"
                  >
                    <option value="ACTIVO">ACTIVO (Acceso inmediato)</option>
                    <option value="PENDIENTE_ACTIVACION">PENDIENTE DE ACTIVACIÓN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Contraseña Inicial de Acceso * (Mínimo 8 caracteres)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition font-mono"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500 font-medium">
                  Cifrada con Argon2id (RFC 9106, 64 MB de memoria). El usuario podrá enrolar MFA en su primer ingreso.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="btn-3d rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 disabled:opacity-50 transition"
                >
                  {isSubmittingCreate ? 'Creando Usuario...' : 'Crear Usuario Institucional'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR USUARIO */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white font-black">
                  <Edit2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Modificar Datos y Rol Institucional
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Actualice rol, cargo o restablezca contraseña de acceso.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nombre(s) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Correo Institucional Oficial *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Cargo o Nombramiento *
                  </label>
                  <input
                    type="text"
                    required
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Teléfono Institucional
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Rol Institucional (RBAC) *
                  </label>
                  <select
                    required
                    value={editRoleId}
                    onChange={(e) => setEditRoleId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Estado Institucional *
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                  >
                    <option value="ACTIVO">ACTIVO (Permitir acceso)</option>
                    <option value="INACTIVO">INACTIVO (Acceso revocado)</option>
                    <option value="BLOQUEADO">BLOQUEADO</option>
                    <option value="PENDIENTE_ACTIVACION">PENDIENTE ACTIVACIÓN</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
                <label className="block text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-amber-700" />
                  <span>Restablecer Contraseña (Dejar vacío para no modificar)</span>
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Ingrese nueva contraseña si desea cambiarla..."
                  className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-none transition font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="btn-3d rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:from-sky-500 hover:to-blue-500 shadow-md shadow-sky-500/20 disabled:opacity-50 transition"
                >
                  {isSubmittingEdit ? 'Guardando Cambios...' : 'Guardar Modificaciones'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

