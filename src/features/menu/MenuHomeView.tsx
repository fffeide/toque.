import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { OrderSlip, MenuItem, RestaurantTable } from '../../api/types';
import { formatARS } from '../../lib/format';
import { ReceiptText, DollarSign, Utensils, AlertTriangle, ArrowRight, Grid3X3, CreditCard } from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';

export const MenuHomeView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderSlip[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersData, menuData, tablesData] = await Promise.all([
        api.listOrders(),
        api.listMenu(),
        api.listTables(),
      ]);
      setOrders(ordersData);
      setItems(menuData.items || []);
      setTables(tablesData || []);
    } catch {
      // Manejo silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-28 rounded-2xl bg-[#141418]" />
          <Skeleton className="h-28 rounded-2xl bg-[#141418]" />
          <Skeleton className="h-28 rounded-2xl bg-[#141418]" />
        </div>
        <Skeleton className="h-24 rounded-2xl bg-[#141418]" />
      </div>
    );
  }

  // 1. Comandas abiertas: estado nuevo, confirmado o listo
  const openOrders = orders.filter(
    (o) => o.status === 'nuevo' || o.status === 'confirmado' || o.status === 'listo'
  );

  // 2. Vendido hoy: comandas pagadas/entregadas hoy
  const todayStr = new Date().toISOString().slice(0, 10);
  const soldToday = orders
    .filter(
      (o) =>
        (o.status === 'cobrado' || o.status === 'entregado') &&
        o.createdAt.startsWith(todayStr)
    )
    .reduce((sum, o) => sum + (o.totalArs || 0), 0);

  // 3. Platos publicados y disponibles
  const publishedDishes = items.filter((i) => i.available);

  // Avisos contextuales
  const hasNoTables = tables.length === 0;
  const hasNoDishes = items.length === 0;

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* 3 Métricas Clave */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/panel/carta/comandas"
          className="bg-[#141418] border border-[#282830] hover:border-[#383844] rounded-2xl p-4 flex flex-col justify-between transition-colors group"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2">
            <ReceiptText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#F4F4F6] group-hover:text-white">
              {openOrders.length}
            </div>
            <div className="text-xs text-[#9E9EA8] font-medium leading-tight">
              Comandas abiertas
            </div>
          </div>
        </Link>

        <div className="bg-[#141418] border border-[#282830] rounded-2xl p-4 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-bold text-[#F4F4F6] truncate">
              {formatARS(soldToday)}
            </div>
            <div className="text-xs text-[#9E9EA8] font-medium leading-tight">
              Vendido hoy
            </div>
          </div>
        </div>

        <Link
          to="/panel/carta/platos"
          className="bg-[#141418] border border-[#282830] hover:border-[#383844] rounded-2xl p-4 flex flex-col justify-between transition-colors group"
        >
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#F4F4F6] group-hover:text-white">
              {publishedDishes.length}
            </div>
            <div className="text-xs text-[#9E9EA8] font-medium leading-tight">
              Platos publicados
            </div>
          </div>
        </Link>
      </div>

      {/* Avisos contextuales */}
      {hasNoTables ? (
        <div className="bg-[#18181D] border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-semibold text-[#F4F4F6]">
              Todavía no cargaste mesas
            </h3>
            <p className="text-xs text-[#9E9EA8]">
              Cargá los números de tus mesas para que los clientes puedan escanear el QR y hacer sus pedidos.
            </p>
            <div className="pt-2">
              <Link
                to="/panel/carta/mesas"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300"
              >
                <span>Cargar mis mesas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : hasNoDishes ? (
        <div className="bg-[#18181D] border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-semibold text-[#F4F4F6]">
              Tu carta está vacía
            </h3>
            <p className="text-xs text-[#9E9EA8]">
              Agregá categorías y platos para que tus clientes puedan ver la carta digital en sus celulares.
            </p>
            <div className="pt-2">
              <Link
                to="/panel/carta/platos"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300"
              >
                <span>Cargar platos</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#141418] border border-[#282830] rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-[#F4F4F6]">
              Mesas listas para atender
            </span>
            <p className="text-xs text-[#9E9EA8]">
              {tables.length} mesas activas listas para recibir pedidos.
            </p>
          </div>
          <Link
            to="/panel/carta/mesas"
            className="text-xs px-3 py-1.5 rounded-xl bg-[#202028] text-[#F4F4F6] hover:bg-[#282834] transition-colors"
          >
            Ver QR de mesas
          </Link>
        </div>
      )}

      {/* Accesos rápidos */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-[#9E9EA8]">Acciones frecuentes</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/panel/carta/comandas"
            className="p-3.5 bg-[#141418] border border-[#282830] hover:border-[#383844] rounded-xl flex items-center gap-3 transition-colors"
          >
            <ReceiptText className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="text-left">
              <div className="text-xs font-semibold text-[#F4F4F6]">Ver comandas</div>
              <div className="text-[11px] text-[#9E9EA8]">Cocina y salón</div>
            </div>
          </Link>
          <Link
            to="/caja"
            className="p-3.5 bg-[#141418] border border-[#282830] hover:border-[#383844] rounded-xl flex items-center gap-3 transition-colors"
          >
            <CreditCard className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-left">
              <div className="text-xs font-semibold text-[#F4F4F6]">Abrir la caja</div>
              <div className="text-[11px] text-[#9E9EA8]">Cobros y vueltos</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
