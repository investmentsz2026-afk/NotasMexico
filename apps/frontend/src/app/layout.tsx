import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { Providers } from './providers';
import { HeaderNav } from './header-nav';

export const metadata: Metadata = {
  title: 'MexAgenda — Sistema Privado de Gestión Institucional',
  description:
    'Plataforma privada, segura y colaborativa para la gobernanza, sesiones colegiadas y seguimiento de acuerdos institucionales.',
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F172A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body className="flex min-h-full flex-col font-sans antialiased text-slate-800 selection:bg-indigo-500 selection:text-white">
        <Providers>
          {/* Cabecera Institucional 3D con Auto-Ocultamiento al Bajar */}
          <HeaderNav />

          {/* Contenido Principal con Fondo Dinámico */}
          <main className="flex-1">
            {children}
          </main>

          {/* Pie de Página Institucional Moderno */}
          <footer className="border-t border-sky-200/90 bg-white/85 backdrop-blur-md py-6 text-center text-xs text-slate-600">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-2 font-medium text-slate-800">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>MexAgenda © 2026 — Plataforma Institucional Segura</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Cumplimiento estricto con los protocolos de seguridad y gobernanza colegiada.
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
