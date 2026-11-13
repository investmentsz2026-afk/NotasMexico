'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { Smartphone, KeyRound, AlertCircle, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';
import { AuthUser } from '@mexagenda/shared';

export default function MfaVerifyPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [mfaToken, setMfaToken] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [isBackupCodeMode, setIsBackupCodeMode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const token = sessionStorage.getItem('mexagenda_mfa_token');
    const storedEmail = sessionStorage.getItem('mexagenda_mfa_email') || 'su cuenta';

    if (!token) {
      router.push('/login');
      return;
    }

    setMfaToken(token);
    setEmail(storedEmail);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await apiFetch<{ user: AuthUser }>('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({
          mfaToken,
          code: code.trim(),
        }),
      });

      // Limpiar tokens temporales
      sessionStorage.removeItem('mexagenda_mfa_token');
      sessionStorage.removeItem('mexagenda_mfa_email');

      // Actualizar contexto y redirigir
      await refreshUser();
      router.push('/');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.problem.detail || 'Código de verificación no válido o expirado.');
      } else {
        setError('Error al validar el código de verificación.');
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
            {isBackupCodeMode ? <KeyRound className="h-7 w-7" /> : <Smartphone className="h-7 w-7" />}
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            Segundo Factor de Autenticación
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            {isBackupCodeMode
              ? 'Ingrese uno de sus 8 códigos de respaldo generados durante el enrolamiento.'
              : `Ingrese el código de 6 dígitos generado por su aplicación para ${email}.`}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 p-4 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-900">Validación Rechazada</p>
              <p className="mt-0.5 text-xs text-rose-700">{error}</p>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 text-center">
              {isBackupCodeMode ? 'Código de Recuperación de 8-10 Caracteres' : 'Código de Seguridad TOTP (6 Dígitos)'}
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={isBackupCodeMode ? 12 : 6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={isBackupCodeMode ? 'XXXX-XXXX' : '000000'}
              className="block w-full rounded-lg border border-slate-300 py-3 text-center text-2xl font-mono tracking-widest text-slate-900 placeholder:text-slate-300 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !code.trim()}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 disabled:opacity-50 transition"
          >
            {isLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Verificar y Continuar</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="flex flex-col space-y-3 pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => {
              setIsBackupCodeMode(!isBackupCodeMode);
              setCode('');
              setError(null);
            }}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 transition"
          >
            {isBackupCodeMode
              ? 'Volver a usar código de aplicación móvil'
              : '¿No tiene su teléfono? Usar código de respaldo de emergencia'}
          </button>

          <Link
            href="/login"
            className="inline-flex items-center justify-center space-x-1 text-xs text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Regresar al inicio de sesión</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

