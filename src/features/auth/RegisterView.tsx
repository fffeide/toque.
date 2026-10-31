import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { api } from '../../api';
import { TOQUE_PLANS, formatArs, pruebaGratisDias } from '../../config/pricing';
import { useToast } from '../../components/ui/Toast';
import { BrandLogo } from '../../components/ui/Avatar';
import {
  Store,
  User,
  Mail,
  KeyRound,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

type OwnerRoleOption = 'Dueño/a' | 'Encargado/a' | 'Administración' | 'Otro';
type TeamSizeOption = 'Solo yo' | '2 a 5' | '6 a 15' | '16 o más';
type PlanChoiceOption = 'mensual' | 'anual' | 'trial_14d';

const ROLE_OPTIONS: OwnerRoleOption[] = ['Dueño/a', 'Encargado/a', 'Administración', 'Otro'];
const TEAM_SIZE_OPTIONS: TeamSizeOption[] = ['Solo yo', '2 a 5', '6 a 15', '16 o más'];

export const RegisterView: React.FC = () => {
  const { requestOtp, loginWithOtp, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // 3 Pasos del registro del comercio:
  // 'step1': tu mail, tu nombre, nombre del negocio + código de verificación
  // 'step2': tu rol, mail del negocio (opcional), cuántas personas trabajan ahí, rubro (opcional)
  // 'step3': OBLIGATORIO "Elegí tu plan" (Mensual, Anual, Probar 14 días gratis (plan Pro)), ninguno preseleccionado
  const [step, setStep] = useState<'step1' | 'step2' | 'step3'>('step1');

  // Datos Paso 1
  const [email, setEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [hintCode, setHintCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Datos Paso 2
  const [ownerRole, setOwnerRole] = useState<OwnerRoleOption>('Dueño/a');
  const [businessEmail, setBusinessEmail] = useState('');
  const [teamSize, setTeamSize] = useState<TeamSizeOption>('Solo yo');
  const [category, setCategory] = useState('');

  // Datos Paso 3 (Ninguna opción preseleccionada)
  const [selectedPlan, setSelectedPlan] = useState<PlanChoiceOption | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleSendOtp = async () => {
    setError(null);
    if (!email.trim() || !ownerName.trim() || !businessName.trim()) {
      setError('Completá tu mail, tu nombre y el nombre del negocio.');
      return;
    }

    try {
      setLoading(true);
      const res = await requestOtp(email.trim().toLowerCase(), 'register_merchant');
      setHintCode(res.demoHintCode || null);
      setResendCooldown(res.resendAvailableInSeconds || 60);
      setOtpSent(true);
      showToast('Enviamos el código de verificación a tu mail.', 'success');
    } catch (err: any) {
      setError(err?.message || 'No pudimos enviar el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otpSent) {
      await handleSendOtp();
      return;
    }

    if (!/^\d{6}$/.test(code.trim())) {
      setError('Ingresá el código de verificación de 6 dígitos.');
      return;
    }

    try {
      setLoading(true);
      await loginWithOtp(email.trim().toLowerCase(), code.trim(), {
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
      });
      setStep('step2');
    } catch (err: any) {
      setError(err?.message || 'No pudimos verificar el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      await api.updateBusinessProfile({
        name: businessName.trim(),
        ownerName: ownerName.trim(),
        ownerRole,
        businessEmail: businessEmail.trim() || undefined,
        teamSize,
        category: category.trim() || undefined,
      });
      await refreshProfile();
      setStep('step3');
    } catch (err: any) {
      setError(err?.message || 'No pudimos guardar los datos del negocio.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedPlan) {
      setError('Elegí una opción para continuar al panel.');
      return;
    }

    try {
      setLoading(true);
      await api.selectPlan(selectedPlan);
      await refreshProfile();
      showToast('¡Listo! Ya podés usar el panel de tu comercio.', 'success');
      navigate('/panel/resumen');
    } catch (err: any) {
      setError(err?.message || 'No pudimos activar el plan elegido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F6] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <Link to="/" className="inline-flex items-center justify-center">
          <BrandLogo variant="full" size="md" />
        </Link>

        {/* Indicador de pasos 1, 2, 3 */}
        <div className="flex items-center justify-center gap-2 mt-5">
          {(['step1', 'step2', 'step3'] as const).map((s, idx) => {
            const active = step === s;
            const completed =
              (step === 'step2' && idx === 0) || (step === 'step3' && idx < 2);
            return (
              <div
                key={s}
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  active
                    ? 'bg-[#D95B26] border-[#D95B26] text-white'
                    : completed
                    ? 'bg-[#2FB36A]/15 border-[#2FB36A]/40 text-[#2FB36A]'
                    : 'bg-[#141414] border-[#242424] text-[#9E9EA8]'
                }`}
              >
                Paso {idx + 1} de 3
              </div>
            );
          })}
        </div>

        <h1 className="mt-4 text-2xl font-extrabold text-[#F4F4F6]">
          {step === 'step1'
            ? 'Creá la cuenta de tu comercio'
            : step === 'step2'
            ? 'Contanos sobre tu negocio'
            : 'Elegí tu plan'}
        </h1>
        <p className="mt-1.5 text-sm text-[#9E9EA8]">
          {step === 'step1'
            ? 'Ingresá tus datos y verificá tu mail con un código de 6 dígitos.'
            : step === 'step2'
            ? 'Estos datos nos ayudan a preparar el panel para tu equipo.'
            : 'Elegí una opción para entrar al panel de tu comercio.'}
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="rounded-3xl bg-[#141414] border border-[#242424] p-6 sm:p-8 space-y-6">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400"
            >
              {error}
            </div>
          )}

          {/* PASO 1: Tu mail, tu nombre, nombre del negocio, código de verificación */}
          {step === 'step1' && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                  Tu mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setOtpSent(false);
                    }}
                    placeholder="nombre@comercio.com"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#0A0A0A] border border-[#242424] text-sm text-[#F4F4F6] placeholder-[#9E9EA8]/50 focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                  Tu nombre
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Cómo te llamás"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#0A0A0A] border border-[#242424] text-sm text-[#F4F4F6] placeholder-[#9E9EA8]/50 focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                  Nombre del negocio
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Ej: Musical Monroe"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#0A0A0A] border border-[#242424] text-sm text-[#F4F4F6] placeholder-[#9E9EA8]/50 focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
              </div>

              {otpSent && (
                <div className="pt-2 space-y-3 border-t border-[#242424]">
                  {hintCode && (
                    <div className="p-3 rounded-xl bg-[#D95B26]/10 border border-[#D95B26]/30 text-xs text-[#F4F4F6] flex items-center justify-between">
                      <span>Código enviado a tu mail:</span>
                      <span className="font-mono font-bold text-base text-[#D95B26] tracking-widest">
                        {hintCode}
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-[#F4F4F6]">
                        Código de verificación
                      </label>
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || loading}
                        onClick={handleSendOtp}
                        className="inline-flex items-center gap-1 text-xs text-[#D95B26] disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : 'Reenviar código'}
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        autoFocus
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Código de 6 dígitos"
                        className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#0A0A0A] border border-[#242424] text-lg font-mono tracking-[0.25em] text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <button
                  type="submit"
                  disabled={loading || (otpSent && code.length !== 6)}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#D95B26] hover:bg-[#e06530] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <span>
                    {loading
                      ? 'Procesando...'
                      : otpSent
                      ? 'Verificar código y continuar'
                      : 'Recibir código de verificación'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Abajo del botón, sin casilla */}
                <p className="text-[11px] text-[#9E9EA8] text-center leading-relaxed">
                  Al crear tu cuenta, aceptás los{' '}
                  <Link to="/terminos" className="text-[#F4F4F6] underline">
                    Términos
                  </Link>{' '}
                  y la{' '}
                  <Link to="/privacidad" className="text-[#F4F4F6] underline">
                    Política de privacidad
                  </Link>{' '}
                  de Toque.
                </p>
              </div>
            </form>
          )}

          {/* PASO 2: Tu rol, mail del negocio (opcional), cuántas personas trabajan ahí, rubro (opcional) */}
          {step === 'step2' && (
            <form onSubmit={handleStep2Submit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-2">
                  Tu rol
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setOwnerRole(r)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        ownerRole === r
                          ? 'bg-[#D95B26]/15 border-[#D95B26] text-[#F4F4F6]'
                          : 'bg-[#0A0A0A] border-[#242424] text-[#9E9EA8] hover:text-[#F4F4F6]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                  Mail del negocio (opcional)
                </label>
                <input
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  placeholder="contacto@tunegocio.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#242424] text-sm text-[#F4F4F6] placeholder-[#9E9EA8]/50 focus:outline-none focus:border-[#D95B26]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-2">
                  ¿Cuántas personas trabajan ahí?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEAM_SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setTeamSize(size)}
                      className={`py-2.5 px-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        teamSize === size
                          ? 'bg-[#D95B26]/15 border-[#D95B26] text-[#F4F4F6]'
                          : 'bg-[#0A0A0A] border-[#242424] text-[#9E9EA8] hover:text-[#F4F4F6]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                  Rubro (opcional)
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ej: Gastronomía, Cafetería, Indumentaria..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#242424] text-sm text-[#F4F4F6] placeholder-[#9E9EA8]/50 focus:outline-none focus:border-[#D95B26]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#D95B26] hover:bg-[#e06530] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Guardando...' : 'Continuar a elegir plan'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* PASO 3 OBLIGATORIO: "Elegí tu plan" (Mensual, Anual y "Probar 14 días gratis (plan Pro)", ninguno preseleccionado) */}
          {step === 'step3' && (
            <form onSubmit={handleStep3Submit} className="space-y-4">
              <div className="space-y-3">
                {/* Opción 1: Mensual */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('mensual')}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    selectedPlan === 'mensual'
                      ? 'bg-[#D95B26]/15 border-2 border-[#D95B26]'
                      : 'bg-[#0A0A0A] border-[#242424] hover:border-[#3f3f46]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#F4F4F6]">Mensual</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold font-mono text-[#F4F4F6]">
                        {formatArs(TOQUE_PLANS.mensual.priceMonthlyArs)}{' '}
                        <span className="text-xs font-normal text-[#9E9EA8]">/ mes</span>
                      </span>
                      {selectedPlan === 'mensual' && (
                        <CheckCircle2 className="w-4 h-4 text-[#D95B26]" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-[#9E9EA8] mt-1">
                    {TOQUE_PLANS.mensual.description}
                  </p>
                </button>

                {/* Opción 2: Anual */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('anual')}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    selectedPlan === 'anual'
                      ? 'bg-[#D95B26]/15 border-2 border-[#D95B26]'
                      : 'bg-[#0A0A0A] border-[#242424] hover:border-[#3f3f46]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#F4F4F6]">Anual</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold font-mono text-[#F4F4F6]">
                        {formatArs(TOQUE_PLANS.anual.totalPriceArs)}{' '}
                        <span className="text-xs font-normal text-[#9E9EA8]">/ año</span>
                      </span>
                      {selectedPlan === 'anual' && (
                        <CheckCircle2 className="w-4 h-4 text-[#D95B26]" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-[#2FB36A] font-semibold mt-1">
                    Equivale a {formatArs(TOQUE_PLANS.anual.priceMonthlyArs)} / mes · 2 meses bonificados
                  </p>
                </button>

                {/* Opción 3: Probar 14 días gratis (plan Pro) */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('trial_14d')}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    selectedPlan === 'trial_14d'
                      ? 'bg-[#D95B26]/15 border-2 border-[#D95B26]'
                      : 'bg-[#0A0A0A] border-[#242424] hover:border-[#3f3f46]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#F4F4F6]">
                      Probar {pruebaGratisDias} días gratis (plan Pro)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-[#2FB36A]">$0 hoy</span>
                      {selectedPlan === 'trial_14d' && (
                        <CheckCircle2 className="w-4 h-4 text-[#D95B26]" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-[#9E9EA8] mt-1">
                    Probás todo el plan Pro durante {pruebaGratisDias} días y elegís tu plan antes de que termine.
                  </p>
                </button>
              </div>

              <button
                type="submit"
                disabled={!selectedPlan || loading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#D95B26] hover:bg-[#e06530] disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>
                  {loading
                    ? 'Activando...'
                    : !selectedPlan
                    ? 'Elegí un plan para entrar al panel'
                    : 'Confirmar plan y entrar al panel'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {step === 'step1' && (
            <div className="pt-4 border-t border-[#242424] text-center">
              <p className="text-xs text-[#9E9EA8]">
                ¿Ya tenés cuenta en Toque?{' '}
                <Link to="/ingresar" className="text-[#D95B26] font-semibold hover:underline">
                  Ingresar con código
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
