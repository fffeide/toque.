import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api';
import {
  PublicHub,
  ClubMember,
  Receipt,
  HubBlockKey,
  RecognizedClientAccount,
} from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { BrandLogo } from '../../components/ui/Avatar';
import { WalletPassCard } from '../../components/wallet/WalletPassCard';
import { DieCutTicket } from '../../components/ticket/DieCutTicket';
import { BirthDatePicker } from '../../components/BirthDatePicker';
import {
  fetchConsumerMe,
  getConsumerSessionEmail,
  getConsumerSessionToken,
  getSavedConsumerUser,
  saveConsumerSession,
  clearConsumerSession,
  isIOSDevice,
  isAndroidDevice,
} from '../../lib/consumerSession';
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
  ShoppingBag,
  Wallet,
  Check,
  Mail,
  User as UserIcon,
} from 'lucide-react';

function isConfiguredReviewUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (
    trimmed === 'https://maps.google.com' ||
    trimmed === 'https://maps.google.com/' ||
    trimmed === 'http://maps.google.com'
  ) {
    return false;
  }
  return true;
}

function isAtLeast18(birthDateStr: string): {
  valid: boolean;
  isAdult: boolean;
  birthDay?: number;
  birthMonth?: number;
} {
  if (!birthDateStr) return { valid: false, isAdult: false };
  const parts = birthDateStr.split('-');
  if (parts.length !== 3) return { valid: false, isAdult: false };
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return { valid: false, isAdult: false };
  }
  const today = new Date();
  let age = today.getFullYear() - year;
  const mDiff = today.getMonth() + 1 - month;
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < day)) {
    age--;
  }
  return {
    valid: true,
    isAdult: age >= 18,
    birthDay: day,
    birthMonth: month,
  };
}

