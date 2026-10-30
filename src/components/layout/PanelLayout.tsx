import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { api } from '../../api';
import { UserRole, PlanState } from '../../api/types';
import { TOQUE_PLANS, formatArs } from '../../config/pricing';
import { BrandLogo } from '../ui/Avatar';
import { useToast } from '../ui/Toast';
import {
  LayoutDashboard,
  CreditCard,
  Award,
  Store,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Sun,
  Moon,
  Lock,
  Smartphone,
  Star,
  QrCode,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  roles: UserRole[];
  proFeature?: boolean;
}

// Pestañas del Panel con "Escanear" como pestaña central accesible para cajero, encargado y dueño
const ALL_NAV_ITEMS: NavItem[] = [
  {
    to: '/panel/resumen',
    label: 'Resumen',
    icon: LayoutDashboard,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/caja',
    label: 'Caja (POS)',
    icon: CreditCard,
    roles: ['owner', 'manager', 'cashier', 'superadmin'],
    proFeature: true,
  },
  {
    to: '/panel/tarjetas',
    label: 'Tarjetas',
    icon: Award,
    roles: ['owner', 'manager', 'cashier', 'superadmin'],
  },
  {
    to: '/panel/escanear',
    label: 'Escanear',
    icon: QrCode,
    roles: ['owner', 'manager', 'cashier', 'superadmin'],
  },
  {
    to: '/panel/hub',
    label: 'Hub',
    icon: Smartphone,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/resenas',
    label: 'Reseñas',
    icon: Star,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/locales',
    label: 'Locales y Carteles',
    icon: Store,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/equipo',
    label: 'Equipo',
    icon: Users,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/cuenta',
    label: 'Cuenta',
    icon: Settings,
    roles: ['owner', 'manager', 'superadmin'],
  },
];

