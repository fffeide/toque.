/**
 * Cloudflare Worker Entrypoint para Toque (Edge Handler + D1 + KV + WalletWallet)
 * Implementa:
 * 1. Enrutamiento ultrarrápido en el borde (/r/:code) con lectura desde KV/D1
 * 2. Cliente oficial de WalletWallet (createPass, updatePass, revokePass, getUsage, birthdayMessage)
 * 3. Regla estricta de 24 horas (86400000 ms) para sumar sellos en D1 con sincronización real a WalletWallet
 * 4. Cuenta del cliente y comprobantes en D1 (/api/consumer/sync)
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

interface D1LoyaltyMemberRow {
  id: string;
  tenant_id: string;
  contact: string;
  name?: string | null;
  points: number;
  stamps: number;
  barcode_token: string;
  last_stamped_at?: string | null;
  wallet_serial?: string | null;
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
  color_preset?: string | null;
  custom_color?: string | null;
  logo_url?: string | null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
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

    // 2. Enrutamiento en el borde: /r/:code
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

    // 3. Regla estricta de 24 horas para sumar sellos (POST /api/club/stamp o /api/club/stamps/self)
    if (
      (pathname === '/api/club/stamp' || pathname === '/api/club/stamps/self') &&
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

        const tenantId = body.tenantId || body.businessId || 'la-burger';
        const memberId = (body.memberId || '').trim();
        const barcodeToken = (body.barcodeToken || '').trim() || generateBarcodeToken();

        let memberRow: D1LoyaltyMemberRow | null = null;
        let hubRow: D1HubConfigRow | null = null;

        if (env.DB && memberId) {
          try {
            memberRow = await env.DB
              .prepare(
                'SELECT id, tenant_id, contact, name, points, stamps, barcode_token, last_stamped_at, wallet_serial, wallet_last_notification, last_notified_at, wallet_sync_error FROM loyalty_members WHERE id = ? OR barcode_token = ? LIMIT 1'
              )
              .bind(memberId, barcodeToken)
              .first<D1LoyaltyMemberRow>();

            hubRow = await env.DB
              .prepare(
                'SELECT tenant_id, business_name, loyalty_title, loyalty_reward, reward_text, stamps_required, reward_value_ars, color_preset, custom_color, logo_url FROM hub_configs WHERE tenant_id = ? LIMIT 1'
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
        const stampsRequired =
          hubRow?.stamps_required ?? body.stampsRequired ?? 10;
        const businessName =
          hubRow?.business_name ||
          hubRow?.loyalty_title ||
          body.businessName ||
          'La Burger';
        const rewardText =
          hubRow?.reward_text ||
          hubRow?.loyalty_reward ||
          body.rewardText ||
          'Premio al completar tus sellos';
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const rawPreset = (hubRow?.color_preset || body.colorPreset || 'dark') as ColorPreset;
        const colorPreset: ColorPreset = validPresets.includes(rawPreset) ? rawPreset : 'dark';
        const finalBarcodeToken =
          memberRow?.barcode_token && memberRow.barcode_token.length >= 16
            ? memberRow.barcode_token
            : barcodeToken.length >= 16
            ? barcodeToken
            : generateBarcodeToken();
        const walletSerial = memberRow?.wallet_serial || body.walletSerial || '';
        const lastNotification =
          memberRow?.wallet_last_notification ?? body.walletLastNotification ?? ' ';

        let walletSyncError: string | null = null;
        let notifiedDevices = 0;

        if (walletSerial && env.WALLETWALLET_API_KEY) {
          try {
            const card: CardInput = {
              businessName,
              memberName: memberRow?.name || body.memberName || undefined,
              stamps: nextStamps,
              stampsRequired,
              rewardText,
              barcodeToken: finalBarcodeToken,
              colorPreset,
              notification: lastNotification,
              color: hubRow?.custom_color || body.color || undefined,
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
            // ignore D1 error if schema not applied
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

    // 4. Uso y cuota de WalletWallet (GET /api/wallet/usage)
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

    // 5. Revocar tarjeta en WalletWallet y dar de baja en el comercio (DELETE /api/wallet/pass/:serialNumber)
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

    // 6. Crear o actualizar tarjeta en WalletWallet (POST/PUT /api/wallet/pass o /api/wallet/create)
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
          body.businessName || body.title || body.logoText || 'La Burger'
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
        const barcodeToken = rawToken.length >= 16 ? rawToken : generateBarcodeToken();

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
          const shareUrl = `https://walletwallet.dev/p/${encodeURIComponent(existingSerial)}`;

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
            shareUrl,
            appleWalletUrl: shareUrl,
            googleWalletUrl: shareUrl,
            unchanged: upd.unchanged,
            notifiedDevices: upd.notifiedDevices,
            barcodeValue: barcodeToken,
            validationCode: barcodeToken,
          });
        }

        const created = await createPass(env, card);
        const shareUrl = created.shareUrl;
        const googleSaveUrl = created.googleSaveUrl || shareUrl;

        if (env.DB && body.memberId) {
          ctx?.waitUntil(
            env.DB
              .prepare(
                'UPDATE loyalty_members SET wallet_serial = ?, barcode_token = ?, wallet_sync_error = NULL WHERE id = ?'
              )
              .bind(created.serialNumber, barcodeToken, body.memberId)
              .run()
              .catch(() => {})
          );
        }

        return jsonResponse({
          success: true,
          provider: 'api.walletwallet.dev',
          passId: created.serialNumber,
          serialNumber: created.serialNumber,
          shareUrl,
          appleWalletUrl: shareUrl,
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

    // 7. Cuenta del cliente y comprobantes (/api/consumer/sync)
    if (pathname === '/api/consumer/sync' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          user?: {
            id?: string;
            emailOrPhone?: string;
            displayName?: string;
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
        const emailOrPhone = (body.user?.emailOrPhone || '').trim().toLowerCase();
        const displayName = (body.user?.displayName || 'Cliente').trim();
        const ageGroup =
          body.user?.ageGroup && ['teen', 'adult', 'all'].includes(body.user.ageGroup)
            ? body.user.ageGroup
            : 'all';
        const consentReceipts = body.user?.consentSaveReceipts !== false ? 1 : 0;
        const consentMarketing = body.user?.consentMarketingNetwork !== false ? 1 : 0;
        const createdAt = body.user?.createdAt || new Date().toISOString();
        const receipts = Array.isArray(body.receipts) ? body.receipts : [];

        if (env.DB) {
          try {
            await env.DB
              .prepare(
                `INSERT INTO consumer_users (id, email_or_phone, display_name, age_group, consent_save_receipts, consent_marketing_network, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   email_or_phone = excluded.email_or_phone,
                   display_name = excluded.display_name,
                   age_group = excluded.age_group,
                   consent_save_receipts = excluded.consent_save_receipts,
                   consent_marketing_network = excluded.consent_marketing_network`
              )
              .bind(
                consumerId,
                emailOrPhone,
                displayName,
                ageGroup,
                consentReceipts,
                consentMarketing,
                createdAt
              )
              .run();

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
                  r.tenantId || 'la-burger',
                  r.merchantName || 'Comercio',
                  Number(r.amountArs) || 0,
                  Number(r.discountSavedArs) || 0,
                  r.category || 'Gastronomía',
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
            emailOrPhone,
            displayName,
            ageGroup,
            consentSaveReceipts: Boolean(consentReceipts),
            consentMarketingNetwork: Boolean(consentMarketing),
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
              'SELECT id, email_or_phone, display_name, age_group, consent_save_receipts, consent_marketing_network, created_at FROM consumer_users WHERE LOWER(email_or_phone) = ? OR id = ? LIMIT 1'
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
                emailOrPhone: userRow.email_or_phone,
                displayName: userRow.display_name,
                ageGroup: userRow.age_group || 'all',
                consentSaveReceipts: Boolean(userRow.consent_save_receipts),
                consentMarketingNetwork: Boolean(userRow.consent_marketing_network),
                createdAt: userRow.created_at,
              },
              receipts: (receiptsRes.results || []).map((r: any) => ({
                id: r.id,
                consumerId: r.consumer_id,
                tenantId: r.tenant_id,
                merchantName: r.merchant_name,
                amountArs: Number(r.amount_ars) || 0,
                discountSavedArs: Number(r.discount_saved_ars) || 0,
                category: r.category || 'Gastronomía',
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
