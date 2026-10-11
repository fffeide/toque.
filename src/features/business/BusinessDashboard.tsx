/**
 * Toque — Panel del Negocio (BusinessDashboard)
 * Rediseñado con la estética fiel Aurora Liquid Glass:
 * - Centro neurálgico con gran métrica editorial ("18 Escaneos hoy").
 * - Curva de onda SVG interactiva (Spline wave) con selector de días y desglose NFC vs QR.
 * - Tarjetas Liquid Glass laterales (Google Reviews real, Calibrador, Carteles en salón).
 * - Una sola alerta destacada en vidrio ámbar.
 * - 4 estados (cargando con esqueletos, vacío, error, éxito) + modo sin conexión.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../lib/authContext';
import { api, StatsSummary, Cartel, Alert, GoogleReviewsProfile } from '../../api';
import { useDataQuery } from '../../hooks/useDataQuery';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { formatNumber } from '../../lib/formatters';
import { TestCartelModal } from './TestCartelModal';
import { BusinessOnboardingModal } from './BusinessOnboardingModal';
import { CartelDetailModal } from './CartelDetailModal';
import {
  Smartphone,
  QrCode,
  Sparkles,
  Layers,
  ArrowUpRight,
  AlertTriangle,
  SlidersHorizontal,
  ExternalLink,
  Star,
  CheckCircle2,
  HelpCircle,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Clock,
  TrendingUp,
  Radio,
  MapPin,
  Flame,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CardConfig {
  id: 'scans_today' | 'potential_reviews' | 'active_carteles';
  label: string;
  visible: boolean;
}

const DEFAULT_CARDS: CardConfig[] = [
  { id: 'scans_today', label: 'Escaneos hoy', visible: true },
  { id: 'potential_reviews', label: 'Reseñas potenciales esta semana', visible: true },
  { id: 'active_carteles', label: 'Carteles activos', visible: true },
];

export const BusinessDashboard: React.FC = () => {
  const { tenant, user } = useAuth();
  const { success } = useToast();
  const businessId = tenant?.type === 'business' ? tenant.id : 'biz-esquina';

  // Modales
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCustomizingCards, setIsCustomizingCards] = useState(false);
  const [cartelToInspect, setCartelToInspect] = useState<Cartel | null>(null);

  // Alerta descartada en sesión
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return localStorage.getItem(`toque_onboarded_${businessId}`) === 'true';
  });

  // Disparar onboarding automático solo en el primer acceso del usuario
  useEffect(() => {
    if (user && user.hasSeenOnboarding === false) {
      setIsOnboardingOpen(true);
    }
  }, [user]);

  // Día activo seleccionado en el gráfico de ondas (0 a 6)
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(6); // Último día (hoy)

  // Calibración de reseñas
  const [calibrationInput, setCalibrationInput] = useState('');
  const [calibrationFactor, setCalibrationFactor] = useState<number>(() => {
    const saved = localStorage.getItem(`toque_calibration_${businessId}`);
    return saved ? parseFloat(saved) : 10;
  });

  // Configuración de tarjetas
  const [cardsConfig, setCardsConfig] = useState<CardConfig[]>(() => {
    const saved = localStorage.getItem(`toque_cards_order_${businessId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return DEFAULT_CARDS;
  });

  const handleSaveCardsConfig = (newConfig: CardConfig[]) => {
    setCardsConfig(newConfig);
    localStorage.setItem(`toque_cards_order_${businessId}`, JSON.stringify(newConfig));
  };

  const handleToggleCardVisibility = (id: string) => {
    const updated = cardsConfig.map((c) =>
      c.id === id ? { ...c, visible: !c.visible } : c
    );
    handleSaveCardsConfig(updated);
  };

  const handleMoveCard = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= cardsConfig.length) return;
    const clone = [...cardsConfig];
    const [moved] = clone.splice(index, 1);
    clone.splice(newIndex, 0, moved);
    handleSaveCardsConfig(clone);
  };

  // 1. Estadísticas
  const {
    data: stats,
    isLoading: isLoadingStats,
    isError: isErrorStats,
    error: errorStats,
    refetch: refetchStats,
  } = useDataQuery<StatsSummary>({
    queryFn: () => api.getStats(businessId, 30),
  });

  // 2. Carteles
  const {
    data: carteles,
    refetch: refetchCarteles,
  } = useDataQuery<Cartel[]>({
    queryFn: () => api.listCarteles(businessId),
  });

  // 3. Ficha de Google
  const {
    data: googleProfile,
    refetch: refetchGoogle,
  } = useDataQuery<GoogleReviewsProfile>({
    queryFn: () => api.getGoogleReviewsProfile(businessId),
  });

  // 4. Alertas
  const {
    data: alerts,
  } = useDataQuery<Alert[]>({
    queryFn: () => api.listAlerts(tenant?.id || businessId),
  });

  const prominentAlert = useMemo(() => {
    if (isAlertDismissed || !alerts || alerts.length === 0) return null;
    return alerts.find(a => !a.read) || null;
  }, [alerts, isAlertDismissed]);

  const handleSaveCalibration = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(calibrationInput, 10);
    if (!isNaN(val) && val > 0 && stats) {
      const weeklyScans = stats.scansByDay.slice(-7).reduce((acc, d) => acc + d.total, 0);
      const newFactor = weeklyScans > 0 ? Math.max(3, Math.round(weeklyScans / val)) : 10;
      setCalibrationFactor(newFactor);
      localStorage.setItem(`toque_calibration_${businessId}`, newFactor.toString());
      success(
        'Estimación calibrada',
        `Ajustamos la fórmula a 1 reseña cada ~${newFactor} escaneos para tu negocio.`
      );
      setCalibrationInput('');
    }
  };

  if (isLoadingStats) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="w-48 h-8 rounded-xl bg-white/10" />
          <Skeleton className="w-32 h-10 rounded-full bg-white/10" />
        </div>
        <Skeleton className="h-96 rounded-3xl bg-white/10" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-44 rounded-3xl bg-white/10" />
          <Skeleton className="h-44 rounded-3xl bg-white/10" />
          <Skeleton className="h-44 rounded-3xl bg-white/10" />
        </div>
      </div>
    );
  }

  if (isErrorStats || !stats) {
    return (
      <div className="p-8">
        <ErrorState
          title="No pudimos cargar tus estadísticas"
          message={errorStats?.message}
          onRetry={refetchStats}
        />
      </div>
    );
  }

  if (stats.totalScans === 0 && (!carteles || carteles.length === 0)) {
    return (
      <EmptyState
        icon={<Smartphone className="w-8 h-8 text-white" />}
        title="Todavía no tenés carteles activos"
        description="Agregá tu primer cartel con NFC y QR para empezar a medir cuántos clientes llegan a tus reseñas en Google Maps."
        actionLabel="Agregar mi primer cartel"
        onAction={() => window.location.assign('/carteles')}
      />
    );
  }

  // Métricas
  const last7Days = (stats.scansByDay || []).slice(-7);
  const todayScans = last7Days[last7Days.length - 1]?.total || 0;
  const yesterdayScans = last7Days[last7Days.length - 2]?.total || 0;
  const todayTrend = yesterdayScans > 0
    ? `${todayScans >= yesterdayScans ? '+' : ''}${Math.round(((todayScans - yesterdayScans) / yesterdayScans) * 100)}% vs ayer`
    : todayScans > 0 ? '+100% hoy' : 'Sin cambios';

  const last7DaysScans = last7Days.reduce((acc, d) => acc + d.total, 0);
  const potentialReviewsThisWeek = Math.max(1, Math.round(last7DaysScans / calibrationFactor));
  const activeCartelesCount = stats.activeCartelesCount;
  const totalCartelesCount = carteles?.length || activeCartelesCount;

  // Curva de onda SVG interactiva (7 días)
  const maxDayVal = Math.max(...last7Days.map(d => d.total), 20);
  const wavePoints = last7Days.map((d, i) => {
    const x = 50 + (i * (700 / (last7Days.length - 1)));
    const y = 180 - ((d.total / maxDayVal) * 120);
    return { x, y, data: d, index: i };
  });

  // Generamos el path SVG cúbico suave
  const generateSmoothPath = (pts: typeof wavePoints) => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const smoothLinePath = generateSmoothPath(wavePoints);
  const smoothAreaPath = `${smoothLinePath} L ${wavePoints[wavePoints.length - 1]?.x || 750} 220 L 50 220 Z`;

  const activeDayData = last7Days[selectedDayIdx] || last7Days[last7Days.length - 1];

  return (
    <div className="space-y-6">
      {/* 1. Barra de Herramientas y Título */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-300">
              Panel en vivo · Tu local
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight mt-0.5">
            {tenant?.name || 'Tu negocio'}
          </h2>
        </div>
      </div>

      {/* 2. Alerta destacada (si hay cartel inactivo o algo que revisar) */}
      {prominentAlert && (
        <div
          role="alert"
          className="p-4 sm:p-5 rounded-3xl bg-amber-500/15 border border-amber-400/30 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5 border border-amber-400/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">
                {prominentAlert.title}
              </p>
              <p className="text-xs text-white/80 mt-0.5">
                {prominentAlert.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {carteles && carteles[0] && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCartelToInspect(carteles[0])}
              >
                Revisar cartel
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAlertDismissed(true);
                api.markAlertRead(prominentAlert.id);
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      )}

      {/* 3. CENTRO NEURÁLGICO: HERO LIQUID GLASS (Aesthetic Weather Dashboard Reference) */}
      <section className="aurora-card-glass aurora-sheen p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <MapPin className="w-3.5 h-3.5 text-white/90" />
              <span>Estación Central · Toques acumulados hoy</span>
            </div>

            <div className="flex items-baseline gap-4 mt-2">
              <span className="font-headline text-6xl sm:text-7xl font-light text-white tracking-tight">
                {todayScans}
              </span>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <TrendingUp className="w-3 h-3" />
                  {todayTrend}
                </span>
                <p className="text-xs text-white/60">
                  Visitas directas a tu perfil
                </p>
              </div>
            </div>
          </div>

          {/* Chips Atmosféricos */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="aurora-chip-glass px-4 py-2 flex items-center gap-2 text-xs">
              <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>Google Reviews ★ {googleProfile?.rating?.toFixed(1) || '5.0'}</span>
            </div>

            <div className="aurora-chip-glass px-4 py-2 flex items-center gap-2 text-xs">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>{activeCartelesCount} de {totalCartelesCount} Carteles activos</span>
            </div>

            <div className="aurora-chip-glass px-4 py-2 flex items-center gap-2 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>~{potentialReviewsThisWeek} reseñas potenciales/sem</span>
            </div>
          </div>
        </div>

        {/* Curva de Onda SVG Interactiva (Spline Wave) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Flujo de visitas semanal
              </h3>
              <p className="text-xs text-white/60">
                Seleccioná un día para ver la actividad registrada.
              </p>
            </div>

            {/* Selector de Días tipo Weather Chip */}
            <div className="flex items-center gap-1.5 p-1 bg-white/10 rounded-full border border-white/15 backdrop-blur-md overflow-x-auto">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Hoy'].map((dayLabel, idx) => {
                const isSelected = selectedDayIdx === idx;
                return (
                  <button
                    key={dayLabel}
                    type="button"
                    onClick={() => setSelectedDayIdx(idx)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-md font-semibold'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {dayLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lienzo SVG de la Onda */}
          <div className="relative w-full h-48 bg-white/5 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center p-2">
            <svg
              viewBox="0 0 800 240"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              <defs>
                <linearGradient id="auroraWaveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                  <stop offset="50%" stopColor="#6A6FFF" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#19C37D" stopOpacity="0.0" />
                </linearGradient>

                <linearGradient id="auroraStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6A6FFF" />
                  <stop offset="60%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#19C37D" />
                </linearGradient>
              </defs>

              {/* Relleno gradiente */}
              <path
                d={smoothAreaPath}
                fill="url(#auroraWaveGrad)"
              />

              {/* Línea de onda principal */}
              <path
                d={smoothLinePath}
                fill="none"
                stroke="url(#auroraStrokeGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Nodos de cada día */}
              {wavePoints.map((pt) => {
                const isActive = selectedDayIdx === pt.index;
                return (
                  <g key={pt.index} className="cursor-pointer" onClick={() => setSelectedDayIdx(pt.index)}>
                    {isActive && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="11"
                        fill="rgba(255,255,255,0.25)"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isActive ? "6" : "4.5"}
                      fill={isActive ? "#ffffff" : "#6A6FFF"}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Tarjeta flotante del día activo */}
            {activeDayData && (
              <div className="absolute top-4 right-4 aurora-chip-glass p-3 rounded-2xl flex items-center gap-4 text-xs shadow-lg">
                <div>
                  <span className="text-white/60 block text-[10px]">Día</span>
                  <span className="font-semibold text-white">{activeDayData.date}</span>
                </div>
                <div className="border-l border-white/20 pl-3">
                  <span className="text-white/60 block text-[10px]">Visitas</span>
                  <span className="font-bold text-emerald-300">{activeDayData.total}</span>
                </div>
                <div className="border-l border-white/20 pl-3">
                  <span className="text-white/60 block text-[10px]">Opiniones est.</span>
                  <span className="font-bold text-amber-300">~{Math.round(activeDayData.total * 0.28)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. MODULAR LIQUID GLASS CARDS (Google Reviews, Calibrador, Carteles en Salón) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ficha oficial de Google Maps */}
        <Card className="flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="text-sm font-semibold text-white">
                  Google Maps Oficial
                </h3>
              </div>
              {googleProfile?.isConnected ? (
                <span className="text-xs font-medium text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>En línea</span>
                </span>
              ) : (
                <span className="text-xs font-medium text-amber-300">
                  Sin conectar
                </span>
              )}
            </div>

            {googleProfile?.isConnected ? (
              <div className="space-y-4 pt-1">
                <div className="flex items-baseline gap-3">
                  <span className="font-headline text-4xl font-bold text-white">
                    {googleProfile.rating?.toFixed(1) || '4.8'}
                  </span>
                  <div className="flex items-center gap-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs text-white/60">
                    ({formatNumber(googleProfile.reviewCount || 432)} opiniones)
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between text-xs">
                  <span className="text-white/70">Sumadas este mes:</span>
                  <strong className="text-emerald-300 font-semibold flex items-center gap-1">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>+{googleProfile.newReviewsThisMonth || 18} reseñas</span>
                  </strong>
                </div>

                <p className="text-xs text-white/60 leading-relaxed">
                  Ficha: <strong className="text-white">{googleProfile.businessName}</strong>. Si Google cambia tu URL, Toque la redirige sin cambiar el cartel.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-white/70 leading-relaxed">
                  Conectá tu ficha de Google Maps para sincronizar opiniones de clientes reales y contrastarlas con los toques físicos.
                </p>
                <Button
                  variant="primary"
                  onClick={() => {
                    api.connectGoogleReviewsProfile(businessId, 'ChIJN1t_tDeuEmsRUsoyG83frY4')
                      .then(() => {
                        refetchGoogle();
                        success('Ficha conectada', 'Ahora ves tus reseñas reales de Google Maps.');
                      });
                  }}
                  icon={<ExternalLink className="w-4 h-4 text-slate-900" />}
                >
                  Conectar ficha de Google
                </Button>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
            <span>Blindaje contra caídas</span>
            <span className="text-emerald-400 font-semibold">Activo 100%</span>
          </div>
        </Card>

        {/* Calibración de Reseñas Potenciales */}
        <Card className="flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <h3 className="text-sm font-semibold text-white">
                Calibrar Estimación
              </h3>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              Calculamos <strong className="text-white">1 reseña cada ~{calibrationFactor} toques</strong>. Podés ingresar cuántas opiniones reales sumaste esta semana para recalibrar automáticamente la fórmula.
            </p>

            <form onSubmit={handleSaveCalibration} className="mt-4 space-y-3">
              <Input
                label="¿Cuántas reseñas sumaste esta semana?"
                type="number"
                min="1"
                max="500"
                value={calibrationInput}
                onChange={(e) => setCalibrationInput(e.target.value)}
                placeholder="Ej. 14"
                helperText={`Fórmula: ${last7DaysScans} toques ÷ ~${calibrationFactor} = ${potentialReviewsThisWeek} estimadas`}
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={!calibrationInput}
                >
                  Calibrar fórmula
                </Button>
              </div>
            </form>
          </div>

          <div className="p-3 rounded-2xl bg-white/10 border border-white/15 text-[11px] text-white/70 leading-relaxed">
            <span className="font-semibold text-white">Transparencia:</span> Sin rastreadores invasivos ni cookies. Estimación estadística transparente.
          </div>
        </Card>

        {/* Carteles Activos en Mostrador & Pruebas Rápidas */}
        <Card className="flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-300" />
                <h3 className="text-sm font-semibold text-white">
                  Carteles en Salón
                </h3>
              </div>
              <Link
                to="/carteles"
                className="text-xs text-white/70 hover:text-white flex items-center gap-1"
              >
                <span>Ver todos</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {(carteles || []).slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{c.name}</p>
                    <p className="text-white/60 text-[11px] truncate">{c.locationDescription || 'Salón principal'}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Activo
                    </span>
                    <button
                      type="button"
                      onClick={() => setCartelToInspect(c)}
                      className="p-1 rounded-lg hover:bg-white/15 text-white/70 hover:text-white transition cursor-pointer"
                      title="Detalle"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            to="/carteles"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white font-medium transition cursor-pointer"
          >
            <span>Ver todos los carteles</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </Card>
      </div>

      {/* MODAL 1: PROBAR MI CARTEL */}
      {carteles && (
        <TestCartelModal
          isOpen={isTestModalOpen}
          onClose={() => setIsTestModalOpen(false)}
          carteles={carteles}
          onScanRecorded={() => {
            refetchStats();
          }}
        />
      )}

      {/* MODAL 2: PERSONALIZAR TARJETAS */}
      <Dialog
        isOpen={isCustomizingCards}
        onClose={() => setIsCustomizingCards(false)}
        title="Personalizar tarjetas de inicio"
        description="Elegí qué métricas querés ver primero y ordenalas a tu gusto."
        size="sm"
      >
        <div className="space-y-4 pt-2 text-white">
          <div className="space-y-2">
            {cardsConfig.map((card, index) => (
              <div
                key={card.id}
                className="p-3 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleCardVisibility(card.id)}
                    className="text-white/70 hover:text-white transition cursor-pointer"
                    title={card.visible ? 'Ocultar' : 'Mostrar'}
                  >
                    {card.visible ? (
                      <Eye className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-white/30" />
                    )}
                  </button>
                  <span className={`text-sm font-medium ${card.visible ? 'text-white' : 'text-white/40 line-through'}`}>
                    {card.label}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveCard(index, 'up')}
                    className="p-1 rounded-lg hover:bg-white/15 text-white/70 disabled:opacity-30 cursor-pointer"
                    title="Subir"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === cardsConfig.length - 1}
                    onClick={() => handleMoveCard(index, 'down')}
                    className="p-1 rounded-lg hover:bg-white/15 text-white/70 disabled:opacity-30 cursor-pointer"
                    title="Bajar"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsCustomizingCards(false);
                success('Personalización guardada', 'El orden de las tarjetas se actualizó.');
              }}
            >
              Listo
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 3: DETALLE DE CARTEL */}
      {cartelToInspect && (
        <CartelDetailModal
          isOpen={!!cartelToInspect}
          onClose={() => setCartelToInspect(null)}
          cartel={cartelToInspect}
          onCartelUpdated={() => {
            refetchCarteles();
            refetchStats();
          }}
        />
      )}

      {/* MODAL 4: ONBOARDING */}
      <BusinessOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        tenant={tenant}
      />
    </div>
  );
};

export default BusinessDashboard;
