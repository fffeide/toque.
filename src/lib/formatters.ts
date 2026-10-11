/**
 * Toque — Formateadores Regionales
 * Zona horaria: America/Argentina/Buenos_Aires
 * Formato fecha: dd/mm/aaaa, 24 h
 * Moneda: pesos argentinos ($ 12.000)
 */

const TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Formatea un número como pesos argentinos con separador de miles por punto.
 * Ejemplo: 12000 -> "$ 12.000"
 */
export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `$ ${formatted}`;
}

/**
 * Formatea un número simple con separador de miles.
 * Ejemplo: 1450 -> "1.450"
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-AR').format(n);
}

/**
 * Formato de fecha dd/mm/aaaa en zona Buenos Aires.
 */
export function formatDate(isoStringOrDate: string | Date): string {
  const date = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Formato de fecha y hora dd/mm/aaaa, HH:mm en 24h.
 */
export function formatDateTime(isoStringOrDate: string | Date): string {
  const date = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Formato corto de hora HH:mm en 24h.
 */
export function formatTimeOnly(isoStringOrDate: string | Date): string {
  const date = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Tiempo relativo humano rioplatense.
 */
export function formatRelativeTime(isoStringOrDate: string | Date): string {
  const date = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Recién';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 30) return `Hace ${diffDays} días`;
  return formatDate(date);
}
