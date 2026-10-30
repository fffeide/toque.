import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../../api';
import {
  SuperAdminSummary,
  SuperAdminBusinessDetail,
  PlatformUserCategory,
  WaitlistEntry,
  ToqueAdminMember,
} from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { BrandLogo } from '../../components/ui/Avatar';
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
  UserPlus,
  Trash2,
  Factory,
} from 'lucide-react';

type AdminTab = 'overview' | 'users' | 'carteles' | 'waitlist' | 'toque_team';

const MASTER_ADMIN_EMAIL = 'fedeeeloiss@gmail.com';

export const SuperAdminView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [summary, setSummary] = useState<SuperAdminSummary | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [toqueAdmins, setToqueAdmins] = useState<ToqueAdminMember[]>([]);
  const [walletStatus, setWalletStatus] = useState<{
    configured: boolean;
    emailConfigured?: boolean;
    provider: string;
    passesIssuedCount?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Formulario de alta de miembro del Equipo Toque
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'soporte' | 'operaciones'>('soporte');
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Filtro del Directorio de Usuarios
  const [userCategoryFilter, setUserCategoryFilter] = useState<'all' | PlatformUserCategory>('all');
  const [userSearch, setUserSearch] = useState('');

  // Modal de Perfil Detallado de Comercio
  const [selectedBizDetail, setSelectedBizDetail] = useState<SuperAdminBusinessDetail | null>(null);
  const [loadingBizDetail, setLoadingBizDetail] = useState(false);

  const normalizedEmail = (user?.email || '').trim().toLowerCase();
  const isAuthorizedSuperAdmin =
    normalizedEmail === MASTER_ADMIN_EMAIL ||
    user?.isSuperAdmin === true ||
    user?.role === 'superadmin';

  const loadData = async () => {
    try {
      setLoading(true);
      const [sum, wStatus, wl, admins] = await Promise.all([
        api.getSuperAdminSummary(),
        api.getWalletStatus(),
        api.listWaitlist(),
        api.listToqueAdmins(),
      ]);
      setSummary(sum);
      setWalletStatus(wStatus);
      setWaitlist(wl);
      setToqueAdmins(admins);
    } catch (err: any) {
      showToast(err?.message || 'Error al cargar panel Super Admin', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorizedSuperAdmin) {
      loadData();
    }
  }, [isAuthorizedSuperAdmin]);

  // Defensa en profundidad: bloquear acceso a cualquier cuenta no autorizada
  if (!user || !isAuthorizedSuperAdmin) {
    return <Navigate to="/panel/resumen" replace />;
  }

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

  const handleAddToqueAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newAdminEmail.trim().toLowerCase();
    if (!newAdminName.trim() || !cleanEmail.includes('@')) {
      showToast('Ingresá nombre y correo válido del integrante de Toque', 'error');
      return;
    }

    try {
      setAddingAdmin(true);
      const created = await api.addToqueAdmin({
        name: newAdminName.trim(),
        email: cleanEmail,
        role: newAdminRole,
      });
      setToqueAdmins((prev) => {
        const filtered = prev.filter((a) => a.email.toLowerCase() !== created.email.toLowerCase());
        return [...filtered, created];
      });
      setNewAdminName('');
      setNewAdminEmail('');
      showToast(`${created.name} habilitado en Equipo Toque`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo agregar al integrante', 'error');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveToqueAdmin = async (member: ToqueAdminMember) => {
    if (member.email.toLowerCase() === MASTER_ADMIN_EMAIL) {
      showToast('La cuenta maestra de fundador no puede revocarse', 'error');
      return;
    }
    try {
      await api.removeToqueAdmin(member.id);
      setToqueAdmins((prev) => prev.filter((a) => a.id !== member.id));
      showToast(`Acceso revocado para ${member.email}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo revocar el acceso', 'error');
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
    <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F0]">
      {/* Top Header */}
      <header className="h-16 px-4 sm:px-8 border-b border-[#282830] bg-[#141418] flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <BrandLogo variant="isotipo" size="sm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-[#F4F4F0]">Toque Super Admin</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D95B26]/20 text-[#D95B26] border border-[#D95B26]/30">
                ACCESO RESTRINGIDO RLS
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA]">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] text-xs font-semibold text-[#F4F4F0] border border-[#282830] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
          <Link
            to="/fabricante"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#141418] hover:bg-[#202026] text-[#F4F4F0] border border-[#282830] text-xs font-semibold"
          >
            <Factory className="w-3.5 h-3.5 text-[#D95B26]" />
            <span>Fabricante</span>
          </Link>
          <Link
            to="/panel/resumen"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#BEC8FF] text-[#0C0C0E] text-xs font-bold"
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
                <Skeleton key={n} className="h-28 rounded-2xl bg-[#141418]" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-2xl bg-[#141418]" />
          </div>
        ) : (
          <>
            {/* Global Real Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#A1A1AA]">
                  <span className="text-xs font-medium">Comercios Reales</span>
                  <Store className="w-4 h-4 text-[#D95B26]" />
                </div>
                <p className="text-2xl font-extrabold text-[#F4F4F0]">
                  {summary.totalBusinesses}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">Activos en plataforma</p>
              </div>

              <div className="rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#A1A1AA]">
                  <span className="text-xs font-medium">Wallets Generadas</span>
                  <Wallet className="w-4 h-4 text-[#2FB36A]" />
                </div>
                <p className="text-2xl font-extrabold text-[#2FB36A]">
                  {summary.walletPassesIssued}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">
                  Apple / Google Wallet ({walletStatus?.configured ? 'API activa' : 'Servidor'})
                </p>
              </div>

              <div className="rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#A1A1AA]">
                  <span className="text-xs font-medium">Socios Club</span>
                  <Award className="w-4 h-4 text-[#BEC8FF]" />
                </div>
                <p className="text-2xl font-extrabold text-[#F4F4F0]">
                  {summary.totalClubMembers}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">Tarjetas de sellos activas</p>
              </div>

              <div className="rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#A1A1AA]">
                  <span className="text-xs font-medium">Usuarios Totales</span>
                  <Users className="w-4 h-4 text-[#BEC8FF]" />
                </div>
                <p className="text-2xl font-extrabold text-[#F4F4F0]">{allUsers.length}</p>
                <p className="text-[11px] text-[#A1A1AA]">Comercios + Socios + Staff</p>
              </div>

              <div className="rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#A1A1AA]">
                  <span className="text-xs font-medium">Carteles Activos</span>
                  <QrCode className="w-4 h-4 text-[#2FB36A]" />
                </div>
                <p className="text-2xl font-extrabold text-[#F4F4F0]">
                  {summary.activeCarteles} / {summary.totalCarteles}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">
                  {summary.totalScansCount} escaneos reales
                </p>
              </div>

              <div className="rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-2">
                <div className="flex items-center justify-between text-[#A1A1AA]">
                  <span className="text-xs font-medium">Volumen Cobros</span>
                  <TrendingUp className="w-4 h-4 text-[#2FB36A]" />
                </div>
                <p className="text-2xl font-extrabold text-[#F4F4F0]">
                  {formatARS(summary.totalSalesAmount)}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">
                  {summary.totalSalesCount} cobros emitidos
                </p>
              </div>
            </div>

            {/* Navegación de Pestañas de Super Admin */}
            <div className="flex items-center gap-2 border-b border-[#282830] pb-3 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'overview'
                    ? 'bg-[#D95B26] text-white'
                    : 'bg-[#141418] text-[#A1A1AA] hover:text-[#F4F4F0]'
                }`}
              >
                Comercios ({summary.businesses.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('toque_team')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'toque_team'
                    ? 'bg-[#D95B26] text-white'
                    : 'bg-[#141418] text-[#A1A1AA] hover:text-[#F4F4F0]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Equipo Toque ({toqueAdmins.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'users'
                    ? 'bg-[#D95B26] text-white'
                    : 'bg-[#141418] text-[#A1A1AA] hover:text-[#F4F4F0]'
                }`}
              >
                Directorio de Usuarios ({allUsers.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('carteles')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'carteles'
                    ? 'bg-[#D95B26] text-white'
                    : 'bg-[#141418] text-[#A1A1AA] hover:text-[#F4F4F0]'
                }`}
              >
                Carteles Físicos ({summary.carteles.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('waitlist')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'waitlist'
                    ? 'bg-[#D95B26] text-white'
                    : 'bg-[#141418] text-[#A1A1AA] hover:text-[#F4F4F0]'
                }`}
              >
                Lista de Espera ({waitlist.length})
              </button>
            </div>

            {/* TAB: EQUIPO TOQUE (STAFF INTERNO CON ACCESO A /ADMIN) */}
            {activeTab === 'toque_team' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 rounded-2xl bg-[#141418] border border-[#282830] p-6 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#D95B26]/15 text-[#D95B26] flex items-center justify-center">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#F4F4F0]">
                        Habilitar integrante en Equipo Toque
                      </h2>
                      <p className="text-xs text-[#A1A1AA]">
                        Autoriza correos en la colección <code className="text-[#BEC8FF]">toque_admins</code>.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleAddToqueAdmin} className="space-y-3.5 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-[#F4F4F0] mb-1">
                        Nombre y apellido
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Valentina Ruiz"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs text-[#F4F4F0] focus:outline-none focus:border-[#D95B26]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#F4F4F0] mb-1">
                        Correo electrónico autorizado
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="integrante@toque.ar"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs text-[#F4F4F0] focus:outline-none focus:border-[#D95B26]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#F4F4F0] mb-1">
                        Rol interno en Toque
                      </label>
                      <select
                        value={newAdminRole}
                        onChange={(e) =>
                          setNewAdminRole(e.target.value as 'admin' | 'soporte' | 'operaciones')
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs text-[#F4F4F0] focus:outline-none focus:border-[#D95B26]"
                      >
                        <option value="admin">Admin Global</option>
                        <option value="soporte">Soporte a Comercios</option>
                        <option value="operaciones">Operaciones y Carteles</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={addingAdmin}
                      className="w-full py-3 rounded-xl bg-[#D95B26] hover:bg-[#c04d1d] text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {addingAdmin ? 'Habilitando acceso...' : 'Dar de alta en Equipo Toque'}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-7 rounded-2xl bg-[#141418] border border-[#282830] overflow-hidden">
                  <div className="p-6 border-b border-[#282830]">
                    <h3 className="text-base font-bold text-[#F4F4F0]">
                      Cuentas autorizadas en Super Admin ({toqueAdmins.length})
                    </h3>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">
                      Únicamente <code className="text-[#D95B26]">{MASTER_ADMIN_EMAIL}</code> y los correos listados aquí tienen permiso de lectura global.
                    </p>
                  </div>

                  <div className="divide-y divide-[#282830]">
                    {toqueAdmins.map((member) => {
                      const isFounder = member.email.toLowerCase() === MASTER_ADMIN_EMAIL;
                      return (
                        <div
                          key={member.id}
                          className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-[#1C1C22]/50"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#F4F4F0]">
                                {member.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  isFounder
                                    ? 'bg-[#D95B26]/20 text-[#D95B26]'
                                    : 'bg-[#BEC8FF]/15 text-[#BEC8FF]'
                                }`}
                              >
                                {isFounder ? 'Fundador / Master' : member.role}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-[#A1A1AA] mt-0.5">
                              {member.email}
                            </p>
                          </div>

                          {!isFounder && (
                            <button
                              type="button"
                              onClick={() => handleRemoveToqueAdmin(member)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1C22] hover:bg-red-500/20 text-xs font-semibold text-[#A1A1AA] hover:text-red-400 border border-[#282830] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Revocar</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: COMERCIOS REGISTRADOS */}
            {activeTab === 'overview' && (
              <div className="rounded-2xl bg-[#141418] border border-[#282830] overflow-hidden">
                <div className="p-6 border-b border-[#282830] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#F4F4F0]">
                      Comercios Registrados (Tocá un comercio para ver su perfil detallado)
                    </h2>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">
                      Vista operativa con estadísticas reales de carteles, wallets generadas, socios y productos.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#282830] bg-[#1C1C22] text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA]">
                        <th className="py-3.5 px-5">Comercio</th>
                        <th className="py-3.5 px-5">Titular</th>
                        <th className="py-3.5 px-5">Carteles / Locales</th>
                        <th className="py-3.5 px-5">Socios Club</th>
                        <th className="py-3.5 px-5">Wallets Generadas</th>
                        <th className="py-3.5 px-5">Productos</th>
                        <th className="py-3.5 px-5 text-right">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#282830] text-sm">
                      {summary.businesses.map((biz) => (
                        <tr
                          key={biz.id}
                          onClick={() => handleOpenBusinessDetail(biz.id)}
                          className="hover:bg-[#1C1C22] cursor-pointer transition-colors"
                        >
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2.5">
                              <div
                                style={{ backgroundColor: biz.cardThemeColor || '#D95B26' }}
                                className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0"
                              >
                                {biz.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-[#F4F4F0]">{biz.name}</p>
                                <p className="text-xs text-[#BEC8FF] font-mono">/u/{biz.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-xs text-[#A1A1AA]">{biz.ownerName}</td>
                          <td className="py-4 px-5 text-xs text-[#F4F4F0]">
                            {biz.cartelesCount} cartel(es) · {biz.localsCount} local(es)
                          </td>
                          <td className="py-4 px-5 font-bold text-[#BEC8FF]">{biz.membersCount}</td>
                          <td className="py-4 px-5 font-bold text-[#2FB36A]">
                            {biz.walletPassesIssued}
                          </td>
                          <td className="py-4 px-5 text-xs text-[#F4F4F0]">
                            {biz.productsCount} cargados
                          </td>
                          <td className="py-4 px-5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBusinessDetail(biz.id);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1C22] hover:bg-[#BEC8FF] hover:text-[#0C0C0E] text-xs font-bold text-[#BEC8FF] transition-colors cursor-pointer"
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

            {/* TAB 2: DIRECTORIO DE USUARIOS */}
            {activeTab === 'users' && (
              <div className="rounded-2xl bg-[#141418] border border-[#282830] overflow-hidden space-y-4 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-[#F4F4F0]">
                      Directorio Unificado de Usuarios
                    </h2>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">
                      Incluye usuarios de comercios, socios del Club de Sellos y lista de espera.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Buscar por nombre, rol o comercio..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs text-[#F4F4F0]"
                    />
                  </div>
                </div>

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
                          ? 'bg-[#BEC8FF] text-[#0C0C0E] font-bold'
                          : 'bg-[#1C1C22] border border-[#282830] text-[#A1A1AA] hover:text-[#F4F4F0]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#282830] bg-[#1C1C22] text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA]">
                        <th className="py-3 px-4">Categoría / Rol</th>
                        <th className="py-3 px-4">Nombre / Identificador</th>
                        <th className="py-3 px-4">Contacto</th>
                        <th className="py-3 px-4">Comercio Vinculado</th>
                        <th className="py-3 px-4">Estado / Actividad</th>
                        <th className="py-3 px-4">Alta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#282830] text-xs">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[#A1A1AA]">
                            No hay usuarios registrados en esta categoría todavía.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-[#1C1C22]">
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  u.category === 'merchant_team'
                                    ? 'bg-[#BEC8FF]/15 text-[#BEC8FF]'
                                    : u.category === 'club_member'
                                    ? 'bg-[#2FB36A]/15 text-[#2FB36A]'
                                    : 'bg-[#282830] text-[#A1A1AA]'
                                }`}
                              >
                                {u.roleLabel}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#F4F4F0]">
                              {u.displayName}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[#A1A1AA]">
                              {u.emailOrContact}
                            </td>
                            <td className="py-3.5 px-4 text-[#F4F4F0]">
                              {u.businessName || 'Plataforma Toque'}
                            </td>
                            <td className="py-3.5 px-4 text-[#A1A1AA]">
                              {u.statusLabel}
                              {u.walletPassIssued && (
                                <span className="ml-2 px-2 py-0.5 rounded bg-[#2FB36A]/20 text-[#2FB36A] text-[10px] font-bold">
                                  Wallet activa
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-[#A1A1AA]">
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
              <div className="rounded-2xl bg-[#141418] border border-[#282830] overflow-hidden">
                <div className="p-6 border-b border-[#282830]">
                  <h2 className="text-base font-bold text-[#F4F4F0]">
                    Carteles Físicos NFC + QR en la Red ({summary.carteles.length})
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#282830] bg-[#1C1C22] text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA]">
                        <th className="py-3.5 px-5">Código</th>
                        <th className="py-3.5 px-5">Nombre</th>
                        <th className="py-3.5 px-5">Estado</th>
                        <th className="py-3.5 px-5">Modo</th>
                        <th className="py-3.5 px-5">Escaneos Reales</th>
                        <th className="py-3.5 px-5 text-right">Vista Pública</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#282830] text-sm">
                      {summary.carteles.map((c) => (
                        <tr key={c.id} className="hover:bg-[#1C1C22]">
                          <td className="py-4 px-5 font-mono font-bold text-[#BEC8FF]">
                            {c.code}
                          </td>
                          <td className="py-4 px-5 font-medium text-[#F4F4F0]">{c.name}</td>
                          <td className="py-4 px-5">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2FB36A]/15 text-[#2FB36A]">
                              {c.status}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-xs text-[#A1A1AA] uppercase">
                            {c.mode}
                          </td>
                          <td className="py-4 px-5 font-semibold text-[#F4F4F0]">
                            {c.scansCount || 0}
                          </td>
                          <td className="py-4 px-5 text-right">
                            <Link
                              to={`/h/${c.code}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#BEC8FF] hover:underline"
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
              <div className="rounded-2xl bg-[#141418] border border-[#282830] overflow-hidden">
                <div className="p-6 border-b border-[#282830] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-5 h-5 text-[#2FB36A]" />
                    <h2 className="text-base font-bold text-[#F4F4F0]">
                      Lista de Espera ({waitlist.length})
                    </h2>
                  </div>
                </div>

                {waitlist.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#A1A1AA]">
                    Todavía no hay registros en la lista de espera.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#282830] bg-[#1C1C22] text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA]">
                          <th className="py-3.5 px-5">Correo</th>
                          <th className="py-3.5 px-5">Producto</th>
                          <th className="py-3.5 px-5">Consentimiento</th>
                          <th className="py-3.5 px-5">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#282830] text-sm">
                        {waitlist.map((entry) => (
                          <tr key={entry.id} className="hover:bg-[#1C1C22]">
                            <td className="py-4 px-5 font-medium text-[#F4F4F0]">{entry.email}</td>
                            <td className="py-4 px-5 text-xs text-[#BEC8FF] font-bold uppercase">
                              {entry.product}
                            </td>
                            <td className="py-4 px-5 text-xs text-[#2FB36A]">
                              {entry.consent ? 'Autorizado' : 'No'}
                            </td>
                            <td className="py-4 px-5 text-xs text-[#A1A1AA]">
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

      {/* MODAL DE PERFIL DETALLADO DEL COMERCIO */}
      {(selectedBizDetail || loadingBizDetail) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full rounded-3xl bg-[#141418] border border-[#282830] p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {loadingBizDetail || !selectedBizDetail ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-56 rounded-xl bg-[#1C1C22]" />
                <Skeleton className="h-44 w-full rounded-2xl bg-[#1C1C22]" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#282830]">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        backgroundColor:
                          selectedBizDetail.business.cardThemeColor || '#D95B26',
                      }}
                      className="w-12 h-12 rounded-2xl border border-white/20 flex items-center justify-center font-extrabold text-xl text-white"
                    >
                      {selectedBizDetail.business.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-[#F4F4F0]">
                          {selectedBizDetail.business.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#2FB36A]/15 text-[#2FB36A] text-[10px] font-bold">
                          Perfil Verificado
                        </span>
                      </div>
                      <p className="text-xs text-[#A1A1AA]">
                        Slug:{' '}
                        <code className="text-[#BEC8FF]">
                          /u/{selectedBizDetail.business.id}
                        </code>{' '}
                        · Responsable: {selectedBizDetail.business.ownerName}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedBizDetail(null)}
                    className="p-2 rounded-xl bg-[#1C1C22] text-[#A1A1AA] hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-[#1C1C22] border border-[#282830]">
                    <span className="text-[11px] text-[#A1A1AA]">Socios en el Club</span>
                    <p className="text-2xl font-extrabold text-[#F4F4F0] mt-1">
                      {selectedBizDetail.membersCount}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#1C1C22] border border-[#282830]">
                    <span className="text-[11px] text-[#A1A1AA]">Wallets Emitidas</span>
                    <p className="text-2xl font-extrabold text-[#2FB36A] mt-1">
                      {selectedBizDetail.walletPassesIssued}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#1C1C22] border border-[#282830]">
                    <span className="text-[11px] text-[#A1A1AA]">Sellos / Premios</span>
                    <p className="text-2xl font-extrabold text-[#BEC8FF] mt-1">
                      {selectedBizDetail.stampsAddedCount} / {selectedBizDetail.rewardsRedeemedCount}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#1C1C22] border border-[#282830]">
                    <span className="text-[11px] text-[#A1A1AA]">Productos Cargados</span>
                    <p className="text-2xl font-extrabold text-[#F4F4F0] mt-1">
                      {selectedBizDetail.productsCount}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#1C1C22] border border-[#282830] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#BEC8FF] flex items-center gap-1.5">
                      <Gift className="w-4 h-4" />
                      Configuración de Tarjeta de Sellos Digital
                    </h4>
                    <Link
                      to={`/u/${selectedBizDetail.business.id}`}
                      className="text-xs font-semibold text-[#2FB36A] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Abrir vista pública</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[#A1A1AA] block">
                        Premio (Meta {selectedBizDetail.clubConfig.targetStamps || 10} sellos):
                      </span>
                      <span className="font-bold text-[#F4F4F0]">
                        {selectedBizDetail.clubConfig.loyaltyReward ||
                          selectedBizDetail.clubConfig.rewardText}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#A1A1AA] block">Regla:</span>
                      <span className="font-bold text-[#F4F4F0]">
                        {selectedBizDetail.clubConfig.howToEarn || '1 sello por visita o compra'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#A1A1AA] block">Color de tarjeta:</span>
                      <span className="font-mono font-bold text-[#F4F4F0]">
                        {selectedBizDetail.clubConfig.cardThemeColor ||
                          selectedBizDetail.clubConfig.brandColor}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-[#1C1C22] border border-[#282830] p-4 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
                      Locales ({selectedBizDetail.locals.length})
                    </h4>
                    {selectedBizDetail.locals.map((loc) => (
                      <div
                        key={loc.id}
                        className="p-3 rounded-xl bg-[#141418] border border-[#282830] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#F4F4F0]">{loc.name}</p>
                          <p className="text-[#A1A1AA]">{loc.address}</p>
                        </div>
                        <span className="font-mono font-bold text-[#BEC8FF]">{loc.code}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-[#1C1C22] border border-[#282830] p-4 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
                      Equipo Operativo ({selectedBizDetail.team.length})
                    </h4>
                    {selectedBizDetail.team.map((tm) => (
                      <div
                        key={tm.id}
                        className="p-3 rounded-xl bg-[#141418] border border-[#282830] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#F4F4F0]">{tm.name}</p>
                          <p className="text-[#A1A1AA] uppercase text-[10px]">{tm.role}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[#2FB36A] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {tm.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedBizDetail.products.length > 0 && (
                  <div className="rounded-2xl bg-[#1C1C22] border border-[#282830] p-4 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-[#BEC8FF]" />
                      Catálogo de Productos ({selectedBizDetail.productsCount})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedBizDetail.products.slice(0, 6).map((prod) => (
                        <div
                          key={prod.id}
                          className="p-2.5 rounded-xl bg-[#141418] border border-[#282830] flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-[#F4F4F0] truncate">{prod.title}</span>
                          {prod.price !== undefined && (
                            <span className="font-bold text-[#BEC8FF] shrink-0">
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
