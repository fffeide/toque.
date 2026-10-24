import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import {
  DashboardSummary,
  ClubConfig,
  ClubLocal,
  StampLogEntry,
} from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  QrCode,
  Users,
  Gift,
  Store,
  Download,
  Copy,
  Printer,
  Edit3,
  Check,
  X,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

type PeriodKey = '30d' | '3m' | '12m' | 'all';

const THEME_PRESETS = [
  { label: 'Naranja Toque', color: '#D95B26' },
  { label: 'Índigo Profundo', color: '#1e1b4b' },
  { label: 'Azul Noche', color: '#172554' },
  { label: 'Esmeralda Oscuro', color: '#064e3b' },
  { label: 'Grafito Mate', color: '#18181b' },
];

export const DashboardSummaryView: React.FC = () => {
  const { user, business } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [clubConfig, setClubConfig] = useState<ClubConfig | null>(null);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [stampLogs, setStampLogs] = useState<StampLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Modal de edición de "Tu tarjeta"
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editReward, setEditReward] = useState('');
  const [editHowToEarn, setEditHowToEarn] = useState('');
  const [editExpiration, setEditExpiration] = useState('');
  const [editColor, setEditColor] = useState('#D95B26');
  const [savingCard, setSavingCard] = useState(false);

  const isCashier = user?.role === 'cashier';

  const loadData = async (selectedPeriod: PeriodKey) => {
    try {
      setLoading(true);
      const [sum, cfg, locs, logs] = await Promise.all([
        api.getDashboardSummary(selectedPeriod),
        api.getClubConfig(),
        api.listLocals(),
        api.listStampLogs(selectedPeriod),
      ]);
      setSummary(sum);
      setClubConfig(cfg);
      setLocals(locs);
      setStampLogs(logs);

      setEditReward(
        cfg.loyaltyReward || cfg.rewardText || 'Combo Burger + Bebida sin cargo'
      );
      setEditHowToEarn(cfg.howToEarn || '1 sello por visita o compra');
      setEditExpiration(cfg.expirationPolicy || 'No vencen');
      setEditColor(cfg.cardThemeColor || cfg.brandColor || '#D95B26');
    } catch (err: any) {
      showToast(err?.message || 'No pudimos cargar el panel', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(period);
  }, [period]);

  const handleExportStampLogsCsv = async () => {
    try {
      setExportingCsv(true);
      const csv = await api.exportStampLogsCsv(period);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sellos-y-premios-${business?.id || 'la-burger'}-${period}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Archivo CSV descargado', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al exportar CSV', 'error');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleCopyPublicLink = async () => {
    const slug = business?.id || 'la-burger';
    const fullUrl = `${window.location.origin}/u/${slug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast(`Enlace copiado: ${fullUrl}`, 'success');
    } catch {
      showToast(fullUrl, 'info');
    }
  };

  const handleSaveCardSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingCard(true);
      const updated = await api.updateClubConfig({
        rewardText: editReward.trim(),
        loyaltyReward: editReward.trim(),
        howToEarn: editHowToEarn.trim(),
        expirationPolicy: editExpiration.trim(),
        brandColor: editColor,
        cardThemeColor: editColor,
      });
      setClubConfig(updated);
      setEditModalOpen(false);
      showToast('Tarjeta de sellos actualizada', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar la tarjeta', 'error');
    } finally {
      setSavingCard(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72 rounded-xl bg-[#141418]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-28 rounded-2xl bg-[#141418]" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl bg-[#141418]" />
      </div>
    );
  }

  if (isCashier) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-[#141418] border border-[#282830] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#F4F4F0]">Hola, {user?.name}</h1>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Desde Caja POS podés cobrar con teclado y emitir comprobantes digitales.
            </p>
          </div>
          <Link
            to="/panel/caja"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2FB36A] text-[#08120c] font-bold text-sm"
          >
            <QrCode className="w-4 h-4" />
            Ir a Caja POS
          </Link>
        </div>
      </div>
    );
  }

  const businessName = business?.name || 'La Burger';
  const cardBgColor = clubConfig?.cardThemeColor || clubConfig?.brandColor || '#D95B26';
  const rewardText =
    clubConfig?.loyaltyReward ||
    clubConfig?.rewardText ||
    'Combo Burger + Bebida sin cargo';
  const howToEarn = clubConfig?.howToEarn || '1 sello por visita o compra';
  const expirationPolicy = clubConfig?.expirationPolicy || 'No vencen';

  return (
    <div className="space-y-6">
      {/* Encabezado y Filtro por Período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee]">{businessName}</h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">
            Resumen en tiempo real de tu programa de sellos, locales y tarjeta pública.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            role="group"
            aria-label="Filtrar período"
            className="inline-flex rounded-xl bg-[#111113] border border-[#242426] p-1"
          >
            {(
              [
                { id: '30d', label: '30 días' },
                { id: '3m', label: '3 meses' },
                { id: '12m', label: '12 meses' },
                { id: 'all', label: 'Todo' },
              ] as Array<{ id: PeriodKey; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  period === item.id
                    ? 'bg-[#bec8ff] text-[#0c0c0c] font-bold'
                    : 'text-[#a1a1aa] hover:text-[#f1f1ee]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Link
            to="/panel/escanear"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2fb36a] hover:bg-[#269a59] text-[#08120c] font-bold text-xs transition-colors"
          >
            <QrCode className="w-4 h-4" />
            <span>Escanear</span>
          </Link>
        </div>
      </div>

      {/* 4 Indicadores Reales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#111113] border border-[#242426] p-5 space-y-2">
          <span className="text-xs font-medium text-[#a1a1aa]">Socios registrados</span>
          <p className="text-3xl font-extrabold text-[#f1f1ee]">
            {summary?.clubMembersCount ?? 0}
          </p>
          <p className="text-[11px] text-[#a1a1aa]"> Tarjetas activas en el Club</p>
        </div>

        <div className="rounded-2xl bg-[#111113] border border-[#242426] p-5 space-y-2">
          <span className="text-xs font-medium text-[#a1a1aa]">Sellos sumados</span>
          <p className="text-3xl font-extrabold text-[#bec8ff]">
            {summary?.stampsAddedCount ?? 0}
          </p>
          <p className="text-[11px] text-[#a1a1aa]">En el período seleccionado</p>
        </div>

        <div className="rounded-2xl bg-[#111113] border border-[#242426] p-5 space-y-2">
          <span className="text-xs font-medium text-[#a1a1aa]">Premios canjeados</span>
          <p className="text-3xl font-extrabold text-[#2fb36a]">
            {summary?.rewardsRedeemedCount ?? 0}
          </p>
          <p className="text-[11px] text-[#a1a1aa]">Tarjetas de 10 sellos completadas</p>
        </div>

        <div className="rounded-2xl bg-[#111113] border border-[#242426] p-5 space-y-2">
          <span className="text-xs font-medium text-[#a1a1aa]">Wallets generadas</span>
          <p className="text-3xl font-extrabold text-[#f1f1ee]">
            {summary?.walletPassesCount ?? 0}
          </p>
          <p className="text-[11px] text-[#a1a1aa]">Apple Wallet / Google Wallet</p>
        </div>
      </div>

      {/* ================================================================= */}
      {/* TARJETA 1: "SELLOS Y PREMIOS" + EXPORTAR CSV                      */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#f1f1ee]">Sellos y premios</h2>
            <p className="text-xs text-[#a1a1aa]">
              Registro en tiempo real de sellos sumados y premios entregados.
            </p>
          </div>

          <button
            type="button"
            disabled={exportingCsv}
            onClick={handleExportStampLogsCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-xs font-semibold text-[#f1f1ee] transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5 text-[#bec8ff]" />
            <span>↓ Exportar CSV</span>
          </button>
        </div>

        {stampLogs.length === 0 ? (
          <div className="rounded-2xl bg-[#18181b] border border-[#242426] p-8 text-center space-y-3">
            <p className="text-sm text-[#a1a1aa]">
              Sin sellos en este período. Los que sumes desde Escanear aparecen aquí.
            </p>
            <button
              type="button"
              onClick={() => navigate('/panel/escanear')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111113] hover:bg-[#222226] border border-[#2c2c30] text-xs font-bold text-[#f1f1ee] transition-colors cursor-pointer"
            >
              <span>Ir a Escanear</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#bec8ff]" />
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#242426] text-[#a1a1aa]">
                  <th className="py-2.5 px-3 font-medium">Fecha</th>
                  <th className="py-2.5 px-3 font-medium">Socio</th>
                  <th className="py-2.5 px-3 font-medium">Acción</th>
                  <th className="py-2.5 px-3 font-medium">Sellos</th>
                  <th className="py-2.5 px-3 font-medium">Local</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e22]">
                {stampLogs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-[#18181b]/60">
                    <td className="py-3 px-3 text-[#a1a1aa]">
                      {new Date(log.createdAt).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#f1f1ee]">
                      {log.memberName}{' '}
                      {log.memberCode && (
                        <span className="font-mono text-[11px] text-[#bec8ff] ml-1">
                          ({log.memberCode})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          log.action === 'reward_redeemed'
                            ? 'bg-[#2fb36a]/15 text-[#2fb36a]'
                            : 'bg-[#bec8ff]/15 text-[#bec8ff]'
                        }`}
                      >
                        {log.action === 'reward_redeemed' ? 'Premio canjeado' : 'Sello sumado'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#f1f1ee]">
                      {log.stampsDelta > 0 ? `+${log.stampsDelta}` : log.stampsDelta}
                    </td>
                    <td className="py-3 px-3 text-[#a1a1aa]">{log.localName || 'Casa Central'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================================================================= */}
        {/* TARJETA 2: "TUS LOCALES"                                          */}
        {/* ================================================================= */}
        <section className="lg:col-span-5 rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#f1f1ee]">Tus locales</h2>
                <p className="text-xs text-[#a1a1aa]">Puntos de atención activos y su código QR.</p>
              </div>
              <Link
                to="/panel/locales"
                className="text-xs font-semibold text-[#bec8ff] hover:underline"
              >
                Administrar →
              </Link>
            </div>

            {locals.length === 0 ? (
              <p className="text-xs text-[#a1a1aa]">
                Cuando sumes más puntos de venta vas a comparar el movimiento de cada uno.
              </p>
            ) : (
              <div className="space-y-3">
                {locals.map((loc) => (
                  <div
                    key={loc.id}
                    className="rounded-xl bg-[#18181b] border border-[#28282a] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-[#bec8ff]" />
                        <span className="text-sm font-bold text-[#f1f1ee]">{loc.name}</span>
                      </div>
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-[#111113] border border-[#2c2c30] text-[#bec8ff]">
                        {loc.code}
                      </span>
                    </div>
                    <p className="text-xs text-[#a1a1aa]">{loc.address}</p>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#242426] text-center">
                      <div>
                        <span className="block text-[10px] text-[#a1a1aa]">Visitas</span>
                        <span className="text-xs font-bold text-[#f1f1ee]">{loc.visitsCount}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#a1a1aa]">Nuevos</span>
                        <span className="text-xs font-bold text-[#f1f1ee]">
                          {loc.newMembersCount}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#a1a1aa]">Premios</span>
                        <span className="text-xs font-bold text-[#2fb36a]">
                          {loc.rewardsRedeemedCount}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11px] text-[#71717a] pt-2">
            Cuando sumes más puntos de venta vas a comparar el movimiento de cada uno.
          </p>
        </section>

        {/* ================================================================= */}
        {/* TARJETA 3: "TU TARJETA" (VISTA PREVIA 3/10 + EDITAR + IMPRIMIR)   */}
        {/* ================================================================= */}
        <section className="lg:col-span-7 rounded-2xl bg-[#111113] border border-[#242426] p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#f1f1ee]">Tu tarjeta</h2>
              <p className="text-xs text-[#a1a1aa]">
                Así ven la tarjeta de sellos tus clientes en su celular.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-xs font-bold text-[#bec8ff] transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          </div>

          {/* Vista previa en miniatura con 3 / 10 sellos */}
          <div
            style={{ backgroundColor: cardBgColor }}
            className="rounded-3xl p-5 text-white border border-white/15 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center font-bold text-sm">
                  {businessName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{businessName}</p>
                  <p className="text-[11px] text-white/75">Vista previa del cliente</p>
                </div>
              </div>
              <div className="text-right">
                <span className="block text-[9px] uppercase tracking-widest text-white/75 font-semibold">
                  SELLOS
                </span>
                <span className="text-xl font-extrabold text-white">3 / 10</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => {
                const slot = i + 1;
                const earned = slot <= 3;
                const next = slot === 4;
                const isGift = slot === 10;

                if (earned) {
                  return (
                    <div
                      key={slot}
                      className="h-9 rounded-full bg-white text-[#0A0A0A] flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  );
                }
                if (isGift) {
                  return (
                    <div
                      key={slot}
                      className="h-9 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center"
                    >
                      <Gift className="w-3.5 h-3.5" />
                    </div>
                  );
                }
                if (next) {
                  return (
                    <div
                      key={slot}
                      className="h-9 rounded-full bg-white/15 border-2 border-[#fbbf24] text-white text-xs font-bold flex items-center justify-center"
                    >
                      {slot}
                    </div>
                  );
                }
                return (
                  <div
                    key={slot}
                    className="h-9 rounded-full bg-white/10 border border-white/15 text-white/50 text-xs flex items-center justify-center"
                  >
                    {slot}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs text-white/90">
              <span>Faltan 7 sellos</span>
              <span className="truncate max-w-[200px]">🎁 {rewardText}</span>
            </div>
          </div>

          {/* Lista de configuración actual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#18181b] border border-[#242426]">
              <span className="block text-[10px] uppercase text-[#a1a1aa]">Premio (10 sellos)</span>
              <span className="font-semibold text-[#f1f1ee] block mt-0.5 truncate" title={rewardText}>
                {rewardText}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#18181b] border border-[#242426]">
              <span className="block text-[10px] uppercase text-[#a1a1aa]">Cómo se suma</span>
              <span className="font-semibold text-[#f1f1ee] block mt-0.5 truncate">
                {howToEarn}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#18181b] border border-[#242426]">
              <span className="block text-[10px] uppercase text-[#a1a1aa]">Vencimiento</span>
              <span className="font-semibold text-[#f1f1ee] block mt-0.5 truncate">
                {expirationPolicy}
              </span>
            </div>
          </div>

          {/* Botones de acción: Imprimir cartel + Copiar link + Abrir vista pública */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Link
              to="/panel/locales"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-xs font-bold text-[#f1f1ee] transition-colors"
            >
              <Printer className="w-4 h-4 text-[#bec8ff]" />
              <span>Imprimir cartel</span>
            </Link>

            <button
              type="button"
              onClick={handleCopyPublicLink}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-xs font-bold text-[#f1f1ee] transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4 text-[#2fb36a]" />
              <span>Copiar link</span>
            </button>

            <Link
              to={`/u/${business?.id || 'la-burger'}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#bec8ff]/15 hover:bg-[#bec8ff]/25 text-xs font-bold text-[#bec8ff] transition-colors ml-auto"
            >
              <span>Ver página pública</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      </div>

      {/* Modal para Editar "Tu tarjeta" */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-[#111113] border border-[#28282c] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#f1f1ee]">Editar tarjeta de sellos</h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCardSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#f1f1ee] mb-1">
                  Premio al completar los 10 sellos
                </label>
                <input
                  type="text"
                  required
                  value={editReward}
                  onChange={(e) => setEditReward(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#2c2c30] text-sm text-[#f1f1ee]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#f1f1ee] mb-1">
                  Cómo se suma
                </label>
                <input
                  type="text"
                  required
                  value={editHowToEarn}
                  onChange={(e) => setEditHowToEarn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#2c2c30] text-sm text-[#f1f1ee]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#f1f1ee] mb-1">
                  Política de vencimiento
                </label>
                <input
                  type="text"
                  required
                  value={editExpiration}
                  onChange={(e) => setEditExpiration(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#2c2c30] text-sm text-[#f1f1ee]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#f1f1ee] mb-1.5">
                  Color de la tarjeta
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() => setEditColor(preset.color)}
                      style={{ backgroundColor: preset.color }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold text-white border cursor-pointer ${
                        editColor.toLowerCase() === preset.color.toLowerCase()
                          ? 'border-white ring-2 ring-[#bec8ff]'
                          : 'border-white/20'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242426]">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#18181b] text-xs font-semibold text-[#a1a1aa] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCard}
                  className="px-5 py-2 rounded-xl bg-[#2fb36a] text-[#08120c] text-xs font-bold cursor-pointer"
                >
                  {savingCard ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
