import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { UserRole } from '../../api';

interface RoleRouteGuardProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

export function getHomePathForRole(role?: UserRole, isSuperAdmin?: boolean, email?: string): string {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (isSuperAdmin || role === 'superadmin' || cleanEmail === 'fedeeeloiss@gmail.com') {
    return '/admin';
  }
  if (role === 'cashier') {
    return '/panel/tarjetas';
  }
  return '/panel/resumen';
}

export const RoleRouteGuard: React.FC<RoleRouteGuardProps> = ({ allowedRoles, children }) => {
  const { user, isCheckingAuth } = useAuth();
  const location = useLocation();

  if (isCheckingAuth && !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="w-6 h-6 rounded-full border-2 border-[#282830] border-t-[#D95B26] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/ingresar" state={{ from: location.pathname }} replace />;
  }

  const cleanEmail = (user.email || '').trim().toLowerCase();
  const isVerifiedSuperAdmin =
    Boolean(user.isSuperAdmin) ||
    user.role === 'superadmin' ||
    cleanEmail === 'fedeeeloiss@gmail.com';

  if (location.pathname.startsWith('/admin') && !isVerifiedSuperAdmin) {
    return <Navigate to="/panel/resumen" replace />;
  }

  const effectiveRole: UserRole = isVerifiedSuperAdmin ? 'superadmin' : user.role;
  const isAllowed = allowedRoles.includes(effectiveRole);

  if (!isAllowed) {
    const targetHome = getHomePathForRole(user.role, isVerifiedSuperAdmin, user.email);
    return <Navigate to={targetHome} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
