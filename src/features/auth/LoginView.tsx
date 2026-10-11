/**
 * Toque — Pantalla de Ingreso Directo, OAuth, SSO y Pruebas (LoginView)
 * - Acceso directo sin demoras por correo
 * - OAuth para todo tipo de paneles (Google, Apple, Microsoft)
 * - SSO Empresarial para el Plan Fábrica (SAML / Okta / Azure AD)
 * - Credenciales de prueba oficiales: @pruebas / ¿ToQuE123!
 * - Accesos rápidos en 1 clic para Negocio, Fabricante y Super Admin
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { BrandLogo } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import {
  Mail,
  ArrowRight,
  Store,
  Factory,
  Shield,
  KeyRound,
  Sparkles,
  Building2,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

export const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [testUser, setTestUser] = useState('@pruebas');
  const [testPassword, setTestPassword] = useState('¿ToQuE123!');
  const [loginMode, setLoginMode] = useState<'direct' | 'test_creds' | 'sso'>('direct');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ssoDomain, setSsoDomain] = useState('');

  const { user, isAuthenticated, loginDirect, loginWithCredentials, switchRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success, error: toastError } = useToast();

  // Redirección canónica si ya existe una sesión activa
  useEffect(() => {
    if (isAuthenticated && user && !isSubmitting) {
      const from = searchParams.get('from');
      if (from) {
        if (user.role === 'platform_admin' && (from.startsWith('/admin') || from === '/status' || from === '/ui')) {
          navigate(from, { replace: true });
          return;
        }
        if (user.role === 'manufacturer_admin' && from.startsWith('/fabricante')) {
          navigate(from, { replace: true });
          return;
        }
        if ((user.role === 'business_owner' || user.role === 'business_staff') &&
            ['/resumen', '/carteles', '/canales', '/reportes', '/equipo', '/cuenta'].some(p => from.startsWith(p))) {
          navigate(from, { replace: true });
          return;
        }
      }

      // Destino por defecto según rol
      if (user.role === 'platform_admin') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'manufacturer_admin') {
        navigate('/fabricante', { replace: true });
      } else {
        navigate('/resumen', { replace: true });
      }
    }
  }, [isAuthenticated, user, isSubmitting, navigate, searchParams]);

  // Ingreso directo con correo (sin envío ni esperas de email)
  const handleDirectEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await loginDirect(email.trim());
      success('Acceso concedido', `Bienvenido, ${res.user.name}`);
      if (res.user.role === 'manufacturer_admin') {
        navigate('/fabricante');
      } else if (res.user.role === 'platform_admin') {
        navigate('/admin');
      } else {
        navigate('/resumen');
      }
    } catch (err) {
      toastError('No se pudo ingresar', err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ingreso con credenciales de prueba: @pruebas / ¿ToQuE123!
  const handleTestCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await loginWithCredentials(testUser, testPassword);
      success('Entorno de Pruebas Activo', 'Ingresaste con credenciales oficiales de Toque QA.');
      navigate('/admin');
    } catch (err) {
      toastError('Credenciales incorrectas', err instanceof Error ? err.message : 'Verificá los datos ingresados');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simulación de OAuth (Google, Apple, Microsoft)
  const handleOAuthLogin = async (provider: 'google' | 'apple' | 'microsoft') => {
    setIsSubmitting(true);
    try {
      const providerEmail = `usuario.${provider}@empresa.com.ar`;
      const res = await loginDirect(providerEmail, 'business_owner');
      success(`Autenticado con ${provider.toUpperCase()}`, 'Ingreso directo mediante proveedor OAuth.');
      navigate('/resumen');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simulación de SSO Empresarial para Plan Fábrica
  const handleSsoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssoDomain.trim()) return;
    setIsSubmitting(true);
    try {
      const ssoEmail = `admin@${ssoDomain.trim().replace(/^https?:\/\//, '')}`;
      const res = await loginDirect(ssoEmail, 'manufacturer_admin');
      success('SSO Fábrica Validado', `Autenticado vía Okta/SAML para ${ssoDomain}`);
      navigate('/fabricante');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Accesos rápidos en 1 clic
  const handleQuickLogin = async (role: 'business_owner' | 'manufacturer_admin' | 'platform_admin') => {
    setIsSubmitting(true);
    try {
      await switchRole(role);
      success('Rol activado', 'Ingreso directo concedido.');
      if (role === 'manufacturer_admin') {
        navigate('/fabricante');
      } else if (role === 'platform_admin') {
        navigate('/admin');
      } else {
        navigate('/resumen');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="aurora-stage min-h-screen flex items-center justify-center p-4 selection:bg-white/20 selection:text-white">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <Link to="/" className="p-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 transition group">
              <BrandLogo showToqueBadge={false} />
            </Link>
          </div>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Tu cartel, con datos.
          </h1>
          <p className="text-xs text-white/70 max-w-sm mx-auto">
            Acceso directo al panel de control sin demoras por correo electrónico.
          </p>
        </div>

        <Card className="p-6 sm:p-7 space-y-5 border-white/20 bg-white/10 backdrop-blur-xl">
          {/* Selector de modo de ingreso */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-black/20 rounded-xl border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setLoginMode('direct')}
              className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                loginMode === 'direct'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Directo
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('test_creds')}
              className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                loginMode === 'test_creds'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>@pruebas</span>
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('sso')}
              className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                loginMode === 'sso'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              SSO Fábrica
            </button>
          </div>

          {/* MODO 1: INGRESO DIRECTO POR CORREO */}
          {loginMode === 'direct' && (
            <form onSubmit={handleDirectEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/50">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dueño@minegocio.com.ar"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/25 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white/50 transition"
                  />
                </div>
                <p className="text-[11px] text-white/60 mt-1">
                  Acceso directo e instantáneo al panel (sin requerir links por mail).
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="w-full justify-center bg-white text-slate-900 hover:bg-slate-100 font-semibold"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Ingresar directamente al panel
              </Button>

              {/* Botones OAuth */}
              <div className="pt-2">
                <div className="relative mb-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                    <span className="bg-transparent px-2 text-white/60 font-medium">
                      O continuar con OAuth
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('google')}
                    className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white flex items-center justify-center gap-1.5 transition cursor-pointer font-medium"
                    title="Ingresar con Google"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.4 7.5 23 12 23z"
                      />
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('apple')}
                    className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white flex items-center justify-center gap-1.5 transition cursor-pointer font-medium"
                    title="Ingresar con Apple"
                  >
                    <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.66-.8 1.11-1.92.99-3.04-.96.04-2.13.64-2.82 1.44-.61.7-.82 1.83-1.01 2.96 1.08.08 2.18-.56 2.84-1.36z" />
                    </svg>
                    <span>Apple</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('microsoft')}
                    className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white flex items-center justify-center gap-1.5 transition cursor-pointer font-medium"
                    title="Ingresar con Microsoft"
                  >
                    <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5 shrink-0">
                      <div className="bg-[#f25022]" />
                      <div className="bg-[#7fba00]" />
                      <div className="bg-[#00a4ef]" />
                      <div className="bg-[#ffb900]" />
                    </div>
                    <span>Microsoft</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* MODO 2: CREDENCIALES OFICIALES DE PRUEBA (@pruebas / ¿ToQuE123!) */}
          {loginMode === 'test_creds' && (
            <form onSubmit={handleTestCredentialsLogin} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-xs text-amber-200">
                <strong>Credenciales de prueba requeridas:</strong> Permite ingresar al entorno completo de QA, Super Admin y simuladores de Toque.
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Usuario de prueba
                </label>
                <input
                  type="text"
                  required
                  value={testUser}
                  onChange={(e) => setTestUser(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/25 border border-white/20 text-white font-mono text-sm focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Contraseña
                </label>
                <input
                  type="text"
                  required
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/25 border border-white/20 text-white font-mono text-sm focus:outline-none focus:border-white"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="w-full justify-center bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Ingresar al Entorno de Pruebas Toque
              </Button>
            </form>
          )}

          {/* MODO 3: SSO PLAN FÁBRICA */}
          {loginMode === 'sso' && (
            <form onSubmit={handleSsoLogin} className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-400/30 text-xs text-blue-200">
                <strong>SSO Empresarial (Plan Fábrica):</strong> Inicio de sesión único federado vía Okta, Microsoft Azure AD o SAML 2.0.
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Dominio corporativo
                </label>
                <input
                  type="text"
                  required
                  value={ssoDomain}
                  onChange={(e) => setSsoDomain(e.target.value)}
                  placeholder="carteleria-central.com.ar"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/25 border border-white/20 text-white text-sm focus:outline-none focus:border-white"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="w-full justify-center bg-white text-slate-900 font-semibold"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Conectar mediante SSO
              </Button>
            </form>
          )}

          {/* ACCESOS RÁPIDOS DEMO EN 1 CLIC */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <span className="text-[11px] text-white/60 font-semibold block uppercase tracking-wider">
              O evaluá los paneles en 1 clic:
            </span>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('business_owner')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Panel de Negocio (Café La Esquina)
                    </p>
                    <p className="text-[10px] text-white/60">
                      Métricas, carteles activos y reseñas
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('manufacturer_admin')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    <Factory className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Panel de Fabricante (Cartelería Demo)
                    </p>
                    <p className="text-[10px] text-white/60">
                      12 comercios, kit de impresión y marca blanca
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('platform_admin')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Panel Super Admin Toque
                    </p>
                    <p className="text-[10px] text-white/60">
                      Métricas de negocio, recaudación y salud
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </Card>

        <p className="text-center text-xs text-white/50">
          Toque SaaS • Más reseñas, menos laburo.
        </p>
      </div>
    </div>
  );
};
