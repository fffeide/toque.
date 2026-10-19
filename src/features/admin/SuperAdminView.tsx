import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, SuperAdminSummary } from '../../api';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../../lib/formatters';
import {
  ShieldCheck,
  Store,
  QrCode,
  Receipt,
  Award,
  Wallet,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Zap,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';

export const SuperAdminView: React.FC = () => {
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SuperAdminSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadGlobalMetrics = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSuperAdminSummary();
      setSummary(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGlobalMetrics();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isLoading || !summary) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#f1f1ee] p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-72 bg-[#111113]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl bg-[#111113]" />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-2xl bg-[#111113]" />
        </div>
      </div>
    );
  }

  const globalKpis = [
    {
      label: 'Comercios Registrados',
      value: summary.totalBusinesses.toString(),
      sub: `${summary.activeCarteles} de ${summary.totalCarteles} carteles activos`,
      icon: Store,
      accent: 'text-[#bec8ff] bg-[#bec8ff]/15',
    },
    {
      label: 'Volumen Real Facturado',
      value: formatCurrency(summary.totalSalesAmount),
      sub: `${summary.totalSalesCount} cobros pagados en caja`,
      icon: Zap,
      accent: 'text-[#34d399] bg-[#2fb36a]/15',
    },
    {
      label: 'Recibos Digitales Emitidos',
      value: summary.totalReceiptsEmitted.toString(),
      sub: `${summary.claimedReceiptsCount} reclamados por clientes`,
      icon: Receipt,
      accent: 'text-[#bec8ff] bg-[#bec8ff]/15',
    },
    {
      label: 'Socios Club & WalletWallet',
      value: summary.totalClubMembers.toString(),
      sub: `${summary.walletPassesIssued} pases Wallet emitidos`,
      icon: Wallet,
      accent: 'text-[#34d399] bg-[#2fb36a]/15',
    },
  ];

  return (
    <div className="theme-panel min-h-screen bg-[#000000] text-[#f1f1ee]">
      {/* Header Global */}
      <header className="border-b border-[#242426] bg-[#0c0c0c] px-4 sm:px-8 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/panel"
              className="w-9 h-9 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#343438] text-[#f1f1ee] flex items-center justify-center transition-colors"
              title="Ir al panel del comercio"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-[#f1f1ee] tracking-tight">
                  Super Admin Global · toque™
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#bec8ff] text-[#0c0c0c] px-2.5 py-0.5 rounded-full">
                  Nivel Plataforma
                </span>
              </div>
              <p className="text-xs text-[#a1a1aa]">
                Monitoreo general de comercios adheridos, carteles activos y operaciones en vivo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label="Cambiar tema"
              className="w-9 h-9 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#bec8ff] text-[#f1f1ee] flex items-center justify-center transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-[#bec8ff]" /> : <Moon className="w-4 h-4" />}
            </button>

            <Button
              variant="secundario"
              size="sm"
              onClick={loadGlobalMetrics}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Actualizar
            </Button>

            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="w-9 h-9 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#343438] text-[#a1a1aa] hover:text-[#f1f1ee] flex items-center justify-center transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8">
        {/* KPIs Globales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {globalKpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-5 flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#a1a1aa]">{kpi.label}</span>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.accent}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-[#f1f1ee] tabular-nums tracking-tight">
                    {kpi.value}
                  </p>
                  <p className="text-[11px] text-[#a1a1aa] mt-1">{kpi.sub}</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Tabla de Comercios Registrados */}
        <Card padding="none" className="overflow-hidden">
          <div className="p-5 border-b border-[#242426] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#bec8ff]" />
              <h2 className="font-bold text-base text-[#f1f1ee]">
                Comercios en la Plataforma ({summary.businesses.length})
              </h2>
            </div>
            <span className="text-xs text-[#a1a1aa]">
              Escaneos globales: <strong className="text-[#f1f1ee]">{summary.totalScansCount}</strong> · Clics a reseña:{' '}
              <strong className="text-[#f1f1ee]">{summary.totalReviewClicks}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#242426] bg-[#18181b] text-[#a1a1aa] font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Comercio</th>
                  <th className="py-3 px-4">Titular / Correo</th>
                  <th className="py-3 px-4 text-center">Carteles</th>
                  <th className="py-3 px-4 text-center">Equipo</th>
                  <th className="py-3 px-4 text-center">Socios Club</th>
                  <th className="py-3 px-4 text-right">Ventas Reales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242426]">
                {summary.businesses.map((biz) => (
                  <tr key={biz.id} className="hover:bg-[#18181b] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#f1f1ee]">
                      {biz.name}
                    </td>
                    <td className="py-3.5 px-4 text-[#f1f1ee]">
                      <div>{biz.ownerName}</div>
                      <span className="text-[11px] font-mono text-[#a1a1aa]">{biz.email}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-[#f1f1ee]">
                      {biz.cartelesCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-[#f1f1ee]">
                      {biz.teamCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-[#f1f1ee]">
                      {biz.membersCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#f1f1ee] tabular-nums">
                      {formatCurrency(biz.salesAmount)}
                      <span className="block text-[10px] text-[#a1a1aa] font-normal">
                        {biz.salesCount} cobro(s)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Grilla inferior: Carteles Registrados y Últimos Cobros Reales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Carteles registrados */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242426]">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#bec8ff]" />
                <h3 className="font-bold text-base text-[#f1f1ee]">
                  Carteles NFC / QR ({summary.carteles.length})
                </h3>
              </div>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {summary.carteles.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#bec8ff]">{c.code}</span>
                      <span className="font-semibold text-[#f1f1ee]">{c.name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          c.status === 'active'
                            ? 'bg-[#2fb36a]/20 text-[#34d399]'
                            : 'bg-[#242426] text-[#a1a1aa]'
                        }`}
                      >
                        {c.status === 'active' ? 'Activo' : c.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#a1a1aa] mt-1">
                      Escaneos reales: <strong className="text-[#f1f1ee]">{c.scansCount || 0}</strong> · Clics reseña:{' '}
                      <strong className="text-[#f1f1ee]">{c.reviewClicksCount || 0}</strong>
                    </p>
                  </div>

                  <Link
                    to={`/h/${c.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#bec8ff] text-[#f1f1ee] font-semibold inline-flex items-center gap-1.5"
                  >
                    <span>Hub</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </Card>

          {/* Últimos cobros reales */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242426]">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#34d399]" />
                <h3 className="font-bold text-base text-[#f1f1ee]">
                  Actividad de Cobros en Tiempo Real ({summary.recentSales.length})
                </h3>
              </div>
            </div>

            {summary.recentSales.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#a1a1aa]">
                Todavía no se emitieron cobros en la plataforma. Todos los indicadores muestran únicamente actividad real.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {summary.recentSales.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#f1f1ee] tabular-nums">
                          {formatCurrency(s.amount)}
                        </span>
                        <span className="font-mono text-[11px] text-[#bec8ff]">
                          {s.cartelCode || s.cartelName}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#a1a1aa] mt-0.5">
                        {formatDate(s.createdAt)} · Cajero: {s.cashierName || 'Mostrador'}
                      </p>
                    </div>

                    {s.receiptId && (
                      <Link
                        to={`/r/${s.receiptId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono font-semibold text-[#bec8ff] hover:underline"
                      >
                        {s.receiptId} ↗
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};
