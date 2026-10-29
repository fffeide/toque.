import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  api,
  ClubMember,
  ConsumerReceipt,
  ConsumerUser,
  NetworkActivation,
  RecognizedClientAccount,
} from '../../api';
import {
  getLocalConsumerReceipts,
  getLocalConsumerUser,
  saveLocalConsumerUser,
} from '../../lib/consumerStorage';
import { BrandLogo } from '../../components/ui/Avatar';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  LogOut,
  Mail,
  Moon,
  QrCode,
  Receipt as ReceiptIcon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Sun,
  Ticket,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { DieCutTicket } from '../../components/ticket/DieCutTicket';
import { detectWalletOS, getWalletButtonLabel } from '../../lib/walletOs';

type ActiveSection = 'cards' | 'tickets' | 'benefits' | 'profile';

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
    return { inCooldown: false, label: 'Disponible para sumar en mostrador' };
  }
  const elapsedMs = Date.now() - new Date(lastStampedAt).getTime();
  if (Number.isNaN(elapsedMs) || elapsedMs >= 86400000) {
    return { inCooldown: false, label: 'Disponible para sumar en mostrador' };
  }
  const remainingMs = 86400000 - elapsedMs;
  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.max(1, Math.ceil((remainingMs % 3600000) / 60000));
  return {
    inCooldown: true,
    label: `Próximo sello disponible en ${hours} h ${minutes} min`,
  };
}

