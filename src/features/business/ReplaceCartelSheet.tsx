/**
 * Toque — Hoja Inferior de Reemplazo de Cartel (ReplaceCartelSheet)
 * Reglas de producto:
 * - Selección de motivo: roto, perdido, chip que no lee, cambio de diseño
 * - Muestra el nuevo QR y datos para grabar el chip NFC
 * - Mensaje obligatorio claro: "Tu cartel nuevo hereda todo el historial y no consume cupo"
 */

import React, { useState } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { QRPreview } from '../../components/ui/QRPreview';
import { Cartel } from '../../api/types';
import { api } from '../../api';
import { useToast } from '../../components/ui/Toast';
import {
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Check,
  Copy,
  Info,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface ReplaceCartelSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cartel: Cartel | null;
  onSuccess?: () => void;
}

type ReplacementReason = 'broken' | 'lost' | 'chip_failure' | 'design_update';

export const ReplaceCartelSheet: React.FC<ReplaceCartelSheetProps> = ({
  isOpen,
  onClose,
  cartel,
  onSuccess,
}) => {
  const { success, error: toastError } = useToast();
  const [reason, setReason] = useState<ReplacementReason>('chip_failure');
  const [newName, setNewName] = useState(cartel?.name || '');
  const [newLocation, setNewLocation] = useState(cartel?.locationDescription || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replacedCartel, setReplacedCartel] = useState<Cartel | null>(null);
  const [copied, setCopied] = useState(false);

  // Reiniciar estado al abrir con un cartel
  React.useEffect(() => {
    if (cartel) {
      setNewName(cartel.name);
      setNewLocation(cartel.locationDescription);
      setReplacedCartel(null);
    }
  }, [cartel]);

  if (!cartel) return null;

  const handleExecuteReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await api.replaceCartel(cartel.id, {
        name: newName || cartel.name,
        locationDescription: newLocation || cartel.locationDescription,
      });

      setReplacedCartel(result.newCartel);
      success(
        'Reemplazo generado con éxito',
        `El nuevo cartel hereda todo el historial de "${cartel.name}".`
      );
      if (onSuccess) onSuccess();
    } catch (err) {
      toastError(
        'No pudimos completar el reemplazo',
        err instanceof Error ? err.message : 'Error inesperado'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const shortUrl = replacedCartel
    ? `https://toque.ar/${replacedCartel.shortCode}`
    : `https://toque.ar/${cartel.shortCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    success('Enlace corto copiado', shortUrl);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={replacedCartel ? 'Cartel de Reemplazo Listo' : 'Reemplazar Cartel Físico'}
      size="md"
    >
      <div className="space-y-6">
        {/* PASO 1: FORMULARIO DE MOTIVO Y CONFIRMACIÓN */}
        {!replacedCartel ? (
          <form onSubmit={handleExecuteReplacement} className="space-y-5">
            {/* Aviso de confianza */}
            <div className="p-4 rounded-xl bg-[var(--ultramar)]/5 border border-[var(--ultramar)]/20 text-small text-[var(--text-main)] space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[var(--brand)]">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Garantía de Continuidad Toque</span>
              </div>
              <p className="text-micro text-[var(--text-muted)] leading-relaxed">
                <strong className="text-[var(--text-main)]">Tu cartel nuevo hereda todo el historial</strong> de escaneos, estadísticas y enlaces. Además, <strong className="text-[var(--text-main)]">no consume cupo</strong> de carteles de tu plan.
              </p>
            </div>

            {/* Motivo del reemplazo */}
            <div>
              <label className="block text-small font-medium text-[var(--text-main)] mb-2">
                Motivo del reemplazo
              </label>
              <div className="space-y-2">
                {[
                  { id: 'chip_failure', label: 'El chip NFC no responde o lee intermitente' },
                  { id: 'broken', label: 'El cartel físico se rompió o deterioró' },
                  { id: 'lost', label: 'El cartel se extravió o fue retirado' },
                  { id: 'design_update', label: 'Actualización de gráfica o cambio de mesa' },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-small transition cursor-pointer ${
                      reason === item.id
                        ? 'border-[var(--brand)] bg-[var(--brand)]/5 text-[var(--text-main)] font-medium'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="replacement_reason"
                      checked={reason === item.id}
                      onChange={() => setReason(item.id as ReplacementReason)}
                      className="text-[var(--brand)] focus:ring-[var(--brand)]"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nombre y Ubicación */}
            <Input
              label="Nombre para el nuevo cartel"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Mesa 4 - Salón"
              required
            />

            <Input
              label="Ubicación física"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Ej. Mesa redonda ventana"
            />

            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                icon={<RotateCcw className="w-4 h-4" />}
              >
                Generar cartel de reemplazo
              </Button>
            </div>
          </form>
        ) : (
          /* PASO 2: CARTEL GENERADO (QR + DATOS NFC) */
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-[var(--menta)]/10 border border-[var(--menta)]/30 text-small text-[var(--text-main)]">
              <div className="flex items-center gap-2 font-semibold text-[var(--menta)]">
                <Check className="w-4 h-4 shrink-0" />
                <span>Reemplazo creado con éxito</span>
              </div>
              <p className="text-micro text-[var(--text-muted)] mt-1">
                El cartel viejo quedó archivado y este nuevo hereda todas sus métricas.
              </p>
            </div>

            {/* QR y Enlace */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-[var(--border-subtle)] space-y-4">
              <QRPreview url={shortUrl} size={180} />

              <div className="text-center space-y-1">
                <p className="font-semibold text-small text-[var(--text-main)]">
                  {replacedCartel.name}
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-small font-mono text-[var(--brand)] font-bold">
                  <span>{shortUrl}</span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="p-1 hover:text-[var(--text-main)] transition cursor-pointer"
                    title="Copiar enlace"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[var(--menta)]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Instrucción para grabar el chip NFC */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-2">
              <h4 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
                <Radio className="w-4 h-4 text-[var(--brand)]" />
                <span>Datos para grabar el chip NFC</span>
              </h4>
              <p className="text-micro text-[var(--text-muted)] leading-relaxed">
                Si tenés un lector NFC o usás la app móvil del fabricante, grabá la URL directa como registro <code className="font-mono bg-black/5 dark:bg-white/10 px-1 rounded">URI (https://)</code>:
              </p>
              <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/10 font-mono text-micro text-[var(--text-main)] select-all truncate">
                {shortUrl}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={onClose}>
                Entendido y cerrar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};
