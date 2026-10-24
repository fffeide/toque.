import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { UserRole } from '../../api/types';
import { ClubSetupWizard } from '../../features/panel/ClubSetupWizard';
import {
  LayoutDashboard,
  QrCode,
  Smartphone,
  Award,
  Settings,
  LogOut,
  Menu,
  X,
  CreditCard,
  Users,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  ShoppingBag,
  Bell,
  Store,
  ShieldAlert,
  Type,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  roles: UserRole[];
  requiresNetworkEnabled?: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    to: '/panel/resumen',
    label: 'Resumen',
    icon: LayoutDashboard,
    roles: ['owner', 'manager', 'cashier', 'superadmin'],
  },
  {
    to: '/panel/escanear',
    label: 'Escanear Club',
    icon: QrCode,
    roles: ['owner', 'manager', 'cashier', 'superadmin'],
  },
  {
    to: '/panel/fidelidad',
    label: 'Club Fidelidad',
    icon: Award,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/avisos',
    label: 'Avisos Club',
    icon: Bell,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/locales',
    label: 'Locales y Cartel',
    icon: Store,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/correcciones',
    label: 'Correcciones',
    icon: ShieldAlert,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/carteles',
    label: 'Mis Carteles',
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
    to: '/panel/productos',
    label: 'Productos',
    icon: ShoppingBag,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/red',
    label: 'Red de Beneficios',
    icon: Sparkles,
    roles: ['owner', 'manager', 'superadmin'],
    requiresNetworkEnabled: true,
  },
  {
    to: '/panel/equipo',
    label: 'Equipo',
    icon: Users,
    roles: ['owner', 'manager', 'superadmin'],
  },
  {
    to: '/panel/suscripcion',
    label: 'Suscripción',
    icon: CreditCard,
    roles: ['owner', 'superadmin'],
  },
  {
    to: '/panel/cuenta',
    label: 'Mi Cuenta',
    icon: Settings,
    roles: ['owner', 'superadmin'],
  },
];

