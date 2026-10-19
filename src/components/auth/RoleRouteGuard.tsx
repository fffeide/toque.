import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { UserRole } from '../../api';
import { Skeleton } from '../ui/Skeleton';

interface RoleRouteGuardProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

export function getHomePathForRole(role?: UserRole, isSuperAdmin?: boolean): string {
  if (isSuperAdmin || role === 'superadmin') {
    return '/admin';
  }
  if (role === 'cashier') {
    return '/panel/resumen';
  }
  return '/panel';
}

export const RoleRouteGuard: React.FC<RoleRouteGuardProps> = ({ allowedRoles, children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-4">
          <Skeleton className="h-10 w-44 mx-auto rounded-xl bg-[#111113]" />
          <Skeleton className="h-44 w-full rounded-2xl bg-[#111113]" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const effectiveRole: UserRole = user.isSuperAdmin ? 'superadmin' : user.role;
  const isAllowed = allowedRoles.includes(effectiveRole);

  if (!isAllowed) {
    const targetHome = getHomePathForRole(user.role, user.isSuperAdmin);
    return <Navigate to={targetHome} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
