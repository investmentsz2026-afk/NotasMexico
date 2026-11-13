'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch, ApiClientError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import {
  DocumentListItemDto,
  PaginatedResponse,
  DownloadUrlDto,
} from '@mexagenda/shared';
import {
  FolderLock,
  Upload,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  FileText,
  FileSpreadsheet,
  FileCheck,
  FileImage,
  File,
  ShieldCheck,
  ShieldAlert,
  Clock,
  User,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  X,
  ExternalLink,
  Plus,
  RefreshCw,
} from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  GENERAL: { label: 'General', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  ACTA: { label: 'Acta Oficial', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  ACUERDO: { label: 'Acuerdo', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NOTA: { label: 'Nota', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  CONVOCATORIA: { label: 'Convocatoria', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
  EVIDENCIA: { label: 'Evidencia', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  ANEXO: { label: 'Anexo Técnico', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  DICTAMEN: { label: 'Dictamen', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(mime: string, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (mime.includes('pdf') || ext === 'pdf') {
    return <FileText className="h-5 w-5 text-rose-400" />;
  }
  if (mime.includes('sheet') || ext === 'xlsx' || ext === 'csv') {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
  }
  if (mime.includes('image') || ['png', 'jpg', 'jpeg'].includes(ext || '')) {
    return <FileImage className="h-5 w-5 text-purple-400" />;
  }
  if (mime.includes('word') || ext === 'docx') {
    return <FileCheck className="h-5 w-5 text-blue-400" />;
  }
  return <File className="h-5 w-5 text-slate-400" />;
}

function VaultContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [documents, setDocuments] = useState<DocumentListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState(searchParams?.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams?.get('category') || '');
  const [selectedScanStatus, setSelectedScanStatus] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState(searchParams?.get('meetingId') || '');

  // Catálogos para vincular documentos a Reuniones / Acuerdos
  const [availableMeetings, setAvailableMeetings] = useState<
    Array<{ id: string; folio: string; title: string; meetingDate?: string }>
  >([]);
  const [availableAgreements, setAvailableAgreements] = useState<
    Array<{ id: string; folio: string; title: string }>
  >([]);

  // Modal de carga
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<globalThis.File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('GENERAL');
  const [uploadMeetingId, setUploadMeetingId] = useState(searchParams?.get('meetingId') || '');
  const [uploadAgreementId, setUploadAgreementId] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Descarga en progreso
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLinkableCatalogs() {
      try {
        const mRes = await apiFetch<any>('/meetings?limit=100');
        if (mRes?.items) {
          setAvailableMeetings(
            mRes.items.map((m: any) => ({
              id: m.id,
              folio: m.folio,
              title: m.title,
              meetingDate: m.meetingDate,
            })),
          );
        }
      } catch {
        // No bloqueante
      }
      try {
        const aRes = await apiFetch<any>('/agreements?limit=100');
        if (aRes?.items) {
          setAvailableAgreements(
            aRes.items.map((a: any) => ({
              id: a.id,
              folio: a.folio,
              title: a.title,
            })),
          );
        }
      } catch {
        // No bloqueante
      }
    }
    fetchLinkableCatalogs();
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedScanStatus) params.append('scanStatus', selectedScanStatus);
      if (selectedMeetingId) params.append('meetingId', selectedMeetingId);

      const res = await apiFetch<PaginatedResponse<DocumentListItemDto>>(`/documents?${params.toString()}`);
      setDocuments(res.items || []);
      setTotal(res.meta?.total || 0);
      setTotalPages(res.meta?.totalPages || 1);
    } catch (err: any) {
      setError(err?.message || 'Error al consultar la bóveda documental.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, selectedCategory, selectedScanStatus, selectedMeetingId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDownload = async (doc: DocumentListItemDto) => {
    try {
      setDownloadingId(doc.id);
      const res = await apiFetch<DownloadUrlDto>(`/documents/${doc.id}/download`);
      if (res && res.downloadUrl) {
        // Abrir URL presignada autorizada
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      alert(err?.message || 'Error al generar enlace de descarga autorizado.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`¿Está seguro de eliminar el documento "${filename}"? Esta acción retirará el archivo de la bóveda activa.`)) {
      return;
    }
    try {
      await apiFetch(`/documents/${id}`, { method: 'DELETE' });
      fetchDocuments();
    } catch (err: any) {
      alert(err?.message || 'Error al eliminar el documento.');
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Por favor seleccione un archivo para cargar.');
      return;
    }

    if (uploadFile.size > 25 * 1024 * 1024) {
      setUploadError('El archivo seleccionado excede el límite máximo institucional de 25 MB.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('category', uploadCategory);
      if (uploadMeetingId) {
        formData.append('meetingId', uploadMeetingId);
      }
      if (uploadAgreementId) {
        formData.append('agreementId', uploadAgreementId);
      }
      if (uploadDescription) {
        formData.append('description', uploadDescription);
      }

      await apiFetch('/documents/upload', {
        method: 'POST',
        body: formData,
      });

      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadDescription('');
      setUploadCategory('GENERAL');
      if (!searchParams?.get('meetingId')) {
        setUploadMeetingId('');
      }
      setUploadAgreementId('');
      fetchDocuments();
    } catch (err: any) {
      setUploadError(err?.message || 'Error durante la carga del documento.');
    } finally {
      setIsUploading(false);
    }
  };

  const canUpload = user?.permissions?.includes('document:upload') || user?.role === 'ROLE_ADMIN';
  const canAdmin = user?.permissions?.includes('document:admin:manage') || user?.role === 'ROLE_ADMIN';

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header Institucional */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-4">
          <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 p-3 shadow-lg shadow-purple-500/25 text-white ring-4 ring-purple-50">
            <FolderLock className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Bóveda Digital y Gestión Documental
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
              MOD-05: Almacenamiento institucional cifrado con hashes SHA-256 y control estricto de acceso.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchDocuments()}
            className="btn-3d inline-flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            title="Actualizar listado"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-purple-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          {canUpload && (
            <button
              onClick={() => {
                setUploadError(null);
                setUploadFile(null);
                setIsUploadModalOpen(true);
              }}
              className="btn-3d inline-flex items-center space-x-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/20 hover:bg-purple-700 transition"
            >
              <Upload className="h-4 w-4" />
              <span>Cargar Documento</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="card-3d bg-white p-5 rounded-2xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-4 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre de archivo o descripción..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={selectedMeetingId}
            onChange={(e) => setSelectedMeetingId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="">Todas las reuniones</option>
            {availableMeetings.map((m) => (
              <option key={m.id} value={m.id}>
                [{m.folio}] {m.title}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <select
            value={selectedScanStatus}
            onChange={(e) => setSelectedScanStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="">Todos los estados</option>
            <option value="LIMPIO">Limpio (Verificado)</option>
            <option value="PENDIENTE_REVISION">Pendiente de revisión</option>
            <option value="INFECTADO">Infectado (Bloqueado)</option>
          </select>
        </div>
      </div>

      {/* Lista de Documentos */}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800 flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
          <p className="text-xs text-slate-500">Consultando bóveda institucional...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="card-3d rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 shadow-inner">
            <FolderLock className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">No se encontraron documentos</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || selectedCategory
              ? 'Intente ajustar los filtros de búsqueda o categoría.'
              : 'La bóveda se encuentra actualmente sin documentos cargados.'}
          </p>
          {canUpload && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="btn-3d mt-5 inline-flex items-center space-x-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700 transition"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Subir primer documento</span>
            </button>
          )}
        </div>
      ) : (
        <div className="card-3d overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {/* Vista Escritorio */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3.5">Archivo</th>
                  <th scope="col" className="px-4 py-3.5">Categoría</th>
                  <th scope="col" className="px-4 py-3.5">Tamaño</th>
                  <th scope="col" className="px-4 py-3.5">Seguridad</th>
                  <th scope="col" className="px-4 py-3.5">Vinculación</th>
                  <th scope="col" className="px-4 py-3.5">Cargado por</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => {
                  const cat = CATEGORY_CONFIG[doc.category] || {
                    label: doc.category,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const isClean = doc.scanStatus === 'LIMPIO';
                  const isInfected = doc.scanStatus === 'INFECTADO';

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50 transition">
                      {/* Archivo */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          {getFileIcon(doc.mimeType, doc.originalFilename)}
                          <div>
                            <Link
                              href={`/vault/${doc.id}`}
                              className="font-bold text-slate-900 hover:text-purple-600 transition"
                            >
                              {doc.originalFilename}
                            </Link>
                            <div className="text-xs text-slate-400 flex items-center space-x-2">
                              <span>v{doc.version}</span>
                              <span>•</span>
                              <span className="font-mono text-[11px]">{doc.storageProvider}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cat.badgeClass}`}>
                          {cat.label}
                        </span>
                      </td>

                      {/* Tamaño */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {formatBytes(doc.fileSizeBytes)}
                      </td>

                      {/* Seguridad / Escaneo */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isClean ? (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Limpio</span>
                          </span>
                        ) : isInfected ? (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span>Infectado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Pendiente</span>
                          </span>
                        )}
                      </td>

                      {/* Vinculación */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">
                        {doc.meeting ? (
                          <Link
                            href={`/meetings/${doc.meeting.id}`}
                            className="hover:text-purple-600 flex flex-col"
                          >
                            <span className="font-bold text-purple-700">
                              Reunión: {doc.meeting.folio}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                              {doc.meeting.title}
                            </span>
                          </Link>
                        ) : doc.agreement ? (
                          <Link
                            href={`/agreements/${doc.agreement.id}`}
                            className="hover:text-purple-600 flex flex-col"
                          >
                            <span className="font-bold text-emerald-700">
                              Acuerdo: {doc.agreement.folio}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                              {doc.agreement.title}
                            </span>
                          </Link>
                        ) : doc.personalNote ? (
                          <Link href={`/notes/${doc.personalNote.id}`} className="hover:text-purple-600 flex items-center space-x-1">
                            <span>Nota:</span>
                            <span className="font-semibold text-slate-800 truncate max-w-[120px]">{doc.personalNote.title}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400 italic">Sin vincular</span>
                        )}
                      </td>

                      {/* Cargado por */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        <div className="flex items-center space-x-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium">{doc.uploader?.fullName || 'Institucional'}</span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs">
                        <div className="inline-flex items-center space-x-2">
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id || isInfected}
                            className="btn-3d inline-flex items-center space-x-1 rounded-lg bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 transition border border-slate-200 shadow-sm disabled:opacity-50"
                            title="Descargar con URL firmada temporal"
                          >
                            <Download className="h-3.5 w-3.5 text-purple-600" />
                            <span className="hidden sm:inline font-semibold">Descargar</span>
                          </button>

                          <Link
                            href={`/vault/${doc.id}`}
                            className="btn-3d inline-flex items-center space-x-1 rounded-lg bg-white px-2 py-1 text-slate-700 hover:bg-slate-50 transition border border-slate-200 shadow-sm"
                            title="Ver ficha técnica"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                          </Link>

                          {(doc.uploader?.id === user?.id || canAdmin) && (
                            <button
                              onClick={() => handleDelete(doc.id, doc.originalFilename)}
                              className="btn-3d inline-flex items-center rounded-lg bg-white p-1 text-rose-600 hover:bg-rose-50 transition border border-slate-200 shadow-sm"
                              title="Eliminar de la bóveda"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Móvil: Cuadrícula de 2 Columnas de Tarjetas 3D Compactas */}
          <div className="grid grid-cols-2 gap-2.5 p-2.5 md:hidden bg-sky-50/40">
            {documents.map((doc) => {
              const cat = CATEGORY_CONFIG[doc.category] || {
                label: doc.category,
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
              };
              const isInfected = doc.scanStatus === 'INFECTADO';

              return (
                <div
                  key={doc.id}
                  className="rounded-2xl bg-white border-2 border-slate-300 border-b-[5px] border-b-blue-700 p-3 flex flex-col justify-between space-y-2 shadow-sm"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="shrink-0">{getFileIcon(doc.mimeType, doc.originalFilename)}</div>
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[8px] font-black truncate ${cat.badgeClass}`}>
                        {cat.label}
                      </span>
                    </div>

                    <Link
                      href={`/vault/${doc.id}`}
                      className="block text-xs font-extrabold text-slate-900 hover:text-blue-700 line-clamp-2 break-all leading-snug"
                    >
                      {doc.originalFilename}
                    </Link>

                    <div className="text-[9px] font-mono text-slate-500">
                      {formatBytes(doc.fileSizeBytes)} • v{doc.version}
                    </div>

                    {doc.meeting && (
                      <Link
                        href={`/meetings/${doc.meeting.id}`}
                        className="block text-[9px] font-bold text-blue-700 truncate"
                      >
                        Reunión: {doc.meeting.folio}
                      </Link>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id || isInfected}
                      className="flex-1 inline-flex items-center justify-center space-x-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-2 py-1.5 text-[10px] font-black text-white border border-sky-300 border-b-2 border-b-blue-950 disabled:opacity-50"
                    >
                      <Download className="h-3 w-3 shrink-0" />
                      <span className="truncate">Bajar</span>
                    </button>

                    <Link
                      href={`/vault/${doc.id}`}
                      className="inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 p-1.5 text-slate-700 border border-slate-300"
                      title="Ver detalle"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>

                    {(doc.uploader?.id === user?.id || canAdmin) && (
                      <button
                        onClick={() => handleDelete(doc.id, doc.originalFilename)}
                        className="inline-flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 p-1.5 text-rose-600 border border-rose-200"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
            <div>
              Mostrando <span className="font-bold text-slate-900">{documents.length}</span> de{' '}
              <span className="font-bold text-slate-900">{total}</span> documentos
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-3d rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
              >
                Anterior
              </button>
              <span className="font-medium">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-3d rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Carga de Archivo */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-white border-2 border-slate-300 border-b-[6px] border-b-slate-700 p-4 sm:p-7 shadow-2xl space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="rounded-xl bg-purple-100 p-2 text-purple-700">
                  <Upload className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Cargar Documento Seguro</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {uploadError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-800 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Archivo institucional (.pdf, .docx, .xlsx, .pptx, .png, .jpg, .txt, .csv)
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setUploadFile(f);
                  }}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer border border-slate-200 rounded-xl bg-slate-50 p-1.5 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Límite máximo: 25 MB. Cifrado SHA-256 e inspección estricta de cabecera binaria.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Categoría Documental
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                >
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Reunión Institucional a la que pertenece (Opcional)
                </label>
                <select
                  value={uploadMeetingId}
                  onChange={(e) => setUploadMeetingId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="">-- Sin vincular a una reunión específica --</option>
                  {availableMeetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.folio}] {m.title} {m.meetingDate ? `(${m.meetingDate})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Al seleccionar una reunión, este documento aparecerá automáticamente en el expediente de esa reunión.
                </p>
              </div>

              {availableAgreements.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Acuerdo Institucional Vinculado (Opcional)
                  </label>
                  <select
                    value={uploadAgreementId}
                    onChange={(e) => setUploadAgreementId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="">-- Sin vincular a un acuerdo específico --</option>
                    {availableAgreements.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.folio}] {a.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Descripción o Justificación Institucional (Opcional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  placeholder="Especifique el propósito del documento..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="btn-3d rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="btn-3d inline-flex items-center space-x-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Cargando y Cifrando...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      <span>Subir a la Bóveda</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VaultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      }
    >
      <VaultContent />
    </Suspense>
  );
}

