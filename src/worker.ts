/**
 * Cloudflare Worker Entrypoint para Toque
 * Maneja rutas API de borde (/api/chat, /healthz) y delega todos los recursos
 * estáticos y rutas SPA (React Router) al binding ASSETS de Cloudflare.
 */

export interface Env {
  ASSETS: {
    fetch: (request: Request | string, init?: RequestInit) => Promise<Response>;
  };
  GEMINI_API_KEY?: string;
  VITE_PUBLIC_SHORT_BASE?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Endpoint de verificación de salud
    if (url.pathname === '/healthz' || url.pathname === '/api/healthz') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          runtime: 'cloudflare-worker',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Endpoint de IA con Google Gemini para el Chatbot de Soporte
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { message?: string; context?: any };
        const apiKey = env.GEMINI_API_KEY || '';

        if (!apiKey) {
          return new Response(
            JSON.stringify({
              reply:
                '¡Hola! El asistente de IA está listo. Para habilitar respuestas generativas en producción de Cloudflare, agregá la variable secreta GEMINI_API_KEY en tu Worker.',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const systemInstruction = `Sos el copiloto oficial de Inteligencia Artificial de Toque (toque.ar), la plataforma líder para carteles acrílicos inteligentes con tecnología dual NFC (contactless) y Códigos QR dinámicos para comercios físicos. Responde de forma cálida, concisa, profesional y práctica en español rioplatense o neutro.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: body.message || '' }] }],
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
            }),
          }
        );

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          return new Response(
            JSON.stringify({
              error: 'Error al contactar a la API de Gemini',
              details: errText,
            }),
            {
              status: geminiRes.status,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const data: any = await geminiRes.json();
        const reply =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          'Entendido. ¿En qué más puedo ayudarte hoy en Toque?';

        return new Response(JSON.stringify({ reply }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        return new Response(
          JSON.stringify({ error: error?.message || 'Error procesando solicitud de chat' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Endpoint de telemetría de escaneo
    if (url.pathname === '/api/telemetry/scan' && request.method === 'POST') {
      return new Response(
        JSON.stringify({ success: true, recordedAt: new Date().toISOString() }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Delegar a Static Assets (SPA) para index.html, bundles JS/CSS y rutas del cliente (/r/:code, etc.)
    return env.ASSETS.fetch(request);
  },
};
