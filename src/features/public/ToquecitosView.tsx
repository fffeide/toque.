import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  api,
  ClubMember,
  ConsumerReceipt,
  RecognizedClientAccount,
} from '../../api';
import { BrandLogo } from '../../components/ui/Avatar';
import { WalletPassCard } from '../../components/wallet/WalletPassCard';
import { DieCutTicket } from '../../components/ticket/DieCutTicket';
import { Barcode128 } from '../../components/Barcode128';
import { BirthDatePicker } from '../../components/BirthDatePicker';
import {
  fetchConsumerMe,
  getConsumerSessionEmail,
  getSavedConsumerUser,
  clearConsumerSession,
  isIOSDevice,
  isAndroidDevice,
} from '../../lib/consumerSession';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Gift,
  Mail,
  QrCode,
  Receipt as ReceiptIcon,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  User,
  Wallet,
  X,
} from 'lucide-react';

type ActiveSection = 'cards' | 'tickets' | 'activity' | 'benefits' | 'profile';

const WALLET_PRESET_COLORS: Record<string, string> = {
  dark: '#1C1C1E',
  blue: '#1E3A8A',
  green: '#065F46',
  red: '#991B1B',
  purple: '#4C1D95',
  orange: '#9A3412',
};

function resolveCardBackground(card: ClubMember): string {
  if (card.customColor && /^#[0-9A-Fa-f]{6}$/.test(card.customColor)) {
    return card.customColor;
  }
  if (card.colorPreset && WALLET_PRESET_COLORS[card.colorPreset]) {
    return WALLET_PRESET_COLORS[card.colorPreset];
  }
  return '#1C1C1E';
}

