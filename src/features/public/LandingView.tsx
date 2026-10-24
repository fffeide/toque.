import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/hero-landing.css';
import { TOQUE_PLANS_LIST, TRIAL_DAYS, formatArs } from '../../config/pricing';
import { WaitlistInlineForm, FAQ_ITEMS } from './PublicPagesView';
import {
  QrCode,
  Award,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Store,
  Star,
  Receipt,
  Sparkles,
  ChevronDown,
  Coffee,
  Scissors,
  ShoppingBag,
  Utensils,
} from 'lucide-react';

export const LandingView: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="toque-landing-root">
      {/* =====================================================================
          1. VIEWPORT HERO (Exact hero-landing.css layout + video background)
          ===================================================================== */}
      <div className="toque-viewport">
        <div className="bg" aria-hidden="true">
          <video
            className="bg-video"
            autoPlay
            loop
            muted
            playsInline
            poster="/storm-background.jpg"
          >
            <source
              src="https://d2j9b4b8b5b9b0.cloudfront.net/storm-hero.mp4"
              type="video/mp4"
            />
          </video>
        </div>

        <div className="page">
          {/* Header (Desktop pill + Mobile burger) */}
          <header className="site-header" aria-label="Navegación principal">
            <Link to="/" className="logo-btn" aria-label="Inicio Toque">
              <img src="/assets/logo.svg" alt="toque™" />
            </Link>

            <nav className="nav-pill" aria-label="Secciones">
              <a href="#como-funciona" className="nav-link active">
                Cómo funciona
              </a>
              <a href="#funciones" className="nav-link">
                Club
              </a>
              <Link to="/para-clientes" className="nav-link">
                Clientes
              </Link>
              <a href="#precios" className="nav-link">
                Precios
              </a>
              <Link to="/preguntas" className="nav-link">
                Ayuda
              </Link>
            </nav>

            <Link to="/ingresar" className="sign-in-pill">
              Ingresar
            </Link>

            <button
              type="button"
              className={`burger-btn ${mobileMenuOpen ? 'is-open' : ''}`}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="burger-bar" />
              <span className="burger-bar" />
              <span className="burger-bar" />
            </button>
          </header>

          {mobileMenuOpen && (
            <>
              <div
                className="mobile-overlay"
                onClick={() => setMobileMenuOpen(false)}
              />
              <nav className="mobile-sheet" aria-label="Menú móvil">
                <a
                  href="#como-funciona"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mobile-nav-link active"
                >
                  Cómo funciona
                </a>
                <a
                  href="#funciones"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mobile-nav-link"
                >
                  Funciones y Club
                </a>
                <Link
                  to="/para-clientes"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mobile-nav-link"
                >
                  Para clientes
                </Link>
                <a
                  href="#precios"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mobile-nav-link"
                >
                  Precios
                </a>
                <Link
                  to="/preguntas"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mobile-nav-link"
                >
                  Preguntas frecuentes
                </Link>
                <Link
                  to="/ingresar"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mobile-sign-in"
                >
                  Ingresar a mi cuenta
                </Link>
              </nav>
            </>
          )}

          {/* Center Hero */}
          <section className="hero">
            <div className="trust-row anim" style={{ ['--d' as any]: '0.05s' }}>
              <div className="trust-avatar a1">
                <div className="trust-avatar-inner">★</div>
              </div>
              <div className="trust-avatar a2">
                <div className="trust-avatar-inner">♥</div>
              </div>
              <div className="trust-avatar a3">
                <div className="trust-avatar-inner">✓</div>
              </div>
              <div className="trust-pill">
                Club de fidelización para comercios · Sin apps ni contraseñas
              </div>
            </div>

            <h1 className="headline anim">
              <span className="headline-line line-1 text-[#000000]">Tu cartel,</span>
              <span className="headline-line line-2">con clientes fieles.</span>
            </h1>

            <p className="subhead anim" style={{ ['--d' as any]: '0.25s' }}>
              La tarjeta de sellos de tu local directo en el celular de tus clientes. Escanean el Cartel QR del mostrador, suman sellos en cada visita y vuelven por su premio.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/registro"
                className="cta-btn anim-pulse"
                style={{ ['--d' as any]: '0.35s' }}
              >
                Probar {TRIAL_DAYS} días gratis
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#28282a]/90 border border-white/25 text-white text-sm font-medium hover:bg-[#323234] transition-colors"
              >
                Ver cómo funciona
              </a>
            </div>

            <div className="hero-sublinks">
              <Link to="/club/CAFE01">Ver tarjeta de sellos (Ejemplo) →</Link>
              <span>·</span>
              <Link to="/ingresar">Acceso comercios y equipo</Link>
            </div>
          </section>

          {/* Stats Footer (4 exact items) */}
          <div className="stats-footer anim" style={{ ['--d' as any]: '0.45s' }}>
            <div className="stat-item">
              <div className="stat-icon">15s</div>
              <div className="stat-value">Sin bajar apps</div>
              <div className="stat-label">Alta con código de 6 dígitos por mail</div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">QR</div>
              <div className="stat-value">2 modos</div>
              <div className="stat-label">Escanea el comercio o el cliente</div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">+18</div>
              <div className="stat-value">Ley 25.326</div>
              <div className="stat-label">Opción sin datos para menores</div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">A5</div>
              <div className="stat-value">{TRIAL_DAYS} días gratis</div>
              <div className="stat-label">Cartel listo para imprimir hoy</div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MARQUEE INTEGRATIONS & VISTA PREVIA DE TARJETA (ROTULADA "EJEMPLO")
          ===================================================================== */}
      <section className="bg-[#000000] border-t border-[#242426] py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Marquee de billeteras y tecnologías */}
          <div className="marquee-wrapper overflow-hidden py-3 border-y border-[#1f1f22]">
            <div className="marquee-track items-center gap-14">
              {[1, 2].map((loop) => (
                <div key={loop} className="flex items-center gap-14 pr-14">
                  <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                    <img src="/assets/logos/apple-wallet.svg" alt="" className="h-6 w-auto" />
                    <span>Apple Wallet</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                    <img src="/assets/logos/google-wallet.svg" alt="" className="h-6 w-auto" />
                    <span>Google Wallet</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                    <img src="/assets/logos/google-maps.svg" alt="" className="h-6 w-auto" />
                    <span>Google Maps</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                    <img src="/assets/logos/mercado-pago.svg" alt="" className="h-6 w-auto" />
                    <span>Comercios de cercanía</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tarjeta interactiva de ejemplo */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#111113] border border-[#242426] rounded-3xl p-6 sm:p-10">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] text-xs font-bold uppercase tracking-wider">
                <span>Vista previa interactiva</span>
                <span>·</span>
                <span className="text-[#f59e0b]">Ejemplo</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#f1f1ee]">
                Así ve el cliente la tarjeta de tu local en su celular
              </h2>
              <p className="text-sm sm:text-base text-[#a1a1aa] leading-relaxed">
                Sin contraseñas ni formularios eternos: solo cómo lo conocen, su mail y opcionalmente día y mes de cumpleaños para que el local lo salude ese día. También puede elegir usarla sin datos.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/club/CAFE01"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-sm hover:bg-white transition-colors"
                >
                  <span>Abrir tarjeta de ejemplo</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/para-clientes"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#18181b] border border-[#28282a] text-[#f1f1ee] font-semibold text-sm hover:border-[#3f3f46] transition-colors"
                >
                  <span>Cómo funciona para clientes</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-[#18181b] border border-[#28282a] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#a1a1aa]">
                    Tarjeta web del cliente
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 text-[11px] font-bold text-[#f59e0b]">
                    Ejemplo
                  </span>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-[#d97706] to-[#92400e] text-white p-5 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-black/25 flex items-center justify-center font-extrabold text-base">
                        CB
                      </div>
                      <div>
                        <div className="font-bold text-base leading-tight">
                          Café del Barrio
                        </div>
                        <div className="text-xs text-white/85">
                          Premio: 1 Café + Medialuna sin cargo
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-black/30 text-xs font-bold">
                      4 / 10 sellos
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-9 rounded-xl border border-white/40 flex items-center justify-center font-bold text-xs ${
                          i < 4 ? 'bg-white text-[#0c0c0c]' : 'bg-black/20 text-white/75'
                        }`}
                      >
                        {i < 4 ? '★' : i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. CÓMO FUNCIONA (3 pasos simples)
          ===================================================================== */}
      <section id="como-funciona" className="bg-[#000000] border-t border-[#242426] py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#bec8ff]">
              Cómo funciona
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f1f1ee]">
              En 3 pasos cortos, sin instalar nada en tu mostrador
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] font-bold flex items-center justify-center text-base">
                1
              </div>
              <h3 className="text-xl font-bold text-[#f1f1ee]">Elegís tu premio y tu color</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                Configurás cuántos sellos hacen falta (por visita o por monto de compra) y el premio que entregás al completar.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] font-bold flex items-center justify-center text-base">
                2
              </div>
              <h3 className="text-xl font-bold text-[#f1f1ee]">Imprimís el Cartel QR</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                Tu panel genera una hoja A5 lista para imprimir y apoyar junto a la caja. Cada local tiene su propio código.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] font-bold flex items-center justify-center text-base">
                3
              </div>
              <h3 className="text-xl font-bold text-[#f1f1ee]">Sumás sellos en segundos</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                El cajero escanea la tarjeta del cliente o el cliente escanea el Cartel del mostrador. Todo queda registrado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. FUNCIONES: Club (disponible hoy) + Próximamente con lista de espera
          ===================================================================== */}
      <section id="funciones" className="bg-[#000000] border-t border-[#242426] py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#bec8ff]">
              Funciones
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f1f1ee]">
              Lo que ya podés usar hoy y lo que se viene
            </h2>
          </div>

          {/* Disponible hoy: Club */}
          <div className="bg-[#111113] border border-[#242426] rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#2fb36a]/15 border border-[#2fb36a]/30 text-[#2fb36a] flex items-center justify-center">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#2fb36a]/15 border border-[#2fb36a]/30 text-[#2fb36a] text-xs font-bold uppercase">
                    Disponible hoy
                  </span>
                  <h3 className="text-2xl font-bold text-[#f1f1ee] mt-1">
                    Toque Club · Tarjeta de sellos y avisos
                  </h3>
                </div>
              </div>

              <Link
                to="/registro"
                className="min-h-[48px] px-5 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-sm flex items-center gap-2 hover:bg-white transition-colors"
              >
                <span>Crear la tarjeta de mi local</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-[#18181b] border border-[#28282a]">
                <div className="font-bold text-sm text-[#f1f1ee]">Dos modos de escaneo</div>
                <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                  Escanea el cajero (por visita o por monto) o escanea el cliente en el mostrador.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#18181b] border border-[#28282a]">
                <div className="font-bold text-sm text-[#f1f1ee]">Avisos sin molestar</div>
                <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                  Saludo automático de cumpleaños y aviso al pasar cerca del local, con tope anti-spam.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#18181b] border border-[#28282a]">
                <div className="font-bold text-sm text-[#f1f1ee]">Control de cajeros</div>
                <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                  El cajero solo suma sellos. Cualquier anulación pide motivo y queda en Correcciones.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-[#18181b] border border-[#28282a]">
                <div className="font-bold text-sm text-[#f1f1ee]">Multi-sucursal</div>
                <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                  Todos tus locales incluidos y estadísticas claras por cada Cartel QR.
                </p>
              </div>
            </div>
          </div>

          {/* Próximamente: Estrellas, Recibo, Toquecitos con formulario inline */}
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-[#f1f1ee]">
                Próximamente en tu mismo Cartel QR (anotate para que te avisemos)
              </h3>
              <p className="text-sm text-[#a1a1aa] mt-1">
                Dejá tu mail en el módulo que te interese probar primero.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-[#111113] border border-[#242426] rounded-2xl p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] text-xs font-bold">
                      Próximamente
                    </span>
                    <Star className="w-5 h-5 text-[#bec8ff]" />
                  </div>
                  <h4 className="text-xl font-bold text-[#f1f1ee]">Toque Estrellas (Reseñas)</h4>
                  <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                    Acceso directo para que tus clientes califiquen tu local en Google Maps desde el mostrador.
                  </p>
                  <Link to="/estrellas" className="inline-block text-xs font-bold text-[#bec8ff] underline hover:text-white">
                    Ver ejemplo de cómo va a verse →
                  </Link>
                </div>
                <WaitlistInlineForm product="estrellas" productLabel="Toque Estrellas" />
              </div>

              <div className="bg-[#111113] border border-[#242426] rounded-2xl p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] text-xs font-bold">
                      Próximamente
                    </span>
                    <Receipt className="w-5 h-5 text-[#bec8ff]" />
                  </div>
                  <h4 className="text-xl font-bold text-[#f1f1ee]">Toque Recibo (Comprobante)</h4>
                  <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                    Entregá el comprobante de compra digital en el celular del cliente sin gastar papel térmico.
                  </p>
                  <Link to="/recibo" className="inline-block text-xs font-bold text-[#bec8ff] underline hover:text-white">
                    Ver ejemplo de cómo va a verse →
                  </Link>
                </div>
                <WaitlistInlineForm product="recibo" productLabel="Toque Recibo" />
              </div>

              <div className="bg-[#111113] border border-[#242426] rounded-2xl p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] text-xs font-bold">
                      Próximamente
                    </span>
                    <Sparkles className="w-5 h-5 text-[#bec8ff]" />
                  </div>
                  <h4 className="text-xl font-bold text-[#f1f1ee]">Toquecitos (Colección)</h4>
                  <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                    Insignias coleccionables con el color y la inicial de cada local que visita el cliente.
                  </p>
                  <Link to="/toquecitos" className="inline-block text-xs font-bold text-[#bec8ff] underline hover:text-white">
                    Ver ejemplo de cómo va a verse →
                  </Link>
                </div>
                <WaitlistInlineForm product="toquecitos" productLabel="Toquecitos" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. PARA QUIÉN (tipos de comercio)
          ===================================================================== */}
      <section className="bg-[#000000] border-t border-[#242426] py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#bec8ff]">
              Para quién es Toque
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f1f1ee]">
              Pensado para comercios donde la gente vuelve todas las semanas
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-2.5">
              <Coffee className="w-6 h-6 text-[#bec8ff]" />
              <h3 className="text-lg font-bold text-[#f1f1ee]">Cafeterías y panaderías</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                El clásico "el café 10 va sin cargo" sin que el cliente pierda el cartoncito en la billetera.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-2.5">
              <Utensils className="w-6 h-6 text-[#bec8ff]" />
              <h3 className="text-lg font-bold text-[#f1f1ee]">Heladerías y gastronomía</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Sumá sellos por visita o cada cierto monto de compra con tope por ticket.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-2.5">
              <Scissors className="w-6 h-6 text-[#bec8ff]" />
              <h3 className="text-lg font-bold text-[#f1f1ee]">Barberías y estética</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Premiá la constancia de tus clientes y saludalos automáticamente en su cumpleaños.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-2.5">
              <ShoppingBag className="w-6 h-6 text-[#bec8ff]" />
              <h3 className="text-lg font-bold text-[#f1f1ee]">Tiendas y dietéticas</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Reconocimiento en 1 toque cuando el cliente ya tiene cuenta Toque en el barrio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. TUS DATOS EN SIMPLE (3 cuadros cortos sobre privacidad)
          ===================================================================== */}
      <section className="bg-[#000000] border-t border-[#242426] py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2fb36a]">
              Privacidad real · Ley 25.326
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f1f1ee]">
              Tus datos en simple
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#111113] border border-[#242426] rounded-2xl p-6 space-y-2.5">
              <ShieldCheck className="w-6 h-6 text-[#2fb36a]" />
              <h3 className="text-lg font-bold text-[#f1f1ee]">Sin datos de más</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Solo pedimos cómo te conocen, tu mail y opcionalmente día y mes de cumpleaños. Nunca pedimos teléfono, apellido ni año de nacimiento.
              </p>
            </div>

            <div className="bg-[#111113] border border-[#242426] rounded-2xl p-6 space-y-2.5">
              <QrCode className="w-6 h-6 text-[#2fb36a]" />
              <h3 className="text-lg font-bold text-[#f1f1ee]">Opción sin datos (y menores)</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                No recolectamos datos de menores de 18 años. Cualquier persona puede elegir "Prefiero no dar mis datos" y sumar sellos igual.
              </p>
            </div>

            <div className="bg-[#111113] border border-[#242426] rounded-2xl p-6 space-y-2.5">
              <Store className="w-6 h-6 text-[#2fb36a]" />
              <h3 className="text-lg font-bold text-[#f1f1ee]">Sin rastreo de ubicación ni IP</h3>
              <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Toque no guarda tu dirección IP ni rastrea dónde estás. Los avisos de cercanía los resuelve la billetera de tu propio celular.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. PRECIOS (leídos de src/config/pricing.ts)
          ===================================================================== */}
      <section id="precios" className="bg-[#000000] border-t border-[#242426] py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#bec8ff]">
              Precios claros
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f1f1ee]">
              Un solo plan completo, {TRIAL_DAYS} días gratis sin tarjeta
            </h2>
            <p className="text-sm sm:text-base text-[#a1a1aa]">
              Incluye todos tus locales, clientes ilimitados y avisos automáticos.
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
                    <h3 className="text-2xl font-bold text-[#f1f1ee]">{plan.name}</h3>
                    {plan.badge && (
                      <span className="px-3 py-1 rounded-full bg-[#bec8ff]/15 border border-[#bec8ff]/30 text-[#bec8ff] text-xs font-bold">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-4xl font-extrabold text-[#f1f1ee]">{formatArs(plan.priceArs)}</span>
                    <span className="text-sm font-medium text-[#a1a1aa]">
                      {' '}/ {plan.periodLabel}
                    </span>
                    <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1">{plan.description}</p>
                  </div>

                  <ul className="space-y-2.5 pt-2">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm text-[#e4e4e7]">
                        <CheckCircle2 className="w-4 h-4 text-[#2fb36a] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to="/registro"
                  className="min-h-[48px] w-full rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold flex items-center justify-center hover:bg-white transition-colors"
                >
                  Probar {TRIAL_DAYS} días gratis
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. PREGUNTAS FRECUENTES (acordeón)
          ===================================================================== */}
      <section className="bg-[#000000] border-t border-[#242426] py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#bec8ff]">
              Preguntas frecuentes
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-[#f1f1ee]">
              Dudas habituales antes de empezar
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="bg-[#111113] border border-[#242426] rounded-2xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full min-h-[54px] px-5 py-4 text-left font-bold text-sm sm:text-base text-[#f1f1ee] flex items-center justify-between gap-4 cursor-pointer"
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
        </div>
      </section>

      {/* =====================================================================
          8. MEADOW FOOTER (Exact .footer spec from hero-landing.css)
          ===================================================================== */}
      <footer className="footer" role="contentinfo">
        <div className="footer__stage" aria-hidden="true">
          <video
            className="footer__video"
            autoPlay
            loop
            muted
            playsInline
            poster="/storm-background.jpg"
          >
            <source
              src="https://d2j9b4b8b5b9b0.cloudfront.net/meadow-footer.mp4"
              type="video/mp4"
            />
          </video>
        </div>

        <p className="footer__wordmark" aria-hidden="true">
          toque
        </p>
        <div className="footer__fog" aria-hidden="true" />

        <div className="footer__content">
          <div className="brand">
            <Link to="/" className="brand__logo">
              <span className="brand__mark" aria-hidden="true" />
              <span>toque™</span>
            </Link>
            <h2 className="brand__title">
              Armá la tarjeta de sellos de tu local en 5 minutos.
            </h2>
            <p className="brand__text">
              Imprimí tu Cartel QR en A5, sumá clientes desde el mostrador y premiá a quienes vuelven todas las semanas.
            </p>
            <Link to="/registro" className="brand__cta">
              <span>Probar {TRIAL_DAYS} días gratis</span>
              <ArrowRight />
            </Link>
            <p className="brand__copy">
              © {new Date().getFullYear()} Toque · República Argentina · Ley 25.326
            </p>
            <div className="brand__status">
              <span className="chip">
                <span className="chip__dot" />
                <span>Club activo</span>
              </span>
              <Link to="/arrepentimiento" className="chip">
                <span>Botón de Arrepentimiento</span>
              </Link>
            </div>
          </div>

          <div className="col col--menu">
            <h3 className="col__title">Producto</h3>
            <ul className="col__list">
              <li>
                <Link to="/club/CAFE01">Tarjeta de ejemplo</Link>
              </li>
              <li>
                <Link to="/para-clientes">Para clientes</Link>
              </li>
              <li>
                <Link to="/precios">Precios</Link>
              </li>
              <li>
                <Link to="/preguntas">Preguntas frecuentes</Link>
              </li>
              <li>
                <Link to="/ingresar">Ingresar al panel</Link>
              </li>
            </ul>
          </div>

          <div className="col">
            <h3 className="col__title">Próximamente</h3>
            <ul className="col__list">
              <li>
                <Link to="/estrellas">Toque Estrellas</Link>
              </li>
              <li>
                <Link to="/recibo">Toque Recibo</Link>
              </li>
              <li>
                <Link to="/toquecitos">Toquecitos</Link>
              </li>
            </ul>
          </div>

          <div className="col">
            <h3 className="col__title">Legal y Privacidad</h3>
            <ul className="col__list">
              <li>
                <Link to="/privacidad">Política de Privacidad</Link>
              </li>
              <li>
                <Link to="/terminos">Términos de Uso</Link>
              </li>
              <li>
                <Link to="/cookies">Cookies y Clarity</Link>
              </li>
              <li>
                <Link to="/reembolso">Reembolsos</Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};
