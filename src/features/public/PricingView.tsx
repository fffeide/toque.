import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Check,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Clock,
  ShieldCheck,
  QrCode,
  Zap,
} from 'lucide-react';

export const PricingView: React.FC = () => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const plans = [
    {
      id: 'starter',
      name: 'Comercio Inicial',
      badge: null,
      priceMonthly: 0,
      priceAnnual: 0,
      periodText: 'Gratis en beta',
      description: 'Ideal para locales pequeños que arrancan a recibir reseñas de Google.',
      features: [
        '1 Cartel físico con chip NFC + QR',
        'Enlace directo a reseñas de Google',
        'Hub público básico con redes y datos',
        'Sin cobro de recibos digitales',
        'Soporte por correo electrónico',
      ],
      ctaText: 'Comenzar gratis',
      ctaVariant: 'secundario' as const,
      highlight: false,
    },
    {
      id: 'pro',
      name: 'Comercio Pro',
      badge: 'Recomendado',
      priceMonthly: 7899,
      priceAnnual: 6499, // Con descuento anual
      periodText: billingPeriod === 'monthly' ? '/mes' : '/mes (facturado anual)',
      description: 'El módulo Recibo completo: cobros en caja, comprobantes al instante y club de fidelidad.',
      features: [
        'Carteles físicos inteligentes ilimitados para tus cajas',
        'Módulo Recibo: entrega de comprobantes en 3 minutos',
        'Integración con Mercado Pago QR y cobros posnet/efectivo',
        'Descarga de recibos en imagen y PDF para tus clientes',
        'Club de fidelidad propio: sellos por compra y premios',
        'Botón neutral de reseñas en Google siempre visible',
        'Editor visual del Hub con orden de bloques personalizable',
        'Estadísticas de ventas, comprobantes y opiniones',
        'Soporte prioritario por WhatsApp oficial',
      ],
      ctaText: 'Probar 30 días gratis',
      ctaVariant: 'estrella' as const,
      highlight: true,
    },
    {
      id: 'redes',
      name: 'Multi-Sucursal',
      badge: 'Cadenas',
      priceMonthly: 14999,
      priceAnnual: 12499,
      periodText: billingPeriod === 'monthly' ? '/mes' : '/mes (facturado anual)',
      description: 'Para negocios con varias cajas, salones o múltiples franquicias.',
      features: [
        'Todo lo incluido en Comercio Pro',
        'Múltiples sucursales y gestión centralizada',
        'Gestión de cajas por mozo o cajero',
        'Exportación contable de ventas en CSV',
        'Asesor dedicado de implementación en tu local',
      ],
      ctaText: 'Consultar por sucursales',
      ctaVariant: 'secundario' as const,
      highlight: false,
    },
  ];

  return (
    <div className="aurora-stage min-h-screen text-white flex flex-col">
      {/* Header Liquid Glass */}
      <header className="sticky top-0 z-40 px-4 sm:px-6 py-3.5 backdrop-blur-xl bg-[#121622]/85 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#454BFF] to-[#2D33D0] text-white flex items-center justify-center font-display font-bold text-sm shadow-xs border border-white/20">
              T
            </div>
            <span className="font-display font-bold text-base text-white">
              Toque
            </span>
          </Link>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link to="/" className="text-white/70 hover:text-white transition">
              Inicio
            </Link>
            <Link to="/panel" className="text-white/70 hover:text-white transition">
              Panel
            </Link>
            <Link to="/login" className="text-white/70 hover:text-white transition">
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-10 pb-16">
        {/* Navegación de retorno */}
        <div className="flex items-center justify-between">
          <Link
            to="/panel"
            className="inline-flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al panel</span>
          </Link>

          <Link to="/login" className="text-xs font-semibold text-[#FFC21A] hover:underline">
            ¿Ya tenés cuenta? Ingresá acá
          </Link>
        </div>

        {/* Encabezado Principal */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold uppercase tracking-wider text-[#FFC21A]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Planes transparentes</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
            Planes y Precios de Toque
          </h1>
          <p className="text-sm sm:text-base text-white/75 leading-relaxed">
            Elegí la solución adecuada para tu local. Todos los planes nuevos incluyen{' '}
            <strong className="text-white">30 días de prueba beta gratuita</strong>, luego los comercios abonan su suscripción para mantener activos los recibos y el club.
          </p>
        </div>

        {/* Banner de Prueba Beta de 30 Días */}
        <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/20 flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#FFC21A]/20 flex items-center justify-center shrink-0 border border-[#FFC21A]/30 text-[#FFC21A]">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-xs text-white">
            <p className="font-bold text-sm text-white">Prueba beta de 30 días sin costo</p>
            <p className="text-white/70 mt-0.5 leading-relaxed">
              Activá tu cartel hoy mismo y utilizá el módulo Recibo sin compromiso durante 30 días. Cumplido el período, podés continuar con el plan <strong className="text-[#FFC21A]">Comercio Pro por $7.899/mes</strong>.
            </p>
          </div>
        </div>

        {/* Selector de Período con Transición Fluida */}
        <div className="flex justify-center">
          <div className="bg-white/10 backdrop-blur-xl p-1.5 rounded-2xl flex items-center gap-1 border border-white/15">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 select-none ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-[#0B1030] shadow-md scale-100'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Facturación mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('annual')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 select-none flex items-center gap-1.5 ${
                billingPeriod === 'annual'
                  ? 'bg-white text-[#0B1030] shadow-md scale-100'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <span>Facturación anual</span>
              <span className="text-[10px] uppercase font-extrabold bg-[#FFC21A] text-[#0B1030] px-1.5 py-0.5 rounded">
                -18%
              </span>
            </button>
          </div>
        </div>

        {/* Grilla de Planes con Transición Fluida en Liquid Glass */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const price = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceAnnual;

            return (
              <Card
                key={plan.id}
                padding="lg"
                className={`relative flex flex-col justify-between transition-all duration-300 ${
                  plan.highlight
                    ? 'border-2 border-[#FFC21A] shadow-2xl ring-4 ring-[#FFC21A]/20 bg-white/[0.12]'
                    : 'border border-white/15 bg-white/[0.07]'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-[#FFC21A] text-[#0B1030] text-[11px] font-bold uppercase tracking-wider shadow-md">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <h3 className="font-display font-bold text-xl text-white">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-white/70 mt-1 min-h-[32px] leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  {/* Precio con transición suave */}
                  <div className="py-2 border-y border-white/15">
                    <div className="flex items-baseline gap-1.5 transition-opacity duration-200">
                      {price === 0 ? (
                        <span className="font-display font-bold text-3xl text-white">
                          Gratis
                        </span>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-white/70">$</span>
                          <span className="font-display font-bold text-3xl sm:text-4xl text-white tabular-nums tracking-tight">
                            {price.toLocaleString('es-AR')}
                          </span>
                        </>
                      )}
                      <span className="text-xs text-white/60 font-medium">
                        {plan.periodText}
                      </span>
                    </div>
                  </div>

                  {/* Lista de Características */}
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
                      Incluye:
                    </span>
                    <ul className="space-y-2 text-xs">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-white/90">
                          <div className="w-4 h-4 rounded-full bg-[#19C37D]/20 text-[#19C37D] flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Botón de Acción */}
                <div className="pt-6 mt-6 border-t border-white/15">
                  <Link to="/registro">
                    <Button
                      variant={plan.ctaVariant}
                      size="touch"
                      fullWidth
                      icon={<ArrowRight className="w-4 h-4" />}
                      className={plan.ctaVariant === 'secundario' ? 'bg-white/10 text-white border-white/20 hover:bg-white/15' : ''}
                    >
                      {plan.ctaText}
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Garantías */}
        <div className="pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-2xl bg-white/[0.07] border border-white/15 space-y-1.5">
            <ShieldCheck className="w-6 h-6 text-[#19C37D] mx-auto" />
            <h4 className="font-bold text-xs text-white">Sin permanencia</h4>
            <p className="text-[11px] text-white/60">Cancelá cuando quieras con un solo clic desde tu panel.</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.07] border border-white/15 space-y-1.5">
            <Sparkles className="w-6 h-6 text-[#FFC21A] mx-auto" />
            <h4 className="font-bold text-xs text-white">30 días beta gratis</h4>
            <p className="text-[11px] text-white/60">Comenzá sin ingresar tarjeta de crédito por 30 días.</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.07] border border-white/15 space-y-1.5">
            <QrCode className="w-6 h-6 text-[#3A3FE0] mx-auto" />
            <h4 className="font-bold text-xs text-white">Carteles acrílicos NFC</h4>
            <p className="text-[11px] text-white/60">Soportes físicos resistentes preparados para alto tránsito.</p>
          </div>
        </div>
      </main>
    </div>
  );
};
