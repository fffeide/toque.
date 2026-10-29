/**
 * Toque — cliente oficial de la API de WalletWallet (para el Worker de Cloudflare)
 *
 * Basado en https://www.walletwallet.dev/docs/
 *
 * Reglas:
 *  - Se usa SOLO desde el servidor tras verificar sesión o código por mail.
 *  - La clave (WALLETWALLET_API_KEY) es un secreto del Worker (`npx wrangler secret put WALLETWALLET_API_KEY`).
 *  - Nunca se devuelve "éxito" si WalletWallet falló. Los errores se informan con claridad.
 *  - Guardar en D1 por socio: barcode_token, last_stamped_at, wallet_serial, wallet_last_notification, last_notified_at, wallet_sync_error.
 */

const BASE = 'https://api.walletwallet.dev';

export interface Env {
  WALLETWALLET_API_KEY?: string;
}

export type ColorPreset = 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';

export interface CardInput {
  businessName: string;
  /** Vacío en las tarjetas "sin datos". */
  memberName?: string;
  stamps: number;
  stampsRequired: number;
  rewardText: string;
  /**
   * Lo que codifica el QR de la tarjeta. Tiene que ser un token aleatorio criptográfico largo (16+ caracteres)
   * que el servidor relaciona con el socio. Nunca un código corto adivinable.
   */
  barcodeToken: string;
  colorPreset?: ColorPreset;
  /**
   * El texto del último aviso. WalletWallet muestra la notificación en el celular cada vez que este
   * valor CAMBIA. Por eso hay que mandarlo igual en cada actualización (`updatePass`): si en una
   * actualización de sellos lo volvés a " ", el celular mostraría un aviso vacío.
   */
  notification?: string;
  /** Solo plan Pro. */
  locations?: { latitude: number; longitude: number; relevantText?: string }[];
  /** Solo plan Pro. */
  color?: string;
  /** Solo plan Pro. HTTPS o PNG en base64. */
  logoURL?: string;
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

export function generateBarcodeToken(): string {
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
  return body;
}

function headers(env: Env): Record<string, string> {
  if (!env.WALLETWALLET_API_KEY || !env.WALLETWALLET_API_KEY.trim()) {
    throw new WalletError(
      503,
      'not_configured',
      'Las tarjetas de billetera todavía no están configuradas en el servidor.'
    );
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.WALLETWALLET_API_KEY.trim()}`,
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
 * Actualiza la tarjeta (por ejemplo, un sello nuevo). Hay que mandar la tarjeta COMPLETA, no solo lo que cambió.
 * Cuenta contra el cupo solo si algo cambió; si es idéntica devuelve unchanged: true y no cuesta nada.
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

/** Invalida la tarjeta en todos los celulares (por ejemplo, cuando el cliente pide dar de baja su tarjeta). */
export async function revokePass(env: Env, serialNumber: string): Promise<void> {
  const res = await fetch(`${BASE}/api/passes/${encodeURIComponent(serialNumber)}`, {
    method: 'DELETE',
    headers: headers(env),
  });
  if (!res.ok) await fail(res);
}

/** Cuánto cupo queda este mes. Sirve para avisar antes de que se agote. */
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
