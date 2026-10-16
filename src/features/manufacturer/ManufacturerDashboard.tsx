/**
 * Toque — Panel del Fabricante Integral (ManufacturerDashboard)
 * Rediseñado con la estética Aurora Liquid Glass:
 * - Centro neurálgico con gran métrica editorial ("42 de 50 Carteles Activos").
 * - Curva de onda SVG interactiva (Spline wave) con flujo de red.
 * - Navegación en chips de vidrio líquido con indicador activo luminoso.
 * - Tarjeta "Negocios en riesgo" en vidrio ámbar con WhatsApp en 1 clic.
 * - 9 pestañas completas y todos los modales intactos y funcionales.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import {
  api,
  Tenant,
  Cartel,
  BusinessAtRisk,
  ReplacementOrder,
  ManufacturerPlan,
  ManufacturerStaffUser,
  InvoiceItem,
} from '../../api';
import { useDataQuery } from '../../hooks/useDataQuery';
import { Card } from '../../components/ui/Card';
import { Stat } from '../../components/ui/Stat';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { BrandPreview } from '../../components/ui/BrandPreview';
import { useToast } from '../../components/ui/Toast';
import { formatNumber } from '../../lib/formatters';
import { getShortUrl, getShortUrlDisplay } from '../../lib/urls';

// Subcomponentes del Fabricante
import { ManufacturerAtRiskModal } from './ManufacturerAtRiskModal';
import { QuickBusinessModal } from './QuickBusinessModal';
import { CreateCartelModal } from './CreateCartelModal';
import { BatchImportModal } from './BatchImportModal';
import { PrintKitView } from './PrintKitView';
import { ReplacementOrdersView } from './ReplacementOrdersView';
import { ManufacturerBillingView } from './ManufacturerBillingView';
import { ManufacturerStaffView } from './ManufacturerStaffView';
import { ManufacturerOnboardingWizard } from './ManufacturerOnboardingWizard';
import { ManufacturerNetworkSection } from './ManufacturerNetworkSection';
import { ReplaceCartelSheet } from '../business/ReplaceCartelSheet';

import {
  Factory,
  Store,
  QrCode,
  Sparkles,
  Palette,
  ExternalLink,
  ShieldCheck,
  Check,
  AlertTriangle,
  Clock,
  MessageSquare,
  Plus,
  UploadCloud,
  Printer,
  CreditCard,
  Calculator,
  RotateCcw,
  Users,
  HelpCircle,
  Search,
  ChevronRight,
  Pause,
  Play,
  Share2,
  TrendingUp,
  Radio,
  Layers,
  Globe,
  MapPin,
  Tag,
} from 'lucide-react';

type ManufacturerTab =
  | 'tablero'
  | 'carteles'
  | 'negocios'
  | 'red_fabricantes'
  | 'kit_impresion'
  | 'reposiciones'
  | 'equipo'
  | 'plan_facturacion';

export const ManufacturerDashboard: React.FC = () => {
  const { tenant } = useAuth();
  const { brandColor, setBrandColor, contrastInfo } = useTheme();
  const { success, error: toastError } = useToast();

  const manufacturerId = tenant?.type === 'manufacturer' ? tenant.id : 'tenant-mfg-demo';

  // Pestaña activa sincronizada con la barra lateral izquierda
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as ManufacturerTab | null;
  const activeTab: ManufacturerTab = tabFromUrl || 'tablero';
  const setActiveTab = (tab: ManufacturerTab) => {
    setSearchParams({ tab });
  };

  // Modales
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isQuickBizOpen, setIsQuickBizOpen] = useState(false);
  const [isCreateCartelOpen, setIsCreateCartelOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [atRiskTarget, setAtRiskTarget] = useState<BusinessAtRisk | null>(null);
  const [replaceCartelTarget, setReplaceCartelTarget] = useState<Cartel | null>(null);

  // Filtros de Negocios
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'at_risk' | 'paused'>('all');
  const [sortOrder, setSortOrder] = useState<'name' | 'carteles' | 'recent'>('name');

  // Configuración de Marca Blanca editable
  const [brandNameInput, setBrandNameInput] = useState(tenant?.name || 'Cartelería Demo');
  const [brandColorInput, setBrandColorInput] = useState(brandColor || '#3A3FE0');
  const [brandLogoInput, setBrandLogoInput] = useState(tenant?.brandLogo || '');
  const [supportPhoneInput, setSupportPhoneInput] = useState('+54 9 11 4455-8899');
  const [supportEmailInput, setSupportEmailInput] = useState('soporte@carteleriademo.com.ar');
  const [customDomainInput, setCustomDomainInput] = useState(tenant?.website || '');
  const [isSavingBrand, setIsSavingBrand] = useState(false);

  // Disparar onboarding paso a paso si llega con welcome=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === '1') {
      setIsOnboardingOpen(true);
    }
  }, []);

  // 1. Negocios clientes
  const {
    data: businesses,
    isLoading: isLoadingBiz,
    isError: isErrorBiz,
    error: errorBiz,
    refetch: refetchBiz,
  } = useDataQuery<Tenant[]>({
    queryFn: () => api.listBusinesses(manufacturerId),
  });

  // 2. Todos los carteles
  const {
    data: carteles,
    refetch: refetchCarteles,
  } = useDataQuery<Cartel[]>({
    queryFn: () => api.listCarteles(),
  });

  // 3. Negocios en riesgo (14+ días sin toques)
  const {
    data: businessesAtRisk,
    refetch: refetchAtRisk,
  } = useDataQuery<BusinessAtRisk[]>({
    queryFn: () => api.getBusinessesAtRisk(manufacturerId),
  });

  // 4. Plan del fabricante
  const {
    data: plan,
    refetch: refetchPlan,
  } = useDataQuery<ManufacturerPlan>({
    queryFn: () => api.getManufacturerPlan(manufacturerId),
  });

  // 5. Pedidos de reposición
  const {
    data: replacementOrders,
    refetch: refetchOrders,
  } = useDataQuery<ReplacementOrder[]>({
    queryFn: () => api.listReplacementOrders(manufacturerId),
  });

  // 6. Equipo del taller
  const {
    data: staffList,
    refetch: refetchStaff,
  } = useDataQuery<ManufacturerStaffUser[]>({
    queryFn: () => api.listManufacturerStaff(manufacturerId),
  });

  // 7. Facturas
  const {
    data: invoices,
  } = useDataQuery<InvoiceItem[]>({
    queryFn: () => api.listInvoices(manufacturerId),
  });

  // Guardar marca blanca
  const handleSaveBrand = async () => {
    setIsSavingBrand(true);
    try {
      setBrandColor(brandColorInput);
      if (tenant) {
        await api.updateTenantBrand(tenant.id, {
          brandColor: brandColorInput,
          name: brandNameInput,
          brandLogo: brandLogoInput,
        });
      }
      success('Marca blanca actualizada', 'Tus clientes ahora verán tus nuevos colores y logotipos.');
    } catch (err) {
      toastError('No se pudo guardar la marca', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSavingBrand(false);
    }
  };

  // Filtrado de Negocios
  const filteredBusinesses = useMemo(() => {
    if (!businesses) return [];

    return businesses
      .filter((biz) => {
        const isPaused = (biz as any).isPaused;
        const isAtRisk = businessesAtRisk?.some((r) => r.business.id === biz.id);

        if (statusFilter === 'paused' && !isPaused) return false;
        if (statusFilter === 'active' && isPaused) return false;
        if (statusFilter === 'at_risk' && !isAtRisk) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = biz.name.toLowerCase().includes(q);
          const matchEmail = biz.contactEmail.toLowerCase().includes(q);
          if (!matchName && !matchEmail) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'name') return a.name.localeCompare(b.name);
        if (sortOrder === 'carteles') {
          const countA = (carteles || []).filter((s) => s.businessId === a.id).length;
          const countB = (carteles || []).filter((s) => s.businessId === b.id).length;
          return countB - countA;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [businesses, statusFilter, searchQuery, sortOrder, businessesAtRisk, carteles]);

  if (isErrorBiz) {
    return (
      <div className="py-12">
        <ErrorState
          title="No pudimos cargar los negocios del fabricante"
          message={errorBiz?.message}
          onRetry={refetchBiz}
        />
      </div>
    );
  }

  const totalCartelesCount = carteles?.filter((s) => s.status !== 'trash').length || 0;
  const cartelesLimit = plan?.cartelesLimit || 50;
  const totalScansMonth = carteles?.reduce((acc, c) => acc + (c.scansCount || 0), 0) || 0;

  return (
    <div className="space-y-6 text-white">
      {/* 1. CABECERA CON MARCA Y ACCIONES GLOBALES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Panel del Fabricante
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-white tracking-tight mt-0.5">
            {tenant?.name || 'Taller de Cartelería y Grabado'}
          </h1>
          <p className="text-xs text-white/70 mt-0.5">
            Producción de carteles inteligentes con NFC y QR dinámico.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="primary"
            onClick={() => setIsCreateCartelOpen(true)}
            icon={<Plus className="w-4 h-4 text-slate-900" />}
            className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
          >
            Crear cartel (solo link)
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsBatchImportOpen(true)}
            icon={<UploadCloud className="w-4 h-4 text-white" />}
          >
            Alta masiva CSV
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsQuickBizOpen(true)}
            icon={<Store className="w-4 h-4 text-white" />}
          >
            Nuevo negocio
          </Button>
        </div>
      </div>

      {/* Selector de pestañas para móvil (en desktop se controla desde la barra lateral izquierda) */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {[
          { id: 'tablero', label: 'Tablero' },
          { id: 'carteles', label: `Carteles (${carteles?.filter(s => s.status !== 'trash').length || 0})` },
          { id: 'negocios', label: `Comercios (${businesses?.length || 0})` },
          { id: 'red_fabricantes', label: 'Red' },
          { id: 'kit_impresion', label: 'Kit Impresión' },
          { id: 'reposiciones', label: 'Reposiciones' },
          { id: 'equipo', label: 'Equipo' },
          { id: 'plan_facturacion', label: 'Plan' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as ManufacturerTab)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-slate-950 font-bold shadow-md'
                : 'bg-white/5 text-white/70 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENEDOR PRINCIPAL: 100% DEL ANCHO (MÁXIMO ESPACIO EN EL PANEL) */}
      <div className="w-full space-y-6">

      {/* ============================================================== */}
      {/* VISTA 1: TABLERO GENERAL (OVERVIEW)                            */}
      {/* ============================================================== */}
      {activeTab === 'tablero' && (
        <div className="space-y-6">
          {/* CENTRO NEURÁLGICO: HERO LIQUID GLASS */}
          <section className="aurora-card-glass aurora-sheen p-6 sm:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <Factory className="w-3.5 h-3.5 text-white/90" />
                  <span>Cupo de Producción & Red Activa</span>
                </div>

                <div className="flex items-baseline gap-4 mt-2">
                  <span className="font-headline text-5xl sm:text-7xl font-light text-white tracking-tight">
                    {totalCartelesCount}
                  </span>
                  <span className="text-xl sm:text-2xl text-white/60 font-light">
                    / {cartelesLimit} carteles
                  </span>
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <TrendingUp className="w-3 h-3" />
                      {Math.round((totalCartelesCount / cartelesLimit) * 100)}% de cupo usado
                    </span>
                    <p className="text-xs text-white/60">
                      {cartelesLimit - totalCartelesCount} carteles disponibles para asignar
                    </p>
                  </div>
                </div>
              </div>

              {/* Chips Atmosféricos del Fabricante */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="aurora-chip-glass px-4 py-2 flex items-center gap-2 text-xs">
                  <Store className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{businesses?.length || 0} Comercios Activos</span>
                </div>

                <div className="aurora-chip-glass px-4 py-2 flex items-center gap-2 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{formatNumber(totalScansMonth)} Toques en tu red</span>
                </div>

                <div className="aurora-chip-glass px-4 py-2 flex items-center gap-2 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
                  <span>100% Identidad Propia</span>
                </div>
              </div>
            </div>

            {/* Curva de Onda de Escaneos de Toda la Red */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Actividad Acumulada de Toda la Red
                  </h3>
                  <p className="text-xs text-white/60">
                    Suma en tiempo real de toques NFC y lecturas QR de tus clientes gastronómicos y comerciales.
                  </p>
                </div>
              </div>

              <div className="relative w-full h-40 bg-white/5 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center p-2">
                <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="mfgWaveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                      <stop offset="50%" stopColor="#6A6FFF" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#19C37D" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 50 140 C 150 160, 250 80, 350 100 C 450 120, 550 40, 650 60 C 700 70, 750 30, 750 30 L 750 190 L 50 190 Z"
                    fill="url(#mfgWaveGrad)"
                  />
                  <path
                    d="M 50 140 C 150 160, 250 80, 350 100 C 450 120, 550 40, 650 60 C 700 70, 750 30, 750 30"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="350" cy="100" r="5" fill="#ffffff" stroke="#6A6FFF" strokeWidth="2" />
                  <circle cx="650" cy="60" r="5" fill="#ffffff" stroke="#6A6FFF" strokeWidth="2" />
                  <circle cx="750" cy="30" r="6" fill="#19C37D" stroke="#ffffff" strokeWidth="2" />
                </svg>

                <div className="absolute top-4 right-4 aurora-chip-glass p-2.5 rounded-2xl flex items-center gap-3 text-xs shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-white/80">Pico hoy: <strong className="text-white">19:30 hs</strong> (+210 toques en red)</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECCIÓN OBLIGATORIA: "NEGOCIOS EN RIESGO" (14+ DÍAS SIN ACTIVIDAD) */}
          {businessesAtRisk && businessesAtRisk.length > 0 && (
            <Card className="p-6 border-amber-400/40 bg-amber-500/10 backdrop-blur-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5 border border-amber-400/30">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-headline font-bold text-white">
                      Negocios en Riesgo de Desuso ({businessesAtRisk.length})
                    </h3>
                    <p className="text-xs text-white/80 mt-0.5">
                      No registran toques hace más de 14 días. Contactalos con un mensaje prearmado para ayudarlos a reubicar el cartel y retener al cliente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {businessesAtRisk.map((riskItem) => (
                  <div
                    key={riskItem.business.id}
                    className="p-4 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {riskItem.business.name}
                      </h4>
                      <p className="text-xs text-white/70 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-amber-300" />
                        <span>Sin actividad hace <strong className="text-white">{riskItem.daysWithoutScans} días</strong> ({riskItem.cartelesCount} carteles)</span>
                      </p>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setAtRiskTarget(riskItem)}
                      icon={<MessageSquare className="w-3.5 h-3.5 text-slate-900" />}
                      className="bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-semibold border-transparent shrink-0"
                    >
                      WhatsApp
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Accesos Rápidos y Negocios Recientes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Últimos Negocios Asignados
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('negocios')}>
                  Ver todos los comercios
                </Button>
              </div>

              <div className="divide-y divide-white/10">
                {(businesses || []).slice(0, 5).map((biz) => {
                  const bizCarteles = (carteles || []).filter((s) => s.businessId === biz.id);
                  return (
                    <div key={biz.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-medium text-sm text-white block">
                          {biz.name}
                        </span>
                        <span className="text-xs text-white/60 font-mono">
                          {biz.contactEmail} • {bizCarteles.length} carteles en servicio
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            window.open(`/login?impersonate=${biz.id}`, '_blank');
                          }}
                          icon={<ExternalLink className="w-3.5 h-3.5 text-white" />}
                        >
                          Ver su panel
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA 1.5: GESTIÓN DE CARTELES (SOLO LINK DE GOOGLE MAPS)      */}
      {/* ============================================================== */}
      {activeTab === 'carteles' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-headline font-bold text-white tracking-tight">
                Carteles generados
              </h2>
              <p className="text-xs text-white/70 mt-0.5">
                Para crear un cartel solo ingresá el link de Google Maps. No es necesario dar de alta un comercio antes.
              </p>
            </div>

            <Button
              variant="primary"
              onClick={() => setIsCreateCartelOpen(true)}
              icon={<Plus className="w-4 h-4 text-slate-900" />}
              className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
            >
              Crear nuevo cartel
            </Button>
          </div>

          {(!carteles || carteles.filter(s => s.status !== 'trash').length === 0) ? (
            <Card className="p-10 text-center space-y-4 border-white/20 bg-white/10 backdrop-blur-md">
              <div className="w-12 h-12 rounded-2xl bg-cyan-400/20 text-cyan-300 mx-auto flex items-center justify-center border border-cyan-400/30">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-headline text-lg font-bold text-white">
                  No tenés carteles creados aún
                </h3>
                <p className="text-xs text-white/70 mt-1 max-w-md mx-auto leading-relaxed">
                  Generá carteles físicos pegando directamente la URL de reseñas de Google Maps de tus clientes.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setIsCreateCartelOpen(true)}
                icon={<Plus className="w-4 h-4 text-slate-900" />}
                className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
              >
                Crear primer cartel
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {carteles.filter(s => s.status !== 'trash').map((c) => (
                <Card key={c.id} className="p-5 border-white/20 bg-white/10 backdrop-blur-md space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-headline text-base font-bold text-white">{c.name}</h4>
                      <p className="text-xs text-white/60">{c.locationDescription || 'Ubicación física lista'}</p>
                    </div>
                    <span className="font-mono text-[11px] bg-white/10 text-cyan-300 px-2 py-0.5 rounded font-bold">
                      {c.code || c.shortCode}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-white/90 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-white/60">Enlace dinámico:</span>
                      <a href={getShortUrl(c.shortCode)} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline flex items-center gap-1">
                        {getShortUrlDisplay(c.shortCode)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex justify-between items-center text-[11px] truncate">
                      <span className="text-white/60">Destino Maps:</span>
                      <span className="text-white/80 truncate max-w-[200px]">{c.targetUrl}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/70 pt-1">
                    <span>{c.scansCount || 0} toques registrados</span>
                    <button
                      type="button"
                      onClick={() => setReplaceCartelTarget(c)}
                      className="text-amber-300 hover:underline text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reemplazar por rotura
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA 2: LISTA DE NEGOCIOS CLIENTES                           */}
      {/* ============================================================== */}
      {activeTab === 'negocios' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-headline font-bold text-white">
                Negocios que usan tus carteles
              </h2>
              <p className="text-xs text-white/70 mt-0.5">
                Administrá comercios clientes, generá carteles y reenviá invitaciones.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsBatchImportOpen(true)}
                icon={<UploadCloud className="w-3.5 h-3.5 text-white" />}
              >
                Importar CSV
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsQuickBizOpen(true)}
                icon={<Plus className="w-3.5 h-3.5 text-slate-900" />}
              >
                Alta rápida
              </Button>
            </div>
          </div>

          {/* Filtros, Búsqueda y Orden */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-white/10 rounded-xl border border-white/15 backdrop-blur-md overflow-x-auto text-xs">
              {[
                { id: 'all', label: `Todos (${businesses?.length || 0})` },
                { id: 'active', label: 'Activos' },
                { id: 'at_risk', label: `En riesgo (${businessesAtRisk?.length || 0})` },
                { id: 'paused', label: 'Pausados' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-white text-slate-900 shadow-md font-semibold'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-white/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar negocio o mail..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md text-xs text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
              </div>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="py-1.5 px-3 rounded-xl border border-white/25 bg-[#0d1b2e] text-xs text-white cursor-pointer font-medium focus:outline-none focus:ring-1 focus:ring-white/40"
              >
                <option value="name" className="bg-[#0b1728] text-white">Alfabético (A-Z)</option>
                <option value="carteles" className="bg-[#0b1728] text-white">Más carteles</option>
                <option value="recent" className="bg-[#0b1728] text-white">Más recientes</option>
              </select>
            </div>
          </div>

          {/* Grid de Negocios */}
          {filteredBusinesses.length === 0 ? (
            <EmptyState
              icon={<Store className="w-8 h-8 text-white" />}
              title="No se encontraron negocios"
              description="Probá ajustando el filtro de búsqueda o da de alta un nuevo negocio cliente."
              actionLabel="Alta rápida de negocio"
              onAction={() => setIsQuickBizOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBusinesses.map((biz) => {
                const bizCarteles = (carteles || []).filter((s) => s.businessId === biz.id);
                const isAtRisk = businessesAtRisk?.some((r) => r.business.id === biz.id);
                const isPaused = (biz as any).isPaused;

                return (
                  <Card key={biz.id} className="p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-headline text-base font-bold text-white truncate">
                            {biz.name}
                          </h3>
                          <p className="text-xs text-white/60 font-mono truncate mt-0.5">
                            {biz.contactEmail}
                          </p>
                        </div>

                        {/* Estado WCAG AA */}
                        <div className="shrink-0">
                          {isPaused ? (
                            <span className="text-xs font-medium text-white/40">Pausado</span>
                          ) : isAtRisk ? (
                            <span className="text-xs font-medium text-amber-300 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> En riesgo
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-emerald-300 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Activo
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Carteles del negocio */}
                      <div className="mt-4 pt-3 border-t border-white/10 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-white/70">
                          <span>Carteles en servicio:</span>
                          <strong className="text-white font-semibold">
                            {bizCarteles.length} carteles
                          </strong>
                        </div>

                        {bizCarteles.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] text-white/60 block">Códigos cortos:</span>
                            <div className="flex flex-wrap gap-1">
                              {bizCarteles.slice(0, 3).map((st) => (
                                <span
                                  key={st.id}
                                  className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white font-bold border border-white/15"
                                >
                                  {st.shortCode}
                                </span>
                              ))}
                              {bizCarteles.length > 3 && (
                                <span className="text-[10px] text-white/50">+{bizCarteles.length - 3}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-1 flex-wrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const inviteMsg = `Hola! Tu panel de Toque está listo para que veas tus reseñas de Google: https://toque.ar/login?biz=${biz.id}`;
                          navigator.clipboard.writeText(inviteMsg);
                          success('Invitación copiada', 'Pegala en WhatsApp o enviásela por email.');
                        }}
                        icon={<Share2 className="w-3.5 h-3.5 text-white" />}
                      >
                        Invitar
                      </Button>

                      {bizCarteles[0] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReplaceCartelTarget(bizCarteles[0])}
                        >
                          Reemplazo
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const newStatus = isPaused ? 'active' : 'paused';
                          await api.updateBusinessStatus(biz.id, newStatus);
                          success(newStatus === 'paused' ? 'Negocio pausado' : 'Negocio reactivado');
                          refetchBiz();
                        }}
                      >
                        {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-300" /> : <Pause className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA 2.5: RED DE FABRICANTES (SUBIRSE, CATALOGO, PRODUCTOS)   */}
      {/* ============================================================== */}
      {activeTab === 'red_fabricantes' && (
        <ManufacturerNetworkSection
          tenant={tenant}
          onUpdated={() => {
            refetchBiz();
            refetchCarteles();
          }}
        />
      )}

      {/* ============================================================== */}
      {/* VISTA 3: KIT DE IMPRESIÓN Y GRABACIÓN                         */}
      {/* ============================================================== */}
      {activeTab === 'kit_impresion' && (
        <PrintKitView carteles={carteles || []} businesses={businesses || []} />
      )}

      {/* ============================================================== */}
      {/* VISTA 5: PLAN Y FACTURACIÓN                                    */}
      {/* ============================================================== */}
      {activeTab === 'plan_facturacion' && plan && (
        <ManufacturerBillingView
          plan={plan}
          invoices={invoices || []}
          manufacturerId={manufacturerId}
          onPlanUpdated={refetchPlan}
        />
      )}

      {/* ============================================================== */}
      {/* VISTA 6: BANDEJA DE REPOSICIONES                               */}
      {/* ============================================================== */}
      {activeTab === 'reposiciones' && (
        <ReplacementOrdersView
          orders={replacementOrders || []}
          onOrderUpdated={refetchOrders}
        />
      )}

      {/* ============================================================== */}
      {/* VISTA 7: EQUIPO DEL TALLER                                     */}
      {/* ============================================================== */}
      {activeTab === 'equipo' && (
        <ManufacturerStaffView
          staff={staffList || []}
          manufacturerId={manufacturerId}
          onStaffUpdated={refetchStaff}
        />
      )}
      </div>

      {/* ============================================================== */}
      {/* MODALES CONECTADOS                                             */}
      {/* ============================================================== */}

      {/* Modal Negocios en Riesgo */}
      <ManufacturerAtRiskModal
        isOpen={!!atRiskTarget}
        onClose={() => setAtRiskTarget(null)}
        atRiskItem={atRiskTarget}
      />

      {/* Modal Crear Cartel Directo (Solo link de Google Maps) */}
      <CreateCartelModal
        isOpen={isCreateCartelOpen}
        onClose={() => setIsCreateCartelOpen(false)}
        manufacturerId={manufacturerId}
        onCartelesCreated={() => {
          refetchCarteles();
          refetchPlan();
        }}
      />

      {/* Modal Alta Rápida de Negocio */}
      <QuickBusinessModal
        isOpen={isQuickBizOpen}
        onClose={() => setIsQuickBizOpen(false)}
        manufacturerId={manufacturerId}
        onBusinessCreated={() => {
          refetchBiz();
          refetchCarteles();
          refetchPlan();
        }}
      />

      {/* Modal Alta Masiva CSV */}
      <BatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        manufacturerId={manufacturerId}
        onImportComplete={() => {
          refetchBiz();
          refetchCarteles();
          refetchPlan();
        }}
      />

      {/* Modal de Reemplazo de Cartel */}
      <ReplaceCartelSheet
        isOpen={!!replaceCartelTarget}
        onClose={() => setReplaceCartelTarget(null)}
        cartel={replaceCartelTarget}
        onSuccess={() => {
          refetchCarteles();
          refetchOrders();
        }}
      />
    </div>
  );
};

export default ManufacturerDashboard;
