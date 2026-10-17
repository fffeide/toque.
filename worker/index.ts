/**
 * Cloudflare Worker Entrypoint para Toque (Hono / Edge Handler + D1 + KV)
 * Implementa:
 * 1. Enrutamiento ultrarrápido en el borde (/r/:code) con lectura desde KV/D1:
 *    - claim_status === 'unclaimed' -> 302 a /activar/:code
 *    - mode === 'direct_review' -> 302 directo a Google Reviews (~8ms)
 *    - mode === 'smart_hub' -> 302 a /hub/:code y registro asíncrono del toque
 * 2. Generación de pases Apple Wallet (.pkpass) y Google Wallet (POST /api/wallet/pass y /api/wallet/create)
 * 3. Salud y APIs de soporte
 */

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

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // 1. Healthcheck en el borde
    if (pathname === '/healthz' || pathname === '/api/healthz') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          runtime: 'cloudflare-worker-edge',
          timestamp: new Date().toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Enrutamiento en el borde: /r/:code
    if (pathname.startsWith('/r/')) {
      const rawCode = pathname.replace('/r/', '').split('/')[0]?.trim().toUpperCase();
      if (!rawCode) {
        return Response.redirect(`${url.origin}/`, 302);
      }

      let record: EdgeCartelRecord | null = null;

      // Intentar leer de Cloudflare KV primero (~5-8ms)
      if (env.KV) {
        try {
          record = await env.KV.get(`cartel:${rawCode}`, 'json');
        } catch {
          record = null;
        }
      }

      // Fallback a Cloudflare D1 si no está en caché KV
      if (!record && env.DB) {
        try {
          record = await env.DB
            .prepare('SELECT code, claim_status, mode, tile_color, review_url, tenant_id FROM carteles WHERE UPPER(code) = ? LIMIT 1')
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

      // Defaults para códigos de demostración cuando se corre sin KV/D1 bindeado
      if (!record) {
        if (rawCode === 'DEMO01' || rawCode === 'VIRGEN01') {
          record = {
            code: rawCode,
            claim_status: 'unclaimed',
            mode: 'smart_hub',
            tile_color: 'white',
          };
        } else if (rawCode === 'DIRECT01') {
          record = {
            code: rawCode,
            claim_status: 'claimed',
            mode: 'direct_review',
            review_url: 'https://maps.google.com',
          };
        } else {
          record = {
            code: rawCode,
            claim_status: 'claimed',
            mode: 'smart_hub',
            tile_color: 'white',
            review_url: 'https://maps.google.com',
          };
        }
      }

      // Regla 2.A: Si el cartel está virgen (unclaimed), redirigir a /activar/:code
      if (record.claim_status === 'unclaimed') {
        return Response.redirect(`${url.origin}/activar/${rawCode}`, 302);
      }

      // Registrar el toque en segundo plano sin bloquear el redirect
      if (env.DB && ctx) {
        ctx.waitUntil(
          env.DB
            .prepare("UPDATE carteles SET last_scanned_at = datetime('now') WHERE UPPER(code) = ?")
            .bind(rawCode)
            .run()
            .catch(() => {})
        );
      }

      // Regla 2.B: Si el modo es 'direct_review', redirect 302 ultrarrápido directo a Google Maps
      if (record.mode === 'direct_review' && record.review_url) {
        return Response.redirect(record.review_url, 302);
      }

      // Regla 2.C: Si el modo es 'smart_hub', redirigir a /hub/:code
      return Response.redirect(`${url.origin}/hub/${rawCode}`, 302);
    }

    // 3. Endpoint de Apple Wallet & Google Wallet (POST /api/wallet/pass o /api/wallet/create)
    if (
      (pathname === '/api/wallet/pass' || pathname === '/api/wallet/create') &&
      request.method === 'POST'
    ) {
      try {
        const body = (await request.json()) as {
          businessName?: string;
          brandColor?: string;
          customerName?: string;
          stamps?: number;
          stampsRequired?: number;
          rewardText?: string;
          code?: string;
          qrUrl?: string;
        };

        const businessName = body.businessName || 'Café & Panadería La Esquina';
        const brandColor = body.brandColor || '#3A3FE0';
        const stamps = typeof body.stamps === 'number' ? body.stamps : 4;
        const stampsRequired = typeof body.stampsRequired === 'number' ? body.stampsRequired : 5;
        const rewardText = body.rewardText || '10% OFF en tu próxima compra';
        const code = (body.code || 'CAJA01').toUpperCase();
        const qrUrl = body.qrUrl || `${url.origin}/r/${code}`;

        // Si hay API Key de walletwallet.dev configurada en el entorno, llamar al servicio real
        if (env.WALLETWALLET_API_KEY) {
          const walletRes = await fetch('https://walletwallet.dev/api/v1/pass', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.WALLETWALLET_API_KEY}`,
            },
            body: JSON.stringify({
              merchantName: businessName,
              backgroundColor: brandColor,
              labelColor: '#FFFFFF',
              foregroundColor: '#FFFFFF',
              headerField: {
                key: 'stamps',
                label: 'SELLOS',
                value: `${stamps}/${stampsRequired}`,
              },
              primaryField: {
                key: 'member',
                label: 'BENEFICIO ACTIVO',
                value: rewardText,
              },
              secondaryField: {
                key: 'customer',
                label: 'SOCIO',
                value: body.customerName || 'Cliente Toque',
              },
              barcode: {
                format: 'PKBarcodeFormatQR',
                message: qrUrl,
                messageEncoding: 'iso-8859-1',
                altText: `TOQUE-${code}`,
              },
            }),
          });

          if (walletRes.ok) {
            const passData: any = await walletRes.json();
            return new Response(
              JSON.stringify({
                success: true,
                provider: 'walletwallet.dev',
                appleWalletUrl: passData.applePassUrl || passData.pkpassUrl,
                googleWalletUrl: passData.googlePassUrl || passData.saveUrl,
                validationCode: `TQ-${code}-${stamps}S`,
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        // Fallback limpio a pase web instalable (PWA Pass / pkpass simulado)
        const passId = `pass-${code.toLowerCase()}-${Date.now().toString(36)}`;
        const queryParams = new URLSearchParams({
          biz: businessName,
          stamps: `${stamps}/${stampsRequired}`,
          reward: rewardText,
          code,
          color: brandColor,
        }).toString();

        return new Response(
          JSON.stringify({
            success: true,
            provider: 'toque-pwa-wallet',
            passId,
            validationCode: `TQ-${code}-${stamps}${stampsRequired}`,
            appleWalletUrl: `${url.origin}/hub/${code}?wallet=apple&${queryParams}`,
            googleWalletUrl: `${url.origin}/hub/${code}?wallet=google&${queryParams}`,
            qrUrl,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'WALLET_PASS_ERROR',
              message: err?.message || 'No pudimos generar el pase para tu billetera.',
            },
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Delegar recursos estáticos y rutas SPA al binding ASSETS
    return env.ASSETS.fetch(request);
  },
};
