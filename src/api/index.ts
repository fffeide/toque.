/**
 * Toque — Selector de API
 * Conecta toda la aplicación con Cloud Firestore en tiempo real + RLS.
 */

import { ToqueApi } from './ToqueApi';
import { firestoreApi } from './firestoreApi';

export * from './types';
export * from './ToqueApi';

export const api: ToqueApi = firestoreApi;
