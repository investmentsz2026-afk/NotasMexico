'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { ApiClientError } from '../../../lib/api-client';
import { Shield, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await login(email, password);

      if (response.mfaRequired && response.mfaToken) {
        // Redirigir a pantalla de desafío de segundo factor
        sessionStorage.setItem('mexagenda_mfa_token', response.mfaToken);
        sessionStorage.setItem('mexagenda_mfa_email', email);
        router.push('/mfa-verify');
      } else {
        // Redirigir al inicio o dashboard
        router.push('/');
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.problem.detail || 'Credenciales no válidas o cuenta no disponible.');
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
            <Shield className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            Ingreso al Sistema Privado
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            MexAgenda — Acceso exclusivo para integrantes y consejeros institucionales autorizados.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 p-4 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-900">Acceso Denegado</p>
              <p className="mt-0.5 text-xs text-rose-700">{error}</p>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Correo Electrónico Institucional
            </label>
            <div className="relative rounded-lg shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Mail className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@institucion.gob.mx"
                className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Contraseña
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-amber-700 hover:text-amber-800 transition"
              >
                ¿Olvidó su contraseña?
              </Link>
            </div>
            <div className="relative rounded-lg shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="block w-full rounded-lg border border-slate-300 pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 disabled:opacity-50 transition"
          >
            {isLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Autenticar y Acceder</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Protegido por Argon2id (RFC 9106) • Sesiones en Neon PostgreSQL • Cero Almacenamiento en LocalStorage
          </p>
        </div>
      </div>
    </div>
  );
}

