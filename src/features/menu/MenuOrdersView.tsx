import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { OrderSlip, OrderStatus, WaiterCall } from '../../api/types';
import { formatARS } from '../../lib/format';
import { useToast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Volume2, VolumeX, CheckCircle, Clock, BellRing, Phone, MapPin } from 'lucide-react';

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio no soportado o bloqueado
  }
}

export const MenuOrdersView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'salon' | 'cocina'>('salon');
  const [orders, setOrders] = useState<OrderSlip[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [cancelingOrder, setCancelingOrder] = useState<OrderSlip | null>(null);
  const [cancelReason, setCancelReason] = useState('Cancelado por el local');
  const previousNewCount = useRef<number>(0);
  const previousCallsCount = useRef<number>(0);

  const loadOrders = useCallback(async (isInitial = false) => {
    try {
      const [data, calls] = await Promise.all([
        api.listOrders(),
        api.listWaiterCalls().catch(() => []),
      ]);
      setOrders(data);
      setWaiterCalls(calls);
      const newOrders = data.filter((o) => o.status === 'nuevo');
      if (!isInitial && soundEnabled && (newOrders.length > previousNewCount.current || calls.length > previousCallsCount.current)) {
        playBeep();
      }
      previousNewCount.current = newOrders.length;
      previousCallsCount.current = calls.length;
    } catch {
      // Silencioso
    }
  }, [soundEnabled]);

  useEffect(() => {
    loadOrders(true);
    const interval = setInterval(() => loadOrders(false), 5000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleAdvance = async (order: OrderSlip) => {
    try {
      if (order.status === 'nuevo') {
        const updated = await api.setOrderStatus(order.id, 'confirmado');
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        showToast('Comanda confirmada', 'success');
      } else if (order.status === 'confirmado') {
        const updated = await api.setOrderStatus(order.id, 'listo');
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        showToast('Comanda lista', 'success');
      } else if (order.status === 'listo') {
        const updated = await api.setOrderStatus(order.id, 'entregado');
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        showToast('Pedido entregado a la mesa', 'success');
      } else if (order.status === 'entregado') {
        navigate(`/caja?amount=${order.totalArs}&orderId=${order.id}`);
      }
    } catch {
      showToast('No pudimos actualizar la comanda', 'error');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelingOrder) return;
    try {
      const updated = await api.setOrderStatus(cancelingOrder.id, 'cancelado', cancelReason);
      setOrders((prev) => prev.map((o) => (o.id === cancelingOrder.id ? updated : o)));
      setCancelingOrder(null);
      showToast('Comanda cancelada', 'info');
    } catch {
      showToast('No pudimos cancelar la comanda', 'error');
    }
  };

  const visibleOrders = orders.filter((o) => {
    if (activeTab === 'cocina') {
      return o.status === 'nuevo' || o.status === 'confirmado';
    }
    return o.status !== 'cobrado' && o.status !== 'cancelado';
  });

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Barra superior de solapas y controles */}
      <div className="flex items-center justify-between gap-2 bg-[#141418] border border-[#282830] p-1.5 rounded-2xl">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('salon')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'salon' ? 'bg-[#202028] text-white' : 'text-[#9E9EA8] hover:text-[#F4F4F6]'
            }`}
          >
            Salón ({orders.filter((o) => o.status !== 'cobrado' && o.status !== 'cancelado').length})
          </button>
          <button
            onClick={() => setActiveTab('cocina')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'cocina' ? 'bg-[#202028] text-white' : 'text-[#9E9EA8] hover:text-[#F4F4F6]'
            }`}
          >
            Cocina ({orders.filter((o) => o.status === 'nuevo' || o.status === 'confirmado').length})
          </button>
        </div>

        <div className="flex items-center gap-2 pr-1">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>En vivo</span>
          </div>
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playBeep();
            }}
            className="p-1.5 rounded-xl text-[#9E9EA8] hover:text-[#F4F4F6] hover:bg-[#1A1A22] transition-colors"
            title={soundEnabled ? 'Aviso sonoro activado' : 'Activar aviso sonoro'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Alertas de Llamadas al Mozo en Vivo */}
      {waiterCalls.length > 0 && (
        <div className="space-y-2">
          {waiterCalls.map((call) => (
            <div
              key={call.id}
              className="p-3.5 rounded-2xl bg-[#D95B26]/10 border border-[#D95B26]/50 flex items-center justify-between gap-3 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#D95B26] text-white flex items-center justify-center shrink-0 animate-bounce">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#F4F4F6]">
                    Llamada al mozo: {call.tableLabel}
                  </div>
                  <div className="text-[11px] text-[#A1A1AA]">
                    {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Atención solicitada
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.dismissWaiterCall(call.id);
                    setWaiterCalls((prev) => prev.filter((c) => c.id !== call.id));
                    showToast(`Llamada de ${call.tableLabel} atendida`, 'success');
                  } catch {
                    showToast('No pudimos actualizar la llamada', 'error');
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-[#D95B26] hover:bg-[#c04d1c] text-white font-bold text-xs transition-colors shrink-0"
              >
                Atender
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lista de Comandas */}
      {visibleOrders.length === 0 ? (
        <div className="bg-[#141418] border border-[#282830] rounded-2xl p-10 text-center space-y-2">
          <CheckCircle className="w-8 h-8 text-[#9E9EA8] mx-auto opacity-40" />
          <h2 className="text-sm font-semibold text-[#F4F4F6]">No hay comandas pendientes</h2>
          <p className="text-xs text-[#9E9EA8]">Los pedidos que ingresen desde las mesas aparecerán acá en vivo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order) => {
            const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div
                key={order.id}
                className={`bg-[#141418] border rounded-2xl p-4 space-y-3 transition-colors ${
                  order.status === 'nuevo' ? 'border-[#D95B26]/40 bg-[#D95B26]/[0.03]' : 'border-[#282830]'
                }`}
              >
                <div className="flex items-center justify-between border-b border-[#282830] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#F4F4F6]">{order.tableLabel}</span>
                    {order.orderType && order.orderType !== 'mesa' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-[#202028] text-amber-400">
                        {order.orderType === 'delivery' ? 'A domicilio' : 'Retiro'}
                      </span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1F1F28] text-[#9E9EA8] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeStr}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-[#F4F4F6]">{formatARS(order.totalArs)}</span>
                </div>

                {/* Datos de contacto para delivery o retiro */}
                {(order.customerName || order.customerPhone || order.customerAddress) && (
                  <div className="p-2.5 rounded-xl bg-[#181820] border border-[#282834] text-[11px] space-y-1 text-[#C4C4D0]">
                    {order.customerName && <div className="font-semibold text-white">Cliente: {order.customerName}</div>}
                    {order.customerPhone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#9E9EA8]" />
                        <span>{order.customerPhone}</span>
                      </div>
                    )}
                    {order.customerAddress && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#9E9EA8]" />
                        <span>{order.customerAddress}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Platos con cantidades */}
                <div className="space-y-1.5 text-xs text-[#F4F4F6]">
                  {order.items.map((it, idx) => (
                    <div key={idx} className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="font-medium">
                          <span className="font-bold text-amber-400 mr-1.5">{it.qty}x</span>
                          {it.name}
                        </span>
                        {it.note && <div className="text-[11px] text-[#9E9EA8] italic">Nota: {it.note}</div>}
                      </div>
                      <span className="text-[#9E9EA8] shrink-0 ml-2">{formatARS(it.subtotal)}</span>
                    </div>
                  ))}
                  {order.note && (
                    <div className="pt-1 text-[11px] text-amber-300 font-medium">
                      Aclaración: {order.note}
                    </div>
                  )}
                </div>

                {/* Acciones según estado */}
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#282830]">
                  <button
                    onClick={() => setCancelingOrder(order)}
                    className="text-xs text-[#9E9EA8] hover:text-rose-400 px-2 py-1.5 transition-colors"
                  >
                    Cancelar
                  </button>

                  <div className="flex items-center gap-2">
                    {order.status === 'nuevo' && (
                      <Button size="sm" onClick={() => handleAdvance(order)} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs">
                        Confirmar
                      </Button>
                    )}
                    {order.status === 'confirmado' && (
                      <Button size="sm" onClick={() => handleAdvance(order)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs">
                        Está listo
                      </Button>
                    )}
                    {order.status === 'listo' && (
                      <Button size="sm" onClick={() => handleAdvance(order)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs">
                        Entregado
                      </Button>
                    )}
                    {order.status === 'entregado' && (
                      <Button size="sm" onClick={() => handleAdvance(order)} className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs">
                        Cobrar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Cancelación con motivo */}
      <Modal isOpen={Boolean(cancelingOrder)} onClose={() => setCancelingOrder(null)} title="Cancelar comanda">
        <div className="space-y-4">
          <p className="text-xs text-[#9E9EA8]">Seleccioná el motivo antes de cancelar la comanda de {cancelingOrder?.tableLabel}:</p>
          <div className="space-y-2">
            {['Error al cargar pedido', 'El cliente se retiró', 'Plato sin stock en cocina', 'Mesa equivocada'].map((reason) => (
              <button
                key={reason}
                onClick={() => setCancelReason(reason)}
                className={`w-full text-left p-3 rounded-xl border text-xs transition-colors ${
                  cancelReason === reason ? 'border-amber-500 bg-amber-500/10 text-[#F4F4F6]' : 'border-[#282830] bg-[#141418] text-[#9E9EA8]'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setCancelingOrder(null)}>Volver</Button>
            <Button variant="danger" size="sm" onClick={handleConfirmCancel}>Confirmar cancelación</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
