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
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  Mail,
  Moon,
  QrCode,
  Receipt as ReceiptIcon,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Ticket,
  User,
  Wallet,
  X,
  Calendar,
} from 'lucide-react';

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

export const ToquecitosView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const originHubCode = useMemo(() => {
    const fromParam = searchParams.get('from')?.trim();
    return fromParam && fromParam.length > 0 ? fromParam : null;
  }, [searchParams]);

  const [isDark, setIsDark] = useState<boolean>(true);
  const toggleTheme = () => setIsDark((prev) => !prev);

  const [activeSection, setActiveSection] = useState<ActiveSection>('cards');
  const [selectedCard, setSelectedCard] = useState<ClubMember | null>(null);
  const [openedFullReceipt, setOpenedFullReceipt] = useState<ConsumerReceipt | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  const [account, setAccount] = useState<RecognizedClientAccount | null>(null);
  const [receipts, setReceipts] = useState<ConsumerReceipt[]>([]);

  const [authStep, setAuthStep] = useState<'enter_email' | 'enter_otp' | 'register_new'>(
    'enter_email'
  );
  const [emailInput, setEmailInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [demoHintCode, setDemoHintCode] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [marketingConsentInput, setMarketingConsentInput] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [walletLoadingId, setWalletLoadingId] = useState<string | null>(null);
  const [walletUnconfigured, setWalletUnconfigured] = useState(false);
  const [walletStatusMessage, setWalletStatusMessage] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const sectionContentRef = useRef<HTMLDivElement>(null);

  const refreshData = async (targetEmail?: string) => {
    try {
      const recAcc = await api.recognizeAccount(targetEmail || emailInput || undefined);

      if (recAcc.recognized) {
        setAccount(recAcc);
        if (recAcc.email && !emailInput) {
          setEmailInput(recAcc.email);
        }
        if (recAcc.email) {
          const vault = await api.recoverConsumerVault(recAcc.email).catch(() => null);
          setReceipts(vault?.receipts || []);
        } else {
          setReceipts([]);
        }
      } else {
        setAccount(null);
        setReceipts([]);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const cards: ClubMember[] = useMemo(() => {
    return account?.recognized ? account.cards || [] : [];
  }, [account]);

  useEffect(() => {
    if (selectedCard) {
      const updated = cards.find((c) => c.id === selectedCard.id);
      if (updated) {
        setSelectedCard(updated);
      }
    }
  }, [cards, selectedCard]);

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
      setAuthError('Ingresá un mail válido.');
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
        localCode: originHubCode || 'BURGER01',
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
    setWalletLoadingId(card.id);
    try {
      const immutableShortCode = card.shortCode || card.memberCode || 'K7M2-9XQ4';
      const passRes = await api.createWalletPass({
        cartelCode: card.localCode || 'BURGER01',
        memberId: card.id,
        memberCode: immutableShortCode,
        barcodeValue: immutableShortCode,
        customerName: card.name,
        stamps: card.stamps,
        stampsRequired: card.targetStamps || card.stampsRequired || 10,
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

      const targetUrl =
        passRes.shareUrl || passRes.appleWalletUrl || passRes.googleWalletUrl;
      if (!passRes.success || !targetUrl) {
        setWalletError('No pudimos crear tu tarjeta. Probá de nuevo.');
        return;
      }

      window.location.href = targetUrl;
    } catch {
      setWalletError('No pudimos crear tu tarjeta. Probá de nuevo.');
    } finally {
      setWalletLoadingId(null);
    }
  };

  const bgMain = isDark ? 'bg-[#09090B] text-[#F5F5F2]' : 'bg-[#F4F1EA] text-[#141413]';
  const surfaceCard = isDark
    ? 'bg-[#141416] border-[#242428] text-[#F5F5F2]'
    : 'bg-white border-[#E4DEC9] text-[#141413] shadow-sm';
  const mutedText = isDark ? 'text-[#9E9B95]' : 'text-[#6E6A63]';

  return (
    <div className={`min-h-screen ${bgMain} font-sans pb-24 transition-colors duration-300`}>
      {/* Barra superior compacta para móvil */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-xl border-b transition-colors ${
          isDark ? 'bg-[#09090B]/85 border-[#242428]' : 'bg-[#F4F1EA]/85 border-[#E4DEC9]'
        }`}
      >
        <div className="max-w-md mx-auto px-3.5 h-13 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {originHubCode ? (
              <Link
                to={`/u/${originHubCode}`}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  isDark
                    ? 'bg-[#141416] border-[#26262A] text-[#F5F5F2] hover:border-[#D95B26]'
                    : 'bg-white border-[#DDD6C7] text-[#141413] hover:border-[#D95B26]'
                }`}
              >
                <ArrowLeft size={13} />
                <span>Volver al local</span>
              </Link>
            ) : (
              <Link to="/" className="flex items-center gap-1.5">
                <BrandLogo variant="isotipo" size="sm" />
                <span className="font-bold text-xs tracking-tight">Toquecitos</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#141416] border-[#26262A] text-amber-400 hover:border-[#D95B26]'
                  : 'bg-white border-[#DDD6C7] text-[#141413] hover:border-[#D95B26]'
              }`}
              aria-label="Cambiar tema claro u oscuro"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthError(null);
                setAuthSuccess(null);
                setAuthStep('enter_email');
                setIsAccountModalOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors cursor-pointer ${
                account?.recognized
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : isDark
                  ? 'bg-[#141416] border-[#26262A] text-[#F5F5F2] hover:border-[#D95B26]'
                  : 'bg-white border-[#DDD6C7] text-[#141413] hover:border-[#D95B26]'
              }`}
            >
              <User size={12} />
              <span className="truncate max-w-[115px]">
                {account?.recognized
                  ? account.name || account.maskedEmail || 'Mi cuenta'
                  : 'Ingresá tu mail'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-3.5 pt-3.5 space-y-4">
        {/* 1. Cabecera compacta: Dinero ahorrado con Toque */}
        <section className={`rounded-2xl border p-3.5 ${surfaceCard}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className={`text-[11px] font-medium ${mutedText}`}>Ahorrado con Toque</span>
              <div className="text-2xl font-black tracking-tight mt-0.5 font-mono">
                ${totalSavedArs.toLocaleString('es-AR')}
              </div>
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
              <Gift size={12} />
              <span>
                {totalRedeemedCount}{' '}
                {totalRedeemedCount === 1 ? 'premio canjeado' : 'premios canjeados'}
              </span>
            </div>
          </div>
        </section>

        {/* 2. Tarjetero personal compacto */}
        <section aria-label="Tarjetero personal">
          <div className="relative rounded-3xl p-3.5 pt-4 pb-4 bg-gradient-to-b from-[#231F1D] via-[#181514] to-[#110F0E] border border-[#38312E] shadow-[0_14px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="pointer-events-none absolute inset-1.5 rounded-[20px] border border-dashed border-[#6E5D53]/40" />

            <div className="relative z-10 flex items-center justify-between px-1.5 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Wallet size={14} className="text-[#D95B26]" />
                <span className="text-xs font-semibold text-[#E6E1DA]">
                  Tarjetero personal
                </span>
              </div>
              <span className="text-[11px] font-medium text-[#A39B93]">
                {cards.length} {cards.length === 1 ? 'tarjeta activa' : 'tarjetas activas'}
              </span>
            </div>

            {cards.length === 0 ? (
              <div className="relative z-10 rounded-2xl bg-[#141210]/90 border border-[#2E2825] p-4 text-center space-y-2 my-1">
                <QrCode className="w-6 h-6 text-[#D95B26] mx-auto opacity-85" />
                <p className="text-xs font-bold text-white">
                  {account?.recognized
                    ? 'Todavía no sumaste tarjetas en ningún comercio'
                    : 'Ingresá con tu cuenta para ver tus tarjetas'}
                </p>
                <p className="text-[11px] text-[#9E9B95] leading-relaxed">
                  {account?.recognized
                    ? 'Cuando te anotes en el club de un local desde su QR de mostrador, tu tarjeta aparecerá acá.'
                    : 'Si ya te registraste en el QR de un comercio, ingresá tu mail para ver tus tarjetas y comprobantes unificados.'}
                </p>
                {!account?.recognized && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep('enter_email');
                      setIsAccountModalOpen(true);
                    }}
                    className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Mail size={12} />
                    <span>Ingresá tu mail</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="relative z-10 pt-0.5 pb-1.5 space-y-2">
                {cards.map((card, idx) => {
                  const bgHex = resolveCardBackground(card);
                  const target = card.targetStamps || card.stampsRequired || 10;
                  const currentStamps = card.stamps ?? 0;
                  const progressPct = Math.min(100, Math.round((currentStamps / target) * 100));
                  const shortCode = card.shortCode || card.memberCode || 'K7M2-9XQ4';

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setWalletError(null);
                        setWalletStatusMessage(null);
                        setSelectedCard(card);
                      }}
                      style={{
                        backgroundColor: bgHex,
                        transform: `translateY(${idx * -1}px)`,
                      }}
                      className="w-full text-left rounded-2xl p-3 border border-white/15 shadow-[0_6px_16px_rgba(0,0,0,0.35)] active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {card.logoUrl ? (
                            <img
                              src={card.logoUrl}
                              alt={card.businessName || 'Logo'}
                              className="w-7 h-7 rounded-lg object-cover border border-white/20 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {(card.businessName || 'T').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {card.businessName || 'Comercio adherido'}
                            </p>
                            <p className="text-[10px] font-mono text-white/80 truncate">
                              Código: {shortCode}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="block text-[9px] font-bold tracking-wider text-white/65">
                            SELLOS
                          </span>
                          <span className="font-mono text-sm font-black text-white">
                            {currentStamps} / {target}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 h-1.5 w-full rounded-full bg-black/30 overflow-hidden">
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

            <div className="relative z-10 mt-1.5 pt-2 border-t border-[#38312E]/80 flex items-center justify-between px-1.5">
              <span className="text-[10px] text-[#9E948C]">
                Tocá una tarjeta para ver tu código corto y QR
              </span>
              <div
                aria-hidden="true"
                className="w-4 h-4 rounded-full bg-gradient-to-br from-[#524944] to-[#26211E] border border-[#736760] flex items-center justify-center"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#181514]" />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Tres tarjetas selectoras horizontales compactas */}
        <section aria-label="Accesos rápidos" className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleSelectSection('cards')}
            className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSection === 'cards'
                ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-sm'
                : `${surfaceCard} hover:border-[#D95B26]/50`
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <CreditCard
                size={15}
                className={activeSection === 'cards' ? 'text-white' : 'text-[#D95B26]'}
              />
              <span className="font-mono text-[11px] font-bold">{cards.length}</span>
            </div>
            <p className="text-[11px] font-bold leading-tight">Mis tarjetas</p>
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
            className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSection === 'tickets'
                ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-sm'
                : `${surfaceCard} hover:border-[#D95B26]/50`
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <ReceiptIcon
                size={15}
                className={activeSection === 'tickets' ? 'text-white' : 'text-[#D95B26]'}
              />
              <span className="font-mono text-[11px] font-bold">{receipts.length}</span>
            </div>
            <p className="text-[11px] font-bold leading-tight">Tickets</p>
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
            className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSection === 'benefits'
                ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-sm'
                : `${surfaceCard} hover:border-[#D95B26]/50`
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Sparkles
                size={15}
                className={activeSection === 'benefits' ? 'text-white' : 'text-[#D95B26]'}
              />
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeSection === 'benefits'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#D95B26]/15 text-[#D95B26]'
                }`}
              >
                Pronto
              </span>
            </div>
            <p className="text-[11px] font-bold leading-tight">Beneficios</p>
            <p
              className={`text-[10px] mt-0.5 truncate ${
                activeSection === 'benefits' ? 'text-white/80' : mutedText
              }`}
            >
              Próximamente
            </p>
          </button>
        </section>

        {/* 4. Contenido dinámico según la sección elegida */}
        <div ref={sectionContentRef} className="pt-0.5">
          {activeSection === 'cards' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold">Detalle de tus tarjetas</h2>
                <span className={`text-[11px] ${mutedText}`}>
                  Tocá para abrir tu QR
                </span>
              </div>

              {cards.length === 0 ? (
                <div className={`rounded-2xl border p-4 text-center ${surfaceCard}`}>
                  <p className="text-xs font-medium">
                    {account?.recognized
                      ? 'Aún no sumaste sellos en ningún comercio.'
                      : 'Ingresá tu mail arriba para sincronizar tus tarjetas.'}
                  </p>
                </div>
              ) : (
                cards.map((card) => {
                  const target = card.targetStamps || card.stampsRequired || 10;
                  const currentStamps = card.stamps ?? 0;
                  const cooldown = getStrictCooldownState(card.lastStampedAt);
                  const readyToRedeem = currentStamps >= target;
                  const shortCode = card.shortCode || card.memberCode || 'K7M2-9XQ4';

                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        setWalletError(null);
                        setWalletStatusMessage(null);
                        setSelectedCard(card);
                      }}
                      className={`rounded-2xl border p-3.5 transition-colors cursor-pointer hover:border-[#D95B26]/50 ${surfaceCard}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold truncate">
                              {card.businessName || 'Comercio adherido'}
                            </h3>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#D95B26]/15 text-[#D95B26] shrink-0">
                              {shortCode}
                            </span>
                          </div>
                          <p className={`text-[11px] ${mutedText} mt-0.5 truncate`}>
                            Premio: {card.rewardText || 'Beneficio al completar tus sellos'}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono shrink-0 ${
                            readyToRedeem
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-[#D95B26]/15 text-[#D95B26]'
                          }`}
                        >
                          {currentStamps} / {target}
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 mt-3">
                        {Array.from({ length: Math.min(target, 10) }).map((_, i) => {
                          const filled = i < currentStamps;
                          return (
                            <div
                              key={i}
                              className={`h-7 rounded-lg flex items-center justify-center text-[11px] font-bold border transition-all ${
                                filled
                                  ? 'bg-[#D95B26] border-[#D95B26] text-white shadow-sm'
                                  : isDark
                                  ? 'bg-[#09090B] border-[#26262A] text-[#6E6A63]'
                                  : 'bg-[#F4F1EA] border-[#DDD6C7] text-[#8C867B]'
                              }`}
                            >
                              {filled ? <Check size={12} /> : i + 1}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-current/10 flex items-center justify-between text-[10px]">
                        <span className="inline-flex items-center gap-1 text-[#9E9B95]">
                          <Clock size={11} />
                          <span>{cooldown.label}</span>
                        </span>
                        <span className="font-semibold text-[#D95B26] inline-flex items-center gap-0.5">
                          <span>Ver QR</span>
                          <ArrowUpRight size={11} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SECCIÓN TICKETS */}
          {activeSection === 'tickets' && (
            <div className="space-y-3">
              {openedFullReceipt ? (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenedFullReceipt(null)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${surfaceCard}`}
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
                        isDark={isDark}
                        stamps={matchingCard?.stamps ?? 0}
                        stampsRequired={
                          matchingCard?.targetStamps ?? matchingCard?.stampsRequired ?? 10
                        }
                        cardTitle={
                          matchingCard?.businessName
                            ? `Tarjeta de ${matchingCard.businessName}`
                            : `Tarjeta de ${openedFullReceipt.merchantName}`
                        }
                        rewardText={
                          matchingCard?.rewardText || 'Beneficio al completar tus sellos'
                        }
                        customColor={
                          matchingCard ? resolveCardBackground(matchingCard) : '#141418'
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
                      <h2 className="text-xs font-bold">Tus tickets</h2>
                      <p className={`text-[11px] ${mutedText}`}>
                        Tocá un ticket para abrir y descargar el comprobante completo
                      </p>
                    </div>
                  </div>

                  {receipts.length === 0 ? (
                    <div className={`rounded-2xl border p-5 text-center space-y-1.5 ${surfaceCard}`}>
                      <Ticket className="w-7 h-7 text-[#D95B26] mx-auto opacity-80" />
                      <p className="text-xs font-bold">Aún no tenés tickets guardados</p>
                      <p className={`text-[11px] ${mutedText}`}>
                        Cuando escanees el QR del mostrador tras una compra, tu comprobante queda guardado en tu cuenta.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {receipts.map((r) => {
                        const amountVal = r.total ?? r.amountArs ?? 0;
                        const dateFormatted = (() => {
                          const d = new Date(r.createdAt);
                          if (Number.isNaN(d.getTime())) return r.createdAt;
                          return d.toLocaleString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                        })();

                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setOpenedFullReceipt(r)}
                            className={`w-full text-left rounded-2xl border p-3.5 flex items-center justify-between gap-2.5 transition-colors hover:border-[#D95B26] cursor-pointer ${surfaceCard}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-[#D95B26]/15 text-[#D95B26] flex items-center justify-center shrink-0">
                                <ReceiptIcon size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{r.merchantName}</p>
                                <p className={`text-[11px] ${mutedText} mt-0.5`}>{dateFormatted}</p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="block text-sm font-extrabold font-mono tabular-nums">
                                ${amountVal.toLocaleString('es-AR')}
                              </span>
                              <span className="text-[10px] font-semibold text-[#D95B26] inline-flex items-center gap-0.5">
                                <span>Ver ticket</span>
                                <ArrowUpRight size={11} />
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* SECCIÓN BENEFICIOS: PRÓXIMAMENTE (Requerimiento 1) */}
          {activeSection === 'benefits' && (
            <div className="space-y-3">
              <div className={`rounded-2xl border p-5 text-center space-y-2.5 ${surfaceCard}`}>
                <div className="w-10 h-10 rounded-2xl bg-[#D95B26]/15 border border-[#D95B26]/30 text-[#D95B26] flex items-center justify-center mx-auto">
                  <Sparkles size={18} />
                </div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#D95B26]/15 text-[#D95B26] text-[10px] font-bold">
                  Próximamente
                </span>
                <h2 className="text-sm font-bold">
                  Beneficios y regalos con tus tarjetas
                </h2>
                <p className={`text-xs ${mutedText} leading-relaxed max-w-xs mx-auto`}>
                  Muy pronto vas a encontrar acá todos los locales adheridos que ofrecen beneficios exclusivos, descuentos y cosas gratis con tus tarjetas Toque.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'profile' && (
            <div className={`rounded-2xl border p-4 space-y-3.5 ${surfaceCard}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold">Tu cuenta unificada</h2>
                  <p className={`text-[11px] ${mutedText}`}>
                    Tus tarjetas y comprobantes sincronizados entre el QR del local y Toquecitos.
                  </p>
                </div>
                <ShieldCheck className="w-5 h-5 text-[#D95B26] shrink-0" />
              </div>

              {account?.recognized ? (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-emerald-400">Cuenta activa</p>
                      <p className="text-xs font-semibold truncate mt-0.5">
                        {account.name ? `${account.name} · ` : ''}
                        {account.email || account.maskedEmail}
                      </p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep('enter_email');
                      setIsAccountModalOpen(true);
                    }}
                    className="w-full py-2 rounded-xl border border-[#D95B26]/40 text-[#D95B26] text-xs font-semibold hover:bg-[#D95B26]/10 transition-colors cursor-pointer"
                  >
                    Cambiar mail
                  </button>
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
                  Ingresá tu mail
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Barra de navegación inferior flotante compacta */}
      <nav
        aria-label="Navegación de Toquecitos"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-sm rounded-full bg-[#141416]/95 border border-[#28282E] backdrop-blur-xl p-1 shadow-[0_12px_32px_rgba(0,0,0,0.6)] grid grid-cols-4 gap-1"
      >
        <button
          type="button"
          onClick={() => handleSelectSection('cards')}
          className={`py-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeSection === 'cards' ? 'bg-[#D95B26] text-white' : 'text-[#9E9B95] hover:text-white'
          }`}
        >
          <CreditCard size={14} />
          <span>Tarjetas</span>
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

        <button
          type="button"
          onClick={() => handleSelectSection('profile')}
          className={`py-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeSection === 'profile'
              ? 'bg-[#D95B26] text-white'
              : 'text-[#9E9B95] hover:text-white'
          }`}
        >
          <User size={14} />
          <span>Cuenta</span>
        </button>
      </nav>

      {/* Modal de Tarjeta del Cliente compacto (sin botón "Dar de baja esta tarjeta") */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto"
          onClick={() => setSelectedCard(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl bg-[#141416] border border-[#26262A] p-3.5 space-y-3 shadow-2xl my-auto"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#F5F5F2] truncate">
                Tarjeta de {selectedCard.businessName || 'Comercio'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCard(null)}
                className="w-7 h-7 rounded-full bg-[#1F1F23] flex items-center justify-center text-[#9E9B95] hover:text-white cursor-pointer"
                aria-label="Cerrar tarjeta"
              >
                <X size={14} />
              </button>
            </div>

            <WalletPassCard
              businessName={selectedCard.businessName || 'Comercio'}
              memberName={selectedCard.name || 'Socio'}
              stamps={selectedCard.stamps}
              stampsRequired={selectedCard.targetStamps || selectedCard.stampsRequired || 10}
              rewardText={selectedCard.rewardText || 'Beneficio al completar tus sellos'}
              barcodeToken={selectedCard.shortCode || selectedCard.memberCode || 'K7M2-9XQ4'}
              shortCode={selectedCard.shortCode || selectedCard.memberCode || 'K7M2-9XQ4'}
              colorPreset={selectedCard.colorPreset || 'dark'}
              customColor={selectedCard.customColor}
              logoUrl={selectedCard.logoUrl}
              compact
            />

            <div className="space-y-2">
              <button
                type="button"
                disabled={walletLoadingId === selectedCard.id || walletUnconfigured}
                onClick={() => handleAddToWallet(selectedCard)}
                className="w-full py-2.5 px-3.5 rounded-xl bg-[#D95B26] hover:bg-[#e06530] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Wallet size={14} />
                <span>
                  {walletUnconfigured
                    ? 'Pronto vas a poder guardarla en tu billetera'
                    : walletLoadingId === selectedCard.id
                    ? 'Creando tu tarjeta...'
                    : 'Agregar a mi billetera'}
                </span>
              </button>

              {walletStatusMessage && (
                <p className="text-[11px] text-center text-[#9E9B95]">{walletStatusMessage}</p>
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

      {/* Modal de Cuenta Única y Reconocimiento compacto */}
      {isAccountModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setIsAccountModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl bg-[#141416] border border-[#26262A] p-4 text-[#F5F5F2] space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D95B26]" />
                <h3 className="text-sm font-bold">
                  {authStep === 'register_new' ? 'Creá tu cuenta' : 'Ingresá tu mail'}
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
                  Si ya te registraste en un comercio o en Toquecitos, entrás directo con tu mail y ves todo unificado.
                </p>
                <div>
                  <label className="block text-[11px] font-medium text-[#9E9B95] mb-1">
                    Mail
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="tu@mail.com"
                    className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#26262A] text-xs text-white focus:outline-none focus:border-[#D95B26]"
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
                    className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#26262A] text-center font-mono text-base tracking-widest text-white focus:outline-none focus:border-[#D95B26]"
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
                  Cambiar mail
                </button>
              </form>
            )}

            {authStep === 'register_new' && (
              <form onSubmit={handleCompleteNewRegistration} className="space-y-2.5">
                <p className="text-[11px] text-[#9E9B95]">
                  Este mail todavía no tiene cuenta en Toque. Completá tus datos una sola vez.
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
                    className="w-full px-3 py-2 rounded-xl bg-[#09090B] border border-[#26262A] text-xs text-white focus:outline-none focus:border-[#D95B26]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#9E9B95] mb-1">
                    Fecha de nacimiento
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-[#9E9B95] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().split('T')[0]}
                      value={birthDateInput}
                      onChange={(e) => setBirthDateInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#09090B] border border-[#26262A] text-xs text-white focus:outline-none focus:border-[#D95B26]"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-[#9E9B95] cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={marketingConsentInput}
                    onChange={(e) => setMarketingConsentInput(e.target.checked)}
                    className="rounded border-[#26262A] bg-[#09090B] text-[#D95B26]"
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
