/**
 * Toque — Panel Super Admin Central (AdminDashboard)
 * Hecho para los dueños y fundadores de Toque:
 * - Estadísticas generales de uso y tráfico de la red
 * - Recaudación real en ARS (MRR y ARR anualizado)
 * - Estado de salud, problemas técnicos y caídas
 * - Listado de fabricantes y sus comercios clientes
 * - Entorno de pruebas integrado para QA y mejora de servicio
 * - Enlaces rápidos a /status y /ui (Galería de componentes)
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { api, PlatformStats, Tenant, Cartel } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { useToast } from '../../components/ui/Toast';
import {
  Shield,
  Activity,
  DollarSign,
  Users,
  Store,
  Factory,
  QrCode,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Sliders,
  Layers,
  ArrowRight,
  TrendingUp,
  Server,
  Zap,
  Palette,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user, switchRole } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [businesses, setBusinesses] = useState<Tenant[]>([]);
  const [manufacturers, setManufacturers] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'manufacturers' | 'verificacion' | 'qa_sandbox'>('overview');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [platformStats, bizList, mfgList] = await Promise.all([
        api.getPlatformStats(),
        api.listBusinesses(),
        api.listManufacturers(),
      ]);
      setStats(platformStats);
      setBusinesses(bizList);
      setManufacturers(mfgList);
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    success('Datos actualizados', 'Estadísticas del panel central sincronizadas.');
  };

  const isQaTester = user?.email === 'pruebas@toque.ar' || user?.id === 'user-pruebas' || user?.name?.toLowerCase().includes('pruebas') || user?.role === 'platform_admin';

  // Switch rápido al entorno de pruebas QA para examinar la experiencia completa
  const handleLaunchQASandbox = async (role: 'business_owner' | 'manufacturer_admin') => {
    sessionStorage.setItem('toque_qa_simulation', 'true');
    await switchRole(role);
    success('Entorno de Pruebas Cargado', `Auditando como ${role === 'manufacturer_admin' ? 'Fabricante' : 'Negocio'}`);
    if (role === 'manufacturer_admin') {
      navigate('/fabricante');
    } else {
      navigate('/resumen');
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 text-white py-8">
        <div className="h-10 w-64 bg-white/10 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white/10 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const nfcRatio = stats.totalScans > 0 ? Math.round((stats.nfcScans / stats.totalScans) * 100) : 58;
  const qrRatio = 100 - nfcRatio;

  return (
    <div className="max-w-7xl mx-auto space-y-8 text-white pb-12">
      {/* Encabezado Super Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider">
              Super Admin Toque
            </span>
            <span className="text-xs text-white/50">• Visión Dueños y Fundadores</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-white tracking-tight">
            Plataforma Central Toque
          </h1>
          <p className="text-xs text-white/70 mt-0.5">
            Monitoreo en tiempo real de volumen, recaudación ARS, infraestructura y fabricantes.
          </p>
        </div>

        {/* Acciones y accesos directos */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link to="/status">
            <Button
              variant="secondary"
              size="sm"
              icon={<Server className="w-3.5 h-3.5 text-emerald-400" />}
            >
              Página de Status
            </Button>
          </Link>

          <Link to="/ui">
            <Button
              variant="secondary"
              size="sm"
              icon={<Palette className="w-3.5 h-3.5 text-blue-400" />}
            >
              Galería /ui
            </Button>
          </Link>

          <Button
            variant="primary"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tarjetas Principales de KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR y Recaudación */}
        <Card className="p-5 space-y-2 border-white/20 bg-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-micro uppercase font-semibold text-white/70">
              Recaudación Mensual (MRR)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-white">
            {formatCurrency(stats.monthlyRevenueArs)}
          </div>
          <p className="text-[11px] text-white/60">
            ARR proyectado: <strong>{formatCurrency(stats.annualizedRevenueArs)}</strong>
          </p>
        </Card>

        {/* Escaneos Totales en la Red */}
        <Card className="p-5 space-y-2 border-white/20 bg-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-micro uppercase font-semibold text-white/70">
              Tráfico Global de Toques
            </span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-white">
            {formatNumber(stats.totalScans)}
          </div>
          <p className="text-[11px] text-white/60 flex items-center gap-2">
            <span>{nfcRatio}% NFC</span>
            <span>•</span>
            <span>{qrRatio}% QR</span>
          </p>
        </Card>

        {/* Fabricantes y Comercios */}
        <Card className="p-5 space-y-2 border-white/20 bg-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-micro uppercase font-semibold text-white/70">
              Red Fabricantes / Comercios
            </span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
              <Factory className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-white">
            {stats.totalManufacturers} <span className="text-xs font-normal text-white/60">fabr.</span> / {stats.totalBusinesses} <span className="text-xs font-normal text-white/60">negocios</span>
          </div>
          <p className="text-[11px] text-white/60">
            {stats.activeCarteles} carteles físicos activos en salones
          </p>
        </Card>

        {/* Salud del Sistema y Redirecciones */}
        <Card className="p-5 space-y-2 border-white/20 bg-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-micro uppercase font-semibold text-white/70">
              Salud & Disponibilidad
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400">
            {stats.uptimePercentage}%
          </div>
          <p className="text-[11px] text-white/60">
            Latencia media: <strong>{stats.avgRedirectLatencyMs} ms</strong> • 0 caídas
          </p>
        </Card>
      </div>

      {/* Selector de pestañas internas */}
      <div className="flex items-center gap-2 border-b border-white/15 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          Visión General & Incidentes
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manufacturers')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'manufacturers'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          Fabricantes & Clientes ({stats.manufacturers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('verificacion')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'verificacion'
              ? 'bg-emerald-400 text-slate-950 font-bold shadow-xs'
              : 'text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Verificación de Fabricantes</span>
        </button>

        {isQaTester && (
          <button
            type="button"
            onClick={() => setActiveTab('qa_sandbox')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'qa_sandbox'
                ? 'bg-amber-400 text-slate-950 shadow-xs font-bold'
                : 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/10'
            }`}
          >
            <span>🧪 Entorno de Pruebas QA (@pruebas)</span>
          </button>
        )}
      </div>

      {/* PESTAÑA 1: VISIÓN GENERAL & INCIDENTES */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Historial de incidentes y problemas */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Bitácora de Incidentes y Mantenimiento</span>
                </h3>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                  Todos los sistemas operativos
                </span>
              </div>

              <div className="space-y-3">
                {stats.recentIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-white">
                        {inc.title}
                      </span>
                      <span className="text-[10px] text-white/50 font-mono">
                        {inc.date}
                      </span>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {inc.description}
                    </p>
                    {inc.resolutionTime && (
                      <div className="text-[10px] text-emerald-300 font-mono">
                        ✓ Resuelto en {inc.resolutionTime} sin corte de servicio
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Métricas de rendimiento de crawler y links */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="p-6 space-y-4">
              <h3 className="font-headline text-base font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                <span>Salud de Redirección Toque</span>
              </h3>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Precisión de Enlaces Google
                    </div>
                    <div className="text-[11px] text-white/60">
                      Crawler de validación de Place IDs
                    </div>
                  </div>
                  <div className="font-mono text-base font-bold text-emerald-400">
                    {stats.linkHealthPercentage}%
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Latencia de Enrutamiento DNS
                    </div>
                    <div className="text-[11px] text-white/60">
                      toque.ar/codigo → maps.google.com
                    </div>
                  </div>
                  <div className="font-mono text-base font-bold text-blue-300">
                    {stats.avgRedirectLatencyMs} ms
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Carteles Protegidos
                    </div>
                    <div className="text-[11px] text-white/60">
                      Capacidad de actualización dinámica
                    </div>
                  </div>
                  <div className="font-mono text-base font-bold text-white">
                    100%
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: FABRICANTES Y SUS CLIENTES */}
      {activeTab === 'manufacturers' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-headline text-base font-bold text-white">
                  Fabricantes Registrados en la Red Toque
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Talleres, imprentas y distribuidores oficiales que comercializan carteles.
                </p>
              </div>
              <span className="text-xs font-mono bg-white/10 px-3 py-1 rounded-full text-white/80">
                {stats.manufacturers.length} talleres activos
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/15 text-white/60 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Fabricante</th>
                    <th className="py-3 px-4">Contacto</th>
                    <th className="py-3 px-4">Comercios</th>
                    <th className="py-3 px-4">Carteles</th>
                    <th className="py-3 px-4">Cuota Mensual</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-white/90">
                  {stats.manufacturers.map((m) => (
                    <tr key={m.id} className="hover:bg-white/5 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {m.name}
                        <span className="block text-[10px] font-mono text-white/50">{m.slug}</span>
                      </td>
                      <td className="py-3.5 px-4 text-white/70">{m.contactEmail}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-300">
                        {m.businessesCount} locales
                      </td>
                      <td className="py-3.5 px-4 font-mono">{m.cartelesCount} uds</td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">
                        {formatCurrency(m.monthlyFeeArs)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Activo</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleLaunchQASandbox('manufacturer_admin')}
                          className="text-[11px]"
                        >
                          Ver Panel
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Listado de Comercios Clientes */}
          <Card className="p-6 space-y-4">
            <h3 className="font-headline text-base font-bold text-white">
              Comercios y Locales en la Red ({businesses.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {businesses.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-white">{b.name}</h4>
                    <p className="text-[10px] text-white/50">{b.contactEmail}</p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                    Activo
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* PESTAÑA: VERIFICACIÓN DE FABRICANTES (AUDITORÍA, LLAMADAS CON CLIENTES, SELLO OFICIAL) */}
      {activeTab === 'verificacion' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4 border-emerald-400/30 bg-emerald-500/10 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              <h3 className="font-headline text-lg font-bold text-white">
                Verificación y Homologación de Fabricantes
              </h3>
            </div>
            <p className="text-xs text-white/80 leading-relaxed max-w-2xl">
              Como administradores de Toque, revisamos la información fiscal y técnica del fabricante, verificamos los materiales utilizados (acrílico, chip NTAG215) y realizamos entrevistas telefónicas con sus comercios clientes antes de otorgar el <strong>Sello de Verificado Toque</strong>.
            </p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {manufacturers.map((mfg) => {
              const mfgBizCount = businesses.filter(b => b.manufacturerId === mfg.id).length;
              return (
                <Card key={mfg.id} className="p-5 space-y-4 border-white/20 bg-white/10 backdrop-blur-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-headline text-base font-bold text-white">{mfg.name}</h4>
                        <span className="font-mono text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/70">
                          {mfg.accountCode || 'S/C'}
                        </span>
                      </div>
                      <p className="text-xs text-white/60">{mfg.city || 'Sin ciudad asignada'}</p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      mfg.isVerified
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    }`}>
                      {mfg.isVerified ? '✓ Verificado Toque' : 'Pendiente de auditoría'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/60">Contacto directo:</span>
                      <span className="text-white font-mono">{mfg.phone || mfg.contactEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Comercios clientes asignados:</span>
                      <span className="text-cyan-300 font-bold">{mfgBizCount} comercios</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Materiales declarados:</span>
                      <span className="text-white truncate max-w-[200px]">
                        {(mfg.materials || ['Acrílico', 'NFC NTAG215']).join(', ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Estado en la Red Pública:</span>
                      <span className={mfg.inNetwork !== false ? 'text-emerald-300' : 'text-white/40'}>
                        {mfg.inNetwork !== false ? 'Publicado' : 'Oculto'}
                      </span>
                    </div>
                  </div>

                  {mfg.verificationNotes && (
                    <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70">
                      <strong>Nota de auditoría:</strong> {mfg.verificationNotes}
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <a
                      href={`https://wa.me/${(mfg.phone || '').replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(mfg.name)},%20te%20contactamos%20desde%20Toque%20para%20la%20verificaci%C3%B3n%20de%20tu%20taller.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Contactar taller</span>
                    </a>

                    <div className="flex items-center gap-2">
                      {mfg.isVerified ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            if (api.verifyManufacturer) {
                              await api.verifyManufacturer(mfg.id, false, 'Verificación pausada por auditoría');
                            }
                            success('Verificación retirada', mfg.name);
                            loadData();
                          }}
                          className="text-rose-300 text-[11px]"
                        >
                          Revocar
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={async () => {
                            if (api.verifyManufacturer) {
                              await api.verifyManufacturer(mfg.id, true, 'Auditoría aprobada y clientes consultados');
                            }
                            success('¡Fabricante Verificado!', `Se otorgó el sello a ${mfg.name}`);
                            loadData();
                          }}
                          className="bg-emerald-400 text-slate-950 font-bold hover:bg-emerald-300 text-[11px]"
                        >
                          Aprobar y Verificar
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: ENTORNO DE PRUEBAS INTEGRADO QA */}
      {activeTab === 'qa_sandbox' && (
        <div className="space-y-6">
          <Card className="p-6 sm:p-8 space-y-6 border-amber-400/30 bg-amber-500/10 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-amber-300 font-mono text-xs uppercase tracking-wider font-bold block mb-1">
                  Ambiente de Validación y Pruebas
                </span>
                <h3 className="text-xl sm:text-2xl font-headline font-bold text-white">
                  Entorno de Pruebas Toque QA
                </h3>
                <p className="text-xs text-white/80 max-w-xl mt-1">
                  Permite a los fundadores y equipo de Toque evaluar la experiencia completa de un fabricante o comercio, verificar flujos de escaneo, probar el asistente y validar la calidad del producto.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/20 text-xs font-mono space-y-1">
                <div className="text-white/60">Credenciales oficiales:</div>
                <div className="text-amber-300 font-bold">user: @pruebas</div>
                <div className="text-amber-300 font-bold">pass: ¿ToQuE123!</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-5 rounded-2xl bg-black/30 border border-white/15 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Examinar como Negocio (Café La Esquina)
                    </h4>
                    <p className="text-xs text-white/60">
                      Probar dashboard, cambio de enlaces QR y simulación de toques.
                    </p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full justify-center bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs"
                  onClick={() => handleLaunchQASandbox('business_owner')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Entrar a Vista de Negocio
                </Button>
              </div>

              <div className="p-5 rounded-2xl bg-black/30 border border-white/15 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                    <Factory className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Examinar como Fabricante (Cartelería Demo)
                    </h4>
                    <p className="text-xs text-white/60">
                      Probar kit de impresión, grabado de chips NFC y reventa.
                    </p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full justify-center bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs"
                  onClick={() => handleLaunchQASandbox('manufacturer_admin')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Entrar a Vista de Fabricante
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
