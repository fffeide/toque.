import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../components/ui/Button';
import {
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  QrCode,
  Zap,
  HelpCircle,
  ChevronDown,
  Clock,
  Receipt,
  Smartphone,
  Award,
} from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  priceMonthly: number;
  priceAnnual: number;
  periodLabel: string;
  description: string;
  features: string[];
  notIncluded?: string[];
  ctaText: string;
  ctaVariant: 'estrella' | 'ultramar' | 'secundario';
  isPopular?: boolean;
}

export const PricingView: React.FC = () => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const plans: PricingPlan[] = [
    {
      id: 'starter',
      name: 'Comercio Inicial',
      tagline: 'Para locales que arrancan',
      priceMonthly: 0,
      priceAnnual: 0,
      periodLabel: 'Gratis en beta',
      description: 'Cartel de mostrador para recibir reseñas de Google y presentar tu local.',
      features: [
        '1 Cartel físico con chip NFC + QR',
        'Enlace directo a reseñas de Google en 1 toque',
        'Hub público básico con redes y horarios',
        'Sin límite de toques ni lecturas NFC',
        'Estadísticas básicas de clics',
      ],
      notIncluded: [
        'Módulo Recibo (comprobantes de compra)',
        'Club de fidelidad propio y pases Wallet',
        'Multi-caja y exportación contable',
      ],
      ctaText: 'Comenzar gratis',
      ctaVariant: 'secundario',
      isPopular: false,
    },
    {
      id: 'pro',
      name: 'Comercio Pro',
      tagline: 'La solución completa para tu mostrador',
      badge: 'MÁS ELEGIDO · 30 DÍAS GRATIS',
      priceMonthly: 7899,
      priceAnnual: 6499,
      periodLabel: billingPeriod === 'monthly' ? '/mes' : '/mes (anual)',
      description: 'Emisión de comprobantes en caja en 3 min, club de fidelidad y reseñas aseguradas.',
      features: [
        'Carteles físicos inteligentes para todas tus cajas',
        'Módulo Recibo: comprobantes digitales al instante (cero papel)',
        'Cobros por Mercado Pago QR, posnet o efectivo',
        'Descarga de recibos en imagen y PDF para clientes',
        'Club de fidelidad Toque & WalletWallet (sellos y pases)',
        'Botón neutral de reseñas Google siempre activo',
        'Editor de Hub con catálogo y redes sociales',
        'Métricas completas de ventas, toques y opiniones',
      ],
      ctaText: 'Probar 30 días gratis',
      ctaVariant: 'ultramar',
      isPopular: true,
    },
    {
      id: 'enterprise',
      name: 'Multi-Sucursal',
      tagline: 'Cadenas, salones y franquicias',
      badge: 'REDES & EQUIPOS',
      priceMonthly: 14999,
      priceAnnual: 12499,
      periodLabel: billingPeriod === 'monthly' ? '/mes' : '/mes (anual)',
      description: 'Control centralizado de múltiples locales, permisos por cajero y reportes contables.',
      features: [
        'Todo lo incluido en Comercio Pro',
        'Múltiples sucursales y cajas independientes',
        'Niveles y permisos por rol: Dueño, Encargado y Cajero',
        'Historial consolidado de ventas y exportación CSV',
        'Personalización de marca en carteles y comprobantes',
        'Asesor dedicado de implementación presencial/remota',
      ],
      ctaText: 'Comenzar con sucursales',
      ctaVariant: 'secundario',
      isPopular: false,
    },
  ];

  const faqs = [
    {
      q: '¿Cómo funciona la prueba beta gratuita de 30 días?',
      a: 'Comenzás inmediatamente al registrarte sin necesidad de ingresar tarjeta de crédito. Tenés acceso total al Módulo Recibo, pantalla de caja y carteles inteligentes. Al término de los 30 días, podés continuar con el abono de Comercio Pro o mantener la versión básica gratuita.',
    },
    {
      q: '¿Cómo recibo el cartel físico de acrílico?',
      a: 'Una vez creada tu cuenta, asignamos tu código de caja (por ejemplo CAJA01). Podés imprimir el respaldo QR al instante desde tu panel mientras coordinamos la entrega del cartel con chip NFC NTAG213 grabado en acrílico de alta resistencia.',
    },
    {
      q: '¿El cliente o el cajero necesitan instalar una app?',
      a: 'No. El cliente solo acerca su teléfono (iPhone o Android) al cartel o escanea el QR con la cámara de su celular. El recibo se abre directamente en el navegador del celular en menos de 1 segundo.',
    },
    {
      q: '¿Qué es el Módulo Recibo y qué validez tiene?',
      a: 'Es un comprobante de compra digital no fiscal diseñado para que tu cliente conserve el detalle de su compra sin gastar papel térmico. Cumple con la ley de reducción de residuos y permanece disponible por 3 minutos en el cartel para guardarse en foto o PDF.',
    },
    {
      q: '¿Puedo cancelar o cambiar de plan cuando quiera?',
      a: 'Sí. No tenemos contratos ni cláusulas de permanencia. Podés pausar o cancelar tu suscripción con un solo clic directamente desde la pestaña Mi Cuenta de tu panel.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col selection:bg-[#bec8ff] selection:text-[#0c0c0c]">
      {/* 1. HEADER TOQUE™ UNIFICADO (Idéntico a la web) */}
      <header className="sticky top-0 z-40 w-full bg-[#000000]/90 backdrop-blur-md border-b border-[#242426] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo toque™ */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full bg-[#f1f1ee] border border-[#242426] flex items-center justify-center transition-transform group-hover:scale-105">
              <img src="/assets/logo.svg" alt="" className="w-5 h-5 object-contain" />
            </div>
            <span className="font-bold text-lg tracking-tight text-[#f1f1ee]">toque™</span>
          </Link>

          {/* Nav Pills Desktop */}
          <nav className="hidden md:flex items-center gap-1 bg-[#111113] border border-[#242426] px-2 py-1 rounded-full text-xs font-medium">
            <Link
              to="/#inicio"
              className="px-3.5 py-1.5 rounded-full text-[#a1a1aa] hover:text-[#f1f1ee] transition-colors"
            >
              Inicio
            </Link>
            <Link
              to="/#como-funciona"
              className="px-3.5 py-1.5 rounded-full text-[#a1a1aa] hover:text-[#f1f1ee] transition-colors"
            >
              Cómo funciona
            </Link>
            <Link
              to="/#recibo"
              className="px-3.5 py-1.5 rounded-full text-[#a1a1aa] hover:text-[#f1f1ee] transition-colors"
            >
              Módulo recibo
            </Link>
            <span className="px-3.5 py-1.5 rounded-full bg-[#28282a] text-[#f1f1ee] font-semibold">
              Precios
            </span>
            <Link
              to="/caja"
              className="px-3.5 py-1.5 rounded-full text-[#34d399] hover:bg-[#18181b] transition-colors"
            >
              Caja
            </Link>
          </nav>

          {/* Botones de acción derecha */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/panel"
              className="hidden sm:inline-flex text-xs font-semibold px-3.5 py-2 rounded-xl text-[#a1a1aa] hover:text-[#f1f1ee] hover:bg-[#111113] border border-transparent hover:border-[#242426] transition-all"
            >
              Ir a mi panel
            </Link>
            <Link
              to="/login"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#343438] hover:bg-[#18181b] text-[#f1f1ee] transition-colors"
            >
              Ingresar
            </Link>

            {/* Mobile burger */}
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Abrir menú"
              className="md:hidden w-9 h-9 rounded-xl bg-[#111113] border border-[#242426] flex items-center justify-center text-[#f1f1ee]"
            >
              <div className="w-4 flex flex-col gap-1">
                <span className={`block h-0.5 bg-[#f1f1ee] transition-transform ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                <span className={`block h-0.5 bg-[#f1f1ee] transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 bg-[#f1f1ee] transition-transform ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu sheet */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-[#242426] bg-[#0c0c0c] px-4 py-3 space-y-2 text-sm"
            >
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-[#a1a1aa] hover:text-[#f1f1ee] hover:bg-[#18181b]"
              >
                Inicio
              </Link>
              <Link
                to="/#como-funciona"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-[#a1a1aa] hover:text-[#f1f1ee] hover:bg-[#18181b]"
              >
                Cómo funciona
              </Link>
              <Link
                to="/#recibo"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-[#a1a1aa] hover:text-[#f1f1ee] hover:bg-[#18181b]"
              >
                Módulo recibo
              </Link>
              <Link
                to="/caja"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-[#34d399] font-medium hover:bg-[#18181b]"
              >
                Pantalla de caja
              </Link>
              <Link
                to="/panel"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-[#bec8ff] font-medium hover:bg-[#18181b]"
              >
                Panel del comercio
              </Link>
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-center font-bold bg-[#18181b] border border-[#28282a] text-[#f1f1ee]"
              >
                Iniciar sesión
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. MAIN CONTENT */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12 pb-24">
        {/* Encabezado Principal */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111113] border border-[#242426] text-xs font-medium text-[#c4c2c3]"
          >
            <span className="w-2 h-2 rounded-full bg-[#2fb36a]" />
            <span className="text-[#f1f1ee] font-semibold">30 días beta gratis</span>
            <span className="text-[#a1a1aa]">· Sin tarjeta requerida</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-3xl sm:text-5xl font-bold tracking-tight text-[#f1f1ee] leading-[1.12]"
          >
            Tu mostrador con datos, a un precio simple y claro
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-sm sm:text-base text-[#a1a1aa] leading-relaxed max-w-2xl mx-auto"
          >
            Elegí el plan para tu negocio. Todos los planes nuevos incluyen 30 días de prueba sin cargo para emitir comprobantes de compra, sumar clientes al club y recibir reseñas en Google.
          </motion.p>
        </div>

        {/* Toggle de Facturación Mensual / Anual con Transición Fluida */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="flex justify-center"
        >
          <div className="bg-[#111113] border border-[#242426] p-1 rounded-2xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all select-none cursor-pointer ${
                billingPeriod === 'monthly'
                  ? 'bg-[#f1f1ee] text-[#0c0c0c] shadow-sm'
                  : 'text-[#a1a1aa] hover:text-[#f1f1ee]'
              }`}
            >
              Facturación mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('annual')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all select-none cursor-pointer flex items-center gap-2 ${
                billingPeriod === 'annual'
                  ? 'bg-[#f1f1ee] text-[#0c0c0c] shadow-sm'
                  : 'text-[#a1a1aa] hover:text-[#f1f1ee]'
              }`}
            >
              <span>Facturación anual</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                billingPeriod === 'annual'
                  ? 'bg-[#bec8ff] text-[#0c0c0c]'
                  : 'bg-[#bec8ff]/20 text-[#bec8ff]'
              }`}>
                -18% OFF
              </span>
            </button>
          </div>
        </motion.div>

        {/* Grilla de 3 Planes Mate Dark Flat */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pt-2">
          {plans.map((plan, index) => {
            const price = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
            const isHighlight = plan.isPopular;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 + index * 0.08 }}
                className={`relative rounded-2xl bg-[#111113] p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 ${
                  isHighlight
                    ? 'border-2 border-[#bec8ff] shadow-[0_0_24px_rgba(190,200,255,0.08)] ring-1 ring-[#bec8ff]/30'
                    : 'border border-[#242426] hover:border-[#343438]'
                }`}
              >
                {/* Badge superior */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-3.5 py-1 rounded-full bg-[#bec8ff] text-[#0c0c0c] text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                      {plan.tagline}
                    </span>
                    <h3 className="text-2xl font-bold text-[#f1f1ee] tracking-tight mt-1">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed min-h-[36px]">
                      {plan.description}
                    </p>
                  </div>

                  {/* Precio con transición suave */}
                  <div className="py-4 border-y border-[#242426]">
                    <div className="flex items-baseline gap-1.5">
                      {price === 0 ? (
                        <span className="text-3xl sm:text-4xl font-bold text-[#f1f1ee] tracking-tight">
                          Gratis
                        </span>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-[#a1a1aa]">$</span>
                          <span className="text-3xl sm:text-4xl font-bold text-[#f1f1ee] tabular-nums tracking-tight">
                            {price.toLocaleString('es-AR')}
                          </span>
                        </>
                      )}
                      <span className="text-xs text-[#a1a1aa] font-medium">
                        {plan.periodLabel}
                      </span>
                    </div>
                    {price > 0 && billingPeriod === 'annual' && (
                      <p className="text-[11px] text-[#2fb36a] mt-1 font-medium">
                        Ahorrás ${(plan.priceMonthly * 12 - plan.priceAnnual * 12).toLocaleString('es-AR')} al año
                      </p>
                    )}
                  </div>

                  {/* Características */}
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider block">
                      Lo que incluye:
                    </span>
                    <ul className="space-y-2.5 text-xs">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-[#f1f1ee]/90">
                          <div className="w-4 h-4 rounded-full bg-[#2fb36a]/15 text-[#2fb36a] flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                      {plan.notIncluded?.map((feat, idx) => (
                        <li key={`not-${idx}`} className="flex items-start gap-2.5 text-[#a1a1aa]/50 line-through">
                          <div className="w-4 h-4 rounded-full bg-[#242426] text-[#a1a1aa]/50 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] leading-none">✕</span>
                          </div>
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Botón CTA con query params */}
                <div className="pt-6 mt-6 border-t border-[#242426]">
                  <Link
                    to={`/registro?plan=${plan.id}&billing=${billingPeriod}`}
                    className="block w-full"
                  >
                    <Button
                      variant={plan.ctaVariant}
                      size="touch"
                      fullWidth
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      {plan.ctaText}
                    </Button>
                  </Link>
                  <p className="text-[11px] text-[#a1a1aa] text-center mt-2.5">
                    {plan.id === 'starter'
                      ? 'Sin tarjeta de crédito'
                      : '30 días gratis · Cancelás en 1 clic'}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* 3. BLOQUE DE VALOR / CONFIANZA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#2fb36a]/15 text-[#2fb36a] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-sm text-[#f1f1ee]">Sin permanencia obligatoria</h4>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Cancelá en cualquier momento desde tu panel con un solo clic. Cero trámites ni penalidades.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-sm text-[#f1f1ee]">Carteles NFC grabados en láser</h4>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Acrílico ultra resistente preparado para alto tránsito en mostradores de café, gastronomía y retail.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-2">
            <div className="w-8 h-8 rounded-xl bg-[#f1f1ee]/10 text-[#f1f1ee] flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-sm text-[#f1f1ee]">Cero papel térmico</h4>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Ahorrá en rollos de ticket tóxicos. Tus clientes conservan su comprobante en su teléfono al instante.
            </p>
          </div>
        </div>

        {/* 4. PREGUNTAS FRECUENTES (FAQ INTERACTIVO) */}
        <section className="pt-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#f1f1ee] tracking-tight">
              Preguntas frecuentes
            </h2>
            <p className="text-xs sm:text-sm text-[#a1a1aa]">
              Todo lo que necesitás saber antes de sumar Toque a tu local.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-[#111113] border border-[#242426] overflow-hidden transition-colors hover:border-[#343438]"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <span className="text-sm font-semibold text-[#f1f1ee]">{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#a1a1aa] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#bec8ff]' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-[#a1a1aa] leading-relaxed border-t border-[#242426] pt-3">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. CALLOUT FINAL DE CONVERSIÓN */}
        <div className="rounded-3xl p-8 sm:p-12 bg-[#111113] border border-[#242426] text-center space-y-5 max-w-4xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#f1f1ee] border border-[#242426] flex items-center justify-center mx-auto">
            <img src="/assets/logo.svg" alt="" className="w-7 h-7 object-contain" />
          </div>
          <div className="space-y-2 max-w-xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-bold text-[#f1f1ee] tracking-tight">
              ¿Listo para modernizar tu mostrador?
            </h3>
            <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
              Creá tu cuenta en 1 minuto, obtené tu primer cartel inteligente y empezá a emitir comprobantes digitales hoy mismo.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link to="/registro?plan=pro">
              <Button variant="ultramar" size="touch" icon={<ArrowRight className="w-4 h-4" />}>
                Comenzar prueba de 30 días
              </Button>
            </Link>
            <Link to="/panel">
              <Button variant="secundario" size="touch">
                Ver panel demo
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* 6. BARRA FLOTANTE MÓVIL STICKY (Mejora para celular en flujo de compra) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-[#0c0c0c]/95 backdrop-blur-md border-t border-[#242426] z-30 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Plan Pro</p>
          <p className="text-xs font-bold text-[#f1f1ee] truncate">
            {billingPeriod === 'monthly' ? '$7.899/mes' : '$6.499/mes'} · 30 días gratis
          </p>
        </div>
        <Link to={`/registro?plan=pro&billing=${billingPeriod}`} className="shrink-0">
          <Button variant="ultramar" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
            Elegir plan
          </Button>
        </Link>
      </div>

      {/* 7. FOOTER */}
      <footer className="border-t border-[#242426] bg-[#0c0c0c] py-8 text-center text-xs text-[#a1a1aa] space-y-3">
        <div className="flex justify-center items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#f1f1ee] flex items-center justify-center">
            <img src="/assets/logo.svg" alt="" className="w-3 h-3 object-contain" />
          </div>
          <span className="font-bold text-[#f1f1ee]">toque™</span>
        </div>
        <p>© {new Date().getFullYear()} toque™ — Plataforma SaaS para comercios con carteles inteligentes.</p>
        <div className="flex flex-wrap justify-center items-center gap-4 text-[11px] text-[#a1a1aa]">
          <Link to="/terminos" className="hover:text-[#f1f1ee]">
            Términos y Condiciones
          </Link>
          <Link to="/privacidad" className="hover:text-[#f1f1ee]">
            Privacidad
          </Link>
          <Link to="/cookies" className="hover:text-[#f1f1ee]">
            Cookies y Clarity
          </Link>
          <Link to="/reembolso" className="hover:text-[#f1f1ee]">
            Reembolsos
          </Link>
          <Link to="/arrepentimiento" className="hover:text-[#f1f1ee]">
            Botón de Arrepentimiento
          </Link>
        </div>
      </footer>
    </div>
  );
};
