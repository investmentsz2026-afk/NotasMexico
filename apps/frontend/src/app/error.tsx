'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Registro de error en consola sin exponer información sensible
    console.error('[MexAgenda Error Boundary]:', error.message);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white rounded-xl p-8 border border-institutional-border shadow-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 mb-4">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-institutional-navy">
          Excepción en la Aplicación
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-institutional-muted">
          Se ha producido un error al renderizar la vista. Si el problema persiste, contacte al soporte institucional.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center space-x-2 rounded-lg bg-institutional-navy px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reintentar</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center space-x-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Inicio</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
