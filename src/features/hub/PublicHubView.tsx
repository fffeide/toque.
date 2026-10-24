import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api';
import { PublicHub, ClubMember, WalletPassResponse, PlanState } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { BrandLogo } from '../../components/ui/Avatar';
import { RealQrCode, RealBarcode128 } from '../../components/ui/RealQrCode';
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
  Wallet,
  Check,
  Mail,
  User as UserIcon,
  Calendar,
  Sparkles,
  X,
  ShieldCheck,
} from 'lucide-react';

function computeAgeFromDate(dateStr: string): { age: number | null; isMinor: boolean } {
  if (!dateStr) return { age: null, isMinor: false };
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return { age: null, isMinor: false };
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const m = today.getMonth() - parsed.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }
  const cleanAge = Math.max(0, age);
  return { age: cleanAge, isMinor: cleanAge < 18 };
}

export const PublicHubView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const targetCode = code || 'BURGER01';

  const [hub, setHub] = useState<PublicHub | null>(null);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado de la Tarjeta de Sellos del Cliente
  const [step, setStep] = useState<'form' | 'active'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Recuperación compacta "¿Ya tenés tarjeta? Ingresar →"
  const [showRecoveryInput, setShowRecoveryInput] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryOtpSent, setRecoveryOtpSent] = useState(false);
  const [recoveryOtpCode, setRecoveryOtpCode] = useState('');
  const [recoveryOtpHint, setRecoveryOtpHint] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  // Modal Legal Ley 25.326
  const [showLegalModal, setShowLegalModal] = useState(false);

  // Tarjeta activa, Auto-Sello y Pase de Wallet
  const [joinedMember, setJoinedMember] = useState<ClubMember | null>(null);
  const [autoStampedThisVisit, setAutoStampedThisVisit] = useState(false);
  const [newlyStampedSlot, setNewlyStampedSlot] = useState<number | null>(null);
  const [walletPass, setWalletPass] = useState<WalletPassResponse | null>(null);
  const [showWebPassModal, setShowWebPassModal] = useState(false);
  const [generatingPass, setGeneratingPass] = useState(false);

  const { age: calculatedAge, isMinor } = computeAgeFromDate(birthDate);

  // Si se detecta que es menor de 18 años, desactivamos comunicaciones comerciales automáticamente
  useEffect(() => {
    if (isMinor) {
      setMarketingConsent(false);
    }
  }, [isMinor]);

  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      try {
        setLoading(true);
        const [data, currentPlan] = await Promise.all([
          api.getPublicHub(targetCode),
          api.getPlanState().catch(() => null),
        ]);
        if (!active) return;

        setPlanState(currentPlan);
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

        // Si viene desde el Magic Link del correo de recuperación (?recoverEmail=...&otp=...)
        const searchParams = new URLSearchParams(window.location.search);
        const magicEmail = searchParams.get('recoverEmail')?.trim().toLowerCase();
        const magicOtp = searchParams.get('otp')?.trim();

        if (magicEmail && magicOtp) {
          try {
            await fetch('/api/auth/verify-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: magicEmail, code: magicOtp }),
            });
            const recAcc = await api.recognizeAccount(magicEmail);
            const restoredCard = recAcc.cards?.find((c) => c.businessId === data.business.id) || recAcc.cards?.[0];
            if (restoredCard && active) {
              localStorage.setItem(`toque_member_${data.business.id}`, JSON.stringify(restoredCard));
              setJoinedMember(restoredCard);
              setStep('active');
              showToast(`¡Tarjeta recuperada con 1 toque, ${restoredCard.name || 'Socio'}!`, 'success');
              return;
            }
          } catch {
            // Continúa flujo normal
          }
        }

        // Leer localStorage (`toque_member_${businessId}`) para reconocimiento y Auto-Sello en 2da visita
        const storageKey = `toque_member_${data.business.id}`;
        const savedRaw = localStorage.getItem(storageKey);
        let storedMember: ClubMember | null = null;
        if (savedRaw) {
          try {
            storedMember = JSON.parse(savedRaw);
          } catch {
            storedMember = null;
          }
        }

        const recognized = storedMember || data.club?.member || null;
        if (recognized) {
          setJoinedMember(recognized);
          setStep('active');

          // Verificar cooldown de 1 hora en localStorage para Auto-Sello en 2° visita
          const cooldownKey = `toque_autostamp_${data.business.id}_${recognized.id}`;
          const lastAutoStampMs = Number(localStorage.getItem(cooldownKey) || '0');
          const oneHourMs = 3600 * 1000;

          if (Date.now() - lastAutoStampMs >= oneHourMs) {
            try {
              const stampRes = await api.claimSelfStamp({
                localCode: data.cartel.code,
                memberId: recognized.id,
              });
              if (active) {
                setJoinedMember(stampRes.member);
                setAutoStampedThisVisit(true);
                setNewlyStampedSlot(stampRes.member.stamps);
                localStorage.setItem(storageKey, JSON.stringify(stampRes.member));
                localStorage.setItem(cooldownKey, String(Date.now()));
                showToast(
                  `¡Hola de nuevo, ${stampRes.member.name || 'Socio'}! Sumaste +1 sello automático`,
                  'success'
                );
              }
            } catch {
              // Ya sumó en esta ventana horaria o el local usa modo por monto
              localStorage.setItem(cooldownKey, String(Date.now()));
            }
          }
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
        localStorage.setItem(
          `toque_member_${liveHub.business.id}`,
          JSON.stringify(liveHub.club.member)
        );
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [targetCode]);

  const handleReviewClick = async () => {
    if (!hub) return;
    await api.recordHubEvent(hub.cartel.code, 'review_click');
    window.location.href = hub.reviewUrl;
  };

  // Primera Visita: Registro Rápido de 3 Campos + Cálculo de Edad + 1° Sello Automático
  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setFormError('Ingresá tu nombre.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Ingresá un correo electrónico válido.');
      return;
    }
    if (!birthDate) {
      setFormError('Seleccioná tu fecha de nacimiento.');
      return;
    }

    try {
      setSubmitting(true);
      const reg = await api.registerMember({
        localCode: hub?.cartel.code || targetCode,
        name: cleanName,
        email: cleanEmail,
        birthDate,
        age: calculatedAge ?? undefined,
        isMinor,
        adult: !isMinor,
        marketingConsent: isMinor ? false : marketingConsent,
      });

      const storageKey = `toque_member_${hub?.business.id || 'la-burger'}`;
      const cooldownKey = `toque_autostamp_${hub?.business.id || 'la-burger'}_${reg.member.id}`;
      localStorage.setItem(storageKey, JSON.stringify(reg.member));
      localStorage.setItem(cooldownKey, String(Date.now()));

      setJoinedMember(reg.member);
      setNewlyStampedSlot(reg.member.stamps || 1);
      setStep('active');
      showToast('¡Bienvenido! Ya tenés tu 1° sello cargado en la tarjeta.', 'success');
    } catch (err: any) {
      setFormError(err?.message || 'No pudimos activar tu tarjeta.');
    } finally {
      setSubmitting(false);
    }
  };

  // Recuperación compacta ("¿Ya tenés tarjeta? Ingresar →") conectada con POST /api/club/recover
  const handleRecoverByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Ingresá el email con el que creaste tu tarjeta.');
      return;
    }

    try {
      setRecovering(true);
      if (!recoveryOtpSent) {
        const recognized = await api.recognizeAccount(cleanEmail);
        const existingCard = recognized.cards?.find(
          (c) => !hub || c.businessId === hub.business.id
        );

        // Llamar a POST /api/club/recover para enviar renderRecoverCardEmail con OTP de 4 dígitos y Magic Link
        const recoverRes = await fetch('/api/club/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            businessName: hub?.business.name || 'La Burger',
            customerName: existingCard?.name || cleanEmail.split('@')[0],
            localCode: hub?.cartel.code || targetCode,
            currentStamps: existingCard?.stamps ?? 1,
            stampsRequired: hub?.club?.config?.targetStamps ?? 10,
          }),
        })
          .then((r) => r.json())
          .catch(() => ({ previewCode: '1234' }));

        setRecoveryOtpSent(true);
        setRecoveryOtpHint(recoverRes?.previewCode || null);
        showToast(`Enviamos el código de 4 dígitos y enlace mágico a ${cleanEmail}`, 'success');
      } else {
        const verifyRes = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, code: recoveryOtpCode.trim() }),
        });
        if (!verifyRes.ok && recoveryOtpHint && recoveryOtpCode.trim() !== recoveryOtpHint) {
          throw new Error('El código ingresado no coincide.');
        }

        const recognized = await api.recognizeAccount(cleanEmail);
        const existingCard = recognized.cards?.find(
          (c) => !hub || c.businessId === hub.business.id
        );

        if (existingCard) {
          const storageKey = `toque_member_${hub?.business.id || 'la-burger'}`;
          localStorage.setItem(storageKey, JSON.stringify(existingCard));
          setJoinedMember(existingCard);
          setStep('active');

          try {
            const stampRes = await api.claimSelfStamp({
              localCode: hub?.cartel.code || targetCode,
              memberId: existingCard.id,
            });
            setJoinedMember(stampRes.member);
            setAutoStampedThisVisit(true);
            setNewlyStampedSlot(stampRes.member.stamps);
            localStorage.setItem(storageKey, JSON.stringify(stampRes.member));
            showToast(
              `¡Hola de nuevo, ${stampRes.member.name || 'Socio'}! Sumaste +1 sello`,
              'success'
            );
          } catch {
            showToast(`¡Tarjeta vinculada, ${existingCard.name || 'Socio'}!`, 'success');
          }
        } else {
          setEmail(cleanEmail);
          setShowRecoveryInput(false);
          setRecoveryOtpSent(false);
          showToast('Completá tu nombre y fecha de nacimiento para estrenar tu tarjeta.', 'info');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'No pudimos recuperar la tarjeta.');
    } finally {
      setRecovering(false);
    }
  };

  // Emitir pase para Apple Wallet / Google Wallet o Fallback Web Pass Infalible
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

      if (pass.fallbackWebPass) {
        setShowWebPassModal(true);
        showToast('Pase Web de Billetera listo con QR y Código de Barras real.', 'success');
        return;
      }

      const url = targetWallet === 'apple' ? pass.appleWalletUrl : pass.googleWalletUrl;
      showToast(
        targetWallet === 'apple'
          ? 'Abriendo pase para Apple Wallet...'
          : 'Abriendo pase para Google Wallet...',
        'success'
      );
      if (url && url !== '#' && !url.includes('?passId=')) {
        window.location.href = url;
      } else {
        setShowWebPassModal(true);
      }
    } catch {
      setShowWebPassModal(true);
    } finally {
      setGeneratingPass(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-4">
          <Skeleton className="h-56 w-full rounded-3xl bg-[#141418]" />
          <Skeleton className="h-64 w-full rounded-3xl bg-[#141418]" />
        </div>
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] p-6 flex items-center justify-center">
        <div className="max-w-sm w-full rounded-3xl bg-[#141418] border border-[#282830] p-8 text-center space-y-4">
          <BrandLogo variant="isotipo" size="md" className="mx-auto" />
          <h1 className="text-xl font-bold text-[#F4F4F6]">Cartel no disponible</h1>
          <p className="text-sm text-[#9E9EA8]">
            {error || 'Verificá el código impreso en el cartel.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full py-3 rounded-2xl bg-[#D95B26] text-white font-bold text-sm"
          >
            Ir al inicio de Toque
          </Link>
        </div>
      </div>
    );
  }

  const { business, cartel, receipt, activeReceipt, club, config } = hub;
  const liveReceipt = activeReceipt || receipt;
  const enabledBlocks = new Set(hub.blocks.filter((b) => b.enabled).map((b) => b.key));
  const isFreePlan = planState?.status === 'free' || planState?.planId === 'free';

  const clubCfg = club?.config;
  const cardBgColor = clubCfg?.cardThemeColor || clubCfg?.brandColor || '#1e1b4b';
  const targetStamps = clubCfg?.targetStamps || clubCfg?.stampsRequired || 10;
  const currentStamps = Math.min(targetStamps, joinedMember?.stamps || 0);
  const remainingStamps = Math.max(0, targetStamps - currentStamps);
  const rewardLabel =
    clubCfg?.loyaltyReward ||
    clubCfg?.rewardText ||
    'Combo aniversario sin cargo en tu visita #10';
  const memberBarcode = joinedMember?.memberCode || joinedMember?.id || 'LB-1001';

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] py-5 px-4 flex flex-col items-center">
      <div className="max-w-md w-full space-y-4">
        {/* ================================================================= */}
        {/* CABECERA DEL HUB: IDENTIDAD DEL COMERCIO + CONEXIÓN EN VIVO       */}
        {/* ================================================================= */}
        <header className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#141418] border border-[#282830]">
          <div className="flex items-center gap-3 min-w-0">
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.name}
                className="w-10 h-10 rounded-xl object-cover border border-[#282830] shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#D95B26]/15 border border-[#D95B26]/40 text-[#D95B26] font-extrabold text-base flex items-center justify-center shrink-0">
                {business.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-[#F4F4F6] truncate">{business.name}</h1>
              <p className="text-[11px] text-[#9E9EA8] truncate">
                Mostrador NFC · {cartel.code}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2FB36A]/15 border border-[#2FB36A]/30 text-[11px] font-bold text-[#2FB36A] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2FB36A] animate-pulse" />
            <span>En vivo</span>
          </div>
        </header>

        {/* ================================================================= */}
        {/* RECIBO DIGITAL ESTILO TICKET TÉRMICO (SI HAY COMPRA EN CAJA)      */}
        {/* ================================================================= */}
        {enabledBlocks.has('receipt') && liveReceipt && (
          <section className="rounded-3xl bg-[#F4F4F6] text-[#0C0C0E] p-5 shadow-2xl border-2 border-[#2FB36A] space-y-3">
            <div className="flex items-center justify-between border-b border-dashed border-[#0C0C0E]/25 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#0C0C0E]">
                <ReceiptIcon className="w-4 h-4 text-[#D95B26]" />
                <span>Ticket Digital {business.name}</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#2FB36A] text-[#05180d] text-[10px] font-extrabold uppercase">
                Recién emitido
              </span>
            </div>

            <div className="font-receipt space-y-1.5 text-xs">
              {liveReceipt.items && liveReceipt.items.length > 0 ? (
                liveReceipt.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {item.quantity || 1}x {item.name}
                    </span>
                    <span className="font-bold">{formatARS(item.price * (item.quantity || 1))}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span>1x Consumo en mostrador</span>
                  <span className="font-bold">{formatARS(liveReceipt.total)}</span>
                </div>
              )}
              <div className="border-t border-dashed border-[#0C0C0E]/30 pt-2 flex items-baseline justify-between">
                <span className="font-bold uppercase">TOTAL ABONADO</span>
                <span className="text-2xl font-extrabold">{formatARS(liveReceipt.total)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/r/${liveReceipt.id}`)}
              className="w-full py-3 px-4 rounded-xl bg-[#0C0C0E] hover:bg-[#1C1C22] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Abrir comprobante completo</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#D95B26]" />
            </button>
          </section>
        )}

        {/* ================================================================= */}
        {/* A. TARJETA DIGITAL DE SELLOS (SI EL COMERCIO TIENE PLAN PRO/TRIAL)*/}
        {/* ================================================================= */}
        {!isFreePlan && (
          <>
            <section
              aria-label={`Tarjeta de sellos de ${business.name}`}
              style={{ backgroundColor: cardBgColor }}
              className="rounded-3xl p-6 text-white border border-white/15 shadow-2xl space-y-5 relative overflow-hidden"
            >
              {/* Cabecera de la tarjeta */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center font-extrabold text-lg text-white shrink-0">
                    {business.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {clubCfg?.loyaltyTitle || `Tarjeta de sellos de ${business.name}`}
                    </p>
                    <p className="text-[11px] text-white/80 truncate">🎁 {rewardLabel}</p>
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
                {Array.from({ length: targetStamps }).map((_, idx) => {
                  const slotNumber = idx + 1;
                  const isEarned = slotNumber <= currentStamps;
                  const isNext = slotNumber === currentStamps + 1;
                  const isRewardSlot = slotNumber === targetStamps;
                  const isJustPopped = newlyStampedSlot === slotNumber;

                  if (isEarned) {
                    return (
                      <div
                        key={slotNumber}
                        className={`aspect-square rounded-full bg-white text-[#0C0C0E] flex items-center justify-center shadow-md ${
                          isJustPopped ? 'animate-stamp-pop ring-4 ring-[#2FB36A]' : ''
                        }`}
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
                    ? '¡Completaste los sellos! Mostrá tu tarjeta en caja para canjear tu premio'
                    : `Faltan ${remainingStamps} ${remainingStamps === 1 ? 'sello' : 'sellos'} para tu premio`}
                </span>
                <span className="text-[11px] text-white/75 shrink-0">
                  {clubCfg?.howToEarn || '1 sello por visita'}
                </span>
              </div>
            </section>

            {/* ============================================================= */}
            {/* B. PRIMERA VISITA (FORMULARIO 3 CAMPOS + PICKER FECHA NATIVO) */}
            {/* ============================================================= */}
            {step === 'form' && (
              <section className="rounded-3xl bg-[#141418] border border-[#282830] p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#D95B26]">
                      1° Visita · Sumá tu primer sello hoy
                    </span>
                    <h2 className="text-lg font-bold text-[#F4F4F6] leading-snug">
                      Súmate al Club de {business.name}
                    </h2>
                    <p className="text-xs text-[#9E9EA8]">
                      Completá estos 3 datos una sola vez y recibí tu 1° sello al instante.
                    </p>
                  </div>

                  {/* Link compacto "¿Ya tenés tarjeta? Ingresar →" */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecoveryInput((v) => !v);
                      setFormError(null);
                    }}
                    className="shrink-0 text-[11px] font-bold text-[#BEC8FF] hover:text-white underline cursor-pointer"
                  >
                    ¿Ya tenés tarjeta? Ingresar →
                  </button>
                </div>

                {/* Mini-input de recuperación rápida si borró caché o cambió de teléfono */}
                {showRecoveryInput && (
                  <form
                    onSubmit={handleRecoverByEmail}
                    className="p-3.5 rounded-2xl bg-[#1C1C22] border border-[#BEC8FF]/30 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#BEC8FF]">
                        Recuperar mi tarjeta existente
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRecoveryInput(false);
                          setRecoveryOtpSent(false);
                        }}
                        className="text-[11px] text-[#9E9EA8] hover:text-white cursor-pointer"
                      >
                        Cerrar ✕
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        required
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="tu@email.com"
                        className="flex-1 px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] focus:outline-none focus:border-[#BEC8FF]"
                      />
                      {!recoveryOtpSent && (
                        <button
                          type="submit"
                          disabled={recovering}
                          className="px-3.5 py-2 rounded-xl bg-[#BEC8FF] text-[#0C0C0E] font-bold text-xs cursor-pointer"
                        >
                          {recovering ? '...' : 'Recuperar'}
                        </button>
                      )}
                    </div>

                    {recoveryOtpSent && (
                      <div className="space-y-2 pt-1">
                        {recoveryOtpHint && (
                          <p className="text-[11px] text-[#BEC8FF]">
                            Código rápido de acceso: <strong>{recoveryOtpHint}</strong>
                          </p>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            required
                            value={recoveryOtpCode}
                            onChange={(e) =>
                              setRecoveryOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                            }
                            placeholder="Código de 4 dígitos"
                            className="flex-1 px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs font-mono tracking-widest text-[#F4F4F6]"
                          />
                          <button
                            type="submit"
                            disabled={recovering || recoveryOtpCode.length < 4}
                            className="px-3.5 py-2 rounded-xl bg-[#2FB36A] text-[#06130b] font-bold text-xs cursor-pointer"
                          >
                            Confirmar
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {formError && (
                  <div
                    role="alert"
                    className="p-3 rounded-2xl bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]"
                  >
                    {formError}
                  </div>
                )}

                {/* Formulario de 3 Campos Obligatorios */}
                <form onSubmit={handleQuickRegister} className="space-y-3.5">
                  {/* 1. Nombre */}
                  <div>
                    <label
                      htmlFor="hub-name-input"
                      className="block text-xs font-semibold text-[#F4F4F6] mb-1"
                    >
                      1. Nombre
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="hub-name-input"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tu nombre"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
                      />
                    </div>
                  </div>

                  {/* 2. Email */}
                  <div>
                    <label
                      htmlFor="hub-email-input"
                      className="block text-xs font-semibold text-[#F4F4F6] mb-1"
                    >
                      2. Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="hub-email-input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
                      />
                    </div>
                  </div>

                  {/* 3. Fecha de Nacimiento / Edad (Picker Nativo del Celular) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="hub-birthdate-input"
                        className="block text-xs font-semibold text-[#F4F4F6]"
                      >
                        3. Fecha de nacimiento (para tu regalo de cumple)
                      </label>
                      {calculatedAge !== null && (
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isMinor
                              ? 'bg-[#BEC8FF]/15 text-[#BEC8FF]'
                              : 'bg-[#2FB36A]/15 text-[#2FB36A]'
                          }`}
                        >
                          {calculatedAge} años {isMinor ? '· Modo menor protegido' : ''}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="hub-birthdate-input"
                        type="date"
                        required
                        max={new Date().toISOString().slice(0, 10)}
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                      />
                    </div>
                  </div>

                  {/* Permisos adaptados automáticamente según edad */}
                  {isMinor ? (
                    <div className="p-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-[11px] text-[#9E9EA8]">
                      Detectamos que sos menor de 18 años: tu tarjeta queda activa con privacidad
                      protegida (sin envíos publicitarios).
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 text-xs text-[#9E9EA8] cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="rounded border-[#282830] bg-[#0C0C0E] text-[#D95B26]"
                      />
                      <span>Recibir avisos de premios y beneficios de {business.name}</span>
                    </label>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#D95B26] hover:bg-[#e36630] text-white font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#D95B26]/20"
                  >
                    {submitting ? 'Activando y sumando 1° sello...' : 'Sumar mi 1° sello y activar tarjeta'}
                  </button>

                  {/* Línea legal minimalista (1 sola línea con modal al tocar) */}
                  <p className="text-[11px] text-center text-[#666672] pt-1">
                    Tus datos son exclusivos de este comercio.{' '}
                    <button
                      type="button"
                      onClick={() => setShowLegalModal(true)}
                      className="text-[#9E9EA8] underline hover:text-white cursor-pointer"
                    >
                      Ver Privacidad (Ley 25.326)
                    </button>
                  </p>
                </form>
              </section>
            )}

            {/* ============================================================= */}
            {/* C. SEGUNDA VISITA Y SIGUIENTES (AUTO-SELLO + WALLET + BARCODE)*/}
            {/* ============================================================= */}
            {step === 'active' && joinedMember && (
              <section className="rounded-3xl bg-[#141418] border border-[#282830] p-6 space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#2FB36A]/15 border border-[#2FB36A]/30 text-[#2FB36A] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#F4F4F6]">
                        ¡Hola de nuevo, {joinedMember.name || 'Socio'}!
                      </h2>
                      <p className="text-[11px] text-[#9E9EA8]">
                        {autoStampedThisVisit
                          ? 'Se sumó +1 sello automático por tu visita de hoy.'
                          : 'Tu tarjeta está activa y sincronizada con el mostrador.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem(`toque_member_${business.id}`);
                      setJoinedMember(null);
                      setStep('form');
                    }}
                    className="text-[11px] text-[#666672] hover:text-[#9E9EA8] underline cursor-pointer shrink-0"
                  >
                    Cambiar cuenta
                  </button>
                </div>

                {/* Código de Barras Real CODE128 + QR Real para Lector de Caja */}
                <div className="rounded-2xl bg-white text-[#0C0C0E] p-4 flex flex-col items-center text-center space-y-3 shadow-inner">
                  <RealBarcode128 value={memberBarcode} height={52} />
                  <div className="pt-1 border-t border-black/10 w-full flex items-center justify-between px-2">
                    <div className="text-left">
                      <span className="block text-[9px] uppercase tracking-widest text-neutral-500 font-bold">
                        Socio {business.name}
                      </span>
                      <span className="font-mono text-sm font-extrabold tracking-wider">
                        {memberBarcode}
                      </span>
                    </div>
                    <RealQrCode value={memberBarcode} size={68} className="rounded-lg" />
                  </div>
                </div>

                {/* Botones de Apple Wallet y Google Wallet */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={generatingPass}
                    onClick={() => handleGenerateWalletPass('apple')}
                    className="w-full py-3 px-4 rounded-2xl bg-[#1C1C22] hover:bg-[#25252d] border border-[#282830] text-xs font-bold text-[#F4F4F6] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Wallet className="w-4 h-4 text-[#D95B26]" />
                    <span>Guardar en Apple Wallet</span>
                  </button>

                  <button
                    type="button"
                    disabled={generatingPass}
                    onClick={() => handleGenerateWalletPass('google')}
                    className="w-full py-3 px-4 rounded-2xl bg-[#1C1C22] hover:bg-[#25252d] border border-[#282830] text-xs font-bold text-[#F4F4F6] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Wallet className="w-4 h-4 text-[#2FB36A]" />
                    <span>Guardar en Google Wallet</span>
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {/* ================================================================= */}
        {/* MÓDULOS COMPLEMENTARIOS DEL HUB: RESEÑAS, CATÁLOGO Y REDES        */}
        {/* ================================================================= */}
        {enabledBlocks.has('review') && (
          <div className="rounded-3xl bg-[#141418] border border-[#282830] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F4F4F6]">
                  ¿Qué te pareció tu visita a {business.name}?
                </h3>
                <p className="text-xs text-[#9E9EA8]">
                  Calificanos en 1 toque en Google Maps.
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
              className="w-full py-3 px-5 rounded-2xl bg-[#1C1C22] hover:bg-[#26262e] border border-[#282830] text-[#F4F4F6] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Dejar reseña en Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#D95B26]" />
            </button>
          </div>
        )}

        {enabledBlocks.has('products') && config.products && config.products.length > 0 && (
          <div className="rounded-3xl bg-[#141418] border border-[#282830] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#D95B26]" />
              <h3 className="text-sm font-bold text-[#F4F4F6]">Destacados del Local</h3>
            </div>
            <div className="space-y-2">
              {config.products
                .filter((p) => p.featuredInHub !== false)
                .slice(0, 8)
                .map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3 rounded-2xl bg-[#1C1C22] border border-[#282830] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#F4F4F6] truncate">{prod.title}</p>
                      {prod.description && (
                        <p className="text-xs text-[#9E9EA8] truncate">{prod.description}</p>
                      )}
                    </div>
                    {prod.price !== undefined && (
                      <span className="text-sm font-bold text-[#BEC8FF] shrink-0">
                        {formatARS(prod.price)}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {(enabledBlocks.has('socials') || enabledBlocks.has('details')) && (
          <div className="rounded-3xl bg-[#141418] border border-[#282830] p-5 space-y-4">
            {enabledBlocks.has('socials') && (
              <div className="grid grid-cols-2 gap-2">
                {config.socials.instagram && (
                  <a
                    href={`https://instagram.com/${config.socials.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs font-medium text-[#F4F4F6]"
                  >
                    <Instagram className="w-4 h-4 text-[#D95B26]" />
                    <span className="truncate">@{config.socials.instagram.replace('@', '')}</span>
                  </a>
                )}
                {config.socials.whatsapp && (
                  <a
                    href={`https://wa.me/${config.socials.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs font-medium text-[#F4F4F6]"
                  >
                    <MessageCircle className="w-4 h-4 text-[#2FB36A]" />
                    <span>WhatsApp</span>
                  </a>
                )}
                {config.socials.web && (
                  <a
                    href={config.socials.web}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs font-medium text-[#F4F4F6] col-span-2"
                  >
                    <Globe className="w-4 h-4 text-[#BEC8FF]" />
                    <span className="truncate">{config.socials.web}</span>
                  </a>
                )}
              </div>
            )}

            {enabledBlocks.has('details') &&
              (config.details.address || config.details.hours || config.details.phone) && (
                <div className="space-y-2 text-xs text-[#9E9EA8]">
                  {config.details.address && (
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-[#D95B26] shrink-0" />
                      <span>{config.details.address}</span>
                    </div>
                  )}
                  {config.details.hours && (
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-[#D95B26] shrink-0" />
                      <span>{config.details.hours}</span>
                    </div>
                  )}
                  {config.details.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-[#D95B26] shrink-0" />
                      <span>{config.details.phone}</span>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {/* Pie del Hub con insignia oficial Toque */}
        <footer className="pt-2 pb-12 text-center">
          <Link to="/" className="inline-flex">
            <BrandLogo variant="badge" />
          </Link>
        </footer>
      </div>

      {/* =================================================================== */}
      {/* MODAL DE PASE WEB DE BILLETERA INFALIBLE (CODE128 REAL + QR REAL)   */}
      {/* =================================================================== */}
      {showWebPassModal && joinedMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="max-w-sm w-full rounded-3xl overflow-hidden bg-[#141418] border border-[#282830] shadow-2xl">
            <div
              style={{ backgroundColor: cardBgColor }}
              className="p-5 text-white flex items-center justify-between"
            >
              <div>
                <span className="text-[10px] uppercase tracking-widest text-white/75 font-bold">
                  PASE DIGITAL WALLET
                </span>
                <h3 className="text-lg font-extrabold">{business.name}</h3>
                <p className="text-xs text-white/85">{joinedMember.name}</p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase block text-white/75">Sellos</span>
                <span className="text-2xl font-extrabold">
                  {currentStamps}/{targetStamps}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4 bg-white text-[#0C0C0E] text-center">
              <p className="text-xs font-bold text-neutral-600">
                Mostrá este pase al cajero para escanear con lector de código de barras o cámara QR
              </p>
              <RealBarcode128 value={memberBarcode} height={60} />
              <div className="flex justify-center pt-2">
                <RealQrCode value={memberBarcode} size={148} />
              </div>
            </div>

            <div className="p-4 bg-[#141418] flex items-center justify-between">
              <span className="text-xs text-[#9E9EA8]">
                Guardado automáticamente en tu navegador
              </span>
              <button
                type="button"
                onClick={() => setShowWebPassModal(false)}
                className="px-4 py-2 rounded-xl bg-[#D95B26] text-white text-xs font-bold cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL DE PRIVACIDAD LEY 25.326                                      */}
      {/* =================================================================== */}
      {showLegalModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="max-w-md w-full rounded-3xl bg-[#141418] border border-[#282830] p-6 space-y-4 text-xs text-[#9E9EA8]">
            <div className="flex items-center justify-between text-[#F4F4F6]">
              <div className="flex items-center gap-2 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-[#2FB36A]" />
                <span>Protección de Datos Personales (Ley 25.326)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLegalModal(false)}
                className="p-1 text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="leading-relaxed">
              Tus datos ({name || 'nombre'}, correo y fecha de nacimiento) se utilizan
              exclusivamente para administrar tu tarjeta de sellos en{' '}
              <strong className="text-white">{business.name}</strong>. Si sos menor de 18 años, el
              sistema desactiva automáticamente el envío de comunicaciones publicitarias.
            </p>
            <p className="text-[11px] text-[#666672] leading-relaxed">
              El titular de los datos personales tiene la facultad de ejercer el derecho de acceso,
              rectificación o supresión en forma gratuita conforme al art. 14 inc. 3 de la Ley Nº
              25.326 ante la Agencia de Acceso a la Información Pública (AAIP).
            </p>
            <button
              type="button"
              onClick={() => setShowLegalModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-white font-bold cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
