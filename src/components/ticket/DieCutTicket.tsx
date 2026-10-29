import React from 'react';
import { Download, Image as ImageIcon, Clock, Sparkles, Lock } from 'lucide-react';

export interface DieCutTicketData {
  id: string;
  businessName: string;
  amountArs: number;
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
  total?: number;
  createdAt?: string;
  items?: Array<{ name: string; quantity?: number; qty?: number; price: number }>;
  method?: string;
  stamps?: number;
  stampsRequired?: number;
  isDark?: boolean;
  onViewPass?: () => void;
  onDownloadPdf?: () => void;
  onSaveImage?: () => void;
  /** Si se usa en el Hub: segundos restantes antes de los 2 minutos */
  secondsRemaining?: number | null;
  /** Si ya pasaron los 2 minutos en el Hub, se aplica blur y aparece el botón a Toquecitos */
  isExpiredBlur?: boolean;
  onOpenToquecitos?: () => void;
  isRegisteredInHub?: boolean;
}

function buildBarcodeDigits(id: string, amount: number): [string, string, string] {
  const numericHash = id
    .split('')
    .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 17), Math.round(amount || 0));
  const part1 = '7';
  const part2 = String(790000 + (numericHash % 9999)).padStart(6, '0');
  const part3 = String(100000 + ((numericHash * 31) % 899999)).padStart(6, '0');
  return [part1, part2, part3];
}

