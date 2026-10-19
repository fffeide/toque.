import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  api,
  PublicHub,
  Receipt,
  ClubMember,
  WalletPassResponse,
  HubBlockKey,
} from '../../api';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency } from '../../lib/formatters';
import {
  loadConsumerVault,
  recordHubVisitLocally,
  saveConsumerRegistration,
} from '../../lib/consumerStorage';
import {
  Star,
  Receipt as ReceiptIcon,
  Award,
  MapPin,
  Clock,
  Phone,
  Globe,
  ShoppingBag,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Wallet,
  BookmarkCheck,
} from 'lucide-react';

function buildWhatsAppWaMeLink(rawPhone?: string): string {
  if (!rawPhone) return '';
  const trimmed = rawPhone.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

function normalizeSocialUrl(raw?: string, platform?: 'instagram' | 'tiktok'): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanHandle = trimmed.replace(/^@/, '');
  if (platform === 'instagram') {
    return `https://instagram.com/${cleanHandle}`;
  }
  if (platform === 'tiktok') {
    return `https://tiktok.com/@${cleanHandle}`;
  }
  return `https://${trimmed}`;
}

const InstagramLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const TikTokLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const WhatsAppLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
  </svg>
);

export const PublicHubView: React.FC = () => {
  const { code = 'CAJA01' } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const receiptIdParam = searchParams.get('r');
  const { showToast } = useToast();

  const [hub, setHub] = useState<PublicHub | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);
  const [receiptSecondsLeft, setReceiptSecondsLeft] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado para unirse al Club y generar Pase Apple/Google Wallet
  const [contact, setContact] = useState('');
  const [memberName, setMemberName] = useState('');
  const [consent, setConsent] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joinedMember, setJoinedMember] = useState<ClubMember | null>(null);
  const [walletPass, setWalletPass] = useState<WalletPassResponse | null>(null);
  const [isGeneratingPass, setIsGeneratingPass] = useState(false);

  // Estado de guardado de tarjeta y comprobante
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [vaultContact, setVaultContact] = useState('');
  const [consentSaveReceipts, setConsentSaveReceipts] = useState(true);
  const [consentMarketingNetwork, setConsentMarketingNetwork] = useState(true);
  const [isSyncingVault, setIsSyncingVault] = useState(false);
  const [isRegisteredConsumer, setIsRegisteredConsumer] = useState(false);

  useEffect(() => {
    const cleanCode = code.toUpperCase();
    setIsLoading(true);
    setErrorMsg(null);

    const localVault = loadConsumerVault();
    if (localVault.user?.emailOrPhone) {
      setIsRegisteredConsumer(true);
      setVaultName(localVault.user.displayName || '');
      setVaultContact(localVault.user.emailOrPhone || '');
    }

    const loadInitial = async () => {
      try {
        const data = await api.getPublicHub(cleanCode);
        setHub(data);
        api.recordHubEvent(cleanCode, 'scan');

        let resolvedReceipt: Receipt | null = null;
        if (receiptIdParam) {
          const r = await api.getReceiptById(receiptIdParam);
          if (r && r.status === 'ready' && new Date(r.expiresAt).getTime() > Date.now()) {
            resolvedReceipt = r;
          }
        } else if (data.activeReceipt || data.receipt) {
          const r = data.activeReceipt || data.receipt || null;
          if (r && r.status === 'ready' && new Date(r.expiresAt).getTime() > Date.now()) {
            resolvedReceipt = r;
          }
        }
        setActiveReceipt(resolvedReceipt);

        recordHubVisitLocally({
          tenantId: data.business.id,
          merchantName: data.business.name,
          cartelCode: data.cartel.code,
          amountArs: resolvedReceipt?.total || 0,
          discountSavedArs: resolvedReceipt ? Math.round(resolvedReceipt.total * 0.1) : 0,
          category: 'Gastronomía & Café',
          receiptNote: resolvedReceipt
            ? `Ticket #${resolvedReceipt.id} (${resolvedReceipt.items.map((i) => i.name).join(', ')})`
            : `Visita en mostrador (${data.cartel.name})`,
          receiptId: resolvedReceipt?.id,
        });
      } catch (err: any) {
        setErrorMsg(err.message || 'No pudimos encontrar este cartel.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitial();

    const unsubscribe = api.subscribeToCartelHub(cleanCode, (liveHub) => {
      setHub(liveHub);
      if (!receiptIdParam) {
        const candidate = liveHub.activeReceipt || liveHub.receipt || null;
        if (
          candidate &&
          candidate.status === 'ready' &&
          new Date(candidate.expiresAt).getTime() > Date.now()
        ) {
          setActiveReceipt(candidate);
        } else {
          setActiveReceipt(null);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [code, receiptIdParam]);

  // Contador estricto de 2 minutos para el comprobante activo en el Hub
  useEffect(() => {
    if (!activeReceipt) {
      setReceiptSecondsLeft(0);
      return;
    }

    const updateTimer = () => {
      const expiresMs = new Date(activeReceipt.expiresAt).getTime();
      const diffSec = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setReceiptSecondsLeft(diffSec);
      if (diffSec <= 0 || activeReceipt.status !== 'ready') {
        setActiveReceipt(null);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeReceipt]);

  const handleReviewClick = () => {
    if (!hub) return;
    api.recordHubEvent(hub.cartel.code, 'review_click');
  };

  const handleJoinClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hub) return;
    if (!contact.trim()) {
      showToast('Ingresá tu WhatsApp o Email', 'error');
      return;
    }
    if (!consent) {
      showToast('Aceptá los términos para sumarte al Club', 'error');
      return;
    }

    setIsJoining(true);
    try {
      const res = await api.joinClub({
        cartelCode: hub.cartel.code,
        contact: contact.trim(),
        name: memberName.trim() || undefined,
        consent,
      });
      setJoinedMember(res.member);
      if (res.walletPass) {
        setWalletPass(res.walletPass);
      }
      showToast(`¡Sumaste +${res.pointsAwarded} sello en el Club!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al sumarte al club', 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const handleGenerateExtraPass = async () => {
    if (!hub || !joinedMember) return;
    setIsGeneratingPass(true);
    try {
      const pass = await api.createWalletPass({
        cartelCode: hub.cartel.code,
        memberId: joinedMember.id,
        customerName: joinedMember.name || joinedMember.contact,
        customerContact: joinedMember.contact,
        stamps: joinedMember.points,
      });
      setWalletPass(pass);
      showToast('Pase digital actualizado', 'success');
    } catch (err: any) {
      showToast(err.message || 'No se pudo generar el pase digital', 'error');
    } finally {
      setIsGeneratingPass(false);
    }
  };

  const handleSyncConsumerVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultContact.trim() || vaultContact.trim().length < 5) {
      showToast('Ingresá tu WhatsApp o Email para guardar tus comprobantes', 'error');
      return;
    }

    setIsSyncingVault(true);
    try {
      const updatedVault = saveConsumerRegistration({
        displayName: vaultName.trim() || 'Cliente Toque',
        emailOrPhone: vaultContact.trim(),
        ageGroup: 'all',
        consentSaveReceipts,
        consentMarketingNetwork,
      });

      if (updatedVault.user) {
        await api.syncConsumerVault({
          user: updatedVault.user,
          receipts: updatedVault.receipts,
        });
      }

      setIsRegisteredConsumer(true);
      setShowVaultModal(false);
      showToast('¡Tarjeta y comprobantes guardados!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Guardado en este dispositivo', 'info');
      setIsRegisteredConsumer(true);
      setShowVaultModal(false);
    } finally {
      setIsSyncingVault(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f1f1ee] flex flex-col items-center p-5">
        <div className="w-full max-w-md bg-[#ffffff] rounded-[32px] p-6 border border-black/10 space-y-4 mt-4 shadow-xl">
          <Skeleton className="h-16 w-full rounded-2xl bg-black/5" />
          <Skeleton className="h-36 w-full rounded-2xl bg-black/5" />
          <Skeleton className="h-28 w-full rounded-2xl bg-black/5" />
        </div>
      </div>
    );
  }

  if (errorMsg || !hub) {
    return (
      <div className="min-h-screen bg-[#f1f1ee] text-[#0c0c0c] flex items-center justify-center p-5">
        <div className="max-w-md w-full rounded-[32px] bg-[#ffffff] border border-black/15 p-7 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-[#0c0c0c] text-[#bec8ff] flex items-center justify-center mx-auto">
            <Smartphone className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-[#0c0c0c]">Cartel no disponible</h1>
          <p className="text-sm text-[#52525b]">
            {errorMsg || 'Verificá el código del cartel o activalo desde tu panel.'}
          </p>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              to={`/activar/${code.toUpperCase()}`}
              className="w-full py-3 px-5 rounded-full bg-[#0c0c0c] text-[#f1f1ee] font-semibold text-sm flex items-center justify-center"
            >
              Activar este cartel
            </Link>
            <Link
              to="/"
              className="w-full py-2.5 px-5 rounded-full bg-[#f6f6f3] text-[#0c0c0c] font-medium text-xs flex items-center justify-center border border-black/10"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { business, cartel, config, club } = hub;
  const isPlanPaid = Boolean(config?.planPaid);
  const rawBlocks = config?.blocks || [];
  const otherEnabledBlocks: HubBlockKey[] = isPlanPaid
    ? rawBlocks.filter((b) => b.key !== 'receipt' && b.enabled).map((b) => b.key)
    : [];

  const targetReward =
    club?.config.welcomeBenefitText ||
    club?.config.rewards?.[0]?.label ||
    'Café a elección de regalo';
  const targetStamps = club?.config.rewards?.[0]?.target || 5;
  const currentStamps = joinedMember?.points || 1;
  const featuredProducts = (config?.products || []).filter((p) => p.featuredInHub !== false);

  const renderOrderedBlock = (blockKey: HubBlockKey) => {
    switch (blockKey) {
      case 'review':
        return (
          <section key="review">
            <a
              href={config?.googleReviewUrl || hub.reviewUrl || 'https://maps.google.com'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleReviewClick}
              className="block group"
            >
              <div className="p-4 rounded-[24px] bg-[#0c0c0c] text-[#f1f1ee] hover:bg-[#1f1f23] transition-all flex items-center justify-between gap-4 shadow-md">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#bec8ff]/15 border border-[#bec8ff]/30 flex items-center justify-center text-[#bec8ff] shrink-0">
                    <Star className="w-5 h-5 fill-[#bec8ff]" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-[#f1f1ee]">
                      Botón de Google Maps
                    </h2>
                    <p className="text-xs text-[#c4c2c3] mt-0.5">
                      Ver ubicación y calificar a {business.name}
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-[#bec8ff] shrink-0" />
              </div>
            </a>
          </section>
        );

      case 'club':
        if (!club) return null;
        return (
          <section
            key="club"
            className="p-5 rounded-2xl bg-[#f6f6f3] border border-black/10 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0c0c0c] text-[#2fb36a] flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1f8a4c] block">
                    Fidelidad Digital
                  </span>
                  <h2 className="font-bold text-sm text-[#0c0c0c]">
                    {club.config.clubName || club.config.name}
                  </h2>
                </div>
              </div>
              <span className="text-[11px] font-bold bg-[#0c0c0c] text-[#bec8ff] px-2.5 py-1 rounded-full">
                +{club.config.pointsPerVisit || 1} sello
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#ffffff] border border-black/10 flex items-center justify-between">
              <span className="text-xs text-[#52525b]">Premio meta ({targetStamps} sellos):</span>
              <span className="text-xs font-bold text-[#0c0c0c]">{targetReward}</span>
            </div>

            {joinedMember ? (
              <div className="p-4 rounded-xl bg-[#ffffff] border border-[#2fb36a]/40 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#1f8a4c] font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Ya sumaste tu sello de hoy!</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#0c0c0c] bg-[#f1f1ee] px-2.5 py-1 rounded-lg border border-black/10">
                    {currentStamps} / {targetStamps} sellos
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {Array.from({ length: targetStamps }).map((_, idx) => {
                    const filled = idx < currentStamps;
                    return (
                      <div
                        key={idx}
                        className={`h-2.5 flex-1 rounded-full transition-colors ${
                          filled ? 'bg-[#2fb36a]' : 'bg-black/10'
                        }`}
                      />
                    );
                  })}
                </div>

                {walletPass ? (
                  <div className="pt-2 border-t border-black/10 space-y-2">
                    <p className="text-[11px] font-semibold text-[#52525b]">
                      Guardá tu tarjeta de sellos en la billetera de tu teléfono:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href={walletPass.appleWalletUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-full bg-[#0c0c0c] text-[#f1f1ee] text-xs font-semibold hover:bg-[#222225] transition-colors"
                      >
                        <Wallet className="w-3.5 h-3.5 text-[#bec8ff]" />
                        <span>Apple Wallet</span>
                      </a>
                      <a
                        href={walletPass.googleWalletUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-full bg-[#0c0c0c] text-[#f1f1ee] text-xs font-semibold hover:bg-[#222225] transition-colors"
                      >
                        <Wallet className="w-3.5 h-3.5 text-[#2fb36a]" />
                        <span>Google Wallet</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isGeneratingPass}
                    onClick={handleGenerateExtraPass}
                    className="w-full py-2.5 px-4 rounded-full bg-[#0c0c0c] text-[#f1f1ee] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[#222225] transition cursor-pointer"
                  >
                    <Wallet className="w-4 h-4 text-[#bec8ff]" />
                    <span>{isGeneratingPass ? 'Generando...' : 'Obtener pase para Wallet'}</span>
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleJoinClub} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#ffffff] border border-black/15 text-xs text-[#0c0c0c] placeholder-[#71717a] focus:outline-none focus:border-[#0c0c0c]"
                  />
                  <input
                    type="text"
                    placeholder="WhatsApp o Email"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#ffffff] border border-black/15 text-xs text-[#0c0c0c] placeholder-[#71717a] focus:outline-none focus:border-[#0c0c0c]"
                  />
                </div>
                <label className="flex items-start gap-2 text-[11px] text-[#52525b] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 rounded accent-[#0c0c0c]"
                  />
                  <span>
                    Acepto sumar mis sellos y recibir mi tarjeta digital del comercio.
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={isJoining}
                  className="w-full py-3 px-4 rounded-full bg-[#0c0c0c] text-[#f1f1ee] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[#222225] transition cursor-pointer"
                >
                  <Award className="w-4 h-4 text-[#2fb36a]" />
                  <span>{isJoining ? 'Sumando sello...' : 'Sumar mi sello gratis'}</span>
                </button>
              </form>
            )}
          </section>
        );

      case 'products':
        if (featuredProducts.length === 0) return null;
        return (
          <section
            key="products"
            className="p-4 rounded-2xl bg-[#f6f6f3] border border-black/10 space-y-3"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#0c0c0c]" />
              <h2 className="font-bold text-xs text-[#0c0c0c] uppercase tracking-wider">
                Destacados del local
              </h2>
            </div>
            <div className="divide-y divide-black/10">
              {featuredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {prod.imageUrl && (
                      <img
                        src={prod.imageUrl}
                        alt={prod.title}
                        className="w-12 h-12 rounded-xl object-cover border border-black/10 shrink-0 bg-white"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0c0c0c] truncate">{prod.title}</p>
                      {prod.description && (
                        <p className="text-[11px] text-[#52525b] truncate">{prod.description}</p>
                      )}
                    </div>
                  </div>
                  {prod.price !== undefined && (
                    <span className="text-xs font-extrabold font-mono bg-[#0c0c0c] text-[#bec8ff] px-2.5 py-1 rounded-md shrink-0">
                      {formatCurrency(prod.price)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        );

      case 'socials': {
        if (!config?.socials) return null;
        const igUrl = normalizeSocialUrl(config.socials.instagram, 'instagram');
        const ttUrl = normalizeSocialUrl(config.socials.tiktok, 'tiktok');
        const waUrl = buildWhatsAppWaMeLink(config.socials.whatsapp);
        const webUrl = normalizeSocialUrl(config.socials.web);

        if (!igUrl && !ttUrl && !waUrl && !webUrl) return null;

        return (
          <section key="socials" className="grid grid-cols-2 gap-2.5">
            {igUrl && (
              <a
                href={igUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full bg-[#0c0c0c] text-[#f1f1ee] hover:bg-[#222225] transition-colors flex items-center justify-center gap-2 text-xs font-semibold shadow-sm"
              >
                <InstagramLogo className="w-4 h-4 text-[#bec8ff]" />
                <span>Instagram</span>
              </a>
            )}
            {ttUrl && (
              <a
                href={ttUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full bg-[#0c0c0c] text-[#f1f1ee] hover:bg-[#222225] transition-colors flex items-center justify-center gap-2 text-xs font-semibold shadow-sm"
              >
                <TikTokLogo className="w-4 h-4 text-[#bec8ff]" />
                <span>TikTok</span>
              </a>
            )}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full bg-[#0c0c0c] text-[#f1f1ee] hover:bg-[#222225] transition-colors flex items-center justify-center gap-2 text-xs font-semibold shadow-sm"
              >
                <WhatsAppLogo className="w-4 h-4 text-[#2fb36a]" />
                <span>WhatsApp</span>
              </a>
            )}
            {webUrl && (
              <a
                href={webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full bg-[#0c0c0c] text-[#f1f1ee] hover:bg-[#222225] transition-colors flex items-center justify-center gap-2 text-xs font-semibold shadow-sm"
              >
                <Globe className="w-4 h-4 text-[#bec8ff]" />
                <span>Sitio Web</span>
              </a>
            )}
          </section>
        );
      }

      case 'details':
        if (
          !config?.details ||
          (!config.details.address && !config.details.hours && !config.details.phone)
        ) {
          return null;
        }
        return (
          <section
            key="details"
            className="p-4 rounded-2xl bg-[#f6f6f3] border border-black/10 space-y-2 text-xs text-[#52525b]"
          >
            {config.details.address && (
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[#0c0c0c] shrink-0" />
                <span className="text-[#0c0c0c] font-medium">{config.details.address}</span>
              </div>
            )}
            {config.details.hours && (
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#0c0c0c] shrink-0" />
                <span>{config.details.hours}</span>
              </div>
            )}
            {config.details.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#0c0c0c] shrink-0" />
                <span>{config.details.phone}</span>
              </div>
            )}
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f1ee] text-[#0c0c0c] flex flex-col items-center py-6 px-4">
      {/* Contenedor Principal Estilo Tarjeta Blanca de la Página Principal */}
      <main className="w-full max-w-md rounded-[32px] p-5 sm:p-6 bg-[#ffffff] border border-black/15 shadow-2xl space-y-4">
        {/* Encabezado del Comercio */}
        <header className="flex items-center justify-between pb-3.5 border-b border-black/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0c0c0c] text-[#bec8ff] font-bold text-sm flex items-center justify-center shrink-0">
              {business.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base text-[#0c0c0c] truncate">
                {business.name}
              </h1>
              <p className="text-[11px] text-[#52525b] truncate">{cartel.name}</p>
            </div>
          </div>

          <span className="text-[11px] font-mono font-bold text-[#0c0c0c] bg-[#f1f1ee] px-2.5 py-1 rounded-full border border-black/10 shrink-0">
            {cartel.code}
          </span>
        </header>

        {/* 1. COMPROBANTE DE COMPRA (Fijo siempre en la posición superior) */}
        <section className="p-4 rounded-2xl bg-[#f6f6f3] border border-black/10 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#1f8a4c] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2fb36a]" />
              Comprobante de compra
            </span>
            <span className="text-[10px] font-medium text-[#52525b]">
              {activeReceipt
                ? `Disponible (${Math.floor(receiptSecondsLeft / 60)}:${(receiptSecondsLeft % 60)
                    .toString()
                    .padStart(2, '0')})`
                : 'Mostrador'}
            </span>
          </div>

          {activeReceipt ? (
            <>
              <div className="space-y-1.5 pt-1">
                {activeReceipt.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center text-[#0c0c0c]"
                  >
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2.5 border-t border-black/10 flex justify-between items-center font-bold text-sm">
                <span className="text-[#0c0c0c]">Total</span>
                <span className="tabular-nums bg-[#0c0c0c] text-[#bec8ff] px-2.5 py-1 rounded-md font-mono">
                  {formatCurrency(activeReceipt.total)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Link
                  to={`/r/${activeReceipt.id}`}
                  className="py-2.5 px-4 rounded-full bg-[#0c0c0c] text-xs font-semibold text-[#f1f1ee] text-center flex items-center justify-center gap-1.5 hover:bg-[#222225] transition"
                >
                  <ReceiptIcon className="w-3.5 h-3.5 text-[#bec8ff]" />
                  <span>Abrir comprobante</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowVaultModal(true)}
                  className="py-2.5 px-4 rounded-full bg-[#0c0c0c] text-xs font-semibold text-[#f1f1ee] text-center flex items-center justify-center gap-1.5 hover:bg-[#222225] transition cursor-pointer"
                >
                  <BookmarkCheck className="w-3.5 h-3.5 text-[#2fb36a]" />
                  <span>Guardar comprobante</span>
                </button>
              </div>
              <p className="text-[10px] text-[#52525b] text-center">
                Comprobante de compra. No válido como factura fiscal.
              </p>
            </>
          ) : (
            <div className="py-2 flex items-center justify-between gap-3">
              <p className="text-xs text-[#52525b] leading-relaxed">
                Cuando el cajero registre tu cobro, tu comprobante digital aparecerá acá por 2 minutos.
              </p>
            </div>
          )}
        </section>

        {/* Modal / Bloque Desplegable: Guardar Tarjeta y Comprobante */}
        {showVaultModal && (
          <section className="p-5 rounded-2xl bg-[#f6f6f3] border-2 border-[#0c0c0c] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-[#1f8a4c]" />
                <h2 className="font-bold text-sm text-[#0c0c0c]">
                  Guardar Tarjeta y Comprobante
                </h2>
              </div>
              {!isRegisteredConsumer && (
                <button
                  type="button"
                  onClick={() => setShowVaultModal(false)}
                  className="text-xs font-semibold text-[#52525b] hover:text-[#0c0c0c] cursor-pointer"
                >
                  Cerrar
                </button>
              )}
            </div>

            <form onSubmit={handleSyncConsumerVault} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#ffffff] border border-black/15 text-xs text-[#0c0c0c] placeholder-[#71717a] focus:outline-none focus:border-[#0c0c0c]"
                />
                <input
                  type="text"
                  placeholder="WhatsApp o Email"
                  value={vaultContact}
                  onChange={(e) => setVaultContact(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#ffffff] border border-black/15 text-xs text-[#0c0c0c] placeholder-[#71717a] focus:outline-none focus:border-[#0c0c0c]"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2.5 text-[11px] text-[#0c0c0c] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentSaveReceipts}
                    onChange={(e) => setConsentSaveReceipts(e.target.checked)}
                    className="mt-0.5 rounded accent-[#0c0c0c]"
                  />
                  <span>
                    Guardar mis comprobantes, puntos y estadísticas de gastos en mi cuenta para no perderlos.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-[11px] text-[#0c0c0c] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentMarketingNetwork}
                    onChange={(e) => setConsentMarketingNetwork(e.target.checked)}
                    className="mt-0.5 rounded accent-[#0c0c0c]"
                  />
                  <span>
                    Recibir beneficios exclusivos de los locales que visito y descuentos de la Red Toque.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSyncingVault}
                className="w-full py-3 px-4 rounded-full bg-[#0c0c0c] text-[#f1f1ee] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[#222225] transition cursor-pointer"
              >
                <BookmarkCheck className="w-4 h-4 text-[#2fb36a]" />
                <span>{isSyncingVault ? 'Guardando...' : 'Confirmar y guardar'}</span>
              </button>
            </form>
          </section>
        )}

        {/* Resto de bloques configurados (Solo visibles si el comercio abonó el plan) */}
        {otherEnabledBlocks.map((blockKey) => renderOrderedBlock(blockKey))}

        {/* Footer Toque */}
        {config?.showToqueFooter !== false && (
          <footer className="pt-3 border-t border-black/10 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#52525b] hover:text-[#0c0c0c] transition-colors"
            >
              <span className="w-4 h-4 rounded bg-[#0c0c0c] text-[#bec8ff] flex items-center justify-center font-bold text-[9px]">
                T
              </span>
              <span>Tecnología sin contacto toque™</span>
            </Link>
          </footer>
        )}
      </main>
    </div>
  );
};
