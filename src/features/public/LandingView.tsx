import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Star,
  Award,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Receipt,
  Smartphone,
  Zap,
  BarChart3,
} from 'lucide-react';

interface StatConfig {
  glyph: string;
  target: number;
  suffix: string;
  decimals: number;
  label: string;
  delay: string;
}

const HERO_STATS: StatConfig[] = [
  {
    glyph: '<',
    target: 3,
    suffix: ' min',
    decimals: 0,
    label: 'Ventana de recibo digital',
    delay: '0.5s',
  },
  {
    glyph: '%',
    target: 100,
    suffix: '%',
    decimals: 0,
    label: 'Cero papel térmico ni apps',
    delay: '0.58s',
  },
  {
    glyph: '*',
    target: 30,
    suffix: ' días',
    decimals: 0,
    label: 'Prueba beta gratuita',
    delay: '0.66s',
  },
  {
    glyph: '#',
    target: 1,
    suffix: ' toque',
    decimals: 0,
    label: 'NFC NTAG213 + QR respaldo',
    delay: '0.74s',
  },
];

interface MarqueeLogo {
  src: string;
  alt: string;
  invertOnHover?: boolean;
  gradient: {
    from: string;
    via?: string;
    to: string;
  };
}

const MARQUEE_LOGOS: MarqueeLogo[] = [
  {
    src: '/assets/logos/mercado-pago.svg',
    alt: 'Mercado Pago',
    gradient: { from: '#009ee3', to: '#38bdf8' },
  },
  {
    src: '/assets/logos/google-wallet.svg',
    alt: 'Google Wallet',
    gradient: { from: '#93c5fd', to: '#f8fafc' },
  },
  {
    src: '/assets/logos/apple-wallet.svg',
    alt: 'Apple Wallet',
    gradient: { from: '#3f3f46', to: '#09090b' },
  },
  {
    src: 'https://svgl.app/library/cloudflare.svg',
    alt: 'Cloudflare',
    invertOnHover: true,
    gradient: { from: '#f97316', to: '#fbbf24' },
  },
  {
    src: '/assets/logos/google-maps.svg',
    alt: 'Google Maps',
    gradient: { from: '#4285f4', via: '#34a853', to: '#fbbc05' },
  },
];

