import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white rounded-xl p-8 border border-institutional-border shadow-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-institutional-navy mb-4">
          <ShieldAlert className="h-7 w-7 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-institutional-navy">
          Recurso No Encontrado (404)
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-institutional-muted">
          La ruta institucional solicitada no existe o no se encuentra disponible.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 rounded-lg bg-institutional-navy px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Panel Principal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
