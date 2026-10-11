/**
 * Toque — Alta Rápida de Negocio (QuickBusinessModal)
 * Formulario de una pantalla:
 * - Nombre, Mail, WhatsApp, Rubro
 * - Enlace de Google Reviews con validación en línea y botón "Probar"
 * - Genera inmediatamente: Cartel inicial, token, QR e invitación lista para enviar.
 */

import React, { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { QRPreview } from '../../components/ui/QRPreview';
import { validateGoogleReviewUrl } from '../../lib/urlValidator';
import { api, Tenant, Cartel } from '../../api';
import { useToast } from '../../components/ui/Toast';
import {
  Store,
  ExternalLink,
  Check,
  Copy,
  Sparkles,
  Smartphone,
  QrCode,
  Share2,
  Mail,
  MessageSquare,
} from 'lucide-react';

interface QuickBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  manufacturerId: string;
  onBusinessCreated?: (biz: Tenant) => void;
}

export const QuickBusinessModal: React.FC<QuickBusinessModalProps> = ({
  isOpen,
  onClose,
  manufacturerId,
  onBusinessCreated,
}) => {
  const { success, error: toastError } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Gastronomía y Cafetería');
  const [reviewUrl, setReviewUrl] = useState(
    'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    business: Tenant;
    cartel: Cartel;
    shortCode: string;
    inviteToken: string;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const validation = validateGoogleReviewUrl(reviewUrl);

  const handleTestReviewUrl = () => {
    if (validation.isValid) {
      window.open(reviewUrl, '_blank', 'noopener,noreferrer');
      success('Enlace de reseñas probado', 'Se abrió la ficha de Google Maps.');
    }
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setCategory('Gastronomía y Cafetería');
    setReviewUrl('https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4');
    setCreatedResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) {
      toastError('Enlace inválido', validation.error || 'Ingresá un enlace de Google Reviews');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.createBusinessQuick({
        manufacturerId,
        name,
        email,
        phone,
        category,
        reviewUrl: validation.sanitizedUrl || reviewUrl,
      });

      setCreatedResult(result);
      success('Negocio y cartel creados', `${name} ya tiene su código corto y QR asignado.`);
      if (onBusinessCreated) onBusinessCreated(result.business);
    } catch (err) {
      toastError('Error al crear negocio', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shortUrl = createdResult ? `https://toque.ar/${createdResult.shortCode}` : '';
  const inviteMessage = createdResult
    ? `Hola! Tu cartel físico para reseñas de Google ya está listo. Podés ver tus escaneos y estadísticas en tu panel de control ingresando acá: https://toque.ar/login?token=${createdResult.inviteToken}`
    : '';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title={createdResult ? '¡Negocio y Cartel Generados!' : 'Alta Rápida de Negocio Cliente'}
      description={
        createdResult
          ? 'El cliente ya tiene su cartel inicial asignado y su invitación lista.'
          : 'Completá los datos básicos en una sola pantalla para generar el cartel y la invitación.'
      }
      size="md"
    >
      {!createdResult ? (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <Input
            label="Nombre comercial del negocio"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Café & Bar El Molino"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Email de contacto del dueño"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dueño@elmolino.com.ar"
              required
            />

            <Input
              label="WhatsApp del local"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 9 11 4455-6677"
              required
            />
          </div>

          <div>
            <label className="block text-small font-medium text-[var(--text-main)] mb-1">
              Rubro comercial
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-small text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]"
            >
              <option value="Gastronomía y Cafetería">Gastronomía y Cafetería</option>
              <option value="Barbería y Estética">Barbería y Estética</option>
              <option value="Salud y Veterinaria">Salud y Veterinaria</option>
              <option value="Comercio y Retail">Comercio y Retail</option>
              <option value="Servicios y Talleres">Servicios y Talleres</option>
              <option value="Hotelería y Turismo">Hotelería y Turismo</option>
            </select>
          </div>

          {/* Enlace de Google Reviews con botón de prueba */}
          <div className="space-y-1.5 pt-1">
            <Input
              label="Enlace a ficha de Google Reviews"
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="https://search.google.com/local/writereview?placeid=..."
              error={validation.isValid ? undefined : validation.error}
              helperText="El link que abre directamente la ventana de 5 estrellas en Google Maps"
              required
            />

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleTestReviewUrl}
                disabled={!validation.isValid}
                icon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                Probar enlace antes de guardar
              </Button>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2.5">
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
              icon={<Store className="w-4 h-4" />}
            >
              Crear negocio y generar cartel
            </Button>
          </div>
        </form>
      ) : (
        /* RESULTADO: NEGOCIO CREADO, QR Y MENSAJE DE INVITACIÓN */
        <div className="space-y-5 pt-1">
          {/* Tarjeta del QR generado */}
          <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center gap-5">
            <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200 shrink-0">
              <QRPreview url={shortUrl} size={130} />
            </div>

            <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
              <div>
                <span className="text-micro font-semibold text-[var(--menta)] uppercase tracking-wider block">
                  Cartel listo para fabricar
                </span>
                <h4 className="font-display text-body font-bold text-[var(--text-main)] truncate">
                  {createdResult.business.name}
                </h4>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-small font-mono text-[var(--brand)] font-bold">
                <span>{shortUrl}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(shortUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                    success('Enlace de redirección copiado');
                  }}
                  className="p-1 hover:text-[var(--text-main)] transition cursor-pointer"
                  title="Copiar link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-[var(--menta)]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <p className="text-micro text-[var(--text-muted)]">
                Grabá este enlace en el chip NFC NTAG215 o imprimí el código QR.
              </p>
            </div>
          </div>

          {/* Invitación para el Dueño */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-small font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-[var(--brand)]" />
                <span>Mensaje de invitación para el dueño</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(inviteMessage);
                  setCopiedInvite(true);
                  setTimeout(() => setCopiedInvite(false), 2000);
                  success('Invitación copiada al portapapeles');
                }}
                className="text-micro font-medium text-[var(--brand)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedInvite ? <Check className="w-3.5 h-3.5 text-[var(--menta)]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedInvite ? 'Copiado' : 'Copiar invitación'}</span>
              </button>
            </div>

            <div className="p-3 rounded-lg bg-black/5 dark:bg-white/5 text-micro text-[var(--text-muted)] leading-relaxed">
              {inviteMessage}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                const phoneClean = createdResult.business.contactEmail ? '' : '';
                window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`, '_blank');
              }}
              icon={<MessageSquare className="w-4 h-4 text-[#25D366]" />}
            >
              Enviar por WhatsApp
            </Button>

            <Button
              variant="primary"
              onClick={() => {
                handleReset();
                onClose();
              }}
            >
              Listo y cerrar
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
};
