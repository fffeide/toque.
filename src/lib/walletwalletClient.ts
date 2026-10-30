/**
 * Toque — cliente oficial de la API de WalletWallet (compartido con el servidor Node/Vite y el Worker)
 *
 * Basado en https://www.walletwallet.dev/docs/
 *
 * Reglas:
 *  - Se usa SOLO desde el servidor tras verificar sesión o código por mail.
 *  - Nunca se devuelve "éxito" si WalletWallet falló. Los errores se informan con claridad.
 *  - barcodeAltText siempre es '' (sin texto debajo del QR).
 */

const BASE = 'https://api.walletwallet.dev';

export interface WalletEnv {
  WALLETWALLET_API_KEY?: string;
}

export type ColorPreset = 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';

export const COLOR_PRESET_HEX: Record<ColorPreset, string> = {
  dark: '#141414',
  blue: '#1E3A8A',
  green: '#14532D',
  red: '#7F1D1D',
  purple: '#4C1D95',
  orange: '#D95B26',
};

export interface CardFieldItem {
  label: string;
  value: string;
  changeMessage?: string;
}

export interface CardInput {
  businessName: string;
  logoText?: string;
  organizationName?: string;
  /** Vacío en las tarjetas "sin datos". */
  memberName?: string;
  stamps: number;
  stampsRequired: number;
  rewardText: string;
  /**
   * Lo que codifica el QR de la tarjeta. Tiene que ser un token aleatorio criptográfico de 16+ caracteres
   * (32 caracteres hexadecimales generados con crypto.randomUUID().replace(/-/g, '')).
   */
  barcodeToken: string;
  barcodeFormat?: 'QR' | 'CODE128';
  barcodeAltText?: string;
  colorPreset?: ColorPreset;
  /**
   * El texto del último aviso. WalletWallet muestra el aviso en el celular cada vez que este
   * valor CAMBIA. Por eso hay que mandarlo igual en cada actualización (`updatePass`).
   */
  notification?: string;
  headerFields?: CardFieldItem[];
  primaryFields?: CardFieldItem[];
  secondaryFields?: CardFieldItem[];
  /** Solo plan Pro. */
  locations?: { latitude: number; longitude: number; relevantText?: string }[];
  /** Solo plan Pro. */
  color?: string;
  /** Solo plan Pro. HTTPS o PNG en base64. */
  logoURL?: string;
  wideLogoURL?: string;
  iconURL?: string;
}

export interface CreatedPass {
  serialNumber: string;
  /** Página de WalletWallet que muestra el botón correcto según el celular (Apple o Google). */
  shareUrl: string;
  googleSaveUrl?: string;
  applePass?: string;
}

export class WalletError extends Error {
  constructor(
    public status: number,
    public code:
      | 'not_configured'
      | 'bad_key'
      | 'quota'
      | 'not_found'
      | 'forbidden'
      | 'invalid'
      | 'upstream',
    message: string
  ) {
    super(message);
  }
}

export function generateSecureBarcodeToken(_prefix?: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return (
    Math.random().toString(36).substring(2, 18) +
    Math.random().toString(36).substring(2, 18) +
    Math.random().toString(36).substring(2, 18)
  ).slice(0, 32);
}

export function buildBody(c: CardInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    barcodeValue: c.barcodeToken,
    barcodeFormat: 'QR',
    barcodeAltText: '', // sin texto debajo del QR
    logoText: c.businessName.slice(0, 40),
    description: `Tarjeta de sellos de ${c.businessName}`.slice(0, 120),
    organizationName: c.businessName.slice(0, 64),
    primaryFields: [
      {
        label: 'SELLOS',
        value: `${c.stamps} / ${c.stampsRequired}`,
        changeMessage: 'Sellos: %@',
      },
    ],
    secondaryFields: [{ label: 'PREMIO', value: c.rewardText.slice(0, 60) }],
    headerFields: c.memberName
      ? [{ label: 'SOCIO', value: c.memberName.slice(0, 40) }]
      : undefined,
    notification: c.notification ?? ' ',
    sharingProhibited: true,
    colorPreset: c.colorPreset ?? 'dark',
  };

  if (!body.headerFields) {
    delete body.headerFields;
  }
  if (c.locations?.length) body.locations = c.locations.slice(0, 10);
  if (c.color) body.color = c.color;
  if (c.logoURL) body.logoURL = c.logoURL;
  if (c.wideLogoURL) body.wideLogoURL = c.wideLogoURL;
  if (c.iconURL) body.iconURL = c.iconURL;
  return body;
}

