import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { BrandLogo } from '../../components/ui/Avatar';
import { Store, User, Mail, KeyRound, ArrowRight, RefreshCw } from 'lucide-react';

export const RegisterView: React.FC = () => {
  const { requestOtp, loginWithOtp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<'form' | 'code'>('form');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [hintCode, setHintCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!businessName.trim() || !ownerName.trim() || !email.trim()) {
      setError('Completá el nombre de tu comercio, tu nombre y tu correo.');
      return;
    }

    try {
      setLoading(true);
      const res = await requestOtp(email.trim().toLowerCase(), 'register_merchant');
      setHintCode(res.demoHintCode || null);
      setResendCooldown(res.resendAvailableInSeconds || 60);
      setStep('code');
      showToast('Enviamos el código de 6 dígitos a tu correo.', 'success');
    } catch (err: any) {
      setError(err?.message || 'Error al enviar el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(code.trim())) {
      setError('El código tiene que tener 6 números.');
      return;
    }

    try {
      setLoading(true);
      await loginWithOtp(email.trim().toLowerCase(), code.trim(), {
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
      });
      showToast('¡Tu comercio ya está listo en Toque!', 'success');
      navigate('/panel/resumen');
    } catch (err: any) {
      setError(err?.message || 'No pudimos verificar el código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F0] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center justify-center">
          <BrandLogo variant="full" size="md" />
        </Link>
        <h1 className="mt-6 text-2xl font-extrabold text-[#F4F4F0]">
          {step === 'form' ? 'Empezá tu prueba de 14 días gratis (Plan Anual)' : 'Ingresá el código'}
        </h1>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          {step === 'form'
            ? 'Sin tarjeta de crédito y sin contraseñas. Configurá tu Cartel y tu Tarjeta de Sellos en 2 minutos.'
            : `Te enviamos un código de 6 números a ${email}.`}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl bg-[#141418] border border-[#282830] p-6 sm:p-8 space-y-6">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]"
            >
              {error}
            </div>
          )}

          {step === 'form' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#F4F4F0] mb-1.5">
                  Nombre de tu comercio
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Ej: La Burger"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#1C1C22] border border-[#282830] text-sm text-[#F4F4F0] placeholder-[#A1A1AA]/50 focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#F4F4F0] mb-1.5">
                  Tu nombre
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Como te conocen"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#1C1C22] border border-[#282830] text-sm text-[#F4F4F0] placeholder-[#A1A1AA]/50 focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#F4F4F0] mb-1.5">
                  Tu correo electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@comercio.com"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#1C1C22] border border-[#282830] text-sm text-[#F4F4F0] placeholder-[#A1A1AA]/50 focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <p className="text-[11px] text-[#a1a1aa] mt-1.5">
                  Ahí te llega el código de 6 dígitos para entrar al panel.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#2fb36a] hover:bg-[#269a59] text-[#08120c] font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Enviando código...' : 'Recibir código por correo'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirmRegistration} className="space-y-4">
              {hintCode && (
                <div className="p-3.5 rounded-xl bg-[#bec8ff]/10 border border-[#bec8ff]/30 text-xs text-[#f1f1ee] flex items-center justify-between">
                  <span>Código de verificación:</span>
                  <span className="font-mono font-bold text-base text-[#bec8ff] tracking-widest">
                    {hintCode}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#f1f1ee] mb-1.5">
                  Código de 6 dígitos
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#18181b] border border-[#28282a] text-lg font-mono tracking-[0.3em] text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-3.5 px-4 rounded-xl bg-[#2fb36a] hover:bg-[#269a59] text-[#08120c] font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Activando...' : 'Confirmar y crear mi tarjeta'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="text-[#a1a1aa] hover:text-[#f1f1ee] underline cursor-pointer"
                >
                  Volver a mis datos
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleSendOtp}
                  className="inline-flex items-center gap-1 text-[#bec8ff] disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : 'Reenviar código'}
                </button>
              </div>
            </form>
          )}

          <div className="pt-4 border-t border-[#242426] text-center">
            <p className="text-xs text-[#a1a1aa]">
              ¿Ya tenés cuenta en Toque?{' '}
              <Link to="/login" className="text-[#bec8ff] font-semibold hover:underline">
                Ingresar con código
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
