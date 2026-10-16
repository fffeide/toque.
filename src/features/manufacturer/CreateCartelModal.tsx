/**
 * Toque — Crear Cartel Directo para Fabricante (CreateCartelModal)
 * Cumple con el Requerimiento 11:
 * - Para crear un cartel NO es necesario tener un comercio previamente registrado.
 * - El fabricante solo necesita ingresar el link de Google Maps de las reseñas.
 * - Opcionalmente define una referencia (ej. "Mesa 1", "Mostrador" o nombre del local).
 * - Opcionalmente define la cantidad de carteles (ej. 1, 5, 10).
 * - El sistema genera el QR y enlace dinámico (/r/:shortCode) listo para imprimir y grabar.
 * - El cartel físico funciona inmediatamente al llegar al comercio: registra telemetría y redirige.
 * - Cuando el comercio ingresa por primera vez a su panel, vincula automáticamente sus carteles por ese link.
 */

import React, { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { QRPreview } from '../../components/ui/QRPreview';
import { validateGoogleReviewUrl } from '../../lib/urlValidator';
import { getShortUrl, getShortUrlDisplay } from '../../lib/urls';
import { api, Cartel } from '../../api';
import { useToast } from '../../components/ui/Toast';
import {
  QrCode,
  ExternalLink,
  Check,
  Copy,
  Sparkles,
  Link as LinkIcon,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface CreateCartelModalProps {
  isOpen: boolean;
  onClose: () => void;
  manufacturerId: string;
  onCartelesCreated?: (carteles: Cartel[]) => void;
}

export const CreateCartelModal: React.FC<CreateCartelModalProps> = ({
  isOpen,
  onClose,
  manufacturerId,
  onCartelesCreated,
}) => {
  const { success, error: toastError } = useToast();

  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCarteles, setCreatedCarteles] = useState<Cartel[] | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const validation = validateGoogleReviewUrl(googleMapsUrl);

  const handleTestUrl = () => {
    if (validation.isValid) {
      window.open(validation.sanitizedUrl || googleMapsUrl, '_blank', 'noopener,noreferrer');
      success('Probando enlace', 'Se abrió la ficha de Google Maps en una nueva pestaña.');
    } else {
      toastError('Enlace incompleto', validation.error || 'Ingresá un enlace válido de Google Maps');
    }
  };

  const handleReset = () => {
    setGoogleMapsUrl('');
    setReferenceName('');
    setQuantity(1);
    setCreatedCarteles(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) {
      toastError('Enlace de Google Maps inválido', validation.error || 'Verificá el enlace');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = api.createCartelFromLink
        ? await api.createCartelFromLink({
            targetUrl: validation.sanitizedUrl || googleMapsUrl,
            name: referenceName.trim() || undefined,
            quantity,
            manufacturerId,
          })
        : [
            await api.createCartel({
              businessId: 'unassigned',
              name: referenceName.trim() || 'Cartel físico',
              locationDescription: 'Listo para colocar',
              targetUrl: validation.sanitizedUrl || googleMapsUrl,
            }),
          ];

      setCreatedCarteles(result);
      success(
        '¡Cartel(es) generado(s) con éxito!',
        `Se crearon ${result.length} cartel(es) listos para imprimir y grabar.`
      );
      if (onCartelesCreated) onCartelesCreated(result);
    } catch (err) {
      toastError(
        'No pudimos generar los carteles',
        err instanceof Error ? err.message : 'Error inesperado'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const firstCartel = createdCarteles && createdCarteles[0];
  const shortUrl = firstCartel ? getShortUrl(firstCartel.shortCode) : '';

  const handleCopyLink = () => {
    if (!shortUrl) return;
    navigator.clipboard.writeText(shortUrl);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    success('Enlace corto copiado', shortUrl);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title={createdCarteles ? 'Carteles Listos para Producción' : 'Crear Cartel con Enlace Google Maps'}
      size={createdCarteles ? 'md' : 'sm'}
    >
      {!createdCarteles ? (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 text-xs text-white/80 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Flujo directo sin intermediarios</span>
            </div>
            <p className="text-white/70 leading-relaxed text-[11px]">
              No necesitás crear el comercio ni esperar registro. Solo pegá el link de reseñas de Google Maps: el QR dinámico ya queda activo y operativo de inmediato.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">
              Link de reseñas de Google Maps *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://search.google.com/local/writereview?placeid=... o g.page/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/30 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
              />
            </div>
            {googleMapsUrl && !validation.isValid && (
              <p className="text-[11px] text-rose-300 mt-1">{validation.error}</p>
            )}
            {validation.isValid && (
              <div className="flex items-center justify-between mt-1 text-[11px] text-emerald-300">
                <span>✓ Enlace validado correctamente</span>
                <button
                  type="button"
                  onClick={handleTestUrl}
                  className="inline-flex items-center gap-1 text-cyan-300 hover:underline cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  Probar enlace
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">
                Referencia o Nombre del Local (Opcional)
              </label>
              <input
                type="text"
                value={referenceName}
                onChange={(e) => setReferenceName(e.target.value)}
                placeholder="Ej. Mesa 1, Barra o Pizzería San Telmo"
                className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/30 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">
                Cantidad de carteles
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                handleReset();
                onClose();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
            >
              Generar {quantity > 1 ? `${quantity} carteles` : 'cartel'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
            <div className="text-xs text-white/90 space-y-1">
              <strong className="text-white block font-semibold text-sm">
                ¡Listo! {createdCarteles.length} cartel(es) activo(s) en la red
              </strong>
              <p className="text-white/70 text-[11px] leading-relaxed">
                Ya podés imprimir el QR o grabar el chip NFC. Cuando el negocio reciba el cartel no tiene que configurar nada; al abrir su panel por primera vez, el sistema detecta sus carteles automáticamente por el link de Google Maps.
              </p>
            </div>
          </div>

          {firstCartel && (
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-white/10 border border-white/15">
              <div className="p-2 rounded-xl bg-white shrink-0">
                <QRPreview url={shortUrl} size={120} />
              </div>
              <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
                <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-wider block">
                  Código: {firstCartel.code || firstCartel.shortCode}
                </span>
                <h4 className="text-sm font-bold text-white truncate">
                  {firstCartel.name}
                </h4>
                <p className="text-xs font-mono text-white/80 truncate">
                  {getShortUrlDisplay(firstCartel.shortCode)}
                </p>
                <div className="pt-2 flex items-center justify-center sm:justify-start gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyLink}
                    icon={copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedCode ? 'Copiado' : 'Copiar enlace'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(shortUrl, '_blank', 'noopener,noreferrer')}
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                  >
                    Probar toque
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-white/10">
            <Button
              variant="primary"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs"
            >
              Cerrar y ver en el panel
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
};
