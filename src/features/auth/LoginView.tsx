/**
 * Toque — Pantalla de Ingreso (LoginView)
 * - Inicio de sesión con correo / usuario y contraseña limpios (sin pre-escritura)
 * - Opción de ingreso con Google
 * - Sin SSO y sin accesos a /admin
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
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

export const LoginView: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, isAuthenticated, loginDirect, loginWithCredentials } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success, error: toastError } = useToast();

  // Redirección si ya está autenticado
  useEffect(() => {
    if (isAuthenticated && user && !isSubmitting) {
      const from = searchParams.get('from');
      if (from && !from.startsWith('/admin')) {
        navigate(from, { replace: true });
        return;
      }
      if (user.role === 'manufacturer_admin') {
        navigate('/fabricante', { replace: true });
      } else {
        navigate('/resumen', { replace: true });
      }
    }
  }, [isAuthenticated, user, isSubmitting, navigate, searchParams]);

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
      if (res.user.role === 'manufacturer_admin') {
        navigate('/fabricante');
      } else {
        navigate('/resumen');
      }
    } catch (err) {
      toastError('No pudimos iniciar sesión', err instanceof Error ? err.message : 'Verificá los datos ingresados');
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
            Ingresar a tu cuenta
          </h1>
          <p className="text-xs text-white/70 max-w-sm mx-auto">
            Accedé a tus carteles, métricas y configuración de Toque.
          </p>
        </div>

        <Card className="p-6 sm:p-7 space-y-5 border-white/20 bg-[rgba(10,20,36,0.96)] backdrop-blur-2xl shadow-2xl">
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
        </Card>

        <p className="text-center text-xs text-white/50">
          Toque™ • Más opiniones reales en tu local.
        </p>
      </div>
    </div>
  );
};
