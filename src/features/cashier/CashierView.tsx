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
import { BrandLogo } from '../../components/ui/Avatar';
import { RealQrCode } from '../../components/ui/RealQrCode';
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
  Calculator,
} from 'lucide-react';

const QUICK_AMOUNTS = [1500, 2500, 3800, 5000, 8500, 12000];

const DEFAULT_FALLBACK_CARTEL: Cartel = {
  id: 'cartel-caja-1',
  code: 'BURGER01',
  pin: '112233',
  businessId: 'la-burger',
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

/**
 * Evaluador aritmético seguro sin eval() para expresiones POS con +, - y *
 * Ejemplo: "1500+2500*2" -> 6500
 */
function evaluatePosExpression(expr: string): number {
  const sanitized = expr.replace(/,/g, '.').replace(/[^0-9+\-*.]/g, '');
  if (!sanitized) return 0;

  // Si termina en un operador (+, -, *, .), ignorar el operador final para el cálculo en vivo
  const trimmed = sanitized.replace(/[+\-*.]+$/, '');
  if (!trimmed) return 0;

  // Separar por suma y resta respetando el signo
  const addTerms = trimmed.split(/(?=[+-])/);
  let total = 0;

  for (const rawTerm of addTerms) {
    if (!rawTerm) continue;
    let sign = 1;
    let term = rawTerm;
    if (term.startsWith('+')) {
      term = term.slice(1);
    } else if (term.startsWith('-')) {
      sign = -1;
      term = term.slice(1);
    }

    const factors = term.split('*');
    let product = 1;
    for (const f of factors) {
      const num = parseFloat(f);
      if (Number.isNaN(num)) {
        product *= 1;
      } else {
        product *= num;
      }
    }
    total += sign * product;
  }

  return Math.max(0, Math.round(total));
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
  // Expresión matemática en vivo (ej: "1500+2500*2")
  const [expressionStr, setExpressionStr] = useState<string>('0');
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

  const amount = useMemo(() => evaluatePosExpression(expressionStr), [expressionStr]);
  const hasMathOperators = /[+\-*]/.test(expressionStr);

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
    const ownerEmail = (business?.email || 'nombre@comercio.com').toLowerCase();
    const hasOwner = list.some(
      (m) => m.role === 'owner' || m.email.toLowerCase() === ownerEmail
    );
    if (!hasOwner) {
      list.unshift({
        id: 'team-owner-main',
        businessId: business?.id || 'la-burger',
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
    setExpressionStr((prev) => {
      if (prev === '0' && digit !== '.') return digit;
      if (prev.length >= 28) return prev;
      // Evitar múltiples puntos decimales en el mismo operando
      if (digit === '.') {
        const parts = prev.split(/[+\-*]/);
        const currentOperand = parts[parts.length - 1] || '';
        if (currentOperand.includes('.')) return prev;
      }
      return prev + digit;
    });
  }, []);

  const handleOperator = useCallback((op: '+' | '-' | '*') => {
    setExpressionStr((prev) => {
      if (prev === '0' || !prev) return prev;
      if (prev.length >= 28) return prev;
      // Si ya termina en un operador, reemplazarlo por el nuevo
      if (/[+\-*.]$/.test(prev)) {
        return prev.slice(0, -1) + op;
      }
      return prev + op;
    });
  }, []);

  const handleResolveEquals = useCallback(() => {
    setExpressionStr((prev) => String(evaluatePosExpression(prev)));
  }, []);

  const handleBackspace = useCallback(() => {
    setExpressionStr((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  }, []);

  const handleClear = useCallback(() => {
    setExpressionStr('0');
    setScannedItems([]);
  }, []);

  const handleQuickAmount = (val: number) => {
    setExpressionStr((prev) => {
      if (prev === '0') return String(val);
      if (/[+\-*]$/.test(prev)) return prev + String(val);
      return `${prev}+${val}`;
    });
  };

  // Recalcular importe total cuando se escanean o modifican productos del lector
  const syncAmountWithItems = (items: SaleItem[]) => {
    setScannedItems(items);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setExpressionStr(String(Math.round(total)));
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
        setExpressionStr(String(Math.round(total)));
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
      setExpressionStr('0');
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

  // Soporte completo para teclado numérico físico y expresiones matemáticas (+, -, *, ., Enter)
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
      } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        handleDigit('.');
      } else if (e.key === '+') {
        e.preventDefault();
        handleOperator('+');
      } else if (e.key === '-') {
        e.preventDefault();
        handleOperator('-');
      } else if (e.key === '*' || e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleOperator('*');
      } else if (e.key === '=') {
        e.preventDefault();
        handleResolveEquals();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (hasMathOperators) {
          handleResolveEquals();
        } else if (amount > 0 && !isSubmitting) {
          handleCreateSale();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleDigit,
    handleOperator,
    handleResolveEquals,
    handleBackspace,
    handleClear,
    handleCreateSale,
    hasMathOperators,
    amount,
    isSubmitting,
    showCashierAccountModal,
    showCatalogModal,
  ]);

  const handleSelectAccount = async (member: TeamMember) => {
    const currentRank = getRoleRank(user?.isSuperAdmin ? 'superadmin' : user?.role);
    const targetRank = getRoleRank(member.role);

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
    <div className="theme-panel min-h-screen bg-[#0C0C0E] text-[#F4F4F0] flex flex-col">
      {/* Header de Caja Tactile Hardware */}
      <header className="panel-chrome-dark h-16 px-4 sm:px-8 border-b border-[#282830] bg-[#141418] text-[#F4F4F0] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user?.role !== 'cashier' && (
            <Link
              to="/panel/resumen"
              className="p-2 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] text-[#A1A1AA] hover:text-[#F4F4F0] border border-[#282830] transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Ir al Panel"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Panel</span>
            </Link>
          )}

          <div className="flex items-center gap-2.5">
            <BrandLogo variant="isotipo" size="sm" />
            <div>
              <h1 className="font-bold text-sm text-[#F4F4F0] leading-none">
                Caja POS · {business?.name || 'La Burger'}
              </h1>
              <span className="text-[11px] text-[#2FB36A] font-medium flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2FB36A]" />
                {user?.name || 'Cajero'} ({currentRoleLabel})
              </span>
            </div>
          </div>
        </div>

        {/* Selector de Cartel + Modo Oscuro/Claro + Cambiar/Crear cuenta */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#1C1C22] border border-[#282830] rounded-xl px-3 py-1.5">
            <QrCode className="w-4 h-4 text-[#D95B26] shrink-0" />
            <select
              value={selectedCartel?.id || ''}
              onChange={(e) => setSelectedCartelId(e.target.value)}
              aria-label="Seleccionar cartel de caja"
              className="bg-transparent text-xs font-bold text-[#F4F4F0] focus:outline-none cursor-pointer"
            >
              {carteles.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#141418] text-[#F4F4F0]">
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label="Cambiar modo de color"
            className="w-9 h-9 rounded-xl bg-[#1C1C22] border border-[#282830] hover:border-[#BEC8FF] text-[#F4F4F0] flex items-center justify-center transition-colors cursor-pointer"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-[#BEC8FF]" />
            ) : (
              <Moon className="w-4 h-4 text-[#BEC8FF]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setPendingElevationMember(null);
              setElevationPassword('');
              setShowCashierAccountModal(true);
            }}
            title="Cambiar o crear cuenta"
            aria-label="Cambiar o crear cuenta"
            className="w-9 h-9 rounded-xl bg-[#1C1C22] border border-[#282830] hover:border-[#BEC8FF] text-[#BEC8FF] flex items-center justify-center transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Cuerpo Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Teclado de Cobro con Calculadora de Expresiones (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="stat-card p-5 sm:p-6 space-y-5">
            {/* Visor de Importe y Expresión Matemática */}
            <div className="p-5 rounded-2xl bg-[#141418] border border-[#282830] flex flex-col items-end justify-center stat-badge">
              <div className="w-full flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#A1A1AA] stat-detail">
                  Cartel vinculado: <strong className="text-[#F4F4F0]">{selectedCartel?.code}</strong>
                </span>
                <span className="text-[11px] font-mono text-[#2FB36A] flex items-center gap-1 stat-detail">
                  <Calculator className="w-3.5 h-3.5" />
                  Teclado físico activo (+, -, *, Enter)
                </span>
              </div>

              {/* Visor de fórmula en vivo (ej: 1500 + 2500 * 2) */}
              <div className="w-full text-right min-h-[20px]">
                {hasMathOperators ? (
                  <span className="text-xs sm:text-sm font-mono font-semibold text-[#BEC8FF] tracking-wide">
                    {expressionStr.replace(/\+/g, ' + ').replace(/-/g, ' - ').replace(/\*/g, ' × ')} =
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-[#A1A1AA]">
                    Escribí montos o sumá con + / * en tu teclado
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold text-[#D95B26]">$</span>
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F4F4F0] font-mono tabular-nums">
                  {amount.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Productos escaneados o elegidos en la venta actual */}
            {scannedItems.length > 0 && (
              <div className="p-3.5 rounded-xl bg-[#141418] border border-[#282830] space-y-2 stat-badge">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F4F4F0] flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#BEC8FF]" />
                    Productos en este cobro ({scannedItems.reduce((a, b) => a + b.quantity, 0)})
                  </span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[11px] text-[#A1A1AA] hover:text-red-400 cursor-pointer"
                  >
                    Vaciar
                  </button>
                </div>
                <div className="divide-y divide-[#282830] max-h-36 overflow-y-auto">
                  {scannedItems.map((item) => (
                    <div
                      key={item.id}
                      className="py-1.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-[#F4F4F0] font-medium truncate">{item.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleChangeItemQty(item.id, -1)}
                          className="w-6 h-6 rounded-md bg-[#1C1C22] border border-[#282830] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F0] cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold text-[#F4F4F0] w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleChangeItemQty(item.id, 1)}
                          className="w-6 h-6 rounded-md bg-[#1C1C22] border border-[#282830] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F0] cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-semibold text-[#BEC8FF] w-20 text-right">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Importes Rápidos (suman al cálculo actual) */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="py-2 px-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xs font-mono font-semibold text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
                >
                  +${val.toLocaleString('es-AR')}
                </button>
              ))}
            </div>

            {/* Teclado Numérico + Operadores Matemáticos (+, -, ×, =) */}
            <div className="grid grid-cols-4 gap-2.5">
              {['7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="h-14 rounded-xl bg-[#141418] hover:bg-[#1C1C22] active:bg-[#24242C] border border-[#282830] text-xl font-bold font-mono text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="Borrar último dígito"
                className="h-14 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] border border-[#282830] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
              >
                <Delete className="w-5 h-5" />
              </button>

              {['4', '5', '6'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="h-14 rounded-xl bg-[#141418] hover:bg-[#1C1C22] active:bg-[#24242C] border border-[#282830] text-xl font-bold font-mono text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleOperator('+')}
                className="h-14 rounded-xl bg-[#1C1C22] hover:bg-[#D95B26]/20 border border-[#282830] text-xl font-bold font-mono text-[#D95B26] transition-colors cursor-pointer stat-badge"
              >
                +
              </button>

              {['1', '2', '3'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="h-14 rounded-xl bg-[#141418] hover:bg-[#1C1C22] active:bg-[#24242C] border border-[#282830] text-xl font-bold font-mono text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleOperator('-')}
                className="h-14 rounded-xl bg-[#1C1C22] hover:bg-[#BEC8FF]/20 border border-[#282830] text-xl font-bold font-mono text-[#BEC8FF] transition-colors cursor-pointer stat-badge"
              >
                −
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="h-14 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] border border-[#282830] text-xs font-bold text-[#A1A1AA] hover:text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
              >
                C / Esc
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-14 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xl font-bold font-mono text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleOperator('*')}
                className="h-14 rounded-xl bg-[#1C1C22] hover:bg-[#BEC8FF]/20 border border-[#282830] text-lg font-bold font-mono text-[#BEC8FF] transition-colors cursor-pointer stat-badge"
              >
                ×
              </button>
              <button
                type="button"
                onClick={handleResolveEquals}
                className="h-14 rounded-xl bg-[#2FB36A]/20 hover:bg-[#2FB36A]/30 border border-[#2FB36A]/50 text-xl font-bold font-mono text-[#2FB36A] transition-colors cursor-pointer stat-badge"
              >
                =
              </button>
            </div>

            {/* Selección de método de pago: "Efectivo" - "Tarjeta" - "QR" */}
            <div>
              <span className="block text-xs font-semibold text-[#A1A1AA] mb-2 stat-detail">
                Método de pago
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMethod('cash')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 stat-badge ${
                    method === 'cash'
                      ? 'bg-[#2FB36A]/15 border-[#2FB36A] text-[#F4F4F0]'
                      : 'bg-[#141418] border-[#282830] text-[#A1A1AA] hover:text-[#F4F4F0]'
                  }`}
                >
                  <Banknote
                    className={`w-5 h-5 ${
                      method === 'cash' ? 'text-[#2FB36A]' : 'text-[#A1A1AA]'
                    }`}
                  />
                  <span className="text-xs font-bold block">Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('card')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 stat-badge ${
                    method === 'card'
                      ? 'bg-[#BEC8FF]/15 border-[#BEC8FF] text-[#F4F4F0]'
                      : 'bg-[#141418] border-[#282830] text-[#A1A1AA] hover:text-[#F4F4F0]'
                  }`}
                >
                  <CreditCard
                    className={`w-5 h-5 ${
                      method === 'card' ? 'text-[#BEC8FF]' : 'text-[#A1A1AA]'
                    }`}
                  />
                  <span className="text-xs font-bold block">Tarjeta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('mercadopago')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 stat-badge ${
                    method === 'mercadopago'
                      ? 'bg-[#D95B26]/15 border-[#D95B26] text-[#F4F4F0]'
                      : 'bg-[#141418] border-[#282830] text-[#A1A1AA] hover:text-[#F4F4F0]'
                  }`}
                >
                  <QrCode
                    className={`w-5 h-5 ${
                      method === 'mercadopago' ? 'text-[#D95B26]' : 'text-[#A1A1AA]'
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

          {/* Comprobante recién emitido con QR Real Escaneable */}
          {emittedReceipt && activeSale && (
            <Card className="stat-card p-5 border-[#2FB36A] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2FB36A]/15 text-[#2FB36A] flex items-center justify-center shrink-0">
                    {emittedReceipt.status === 'ready' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-[#F4F4F0]">
                        Comprobante #{emittedReceipt.id}
                      </h3>
                      <span className="text-xs font-mono font-bold text-[#BEC8FF]">
                        {formatCurrency(emittedReceipt.total)} ({methodBadgeLabel(emittedReceipt.method)})
                      </span>
                    </div>
                    <p className="text-xs text-[#A1A1AA] stat-detail">
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
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-1.5 rounded-xl border border-[#282830]">
                      <RealQrCode
                        value={`${window.location.origin}/r/${emittedReceipt.id}`}
                        size={64}
                      />
                    </div>
                    <Link
                      to={`/r/${emittedReceipt.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs font-semibold text-[#BEC8FF] hover:border-[#BEC8FF] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Columna Derecha: Lector para productos (arriba) + Últimos cobros (abajo) (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Lector para productos: muestra SOLO los 5 productos más vendidos + botón Catálogo */}
          <Card className="stat-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-[#2FB36A]" />
                  <h2 className="font-bold text-sm text-[#F4F4F0]">Lector de productos</h2>
                </div>
                <p className="text-[11px] text-[#A1A1AA] mt-0.5 stat-detail">
                  Top 5 más vendidos · Tocá Catálogo para ver todo el menú
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCatalogSearch('');
                  setShowCatalogModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] border border-[#282830] text-xs font-bold text-[#BEC8FF] flex items-center gap-1.5 cursor-pointer transition-colors stat-badge"
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Catálogo ({catalogProducts.length})</span>
              </button>
            </div>

            <form onSubmit={handleScanSubmit} className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[#141418] border border-[#282830] rounded-xl px-3 py-2 focus-within:border-[#BEC8FF] stat-badge">
                <Barcode className="w-4 h-4 text-[#A1A1AA] shrink-0" />
                <input
                  type="text"
                  placeholder="Código universal o nombre..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full bg-transparent text-xs text-[#F4F4F0] placeholder-[#71717A] focus:outline-none"
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
                    className="w-full p-2.5 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] flex items-center justify-between gap-2 text-left transition-colors cursor-pointer stat-badge"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-[#0C0C0E] border border-[#282830] text-[10px] font-mono font-bold text-[#A1A1AA] flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.title}
                          className="w-8 h-8 rounded-lg object-cover border border-[#282830] shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#0C0C0E] border border-[#282830] flex items-center justify-center text-[#A1A1AA] shrink-0">
                          <ShoppingBag className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#F4F4F0] truncate">
                          {prod.title}
                        </p>
                        <p className="text-[10px] font-mono text-[#A1A1AA] stat-detail">
                          {prod.universalCode ? `Cód: ${prod.universalCode}` : 'Menú sin código'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#BEC8FF] shrink-0 stat-detail">
                      {prod.price !== undefined ? formatCurrency(prod.price) : '$0'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* 2. Últimos cobros: SOLO los 3 últimos cobros hechos por la cuenta activa */}
          <Card padding="none" className="stat-card overflow-hidden">
            <div className="p-5 border-b border-[#282830] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#BEC8FF]" />
                  <h2 className="font-bold text-sm text-[#F4F4F0]">Últimos cobros</h2>
                </div>
                <p className="text-[11px] text-[#A1A1AA] mt-0.5 stat-detail">
                  Últimos 3 cobros realizados por {user?.name || 'esta cuenta'}
                </p>
              </div>
              <button
                type="button"
                onClick={loadInitialData}
                className="text-xs text-[#A1A1AA] hover:text-[#F4F4F0] flex items-center gap-1 cursor-pointer"
                title="Actualizar cobros"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {myLast3Sales.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Smartphone className="w-8 h-8 text-[#A1A1AA] mx-auto" />
                <p className="text-xs font-semibold text-[#F4F4F0]">
                  Sin cobros recientes en esta cuenta
                </p>
                <p className="text-[11px] text-[#A1A1AA] stat-detail">
                  Aquí verás únicamente los últimos 3 cobros emitidos por {user?.name || 'tu usuario'}.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#282830]">
                {myLast3Sales.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-[#141418] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[#F4F4F0]">
                          {formatCurrency(s.amount)}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1C1C22] border border-[#282830] text-[#BEC8FF] stat-badge">
                          {methodBadgeLabel(s.method)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] mt-0.5 stat-detail">
                        {formatDate(s.createdAt)} · {s.cartelCode || 'BURGER01'}
                      </p>
                    </div>

                    {s.receiptId && (
                      <Link
                        to={`/r/${s.receiptId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#BEC8FF] hover:underline shrink-0 flex items-center gap-1 stat-detail"
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

      {/* Modal: Catálogo Completo */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-2xl rounded-2xl bg-[#141418] border border-[#282830] flex flex-col max-h-[88vh] overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#282830] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#BEC8FF]/15 text-[#BEC8FF] flex items-center justify-center shrink-0">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-[#F4F4F0]">
                    Catálogo y Menú Completo
                  </h2>
                  <p className="text-xs text-[#A1A1AA]">
                    Deslizá o buscá platos, cafés y productos con o sin código universal.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="p-2 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F0] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-[#282830] bg-[#0C0C0E]">
              <div className="flex items-center gap-2.5 bg-[#141418] border border-[#282830] rounded-xl px-3.5 py-2.5 focus-within:border-[#BEC8FF]">
                <Search className="w-4 h-4 text-[#A1A1AA] shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar plato, bebida o código universal..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full bg-transparent text-sm text-[#F4F4F0] placeholder-[#71717A] focus:outline-none"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch('')}
                    className="text-xs text-[#A1A1AA] hover:text-[#F4F4F0] cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredCatalogProducts.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <ShoppingBag className="w-8 h-8 text-[#A1A1AA] mx-auto" />
                  <p className="text-sm font-semibold text-[#F4F4F0]">
                    No encontramos productos con "{catalogSearch}"
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
                            ? 'bg-[#2FB36A]/10 border-[#2FB36A]'
                            : 'bg-[#1C1C22] border-[#282830] hover:border-[#3A3A44]'
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
                              className="w-11 h-11 rounded-xl object-cover border border-[#282830] shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-[#141418] border border-[#282830] flex items-center justify-center text-[#BEC8FF] shrink-0">
                              <Coffee className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#F4F4F0] truncate">
                              {prod.title}
                            </p>
                            {prod.description && (
                              <p className="text-[11px] text-[#A1A1AA] truncate">
                                {prod.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-mono font-extrabold text-[#2FB36A]">
                                {prod.price !== undefined ? formatCurrency(prod.price) : '$0'}
                              </span>
                              <span className="text-[10px] font-mono text-[#A1A1AA]">
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
                              className="w-7 h-7 rounded-lg bg-[#141418] border border-[#282830] flex items-center justify-center text-[#F4F4F0] hover:border-[#BEC8FF] cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-5 text-center font-mono text-xs font-bold text-[#F4F4F0]">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => addProductToSale(prod)}
                              className="w-7 h-7 rounded-lg bg-[#2FB36A] text-[#08120C] flex items-center justify-center font-bold cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addProductToSale(prod)}
                            className="px-3 py-1.5 rounded-xl bg-[#141418] hover:bg-[#BEC8FF] text-[#F4F4F0] hover:text-[#0C0C0E] border border-[#282830] text-xs font-bold transition-colors shrink-0 cursor-pointer"
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

            <div className="p-4 border-t border-[#282830] bg-[#1C1C22] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <div>
                  <span className="text-[11px] font-semibold text-[#A1A1AA] block">
                    Importe acumulado ({scannedItems.reduce((a, b) => a + b.quantity, 0)} ítems)
                  </span>
                  <span className="text-2xl font-extrabold font-mono text-[#F4F4F0] tabular-nums">
                    {formatCurrency(amount)}
                  </span>
                </div>
                {scannedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs font-semibold text-[#A1A1AA] hover:text-red-400 underline cursor-pointer"
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

      {/* Modal: Cambiar o crear cuenta */}
      {showCashierAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-[#282830] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#BEC8FF]/15 text-[#BEC8FF] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-[#F4F4F0]">
                    Cambiar o crear cuenta
                  </h2>
                  <p className="text-xs text-[#A1A1AA]">
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
                className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingElevationMember ? (
              <form
                onSubmit={handleConfirmElevationPassword}
                className="p-4 rounded-xl bg-[#1C1C22] border border-[#BEC8FF]/40 space-y-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <KeyRound className="w-4 h-4 text-[#BEC8FF] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#F4F4F0]">
                      Verificación de seguridad requerida
                    </p>
                    <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                      Para cambiar a{' '}
                      <strong className="text-[#F4F4F0]">{pendingElevationMember.name}</strong> (
                      {pendingElevationMember.role === 'owner' ? 'Dueño' : 'Encargado'}), ingresá la
                      contraseña o código de autorización.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showElevationPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Contraseña de registro..."
                    value={elevationPassword}
                    onChange={(e) => setElevationPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#141418] border border-[#282830] text-xs text-[#F4F4F0] focus:outline-none focus:border-[#BEC8FF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowElevationPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#F4F4F0] cursor-pointer"
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
                {selectableAccounts.length > 0 && (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    <p className="text-xs font-semibold text-[#A1A1AA]">Cuentas del comercio</p>
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
                              ? 'bg-[#2FB36A]/15 border-[#2FB36A] text-[#F4F4F0]'
                              : 'bg-[#1C1C22] border-[#282830] text-[#F4F4F0] hover:border-[#BEC8FF]'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold flex items-center gap-1.5">
                              <span>{m.name}</span>
                              {requiresPassword && (
                                <Lock className="w-3 h-3 text-[#BEC8FF]" />
                              )}
                            </p>
                            <p className="text-[11px] text-[#A1A1AA]">{roleLabel}</p>
                          </div>
                          <span className="text-xs font-semibold text-[#BEC8FF]">
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

                <form
                  onSubmit={handleCreateAndSwitchCashier}
                  className="pt-4 border-t border-[#282830] space-y-3"
                >
                  <label className="block text-xs font-semibold text-[#A1A1AA]">
                    Crear nuevo cajero (Nombre y apellido)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Ej: Sofía López"
                      value={newCashierName}
                      onChange={(e) => setNewCashierName(e.target.value)}
                      className="flex-1 bg-[#1C1C22] border border-[#282830] rounded-xl px-3.5 py-2.5 text-xs text-[#F4F4F0] focus:outline-none focus:border-[#BEC8FF]"
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
