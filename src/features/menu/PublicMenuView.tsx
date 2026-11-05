import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { PublicMenuData, MenuItem, OrderSlip } from '../../api/types';
import { formatARS } from '../../lib/format';
import { CheckCircle2, ShoppingBag, Plus, Minus, Trash2, AlertCircle, RefreshCw } from 'lucide-react';

interface CartItem {
  item: MenuItem;
  qty: number;
  note?: string;
}

export const PublicMenuView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<PublicMenuData | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready' | 'empty' | 'success'>('loading');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [generalNote, setGeneralNote] = useState('');
  const [submittedOrder, setSubmittedOrder] = useState<OrderSlip | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('');

  const loadMenu = async () => {
    if (!code) {
      setStatus('error');
      return;
    }
    try {
      setStatus('loading');
      const res = await api.getPublicMenu(code);
      setData(res);
      if (!res.items || res.items.length === 0) {
        setStatus('empty');
      } else {
        setStatus('ready');
        if (res.categories.length > 0) setActiveCategory(res.categories[0].id);
      }
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    loadMenu();
  }, [code]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const totalUnits = prev.reduce((sum, c) => sum + c.qty, 0);
      if (totalUnits >= 30) return prev;
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        if (existing.qty >= 20) return prev;
        return prev.map((c) => (c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.item.id === itemId) {
            const next = c.qty + delta;
            return next > 0 && next <= 20 ? { ...c, qty: next } : null;
          }
          return c;
        })
        .filter((c): c is CartItem => c !== null)
    );
  };

  const totalCount = cart.reduce((sum, c) => sum + c.qty, 0);
  const totalArs = cart.reduce((sum, c) => sum + c.item.price * c.qty, 0);

  const handleSendOrder = async () => {
    if (cart.length === 0 || !data || submitting) return;
    try {
      setSubmitting(true);
      const itemsPayload = cart.map((c) => ({
        itemId: c.item.id,
        qty: c.qty,
        note: c.note,
      }));
      const order = await api.createOrder({
        tableCode: data.tableCode,
        items: itemsPayload,
        note: generalNote.trim() || undefined,
      });
      setSubmittedOrder(order);
      setCart([]);
      setShowDrawer(false);
      setStatus('success');
    } catch {
      // Manejo de error
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#9E9EA8]">Cargando la carta...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] flex items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-base font-semibold">Esta carta no está disponible.</h1>
          <p className="text-xs text-[#9E9EA8]">Verificá que el código QR sea correcto o solicitá asistencia al mozo.</p>
          <button
            onClick={loadMenu}
            className="h-12 px-6 rounded-xl bg-[#1A1A22] border border-[#282830] text-xs font-medium text-white inline-flex items-center gap-2 focus:ring-2 focus:ring-amber-400"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar</span>
          </button>
        </div>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] flex items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-3">
          <h1 className="text-base font-semibold">La carta está vacía</h1>
          <p className="text-xs text-[#9E9EA8]">El local todavía no cargó platos en esta carta.</p>
        </div>
      </div>
    );
  }

  if (status === 'success' && submittedOrder) {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] flex flex-col justify-between p-6 max-w-md mx-auto">
        <div className="py-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
          <h1 className="text-2xl font-bold tracking-tight">Listo, tu pedido llegó al local</h1>
          <div className="text-sm font-medium text-amber-400">{submittedOrder.tableLabel}</div>
          <div className="bg-[#141418] border border-[#282830] rounded-2xl p-4 text-left space-y-2">
            <div className="text-xs font-semibold text-[#9E9EA8] border-b border-[#282830] pb-2">Resumen enviado:</div>
            {submittedOrder.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span>{it.qty}x {it.name}</span>
                <span className="text-[#9E9EA8]">{formatARS(it.subtotal)}</span>
              </div>
            ))}
            <div className="border-t border-[#282830] pt-2 flex justify-between text-sm font-bold">
              <span>Total comanda</span>
              <span>{formatARS(submittedOrder.totalArs)}</span>
            </div>
          </div>
          <p className="text-xs text-[#9E9EA8]">Pagás al final en la caja.</p>
        </div>
        <button
          onClick={() => setStatus('ready')}
          className="h-12 w-full rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-amber-400"
        >
          Pedir otra cosa
        </button>
      </div>
    );
  }

  const filteredItems = activeCategory ? data?.items.filter((i) => i.categoryId === activeCategory) : data?.items;

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] pb-28">
      {/* Encabezado limpio con logo, nombre y mesa */}
      <header className="sticky top-0 z-30 bg-[#0C0C0E]/95 backdrop-blur-md border-b border-[#282830] px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-black font-bold flex items-center justify-center text-xs">
              {data?.businessName?.charAt(0) || 'T'}
            </div>
            <div>
              <div className="text-xs font-bold text-[#F4F4F6] leading-none">{data?.businessName}</div>
              <div className="text-[11px] text-[#9E9EA8] mt-0.5">Carta digital</div>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
            {data?.tableLabel}
          </span>
        </div>

        {/* Pestañas de categorías con salto rápido */}
        {data && data.categories.length > 0 && (
          <div className="max-w-md mx-auto flex gap-1.5 overflow-x-auto pt-2.5 scrollbar-none">
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-medium shrink-0 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                  activeCategory === cat.id ? 'bg-white text-black font-bold' : 'bg-[#18181D] text-[#9E9EA8]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Lista de Platos */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-3">
        {filteredItems?.map((item) => (
          <div
            key={item.id}
            className={`p-3.5 rounded-2xl border transition-colors flex items-center justify-between gap-3 ${
              item.available ? 'bg-[#141418] border-[#282830]' : 'bg-[#101014] border-[#1C1C22] opacity-50'
            }`}
          >
            <div className="space-y-0.5 flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#F4F4F6]">{item.name}</div>
              {item.description && <p className="text-xs text-[#9E9EA8] line-clamp-2">{item.description}</p>}
              <div className="text-xs font-bold text-amber-400 pt-0.5">{formatARS(item.price)}</div>
            </div>
            <button
              disabled={!item.available}
              onClick={() => addToCart(item)}
              className={`h-12 min-w-[76px] px-3.5 rounded-xl text-xs font-semibold shrink-0 transition-colors focus:ring-2 focus:ring-amber-400 ${
                item.available ? 'bg-amber-400 hover:bg-amber-300 text-black' : 'bg-[#1E1E26] text-[#70707E] cursor-not-allowed'
              }`}
            >
              {item.available ? 'Agregar' : 'No disponible'}
            </button>
          </div>
        ))}
      </main>

      {/* Barra fija inferior */}
      {totalCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-[#0C0C0E] to-transparent">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setShowDrawer(true)}
              className="w-full h-12 px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm flex items-center justify-between shadow-lg transition-transform active:scale-[0.98] focus:ring-2 focus:ring-amber-400"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span>Ver mi pedido ({totalCount})</span>
              </div>
              <span>{formatARS(totalArs)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Drawer / Modal de Resumen del Pedido */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#141418] border-t border-[#282830] rounded-t-3xl max-w-md mx-auto w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#282830] pb-3">
              <h2 className="text-base font-bold text-[#F4F4F6]">Tu pedido en {data?.tableLabel}</h2>
              <button onClick={() => setShowDrawer(false)} className="text-xs text-[#9E9EA8] hover:text-[#F4F4F6]">Cerrar</button>
            </div>
            <div className="space-y-3">
              {cart.map((c) => (
                <div key={c.item.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="text-xs font-semibold truncate">{c.item.name}</div>
                    <div className="text-[11px] text-[#9E9EA8]">{formatARS(c.item.price * c.qty)}</div>
                  </div>
                  <div className="flex items-center gap-2 bg-[#1A1A22] rounded-xl p-1 border border-[#282830]">
                    <button onClick={() => updateQty(c.item.id, -1)} className="p-1 hover:text-amber-400"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="text-xs font-bold w-5 text-center">{c.qty}</span>
                    <button onClick={() => updateQty(c.item.id, 1)} className="p-1 hover:text-amber-400"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9E9EA8] mb-1">Aclaración para la cocina (opcional)</label>
              <input
                type="text"
                placeholder="Ej. sin cebolla, el café bien caliente"
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#1A1A22] border border-[#282830] text-xs text-[#F4F4F6] focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[#282830]">
              <span className="text-sm font-bold">Total a pagar en caja</span>
              <span className="text-base font-bold text-amber-400">{formatARS(totalArs)}</span>
            </div>
            <button
              disabled={submitting}
              onClick={handleSendOrder}
              className="w-full h-12 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors focus:ring-2 focus:ring-amber-400"
            >
              {submitting ? 'Enviando...' : 'Enviar pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
