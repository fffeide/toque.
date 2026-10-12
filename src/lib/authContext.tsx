/**
 * Toque — Proveedor de Autenticación y Tenant (AuthContext)
 * Manejo de sesión en memoria, enlace mágico y selector de rol de prueba.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, Tenant, UserRole } from '../api/types';
import { api } from '../api';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithMagicLink: (email: string) => Promise<{ simulatedLink?: string }>;
  verifyToken: (token: string) => Promise<void>;
  loginDirect: (email: string, role?: UserRole) => Promise<{ user: User; tenant: Tenant }>;
  loginWithCredentials: (username: string, pass: string) => Promise<{ user: User; tenant: Tenant }>;
  registerUser: (data: {
    name: string;
    email: string;
    password?: string;
    whatsapp: string;
    activity: 'fabricante' | 'negocio';
    volume: string;
    plan?: string;
  }) => Promise<{ user: User; tenant: Tenant }>;
  updateTenantState: (patch: Partial<Tenant>) => void;
  markUserOnboarded: (userId?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const current = await api.getCurrentUser();
      if (current) {
        setUser(current.user);
        setTenant(current.tenant);
      }
    } catch {
      setUser(null);
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const loginWithMagicLink = async (email: string) => {
    const res = await api.requestMagicLink(email);
    return { simulatedLink: res.simulatedLink };
  };

  const verifyToken = async (token: string) => {
    setIsLoading(true);
    try {
      const result = await api.verifyMagicLink(token);
      setUser(result.user);
      setTenant(result.tenant);
    } finally {
      setIsLoading(false);
    }
  };

  const loginDirect = async (email: string, role?: UserRole) => {
    setIsLoading(true);
    try {
      const res = await api.loginDirect(email, role);
      setUser(res.user);
      setTenant(res.tenant);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithCredentials = async (username: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await api.loginWithCredentials(username, pass);
      setUser(res.user);
      setTenant(res.tenant);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const markUserOnboarded = async (userId?: string) => {
    const idToMark = userId || user?.id;
    if (!idToMark) return;
    try {
      const updatedUser = await api.markUserOnboarded(idToMark);
      setUser(updatedUser);
    } catch {
      // fallback local
      if (user) {
        setUser({ ...user, hasSeenOnboarding: true });
      }
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
      setUser(null);
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = async (role: UserRole) => {
    setIsLoading(true);
    try {
      const res = await api.switchDemoRole(role);
      setUser(res.user);
      setTenant(res.tenant);
    } finally {
      setIsLoading(false);
    }
  };

  const registerUser = async (data: {
    name: string;
    email: string;
    password?: string;
    whatsapp: string;
    activity: 'fabricante' | 'negocio';
    volume: string;
    plan?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await api.registerUser(data);
      setUser(res.user);
      setTenant(res.tenant);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTenantState = (patch: Partial<Tenant>) => {
    if (tenant) {
      setTenant({ ...tenant, ...patch });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isLoading,
        isAuthenticated: !!user,
        loginWithMagicLink,
        verifyToken,
        loginDirect,
        loginWithCredentials,
        registerUser,
        updateTenantState,
        markUserOnboarded,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  return context;
};
