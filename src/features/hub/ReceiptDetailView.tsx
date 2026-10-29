import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, Receipt } from '../../api';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency, formatDate } from '../../lib/formatters';
import {
  CheckCircle2,
  Printer,
  Share2,
  ArrowLeft,
  Clock,
  Lock,
} from 'lucide-react';

const OPENED_RECEIPTS_KEY = 'toque_opened_receipts_v1';

function hasOpenedReceiptLocally(id: string): boolean {
  try {
    const raw = window.localStorage.getItem(OPENED_RECEIPTS_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) && list.includes(id.toUpperCase());
  } catch {
    return false;
  }
}

function markReceiptOpenedLocally(id: string): void {
  try {
    const raw = window.localStorage.getItem(OPENED_RECEIPTS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const upper = id.toUpperCase();
    if (!list.includes(upper)) {
      list.push(upper);
      window.localStorage.setItem(OPENED_RECEIPTS_KEY, JSON.stringify(list.slice(-50)));
    }
  } catch {
    // ignore
  }
}

export const ReceiptDetailView: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLockedOrExpired, setIsLockedOrExpired] = useState(false);

  useEffect(() => {
    let active = true;

    const loadAndClaimReceipt = async () => {
      setIsLoading(true);
      try {
        const data = await api.getReceiptById(id);
        if (!active) return;

        if (!data) {
          const cartel = await api.getCartelByCode(id).catch(() => null);
          if (active && cartel) {
            navigate(`/h/${cartel.code}`, { replace: true });
            return;
          }
          setReceipt(null);
          setIsLockedOrExpired(true);
          return;
        }

        const now = Date.now();
        const expiresMs = new Date(data.expiresAt).getTime();
        const createdMs = new Date(data.createdAt).getTime();
        const withinTwoMinutes =
          now <= expiresMs + 10000 || now - createdMs <= 2 * 60 * 1000 + 10000;
        const openedByThisDevice = hasOpenedReceiptLocally(data.id);

        if (openedByThisDevice) {
          setReceipt(data);
          setIsLockedOrExpired(false);
          return;
        }

        // Si el comprobante no está vencido (dentro de los 2 minutos), permitimos abrirlo y marcarlo en el dispositivo
        if (!withinTwoMinutes && data.status !== 'ready') {
          setReceipt(null);
          setIsLockedOrExpired(true);
          return;
        }

        if (!withinTwoMinutes) {
          setReceipt(null);
          setIsLockedOrExpired(true);
          return;
        }

        markReceiptOpenedLocally(data.id);
        if (data.status === 'ready') {
          const claimed = await api.claimReceipt(data.id).catch(() => ({ receipt: data }));
          if (active) {
            setReceipt(claimed.receipt);
            setIsLockedOrExpired(false);
          }
        } else {
          if (active) {
            setReceipt(data);
            setIsLockedOrExpired(false);
          }
        }
      } catch {
        if (active) {
          setReceipt(null);
          setIsLockedOrExpired(true);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadAndClaimReceipt();

    return () => {
      active = false;
    };
  }, [id]);

  const handleShare = async () => {
    if (!receipt) return;
    const shareData = {
      title: `Comprobante ${receipt.businessName}`,
      text: `Comprobante digital de compra por ${formatCurrency(receipt.total)} en ${receipt.businessName}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // cancelado
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Enlace del comprobante copiado', 'success');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f1f1ee] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <Skeleton className="h-96 w-full rounded-3xl bg-black/5" />
        </div>
      </div>
    );
  }

  if (!receipt || isLockedOrExpired) {
    return (
      <div className="min-h-screen bg-[#f1f1ee] text-[#0c0c0c] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-[32px] bg-[#ffffff] border border-black/15 p-7 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-[#0c0c0c] text-[#bec8ff] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-[#0c0c0c]">Comprobante no disponible</h1>
          <p className="text-xs text-[#52525b] leading-relaxed">
            Por seguridad, el comprobante tiene un límite de 2 minutos para abrirse y se cierra automáticamente una vez abierto o cuando la caja continúa con otros pagos.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="w-full py-3 px-5 rounded-full bg-[#0c0c0c] text-[#f1f1ee] font-semibold text-xs flex items-center justify-center"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const methodLabel =
    receipt.method === 'mercadopago'
      ? 'QR'
      : receipt.method === 'cash'
      ? 'Efectivo'
      : 'Tarjeta';

  return (
    <div className="min-h-screen bg-[#f1f1ee] text-[#0c0c0c] py-8 px-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            to={`/h/${receipt.cartelCode}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#52525b] hover:text-[#0c0c0c] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al Hub del local
          </Link>
          <span className="text-[11px] font-mono text-[#52525b]">#{receipt.id}</span>
        </div>

        {/* Ticket Digital Imprimible */}
        <div className="rounded-[32px] bg-[#ffffff] border border-black/15 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center border-b border-dashed border-black/15 pb-6 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#2fb36a]/15 text-[#1f8a4c] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-[#1f8a4c] bg-[#2fb36a]/15 px-2.5 py-0.5 rounded-full">
              Comprobante de compra
            </span>
            <h1 className="text-xl font-bold text-[#0c0c0c] pt-1">{receipt.businessName}</h1>
            <p className="text-xs text-[#52525b] flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {formatDate(receipt.createdAt)}
            </p>
          </div>

          {/* Detalle de Ítems */}
          <div className="space-y-3">
            <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-[#52525b]">
              <span>Concepto</span>
              <span>Importe</span>
            </div>
            <div className="divide-y divide-black/10">
              {receipt.items.map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-medium text-[#0c0c0c]">{item.name}</span>
                    <span className="text-xs text-[#52525b] ml-2">x{item.quantity}</span>
                  </div>
                  <span className="font-mono font-semibold text-[#0c0c0c]">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="border-t border-dashed border-black/15 pt-4 space-y-2">
            <div className="flex justify-between items-center text-xs text-[#52525b]">
              <span>Medio de pago</span>
              <span className="text-[#0c0c0c] font-semibold">{methodLabel}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-[#52525b]">
              <span>Punto de cobro</span>
              <span className="font-mono text-[#0c0c0c] font-semibold">{receipt.cartelCode}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-base font-bold text-[#0c0c0c]">Total abonado</span>
              <span className="text-2xl font-extrabold bg-[#0c0c0c] text-[#bec8ff] px-3 py-1 rounded-xl font-mono tabular-nums">
                {formatCurrency(receipt.total)}
              </span>
            </div>
          </div>

          {/* Acciones (No salen al imprimir) */}
          <div className="pt-2 space-y-2.5 print:hidden">
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                variant="secundario"
                size="sm"
                fullWidth
                icon={<Printer className="w-4 h-4" />}
                onClick={() => window.print()}
              >
                Descargar PDF
              </Button>
              <Button
                variant="secundario"
                size="sm"
                fullWidth
                icon={<Share2 className="w-4 h-4" />}
                onClick={handleShare}
              >
                Compartir
              </Button>
            </div>
          </div>

          <div className="text-center pt-2 border-t border-black/10">
            <p className="text-[11px] text-[#52525b]">
              Comprobante digital de compra · No válido como factura fiscal
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
