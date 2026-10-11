/**
 * Toque — Centro de Ayuda del Fabricante (ManufacturerHelpView)
 * Preguntas frecuentes técnicas y comerciales + Videos cortos con marca blanca.
 */

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import {
  HelpCircle,
  Play,
  ChevronDown,
  ChevronUp,
  Cpu,
  Store,
  DollarSign,
  ShieldCheck,
  Video,
} from 'lucide-react';

export const ManufacturerHelpView: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeVideo, setActiveVideo] = useState<{ title: string; duration: string; description: string } | null>(null);

  const faqs = [
    {
      q: '¿Qué microchip NFC debo comprar para la producción física?',
      a: 'Recomendamos chips NTAG215 o NTAG213 autoadhesivos circulares de 25 mm. Si el cartel va montado sobre aluminio, acero o bases metálicas, es indispensable comprar chips etiquetados como "Anti-Metal / On-Metal" que incluyen una lámina de ferrita aislante.',
    },
    {
      q: '¿Qué pasa si mi cliente cambia de local o de link de Google Reviews?',
      a: 'El cartel físico nunca se pierde: el dueño del negocio (o vos desde este panel) puede editar la URL de destino en 1 clic. El chip NFC y el código QR siguen siendo los mismos y redirigen inmediatamente al nuevo enlace sin tener que fabricar nada nuevo.',
    },
    {
      q: '¿Cómo sugieren fijar el precio de venta a los comercios?',
      a: 'El modelo más exitoso para talleres es cobrar un precio inicial por el cartel físico (ej. $15.000 a $25.000 ARS) y una suscripción mensual de mantenimiento del panel y reportes (ej. $6.000 a $9.000 ARS/mes). Esto transforma una venta única en un ingreso recurrente de por vida.',
    },
    {
      q: '¿Qué aplicación gratuita uso en el taller para grabar los chips?',
      a: 'La aplicación estándar de la industria es "NFC Tools" (disponible gratis en iOS App Store y Google Play). También podés utilizar lectores USB de mesa como el ACR122U conectado a una notebook para grabar en serie rápidamente.',
    },
  ];

  const videos = [
    {
      title: 'Cómo grabar chips NTAG215 en 5 segundos con el celular',
      duration: '2:14 min',
      description: 'Paso a paso con la app NFC Tools: escribir registro URI, probar lectura y verificar respuesta en iPhone y Android.',
    },
    {
      title: 'Cómo dar de alta tu primer comercio en 1 minuto',
      duration: '1:45 min',
      description: 'Uso del alta rápida: obtención de la URL oficial de 5 estrellas en Google Maps y envío del mensaje de bienvenida por WhatsApp.',
    },
    {
      title: 'Cómo presentar el cartel para cerrar la venta con gastronómicos',
      duration: '3:10 min',
      description: 'El argumento comercial clave: por qué un cartel pasivo no sirve y cómo los datos de toques demuestran el retorno de inversión.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h2 className="font-display text-title-2 font-bold text-[var(--text-main)]">
          Centro de Ayuda y Tutoriales del Taller
        </h2>
        <p className="text-small text-[var(--text-muted)] mt-0.5">
          Guías técnicas de producción física y mejores prácticas comerciales para fabricantes.
        </p>
      </div>

      {/* 1. VIDEOS CORTOS DE APRENDIZAJE */}
      <div className="space-y-3">
        <h3 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
          <Video className="w-4 h-4 text-[var(--brand)]" />
          <span>Tutoriales Rápidos en Video</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {videos.map((vid, idx) => (
            <Card
              key={idx}
              className="p-4 flex flex-col justify-between space-y-3 hover:border-[var(--brand)]/50 transition cursor-pointer group"
              onClick={() => setActiveVideo(vid)}
            >
              {/* Miniatura representativa */}
              <div className="h-32 rounded-xl bg-gradient-to-tr from-[var(--tinta)] to-[var(--brand)]/70 relative flex items-center justify-center overflow-hidden">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white group-hover:scale-110 transition shadow-lg">
                  <Play className="w-5 h-5 ml-0.5 fill-white" />
                </div>
                <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/70 text-white px-2 py-0.5 rounded">
                  {vid.duration}
                </span>
              </div>

              <div>
                <h4 className="font-display text-small font-semibold text-[var(--text-main)] group-hover:text-[var(--brand)] transition">
                  {vid.title}
                </h4>
                <p className="text-micro text-[var(--text-muted)] mt-1 line-clamp-2">
                  {vid.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 2. PREGUNTAS FRECUENTES (FAQ) */}
      <div className="space-y-3">
        <h3 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[var(--brand)]" />
          <span>Preguntas Frecuentes Técnicas y de Negocio</span>
        </h3>

        <div className="space-y-2.5">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <Card key={idx} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="font-medium text-small text-[var(--text-main)]">
                    {faq.q}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-micro text-[var(--text-muted)] leading-relaxed border-t border-[var(--border-subtle)]/50">
                    {faq.a}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* MODAL REPRODUCTOR DE VIDEO SIMULADO */}
      {activeVideo && (
        <Dialog
          isOpen={!!activeVideo}
          onClose={() => setActiveVideo(null)}
          title={activeVideo.title}
          size="md"
        >
          <div className="space-y-4 pt-2">
            <div className="h-64 rounded-2xl bg-black flex flex-col items-center justify-center text-white space-y-3 relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center animate-pulse">
                <Play className="w-8 h-8 ml-1 fill-white" />
              </div>
              <p className="text-small font-medium text-slate-300">
                Tutorial interactivo del taller ({activeVideo.duration})
              </p>
            </div>

            <p className="text-small text-[var(--text-muted)] leading-relaxed">
              {activeVideo.description}
            </p>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setActiveVideo(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
