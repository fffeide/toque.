/**
 * Toque — cliente oficial de WalletWallet para el Worker
 *
 * Basado en https://www.walletwallet.dev/docs/
 *
 * Reglas:
 *  - Se usa desde el servidor tras verificar sesión o código por correo.
 *  - Nunca se devuelve "éxito" si WalletWallet falló. Los errores se informan con claridad.
 *  - Guardar por cliente: barcode_token (8 dígitos numéricos), last_stamped_at, wallet_serial, wallet_apple_base64, wallet_google_url, wallet_last_notification, wallet_sync_error.
 */

const BASE = 'https://api.walletwallet.dev';

export interface Env {
  WALLETWALLET_API_KEY?: string;
}

export type ColorPreset = 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';

export interface CardInput {
  businessName: string;
  memberName?: string;
  stamps: number;
  stampsRequired: number;
  rewardText: string;
  /** Código numérico único de 8 dígitos para el código de barras CODE128 */
  barcodeToken: string;
  colorPreset?: ColorPreset;
  notification?: string;
  locations?: { latitude: number; longitude: number; relevantText?: string }[];
  color?: string;
  logoURL?: string;
}

export interface CreatedPass {
  serialNumber: string;
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

/** Genera un código numérico único de 8 dígitos (ej. "48291037") */
export function generateBarcodeToken(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < 8; i++) {
      const digit = i === 0 ? (bytes[i] % 9) + 1 : bytes[i] % 10;
      out += String(digit);
    }
    return out;
  }
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export function buildBody(c: CardInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    barcodeValue: c.barcodeToken,
    barcodeFormat: 'CODE128',
    barcodeAltText: c.barcodeToken,
    logoText: c.businessName.slice(0, 40),
    description: `Tarjeta de sellos de ${c.businessName}`.slice(0, 120),
    organizationName: c.businessName.slice(0, 64),
    primaryFields: [
      {
        label: 'Sellos',
        value: `${c.stamps} / ${c.stampsRequired}`,
        changeMessage: 'Puntos acumulados: %@',
      },
    ],
    secondaryFields: [{ label: 'Premio', value: c.rewardText.slice(0, 60) }],
    headerFields: c.memberName
      ? [{ label: 'Cliente', value: c.memberName.slice(0, 40) }]
      : undefined,
    notification: c.notification ?? ' ',
    sharingProhibited: true,
    colorPreset: c.colorPreset ?? 'dark',
  };
  if (!body.headerFields) delete body.headerFields;
  if (c.locations?.length) body.locations = c.locations.slice(0, 10);
  if (c.color) body.color = c.color;
  if (c.logoURL) body.logoURL = c.logoURL;
  return body;
}

function headers(env: Env): Record<string, string> {
  const apiKey = (env.WALLETWALLET_API_KEY || 'ww_live_0a1b9cf29dcd4f7ceb3a5023d0e49de2').trim();
  if (!apiKey) {
    throw new WalletError(
      503,
      'not_configured',
      'Las tarjetas de billetera todavía no están configuradas en el servidor.'
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
    throw new WalletError(401, 'bad_key', 'La clave de billetera no es válida.');
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
      detail || 'Los datos de la tarjeta no pudieron validarse.'
    );
  throw new WalletError(
    502,
    'upstream',
    'El servicio de billetera no respondió bien. Probá de nuevo más tarde.'
  );
}

/** Crea la tarjeta y devuelve serialNumber, shareUrl, googleSaveUrl y applePass (base64 .pkpass). */
export async function createPass(env: Env, card: CardInput): Promise<CreatedPass> {
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
 * Actualiza la tarjeta enviando el diseño y datos completos.
 */
export async function updatePass(
  env: Env,
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

/** Invalida la tarjeta en todos los celulares. */
export async function revokePass(env: Env, serialNumber: string): Promise<void> {
  const res = await fetch(`${BASE}/api/passes/${encodeURIComponent(serialNumber)}`, {
    method: 'DELETE',
    headers: headers(env),
  });
  if (!res.ok) await fail(res);
}

/** Consulta el cupo mensual disponible. */
export async function getUsage(
  env: Env
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

/** Texto del saludo de cumpleaños. */
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
