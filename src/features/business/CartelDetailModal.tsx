/**
 * Toque — Detalle Completo de Cartel (CartelDetailModal)
 * Muestra:
 * - Estadísticas avanzadas: hora pico, día pico, dispositivos (Android/iOS), ciudad aproximada
 * - Línea de tiempo de eventos (primer escaneo, avisos, reemplazos)
 * - Enlace de reseñas editable en línea con botón "Probar" y validación de dominios de Google
 * - Código corto visible y copiable
 * - Descarga de QR en varios tamaños con guía de impresión física (mín. 2.5 cm, alto contraste, margen blanco)
 */

import React, { useState, useEffect } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { QRPreview } from '../../components/ui/QRPreview';
import { Cartel, CartelDetailStats } from '../../api/types';
import { api } from '../../api';
import { useToast } from '../../components/ui/Toast';
import { validateGoogleReviewUrl } from '../../lib/urlValidator';
import { formatNumber, formatDateTime } from '../../lib/formatters';
import { getShortUrl, getShortUrlDisplay } from '../../lib/urls';
import {
  Smartphone,
  QrCode,
  Clock,
  Calendar,
  MapPin,
  ExternalLink,
  Download,
  Copy,
  Check,
  RotateCcw,
  AlertTriangle,
  History,
  FileCheck,
  Sparkles,
} from 'lucide-react';

interface CartelDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartel: Cartel | null;
  onCartelUpdated?: () => void;
  onRequestReplacement?: (cartel: Cartel) => void;
}

