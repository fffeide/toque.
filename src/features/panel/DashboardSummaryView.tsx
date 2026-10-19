import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, DashboardSummary } from '../../api';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../../lib/formatters';
import {
  TrendingUp,
  Receipt,
  Award,
  QrCode,
  CreditCard,
  Users,
  Star,
  RefreshCw,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

const DAY_FILTER_OPTIONS = [
  { label: 'Hoy (1 día)', value: 1 },
  { label: '3 días', value: 3 },
  { label: '7 días', value: 7 },
  { label: '15 días', value: 15 },
  { label: '30 días', value: 30 },
];

export const DashboardSummaryView: React.FC = () => {
  const { user } = useAuth();
  const isCashier = user?.role === 'cashier';
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Por defecto se muestran solo los cobros del día (1 día). El dueño puede elegir la cantidad de días.
  const [selectedDays, setSelectedDays] = useState<number>(1);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDashboardSummary();
      setSummary(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    const unsub = api.subscribeToBusinessSales(() => {
      api
        .getDashboardSummary()
        .then(setSummary)
        .catch(() => {});
    });
    return () => unsub();
  }, [user?.email, user?.role]);

  const recentSales = summary?.recentSales ?? [];

  const filteredSales = useMemo(() => {
    const todayStr = new Date().toDateString();
    const effectiveDays = isCashier ? 1 : Math.max(1, selectedDays);

    if (effectiveDays === 1) {
      return recentSales.filter(
        (s) => new Date(s.createdAt).toDateString() === todayStr
      );
    }

    const cutoffMs = Date.now() - effectiveDays * 86400000;
    return recentSales.filter(
      (s) => new Date(s.createdAt).getTime() >= cutoffMs
    );
  }, [recentSales, isCashier, selectedDays]);

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const todaySalesCount = summary.todaySalesCount ?? 0;
  const weeklySalesCount = summary.weeklySalesCount ?? 0;
  const myTodaySalesCount = summary.myTodaySalesCount ?? 0;
  const myWeeklySalesCount = summary.myWeeklySalesCount ?? 0;
  const todayClaimedReceiptsCount = summary.todayClaimedReceiptsCount ?? 0;
  const myClaimedReceiptsCount = summary.myClaimedReceiptsCount ?? 0;
  const totalReceiptsCount = summary.totalReceiptsCount ?? 0;
  const claimedReceiptsCount = summary.claimedReceiptsCount ?? 0;
  const scansCount = summary.scansCount ?? 0;
  const activeCartelesCount = summary.activeCartelesCount ?? 0;
  const totalCartelesCount = summary.totalCartelesCount ?? 0;
  const clubMembersCount = summary.clubMembersCount ?? summary.newClubMembersCount ?? 0;
  const walletPassesCount = summary.walletPassesCount ?? 0;

  const kpis = isCashier
    ? [
        {
          label: 'Operaciones de hoy (general)',
          value: todaySalesCount.toString(),
          sub: 'Cobros totales de hoy en el local',
          icon: TrendingUp,
          accent: 'text-[#34d399] bg-[#2fb36a]/15 border border-[#2fb36a]/30 stat-badge',
        },
        {
          label: 'Mis operaciones de hoy',
          value: myTodaySalesCount.toString(),
          sub: `Hechas hoy por ${user?.name || 'tu cuenta'}`,
          icon: CreditCard,
          accent: 'text-[#bec8ff] bg-[#bec8ff]/15 border border-[#bec8ff]/30 stat-badge',
        },
        {
          label: 'Operaciones propias (7 días)',
          value: myWeeklySalesCount.toString(),
          sub: 'Tus cobros en los últimos 7 días',
          icon: Receipt,
          accent: 'text-[#bec8ff] bg-[#bec8ff]/15 border border-[#bec8ff]/30 stat-badge',
        },
        {
          label: 'Mis tickets abiertos',
          value: myClaimedReceiptsCount.toString(),
          sub: `${todayClaimedReceiptsCount} comprobantes abiertos hoy en local`,
          icon: CheckCircle2,
          accent: 'text-[#34d399] bg-[#2fb36a]/15 border border-[#2fb36a]/30 stat-badge',
        },
      ]
    : [
        {
          label: 'Ventas de hoy',
          value: formatCurrency(summary.todaySalesAmount ?? 0),
          sub: `${todaySalesCount} cobro(s) registrado(s) hoy`,
          icon: TrendingUp,
          accent: 'text-[#34d399] bg-[#2fb36a]/15 border border-[#2fb36a]/30 stat-badge',
        },
        {
          label: 'Últimos 7 días',
          value: formatCurrency(summary.weeklySalesAmount ?? 0),
          sub: `${weeklySalesCount} operación(es) en la semana`,
          icon: CreditCard,
          accent: 'text-[#bec8ff] bg-[#bec8ff]/15 border border-[#bec8ff]/30 stat-badge',
        },
        {
          label: 'Comprobantes emitidos',
          value: totalReceiptsCount.toString(),
          sub: `${claimedReceiptsCount} abiertos por clientes`,
          icon: Receipt,
          accent: 'text-[#bec8ff] bg-[#bec8ff]/15 border border-[#bec8ff]/30 stat-badge',
        },
        {
          label: 'Socios en el Club',
          value: clubMembersCount.toString(),
          sub: `${walletPassesCount} pases Wallet emitidos`,
          icon: Award,
          accent: 'text-[#34d399] bg-[#2fb36a]/15 border border-[#2fb36a]/30 stat-badge',
        },
      ];

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">Resumen</h1>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {isCashier
              ? 'Operaciones de hoy en general y tus estadísticas operativas en mostrador.'
              : 'Métricas reales en tiempo real de tus cajas, carteles y club de fidelidad.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secundario"
            size="sm"
            onClick={loadSummary}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Actualizar
          </Button>
          <Link to="/caja">
            <Button variant="ultramar" size="sm" icon={<CreditCard className="w-4 h-4" />}>
              Abrir Caja
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="stat-card p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#a1a1aa] stat-detail">{kpi.label}</span>
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.accent}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-[#f1f1ee] tabular-nums tracking-tight">
                  {kpi.value}
                </p>
                <p className="text-[11px] text-[#a1a1aa] mt-1 stat-detail">{kpi.sub}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Segunda fila de métricas operativas (Solo para Dueño y Encargado) */}
      {!isCashier && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="stat-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#bec8ff] stat-badge">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa] stat-detail">Escaneos QR / NFC</p>
                <p className="text-lg font-bold text-[#f1f1ee] tabular-nums">
                  {scansCount}
                </p>
              </div>
            </div>
            <span className="text-[11px] text-[#a1a1aa] stat-detail">
              {activeCartelesCount} de {totalCartelesCount} carteles activos
            </span>
          </Card>

          <Card className="stat-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#34d399] stat-badge">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa] stat-detail">Clics a Google Maps</p>
                <p className="text-lg font-bold text-[#f1f1ee] tabular-nums">
                  {summary.reviewButtonClicks ?? 0}
                </p>
              </div>
            </div>
            <span className="text-[11px] text-[#34d399] font-medium stat-detail">Directo desde Hub</span>
          </Card>

          <Card className="stat-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#f1f1ee] stat-badge">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa] stat-detail">Equipo activo</p>
                <p className="text-lg font-bold text-[#f1f1ee] tabular-nums">
                  {summary.teamMembersCount ?? 1}
                </p>
              </div>
            </div>
            <Link
              to="/panel/equipo"
              className="text-xs font-semibold text-[#bec8ff] hover:underline stat-detail"
            >
              Gestionar →
            </Link>
          </Card>
        </div>
      )}

      {/* Tabla de Cobros en Caja (Por defecto: solo del día; el dueño puede elegir cantidad de días) */}
      <Card padding="none" className="stat-card overflow-hidden">
        <div className="p-5 border-b border-[#242426] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-base text-[#f1f1ee]">
              {isCashier
                ? 'Cobros de hoy en caja'
                : selectedDays === 1
                ? 'Cobros del día en caja'
                : `Cobros en caja (últimos ${selectedDays} días)`}
            </h2>
            <p className="text-xs text-[#a1a1aa] stat-detail">
              {isCashier
                ? 'Solo se muestran las operaciones realizadas hoy.'
                : 'Por defecto se muestran solo los cobros de hoy. Elegí la cantidad de días para ver el historial.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isCashier && (
              <div className="flex items-center gap-1.5 bg-[#18181b] border border-[#28282a] rounded-xl px-2.5 py-1.5 stat-badge">
                <Calendar className="w-3.5 h-3.5 text-[#bec8ff] shrink-0" />
                <span className="text-[11px] font-semibold text-[#a1a1aa] stat-detail">Ver:</span>
                <select
                  value={selectedDays}
                  onChange={(e) => setSelectedDays(Number(e.target.value) || 1)}
                  aria-label="Seleccionar cantidad de días"
                  className="bg-transparent text-xs font-bold text-[#f1f1ee] focus:outline-none cursor-pointer"
                >
                  {DAY_FILTER_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      className="bg-[#111113] text-[#f1f1ee]"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={selectedDays}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!Number.isNaN(val) && val >= 1) {
                      setSelectedDays(Math.min(365, val));
                    }
                  }}
                  title="Cantidad personalizada de días"
                  className="w-12 text-center bg-[#111113] border border-[#28282a] rounded-lg py-0.5 text-xs font-mono font-bold text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
                <span className="text-[10px] text-[#a1a1aa] stat-detail">días</span>
              </div>
            )}

            <Link
              to="/caja"
              className="text-xs font-semibold text-[#bec8ff] hover:underline flex items-center gap-1 stat-detail"
            >
              Ir a Caja →
            </Link>
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-[#242426] flex items-center justify-center mx-auto text-[#a1a1aa] stat-badge">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <p className="text-sm font-semibold text-[#f1f1ee]">
                {selectedDays === 1 || isCashier
                  ? 'Todavía no hay cobros registrados hoy'
                  : `No hay cobros en los últimos ${selectedDays} días`}
              </p>
              <p className="text-xs text-[#a1a1aa] stat-detail">
                Abrí la pantalla de Caja y cobrá una venta para ver los comprobantes en tiempo real.
              </p>
            </div>
            <div className="pt-2">
              <Link to="/caja">
                <Button variant="ultramar" size="sm">
                  Ir a Caja
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#242426] text-[11px] uppercase tracking-wider text-[#a1a1aa] bg-[#161619]">
                  <th className="py-3 px-5">Fecha y Hora</th>
                  <th className="py-3 px-5">Cartel / Caja</th>
                  <th className="py-3 px-5">Cajero</th>
                  <th className="py-3 px-5">Medio</th>
                  <th className="py-3 px-5">Estado</th>
                  {!isCashier && <th className="py-3 px-5 text-right">Importe</th>}
                  <th className="py-3 px-5 text-right">Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242426] text-xs">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-[#161619] transition-colors">
                    <td className="py-3.5 px-5 text-[#a1a1aa] whitespace-nowrap stat-detail">
                      {formatDate(sale.createdAt)}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[#f1f1ee]">
                      {sale.cartelCode || 'CAJA01'}
                    </td>
                    <td className="py-3.5 px-5 text-[#f1f1ee]">
                      {sale.cashierName || 'Cajero'}
                    </td>
                    <td className="py-3.5 px-5 text-[#f1f1ee]">
                      {sale.method === 'mercadopago' || sale.method === 'mp_qr'
                        ? 'QR'
                        : sale.method === 'cash'
                        ? 'Efectivo'
                        : 'Tarjeta'}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          sale.status === 'paid'
                            ? 'bg-[#2fb36a]/15 text-[#34d399]'
                            : sale.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {sale.status === 'paid'
                          ? 'Cobrado'
                          : sale.status === 'pending'
                          ? 'Pendiente'
                          : 'Cancelado'}
                      </span>
                    </td>
                    {!isCashier && (
                      <td className="py-3.5 px-5 text-right font-bold text-[#f1f1ee] font-mono tabular-nums">
                        {formatCurrency(sale.amount ?? 0)}
                      </td>
                    )}
                    <td className="py-3.5 px-5 text-right">
                      {sale.receiptId ? (
                        <Link
                          to={`/r/${sale.receiptId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#bec8ff] hover:underline font-medium stat-detail"
                        >
                          Ver ticket
                        </Link>
                      ) : (
                        <span className="text-[#a1a1aa]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
