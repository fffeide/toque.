/**
 * Toque — Layout Principal (AppLayout)
 * Estética Aurora Liquid Glass sobre fondo de tormenta atmosférico (#04121b).
 * - Barra lateral Liquid Glass con pip activo blanco luminoso.
 * - Barra superior con herramientas circulares translúcidas y avatar.
 * - Dock inferior flotante de vidrio en dispositivos móviles.
 * - Banner de demostración y detector sin conexión.
 */

import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  QrCode,
  FileText,
  User as UserIcon,
  Bell,
  LogOut,
  Building2,
  Sparkles,
  WifiOff,
  Share2,
  Users,
  Search,
  Plus,
  Compass,
  Calendar,
  Settings,
  Shield,
  Activity,
  Factory,
  Printer,
  RotateCcw,
  CreditCard,
  Store,
  Globe,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { UserRole } from '../../api/types';
import { Popover } from '../ui/Popover';
import { useToast } from '../ui/Toast';
import { ToqueChatWidget } from '../../features/chat/ToqueChatWidget';

export const AppLayout: React.FC = () => {
  const { user, tenant, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { success } = useToast();
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [panelBg, setPanelBg] = useState<'navy' | 'obsidian' | 'teal'>('navy');

  const isQaSimulating = typeof window !== 'undefined' && sessionStorage.getItem('toque_qa_simulation') === 'true';

  const handleReturnToSuperAdmin = async () => {
    setIsSwitchingRole(true);
    try {
      sessionStorage.removeItem('toque_qa_simulation');
      await switchRole('platform_admin');
      success('Modo Administrador', 'Has vuelto al panel central Super Admin.');
      navigate('/admin');
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('toque_qa_simulation');
      await logout();
      success('Sesión finalizada', 'Has cerrado sesión correctamente.');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const isManufacturer = user?.role === 'manufacturer_admin' || tenant?.type === 'manufacturer';
  const isAdmin = user?.role === 'platform_admin' || tenant?.type === 'platform';
  const isBusiness = !isManufacturer && !isAdmin;

  return (
    <div className={`aurora-stage aurora-bg-${panelBg} min-h-screen text-white flex flex-col relative overflow-x-hidden selection:bg-white/20 selection:text-white`}>
      {/* 1. Aviso de Estado Sin Conexión */}
      {isOffline && (
        <div
          role="status"
          className="bg-rose-500/90 backdrop-blur-md text-white text-xs font-semibold py-2 px-4 text-center flex items-center justify-center gap-2 shadow-sm z-50 sticky top-0"
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>Sin conexión a internet. Mostrando datos disponibles en memoria.</span>
        </div>
      )}



      {/* 3. Estructura Aurora: Sidebar + Header + Área de Contenido */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row max-w-[1536px] w-full mx-auto p-3 sm:p-5 md:p-6 gap-6">
        {/* Barra Lateral Izquierda Desktop (Aurora Sidebar Liquid Glass) */}
        <aside className="hidden md:flex flex-col w-64 py-5 px-3 shrink-0 aurora-sidebar-glass relative my-2 rounded-3xl">
          {/* Logo y Encabezado de la Marca */}
          <div className="px-3 pb-4 mb-2 border-b border-white/10 flex items-center gap-3">
            <NavLink to="/" className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 hover:bg-white/25 transition group shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <path d="M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0" />
                <path d="M2 17c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0" opacity="0.6" />
              </svg>
            </NavLink>
            <div className="min-w-0">
              <span className="font-display font-bold text-white text-base tracking-tight block truncate">
                Toque
              </span>
              <span className="text-[10px] text-white/60 block truncate">
                Tu cartel, con datos
              </span>
            </div>
          </div>

          {/* Badge del Rol y Taller/Comercio */}
          <div className="px-3 py-2 mb-3 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[9px] uppercase tracking-wider text-white/50 font-bold block">
              {isAdmin ? 'Super Admin' : isManufacturer ? 'Taller Fabricante' : 'Local / Comercio'}
            </span>
            <p className="text-xs font-semibold text-white truncate mt-0.5">
              {tenant?.name || user?.name || 'Mi Espacio'}
            </p>
          </div>

          {/* Menú de Navegación Vertical con Todas las Secciones en la Barra Lateral */}
          <nav className="flex flex-col gap-1 w-full overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {isAdmin ? (
              <>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isActive ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Shield className="w-4 h-4 text-purple-300 shrink-0" />
                  <span className="truncate">Panel Super Admin</span>
                </NavLink>

                <NavLink
                  to="/status"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isActive ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Activity className="w-4 h-4 text-blue-300 shrink-0" />
                  <span className="truncate">Estado del Sistema</span>
                </NavLink>

                <NavLink
                  to="/ui"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isActive ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="truncate">Galería UI</span>
                </NavLink>
              </>
            ) : isManufacturer ? (
              <>
                {[
                  { id: 'tablero', label: 'Tablero', icon: LayoutDashboard, path: '/fabricante?tab=tablero' },
                  { id: 'carteles', label: 'Carteles', icon: QrCode, path: '/fabricante?tab=carteles' },
                  { id: 'negocios', label: 'Comercios', icon: Store, path: '/fabricante?tab=negocios' },
                  { id: 'kit_impresion', label: 'Kit de impresión', icon: Printer, path: '/fabricante?tab=kit_impresion' },
                  { id: 'reposiciones', label: 'Reposiciones', icon: RotateCcw, path: '/fabricante?tab=reposiciones' },
                  { id: 'equipo', label: 'Equipo del Taller', icon: Users, path: '/fabricante?tab=equipo' },
                  { id: 'plan_facturacion', label: 'Plan y cupo', icon: CreditCard, path: '/fabricante?tab=plan_facturacion' },
                ].map((item) => {
                  const Icon = item.icon;
                  const currentParams = new URLSearchParams(location.search);
                  const activeTabParam = currentParams.get('tab') || 'tablero';
                  const isActive = location.pathname.startsWith('/fabricante') && activeTabParam === item.id;

                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                        isActive
                          ? 'bg-white text-slate-950 font-bold shadow-md'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </NavLink>
                  );
                })}
              </>
            ) : (
              <>
                <NavLink
                  to="/resumen"
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isActive ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <LayoutDashboard className="w-4 h-4 text-blue-300 shrink-0" />
                    <span className="truncate">Resumen del Salón</span>
                  </div>
                  {location.pathname === '/resumen' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </NavLink>

                <NavLink
                  to="/carteles"
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isActive ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <QrCode className="w-4 h-4 text-indigo-300 shrink-0" />
                    <span className="truncate">Mis Carteles</span>
                  </div>
                  {location.pathname === '/carteles' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </NavLink>

                <NavLink
                  to="/canales"
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isActive ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Share2 className="w-4 h-4 text-cyan-300 shrink-0" />
                    <span className="truncate">Canales de Escaneo</span>
                  </div>
                  {location.pathname === '/canales' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </NavLink>

                <NavLink
                  to="/reportes"
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isActive ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span className="truncate">Reportes Imprimibles</span>
                  </div>
                  {location.pathname === '/reportes' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </NavLink>

                <NavLink
                  to="/equipo"
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isActive ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Users className="w-4 h-4 text-purple-300 shrink-0" />
                    <span className="truncate">Equipo</span>
                  </div>
                  {location.pathname === '/equipo' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </NavLink>

                <NavLink
                  to="/fabricantes"
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isActive ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Factory className="w-4 h-4 text-amber-300 shrink-0" />
                    <span className="truncate">Red de Fabricantes</span>
                  </div>
                  {location.pathname === '/fabricantes' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </NavLink>
              </>
            )}

            <div className="my-2 border-t border-white/10 pt-2" />

            <NavLink
              to="/cuenta"
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isActive ? 'bg-white text-slate-950 font-bold shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <Settings className="w-4 h-4 shrink-0" />
                <span className="truncate">{isManufacturer ? 'Mi Cuenta y Red' : 'Mi Cuenta'}</span>
              </div>
              {location.pathname === '/cuenta' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
            </NavLink>
          </nav>

          {/* Botón de Salir al Fondo */}
          <div className="pt-3 border-t border-white/10 mt-auto">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs text-white/70 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer font-medium"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </aside>

        {/* Contenido Principal con Header Flotante */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Header Superior Aurora Liquid Glass */}
          <header className="flex items-center justify-between py-2 px-1 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                  isManufacturer
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                    : 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                }`}>
                  {isManufacturer ? 'Panel del fabricante' : 'Panel del negocio'}
                </span>
                <span className="text-xs text-white/70 font-normal">
                  {tenant?.name || 'Toque'}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white font-display mt-0.5">
                {user?.name || 'Usuario'}
              </h1>
            </div>

            {/* Perfil y Avatar (La selección de acento de marca se encuentra en /cuenta según especificación) */}
            <div className="flex items-center gap-2.5">
              <NavLink
                to="/cuenta"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white/80 transition"
                title="Configuración de cuenta y colores"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configuración</span>
              </NavLink>

              {/* Avatar Photo Requerido */}
              <Popover
                trigger={
                  <button
                    type="button"
                    aria-label="Perfil"
                    className="flex items-center gap-2 p-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 cursor-pointer transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-400 flex items-center justify-center font-bold text-xs text-white uppercase">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                  </button>
                }
              >
                <div className="p-3 w-56 space-y-2 bg-[rgba(10,18,32,0.96)] border border-white/20 rounded-2xl shadow-xl text-white">
                  <div className="border-b border-white/10 pb-2">
                    <p className="font-semibold text-xs text-white truncate">{user?.name}</p>
                    <p className="text-[10px] text-white/60 truncate">{user?.email}</p>
                    <span className="inline-block mt-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                      {isAdmin ? 'Super Admin' : isManufacturer ? 'Fabricante' : 'Negocio'}
                    </span>
                  </div>
                  <NavLink
                    to="/cuenta"
                    className="flex items-center gap-2 p-2 rounded-xl text-xs text-white/80 hover:text-white hover:bg-white/10 transition"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Mi cuenta</span>
                  </NavLink>
                  {isAdmin && (
                    <NavLink
                      to="/status"
                      className="flex items-center gap-2 p-2 rounded-xl text-xs text-white/80 hover:text-white hover:bg-white/10 transition"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Estado del sistema</span>
                    </NavLink>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/20 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </Popover>
            </div>
          </header>

          {/* Enrutamiento de Vistas (Outlet) */}
          <main className="flex-1 pb-24 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>

      {/* 4. Dock Inferior en Dispositivos Móviles (Mobile Glass Dock) Aislado por Rol */}
      <nav className="md:hidden fixed bottom-3 left-4 right-4 z-40 aurora-card-glass py-3 px-6 flex items-center justify-around shadow-2xl">
        {isAdmin ? (
          <>

            <NavLink
              to="/status"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <Activity className="w-5 h-5 text-blue-300" />
              <span className="text-[10px]">Status</span>
            </NavLink>

            <NavLink
              to="/ui"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span className="text-[10px]">UI</span>
            </NavLink>

            <NavLink
              to="/cuenta"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <UserIcon className="w-5 h-5" />
              <span className="text-[10px]">Cuenta</span>
            </NavLink>
          </>
        ) : isManufacturer ? (
          <>
            <NavLink
              to="/fabricante"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <Building2 className="w-5 h-5 text-amber-300" />
              <span className="text-[10px]">Taller</span>
            </NavLink>

            <NavLink
              to="/cuenta"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <UserIcon className="w-5 h-5" />
              <span className="text-[10px]">Cuenta</span>
            </NavLink>
          </>
        ) : (
          <>
            <NavLink
              to="/resumen"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <LayoutDashboard className="w-5 h-5 text-blue-300" />
              <span className="text-[10px]">Inicio</span>
            </NavLink>

            <NavLink
              to="/carteles"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <QrCode className="w-5 h-5 text-indigo-300" />
              <span className="text-[10px]">Carteles</span>
            </NavLink>

            <NavLink
              to="/reportes"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <FileText className="w-5 h-5 text-emerald-300" />
              <span className="text-[10px]">Reportes</span>
            </NavLink>

            <NavLink
              to="/cuenta"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <UserIcon className="w-5 h-5" />
              <span className="text-[10px]">Cuenta</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Widget de Asistente Chatbot Flotante Toque */}
      <ToqueChatWidget />
    </div>
  );
};

export default AppLayout;
