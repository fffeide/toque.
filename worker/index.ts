/**
 * Worker Entrypoint para Toque — Parche de Seguridad
 * - Clave de WalletWallet leída únicamente de env.WALLETWALLET_API_KEY en el Worker.
 * - Sesiones separadas y seguras en cookies HttpOnly: toque_merchant_session (30 días) y toque_session (180 días).
 * - Códigos de verificación de 6 dígitos enviados con Resend, guardados con SHA-256 en KV, límite de intentos y un solo uso.
 * - Identidad de comercio y cliente obtenida exclusivamente de la sesión validada en D1.
 */

import {
  createPass,
  updatePass,
  revokePass,
  getUsage,
  WalletError,
  generateBarcodeToken,
  ColorPreset,
  CardInput,
} from './walletwallet';

const COOLDOWN_24H_MS = 86400000;
const RECENT_STAMP_WINDOW_MS = 120000; // 2 minutos
const RECEIPT_CLAIM_WINDOW_MS = 90000; // 90 segundos
const MAX_RECEIPT_DISTANCE_METERS = 120;

const MERCHANT_SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 días
const CONSUMER_SESSION_MAX_AGE = 180 * 24 * 60 * 60; // 180 días

export interface D1Database {
  prepare: (query: string) => {
    bind: (...values: any[]) => {
      first: <T = any>() => Promise<T | null>;
      run: () => Promise<any>;
      all: <T = any>() => Promise<{ results: T[] }>;
    };
  };
}

export interface KVNamespace {
  get: (key: string, type?: 'text' | 'json') => Promise<any>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export interface ExecutionContext {
  waitUntil: (promise: Promise<any>) => void;
}

export interface Env {
  ASSETS: {
    fetch: (request: Request | string, init?: RequestInit) => Promise<Response>;
  };
  DB?: D1Database;
  KV?: KVNamespace;
  WALLETWALLET_API_KEY?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  GEMINI_API_KEY?: string;
  VITE_PUBLIC_SHORT_BASE?: string;
}

interface EdgeCartelRecord {
  code: string;
  claim_status: 'unclaimed' | 'claimed';
  mode: 'direct_review' | 'smart_hub';
  tile_color?: 'white' | 'black';
  review_url?: string;
  tenant_id?: string;
}

interface D1MerchantUserRow {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: string;
  session_token?: string | null;
  created_at: string;
}

interface D1ConsumerUserRow {
  id: string;
  email: string;
  full_name: string;
  birth_date?: string | null;
  session_token?: string | null;
  created_at: string;
}

interface D1LoyaltyMemberRow {
  id: string;
  consumer_id?: string | null;
  tenant_id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  contact?: string | null;
  name?: string | null;
  birth_day?: number | null;
  birth_month?: number | null;
  points?: number;
  stamps: number;
  stamps_required?: number | null;
  rewards_redeemed?: number | null;
  barcode_token: string;
  last_stamped_at?: string | null;
  wallet_serial?: string | null;
  wallet_apple_base64?: string | null;
  wallet_google_url?: string | null;
  wallet_download_token?: string | null;
  wallet_last_notification?: string | null;
  last_notified_at?: string | null;
  wallet_sync_error?: string | null;
  created_at?: string | null;
}

interface D1HubConfigRow {
  tenant_id: string;
  business_name?: string | null;
  loyalty_title?: string | null;
  loyalty_reward?: string | null;
  reward_text?: string | null;
  stamps_required?: number | null;
  reward_value_ars?: number | null;
  brand_color?: string | null;
  color_preset?: string | null;
  custom_color?: string | null;
  logo_url?: string | null;
  last_stamped_consumer_id?: string | null;
  last_stamped_at_ms?: number | null;
  store_lat?: number | null;
  store_lng?: number | null;
}

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(extraHeaders || {}),
    },
  });
}

function readCookie(request: Request, name: string): string {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1].trim()) : '';
}

async function getMerchantSession(request: Request, env: Env) {
  const token = readCookie(request, 'toque_merchant_session');
  if (!token || !env.DB) return null;
  const row = await env.DB
    .prepare('SELECT id, tenant_id, email, role, name FROM users WHERE session_token = ? LIMIT 1')
    .bind(token)
    .first<{ id: string; tenant_id: string; email: string; role: string; name?: string }>();
  return row
    ? {
        userId: row.id,
        tenantId: row.tenant_id,
        email: row.email,
        role: row.role,
        name: row.name || '',
      }
    : null;
}

async function getConsumerSession(request: Request, env: Env) {
  const token = readCookie(request, 'toque_session');
  if (!token || !env.DB) return null;
  const row = await env.DB
    .prepare(
      'SELECT id, email, full_name, birth_date, created_at FROM consumer_users WHERE session_token = ? LIMIT 1'
    )
    .bind(token)
    .first<{
      id: string;
      email: string;
      full_name: string;
      birth_date?: string | null;
      created_at?: string;
    }>();
  return row
    ? {
        consumerId: row.id,
        email: row.email,
        fullName: row.full_name,
        birthDate: row.birth_date || null,
        createdAt: row.created_at || '',
      }
    : null;
}

function buildMerchantCookie(token: string): string {
  return `toque_merchant_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MERCHANT_SESSION_MAX_AGE}`;
}

