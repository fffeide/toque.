/**
 * Toque — Capa de Datos Unificada
 * Exporta el cliente activo con persistencia real en Google Cloud Firestore.
 */

import { ToqueApi } from './ToqueApi';
import { firestoreApi } from './firestoreApi';
import { mockApi } from './mockApi';
import { httpApi } from './httpApi';

export * from './types';
export * from './ToqueApi';

const apiMode = import.meta.env.VITE_API_MODE;

export const api: ToqueApi =
  apiMode === 'http' ? httpApi : apiMode === 'mock' ? mockApi : firestoreApi;

export { firestoreApi, mockApi, httpApi };
