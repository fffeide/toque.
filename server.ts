import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = path.resolve(__dirname, 'dist');

let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch (err) {
    console.warn('GoogleGenAI init warning:', err);
  }
}

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

  // 2. Endpoint /api/chat
  if (pathname === '/api/chat' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const data = raw ? JSON.parse(raw) : {};
      const { message, context } = data;

      if (!message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'El mensaje es requerido.' }));
        return;
      }

      if (ai) {
        const systemInstruction = `Sos el copiloto oficial de Inteligencia Artificial de Toque (toque.ar), la plataforma líder para carteles inteligentes con tecnología dual NFC y Códigos QR dinámicos para comercios físicos. Responde de forma cálida, concisa, profesional y práctica en español rioplatense o neutro. Contexto: ${JSON.stringify(context || {})}`;
        const chatResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: message,
          config: { systemInstruction, temperature: 0.7 },
        });
        const reply = chatResponse.text || 'Entendido. ¿En qué más puedo ayudarte hoy en Toque?';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
        return;
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          reply: '¡Hola! Soy el copiloto de Toque. Puedo ayudarte con cualquier consulta sobre tus carteles inteligentes, códigos QR o fichas de reseñas en Google.',
        }));
        return;
      }
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || 'Error interno' }));
      return;
    }
  }

  // 3. Endpoint /api/telemetry/scan
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

  // 4. Servir archivos estáticos de dist/
  if (req.method === 'GET' || req.method === 'HEAD') {
    const cleanPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(DIST_DIR, cleanPath);

    // Comprobar si el archivo físico existe en dist/
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

    // 5. Fallback para SPA (Single Page Application - React Router)
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
