/**
 * Toque — Módulo Recibo: Selector de API
 * Selecciona la implementación según la variable de entorno VITE_API_MODE ("mock" o "http").
 * Por defecto utiliza mockApi en memoria.
 */

import { ToqueApi } from './ToqueApi';
import { mockApi } from './mockApi';
import { httpApi } from './httpApi';

export * from './types';
export * from './ToqueApi';

const apiMode = import.meta.env.VITE_API_MODE;

export const api: ToqueApi = apiMode === 'http' ? httpApi : mockApi;
