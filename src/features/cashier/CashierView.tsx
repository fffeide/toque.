import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Cartel, Sale, PaymentMethod, SaleItem } from '../../api';
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
  RotateCcw,
  Sparkles,
  AlertCircle,
  X,
  ChevronDown,
  LayoutDashboard,
} from 'lucide-react';

export const CashierView: React.FC = () => {
  const { user, business } = useAuth();
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

  // Proceso de cobro activo
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Pantalla post-cobro ("Cobro confirmado. Pedile al cliente que apoye el celular.")
  const [confirmedSale, setConfirmedSale] = useState<Sale | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(180); // 3 minutos

  // Últimas ventas
  const [recentSales, setRecentSales] = useState<Sale[]>([]);

  // Carga inicial
  const loadData = async () => {
    try {
      const [listC, mpStatus, sales] = await Promise.all([
        api.listCarteles(),
        api.getMercadoPagoStatus(),
        api.listSales(),
      ]);
      setCarteles(listC);
      const defaultCartel = listC.find(c => c.role === 'caja' && c.status === 'active') || listC[0];
      if (defaultCartel) setSelectedCartelId(defaultCartel.id);
      setMpConnected(mpStatus.connected);
      setRecentSales(sales.slice(0, 10));
    } catch {
      // Ignorar
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Temporizador de 3 minutos tras confirmación
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (confirmedSale && countdownSeconds > 0) {
      timer = setInterval(() => {
        setCountdownSeconds(prev => {
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

  // Teclado numérico
  const handleDigit = (digit: string) => {
    setAmountInput(prev => {
      if (prev === '0') return digit;
      if (prev.length >= 8) return prev;
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    setAmountInput(prev => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setAmountInput('0');
  };

  // Ítems detallados
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
    const nextItems = detailedItems.filter(it => it.id !== id);
    setDetailedItems(nextItems);
    const newTotal = nextItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
    setAmountInput(newTotal.toString());
  };

  const totalAmount = parseInt(amountInput, 10) || 0;

  // Iniciar cobro
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
        // Generar QR en vivo
        const qrUrl = await QRCode.toDataURL(res.qrData, {
          width: 320,
          margin: 2,
          color: { dark: '#0B1030', light: '#FFFFFF' },
        });
        setQrCodeDataUrl(qrUrl);
        setActiveSale(res.sale);
      } else {
        // Efectivo o Posnet se confirman al instante
        setConfirmedSale(res.sale);
        setCountdownSeconds(180);
        success('¡Cobro registrado!', 'Pedile al cliente que apoye el celular en el cartel.');
        handleResetForm();
        loadData();
      }
    } catch (err) {
      toastError('Error al iniciar cobro', err instanceof Error ? err.message : 'Probá de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Simulación de Mercado Pago en modo prueba
  const handleSimulatePaymentApproval = async () => {
    if (!activeSale) return;
    try {
      const res = await api.simulatePaymentApproved(activeSale.id);
      setConfirmedSale(res.sale);
      setActiveSale(null);
      setQrCodeDataUrl(null);
      setCountdownSeconds(180);
      success('¡Pago aprobado por Mercado Pago!', 'El recibo ya está disponible en el cartel.');
      handleResetForm();
      loadData();
    } catch (err) {
      toastError('Error al simular pago', err instanceof Error ? err.message : 'Error inesperado.');
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
      // Ignorar
    }
  };

  const handleAnularConfirmedSale = async () => {
    if (!confirmedSale) return;
    try {
      await api.cancelSale(confirmedSale.id);
      setConfirmedSale(null);
      success('Venta anulada', 'El comprobante fue retirado del cartel.');
      loadData();
    } catch {
      // Ignorar
    }
  };

  const handleResetForm = () => {
    setAmountInput('0');
    setDetailedItems([]);
    setShowItemDetail(false);
  };

  const selectedCartel = carteles.find(c => c.id === selectedCartelId);

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col">
      {/* Top Bar de Caja para Tablet y Computadora */}
      <header className="bg-white border-b border-[#E3DDD2] px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/panel"
            className="w-9 h-9 rounded-xl bg-[#F7F4EE] hover:bg-[#EAE4D9] text-[#0B1030] flex items-center justify-center transition border border-[#E3DDD2]"
            title="Volver al panel"
          >
            <LayoutDashboard className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base sm:text-lg text-[#0B1030]">
                Caja
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#ECEDFC] text-[#3A3FE0] px-2 py-0.5 rounded-full">
                En vivo
              </span>
            </div>
            <p className="text-xs text-[#5E6072] hidden sm:block">
              {business?.name || 'Comercio Toque'}
            </p>
          </div>
        </div>

        {/* Selector de Cartel / Caja */}
        <div className="flex items-center gap-2">
          {carteles.length > 1 ? (
            <div className="relative">
              <select
                value={selectedCartelId}
                onChange={(e) => setSelectedCartelId(e.target.value)}
                className="appearance-none bg-[#F7F4EE] border border-[#E3DDD2] rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-[#0B1030] focus:outline-none focus:border-[#3A3FE0]"
              >
                {carteles.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#5E6072] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="text-xs bg-[#F7F4EE] border border-[#E3DDD2] px-3 py-1.5 rounded-xl font-medium text-[#0B1030]">
              Cartel activo: <strong className="cartel-code">{selectedCartel?.code || 'CAJA01'}</strong>
            </div>
          )}
        </div>
      </header>

      {/* MODAL / PANTALLA: COBRO CONFIRMADO (3 MINUTOS) */}
      {confirmedSale && (
        <div className="fixed inset-0 bg-[#0B1030]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card padding="lg" className="max-w-md w-full text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-3xl bg-[#FFF1C7] text-[#0B1030] flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10 text-[#3A3FE0]" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#3A3FE0]">
                Cobro exitoso por {formatCurrency(confirmedSale.amount)}
              </span>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#0B1030] leading-tight">
                Pedile al cliente que apoye el celular
              </h2>
              <p className="text-xs text-[#5E6072] leading-relaxed">
                Al apoyar su teléfono o escanear el cartel <strong className="cartel-code text-[#0B1030]">{selectedCartel?.code}</strong> verá su comprobante digital y la opción de dejar una reseña en Google.
              </p>
            </div>

            {/* Cuenta regresiva de 3 minutos */}
            <div className="p-3.5 rounded-xl bg-[#F7F4EE] border border-[#E3DDD2] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#5E6072]">
                <Clock className="w-4 h-4 text-[#3A3FE0]" />
                <span>Tiempo restante en el cartel:</span>
              </div>
              <span className="font-mono font-bold text-base text-[#0B1030] tabular-nums">
                {Math.floor(countdownSeconds / 60)}:{(countdownSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                variant="estrella"
                size="touch"
                fullWidth
                onClick={() => setConfirmedSale(null)}
              >
                Cobrar otra venta
              </Button>
              <Button
                variant="secundario"
                size="touch"
                onClick={handleAnularConfirmedSale}
                className="text-[#B8332A] hover:bg-[#FCE9E6]"
              >
                Anular y generar otro
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: COBRANDO CON QR MERCADO PAGO */}
      {activeSale && (
        <div className="fixed inset-0 bg-[#0B1030]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card padding="lg" className="max-w-md w-full text-center space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E3DDD2] pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#3A3FE0]">
                Mercado Pago QR
              </span>
              <button
                type="button"
                onClick={handleCancelActiveSale}
                className="p-1 text-[#5E6072] hover:text-[#0B1030]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="font-display font-bold text-3xl text-[#0B1030] tabular-nums">
                {formatCurrency(activeSale.amount)}
              </p>
              <p className="text-xs text-[#5E6072]">
                Esperando que el cliente escanee con Mercado Pago…
              </p>
            </div>

            {/* QR Dinámico */}
            <div className="p-4 bg-white rounded-2xl border-2 border-[#E3DDD2] inline-block mx-auto shadow-sm">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Mercado Pago"
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3A3FE0]" />
                </div>
              )}
            </div>

            {/* Botón de Simulación de Pago en Demo (Requerimiento del usuario) */}
            <div className="p-3 bg-[#FFF1C7] border border-[#FFC21A]/50 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-[#0B1030] uppercase block">
                Modo Demostración
              </span>
              <Button
                variant="estrella"
                size="touch"
                fullWidth
                onClick={handleSimulatePaymentApproval}
                icon={<Sparkles className="w-4 h-4 text-[#0B1030]" />}
              >
                Simular pago aprobado
              </Button>
            </div>

            <div>
              <Button
                variant="secundario"
                size="sm"
                fullWidth
                onClick={handleCancelActiveSale}
              >
                Cancelar cobro
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL: TECLADO Y BOTONES DE COBRO */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Teclado Numérico y Métodos de Cobro (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Pantalla del Monto */}
          <Card padding="md" className="border-2 border-[#E3DDD2] bg-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#5E6072]">Importe a cobrar</span>
              <button
                type="button"
                onClick={() => setShowItemDetail(!showItemDetail)}
                className="text-xs font-semibold text-[#3A3FE0] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showItemDetail ? 'Ocultar ítems' : 'Detallar ítems'}</span>
              </button>
            </div>

            <div className="flex items-baseline justify-between py-2 overflow-x-auto">
              <span className="text-2xl sm:text-3xl text-[#5E6072] font-display font-medium">$</span>
              <span className="font-display font-bold text-4xl sm:text-6xl text-[#0B1030] tracking-tight tabular-nums">
                {amountInput === '0' ? '0' : parseInt(amountInput, 10).toLocaleString('es-AR')}
              </span>
            </div>

            {/* Desglose de ítems si está activo */}
            {showItemDetail && (
              <div className="mt-4 pt-4 border-t border-[#E3DDD2] space-y-3">
                <form onSubmit={handleAddItem} className="flex gap-2">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Concepto (ej. Café)"
                    className="flex-1 px-3 py-2 rounded-xl border border-[#E3DDD2] text-xs bg-[#F7F4EE]/50"
                  />
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="$ Precio"
                    className="w-24 px-3 py-2 rounded-xl border border-[#E3DDD2] text-xs bg-[#F7F4EE]/50"
                  />
                  <Button type="submit" variant="secundario" size="sm">
                    Agregar
                  </Button>
                </form>

                {detailedItems.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {detailedItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-xs p-1.5 rounded-lg bg-[#F7F4EE]">
                        <span>{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{formatCurrency(item.price)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-[#B8332A] p-0.5"
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

          {/* Teclado Numérico Táctil */}
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="btn-touch min-h-[64px] rounded-2xl bg-white border border-[#E3DDD2] hover:bg-[#F7F4EE] active:bg-[#EAE4D9] font-display font-bold text-2xl text-[#0B1030] shadow-2xs"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="btn-touch min-h-[64px] rounded-2xl bg-[#FCE9E6] border border-[#B8332A]/20 hover:bg-[#F7D8D3] font-display font-bold text-sm text-[#B8332A]"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="btn-touch min-h-[64px] rounded-2xl bg-white border border-[#E3DDD2] hover:bg-[#F7F4EE] active:bg-[#EAE4D9] font-display font-bold text-2xl text-[#0B1030] shadow-2xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="btn-touch min-h-[64px] rounded-2xl bg-white border border-[#E3DDD2] hover:bg-[#F7F4EE] active:bg-[#EAE4D9] font-display font-bold text-sm text-[#5E6072]"
              aria-label="Borrar último dígito"
            >
              ⌫
            </button>
          </div>

          {/* Botones de Cobro (Mínimo 48px para ergonomía de caja) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              disabled={isProcessing || totalAmount <= 0}
              onClick={() => handleStartPayment('mp_qr')}
              className={`min-h-[58px] p-4 rounded-2xl border-2 font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 transition cursor-pointer select-none ${
                mpConnected
                  ? 'bg-[#3A3FE0] border-[#3A3FE0] text-white hover:bg-[#2F33C2] active:bg-[#25289E] shadow-sm'
                  : 'bg-white border-[#E3DDD2] text-[#5E6072] opacity-60'
              }`}
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#FFC21A]" />
                <span>QR Mercado Pago</span>
              </div>
              {!mpConnected && (
                <span className="text-[10px] text-[#B8332A] font-normal">Sin cuenta vinculada</span>
              )}
            </button>

            <button
              type="button"
              disabled={isProcessing || totalAmount <= 0}
              onClick={() => handleStartPayment('cash')}
              className="min-h-[58px] p-4 rounded-2xl bg-white border-2 border-[#E3DDD2] hover:border-[#3A3FE0] active:bg-[#F7F4EE] font-bold text-xs sm:text-sm text-[#0B1030] flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-[#3A3FE0]" />
                <span>Efectivo</span>
              </div>
              <span className="text-[10px] text-[#5E6072] font-normal">Cobro confirmado</span>
            </button>

            <button
              type="button"
              disabled={isProcessing || totalAmount <= 0}
              onClick={() => handleStartPayment('card_manual')}
              className="min-h-[58px] p-4 rounded-2xl bg-white border-2 border-[#E3DDD2] hover:border-[#3A3FE0] active:bg-[#F7F4EE] font-bold text-xs sm:text-sm text-[#0B1030] flex flex-col items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#3A3FE0]" />
                <span>Posnet / Tarjeta</span>
              </div>
              <span className="text-[10px] text-[#5E6072] font-normal">Cobro confirmado</span>
            </button>
          </div>
        </div>

        {/* Columna Derecha: Últimas 10 Ventas de la Caja (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E3DDD2]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0B1030]">
                Últimos cobros
              </span>
              <span className="text-[11px] font-medium text-[#5E6072]">
                {recentSales.length} registrados
              </span>
            </div>

            {recentSales.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#5E6072]">
                Aún no registraste cobros hoy en esta caja.
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {recentSales.map(sale => {
                  const methodLabel = sale.method === 'mp_qr' ? 'MP QR' : sale.method === 'cash' ? 'Efectivo' : 'Posnet';
                  const isPaid = sale.status === 'paid';
                  const isCancelled = sale.status === 'cancelled';

                  return (
                    <div
                      key={sale.id}
                      className="p-3 rounded-xl bg-[#F7F4EE] border border-[#E3DDD2] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#0B1030] tabular-nums">
                            {formatCurrency(sale.amount)}
                          </span>
                          <span className="text-[10px] text-[#5E6072]">· {methodLabel}</span>
                        </div>
                        <span className="text-[10px] text-[#5E6072]">
                          {formatTime(sale.createdAt)} · {sale.items[0]?.name || 'Cobro'}
                        </span>
                      </div>

                      <div>
                        {isPaid && (
                          <span className="text-[10px] font-bold text-[#3A3FE0] bg-[#ECEDFC] px-2 py-0.5 rounded-full">
                            Cobrada
                          </span>
                        )}
                        {isCancelled && (
                          <span className="text-[10px] font-bold text-[#B8332A] bg-[#FCE9E6] px-2 py-0.5 rounded-full">
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
