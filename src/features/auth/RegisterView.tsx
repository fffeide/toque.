/**
 * Toque — Registro Multi-Paso Animado (RegisterView)
 * Cumple con los requisitos estrictos:
 * 1. Campos obligatorios: Nombre y apellido, Mail, Contraseña, WhatsApp.
 * 2. Actividad exacta: "Soy fabricante" o "Soy dueño" (sin textos largos).
 * 3. Pregunta de volumen dependiente de la actividad elegida.
 * 4. Pasos animados con motion.
 * 5. Sin posiciones falsas #48, sin "cargar otro contacto".
 * 6. Redirección automática inmediata al panel correcto según rol (/fabricante o /resumen).
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/authContext';
import { BrandLogo } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import {
  User,
  Mail,
  Lock,
  Phone,
  ArrowRight,
  ArrowLeft,
  Factory,
  Store,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

type ActivityType = 'fabricante' | 'negocio';

export const RegisterView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { registerUser, loginDirect } = useAuth();
  const { success, error: toastError } = useToast();

  const planFromQuery = searchParams.get('plan') || undefined;
  const initialType: ActivityType = searchParams.get('tipo') === 'fabricante' ? 'fabricante' : 'negocio';

  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [activity, setActivity] = useState<ActivityType>(initialType);
  const [volume, setVolume] = useState('11-50');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Errores paso 1
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Ingresá tu nombre y apellido.';
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Ingresá un correo electrónico válido.';
    if (!password.trim() || password.length < 6) errs.password = 'La contraseña debe tener al menos 6 caracteres.';
    if (!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 8) errs.whatsapp = 'Ingresá un WhatsApp con código de área (ej. 11 5263-8900).';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextFromStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleCompleteRegistration = async () => {
    setIsSubmitting(true);
    try {
      const res = await registerUser({
        name,
        email,
        password,
        whatsapp,
        activity,
        volume,
        plan: planFromQuery,
      });

      success(
        '¡Cuenta creada con éxito!',
        `Bienvenido a Toque, ${res.user.name}. Ingresando a tu panel...`
      );

      // Redirección inmediata al panel correspondiente según lo elegido
      if (activity === 'fabricante') {
        navigate('/fabricante', { replace: true });
      } else {
        navigate('/resumen', { replace: true });
      }
    } catch (err) {
      toastError(
        'No pudimos completar el registro',
        err instanceof Error ? err.message : 'Error inesperado al crear la cuenta'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleOAuthSimulated = async () => {
    setIsSubmitting(true);
    try {
      const demoEmail = email.trim() || `usuario.${Date.now().toString().slice(-4)}@gmail.com`;
      const demoName = name.trim() || 'Usuario Google';
      const res = await registerUser({
        name: demoName,
        email: demoEmail,
        password: 'oauth_authenticated_session',
        whatsapp: whatsapp.trim() || '+54 9 11 5263-8900',
        activity,
        volume,
        plan: planFromQuery,
      });
      success('Acceso con Google completado', `Hola, ${res.user.name}`);
      if (activity === 'fabricante') {
        navigate('/fabricante', { replace: true });
      } else {
        navigate('/resumen', { replace: true });
      }
    } catch (err) {
      toastError('Error al iniciar con Google', 'Intentá con correo y contraseña');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Opciones de volumen según actividad
  const volumeOptions = activity === 'fabricante'
    ? [
        { label: '1 - 25 carteles', sub: 'Taller inicial o artesanal', val: '1-25' },
        { label: '26 - 50 carteles', sub: 'Taller en crecimiento constante', val: '26-50' },
        { label: '51 - 150 carteles', sub: 'Producción gráfica sostenida', val: '51-150' },
        { label: '150+ carteles', sub: 'Distribución y fábrica masiva', val: '150+' },
      ]
    : [
        { label: '1 - 3 carteles', sub: 'Local comercial estándar (mostrador y mesas)', val: '1-3' },
        { label: '4 - 10 carteles', sub: 'Restaurante mediano o varias sucursales', val: '4-10' },
        { label: '11+ carteles', sub: 'Cadena gastronómica o salón amplio', val: '11+' },
      ];

  return (
    <div className="aurora-stage min-h-screen flex items-center justify-center p-4 selection:bg-white/20 selection:text-white">
      <div className="w-full max-w-xl space-y-6 py-6">
        {/* Cabecera con Logo y Progreso */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <Link to="/" className="p-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 transition group">
              <BrandLogo showToqueBadge={false} />
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Creá tu cuenta en Toque
          </h1>
          <p className="text-xs text-white/70 max-w-sm mx-auto">
            Configurá tu acceso y empezá a medir toques y opiniones en tiempo real.
          </p>

          {/* Indicador de Pasos */}
          <div className="flex items-center justify-center gap-2 pt-3">
            {[1, 2, 3, 4].map((stepNum) => (
              <div
                key={stepNum}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === stepNum
                    ? 'w-10 bg-white'
                    : step > stepNum
                    ? 'w-6 bg-emerald-400'
                    : 'w-6 bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Tarjeta de Formulario Multi-Paso con Animación */}
        <Card className="p-6 sm:p-8 border-white/20 bg-[rgba(10,20,36,0.96)] backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait">
            {/* PASO 1: DATOS PERSONALES Y ACCESO */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 block">
                    Paso 1 de 4
                  </span>
                  <h2 className="text-lg font-bold text-white font-headline">
                    Tus datos personales y de acceso
                  </h2>
                </div>

                {/* Botón rápido con Google OAuth */}
                <button
                  type="button"
                  onClick={handleGoogleOAuthSimulated}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.9z"
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
                  <span>Continuar con Google</span>
                </button>

                <div className="flex items-center gap-3 my-2">
                  <div className="h-px bg-white/10 flex-1" />
                  <span className="text-[11px] text-white/40 uppercase">o con correo</span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>

                <form onSubmit={handleNextFromStep1} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">
                      Nombre y Apellido *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Lucas Gómez"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white/50 transition"
                      />
                    </div>
                    {errors.name && <p className="text-[11px] text-rose-400 mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">
                      Correo electrónico *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="lucas@minegocio.com.ar"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white/50 transition"
                      />
                    </div>
                    {errors.email && <p className="text-[11px] text-rose-400 mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">
                      Contraseña *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white/50 transition"
                      />
                    </div>
                    {errors.password && <p className="text-[11px] text-rose-400 mt-1">{errors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">
                      WhatsApp con código de área *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="11 5263-8900"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white/50 transition"
                      />
                    </div>
                    {errors.whatsapp && <p className="text-[11px] text-rose-400 mt-1">{errors.whatsapp}</p>}
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full justify-center bg-white text-slate-900 hover:bg-slate-100 font-semibold"
                      rightIcon={<ArrowRight className="w-4 h-4 text-slate-900" />}
                    >
                      Continuar a tu actividad
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* PASO 2: QUÉ ACTIVIDAD REALIZÁS (SOY FABRICANTE O SOY DUEÑO - SIN MÁS TEXTO) */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 block">
                    Paso 2 de 4
                  </span>
                  <h2 className="text-lg font-bold text-white font-headline">
                    ¿Qué actividad realizás?
                  </h2>
                  <p className="text-xs text-white/70 mt-1">
                    Seleccioná tu rol para personalizar tu panel y herramientas de inmediato.
                  </p>
                </div>

                {/* Dos opciones limpias sin textos inventados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setActivity('fabricante')}
                    className={`p-5 rounded-2xl border text-left transition flex flex-col justify-between gap-4 cursor-pointer ${
                      activity === 'fabricante'
                        ? 'bg-blue-600/25 border-blue-400 ring-2 ring-blue-500/50 shadow-lg'
                        : 'bg-white/5 border-white/15 hover:bg-white/10'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
                      <Factory className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-headline text-base font-bold text-white">
                        Soy fabricante
                      </h3>
                      <p className="text-xs text-white/70 mt-1">
                        Taller de cartelería, imprenta o fabricante físico.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-300">
                      <span>Panel de Fabricante</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivity('negocio')}
                    className={`p-5 rounded-2xl border text-left transition flex flex-col justify-between gap-4 cursor-pointer ${
                      activity === 'negocio'
                        ? 'bg-emerald-600/25 border-emerald-400 ring-2 ring-emerald-500/50 shadow-lg'
                        : 'bg-white/5 border-white/15 hover:bg-white/10'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                      <Store className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-headline text-base font-bold text-white">
                        Soy dueño
                      </h3>
                      <p className="text-xs text-white/70 mt-1">
                        Dueño o encargado de un local comercial o empresa.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                      <span>Panel de Negocio</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(1)}
                    icon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Volver
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setStep(3)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Continuar al volumen
                  </Button>
                </div>
              </motion.div>
            )}

            {/* PASO 3: VOLUMEN DE CARTELES DEPENDIENDO DE LA ACTIVIDAD */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 block">
                    Paso 3 de 4
                  </span>
                  <h2 className="text-lg font-bold text-white font-headline">
                    {activity === 'fabricante'
                      ? '¿Cuántos carteles vendés aproximadamente al mes?'
                      : '¿Cuántos carteles usás aproximadamente en tu negocio?'}
                  </h2>
                  <p className="text-xs text-white/70 mt-1">
                    Esto nos permite calibrar la capacidad de tu panel y el plan ideal.
                  </p>
                </div>

                <div className="space-y-3">
                  {volumeOptions.map((opt) => (
                    <label
                      key={opt.val}
                      onClick={() => setVolume(opt.val)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition cursor-pointer ${
                        volume === opt.val
                          ? 'bg-white/15 border-white ring-1 ring-white/50'
                          : 'bg-black/30 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="text-sm font-semibold text-white block">
                          {opt.label}
                        </span>
                        <span className="text-xs text-white/60">
                          {opt.sub}
                        </span>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        volume === opt.val ? 'border-white bg-white text-slate-900' : 'border-white/30'
                      }`}>
                        {volume === opt.val && <CheckCircle2 className="w-3.5 h-3.5 text-slate-900" />}
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(2)}
                    icon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Volver
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setStep(4)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Revisar y entrar
                  </Button>
                </div>
              </motion.div>
            )}

            {/* PASO 4: CONFIRMACIÓN Y ENTRADA DIRECTA AL PANEL */}
            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block">
                    Paso 4 de 4 · Todo listo
                  </span>
                  <h2 className="text-lg font-bold text-white font-headline">
                    Confirmá tus datos y comenzá
                  </h2>
                  <p className="text-xs text-white/70 mt-1">
                    Al confirmar, tu sesión quedará iniciada y accederás directamente a tu panel oficial.
                  </p>
                </div>

                {/* Resumen Real (Sin datos ficticios #48) */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/15 space-y-3 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-white/10">
                    <span className="text-white/60">Nombre:</span>
                    <span className="font-semibold text-white">{name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/10">
                    <span className="text-white/60">Correo de acceso:</span>
                    <span className="font-mono text-white">{email}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/10">
                    <span className="text-white/60">WhatsApp:</span>
                    <span className="font-mono text-white">{whatsapp}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/10">
                    <span className="text-white/60">Actividad:</span>
                    <span className={`capitalize font-semibold px-2 py-0.5 rounded-md ${
                      activity === 'fabricante' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {activity === 'fabricante' ? 'Soy fabricante' : 'Soy dueño'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/10">
                    <span className="text-white/60">Panel de destino:</span>
                    <span className="font-mono text-white font-bold">
                      {activity === 'fabricante' ? '/fabricante' : '/resumen'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-white/60">Volumen estimado:</span>
                    <span className="text-white">{volume}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-300">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Tu panel te dará la bienvenida con el asistente paso a paso de configuración física.</span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(3)}
                    icon={<ArrowLeft className="w-4 h-4" />}
                    disabled={isSubmitting}
                  >
                    Volver
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    isLoading={isSubmitting}
                    onClick={handleCompleteRegistration}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 shadow-lg shadow-emerald-500/20"
                    rightIcon={<Sparkles className="w-4 h-4 text-slate-950" />}
                  >
                    Comenzar ahora
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs text-white/60">
            ¿Ya tenés una cuenta creada?{' '}
            <Link to="/login" className="text-white font-medium hover:underline">
              Iniciar sesión aquí
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
