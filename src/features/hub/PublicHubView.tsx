import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api';
import { PublicHub, ClubMember, WalletPassResponse } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatARS } from '../../lib/format';
import {
  Star,
  Receipt as ReceiptIcon,
  Gift,
  Instagram,
  Globe,
  MessageCircle,
  MapPin,
  Clock,
  Phone,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
  Sparkles,
  Wallet,
  Check,
  Mail,
  ShieldCheck,
  RefreshCw,
  QrCode,
} from 'lucide-react';

const QRCodeSVG: React.FC<{ value: string; size?: number; level?: string }> = ({
  value,
  size = 156,
}) => {
  const cells = 17;
  const seed = Array.from(value || 'MM').reduce(
    (acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1),
    0
  );
  const isFinder = (r: number, c: number) =>
    (r < 4 && c < 4) || (r < 4 && c >= cells - 4) || (r >= cells - 4 && c < 4);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cells} ${cells}`}
      className="block mx-auto"
      aria-label={`Código QR de socio ${value}`}
    >
      <rect width={cells} height={cells} fill="#ffffff" />
      {Array.from({ length: cells }).map((_, r) =>
        Array.from({ length: cells }).map((__, c) => {
          if (isFinder(r, c)) {
            const isBorder =
              r === 0 ||
              r === 3 ||
              c === 0 ||
              c === 3 ||
              r === cells - 1 ||
              r === cells - 4 ||
              c === cells - 1 ||
              c === cells - 4;
            const isCenter =
              (r >= 1 && r <= 2 && c >= 1 && c <= 2) ||
              (r >= 1 && r <= 2 && c >= cells - 3 && c <= cells - 2) ||
              (r >= cells - 3 && r <= cells - 2 && c >= 1 && c <= 2);
            return isBorder || isCenter ? (
              <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0c0c0c" />
            ) : null;
          }
          const bit = (seed + r * 31 + c * 17) % 3 === 0;
          return bit ? (
            <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0c0c0c" />
          ) : null;
        })
      )}
    </svg>
  );
};

export const PublicHubView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const targetCode = code || 'MONROE01';

  const [hub, setHub] = useState<PublicHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado de la Tarjeta de Sellos del Cliente
  const [step, setStep] = useState<'form' | 'otp' | 'active'>('form');
  const [email, setEmail] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);

  // OTP de verificación por correo
  const [otpCode, setOtpCode] = useState('');
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [resendWait, setResendWait] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Tarjeta activa y pase de Wallet
  const [joinedMember, setJoinedMember] = useState<ClubMember | null>(null);
  const [walletPass, setWalletPass] = useState<WalletPassResponse | null>(null);
  const [generatingPass, setGeneratingPass] = useState(false);
  const [claimingSelfStamp, setClaimingSelfStamp] = useState(false);

  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      try {
        setLoading(true);
        const data = await api.getPublicHub(targetCode);
        if (!active) return;

        await api.recordHubEvent(targetCode, 'scan');

        if (
          (data.config.mode === 'direct' || data.config.mode === 'direct_review') &&
          !data.receipt &&
          !data.activeReceipt &&
          data.reviewUrl
        ) {
          window.location.href = data.reviewUrl;
          return;
        }

        setHub(data);
        if (data.club?.member) {
          setJoinedMember(data.club.member);
          setStep('active');
        }
      } catch (err: any) {
        if (active) setError(err?.message || 'El cartel consultado no existe o no está activo.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInitial();

    const unsubscribe = api.subscribeToCartelHub(targetCode, (liveHub) => {
      if (!active) return;
      setHub(liveHub);
      if (liveHub.club?.member) {
        setJoinedMember(liveHub.club.member);
        setStep('active');
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [targetCode]);

  useEffect(() => {
    if (resendWait <= 0) return;
    const timer = setInterval(() => {
      setResendWait((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendWait]);

  const handleReviewClick = async () => {
    if (!hub) return;
    await api.recordHubEvent(hub.cartel.code, 'review_click');
    window.location.href = hub.reviewUrl;
  };

  // Paso 1: Enviar código de verificación al correo electrónico
  const handleSendVerificationEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Ingresá un correo electrónico válido.');
      return;
    }

    try {
      setSubmitting(true);
      const otpRes = await api.requestOtp(cleanEmail, 'register_client');
      setResendWait(otpRes.resendAvailableInSeconds || 60);
      setEmailDelivered(Boolean(otpRes.emailSent));
      setOtpHint(otpRes.demoHintCode || null);
      setStep('otp');
      showToast(
        otpRes.emailSent
          ? `Enviamos el código de 6 dígitos a ${cleanEmail}`
          : 'Código de verificación generado',
        'success'
      );
    } catch (err: any) {
      setFormError(err?.message || 'No pudimos enviar el código de verificación.');
    } finally {
      setSubmitting(false);
    }
  };

  // Paso 2: Confirmar el código de 6 dígitos y activar la tarjeta
  const handleVerifyOtpAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanCode = otpCode.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setFormError('Ingresá el código de 6 dígitos que enviamos a tu correo.');
      return;
    }

    try {
      setSubmitting(true);
      await api.verifyOtp(email.trim().toLowerCase(), cleanCode);
      const reg = await api.registerMember({
        localCode: hub?.cartel.code || targetCode,
        email: email.trim().toLowerCase(),
        adult: true,
        marketingConsent,
      });
      setJoinedMember(reg.member);
      setStep('active');
      showToast('¡Tu tarjeta de sellos ya está activa!', 'success');
    } catch (err: any) {
      setFormError(err?.message || 'Código incorrecto. Revisalo e intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendWait > 0) return;
    setFormError(null);
    try {
      setSubmitting(true);
      const res = await api.requestOtp(email.trim().toLowerCase(), 'register_client');
      setResendWait(res.resendAvailableInSeconds || 60);
      setEmailDelivered(Boolean(res.emailSent));
      setOtpHint(res.demoHintCode || null);
      showToast('Te enviamos un código nuevo.', 'success');
    } catch (err: any) {
      setFormError(err?.message || 'No pudimos reenviar el código.');
    } finally {
      setSubmitting(false);
    }
  };

  // Opción sin datos personales (Anónima / Menores)
  const handleAnonymousCard = async () => {
    setFormError(null);
    try {
      setSubmitting(true);
      const res = await api.createAnonymousCard(hub?.cartel.code || targetCode);
      setJoinedMember(res.member);
      setStep('active');
      showToast('Tarjeta sin datos creada.', 'success');
    } catch (err: any) {
      setFormError(err?.message || 'No pudimos crear la tarjeta.');
    } finally {
      setSubmitting(false);
    }
  };

  // Emitir pase para Apple Wallet o Google Wallet
  const handleGenerateWalletPass = async (targetWallet: 'apple' | 'google') => {
    if (!hub || !joinedMember) return;
    try {
      setGeneratingPass(true);
      const pass = await api.createWalletPass({
        cartelCode: hub.cartel.code,
        memberId: joinedMember.id,
        memberCode: joinedMember.memberCode,
        customerName: joinedMember.name || 'Socio',
        customerContact: joinedMember.maskedEmail || joinedMember.contact,
        stamps: joinedMember.stamps,
      });
      setWalletPass(pass);
      const url = targetWallet === 'apple' ? pass.appleWalletUrl : pass.googleWalletUrl;
      showToast(
        targetWallet === 'apple'
          ? 'Pase para Apple Wallet generado.'
          : 'Pase para Google Wallet generado.',
        'success'
      );
      if (url && url !== '#') {
        window.location.href = url;
      }
    } catch (err: any) {
      showToast(err?.message || 'Error al generar el pase de billetera', 'error');
    } finally {
      setGeneratingPass(false);
    }
  };

  const handleSelfStamp = async () => {
    if (!hub || !joinedMember) return;
    try {
      setClaimingSelfStamp(true);
      const res = await api.claimSelfStamp({
        localCode: hub.cartel.code,
        memberId: joinedMember.id,
      });
      setJoinedMember(res.member);
      showToast(
        res.rewardReady
          ? '¡Sumaste 1 sello y completaste tu tarjeta!'
          : '¡Sumaste 1 sello en tu tarjeta!',
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'No se pudo sumar el sello.', 'error');
    } finally {
      setClaimingSelfStamp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-4">
          <Skeleton className="h-56 w-full rounded-3xl bg-[#141417]" />
          <Skeleton className="h-64 w-full rounded-3xl bg-[#141417]" />
        </div>
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#f1f1ee] p-6 flex items-center justify-center">
        <div className="max-w-sm w-full rounded-3xl bg-[#141417] border border-[#242428] p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-[#f1f1ee]">Cartel no disponible</h1>
          <p className="text-sm text-[#a1a1aa]">
            {error || 'Verificá el código impreso en el cartel.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full py-3 rounded-full bg-[#f1f1ee] text-[#0c0c0c] font-semibold text-sm"
          >
            Ir al inicio de Toque
          </Link>
        </div>
      </div>
    );
  }

  const { business, cartel, receipt, activeReceipt, club, config, crossBenefits } = hub;
  const liveReceipt = activeReceipt || receipt;
  const enabledBlocks = new Set(hub.blocks.filter((b) => b.enabled).map((b) => b.key));

  const clubCfg = club?.config;
  const cardBgColor = clubCfg?.cardThemeColor || clubCfg?.brandColor || '#1e1b4b';
  const targetStamps = 10;
  const currentStamps = Math.min(targetStamps, joinedMember?.stamps || 0);
  const remainingStamps = Math.max(0, targetStamps - currentStamps);
  const rewardLabel =
    clubCfg?.loyaltyReward ||
    clubCfg?.rewardText ||
    'Beneficio exclusivo en instrumentos y accesorios';

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#f1f1ee] py-6 px-4 flex flex-col items-center">
      <div className="max-w-md w-full space-y-5">
        {/* ================================================================= */}
        {/* A. COMPONENTE SUPERIOR: TARJETA DIGITAL DE 10 SELLOS              */}
        {/* ================================================================= */}
        <section
          aria-label={`Tarjeta de sellos de ${business.name}`}
          style={{ backgroundColor: cardBgColor }}
          className="rounded-3xl p-6 text-white border border-white/15 shadow-2xl space-y-5 relative overflow-hidden"
        >
          {/* Cabecera de la tarjeta */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {business.logoUrl ? (
                <img
                  src={business.logoUrl}
                  alt={business.name}
                  className="w-11 h-11 rounded-full object-cover border border-white/25 bg-black/20 shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-white/15 border border-white/25 flex items-center justify-center font-bold text-lg text-white shrink-0">
                  {business.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{business.name}</p>
                <p className="text-[11px] text-white/75 truncate">
                  {clubCfg?.loyaltyTitle || `Tarjeta de sellos de ${business.name}`}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="block text-[10px] uppercase tracking-widest text-white/75 font-semibold">
                SELLOS
              </span>
              <span className="text-2xl font-extrabold tracking-tight text-white">
                {currentStamps} / {targetStamps}
              </span>
            </div>
          </div>

          {/* Grilla visual de 10 sellos (2 filas de 5 círculos) */}
          <div className="grid grid-cols-5 gap-2.5 pt-1">
            {Array.from({ length: 10 }).map((_, idx) => {
              const slotNumber = idx + 1;
              const isEarned = slotNumber <= currentStamps;
              const isNext = slotNumber === currentStamps + 1;
              const isRewardSlot = slotNumber === 10;

              if (isEarned) {
                return (
                  <div
                    key={slotNumber}
                    className="aspect-square rounded-full bg-white text-[#0A0A0A] flex items-center justify-center shadow-md transition-transform"
                    title={`Sello ${slotNumber} obtenido`}
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                  </div>
                );
              }

              if (isRewardSlot) {
                return (
                  <div
                    key={slotNumber}
                    className={`aspect-square rounded-full flex items-center justify-center transition-all ${
                      isNext
                        ? 'bg-white/20 border-2 border-[#fbbf24] text-white shadow-sm'
                        : 'bg-white/10 border border-white/20 text-white/90'
                    }`}
                    title="Meta: Premio"
                  >
                    <Gift className="w-4 h-4" />
                  </div>
                );
              }

              if (isNext) {
                return (
                  <div
                    key={slotNumber}
                    className="aspect-square rounded-full bg-white/15 border-2 border-[#fbbf24] text-white font-bold text-sm flex items-center justify-center shadow-sm"
                    title={`Próximo sello: ${slotNumber}`}
                  >
                    {slotNumber}
                  </div>
                );
              }

              return (
                <div
                  key={slotNumber}
                  className="aspect-square rounded-full bg-white/10 border border-white/15 text-white/50 font-semibold text-xs flex items-center justify-center"
                >
                  {slotNumber}
                </div>
              );
            })}
          </div>

          {/* Pie de la tarjeta */}
          <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white/95">
              {remainingStamps === 0
                ? '¡Completaste los 10 sellos! Mostrá tu tarjeta en caja para canjear tu premio'
                : `Faltan ${remainingStamps} ${remainingStamps === 1 ? 'sello' : 'sellos'}`}
            </span>
            <span className="text-[11px] text-white/75 truncate max-w-[160px]" title={rewardLabel}>
              🎁 {rewardLabel}
            </span>
          </div>
        </section>

        {/* ================================================================= */}
        {/* B. ESTADO NO REGISTRADO / VERIFICACIÓN OTP / TARJETA ACTIVA       */}
        {/* ================================================================= */}
        {step === 'form' && (
          <section className="rounded-3xl bg-[#111113] border border-[#242426] p-6 space-y-5">
            <div className="space-y-1.5">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#bec8ff]">
                Paso 1: tu correo electrónico
              </span>
              <h1 className="text-xl font-bold text-[#f1f1ee] leading-snug">
                Súmate a la tarjeta de sellos de {business.name}
              </h1>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Junta 10 sellos y recibe <strong className="text-[#f1f1ee]">{rewardLabel}</strong>.
                Ingresá tu correo electrónico una sola vez para recibir tu código de verificación.
              </p>
            </div>

            {formError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSendVerificationEmail} className="space-y-4">
              <div>
                <label
                  htmlFor="client-email-input"
                  className="block text-xs font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Tu correo electrónico *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="client-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full pl-11 pr-4 py-3.5 rounded-full bg-[#18181b] border border-[#2c2c30] text-sm text-[#f1f1ee] placeholder-[#71717a] focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>
                <p className="text-[11px] text-[#a1a1aa] mt-1.5 pl-2">
                  Ahí te llega el código de 6 dígitos para confirmar tu tarjeta (sin contraseñas).
                </p>
              </div>

              {/* Casilla de consentimiento opcional */}
              <label className="flex items-start gap-2.5 text-xs text-[#a1a1aa] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 rounded border-[#2c2c30] bg-[#18181b] text-[#2fb36a] focus:ring-0"
                />
                <span>
                  Quiero recibir por correo electrónico descuentos, regalos y novedades de{' '}
                  <strong className="text-[#f1f1ee]">{business.name}</strong>.
                </span>
              </label>

              {/* Bloque legal Ley 25.326 */}
              <div className="rounded-2xl bg-[#18181b] border border-[#242426] p-3.5 space-y-1.5 text-[11px] text-[#a1a1aa] leading-relaxed">
                <p>
                  Tus datos se usan para este programa de fidelización. Podés pedir acceso,
                  rectificación o baja cuando quieras. Más información en la{' '}
                  <Link to="/privacidad" className="text-[#bec8ff] underline hover:text-white">
                    política de privacidad
                  </Link>
                  .
                </p>
                <p className="text-[10px] text-[#71717a]">
                  El titular de los datos personales tiene la facultad de ejercer el derecho de
                  acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses,
                  salvo que se acredite un interés legítimo al efecto conforme lo establecido en el
                  artículo 14, inciso 3 de la Ley Nº 25.326. La Agencia de Acceso a la Información
                  Pública, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la
                  atribución de atender las denuncias y reclamos que interpongan quienes resulten
                  afectados en sus derechos por incumplimiento de las normas vigentes en materia de
                  protección de datos personales.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-full bg-[#f1f1ee] hover:bg-white text-[#0A0A0A] font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Enviando código...' : 'Activar mi tarjeta'}
              </button>
            </form>

            <div className="pt-2 border-t border-[#242426] text-center space-y-2">
              <button
                type="button"
                onClick={handleAnonymousCard}
                disabled={submitting}
                className="text-xs font-semibold text-[#a1a1aa] hover:text-[#f1f1ee] underline cursor-pointer"
              >
                Prefiero no dar mis datos (usar tarjeta anónima)
              </button>
              <p className="text-[11px] text-[#71717a]">
                Opción apta para menores de 18 años: suma sellos con un código al azar sin guardar
                correo ni datos personales.
              </p>
            </div>
          </section>
        )}

        {/* PASO 2: VERIFICACIÓN DEL CORREO ELECTRÓNICO (CÓDIGO DE 6 DÍGITOS) */}
        {step === 'otp' && (
          <section className="rounded-3xl bg-[#111113] border border-[#242426] p-6 space-y-5">
            <div className="space-y-1.5">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#2fb36a]">
                Paso 2: confirmá tu correo
              </span>
              <h2 className="text-xl font-bold text-[#f1f1ee]">Ingresá el código de 6 dígitos</h2>
              <p className="text-xs text-[#a1a1aa]">
                Enviamos un código de verificación a <strong className="text-[#f1f1ee]">{email}</strong>.
                Vence en 10 minutos y se usa una sola vez.
              </p>
            </div>

            {otpHint && !emailDelivered && (
              <div className="p-3.5 rounded-2xl bg-[#bec8ff]/10 border border-[#bec8ff]/30 text-xs text-[#f1f1ee] flex items-center justify-between">
                <span>Código de verificación generado por el servidor:</span>
                <span className="font-mono font-bold text-base tracking-widest text-[#bec8ff]">
                  {otpHint}
                </span>
              </div>
            )}

            {formError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleVerifyOtpAndActivate} className="space-y-4">
              <div>
                <label
                  htmlFor="otp-input"
                  className="block text-xs font-semibold text-[#f1f1ee] mb-1.5"
                >
                  Código de 6 dígitos
                </label>
                <input
                  id="otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#18181b] border border-[#2c2c30] text-center font-mono text-2xl font-bold tracking-[0.35em] text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || otpCode.length !== 6}
                className="w-full py-3.5 px-6 rounded-full bg-[#2fb36a] hover:bg-[#269a59] text-[#07150d] font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Verificando...' : 'Confirmar y ver mi tarjeta'}
              </button>
            </form>

            <div className="flex items-center justify-between pt-2 border-t border-[#242426] text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setFormError(null);
                }}
                className="text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
              >
                ← Cambiar correo
              </button>

              <button
                type="button"
                disabled={resendWait > 0 || submitting}
                onClick={handleResendOtp}
                className="text-[#bec8ff] hover:text-white disabled:text-[#71717a] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {resendWait > 0 ? `Reenviar en ${resendWait}s` : 'Reenviar código'}
              </button>
            </div>
          </section>
        )}

        {/* PASO 3: TARJETA ACTIVA CON QR EN TIEMPO REAL Y BILLETERA */}
        {step === 'active' && joinedMember && (
          <section className="rounded-3xl bg-[#111113] border border-[#242426] p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#2fb36a]">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-[#f1f1ee]">
                    Tu tarjeta de {business.name} está activa
                  </h2>
                  <p className="text-[11px] text-[#a1a1aa]">
                    Mostrá este código QR en caja para sumar sellos o canjear tu premio.
                  </p>
                </div>
              </div>
            </div>

            {/* Código QR de Socio */}
            <div className="rounded-2xl bg-[#18181b] border border-[#28282c] p-5 flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-2xl bg-white">
                <QRCodeSVG
                  value={joinedMember.memberCode || joinedMember.id}
                  size={156}
                  level="M"
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#a1a1aa]">
                  Código de socio
                </p>
                <p className="font-mono text-lg font-bold text-[#f1f1ee] tracking-wider">
                  {joinedMember.memberCode || joinedMember.id.slice(0, 8).toUpperCase()}
                </p>
                {joinedMember.maskedEmail && joinedMember.maskedEmail !== 'Sin datos' && (
                  <p className="text-[11px] text-[#a1a1aa] mt-0.5">{joinedMember.maskedEmail}</p>
                )}
              </div>
            </div>

            {/* Botones de Apple Wallet y Google Wallet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={generatingPass}
                onClick={() => handleGenerateWalletPass('apple')}
                className="w-full py-3 px-4 rounded-2xl bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-xs font-bold text-[#f1f1ee] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Wallet className="w-4 h-4 text-[#bec8ff]" />
                <span>Guardar en Apple Wallet</span>
              </button>

              <button
                type="button"
                disabled={generatingPass}
                onClick={() => handleGenerateWalletPass('google')}
                className="w-full py-3 px-4 rounded-2xl bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-xs font-bold text-[#f1f1ee] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Wallet className="w-4 h-4 text-[#2fb36a]" />
                <span>Guardar en Google Wallet</span>
              </button>
            </div>

            {walletPass && (
              <div className="p-3 rounded-xl bg-[#2fb36a]/10 border border-[#2fb36a]/30 text-[11px] text-[#f1f1ee] text-center">
                Pase sincronizado ({walletPass.validationCode}). Tu celular actualizará los sellos
                automáticamente.
              </div>
            )}

            {/* Botón de autoservicio si el local lo permite */}
            {clubCfg?.allowSelfScan && clubCfg?.mode !== 'per_amount' && (
              <button
                type="button"
                disabled={claimingSelfStamp}
                onClick={handleSelfStamp}
                className="w-full py-3 px-4 rounded-2xl bg-[#2fb36a]/15 hover:bg-[#2fb36a]/25 border border-[#2fb36a]/30 text-xs font-bold text-[#2fb36a] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>
                  {claimingSelfStamp ? 'Sumando sello...' : 'Sumar 1 sello de mi visita de hoy'}
                </span>
              </button>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* C. MÓDULOS COMPLEMENTARIOS DEL SMART HUB                          */}
        {/* ================================================================= */}

        {/* 1. Comprobante Digital en Vivo (si la caja acaba de emitir un cobro) */}
        {enabledBlocks.has('receipt') && liveReceipt && (
          <div className="rounded-3xl bg-[#141417] border-2 border-[#2fb36a] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2fb36a]/15 text-[#34d399] text-xs font-bold">
                <ReceiptIcon className="w-3.5 h-3.5" />
                Tu comprobante está listo
              </span>
              <span className="text-xs text-[#a1a1aa]">Recién emitido</span>
            </div>

            <div>
              <p className="text-xs text-[#a1a1aa]">Total abonado</p>
              <p className="text-3xl font-extrabold text-[#f1f1ee]">
                {formatARS(liveReceipt.total)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/r/${liveReceipt.id}`)}
              className="w-full py-3.5 px-5 rounded-full bg-[#2fb36a] hover:bg-[#269a59] text-[#06130b] font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Ver y Descargar Comprobante</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. Reseña en Google Maps */}
        {enabledBlocks.has('review') && (
          <div className="rounded-3xl bg-[#111113] border border-[#242426] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#f1f1ee]">
                  ¿Qué te pareció tu visita a {business.name}?
                </h3>
                <p className="text-xs text-[#a1a1aa]">
                  Tu reseña en Google nos ayuda muchísimo a seguir creciendo.
                </p>
              </div>
              <div className="flex items-center gap-0.5 text-[#f59e0b] shrink-0">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className="w-4 h-4 fill-[#f59e0b]" />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleReviewClick}
              className="w-full py-3 px-5 rounded-full bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-[#f1f1ee] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Calificar en Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#bec8ff]" />
            </button>
          </div>
        )}

        {/* 3. Catálogo / Productos Destacados */}
        {enabledBlocks.has('products') && config.products && config.products.length > 0 && (
          <div className="rounded-3xl bg-[#111113] border border-[#242426] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#bec8ff]" />
              <h3 className="text-sm font-bold text-[#f1f1ee]">Catálogo y Destacados</h3>
            </div>
            <div className="space-y-2">
              {config.products
                .filter((p) => p.featuredInHub !== false)
                .slice(0, 8)
                .map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3 rounded-2xl bg-[#18181b] border border-[#242428] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#f1f1ee] truncate">{prod.title}</p>
                      {prod.description && (
                        <p className="text-xs text-[#a1a1aa] truncate">{prod.description}</p>
                      )}
                    </div>
                    {prod.price !== undefined && (
                      <span className="text-sm font-bold text-[#bec8ff] shrink-0">
                        {formatARS(prod.price)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 4. Beneficios Cruzados de la Red Toque */}
        {crossBenefits && crossBenefits.length > 0 && (
          <div className="rounded-3xl bg-[#111113] border border-[#242426] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2fb36a]" />
              <h3 className="text-sm font-bold text-[#f1f1ee]">Beneficios Red Toque</h3>
            </div>
            <div className="space-y-2">
              {crossBenefits.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-2xl bg-[#18181b] border border-[#28282c] flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-bold text-[#f1f1ee]">{b.merchantName}</p>
                    <p className="text-xs text-[#a1a1aa]">{b.title}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-[#2fb36a]/15 text-[#2fb36a] font-bold text-xs shrink-0">
                    {b.discountText}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Redes y Datos del Local */}
        {(enabledBlocks.has('socials') || enabledBlocks.has('details')) && (
          <div className="rounded-3xl bg-[#111113] border border-[#242426] p-5 space-y-4">
            {enabledBlocks.has('socials') && (
              <div className="grid grid-cols-2 gap-2">
                {config.socials.instagram && (
                  <a
                    href={`https://instagram.com/${config.socials.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#26262a] text-xs font-medium text-[#f1f1ee]"
                  >
                    <Instagram className="w-4 h-4 text-[#bec8ff]" />
                    <span className="truncate">@{config.socials.instagram.replace('@', '')}</span>
                  </a>
                )}
                {config.socials.whatsapp && (
                  <a
                    href={`https://wa.me/${config.socials.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#26262a] text-xs font-medium text-[#f1f1ee]"
                  >
                    <MessageCircle className="w-4 h-4 text-[#34d399]" />
                    <span>WhatsApp</span>
                  </a>
                )}
                {config.socials.web && (
                  <a
                    href={config.socials.web}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#26262a] text-xs font-medium text-[#f1f1ee] col-span-2"
                  >
                    <Globe className="w-4 h-4 text-[#bec8ff]" />
                    <span className="truncate">{config.socials.web}</span>
                  </a>
                )}
              </div>
            )}

            {enabledBlocks.has('details') &&
              (config.details.address || config.details.hours || config.details.phone) && (
                <div className="space-y-2 text-xs text-[#a1a1aa]">
                  {config.details.address && (
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-[#bec8ff] shrink-0" />
                      <span>{config.details.address}</span>
                    </div>
                  )}
                  {config.details.hours && (
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-[#bec8ff] shrink-0" />
                      <span>{config.details.hours}</span>
                    </div>
                  )}
                  {config.details.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-[#bec8ff] shrink-0" />
                      <span>{config.details.phone}</span>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {/* Footer Toque */}
        <footer className="pt-2 pb-4 text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-[#71717a]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2fb36a]" />
            <span>
              Cartel inteligente <strong className="text-[#a1a1aa]">{cartel.code}</strong> ·{' '}
              <Link to="/" className="text-[#bec8ff] hover:underline">
                Toque
              </Link>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};