export const ToquecitosView: React.FC = () => {
  const [searchParams] = useSearchParams();
  // REGLA #2: Solo mostrar el botón de volver al Hub si el usuario entró explícitamente desde un Hub (?from=CODIGO)
  const originHubCode = useMemo(() => {
    const fromParam = searchParams.get('from')?.trim();
    return fromParam && fromParam.length > 0 ? fromParam : null;
  }, [searchParams]);

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('toque_toquecitos_theme');
      return saved ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('toque_toquecitos_theme', next ? 'dark' : 'light');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [activeSection, setActiveSection] = useState<ActiveSection>('cards');
  const [selectedCard, setSelectedCard] = useState<ClubMember | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  const [account, setAccount] = useState<RecognizedClientAccount | null>(null);
  const [localCards, setLocalCards] = useState<ClubMember[]>([]);
  const [receipts, setReceipts] = useState<ConsumerReceipt[]>([]);
  const [crossBenefits, setCrossBenefits] = useState<NetworkActivation[]>([]);
  const [userProfile, setUserProfile] = useState<ConsumerUser | null>(null);

  // OTP Login state
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoHintCode, setDemoHintCode] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Wallet generation / Revoke states
  const [walletLoadingId, setWalletLoadingId] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [revokingCardId, setRevokingCardId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [selectedCardQrUrl, setSelectedCardQrUrl] = useState<string>('');

  const sectionContentRef = useRef<HTMLDivElement>(null);
  const walletOS = useMemo(() => detectWalletOS(), []);
  const walletButtonLabel = useMemo(() => getWalletButtonLabel(walletOS), [walletOS]);

  useEffect(() => {
    if (!selectedCard) {
      setSelectedCardQrUrl('');
      return;
    }
    const tokenValue =
      selectedCard.barcodeToken && selectedCard.barcodeToken.length >= 16
        ? selectedCard.barcodeToken
        : selectedCard.memberCode || selectedCard.id;
    QRCode.toDataURL(tokenValue, { width: 200, margin: 1 })
      .then(setSelectedCardQrUrl)
      .catch(() => setSelectedCardQrUrl(''));
  }, [selectedCard]);

  const loadLocalCardsFromStorage = (): ClubMember[] => {
    const found: ClubMember[] = [];
    const seenIds = new Set<string>();
    try {
      // 1. Leer lista unificada de socios para tener siempre los sellos actualizados desde el panel del comercio
      const rawMembers = window.localStorage.getItem('toque_club_members_v1');
      const allMembers: ClubMember[] = rawMembers ? JSON.parse(rawMembers) : [];
      const byId = new Map<string, ClubMember>();
      if (Array.isArray(allMembers)) {
        for (const m of allMembers) {
          if (m && m.id) byId.set(m.id, m);
        }
      }

      // 2. Leer tarjetas guardadas en este dispositivo (toque_member_*)
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('toque_member_') && key !== 'toque_member_emails_v1') {
          const raw = window.localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw) as ClubMember;
          if (parsed && parsed.id && !seenIds.has(parsed.id)) {
            const liveVersion = byId.get(parsed.id) || parsed;
            seenIds.add(liveVersion.id);
            found.push(liveVersion);
          }
        }
      }
    } catch {
      // ignore
    }
    return found;
  };

  const refreshData = async () => {
    const storedUser = getLocalConsumerUser();
    const storedReceipts = getLocalConsumerReceipts();
    setUserProfile(storedUser);
    setReceipts(storedReceipts);
    if (storedReceipts.length > 0 && !selectedReceiptId) {
      setSelectedReceiptId(storedReceipts[0].id);
    }

    const deviceCards = loadLocalCardsFromStorage();
    setLocalCards(deviceCards);

    try {
      const [recAcc, benefits] = await Promise.all([
        api.recognizeAccount(storedUser?.emailOrPhone),
        api.getPublicCrossBenefits(),
      ]);
      if (recAcc.recognized) {
        setAccount(recAcc);
        if (recAcc.email && !emailInput) setEmailInput(recAcc.email);
        if (recAcc.name && !nameInput) setNameInput(recAcc.name);
      } else {
        setAccount(null);
      }
      setCrossBenefits(benefits);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshData();
    const onFocus = () => refreshData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Unificar tarjetas de cuenta reconocida + tarjetas locales del dispositivo (siempre priorizando datos más recientes)
  const cards: ClubMember[] = useMemo(() => {
    const map = new Map<string, ClubMember>();
    for (const c of localCards) {
      map.set(c.id, c);
    }
    if (account?.cards) {
      for (const c of account.cards) {
        map.set(c.id, c);
      }
    }
    return Array.from(map.values());
  }, [account, localCards]);

  // Mantener selectedCard sincronizada si cambian sus sellos
  useEffect(() => {
    if (selectedCard) {
      const updated = cards.find((c) => c.id === selectedCard.id);
      if (updated) {
        setSelectedCard(updated);
      }
    }
  }, [cards]);

  // Cálculo de dinero ahorrado con Toque y premios canjeados
  const { totalSavedArs, totalRedeemedCount } = useMemo(() => {
    let saved = 0;
    let redeemed = 0;
    for (const c of cards) {
      const count = c.rewardsRedeemed || 0;
      redeemed += count;
      const unitValue = c.rewardValueArs && c.rewardValueArs > 0 ? c.rewardValueArs : 8500;
      saved += count * unitValue;
    }
    return { totalSavedArs: saved, totalRedeemedCount: redeemed };
  }, [cards]);

  const handleSelectSection = (sec: ActiveSection) => {
    setActiveSection(sec);
    setTimeout(() => {
      sectionContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('Ingresá un correo electrónico válido.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await api.requestOtp(cleanEmail, 'register_client');
      setOtpSent(true);
      setDemoHintCode(res.demoHintCode || null);
      setAuthSuccess(`Te enviamos un código de 6 dígitos a ${cleanEmail}.`);
    } catch (err: any) {
      setAuthError(err?.message || 'No pudimos enviar el código.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
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
      const res = await api.verifyOtp(cleanEmail, cleanCode, {
        ownerName: nameInput.trim() || cleanEmail.split('@')[0],
      });
      if (res.verified && res.account) {
        setAccount(res.account);
        const newUser: ConsumerUser = {
          id: res.account.accountId || `usr-${Date.now()}`,
          displayName: res.account.name || nameInput.trim() || cleanEmail.split('@')[0],
          emailOrPhone: cleanEmail,
          ageGroup: 'all',
          consentSaveReceipts: true,
          consentMarketingNetwork: false,
          createdAt: new Date().toISOString(),
        };
        saveLocalConsumerUser(newUser);
        setUserProfile(newUser);
        await api.syncConsumerVault({ user: newUser, receipts });
        setOtpSent(false);
        setOtpCode('');
        setDemoHintCode(null);
        setAuthSuccess('Tu cuenta quedó vinculada y tus tarjetas están respaldadas.');
        await refreshData();
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Código incorrecto o vencido.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAddToWallet = async (card: ClubMember) => {
    setWalletError(null);
    if (card.shareUrl && card.shareUrl.startsWith('https://')) {
      window.location.href = card.shareUrl;
      return;
    }
    setWalletLoadingId(card.id);
    try {
      const passRes = await api.createWalletPass({
        cartelCode: card.localCode || 'BURGER01',
        memberId: card.id,
        memberCode: card.barcodeToken || card.memberCode,
        customerName: card.anonymous ? undefined : card.name,
        stamps: card.stamps,
        stampsRequired: card.targetStamps || card.stampsRequired || 10,
        rewardText: card.rewardText,
        colorPreset: card.colorPreset || 'dark',
        color: card.customColor,
        logoURL: card.logoUrl,
      });
      await refreshData();
      const targetUrl =
        walletOS === 'apple'
          ? passRes.appleWalletUrl || passRes.shareUrl
          : passRes.googleWalletUrl || passRes.shareUrl;
      if (targetUrl && targetUrl.startsWith('https://')) {
        window.location.href = targetUrl;
      } else {
        setWalletError('La tarjeta digital fue generada, pero el enlace aún no está disponible.');
      }
    } catch (err: any) {
      setWalletError(err?.message || 'No pudimos generar el pase para tu billetera.');
    } finally {
      setWalletLoadingId(null);
    }
  };

  const handleRevokeCard = async (memberId: string) => {
    setRevokingCardId(memberId);
    try {
      await api.revokeMemberCard(memberId);
      // Limpiar también de localStorage si estaba guardado por comercio
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('toque_member_')) {
          try {
            const parsed = JSON.parse(window.localStorage.getItem(k) || '{}');
            if (parsed.id === memberId) {
              window.localStorage.removeItem(k);
            }
          } catch {
            // ignore
          }
        }
      }
      setConfirmRevokeId(null);
      setSelectedCard(null);
      await refreshData();
    } catch (err: any) {
      setWalletError(err?.message || 'No se pudo dar de baja la tarjeta.');
    } finally {
      setRevokingCardId(null);
    }
  };

  const activeReceipt = useMemo(() => {
    if (receipts.length === 0) return null;
    return receipts.find((r) => r.id === selectedReceiptId) || receipts[0];
  }, [receipts, selectedReceiptId]);

  const bgMain = isDark ? 'bg-[#09090B] text-[#F5F5F2]' : 'bg-[#F4F1EA] text-[#141413]';
  const surfaceCard = isDark
    ? 'bg-[#141416] border-[#242428] text-[#F5F5F2]'
    : 'bg-white border-[#E4DEC9] text-[#141413] shadow-sm';
  const mutedText = isDark ? 'text-[#9E9B95]' : 'text-[#6E6A63]';

  return (
    <div className={`min-h-screen ${bgMain} font-sans pb-28 transition-colors duration-300`}>
      {/* Barra superior minimalista */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-xl border-b transition-colors ${
          isDark ? 'bg-[#09090B]/85 border-[#242428]' : 'bg-[#F4F1EA]/85 border-[#E4DEC9]'
        }`}
      >
        <div className="max-w-md mx-auto px-4 h-15 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {originHubCode ? (
              <Link
                to={`/u/${originHubCode}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  isDark
                    ? 'bg-[#141416] border-[#26262A] text-[#F5F5F2] hover:border-[#D95B26]'
                    : 'bg-white border-[#DDD6C7] text-[#141413] hover:border-[#D95B26]'
                }`}
              >
                <ArrowLeft size={14} />
                <span>Volver al Hub del local</span>
              </Link>
            ) : (
              <Link to="/" className="flex items-center gap-2">
                <BrandLogo variant="isotipo" size="sm" />
                <span className="font-bold text-sm tracking-tight">Toquecitos</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#141416] border-[#26262A] text-amber-400 hover:border-[#D95B26]'
                  : 'bg-white border-[#DDD6C7] text-[#141413] hover:border-[#D95B26]'
              }`}
              aria-label="Cambiar tema claro u oscuro"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
                account?.recognized
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : isDark
                  ? 'bg-[#141416] border-[#26262A] text-[#F5F5F2] hover:border-[#D95B26]'
                  : 'bg-white border-[#DDD6C7] text-[#141413] hover:border-[#D95B26]'
              }`}
            >
              <User size={13} />
              <span className="truncate max-w-[110px]">
                {account?.recognized
                  ? account.name || account.maskedEmail || 'Mi cuenta'
                  : 'Respaldar'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-5 space-y-6">
        {/* 1. Cabecera Vaulta: Dinero ahorrado con Toque */}
        <section className={`rounded-3xl border p-5 ${surfaceCard}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className={`text-xs font-medium ${mutedText}`}>Ahorrado con Toque</span>
              <div className="text-3xl font-black tracking-tight mt-0.5 font-mono">
                ${totalSavedArs.toLocaleString('es-AR')}
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
          <p className={`text-xs ${mutedText} mt-2`}>
            Tus tarjetas de sellos, tickets digitales y beneficios en comercios adheridos.
          </p>
        </section>

        {/* 2. Tarjetero 3D en cuero con costuras y broche metálico */}
        <section aria-label="Tarjetero en cuero">
          <div className="relative rounded-[30px] p-4 pt-5 pb-6 bg-gradient-to-b from-[#231F1D] via-[#181514] to-[#110F0E] border border-[#38312E] shadow-[0_22px_45px_rgba(0,0,0,0.55)] overflow-hidden">
            {/* Costura perimetral en hilo claro */}
            <div className="pointer-events-none absolute inset-2 rounded-[24px] border border-dashed border-[#6E5D53]/45" />

            <div className="relative z-10 flex items-center justify-between px-2 mb-3">
              <div className="flex items-center gap-2">
                <Wallet size={15} className="text-[#D95B26]" />
                <span className="text-xs font-semibold text-[#E6E1DA]">
                  Tarjetero personal
                </span>
              </div>
              <span className="text-[11px] font-medium text-[#A39B93]">
                {cards.length} {cards.length === 1 ? 'tarjeta activa' : 'tarjetas activas'}
              </span>
            </div>

            {/* Pila de tarjetas dentro del bolsillo de cuero */}
            {cards.length === 0 ? (
              <div className="relative z-10 rounded-2xl bg-[#141210]/90 border border-[#2E2825] p-6 text-center space-y-2.5 my-2">
                <QrCode className="w-8 h-8 text-[#D95B26] mx-auto opacity-85" />
                <p className="text-sm font-bold text-white">
                  Todavía no tenés tarjetas en tu tarjetero
                </p>
                <p className="text-xs text-[#9E9B95] leading-relaxed">
                  Cuando apoyes tu celular o escanees el QR en el mostrador de un local adherido, tu tarjeta de sellos va a aparecer acá automáticamente.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(true)}
                  className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Mail size={13} />
                  <span>Recuperar mis tarjetas con mi mail</span>
                </button>
              </div>
            ) : (
              <div className="relative z-10 pt-1 pb-2 space-y-2.5">
                {cards.map((card, idx) => {
                  const bgHex = resolveCardBackground(card);
                  const target = card.targetStamps || card.stampsRequired || 10;
                  const progressPct = Math.min(100, Math.round(((card.stamps || 0) / target) * 100));

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setWalletError(null);
                        setSelectedCard(card);
                      }}
                      style={{
                        backgroundColor: bgHex,
                        transform: `translateY(${idx * -2}px)`,
                      }}
                      className="w-full text-left rounded-2xl p-4 border border-white/15 shadow-[0_8px_20px_rgba(0,0,0,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {card.logoUrl ? (
                            <img
                              src={card.logoUrl}
                              alt={card.businessName || 'Logo'}
                              className="w-8 h-8 rounded-lg object-cover border border-white/20 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {(card.businessName || 'T').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {card.businessName || 'Comercio adherido'}
                            </p>
                            <p className="text-[11px] text-white/75 truncate">
                              {card.rewardText || 'Beneficio exclusivo en tu próxima visita'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="block text-[9px] font-bold tracking-wider text-white/65">
                            SELLOS
                          </span>
                          <span className="font-mono text-base font-black text-white">
                            {card.stamps} / {target}
                          </span>
                        </div>
                      </div>

                      {/* Barra sutil de progreso */}
                      <div className="mt-3 h-1.5 w-full rounded-full bg-black/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white/90 transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Solapa inferior del tarjetero con botón metálico grabado */}
            <div className="relative z-10 mt-2 pt-3 border-t border-[#38312E]/80 flex items-center justify-between px-2">
              <span className="text-[11px] text-[#9E948C]">
                Tocá una tarjeta para abrir el código QR y pase
              </span>
              <div
                aria-hidden="true"
                className="w-6 h-6 rounded-full bg-gradient-to-br from-[#524944] to-[#26211E] border border-[#736760] shadow-inner flex items-center justify-center"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-[#181514] border border-[#524944]" />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Tres tarjetas selectoras horizontales debajo del tarjetero */}
        <section aria-label="Accesos rápidos de tu bóveda" className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleSelectSection('cards')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSection === 'cards'
                ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-md'
                : `${surfaceCard} hover:border-[#D95B26]/50`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <CreditCard
                size={18}
                className={activeSection === 'cards' ? 'text-white' : 'text-[#D95B26]'}
              />
              <span className="font-mono text-xs font-bold">{cards.length}</span>
            </div>
            <p className="text-xs font-bold leading-tight">Mis tarjetas</p>
            <p
              className={`text-[10px] mt-0.5 truncate ${
                activeSection === 'cards' ? 'text-white/80' : mutedText
              }`}
            >
              Sellos activos
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('tickets')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSection === 'tickets'
                ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-md'
                : `${surfaceCard} hover:border-[#D95B26]/50`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <ReceiptIcon
                size={18}
                className={activeSection === 'tickets' ? 'text-white' : 'text-[#D95B26]'}
              />
              <span className="font-mono text-xs font-bold">{receipts.length}</span>
            </div>
            <p className="text-xs font-bold leading-tight">Tickets</p>
            <p
              className={`text-[10px] mt-0.5 truncate ${
                activeSection === 'tickets' ? 'text-white/80' : mutedText
              }`}
            >
              Comprobantes
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('benefits')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSection === 'benefits'
                ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-md'
                : `${surfaceCard} hover:border-[#D95B26]/50`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Sparkles
                size={18}
                className={activeSection === 'benefits' ? 'text-white' : 'text-[#D95B26]'}
              />
              <span className="font-mono text-xs font-bold">
                {cards.filter((c) => c.stamps >= (c.targetStamps || 10)).length +
                  crossBenefits.length}
              </span>
            </div>
            <p className="text-xs font-bold leading-tight">Beneficios</p>
            <p
              className={`text-[10px] mt-0.5 truncate ${
                activeSection === 'benefits' ? 'text-white/80' : mutedText
              }`}
            >
              Premios y red
            </p>
          </button>
        </section>

        {/* 4. Contenido dinámico según la sección elegida */}
        <div ref={sectionContentRef} className="pt-1">
          {activeSection === 'cards' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold">Detalle de tus tarjetas</h2>
                <span className={`text-xs ${mutedText}`}>
                  Tocá cualquiera para abrir tu QR
                </span>
              </div>

              {cards.length === 0 ? (
                <div className={`rounded-2xl border p-5 text-center ${surfaceCard}`}>
                  <p className="text-xs font-medium">
                    Aún no sumaste sellos en ningún comercio.
                  </p>
                </div>
              ) : (
                cards.map((card) => {
                  const target = card.targetStamps || card.stampsRequired || 10;
                  const cooldown = getStrictCooldownState(card.lastStampedAt);
                  const readyToRedeem = card.stamps >= target;

                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        setWalletError(null);
                        setSelectedCard(card);
                      }}
                      className={`rounded-2xl border p-4 transition-colors cursor-pointer hover:border-[#D95B26]/50 ${surfaceCard}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold">
                            {card.businessName || 'Comercio adherido'}
                          </h3>
                          <p className={`text-xs ${mutedText} mt-0.5`}>
                            Premio: {card.rewardText || 'Beneficio al completar tus sellos'}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                            readyToRedeem
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-[#D95B26]/15 text-[#D95B26]'
                          }`}
                        >
                          {card.stamps} / {target}
                        </span>
                      </div>

                      {/* Grilla visual de sellos */}
                      <div className="grid grid-cols-5 gap-2 mt-3.5">
                        {Array.from({ length: Math.min(target, 10) }).map((_, i) => {
                          const filled = i < card.stamps;
                          return (
                            <div
                              key={i}
                              className={`h-8 rounded-xl flex items-center justify-center text-xs font-bold border transition-all ${
                                filled
                                  ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-sm'
                                  : isDark
                                  ? 'bg-[#09090B] border-[#26262A] text-[#6E6A63]'
                                  : 'bg-[#F4F1EA] border-[#DDD6C7] text-[#8C867B]'
                              }`}
                            >
                              {filled ? <Check size={14} /> : i + 1}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-current/10 flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1.5 text-[#9E9B95]">
                          <Clock size={12} />
                          <span>{cooldown.label}</span>
                        </span>
                        <span className="font-semibold text-[#D95B26] inline-flex items-center gap-1">
                          <span>Ver pase QR</span>
                          <ArrowUpRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeSection === 'tickets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-sm font-bold">Tus tickets digitales</h2>
                  <p className={`text-xs ${mutedText}`}>
                    Comprobantes guardados automáticamente al comprar en locales Toque
                  </p>
                </div>
              </div>

              {receipts.length === 0 ? (
                <div className={`rounded-2xl border p-6 text-center space-y-2 ${surfaceCard}`}>
                  <Ticket className="w-8 h-8 text-[#D95B26] mx-auto opacity-80" />
                  <p className="text-sm font-bold">Aún no tenés tickets guardados</p>
                  <p className={`text-xs ${mutedText}`}>
                    Cuando el comercio emita tu comprobante en caja y apoyes tu celular en el cartel, el ticket completo se guarda automáticamente acá.
                  </p>
                </div>
              ) : (
                <>
                  {/* Selector horizontal si hay más de un ticket */}
                  {receipts.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {receipts.map((r) => {
                        const isSelected = activeReceipt?.id === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelectedReceiptId(r.id)}
                            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#D95B26] border-[#D95B26] text-white'
                                : `${surfaceCard}`
                            }`}
                          >
                            <span>{r.merchantName}</span>
                            <span className="ml-2 font-mono opacity-80">
                              ${(r.total ?? r.amountArs ?? 0).toLocaleString('es-AR')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Ticket troquelado completo idéntico al diseño de referencia */}
                  {activeReceipt && (
                    <DieCutTicket
                      receiptId={activeReceipt.id}
                      businessName={activeReceipt.merchantName}
                      total={activeReceipt.total ?? activeReceipt.amountArs ?? 0}
                      createdAt={activeReceipt.createdAt}
                      items={activeReceipt.items}
                      method={activeReceipt.method}
                      stamps={
                        cards.find(
                          (c) =>
                            c.businessId === (activeReceipt.businessId || activeReceipt.tenantId)
                        )?.stamps ?? 1
                      }
                      stampsRequired={
                        cards.find(
                          (c) =>
                            c.businessId === (activeReceipt.businessId || activeReceipt.tenantId)
                        )?.targetStamps ?? 10
                      }
                      onViewPass={() => {
                        const matchingCard =
                          cards.find(
                            (c) =>
                              c.businessId === (activeReceipt.businessId || activeReceipt.tenantId)
                          ) || cards[0];
                        if (matchingCard) {
                          setSelectedCard(matchingCard);
                        } else {
                          handleSelectSection('cards');
                        }
                      }}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {activeSection === 'benefits' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold px-1">Premios listos y beneficios</h2>

              {cards
                .filter((c) => c.stamps >= (c.targetStamps || 10))
                .map((c) => (
                  <div
                    key={`ready-${c.id}`}
                    className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="text-[11px] font-bold text-emerald-400">
                        Premio listo para canjear en mostrador
                      </span>
                      <p className="text-sm font-bold text-white mt-0.5">{c.businessName}</p>
                      <p className="text-xs text-emerald-200/90 mt-0.5">{c.rewardText}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCard(c)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold shrink-0 cursor-pointer"
                    >
                      Mostrar QR
                    </button>
                  </div>
                ))}

              {crossBenefits.length === 0 &&
              cards.filter((c) => c.stamps >= (c.targetStamps || 10)).length === 0 ? (
                <div className={`rounded-2xl border p-6 text-center space-y-1.5 ${surfaceCard}`}>
                  <Gift className="w-7 h-7 text-[#D95B26] mx-auto opacity-80" />
                  <p className="text-sm font-bold">Seguí sumando sellos en tus comercios favoritos</p>
                  <p className={`text-xs ${mutedText}`}>
                    Cuando completes los sellos de una tarjeta, tu premio aparecerá destacado acá para canjear en caja.
                  </p>
                </div>
              ) : (
                crossBenefits.map((b) => (
                  <div key={b.id} className={`rounded-2xl border p-4 ${surfaceCard}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#D95B26]">{b.merchantName}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#D95B26]/15 text-[#D95B26] text-[11px] font-bold">
                        {b.discountText}
                      </span>
                    </div>
                    <p className="text-sm font-bold mt-1">{b.title}</p>
                    <p className={`text-xs ${mutedText} mt-0.5`}>{b.terms}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === 'profile' && (
            <div className={`rounded-3xl border p-5 space-y-4 ${surfaceCard}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">Respaldo de tu cuenta</h2>
                  <p className={`text-xs ${mutedText}`}>
                    Ingresá tu mail para no perder tus sellos ni tickets si cambiás de celular
                  </p>
                </div>
                <ShieldCheck className="w-6 h-6 text-[#D95B26]" />
              </div>

              {account?.recognized ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-400">Cuenta verificada</p>
                      <p className="text-sm font-semibold mt-0.5">{account.email}</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(true)}
                    className="w-full py-2.5 rounded-xl border border-[#D95B26]/40 text-[#D95B26] text-xs font-semibold hover:bg-[#D95B26]/10 transition-colors cursor-pointer"
                  >
                    Cambiar correo vinculado
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(true)}
                  className="w-full py-3 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Vincular mi correo con código de 6 dígitos
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Barra de navegación inferior flotante sincronizada */}
      <nav
        aria-label="Navegación de Toquecitos"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-sm rounded-full bg-[#141416]/95 border border-[#28282E] backdrop-blur-xl p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)] grid grid-cols-4 gap-1"
      >
        <button
          type="button"
          onClick={() => handleSelectSection('cards')}
          className={`py-2 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
            activeSection === 'cards' ? 'bg-[#D95B26] text-white' : 'text-[#9E9B95] hover:text-white'
          }`}
        >
          <CreditCard size={15} />
          <span>Tarjetas</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSection('tickets')}
          className={`py-2 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
            activeSection === 'tickets'
              ? 'bg-[#D95B26] text-white'
              : 'text-[#9E9B95] hover:text-white'
          }`}
        >
          <ReceiptIcon size={15} />
          <span>Tickets</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSection('benefits')}
          className={`py-2 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
            activeSection === 'benefits'
              ? 'bg-[#D95B26] text-white'
              : 'text-[#9E9B95] hover:text-white'
          }`}
        >
          <Gift size={15} />
          <span>Beneficios</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSection('profile')}
          className={`py-2 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
            activeSection === 'profile'
              ? 'bg-[#D95B26] text-white'
              : 'text-[#9E9B95] hover:text-white'
          }`}
        >
          <User size={15} />
          <span>Cuenta</span>
        </button>
      </nav>

      {/* Modal de Pase WalletWallet al tocar una tarjeta del tarjetero */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setSelectedCard(null);
            setConfirmRevokeId(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[32px] overflow-hidden border border-white/15 shadow-2xl"
            style={{ backgroundColor: resolveCardBackground(selectedCard) }}
          >
            <div className="p-6 text-white space-y-5">
              {/* Header del pase */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {selectedCard.logoUrl ? (
                    <img
                      src={selectedCard.logoUrl}
                      alt={selectedCard.businessName || 'Logo'}
                      className="w-9 h-9 rounded-xl object-cover border border-white/20"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center font-bold text-sm">
                      {(selectedCard.businessName || 'T').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold leading-tight">
                      Tarjeta de sellos de {selectedCard.businessName || 'Comercio'}
                    </p>
                    <p className="text-[11px] text-white/70">Mostrá este código en caja</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCard(null);
                    setConfirmRevokeId(null);
                  }}
                  className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white/80 cursor-pointer"
                  aria-label="Cerrar pase"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Etiquetas nativas del pase Wallet: SELLOS, PREMIO, SOCIO */}
              <div>
                <span className="block text-[10px] font-bold tracking-wider text-white/65">
                  SELLOS
                </span>
                <div className="text-3xl font-black font-mono tracking-tight mt-0.5">
                  {selectedCard.stamps} / {selectedCard.targetStamps || selectedCard.stampsRequired || 10}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="col-span-2">
                  <span className="block text-[10px] font-bold tracking-wider text-white/65">
                    PREMIO
                  </span>
                  <p className="text-xs font-semibold text-white mt-0.5 line-clamp-2">
                    {selectedCard.rewardText || 'Beneficio exclusivo en tu próxima visita'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-bold tracking-wider text-white/65">
                    SOCIO
                  </span>
                  <p className="text-xs font-semibold text-white mt-0.5 truncate">
                    {selectedCard.anonymous
                      ? 'Cliente'
                      : selectedCard.name || selectedCard.maskedEmail || 'Socio'}
                  </p>
                </div>
              </div>

              {/* Código QR limpio (16+ caracteres, CERO texto debajo del QR) */}
              <div className="pt-2 flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl shadow-lg">
                  {selectedCardQrUrl ? (
                    <img
                      src={selectedCardQrUrl}
                      alt={`QR ${selectedCard.businessName}`}
                      className="w-[168px] h-[168px]"
                    />
                  ) : (
                    <div className="w-[168px] h-[168px] flex items-center justify-center text-xs text-black">
                      Generando QR...
                    </div>
                  )}
                </div>
              </div>

              {/* Indicador de regla de 24 horas (sin botón de autosellado) */}
              <div className="rounded-xl bg-black/25 border border-white/10 px-3.5 py-2.5 text-center text-xs text-white/85 flex items-center justify-center gap-1.5">
                <Clock size={13} className="shrink-0 text-white/70" />
                <span>{getStrictCooldownState(selectedCard.lastStampedAt).label}</span>
              </div>

              {walletError && (
                <div className="rounded-xl bg-red-500/20 border border-red-400/40 px-3 py-2 text-xs text-red-100 text-center">
                  {walletError}
                </div>
              )}

              {/* Botón según sistema operativo (Apple Wallet o Google Wallet) */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={walletLoadingId === selectedCard.id}
                  onClick={() => handleAddToWallet(selectedCard)}
                  className="w-full py-3 px-4 rounded-xl bg-black hover:bg-zinc-900 text-white font-semibold text-xs flex items-center justify-center gap-2 border border-white/20 shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Smartphone size={15} />
                  <span>
                    {walletLoadingId === selectedCard.id
                      ? 'Preparando pase...'
                      : walletButtonLabel}
                  </span>
                </button>

                {selectedCard.localCode && (
                  <Link
                    to={`/u/${selectedCard.localCode}`}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Store size={14} />
                    <span>Abrir Hub de {selectedCard.businessName}</span>
                  </Link>
                )}

                {/* Opción de revocar / dar de baja tarjeta */}
                {confirmRevokeId === selectedCard.id ? (
                  <div className="p-3 rounded-xl bg-black/40 border border-red-400/30 space-y-2 text-center">
                    <p className="text-[11px] text-white/90">
                      ¿Seguro que querés dar de baja esta tarjeta y sus sellos?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={revokingCardId === selectedCard.id}
                        onClick={() => handleRevokeCard(selectedCard.id)}
                        className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        {revokingCardId === selectedCard.id ? 'Eliminando...' : 'Sí, dar de baja'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeId(null)}
                        className="flex-1 py-1.5 rounded-lg bg-white/15 text-white text-xs font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeId(selectedCard.id)}
                    className="w-full py-1.5 text-[11px] text-white/60 hover:text-white/90 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Dar de baja esta tarjeta</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de respaldo / verificación de correo por código de 6 dígitos */}
      {isAccountModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsAccountModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#141416] border border-[#26262A] p-6 text-[#F5F5F2] space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#D95B26]" />
                <h3 className="text-base font-bold">Guardado en tu cuenta</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#1F1F23] flex items-center justify-center text-[#9E9B95] hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[#9E9B95] leading-relaxed">
              Ingresá tu mail para no perder tus sellos ni tus comprobantes si cambiás de celular. Te enviamos un código de 6 dígitos sin contraseñas.
            </p>

            {authError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {authError}
              </div>
            )}

            {authSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                {authSuccess}
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#9E9B95] mb-1">
                    Tu nombre (opcional)
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Ej. Valentina"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#26262A] text-sm text-white focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9E9B95] mb-1">
                    Tu correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#26262A] text-sm text-white focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {authLoading ? 'Enviando código...' : 'Recibir código de 6 dígitos'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                {demoHintCode && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center">
                    Código de verificación para prueba: <strong className="font-mono">{demoHintCode}</strong>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-[#9E9B95] mb-1">
                    Código de 6 dígitos enviado a {emailInput}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#26262A] text-center font-mono text-lg tracking-widest text-white focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {authLoading ? 'Verificando...' : 'Confirmar y vincular mis tarjetas'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode('');
                  }}
                  className="w-full py-2 text-xs text-[#9E9B95] hover:text-white cursor-pointer"
                >
                  Cambiar correo electrónico
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToquecitosView;