export const PanelLayout: React.FC = () => {
  const { user, business, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [showChoosePlanModal, setShowChoosePlanModal] = useState(false);
  const [choosingPlan, setChoosingPlan] = useState(false);
  const [selectedModalPlan, setSelectedModalPlan] = useState<'mensual' | 'anual' | null>(null);

  const loadPlanState = () => {
    api
      .getPlanState()
      .then(setPlanState)
      .catch(() => {});
  };

  useEffect(() => {
    loadPlanState();
  }, []);

  const cleanEmail = (user?.email || '').trim().toLowerCase();
  const isVerifiedSuperAdmin =
    Boolean(user?.isSuperAdmin) ||
    user?.role === 'superadmin' ||
    cleanEmail === 'fedeeeloiss@gmail.com';

  const currentRole: UserRole = isVerifiedSuperAdmin ? 'superadmin' : user?.role || 'owner';
  const isFreePlan = planState?.status === 'free' || planState?.planId === 'free';

  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => item.roles.includes(currentRole));

  const handleLogout = async () => {
    await logout();
    navigate('/ingresar');
  };

  const handleConfirmPlan = async (choice: 'mensual' | 'anual') => {
    try {
      setChoosingPlan(true);
      const updated = await api.selectPlan(choice);
      setPlanState(updated);
      setShowChoosePlanModal(false);
      showToast(
        choice === 'anual'
          ? 'Plan Anual activado en tu comercio.'
          : 'Plan Mensual activado en tu comercio.',
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'No pudimos activar el plan.', 'error');
    } finally {
      setChoosingPlan(false);
    }
  };

  const roleBadgeLabel =
    currentRole === 'superadmin'
      ? 'Super Admin'
      : currentRole === 'owner'
      ? 'Dueño'
      : currentRole === 'manager'
      ? 'Encargado'
      : 'Cajero';

  const daysRemaining = planState?.daysRemaining ?? 14;
  const isTrial = planState?.status === 'trial';
  const isTrialPaused =
    !isVerifiedSuperAdmin &&
    (planState?.status === 'past_due' ||
      planState?.status === 'expired' ||
      (isTrial && daysRemaining <= 0));

  // Avisos especiales el día 10 (quedan 4 días) y el día 14 (quedan 0 días)
  const isDay10Warning = isTrial && daysRemaining <= 4 && daysRemaining > 0;
  const isDay14Warning = isTrialPaused || (isTrial && daysRemaining <= 0);

  return (
    <div className="theme-panel min-h-screen flex flex-col md:flex-row bg-[#0A0A0A] text-[#F4F4F6] pb-20 md:pb-0 text-sm">
      {/* Sidebar Desktop */}
      <aside className="panel-chrome-dark hidden md:flex md:w-60 md:flex-col border-r border-[#242424] bg-[#141414] text-[#F4F4F6] shrink-0">
        {/* Brand Header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-[#242424]">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo variant="full" size="sm" />
          </Link>
        </div>

        {/* Business Pill + Plan Status */}
        <div className="p-3.5 border-b border-[#242424] space-y-2">
          <div className="p-2.5 rounded-xl bg-[#0A0A0A] border border-[#242424]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#F4F4F6] truncate">
                {business?.name || 'Mi Comercio'}
              </p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D95B26]/20 text-[#D95B26] border border-[#D95B26]/30 shrink-0">
                {roleBadgeLabel}
              </span>
            </div>
            <p className="text-[11px] text-[#9E9EA8] truncate mt-0.5">
              {user?.name || user?.email || 'Cuenta activa'}
            </p>
          </div>

          {planState && (
            <Link
              to="/panel/cuenta"
              className={`block px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors ${
                isTrialPaused
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : isFreePlan
                  ? 'bg-[#1C1C22] border-[#282830] text-[#9E9EA8] hover:border-[#D95B26]'
                  : 'bg-[#2FB36A]/10 border-[#2FB36A]/30 text-[#2FB36A]'
              }`}
            >
              {isTrialPaused ? (
                <span>Prueba finalizada · En pausa</span>
              ) : isFreePlan ? (
                <span>Plan Gratuito · Activo</span>
              ) : planState.planId === 'a_consultar' ? (
                <span>Plan A Consultar · Activo</span>
              ) : planState.status === 'trial' ? (
                <span>Te quedan {daysRemaining} días de prueba</span>
              ) : (
                <span>Plan Pago · Activo</span>
              )}
            </Link>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const lockedByFree = isFreePlan && item.proFeature;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#D95B26] text-white font-bold shadow-sm'
                      : 'text-[#9E9EA8] hover:bg-[#1C1C22] hover:text-[#F4F4F6]'
                  }`
                }
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {lockedByFree && <Lock className="w-3.5 h-3.5 text-[#9E9EA8]" />}
              </NavLink>
            );
          })}

          {isVerifiedSuperAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors duration-150 mt-2.5 border border-[#D95B26]/40 ${
                  isActive
                    ? 'bg-[#D95B26] text-white'
                    : 'bg-[#D95B26]/10 text-[#D95B26] hover:bg-[#D95B26]/20'
                }`
              }
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Super Admin Toque</span>
            </NavLink>
          )}
        </nav>

        {/* Logout Footer */}
        <div className="p-3.5 border-t border-[#282830]">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-[#9E9EA8] hover:text-[#F4F4F6] hover:bg-[#1C1C22] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Cartel fijo en el panel cuando está en prueba de 14 días */}
        {(isTrial || isTrialPaused) && (
          <div
            className={`px-4 sm:px-6 py-2.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
              isDay14Warning
                ? 'bg-red-500/15 border-red-500/40 text-red-200'
                : isDay10Warning
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                : 'bg-[#D95B26]/15 border-[#D95B26]/30 text-[#F4F4F6]'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D95B26] shrink-0" />
              <div>
                <span className="font-bold">
                  {isDay14Warning
                    ? 'Día 14: Tu prueba de 14 días terminó'
                    : `Te quedan ${daysRemaining} ${
                        daysRemaining === 1 ? 'día' : 'días'
                      } de prueba`}
                </span>
                {isDay10Warning && (
                  <span className="ml-2 text-amber-300">
                    · Aviso del día 10: elegí tu plan para que el panel no entre en pausa al terminar.
                  </span>
                )}
                {isDay14Warning && (
                  <span className="ml-2 text-red-200">
                    · El panel está en pausa. Tu cartel físico y las tarjetas de tus clientes siguen andando.
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowChoosePlanModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#D95B26] hover:bg-[#e06530] text-white font-bold text-xs transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
            >
              Elegir plan
            </button>
          </div>
        )}

        {/* Top Bar */}
        <header className="panel-chrome-dark h-14 px-4 sm:px-6 border-b border-[#282830] bg-[#141418] text-[#F4F4F6] flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-[#F4F4F6] hover:bg-[#1C1C22]"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden flex items-center gap-2">
              <BrandLogo variant="isotipo" size="sm" />
              <span className="font-bold text-xs text-[#F4F4F6] truncate max-w-[140px]">
                {business?.name || 'Mi Comercio'}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-bold text-[#F4F4F6]">
                {business?.name || 'Mi Comercio'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1C1C22] border border-[#282830] text-[#D95B26]">
                {roleBadgeLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label="Cambiar modo de color"
              className="w-8 h-8 rounded-xl bg-[#1C1C22] border border-[#282830] hover:border-[#D95B26] text-[#F4F4F6] flex items-center justify-center transition-colors cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#D95B26]" />
              ) : (
                <Moon className="w-4 h-4 text-[#D95B26]" />
              )}
            </button>

            <Link
              to="/panel/escanear"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1C22] border border-[#282830] hover:border-[#D95B26] text-[#F4F4F6] text-xs font-bold"
            >
              <QrCode className="w-3.5 h-3.5 text-[#D95B26]" />
              <span className="hidden sm:inline">Sumar sello</span>
            </Link>

            <Link
              to="/caja"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white text-xs font-bold shadow-sm"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Caja POS</span>
            </Link>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-black/75" onClick={() => setMobileOpen(false)} />
            <div className="panel-chrome-dark relative w-64 max-w-[85vw] bg-[#141418] text-[#F4F4F6] border-r border-[#282830] h-full flex flex-col z-10">
              <div className="h-14 px-4 flex items-center justify-between border-b border-[#282830]">
                <BrandLogo variant="full" size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-[#9E9EA8] hover:bg-[#1C1C22]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                          isActive
                            ? 'bg-[#D95B26] text-white font-bold'
                            : 'text-[#9E9EA8] hover:bg-[#1C1C22] hover:text-[#F4F4F6]'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}

                {isVerifiedSuperAdmin && (
                  <NavLink
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold mt-2 border border-[#D95B26]/40 ${
                        isActive ? 'bg-[#D95B26] text-white' : 'bg-[#D95B26]/10 text-[#D95B26]'
                      }`
                    }
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Super Admin Toque</span>
                  </NavLink>
                )}
              </nav>

              <div className="p-3.5 border-t border-[#282830]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-[#9E9EA8] hover:text-[#F4F4F6]"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Body (Si termina la prueba sin plan, el panel queda en pausa) */}
        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          {isTrialPaused ? (
            <div className="max-w-xl mx-auto my-8 rounded-3xl bg-[#141414] border border-[#242424] p-6 sm:p-8 text-center space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[#D95B26]/15 text-[#D95B26] flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold text-[#F4F4F6]">
                  Tu prueba de 14 días terminó
                </h1>
                <p className="text-xs sm:text-sm text-[#9E9EA8]">
                  El panel del comercio está en pausa hasta que elijas un plan. Tu cartel físico en el mostrador y las tarjetas de tus clientes siguen andando normalmente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                <button
                  type="button"
                  onClick={() => setSelectedModalPlan('mensual')}
                  className={`p-4 rounded-2xl border transition-colors cursor-pointer ${
                    selectedModalPlan === 'mensual'
                      ? 'bg-[#D95B26]/15 border-[#D95B26]'
                      : 'bg-[#0A0A0A] border-[#242424] hover:border-[#3f3f46]'
                  }`}
                >
                  <p className="text-xs font-bold text-[#F4F4F6]">Mensual</p>
                  <p className="text-lg font-extrabold text-[#F4F4F6] mt-1 font-mono">
                    {formatArs(TOQUE_PLANS.mensual.priceMonthlyArs)}{' '}
                    <span className="text-xs font-normal text-[#9E9EA8]">/ mes</span>
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedModalPlan('anual')}
                  className={`p-4 rounded-2xl border transition-colors cursor-pointer ${
                    selectedModalPlan === 'anual'
                      ? 'bg-[#D95B26]/15 border-[#D95B26]'
                      : 'bg-[#0A0A0A] border-[#242424] hover:border-[#3f3f46]'
                  }`}
                >
                  <p className="text-xs font-bold text-[#F4F4F6]">Anual</p>
                  <p className="text-lg font-extrabold text-[#F4F4F6] mt-1 font-mono">
                    {formatArs(TOQUE_PLANS.anual.totalPriceArs)}{' '}
                    <span className="text-xs font-normal text-[#9E9EA8]">/ año</span>
                  </p>
                  <p className="text-[11px] text-[#2FB36A] font-semibold mt-0.5">
                    Equivale a {formatArs(TOQUE_PLANS.anual.priceMonthlyArs)} / mes
                  </p>
                </button>
              </div>

              <button
                type="button"
                disabled={!selectedModalPlan || choosingPlan}
                onClick={() => selectedModalPlan && handleConfirmPlan(selectedModalPlan)}
                className="w-full py-3.5 px-6 rounded-xl bg-[#D95B26] hover:bg-[#e06530] disabled:opacity-50 text-white font-bold text-sm transition-colors cursor-pointer"
              >
                {choosingPlan ? 'Activando plan...' : 'Activar plan y reactivar el panel'}
              </button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Modal para elegir plan desde el cartel fijo de prueba */}
      {showChoosePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-lg rounded-3xl bg-[#141414] border border-[#242424] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#F4F4F6]">Elegí tu plan</h2>
                <p className="text-xs text-[#9E9EA8] mt-0.5">
                  Te quedan {daysRemaining} días de prueba. Elegí cómo querés continuar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChoosePlanModal(false)}
                className="p-1.5 rounded-lg text-[#9E9EA8] hover:text-[#F4F4F6] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedModalPlan('mensual')}
                className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                  selectedModalPlan === 'mensual'
                    ? 'bg-[#D95B26]/15 border-[#D95B26]'
                    : 'bg-[#0A0A0A] border-[#242424] hover:border-[#3f3f46]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F4F4F6]">Mensual</span>
                  {selectedModalPlan === 'mensual' && (
                    <CheckCircle2 className="w-4 h-4 text-[#D95B26]" />
                  )}
                </div>
                <p className="text-xl font-extrabold text-[#F4F4F6] mt-2 font-mono">
                  {formatArs(TOQUE_PLANS.mensual.priceMonthlyArs)}
                </p>
                <p className="text-[11px] text-[#9E9EA8] mt-0.5">Por mes · Todo incluido</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedModalPlan('anual')}
                className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                  selectedModalPlan === 'anual'
                    ? 'bg-[#D95B26]/15 border-[#D95B26]'
                    : 'bg-[#0A0A0A] border-[#242424] hover:border-[#3f3f46]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F4F4F6]">Anual</span>
                  {selectedModalPlan === 'anual' && (
                    <CheckCircle2 className="w-4 h-4 text-[#D95B26]" />
                  )}
                </div>
                <p className="text-xl font-extrabold text-[#F4F4F6] mt-2 font-mono">
                  {formatArs(TOQUE_PLANS.anual.totalPriceArs)}
                </p>
                <p className="text-[11px] text-[#2FB36A] font-semibold mt-0.5">
                  Equivale a {formatArs(TOQUE_PLANS.anual.priceMonthlyArs)} / mes (2 meses sin cargo)
                </p>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowChoosePlanModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#242424] text-xs font-semibold text-[#9E9EA8] hover:text-[#F4F4F6] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedModalPlan || choosingPlan}
                onClick={() => selectedModalPlan && handleConfirmPlan(selectedModalPlan)}
                className="px-5 py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#e06530] disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
              >
                {choosingPlan ? 'Guardando...' : 'Confirmar plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra Inferior Móvil con pestaña central "Escanear" */}
      <nav
        aria-label="Navegación principal móvil"
        className="panel-chrome-dark md:hidden fixed bottom-0 left-0 right-0 z-30 h-15 bg-[#141418]/95 backdrop-blur-md border-t border-[#282830] grid grid-cols-5 items-center px-1"
      >
        {[
          ALL_NAV_ITEMS[0], // Resumen
          ALL_NAV_ITEMS[1], // Caja
          ALL_NAV_ITEMS[3], // Escanear (Pestaña central)
          ALL_NAV_ITEMS[2], // Tarjetas
          ALL_NAV_ITEMS[8], // Cuenta
        ].map((item) => {
          const Icon = item.icon;
          const allowed = item.roles.includes(currentRole);
          if (!allowed) {
            return <div key={item.to} />;
          }
          const isCentralScan = item.to === '/panel/escanear';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold ${
                  isActive
                    ? 'text-[#D95B26] font-bold'
                    : isCentralScan
                    ? 'text-[#F4F4F6]'
                    : 'text-[#9E9EA8]'
                }`
              }
            >
              <Icon className={`w-4 h-4 ${isCentralScan ? 'text-[#D95B26]' : ''}`} />
              <span className="truncate max-w-[56px]">{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
