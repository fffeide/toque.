import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
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
      success('¡Bienvenido a Toque!', 'Iniciaste sesión correctamente.');
      navigate('/panel');
    } catch (err) {
      toastError('No pudimos iniciar sesión', err instanceof Error ? err.message : 'Revisá tus datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      await login({ email: 'comercio@toque.ar', isGoogle: true });
      success('Acceso con Google completado', 'Sesión iniciada con éxito.');
      navigate('/panel');
    } catch (err) {
      toastError('Error al conectar con Google', err instanceof Error ? err.message : 'Probá de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#3A3FE0] text-white flex items-center justify-center font-display font-bold text-2xl mx-auto shadow-xs">
            T
          </div>
          <h1 className="font-display font-bold text-2xl text-[#0B1030]">
            Ingresá a tu cuenta
          </h1>
          <p className="text-xs text-[#5E6072]">
            Administrá tus cobros en caja, carteles y comprobantes digitales.
          </p>
        </div>

        <Card padding="lg" className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0B1030] mb-1.5" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@tunegocio.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-sm text-[#0B1030] focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#0B1030]" htmlFor="password">
                  Contraseña
                </label>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-sm text-[#0B1030] focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
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
            <div className="border-t border-[#E3DDD2] w-full" />
            <span className="bg-white px-3 text-[11px] text-[#5E6072] uppercase font-medium absolute">
              o
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full min-h-[48px] px-4 rounded-xl border border-[#E3DDD2] bg-white hover:bg-[#F7F4EE] active:bg-[#EAE4D9] text-xs font-semibold text-[#0B1030] flex items-center justify-center gap-3 transition cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continuar con Google</span>
          </button>
        </Card>

        <p className="text-center text-xs text-[#5E6072]">
          ¿Todavía no tenés cuenta?{' '}
          <Link to="/registro" className="font-semibold text-[#3A3FE0] hover:underline">
            Registrate acá
          </Link>
        </p>
      </div>
    </div>
  );
};
