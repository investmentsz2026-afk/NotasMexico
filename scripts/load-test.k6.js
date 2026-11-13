/**
 * ==============================================================================
 * MEXAGENDA — SCRIPT OFICIAL DE PRUEBAS DE CARGA Y ESTRÉS CON K6 (FASE 9)
 * ==============================================================================
 * Ejecución con binario k6:
 *   k6 run -e BASE_URL=http://localhost:4000 -e SESSION_TOKEN=<token> scripts/load-test.k6.js
 *
 * Criterios de Aceptación Institucionales:
 * - concurrencia pico: 50 Usuarios Virtuales Simultáneos (50 VUs)
 * - tasa de fallos HTTP (http_req_failed): < 1% (0.01)
 * - latencia percentil 95 (http_req_duration p95): < 1500 ms (sobre Neon Serverless)
 * ==============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 15 }, // Rampa inicial a 15 VUs
    { duration: '20s', target: 50 }, // Carga pico institucional: 50 VUs simultáneos
    { duration: '10s', target: 0 },  // Enfriamiento gradual
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const SESSION_TOKEN = __ENV.SESSION_TOKEN || '';

export default function () {
  const params = {
    headers: {
      Authorization: `Bearer ${SESSION_TOKEN}`,
      Accept: 'application/json',
    },
  };

  // 1. Verificación de salud
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
  });

  // 2. Consulta de sesiones colegiadas
  const meetingsRes = http.get(`${BASE_URL}/api/v1/meetings?page=1&limit=10`, params);
  check(meetingsRes, {
    'meetings status 200': (r) => r.status === 200,
  });

  // 3. Consulta de acuerdos institucionales
  const agreementsRes = http.get(`${BASE_URL}/api/v1/agreements?page=1&limit=10`, params);
  check(agreementsRes, {
    'agreements status 200': (r) => r.status === 200,
  });

  // 4. Consulta de notificaciones no leídas
  const notifRes = http.get(`${BASE_URL}/api/v1/notifications/unread-count`, params);
  check(notifRes, {
    'notifications status 200': (r) => r.status === 200,
  });

  // 5. Consulta de tablero de seguimiento de acuerdos
  const reportsRes = http.get(`${BASE_URL}/api/v1/reports/agreements?page=1&limit=10`, params);
  check(reportsRes, {
    'reports status 200': (r) => r.status === 200,
  });

  sleep(0.5);
}

