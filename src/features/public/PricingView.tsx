import React from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../../components/layout/SiteHeader';
import { TOQUE_PLANS_LIST, TRIAL_DAYS, formatArs } from '../../config/pricing';
import { CheckCircle2, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

export const PricingView: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#000000] text-[#f1f1ee]">
      <SiteHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] text-xs font-bold tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Precios simples</span>
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#f1f1ee]">
            {TRIAL_DAYS} días gratis sin tarjeta. Todos tus locales incluidos.
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa]">
            Pagando el plan anual se cobran solo 10 meses (2 meses gratis).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {TOQUE_PLANS_LIST.map((plan) => (
            <div
              key={plan.id}
              className={`bg-[#111113] border rounded-3xl p-7 flex flex-col justify-between gap-6 ${
                plan.badge ? 'border-[#bec8ff]/50' : 'border-[#242426]'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-2xl font-extrabold text-[#f1f1ee]">{plan.name}</h2>
                  {plan.badge && (
                    <span className="px-3 py-1 rounded-full bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] text-xs font-extrabold">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-4xl font-extrabold text-[#f1f1ee]">{formatArs(plan.priceArs)}</span>
                  <span className="text-sm font-semibold text-[#a1a1aa]">
                    {' '}/ {plan.periodLabel}
                  </span>
                  <p className="text-sm text-[#a1a1aa] mt-1">{plan.description}</p>
                </div>

                <ul className="space-y-2.5 pt-2">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm font-medium text-[#e4e4e7]">
                      <CheckCircle2 className="w-4 h-4 text-[#2fb36a] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                to="/registro"
                className="min-h-[48px] w-full rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold flex items-center justify-center gap-2 hover:bg-white transition-colors"
              >
                <span>Empezar {TRIAL_DAYS} días gratis</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        <div className="bg-[#111113] border border-[#242426] rounded-2xl p-6 flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-[#2fb36a] shrink-0 mt-0.5" />
          <p className="text-sm sm:text-base text-[#a1a1aa]">
            <strong className="text-[#f1f1ee]">¿Qué pasa si vence tu suscripción?</strong> El Cartel QR del local y las tarjetas de tus clientes siguen funcionando para que nadie pierda sus sellos; solo se pausan el panel y el envío de avisos hasta que renueves.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};
