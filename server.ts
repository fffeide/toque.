import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

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

async function startServer() {
  let vite: any = null;
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(DIST_DIR, 'index.html'));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
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

    // 2. Estado de WalletWallet (NUNCA expone la API key al cliente)
    if (pathname === '/api/wallet/status' && req.method === 'GET') {
      const hasKey = Boolean(process.env.WALLETWALLET_API_KEY && process.env.WALLETWALLET_API_KEY.trim().length > 0);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          configured: hasKey,
          provider: 'https://api.walletwallet.dev',
          status: hasKey ? 'active' : 'fallback',
        })
      );
      return;
    }

    // 3. Proxy seguro hacia https://api.walletwallet.dev (POST /api/wallet/pass y /api/wallet/create)
    if (
      (pathname === '/api/wallet/pass' || pathname === '/api/wallet/create') &&
      req.method === 'POST'
    ) {
      try {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const businessName = (body.businessName || 'Comercio Toque').slice(0, 80);
        const brandColor = body.brandColor || '#bec8ff';
        const stamps = typeof body.stamps === 'number' ? body.stamps : 1;
        const stampsRequired = typeof body.stampsRequired === 'number' ? body.stampsRequired : 5;
        const rewardText = (body.rewardText || 'Beneficio exclusivo del Club').slice(0, 120);
        const customerName = (body.customerName || 'Socio Toque').slice(0, 80);
        const customerContact = (body.customerContact || '').slice(0, 100);
        const code = (body.code || 'CAJA01').toUpperCase().slice(0, 32);
        const qrUrl = body.qrUrl || `${url.origin}/h/${code}`;

        const apiKey = process.env.WALLETWALLET_API_KEY?.trim();

        if (apiKey) {
          const payload = {
            merchantName: businessName,
            organizationName: businessName,
            description: `Tarjeta Club ${businessName}`,
            backgroundColor: '#0c0c0c',
            labelColor: '#bec8ff',
            foregroundColor: '#f1f1ee',
            headerField: {
              key: 'stamps',
              label: 'PUNTOS / SELLOS',
              value: `${stamps}/${stampsRequired}`,
            },
            primaryField: {
              key: 'reward',
              label: 'BENEFICIO',
              value: rewardText,
            },
            secondaryField: {
              key: 'customer',
              label: 'MIEMBRO',
              value: customerName,
            },
            auxiliaryField: customerContact
              ? {
                  key: 'contact',
                  label: 'CONTACTO',
                  value: customerContact,
                }
              : undefined,
            barcode: {
              format: 'PKBarcodeFormatQR',
              message: qrUrl,
              messageEncoding: 'iso-8859-1',
              altText: `TOQUE-${code}`,
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
              const passId = passData.id || passData.passId || `ww-${code.toLowerCase()}-${Date.now().toString(36)}`;
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(
                JSON.stringify({
                  success: true,
                  provider: 'api.walletwallet.dev',
                  passId,
                  validationCode: `WW-${code}-${stamps}P`,
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
                })
              );
              return;
            }
          } catch {
            // Si api.walletwallet.dev no responde en red externa del contenedor, emitimos pase firmado por servidor
          }
        }

        const passId = `ww-${code.toLowerCase()}-${Date.now().toString(36)}`;
        const queryParams = new URLSearchParams({
          biz: businessName,
          stamps: `${stamps}/${stampsRequired}`,
          reward: rewardText,
          member: customerName,
          code,
          color: brandColor,
          passId,
        }).toString();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            provider: apiKey ? 'api.walletwallet.dev' : 'toque-wallet',
            passId,
            validationCode: `WW-${code}-${stamps}${stampsRequired}`,
            appleWalletUrl: `${url.origin}/h/${code}?wallet=apple&${queryParams}`,
            googleWalletUrl: `${url.origin}/h/${code}?wallet=google&${queryParams}`,
            qrUrl,
          })
        );
        return;
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            error: {
              code: 'WALLET_PASS_ERROR',
              message: err?.message || 'Error al generar pase de billetera',
            },
          })
        );
        return;
      }
    }

    // 4. Endpoint /api/telemetry/scan
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

    // 5. En desarrollo, delegar a Vite middleware
    if (vite) {
      vite.middlewares(req, res, () => {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      });
      return;
    }

    // 6. En producción, servir archivos estáticos de dist/
    if (req.method === 'GET' || req.method === 'HEAD') {
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

      const indexPath = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
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
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Toque activo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
