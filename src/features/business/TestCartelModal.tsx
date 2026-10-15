/**
 * Toque — Modal de Prueba de Cartel (TestCartelModal)
 * Permite al dueño del negocio probar sus carteles en vivo:
 * - Probar el enlace real abriendo Google Reviews en una nueva pestaña
 * - Simular un toque NFC o escaneo QR de un cliente para comprobar las métricas en tiempo real
 */

import React, { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Cartel } from '../../api/types';
import { api } from '../../api';
import { useToast } from '../../components/ui/Toast';
import { Smartphone, QrCode, ExternalLink, Check, Copy } from 'lucide-react';
import { getShortUrl, getShortUrlDisplay } from '../../lib/urls';

interface TestCartelModalProps {
  isOpen: boolean;
  onClose: () => void;
  carteles: Cartel[];
  onScanRecorded?: () => void;
}

export const TestCartelModal: React.FC<TestCartelModalProps> = ({
  isOpen,
  onClose,
  carteles,
  onScanRecorded,
}) => {
  const { success, error: toastError } = useToast();
  const [selectedCartelId, setSelectedCartelId] = useState<string>(
    carteles[0]?.id || ''
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Cartel actualmente seleccionado
  const activeCartel = carteles.find(s => s.id === selectedCartelId) || carteles[0];

  const handleSimulateScan = async (channel: 'nfc' | 'qr') => {
    if (!activeCartel) return;
    setIsSimulating(true);
    try {
      await api.recordScan(activeCartel.shortCode, channel);
      success(
        channel === 'nfc' ? 'Toque NFC simulado con éxito' : 'Escaneo QR simulado con éxito',
        `El cartel "${activeCartel.name}" sumó una nueva interacción en tu panel.`
      );
      if (onScanRecorded) {
        onScanRecorded();
      }
    } catch (err) {
      toastError('No se pudo registrar la interacción', err instanceof Error ? err.message : 'Error al simular');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopyLink = () => {
    if (!activeCartel) return;
    const url = getShortUrl(activeCartel.shortCode);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    success('Enlace corto copiado', url);
  };

  const handleOpenGoogle = () => {
    if (!activeCartel?.targetUrl) return;
    window.open(activeCartel.targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Probar mi cartel"
      description="Verificá que el enlace directo a Google funcione correctamente y comprobá cómo responde tu panel."
      size="md"
    >
      <div className="space-y-5 pt-2">
        {/* Selector de Cartel */}
        {carteles.length > 1 && (
          <div>
            <label className="block text-small font-medium text-[var(--text-main)] mb-1.5">
              Elegí el cartel que querés probar
            </label>
            <select
              value={selectedCartelId}
              onChange={(e) => setSelectedCartelId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#0d1b2e] text-white text-small focus:outline-none focus:border-white transition cursor-pointer"
            >
              {carteles.map((cartel) => (
                <option key={cartel.id} value={cartel.id} className="bg-[#0a1628] text-white py-2">
                  {cartel.name} ({cartel.shortCode})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Ficha del Cartel Activo */}
        {activeCartel && (
          <div className="p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-small text-[var(--text-main)]">
                  {activeCartel.name}
                </p>
                <p className="text-micro text-[var(--text-muted)] font-mono">
                  {getShortUrlDisplay(activeCartel.shortCode)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-micro font-medium bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[var(--text-main)] transition cursor-pointer"
                title="Copiar enlace corto"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[var(--menta)]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-[var(--border-subtle)]/60 text-micro text-[var(--text-muted)] truncate">
              <span className="font-medium text-[var(--text-main)]">Destino directo: </span>
              <span title={activeCartel.targetUrl}>{activeCartel.targetUrl}</span>
            </div>
          </div>
        )}

        {/* Guía Explicativa: ¿Cómo se escanea el cartel? */}
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-400/20 space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-300" />
            <span>¿Cómo se escanea el cartel en el local?</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-white/80">
            <div className="p-2.5 rounded-lg bg-black/20 border border-white/10 space-y-1">
              <span className="font-semibold text-blue-300 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" /> 1. Vía NFC (Contactless)
              </span>
              <p className="text-[11px] leading-relaxed text-white/70">
                El comensal acerca el lomo superior de su celular (iPhone o Android) a 1-3 cm del cartel. Sin abrir aplicaciones, salta una notificación emergente para calificar.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-black/20 border border-white/10 space-y-1">
              <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" /> 2. Vía Código QR
              </span>
              <p className="text-[11px] leading-relaxed text-white/70">
                Abre la cámara nativa de su teléfono y enfoca el código. El cartel imprime <strong className="text-white">toque.ar/{activeCartel?.shortCode}</strong> para redirigir dinámicamente en &lt;45 ms.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones de Prueba */}
        <div className="space-y-2.5">
          <p className="text-micro font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Acciones de prueba en caliente
          </p>

          <Button
            variant="primary"
            className="w-full justify-center"
            onClick={handleOpenGoogle}
            icon={<ExternalLink className="w-4 h-4" />}
          >
            Abrir reseña en Google Maps (como cliente)
          </Button>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Button
              variant="secondary"
              className="justify-center"
              onClick={() => handleSimulateScan('nfc')}
              isLoading={isSimulating}
              icon={<Smartphone className="w-4 h-4 text-[var(--brand)]" />}
            >
              Simular Toque NFC (+1)
            </Button>

            <Button
              variant="secondary"
              className="justify-center"
              onClick={() => handleSimulateScan('qr')}
              isLoading={isSimulating}
              icon={<QrCode className="w-4 h-4 text-[var(--brand)]" />}
            >
              Simular Escaneo QR (+1)
            </Button>
          </div>
        </div>

        <p className="text-micro text-[var(--text-muted)] text-center leading-relaxed">
          Recordá que las políticas de Google prohíben filtrar clientes o condicionar opiniones con premios. El cartel dirige de forma transparente y directa a la ficha oficial.
        </p>

        <div className="pt-2 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Entendido, cerrar
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
