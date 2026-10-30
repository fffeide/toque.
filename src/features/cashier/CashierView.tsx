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
import { PlanState } from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BrandLogo } from '../../components/ui/Avatar';
import { RealQrCode } from '../../components/ui/RealQrCode';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { ClubScannerView } from '../panel/ClubScannerView';
import {
  QrCode,
  Award,
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

const DEFAULT_FALLBACK_AMOUNTS = [1500, 2500, 3800, 5000, 8500, 12000];

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

function stripRoleFromName(rawName?: string): string {
  if (!rawName) return 'Cajero';
  return rawName.replace(/\s*\([^)]*\)/g, '').trim() || 'Cajero';
}

/**
 * Evaluador aritmético seguro sin eval() para expresiones POS con +, - y *
 */
function evaluatePosExpression(expr: string): number {
  const sanitized = expr.replace(/,/g, '.').replace(/[^0-9+\-*.]/g, '');
  if (!sanitized) return 0;

  const trimmed = sanitized.replace(/[+\-*.]+$/, '');
  if (!trimmed) return 0;

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

  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [carteles, setCarteles] = useState<Cartel[]>([DEFAULT_FALLBACK_CARTEL]);
  const [selectedCartelId, setSelectedCartelId] = useState<string>(
    user?.assignedCartelId || DEFAULT_FALLBACK_CARTEL.id
  );
  const [expressionStr, setExpressionStr] = useState<string>('0');
  const [method, setMethod] = useState<PaymentMethod>('mercadopago');
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catálogo de productos y lector de código universal
  const [catalogProducts, setCatalogProducts] = useState<HubProduct[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedItems, setScannedItems] = useState<SaleItem[]>([]);

  // Modal de Catálogo
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Comprobante activo emitido
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [emittedReceipt, setEmittedReceipt] = useState<Receipt | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(120);

  // Modal de Sumar Sello desde Caja
  const [showStampModal, setShowStampModal] = useState<boolean>(false);

  // Perfil activo en POS (en memoria de sesión)
  const [activeProfile, setActiveProfile] = useState<{
    id: string;
    name: string;
    role: 'owner' | 'manager' | 'cashier';
    email?: string;
  }>(() => ({
    id: user?.id || 'default-profile',
    name: stripRoleFromName(user?.name || business?.ownerName || 'Cajero'),
    role:
      user?.role === 'cashier'
        ? 'cashier'
        : user?.role === 'manager'
        ? 'manager'
        : 'owner',
    email: user?.email,
  }));

  const [showCashierAccountModal, setShowCashierAccountModal] = useState<boolean>(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newCashierName, setNewCashierName] = useState('');
  const [isCreatingCashier, setIsCreatingCashier] = useState(false);
  const [pendingElevationMember, setPendingElevationMember] = useState<TeamMember | null>(null);
  const [elevationPassword, setElevationPassword] = useState('');
  const [showElevationPassword, setShowElevationPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  const persistActivePosProfile = useCallback(
    (profile: {
      id: string;
      name: string;
      role: 'owner' | 'manager' | 'cashier';
      email?: string;
    }) => {
      setActiveProfile(profile);
    },
    []
  );

  const selectedCartel =
    carteles.find((c) => c.id === selectedCartelId) || carteles[0] || DEFAULT_FALLBACK_CARTEL;

  const amount = useMemo(() => evaluatePosExpression(expressionStr), [expressionStr]);
  const hasMathOperators = /[+\-*]/.test(expressionStr);

  const loadInitialData = useCallback(() => {
    api
      .getPlanState()
      .then(setPlanState)
      .catch(() => {});

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

  // Montos más usados del POS (calculados de los cobros históricos + precios de combos/productos)
  const mostUsedAmounts = useMemo(() => {
    const freqMap = new Map<number, number>();

    for (const s of allSales) {
      if (s.status === 'paid' && s.amount > 0) {
        const rounded = Math.round(s.amount);
        freqMap.set(rounded, (freqMap.get(rounded) || 0) + 3);
      }
      if (Array.isArray(s.items)) {
        for (const item of s.items) {
          if (item.price > 0) {
            const p = Math.round(item.price);
            freqMap.set(p, (freqMap.get(p) || 0) + (item.quantity || 1) * 2);
          }
        }
      }
    }

    for (const prod of catalogProducts) {
      if (prod.price && prod.price > 0) {
        const p = Math.round(prod.price);
        freqMap.set(p, (freqMap.get(p) || 0) + 1);
      }
    }

    const sortedByFreq = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([val]) => val);

    const result: number[] = [];
    for (const val of sortedByFreq) {
      if (!result.includes(val)) result.push(val);
      if (result.length >= 6) break;
    }
    for (const fallback of DEFAULT_FALLBACK_AMOUNTS) {
      if (result.length >= 6) break;
      if (!result.includes(fallback)) result.push(fallback);
    }

    return result.slice(0, 6);
  }, [allSales, catalogProducts]);

  // Top 5 productos más vendidos
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

  const cleanActiveCashierName = useMemo(
    () => stripRoleFromName(activeProfile.name || user?.name || 'Cajero'),
    [activeProfile.name, user?.name]
  );

  // Últimos 3 cobros realizados por el perfil activo
  const myLast3Sales = useMemo(() => {
    const targetName = cleanActiveCashierName.toLowerCase();
    const targetEmail = (activeProfile.email || user?.email || '').toLowerCase();

    const filtered = allSales.filter((s) => {
      const saleCashierClean = stripRoleFromName(s.cashierName).toLowerCase();
      const matchName = Boolean(targetName && saleCashierClean === targetName);
      const matchEmail = Boolean(
        targetEmail && s.cashierEmail && s.cashierEmail.toLowerCase() === targetEmail
      );
      return matchName || matchEmail;
    });

    return (filtered.length > 0 ? filtered : allSales).slice(0, 3);
  }, [allSales, cleanActiveCashierName, activeProfile.email, user?.email]);

  // Todos los perfiles del comercio (Dueño, Encargados y Cajeros) enlazados con Equipo
  const selectableAccounts = useMemo(() => {
    const list = [...teamMembers];
    const creatorName = stripRoleFromName(user?.name || business?.ownerName || 'Dueño');
    const ownerEmail = (business?.email || user?.email || '').toLowerCase();
    const hasOwner = list.some((m) => m.role === 'owner');
    if (!hasOwner) {
      list.unshift({
        id: 'team-owner-main',
        businessId: business?.id || 'la-burger',
        name: creatorName,
        email: ownerEmail,
        role: 'owner',
        status: 'active',
        addedAt: business?.createdAt || new Date().toISOString(),
      });
    }
    return list.map((m) => ({
      ...m,
      name: stripRoleFromName(m.name),
    }));
  }, [teamMembers, business, user]);

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

  const [cashTenderedInput, setCashTenderedInput] = useState<string>('');

  const parsedCashTendered = useMemo(() => {
    const clean = cashTenderedInput.replace(/[^0-9]/g, '');
    if (!clean) return 0;
    return parseInt(clean, 10) || 0;
  }, [cashTenderedInput]);

  const changeDue = useMemo(() => {
    if (method !== 'cash' || parsedCashTendered <= 0 || amount <= 0) return 0;
    return Math.max(0, parsedCashTendered - amount);
  }, [method, parsedCashTendered, amount]);

  const handleClear = useCallback(() => {
    setExpressionStr('0');
    setScannedItems([]);
    setCashTenderedInput('');
  }, []);

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
    if (method === 'cash' && parsedCashTendered > 0 && parsedCashTendered < amount) {
      showToast('El efectivo recibido es menor al total a cobrar', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const effectiveTendered =
        method === 'cash'
          ? parsedCashTendered > 0
            ? parsedCashTendered
            : amount
          : undefined;
      const effectiveChange =
        method === 'cash' && effectiveTendered
          ? Math.max(0, effectiveTendered - amount)
          : undefined;

      const res = await api.createSale({
        cartelId: selectedCartel.id,
        amount,
        cashTendered: effectiveTendered,
        changeDue: effectiveChange,
        method,
        items: scannedItems.length > 0 ? scannedItems : undefined,
      });

      res.sale.cashierName = cleanActiveCashierName;
      setActiveSale(res.sale);
      if (res.receipt) {
        setSecondsLeft(120);
        setEmittedReceipt(res.receipt);
      }
      setExpressionStr('0');
      setScannedItems([]);
      setCashTenderedInput('');
      showToast(
        `Comprobante ${res.receipt?.id || ''} activo en ${selectedCartel.code} por 2 minutos`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Error al registrar el cobro', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedCartel,
    amount,
    method,
    parsedCashTendered,
    scannedItems,
    cleanActiveCashierName,
    showToast,
  ]);

  // Soporte silencioso para teclado numérico físico (+, -, *, ., Enter)
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

      if (showCashierAccountModal || showCatalogModal || showStampModal) return;

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
    showStampModal,
  ]);

  // Cajeros NO tienen contraseña; Encargados y Dueños SÍ piden contraseña
  const handleSelectAccount = async (member: TeamMember) => {
    if (member.role === 'cashier') {
      persistActivePosProfile({
        id: member.id,
        name: stripRoleFromName(member.name),
        role: 'cashier',
        email: '',
      });
      showToast(`Perfil activo en caja: ${stripRoleFromName(member.name)}`, 'success');
      setShowCashierAccountModal(false);
      setPendingElevationMember(null);
      return;
    }

    // Encargado o Dueño requiere contraseña
    setPendingElevationMember(member);
    setElevationPassword('');
    setShowElevationPassword(false);
  };

  const handleConfirmElevationPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingElevationMember) return;
    if (!elevationPassword.trim()) {
      showToast('Ingresá la contraseña para usar el perfil de Encargado o Dueño', 'error');
      return;
    }

    setIsVerifyingPassword(true);
    try {
      if (pendingElevationMember.email) {
        await login({
          email: pendingElevationMember.email,
        });
      }
      persistActivePosProfile({
        id: pendingElevationMember.id,
        name: stripRoleFromName(pendingElevationMember.name),
        role: pendingElevationMember.role,
        email: pendingElevationMember.email,
      });
      showToast(`Perfil activo: ${stripRoleFromName(pendingElevationMember.name)}`, 'success');
      setPendingElevationMember(null);
      setElevationPassword('');
      setShowCashierAccountModal(false);
    } catch (err: any) {
      showToast(err?.message || 'Contraseña incorrecta.', 'error');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  // Crear cajero directamente desde Caja (enlazado con Equipo, sin pedir email)
  const handleCreateAndSwitchCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCashierName.trim()) {
      showToast('Ingresá el nombre del cajero', 'error');
      return;
    }

    setIsCreatingCashier(true);
    try {
      const created = await api.addTeamMember({
        name: newCashierName.trim(),
        role: 'cashier',
      });
      setTeamMembers((prev) => [...prev, created]);
      persistActivePosProfile({
        id: created.id,
        name: stripRoleFromName(created.name),
        role: 'cashier',
        email: '',
      });
      setNewCashierName('');
      setShowCashierAccountModal(false);
      setPendingElevationMember(null);
      showToast(`Cajero creado y vinculado con Equipo: ${created.name}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'No se pudo crear el cajero', 'error');
    } finally {
      setIsCreatingCashier(false);
    }
  };

  const methodBadgeLabel = (m: PaymentMethod) =>
    m === 'mercadopago' || m === 'mp_qr' ? 'QR' : m === 'cash' ? 'Efectivo' : 'Tarjeta';

  const currentRoleLabel =
    activeProfile.role === 'owner'
      ? 'Dueño'
      : activeProfile.role === 'manager'
      ? 'Encargado'
      : 'Cajero';

  // Bloqueo por Plan Gratuito (Gratuito: sin POS)
  if (planState?.planId === 'free' || planState?.status === 'free') {
    return (
      <div className="theme-panel min-h-screen bg-[#0C0C0E] text-[#F4F4F0] flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <div className="w-10 h-10 rounded-xl bg-[#D95B26]/15 text-[#D95B26] flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-base font-bold text-[#F4F4F0]">
            Caja POS disponible en Plan Pago
          </h1>
          <p className="text-xs text-[#A1A1AA]">
            El Plan Gratuito incluye 1 tarjeta de sellos y 1 local, sin terminal POS. Pasate al Plan Pago para habilitar Caja POS y hasta 3 sucursales.
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="secundario" size="sm" onClick={() => navigate('/panel/resumen')}>
              Volver al panel
            </Button>
            <Button variant="ultramar" size="sm" onClick={() => navigate('/panel/cuenta')}>
              Ver suscripción
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="theme-panel min-h-screen bg-[#0C0C0E] text-[#F4F4F0] flex flex-col text-sm">
      {/* Header de Caja */}
      <header className="panel-chrome-dark h-14 px-4 sm:px-6 border-b border-[#282830] bg-[#141418] text-[#F4F4F0] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activeProfile.role !== 'cashier' && (
            <Link
              to="/panel/resumen"
              className="p-1.5 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] text-[#A1A1AA] hover:text-[#F4F4F0] border border-[#282830] transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Ir al Panel"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Panel</span>
            </Link>
          )}

          <div className="flex items-center gap-2">
            <BrandLogo variant="isotipo" size="sm" />
            <div>
              <h1 className="font-bold text-xs text-[#F4F4F0] leading-none">
                Caja POS · {business?.name || 'Mi Comercio'}
              </h1>
              <span className="text-[11px] text-[#2FB36A] font-medium flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2FB36A]" />
                {cleanActiveCashierName} ({currentRoleLabel})
              </span>
            </div>
          </div>
        </div>

        {/* Selector de Cartel + Modo Oscuro/Claro + Elegir Perfil */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 bg-[#1C1C22] border border-[#282830] rounded-xl px-2.5 py-1.5">
            <QrCode className="w-3.5 h-3.5 text-[#D95B26] shrink-0" />
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
            className="w-8 h-8 rounded-xl bg-[#1C1C22] border border-[#282830] hover:border-[#BEC8FF] text-[#F4F4F0] flex items-center justify-center transition-colors cursor-pointer"
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
            title="Elegir perfil"
            aria-label="Elegir perfil"
            className="px-2.5 h-8 rounded-xl bg-[#1C1C22] border border-[#282830] hover:border-[#BEC8FF] text-[#BEC8FF] flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Perfil</span>
          </button>
        </div>
      </header>

      {/* Cuerpo Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna Izquierda: Teclado de Cobro (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="stat-card p-4 sm:p-5 space-y-4">
            {/* Visor de Importe Limpio */}
            <div className="p-4 rounded-2xl bg-[#141418] border border-[#282830] flex flex-col items-end justify-center stat-badge">
              <div className="w-full flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-[#A1A1AA] stat-detail">
                  Cartel vinculado: <strong className="text-[#F4F4F0]">{selectedCartel?.code}</strong>
                </span>
                {hasMathOperators && (
                  <span className="text-xs font-mono font-semibold text-[#BEC8FF] tracking-wide">
                    {expressionStr.replace(/\+/g, ' + ').replace(/-/g, ' - ').replace(/\*/g, ' × ')} =
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-[#D95B26]">$</span>
                <span className="text-3xl font-extrabold tracking-tight text-[#F4F4F0] font-mono tabular-nums">
                  {amount.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Productos escaneados o elegidos en la venta actual */}
            {scannedItems.length > 0 && (
              <div className="p-3 rounded-xl bg-[#141418] border border-[#282830] space-y-2 stat-badge">
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
                <div className="divide-y divide-[#282830] max-h-32 overflow-y-auto">
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

            {/* Teclado Numérico + Operadores Matemáticos (+, -, ×, =) */}
            <div className="grid grid-cols-4 gap-2">
              {['7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="h-12 rounded-xl bg-[#141418] hover:bg-[#1C1C22] active:bg-[#24242C] border border-[#282830] text-lg font-bold font-mono text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="Borrar último dígito"
                className="h-12 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] border border-[#282830] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
              >
                <Delete className="w-4 h-4" />
              </button>

              {['4', '5', '6'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="h-12 rounded-xl bg-[#141418] hover:bg-[#1C1C22] active:bg-[#24242C] border border-[#282830] text-lg font-bold font-mono text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleOperator('+')}
                className="h-12 rounded-xl bg-[#1C1C22] hover:bg-[#D95B26]/20 border border-[#282830] text-lg font-bold font-mono text-[#D95B26] transition-colors cursor-pointer stat-badge"
              >
                +
              </button>

              {['1', '2', '3'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="h-12 rounded-xl bg-[#141418] hover:bg-[#1C1C22] active:bg-[#24242C] border border-[#282830] text-lg font-bold font-mono text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleOperator('-')}
                className="h-12 rounded-xl bg-[#1C1C22] hover:bg-[#BEC8FF]/20 border border-[#282830] text-lg font-bold font-mono text-[#BEC8FF] transition-colors cursor-pointer stat-badge"
              >
                −
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="h-12 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] border border-[#282830] text-xs font-bold text-[#A1A1AA] hover:text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
              >
                C / Esc
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-12 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-lg font-bold font-mono text-[#F4F4F0] transition-colors cursor-pointer stat-badge"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleOperator('*')}
                className="h-12 rounded-xl bg-[#1C1C22] hover:bg-[#BEC8FF]/20 border border-[#282830] text-base font-bold font-mono text-[#BEC8FF] transition-colors cursor-pointer stat-badge"
              >
                ×
              </button>
              <button
                type="button"
                onClick={handleResolveEquals}
                className="h-12 rounded-xl bg-[#2FB36A]/20 hover:bg-[#2FB36A]/30 border border-[#2FB36A]/50 text-lg font-bold font-mono text-[#2FB36A] transition-colors cursor-pointer stat-badge"
              >
                =
              </button>
            </div>

            {/* Selección de método de pago */}
            <div className="space-y-3">
              <div>
                <span className="block text-xs font-semibold text-[#A1A1AA] mb-1.5 stat-detail">
                  Método de pago
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod('cash')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 stat-badge ${
                      method === 'cash'
                        ? 'bg-[#2FB36A]/15 border-[#2FB36A] text-[#F4F4F0]'
                        : 'bg-[#141418] border-[#282830] text-[#A1A1AA] hover:text-[#F4F4F0]'
                    }`}
                  >
                    <Banknote
                      className={`w-4 h-4 ${
                        method === 'cash' ? 'text-[#2FB36A]' : 'text-[#A1A1AA]'
                      }`}
                    />
                    <span className="text-xs font-bold">Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod('card')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 stat-badge ${
                      method === 'card'
                        ? 'bg-[#BEC8FF]/15 border-[#BEC8FF] text-[#F4F4F0]'
                        : 'bg-[#141418] border-[#282830] text-[#A1A1AA] hover:text-[#F4F4F0]'
                    }`}
                  >
                    <CreditCard
                      className={`w-4 h-4 ${
                        method === 'card' ? 'text-[#BEC8FF]' : 'text-[#A1A1AA]'
                      }`}
                    />
                    <span className="text-xs font-bold">Tarjeta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod('mercadopago')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 stat-badge ${
                      method === 'mercadopago'
                        ? 'bg-[#D95B26]/15 border-[#D95B26] text-[#F4F4F0]'
                        : 'bg-[#141418] border-[#282830] text-[#A1A1AA] hover:text-[#F4F4F0]'
                    }`}
                  >
                    <QrCode
                      className={`w-4 h-4 ${
                        method === 'mercadopago' ? 'text-[#D95B26]' : 'text-[#A1A1AA]'
                      }`}
                    />
                    <span className="text-xs font-bold">QR</span>
                  </button>
                </div>
              </div>

              {/* Cálculo de vuelto cuando el cajero selecciona Efectivo */}
              {method === 'cash' && (
                <div className="p-3.5 rounded-2xl bg-[#141418] border border-[#2FB36A]/40 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-[#F4F4F0]">
                      Paga con efectivo ($)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {amount > 0 && (
                        <button
                          type="button"
                          onClick={() => setCashTenderedInput(String(amount))}
                          className="px-2 py-1 rounded-lg bg-[#1C1C22] hover:bg-[#282830] border border-[#282830] text-[11px] font-semibold text-[#2FB36A] cursor-pointer"
                        >
                          Exacto
                        </button>
                      )}
                      {[5000, 10000, 20000, 50000].map((bill) => (
                        <button
                          key={bill}
                          type="button"
                          onClick={() => setCashTenderedInput(String(bill))}
                          className="px-2 py-1 rounded-lg bg-[#1C1C22] hover:bg-[#282830] border border-[#282830] text-[11px] font-mono font-semibold text-[#F4F4F0] cursor-pointer"
                        >
                          ${bill.toLocaleString('es-AR')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="flex items-center gap-1.5 bg-[#0C0C0E] border border-[#282830] rounded-xl px-3 py-2 focus-within:border-[#2FB36A]">
                      <span className="text-xs font-bold text-[#2FB36A]">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cashTenderedInput}
                        onChange={(e) =>
                          setCashTenderedInput(e.target.value.replace(/[^0-9]/g, ''))
                        }
                        placeholder={amount > 0 ? String(amount) : '0'}
                        className="w-full bg-transparent text-sm font-mono font-bold text-[#F4F4F0] focus:outline-none"
                      />
                    </div>

                    <div className="px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] flex items-center justify-between">
                      <span className="text-xs text-[#A1A1AA]">Vuelto</span>
                      <span
                        className={`text-sm font-mono font-extrabold ${
                          parsedCashTendered > 0 && parsedCashTendered < amount
                            ? 'text-red-400'
                            : 'text-[#2FB36A]'
                        }`}
                      >
                        {parsedCashTendered > 0 && parsedCashTendered < amount
                          ? `Faltan $${(amount - parsedCashTendered).toLocaleString('es-AR')}`
                          : `$${changeDue.toLocaleString('es-AR')}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button
              variant="ultramar"
              size="md"
              fullWidth
              loading={isSubmitting}
              disabled={amount <= 0}
              onClick={handleCreateSale}
              icon={<ReceiptIcon className="w-4 h-4" />}
            >
              Cobrar {amount > 0 ? formatCurrency(amount) : ''} y emitir comprobante
            </Button>
          </Card>

          {/* Comprobante recién emitido */}
          {emittedReceipt && activeSale && (
            <Card className="stat-card p-4 border-[#2FB36A] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#2FB36A]/15 text-[#2FB36A] flex items-center justify-center shrink-0">
                    {emittedReceipt.status === 'ready' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-xs text-[#F4F4F0]">
                        Comprobante #{emittedReceipt.id}
                      </h3>
                      <span className="text-xs font-mono font-bold text-[#BEC8FF]">
                        {formatCurrency(emittedReceipt.total)} ({methodBadgeLabel(emittedReceipt.method)})
                      </span>
                      {emittedReceipt.method === 'cash' &&
                        typeof emittedReceipt.changeDue === 'number' &&
                        emittedReceipt.changeDue > 0 && (
                          <span className="text-xs font-mono font-bold text-[#2FB36A]">
                            · Vuelto: {formatCurrency(emittedReceipt.changeDue)}
                          </span>
                        )}
                    </div>
                    <p className="text-[11px] text-[#A1A1AA] stat-detail">
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
                        size={56}
                      />
                    </div>
                    <Link
                      to={`/r/${emittedReceipt.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-[#1C1C22] border border-[#282830] text-xs font-semibold text-[#BEC8FF] hover:border-[#BEC8FF] flex items-center gap-1.5 shrink-0"
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

        {/* Columna Derecha: Lector de productos + Últimos cobros + Sumar sello debajo (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Lector de productos */}
          <Card className="stat-card p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Barcode className="w-4 h-4 text-[#2FB36A]" />
                <h2 className="font-bold text-xs text-[#F4F4F0]">Lector de productos</h2>
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
                <span>Catálogo</span>
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
                    className="w-full p-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] flex items-center justify-between gap-2 text-left transition-colors cursor-pointer stat-badge"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-[#0C0C0E] border border-[#282830] text-[10px] font-mono font-bold text-[#A1A1AA] flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#F4F4F0] truncate">
                          {prod.title}
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

          {/* 2. Últimos cobros */}
          <Card padding="none" className="stat-card overflow-hidden">
            <div className="p-4 border-b border-[#282830] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#BEC8FF]" />
                  <h2 className="font-bold text-xs text-[#F4F4F0]">Últimos cobros</h2>
                </div>
                <p className="text-[11px] text-[#A1A1AA] mt-0.5 stat-detail">
                  Últimos 3 cobros realizados por {cleanActiveCashierName}
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
              <div className="p-6 text-center space-y-1.5">
                <Smartphone className="w-6 h-6 text-[#A1A1AA] mx-auto" />
                <p className="text-xs font-semibold text-[#F4F4F0]">
                  Sin cobros recientes
                </p>
                <p className="text-[11px] text-[#A1A1AA] stat-detail">
                  Últimos 3 cobros realizados por {cleanActiveCashierName}.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#282830]">
                {myLast3Sales.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#141418] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#F4F4F0]">
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

          {/* 3. Sumar sello — debajo de Últimos cobros */}
          <Card className="stat-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D95B26]/15 border border-[#D95B26]/30 text-[#D95B26] flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-xs text-[#F4F4F0]">Sumar sello</h2>
                  <p className="text-[11px] text-[#A1A1AA]">
                    Ingresá el código de la tarjeta o escaneá el QR del cliente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStampModal(true)}
                className="px-3.5 py-2 rounded-xl bg-[#D95B26] hover:bg-[#e06530] text-white flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Sumar sello</span>
              </button>
            </div>
          </Card>
        </div>
      </main>

      {/* Modal: Catálogo (Título solo "Catálogo") */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-2xl rounded-2xl bg-[#141418] border border-[#282830] flex flex-col max-h-[88vh] overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#282830] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#BEC8FF]/15 text-[#BEC8FF] flex items-center justify-center shrink-0">
                  <Coffee className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-sm text-[#F4F4F0]">Catálogo</h2>
              </div>

              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 border-b border-[#282830] bg-[#0C0C0E]">
              <div className="flex items-center gap-2 bg-[#141418] border border-[#282830] rounded-xl px-3 py-2 focus-within:border-[#BEC8FF]">
                <Search className="w-4 h-4 text-[#A1A1AA] shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar producto o código..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-[#F4F4F0] placeholder-[#71717A] focus:outline-none"
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

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredCatalogProducts.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <ShoppingBag className="w-7 h-7 text-[#A1A1AA] mx-auto" />
                  <p className="text-xs font-semibold text-[#F4F4F0]">
                    No hay productos cargados en el catálogo
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredCatalogProducts.map((prod) => {
                    const selectedItem = scannedItems.find((i) => i.id === prod.id);
                    const qty = selectedItem?.quantity || 0;
                    return (
                      <div
                        key={prod.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
                          qty > 0
                            ? 'bg-[#2FB36A]/10 border-[#2FB36A]'
                            : 'bg-[#1C1C22] border-[#282830] hover:border-[#3A3A44]'
                        }`}
                      >
                        <div
                          onClick={() => addProductToSale(prod)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#F4F4F0] truncate">
                              {prod.title}
                            </p>
                            <span className="text-xs font-mono font-extrabold text-[#2FB36A]">
                              {prod.price !== undefined ? formatCurrency(prod.price) : '$0'}
                            </span>
                          </div>
                        </div>

                        {qty > 0 ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleChangeItemQty(prod.id, -1)}
                              className="w-6 h-6 rounded-lg bg-[#141418] border border-[#282830] flex items-center justify-center text-[#F4F4F0] cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-5 text-center font-mono text-xs font-bold text-[#F4F4F0]">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => addProductToSale(prod)}
                              className="w-6 h-6 rounded-lg bg-[#2FB36A] text-[#08120C] flex items-center justify-center font-bold cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addProductToSale(prod)}
                            className="px-2.5 py-1 rounded-xl bg-[#141418] hover:bg-[#BEC8FF] text-[#F4F4F0] hover:text-[#0C0C0E] border border-[#282830] text-xs font-bold transition-colors shrink-0 cursor-pointer"
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

            <div className="p-3.5 border-t border-[#282830] bg-[#1C1C22] flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold text-[#A1A1AA] block">
                  Total ({scannedItems.reduce((a, b) => a + b.quantity, 0)} ítems)
                </span>
                <span className="text-lg font-extrabold font-mono text-[#F4F4F0] tabular-nums">
                  {formatCurrency(amount)}
                </span>
              </div>

              <Button
                type="button"
                variant="ultramar"
                size="sm"
                onClick={() => setShowCatalogModal(false)}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Listo ({formatCurrency(amount)})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Elegir Perfil de Caja (Todos los roles; Cajeros sin contraseña, Encargados/Dueños con contraseña) */}
      {showCashierAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#BEC8FF]/15 text-[#BEC8FF] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-[#F4F4F0]">
                    Elegir perfil en Caja POS
                  </h2>
                  <p className="text-[11px] text-[#A1A1AA]">
                    Cajeros ingresan directo sin contraseña · Encargados y Dueños requieren clave
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
                className="p-4 rounded-xl bg-[#1C1C22] border border-[#BEC8FF]/40 space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <KeyRound className="w-4 h-4 text-[#BEC8FF] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#F4F4F0]">
                      Contraseña de {pendingElevationMember.role === 'owner' ? 'Dueño' : 'Encargado'}
                    </p>
                    <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                      Ingresá la contraseña para operar con el perfil de{' '}
                      <strong className="text-[#F4F4F0]">{pendingElevationMember.name}</strong>.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showElevationPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Contraseña..."
                    value={elevationPassword}
                    onChange={(e) => setElevationPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 rounded-xl bg-[#141418] border border-[#282830] text-xs text-[#F4F4F0] focus:outline-none focus:border-[#BEC8FF]"
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
                    Volver
                  </Button>
                  <Button
                    type="submit"
                    variant="ultramar"
                    size="sm"
                    loading={isVerifyingPassword}
                  >
                    Confirmar perfil
                  </Button>
                </div>
              </form>
            ) : (
              <>
                {selectableAccounts.length > 0 && (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    <p className="text-[11px] font-semibold text-[#A1A1AA]">
                      Perfiles disponibles (enlazados con Equipo)
                    </p>
                    {selectableAccounts.map((m) => {
                      const isCurrent =
                        activeProfile.id === m.id ||
                        activeProfile.name.toLowerCase() === m.name.toLowerCase();
                      const roleLabel =
                        m.role === 'owner'
                          ? 'Dueño'
                          : m.role === 'manager'
                          ? 'Encargado'
                          : 'Cajero';
                      const requiresPassword = m.role === 'owner' || m.role === 'manager';

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectAccount(m)}
                          className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
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
                          <span className="text-[11px] font-semibold text-[#BEC8FF]">
                            {isCurrent
                              ? 'En uso'
                              : requiresPassword
                              ? 'Con contraseña'
                              : 'Sin contraseña'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <form
                  onSubmit={handleCreateAndSwitchCashier}
                  className="pt-3 border-t border-[#282830] space-y-2"
                >
                  <label className="block text-[11px] font-semibold text-[#A1A1AA]">
                    Crear cajero rápido (sin mail ni contraseña, sincronizado con Equipo)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nombre del cajero"
                      value={newCashierName}
                      onChange={(e) => setNewCashierName(e.target.value)}
                      className="flex-1 bg-[#1C1C22] border border-[#282830] rounded-xl px-3 py-2 text-xs text-[#F4F4F0] focus:outline-none focus:border-[#BEC8FF]"
                    />
                    <Button
                      type="submit"
                      variant="ultramar"
                      size="sm"
                      loading={isCreatingCashier}
                    >
                      Crear cajero
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Pantalla "Sumar sello" desde la Caja */}
      {showStampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-[#0A0A0A] border border-[#242424] p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#242424] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#D95B26]" />
                <span className="text-sm font-bold text-[#F4F4F6]">
                  Sumar sello desde Caja
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowStampModal(false)}
                className="p-1.5 rounded-lg text-[#9E9EA8] hover:text-[#F4F4F6] cursor-pointer"
                aria-label="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ClubScannerView />
          </div>
        </div>
      )}
    </div>
  );
};
