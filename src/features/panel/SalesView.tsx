import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Sale, Cartel, PaymentMethod } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../../lib/formatters';
import {
  Receipt,
  Plus,
  Filter,
  CreditCard,
  QrCode,
  Calendar,
} from 'lucide-react';

export const SalesView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedCartel, setSelectedCartel] = useState<string>('all');

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const [salesData, cartelesData] = await Promise.all([
        api.listSales({
          method: selectedMethod === 'all' ? undefined : (selectedMethod as PaymentMethod),
          cartelId: selectedCartel === 'all' ? undefined : selectedCartel,
        }),
        api.listCarteles(),
      ]);
      setSales(salesData);
      setCarteles(cartelesData);
    } catch {
      // Ignorar
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [selectedMethod, selectedCartel]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
            Ventas
          </h1>
          <p className="text-xs text-white/70 mt-0.5">
            Registro de cobros emitidos en mostrador y mesas.
          </p>
        </div>

        <Link to="/caja">
          <Button variant="estrella" size="sm" icon={<Plus className="w-3.5 h-3.5 text-[#0B1030]" />}>
            Nuevo cobro
          </Button>
        </Link>
      </div>

      {/* Barra de Filtros Liquid Glass */}
      <div className="p-3.5 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/15 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-white/70 px-2 font-medium">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtrar por:</span>
        </div>

        {/* Medio de Pago */}
        <select
          value={selectedMethod}
          onChange={(e) => setSelectedMethod(e.target.value)}
          className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:bg-white/15"
        >
          <option value="all" className="bg-[#141824] text-white">Todos los medios</option>
          <option value="mp_qr" className="bg-[#141824] text-white">Mercado Pago QR</option>
          <option value="cash" className="bg-[#141824] text-white">Efectivo</option>
          <option value="card_manual" className="bg-[#141824] text-white">Posnet / Tarjeta</option>
        </select>

        {/* Caja */}
        <select
          value={selectedCartel}
          onChange={(e) => setSelectedCartel(e.target.value)}
          className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:bg-white/15"
        >
          <option value="all" className="bg-[#141824] text-white">Todas las cajas</option>
          {carteles.map(c => (
            <option key={c.id} value={c.id} className="bg-[#141824] text-white">
              {c.name} ({c.code})
            </option>
          ))}
        </select>
      </div>

      {/* Tabla de Ventas en Liquid Glass */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 rounded-2xl bg-white/10" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12 space-y-4 text-white">
            <div className="w-14 h-14 rounded-3xl bg-white/10 flex items-center justify-center mx-auto text-[#FFC21A] border border-white/15">
              <Receipt className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-lg text-white">No hay ventas registradas</h3>
              <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed">
                Cuando el cajero registre un cobro en la pantalla de Caja, aparecerá detallado en este listado.
              </p>
            </div>
            <Link to="/caja">
              <Button variant="estrella" size="sm" icon={<CreditCard className="w-4 h-4 text-[#0B1030]" />}>
                Abrir Caja
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/15 bg-white/5 text-white/70 font-semibold">
                  <th className="py-3 px-4">Fecha y hora</th>
                  <th className="py-3 px-4">Caja / Cartel</th>
                  <th className="py-3 px-4">Concepto / Ítems</th>
                  <th className="py-3 px-4">Medio de pago</th>
                  <th className="py-3 px-4 text-right">Importe</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sales.map((sale) => {
                  const methodLabel = sale.method === 'mp_qr' ? 'Mercado Pago QR' : sale.method === 'cash' ? 'Efectivo' : 'Posnet';
                  const itemsCount = sale.items.reduce((acc, it) => acc + it.quantity, 0);

                  return (
                    <tr key={sale.id} className="hover:bg-white/[0.05] transition text-white">
                      <td className="py-3.5 px-4 font-mono text-white/60">
                        {formatDate(sale.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <span className="cartel-code bg-white/10 px-2.5 py-1 rounded-lg border border-white/20">
                          {sale.cartelName || 'Caja'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-white">
                        <div className="font-medium text-white">
                          {sale.items[0]?.name || 'Consumo'}
                          {sale.items.length > 1 && (
                            <span className="text-white/60"> (+{sale.items.length - 1} más)</span>
                          )}
                        </div>
                        <span className="text-[10px] text-white/50">
                          {itemsCount} ítem(s) en total
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-white/80 font-medium">
                        {methodLabel}
                      </td>
                      <td className="py-3.5 px-4 text-right font-display font-bold text-sm text-white tabular-nums">
                        {formatCurrency(sale.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {sale.status === 'paid' && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#19C37D]/20 text-[#19C37D] border border-[#19C37D]/30">
                            Cobrada
                          </span>
                        )}
                        {sale.status === 'pending' && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFC21A]/20 text-[#FFC21A] border border-[#FFC21A]/30">
                            Pendiente
                          </span>
                        )}
                        {sale.status === 'cancelled' && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6B6B]/20 text-[#FF6B6B] border border-[#FF6B6B]/30">
                            Anulada
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
