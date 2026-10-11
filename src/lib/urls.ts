/**
 * Toque — Generador Centralizado de Enlaces de Carteles y QRs
 * Resuelve dinámicamente la URL corta en el host y puerto activo de la aplicación
 * evitando dominios externos o no configurados (ej. toque.ar en desarrollo/preview).
 */

export const getShortUrl = (shortCode: string): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/r/${shortCode}`;
  }
  return `/r/${shortCode}`;
};

export const getShortUrlDisplay = (shortCode: string): string => {
  if (typeof window !== 'undefined' && window.location?.host) {
    return `${window.location.host}/r/${shortCode}`;
  }
  return `toque.app/r/${shortCode}`;
};
