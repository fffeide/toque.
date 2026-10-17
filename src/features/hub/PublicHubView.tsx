import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, PublicHub, Receipt, ClubMember } from '../../api';
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
  Share2,
  MapPin,
  Clock,
  Phone,
  Instagram,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Award,
} from 'lucide-react';

export const PublicHubView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const cleanCode = (code || '').toUpperCase();
  const { success, error: toastError } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [hubData, setHubData] = useState<PublicHub | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Comprobante local
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);
  const [receiptClaimed, setReceiptClaimed] = useState(false);

  // Club de fidelidad
  const [clubConsent, setClubConsent] = useState(false);
  const [clubContact, setClubContact] = useState('');
  const [clubName, setClubName] = useState('');
  const [isJoiningClub, setIsJoiningClub] = useState(false);
  const [joinedMember, setJoinedMember] = useState<ClubMember | null>(null);

  const fetchHub = async () => {
    setIsLoading(true);
    setErrorState(null);
    try {
      const data = await api.getPublicHub(cleanCode);
      setHubData(data);
      if (data.receipt) {
        setActiveReceipt(data.receipt);
        // Si hay recibo disponible, al abrir la pantalla se reclama para que no aparezca a otro cliente (Regla de Oro 6)
        api.claimReceipt(data.receipt.id).then(() => {
          setReceiptClaimed(true);
        }).catch(() => {});
      }
    } catch (err) {
      setErrorState(err instanceof Error ? err.message : 'No pudimos cargar el cartel.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (cleanCode) {
      fetchHub();
    }
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
      success('¡Ya sos parte del Club!', `Sumaste ${res.pointsAwarded} sello(s) a tu tarjeta.`);
    } catch (err) {
      toastError('No pudimos registrarte en el Club', err instanceof Error ? err.message : 'Probá de nuevo.');
    } finally {
      setIsJoiningClub(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F4EE]">
        <PublicHeader showToqueMark />
        <div className="max-w-md mx-auto p-4 space-y-4 pt-6">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // Si el código no existe
  if (errorState === 'Cartel no encontrado.') {
    return (
      <div className="min-h-screen bg-[#F7F4EE]">
        <PublicHeader showToqueMark />
        <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FCE9E6] text-[#B8332A] flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="font-display font-bold text-xl text-[#0B1030]">
            Cartel no encontrado
          </h2>
          <p className="text-xs text-[#5E6072] leading-relaxed">
            El cartel con código <span className="cartel-code font-bold text-[#0B1030]">{cleanCode}</span> no se encuentra activo o fue retirado.
          </p>
        </div>
      </div>
    );
  }

  const reviewUrl = hubData?.reviewUrl || 'https://maps.google.com';
  const isPaused = hubData?.cartel.status === 'inactive';
  const accentColor = hubData?.config.accentColor || '#3A3FE0';

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col">
      <PublicHeader
        businessName={hubData?.business.name}
        logoUrl={hubData?.config.logoUrl}
        showToqueMark
      />

      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-5 space-y-4 pb-12">
        {/* Aviso de Cartel en Pausa */}
        {isPaused && (
          <div className="p-3.5 rounded-xl bg-[#FFF1C7] border border-[#FFC21A]/40 text-xs text-[#0B1030] flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-[#0B1030] shrink-0" />
            <span>Este cartel se encuentra temporalmente en pausa por el comercio.</span>
          </div>
        )}

        {/* RENDERIZADO DINÁMICO DE BLOQUES SEGÚN CONFIGURACIÓN DEL NEGOCIO */}
        {hubData?.blocks
          .filter((b) => b.enabled)
          .map((block) => {
            // 1. BLOQUE RECIBO (Solo si hay uno listo)
            if (block.key === 'receipt') {
              if (!activeReceipt) return null;
              return (
                <Card key="receipt" className="border-2 border-[#E3DDD2] p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#E3DDD2] pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-[#3A3FE0] uppercase tracking-wider block">
                        Tu comprobante de compra
                      </span>
                      <h3 className="font-display font-bold text-base text-[#0B1030]">
                        {activeReceipt.businessName}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-[#5E6072]">
                      {formatDate(activeReceipt.createdAt)}
                    </span>
                  </div>

                  {/* Listado de ítems */}
                  <div className="space-y-2 text-xs">
                    {activeReceipt.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[#0B1030]">
                        <span>
                          {item.quantity > 1 && <strong className="font-bold">{item.quantity}x </strong>}
                          {item.name}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="pt-3 border-t border-[#E3DDD2] flex justify-between items-baseline">
                    <span className="font-display font-bold text-sm text-[#0B1030]">Total</span>
                    <span className="font-display font-bold text-2xl text-[#0B1030] tabular-nums">
                      {formatCurrency(activeReceipt.total)}
                    </span>
                  </div>

                  {/* Botones de Guardado Local */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="secundario"
                      size="sm"
                      onClick={handleDownloadImage}
                      icon={<ImageIcon className="w-3.5 h-3.5" />}
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

                  {/* Pie legal obligatorio (Regla de Oro 6) */}
                  <div className="pt-2 text-center border-t border-[#E3DDD2]/60">
                    <p className="text-[11px] font-semibold text-[#B8332A]">
                      Comprobante de compra. No es una factura.
                    </p>
                  </div>
                </Card>
              );
            }

            // 2. BLOQUE RESEÑA (Regla de Oro 5: texto neutro "Dejar reseña en Google" siempre visible para todos)
            if (block.key === 'review') {
              return (
                <div key="review" className="pt-1">
                  <a
                    href={reviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[54px] px-6 rounded-2xl bg-[#FFC21A] hover:bg-[#F0B412] active:bg-[#E0A40A] text-[#0B1030] font-bold text-base flex items-center justify-center gap-3 transition-transform active:scale-[0.98] shadow-md select-none group"
                  >
                    <Star className="w-5 h-5 fill-[#0B1030] text-[#0B1030] shrink-0" />
                    <span>Dejar reseña en Google</span>
                  </a>
                </div>
              );
            }

            // 3. BLOQUE CLUB DE FIDELIDAD
            if (block.key === 'club' && hubData.club?.config.active) {
              const cfg = hubData.club.config;
              return (
                <Card key="club" className="p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#FFF1C7] text-[#0B1030] flex items-center justify-center font-bold">
                      <Award className="w-4 h-4 text-[#FFC21A]" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm text-[#0B1030]">{cfg.name}</h3>
                      <p className="text-[11px] text-[#5E6072]">
                        {cfg.rule.type === 'per_visit' ? 'Sumá 1 sello en cada visita' : 'Sumá puntos con tus consumos'}
                      </p>
                    </div>
                  </div>

                  {/* Tarjeta de sellos / puntos si ya es socio */}
                  {joinedMember ? (
                    <div className="p-4 rounded-xl bg-[#ECEDFC] border border-[#3A3FE0]/20 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#3A3FE0]">Tu tarjeta digital</span>
                        <span className="font-semibold text-[#0B1030]">{joinedMember.name || joinedMember.contact}</span>
                      </div>

                      {/* Sellos circulares */}
                      <div className="flex gap-2 justify-center py-2">
                        {[1, 2, 3, 4, 5].map((idx) => {
                          const isCompleted = idx <= (joinedMember.points % 5 || (joinedMember.points > 0 ? 5 : 0));
                          return (
                            <div
                              key={idx}
                              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition ${
                                isCompleted
                                  ? 'bg-[#3A3FE0] border-[#3A3FE0] text-white shadow-xs'
                                  : 'bg-white border-[#E3DDD2] text-[#5E6072]'
                              }`}
                            >
                              {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-bold">{idx}</span>}
                            </div>
                          );
                        })}
                      </div>

                      <p className="text-center text-[11px] text-[#5E6072]">
                        Llevás <strong>{joinedMember.points}</strong> punto(s) acumulado(s). ¡Presentalo en tu próxima visita!
                      </p>
                    </div>
                  ) : (
                    /* Formulario de Registro con Consentimiento Explícito (Regla de Oro 8) */
                    <form onSubmit={handleJoinClub} className="space-y-3 pt-1">
                      <div>
                        <input
                          type="text"
                          required
                          value={clubContact}
                          onChange={(e) => setClubContact(e.target.value)}
                          placeholder="Tu WhatsApp o correo *"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-xs text-[#0B1030] focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
                        />
                      </div>

                      <div>
                        <input
                          type="text"
                          value={clubName}
                          onChange={(e) => setClubName(e.target.value)}
                          placeholder="Tu nombre (opcional)"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-xs text-[#0B1030] focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
                        />
                      </div>

                      {/* Casilla de Consentimiento desmarcada por defecto */}
                      <label className="flex items-start gap-2 text-[11px] text-[#5E6072] cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={clubConsent}
                          onChange={(e) => setClubConsent(e.target.checked)}
                          className="mt-0.5 rounded border-[#E3DDD2] text-[#3A3FE0] focus:ring-[#3A3FE0]"
                        />
                        <span>
                          Acepto sumarme al Club de {hubData.business.name} para acumular beneficios en mis visitas.
                        </span>
                      </label>

                      <Button
                        type="submit"
                        variant="ultramar"
                        size="touch"
                        fullWidth
                        disabled={isJoiningClub || !clubConsent}
                      >
                        {isJoiningClub ? 'Guardando…' : 'Sumarme al club'}
                      </Button>
                    </form>
                  )}
                </Card>
              );
            }

            // 4. BLOQUE REDES SOCIALES
            if (block.key === 'socials') {
              const socials = hubData.config.socials;
              const hasSocials = socials?.instagram || socials?.whatsapp || socials?.tiktok || socials?.facebook;
              if (!hasSocials) return null;

              return (
                <Card key="socials" className="p-4 flex items-center justify-around gap-2">
                  {socials.instagram && (
                    <a
                      href={`https://instagram.com/${socials.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-[#0B1030] hover:bg-[#F7F4EE] transition"
                    >
                      <Instagram className="w-4 h-4 text-[#3A3FE0]" />
                      <span>Instagram</span>
                    </a>
                  )}

                  {socials.whatsapp && (
                    <a
                      href={`https://wa.me/${socials.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-[#0B1030] hover:bg-[#F7F4EE] transition"
                    >
                      <Phone className="w-4 h-4 text-[#3A3FE0]" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </Card>
              );
            }

            // 5. BLOQUE PRODUCTOS DESTACADOS
            if (block.key === 'products') {
              const prods = hubData.config.products?.slice(0, 4);
              if (!prods || prods.length === 0) return null;

              return (
                <Card key="products" className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#3A3FE0]" />
                    <h3 className="font-display font-bold text-sm text-[#0B1030]">Destacados de la casa</h3>
                  </div>

                  <div className="space-y-2">
                    {prods.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-[#F7F4EE] border border-[#E3DDD2] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#0B1030]">{p.title}</p>
                          {p.description && <p className="text-[11px] text-[#5E6072]">{p.description}</p>}
                        </div>
                        {p.price && (
                          <span className="font-bold text-[#0B1030] tabular-nums shrink-0 ml-2">
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
              const details = hubData.config.details;
              const hasDetails = details?.address || details?.hours || details?.phone;
              if (!hasDetails) return null;

              return (
                <Card key="details" className="p-5 space-y-2.5 text-xs text-[#5E6072]">
                  {details.address && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#3A3FE0] shrink-0 mt-0.5" />
                      <span>{details.address}</span>
                    </div>
                  )}
                  {details.hours && (
                    <div className="flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-[#3A3FE0] shrink-0 mt-0.5" />
                      <span>{details.hours}</span>
                    </div>
                  )}
                  {details.phone && (
                    <div className="flex items-start gap-2.5">
                      <Phone className="w-4 h-4 text-[#3A3FE0] shrink-0 mt-0.5" />
                      <span>{details.phone}</span>
                    </div>
                  )}
                </Card>
              );
            }

            return null;
          })}

        {/* Botón de respaldo garantizado (Regla de Oro 7: si todo falla, el botón de reseña siempre visible) */}
        {!hubData?.blocks.some((b) => b.key === 'review' && b.enabled) && (
          <div className="pt-2">
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[50px] px-6 rounded-2xl bg-[#FFC21A] text-[#0B1030] font-bold text-sm flex items-center justify-center gap-2 shadow-xs"
            >
              <Star className="w-4 h-4 fill-[#0B1030]" />
              <span>Dejar reseña en Google</span>
            </a>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-[11px] text-[#5E6072]">
        <span>Tu cartel, con datos · </span>
        <span className="font-semibold text-[#0B1030]">Toque™</span>
      </footer>
    </div>
  );
};
