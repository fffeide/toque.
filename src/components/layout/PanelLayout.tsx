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
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Sun,
  Moon,
  Type,
  Lock,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  roles: UserRole[];
  proFeature?: boolean;
}

// 5 Secciones limpias del Panel del Comercio
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
    proFeature: true,
  },
  {
    to: '/panel/locales',
    label: 'Locales y Carteles',
    icon: Store,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/cuenta',
    label: 'Equipo y Cuenta',
    icon: Settings,
    roles: ['owner', 'manager', 'superadmin'],
  },
];

export const PanelLayout: React.FC = () => {
  const { user, business, logout } = useAuth();
  const { isDark, toggleTheme, largeText, toggleLargeText } = useTheme();
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
    <div className="theme-panel min-h-screen flex flex-col md:flex-row bg-[#0C0C0E] text-[#F4F4F6] pb-20 md:pb-0">
      {/* Sidebar Desktop ("Tactile Hardware") */}
      <aside className="panel-chrome-dark hidden md:flex md:w-64 md:flex-col border-r border-[#282830] bg-[#141418] text-[#F4F4F6] shrink-0">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#282830]">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandLogo variant="full" size="sm" />
          </Link>
        </div>

        {/* Business Pill + Plan Status */}
        <div className="p-4 border-b border-[#282830] space-y-2">
          <div className="p-3 rounded-xl bg-[#1C1C22] border border-[#282830]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#F4F4F6] truncate">
                {business?.name || 'La Burger'}
              </p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D95B26]/20 text-[#D95B26] border border-[#D95B26]/30 shrink-0">
                {roleBadgeLabel}
              </span>
            </div>
            <p className="text-[11px] text-[#9E9EA8] truncate mt-0.5">
              {user?.name || user?.email || 'Comercio activo'}
            </p>
          </div>

          {planState && (
            <Link
              to="/panel/cuenta"
              className={`block px-3 py-2 rounded-xl border text-[11px] font-semibold transition-colors ${
                isFreePlan
                  ? 'bg-[#1C1C22] border-[#282830] text-[#9E9EA8] hover:border-[#D95B26]'
                  : 'bg-[#2FB36A]/10 border-[#2FB36A]/30 text-[#2FB36A]'
              }`}
            >
              {isFreePlan ? (
                <span>Plan Free (Hub Básico) · Activar Pro →</span>
              ) : planState.status === 'trial' ? (
                <span>Trial Anual Pro · {planState.daysRemaining} días restantes</span>
              ) : (
                <span>Plan Pro Activo · Completo</span>
              )}
            </Link>
          )}
        </div>

        {/* Navigation Links (5 Secciones) */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const lockedByFree = isFreePlan && item.proFeature;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#D95B26] text-white font-bold shadow-sm'
                      : 'text-[#9E9EA8] hover:bg-[#1C1C22] hover:text-[#F4F4F6]'
                  }`
                }
              >
                <span className="flex items-center gap-3">
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
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors duration-150 mt-3 border border-[#D95B26]/40 ${
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
        <div className="p-4 border-t border-[#282830]">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#9E9EA8] hover:text-[#F4F4F6] hover:bg-[#1C1C22] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="panel-chrome-dark h-16 px-4 sm:px-8 border-b border-[#282830] bg-[#141418] text-[#F4F4F6] flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg text-[#F4F4F6] hover:bg-[#1C1C22]"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden flex items-center gap-2">
              <BrandLogo variant="isotipo" size="sm" />
              <span className="font-bold text-sm text-[#F4F4F6] truncate max-w-[140px]">
                {business?.name || 'La Burger'}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2.5">
              <span className="text-sm font-bold text-[#F4F4F6]">
                {business?.name || 'La Burger'}
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#1C1C22] border border-[#282830] text-[#D95B26]">
                {roleBadgeLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleLargeText}
              aria-pressed={largeText}
              title="Cambiar tamaño de letra"
              className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                largeText
                  ? 'bg-[#D95B26] text-white border-[#D95B26]'
                  : 'bg-[#1C1C22] text-[#F4F4F6] border-[#282830] hover:border-[#D95B26]'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Letra grande</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label="Cambiar modo de color"
              className="w-9 h-9 rounded-xl bg-[#1C1C22] border border-[#282830] hover:border-[#D95B26] text-[#F4F4F6] flex items-center justify-center transition-colors cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#D95B26]" />
              ) : (
                <Moon className="w-4 h-4 text-[#D95B26]" />
              )}
            </button>

            <Link
              to="/caja"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white text-xs font-bold shadow-sm"
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
            <div className="panel-chrome-dark relative w-72 max-w-[85vw] bg-[#141418] text-[#F4F4F6] border-r border-[#282830] h-full flex flex-col z-10">
              <div className="h-16 px-5 flex items-center justify-between border-b border-[#282830]">
                <BrandLogo variant="full" size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg text-[#9E9EA8] hover:bg-[#1C1C22]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold ${
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
                      `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold mt-2 border border-[#D95B26]/40 ${
                        isActive ? 'bg-[#D95B26] text-white' : 'bg-[#D95B26]/10 text-[#D95B26]'
                      }`
                    }
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Super Admin Toque</span>
                  </NavLink>
                )}
              </nav>

              <div className="p-4 border-t border-[#282830]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#9E9EA8] hover:text-[#F4F4F6]"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Barra Inferior Móvil (las 5 secciones limpias) */}
      <nav
        aria-label="Navegación principal móvil"
        className="panel-chrome-dark md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#141418]/95 backdrop-blur-md border-t border-[#282830] grid grid-cols-5 items-center px-1"
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
              <span className="truncate max-w-[64px]">{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
