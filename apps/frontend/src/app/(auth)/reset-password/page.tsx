'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import { Lock, Check, X, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reglas de la política institucional
  const hasMinLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isFormValid =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecial &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Token de restablecimiento ausente o no válido.');
      return;
    }

    if (!isFormValid) {
      setError('La contraseña no cumple con todas las directrices institucionales de seguridad.');
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.problem.detail || 'Error al restablecer la contraseña.');
      } else {
        setError('Error al conectar con los servicios de autenticación.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-200/80">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-amber-400 shadow-md">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            Nueva Contraseña Institucional
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Defina una nueva clave segura que cumpla con los estándares criptográficos institucionales.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 p-4 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-900">Error</p>
              <p className="mt-0.5 text-xs text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {success ? (
          <div className="space-y-6">
            <div className="rounded-xl bg-emerald-50 p-5 border border-emerald-200 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 mb-2" />
              <p className="text-sm font-semibold text-emerald-950">Contraseña Actualizada</p>
              <p className="mt-1 text-xs text-emerald-800">
                Su nueva contraseña ha sido almacenada de forma segura con Argon2id. Ya puede iniciar sesión con sus nuevas credenciales.
              </p>
            </div>

            <Link
              href="/login"
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-slate-800 transition"
            >
              <span>Ir al Inicio de Sesión</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nueva Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
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
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
              />
            </div>

            {/* Checklist de requisitos de seguridad */}
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1.5 text-slate-600">
              <p className="font-semibold text-slate-700 mb-1">Requisitos de la Política Institucional:</p>
              <div className="flex items-center space-x-2">
                {hasMinLength ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                <span className={hasMinLength ? 'text-emerald-700 font-medium' : ''}>Mínimo 12 caracteres</span>
              </div>
              <div className="flex items-center space-x-2">
                {hasUppercase ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                <span className={hasUppercase ? 'text-emerald-700 font-medium' : ''}>Al menos una letra mayúscula (A-Z)</span>
              </div>
              <div className="flex items-center space-x-2">
                {hasLowercase ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                <span className={hasLowercase ? 'text-emerald-700 font-medium' : ''}>Al menos una letra minúscula (a-z)</span>
              </div>
              <div className="flex items-center space-x-2">
                {hasNumber ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                <span className={hasNumber ? 'text-emerald-700 font-medium' : ''}>Al menos un número (0-9)</span>
              </div>
              <div className="flex items-center space-x-2">
                {hasSpecial ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                <span className={hasSpecial ? 'text-emerald-700 font-medium' : ''}>Al menos un carácter especial (!@#$%...)</span>
              </div>
              <div className="flex items-center space-x-2">
                {passwordsMatch ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5 text-slate-400" />}
                <span className={passwordsMatch ? 'text-emerald-700 font-medium' : ''}>Las contraseñas coinciden</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 disabled:opacity-50 transition"
            >
              {isLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Guardar Nueva Contraseña</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Cargando...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

