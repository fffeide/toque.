import React, { useState, useEffect } from 'react';
import { api, MercadoPagoStatus } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/formatters';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export const ConnectionsView: React.FC = () => {
  const [status, setStatus] = useState<MercadoPagoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const { success, error: toastError } = useToast();

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const data = await api.getMercadoPagoStatus();
      setStatus(data);
    } catch {
      // Ignorar
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await api.connectMercadoPago();
      success('Mercado Pago conectado', 'Tu cuenta quedó vinculada para cobrar con QR dinámico.');
      loadStatus();
    } catch (err) {
      toastError('No pudimos conectar con Mercado Pago', err instanceof Error ? err.message : 'Probá de nuevo.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Desconectar Mercado Pago? No podrás cobrar con QR dinámico en la caja hasta reconectarlo.')) return;
    try {
      await api.disconnectMercadoPago();
      success('Mercado Pago desconectado');
      loadStatus();
    } catch {
      toastError('Error al desconectar');
    }
  };

  if (isLoading || !status) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-white/10" />
        <Skeleton className="h-44 w-full rounded-2xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
          Conexiones
        </h1>
        <p className="text-xs text-white/70 mt-0.5">
          Vinculá tu pasarela de pagos para habilitar el cobro con QR directo en caja.
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#009EE3]/25 text-[#009EE3] flex items-center justify-center font-bold text-lg border border-[#009EE3]/40">
              MP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-white">
                  Mercado Pago
                </h2>
                {status.connected ? (
                  <span className="text-[10px] font-bold text-[#19C37D] bg-[#19C37D]/20 border border-[#19C37D]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Conectado
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-white/60 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                    No conectado
                  </span>
                )}
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Generá códigos QR en vivo con monto exacto en la pantalla de Caja.
              </p>
            </div>
          </div>

          <div>
            {status.connected ? (
              <Button
                variant="secundario"
                size="sm"
                onClick={handleDisconnect}
                className="text-[#FF6B6B] bg-white/10 border-white/20 hover:bg-white/15"
              >
                Desconectar cuenta
              </Button>
            ) : (
              <Button
                variant="estrella"
                size="touch"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? 'Conectando…' : 'Conectar Mercado Pago'}
              </Button>
            )}
          </div>
        </div>

        {/* Detalles del Estado */}
        {status.connected ? (
          <div className="space-y-3 text-xs bg-white/[0.06] p-4 rounded-2xl border border-white/10 text-white">
            <div className="flex justify-between">
              <span className="text-white/60">ID de Cobrador:</span>
              <span className="font-mono font-semibold text-white">{status.collectorId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Fecha de vinculación:</span>
              <span className="text-white">{status.connectedAt ? formatDate(status.connectedAt) : 'Activa'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Estado de cobro en caja:</span>
              <span className="font-bold text-[#19C37D]">Listo para operar</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white/[0.08] border border-white/15 text-xs text-white space-y-1 leading-relaxed">
            <p className="font-bold text-[#FFC21A]">Aviso sobre el funcionamiento en caja:</p>
            <p className="text-white/70">
              Aunque no tengas Mercado Pago conectado, podés seguir cobrando normalmente con <strong>Efectivo</strong> y <strong>Posnet / Tarjeta manual</strong> en la pantalla de Caja. Los comprobantes y el club funcionarán exactamente igual.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
