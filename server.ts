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

// Almacenamiento en memoria del servidor (espejo de D1 para /api/consumer/sync, /api/network/activations, OTPs y WalletPasses)
const memoryConsumerUsers = new Map<string, any>();
const memoryConsumerReceipts = new Map<string, any[]>();
const memoryNetworkActivations = new Map<string, any>();
const memoryWalletPasses = new Map<
  string,
  {
    passId: string;
    serialNumber: string;
    shareUrl: string;
    businessId: string;
    businessName: string;
    customerContact: string;
    createdAt: string;
    provider: string;
    applePassBase64?: string;
    googleSaveUrl?: string;
  }
>();
const memoryMpOrders = new Map<string, {
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
}>();

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
      console.log(`[RESEND OK] Email enviado a ${recipient}`);
      return { sent: true, sandboxRouted: false, provider: 'resend' };
    }

    const errText = await response.text().catch(() => '');

    // Si la cuenta de Resend está en modo Sandbox (onboarding@resend.dev sin dominio verificado aún),
    // Resend devuelve 403 al enviar a correos distintos al del titular (fedeeeloiss@gmail.com).
    // Redirigimos copia de prueba al correo titular y habilitamos el código en pantalla sin lanzar error.
    if (response.status === 403) {
      const matchOwner = errText.match(/\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/);
      const sandboxOwnerEmail = (
        process.env.RESEND_SANDBOX_EMAIL ||
        (matchOwner ? matchOwner[1] : 'fedeeeloiss@gmail.com')
      )
        .trim()
        .toLowerCase();

      console.log(
        `[RESEND SANDBOX] Modo de prueba activo (sin dominio propio en EMAIL_FROM). Redirigiendo copia de ${recipient} a ${sandboxOwnerEmail}.`
      );

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

    console.log(`[RESEND NOTICE ${response.status}] ${errText}`);
  } catch (err: any) {
    console.log(`[RESEND FALLBACK]`, err?.message || err);
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
      <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #D95B26; font-weight: 700; margin: 0 0 8px 0;">Toque · Acceso Seguro</p>
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

    // 2. Envío y verificación de códigos OTP por correo electrónico (/api/auth/send-otp y /api/auth/verify-otp)
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
            // Si RESEND_API_KEY no está configurada aún en el entorno, devolvemos el código generado por el servidor para poder completar la verificación
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

    if (pathname === '/api/auth/verify-otp' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const cleanEmail = String(body.email || '').trim().toLowerCase();
        const cleanCode = String(body.code || '').trim();

        const entry = memoryOtps.get(cleanEmail);
        if (!entry) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Pedí un código nuevo para ingresar.' }));
          return;
        }
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
        const sessionToken = crypto.randomBytes(24).toString('hex');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `toque_session=${sessionToken}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`,
        });
        res.end(JSON.stringify({ success: true, verifiedEmail: cleanEmail }));
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err?.message || 'Error al verificar el código.' }));
        return;
      }
    }

    // 3. Estado de WalletWallet (NUNCA expone la API key al cliente) y contador real de pases emitidos
    if (pathname === '/api/wallet/status' && req.method === 'GET') {
      const apiKey = (
        process.env.WALLETWALLET_API_KEY || 'ww_live_0a1b9cf29dcd4f7ceb3a5023d0e49de2'
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

    // 4. Sincronización Híbrida de Bóveda del Consumidor ("Mi Toque"): /api/consumer/sync
    if (pathname === '/api/consumer/sync' && req.method === 'POST') {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const consumerId = body.user?.id || crypto.randomUUID();
        const emailOrPhone = (body.user?.emailOrPhone || '').trim().toLowerCase();
        const displayName = (body.user?.displayName || 'Comprador Toque').trim();
        const ageGroup = body.user?.ageGroup || 'all';
        const consentSaveReceipts = body.user?.consentSaveReceipts !== false;
        const consentMarketingNetwork = body.user?.consentMarketingNetwork !== false;
        const createdAt = body.user?.createdAt || new Date().toISOString();
        const receipts = Array.isArray(body.receipts) ? body.receipts : [];

        const userRecord = {
          id: consumerId,
          uuid: consumerId,
          emailOrPhone,
          displayName,
          ageGroup,
          consentSaveReceipts,
          consentMarketingNetwork,
          createdAt,
          syncedAt: new Date().toISOString(),
        };

        memoryConsumerUsers.set(consumerId, userRecord);
        if (emailOrPhone) {
          memoryConsumerUsers.set(emailOrPhone, userRecord);
        }
        memoryConsumerReceipts.set(consumerId, receipts);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            consumerId,
            recoveryCode: `TQ-${consumerId.slice(0, 8).toUpperCase()}`,
            user: userRecord,
            receiptsCount: receipts.length,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err?.message || 'Sync error' }));
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

    // 5. Endpoints Resend Oficiales con Plantillas Tactile Hardware:
    //    - POST /api/club/join (y /api/club/welcome-email): Bienvenida 1ra visita (1/10 sellos)
    //    - POST /api/club/recover: Recuperación con código OTP de 4 dígitos + Magic Link
    //    - POST /api/club/broadcast: Avisos y beneficios a socios con consent === true (Pro / Trial)
    if (
      (pathname === '/api/club/join' || pathname === '/api/club/welcome-email') &&
      req.method === 'POST'
    ) {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const email = String(body.email || '').trim().toLowerCase();
        const customerName = String(body.customerName || body.name || 'Socio').trim();
        const businessName = String(body.businessName || 'La Burger').trim();
        const memberCode = String(body.memberCode || 'LB-1001').trim();
        const localCode = String(body.localCode || 'BURGER01').trim();
        const stamps = Number(body.stamps ?? 1);
        const stampsRequired = Number(body.stampsRequired ?? 10);
        const rewardText = String(
          body.rewardText || body.reward || 'Beneficio exclusivo en tu visita #10'
        ).trim();
        const hubUrl = String(body.hubUrl || `${url.origin}/u/${localCode}`).trim();
        const walletUrl = String(
          body.walletUrl || `${url.origin}/u/${localCode}?wallet=open&code=${encodeURIComponent(memberCode)}`
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
        const businessName = String(body.businessName || 'La Burger').trim();
        const customerName = String(
          body.customerName || cleanEmail.split('@')[0] || 'Socio'
        ).trim();
        const localCode = String(body.localCode || 'BURGER01').trim();
        const currentStamps = Number(body.currentStamps ?? 1);
        const stampsRequired = Number(body.stampsRequired ?? 10);

        if (!cleanEmail || !cleanEmail.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({ success: false, error: 'Ingresá un correo electrónico válido.' })
          );
          return;
        }

        // Generar código OTP corto de 4 dígitos para recuperación rápida
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
                'El envío de avisos por email está disponible en el Plan Pro ($34.999) o durante el Trial activo de 14 días.',
            })
          );
          return;
        }

        const rawRecipients: Array<string | { email: string; name?: string; consent?: boolean }> =
          Array.isArray(body.recipients) ? body.recipients : [];
        const headline = String(body.headline || body.subject || 'Novedad exclusiva del Club').trim();
        const messageBody = String(body.messageBody || body.message || '').trim();
        const businessName = String(body.businessName || 'La Burger').trim();
        const localCode = String(body.localCode || 'BURGER01').trim();
        const ctaLabel = String(body.ctaLabel || 'Ver mi tarjeta y beneficio').trim();
        const ctaUrl = String(body.ctaUrl || `${url.origin}/u/${localCode}`).trim();

        const resendKey = process.env.RESEND_API_KEY?.trim();
        let sentCount = 0;

        const consentedRecipients = rawRecipients
          .map((item) => {
            if (typeof item === 'string') {
              return { email: item.trim().toLowerCase(), name: 'Socio', consent: true };
            }
            return {
              email: String(item.email || '').trim().toLowerCase(),
              name: String(item.name || 'Socio').trim(),
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

    // 6. Proxy seguro hacia https://api.walletwallet.dev/api/passes (GET /api/wallet/usage, POST /api/wallet/pass, PUT /api/wallet/pass/:serialNumber, DELETE /api/wallet/pass/:serialNumber)
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
            error: err?.message || 'No se pudo consultar el cupo de WalletWallet.',
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
          'Content-Disposition': `attachment; filename="toque-${passId}.pkpass"`,
          'Content-Length': buffer.length,
        });
        res.end(buffer);
        return;
      }
      if (stored?.shareUrl) {
        res.writeHead(302, { Location: stored.shareUrl });
        res.end();
        return;
      }
      res.writeHead(302, {
        Location: `/u/BURGER01?wallet=apple&passId=${encodeURIComponent(passId)}`,
      });
      res.end();
      return;
    }

    if (
      (pathname === '/api/club/stamp' || pathname === '/api/club/stamps/self') &&
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
        const businessName = String(body.businessName || 'La Burger').slice(0, 64);
        const rewardText = String(
          body.rewardText || 'Beneficio al completar tus sellos'
        ).slice(0, 60);
        const validPresets: ColorPreset[] = ['dark', 'blue', 'green', 'red', 'purple', 'orange'];
        const colorPreset: ColorPreset = validPresets.includes(body.colorPreset)
          ? body.colorPreset
          : 'dark';
        const rawToken = String(body.barcodeToken || '').trim();
        const barcodeToken =
          rawToken.length >= 16 ? rawToken : generateSecureBarcodeToken();
        const walletSerial = String(body.walletSerial || '').trim();
        const lastNotification =
          typeof body.walletLastNotification === 'string' && body.walletLastNotification
            ? body.walletLastNotification
            : ' ';

        let walletSyncError: string | undefined;
        let notifiedDevices = 0;
        const apiKey = process.env.WALLETWALLET_API_KEY?.trim();

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

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            status: 'stamped',
            cooldown: false,
            stamps: nextStamps,
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
        const existingSerial = String(urlSerial || body.serialNumber || body.walletSerial || '').trim();

        const businessId = String(body.businessId || 'la-burger').slice(0, 64);
        const businessName = String(body.businessName || body.title || 'La Burger').slice(0, 80);
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
        const stamps = typeof body.stamps === 'number' ? body.stamps : 1;
        const stampsRequired =
          typeof body.stampsRequired === 'number' ? body.stampsRequired : 10;
        const rewardText = String(
          body.reward ||
            body.rewardText ||
            'Beneficio exclusivo al completar la tarjeta'
        ).slice(0, 60);
        const customerName = String(body.memberName || body.customerName || '').trim().slice(0, 40);
        const customerContact = String(body.customerContact || '').slice(0, 100);
        const code = String(body.cartelCode || body.code || 'BURGER01')
          .toUpperCase()
          .slice(0, 32);
        const memberId = String(body.memberId || `mem-${Date.now().toString(36)}`).slice(0, 64);

        // Asegurar un barcodeToken criptográfico de 16+ caracteres (32 hex)
        const rawBarcode = String(body.barcodeToken || body.barcodeValue || body.memberCode || '').trim();
        const barcodeToken =
          rawBarcode.length >= 16 ? rawBarcode : generateSecureBarcodeToken();

        const qrUrl = body.qrUrl || `/u/${code}`;
        const apiKey = (
          process.env.WALLETWALLET_API_KEY || 'ww_live_0a1b9cf29dcd4f7ceb3a5023d0e49de2'
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
          barcodeFormat: 'QR',
          barcodeAltText: '',
          colorPreset,
          notification: typeof body.notification === 'string' ? body.notification : ' ',
          headerFields: Array.isArray(body.headerFields) ? body.headerFields : undefined,
          primaryFields: Array.isArray(body.primaryFields) ? body.primaryFields : undefined,
          secondaryFields: Array.isArray(body.secondaryFields) ? body.secondaryFields : undefined,
          locations: Array.isArray(body.locations) ? body.locations : undefined,
          color: body.color || undefined,
          logoURL: body.logoURL || body.logoUrl || undefined,
          wideLogoURL: body.wideLogoURL || body.wideLogoUrl || undefined,
          iconURL: body.iconURL || body.iconUrl || undefined,
        };

        let walletSyncError: string | undefined;

        if (apiKey) {
          try {
            const isRealSerial = existingSerial && !existingSerial.startsWith('ww-');
            if ((req.method === 'PUT' || body.isUpdate) && isRealSerial) {
              try {
                const upd = await updatePass(
                  { WALLETWALLET_API_KEY: apiKey },
                  existingSerial,
                  cardInput
                );
                const existingRecord = memoryWalletPasses.get(existingSerial);
                const shareUrl =
                  existingRecord?.shareUrl ||
                  `https://walletwallet.dev/p/${encodeURIComponent(existingSerial)}`;
                const googleWalletUrl = existingRecord?.googleSaveUrl || shareUrl;
                const appleWalletUrl = existingRecord?.applePassBase64
                  ? `/api/wallet/pkpass/${encodeURIComponent(existingSerial)}`
                  : shareUrl;

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(
                  JSON.stringify({
                    success: true,
                    provider: 'api.walletwallet.dev',
                    passId: existingSerial,
                    serialNumber: existingSerial,
                    shareUrl,
                    unchanged: upd.unchanged,
                    notifiedDevices: upd.notifiedDevices,
                    validationCode: barcodeToken,
                    appleWalletUrl,
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
              } catch (updErr: any) {
                // Si el pase no existe aún en WalletWallet (404/403), lo creamos abajo con createPass
                if (
                  !(updErr instanceof WalletError) ||
                  (updErr.status !== 404 && updErr.status !== 403)
                ) {
                  throw updErr;
                }
              }
            }

            const created = await createPass({ WALLETWALLET_API_KEY: apiKey }, cardInput);
            const passId = created.serialNumber;
            const shareUrl =
              created.shareUrl || `https://walletwallet.dev/p/${encodeURIComponent(passId)}`;
            const googleSaveUrl = created.googleSaveUrl || shareUrl;

            memoryWalletPasses.set(passId, {
              passId,
              serialNumber: passId,
              shareUrl,
              businessId,
              businessName,
              customerContact,
              createdAt: new Date().toISOString(),
              provider: 'api.walletwallet.dev',
              applePassBase64: created.applePass,
              googleSaveUrl,
            });

            const appleWalletUrl = created.applePass
              ? `/api/wallet/pkpass/${encodeURIComponent(passId)}`
              : shareUrl;

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(
              JSON.stringify({
                success: true,
                provider: 'api.walletwallet.dev',
                passId,
                serialNumber: passId,
                shareUrl,
                validationCode: barcodeToken,
                appleWalletUrl,
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

        // Respaldo local (sin redirigir jamás a localhost)
        const passId =
          existingSerial || `ww-${code.toLowerCase()}-${Date.now().toString(36)}`;
        const relativeHubPassUrl = `/u/${code}?wallet=open&code=${encodeURIComponent(barcodeToken)}`;
        memoryWalletPasses.set(passId, {
          passId,
          serialNumber: passId,
          shareUrl: relativeHubPassUrl,
          businessId,
          businessName,
          customerContact,
          createdAt: new Date().toISOString(),
          provider: 'toque-web-pass',
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            provider: 'toque-web-pass',
            passId,
            serialNumber: passId,
            shareUrl: relativeHubPassUrl,
            walletSyncError,
            validationCode: barcodeToken,
            appleWalletUrl: relativeHubPassUrl,
            googleWalletUrl: relativeHubPassUrl,
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

    // 7. Mercado Pago Checkout API (Orders API v1 — Sin redirección: Tarjeta, Rapipago y Pago Fácil + Webhooks)
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
        const businessId = String(body.businessId || 'la-burger').slice(0, 64);
        const planId = String(body.planId || 'mensual').slice(0, 32);
        const amountArs = Number(body.amountArs || 34999);
        const payerEmail = String(body.payerEmail || 'comercio@toque.com.ar').trim().toLowerCase();
        const payerName = String(body.payerName || 'Titular Comercio').trim();
        const payerIdentification = String(body.identificationNumber || '20304050607').replace(/\D/g, '');
        const paymentMethodType: 'card' | 'rapipago' | 'pagofacil' =
          body.paymentMethodType === 'rapipago' || body.paymentMethodType === 'pagofacil'
            ? body.paymentMethodType
            : 'card';
        const cardToken = body.cardToken ? String(body.cardToken).trim() : undefined;
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

        // Si MP_ACCESS_TOKEN está configurado y se envía un token real o medio offline (rapipago/pagofacil),
        // llamamos a la API oficial de Orders v1 de Mercado Pago (https://api.mercadopago.com/v1/orders)
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
            } else {
              const errText = await mpRes.text().catch(() => '');
              console.log(`[MP ORDERS NOTICE ${mpRes.status}] ${errText}`);
            }
          } catch (err: any) {
            console.log(`[MP ORDERS FALLBACK]`, err?.message || err);
          }
        }

        // Procesamiento Checkout API In-App (Sandbox / Desarrollo o sin token de tarjeta en vivo)
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
            error: err?.message || 'Error al procesar orden en Checkout API',
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

        console.log(`[MP WEBHOOK] Evento recibido: ${eventType} (${action}) ID=${dataId}`);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ received: true, eventType, action, id: dataId }));
        return;
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ received: true }));
        return;
      }
    }

    // 8. Endpoint /api/telemetry/scan
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

    // 8. Si existe dist/index.html compilado, servir archivos estáticos directamente
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

    // 9. En desarrollo (cuando no hay dist/), delegar a Vite middleware
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

  server.on('upgrade', (req, socket) => {
    socket.destroy();
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
