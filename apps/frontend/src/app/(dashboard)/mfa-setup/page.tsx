'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { MfaEnrollResponse, MfaConfirmResponse } from '@mexagenda/shared';
import {
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
  Download,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function MfaSetupPage() {
  const router = useRouter();
  const { user, refreshUser, isLoading: isAuthLoading } = useAuth();

  const [enrollData, setEnrollData] = useState<MfaEnrollResponse | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
      return;
    }

    if (user && isEnrolling) {
      startEnrollment();
    }
  }, [user, isAuthLoading]);

  const startEnrollment = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<MfaEnrollResponse>('/auth/mfa/enroll', {
        method: 'POST',
      });
      setEnrollData(data);
      setIsEnrolling(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.problem.detail || 'Error al iniciar configuración MFA.');
      } else {
        setError('No se pudo conectar con el servicio de enrolamiento.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiFetch<MfaConfirmResponse>('/auth/mfa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: confirmCode.trim() }),
      });

      setBackupCodes(res.backupCodes);
      await refreshUser();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.problem.detail || 'Código de confirmación incorrecto.');
      } else {
        setError('Error al confirmar vinculación MFA.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyAllCodes = () => {
    if (backupCodes.length === 0) return;
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 3000);
  };

  const downloadCodesFile = () => {
    if (backupCodes.length === 0) return;
    const content = `MEXAGENDA — CÓDIGOS DE RESPALDO DE SEGUNDO FACTOR (MFA)\nInstitución: MexAgenda\nUsuario: ${user?.email}\nGenerados: ${new Date().toISOString()}\n\nADVERTENCIA: Cada código puede ser utilizado UNA SOLA VEZ para ingresar a la plataforma si pierde el acceso a su aplicación autenticadora.\n\n${backupCodes.map((c, i) => `Código ${i + 1}: ${c}`).join('\n')}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mexagenda-codigos-respaldo.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isAuthLoading) {
    return <div className="p-12 text-center text-slate-500">Cargando perfil...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-white p-6 sm:p-10 shadow-lg border border-slate-200">
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-amber-400">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Configuración de Autenticación Multifactor (MFA / TOTP)
            </h1>
            <p className="text-xs text-slate-500">
              Estándar RFC 6238 • Cifrado simétrico AES-256-GCM en reposo
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-rose-50 p-4 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-900">Aviso</p>
              <p className="mt-0.5 text-xs text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* PASO 2: Visualización de los 8 códigos de respaldo (si ya se confirmó) */}
        {backupCodes.length > 0 ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-xl bg-emerald-50 p-5 border border-emerald-200">
              <div className="flex items-center space-x-2 text-emerald-950 font-bold text-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <span>MFA Configurado y Activo Exitosamente</span>
              </div>
              <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                Su aplicación autenticadora ha quedado vinculada. A continuación se presentan sus <strong>8 códigos de recuperación de un solo uso</strong>. Estos códigos <strong>SOLO SE MOSTRARÁN EN ESTA PANTALLA UNA VEZ</strong>.
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 p-6 text-white space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Códigos de Respaldo de Emergencia (8 Códigos)
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={copyAllCodes}
                    className="inline-flex items-center space-x-1.5 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
                  >
                    {copiedCodes ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedCodes ? 'Copiados' : 'Copiar'}</span>
                  </button>
                  <button
                    onClick={downloadCodesFile}
                    className="inline-flex items-center space-x-1.5 rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500 transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Descargar .txt</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {backupCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg bg-slate-800/90 border border-slate-700 py-2 px-3 text-center font-mono text-sm tracking-wider text-amber-300 font-semibold shadow-inner"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 p-4 border border-amber-200 flex items-start space-x-3 text-amber-900 text-xs">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Guarde estos códigos en un lugar seguro y confidencial</p>
                <p className="mt-0.5 text-amber-800">
                  Si pierde el acceso a su dispositivo móvil autenticador, estos 8 códigos son la única vía para recuperar el acceso a su cuenta sin intervención del administrador.
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Link
                href="/profile"
                className="inline-flex items-center space-x-2 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow transition"
              >
                <span>Finalizar y volver al Perfil</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : enrollData ? (
          /* PASO 1: Escaneo de QR y confirmación */
          <div className="mt-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                <img
                  src={enrollData.qrCodeDataUrl}
                  alt="Código QR MFA MexAgenda"
                  className="h-56 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
                />
                <p className="mt-3 text-[11px] text-slate-500 text-center font-medium">
                  Escanee este código con Google Authenticator, Microsoft Authenticator o 1Password
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Instrucciones de Vinculación
                </h3>
                <ol className="list-decimal list-inside text-xs text-slate-600 space-y-2">
                  <li>Abra su aplicación autenticadora preferida en su smartphone.</li>
                  <li>Seleccione la opción para escanear un nuevo código QR.</li>
                  <li>Si la cámara no funciona, introduzca manualmente la clave:</li>
                </ol>

                <div className="rounded-lg bg-slate-100 p-3 border border-slate-200 font-mono text-xs text-slate-800 break-all select-all text-center font-semibold">
                  {enrollData.secret}
                </div>

                <form onSubmit={handleConfirm} className="pt-2 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Ingrese el código de 6 dígitos que muestra su app:
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    placeholder="000000"
                    className="block w-full rounded-lg border border-slate-300 py-2.5 text-center text-xl font-mono tracking-widest text-slate-900 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />

                  <button
                    type="submit"
                    disabled={isLoading || confirmCode.trim().length !== 6}
                    className="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50 transition"
                  >
                    {isLoading ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span>Confirmar y Activar MFA</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
            <p className="mt-2 text-xs">Generando secreto criptográfico seguro...</p>
          </div>
        )}
      </div>
    </div>
  );
}

