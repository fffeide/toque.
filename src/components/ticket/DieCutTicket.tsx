import React, { useState } from 'react';
import {
  Download,
  Share2,
  Clock,
  Sparkles,
  Lock,
  CheckCircle2,
  MapPin,
  Award,
} from 'lucide-react';

export interface DieCutTicketData {
  id: string;
  businessName: string;
  businessAddress?: string;
  amountArs: number;
  subtotalArs?: number;
  discountArs?: number;
  paymentMethod?: string;
  dateTime: string;
  stampAdded?: string;
  rewardNote?: string;
  itemsSummary: string;
  items?: Array<{ name: string; quantity?: number; price: number }>;
  barcodeDigits?: [string, string, string];
  colorPreset?: string;
}

export interface DieCutTicketProps {
  ticket?: DieCutTicketData;
  receiptId?: string;
  businessName?: string;
  businessAddress?: string;
  total?: number;
  subtotal?: number;
  discount?: number;
  createdAt?: string;
  items?: Array<{ name: string; quantity?: number; qty?: number; price: number }>;
  method?: string;
  stamps?: number;
  stampsRequired?: number;
  isDark?: boolean;
  onViewPass?: () => void;
  onDownloadPdf?: () => void;
  onSaveImage?: () => void;
  secondsRemaining?: number | null;
  isExpiredBlur?: boolean;
  onOpenToquecitos?: () => void;
  isRegisteredInHub?: boolean;
}

function formatPaymentMethodLabel(m?: string): string {
  if (!m) return 'QR / Billetera virtual';
  const low = m.toLowerCase();
  if (low === 'mercadopago' || low === 'mp_qr' || low === 'qr') return 'QR / Billetera virtual';
  if (low === 'cash' || low === 'efectivo') return 'Efectivo';
  if (low === 'card' || low === 'tarjeta') return 'Tarjeta';
  return m;
}

