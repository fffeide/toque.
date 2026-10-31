import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../../components/layout/SiteHeader';
import { api } from '../../api';
import { WaitlistProduct, ToquecitoItem } from '../../api/types';
import {
  CheckCircle2,
  Sparkles,
  Star,
  Receipt,
  HelpCircle,
  Smartphone,
  ShieldCheck,
  QrCode,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

export const WaitlistInlineForm: React.FC<{
  product: WaitlistProduct;
  productLabel: string;
}> = ({ product, productLabel }) => {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setDoneMsg('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Ingresá un mail válido.');
      return;
    }
    if (!consent) {
      setErrorMsg('Marcá la casilla para aceptar recibir el aviso cuando esté listo.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.joinWaitlist({
        email: email.trim(),
        product,
        consent,
        honeypot,
      });
      setDoneMsg(
        res.alreadyRegistered
          ? 'Ya estabas anotado. Te vamos a avisar por mail apenas esté listo.'
          : 'Te anotamos en la lista de espera. Te avisaremos por mail.'
      );
      setEmail('');
      setConsent(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No pudimos anotarte. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="hidden" aria-hidden="true">
        <label>
          No completar este campo
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tu mail para avisarte"
          aria-label={`Tu mail para ${productLabel}`}
          className="flex-1 min-h-[48px] px-4 rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] text-sm font-medium focus:outline-none focus:border-[#bec8ff]"
        />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[48px] px-5 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-sm hover:bg-white transition-colors shrink-0 cursor-pointer"
        >
          {submitting ? 'Anotando...' : 'Avisame cuando salga'}
        </button>
      </div>

      <label className="flex items-start gap-2.5 text-xs text-[#a1a1aa] cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="w-4 h-4 mt-0.5 rounded border border-[#28282a] bg-[#18181b]"
        />
        <span>
          Quiero recibir un único aviso por mail cuando <strong className="text-[#f1f1ee]">{productLabel}</strong> esté disponible.
        </span>
      </label>

      {errorMsg && <p className="text-xs font-bold text-[#ef4444]">{errorMsg}</p>}
      {doneMsg && (
        <p className="text-xs font-bold text-[#2fb36a] flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{doneMsg}</span>
        </p>
      )}
    </form>
  );
};

export const UpcomingProductPageView: React.FC<{
  product: WaitlistProduct;
}> = ({ product }) => {
  const [sampleToquecitos, setSampleToquecitos] = useState<ToquecitoItem[]>([]);

  useEffect(() => {
    if (product === 'toquecitos') {
      api.listToquecitos('demo@ejemplo.com').then(setSampleToquecitos).catch(() => {});
    }
  }, [product]);

  const config = {
    estrellas: {
      badge: 'Próximamente · Toque Estrellas',
      title: 'Más reseñas reales en Google Maps desde el mostrador',
      subtitle:
        'El mismo Cartel QR del local abre directo la pantalla de opinión en Google Maps, sin pasos intermedios ni filtros prohibidos.',
      exampleLabel: 'Ejemplo, así va a verse',
      previewTitle: 'Café del Barrio · Opinar en Google Maps',
      previewDesc: 'Un toque después del café y el cliente deja sus estrellas en 10 segundos.',
      icon: Star,
    },
    recibo: {
      badge: 'Próximamente · Toque Recibo',
      title: 'Comprobante digital en el celular sin gastar rollos de papel',
      subtitle:
        'Emití el comprobante de compra desde el mostrador y el cliente lo abre escaneando el Cartel QR dentro de los 2 minutos.',
      exampleLabel: 'Ejemplo, así va a verse',
      previewTitle: 'Comprobante de compra · $4.800 (Ejemplo)',
      previewDesc: '1 Café con leche + 2 Medialunas · Apertura única y privada en el celular.',
      icon: Receipt,
    },
    toquecitos: {
      badge: 'Próximamente · Toquecitos',
      title: 'Tus insignias de cada visita a tus locales favoritos',
      subtitle:
        'Cada vez que sumás un sello en un comercio con Toque, ganás un Toquecito redondo con el color y la inicial del local.',
      exampleLabel: 'Ejemplo, así va a verse',
      previewTitle: 'Colección de Toquecitos en tu cuenta',
      previewDesc: 'Se suman solos al escanear tu tarjeta del Club.',
      icon: Sparkles,
    },
  }[product];

  const Icon = config.icon;

  return (
    <div className="min-h-screen flex flex-col bg-[#000000] text-[#f1f1ee]">
      <SiteHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] text-xs font-extrabold tracking-wider">
            <Icon className="w-4 h-4" />
            {config.badge}
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-[#f1f1ee]">
            {config.title}
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed max-w-2xl">
            {config.subtitle}
          </p>
        </div>

        <div className="bg-[#111113] border border-[#242426] rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#242426] pb-4">
            <span className="font-extrabold text-base text-[#f1f1ee]">{config.previewTitle}</span>
            <span className="px-3 py-1 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-extrabold">
              {config.exampleLabel}
            </span>
          </div>

          <p className="text-sm sm:text-base text-[#a1a1aa]">{config.previewDesc}</p>

          {product === 'toquecitos' && sampleToquecitos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {sampleToquecitos.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl border border-[#28282a] bg-[#18181b] flex items-center gap-4"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-extrabold text-2xl border border-white/20 shrink-0"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${t.brandColor}, #111113)`,
                    }}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <div className="font-extrabold text-base text-[#f1f1ee] flex items-center gap-2">
                      <span>{t.businessName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
                        Ejemplo
                      </span>
                    </div>
                    <div className="text-xs text-[#a1a1aa] font-medium">
                      Toquecito ganado en visita
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {product !== 'toquecitos' && (
            <div className="p-5 rounded-2xl bg-[#18181b] border border-[#28282a] flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-[#bec8ff]">
                  Integrado con tu Cartel QR actual
                </div>
                <div className="text-base sm:text-lg font-extrabold text-[#f1f1ee]">
                  No necesitás cambiar el cartel del mostrador cuando se active.
                </div>
              </div>
              <QrCode className="w-12 h-12 text-[#bec8ff] shrink-0" />
            </div>
          )}
        </div>

        <div className="bg-[#111113] border border-[#242426] rounded-3xl p-6 sm:p-8 space-y-4">
          <h2 className="text-2xl font-extrabold text-[#f1f1ee]">Anotate en la lista de espera</h2>
          <p className="text-sm sm:text-base text-[#a1a1aa]">
            Dejanos tu mail y te avisamos ni bien esté habilitado. Hoy ya podés usar el{' '}
            <Link to="/club/CAFE01" className="font-bold underline text-[#bec8ff] hover:text-white">
              Club de fidelización
            </Link>
            .
          </p>
          <WaitlistInlineForm product={product} productLabel={config.badge} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export const ForClientsPageView: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#000000] text-[#f1f1ee]">
      <SiteHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] text-xs font-extrabold">
            <Smartphone className="w-4 h-4" />
            Para clientes
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#f1f1ee]">
            Todas tus tarjetas de sellos en el celular, sin bajar ninguna aplicación
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed">
            Escaneás el Cartel QR del comercio, confirmás tu mail una sola vez y sumás sellos en cada visita.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#111113] border border-[#242426] rounded-2xl p-6 space-y-2">
            <div className="text-xs font-extrabold text-[#bec8ff]">Paso 1</div>
            <h2 className="text-xl font-extrabold text-[#f1f1ee]">Escaneás el Cartel</h2>
            <p className="text-sm text-[#a1a1aa]">
              Con la cámara del celular en el mostrador del café, heladería o local de tu barrio.
            </p>
          </div>
          <div className="bg-[#111113] border border-[#242426] rounded-2xl p-6 space-y-2">
            <div className="text-xs font-extrabold text-[#bec8ff]">Paso 2</div>
            <h2 className="text-xl font-extrabold text-[#f1f1ee]">1 sola cuenta Toque</h2>
            <p className="text-sm text-[#a1a1aa]">
              Cuando vas a otro comercio con Toque, te reconoce y sumás la nueva tarjeta con un solo botón.
            </p>
          </div>
          <div className="bg-[#111113] border border-[#242426] rounded-2xl p-6 space-y-2">
            <div className="text-xs font-extrabold text-[#bec8ff]">Paso 3</div>
            <h2 className="text-xl font-extrabold text-[#f1f1ee]">Tus datos cuidados</h2>
            <p className="text-sm text-[#a1a1aa]">
              No pedimos teléfono ni apellido. Y si sos menor de 18 o preferís no dar datos, podés usar una tarjeta sin datos.
            </p>
          </div>
        </div>

        <div className="bg-[#111113] border border-[#242426] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#2fb36a]" />
              <span className="font-extrabold text-xl text-[#f1f1ee]">Probá cómo se ve una tarjeta real</span>
            </div>
            <p className="text-sm text-[#a1a1aa]">
              Abrí el ejemplo interactivo de Café del Barrio y sumá tu primer sello.
            </p>
          </div>
          <Link
            to="/club/CAFE01"
            className="min-h-[48px] px-6 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold flex items-center gap-2 shrink-0 hover:bg-white transition-colors"
          >
            <span>Ver tarjeta de ejemplo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export const FAQ_ITEMS = [
  {
    q: '¿El cliente tiene que bajar alguna aplicación?',
    a: 'No. Escanea el Cartel QR con la cámara de su celular y ve su tarjeta al instante en el navegador o en la billetera del teléfono.',
  },
  {
    q: '¿Cómo se ingresa sin contraseñas?',
    a: 'Tanto vos como tu equipo y tus clientes ingresan escribiendo su mail y poniendo un código de 6 dígitos que llega en el momento. No hay claves para recordar.',
  },
  {
    q: '¿Qué pasa si un cliente no quiere dejar sus datos o es menor de 18 años?',
    a: 'En la pantalla de alta tiene el botón "Prefiero no dar mis datos". Crea una tarjeta con un código al azar en su celular para sumar sellos sin dejar nombre, mail ni cumpleaños.',
  },
  {
    q: '¿Cómo evito que alguien sume sellos de más o borre cosas en el mostrador?',
    a: 'El rol de Cajero solo puede sumar sellos y canjear premios. Si un Dueño o Encargado anula un sello o ajusta un saldo, tiene que escribir un motivo obligatorio y queda guardado para siempre en Correcciones.',
  },
  {
    q: '¿Qué pasa si se vence mi período de prueba o mi suscripción?',
    a: 'El Cartel QR del mostrador y las tarjetas de tus clientes siguen funcionando para que nadie pierda sus sellos; solo se pausan el panel y los avisos hasta que renueves.',
  },
  {
    q: '¿Sirve si tengo más de una sucursal?',
    a: 'Sí. Tu suscripción incluye todos tus locales. Cada local tiene su propio Cartel QR y los clientes suman sellos en cualquiera de ellos.',
  },
];

export const FaqPageView: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen flex flex-col bg-[#000000] text-[#f1f1ee]">
      <SiteHeader />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] text-xs font-extrabold">
            <HelpCircle className="w-4 h-4" />
            Ayuda y preguntas frecuentes
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#f1f1ee]">
            Todo sobre el Club de fidelización de Toque
          </h1>
          <p className="text-sm sm:text-base text-[#a1a1aa]">
            Respuestas claras, sin letra chica.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={item.q}
                className="bg-[#111113] border border-[#242426] rounded-2xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full min-h-[56px] px-5 py-4 text-left font-bold text-base text-[#f1f1ee] flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 text-[#a1a1aa] transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-sm text-[#a1a1aa] border-t border-[#242426] leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};
