/**
 * Toque — Contexto de Autenticación
 * Administra el usuario logueado y el negocio asociado con hidratación instantánea.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, BusinessProfile } from '../api/types';
import { api } from '../api';

const SESSION_STORAGE_KEY = 'toque_rls_session_v2';

function readCachedUser(): User | null {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as User;
        if (parsed && parsed.id && parsed.id !== 'user-owner-default' && parsed.email) {
          return parsed;
        }
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      window.localStorage.removeItem('toque_firestore_session_v1');
    }
  } catch {
    // ignore
  }
  return null;
}

interface AuthContextType {
  user: User | null;
  business: BusinessProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: {
    email: string;
    password?: string;
    isGoogle?: boolean;
    requirePasswordVerification?: boolean;
  }) => Promise<void>;
  register: (data: { businessName: string; ownerName: string; email: string; password?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialUser = readCachedUser();
  const [user, setUser] = useState<User | null>(initialUser);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshProfile = async () => {
    try {
      const u = await api.getCurrentUser();
      setUser(u);
      if (u) {
        api
          .getBusinessProfile()
          .then((b) => setBusiness(b))
          .catch(() => {});
      } else {
        setBusiness(null);
      }
    } catch {
      // mantener sesión cacheada si hay microcorte de red
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (credentials: {
    email: string;
    password?: string;
    isGoogle?: boolean;
    requirePasswordVerification?: boolean;
  }) => {
    const res = await api.login(credentials);
    setUser(res.user);
    api
      .getBusinessProfile()
      .then((b) => setBusiness(b))
      .catch(() => {});
  };

  const register = async (data: {
    businessName: string;
    ownerName: string;
    email: string;
    password?: string;
  }) => {
    const res = await api.register(data);
    setUser(res.user);
    api
      .getBusinessProfile()
      .then((b) => setBusiness(b))
      .catch(() => {});
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
