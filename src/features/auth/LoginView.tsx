/**
 * Toque — Pantalla de Ingreso (LoginView)
 * Características:
 * - Título claro: Iniciar sesión (para usuarios registrados)
 * - Enlace directo a "Crear cuenta nueva / Registrarse" (/registro)
 * - Redirección según rol:
 *     platform_admin -> /admin
 *     manufacturer_admin -> /fabricante
 *     business_owner / business_staff -> /resumen
 * - Accesos rápidos para probar cada rol con 1 toque.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { BrandLogo } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Mail,
  Lock,
  ArrowRight,
  Store,
  Factory,
  Shield,
  UserPlus,
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

export const LoginView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState(searchParams.get('pass') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegistered = searchParams.get('registered') === '1';

  const { user, isAuthenticated, loginDirect, loginWithCredentials } = useAuth();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  // Redirección si ya está autenticado
  useEffect(() => {
    if (isAuthenticated && user && !isSubmitting) {
      const from = searchParams.get('from');
      if (from) {
        navigate(from, { replace: true });
        return;
      }
      const welcomeSuffix = isRegistered ? '?welcome=1' : '';
      if (user.role === 'platform_admin') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'manufacturer_admin') {
        navigate(`/fabricante${welcomeSuffix}`, { replace: true });
      } else {
        navigate(`/resumen${welcomeSuffix}`, { replace: true });
      }
    }
  }, [isAuthenticated, user, isSubmitting, navigate, searchParams, isRegistered]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      toastError('Datos incompletos', 'Ingresá tu correo o usuario y tu contraseña.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithCredentials(cleanId, cleanPass);
      success('Acceso correcto', `Hola, ${res.user.name}`);
      const welcomeSuffix = isRegistered ? '?welcome=1' : '';
      if (res.user.role === 'platform_admin') {
        navigate('/admin');
      } else if (res.user.role === 'manufacturer_admin') {
        navigate(`/fabricante${welcomeSuffix}`);
      } else {
        navigate(`/resumen${welcomeSuffix}`);
      }
    } catch (err) {
      toastError('No pudimos iniciar sesión', err instanceof Error ? err.message : 'Verificá los datos ingresados');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoAccess = async (role: 'business_owner' | 'manufacturer_admin' | 'platform_admin') => {
    setIsSubmitting(true);
    try {
      const email = role === 'platform_admin' ? 'admin@toque.ar' : role === 'manufacturer_admin' ? 'fabricante@toque.ar' : 'negocio@toque.ar';
      const res = await loginDirect(email, role);
      success('Acceso demo iniciado', `Sesión iniciada como ${res.user.name}`);
      if (role === 'platform_admin') {
        navigate('/admin');
      } else if (role === 'manufacturer_admin') {
        navigate('/fabricante');
      } else {
        navigate('/resumen');
      }
    } catch {
      toastError('Error al iniciar demo', 'Intentá con credenciales');
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
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Iniciar sesión en Toque
          </h1>
          <p className="text-xs text-white/70 max-w-sm mx-auto">
            Ingresá a tu cuenta registrada para gestionar carteles, métricas y reseñas.
          </p>
        </div>

        <Card className="p-6 sm:p-7 space-y-5 border-white/20 bg-[rgba(10,20,36,0.96)] backdrop-blur-2xl shadow-2xl">
          {isRegistered && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-200 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0 animate-pulse" />
              <div>
                <strong className="text-white block font-semibold">¡Registro exitoso!</strong>
                <span>Confirmá tu contraseña para entrar directamente a tu panel oficial.</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1.5">
                Correo electrónico o usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/50">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ejemplo@minegocio.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white/50 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/90 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/50">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white/50 transition"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="w-full justify-center bg-white text-slate-900 hover:bg-slate-100 font-semibold mt-4"
              rightIcon={<ArrowRight className="w-4 h-4 text-slate-900" />}
            >
              Iniciar sesión
            </Button>
          </form>

          {/* Enlace claro para registrarse si es nuevo */}
          <div className="pt-3 border-t border-white/10 text-center space-y-2">
            <p className="text-xs text-white/60">
              ¿No tenés una cuenta en Toque?
            </p>
            <Link
              to="/registro"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Registrate aquí gratis</span>
            </Link>
          </div>

          {/* Accesos rápidos de prueba */}
          <div className="pt-3 border-t border-white/10">
            <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider text-center mb-2">
              Ingreso directo de prueba
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoAccess('business_owner')}
                className="p-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-center transition cursor-pointer"
                title="Acceder como Dueño de Comercio"
              >
                <Store className="w-3.5 h-3.5 text-emerald-300 mx-auto mb-1" />
                <span className="text-[10px] text-emerald-200 font-medium block">Negocio</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoAccess('manufacturer_admin')}
                className="p-2 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/30 text-center transition cursor-pointer"
                title="Acceder como Fabricante"
              >
                <Factory className="w-3.5 h-3.5 text-blue-300 mx-auto mb-1" />
                <span className="text-[10px] text-blue-200 font-medium block">Fabricante</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoAccess('platform_admin')}
                className="p-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/30 text-center transition cursor-pointer"
                title="Acceder como Super Administrador"
              >
                <Shield className="w-3.5 h-3.5 text-purple-300 mx-auto mb-1" />
                <span className="text-[10px] text-purple-200 font-medium block">Admin</span>
              </button>
            </div>
          </div>
        </Card>

        <p className="text-center text-xs text-white/50">
          Toque™ • Más opiniones reales en tu local.
        </p>
      </div>
    </div>
  );
};
