import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  api,
  ClubPublicInfo,
  ClubMember,
  RecognizedClientAccount,
  ToquecitoItem,
} from '../../api';
import { SiteHeader, SiteFooter } from '../../components/layout/SiteHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  Award,
  CheckCircle2,
  AlertCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Gift,
} from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export const ClientClubOnboardingView: React.FC = () => {
  const { codigoLocal } = useParams<{ codigoLocal?: string }>();
  const navigate = useNavigate();
  const activeCode = (codigoLocal || 'CAJA01').toUpperCase();

  const [clubInfo, setClubInfo] = useState<ClubPublicInfo | null>(null);
  const [recognized, setRecognized] = useState<RecognizedClientAccount | null>(null);
  const [activeMember, setActiveMember] = useState<ClubMember | null>(null);
  const [toquecitosCount, setToquecitosCount] = useState<number>(0);
  const [recentToquecito, setRecentToquecito] = useState<ToquecitoItem | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pasos: 'form' | 'otp' | 'ready' | 'card' | 'recognized' | 'login_existing'
  const [step, setStep] = useState<
    'form' | 'otp' | 'ready' | 'card' | 'recognized' | 'login_existing'
  >('form');

  // Formulario Paso 1
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDay, setBirthDay] = useState<string>('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [isAdult, setIsAdult] = useState(false); // Sin tildar de antemano
  const [marketingConsent, setMarketingConsent] = useState(false); // Sin tildar de antemano

  // OTP Paso 2
  const [otpCode, setOtpCode] = useState('');
  const [demoHintCode, setDemoHintCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Estados de acción
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async (codeToLoad: string) => {
    setIsLoading(true);
    setLoadError(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setRecentToquecito(null);

    try {
      const [info, rec] = await Promise.all([
        api.getClubPublic(codeToLoad),
        api.recognizeAccount(),
      ]);
      setClubInfo(info);
      setRecognized(rec);

      if (rec.recognized) {
        setToquecitosCount(rec.toquecitosCount || 0);
        const existingCard = rec.cards?.find((c) => c.businessId === info.businessId);
        if (existingCard) {
          setActiveMember(existingCard);
          setStep('card');
        } else {
          setActiveMember(null);
          setMarketingConsent(false);
          setStep('recognized');
        }
      } else {
        setActiveMember(null);
        setStep('form');
      }
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'No pudimos cargar los datos de este local. Revisá tu conexión e intentá de nuevo.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeCode);
  }, [activeCode]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isAdult) {
      setErrorMsg(
        'Para crear tu tarjeta con datos hace falta ser mayor de 18. Podés usarla sin datos.'
      );
      return;
    }

    if (!name.trim()) {
      setErrorMsg('Escribí tu nombre (como te conocen).');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Escribí un correo electrónico válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      const otpRes = await api.requestOtp(email.trim().toLowerCase(), 'register_client');
      setDemoHintCode(otpRes.demoHintCode || null);
      setResendCooldown(otpRes.resendAvailableInSeconds || 60);
      setStep('otp');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos enviar el código a tu mail.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!/^\d{6}$/.test(otpCode.trim())) {
      setErrorMsg('Ingresá los 6 números del código que te enviamos por mail.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.verifyOtp(email.trim().toLowerCase(), otpCode.trim(), {
        ownerName: name.trim(),
      });

      if (step === 'login_existing') {
        const rec = await api.recognizeAccount(email.trim().toLowerCase());
        setRecognized(rec);
        setToquecitosCount(rec.toquecitosCount || 0);
        const existingCard = rec.cards?.find((c) => c.businessId === clubInfo?.businessId);
        if (existingCard) {
          setActiveMember(existingCard);
          setStep('card');
        } else {
          setStep('recognized');
        }
        return;
      }

      const regRes = await api.registerMember({
        localCode: activeCode,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        birthDay: birthDay ? Number(birthDay) : undefined,
        birthMonth: birthMonth ? Number(birthMonth) : undefined,
        adult: true,
        marketingConsent,
      });

      setActiveMember(regRes.member);
      setRecognized(regRes.account);
      setToquecitosCount(regRes.account.toquecitosCount || 0);
      setStep('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'El código ingresado no es válido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnonymousCard = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await api.createAnonymousCard(activeCode);
      setActiveMember(res.member);
      setStep('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos crear la tarjeta sin datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCardToRecognizedAccount = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await api.addCardToAccount({
        localCode: activeCode,
        marketingConsent,
      });
      setActiveMember(res.member);
      setRecognized(res.account);
      setStep('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos sumar la tarjeta a tu cuenta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelfStamp = async () => {
    if (!activeMember || !clubInfo) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const res = await api.claimSelfStamp({
        localCode: clubInfo.localCode,
        memberId: activeMember.id,
      });
      setActiveMember(res.member);
      setRecentToquecito(res.toquecito);
      const list = await api.listToquecitos(res.member.accountId);
      setToquecitosCount(list.length);
      setSuccessMsg(
        res.rewardReady
          ? '¡Sumaste 1 sello y completaste tu tarjeta! Tu premio está listo.'
          : '¡Sumaste 1 sello y 1 toquecito por tu visita de hoy!'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos sumar el sello.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await api.requestOtp(email.trim().toLowerCase(), 'register_client');
      setDemoHintCode(res.demoHintCode || null);
      setResendCooldown(res.resendAvailableInSeconds || 60);
      setOtpCode('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos reenviar el código.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col">
        <SiteHeader />
        <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 space-y-4">
          <Skeleton className="h-52 w-full rounded-2xl bg-[#111113]" />
          <Skeleton className="h-80 w-full rounded-2xl bg-[#111113]" />
        </main>
      </div>
    );
  }

  if (loadError || !clubInfo) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col">
        <SiteHeader />
        <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 flex items-center justify-center">
          <div className="p-6 rounded-2xl bg-[#111113] border border-[#242426] text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-[#f87171] mx-auto" />
            <h1 className="text-xl font-bold text-[#f1f1ee]">No pudimos abrir el cartel</h1>
            <p className="text-base text-[#d4d4d8]">{loadError}</p>
            <button
              type="button"
              onClick={() => loadData(activeCode)}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-base cursor-pointer"
            >
              Intentar de nuevo
            </button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const targetStamps = clubInfo.targetStamps || 10;
  const currentStamps = activeMember?.stamps || 0;
  const isRewardReady = currentStamps >= targetStamps;
  const brandColor = clubInfo.brandColor || '#3A3FE0';
  const businessInitial = clubInfo.businessName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Selector de Local de Ejemplo para probar reconocimiento entre comercios */}
        <div className="p-3 rounded-xl bg-[#111113] border border-[#242426] flex flex-wrap items-center justify-between gap-2 text-xs text-[#a1a1aa]">
          <span>Probar cartel de local (Ejemplo):</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate('/club/CAJA01')}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                activeCode === 'CAJA01'
                  ? 'bg-[#bec8ff] text-[#0c0c0c]'
                  : 'bg-[#18181b] text-[#f1f1ee] border border-[#28282a]'
              }`}
            >
              Café La Esquina (Ejemplo)
            </button>
            <button
              type="button"
              onClick={() => navigate('/club/HELADO01')}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                activeCode === 'HELADO01'
                  ? 'bg-[#bec8ff] text-[#0c0c0c]'
                  : 'bg-[#18181b] text-[#f1f1ee] border border-[#28282a]'
              }`}
            >
              Heladería Del Parque (Ejemplo)
            </button>
          </div>
        </div>

        {/* VISTA PREVIA DE LA TARJETA ARRIBA (Color, Logo, Premio y Sellos) */}
        <section
          aria-label="Vista previa de la tarjeta de sellos"
          className="rounded-2xl border border-white/15 p-5 sm:p-6 space-y-4 shadow-lg"
          style={{
            background: `linear-gradient(145deg, ${brandColor} 0%, #111113 92%)`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {clubInfo.logoUrl ? (
                <img
                  src={clubInfo.logoUrl}
                  alt={clubInfo.businessName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl object-cover border border-white/20 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/25 flex items-center justify-center font-bold text-xl text-white shrink-0">
                  {businessInitial}
                </div>
              )}
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white/80 block">
                  {clubInfo.isSample ? 'Tarjeta de sellos · Ejemplo' : 'Tarjeta de sellos'}
                </span>
                <h1 className="font-bold text-xl text-white truncate">
                  {clubInfo.businessName}
                </h1>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="font-mono font-bold text-lg sm:text-xl text-white tabular-nums block">
                {currentStamps} / {targetStamps} sellos
              </span>
              {activeMember?.anonymous && (
                <span className="text-xs text-white/80 block">Tarjeta sin datos</span>
              )}
            </div>
          </div>

          {/* Grilla de sellos con Toquecitos */}
          <div className="grid grid-cols-5 gap-2.5 pt-1">
            {Array.from({ length: targetStamps }).map((_, idx) => {
              const filled = idx < currentStamps;
              return (
                <div
                  key={idx}
                  className={`h-11 rounded-xl border flex items-center justify-center font-bold text-sm transition-opacity ${
                    filled
                      ? 'border-white bg-white/20 text-white toquecito-pop'
                      : 'border-white/25 bg-black/25 text-white/50'
                  }`}
                >
                  {filled ? (
                    <span
                      title={`Toquecito de ${clubInfo.businessName}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${brandColor}, #0c0c0c)`,
                      }}
                    >
                      {businessInitial}
                    </span>
                  ) : (
                    <span className="tabular-nums">{idx + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Premio del comercio */}
          <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-2 text-sm text-white">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 shrink-0" />
              <span>
                Premio: <strong>{clubInfo.rewardText}</strong>
              </span>
            </div>
            {isRewardReady && (
              <span className="font-bold text-[#86efac]">¡Premio listo!</span>
            )}
          </div>
        </section>

        {/* Mensajes de error o éxito */}
        {errorMsg && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/40 text-base text-[#fca5a5] flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-[#f87171] shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="p-4 rounded-xl bg-[#2fb36a]/15 border border-[#2fb36a]/40 text-base text-[#86efac] flex items-start gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-[#34d399] shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Animación del Toquecito recién ganado */}
        {recentToquecito && (
          <div className="p-4 rounded-2xl bg-[#111113] border border-[#242426] flex items-center gap-4 toquecito-pop">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl text-white shrink-0 border border-white/20"
              style={{
                background: `linear-gradient(135deg, ${recentToquecito.brandColor}, #18181b)`,
              }}
            >
              {recentToquecito.initial}
            </div>
            <div>
              <p className="font-bold text-base text-[#f1f1ee]">
                ¡Ganaste un toquecito de {recentToquecito.businessName}!
              </p>
              <p className="text-sm text-[#a1a1aa]">
                Quedó guardado en tu cuenta ({toquecitosCount} en total).
              </p>
            </div>
          </div>
        )}

        {/* CASO RECONOCIMIENTO: El cliente ya tiene cuenta Toque y escaneó otro comercio */}
        {step === 'recognized' && recognized && (
          <section className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-5">
            <div className="flex items-center gap-3">
              <UserCheck className="w-6 h-6 text-[#34d399] shrink-0" />
              <h2 className="font-bold text-xl text-[#f1f1ee]">
                Hola, {recognized.name}. ¿Sumás la tarjeta de {clubInfo.businessName} a tu cuenta?
              </h2>
            </div>

            <p className="text-base text-[#d4d4d8] leading-relaxed">
              Reconocimos tu cuenta ({recognized.maskedEmail}). No hace falta que vuelvas a escribir tus datos. Tus datos solo se comparten con este local cuando tocás el botón.
            </p>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#18181b] border border-[#28282a] cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-[#28282a] text-[#bec8ff] focus:ring-[#bec8ff] shrink-0"
              />
              <span className="text-base text-[#f1f1ee]">
                Quiero recibir avisos y beneficios de {clubInfo.businessName} (opcional)
              </span>
            </label>

            <button
              type="button"
              onClick={handleAddCardToRecognizedAccount}
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] hover:bg-white font-bold text-base transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Sumando tarjeta...' : 'Sí, sumar'}
            </button>

            <button
              type="button"
              onClick={() => setStep('form')}
              className="w-full min-h-[48px] px-4 py-2 text-sm font-semibold text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
            >
              Usar otra cuenta o crear tarjeta sin datos
            </button>
          </section>
        )}

        {/* PASO 1: "Tus datos" */}
        {step === 'form' && (
          <section className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-xl text-[#f1f1ee]">Paso 1: Tus datos</h2>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setStep('login_existing');
                }}
                className="text-sm font-semibold text-[#bec8ff] hover:underline cursor-pointer"
              >
                Ya tengo cuenta
              </button>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="client-name"
                  className="block text-base font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Nombre (obligatorio)
                </label>
                <input
                  id="client-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como te conocen"
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee] placeholder-[#a1a1aa] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <div>
                <label
                  htmlFor="client-email"
                  className="block text-base font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Mail (obligatorio)
                </label>
                <input
                  id="client-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tumail@ejemplo.com"
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee] placeholder-[#a1a1aa] focus:outline-none focus:border-[#bec8ff]"
                />
                <p className="text-sm text-[#a1a1aa] mt-1.5">
                  Ahí te llega el código para confirmar tu tarjeta.
                </p>
              </div>

              {/* Cumpleaños: SOLO día y mes (dos selectores). Sin año. */}
              <div>
                <span className="block text-base font-semibold text-[#f1f1ee] mb-1.5">
                  Cumpleaños (opcional)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="birth-day" className="sr-only">
                      Día de cumpleaños
                    </label>
                    <select
                      id="birth-day"
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                    >
                      <option value="">Día</option>
                      {Array.from({ length: 31 }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="birth-month" className="sr-only">
                      Mes de cumpleaños
                    </label>
                    <select
                      id="birth-month"
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                    >
                      <option value="">Mes</option>
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-sm text-[#a1a1aa] mt-1.5">
                  Para que el local te salude ese día.
                </p>
              </div>

              {/* Casilla obligatoria mayor de 18 años (sin tildar de antemano) */}
              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#18181b] border border-[#28282a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAdult}
                    onChange={(e) => setIsAdult(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-[#28282a] text-[#bec8ff] focus:ring-[#bec8ff] shrink-0"
                  />
                  <span className="text-base text-[#f1f1ee] font-medium">
                    Soy mayor de 18 años (obligatorio)
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#18181b] border border-[#28282a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-[#28282a] text-[#bec8ff] focus:ring-[#bec8ff] shrink-0"
                  />
                  <span className="text-base text-[#f1f1ee]">
                    Quiero recibir avisos y beneficios de {clubInfo.businessName} (opcional)
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] hover:bg-white font-bold text-base transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando código...' : 'Crear mi tarjeta'}
              </button>

              {/* Leyenda privacidad y Ley 25.326 */}
              <div className="pt-2 space-y-2 text-xs text-[#a1a1aa] leading-relaxed">
                <p>
                  Tus datos son solo para el programa de este local. Más información en la{' '}
                  <Link to="/privacidad" className="text-[#bec8ff] underline">
                    política de privacidad
                  </Link>
                  .
                </p>
                <p>
                  Ley 25.326: El titular de los datos personales tiene la facultad de ejercer el
                  derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a
                  seis meses. La Agencia de Acceso a la Información Pública tiene la atribución de
                  atender las denuncias y reclamos que se interpongan con relación al
                  incumplimiento de las normas sobre protección de datos personales.
                </p>
              </div>
            </form>

            {/* Botón alternativo: Prefiero no dar mis datos (menores y uso anónimo) */}
            <div className="pt-4 border-t border-[#242426] space-y-2.5">
              <button
                type="button"
                onClick={handleAnonymousCard}
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] hover:border-[#bec8ff] text-base font-semibold text-[#f1f1ee] transition-colors cursor-pointer"
              >
                Prefiero no dar mis datos
              </button>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Crea una tarjeta con un código al azar, sin nombre, mail ni cumpleaños. Sirve para
                sumar sellos igual, pero sin avisos ni recuperación si cambiás o perdés el celular.
                Esta es la opción para menores de 18 años.
              </p>
            </div>
          </section>
        )}

        {/* INGRESO EN DISPOSITIVO NUEVO ("Ya tengo cuenta") */}
        {step === 'login_existing' && (
          <section className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-4">
            <h2 className="font-bold text-xl text-[#f1f1ee]">Ingresá tu mail</h2>
            <p className="text-base text-[#d4d4d8]">
              Te enviamos un código de 6 números para recuperar tus tarjetas en este celular.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg(null);
                if (!email.trim() || !email.includes('@')) {
                  setErrorMsg('Escribí tu correo electrónico.');
                  return;
                }
                setIsSubmitting(true);
                try {
                  const res = await api.requestOtp(
                    email.trim().toLowerCase(),
                    'register_client'
                  );
                  setDemoHintCode(res.demoHintCode || null);
                  setResendCooldown(res.resendAvailableInSeconds || 60);
                  setStep('otp');
                } catch (err) {
                  setErrorMsg(
                    err instanceof Error ? err.message : 'No pudimos enviar el código.'
                  );
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="existing-email"
                  className="block text-base font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Tu mail
                </label>
                <input
                  id="existing-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tumail@ejemplo.com"
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-base cursor-pointer"
              >
                {isSubmitting ? 'Enviando...' : 'Recibir código'}
              </button>
              <button
                type="button"
                onClick={() => setStep('form')}
                className="w-full min-h-[48px] text-sm font-semibold text-[#bec8ff] hover:underline cursor-pointer"
              >
                Volver a crear tarjeta nueva
              </button>
            </form>
          </section>
        )}

        {/* PASO 2: "Confirmá tu mail" (Código de 6 dígitos) */}
        {step === 'otp' && (
          <section className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-5">
            <h2 className="font-bold text-xl text-[#f1f1ee]">Paso 2: Confirmá tu mail</h2>
            <p className="text-base text-[#d4d4d8]">
              Ingresá el código de 6 dígitos que enviamos a <strong>{email}</strong>.
            </p>

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
                  onClick={() => setOtpCode(demoHintCode)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#bec8ff] text-[#0c0c0c] font-bold text-xs cursor-pointer"
                >
                  Completar
                </button>
              </div>
            )}

            <form onSubmit={handleConfirmOtp} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="club-otp"
                  className="block text-base font-semibold text-[#f1f1ee] mb-2"
                >
                  Código de 6 números
                </label>
                <input
                  id="club-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full min-h-[52px] px-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-2xl font-mono tracking-[0.35em] text-center text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
                <p className="text-xs text-[#a1a1aa] mt-1.5">
                  Vence en 10 minutos · Se usa una sola vez · Máximo 5 intentos.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] hover:bg-white font-bold text-base cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Confirmando...' : 'Confirmar mi tarjeta'}
              </button>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResendOtp}
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
                  onClick={() => setStep('form')}
                  className="min-h-[48px] px-3 py-2 text-sm font-semibold text-[#bec8ff] hover:underline cursor-pointer"
                >
                  Corregir mis datos
                </button>
              </div>
            </form>
          </section>
        )}

        {/* PASO 3: "Listo" */}
        {step === 'ready' && activeMember && (
          <section className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-[#34d399] shrink-0" />
              <h2 className="font-bold text-xl text-[#f1f1ee]">
                {activeMember.anonymous
                  ? 'Listo. Tu tarjeta sin datos está lista.'
                  : `Hola, ${activeMember.name}. Tu tarjeta está lista.`}
              </h2>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                disabled
                className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-[#a1a1aa] text-sm font-semibold flex flex-col items-center justify-center opacity-75 cursor-not-allowed"
              >
                <span>Guardar en Apple Wallet</span>
                <span className="text-xs font-normal">
                  Disponible cuando se conecte el servidor
                </span>
              </button>

              <button
                type="button"
                disabled
                className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#28282a] bg-[#18181b] text-[#a1a1aa] text-sm font-semibold flex flex-col items-center justify-center opacity-75 cursor-not-allowed"
              >
                <span>Guardar en Google Wallet</span>
                <span className="text-xs font-normal">
                  Disponible cuando se conecte el servidor
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStep('card')}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] hover:bg-white font-bold text-base transition-colors cursor-pointer"
              >
                Ver mi tarjeta
              </button>
            </div>
          </section>
        )}

        {/* TARJETA WEB DEL CLIENTE */}
        {step === 'card' && activeMember && (
          <section className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-xl text-[#f1f1ee]">
                  {activeMember.anonymous ? activeMember.name : `Tarjeta de ${activeMember.name}`}
                </h2>
                <p className="text-sm text-[#a1a1aa]">
                  Mostrale este código al cajero o sumá tu sello del día.
                </p>
              </div>
              <Award className="w-6 h-6 text-[#bec8ff] shrink-0" />
            </div>

            {/* Estado Premio Listo */}
            {isRewardReady && (
              <div className="p-4 rounded-xl bg-[#2fb36a]/15 border border-[#2fb36a]/40 text-base text-[#86efac] font-bold flex items-center gap-3">
                <Gift className="w-6 h-6 text-[#34d399] shrink-0" />
                <span>¡Premio listo! Mostrale tu tarjeta al cajero para canjearlo.</span>
              </div>
            )}

            {/* QR de la tarjeta para que escanee el comercio */}
            <div className="p-5 rounded-2xl bg-[#f1f1ee] text-[#0c0c0c] flex flex-col items-center justify-center space-y-2">
              <QrCode className="w-28 h-28 text-[#0c0c0c]" />
              <span className="font-mono font-bold text-sm tracking-wider">
                {activeMember.id}
              </span>
              <span className="text-xs text-[#3f3f46]">
                Código de tu tarjeta en {clubInfo.businessName}
              </span>
            </div>

            {/* Botón Autoservicio ("Escanea el cliente"): 1 visita por día */}
            {clubInfo.allowSelfScan && clubInfo.mode === 'per_visit' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSelfStamp}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#bec8ff] text-[#0c0c0c] hover:bg-[#d4dcff] font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>{isSubmitting ? 'Sumando sello...' : 'Sumar mi sello de hoy'}</span>
                </button>
                <p className="text-xs text-[#a1a1aa] text-center">
                  Modo autoservicio: permite 1 visita por día en este local.
                </p>
              </div>
            )}

            {/* Tus toquecitos: N */}
            <div className="p-4 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${brandColor}, #0c0c0c)`,
                  }}
                >
                  {businessInitial}
                </span>
                <div>
                  <p className="font-bold text-base text-[#f1f1ee] tabular-nums">
                    Tus toquecitos: {toquecitosCount}
                  </p>
                  <p className="text-xs text-[#a1a1aa]">
                    La pantalla completa de toquecitos viene en la v2.
                  </p>
                </div>
              </div>
            </div>

            {/* Botones de billetera del celular en vista de tarjeta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                disabled
                className="min-h-[48px] px-3 py-2 rounded-xl border border-[#28282a] bg-[#18181b] text-xs text-[#a1a1aa] opacity-75 cursor-not-allowed"
              >
                <span className="font-semibold block text-[#f1f1ee]">Guardar en Apple Wallet</span>
                <span>Disponible cuando se conecte el servidor</span>
              </button>
              <button
                type="button"
                disabled
                className="min-h-[48px] px-3 py-2 rounded-xl border border-[#28282a] bg-[#18181b] text-xs text-[#a1a1aa] opacity-75 cursor-not-allowed"
              >
                <span className="font-semibold block text-[#f1f1ee]">Guardar en Google Wallet</span>
                <span>Disponible cuando se conecte el servidor</span>
              </button>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};