export const LandingView: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<'inicio' | 'como-funciona' | 'recibo' | 'precios'>('inicio');
  const statsRef = useRef<HTMLElement | null>(null);
  const valueRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hasCountedRef = useRef(false);

  // Mobile menu keyboard & resize handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth > 720) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [menuOpen]);

  // Count-up JS: easeOutCubic, duration 1500 + i*80ms, start offset 480 + i*90ms, once via IntersectionObserver threshold 0.25
  useEffect(() => {
    const el = statsRef.current;
    if (!el || hasCountedRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      HERO_STATS.forEach((stat, i) => {
        const node = valueRefs.current[i];
        if (node) {
          node.textContent = `${stat.target.toFixed(stat.decimals)}${stat.suffix}`;
        }
      });
      hasCountedRef.current = true;
      return;
    }

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const runCountUp = () => {
      if (hasCountedRef.current) return;
      hasCountedRef.current = true;

      HERO_STATS.forEach((stat, i) => {
        const node = valueRefs.current[i];
        if (!node) return;
        const duration = 1500 + i * 80;
        const startOffset = 480 + i * 90;

        window.setTimeout(() => {
          const startTime = performance.now();
          const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutCubic(progress);
            const current = stat.target * eased;
            node.textContent = `${current.toFixed(stat.decimals)}${stat.suffix}`;
            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              node.textContent = `${stat.target.toFixed(stat.decimals)}${stat.suffix}`;
            }
          };
          requestAnimationFrame(step);
        }, startOffset);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCountUp();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const marqueeItems = [...MARQUEE_LOGOS, ...MARQUEE_LOGOS];

  return (
    <div className="toque-landing-root selection:bg-[#bec8ff] selection:text-[#0c0c0c]">
      {/* ====================================================================
          FIRST VIEWPORT (100vh / 100dvh): VIDEO BACKGROUND + HEADER + HERO + STATS
          ==================================================================== */}
      <div className="toque-viewport">
        {/* Exact background video */}
        <div className="bg" aria-hidden="true">
          <video className="bg-video" autoPlay muted loop playsInline>
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
              type="video/mp4"
            />
          </video>
        </div>

        <div className="page">
          {/* 1) HEADER (Desktop & Mobile) — Single unified toque™ logo */}
          <header className="site-header">
            <Link to="/" className="logo-btn" aria-label="toque™ — inicio">
              <img src="/assets/logo.svg" alt="" width={52} height={52} />
            </Link>

            <nav className="nav-pill" aria-label="Navegación principal">
              <a
                href="#inicio"
                onClick={() => setActiveNav('inicio')}
                className={`nav-link ${activeNav === 'inicio' ? 'active' : ''}`}
              >
                Inicio
              </a>
              <a
                href="#como-funciona"
                onClick={() => setActiveNav('como-funciona')}
                className={`nav-link ${activeNav === 'como-funciona' ? 'active' : ''}`}
              >
                Cómo funciona
              </a>
              <a
                href="#recibo"
                onClick={() => setActiveNav('recibo')}
                className={`nav-link ${activeNav === 'recibo' ? 'active' : ''}`}
              >
                Módulo recibo
              </a>
              <Link to="/precios" className="nav-link">
                Precios
              </Link>
            </nav>

            <Link to="/login" className="sign-in-pill">
              Ingresar
            </Link>

            {/* Mobile circular burger */}
            <button
              type="button"
              className={`burger-btn ${menuOpen ? 'is-open' : ''}`}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span className="burger-bar" />
              <span className="burger-bar" />
              <span className="burger-bar" />
            </button>
          </header>

          {/* Mobile overlay & white sheet menu */}
          {menuOpen && (
            <>
              <div
                className="mobile-overlay"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="mobile-sheet" role="dialog" aria-label="Menú móvil">
                <a
                  href="#inicio"
                  style={{ animationDelay: '0.04s' }}
                  onClick={() => {
                    setActiveNav('inicio');
                    setMenuOpen(false);
                  }}
                  className={`mobile-nav-link ${activeNav === 'inicio' ? 'active' : ''}`}
                >
                  Inicio
                </a>
                <a
                  href="#como-funciona"
                  style={{ animationDelay: '0.08s' }}
                  onClick={() => {
                    setActiveNav('como-funciona');
                    setMenuOpen(false);
                  }}
                  className={`mobile-nav-link ${activeNav === 'como-funciona' ? 'active' : ''}`}
                >
                  Cómo funciona
                </a>
                <a
                  href="#recibo"
                  style={{ animationDelay: '0.12s' }}
                  onClick={() => {
                    setActiveNav('recibo');
                    setMenuOpen(false);
                  }}
                  className={`mobile-nav-link ${activeNav === 'recibo' ? 'active' : ''}`}
                >
                  Módulo recibo
                </a>
                <Link
                  to="/precios"
                  style={{ animationDelay: '0.16s' }}
                  onClick={() => setMenuOpen(false)}
                  className="mobile-nav-link"
                >
                  Planes y precios
                </Link>
                <Link
                  to="/caja"
                  style={{ animationDelay: '0.20s' }}
                  onClick={() => setMenuOpen(false)}
                  className="mobile-nav-link"
                >
                  Pantalla de caja
                </Link>
                <Link
                  to="/login"
                  style={{ animationDelay: '0.24s' }}
                  onClick={() => setMenuOpen(false)}
                  className="mobile-sign-in"
                >
                  Ingresar
                </Link>
              </div>
            </>
          )}

          {/* 2) HERO (Center) */}
          <main id="inicio" className="hero">
            {/* Trust row: 3 overlapping avatar rings + trust pill */}
            <div
              className="trust-row anim"
              style={{ '--d': '0.05s' } as React.CSSProperties}
            >
              <div className="trust-avatar a1" aria-hidden="true">
                <div className="trust-avatar-inner">
                  <i className="fa-brands fa-google" />
                </div>
              </div>
              <div className="trust-avatar a2" aria-hidden="true">
                <div className="trust-avatar-inner">
                  <i className="fa-solid fa-wifi" />
                </div>
              </div>
              <div className="trust-avatar a3" aria-hidden="true">
                <div className="trust-avatar-inner">
                  <i className="fa-solid fa-receipt" />
                </div>
              </div>
              <div className="trust-pill">
                Módulo recibo + cartel NFC y QR · 30 días gratis
              </div>
            </div>

            {/* Headline: Two lines in BubbledotICG-FinePos */}
            <h1 className="headline anim">
              <span className="headline-line line-1" style={{ color: '#000000' }}>
                Tu cartel físico,
              </span>
              <span className="headline-line line-2">con datos en cada toque</span>
            </h1>

            {/* Subhead */}
            <p
              className="subhead anim"
              style={{ '--d': '0.28s' } as React.CSSProperties}
            >
              El cajero registra el cobro en segundos y tu cliente apoya el celular: ve su comprobante digital en 3 minutos, se suma a tu club de fidelidad y deja una reseña en Google con 1 solo toque.
            </p>

            {/* Primary CTA */}
            <Link
              to="/registro"
              className="cta-btn anim-pulse"
              style={{ '--d': '0.4s' } as React.CSSProperties}
            >
              Probar toque
            </Link>

            {/* Quick navigation shortcuts to key toque™ flows */}
            <div
              className="hero-sublinks anim"
              style={{ '--d': '0.46s' } as React.CSSProperties}
            >
              <Link to="/panel">Ir al panel del comercio →</Link>
              <span aria-hidden="true">·</span>
              <Link to="/caja">Ver pantalla de caja →</Link>
              <span aria-hidden="true">·</span>
              <Link to="/precios">Planes y precios →</Link>
            </div>
          </main>

          {/* 3) STATS FOOTER (4 metrics with retro dot-matrix icons + count-up) */}
          <footer ref={statsRef} className="stats-footer" aria-label="Especificaciones de toque™">
            {HERO_STATS.map((stat, idx) => (
              <div
                key={stat.label}
                className="stat-item anim"
                style={{ '--d': stat.delay } as React.CSSProperties}
              >
                <span className="stat-icon" aria-hidden="true">
                  {stat.glyph}
                </span>
                <span
                  ref={(el) => {
                    valueRefs.current[idx] = el;
                  }}
                  className="stat-value"
                >
                  0{stat.suffix}
                </span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </footer>
        </div>
      </div>

      {/* ====================================================================
          SEAMLESS MARQUEE LOGO SCROLLER COMPONENT (mt-10 below hero container)
          ==================================================================== */}
      <div
        className="marquee-wrapper mt-10 w-full overflow-hidden py-4"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      >
        <div className="marquee-track gap-8 pr-8">
          {marqueeItems.map((logo, index) => (
            <div
              key={`${logo.alt}-${index}`}
              className="group relative h-24 w-40 shrink-0 flex items-center justify-center rounded-full bg-white border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all overflow-hidden"
            >
              <div
                className="absolute inset-0 scale-150 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
                style={{
                  background: logo.gradient.via
                    ? `linear-gradient(135deg, ${logo.gradient.from}, ${logo.gradient.via}, ${logo.gradient.to})`
                    : `linear-gradient(135deg, ${logo.gradient.from}, ${logo.gradient.to})`,
                }}
              />
              <img
                src={logo.src}
                alt={logo.alt}
                loading="lazy"
                className={`relative z-10 h-11 w-auto max-w-[112px] object-contain transition-all duration-300 group-hover:scale-105 ${
                  logo.invertOnHover ? 'group-hover:brightness-0 group-hover:invert' : ''
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ====================================================================
          SPREAD HERO STYLE ACROSS MAIN WEB (Palette: #000, #f1f1ee, #2fb36a, #bec8ff)
          ==================================================================== */}
      <div className="bg-[#000000] text-[#f1f1ee]">
        {/* DEMOSTRACIÓN VISUAL / SHOWCASE EN MOSTRADOR */}
        <section className="px-4 sm:px-6 lg:px-8 pt-20 pb-24 max-w-6xl mx-auto w-full">
          {/* Atributos rápidos con el mismo verde #2fb36a del final de la web */}
          <div className="pb-16 flex flex-wrap items-center justify-center gap-y-3 gap-x-8 text-xs text-[#c4c2c3]">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-[#2fb36a]"
                style={{ boxShadow: '0 0 0 3px rgba(47, 179, 106, 0.18)' }}
              />
              <span>30 días beta sin tarjeta</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-[#2fb36a]"
                style={{ boxShadow: '0 0 0 3px rgba(47, 179, 106, 0.18)' }}
              />
              <span>Cero papel: comprobante digital</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-[#2fb36a]"
                style={{ boxShadow: '0 0 0 3px rgba(47, 179, 106, 0.18)' }}
              />
              <span>Sin apps: cliente apoya y listo</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-[#2fb36a]"
                style={{ boxShadow: '0 0 0 3px rgba(47, 179, 106, 0.18)' }}
              />
              <span>Chip NFC NTAG213 de lectura rápida</span>
            </div>
          </div>

          <div className="max-w-5xl mx-auto rounded-[32px] p-7 sm:p-12 bg-[#111113] border border-white/15 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
              {/* Columna izquierda: simulación del cartel de acrílico y caja */}
              <div className="flex-1 space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#28282a] border border-white/20 text-xs font-medium text-[#bec8ff]">
                  <Receipt className="w-3.5 h-3.5 text-[#bec8ff]" />
                  <span>En el mostrador de tu local</span>
                </div>

                <h2
                  className="text-3xl sm:text-4xl text-[#f1f1ee] font-normal tracking-tight leading-[1.12]"
                  style={{ fontFamily: 'var(--font-display-retro)' }}
                >
                  El cajero cobra. El cartel entrega el comprobante.
                </h2>

                <p className="text-sm text-[#c4c2c3] leading-relaxed">
                  Sin imprimir ticket térmico ni pedir correos por teléfono. Con toque™, cada venta genera un comprobante no fiscal que vive 3 minutos en el cartel para que el cliente lo guarde en su galería o lo descargue en PDF.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                  <div className="p-4 rounded-2xl bg-[#1a1a1d] border border-white/10 text-xs space-y-1">
                    <span className="text-[11px] font-medium text-[#bec8ff] block">
                      1. Pantalla de caja
                    </span>
                    <p className="font-semibold text-[#f1f1ee]">Teclado rápido y QR</p>
                    <p className="text-[#9c9c98] text-[11px]">Mercado Pago, efectivo o posnet</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#1a1a1d] border border-white/10 text-xs space-y-1">
                    <span className="text-[11px] font-medium text-[#bec8ff] block">
                      2. Cartel de acrílico
                    </span>
                    <p className="font-semibold text-[#f1f1ee]">NFC + QR de respaldo</p>
                    <p className="text-[#9c9c98] text-[11px]">Grabado láser de alta durabilidad</p>
                  </div>
                </div>

                <div className="pt-3 flex flex-wrap gap-3">
                  <Link to="/caja" className="cta-btn">
                    <CreditCard className="w-4 h-4 mr-2" />
                    <span>Abrir pantalla de caja</span>
                  </Link>
                  <Link
                    to="/h/CAJA01"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sign-in-pill"
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    <span>Ver hub del cliente</span>
                  </Link>
                </div>
              </div>

              {/* Columna derecha: tarjeta simulada del hub en teléfono */}
              <div className="w-full max-w-xs shrink-0 rounded-[28px] p-5 bg-[#0c0c0c] border border-white/20 shadow-2xl text-[#f1f1ee] space-y-3.5">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span className="brand__mark" style={{ width: 24, height: 24, borderRadius: 6 }} aria-hidden="true" />
                    <span className="text-xs font-semibold text-[#f1f1ee]">Café La Esquina</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#9c9c98]">CAJA01</span>
                </div>

                {/* Recibo simulado */}
                <div className="p-4 rounded-2xl bg-[#18181b] border border-white/10 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#2fb36a] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2fb36a]" />
                      Comprobante de compra
                    </span>
                    <span className="text-[10px] text-[#9c9c98]">Recién cobrado</span>
                  </div>
                  <div className="flex justify-between items-center text-[#f1f1ee]/90">
                    <span>Café + medialuna</span>
                    <span className="font-semibold tabular-nums">$3.800</span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex justify-between font-semibold text-sm">
                    <span>Total</span>
                    <span className="tabular-nums text-[#bec8ff]">$3.800</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <span className="py-1.5 px-2 rounded-full bg-[#28282a] text-[10px] font-medium text-[#f1f1ee]/85 text-center">
                      Guardar imagen
                    </span>
                    <span className="py-1.5 px-2 rounded-full bg-[#28282a] text-[10px] font-medium text-[#f1f1ee]/85 text-center">
                      Descargar PDF
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9c9c98] text-center">
                    Comprobante de compra. No es una factura.
                  </p>
                </div>

                {/* Botón de reseña */}
                <div className="pt-0.5">
                  <Link
                    to="/h/CAJA01"
                    className="w-full py-2.5 px-4 rounded-full bg-[#f1f1ee] text-[#0c0c0c] font-semibold text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-white transition"
                  >
                    <Star className="w-3.5 h-3.5 fill-[#0c0c0c]" />
                    <span>Dejar reseña en Google</span>
                  </Link>
                </div>

                {/* Club */}
                <div className="p-3 rounded-2xl bg-[#18181b] border border-white/10 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#f1f1ee]">
                    <Award className="w-3.5 h-3.5 text-[#bec8ff]" />
                    <span>Club La Esquina · 1 sello sumado</span>
                  </div>
                  <p className="text-[10px] text-[#9c9c98]">
                    Te faltan 4 sellos para tu café de regalo
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section
          id="como-funciona"
          className="px-4 sm:px-6 lg:px-8 py-24 max-w-6xl mx-auto w-full border-t border-white/10"
        >
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <span className="inline-flex items-center px-3.5 py-1 rounded-full bg-[#28282a] border border-white/20 text-xs font-medium text-[#bec8ff]">
              Paso a paso
            </span>
            <h2
              className="text-3xl sm:text-5xl text-[#f1f1ee] font-normal tracking-tight"
              style={{ fontFamily: 'var(--font-display-retro)' }}
            >
              Simple para el cajero. Mágico para el cliente.
            </h2>
            <p className="text-sm text-[#c4c2c3]">
              Sin instalaciones complejas, sin cables, sin aplicaciones que descargar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-7 rounded-[28px] bg-[#111113] border border-white/15 space-y-4">
              <div
                className="text-2xl text-[#bec8ff]"
                style={{ fontFamily: 'var(--font-display-retro)' }}
              >
                01
              </div>
              <h3 className="text-lg font-semibold text-[#f1f1ee] tracking-tight">
                Cobro en pantalla de caja
              </h3>
              <p className="text-xs sm:text-sm text-[#9c9c98] leading-relaxed">
                El cajero ingresa el importe en la web de caja desde cualquier tablet o computadora. Selecciona Mercado Pago QR dinámico, efectivo o posnet.
              </p>
            </div>

            <div className="p-7 rounded-[28px] bg-[#111113] border border-white/15 space-y-4">
              <div
                className="text-2xl text-[#bec8ff]"
                style={{ fontFamily: 'var(--font-display-retro)' }}
              >
                02
              </div>
              <h3 className="text-lg font-semibold text-[#f1f1ee] tracking-tight">
                Toque al cartel de acrílico
              </h3>
              <p className="text-xs sm:text-sm text-[#9c9c98] leading-relaxed">
                El cliente apoya su celular sobre el chip NFC del cartel o escanea el código QR de respaldo. No requiere instalar nada ni registrarse.
              </p>
            </div>

            <div className="p-7 rounded-[28px] bg-[#111113] border border-white/15 space-y-4">
              <div
                className="text-2xl text-[#2fb36a]"
                style={{ fontFamily: 'var(--font-display-retro)' }}
              >
                03
              </div>
              <h3 className="text-lg font-semibold text-[#f1f1ee] tracking-tight">
                Recibo, club y reseña
              </h3>
              <p className="text-xs sm:text-sm text-[#9c9c98] leading-relaxed">
                Durante 3 minutos el cliente tiene su comprobante de compra descargable, suma sellos o puntos a su club y puede calificar tu local en Google con 1 solo toque.
              </p>
            </div>
          </div>
        </section>

        {/* MÓDULO RECIBO EN DETALLE */}
        <section
          id="recibo"
          className="px-4 sm:px-6 lg:px-8 py-24 max-w-6xl mx-auto w-full border-t border-white/10"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#28282a] border border-white/20 text-xs font-medium text-[#2fb36a]">
                <Zap className="w-3.5 h-3.5" />
                <span>Innovación en mostrador</span>
              </div>

              <h2
                className="text-3xl sm:text-4xl text-[#f1f1ee] font-normal tracking-tight leading-[1.12]"
                style={{ fontFamily: 'var(--font-display-retro)' }}
              >
                Ahorrá en rollos térmicos. Regalá una experiencia impecable.
              </h2>

              <p className="text-sm text-[#c4c2c3] leading-relaxed">
                El papel térmico se borra, contamina y cuesta miles de pesos al mes. Con el módulo recibo de toque™, entregás un comprobante digital limpio, descargable en imagen o PDF, que se reclama una sola vez para total seguridad de tu caja.
              </p>

              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#2fb36a]/20 text-[#2fb36a] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#f1f1ee]">
                      Comprobante no fiscal reglamentario
                    </p>
                    <p className="text-xs text-[#9c9c98]">
                      Lleva siempre visible: &ldquo;Comprobante de compra. No es una factura.&rdquo;
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#2fb36a]/20 text-[#2fb36a] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#f1f1ee]">
                      Ventana de entrega de 3 minutos
                    </p>
                    <p className="text-xs text-[#9c9c98]">
                      Garantiza que cada cliente reciba exactamente su cobro y evita reclamos cruzados.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#2fb36a]/20 text-[#2fb36a] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#f1f1ee]">Guardado local inmediato</p>
                    <p className="text-xs text-[#9c9c98]">
                      El cliente lo guarda con un toque en su galería de fotos o en archivo PDF para compartir.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[32px] bg-[#111113] border border-white/15 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <span className="font-semibold text-base text-[#f1f1ee] tracking-tight">
                  Ventajas para tu comercio
                </span>
                <span className="text-xs font-medium text-[#2fb36a] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#2fb36a]" />
                  100% digital
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-[#18181b] border border-white/10 space-y-1.5">
                  <BarChart3 className="w-5 h-5 text-[#bec8ff]" />
                  <h4 className="font-semibold text-[#f1f1ee]">Historial de ventas</h4>
                  <p className="text-[#9c9c98] text-[11px] leading-relaxed">
                    Controlá cobros por caja, fecha y método de pago en tiempo real.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#18181b] border border-white/10 space-y-1.5">
                  <Star className="w-5 h-5 text-[#bec8ff]" />
                  <h4 className="font-semibold text-[#f1f1ee]">+ reseñas reales</h4>
                  <p className="text-[#9c9c98] text-[11px] leading-relaxed">
                    Multiplicá los toques directos a tu perfil de Google Reviews.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#18181b] border border-white/10 space-y-1.5">
                  <Award className="w-5 h-5 text-[#2fb36a]" />
                  <h4 className="font-semibold text-[#f1f1ee]">Club de fidelidad</h4>
                  <p className="text-[#9c9c98] text-[11px] leading-relaxed">
                    Fidelizá clientes sin plásticos ni descargas de aplicaciones.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#18181b] border border-white/10 space-y-1.5">
                  <ShieldCheck className="w-5 h-5 text-[#2fb36a]" />
                  <h4 className="font-semibold text-[#f1f1ee]">Privacidad y confianza</h4>
                  <p className="text-[#9c9c98] text-[11px] leading-relaxed">
                    Sin pedir IP ni datos invasivos. Consentimiento explícito siempre.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CALLOUT A PRECIOS */}
        <section className="px-4 sm:px-6 lg:px-8 pt-12 pb-24 max-w-5xl mx-auto w-full">
          <div className="rounded-[32px] p-8 sm:p-12 bg-[#111113] border border-white/15 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div
              className="text-3xl text-[#2fb36a]"
              style={{ fontFamily: 'var(--font-display-retro)' }}
            >
              $
            </div>

            <div className="space-y-3 max-w-xl mx-auto">
              <h3
                className="text-2xl sm:text-4xl text-[#f1f1ee] font-normal tracking-tight"
                style={{ fontFamily: 'var(--font-display-retro)' }}
              >
                Planes claros y 30 días de prueba beta
              </h3>
              <p className="text-xs sm:text-sm text-[#c4c2c3] leading-relaxed">
                Los nuevos comercios cuentan con 30 días de prueba beta gratuita para usar el módulo recibo y carteles inteligentes. Luego el plan{' '}
                <strong className="text-[#f1f1ee] font-semibold">
                  Comercio Pro tiene un abono de $7.899/mes
                </strong>
                .
              </p>
            </div>

            <div className="pt-2">
              <Link to="/precios" className="cta-btn">
                <span>Ver planes y precios</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        </section>

        {/* SMOOTH FADE TRANSITION FROM BLACK (#000000) TO MEADOW FOOTER PAPER (#f1f1ee) */}
        <div
          aria-hidden="true"
          className="w-full h-48 sm:h-64 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, #000000 0%, #14151c 26%, #3f4254 54%, #9ea2b8 79%, #f1f1ee 100%)',
          }}
        />

        {/* PIE DE PÁGINA — MEADOW FOOTER (toque™) */}
        <footer className="footer">
          <div className="footer__stage" aria-hidden="true">
            <video
              className="footer__video"
              src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/4d01c727-d9c5-47c8-a778-35a451ffd39f.mp4"
              poster="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261014_121838_c97d0940-f430-4304-8573-4f47ee44f447.png"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
          </div>

          <p className="footer__wordmark" aria-hidden="true">
            toque™
          </p>

          <div className="footer__fog" aria-hidden="true" />

          <div className="footer__content">
            <div className="brand">
              <Link to="/" className="brand__logo" aria-label="toque™ inicio">
                <span className="brand__mark" aria-hidden="true" />
                toque™
              </Link>

              <h2 className="brand__title">Tu cartel físico, con datos en cada toque</h2>

              <p className="brand__text">
                toque™ reúne comprobante de compra digital por 3 minutos, reseñas directas en Google y club de fidelidad sin apps en un cartel de acrílico con chip NFC NTAG213 y código QR de respaldo sobre tu mostrador.
              </p>

              <Link to="/registro" className="brand__cta">
                Probar toque
              </Link>

              <p className="brand__copy">
                © {new Date().getFullYear()} toque™ — Plataforma SaaS para comercios · Hecho en Argentina.
              </p>
            </div>

            <nav className="col col--menu" aria-label="Menú">
              <h3 className="col__title">Menú</h3>
              <ul className="col__list">
                <li>
                  <a href="#inicio">Inicio</a>
                </li>
                <li>
                  <a href="#como-funciona">Cómo funciona</a>
                </li>
                <li>
                  <a href="#recibo">Módulo recibo</a>
                </li>
                <li>
                  <Link to="/precios">Planes y precios</Link>
                </li>
                <li>
                  <Link to="/caja">Pantalla de caja</Link>
                </li>
              </ul>
            </nav>

            <nav className="col" aria-label="Plataforma">
              <h3 className="col__title">Plataforma</h3>
              <ul className="col__list">
                <li>
                  <Link to="/panel/resumen">Panel del comercio</Link>
                </li>
                <li>
                  <Link to="/panel/carteles">Mis carteles</Link>
                </li>
                <li>
                  <Link to="/panel/hub">Editor del hub</Link>
                </li>
                <li>
                  <Link to="/panel/club">Club de clientes</Link>
                </li>
                <li>
                  <Link to="/panel/ventas">Historial de ventas</Link>
                </li>
              </ul>
            </nav>

            <nav className="col" aria-label="Accesos directos">
              <h3 className="col__title">Accesos directos</h3>
              <ul className="col__list">
                <li>
                  <Link to="/activar/DEMO01">Activar cartel (DEMO01)</Link>
                </li>
                <li>
                  <Link to="/h/CAJA01">Ver hub cliente (CAJA01)</Link>
                </li>
                <li>
                  <Link to="/panel/conexiones">Conexiones de cobro</Link>
                </li>
                <li>
                  <Link to="/admin/lotes">Generador de lotes</Link>
                </li>
                <li>
                  <Link to="/registro">Crear cuenta gratis</Link>
                </li>
                <li>
                  <Link to="/login">Iniciar sesión</Link>
                </li>
                <li>
                  <Link to="/panel/cuenta">Cuenta y suscripción</Link>
                </li>
              </ul>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
};
