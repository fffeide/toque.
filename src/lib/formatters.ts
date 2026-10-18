/**
 * Toque — Formateadores de Pesos Argentinos (ARS), Fechas, Horarios y Medios de Pago
 */

import { PaymentMethod } from '../api/types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string): string {
  return formatDate(isoString);
}

export function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatPaymentMethod(method: PaymentMethod): string {
  switch (method) {
    case 'mp_qr':
      return 'Mercado Pago QR';
    case 'cash':
      return 'Efectivo';
    case 'card_manual':
      return 'Tarjeta / Posnet';
    default:
      return method;
  }
}
