import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { SiteHeader, SiteFooter } from '../../components/layout/SiteHeader';
import { Store, User, Mail, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const RegisterView: React.FC = () => {
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [demoHintCode, setDemoHintCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

    if (!businessName.trim() || !ownerName.trim() || !email.trim()) {
      setErrorMsg('Completá el nombre de tu local, tu nombre y tu mail.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestOtp(email.trim().toLowerCase(), 'register_merchant');
      setDemoHintCode(res.demoHintCode || null);
      setResendCooldown(res.resendAvailableInSeconds || 60);
      setStep('code');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No pudimos enviar el código de verificación.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!/^\d{6}$/.test(code.trim())) {
      setErrorMsg('Escribí los 6 números del código que te enviamos por mail.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyOtp(email.trim().toLowerCase(), code.trim(), {
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
      });
      navigate('/panel/resumen');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'El código ingresado no es válido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await requestOtp(email.trim().toLowerCase(), 'register_merchant');
      setDemoHintCode(res.demoHintCode || null);
      setResendCooldown(res.resendAvailableInSeconds || 60);
      setCode('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos reenviar el código.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col">
      <SiteHeader />

      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <h1 className="font-bold text-2xl sm:text-3xl text-[#f1f1ee] tracking-tight">
              {step === 'form' ? 'Probá Toque Club 30 días gratis' : 'Ingresá el código'}
            </h1>
            <p className="text-base text-[#d4d4d8] leading-relaxed">
              {step === 'form'
                ? 'Sin tarjeta de crédito y sin contraseñas. Creás tu tarjeta de sellos en 2 minutos.'
                : `Te enviamos un código de 6 números a ${email} para confirmar tu cuenta.`}
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

            {step === 'form' ? (
              <form onSubmit={handleRequestCode} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="reg-biz"
                    className="block text-base font-semibold text-[#f1f1ee] mb-1.5"
                  >
                    Nombre de tu local
                  </label>
                  <div className="relative">
                    <Store className="w-5 h-5 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-biz"
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Ej. Café La Esquina"
                      className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee] placeholder-[#a1a1aa] focus:outline-none focus:border-[#bec8ff]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-owner"
                    className="block text-base font-semibold text-[#f1f1ee] mb-1.5"
                  >
                    Tu nombre
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-owner"
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Cómo te llamás"
                      className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee] placeholder-[#a1a1aa] focus:outline-none focus:border-[#bec8ff]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-base font-semibold text-[#f1f1ee] mb-1.5"
                  >
                    Tu mail
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="hola@tulocal.com"
                      className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee] placeholder-[#a1a1aa] focus:outline-none focus:border-[#bec8ff]"
                    />
                  </div>
                  <p className="text-xs text-[#a1a1aa] mt-1.5">
                    Ahí te llega el código de 6 números para entrar. No usamos contraseñas.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] hover:bg-white font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Enviando código...' : 'Continuar con mi mail'}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div className="pt-2 flex items-center justify-center gap-2 text-xs text-[#a1a1aa]">
                  <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />
                  <span>30 días gratis, sin tarjeta · Cancelás cuando quieras</span>
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
                    htmlFor="reg-otp"
                    className="block text-base font-semibold text-[#f1f1ee] mb-2"
                  >
                    Código de 6 números
                  </label>
                  <input
                    id="reg-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full min-h-[52px] px-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-2xl font-mono tracking-[0.35em] text-center text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
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
                  <span>{isSubmitting ? 'Confirmando...' : 'Confirmar y crear mi local'}</span>
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
                      setStep('form');
                      setCode('');
                      setErrorMsg(null);
                    }}
                    className="min-h-[48px] px-3 py-2 text-sm font-semibold text-[#bec8ff] hover:underline cursor-pointer"
                  >
                    Volver atrás
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="text-center text-base text-[#d4d4d8]">
            ¿Ya tenés cuenta en Toque?{' '}
            <Link to="/ingresar" className="font-bold text-[#bec8ff] underline">
              Ingresar
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};