export const PublicHubView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const targetCode = code || 'MONROE01';

  const [hub, setHub] = useState<PublicHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pinnedReceipt, setPinnedReceipt] = useState<Receipt | null>(null);
  const [isReceiptExpired, setIsReceiptExpired] = useState(false);

  // Inicialización síncrona desde localStorage para no perder sesión al refrescar (F5)
  const [recognizedAccount, setRecognizedAccount] = useState<RecognizedClientAccount | null>(() => {
    const savedUser = getSavedConsumerUser();
    if (savedUser && savedUser.email) {
      return {
        recognized: true,
        accountExists: true,
        accountId: savedUser.id,
        name: savedUser.fullName,
        email: savedUser.email,
        cards: [],
      };
    }
    return null;
  });

  const [step, setStep] = useState<
    'recognized_other_merchant' | 'email_login' | 'form' | 'verify_email' | 'active'
  >(() => {
    const savedUser = getSavedConsumerUser();
    return savedUser && savedUser.email ? 'recognized_other_merchant' : 'form';
  });

  // Datos de registro (nombre, correo y fecha de nacimiento con selector nativo de 3 columnas)
  const [name, setName] = useState(() => getSavedConsumerUser()?.fullName || '');
  const [email, setEmail] = useState(() => getSavedConsumerUser()?.email || '');
  const [birthDate, setBirthDate] = useState<string>(() => getSavedConsumerUser()?.birthDate || '');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [emailAlreadyVerifiedInLogin, setEmailAlreadyVerifiedInLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Verificación de 6 dígitos (registro)
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpHint, setEmailOtpHint] = useState<string | null>(null);

  // Ingreso por correo ("Ingresá tu correo" -> código 6 dígitos)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginOtpCode, setLoginOtpCode] = useState('');
  const [loginOtpHint, setLoginOtpHint] = useState<string | null>(null);
  const [verifyingLogin, setVerifyingLogin] = useState(false);

  // Tarjeta activa y estado de billetera
  const [joinedMember, setJoinedMember] = useState<ClubMember | null>(null);
  const [autoStampedThisVisit, setAutoStampedThisVisit] = useState(false);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);
  const [newlyStampedSlot, setNewlyStampedSlot] = useState<number | null>(null);

  // Botón secundario para guardar en Apple Wallet (.pkpass) y Google Wallet
  const [generatingPass, setGeneratingPass] = useState(false);
  const [walletUnconfigured, setWalletUnconfigured] = useState(false);
  const [walletStatusMessage, setWalletStatusMessage] = useState<string | null>(null);
  const [walletErrorMessage, setWalletErrorMessage] = useState<string | null>(null);
  const [desktopFallbackUrl, setDesktopFallbackUrl] = useState<string | null>(null);
  const [appleWalletHref, setAppleWalletHref] = useState<string | null>(null);
  const [googleWalletHref, setGoogleWalletHref] = useState<string | null>(null);

  const clubSectionRef = useRef<HTMLDivElement>(null);
  const processedReceiptStampsRef = useRef<Set<string>>(new Set());

  const handleOpenToquecitos = () => {
    const localCodeVal = hub?.cartel.code || targetCode;
    navigate(`/toquecitos?from=${encodeURIComponent(localCodeVal)}`);
  };

  // Función auxiliar para guardar/reclamar la tarjeta en D1 (POST /api/consumer/cards/claim) desacoplado de WalletWallet
  const claimCardInD1 = async (params: {
    hubData: PublicHub;
    customerName?: string;
    customerEmail?: string;
    customerBirthDate?: string;
  }): Promise<{
    barcodeToken?: string; stamps?: number; stampsRequired?: number; memberId?: string;
    walletSerial?: string; appleWalletUrl?: string; googleWalletUrl?: string;
  }> => {
    try {
      const token = getConsumerSessionToken();
      const savedUser = getSavedConsumerUser();
      const effectiveEmail = (
        params.customerEmail ||
        recognizedAccount?.email ||
        savedUser?.email ||
        getConsumerSessionEmail() ||
        ''
      )
        .trim()
        .toLowerCase();
      const effectiveName = (
        params.customerName ||
        recognizedAccount?.name ||
        savedUser?.fullName ||
        effectiveEmail.split('@')[0] ||
        'Socio'
      ).trim();
      const effectiveConsumerId =
        savedUser?.id || recognizedAccount?.accountId || undefined;

      const res = await fetch('/api/consumer/cards/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          code: params.hubData.cartel.code,
          cartelCode: params.hubData.cartel.code,
          localCode: params.hubData.cartel.code,
          tenantId: params.hubData.business.id,
          businessId: params.hubData.business.id,
          consumerId: effectiveConsumerId,
          email: effectiveEmail,
          fullName: effectiveName,
          name: effectiveName,
          birthDate: params.customerBirthDate || savedUser?.birthDate,
          businessName: params.hubData.business.name,
          rewardText:
            params.hubData.club?.config?.loyaltyReward ||
            params.hubData.club?.config?.rewardText ||
            'Premio al completar tus 10 sellos',
          stampsRequired: 10,
        }),
      });
      if (!res.ok) return {};
      const data = await res.json();
      if (data.sessionToken && data.user) {
        saveConsumerSession(data.sessionToken, data.user.email, data.user);
      }
      const cardData = data.card || data.member;
      if (cardData || data.barcodeToken) {
        return {
          barcodeToken: cardData?.barcodeToken || data.barcodeToken,
          stamps: typeof cardData?.stamps === 'number' ? cardData.stamps : 0,
          stampsRequired: cardData?.stampsRequired || 10,
          memberId: cardData?.id,
          walletSerial: cardData?.walletSerial,
          appleWalletUrl: cardData?.appleWalletUrl,
          googleWalletUrl: cardData?.googleWalletUrl,
        };
      }
      return {};
    } catch {
      return {};
    }
  };

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      try {
        setLoading(true);
        const sessionEmail = getConsumerSessionEmail();
        const [data, recAcc, meRes] = await Promise.all([
          api.getPublicHub(targetCode),
          api.recognizeAccount(sessionEmail || undefined).catch(() => null),
          fetchConsumerMe().catch(() => ({ authenticated: false, user: null, cards: [], receipts: [] })),
        ]);
        if (!active) return;

        await api.recordHubEvent(targetCode, 'scan');

        // Validar comprobante seguro (Prioridad 1: asignado a su consumer_id por sello en los últimos 2 min; Prioridad 2: < 90s y < 120m)
        let verifiedReceipt: Receipt | null = null;
        const candidateRcp = data.activeReceipt || data.receipt || null;
        if (candidateRcp) {
          const expMs = new Date(candidateRcp.expiresAt).getTime();
          if (!Number.isNaN(expMs) && expMs > Date.now()) {
            verifiedReceipt = candidateRcp;
          }
        }

        // Consultar también /api/public/hub/receipt-check enviando ubicación opcional si está disponible
        const checkServerReceipt = async (lat?: number, lng?: number) => {
          try {
            const token = getConsumerSessionToken();
            const rcpRes = await fetch('/api/public/hub/receipt-check', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                cartelCode: data.cartel.code,
                tenantId: data.business.id,
                lat,
                lng,
              }),
            });
            if (rcpRes.ok) {
              const rcpJson = await rcpRes.json();
              if (rcpJson.receipt && active) {
                const srvRcp = rcpJson.receipt;
                setPinnedReceipt({
                  id: srvRcp.id,
                  saleId: srvRcp.id,
                  businessId: data.business.id,
                  businessName: data.business.name,
                  cartelCode: srvRcp.cartelCode || data.cartel.code,
                  total: srvRcp.amountArs || 0,
                  currency: 'ARS',
                  cashTendered: srvRcp.cashTendered,
                  changeDue: srvRcp.changeDue,
                  method: srvRcp.method || 'cash',
                  items: srvRcp.items || [],
                  status: 'ready',
                  createdAt: srvRcp.createdAt || new Date().toISOString(),
                  expiresAt: new Date(srvRcp.expiresAt || Date.now() + 90000).toISOString(),
                });
              }
            }
          } catch {
            // ignore
          }
        };

        if (verifiedReceipt) {
          setPinnedReceipt(verifiedReceipt);
        } else {
          setPinnedReceipt(null);
        }

        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              checkServerReceipt(pos.coords.latitude, pos.coords.longitude);
            },
            () => {
              checkServerReceipt();
            },
            { timeout: 3500, maximumAge: 30000 }
          );
        } else {
          checkServerReceipt();
        }

        if (
          (data.config.mode === 'direct' || data.config.mode === 'direct_review') &&
          !verifiedReceipt &&
          isConfiguredReviewUrl(data.reviewUrl)
        ) {
          window.location.href = data.reviewUrl;
          return;
        }

        setHub(data);

        if (data.unpaidLockdown) {
          return;
        }

        // Reconocimiento de sesión activa única (servidor o navegador)
        let effectiveAcc = recAcc;
        if (
          (!effectiveAcc || !effectiveAcc.recognized) &&
          meRes.authenticated &&
          meRes.user?.email
        ) {
          effectiveAcc = await api
            .recognizeAccount(meRes.user.email)
            .catch(() => null);
          if (!effectiveAcc || !effectiveAcc.recognized) {
            effectiveAcc = {
              recognized: true,
              accountExists: true,
              accountId: meRes.user.id,
              name: meRes.user.fullName,
              email: meRes.user.email,
              cards: (meRes.cards || []).map((c) => ({
                id: c.id,
                businessId: c.tenantId,
                businessName: c.businessName,
                shortCode: c.barcodeToken,
                memberCode: c.barcodeToken,
                barcodeToken: c.barcodeToken,
                name: meRes.user!.fullName,
                email: meRes.user!.email,
                contact: meRes.user!.email,
                anonymous: false,
                points: c.stamps,
                stamps: c.stamps,
                stampsRequired: c.stampsRequired,
                targetStamps: c.stampsRequired,
                rewardText: c.rewardText,
                lastVisitAt: c.lastStampedAt || new Date().toISOString(),
                lastStampedAt: c.lastStampedAt,
                joinedAt: new Date().toISOString(),
                consent: true,
              })),
            };
          }
        }

        const d1CardForBusiness = (meRes.cards || []).find(
          (c) => c.tenantId === data.business.id || c.businessName === data.business.name
        );

        const existingCardInThisBusiness =
          data.club?.member ||
          effectiveAcc?.cards?.find((c) => c.businessId === data.business.id) ||
          (d1CardForBusiness
            ? {
                id: d1CardForBusiness.id,
                businessId: d1CardForBusiness.tenantId,
                businessName: d1CardForBusiness.businessName,
                shortCode: d1CardForBusiness.barcodeToken,
                memberCode: d1CardForBusiness.barcodeToken,
                barcodeToken: d1CardForBusiness.barcodeToken,
                name: meRes.user?.fullName || effectiveAcc?.name || 'Socio',
                email: meRes.user?.email || effectiveAcc?.email,
                contact: meRes.user?.email || effectiveAcc?.email || '',
                anonymous: false,
                points: d1CardForBusiness.stamps,
                stamps: d1CardForBusiness.stamps,
                stampsRequired: d1CardForBusiness.stampsRequired,
                targetStamps: d1CardForBusiness.stampsRequired,
                rewardText: d1CardForBusiness.rewardText,
                lastVisitAt: d1CardForBusiness.lastStampedAt || new Date().toISOString(),
                lastStampedAt: d1CardForBusiness.lastStampedAt,
                joinedAt: new Date().toISOString(),
                consent: true,
              }
            : null);

        if (existingCardInThisBusiness) {
          if (d1CardForBusiness?.barcodeToken) {
            existingCardInThisBusiness.barcodeToken = d1CardForBusiness.barcodeToken;
            existingCardInThisBusiness.shortCode = d1CardForBusiness.barcodeToken;
            existingCardInThisBusiness.memberCode = d1CardForBusiness.barcodeToken;
          }
          setJoinedMember(existingCardInThisBusiness);
          setStep('active');

          if (verifiedReceipt && !processedReceiptStampsRef.current.has(verifiedReceipt.id)) {
            processedReceiptStampsRef.current.add(verifiedReceipt.id);
            try {
              const stampRes = await api.claimSelfStamp({
                localCode: data.cartel.code,
                memberId: existingCardInThisBusiness.id,
                receiptId: verifiedReceipt.id,
              });
              if (active && stampRes.stampsAdded > 0) {
                setJoinedMember(stampRes.member);
                setAutoStampedThisVisit(true);
                setNewlyStampedSlot(stampRes.member.stamps);
              } else if (active && stampRes.cooldown) {
                setCooldownRemainingMs(stampRes.remainingMs || 0);
              }
            } catch {
              // ignore
            }
          }
        } else if (effectiveAcc && effectiveAcc.recognized && effectiveAcc.email) {
          setRecognizedAccount(effectiveAcc);
          setMarketingConsent(true);
          setStep('recognized_other_merchant');
        } else {
          const savedLocalUser = getSavedConsumerUser();
          if (savedLocalUser && savedLocalUser.email) {
            setRecognizedAccount({
              recognized: true,
              accountExists: true,
              accountId: savedLocalUser.id,
              name: savedLocalUser.fullName,
              email: savedLocalUser.email,
              cards: [],
            });
            setStep('recognized_other_merchant');
          } else {
            setStep('form');
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
      if (incomingRcp) {
        const expMs = new Date(incomingRcp.expiresAt).getTime();
        if (!Number.isNaN(expMs) && expMs > Date.now()) {
          setPinnedReceipt((prev) => prev || incomingRcp);
        }
      }
      if (liveHub.club?.member) {
        setJoinedMember(liveHub.club.member);
        setStep('active');
      }
    });

    const handleCrossTabSync = async () => {
      if (!active) return;
      try {
        const [freshHub, meRes] = await Promise.all([
          api.getPublicHub(targetCode),
          fetchConsumerMe().catch(() => ({ authenticated: false, user: null, cards: [], receipts: [] })),
        ]);
        if (!active) return;
        setHub(freshHub);
        const srvCard = (meRes.cards || []).find(
          (c) => c.tenantId === freshHub.business.id || c.businessName === freshHub.business.name
        );
        if (freshHub.club?.member) {
          setJoinedMember((prev) => ({
            ...freshHub.club!.member!,
            stamps:
              srvCard && srvCard.stamps > (freshHub.club!.member!.stamps || 0)
                ? srvCard.stamps
                : freshHub.club!.member!.stamps,
            barcodeToken:
              prev?.barcodeToken ||
              srvCard?.barcodeToken ||
              freshHub.club!.member!.barcodeToken,
            shortCode:
              prev?.shortCode ||
              srvCard?.barcodeToken ||
              freshHub.club!.member!.shortCode,
          }));
        } else if (srvCard) {
          setJoinedMember((prev) =>
            prev
              ? {
                  ...prev,
                  stamps: srvCard.stamps,
                  points: srvCard.stamps,
                  stampsRequired: 10,
                  targetStamps: 10,
                }
              : prev
          );
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('storage', handleCrossTabSync);
    window.addEventListener('focus', handleCrossTabSync);
    const pollInterval = setInterval(handleCrossTabSync, 2500);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('storage', handleCrossTabSync);
      window.removeEventListener('focus', handleCrossTabSync);
      clearInterval(pollInterval);
    };
  }, [targetCode]);

  const displayedReceipt = pinnedReceipt;

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

  // Cuenta única reconocida: al tocar "Guardar tarjeta" en /hub/:code, guarda primero en D1 (200 OK siempre) con su barcode_token de 8 dígitos
  const handleAddCardForRecognizedAccount = async () => {
    if (!hub) return;
    setFormError(null);
    try {
      setSubmitting(true);
      const effectiveEmail =
        recognizedAccount?.email ||
        email.trim().toLowerCase() ||
        loginEmail.trim().toLowerCase();
      const effectiveName = recognizedAccount?.name || name.trim() || 'Socio';

      const d1Claim = await claimCardInD1({
        hubData: hub,
        customerName: effectiveName,
        customerEmail: effectiveEmail,
      });

      const res = await api.addCardToAccount({
        localCode: hub.cartel.code,
        marketingConsent,
        email: effectiveEmail,
        name: effectiveName,
        barcodeToken: d1Claim.barcodeToken,
      });

      const mergedMember: ClubMember = {
        ...res.member,
        id: d1Claim.memberId || res.member.id,
        walletSerial: d1Claim.walletSerial || res.member.walletSerial,
        appleWalletUrl: d1Claim.appleWalletUrl || res.member.appleWalletUrl,
        googleWalletUrl: d1Claim.googleWalletUrl || res.member.googleWalletUrl,
        stamps: d1Claim.stamps ?? res.member.stamps ?? 0,
        stampsRequired: 10,
        barcodeToken: d1Claim.barcodeToken || res.member.barcodeToken || res.member.shortCode,
        shortCode: d1Claim.barcodeToken || res.member.shortCode || res.member.barcodeToken,
        memberCode: d1Claim.barcodeToken || res.member.memberCode || res.member.barcodeToken,
      };

      setJoinedMember(mergedMember);
      setRecognizedAccount(res.account);
      setNewlyStampedSlot(null);
      setStep('active');
      showToast(`¡Sumaste la tarjeta de ${hub.business.name} a tu cuenta!`, 'success');
    } catch (err: any) {
      setFormError(err?.message || 'No pudimos sumar la tarjeta a tu cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  // Pantalla "Ingresá tu correo" -> código de 6 dígitos -> si ya tenía cuenta, entra directo SIN pasar por el registro
  const handleSendLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanMail = loginEmail.trim().toLowerCase();
    if (!cleanMail || !cleanMail.includes('@')) {
      setFormError('Ingresá un correo válido.');
      return;
    }
    try {
      setVerifyingLogin(true);
      const otpRes = await api.requestOtp(cleanMail, 'client_card');
      setLoginOtpHint(otpRes.demoHintCode || null);
      setLoginOtpSent(true);
      showToast(`Te enviamos un código de 6 dígitos a ${cleanMail}`, 'success');
    } catch (err: any) {
      setFormError(err?.message || 'No pudimos enviar el código.');
    } finally {
      setVerifyingLogin(false);
    }
  };

  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanMail = loginEmail.trim().toLowerCase();
    const cleanCode = loginOtpCode.trim();
    if (cleanCode.length < 6) {
      setFormError('Ingresá el código de 6 dígitos.');
      return;
    }

    try {
      setVerifyingLogin(true);
      const verifyRes = await api.verifyOtp(cleanMail, cleanCode);
      const acc = verifyRes.account || (await api.recognizeAccount(cleanMail));

      if (verifyRes.accountExists || (acc && acc.accountExists)) {
        // Ya tenía cuenta en Toque: entra directo SIN pasar por el formulario de registro
        const existingCardHere = acc?.cards?.find(
          (c) => !hub || c.businessId === hub.business.id
        );
        if (existingCardHere) {
          setJoinedMember(existingCardHere);
          setStep('active');
          showToast(`¡Hola, ${existingCardHere.name || acc.name || 'Socio'}!`, 'success');
        } else {
          setRecognizedAccount(acc);
          setMarketingConsent(true);
          setStep('recognized_other_merchant');
        }
      } else {
        // Únicamente cuando es la primera vez absoluta que ese correo se usa en toda la plataforma
        setEmail(cleanMail);
        setEmailAlreadyVerifiedInLogin(true);
        setMarketingConsent(false);
        setStep('form');
      }
    } catch (err: any) {
      setFormError(err?.message || 'El código ingresado no es válido.');
    } finally {
      setVerifyingLogin(false);
    }
  };

  // Registro del cliente: valida nombre, correo y que sea mayor de 18 años
  const handleStartRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setFormError('Ingresá tu nombre.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Ingresá tu correo.');
      return;
    }
    if (!birthDate) {
      setFormError('Seleccioná tu fecha de nacimiento.');
      return;
    }

    const ageCheck = isAtLeast18(birthDate);
    if (!ageCheck.valid || !ageCheck.isAdult) {
      setFormError('Para crear tu tarjeta con datos hace falta ser mayor de 18.');
      return;
    }

    // Si ya verificó el correo en el paso previo de ingreso, registramos directo
    if (emailAlreadyVerifiedInLogin) {
      try {
        setSubmitting(true);
        const d1Claim = hub
          ? await claimCardInD1({
              hubData: hub,
              customerName: cleanName,
              customerEmail: cleanEmail,
              customerBirthDate: birthDate,
            })
          : {};

        const reg = await api.registerMember({
          localCode: hub?.cartel.code || targetCode,
          name: cleanName,
          email: cleanEmail,
          birthDate,
          birthDay: ageCheck.birthDay,
          birthMonth: ageCheck.birthMonth,
          marketingConsent,
        });

        const mergedMember: ClubMember = {
          ...reg.member,
          stamps: d1Claim.stamps ?? reg.member.stamps ?? 0,
          stampsRequired: 10,
          barcodeToken: d1Claim.barcodeToken || reg.member.barcodeToken || reg.member.shortCode,
          shortCode: d1Claim.barcodeToken || reg.member.shortCode || reg.member.barcodeToken,
          memberCode: d1Claim.barcodeToken || reg.member.memberCode || reg.member.barcodeToken,
        };

        setJoinedMember(mergedMember);
        setNewlyStampedSlot(null);
        setStep('active');
        showToast('¡Listo! Ya tenés tu tarjeta activa.', 'success');
      } catch (err: any) {
        setFormError(err?.message || 'No pudimos crear tu tarjeta.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      setSubmitting(true);
      const otpRes = await api.requestOtp(cleanEmail, 'client_card');
      setEmailOtpHint(otpRes.demoHintCode || null);
      setStep('verify_email');
      showToast(`Te enviamos un código de 6 dígitos a ${cleanEmail}`, 'success');
    } catch (err: any) {
      setFormError(err?.message || 'No pudimos enviar el código de verificación.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmar código de 6 dígitos y crear la tarjeta en D1 (200 OK siempre)
  const handleConfirmEmailAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = emailOtpCode.trim();

    if (cleanCode.length < 6) {
      setFormError('Ingresá el código de 6 dígitos que enviamos a tu correo.');
      return;
    }

    const ageCheck = isAtLeast18(birthDate);
    if (!ageCheck.valid || !ageCheck.isAdult) {
      setFormError('Para crear tu tarjeta con datos hace falta ser mayor de 18.');
      return;
    }

    try {
      setSubmitting(true);
      const verifyRes = await api.verifyOtp(cleanEmail, cleanCode);
      const d1Claim = hub
        ? await claimCardInD1({
            hubData: hub,
            customerName: name.trim(),
            customerEmail: cleanEmail,
            customerBirthDate: birthDate,
          })
        : {};

      // Si el correo ya existía en otra cuenta, nunca forzar nuevo registro
      if (verifyRes.account?.accountExists) {
        const res = await api.addCardToAccount({
          localCode: hub?.cartel.code || targetCode,
          marketingConsent,
          email: cleanEmail,
          name: name.trim(),
          barcodeToken: d1Claim.barcodeToken,
        });
        const mergedMember: ClubMember = {
          ...res.member,
          stamps: d1Claim.stamps ?? res.member.stamps ?? 0,
          stampsRequired: 10,
          barcodeToken: d1Claim.barcodeToken || res.member.barcodeToken || res.member.shortCode,
          shortCode: d1Claim.barcodeToken || res.member.shortCode || res.member.barcodeToken,
          memberCode: d1Claim.barcodeToken || res.member.memberCode || res.member.barcodeToken,
        };
        setJoinedMember(mergedMember);
        setNewlyStampedSlot(null);
        setStep('active');
        showToast(`¡Hola, ${mergedMember.name || 'Socio'}! Ya tenés tu tarjeta activa.`, 'success');
        return;
      }

      const reg = await api.registerMember({
        localCode: hub?.cartel.code || targetCode,
        name: name.trim(),
        email: cleanEmail,
        birthDate,
        birthDay: ageCheck.birthDay,
        birthMonth: ageCheck.birthMonth,
        marketingConsent,
      });

      const mergedMember: ClubMember = {
        ...reg.member,
        id: d1Claim.memberId || reg.member.id,
        walletSerial: d1Claim.walletSerial || reg.member.walletSerial,
        appleWalletUrl: d1Claim.appleWalletUrl || reg.member.appleWalletUrl,
        googleWalletUrl: d1Claim.googleWalletUrl || reg.member.googleWalletUrl,
        stamps: d1Claim.stamps ?? reg.member.stamps ?? 0,
        stampsRequired: 10,
        barcodeToken: d1Claim.barcodeToken || reg.member.barcodeToken || reg.member.shortCode,
        shortCode: d1Claim.barcodeToken || reg.member.shortCode || reg.member.barcodeToken,
        memberCode: d1Claim.barcodeToken || reg.member.memberCode || reg.member.barcodeToken,
      };

      setJoinedMember(mergedMember);
      setNewlyStampedSlot(null);
      setStep('active');
      showToast('¡Correo verificado! Ya tenés tu tarjeta activa.', 'success');
    } catch (err: any) {
      setFormError(err?.message || 'Código inválido o vencido.');
    } finally {
      setSubmitting(false);
    }
  };

  // Emitir el pase y abrir el archivo nativo devuelto por el Worker.
  const handleAddToWallet = async (preferredTarget: 'auto' | 'apple' | 'google' = 'auto') => {
    if (!hub || !joinedMember) return;
    setWalletErrorMessage(null);
    setWalletStatusMessage(null);
    const rawCode = joinedMember.barcodeToken || joinedMember.shortCode || joinedMember.memberCode || '';
    if (!/^\\d{8}$/.test(rawCode)) {
      setWalletErrorMessage('Esta tarjeta todavía no tiene un código de socio válido. Actualizá la tarjeta e intentá de nuevo.');
      return;
    }
    const rewardLabel = hub.club?.config?.loyaltyReward || hub.club?.config?.rewardText || 'Beneficio al completar tus sellos';
    const targetStampsCount = hub.club?.config?.targetStamps || 10;
    try {
      setGeneratingPass(true);
      const pass = await api.createWalletPass({
        cartelCode: hub.cartel.code, memberId: joinedMember.id, memberCode: rawCode,
        barcodeValue: rawCode, barcodeFormat: 'Code128', customerName: joinedMember.name || 'Socio',
        customerContact: joinedMember.email || joinedMember.maskedEmail || joinedMember.contact,
        stamps: joinedMember.stamps, stampsRequired: targetStampsCount, rewardText: rewardLabel,
        colorPreset: hub.club?.config?.colorPreset || 'dark',
        serialNumber: joinedMember.walletSerial, isUpdate: Boolean(joinedMember.walletSerial),
      });
      const appleUrl = pass.appleWalletUrl || joinedMember.appleWalletUrl || null;
      const googleUrl = pass.googleSaveUrl || pass.googleWalletUrl || joinedMember.googleWalletUrl || null;
      setAppleWalletHref(appleUrl || '');
      setGoogleWalletHref(googleUrl || '');
      if (isIOSDevice()) {
        if (!appleUrl) throw new Error('WalletWallet no devolvió el archivo de Apple Wallet.');
        setWalletStatusMessage('Abriendo tu pase en Apple Wallet...');
        window.location.assign(appleUrl);
        return;
      }
      if (isAndroidDevice()) {
        if (!googleUrl) throw new Error('WalletWallet no devolvió el enlace de Google Wallet.');
        setWalletStatusMessage('Abriendo tu pase en Google Wallet...');
        window.location.assign(googleUrl);
        return;
      }
      const fallback = preferredTarget === 'apple' ? appleUrl : googleUrl || appleUrl;
      setDesktopFallbackUrl(fallback || '');
      setWalletStatusMessage('Elegí Apple Wallet o Google Wallet debajo para guardar tu tarjeta.');
    } catch (err: any) {
      setWalletErrorMessage(err?.message || 'No pudimos conectar con la billetera. Intentá de nuevo.');
    } finally {
      setGeneratingPass(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-4">
          <Skeleton className="h-52 w-full rounded-3xl bg-[#141414]" />
          <Skeleton className="h-60 w-full rounded-3xl bg-[#141414]" />
        </div>
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F6] p-6 flex items-center justify-center">
        <div className="max-w-sm w-full rounded-3xl bg-[#141414] border border-[#242424] p-7 text-center space-y-4">
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
  const rawOrderedBlocks: HubBlockKey[] = (hub.blocks || [])
    .filter((b) => b.enabled)
    .map((b) => b.key);

  const orderedEnabledBlocks: HubBlockKey[] = displayedReceipt
    ? ['receipt', ...rawOrderedBlocks.filter((k) => k !== 'receipt')]
    : rawOrderedBlocks;

  const clubCfg = club?.config;
  const cardBgColor = clubCfg?.customColor || clubCfg?.cardThemeColor || clubCfg?.brandColor || '#141414';
  const targetStamps = clubCfg?.targetStamps || clubCfg?.stampsRequired || 5;
  const currentStamps = Math.max(0, joinedMember?.stamps ?? 0);
  const remainingStamps = Math.max(0, targetStamps - currentStamps);
  const rewardLabel =
    clubCfg?.loyaltyReward ||
    clubCfg?.rewardText ||
    'Beneficio exclusivo en tu próxima visita';
  const rawShortCode =
    joinedMember?.barcodeToken || joinedMember?.shortCode || joinedMember?.memberCode || '48291037';
  const immutableShortCode = /^\d{8}$/.test(rawShortCode) ? rawShortCode : '48291037';

  const effectiveReviewUrl = config.googleReviewUrl?.trim() || hub.reviewUrl?.trim() || '';
  const hasRealReview = isConfiguredReviewUrl(effectiveReviewUrl);
  const featuredProducts = (config.products || []).filter(
    (p) => p.featuredInHub !== false && p.title?.trim()
  );
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

  const renderClubAuthFlow = () => (
    <>
      {/* B1. SESIÓN ACTIVA RECONOCIDA: "Hola, [Nombre]" + botón "Guardar mi tarjeta" en un solo toque */}
      {step === 'recognized_other_merchant' && recognizedAccount && (
        <section className="rounded-3xl bg-[#141414] border border-[#242424] p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#F4F4F6] leading-snug">
              Hola, {recognizedAccount.name || 'Socio'}
            </h2>
            <p className="text-xs text-[#9E9EA8]">
              Tu cuenta ({recognizedAccount.email}) ya está activa en este dispositivo. Tocá el botón para activar tu tarjeta de {business.name}.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3 rounded-2xl bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]"
            >
              {formError}
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={handleAddCardForRecognizedAccount}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#D95B26] hover:bg-[#e36630] text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#D95B26]/20"
          >
            {submitting ? 'Guardando tarjeta...' : 'Guardar tarjeta'}
          </button>

          <button
            type="button"
            onClick={() => {
              clearConsumerSession();
              setRecognizedAccount(null);
              setStep('email_login');
            }}
            className="w-full text-center text-[11px] text-[#9E9EA8] hover:text-white underline cursor-pointer"
          >
            Ingresar con otro correo
          </button>
        </section>
      )}

      {/* B2. PANTALLA "Ingresá tu correo" -> CÓDIGO DE 6 DÍGITOS -> ENTRA DIRECTO SI YA TIENE CUENTA */}
      {step === 'email_login' && (
        <section className="rounded-3xl bg-[#141414] border border-[#242424] p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#F4F4F6]">Ingresá tu correo</h2>
              <p className="text-xs text-[#9E9EA8]">
                Te enviamos un código de 6 dígitos. Si ya tenés cuenta en Toque, entrás directo sin registrarte de nuevo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setFormError(null);
              }}
              className="text-[11px] font-bold text-[#BEC8FF] hover:text-white underline cursor-pointer shrink-0"
            >
              Crear cuenta
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3 rounded-2xl bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]"
            >
              {formError}
            </div>
          )}

          {!loginOtpSent ? (
            <form onSubmit={handleSendLoginOtp} className="space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#0A0A0A] border border-[#242424] text-xs text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
                />
              </div>
              <button
                type="submit"
                disabled={verifyingLogin}
                className="w-full py-3 px-5 rounded-2xl bg-[#D95B26] hover:bg-[#e36630] text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {verifyingLogin ? 'Enviando código...' : 'Recibir código de 6 dígitos'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyLoginOtp} className="space-y-3">
              {loginOtpHint && (
                <p className="text-xs font-mono text-[#BEC8FF] bg-[#1C1C22] border border-[#242424] px-3 py-1.5 rounded-xl">
                  Código de prueba: <strong>{loginOtpHint}</strong>
                </p>
              )}
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                value={loginOtpCode}
                onChange={(e) =>
                  setLoginOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="Código de 6 dígitos"
                className="w-full px-4 py-3 rounded-2xl bg-[#0A0A0A] border border-[#242424] text-center font-mono text-base tracking-widest text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginOtpSent(false);
                    setLoginOtpCode('');
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-[#1C1C22] border border-[#242424] text-xs font-bold text-[#9E9EA8] cursor-pointer"
                >
                  Cambiar correo
                </button>
                <button
                  type="submit"
                  disabled={verifyingLogin || loginOtpCode.length < 6}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-[#2FB36A] hover:bg-[#259858] text-[#05150c] font-bold text-xs disabled:opacity-50 cursor-pointer"
                >
                  {verifyingLogin ? 'Verificando...' : 'Continuar'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* B3. REGISTRO DEL CLIENTE (nombre, correo, BirthDatePicker nativo de 3 selectores, >= 18) */}
      {step === 'form' && (
        <section className="rounded-3xl bg-[#141414] border border-[#242424] p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#F4F4F6] leading-snug">
                Creá tu tarjeta de {business.name}
              </h2>
              <p className="text-xs text-[#9E9EA8]">
                Completá tus datos para guardar tus sellos en tu cuenta.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep('email_login');
                setFormError(null);
              }}
              className="shrink-0 text-[11px] font-bold text-[#BEC8FF] hover:text-white underline cursor-pointer"
            >
              Ingresá tu correo →
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3 rounded-2xl bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]"
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleStartRegistration} className="space-y-3">
            <div>
              <label
                htmlFor="hub-name-input"
                className="block text-xs font-semibold text-[#F4F4F6] mb-1"
              >
                Nombre
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#0A0A0A] border border-[#242424] text-xs text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="hub-email-input"
                className="block text-xs font-semibold text-[#F4F4F6] mb-1"
              >
                Ingresá tu correo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="hub-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailAlreadyVerifiedInLogin(false);
                  }}
                  placeholder="tu@correo.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#0A0A0A] border border-[#242424] text-xs text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="hub-birthdate-input"
                className="block text-xs font-semibold text-[#F4F4F6] mb-1"
              >
                Fecha de nacimiento
              </label>
              <BirthDatePicker
                id="hub-birthdate-input"
                value={birthDate}
                onChange={setBirthDate}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#9E9EA8] cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="rounded border-[#242424] bg-[#0A0A0A] text-[#D95B26]"
              />
              <span>Quiero recibir avisos y beneficios de {business.name}</span>
            </label>

            <div className="pt-1 space-y-1.5">
              <p className="text-[11px] text-[#9E9EA8] leading-snug text-center">
                Al continuar, aceptás los{' '}
                <Link to="/terminos" className="text-[#F4F4F6] underline">
                  Términos
                </Link>{' '}
                y la{' '}
                <Link to="/privacidad" className="text-[#F4F4F6] underline">
                  Política de privacidad
                </Link>{' '}
                de Toque.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-5 rounded-2xl bg-[#D95B26] hover:bg-[#e36630] text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#D95B26]/20"
              >
                {submitting
                  ? 'Guardando tarjeta...'
                  : emailAlreadyVerifiedInLogin
                  ? 'Guardar tarjeta'
                  : 'Guardar tarjeta'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* B4. PASO DE VERIFICACIÓN DE CÓDIGO DE 6 DÍGITOS ENVIADO AL CORREO */}
      {step === 'verify_email' && (
        <section className="rounded-3xl bg-[#141414] border border-[#D95B26]/50 p-5 space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#D95B26]">Verificación de correo</span>
            <h2 className="text-sm font-bold text-[#F4F4F6]">
              Ingresá el código de 6 dígitos que enviamos a {email}
            </h2>
            {emailOtpHint && (
              <p className="text-xs font-mono text-[#BEC8FF] bg-[#1C1C22] border border-[#242424] px-3 py-1.5 rounded-xl mt-2">
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
              onChange={(e) =>
                setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="Código de 6 dígitos"
              className="w-full px-4 py-3 rounded-2xl bg-[#0A0A0A] border border-[#242424] text-center font-mono text-base tracking-widest text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setFormError(null);
                }}
                className="px-4 py-2.5 rounded-2xl bg-[#1C1C22] border border-[#242424] text-xs font-bold text-[#9E9EA8] cursor-pointer"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={submitting || emailOtpCode.length < 6}
                className="flex-1 py-2.5 px-4 rounded-2xl bg-[#2FB36A] hover:bg-[#259858] text-[#05150c] font-bold text-xs disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Guardando...' : 'Guardar tarjeta'}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );

  const renderBlock = (key: HubBlockKey) => {
    switch (key) {
      case 'receipt': {
        if (!displayedReceipt) return null;
        return (
          <section key="block-receipt" className="pt-1">
            <DieCutTicket
              receiptId={displayedReceipt.id}
              businessName={business.name}
              businessAddress={displayedReceipt.businessAddress || config.details?.address}
              businessHours={displayedReceipt.businessHours || config.details?.hours}
              total={displayedReceipt.total}
              discount={displayedReceipt.discountArs}
              cashTendered={displayedReceipt.cashTendered}
              changeDue={displayedReceipt.changeDue}
              createdAt={displayedReceipt.createdAt}
              items={displayedReceipt.items}
              method={displayedReceipt.method}
              stamps={currentStamps}
              stampsRequired={targetStamps}
              rewardText={rewardLabel}
              barcodeToken={immutableShortCode}
              cardTitle={clubCfg?.loyaltyTitle || clubCfg?.logoText || `Tarjeta de sellos de ${business.name}`}
              colorPreset={clubCfg?.colorPreset || 'dark'}
              customColor={clubCfg?.customColor || cardBgColor}
              logoUrl={clubCfg?.logoUrl || business.logoUrl}
              memberName={joinedMember?.name}
              isRegisteredInHub={Boolean(joinedMember)}
              clubRegisterContent={step !== 'active' ? renderClubAuthFlow() : undefined}
              isExpiredBlur={isReceiptExpired}
              onOpenToquecitos={handleOpenToquecitos}
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
            {/* A. RESUMEN VISUAL DE SELLOS DEL COMERCIO */}
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
                  <span className="block text-[10px] text-white/75 font-semibold">
                    Sellos acumulados
                  </span>
                  <span className="text-xl font-extrabold tracking-tight text-white">
                    {currentStamps} de {targetStamps}
                  </span>
                </div>
              </div>

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
                        className={`aspect-square rounded-full bg-white text-[#0A0A0A] flex items-center justify-center shadow-md ${
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
                    ? 'Premio disponible: mostrá tu tarjeta en caja para canjearlo'
                    : `Faltan ${remainingStamps} ${
                        remainingStamps === 1 ? 'sello' : 'sellos'
                      } para tu premio`}
                </span>
                <span className="text-[11px] text-white/75 shrink-0">
                  {clubCfg?.howToEarn || '1 sello por visita'}
                </span>
              </div>
            </section>

            {/* Si no hay comprobante en pantalla, mostramos el flujo de alta aquí directamente */}
            {!displayedReceipt && step !== 'active' && renderClubAuthFlow()}

            {/* C. TARJETA ACTIVA DEL CLIENTE (código de barras CODE128 con los 8 números grandes debajo + botón secundario de billetera) */}
            {step === 'active' && joinedMember && (
              <section className="rounded-3xl bg-[#141414] border border-[#242424] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#2FB36A]/15 border border-[#2FB36A]/30 text-[#2FB36A] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-[#F4F4F6]">
                        Hola, {joinedMember.name || 'Socio'}
                      </h2>
                      <p className="text-[11px] text-[#9E9EA8]">
                        {autoStampedThisVisit
                          ? 'Se sumó +1 sello en tu tarjeta.'
                          : cooldownRemainingMs > 0
                          ? `Próximo sello disponible en ${Math.floor(
                              cooldownRemainingMs / 3600000
                            )} h ${Math.max(
                              1,
                              Math.ceil((cooldownRemainingMs % 3600000) / 60000)
                            )} min.`
                          : 'Guardada en tu cuenta y lista para usar en el local.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      clearConsumerSession();
                      setJoinedMember(null);
                      setStep('email_login');
                    }}
                    className="text-[11px] text-[#666672] hover:text-[#9E9EA8] underline cursor-pointer shrink-0"
                  >
                    Cambiar cuenta
                  </button>
                </div>

                {/* Tarjeta con código de barras CODE128 y los 8 números grandes debajo */}
                <WalletPassCard
                  businessName={clubCfg?.loyaltyTitle || business.name}
                  memberName={joinedMember.name || 'Socio'}
                  stamps={currentStamps}
                  stampsRequired={targetStamps}
                  rewardText={rewardLabel}
                  barcodeToken={immutableShortCode}
                  shortCode={immutableShortCode}
                  colorPreset={clubCfg?.colorPreset || 'dark'}
                  customColor={clubCfg?.customColor || cardBgColor}
                  logoUrl={clubCfg?.logoUrl || business.logoUrl}
                />

                {/* Botones para guardar en Apple Wallet (.pkpass) y Google Wallet */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={generatingPass}
                      onClick={() => handleAddToWallet('apple')}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#1C1C22] hover:bg-[#25252d] disabled:opacity-50 disabled:cursor-not-allowed border border-[#242424] text-xs font-bold text-[#F4F4F6] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Wallet className="w-4 h-4 text-[#D95B26]" />
                      <span>
                        {generatingPass ? 'Preparando pase...' : 'Guardar en Apple Wallet'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={generatingPass}
                      onClick={() => handleAddToWallet('google')}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#1C1C22] hover:bg-[#25252d] disabled:opacity-50 disabled:cursor-not-allowed border border-[#242424] text-xs font-bold text-[#F4F4F6] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Wallet className="w-4 h-4 text-[#D95B26]" />
                      <span>
                        {generatingPass ? 'Preparando pase...' : 'Guardar en Google Wallet'}
                      </span>
                    </button>
                  </div>

                  {walletStatusMessage && (
                    <p className="text-xs text-center text-[#9E9EA8]">{walletStatusMessage}</p>
                  )}

                  {(appleWalletHref || googleWalletHref || desktopFallbackUrl) && (
                    <div className="pt-1 flex flex-wrap items-center justify-center gap-4 text-center">
                      {appleWalletHref && (
                        <a
                          href={appleWalletHref}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D95B26] hover:underline"
                        >
                          <span>Descargar para Apple Wallet (.pkpass)</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {googleWalletHref && (
                        <a
                          href={googleWalletHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D95B26] hover:underline"
                        >
                          <span>Abrir en Google Wallet</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}

                  {walletErrorMessage && (
                    <p role="alert" className="text-xs text-center text-red-400">
                      {walletErrorMessage}
                    </p>
                  )}
                </div>
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
              <p className="text-[11px] text-[#9E9EA8] truncate">Mostrador · {cartel.code}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenToquecitos}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#242424] text-xs font-bold text-[#F4F4F6] transition-colors cursor-pointer"
              title="Ver tus tarjetas y comprobantes en Toquecitos"
            >
              <BrandLogo variant="isotipo" size="sm" />
              <span>Toquecitos</span>
            </button>
          </div>
        </header>

        {/* MODO SOLO COMPROBANTE */}
        {hub.unpaidLockdown ? (
          displayedReceipt ? (
            <DieCutTicket
              receiptId={displayedReceipt.id}
              businessName={business.name}
              businessAddress={displayedReceipt.businessAddress || config.details?.address}
              businessHours={displayedReceipt.businessHours || config.details?.hours}
              total={displayedReceipt.total}
              discount={displayedReceipt.discountArs}
              cashTendered={displayedReceipt.cashTendered}
              changeDue={displayedReceipt.changeDue}
              createdAt={displayedReceipt.createdAt}
              items={displayedReceipt.items}
              method={displayedReceipt.method}
              hideClubSection={true}
              isExpiredBlur={isReceiptExpired}
              onOpenToquecitos={handleOpenToquecitos}
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
    </div>
  );
};
