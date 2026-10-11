/**
 * Toque — Modal de Contacto para Negocios en Riesgo (ManufacturerAtRiskModal)
 * Permite al fabricante escribirle al dueño por WhatsApp con mensaje prearmado editable.
 */

import React, { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { BusinessAtRisk } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import {
  MessageSquare,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Store,
  Clock,
} from 'lucide-react';

interface ManufacturerAtRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  atRiskItem: BusinessAtRisk | null;
}

export const ManufacturerAtRiskModal: React.FC<ManufacturerAtRiskModalProps> = ({
  isOpen,
  onClose,
  atRiskItem,
}) => {
  const { success } = useToast();
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (atRiskItem) {
      setMessage(atRiskItem.suggestedMessage);
    }
  }, [atRiskItem]);

  if (!atRiskItem) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    success('Mensaje copiado al portapapeles');
  };

  const cleanPhone = atRiskItem.phone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Contactar al dueño del negocio"
      description={`Este local no registra escaneos hace ${atRiskItem.daysWithoutScans} días. Una consulta rápida previene que dejen de usar el cartel.`}
      size="md"
    >
      <div className="space-y-5 pt-2">
        {/* Ficha rápida del negocio */}
        <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--ambar)]/15 text-[var(--ambar)] flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-small text-[var(--text-main)]">
                {atRiskItem.business.name}
              </p>
              <p className="text-micro text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-[var(--ambar)]" />
                <span>{atRiskItem.daysWithoutScans} días sin toques • {atRiskItem.cartelesCount} carteles</span>
              </p>
            </div>
          </div>

          <span className="text-micro font-mono text-[var(--text-muted)] bg-black/5 dark:bg-white/10 px-2 py-1 rounded">
            {atRiskItem.phone}
          </span>
        </div>

        {/* Mensaje prearmado editable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-small font-medium text-[var(--text-main)]">
              Mensaje sugerido para WhatsApp (editable)
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className="text-micro font-medium text-[var(--brand)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--menta)]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar texto'}</span>
            </button>
          </div>

          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-small text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)] leading-relaxed"
          />
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--brand)]/5 border border-[var(--brand)]/20 text-micro text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--text-main)] font-semibold">Consejo de postventa:</strong> Los gastronómicos aprecian que el fabricante note que el cartel quedó en un rincón poco visible. Moverlo 1 metro suele reactivar los toques.
        </div>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>

          <Button
            variant="secondary"
            onClick={handleCopy}
            icon={<Copy className="w-4 h-4" />}
          >
            Copiar
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
              onClose();
            }}
            icon={<MessageSquare className="w-4 h-4" />}
            className="bg-[#25D366] hover:bg-[#20bd5a] text-white border-transparent"
          >
            Abrir WhatsApp
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
