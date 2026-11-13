'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import {
  LogOut,
  Home,
  Key,
  Calendar,
  CalendarDays,
  FileCheck2,
  BookOpen,
  FolderLock,
  BarChart3,
  Tag,
  Users,
  ShieldCheck,
  Menu,
  X,
  UserCircle2,
} from 'lucide-react';
import { NotificationBell } from './notification-bell';

export function HeaderNav() {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();

  // Control para ocultar el header automáticamente al bajar (scroll down) y mostrarlo al subir
  const [isVisible, setIsVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastScrollY = useRef(0);

  // Cerrar menú hamburguesa automáticamente al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Bloquear el scroll del fondo cuando el menú móvil esté abierto para experiencia 100% nativa
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (mobileMenuOpen) return; // Si el menú móvil está desplegado, no ocultar el header
      const currentScrollY = window.scrollY;
      if (currentScrollY < 20) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY.current + 6) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY.current - 6) {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: '/', label: 'Inicio', icon: Home },
    { href: '/meetings', label: 'Reuniones', icon: Calendar },
    { href: '/agreements', label: 'Acuerdos', icon: FileCheck2 },
    { href: '/notes', label: 'Anotaciones', icon: BookOpen },
    { href: '/vault', label: 'Bóveda', icon: FolderLock },
    { href: '/reports', label: 'Reportes', icon: BarChart3 },
    { href: '/meetings/calendar', label: 'Calendario', icon: CalendarDays },
    ...(user?.role === 'ROLE_ADMIN'
      ? [
          { href: '/meeting-categories', label: 'Categorías', icon: Tag },
          { href: '/users', label: 'Usuarios', icon: Users },
        ]
      : []),
  ];

  const circleDisplayName =
    user?.firstName?.toLowerCase().startsWith('administrador')
      ? 'Admin'
      : user?.firstName?.split(' ')[0] || 'Usuario';

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ease-in-out ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      } bg-gradient-to-r from-slate-800 via-slate-700 to-sky-900 border-b-4 border-sky-500/60 shadow-[0_8px_25px_-5px_rgba(15,23,42,0.45)] text-white`}
    >
      {/* Línea superior cálida y sobria */}
      <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-amber-300/80 to-sky-500" />

      {/* Barra Principal del Header (Siempre en z-50 para verse nítida sobre el fondo nublado) */}
      <div className="relative z-50 w-full max-w-[1600px] mx-auto flex items-center justify-between px-3 sm:px-5 py-1.5 gap-2">
        {/* Logo compacto a la izquierda */}
        <Link href="/" className="group flex items-center space-x-2 flex-shrink-0">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 p-0.5 shadow-md border border-sky-200/70 group-hover:scale-105 transition-all">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-900">
              <ShieldCheck className="h-4 w-4 text-amber-300 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="leading-none flex flex-col">
            <span className="text-sm sm:text-base font-black tracking-tight text-white group-hover:text-sky-200 transition">
              MexAgenda
            </span>
            <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-amber-400/90 px-1.5 py-[1px] text-[8px] font-black text-slate-900 uppercase tracking-wider">
              Institucional
            </span>
          </div>
        </Link>

        {/* Menú de Navegación Escritorio (lg+) y Controles Móviles */}
        {isLoading ? (
          <div className="flex items-center space-x-2 text-xs text-slate-200">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
          </div>
        ) : (
          <>
            {user && (
              <nav className="hidden lg:flex items-center gap-1 rounded-full bg-slate-900/55 backdrop-blur-md px-1.5 py-1 border border-slate-500/50 shadow-inner">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive =
                    link.href === '/'
                      ? pathname === '/'
                      : link.href === '/meetings'
                      ? pathname === '/meetings' ||
                        (pathname?.startsWith('/meetings/') &&
                          !pathname?.startsWith('/meetings/calendar'))
                      : pathname?.startsWith(link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`inline-flex items-center space-x-1 rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white border-2 border-sky-200 border-b-[3px] border-b-blue-900 shadow-[0_3px_10px_rgba(14,165,233,0.45)] font-black'
                          : 'border border-slate-500/40 bg-slate-800/60 text-slate-100 font-semibold hover:bg-slate-700/80 hover:border-sky-300/60 hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`h-3 w-3 shrink-0 ${
                          isActive ? 'text-amber-200' : 'text-sky-300'
                        }`}
                      />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}

            {user ? (
              <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0 pr-0.5 sm:pr-1">
                <NotificationBell />

                {/* Perfil de Usuario en Forma Circular 3D */}
                <Link
                  href="/profile"
                  title={`Mi Perfil: ${user.firstName} ${user.lastName} (${
                    user.role === 'ROLE_ADMIN' ? 'Administrador' : 'Usuario'
                  })`}
                  className={`group relative flex h-10 w-10 sm:h-11 sm:w-11 flex-col items-center justify-center rounded-full border-2 border-sky-200 border-b-4 ${
                    user.role === 'ROLE_ADMIN'
                      ? 'bg-gradient-to-b from-amber-500 to-amber-700 border-b-amber-950 shadow-md'
                      : 'bg-gradient-to-b from-sky-500 to-blue-700 border-b-blue-950 shadow-md'
                  } hover:scale-105 active:scale-95 transition-all duration-200 p-0.5 text-center flex-shrink-0`}
                >
                  <span className="text-[8.5px] sm:text-[9px] font-black text-white leading-none tracking-tight max-w-[34px] truncate drop-shadow">
                    {circleDisplayName}
                  </span>
                  <span className="mt-0.5 rounded-full bg-slate-950/45 px-1 py-[1px] text-[6px] sm:text-[6.5px] font-black uppercase tracking-tighter text-amber-200 leading-none">
                    {user.role === 'ROLE_ADMIN' ? 'Admin' : 'Usuario'}
                  </span>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 shadow-xs"
                    title="En línea"
                  />
                </Link>

                {/* Botón Circular 3D de Cerrar Sesión */}
                <button
                  onClick={() => logout()}
                  title="Cerrar sesión"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white border-2 border-slate-500/60 hover:border-rose-300 border-b-4 border-b-slate-950 shadow-md hover:scale-105 active:scale-95 transition-all flex-shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </button>

                {/* Botón Menú Hamburguesa 3D para Celulares y Tablets (< lg) */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  aria-label="Abrir menú de navegación"
                  className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-sky-500 to-blue-700 text-white border-2 border-sky-200 border-b-4 border-b-blue-950 shadow-md active:scale-95 transition-all flex-shrink-0"
                >
                  {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center space-x-1.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-black text-white border-2 border-sky-200 border-b-4 border-b-blue-900 hover:scale-105 transition shadow-md"
              >
                <Key className="h-3.5 w-3.5" />
                <span>Acceso Privado</span>
              </Link>
            )}
          </>
        )}
      </div>

      {/* Telón de Fondo Nublado / Oscurecido que nubla toda la página atrás (Backdrop Blur) */}
      {user && mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-md lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Panel Desplegable Móvil Flotante (ENCIMA del contenido, sin moverlo hacia abajo) */}
      {user && mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 z-50 lg:hidden border-b-4 border-sky-500/60 bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 px-3 pt-3 pb-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] space-y-3 max-h-[calc(100vh-65px)] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Tarjeta Resumen de Usuario en Móvil */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-800/90 border border-slate-600/80 border-b-4 border-b-slate-950 p-2.5">
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-2.5 min-w-0"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-sky-200 font-black text-xs text-white ${
                  user.role === 'ROLE_ADMIN'
                    ? 'bg-gradient-to-b from-amber-500 to-amber-700'
                    : 'bg-gradient-to-b from-sky-500 to-blue-700'
                }`}
              >
                {user.firstName?.[0] || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[10px] font-bold text-sky-300 truncate">
                  {user.role === 'ROLE_ADMIN' ? 'Administrador General' : 'Usuario Institucional'}
                </p>
              </div>
            </Link>
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center space-x-1 rounded-xl bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 text-[10px] font-black text-amber-200 border border-slate-500 shrink-0"
            >
              <UserCircle2 className="h-3.5 w-3.5" />
              <span>Mi Perfil</span>
            </Link>
          </div>

          {/* Cuadrícula de 2 Columnas de Módulos para Celulares Pequeños */}
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === '/'
                  ? pathname === '/'
                  : link.href === '/meetings'
                  ? pathname === '/meetings' ||
                    (pathname?.startsWith('/meetings/') &&
                      !pathname?.startsWith('/meetings/calendar'))
                  : pathname?.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 rounded-xl px-3 py-2.5 text-xs transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white border-2 border-sky-200 border-b-4 border-b-blue-950 font-black shadow-md'
                      : 'bg-slate-800/90 text-slate-100 border border-slate-600/80 border-b-4 border-b-slate-950 font-bold hover:bg-slate-700'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-amber-200' : 'text-sky-300'
                    }`}
                  />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Botón de Cerrar Sesión en el Menú Móvil */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              logout();
            }}
            className="w-full flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 px-4 py-2.5 text-xs font-black text-white border-2 border-rose-300 border-b-4 border-b-red-950 shadow-md active:scale-98 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar Sesión Institucional</span>
          </button>
        </div>
      )}
    </header>
  );
}
