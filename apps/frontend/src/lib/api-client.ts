import { ApiResponse, ApiErrorResponse } from '@mexagenda/shared';

const BACKEND_URL =
  process.env.BACKEND_SERVICE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (typeof window !== 'undefined' ? '' : 'http://localhost:4000');

export class ApiClientError extends Error {
  constructor(public readonly problem: ApiErrorResponse) {
    super(problem.detail || problem.title);
    this.name = 'ApiClientError';
  }
}

/**
 * Cliente HTTP estandarizado para la comunicación del frontend con la API de MexAgenda.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BACKEND_URL}/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // Para transmisión de cookies HttpOnly seguras
  });

  if (!response.ok) {
    let errorPayload: ApiErrorResponse;
    try {
      errorPayload = await response.json();
    } catch {
      errorPayload = {
        type: `https://mexagenda.org/errors/${response.status}`,
        title: response.statusText,
        status: response.status,
        detail: `Error en la solicitud HTTP (${response.status})`,
        instance: endpoint,
        timestamp: new Date().toISOString(),
      };
    }
    throw new ApiClientError(errorPayload);
  }

  // Si la respuesta es 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const json: ApiResponse<T> = await response.json();
  return json.data;
}
