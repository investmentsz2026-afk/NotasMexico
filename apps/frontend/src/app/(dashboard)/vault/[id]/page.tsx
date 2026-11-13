'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import {
  DocumentDetailDto,
  DownloadUrlDto,
} from '@mexagenda/shared';
import {
  FolderLock,
  ArrowLeft,
  Download,
  Upload,
  Copy,
  Check,
  Trash2,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Calendar,
  User,
  History,
  FileText,
  FileSpreadsheet,
  FileCheck,
  FileImage,
  File,
  AlertTriangle,
  ExternalLink,
  Layers,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(mime: string, filename: string) {
  const ext = filename?.split('.').pop()?.toLowerCase();
  if (mime?.includes('pdf') || ext === 'pdf') {
    return <FileText className="h-8 w-8 text-rose-400" />;
  }
  if (mime?.includes('sheet') || ext === 'xlsx' || ext === 'csv') {
    return <FileSpreadsheet className="h-8 w-8 text-emerald-400" />;
  }
  if (mime?.includes('image') || ['png', 'jpg', 'jpeg'].includes(ext || '')) {
    return <FileImage className="h-8 w-8 text-purple-400" />;
  }
  if (mime?.includes('word') || ext === 'docx') {
    return <FileCheck className="h-8 w-8 text-blue-400" />;
  }
  return <File className="h-8 w-8 text-slate-400" />;
}

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const { user } = useAuth();

  const [doc, setDoc] = useState<DocumentDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Nueva versión
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<globalThis.File | null>(null);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  const fetchDocument = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiFetch<DocumentDetailDto>(`/documents/${id}`);
      setDoc(res);
    } catch (err: any) {
      setError(err?.message || 'Error al obtener la ficha del documento.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const handleDownload = async () => {
    if (!doc) return;
    try {
      setIsDownloading(true);
      const res = await apiFetch<DownloadUrlDto>(`/documents/${doc.id}/download`);
      if (res && res.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      alert(err?.message || 'Error al generar enlace de descarga autorizado.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyHash = () => {
    if (doc?.sha256Checksum) {
      navigator.clipboard.writeText(doc.sha256Checksum);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleDelete = async () => {
    if (!doc) return;
    if (!confirm(`¿Está seguro de retirar este documento de la bóveda activa?`)) return;

    try {
      await apiFetch(`/documents/${doc.id}`, { method: 'DELETE' });
      router.push('/vault');
    } catch (err: any) {
      alert(err?.message || 'Error al eliminar documento.');
    }
  };

  const handleRestore = async () => {
    if (!doc) return;
    try {
      await apiFetch(`/documents/${doc.id}/restore`, { method: 'POST' });
      fetchDocument();
    } catch (err: any) {
      alert(err?.message || 'Error al restaurar documento.');
    }
  };

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionFile || !doc) return;

    try {
      setIsUploadingVersion(true);
      setVersionError(null);

      const formData = new FormData();
      formData.append('file', versionFile);

      await apiFetch(`/documents/${doc.id}/version`, {
        method: 'POST',
        body: formData,
      });

      setIsVersionModalOpen(false);
      setVersionFile(null);
      fetchDocument();
    } catch (err: any) {
      setVersionError(err?.message || 'Error al cargar nueva versión.');
    } finally {
      setIsUploadingVersion(false);
    }
  };

  const canAdmin = user?.permissions?.includes('document:admin:manage') || user?.role === 'ROLE_ADMIN';
  const isOwner = doc?.uploader?.id === user?.id;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="space-y-4">
        <Link
          href="/vault"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Regresar a la Bóveda</span>
        </Link>
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-6 text-sm text-rose-300">
          <p className="font-semibold">{error || 'Documento no encontrado.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botón de Regreso */}
      <div>
        <Link
          href="/vault"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-600 hover:text-purple-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>← Regresar al catálogo de la Bóveda</span>
        </Link>
      </div>

      {/* Header Ficha Técnica 3D */}
      <div className="card-3d bg-white p-6 sm:p-8 shadow-xl border border-slate-200 rounded-3xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-start space-x-4">
            <div className="rounded-2xl bg-slate-100 p-4 border border-slate-200 shadow-sm flex items-center justify-center">
              {getFileIcon(doc.mimeType, doc.originalFilename)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 break-all">
                  {doc.originalFilename}
                </h1>
                <span className="rounded-lg bg-purple-100 border border-purple-300 px-2.5 py-0.5 text-xs font-extrabold text-purple-800">
                  v{doc.version}
                </span>
              </div>
              <p className="mt-1.5 text-xs font-medium text-slate-600">
                {doc.description || 'Documento oficial resguardado en bóveda inmutable.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownload}
              disabled={isDownloading || doc.scanStatus === 'INFECTADO'}
              className="btn-3d inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-500/20 transition disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{isDownloading ? 'Generando Enlace...' : 'Descargar Archivo'}</span>
            </button>

            {(isOwner || canAdmin) && (
              <button
                onClick={() => {
                  setVersionError(null);
                  setVersionFile(null);
                  setIsVersionModalOpen(true);
                }}
                className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition shadow-xs"
              >
                <Upload className="h-3.5 w-3.5 text-cyan-600" />
                <span>Nueva Versión</span>
              </button>
            )}

            {(isOwner || canAdmin) && (
              <button
                onClick={handleDelete}
                className="btn-3d inline-flex items-center space-x-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-2.5 text-xs font-bold text-rose-700 transition shadow-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
          </div>
        </div>

        {/* Metadatos en cuadrícula 3D */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs">
            <span className="text-slate-500 font-bold block mb-1 uppercase tracking-wider text-[10px]">Categoría Institucional</span>
            <span className="font-extrabold text-slate-900 text-sm">{doc.category}</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs">
            <span className="text-slate-500 font-bold block mb-1 uppercase tracking-wider text-[10px]">Tamaño del Archivo</span>
            <span className="font-extrabold text-slate-900 font-mono text-xs">
              {formatBytes(doc.fileSizeBytes)} ({doc.fileSizeBytes.toLocaleString()} bytes)
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs">
            <span className="text-slate-500 font-bold block mb-1 uppercase tracking-wider text-[10px]">Tipo MIME Declarado</span>
            <span className="font-extrabold text-slate-900 font-mono truncate block text-xs" title={doc.mimeType}>
              {doc.mimeType}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs">
            <span className="text-slate-500 font-bold block mb-1 uppercase tracking-wider text-[10px]">Seguridad de Contenido</span>
            <div className="flex items-center space-x-1.5 font-extrabold">
              {doc.scanStatus === 'LIMPIO' ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">Limpio (Verificado)</span>
                </>
              ) : doc.scanStatus === 'INFECTADO' ? (
                <>
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  <span className="text-rose-700">Infectado (Bloqueado)</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-amber-700">Pendiente de Revisión</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Trazabilidad Criptográfica 3D */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 space-y-3 text-xs shadow-xs">
          <h3 className="font-bold text-slate-800 flex items-center space-x-2">
            <Layers className="h-4 w-4 text-purple-600" />
            <span>Trazabilidad Criptográfica y Almacenamiento Forense</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-slate-500 font-bold block mb-1.5 text-[11px]">Hash SHA-256 (Inmutabilidad Forense)</span>
              <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-xl px-3 py-2 shadow-xs">
                <code className="text-xs font-mono font-bold text-purple-900 truncate flex-1">
                  {doc.sha256Checksum}
                </code>
                <button
                  onClick={handleCopyHash}
                  className="text-slate-500 hover:text-slate-900 transition p-1"
                  title="Copiar Hash SHA-256"
                >
                  {copiedHash ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-bold block mb-1.5 text-[11px]">Clave de Objeto en Bóveda (Storage Key)</span>
              <div className="bg-white border border-slate-300 rounded-xl px-3 py-2 shadow-xs">
                <code className="text-xs font-mono font-semibold text-slate-700 truncate block">
                  {doc.storageKey}
                </code>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] font-semibold text-slate-500 border-t border-slate-200">
            <span>Proveedor: <strong className="text-slate-900 font-mono">{doc.storageProvider}</strong></span>
            {doc.bucketName && <span>Bucket: <strong className="text-slate-900 font-mono">{doc.bucketName}</strong></span>}
            <span>Cargado: <strong className="text-slate-900">{new Date(doc.createdAt).toLocaleString()}</strong></span>
            <span>Por: <strong className="text-slate-900">{doc.uploader?.fullName || 'Administrador Institucional'}</strong></span>
          </div>
        </div>

        {/* Entidades Vinculadas 3D */}
        {(doc.meeting || doc.agreement || doc.personalNote || doc.minutes) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-xs space-y-2.5 shadow-xs">
            <h3 className="font-extrabold text-amber-950 uppercase tracking-wider text-[11px]">Vinculación Institucional de la Sesión</h3>
            <div className="flex flex-wrap gap-3">
              {doc.meeting && (
                <Link
                  href={`/meetings/${doc.meeting.id}`}
                  className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-2 hover:bg-amber-50 text-amber-950 font-bold transition shadow-xs"
                >
                  <Calendar className="h-3.5 w-3.5 text-amber-600" />
                  <span>Reunión: {doc.meeting.folio} — {doc.meeting.title}</span>
                  <ExternalLink className="h-3 w-3 text-amber-600" />
                </Link>
              )}

              {doc.agreement && (
                <Link
                  href={`/agreements/${doc.agreement.id}`}
                  className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 hover:bg-emerald-50 text-emerald-950 font-bold transition shadow-xs"
                >
                  <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Acuerdo: {doc.agreement.folio} — {doc.agreement.title}</span>
                  <ExternalLink className="h-3 w-3 text-emerald-600" />
                </Link>
              )}

              {doc.personalNote && (
                <Link
                  href={`/notes/${doc.personalNote.id}`}
                  className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-cyan-300 bg-white px-3.5 py-2 hover:bg-cyan-50 text-cyan-950 font-bold transition shadow-xs"
                >
                  <FileText className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Anotación: {doc.personalNote.title} ({doc.personalNote.visibility})</span>
                  <ExternalLink className="h-3 w-3 text-cyan-600" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Historial de Versiones 3D */}
      <div className="card-3d bg-white p-6 sm:p-8 shadow-xl border border-slate-200 rounded-3xl space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 font-bold">
            <History className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">Historial de Versiones Registradas</h2>
        </div>

        {doc.versions && doc.versions.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-bold uppercase text-slate-700">
                <tr>
                  <th className="px-4 py-3">Versión</th>
                  <th className="px-4 py-3">Tamaño</th>
                  <th className="px-4 py-3">Hash SHA-256</th>
                  <th className="px-4 py-3">Cargado por</th>
                  <th className="px-4 py-3">Fecha de Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {doc.versions.map((ver) => (
                  <tr key={ver.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-purple-700">
                      v{ver.versionNumber} {ver.versionNumber === doc.version && '(Actual)'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-900 font-semibold">
                      {formatBytes(ver.fileSizeBytes)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-500">
                      <code className="text-[11px] truncate block max-w-xs">{ver.sha256Checksum}</code>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                      {ver.uploader?.fullName || 'Administrador Institucional'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {new Date(ver.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs font-semibold text-slate-500">No se registran versiones incrementales adicionales.</p>
        )}
      </div>

      {/* Modal de Carga de Nueva Versión */}
      {isVersionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Upload className="h-5 w-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">Cargar Versión v{doc.version + 1}</h3>
              </div>
              <button
                onClick={() => setIsVersionModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {versionError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
                {versionError}
              </div>
            )}

            <form onSubmit={handleUploadVersion} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 mb-1.5 font-bold">
                  Seleccionar archivo institucional actualizado
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer border border-slate-300 rounded-xl bg-slate-50 p-2"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsVersionModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploadingVersion || !versionFile}
                  className="btn-3d rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 font-bold text-white hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-500/20 disabled:opacity-50"
                >
                  {isUploadingVersion ? 'Subiendo v' + (doc.version + 1) + '...' : 'Guardar Versión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

