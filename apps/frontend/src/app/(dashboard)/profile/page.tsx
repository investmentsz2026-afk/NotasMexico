'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import {
  User,
  Shield,
  Key,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Check,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Reglas de contraseña
  const hasMinLength = newPassword.length >= 12;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isFormValid =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecial &&
    passwordsMatch;

  if (isAuthLoading) {
    return <div className="p-12 text-center text-slate-500">Cargando perfil institucional...</div>;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!isFormValid) {
      setPasswordError('La nueva contraseña no cumple con todas las directrices de seguridad.');
      return;
    }

    setIsChangingPass(true);

    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      setPasswordSuccess('Contraseña institucional actualizada exitosamente. Todas las demás sesiones han sido revocadas.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPasswordError(err.problem.detail || 'Error al actualizar la contraseña.');
      } else {
        setPasswordError('No se pudo conectar con el servidor.');
      }
    } finally {
      setIsChangingPass(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Título y Resumen */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Perfil y Seguridad Institucional
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Identidad, credenciales de acceso, segundo factor de autenticación y sesiones activas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna Izquierda: Información de Identidad y Estado de Seguridad */}
        <div className="space-y-6 lg:col-span-1">
          {/* Tarjeta de Identidad */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-amber-400 font-bold text-lg">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {user.firstName} {user.lastName}
                </h2>
                <p className="text-xs text-slate-500">{user.position}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Correo Electrónico:</span>
                <span className="text-slate-800 font-semibold">{user.email}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Rol Institucional:</span>
                <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-800 border border-slate-200 mt-0.5">
                  {user.role}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Estado de Cuenta:</span>
                <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{user.status}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta MFA */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <Smartphone className="h-4 w-4 text-amber-600" />
                <span>Segundo Factor (MFA)</span>
              </div>
              {user.mfaEnabled ? (
                <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  <Check className="h-3 w-3" />
                  <span>Habilitado</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                  <span>Pendiente</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {user.mfaEnabled
                ? 'Su cuenta está protegida con contraseñas de un solo uso (TOTP RFC 6238).'
                : 'Proteja su cuenta obligatoriamente contra accesos no autorizados mediante una aplicación móvil.'}
            </p>

            <Link
              href="/mfa-setup"
              className="inline-flex w-full items-center justify-center space-x-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              <span>{user.mfaEnabled ? 'Reconfigurar MFA' : 'Configurar MFA Ahora'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Tarjeta Sesiones Activas */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm mb-2">
              <Laptop className="h-4 w-4 text-slate-700" />
              <span>Sesiones Conectadas</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Revise las sesiones y dispositivos con acceso activo persistidas en Neon PostgreSQL.
            </p>
            <Link
              href="/profile/sessions"
              className="inline-flex w-full items-center justify-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <span>Ver y Revocar Sesiones</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Columna Derecha: Formulario de Cambio de Contraseña */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
              <Key className="h-5 w-5 text-amber-600" />
              <h2 className="text-base font-bold text-slate-900">
                Cambio Voluntario de Contraseña
              </h2>
            </div>

            {passwordSuccess && (
              <div className="mb-6 rounded-lg bg-emerald-50 p-4 border border-emerald-200 flex items-start space-x-3 text-emerald-800 text-xs">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                <p className="font-medium">{passwordSuccess}</p>
              </div>
            )}

            {passwordError && (
              <div className="mb-6 rounded-lg bg-rose-50 p-4 border border-rose-200 flex items-start space-x-3 text-rose-800 text-xs">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600 mt-0.5" />
                <p className="font-medium">{passwordError}</p>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              {/* Checklist de requisitos de seguridad */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs space-y-1.5 text-slate-600">
                <p className="font-semibold text-slate-700 mb-2">Requisitos Obligatorios de Contraseña:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className="flex items-center space-x-2">
                    {hasMinLength ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                    <span className={hasMinLength ? 'text-emerald-700 font-medium' : ''}>Mínimo 12 caracteres</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasUppercase ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                    <span className={hasUppercase ? 'text-emerald-700 font-medium' : ''}>Una mayúscula (A-Z)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasLowercase ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                    <span className={hasLowercase ? 'text-emerald-700 font-medium' : ''}>Una minúscula (a-z)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasNumber ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                    <span className={hasNumber ? 'text-emerald-700 font-medium' : ''}>Un número (0-9)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasSpecial ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                    <span className={hasSpecial ? 'text-emerald-700 font-medium' : ''}>Un carácter especial (!@#$...)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {passwordsMatch ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                    <span className={passwordsMatch ? 'text-emerald-700 font-medium' : ''}>Las contraseñas coinciden</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isChangingPass || !isFormValid}
                  className="flex items-center space-x-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {isChangingPass ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span>Actualizar Contraseña</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

