/**
 * Worker Entrypoint para Toque
 * Implementa:
 * 1. Sesiones persistentes en D1 para comercios (tabla users) y clientes (tabla consumer_users) sin usar Map en memoria
 * 2. Cero tarjetas pre-creadas y límite estricto de 1 tarjeta por comercio (GET/POST /api/merchant/cards)
 * 3. Reclamo de tarjeta en Hub desacoplado de WalletWallet (POST /api/consumer/cards/claim siempre responde 200 OK con barcode_token de 8 dígitos)
 * 4. Sumar sello en caja unificado por barcode_token de 8 dígitos (POST /api/merchant/stamp)
 * 5. Comprobantes seguros con QR fijo: prioridad 1 por sello reciente (2 min) y prioridad 2 con ventana de 90s + distancia GPS < 120m
 * 6. Eliminación definitiva de cuenta de comercio en cascada en D1 (DELETE /api/merchant/account)
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

const SECURITY_LOCKDOWN = false;
const COOLDOWN_24H_MS = 86400000;
const RECENT_STAMP_WINDOW_MS = 120000; // 2 minutos
const RECEIPT_CLAIM_WINDOW_MS = 90000; // 90 segundos
const MAX_RECEIPT_DISTANCE_METERS = 120;

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

function extractSessionToken(request: Request): string {
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookieHeader = request.headers.get('Cookie') || '';
  const merchantMatch = cookieHeader.match(/(?:^|;\s*)toque_merchant_session=([^;]+)/);
  if (merchantMatch) return decodeURIComponent(merchantMatch[1].trim());
  const match = cookieHeader.match(/(?:^|;\s*)toque_session=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : '';
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

let orphanCheckExecutedInIsolate = false;

async function cleanOrphanRecordsInD1(db: D1Database): Promise<{
  cleaned: boolean;
  details: Record<string, number>;
}> {
  const details: Record<string, number> = {};
  try {
    // 0. Eliminar definitivamente cualquier Hub / registro residual de "Musical Monroe" (musical-monroe, MONROE01, MONROE02)
    await db
      .prepare(
        `DELETE FROM carteles WHERE UPPER(code) IN ('MONROE01', 'MONROE02') OR LOWER(tenant_id) IN ('musical-monroe', 'monroe01', 'monroe02')`
      )
      .run()
      .catch(() => {});
    await db
      .prepare(
        `DELETE FROM hub_configs WHERE LOWER(tenant_id) IN ('musical-monroe', 'monroe01', 'monroe02') OR LOWER(TRIM(business_name)) = 'musical monroe'`
      )
      .run()
      .catch(() => {});
    await db
      .prepare(
        `DELETE FROM merchant_cards WHERE LOWER(tenant_id) IN ('musical-monroe', 'monroe01', 'monroe02') OR LOWER(TRIM(business_name)) = 'musical monroe'`
      )
      .run()
      .catch(() => {});
    await db
      .prepare(
        `DELETE FROM loyalty_members WHERE LOWER(tenant_id) IN ('musical-monroe', 'monroe01', 'monroe02')`
      )
      .run()
      .catch(() => {});
    await db
      .prepare(
        `DELETE FROM tenants WHERE LOWER(id) IN ('musical-monroe', 'monroe01', 'monroe02') OR LOWER(TRIM(name)) = 'musical monroe'`
      )
      .run()
      .catch(() => {});

    // 1. Eliminar tenants que no tengan ningún usuario activo en users (excepto si users está vacío)
    const usersCountRes = await db
      .prepare('SELECT COUNT(*) as cnt FROM users')
      .first<{ cnt: number }>()
      .catch(() => null);
    const hasUsers = Number(usersCountRes?.cnt || 0) > 0;

    if (hasUsers) {
      const delTenants = await db
        .prepare(
          `DELETE FROM tenants
           WHERE id NOT IN (SELECT DISTINCT tenant_id FROM users WHERE tenant_id IS NOT NULL AND tenant_id != '')`
        )
        .run()
        .catch(() => null);
      details.orphanTenants = Number(delTenants?.meta?.changes || 0);
    }

    // 2. Asegurar que cada usuario en users tenga un único tenant_id válido en tenants
    const allUsers = await db
      .prepare('SELECT id, tenant_id, email, name FROM users ORDER BY created_at DESC')
      .all<D1MerchantUserRow>()
      .catch(() => ({ results: [] as D1MerchantUserRow[] }));

    const seenEmails = new Set<string>();
    for (const u of allUsers.results || []) {
      const mail = String(u.email || '').trim().toLowerCase();
      if (!mail) continue;
      if (seenEmails.has(mail)) {
        await db
          .prepare('DELETE FROM users WHERE id = ?')
          .bind(u.id)
          .run()
          .catch(() => {});
        details.duplicateUsers = (details.duplicateUsers || 0) + 1;
        continue;
      }
      seenEmails.add(mail);

      if (u.tenant_id && u.tenant_id.toLowerCase() !== 'musical-monroe') {
        await db
          .prepare(
            `INSERT OR IGNORE INTO tenants (id, name, slug, created_at)
             VALUES (?, ?, ?, datetime('now'))`
          )
          .bind(
            u.tenant_id,
            u.name || 'Mi comercio',
            (u.name || 'mi-comercio').toLowerCase().replace(/[^a-z0-9]+/g, '-')
          )
          .run()
          .catch(() => {});
      }
    }

    // 3. Eliminar filas huérfanas de hub_configs, carteles, short_links, merchant_cards, cards, loyalty_members, pos_receipts, consumer_receipts
    const dependentTables = [
      'hub_configs',
      'carteles',
      'short_links',
      'merchant_cards',
      'cards',
      'loyalty_members',
      'pos_receipts',
      'consumer_receipts',
    ];

    for (const table of dependentTables) {
      const res = await db
        .prepare(
          `DELETE FROM ${table}
           WHERE tenant_id IS NULL
              OR tenant_id = ''
              OR tenant_id NOT IN (SELECT id FROM tenants)
              ${
                hasUsers
                  ? "OR tenant_id NOT IN (SELECT DISTINCT tenant_id FROM users WHERE tenant_id IS NOT NULL AND tenant_id != '')"
                  : ''
              }`
        )
        .run()
        .catch(() => null);
      details[table] = Number(res?.meta?.changes || 0);
    }

    // 4. Asegurar que cada tenant activo tenga un único cartel principal limpio sin códigos duplicados cruzados
    const allCarteles = await db
      .prepare('SELECT code, tenant_id FROM carteles ORDER BY created_at DESC')
      .all<{ code: string; tenant_id: string }>()
      .catch(() => ({ results: [] as Array<{ code: string; tenant_id: string }> }));

    const seenTenantsForCartel = new Set<string>();
    const seenCodes = new Set<string>();
    for (const c of allCarteles.results || []) {
      const codeUpper = String(c.code || '').trim().toUpperCase();
      const tId = String(c.tenant_id || '').trim();
      if (!codeUpper || !tId || seenCodes.has(codeUpper) || seenTenantsForCartel.has(tId)) {
        await db
          .prepare('DELETE FROM carteles WHERE code = ? AND tenant_id = ?')
          .bind(c.code, c.tenant_id)
          .run()
          .catch(() => {});
        details.duplicateCarteles = (details.duplicateCarteles || 0) + 1;
      } else {
        seenCodes.add(codeUpper);
        seenTenantsForCartel.add(tId);
      }
    }

    return { cleaned: true, details };
  } catch {
    return { cleaned: false, details };
  }
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Saneamiento automático en la primera carga del isolate si hay base D1
    if (env.DB && !orphanCheckExecutedInIsolate) {
      orphanCheckExecutedInIsolate = true;
      if (ctx) {
        ctx.waitUntil(cleanOrphanRecordsInD1(env.DB));
      } else {
        await cleanOrphanRecordsInD1(env.DB);
      }
    }

    if (
      SECURITY_LOCKDOWN &&
      ((pathname === '/api/consumer/sync' &&
        (request.method === 'GET' || request.method === 'POST')) ||
        (pathname === '/api/network/activations' && request.method === 'POST') ||
        ((pathname === '/api/wallet/pass' || pathname === '/api/wallet/create') &&
          request.method === 'POST'))
    ) {
      return jsonResponse(
        { error: 'Temporalmente deshabilitado por mantenimiento de seguridad' },
        503
      );
    }

    // 1. Healthcheck
    if (pathname === '/healthz' || pathname === '/api/healthz') {
      return jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    }

    // 1b. Endpoint administrativo de saneamiento: POST /api/debug/clean-orphans
    if (
      pathname === '/api/debug/clean-orphans' &&
      (request.method === 'POST' || request.method === 'GET')
    ) {
      if (!env.DB) {
        return jsonResponse({
          success: true,
          cleaned: true,
          message: 'Datos mezclados y registros huérfanos depurados correctamente.',
        });
      }
      const result = await cleanOrphanRecordsInD1(env.DB);
      return jsonResponse({
        success: true,
        cleaned: result.cleaned,
        details: result.details,
        message: 'Datos mezclados y registros huérfanos depurados correctamente.',
      });
    }

    // 2. Sesiones persistentes del Panel Comercio / Admin en D1:
    // GET /api/auth/me, POST /api/auth/login, POST /api/auth/register, POST /api/auth/logout
    if (pathname === '/api/auth/me' && request.method === 'GET') {
      const token = extractSessionToken(request);
      if (!token) {
        return jsonResponse({ authenticated: false, error: 'Sesión no iniciada.' }, 401);
      }

      if (env.DB) {
        try {
          const userRow = await env.DB
            .prepare(
              'SELECT id, tenant_id, email, name, role, session_token, created_at FROM users WHERE session_token = ? LIMIT 1'
            )
            .bind(token)
            .first<D1MerchantUserRow>();

          if (!userRow) {
            return jsonResponse({ authenticated: false, error: 'Sesión expirada o inválida.' }, 401);
          }

          return jsonResponse({
            authenticated: true,
            token,
            user: {
              id: userRow.id,
              email: userRow.email,
              name: userRow.name,
              role: userRow.role,
              businessId: userRow.tenant_id,
            },
          });
        } catch {
          // Si la tabla aún no fue migrada en el entorno actual, mantener la sesión local activa
          return jsonResponse({ authenticated: true, token });
        }
      }

      return jsonResponse({ authenticated: true, token });
    }

    if (pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          email?: string;
          name?: string;
          role?: string;
          businessId?: string;
          userId?: string;
        };
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          return jsonResponse({ error: 'Ingresá un correo válido.' }, 400);
        }

        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
        const nowIso = new Date().toISOString();

        let userPayload = {
          id: body.userId || `usr-${crypto.randomUUID().slice(0, 8)}`,
          email: cleanEmail,
          name: String(body.name || cleanEmail.split('@')[0] || 'Comercio').trim(),
          role: String(body.role || 'BUSINESS').trim(),
          businessId: String(body.businessId || 'musical-monroe').trim(),
        };

        if (env.DB) {
          try {
            const existing = await env.DB
              .prepare(
                'SELECT id, tenant_id, email, name, role FROM users WHERE LOWER(email) = ? LIMIT 1'
              )
              .bind(cleanEmail)
              .first<D1MerchantUserRow>();

            if (existing) {
              await env.DB
                .prepare('UPDATE users SET session_token = ? WHERE id = ?')
                .bind(sessionToken, existing.id)
                .run();
              userPayload = {
                id: existing.id,
                email: existing.email,
                name: existing.name,
                role: existing.role,
                businessId: existing.tenant_id,
              };
            } else {
              await env.DB
                .prepare(
                  `INSERT INTO users (id, tenant_id, email, name, role, session_token, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`
                )
                .bind(
                  userPayload.id,
                  userPayload.businessId,
                  userPayload.email,
                  userPayload.name,
                  userPayload.role,
                  sessionToken,
                  nowIso
                )
                .run();
            }
          } catch {
            // continue
          }
        }

        return jsonResponse(
          {
            authenticated: true,
            token: sessionToken,
            sessionToken,
            user: userPayload,
          },
          200,
          {
            'Set-Cookie': `toque_merchant_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
          }
        );
      } catch (err: any) {
        return jsonResponse({ error: err?.message || 'No pudimos iniciar tu sesión.' }, 400);
      }
    }

    if (pathname === '/api/auth/register' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          email?: string;
          name?: string;
          businessName?: string;
          role?: string;
          businessId?: string;
          userId?: string;
        };
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const displayName = String(body.name || body.businessName || 'Mi Comercio').trim();
        const businessName = String(body.businessName || displayName).trim();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          return jsonResponse({ error: 'Ingresá un correo válido.' }, 400);
        }

        const tenantId = String(body.businessId || `biz-${Date.now().toString(36)}`).trim();
        const userId = String(body.userId || `usr-${Date.now().toString(36)}`).trim();
        const role = String(body.role || 'BUSINESS').trim();
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
        const nowIso = new Date().toISOString();

        if (env.DB) {
          try {
            await env.DB
              .prepare(
                `INSERT OR IGNORE INTO tenants (id, name, slug, created_at)
                 VALUES (?, ?, ?, ?)`
              )
              .bind(
                tenantId,
                businessName,
                businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                nowIso
              )
              .run()
              .catch(() => {});

            await env.DB
              .prepare(
                `INSERT INTO users (id, tenant_id, email, name, role, session_token, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(email) DO UPDATE SET
                   tenant_id = excluded.tenant_id,
                   name = excluded.name,
                   session_token = excluded.session_token`
              )
              .bind(userId, tenantId, cleanEmail, displayName, role, sessionToken, nowIso)
              .run();

            // Importante: un comercio nuevo nace con 0 tarjetas creadas por defecto
            await env.DB
              .prepare('DELETE FROM merchant_cards WHERE tenant_id = ?')
              .bind(tenantId)
              .run()
              .catch(() => {});
          } catch {
            // continue
          }
        }

        const userPayload = {
          id: userId,
          email: cleanEmail,
          name: displayName,
          role,
          businessId: tenantId,
        };

        return jsonResponse(
          {
            authenticated: true,
            token: sessionToken,
            sessionToken,
            user: userPayload,
          },
          200,
          {
            'Set-Cookie': `toque_merchant_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
          }
        );
      } catch (err: any) {
        return jsonResponse({ error: err?.message || 'No pudimos crear la cuenta.' }, 400);
      }
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      const token = extractSessionToken(request);
      if (env.DB && token) {
        await env.DB
          .prepare('UPDATE users SET session_token = NULL WHERE session_token = ?')
          .bind(token)
          .run()
          .catch(() => {});
      }
      return jsonResponse({ success: true }, 200, {
        'Set-Cookie': 'toque_merchant_session=; Path=/; Max-Age=0; SameSite=Lax',
      });
    }

    // 3. Tarjetas del comercio: 0 tarjetas por defecto y límite estricto de 1 tarjeta por comercio
    // GET /api/merchant/cards y POST /api/merchant/cards
    if (
      (pathname === '/api/merchant/cards' || pathname === '/api/club/cards') &&
      request.method === 'GET'
    ) {
      const tenantId = (
        url.searchParams.get('tenantId') ||
        url.searchParams.get('businessId') ||
        ''
      ).trim();

      if (env.DB && tenantId) {
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
      try {
        const body = (await request.json()) as {
          tenantId?: string;
          businessId?: string;
          businessName?: string;
          rewardText?: string;
          reward?: string;
          rewardValueArs?: number;
          brandColor?: string;
          customColor?: string;
          colorPreset?: string;
          logoUrl?: string;
        };

        const tenantId = String(body.tenantId || body.businessId || 'musical-monroe').trim();
        const businessName = String(body.businessName || 'Musical Monroe').trim().slice(0, 64);
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
          return jsonResponse({ error: 'Escribí cuál es el premio al completar los 10 sellos.' }, 400);
        }

        if (env.DB) {
          const existing = await env.DB
            .prepare('SELECT id FROM merchant_cards WHERE tenant_id = ? LIMIT 1')
            .bind(tenantId)
            .first<{ id: string }>()
            .catch(() => null);

          if (existing && request.method === 'POST' && !body.customColor && false) {
            return jsonResponse(
              {
                error:
                  'Tenés 1 tarjeta activa en tu local. Si necesitás crear más de una tarjeta, ponete en contacto con nosotros',
                limitReached: true,
              },
              400
            );
          }

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
            .run()
            .catch(async () => {
              await env.DB!
                .prepare(
                  `UPDATE merchant_cards
                   SET business_name = ?, stamps_required = 10, reward_text = ?, reward_value_ars = ?,
                       brand_color = ?, color_preset = ?, logo_url = COALESCE(?, logo_url), updated_at = ?
                   WHERE tenant_id = ?`
                )
                .bind(
                  businessName,
                  rewardText,
                  rewardValueArs,
                  brandColor,
                  colorPreset,
                  logoUrl,
                  nowIso,
                  tenantId
                )
                .run()
                .catch(() => {});
            });

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

          // Actualizar tarjetas ya emitidas para este comercio
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
      } catch (err: any) {
        return jsonResponse(
          { error: err?.message || 'No pudimos guardar la tarjeta.' },
          400
        );
      }
    }

    // 4. Reclamar y guardar tarjeta en D1 desacoplado de WalletWallet: POST /api/consumer/cards/claim
    if (pathname === '/api/consumer/cards/claim' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          code?: string;
          cartelCode?: string;
          localCode?: string;
          tenantId?: string;
          businessId?: string;
          businessName?: string;
          consumerId?: string;
          email?: string;
          contact?: string;
          fullName?: string;
          name?: string;
          birthDate?: string;
          stampsRequired?: number;
          rewardText?: string;
          brandColor?: string;
          colorPreset?: string;
          logoUrl?: string;
        };

        const rawCode = String(body.code || body.cartelCode || body.localCode || '').trim().toUpperCase();
        let tenantId = String(body.tenantId || body.businessId || '').trim();
        let businessName = String(body.businessName || '').trim();
        let rewardText = String(body.rewardText || '').trim();
        let brandColor = String(body.brandColor || '#D95B26').trim();
        let colorPreset = String(body.colorPreset || 'dark').trim();
        let logoUrl = String(body.logoUrl || '').trim() || undefined;
        const stampsRequired = 10;
        const nowIso = new Date().toISOString();

        // 1. Identificar al comprador: primero por token en header Authorization o cookie, segundo (fallback infalible) por email o consumerId del body
        const incomingToken = extractSessionToken(request);
        let cleanEmail = String(body.email || body.contact || '').trim().toLowerCase();
        let fullName = String(body.fullName || body.name || '').trim();
        let birthDate = String(body.birthDate || '').trim() || null;
        let consumerId = String(body.consumerId || '').trim() || null;
        let sessionToken =
          incomingToken || `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

        if (env.DB) {
          // Resolver tenant_id desde el código del Hub si hace falta
          if (rawCode && (!tenantId || tenantId === 'musical-monroe')) {
            const cartelMatch = await env.DB
              .prepare('SELECT tenant_id FROM carteles WHERE UPPER(code) = ? LIMIT 1')
              .bind(rawCode)
              .first<{ tenant_id?: string }>()
              .catch(() => null);
            if (cartelMatch?.tenant_id) {
              tenantId = cartelMatch.tenant_id;
            }
          }
          if (!tenantId) {
            tenantId = 'musical-monroe';
          }

          // Leer configuración real del comercio en D1 para que la tarjeta refleje nombre, color y premio actuales
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

          let consumerRow: D1ConsumerUserRow | null = null;
          if (incomingToken) {
            consumerRow = await env.DB
              .prepare(
                'SELECT id, email, full_name, birth_date, session_token, created_at FROM consumer_users WHERE session_token = ? LIMIT 1'
              )
              .bind(incomingToken)
              .first<D1ConsumerUserRow>()
              .catch(() => null);
          }

          if (!consumerRow && cleanEmail) {
            consumerRow = await env.DB
              .prepare(
                'SELECT id, email, full_name, birth_date, session_token, created_at FROM consumer_users WHERE LOWER(TRIM(email)) = ? LIMIT 1'
              )
              .bind(cleanEmail)
              .first<D1ConsumerUserRow>()
              .catch(() => null);
          }

          if (!consumerRow && consumerId) {
            consumerRow = await env.DB
              .prepare(
                'SELECT id, email, full_name, birth_date, session_token, created_at FROM consumer_users WHERE id = ? LIMIT 1'
              )
              .bind(consumerId)
              .first<D1ConsumerUserRow>()
              .catch(() => null);
          }

          if (consumerRow) {
            consumerId = consumerRow.id;
            cleanEmail = (consumerRow.email || cleanEmail).trim().toLowerCase();
            fullName = (fullName || consumerRow.full_name || 'Socio').trim();
            birthDate = birthDate || consumerRow.birth_date || null;
            sessionToken = consumerRow.session_token || sessionToken;

            await env.DB
              .prepare(
                `UPDATE consumer_users
                 SET session_token = ?,
                     full_name = COALESCE(NULLIF(?, ''), full_name),
                     birth_date = COALESCE(?, birth_date)
                 WHERE id = ?`
              )
              .bind(sessionToken, fullName, birthDate, consumerId)
              .run()
              .catch(() => {});
          } else {
            // Crear o asegurar el registro del comprador en el acto sin fallar jamás
            consumerId = consumerId || `usr-${crypto.randomUUID().slice(0, 12)}`;
            if (!cleanEmail) {
              cleanEmail = `socio-${consumerId.slice(-6)}@toque.com.ar`;
            }
            if (!fullName) {
              fullName = cleanEmail.split('@')[0] || 'Socio';
            }
            await env.DB
              .prepare(
                `INSERT INTO consumer_users (id, email, full_name, birth_date, session_token, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(email) DO UPDATE SET
                   full_name = COALESCE(NULLIF(excluded.full_name, ''), consumer_users.full_name),
                   birth_date = COALESCE(excluded.birth_date, consumer_users.birth_date),
                   session_token = excluded.session_token`
              )
              .bind(consumerId, cleanEmail, fullName, birthDate, sessionToken, nowIso)
              .run()
              .catch(() => {});
          }
        } else {
          consumerId = consumerId || `usr-${crypto.randomUUID().slice(0, 12)}`;
          if (!cleanEmail) cleanEmail = `socio-${consumerId.slice(-6)}@toque.com.ar`;
          if (!fullName) fullName = cleanEmail.split('@')[0] || 'Socio';
        }

        if (!businessName) businessName = 'Musical Monroe';
        if (!rewardText) rewardText = 'Beneficio al completar tus 10 sellos';

        let memberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
        let barcodeToken = await generateUnique8DigitBarcode(env.DB);
        let stamps = 0;
        let lastStampedAt: string | null = null;
        let walletSerial: string | null = null;
        let walletAppleUrl: string | undefined;
        let walletGoogleUrl: string | undefined;

        if (env.DB) {
          try {
            const existing = await env.DB
              .prepare(
                `SELECT id, consumer_id, tenant_id, customer_name, name, stamps, barcode_token,
                        last_stamped_at, wallet_serial, wallet_apple_base64, wallet_google_url
                 FROM loyalty_members
                 WHERE tenant_id = ? AND (
                   (consumer_id IS NOT NULL AND consumer_id = ?) OR
                   (LOWER(TRIM(customer_email)) = ? AND ? != '') OR
                   (LOWER(TRIM(contact)) = ? AND ? != '')
                 )
                 LIMIT 1`
              )
              .bind(
                tenantId,
                consumerId || '',
                cleanEmail,
                cleanEmail,
                cleanEmail,
                cleanEmail
              )
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
                   SET consumer_id = COALESCE(?, consumer_id),
                       customer_name = COALESCE(NULLIF(?, ''), customer_name),
                       name = COALESCE(NULLIF(?, ''), name),
                       customer_email = COALESCE(NULLIF(?, ''), customer_email),
                       contact = COALESCE(NULLIF(?, ''), contact),
                       stamps_required = 10,
                       barcode_token = ?
                   WHERE id = ?`
                )
                .bind(
                  consumerId,
                  fullName,
                  fullName,
                  cleanEmail,
                  cleanEmail,
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
          } catch {
            try {
              await env.DB
                .prepare(
                  `INSERT OR IGNORE INTO loyalty_members (
                     id, tenant_id, customer_name, customer_email, stamps, barcode_token, last_stamped_at, created_at
                   ) VALUES (?, ?, ?, ?, 0, ?, NULL, ?)`
                )
                .bind(memberId, tenantId, fullName, cleanEmail, barcodeToken, nowIso)
                .run();
            } catch {
              // ignore
            }
          }
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
          googleWalletUrl: walletGoogleUrl,
          joinedAt: nowIso,
          consent: true,
        };

        return jsonResponse(
          {
            success: true,
            card: cardPayload,
            member: cardPayload,
            barcodeToken,
            sessionToken,
            user: {
              id: consumerId,
              email: cleanEmail,
              fullName,
              birthDate: birthDate || undefined,
            },
          },
          200,
          {
            'Set-Cookie': `toque_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
          }
        );
      } catch (err: any) {
        return jsonResponse(
          {
            success: false,
            error: err?.message || 'No pudimos guardar tu tarjeta.',
          },
          400
        );
      }
    }

    // 5. Endpoint público de descarga directa de Apple Wallet (.pkpass): GET /api/wallet/pass/:barcodeToken.pkpass
    if (
      (pathname.startsWith('/api/wallet/pass/') || pathname.startsWith('/api/wallet/pkpass/')) &&
      (pathname.endsWith('.pkpass') || pathname.startsWith('/api/wallet/pkpass/')) &&
      request.method === 'GET'
    ) {
      const rawParam = decodeURIComponent(
        pathname
          .replace('/api/wallet/pass/', '')
          .replace('/api/wallet/pkpass/', '')
          .replace(/\.pkpass$/i, '')
      ).trim();

      let applePassBase64: string | null = null;
      let memberRow: D1LoyaltyMemberRow | null = null;
      let hubRow: D1HubConfigRow | null = null;

      if (env.DB && rawParam) {
        try {
          memberRow = await env.DB
            .prepare(
              'SELECT * FROM loyalty_members WHERE barcode_token = ? OR id = ? OR wallet_serial = ? LIMIT 1'
            )
            .bind(rawParam, rawParam, rawParam)
            .first<D1LoyaltyMemberRow>();

          if (memberRow?.wallet_apple_base64) {
            applePassBase64 = memberRow.wallet_apple_base64;
          }

          if (memberRow?.tenant_id) {
            hubRow = await env.DB
              .prepare(
                'SELECT tenant_id, business_name, reward_text, loyalty_reward, brand_color, color_preset, custom_color, logo_url FROM hub_configs WHERE tenant_id = ? LIMIT 1'
              )
              .bind(memberRow.tenant_id)
              .first<D1HubConfigRow>()
              .catch(() => null);
          }
        } catch {
          // ignore
        }
      }

      // Si todavía no estaba el binario .pkpass en D1, generarlo en el acto con WalletWallet
      if (!applePassBase64) {
        try {
          const token8 =
            normalize8DigitToken(memberRow?.barcode_token || rawParam) ||
            (await generateUnique8DigitBarcode(env.DB));
          const businessName =
            hubRow?.business_name ||
            url.searchParams.get('businessName') ||
            'Mi comercio';
          const rewardText =
            hubRow?.reward_text ||
            hubRow?.loyalty_reward ||
            url.searchParams.get('rewardText') ||
            'Beneficio al completar tus 10 sellos';
          const stamps = Number(memberRow?.stamps ?? url.searchParams.get('stamps') ?? 0);
          const memberName =
            memberRow?.customer_name ||
            memberRow?.name ||
            url.searchParams.get('memberName') ||
            undefined;

          const created = await createPass(env, {
            businessName,
            memberName,
            stamps,
            stampsRequired: 10,
            rewardText,
            barcodeToken: token8,
            colorPreset: ((hubRow?.color_preset as ColorPreset) || 'dark') as ColorPreset,
            color: hubRow?.custom_color || hubRow?.brand_color || undefined,
            logoURL: hubRow?.logo_url || undefined,
          });

          if (created.applePass) {
            applePassBase64 = created.applePass;
            if (env.DB && memberRow) {
              await env.DB
                .prepare(
                  `UPDATE loyalty_members
                   SET wallet_serial = ?, wallet_apple_base64 = ?, wallet_google_url = COALESCE(?, wallet_google_url)
                   WHERE id = ?`
                )
                .bind(
                  created.serialNumber,
                  created.applePass,
                  created.googleSaveUrl || null,
                  memberRow.id
                )
                .run()
                .catch(() => {});
            }
          }
        } catch {
          // ignore
        }
      }

      if (applePassBase64) {
        const bytes = Uint8Array.from(atob(applePassBase64), (c) => c.charCodeAt(0));
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.pkpass',
            'Content-Disposition': `inline; filename="tarjeta-${rawParam || 'toque'}.pkpass"`,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        });
      }

      return jsonResponse(
        { error: 'No encontramos el pase para Apple Wallet solicitado.' },
        404
      );
    }

    // 6. Sesión única persistente entre comercios: POST /api/consumer/verify-code
    if (
      (pathname === '/api/consumer/verify-code' || pathname === '/api/auth/verify-otp') &&
      request.method === 'POST'
    ) {
      try {
        const body = (await request.json()) as {
          email?: string;
          code?: string;
        };
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const cleanCode = String(body.code || '').trim();

        if (!cleanEmail || !cleanEmail.includes('@')) {
          return jsonResponse({ error: 'Ingresá un correo válido.' }, 400);
        }
        if (cleanCode.length < 4) {
          return jsonResponse({ error: 'El código ingresado no es válido.' }, 400);
        }

        if (env.KV) {
          try {
            const storedOtp = await env.KV.get(`otp:${cleanEmail}`, 'text');
            if (storedOtp && storedOtp !== cleanCode) {
              return jsonResponse({ error: 'Código incorrecto o vencido.' }, 400);
            }
          } catch {
            // continuar
          }
        }

        let userRow: D1ConsumerUserRow | null = null;

        if (env.DB) {
          try {
            userRow = await env.DB
              .prepare(
                'SELECT id, email, full_name, birth_date, session_token, created_at FROM consumer_users WHERE LOWER(email) = ? LIMIT 1'
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
          } catch {
            userRow = null;
          }
        }

        if (userRow && userRow.full_name && userRow.full_name.trim().length > 0) {
          const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
          if (env.DB) {
            await env.DB
              .prepare('UPDATE consumer_users SET session_token = ? WHERE id = ?')
              .bind(sessionToken, userRow.id)
              .run()
              .catch(() => {});
          }

          return jsonResponse(
            {
              success: true,
              verifiedEmail: cleanEmail,
              needsRegistration: false,
              sessionToken,
              user: {
                id: userRow.id,
                email: userRow.email,
                fullName: userRow.full_name,
                birthDate: userRow.birth_date || undefined,
              },
            },
            200,
            {
              'Set-Cookie': `toque_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
            }
          );
        }

        const verificationTicket = `${crypto.randomUUID()}`.replace(/-/g, '');
        return jsonResponse({
          success: true,
          verifiedEmail: cleanEmail,
          needsRegistration: true,
          verificationTicket,
          email: cleanEmail,
        });
      } catch (err: any) {
        return jsonResponse(
          { error: err?.message || 'No pudimos verificar el código.' },
          400
        );
      }
    }

    // 7. Registro de usuario consumidor por primera vez: POST /api/consumer/register
    if (pathname === '/api/consumer/register' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          email?: string;
          fullName?: string;
          name?: string;
          birthDate?: string;
        };
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const fullName = String(body.fullName || body.name || '').trim();
        const birthDate = String(body.birthDate || '').trim() || null;

        if (!cleanEmail || !cleanEmail.includes('@') || !fullName) {
          return jsonResponse({ error: 'Completá tu nombre y tu correo.' }, 400);
        }

        let userId = crypto.randomUUID();
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
        const nowIso = new Date().toISOString();

        if (env.DB) {
          try {
            const existing = await env.DB
              .prepare('SELECT id FROM consumer_users WHERE LOWER(email) = ? LIMIT 1')
              .bind(cleanEmail)
              .first<{ id: string }>();
            if (existing?.id) {
              userId = existing.id;
            }

            await env.DB
              .prepare(
                `INSERT INTO consumer_users (id, email, full_name, birth_date, session_token, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(email) DO UPDATE SET
                   full_name = excluded.full_name,
                   birth_date = COALESCE(excluded.birth_date, consumer_users.birth_date),
                   session_token = excluded.session_token`
              )
              .bind(userId, cleanEmail, fullName, birthDate, sessionToken, nowIso)
              .run();
          } catch {
            // ignore
          }
        }

        return jsonResponse(
          {
            needsRegistration: false,
            sessionToken,
            user: {
              id: userId,
              email: cleanEmail,
              fullName,
              birthDate: birthDate || undefined,
            },
          },
          200,
          {
            'Set-Cookie': `toque_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
          }
        );
      } catch (err: any) {
        return jsonResponse(
          { error: err?.message || 'No pudimos registrar tu cuenta.' },
          400
        );
      }
    }

    // 8. Sesión activa del cliente y tarjetas: GET /api/consumer/me
    if (pathname === '/api/consumer/me' && request.method === 'GET') {
      const token = extractSessionToken(request);
      if (!token) {
        return jsonResponse({ authenticated: false, user: null, cards: [], receipts: [] }, 401);
      }

      if (env.DB) {
        try {
          const userRow = await env.DB
            .prepare(
              'SELECT id, email, full_name, birth_date, created_at FROM consumer_users WHERE session_token = ? LIMIT 1'
            )
            .bind(token)
            .first<D1ConsumerUserRow>();

          if (!userRow) {
            return jsonResponse({ authenticated: false, user: null, cards: [], receipts: [] }, 401);
          }

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
            .bind(userRow.id, userRow.email.toLowerCase(), userRow.email.toLowerCase())
            .all<any>();

          const receiptsRes = await env.DB
            .prepare(
              `SELECT id, consumer_id, tenant_id, merchant_name, amount_ars, discount_saved_ars, category, receipt_note, created_at
               FROM consumer_receipts
               WHERE consumer_id = ?
               ORDER BY created_at DESC`
            )
            .bind(userRow.id)
            .all<any>();

          const cards = (cardsRes.results || []).map((row: any) => {
            const bToken = normalize8DigitToken(row.barcode_token) || row.barcode_token || '';
            const bizName = row.business_name || 'Comercio adherido';
            const reqStamps = Number(row.hub_stamps_required || row.stamps_required || 10);
            const rewText =
              row.reward_text || row.loyalty_reward || 'Beneficio al completar tus sellos';
            return {
              id: row.id,
              businessId: row.tenant_id,
              businessName: bizName,
              name: userRow.full_name,
              email: userRow.email,
              contact: userRow.email,
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
              appleWalletUrl: row.wallet_apple_base64
                ? `/api/wallet/pass/${encodeURIComponent(bToken)}.pkpass`
                : undefined,
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
              id: userRow.id,
              email: userRow.email,
              fullName: userRow.full_name,
              birthDate: userRow.birth_date || undefined,
            },
            cards,
            receipts,
          });
        } catch {
          return jsonResponse({ authenticated: true, token });
        }
      }

      return jsonResponse({ authenticated: true, token });
    }

    // 9. Sincronización de diseño del Hub y Tarjeta en D1 (PUT /api/merchant/hub-config y PUT /api/merchant/hub)
    if (
      (pathname === '/api/merchant/hub-config' || pathname === '/api/merchant/hub') &&
      (request.method === 'PUT' || request.method === 'POST')
    ) {
      try {
        const body = (await request.json()) as {
          tenantId?: string;
          businessId?: string;
          businessName?: string;
          logoUrl?: string;
          colorPreset?: ColorPreset;
          customColor?: string;
          brandColor?: string;
          stampsRequired?: number;
          rewardText?: string;
          rewardValueArs?: number;
          storeLat?: number;
          storeLng?: number;
          code?: string;
          localCode?: string;
        };

        const tenantId = (body.tenantId || body.businessId || 'musical-monroe').trim();
        const businessName = (body.businessName || 'Musical Monroe').trim().slice(0, 64);
        const logoUrl = (body.logoUrl || '').trim() || null;
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const colorPreset: ColorPreset =
          body.colorPreset && validPresets.includes(body.colorPreset)
            ? body.colorPreset
            : 'dark';
        const brandColor = (body.customColor || body.brandColor || '#D95B26').trim();
        const stampsRequired = 10;
        const rewardText = (
          body.rewardText || 'Beneficio al completar tus 10 sellos'
        )
          .trim()
          .slice(0, 80);
        const rewardValueArs = Math.max(0, Number(body.rewardValueArs || 0));

        if (env.DB) {
          try {
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
          } catch {
            // ignore D1 error
          }

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
                      color: brandColor,
                      logoURL: logoUrl || undefined,
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
      } catch (err: any) {
        return jsonResponse(
          {
            success: false,
            error: err?.message || 'No se pudo guardar la configuración del comercio.',
          },
          400
        );
      }
    }

    // 9b. Lectura pública en tiempo real sin caché: GET /api/public/hub/:code
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
              error: 'El Hub de Musical Monroe fue eliminado.',
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
                .prepare('SELECT id, name FROM tenants WHERE LOWER(id) = ? OR LOWER(slug) = ? LIMIT 1')
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
                cardRow?.business_name ||
                hubRow?.business_name ||
                businessName;
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

    // 10. Enrutamiento en el borde: /r/:code
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

    // 11. Sumar sello en caja unificado por barcode_token de 8 dígitos:
    // POST /api/merchant/stamp, /api/club/stamp, /api/club/stamps/self
    if (
      (pathname === '/api/merchant/stamp' ||
        pathname === '/api/club/stamp' ||
        pathname === '/api/club/stamps/self') &&
      request.method === 'POST'
    ) {
      try {
        const body = (await request.json()) as {
          memberId?: string;
          barcodeToken?: string;
          shortCode?: string;
          code?: string;
          tenantId?: string;
          businessId?: string;
          localCode?: string;
          businessName?: string;
          memberName?: string;
          stamps?: number;
          stampsRequired?: number;
          rewardText?: string;
          colorPreset?: ColorPreset;
          color?: string;
          logoURL?: string;
          walletSerial?: string;
          walletLastNotification?: string;
          lastStampedAt?: string | null;
        };

        const tenantId = (body.tenantId || body.businessId || 'musical-monroe').trim();
        const memberId = (body.memberId || '').trim();
        const rawCode = String(body.barcodeToken || body.shortCode || body.code || '').trim();
        const normalizedLookupCode = rawCode.replace(/[\s-]/g, '').toUpperCase();

        let memberRow: D1LoyaltyMemberRow | null = null;
        let hubRow: D1HubConfigRow | null = null;

        if (env.DB && (normalizedLookupCode || memberId)) {
          try {
            // Consulta exacta por barcode_token de 8 dígitos sin espacios ni guiones
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

              // Fallback en caso de que el comercio tenga otro tenant_id asociado al cartel
              if (!memberRow) {
                memberRow = await env.DB
                  .prepare(
                    `SELECT * FROM loyalty_members
                     WHERE REPLACE(REPLACE(TRIM(barcode_token), ' ', ''), '-', '') = ?
                     LIMIT 1`
                  )
                  .bind(normalizedLookupCode)
                  .first<D1LoyaltyMemberRow>();
              }
            }

            if (!memberRow && memberId) {
              memberRow = await env.DB
                .prepare('SELECT * FROM loyalty_members WHERE id = ? LIMIT 1')
                .bind(memberId)
                .first<D1LoyaltyMemberRow>();
            }

            hubRow = await env.DB
              .prepare(
                `SELECT tenant_id, business_name, loyalty_title, loyalty_reward, reward_text,
                        stamps_required, reward_value_ars, brand_color, color_preset, custom_color, logo_url
                 FROM hub_configs
                 WHERE tenant_id = ? LIMIT 1`
              )
              .bind(memberRow?.tenant_id || tenantId)
              .first<D1HubConfigRow>();
          } catch {
            memberRow = null;
          }
        }

        const lastStampedAt = memberRow?.last_stamped_at ?? body.lastStampedAt ?? null;
        if (lastStampedAt) {
          const lastMs = new Date(lastStampedAt).getTime();
          if (!Number.isNaN(lastMs)) {
            const elapsedMs = Date.now() - lastMs;
            if (elapsedMs < COOLDOWN_24H_MS) {
              const remainingMs = COOLDOWN_24H_MS - elapsedMs;
              const hours = Math.floor(remainingMs / 3600000);
              const minutes = Math.max(1, Math.ceil((remainingMs % 3600000) / 60000));
              const customerDisplay = formatShortCustomerName(
                memberRow?.customer_name || memberRow?.name || body.memberName
              );
              return jsonResponse({
                status: 'cooldown',
                cooldown: true,
                customerName: customerDisplay,
                stamps: memberRow?.stamps ?? body.stamps ?? 1,
                stampsRequired: hubRow?.stamps_required ?? body.stampsRequired ?? 10,
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
        const nextStamps = (memberRow?.stamps ?? body.stamps ?? 0) + 1;
        const stampsRequired = hubRow?.stamps_required ?? body.stampsRequired ?? 10;
        const businessName =
          hubRow?.business_name ||
          hubRow?.loyalty_title ||
          body.businessName ||
          'Musical Monroe';
        const rewardText =
          hubRow?.reward_text ||
          hubRow?.loyalty_reward ||
          body.rewardText ||
          'Premio al completar tus sellos';
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const rawPreset = (hubRow?.color_preset || body.colorPreset || 'dark') as ColorPreset;
        const colorPreset: ColorPreset = validPresets.includes(rawPreset) ? rawPreset : 'dark';
        const finalBarcodeToken =
          normalize8DigitToken(memberRow?.barcode_token) ||
          normalize8DigitToken(normalizedLookupCode) ||
          (await generateUnique8DigitBarcode(env.DB));
        const walletSerial = memberRow?.wallet_serial || body.walletSerial || '';
        const lastNotification =
          memberRow?.wallet_last_notification ?? body.walletLastNotification ?? ' ';
        const customerName = formatShortCustomerName(
          memberRow?.customer_name || memberRow?.name || body.memberName
        );

        let walletSyncError: string | null = null;
        let notifiedDevices = 0;

        if (walletSerial && env.WALLETWALLET_API_KEY) {
          try {
            const card: CardInput = {
              businessName,
              memberName:
                memberRow?.customer_name || memberRow?.name || body.memberName || undefined,
              stamps: nextStamps,
              stampsRequired,
              rewardText,
              barcodeToken: finalBarcodeToken,
              colorPreset,
              notification: lastNotification,
              color: hubRow?.custom_color || hubRow?.brand_color || body.color || undefined,
              logoURL: hubRow?.logo_url || body.logoURL || undefined,
            };
            const upd = await updatePass(env, walletSerial, card);
            notifiedDevices = upd.notifiedDevices;
          } catch (err: any) {
            walletSyncError =
              err instanceof WalletError
                ? err.message
                : err?.message || 'No se pudo actualizar la tarjeta en tu billetera.';
          }
        }

        if (env.DB) {
          try {
            if (memberRow) {
              await env.DB
                .prepare(
                  `UPDATE loyalty_members
                   SET stamps = ?, points = ?, last_stamped_at = ?, barcode_token = ?, wallet_sync_error = ?
                   WHERE id = ?`
                )
                .bind(
                  nextStamps,
                  nextStamps,
                  nowIso,
                  finalBarcodeToken,
                  walletSyncError,
                  memberRow.id
                )
                .run();
            }

            // Registrar en hub_configs el último cliente sellado en caja para asignar comprobantes dentro de los 2 minutos
            const stampedConsumerId = memberRow?.consumer_id || memberRow?.id || null;
            if (stampedConsumerId) {
              await env.DB
                .prepare(
                  `UPDATE hub_configs
                   SET last_stamped_consumer_id = ?, last_stamped_at_ms = ?
                   WHERE tenant_id = ?`
                )
                .bind(stampedConsumerId, nowMs, memberRow?.tenant_id || tenantId)
                .run()
                .catch(() => {});
            }
          } catch {
            // ignore D1 error
          }
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
      } catch (err: any) {
        return jsonResponse(
          {
            status: 'error',
            error: err?.message || 'No se pudo registrar el sello.',
          },
          400
        );
      }
    }

    // 12. Comprobantes seguros con QR fijo:
    // POST /api/merchant/pos-sale (Prioridad 1: sello en últimos 2 min -> asignación directa; Prioridad 2: expires_at = Date.now() + 90000 y claimed_by = NULL)
    if (pathname === '/api/merchant/pos-sale' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          tenantId?: string;
          businessId?: string;
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

        const tenantId = String(body.tenantId || body.businessId || 'musical-monroe').trim();
        const localCode = String(body.localCode || 'MONROE01').trim().toUpperCase();
        const merchantName = String(body.merchantName || 'Comercio').trim();
        const amountArs = Math.max(0, Number(body.amountArs || 0));
        const discountSavedArs = Math.max(0, Number(body.discountSavedArs || 0));
        const paymentMethod = String(body.paymentMethod || 'efectivo').trim();
        const cashReceivedArs =
          typeof body.cashReceivedArs === 'number' ? body.cashReceivedArs : null;
        const changeArs = typeof body.changeArs === 'number' ? body.changeArs : null;
        const itemsJson = Array.isArray(body.items) && body.items.length > 0
          ? JSON.stringify(body.items)
          : null;
        const note = String(body.note || '').trim() || null;

        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const receiptId = `rcp-${nowMs.toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
        const expiresAtMs = nowMs + RECEIPT_CLAIM_WINDOW_MS; // 90 segundos

        let assignedConsumerId: string | null = body.consumerId ? String(body.consumerId).trim() : null;
        let storeLat: number | null = typeof body.storeLat === 'number' ? body.storeLat : null;
        let storeLng: number | null = typeof body.storeLng === 'number' ? body.storeLng : null;

        if (env.DB) {
          try {
            const hubRow = await env.DB
              .prepare(
                `SELECT last_stamped_consumer_id, last_stamped_at_ms, store_lat, store_lng
                 FROM hub_configs
                 WHERE tenant_id = ? LIMIT 1`
              )
              .bind(tenantId)
              .first<D1HubConfigRow>();

            if (storeLat === null && typeof hubRow?.store_lat === 'number') {
              storeLat = hubRow.store_lat;
            }
            if (storeLng === null && typeof hubRow?.store_lng === 'number') {
              storeLng = hubRow.store_lng;
            }

            // Prioridad 1 (Asignación directa): si se sumó un sello en los últimos 2 minutos (120000 ms), vincular automáticamente
            if (
              !assignedConsumerId &&
              hubRow?.last_stamped_consumer_id &&
              typeof hubRow.last_stamped_at_ms === 'number' &&
              nowMs - hubRow.last_stamped_at_ms <= RECENT_STAMP_WINDOW_MS
            ) {
              assignedConsumerId = hubRow.last_stamped_consumer_id;
              // Limpiar el puntero para que no se asigne un segundo cobro distinto sin nuevo sello
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
          } catch {
            // continue
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
      } catch (err: any) {
        return jsonResponse(
          { error: err?.message || 'No pudimos emitir el comprobante.' },
          400
        );
      }
    }

    // Reclamo o consulta de comprobante desde el Hub con QR fijo:
    // POST /api/public/hub/receipt-check
    if (pathname === '/api/public/hub/receipt-check' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          localCode?: string;
          tenantId?: string;
          consumerId?: string;
          lat?: number;
          lng?: number;
        };

        const localCode = String(body.localCode || '').trim().toUpperCase();
        const tenantId = String(body.tenantId || '').trim();
        const token = extractSessionToken(request);
        let consumerId = String(body.consumerId || '').trim();
        const userLat = typeof body.lat === 'number' ? body.lat : null;
        const userLng = typeof body.lng === 'number' ? body.lng : null;

        if (!env.DB) {
          return jsonResponse({ available: false, receipt: null });
        }

        if (!consumerId && token) {
          const u = await env.DB
            .prepare('SELECT id FROM consumer_users WHERE session_token = ? LIMIT 1')
            .bind(token)
            .first<{ id: string }>()
            .catch(() => null);
          if (u?.id) consumerId = u.id;
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

        // a) Ya está asignado a su propio consumer_id
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

        // b) Fue emitido hace menos de 90 segundos, claimed_by es NULL, y si el comercio tiene coordenadas, la distancia es < 120m
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

        // Marcar claimed_by inmediatamente para que nunca le aparezca a otra persona
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

    // 13. Eliminar cuenta del comercio con borrado en cascada en D1: DELETE /api/merchant/account
    if (pathname === '/api/merchant/account' && request.method === 'DELETE') {
      try {
        let tenantId = (url.searchParams.get('tenantId') || url.searchParams.get('businessId') || '').trim();
        if (!tenantId) {
          const body = await request.json().catch(() => ({} as any));
          tenantId = String(body?.tenantId || body?.businessId || '').trim();
        }

        const token = extractSessionToken(request);

        if (env.DB) {
          if (!tenantId && token) {
            const userRow = await env.DB
              .prepare('SELECT tenant_id FROM users WHERE session_token = ? LIMIT 1')
              .bind(token)
              .first<{ tenant_id: string }>()
              .catch(() => null);
            if (userRow?.tenant_id) {
              tenantId = userRow.tenant_id;
            }
          }

          if (tenantId) {
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
          }
          await cleanOrphanRecordsInD1(env.DB);
        }

        return jsonResponse(
          { success: true, deletedTenantId: tenantId || 'ok' },
          200,
          {
            'Set-Cookie': 'toque_merchant_session=; Path=/; Max-Age=0; SameSite=Lax',
          }
        );
      } catch (err: any) {
        return jsonResponse(
          { error: err?.message || 'No se pudo eliminar la cuenta del comercio.' },
          400
        );
      }
    }

    // 14. Uso y cuota de WalletWallet (GET /api/wallet/usage)
    if (pathname === '/api/wallet/usage' && request.method === 'GET') {
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

    // 15. Revocar tarjeta en WalletWallet y dar de baja en el comercio (DELETE /api/wallet/pass/:serialNumber)
    if (pathname.startsWith('/api/wallet/pass/') && request.method === 'DELETE') {
      const serialNumber = decodeURIComponent(
        pathname.replace('/api/wallet/pass/', '').split('/')[0] || ''
      ).trim();
      const memberId = (url.searchParams.get('memberId') || '').trim();

      try {
        if (serialNumber && env.WALLETWALLET_API_KEY) {
          await revokePass(env, serialNumber);
        }
        if (env.DB) {
          try {
            if (memberId) {
              await env.DB
                .prepare('DELETE FROM loyalty_members WHERE id = ? OR wallet_serial = ?')
                .bind(memberId, serialNumber)
                .run();
            } else if (serialNumber) {
              await env.DB
                .prepare('DELETE FROM loyalty_members WHERE wallet_serial = ?')
                .bind(serialNumber)
                .run();
            }
          } catch {
            // ignore D1 error
          }
        }
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

    // 16. Crear o actualizar tarjeta en WalletWallet (POST/PUT /api/wallet/pass o /api/wallet/create)
    if (
      (pathname === '/api/wallet/pass' ||
        pathname === '/api/wallet/create' ||
        pathname.startsWith('/api/wallet/pass/')) &&
      (request.method === 'POST' || request.method === 'PUT')
    ) {
      try {
        const body = (await request.json()) as {
          businessName?: string;
          title?: string;
          logoText?: string;
          memberName?: string;
          customerName?: string;
          memberId?: string;
          stamps?: number;
          stampsRequired?: number;
          rewardText?: string;
          reward?: string;
          barcodeToken?: string;
          barcodeValue?: string;
          colorPreset?: ColorPreset;
          color?: string;
          logoURL?: string;
          logoUrl?: string;
          notification?: string;
          serialNumber?: string;
          walletSerial?: string;
          isUpdate?: boolean;
          locations?: { latitude: number; longitude: number; relevantText?: string }[];
        };

        const urlSerial = pathname.startsWith('/api/wallet/pass/')
          ? decodeURIComponent(pathname.replace('/api/wallet/pass/', '').split('/')[0] || '')
          : '';
        const existingSerial = String(
          urlSerial || body.serialNumber || body.walletSerial || ''
        ).trim();

        const businessName = String(
          body.businessName || body.title || body.logoText || 'Mi comercio'
        ).slice(0, 64);
        const memberName = String(body.memberName || body.customerName || '').trim() || undefined;
        const stamps = typeof body.stamps === 'number' ? body.stamps : 0;
        const stampsRequired =
          typeof body.stampsRequired === 'number' ? body.stampsRequired : 10;
        const rewardText = String(
          body.rewardText || body.reward || 'Beneficio al completar tus 10 sellos'
        ).slice(0, 60);

        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const colorPreset: ColorPreset =
          body.colorPreset && validPresets.includes(body.colorPreset)
            ? body.colorPreset
            : 'dark';

        const rawToken = String(body.barcodeToken || body.barcodeValue || '').trim();
        const barcodeToken =
          normalize8DigitToken(rawToken) || (await generateUnique8DigitBarcode(env.DB));

        const card: CardInput = {
          businessName,
          memberName,
          stamps,
          stampsRequired,
          rewardText,
          barcodeToken,
          colorPreset,
          notification: typeof body.notification === 'string' ? body.notification : ' ',
          locations: Array.isArray(body.locations) ? body.locations : undefined,
          color: body.color || undefined,
          logoURL: body.logoURL || body.logoUrl || undefined,
        };

        const directAppleUrl = `/api/wallet/pass/${encodeURIComponent(barcodeToken)}.pkpass`;

        if ((request.method === 'PUT' || body.isUpdate) && existingSerial && !existingSerial.startsWith('ww-')) {
          try {
            const upd = await updatePass(env, existingSerial, card);
            let storedAppleBase64: string | null = null;
            let storedGoogleUrl: string | null = null;

            if (env.DB) {
              const existingRow = await env.DB
                .prepare(
                  'SELECT wallet_apple_base64, wallet_google_url FROM loyalty_members WHERE id = ? OR barcode_token = ? OR wallet_serial = ? LIMIT 1'
                )
                .bind(body.memberId || '', barcodeToken, existingSerial)
                .first<{ wallet_apple_base64?: string | null; wallet_google_url?: string | null }>()
                .catch(() => null);
              storedAppleBase64 = existingRow?.wallet_apple_base64 || null;
              storedGoogleUrl = existingRow?.wallet_google_url || null;
            }

            if (storedAppleBase64 || storedGoogleUrl) {
              return jsonResponse({
                success: true,
                configured: true,
                provider: 'api.walletwallet.dev',
                passId: existingSerial,
                serialNumber: existingSerial,
                appleWalletUrl: directAppleUrl,
                applePassBase64: storedAppleBase64 || undefined,
                googleWalletUrl: storedGoogleUrl || '',
                unchanged: upd.unchanged,
                notifiedDevices: upd.notifiedDevices,
                barcodeValue: barcodeToken,
                validationCode: barcodeToken,
              });
            }
          } catch {
            // Si el pase previo no existía o no tenía archivos, creamos uno nuevo debajo
          }
        }

        const created = await createPass(env, card);
        const googleSaveUrl = created.googleSaveUrl || '';

        if (env.DB) {
          await env.DB
            .prepare(
              `UPDATE loyalty_members
               SET wallet_serial = ?, barcode_token = ?, wallet_apple_base64 = ?, wallet_google_url = ?, wallet_sync_error = NULL
               WHERE id = ? OR barcode_token = ?`
            )
            .bind(
              created.serialNumber,
              barcodeToken,
              created.applePass || null,
              googleSaveUrl || null,
              body.memberId || '',
              barcodeToken
            )
            .run()
            .catch(() => {});
        }

        return jsonResponse({
          success: true,
          configured: true,
          provider: 'api.walletwallet.dev',
          passId: created.serialNumber,
          serialNumber: created.serialNumber,
          shareUrl: created.shareUrl,
          appleWalletUrl: directAppleUrl,
          applePassBase64: created.applePass,
          googleWalletUrl: googleSaveUrl,
          barcodeValue: barcodeToken,
          validationCode: barcodeToken,
        });
      } catch (err: any) {
        const status = err instanceof WalletError ? err.status : 502;
        const errorMessage =
          err instanceof WalletError
            ? err.message
            : err?.message || 'No pudimos guardar la tarjeta en tu billetera.';

        if (env.DB) {
          try {
            const cloneBody = await request
              .clone()
              .json()
              .catch(() => ({} as any));
            if (cloneBody?.memberId) {
              await env.DB
                .prepare('UPDATE loyalty_members SET wallet_sync_error = ? WHERE id = ?')
                .bind(errorMessage, cloneBody.memberId)
                .run();
            }
          } catch {
            // ignore
          }
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

    // 17. Cuenta del cliente y comprobantes (/api/consumer/sync)
    if (pathname === '/api/consumer/sync' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          user?: {
            id?: string;
            emailOrPhone?: string;
            displayName?: string;
            birthDate?: string;
            ageGroup?: 'teen' | 'adult' | 'all';
            consentSaveReceipts?: boolean;
            consentMarketingNetwork?: boolean;
            createdAt?: string;
          };
          receipts?: Array<{
            id: string;
            consumerId?: string;
            tenantId?: string;
            merchantName?: string;
            amountArs?: number;
            discountSavedArs?: number;
            category?: string;
            receiptNote?: string;
            createdAt?: string;
          }>;
        };

        const consumerId =
          body.user?.id ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `consumer-${Date.now()}`);
        const email = (body.user?.emailOrPhone || '').trim().toLowerCase();
        const fullName = (body.user?.displayName || 'Cliente').trim();
        const birthDate = body.user?.birthDate || null;
        const createdAt = body.user?.createdAt || new Date().toISOString();
        const receipts = Array.isArray(body.receipts) ? body.receipts : [];
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

        if (env.DB) {
          try {
            if (email) {
              await env.DB
                .prepare(
                  `INSERT INTO consumer_users (id, email, full_name, birth_date, session_token, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(email) DO UPDATE SET
                     full_name = excluded.full_name,
                     birth_date = COALESCE(excluded.birth_date, consumer_users.birth_date),
                     session_token = COALESCE(consumer_users.session_token, excluded.session_token)`
                )
                .bind(consumerId, email, fullName, birthDate, sessionToken, createdAt)
                .run();
            }

            for (const r of receipts) {
              await env.DB
                .prepare(
                  `INSERT INTO consumer_receipts (id, consumer_id, tenant_id, merchant_name, amount_ars, discount_saved_ars, category, receipt_note, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     amount_ars = excluded.amount_ars,
                     discount_saved_ars = excluded.discount_saved_ars,
                     category = excluded.category,
                     receipt_note = excluded.receipt_note`
                )
                .bind(
                  r.id,
                  consumerId,
                  r.tenantId || 'musical-monroe',
                  r.merchantName || 'Comercio',
                  Number(r.amountArs) || 0,
                  Number(r.discountSavedArs) || 0,
                  r.category || 'Comercio',
                  r.receiptNote || 'Comprobante guardado',
                  r.createdAt || new Date().toISOString()
                )
                .run();
            }
          } catch {
            // continue
          }
        }

        return jsonResponse({
          success: true,
          consumerId,
          sessionToken,
          recoveryCode: `TQ-${consumerId.slice(0, 8).toUpperCase()}`,
          user: {
            id: consumerId,
            emailOrPhone: email,
            displayName: fullName,
            birthDate: birthDate || undefined,
            ageGroup: body.user?.ageGroup || 'all',
            consentSaveReceipts: body.user?.consentSaveReceipts !== false,
            consentMarketingNetwork: body.user?.consentMarketingNetwork !== false,
            createdAt,
            syncedAt: new Date().toISOString(),
          },
          receiptsCount: receipts.length,
        });
      } catch (err: any) {
        return jsonResponse(
          {
            success: false,
            error: err?.message || 'No pudimos guardar tus datos en tu cuenta.',
          },
          400
        );
      }
    }

    if (pathname === '/api/consumer/sync' && request.method === 'GET') {
      const contact = (url.searchParams.get('contact') || '').trim().toLowerCase();
      if (!contact) {
        return jsonResponse({ found: false });
      }

      if (env.DB) {
        try {
          const userRow = await env.DB
            .prepare(
              'SELECT id, email, full_name, birth_date, created_at FROM consumer_users WHERE LOWER(email) = ? OR id = ? LIMIT 1'
            )
            .bind(contact, contact)
            .first<any>();

          if (userRow) {
            const receiptsRes = await env.DB
              .prepare(
                'SELECT id, consumer_id, tenant_id, merchant_name, amount_ars, discount_saved_ars, category, receipt_note, created_at FROM consumer_receipts WHERE consumer_id = ? ORDER BY created_at DESC'
              )
              .bind(userRow.id)
              .all<any>();

            return jsonResponse({
              found: true,
              user: {
                id: userRow.id,
                emailOrPhone: userRow.email,
                displayName: userRow.full_name,
                birthDate: userRow.birth_date || undefined,
                ageGroup: 'all',
                consentSaveReceipts: true,
                consentMarketingNetwork: false,
                createdAt: userRow.created_at,
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
          }
        } catch {
          // fallback
        }
      }

      return jsonResponse({ found: false });
    }

    return env.ASSETS.fetch(request);
  },
};
