import React, { useState, useEffect } from 'react';
import { api, Cartel, BusinessProfile, CartelRole } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { Link } from 'react-router-dom';
import {
  QrCode,
  Copy,
  Check,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  Sparkles,
  Factory,
  Send,
  X,
} from 'lucide-react';

export const CartelesManagementView: React.FC = () => {
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  // Modal para solicitar cartel a fabricante
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [requestRole, setRequestRole] = useState<CartelRole>('caja');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cartelesData, profileData] = await Promise.all([
        api.listCarteles(),
        api.getBusinessProfile(),
      ]);
      setCarteles(cartelesData);
      setBusinessProfile(profileData);
    } catch {
      // Ignorar
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}/h/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    success('Enlace copiado al portapapeles', url);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleTogglePause = async (cartel: Cartel) => {
    const nextStatus = cartel.status === 'active' ? 'inactive' : 'active';
    try {
      await api.updateCartel(cartel.id, { status: nextStatus });
      success(
        nextStatus === 'inactive' ? 'Cartel pausado' : 'Cartel reanudado',
        `El cartel ${cartel.code} ahora está ${nextStatus === 'inactive' ? 'en pausa' : 'activo'}.`
      );
      loadData();
    } catch (err) {
      toastError('No pudimos actualizar el cartel', err instanceof Error ? err.message : 'Error inesperado.');
    }
  };

  const handleRetire = async (cartel: Cartel) => {
    if (!window.confirm(`¿Querés retirar el cartel ${cartel.code}? No recibirá más toques.`)) {
      return;
    }
    try {
      await api.updateCartel(cartel.id, { status: 'trash' });
      success('Cartel retirado', `El cartel ${cartel.code} fue dado de baja.`);
      loadData();
    } catch {
      toastError('Error al retirar cartel');
    }
  };

  const handleToggleManufacturerAssociation = async () => {
    if (!businessProfile) return;
    const nextVal = !businessProfile.isAssociatedWithManufacturer;
    try {
      const updated = await api.updateBusinessProfile({
        isAssociatedWithManufacturer: nextVal,
        manufacturerName: nextVal ? 'Taller Acrílicos del Plata' : undefined,
      });
      setBusinessProfile(updated);
      success(
        nextVal ? 'Asociado a Fabricante' : 'Negocio Independiente',
        nextVal
          ? 'Ahora dependés de un fabricante: deberás solicitarle nuevos carteles.'
          : 'Ahora sos independiente: podés crear y activar nuevos carteles directamente.'
      );
    } catch {
      toastError('No pudimos actualizar la asociación');
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRequest(true);
    try {
      await api.requestCartelFromManufacturer({
        quantity: requestQuantity,
        role: requestRole,
        notes: requestNotes.trim(),
      });
      setIsRequestModalOpen(false);
      setRequestNotes('');
      success(
        'Solicitud enviada a tu fabricante',
        `Pediste ${requestQuantity} cartel(es) rol ${requestRole === 'caja' ? 'Caja' : 'Reseña'}. Te avisarán al tenerlos listos.`
      );
    } catch (err) {
      toastError('No pudimos enviar la solicitud', err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const isAssociated = !!businessProfile?.isAssociatedWithManufacturer;
  const manufacturerName = businessProfile?.manufacturerName || 'Taller Oficial Toque';

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
            Mis Carteles
          </h1>
          <p className="text-xs text-white/70 mt-0.5">
            Soportes físicos inteligentes con chip NFC y código QR.
          </p>
        </div>

        {/* Regla de negocio: SOLO pueden crear más carteles si NO dependen de un fabricante */}
        <div className="flex items-center gap-2">
          {isAssociated ? (
            <Button
              variant="estrella"
              size="sm"
              onClick={() => setIsRequestModalOpen(true)}
              icon={<Factory className="w-4 h-4 text-[#0B1030]" />}
            >
              Solicitar cartel a fabricante
            </Button>
          ) : (
            <Link to="/activar/DEMO01">
              <Button
                variant="ultramar"
                size="sm"
                icon={<Sparkles className="w-3.5 h-3.5 text-[#FFC21A]" />}
              >
                Activar nuevo cartel
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Rótulo de Fabricante y conmutador para testeo en Liquid Glass */}
      <div className="p-3.5 rounded-2xl bg-white/[0.08] border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs backdrop-blur-md text-white/80">
        <div className="flex items-center gap-2.5">
          <Factory className={`w-4 h-4 ${isAssociated ? 'text-[#FFC21A]' : 'text-white/60'}`} />
          <span>
            {isAssociated ? (
              <>
                Asociado al fabricante <strong className="text-white">{manufacturerName}</strong> (los nuevos carteles deben solicitarse).
              </>
            ) : (
              <>
                Negocio <strong className="text-white">independiente</strong> (podés activar carteles directamente sin fabricante intermediario).
              </>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggleManufacturerAssociation}
          className="text-[11px] font-bold text-[#FFC21A] hover:underline self-start sm:self-auto"
        >
          {isAssociated ? 'Cambiar a modo Independiente (Demo)' : 'Simular Fabricante Asociado (Demo)'}
        </button>
      </div>

      {/* Modal para solicitar cartel al fabricante */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 bg-[#0B1030]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card padding="lg" className="max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 bg-[#141824]/95 border border-white/20 text-white">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-[#FFC21A]" />
                <h3 className="font-display font-bold text-lg text-white">
                  Solicitar cartel al fabricante
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="p-1 text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              Tu comercio está vinculado a <strong className="text-white">{manufacturerName}</strong>.
              Ellos fabrican e imprimen los acrílicos con chip NFC y QR listo para tu local.
            </p>

            <form onSubmit={handleSendRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-white mb-1" htmlFor="q">
                  Cantidad de carteles solicitados
                </label>
                <select
                  id="q"
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-white focus:bg-white/15 focus:outline-none"
                >
                  <option value={1} className="bg-[#141824] text-white">1 cartel</option>
                  <option value={2} className="bg-[#141824] text-white">2 carteles</option>
                  <option value={3} className="bg-[#141824] text-white">3 carteles</option>
                  <option value={5} className="bg-[#141824] text-white">5 carteles</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1" htmlFor="r">
                  Rol esperado del soporte
                </label>
                <select
                  id="r"
                  value={requestRole}
                  onChange={(e) => setRequestRole(e.target.value as CartelRole)}
                  className="w-full px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-white focus:bg-white/15 focus:outline-none"
                >
                  <option value="caja" className="bg-[#141824] text-white">Caja (Recibos al instante + Reseña)</option>
                  <option value="resena" className="bg-[#141824] text-white">Reseña (Mostrador / Mesa directo)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1" htmlFor="not">
                  Indicaciones para el taller (opcional)
                </label>
                <textarea
                  id="not"
                  rows={2}
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Ej: Para la caja del patio, acrílico transparente"
                  className="w-full px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-xs text-white placeholder-white/40 focus:bg-white/15 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="submit"
                  variant="estrella"
                  size="touch"
                  fullWidth
                  disabled={isSubmittingRequest}
                  icon={<Send className="w-4 h-4 text-[#0B1030]" />}
                >
                  {isSubmittingRequest ? 'Enviando…' : 'Enviar solicitud'}
                </Button>
                <Button
                  type="button"
                  variant="secundario"
                  size="touch"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/15"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Listado de Carteles */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-28 rounded-2xl bg-white/10" />
          ))}
        </div>
      ) : carteles.length === 0 ? (
        <Card className="text-center py-12 space-y-4">
          <p className="text-xs text-white/60">No tenés carteles registrados.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {carteles.filter(c => c.status !== 'trash').map((cartel) => {
            const isActive = cartel.status === 'active';
            const isSinActivar = cartel.status === 'sin_activar';
            const isInactive = cartel.status === 'inactive';

            return (
              <Card key={cartel.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                    <QrCode className="w-6 h-6 text-[#FFC21A]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="cartel-code font-bold text-sm text-white bg-white/10 px-2.5 py-1 rounded-lg border border-white/20">
                        {cartel.code}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 text-[#19C37D] px-2.5 py-0.5 rounded-full border border-[#19C37D]/30">
                          Activo
                        </span>
                      )}
                      {isSinActivar && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FFC21A]/20 text-[#FFC21A] px-2.5 py-0.5 rounded-full border border-[#FFC21A]/40">
                          Sin activar (Ejemplo)
                        </span>
                      )}
                      {isInactive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FF6B6B]/20 text-[#FF6B6B] px-2.5 py-0.5 rounded-full border border-[#FF6B6B]/40">
                          En pausa
                        </span>
                      )}
                      <span className="text-[11px] text-white/70">
                        · Rol: <strong className="text-white">{cartel.role === 'caja' ? 'Caja' : 'Reseña'}</strong>
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-base text-white mt-1.5">
                      {cartel.name}
                    </h3>
                    <p className="text-xs text-white/60">
                      Modo: {cartel.mode === 'hub' ? 'Hub público con recibos' : 'Directo a Google Reviews'}
                    </p>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-white/15">
                  {isSinActivar ? (
                    <Link to={`/activar/${cartel.code}`}>
                      <Button variant="estrella" size="sm">
                        Activar con PIN ({cartel.pin})
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Button
                        variant="secundario"
                        size="sm"
                        onClick={() => handleCopyLink(cartel.code)}
                        icon={copiedCode === cartel.code ? <Check className="w-3.5 h-3.5 text-[#19C37D]" /> : <Copy className="w-3.5 h-3.5" />}
                        className="bg-white/10 text-white border-white/20 hover:bg-white/15"
                      >
                        {copiedCode === cartel.code ? 'Copiado' : 'Copiar enlace'}
                      </Button>

                      <Link to={`/h/${cartel.code}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="secundario" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />} className="bg-white/10 text-white border-white/20 hover:bg-white/15">
                          Abrir Hub
                        </Button>
                      </Link>

                      <Button
                        variant="secundario"
                        size="sm"
                        onClick={() => handleTogglePause(cartel)}
                        icon={isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        title={isActive ? 'Pausar cartel' : 'Reanudar cartel'}
                        className="bg-white/10 text-white border-white/20 hover:bg-white/15"
                      >
                        {isActive ? 'Pausar' : 'Activar'}
                      </Button>

                      <Button
                        variant="fantasma"
                        size="sm"
                        onClick={() => handleRetire(cartel)}
                        className="text-[#FF6B6B] hover:bg-white/10"
                        title="Retirar cartel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
