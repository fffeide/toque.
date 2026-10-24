import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { getHomePathForRole } from '../../components/auth/RoleRouteGuard';
import { SiteHeader, SiteFooter } from '../../components/layout/SiteHeader';
import { Mail, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const LoginView: React.FC = () => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [demoHintCode, setDemoHintCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Escribí un correo electrónico válido para recibir tu código.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestOtp(cleanEmail, 'login');
      setDemoHintCode(res.demoHintCode || null);
      setResendCooldown(res.resendAvailableInSeconds || 60);
      setStep('code');
      setInfoMsg('Te enviamos un código de 6 números a tu mail. Dura 10 minutos.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No pudimos enviar el código. Revisá tu conexión e intentá de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setErrorMsg('Ingresá los 6 números del código que te llegó por mail.');
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedUser = await verifyOtp(email.trim().toLowerCase(), cleanCode);
      if (loggedUser) {
        navigate(getHomePathForRole(loggedUser.role, loggedUser.isSuperAdmin));
      } else {
        navigate('/panel/resumen');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'El código no es válido. Revisá los números e intentá de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await requestOtp(email.trim().toLowerCase(), 'login');
      setDemoHintCode(res.demoHintCode || null);
      setResendCooldown(res.resendAvailableInSeconds || 60);
      setCode('');
      setInfoMsg('Enviamos un código nuevo a tu mail.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos reenviar el código.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillExampleEmail = (sampleEmail: string) => {
    setEmail(sampleEmail);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col">
      <SiteHeader />

      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <h1 className="font-bold text-2xl sm:text-3xl text-[#f1f1ee] tracking-tight">
              {step === 'email' ? 'Tu mail' : 'Ingresá el código'}
            </h1>
            <p className="text-base text-[#d4d4d8] leading-relaxed">
              {step === 'email'
                ? 'Sin contraseñas. Te mandamos un código de 6 números a tu correo para entrar.'
                : `Escribí el código de 6 números que enviamos a ${email}.`}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-5">
            {errorMsg && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/40 text-sm text-[#fca5a5] flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-[#f87171] shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div
                role="status"
                className="p-4 rounded-xl bg-[#2fb36a]/15 border border-[#2fb36a]/40 text-sm text-[#86efac] flex items-start gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-[#34d399] shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            {step === 'email' ? (
              <form onSubmit={handleRequestCode} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-base font-semibold text-[#f1f1ee] mb-2"
                  >
                    Tu correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ejemplo@tulocal.com"
                      className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee] placeholder-[#a1a1aa] focus:outline-none focus:border-[#bec8ff]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] hover:bg-white font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Enviando código...' : 'Recibir código por mail'}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* Correos de Ejemplo del Mock (rotulados Ejemplo) */}
                <div className="pt-4 border-t border-[#242426] space-y-2">
                  <p className="text-xs font-semibold text-[#a1a1aa]">
                    Cuentas de muestra en memoria (Ejemplo):
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fillExampleEmail('comercio@toque.ar')}
                      className="min-h-[44px] px-3 py-2 rounded-xl border border-[#28282a] bg-[#18181b] hover:border-[#bec8ff] text-left text-xs text-[#f1f1ee] cursor-pointer"
                    >
                      <span className="font-bold block">Dueño (Ejemplo)</span>
                      <span className="text-[#a1a1aa]">comercio@toque.ar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fillExampleEmail('encargado@toque.ar')}
                      className="min-h-[44px] px-3 py-2 rounded-xl border border-[#28282a] bg-[#18181b] hover:border-[#bec8ff] text-left text-xs text-[#f1f1ee] cursor-pointer"
                    >
                      <span className="font-bold block">Encargado (Ejemplo)</span>
                      <span className="text-[#a1a1aa]">encargado@toque.ar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fillExampleEmail('caja@toque.ar')}
                      className="min-h-[44px] px-3 py-2 rounded-xl border border-[#28282a] bg-[#18181b] hover:border-[#bec8ff] text-left text-xs text-[#f1f1ee] cursor-pointer"
                    >
                      <span className="font-bold block">Cajero (Ejemplo)</span>
                      <span className="text-[#a1a1aa]">caja@toque.ar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fillExampleEmail('admin@toque.ar')}
                      className="min-h-[44px] px-3 py-2 rounded-xl border border-[#28282a] bg-[#18181b] hover:border-[#bec8ff] text-left text-xs text-[#f1f1ee] cursor-pointer"
                    >
                      <span className="font-bold block">Admin Toque (Ejemplo)</span>
                      <span className="text-[#a1a1aa]">admin@toque.ar</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4" noValidate>
                {demoHintCode && (
                  <div className="p-3.5 rounded-xl bg-[#18181b] border border-[#bec8ff]/40 text-sm text-[#f1f1ee] flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-[#a1a1aa] block">
                        Código simulado en memoria (Ejemplo):
                      </span>
                      <strong className="font-mono text-lg text-[#bec8ff] tracking-widest">
                        {demoHintCode}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCode(demoHintCode)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#bec8ff] text-[#0c0c0c] font-bold text-xs cursor-pointer"
                    >
                      Completar
                    </button>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="otp-code"
                    className="block text-base font-semibold text-[#f1f1ee] mb-2"
                  >
                    Código de 6 números
                  </label>
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full min-h-[52px] px-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-2xl font-mono tracking-[0.35em] text-center text-[#f1f1ee] placeholder-[#a1a1aa]/40 focus:outline-none focus:border-[#bec8ff]"
                  />
                  <p className="text-xs text-[#a1a1aa] mt-2">
                    Vence en 10 minutos · Se usa una sola vez · Máximo 5 intentos.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] hover:bg-white font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Verificando...' : 'Confirmar y entrar'}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isSubmitting}
                    className="min-h-[48px] px-4 py-2 rounded-xl border border-[#28282a] bg-[#18181b] text-sm font-semibold text-[#f1f1ee] flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>
                      {resendCooldown > 0
                        ? `Reenviar código (${resendCooldown} s)`
                        : 'Reenviar código'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setCode('');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="min-h-[48px] px-3 py-2 text-sm font-semibold text-[#bec8ff] hover:underline cursor-pointer"
                  >
                    Cambiar mail
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="text-center text-base text-[#d4d4d8]">
            ¿Tenés un local y querés empezar?{' '}
            <Link to="/registro" className="font-bold text-[#bec8ff] underline">
              Probá 30 días gratis
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};
