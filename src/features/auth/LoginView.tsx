import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { api } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      await login({ email, password });
      const currentUser = await api.getCurrentUser();
      success('¡Bienvenido a Toque!', 'Iniciaste sesión correctamente.');
      if (currentUser?.role === 'cashier') {
        navigate('/caja');
      } else {
        navigate('/panel');
      }
    } catch (err) {
      toastError(
        'No pudimos iniciar sesión',
        err instanceof Error ? err.message : 'Revisá tus datos.'
      );
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
      if (currentUser?.role === 'cashier') {
        navigate('/caja');
      } else {
        navigate('/panel');
      }
    } catch (err) {
      toastError(
        'Error al conectar con Google',
        err instanceof Error ? err.message : 'Probá de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5 justify-center">
            <div className="w-10 h-10 rounded-full bg-[#f1f1ee] border border-[#242426] flex items-center justify-center">
              <img src="/assets/logo.svg" alt="" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-bold text-xl text-[#f1f1ee] tracking-tight">toque™</span>
          </Link>
          <h1 className="font-bold text-2xl text-[#f1f1ee] tracking-tight pt-2">
            Ingresá a tu cuenta
          </h1>
          <p className="text-xs text-[#a1a1aa]">
            Accedé a tu panel o terminal de caja según los permisos RLS de tu correo.
          </p>
        </div>

        <Card padding="lg" className="space-y-5 bg-[#111113] border border-[#242426]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1.5"
                htmlFor="email"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@tunegocio.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/60 focus:outline-none focus:border-[#bec8ff]"
              />
            </div>

            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1.5"
                htmlFor="password"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/60 focus:outline-none focus:border-[#bec8ff]"
              />
            </div>

            <Button
              type="submit"
              variant="ultramar"
              fullWidth
              size="touch"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>
          </form>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-[#242426] w-full" />
            <span className="bg-[#111113] px-3 text-[11px] text-[#a1a1aa] uppercase font-medium absolute">
              o
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full min-h-[46px] px-4 rounded-xl border border-[#28282a] bg-[#18181b] hover:bg-[#222226] text-xs font-semibold text-[#f1f1ee] flex items-center justify-center gap-3 transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continuar con Google</span>
          </button>
        </Card>

        <p className="text-center text-xs text-[#a1a1aa]">
          ¿Todavía no tenés cuenta?{' '}
          <Link to="/registro" className="font-semibold text-[#bec8ff] hover:underline">
            Registrate acá
          </Link>
        </p>
      </div>
    </div>
  );
};
