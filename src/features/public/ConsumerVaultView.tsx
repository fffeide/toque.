import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  Receipt as ReceiptIcon,
  Search,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  TrendingUp,
  Gift,
  Plus,
  Flame,
  Edit3,
  Check,
  X,
  RefreshCw,
  Award,
  Sun,
  Moon,
} from 'lucide-react';
import {
  loadConsumerVault,
  updateReceiptAmount,
  addManualConsumerReceipt,
  computeConsumerKPIs,
  computeSmartTips,
  saveConsumerRegistration,
  overwriteVaultFromRecovery,
  ConsumerVaultState,
} from '../../lib/consumerStorage';
import { api } from '../../api';
import { useTheme } from '../../lib/themeContext';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { useToast } from '../../components/ui/Toast';

export const ConsumerVaultView: React.FC = () => {
  const { success, error: toastError } = useToast();
  const { isDark, toggleTheme } = useTheme();
  const [vault, setVault] = useState<ConsumerVaultState>(() => loadConsumerVault());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Editor de monto en ticket existente
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [editAmountVal, setEditAmountVal] = useState('');
  const [editDiscountVal, setEditDiscountVal] = useState('');
  const [editNoteVal, setEditNoteVal] = useState('');

  // Modal de cargar nuevo comprobante manual
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMerchant, setNewMerchant] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDiscount, setNewDiscount] = useState('');
  const [newCategory, setNewCategory] = useState('Gastronomía');
  const [newNote, setNewNote] = useState('');

  // Modal de vincular o recuperar cuenta
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncMode, setSyncMode] = useState<'register' | 'recover'>('register');
  const [regName, setRegName] = useState(vault.user?.displayName || '');
  const [regContact, setRegContact] = useState(vault.user?.emailOrPhone || '');
  const [regAgeGroup, setRegAgeGroup] = useState<'teen' | 'adult' | 'all'>(
    vault.user?.ageGroup || 'all'
  );
  const [consentSaveReceipts, setConsentSaveReceipts] = useState(true);
  const [consentMarketingNetwork, setConsentMarketingNetwork] = useState(true);
  const [recoverInput, setRecoverInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setVault(loadConsumerVault());
  }, []);

  const kpis = useMemo(() => computeConsumerKPIs(vault), [vault]);
  const smartTips = useMemo(() => computeSmartTips(vault), [vault]);

  const filteredReceipts = useMemo(() => {
    return vault.receipts.filter((r) => {
      const matchesCat = categoryFilter === 'all' || r.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesCat;
      return (
        matchesCat &&
        (r.merchantName.toLowerCase().includes(q) ||
          r.receiptNote.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q))
      );
    });
  }, [vault.receipts, searchQuery, categoryFilter]);

  const handleStartEditReceipt = (
    id: string,
    amountArs: number,
    discountSavedArs: number,
    note: string
  ) => {
    setEditingReceiptId(id);
    setEditAmountVal(amountArs > 0 ? String(amountArs) : '');
    setEditDiscountVal(discountSavedArs > 0 ? String(discountSavedArs) : '');
    setEditNoteVal(note || '');
  };

  const handleSaveReceiptEdit = async (id: string) => {
    const amount = Number(editAmountVal) || 0;
    const discount = Number(editDiscountVal) || 0;
    const nextState = updateReceiptAmount(id, amount, discount, editNoteVal);
    setVault({ ...nextState });
    setEditingReceiptId(null);
    success('Comprobante actualizado', 'Se actualizaron tus gastos y ahorros del mes.');

    if (nextState.user?.emailOrPhone && nextState.user) {
      api
        .syncConsumerVault({
          user: nextState.user,
          receipts: nextState.receipts,
        })
        .catch(() => {});
    }
  };

  const handleAddManualReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMerchant.trim()) {
      toastError('Ingresá el nombre del local');
      return;
    }
    const amount = Number(newAmount) || 0;
    const discount = Number(newDiscount) || 0;
    const nextState = addManualConsumerReceipt({
      merchantName: newMerchant.trim(),
      amountArs: amount,
      discountSavedArs: discount,
      category: newCategory,
      receiptNote: newNote.trim() || 'Comprobante guardado en Toquecitos',
    });
    setVault({ ...nextState });
    setNewMerchant('');
    setNewAmount('');
    setNewDiscount('');
    setNewNote('');
    setShowAddModal(false);
    success('Comprobante guardado', 'Se sumó un nuevo toque a tu cuenta.');

    if (nextState.user?.emailOrPhone && nextState.user) {
      api
        .syncConsumerVault({
          user: nextState.user,
          receipts: nextState.receipts,
        })
        .catch(() => {});
    }
  };

  const handleSyncAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regContact.trim()) {
      toastError('Completá tu nombre y tu WhatsApp o Email');
      return;
    }

    setIsSyncing(true);
    try {
      const updatedLocal = saveConsumerRegistration({
        displayName: regName.trim(),
        emailOrPhone: regContact.trim(),
        ageGroup: regAgeGroup,
        consentSaveReceipts,
        consentMarketingNetwork,
      });

      if (updatedLocal.user) {
        await api.syncConsumerVault({
          user: updatedLocal.user,
          receipts: updatedLocal.receipts,
        });
      }

      setVault({ ...loadConsumerVault() });
      setShowSyncModal(false);
      success(
        '¡Cuenta guardada en Toquecitos!',
        'Tus sellos y comprobantes quedaron protegidos para usarlos desde cualquier celular.'
      );
    } catch (err) {
      toastError(
        'Error al vincular cuenta',
        err instanceof Error ? err.message : 'Intentá nuevamente.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRecoverAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverInput.trim()) {
      toastError('Ingresá el WhatsApp o Email con el que te registraste');
      return;
    }

    setIsSyncing(true);
    try {
      const res = await api.recoverConsumerVault(recoverInput.trim());
      if (!res.found || !res.user) {
        toastError(
          'No encontramos esa cuenta',
          'Verificá el WhatsApp o correo electrónico ingresado.'
        );
        return;
      }

      const nextState = overwriteVaultFromRecovery(res.user, res.receipts || []);
      setVault({ ...nextState });
      setShowSyncModal(false);
      success(
        '¡Cuenta recuperada!',
        `Hola ${res.user.displayName}, restauramos tus comprobantes y toquecitos.`
      );
    } catch {
      toastError('No pudimos recuperar la cuenta en este momento');
    } finally {
      setIsSyncing(false);
    }
  };

  const stampsList = Object.entries(vault.stampsByMerchant);

  return (
    <div className="theme-panel min-h-screen bg-[#000000] text-[#f1f1ee] pb-16 selection:bg-[#bec8ff] selection:text-[#0c0c0c]">
      {/* TOP BAR */}
      <header className="sticky top-0 z-30 bg-[#0c0c0c] border-b border-[#242426] px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/hub/CAJA01"
            className="w-9 h-9 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#bec8ff] flex items-center justify-center text-[#f1f1ee] transition-colors"
            title="Volver al Hub"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#bec8ff] text-[#0c0c0c] font-bold text-sm flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm sm:text-base tracking-tight text-[#f1f1ee] block leading-none">
                toquecitos™
              </span>
              <span className="text-[11px] text-[#a1a1aa]">
                Mis sellos, visitas y comprobantes
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="w-9 h-9 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#bec8ff] text-[#f1f1ee] flex items-center justify-center transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-[#bec8ff]" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setSyncMode(vault.user?.emailOrPhone ? 'recover' : 'register');
              setShowSyncModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#bec8ff] text-xs font-semibold text-[#f1f1ee] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {vault.user?.emailOrPhone ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2fb36a]" />
                <span className="hidden sm:inline">{vault.user.displayName}</span>
                <span className="sm:hidden">Mi Cuenta</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#bec8ff]" />
                <span>Guardar mi cuenta</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* BANNER DE VINCULACIÓN EN 1 TOQUE (SI AÚN NO SE REGISTRÓ) */}
        {!vault.user?.emailOrPhone && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#111113] border border-[#bec8ff]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#bec8ff]">
                <Sparkles className="w-4 h-4" />
                <span>No pierdas tus toquecitos ni tus sellos</span>
              </div>
              <p className="text-xs sm:text-sm text-[#f1f1ee] leading-relaxed">
                Registrate en 1 toque con tu WhatsApp o correo para conservar tus comprobantes,
                puntos y beneficios aunque cambies de teléfono.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSyncMode('register');
                  setShowSyncModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#bec8ff] hover:bg-[#d6daf6] text-[#0c0c0c] font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                Registrarme en 1 toque
              </button>
              <button
                type="button"
                onClick={() => {
                  setSyncMode('recover');
                  setShowSyncModal(true);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] hover:border-[#bec8ff] text-[#f1f1ee] font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                Recuperar cuenta
              </button>
            </div>
          </div>
        )}

        {/* 1. KPIS DEL COMPRADOR */}
        <section aria-label="Indicadores de tus consumos">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg sm:text-xl font-bold text-[#f1f1ee] tracking-tight">
              Resumen de mis Toquecitos
            </h1>
            <div className="flex items-center gap-1.5 bg-[#111113] border border-[#242426] rounded-xl p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setRegAgeGroup('teen')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  regAgeGroup === 'teen'
                    ? 'bg-[#bec8ff] text-[#0c0c0c]'
                    : 'text-[#a1a1aa] hover:text-[#f1f1ee]'
                }`}
              >
                Joven (13+)
              </button>
              <button
                type="button"
                onClick={() => setRegAgeGroup('adult')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  regAgeGroup === 'adult'
                    ? 'bg-[#bec8ff] text-[#0c0c0c]'
                    : 'text-[#a1a1aa] hover:text-[#f1f1ee]'
                }`}
              >
                Adulto
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-1.5">
              <span className="text-xs text-[#a1a1aa] font-medium block">
                Gastado este mes ($)
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#f1f1ee] tabular-nums">
                {formatCurrency(kpis.spentThisMonthArs)}
              </div>
              <span className="text-[11px] text-[#a1a1aa] block">
                En tus tickets cargados
              </span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-1.5">
              <span className="text-xs text-[#a1a1aa] font-medium block">
                Ahorrado con Toque ($)
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#2fb36a] tabular-nums">
                {formatCurrency(kpis.savedWithToqueArs)}
              </div>
              <span className="text-[11px] text-[#2fb36a] block">
                Beneficios Red Toque
              </span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-1.5">
              <span className="text-xs text-[#a1a1aa] font-medium block">
                Toques / Visitas realizadas
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#bec8ff] tabular-nums">
                {kpis.totalVisitsCount}
              </div>
              <span className="text-[11px] text-[#a1a1aa] block">
                {kpis.weeklyVisitsCount} toques esta semana
              </span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-1.5">
              <span className="text-xs text-[#a1a1aa] font-medium block">
                Premios por destrabar
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#f1f1ee] tabular-nums">
                {kpis.rewardsToUnlockCount}
              </div>
              <span className="text-[11px] text-[#bec8ff] block font-medium">
                Activos en tus tarjetas
              </span>
            </div>
          </div>
        </section>

        {/* 2. DESAFÍOS DE TOQUES Y TIPS INTELIGENTES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Desafío Semanal */}
          <div className="lg:col-span-7 p-5 rounded-2xl bg-[#111113] border border-[#242426] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#bec8ff]">
                  <Flame className="w-4 h-4" />
                  Desafío de Toquecitos Semanal
                </span>
                <span className="text-xs font-mono font-bold text-[#f1f1ee] bg-[#18181b] border border-[#28282a] px-2.5 py-1 rounded-lg">
                  {kpis.weeklyChallengeProgress} / {kpis.weeklyChallengeTarget} toques
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-[#f1f1ee]">
                Hacé 3 toques esta semana en locales adheridos y destrabá un beneficio sorpresa
              </h2>
              <p className="text-xs text-[#a1a1aa]">
                Cada vez que apoyás tu celular en el cartel de un comercio Toque o guardás tu
                comprobante, sumás avance automáticamente.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-full h-3 rounded-full bg-[#18181b] border border-[#28282a] overflow-hidden">
                <div
                  className="h-full bg-[#2fb36a] transition-all duration-300"
                  style={{ width: `${kpis.weeklyChallengePercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a1a1aa]">
                  {kpis.weeklyChallengeProgress >= kpis.weeklyChallengeTarget
                    ? '¡Meta semanal alcanzada! Tu beneficio sorpresa está listo.'
                    : `Te falta(n) ${
                        kpis.weeklyChallengeTarget - kpis.weeklyChallengeProgress
                      } toque(s) para destrabar el premio.`}
                </span>
                <span className="font-mono font-bold text-[#2fb36a]">
                  {kpis.weeklyChallengePercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Tips Inteligentes */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2fb36a]">
              <TrendingUp className="w-4 h-4" />
              <span>Tips Inteligentes de Ahorro</span>
            </div>
            <div className="space-y-2.5">
              {smartTips.map((tip) => (
                <div
                  key={tip.id}
                  className="p-3 rounded-xl bg-[#18181b] border border-[#28282a] text-xs text-[#f1f1ee] leading-relaxed flex items-start gap-2.5"
                >
                  <Gift className="w-4 h-4 text-[#bec8ff] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[#f1f1ee] block">{tip.title}</span>
                    <span className="text-[#a1a1aa]">{tip.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TARJETAS DE SELLOS ACTIVAS EN LOCALES VISITADOS */}
        {stampsList.length > 0 && (
          <section className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#bec8ff]" />
                <h2 className="text-sm sm:text-base font-bold text-[#f1f1ee]">
                  Mis Tarjetas de Sellos en Locales ({stampsList.length})
                </h2>
              </div>
              <span className="text-xs text-[#a1a1aa]">Actualizado en cada visita</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stampsList.map(([tenantId, info]) => {
                const targetCount = info.target || info.targetStamps || 5;
                const pct = Math.min(100, Math.round((info.stamps / targetCount) * 100));
                return (
                  <div
                    key={tenantId}
                    className="p-3.5 rounded-xl bg-[#18181b] border border-[#28282a] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-[#f1f1ee]">
                        {info.merchantName}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#bec8ff]">
                        {info.stamps} / {targetCount} sellos
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#111113] border border-[#242426] overflow-hidden">
                      <div className="h-full bg-[#bec8ff]" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-[#a1a1aa]">
                      Premio: <strong className="text-[#f1f1ee]">{info.rewardLabel || info.rewardText}</strong>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. MIS COMPROBANTES Y GARANTÍAS */}
        <section className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#f1f1ee] flex items-center gap-2">
                <ReceiptIcon className="w-4 h-4 text-[#2fb36a]" />
                <span>Mis Comprobantes y Garantías ({vault.receipts.length})</span>
              </h2>
              <p className="text-xs text-[#a1a1aa]">
                Buscá tus visitas guardadas y anotá el monto pagado para llevar control de tus gastos.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#bec8ff] hover:bg-[#d6daf6] text-[#0c0c0c] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Cargar comprobante</span>
            </button>
          </div>

          {/* Buscador y filtro por rubro */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por comercio, nota o producto..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#18181b] border border-[#28282a] focus:border-[#bec8ff] focus:outline-none text-xs text-[#f1f1ee] placeholder-[#a1a1aa]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'Gastronomía', 'Indumentaria', 'Tecnología', 'Otros'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                    categoryFilter === cat
                      ? 'bg-[#bec8ff] border-[#bec8ff] text-[#0c0c0c]'
                      : 'bg-[#18181b] border-[#28282a] text-[#a1a1aa] hover:text-[#f1f1ee]'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Comprobantes */}
          {filteredReceipts.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#18181b] border border-[#28282a] text-center space-y-2">
              <p className="text-sm font-semibold text-[#f1f1ee]">
                Todavía no hay comprobantes para esta búsqueda
              </p>
              <p className="text-xs text-[#a1a1aa]">
                Escaneá cualquier cartel Toque en mostrador o cargá un ticket manualmente.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredReceipts.map((r) => {
                const isEditing = editingReceiptId === r.id;
                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl bg-[#18181b] border border-[#28282a] hover:border-[#bec8ff]/50 transition-colors space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#f1f1ee]">
                            {r.merchantName}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#111113] border border-[#242426] text-[#a1a1aa]">
                            {r.category}
                          </span>
                          {r.cartelCode && (
                            <Link
                              to={`/hub/${r.cartelCode}`}
                              className="text-[10px] font-mono text-[#bec8ff] hover:underline"
                            >
                              Ver local ({r.cartelCode})
                            </Link>
                          )}
                        </div>
                        <p className="text-xs text-[#a1a1aa]">{r.receiptNote}</p>
                        <span className="text-[11px] font-mono text-[#a1a1aa] block">
                          {formatDate(r.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <div className="text-base font-bold font-mono text-[#f1f1ee] tabular-nums">
                            {r.amountArs > 0 ? formatCurrency(r.amountArs) : '$0 (Cargar monto)'}
                          </div>
                          {r.discountSavedArs > 0 && (
                            <span className="text-[11px] font-mono text-[#2fb36a] block">
                              Ahorro: {formatCurrency(r.discountSavedArs)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleStartEditReceipt(
                              r.id,
                              r.amountArs,
                              r.discountSavedArs,
                              r.receiptNote
                            )
                          }
                          className="p-2 rounded-lg bg-[#111113] border border-[#242426] hover:border-[#bec8ff] text-[#a1a1aa] hover:text-[#f1f1ee] transition-colors cursor-pointer"
                          title="Cargar o editar monto pagado"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="pt-3 border-t border-[#242426] grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                        <div>
                          <label className="block text-[10px] uppercase text-[#a1a1aa] mb-1">
                            Monto pagado ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={editAmountVal}
                            onChange={(e) => setEditAmountVal(e.target.value)}
                            placeholder="Ej: 4500"
                            className="w-full px-3 py-1.5 rounded-lg bg-[#111113] border border-[#242426] text-xs font-mono text-[#f1f1ee]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[#a1a1aa] mb-1">
                            Descuento ahorrado ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={editDiscountVal}
                            onChange={(e) => setEditDiscountVal(e.target.value)}
                            placeholder="Ej: 600"
                            className="w-full px-3 py-1.5 rounded-lg bg-[#111113] border border-[#242426] text-xs font-mono text-[#f1f1ee]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[#a1a1aa] mb-1">
                            Nota / Garantía
                          </label>
                          <input
                            type="text"
                            value={editNoteVal}
                            onChange={(e) => setEditNoteVal(e.target.value)}
                            placeholder="Detalle o garantía"
                            className="w-full px-3 py-1.5 rounded-lg bg-[#111113] border border-[#242426] text-xs text-[#f1f1ee]"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveReceiptEdit(r.id)}
                            className="flex-1 py-1.5 px-3 rounded-lg bg-[#bec8ff] text-[#0c0c0c] font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Guardar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingReceiptId(null)}
                            className="p-1.5 rounded-lg bg-[#111113] border border-[#242426] text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* MODAL: CARGAR COMPROBANTE MANUAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#111113] border border-[#242426] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#242426] pb-3">
              <h3 className="text-base font-bold text-[#f1f1ee]">
                Cargar Comprobante o Garantía
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualReceipt} className="space-y-3">
              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">Comercio / Local</label>
                <input
                  type="text"
                  required
                  value={newMerchant}
                  onChange={(e) => setNewMerchant(e.target.value)}
                  placeholder="Ej: Café La Esquina"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-xs text-[#f1f1ee]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#a1a1aa] mb-1">Monto pagado ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="4500"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-xs font-mono text-[#f1f1ee]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#a1a1aa] mb-1">Ahorro con Toque ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={newDiscount}
                    onChange={(e) => setNewDiscount(e.target.value)}
                    placeholder="500"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-xs font-mono text-[#f1f1ee]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">Categoría</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-xs text-[#f1f1ee]"
                >
                  <option value="Gastronomía">Gastronomía</option>
                  <option value="Indumentaria">Indumentaria</option>
                  <option value="Tecnología">Tecnología</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">
                  Detalle o nota de garantía
                </label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Ej: Cambio válido por 30 días"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-xs text-[#f1f1ee]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-xs font-semibold text-[#a1a1aa] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#bec8ff] hover:bg-[#d6daf6] text-[#0c0c0c] text-xs font-bold cursor-pointer"
                >
                  Guardar comprobante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GUARDAR / RECUPERAR CUENTA */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#111113] border border-[#242426] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#242426] pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSyncMode('register')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    syncMode === 'register'
                      ? 'bg-[#bec8ff] text-[#0c0c0c]'
                      : 'text-[#a1a1aa] hover:text-[#f1f1ee]'
                  }`}
                >
                  Guardar Cuenta
                </button>
                <button
                  type="button"
                  onClick={() => setSyncMode('recover')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    syncMode === 'recover'
                      ? 'bg-[#bec8ff] text-[#0c0c0c]'
                      : 'text-[#a1a1aa] hover:text-[#f1f1ee]'
                  }`}
                >
                  Recuperar Historial
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="w-8 h-8 rounded-lg bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {syncMode === 'register' ? (
              <form onSubmit={handleSyncAccount} className="space-y-3.5">
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Vinculá tus comprobantes, sellos y estadísticas a tu número de WhatsApp o correo
                  electrónico para acceder desde cualquier dispositivo.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-[#f1f1ee] mb-1">
                    Tu Nombre
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ej: Valentina"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] focus:border-[#bec8ff] focus:outline-none text-xs text-[#f1f1ee]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#f1f1ee] mb-1">
                    WhatsApp o Email
                  </label>
                  <input
                    type="text"
                    required
                    value={regContact}
                    onChange={(e) => setRegContact(e.target.value)}
                    placeholder="Ej: +54 9 11 5555-4444 o correo@ejemplo.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] focus:border-[#bec8ff] focus:outline-none text-xs text-[#f1f1ee]"
                  />
                </div>

                <div className="space-y-2.5 pt-1">
                  <label className="flex items-start gap-2.5 text-xs text-[#f1f1ee] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentSaveReceipts}
                      onChange={(e) => setConsentSaveReceipts(e.target.checked)}
                      className="mt-0.5 rounded border-[#28282a] bg-[#18181b] accent-[#bec8ff]"
                    />
                    <span className="leading-snug">
                      Guardar mis comprobantes, puntos y estadísticas de gastos en mi cuenta para no perderlos.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-[#f1f1ee] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentMarketingNetwork}
                      onChange={(e) => setConsentMarketingNetwork(e.target.checked)}
                      className="mt-0.5 rounded border-[#28282a] bg-[#18181b] accent-[#bec8ff]"
                    />
                    <span className="leading-snug">
                      Recibir beneficios exclusivos de los locales que visito y descuentos de la Red Toque.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSyncing}
                  className="w-full py-3 rounded-xl bg-[#bec8ff] hover:bg-[#d6daf6] text-[#0c0c0c] font-bold text-xs transition-colors cursor-pointer"
                >
                  {isSyncing ? 'Guardando cuenta…' : 'Guardar en Toquecitos'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRecoverAccount} className="space-y-3.5">
                <p className="text-xs text-[#a1a1aa] leading-relaxed">
                  Si cambiaste de teléfono, ingresá tu WhatsApp o Email registrado para recuperar
                  todos tus sellos y comprobantes.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-[#f1f1ee] mb-1">
                    WhatsApp o Email registrado
                  </label>
                  <input
                    type="text"
                    required
                    value={recoverInput}
                    onChange={(e) => setRecoverInput(e.target.value)}
                    placeholder="Ej: +5491155554444 o correo@ejemplo.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] focus:border-[#bec8ff] focus:outline-none text-xs text-[#f1f1ee]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSyncing}
                  className="w-full py-3 rounded-xl bg-[#bec8ff] hover:bg-[#d6daf6] text-[#0c0c0c] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Buscando cuenta…' : 'Recuperar mi cuenta'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
