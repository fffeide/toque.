import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api';
import { PublicHub, ClubMember, WalletPassResponse, Receipt, HubBlockKey } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { BrandLogo } from '../../components/ui/Avatar';
import { WalletPassCard } from '../../components/wallet/WalletPassCard';
import { DieCutTicket } from '../../components/ticket/DieCutTicket';
import { detectWalletOS, getWalletButtonLabel } from '../../lib/walletOs';
import { formatARS } from '../../lib/format';
import {
  loadConsumerVault,
  computeConsumerKPIs,
  getOrCreateLocalConsumerUser,
  saveLocalConsumerUser,
  upsertLocalConsumerStamp,
  addLocalConsumerReceipt,
} from '../../lib/consumerStorage';
import QRCode from 'qrcode';
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
  ShoppingBag,
  Wallet,
  Check,
  Mail,
  User as UserIcon,
  Calendar,
  X,
  ShieldCheck,
  Download,
  CreditCard,
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

function isConfiguredReviewUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  // Evitar mostrar el bloque si tiene la URL genérica por defecto sin enlace real del comercio
  if (
    trimmed === 'https://maps.google.com' ||
    trimmed === 'https://maps.google.com/' ||
    trimmed === 'http://maps.google.com'
  ) {
    return false;
  }
  return true;
}

