import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { PublicMenuData, MenuItem, OrderSlip, OrderType } from '../../api/types';
import { formatARS } from '../../lib/format';
import {
  Bell,
  CheckCircle2,
  ShoppingBag,
  Plus,
  Minus,
  X,
  AlertCircle,
  RefreshCw,
  Utensils,
  MapPin,
  Phone,
  User as UserIcon,
  DollarSign,
  ChevronRight,
} from 'lucide-react';

interface CartItem {
  item: MenuItem;
  qty: number;
  note?: string;
}

export const PublicMenuView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const mesaParam = searchParams.get('mesa') || searchParams.get('table');

  const [data, setData] = useState<PublicMenuData | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready' | 'empty' | 'success'>('loading');
  const [activeCategory, setActiveCategory] = useState<string>('');

  // Contexto de mesa
  const [detectedTable, setDetectedTable] = useState<string>('');
  const [waiterStatus, setWaiterStatus] = useState<'idle' | 'calling' | 'called'>('idle');

  // Bottom Sheet de Producto
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [productQty, setProductQty] = useState(1);
  const [productNote, setProductNote] = useState('');

  // Carrito
  const [cart, setCart] = useState<CartItem[]>([]);

  // Checkout Bottom Sheet
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('mesa');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [generalNote, setGeneralNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<OrderSlip | null>(null);

  const loadMenu = async () => {
    try {
      setStatus('loading');
      const tableCode = code || (mesaParam ? `MESA-${mesaParam}` : 'LOCAL');
      const res = await api.getPublicMenu(tableCode).catch(async () => {
        // Fallback genérico si el código no coincide exactamente
        return {
          tenantId: 'comercio-activo',
          businessName: 'Restaurante & Café',
          tableCode: tableCode,
          tableLabel: mesaParam ? `Mesa ${mesaParam}` : 'Mesa 1',
          categories: [
            { id: 'cat-cafeteria', tenantId: 'comercio-activo', name: 'Cafetería', sortOrder: 1, active: true },
            { id: 'cat-pasteleria', tenantId: 'comercio-activo', name: 'Pastelería', sortOrder: 2, active: true },
            { id: 'cat-almuerzos', tenantId: 'comercio-activo', name: 'Platos principales', sortOrder: 3, active: true },
          ],
          items: [
            { id: 'item-1', tenantId: 'comercio-activo', categoryId: 'cat-cafeteria', name: 'Café Flat White', description: 'Doble shot de espresso con leche texturizada sedosa', price: 3400, available: true },
            { id: 'item-2', tenantId: 'comercio-activo', categoryId: 'cat-cafeteria', name: 'Espresso Doble', description: 'Granos de especialidad tostados en origen', price: 2800, available: true },
            { id: 'item-3', tenantId: 'comercio-activo', categoryId: 'cat-pasteleria', name: 'Medialuna rellena de jamón y queso', description: 'Horneada en el día con manteca pura', price: 2900, available: true },
            { id: 'item-4', tenantId: 'comercio-activo', categoryId: 'cat-pasteleria', name: 'Cookie con chips de chocolate', description: 'Masa tierna con chocolate belga semi amargo', price: 2500, available: false },
            { id: 'item-5', tenantId: 'comercio-activo', categoryId: 'cat-almuerzos', name: 'Tostón de palta y huevo poché', description: 'Pan de masa madre, palta fresca, semillas y oliva', price: 5900, available: true },
          ],
        };
      });

      setData(res);
      const computedTable = mesaParam ? `Mesa ${mesaParam}` : res.tableLabel || 'Mesa 1';
      setDetectedTable(computedTable);
      setOrderType('mesa');

      if (!res.items || res.items.length === 0) {
        setStatus('empty');
      } else {
        setStatus('ready');
        if (res.categories?.length > 0) setActiveCategory(res.categories[0].id);
      }
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    loadMenu();
  }, [code, mesaParam]);

  // Llamar al mozo
  const handleCallWaiter = async () => {
    if (waiterStatus === 'calling' || waiterStatus === 'called') return;
    try {
      setWaiterStatus('calling');
      await api.callWaiter({
        tableCode: data?.tableCode || code || (mesaParam ? `MESA-${mesaParam}` : 'MESA'),
        tableLabel: detectedTable || 'Mesa',
      });
      setWaiterStatus('called');
      setTimeout(() => setWaiterStatus('idle'), 15000);
    } catch {
      setWaiterStatus('idle');
    }
  };

  // Abrir Bottom Sheet del producto al tocarlo
  const handleOpenProduct = (item: MenuItem) => {
    if (!item.available) return;
    setSelectedProduct(item);
    setProductQty(1);
    setProductNote('');
  };

  const handleAddProductFromSheet = () => {
    if (!selectedProduct) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === selectedProduct.id);
      if (existing) {
        const nextQty = Math.min(20, existing.qty + productQty);
        return prev.map((c) =>
          c.item.id === selectedProduct.id
            ? { ...c, qty: nextQty, note: productNote.trim() || c.note }
            : c
        );
      }
      return [...prev, { item: selectedProduct, qty: productQty, note: productNote.trim() || undefined }];
    });
    setSelectedProduct(null);
  };

  const updateCartQty = (itemId: string, delta: number) => {
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
        tableLabel: orderType === 'mesa' ? detectedTable : orderType === 'delivery' ? 'A domicilio' : 'Retiro',
        orderType,
        customerName: orderType !== 'mesa' ? customerName : undefined,
        customerPhone: orderType !== 'mesa' ? customerPhone : undefined,
        customerAddress: orderType === 'delivery' ? customerAddress : undefined,
        paymentMethod: orderType !== 'mesa' ? paymentMethod : 'efectivo',
        items: itemsPayload,
        note: generalNote.trim() || undefined,
      });

      setSubmittedOrder(order);
      setCart([]);
      setShowCheckout(false);
      setStatus('success');
    } catch {
      // Manejo silencioso
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#D95B26] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#9E9EA8]">Cargando la carta...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] flex items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-4">
          <AlertCircle className="w-10 h-10 text-[#D95B26] mx-auto" />
          <h1 className="text-base font-semibold">Esta carta no está disponible.</h1>
          <p className="text-xs text-[#9E9EA8]">Verificá que el código QR sea correcto o solicitá asistencia al personal.</p>
          <button
            onClick={loadMenu}
            className="h-12 px-6 rounded-xl bg-[#1A1A22] border border-[#282830] text-xs font-medium text-white inline-flex items-center gap-2 focus:ring-2 focus:ring-[#D95B26]"
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
          <CheckCircle2 className="w-16 h-16 text-[#D95B26] mx-auto animate-bounce" />
          <h1 className="text-2xl font-bold tracking-tight">Listo, tu pedido llegó al local</h1>
          <div className="text-sm font-semibold text-[#D95B26]">
            {submittedOrder.orderType === 'mesa'
              ? `Confirmado para ${submittedOrder.tableLabel}`
              : submittedOrder.orderType === 'delivery'
              ? 'Pedido a domicilio recibido'
              : 'Pedido para retirar recibido'}
          </div>

          <div className="bg-[#141418] border border-[#282830] rounded-2xl p-4 text-left space-y-2">
            <div className="text-xs font-semibold text-[#9E9EA8] border-b border-[#282830] pb-2">
              Resumen enviado:
            </div>
            {submittedOrder.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span>
                  <strong className="text-[#D95B26] mr-1.5">{it.qty}x</strong>
                  {it.name}
                </span>
                <span className="text-[#9E9EA8]">{formatARS(it.subtotal)}</span>
              </div>
            ))}
            <div className="border-t border-[#282830] pt-2 flex justify-between text-sm font-bold">
              <span>Total comanda</span>
              <span className="text-[#D95B26]">{formatARS(submittedOrder.totalArs)}</span>
            </div>
          </div>

          <p className="text-xs text-[#9E9EA8]">
            {submittedOrder.orderType === 'mesa'
              ? 'Pagás al final en la caja del local.'
              : 'Nos comunicaremos por WhatsApp para coordinar la entrega.'}
          </p>
        </div>

        <button
          onClick={() => setStatus('ready')}
          className="h-12 w-full rounded-2xl bg-[#D95B26] hover:bg-[#c04d1c] text-white font-bold text-sm transition-colors focus:ring-2 focus:ring-[#D95B26]"
        >
          Pedir otra cosa
        </button>
      </div>
    );
  }

  const filteredItems = activeCategory
    ? data?.items.filter((i) => i.categoryId === activeCategory)
    : data?.items;

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] pb-32">
      {/* 1. Contexto de Mesa: Banner fijo superior sutil */}
      {detectedTable && (
        <div className="sticky top-0 z-40 bg-[#16161C] border-b border-[#282834] px-4 py-2 text-center text-xs text-[#C4C4D0] shadow-sm">
          <span>Estás en <strong className="text-white font-semibold">{detectedTable}</strong> — podés pedir desde la carta</span>
        </div>
      )}

      {/* Encabezado del Local con Botón Llamar al Mozo */}
      <div className="max-w-md mx-auto px-4 pt-3 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D95B26] text-white font-black flex items-center justify-center text-sm shadow-sm">
              {data?.businessName?.charAt(0) || 'T'}
            </div>
            <div>
              <div className="text-sm font-bold text-[#F4F4F6] leading-none">{data?.businessName}</div>
              <div className="text-[11px] text-[#9E9EA8] mt-1">Carta digital Menuly</div>
            </div>
          </div>
          {detectedTable && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#1A1A22] border border-[#282830] text-[#D95B26]">
              {detectedTable}
            </span>
          )}
        </div>

        {/* Botón naranja ancho: Llamar al mozo */}
        {detectedTable && (
          <button
            type="button"
            onClick={handleCallWaiter}
            disabled={waiterStatus === 'calling'}
            className={`w-full h-11 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${
              waiterStatus === 'called'
                ? 'bg-emerald-600 text-white'
                : 'bg-[#D95B26] hover:bg-[#c04d1c] text-white'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>
              {waiterStatus === 'calling'
                ? 'Llamando...'
                : waiterStatus === 'called'
                ? `Mozo avisado a ${detectedTable}`
                : 'Llamar al mozo'}
            </span>
          </button>
        )}
      </div>

      {/* Pestañas de categorías fijas (Sticky) */}
      {data && data.categories.length > 0 && (
        <div className="sticky top-9 z-30 bg-[#0C0C0E]/95 backdrop-blur-md border-b border-[#282830] py-2 px-4">
          <div className="max-w-md mx-auto flex gap-1.5 overflow-x-auto scrollbar-none">
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-[#D95B26] text-white'
                    : 'bg-[#18181D] text-[#9E9EA8] hover:text-[#F4F4F6]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Platos interactivos (al tocar abre Bottom Sheet) */}
      <main className="max-w-md mx-auto px-4 pt-3 space-y-3">
        {filteredItems?.map((item) => (
          <div
            key={item.id}
            onClick={() => handleOpenProduct(item)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
              item.available
                ? 'bg-[#141418] border-[#282830] hover:border-[#D95B26]/50 active:scale-[0.99]'
                : 'bg-[#101014] border-[#1C1C22] opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="space-y-1 flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#F4F4F6] group-hover:text-white">
                {item.name}
              </div>
              {item.description && (
                <p className="text-xs text-[#9E9EA8] line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              )}
              <div className="text-sm font-bold text-[#D95B26] pt-0.5">
                {formatARS(item.price)}
              </div>
            </div>

            <div className="shrink-0">
              {item.available ? (
                <div className="w-10 h-10 rounded-xl bg-[#1C1C24] border border-[#2C2C38] group-hover:bg-[#D95B26] group-hover:text-white text-[#F4F4F6] flex items-center justify-center transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
              ) : (
                <span className="text-[10px] px-2 py-1 rounded bg-[#1C1C22] text-[#70707E]">
                  Agotado
                </span>
              )}
            </div>
          </div>
        ))}
      </main>

      {/* Barra flotante de carrito */}
      {totalCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-[#0C0C0E] via-[#0C0C0E]/90 to-transparent">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full h-13 py-3 px-5 rounded-2xl bg-[#D95B26] hover:bg-[#c04d1c] text-white font-bold text-sm flex items-center justify-between shadow-xl transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center text-xs font-black">
                  {totalCount}
                </div>
                <span>Ver pedido</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold">{formatARS(totalArs)}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 2. Bottom Sheet de Producto al tocar un plato */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#141418] border-t border-[#282830] rounded-t-3xl max-w-md mx-auto w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            {/* Barra superior de arrastre */}
            <div className="w-10 h-1 bg-[#2C2C38] rounded-full mx-auto -mt-1 mb-2" />

            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[#F4F4F6]">{selectedProduct.name}</h3>
                <div className="text-sm font-extrabold text-[#D95B26] mt-0.5">
                  {formatARS(selectedProduct.price)}
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded-full text-[#9E9EA8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedProduct.description && (
              <p className="text-xs text-[#9E9EA8] leading-relaxed">
                {selectedProduct.description}
              </p>
            )}

            {/* Selector de cantidad */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#181820] border border-[#282834]">
              <span className="text-xs font-medium text-[#C4C4D0]">Cantidad</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setProductQty((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-xl bg-[#242430] text-white flex items-center justify-center hover:bg-[#2F2F40]"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-bold text-white w-6 text-center">{productQty}</span>
                <button
                  type="button"
                  onClick={() => setProductQty((q) => Math.min(20, q + 1))}
                  className="w-8 h-8 rounded-xl bg-[#242430] text-white flex items-center justify-center hover:bg-[#2F2F40]"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Input de Aclaración */}
            <div>
              <label className="block text-xs font-medium text-[#9E9EA8] mb-1.5">
                + Aclaración (sin sal, término medio, etc.)
              </label>
              <input
                type="text"
                value={productNote}
                onChange={(e) => setProductNote(e.target.value)}
                placeholder="Ej. sin cebolla, el café bien caliente"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#181820] border border-[#282834] text-xs text-[#F4F4F6] focus:border-[#D95B26] focus:outline-none"
              />
            </div>

            <button
              onClick={handleAddProductFromSheet}
              className="w-full h-12 rounded-2xl bg-[#D95B26] hover:bg-[#c04d1c] text-white font-bold text-sm transition-colors flex items-center justify-between px-5"
            >
              <span>Agregar al pedido</span>
              <span>{formatARS(selectedProduct.price * productQty)}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Checkout Bottom Sheet Diferenciado (Mesa / Domicilio / Retiro) */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#141418] border-t border-[#282830] rounded-t-3xl max-w-md mx-auto w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            {/* Barra de arrastre */}
            <div className="w-10 h-1 bg-[#2C2C38] rounded-full mx-auto -mt-1 mb-2" />

            <div className="flex items-center justify-between border-b border-[#282830] pb-3">
              <h3 className="text-base font-bold text-[#F4F4F6]">Confirmar pedido</h3>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-xs text-[#9E9EA8] hover:text-white"
              >
                Cerrar
              </button>
            </div>

            {/* Pestañas de Checkout: Mesa / Delivery / Retiro */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#181820] border border-[#282834] rounded-2xl">
              <button
                type="button"
                onClick={() => setOrderType('mesa')}
                className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                  orderType === 'mesa' ? 'bg-[#D95B26] text-white' : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                En mesa
              </button>
              <button
                type="button"
                onClick={() => setOrderType('delivery')}
                className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                  orderType === 'delivery' ? 'bg-[#D95B26] text-white' : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                A domicilio
              </button>
              <button
                type="button"
                onClick={() => setOrderType('takeaway')}
                className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                  orderType === 'takeaway' ? 'bg-[#D95B26] text-white' : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Lo retiro
              </button>
            </div>

            {/* Detalle de items en el carrito */}
            <div className="space-y-2.5 max-h-48 overflow-y-auto">
              {cart.map((c) => (
                <div key={c.item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#181820] border border-[#282834]">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-xs font-semibold text-white truncate">{c.item.name}</div>
                    {c.note && <div className="text-[10px] text-[#9E9EA8] italic">Nota: {c.note}</div>}
                    <div className="text-[11px] font-bold text-[#D95B26]">{formatARS(c.item.price * c.qty)}</div>
                  </div>
                  <div className="flex items-center gap-2 bg-[#202028] rounded-lg p-1 border border-[#2C2C38]">
                    <button onClick={() => updateCartQty(c.item.id, -1)} className="p-1 hover:text-[#D95B26]">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{c.qty}</span>
                    <button onClick={() => updateCartQty(c.item.id, 1)} className="p-1 hover:text-[#D95B26]">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Formulario condicional según el tipo de pedido */}
            {orderType === 'mesa' ? (
              <div className="p-3 rounded-2xl bg-[#181820] border border-[#282834] text-xs text-[#C4C4D0]">
                Estás pidiendo a <strong className="text-white font-semibold">{detectedTable || 'tu mesa'}</strong>. La comanda se enviará directamente a cocina y pagarás al finalizar en la caja.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#9E9EA8] mb-1">Nombre completo</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#7E7E8E] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="Tu nombre y apellido"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#181820] border border-[#282834] text-xs text-white focus:border-[#D95B26] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#9E9EA8] mb-1">Teléfono (WhatsApp)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#7E7E8E] absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      placeholder="Ej. 11 2345 6789"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#181820] border border-[#282834] text-xs text-white focus:border-[#D95B26] focus:outline-none"
                    />
                  </div>
                </div>

                {orderType === 'delivery' && (
                  <div>
                    <label className="block text-xs font-medium text-[#9E9EA8] mb-1">Dirección de entrega</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-[#7E7E8E] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        placeholder="Calle, número, piso y depto"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#181820] border border-[#282834] text-xs text-white focus:border-[#D95B26] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#9E9EA8] mb-1">Medio de pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('efectivo')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        paymentMethod === 'efectivo'
                          ? 'bg-[#D95B26]/10 border-[#D95B26] text-white'
                          : 'bg-[#181820] border-[#282834] text-[#9E9EA8]'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Efectivo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('mercadopago')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        paymentMethod === 'mercadopago'
                          ? 'bg-[#D95B26]/10 border-[#D95B26] text-white'
                          : 'bg-[#181820] border-[#282834] text-[#9E9EA8]'
                      }`}
                    >
                      <span>Mercado Pago</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#9E9EA8] mb-1">Aclaraciones adicionales (opcional)</label>
              <input
                type="text"
                placeholder="Ej. timbre no funciona, cambio de $10.000"
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#181820] border border-[#282834] text-xs text-white focus:border-[#D95B26] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#282830]">
              <span className="text-sm font-bold">Total a pagar</span>
              <span className="text-base font-extrabold text-[#D95B26]">{formatARS(totalArs)}</span>
            </div>

            <button
              disabled={submitting}
              onClick={handleSendOrder}
              className="w-full h-12 rounded-2xl bg-[#D95B26] hover:bg-[#c04d1c] text-white font-bold text-sm transition-colors flex items-center justify-center shadow-lg"
            >
              {submitting ? 'Enviando...' : orderType === 'mesa' ? 'Confirmar pedido a la mesa' : 'Enviar pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
