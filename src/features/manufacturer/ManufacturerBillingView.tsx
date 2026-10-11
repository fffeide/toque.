/**
 * Toque — Plan y Facturación del Fabricante (ManufacturerBillingView)
 * Características:
 * - Plan actual, cupo usado y packs extra (+10, +25, +50 carteles)
 * - Facturas históricas descargables
 * - Método de pago guardado
 * - Regla de gracia obligatoria explicada: "15 días de gracia, panel en solo lectura, los carteles activos NUNCA se cortan"
 */

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ManufacturerPlan, InvoiceItem } from '../../api/types';
import { api } from '../../api';
import { formatNumber } from '../../lib/formatters';
import { useToast } from '../../components/ui/Toast';
import {
  CreditCard,
  Layers,
  ShieldCheck,
  Plus,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface ManufacturerBillingViewProps {
  plan: ManufacturerPlan;
  invoices: InvoiceItem[];
  manufacturerId: string;
  onPlanUpdated?: () => void;
}

export const ManufacturerBillingView: React.FC<ManufacturerBillingViewProps> = ({
  plan,
  invoices,
  manufacturerId,
  onPlanUpdated,
}) => {
  const { success, error: toastError } = useToast();
  const [isAddingPack, setIsAddingPack] = useState(false);

  const usagePercentage = Math.round((plan.cartelesUsed / plan.cartelesLimit) * 100);
  const remainingCartels = Math.max(0, plan.cartelesLimit - plan.cartelesUsed);

  const handleAddPack = async (packSize: number) => {
    setIsAddingPack(true);
    try {
      await api.addCartelesPack(manufacturerId, packSize);
      success(
        'Cupo ampliado al instante',
        `Se sumaron +${packSize} carteles a tu cuenta. Nuevo límite: ${plan.cartelesLimit + packSize} carteles.`
      );
      if (onPlanUpdated) onPlanUpdated();
    } catch (err) {
      toastError('Error al agregar cupo', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsAddingPack(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* Encabezado */}
      <div>
        <h2 className="text-xl sm:text-2xl font-headline font-bold text-white">
          Plan y Facturación del Taller
        </h2>
        <p className="text-xs text-white/70 mt-0.5">
          Gestión de cupo de carteles, paquetes de expansión y comprobantes de pago.
        </p>
      </div>

      {/* 1. ESTADO DEL PLAN Y CUPO UTILIZADO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 space-y-6 border-white/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase font-semibold text-emerald-300 tracking-wider block">
                Suscripción Activa
              </span>
              <h3 className="text-xl font-headline font-bold text-white mt-0.5">
                {plan.planName}
              </h3>
            </div>

            <div className="text-right">
              <span className="text-2xl font-headline font-bold text-white">
                ${formatNumber(plan.pricePerMonth)}
              </span>
              <span className="text-xs text-white/60"> {plan.currency} /mes</span>
            </div>
          </div>

          {/* Barra de Cupo de Carteles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-small">
              <span className="font-medium text-[var(--text-main)]">
                Cupo de carteles en servicio:
              </span>
              <span className="font-mono text-small text-[var(--text-muted)]">
                <strong className="text-[var(--text-main)]">{plan.cartelesUsed}</strong> de {plan.cartelesLimit} carteles ({remainingCartels} disponibles)
              </span>
            </div>

            <div className="h-3 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usagePercentage > 90
                    ? 'bg-[var(--coral)]'
                    : usagePercentage > 75
                    ? 'bg-[var(--ambar)]'
                    : 'bg-[var(--brand)]'
                }`}
                style={{ width: `${Math.min(100, usagePercentage)}%` }}
              />
            </div>
          </div>

          {/* Paquetes Extra de Carteles */}
          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
            <span className="text-small font-semibold text-[var(--text-main)] block">
              Ampliar cupo con packs extra inmediatos:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { size: 10, price: '$4.500' },
                { size: 25, price: '$9.900' },
                { size: 50, price: '$17.500' },
              ].map((pack) => (
                <div
                  key={pack.size}
                  className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-col justify-between space-y-3"
                >
                  <div>
                    <span className="font-display text-body font-bold text-[var(--text-main)]">
                      +{pack.size} carteles
                    </span>
                    <p className="text-micro text-[var(--text-muted)] font-mono mt-0.5">
                      {pack.price} /mes
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddPack(pack.size)}
                    isLoading={isAddingPack}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Agregar cupo
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* MÉTODO DE PAGO Y PRÓXIMO COBRO */}
        <Card className="p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h4 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Método de Pago Guardado</span>
            </h4>

            <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-small text-[var(--text-main)]">
                  {plan.paymentMethod.brand} terminada en {plan.paymentMethod.last4}
                </span>
                <span className="text-micro text-[var(--menta)] font-medium">✓ Activa</span>
              </div>
              <p className="text-micro text-[var(--text-muted)] font-mono">
                Vencimiento: {plan.paymentMethod.expiry}
              </p>
            </div>

            <div className="space-y-1 text-micro text-[var(--text-muted)]">
              <span className="block">Próxima renovación automática:</span>
              <p className="font-medium text-[var(--text-main)]">
                {plan.nextBillingDate} (${formatNumber(plan.pricePerMonth)} {plan.currency})
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="w-full justify-center">
            Cambiar tarjeta de pago
          </Button>
        </Card>
      </div>

      {/* 2. CLÁUSULA DE GARANTÍA: QUÉ PASA SI SE VENCE LA SUSCRIPCIÓN */}
      <div className="p-5 rounded-2xl bg-[var(--ultramar)]/5 border border-[var(--ultramar)]/25 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-small text-[var(--brand)]">
          <ShieldCheck className="w-5 h-5 text-[var(--brand)] shrink-0" />
          <span>Garantía de Continuidad Física de Toque: ¿Qué pasa si vence el plan?</span>
        </div>
        <p className="text-micro text-[var(--text-muted)] leading-relaxed">
          En caso de falta de pago, disponés de <strong className="text-[var(--text-main)]">15 días de gracia</strong> donde el panel queda en modo solo lectura. <strong className="text-[var(--text-main)] underline">Los carteles activos en las mesas NUNCA se cortan</strong>: continúan redirigiendo a los comensales a la ficha de Google Reviews pase lo que pase, cuidando tu reputación ante tus clientes.
        </p>
      </div>

      {/* 3. HISTORIAL DE FACTURAS */}
      <div className="space-y-3">
        <h3 className="font-display text-small font-semibold text-[var(--text-main)]">
          Facturas y Comprobantes Descargables
        </h3>

        <div className="space-y-2">
          {invoices.map((inv) => (
            <Card key={inv.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-[var(--text-muted)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--menta)]" />
                </div>
                <div>
                  <span className="font-medium text-small text-[var(--text-main)] block font-mono">
                    {inv.number}
                  </span>
                  <span className="text-micro text-[var(--text-muted)]">
                    Emitida el {inv.date} • Pagada
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono text-small font-bold text-[var(--text-main)]">
                  ${formatNumber(inv.amount)} {inv.currency}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    success('Descargando factura', `Comprobante ${inv.number} en PDF.`);
                  }}
                  icon={<Download className="w-3.5 h-3.5" />}
                >
                  PDF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
