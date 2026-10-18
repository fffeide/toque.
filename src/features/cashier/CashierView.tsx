import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Cartel, Sale, Receipt, PaymentMethod, SaleItem } from '../../api';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatTime } from '../../lib/formatters';
import { useToast } from '../../components/ui/Toast';
import QRCode from 'qrcode';
import {
  CreditCard,
  QrCode,
  Banknote,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  ChevronDown,
  LayoutDashboard,
  Wifi,
  ExternalLink,
  Receipt as ReceiptIcon,
  LogOut,
} from 'lucide-react';

export const CashierView: React.FC = () => {
  const { user, business, logout } = useAuth();
  const { success, error: toastError } = useToast();

  // Carteles / Cajas
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [selectedCartelId, setSelectedCartelId] = useState<string>('');
  const [mpConnected, setMpConnected] = useState(true);

  // Teclado numérico y monto
  const [amountInput, setAmountInput] = useState('0');
  const [detailedItems, setDetailedItems] = useState<SaleItem[]>([]);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Proceso de cobro con Mercado Pago QR
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Comprobante emitido en vivo (sincronizado con el cartel y con QR directo en Caja)
  const [confirmedSale, setConfirmedSale] = useState<Sale | null>(null);
  const [emittedReceipt, setEmittedReceipt] = useState<Receipt | null>(null);
  const [receiptQrDataUrl, setReceiptQrDataUrl] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(300); // 5 minutos en vivo

  // Últimas ventas en tiempo real
  const [recentSales, setRecentSales] = useState<Sale[]>([]);

  const loadData = async () => {
    try {
      const [listC, mpStatus, sales] = await Promise.all([
        api.listCarteles(),
        api.getMercadoPagoStatus(),
        api.listSales(),
      ]);
      const validCarteles = listC.filter((c) => c.status !== 'trash');
      setCarteles(validCarteles);

      if (!selectedCartelId) {
        const assigned = user?.assignedCartelId
          ? validCarteles.find((c) => c.id === user.assignedCartelId)
          : null;
        const defaultCartel =
          assigned ||
          validCarteles.find((c) => c.role === 'caja' && c.status === 'active') ||
          validCarteles[0];
        if (defaultCartel) setSelectedCartelId(defaultCartel.id);
      }
      setMpConnected(mpStatus.connected);
      setRecentSales(sales.slice(0, 12));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribeSales = api.subscribeToBusinessSales((sales) => {
      setRecentSales(sales.slice(0, 12));
    });
    return () => unsubscribeSales();
  }, [user?.businessId]);

  // Escuchar en tiempo real si el cliente abrió/reclamó el recibo emitido desde el Hub o el QR
  useEffect(() => {
    if (!emittedReceipt?.id) return;
    const unsubscribeReceipt = api.subscribeToReceipt(emittedReceipt.id, (updated) => {
      if (updated) {
        setEmittedReceipt(updated);
      }
    });
    return () => unsubscribeReceipt();
  }, [emittedReceipt?.id]);

  // Generar QR directo del comprobante cuando se emite
  useEffect(() => {
    if (!emittedReceipt) {
      setReceiptQrDataUrl(null);
      return;
    }
    const receiptUrl = `${window.location.origin}/r/${emittedReceipt.id}`;
    QRCode.toDataURL(receiptUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#0c0c0c', light: '#ffffff' },
    })
      .then(setReceiptQrDataUrl)
      .catch(() => setReceiptQrDataUrl(null));
  }, [emittedReceipt?.id]);

  // Temporizador de vigencia en el cartel
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (confirmedSale && countdownSeconds > 0) {
      timer = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [confirmedSale, countdownSeconds]);

  const handleDigit = (digit: string) => {
    setAmountInput((prev) => {
      if (prev === '0') return digit;
      if (prev.length >= 8) return prev;
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    setAmountInput((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setAmountInput('0');
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(newItemPrice);
    if (!newItemName.trim() || isNaN(p) || p <= 0) return;

    const item: SaleItem = {
      id: `it-${Date.now()}`,
      name: newItemName.trim(),
      price: p,
      quantity: 1,
    };

    const nextItems = [...detailedItems, item];
    setDetailedItems(nextItems);
    const newTotal = nextItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
    setAmountInput(newTotal.toString());
    setNewItemName('');
    setNewItemPrice('');
  };

  const handleRemoveItem = (id: string) => {
    const nextItems = detailedItems.filter((it) => it.id !== id);
    setDetailedItems(nextItems);
    const newTotal = nextItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
    setAmountInput(newTotal.toString());
  };

  const totalAmount = parseInt(amountInput, 10) || 0;
  const selectedCartel = carteles.find((c) => c.id === selectedCartelId);

  const handleStartPayment = async (method: PaymentMethod) => {
    if (totalAmount <= 0) {
      toastError('Ingresá un importe válido mayor a $0');
      return;
    }
    if (!selectedCartelId) {
      toastError('Seleccioná un cartel o caja activa');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await api.createSale({
        cartelId: selectedCartelId,
        amount: totalAmount,
        items: detailedItems.length > 0 ? detailedItems : undefined,
        method,
      });

      if (method === 'mp_qr' && res.qrData) {
        const qrUrl = await QRCode.toDataURL(res.qrData, {
          width: 280,
          margin: 2,
          color: { dark: '#0c0c0c', light: '#ffffff' },
        });
        setQrCodeDataUrl(qrUrl);
        setActiveSale(res.sale);
      } else {
        setConfirmedSale(res.sale);
        setEmittedReceipt(res.receipt || null);
        setCountdownSeconds(300);
        success(
          '¡Cobro y comprobante emitidos!',
          `El recibo ya está activo en el cartel ${selectedCartel?.code || 'CAJA01'} y en pantalla.`
        );
        handleResetForm();
        loadData();
      }
    } catch (err) {
      toastError('Error al iniciar cobro', err instanceof Error ? err.message : 'Probá de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulatePaymentApproval = async () => {
    if (!activeSale) return;
    try {
      const res = await api.simulatePaymentApproved(activeSale.id);
      setConfirmedSale(res.sale);
      setEmittedReceipt(res.receipt);
      setActiveSale(null);
      setQrCodeDataUrl(null);
      setCountdownSeconds(300);
      success(
        '¡Pago aprobado!',
        `El comprobante ${res.receipt.id} ya está disponible en el cartel y en el QR.`
      );
      handleResetForm();
      loadData();
    } catch (err) {
      toastError('Error al confirmar pago', err instanceof Error ? err.message : 'Error inesperado.');
    }
  };

  const handleCancelActiveSale = async () => {
    if (!activeSale) return;
    try {
      await api.cancelSale(activeSale.id);
      setActiveSale(null);
      setQrCodeDataUrl(null);
      toastError('Cobro cancelado');
    } catch {
      // ignore
    }
  };

  const handleAnularConfirmedSale = async () => {
    if (!confirmedSale) return;
    try {
      await api.cancelSale(confirmedSale.id);
      setConfirmedSale(null);
      setEmittedReceipt(null);
      success('Venta anulada', 'El comprobante fue retirado del cartel.');
      loadData();
    } catch {
      // ignore
    }
  };

  const handleResetForm = () => {
    setAmountInput('0');
    setDetailedItems([]);
    setShowItemDetail(false);
  };

  const canAccessPanel = user?.role !== 'cashier';

  return (
    <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col selection:bg-[#bec8ff] selection:text-[#0c0c0c]">
      {/* Top Bar de Caja (Matte Dark Flat) */}
      <header className="bg-[#0c0c0c] border-b border-[#242426] px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {canAccessPanel ? (
            <Link
              to="/panel"
              className="w-9 h-9 rounded-xl bg-[#111113] hover:bg-[#18181b] text-[#f1f1ee] flex items-center justify-center transition-colors border border-[#242426]"
              title="Volver al panel del comercio"
            >
              <LayoutDashboard className="w-4 h-4" />
            </Link>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[#bec8ff] text-[#0c0c0c] font-bold text-sm flex items-center justify-center">
              {(business?.name || 'T').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg text-[#f1f1ee] tracking-tight">
                Terminal de Caja
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#2fb36a]/20 text-[#34d399] border border-[#2fb36a]/40 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Sincronizado con Hub
              </span>
            </div>
            <p className="text-xs text-[#a1a1aa] hidden sm:block">
              {business?.name || 'Comercio Toque'} · Operador: <strong className="text-[#f1f1ee]">{user?.name || 'Cajero'}</strong>
            </p>
          </div>
        </div>

        {/* Selector de Cartel / Caja y enlace directo al Hub */}
        <div className="flex items-center gap-2.5">
          {carteles.length > 1 ? (
            <div className="relative">
              <select
                aria-label="Seleccionar cartel o caja"
                value={selectedCartelId}
                onChange={(e) => setSelectedCartelId(e.target.value)}
                className="appearance-none bg-[#111113] border border-[#242426] rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
              >
                {carteles.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#111113] text-[#f1f1ee]">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#a1a1aa] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="text-xs bg-[#111113] border border-[#242426] px-3 py-2 rounded-xl font-medium text-[#a1a1aa]">
              Cartel vinculado:{' '}
              <strong className="font-mono text-[#bec8ff]">
                {selectedCartel?.code || 'CAJA01'}
              </strong>
            </div>
          )}

          <Link
            to={`/h/${selectedCartel?.code || 'CAJA01'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#bec8ff] text-[#f1f1ee] transition-colors"
          >
            <span>Abrir Hub</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#bec8ff]" />
          </Link>

          {!canAccessPanel && (
            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión de cajero"
              className="w-9 h-9 rounded-xl bg-[#111113] border border-[#242426] hover:bg-[#18181b] text-[#a1a1aa] hover:text-[#f1f1ee] flex items-center justify-center cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* MODAL: COBRANDO CON QR MERCADO PAGO */}
      {activeSale && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <Card padding="lg" className="max-w-md w-full text-center space-y-5 bg-[#111113] border border-[#242426]">
            <div className="flex items-center justify-between border-b border-[#242426] pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#bec8ff]">
                Cobro con QR Mercado Pago
              </span>
              <button
                type="button"
                onClick={handleCancelActiveSale}
                className="p-1 text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="font-mono font-bold text-3xl text-[#f1f1ee] tabular-nums">
                {formatCurrency(activeSale.amount)}
              </p>
              <p className="text-xs text-[#a1a1aa]">
                Esperando confirmación del pago para emitir el recibo en el cartel{' '}
                <strong className="font-mono text-[#f1f1ee]">{selectedCartel?.code}</strong>…
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#242426] inline-block mx-auto">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Mercado Pago"
                  className="w-52 h-52 object-contain mx-auto"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-[#0c0c0c] text-xs font-semibold">
                  Generando QR…
                </div>
              )}
            </div>

            <div className="p-3.5 bg-[#18181b] border border-[#28282a] rounded-xl space-y-2.5">
              <span className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider block">
                Confirmación en mostrador
              </span>
              <Button
                variant="ultramar"
                size="touch"
                fullWidth
                onClick={handleSimulatePaymentApproval}
                icon={<Sparkles className="w-4 h-4 text-[#0c0c0c]" />}
              >
                Confirmar pago y emitir recibo
              </Button>
            </div>

            <Button
              variant="secundario"
              size="sm"
              fullWidth
              onClick={handleCancelActiveSale}
            >
              Cancelar cobro
            </Button>
          </Card>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Teclado e Importe (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Pantalla del Monto */}
          <Card padding="md" className="bg-[#111113] border border-[#242426]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa]">
                IMPORTE A COBRAR
              </span>
              <button
                type="button"
                onClick={() => setShowItemDetail(!showItemDetail)}
                className="text-xs font-semibold text-[#bec8ff] hover:text-[#d6daf6] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showItemDetail ? 'Ocultar detalle de ítems' : 'Detallar ítems / concepto'}</span>
              </button>
            </div>

            <div className="flex items-baseline justify-between py-2 overflow-x-auto">
              <span className="text-2xl sm:text-3xl text-[#a1a1aa] font-bold">$</span>
              <span className="font-mono font-bold text-4xl sm:text-6xl text-[#f1f1ee] tracking-tight tabular-nums">
                {amountInput === '0' ? '0' : parseInt(amountInput, 10).toLocaleString('es-AR')}
              </span>
            </div>

            {showItemDetail && (
              <div className="mt-4 pt-4 border-t border-[#242426] space-y-3">
                <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Concepto (ej. Café con leche + 2 medialunas)"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-[#28282a] text-xs bg-[#18181b] text-[#f1f1ee] placeholder-[#a1a1aa]/60 focus:outline-none focus:border-[#bec8ff]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      placeholder="$ Importe"
                      className="w-28 px-3.5 py-2 rounded-xl border border-[#28282a] text-xs bg-[#18181b] text-[#f1f1ee] placeholder-[#a1a1aa]/60 focus:outline-none focus:border-[#bec8ff]"
                    />
                    <Button type="submit" variant="secundario" size="sm">
                      Sumar ítem
                    </Button>
                  </div>
                </form>

                {detailedItems.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {detailedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-[#18181b] border border-[#28282a]"
                      >
                        <span className="text-[#f1f1ee] font-medium">{item.name}</span>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-[#f1f1ee]">
                            {formatCurrency(item.price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Teclado Numérico Táctil Matte Dark Flat */}
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="min-h-[64px] rounded-2xl bg-[#111113] border border-[#242426] hover:bg-[#18181b] hover:border-[#343438] active:bg-[#222226] font-mono font-bold text-2xl text-[#f1f1ee] transition-colors cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="min-h-[64px] rounded-2xl bg-[#18181b] border border-[#28282a] hover:border-red-500/40 hover:bg-[#261515] font-bold text-sm text-red-300 transition-colors cursor-pointer"
            >
              VACIAR (C)
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="min-h-[64px] rounded-2xl bg-[#111113] border border-[#242426] hover:bg-[#18181b] hover:border-[#343438] active:bg-[#222226] font-mono font-bold text-2xl text-[#f1f1ee] transition-colors cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="min-h-[64px] rounded-2xl bg-[#18181b] border border-[#28282a] hover:bg-[#222226] font-bold text-base text-[#a1a1aa] hover:text-[#f1f1ee] transition-colors cursor-pointer"
              aria-label="Borrar último dígito"
            >
              ⌫
            </button>
          </div>

          {/* Botones de Cobro con Contraste Verificado WCAG AA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              disabled={isProcessing || totalAmount <= 0}
              onClick={() => handleStartPayment('cash')}
              className="min-h-[62px] p-4 rounded-2xl bg-[#2fb36a] hover:bg-[#38c477] text-[#0c0c0c] font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-[#0c0c0c]" />
                <span>Cobrar Efectivo</span>
              </div>
              <span className="text-[10px] text-[#0c0c0c]/80 font-semibold">
                Emite recibo al instante
              </span>
            </button>

            <button
              type="button"
              disabled={isProcessing || totalAmount <= 0}
              onClick={() => handleStartPayment('card_manual')}
              className="min-h-[62px] p-4 rounded-2xl bg-[#bec8ff] hover:bg-[#d6daf6] text-[#0c0c0c] font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#0c0c0c]" />
                <span>Posnet / Tarjeta</span>
              </div>
              <span className="text-[10px] text-[#0c0c0c]/80 font-semibold">
                Emite recibo al instante
              </span>
            </button>

            <button
              type="button"
              disabled={isProcessing || totalAmount <= 0}
              onClick={() => handleStartPayment('mp_qr')}
              className="min-h-[62px] p-4 rounded-2xl bg-[#111113] border border-[#242426] hover:border-[#bec8ff] hover:bg-[#18181b] text-[#f1f1ee] font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#bec8ff]" />
                <span>QR Mercado Pago</span>
              </div>
              <span className="text-[10px] text-[#a1a1aa] font-normal">
                {mpConnected ? 'QR en pantalla + recibo' : 'Modo demostración'}
              </span>
            </button>
          </div>
        </div>

        {/* Columna Derecha: Comprobante Emitido en Vivo (NFC + QR) y Últimos Cobros (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-5">
          {/* TARJETA EN VIVO DEL COMPROBANTE RECIÉN EMITIDO (QR DIRECTO + NFC EN EL CARTEL) */}
          {confirmedSale && emittedReceipt && (
            <Card className="p-5 space-y-4 bg-[#111113] border-2 border-[#2fb36a]">
              <div className="flex items-start justify-between gap-2 border-b border-[#242426] pb-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#34d399]">
                    <CheckCircle2 className="w-4 h-4" />
                    Comprobante Activo en Cartel y QR
                  </span>
                  <h2 className="font-bold text-lg text-[#f1f1ee] mt-0.5">
                    {formatCurrency(emittedReceipt.total)} · {emittedReceipt.id}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedSale(null);
                    setEmittedReceipt(null);
                  }}
                  className="text-[#a1a1aa] hover:text-[#f1f1ee] p-1 cursor-pointer"
                  title="Cerrar comprobante activo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Estado de recepción por el cliente */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  emittedReceipt.status === 'claimed'
                    ? 'bg-[#2fb36a]/20 border-[#2fb36a]/50 text-[#f1f1ee]'
                    : 'bg-[#18181b] border-[#28282a] text-[#f1f1ee]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wifi
                    className={`w-4 h-4 ${
                      emittedReceipt.status === 'claimed' ? 'text-[#34d399]' : 'text-[#bec8ff]'
                    }`}
                  />
                  <span>
                    {emittedReceipt.status === 'claimed'
                      ? '¡El cliente ya abrió su comprobante!'
                      : `Listo al apoyar en cartel ${emittedReceipt.cartelCode}`}
                  </span>
                </div>
                <span className="font-mono font-bold text-[#bec8ff] tabular-nums flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.floor(countdownSeconds / 60)}:
                  {(countdownSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>

              {/* QR directo en Caja + Vista previa del ticket */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-[#18181b] border border-[#28282a] rounded-2xl p-3.5">
                <div className="sm:col-span-5 flex flex-col items-center">
                  {receiptQrDataUrl && (
                    <div className="p-2 bg-white rounded-xl">
                      <img
                        src={receiptQrDataUrl}
                        alt={`QR Comprobante ${emittedReceipt.id}`}
                        className="w-28 h-28 object-contain"
                      />
                    </div>
                  )}
                  <span className="text-[10px] font-semibold text-[#a1a1aa] mt-1.5 text-center">
                    Escanear QR en Caja
                  </span>
                </div>

                <div className="sm:col-span-7 space-y-2 text-xs">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa]">
                    Doble vía habilitada:
                  </p>
                  <p className="text-[#f1f1ee] leading-relaxed">
                    1. El cliente puede <strong className="text-[#bec8ff]">apoyar el celular (NFC/QR)</strong> en el cartel{' '}
                    <span className="font-mono font-bold">{emittedReceipt.cartelCode}</span>.
                  </p>
                  <p className="text-[#f1f1ee] leading-relaxed">
                    2. O escanear directamente este <strong className="text-[#34d399]">QR de pantalla</strong>.
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <Link
                      to={`/r/${emittedReceipt.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-[#0c0c0c] bg-[#bec8ff] hover:bg-[#d6daf6] px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1"
                    >
                      <ReceiptIcon className="w-3 h-3" />
                      <span>Ver recibo</span>
                    </Link>
                    <Link
                      to={`/h/${emittedReceipt.cartelCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[#f1f1ee] bg-[#111113] border border-[#28282a] hover:border-[#bec8ff] px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1"
                    >
                      <span>Ver en Hub ↗</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secundario"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setConfirmedSale(null);
                    setEmittedReceipt(null);
                  }}
                >
                  Listo · Nuevo cobro
                </Button>
                <Button
                  variant="peligro"
                  size="sm"
                  onClick={handleAnularConfirmedSale}
                  className="text-red-300 border-red-500/30 hover:bg-[#2a1515]"
                >
                  Anular
                </Button>
              </div>
            </Card>
          )}

          {/* Historial de últimos cobros reales de la caja */}
          <Card padding="md" className="space-y-3 bg-[#111113] border border-[#242426]">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#242426]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#f1f1ee]">
                Últimos cobros reales
              </span>
              <span className="text-[11px] font-medium text-[#a1a1aa]">
                {recentSales.length} registrados
              </span>
            </div>

            {recentSales.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#a1a1aa] space-y-1">
                <p className="font-semibold text-[#f1f1ee]">Sin cobros registrados todavía</p>
                <p>
                  Ingresá un monto en el teclado para emitir tu primer comprobante en vivo.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {recentSales.map((sale) => {
                  const methodLabel =
                    sale.method === 'mp_qr'
                      ? 'MP QR'
                      : sale.method === 'cash'
                      ? 'Efectivo'
                      : 'Posnet';
                  const isPaid = sale.status === 'paid';
                  const isCancelled = sale.status === 'cancelled';

                  return (
                    <div
                      key={sale.id}
                      className="p-3 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#f1f1ee] tabular-nums">
                            {formatCurrency(sale.amount)}
                          </span>
                          <span className="text-[11px] text-[#a1a1aa]">· {methodLabel}</span>
                        </div>
                        <span className="text-[11px] text-[#a1a1aa] block truncate">
                          {formatTime(sale.createdAt)} · {sale.items[0]?.name || 'Cobro'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {sale.receiptId && isPaid && (
                          <Link
                            to={`/r/${sale.receiptId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono font-semibold text-[#bec8ff] hover:underline px-2 py-1 rounded-lg bg-[#111113] border border-[#242426]"
                            title="Abrir comprobante digital"
                          >
                            {sale.receiptId} ↗
                          </Link>
                        )}
                        {isPaid && (
                          <span className="text-[10px] font-bold text-[#34d399] bg-[#2fb36a]/15 border border-[#2fb36a]/30 px-2.5 py-0.5 rounded-full">
                            Cobrada
                          </span>
                        )}
                        {isCancelled && (
                          <span className="text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 rounded-full">
                            Anulada
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};