export const CartelDetailModal: React.FC<CartelDetailModalProps> = ({
  isOpen,
  onClose,
  cartel,
  onCartelUpdated,
  onRequestReplacement,
}) => {
  const { success, error: toastError } = useToast();
  const [detailStats, setDetailStats] = useState<CartelDetailStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Link editable de reseñas
  const [targetUrl, setTargetUrl] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Cargar estadísticas detalladas del cartel
  useEffect(() => {
    if (isOpen && cartel) {
      setTargetUrl(cartel.targetUrl);
      setIsLoading(true);
      api
        .getCartelDetail(cartel.id)
        .then((data) => {
          setDetailStats(data);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, cartel]);

  if (!cartel) return null;

  const urlValidation = validateGoogleReviewUrl(targetUrl);
  const shortUrl = getShortUrl(cartel.shortCode);
  const shortUrlDisplay = getShortUrlDisplay(cartel.shortCode);

  const handleCopyShortCode = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    success('Enlace copiado', shortUrl);
  };

  const handleTestLink = () => {
    if (!urlValidation.isValid) return;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    success('Enlace verificado', 'Se abrió la ficha de reseñas en Google.');
  };

  const handleSaveUrl = async () => {
    if (!urlValidation.isValid) {
      toastError('Enlace inválido', urlValidation.error || 'Verificá el enlace');
      return;
    }

    setIsSavingUrl(true);
    try {
      await api.updateCartel(cartel.id, {
        targetUrl: urlValidation.sanitizedUrl || targetUrl,
      });
      setIsEditingUrl(false);
      success('Enlace de reseñas actualizado', 'Los próximos toques dirigirán a la nueva URL.');
      if (onCartelUpdated) onCartelUpdated();
    } catch (err) {
      toastError('Error al guardar enlace', err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSavingUrl(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={cartel.name}
      size="lg"
    >
      <div className="space-y-6">
        {/* Cabecera con código corto y estado */}
        <div className="p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-micro font-medium text-[var(--text-muted)]">
              Código corto del cartel
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-body font-bold text-[var(--brand)]">
                {shortUrlDisplay}
              </span>
              <button
                type="button"
                onClick={handleCopyShortCode}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-micro font-medium text-[var(--text-main)] transition cursor-pointer"
                title="Copiar código"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-[var(--menta)]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            {cartel.locationDescription && (
              <p className="text-micro text-[var(--text-muted)] mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{cartel.locationDescription}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onRequestReplacement && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose();
                  onRequestReplacement(cartel);
                }}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reemplazar
              </Button>
            )}
          </div>
        </div>

        {/* 1. SECCIÓN DE ENLACE DE RESEÑAS EDITABLE CON VALIDACIÓN */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--estrella)]" />
              <span>Destino de reseñas en Google Maps</span>
            </h4>
            {!isEditingUrl ? (
              <button
                type="button"
                onClick={() => setIsEditingUrl(true)}
                className="text-micro font-medium text-[var(--brand)] hover:underline cursor-pointer"
              >
                Cambiar enlace
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsEditingUrl(false);
                  setTargetUrl(cartel.targetUrl);
                }}
                className="text-micro font-medium text-[var(--text-muted)] hover:underline cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>

          {!isEditingUrl ? (
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-black/5 dark:bg-white/5">
              <span className="text-micro font-mono text-[var(--text-main)] truncate" title={cartel.targetUrl}>
                {cartel.targetUrl}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTestLink}
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                className="shrink-0"
              >
                Probar
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <Input
                label="Nueva dirección oficial de reseñas"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://search.google.com/local/writereview?placeid=..."
                error={urlValidation.isValid ? undefined : urlValidation.error}
                helperText="Solo se permiten dominios directos de Google (google.com, maps.app.goo.gl, g.page, etc.)"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestLink}
                  disabled={!urlValidation.isValid}
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  Probar antes de guardar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveUrl}
                  isLoading={isSavingUrl}
                  disabled={!urlValidation.isValid || targetUrl === cartel.targetUrl}
                >
                  Guardar cambio
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 2. ESTADÍSTICAS Y RENDIMIENTO DEL CARTEL */}
        {detailStats && (
          <div className="space-y-4">
            <h4 className="font-display text-small font-semibold text-[var(--text-main)]">
              Rendimiento y momentos destacados
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)]">
                <p className="text-micro text-[var(--text-muted)]">Total histórico</p>
                <p className="font-display text-title-3 font-bold text-[var(--text-main)] mt-0.5">
                  {formatNumber(detailStats.totalScans)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)]">
                <p className="text-micro text-[var(--text-muted)]">Opiniones estimadas</p>
                <p className="font-display text-title-3 font-bold text-amber-300 mt-0.5">
                  ~{Math.round(detailStats.totalScans * 0.28)}
                </p>
                <p className="text-micro text-[var(--text-muted)]">
                  ~28% conversión típica
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)]">
                <div className="flex items-center gap-1 text-micro text-[var(--text-muted)]">
                  <Clock className="w-3 h-3 text-[var(--brand)]" />
                  <span>Horas pico</span>
                </div>
                <p className="text-micro font-medium text-[var(--text-main)] mt-1">
                  {detailStats.peakHour}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)]">
                <div className="flex items-center gap-1 text-micro text-[var(--text-muted)]">
                  <Calendar className="w-3 h-3 text-[var(--estrella)]" />
                  <span>Días pico</span>
                </div>
                <p className="text-micro font-medium text-[var(--text-main)] mt-1">
                  {detailStats.peakDay}
                </p>
              </div>
            </div>

            {/* Dispositivos y Ciudad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-small text-[var(--text-main)] font-medium">Dispositivos</span>
                </div>
                <div className="text-micro text-[var(--text-muted)]">
                  Android <strong className="text-[var(--text-main)]">{detailStats.devices.androidPercentage}%</strong> • iOS <strong className="text-[var(--text-main)]">{detailStats.devices.iosPercentage}%</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-small text-[var(--text-main)] font-medium">Ubicación aprox.</span>
                </div>
                <span className="text-micro font-medium text-[var(--text-main)]">
                  {detailStats.approximateCity}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. DESCARGA DEL QR Y GUÍA DE IMPRESIÓN */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-4">
          <h4 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[var(--brand)]" />
            <span>Descarga del QR e instrucciones físicas</span>
          </h4>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs shrink-0">
              <QRPreview url={shortUrl} size={130} />
            </div>

            <div className="space-y-3 flex-1 text-small">
              <div className="space-y-1.5 text-micro text-[var(--text-muted)]">
                <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold">
                  <FileCheck className="w-3.5 h-3.5 text-[var(--menta)]" />
                  <span>Guía para una impresión infalible:</span>
                </div>
                <p>• <strong>Tamaño mínimo:</strong> 2,5 cm x 2,5 cm para que cualquier cámara lo lea al instante.</p>
                <p>• <strong>Zona de silencio:</strong> Dejá al menos 4 mm de margen blanco alrededor del código.</p>
                <p>• <strong>Alto contraste:</strong> Negro puro sobre fondo claro sin brillos reflectantes directos.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.download = `QR-${cartel.shortCode}-500px.png`;
                    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(shortUrl)}`;
                    link.click();
                    success('Descarga iniciada', 'QR de 500 px listo para imprimir.');
                  }}
                  icon={<Download className="w-3.5 h-3.5" />}
                >
                  Descargar PNG (300 dpi)
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(shortUrl)}`, '_blank');
                  }}
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  Ver en alta resolución
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. LÍNEA DE TIEMPO DE EVENTOS */}
        {detailStats?.timeline && detailStats.timeline.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Historial del cartel</span>
            </h4>

            <div className="space-y-2.5">
              {detailStats.timeline.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-[var(--border-subtle)] flex items-start gap-3"
                >
                  <div className="w-2 h-2 rounded-full bg-[var(--brand)] mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-small text-[var(--text-main)]">
                        {evt.title}
                      </p>
                      <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                        {formatDateTime(evt.timestamp)}
                      </span>
                    </div>
                    <p className="text-micro text-[var(--text-muted)] mt-0.5">
                      {evt.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cerrar detalle
          </Button>
        </div>
      </div>
    </Sheet>
  );
};
