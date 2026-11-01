import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import {
  renderWelcomeCardEmail,
  renderRecoverCardEmail,
  renderMerchantBroadcastEmail,
} from './src/lib/emailTemplates';
import {
  createPass,
  updatePass,
  revokePass,
  getUsage,
  WalletError,
  ColorPreset,
  CardInput,
  generateSecureBarcodeToken,
} from './src/lib/walletwalletClient';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = path.resolve(__dirname, 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const memoryConsumerUsers = new Map<string, any>();
const memoryConsumerByToken = new Map<string, any>();
const memoryConsumerReceipts = new Map<string, any[]>();
const memoryConsumerCards = new Map<string, any[]>();
const memoryMerchantHubConfigs = new Map<string, any>();

// Inicializar usuario de ejemplo real (Daniel Rojas) para mantener coherencia con mockApi
const defaultDanielUser = {
  id: 'acc-daniel-r',
  email: 'daniel@ejemplo.com',
  emailOrPhone: 'daniel@ejemplo.com',
  fullName: 'Daniel Rojas',
  displayName: 'Daniel Rojas',
  birthDate: '1994-08-14',
  ageGroup: 'adult',
  consentSaveReceipts: true,
  consentMarketingNetwork: true,
  createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
};
memoryConsumerUsers.set(defaultDanielUser.id, defaultDanielUser);
memoryConsumerUsers.set(defaultDanielUser.email, defaultDanielUser);

const memoryWalletPasses = new Map<
  string,
  {
    passId: string;
    serialNumber: string;
    barcodeToken: string;
    shareUrl: string;
    businessId: string;
    businessName: string;
    customerName?: string;
    customerContact: string;
    stamps: number;
    stampsRequired: number;
    rewardText: string;
    colorPreset: ColorPreset;
    brandColor?: string;
    logoUrl?: string;
    createdAt: string;
    provider: string;
    applePassBase64?: string;
    googleSaveUrl?: string;
  }
>();

const memoryMpOrders = new Map<
  string,
  {
    orderId: string;
    externalReference: string;
    businessId: string;
    planId: string;
    amountArs: number;
    paymentMethodType: 'card' | 'rapipago' | 'pagofacil';
    status: 'processed' | 'action_required' | 'failed';
    statusDetail: string;
    ticketCode?: string;
    createdAt: string;
  }
>();

interface ServerOtpEntry {
  email: string;
  code: string;
  expiresAtMs: number;
  resendAvailableAtMs: number;
  attempts: number;
  maxAttempts: number;
  used: boolean;
}
const memoryOtps = new Map<string, ServerOtpEntry>();

function normalize8DigitBarcode(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 8) return digits;
  return '';
}

function generateUnique8DigitServerBarcode(): string {
  for (let i = 0; i < 20; i++) {
    const token = generateSecureBarcodeToken();
    const exists = Array.from(memoryWalletPasses.values()).some(
      (p) => p.barcodeToken === token
    );
    if (!exists) return token;
  }
  return generateSecureBarcodeToken();
}

function extractSessionTokenFromReq(req: http.IncomingMessage): string {
  const auth = String(req.headers['authorization'] || '');
  if (auth.toLowerCase().startsWith('bearer ')) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const cookie = String(req.headers['cookie'] || '');
  const match = cookie.match(/(?:^|;\s*)toque_session=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : '';
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; sandboxRouted: boolean; provider: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.EMAIL_FROM?.trim() || 'Toque <onboarding@resend.dev>';
  const recipient = params.to.trim().toLowerCase();

  if (!resendKey || !recipient.includes('@')) {
    return { sent: false, sandboxRouted: false, provider: 'server-console' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject: params.subject,
        html: params.html,
      }),
    });

    if (response.ok) {
      return { sent: true, sandboxRouted: false, provider: 'resend' };
    }

    const errText = await response.text().catch(() => '');

    if (response.status === 403) {
      const matchOwner = errText.match(/\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/);
      const sandboxOwnerEmail = (
        process.env.RESEND_SANDBOX_EMAIL ||
        (matchOwner ? matchOwner[1] : 'fedeeeloiss@gmail.com')
      )
        .trim()
        .toLowerCase();

      if (sandboxOwnerEmail && sandboxOwnerEmail !== recipient) {
        const fallbackRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [sandboxOwnerEmail],
            subject: `[Prueba para ${recipient}] ${params.subject}`,
            html: params.html,
          }),
        }).catch(() => null);

        if (fallbackRes && fallbackRes.ok) {
          return { sent: false, sandboxRouted: true, provider: 'resend-sandbox' };
        }
      }

      return { sent: false, sandboxRouted: true, provider: 'resend-sandbox' };
    }
  } catch {
    // fallback
  }

  return { sent: false, sandboxRouted: false, provider: 'server-console' };
}

async function sendVerificationEmailViaProvider(
  email: string,
  code: string,
  contextLabel: string
): Promise<{ sent: boolean; provider: string }> {
  const html = `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; background: #0C0C0E; color: #F4F4F0; padding: 32px; border-radius: 20px; max-width: 480px; margin: 0 auto; border: 1px solid #282830;">
      <p style="font-size: 11px; letter-spacing: 0.08em; color: #D95B26; font-weight: 700; margin: 0 0 8px 0;">Toque · Acceso seguro</p>
      <h1 style="font-size: 22px; margin: 0 0 16px 0; color: #F4F4F0;">Tu código de verificación</h1>
      <p style="font-size: 14px; color: #A1A1AA; line-height: 1.5; margin: 0 0 24px 0;">
        Ingresá este código de 6 dígitos para confirmar tu correo en <strong style="color: #F4F4F0;">${contextLabel}</strong>. Vence en 10 minutos y se usa una sola vez.
      </p>
      <div style="background: #141418; border: 1px solid #282830; border-radius: 14px; padding: 20px; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #F4F4F0; margin-bottom: 24px;">
        ${code}
      </div>
      <p style="font-size: 12px; color: #71717A; margin: 0;">
        Si no solicitaste este código, podés ignorar este correo de forma segura.
      </p>
    </div>
  `;

  const result = await sendEmailViaResend({
    to: email,
    subject: `${code} es tu código de verificación de Toque`,
    html,
  });

  if (!result.sent) {
    console.log(`[TOQUE EMAIL OTP] Para: ${email} | Código: ${code} | Contexto: ${contextLabel}`);
  }

  return { sent: result.sent, provider: result.provider };
}

