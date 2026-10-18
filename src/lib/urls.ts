/**
 * Construcción de URLs cortas para carteles QR / NFC y recibos digitales.
 */

export function buildPublicShortUrl(code: string): string {
  const envBase = import.meta.env.VITE_PUBLIC_SHORT_BASE;
  const base =
    envBase && typeof envBase === 'string' && envBase.trim().length > 0
      ? envBase.trim().replace(/\/+$/, '')
      : typeof window !== 'undefined'
      ? window.location.origin
      : 'https://toque.ar';

  return `${base}/h/${encodeURIComponent(code.trim().toUpperCase())}`;
}

export function buildDirectReceiptUrl(receiptId: string): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'https://toque.ar';
  return `${base}/r/${encodeURIComponent(receiptId.trim().toUpperCase())}`;
}
