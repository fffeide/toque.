import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/ui/Avatar';
import { TOQUE_PLANS_LIST, TRIAL_DAYS, formatArs } from '../../config/pricing';
import { WaitlistInlineForm } from './PublicPagesView';
import {
  QrCode,
  Award,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Star,
  Receipt,
  Sparkles,
  Wifi,
  Lock,
} from 'lucide-react';

export const LandingView: React.FC = () => {
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F6] flex flex-col justify-between selection:bg-[#D95B26] selection:text-white">
      {/* Top Navbar */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between border-b border-[#242424]">
        <Link to="/" aria-label="Inicio Toque">
          <BrandLogo variant="full" size="md" />
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/u/MONROE01"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-[#1C1C22] border border-[#242424] text-xs font-semibold text-[#9E9EA8] hover:text-white transition-colors"
          >
            <span>Demo Hub en vivo</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#D95B26]" />
          </Link>
          <Link
            to="/ingresar"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141414] hover:bg-[#1C1C22] border border-[#242424] text-xs sm:text-sm font-bold text-[#F4F4F6] transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-[#D95B26]" />
            <span>Ingresar a mi cuenta</span>
          </Link>
        </div>
      </header>

      {/* Main Hero: Portada Institucional de Prelanzamiento ("Tactile Hardware") */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge de Beta Privada */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#141414] border border-[#D95B26]/40 text-xs font-bold text-[#F4F4F6] shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#D95B26] animate-pulse" />
            <span className="text-xs text-[#D95B26] font-extrabold">
              Plataforma en beta privada
            </span>
            <span className="text-[#666672]">—</span>
            <span className="text-[#9E9EA8]">Próximamente disponible</span>
          </div>

          {/* Brand Logo Central & Headline */}
          <div className="flex flex-col items-center space-y-5">
            <BrandLogo variant="full" size="lg" className="justify-center" />
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.08] text-[#F4F4F6]">
              El cartel inteligente{' '}
              <span className="text-[#D95B26]">NFC + QR</span> para tu mostrador.
            </h1>
            <p className="max-w-2xl text-base sm:text-lg text-[#9E9EA8] leading-relaxed">
              El cartel inteligente NFC + QR para tu mostrador: comprobantes digitales en vivo,
              club de sellos en Wallet y reseñas en un toque. Sin apps, sin contraseñas y con
              reconocimiento automático en cada visita.
            </p>
          </div>

          {/* Botones principales: Ingresar a mi cuenta / Lista de espera */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={() => setShowWaitlistModal((v) => !v)}
              className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-2xl bg-[#D95B26] hover:bg-[#e46630] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#D95B26]/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Anotarme en la lista de espera</span>
            </button>

            <Link
              to="/ingresar"
              className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-[#F4F4F6] font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>Ingresar a mi cuenta (Comercios habilitados)</span>
              <ArrowRight className="w-4 h-4 text-[#BEC8FF]" />
            </Link>
          </div>

          {/* Formulario de Lista de Espera Desplegable o Directo */}
          {showWaitlistModal && (
            <div className="max-w-md mx-auto mt-6 p-6 rounded-3xl bg-[#141414] border border-[#242424] text-left shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#D95B26]">
                  Acceso anticipado · Lista de espera
                </span>
                <button
                  type="button"
                  onClick={() => setShowWaitlistModal(false)}
                  className="text-xs text-[#9E9EA8] hover:text-white cursor-pointer"
                >
                  Cerrar ✕
                </button>
              </div>
              <p className="text-xs text-[#9E9EA8] mb-4">
                Dejanos tu correo para avisarte apenas habilitemos nuevos cupos de comercios.
              </p>
              <WaitlistInlineForm product="estrellas" productLabel="Acceso Anticipado Toque" />
            </div>
          )}

          {/* 3 Pilares */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 text-left">
            <div className="p-5 rounded-2xl bg-[#141414] border border-[#242424] space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#D95B26]/15 border border-[#D95B26]/30 text-[#D95B26] flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-[#F4F4F6]">Comprobantes en vivo</h2>
              <p className="text-xs text-[#9E9EA8] leading-relaxed">
                Tu Caja POS emite el ticket digital al instante en el cartel del mostrador sin gastar
                rollos de papel térmico.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#141414] border border-[#242424] space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#2FB36A]/15 border border-[#2FB36A]/30 text-[#2FB36A] flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-[#F4F4F6]">Tarjetas y Wallet</h2>
              <p className="text-xs text-[#9E9EA8] leading-relaxed">
                Registro de 1 sola vez en segundos. El cliente guarda su tarjeta en Apple o Google Wallet y suma 1 sello por día al visitar el local.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#141414] border border-[#242424] space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#BEC8FF]/15 border border-[#BEC8FF]/30 text-[#BEC8FF] flex items-center justify-center">
                <Star className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-[#F4F4F6]">Reseñas y lector rápido</h2>
              <p className="text-xs text-[#9E9EA8] leading-relaxed">
                Compatible con lectores de mostrador y cámara del celular para validar premios y sumar sellos en menos de 1 segundo.
              </p>
            </div>
          </div>

          {/* Vista Previa de Planes Pro ($34.999 y Trial 14 días en Anual) */}
          <div className="pt-10 border-t border-[#242424] text-left space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#D95B26]">
                  Suscripciones para comercios
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#F4F4F6] mt-0.5">
                  Planes transparentes · {TRIAL_DAYS} días de prueba en el Plan Anual
                </h2>
              </div>
              <Link
                to="/u/MONROE01"
                className="text-xs font-bold text-[#BEC8FF] hover:underline flex items-center gap-1"
              >
                <Wifi className="w-3.5 h-3.5 text-[#D95B26]" />
                <span>Probar Hub interactivo de ejemplo →</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TOQUE_PLANS_LIST.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-5 flex flex-col justify-between gap-4 border ${
                    plan.id === 'anual'
                      ? 'bg-[#1C1C22] border-[#D95B26]/60'
                      : 'bg-[#141418] border-[#282830]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-base text-[#F4F4F6]">{plan.name}</span>
                      {plan.badge && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#D95B26]/20 border border-[#D95B26]/40 text-[#D95B26] text-[10px] font-extrabold">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-2xl font-extrabold text-[#F4F4F6]">
                        {plan.priceArs === 0 ? 'Gratis' : formatArs(plan.priceArs)}
                      </span>
                      {plan.priceArs > 0 && (
                        <span className="text-xs text-[#9E9EA8]"> / {plan.periodLabel}</span>
                      )}
                      <p className="text-xs text-[#9E9EA8] mt-1">{plan.description}</p>
                    </div>
                    <ul className="space-y-1.5 pt-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-[#F4F4F6]/90">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2FB36A] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Discreto */}
      <footer className="w-full border-t border-[#282830] bg-[#141418]/60 py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9E9EA8]">
          <div className="flex items-center gap-3">
            <BrandLogo variant="badge" />
            <span>© {new Date().getFullYear()} Toque · República Argentina · Ley 25.326</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/privacidad" className="hover:text-white transition-colors">
              Privacidad
            </Link>
            <Link to="/terminos" className="hover:text-white transition-colors">
              Términos
            </Link>
            <Link to="/arrepentimiento" className="hover:text-white transition-colors">
              Arrepentimiento
            </Link>
            <Link to="/ingresar" className="text-[#BEC8FF] font-semibold hover:text-white">
              Acceso Comercios
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
