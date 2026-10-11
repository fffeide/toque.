/**
 * Toque — Equipo y Reto Mensual (StaffView)
 * Disponible tras feature flag 'staff':
 * - QR y enlace único por empleado
 * - Reto mensual con ranking amigable
 * - Regla ética fija: "Se incentiva al staff, NUNCA al cliente"
 */

import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { api, StaffMember } from '../../api';
import { useDataQuery } from '../../hooks/useDataQuery';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Dialog } from '../../components/ui/Dialog';
import { OneTimeInfoModal } from '../../components/ui/OneTimeInfoModal';
import { QRPreview } from '../../components/ui/QRPreview';
import { formatNumber } from '../../lib/formatters';
import { useToast } from '../../components/ui/Toast';
import { getShortUrl, getShortUrlDisplay } from '../../lib/urls';
import {
  Trophy,
  Users,
  QrCode,
  ShieldAlert,
  Copy,
  Check,
  Award,
  Sparkles,
} from 'lucide-react';

export const StaffView: React.FC = () => {
  const { tenant } = useAuth();
  const { success } = useToast();
  const businessId = tenant?.type === 'business' ? tenant.id : 'biz-esquina';
  const [selectedStaffForQr, setSelectedStaffForQr] = useState<StaffMember | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const {
    data: staffList,
    isLoading,
    isError,
    error,
    refetch,
  } = useDataQuery<StaffMember[]>({
    queryFn: () => api.listStaff(businessId),
  });

  const handleCopyShortLink = (shortCode: string) => {
    const url = getShortUrl(shortCode);
    navigator.clipboard.writeText(url);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    success('Enlace de empleado copiado', url);
  };

  if (isError) {
    return (
      <div className="py-12">
        <ErrorState
          title="No pudimos cargar la tabla del equipo"
          message={error?.message}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (isLoading || !staffList) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-64 h-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      {/* Cabecera y aclaración ética */}
      <div>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-300" />
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-white tracking-tight">
            Equipo y Reto del Mes
          </h1>
        </div>
        <p className="text-xs text-white/70 mt-1">
          Cada colaborador tiene su enlace o QR personal para medir a quién felicitan más los clientes.
        </p>
      </div>

      {/* Pop-up Informativo: ¿Cómo funciona el módulo Equipo en Toque? */}
      <OneTimeInfoModal
        id="staff_module_guide_info"
        title="¿Cómo funciona el módulo Equipo en Toque?"
        icon={<Users className="w-5 h-5 text-cyan-400" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
            <span className="font-semibold text-cyan-400">1. Identificador propio</span>
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              Cada mesero, cajero o colaborador tiene su propio código o enlace personal para su delantal o gafete.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
            <span className="font-semibold text-emerald-400">2. Métrica individual</span>
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              Cuando el cliente califica en Google, el sistema registra a quién le pertenece el toque sin alterar la experiencia del cliente.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
            <span className="font-semibold text-amber-400">3. Reto y motivación</span>
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              A fin de mes podés premiar al colaborador con mayor cantidad de reseñas conseguidas cordialmente.
            </p>
          </div>
        </div>
      </OneTimeInfoModal>

      {/* Pop-up Informativo: Regla Ética Obligatoria */}
      <OneTimeInfoModal
        id="staff_ethical_rule_info"
        title="Regla ética fundamental de Toque"
        icon={<Award className="w-5 h-5 text-amber-400" />}
      >
        <div className="text-xs text-[var(--text-main)] leading-relaxed space-y-2">
          <p>
            <strong>Regla ética de Toque:</strong> Se puede premiar y motivar al staff por invitar cordialmente a dejar una reseña en Google, pero está <strong className="text-amber-400">terminantemente prohibido premiar o condicionar al cliente</strong> con descuentos o regalos a cambio de 5 estrellas (estricta política de Google).
          </p>
          <p className="text-micro text-[var(--text-muted)]">
            Cuidamos la reputación y la permanencia de tu ficha en Google Maps.
          </p>
        </div>
      </OneTimeInfoModal>

      {/* Lista del Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {staffList.map((member) => (
          <Card key={member.id} className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-headline font-bold text-base shrink-0 border ${
                member.rank === 1
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                  : member.rank === 2
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-white/10 text-white/60 border-white/10'
              }`}>
                #{member.rank}
              </div>

              <div className="min-w-0">
                <h3 className="font-headline text-body font-semibold text-white truncate">
                  {member.name}
                </h3>
                <p className="text-micro text-white/60">{member.role}</p>
                <p className="text-micro font-mono text-cyan-300 mt-0.5">
                  {getShortUrlDisplay(member.shortCode)}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="text-right">
                <span className="font-display text-title-3 font-bold text-white">
                  {member.scansThisMonth}
                </span>
                <span className="text-micro text-white/60 block">toques este mes</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedStaffForQr(member)}
                  icon={<QrCode className="w-3.5 h-3.5" />}
                >
                  Ver QR
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal de QR de Empleado */}
      {selectedStaffForQr && (
        <Dialog
          isOpen={!!selectedStaffForQr}
          onClose={() => setSelectedStaffForQr(null)}
          title={`Cartel personal de ${selectedStaffForQr.name}`}
          size="sm"
        >
          <div className="space-y-4 text-center py-2">
            <div className="p-4 bg-white rounded-xl shadow-xs border border-slate-200 inline-block">
              <QRPreview url={getShortUrl(selectedStaffForQr.shortCode)} size={160} />
            </div>

            <div>
              <p className="font-semibold text-small text-[var(--text-main)]">
                {selectedStaffForQr.name} ({selectedStaffForQr.role})
              </p>
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-small font-mono text-[var(--brand)] font-bold">
                <span>{getShortUrlDisplay(selectedStaffForQr.shortCode)}</span>
                <button
                  type="button"
                  onClick={() => handleCopyShortLink(selectedStaffForQr.shortCode)}
                  className="p-1 hover:text-[var(--text-main)] transition cursor-pointer"
                  title="Copiar enlace"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-[var(--menta)]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-micro text-[var(--text-muted)] leading-relaxed">
              Ideal para colocar en el delantal, gafete o credencial personal del colaborador.
            </p>

            <div className="pt-2 flex justify-end">
              <Button variant="ghost" onClick={() => setSelectedStaffForQr(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