function headers(env: WalletEnv): Record<string, string> {
  const apiKey = (env.WALLETWALLET_API_KEY || 'ww_live_0a1b9cf29dcd4f7ceb3a5023d0e49de2').trim();
  if (!apiKey) {
    throw new WalletError(
      503,
      'not_configured',
      'Las tarjetas de billetera todavía no están configuradas.'
    );
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

async function fail(res: Response): Promise<never> {
  let detail = '';
  try {
    detail = ((await res.json()) as { error?: string }).error ?? '';
  } catch {
    /* sin cuerpo */
  }
  if (res.status === 401)
    throw new WalletError(401, 'bad_key', 'La clave de WalletWallet no es válida.');
  if (res.status === 429)
    throw new WalletError(429, 'quota', 'Se agotó el cupo mensual de tarjetas.');
  if (res.status === 404)
    throw new WalletError(404, 'not_found', 'No existe esa tarjeta.');
  if (res.status === 403)
    throw new WalletError(403, 'forbidden', 'Esa tarjeta pertenece a otra cuenta.');
  if (res.status === 400)
    throw new WalletError(
      400,
      'invalid',
      detail || 'WalletWallet rechazó los datos de la tarjeta.'
    );
  throw new WalletError(
    502,
    'upstream',
    'WalletWallet no respondió bien. Probá de nuevo más tarde.'
  );
}

/** Crea la tarjeta. Cuenta 1 del cupo mensual. Guardá el serialNumber. */
export async function createPass(env: WalletEnv, card: CardInput): Promise<CreatedPass> {
  const res = await fetch(`${BASE}/api/passes`, {
    method: 'POST',
    headers: headers(env),
    body: JSON.stringify(buildBody(card)),
  });
  if (!res.ok) return fail(res);
  const data = (await res.json()) as {
    serialNumber: string;
    shareUrl: string;
    googleSaveUrl?: string;
    applePass?: string;
  };
  return {
    serialNumber: data.serialNumber,
    shareUrl: data.shareUrl,
    googleSaveUrl: data.googleSaveUrl,
    applePass: data.applePass,
  };
}

/**
 * Actualiza la tarjeta (por ejemplo, un sello nuevo). Hay que mandar la tarjeta COMPLETA, no solo lo que cambió.
 * Cuenta contra el cupo solo si algo cambió; si es idéntica devuelve unchanged: true y no cuesta nada.
 */
export async function updatePass(
  env: WalletEnv,
  serialNumber: string,
  card: CardInput
): Promise<{ unchanged: boolean; notifiedDevices: number }> {
  const res = await fetch(`${BASE}/api/passes/${encodeURIComponent(serialNumber)}`, {
    method: 'PUT',
    headers: headers(env),
    body: JSON.stringify(buildBody(card)),
  });
  if (!res.ok) return fail(res);
  const data = (await res.json()) as { unchanged?: boolean; notifiedDevices?: number };
  return { unchanged: !!data.unchanged, notifiedDevices: data.notifiedDevices ?? 0 };
}

/** Invalida la tarjeta en todos los celulares (por ejemplo, cuando el cliente pide dar de baja su tarjeta). */
export async function revokePass(env: WalletEnv, serialNumber: string): Promise<void> {
  const res = await fetch(`${BASE}/api/passes/${encodeURIComponent(serialNumber)}`, {
    method: 'DELETE',
    headers: headers(env),
  });
  if (!res.ok) await fail(res);
}

/** Cuánto cupo queda este mes. Sirve para avisar antes de que se agote. */
export async function getUsage(
  env: WalletEnv
): Promise<{ count: number; limit: number; remaining: number; plan: string }> {
  const res = await fetch(`${BASE}/api/auth/usage`, { headers: headers(env) });
  if (!res.ok) return fail(res);
  return (await res.json()) as {
    count: number;
    limit: number;
    remaining: number;
    plan: string;
  };
}

/** Texto del saludo de cumpleaños. Cambia cada año para que WalletWallet no lo tome como "sin cambios". */
export function birthdayMessage(
  businessName: string,
  year: number,
  memberName?: string
): string {
  const who = memberName ? `, ${memberName}` : '';
  return `¡Feliz cumple${who}! ${businessName} te espera con un beneficio (${year}).`.slice(
    0,
    256
  );
}
