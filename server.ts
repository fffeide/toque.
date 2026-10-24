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
const memoryWalletPasses = new Map<string, { passId: string; businessId: string; businessName: string; customerContact: string; createdAt: string; provider: string }>();

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

async function sendVerificationEmailViaProvider(email: string, code: string, contextLabel: string): Promise<{ sent: boolean; provider: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.EMAIL_FROM?.trim() || 'Toque <onboarding@resend.dev>';

  if (resendKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `${code} es tu código de verificación de Toque`,
          html: `
            <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; background: #0A0A0A; color: #F1F1EE; padding: 32px; border-radius: 16px; max-width: 480px; margin: 0 auto; border: 1px solid #242426;">
              <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #BEC8FF; margin: 0 0 8px 0;">Toque · Verificación sin contraseña</p>
              <h1 style="font-size: 22px; margin: 0 0 16px 0; color: #F1F1EE;">Tu código de verificación</h1>
              <p style="font-size: 14px; color: #A1A1AA; line-height: 1.5; margin: 0 0 24px 0;">
                Ingresá este código de 6 dígitos para confirmar tu correo en <strong>${contextLabel}</strong>. Vence en 10 minutos y se usa una sola vez.
              </p>
              <div style="background: #141417; border: 1px solid #2C2C30; border-radius: 12px; padding: 20px; text-align: center; font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.25em; color: #F1F1EE; margin-bottom: 24px;">
                ${code}
              </div>
              <p style="font-size: 12px; color: #71717A; margin: 0;">
                Si no solicitaste este código, podés ignorar este correo de forma segura.
              </p>
            </div>
          `,
        }),
      });
      if (response.ok) {
        console.log(`[RESEND OK] Email de verificación enviado a ${email}`);
        return { sent: true, provider: 'resend' };
      } else {
        const errText = await response.text().catch(() => '');
        console.error(`[RESEND ERROR ${response.status}] ${errText}`);
      }
    } catch (err: any) {
      console.error(`[RESEND EXCEPTION]`, err?.message || err);
    }
  }

  console.log(`[TOQUE EMAIL OTP] Para: ${email} | Código: ${code} | Contexto: ${contextLabel}`);
  return { sent: false, provider: 'server-console' };
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
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
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
      const hasKey = Boolean(
        process.env.WALLETWALLET_API_KEY && process.env.WALLETWALLET_API_KEY.trim().length > 0
      );
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

        const resendKey = process.env.RESEND_API_KEY?.trim();
        const fromEmail = process.env.EMAIL_FROM?.trim() || 'Toque <onboarding@resend.dev>';
        let emailSent = false;

        if (resendKey && email && email.includes('@')) {
          try {
            const r = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${resendKey}`,
              },
              body: JSON.stringify({
                from: fromEmail,
                to: [email],
                subject: `¡Ya sos parte de ${businessName}! (${stamps}/${stampsRequired} sellos)`,
                html,
              }),
            });
            emailSent = r.ok;
          } catch {
            // fallback
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            emailSent,
            provider: resendKey ? 'resend' : 'preview',
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

        const resendKey = process.env.RESEND_API_KEY?.trim();
        const fromEmail = process.env.EMAIL_FROM?.trim() || 'Toque <onboarding@resend.dev>';
        let emailSent = false;

        if (resendKey) {
          try {
            const r = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${resendKey}`,
              },
              body: JSON.stringify({
                from: fromEmail,
                to: [cleanEmail],
                subject: `${otpCode} · Recuperá tu tarjeta de ${businessName}`,
                html,
              }),
            });
            emailSent = r.ok;
          } catch {
            // fallback
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            emailSent,
            magicLinkUrl,
            previewCode: emailSent ? undefined : otpCode,
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
        const fromEmail = process.env.EMAIL_FROM?.trim() || 'Toque <onboarding@resend.dev>';
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
            try {
              const r = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${resendKey}`,
                },
                body: JSON.stringify({
                  from: fromEmail,
                  to: [rec.email],
                  subject: `${businessName}: ${headline}`,
                  html,
                }),
              });
              if (r.ok) sentCount++;
            } catch {
              // ignore individual error
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

    // 6. Proxy seguro hacia https://api.walletwallet.dev (POST /api/wallet/pass y /api/wallet/create)
    if (
      (pathname === '/api/wallet/pass' || pathname === '/api/wallet/create') &&
      req.method === 'POST'
    ) {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const businessId = (body.businessId || 'la-burger').slice(0, 64);
        const businessName = (body.title || body.businessName || 'La Burger').slice(0, 80);
        const brandColor =
          typeof (body.backgroundColor || body.brandColor) === 'string' &&
          (body.backgroundColor || body.brandColor).startsWith('#')
            ? body.backgroundColor || body.brandColor
            : '#141418';
        const stamps = typeof body.stamps === 'number' ? body.stamps : 1;
        const stampsRequired =
          typeof body.stampsRequired === 'number' ? body.stampsRequired : 10;
        const rewardText = (
          body.reward ||
          body.rewardText ||
          '1 Beneficio sin cargo al completar la tarjeta'
        ).slice(0, 120);
        const customerName = (body.memberName || body.customerName || 'Socio Toque').slice(0, 80);
        const customerContact = (body.customerContact || '').slice(0, 100);
        const code = (body.code || 'BURGER01').toUpperCase().slice(0, 32);
        const memberId = (body.memberId || `mem-${Date.now().toString(36)}`).slice(0, 64);
        const memberCode = (body.barcodeValue || body.memberCode || `TQ-${code}`).slice(0, 32);
        const qrUrl = body.qrUrl || `${url.origin}/h/${code}`;

        const apiKey = process.env.WALLETWALLET_API_KEY?.trim();

        if (apiKey) {
          const payload = {
            title: businessName,
            memberName: customerName,
            memberId,
            stamps,
            stampsRequired,
            reward: rewardText,
            backgroundColor: brandColor,
            barcodeValue: memberCode,
            merchantName: businessName,
            organizationName: businessName,
            description: `Tarjeta de sellos de ${businessName}`,
            labelColor: '#BEC8FF',
            foregroundColor: '#F1F1EE',
            headerField: {
              key: 'stamps',
              label: 'SELLOS',
              value: `${stamps} / ${stampsRequired}`,
            },
            primaryField: {
              key: 'reward',
              label: 'PREMIO',
              value: rewardText,
            },
            secondaryField: {
              key: 'customer',
              label: 'SOCIO',
              value: customerName,
            },
            auxiliaryField: customerContact
              ? {
                  key: 'contact',
                  label: 'CORREO',
                  value: customerContact,
                }
              : undefined,
            barcode: {
              format: 'PKBarcodeFormatQR',
              message: memberCode,
              messageEncoding: 'iso-8859-1',
              altText: memberCode,
            },
          };

          try {
            const walletRes = await fetch('https://api.walletwallet.dev/v1/pass', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'X-API-Key': apiKey,
              },
              body: JSON.stringify(payload),
            });

            if (walletRes.ok) {
              const passData: any = await walletRes.json();
              const passId =
                passData.id ||
                passData.passId ||
                `ww-${code.toLowerCase()}-${Date.now().toString(36)}`;
              memoryWalletPasses.set(passId, {
                passId,
                businessId,
                businessName,
                customerContact,
                createdAt: new Date().toISOString(),
                provider: 'api.walletwallet.dev',
              });
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(
                JSON.stringify({
                  success: true,
                  provider: 'api.walletwallet.dev',
                  passId,
                  validationCode: `WW-${code}-${stamps}S`,
                  appleWalletUrl:
                    passData.applePassUrl ||
                    passData.pkpassUrl ||
                    passData.url ||
                    `${url.origin}/h/${code}?wallet=apple&passId=${encodeURIComponent(passId)}`,
                  googleWalletUrl:
                    passData.googlePassUrl ||
                    passData.saveUrl ||
                    passData.url ||
                    `${url.origin}/h/${code}?wallet=google&passId=${encodeURIComponent(passId)}`,
                  qrUrl,
                  fallbackWebPass: !(passData.applePassUrl || passData.pkpassUrl || passData.googlePassUrl || passData.saveUrl),
                  barcodeValue: memberCode,
                  title: businessName,
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
            } else {
              const errBody = await walletRes.text().catch(() => '');
              console.error(`[WALLETWALLET ERROR ${walletRes.status}]`, errBody);
            }
          } catch (err: any) {
            console.error(`[WALLETWALLET EXCEPTION]`, err?.message || err);
          }
        }

        // Fallback Infalible: Pase Digital Web / Tarjeta Instalable con Código de Barras CODE128 y QR 100% reales
        const passId = `ww-${code.toLowerCase()}-${Date.now().toString(36)}`;
        memoryWalletPasses.set(passId, {
          passId,
          businessId,
          businessName,
          customerContact,
          createdAt: new Date().toISOString(),
          provider: 'toque-web-pass-fallback',
        });

        const queryParams = new URLSearchParams({
          biz: businessName,
          stamps: `${stamps}/${stampsRequired}`,
          reward: rewardText,
          member: customerName,
          code: memberCode,
          color: brandColor,
          passId,
        }).toString();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            provider: 'toque-web-pass-fallback',
            passId,
            validationCode: `TQ-${code}-${stamps}S`,
            appleWalletUrl: `${url.origin}/h/${code}?wallet=apple&${queryParams}`,
            googleWalletUrl: `${url.origin}/h/${code}?wallet=google&${queryParams}`,
            qrUrl,
            fallbackWebPass: true,
            barcodeValue: memberCode,
            title: businessName,
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
            error: err?.message || 'Error al generar pase de Wallet',
          })
        );
        return;
      }
    }

    // 7. Endpoint /api/telemetry/scan
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
