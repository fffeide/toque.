import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useFeature } from '../../lib/features';
import { useAuth } from '../../lib/authContext';
import { Home, ReceiptText, Grid3X3, UtensilsCrossed, MoreHorizontal, AlertCircle } from 'lucide-react';

export const MenuPanelLayout: React.FC = () => {
  const hasMenuFeature = useFeature('menu');
  const { business } = useAuth();

  if (!hasMenuFeature) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="bg-[#141418] border border-[#282830] rounded-2xl p-8 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-[#F4F4F6]">
            Esta función todavía no está disponible para tu comercio.
          </h2>
          <p className="text-sm text-[#9E9EA8]">
            Toque Carta te permite tener carta digital con código QR por mesa, pedidos y comandas en vivo. Podés solicitar su activación con el equipo de soporte.
          </p>
        </div>
      </div>
    );
  }

  const navItems = [
    { to: '/panel/carta', end: true, label: 'Inicio', icon: Home },
    { to: '/panel/carta/comandas', end: false, label: 'Comandas', icon: ReceiptText },
    { to: '/panel/carta/mesas', end: false, label: 'Mesas', icon: Grid3X3 },
    { to: '/panel/carta/platos', end: false, label: 'Carta', icon: UtensilsCrossed },
    { to: '/panel/carta/mas', end: false, label: 'Más', icon: MoreHorizontal },
  ];

  return (
    <div className="pb-24 pt-2">
      {/* Encabezado secundario sutil */}
      <div className="flex items-center justify-between border-b border-[#282830] pb-3 mb-6">
        <div>
          <span className="text-xs text-[#9E9EA8]">Módulo gastronómico</span>
          <h1 className="text-xl font-semibold text-[#F4F4F6] tracking-tight">
            Carta digital y comandas
          </h1>
        </div>
        {business?.name && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#18181D] border border-[#282830] text-[#9E9EA8]">
            {business.name}
          </span>
        )}
      </div>

      {/* Contenido de la solapa activa */}
      <Outlet />

      {/* Barra de navegación inferior móvil y desktop fijada al viewport */}
      <nav aria-label="Navegación de Carta" className="fixed bottom-0 left-0 right-0 z-40 bg-[#0C0C0E]/95 backdrop-blur-md border-t border-[#282830] px-3 py-2">
        <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'text-white bg-[#1A1A22]'
                      : 'text-[#9E9EA8] hover:text-[#F4F4F6] hover:bg-[#141418]'
                  }`
                }
              >
                <Icon className="w-5 h-5 mb-1 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
