import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { UserRole } from '../../api';
import { Skeleton } from '../ui/Skeleton';

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
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] flex items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-4">
          <Skeleton className="h-10 w-44 mx-auto rounded-xl bg-[#141418]" />
          <Skeleton className="h-44 w-full rounded-2xl bg-[#141418]" />
        </div>
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

  // Blindaje estricto para /admin: solo fedeeeloiss@gmail.com o miembros de toque_admins
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