export const DieCutTicket: React.FC<DieCutTicketProps> = ({
  ticket: providedTicket,
  receiptId,
  businessName,
  businessAddress,
  total,
  subtotal,
  discount,
  createdAt,
  items,
  method,
  stamps,
  stampsRequired,
  isDark = true,
  onViewPass,
  onDownloadPdf,
  onSaveImage,
  secondsRemaining,
  isExpiredBlur = false,
  onOpenToquecitos,
  isRegisteredInHub = false,
}) => {
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const normalizedItems = (providedTicket?.items || items || []).map((it: any) => ({
    name: it.name,
    quantity: it.quantity ?? it.qty ?? 1,
    price: it.price ?? 0,
  }));

  const formattedDate = (() => {
    if (providedTicket?.dateTime) return providedTicket.dateTime;
    if (!createdAt) return 'Hoy';
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return createdAt;
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  })();

  const effectiveStamps = typeof stamps === 'number' ? stamps : 4;
  const effectiveTarget = stampsRequired || 5;

  const ticket: DieCutTicketData = providedTicket || {
    id: receiptId || 'rcp-burger-1001',
    businessName: businessName || 'La Burger',
    businessAddress: businessAddress,
    amountArs: total ?? 0,
    subtotalArs: subtotal,
    discountArs: discount,
    paymentMethod: formatPaymentMethodLabel(method),
    dateTime: formattedDate,
    stampAdded: `+1 sello, ${effectiveStamps} / ${effectiveTarget}`,
    itemsSummary:
      normalizedItems.length > 0
        ? normalizedItems.map((i) => `${i.quantity || 1}x ${i.name}`).join(' · ')
        : 'Consumo en local',
    items: normalizedItems,
  };

  const itemsTotalSum =
    ticket.items && ticket.items.length > 0
      ? ticket.items.reduce((acc, it) => acc + (it.price || 0) * (it.quantity || 1), 0)
      : ticket.amountArs;

  const computedSubtotal = ticket.subtotalArs ?? Math.max(itemsTotalSum, ticket.amountArs);
  const computedDiscount =
    ticket.discountArs ?? Math.max(0, computedSubtotal - ticket.amountArs);

  const handleDownload = () => {
    if (onSaveImage) {
      onSaveImage();
      return;
    }
    if (onDownloadPdf) {
      onDownloadPdf();
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 760;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, 760, 1080);

      ctx.fillStyle = '#2FB36A';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Cobro realizado', 380, 75);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 56px Inter, sans-serif';
      ctx.fillText(`$${ticket.amountArs.toLocaleString('es-AR')}`, 380, 145);

      ctx.fillStyle = '#A1A1AA';
      ctx.font = '500 20px Inter, sans-serif';
      ctx.fillText(ticket.dateTime, 380, 185);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px Inter, sans-serif';
      ctx.fillText(ticket.businessName, 380, 235);
      if (ticket.businessAddress) {
        ctx.fillStyle = '#A1A1AA';
        ctx.font = '500 18px Inter, sans-serif';
        ctx.fillText(ticket.businessAddress, 380, 265);
      }

      ctx.strokeStyle = '#2E2E32';
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(60, 300);
      ctx.lineTo(700, 300);
      ctx.stroke();

      ctx.textAlign = 'left';
      let y = 350;
      ctx.fillStyle = '#8E8E93';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText(`Medio de pago: ${ticket.paymentMethod || formatPaymentMethodLabel(method)}`, 60, y);
      y += 34;
      ctx.fillText(`N.º de comprobante: ${ticket.id}`, 60, y);
      y += 50;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText('Detalle de ítems', 60, y);
      y += 34;

      const listToDraw =
        ticket.items && ticket.items.length > 0
          ? ticket.items
          : [{ name: 'Consumo en local', quantity: 1, price: ticket.amountArs }];

      for (const item of listToDraw.slice(0, 6)) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#E4E4E7';
        ctx.font = '500 20px Inter, sans-serif';
        ctx.fillText(`${item.quantity || 1}x ${item.name}`, 60, y);
        ctx.textAlign = 'right';
        ctx.fillText(
          `$${((item.price || 0) * (item.quantity || 1)).toLocaleString('es-AR')}`,
          700,
          y
        );
        y += 32;
      }

      y += 20;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#A1A1AA';
      ctx.fillText('Subtotal', 60, y);
      ctx.textAlign = 'right';
      ctx.fillText(`$${computedSubtotal.toLocaleString('es-AR')}`, 700, y);
      y += 30;

      ctx.textAlign = 'left';
      ctx.fillText('Descuentos', 60, y);
      ctx.textAlign = 'right';
      ctx.fillText(`-$${computedDiscount.toLocaleString('es-AR')}`, 700, y);
      y += 36;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillText('Total', 60, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#2FB36A';
      ctx.fillText(`$${ticket.amountArs.toLocaleString('es-AR')}`, 700, y);
      y += 55;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#2FB36A';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText(ticket.stampAdded || `+1 sello, ${effectiveStamps} / ${effectiveTarget}`, 380, y);

      ctx.fillStyle = '#71717A';
      ctx.font = '500 16px Inter, sans-serif';
      ctx.fillText('Comprobante de compra. No es una factura.', 380, 1030);

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `comprobante-${ticket.id.toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      try {
        window.print();
      } catch {
        // ignore
      }
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/r/${encodeURIComponent(ticket.id)}`;
    const shareData = {
      title: `Comprobante de ${ticket.businessName}`,
      text: `Cobro realizado por $${ticket.amountArs.toLocaleString('es-AR')} en ${ticket.businessName}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fallback al portapapeles
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      {typeof secondsRemaining === 'number' && !isExpiredBlur && (
        <div className="mb-2.5 flex items-center justify-between px-3.5 py-2 rounded-2xl bg-[#141414] border border-[#242424] text-xs">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Comprobante recién emitido
          </span>
          <span className="flex items-center gap-1 text-[#8E8E93] font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-[#D95B26]" />
            {Math.floor(secondsRemaining / 60)}:
            {String(secondsRemaining % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      <div
        className={`transition-all duration-500 ${
          isExpiredBlur ? 'blur-md pointer-events-none select-none opacity-65' : ''
        }`}
      >
        {/* Comprobante completo estilo billetera virtual */}
        <div
          className={`relative w-full rounded-3xl p-6 overflow-hidden transition-colors shadow-xl space-y-5 ${
            isDark
              ? 'bg-[#141414] border border-[#242424] text-white'
              : 'bg-white border border-zinc-200/80 text-[#111111]'
          }`}
        >
          {/* 1. Estado ("Cobro realizado"), monto grande, fecha y hora */}
          <div className="flex flex-col items-center text-center space-y-2 pb-4 border-b border-dashed border-current/15">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2FB36A]/15 border border-[#2FB36A]/30 text-[#2FB36A] text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Cobro realizado</span>
            </div>

            <div className="text-4xl font-extrabold font-mono tracking-tight tabular-nums pt-1">
              ${ticket.amountArs.toLocaleString('es-AR')}
            </div>

            <p className={`text-xs ${isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}`}>
              {ticket.dateTime}
            </p>
          </div>

          {/* 2. Comercio (nombre y dirección si hay), medio de pago y número de comprobante */}
          <div className="space-y-2.5 text-xs pb-4 border-b border-dashed border-current/15">
            <div className="flex items-start justify-between gap-3">
              <span className={isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}>Comercio</span>
              <div className="text-right">
                <p className="font-bold">{ticket.businessName}</p>
                {ticket.businessAddress && (
                  <p
                    className={`text-[11px] flex items-center justify-end gap-1 mt-0.5 ${
                      isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'
                    }`}
                  >
                    <MapPin className="w-3 h-3 text-[#D95B26] shrink-0" />
                    <span>{ticket.businessAddress}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className={isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}>Medio de pago</span>
              <span className="font-semibold">
                {ticket.paymentMethod || formatPaymentMethodLabel(method)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className={isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}>
                N.º de comprobante
              </span>
              <span className="font-mono font-semibold">{ticket.id}</span>
            </div>
          </div>

          {/* 3. Detalle de ítems con cantidad y precio */}
          <div className="space-y-2.5 pb-4 border-b border-dashed border-current/15">
            <div className="flex items-center justify-between text-[11px] font-semibold opacity-70">
              <span>Detalle de ítems</span>
              <span>Importe</span>
            </div>

            <div className="space-y-2 text-xs">
              {ticket.items && ticket.items.length > 0 ? (
                ticket.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-2">
                    <span>
                      <strong className="font-mono">{item.quantity || 1}x</strong> {item.name}
                    </span>
                    <span className="font-mono font-semibold">
                      ${((item.price || 0) * (item.quantity || 1)).toLocaleString('es-AR')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span>1x {ticket.itemsSummary || 'Consumo en local'}</span>
                  <span className="font-mono font-semibold">
                    ${ticket.amountArs.toLocaleString('es-AR')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 4. Subtotal, descuentos y total */}
          <div className="space-y-1.5 text-xs pb-4 border-b border-dashed border-current/15">
            <div className="flex items-center justify-between">
              <span className={isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}>Subtotal</span>
              <span className="font-mono">${computedSubtotal.toLocaleString('es-AR')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}>Descuentos</span>
              <span className="font-mono text-[#2FB36A]">
                -${computedDiscount.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 text-sm font-extrabold">
              <span>Total</span>
              <span className="font-mono text-base">
                ${ticket.amountArs.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* 5. Recuadro del sello sumado ("+1 sello, 4 / 5") */}
          <div
            className={`rounded-2xl p-3.5 flex items-center justify-between gap-3 ${
              isDark
                ? 'bg-[#0A0A0A] border border-[#242424]'
                : 'bg-[#F5F6FA] border border-zinc-200/70'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#D95B26]/15 border border-[#D95B26]/30 text-[#D95B26] flex items-center justify-center shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">{ticket.businessName}</p>
                <p className="text-xs text-[#2FB36A] font-extrabold mt-0.5 truncate">
                  {ticket.stampAdded || `+1 sello, ${effectiveStamps} / ${effectiveTarget}`}
                </p>
              </div>
            </div>
            {onViewPass && (
              <button
                type="button"
                onClick={onViewPass}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl transition-colors shrink-0 cursor-pointer ${
                  isDark
                    ? 'bg-[#1C1C22] text-white hover:bg-[#282830]'
                    : 'bg-white text-zinc-800 shadow-sm'
                }`}
              >
                Ver tarjeta
              </button>
            )}
          </div>

          {/* 6. Pie obligatorio */}
          <p
            className={`text-center text-[11px] pt-1 ${
              isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'
            }`}
          >
            Comprobante de compra. No es una factura.
          </p>
        </div>

        {/* Botones "Descargar" y "Compartir" */}
        <div className="grid grid-cols-2 gap-2.5 mt-3 print:hidden">
          <button
            type="button"
            onClick={handleDownload}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-bold border transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#141414] border-[#242424] hover:bg-[#1C1C1F] text-white'
                : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800'
            }`}
          >
            <Download className="w-4 h-4 text-[#D95B26]" />
            <span>Descargar</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-bold border transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#141414] border-[#242424] hover:bg-[#1C1C1F] text-white'
                : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800'
            }`}
          >
            <Share2 className="w-4 h-4 text-[#D95B26]" />
            <span>{copiedFeedback ? 'Link copiado' : 'Compartir'}</span>
          </button>
        </div>
      </div>

      {/* Overlay cuando se cumplen los 2 minutos en el Hub */}
      {isExpiredBlur && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-xs w-full rounded-3xl bg-[#141414]/95 border border-[#242424] p-5 shadow-2xl space-y-3 backdrop-blur-md">
            <div className="w-10 h-10 rounded-2xl bg-[#D95B26]/15 border border-[#D95B26]/30 text-[#D95B26] flex items-center justify-center mx-auto">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">
                Tu comprobante se resguardó por seguridad
              </h4>
              <p className="text-xs text-[#8E8E93] leading-relaxed">
                {isRegisteredInHub
                  ? 'Ya quedó guardado en tu cuenta de Toquecitos.'
                  : 'Ingresá a Toquecitos o registrá tu tarjeta abajo para conservarlo en tu cuenta.'}
              </p>
            </div>
            {onOpenToquecitos && (
              <button
                type="button"
                onClick={onOpenToquecitos}
                className="w-full py-3 px-4 rounded-2xl bg-[#D95B26] hover:bg-[#E56732] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ingresar a Toquecitos para verlo</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
