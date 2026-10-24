import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  api,
  Cartel,
  Sale,
  Receipt,
  PaymentMethod,
  HubProduct,
  SaleItem,
  TeamMember,
} from '../../api';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency, formatDate } from '../../lib/formatters';
import {
  QrCode,
  Banknote,
  CreditCard,
  Delete,
  CheckCircle2,
  ArrowLeft,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Clock,
  Receipt as ReceiptIcon,
  Sun,
  Moon,
  Barcode,
  UserPlus,
  Plus,
  Minus,
  X,
  ShoppingBag,
  Lock,
  Search,
  Coffee,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';

const QUICK_AMOUNTS = [1500, 2500, 3800, 5000, 8500, 12000];

const DEFAULT_FALLBACK_CARTEL: Cartel = {
  id: 'cartel-caja-1',
  code: 'CAJA01',
  pin: '112233',
  businessId: 'biz-toque-1',
  name: 'Caja Principal (Mostrador)',
  role: 'caja',
  status: 'active',
  mode: 'hub',
  createdAt: new Date().toISOString(),
};

function getRoleRank(role?: string): number {
  if (role === 'superadmin') return 4;
  if (role === 'owner') return 3;
  if (role === 'manager') return 2;
  return 1; // cashier
}

export const CashierView: React.FC = () => {
  const { user, business, login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Inicialización inmediata sin bloqueo para que la caja abra al instante
  const [carteles, setCarteles] = useState<Cartel[]>([DEFAULT_FALLBACK_CARTEL]);
  const [selectedCartelId, setSelectedCartelId] = useState<string>(
    user?.assignedCartelId || DEFAULT_FALLBACK_CARTEL.id
  );
  const [amountStr, setAmountStr] = useState<string>('0');
  const [method, setMethod] = useState<PaymentMethod>('mercadopago');
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catálogo de productos y lector de código universal
  const [catalogProducts, setCatalogProducts] = useState<HubProduct[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedItems, setScannedItems] = useState<SaleItem[]>([]);

  // Modal de Catálogo Completo (para cafeterías, restaurantes y productos sin código universal)
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Comprobante activo emitido (límite de seguridad de 2 minutos o hasta abrirse / nuevo cobro)
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [emittedReceipt, setEmittedReceipt] = useState<Receipt | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Modal de cambiar / crear cuenta para cajeros + validación de contraseña para cargo superior
  const [showCashierAccountModal, setShowCashierAccountModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newCashierName, setNewCashierName] = useState('');
  const [isCreatingCashier, setIsCreatingCashier] = useState(false);
  const [pendingElevationMember, setPendingElevationMember] = useState<TeamMember | null>(null);
  const [elevationPassword, setElevationPassword] = useState('');
  const [showElevationPassword, setShowElevationPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  const selectedCartel =
    carteles.find((c) => c.id === selectedCartelId) || carteles[0] || DEFAULT_FALLBACK_CARTEL;
  const amount = parseInt(amountStr, 10) || 0;

  // Hidratación en paralelo en segundo plano sin bloquear la apertura de la Caja
  const loadInitialData = useCallback(() => {
    api
      .listCarteles()
      .then((cartelesList) => {
        const activeCarteles = cartelesList.filter((c) => c.status === 'active');
        const list =
          activeCarteles.length > 0
            ? activeCarteles
            : cartelesList.length > 0
            ? cartelesList
            : [DEFAULT_FALLBACK_CARTEL];
        setCarteles(list);
        setSelectedCartelId((prev) => {
          if (user?.assignedCartelId && list.some((c) => c.id === user.assignedCartelId)) {
            return user.assignedCartelId;
          }
          if (list.some((c) => c.id === prev)) {
            return prev;
          }
          return list[0].id;
        });
      })
      .catch(() => {});

    api
      .listSales()
      .then((salesList) => {
        setAllSales(salesList);
      })
      .catch(() => {});

    api
      .getHubConfig()
      .then((cfg) => {
        setCatalogProducts(cfg.products || []);
      })
      .catch(() => {});

    api
      .listTeamMembers()
      .then((members) => {
        setTeamMembers(members);
      })
      .catch(() => {});
  }, [user?.assignedCartelId]);

  useEffect(() => {
    loadInitialData();

    const unsubSales = api.subscribeToBusinessSales((liveSales) => {
      setAllSales(liveSales);
    });

    return () => {
      unsubSales();
    };
  }, [loadInitialData]);

  // Calcular los 5 productos más vendidos para mostrar en el Lector de productos
  const top5Products = useMemo(() => {
    const soldCounts: Record<string, number> = {};
    for (const s of allSales) {
      if (s.status !== 'paid' || !Array.isArray(s.items)) continue;
      for (const item of s.items) {
        const keyById = item.id;
        const keyByName = (item.name || '').toLowerCase();
        if (keyById) {
          soldCounts[keyById] = (soldCounts[keyById] || 0) + (item.quantity || 1);
        }
        if (keyByName) {
          soldCounts[keyByName] = (soldCounts[keyByName] || 0) + (item.quantity || 1);
        }
      }
    }

    return [...catalogProducts]
      .sort((a, b) => {
        const scoreA =
          (soldCounts[a.id] || 0) + (soldCounts[a.title.toLowerCase()] || 0);
        const scoreB =
          (soldCounts[b.id] || 0) + (soldCounts[b.title.toLowerCase()] || 0);
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }, [catalogProducts, allSales]);

  // Filtrar catálogo completo para el modal gastronómico
  const filteredCatalogProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalogProducts;
    return catalogProducts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.universalCode && p.universalCode.toLowerCase().includes(q))
    );
  }, [catalogProducts, catalogSearch]);

  // SOLO los 3 últimos cobros hechos por la cuenta que esté puesta actualmente
  const myLast3Sales = useMemo(() => {
    if (!user) return allSales.slice(0, 3);
    const activeEmail = (user.email || '').toLowerCase();
    const activeName = (user.name || '').toLowerCase();

    return allSales
      .filter((s) => {
        const matchEmail = Boolean(
          activeEmail && s.cashierEmail && s.cashierEmail.toLowerCase() === activeEmail
        );
        const matchName = Boolean(
          activeName && s.cashierName && s.cashierName.toLowerCase() === activeName
        );
        return matchEmail || matchName;
      })
      .slice(0, 3);
  }, [allSales, user]);

  // Integrantes disponibles para cambio de cuenta (asegurando incluir al Dueño del comercio)
  const selectableAccounts = useMemo(() => {
    const list = [...teamMembers];
    const ownerEmail = (business?.email || 'comercio@toque.ar').toLowerCase();
    const hasOwner = list.some(
      (m) => m.role === 'owner' || m.email.toLowerCase() === ownerEmail
    );
    if (!hasOwner) {
      list.unshift({
        id: 'team-owner-main',
        businessId: business?.id || 'biz-toque-1',
        name: business?.ownerName || 'Martín Gómez',
        email: ownerEmail,
        role: 'owner',
        status: 'active',
        addedAt: business?.createdAt || new Date().toISOString(),
      });
    }
    return list;
  }, [teamMembers, business]);

  // Suscripción en tiempo real al comprobante activo: si el cliente lo abre ('claimed'), se bloquea/cierra
  useEffect(() => {
    if (!emittedReceipt) return;
    const unsubReceipt = api.subscribeToReceipt(emittedReceipt.id, (liveReceipt) => {
      if (!liveReceipt) return;
      if (liveReceipt.status === 'claimed') {
        setEmittedReceipt(liveReceipt);
        showToast('El cliente abrió el comprobante en su teléfono', 'success');
      } else if (liveReceipt.status === 'expired' || liveReceipt.status === 'cancelled') {
        setEmittedReceipt(null);
        setActiveSale(null);
      }
    });
    return () => unsubReceipt();
  }, [emittedReceipt?.id, showToast]);

  // Límite estricto de 2 minutos (120 segundos) para abrir el comprobante
  useEffect(() => {
    if (!emittedReceipt || emittedReceipt.status !== 'ready') {
      setSecondsLeft(0);
      return;
    }

    const updateCountdown = () => {
      const expiresMs = new Date(emittedReceipt.expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff <= 0) {
        setEmittedReceipt((prev) => (prev ? { ...prev, status: 'expired' } : null));
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [emittedReceipt]);

  const handleDigit = useCallback((digit: string) => {
    setAmountStr((prev) => {
      const next = prev === '0' ? digit : prev + digit;
      if (next.length > 8) return prev;
      return next;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setAmountStr((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  }, []);

  const handleClear = useCallback(() => {
    setAmountStr('0');
    setScannedItems([]);
  }, []);

  const handleQuickAmount = (val: number) => {
    setScannedItems([]);
    setAmountStr(String(val));
  };

  // Recalcular importe total cuando se escanean o modifican productos del lector
  const syncAmountWithItems = (items: SaleItem[]) => {
    setScannedItems(items);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setAmountStr(String(Math.round(total)));
  };

  const addProductToSale = useCallback(
    (product: HubProduct) => {
      const unitPrice = Number(product.price) || 0;
      setScannedItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.id === product.id);
        let next: SaleItem[];
        if (existingIdx >= 0) {
          next = prev.map((item, idx) =>
            idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          next = [
            ...prev,
            {
              id: product.id,
              name: product.title,
              price: unitPrice,
              quantity: 1,
            },
          ];
        }
        const total = next.reduce((sum, item) => sum + item.price * item.quantity, 0);
        setAmountStr(String(Math.round(total)));
        return next;
      });
      showToast(`+1 ${product.title} (${formatCurrency(unitPrice)})`, 'success');
    },
    [showToast]
  );

  const handleChangeItemQty = (itemId: string, delta: number) => {
    const next = scannedItems
      .map((item) =>
        item.id === itemId ? { ...item, quantity: item.quantity + delta } : item
      )
      .filter((item) => item.quantity > 0);
    syncAmountWithItems(next);
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const queryText = barcodeInput.trim().toLowerCase();
    if (!queryText) return;

    const match =
      catalogProducts.find(
        (p) => p.universalCode && p.universalCode.toLowerCase() === queryText
      ) ||
      catalogProducts.find((p) => p.title.toLowerCase().includes(queryText));

    if (match) {
      addProductToSale(match);
      setBarcodeInput('');
    } else {
      showToast(`No se encontró un producto con código o nombre "${barcodeInput.trim()}"`, 'error');
    }
  };

  const handleCreateSale = useCallback(async () => {
    if (!selectedCartel) {
      showToast('Seleccioná una caja activa', 'error');
      return;
    }
    if (amount <= 0) {
      showToast('Ingresá un importe mayor a $0', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createSale({
        cartelId: selectedCartel.id,
        amount,
        method,
        items: scannedItems.length > 0 ? scannedItems : undefined,
      });

      setActiveSale(res.sale);
      if (res.receipt) {
        setEmittedReceipt(res.receipt);
      }
      setAmountStr('0');
      setScannedItems([]);
      showToast(
        `Comprobante ${res.receipt?.id || ''} activo en ${selectedCartel.code} por 2 minutos`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Error al registrar el cobro', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCartel, amount, method, scannedItems, showToast]);

  // Soporte completo para teclado numérico físico y estándar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (showCashierAccountModal || showCatalogModal) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (amount > 0 && !isSubmitting) {
          handleCreateSale();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleDigit,
    handleBackspace,
    handleClear,
    handleCreateSale,
    amount,
    isSubmitting,
    showCashierAccountModal,
    showCatalogModal,
  ]);

  const handleSelectAccount = async (member: TeamMember) => {
    const currentRank = getRoleRank(user?.isSuperAdmin ? 'superadmin' : user?.role);
    const targetRank = getRoleRank(member.role);

    // Si elige una cuenta de un cargo superior, requerir contraseña de registro
    if (targetRank > currentRank) {
      setPendingElevationMember(member);
      setElevationPassword('');
      setShowElevationPassword(false);
      return;
    }

    try {
      await login({ email: member.email });
      showToast(`Sesión cambiada a ${member.name}`, 'success');
      setShowCashierAccountModal(false);
      setPendingElevationMember(null);
    } catch {
      showToast('No se pudo cambiar de cuenta', 'error');
    }
  };

  const handleConfirmElevationPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingElevationMember) return;
    if (!elevationPassword.trim()) {
      showToast('Ingresá la contraseña de registro para continuar', 'error');
      return;
    }

    setIsVerifyingPassword(true);
    try {
      await login({
        email: pendingElevationMember.email,
        code: elevationPassword.trim(),
      });
      const roleText =
        pendingElevationMember.role === 'owner'
          ? 'Dueño'
          : pendingElevationMember.role === 'manager'
          ? 'Encargado'
          : 'Cajero';
      showToast(
        `Sesión cambiada a ${pendingElevationMember.name} (${roleText}). Ya podés acceder al panel.`,
        'success'
      );
      const switchedRole = pendingElevationMember.role;
      setPendingElevationMember(null);
      setElevationPassword('');
      setShowCashierAccountModal(false);
      if (switchedRole === 'owner' || switchedRole === 'manager') {
        navigate('/panel/resumen');
      }
    } catch (err: any) {
      showToast(
        err?.message || 'Contraseña incorrecta. Ingresá la contraseña con la que te registraste.',
        'error'
      );
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleCreateAndSwitchCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCashierName.trim()) {
      showToast('Ingresá nombre y apellido del cajero', 'error');
      return;
    }

    setIsCreatingCashier(true);
    try {
      const created = await api.addTeamMember({
        name: newCashierName.trim(),
        role: 'cashier',
      });
      setTeamMembers((prev) => [...prev, created]);
      await login({ email: created.email });
      setNewCashierName('');
      setShowCashierAccountModal(false);
      setPendingElevationMember(null);
      showToast(`Cuenta de cajero creada: ${created.name}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'No se pudo crear la cuenta de cajero', 'error');
    } finally {
      setIsCreatingCashier(false);
    }
  };

  const methodBadgeLabel = (m: PaymentMethod) =>
    m === 'mercadopago' || m === 'mp_qr' ? 'QR' : m === 'cash' ? 'Efectivo' : 'Tarjeta';

  const currentRoleLabel =
    user?.role === 'owner'
      ? 'Dueño'
      : user?.role === 'manager'
      ? 'Encargado'
      : 'Cajero';

  return (
    <div className="theme-panel min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col">
      {/* Header de Caja (mantiene el mismo negro en modo claro y oscuro) */}
      <header className="panel-chrome-dark h-16 px-4 sm:px-8 border-b border-[#242426] bg-[#111113] text-[#f1f1ee] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/panel/resumen"
            className="p-2 rounded-xl bg-[#18181b] hover:bg-[#222226] text-[#a1a1aa] hover:text-[#f1f1ee] border border-[#28282a] transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Ir al Panel"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Panel</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#bec8ff] flex items-center justify-center font-bold text-xs text-[#0c0c0c]">
              POS
            </div>
            <div>
              <h1 className="font-bold text-sm text-[#f1f1ee] leading-none">
                Caja · {business?.name || 'Café & Panadería La Esquina'}
              </h1>
              <span className="text-[11px] text-[#34d399] font-medium flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2fb36a]" />
                {user?.name || 'Cajero'} ({currentRoleLabel})
              </span>
            </div>
          </div>
        </div>

        {/* Selector de Cartel + Modo Oscuro/Claro (solo icono) + Cambiar/Crear cuenta */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#18181b] border border-[#28282a] rounded-xl px-3 py-1.5">
            <QrCode className="w-4 h-4 text-[#bec8ff] shrink-0" />
            <select
              value={selectedCartel?.id || ''}
              onChange={(e) => setSelectedCartelId(e.target.value)}
              aria-label="Seleccionar cartel de caja"
              className="bg-transparent text-xs font-bold text-[#f1f1ee] focus:outline-none cursor-pointer"
            >
              {carteles.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#111113] text-[#f1f1ee]">
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botón Modo Claro / Modo Oscuro: solo icono, sin texto */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label="Cambiar modo de color"
            className="w-9 h-9 rounded-xl bg-[#18181b] border border-[#28282a] hover:border-[#bec8ff] text-[#f1f1ee] flex items-center justify-center transition-colors cursor-pointer"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-[#bec8ff]" />
            ) : (
              <Moon className="w-4 h-4 text-[#bec8ff]" />
            )}
          </button>

          {/* Icono de cambiar/crear cuenta (con protección por contraseña para cargos superiores) */}
          <button
            type="button"
            onClick={() => {
              setPendingElevationMember(null);
              setElevationPassword('');
              setShowCashierAccountModal(true);
            }}
            title="Cambiar o crear cuenta"
            aria-label="Cambiar o crear cuenta"
            className="w-9 h-9 rounded-xl bg-[#18181b] border border-[#28282a] hover:border-[#bec8ff] text-[#bec8ff] flex items-center justify-center transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Cuerpo Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Teclado de Cobro (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="stat-card p-5 sm:p-6 space-y-5">
            {/* Visor de Importe */}
            <div className="p-5 rounded-2xl bg-[#161619] border border-[#28282a] flex flex-col items-end justify-center stat-badge">
              <div className="w-full flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-[#a1a1aa] stat-detail">
                  Cartel vinculado: <strong className="text-[#f1f1ee]">{selectedCartel?.code}</strong>
                </span>
                <span className="text-[11px] font-mono text-[#34d399] stat-detail">
                  Teclado numérico activo
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-[#a1a1aa]">$</span>
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#f1f1ee] font-mono tabular-nums">
                  {amount.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Productos escaneados o elegidos en la venta actual */}
            {scannedItems.length > 0 && (
              <div className="p-3.5 rounded-xl bg-[#161619] border border-[#28282a] space-y-2 stat-badge">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#f1f1ee] flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#bec8ff]" />
                    Productos en este cobro ({scannedItems.reduce((a, b) => a + b.quantity, 0)})
                  </span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[11px] text-[#a1a1aa] hover:text-red-400 cursor-pointer"
                  >
                    Vaciar
                  </button>
                </div>
                <div className="divide-y divide-[#242426] max-h-36 overflow-y-auto">
                  {scannedItems.map((item) => (
                    <div
                      key={item.id}
                      className="py-1.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-[#f1f1ee] font-medium truncate">{item.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleChangeItemQty(item.id, -1)}
                          className="w-6 h-6 rounded-md bg-[#111113] border border-[#28282a] flex items-center justify-center text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold text-[#f1f1ee] w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleChangeItemQty(item.id, 1)}
                          className="w-6 h-6 rounded-md bg-[#111113] border border-[#28282a] flex items-center justify-center text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-semibold text-[#bec8ff] w-20 text-right">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Importes Rápidos */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="py-2 px-2 rounded-xl bg-[#161619] hover:bg-[#222226] border border-[#28282a] text-xs font-mono font-semibold text-[#f1f1ee] transition-colors cursor-pointer stat-badge"
                >
                  ${val.toLocaleString('es-AR')}
                </button>
              ))}
            </div>

            {/* Teclado Numérico Touch + Físico */}
            <div className="grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="h-14 rounded-xl bg-[#161619] hover:bg-[#222226] active:bg-[#28282c] border border-[#28282a] text-xl font-bold font-mono text-[#f1f1ee] transition-colors cursor-pointer stat-badge"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="h-14 rounded-xl bg-[#161619] hover:bg-[#222226] border border-[#28282a] text-xs font-bold text-[#a1a1aa] hover:text-[#f1f1ee] transition-colors cursor-pointer stat-badge"
              >
                Borrar
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-14 rounded-xl bg-[#161619] hover:bg-[#222226] border border-[#28282a] text-xl font-bold font-mono text-[#f1f1ee] transition-colors cursor-pointer stat-badge"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="Borrar último dígito"
                className="h-14 rounded-xl bg-[#161619] hover:bg-[#222226] border border-[#28282a] flex items-center justify-center text-[#a1a1aa] hover:text-[#f1f1ee] transition-colors cursor-pointer stat-badge"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Selección de método de pago: solo "Efectivo" - "Tarjeta" - "QR" */}
            <div>
              <span className="block text-xs font-semibold text-[#a1a1aa] mb-2 stat-detail">
                Método de pago
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMethod('cash')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 stat-badge ${
                    method === 'cash'
                      ? 'bg-[#2fb36a]/15 border-[#2fb36a] text-[#f1f1ee]'
                      : 'bg-[#161619] border-[#28282a] text-[#a1a1aa] hover:text-[#f1f1ee]'
                  }`}
                >
                  <Banknote
                    className={`w-5 h-5 ${
                      method === 'cash' ? 'text-[#34d399]' : 'text-[#a1a1aa]'
                    }`}
                  />
                  <span className="text-xs font-bold block">Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('card')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 stat-badge ${
                    method === 'card'
                      ? 'bg-[#bec8ff]/15 border-[#bec8ff] text-[#f1f1ee]'
                      : 'bg-[#161619] border-[#28282a] text-[#a1a1aa] hover:text-[#f1f1ee]'
                  }`}
                >
                  <CreditCard
                    className={`w-5 h-5 ${
                      method === 'card' ? 'text-[#bec8ff]' : 'text-[#a1a1aa]'
                    }`}
                  />
                  <span className="text-xs font-bold block">Tarjeta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('mercadopago')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 stat-badge ${
                    method === 'mercadopago'
                      ? 'bg-[#bec8ff]/15 border-[#bec8ff] text-[#f1f1ee]'
                      : 'bg-[#161619] border-[#28282a] text-[#a1a1aa] hover:text-[#f1f1ee]'
                  }`}
                >
                  <QrCode
                    className={`w-5 h-5 ${
                      method === 'mercadopago' ? 'text-[#bec8ff]' : 'text-[#a1a1aa]'
                    }`}
                  />
                  <span className="text-xs font-bold block">QR</span>
                </button>
              </div>
            </div>

            <Button
              variant="ultramar"
              size="touch"
              fullWidth
              loading={isSubmitting}
              disabled={amount <= 0}
              onClick={handleCreateSale}
              icon={<ReceiptIcon className="w-5 h-5" />}
            >
              Cobrar {amount > 0 ? formatCurrency(amount) : ''} y emitir comprobante
            </Button>
          </Card>

          {/* Comprobante recién emitido (Límite de 2 minutos hasta abrirse o siguiente pago) */}
          {emittedReceipt && activeSale && (
            <Card className="stat-card p-5 border-[#2fb36a] space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2fb36a]/15 text-[#34d399] flex items-center justify-center shrink-0">
                    {emittedReceipt.status === 'ready' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-[#f1f1ee]">
                        Comprobante #{emittedReceipt.id}
                      </h3>
                      <span className="text-xs font-mono font-bold text-[#bec8ff]">
                        {formatCurrency(emittedReceipt.total)} ({methodBadgeLabel(emittedReceipt.method)})
                      </span>
                    </div>
                    <p className="text-xs text-[#a1a1aa] stat-detail">
                      {emittedReceipt.status === 'claimed'
                        ? 'Abierto por el cliente · Cerrado para nuevos escaneos'
                        : emittedReceipt.status === 'ready' && secondsLeft > 0
                        ? `Disponible en cartel ${selectedCartel.code} por ${Math.floor(
                            secondsLeft / 60
                          )}:${(secondsLeft % 60).toString().padStart(2, '0')} min`
                        : 'Tiempo límite de 2 minutos finalizado'}
                    </p>
                  </div>
                </div>

                {emittedReceipt.status === 'ready' && secondsLeft > 0 && (
                  <Link
                    to={`/r/${emittedReceipt.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#18181b] border border-[#28282a] text-xs font-semibold text-[#bec8ff] hover:border-[#bec8ff] flex items-center gap-1.5 shrink-0"
                  >
                    <span>Abrir</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Columna Derecha: Lector para productos (arriba) + Ultimos cobros (abajo) (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Lector para productos: muestra SOLO los 5 productos más vendidos + botón Catálogo */}
          <Card className="stat-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-[#2fb36a]" />
                  <h2 className="font-bold text-sm text-[#f1f1ee]">Lector de productos</h2>
                </div>
                <p className="text-[11px] text-[#a1a1aa] mt-0.5 stat-detail">
                  Top 5 más vendidos · Tocá Catálogo para ver todo el menú
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCatalogSearch('');
                  setShowCatalogModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#28282a] text-xs font-bold text-[#bec8ff] flex items-center gap-1.5 cursor-pointer transition-colors stat-badge"
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Catálogo ({catalogProducts.length})</span>
              </button>
            </div>

            <form onSubmit={handleScanSubmit} className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[#161619] border border-[#28282a] rounded-xl px-3 py-2 focus-within:border-[#bec8ff] stat-badge">
                <Barcode className="w-4 h-4 text-[#a1a1aa] shrink-0" />
                <input
                  type="text"
                  placeholder="Código universal o nombre..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full bg-transparent text-xs text-[#f1f1ee] placeholder-[#71717a] focus:outline-none"
                />
              </div>
              <Button type="submit" variant="secundario" size="sm">
                Sumar
              </Button>
            </form>

            {top5Products.length > 0 && (
              <div className="space-y-1.5">
                {top5Products.map((prod, idx) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => addProductToSale(prod)}
                    className="w-full p-2.5 rounded-xl bg-[#161619] hover:bg-[#222226] border border-[#242426] flex items-center justify-between gap-2 text-left transition-colors cursor-pointer stat-badge"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-[#111113] border border-[#28282a] text-[10px] font-mono font-bold text-[#a1a1aa] flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.title}
                          className="w-8 h-8 rounded-lg object-cover border border-[#28282a] shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#111113] border border-[#28282a] flex items-center justify-center text-[#a1a1aa] shrink-0">
                          <ShoppingBag className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#f1f1ee] truncate">
                          {prod.title}
                        </p>
                        <p className="text-[10px] font-mono text-[#a1a1aa] stat-detail">
                          {prod.universalCode ? `Cód: ${prod.universalCode}` : 'Menú sin código'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#bec8ff] shrink-0 stat-detail">
                      {prod.price !== undefined ? formatCurrency(prod.price) : '$0'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* 2. Ultimos cobros: SOLO los 3 últimos cobros hechos por la cuenta activa */}
          <Card padding="none" className="stat-card overflow-hidden">
            <div className="p-5 border-b border-[#242426] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#bec8ff]" />
                  <h2 className="font-bold text-sm text-[#f1f1ee]">Ultimos cobros</h2>
                </div>
                <p className="text-[11px] text-[#a1a1aa] mt-0.5 stat-detail">
                  Últimos 3 cobros realizados por {user?.name || 'esta cuenta'}
                </p>
              </div>
              <button
                type="button"
                onClick={loadInitialData}
                className="text-xs text-[#a1a1aa] hover:text-[#f1f1ee] flex items-center gap-1 cursor-pointer"
                title="Actualizar cobros"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {myLast3Sales.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Smartphone className="w-8 h-8 text-[#a1a1aa] mx-auto" />
                <p className="text-xs font-semibold text-[#f1f1ee]">
                  Sin cobros recientes en esta cuenta
                </p>
                <p className="text-[11px] text-[#a1a1aa] stat-detail">
                  Aquí verás únicamente los últimos 3 cobros emitidos por {user?.name || 'tu usuario'}.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#242426]">
                {myLast3Sales.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-[#161619] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[#f1f1ee]">
                          {formatCurrency(s.amount)}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#18181b] border border-[#28282a] text-[#bec8ff] stat-badge">
                          {methodBadgeLabel(s.method)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#a1a1aa] mt-0.5 stat-detail">
                        {formatDate(s.createdAt)} · {s.cartelCode || 'CAJA01'}
                      </p>
                    </div>

                    {s.receiptId && (
                      <Link
                        to={`/r/${s.receiptId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#bec8ff] hover:underline shrink-0 flex items-center gap-1 stat-detail"
                      >
                        <span>Comprobante</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Modal: Catálogo Completo (enfocado en cafeterías, restaurantes y productos sin código universal) */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-2xl rounded-2xl bg-[#111113] border border-[#242426] flex flex-col max-h-[88vh] overflow-hidden shadow-2xl">
            {/* Header del Catálogo */}
            <div className="p-5 border-b border-[#242426] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center shrink-0">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-[#f1f1ee]">
                    Catálogo y Menú Completo
                  </h2>
                  <p className="text-xs text-[#a1a1aa]">
                    Deslizá o buscá platos, cafés y productos con o sin código universal.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {user?.role !== 'cashier' && (
                  <Link
                    to="/panel/productos"
                    className="text-xs font-semibold text-[#bec8ff] hover:underline px-2.5 py-1.5 rounded-lg bg-[#18181b] border border-[#28282a]"
                  >
                    Administrar productos
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="p-2 rounded-lg text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Buscador del Catálogo */}
            <div className="p-4 border-b border-[#242426] bg-[#141417]">
              <div className="flex items-center gap-2.5 bg-[#18181b] border border-[#28282a] rounded-xl px-3.5 py-2.5 focus-within:border-[#bec8ff]">
                <Search className="w-4 h-4 text-[#a1a1aa] shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar café, plato, bebida o código universal..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full bg-transparent text-sm text-[#f1f1ee] placeholder-[#71717a] focus:outline-none"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch('')}
                    className="text-xs text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Lista deslizable de todo el menú */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredCatalogProducts.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <ShoppingBag className="w-8 h-8 text-[#a1a1aa] mx-auto" />
                  <p className="text-sm font-semibold text-[#f1f1ee]">
                    No encontramos productos con "{catalogSearch}"
                  </p>
                  <p className="text-xs text-[#a1a1aa]">
                    Probá con otro nombre o agregá nuevos productos desde la sección Productos.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredCatalogProducts.map((prod) => {
                    const selectedItem = scannedItems.find((i) => i.id === prod.id);
                    const qty = selectedItem?.quantity || 0;
                    return (
                      <div
                        key={prod.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          qty > 0
                            ? 'bg-[#2fb36a]/10 border-[#2fb36a]'
                            : 'bg-[#161619] border-[#28282a] hover:border-[#3a3a3e]'
                        }`}
                      >
                        <div
                          onClick={() => addProductToSale(prod)}
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                        >
                          {prod.imageUrl ? (
                            <img
                              src={prod.imageUrl}
                              alt={prod.title}
                              className="w-11 h-11 rounded-xl object-cover border border-[#28282a] shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-[#111113] border border-[#28282a] flex items-center justify-center text-[#bec8ff] shrink-0">
                              <Coffee className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#f1f1ee] truncate">
                              {prod.title}
                            </p>
                            {prod.description && (
                              <p className="text-[11px] text-[#a1a1aa] truncate">
                                {prod.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-mono font-extrabold text-[#34d399]">
                                {prod.price !== undefined ? formatCurrency(prod.price) : '$0'}
                              </span>
                              <span className="text-[10px] font-mono text-[#a1a1aa]">
                                {prod.universalCode ? `Cód: ${prod.universalCode}` : 'Sin código'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {qty > 0 ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleChangeItemQty(prod.id, -1)}
                              className="w-7 h-7 rounded-lg bg-[#111113] border border-[#28282a] flex items-center justify-center text-[#f1f1ee] hover:border-[#bec8ff] cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-5 text-center font-mono text-xs font-bold text-[#f1f1ee]">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => addProductToSale(prod)}
                              className="w-7 h-7 rounded-lg bg-[#2fb36a] text-[#0c0c0c] flex items-center justify-center font-bold cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addProductToSale(prod)}
                            className="px-3 py-1.5 rounded-xl bg-[#18181b] hover:bg-[#bec8ff] text-[#f1f1ee] hover:text-[#0c0c0c] border border-[#28282a] text-xs font-bold transition-colors shrink-0 cursor-pointer"
                          >
                            + Sumar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Barra Inferior Fija con el Importe Debajo */}
            <div className="p-4 border-t border-[#242426] bg-[#161619] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <div>
                  <span className="text-[11px] font-semibold text-[#a1a1aa] block">
                    Importe acumulado ({scannedItems.reduce((a, b) => a + b.quantity, 0)} ítems)
                  </span>
                  <span className="text-2xl font-extrabold font-mono text-[#f1f1ee] tabular-nums">
                    {formatCurrency(amount)}
                  </span>
                </div>
                {scannedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs font-semibold text-[#a1a1aa] hover:text-red-400 underline cursor-pointer"
                  >
                    Vaciar pedido
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="ultramar"
                size="md"
                onClick={() => setShowCatalogModal(false)}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Listo · Volver al cobro ({formatCurrency(amount)})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cambiar o crear cuenta (requiere contraseña al elegir un cargo superior) */}
      {showCashierAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-[#f1f1ee]">
                    Cambiar o crear cuenta
                  </h2>
                  <p className="text-xs text-[#a1a1aa]">
                    Seleccioná la cuenta activa o sumá un nuevo cajero.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCashierAccountModal(false);
                  setPendingElevationMember(null);
                }}
                className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Si se seleccionó un cargo superior (Dueño / Encargado), pedir contraseña de registro */}
            {pendingElevationMember ? (
              <form
                onSubmit={handleConfirmElevationPassword}
                className="p-4 rounded-xl bg-[#161619] border border-[#bec8ff]/40 space-y-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <KeyRound className="w-4 h-4 text-[#bec8ff] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#f1f1ee]">
                      Verificación de seguridad requerida
                    </p>
                    <p className="text-[11px] text-[#a1a1aa] mt-0.5">
                      Para cambiar a{' '}
                      <strong className="text-[#f1f1ee]">{pendingElevationMember.name}</strong> (
                      {pendingElevationMember.role === 'owner' ? 'Dueño' : 'Encargado'}), ingresá la
                      contraseña con la que se registró la cuenta.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showElevationPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Contraseña de registro..."
                    value={elevationPassword}
                    onChange={(e) => setElevationPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#111113] border border-[#28282a] text-xs text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowElevationPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
                  >
                    {showElevationPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="secundario"
                    size="sm"
                    onClick={() => {
                      setPendingElevationMember(null);
                      setElevationPassword('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="ultramar"
                    size="sm"
                    loading={isVerifyingPassword}
                  >
                    Confirmar y entrar al panel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                {/* Lista de cuentas del equipo */}
                {selectableAccounts.length > 0 && (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    <p className="text-xs font-semibold text-[#a1a1aa]">Cuentas del comercio</p>
                    {selectableAccounts.map((m) => {
                      const isCurrent =
                        user?.email && m.email.toLowerCase() === user.email.toLowerCase();
                      const roleLabel =
                        m.role === 'owner'
                          ? 'Dueño'
                          : m.role === 'manager'
                          ? 'Encargado'
                          : 'Cajero';
                      const requiresPassword =
                        getRoleRank(m.role) >
                        getRoleRank(user?.isSuperAdmin ? 'superadmin' : user?.role);

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectAccount(m)}
                          className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-[#2fb36a]/15 border-[#2fb36a] text-[#f1f1ee]'
                              : 'bg-[#161619] border-[#28282a] text-[#f1f1ee] hover:border-[#bec8ff]'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold flex items-center gap-1.5">
                              <span>{m.name}</span>
                              {requiresPassword && (
                                <Lock className="w-3 h-3 text-[#bec8ff]" />
                              )}
                            </p>
                            <p className="text-[11px] text-[#a1a1aa]">{roleLabel}</p>
                          </div>
                          <span className="text-xs font-semibold text-[#bec8ff]">
                            {isCurrent
                              ? 'Activo'
                              : requiresPassword
                              ? 'Requiere clave'
                              : 'Usar cuenta'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Crear nuevo cajero pidiendo solo Nombre y apellido */}
                <form
                  onSubmit={handleCreateAndSwitchCashier}
                  className="pt-4 border-t border-[#242426] space-y-3"
                >
                  <label className="block text-xs font-semibold text-[#a1a1aa]">
                    Crear nuevo cajero (Nombre y apellido)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Ej: Sofía López"
                      value={newCashierName}
                      onChange={(e) => setNewCashierName(e.target.value)}
                      className="flex-1 bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 text-xs text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                    />
                    <Button
                      type="submit"
                      variant="ultramar"
                      size="sm"
                      loading={isCreatingCashier}
                    >
                      Crear y entrar
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
