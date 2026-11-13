'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home, LogIn } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-md space-y-6 bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-200/80 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Acceso Restringido (403)
        </h1>

        <p className="text-xs text-slate-600 leading-relaxed">
          Su cuenta institucional no cuenta con los roles o privilegios requeridos para visualizar o interactuar con este recurso.
        </p>

        <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-left text-xs space-y-1.5 text-slate-600">
          <p className="font-semibold text-slate-800">Causas probables:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-500">
            <li>El módulo requiere un rol administrativo (<code className="font-mono text-slate-700">ROLE_ADMIN</code>).</li>
            <li>No se ha completado la configuración obligatoria de MFA.</li>
            <li>El recurso pertenece exclusivamente a otro consejero o usuario institucional.</li>
          </ul>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Inicio</span>
          </Link>
          <Link
            href="/login"
            className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Iniciar Sesión</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

