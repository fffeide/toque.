import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api, PublicHub, Receipt, ClubMember, WalletPassResponse } from '../../api';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { downloadReceiptAsImage, downloadReceiptAsPdf } from '../../lib/receiptDownload';
import { useToast } from '../../components/ui/Toast';
import {
  Star,
  Download,
  Image as ImageIcon,
  CheckCircle2,
  MapPin,
  Clock,
  Phone,
  Instagram,
  ShoppingBag,
  AlertCircle,
  Award,
  Wallet,
  Receipt as ReceiptIcon,
  Wifi,
  ExternalLink,
} from 'lucide-react';

export const PublicHubView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const cleanCode = (code || '').toUpperCase();
  const { success, error: toastError } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [hubData, setHubData] = useState<PublicHub | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Comprobante en vivo (sincronizado con Caja en tiempo real)
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);

  // Club de fidelidad + WalletWallet
  const [clubConsent, setClubConsent] = useState(false);
  const [clubContact, setClubContact] = useState('');
  const [clubName, setClubName] = useState('');
  const [isJoiningClub, setIsJoiningClub] = useState(false);
  const [joinedMember, setJoinedMember] = useState<ClubMember | null>(null);
  const [walletPass, setWalletPass] = useState<WalletPassResponse | null>(null);
  const [isGeneratingPass, setIsGeneratingPass] = useState(false);

  const walletModeParam = searchParams.get('wallet');

  useEffect(() => {
    if (!cleanCode) return;

    let unsubscribe: (() => void) | null = null;
    setIsLoading(true);
    setErrorState(null);

    // Registrar escaneo real
    api.recordHubEvent(cleanCode, 'scan').catch(() => {});

    api
      .getPublicHub(cleanCode)
      .then((initialData) => {
        setHubData(initialData);
        if (initialData.receipt) {
          setActiveReceipt(initialData.receipt);
          api.claimReceipt(initialData.receipt.id).catch(() => {});
        }
      })
      .catch((err) => {
        setErrorState(err instanceof Error ? err.message : 'No pudimos cargar el cartel.');
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Suscripción en tiempo real (cuando el cajero emite un cobro en /caja, aparece instantáneamente acá)
    unsubscribe = api.subscribeToCartelHub(cleanCode, (liveHub) => {
      setHubData(liveHub);
      if (liveHub.receipt) {
        setActiveReceipt((prev) => {
          if (!prev || prev.id !== liveHub.receipt?.id) {
            api.claimReceipt(liveHub.receipt!.id).catch(() => {});
          }
          return liveHub.receipt || null;
        });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [cleanCode]);

  // Si el modo es directo a Google, redirigir automáticamente
  useEffect(() => {
    if (hubData?.config.mode === 'direct' && hubData.reviewUrl) {
      window.location.assign(hubData.reviewUrl);
    }
  }, [hubData]);

  const handleDownloadImage = async () => {
    if (!activeReceipt) return;
    try {
      await downloadReceiptAsImage(activeReceipt);
      success('Comprobante guardado', 'La imagen se descargó en tu dispositivo.');
    } catch {
      toastError('No pudimos generar la imagen', 'Probá de nuevo en unos segundos.');
    }
  };

  const handleDownloadPdf = () => {
    if (!activeReceipt) return;
    try {
      downloadReceiptAsPdf(activeReceipt);
    } catch {
      toastError('No pudimos abrir el comprobante imprimible');
    }
  };

  const handleReviewClick = () => {
    api.recordHubEvent(cleanCode, 'review_click').catch(() => {});
  };

  const handleJoinClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubConsent) {
      toastError('Es necesario marcar la casilla de consentimiento');
      return;
    }
    if (!clubContact.trim()) {
      toastError('Ingresá tu WhatsApp o correo');
      return;
    }
    setIsJoiningClub(true);
    try {
      const res = await api.joinClub({
        cartelCode: cleanCode,
        contact: clubContact.trim(),
        name: clubName.trim(),
        consent: true,
      });
      setJoinedMember(res.member);
      if (res.walletPass) {
        setWalletPass(res.walletPass);
      }
      success('¡Ya sos parte del Club!', `Sumaste ${res.pointsAwarded} sello(s) y tu pase Wallet está listo.`);
    } catch (err) {
      toastError(
        'No pudimos registrarte en el Club',
        err instanceof Error ? err.message : 'Probá de nuevo.'
      );
    } finally {
      setIsJoiningClub(false);
    }
  };

  const handleGenerateWalletPass = async (platform: 'apple' | 'google') => {
    if (!joinedMember) return;
    setIsGeneratingPass(true);
    try {
      const pass =
        walletPass ||
        (await api.createWalletPass({
          cartelCode: cleanCode,
          memberId: joinedMember.id,
          customerName: joinedMember.name || joinedMember.contact,
          customerContact: joinedMember.contact,
          stamps: joinedMember.points,
        }));
      setWalletPass(pass);
      success(
        platform === 'apple' ? 'Pase Apple Wallet generado' : 'Pase Google Wallet generado',
        `Código de socio validado: ${pass.validationCode}`
      );
    } catch (err) {
      toastError(
        'No pudimos generar el pase Wallet',
        err instanceof Error ? err.message : 'Intentá de nuevo.'
      );
    } finally {
      setIsGeneratingPass(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee]">
        <PublicHeader showToqueMark />
        <div className="max-w-md mx-auto p-4 space-y-4 pt-6">
          <Skeleton className="h-14 w-full rounded-2xl bg-[#111113]" />
          <Skeleton className="h-48 w-full rounded-2xl bg-[#111113]" />
          <Skeleton className="h-16 w-full rounded-2xl bg-[#111113]" />
          <Skeleton className="h-36 w-full rounded-2xl bg-[#111113]" />
        </div>
      </div>
    );
  }

  if (errorState === 'Cartel no encontrado.') {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee]">
        <PublicHeader showToqueMark />
        <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#18181b] border border-[#242426] text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-xl text-[#f1f1ee]">Cartel no encontrado</h2>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            El cartel con código <span className="font-mono font-bold text-[#f1f1ee]">{cleanCode}</span> no se encuentra activo o fue retirado.
          </p>
        </div>
      </div>
    );
  }

  const reviewUrl = hubData?.reviewUrl || 'https://maps.google.com';
  const isPaused = hubData?.cartel.status === 'inactive';

  // Asegurar que si hay un comprobante activo en vivo, se muestre siempre arriba aunque el orden de bloques varíe
  const orderedBlocks = hubData?.blocks.filter((b) => b.enabled) || [];
  const receiptBlockEnabled = orderedBlocks.some((b) => b.key === 'receipt');

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee] flex flex-col selection:bg-[#bec8ff] selection:text-[#0c0c0c]">
      <PublicHeader
        businessName={hubData?.business.name}
        logoUrl={hubData?.config.logoUrl}
        showToqueMark
      />

      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-5 space-y-4 pb-12">
        {/* Indicador de conexión en tiempo real con el mostrador */}
        <div className="px-3.5 py-2 rounded-xl bg-[#111113] border border-[#242426] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-[#a1a1aa]">
            <Wifi className="w-3.5 h-3.5 text-[#34d399]" />
            <span>
              Cartel <strong className="font-mono text-[#f1f1ee]">{cleanCode}</strong> conectado en vivo
            </span>
          </div>
          <span className="text-[#34d399] font-semibold">NFC / QR Activo</span>
        </div>

        {/* Si viene desde un link de pase WalletWallet (?wallet=apple|google) */}
        {walletModeParam && (
          <Card className="p-4 border border-[#bec8ff] bg-[#111113] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#bec8ff]">
                Pase Digital WalletWallet ({walletModeParam === 'apple' ? 'Apple Wallet' : 'Google Wallet'})
              </span>
              <Wallet className="w-4 h-4 text-[#bec8ff]" />
            </div>
            <p className="text-xs text-[#f1f1ee]">
              Socio de <strong>{searchParams.get('biz') || hubData?.business.name}</strong> · Sellos:{' '}
              <strong className="font-mono text-[#34d399]">{searchParams.get('stamps') || '1/5'}</strong>
            </p>
            <p className="text-[11px] text-[#a1a1aa]">
              Beneficio activo: {searchParams.get('reward') || 'Recompensa del Club'} · ID:{' '}
              <span className="font-mono text-[#f1f1ee]">{searchParams.get('passId') || cleanCode}</span>
            </p>
          </Card>
        )}

        {/* Aviso de Cartel en Pausa */}
        {isPaused && (
          <div className="p-3.5 rounded-xl bg-[#18181b] border border-amber-500/40 text-xs text-amber-300 flex items-center gap-2.5">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Este cartel se encuentra temporalmente en pausa por el comercio.</span>
          </div>
        )}

        {/* BANNER PRIORITARIO EN TIEMPO REAL: COMPROBANTE DE COMPRA EMITIDO EN CAJA */}
        {activeReceipt && receiptBlockEnabled && (
          <Card className="border-2 border-[#2fb36a] bg-[#111113] p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-[#242426] pb-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#34d399] uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ¡Tu comprobante digital está listo!
                </span>
                <h3 className="font-bold text-lg text-[#f1f1ee] mt-0.5">
                  {activeReceipt.businessName}
                </h3>
                <span className="text-[11px] font-mono text-[#a1a1aa]">
                  Ticket #{activeReceipt.id} · {formatDate(activeReceipt.createdAt)}
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#2fb36a]/15 text-[#34d399] flex items-center justify-center shrink-0">
                <ReceiptIcon className="w-4 h-4" />
              </div>
            </div>

            {/* Listado de ítems */}
            <div className="space-y-2 text-xs">
              {activeReceipt.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-[#f1f1ee]">
                  <span>
                    {item.quantity > 1 && (
                      <strong className="font-bold text-[#bec8ff]">{item.quantity}x </strong>
                    )}
                    {item.name}
                  </span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="pt-3 border-t border-[#242426] flex justify-between items-baseline">
              <span className="font-bold text-sm text-[#a1a1aa] uppercase tracking-wider">
                Total pagado
              </span>
              <span className="font-mono font-bold text-2xl text-[#f1f1ee] tabular-nums">
                {formatCurrency(activeReceipt.total)}
              </span>
            </div>

            {/* Botones de Guardado Local y Vista Completa */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="ultramar"
                size="sm"
                onClick={handleDownloadImage}
                icon={<ImageIcon className="w-3.5 h-3.5 text-[#0c0c0c]" />}
              >
                Guardar imagen
              </Button>
              <Button
                variant="secundario"
                size="sm"
                onClick={handleDownloadPdf}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Descargar PDF
              </Button>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#242426] text-[11px]">
              <span className="text-[#a1a1aa]">Comprobante de compra · No fiscal</span>
              <Link
                to={`/r/${activeReceipt.id}`}
                className="font-mono font-semibold text-[#bec8ff] hover:underline inline-flex items-center gap-1"
              >
                <span>Abrir link directo</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </Card>
        )}

        {/* RENDERIZADO DINÁMICO DE LOS DEMÁS BLOQUES DEL HUB */}
        {orderedBlocks.map((block) => {
          if (block.key === 'receipt') {
            // Si aún no hay un cobro emitido en este instante, mostrar indicador discreto de espera en vivo
            if (activeReceipt) return null;
            return (
              <div
                key="receipt-waiting"
                className="p-4 rounded-2xl bg-[#111113] border border-[#242426] flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#bec8ff] shrink-0">
                    <ReceiptIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-[#f1f1ee]">Comprobante Digital en Vivo</p>
                    <p className="text-[11px] text-[#a1a1aa]">
                      Cuando el cajero confirme tu pago, tu ticket aparecerá acá al instante.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          // 2. BLOQUE RESEÑA (Alto contraste WCAG AA sobre #bec8ff)
          if (block.key === 'review') {
            return (
              <div key="review" className="pt-1">
                <a
                  href={reviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleReviewClick}
                  className="w-full min-h-[54px] px-6 rounded-2xl bg-[#bec8ff] hover:bg-[#d6daf6] active:bg-[#a9b6ff] text-[#0c0c0c] font-bold text-base flex items-center justify-center gap-3 transition-colors select-none"
                >
                  <Star className="w-5 h-5 fill-[#0c0c0c] text-[#0c0c0c] shrink-0" />
                  <span>Dejar reseña en Google</span>
                </a>
              </div>
            );
          }

          // 3. BLOQUE CLUB DE FIDELIDAD + WALLETWALLET API
          if (block.key === 'club' && hubData?.club?.config.active) {
            const cfg = hubData.club.config;
            const targetStamps = cfg.rewards[0]?.target || 5;
            return (
              <Card key="club" className="p-5 space-y-4 bg-[#111113] border border-[#242426]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#2fb36a]/15 text-[#34d399] flex items-center justify-center font-bold">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#f1f1ee]">{cfg.name}</h3>
                      <p className="text-[11px] text-[#a1a1aa]">
                        {cfg.rule.type === 'per_visit'
                          ? 'Sumá 1 sello en cada visita · Pase WalletWallet'
                          : 'Sumá puntos con tus consumos · Pase WalletWallet'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#18181b] border border-[#28282a] text-[#bec8ff] px-2.5 py-0.5 rounded-full">
                    Wallet Ready
                  </span>
                </div>

                {joinedMember ? (
                  <div className="p-4 rounded-2xl bg-[#18181b] border border-[#28282a] space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#bec8ff]">Tu tarjeta de socio</span>
                      <span className="font-semibold text-[#f1f1ee]">
                        {joinedMember.name || joinedMember.contact}
                      </span>
                    </div>

                    {/* Sellos circulares */}
                    <div className="flex gap-2 justify-center py-2">
                      {Array.from({ length: Math.min(targetStamps, 6) }, (_, i) => i + 1).map(
                        (idx) => {
                          const isCompleted = idx <= joinedMember.points;
                          return (
                            <div
                              key={idx}
                              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${
                                isCompleted
                                  ? 'bg-[#2fb36a] border-[#2fb36a] text-[#0c0c0c] font-bold'
                                  : 'bg-[#111113] border-[#28282a] text-[#a1a1aa]'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : (
                                <span className="text-xs font-bold">{idx}</span>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>

                    <p className="text-center text-xs text-[#a1a1aa]">
                      Tenés <strong className="text-[#f1f1ee]">{joinedMember.points}</strong> sello(s) acumulado(s).
                    </p>

                    {/* Botones de Pase Digital WalletWallet */}
                    <div className="pt-2 border-t border-[#28282a] space-y-2">
                      <span className="block text-[10px] uppercase tracking-wider font-semibold text-[#a1a1aa] text-center">
                        Guardar pase digital (WalletWallet)
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="estrella"
                          size="sm"
                          disabled={isGeneratingPass}
                          onClick={() => handleGenerateWalletPass('apple')}
                          icon={<Wallet className="w-3.5 h-3.5 text-[#0c0c0c]" />}
                        >
                          Apple Wallet
                        </Button>
                        <Button
                          variant="ultramar"
                          size="sm"
                          disabled={isGeneratingPass}
                          onClick={() => handleGenerateWalletPass('google')}
                          icon={<Wallet className="w-3.5 h-3.5 text-[#0c0c0c]" />}
                        >
                          Google Wallet
                        </Button>
                      </div>

                      {walletPass && (
                        <div className="p-2.5 rounded-xl bg-[#111113] border border-[#242426] text-center space-y-1">
                          <span className="block text-[10px] text-[#34d399] font-bold">
                            ✓ Pase emitido vía {walletPass.provider}
                          </span>
                          <span className="block text-[11px] font-mono text-[#f1f1ee]">
                            Código: {walletPass.validationCode}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleJoinClub} className="space-y-3 pt-1">
                    <div>
                      <input
                        type="text"
                        required
                        value={clubContact}
                        onChange={(e) => setClubContact(e.target.value)}
                        placeholder="Tu WhatsApp o correo electrónico *"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-xs text-[#f1f1ee] placeholder-[#a1a1aa]/70 focus:outline-none focus:border-[#bec8ff]"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={clubName}
                        onChange={(e) => setClubName(e.target.value)}
                        placeholder="Tu nombre (opcional)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-xs text-[#f1f1ee] placeholder-[#a1a1aa]/70 focus:outline-none focus:border-[#bec8ff]"
                      />
                    </div>

                    <label className="flex items-start gap-2 text-[11px] text-[#a1a1aa] cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={clubConsent}
                        onChange={(e) => setClubConsent(e.target.checked)}
                        className="mt-0.5 rounded border-[#28282a] bg-[#18181b] text-[#bec8ff] focus:ring-[#bec8ff]"
                      />
                      <span>
                        Acepto sumarme al Club de <strong className="text-[#f1f1ee]">{hubData.business.name}</strong> y generar mi tarjeta digital de beneficios.
                      </span>
                    </label>

                    <Button
                      type="submit"
                      variant="estrella"
                      size="touch"
                      fullWidth
                      disabled={isJoiningClub || !clubConsent}
                    >
                      {isJoiningClub ? 'Generando tu pase…' : 'Sumarme y obtener pase Wallet'}
                    </Button>
                  </form>
                )}
              </Card>
            );
          }

          // 4. BLOQUE REDES SOCIALES
          if (block.key === 'socials') {
            const socials = hubData?.config.socials;
            const hasSocials =
              socials?.instagram || socials?.whatsapp || socials?.tiktok || socials?.facebook;
            if (!hasSocials) return null;

            return (
              <Card
                key="socials"
                className="p-4 flex items-center justify-around gap-2 bg-[#111113] border border-[#242426]"
              >
                {socials?.instagram && (
                  <a
                    href={`https://instagram.com/${socials.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#f1f1ee] hover:bg-[#18181b] transition-colors"
                  >
                    <Instagram className="w-4 h-4 text-[#bec8ff]" />
                    <span>@{socials.instagram.replace('@', '')}</span>
                  </a>
                )}

                {socials?.whatsapp && (
                  <a
                    href={`https://wa.me/${socials.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#f1f1ee] hover:bg-[#18181b] transition-colors"
                  >
                    <Phone className="w-4 h-4 text-[#34d399]" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </Card>
            );
          }

          // 5. BLOQUE PRODUCTOS DESTACADOS
          if (block.key === 'products') {
            const prods = hubData?.config.products?.slice(0, 4);
            if (!prods || prods.length === 0) return null;

            return (
              <Card key="products" className="p-5 space-y-3 bg-[#111113] border border-[#242426]">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#bec8ff]" />
                  <h3 className="font-bold text-sm text-[#f1f1ee]">Destacados de la casa</h3>
                </div>

                <div className="space-y-2">
                  {prods.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#f1f1ee]">{p.title}</p>
                        {p.description && (
                          <p className="text-[11px] text-[#a1a1aa]">{p.description}</p>
                        )}
                      </div>
                      {p.price && (
                        <span className="font-mono font-bold text-[#bec8ff] tabular-nums shrink-0 ml-2">
                          {formatCurrency(p.price)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          }

          // 6. BLOQUE DETALLES DEL LOCAL
          if (block.key === 'details') {
            const details = hubData?.config.details;
            const hasDetails = details?.address || details?.hours || details?.phone;
            if (!hasDetails) return null;

            return (
              <Card
                key="details"
                className="p-5 space-y-2.5 text-xs text-[#a1a1aa] bg-[#111113] border border-[#242426]"
              >
                {details?.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[#bec8ff] shrink-0 mt-0.5" />
                    <span className="text-[#f1f1ee]">{details.address}</span>
                  </div>
                )}
                {details?.hours && (
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-[#bec8ff] shrink-0 mt-0.5" />
                    <span>{details.hours}</span>
                  </div>
                )}
                {details?.phone && (
                  <div className="flex items-start gap-2.5">
                    <Phone className="w-4 h-4 text-[#bec8ff] shrink-0 mt-0.5" />
                    <span>{details.phone}</span>
                  </div>
                )}
              </Card>
            );
          }

          return null;
        })}

        {/* Respaldo garantizado de reseña */}
        {!hubData?.blocks.some((b) => b.key === 'review' && b.enabled) && (
          <div className="pt-2">
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleReviewClick}
              className="w-full min-h-[50px] px-6 rounded-2xl bg-[#bec8ff] text-[#0c0c0c] font-bold text-sm flex items-center justify-center gap-2"
            >
              <Star className="w-4 h-4 fill-[#0c0c0c]" />
              <span>Dejar reseña en Google</span>
            </a>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-[11px] text-[#a1a1aa] border-t border-[#242426]">
        <span>Tu cartel, con datos · </span>
        <span className="font-bold text-[#f1f1ee]">toque™</span>
      </footer>
    </div>
  );
};
