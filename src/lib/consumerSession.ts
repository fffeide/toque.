import { ClubMember, ConsumerReceipt } from '../api/types';

const SESSION_KEY = 'toque_session';
const SESSION_EMAIL_KEY = 'toque_session_email';
const SESSION_PROFILE_KEY = 'toque_session_profile';

export interface ConsumerSessionProfile {
  id: string;
  email: string;
  fullName: string;
  birthDate?: string;
}

export interface ConsumerMeResponse {
  authenticated: boolean;
  user: ConsumerSessionProfile | null;
  cards: ClubMember[];
  receipts: ConsumerReceipt[];
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function saveConsumerSession(
  sessionToken: string,
  email?: string,
  profile?: Partial<ConsumerSessionProfile>
): void {
  if (!sessionToken) return;
  try {
    localStorage.setItem(SESSION_KEY, sessionToken);
    if (email) {
      localStorage.setItem(SESSION_EMAIL_KEY, email.trim().toLowerCase());
    }
    if (profile) {
      localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(profile));
    }
  } catch {
    // ignore storage errors
  }
  try {
    document.cookie = `toque_session=${sessionToken}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // ignore cookie errors
  }
}

export function getConsumerSessionToken(): string {
  try {
    const fromStorage = localStorage.getItem(SESSION_KEY);
    if (fromStorage && fromStorage.trim()) {
      return fromStorage.trim();
    }
  } catch {
    // ignore
  }
  try {
    const match = document.cookie.match(/(?:^|;\s*)toque_session=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1].trim());
    }
  } catch {
    // ignore
  }
  return '';
}

export function getConsumerSessionEmail(): string {
  try {
    return (localStorage.getItem(SESSION_EMAIL_KEY) || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

export function clearConsumerSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_EMAIL_KEY);
    localStorage.removeItem(SESSION_PROFILE_KEY);
  } catch {
    // ignore
  }
  try {
    document.cookie = 'toque_session=; path=/; max-age=0; SameSite=Lax';
  } catch {
    // ignore
  }
}

export async function fetchConsumerMe(): Promise<ConsumerMeResponse> {
  const token = getConsumerSessionToken();
  if (!token) {
    return { authenticated: false, user: null, cards: [], receipts: [] };
  }
  try {
    const res = await fetch('/api/consumer/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.authenticated && data.user) {
        return {
          authenticated: true,
          user: data.user,
          cards: Array.isArray(data.cards) ? data.cards : [],
          receipts: Array.isArray(data.receipts) ? data.receipts : [],
        };
      }
    }
  } catch {
    // fallback handled by caller
  }
  return { authenticated: false, user: null, cards: [], receipts: [] };
}

/**
 * Abre directamente el pase en Apple Wallet (.pkpass) o Google Wallet (wallet_google_url)
 * sin pasar por la página intermedia shareUrl de WalletWallet.
 */
export function triggerDirectWalletSave(params: {
  barcodeToken: string;
  googleWalletUrl?: string;
  appleWalletUrl?: string;
  onDesktopFallback?: (pkpassUrl: string) => void;
}): void {
  const cleanBarcode = (params.barcodeToken || '48291037').trim();
  const pkpassUrl = `/api/wallet/pass/${encodeURIComponent(cleanBarcode)}.pkpass`;

  if (isIOSDevice()) {
    window.location.href = pkpassUrl;
    return;
  }

  if (isAndroidDevice() && params.googleWalletUrl) {
    window.location.href = params.googleWalletUrl;
    return;
  }

  if (params.googleWalletUrl && !isIOSDevice()) {
    window.location.href = params.googleWalletUrl;
    return;
  }

  if (params.onDesktopFallback) {
    params.onDesktopFallback(pkpassUrl);
  } else {
    window.location.href = pkpassUrl;
  }
}
