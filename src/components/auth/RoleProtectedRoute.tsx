/**
 * Toque — Componente Guardián de Acceso por Rol (RoleProtectedRoute)
 * Garantiza el desacoplamiento total entre paneles:
 * - Si no está autenticado, redirige a /login
 * - Si el rol no pertenece a allowedRoles, redirige a su panel canónico:
 *     platform_admin -> /admin
 *     manufacturer_admin -> /fabricante
 *     business_owner / business_staff -> /resumen
 */

import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { UserRole } from '../../api/types';

interface RoleProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles: UserRole[];
}

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070d18] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-white/20 border-t-blue-400 animate-spin" />
          <span className="text-xs font-mono text-white/60 tracking-wide">
            Verificando credenciales de acceso...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirigir según el rol del usuario para evitar pantallas mixtas
    if (user.role === 'platform_admin') {
      return <Navigate to="/admin" replace />;
    }
    if (user.role === 'manufacturer_admin') {
      return <Navigate to="/fabricante" replace />;
    }
    return <Navigate to="/resumen" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default RoleProtectedRoute;
