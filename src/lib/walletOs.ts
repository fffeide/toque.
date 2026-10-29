export type WalletOS = 'apple' | 'google';

/**
 * Detecta el sistema operativo del dispositivo para mostrar el botón correspondiente
 * de Apple Wallet (iOS / iPadOS / macOS) o Google Wallet (Android / Windows / Linux).
 */
export function detectWalletOS(): WalletOS {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'google';
  }
  const ua = navigator.userAgent || navigator.vendor || '';
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

  const isApple =
    /iPhone|iPad|iPod|Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua) ||
    /iPhone|iPad|iPod|Mac/i.test(platform);

  if (isApple) {
    return 'apple';
  }
  return 'google';
}

export function getWalletButtonLabel(os?: WalletOS): string {
  const detected = os || detectWalletOS();
  return detected === 'apple' ? 'Guardar en Apple Wallet' : 'Guardar en Google Wallet';
}
