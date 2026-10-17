import React from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import {
  LayoutDashboard,
  Receipt,
  QrCode,
  SlidersHorizontal,
  Award,
  Link2,
  Star,
  Settings,
  CreditCard,
  LogOut,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';

export const PanelLayout: React.FC = () => {
  const { user, business, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/panel', label: 'Resumen', icon: LayoutDashboard, exact: true },
    { to: '/panel/ventas', label: 'Ventas', icon: Receipt },
    { to: '/panel/carteles', label: 'Mis Carteles', icon: QrCode },
    { to: '/panel/hub', label: 'Hub', icon: SlidersHorizontal },
    { to: '/panel/club', label: 'Club', icon: Award },
    { to: '/panel/conexiones', label: 'Conexiones', icon: Link2 },
    { to: '/panel/resenas', label: 'Reseñas', icon: Star },
    { to: '/panel/cuenta', label: 'Cuenta', icon: Settings },
  ];

  return (
    <div className="aurora-stage min-h-screen text-white flex flex-col md:flex-row relative selection:bg-[#3A3FE0] selection:text-white">
      {/* 1. BARRA LATERAL EN ESCRITORIO: Barra en negro claro con estética Liquid Glass */}
      <aside className="hidden md:flex flex-col w-64 aurora-sidebar-glass shrink-0 p-5 sticky top-4 h-[calc(100vh-2rem)] overflow-y-auto z-10 m-4 rounded-3xl border border-white/10 shadow-2xl">
        {/* Identidad de Marca */}
        <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-5">
          <Link to="/panel" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#454BFF] to-[#2D33D0] text-white flex items-center justify-center font-display font-bold text-lg shadow-[0_0_15px_rgba(58,63,224,0.45)] border border-white/20">
              T
            </div>
            <div>
              <span className="font-display font-bold text-base text-white tracking-tight block">
                Toque
              </span>
              <span className="text-[10px] text-white/60 font-medium block -mt-0.5">
                Módulo Recibo
              </span>
            </div>
          </Link>

          <Link
            to="/landing"
            className="text-[10px] font-semibold text-white/50 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition"
            title="Ver Landing Page"
          >
            Landing
          </Link>
        </div>

        {/* Botón Destacado de Pantalla de Caja */}
        <div className="mb-6">
          <Link to="/caja">
            <Button
              variant="estrella"
              size="touch"
              fullWidth
              icon={<CreditCard className="w-5 h-5 text-[#0B1030]" />}
              className="text-sm shadow-md"
            >
              Abrir Caja
            </Button>
          </Link>
        </div>

        {/* Menú de Navegación Vertical */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-xs border border-white/20 backdrop-blur-md'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#FFC21A]' : 'text-white/60'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Pie de Barra Lateral: Info Negocio y Lotes */}
        <div className="pt-4 border-t border-white/10 space-y-3 mt-auto">
          <Link
            to="/admin/lotes"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] text-white/60 hover:text-white hover:bg-white/[0.08] transition"
          >
            <Layers className="w-3.5 h-3.5 text-white/60" />
            <span>Fabricante · Lotes</span>
          </Link>

          <div className="bg-white/[0.07] p-3 rounded-2xl border border-white/10 backdrop-blur-md">
            <p className="text-xs font-bold text-white truncate">
              {business?.name || 'Mi Negocio'}
            </p>
            <p className="text-[10px] text-white/60 truncate">
              {user?.email || 'comercio@toque.ar'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#FF6B6B] hover:bg-white/[0.08] rounded-xl transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* 2. ÁREA PRINCIPAL DE CONTENIDO */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8 relative z-1">
        {/* Top Header en Mobile */}
        <header className="md:hidden bg-[#141822]/90 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between sticky top-0 z-20 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#454BFF] to-[#2D33D0] text-white flex items-center justify-center font-display font-bold text-sm shadow-xs border border-white/20">
              T
            </div>
            <span className="font-display font-bold text-sm text-white">
              {business?.name || 'Toque Recibo'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/landing" className="text-[11px] font-semibold text-white/70 px-2 py-1 rounded hover:bg-white/10">
              Landing
            </Link>
            <Link to="/caja">
              <Button variant="estrella" size="sm" icon={<CreditCard className="w-3.5 h-3.5" />}>
                Caja
              </Button>
            </Link>
          </div>
        </header>

        {/* Contenido Dinámico de las Subpáginas */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* 3. BARRA INFERIOR EN DISPOSITIVOS MÓVILES (Negro claro Liquid Glass) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#12151E]/95 backdrop-blur-2xl border-t border-white/10 z-30 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center p-1.5 rounded-lg min-w-[56px] text-[10px] font-medium transition ${
                isActive ? 'text-[#FFC21A] font-bold' : 'text-white/60'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <NavLink
          to="/panel/cuenta"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center p-1.5 rounded-lg min-w-[56px] text-[10px] font-medium transition ${
              isActive ? 'text-[#FFC21A] font-bold' : 'text-white/60'
            }`
          }
        >
          <Settings className="w-4 h-4 mb-0.5" />
          <span>Cuenta</span>
        </NavLink>
      </nav>
    </div>
  );
};
