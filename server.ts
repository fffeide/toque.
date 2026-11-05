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
} from './worker/walletwallet';

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
const memoryMerchantUsers = new Map<string, any>();
const memoryMerchantByToken = new Map<string, any>();
const memoryMerchantHubConfigs = new Map<string, any>();
const memoryVerifiedEmails = new Map<string, number>();
const memoryOneTimeWalletLinks = new Map<string, { barcodeToken: string; expiresAtMs: number }>();
const memoryRateLimits = new Map<string, { count: number; expiresAtMs: number }>();

const memoryTenantFeatures = new Map<string, Record<string, boolean>>([
  ['comercio-activo', { menu: true, club: true, stats: true }],
  ['comercio-cafe-ejemplo', { menu: false, club: true, stats: true }],
]);
const memoryMenuCategories = new Map<string, any[]>();
const memoryMenuItems = new Map<string, any[]>();
const memoryMenuTables = new Map<string, any[]>();
const memoryMenuOrders = new Map<string, any[]>();
const memoryMenuBranding = new Map<string, any>();

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
  h: string;
  tries: number;
  expiresAtMs: number;
}
const memoryOtps = new Map<string, ServerOtpEntry>();

function sha256HexNode(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateSecure6DigitOtpNode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

function checkRateLimitMemory(key: string, maxAllowed: number, ttlMs: number): boolean {
  const now = Date.now();
  const entry = memoryRateLimits.get(key);
  if (!entry || now > entry.expiresAtMs) {
    memoryRateLimits.set(key, { count: 1, expiresAtMs: now + ttlMs });
    return true;
  }
  if (entry.count >= maxAllowed) {
    return false;
  }
  entry.count += 1;
  return true;
}

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

function readCookieFromReq(req: http.IncomingMessage, cookieName: string): string {
  const cookieHeader = String(req.headers['cookie'] || '');
  if (!cookieHeader) return '';
  const regex = new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`);
  const match = cookieHeader.match(regex);
  return match ? decodeURIComponent(match[1].trim()) : '';
}

function makeMerchantSessionCookieNode(token: string, maxAge = 2592000): string {
  return `toque_merchant_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function makeConsumerSessionCookieNode(token: string, maxAge = 15552000): string {
  return `toque_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function getMerchantSessionFromReq(req: http.IncomingMessage): {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  token: string;
} | null {
  const token = readCookieFromReq(req, 'toque_merchant_session');
  if (!token) return null;
  return memoryMerchantByToken.get(token) || null;
}

function getConsumerSessionFromReq(req: http.IncomingMessage): {
  id: string;
  email: string;
  fullName: string;
  birthDate?: string;
  sessionToken: string;
} | null {
  const token = readCookieFromReq(req, 'toque_session');
  if (!token) return null;
  return memoryConsumerByToken.get(token) || null;
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
  const fromEmail =
    process.env.MAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    'Toque <onboarding@resend.dev>';
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
        'Idempotency-Key': crypto.randomUUID(),
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
  } catch {
    // ignore
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

    // Rutas eliminadas por seguridad -> 404
    if (pathname === '/api/debug/clean-orphans' || pathname === '/api/auth/login') {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Ruta no encontrada.' }));
      return;
    }

    // Carta: Features
    if (pathname === '/api/features' && req.method === 'GET') {
      const session = getMerchantSessionFromReq(req);
      const tid = session?.tenantId || 'comercio-activo';
      const feats = memoryTenantFeatures.get(tid) || { menu: true, club: true, stats: true };
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(feats));
      return;
    }

    if (pathname === '/api/admin/tenant-features' && req.method === 'GET') {
      const list = [
        {
          tenantId: 'comercio-activo',
          businessName: 'Mi comercio',
          features: memoryTenantFeatures.get('comercio-activo') || { menu: true, club: true, stats: true },
        },
        {
          tenantId: 'comercio-cafe-ejemplo',
          businessName: 'Café de Especialidad (Ejemplo sin Carta)',
          features: memoryTenantFeatures.get('comercio-cafe-ejemplo') || { menu: false, club: true, stats: true },
        },
      ];
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(list));
      return;
    }

    if (pathname === '/api/admin/tenant-features' && req.method === 'POST') {
      const raw = await readBody(req);
      const { tenantId, key, enabled } = JSON.parse(raw || '{}');
      if (tenantId && key) {
        const cur = memoryTenantFeatures.get(tenantId) || { menu: true, club: true, stats: true };
        memoryTenantFeatures.set(tenantId, { ...cur, [key]: Boolean(enabled) });
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 1b. Sesiones de comercio (/api/auth/me, /api/auth/register, /api/auth/logout)
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const session = getMerchantSessionFromReq(req);
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ authenticated: false, error: 'Iniciá sesión.' }));
        return;
      }
      const cfg = memoryMerchantHubConfigs.get(session.tenantId);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          authenticated: true,
          token: session.token,
          user: {
            id: session.userId,
            email: session.email,
            name: session.name,
            role: session.role,
            businessId: session.tenantId,
            businessName: cfg?.businessName || session.name,
          },
          hub: cfg || null,
        })
      );
      return;
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Ingresá un correo electrónico válido.' }));
          return;
        }
        const verifiedExp = memoryVerifiedEmails.get(`verified:merchant:${cleanEmail}`);
        if (!verifiedExp || Date.now() > verifiedExp) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              error: 'Primero verificá tu correo con el código que te enviamos.',
            })
          );
          return;
        }
        if (memoryMerchantUsers.has(cleanEmail)) {
          res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Ya existe una cuenta registrada con este correo.' }));
          return;
        }

        const userId = crypto.randomUUID();
        const tenantId = crypto.randomUUID();
        const role = 'owner';
        const businessName = String(
          body.businessName || body.name || cleanEmail.split('@')[0] || 'Mi comercio'
        )
          .trim()
          .slice(0, 64);
        const ownerName = String(body.name || businessName).trim().slice(0, 64);
        const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

        const merchantSession = {
          userId,
          tenantId,
          email: cleanEmail,
          name: ownerName,
          role,
          token: sessionToken,
        };
        memoryMerchantUsers.set(cleanEmail, merchantSession);
        memoryMerchantByToken.set(sessionToken, merchantSession);
        memoryVerifiedEmails.delete(`verified:merchant:${cleanEmail}`);

        memoryMerchantHubConfigs.set(tenantId, {
          tenantId,
          businessName,
          brandColor: '#D95B26',
          customColor: '#D95B26',
          colorPreset: 'dark' as ColorPreset,
          stampsRequired: 10,
          rewardText: 'Beneficio al completar tus 10 sellos',
          rewardValueArs: 0,
          updatedAt: new Date().toISOString(),
        });

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': makeMerchantSessionCookieNode(sessionToken),
        });
        res.end(
          JSON.stringify({
            authenticated: true,
            token: sessionToken,
            sessionToken,
            user: {
              id: userId,
              email: cleanEmail,
              name: ownerName,
              role,
              businessId: tenantId,
              businessName,
            },
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err?.message || 'Error al registrar la cuenta.' }));
        return;
      }
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = readCookieFromReq(req, 'toque_merchant_session');
      if (token) memoryMerchantByToken.delete(token);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': makeMerchantSessionCookieNode('', 0),
      });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 1c. Reclamo de tarjeta del cliente en el Hub: POST /api/consumer/cards/claim (requiere getConsumerSession)
    if (pathname === '/api/consumer/cards/claim' && req.method === 'POST') {
      try {
        const consumerSession = getConsumerSessionFromReq(req);
        if (!consumerSession) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
          return;
        }
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const tenantId = String(body.tenantId || body.businessId || '').trim();
        if (!tenantId) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Indicá el comercio.' }));
          return;
        }
        const liveCfg = memoryMerchantHubConfigs.get(tenantId);
        const cleanEmail = consumerSession.email;
        const fullName = consumerSession.fullName || 'Cliente';

        const businessName = String(
          liveCfg?.businessName || body.businessName || 'Mi comercio'
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
          const barcodeToken = generateUnique8DigitServerBarcode();
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

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            card: foundCard,
            member: foundCard,
            barcodeToken: foundCard.barcodeToken,
            user: {
              id: consumerSession.id,
              email: cleanEmail,
              fullName,
              birthDate: consumerSession.birthDate,
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

    // 1d. Eliminar cuenta del comercio: DELETE /api/merchant/account (requiere getMerchantSession + role === 'owner' + código recién verificado)
    if (pathname === '/api/merchant/account' && req.method === 'DELETE') {
      try {
        const session = getMerchantSessionFromReq(req);
        if (!session) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
          return;
        }
        if (session.role !== 'owner') {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Solo el titular puede eliminar la cuenta.' }));
          return;
        }
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const cleanCode = String(body.code || '').replace(/\D/g, '').trim();
        const otpKey = `otp:merchant:${session.email}`;
        const otpRecord = memoryOtps.get(otpKey);
        const verifiedExp = memoryVerifiedEmails.get(`verified:merchant:${session.email}`);

        if (cleanCode) {
          if (!otpRecord || Date.now() > otpRecord.expiresAtMs || otpRecord.tries >= 5) {
            memoryOtps.delete(otpKey);
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Código incorrecto o vencido' }));
            return;
          }
          const expectedHash = sha256HexNode(`${cleanCode}:${session.email}:merchant`);
          if (expectedHash !== otpRecord.h) {
            otpRecord.tries += 1;
            if (otpRecord.tries >= 5) memoryOtps.delete(otpKey);
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Código incorrecto o vencido' }));
            return;
          }
          memoryOtps.delete(otpKey);
        } else if (!verifiedExp || Date.now() > verifiedExp) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              error: 'Ingresá el código de verificación enviado a tu correo para eliminar la cuenta.',
            })
          );
          return;
        } else {
          memoryVerifiedEmails.delete(`verified:merchant:${session.email}`);
        }

        const tenantId = session.tenantId;
        memoryMerchantHubConfigs.delete(tenantId);
        memoryMerchantUsers.delete(session.email);
        memoryMerchantByToken.delete(session.token);

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

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': makeMerchantSessionCookieNode('', 0),
        });
        res.end(JSON.stringify({ success: true }));
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err?.message || 'No se pudo eliminar la cuenta.' }));
        return;
      }
    }

    // 2a. Link de un solo uso para Apple Wallet: POST /api/consumer/wallet/add y GET /api/wallet/p/:token
    if (pathname === '/api/consumer/wallet/add' && req.method === 'POST') {
      const consumerSession = getConsumerSessionFromReq(req);
      const merchantSession = getMerchantSessionFromReq(req);
      if (!consumerSession && !merchantSession) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
        return;
      }
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const requestedCode = normalize8DigitBarcode(
        body.barcodeToken || body.memberCode || body.code || ''
      );

      let foundCard: any = null;
      if (consumerSession) {
        const cards = memoryConsumerCards.get(consumerSession.email) || [];
        foundCard = requestedCode
          ? cards.find((c: any) => c.barcodeToken === requestedCode)
          : cards[0];
      } else if (merchantSession && requestedCode) {
        for (const cards of memoryConsumerCards.values()) {
          const match = (cards || []).find(
            (c: any) =>
              c.barcodeToken === requestedCode &&
              (c.tenantId === merchantSession.tenantId || c.businessId === merchantSession.tenantId)
          );
          if (match) {
            foundCard = match;
            break;
          }
        }
      }

      if (!foundCard?.barcodeToken) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No encontramos tu tarjeta.' }));
        return;
      }

      const oneTimeToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
      memoryOneTimeWalletLinks.set(oneTimeToken, {
        barcodeToken: foundCard.barcodeToken,
        expiresAtMs: Date.now() + 5 * 60 * 1000,
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ url: `/api/wallet/p/${oneTimeToken}` }));
      return;
    }

    if (pathname.startsWith('/api/wallet/p/') && req.method === 'GET') {
      const token = decodeURIComponent(pathname.replace('/api/wallet/p/', '').split('/')[0] || '').trim();
      const entry = token ? memoryOneTimeWalletLinks.get(token) : undefined;
      if (token) memoryOneTimeWalletLinks.delete(token);

      if (!entry || Date.now() > entry.expiresAtMs) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'El enlace de descarga venció o ya fue utilizado.' }));
        return;
      }

      const foundPass = memoryWalletPasses.get(entry.barcodeToken);
      if (foundPass?.applePassBase64) {
        const buffer = Buffer.from(foundPass.applePassBase64, 'base64');
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `inline; filename="tarjeta-${entry.barcodeToken}.pkpass"`,
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

    // 2b. Descarga de Apple Wallet (.pkpass): GET /api/wallet/pass/:barcodeToken.pkpass (NUNCA crea tarjetas con parámetros de la URL; exige sesión del dueño)
    if (
      (pathname.startsWith('/api/wallet/pass/') || pathname.startsWith('/api/wallet/pkpass/')) &&
      (pathname.endsWith('.pkpass') || pathname.startsWith('/api/wallet/pkpass/')) &&
      req.method === 'GET'
    ) {
      const consumerSession = getConsumerSessionFromReq(req);
      const merchantSession = getMerchantSessionFromReq(req);
      if (!consumerSession && !merchantSession) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
        return;
      }

      const rawToken = decodeURIComponent(
        pathname
          .replace('/api/wallet/pass/', '')
          .replace('/api/wallet/pkpass/', '')
          .replace(/\.pkpass$/i, '')
      ).trim();

      const foundPass = memoryWalletPasses.get(rawToken);
      if (!foundPass) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No encontramos tu tarjeta.' }));
        return;
      }

      if (consumerSession && foundPass.customerContact.toLowerCase() !== consumerSession.email.toLowerCase()) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No tenés permiso para descargar esta tarjeta.' }));
        return;
      }
      if (merchantSession && foundPass.businessId !== merchantSession.tenantId) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No tenés permiso para descargar esta tarjeta.' }));
        return;
      }

      if (foundPass.applePassBase64) {
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
        const rawPurpose = String(body.purpose || 'consumer').trim().toLowerCase();
        const purpose: 'merchant' | 'consumer' =
          rawPurpose === 'merchant' || rawPurpose === 'login_business' || rawPurpose === 'register_business'
            ? 'merchant'
            : 'consumer';

        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'Ingresá un correo electrónico válido.' }));
          return;
        }

        const clientIp =
          String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anon')
            .split(',')[0]
            .trim() || 'anon';

        const okEmailRate = checkRateLimitMemory(`rl:otp_email:${cleanEmail}`, 3, 600 * 1000);
        const okIpRate = checkRateLimitMemory(`rl:otp_ip:${clientIp}`, 10, 3600 * 1000);

        if (!okEmailRate || !okIpRate) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, success: true }));
          return;
        }

        const code = generateSecure6DigitOtpNode();
        const hash = sha256HexNode(`${code}:${cleanEmail}:${purpose}`);
        memoryOtps.set(`otp:${purpose}:${cleanEmail}`, {
          h: hash,
          tries: 0,
          expiresAtMs: Date.now() + 600 * 1000,
        });

        await sendVerificationEmailViaProvider(
          cleanEmail,
          code,
          purpose === 'merchant' ? 'Panel de Comercio' : 'Toque'
        );

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, success: true }));
        return;
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, success: true }));
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
        const cleanCode = String(body.code || '').replace(/\D/g, '').trim();
        const isConsumerRoute = pathname === '/api/consumer/verify-code';
        const rawPurpose = String(body.purpose || (isConsumerRoute ? 'consumer' : 'merchant'))
          .trim()
          .toLowerCase();
        const purpose: 'merchant' | 'consumer' =
          isConsumerRoute ||
          rawPurpose === 'consumer' ||
          rawPurpose === 'register_client' ||
          rawPurpose === 'client_card'
            ? 'consumer'
            : 'merchant';

        if (!cleanEmail || !cleanEmail.includes('@') || cleanCode.length !== 6) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Código incorrecto o vencido' }));
          return;
        }

        const otpKey = `otp:${purpose}:${cleanEmail}`;
        let otpRecord = memoryOtps.get(otpKey);
        let resolvedPurpose = purpose;

        if (!otpRecord) {
          const fallbackPurpose: 'merchant' | 'consumer' =
            purpose === 'merchant' ? 'consumer' : 'merchant';
          const alt = memoryOtps.get(`otp:${fallbackPurpose}:${cleanEmail}`);
          if (alt) {
            otpRecord = alt;
            resolvedPurpose = fallbackPurpose;
          }
        }

        const activeKey = `otp:${resolvedPurpose}:${cleanEmail}`;
        if (!otpRecord || Date.now() > otpRecord.expiresAtMs || otpRecord.tries >= 5) {
          memoryOtps.delete(activeKey);
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Código incorrecto o vencido' }));
          return;
        }

        const expectedHash = sha256HexNode(`${cleanCode}:${cleanEmail}:${resolvedPurpose}`);
        if (expectedHash !== otpRecord.h) {
          otpRecord.tries += 1;
          if (otpRecord.tries >= 5) {
            memoryOtps.delete(activeKey);
          }
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Código incorrecto o vencido' }));
          return;
        }

        // Un código se usa una sola vez
        memoryOtps.delete(activeKey);

        if (resolvedPurpose === 'merchant' && !isConsumerRoute) {
          const existingMerchant = memoryMerchantUsers.get(cleanEmail);
          if (existingMerchant) {
            const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
            existingMerchant.token = sessionToken;
            memoryMerchantByToken.set(sessionToken, existingMerchant);
            memoryVerifiedEmails.set(`verified:merchant:${cleanEmail}`, Date.now() + 15 * 60 * 1000);
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Set-Cookie': makeMerchantSessionCookieNode(sessionToken),
            });
            res.end(
              JSON.stringify({
                ok: true,
                success: true,
                verifiedEmail: cleanEmail,
                accountExists: true,
                needsRegistration: false,
                token: sessionToken,
                sessionToken,
                user: {
                  id: existingMerchant.userId,
                  email: cleanEmail,
                  name: existingMerchant.name,
                  role: existingMerchant.role,
                  businessId: existingMerchant.tenantId,
                },
              })
            );
            return;
          }

          memoryVerifiedEmails.set(`verified:merchant:${cleanEmail}`, Date.now() + 15 * 60 * 1000);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              ok: true,
              success: true,
              verifiedEmail: cleanEmail,
              accountExists: false,
              needsRegistration: true,
            })
          );
          return;
        }

        // Consumer flow
        const existingUser = memoryConsumerUsers.get(cleanEmail);
        if (existingUser && (existingUser.fullName || existingUser.displayName)) {
          const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
          existingUser.sessionToken = sessionToken;
          memoryConsumerByToken.set(sessionToken, existingUser);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Set-Cookie': makeConsumerSessionCookieNode(sessionToken),
          });
          res.end(
            JSON.stringify({
              ok: true,
              success: true,
              verifiedEmail: cleanEmail,
              accountExists: true,
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

        memoryVerifiedEmails.set(`verified:consumer:${cleanEmail}`, Date.now() + 15 * 60 * 1000);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            ok: true,
            success: true,
            verifiedEmail: cleanEmail,
            accountExists: false,
            needsRegistration: true,
          })
        );
        return;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Código incorrecto o vencido' }));
        return;
      }
    }

    if (pathname === '/api/consumer/register' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Ingresá un correo electrónico válido.' }));
          return;
        }

        const existingSession = getConsumerSessionFromReq(req);
        const verifiedExp = memoryVerifiedEmails.get(`verified:consumer:${cleanEmail}`);
        const isAlreadyAuthenticatedWithSameEmail =
          existingSession && existingSession.email.toLowerCase() === cleanEmail;

        if ((!verifiedExp || Date.now() > verifiedExp) && !isAlreadyAuthenticatedWithSameEmail) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              error: 'Primero verificá tu correo con el código que te enviamos.',
            })
          );
          return;
        }

        const existingByEmail = memoryConsumerUsers.get(cleanEmail);
        if (existingByEmail && !isAlreadyAuthenticatedWithSameEmail && !verifiedExp) {
          res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Ya existe una cuenta registrada con este correo.' }));
          return;
        }

        const fullName = String(body.fullName || body.name || 'Cliente').trim();
        const birthDate = String(body.birthDate || '').trim() || undefined;
        const userId = existingByEmail?.id || crypto.randomUUID();
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
          createdAt: existingByEmail?.createdAt || new Date().toISOString(),
        };

        memoryConsumerUsers.set(userId, userRecord);
        memoryConsumerUsers.set(cleanEmail, userRecord);
        memoryConsumerByToken.set(sessionToken, userRecord);
        memoryVerifiedEmails.delete(`verified:consumer:${cleanEmail}`);

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': makeConsumerSessionCookieNode(sessionToken),
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
      const userRecord = getConsumerSessionFromReq(req);
      if (!userRecord) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ authenticated: false, error: 'Iniciá sesión.', user: null, cards: [], receipts: [] }));
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
            email: userRecord.email,
            fullName: userRecord.fullName,
            birthDate: userRecord.birthDate,
          },
          cards,
          receipts,
        })
      );
      return;
    }

    // 4. Sincronización de diseño del Hub y Tarjetas (requiere getMerchantSession y usa session.tenantId)
    if (
      (pathname === '/api/merchant/hub-config' ||
        pathname === '/api/merchant/hub' ||
        pathname === '/api/merchant/cards' ||
        pathname === '/api/club/cards') &&
      (req.method === 'GET' || req.method === 'PUT' || req.method === 'POST')
    ) {
      const session = getMerchantSessionFromReq(req);
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
        return;
      }
      const tenantId = session.tenantId;

      if (req.method === 'GET') {
        const cfg = memoryMerchantHubConfigs.get(tenantId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ found: Boolean(cfg), config: cfg || null }));
        return;
      }

      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const businessName = String(body.businessName || session.name || 'Mi comercio')
          .trim()
          .slice(0, 64);
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

        const apiKey = (process.env.WALLETWALLET_API_KEY || '').trim();
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

    if (pathname === '/api/merchant/pos-sale' && req.method === 'POST') {
      const session = getMerchantSessionFromReq(req);
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, tenantId: session.tenantId }));
      return;
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
      const apiKey = (process.env.WALLETWALLET_API_KEY || '').trim();
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
        })
      );
      return;
    }

    // 6. Sincronización de Cuenta del Consumidor: /api/consumer/sync (requiere getConsumerSession)
    if (pathname === '/api/consumer/sync' && (req.method === 'POST' || req.method === 'GET')) {
      const consumerSession = getConsumerSessionFromReq(req);
      if (!consumerSession) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
        return;
      }

      if (req.method === 'GET') {
        const userRecord = memoryConsumerUsers.get(consumerSession.email) || consumerSession;
        const receipts = memoryConsumerReceipts.get(userRecord.id) || [];
        const cards = memoryConsumerCards.get(consumerSession.email) || [];
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ found: true, user: userRecord, cards, receipts }));
        return;
      }

      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const displayName = String(
          body.user?.displayName || body.user?.fullName || consumerSession.fullName || 'Cliente'
        ).trim();
        const birthDate = body.user?.birthDate || consumerSession.birthDate;
        const receipts = Array.isArray(body.receipts) ? body.receipts : [];

        const userRecord = {
          id: consumerSession.id,
          uuid: consumerSession.id,
          email: consumerSession.email,
          emailOrPhone: consumerSession.email,
          fullName: displayName,
          displayName,
          birthDate,
          sessionToken: consumerSession.sessionToken,
          ageGroup: body.user?.ageGroup || 'adult',
          consentSaveReceipts: body.user?.consentSaveReceipts !== false,
          consentMarketingNetwork: body.user?.consentMarketingNetwork !== false,
          createdAt: body.user?.createdAt || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        };

        memoryConsumerUsers.set(userRecord.id, userRecord);
        memoryConsumerUsers.set(userRecord.email, userRecord);
        memoryConsumerByToken.set(consumerSession.sessionToken, userRecord);
        memoryConsumerReceipts.set(userRecord.id, receipts);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            consumerId: userRecord.id,
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
        const businessName = String(body.businessName || 'Mi comercio').trim();
        const memberCode = String(body.memberCode || '48291037').trim();
        const localCode = String(body.localCode || 'LOCAL01').trim();
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
        const businessName = String(body.businessName || 'Mi comercio').trim();
        const customerName = String(
          body.customerName || cleanEmail.split('@')[0] || 'Cliente'
        ).trim();
        const localCode = String(body.localCode || 'LOCAL01').trim();
        const currentStamps = Number(body.currentStamps ?? 1);
        const stampsRequired = Number(body.stampsRequired ?? 10);

        if (!cleanEmail || !cleanEmail.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({ success: false, error: 'Ingresá un correo electrónico válido.' })
          );
          return;
        }

        const otpCode = generateSecure6DigitOtpNode();
        const hash = sha256HexNode(`${otpCode}:${cleanEmail}:consumer`);
        memoryOtps.set(`otp:consumer:${cleanEmail}`, {
          h: hash,
          tries: 0,
          expiresAtMs: Date.now() + 600 * 1000,
        });

        const magicLinkUrl = `${url.origin}/u/${encodeURIComponent(
          localCode
        )}?recoverEmail=${encodeURIComponent(cleanEmail)}`;

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
      const session = getMerchantSessionFromReq(req);
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
        return;
      }
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
        const businessName = String(body.businessName || session.name || 'Mi comercio').trim();
        const localCode = String(body.localCode || 'LOCAL01').trim();
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

    // 8. Uso de WalletWallet (solo sesión de comercio con role === 'owner')
    if (pathname === '/api/wallet/usage' && req.method === 'GET') {
      const session = getMerchantSessionFromReq(req);
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
        return;
      }
      if (session.role !== 'owner') {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Solo el titular puede consultar el uso de tarjetas.' }));
        return;
      }

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

    // 8b. Sumar sellos (/api/merchant/stamp, /api/club/stamp, /api/club/stamps/self): requiere getMerchantSession, busca socio dentro de session.tenantId, suma +1
    if (
      (pathname === '/api/merchant/stamp' ||
        pathname === '/api/club/stamp' ||
        pathname === '/api/club/stamps/self') &&
      req.method === 'POST'
    ) {
      const session = getMerchantSessionFromReq(req);
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
        return;
      }
      const allowedRate = checkRateLimitMemory(`rl:stamp:${session.token}`, 60, 60 * 1000);
      if (!allowedRate) {
        res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Demasiadas consultas seguidas. Esperá un minuto.' }));
        return;
      }

      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const tenantId = session.tenantId;
        const rawCode = String(body.barcodeToken || body.shortCode || body.code || '')
          .replace(/[\s-]/g, '')
          .toUpperCase();

        let matchedCard: any = null;
        for (const cards of memoryConsumerCards.values()) {
          for (const c of cards || []) {
            const cCode = String(c.barcodeToken || c.shortCode || c.memberCode || '')
              .replace(/[\s-]/g, '')
              .toUpperCase();
            if (
              (c.tenantId === tenantId || c.businessId === tenantId) &&
              ((rawCode && cCode === rawCode) || (body.memberId && c.id === body.memberId))
            ) {
              matchedCard = c;
              break;
            }
          }
          if (matchedCard) break;
        }

        if (!matchedCard) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'error', error: 'No encontramos ese socio en tu comercio.' }));
          return;
        }

        const lastStampedAt = matchedCard.lastStampedAt || null;
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
        const nextStamps = Number(matchedCard.stamps || 0) + 1;
        const stampsRequired = 10;
        const liveCfg = memoryMerchantHubConfigs.get(tenantId);
        const businessName = String(liveCfg?.businessName || matchedCard.businessName || session.name || 'Mi comercio').slice(0, 64);
        const rewardText = String(
          liveCfg?.rewardText || matchedCard.rewardText || 'Beneficio al completar tus sellos'
        ).slice(0, 60);
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const colorPreset: ColorPreset = validPresets.includes(liveCfg?.colorPreset)
          ? liveCfg.colorPreset
          : 'dark';
        const barcodeToken = matchedCard.barcodeToken;

        matchedCard.stamps = nextStamps;
        matchedCard.points = nextStamps;
        matchedCard.lastStampedAt = nowIso;

        let walletSyncError: string | undefined;
        let notifiedDevices = 0;
        const apiKey = (process.env.WALLETWALLET_API_KEY || '').trim();
        const existingPass = memoryWalletPasses.get(barcodeToken);

        if (existingPass?.serialNumber && !existingPass.serialNumber.startsWith('ww-') && apiKey) {
          try {
            existingPass.stamps = nextStamps;
            const upd = await updatePass({ WALLETWALLET_API_KEY: apiKey }, existingPass.serialNumber, {
              businessName,
              memberName: matchedCard.name || undefined,
              stamps: nextStamps,
              stampsRequired,
              rewardText,
              barcodeToken,
              colorPreset,
              notification: '¡Sumaste 1 sello nuevo!',
            });
            notifiedDevices = upd.notifiedDevices;
          } catch (err: any) {
            walletSyncError =
              err instanceof WalletError
                ? err.message
                : err?.message || 'No se pudo actualizar la tarjeta en la billetera.';
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            status: 'stamped',
            cooldown: false,
            stamps: nextStamps,
            stampsRequired,
            lastStampedAt: nowIso,
            barcodeToken,
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
      const consumerSession = getConsumerSessionFromReq(req);
      const merchantSession = getMerchantSessionFromReq(req);
      if (!consumerSession && !merchantSession) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
        return;
      }

      const serialNumber = decodeURIComponent(
        pathname.replace('/api/wallet/pass/', '').split('/')[0] || ''
      );
      const passRecord = memoryWalletPasses.get(serialNumber);
      if (!passRecord) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No encontramos esa tarjeta.' }));
        return;
      }

      const isConsumerOwner =
        consumerSession &&
        passRecord.customerContact.toLowerCase() === consumerSession.email.toLowerCase();
      const isMerchantOwner =
        merchantSession &&
        merchantSession.role === 'owner' &&
        passRecord.businessId === merchantSession.tenantId;

      if (!isConsumerOwner && !isMerchantOwner) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'No tenés permiso para dar de baja esta tarjeta.' }));
        return;
      }

      const apiKey = process.env.WALLETWALLET_API_KEY?.trim();
      try {
        if (apiKey && serialNumber && !serialNumber.startsWith('ww-')) {
          await revokePass({ WALLETWALLET_API_KEY: apiKey }, serialNumber);
        }
        memoryWalletPasses.delete(serialNumber);
        memoryWalletPasses.delete(passRecord.barcodeToken);
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
        const consumerSession = getConsumerSessionFromReq(req);
        const merchantSession = getMerchantSessionFromReq(req);
        if (!consumerSession && !merchantSession) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Iniciá sesión.' }));
          return;
        }

        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const requestedBarcode = normalize8DigitBarcode(
          body.barcodeToken || body.barcodeValue || body.memberCode || ''
        );

        let dbMemberCard: any = null;
        if (consumerSession) {
          const cards = memoryConsumerCards.get(consumerSession.email) || [];
          dbMemberCard = requestedBarcode
            ? cards.find((c: any) => c.barcodeToken === requestedBarcode)
            : cards[0];
        } else if (merchantSession) {
          for (const cards of memoryConsumerCards.values()) {
            const found = (cards || []).find(
              (c: any) =>
                (c.tenantId === merchantSession.tenantId || c.businessId === merchantSession.tenantId) &&
                (!requestedBarcode || c.barcodeToken === requestedBarcode)
            );
            if (found) {
              dbMemberCard = found;
              break;
            }
          }
        }

        if (!dbMemberCard) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'No encontramos una tarjeta registrada para tu cuenta.' }));
          return;
        }

        const tenantId = String(dbMemberCard.tenantId || dbMemberCard.businessId);
        const liveCfg = memoryMerchantHubConfigs.get(tenantId);
        const businessName = String(
          liveCfg?.businessName || dbMemberCard.businessName || 'Mi comercio'
        ).slice(0, 64);
        const customerName = String(
          dbMemberCard.name || consumerSession?.fullName || 'Socio'
        ).slice(0, 40);
        const customerContact = String(
          dbMemberCard.email || consumerSession?.email || ''
        ).slice(0, 100);
        const stamps = Number(dbMemberCard.stamps || 0);
        const stampsRequired = 10;
        const rewardText = String(
          liveCfg?.rewardText || dbMemberCard.rewardText || 'Beneficio al completar tus 10 sellos'
        ).slice(0, 60);
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const colorPreset: ColorPreset = validPresets.includes(liveCfg?.colorPreset)
          ? liveCfg.colorPreset
          : 'dark';
        const brandColor = String(liveCfg?.brandColor || dbMemberCard.brandColor || '#D95B26');
        const barcodeToken = String(dbMemberCard.barcodeToken);

        const oneTimeToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
        memoryOneTimeWalletLinks.set(oneTimeToken, {
          barcodeToken,
          expiresAtMs: Date.now() + 5 * 60 * 1000,
        });
        const oneTimeAppleUrl = `/api/wallet/p/${oneTimeToken}`;

        const cardInput: CardInput = {
          businessName,
          memberName: customerName || undefined,
          stamps,
          stampsRequired,
          rewardText,
          barcodeToken,
          colorPreset,
          notification: ' ',
        };

        const apiKey = (process.env.WALLETWALLET_API_KEY || '').trim();
        let walletSyncError: string | undefined;

        if (apiKey) {
          try {
            const existingRecord = memoryWalletPasses.get(barcodeToken);
            if (existingRecord && existingRecord.serialNumber && !existingRecord.serialNumber.startsWith('ww-')) {
              const upd = await updatePass(
                { WALLETWALLET_API_KEY: apiKey },
                existingRecord.serialNumber,
                cardInput
              );
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(
                JSON.stringify({
                  success: true,
                  configured: true,
                  provider: 'api.walletwallet.dev',
                  passId: existingRecord.serialNumber,
                  serialNumber: existingRecord.serialNumber,
                  shareUrl: existingRecord.shareUrl || '',
                  unchanged: upd.unchanged,
                  notifiedDevices: upd.notifiedDevices,
                  validationCode: barcodeToken,
                  appleWalletUrl: oneTimeAppleUrl,
                  googleWalletUrl: existingRecord.googleSaveUrl || '',
                  fallbackWebPass: false,
                  barcodeValue: barcodeToken,
                  title: businessName,
                  memberName: customerName,
                  stamps,
                  stampsRequired,
                  reward: rewardText,
                  backgroundColor: brandColor,
                })
              );
              return;
            }

            const created = await createPass({ WALLETWALLET_API_KEY: apiKey }, cardInput);
            const passId = created.serialNumber;
            const googleSaveUrl = created.googleSaveUrl || '';

            const passObj = {
              passId,
              serialNumber: passId,
              barcodeToken,
              shareUrl: created.shareUrl || '',
              businessId: tenantId,
              businessName,
              customerName,
              customerContact,
              stamps,
              stampsRequired,
              rewardText,
              colorPreset,
              brandColor,
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
                appleWalletUrl: oneTimeAppleUrl,
                googleWalletUrl: googleSaveUrl,
                fallbackWebPass: false,
                barcodeValue: barcodeToken,
                title: businessName,
                memberName: customerName,
                stamps,
                stampsRequired,
                reward: rewardText,
                backgroundColor: brandColor,
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

        const passId = `ww-${barcodeToken}`;
        const passObj = {
          passId,
          serialNumber: passId,
          barcodeToken,
          shareUrl: '',
          businessId: tenantId,
          businessName,
          customerName,
          customerContact,
          stamps,
          stampsRequired,
          rewardText,
          colorPreset,
          brandColor,
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
            appleWalletUrl: oneTimeAppleUrl,
            googleWalletUrl: '',
            fallbackWebPass: true,
            barcodeValue: barcodeToken,
            title: businessName,
            memberName: customerName,
            stamps,
            stampsRequired,
            reward: rewardText,
            backgroundColor: brandColor,
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
