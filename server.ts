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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Health checks para Cloud Run (Liveness probe y Startup probe)
  if (pathname === '/healthz' || pathname === '/api/healthz' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('OK');
    return;
  }

  // 2. Enrutamiento en el borde /r/:code (Simula el mismo flujo del Worker)
  if (pathname.startsWith('/r/') && req.method === 'GET') {
    const rawCode = pathname.replace('/r/', '').split('/')[0]?.trim().toUpperCase();
    if (!rawCode) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    if (rawCode === 'DEMO01' || rawCode === 'VIRGEN01') {
      res.writeHead(302, { Location: `/activar/${rawCode}` });
      res.end();
      return;
    }

    if (rawCode === 'DIRECT01') {
      res.writeHead(302, { Location: 'https://maps.google.com' });
      res.end();
      return;
    }

    res.writeHead(302, { Location: `/hub/${rawCode}` });
    res.end();
    return;
  }

  // 3. Endpoint de Apple Wallet & Google Wallet (POST /api/wallet/pass y /api/wallet/create)
  if (
    (pathname === '/api/wallet/pass' || pathname === '/api/wallet/create') &&
    req.method === 'POST'
  ) {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const businessName = body.businessName || 'Café & Panadería La Esquina';
      const brandColor = body.brandColor || '#3A3FE0';
      const stamps = typeof body.stamps === 'number' ? body.stamps : 4;
      const stampsRequired = typeof body.stampsRequired === 'number' ? body.stampsRequired : 5;
      const rewardText = body.rewardText || '10% OFF en tu próxima compra';
      const code = (body.code || 'CAJA01').toUpperCase();
      const qrUrl = body.qrUrl || `${url.origin}/r/${code}`;

      if (process.env.WALLETWALLET_API_KEY) {
        const walletRes = await fetch('https://walletwallet.dev/api/v1/pass', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.WALLETWALLET_API_KEY}`,
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
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              provider: 'walletwallet.dev',
              appleWalletUrl: passData.applePassUrl || passData.pkpassUrl,
              googleWalletUrl: passData.googlePassUrl || passData.saveUrl,
              validationCode: `TQ-${code}-${stamps}S`,
            })
          );
          return;
        }
      }

      // Fallback limpio a tarjeta web PWA instalable
      const passId = `pass-${code.toLowerCase()}-${Date.now().toString(36)}`;
      const queryParams = new URLSearchParams({
        biz: businessName,
        stamps: `${stamps}/${stampsRequired}`,
        reward: rewardText,
        code,
        color: brandColor,
      }).toString();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          provider: 'toque-pwa-wallet',
          passId,
          validationCode: `TQ-${code}-${stamps}${stampsRequired}`,
          appleWalletUrl: `${url.origin}/hub/${code}?wallet=apple&${queryParams}`,
          googleWalletUrl: `${url.origin}/hub/${code}?wallet=google&${queryParams}`,
          qrUrl,
        })
      );
      return;
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
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
      const raw = await readBody(req);
      const data = raw ? JSON.parse(raw) : {};
      console.log('[Telemetría Toque] Escaneo recibido:', data.shortCode);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, recordedAt: new Date().toISOString() }));
      return;
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false }));
      return;
    }
  }

  // 5. Servir archivos estáticos de dist/
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

    // 6. Fallback para SPA (Single Page Application - React Router)
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