export const PanelLayout: React.FC = () => {
  const { user, business, logout } = useAuth();
  const { isDark, toggleTheme, largeText, toggleLargeText } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentRole: UserRole = user?.isSuperAdmin
    ? 'superadmin'
    : (user?.role || 'owner');

  const isNetworkEnabled = Boolean(business?.networkEnabled);

  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(currentRole)) return false;
    if (item.requiresNetworkEnabled && !isNetworkEnabled) return false;
    return true;
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
    <div className="theme-panel min-h-screen flex flex-col md:flex-row bg-[#000000] text-[#f1f1ee]">
      {/* Sidebar Desktop — siempre mantiene su fondo negro en modo claro y oscuro */}
      <aside className="panel-chrome-dark hidden md:flex md:w-64 md:flex-col border-r border-[#242426] bg-[#111113] text-[#f1f1ee] shrink-0">
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-[#242426]">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#bec8ff] flex items-center justify-center text-[#0c0c0c] font-bold text-sm">
              T
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-[#f1f1ee] block leading-none">
                toque™
              </span>
              <span className="text-[11px] text-[#a1a1aa] font-medium">
                Panel Comercio
              </span>
            </div>
          </Link>
        </div>

        {/* Business Pill */}
        <div className="p-4 border-b border-[#242426]">
          <div className="p-3 rounded-xl bg-[#18181b] border border-[#28282a]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#f1f1ee] truncate">
                {business?.name || 'Café & Panadería La Esquina'}
              </p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#bec8ff]/15 text-[#bec8ff] shrink-0">
                {roleBadgeLabel}
              </span>
            </div>
            <p className="text-[11px] text-[#a1a1aa] truncate mt-0.5">
              {user?.name || 'Martín Gómez'}
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const displayLabel =
              currentRole === 'cashier' && item.to === '/panel/carteles'
                ? 'Carteles'
                : item.label;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#bec8ff] text-[#0c0c0c] font-bold'
                      : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#f1f1ee]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{displayLabel}</span>
              </NavLink>
            );
          })}

          {currentRole === 'superadmin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 mt-2 border border-[#bec8ff]/30 ${
                  isActive
                    ? 'bg-[#bec8ff] text-[#0c0c0c] font-bold'
                    : 'bg-[#bec8ff]/10 text-[#bec8ff] hover:bg-[#bec8ff]/20'
                }`
              }
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Super Admin Global</span>
            </NavLink>
          )}
        </nav>

        {/* Quick Actions Footer */}
        <div className="p-4 border-t border-[#242426] space-y-2">
          <Link
            to="/caja"
            className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#222226] text-xs font-semibold text-[#f1f1ee] border border-[#28282a] transition-colors"
          >
            <span className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#2fb36a]" />
              Ir a Caja
            </span>
            <span className="text-[10px] bg-[#2fb36a]/20 text-[#34d399] px-2 py-0.5 rounded-full font-bold">
              POS
            </span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 rounded-xl text-xs font-medium text-[#a1a1aa] hover:text-[#f1f1ee] hover:bg-[#18181b] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (Nombre del comercio + Rol) — se mantiene en negro también en modo claro */}
        <header className="panel-chrome-dark h-16 px-4 sm:px-8 border-b border-[#242426] bg-[#111113] text-[#f1f1ee] flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg text-[#f1f1ee] hover:bg-[#18181b]"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#bec8ff] flex items-center justify-center text-[#0c0c0c] font-bold text-xs">
                T
              </div>
              <span className="font-bold text-sm text-[#f1f1ee]">toque™</span>
            </div>
            <div className="hidden md:flex items-center gap-2.5">
              <span className="text-sm font-semibold text-[#f1f1ee]">
                {business?.name || 'Café & Panadería La Esquina'}
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#18181b] border border-[#28282a] text-[#bec8ff]">
                Nivel: {roleBadgeLabel}
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
                  ? 'bg-[#bec8ff] text-[#0c0c0c] border-[#bec8ff]'
                  : 'bg-[#18181b] text-[#f1f1ee] border-[#28282a] hover:border-[#bec8ff]'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Letra más grande</span>
            </button>

            {/* Botón Modo Oscuro / Claro */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label="Cambiar modo de color"
              className="w-9 h-9 rounded-xl bg-[#18181b] border border-[#28282a] hover:border-[#bec8ff] text-[#f1f1ee] flex items-center justify-center transition-colors cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#bec8ff]" />
              ) : (
                <Moon className="w-4 h-4 text-[#bec8ff]" />
              )}
            </button>

            <Link
              to="/caja"
              className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#bec8ff] text-[#0c0c0c] text-xs font-bold"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Caja
            </Link>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/70"
              onClick={() => setMobileOpen(false)}
            />
            <div className="panel-chrome-dark relative w-72 max-w-[85vw] bg-[#111113] text-[#f1f1ee] border-r border-[#242426] h-full flex flex-col z-10">
              <div className="h-16 px-5 flex items-center justify-between border-b border-[#242426]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#bec8ff] flex items-center justify-center text-[#0c0c0c] font-bold text-xs">
                    T
                  </div>
                  <span className="font-bold text-base text-[#f1f1ee]">toque™</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label="Cambiar modo de color"
                    className="p-2 rounded-lg bg-[#18181b] border border-[#28282a] text-[#f1f1ee]"
                  >
                    {isDark ? (
                      <Sun className="w-4 h-4 text-[#bec8ff]" />
                    ) : (
                      <Moon className="w-4 h-4 text-[#bec8ff]" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="p-2 rounded-lg text-[#a1a1aa] hover:bg-[#18181b]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 border-b border-[#242426]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#f1f1ee] truncate">
                    {business?.name || 'Café & Panadería La Esquina'}
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#bec8ff]/15 text-[#bec8ff]">
                    {roleBadgeLabel}
                  </span>
                </div>
                <p className="text-[11px] text-[#a1a1aa]">{user?.name}</p>
              </div>

              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const displayLabel =
                    currentRole === 'cashier' && item.to === '/panel/carteles'
                      ? 'Carteles'
                      : item.label;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium ${
                          isActive
                            ? 'bg-[#bec8ff] text-[#0c0c0c] font-bold'
                            : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#f1f1ee]'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      <span>{displayLabel}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-[#242426] space-y-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3.5 py-2.5 rounded-xl text-xs font-medium text-[#a1a1aa] hover:text-[#f1f1ee]"
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
          {currentRole !== 'cashier' && <ClubSetupWizard />}
          <Outlet />
        </main>
      </div>
    </div>
  );
};
