/**
 * Toque — Sitio Público Oficial (LandingView)
 * Estructura Visual:
 * - Sección 1 (Hero): Hero RIVR exacto con video fluido, navbar de vidrio, badge, tarjetas flotantes y acentos azul marino.
 * - Resto de la página (Home): Estética limpia y editorial sobre lienzo #f0f0f0 con tarjetas blancas nítidas, tipografía Inter y acentos azul marino unificados.
 * - Demo interactiva del cartel acrílico físico, cómo funciona, calculadora de reventa,
 *   resumen para negocios, promesa de privacidad, precios en ARS, FAQ y alta a la beta.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronRight,
  ShieldCheck,
  Zap,
  Smartphone,
  QrCode,
  TrendingUp,
  Store,
  Factory,
  CheckCircle2,
  Lock,
  EyeOff,
  Cookie,
  Server,
  Calculator,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  Play,
  Check,
  Radio,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { Hero } from '../../components/Hero';
import { CookieBanner } from './CookieBanner';
import { HomeManufacturersSection } from './HomeManufacturersSection';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency } from '../../lib/formatters';
import { LEGAL_CONFIG } from '../../config/legal';

export const LandingView: React.FC = () => {
  const navigate = useNavigate();
  const { registerUser } = useAuth();
  const { success, error: toastError } = useToast();

  // Estado para la Demo Interactiva del Cartel
  const [demoScans, setDemoScans] = useState(142);
  const [isDemoTapped, setIsDemoTapped] = useState(false);
  const [demoMode, setDemoMode] = useState<'business' | 'manufacturer'>('business');
  const [recentNotification, setRecentNotification] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const [tapHistory, setTapHistory] = useState<Array<{ id: number; time: string; channel: string; target: string }>>([
    { id: 1, time: 'Hace 3 min', channel: 'Mesa 4 · QR dinámico', target: 'Google Reviews ★ 5.0' },
    { id: 2, time: 'Hace 14 min', channel: 'Barra · NFC NTAG215', target: 'Google Reviews ★ 5.0' },
    { id: 3, time: 'Hace 38 min', channel: 'Mostrador · NFC NTAG215', target: 'Google Reviews ★ 5.0' },
  ]);

  // Selector de período de facturación: mensual o anual (10 meses)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [pricingTarget, setPricingTarget] = useState<'business' | 'manufacturer'>('business');

  // Estado para la Calculadora de Reventa del Fabricante
  const [calcPricePerBusiness, setCalcPricePerBusiness] = useState(4500);
  const [calcBusinessCount, setCalcBusinessCount] = useState(25);

  // Estado para el acordeón de Preguntas Frecuentes
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Estado del Formulario de Alta a la Beta
  const [betaForm, setBetaForm] = useState({
    nombre: '',
    email: '',
    whatsapp: '',
    tipo: 'fabricante' as 'fabricante' | 'negocio',
    volumen: '11-50',
  });
  const [betaErrors, setBetaErrors] = useState<Record<string, string>>({});
  const [betaSubmitting, setBetaSubmitting] = useState(false);
  const [betaSuccess, setBetaSuccess] = useState(false);

  // Detectar preferencia de reducción de movimiento
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Interacción en el cartel simulado
  const handleSimulateScan = () => {
    if (typeof window !== 'undefined' && 'navigator' in window && window.navigator.vibrate) {
      try {
        window.navigator.vibrate([25, 35, 25]);
      } catch {
        // Ignorar
      }
    }

    setIsDemoTapped(true);
    setDemoScans((prev) => prev + 1);

    const newTap = {
      id: Date.now(),
      time: '¡Ahora mismo!',
      channel: 'Mostrador · NFC NTAG215',
      target: 'Google Reviews ★ 5.0',
    };

    setTapHistory((prev) => [newTap, ...prev.slice(0, 2)]);
    setRecentNotification('¡+1 toque registrado! Redirigiendo a Google Reviews en 142 ms');

    setTimeout(() => {
      setIsDemoTapped(false);
    }, 500);

    setTimeout(() => {
      setRecentNotification(null);
    }, 3800);
  };

  // Cálculos de la Calculadora de Reventa
  const calculatePlatformCost = (count: number) => {
    if (count <= 15) return 11899;
    if (count <= 50) return 24899;
    return 44899;
  };

  const getTierName = (count: number) => {
    if (count <= 15) return 'Plan Arranque';
    if (count <= 50) return 'Plan Taller';
    return 'Plan Fábrica';
  };

  const grossMonthlyRevenue = calcPricePerBusiness * calcBusinessCount;
  const toqueCost = calculatePlatformCost(calcBusinessCount);
  const netMonthlyProfit = Math.max(0, grossMonthlyRevenue - toqueCost);
  const annualizedProfit = netMonthlyProfit * 12;
  const profitMarginPercent = grossMonthlyRevenue > 0 ? Math.round((netMonthlyProfit / grossMonthlyRevenue) * 100) : 0;

  // Validación y envío del formulario beta
  const handleBetaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!betaForm.nombre.trim()) {
      errors.nombre = 'Ingresá tu nombre y apellido';
    }
    if (!betaForm.email.trim() || !/^\S+@\S+\.\S+$/.test(betaForm.email)) {
      errors.email = 'Ingresá un correo electrónico válido';
    }
    if (!betaForm.whatsapp.trim() || betaForm.whatsapp.replace(/\D/g, '').length < 8) {
      errors.whatsapp = 'Ingresá un WhatsApp con código de área (ej. 11 5263-8900)';
    }

    if (Object.keys(errors).length > 0) {
      setBetaErrors(errors);
      return;
    }

    setBetaErrors({});
    setBetaSubmitting(true);

    try {
      const res = await registerUser({
        name: betaForm.nombre.trim(),
        email: betaForm.email.trim(),
        password: 'Password123!',
        whatsapp: betaForm.whatsapp.trim(),
        activity: betaForm.tipo,
        volume: betaForm.volumen,
      });

      success('¡Lugar reservado con éxito!', `Bienvenido a Toque, ${res.user.name}. Ingresando a tu panel...`);

      if (betaForm.tipo === 'fabricante') {
        navigate('/fabricante?welcome=1', { replace: true });
      } else {
        navigate('/resumen?welcome=1', { replace: true });
      }
    } catch (err) {
      toastError('No pudimos procesar la reserva', err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setBetaSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0] text-slate-800 font-sans selection:bg-[rgba(30,50,90,0.15)] selection:text-[rgba(30,50,90,1)]">
      {/* 1. SECCIÓN HERO RIVR (Exacto al prompt RIVR con video fluido y tarjeta redondeada) */}
      <Hero
        headline="Tu cartel, con datos."
        subheadline="El soporte físico que ya tenés en el mostrador, ahora con analítica en tiempo real, protección ante caídas y sin tocar la privacidad de tus clientes."
        badgeText="Toque · Cartel Inteligente NFC + QR"
        statNumber="142"
        statLabel="Toques Registrados Hoy"
        cardButtonLabel="Probar Cartel"
        cornerTitle="Panel en Vivo"
        cornerSubtitle="Explorar Métricas"
        onBookDemo={() => navigate('/resumen')}
        onJoinDiscord={() => scrollToSection('demo')}
        onCornerClick={() => navigate('/resumen')}
      />

      {/* CONTENIDO DEL HOME: ESTÉTICA LIMPIA Y EDITORIAL SOBRE #f0f0f0 */}
      <div className="w-full max-w-[1536px] mx-auto px-3 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* 2. DEMO INTERACTIVA TÁCTIL DEL CARTEL ACRÍLICO (#demo) */}
        <section id="demo" className="scroll-mt-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-xs p-6 sm:p-10 md:p-14">
            <div className="max-w-3xl mx-auto text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[rgba(30,50,90,0.06)] border border-[rgba(30,50,90,0.12)] text-xs text-[rgba(30,50,90,0.9)] mb-3 font-medium">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Demostración de Contacto Físico en Tiempo Real</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-slate-900 tracking-tight font-headline mb-3">
                Tocá el cartel físico. Mirá la respuesta.
              </h2>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
                El cliente apoya el teléfono o escanea con su cámara al abonar en el mostrador. Abre directo las 5 estrellas en Google Reviews sin instalar ninguna app.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Cartel Físico Simulado (Acrílico Cristal 4mm sobre Peana de Madera) */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div
                  tabIndex={0}
                  role="button"
                  aria-label="Simular toque NFC en el cartel físico de acrílico. Presioná Espacio o Enter."
                  onClick={handleSimulateScan}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSimulateScan();
                    }
                  }}
                  className={`group cursor-pointer select-none relative p-6 rounded-3xl transition-all duration-300 outline-none flex flex-col items-center justify-center ${
                    isDemoTapped ? 'scale-95' : 'hover:-translate-y-1'
                  }`}
                >
                  {/* Placa de Acrílico Cristal */}
                  <div className="relative w-48 h-64 sm:w-52 sm:h-72 rounded-2xl p-4 flex flex-col items-center justify-between shadow-2xl border border-white/80 bg-gradient-to-b from-white/95 via-white/90 to-slate-100 text-slate-900 backdrop-blur-md">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/40 to-transparent pointer-events-none" />

                    {isDemoTapped && !prefersReducedMotion && (
                      <div className="absolute inset-0 rounded-2xl bg-[rgba(30,50,90,0.15)] animate-ping pointer-events-none" />
                    )}

                    {/* Encabezado del cartel */}
                    <div className="w-full flex items-center justify-between border-b border-black/10 pb-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-[rgba(30,50,90,0.9)] flex items-center justify-center text-white font-bold text-[10px]">
                          ★
                        </div>
                        <span className="text-xs font-bold tracking-tight text-slate-900">
                          TOQUE
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-500">★ 5.0</span>
                    </div>

                    {/* Diana NFC de Contacto */}
                    <div className="flex flex-col items-center my-auto">
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isDemoTapped
                            ? 'bg-[rgba(30,50,90,0.9)] text-white scale-110 shadow-lg'
                            : 'bg-white text-[rgba(30,50,90,0.9)] border border-slate-200 shadow-xs group-hover:scale-105'
                        }`}
                      >
                        <Radio className={`w-8 h-8 ${isDemoTapped ? 'animate-spin' : ''}`} />
                      </div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-800 mt-2">
                        Apoyá tu celular
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        NFC NTAG215
                      </span>
                    </div>

                    {/* QR de Contingencia */}
                    <div className="w-full pt-2 border-t border-black/10 flex items-center justify-between">
                      <div className="w-9 h-9 p-1 rounded-lg bg-white border border-slate-300 shadow-2xs flex items-center justify-center">
                        <QrCode className="w-7 h-7 text-slate-800" />
                      </div>
                      <div className="text-[8px] text-right text-slate-600 leading-tight">
                        O escaneá con <br /> tu cámara
                      </div>
                    </div>
                  </div>

                  {/* Peana de Madera */}
                  <div className="w-56 h-4 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-900 rounded-md shadow-lg border-t border-amber-600/40 mt-1 flex items-center justify-center">
                    <div className="w-44 h-1 bg-black/40 rounded-full" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateScan}
                  className="mt-3 px-5 py-2 rounded-full bg-[rgba(30,50,90,0.06)] hover:bg-[rgba(30,50,90,0.12)] text-[rgba(30,50,90,0.9)] text-xs font-medium transition cursor-pointer border border-[rgba(30,50,90,0.1)]"
                >
                  {isDemoTapped ? '¡Toque recibido!' : 'Hacé clic o presioná Espacio para probar'}
                </button>
              </div>

              {/* Panel Digital de Respuesta en Vivo */}
              <div className="lg:col-span-7 bg-slate-50 rounded-2xl border border-slate-200/80 p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
                    <div>
                      <div className="text-xs text-slate-500">Panel en tiempo real</div>
                      <div className="text-base font-semibold text-slate-900">
                        Café San Telmo · Mostrador Principal
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 bg-white rounded-full border border-slate-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setDemoMode('business')}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition cursor-pointer ${
                          demoMode === 'business'
                            ? 'bg-[rgba(30,50,90,0.9)] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Negocio
                      </button>
                      <button
                        type="button"
                        onClick={() => setDemoMode('manufacturer')}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition cursor-pointer ${
                          demoMode === 'manufacturer'
                            ? 'bg-[rgba(30,50,90,0.9)] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Fabricante
                      </button>
                    </div>
                  </div>

                  {/* Métrica viva */}
                  {demoMode === 'business' ? (
                    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 mb-4 shadow-2xs">
                      <div className="text-xs text-slate-500 font-medium">Toques registrados hoy</div>
                      <div className="flex items-baseline justify-between mt-1">
                        <div
                          className={`text-4xl sm:text-5xl font-headline font-semibold text-slate-900 transition-transform duration-300 ${
                            isDemoTapped ? 'scale-105 text-[rgba(30,50,90,1)]' : ''
                          }`}
                          aria-live="polite"
                        >
                          {demoScans}
                        </div>
                        <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>+22% vs semana anterior</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 mb-4 space-y-2 text-xs font-mono shadow-2xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Enlace directo:</span>
                        <span className="font-semibold text-slate-900">toque.ar/santelmo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Chip NTAG215:</span>
                        <span className="text-slate-900">04:8A:2F:9C:E1</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Destino de Google:</span>
                        <span className="text-emerald-600 font-semibold truncate max-w-44">
                          Google Reviews ★ 5.0
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Historial Reciente */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actividad de toques en vivo
                    </div>
                    {tapHistory.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl flex items-center justify-between text-xs border transition ${
                          item.time === '¡Ahora mismo!'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{item.channel}</span>
                        <span className="font-mono text-[11px] ml-2 shrink-0 text-slate-500">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Latencia: 142 ms</span>
                  <span>·</span>
                  <span>0 cookies instaladas</span>
                  <span>·</span>
                  <span>0 IPs guardadas</span>
                </div>
              </div>
            </div>

            {recentNotification && (
              <div
                role="status"
                className="mt-6 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5 animate-in fade-in"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{recentNotification}</span>
              </div>
            )}
          </div>
        </section>

        {/* 3. CÓMO FUNCIONA EN 3 PASOS (#como-funciona) */}
        <section id="como-funciona" className="scroll-mt-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-xs p-6 sm:p-10 md:p-14">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <span className="text-xs font-semibold tracking-wider uppercase text-[rgba(30,50,90,0.8)]">
                Proceso directo sin fricción
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-slate-900 tracking-tight font-headline mt-1 mb-3">
                Cómo funciona
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Tres pasos diseñados para la realidad del mostrador comercial.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-[rgba(30,50,90,0.9)] uppercase">
                    01 · Fabricación
                  </span>
                  <h3 className="text-xl font-medium text-slate-900 font-headline mt-2 mb-3">
                    El fabricante lo activa
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Graba el chip NTAG215 o imprime el QR en el soporte (acrílico, madera o metal). Asigna la ficha de Google con el enlace mágico en 2 minutos.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                  <Factory className="w-4 h-4 text-[rgba(30,50,90,0.8)]" />
                  <span>Listo para entregar al cliente</span>
                </div>
              </div>

              <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-amber-600 uppercase">
                    02 · Experiencia
                  </span>
                  <h3 className="text-xl font-medium text-slate-900 font-headline mt-2 mb-3">
                    El cliente toca
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Apoya su teléfono o escanea con su cámara al abonar. Abre directo las 5 estrellas en Google Maps sin apps intermedias ni demoras.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-600" />
                  <span>Carga instantánea en menos de 200ms</span>
                </div>
              </div>

              <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-600 uppercase">
                    03 · Resultados
                  </span>
                  <h3 className="text-xl font-medium text-slate-900 font-headline mt-2 mb-3">
                    El dueño ve que funciona
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    Recibe los toques del día, detecta sus horarios pico y lee el resumen semanal con una acción clara para el equipo del local.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Impacto visible en reseñas reales</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. RED NACIONAL DE FABRICANTES (#red-fabricantes) */}
        <HomeManufacturersSection />

        {/* 4. PARA FABRICANTES (#fabricantes) + CALCULADORA */}
        <section id="fabricantes" className="scroll-mt-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-xs p-6 sm:p-10 md:p-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-6">
                <span className="text-xs font-semibold tracking-wider uppercase text-[rgba(30,50,90,0.8)]">
                  Modelo para talleres e imprentas
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-slate-900 tracking-tight font-headline mt-1 mb-4 leading-tight">
                  Vendé el cartel. <br />
                  <span className="text-slate-500">Quedate con el cliente.</span>
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
                  Dejá de vender un soporte una sola vez. Con Toque cobrás una cuota mensual por el panel de analítica, con tu propio logo, tus colores y sin intermediarios.
                </p>

                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Marca blanca total:</strong> Tu logo, dominio y soporte en cada panel.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Onboarding autoservicio:</strong> El cliente se activa solo en 5 minutos.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Alertas de inactividad:</strong> Detectá carteles con 14 días sin toques y asesorá proactivamente.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span><strong>Reemplazos sin costo:</strong> Si el cartel se rompe, se reasigna sin gastar cupo.</span>
                  </div>
                </div>
              </div>

              {/* Calculadora */}
              <div className="lg:col-span-6 p-6 sm:p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-[rgba(30,50,90,0.9)]" />
                    <h3 className="font-semibold text-base text-slate-900">
                      Calculadora de Ingreso Recurrente
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                    {getTierName(calcBusinessCount)}
                  </span>
                </div>

                <div className="space-y-6 mb-8">
                  <div>
                    <div className="flex justify-between items-center text-xs mb-2">
                      <label htmlFor="price-slider" className="text-slate-600 font-medium">
                        ¿Cuánto le cobrás por mes a cada local?
                      </label>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(calcPricePerBusiness)}/mes
                      </span>
                    </div>
                    <input
                      id="price-slider"
                      type="range"
                      min={2000}
                      max={15000}
                      step={500}
                      value={calcPricePerBusiness}
                      onChange={(e) => setCalcPricePerBusiness(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[rgba(30,50,90,0.9)]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs mb-2">
                      <label htmlFor="count-slider" className="text-slate-600 font-medium">
                        Cantidad de comercios activos:
                      </label>
                      <span className="font-mono font-bold text-slate-900">
                        {calcBusinessCount} clientes
                      </span>
                    </div>
                    <input
                      id="count-slider"
                      type="range"
                      min={5}
                      max={120}
                      step={1}
                      value={calcBusinessCount}
                      onChange={(e) => setCalcBusinessCount(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[rgba(30,50,90,0.9)]"
                    />
                  </div>
                </div>

                {/* Resultado */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>Facturación mensual bruta:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCurrency(grossMonthlyRevenue)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>Costo plataforma Toque:</span>
                    <span className="font-mono text-slate-500">
                      − {formatCurrency(toqueCost)}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                    <div>
                      <div className="text-xs uppercase font-semibold text-emerald-700">
                        Tu ganancia neta mensual
                      </div>
                      <div className="text-2xl sm:text-3xl font-mono font-headline font-bold text-slate-900">
                        {formatCurrency(netMonthlyProfit)}
                        <span className="text-xs font-normal text-slate-500">/mes</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Proyección: {formatCurrency(annualizedProfit)} al año
                      </div>
                    </div>
                    <span className="font-mono font-bold text-sm text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      {profitMarginPercent}% margen
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. PARA NEGOCIOS (#negocios) */}
        <section id="negocios" className="scroll-mt-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-xs p-6 sm:p-10 md:p-14">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <span className="text-xs font-semibold tracking-wider uppercase text-[rgba(30,50,90,0.8)]">
                Para dueños de locales y comercios
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-slate-900 tracking-tight font-headline mt-1 mb-3">
                Más reseñas, menos laburo.
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                No persigas a tus comensales. Un cartel en el mostrador y un resumen los lunes para tomar decisiones.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 font-headline mb-2">
                  Directo a las 5 estrellas
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Sin buscar en el mapa ni deletrear nombres. Apoya el teléfono y abre la ficha exacta lista para calificar.
                </p>
              </div>

              <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80">
                <div className="w-10 h-10 rounded-xl bg-[rgba(30,50,90,0.1)] text-[rgba(30,50,90,0.9)] flex items-center justify-center mb-5">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 font-headline mb-2">
                  Resumen con acción clara
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Cada lunes recibís el horario pico y un consejo concreto: <em>"Mové el cartel a la barra de tragos durante el turno noche."</em>
                </p>
              </div>

              <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 font-headline mb-2">
                  Cartel blindado ante cambios
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Si Google modifica el enlace de tu ficha, lo actualizás en tu panel en 5 segundos sin tener que tirar ni reimprimir el cartel.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. PRIVACIDAD (#privacidad) */}
        <section id="privacidad" className="scroll-mt-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-xs p-6 sm:p-10 md:p-14">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <span className="text-xs font-semibold tracking-wider uppercase text-emerald-700">
                Privacidad silenciosa
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-slate-900 tracking-tight font-headline mt-1 mb-3">
                Nuestra promesa de privacidad. <br />
                Un argumento de venta real.
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Tus clientes tocan con tranquilidad total. Toque mide interacciones físicas sin espiar a nadie.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-5">
                  <Cookie className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 font-headline mb-2">
                  Sin cookies en el cartel
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  El enlace que abre el cliente no instala cookies, ni trackers de Facebook/Meta, ni scripts invasivos en su navegador.
                </p>
              </div>

              <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-5">
                  <Server className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 font-headline mb-2">
                  Sin guardar IPs
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  La dirección IP solo se usa de forma efímera en memoria RAM para aproximar la provincia y se descarta al instante sin persistirse.
                </p>
              </div>

              <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-5">
                  <EyeOff className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 font-headline mb-2">
                  Sin saber quién califica
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  La calificación se realiza en Google voluntariamente. Toque nunca tiene acceso al nombre ni correo de la persona que opinó.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. PRECIOS (#precios) */}
        <section id="precios" className="scroll-mt-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-xs p-6 sm:p-10 md:p-14">
            <div className="max-w-3xl mx-auto text-center mb-8">
              <span className="text-xs font-semibold tracking-wider uppercase text-[rgba(30,50,90,0.8)]">
                Tarifas transparentes en pesos argentinos (ARS)
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-slate-900 tracking-tight font-headline mt-1 mb-3">
                Planes adaptados a tu actividad
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mb-6">
                Elegí según si sos dueño de un comercio o fabricante de cartelería. Al elegir un plan te registrás en la página dedicada sin formularios escondidos debajo.
              </p>

              {/* Selector de Tipo de Cliente */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setPricingTarget('business')}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-2 border ${
                    pricingTarget === 'business'
                      ? 'bg-[rgba(30,50,90,0.9)] text-white border-[rgba(30,50,90,0.9)] shadow-sm'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>Soy dueño de comercio / local</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPricingTarget('manufacturer')}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-2 border ${
                    pricingTarget === 'manufacturer'
                      ? 'bg-[rgba(30,50,90,0.9)] text-white border-[rgba(30,50,90,0.9)] shadow-sm'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <Factory className="w-4 h-4" />
                  <span>Soy fabricante / taller de carteles</span>
                </button>
              </div>

              {/* Selector de Período */}
              <div className="inline-flex items-center p-1.5 rounded-full bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
                    billingPeriod === 'monthly'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mensual
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod('yearly')}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                    billingPeriod === 'yearly'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Anual</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    2 meses gratis
                  </span>
                </button>
              </div>
            </div>

            {/* TABLA DE PLANES PARA COMERCIOS */}
            {pricingTarget === 'business' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
                {/* Plan Gratis Negocio */}
                <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Plan Inicial
                    </span>
                    <div className="flex items-baseline gap-1 my-3">
                      <span className="text-3xl sm:text-4xl font-normal font-mono font-headline text-slate-900 font-bold">
                        $0
                      </span>
                      <span className="text-xs text-slate-500 font-mono">/mes para siempre</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-6">
                      Para locales que inician y quieren probar el impacto del cartel físico.
                    </p>

                    <ul className="space-y-3 text-xs text-slate-700 mb-6">
                      <li className="flex items-center gap-2 font-semibold text-slate-900">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Hasta 3 carteles activos</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Fabricante oficial asignado: Toque™ SaaS</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Redirección rápida a Google Reviews en &lt;45ms</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Sin comisiones ni costos sorpresa</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/registro?plan=gratis&tipo=negocio')}
                    className="w-full py-3 rounded-full bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    Elegir Plan Gratis
                  </button>
                </div>

                {/* Plan Comercio Pro */}
                <div className="p-8 rounded-[2rem] bg-white border-2 border-[rgba(30,50,90,0.85)] relative flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-[rgba(30,50,90,0.9)]">
                        Comercio Pro
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[rgba(30,50,90,0.9)] text-white px-2 py-0.5 rounded-full">
                        Recomendado
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 my-3">
                      <span className="text-3xl sm:text-4xl font-normal font-mono font-headline text-slate-900 font-bold">
                        {billingPeriod === 'monthly' ? '$4.899' : '$48.990'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {billingPeriod === 'monthly' ? '/mes' : '/año'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-6">
                      Para restaurantes, cafeterías y negocios consolidados que quieren escalar sus reseñas.
                    </p>

                    <ul className="space-y-3 text-xs text-slate-700 mb-6">
                      <li className="flex items-center gap-2 font-bold text-slate-900">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Carteles físicos ilimitados</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Múltiples canales de escaneo (Mesa, Barra, Mostrador)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Acceso completo a Equipo y Reto del Mes</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Reportes detallados y análisis de picos horarios</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Soporte prioritario por WhatsApp</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/registro?plan=comercio_pro&tipo=negocio')}
                    className="w-full py-3 rounded-full bg-[rgba(30,50,90,0.9)] hover:bg-[rgba(30,50,90,1)] text-white text-xs font-bold shadow-md transition cursor-pointer"
                  >
                    Elegir Comercio Pro
                  </button>
                </div>
              </div>
            ) : (
              /* TABLA DE PLANES PARA FABRICANTES */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Plan Arranque */}
                <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Arranque
                    </span>
                    <div className="flex items-baseline gap-1 my-3">
                      <span className="text-3xl sm:text-4xl font-normal font-mono font-headline text-slate-900 font-bold">
                        {billingPeriod === 'monthly' ? '$11.899' : '$118.990'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {billingPeriod === 'monthly' ? '/mes' : '/año'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-6">
                      Para talleres iniciales con hasta 15 carteles activos.
                    </p>

                    <ul className="space-y-3 text-xs text-slate-700 mb-6">
                      <li className="flex items-center gap-2 font-semibold text-slate-900">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Hasta 15 carteles activos</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Kit de impresión y CSV para chips NFC</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Gestión de clientes en tiempo real</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Cambio de URL en vivo sin reimprimir</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/registro?plan=arranque&tipo=fabricante')}
                    className="w-full py-2.5 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-900 text-xs font-medium transition cursor-pointer shadow-2xs"
                  >
                    Elegir Arranque
                  </button>
                </div>

                {/* Plan Taller */}
                <div className="p-8 rounded-[2rem] bg-white border-2 border-[rgba(30,50,90,0.8)] relative flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-[rgba(30,50,90,0.9)]">
                        Taller
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[rgba(30,50,90,0.9)] text-white px-2 py-0.5 rounded-full">
                        Más elegido
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 my-3">
                      <span className="text-3xl sm:text-4xl font-normal font-mono font-headline text-slate-900 font-bold">
                        {billingPeriod === 'monthly' ? '$24.899' : '$248.990'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {billingPeriod === 'monthly' ? '/mes' : '/año'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-6">
                      Para imprentas y talleres en crecimiento con clientes recurrentes.
                    </p>

                    <ul className="space-y-3 text-xs text-slate-700 mb-6">
                      <li className="flex items-center gap-2 font-semibold text-slate-900">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Hasta 50 carteles activos</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Publicación en la Red Oficial de Fabricantes</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Alertas de clientes inactivos automáticas</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Módulo de equipo y reportes consolidados</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/registro?plan=taller&tipo=fabricante')}
                    className="w-full py-2.5 rounded-full bg-[rgba(30,50,90,0.9)] hover:bg-[rgba(30,50,90,1)] text-white text-xs font-semibold shadow-md transition cursor-pointer"
                  >
                    Elegir Taller
                  </button>
                </div>

                {/* Plan Fábrica */}
                <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Fábrica
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full">
                        Empresarial
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 my-3">
                      <span className="text-3xl sm:text-4xl font-normal font-mono font-headline text-slate-900 font-bold">
                        {billingPeriod === 'monthly' ? '$44.899' : '$448.990'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {billingPeriod === 'monthly' ? '/mes' : '/año'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-6">
                      Producción masiva y distribuidores con red nacional.
                    </p>

                    <ul className="space-y-3 text-xs text-slate-700 mb-6">
                      <li className="flex items-center gap-2 font-semibold text-slate-900">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Hasta 150 carteles activos</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Presencia destacada en la Red de Fabricantes</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Importación masiva por lotes CSV</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Soporte prioritario 24/7 vía WhatsApp</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/registro?plan=fabrica&tipo=fabricante')}
                    className="w-full py-2.5 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-900 text-xs font-medium transition cursor-pointer shadow-2xs"
                  >
                    Elegir Fábrica
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 8. PREGUNTAS FRECUENTES (#faq) */}
        <section id="faq" className="scroll-mt-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-xs p-6 sm:p-10 md:p-14">
            <div className="max-w-3xl mx-auto text-center mb-10">
              <span className="text-xs font-semibold tracking-wider uppercase text-[rgba(30,50,90,0.8)]">
                Dudas resueltas
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-slate-900 tracking-tight font-headline mt-1 mb-3">
                Preguntas frecuentes
              </h2>
            </div>

            <div className="max-w-3xl mx-auto space-y-3">
              {[
                {
                  q: '¿Qué pasa si se rompe o se raya mi cartel?',
                  a: 'El historial no se pierde nunca. En tu panel contás con la acción "Reemplazar cartel": se genera un nuevo código o chip de reemplazo y se transfieren todos los toques y estadísticas acumuladas. Este cambio no consume cupo adicional de tu plan.',
                },
                {
                  q: '¿Qué pasa si dejo de pagar el plan o se vence?',
                  a: 'Contás con 15 días corridos de gracia. Pasado ese lapso, el panel de administración pasa a modo solo lectura. Lo más importante: tus carteles físicos activos continúan redirigiendo normalmente a Google Reviews para no perjudicar la experiencia de tus clientes.',
                },
                {
                  q: '¿Qué datos guardan de las personas que apoyan el celular?',
                  a: 'Absolutamente ningún dato personal ni identificador. No usamos cookies de rastreo en el enlace del cartel, no almacenamos direcciones IP y no sabemos quién deja la reseña. Solo registramos la fecha, hora y tipo de interacción (NFC o QR).',
                },
                {
                  q: '¿Puedo usar mi propia marca si soy fabricante o imprenta?',
                  a: 'Totalmente. Podés configurar tu propio logotipo, tus colores corporativos con verificación automática de contraste, tus vías de contacto de soporte e incluso tu propio subdominio web. Para tus clientes, la plataforma es 100% tuya.',
                },
                {
                  q: '¿Qué chips NFC son compatibles y qué app se usa para grabarlos?',
                  a: 'Recomendamos chips estándar NTAG215 (los mismos que se consiguen fácilmente en el mercado). Podés grabarlos en 5 segundos con cualquier aplicación gratuita de lectura/escritura NFC en Android o iPhone sin pagar licencias adicionales.',
                },
                {
                  q: '¿Los clientes necesitan instalar alguna aplicación para que funcione?',
                  a: 'No, ninguna. Los teléfonos modernos (tanto iPhone desde modelos 2018 como Android con NFC) leen el chip directamente al apoyarlo y abren el navegador o la aplicación de Google Maps en un segundo.',
                },
              ].map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-slate-50 border border-slate-200/80 overflow-hidden transition"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 text-sm font-semibold text-slate-800 hover:text-slate-900 transition cursor-pointer"
                    >
                      <span>{item.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-700 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-200/80 pt-3">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 9. ALTA A LA BETA (#beta) */}
        <section id="beta" className="scroll-mt-6">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-xs p-6 sm:p-10 md:p-14 max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <span className="text-xs font-semibold tracking-wider uppercase text-[rgba(30,50,90,0.8)]">
                Acceso anticipado
              </span>
              <h2 className="text-3xl sm:text-4xl font-normal text-slate-900 tracking-tight font-headline mt-1 mb-2">
                Sumate a la beta de Toque
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Acceso gratuito completo para fabricantes, talleres y comercios de Argentina.
              </p>
            </div>

              <form onSubmit={handleBetaSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nombre y Apellido *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Lucas Gómez"
                      value={betaForm.nombre}
                      onChange={(e) => setBetaForm({ ...betaForm, nombre: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[rgba(30,50,90,0.3)]"
                    />
                    {betaErrors.nombre && (
                      <span className="text-[11px] text-rose-600 mt-1 block">{betaErrors.nombre}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Correo electrónico *
                    </label>
                    <input
                      type="email"
                      placeholder="lucas@miempresa.com.ar"
                      value={betaForm.email}
                      onChange={(e) => setBetaForm({ ...betaForm, email: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[rgba(30,50,90,0.3)]"
                    />
                    {betaErrors.email && (
                      <span className="text-[11px] text-rose-600 mt-1 block">{betaErrors.email}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      WhatsApp con código de área *
                    </label>
                    <input
                      type="text"
                      placeholder="11 5263-8900"
                      value={betaForm.whatsapp}
                      onChange={(e) => setBetaForm({ ...betaForm, whatsapp: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[rgba(30,50,90,0.3)]"
                    />
                    {betaErrors.whatsapp && (
                      <span className="text-[11px] text-rose-600 mt-1 block">{betaErrors.whatsapp}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ¿Qué actividad realizás? *
                    </label>
                    <select
                      value={betaForm.tipo}
                      onChange={(e) => setBetaForm({ ...betaForm, tipo: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[rgba(30,50,90,0.3)]"
                    >
                      <option value="fabricante">Soy fabricante / taller de cartelería / imprenta</option>
                      <option value="negocio">Soy dueño / encargado de un local comercial</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ¿Cuántos carteles vendés o usás aproximadamente al mes?
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['1 - 10', '11 - 50', '51 - 200', '200+'].map((vol) => (
                      <button
                        key={vol}
                        type="button"
                        onClick={() => setBetaForm({ ...betaForm, volumen: vol })}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition cursor-pointer ${
                          betaForm.volumen === vol
                            ? 'bg-[rgba(30,50,90,0.9)] text-white border-[rgba(30,50,90,0.9)] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {vol}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={betaSubmitting}
                    className="w-full py-3 rounded-full bg-[rgba(30,50,90,0.9)] hover:bg-[rgba(30,50,90,1)] text-white text-sm font-semibold shadow-md transition cursor-pointer"
                  >
                    {betaSubmitting ? 'Enviando...' : 'Reservar mi lugar en la beta'}
                  </button>
                </div>

                <p className="text-[11px] text-center text-slate-500 pt-2">
                  Al registrarte aceptás nuestros{' '}
                  <Link to="/terminos" className="underline hover:text-slate-800">
                    Términos
                  </Link>{' '}
                  y{' '}
                  <Link to="/privacidad" className="underline hover:text-slate-800">
                    Privacidad
                  </Link>
                  . Sin tarjetas ni letra chica.
                </p>
              </form>
          </div>
        </section>

        {/* 10. PIE DE PÁGINA INSTITUCIONAL & LEGAL */}
        <footer className="w-full bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-xs p-6 sm:p-10 md:p-14 text-xs text-slate-600">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10">
            <div className="md:col-span-4">
              <Link to="/" className="text-xl font-bold tracking-tight text-slate-900 mb-2 block font-headline">
                TOQUE
              </Link>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-4">
                La plataforma de carteles físicos inteligentes con chips NFC y QR directo a reseñas de Google. Tu cartel, con datos.
              </p>
              <div className="text-slate-500">{LEGAL_CONFIG.DOMICILIO}</div>
            </div>

            <div className="md:col-span-2">
              <div className="font-semibold text-slate-900 mb-3">Plataforma</div>
              <ul className="space-y-2">
                <li><a href="#como-funciona" className="hover:text-slate-900">Cómo funciona</a></li>
                <li><a href="#red-fabricantes" className="hover:text-slate-900 font-semibold text-blue-700">Red de Fabricantes</a></li>
                <li><a href="#fabricantes" className="hover:text-slate-900">Para fabricantes</a></li>
                <li><a href="#negocios" className="hover:text-slate-900">Para negocios</a></li>
                <li><a href="#privacidad" className="hover:text-slate-900">Privacidad</a></li>
                <li><a href="#precios" className="hover:text-slate-900">Precios</a></li>
              </ul>
            </div>

            <div className="md:col-span-3">
              <div className="font-semibold text-slate-900 mb-3">Accesos directos</div>
              <ul className="space-y-2">
                <li><Link to="/login" className="hover:text-slate-900">Ingreso con enlace mágico</Link></li>
                <li><Link to="/resumen" className="hover:text-slate-900">Panel de negocio (Demo)</Link></li>
                <li><Link to="/fabricante" className="hover:text-slate-900">Panel de fabricante (Demo)</Link></li>
                <li><Link to="/ui" className="hover:text-slate-900">Galería UI</Link></li>
              </ul>
            </div>

            <div className="md:col-span-3">
              <div className="font-semibold text-slate-900 mb-3">Marco Legal (Argentina)</div>
              <ul className="space-y-2 mb-4">
                <li><Link to="/terminos" className="hover:text-slate-900">Términos y Condiciones</Link></li>
                <li><Link to="/privacidad" className="hover:text-slate-900">Política de Privacidad</Link></li>
                <li><Link to="/cookies" className="hover:text-slate-900">Política de Cookies</Link></li>
                <li><Link to="/reembolso" className="hover:text-slate-900">Reembolso y Cancelación</Link></li>
              </ul>

              <Link
                to="/arrepentimiento"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Botón de Arrepentimiento</span>
              </Link>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <p>© {new Date().getFullYear()} {LEGAL_CONFIG.TITULAR}. CUIT {LEGAL_CONFIG.CUIT}.</p>
            <div className="flex items-center gap-3">
              <span>Buenos Aires, Argentina</span>
              <span>•</span>
              <span>SLA 99.8%</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Banner de Cookies */}
      <CookieBanner />
    </div>
  );
};

export default LandingView;
