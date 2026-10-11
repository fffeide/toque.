/**
 * Toque — Capa de Datos Unificada
 * Exporta el cliente activo según la variable de entorno VITE_API_MODE ('mock' | 'http').
 */

import { ToqueApi } from './ToqueApi';
import { mockApi } from './mockApi';
import { httpApi } from './httpApi';

export * from './types';
export * from './ToqueApi';

const apiMode = import.meta.env.VITE_API_MODE || 'mock';

export const api: ToqueApi = apiMode === 'http' ? httpApi : mockApi;
export { mockApi, httpApi };
