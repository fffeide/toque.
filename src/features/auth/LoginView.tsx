import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../lib/authContext';
import { api } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { getHomePathForRole } from '../../components/auth/RoleRouteGuard';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';

export const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toastError('Completá tu correo electrónico');
      return;
    }
    setIsSubmitting(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      const currentUser = await api.getCurrentUser();
      success('¡Bienvenido a Toque!', 'Iniciaste sesión correctamente.');
      navigate(getHomePathForRole(currentUser?.role, currentUser?.isSuperAdmin));
    } catch (err) {
      toastError(
        'No pudimos iniciar sesión',
        err instanceof Error ? err.message : 'Revisá tus credenciales e intentalo de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, roleName: string) => {
    setEmail(demoEmail);
    setPassword('demo123');
    setIsSubmitting(true);
    try {
      await login({ email: demoEmail, password: 'demo123' });
      const currentUser = await api.getCurrentUser();
      success(`Acceso como ${roleName}`, `Ingresaste a tu panel exclusivo de ${roleName}.`);
      navigate(getHomePathForRole(currentUser?.role, currentUser?.isSuperAdmin));
    } catch (err) {
      toastError('Error al iniciar sesión', err instanceof Error ? err.message : '');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      await login({ email: email.trim() || 'comercio@toque.ar', isGoogle: true });
      const currentUser = await api.getCurrentUser();
      success('Acceso con Google completado', 'Sesión iniciada con éxito.');
      navigate(getHomePathForRole(currentUser?.role, currentUser?.isSuperAdmin));
    } catch (err) {
      toastError(
        'Error al conectar con Google',
        err instanceof Error ? err.message : 'Probá completando con tu correo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-[#bec8ff] selection:text-[#0c0c0c]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-md w-full space-y-5"
      >
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5 justify-center group">
            <div className="w-10 h-10 rounded-full bg-[#f1f1ee] border border-[#242426] flex items-center justify-center transition-transform group-hover:scale-105">
              <img src="/assets/logo.svg" alt="" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-bold text-xl text-[#f1f1ee] tracking-tight">toque™</span>
          </Link>
          <h1 className="font-bold text-2xl sm:text-3xl text-[#f1f1ee] tracking-tight pt-1">
            Ingresá a tu cuenta
          </h1>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            Cada usuario ingresa exclusivamente al panel asignado según su nivel.
          </p>
        </div>

        <Card padding="lg" className="space-y-4 bg-[#111113] border border-[#242426]">
          {/* Selección de Nivel / Acceso Rápido */}
          <div>
            <span className="block text-[10px] uppercase font-bold text-[#a1a1aa] tracking-wider mb-2">
              Elegí tu nivel de acceso para ingresar:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('demo@toque.ar', 'Dueño')}
                className="p-2.5 rounded-xl border border-[#28282a] bg-[#18181b] hover:bg-[#222226] hover:border-[#bec8ff] text-left transition-colors cursor-pointer"
              >
                <span className="block text-xs font-bold text-[#f1f1ee]">☕ Dueño</span>
                <span className="block text-[10px] text-[#a1a1aa] truncate">
                  Panel completo del local
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('encargado@toque.ar', 'Encargado')}
                className="p-2.5 rounded-xl border border-[#28282a] bg-[#18181b] hover:bg-[#222226] hover:border-[#2fb36a] text-left transition-colors cursor-pointer"
              >
                <span className="block text-xs font-bold text-[#2fb36a]">📋 Encargado</span>
                <span className="block text-[10px] text-[#a1a1aa] truncate">
                  Operación y carteles
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('caja@toque.ar', 'Cajero')}
                className="p-2.5 rounded-xl border border-[#28282a] bg-[#18181b] hover:bg-[#222226] hover:border-[#2fb36a] text-left transition-colors cursor-pointer"
              >
                <span className="block text-xs font-bold text-[#34d399]">💵 Cajero</span>
                <span className="block text-[10px] text-[#a1a1aa] truncate">
                  Exclusivo Terminal Caja
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin@toque.ar', 'Super Admin')}
                className="p-2.5 rounded-xl border border-[#28282a] bg-[#18181b] hover:bg-[#222226] hover:border-[#bec8ff] text-left transition-colors cursor-pointer"
              >
                <span className="block text-xs font-bold text-[#bec8ff]">🛡️ Super Admin</span>
                <span className="block text-[10px] text-[#a1a1aa] truncate">
                  Panel Global Plataforma
                </span>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-[#242426] w-full" />
            <span className="bg-[#111113] px-2 text-[10px] uppercase font-semibold text-[#a1a1aa] absolute">
              o con tus credenciales
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1"
                htmlFor="email"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@tunegocio.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/50 focus:outline-none focus:border-[#bec8ff] transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1"
                htmlFor="password"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/50 focus:outline-none focus:border-[#bec8ff] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
                  aria-label="Ver u ocultar contraseña"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="ultramar"
              fullWidth
              size="touch"
              isLoading={isSubmitting}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Iniciar sesión
            </Button>
          </form>

          {/* Botón Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl border border-[#28282a] bg-[#18181b] hover:bg-[#202024] hover:border-[#38383c] text-xs font-semibold text-[#f1f1ee] flex items-center justify-center gap-2.5 transition-colors cursor-pointer select-none"
          >
            <i className="fa-brands fa-google text-sm text-[#f1f1ee]" />
            <span>Continuar con Google</span>
          </button>
        </Card>

        <p className="text-center text-xs text-[#a1a1aa]">
          ¿Todavía no tenés un cartel para tu local?{' '}
          <Link to="/registro" className="font-semibold text-[#bec8ff] hover:underline">
            Creá tu cuenta gratis aquí
          </Link>
        </p>
      </motion.div>
    </div>
  );
};