export const PublicHubView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const targetCode = code || 'BURGER01';

  const [hub, setHub] = useState<PublicHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comprobante fijado por sesión del cliente para que un 2° cobro en caja a otra persona no le reemplace su ticket al recargar
  const [pinnedReceipt, setPinnedReceipt] = useState<Receipt | null>(null);
  const [isReceiptExpired, setIsReceiptExpired] = useState(false);
  const [pendingRedirectToToquecitos, setPendingRedirectToToquecitos] = useState(false);

  // Estado de la Tarjeta de Sellos del Cliente + Verificación OTP de Email
  const [step, setStep] = useState<'form' | 'verify_email' | 'active'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDay, setBirthDay] = useState<string>('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Verificación de Email con código OTP al registrarse en el Hub
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpHint, setEmailOtpHint] = useState<string | null>(null);

  // Recuperación compacta "¿Ya tenés tarjeta? Ingresar →"
  const [showRecoveryInput, setShowRecoveryInput] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryOtpSent, setRecoveryOtpSent] = useState(false);
  const [recoveryOtpCode, setRecoveryOtpCode] = useState('');
  const [recoveryOtpHint, setRecoveryOtpHint] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  // Modal Legal Ley 25.326
  const [showLegalModal, setShowLegalModal] = useState(false);

  // Modal Simple de Toquecito
  const [showToquecitoModal, setShowToquecitoModal] = useState(false);

  // Tarjeta activa, Auto-Sello y Pase de Wallet
  const [joinedMember, setJoinedMember] = useState<ClubMember | null>(null);
  const [autoStampedThisVisit, setAutoStampedThisVisit] = useState(false);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);
  const [newlyStampedSlot, setNewlyStampedSlot] = useState<number | null>(null);
  const [, setWalletPass] = useState<WalletPassResponse | null>(null);
  const [showWebPassModal, setShowWebPassModal] = useState(false);
  const [generatingPass, setGeneratingPass] = useState(false);

  const clubSectionRef = useRef<HTMLDivElement>(null);
  const processedReceiptStampsRef = useRef<Set<string>>(new Set());

  const walletOS = useMemo(() => detectWalletOS(), []);
  const walletButtonLabel = useMemo(() => getWalletButtonLabel(walletOS), [walletOS]);

  const saveReceiptToConsumerStorage = (rcp: Receipt, currentHub: PublicHub) => {
    try {
      addLocalConsumerReceipt({
        id: rcp.id,
        tenantId: currentHub.business.id,
        businessId: currentHub.business.id,
        merchantName: currentHub.business.name,
        cartelCode: currentHub.cartel.code,
        amountArs: rcp.total,
        total: rcp.total,
        currency: 'ARS',
        items: rcp.items || [],
        method: rcp.method,
        discountSavedArs: 0,
        category: 'Comercio',
        receiptNote:
          rcp.items && rcp.items.length > 0
            ? rcp.items.map((i) => `${i.quantity || 1}x ${i.name}`).join(', ')
            : 'Consumo en mostrador',
        createdAt: rcp.createdAt,
      });
    } catch {
      // ignore
    }
  };

  const syncMemberWithToquecitos = (member: ClubMember, currentHub?: PublicHub | null) => {
    const activeHub = currentHub || hub;
    const bizId = activeHub?.business.id || member.businessId || 'la-burger';
    const bizName = activeHub?.business.name || member.businessName || 'La Burger';
    const localCodeVal = activeHub?.cartel.code || member.localCode || targetCode;
    const clubCfgVal = activeHub?.club?.config;
    const stampsReq =
      clubCfgVal?.targetStamps ||
      clubCfgVal?.stampsRequired ||
      member.stampsRequired ||
      member.targetStamps ||
      10;
    const rewardTxt =
      clubCfgVal?.loyaltyReward ||
      clubCfgVal?.rewardText ||
      member.rewardText ||
      'Beneficio exclusivo al completar tus sellos';
    const brandCol =
      clubCfgVal?.cardThemeColor || clubCfgVal?.brandColor || '#D95B26';

    const enrichedMember: ClubMember = {
      ...member,
      businessId: bizId,
      businessName: bizName,
      localCode: localCodeVal,
      stampsRequired: stampsReq,
      targetStamps: stampsReq,
      rewardText: rewardTxt,
      colorPreset: member.colorPreset || clubCfgVal?.colorPreset || 'dark',
      customColor: member.customColor || clubCfgVal?.customColor,
      logoUrl: member.logoUrl || clubCfgVal?.logoUrl || activeHub?.business.logoUrl,
    };

    try {
      localStorage.setItem(`toque_member_${bizId}`, JSON.stringify(enrichedMember));
      localStorage.setItem('toque_last_hub_code', localCodeVal);

      const rawMembers = localStorage.getItem('toque_club_members_v1');
      const existingMembers: ClubMember[] = rawMembers ? JSON.parse(rawMembers) : [];
      const filtered = Array.isArray(existingMembers)
        ? existingMembers.filter((m) => m.id !== enrichedMember.id)
        : [];
      localStorage.setItem(
        'toque_club_members_v1',
        JSON.stringify([enrichedMember, ...filtered])
      );

      upsertLocalConsumerStamp({
        tenantId: bizId,
        merchantName: bizName,
        stamps: enrichedMember.stamps || 0,
        stampsRequired: stampsReq,
        rewardText: rewardTxt,
        brandColor: brandCol,
      });

      if (enrichedMember.email && enrichedMember.email.includes('@')) {
        const cleanMail = enrichedMember.email.trim().toLowerCase();
        const currentConsumer = getOrCreateLocalConsumerUser();
        saveLocalConsumerUser({
          ...currentConsumer,
          emailOrPhone: cleanMail,
          displayName:
            enrichedMember.name ||
            (currentConsumer.displayName !== 'Tus tarjetas'
              ? currentConsumer.displayName
              : cleanMail.split('@')[0]),
          syncedAt: new Date().toISOString(),
        });
        localStorage.setItem(
          'toque_recognized_client_v1',
          JSON.stringify({
            accountId: enrichedMember.accountId || `acc-${cleanMail}`,
            name: enrichedMember.name || cleanMail.split('@')[0],
            email: cleanMail,
            birthDay: enrichedMember.birthDay,
            birthMonth: enrichedMember.birthMonth,
          })
        );
      }
    } catch {
      // ignore storage errors
    }
  };

  // Resolver la versión más fresca del miembro desde toque_club_members_v1 para reflejar ajustes manuales del panel
  const resolveLatestMember = (candidate: ClubMember | null, bizId: string): ClubMember | null => {
    if (!candidate) return null;
    try {
      const rawAll = localStorage.getItem('toque_club_members_v1');
      if (rawAll) {
        const list: ClubMember[] = JSON.parse(rawAll);
        if (Array.isArray(list)) {
          const match = list.find(
            (m) =>
              m.id === candidate.id ||
              (m.email &&
                candidate.email &&
                m.email.toLowerCase() === candidate.email.toLowerCase() &&
                (!m.businessId || m.businessId === bizId))
          );
          if (match) return match;
        }
      }
    } catch {
      // ignore
    }
    return candidate;
  };

  const handleOpenToquecitos = () => {
    const localCodeVal = hub?.cartel.code || targetCode;
    try {
      localStorage.setItem('toque_last_hub_code', localCodeVal);
      if (joinedMember) {
        syncMemberWithToquecitos(joinedMember, hub);
      }
      const activeRcp = pinnedReceipt || hub?.activeReceipt || hub?.receipt;
      if (activeRcp && hub) {
        saveReceiptToConsumerStorage(activeRcp, hub);
      }
    } catch {
      // ignore
    }
    navigate(`/toquecitos?from=${encodeURIComponent(localCodeVal)}`);
  };

  const handleExpiredReceiptCta = () => {
    const activeRcp = pinnedReceipt || hub?.activeReceipt || hub?.receipt;
    if (activeRcp && hub) {
      saveReceiptToConsumerStorage(activeRcp, hub);
    }
    if (step === 'active' && joinedMember) {
      handleOpenToquecitos();
    } else {
      setPendingRedirectToToquecitos(true);
      showToast(
        'Completá o ingresá tu correo para guardar el comprobante y abrirlo en Toquecitos.',
        'info'
      );
      clubSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    let active = true;
    const sessionReceiptKey = `toque_session_receipt_${targetCode.toUpperCase()}`;

    const resolveSessionReceipt = (incomingReceipt: Receipt | null | undefined): Receipt | null => {
      try {
        const rawPinned = sessionStorage.getItem(sessionReceiptKey);
        if (rawPinned) {
          const parsed = JSON.parse(rawPinned) as Receipt;
          if (parsed && parsed.id) {
            return parsed;
          }
        }
        if (incomingReceipt) {
          sessionStorage.setItem(sessionReceiptKey, JSON.stringify(incomingReceipt));
          return incomingReceipt;
        }
      } catch {
        // ignore
      }
      return incomingReceipt || null;
    };

    const loadInitial = async () => {
      try {
        setLoading(true);
        const data = await api.getPublicHub(targetCode);
        if (!active) return;

        await api.recordHubEvent(targetCode, 'scan');

        const incomingRcp = data.activeReceipt || data.receipt || null;
        const effectiveReceipt = resolveSessionReceipt(incomingRcp);
        setPinnedReceipt(effectiveReceipt);

        if (
          (data.config.mode === 'direct' || data.config.mode === 'direct_review') &&
          !effectiveReceipt &&
          isConfiguredReviewUrl(data.reviewUrl)
        ) {
          window.location.href = data.reviewUrl;
          return;
        }

        setHub(data);

        if (data.unpaidLockdown) {
          return;
        }

        // Magic Link (?recoverEmail=...&otp=...)
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
            const restoredCard =
              recAcc.cards?.find((c) => c.businessId === data.business.id) || recAcc.cards?.[0];
            if (restoredCard && active) {
              localStorage.setItem(
                `toque_member_${data.business.id}`,
                JSON.stringify(restoredCard)
              );
              setJoinedMember(restoredCard);
              setStep('active');
              showToast(
                `¡Tarjeta recuperada, ${restoredCard.name || 'Socio'}!`,
                'success'
              );
              return;
            }
          } catch {
            // Continúa flujo normal
          }
        }

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

        const recognized = resolveLatestMember(
          data.club?.member || storedMember || null,
          data.business.id
        );

        if (recognized) {
          setJoinedMember(recognized);
          setStep('active');
          syncMemberWithToquecitos(recognized, data);

          // Si el usuario ya está registrado y hay un comprobante, se guarda automáticamente sin tocar nada
          if (effectiveReceipt) {
            saveReceiptToConsumerStorage(effectiveReceipt, data);
          }

          // Si hay una nueva compra (incomingRcp) que aún no sumó sello en esta tarjeta, sumar +1 sello por esa compra
          const receiptForStamp = incomingRcp || effectiveReceipt;
          const alreadyStampedReceipt =
            receiptForStamp &&
            (processedReceiptStampsRef.current.has(receiptForStamp.id) ||
              recognized.stampHistory?.some(
                (s) => s.receiptId === receiptForStamp.id && !s.voided
              ));

          if (receiptForStamp && !alreadyStampedReceipt) {
            processedReceiptStampsRef.current.add(receiptForStamp.id);
            try {
              const stampRes = await api.claimSelfStamp({
                localCode: data.cartel.code,
                memberId: recognized.id,
                receiptId: receiptForStamp.id,
              });
              if (active && stampRes.stampsAdded > 0) {
                setJoinedMember(stampRes.member);
                setAutoStampedThisVisit(true);
                setNewlyStampedSlot(stampRes.member.stamps);
                localStorage.setItem(storageKey, JSON.stringify(stampRes.member));
                syncMemberWithToquecitos(stampRes.member, data);
                showToast(
                  `¡Sumaste +1 sello por tu compra en ${data.business.name}!`,
                  'success'
                );
              }
            } catch {
              // ignore
            }
          } else {
            // Regla estricta de 24 horas para visitas sin nuevo comprobante
            const cooldownKey = `toque_autostamp_${data.business.id}_${recognized.id}`;
            const lastStampedIso = recognized.lastStampedAt;
            const lastStampMs = lastStampedIso
              ? new Date(lastStampedIso).getTime()
              : Number(localStorage.getItem(cooldownKey) || '0');
            const twentyFourHoursMs = 86400000;
            const elapsedMs = Date.now() - lastStampMs;

            if (!lastStampMs || elapsedMs >= twentyFourHoursMs) {
              try {
                const stampRes = await api.claimSelfStamp({
                  localCode: data.cartel.code,
                  memberId: recognized.id,
                });
                if (active) {
                  if (stampRes.cooldown) {
                    setCooldownRemainingMs(stampRes.remainingMs || 0);
                  } else if (stampRes.stampsAdded > 0) {
                    setJoinedMember(stampRes.member);
                    setAutoStampedThisVisit(true);
                    setCooldownRemainingMs(twentyFourHoursMs);
                    setNewlyStampedSlot(stampRes.member.stamps);
                    localStorage.setItem(storageKey, JSON.stringify(stampRes.member));
                    localStorage.setItem(cooldownKey, String(Date.now()));
                    syncMemberWithToquecitos(stampRes.member, data);
                    showToast(
                      `¡Hola de nuevo, ${stampRes.member.name || 'Socio'}! Sumaste +1 sello por tu visita de hoy`,
                      'success'
                    );
                  }
                }
              } catch {
                localStorage.setItem(cooldownKey, String(Date.now()));
              }
            } else {
              setCooldownRemainingMs(Math.max(0, twentyFourHoursMs - elapsedMs));
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

    const unsubscribe = api.subscribeToCartelHub(targetCode, async (liveHub) => {
      if (!active) return;
      setHub(liveHub);

      const incomingRcp = liveHub.activeReceipt || liveHub.receipt || null;
      // Si todavía no había comprobante fijado en esta sesión y llega uno nuevo, lo fijamos
      setPinnedReceipt((prevPinned) => {
        if (prevPinned) return prevPinned;
        if (incomingRcp) {
          try {
            sessionStorage.setItem(sessionReceiptKey, JSON.stringify(incomingRcp));
          } catch {
            // ignore
          }
          return incomingRcp;
        }
        return null;
      });

      const currentMemberCandidate = resolveLatestMember(
        liveHub.club?.member || joinedMember,
        liveHub.business.id
      );

      if (currentMemberCandidate) {
        setJoinedMember(currentMemberCandidate);
        setStep('active');
        syncMemberWithToquecitos(currentMemberCandidate, liveHub);

        if (incomingRcp) {
          saveReceiptToConsumerStorage(incomingRcp, liveHub);

          // Si es una nueva compra en POS para este socio registrado, sumar +1 sello automáticamente
          const alreadyStamped =
            processedReceiptStampsRef.current.has(incomingRcp.id) ||
            currentMemberCandidate.stampHistory?.some(
              (s) => s.receiptId === incomingRcp.id && !s.voided
            );

          if (!alreadyStamped) {
            processedReceiptStampsRef.current.add(incomingRcp.id);
            try {
              const stampRes = await api.claimSelfStamp({
                localCode: liveHub.cartel.code,
                memberId: currentMemberCandidate.id,
                receiptId: incomingRcp.id,
              });
              if (active && stampRes.stampsAdded > 0) {
                setJoinedMember(stampRes.member);
                setAutoStampedThisVisit(true);
                setNewlyStampedSlot(stampRes.member.stamps);
                syncMemberWithToquecitos(stampRes.member, liveHub);
                showToast(
                  `¡Sumaste +1 sello por tu nueva compra en ${liveHub.business.name}!`,
                  'success'
                );
              }
            } catch {
              // ignore
            }
          }
        }
      }
    });

    // Sincronizar también cuando el usuario vuelve a la pestaña o cambia localStorage desde el panel
    const handleSyncFromPanel = () => {
      api.getPublicHub(targetCode).then((freshHub) => {
        if (!active) return;
        setHub(freshHub);
        const latest = resolveLatestMember(
          freshHub.club?.member || joinedMember,
          freshHub.business.id
        );
        if (latest) {
          setJoinedMember(latest);
        }
      }).catch(() => {});
    };

    window.addEventListener('focus', handleSyncFromPanel);
    window.addEventListener('storage', handleSyncFromPanel);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('focus', handleSyncFromPanel);
      window.removeEventListener('storage', handleSyncFromPanel);
    };
  }, [targetCode]);

  // Reloj en vivo para detectar cuando pasan los 2 minutos del comprobante y activar el blur + botón fade-in
  const displayedReceipt = pinnedReceipt || hub?.activeReceipt || hub?.receipt || null;

  useEffect(() => {
    if (!displayedReceipt) {
      setIsReceiptExpired(false);
      return;
    }

    const checkExpiration = () => {
      const expiresMs = new Date(displayedReceipt.expiresAt).getTime();
      if (!Number.isNaN(expiresMs) && Date.now() >= expiresMs) {
        setIsReceiptExpired(true);
      } else {
        setIsReceiptExpired(false);
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 1000);
    return () => clearInterval(interval);
  }, [displayedReceipt]);

  const handleReviewClick = async () => {
    if (!hub || !isConfiguredReviewUrl(hub.reviewUrl)) return;
    await api.recordHubEvent(hub.cartel.code, 'review_click');
    window.location.href = hub.reviewUrl;
  };

  // Paso 1: Validar datos del formulario y enviar código de verificación al email
  const handleStartEmailVerification = async (e: React.FormEvent) => {
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

    try {
      setSubmitting(true);
      const otpRes = await api.requestOtp(cleanEmail);
      setEmailOtpHint(otpRes.demoHintCode || null);
      setStep('verify_email');
      showToast(`Te enviamos un código de verificación a ${cleanEmail}`, 'success');
    } catch (err: any) {
      setFormError(err?.message || 'No pudimos enviar el código de verificación.');
    } finally {
      setSubmitting(false);
    }
  };

  // Paso 2: Verificar el código OTP del email y activar la tarjeta con el 1° sello
  const handleConfirmEmailAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = emailOtpCode.trim();

    if (cleanCode.length < 4) {
      setFormError('Ingresá el código de verificación que enviamos a tu correo.');
      return;
    }

    try {
      setSubmitting(true);
      try {
        await api.verifyOtp(cleanEmail, cleanCode);
      } catch (err: any) {
        if (!emailOtpHint || cleanCode !== emailOtpHint) {
          throw err;
        }
      }

      const dayNum = birthDay ? Number(birthDay) : undefined;
      const monthNum = birthMonth ? Number(birthMonth) : undefined;

      const reg = await api.registerMember({
        localCode: hub?.cartel.code || targetCode,
        name: name.trim(),
        email: cleanEmail,
        birthDay: dayNum,
        birthMonth: monthNum,
        marketingConsent,
      });

      // Si había un comprobante activo en esta visita, registrar su ID en el 1° sello para que una 2° compra posterior sume el 2° sello
      if (displayedReceipt) {
        processedReceiptStampsRef.current.add(displayedReceipt.id);
        if (reg.member.stampHistory && reg.member.stampHistory[0]) {
          reg.member.stampHistory[0].receiptId = displayedReceipt.id;
        }
        if (hub) {
          saveReceiptToConsumerStorage(displayedReceipt, hub);
        }
      }

      const storageKey = `toque_member_${hub?.business.id || 'la-burger'}`;
      const cooldownKey = `toque_autostamp_${hub?.business.id || 'la-burger'}_${reg.member.id}`;
      localStorage.setItem(storageKey, JSON.stringify(reg.member));
      localStorage.setItem(cooldownKey, String(Date.now()));
      syncMemberWithToquecitos(reg.member, hub);

      setJoinedMember(reg.member);
      setNewlyStampedSlot(reg.member.stamps || 1);
      setStep('active');
      showToast('¡Correo verificado! Ya tenés tu 1° sello cargado en la tarjeta.', 'success');

      if (pendingRedirectToToquecitos) {
        setPendingRedirectToToquecitos(false);
        const localCodeVal = hub?.cartel.code || targetCode;
        navigate(`/toquecitos?from=${encodeURIComponent(localCodeVal)}`);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Código inválido o vencido.');
    } finally {
      setSubmitting(false);
    }
  };

  // Opción para usar tarjeta sin datos personales
  const handleAnonymousCard = async () => {
    try {
      setSubmitting(true);
      const reg = await api.createAnonymousCard(hub?.cartel.code || targetCode);
      const storageKey = `toque_member_${hub?.business.id || 'la-burger'}`;
      localStorage.setItem(storageKey, JSON.stringify(reg.member));
      syncMemberWithToquecitos(reg.member, hub);
      if (displayedReceipt && hub) {
        saveReceiptToConsumerStorage(displayedReceipt, hub);
      }
      setJoinedMember(reg.member);
      setNewlyStampedSlot(reg.member.stamps || 1);
      setStep('active');
      showToast('Tarjeta sin datos activada.', 'success');
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo activar la tarjeta.');
    } finally {
      setSubmitting(false);
    }
  };

  // Recuperación compacta ("¿Ya tenés tarjeta? Ingresar →")
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
        showToast(`Enviamos el código a ${cleanEmail}`, 'success');
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
          syncMemberWithToquecitos(existingCard, hub);
          if (displayedReceipt && hub) {
            saveReceiptToConsumerStorage(displayedReceipt, hub);
          }
          setJoinedMember(existingCard);
          setStep('active');

          try {
            const stampRes = await api.claimSelfStamp({
              localCode: hub?.cartel.code || targetCode,
              memberId: existingCard.id,
              receiptId: displayedReceipt?.id,
            });
            if (stampRes.cooldown) {
              setCooldownRemainingMs(stampRes.remainingMs || 0);
              showToast(`¡Tarjeta vinculada, ${existingCard.name || 'Socio'}!`, 'success');
            } else if (stampRes.stampsAdded > 0) {
              setJoinedMember(stampRes.member);
              setAutoStampedThisVisit(true);
              setCooldownRemainingMs(86400000);
              setNewlyStampedSlot(stampRes.member.stamps);
              localStorage.setItem(storageKey, JSON.stringify(stampRes.member));
              syncMemberWithToquecitos(stampRes.member, hub);
              showToast(
                `¡Hola de nuevo, ${stampRes.member.name || 'Socio'}! Sumaste +1 sello`,
                'success'
              );
            }
          } catch {
            showToast(`¡Tarjeta vinculada, ${existingCard.name || 'Socio'}!`, 'success');
          }

          if (pendingRedirectToToquecitos) {
            setPendingRedirectToToquecitos(false);
            const localCodeVal = hub?.cartel.code || targetCode;
            navigate(`/toquecitos?from=${encodeURIComponent(localCodeVal)}`);
          }
        } else {
          setEmail(cleanEmail);
          setShowRecoveryInput(false);
          setRecoveryOtpSent(false);
          showToast('Completá tu nombre para estrenar tu tarjeta.', 'info');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'No pudimos recuperar la tarjeta.');
    } finally {
      setRecovering(false);
    }
  };

  // Emitir pase para Apple Wallet o Google Wallet según el sistema operativo del usuario
  const handleGenerateWalletPass = async (targetWallet: 'apple' | 'google') => {
    if (!hub || !joinedMember) return;
    try {
      setGeneratingPass(true);
      const pass = await api.createWalletPass({
        cartelCode: hub.cartel.code,
        memberId: joinedMember.id,
        memberCode: joinedMember.barcodeToken || joinedMember.memberCode,
        barcodeValue: joinedMember.barcodeToken || joinedMember.memberCode,
        customerName: joinedMember.anonymous ? undefined : joinedMember.name || 'Socio',
        customerContact: joinedMember.email || joinedMember.maskedEmail || joinedMember.contact,
        stamps: joinedMember.stamps,
        stampsRequired: hub.club?.config?.targetStamps || 10,
        rewardText:
          hub.club?.config?.loyaltyReward ||
          hub.club?.config?.rewardText ||
          'Beneficio al completar tus sellos',
        colorPreset: hub.club?.config?.colorPreset || 'dark',
        color: hub.club?.config?.customColor,
        logoURL: hub.club?.config?.logoUrl || hub.business.logoUrl,
        serialNumber: joinedMember.walletSerial,
        isUpdate: Boolean(joinedMember.walletSerial),
      });
      setWalletPass(pass);

      if (pass.serialNumber || pass.shareUrl) {
        const updatedMember: ClubMember = {
          ...joinedMember,
          walletSerial: pass.serialNumber || pass.passId || joinedMember.walletSerial,
          shareUrl: pass.shareUrl || joinedMember.shareUrl,
        };
        setJoinedMember(updatedMember);
        syncMemberWithToquecitos(updatedMember, hub);
      }

      const rawUrl =
        targetWallet === 'apple'
          ? pass.appleWalletUrl || pass.shareUrl
          : pass.googleWalletUrl || pass.shareUrl;

      const cleanUrl = (rawUrl || '').replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');

      if (
        cleanUrl &&
        (cleanUrl.includes('/api/wallet/pkpass/') ||
          cleanUrl.startsWith('data:application/vnd.apple.pkpass'))
      ) {
        const a = document.createElement('a');
        a.href = cleanUrl;
        a.download = `toque-${pass.passId || 'card'}.pkpass`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Descargando tarjeta para tu billetera', 'success');
        return;
      }

      if (
        !pass.fallbackWebPass &&
        cleanUrl &&
        (cleanUrl.startsWith('https://walletwallet.dev') ||
          cleanUrl.startsWith('https://pay.google.com'))
      ) {
        window.location.href = cleanUrl;
        return;
      }

      setShowWebPassModal(true);
      showToast('Tarjeta lista para guardar en tu teléfono', 'success');
    } catch {
      setShowWebPassModal(true);
    } finally {
      setGeneratingPass(false);
    }
  };

  // Descargar Pase de Wallet como imagen en el teléfono
  const handleDownloadWalletPassImage = async () => {
    if (!hub || !joinedMember) return;
    try {
      const codeVal = joinedMember.barcodeToken || joinedMember.memberCode || joinedMember.id || 'LB-1001';
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1100;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bgColor = hub.club?.config?.cardThemeColor || hub.club?.config?.brandColor || '#D95B26';
      ctx.fillStyle = '#141418';
      ctx.fillRect(0, 0, 800, 1100);

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, 800, 260);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillText('Tarjeta de sellos · Toque', 50, 70);

      ctx.font = 'bold 54px Sora, Inter, sans-serif';
      ctx.fillText(hub.business.name, 50, 145);

      ctx.font = '600 30px Inter, sans-serif';
      ctx.fillText(
        `${joinedMember.name || 'Socio'} · Sellos: ${joinedMember.stamps}/${
          hub.club?.config?.targetStamps || 10
        }`,
        50,
        205
      );

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(70, 320, 660, 640, 40);
      ctx.fill();

      const qrDataUrl = await QRCode.toDataURL(codeVal, {
        width: 440,
        margin: 1,
      });

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 180, 370, 440, 440);
          resolve();
        };
        img.src = qrDataUrl;
      });

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `pase-wallet-${hub.business.name.toLowerCase().replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Pase descargado en tu teléfono', 'success');
    } catch {
      showToast('Tu pase ya quedó guardado en este navegador', 'info');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-4">
          <Skeleton className="h-52 w-full rounded-3xl bg-[#141418]" />
          <Skeleton className="h-60 w-full rounded-3xl bg-[#141418]" />
        </div>
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] p-6 flex items-center justify-center">
        <div className="max-w-sm w-full rounded-3xl bg-[#141418] border border-[#282830] p-7 text-center space-y-4">
          <BrandLogo variant="isotipo" size="md" className="mx-auto" />
          <h1 className="text-lg font-bold text-[#F4F4F6]">Cartel no disponible</h1>
          <p className="text-xs text-[#9E9EA8]">
            {error || 'Verificá el código impreso en el cartel.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full py-2.5 rounded-2xl bg-[#D95B26] text-white font-bold text-xs"
          >
            Ir al inicio de Toque
          </Link>
        </div>
      </div>
    );
  }

  const { business, cartel, club, config } = hub;
  const orderedEnabledBlocks: HubBlockKey[] = (hub.blocks || [])
    .filter((b) => b.enabled)
    .map((b) => b.key);

  const clubCfg = club?.config;
  const cardBgColor = clubCfg?.cardThemeColor || clubCfg?.brandColor || '#D95B26';
  const targetStamps = clubCfg?.targetStamps || clubCfg?.stampsRequired || 10;
  const currentStamps = Math.max(0, joinedMember?.stamps ?? 0);
  const remainingStamps = Math.max(0, targetStamps - currentStamps);
  const rewardLabel =
    clubCfg?.loyaltyReward ||
    clubCfg?.rewardText ||
    'Combo aniversario sin cargo en tu visita #10';
  const memberBarcode = joinedMember?.barcodeToken || joinedMember?.memberCode || joinedMember?.id || 'LB-1001';

  // Validar estrictamente si el comercio cargó cada información antes de mostrar el bloque en el Hub (Regla #9)
  const effectiveReviewUrl = config.googleReviewUrl?.trim() || hub.reviewUrl?.trim() || '';
  const hasRealReview = isConfiguredReviewUrl(effectiveReviewUrl);
  const featuredProducts = (config.products || []).filter((p) => p.featuredInHub !== false && p.title?.trim());
  const hasRealProducts = featuredProducts.length > 0;
  const hasRealSocials = Boolean(
    config.socials?.instagram?.trim() ||
      config.socials?.whatsapp?.trim() ||
      config.socials?.web?.trim() ||
      config.socials?.tiktok?.trim() ||
      config.socials?.facebook?.trim()
  );
  const hasRealDetails = Boolean(
    config.details?.address?.trim() ||
      config.details?.hours?.trim() ||
      config.details?.phone?.trim()
  );

  const vault = loadConsumerVault();
  const vaultKpis = computeConsumerKPIs(vault);
  const vaultStampsEntries = Object.entries(vault.stampsByMerchant || {});

  const renderBlock = (key: HubBlockKey) => {
    switch (key) {
      case 'receipt': {
        if (!displayedReceipt) return null;
        return (
          <section key="block-receipt" className="pt-1">
            <DieCutTicket
              receiptId={displayedReceipt.id}
              businessName={business.name}
              total={displayedReceipt.total}
              createdAt={displayedReceipt.createdAt}
              items={displayedReceipt.items}
              method={displayedReceipt.method}
              stamps={currentStamps || 1}
              stampsRequired={targetStamps}
              isExpiredBlur={isReceiptExpired}
              onOpenToquecitos={handleExpiredReceiptCta}
              onViewPass={() => {
                clubSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          </section>
        );
      }

      case 'club': {
        return (
          <div key="block-club" ref={clubSectionRef} className="space-y-4">
            {/* A. TARJETA DIGITAL DE SELLOS */}
            <section
              aria-label={`Tarjeta de sellos de ${business.name}`}
              style={{ backgroundColor: cardBgColor }}
              className="rounded-3xl p-5 text-white border border-white/15 shadow-2xl space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {business.logoUrl ? (
                    <img
                      src={business.logoUrl}
                      alt={business.name}
                      className="w-10 h-10 rounded-2xl object-cover border border-white/25 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center font-extrabold text-base text-white shrink-0">
                      {business.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {clubCfg?.loyaltyTitle || `Tarjeta de sellos de ${business.name}`}
                    </p>
                    <p className="text-[11px] text-white/80 truncate">🎁 {rewardLabel}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="block text-[9px] uppercase tracking-widest text-white/75 font-semibold">
                    SELLOS
                  </span>
                  <span className="text-xl font-extrabold tracking-tight text-white">
                    {currentStamps} / {targetStamps}
                  </span>
                </div>
              </div>

              {/* Grilla visual de sellos */}
              <div className="grid grid-cols-5 gap-2 pt-1">
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
                        <Check className="w-4 h-4 stroke-[3]" />
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
                        className="aspect-square rounded-full bg-white/15 border-2 border-[#fbbf24] text-white font-bold text-xs flex items-center justify-center shadow-sm"
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

            {/* B. PRIMERA VISITA (FORMULARIO CON VERIFICACIÓN DE MAIL OTP) */}
            {step === 'form' && (
              <section className="rounded-3xl bg-[#141414] border border-[#242424] p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="inline-block text-xs font-bold text-[#D95B26]">
                      1° visita · Sumá tu primer sello hoy
                    </span>
                    <h2 className="text-base font-bold text-[#F4F4F6] leading-snug">
                      Sumate al Club de {business.name}
                    </h2>
                    <p className="text-xs text-[#9E9EA8]">
                      Completá tus datos, verificá tu correo y recibí tu 1° sello al instante.
                    </p>
                  </div>

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
                            Código enviado a tu correo: <strong>{recoveryOtpHint}</strong>
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
                            placeholder="Código de verificación"
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

                <form onSubmit={handleStartEmailVerification} className="space-y-3">
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
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="hub-email-input"
                      className="block text-xs font-semibold text-[#F4F4F6] mb-1"
                    >
                      2. Email (te enviaremos un código para verificarlo)
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
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                      3. Día y mes de cumpleaños (opcional, para tu regalo de cumple)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={birthDay}
                          onChange={(e) => setBirthDay(e.target.value)}
                          placeholder="Día (1-31)"
                          className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
                        />
                      </div>
                      <select
                        value={birthMonth}
                        onChange={(e) => setBirthMonth(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-2xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                      >
                        <option value="">Mes (opcional)</option>
                        {MONTHS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#9E9EA8] cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="rounded border-[#282830] bg-[#0C0C0E] text-[#D95B26]"
                    />
                    <span>Recibir avisos de premios y beneficios de {business.name}</span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-5 rounded-2xl bg-[#D95B26] hover:bg-[#e36630] text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#D95B26]/20"
                  >
                    {submitting
                      ? 'Enviando código a tu email...'
                      : 'Verificar mi email y activar tarjeta'}
                  </button>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-[#9E9EA8]">
                    <button
                      type="button"
                      onClick={handleAnonymousCard}
                      className="hover:text-white underline cursor-pointer"
                    >
                      Prefiero usar la tarjeta sin dar datos
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLegalModal(true)}
                      className="hover:text-white underline cursor-pointer"
                    >
                      Privacidad (Ley 25.326)
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* B2. PASO DE VERIFICACIÓN DE CÓDIGO ENVIADO AL EMAIL */}
            {step === 'verify_email' && (
              <section className="rounded-3xl bg-[#141414] border border-[#D95B26]/50 p-5 space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#D95B26]">
                    Verificación de correo electrónico
                  </span>
                  <h2 className="text-sm font-bold text-[#F4F4F6]">
                    Ingresá el código que enviamos a {email}
                  </h2>
                  <p className="text-xs text-[#9E9EA8]">
                    Esto confirma que el correo te pertenece para que nunca pierdas tus sellos.
                  </p>
                  {emailOtpHint && (
                    <p className="text-xs font-mono text-[#BEC8FF] bg-[#1C1C22] border border-[#282830] px-3 py-1.5 rounded-xl mt-2">
                      Código de verificación: <strong>{emailOtpHint}</strong>
                    </p>
                  )}
                </div>

                {formError && (
                  <div className="p-3 rounded-2xl bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleConfirmEmailAndRegister} className="space-y-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={emailOtpCode}
                    onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Ingresá el código de 6 dígitos"
                    className="w-full px-4 py-3 rounded-2xl bg-[#0C0C0E] border border-[#282830] text-center font-mono text-base tracking-widest text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('form');
                        setFormError(null);
                      }}
                      className="px-4 py-2.5 rounded-2xl bg-[#1C1C22] border border-[#282830] text-xs font-bold text-[#9E9EA8] cursor-pointer"
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || emailOtpCode.length < 4}
                      className="flex-1 py-2.5 px-4 rounded-2xl bg-[#2FB36A] hover:bg-[#259858] text-[#05150c] font-bold text-xs disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? 'Verificando...' : 'Confirmar y sumar mi 1° sello'}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* C. TARJETA ACTIVA (ESPEJO WALLETWALLET + BOTÓN SEGÚN SISTEMA OPERATIVO) */}
            {step === 'active' && joinedMember && (
              <section className="rounded-3xl bg-[#141414] border border-[#242424] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#2FB36A]/15 border border-[#2FB36A]/30 text-[#2FB36A] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-[#F4F4F6]">
                        ¡Hola, {joinedMember.name || 'Socio'}!
                      </h2>
                      <p className="text-[11px] text-[#9E9EA8]">
                        {autoStampedThisVisit
                          ? 'Se sumó +1 sello en tu tarjeta.'
                          : cooldownRemainingMs > 0
                          ? `Próximo sello por visita disponible en ${Math.floor(
                              cooldownRemainingMs / 3600000
                            )} h ${Math.max(1, Math.ceil((cooldownRemainingMs % 3600000) / 60000))} min.`
                          : 'Guardada en tu cuenta y lista para usar en el local.'}
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

                {/* Espejo idéntico del Pase WalletWallet */}
                <WalletPassCard
                  businessName={clubCfg?.loyaltyTitle || business.name}
                  memberName={joinedMember.name || 'Socio'}
                  stamps={currentStamps}
                  stampsRequired={targetStamps}
                  rewardText={rewardLabel}
                  barcodeToken={joinedMember.barcodeToken || memberBarcode}
                  colorPreset={clubCfg?.colorPreset || 'dark'}
                  customColor={clubCfg?.customColor || cardBgColor}
                  logoUrl={clubCfg?.logoUrl || business.logoUrl}
                />

                {/* Botón único según el sistema operativo del usuario (Apple Wallet en iOS/macOS, Google Wallet en Android) */}
                <button
                  type="button"
                  disabled={generatingPass}
                  onClick={() => handleGenerateWalletPass(walletOS === 'apple' ? 'apple' : 'google')}
                  className="w-full py-3 px-4 rounded-2xl bg-[#1C1C22] hover:bg-[#25252d] border border-[#242424] text-xs font-bold text-[#F4F4F6] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Wallet className="w-4 h-4 text-[#D95B26]" />
                  <span>{generatingPass ? 'Preparando pase...' : walletButtonLabel}</span>
                </button>
              </section>
            )}
          </div>
        );
      }

      case 'review': {
        if (!hasRealReview) return null;
        return (
          <div
            key="block-review"
            className="rounded-3xl bg-[#141418] border border-[#282830] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#F4F4F6]">
                  ¿Qué te pareció tu visita a {business.name}?
                </h3>
                <p className="text-[11px] text-[#9E9EA8]">
                  Calificanos en 1 toque en Google Maps.
                </p>
              </div>
              <div className="flex items-center gap-0.5 text-[#f59e0b] shrink-0">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className="w-3.5 h-3.5 fill-[#f59e0b]" />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleReviewClick}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#1C1C22] hover:bg-[#26262e] border border-[#282830] text-[#F4F4F6] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Dejar reseña en Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#D95B26]" />
            </button>
          </div>
        );
      }

      case 'products': {
        if (!hasRealProducts) return null;
        return (
          <div
            key="block-products"
            className="rounded-3xl bg-[#141418] border border-[#282830] p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#D95B26]" />
              <h3 className="text-xs font-bold text-[#F4F4F6]">Catálogo</h3>
            </div>
            <div className="space-y-2">
              {featuredProducts.slice(0, 8).map((prod) => (
                <div
                  key={prod.id}
                  className="p-3 rounded-2xl bg-[#1C1C22] border border-[#282830] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#F4F4F6] truncate">{prod.title}</p>
                    {prod.description && (
                      <p className="text-[11px] text-[#9E9EA8] truncate">{prod.description}</p>
                    )}
                  </div>
                  {prod.price !== undefined && (
                    <span className="text-xs font-bold text-[#BEC8FF] shrink-0">
                      {formatARS(prod.price)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'socials': {
        if (!hasRealSocials) return null;
        return (
          <div
            key="block-socials"
            className="rounded-3xl bg-[#141418] border border-[#282830] p-5 space-y-3"
          >
            <div className="grid grid-cols-2 gap-2">
              {config.socials.instagram?.trim() && (
                <a
                  href={`https://instagram.com/${config.socials.instagram.replace('@', '').trim()}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs font-medium text-[#F4F4F6]"
                >
                  <Instagram className="w-3.5 h-3.5 text-[#D95B26]" />
                  <span className="truncate">
                    @{config.socials.instagram.replace('@', '').trim()}
                  </span>
                </a>
              )}
              {config.socials.whatsapp?.trim() && (
                <a
                  href={`https://wa.me/${config.socials.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs font-medium text-[#F4F4F6]"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#2FB36A]" />
                  <span>WhatsApp</span>
                </a>
              )}
              {config.socials.web?.trim() && (
                <a
                  href={config.socials.web.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs font-medium text-[#F4F4F6] col-span-2"
                >
                  <Globe className="w-3.5 h-3.5 text-[#BEC8FF]" />
                  <span className="truncate">{config.socials.web.trim()}</span>
                </a>
              )}
            </div>
          </div>
        );
      }

      case 'details': {
        if (!hasRealDetails) return null;
        return (
          <div
            key="block-details"
            className="rounded-3xl bg-[#141418] border border-[#282830] p-5 space-y-2 text-xs text-[#9E9EA8]"
          >
            {config.details.address?.trim() && (
              <div className="flex items-center gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-[#D95B26] shrink-0" />
                <span>{config.details.address.trim()}</span>
              </div>
            )}
            {config.details.hours?.trim() && (
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 text-[#D95B26] shrink-0" />
                <span>{config.details.hours.trim()}</span>
              </div>
            )}
            {config.details.phone?.trim() && (
              <div className="flex items-center gap-2.5">
                <Phone className="w-3.5 h-3.5 text-[#D95B26] shrink-0" />
                <span>{config.details.phone.trim()}</span>
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F6] py-5 px-4 flex flex-col items-center">
      <div className="max-w-md w-full space-y-4">
        {/* CABECERA DEL HUB: IDENTIDAD DEL COMERCIO + BOTÓN TOQUECITOS */}
        <header className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#141414] border border-[#242424] gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.name}
                className="w-9 h-9 rounded-xl object-cover border border-[#242424] shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#D95B26]/15 border border-[#D95B26]/40 text-[#D95B26] font-extrabold text-sm flex items-center justify-center shrink-0">
                {business.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-[#F4F4F6] truncate">{business.name}</h1>
              <p className="text-[11px] text-[#9E9EA8] truncate">
                Mostrador · {cartel.code}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenToquecitos}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#242424] text-xs font-bold text-[#F4F4F6] transition-colors cursor-pointer"
              title="Ver todas tus tarjetas y ahorros en Toquecitos"
            >
              <BrandLogo variant="isotipo" size="sm" />
              <span>Toquecitos</span>
            </button>

            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#2FB36A]/15 border border-[#2FB36A]/30 text-[10px] font-bold text-[#2FB36A]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2FB36A] animate-pulse" />
              <span>En vivo</span>
            </div>
          </div>
        </header>

        {/* MODO SOLO COMPROBANTE (PRUEBA FINALIZADA + 2 DÍAS SIN PAGO) */}
        {hub.unpaidLockdown ? (
          displayedReceipt ? (
            <DieCutTicket
              receiptId={displayedReceipt.id}
              businessName={business.name}
              total={displayedReceipt.total}
              createdAt={displayedReceipt.createdAt}
              items={displayedReceipt.items}
              method={displayedReceipt.method}
              stamps={currentStamps || 1}
              stampsRequired={targetStamps}
              isExpiredBlur={isReceiptExpired}
              onOpenToquecitos={handleExpiredReceiptCta}
            />
          ) : (
            <section className="rounded-3xl bg-[#141418] border border-[#282830] p-6 text-center space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#1C1C22] border border-[#282830] text-[#D95B26] flex items-center justify-center mx-auto">
                <ReceiptIcon className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-[#F4F4F6]">Comprobante digital</h2>
              <p className="text-xs text-[#9E9EA8]">
                No hay un comprobante activo en este momento en el mostrador {cartel.code}. Cuando realices un pago en caja, tu ticket aparecerá aquí.
              </p>
            </section>
          )
        ) : (
          <>{orderedEnabledBlocks.map((blockKey) => renderBlock(blockKey))}</>
        )}

        {/* Pie del Hub con insignia oficial Toque */}
        <footer className="pt-2 pb-12 text-center">
          <Link to="/" className="inline-flex">
            <BrandLogo variant="badge" />
          </Link>
        </footer>
      </div>

      {/* PANTALLA SIMPLE DE TOQUECITO */}
      {showToquecitoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="max-w-md w-full rounded-3xl bg-[#141418] border border-[#282830] p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#282830] pb-3">
              <div className="flex items-center gap-2.5">
                <BrandLogo variant="isotipo" size="sm" />
                <div>
                  <h3 className="text-sm font-bold text-[#F4F4F6]">Toquecito</h3>
                  <p className="text-[11px] text-[#9E9EA8]">
                    Tus tarjetas, comprobantes y cuánto ahorraste
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowToquecitoModal(false)}
                className="p-1.5 rounded-xl bg-[#1C1C22] text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#1C1C22] border border-[#282830] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#9E9EA8] block">Cuánto ahorraste</span>
                <span className="text-lg font-extrabold font-mono text-[#2FB36A]">
                  {formatARS(vaultKpis.savedWithToqueArs)}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-[#2FB36A]/15 text-[#2FB36A] text-[11px] font-bold">
                Beneficios aplicados
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#F4F4F6]">
                <CreditCard className="w-3.5 h-3.5 text-[#D95B26]" />
                <span>Mis tarjetas</span>
              </div>

              <div className="space-y-2">
                {joinedMember && (
                  <div className="p-3 rounded-xl bg-[#0C0C0E] border border-[#D95B26]/40 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#F4F4F6]">{business.name}</p>
                      <p className="text-[11px] text-[#9E9EA8]">🎁 {rewardLabel}</p>
                    </div>
                    <span className="font-mono text-xs font-extrabold text-[#D95B26]">
                      {currentStamps}/{targetStamps} sellos
                    </span>
                  </div>
                )}

                {vaultStampsEntries
                  .filter(([tenantId]) => tenantId !== business.id)
                  .map(([tenantId, info]) => (
                    <div
                      key={tenantId}
                      className="p-3 rounded-xl bg-[#0C0C0E] border border-[#282830] flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#F4F4F6]">{info.merchantName}</p>
                        <p className="text-[11px] text-[#9E9EA8]">
                          🎁 {info.rewardLabel || info.rewardText}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#BEC8FF]">
                        {info.stamps}/{info.target || info.targetStamps || 10} sellos
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowToquecitoModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#D95B26] text-white text-xs font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE PASE DIGITAL WALLET */}
      {showWebPassModal && joinedMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="max-w-sm w-full rounded-3xl overflow-hidden bg-[#141414] border border-[#242424] shadow-2xl p-4 space-y-3">
            <WalletPassCard
              businessName={clubCfg?.loyaltyTitle || business.name}
              memberName={joinedMember.name || 'Socio'}
              stamps={currentStamps}
              stampsRequired={targetStamps}
              rewardText={rewardLabel}
              barcodeToken={joinedMember.barcodeToken || memberBarcode}
              colorPreset={clubCfg?.colorPreset || 'dark'}
              customColor={clubCfg?.customColor || cardBgColor}
              logoUrl={clubCfg?.logoUrl || business.logoUrl}
            />

            <div className="p-4 bg-[#141418] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleDownloadWalletPassImage}
                className="flex-1 py-2 px-3 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-xs font-bold text-[#F4F4F6] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#BEC8FF]" />
                <span>Guardar imagen del pase</span>
              </button>
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

      {/* MODAL DE PRIVACIDAD LEY 25.326 */}
      {showLegalModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="max-w-md w-full rounded-3xl bg-[#141418] border border-[#282830] p-5 space-y-3.5 text-xs text-[#9E9EA8]">
            <div className="flex items-center justify-between text-[#F4F4F6]">
              <div className="flex items-center gap-2 font-bold text-xs">
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
              Tus datos (nombre, correo verificado y opcionalmente día y mes de cumpleaños sin año)
              se utilizan exclusivamente para administrar tu tarjeta de sellos en{' '}
              <strong className="text-white">{business.name}</strong>. No pedimos datos a menores:
              si sos menor de 18, usá la tarjeta sin datos.
            </p>
            <p className="text-[11px] text-[#666672] leading-relaxed">
              El titular de los datos personales tiene la facultad de ejercer el derecho de acceso,
              rectificación o supresión en forma gratuita conforme al art. 14 inc. 3 de la Ley Nº
              25.326 ante la Agencia de Acceso a la Información Pública (AAIP).
            </p>
            <button
              type="button"
              onClick={() => setShowLegalModal(false)}
              className="w-full py-2 rounded-xl bg-[#1C1C22] border border-[#282830] text-white font-bold cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