export const DieCutTicket: React.FC<DieCutTicketProps> = ({
  ticket: providedTicket,
  receiptId,
  businessName,
  total,
  createdAt,
  items,
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
      hour: '2-digit',
      minute: '2-digit',
    });
  })();

  const ticket: DieCutTicketData = providedTicket || {
    id: receiptId || 'TQ-001',
    businessName: businessName || 'Comercio adherido',
    amountArs: total ?? 0,
    dateTime: formattedDate,
    stampAdded:
      typeof stamps === 'number'
        ? `+1 Sello acreditado (${stamps}/${stampsRequired || 10})`
        : '+1 Sello acreditado',
    itemsSummary:
      normalizedItems.length > 0
        ? normalizedItems.map((i) => `${i.quantity || 1}x ${i.name}`).join(' · ')
        : 'Consumo general en local',
    items: normalizedItems,
  };

  const digits =
    ticket.barcodeDigits || buildBarcodeDigits(ticket.id || 'TQ-001', ticket.amountArs);

  const handleDefaultPrintPdf = () => {
    if (onDownloadPdf) {
      onDownloadPdf();
      return;
    }
    try {
      window.print();
    } catch {
      // ignore
    }
  };

  const handleDefaultSaveImage = () => {
    if (onSaveImage) {
      onSaveImage();
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 980;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, 720, 980);

      ctx.fillStyle = '#D95B26';
      ctx.fillRect(0, 0, 720, 16);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 34px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('¡Gracias por tu visita!', 360, 110);

      ctx.fillStyle = '#A1A1AA';
      ctx.font = '500 22px Inter, sans-serif';
      ctx.fillText(`Comprobante digital · ${ticket.businessName}`, 360, 155);

      ctx.strokeStyle = '#2E2E32';
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(60, 200);
      ctx.lineTo(660, 200);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#8E8E93';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText('N.º de comprobante', 60, 265);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(ticket.id, 60, 300);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#8E8E93';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText('Monto', 660, 265);
      ctx.fillStyle = '#2FB36A';
      ctx.font = 'bold 34px Inter, sans-serif';
      ctx.fillText(`$${ticket.amountArs.toLocaleString('es-AR')}`, 660, 305);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#8E8E93';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText('Fecha y hora', 60, 380);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 22px Inter, sans-serif';
      ctx.fillText(ticket.dateTime, 60, 415);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#8E8E93';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText('Detalle', 660, 380);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '500 22px Inter, sans-serif';
      ctx.fillText(ticket.itemsSummary.slice(0, 36), 660, 415);

      if (ticket.stampAdded) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillText(`${ticket.businessName} · ${ticket.stampAdded}`, 360, 520);
      }

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `ticket-${ticket.id.toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      {/* Barra superior opcional con contador de 2 minutos en el Hub */}
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

      {/* Contenedor del Ticket Troquelado (con blur si vencieron los 2 minutos en el Hub) */}
      <div
        className={`transition-all duration-500 ${
          isExpiredBlur ? 'blur-md pointer-events-none select-none opacity-65' : ''
        }`}
      >
        <div
          className={`relative w-full rounded-t-[26px] pt-6 pb-8 overflow-hidden transition-colors shadow-xl ${
            isDark
              ? 'bg-[#141414] border border-[#242424] text-white'
              : 'bg-white border border-zinc-200/80 text-[#111111]'
          }`}
        >
          {/* Muescas semicirculares laterales alineadas con la línea punteada */}
          <div
            className={`absolute top-[132px] -left-3 w-6 h-6 rounded-full ${
              isDark
                ? 'bg-[#0A0A0A] border-r border-[#242424]'
                : 'bg-[#F7F7F9] border-r border-zinc-200'
            }`}
          />
          <div
            className={`absolute top-[132px] -right-3 w-6 h-6 rounded-full ${
              isDark
                ? 'bg-[#0A0A0A] border-l border-[#242424]'
                : 'bg-[#F7F7F9] border-l border-zinc-200'
            }`}
          />

          {/* Encabezado de confirmación */}
          <div className="flex flex-col items-center text-center px-6 pb-5">
            <div className="text-3xl mb-2 select-none">🎉</div>
            <h3 className="text-lg font-bold tracking-tight">¡Gracias por tu visita!</h3>
            <p
              className={`text-xs mt-0.5 max-w-[240px] ${
                isDark ? 'text-[#8E8E93]' : 'text-zinc-500'
              }`}
            >
              Tu comprobante y tu visita en {ticket.businessName} quedaron registrados
            </p>
          </div>

          {/* Primera línea divisoria punteada */}
          <div
            className={`w-[84%] mx-auto border-t border-dashed my-1 ${
              isDark ? 'border-[#2E2E32]' : 'border-zinc-300'
            }`}
          />

          {/* Datos del comprobante */}
          <div className="px-6 py-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p
                  className={`text-[10px] tracking-wider font-semibold ${
                    isDark ? 'text-[#8E8E93]' : 'text-zinc-400'
                  }`}
                >
                  N.º de comprobante
                </p>
                <p className="text-xs font-semibold mt-0.5 font-mono">{ticket.id}</p>
              </div>
              <div className="text-right">
                <p
                  className={`text-[10px] tracking-wider font-semibold ${
                    isDark ? 'text-[#8E8E93]' : 'text-zinc-400'
                  }`}
                >
                  Monto
                </p>
                <p className="text-sm font-bold mt-0.5">
                  ${ticket.amountArs.toLocaleString('es-AR')}
                </p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`text-[10px] tracking-wider font-semibold ${
                    isDark ? 'text-[#8E8E93]' : 'text-zinc-400'
                  }`}
                >
                  Fecha y hora
                </p>
                <p className="text-xs font-semibold mt-0.5">{ticket.dateTime}</p>
              </div>
              <div className="text-right max-w-[58%]">
                <p
                  className={`text-[10px] tracking-wider font-semibold ${
                    isDark ? 'text-[#8E8E93]' : 'text-zinc-400'
                  }`}
                >
                  Detalle
                </p>
                <p className="text-xs font-medium mt-0.5 leading-snug">{ticket.itemsSummary}</p>
              </div>
            </div>

            {/* Desglose de ítems si hay más de 1 ítem */}
            {ticket.items && ticket.items.length > 0 && (
              <div
                className={`rounded-xl p-3 space-y-1.5 text-xs ${
                  isDark
                    ? 'bg-[#0A0A0A]/60 border border-[#242424]'
                    : 'bg-zinc-50 border border-zinc-200/70'
                }`}
              >
                {ticket.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-2">
                    <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                      {item.quantity || 1}x {item.name}
                    </span>
                    <span className="font-mono font-semibold">
                      ${((item.price || 0) * (item.quantity || 1)).toLocaleString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Recuadro interno: Comercio + Sello sumado en Toquecitos */}
            <div
              className={`rounded-2xl p-3.5 flex items-center justify-between gap-3 ${
                isDark
                  ? 'bg-[#1C1C1F] border border-[#2A2A2E]'
                  : 'bg-[#F5F6FA] border border-zinc-200/70'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#D95B26] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {(ticket.businessName || 'T')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-tight truncate">{ticket.businessName}</p>
                  <p className="text-[11px] text-emerald-500 font-semibold mt-0.5 truncate">
                    {ticket.stampAdded || '+1 sello sumado en tu visita'}
                  </p>
                </div>
              </div>
              {onViewPass && (
                <button
                  type="button"
                  onClick={onViewPass}
                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-colors shrink-0 cursor-pointer ${
                    isDark
                      ? 'bg-[#2A2A2E] text-white hover:bg-[#343438]'
                      : 'bg-white text-zinc-800 shadow-sm'
                  }`}
                >
                  Ver pase
                </button>
              )}
            </div>
          </div>

          {/* Segunda línea divisoria punteada */}
          <div
            className={`w-full border-t border-dashed my-2 ${
              isDark ? 'border-[#2E2E32]' : 'border-zinc-300'
            }`}
          />

          {/* Código de barras inferior del comprobante */}
          <div className="px-8 pt-3 pb-2 flex flex-col items-center">
            <div className="flex items-end justify-center gap-[2px] w-full h-12">
              {[
                3, 1, 4, 2, 1, 3, 5, 1, 2, 2, 1, 4, 1, 2, 3, 1, 4, 2, 1, 5, 2, 1, 3, 2, 1, 4, 2,
                1, 3, 1, 2, 4,
              ].map((w, i) => (
                <div
                  key={i}
                  className={`h-full rounded-[0.5px] ${isDark ? 'bg-white' : 'bg-[#111111]'}`}
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
            <div
              className={`flex justify-between w-full px-3 mt-1.5 font-mono text-[10px] tracking-[0.2em] ${
                isDark ? 'text-[#8E8E93]' : 'text-zinc-500'
              }`}
            >
              <span>{digits[0]}</span>
              <span>{digits[1]}</span>
              <span>{digits[2]}</span>
            </div>
          </div>

          {/* Borde inferior troquelado con recortes circulares */}
          <div className="absolute -bottom-2.5 left-0 w-full flex justify-between px-2">
            {[...Array(13)].map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full ${isDark ? 'bg-[#0A0A0A]' : 'bg-[#F7F7F9]'}`}
              />
            ))}
          </div>
        </div>

        {/* Acciones reales del comprobante */}
        <div className="grid grid-cols-2 gap-2.5 mt-3 print:hidden">
          <button
            type="button"
            onClick={handleDefaultPrintPdf}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-semibold border transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#141414] border-[#242424] hover:bg-[#1C1C1F] text-white'
                : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-[#D95B26]" />
            <span>Descargar PDF</span>
          </button>
          <button
            type="button"
            onClick={handleDefaultSaveImage}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-semibold border transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#141414] border-[#242424] hover:bg-[#1C1C1F] text-white'
                : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#D95B26]" />
            <span>Guardar imagen</span>
          </button>
        </div>
      </div>

      {/* Overlay con fade-in cuando se cumplen los 2 minutos en el Hub */}
      {isExpiredBlur && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
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
                  ? 'Ya quedó guardado automáticamente en tu cuenta de Toquecitos.'
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
