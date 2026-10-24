import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { Mail, KeyRound, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { requestOtp, loginWithOtp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<'email' | 'code'>('email');
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

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Escribí un correo electrónico válido.');
      return;
    }

    try {
      setLoading(true);
      const res = await requestOtp(cleanEmail, 'login');
      setHintCode(res.demoHintCode || null);
      setResendCooldown(res.resendAvailableInSeconds || 60);
      setStep('code');
      showToast('Enviamos un código de 6 dígitos a tu correo.', 'success');
    } catch (err: any) {
      setError(err?.message || 'No pudimos enviar el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setError('El código tiene que tener 6 números.');
      return;
    }

    try {
      setLoading(true);
      const user = await loginWithOtp(email.trim().toLowerCase(), cleanCode);
      showToast('¡Bienvenido a Toque!', 'success');

      if (user?.isSuperAdmin || user?.role === 'superadmin') {
        navigate('/admin');
      } else if (user?.role === 'cashier') {
        navigate('/panel/escanear');
      } else {
        navigate('/panel/resumen');
      }
    } catch (err: any) {
      setError(err?.message || 'Código inválido o vencido.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      setLoading(true);
      const res = await requestOtp(email.trim().toLowerCase(), 'login');
      setHintCode(res.demoHintCode || null);
      setResendCooldown(res.resendAvailableInSeconds || 60);
      showToast('Te enviamos un código nuevo.', 'success');
    } catch (err: any) {
      setError(err?.message || 'Todavía no podés reenviar el código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#bec8ff] flex items-center justify-center text-[#0c0c0c] font-bold text-lg">
            T
          </div>
          <span className="font-bold text-2xl tracking-tight text-[#f1f1ee]">toque™</span>
        </Link>
        <h1 className="mt-6 text-2xl font-extrabold text-[#f1f1ee]">
          {step === 'email' ? 'Ingresá con tu correo' : 'Ingresá el código'}
        </h1>
        <p className="mt-2 text-sm text-[#a1a1aa]">
          {step === 'email'
            ? 'Sin contraseñas. Te enviamos un código único de 6 dígitos por correo electrónico.'
            : `Enviamos un código de 6 números a ${email}. Vence en 10 minutos.`}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md space-y-5">
        <div className="rounded-2xl bg-[#111113] border border-[#242426] p-6 sm:p-8 space-y-6">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]"
            >
              {error}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-medium text-[#f1f1ee] mb-1.5"
                >
                  Tu correo electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hola@musicalmonroe.com.ar"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/50 focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#2fb36a] hover:bg-[#269a59] text-[#08120c] font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Enviando código...' : 'Recibir código de 6 dígitos'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              {hintCode && (
                <div className="p-3.5 rounded-xl bg-[#bec8ff]/10 border border-[#bec8ff]/30 text-xs text-[#f1f1ee] flex items-center justify-between gap-2">
                  <span>Código de verificación:</span>
                  <span className="font-mono font-bold text-base text-[#bec8ff] tracking-widest">
                    {hintCode}
                  </span>
                </div>
              )}

              <div>
                <label
                  htmlFor="login-otp-code"
                  className="block text-xs font-medium text-[#f1f1ee] mb-1.5"
                >
                  Código de 6 dígitos
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-otp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#18181b] border border-[#28282a] text-lg font-mono tracking-[0.3em] text-[#f1f1ee] placeholder-[#a1a1aa]/40 focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>
                <p className="text-[11px] text-[#a1a1aa] mt-1.5">
                  Vence en 10 minutos · Se usa una sola vez · Máximo 5 intentos.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-3.5 px-4 rounded-xl bg-[#2fb36a] hover:bg-[#269a59] text-[#08120c] font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Verificando...' : 'Confirmar e ingresar'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setError(null);
                  }}
                  className="text-[#a1a1aa] hover:text-[#f1f1ee] underline cursor-pointer"
                >
                  Cambiar correo
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleResend}
                  className="inline-flex items-center gap-1.5 text-[#bec8ff] hover:underline disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendCooldown > 0
                    ? `Reenviar código (${resendCooldown}s)`
                    : 'Reenviar código'}
                </button>
              </div>
            </form>
          )}

          <div className="pt-4 border-t border-[#242426] flex items-center justify-between text-xs text-[#a1a1aa]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2fb36a]" />
              Sesión segura sin contraseñas
            </span>
            <Link to="/registro" className="text-[#bec8ff] font-semibold hover:underline">
              Crear cuenta de comercio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
