/**
 * Toque — Contexto de Autenticación
 * - Inicialización sincrónica de `toque_merchant_token` y `toque_merchant_user` desde localStorage en el primer render.
 * - Verificación de `/api/auth/me`: solo limpia la sesión si el servidor responde explícitamente `401`.
 * - En errores de red temporales, mantiene activa la sesión local para no expulsar al usuario al hacer F5.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, BusinessProfile, OtpPurpose } from '../api/types';
import { api } from '../api';

export const MERCHANT_TOKEN_KEY = 'toque_merchant_token';
export const MERCHANT_USER_KEY = 'toque_merchant_user';

interface AuthContextType {
  token: string | null;
  user: User | null;
  business: BusinessProfile | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
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
    extra?: {
      businessName?: string;
      ownerName?: string;
      ownerRole?: 'Dueño/a' | 'Encargado/a' | 'Administración' | 'Otro';
      businessEmail?: string;
      teamSize?: 'Solo yo' | '2 a 5' | '6 a 15' | '16 o más';
      category?: string;
    }
  ) => Promise<User | null>;
  loginWithOtp: (
    email: string,
    code: string,
    extra?: {
      businessName?: string;
      ownerName?: string;
      ownerRole?: 'Dueño/a' | 'Encargado/a' | 'Administración' | 'Otro';
      businessEmail?: string;
      teamSize?: 'Solo yo' | '2 a 5' | '6 a 15' | '16 o más';
      category?: string;
    }
  ) => Promise<User | null>;
  login: (credentials: { email: string; code?: string }) => Promise<void>;
  register: (data: {
    businessName: string;
    ownerName: string;
    email: string;
    ownerRole?: 'Dueño/a' | 'Encargado/a' | 'Administración' | 'Otro';
    businessEmail?: string;
    teamSize?: 'Solo yo' | '2 a 5' | '6 a 15' | '16 o más';
    category?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persistMerchantSession(nextToken: string | null, nextUser: User | null) {
  try {
    if (nextToken && nextUser) {
      localStorage.setItem(MERCHANT_TOKEN_KEY, nextToken);
      localStorage.setItem(MERCHANT_USER_KEY, JSON.stringify(nextUser));
      document.cookie = `toque_merchant_session=${nextToken}; path=/; max-age=31536000; SameSite=Lax`;
    } else {
      localStorage.removeItem(MERCHANT_TOKEN_KEY);
      localStorage.removeItem(MERCHANT_USER_KEY);
      document.cookie = 'toque_merchant_session=; path=/; max-age=0; SameSite=Lax';
    }
  } catch {
    // ignore storage error
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(MERCHANT_TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(MERCHANT_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  const refreshProfile = async () => {
    const savedToken = (() => {
      try {
        return localStorage.getItem(MERCHANT_TOKEN_KEY);
      } catch {
        return token;
      }
    })();

    const savedUser = (() => {
      try {
        const raw = localStorage.getItem(MERCHANT_USER_KEY);
        return raw ? (JSON.parse(raw) as User) : user;
      } catch {
        return user;
      }
    })();

    try {
      // Si hay un token guardado, validamos contra /api/auth/me
      if (savedToken) {
        try {
          const authRes = await fetch('/api/auth/me', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${savedToken}`,
            },
          });

          if (authRes.status === 401) {
            setToken(null);
            setUser(null);
            setBusiness(null);
            persistMerchantSession(null, null);
            setIsCheckingAuth(false);
            return;
          }
        } catch {
          // Error de red temporal: mantener activa la sesión local sin cerrar sesión
        }
      }

      const u = await api.getCurrentUser();
      const effectiveUser = u || savedUser;

      if (effectiveUser) {
        const effectiveToken = savedToken || `sess-${effectiveUser.id}`;
        setToken(effectiveToken);
        setUser(effectiveUser);
        persistMerchantSession(effectiveToken, effectiveUser);
        try {
          const b = await api.getBusinessProfile();
          setBusiness(b);
        } catch {
          // ignore
        }
      } else {
        setToken(null);
        setUser(null);
        setBusiness(null);
      }
    } catch {
      // Si hay error inesperado, conservar la sesión local si existía
      if (savedUser) {
        setUser(savedUser);
      }
    } finally {
      setIsCheckingAuth(false);
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
    extra?: {
      businessName?: string;
      ownerName?: string;
      ownerRole?: 'Dueño/a' | 'Encargado/a' | 'Administración' | 'Otro';
      businessEmail?: string;
      teamSize?: 'Solo yo' | '2 a 5' | '6 a 15' | '16 o más';
      category?: string;
    }
  ): Promise<User | null> => {
    const res = await api.verifyOtp(email, code, extra);
    if (res.user) {
      let nextToken = (res as any).token || `sess-${res.user.id}-${Date.now().toString(36)}`;
      try {
        const serverAuth = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: res.user.email,
            name: res.user.name,
            role: res.user.role,
            businessId: res.user.businessId,
            userId: res.user.id,
          }),
        });
        if (serverAuth.ok) {
          const data = await serverAuth.json();
          if (data?.token) nextToken = data.token;
        }
      } catch {
        // fallback local token
      }

      setToken(nextToken);
      setUser(res.user);
      persistMerchantSession(nextToken, res.user);
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
    let nextToken = res.token || `sess-${res.user.id}-${Date.now().toString(36)}`;
    try {
      const serverAuth = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: res.user.email,
          name: res.user.name,
          role: res.user.role,
          businessId: res.user.businessId,
          userId: res.user.id,
        }),
      });
      if (serverAuth.ok) {
        const data = await serverAuth.json();
        if (data?.token) nextToken = data.token;
      }
    } catch {
      // ignore
    }

    setToken(nextToken);
    setUser(res.user);
    persistMerchantSession(nextToken, res.user);
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
    ownerRole?: 'Dueño/a' | 'Encargado/a' | 'Administración' | 'Otro';
    businessEmail?: string;
    teamSize?: 'Solo yo' | '2 a 5' | '6 a 15' | '16 o más';
    category?: string;
  }) => {
    const res = await api.register(data);
    let nextToken = res.token || `sess-${res.user.id}-${Date.now().toString(36)}`;
    try {
      const serverAuth = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: res.user.email,
          name: res.user.name,
          businessName: data.businessName,
          role: res.user.role,
          businessId: res.user.businessId,
          userId: res.user.id,
        }),
      });
      if (serverAuth.ok) {
        const srv = await serverAuth.json();
        if (srv?.token) nextToken = srv.token;
      }
    } catch {
      // ignore
    }

    setToken(nextToken);
    setUser(res.user);
    persistMerchantSession(nextToken, res.user);
    try {
      const b = await api.getBusinessProfile();
      setBusiness(b);
    } catch {
      // ignore
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      await api.logout();
    } finally {
      setToken(null);
      setUser(null);
      setBusiness(null);
      persistMerchantSession(null, null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        business,
        isAuthenticated: Boolean(user),
        isCheckingAuth,
        isLoading: isCheckingAuth,
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
