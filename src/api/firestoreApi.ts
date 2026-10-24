/**
 * Toque — Adaptador de compatibilidad
 * Regla de Oro #1: NO se usa Firebase, Firestore ni localStorage como base de datos.
 * Toda operación pasa por ToqueApi (mockApi en memoria / httpApi hacia el servidor).
 */

import { mockApi } from './mockApi';
import { ToqueApi } from './ToqueApi';

export const firestoreApi: ToqueApi = mockApi;
