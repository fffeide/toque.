import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, Receipt } from '../../api';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { downloadReceiptAsImage, downloadReceiptAsPdf } from '../../lib/receiptDownload';
import { useToast } from '../../components/ui/Toast';
import {
  Receipt as ReceiptIcon,
  Download,
  Image as ImageIcon,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export const ReceiptDetailView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const cleanCode = (code || '').trim();

  useEffect(() => {
    if (!cleanCode) {
      navigate('/', { replace: true });
      return;
    }

    const upper = cleanCode.toUpperCase();
    // Si el código de /r/:code es un código de cartel (ej. CAJA01, DEMO01), redirigir a su destino correspondiente
    if (!upper.startsWith('RCP-')) {
      if (upper === 'DEMO01' || upper === 'VIRGEN01') {
        navigate(`/activar/${upper}`, { replace: true });
      } else {
        navigate(`/hub/${upper}`, { replace: true });
      }
      return;
    }

    let unsubscribe: (() => void) | null = null;

    api
      .getReceiptById(cleanCode)
      .then((found) => {
        if (found) {
          setReceipt(found);
          if (found.status === 'ready') {
            api.claimReceipt(found.id).catch(() => {});
          }
          unsubscribe = api.subscribeToReceipt(found.id, (updated) => {
            if (updated) setReceipt(updated);
          });
        }
      })
      .finally(() => setIsLoading(false));

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [cleanCode, navigate]);

  const handleDownloadImage = async () => {
    if (!receipt) return;
    try {
      await downloadReceiptAsImage(receipt);
      success('Comprobante guardado', 'La imagen se descargó en tu dispositivo.');
    } catch {
      toastError('No pudimos generar la imagen');
    }
  };

  const handleDownloadPdf = () => {
    if (!receipt) return;
    try {
      downloadReceiptAsPdf(receipt);
    } catch {
      toastError('No pudimos abrir el PDF imprimible');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee]">
        <PublicHeader showToqueMark />
        <div className="max-w-md mx-auto p-6 space-y-4 pt-10">
          <Skeleton className="h-72 w-full rounded-2xl bg-[#111113]" />
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee]">
        <PublicHeader showToqueMark />
        <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#18181b] border border-[#242426] text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="font-bold text-xl text-[#f1f1ee]">Comprobante no encontrado</h1>
          <p className="text-xs text-[#a1a1aa]">
            El comprobante <span className="font-mono text-[#f1f1ee]">{cleanCode}</span> no existe o fue anulado.
          </p>
          <Link to="/">
            <Button variant="secundario" size="touch">
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const methodLabel =
    receipt.method === 'mp_qr'
      ? 'Mercado Pago QR'
      : receipt.method === 'cash'
      ? 'Efectivo'
      : 'Posnet / Tarjeta';

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee] flex flex-col">
      <PublicHeader businessName={receipt.businessName} showToqueMark />

      <main className="flex-1 max-w-md w-full mx-auto p-4 sm:p-6 space-y-5">
        <Card className="p-6 space-y-5 border border-[#242426] bg-[#111113]">
          <div className="flex items-start justify-between border-b border-[#242426] pb-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#34d399]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Comprobante Digital Verificado
              </span>
              <h1 className="font-bold text-xl text-[#f1f1ee] tracking-tight">
                {receipt.businessName}
              </h1>
              <p className="text-xs font-mono text-[#a1a1aa]">
                Código: <strong className="text-[#f1f1ee]">{receipt.id}</strong>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#bec8ff]">
              <ReceiptIcon className="w-5 h-5" />
            </div>
          </div>

          {/* Detalle de fecha y medio de pago */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#18181b] border border-[#28282a] text-xs">
            <div>
              <span className="text-[#a1a1aa] block text-[10px] uppercase tracking-wider">
                Fecha y hora
              </span>
              <span className="font-mono font-semibold text-[#f1f1ee]">
                {formatDate(receipt.createdAt)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[#a1a1aa] block text-[10px] uppercase tracking-wider">
                Medio de pago
              </span>
              <span className="font-semibold text-[#f1f1ee]">{methodLabel}</span>
            </div>
          </div>

          {/* Ítems */}
          <div className="space-y-2.5 text-xs">
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-[#a1a1aa]">
              Detalle de tu compra
            </span>
            {receipt.items.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center py-2 border-b border-[#242426]/60 text-[#f1f1ee]"
              >
                <span>
                  {item.quantity > 1 && (
                    <strong className="font-bold text-[#bec8ff]">{item.quantity}x </strong>
                  )}
                  {item.name}
                </span>
                <span className="font-mono font-bold tabular-nums">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="pt-2 flex justify-between items-baseline">
            <span className="font-bold text-sm text-[#a1a1aa] uppercase tracking-wider">
              Total abonado
            </span>
            <span className="font-mono font-bold text-3xl text-[#f1f1ee] tabular-nums tracking-tight">
              {formatCurrency(receipt.total)}
            </span>
          </div>

          {/* Botones de Descarga */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <Button
              variant="ultramar"
              size="touch"
              onClick={handleDownloadImage}
              icon={<ImageIcon className="w-4 h-4 text-[#0c0c0c]" />}
            >
              Guardar imagen
            </Button>
            <Button
              variant="secundario"
              size="touch"
              onClick={handleDownloadPdf}
              icon={<Download className="w-4 h-4" />}
            >
              Descargar PDF
            </Button>
          </div>

          <div className="pt-3 text-center border-t border-[#242426]">
            <p className="text-[11px] font-medium text-[#a1a1aa]">
              Comprobante digital de compra · No válido como factura fiscal.
            </p>
          </div>
        </Card>

        {/* Acceso directo al Hub del Cartel para Club WalletWallet y Reseñas */}
        <Link to={`/h/${receipt.cartelCode}`} className="block">
          <div className="p-4 rounded-2xl bg-[#111113] border border-[#242426] hover:border-[#bec8ff] flex items-center justify-between transition-colors">
            <div>
              <p className="text-xs font-bold text-[#f1f1ee]">
                Sumá puntos en tu Wallet o dejá tu reseña
              </p>
              <p className="text-[11px] text-[#a1a1aa]">
                Abrir el Hub completo de {receipt.businessName}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[#bec8ff] shrink-0" />
          </div>
        </Link>
      </main>
    </div>
  );
};
