import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  Store,
  User,
  Mail,
  Lock,
} from 'lucide-react';

const PLAN_INFO: Record<
  string,
  { name: string; badge: string; priceText: string; description: string }
> = {
  starter: {
    name: 'Comercio Inicial',
    badge: 'Beta Gratuita',
    priceText: '$0 · Gratis',
    description: '1 Cartel físico NFC + QR y enlace directo a reseñas de Google.',
  },
  pro: {
    name: 'Comercio Pro',
    badge: '30 días de prueba gratis',
    priceText: '$0 hoy · luego $7.899/mes',
    description: 'Módulo Recibo en 3 min, club de fidelidad WalletWallet y reseñas.',
  },
  enterprise: {
    name: 'Multi-Sucursal',
    badge: 'Cadenas y Franquicias',
    priceText: '$0 hoy · luego $14.999/mes',
    description: 'Múltiples cajas, locales centralizados y roles para todo tu equipo.',
  },
};

export const RegisterView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialPlanId = searchParams.get('plan') || 'pro';
  const billingPeriod = searchParams.get('billing') || 'monthly';

  const [selectedPlan, setSelectedPlan] = useState<string>(
    PLAN_INFO[initialPlanId] ? initialPlanId : 'pro'
  );
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('Cafetería / Gastronomía');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, login } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const planData = PLAN_INFO[selectedPlan] || PLAN_INFO.pro;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !ownerName.trim() || !email.trim()) {
      toastError('Completá todos los campos obligatorios');
      return;
    }
    setIsSubmitting(true);
    try {
      await register({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim().toLowerCase(),
        password: password || '123456',
      });
      success(
        '¡Comercio registrado con éxito!',
        `Bienvenido a Toque. Tu cartel CAJA01 para "${businessName.trim()}" ya está activo.`
      );
      navigate('/panel');
    } catch (err) {
      toastError(
        'No pudimos registrar tu cuenta',
        err instanceof Error ? err.message : 'Probá de nuevo en unos momentos.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRegister = async () => {
    setIsSubmitting(true);
    try {
      const generatedBiz = businessName.trim() || 'Mi Comercio';
      const generatedOwner = ownerName.trim() || 'Dueño Toque';
      const googleEmail = email.trim().toLowerCase() || 'comercio@toque.ar';

      await register({
        businessName: generatedBiz,
        ownerName: generatedOwner,
        email: googleEmail,
        password: 'google-oauth-session',
      });
      success('Acceso con Google completado', '¡Tu local fue creado y ya tenés acceso al panel!');
      navigate('/panel');
    } catch (err) {
      // Si el usuario ya existía, intentamos loguearlo
      try {
        await login({ email: email.trim() || 'comercio@toque.ar', isGoogle: true });
        success('¡Bienvenido de vuelta!', 'Sesión iniciada con Google.');
        navigate('/panel');
      } catch {
        toastError('No pudimos completar el registro con Google', 'Probá completando el formulario.');
      }
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
        {/* Cabecera de Marca */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5 justify-center group">
            <div className="w-10 h-10 rounded-full bg-[#f1f1ee] border border-[#242426] flex items-center justify-center transition-transform group-hover:scale-105">
              <img src="/assets/logo.svg" alt="" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-bold text-xl text-[#f1f1ee] tracking-tight">toque™</span>
          </Link>
          <h1 className="font-bold text-2xl sm:text-3xl text-[#f1f1ee] tracking-tight pt-1">
            Creá la cuenta de tu local
          </h1>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            Emití comprobantes de compra digitales en 3 min, sumá clientes a tu club y recibí reseñas directas en Google.
          </p>
        </div>

        {/* Resumen del Plan Seleccionado */}
        <div className="p-3.5 rounded-2xl bg-[#111113] border border-[#242426] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#2fb36a]/15 text-[#34d399] border border-[#2fb36a]/30">
                {planData.badge}
              </span>
              <span className="text-xs font-bold text-[#f1f1ee] truncate">{planData.name}</span>
            </div>
            <p className="text-[11px] text-[#a1a1aa] mt-0.5 truncate">{planData.priceText}</p>
          </div>
          <Link
            to="/precios"
            className="text-[11px] font-semibold text-[#bec8ff] hover:underline shrink-0"
          >
            Cambiar
          </Link>
        </div>

        {/* Formulario Principal de Registro */}
        <Card padding="lg" className="bg-[#111113] border border-[#242426] space-y-4">
          {/* Botón rápido con Google */}
          <button
            type="button"
            onClick={handleGoogleRegister}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl border border-[#28282a] bg-[#18181b] hover:bg-[#202024] hover:border-[#38383c] text-xs font-semibold text-[#f1f1ee] flex items-center justify-center gap-2.5 transition-colors cursor-pointer select-none"
          >
            <i className="fa-brands fa-google text-sm text-[#f1f1ee]" />
            <span>Continuar con Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#242426] w-full" />
            <span className="bg-[#111113] px-2 text-[10px] uppercase font-semibold text-[#a1a1aa] absolute">
              o con tu correo
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1"
                htmlFor="bizName"
              >
                Nombre del comercio o local *
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="bizName"
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ej. Café La Esquina"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/50 focus:outline-none focus:border-[#bec8ff] transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1"
                htmlFor="category"
              >
                Rubro o tipo de negocio
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff] transition-colors"
              >
                <option value="Cafetería / Gastronomía">Cafetería / Gastronomía</option>
                <option value="Restaurante / Bar">Restaurante / Bar</option>
                <option value="Panadería / Confitería">Panadería / Confitería</option>
                <option value="Retail / Indumentaria">Retail / Indumentaria</option>
                <option value="Peluquería / Barbería / Estética">Peluquería / Barbería / Estética</option>
                <option value="Servicios Profesionales">Servicios Profesionales</option>
                <option value="Otro">Otro rubro comercial</option>
              </select>
            </div>

            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1"
                htmlFor="owner"
              >
                Tu nombre y apellido (Dueño) *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="owner"
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/50 focus:outline-none focus:border-[#bec8ff] transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1"
                htmlFor="email"
              >
                Correo electrónico de acceso *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@tunegocio.com"
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
                  placeholder="Mínimo 6 caracteres"
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

            <div className="pt-2">
              <Button
                type="submit"
                variant="ultramar"
                fullWidth
                size="touch"
                isLoading={isSubmitting}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Activar local y entrar al panel
              </Button>
            </div>

            <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-[#a1a1aa]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2fb36a]" />
              <span>30 días beta gratis · Cancelación inmediata sin costo</span>
            </div>
          </form>
        </Card>

        {/* Enlace hacia Login */}
        <p className="text-center text-xs text-[#a1a1aa]">
          ¿Ya tenés una cuenta registrada?{' '}
          <Link to="/login" className="font-semibold text-[#bec8ff] hover:underline">
            Iniciá sesión aquí
          </Link>
        </p>
      </motion.div>
    </div>
  );
};
