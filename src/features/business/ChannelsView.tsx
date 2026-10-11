/**
 * Toque — Canales de Reseñas (ChannelsView)
 * Disponible tras feature flag 'channels':
 * - Enlaces y códigos para WhatsApp, ticket/factura, Instagram y mesa
 * - Comparativa de rendimiento y conversión
 */

import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { api, ChannelMetric } from '../../api';
import { useDataQuery } from '../../hooks/useDataQuery';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { OneTimeInfoModal } from '../../components/ui/OneTimeInfoModal';
import { formatNumber } from '../../lib/formatters';
import { useToast } from '../../components/ui/Toast';
import { getShortUrl, getShortUrlDisplay } from '../../lib/urls';
import {
  MessageSquare,
  Receipt,
  Instagram,
  QrCode,
  Copy,
  Check,
  TrendingUp,
  Share2,
  ExternalLink,
} from 'lucide-react';

export const ChannelsView: React.FC = () => {
  const { tenant } = useAuth();
  const { success } = useToast();
  const businessId = tenant?.type === 'business' ? tenant.id : 'biz-esquina';
  const [copiedChannelId, setCopiedChannelId] = useState<string | null>(null);

  const {
    data: channels,
    isLoading,
    isError,
    error,
    refetch,
  } = useDataQuery<ChannelMetric[]>({
    queryFn: () => api.listChannels(businessId),
  });

  const handleCopyLink = (channel: ChannelMetric) => {
    const url = getShortUrl(channel.shortCode);
    navigator.clipboard.writeText(url);
    setCopiedChannelId(channel.id);
    setTimeout(() => setCopiedChannelId(null), 2000);
    success('Enlace de canal copiado', url);
  };

  if (isError) {
    return (
      <div className="py-12">
        <ErrorState
          title="No pudimos cargar los canales"
          message={error?.message}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (isLoading || !channels) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-64 h-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    );
  }

  const totalChannelScans = channels.reduce((acc, c) => acc + c.scansCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-headline font-bold text-white tracking-tight">
              Canales de Escaneo
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
              Próximamente
            </span>
          </div>
          <p className="text-xs text-white/70 mt-0.5">
            Estamos preparando la integración guiada multicanal para medir reseñas desde WhatsApp, comprobantes e Instagram.
          </p>
        </div>
      </div>

      {/* Modal Popup Informativo (Aparece una sola vez) */}
      <OneTimeInfoModal
        id="channels_guide_info"
        title="Guía para el cliente: ¿Cómo funcionará cada canal cuando esté habilitado?"
        icon={<Share2 className="w-5 h-5 text-cyan-400" />}
      >
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> 1. WhatsApp Post-Venta
            </span>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Disparará automáticamente un mensaje cordial 30 minutos después de abonar, invitando a calificar con 1 toque.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
            <span className="font-semibold text-rose-400 flex items-center gap-1.5">
              <Instagram className="w-3.5 h-3.5" /> 2. Instagram Bio / Stories
            </span>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Un enlace corto rastreable con filtro de UTMs para saber cuántas reseñas provienen de tus seguidores.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> 3. Ticket / Factura Impresa
            </span>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Snippet QR listo para agregar al pie de tu ticketera térmica (58mm/80mm) con el mensaje de agradecimiento.
            </p>
          </div>
        </div>
      </OneTimeInfoModal>

      {/* Tarjetas de Canales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {channels.map((ch) => {
          const sharePercentage = totalChannelScans > 0 ? Math.round((ch.scansCount / totalChannelScans) * 100) : 0;
          return (
            <Card key={ch.id} className="p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/15">
                    {ch.id.includes('whatsapp') ? (
                      <MessageSquare className="w-4 h-4 text-emerald-300" />
                    ) : ch.id.includes('receipt') ? (
                      <Receipt className="w-4 h-4 text-amber-300" />
                    ) : ch.id.includes('instagram') ? (
                      <Instagram className="w-4 h-4 text-rose-400" />
                    ) : (
                      <QrCode className="w-4 h-4 text-indigo-300" />
                    )}
                  </div>

                  <span className="text-xs font-medium text-white/60">
                    {sharePercentage}% del total
                  </span>
                </div>

                <h3 className="font-headline text-base font-semibold text-white">
                  {ch.name}
                </h3>
                <p className="text-micro text-white/60 font-mono mt-0.5">
                  {getShortUrlDisplay(ch.shortCode)}
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-micro text-white/60">Escaneos</span>
                  <span className="font-display text-title-3 font-bold text-white">
                    {formatNumber(ch.scansCount)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-micro text-white/60">
                  <span>Reseñas est.</span>
                  <strong className="text-white font-semibold">
                    ~{ch.estimatedReviews} ({ch.conversionRate}%)
                  </strong>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => handleCopyLink(ch)}
                  icon={copiedChannelId === ch.id ? <Check className="w-3.5 h-3.5 text-[var(--menta)]" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedChannelId === ch.id ? 'Copiado' : 'Copiar enlace'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Gráfico / Comparativa de rendimiento */}
      <Card className="p-6">
        <h3 className="font-display text-small font-semibold text-[var(--text-main)] mb-4">
          ¿Cuál canal rinde más?
        </h3>

        <div className="space-y-4">
          {channels.map((ch) => {
            const pct = totalChannelScans > 0 ? (ch.scansCount / totalChannelScans) * 100 : 0;
            return (
              <div key={ch.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-small">
                  <span className="font-medium text-[var(--text-main)]">{ch.name}</span>
                  <span className="text-micro text-[var(--text-muted)]">
                    {formatNumber(ch.scansCount)} escaneos ({Math.round(pct)}%)
                  </span>
                </div>
                <div className="h-3 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--brand)] transition-all duration-500"
                    style={{ width: `${Math.max(5, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