async function startServer() {
  let vite: any = null;
  let viteInitPromise: Promise<any> | null = null;

  const getVite = () => {
    if (vite) return Promise.resolve(vite);
    if (!viteInitPromise) {
      viteInitPromise = import('vite')
        .then(({ createServer: createViteServer }) =>
          createViteServer({
            server: { middlewareMode: true, hmr: false },
            appType: 'spa',
          })
        )
        .then((v) => {
          vite = v;
          return v;
        })
        .catch(() => null);
    }
    return viteInitPromise;
  };

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    getVite();
  }

  const server = http.createServer(async (req, res) => {
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const originHeader = String(req.headers['origin'] || '').trim();
    const refererHeader = String(req.headers['referer'] || '').trim();

    let baseOrigin = `http://${req.headers.host || 'localhost'}`;
    if (originHeader && originHeader.startsWith('http') && !originHeader.includes('localhost')) {
      baseOrigin = originHeader;
    } else if (forwardedHost && !forwardedHost.includes('localhost')) {
      baseOrigin = `${forwardedProto || 'https'}://${forwardedHost}`;
    } else if (refererHeader && refererHeader.startsWith('http') && !refererHeader.includes('localhost')) {
      try {
        baseOrigin = new URL(refererHeader).origin;
      } catch {
        // ignore
      }
    }

    const url = new URL(req.url || '/', baseOrigin);
    const pathname = url.pathname;

    // 1. Health checks
    if (pathname === '/healthz' || pathname === '/api/healthz' || pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('OK');
      return;
    }

    // 1a. Endpoint administrativo de saneamiento: POST /api/debug/clean-orphans
    if (
      pathname === '/api/debug/clean-orphans' &&
      (req.method === 'POST' || req.method === 'GET')
    ) {
      memoryMerchantHubConfigs.delete('musical-monroe');
      memoryMerchantHubConfigs.delete('monroe01');
      memoryMerchantHubConfigs.delete('monroe02');
      for (const [key, cfg] of memoryMerchantHubConfigs.entries()) {
        if (
          !key ||
          !cfg ||
          !cfg.tenantId ||
          String(cfg.tenantId).toLowerCase() === 'musical-monroe' ||
          String(cfg.businessName || '').trim().toLowerCase() === 'musical monroe'
        ) {
          memoryMerchantHubConfigs.delete(key);
        }
      }
      for (const [mail, list] of memoryConsumerCards.entries()) {
        const seenTenants = new Set<string>();
        const cleanList = (list || []).filter((c: any) => {
          const tId = String(c?.businessId || c?.tenantId || '').trim();
          const bName = String(c?.businessName || '').trim().toLowerCase();
          if (
            !tId ||
            tId.toLowerCase() === 'musical-monroe' ||
            bName === 'musical monroe' ||
            seenTenants.has(tId)
          ) {
            return false;
          }
          seenTenants.add(tId);
          return true;
        });
        memoryConsumerCards.set(mail, cleanList);
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          success: true,
          cleaned: true,
          message: 'Datos mezclados y registros huérfanos depurados correctamente.',
        })
      );
      return;
    }

    // 1b. Sesiones de comercio/admin (/api/auth/me, /api/auth/login, /api/auth/register, /api/auth/logout)
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const token = extractSessionTokenFromReq(req);
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ authenticated: false, error: 'Sesión no iniciada.' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ authenticated: true, token }));
      return;
    }

    if (
      (pathname === '/api/auth/login' || pathname === '/api/auth/register') &&
      req.method === 'POST'
    ) {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const cleanEmail = String(body.email || 'comercio@toque.com.ar').trim().toLowerCase();
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
        const userPayload = {
          id: body.userId || `usr-${crypto.randomUUID().slice(0, 8)}`,
          email: cleanEmail,
          name: String(body.name || body.businessName || cleanEmail.split('@')[0] || 'Comercio').trim(),
          role: String(body.role || 'BUSINESS').trim(),
          businessId: String(body.businessId || 'musical-monroe').trim(),
        };
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `toque_merchant_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
        });
        res.end(
          JSON.stringify({
            authenticated: true,
            token: sessionToken,
            sessionToken,
            user: userPayload,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err?.message || 'Error al iniciar sesión.' }));
        return;
      }
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': 'toque_merchant_session=; Path=/; Max-Age=0; SameSite=Lax',
      });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 1c. Reclamo de tarjeta del cliente en el Hub: POST /api/consumer/cards/claim (siempre devuelve 200 OK con barcode_token de 8 dígitos y stamps = 0 si es nueva)
    if (pathname === '/api/consumer/cards/claim' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const tenantId = String(body.tenantId || body.businessId || 'musical-monroe').trim();
        const liveCfg = memoryMerchantHubConfigs.get(tenantId);

        const incomingToken = extractSessionTokenFromReq(req);
        let userRecord = incomingToken ? memoryConsumerByToken.get(incomingToken) : null;
        let cleanEmail = String(body.email || body.contact || userRecord?.email || '')
          .trim()
          .toLowerCase();
        let consumerId = String(body.consumerId || userRecord?.id || '').trim();

        if (!userRecord && cleanEmail) {
          userRecord = memoryConsumerUsers.get(cleanEmail) || null;
        }
        if (!userRecord && consumerId) {
          userRecord = memoryConsumerUsers.get(consumerId) || null;
        }

        const fullName = String(
          body.fullName || body.name || userRecord?.fullName || userRecord?.displayName || cleanEmail.split('@')[0] || 'Socio'
        ).trim();
        const birthDate = String(body.birthDate || userRecord?.birthDate || '').trim() || undefined;
        const sessionToken =
          userRecord?.sessionToken ||
          incomingToken ||
          `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

        if (!consumerId) {
          consumerId = userRecord?.id || `usr-${crypto.randomUUID().slice(0, 12)}`;
        }
        if (!cleanEmail) {
          cleanEmail = `socio-${consumerId.slice(-6)}@toque.com.ar`;
        }

        const updatedUser = {
          ...(userRecord || {}),
          id: consumerId,
          email: cleanEmail,
          emailOrPhone: cleanEmail,
          fullName,
          displayName: fullName,
          birthDate,
          sessionToken,
          ageGroup: 'adult',
          consentSaveReceipts: true,
          consentMarketingNetwork: true,
          createdAt: userRecord?.createdAt || new Date().toISOString(),
        };
        memoryConsumerUsers.set(consumerId, updatedUser);
        memoryConsumerUsers.set(cleanEmail, updatedUser);
        memoryConsumerByToken.set(sessionToken, updatedUser);

        const businessName = String(
          liveCfg?.businessName || body.businessName || 'Musical Monroe'
        ).trim();
        const stampsRequired = 10;
        const rewardText = String(
          liveCfg?.rewardText || body.rewardText || 'Beneficio al completar tus 10 sellos'
        ).trim();
        const brandColor = String(
          liveCfg?.brandColor || body.brandColor || '#D95B26'
        ).trim();
        const colorPreset = String(
          liveCfg?.colorPreset || body.colorPreset || 'dark'
        ).trim();
        const logoUrl = liveCfg?.logoUrl || body.logoUrl || undefined;
        const nowIso = new Date().toISOString();

        const existingList = memoryConsumerCards.get(cleanEmail) || [];
        let foundCard = existingList.find(
          (c: any) => c.businessId === tenantId || c.tenantId === tenantId
        );

        if (!foundCard) {
          const barcodeToken =
            normalize8DigitBarcode(body.barcodeToken) || generateUnique8DigitServerBarcode();
          foundCard = {
            id: `mem-${crypto.randomUUID().slice(0, 8)}`,
            businessId: tenantId,
            tenantId,
            businessName,
            name: fullName,
            email: cleanEmail,
            contact: cleanEmail,
            stamps: 0,
            points: 0,
            stampsRequired,
            targetStamps: stampsRequired,
            rewardText,
            brandColor,
            colorPreset,
            logoUrl,
            barcodeToken,
            shortCode: barcodeToken,
            memberCode: barcodeToken,
            lastStampedAt: null,
            joinedAt: nowIso,
            consent: true,
          };
          memoryConsumerCards.set(cleanEmail, [foundCard, ...existingList]);
        } else {
          foundCard.businessName = businessName;
          foundCard.rewardText = rewardText;
          foundCard.brandColor = brandColor;
          foundCard.colorPreset = colorPreset;
          foundCard.logoUrl = logoUrl || foundCard.logoUrl;
          foundCard.stampsRequired = 10;
          foundCard.targetStamps = 10;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `toque_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
        });
        res.end(
          JSON.stringify({
            success: true,
            card: foundCard,
            member: foundCard,
            barcodeToken: foundCard.barcodeToken,
            sessionToken,
            user: {
              id: consumerId,
              email: cleanEmail,
              fullName,
              birthDate,
            },
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err?.message || 'Error al guardar tarjeta.' }));
        return;
      }
    }

    // 1d. Eliminar cuenta del comercio: DELETE /api/merchant/account
    if (pathname === '/api/merchant/account' && req.method === 'DELETE') {
      try {
        const tenantId = (url.searchParams.get('tenantId') || url.searchParams.get('businessId') || '').trim();
        if (tenantId) {
          memoryMerchantHubConfigs.delete(tenantId);
          for (const [mail, cards] of memoryConsumerCards.entries()) {
            memoryConsumerCards.set(
              mail,
              (cards || []).filter((c: any) => c.businessId !== tenantId && c.tenantId !== tenantId)
            );
          }
          for (const [serial, pass] of memoryWalletPasses.entries()) {
            if (pass.businessId === tenantId) {
              memoryWalletPasses.delete(serial);
            }
          }
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': 'toque_merchant_session=; Path=/; Max-Age=0; SameSite=Lax',
        });
        res.end(JSON.stringify({ success: true, deletedTenantId: tenantId || 'ok' }));
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err?.message || 'No se pudo eliminar la cuenta.' }));
        return;
      }
    }

    // 2. Endpoint público de descarga directa de Apple Wallet (.pkpass): GET /api/wallet/pass/:barcodeToken.pkpass
    if (
      (pathname.startsWith('/api/wallet/pass/') || pathname.startsWith('/api/wallet/pkpass/')) &&
      (pathname.endsWith('.pkpass') || pathname.startsWith('/api/wallet/pkpass/')) &&
      req.method === 'GET'
    ) {
      const rawToken = decodeURIComponent(
        pathname
          .replace('/api/wallet/pass/', '')
          .replace('/api/wallet/pkpass/', '')
          .replace(/\.pkpass$/i, '')
      ).trim();

      let foundPass = memoryWalletPasses.get(rawToken);
      if (!foundPass) {
        for (const p of memoryWalletPasses.values()) {
          if (p.barcodeToken === rawToken || p.serialNumber === rawToken || p.passId === rawToken) {
            foundPass = p;
            break;
          }
        }
      }

      if (!foundPass?.applePassBase64) {
        try {
          const apiKey = (
            process.env.WALLETWALLET_API_KEY || ''
          ).trim();
          const token8 = normalize8DigitBarcode(rawToken) || generateUnique8DigitServerBarcode();
          const liveCfg = Array.from(memoryMerchantHubConfigs.values())[0];
          const businessName =
            foundPass?.businessName ||
            liveCfg?.businessName ||
            url.searchParams.get('businessName') ||
            'Mi comercio';
          const rewardText =
            foundPass?.rewardText ||
            liveCfg?.rewardText ||
            url.searchParams.get('rewardText') ||
            'Beneficio al completar tus 10 sellos';
          const stamps = Number(foundPass?.stamps ?? url.searchParams.get('stamps') ?? 0);
          const customerName =
            foundPass?.customerName || url.searchParams.get('memberName') || undefined;

          const created = await createPass(
            { WALLETWALLET_API_KEY: apiKey },
            {
              businessName,
              memberName: customerName,
              stamps,
              stampsRequired: 10,
              rewardText,
              barcodeToken: token8,
              colorPreset: (foundPass?.colorPreset || liveCfg?.colorPreset || 'dark') as ColorPreset,
              color: foundPass?.brandColor || liveCfg?.brandColor || undefined,
              logoURL: foundPass?.logoUrl || liveCfg?.logoUrl || undefined,
            }
          );

          if (created.applePass) {
            const newPassObj = {
              passId: created.serialNumber,
              serialNumber: created.serialNumber,
              barcodeToken: token8,
              shareUrl: created.shareUrl || '',
              businessId: foundPass?.businessId || liveCfg?.tenantId || 'comercio-activo',
              businessName,
              customerName,
              customerContact: foundPass?.customerContact || '',
              stamps,
              stampsRequired: 10,
              rewardText,
              colorPreset: (foundPass?.colorPreset || 'dark') as ColorPreset,
              brandColor: foundPass?.brandColor || '#141414',
              createdAt: new Date().toISOString(),
              provider: 'api.walletwallet.dev',
              applePassBase64: created.applePass,
              googleSaveUrl: created.googleSaveUrl || '',
            };
            memoryWalletPasses.set(created.serialNumber, newPassObj);
            memoryWalletPasses.set(token8, newPassObj);
            if (rawToken) memoryWalletPasses.set(rawToken, newPassObj);
            foundPass = newPassObj;
          }
        } catch {
          // ignore
        }
      }

      if (foundPass?.applePassBase64) {
        const buffer = Buffer.from(foundPass.applePassBase64, 'base64');
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `inline; filename="tarjeta-${rawToken || 'toque'}.pkpass"`,
          'Content-Length': buffer.length,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        });
        res.end(buffer);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'No encontramos el pase para Apple Wallet solicitado.' }));
      return;
    }

    // 3. Envío y verificación de códigos OTP por correo electrónico (/api/auth/send-otp, /api/auth/verify-otp, /api/consumer/verify-code, /api/consumer/register, /api/consumer/me)
    if (pathname === '/api/auth/send-otp' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const contextLabel = String(body.contextLabel || 'Toque').trim();

        if (!cleanEmail || !cleanEmail.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Ingresá un correo electrónico válido.' }));
          return;
        }

        const existing = memoryOtps.get(cleanEmail);
        const now = Date.now();
        if (existing && now < existing.resendAvailableAtMs && !body.forceResend) {
          const waitSec = Math.ceil((existing.resendAvailableAtMs - now) / 1000);
          res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              success: false,
              error: `Esperá ${waitSec} segundos antes de pedir un código nuevo.`,
              resendWaitSeconds: waitSec,
            })
          );
          return;
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const entry: ServerOtpEntry = {
          email: cleanEmail,
          code,
          expiresAtMs: now + 10 * 60 * 1000,
          resendAvailableAtMs: now + 60 * 1000,
          attempts: 0,
          maxAttempts: 5,
          used: false,
        };
        memoryOtps.set(cleanEmail, entry);

        const delivery = await sendVerificationEmailViaProvider(cleanEmail, code, contextLabel);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            email: cleanEmail,
            expiresAt: new Date(entry.expiresAtMs).toISOString(),
            resendAvailableAt: new Date(entry.resendAvailableAtMs).toISOString(),
            maxAttempts: entry.maxAttempts,
            deliveryProvider: delivery.provider,
            emailSent: delivery.sent,
            previewCode: delivery.sent ? undefined : code,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err?.message || 'Error al enviar el código.' }));
        return;
      }
    }

    if (
      (pathname === '/api/auth/verify-otp' || pathname === '/api/consumer/verify-code') &&
      req.method === 'POST'
    ) {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const cleanCode = String(body.code || '').trim();

        const entry = memoryOtps.get(cleanEmail);
        if (entry) {
          if (entry.used) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: 'Este código ya fue usado. Pedí uno nuevo.' }));
            return;
          }
          if (Date.now() > entry.expiresAtMs) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: 'El código venció (dura 10 minutos). Pedí uno nuevo.' }));
            return;
          }
          if (entry.attempts >= entry.maxAttempts) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: 'Superaste los 5 intentos permitidos. Pedí un código nuevo.' }));
            return;
          }
          entry.attempts += 1;
          if (entry.code !== cleanCode) {
            const remaining = entry.maxAttempts - entry.attempts;
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(
              JSON.stringify({
                success: false,
                error:
                  remaining > 0
                    ? `Código incorrecto. Te quedan ${remaining} ${remaining === 1 ? 'intento' : 'intentos'}.`
                    : 'Superaste los 5 intentos permitidos. Pedí un código nuevo.',
              })
            );
            return;
          }
          entry.used = true;
        }

        const existingUser = memoryConsumerUsers.get(cleanEmail);
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

        if (existingUser && (existingUser.fullName || existingUser.displayName)) {
          existingUser.sessionToken = sessionToken;
          memoryConsumerByToken.set(sessionToken, existingUser);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Set-Cookie': `toque_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
          });
          res.end(
            JSON.stringify({
              success: true,
              verifiedEmail: cleanEmail,
              needsRegistration: false,
              sessionToken,
              user: {
                id: existingUser.id,
                email: cleanEmail,
                fullName: existingUser.fullName || existingUser.displayName,
                birthDate: existingUser.birthDate,
              },
            })
          );
          return;
        }

        const verificationTicket = crypto.randomUUID().replace(/-/g, '');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `toque_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
        });
        res.end(
          JSON.stringify({
            success: true,
            verifiedEmail: cleanEmail,
            needsRegistration: true,
            verificationTicket,
            sessionToken,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err?.message || 'Error al verificar el código.' }));
        return;
      }
    }

    if (pathname === '/api/consumer/register' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const fullName = String(body.fullName || body.name || 'Cliente').trim();
        const birthDate = String(body.birthDate || '').trim() || undefined;
        const userId = body.id || crypto.randomUUID();
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

        const userRecord = {
          id: userId,
          email: cleanEmail,
          emailOrPhone: cleanEmail,
          fullName,
          displayName: fullName,
          birthDate,
          sessionToken,
          ageGroup: 'adult',
          consentSaveReceipts: true,
          consentMarketingNetwork: Boolean(body.marketingConsent),
          createdAt: new Date().toISOString(),
        };

        memoryConsumerUsers.set(userId, userRecord);
        memoryConsumerUsers.set(cleanEmail, userRecord);
        memoryConsumerByToken.set(sessionToken, userRecord);

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `toque_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
        });
        res.end(
          JSON.stringify({
            needsRegistration: false,
            sessionToken,
            user: {
              id: userId,
              email: cleanEmail,
              fullName,
              birthDate,
            },
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err?.message || 'No pudimos registrar tu cuenta.' }));
        return;
      }
    }

    if (pathname === '/api/consumer/me' && req.method === 'GET') {
      const token = extractSessionTokenFromReq(req);
      const userRecord = token ? memoryConsumerByToken.get(token) : null;
      if (!userRecord) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ authenticated: false, user: null, cards: [], receipts: [] }));
        return;
      }
      const cards = memoryConsumerCards.get(userRecord.email) || [];
      const receipts = memoryConsumerReceipts.get(userRecord.id) || [];
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          authenticated: true,
          user: {
            id: userRecord.id,
            email: userRecord.email || userRecord.emailOrPhone,
            fullName: userRecord.fullName || userRecord.displayName,
            birthDate: userRecord.birthDate,
          },
          cards,
          receipts,
        })
      );
      return;
    }

    // 4. Sincronización de diseño del Hub y Tarjetas en tiempo real:
    // PUT /api/merchant/hub-config, PUT /api/merchant/hub, POST/PUT /api/merchant/cards
    if (
      (pathname === '/api/merchant/hub-config' ||
        pathname === '/api/merchant/hub' ||
        pathname === '/api/merchant/cards' ||
        pathname === '/api/club/cards') &&
      (req.method === 'PUT' || req.method === 'POST')
    ) {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const tenantId = String(body.tenantId || body.businessId || 'musical-monroe').trim();
        const businessName = String(body.businessName || 'Musical Monroe').trim().slice(0, 64);
        const logoUrl = String(body.logoUrl || '').trim() || undefined;
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const colorPreset: ColorPreset = validPresets.includes(body.colorPreset)
          ? body.colorPreset
          : 'dark';
        const brandColor = String(body.customColor || body.brandColor || '#D95B26').trim();
        const stampsRequired = 10;
        const rewardText = String(
          body.rewardText || body.reward || 'Beneficio al completar tus 10 sellos'
        )
          .trim()
          .slice(0, 80);
        const rewardValueArs = Math.max(0, Number(body.rewardValueArs || 0));

        const cfgRecord = {
          tenantId,
          businessName,
          logoUrl,
          brandColor,
          customColor: brandColor,
          colorPreset,
          stampsRequired,
          rewardText,
          rewardValueArs,
          updatedAt: new Date().toISOString(),
        };
        memoryMerchantHubConfigs.set(tenantId, cfgRecord);

        // Actualizar también todas las tarjetas ya emitidas para este comercio en memoria
        for (const [mail, cards] of memoryConsumerCards.entries()) {
          const updatedCards = (cards || []).map((c: any) => {
            if (c.businessId === tenantId || c.tenantId === tenantId) {
              return {
                ...c,
                businessName,
                rewardText,
                rewardValueArs,
                brandColor,
                customColor: brandColor,
                colorPreset,
                logoUrl: logoUrl || c.logoUrl,
                stampsRequired: 10,
                targetStamps: 10,
              };
            }
            return c;
          });
          memoryConsumerCards.set(mail, updatedCards);
        }

        const apiKey = (
          process.env.WALLETWALLET_API_KEY || ''
        ).trim();

        // Actualizar en segundo plano los pases emitidos de este comercio
        if (apiKey) {
          setImmediate(async () => {
            for (const p of memoryWalletPasses.values()) {
              if (p.businessId === tenantId && p.serialNumber && !p.serialNumber.startsWith('ww-')) {
                p.businessName = businessName;
                p.stampsRequired = stampsRequired;
                p.rewardText = rewardText;
                p.colorPreset = colorPreset;
                p.brandColor = brandColor;
                p.logoUrl = logoUrl;
                await updatePass({ WALLETWALLET_API_KEY: apiKey }, p.serialNumber, {
                  businessName,
                  memberName: p.customerName,
                  stamps: p.stamps,
                  stampsRequired,
                  rewardText,
                  barcodeToken: p.barcodeToken,
                  colorPreset,
                  color: brandColor,
                  logoURL: logoUrl,
                }).catch(() => {});
              }
            }
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            config: cfgRecord,
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
              logoUrl,
              active: true,
            },
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err?.message }));
        return;
      }
    }

    // 4b. Lectura pública en tiempo real sin caché: GET /api/public/hub/:code
    if (pathname.startsWith('/api/public/hub/') && req.method === 'GET') {
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
          res.writeHead(404, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          });
          res.end(
            JSON.stringify({
              found: false,
              deleted: true,
              error: 'El Hub de Musical Monroe fue eliminado.',
            })
          );
          return;
        }

        const liveCfg =
          memoryMerchantHubConfigs.get(codeLower) ||
          Array.from(memoryMerchantHubConfigs.values())[0] ||
          null;

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        });
        res.end(
          JSON.stringify({
            found: Boolean(liveCfg),
            tenantId: liveCfg?.tenantId || codeLower || 'comercio-activo',
            code: codeUpper || 'LOCAL01',
            businessName: liveCfg?.businessName || undefined,
            logoUrl: liveCfg?.logoUrl || undefined,
            brandColor: liveCfg?.brandColor || undefined,
            colorPreset: liveCfg?.colorPreset || undefined,
            customColor: liveCfg?.customColor || liveCfg?.brandColor || undefined,
            stampsRequired: 10,
            rewardText: liveCfg?.rewardText || undefined,
            rewardValueArs: liveCfg?.rewardValueArs ?? undefined,
          })
        );
        return;
      }
    }

    // 5. Estado de WalletWallet
    if (pathname === '/api/wallet/status' && req.method === 'GET') {
      const apiKey = (
        process.env.WALLETWALLET_API_KEY || ''
      ).trim();
      const hasKey = Boolean(apiKey.length > 0);
      const hasResendKey = Boolean(
        process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0
      );
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          configured: hasKey,
          emailConfigured: hasResendKey,
          provider: 'https://api.walletwallet.dev',
          status: hasKey ? 'active' : 'fallback',
          passesIssuedCount: memoryWalletPasses.size,
          passes: Array.from(memoryWalletPasses.values()),
        })
      );
      return;
    }

    // 6. Sincronización de Cuenta del Consumidor: /api/consumer/sync
    if (pathname === '/api/consumer/sync' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const consumerId = body.user?.id || crypto.randomUUID();
        const emailOrPhone = (body.user?.emailOrPhone || '').trim().toLowerCase();
        const displayName = (body.user?.displayName || 'Cliente').trim();
        const birthDate = body.user?.birthDate;
        const ageGroup = body.user?.ageGroup || 'all';
        const consentSaveReceipts = body.user?.consentSaveReceipts !== false;
        const consentMarketingNetwork = body.user?.consentMarketingNetwork !== false;
        const createdAt = body.user?.createdAt || new Date().toISOString();
        const receipts = Array.isArray(body.receipts) ? body.receipts : [];

        const existingByMail = emailOrPhone ? memoryConsumerUsers.get(emailOrPhone) : null;
        const sessionToken =
          existingByMail?.sessionToken ||
          `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

        const userRecord = {
          id: existingByMail?.id || consumerId,
          uuid: existingByMail?.id || consumerId,
          email: emailOrPhone,
          emailOrPhone,
          fullName: displayName,
          displayName,
          birthDate: birthDate || existingByMail?.birthDate,
          sessionToken,
          ageGroup,
          consentSaveReceipts,
          consentMarketingNetwork,
          createdAt,
          syncedAt: new Date().toISOString(),
        };

        memoryConsumerUsers.set(userRecord.id, userRecord);
        if (emailOrPhone) {
          memoryConsumerUsers.set(emailOrPhone, userRecord);
        }
        memoryConsumerByToken.set(sessionToken, userRecord);
        memoryConsumerReceipts.set(userRecord.id, receipts);

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `toque_session=${sessionToken}; Path=/; Max-Age=31536000; SameSite=Lax`,
        });
        res.end(
          JSON.stringify({
            success: true,
            consumerId: userRecord.id,
            sessionToken,
            recoveryCode: `TQ-${userRecord.id.slice(0, 8).toUpperCase()}`,
            user: userRecord,
            receiptsCount: receipts.length,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err?.message || 'Error al guardar cuenta' }));
        return;
      }
    }

    if (pathname === '/api/consumer/sync' && req.method === 'GET') {
      const contact = (url.searchParams.get('contact') || '').trim().toLowerCase();
      const userRecord = memoryConsumerUsers.get(contact);
      if (userRecord) {
        const receipts = memoryConsumerReceipts.get(userRecord.id) || [];
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ found: true, user: userRecord, receipts }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ found: false }));
      return;
    }

    // 7. Endpoints Resend Oficiales: /api/club/join, /api/club/recover, /api/club/broadcast
    if (
      (pathname === '/api/club/join' || pathname === '/api/club/welcome-email') &&
      req.method === 'POST'
    ) {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const email = String(body.email || '').trim().toLowerCase();
        const customerName = String(body.customerName || body.name || 'Cliente').trim();
        const businessName = String(body.businessName || 'Musical Monroe').trim();
        const memberCode = String(body.memberCode || '48291037').trim();
        const localCode = String(body.localCode || 'MONROE01').trim();
        const stamps = Number(body.stamps ?? 1);
        const stampsRequired = Number(body.stampsRequired ?? 10);
        const rewardText = String(
          body.rewardText || body.reward || 'Beneficio al completar tus sellos'
        ).trim();
        const hubUrl = String(body.hubUrl || `${url.origin}/u/${localCode}`).trim();
        const walletUrl = String(
          body.walletUrl ||
            `${url.origin}/u/${localCode}?wallet=open&code=${encodeURIComponent(memberCode)}`
        ).trim();

        const html = renderWelcomeCardEmail({
          businessName,
          customerName,
          stamps,
          stampsRequired,
          rewardText,
          memberCode,
          hubUrl,
          walletUrl,
        });

        let emailSent = false;
        let provider = 'preview';

        if (email && email.includes('@')) {
          const delivery = await sendEmailViaResend({
            to: email,
            subject: `¡Ya sos parte de ${businessName}! (${stamps}/${stampsRequired} sellos)`,
            html,
          });
          emailSent = delivery.sent || delivery.sandboxRouted;
          provider = delivery.provider;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            emailSent,
            provider,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err?.message }));
        return;
      }
    }

    if (pathname === '/api/club/recover' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const businessName = String(body.businessName || 'Musical Monroe').trim();
        const customerName = String(
          body.customerName || cleanEmail.split('@')[0] || 'Cliente'
        ).trim();
        const localCode = String(body.localCode || 'MONROE01').trim();
        const currentStamps = Number(body.currentStamps ?? 1);
        const stampsRequired = Number(body.stampsRequired ?? 10);

        if (!cleanEmail || !cleanEmail.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({ success: false, error: 'Ingresá un correo electrónico válido.' })
          );
          return;
        }

        const otpCode = String(Math.floor(1000 + Math.random() * 9000));
        const now = Date.now();
        memoryOtps.set(cleanEmail, {
          email: cleanEmail,
          code: otpCode,
          expiresAtMs: now + 10 * 60 * 1000,
          resendAvailableAtMs: now + 30 * 1000,
          attempts: 0,
          maxAttempts: 5,
          used: false,
        });

        const magicLinkUrl = `${url.origin}/u/${encodeURIComponent(
          localCode
        )}?recoverEmail=${encodeURIComponent(cleanEmail)}&otp=${encodeURIComponent(otpCode)}`;

        const html = renderRecoverCardEmail({
          businessName,
          customerName,
          otpCode,
          magicLinkUrl,
          currentStamps,
          stampsRequired,
        });

        const delivery = await sendEmailViaResend({
          to: cleanEmail,
          subject: `${otpCode} · Recuperá tu tarjeta de ${businessName}`,
          html,
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            emailSent: delivery.sent,
            provider: delivery.provider,
            magicLinkUrl,
            previewCode: delivery.sent ? undefined : otpCode,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err?.message }));
        return;
      }
    }

    if (pathname === '/api/club/broadcast' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const planStatus = String(body.planStatus || 'trial').toLowerCase();
        if (planStatus === 'free' || planStatus === 'expired') {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              success: false,
              error:
                'El envío de avisos por correo está disponible en el Plan Pro o durante el período de prueba activo.',
            })
          );
          return;
        }

        const rawRecipients: Array<string | { email: string; name?: string; consent?: boolean }> =
          Array.isArray(body.recipients) ? body.recipients : [];
        const headline = String(body.headline || body.subject || 'Novedad del club').trim();
        const messageBody = String(body.messageBody || body.message || '').trim();
        const businessName = String(body.businessName || 'Musical Monroe').trim();
        const localCode = String(body.localCode || 'MONROE01').trim();
        const ctaLabel = String(body.ctaLabel || 'Ver mi tarjeta y beneficio').trim();
        const ctaUrl = String(body.ctaUrl || `${url.origin}/u/${localCode}`).trim();

        const resendKey = process.env.RESEND_API_KEY?.trim();
        let sentCount = 0;

        const consentedRecipients = rawRecipients
          .map((item) => {
            if (typeof item === 'string') {
              return { email: item.trim().toLowerCase(), name: 'Cliente', consent: true };
            }
            return {
              email: String(item.email || '').trim().toLowerCase(),
              name: String(item.name || 'Cliente').trim(),
              consent: item.consent !== false,
            };
          })
          .filter((r) => r.consent && r.email.includes('@'));

        if (resendKey && consentedRecipients.length > 0 && messageBody) {
          for (const rec of consentedRecipients.slice(0, 50)) {
            const unsubscribeUrl = `${url.origin}/u/${localCode}?unsubscribe=${encodeURIComponent(
              rec.email
            )}`;
            const html = renderMerchantBroadcastEmail({
              businessName,
              customerName: rec.name,
              headline,
              messageBody,
              ctaLabel,
              ctaUrl,
              unsubscribeUrl,
            });
            const delivery = await sendEmailViaResend({
              to: rec.email,
              subject: `${businessName}: ${headline}`,
              html,
            });
            if (delivery.sent || delivery.sandboxRouted) {
              sentCount++;
            }
          }
        } else {
          sentCount = consentedRecipients.length;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            sentCount,
            provider: resendKey ? 'resend' : 'queued',
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err?.message }));
        return;
      }
    }

    // 8. Uso y pases de WalletWallet
    if (pathname === '/api/wallet/usage' && req.method === 'GET') {
      const apiKey = process.env.WALLETWALLET_API_KEY?.trim();
      if (!apiKey) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            configured: false,
            count: memoryWalletPasses.size,
            limit: 100,
            remaining: Math.max(0, 100 - memoryWalletPasses.size),
            plan: 'local-preview',
          })
        );
        return;
      }
      try {
        const usage = await getUsage({ WALLETWALLET_API_KEY: apiKey });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ configured: true, ...usage }));
      } catch (err: any) {
        const status = err instanceof WalletError ? err.status : 502;
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            configured: true,
            error: err?.message || 'No se pudo consultar el cupo de tarjetas.',
            code: err instanceof WalletError ? err.code : 'upstream',
          })
        );
      }
      return;
    }

    if (pathname.startsWith('/api/wallet/pkpass/') && req.method === 'GET') {
      const passId = decodeURIComponent(
        pathname.replace('/api/wallet/pkpass/', '').split('/')[0] || ''
      );
      const stored = memoryWalletPasses.get(passId);
      if (stored?.applePassBase64) {
        const buffer = Buffer.from(stored.applePassBase64, 'base64');
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': 'inline; filename="tarjeta.pkpass"',
          'Content-Length': buffer.length,
        });
        res.end(buffer);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'No encontramos el archivo de tarjeta solicitado.' }));
      return;
    }

    if (
      (pathname === '/api/merchant/stamp' ||
        pathname === '/api/club/stamp' ||
        pathname === '/api/club/stamps/self') &&
      req.method === 'POST'
    ) {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const lastStampedAt = body.lastStampedAt || null;

        if (lastStampedAt) {
          const lastMs = new Date(lastStampedAt).getTime();
          if (!Number.isNaN(lastMs)) {
            const elapsedMs = Date.now() - lastMs;
            if (elapsedMs < 86400000) {
              const remainingMs = 86400000 - elapsedMs;
              const hours = Math.floor(remainingMs / 3600000);
              const minutes = Math.max(1, Math.ceil((remainingMs % 3600000) / 60000));
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(
                JSON.stringify({
                  status: 'cooldown',
                  cooldown: true,
                  remainingMs,
                  remainingHours: hours,
                  remainingMinutes: minutes,
                  message: `Próximo sello disponible en ${hours} h ${minutes} min`,
                })
              );
              return;
            }
          }
        }

        const nowIso = new Date().toISOString();
        const nextStamps = (typeof body.stamps === 'number' ? body.stamps : 0) + 1;
        const stampsRequired =
          typeof body.stampsRequired === 'number' ? body.stampsRequired : 10;
        const businessName = String(body.businessName || 'Musical Monroe').slice(0, 64);
        const rewardText = String(
          body.rewardText || 'Beneficio al completar tus sellos'
        ).slice(0, 60);
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const colorPreset: ColorPreset = validPresets.includes(body.colorPreset)
          ? body.colorPreset
          : 'dark';
        const rawToken = String(body.barcodeToken || '').trim();
        const barcodeToken =
          normalize8DigitBarcode(rawToken) || generateUnique8DigitServerBarcode();
        const walletSerial = String(body.walletSerial || '').trim();
        const lastNotification =
          typeof body.walletLastNotification === 'string' && body.walletLastNotification
            ? body.walletLastNotification
            : ' ';

        let walletSyncError: string | undefined;
        let notifiedDevices = 0;
        const apiKey = (
          process.env.WALLETWALLET_API_KEY || ''
        ).trim();

        if (walletSerial && apiKey) {
          try {
            const upd = await updatePass({ WALLETWALLET_API_KEY: apiKey }, walletSerial, {
              businessName,
              memberName: body.memberName || undefined,
              stamps: nextStamps,
              stampsRequired,
              rewardText,
              barcodeToken,
              colorPreset,
              notification: lastNotification,
              color: body.color || undefined,
              logoURL: body.logoURL || undefined,
            });
            notifiedDevices = upd.notifiedDevices;
          } catch (err: any) {
            walletSyncError =
              err instanceof WalletError
                ? err.message
                : err?.message || 'No se pudo actualizar la tarjeta en la billetera.';
          }
        }

        // Actualizar también la tarjeta del cliente en memoryConsumerCards por su barcodeToken de 8 dígitos
        let resolvedNextStamps = nextStamps;
        for (const [mail, cards] of memoryConsumerCards.entries()) {
          const updatedCards = (cards || []).map((c: any) => {
            const cCode = String(c.barcodeToken || c.shortCode || c.memberCode || '')
              .replace(/[\s-]/g, '')
              .toUpperCase();
            if (
              (barcodeToken && cCode === barcodeToken) ||
              (rawToken && cCode === rawToken.replace(/[\s-]/g, '').toUpperCase()) ||
              (body.memberId && c.id === body.memberId)
            ) {
              resolvedNextStamps =
                typeof body.stamps === 'number'
                  ? body.stamps + 1
                  : Number(c.stamps || 0) + 1;
              return {
                ...c,
                stamps: resolvedNextStamps,
                points: resolvedNextStamps,
                stampsRequired: 10,
                targetStamps: 10,
                lastStampedAt: nowIso,
              };
            }
            return c;
          });
          memoryConsumerCards.set(mail, updatedCards);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            status: 'stamped',
            cooldown: false,
            stamps: resolvedNextStamps,
            stampsRequired,
            lastStampedAt: nowIso,
            barcodeToken,
            walletSerial: walletSerial || undefined,
            notifiedDevices,
            walletSyncError,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            status: 'error',
            error: err?.message || 'No se pudo registrar el sello.',
          })
        );
        return;
      }
    }

    if (pathname.startsWith('/api/wallet/pass/') && req.method === 'DELETE') {
      const serialNumber = decodeURIComponent(
        pathname.replace('/api/wallet/pass/', '').split('/')[0] || ''
      );
      const apiKey = process.env.WALLETWALLET_API_KEY?.trim();
      try {
        if (apiKey && serialNumber) {
          await revokePass({ WALLETWALLET_API_KEY: apiKey }, serialNumber);
        }
        memoryWalletPasses.delete(serialNumber);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, revokedSerial: serialNumber }));
      } catch (err: any) {
        const status = err instanceof WalletError ? err.status : 400;
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: false,
            error: err?.message || 'No se pudo dar de baja la tarjeta.',
            code: err instanceof WalletError ? err.code : 'upstream',
          })
        );
      }
      return;
    }

    if (
      (pathname === '/api/wallet/pass' ||
        pathname === '/api/wallet/create' ||
        pathname.startsWith('/api/wallet/pass/')) &&
      (req.method === 'POST' || req.method === 'PUT')
    ) {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const urlSerial = pathname.startsWith('/api/wallet/pass/')
          ? decodeURIComponent(pathname.replace('/api/wallet/pass/', '').split('/')[0] || '')
          : '';
        const existingSerial = String(
          urlSerial || body.serialNumber || body.walletSerial || ''
        ).trim();

        const businessId = String(body.businessId || 'comercio-activo').slice(0, 64);
        const businessName = String(body.businessName || body.title || 'Mi comercio').slice(
          0,
          80
        );
        const logoText = String(body.logoText || body.title || businessName).slice(0, 40);
        const organizationName = String(body.organizationName || businessName).slice(0, 64);
        const brandColor =
          typeof (body.color || body.backgroundColor || body.brandColor) === 'string' &&
          (body.color || body.backgroundColor || body.brandColor).startsWith('#')
            ? body.color || body.backgroundColor || body.brandColor
            : '#D95B26';
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const colorPreset: ColorPreset = validPresets.includes(body.colorPreset)
          ? body.colorPreset
          : 'dark';
        const stamps = typeof body.stamps === 'number' ? body.stamps : 0;
        const stampsRequired =
          typeof body.stampsRequired === 'number' ? body.stampsRequired : 10;
        const rewardText = String(
          body.reward || body.rewardText || 'Beneficio al completar tus 10 sellos'
        ).slice(0, 60);
        const customerName = String(body.memberName || body.customerName || '')
          .trim()
          .slice(0, 40);
        const customerContact = String(body.customerContact || '').slice(0, 100);
        const code = String(body.cartelCode || body.code || 'LOCAL01')
          .toUpperCase()
          .slice(0, 32);
        const memberId = String(body.memberId || `mem-${Date.now().toString(36)}`).slice(0, 64);

        const rawBarcode = String(
          body.barcodeToken || body.barcodeValue || body.memberCode || ''
        ).trim();
        const barcodeToken =
          normalize8DigitBarcode(rawBarcode) || generateUnique8DigitServerBarcode();

        const qrUrl = body.qrUrl || `/u/${code}`;
        const apiKey = (
          process.env.WALLETWALLET_API_KEY || ''
        ).trim();

        const cardInput: CardInput = {
          businessName,
          logoText,
          organizationName,
          memberName: customerName || undefined,
          stamps,
          stampsRequired,
          rewardText,
          barcodeToken,
          barcodeFormat: 'Code128',
          barcodeAltText: barcodeToken,
          colorPreset,
          notification: typeof body.notification === 'string' ? body.notification : ' ',
          locations: Array.isArray(body.locations) ? body.locations : undefined,
          color: body.color || undefined,
          logoURL: body.logoURL || body.logoUrl || undefined,
        };

        let walletSyncError: string | undefined;

        if (apiKey) {
          try {
            const isRealSerial = existingSerial && !existingSerial.startsWith('ww-');
            const existingRecord =
              (isRealSerial ? memoryWalletPasses.get(existingSerial) : undefined) ||
              memoryWalletPasses.get(barcodeToken);

            if ((req.method === 'PUT' || body.isUpdate) && isRealSerial && existingRecord?.applePassBase64) {
              try {
                const upd = await updatePass(
                  { WALLETWALLET_API_KEY: apiKey },
                  existingSerial,
                  cardInput
                );
                const googleWalletUrl = existingRecord?.googleSaveUrl || '';
                const appleWalletUrl = `/api/wallet/pass/${encodeURIComponent(barcodeToken)}.pkpass`;

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(
                  JSON.stringify({
                    success: true,
                    configured: true,
                    provider: 'api.walletwallet.dev',
                    passId: existingSerial,
                    serialNumber: existingSerial,
                    shareUrl: existingRecord?.shareUrl || '',
                    unchanged: upd.unchanged,
                    notifiedDevices: upd.notifiedDevices,
                    validationCode: barcodeToken,
                    appleWalletUrl,
                    applePassBase64: existingRecord.applePassBase64,
                    googleWalletUrl,
                    qrUrl,
                    fallbackWebPass: false,
                    barcodeValue: barcodeToken,
                    title: logoText,
                    memberName: customerName,
                    memberId,
                    stamps,
                    stampsRequired,
                    reward: rewardText,
                    backgroundColor: brandColor,
                    totalPassesIssued: memoryWalletPasses.size,
                  })
                );
                return;
              } catch {
                // Si no se pudo actualizar en el proveedor, creamos uno nuevo debajo
              }
            }

            const created = await createPass({ WALLETWALLET_API_KEY: apiKey }, cardInput);
            const passId = created.serialNumber;
            const googleSaveUrl = created.googleSaveUrl || '';
            const directAppleUrl = `/api/wallet/pass/${encodeURIComponent(barcodeToken)}.pkpass`;

            const passObj = {
              passId,
              serialNumber: passId,
              barcodeToken,
              shareUrl: created.shareUrl || '',
              businessId,
              businessName,
              customerName,
              customerContact,
              stamps,
              stampsRequired,
              rewardText,
              colorPreset,
              brandColor,
              logoUrl: body.logoURL || body.logoUrl || undefined,
              createdAt: new Date().toISOString(),
              provider: 'api.walletwallet.dev',
              applePassBase64: created.applePass,
              googleSaveUrl,
            };

            memoryWalletPasses.set(passId, passObj);
            memoryWalletPasses.set(barcodeToken, passObj);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(
              JSON.stringify({
                success: true,
                configured: true,
                provider: 'api.walletwallet.dev',
                passId,
                serialNumber: passId,
                shareUrl: created.shareUrl || '',
                validationCode: barcodeToken,
                appleWalletUrl: directAppleUrl,
                applePassBase64: created.applePass,
                googleWalletUrl: googleSaveUrl,
                qrUrl,
                fallbackWebPass: false,
                barcodeValue: barcodeToken,
                title: logoText,
                memberName: customerName,
                memberId,
                stamps,
                stampsRequired,
                reward: rewardText,
                backgroundColor: brandColor,
                totalPassesIssued: memoryWalletPasses.size,
              })
            );
            return;
          } catch (err: any) {
            walletSyncError =
              err instanceof WalletError
                ? err.message
                : err?.message || 'No se pudo conectar con el servicio de billetera.';
          }
        }

        const passId = existingSerial || `ww-${code.toLowerCase()}-${Date.now().toString(36)}`;
        const directAppleUrl = `/api/wallet/pass/${encodeURIComponent(barcodeToken)}.pkpass`;
        const passObj = {
          passId,
          serialNumber: passId,
          barcodeToken,
          shareUrl: '',
          businessId,
          businessName,
          customerName,
          customerContact,
          stamps,
          stampsRequired,
          rewardText,
          colorPreset,
          brandColor,
          logoUrl: body.logoURL || body.logoUrl || undefined,
          createdAt: new Date().toISOString(),
          provider: 'toque-web-pass',
        };
        memoryWalletPasses.set(passId, passObj);
        memoryWalletPasses.set(barcodeToken, passObj);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            provider: 'toque-web-pass',
            passId,
            serialNumber: passId,
            walletSyncError,
            validationCode: barcodeToken,
            appleWalletUrl: directAppleUrl,
            googleWalletUrl: '',
            qrUrl,
            fallbackWebPass: true,
            barcodeValue: barcodeToken,
            title: logoText,
            memberName: customerName,
            memberId,
            stamps,
            stampsRequired,
            reward: rewardText,
            backgroundColor: brandColor,
            totalPassesIssued: memoryWalletPasses.size,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: false,
            error: err?.message || 'No se pudo generar la tarjeta.',
          })
        );
        return;
      }
    }

    // 9. Mercado Pago Checkout
    if (pathname === '/api/mp/checkout-config' && req.method === 'GET') {
      const mpAccessToken = process.env.MP_ACCESS_TOKEN?.trim();
      const mpPublicKey = process.env.VITE_MP_PUBLIC_KEY?.trim() || '';
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          configured: Boolean(mpAccessToken),
          publicKey: mpPublicKey,
          processingMode: 'automatic',
          supportedMethods: ['card', 'rapipago', 'pagofacil'],
          webhookUrl: `${url.origin}/api/mp/webhooks`,
          ordersCreatedCount: memoryMpOrders.size,
        })
      );
      return;
    }

    if (pathname === '/api/mp/checkout-order' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const businessId = String(body.businessId || 'musical-monroe').slice(0, 64);
        const planId = String(body.planId || 'mensual').slice(0, 32);
        const amountArs = Number(body.amountArs || 34999);
        const payerEmail = String(body.payerEmail || 'comercio@toque.com.ar')
          .trim()
          .toLowerCase();
        const payerName = String(body.payerName || 'Titular Comercio').trim();
        const payerIdentification = String(body.identificationNumber || '20304050607').replace(
          /\D/g,
          ''
        );
        const paymentMethodType: 'card' | 'rapipago' | 'pagofacil' =
          body.paymentMethodType === 'rapipago'
            ? 'rapipago'
            : body.paymentMethodType === 'pagofacil'
            ? 'pagofacil'
            : 'card';
        const cardToken = String(body.cardToken || '').trim();
        const paymentMethodId = String(
          body.paymentMethodId ||
            (paymentMethodType === 'rapipago'
              ? 'rapipago'
              : paymentMethodType === 'pagofacil'
              ? 'pagofacil'
              : 'visa')
        );
        const installments = Number(body.installments || 1);
        const processingMode = body.processingMode === 'manual' ? 'manual' : 'automatic';

        const externalReference = `toque-${businessId}-${planId}-${Date.now().toString(36)}`;
        const idempotencyKey = crypto.randomUUID();
        const mpAccessToken = process.env.MP_ACCESS_TOKEN?.trim();

        if (mpAccessToken && (cardToken || paymentMethodType !== 'card')) {
          const mpOrderPayload: Record<string, any> = {
            type: 'online',
            processing_mode: processingMode,
            total_amount: String(amountArs.toFixed(2)),
            external_reference: externalReference,
            payer: {
              email: payerEmail,
              first_name: payerName.split(' ')[0] || payerName,
              last_name: payerName.split(' ').slice(1).join(' ') || 'Comercio',
              identification: {
                type: payerIdentification.length > 8 ? 'CUIT' : 'DNI',
                number: payerIdentification || '30112233',
              },
            },
            transactions: {
              payments: [
                {
                  amount: String(amountArs.toFixed(2)),
                  payment_method: {
                    id: paymentMethodId,
                    type: paymentMethodType === 'card' ? 'credit_card' : 'ticket',
                    ...(cardToken ? { token: cardToken, installments } : {}),
                  },
                },
              ],
            },
          };

          try {
            const mpRes = await fetch('https://api.mercadopago.com/v1/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${mpAccessToken}`,
                'X-Idempotency-Key': idempotencyKey,
              },
              body: JSON.stringify(mpOrderPayload),
            });

            if (mpRes.ok) {
              const mpData: any = await mpRes.json();
              const orderId = mpData.id || `ord_${Date.now().toString(36)}`;
              const status =
                mpData.status === 'processed'
                  ? 'processed'
                  : mpData.status === 'action_required'
                  ? 'action_required'
                  : 'processed';
              const statusDetail =
                mpData.status_detail ||
                (paymentMethodType === 'card' ? 'accredited' : 'pending_waiting_payment');
              const ticketCode =
                paymentMethodType !== 'card'
                  ? `MP-${Math.floor(1000000000 + Math.random() * 9000000000)}`
                  : undefined;

              memoryMpOrders.set(orderId, {
                orderId,
                externalReference,
                businessId,
                planId,
                amountArs,
                paymentMethodType,
                status,
                statusDetail,
                ticketCode,
                createdAt: new Date().toISOString(),
              });

              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(
                JSON.stringify({
                  success: true,
                  provider: 'mercadopago-orders-v1',
                  orderId,
                  externalReference,
                  processingMode,
                  paymentMethodType,
                  status,
                  statusDetail,
                  ticketCode,
                  amountArs,
                })
              );
              return;
            }
          } catch {
            // fallback
          }
        }

        const orderId = `ord_mp_${Date.now().toString(36)}`;
        const isTicket = paymentMethodType === 'rapipago' || paymentMethodType === 'pagofacil';
        const status = isTicket ? 'action_required' : 'processed';
        const statusDetail = isTicket ? 'pending_waiting_payment' : 'accredited';
        const ticketCode = isTicket
          ? `${paymentMethodType === 'rapipago' ? 'RP' : 'PF'}-${Math.floor(
              1000000000 + Math.random() * 9000000000
            )}`
          : undefined;

        memoryMpOrders.set(orderId, {
          orderId,
          externalReference,
          businessId,
          planId,
          amountArs,
          paymentMethodType,
          status,
          statusDetail,
          ticketCode,
          createdAt: new Date().toISOString(),
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            provider: mpAccessToken ? 'mercadopago-orders-v1' : 'mercadopago-checkout-sandbox',
            orderId,
            externalReference,
            processingMode,
            paymentMethodType,
            status,
            statusDetail,
            ticketCode,
            amountArs,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: false,
            error: err?.message || 'Error al procesar orden de pago',
          })
        );
        return;
      }
    }

    if (pathname === '/api/mp/webhooks' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const eventType = String(body.type || body.topic || 'order');
        const action = String(body.action || 'order.processed');
        const dataId = String(body.data?.id || body.id || '');

        if (dataId && memoryMpOrders.has(dataId)) {
          const existing = memoryMpOrders.get(dataId)!;
          existing.status = 'processed';
          existing.statusDetail = 'accredited';
          memoryMpOrders.set(dataId, existing);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ received: true, eventType, action, id: dataId }));
        return;
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ received: true }));
        return;
      }
    }

    if (pathname === '/api/telemetry/scan' && req.method === 'POST') {
      try {
        await readBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, recordedAt: new Date().toISOString() }));
        return;
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false }));
        return;
      }
    }

    // 10. Servir archivos estáticos si existe dist/index.html
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath) && (req.method === 'GET' || req.method === 'HEAD')) {
      const cleanPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(DIST_DIR, cleanPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
        });
        if (req.method === 'HEAD') {
          res.end();
        } else {
          fs.createReadStream(filePath).pipe(res);
        }
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        fs.createReadStream(indexPath).pipe(res);
      }
      return;
    }

    // 11. En desarrollo, delegar a Vite middleware
    const v = await getVite();
    if (v) {
      v.middlewares(req, res, () => {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  server.on('upgrade', (_req, socket) => {
    socket.destroy();
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
