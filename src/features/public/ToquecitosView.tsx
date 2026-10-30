import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  api,
  ClubMember,
  ConsumerReceipt,
  NetworkActivation,
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
  Trash2,
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
    label: `Próximo sello disponible en ${hours} h ${minutes} min`,
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
  // Cuando el usuario toca un ticket de la lista resumida, se abre el comprobante COMPLETO sin paso intermedio
  const [openedFullReceipt, setOpenedFullReceipt] = useState<ConsumerReceipt | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  const [account, setAccount] = useState<RecognizedClientAccount | null>(null);
  const [receipts, setReceipts] = useState<ConsumerReceipt[]>([]);
  const [crossBenefits, setCrossBenefits] = useState<NetworkActivation[]>([]);

  // Flujo de Cuenta Única y Reconocimiento en el modal de ingreso:
  // Paso 1: "Ingresá tu mail" -> código de 6 dígitos
  // Paso 2: Si ya tenía cuenta, entra directo SIN pasar por el registro.
  //         El registro solo aparece si ese mail no tiene cuenta.
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

  // Botón "Agregar a mi billetera"
  const [walletLoadingId, setWalletLoadingId] = useState<string | null>(null);
  const [walletUnconfigured, setWalletUnconfigured] = useState(false);
  const [walletStatusMessage, setWalletStatusMessage] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [revokingCardId, setRevokingCardId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const sectionContentRef = useRef<HTMLDivElement>(null);

  const refreshData = async (targetEmail?: string) => {
    try {
      const [recAcc, benefits, defaultRcp] = await Promise.all([
        api.recognizeAccount(targetEmail || emailInput || undefined),
        api.getPublicCrossBenefits(),
        api.getReceiptById('rcp-burger-1001').catch(() => null),
      ]);

      if (recAcc.recognized) {
        setAccount(recAcc);
        if (recAcc.email && !emailInput) setEmailInput(recAcc.email);
      } else {
        // Cargar también socios desde api.listMembers() en modo demostración si aún no inició sesión
        const mems = await api.listMembers().catch(() => []);
        if (mems.length > 0) {
          setAccount({
            recognized: false,
            accountExists: false,
            cards: mems.slice(0, 2),
          });
        } else {
          setAccount(null);
        }
      }

      setCrossBenefits(benefits);

      // Cargar tickets desde api (incluyendo el comprobante pre-cargado de La Burger y ventas pagadas)
      const salesList = await api.listSales().catch(() => []);
      const builtReceipts: ConsumerReceipt[] = [];
      if (defaultRcp) {
        builtReceipts.push({
          id: defaultRcp.id,
          consumerId: 'consumer-01',
          tenantId: defaultRcp.businessId,
          businessId: defaultRcp.businessId,
          merchantName: defaultRcp.businessName,
          cartelCode: defaultRcp.cartelCode,
          amountArs: defaultRcp.total,
          total: defaultRcp.total,
          currency: 'ARS',
          items: defaultRcp.items || [],
          method: defaultRcp.method,
          discountSavedArs: 0,
          category: 'Gastronomía',
          receiptNote: '',
          createdAt: defaultRcp.createdAt,
        });
      }
      for (const s of salesList) {
        if (s.status === 'paid' && !builtReceipts.some((r) => r.id === (s.receiptId || s.id))) {
          builtReceipts.push({
            id: s.receiptId || s.id,
            consumerId: 'consumer-01',
            tenantId: s.businessId,
            businessId: s.businessId,
            merchantName: 'La Burger',
            cartelCode: s.cartelCode,
            amountArs: s.amount,
            total: s.amount,
            currency: 'ARS',
            items: s.items || [],
            method: s.method,
            discountSavedArs: 0,
            category: 'Gastronomía',
            receiptNote: '',
            createdAt: s.createdAt,
          });
        }
      }
      setReceipts(builtReceipts);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const cards: ClubMember[] = useMemo(() => {
    return account?.cards || [];
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
      const unitValue = c.rewardValueArs && c.rewardValueArs > 0 ? c.rewardValueArs : 8500;
      saved += count * unitValue;
    }
    return { totalSavedArs: saved, totalRedeemedCount: redeemed };
  }, [cards]);

  const handleSelectSection = (sec: ActiveSection) => {
    setActiveSection(sec);
    setOpenedFullReceipt(null);
    setTimeout(() => {
      sectionContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  // Paso 1: "Ingresá tu mail" -> enviar código de 6 dígitos
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

  // Paso 2: Verificar código de 6 dígitos. Si ya tenía cuenta, entra directo SIN pasar por el registro.
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
        // Ya tenía cuenta -> entra directo SIN pasar por el registro
        setAccount(rec);
        setOtpCode('');
        setDemoHintCode(null);
        setAuthStep('enter_email');
        setIsAccountModalOpen(false);
        await refreshData(cleanEmail);
      } else {
        // Ese mail no tiene cuenta -> aparece el formulario de registro
        setAuthSuccess(null);
        setAuthStep('register_new');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Código incorrecto o vencido.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Paso 3 (solo si ese mail no tenía cuenta): Registro con nombre, mail y fecha de nacimiento (>= 18)
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

  // Botón "Agregar a mi billetera": pide al servidor crear la tarjeta, recibe una dirección y la abre.
  // Sin generar ni descargar imagen de reemplazo.
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

  const handleRevokeCard = async (memberId: string) => {
    setRevokingCardId(memberId);
    try {
      await api.revokeMemberCard(memberId, 'Baja solicitada por el cliente');
      setConfirmRevokeId(null);
      setSelectedCard(null);
      await refreshData();
    } catch (err: any) {
      setWalletError(err?.message || 'No se pudo dar de baja la tarjeta.');
    } finally {
      setRevokingCardId(null);
    }
  };

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
                <span>Volver al local</span>
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
              onClick={() => {
                setAuthError(null);
                setAuthSuccess(null);
                setAuthStep('enter_email');
                setIsAccountModalOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
                account?.recognized
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : isDark
                  ? 'bg-[#141416] border-[#26262A] text-[#F5F5F2] hover:border-[#D95B26]'
                  : 'bg-white border-[#DDD6C7] text-[#141413] hover:border-[#D95B26]'
              }`}
            >
              <User size={13} />
              <span className="truncate max-w-[120px]">
                {account?.recognized
                  ? account.name || account.maskedEmail || 'Mi cuenta'
                  : 'Ingresá tu mail'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-5 space-y-6">
        {/* 1. Cabecera: Dinero ahorrado con Toque */}
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

        {/* 2. Tarjetero en cuero */}
        <section aria-label="Tarjetero en cuero">
          <div className="relative rounded-[30px] p-4 pt-5 pb-6 bg-gradient-to-b from-[#231F1D] via-[#181514] to-[#110F0E] border border-[#38312E] shadow-[0_22px_45px_rgba(0,0,0,0.55)] overflow-hidden">
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

            {cards.length === 0 ? (
              <div className="relative z-10 rounded-2xl bg-[#141210]/90 border border-[#2E2825] p-6 text-center space-y-2.5 my-2">
                <QrCode className="w-8 h-8 text-[#D95B26] mx-auto opacity-85" />
                <p className="text-sm font-bold text-white">
                  Todavía no tenés tarjetas en tu tarjetero
                </p>
                <p className="text-xs text-[#9E9B95] leading-relaxed">
                  Ingresá tu mail para recuperar tus tarjetas o escaneá el cartel en el mostrador de un comercio adherido.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep('enter_email');
                    setIsAccountModalOpen(true);
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Mail size={13} />
                  <span>Ingresá tu mail</span>
                </button>
              </div>
            ) : (
              <div className="relative z-10 pt-1 pb-2 space-y-2.5">
                {cards.map((card, idx) => {
                  const bgHex = resolveCardBackground(card);
                  const target = card.targetStamps || card.stampsRequired || 10;
                  const progressPct = Math.min(
                    100,
                    Math.round(((card.stamps || 0) / target) * 100)
                  );
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
                            <p className="text-[11px] font-mono text-white/80 truncate">
                              Código: {shortCode}
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

            <div className="relative z-10 mt-2 pt-3 border-t border-[#38312E]/80 flex items-center justify-between px-2">
              <span className="text-[11px] text-[#9E948C]">
                Tocá una tarjeta para ver tu código corto y QR
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

        {/* 3. Tres tarjetas selectoras horizontales */}
        <section aria-label="Accesos rápidos" className="grid grid-cols-3 gap-2.5">
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
                  const shortCode = card.shortCode || card.memberCode || 'K7M2-9XQ4';

                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        setWalletError(null);
                        setWalletStatusMessage(null);
                        setSelectedCard(card);
                      }}
                      className={`rounded-2xl border p-4 transition-colors cursor-pointer hover:border-[#D95B26]/50 ${surfaceCard}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold">
                              {card.businessName || 'Comercio adherido'}
                            </h3>
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#D95B26]/15 text-[#D95B26]">
                              {shortCode}
                            </span>
                          </div>
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
                          <span>Ver código y QR</span>
                          <ArrowUpRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SECCIÓN TICKETS (Item 5: En la lista de Tickets, cada ticket es una tarjeta resumida (comercio, monto, fecha). Al tocarlo abre el comprobante COMPLETO, sin paso intermedio) */}
          {activeSection === 'tickets' && (
            <div className="space-y-4">
              {openedFullReceipt ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setOpenedFullReceipt(null)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${surfaceCard}`}
                  >
                    <ArrowLeft size={14} />
                    <span>Volver a la lista de tickets</span>
                  </button>

                  <DieCutTicket
                    receiptId={openedFullReceipt.id}
                    businessName={openedFullReceipt.merchantName}
                    businessAddress="Av. Cabildo 2040, Belgrano"
                    total={openedFullReceipt.total ?? openedFullReceipt.amountArs ?? 0}
                    createdAt={openedFullReceipt.createdAt}
                    items={openedFullReceipt.items}
                    method={openedFullReceipt.method}
                    isDark={isDark}
                    stamps={
                      cards.find(
                        (c) =>
                          c.businessId ===
                          (openedFullReceipt.businessId || openedFullReceipt.tenantId)
                      )?.stamps ?? 4
                    }
                    stampsRequired={
                      cards.find(
                        (c) =>
                          c.businessId ===
                          (openedFullReceipt.businessId || openedFullReceipt.tenantId)
                      )?.targetStamps ?? 5
                    }
                    onViewPass={() => {
                      const matchingCard =
                        cards.find(
                          (c) =>
                            c.businessId ===
                            (openedFullReceipt.businessId || openedFullReceipt.tenantId)
                        ) || cards[0];
                      if (matchingCard) {
                        setSelectedCard(matchingCard);
                      } else {
                        handleSelectSection('cards');
                      }
                    }}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-sm font-bold">Tus tickets</h2>
                      <p className={`text-xs ${mutedText}`}>
                        Tocá un ticket para abrir el comprobante completo
                      </p>
                    </div>
                  </div>

                  {receipts.length === 0 ? (
                    <div className={`rounded-2xl border p-6 text-center space-y-2 ${surfaceCard}`}>
                      <Ticket className="w-8 h-8 text-[#D95B26] mx-auto opacity-80" />
                      <p className="text-sm font-bold">Aún no tenés tickets guardados</p>
                      <p className={`text-xs ${mutedText}`}>
                        Cuando el comercio emita tu comprobante en caja, va a aparecer acá.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {receipts.map((r) => {
                        const amountVal = r.total ?? r.amountArs ?? 0;
                        const dateFormatted = (() => {
                          const d = new Date(r.createdAt);
                          if (Number.isNaN(d.getTime())) return r.createdAt;
                          return d.toLocaleString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                        })();

                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setOpenedFullReceipt(r)}
                            className={`w-full text-left rounded-2xl border p-4 flex items-center justify-between gap-3 transition-colors hover:border-[#D95B26] cursor-pointer ${surfaceCard}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-[#D95B26]/15 text-[#D95B26] flex items-center justify-center shrink-0">
                                <ReceiptIcon size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{r.merchantName}</p>
                                <p className={`text-xs ${mutedText} mt-0.5`}>{dateFormatted}</p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="block text-base font-extrabold font-mono tabular-nums">
                                ${amountVal.toLocaleString('es-AR')}
                              </span>
                              <span className="text-[11px] font-semibold text-[#D95B26] inline-flex items-center gap-0.5">
                                <span>Ver comprobante</span>
                                <ArrowUpRight size={12} />
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
                  <p className="text-sm font-bold">
                    Seguí sumando sellos en tus comercios favoritos
                  </p>
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
                  <h2 className="text-base font-bold">Tu cuenta</h2>
                  <p className={`text-xs ${mutedText}`}>
                    Ingresá tu mail para acceder a tus tarjetas y comprobantes desde cualquier celular.
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
                    onClick={() => {
                      setAuthStep('enter_email');
                      setIsAccountModalOpen(true);
                    }}
                    className="w-full py-2.5 rounded-xl border border-[#D95B26]/40 text-[#D95B26] text-xs font-semibold hover:bg-[#D95B26]/10 transition-colors cursor-pointer"
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
                  className="w-full py-3 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Ingresá tu mail
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Barra de navegación inferior flotante */}
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

      {/* Modal de Tarjeta del Cliente (Item 2: código corto grande + QR inmutable + botón "Agregar a mi billetera") */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => {
            setSelectedCard(null);
            setConfirmRevokeId(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[32px] bg-[#141416] border border-[#26262A] p-4 space-y-4 shadow-2xl my-auto"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#F5F5F2]">
                Tarjeta de {selectedCard.businessName || 'Comercio'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCard(null);
                  setConfirmRevokeId(null);
                }}
                className="w-8 h-8 rounded-full bg-[#1F1F23] flex items-center justify-center text-[#9E9B95] hover:text-white cursor-pointer"
                aria-label="Cerrar tarjeta"
              >
                <X size={16} />
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
            />

            <div className="space-y-2">
              <button
                type="button"
                disabled={walletLoadingId === selectedCard.id || walletUnconfigured}
                onClick={() => handleAddToWallet(selectedCard)}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#D95B26] hover:bg-[#e06530] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Wallet size={15} />
                <span>
                  {walletUnconfigured
                    ? 'Pronto vas a poder guardarla en tu billetera'
                    : walletLoadingId === selectedCard.id
                    ? 'Creando tu tarjeta...'
                    : 'Agregar a mi billetera'}
                </span>
              </button>

              {walletStatusMessage && (
                <p className="text-xs text-center text-[#9E9B95]">{walletStatusMessage}</p>
              )}

              {walletError && (
                <p role="alert" className="text-xs text-center text-red-400">
                  {walletError}
                </p>
              )}

              {selectedCard.localCode && (
                <Link
                  to={`/u/${selectedCard.localCode}`}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Store size={14} />
                  <span>Abrir local {selectedCard.businessName}</span>
                </Link>
              )}

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
      )}

      {/* Modal de Cuenta Única y Reconocimiento (Items 3 y 4) */}
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
                <h3 className="text-base font-bold">
                  {authStep === 'register_new' ? 'Creá tu cuenta' : 'Ingresá tu mail'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#1F1F23] flex items-center justify-center text-[#9E9B95] hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

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

            {/* Paso 1: Pantalla "Ingresá tu mail" */}
            {authStep === 'enter_email' && (
              <form onSubmit={handleSendLoginOtp} className="space-y-3">
                <p className="text-xs text-[#9E9B95] leading-relaxed">
                  Te enviamos un código de 6 dígitos. Si ya tenés cuenta, entrás directo sin registrarte de nuevo.
                </p>
                <div>
                  <label className="block text-xs font-medium text-[#9E9B95] mb-1">
                    Mail
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="tu@mail.com"
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
            )}

            {/* Paso 2: Código de 6 dígitos */}
            {authStep === 'enter_otp' && (
              <form onSubmit={handleVerifyLoginOtp} className="space-y-3">
                {demoHintCode && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center">
                    Código de verificación: <strong className="font-mono">{demoHintCode}</strong>
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
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#26262A] text-center font-mono text-lg tracking-widest text-white focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading || otpCode.length !== 6}
                  className="w-full py-3 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {authLoading ? 'Verificando...' : 'Continuar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep('enter_email');
                    setOtpCode('');
                  }}
                  className="w-full py-2 text-xs text-[#9E9B95] hover:text-white cursor-pointer"
                >
                  Cambiar mail
                </button>
              </form>
            )}

            {/* Paso 3: Solo aparece si ese mail NO tiene cuenta */}
            {authStep === 'register_new' && (
              <form onSubmit={handleCompleteNewRegistration} className="space-y-3">
                <p className="text-xs text-[#9E9B95]">
                  Este mail todavía no tiene cuenta en Toque. Completá tus datos para crearla.
                </p>
                <div>
                  <label className="block text-xs font-medium text-[#9E9B95] mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#26262A] text-sm text-white focus:outline-none focus:border-[#D95B26]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#9E9B95] mb-1">
                    Fecha de nacimiento
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[#9E9B95] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().split('T')[0]}
                      value={birthDateInput}
                      onChange={(e) => setBirthDateInput(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#09090B] border border-[#26262A] text-sm text-white focus:outline-none focus:border-[#D95B26]"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-[#9E9B95] cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={marketingConsentInput}
                    onChange={(e) => setMarketingConsentInput(e.target.checked)}
                    className="rounded border-[#26262A] bg-[#09090B] text-[#D95B26]"
                  />
                  <span>Quiero recibir avisos y beneficios de La Burger</span>
                </label>

                <div className="pt-1 space-y-1.5">
                  <p className="text-[11px] text-[#9E9B95] leading-snug text-center">
                    Al continuar, aceptás los{' '}
                    <Link to="/terminos" className="text-white underline">
                      Términos
                    </Link>{' '}
                    y la{' '}
                    <Link to="/privacidad" className="text-white underline">
                      Política de privacidad
                    </Link>{' '}
                    de Toque.
                  </p>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {authLoading ? 'Creando cuenta...' : 'Crear mi tarjeta'}
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
