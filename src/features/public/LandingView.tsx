import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  QrCode,
  Sparkles,
  Star,
  Award,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Receipt,
  Smartphone,
  ChevronRight,
  Clock,
  Zap,
  BarChart3,
  Layers,
  HeartHandshake,
} from 'lucide-react';

export const LandingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'recibo' | 'resenas' | 'club'>('recibo');

  return (
    <div className="aurora-stage min-h-screen text-white selection:bg-[#3A3FE0] selection:text-white flex flex-col">
      {/* 1. NAVEGACIÓN SUPERIOR LIQUID GLASS */}
      <header className="sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5 backdrop-blur-xl bg-[#121622]/85 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo de Toque */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#454BFF] to-[#2D33D0] text-white flex items-center justify-center font-display font-bold text-lg shadow-[0_0_15px_rgba(58,63,224,0.45)] border border-white/20">
              T
            </div>
            <div>
              <span className="font-display font-bold text-base tracking-tight text-white block">
                Toque
              </span>
              <span className="text-[10px] text-white/60 font-medium block -mt-0.5">
                Tu cartel, con datos
              </span>
            </div>
          </Link>

          {/* Enlaces de Sección */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-white/70">
            <a href="#como-funciona" className="hover:text-white transition">
              Cómo funciona
            </a>
            <a href="#recibo" className="hover:text-white transition">
              Módulo Recibo
            </a>
            <a href="#carteles" className="hover:text-white transition">
              Carteles NFC
            </a>
            <a href="#club" className="hover:text-white transition">
              Club
            </a>
            <Link to="/precios" className="hover:text-white transition text-[#FFC21A] font-bold">
              Planes y Precios
            </Link>
          </nav>

          {/* Acciones */}
          <div className="flex items-center gap-2.5">
            <Link to="/caja" className="hidden sm:inline-flex">
              <button
                type="button"
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/20 transition flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5 text-[#FFC21A]" />
                <span>Ver Caja</span>
              </button>
            </Link>

            <Link to="/login" className="hidden sm:inline-flex">
              <button
                type="button"
                className="px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                Ingresar
              </button>
            </Link>

            <Link to="/registro">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#0B1030] bg-[#FFC21A] hover:bg-[#F0B412] active:scale-95 transition shadow-md flex items-center gap-1.5"
              >
                <span>Probar 30 días gratis</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-16 pb-20 max-w-7xl mx-auto w-full">
        {/* Glow atmosférico */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#3A3FE0]/25 rounded-full blur-3xl pointer-events-none -z-1" />

        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-white/90 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#FFC21A]" />
            <span className="font-semibold">Módulo Recibo + Cartel NFC & QR Inteligente</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#FFC21A] text-[#0B1030] rounded-full">
              30 días gratis
            </span>
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.08]">
            Tu cartel físico de acrílico, con datos en cada toque
          </h1>

          <p className="text-base sm:text-lg text-white/75 max-w-2xl mx-auto leading-relaxed font-body">
            El cajero registra el cobro en segundos y tu cliente apoya el celular: ve su comprobante digital en 3 minutos, se suma a tu club de fidelidad y deja una reseña en Google con 1 solo toque.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/registro" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto min-h-[50px] px-7 rounded-2xl text-sm font-bold text-[#0B1030] bg-[#FFC21A] hover:bg-[#F0B412] active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2"
              >
                <span>Comenzar prueba gratis de 30 días</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>

            <Link to="/panel" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto min-h-[50px] px-6 rounded-2xl text-sm font-bold text-white bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-md active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <span>Ir al Panel del Comercio</span>
              </button>
            </Link>

            <Link to="/precios" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto min-h-[50px] px-5 rounded-2xl text-sm font-semibold text-white/80 hover:text-white transition flex items-center justify-center gap-1.5"
              >
                <span>Ver planes y precios</span>
                <ChevronRight className="w-4 h-4 text-[#FFC21A]" />
              </button>
            </Link>
          </div>

          {/* Badges de garantía / atributos */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-white/60">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#19C37D]" />
              <span>30 días beta sin tarjeta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#19C37D]" />
              <span>Cero papel: comprobante digital</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#19C37D]" />
              <span>Sin apps: cliente apoya y listo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#19C37D]" />
              <span>Chip NFC NTAG213 de lectura rápida</span>
            </div>
          </div>
        </div>

        {/* DEMOSTRACIÓN VISUAL / SHOWCASE LIQUID GLASS */}
        <div className="mt-14 max-w-5xl mx-auto rounded-3xl p-6 sm:p-8 bg-white/[0.07] backdrop-blur-2xl border border-white/15 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Columna Izquierda: Simulación del Cartel de Acrílico y Caja */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#FFC21A] uppercase tracking-wider">
                <Receipt className="w-4 h-4" />
                <span>En el Mostrador de tu Local</span>
              </div>
              <h3 className="font-display font-bold text-2xl text-white">
                El cajero cobra. El cartel entrega el comprobante.
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Sin imprimir ticket térmico ni pedir mails por teléfono. Con Toque, cada venta genera un comprobante no fiscal que vive 3 minutos en el cartel para que el cliente lo guarde en su galería o lo descargue en PDF.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-white/10 border border-white/10 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-white/60 block">1. Pantalla de Caja</span>
                  <p className="font-bold text-white">Teclado rápido & QR</p>
                  <p className="text-white/60 text-[11px]">Mercado Pago, Efectivo o Posnet</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/10 border border-white/10 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-white/60 block">2. Cartel de Acrílico</span>
                  <p className="font-bold text-white">NFC + QR de respaldo</p>
                  <p className="text-white/60 text-[11px]">Grabado láser de alta durabilidad</p>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <Link to="/caja">
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#0B1030] bg-[#FFC21A] hover:bg-[#F0B412] transition flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Abrir Pantalla de Caja</span>
                  </button>
                </Link>
                <Link to="/h/CAJA01" target="_blank" rel="noopener noreferrer">
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/20 transition flex items-center gap-2"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Ver Hub del Cliente</span>
                  </button>
                </Link>
              </div>
            </div>

            {/* Columna Derecha: Tarjeta Simulada del Hub en Teléfono */}
            <div className="w-full max-w-xs shrink-0 rounded-3xl p-4 bg-[#141824] border border-white/20 shadow-2xl text-white space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#3A3FE0] flex items-center justify-center font-bold text-xs text-white">
                    T
                  </div>
                  <span className="text-xs font-bold text-white">Café La Esquina</span>
                </div>
                <span className="text-[10px] font-mono text-white/50">CAJA01</span>
              </div>

              {/* Recibo Simulado */}
              <div className="p-3.5 rounded-2xl bg-white/[0.08] border border-white/15 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#FFC21A]">Comprobante de compra</span>
                  <span className="text-[10px] text-white/60">Recién cobrado</span>
                </div>
                <div className="flex justify-between items-center text-white/90">
                  <span>Café + Medialuna</span>
                  <span className="font-bold tabular-nums">$3.800</span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-sm">
                  <span>Total</span>
                  <span className="tabular-nums text-[#FFC21A]">$3.800</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button type="button" className="py-1 px-2 rounded-lg bg-white/10 text-[10px] font-semibold text-white/80 text-center">
                    Guardar imagen
                  </button>
                  <button type="button" className="py-1 px-2 rounded-lg bg-white/10 text-[10px] font-semibold text-white/80 text-center">
                    Descargar PDF
                  </button>
                </div>
                <p className="text-[9px] text-[#FF6B6B] text-center font-medium">
                  Comprobante de compra. No es una factura.
                </p>
              </div>

              {/* Botón de Reseña */}
              <div className="pt-1">
                <button
                  type="button"
                  className="w-full py-2.5 px-3 rounded-xl bg-[#FFC21A] text-[#0B1030] font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <Star className="w-3.5 h-3.5 fill-[#0B1030]" />
                  <span>Dejar reseña en Google</span>
                </button>
              </div>

              {/* Club */}
              <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-white">
                  <Award className="w-3 h-3 text-[#FFC21A]" />
                  <span>Club La Esquina · 1 sello sumado</span>
                </div>
                <p className="text-[10px] text-white/60">Te faltan 4 sellos para tu café de regalo</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CÓMO FUNCIONA */}
      <section id="como-funciona" className="px-4 sm:px-6 lg:px-8 py-20 max-w-7xl mx-auto w-full border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#FFC21A] block">
            Paso a Paso
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-white">
            Simple para el cajero. Mágico para el cliente.
          </h2>
          <p className="text-xs sm:text-sm text-white/70">
            Sin instalaciones complejas, sin cables, sin aplicaciones que descargar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white/[0.07] backdrop-blur-xl border border-white/15 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-[#FFC21A] font-bold text-lg">
              1
            </div>
            <h3 className="font-display font-bold text-lg text-white">
              Cobro en Pantalla de Caja
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              El cajero ingresa el importe en la web de Caja desde cualquier tablet o computadora. Selecciona Mercado Pago QR dinámico, Efectivo o Posnet.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white/[0.07] backdrop-blur-xl border border-white/15 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-[#FFC21A] font-bold text-lg">
              2
            </div>
            <h3 className="font-display font-bold text-lg text-white">
              Toque al Cartel de Acrílico
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              El cliente apoya su smartphone sobre el chip NFC del cartel o escanea el código QR de respaldo. No requiere instalar nada ni registrarse.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white/[0.07] backdrop-blur-xl border border-white/15 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-[#FFC21A] font-bold text-lg">
              3
            </div>
            <h3 className="font-display font-bold text-lg text-white">
              Recibo, Club y Reseña
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Durante 3 minutos el cliente tiene su comprobante de compra descargable, suma sellos o puntos a su Club y puede calificar tu local en Google con 1 solo clic.
            </p>
          </div>
        </div>
      </section>

      {/* 4. MÓDULO RECIBO EN DETALLE */}
      <section id="recibo" className="px-4 sm:px-6 lg:px-8 py-20 max-w-7xl mx-auto w-full border-t border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-[#FFC21A]">
              <Zap className="w-3.5 h-3.5" />
              <span>Innovación en Mostrador</span>
            </div>

            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
              Ahorrá en rollos térmicos. Regalá una experiencia impecable.
            </h2>

            <p className="text-sm text-white/75 leading-relaxed">
              El papel térmico se borra, contamina y cuesta miles de pesos al mes. Con el módulo Recibo de Toque, entregás un comprobante digital limpio, descargable en imagen o PDF, que se reclama una sola vez para total seguridad de tu caja.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#19C37D]/20 text-[#19C37D] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Comprobante no fiscal reglamentario</p>
                  <p className="text-[11px] text-white/60">Lleva siempre visible: "Comprobante de compra. No es una factura."</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#19C37D]/20 text-[#19C37D] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Ventana de entrega de 3 minutos</p>
                  <p className="text-[11px] text-white/60">Garantiza que cada cliente reciba exactamente su cobro y evita reclamos cruzados.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#19C37D]/20 text-[#19C37D] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Guardado local inmediato</p>
                  <p className="text-[11px] text-white/60">El comensal lo guarda con un clic en la galería de fotos o en archivo PDF para enviar por WhatsApp.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-white/[0.07] backdrop-blur-2xl border border-white/15 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/15">
              <span className="font-display font-bold text-base text-white">Ventajas para tu negocio</span>
              <span className="text-xs font-bold text-[#FFC21A]">100% Digital</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-white/10 border border-white/10 space-y-1.5">
                <BarChart3 className="w-5 h-5 text-[#FFC21A]" />
                <h4 className="font-bold text-white">Historial de Ventas</h4>
                <p className="text-white/60 text-[11px]">Controlá cobros por caja, fecha y método de pago en tiempo real.</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/10 border border-white/10 space-y-1.5">
                <Star className="w-5 h-5 text-[#FFC21A]" />
                <h4 className="font-bold text-white">+ Reseñas Reales</h4>
                <p className="text-white/60 text-[11px]">Multiplicá los toques directos a tu perfil de Google Reviews.</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/10 border border-white/10 space-y-1.5">
                <Award className="w-5 h-5 text-[#FFC21A]" />
                <h4 className="font-bold text-white">Club de Fidelidad</h4>
                <p className="text-white/60 text-[11px]">Fidelizá clientes sin plásticos ni descargas de apps engorrosas.</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/10 border border-white/10 space-y-1.5">
                <ShieldCheck className="w-5 h-5 text-[#FFC21A]" />
                <h4 className="font-bold text-white">Privacidad y Confianza</h4>
                <p className="text-white/60 text-[11px]">Sin pedir IP ni datos invasivos. Consentimiento explícito siempre.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CALLOUT A PRECIOS (Precios en su propia página) */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-5xl mx-auto w-full">
        <div className="rounded-3xl p-8 sm:p-10 bg-gradient-to-r from-white/[0.09] to-white/[0.04] backdrop-blur-2xl border border-white/20 text-center space-y-5 shadow-2xl relative overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-[#FFC21A] text-[#0B1030] flex items-center justify-center mx-auto font-bold shadow-md">
            $
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <h3 className="font-display font-bold text-2xl sm:text-3xl text-white">
              Planes claros y 30 días de prueba beta
            </h3>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              Los nuevos comercios cuentan con 30 días de prueba beta gratuita para usar el módulo Recibo y carteles inteligentes. Luego el plan <strong>Comercio Pro tiene un abono de $7.899/mes</strong>.
            </p>
          </div>

          <div className="pt-2">
            <Link to="/precios">
              <button
                type="button"
                className="px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold text-[#0B1030] bg-[#FFC21A] hover:bg-[#F0B412] active:scale-95 transition shadow-lg inline-flex items-center gap-2"
              >
                <span>Ver página completa de Planes y Precios</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. PIE DE PÁGINA */}
      <footer className="mt-auto px-4 sm:px-6 lg:px-8 py-10 border-t border-white/10 bg-[#0E1118]/80 backdrop-blur-xl text-white/60 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#3A3FE0] text-white flex items-center justify-center font-display font-bold text-sm">
              T
            </div>
            <div>
              <span className="font-display font-bold text-sm text-white block">Toque</span>
              <span className="text-[10px] text-white/50 block">Tu cartel, con datos · Plataforma SaaS</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold">
            <Link to="/precios" className="hover:text-white transition text-[#FFC21A]">
              Precios
            </Link>
            <Link to="/panel" className="hover:text-white transition">
              Panel Comercio
            </Link>
            <Link to="/caja" className="hover:text-white transition">
              Pantalla de Caja
            </Link>
            <Link to="/activar/DEMO01" className="hover:text-white transition">
              Activar Cartel
            </Link>
            <Link to="/login" className="hover:text-white transition">
              Iniciar Sesión
            </Link>
          </div>

          <p className="text-[11px] text-white/40">
            © {new Date().getFullYear()} Toque. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};
