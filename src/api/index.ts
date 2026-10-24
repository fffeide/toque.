/**
 * Toque — Selector de API
 * Regla de Oro 1: Todo pasa por ToqueApi (mockApi en memoria o httpApi hacia el servidor).
 * Sin Firebase, sin Firestore y sin localStorage como base de datos.
 */

import { ToqueApi } from './ToqueApi';
import { mockApi } from './mockApi';
import { httpApi } from './httpApi';

export * from './types';
export * from './ToqueApi';

const useHttp = import.meta.env.VITE_USE_HTTP_API === 'true';

export const api: ToqueApi = useHttp ? httpApi : mockApi;
