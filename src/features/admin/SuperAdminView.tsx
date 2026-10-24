import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import {
  SuperAdminSummary,
  SuperAdminBusinessDetail,
  PlatformUserCategory,
  WaitlistEntry,
} from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatARS, formatDateTimeAR } from '../../lib/format';
import {
  ShieldCheck,
  Store,
  QrCode,
  TrendingUp,
  Award,
  Wallet,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Mail,
  Users,
  Eye,
  X,
  ShoppingBag,
  Gift,
  CheckCircle2,
  Search,
} from 'lucide-react';

type AdminTab = 'overview' | 'users' | 'carteles' | 'waitlist';

export const SuperAdminView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [summary, setSummary] = useState<SuperAdminSummary | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [walletStatus, setWalletStatus] = useState<{
    configured: boolean;
    emailConfigured?: boolean;
    provider: string;
    passesIssuedCount?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Filtro del Directorio de Usuarios
  const [userCategoryFilter, setUserCategoryFilter] = useState<'all' | PlatformUserCategory>('all');
  const [userSearch, setUserSearch] = useState('');

  // Modal de Perfil Detallado de Comercio (sin datos sensibles)
  const [selectedBizDetail, setSelectedBizDetail] = useState<SuperAdminBusinessDetail | null>(null);
  const [loadingBizDetail, setLoadingBizDetail] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sum, wStatus, wl] = await Promise.all([
        api.getSuperAdminSummary(),
        api.getWalletStatus(),
        api.listWaitlist(),
      ]);
      setSummary(sum);
      setWalletStatus(wStatus);
      setWaitlist(wl);
    } catch (err: any) {
      showToast(err?.message || 'Error al cargar panel Super Admin', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenBusinessDetail = async (businessId: string) => {
    try {
      setLoadingBizDetail(true);
      const detail = await api.getSuperAdminBusinessDetail(businessId);
      setSelectedBizDetail(detail);
    } catch (err: any) {
      showToast(err?.message || 'No se pudo cargar el detalle del comercio', 'error');
    } finally {
      setLoadingBizDetail(false);
    }
  };

  const allUsers = summary?.allUsers || [];
  const filteredUsers = allUsers.filter((u) => {
    if (userCategoryFilter !== 'all' && u.category !== userCategoryFilter) return false;
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.emailOrContact.toLowerCase().includes(q) ||
      (u.businessName || '').toLowerCase().includes(q) ||
      u.roleLabel.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#f1f1ee]">
      {/* Top Header */}
      <header className="h-16 px-4 sm:px-8 border-b border-[#242428] bg-[#141417] flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#bec8ff] text-[#0c0c0c] flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-[#f1f1ee]">Toque Super Admin</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2fb36a]/20 text-[#2fb36a]">
                DATOS 100% REALES
              </span>
            </div>
            <p className="text-xs text-[#a1a1aa]">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1c1c21] hover:bg-[#25252b] text-xs font-semibold text-[#f1f1ee] border border-[#2c2c32] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
          <Link
            to="/panel/resumen"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#bec8ff] text-[#0c0c0c] text-xs font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Panel Comercio</span>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8">
        {loading || !summary ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Skeleton key={n} className="h-28 rounded-2xl bg-[#141417]" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-2xl bg-[#141417]" />
          </div>
        ) : (
          <>
            {/* Global Real Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="rounded-2xl bg-[#141417] border border-[#242428] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#a1a1aa]">
                  <span className="text-xs font-medium">Comercios Reales</span>
                  <Store className="w-4 h-4 text-[#bec8ff]" />
                </div>
                <p className="text-2xl font-extrabold text-[#f1f1ee]">
                  {summary.totalBusinesses}
                </p>
                <p className="text-[11px] text-[#a1a1aa]">Activos en plataforma</p>
              </div>

              <div className="rounded-2xl bg-[#141417] border border-[#242428] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#a1a1aa]">
                  <span className="text-xs font-medium">Wallets Generadas</span>
                  <Wallet className="w-4 h-4 text-[#2fb36a]" />
                </div>
                <p className="text-2xl font-extrabold text-[#2fb36a]">
                  {summary.walletPassesIssued}
                </p>
                <p className="text-[11px] text-[#a1a1aa]">
                  Apple / Google Wallet ({walletStatus?.configured ? 'API activa' : 'Servidor'})
                </p>
              </div>

              <div className="rounded-2xl bg-[#141417] border border-[#242428] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#a1a1aa]">
                  <span className="text-xs font-medium">Socios Club</span>
                  <Award className="w-4 h-4 text-[#bec8ff]" />
                </div>
                <p className="text-2xl font-extrabold text-[#f1f1ee]">
                  {summary.totalClubMembers}
                </p>
                <p className="text-[11px] text-[#a1a1aa]">Tarjetas de sellos activas</p>
              </div>

              <div className="rounded-2xl bg-[#141417] border border-[#242428] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#a1a1aa]">
                  <span className="text-xs font-medium">Usuarios Totales</span>
                  <Users className="w-4 h-4 text-[#bec8ff]" />
                </div>
                <p className="text-2xl font-extrabold text-[#f1f1ee]">{allUsers.length}</p>
                <p className="text-[11px] text-[#a1a1aa]">Comercios + Socios + Bóveda</p>
              </div>

              <div className="rounded-2xl bg-[#141417] border border-[#242428] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#a1a1aa]">
                  <span className="text-xs font-medium">Carteles Activos</span>
                  <QrCode className="w-4 h-4 text-[#34d399]" />
                </div>
                <p className="text-2xl font-extrabold text-[#f1f1ee]">
                  {summary.activeCarteles} / {summary.totalCarteles}
                </p>
                <p className="text-[11px] text-[#a1a1aa]">
                  {summary.totalScansCount} escaneos reales
                </p>
              </div>

              <div className="rounded-2xl bg-[#141417] border border-[#242428] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#a1a1aa]">
                  <span className="text-xs font-medium">Volumen Cobros</span>
                  <TrendingUp className="w-4 h-4 text-[#34d399]" />
                </div>
                <p className="text-2xl font-extrabold text-[#f1f1ee]">
                  {formatARS(summary.totalSalesAmount)}
                </p>
                <p className="text-[11px] text-[#a1a1aa]">
                  {summary.totalSalesCount} cobros emitidos
                </p>
              </div>
            </div>

            {/* Navegación de Pestañas de Super Admin */}
            <div className="flex items-center gap-2 border-b border-[#242428] pb-3 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-[#bec8ff] text-[#0c0c0c]'
                    : 'bg-[#141417] text-[#a1a1aa] hover:text-[#f1f1ee]'
                }`}
              >
                Comercios y Perfiles Detallados ({summary.businesses.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-[#bec8ff] text-[#0c0c0c]'
                    : 'bg-[#141417] text-[#a1a1aa] hover:text-[#f1f1ee]'
                }`}
              >
                Directorio de Usuarios ({allUsers.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('carteles')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'carteles'
                    ? 'bg-[#bec8ff] text-[#0c0c0c]'
                    : 'bg-[#141417] text-[#a1a1aa] hover:text-[#f1f1ee]'
                }`}
              >
                Carteles Físicos ({summary.carteles.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('waitlist')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'waitlist'
                    ? 'bg-[#bec8ff] text-[#0c0c0c]'
                    : 'bg-[#141417] text-[#a1a1aa] hover:text-[#f1f1ee]'
                }`}
              >
                Lista de Espera ({waitlist.length})
              </button>
            </div>

            {/* TAB 1: COMERCIOS REGISTRADOS (CON PERFIL DETALLADO AL TOCAR) */}
            {activeTab === 'overview' && (
              <div className="rounded-2xl bg-[#141417] border border-[#242428] overflow-hidden">
                <div className="p-6 border-b border-[#242428] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#f1f1ee]">
                      Comercios Registrados (Tocá un comercio para ver su perfil detallado)
                    </h2>
                    <p className="text-xs text-[#a1a1aa] mt-0.5">
                      Vista operativa con estadísticas reales de carteles, wallets generadas, socios y productos sin exponer información sensible.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#242428] bg-[#18181c] text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                        <th className="py-3.5 px-5">Comercio</th>
                        <th className="py-3.5 px-5">Titular</th>
                        <th className="py-3.5 px-5">Carteles / Locales</th>
                        <th className="py-3.5 px-5">Socios Club</th>
                        <th className="py-3.5 px-5">Wallets Generadas</th>
                        <th className="py-3.5 px-5">Productos</th>
                        <th className="py-3.5 px-5 text-right">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#202024] text-sm">
                      {summary.businesses.map((biz) => (
                        <tr
                          key={biz.id}
                          onClick={() => handleOpenBusinessDetail(biz.id)}
                          className="hover:bg-[#1a1a1f] cursor-pointer transition-colors"
                        >
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2.5">
                              <div
                                style={{ backgroundColor: biz.cardThemeColor || '#1e1b4b' }}
                                className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0"
                              >
                                {biz.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-[#f1f1ee]">{biz.name}</p>
                                <p className="text-xs text-[#bec8ff] font-mono">/u/{biz.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-xs text-[#a1a1aa]">{biz.ownerName}</td>
                          <td className="py-4 px-5 text-xs text-[#f1f1ee]">
                            {biz.cartelesCount} cartel(es) · {biz.localsCount} local(es)
                          </td>
                          <td className="py-4 px-5 font-bold text-[#bec8ff]">{biz.membersCount}</td>
                          <td className="py-4 px-5 font-bold text-[#2fb36a]">
                            {biz.walletPassesIssued}
                          </td>
                          <td className="py-4 px-5 text-xs text-[#f1f1ee]">
                            {biz.productsCount} cargados
                          </td>
                          <td className="py-4 px-5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBusinessDetail(biz.id);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c1c21] hover:bg-[#bec8ff] hover:text-[#0c0c0c] text-xs font-bold text-[#bec8ff] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver perfil</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: DIRECTORIO DE USUARIOS DE TODO TIPO */}
            {activeTab === 'users' && (
              <div className="rounded-2xl bg-[#141417] border border-[#242428] overflow-hidden space-y-4 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-[#f1f1ee]">
                      Directorio Unificado de Usuarios
                    </h2>
                    <p className="text-xs text-[#a1a1aa] mt-0.5">
                      Incluye usuarios de comercios (dueños, encargados, cajeros), socios del Club de Sellos, usuarios de Bóveda / Toquecitos y suscriptores.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Buscar por nombre, rol o comercio..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#18181c] border border-[#2c2c32] text-xs text-[#f1f1ee]"
                    />
                  </div>
                </div>

                {/* Filtros por tipo de usuario */}
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'all', label: `Todos (${allUsers.length})` },
                      {
                        id: 'merchant_team',
                        label: `Comercios y Equipo (${allUsers.filter((u) => u.category === 'merchant_team').length})`,
                      },
                      {
                        id: 'club_member',
                        label: `Socios Tarjeta de Sellos (${allUsers.filter((u) => u.category === 'club_member').length})`,
                      },
                      {
                        id: 'consumer_vault',
                        label: `Usuarios Toquecitos / Bóveda (${allUsers.filter((u) => u.category === 'consumer_vault').length})`,
                      },
                      {
                        id: 'waitlist',
                        label: `Lista de Espera (${allUsers.filter((u) => u.category === 'waitlist').length})`,
                      },
                    ] as Array<{ id: 'all' | PlatformUserCategory; label: string }>
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setUserCategoryFilter(f.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        userCategoryFilter === f.id
                          ? 'bg-[#bec8ff] text-[#0c0c0c] font-bold'
                          : 'bg-[#18181c] border border-[#28282e] text-[#a1a1aa] hover:text-[#f1f1ee]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#242428] bg-[#18181c] text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                        <th className="py-3 px-4">Categoría / Rol</th>
                        <th className="py-3 px-4">Nombre / Identificador</th>
                        <th className="py-3 px-4">Contacto (Protegido)</th>
                        <th className="py-3 px-4">Comercio Vinculado</th>
                        <th className="py-3 px-4">Estado / Actividad</th>
                        <th className="py-3 px-4">Alta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#202024] text-xs">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[#a1a1aa]">
                            No hay usuarios registrados en esta categoría todavía.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-[#1a1a1f]">
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  u.category === 'merchant_team'
                                    ? 'bg-[#bec8ff]/15 text-[#bec8ff]'
                                    : u.category === 'club_member'
                                    ? 'bg-[#2fb36a]/15 text-[#2fb36a]'
                                    : u.category === 'consumer_vault'
                                    ? 'bg-[#f59e0b]/15 text-[#f59e0b]'
                                    : 'bg-[#242428] text-[#a1a1aa]'
                                }`}
                              >
                                {u.roleLabel}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#f1f1ee]">
                              {u.displayName}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[#a1a1aa]">
                              {u.emailOrContact}
                            </td>
                            <td className="py-3.5 px-4 text-[#f1f1ee]">
                              {u.businessName || 'Plataforma Toque'}
                            </td>
                            <td className="py-3.5 px-4 text-[#a1a1aa]">
                              {u.statusLabel}
                              {u.walletPassIssued && (
                                <span className="ml-2 px-2 py-0.5 rounded bg-[#2fb36a]/20 text-[#2fb36a] text-[10px] font-bold">
                                  Wallet activa
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-[#a1a1aa]">
                              {formatDateTimeAR(u.createdAt)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: CARTELES FÍSICOS */}
            {activeTab === 'carteles' && (
              <div className="rounded-2xl bg-[#141417] border border-[#242428] overflow-hidden">
                <div className="p-6 border-b border-[#242428]">
                  <h2 className="text-base font-bold text-[#f1f1ee]">
                    Carteles Físicos NFC + QR en la Red ({summary.carteles.length})
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#242428] bg-[#18181c] text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                        <th className="py-3.5 px-5">Código</th>
                        <th className="py-3.5 px-5">Nombre</th>
                        <th className="py-3.5 px-5">Estado</th>
                        <th className="py-3.5 px-5">Modo</th>
                        <th className="py-3.5 px-5">Escaneos Reales</th>
                        <th className="py-3.5 px-5 text-right">Vista Pública</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#202024] text-sm">
                      {summary.carteles.map((c) => (
                        <tr key={c.id} className="hover:bg-[#1a1a1f]">
                          <td className="py-4 px-5 font-mono font-bold text-[#bec8ff]">
                            {c.code}
                          </td>
                          <td className="py-4 px-5 font-medium text-[#f1f1ee]">{c.name}</td>
                          <td className="py-4 px-5">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2fb36a]/15 text-[#34d399]">
                              {c.status}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-xs text-[#a1a1aa] uppercase">
                            {c.mode}
                          </td>
                          <td className="py-4 px-5 font-semibold text-[#f1f1ee]">
                            {c.scansCount || 0}
                          </td>
                          <td className="py-4 px-5 text-right">
                            <Link
                              to={`/h/${c.code}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#bec8ff] hover:underline"
                            >
                              <span>Abrir Hub</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: LISTA DE ESPERA */}
            {activeTab === 'waitlist' && (
              <div className="rounded-2xl bg-[#141417] border border-[#242428] overflow-hidden">
                <div className="p-6 border-b border-[#242428] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-5 h-5 text-[#2fb36a]" />
                    <h2 className="text-base font-bold text-[#f1f1ee]">
                      Lista de Espera ({waitlist.length})
                    </h2>
                  </div>
                </div>

                {waitlist.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#a1a1aa]">
                    Todavía no hay registros en la lista de espera.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#242428] bg-[#18181c] text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                          <th className="py-3.5 px-5">Correo</th>
                          <th className="py-3.5 px-5">Producto</th>
                          <th className="py-3.5 px-5">Consentimiento</th>
                          <th className="py-3.5 px-5">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#202024] text-sm">
                        {waitlist.map((entry) => (
                          <tr key={entry.id} className="hover:bg-[#1a1a1f]">
                            <td className="py-4 px-5 font-medium text-[#f1f1ee]">{entry.email}</td>
                            <td className="py-4 px-5 text-xs text-[#bec8ff] font-bold uppercase">
                              {entry.product}
                            </td>
                            <td className="py-4 px-5 text-xs text-[#34d399]">
                              {entry.consent ? 'Autorizado' : 'No'}
                            </td>
                            <td className="py-4 px-5 text-xs text-[#a1a1aa]">
                              {formatDateTimeAR(entry.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ================================================================= */}
      {/* MODAL DE PERFIL DETALLADO DEL COMERCIO (SIN DATOS SENSIBLES)      */}
      {/* ================================================================= */}
      {(selectedBizDetail || loadingBizDetail) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full rounded-3xl bg-[#141417] border border-[#2c2c32] p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {loadingBizDetail || !selectedBizDetail ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-56 rounded-xl bg-[#1c1c21]" />
                <Skeleton className="h-44 w-full rounded-2xl bg-[#1c1c21]" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#242428]">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        backgroundColor:
                          selectedBizDetail.business.cardThemeColor || '#1e1b4b',
                      }}
                      className="w-12 h-12 rounded-2xl border border-white/20 flex items-center justify-center font-extrabold text-xl text-white"
                    >
                      {selectedBizDetail.business.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-[#f1f1ee]">
                          {selectedBizDetail.business.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#2fb36a]/15 text-[#2fb36a] text-[10px] font-bold">
                          Perfil Verificado
                        </span>
                      </div>
                      <p className="text-xs text-[#a1a1aa]">
                        Slug:{' '}
                        <code className="text-[#bec8ff]">
                          /u/{selectedBizDetail.business.id}
                        </code>{' '}
                        · Responsable: {selectedBizDetail.business.ownerName}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedBizDetail(null)}
                    className="p-2 rounded-xl bg-[#1c1c21] text-[#a1a1aa] hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Indicadores Operativos del Comercio */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-[#18181c] border border-[#26262b]">
                    <span className="text-[11px] text-[#a1a1aa]">Socios en el Club</span>
                    <p className="text-2xl font-extrabold text-[#f1f1ee] mt-1">
                      {selectedBizDetail.membersCount}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#18181c] border border-[#26262b]">
                    <span className="text-[11px] text-[#a1a1aa]">Wallets Emitidas</span>
                    <p className="text-2xl font-extrabold text-[#2fb36a] mt-1">
                      {selectedBizDetail.walletPassesIssued}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#18181c] border border-[#26262b]">
                    <span className="text-[11px] text-[#a1a1aa]">Sellos / Premios</span>
                    <p className="text-2xl font-extrabold text-[#bec8ff] mt-1">
                      {selectedBizDetail.stampsAddedCount} / {selectedBizDetail.rewardsRedeemedCount}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#18181c] border border-[#26262b]">
                    <span className="text-[11px] text-[#a1a1aa]">Productos Cargados</span>
                    <p className="text-2xl font-extrabold text-[#f1f1ee] mt-1">
                      {selectedBizDetail.productsCount}
                    </p>
                  </div>
                </div>

                {/* Configuración de Tarjeta de Sellos del Comercio */}
                <div className="rounded-2xl bg-[#18181c] border border-[#26262b] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#bec8ff] flex items-center gap-1.5">
                      <Gift className="w-4 h-4" />
                      Configuración de Tarjeta de Sellos Digital
                    </h4>
                    <Link
                      to={`/u/${selectedBizDetail.business.id}`}
                      className="text-xs font-semibold text-[#2fb36a] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Abrir vista pública</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[#a1a1aa] block">Premio (Meta {selectedBizDetail.clubConfig.targetStamps || 10} sellos):</span>
                      <span className="font-bold text-[#f1f1ee]">
                        {selectedBizDetail.clubConfig.loyaltyReward ||
                          selectedBizDetail.clubConfig.rewardText}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#a1a1aa] block">Regla:</span>
                      <span className="font-bold text-[#f1f1ee]">
                        {selectedBizDetail.clubConfig.howToEarn || '1 sello por visita o compra'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#a1a1aa] block">Color de tarjeta:</span>
                      <span className="font-mono font-bold text-[#f1f1ee]">
                        {selectedBizDetail.clubConfig.cardThemeColor ||
                          selectedBizDetail.clubConfig.brandColor}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Locales y Carteles Vinculados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-[#18181c] border border-[#26262b] p-4 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa]">
                      Locales ({selectedBizDetail.locals.length})
                    </h4>
                    {selectedBizDetail.locals.map((loc) => (
                      <div
                        key={loc.id}
                        className="p-3 rounded-xl bg-[#141417] border border-[#242428] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#f1f1ee]">{loc.name}</p>
                          <p className="text-[#a1a1aa]">{loc.address}</p>
                        </div>
                        <span className="font-mono font-bold text-[#bec8ff]">{loc.code}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-[#18181c] border border-[#26262b] p-4 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa]">
                      Equipo Operativo ({selectedBizDetail.team.length})
                    </h4>
                    {selectedBizDetail.team.map((tm) => (
                      <div
                        key={tm.id}
                        className="p-3 rounded-xl bg-[#141417] border border-[#242428] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#f1f1ee]">{tm.name}</p>
                          <p className="text-[#a1a1aa] uppercase text-[10px]">{tm.role}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[#2fb36a] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {tm.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Catálogo de Productos del Comercio */}
                {selectedBizDetail.products.length > 0 && (
                  <div className="rounded-2xl bg-[#18181c] border border-[#26262b] p-4 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-[#bec8ff]" />
                      Catálogo de Productos ({selectedBizDetail.productsCount})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedBizDetail.products.slice(0, 6).map((prod) => (
                        <div
                          key={prod.id}
                          className="p-2.5 rounded-xl bg-[#141417] border border-[#242428] flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-[#f1f1ee] truncate">{prod.title}</span>
                          {prod.price !== undefined && (
                            <span className="font-bold text-[#bec8ff] shrink-0">
                              {formatARS(prod.price)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
