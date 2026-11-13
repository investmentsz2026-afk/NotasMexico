'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api-client';
import { KeyRound, Mail, ArrowLeft, CheckCircle2, ArrowRight } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiFetch('/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      // Por seguridad anti-enumeración, se muestra siempre la pantalla de confirmación neutra
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-200/80">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-amber-400 shadow-md">
            <KeyRound className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            Recuperación de Contraseña
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Ingrese su correo electrónico institucional registrado para tramitar las instrucciones de restablecimiento.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-6">
            <div className="rounded-xl bg-emerald-50 p-5 border border-emerald-200 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 mb-2" />
              <p className="text-sm font-semibold text-emerald-950">Solicitud Tramitada</p>
              <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                Si la dirección ingresada corresponde a una cuenta activa en el sistema institucional, se ha enviado un enlace de restablecimiento seguro con vigencia de 60 minutos.
              </p>
            </div>

            <Link
              href="/login"
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-slate-800 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Regresar al Inicio de Sesión</span>
            </Link>
          </div>
        ) : (
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

            <button
              type="submit"
              disabled={isLoading || !email}
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 disabled:opacity-50 transition"
            >
              {isLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Enviar Instrucciones</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="pt-4 border-t border-slate-100 text-center">
              <Link
                href="/login"
                className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Cancelar y volver al inicio</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

