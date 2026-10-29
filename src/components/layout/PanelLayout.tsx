import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { api } from '../../api';
import { UserRole, PlanState } from '../../api/types';
import { BrandLogo } from '../ui/Avatar';
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
  Factory,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  roles: UserRole[];
  proFeature?: boolean;
}

// 7 Secciones limpias del Panel del Comercio (incluye Hub Digital)
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
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [planState, setPlanState] = useState<PlanState | null>(null);

  useEffect(() => {
    api
      .getPlanState()
      .then(setPlanState)
      .catch(() => {});
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

  const roleBadgeLabel =
    currentRole === 'superadmin'
      ? 'Super Admin'
      : currentRole === 'owner'
      ? 'Dueño'
      : currentRole === 'manager'
      ? 'Encargado'
      : 'Cajero';

  return (
    <div className="theme-panel min-h-screen flex flex-col md:flex-row bg-[#0A0A0A] text-[#F4F4F6] pb-20 md:pb-0 text-sm">
      {/* Sidebar Desktop ("Tactile Hardware") */}
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
                isFreePlan
                  ? 'bg-[#1C1C22] border-[#282830] text-[#9E9EA8] hover:border-[#D95B26]'
                  : 'bg-[#2FB36A]/10 border-[#2FB36A]/30 text-[#2FB36A]'
              }`}
            >
              {isFreePlan ? (
                <span>Plan Gratuito · Activo</span>
              ) : planState.planId === 'a_consultar' ? (
                <span>Plan A Consultar · Activo</span>
              ) : planState.status === 'trial' ? (
                <span>Plan Pago · En prueba ({planState.daysRemaining}d)</span>
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

          <NavLink
            to="/fabricante"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 mt-2 border border-[#242424] ${
                isActive
                  ? 'bg-[#D95B26] text-white'
                  : 'bg-[#0A0A0A] text-[#9E9EA8] hover:text-[#F4F4F6] hover:border-[#D95B26]/50'
              }`
            }
          >
            <Factory className="w-4 h-4 shrink-0 text-[#D95B26]" />
            <span>Panel de fabricante</span>
          </NavLink>

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

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Barra Inferior Móvil */}
      <nav
        aria-label="Navegación principal móvil"
        className="panel-chrome-dark md:hidden fixed bottom-0 left-0 right-0 z-30 h-15 bg-[#141418]/95 backdrop-blur-md border-t border-[#282830] grid grid-cols-8 items-center px-1"
      >
        {ALL_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const allowed = item.roles.includes(currentRole);
          if (!allowed) {
            return <div key={item.to} />;
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold ${
                  isActive ? 'text-[#D95B26] font-bold' : 'text-[#9E9EA8]'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[48px]">{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
