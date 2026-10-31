import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Sale, PaymentMethod } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDateTime, formatPaymentMethod } from '../../lib/formatters';
import { Receipt, CreditCard, ExternalLink, CheckCircle2, Clock, XCircle } from 'lucide-react';

export const SalesView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMethod, setFilterMethod] = useState<PaymentMethod | 'all'>('all');

  useEffect(() => {
    const unsub = api.subscribeToBusinessSales((liveSales) => {
      setSales(liveSales);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredSales =
    filterMethod === 'all' ? sales : sales.filter((s) => s.method === filterMethod);

  const paidSales = filteredSales.filter((s) => s.status === 'paid');
  const totalAmount = paidSales.reduce((acc, curr) => acc + curr.amount, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 bg-[#111113]" />
        <Skeleton className="h-72 w-full bg-[#111113]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="block text-[11px] tracking-wider text-[#a1a1aa] font-semibold mb-1">
            Auditoría de mostrador en tiempo real
          </span>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">
            Ventas y recibos digitales
          </h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">
            Historial actualizado en vivo con la terminal de caja y los comprobantes emitidos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#111113] px-4 py-2.5 rounded-xl border border-[#242426]">
            <span className="text-[11px] tracking-wider text-[#a1a1aa] block font-semibold">
              Total cobrado ({paidSales.length})
            </span>
            <span className="text-lg font-bold font-mono text-[#34d399]">
              {formatCurrency(totalAmount)}
            </span>
          </div>
          <Link to="/caja">
            <Button variant="primary" size="md">
              <CreditCard className="w-4 h-4 mr-1.5" />
              Ir a Caja
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros por medio de pago */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'mp_qr', 'cash', 'card_manual'] as const).map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => setFilterMethod(method)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              filterMethod === method
                ? 'bg-[#bec8ff] text-[#0c0c0c]'
                : 'bg-[#111113] border border-[#242426] text-[#a1a1aa] hover:text-[#f1f1ee]'
            }`}
          >
            {method === 'all' ? 'Todos los medios' : formatPaymentMethod(method)}
          </button>
        ))}
      </div>

      {filteredSales.length === 0 ? (
        <Card>
          <EmptyState
            icon="🧾"
            title="Sin ventas registradas para este filtro"
            description="Emití un cobro desde la pantalla de Caja para ver el comprobante digital aparecer al instante."
            actionLabel="Abrir Terminal de Caja"
            onAction={() => {
              window.location.href = '/caja';
            }}
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#242426] bg-[#141416] text-[11px] font-semibold text-[#a1a1aa]">
                  <th className="py-3.5 px-4">Fecha y hora</th>
                  <th className="py-3.5 px-4">Detalle / nota</th>
                  <th className="py-3.5 px-4">Cartel</th>
                  <th className="py-3.5 px-4">Medio de pago</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Monto</th>
                  <th className="py-3.5 px-4 text-right">Recibo digital</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242426] text-sm">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-[#18181b]/60 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap text-[#a1a1aa] text-xs">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-[#f1f1ee] font-medium">
                      <div>
                        {sale.note ||
                          (sale.items && sale.items.length > 0
                            ? sale.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')
                            : 'Cobro de mostrador')}
                      </div>
                      {sale.cashierName && (
                        <span className="text-[11px] text-[#a1a1aa]">
                          Emitido por: {sale.cashierName}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs text-[#bec8ff] font-bold">
                        {sale.cartelCode || 'CAJA01'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-[#f1f1ee]">
                      {formatPaymentMethod(sale.method)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {sale.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#34d399]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Cobrado
                        </span>
                      ) : sale.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                          <Clock className="w-3.5 h-3.5" />
                          Pendiente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400">
                          <XCircle className="w-3.5 h-3.5" />
                          Cancelado
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono font-bold text-[#f1f1ee]">
                      {formatCurrency(sale.amount)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      {sale.receiptId ? (
                        <Link
                          to={`/r/${sale.receiptId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#bec8ff] hover:text-[#d6daf6]"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Ver recibo</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-[#a1a1aa]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