function getStrictCooldownState(lastStampedAt?: string): {
  inCooldown: boolean;
  label: string;
} {
  if (!lastStampedAt) {
    return { inCooldown: false, label: 'Disponible para sumar hoy en mostrador' };
  }
  const elapsedMs = Date.now() - new Date(lastStampedAt).getTime();
  if (Number.isNaN(elapsedMs) || elapsedMs >= 86400000) {
    return { inCooldown: false, label: 'Disponible para sumar hoy en mostrador' };
  }
  const remainingMs = 86400000 - elapsedMs;
  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.max(1, Math.ceil((remainingMs % 3600000) / 60000));
  return {
    inCooldown: true,
    label: `Próximo sello en ${hours} h ${minutes} min`,
  };
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

interface VisitTicketItem {
  id: string;
  businessName: string;
  logoUrl?: string;
  createdAt: string;
  stampsDelta: number;
  stampsCurrent: number;
  stampsRequired: number;
  rewardText: string;
  barcodeToken: string;
  receipt?: ConsumerReceipt;
}

export const ToquecitosView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const originHubCode = useMemo(() => {
    const fromParam = searchParams.get('from')?.trim();
    return fromParam && fromParam.length > 0 ? fromParam : null;
  }, [searchParams]);

  const [activeSection, setActiveSection] = useState<ActiveSection>('cards');
  const [selectedCard, setSelectedCard] = useState<ClubMember | null>(null);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [openedFullReceipt, setOpenedFullReceipt] = useState<ConsumerReceipt | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Inicialización síncrona desde localStorage para que NO se cierre la sesión al hacer F5
  const [account, setAccount] = useState<RecognizedClientAccount | null>(() => {
    const saved = getSavedConsumerUser();
    if (saved && saved.email) {
      return {
        recognized: true,
        accountExists: true,
        accountId: saved.id,
        name: saved.fullName,
        email: saved.email,
        cards: [],
      };
    }
    return null;
  });
  const [receipts, setReceipts] = useState<ConsumerReceipt[]>([]);

  const [authStep, setAuthStep] = useState<'enter_email' | 'enter_otp' | 'register_new'>(
    'enter_email'
  );
  const [emailInput, setEmailInput] = useState(() => getSavedConsumerUser()?.email || '');
  const [otpCode, setOtpCode] = useState('');
  const [demoHintCode, setDemoHintCode] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(() => getSavedConsumerUser()?.fullName || '');
  const [birthDateInput, setBirthDateInput] = useState(() => getSavedConsumerUser()?.birthDate || '');
  const [marketingConsentInput, setMarketingConsentInput] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [walletLoadingId, setWalletLoadingId] = useState<string | null>(null);
  const [walletUnconfigured, setWalletUnconfigured] = useState(false);
  const [walletStatusMessage, setWalletStatusMessage] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [desktopFallbackUrl, setDesktopFallbackUrl] = useState<string | null>(null);

  const sectionContentRef = useRef<HTMLDivElement>(null);

  const refreshData = async (targetEmail?: string) => {
    try {
      const savedLocal = getSavedConsumerUser();
      const sessionEmail =
        targetEmail || getConsumerSessionEmail() || savedLocal?.email || emailInput || undefined;
      const [recAcc, meRes] = await Promise.all([
        api.recognizeAccount(sessionEmail).catch(() => null),
        fetchConsumerMe().catch(() => ({ authenticated: false, user: null, cards: [], receipts: [] })),
      ]);

      const d1MappedCards: ClubMember[] = (meRes.cards || []).map((c) => ({
        id: c.id,
        businessId: c.tenantId,
        businessName: c.businessName,
        shortCode: c.barcodeToken,
        memberCode: c.barcodeToken,
        barcodeToken: c.barcodeToken,
        name: meRes.user?.fullName || savedLocal?.fullName || 'Socio',
        email: meRes.user?.email || savedLocal?.email,
        contact: meRes.user?.email || savedLocal?.email || '',
        anonymous: false,
        points: c.stamps,
        stamps: c.stamps,
        stampsRequired: c.stampsRequired,
        targetStamps: c.stampsRequired,
        rewardText: c.rewardText,
        rewardValueArs: c.rewardValueArs,
        colorPreset: (c.colorPreset as any) || 'dark',
        customColor: c.brandColor,
        logoUrl: c.logoUrl,
        lastVisitAt: c.lastStampedAt || new Date().toISOString(),
        lastStampedAt: c.lastStampedAt,
        joinedAt: new Date().toISOString(),
        consent: true,
      }));

      let effectiveAcc = recAcc;
      if (effectiveAcc && effectiveAcc.recognized) {
        // Unificar tarjetas de D1 con las tarjetas locales asegurando el barcode_token exacto de 8 dígitos
        const mergedCards = [...(effectiveAcc.cards || [])];
        for (const d1Card of d1MappedCards) {
          const existingIdx = mergedCards.findIndex(
            (mc) => mc.businessId === d1Card.businessId || mc.businessName === d1Card.businessName
          );
          if (existingIdx >= 0) {
            mergedCards[existingIdx] = {
              ...mergedCards[existingIdx],
              barcodeToken: d1Card.barcodeToken || mergedCards[existingIdx].barcodeToken,
              shortCode: d1Card.barcodeToken || mergedCards[existingIdx].shortCode,
              memberCode: d1Card.barcodeToken || mergedCards[existingIdx].memberCode,
              stamps: Math.max(mergedCards[existingIdx].stamps || 0, d1Card.stamps || 0),
            };
          } else {
            mergedCards.push(d1Card);
          }
        }
        effectiveAcc = {
          ...effectiveAcc,
          cards: mergedCards,
        };
      } else if (meRes.authenticated && meRes.user?.email) {
        effectiveAcc = {
          recognized: true,
          accountExists: true,
          accountId: meRes.user.id,
          name: meRes.user.fullName,
          email: meRes.user.email,
          cards: d1MappedCards,
        };
      } else if (savedLocal && savedLocal.email) {
        effectiveAcc = {
          recognized: true,
          accountExists: true,
          accountId: savedLocal.id,
          name: savedLocal.fullName,
          email: savedLocal.email,
          cards: d1MappedCards,
        };
      }

      if (effectiveAcc && effectiveAcc.recognized) {
        setAccount(effectiveAcc);
        if (effectiveAcc.email && !emailInput) {
          setEmailInput(effectiveAcc.email);
        }
        if (effectiveAcc.email) {
          const vault = await api.recoverConsumerVault(effectiveAcc.email).catch(() => null);
          setReceipts(vault?.receipts || []);
        } else {
          setReceipts([]);
        }
      } else {
        setAccount(null);
        setReceipts([]);
      }
    } catch {
      // Si hay error temporal de red, mantener sesión local activa
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const cards: ClubMember[] = useMemo(() => {
    return account?.recognized ? account.cards || [] : [];
  }, [account]);

  useEffect(() => {
    if (cards.length > 0 && !focusedCardId) {
      setFocusedCardId(cards[0].id);
    }
    if (selectedCard) {
      const updated = cards.find((c) => c.id === selectedCard.id);
      if (updated) {
        setSelectedCard(updated);
      }
    }
  }, [cards, selectedCard, focusedCardId]);

  const activeSummaryCard: ClubMember | null = useMemo(() => {
    if (cards.length === 0) return null;
    return cards.find((c) => c.id === focusedCardId) || cards[0];
  }, [cards, focusedCardId]);

  const { totalSavedArs, totalRedeemedCount } = useMemo(() => {
    let saved = 0;
    let redeemed = 0;
    for (const c of cards) {
      const count = c.rewardsRedeemed || 0;
      redeemed += count;
      const unitValue = c.rewardValueArs && c.rewardValueArs > 0 ? c.rewardValueArs : 0;
      saved += count * unitValue;
    }
    for (const r of receipts) {
      if (r.discountSavedArs && r.discountSavedArs > 0) {
        saved += r.discountSavedArs;
      }
    }
    return { totalSavedArs: saved, totalRedeemedCount: redeemed };
  }, [cards, receipts]);

  // Lista unificada de tickets de visita (sellos registrados y comprobantes digitales)
  const visitTickets: VisitTicketItem[] = useMemo(() => {
    const items: VisitTicketItem[] = [];

    for (const card of cards) {
      const rawCode = card.barcodeToken || card.shortCode || card.memberCode || '48291037';
      const code8 = /^\d{8}$/.test(rawCode) ? rawCode : '48291037';
      const target = card.targetStamps || card.stampsRequired || 5;
      const reward = card.rewardText || 'Beneficio exclusivo en tu próxima visita';
      const history = card.stampHistory || [];

      if (history.length > 0) {
        for (const h of history) {
          if (h.voided) continue;
          const linkedReceipt = h.receiptId
            ? receipts.find((r) => r.id === h.receiptId)
            : undefined;
          items.push({
            id: `vt-${h.id}`,
            businessName: card.businessName || 'Comercio adherido',
            logoUrl: card.logoUrl,
            createdAt: h.createdAt,
            stampsDelta: h.count || 1,
            stampsCurrent: card.stamps || 1,
            stampsRequired: target,
            rewardText: reward,
            barcodeToken: code8,
            receipt: linkedReceipt,
          });
        }
      } else {
        items.push({
          id: `vt-card-${card.id}`,
          businessName: card.businessName || 'Comercio adherido',
          logoUrl: card.logoUrl,
          createdAt: card.lastStampedAt || card.joinedAt,
          stampsDelta: 1,
          stampsCurrent: card.stamps || 1,
          stampsRequired: target,
          rewardText: reward,
          barcodeToken: code8,
        });
      }
    }

    for (const r of receipts) {
      const alreadyIncluded = items.some((it) => it.receipt?.id === r.id);
      if (!alreadyIncluded) {
        const matchingCard =
          cards.find((c) => c.businessId === (r.businessId || r.tenantId)) || cards[0];
        const rawCode =
          matchingCard?.barcodeToken || matchingCard?.shortCode || matchingCard?.memberCode || '48291037';
        const code8 = /^\d{8}$/.test(rawCode) ? rawCode : '48291037';
        items.push({
          id: `vt-rcp-${r.id}`,
          businessName: r.merchantName || matchingCard?.businessName || 'Comercio',
          logoUrl: matchingCard?.logoUrl,
          createdAt: r.createdAt,
          stampsDelta: 1,
          stampsCurrent: matchingCard?.stamps || 1,
          stampsRequired: matchingCard?.targetStamps || matchingCard?.stampsRequired || 5,
          rewardText: matchingCard?.rewardText || 'Beneficio en tu próxima visita',
          barcodeToken: code8,
          receipt: r,
        });
      }
    }

    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [cards, receipts]);

  // Movimientos cronológicos para la pestaña "Actividad" ("Últimos movimientos")
  const activityLogs = useMemo(() => {
    const entries: Array<{
      id: string;
      businessName: string;
      logoUrl?: string;
      title: string;
      subtitle: string;
      badge: string;
      isReward: boolean;
      createdAt: string;
    }> = [];

    for (const card of cards) {
      const bizName = card.businessName || 'Comercio adherido';
      for (const h of card.stampHistory || []) {
        if (h.voided) continue;
        const isRedeem = h.count < 0;
        entries.push({
          id: `act-${h.id}`,
          businessName: bizName,
          logoUrl: card.logoUrl,
          title: isRedeem ? `Premio canjeado en ${bizName}` : `Sello sumado en ${bizName}`,
          subtitle: h.actorName || (isRedeem ? 'Canje en mostrador' : 'Visita registrada'),
          badge: isRedeem ? 'Premio' : `+${h.count} ${h.count === 1 ? 'sello' : 'sellos'}`,
          isReward: isRedeem,
          createdAt: h.createdAt,
        });
      }
    }

    return entries.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [cards]);

  const handleSelectSection = (sec: ActiveSection) => {
    setActiveSection(sec);
    setOpenedFullReceipt(null);
    setTimeout(() => {
      sectionContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const handleSendLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('Ingresá un correo válido.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await api.requestOtp(cleanEmail, 'client_card');
      setDemoHintCode(res.demoHintCode || null);
      setAuthStep('enter_otp');
      setAuthSuccess(`Te enviamos un código de 6 dígitos a ${cleanEmail}.`);
    } catch (err: any) {
      setAuthError(err?.message || 'No pudimos enviar el código.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      setAuthError('El código debe tener 6 dígitos.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await api.verifyOtp(cleanEmail, cleanCode);
      const rec = res.account || (await api.recognizeAccount(cleanEmail));

      if (res.accountExists || (rec && rec.accountExists)) {
        setAccount(rec);
        setOtpCode('');
        setDemoHintCode(null);
        setAuthStep('enter_email');
        setIsAccountModalOpen(false);
        await refreshData(cleanEmail);
      } else {
        setAuthSuccess(null);
        setAuthStep('register_new');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Código incorrecto o vencido.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCompleteNewRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const cleanName = nameInput.trim();
    const cleanEmail = emailInput.trim().toLowerCase();

    if (!cleanName) {
      setAuthError('Ingresá tu nombre.');
      return;
    }
    if (!birthDateInput) {
      setAuthError('Seleccioná tu fecha de nacimiento.');
      return;
    }

    const ageCheck = isAtLeast18(birthDateInput);
    if (!ageCheck.valid || !ageCheck.isAdult) {
      setAuthError('Para crear tu tarjeta con datos hace falta ser mayor de 18.');
      return;
    }

    setAuthLoading(true);
    try {
      const reg = await api.registerMember({
        localCode: originHubCode || 'MONROE01',
        name: cleanName,
        email: cleanEmail,
        birthDate: birthDateInput,
        birthDay: ageCheck.birthDay,
        birthMonth: ageCheck.birthMonth,
        marketingConsent: marketingConsentInput,
      });
      await api
        .syncConsumerVault({
          user: {
            id: reg.member.id || `usr-${Date.now()}`,
            emailOrPhone: cleanEmail,
            displayName: cleanName,
            birthDate: birthDateInput,
            ageGroup: 'adult',
            consentSaveReceipts: true,
            consentMarketingNetwork: marketingConsentInput,
            createdAt: new Date().toISOString(),
          },
          receipts,
        })
        .catch(() => {});
      setAccount(reg.account);
      setIsAccountModalOpen(false);
      setAuthStep('enter_email');
      await refreshData(cleanEmail);
    } catch (err: any) {
      setAuthError(err?.message || 'No pudimos crear tu cuenta.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAddToWallet = async (card: ClubMember) => {
    if (walletUnconfigured) return;
    setWalletError(null);
    setWalletStatusMessage(null);
    setDesktopFallbackUrl(null);
    setWalletLoadingId(card.id);
    try {
      const rawCode = card.barcodeToken || card.shortCode || card.memberCode || '48291037';
      const immutableShortCode = /^\d{8}$/.test(rawCode) ? rawCode : '48291037';
      const passRes = await api.createWalletPass({
        cartelCode: card.localCode || 'MONROE01',
        memberId: card.id,
        memberCode: immutableShortCode,
        barcodeValue: immutableShortCode,
        barcodeFormat: 'CODE128',
        customerName: card.name,
        stamps: card.stamps,
        stampsRequired: card.targetStamps || card.stampsRequired || 5,
        rewardText: card.rewardText,
        colorPreset: card.colorPreset || 'dark',
        color: card.customColor,
        logoURL: card.logoUrl,
      });

      if (passRes.configured === false) {
        setWalletUnconfigured(true);
        setWalletStatusMessage('Pronto vas a poder guardarla en tu billetera');
        return;
      }

      if (!passRes.success) {
        setWalletError('No pudimos crear tu tarjeta. Probá de nuevo.');
        return;
      }

      const pkpassUrl = `/api/wallet/pass/${encodeURIComponent(immutableShortCode)}.pkpass`;
      const googleUrl = passRes.googleWalletUrl;

      if (isIOSDevice()) {
        window.location.href = pkpassUrl;
        return;
      }

      if (isAndroidDevice() && googleUrl) {
        window.location.href = googleUrl;
        return;
      }

      const fallback = googleUrl || pkpassUrl;
      setDesktopFallbackUrl(fallback);
      setWalletStatusMessage('Tu pase está listo en pantalla. También podés descargarlo debajo.');
    } catch {
      setWalletError('No pudimos crear tu tarjeta. Probá de nuevo.');
    } finally {
      setWalletLoadingId(null);
    }
  };

  const formattedSavedArs = useMemo(() => {
    if (totalSavedArs === 0) return '$0,00';
    return `$${totalSavedArs.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [totalSavedArs]);

  const userFirstName = useMemo(() => {
    if (!account?.recognized || !account.name) return '';
    return account.name.trim().split(/\s+/)[0];
  }, [account]);

  const userInitial = useMemo(() => {
    if (userFirstName) return userFirstName.charAt(0).toUpperCase();
    if (account?.email) return account.email.charAt(0).toUpperCase();
    return 'T';
  }, [userFirstName, account]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F2] font-sans pb-24">
      {/* Cabecera: Saludo limpio a la izquierda ("Hola, [Nombre]"), píldora central "Todas mis tarjetas", avatar a la derecha */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0A0A0A]/90 border-b border-[#242424]">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-2">
          {/* Izquierda: Saludo limpio o volver al local */}
          <div className="min-w-0 flex items-center gap-2">
            {originHubCode && (
              <Link
                to={`/u/${originHubCode}`}
                className="w-8 h-8 rounded-full bg-[#141414] border border-[#242424] flex items-center justify-center text-[#F5F5F2] hover:border-[#D95B26] shrink-0"
                title="Volver al local"
              >
                <ArrowLeft size={14} />
              </Link>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {account?.recognized
                  ? `Hola, ${userFirstName || 'Socio'}`
                  : 'Hola, invitado'}
              </p>
              <p className="text-[10px] text-[#9E9B95] truncate">
                {account?.recognized ? 'Guardado en tu cuenta' : 'Toquecitos'}
              </p>
            </div>
          </div>

          {/* Centro: Píldora "Todas mis tarjetas" */}
          <button
            type="button"
            onClick={() => handleSelectSection('cards')}
            className="px-3 py-1 rounded-full bg-[#141414] border border-[#242424] text-[11px] font-semibold text-[#F5F5F2] hover:border-[#D95B26]/60 transition-colors cursor-pointer shrink-0"
          >
            Todas mis tarjetas
          </button>

          {/* Derecha: Avatar del cliente */}
          <button
            type="button"
            onClick={() => {
              setAuthError(null);
              setAuthSuccess(null);
              setAuthStep('enter_email');
              setIsAccountModalOpen(true);
            }}
            className="w-9 h-9 rounded-full bg-[#141414] border border-[#242424] hover:border-[#D95B26] flex items-center justify-center text-xs font-bold text-white transition-colors cursor-pointer shrink-0"
            title={account?.recognized ? account.email : 'Ingresá tu correo'}
          >
            {account?.recognized ? (
              <span className="text-[#D95B26] font-extrabold">{userInitial}</span>
            ) : (
              <User size={15} className="text-[#9E9B95]" />
            )}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* 1. Bloque de ahorro real */}
        <section className="rounded-2xl bg-[#141414] border border-[#242424] p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-medium text-[#9E9B95]">Ahorrado con Toque</span>
              <div className="text-2xl font-black tracking-tight mt-0.5 font-mono text-white">
                {formattedSavedArs}
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Gift size={13} />
              <span>
                {totalRedeemedCount}{' '}
                {totalRedeemedCount === 1 ? 'premio canjeado' : 'premios canjeados'}
              </span>
            </div>
          </div>
        </section>

        {/* 2. Tarjetero 3D interactivo de cuero oscuro con costuras y broche central */}
        <section aria-label="Tarjetero de cuero">
          <div className="relative rounded-[28px] p-4 pt-5 pb-5 bg-gradient-to-b from-[#1F1B18] via-[#151210] to-[#0E0C0B] border border-[#332C27] shadow-[0_20px_45px_rgba(0,0,0,0.75)] overflow-hidden">
            {/* Costuras perimetrales sutiles de cuero */}
            <div className="pointer-events-none absolute inset-2 rounded-[22px] border border-dashed border-[#5E4F45]/45" />

            <div className="relative z-10 flex items-center justify-between px-2 mb-3">
              <div className="flex items-center gap-2">
                <Wallet size={14} className="text-[#D95B26]" />
                <span className="text-xs font-semibold text-[#E8E2D9]">
                  Mis tarjetas
                </span>
              </div>
              <span className="text-[11px] font-medium text-[#A39B93]">
                {cards.length} {cards.length === 1 ? 'tarjeta activa' : 'tarjetas activas'}
              </span>
            </div>

            {cards.length === 0 ? (
              <div className="relative z-10 rounded-2xl bg-[#141414]/95 border border-[#242424] p-5 text-center space-y-2.5 my-1">
                <QrCode className="w-7 h-7 text-[#D95B26] mx-auto opacity-90" />
                <p className="text-xs font-bold text-white">
                  {account?.recognized
                    ? 'Todavía no tenés tarjetas activas en tu tarjetero'
                    : 'Ingresá tu correo para abrir tus tarjetas'}
                </p>
                <p className="text-[11px] text-[#9E9B95] leading-relaxed">
                  {account?.recognized
                    ? 'Cuando escanees el QR de un local adherido, tu tarjeta aparecerá acá automáticamente.'
                    : 'Si ya te registraste en un comercio, ingresá tu correo para ver tus sellos y tickets.'}
                </p>
                {!account?.recognized && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep('enter_email');
                      setIsAccountModalOpen(true);
                    }}
                    className="mt-1 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Mail size={13} />
                    <span>Ingresá tu correo</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="relative z-10 pt-1 pb-3 space-y-2">
                {cards.map((card, idx) => {
                  const bgHex = resolveCardBackground(card);
                  const target = card.targetStamps || card.stampsRequired || 5;
                  const currentStamps = card.stamps ?? 0;
                  const rawCode =
                    card.barcodeToken || card.shortCode || card.memberCode || '48291037';
                  const shortCode = /^\d{8}$/.test(rawCode) ? rawCode : '48291037';
                  const isFocused = activeSummaryCard?.id === card.id;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setFocusedCardId(card.id);
                        setWalletError(null);
                        setWalletStatusMessage(null);
                        setDesktopFallbackUrl(null);
                        setSelectedCard(card);
                      }}
                      style={{
                        backgroundColor: bgHex,
                        marginTop: idx === 0 ? 0 : '-10px',
                      }}
                      className={`w-full text-left rounded-2xl p-3.5 border transition-all duration-200 cursor-pointer relative overflow-hidden shadow-[0_-6px_18px_rgba(0,0,0,0.45)] ${
                        isFocused
                          ? 'border-white/30 ring-1 ring-[#D95B26]/60'
                          : 'border-white/15 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {card.logoUrl ? (
                            <img
                              src={card.logoUrl}
                              alt={card.businessName || 'Logo'}
                              className="w-8 h-8 rounded-xl object-cover border border-white/20 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {(card.businessName || 'T').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {card.businessName || 'Comercio adherido'}
                            </p>
                            <p className="text-[11px] text-white/75 truncate">
                              {card.rewardText || 'Beneficio al completar tus sellos'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="block text-[10px] font-medium text-white/70">
                            Sellos
                          </span>
                          <span className="font-mono text-sm font-black text-white">
                            {currentStamps} de {target}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[10px] text-white/75">
                        <span className="font-mono">Código: {shortCode}</span>
                        <span className="font-semibold text-white/90">
                          Tocar para abrir pase →
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bolsillo frontal de cuero con broche metálico central */}
            <div className="relative z-20 mt-1 pt-3 border-t border-[#3E342E] flex items-center justify-between px-2">
              <span className="text-[11px] text-[#A39B93]">
                Tocá una tarjeta para desplegar tu código de barras
              </span>
              {/* Broche central del tarjetero */}
              <div
                aria-hidden="true"
                className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6E6057] to-[#29231F] border border-[#8C7B70] shadow-inner flex items-center justify-center shrink-0"
              >
                <div className="w-2 h-2 rounded-full bg-[#151210]" />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Tres botones de sección debajo del tarjetero (grid grid-cols-3 gap-2.5) */}
        <section aria-label="Secciones de tu billetera" className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleSelectSection('cards')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSection === 'cards'
                ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-sm'
                : 'bg-[#141414] border-[#242424] text-[#F5F5F2] hover:border-[#D95B26]/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <CreditCard
                size={15}
                className={activeSection === 'cards' ? 'text-white' : 'text-[#D95B26]'}
              />
              <span className="font-mono text-xs font-bold">{cards.length}</span>
            </div>
            <p className="text-xs font-bold leading-tight">Mis tarjetas</p>
            <p
              className={`text-[10px] mt-0.5 truncate ${
                activeSection === 'cards' ? 'text-white/80' : 'text-[#9E9B95]'
              }`}
            >
              Sellos acumulados
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('tickets')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSection === 'tickets'
                ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-sm'
                : 'bg-[#141414] border-[#242424] text-[#F5F5F2] hover:border-[#D95B26]/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <ReceiptIcon
                size={15}
                className={activeSection === 'tickets' ? 'text-white' : 'text-[#D95B26]'}
              />
              <span className="font-mono text-xs font-bold">{visitTickets.length}</span>
            </div>
            <p className="text-xs font-bold leading-tight">Tickets</p>
            <p
              className={`text-[10px] mt-0.5 truncate ${
                activeSection === 'tickets' ? 'text-white/80' : 'text-[#9E9B95]'
              }`}
            >
              Comprobantes
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('activity')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSection === 'activity'
                ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-sm'
                : 'bg-[#141414] border-[#242424] text-[#F5F5F2] hover:border-[#D95B26]/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Activity
                size={15}
                className={activeSection === 'activity' ? 'text-white' : 'text-[#D95B26]'}
              />
              <span className="font-mono text-xs font-bold">{activityLogs.length}</span>
            </div>
            <p className="text-xs font-bold leading-tight">Actividad</p>
            <p
              className={`text-[10px] mt-0.5 truncate ${
                activeSection === 'activity' ? 'text-white/80' : 'text-[#9E9B95]'
              }`}
            >
              Últimos movimientos
            </p>
          </button>
        </section>

        {/* 4. Contenido dinámico según la pestaña activa */}
        <div ref={sectionContentRef} className="pt-0.5">
          {/* PESTAÑA 1: MIS TARJETAS (Resumen de progreso con barra segmentada) */}
          {activeSection === 'cards' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold text-white">Sellos acumulados</h2>
                <span className="text-[11px] text-[#9E9B95]">
                  Tocá una tarjeta para abrir tu código de barras
                </span>
              </div>

              {cards.length === 0 ? (
                <div className="rounded-2xl bg-[#141414] border border-[#242424] p-5 text-center">
                  <p className="text-xs font-medium text-[#9E9B95]">
                    {account?.recognized
                      ? 'Todavía no sumaste sellos en ningún comercio.'
                      : 'Ingresá tu correo para ver tus tarjetas guardadas.'}
                  </p>
                </div>
              ) : (
                cards.map((card) => {
                  const target = card.targetStamps || card.stampsRequired || 5;
                  const currentStamps = card.stamps ?? 0;
                  const cooldown = getStrictCooldownState(card.lastStampedAt);
                  const readyToRedeem = currentStamps >= target;
                  const rawCode =
                    card.barcodeToken || card.shortCode || card.memberCode || '48291037';
                  const shortCode = /^\d{8}$/.test(rawCode) ? rawCode : '48291037';

                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        setFocusedCardId(card.id);
                        setWalletError(null);
                        setWalletStatusMessage(null);
                        setDesktopFallbackUrl(null);
                        setSelectedCard(card);
                      }}
                      className="rounded-2xl bg-[#141414] border border-[#242424] p-4 transition-colors cursor-pointer hover:border-[#D95B26]/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {card.logoUrl ? (
                            <img
                              src={card.logoUrl}
                              alt={card.businessName || 'Logo'}
                              className="w-8 h-8 rounded-xl object-cover border border-[#242424] shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-[#D95B26]/15 border border-[#D95B26]/30 flex items-center justify-center text-[#D95B26] font-bold text-xs shrink-0">
                              {(card.businessName || 'T').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-bold text-white truncate">
                                {card.businessName || 'Comercio adherido'}
                              </h3>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#D95B26]/15 text-[#D95B26] shrink-0">
                                {shortCode}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#9E9B95] mt-0.5 truncate">
                              Premio: {card.rewardText || 'Beneficio al completar tus sellos'}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-mono shrink-0 ${
                            readyToRedeem
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-[#D95B26]/15 text-[#D95B26]'
                          }`}
                        >
                          {readyToRedeem ? 'Premio disponible' : `Sellos: ${currentStamps} de ${target}`}
                        </span>
                      </div>

                      {/* Barra segmentada de progreso */}
                      <div className="grid grid-cols-5 gap-1.5 mt-3.5">
                        {Array.from({ length: Math.min(target, 10) }).map((_, i) => {
                          const filled = i < currentStamps;
                          return (
                            <div
                              key={i}
                              className={`h-7 rounded-lg flex items-center justify-center text-[11px] font-bold border transition-all ${
                                filled
                                  ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-sm'
                                  : 'bg-[#0A0A0A] border-[#242424] text-[#6E6A63]'
                              }`}
                            >
                              {filled ? <Check size={12} /> : i + 1}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#242424] flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1.5 text-[#9E9B95]">
                          <Clock size={12} />
                          <span>{cooldown.label}</span>
                        </span>
                        <span className="font-semibold text-[#D95B26] inline-flex items-center gap-0.5">
                          <span>Guardar en mi billetera</span>
                          <ArrowUpRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* PESTAÑA 2: TICKETS (Diseño de comprobante físico troquelado con muescas laterales y borde dentado) */}
          {activeSection === 'tickets' && (
            <div className="space-y-4">
              {openedFullReceipt ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setOpenedFullReceipt(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#242424] text-xs font-semibold text-white cursor-pointer"
                  >
                    <ArrowLeft size={13} />
                    <span>Volver a mis tickets</span>
                  </button>

                  {(() => {
                    const matchingCard =
                      cards.find(
                        (c) =>
                          c.businessId ===
                            (openedFullReceipt.businessId || openedFullReceipt.tenantId) ||
                          (openedFullReceipt.cartelCode &&
                            c.localCode === openedFullReceipt.cartelCode)
                      ) || cards[0];
                    const rawCode =
                      matchingCard?.barcodeToken ||
                      matchingCard?.shortCode ||
                      matchingCard?.memberCode ||
                      '48291037';
                    const code8 = /^\d{8}$/.test(rawCode) ? rawCode : '48291037';

                    return (
                      <DieCutTicket
                        receiptId={openedFullReceipt.id}
                        businessName={openedFullReceipt.merchantName}
                        businessAddress={openedFullReceipt.businessAddress}
                        businessHours={openedFullReceipt.businessHours}
                        total={openedFullReceipt.total ?? openedFullReceipt.amountArs ?? 0}
                        createdAt={openedFullReceipt.createdAt}
                        items={openedFullReceipt.items}
                        method={openedFullReceipt.method}
                        cashTendered={openedFullReceipt.cashTendered}
                        changeDue={openedFullReceipt.changeDue}
                        discount={openedFullReceipt.discountSavedArs}
                        isDark={true}
                        stamps={matchingCard?.stamps ?? 1}
                        stampsRequired={
                          matchingCard?.targetStamps ?? matchingCard?.stampsRequired ?? 5
                        }
                        barcodeToken={code8}
                        cardTitle={
                          matchingCard?.businessName
                            ? `Tarjeta de ${matchingCard.businessName}`
                            : `Tarjeta de ${openedFullReceipt.merchantName}`
                        }
                        rewardText={
                          matchingCard?.rewardText || 'Beneficio al completar tus sellos'
                        }
                        customColor={
                          matchingCard ? resolveCardBackground(matchingCard) : '#141414'
                        }
                        logoUrl={matchingCard?.logoUrl}
                        isRegisteredInHub={Boolean(matchingCard)}
                        onViewPass={() => {
                          if (matchingCard) {
                            setSelectedCard(matchingCard);
                          } else {
                            handleSelectSection('cards');
                          }
                        }}
                      />
                    );
                  })()}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-xs font-bold text-white">Comprobantes de visita</h2>
                      <p className="text-[11px] text-[#9E9B95]">
                        Tus visitas registradas y tickets digitales guardados
                      </p>
                    </div>
                  </div>

                  {visitTickets.length === 0 ? (
                    <div className="rounded-2xl bg-[#141414] border border-[#242424] p-6 text-center space-y-2">
                      <Ticket className="w-7 h-7 text-[#D95B26] mx-auto opacity-85" />
                      <p className="text-xs font-bold text-white">
                        Todavía no tenés comprobantes de visita
                      </p>
                      <p className="text-[11px] text-[#9E9B95]">
                        Cada vez que sumás un sello o escaneás el QR de un local, tu comprobante troquelado aparece acá.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visitTickets.map((vt) => {
                        const dateObj = new Date(vt.createdAt);
                        const formattedDate = Number.isNaN(dateObj.getTime())
                          ? vt.createdAt
                          : dateObj.toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            });
                        const formattedTime = Number.isNaN(dateObj.getTime())
                          ? ''
                          : dateObj.toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            });

                        return (
                          <article
                            key={vt.id}
                            className="relative bg-[#141414] border border-[#242424] rounded-t-3xl pt-5 px-5 pb-6 text-[#F5F5F2] shadow-xl overflow-visible"
                          >
                            {/* Muescas circulares laterales de ticket físico troquelado */}
                            <div
                              aria-hidden="true"
                              className="w-5 h-5 rounded-full bg-[#0A0A0A] border-r border-[#242424] absolute -left-2.5 top-[48%] -translate-y-1/2"
                            />
                            <div
                              aria-hidden="true"
                              className="w-5 h-5 rounded-full bg-[#0A0A0A] border-l border-[#242424] absolute -right-2.5 top-[48%] -translate-y-1/2"
                            />

                            {/* Cabecera con logo del comercio arriba, "¡Gracias por tu visita!" y "Comprobante de visita" */}
                            <div className="text-center space-y-1.5 pb-4 border-b border-dashed border-[#242424]">
                              {vt.logoUrl ? (
                                <img
                                  src={vt.logoUrl}
                                  alt={vt.businessName}
                                  className="w-11 h-11 rounded-2xl object-cover mx-auto border border-[#242424]"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-2xl bg-[#D95B26]/15 border border-[#D95B26]/30 flex items-center justify-center mx-auto font-bold text-sm text-[#D95B26]">
                                  {vt.businessName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <h3 className="text-sm font-bold text-white">{vt.businessName}</h3>
                              <p className="text-xs font-semibold text-[#D95B26]">
                                ¡Gracias por tu visita!
                              </p>
                              <p className="text-[11px] text-[#9E9B95]">
                                Comprobante de visita · {formattedDate}
                                {formattedTime ? ` · ${formattedTime}` : ''}
                              </p>
                            </div>

                            {/* Detalle del sello sumado y monto si tiene recibo de caja */}
                            <div className="py-3.5 border-b border-dashed border-[#242424] space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[#9E9B95]">Sello sumado</span>
                                <span className="font-bold text-emerald-400">
                                  +{vt.stampsDelta} {vt.stampsDelta === 1 ? 'sello' : 'sellos'} (Sellos: {vt.stampsCurrent} de {vt.stampsRequired})
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#9E9B95]">Premio</span>
                                <span className="font-medium text-white truncate max-w-[190px]">
                                  {vt.rewardText}
                                </span>
                              </div>
                              {vt.receipt && (
                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[#9E9B95]">Total abonado</span>
                                  <button
                                    type="button"
                                    onClick={() => setOpenedFullReceipt(vt.receipt!)}
                                    className="font-mono font-bold text-[#D95B26] hover:underline inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>
                                      ${(vt.receipt.total ?? vt.receipt.amountArs ?? 0).toLocaleString('es-AR')}
                                    </span>
                                    <ArrowUpRight size={12} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Código de barras CODE128 con los 8 números grandes debajo */}
                            <div className="pt-4">
                              <Barcode128 value={vt.barcodeToken} height={46} />
                            </div>

                            {/* Borde inferior dentado tipo ticket físico */}
                            <div
                              aria-hidden="true"
                              className="w-full h-3 overflow-hidden absolute left-0 -bottom-2.5"
                            >
                              <svg
                                viewBox="0 0 400 12"
                                preserveAspectRatio="none"
                                className="w-full h-full fill-[#141414]"
                              >
                                <path d="M0,0 L10,12 L20,0 L30,12 L40,0 L50,12 L60,0 L70,12 L80,0 L90,12 L100,0 L110,12 L120,0 L130,12 L140,0 L150,12 L160,0 L170,12 L180,0 L190,12 L200,0 L210,12 L220,0 L230,12 L240,0 L250,12 L260,0 L270,12 L280,0 L290,12 L300,0 L310,12 L320,0 L330,12 L340,0 L350,12 L360,0 L370,12 L380,0 L390,12 L400,0 Z" />
                              </svg>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* PESTAÑA 3: ACTIVIDAD ("Últimos movimientos" cronológicos) */}
          {activeSection === 'activity' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold text-white">Últimos movimientos</h2>
                <span className="text-[11px] text-[#9E9B95]">
                  Sellos sumados y premios canjeados
                </span>
              </div>

              {activityLogs.length === 0 ? (
                <div className="rounded-2xl bg-[#141414] border border-[#242424] p-5 text-center space-y-1.5">
                  <Activity className="w-6 h-6 text-[#D95B26] mx-auto opacity-85" />
                  <p className="text-xs font-bold text-white">Sin movimientos registrados</p>
                  <p className="text-[11px] text-[#9E9B95]">
                    Tus sellos sumados y premios canjeados aparecerán acá en orden cronológico.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activityLogs.map((log) => {
                    const d = new Date(log.createdAt);
                    const dateLabel = Number.isNaN(d.getTime())
                      ? log.createdAt
                      : d.toLocaleString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                    return (
                      <div
                        key={log.id}
                        className="rounded-2xl bg-[#141414] border border-[#242424] p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {log.logoUrl ? (
                            <img
                              src={log.logoUrl}
                              alt={log.businessName}
                              className="w-9 h-9 rounded-xl object-cover border border-[#242424] shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-[#D95B26]/15 border border-[#D95B26]/30 text-[#D95B26] font-bold text-xs flex items-center justify-center shrink-0">
                              {log.businessName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{log.title}</p>
                            <p className="text-[11px] text-[#9E9B95] truncate">
                              {log.subtitle} · {dateLabel}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                            log.isReward
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-[#D95B26]/15 text-[#D95B26]'
                          }`}
                        >
                          {log.badge}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN BENEFICIOS: PRÓXIMAMENTE */}
          {activeSection === 'benefits' && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-[#141414] border border-[#242424] p-5 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#D95B26]/15 border border-[#D95B26]/30 text-[#D95B26] flex items-center justify-center mx-auto">
                  <Sparkles size={18} />
                </div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#D95B26]/15 text-[#D95B26] text-[10px] font-bold">
                  Próximamente
                </span>
                <h2 className="text-sm font-bold text-white">
                  Beneficios y regalos con tus tarjetas
                </h2>
                <p className="text-xs text-[#9E9B95] leading-relaxed max-w-xs mx-auto">
                  Muy pronto vas a encontrar acá todos los locales adheridos que ofrecen beneficios exclusivos, descuentos y cosas gratis con tus tarjetas Toque.
                </p>
              </div>
            </div>
          )}

          {/* SECCIÓN PERFIL / CUENTA */}
          {activeSection === 'profile' && (
            <div className="rounded-2xl bg-[#141414] border border-[#242424] p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Guardado en tu cuenta</h2>
                  <p className="text-[11px] text-[#9E9B95]">
                    Tus tarjetas y tickets permanecen disponibles en todos los comercios adheridos.
                  </p>
                </div>
                <ShieldCheck className="w-5 h-5 text-[#D95B26] shrink-0" />
              </div>

              {account?.recognized ? (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-emerald-400">Sesión activa</p>
                      <p className="text-xs font-semibold text-white truncate mt-0.5">
                        {account.name ? `${account.name} · ` : ''}
                        {account.email || account.maskedEmail}
                      </p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthStep('enter_email');
                        setIsAccountModalOpen(true);
                      }}
                      className="flex-1 py-2 rounded-xl border border-[#242424] text-xs font-semibold text-[#F5F5F2] hover:border-[#D95B26] transition-colors cursor-pointer"
                    >
                      Cambiar correo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearConsumerSession();
                        setAccount(null);
                        setReceipts([]);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep('enter_email');
                    setIsAccountModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Ingresá tu correo
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Barra de navegación inferior flotante */}
      <nav
        aria-label="Navegación de Toquecitos"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-sm rounded-full bg-[#141414]/95 border border-[#242424] backdrop-blur-xl p-1 shadow-[0_12px_32px_rgba(0,0,0,0.75)] grid grid-cols-4 gap-1"
      >
        <button
          type="button"
          onClick={() => handleSelectSection('cards')}
          className={`py-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeSection === 'cards' ? 'bg-[#D95B26] text-white' : 'text-[#9E9B95] hover:text-white'
          }`}
        >
          <CreditCard size={14} />
          <span>Mis tarjetas</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSection('tickets')}
          className={`py-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeSection === 'tickets'
              ? 'bg-[#D95B26] text-white'
              : 'text-[#9E9B95] hover:text-white'
          }`}
        >
          <ReceiptIcon size={14} />
          <span>Tickets</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSection('activity')}
          className={`py-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeSection === 'activity'
              ? 'bg-[#D95B26] text-white'
              : 'text-[#9E9B95] hover:text-white'
          }`}
        >
          <Activity size={14} />
          <span>Actividad</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSection('benefits')}
          className={`py-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeSection === 'benefits'
              ? 'bg-[#D95B26] text-white'
              : 'text-[#9E9B95] hover:text-white'
          }`}
        >
          <Gift size={14} />
          <span>Beneficios</span>
        </button>
      </nav>

      {/* Modal de Pase Completo al tocar una tarjeta en el tarjetero */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto"
          onClick={() => setSelectedCard(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl bg-[#141414] border border-[#242424] p-4 space-y-3.5 shadow-2xl my-auto"
          >
            <div className="flex items-center justify-between px-1">
              <div>
                <span className="text-xs font-bold text-white truncate block">
                  {selectedCard.businessName || 'Comercio adherido'}
                </span>
                <span className="text-[11px] text-[#9E9B95] inline-flex items-center gap-1 mt-0.5">
                  <Clock size={11} className="text-[#D95B26]" />
                  <span>{getStrictCooldownState(selectedCard.lastStampedAt).label}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCard(null)}
                className="w-7 h-7 rounded-full bg-[#1F1F23] flex items-center justify-center text-[#9E9B95] hover:text-white cursor-pointer"
                aria-label="Cerrar tarjeta"
              >
                <X size={14} />
              </button>
            </div>

            {(() => {
              const rawCode =
                selectedCard.barcodeToken ||
                selectedCard.shortCode ||
                selectedCard.memberCode ||
                '48291037';
              const code8 = /^\d{8}$/.test(rawCode) ? rawCode : '48291037';
              return (
                <WalletPassCard
                  businessName={selectedCard.businessName || 'Comercio'}
                  memberName={selectedCard.name || 'Socio'}
                  stamps={selectedCard.stamps}
                  stampsRequired={
                    selectedCard.targetStamps || selectedCard.stampsRequired || 5
                  }
                  rewardText={
                    selectedCard.rewardText || 'Beneficio al completar tus sellos'
                  }
                  barcodeToken={code8}
                  shortCode={code8}
                  colorPreset={selectedCard.colorPreset || 'dark'}
                  customColor={selectedCard.customColor}
                  logoUrl={selectedCard.logoUrl}
                  compact
                />
              );
            })()}

            <div className="space-y-2">
              <button
                type="button"
                disabled={walletLoadingId === selectedCard.id || walletUnconfigured}
                onClick={() => handleAddToWallet(selectedCard)}
                className="w-full py-3 px-4 rounded-xl bg-[#D95B26] hover:bg-[#e06530] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Wallet size={14} />
                <span>
                  {walletUnconfigured
                    ? 'Pronto vas a poder guardarla en tu billetera'
                    : walletLoadingId === selectedCard.id
                    ? 'Preparando tu tarjeta...'
                    : 'Guardar en mi billetera'}
                </span>
              </button>

              {walletStatusMessage && (
                <p className="text-[11px] text-center text-[#9E9B95]">{walletStatusMessage}</p>
              )}

              {desktopFallbackUrl && (
                <div className="text-center">
                  <a
                    href={desktopFallbackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D95B26] hover:underline"
                  >
                    <span>Descargar archivo de billetera</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {walletError && (
                <p role="alert" className="text-[11px] text-center text-red-400">
                  {walletError}
                </p>
              )}

              {selectedCard.localCode && (
                <Link
                  to={`/u/${selectedCard.localCode}`}
                  className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Store size={13} />
                  <span>Abrir local {selectedCard.businessName}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cuenta Única y Reconocimiento */}
      {isAccountModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsAccountModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl bg-[#141414] border border-[#242424] p-4 text-[#F5F5F2] space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D95B26]" />
                <h3 className="text-sm font-bold">
                  {authStep === 'register_new' ? 'Creá tu cuenta' : 'Ingresá tu correo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#1F1F23] flex items-center justify-center text-[#9E9B95] hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {authError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-300">
                {authError}
              </div>
            )}

            {authSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300">
                {authSuccess}
              </div>
            )}

            {authStep === 'enter_email' && (
              <form onSubmit={handleSendLoginOtp} className="space-y-3">
                <p className="text-[11px] text-[#9E9B95] leading-relaxed">
                  Si ya te registraste en un comercio o en Toquecitos, entrás directo con tu correo sin volver a completar tus datos.
                </p>
                <div>
                  <label className="block text-[11px] font-medium text-[#9E9B95] mb-1">
                    Ingresá tu correo
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#242424] text-xs text-white focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {authLoading ? 'Enviando código...' : 'Recibir código de 6 dígitos'}
                </button>
              </form>
            )}

            {authStep === 'enter_otp' && (
              <form onSubmit={handleVerifyLoginOtp} className="space-y-3">
                {demoHintCode && (
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] text-center">
                    Código de verificación: <strong className="font-mono">{demoHintCode}</strong>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-medium text-[#9E9B95] mb-1">
                    Código de 6 dígitos enviado a {emailInput}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#242424] text-center font-mono text-base tracking-widest text-white focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading || otpCode.length !== 6}
                  className="w-full py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {authLoading ? 'Verificando...' : 'Continuar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep('enter_email');
                    setOtpCode('');
                  }}
                  className="w-full py-1.5 text-[11px] text-[#9E9B95] hover:text-white cursor-pointer"
                >
                  Cambiar correo
                </button>
              </form>
            )}

            {authStep === 'register_new' && (
              <form onSubmit={handleCompleteNewRegistration} className="space-y-3">
                <p className="text-[11px] text-[#9E9B95]">
                  Es la primera vez que usás este correo en Toque. Completá tus datos una única vez.
                </p>
                <div>
                  <label className="block text-[11px] font-medium text-[#9E9B95] mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#242424] text-xs text-white focus:outline-none focus:border-[#D95B26]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9E9B95] mb-1">
                    Fecha de nacimiento
                  </label>
                  <BirthDatePicker
                    value={birthDateInput}
                    onChange={setBirthDateInput}
                  />
                </div>

                <label className="flex items-center gap-2 text-[11px] text-[#9E9B95] cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={marketingConsentInput}
                    onChange={(e) => setMarketingConsentInput(e.target.checked)}
                    className="rounded border-[#242424] bg-[#0A0A0A] text-[#D95B26]"
                  />
                  <span>Quiero recibir beneficios de comercios adheridos</span>
                </label>

                <div className="pt-1 space-y-1.5">
                  <p className="text-[10px] text-[#9E9B95] leading-snug text-center">
                    Al continuar, aceptás los{' '}
                    <Link to="/terminos" className="text-white underline">
                      Términos
                    </Link>{' '}
                    y la{' '}
                    <Link to="/privacidad" className="text-white underline">
                      Política de privacidad
                    </Link>
                    .
                  </p>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {authLoading ? 'Creando cuenta...' : 'Crear mi cuenta'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToquecitosView;
