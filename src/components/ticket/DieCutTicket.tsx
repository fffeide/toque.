import React, { useState } from 'react';
import {
  Download,
  Share2,
  Clock,
  Sparkles,
  Lock,
  CheckCircle2,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { Barcode128 } from '../Barcode128';
import {
  ColorPreset,
  resolvePassBackgroundColor,
  ensure8DigitBarcode,
} from '../wallet/WalletPassCard';

export interface DieCutTicketData {
  id: string;
  businessName: string;
  businessAddress?: string;
  businessHours?: string;
  amountArs: number;
  subtotalArs?: number;
  discountArs?: number;
  cashTendered?: number;
  changeDue?: number;
  paymentMethod?: string;
  dateTime: string;
  stampAdded?: string;
  rewardNote?: string;
  itemsSummary?: string;
  items?: Array<{ name: string; quantity?: number; price: number }>;
  barcodeDigits?: [string, string, string];
  barcodeToken?: string;
  colorPreset?: string;
}

export interface DieCutTicketProps {
  ticket?: DieCutTicketData;
  receiptId?: string;
  businessName?: string;
  businessAddress?: string;
  businessHours?: string;
  total?: number;
  subtotal?: number;
  discount?: number;
  cashTendered?: number;
  changeDue?: number;
  createdAt?: string;
  items?: Array<{ name: string; quantity?: number; qty?: number; price: number }>;
  method?: string;
  stamps?: number;
  stampsRequired?: number;
  rewardText?: string;
  cardTitle?: string;
  colorPreset?: ColorPreset;
  customColor?: string;
  logoUrl?: string;
  memberName?: string;
  memberCode?: string;
  barcodeToken?: string;
  isDark?: boolean;
  onViewPass?: () => void;
  onDownloadPdf?: () => void;
  onSaveImage?: () => void;
  secondsRemaining?: number | null;
  isExpiredBlur?: boolean;
  onOpenToquecitos?: () => void;
  isRegisteredInHub?: boolean;
  clubRegisterContent?: React.ReactNode;
  hideClubSection?: boolean;
}

function formatPaymentMethodLabel(m?: string): string {
  if (!m) return 'QR / Billetera virtual';
  const low = m.toLowerCase();
  if (low === 'mercadopago' || low === 'mp_qr' || low === 'qr') return 'QR / Billetera virtual';
  if (low === 'cash' || low === 'efectivo') return 'Efectivo';
  if (low === 'card' || low === 'card_manual' || low === 'tarjeta') return 'Tarjeta';
  if (low === 'transfer' || low === 'transferencia') return 'Transferencia';
  return m;
}

export const DieCutTicket: React.FC<DieCutTicketProps> = ({
  ticket: providedTicket,
  receiptId,
  businessName,
  businessAddress,
  businessHours,
  total,
  subtotal,
  discount,
  cashTendered,
  changeDue,
  createdAt,
  items,
  method,
  stamps,
  stampsRequired,
  rewardText,
  cardTitle,
  colorPreset = 'dark',
  customColor,
  logoUrl,
  memberName,
  memberCode,
  barcodeToken,
  isDark = true,
  onViewPass,
  onDownloadPdf,
  onSaveImage,
  secondsRemaining,
  isExpiredBlur = false,
  onOpenToquecitos,
  isRegisteredInHub = false,
  clubRegisterContent,
  hideClubSection = false,
}) => {
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [clubJoinExpanded, setClubJoinExpanded] = useState(false);

  const normalizedItems = (providedTicket?.items || items || [])
    .filter((it: any) => it && typeof it.name === 'string' && it.name.trim().length > 0)
    .map((it: any) => ({
      name: it.name.trim(),
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

  const effectiveStamps = typeof stamps === 'number' ? stamps : isRegisteredInHub ? 1 : 0;
  const effectiveTarget = stampsRequired || 10;
  const effectiveReward =
    rewardText || providedTicket?.rewardNote || 'Beneficio al completar tus sellos';
  const effectiveAddress =
    (providedTicket?.businessAddress ?? businessAddress ?? '').trim() || undefined;
  const effectiveHours =
    (providedTicket?.businessHours ?? businessHours ?? '').trim() || undefined;
  const effectiveCashTendered = providedTicket?.cashTendered ?? cashTendered;
  const effectiveChangeDue = providedTicket?.changeDue ?? changeDue;

  const ticket: DieCutTicketData = providedTicket
    ? {
        ...providedTicket,
        businessAddress: effectiveAddress,
        businessHours: effectiveHours,
        cashTendered: effectiveCashTendered,
        changeDue: effectiveChangeDue,
        items: normalizedItems,
      }
    : {
        id: receiptId || 'rcp-0001',
        businessName: businessName || 'Comercio',
        businessAddress: effectiveAddress,
        businessHours: effectiveHours,
        amountArs: total ?? 0,
        subtotalArs: subtotal,
        discountArs: discount,
        cashTendered: effectiveCashTendered,
        changeDue: effectiveChangeDue,
        paymentMethod: formatPaymentMethodLabel(method),
        dateTime: formattedDate,
        stampAdded: isRegisteredInHub
          ? `+1 sello (${effectiveStamps} de ${effectiveTarget})`
          : `+1 sello disponible`,
        items: normalizedItems,
      };

  const ticketBarcode = ensure8DigitBarcode(
    barcodeToken || memberCode || providedTicket?.barcodeToken || ticket.id
  );

  const hasItems = Boolean(ticket.items && ticket.items.length > 0);
  const itemsTotalSum = hasItems
    ? ticket.items!.reduce((acc, it) => acc + (it.price || 0) * (itemQty(it)), 0)
    : ticket.amountArs;

  function itemQty(it: { quantity?: number }): number {
    return it.quantity || 1;
  }

  const computedSubtotal = ticket.subtotalArs ?? (hasItems ? itemsTotalSum : ticket.amountArs);
  const computedDiscount =
    typeof ticket.discountArs === 'number' && ticket.discountArs > 0
      ? ticket.discountArs
      : hasItems && computedSubtotal > ticket.amountArs
      ? computedSubtotal - ticket.amountArs
      : 0;
  const hasDiscount = computedDiscount > 0;

  const isCashPayment =
    (method || '').toLowerCase() === 'cash' ||
    (ticket.paymentMethod || '').toLowerCase().includes('efectivo');
  const hasCashChange =
    isCashPayment &&
    typeof ticket.cashTendered === 'number' &&
    ticket.cashTendered > 0;
  const calculatedChange = hasCashChange
    ? Math.max(0, ticket.changeDue ?? ticket.cashTendered! - ticket.amountArs)
    : 0;

  const passBgColor = resolvePassBackgroundColor(colorPreset, customColor);

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
      const itemsCount = hasItems ? Math.min(ticket.items!.length, 10) : 0;
      const baseHeight =
        560 +
        (ticket.businessAddress ? 28 : 0) +
        (ticket.businessHours ? 28 : 0) +
        (hasItems ? 60 + itemsCount * 32 + 34 : 0) +
        (hasDiscount ? 64 : 0) +
        (hasCashChange ? 68 : 0);

      const canvas = document.createElement('canvas');
      canvas.width = 760;
      canvas.height = baseHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#141414';
      ctx.strokeStyle = '#242424';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(28, 24, canvas.width - 56, canvas.height - 48, 28);
      ctx.fill();
      ctx.stroke();

      let y = 78;

      ctx.fillStyle = 'rgba(47, 179, 106, 0.15)';
      ctx.beginPath();
      ctx.roundRect(260, y - 24, 240, 34, 17);
      ctx.fill();
      ctx.fillStyle = '#2FB36A';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Comprobante de visita', 380, y - 2);
      y += 46;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px Inter, sans-serif';
      ctx.fillText('¡Gracias por tu visita!', 380, y);
      y += 48;

      if (ticket.amountArs > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Inter, sans-serif';
        ctx.fillText(`$${ticket.amountArs.toLocaleString('es-AR')}`, 380, y);
        y += 34;
      }

      ctx.fillStyle = '#9E9EA8';
      ctx.font = '500 18px Inter, sans-serif';
      ctx.fillText(ticket.dateTime, 380, y);
      y += 28;

      const drawDashedDivider = (posY: number) => {
        ctx.save();
        ctx.strokeStyle = '#2A2A2E';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(64, posY);
        ctx.lineTo(696, posY);
        ctx.stroke();
        ctx.restore();
      };

      drawDashedDivider(y);
      y += 36;

      const drawRow = (label: string, value: string, valueColor = '#FFFFFF', bold = false) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#9E9EA8';
        ctx.font = '500 18px Inter, sans-serif';
        ctx.fillText(label, 64, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = valueColor;
        ctx.font = `${bold ? 'bold' : '600'} 18px Inter, sans-serif`;
        ctx.fillText(value, 696, y);
        y += 32;
      };

      drawRow('Comercio', ticket.businessName, '#FFFFFF', true);
      if (ticket.businessAddress) {
        drawRow('Dirección', ticket.businessAddress, '#D4D4D8');
      }
      if (ticket.businessHours) {
        drawRow('Horarios', ticket.businessHours, '#D4D4D8');
      }
      drawRow('Sello sumado', ticket.stampAdded || '+1 sello', '#2FB36A', true);
      drawRow('Medio de pago', ticket.paymentMethod || formatPaymentMethodLabel(method));
      drawRow('Código de barras', ticketBarcode);

      y += 6;
      drawDashedDivider(y);
      y += 36;

      if (hasItems && ticket.items) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#9E9EA8';
        ctx.font = '600 16px Inter, sans-serif';
        ctx.fillText('Detalle de ítems', 64, y);
        ctx.textAlign = 'right';
        ctx.fillText('Importe', 696, y);
        y += 30;

        for (const item of ticket.items.slice(0, 10)) {
          ctx.textAlign = 'left';
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '500 18px Inter, sans-serif';
          ctx.fillText(`${item.quantity || 1}x ${item.name}`, 64, y);
          ctx.textAlign = 'right';
          ctx.font = '600 18px Inter, sans-serif';
          ctx.fillText(
            `$${((item.price || 0) * (item.quantity || 1)).toLocaleString('es-AR')}`,
            696,
            y
          );
          y += 32;
        }

        y += 6;
        drawDashedDivider(y);
        y += 36;
      }

      if (hasItems || hasDiscount) {
        drawRow('Subtotal', `$${computedSubtotal.toLocaleString('es-AR')}`, '#D4D4D8');
      }
      if (hasDiscount) {
        drawRow('Descuentos', `-$${computedDiscount.toLocaleString('es-AR')}`, '#2FB36A', true);
      }

      if (ticket.amountArs > 0) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 22px Inter, sans-serif';
        ctx.fillText('Total', 64, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`$${ticket.amountArs.toLocaleString('es-AR')}`, 696, y);
        y += 34;
      }

      if (hasCashChange) {
        drawRow('Pagó con', `$${ticket.cashTendered!.toLocaleString('es-AR')}`, '#D4D4D8');
        drawRow('Vuelto', `$${calculatedChange.toLocaleString('es-AR')}`, '#2FB36A', true);
      }

      y += 8;
      drawDashedDivider(y);
      y += 38;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#9E9EA8';
      ctx.font = '500 15px Inter, sans-serif';
      ctx.fillText('Comprobante de visita. No es una factura.', 380, y);

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
      text: `Comprobante de visita en ${ticket.businessName}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fallback
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
        {/* Ticket físico troquelado con muescas circulares laterales y borde inferior dentado */}
        <div
          className={`relative w-full rounded-t-3xl rounded-b-xl p-5 sm:p-6 pb-8 overflow-hidden transition-colors shadow-xl space-y-4 ${
            isDark
              ? 'bg-[#141414] border border-[#242424] text-white'
              : 'bg-white border border-zinc-200/80 text-[#111111]'
          }`}
        >
          {/* Muescas circulares laterales de troquel */}
          <div
            aria-hidden="true"
            className="w-6 h-6 rounded-full bg-[#0A0A0A] border border-[#242424] absolute -left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="w-6 h-6 rounded-full bg-[#0A0A0A] border border-[#242424] absolute -right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />

          {/* 1. Cabecera con logo del comercio arriba, "¡Gracias por tu visita!", "Comprobante de visita", monto y fecha */}
          <div className="flex flex-col items-center text-center space-y-2 pb-4 border-b border-dashed border-current/15">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={ticket.businessName}
                className="w-12 h-12 rounded-2xl object-cover border border-white/15 shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-[#D95B26]/15 border border-[#D95B26]/30 text-[#D95B26] font-extrabold text-lg flex items-center justify-center">
                {ticket.businessName.charAt(0)}
              </div>
            )}

            <div className="space-y-0.5">
              <p className="text-base font-bold">¡Gracias por tu visita!</p>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2FB36A]/15 border border-[#2FB36A]/30 text-[#2FB36A] text-[11px] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Comprobante de visita</span>
              </span>
            </div>

            {ticket.amountArs > 0 && (
              <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight tabular-nums pt-0.5">
                ${ticket.amountArs.toLocaleString('es-AR')}
              </div>
            )}

            <p className={`text-xs ${isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}`}>
              {ticket.dateTime}
            </p>
          </div>

          {/* 2. Comercio, sello sumado, medio de pago y número de comprobante */}
          <div className="space-y-2 text-xs pb-4 border-b border-dashed border-current/15">
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
                {ticket.businessHours && (
                  <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}`}>
                    {ticket.businessHours}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className={isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}>Sello sumado</span>
              <span className="font-semibold text-[#2FB36A]">
                {ticket.stampAdded || `+1 sello (${effectiveStamps} de ${effectiveTarget})`}
              </span>
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

          {/* 3. Detalle de ítems — SOLO se muestra si existen ítems reales cargados */}
          {hasItems && (
            <div className="space-y-2 pb-4 border-b border-dashed border-current/15">
              <div className="flex items-center justify-between text-[11px] font-semibold opacity-70">
                <span>Detalle de ítems</span>
                <span>Importe</span>
              </div>

              <div className="space-y-1.5 text-xs">
                {ticket.items!.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-2">
                    <span>
                      <strong className="font-mono">{item.quantity || 1}x</strong> {item.name}
                    </span>
                    <span className="font-mono font-semibold">
                      ${((item.price || 0) * (item.quantity || 1)).toLocaleString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Subtotal, Descuentos, Total y Efectivo/Vuelto */}
          {(hasItems || hasDiscount || ticket.amountArs > 0 || hasCashChange) && (
            <div className="space-y-1.5 text-xs pb-4 border-b border-dashed border-current/15">
              {(hasItems || hasDiscount) && (
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}>Subtotal</span>
                  <span className="font-mono">${computedSubtotal.toLocaleString('es-AR')}</span>
                </div>
              )}

              {hasDiscount && (
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}>Descuentos</span>
                  <span className="font-mono text-[#2FB36A]">
                    -${computedDiscount.toLocaleString('es-AR')}
                  </span>
                </div>
              )}

              {ticket.amountArs > 0 && (
                <div className="flex items-center justify-between pt-0.5 text-sm font-extrabold">
                  <span>Total</span>
                  <span className="font-mono text-base">
                    ${ticket.amountArs.toLocaleString('es-AR')}
                  </span>
                </div>
              )}

              {hasCashChange && (
                <div className="pt-2 mt-2 border-t border-current/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}>Pagó con</span>
                    <span className="font-mono font-semibold">
                      ${ticket.cashTendered!.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'}>Vuelto</span>
                    <span className="font-mono font-bold text-[#2FB36A]">
                      ${calculatedChange.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Código de barras CODE128 con su número de 8 dígitos debajo */}
          <div className="pt-1 pb-2 border-b border-dashed border-current/15">
            <Barcode128 value={ticketBarcode} />
          </div>

          {/* 6. Vista previa de la tarjeta de sellos del comercio en el comprobante */}
          {!hideClubSection && (
            <div className="space-y-2.5">
              <div
                style={{ backgroundColor: passBgColor }}
                className="rounded-2xl p-4 border border-white/15 text-white shadow-md space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={ticket.businessName}
                        className="w-7 h-7 rounded-lg object-cover bg-black/20 border border-white/10 shrink-0"
                      />
                    ) : null}
                    <span className="text-xs font-semibold truncate">
                      {cardTitle || `Tarjeta de sellos de ${ticket.businessName}`}
                    </span>
                  </div>
                  {memberName ? (
                    <div className="text-right shrink-0">
                      <span className="block text-[10px] text-white/65 font-medium">Cliente</span>
                      <span className="block text-xs font-medium truncate max-w-[95px]">
                        {memberName}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-medium text-white/70">
                      Sellos acumulados
                    </div>
                    <div className="text-xl font-bold leading-none mt-0.5">
                      {effectiveStamps} / {effectiveTarget}
                    </div>
                  </div>
                  <div className="text-right min-w-0 flex-1">
                    <div className="text-[10px] font-medium text-white/70">
                      Premio disponible
                    </div>
                    <div className="text-xs font-medium text-white/95 truncate mt-0.5">
                      {effectiveReward}
                    </div>
                  </div>
                </div>

                {!isRegisteredInHub ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (clubRegisterContent) {
                        setClubJoinExpanded((prev) => !prev);
                      } else if (onViewPass) {
                        onViewPass();
                      }
                    }}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-[#D95B26] hover:bg-[#E56732] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <span>Guardar mi tarjeta</span>
                    {clubRegisterContent && (
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-300 ${
                          clubJoinExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </button>
                ) : (
                  onViewPass && (
                    <button
                      type="button"
                      onClick={onViewPass}
                      className="w-full py-2 px-3 rounded-xl bg-white/15 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Ver mi tarjeta
                    </button>
                  )
                )}
              </div>

              {!isRegisteredInHub && clubRegisterContent && (
                <div
                  className={`grid transition-all duration-300 ease-out overflow-hidden ${
                    clubJoinExpanded
                      ? 'grid-rows-[1fr] opacity-100 mt-2'
                      : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="min-h-0">{clubRegisterContent}</div>
                </div>
              )}
            </div>
          )}

          {/* 7. Pie obligatorio */}
          <p
            className={`text-center text-[11px] pt-1 ${
              isDark ? 'text-[#9E9EA8]' : 'text-zinc-500'
            }`}
          >
            Comprobante de visita. No es una factura.
          </p>

          {/* Borde inferior dentado estilo ticket troquelado */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 right-0 h-3 flex overflow-hidden pointer-events-none"
          >
            {Array.from({ length: 28 }).map((_, idx) => (
              <div
                key={idx}
                className="w-4 h-4 -mb-2 rounded-full bg-[#0A0A0A] border border-[#242424] shrink-0"
              />
            ))}
          </div>
        </div>

        {/* Botones "Descargar" y "Compartir" */}
        <div className="grid grid-cols-2 gap-2.5 mt-3 print:hidden">
          <button
            type="button"
            onClick={handleDownload}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-xs font-bold border transition-colors cursor-pointer ${
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
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-xs font-bold border transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#141414] border-[#242424] hover:bg-[#1C1C1F] text-white'
                : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800'
            }`}
          >
            <Share2 className="w-4 h-4 text-[#D95B26]" />
            <span>{copiedFeedback ? 'Enlace copiado' : 'Compartir'}</span>
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
                  : 'Ingresá a Toquecitos o guardá tu tarjeta abajo para conservarlo en tu cuenta.'}
              </p>
            </div>
            {onOpenToquecitos && (
              <button
                type="button"
                onClick={onOpenToquecitos}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#D95B26] hover:bg-[#E56732] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Abrir en Toquecitos</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
