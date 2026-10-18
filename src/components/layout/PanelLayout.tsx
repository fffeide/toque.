import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { api, Cartel } from '../../api';
import {
  LayoutDashboard,
  Receipt,
  QrCode,
  SlidersHorizontal,
  Award,
  Users,
  Star,
  Settings,
  CreditCard,
  LogOut,
  ShieldCheck,
  Sun,
  Moon,
  MessageCircle,
} from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  manager: 'Encargado',
  cashier: 'Cajero',
  superadmin: 'Super Admin',
};

export const PanelLayout: React.FC = () => {
  const { user, business, isLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(true);
  const [primaryCartelCode, setPrimaryCartelCode] = useState('CAJA01');

  useEffect(() => {
    api
      .listCarteles()
      .then((list) => {
        const active = list.find((c: Cartel) => c.status === 'active') || list[0];
        if (active?.code) {
          setPrimaryCartelCode(active.code);
        }
      })
      .catch(() => {});
  }, [business?.id]);

  // Guardián RLS: El rol Cajero solo tiene permiso sobre la terminal de mostrador (/caja)
  if (!isLoading && user?.role === 'cashier') {
    return <Navigate to="/caja" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? 'Buenos días'
      : hour >= 12 && hour < 19
      ? 'Buenas tardes'
      : 'Buenas noches';

  const formattedDate = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  const serviceItems = [
    {
      to: '/panel',
      matchPaths: ['/panel', '/panel/resumen', '/resumen'],
      label: 'Resumen',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      to: '/panel/carteles',
      matchPaths: ['/panel/carteles'],
      label: 'Mis Carteles',
      icon: QrCode,
    },
    {
      to: '/panel/hub',
      matchPaths: ['/panel/hub', '/panel/canales'],
      label: 'Canales y Hub',
      icon: SlidersHorizontal,
    },
    {
      to: '/panel/ventas',
      matchPaths: ['/panel/ventas', '/panel/reportes'],
      label: 'Reportes y Ventas',
      icon: Receipt,
    },
    {
      to: '/panel/club',
      matchPaths: ['/panel/club'],
      label: 'Club de Fidelidad',
      icon: Award,
    },
    {
      to: '/panel/resenas',
      matchPaths: ['/panel/resenas'],
      label: 'Reseñas',
      icon: Star,
    },
  ];

  const configItems = [
    {
      to: '/panel/equipo',
      matchPaths: ['/panel/equipo'],
      label: 'Equipo',
      icon: Users,
    },
    {
      to: '/panel/cuenta',
      matchPaths: ['/panel/cuenta'],
      label: 'Mi Cuenta',
      icon: Settings,
    },
    {
      to: '/caja',
      matchPaths: ['/caja'],
      label: 'Pantalla de Caja',
      icon: CreditCard,
    },
    {
      to: '/admin',
      matchPaths: ['/admin'],
      label: 'Super Admin Global',
      icon: ShieldCheck,
    },
  ];

  const isItemActive = (item: { to: string; matchPaths: string[]; exact?: boolean }) => {
    if (item.exact) {
      return item.matchPaths.includes(location.pathname);
    }
    return item.matchPaths.some((p) => location.pathname.startsWith(p));
  };

  const businessInitial = (business?.name || 'C').charAt(0).toUpperCase();
  const userInitial = (user?.name || user?.email || 'D').charAt(0).toUpperCase();
  const userRoleLabel = ROLE_LABELS[user?.role || 'owner'] || 'Dueño';

  return (
    <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col md:flex-row selection:bg-[#bec8ff] selection:text-[#0c0c0c]">
      {/* 1. SIDEBAR IZQUIERDO FIJO */}
      <aside className="hidden md:flex w-64 bg-[#0c0c0c] border-r border-[#242426] flex-col justify-between shrink-0 sticky top-0 h-screen overflow-y-auto z-20">
        <div>
          {/* Arriba: Logo de toque™ + píldora verde con contraste WCAG AA */}
          <div className="px-4 pt-5 pb-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#f1f1ee] border border-[#242426] flex items-center justify-center">
                <img src="/assets/logo.svg" alt="" className="w-5 h-5 object-contain" />
              </div>
              <span className="font-bold text-base tracking-tight text-[#f1f1ee]">toque™</span>
            </Link>
            <span className="bg-[#2fb36a]/20 text-[#34d399] border border-[#2fb36a]/40 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              • Gratis
            </span>
          </div>

          {/* Selector de Local */}
          <div className="bg-[#111113] border border-[#242426] rounded-2xl p-3 mx-3 my-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#bec8ff] text-[#0c0c0c] font-bold text-sm flex items-center justify-center shrink-0">
              {businessInitial}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] uppercase tracking-wider text-[#a1a1aa] font-semibold">
                TU LOCAL
              </span>
              <span className="block text-sm font-bold text-[#f1f1ee] truncate">
                {business?.name || 'Café La Esquina'}
              </span>
            </div>
          </div>

          {/* Navegación por Secciones: SERVICIO */}
          <div className="text-[11px] font-semibold text-[#a1a1aa] px-4 mt-4 mb-2 uppercase tracking-wider">
            SERVICIO
          </div>
          <nav className="space-y-1">
            {serviceItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`mx-3 px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                    active
                      ? 'bg-[#bec8ff] text-[#0c0c0c] font-semibold'
                      : 'text-[#a1a1aa] hover:text-[#f1f1ee] hover:bg-[#18181b]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Navegación por Secciones: CONFIGURACIÓN */}
          <div className="text-[11px] font-semibold text-[#a1a1aa] px-4 mt-5 mb-2 uppercase tracking-wider">
            CONFIGURACIÓN
          </div>
          <nav className="space-y-1 pb-4">
            {configItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`mx-3 px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                    active
                      ? 'bg-[#bec8ff] text-[#0c0c0c] font-semibold'
                      : 'text-[#a1a1aa] hover:text-[#f1f1ee] hover:bg-[#18181b]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer fijo del Sidebar */}
        <a
          href="https://wa.me/5491100000000"
          target="_blank"
          rel="noopener noreferrer"
          className="border-t border-[#242426] p-4 flex items-center gap-3 hover:bg-[#141416] transition-colors"
        >
          <div className="bg-[#2fb36a]/20 text-[#34d399] p-2.5 rounded-xl shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#f1f1ee] leading-tight">¿Necesitás ayuda?</p>
            <p className="text-[11px] text-[#a1a1aa] truncate mt-0.5">
              Soporte 24/7 por WhatsApp
            </p>
          </div>
        </a>
      </aside>

      {/* 2. ÁREA PRINCIPAL (TOP HEADER + MAIN) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#000000] pb-20 md:pb-10">
        {/* Top Header */}
        <header className="h-16 border-b border-[#242426] bg-[#000000] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm sm:text-base text-[#f1f1ee] truncate">
              {greeting}
            </span>
            <span className="hidden sm:inline text-sm text-[#a1a1aa]">
              · {formattedDate}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label="Cambiar tema"
              title="Cambiar tema"
              className="w-9 h-9 rounded-xl border border-[#242426] bg-[#111113] hover:bg-[#18181b] text-[#a1a1aa] hover:text-[#f1f1ee] flex items-center justify-center transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              to="/caja"
              className="hidden sm:inline-flex border border-[#242426] bg-[#111113] hover:bg-[#18181b] text-[#bec8ff] text-xs font-semibold px-3.5 py-2 rounded-xl items-center gap-2 transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Abrir Caja</span>
            </Link>

            <Link
              to={`/h/${primaryCartelCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[#242426] bg-[#111113] hover:bg-[#18181b] text-[#f1f1ee] text-xs font-medium px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors"
            >
              <span>Ver mi cartel ↗</span>
            </Link>

            <div className="hidden sm:block h-6 w-px bg-[#242426]" />

            <div className="hidden sm:flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#18181b] border border-[#242426] text-[#f1f1ee] text-xs font-bold flex items-center justify-center">
                {userInitial}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-[#f1f1ee] max-w-[160px] truncate">
                  {user?.email || 'comercio@toque.ar'}
                </p>
                <p className="text-[11px] text-[#a1a1aa]">{userRoleLabel}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="w-9 h-9 rounded-xl border border-[#242426] bg-[#111113] hover:bg-[#18181b] text-[#a1a1aa] hover:text-[#f1f1ee] flex items-center justify-center transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto bg-[#000000]">
          <Outlet />
        </main>
      </div>

      {/* 3. NAVEGACIÓN MÓVIL INFERIOR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0c0c0c] border-t border-[#242426] z-30 px-2 py-1.5 flex items-center justify-around">
        {serviceItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl min-w-[56px] text-[10px] font-medium transition-colors ${
                active ? 'text-[#bec8ff] font-semibold' : 'text-[#a1a1aa]'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </NavLink>
          );
        })}
        <NavLink
          to="/panel/equipo"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center p-1.5 rounded-xl min-w-[56px] text-[10px] font-medium transition-colors ${
              isActive ? 'text-[#bec8ff] font-semibold' : 'text-[#a1a1aa]'
            }`
          }
        >
          <Users className="w-4 h-4 mb-0.5" />
          <span>Equipo</span>
        </NavLink>
        <NavLink
          to="/caja"
          className="flex flex-col items-center justify-center p-1.5 rounded-xl min-w-[56px] text-[10px] font-medium text-[#34d399]"
        >
          <CreditCard className="w-4 h-4 mb-0.5" />
          <span>Caja</span>
        </NavLink>
      </nav>
    </div>
  );
};
