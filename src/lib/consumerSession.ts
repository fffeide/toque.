import { ClubMember, ConsumerReceipt } from '../api/types';

export const CONSUMER_TOKEN_KEY = 'toque_consumer_token';
export const CONSUMER_USER_KEY = 'toque_consumer_user';
const LEGACY_SESSION_KEY = 'toque_session';
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
  unauthorized?: boolean;
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
    localStorage.setItem(CONSUMER_TOKEN_KEY, sessionToken);
    localStorage.setItem(LEGACY_SESSION_KEY, sessionToken);
    if (email) {
      localStorage.setItem(SESSION_EMAIL_KEY, email.trim().toLowerCase());
    }
    if (profile) {
      const normalizedProfile: ConsumerSessionProfile = {
        id: profile.id || `usr-${Date.now().toString(36)}`,
        email: (profile.email || email || '').trim().toLowerCase(),
        fullName: (profile.fullName || 'Cliente').trim(),
        birthDate: profile.birthDate,
      };
      localStorage.setItem(CONSUMER_USER_KEY, JSON.stringify(normalizedProfile));
      localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(normalizedProfile));
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
    const primary = localStorage.getItem(CONSUMER_TOKEN_KEY);
    if (primary && primary.trim()) {
      return primary.trim();
    }
    const legacy = localStorage.getItem(LEGACY_SESSION_KEY);
    if (legacy && legacy.trim()) {
      return legacy.trim();
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

export function getSavedConsumerUser(): ConsumerSessionProfile | null {
  try {
    const rawPrimary = localStorage.getItem(CONSUMER_USER_KEY);
    if (rawPrimary) {
      const parsed = JSON.parse(rawPrimary);
      if (parsed && (parsed.email || parsed.fullName)) {
        return parsed;
      }
    }
    const rawLegacy = localStorage.getItem(SESSION_PROFILE_KEY);
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy);
      if (parsed && (parsed.email || parsed.fullName)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function getConsumerSessionEmail(): string {
  const savedUser = getSavedConsumerUser();
  if (savedUser?.email) {
    return savedUser.email.trim().toLowerCase();
  }
  try {
    return (localStorage.getItem(SESSION_EMAIL_KEY) || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

export function clearConsumerSession(): void {
  try {
    localStorage.removeItem(CONSUMER_TOKEN_KEY);
    localStorage.removeItem(CONSUMER_USER_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
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
  const savedUser = getSavedConsumerUser();
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
    if (res.status === 401) {
      // Si tenemos sesión local válida en el entorno de vista previa, mantenerla salvo que no exista usuario local
      if (savedUser) {
        return {
          authenticated: true,
          user: savedUser,
          cards: [],
          receipts: [],
        };
      }
      return { authenticated: false, unauthorized: true, user: null, cards: [], receipts: [] };
    }
    if (res.ok) {
      const data = await res.json();
      if (data && data.authenticated && data.user) {
        saveConsumerSession(token, data.user.email, data.user);
        return {
          authenticated: true,
          user: data.user,
          cards: Array.isArray(data.cards) ? data.cards : [],
          receipts: Array.isArray(data.receipts) ? data.receipts : [],
        };
      }
    }
  } catch {
    // Error de red temporal: mantener la sesión local activa
  }

  if (savedUser) {
    return {
      authenticated: true,
      user: savedUser,
      cards: [],
      receipts: [],
    };
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
  const pkpassUrl = params.appleWalletUrl || '';

  if (isIOSDevice()) {
    if (pkpassUrl) window.location.assign(pkpassUrl);
    return;
  }

  if (isAndroidDevice() && params.googleWalletUrl) {
    window.location.assign(params.googleWalletUrl);
    return;
  }

  if (params.googleWalletUrl) {
    window.location.assign(params.googleWalletUrl);
    return;
  }

  if (pkpassUrl && params.onDesktopFallback) {
    params.onDesktopFallback(pkpassUrl);
  } else if (pkpassUrl) {
    window.location.assign(pkpassUrl);
  }
}
