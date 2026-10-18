/**
 * Toque — Contexto de Autenticación
 * Administra el usuario logueado y el negocio asociado.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, BusinessProfile } from '../api/types';
import { api } from '../api';

interface AuthContextType {
  user: User | null;
  business: BusinessProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password?: string; isGoogle?: boolean }) => Promise<void>;
  register: (data: { businessName: string; ownerName: string; email: string; password?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const u = await api.getCurrentUser();
      setUser(u);
      if (u) {
        const b = await api.getBusinessProfile();
        setBusiness(b);
      } else {
        setBusiness(null);
      }
    } catch {
      setUser(null);
      setBusiness(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (credentials: { email: string; password?: string; isGoogle?: boolean }) => {
    const res = await api.login(credentials);
    setUser(res.user);
    const b = await api.getBusinessProfile();
    setBusiness(b);
  };

  const register = async (data: { businessName: string; ownerName: string; email: string; password?: string }) => {
    const res = await api.register(data);
    setUser(res.user);
    const b = await api.getBusinessProfile();
    setBusiness(b);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
