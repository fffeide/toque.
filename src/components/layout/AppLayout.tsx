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

  const isManufacturer = user?.role === 'manufacturer_admin';
  const isAdmin = user?.role === 'platform_admin';
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

      {/* 2. Banner de Simulación QA (Exclusivo cuando @pruebas está auditando otros roles desde el Admin) */}
      {isQaSimulating && (
        <div className="relative z-20 bg-amber-500/20 backdrop-blur-md text-amber-200 text-xs px-4 sm:px-6 py-2 border-b border-amber-400/30 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold text-white">
              🧪 Modo Simulación QA (@pruebas)
            </span>
            <span className="text-amber-200/80 hidden sm:inline">
              • Auditando experiencia como {isManufacturer ? 'Fabricante' : 'Negocio'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSwitchingRole}
              onClick={handleReturnToSuperAdmin}
              className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition cursor-pointer shadow-xs"
            >
              Volver a Super Admin (/admin)
            </button>
          </div>
        </div>
      )}

      {/* 3. Estructura Aurora: Sidebar + Header + Área de Contenido */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row max-w-[1536px] w-full mx-auto p-3 sm:p-5 md:p-6 gap-6">
        {/* Barra Lateral Izquierda Desktop (Aurora Sidebar Liquid Glass) */}
        <aside className="hidden md:flex flex-col items-center w-20 py-6 px-3 shrink-0 aurora-sidebar-glass relative my-2">
          {/* Logo SVG con ondas de la marca */}
          <NavLink to="/" className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20 hover:bg-white/25 transition group mb-10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0" />
              <path d="M2 17c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0" opacity="0.6" />
            </svg>
          </NavLink>

          {/* Menú de Navegación Vertical Aislado por Rol */}
          <nav className="flex flex-col items-center gap-6 w-full">
            {isAdmin ? (
              <>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `relative p-2.5 rounded-xl transition ${
                      isActive ? 'text-white bg-white/20' : 'text-white/60 hover:text-white'
                    }`
                  }
                  title="Panel Super Admin"
                >
                  {location.pathname.startsWith('/admin') && (
                    <span className="aurora-pip -left-3 top-1" />
                  )}
                  <Shield className="w-5 h-5 text-emerald-300" />
                </NavLink>

                <NavLink
                  to="/status"
                  className={({ isActive }) =>
                    `relative p-2.5 rounded-xl transition ${
                      isActive ? 'text-white bg-white/20' : 'text-white/60 hover:text-white'
                    }`
                  }
                  title="Estado del Sistema"
                >
                  {location.pathname === '/status' && (
                    <span className="aurora-pip -left-3 top-1" />
                  )}
                  <Activity className="w-5 h-5 text-blue-300" />
                </NavLink>

                <NavLink
                  to="/ui"
                  className={({ isActive }) =>
                    `relative p-2.5 rounded-xl transition ${
                      isActive ? 'text-white bg-white/20' : 'text-white/60 hover:text-white'
                    }`
                  }
                  title="Galería UI (/ui)"
                >
                  {location.pathname === '/ui' && (
                    <span className="aurora-pip -left-3 top-1" />
                  )}
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </NavLink>
              </>
            ) : isManufacturer ? (
              <>
                <NavLink
                  to="/fabricante"
                  className={({ isActive }) =>
                    `relative p-2.5 rounded-xl transition ${
                      isActive ? 'text-white bg-white/20' : 'text-white/60 hover:text-white'
                    }`
                  }
                  title="Panel de Fabricante"
                >
                  {location.pathname.startsWith('/fabricante') && (
                    <span className="aurora-pip -left-3 top-1" />
                  )}
                  <Building2 className="w-5 h-5 text-amber-300" />
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to="/resumen"
                  className={({ isActive }) =>
                    `relative p-2.5 rounded-xl transition ${
                      isActive ? 'text-white bg-white/20' : 'text-white/60 hover:text-white'
                    }`
                  }
                  title="Resumen del Salón"
                >
                  {location.pathname === '/resumen' && (
                    <span className="aurora-pip -left-3 top-1" />
                  )}
                  <LayoutDashboard className="w-5 h-5 text-blue-300" />
                </NavLink>

                <NavLink
                  to="/carteles"
                  className={({ isActive }) =>
                    `relative p-2.5 rounded-xl transition ${
                      isActive ? 'text-white bg-white/20' : 'text-white/60 hover:text-white'
                    }`
                  }
                  title="Mis Carteles"
                >
                  {location.pathname === '/carteles' && (
                    <span className="aurora-pip -left-3 top-1" />
                  )}
                  <QrCode className="w-5 h-5 text-indigo-300" />
                </NavLink>

                <NavLink
                  to="/canales"
                  className={({ isActive }) =>
                    `relative p-2.5 rounded-xl transition ${
                      isActive ? 'text-white bg-white/20' : 'text-white/60 hover:text-white'
                    }`
                  }
                  title="Canales de Escaneo"
                >
                  {location.pathname === '/canales' && (
                    <span className="aurora-pip -left-3 top-1" />
                  )}
                  <Share2 className="w-5 h-5 text-cyan-300" />
                </NavLink>

                <NavLink
                  to="/reportes"
                  className={({ isActive }) =>
                    `relative p-2.5 rounded-xl transition ${
                      isActive ? 'text-white bg-white/20' : 'text-white/60 hover:text-white'
                    }`
                  }
                  title="Reportes Imprimibles"
                >
                  {location.pathname === '/reportes' && (
                    <span className="aurora-pip -left-3 top-1" />
                  )}
                  <FileText className="w-5 h-5 text-emerald-300" />
                </NavLink>

                <NavLink
                  to="/equipo"
                  className={({ isActive }) =>
                    `relative p-2.5 rounded-xl transition ${
                      isActive ? 'text-white bg-white/20' : 'text-white/60 hover:text-white'
                    }`
                  }
                  title="Equipo"
                >
                  {location.pathname === '/equipo' && (
                    <span className="aurora-pip -left-3 top-1" />
                  )}
                  <Users className="w-5 h-5 text-purple-300" />
                </NavLink>
              </>
            )}

            <NavLink
              to="/cuenta"
              className={({ isActive }) =>
                `relative p-2.5 rounded-xl transition ${
                  isActive ? 'text-white bg-white/20' : 'text-white/60 hover:text-white'
                }`
              }
              title="Mi Cuenta y Preferencias"
            >
              {location.pathname === '/cuenta' && (
                <span className="aurora-pip -left-3 top-1" />
              )}
              <Settings className="w-5 h-5" />
            </NavLink>
          </nav>

          {/* Botón de Salir al Fondo */}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto p-2.5 text-white/60 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </aside>

        {/* Contenido Principal con Header Flotante */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Header Superior Aurora Liquid Glass */}
          <header className="flex items-center justify-between py-2 px-1 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isAdmin
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : isManufacturer
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                }`}>
                  {isAdmin
                    ? 'Super Admin Toque'
                    : isManufacturer
                    ? 'Panel Fabricante'
                    : 'Panel Negocio'}
                </span>
                <span className="text-xs text-white/60 font-medium">
                  {tenant?.name || 'Toque'}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white font-headline mt-0.5">
                {user?.name || 'Usuario'}
              </h1>
            </div>

            {/* Herramientas Circulares de Vidrio y Selector de Fondo */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Acceso a Status en Vivo */}
              {/* Acceso a Status en Vivo (Exclusivo Super Admin) */}
              {isAdmin && (
                <NavLink
                  to="/status"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white transition font-medium"
                  title="Monitoreo y Estado en Vivo"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Status</span>
                </NavLink>
              )}

              {isAdmin && (
                <NavLink
                  to="/admin"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-xs text-emerald-200 transition font-medium"
                  title="Super Admin Toque"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </NavLink>
              )}

              {/* Selector de Fondo Predeterminado Líquido */}
              <div className="hidden sm:inline-flex rounded-full bg-white/10 p-0.5 border border-white/15 backdrop-blur-md items-center">
                <button
                  type="button"
                  onClick={() => setPanelBg('navy')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                    panelBg === 'navy'
                      ? 'bg-[rgba(30,50,90,0.9)] text-white shadow-xs border border-white/20'
                      : 'text-white/70 hover:text-white'
                  }`}
                  title="Fondo Líquido Azul RIVR"
                >
                  Azul RIVR
                </button>
                <button
                  type="button"
                  onClick={() => setPanelBg('obsidian')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                    panelBg === 'obsidian'
                      ? 'bg-white/25 text-white shadow-xs border border-white/20'
                      : 'text-white/70 hover:text-white'
                  }`}
                  title="Fondo Obsidiana Minimal"
                >
                  Obsidiana
                </button>
                <button
                  type="button"
                  onClick={() => setPanelBg('teal')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                    panelBg === 'teal'
                      ? 'bg-teal-900/70 text-white shadow-xs border border-white/20'
                      : 'text-white/70 hover:text-white'
                  }`}
                  title="Fondo Aurora Teal"
                >
                  Teal
                </button>
              </div>

              {/* Acceso a Nuevo Cartel (Exclusivo Negocio) */}
              {isBusiness && (
                <NavLink
                  to="/carteles"
                  className="w-10 h-10 rounded-full aurora-tool-btn flex items-center justify-center cursor-pointer"
                  title="Nuevo cartel"
                >
                  <Plus className="w-4 h-4 text-white" />
                </NavLink>
              )}

              {/* Galería UI (Exclusivo Super Admin) */}
              {isAdmin && (
                <NavLink
                  to="/ui"
                  className="w-10 h-10 rounded-full aurora-tool-btn flex items-center justify-center cursor-pointer"
                  title="Galería UI"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </NavLink>
              )}

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
              to="/admin"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 ${
                  isActive ? 'text-white' : 'text-white/60'
                }`
              }
            >
              <Shield className="w-5 h-5 text-emerald-300" />
              <span className="text-[10px]">Admin</span>
            </NavLink>

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