function clearMerchantCookie(): string {
  return 'toque_merchant_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

function buildConsumerCookie(token: string): string {
  return `toque_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${CONSUMER_SESSION_MAX_AGE}`;
}

function clearConsumerCookie(): string {
  return 'toque_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generate6DigitOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

function normalizeOtpPurpose(raw?: string): 'merchant' | 'consumer' {
  const p = String(raw || '').trim().toLowerCase();
  if (p === 'consumer' || p === 'register_client' || p === 'client_card') {
    return 'consumer';
  }
  return 'merchant';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function verifyAndConsumeOtp(
  env: Env,
  email: string,
  code: string,
  purpose: 'merchant' | 'consumer'
): Promise<boolean> {
  if (!env.KV || !/^\d{6}$/.test(code)) return false;
  const key = `otp:${purpose}:${email}`;
  const stored = (await env.KV.get(key, 'json').catch(() => null)) as {
    h?: string;
    tries?: number;
  } | null;

  if (!stored || typeof stored.h !== 'string') {
    return false;
  }

  const tries = Number(stored.tries || 0);
  if (tries >= 5) {
    await env.KV.delete(key).catch(() => {});
    return false;
  }

  const expectedHash = await sha256(`${code}:${email}:${purpose}`);
  if (stored.h !== expectedHash) {
    const nextTries = tries + 1;
    if (nextTries >= 5) {
      await env.KV.delete(key).catch(() => {});
    } else {
      await env.KV
        .put(key, JSON.stringify({ h: stored.h, tries: nextTries }), { expirationTtl: 600 })
        .catch(() => {});
    }
    return false;
  }

  await env.KV.delete(key).catch(() => {});
  return true;
}

async function generateUnique8DigitBarcode(db?: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const candidate = generateBarcodeToken();
    if (!db) return candidate;
    try {
      const existing = await db
        .prepare('SELECT id FROM loyalty_members WHERE barcode_token = ? LIMIT 1')
        .bind(candidate)
        .first<{ id: string }>();
      if (!existing) return candidate;
    } catch {
      return candidate;
    }
  }
  return generateBarcodeToken();
}

function normalize8DigitToken(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 8) return digits;
  return '';
}

/** Token aleatorio de 256 bits para descargas de un solo uso */
function generateRandomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createOneTimeWalletDownloadUrl(
  env: Env,
  memberId: string
): Promise<string | undefined> {
  const token = generateRandomToken();
  if (env.KV) {
    await env.KV.put(`wallet_dl:${token}`, memberId, { expirationTtl: 300 });
    return `/api/wallet/p/${token}`;
  }
  if (env.DB) {
    await env.DB
      .prepare('UPDATE loyalty_members SET wallet_download_token = ? WHERE id = ?')
      .bind(token, memberId)
      .run()
      .catch(() => {});
    return `/api/wallet/p/${token}`;
  }
  return undefined;
}

function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatShortCustomerName(fullName?: string | null): string {
  const clean = String(fullName || 'Cliente').trim();
  if (!clean) return 'Cliente';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // 1. Healthcheck
    if (pathname === '/healthz' || pathname === '/api/healthz') {
      return jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    }

    // Ruta /api/debug/clean-orphans eliminada permanentemente -> 404
    if (pathname === '/api/debug/clean-orphans') {
      return jsonResponse({ error: 'Ruta no encontrada.' }, 404);
    }

    // Ruta /api/auth/login eliminada permanentemente -> 404
    if (pathname === '/api/auth/login') {
      return jsonResponse({ error: 'Usá el ingreso con código de verificación por correo.' }, 404);
    }

    // 2. Envío de código OTP por correo con Resend y límite en KV: POST /api/auth/send-otp
    if (pathname === '/api/auth/send-otp' && request.method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          email?: string;
          purpose?: string;
        };
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        if (!cleanEmail || !isValidEmail(cleanEmail)) {
          return jsonResponse({ error: 'Ingresá un correo válido.' }, 400);
        }

        const purpose = normalizeOtpPurpose(body.purpose);
        if (!env.KV) {
          return jsonResponse({ error: 'El servicio de verificación no está disponible.' }, 503);
        }

        const clientIp =
          request.headers.get('CF-Connecting-IP') ||
          request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
          'unknown';

        const emailRateKey = `rl:otp:mail:${cleanEmail}`;
        const ipRateKey = `rl:otp:ip:${clientIp}`;

        const [emailCountRaw, ipCountRaw] = await Promise.all([
          env.KV.get(emailRateKey, 'text'),
          env.KV.get(ipRateKey, 'text'),
        ]);
        const emailCount = Number(emailCountRaw || '0');
        const ipCount = Number(ipCountRaw || '0');

        if (emailCount >= 3 || ipCount >= 10) {
          return jsonResponse(
            { error: 'Demasiados envíos. Esperá unos minutos antes de pedir otro código.' },
            429
          );
        }

        await Promise.all([
          env.KV.put(emailRateKey, String(emailCount + 1), { expirationTtl: 600 }),
          env.KV.put(ipRateKey, String(ipCount + 1), { expirationTtl: 3600 }),
        ]);

        const code = generate6DigitOtp();
        const hash = await sha256(`${code}:${cleanEmail}:${purpose}`);
        await env.KV.put(`otp:${purpose}:${cleanEmail}`, JSON.stringify({ h: hash, tries: 0 }), {
          expirationTtl: 600,
        });

        if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
          return jsonResponse(
            { error: 'El envío de correos no está configurado en el servidor.' },
            503
          );
        }

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            from: env.MAIL_FROM.trim(),
            to: [cleanEmail],
            subject: 'Tu código de Toque',
            text: `Tu código es ${code}. Vence en 10 minutos. Si no lo pediste, ignorá este mensaje.`,
          }),
        });

        if (!resendRes.ok) {
          return jsonResponse(
            { error: 'No pudimos enviar el correo en este momento. Intentá de nuevo.' },
            502
          );
        }

        return jsonResponse({ ok: true });
      } catch {
        return jsonResponse({ error: 'No pudimos enviar el código de verificación.' }, 400);
      }
    }

    // 3. Verificación estricta de código OTP: POST /api/auth/verify-otp y POST /api/consumer/verify-code
    if (
      (pathname === '/api/auth/verify-otp' || pathname === '/api/consumer/verify-code') &&
      request.method === 'POST'
    ) {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          email?: string;
          code?: string;
          purpose?: string;
        };
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const cleanCode = String(body.code || '').trim();

        if (!cleanEmail || !isValidEmail(cleanEmail) || !/^\d{6}$/.test(cleanCode)) {
          return jsonResponse({ error: 'Código incorrecto o vencido' }, 400);
        }

        const purpose: 'merchant' | 'consumer' =
          pathname === '/api/consumer/verify-code'
            ? 'consumer'
            : normalizeOtpPurpose(body.purpose);

        const isValid = await verifyAndConsumeOtp(env, cleanEmail, cleanCode, purpose);
        if (!isValid) {
          return jsonResponse({ error: 'Código incorrecto o vencido' }, 400);
        }

        if (!env.DB) {
          return jsonResponse({ error: 'Base de datos no disponible.' }, 503);
        }

        // Flujo Comercio
        if (purpose === 'merchant') {
          const existingMerchant = await env.DB
            .prepare(
              'SELECT id, tenant_id, email, name, role FROM users WHERE LOWER(email) = ? LIMIT 1'
            )
            .bind(cleanEmail)
            .first<D1MerchantUserRow>();

          if (existingMerchant) {
            const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
            await env.DB
              .prepare('UPDATE users SET session_token = ? WHERE id = ?')
              .bind(sessionToken, existingMerchant.id)
              .run();

            return jsonResponse(
              {
                ok: true,
                verified: true,
                accountExists: true,
                needsRegistration: false,
                user: {
                  id: existingMerchant.id,
                  email: existingMerchant.email,
                  name: existingMerchant.name,
                  role: existingMerchant.role,
                  businessId: existingMerchant.tenant_id,
                },
              },
              200,
              {
                'Set-Cookie': buildMerchantCookie(sessionToken),
              }
            );
          }

          if (env.KV) {
            await env.KV.put(`verified:merchant:${cleanEmail}`, '1', { expirationTtl: 900 });
          }

          return jsonResponse({
            ok: true,
            verified: true,
            accountExists: false,
            needsRegistration: true,
          });
        }

        // Flujo Cliente
        let userRow = await env.DB
          .prepare(
            'SELECT id, email, full_name, birth_date, created_at FROM consumer_users WHERE LOWER(email) = ? LIMIT 1'
          )
          .bind(cleanEmail)
          .first<D1ConsumerUserRow>();

        if (!userRow) {
          const memberMatch = await env.DB
            .prepare(
              `SELECT id, customer_name, name, birth_day, birth_month
               FROM loyalty_members
               WHERE LOWER(customer_email) = ? OR LOWER(contact) = ?
               ORDER BY created_at DESC LIMIT 1`
            )
            .bind(cleanEmail, cleanEmail)
            .first<{
              id: string;
              customer_name?: string | null;
              name?: string | null;
              birth_day?: number | null;
              birth_month?: number | null;
            }>();

          const foundName = (memberMatch?.customer_name || memberMatch?.name || '').trim();
          if (memberMatch && foundName) {
            const newUserId = crypto.randomUUID();
            const birthDateStr =
              memberMatch.birth_day && memberMatch.birth_month
                ? `1995-${String(memberMatch.birth_month).padStart(2, '0')}-${String(
                    memberMatch.birth_day
                  ).padStart(2, '0')}`
                : null;
            const nowIso = new Date().toISOString();

            await env.DB
              .prepare(
                `INSERT INTO consumer_users (id, email, full_name, birth_date, created_at)
                 VALUES (?, ?, ?, ?, ?)`
              )
              .bind(newUserId, cleanEmail, foundName, birthDateStr, nowIso)
              .run();

            await env.DB
              .prepare(
                `UPDATE loyalty_members SET consumer_id = ?
                 WHERE LOWER(customer_email) = ? OR LOWER(contact) = ?`
              )
              .bind(newUserId, cleanEmail, cleanEmail)
              .run()
              .catch(() => {});

            userRow = {
              id: newUserId,
              email: cleanEmail,
              full_name: foundName,
              birth_date: birthDateStr,
              created_at: nowIso,
            };
          }
        }

        if (userRow && userRow.full_name && userRow.full_name.trim().length > 0) {
          const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
          await env.DB
            .prepare('UPDATE consumer_users SET session_token = ? WHERE id = ?')
            .bind(sessionToken, userRow.id)
            .run();

          return jsonResponse(
            {
              ok: true,
              verified: true,
              success: true,
              accountExists: true,
              needsRegistration: false,
              verifiedEmail: cleanEmail,
              user: {
                id: userRow.id,
                email: userRow.email,
                fullName: userRow.full_name,
                birthDate: userRow.birth_date || undefined,
              },
            },
            200,
            {
              'Set-Cookie': buildConsumerCookie(sessionToken),
            }
          );
        }

        if (env.KV) {
          await env.KV.put(`verified:consumer:${cleanEmail}`, '1', { expirationTtl: 900 });
        }

        return jsonResponse({
          ok: true,
          verified: true,
          success: true,
          accountExists: false,
          needsRegistration: true,
          verifiedEmail: cleanEmail,
          email: cleanEmail,
        });
      } catch {
        return jsonResponse({ error: 'Código incorrecto o vencido' }, 400);
      }
    }

    // 4. Sesiones de Comercio: GET /api/auth/me, POST /api/auth/register, POST /api/auth/logout
    if (pathname === '/api/auth/me' && request.method === 'GET') {
      const session = await getMerchantSession(request, env);
      if (!session) {
        return jsonResponse({ authenticated: false, error: 'Iniciá sesión.' }, 401);
      }

      return jsonResponse({
        authenticated: true,
        user: {
          id: session.userId,
          email: session.email,
          name: session.name,
          role: session.role,
          businessId: session.tenantId,
        },
      });
    }

    if (pathname === '/api/auth/register' && request.method === 'POST') {
      try {
        if (!env.DB || !env.KV) {
          return jsonResponse({ error: 'Servicio no disponible.' }, 503);
        }

        const body = (await request.json().catch(() => ({}))) as {
          email?: string;
          name?: string;
          ownerName?: string;
          businessName?: string;
        };
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const displayName = String(body.ownerName || body.name || '').trim();
        const businessName = String(body.businessName || displayName || 'Mi comercio').trim();

        if (!cleanEmail || !isValidEmail(cleanEmail) || !businessName) {
          return jsonResponse({ error: 'Completá tu correo y el nombre del comercio.' }, 400);
        }

        const verifiedFlag = await env.KV.get(`verified:merchant:${cleanEmail}`, 'text');
        if (!verifiedFlag) {
          return jsonResponse(
            { error: 'Primero verificá tu correo con el código de 6 dígitos.' },
            403
          );
        }

        const existingUser = await env.DB
          .prepare('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1')
          .bind(cleanEmail)
          .first<{ id: string }>();

        if (existingUser) {
          await env.KV.delete(`verified:merchant:${cleanEmail}`).catch(() => {});
          return jsonResponse(
            { error: 'Ya existe una cuenta con ese correo. Iniciá sesión.' },
            409
          );
        }

        const tenantId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        const role = 'owner';
        const ownerDisplay = displayName || cleanEmail.split('@')[0] || 'Titular';
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
        const nowIso = new Date().toISOString();
        const slug = `${businessName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}-${tenantId.slice(0, 6)}`;

        await env.DB
          .prepare(
            `INSERT INTO tenants (id, name, slug, owner_name, email, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(tenantId, businessName, slug, ownerDisplay, cleanEmail, nowIso)
          .run();

        await env.DB
          .prepare(
            `INSERT INTO users (id, tenant_id, email, name, role, session_token, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(userId, tenantId, cleanEmail, ownerDisplay, role, sessionToken, nowIso)
          .run();

        await env.KV.delete(`verified:merchant:${cleanEmail}`).catch(() => {});

        return jsonResponse(
          {
            ok: true,
            authenticated: true,
            user: {
              id: userId,
              email: cleanEmail,
              name: ownerDisplay,
              role,
              businessId: tenantId,
            },
          },
          200,
          {
            'Set-Cookie': buildMerchantCookie(sessionToken),
          }
        );
      } catch {
        return jsonResponse({ error: 'No pudimos crear la cuenta del comercio.' }, 400);
      }
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      const token = readCookie(request, 'toque_merchant_session');
      if (env.DB && token) {
        await env.DB
          .prepare('UPDATE users SET session_token = NULL WHERE session_token = ?')
          .bind(token)
          .run()
          .catch(() => {});
      }
      return jsonResponse({ success: true }, 200, {
        'Set-Cookie': clearMerchantCookie(),
      });
    }

    // 5. Tarjetas del comercio: exigir sesión de comercio y usar session.tenantId
    if (
      (pathname === '/api/merchant/cards' || pathname === '/api/club/cards') &&
      request.method === 'GET'
    ) {
      const session = await getMerchantSession(request, env);
      if (!session) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      const tenantId = session.tenantId;

      if (env.DB) {
        try {
          const cardsRes = await env.DB
            .prepare(
              `SELECT id, tenant_id, business_name, stamps_required, reward_text, reward_value_ars,
                      brand_color, color_preset, logo_url, created_at, updated_at
               FROM merchant_cards
               WHERE tenant_id = ?
               LIMIT 1`
            )
            .bind(tenantId)
            .all<any>();

          const cards = (cardsRes.results || []).map((row: any) => ({
            id: row.id,
            businessId: row.tenant_id,
            businessName: row.business_name,
            targetStamps: 10,
            stampsRequired: 10,
            reward: row.reward_text,
            rewardText: row.reward_text,
            rewardValueArs: Number(row.reward_value_ars || 0),
            brandColor: row.brand_color || '#D95B26',
            colorPreset: row.color_preset || 'dark',
            logoUrl: row.logo_url || undefined,
            active: true,
          }));

          return jsonResponse({ cards });
        } catch {
          return jsonResponse({ cards: [] });
        }
      }

      return jsonResponse({ cards: [] });
    }

    if (
      (pathname === '/api/merchant/cards' || pathname === '/api/club/cards') &&
      (request.method === 'POST' || request.method === 'PUT')
    ) {
      const session = await getMerchantSession(request, env);
      if (!session) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      const tenantId = session.tenantId;

      try {
        const body = (await request.json().catch(() => ({}))) as {
          businessName?: string;
          rewardText?: string;
          reward?: string;
          rewardValueArs?: number;
          brandColor?: string;
          customColor?: string;
          colorPreset?: string;
          logoUrl?: string;
        };

        const businessName = String(body.businessName || 'Mi comercio').trim().slice(0, 64);
        const rewardText = String(
          body.rewardText || body.reward || 'Premio al completar tus 10 sellos'
        )
          .trim()
          .slice(0, 80);
        const rewardValueArs = Math.max(0, Number(body.rewardValueArs || 0));
        const brandColor = String(body.customColor || body.brandColor || '#D95B26').trim();
        const colorPreset = String(body.colorPreset || 'dark').trim();
        const logoUrl = String(body.logoUrl || '').trim() || null;

        if (!rewardText) {
          return jsonResponse(
            { error: 'Escribí cuál es el premio al completar los 10 sellos.' },
            400
          );
        }

        if (env.DB) {
          const existing = await env.DB
            .prepare('SELECT id FROM merchant_cards WHERE tenant_id = ? LIMIT 1')
            .bind(tenantId)
            .first<{ id: string }>()
            .catch(() => null);

          const cardId = existing?.id || `card-${tenantId}`;
          const nowIso = new Date().toISOString();

          await env.DB
            .prepare(
              `INSERT INTO merchant_cards (
                 id, tenant_id, business_name, stamps_required, reward_text, reward_value_ars,
                 brand_color, color_preset, logo_url, created_at, updated_at
               ) VALUES (?, ?, ?, 10, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 business_name = excluded.business_name,
                 stamps_required = 10,
                 reward_text = excluded.reward_text,
                 reward_value_ars = excluded.reward_value_ars,
                 brand_color = excluded.brand_color,
                 color_preset = excluded.color_preset,
                 logo_url = COALESCE(excluded.logo_url, merchant_cards.logo_url),
                 updated_at = excluded.updated_at`
            )
            .bind(
              cardId,
              tenantId,
              businessName,
              rewardText,
              rewardValueArs,
              brandColor,
              colorPreset,
              logoUrl,
              nowIso,
              nowIso
            )
            .run();

          await env.DB
            .prepare(
              `INSERT INTO hub_configs (
                 tenant_id, business_name, logo_url, brand_color, color_preset, custom_color,
                 stamps_required, reward_text, loyalty_reward, loyalty_title, reward_value_ars, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, 10, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(tenant_id) DO UPDATE SET
                 business_name = excluded.business_name,
                 logo_url = COALESCE(excluded.logo_url, hub_configs.logo_url),
                 brand_color = excluded.brand_color,
                 color_preset = excluded.color_preset,
                 custom_color = excluded.custom_color,
                 stamps_required = 10,
                 reward_text = excluded.reward_text,
                 loyalty_reward = excluded.loyalty_reward,
                 loyalty_title = excluded.loyalty_title,
                 reward_value_ars = excluded.reward_value_ars,
                 updated_at = datetime('now')`
            )
            .bind(
              tenantId,
              businessName,
              logoUrl,
              brandColor,
              colorPreset,
              brandColor,
              rewardText,
              rewardText,
              `Tarjeta de sellos de ${businessName}`,
              rewardValueArs
            )
            .run()
            .catch(() => {});

          await env.DB
            .prepare('UPDATE tenants SET name = ? WHERE id = ?')
            .bind(businessName, tenantId)
            .run()
            .catch(() => {});

          await env.DB
            .prepare('UPDATE loyalty_members SET stamps_required = 10 WHERE tenant_id = ?')
            .bind(tenantId)
            .run()
            .catch(() => {});
        }

        return jsonResponse({
          success: true,
          card: {
            id: `card-${tenantId}`,
            businessId: tenantId,
            businessName,
            targetStamps: 10,
            stampsRequired: 10,
            reward: rewardText,
            rewardText,
            rewardValueArs,
            brandColor,
            colorPreset,
            logoUrl: logoUrl || undefined,
            active: true,
          },
        });
      } catch {
        return jsonResponse({ error: 'No pudimos guardar la tarjeta.' }, 400);
      }
    }

    // 6. Reclamar tarjeta en el Hub: POST /api/consumer/cards/claim (exige getConsumerSession)
    if (pathname === '/api/consumer/cards/claim' && request.method === 'POST') {
      const consumerSession = await getConsumerSession(request, env);
      if (!consumerSession) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      if (!env.DB) {
        return jsonResponse({ error: 'Base de datos no disponible.' }, 503);
      }

      try {
        const body = (await request.json().catch(() => ({}))) as {
          code?: string;
          cartelCode?: string;
          localCode?: string;
        };

        const rawCode = String(body.code || body.cartelCode || body.localCode || '')
          .trim()
          .toUpperCase();
        if (!rawCode) {
          return jsonResponse({ error: 'Indicá el código del comercio.' }, 400);
        }

        let tenantId = '';
        const cartelMatch = await env.DB
          .prepare('SELECT tenant_id FROM carteles WHERE UPPER(code) = ? LIMIT 1')
          .bind(rawCode)
          .first<{ tenant_id?: string }>()
          .catch(() => null);

        if (cartelMatch?.tenant_id) {
          tenantId = cartelMatch.tenant_id;
        } else {
          const tenantMatch = await env.DB
            .prepare('SELECT id FROM tenants WHERE LOWER(id) = ? OR LOWER(slug) = ? LIMIT 1')
            .bind(rawCode.toLowerCase(), rawCode.toLowerCase())
            .first<{ id: string }>()
            .catch(() => null);
          if (tenantMatch?.id) {
            tenantId = tenantMatch.id;
          }
        }

        if (!tenantId) {
          return jsonResponse({ error: 'No encontramos el comercio solicitado.' }, 404);
        }

        let businessName = 'Comercio adherido';
        let rewardText = 'Beneficio al completar tus 10 sellos';
        let brandColor = '#D95B26';
        let colorPreset = 'dark';
        let logoUrl: string | undefined;
        const stampsRequired = 10;
        const nowIso = new Date().toISOString();

        const hubCfgRow = await env.DB
          .prepare(
            `SELECT business_name, reward_text, loyalty_reward, brand_color, color_preset, custom_color, logo_url
             FROM hub_configs WHERE tenant_id = ? LIMIT 1`
          )
          .bind(tenantId)
          .first<D1HubConfigRow>()
          .catch(() => null);

        if (hubCfgRow) {
          if (hubCfgRow.business_name) businessName = hubCfgRow.business_name;
          if (hubCfgRow.reward_text || hubCfgRow.loyalty_reward) {
            rewardText = (hubCfgRow.reward_text || hubCfgRow.loyalty_reward || rewardText).trim();
          }
          if (hubCfgRow.custom_color || hubCfgRow.brand_color) {
            brandColor = (hubCfgRow.custom_color || hubCfgRow.brand_color || brandColor).trim();
          }
          if (hubCfgRow.color_preset) {
            colorPreset = hubCfgRow.color_preset;
          }
          if (hubCfgRow.logo_url) {
            logoUrl = hubCfgRow.logo_url;
          }
        }

        const consumerId = consumerSession.consumerId;
        const cleanEmail = consumerSession.email.toLowerCase();
        const fullName = consumerSession.fullName || 'Socio';

        let memberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
        let barcodeToken = await generateUnique8DigitBarcode(env.DB);
        let stamps = 0;
        let lastStampedAt: string | null = null;
        let walletSerial: string | null = null;
        let walletAppleUrl: string | undefined;
        let walletGoogleUrl: string | undefined;

        const existing = await env.DB
          .prepare(
            `SELECT id, consumer_id, tenant_id, customer_name, name, stamps, barcode_token,
                    last_stamped_at, wallet_serial, wallet_apple_base64, wallet_google_url
             FROM loyalty_members
             WHERE tenant_id = ? AND (
               consumer_id = ? OR LOWER(TRIM(customer_email)) = ? OR LOWER(TRIM(contact)) = ?
             )
             LIMIT 1`
          )
          .bind(tenantId, consumerId, cleanEmail, cleanEmail)
          .first<D1LoyaltyMemberRow>();

        if (existing) {
          memberId = existing.id;
          barcodeToken =
            normalize8DigitToken(existing.barcode_token) ||
            (await generateUnique8DigitBarcode(env.DB));
          stamps = Math.max(0, Number(existing.stamps ?? 0));
          lastStampedAt = existing.last_stamped_at || null;
          walletSerial = existing.wallet_serial || null;
          if (existing.wallet_apple_base64) {
            walletAppleUrl = `/api/wallet/pass/${encodeURIComponent(barcodeToken)}.pkpass`;
          }
          if (existing.wallet_google_url) {
            walletGoogleUrl = existing.wallet_google_url;
          }

          await env.DB
            .prepare(
              `UPDATE loyalty_members
               SET consumer_id = ?,
                   customer_name = ?,
                   name = ?,
                   customer_email = ?,
                   contact = ?,
                   stamps_required = 10,
                   barcode_token = ?,
                   member_code = ?
               WHERE id = ?`
            )
            .bind(
              consumerId,
              fullName,
              fullName,
              cleanEmail,
              cleanEmail,
              barcodeToken,
              barcodeToken,
              memberId
            )
            .run();
        } else {
          await env.DB
            .prepare(
              `INSERT INTO loyalty_members (
                 id, consumer_id, tenant_id, customer_name, name, customer_email, contact,
                 points, stamps, stamps_required, rewards_redeemed, barcode_token,
                 member_code, last_stamped_at, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 10, 0, ?, ?, NULL, ?)`
            )
            .bind(
              memberId,
              consumerId,
              tenantId,
              fullName,
              fullName,
              cleanEmail,
              cleanEmail,
              barcodeToken,
              barcodeToken,
              nowIso
            )
            .run();
        }

        const cardPayload = {
          id: memberId,
          businessId: tenantId,
          tenantId,
          businessName,
          name: fullName,
          email: cleanEmail,
          contact: cleanEmail,
          stamps,
          points: stamps,
          stampsRequired,
          targetStamps: stampsRequired,
          rewardText,
          brandColor,
          colorPreset,
          logoUrl,
          barcodeToken,
          shortCode: barcodeToken,
          memberCode: barcodeToken,
          lastStampedAt,
          walletSerial: walletSerial || undefined,
          appleWalletUrl: walletAppleUrl,
          googleSaveUrl: walletGoogleUrl,
          googleWalletUrl: walletGoogleUrl,
          joinedAt: nowIso,
          consent: true,
        };

        return jsonResponse({
          success: true,
          card: cardPayload,
          member: cardPayload,
          barcodeToken,
          user: {
            id: consumerId,
            email: cleanEmail,
            fullName,
            birthDate: consumerSession.birthDate || undefined,
          },
        });
      } catch {
        return jsonResponse({ success: false, error: 'No pudimos guardar tu tarjeta.' }, 400);
      }
    }

    // 7. Enlace de un solo uso para Apple Wallet: POST /api/consumer/wallet/add y GET /api/wallet/p/:token
    if (pathname === '/api/consumer/wallet/add' && request.method === 'POST') {
      const consumerSession = await getConsumerSession(request, env);
      if (!consumerSession) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      if (!env.DB || !env.KV) {
        return jsonResponse({ error: 'El servicio de billetera no está disponible.' }, 503);
      }

      try {
        const body = (await request.json().catch(() => ({}))) as {
          memberId?: string;
          barcodeToken?: string;
          code?: string;
        };
        const memberId = String(body.memberId || '').trim();
        const barcodeToken = normalize8DigitToken(body.barcodeToken || body.code);

        const memberRow = await env.DB
          .prepare(
            `SELECT * FROM loyalty_members
             WHERE (consumer_id = ? OR LOWER(customer_email) = ? OR LOWER(contact) = ?)
               AND ((id = ? AND ? != '') OR (barcode_token = ? AND ? != ''))
             LIMIT 1`
          )
          .bind(
            consumerSession.consumerId,
            consumerSession.email.toLowerCase(),
            consumerSession.email.toLowerCase(),
            memberId,
            memberId,
            barcodeToken,
            barcodeToken
          )
          .first<D1LoyaltyMemberRow>();

        if (!memberRow) {
          return jsonResponse({ error: 'No encontramos esa tarjeta en tu cuenta.' }, 404);
        }

        let applePassBase64 = memberRow.wallet_apple_base64 || null;
        if (!applePassBase64) {
          const hubRow = await env.DB
            .prepare(
              `SELECT business_name, reward_text, loyalty_reward, stamps_required, color_preset
               FROM hub_configs WHERE tenant_id = ? LIMIT 1`
            )
            .bind(memberRow.tenant_id)
            .first<D1HubConfigRow>()
            .catch(() => null);

          const token8 =
            normalize8DigitToken(memberRow.barcode_token) ||
            (await generateUnique8DigitBarcode(env.DB));
          const created = await createPass(env, {
            businessName: (hubRow?.business_name || 'Comercio adherido').slice(0, 64),
            memberName:
              (memberRow.customer_name || memberRow.name || consumerSession.fullName || '').trim() ||
              undefined,
            stamps: Number(memberRow.stamps || 0),
            stampsRequired: Number(hubRow?.stamps_required || memberRow.stamps_required || 10),
            rewardText: (
              hubRow?.reward_text ||
              hubRow?.loyalty_reward ||
              'Beneficio al completar tus 10 sellos'
            ).slice(0, 60),
            barcodeToken: token8,
            colorPreset: ((hubRow?.color_preset as ColorPreset) || 'dark') as ColorPreset,
          });

          applePassBase64 = created.applePass || null;
          await env.DB
            .prepare(
              `UPDATE loyalty_members
               SET wallet_serial = ?, barcode_token = ?,
                   wallet_apple_base64 = COALESCE(?, wallet_apple_base64),
                   wallet_google_url = COALESCE(?, wallet_google_url),
                   wallet_sync_error = NULL
               WHERE id = ?`
            )
            .bind(
              created.serialNumber,
              token8,
              applePassBase64,
              created.googleSaveUrl || null,
              memberRow.id
            )
            .run();
        }

        if (!applePassBase64) {
          return jsonResponse(
            { error: 'No pudimos preparar el archivo para Apple Wallet.' },
            502
          );
        }

        const token = generateRandomToken();
        await env.KV.put(`wallet_dl:${token}`, memberRow.id, { expirationTtl: 300 });

        return jsonResponse({
          url: `/api/wallet/p/${token}`,
        });
      } catch (err: any) {
        const status = err instanceof WalletError ? err.status : 502;
        return jsonResponse(
          {
            error:
              err instanceof WalletError
                ? err.message
                : 'No pudimos generar el enlace para Apple Wallet.',
          },
          status
        );
      }
    }

    if (pathname.startsWith('/api/wallet/p/') && request.method === 'GET') {
      const token = pathname.slice('/api/wallet/p/'.length).trim();
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        return jsonResponse({ error: 'El enlace de descarga no es válido.' }, 404);
      }
      if (!env.DB) {
        return jsonResponse({ error: 'La descarga no está disponible.' }, 503);
      }

      let memberId: string | null = null;
      if (env.KV) {
        memberId = await env.KV.get(`wallet_dl:${token}`, 'text');
        if (memberId) {
          // Invalidar inmediatamente al usarse (un solo uso)
          await env.KV.delete(`wallet_dl:${token}`);
        }
      }

      if (!memberId) {
        return jsonResponse(
          { error: 'Este enlace ya fue utilizado o venció. Volvé a abrir tu tarjeta.' },
          404
        );
      }

      const member = await env.DB
        .prepare('SELECT wallet_apple_base64 FROM loyalty_members WHERE id = ? LIMIT 1')
        .bind(memberId)
        .first<{ wallet_apple_base64?: string | null }>();

      if (!member?.wallet_apple_base64) {
        return jsonResponse({ error: 'No encontramos el pase solicitado.' }, 404);
      }

      const binary = atob(member.wallet_apple_base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': 'attachment; filename="toque.pkpass"',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Descarga de GET /api/wallet/pass/<código>.pkpass: solo con la sesión del dueño de la tarjeta, sin crear tarjetas nuevas
    if (
      pathname.startsWith('/api/wallet/pass/') &&
      pathname.toLowerCase().endsWith('.pkpass') &&
      request.method === 'GET'
    ) {
      const consumerSession = await getConsumerSession(request, env);
      if (!consumerSession) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      if (!env.DB) {
        return jsonResponse({ error: 'Servicio no disponible.' }, 503);
      }

      const rawCode = decodeURIComponent(
        pathname.slice('/api/wallet/pass/'.length).replace(/\.pkpass$/i, '')
      ).trim();

      const member = await env.DB
        .prepare(
          `SELECT id, consumer_id, customer_email, contact, wallet_apple_base64
           FROM loyalty_members
           WHERE (barcode_token = ? OR id = ?)
           LIMIT 1`
        )
        .bind(rawCode, rawCode)
        .first<{
          id: string;
          consumer_id?: string | null;
          customer_email?: string | null;
          contact?: string | null;
          wallet_apple_base64?: string | null;
        }>();

      if (!member) {
        return jsonResponse({ error: 'No existe esa tarjeta.' }, 404);
      }

      const emailLower = consumerSession.email.toLowerCase();
      const isOwner =
        member.consumer_id === consumerSession.consumerId ||
        String(member.customer_email || '').trim().toLowerCase() === emailLower ||
        String(member.contact || '').trim().toLowerCase() === emailLower;

      if (!isOwner) {
        return jsonResponse({ error: 'No tenés permiso para descargar esta tarjeta.' }, 403);
      }

      if (!member.wallet_apple_base64) {
        return jsonResponse({ error: 'Esta tarjeta todavía no tiene un pase generado.' }, 404);
      }

      const binary = atob(member.wallet_apple_base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': 'attachment; filename="toque.pkpass"',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // 8. Registro de cliente por primera vez: POST /api/consumer/register
    if (pathname === '/api/consumer/register' && request.method === 'POST') {
      try {
        if (!env.DB || !env.KV) {
          return jsonResponse({ error: 'Servicio no disponible.' }, 503);
        }

        const body = (await request.json().catch(() => ({}))) as {
          email?: string;
          fullName?: string;
          name?: string;
          birthDate?: string;
        };
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const fullName = String(body.fullName || body.name || '').trim();
        const birthDate = String(body.birthDate || '').trim() || null;

        if (!cleanEmail || !isValidEmail(cleanEmail) || !fullName) {
          return jsonResponse({ error: 'Completá tu nombre y tu correo.' }, 400);
        }

        const verifiedFlag = await env.KV.get(`verified:consumer:${cleanEmail}`, 'text');
        if (!verifiedFlag) {
          return jsonResponse(
            { error: 'Primero verificá tu correo con el código de 6 dígitos.' },
            403
          );
        }

        const existing = await env.DB
          .prepare('SELECT id FROM consumer_users WHERE LOWER(email) = ? LIMIT 1')
          .bind(cleanEmail)
          .first<{ id: string }>();

        if (existing?.id) {
          await env.KV.delete(`verified:consumer:${cleanEmail}`).catch(() => {});
          return jsonResponse(
            { error: 'Ya existe una cuenta con ese correo. Ingresá con tu código.' },
            409
          );
        }

        const userId = crypto.randomUUID();
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
        const nowIso = new Date().toISOString();

        await env.DB
          .prepare(
            `INSERT INTO consumer_users (id, email, full_name, birth_date, session_token, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(userId, cleanEmail, fullName, birthDate, sessionToken, nowIso)
          .run();

        await env.KV.delete(`verified:consumer:${cleanEmail}`).catch(() => {});

        return jsonResponse(
          {
            ok: true,
            needsRegistration: false,
            user: {
              id: userId,
              email: cleanEmail,
              fullName,
              birthDate: birthDate || undefined,
            },
          },
          200,
          {
            'Set-Cookie': buildConsumerCookie(sessionToken),
          }
        );
      } catch {
        return jsonResponse({ error: 'No pudimos registrar tu cuenta.' }, 400);
      }
    }

    // 9. Sesión activa del cliente y tarjetas: GET /api/consumer/me (solo con getConsumerSession)
    if (pathname === '/api/consumer/me' && request.method === 'GET') {
      const consumerSession = await getConsumerSession(request, env);
      if (!consumerSession || !env.DB) {
        return jsonResponse({ authenticated: false, user: null, cards: [], receipts: [] }, 401);
      }

      try {
        const cardsRes = await env.DB
          .prepare(
            `SELECT
               m.id, m.consumer_id, m.tenant_id, m.stamps, m.stamps_required, m.rewards_redeemed,
               m.barcode_token, m.last_stamped_at, m.wallet_serial, m.wallet_apple_base64,
               m.wallet_google_url, m.created_at,
               h.business_name, h.logo_url, h.brand_color, h.color_preset, h.custom_color,
               h.stamps_required AS hub_stamps_required, h.reward_text, h.loyalty_reward, h.reward_value_ars
             FROM loyalty_members m
             LEFT JOIN hub_configs h ON h.tenant_id = m.tenant_id
             WHERE m.consumer_id = ? OR LOWER(m.customer_email) = ? OR LOWER(m.contact) = ?
             ORDER BY m.created_at DESC`
          )
          .bind(
            consumerSession.consumerId,
            consumerSession.email.toLowerCase(),
            consumerSession.email.toLowerCase()
          )
          .all<any>();

        const receiptsRes = await env.DB
          .prepare(
            `SELECT id, consumer_id, tenant_id, merchant_name, amount_ars, discount_saved_ars, category, receipt_note, created_at
             FROM consumer_receipts
             WHERE consumer_id = ?
             ORDER BY created_at DESC`
          )
          .bind(consumerSession.consumerId)
          .all<any>();

        const cards = (cardsRes.results || []).map((row: any) => {
          const bToken = normalize8DigitToken(row.barcode_token) || row.barcode_token || '';
          const bizName = row.business_name || 'Comercio adherido';
          const reqStamps = Number(row.hub_stamps_required || row.stamps_required || 10);
          const rewText =
            row.reward_text || row.loyalty_reward || 'Beneficio al completar tus sellos';
          const appleWalletUrl = row.wallet_apple_base64
            ? `/api/wallet/pass/${encodeURIComponent(bToken)}.pkpass`
            : undefined;
          return {
            id: row.id,
            businessId: row.tenant_id,
            businessName: bizName,
            name: consumerSession.fullName,
            email: consumerSession.email,
            contact: consumerSession.email,
            stamps: Number(row.stamps || 0),
            points: Number(row.stamps || 0),
            stampsRequired: reqStamps,
            targetStamps: reqStamps,
            rewardText: rewText,
            rewardValueArs: Number(row.reward_value_ars || 0),
            rewardsRedeemed: Number(row.rewards_redeemed || 0),
            barcodeToken: bToken,
            shortCode: bToken,
            memberCode: bToken,
            colorPreset: row.color_preset || 'dark',
            customColor: row.custom_color || row.brand_color || undefined,
            logoUrl: row.logo_url || undefined,
            lastStampedAt: row.last_stamped_at || undefined,
            walletSerial: row.wallet_serial || undefined,
            appleWalletUrl,
            googleSaveUrl: row.wallet_google_url || undefined,
            googleWalletUrl: row.wallet_google_url || undefined,
            joinedAt: row.created_at || new Date().toISOString(),
            consent: true,
          };
        });

        const receipts = (receiptsRes.results || []).map((r: any) => ({
          id: r.id,
          consumerId: r.consumer_id,
          tenantId: r.tenant_id,
          merchantName: r.merchant_name,
          amountArs: Number(r.amount_ars) || 0,
          discountSavedArs: Number(r.discount_saved_ars) || 0,
          category: r.category || 'Comercio',
          receiptNote: r.receipt_note || '',
          createdAt: r.created_at,
        }));

        return jsonResponse({
          authenticated: true,
          user: {
            id: consumerSession.consumerId,
            email: consumerSession.email,
            fullName: consumerSession.fullName,
            birthDate: consumerSession.birthDate || undefined,
          },
          cards,
          receipts,
        });
      } catch {
        return jsonResponse({ authenticated: false, user: null, cards: [], receipts: [] }, 500);
      }
    }

    // 10. Configuración de Hub del comercio: exigir sesión y usar session.tenantId
    if (
      (pathname === '/api/merchant/hub-config' || pathname === '/api/merchant/hub') &&
      (request.method === 'PUT' || request.method === 'POST')
    ) {
      const session = await getMerchantSession(request, env);
      if (!session) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      const tenantId = session.tenantId;

      try {
        const body = (await request.json().catch(() => ({}))) as {
          businessName?: string;
          logoUrl?: string;
          colorPreset?: ColorPreset;
          customColor?: string;
          brandColor?: string;
          rewardText?: string;
          rewardValueArs?: number;
          storeLat?: number;
          storeLng?: number;
        };

        const businessName = (body.businessName || 'Mi comercio').trim().slice(0, 64);
        const logoUrl = (body.logoUrl || '').trim() || null;
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const colorPreset: ColorPreset =
          body.colorPreset && validPresets.includes(body.colorPreset)
            ? body.colorPreset
            : 'dark';
        const brandColor = (body.customColor || body.brandColor || '#D95B26').trim();
        const stampsRequired = 10;
        const rewardText = (body.rewardText || 'Beneficio al completar tus 10 sellos')
          .trim()
          .slice(0, 80);
        const rewardValueArs = Math.max(0, Number(body.rewardValueArs || 0));

        if (env.DB) {
          await env.DB
            .prepare(
              `INSERT INTO hub_configs (
                 tenant_id, business_name, logo_url, brand_color, color_preset, custom_color,
                 stamps_required, reward_text, loyalty_reward, loyalty_title, reward_value_ars, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(tenant_id) DO UPDATE SET
                 business_name = excluded.business_name,
                 logo_url = COALESCE(excluded.logo_url, hub_configs.logo_url),
                 brand_color = excluded.brand_color,
                 color_preset = excluded.color_preset,
                 custom_color = excluded.custom_color,
                 stamps_required = 10,
                 reward_text = excluded.reward_text,
                 loyalty_reward = excluded.loyalty_reward,
                 loyalty_title = excluded.loyalty_title,
                 reward_value_ars = excluded.reward_value_ars,
                 updated_at = datetime('now')`
            )
            .bind(
              tenantId,
              businessName,
              logoUrl,
              brandColor,
              colorPreset,
              brandColor,
              stampsRequired,
              rewardText,
              rewardText,
              `Tarjeta de sellos de ${businessName}`,
              rewardValueArs
            )
            .run();

          await env.DB
            .prepare(
              `INSERT INTO merchant_cards (
                 id, tenant_id, business_name, stamps_required, reward_text, reward_value_ars,
                 brand_color, color_preset, logo_url, created_at, updated_at
               ) VALUES (?, ?, ?, 10, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
               ON CONFLICT(id) DO UPDATE SET
                 business_name = excluded.business_name,
                 stamps_required = 10,
                 reward_text = excluded.reward_text,
                 reward_value_ars = excluded.reward_value_ars,
                 brand_color = excluded.brand_color,
                 color_preset = excluded.color_preset,
                 logo_url = COALESCE(excluded.logo_url, merchant_cards.logo_url),
                 updated_at = datetime('now')`
            )
            .bind(
              `card-${tenantId}`,
              tenantId,
              businessName,
              rewardText,
              rewardValueArs,
              brandColor,
              colorPreset,
              logoUrl
            )
            .run()
            .catch(() => {});

          if (typeof body.storeLat === 'number' && typeof body.storeLng === 'number') {
            await env.DB
              .prepare('UPDATE hub_configs SET store_lat = ?, store_lng = ? WHERE tenant_id = ?')
              .bind(body.storeLat, body.storeLng, tenantId)
              .run()
              .catch(() => {});
          }

          await env.DB
            .prepare('UPDATE tenants SET name = ? WHERE id = ?')
            .bind(businessName, tenantId)
            .run()
            .catch(() => {});

          await env.DB
            .prepare('UPDATE loyalty_members SET stamps_required = 10 WHERE tenant_id = ?')
            .bind(tenantId)
            .run()
            .catch(() => {});

          if (ctx && env.WALLETWALLET_API_KEY) {
            ctx.waitUntil(
              (async () => {
                try {
                  const membersRes = await env.DB!
                    .prepare(
                      `SELECT id, customer_name, name, stamps, barcode_token, wallet_serial, wallet_last_notification
                       FROM loyalty_members
                       WHERE tenant_id = ? AND wallet_serial IS NOT NULL AND wallet_serial != ''`
                    )
                    .bind(tenantId)
                    .all<D1LoyaltyMemberRow>();

                  for (const m of membersRes.results || []) {
                    if (!m.wallet_serial) continue;
                    const token8 = normalize8DigitToken(m.barcode_token) || generateBarcodeToken();
                    await updatePass(env, m.wallet_serial, {
                      businessName,
                      memberName: m.customer_name || m.name || undefined,
                      stamps: Number(m.stamps || 0),
                      stampsRequired,
                      rewardText,
                      barcodeToken: token8,
                      colorPreset,
                      notification: m.wallet_last_notification ?? ' ',
                    }).catch(() => {});
                  }
                } catch {
                  // ignore background sync error
                }
              })()
            );
          }
        }

        return jsonResponse({
          success: true,
          config: {
            tenantId,
            businessName,
            logoUrl,
            brandColor,
            colorPreset,
            stampsRequired,
            rewardText,
            rewardValueArs,
          },
        });
      } catch {
        return jsonResponse(
          { success: false, error: 'No se pudo guardar la configuración del comercio.' },
          400
        );
      }
    }

    // 10b. Lectura pública en tiempo real: GET /api/public/hub/:code
    if (pathname.startsWith('/api/public/hub/') && request.method === 'GET') {
      const subPath = pathname.replace('/api/public/hub/', '').trim();
      if (subPath && subPath !== 'receipt-check') {
        const rawCode = decodeURIComponent(subPath.split('/')[0] || '').trim();
        const codeUpper = rawCode.toUpperCase();
        const codeLower = rawCode.toLowerCase();

        if (
          codeLower === 'musical-monroe' ||
          codeUpper === 'MONROE01' ||
          codeUpper === 'MONROE02'
        ) {
          return jsonResponse(
            {
              found: false,
              deleted: true,
              error: 'El Hub solicitado no está disponible.',
            },
            404,
            {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            }
          );
        }

        let tenantId = codeLower || 'comercio-activo';
        let cartelCode = codeUpper || 'LOCAL01';
        let reviewUrl = '';
        let mode: 'direct_review' | 'smart_hub' = 'smart_hub';
        let businessName = 'Mi comercio';
        let logoUrl: string | undefined;
        let brandColor = '#141414';
        let colorPreset: ColorPreset = 'dark';
        let customColor: string | undefined;
        let stampsRequired = 10;
        let rewardText = 'Beneficio exclusivo al completar tus 10 sellos';
        let rewardValueArs = 0;

        if (env.DB) {
          try {
            const cartelRow = await env.DB
              .prepare(
                'SELECT code, tenant_id, mode, review_url FROM carteles WHERE UPPER(code) = ? LIMIT 1'
              )
              .bind(codeUpper)
              .first<{ code: string; tenant_id?: string; mode?: string; review_url?: string }>()
              .catch(() => null);

            if (cartelRow) {
              cartelCode = cartelRow.code || cartelCode;
              if (cartelRow.tenant_id) tenantId = cartelRow.tenant_id;
              if (cartelRow.review_url) reviewUrl = cartelRow.review_url;
              if (cartelRow.mode === 'direct_review') mode = 'direct_review';
            } else {
              const tenantRow = await env.DB
                .prepare(
                  'SELECT id, name FROM tenants WHERE LOWER(id) = ? OR LOWER(slug) = ? LIMIT 1'
                )
                .bind(codeLower, codeLower)
                .first<{ id: string; name: string }>()
                .catch(() => null);
              if (tenantRow) {
                tenantId = tenantRow.id;
                businessName = tenantRow.name || businessName;
              }
            }

            const hubRow = await env.DB
              .prepare(
                `SELECT tenant_id, business_name, loyalty_title, loyalty_reward, reward_text,
                        stamps_required, reward_value_ars, brand_color, color_preset, custom_color, logo_url
                 FROM hub_configs WHERE tenant_id = ? LIMIT 1`
              )
              .bind(tenantId)
              .first<D1HubConfigRow>()
              .catch(() => null);

            const cardRow = await env.DB
              .prepare(
                `SELECT business_name, stamps_required, reward_text, reward_value_ars, brand_color, color_preset, logo_url
                 FROM merchant_cards WHERE tenant_id = ? LIMIT 1`
              )
              .bind(tenantId)
              .first<any>()
              .catch(() => null);

            if (hubRow || cardRow) {
              businessName =
                cardRow?.business_name || hubRow?.business_name || businessName;
              rewardText =
                cardRow?.reward_text ||
                hubRow?.reward_text ||
                hubRow?.loyalty_reward ||
                rewardText;
              rewardValueArs = Number(
                cardRow?.reward_value_ars ?? hubRow?.reward_value_ars ?? 0
              );
              brandColor =
                cardRow?.brand_color ||
                hubRow?.custom_color ||
                hubRow?.brand_color ||
                brandColor;
              customColor =
                hubRow?.custom_color ||
                cardRow?.brand_color ||
                hubRow?.brand_color ||
                undefined;
              colorPreset = (cardRow?.color_preset ||
                hubRow?.color_preset ||
                'dark') as ColorPreset;
              logoUrl = cardRow?.logo_url || hubRow?.logo_url || undefined;
              stampsRequired = 10;
            }
          } catch {
            // fallback
          }
        }

        return jsonResponse(
          {
            found: true,
            tenantId,
            code: cartelCode,
            businessName,
            logoUrl,
            brandColor,
            colorPreset,
            customColor,
            stampsRequired,
            rewardText,
            rewardValueArs,
            reviewUrl,
            mode,
          },
          200,
          {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          }
        );
      }
    }

    // 11. Enrutamiento público en el borde: /r/:code
    if (pathname.startsWith('/r/')) {
      const rawCode = pathname.replace('/r/', '').split('/')[0]?.trim().toUpperCase();
      if (!rawCode) {
        return Response.redirect(`${url.origin}/`, 302);
      }

      let record: EdgeCartelRecord | null = null;

      if (env.KV) {
        try {
          record = await env.KV.get(`cartel:${rawCode}`, 'json');
        } catch {
          record = null;
        }
      }

      if (!record && env.DB) {
        try {
          record = await env.DB
            .prepare(
              'SELECT code, claim_status, mode, tile_color, review_url, tenant_id FROM carteles WHERE UPPER(code) = ? LIMIT 1'
            )
            .bind(rawCode)
            .first<EdgeCartelRecord>();

          if (record && env.KV) {
            ctx?.waitUntil(
              env.KV.put(`cartel:${rawCode}`, JSON.stringify(record), { expirationTtl: 3600 })
            );
          }
        } catch {
          record = null;
        }
      }

      if (!record) {
        record = {
          code: rawCode,
          claim_status: 'claimed',
          mode: 'smart_hub',
          tile_color: 'black',
        };
      }

      if (record.claim_status === 'unclaimed') {
        return Response.redirect(`${url.origin}/activar/${rawCode}`, 302);
      }

      if (env.DB && ctx) {
        ctx.waitUntil(
          env.DB
            .prepare("UPDATE carteles SET last_scanned_at = datetime('now') WHERE UPPER(code) = ?")
            .bind(rawCode)
            .run()
            .catch(() => {})
        );
      }

      if (record.mode === 'direct_review' && record.review_url) {
        return Response.redirect(record.review_url, 302);
      }

      return Response.redirect(`${url.origin}/u/${rawCode}`, 302);
    }

    // 12. Sumar sello en caja: exigir sesión de comercio, buscar SOLO en session.tenantId, límite 60/min en KV, siempre +1 sello
    if (
      (pathname === '/api/merchant/stamp' ||
        pathname === '/api/club/stamp' ||
        pathname === '/api/club/stamps/self') &&
      request.method === 'POST'
    ) {
      const session = await getMerchantSession(request, env);
      if (!session) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      const tenantId = session.tenantId;

      if (env.KV) {
        const minuteBucket = Math.floor(Date.now() / 60000);
        const rlKey = `rl:stamp:${session.userId}:${minuteBucket}`;
        const count = Number((await env.KV.get(rlKey, 'text')) || '0');
        if (count >= 60) {
          return jsonResponse(
            { error: 'Superaste el límite de 60 consultas por minuto.' },
            429
          );
        }
        await env.KV.put(rlKey, String(count + 1), { expirationTtl: 60 });
      }

      if (!env.DB) {
        return jsonResponse({ error: 'Base de datos no disponible.' }, 503);
      }

      try {
        const body = (await request.json().catch(() => ({}))) as {
          memberId?: string;
          barcodeToken?: string;
          shortCode?: string;
          code?: string;
        };

        const memberId = String(body.memberId || '').trim();
        const rawCode = String(body.barcodeToken || body.shortCode || body.code || '').trim();
        const normalizedLookupCode = rawCode.replace(/[\s-]/g, '').toUpperCase();

        if (!normalizedLookupCode && !memberId) {
          return jsonResponse({ error: 'Ingresá el código de la tarjeta del socio.' }, 400);
        }

        let memberRow: D1LoyaltyMemberRow | null = null;

        if (normalizedLookupCode) {
          memberRow = await env.DB
            .prepare(
              `SELECT * FROM loyalty_members
               WHERE tenant_id = ?
                 AND REPLACE(REPLACE(TRIM(barcode_token), ' ', ''), '-', '') = ?
               LIMIT 1`
            )
            .bind(tenantId, normalizedLookupCode)
            .first<D1LoyaltyMemberRow>();
        }

        if (!memberRow && memberId) {
          memberRow = await env.DB
            .prepare('SELECT * FROM loyalty_members WHERE tenant_id = ? AND id = ? LIMIT 1')
            .bind(tenantId, memberId)
            .first<D1LoyaltyMemberRow>();
        }

        if (!memberRow) {
          return jsonResponse(
            { error: 'No encontramos esa tarjeta en tu comercio.' },
            404
          );
        }

        const hubRow = await env.DB
          .prepare(
            `SELECT tenant_id, business_name, loyalty_title, loyalty_reward, reward_text,
                    stamps_required, reward_value_ars, brand_color, color_preset, custom_color, logo_url
             FROM hub_configs
             WHERE tenant_id = ? LIMIT 1`
          )
          .bind(tenantId)
          .first<D1HubConfigRow>();

        const lastStampedAt = memberRow.last_stamped_at ?? null;
        if (lastStampedAt) {
          const lastMs = new Date(lastStampedAt).getTime();
          if (!Number.isNaN(lastMs)) {
            const elapsedMs = Date.now() - lastMs;
            if (elapsedMs < COOLDOWN_24H_MS) {
              const remainingMs = COOLDOWN_24H_MS - elapsedMs;
              const hours = Math.floor(remainingMs / 3600000);
              const minutes = Math.max(1, Math.ceil((remainingMs % 3600000) / 60000));
              const customerDisplay = formatShortCustomerName(
                memberRow.customer_name || memberRow.name
              );
              return jsonResponse({
                status: 'cooldown',
                cooldown: true,
                customerName: customerDisplay,
                stamps: Number(memberRow.stamps || 0),
                stampsRequired: Number(hubRow?.stamps_required || memberRow.stamps_required || 10),
                remainingMs,
                remainingHours: hours,
                remainingMinutes: minutes,
                message: `Próximo sello disponible en ${hours} h ${minutes} min`,
              });
            }
          }
        }

        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        // Siempre +1 sello decidido por el servidor
        const nextStamps = Number(memberRow.stamps || 0) + 1;
        const stampsRequired = Number(hubRow?.stamps_required || memberRow.stamps_required || 10);
        const businessName =
          hubRow?.business_name || hubRow?.loyalty_title || 'Comercio adherido';
        const rewardText =
          hubRow?.reward_text || hubRow?.loyalty_reward || 'Premio al completar tus sellos';
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const rawPreset = (hubRow?.color_preset || 'dark') as ColorPreset;
        const colorPreset: ColorPreset = validPresets.includes(rawPreset) ? rawPreset : 'dark';
        const finalBarcodeToken =
          normalize8DigitToken(memberRow.barcode_token) ||
          (await generateUnique8DigitBarcode(env.DB));
        const walletSerial = memberRow.wallet_serial || '';
        const lastNotification = memberRow.wallet_last_notification ?? ' ';
        const customerName = formatShortCustomerName(
          memberRow.customer_name || memberRow.name
        );

        let walletSyncError: string | null = null;
        let notifiedDevices = 0;

        if (walletSerial && env.WALLETWALLET_API_KEY) {
          try {
            const card: CardInput = {
              businessName,
              memberName: memberRow.customer_name || memberRow.name || undefined,
              stamps: nextStamps,
              stampsRequired,
              rewardText,
              barcodeToken: finalBarcodeToken,
              colorPreset,
              notification: lastNotification,
            };
            const upd = await updatePass(env, walletSerial, card);
            notifiedDevices = upd.notifiedDevices;
          } catch (err: any) {
            walletSyncError =
              err instanceof WalletError
                ? err.message
                : 'No se pudo actualizar la tarjeta en la billetera.';
          }
        }

        await env.DB
          .prepare(
            `UPDATE loyalty_members
             SET stamps = ?, points = ?, last_stamped_at = ?, barcode_token = ?, wallet_sync_error = ?
             WHERE id = ? AND tenant_id = ?`
          )
          .bind(
            nextStamps,
            nextStamps,
            nowIso,
            finalBarcodeToken,
            walletSyncError,
            memberRow.id,
            tenantId
          )
          .run();

        const stampedConsumerId = memberRow.consumer_id || memberRow.id || null;
        if (stampedConsumerId) {
          await env.DB
            .prepare(
              `UPDATE hub_configs
               SET last_stamped_consumer_id = ?, last_stamped_at_ms = ?
               WHERE tenant_id = ?`
            )
            .bind(stampedConsumerId, nowMs, tenantId)
            .run()
            .catch(() => {});
        }

        return jsonResponse({
          status: 'stamped',
          cooldown: false,
          customerName,
          stamps: nextStamps,
          stampsRequired,
          lastStampedAt: nowIso,
          barcodeToken: finalBarcodeToken,
          walletSerial: walletSerial || undefined,
          notifiedDevices,
          walletSyncError: walletSyncError || undefined,
        });
      } catch {
        return jsonResponse({ status: 'error', error: 'No se pudo registrar el sello.' }, 400);
      }
    }

    // 13. Comprobantes en Caja: POST /api/merchant/pos-sale (exigir sesión de comercio y usar session.tenantId)
    if (pathname === '/api/merchant/pos-sale' && request.method === 'POST') {
      const session = await getMerchantSession(request, env);
      if (!session) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      const tenantId = session.tenantId;

      try {
        const body = (await request.json().catch(() => ({}))) as {
          localCode?: string;
          merchantName?: string;
          amountArs?: number;
          discountSavedArs?: number;
          paymentMethod?: string;
          cashReceivedArs?: number;
          changeArs?: number;
          items?: Array<{ name: string; qty: number; priceArs: number }>;
          note?: string;
          consumerId?: string;
          storeLat?: number;
          storeLng?: number;
        };

        const localCode = String(body.localCode || 'LOCAL01').trim().toUpperCase();
        let merchantName = String(body.merchantName || 'Comercio').trim();
        const amountArs = Math.max(0, Number(body.amountArs || 0));
        const discountSavedArs = Math.max(0, Number(body.discountSavedArs || 0));
        const paymentMethod = String(body.paymentMethod || 'efectivo').trim();
        const cashReceivedArs =
          typeof body.cashReceivedArs === 'number' ? body.cashReceivedArs : null;
        const changeArs = typeof body.changeArs === 'number' ? body.changeArs : null;
        const itemsJson =
          Array.isArray(body.items) && body.items.length > 0
            ? JSON.stringify(body.items)
            : null;
        const note = String(body.note || '').trim() || null;

        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const receiptId = `rcp-${nowMs.toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
        const expiresAtMs = nowMs + RECEIPT_CLAIM_WINDOW_MS;

        let assignedConsumerId: string | null = null;
        let storeLat: number | null = typeof body.storeLat === 'number' ? body.storeLat : null;
        let storeLng: number | null = typeof body.storeLng === 'number' ? body.storeLng : null;

        if (env.DB) {
          const hubRow = await env.DB
            .prepare(
              `SELECT business_name, last_stamped_consumer_id, last_stamped_at_ms, store_lat, store_lng
               FROM hub_configs
               WHERE tenant_id = ? LIMIT 1`
            )
            .bind(tenantId)
            .first<D1HubConfigRow>();

          if (hubRow?.business_name) {
            merchantName = hubRow.business_name;
          }
          if (storeLat === null && typeof hubRow?.store_lat === 'number') {
            storeLat = hubRow.store_lat;
          }
          if (storeLng === null && typeof hubRow?.store_lng === 'number') {
            storeLng = hubRow.store_lng;
          }

          if (
            hubRow?.last_stamped_consumer_id &&
            typeof hubRow.last_stamped_at_ms === 'number' &&
            nowMs - hubRow.last_stamped_at_ms <= RECENT_STAMP_WINDOW_MS
          ) {
            assignedConsumerId = hubRow.last_stamped_consumer_id;
            await env.DB
              .prepare(
                'UPDATE hub_configs SET last_stamped_consumer_id = NULL, last_stamped_at_ms = NULL WHERE tenant_id = ?'
              )
              .bind(tenantId)
              .run()
              .catch(() => {});
          }

          await env.DB
            .prepare(
              `INSERT INTO pos_receipts (
                 id, tenant_id, local_code, merchant_name, amount_ars, discount_saved_ars,
                 payment_method, cash_received_ars, change_ars, items_json, note,
                 claimed_by, expires_at_ms, store_lat, store_lng, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              receiptId,
              tenantId,
              localCode,
              merchantName,
              amountArs,
              discountSavedArs,
              paymentMethod,
              cashReceivedArs,
              changeArs,
              itemsJson,
              note,
              assignedConsumerId,
              expiresAtMs,
              storeLat,
              storeLng,
              nowIso
            )
            .run();

          if (assignedConsumerId) {
            await env.DB
              .prepare(
                `INSERT OR IGNORE INTO consumer_receipts (
                   id, consumer_id, tenant_id, merchant_name, amount_ars, discount_saved_ars, category, receipt_note, created_at
                 ) VALUES (?, ?, ?, ?, ?, ?, 'Comercio', ?, ?)`
              )
              .bind(
                receiptId,
                assignedConsumerId,
                tenantId,
                merchantName,
                amountArs,
                discountSavedArs,
                note || `Pago con ${paymentMethod}`,
                nowIso
              )
              .run()
              .catch(() => {});
          }
        }

        return jsonResponse({
          success: true,
          receipt: {
            id: receiptId,
            tenantId,
            localCode,
            merchantName,
            amountArs,
            discountSavedArs,
            paymentMethod,
            cashReceivedArs: cashReceivedArs ?? undefined,
            changeArs: changeArs ?? undefined,
            items: body.items || [],
            note: note ?? undefined,
            claimedBy: assignedConsumerId,
            directAssigned: Boolean(assignedConsumerId),
            expiresAtMs,
            createdAt: nowIso,
          },
        });
      } catch {
        return jsonResponse({ error: 'No pudimos emitir el comprobante.' }, 400);
      }
    }

    // Reclamo o consulta de comprobante desde el Hub: POST /api/public/hub/receipt-check
    if (pathname === '/api/public/hub/receipt-check' && request.method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          localCode?: string;
          tenantId?: string;
          lat?: number;
          lng?: number;
        };

        const localCode = String(body.localCode || '').trim().toUpperCase();
        const tenantId = String(body.tenantId || '').trim();
        const consumerSession = await getConsumerSession(request, env);
        const consumerId = consumerSession?.consumerId || '';
        const userLat = typeof body.lat === 'number' ? body.lat : null;
        const userLng = typeof body.lng === 'number' ? body.lng : null;

        if (!env.DB) {
          return jsonResponse({ available: false, receipt: null });
        }

        const nowMs = Date.now();
        const candidate = await env.DB
          .prepare(
            `SELECT * FROM pos_receipts
             WHERE (UPPER(local_code) = ? OR tenant_id = ?)
             ORDER BY created_at DESC
             LIMIT 1`
          )
          .bind(localCode, tenantId || localCode)
          .first<any>()
          .catch(() => null);

        if (!candidate) {
          return jsonResponse({ available: false, receipt: null });
        }

        if (consumerId && candidate.claimed_by === consumerId) {
          return jsonResponse({
            available: true,
            receipt: {
              id: candidate.id,
              tenantId: candidate.tenant_id,
              localCode: candidate.local_code,
              merchantName: candidate.merchant_name,
              amountArs: Number(candidate.amount_ars || 0),
              discountSavedArs: Number(candidate.discount_saved_ars || 0),
              paymentMethod: candidate.payment_method || 'efectivo',
              cashReceivedArs:
                candidate.cash_received_ars !== null ? Number(candidate.cash_received_ars) : undefined,
              changeArs:
                candidate.change_ars !== null ? Number(candidate.change_ars) : undefined,
              items: candidate.items_json ? JSON.parse(candidate.items_json) : [],
              note: candidate.note || undefined,
              claimedBy: candidate.claimed_by,
              expiresAtMs: Number(candidate.expires_at_ms),
              createdAt: candidate.created_at,
            },
          });
        }

        const isUnclaimed = !candidate.claimed_by;
        const isWithin90s = Number(candidate.expires_at_ms || 0) >= nowMs;

        if (!isUnclaimed || !isWithin90s) {
          return jsonResponse({ available: false, receipt: null });
        }

        if (
          typeof candidate.store_lat === 'number' &&
          typeof candidate.store_lng === 'number'
        ) {
          if (userLat === null || userLng === null) {
            return jsonResponse({
              available: false,
              requiresLocation: true,
              receipt: null,
            });
          }
          const distance = calculateDistanceMeters(
            userLat,
            userLng,
            candidate.store_lat,
            candidate.store_lng
          );
          if (distance > MAX_RECEIPT_DISTANCE_METERS) {
            return jsonResponse({
              available: false,
              outOfRange: true,
              distanceMeters: Math.round(distance),
              receipt: null,
            });
          }
        }

        const claimerKey = consumerId || `anon-${crypto.randomUUID().slice(0, 8)}`;
        await env.DB
          .prepare('UPDATE pos_receipts SET claimed_by = ? WHERE id = ? AND claimed_by IS NULL')
          .bind(claimerKey, candidate.id)
          .run()
          .catch(() => {});

        return jsonResponse({
          available: true,
          claimedBy: claimerKey,
          receipt: {
            id: candidate.id,
            tenantId: candidate.tenant_id,
            localCode: candidate.local_code,
            merchantName: candidate.merchant_name,
            amountArs: Number(candidate.amount_ars || 0),
            discountSavedArs: Number(candidate.discount_saved_ars || 0),
            paymentMethod: candidate.payment_method || 'efectivo',
            cashReceivedArs:
              candidate.cash_received_ars !== null ? Number(candidate.cash_received_ars) : undefined,
            changeArs:
              candidate.change_ars !== null ? Number(candidate.change_ars) : undefined,
            items: candidate.items_json ? JSON.parse(candidate.items_json) : [],
            note: candidate.note || undefined,
            claimedBy: claimerKey,
            expiresAtMs: Number(candidate.expires_at_ms),
            createdAt: candidate.created_at,
          },
        });
      } catch {
        return jsonResponse({ available: false, receipt: null });
      }
    }

    // 14. Eliminar cuenta del comercio: DELETE /api/merchant/account (solo rol 'owner' y con código de verificación reciente)
    if (pathname === '/api/merchant/account' && request.method === 'DELETE') {
      const session = await getMerchantSession(request, env);
      if (!session) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      if (session.role !== 'owner') {
        return jsonResponse(
          { error: 'Solo el titular del comercio puede eliminar la cuenta.' },
          403
        );
      }
      if (!env.DB || !env.KV) {
        return jsonResponse({ error: 'Servicio no disponible.' }, 503);
      }

      try {
        const body = (await request.json().catch(() => ({}))) as { code?: string };
        const otpCode = String(body.code || url.searchParams.get('code') || '').trim();
        const emailLower = session.email.toLowerCase();

        let verifiedRecently = false;
        if (otpCode) {
          verifiedRecently = await verifyAndConsumeOtp(env, emailLower, otpCode, 'merchant');
        } else {
          const recentVerify = await env.KV.get(`verified:merchant:${emailLower}`, 'text');
          if (recentVerify) {
            verifiedRecently = true;
            await env.KV.delete(`verified:merchant:${emailLower}`).catch(() => {});
          }
        }

        if (!verifiedRecently) {
          return jsonResponse(
            {
              error:
                'Pedí un código de verificación nuevo a tu correo e ingresalo para eliminar la cuenta.',
            },
            403
          );
        }

        const tenantId = session.tenantId;
        const tablesWithTenant = [
          'pos_receipts',
          'consumer_receipts',
          'merchant_cards',
          'cards',
          'loyalty_members',
          'hub_configs',
          'carteles',
          'short_links',
          'users',
        ];
        for (const table of tablesWithTenant) {
          await env.DB
            .prepare(`DELETE FROM ${table} WHERE tenant_id = ?`)
            .bind(tenantId)
            .run()
            .catch(() => {});
        }
        await env.DB
          .prepare('DELETE FROM tenants WHERE id = ?')
          .bind(tenantId)
          .run()
          .catch(() => {});

        return jsonResponse(
          { success: true, deletedTenantId: tenantId },
          200,
          {
            'Set-Cookie': clearMerchantCookie(),
          }
        );
      } catch {
        return jsonResponse({ error: 'No se pudo eliminar la cuenta del comercio.' }, 400);
      }
    }

    // 15. Uso y cuota de WalletWallet (GET /api/wallet/usage): solo sesión de dueño
    if (pathname === '/api/wallet/usage' && request.method === 'GET') {
      const session = await getMerchantSession(request, env);
      if (!session || session.role !== 'owner') {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }

      try {
        const usage = await getUsage(env);
        return jsonResponse({ configured: true, ...usage });
      } catch (err: any) {
        const status = err instanceof WalletError ? err.status : 502;
        return jsonResponse(
          {
            configured: Boolean(env.WALLETWALLET_API_KEY),
            error: err?.message || 'No se pudo consultar el cupo de tarjetas.',
            code: err instanceof WalletError ? err.code : 'upstream',
          },
          status
        );
      }
    }

    // 16. Revocar tarjeta en WalletWallet: DELETE /api/wallet/pass/:serialNumber (solo dueño de la tarjeta o dueño del comercio)
    if (pathname.startsWith('/api/wallet/pass/') && request.method === 'DELETE') {
      const consumerSession = await getConsumerSession(request, env);
      const merchantSession = await getMerchantSession(request, env);
      if (!consumerSession && !merchantSession) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      if (!env.DB) {
        return jsonResponse({ error: 'Base de datos no disponible.' }, 503);
      }

      const serialNumber = decodeURIComponent(
        pathname.replace('/api/wallet/pass/', '').split('/')[0] || ''
      ).trim();

      if (!serialNumber) {
        return jsonResponse({ error: 'Indicá la tarjeta a dar de baja.' }, 400);
      }

      const memberRow = await env.DB
        .prepare('SELECT * FROM loyalty_members WHERE wallet_serial = ? LIMIT 1')
        .bind(serialNumber)
        .first<D1LoyaltyMemberRow>();

      if (!memberRow) {
        return jsonResponse({ error: 'No encontramos esa tarjeta.' }, 404);
      }

      const isCardOwner =
        consumerSession &&
        (memberRow.consumer_id === consumerSession.consumerId ||
          String(memberRow.customer_email || '').trim().toLowerCase() ===
            consumerSession.email.toLowerCase() ||
          String(memberRow.contact || '').trim().toLowerCase() ===
            consumerSession.email.toLowerCase());

      const isMerchantOwner =
        merchantSession &&
        merchantSession.role === 'owner' &&
        merchantSession.tenantId === memberRow.tenant_id;

      if (!isCardOwner && !isMerchantOwner) {
        return jsonResponse({ error: 'No tenés permiso para dar de baja esta tarjeta.' }, 403);
      }

      try {
        if (env.WALLETWALLET_API_KEY) {
          await revokePass(env, serialNumber);
        }
        await env.DB
          .prepare('DELETE FROM loyalty_members WHERE id = ?')
          .bind(memberRow.id)
          .run();

        return jsonResponse({ success: true, revokedSerial: serialNumber });
      } catch (err: any) {
        const status = err instanceof WalletError ? err.status : 400;
        return jsonResponse(
          {
            success: false,
            error: err?.message || 'No se pudo dar de baja la tarjeta.',
            code: err instanceof WalletError ? err.code : 'upstream',
          },
          status
        );
      }
    }

    // 17. Emitir o actualizar tarjeta en WalletWallet (POST/PUT /api/wallet/pass o /api/wallet/create):
    // Exige sesión de cliente o de comercio, valida pertenencia y toma todos los datos de D1 (sin devolver base64 en JSON)
    if (
      (pathname === '/api/wallet/pass' ||
        pathname === '/api/wallet/create' ||
        pathname.startsWith('/api/wallet/pass/')) &&
      (request.method === 'POST' || request.method === 'PUT')
    ) {
      const consumerSession = await getConsumerSession(request, env);
      const merchantSession = await getMerchantSession(request, env);
      if (!consumerSession && !merchantSession) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }
      if (!env.DB) {
        return jsonResponse(
          { success: false, error: 'La emisión de pases requiere la base de datos configurada.' },
          503
        );
      }

      let targetMemberId = '';
      try {
        const body = (await request.json().catch(() => ({}))) as {
          memberId?: string;
          barcodeToken?: string;
          barcodeValue?: string;
          memberCode?: string;
          serialNumber?: string;
          walletSerial?: string;
        };

        const urlSerial = pathname.startsWith('/api/wallet/pass/')
          ? decodeURIComponent(pathname.replace('/api/wallet/pass/', '').split('/')[0] || '')
          : '';
        const existingSerial = String(
          urlSerial || body.serialNumber || body.walletSerial || ''
        ).trim();
        const rawToken = String(
          body.barcodeToken || body.barcodeValue || body.memberCode || ''
        ).trim();
        const memberId = String(body.memberId || '').trim();

        const memberRow = await env.DB
          .prepare(
            `SELECT * FROM loyalty_members
             WHERE (id = ? AND ? != '')
                OR (barcode_token = ? AND ? != '')
                OR (wallet_serial = ? AND ? != '')
             LIMIT 1`
          )
          .bind(memberId, memberId, rawToken, rawToken, existingSerial, existingSerial)
          .first<D1LoyaltyMemberRow>();

        if (!memberRow) {
          return jsonResponse({ success: false, error: 'No encontramos esa tarjeta.' }, 404);
        }
        targetMemberId = memberRow.id;

        const isCardOwner =
          consumerSession &&
          (memberRow.consumer_id === consumerSession.consumerId ||
            String(memberRow.customer_email || '').trim().toLowerCase() ===
              consumerSession.email.toLowerCase() ||
            String(memberRow.contact || '').trim().toLowerCase() ===
              consumerSession.email.toLowerCase());

        const isMerchantMember =
          merchantSession && merchantSession.tenantId === memberRow.tenant_id;

        if (!isCardOwner && !isMerchantMember) {
          return jsonResponse(
            { success: false, error: 'No tenés permiso sobre esta tarjeta.' },
            403
          );
        }

        // Contenido de la tarjeta obtenido exclusivamente de la base D1
        const hubRow = await env.DB
          .prepare(
            `SELECT business_name, loyalty_title, reward_text, loyalty_reward, stamps_required, color_preset
             FROM hub_configs WHERE tenant_id = ? LIMIT 1`
          )
          .bind(memberRow.tenant_id)
          .first<D1HubConfigRow>()
          .catch(() => null);

        const cardRow = await env.DB
          .prepare(
            `SELECT business_name, reward_text, stamps_required, color_preset
             FROM merchant_cards WHERE tenant_id = ? LIMIT 1`
          )
          .bind(memberRow.tenant_id)
          .first<{
            business_name?: string;
            reward_text?: string;
            stamps_required?: number;
            color_preset?: string;
          }>()
          .catch(() => null);

        const tenantRow = await env.DB
          .prepare('SELECT name FROM tenants WHERE id = ? LIMIT 1')
          .bind(memberRow.tenant_id)
          .first<{ name?: string }>()
          .catch(() => null);

        const businessName = (
          cardRow?.business_name ||
          hubRow?.business_name ||
          tenantRow?.name ||
          'Comercio adherido'
        ).slice(0, 64);

        const memberName =
          (
            memberRow.customer_name ||
            memberRow.name ||
            consumerSession?.fullName ||
            ''
          ).trim() || undefined;

        const stamps = Math.max(0, Number(memberRow.stamps || 0));
        const stampsRequired = Number(
          cardRow?.stamps_required || hubRow?.stamps_required || memberRow.stamps_required || 10
        );
        const rewardText = (
          cardRow?.reward_text ||
          hubRow?.reward_text ||
          hubRow?.loyalty_reward ||
          'Beneficio al completar tus 10 sellos'
        ).slice(0, 60);

        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const rawPreset = (cardRow?.color_preset || hubRow?.color_preset || 'dark') as ColorPreset;
        const colorPreset: ColorPreset = validPresets.includes(rawPreset) ? rawPreset : 'dark';

        let barcodeToken = normalize8DigitToken(memberRow.barcode_token);
        if (!barcodeToken) {
          barcodeToken = await generateUnique8DigitBarcode(env.DB);
          await env.DB
            .prepare('UPDATE loyalty_members SET barcode_token = ?, member_code = ? WHERE id = ?')
            .bind(barcodeToken, barcodeToken, memberRow.id)
            .run();
        }

        const serialToUpdate = String(memberRow.wallet_serial || '').trim();

        const card: CardInput = {
          businessName,
          memberName,
          stamps,
          stampsRequired,
          rewardText,
          barcodeToken,
          colorPreset,
          notification: memberRow.wallet_last_notification ?? ' ',
        };

        if (serialToUpdate && !serialToUpdate.startsWith('ww-')) {
          try {
            const upd = await updatePass(env, serialToUpdate, card);
            const storedAppleBase64 = memberRow.wallet_apple_base64 || null;
            const storedGoogleUrl = memberRow.wallet_google_url || '';
            if (storedAppleBase64 && storedGoogleUrl) {
              const oneTimeAppleUrl = await createOneTimeWalletDownloadUrl(env, memberRow.id);
              return jsonResponse({
                success: true,
                configured: true,
                passId: serialToUpdate,
                serialNumber: serialToUpdate,
                appleWalletUrl: oneTimeAppleUrl,
                googleSaveUrl: storedGoogleUrl,
                googleWalletUrl: storedGoogleUrl,
                unchanged: upd.unchanged,
                notifiedDevices: upd.notifiedDevices,
                barcodeValue: barcodeToken,
                validationCode: barcodeToken,
              });
            }
          } catch {
            // Si el pase previo no existía en el proveedor, emitimos uno nuevo debajo
          }
        }

        const created = await createPass(env, card);
        const googleSaveUrl = created.googleSaveUrl || '';
        await env.DB
          .prepare(
            `UPDATE loyalty_members
             SET wallet_serial = ?, barcode_token = ?,
                 wallet_apple_base64 = COALESCE(?, wallet_apple_base64),
                 wallet_google_url = COALESCE(?, wallet_google_url),
                 wallet_sync_error = NULL
             WHERE id = ?`
          )
          .bind(
            created.serialNumber,
            barcodeToken,
            created.applePass || null,
            googleSaveUrl || null,
            memberRow.id
          )
          .run();

        const oneTimeAppleUrl = created.applePass
          ? await createOneTimeWalletDownloadUrl(env, memberRow.id)
          : undefined;

        return jsonResponse({
          success: true,
          configured: true,
          passId: created.serialNumber,
          serialNumber: created.serialNumber,
          shareUrl: created.shareUrl,
          appleWalletUrl: oneTimeAppleUrl,
          googleSaveUrl,
          googleWalletUrl: googleSaveUrl,
          barcodeValue: barcodeToken,
          validationCode: barcodeToken,
        });
      } catch (err: any) {
        const status = err instanceof WalletError ? err.status : 502;
        const errorMessage =
          err instanceof WalletError
            ? err.message
            : 'No pudimos guardar la tarjeta en tu billetera.';

        if (env.DB && targetMemberId) {
          await env.DB
            .prepare('UPDATE loyalty_members SET wallet_sync_error = ? WHERE id = ?')
            .bind(errorMessage, targetMemberId)
            .run()
            .catch(() => {});
        }

        return jsonResponse(
          {
            success: false,
            error: errorMessage,
            code: err instanceof WalletError ? err.code : 'upstream',
          },
          status
        );
      }
    }

    // 18. Sincronización de cuenta de cliente (/api/consumer/sync): exige sesión de cliente
    if (pathname === '/api/consumer/sync' && request.method === 'POST') {
      const consumerSession = await getConsumerSession(request, env);
      if (!consumerSession) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }

      try {
        const body = (await request.json().catch(() => ({}))) as {
          receipts?: Array<{
            id: string;
            tenantId?: string;
            merchantName?: string;
            amountArs?: number;
            discountSavedArs?: number;
            category?: string;
            receiptNote?: string;
            createdAt?: string;
          }>;
        };

        const consumerId = consumerSession.consumerId;
        const email = consumerSession.email;
        const fullName = consumerSession.fullName;
        const birthDate = consumerSession.birthDate;
        const receipts = Array.isArray(body.receipts) ? body.receipts : [];

        if (env.DB) {
          for (const r of receipts) {
            if (!r?.id) continue;
            await env.DB
              .prepare(
                `INSERT INTO consumer_receipts (id, consumer_id, tenant_id, merchant_name, amount_ars, discount_saved_ars, category, receipt_note, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO NOTHING`
              )
              .bind(
                r.id,
                consumerId,
                r.tenantId || 'comercio',
                r.merchantName || 'Comercio',
                Number(r.amountArs) || 0,
                Number(r.discountSavedArs) || 0,
                r.category || 'Comercio',
                r.receiptNote || 'Comprobante guardado',
                r.createdAt || new Date().toISOString()
              )
              .run()
              .catch(() => {});
          }
        }

        return jsonResponse({
          success: true,
          consumerId,
          user: {
            id: consumerId,
            emailOrPhone: email,
            displayName: fullName,
            birthDate: birthDate || undefined,
            ageGroup: 'all',
            consentSaveReceipts: true,
            consentMarketingNetwork: false,
            createdAt: consumerSession.createdAt,
            syncedAt: new Date().toISOString(),
          },
          receiptsCount: receipts.length,
        });
      } catch {
        return jsonResponse(
          { success: false, error: 'No pudimos guardar tus datos en tu cuenta.' },
          400
        );
      }
    }

    if (pathname === '/api/consumer/sync' && request.method === 'GET') {
      const consumerSession = await getConsumerSession(request, env);
      if (!consumerSession || !env.DB) {
        return jsonResponse({ error: 'Iniciá sesión.' }, 401);
      }

      try {
        const receiptsRes = await env.DB
          .prepare(
            'SELECT id, consumer_id, tenant_id, merchant_name, amount_ars, discount_saved_ars, category, receipt_note, created_at FROM consumer_receipts WHERE consumer_id = ? ORDER BY created_at DESC'
          )
          .bind(consumerSession.consumerId)
          .all<any>();

        return jsonResponse({
          found: true,
          user: {
            id: consumerSession.consumerId,
            emailOrPhone: consumerSession.email,
            displayName: consumerSession.fullName,
            birthDate: consumerSession.birthDate || undefined,
            ageGroup: 'all',
            consentSaveReceipts: true,
            consentMarketingNetwork: false,
            createdAt: consumerSession.createdAt,
          },
          receipts: (receiptsRes.results || []).map((r: any) => ({
            id: r.id,
            consumerId: r.consumer_id,
            tenantId: r.tenant_id,
            merchantName: r.merchant_name,
            amountArs: Number(r.amount_ars) || 0,
            discountSavedArs: Number(r.discount_saved_ars) || 0,
            category: r.category || 'Comercio',
            receiptNote: r.receipt_note || '',
            createdAt: r.created_at,
          })),
        });
      } catch {
        return jsonResponse({ found: false }, 500);
      }
    }

    // ==========================================
    // Toque Carta — Endpoints Públicos y de Comercio en Worker
    // ==========================================

    // 1. Obtener menú público por mesa o slug: GET /api/public/menu/:tableCode
    if (pathname.startsWith('/api/public/menu/') && request.method === 'GET') {
      const tableCode = decodeURIComponent(pathname.replace('/api/public/menu/', '').trim()).toUpperCase();
      let tenantId = 'comercio-activo';
      let tableLabel = 'Mesa';
      let businessName = 'Mi comercio';

      if (env.DB) {
        try {
          const tableRow = await env.DB
            .prepare('SELECT id, tenant_id, label, code, active FROM dining_tables WHERE UPPER(code) = ? LIMIT 1')
            .bind(tableCode)
            .first<any>()
            .catch(() => null);

          if (tableRow) {
            tenantId = tableRow.tenant_id;
            tableLabel = tableRow.label;
          }

          // Consultar categorías e items de D1
          const categoriesRes = await env.DB
            .prepare('SELECT id, tenant_id, name, sort FROM menu_categories WHERE tenant_id = ? ORDER BY sort ASC')
            .bind(tenantId)
            .all<any>()
            .catch(() => ({ results: [] }));

          const itemsRes = await env.DB
            .prepare('SELECT id, tenant_id, category_id, name, description, price, available, sort FROM menu_items WHERE tenant_id = ? AND available = 1 ORDER BY sort ASC')
            .bind(tenantId)
            .all<any>()
            .catch(() => ({ results: [] }));

          const bizRow = await env.DB
            .prepare('SELECT name FROM tenants WHERE id = ? LIMIT 1')
            .bind(tenantId)
            .first<any>()
            .catch(() => null);

          if (bizRow?.name) businessName = bizRow.name;

          return jsonResponse({
            tenantId,
            businessName,
            tableCode,
            tableLabel,
            categories: (categoriesRes.results || []).map((c: any) => ({
              id: c.id,
              tenantId: c.tenant_id,
              name: c.name,
              sortOrder: c.sort,
              active: true,
            })),
            items: (itemsRes.results || []).map((i: any) => ({
              id: i.id,
              tenantId: i.tenant_id,
              categoryId: i.category_id,
              name: i.name,
              description: i.description || '',
              price: Number(i.price) || 0,
              available: Boolean(i.available),
            })),
          });
        } catch {
          // fallback
        }
      }

      // Fallback si no hay D1 o mesa en desarrollo
      return jsonResponse({
        tenantId,
        businessName,
        tableCode,
        tableLabel,
        categories: [
          { id: 'cat-cafeteria', tenantId, name: 'Cafetería', sortOrder: 1, active: true },
          { id: 'cat-pasteleria', tenantId, name: 'Pastelería', sortOrder: 2, active: true },
          { id: 'cat-almuerzos', tenantId, name: 'Almuerzos', sortOrder: 3, active: true },
        ],
        items: [
          { id: 'item-1', tenantId, categoryId: 'cat-cafeteria', name: 'Café Flat White', description: 'Doble shot de espresso con leche texturizada sedosa', price: 3400, available: true },
          { id: 'item-2', tenantId, categoryId: 'cat-cafeteria', name: 'Espresso Doble', description: 'Granos de especialidad tostados en origen', price: 2800, available: true },
          { id: 'item-3', tenantId, categoryId: 'cat-pasteleria', name: 'Medialuna rellena de jamón y queso', description: 'Horneada en el día con manteca pura', price: 2900, available: true },
          { id: 'item-4', tenantId, categoryId: 'cat-pasteleria', name: 'Cookie con chips de chocolate', description: 'Masa tierna con chocolate belga semi amargo', price: 2500, available: false },
          { id: 'item-5', tenantId, categoryId: 'cat-almuerzos', name: 'Tostón de palta y huevo poché', description: 'Pan de masa madre, palta fresca, semillas y oliva', price: 5900, available: true },
        ],
      });
    }

    // 2. Crear pedido (comanda autoritativa): POST /api/pedidos o POST /api/public/orders
    if ((pathname === '/api/pedidos' || pathname === '/api/public/orders') && request.method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as any;
        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) {
          return jsonResponse({ error: 'El pedido no contiene platos.' }, 400);
        }
        if (items.length > 30) {
          return jsonResponse({ error: 'El pedido supera el máximo permitido de 30 platos.' }, 400);
        }

        let tenantId = 'comercio-activo';
        let tableLabel = body.tableLabel || 'Mesa';
        let tableId = body.tableCode || 'MESA-01';

        // Buscar mesa si vino tableCode
        if (env.DB && body.tableCode) {
          const tbl = await env.DB
            .prepare('SELECT id, tenant_id, label FROM dining_tables WHERE UPPER(code) = ? LIMIT 1')
            .bind(String(body.tableCode).toUpperCase())
            .first<any>()
            .catch(() => null);
          if (tbl) {
            tenantId = tbl.tenant_id;
            tableLabel = tbl.label;
            tableId = tbl.id;
          }
        }

        const slipItems: any[] = [];
        let totalArs = 0;

        // SEGURIDAD CRÍTICA: El total se recalcula siempre en el backend consultando D1
        for (const it of items) {
          if (!it?.itemId) continue;
          const qty = Math.min(20, Math.max(1, Math.round(Number(it.qty) || 1)));
          let unitPrice = 0;
          let dishName = 'Plato';

          if (env.DB) {
            const dishRow = await env.DB
              .prepare('SELECT name, price, available FROM menu_items WHERE id = ? LIMIT 1')
              .bind(it.itemId)
              .first<any>()
              .catch(() => null);

            if (dishRow) {
              if (dishRow.available === 0) {
                return jsonResponse({ error: `El plato "${dishRow.name}" ya no está disponible.` }, 400);
              }
              unitPrice = Number(dishRow.price) || 0;
              dishName = dishRow.name;
            }
          }

          if (unitPrice === 0) {
            unitPrice = Math.max(0, Math.round(Number(it.unitPrice) || 2000));
            dishName = it.name || 'Plato';
          }

          const subtotal = unitPrice * qty;
          totalArs += subtotal;
          slipItems.push({
            itemId: it.itemId,
            name: dishName,
            qty,
            unitPrice,
            subtotal,
            note: it.note ? String(it.note).slice(0, 150).trim() : undefined,
          });
        }

        if (slipItems.length === 0) {
          return jsonResponse({ error: 'No se pudieron procesar los platos solicitados.' }, 400);
        }

        const orderId = `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const orderType = body.orderType || (body.tableCode ? 'mesa' : 'delivery');
        const now = new Date().toISOString();

        if (env.DB) {
          await env.DB
            .prepare(
              `INSERT INTO orders (id, tenant_id, table_id, status, note, total, order_type, customer_name, customer_phone, customer_address, payment_method, created_at, updated_at)
               VALUES (?, ?, ?, 'nuevo', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              orderId,
              tenantId,
              tableId,
              body.note ? String(body.note).slice(0, 300) : '',
              totalArs,
              orderType,
              body.customerName ? String(body.customerName).slice(0, 100) : null,
              body.customerPhone ? String(body.customerPhone).slice(0, 50) : null,
              body.customerAddress ? String(body.customerAddress).slice(0, 200) : null,
              body.paymentMethod || 'efectivo',
              now,
              now
            )
            .run()
            .catch(() => {});

          for (const item of slipItems) {
            const itemId = `oi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            await env.DB
              .prepare(
                `INSERT INTO order_items (id, order_id, item_id, name, price, qty, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                itemId,
                orderId,
                item.itemId,
                item.name,
                item.unitPrice,
                item.qty,
                item.note || ''
              )
              .run()
              .catch(() => {});
          }
        }

        return jsonResponse({
          id: orderId,
          tenantId,
          tableCode: body.tableCode || 'PEDIDO',
          tableLabel: body.tableLabel || tableLabel,
          orderType,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerAddress: body.customerAddress,
          paymentMethod: body.paymentMethod || 'efectivo',
          items: slipItems,
          totalArs,
          status: 'nuevo',
          note: body.note,
          createdAt: now,
          updatedAt: now,
          area: orderType === 'mesa' ? 'salon' : 'cocina',
        });
      } catch {
        return jsonResponse({ error: 'No pudimos registrar tu pedido.' }, 500);
      }
    }

    // 3. Llamar al mozo: POST /api/mozo
    if (pathname === '/api/mozo' && request.method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as any;
        const tableLabel = (body.tableLabel || 'Mesa').trim();
        const callId = `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();
        let tenantId = 'comercio-activo';

        if (env.DB) {
          if (body.tableCode) {
            const tbl = await env.DB
              .prepare('SELECT tenant_id FROM dining_tables WHERE UPPER(code) = ? LIMIT 1')
              .bind(String(body.tableCode).toUpperCase())
              .first<any>()
              .catch(() => null);
            if (tbl?.tenant_id) tenantId = tbl.tenant_id;
          }

          await env.DB
            .prepare(
              `INSERT INTO waiter_calls (id, tenant_id, table_label, table_code, status, created_at)
               VALUES (?, ?, ?, ?, 'pendiente', ?)`
            )
            .bind(callId, tenantId, tableLabel, body.tableCode || null, now)
            .run()
            .catch(() => {});
        }

        return jsonResponse({
          id: callId,
          tenantId,
          tableLabel,
          tableCode: body.tableCode,
          status: 'pendiente',
          createdAt: now,
        });
      } catch {
        return jsonResponse({ error: 'No pudimos notificar al mozo.' }, 500);
      }
    }

    // 4. Listar llamadas al mozo: GET /api/mozo
    if (pathname === '/api/mozo' && request.method === 'GET') {
      let tenantId = 'comercio-activo';
      const merchantSession = await getMerchantSession(request, env);
      if (merchantSession) tenantId = merchantSession.tenantId;

      if (env.DB) {
        const callsRes = await env.DB
          .prepare(
            `SELECT id, tenant_id, table_label, table_code, status, created_at, attended_at
             FROM waiter_calls
             WHERE tenant_id = ? AND status = 'pendiente'
             ORDER BY created_at DESC
             LIMIT 20`
          )
          .bind(tenantId)
          .all<any>()
          .catch(() => ({ results: [] }));

        return jsonResponse((callsRes.results || []).map((c: any) => ({
          id: c.id,
          tenantId: c.tenant_id,
          tableLabel: c.table_label,
          tableCode: c.table_code || undefined,
          status: c.status,
          createdAt: c.created_at,
          attendedAt: c.attended_at || undefined,
        })));
      }

      return jsonResponse([]);
    }

    // 5. Atender llamada al mozo: POST /api/mozo/:id/dismiss
    if (pathname.startsWith('/api/mozo/') && pathname.endsWith('/dismiss') && request.method === 'POST') {
      const callId = pathname.replace('/api/mozo/', '').replace('/dismiss', '').trim();
      if (env.DB && callId) {
        await env.DB
          .prepare(`UPDATE waiter_calls SET status = 'atendido', attended_at = ? WHERE id = ?`)
          .bind(new Date().toISOString(), callId)
          .run()
          .catch(() => {});
      }
      return jsonResponse({ success: true, callId });
    }

    // 6. Reservas de mesas: POST /api/reservas
    if (pathname === '/api/reservas' && request.method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as any;
        if (!body.customerName || !body.customerPhone || !body.reservationDate || !body.reservationTime) {
          return jsonResponse({ error: 'Completá nombre, teléfono, fecha y hora de la reserva.' }, 400);
        }

        const resId = `res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const tenantId = body.tenantId || 'comercio-activo';
        const now = new Date().toISOString();

        if (env.DB) {
          await env.DB
            .prepare(
              `INSERT INTO table_reservations (id, tenant_id, customer_name, customer_phone, customer_email, people_count, reservation_date, reservation_time, note, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)`
            )
            .bind(
              resId,
              tenantId,
              String(body.customerName).slice(0, 100),
              String(body.customerPhone).slice(0, 50),
              body.customerEmail ? String(body.customerEmail).slice(0, 100) : null,
              Math.max(1, Math.round(Number(body.peopleCount) || 2)),
              String(body.reservationDate).slice(0, 20),
              String(body.reservationTime).slice(0, 10),
              body.note ? String(body.note).slice(0, 300) : '',
              now
            )
            .run()
            .catch(() => {});
        }

        return jsonResponse({
          id: resId,
          tenantId,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          peopleCount: body.peopleCount || 2,
          reservationDate: body.reservationDate,
          reservationTime: body.reservationTime,
          status: 'pendiente',
          createdAt: now,
        });
      } catch {
        return jsonResponse({ error: 'No pudimos registrar tu reserva.' }, 500);
      }
    }

    if (pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Ruta no encontrada.' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
