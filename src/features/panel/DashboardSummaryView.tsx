import React, { useState, useEffect } from 'react';
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
  Wallet,
  Star,
  RefreshCw,
} from 'lucide-react';

export const DashboardSummaryView: React.FC = () => {
  const { user } = useAuth();
  const isCashier = user?.role === 'cashier';
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  }, []);

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
  const totalReceiptsCount = summary.totalReceiptsCount ?? 0;
  const claimedReceiptsCount = summary.claimedReceiptsCount ?? 0;
  const scansCount = summary.scansCount ?? 0;
  const activeCartelesCount = summary.activeCartelesCount ?? 0;
  const totalCartelesCount = summary.totalCartelesCount ?? 0;
  const clubMembersCount = summary.clubMembersCount ?? summary.newClubMembersCount ?? 0;
  const walletPassesCount = summary.walletPassesCount ?? 0;
  const recentSales = summary.recentSales ?? [];

  const kpis = isCashier
    ? [
        {
          label: 'Operaciones de hoy',
          value: todaySalesCount.toString(),
          sub: 'Cobros registrados hoy en caja',
          icon: TrendingUp,
          accent: 'text-[#34d399] bg-[#2fb36a]/15',
        },
        {
          label: 'Operaciones (7 días)',
          value: weeklySalesCount.toString(),
          sub: 'Total de cobros de la semana',
          icon: CreditCard,
          accent: 'text-[#bec8ff] bg-[#bec8ff]/15',
        },
        {
          label: 'Comprobantes emitidos',
          value: totalReceiptsCount.toString(),
          sub: `${claimedReceiptsCount} abiertos por clientes`,
          icon: Receipt,
          accent: 'text-[#bec8ff] bg-[#bec8ff]/15',
        },
        {
          label: 'Escaneos QR / NFC',
          value: scansCount.toString(),
          sub: `${activeCartelesCount} de ${totalCartelesCount} carteles activos`,
          icon: QrCode,
          accent: 'text-[#34d399] bg-[#2fb36a]/15',
        },
      ]
    : [
        {
          label: 'Ventas de hoy',
          value: formatCurrency(summary.todaySalesAmount ?? 0),
          sub: `${todaySalesCount} cobro(s) registrado(s) hoy`,
          icon: TrendingUp,
          accent: 'text-[#34d399] bg-[#2fb36a]/15',
        },
        {
          label: 'Últimos 7 días',
          value: formatCurrency(summary.weeklySalesAmount ?? 0),
          sub: `${weeklySalesCount} operación(es) en la semana`,
          icon: CreditCard,
          accent: 'text-[#bec8ff] bg-[#bec8ff]/15',
        },
        {
          label: 'Comprobantes emitidos',
          value: totalReceiptsCount.toString(),
          sub: `${claimedReceiptsCount} abiertos por clientes`,
          icon: Receipt,
          accent: 'text-[#bec8ff] bg-[#bec8ff]/15',
        },
        {
          label: 'Socios en el Club',
          value: clubMembersCount.toString(),
          sub: `${walletPassesCount} pases Wallet emitidos`,
          icon: Award,
          accent: 'text-[#34d399] bg-[#2fb36a]/15',
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
              ? 'Actividad operativa de carteles y comprobantes en mostrador.'
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
            <Card key={kpi.label} className="p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#a1a1aa]">{kpi.label}</span>
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
                <p className="text-[11px] text-[#a1a1aa] mt-1">{kpi.sub}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Segunda fila de métricas operativas (Solo para Dueño y Encargado) */}
      {!isCashier && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#bec8ff]">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa]">Escaneos QR / NFC</p>
                <p className="text-lg font-bold text-[#f1f1ee] tabular-nums">
                  {scansCount}
                </p>
              </div>
            </div>
            <span className="text-[11px] text-[#a1a1aa]">
              {activeCartelesCount} de {totalCartelesCount} carteles activos
            </span>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#34d399]">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa]">Clics a Google Maps</p>
                <p className="text-lg font-bold text-[#f1f1ee] tabular-nums">
                  {summary.reviewButtonClicks ?? 0}
                </p>
              </div>
            </div>
            <span className="text-[11px] text-[#34d399] font-medium">Directo desde Hub</span>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#f1f1ee]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[#a1a1aa]">Equipo activo</p>
                <p className="text-lg font-bold text-[#f1f1ee] tabular-nums">
                  {summary.teamMembersCount ?? 1}
                </p>
              </div>
            </div>
            <Link
              to="/panel/equipo"
              className="text-xs font-semibold text-[#bec8ff] hover:underline"
            >
              Gestionar →
            </Link>
          </Card>
        </div>
      )}

      {/* Tabla de Últimas Ventas */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-5 border-b border-[#242426] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base text-[#f1f1ee]">Últimos cobros en caja</h2>
            <p className="text-xs text-[#a1a1aa]">
              {isCashier
                ? 'Registro operativo de comprobantes emitidos en mostrador.'
                : 'Se actualiza en vivo cada vez que un cajero emite un cobro.'}
            </p>
          </div>
          <Link
            to="/caja"
            className="text-xs font-semibold text-[#bec8ff] hover:underline flex items-center gap-1"
          >
            Ir a Caja →
          </Link>
        </div>

        {recentSales.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-[#242426] flex items-center justify-center mx-auto text-[#a1a1aa]">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <p className="text-sm font-semibold text-[#f1f1ee]">
                Todavía no hay ventas registradas
              </p>
              <p className="text-xs text-[#a1a1aa]">
                Abrí la pantalla de Caja y cobrá tu primera venta para ver los comprobantes en tiempo real.
              </p>
            </div>
            <div className="pt-2">
              <Link to="/caja">
                <Button variant="ultramar" size="sm">
                  Realizar primer cobro en Caja
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
                  <th className="py-3 px-5">Medio</th>
                  <th className="py-3 px-5">Estado</th>
                  {!isCashier && <th className="py-3 px-5 text-right">Importe</th>}
                  <th className="py-3 px-5 text-right">Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242426] text-xs">
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-[#161619] transition-colors">
                    <td className="py-3.5 px-5 text-[#a1a1aa] whitespace-nowrap">
                      {formatDate(sale.createdAt)}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[#f1f1ee]">
                      {sale.cartelCode || 'CAJA01'}
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
                          className="inline-flex items-center gap-1 text-[#bec8ff] hover:underline font-medium"
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
