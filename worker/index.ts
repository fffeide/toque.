/**
 * Worker Entrypoint para Toque
 * Implementa:
 * 1. Enrutamiento en el borde (/r/:code)
 * 2. Cliente oficial de WalletWallet (createPass, updatePass, revokePass, getUsage) con CODE128 de 8 dígitos
 * 3. Guardado directo en Apple Wallet (GET /api/wallet/pass/:barcodeToken.pkpass) y Google Wallet (wallet_google_url)
 * 4. Sesión única persistente entre comercios (POST /api/consumer/verify-code, GET /api/consumer/me, POST /api/consumer/register)
 * 5. Sincronización en tiempo real de nombre, logo y diseño en D1 y WalletWallet (PUT /api/merchant/hub-config)
 * 6. Regla estricta de 24 horas (86400000 ms) para sumar sellos (POST /api/merchant/stamp y /api/club/stamp)
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
  const match = cookieHeader.match(/(?:^|;\s*)toque_session=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : '';
}

async function generateUnique8DigitBarcode(db?: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
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

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

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

    // 2. Endpoint público de descarga directa de Apple Wallet (.pkpass): GET /api/wallet/pass/:barcodeToken.pkpass
    if (
      pathname.startsWith('/api/wallet/pass/') &&
      pathname.endsWith('.pkpass') &&
      request.method === 'GET'
    ) {
      const rawParam = decodeURIComponent(
        pathname.replace('/api/wallet/pass/', '').replace(/\.pkpass$/i, '')
      ).trim();

      if (env.DB && rawParam) {
        try {
          const row = await env.DB
            .prepare(
              'SELECT wallet_apple_base64, wallet_serial FROM loyalty_members WHERE barcode_token = ? OR id = ? OR wallet_serial = ? LIMIT 1'
            )
            .bind(rawParam, rawParam, rawParam)
            .first<{ wallet_apple_base64?: string | null; wallet_serial?: string | null }>();

          if (row?.wallet_apple_base64) {
            const bytes = Uint8Array.from(atob(row.wallet_apple_base64), (c) => c.charCodeAt(0));
            return new Response(bytes, {
              status: 200,
              headers: {
                'Content-Type': 'application/vnd.apple.pkpass',
                'Content-Disposition': 'inline; filename="tarjeta.pkpass"',
              },
            });
          }
        } catch {
          // ignore
        }
      }

      return jsonResponse(
        { error: 'No encontramos el pase para Apple Wallet solicitado.' },
        404
      );
    }

    // 3. Sesión única persistente entre comercios: POST /api/consumer/verify-code
    if (pathname === '/api/consumer/verify-code' && request.method === 'POST') {
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

        // Validar código en KV si fue guardado allí
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

            // Si no está en consumer_users, verificar si existe alguna fila con ese correo en loyalty_members de cualquier comercio
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

        // Regla crítica: Si el usuario ya tiene full_name registrado en consumer_users, devolver sesión activa sin pedir registro
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

    // 4. Registro de usuario consumidor por primera vez: POST /api/consumer/register
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

        const userId = crypto.randomUUID();
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
        const nowIso = new Date().toISOString();

        if (env.DB) {
          try {
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

    // 5. Sesión activa del cliente y tarjetas: GET /api/consumer/me
    if (pathname === '/api/consumer/me' && request.method === 'GET') {
      const token = extractSessionToken(request);
      if (!token) {
        return jsonResponse({ authenticated: false, user: null, cards: [], receipts: [] });
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
            return jsonResponse({ authenticated: false, user: null, cards: [], receipts: [] });
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
          // fallback
        }
      }

      return jsonResponse({ authenticated: false, user: null, cards: [], receipts: [] });
    }

    // 6. Guardar configuración del comercio y sincronizar pases activos en segundo plano: PUT /api/merchant/hub-config
    if (pathname === '/api/merchant/hub-config' && request.method === 'PUT') {
      try {
        const body = (await request.json()) as {
          tenantId?: string;
          businessId?: string;
          businessName?: string;
          logoUrl?: string;
          brandColor?: string;
          customColor?: string;
          colorPreset?: ColorPreset;
          stampsRequired?: number;
          rewardText?: string;
          rewardValueArs?: number;
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
        const stampsRequired = Math.max(1, Number(body.stampsRequired || 10));
        const rewardText = (
          body.rewardText || 'Beneficio al completar tus sellos'
        )
          .trim()
          .slice(0, 60);
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
                   logo_url = excluded.logo_url,
                   brand_color = excluded.brand_color,
                   color_preset = excluded.color_preset,
                   custom_color = excluded.custom_color,
                   stamps_required = excluded.stamps_required,
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
              .prepare('UPDATE tenants SET name = ? WHERE id = ?')
              .bind(businessName, tenantId)
              .run()
              .catch(() => {});
          } catch {
            // ignore D1 error
          }

          // Actualizar en segundo plano todas las tarjetas activas en Apple Wallet y Google Wallet
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

    // 7. Enrutamiento en el borde: /r/:code
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
          review_url: 'https://maps.google.com',
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

    // 8. Regla estricta de 24 horas para sumar sellos (POST /api/merchant/stamp, /api/club/stamp, /api/club/stamps/self)
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

        const tenantId = body.tenantId || body.businessId || 'musical-monroe';
        const memberId = (body.memberId || '').trim();
        const incomingBarcode = (body.barcodeToken || '').trim();

        let memberRow: D1LoyaltyMemberRow | null = null;
        let hubRow: D1HubConfigRow | null = null;

        if (env.DB && (memberId || incomingBarcode)) {
          try {
            memberRow = await env.DB
              .prepare(
                `SELECT id, consumer_id, tenant_id, customer_name, name, points, stamps, barcode_token,
                        last_stamped_at, wallet_serial, wallet_apple_base64, wallet_google_url,
                        wallet_last_notification, last_notified_at, wallet_sync_error
                 FROM loyalty_members
                 WHERE id = ? OR barcode_token = ? OR member_code = ?
                 LIMIT 1`
              )
              .bind(memberId || incomingBarcode, incomingBarcode || memberId, incomingBarcode || memberId)
              .first<D1LoyaltyMemberRow>();

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
              return jsonResponse({
                status: 'cooldown',
                cooldown: true,
                remainingMs,
                remainingHours: hours,
                remainingMinutes: minutes,
                message: `Próximo sello disponible en ${hours} h ${minutes} min`,
              });
            }
          }
        }

        const nowIso = new Date().toISOString();
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
          normalize8DigitToken(incomingBarcode) ||
          (await generateUnique8DigitBarcode(env.DB));
        const walletSerial = memberRow?.wallet_serial || body.walletSerial || '';
        const lastNotification =
          memberRow?.wallet_last_notification ?? body.walletLastNotification ?? ' ';

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

        if (env.DB && memberRow) {
          try {
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
          } catch {
            // ignore D1 error
          }
        }

        return jsonResponse({
          status: 'stamped',
          cooldown: false,
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

    // 9. Uso y cuota de WalletWallet (GET /api/wallet/usage)
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

    // 10. Revocar tarjeta en WalletWallet y dar de baja en el comercio (DELETE /api/wallet/pass/:serialNumber)
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

    // 11. Crear o actualizar tarjeta en WalletWallet (POST/PUT /api/wallet/pass o /api/wallet/create)
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
          body.businessName || body.title || body.logoText || 'Musical Monroe'
        ).slice(0, 64);
        const memberName = String(body.memberName || body.customerName || '').trim() || undefined;
        const stamps = typeof body.stamps === 'number' ? body.stamps : 1;
        const stampsRequired =
          typeof body.stampsRequired === 'number' ? body.stampsRequired : 10;
        const rewardText = String(
          body.rewardText || body.reward || 'Beneficio al completar tus sellos'
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

        if ((request.method === 'PUT' || body.isUpdate) && existingSerial) {
          const upd = await updatePass(env, existingSerial, card);
          const directAppleUrl = `/api/wallet/pass/${encodeURIComponent(barcodeToken)}.pkpass`;

          if (env.DB && body.memberId) {
            ctx?.waitUntil(
              env.DB
                .prepare(
                  'UPDATE loyalty_members SET wallet_serial = ?, barcode_token = ?, wallet_sync_error = NULL WHERE id = ?'
                )
                .bind(existingSerial, barcodeToken, body.memberId)
                .run()
                .catch(() => {})
            );
          }

          return jsonResponse({
            success: true,
            provider: 'api.walletwallet.dev',
            passId: existingSerial,
            serialNumber: existingSerial,
            appleWalletUrl: directAppleUrl,
            unchanged: upd.unchanged,
            notifiedDevices: upd.notifiedDevices,
            barcodeValue: barcodeToken,
            validationCode: barcodeToken,
          });
        }

        const created = await createPass(env, card);
        const directAppleUrl = `/api/wallet/pass/${encodeURIComponent(barcodeToken)}.pkpass`;
        const googleSaveUrl = created.googleSaveUrl || '';

        if (env.DB && body.memberId) {
          ctx?.waitUntil(
            env.DB
              .prepare(
                `UPDATE loyalty_members
                 SET wallet_serial = ?, barcode_token = ?, wallet_apple_base64 = ?, wallet_google_url = ?, wallet_sync_error = NULL
                 WHERE id = ?`
              )
              .bind(
                created.serialNumber,
                barcodeToken,
                created.applePass || null,
                googleSaveUrl || null,
                body.memberId
              )
              .run()
              .catch(() => {})
          );
        }

        return jsonResponse({
          success: true,
          provider: 'api.walletwallet.dev',
          passId: created.serialNumber,
          serialNumber: created.serialNumber,
          appleWalletUrl: directAppleUrl,
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

    // 12. Cuenta del cliente y comprobantes (/api/consumer/sync)
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

        if (env.DB) {
          try {
            if (email) {
              await env.DB
                .prepare(
                  `INSERT INTO consumer_users (id, email, full_name, birth_date, created_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(email) DO UPDATE SET
                     full_name = excluded.full_name,
                     birth_date = COALESCE(excluded.birth_date, consumer_users.birth_date)`
                )
                .bind(consumerId, email, fullName, birthDate, createdAt)
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
