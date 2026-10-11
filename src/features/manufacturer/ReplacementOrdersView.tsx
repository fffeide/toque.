/**
 * Toque — Bandeja de Pedidos de Reposición (ReplacementOrdersView)
 * Permite al taller fabricante gestionar las reposiciones solicitadas por sus clientes.
 */

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ReplacementOrder } from '../../api/types';
import { api } from '../../api';
import { formatDateTime } from '../../lib/formatters';
import { useToast } from '../../components/ui/Toast';
import {
  RotateCcw,
  CheckCircle2,
  Clock,
  Package,
  Check,
  ExternalLink,
  Store,
  AlertCircle,
  Truck,
} from 'lucide-react';

interface ReplacementOrdersViewProps {
  orders: ReplacementOrder[];
  onOrderUpdated?: () => void;
}

export const ReplacementOrdersView: React.FC<ReplacementOrdersViewProps> = ({
  orders,
  onOrderUpdated,
}) => {
  const { success, error: toastError } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const reasonLabels: Record<string, string> = {
    chip_failure: 'Chip NFC no lee / intermitente',
    broken: 'Cartel roto o deteriorado',
    lost: 'Cartel extraviado',
    design_update: 'Actualización gráfica / cambio de mesa',
  };

  const handleUpdateStatus = async (orderId: string, status: ReplacementOrder['status']) => {
    setUpdatingId(orderId);
    try {
      await api.updateReplacementOrderStatus(orderId, status);
      success('Estado actualizado', `El pedido ahora figura como ${status === 'completed' ? 'entregado' : status === 'in_progress' ? 'en grabado' : 'pendiente'}.`);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err) {
      toastError('Error al actualizar', err instanceof Error ? err.message : 'Error');
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = orders.filter((o) => o.status !== 'completed').length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-title-2 font-bold text-[var(--text-main)] flex items-center gap-2">
            <span>Pedidos de Reposición y Reemplazos</span>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--ambar)]/20 text-[var(--ambar)] text-micro font-bold">
                {pendingCount} pendientes
              </span>
            )}
          </h2>
          <p className="text-small text-[var(--text-muted)] mt-0.5">
            Solicitudes automáticas enviadas por tus negocios cuando un cartel se daña o pierde.
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-[var(--menta)] mx-auto" />
          <h3 className="font-display text-body font-bold text-[var(--text-main)]">
            No hay pedidos de reposición pendientes
          </h3>
          <p className="text-small text-[var(--text-muted)] max-w-sm mx-auto">
            Cuando un cliente solicite un reemplazo desde su panel de carteles, aparecerá de inmediato en esta bandeja.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isCompleted = order.status === 'completed';
            const isInProgress = order.status === 'in_progress';

            return (
              <Card
                key={order.id}
                className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                  isCompleted ? 'opacity-70 bg-black/[0.01] dark:bg-white/[0.01]' : 'border-[var(--brand)]/30'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-body font-bold text-[var(--text-main)]">
                      {order.businessName}
                    </span>
                    <span className="text-micro font-mono bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded text-[var(--brand)] font-bold">
                      toque.ar/{order.shortCode}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        isCompleted
                          ? 'bg-[var(--menta)]/15 text-[var(--menta)]'
                          : isInProgress
                          ? 'bg-[var(--ultramar)]/15 text-[var(--ultramar)]'
                          : 'bg-[var(--ambar)]/15 text-[var(--ambar)]'
                      }`}
                    >
                      {isCompleted ? 'Entregado' : isInProgress ? 'En Grabado' : 'Pendiente Taller'}
                    </span>
                  </div>

                  <p className="text-small text-[var(--text-muted)]">
                    Cartel: <strong className="text-[var(--text-main)]">{order.cartelName}</strong> • Motivo: <span className="font-medium text-[var(--text-main)]">{reasonLabels[order.reason] || order.reason}</span>
                  </p>

                  <p className="text-micro text-[var(--text-muted)]">
                    Solicitado el {formatDateTime(order.requestedAt)}
                    {order.completedAt && ` • Entregado el ${formatDateTime(order.completedAt)}`}
                  </p>
                </div>

                {/* Acciones de estado */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {order.status === 'pending' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleUpdateStatus(order.id, 'in_progress')}
                      isLoading={updatingId === order.id}
                      icon={<Package className="w-3.5 h-3.5" />}
                    >
                      Pasar a grabado
                    </Button>
                  )}

                  {order.status === 'in_progress' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleUpdateStatus(order.id, 'completed')}
                      isLoading={updatingId === order.id}
                      icon={<Check className="w-3.5 h-3.5" />}
                    >
                      Marcar entregado
                    </Button>
                  )}

                  {order.status === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdateStatus(order.id, 'pending')}
                      isLoading={updatingId === order.id}
                    >
                      Reabrir pedido
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
