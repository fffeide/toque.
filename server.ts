import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Inicializar Google Gen AI con API Key del entorno
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Endpoint de IA para el Asistente Chatbot de Toque
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'El mensaje es requerido.' });
    }

    const systemInstruction = `Sos el copiloto oficial de Inteligencia Artificial de Toque (toque.ar), la plataforma SaaS líder para carteles acrílicos inteligentes con tecnología dual NFC (contactless) y Códigos QR dinámicos para comercios físicos (restaurantes, bares, cafés, locales).

Contexto del usuario actual:
- Rol: ${context?.role || 'Comercio / Negocio'}
- Nombre: ${context?.name || 'Usuario'}
- Negocio / Taller: ${context?.tenantName || 'Toque'}
- Carteles registrados: ${context?.cartelesCount || 'Varios'} carteles

Tus funciones y conocimientos:
1. Tecnología física: Los carteles tienen chip NFC NTAG215 (lectura por contacto a 1-3cm sin apps) y QR dinámico de alta resolución. Ambos apuntan a una URL corta dinámica en este servidor (/r/codigo) que redirige en menos de 45 milisegundos directamente a la ficha de reseñas en Google Maps con 5 estrellas.
2. Cambio de enlace sin reimprimir: La gran ventaja es que la URL corta es dinámica. El dueño puede cambiar el link de Google Maps en cualquier momento desde "Mis Carteles" sin tirar ni reimprimir el acrílico.
3. Telemetría y captura de datos: Al escanear el QR o tocar el NFC, Toque captura en <40ms el tipo de dispositivo (iOS/Android), navegador, resolución de pantalla, idioma, tipo de conexión y hora pico antes de redirigir de inmediato a Google.
4. Módulo Equipo: Sirve para motivar y medir al personal (mozos, baristas) mediante un reto amistoso. NUNCA se generan QRs para empleados (los QRs son exclusivos de mesas y carteles físicos). Está terminantemente prohibido premiar o condicionar al cliente (política de Google), pero sí se puede premiar internamente al staff por su calidez de servicio.
5. Fabricantes: Venden e imprimen acrílicos, usan kits de impresión en CSV para grabar chips NFC en lote con la app NFC Tools.

Instrucciones de tono:
- Sé amable, conciso, ultra práctico y profesional (español rioplatense o neutro cálido).
- Respuestas directas, bien estructuradas, con viñetas cuando sea útil.
- Si te piden realizar una acción como cambiar un enlace o simular escaneo, explicales cómo hacerlo o confirmales que pueden usar los botones interactivos del chat.`;

    const chatResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = chatResponse.text || 'Entendido. ¿En qué más puedo ayudarte hoy en Toque?';
    return res.json({ reply });
  } catch (error: any) {
    console.error('Error al generar respuesta con Gemini:', error);
    return res.status(500).json({
      error: 'Error en el asistente de IA',
      details: error?.message || 'No se pudo conectar con el servicio de IA.',
    });
  }
});

// Endpoint de telemetría de escaneo ultrarrápido
app.post('/api/telemetry/scan', async (req: Request, res: Response) => {
  try {
    const { shortCode, telemetry } = req.body;
    // Loguear telemetría
    console.log(`[Telemetría Toque] Escaneo registrado para código ${shortCode}:`, telemetry);
    return res.json({ success: true, recordedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
});

// Servidor de desarrollo con Vite middlewares o estáticos en producción
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor Toque Full-Stack activo en http://0.0.0.0:${port}`);
  });
}

startServer();
