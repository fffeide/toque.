/**
 * Toque — Contexto de Autenticación
 * Cumple Regla de Oro 2 y 3:
 * - El frontend NO guarda sesión ni roles en localStorage.
 * - La sesión la informa el servidor (o mockApi en memoria) mediante getCurrentUser().
 * - Sin contraseñas: el ingreso se realiza con código de verificación de 6 dígitos por mail.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, BusinessProfile, OtpPurpose } from '../api/types';
import { api } from '../api';

interface AuthContextType {
  user: User | null;
  business: BusinessProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requestOtp: (
    email: string,
    purpose?: OtpPurpose
  ) => Promise<{
    sent: boolean;
    expiresInSeconds: number;
    resendAvailableInSeconds: number;
    demoHintCode?: string;
  }>;
  verifyOtp: (
    email: string,
    code: string,
    extra?: { businessName?: string; ownerName?: string }
  ) => Promise<User | null>;
  loginWithOtp: (
    email: string,
    code: string,
    extra?: { businessName?: string; ownerName?: string }
  ) => Promise<User | null>;
  login: (credentials: { email: string; code?: string }) => Promise<void>;
  register: (data: { businessName: string; ownerName: string; email: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  const requestOtp = async (email: string, purpose: OtpPurpose = 'login') => {
    return api.requestOtp(email, purpose);
  };

  const verifyOtp = async (
    email: string,
    code: string,
    extra?: { businessName?: string; ownerName?: string }
  ): Promise<User | null> => {
    const res = await api.verifyOtp(email, code, extra);
    if (res.user) {
      setUser(res.user);
      try {
        const b = await api.getBusinessProfile();
        setBusiness(b);
      } catch {
        // ignore
      }
      return res.user;
    }
    return null;
  };

  const login = async (credentials: { email: string; code?: string }) => {
    const res = await api.login(credentials);
    setUser(res.user);
    try {
      const b = await api.getBusinessProfile();
      setBusiness(b);
    } catch {
      // ignore
    }
  };

  const register = async (data: {
    businessName: string;
    ownerName: string;
    email: string;
  }) => {
    const res = await api.register(data);
    setUser(res.user);
    try {
      const b = await api.getBusinessProfile();
      setBusiness(b);
    } catch {
      // ignore
    }
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
        requestOtp,
        verifyOtp,
        loginWithOtp: verifyOtp,
        login,
        register,
        logout,
        refreshProfile,
        refreshSession: refreshProfile,
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
