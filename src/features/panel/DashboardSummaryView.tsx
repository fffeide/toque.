import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, DashboardSummary, Cartel } from '../../api';
import { useAuth } from '../../lib/authContext';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCurrency } from '../../lib/formatters';
import {
  Zap,
  Receipt,
  QrCode,
  Award,
  MapPin,
  ArrowUpRight,
  Users,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';

export const DashboardSummaryView: React.FC = () => {
  const { business, user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSummary = async () => {
    try {
      const [sumData, cartelesData] = await Promise.all([
        api.getDashboardSummary(),
        api.listCarteles(),
      ]);
      setSummary(sumData);
      setCarteles(cartelesData.filter((c) => c.status !== 'trash'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    const unsub = api.subscribeToBusinessSales(() => {
      loadSummary();
    });
    return () => unsub();
  }, [business?.id]);

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 bg-[#111113]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl bg-[#111113]" />
          ))}
        </div>
      </div>
    );
  }

  const activeCarteles = carteles.filter((c) => c.status === 'active');
  const businessName = business?.name || 'Café La Esquina';
  const businessInitial = businessName.charAt(0).toUpperCase();
  const primaryCartelCode = activeCarteles[0]?.code || carteles[0]?.code || 'CAJA01';

  const kpiCards = [
    {
      title: 'Ventas de hoy',
      value: formatCurrency(summary.todaySalesAmount),
      sub: `${summary.todaySalesCount} cobro(s) hoy`,
      icon: Zap,
      iconBg: 'bg-[#bec8ff]/15',
      iconColor: 'text-[#bec8ff]',
      to: '/panel/ventas',
    },
    {
      title: 'Recibos digitales',
      value: summary.totalReceiptsCount.toString(),
      sub: `${summary.claimedReceiptsCount} abiertos por clientes`,
      icon: Receipt,
      iconBg: 'bg-[#2fb36a]/15',
      iconColor: 'text-[#34d399]',
      to: '/panel/ventas',
    },
    {
      title: 'Escaneos QR / NFC',
      value: summary.scansCount.toString(),
      sub: `${summary.reviewButtonClicks} clics a reseñas Google`,
      icon: QrCode,
      iconBg: 'bg-[#f1f1ee]/10',
      iconColor: 'text-[#f1f1ee]',
      to: '/panel/resenas',
    },
    {
      title: 'Club & WalletWallet',
      value: summary.newClubMembersCount.toString(),
      sub: `${summary.walletPassesCount} pases Wallet emitidos`,
      icon: Award,
      iconBg: 'bg-[#bec8ff]/15',
      iconColor: 'text-[#bec8ff]',
      to: '/panel/club',
    },
  ];

  return (
    <div>
      {/* 1. CABECERA DE SECCIÓN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="block text-[11px] uppercase tracking-wider text-[#a1a1aa] font-semibold mb-1">
            PANEL EN TIEMPO REAL · DATOS 100% VERIFICADOS
          </span>
          <h1 className="text-3xl font-bold text-[#f1f1ee] tracking-tight">
            {businessName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/panel/equipo"
            className="bg-[#111113] border border-[#242426] hover:border-[#343438] hover:bg-[#18181b] text-[#f1f1ee] rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors inline-flex items-center gap-2"
          >
            <Users className="w-4 h-4 text-[#bec8ff]" />
            <span>Equipo ({summary.teamMembersCount})</span>
          </Link>
          <Link
            to="/caja"
            className="bg-[#bec8ff] hover:bg-[#d6daf6] text-[#0c0c0c] rounded-xl px-4 py-2.5 text-xs font-bold transition-colors inline-flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4 text-[#0c0c0c]" />
            <span>Ir a Caja y emitir recibo</span>
          </Link>
        </div>
      </div>

      {/* 2. FILA DE 4 TARJETAS KPI (100% DATOS REALES) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              onClick={() => navigate(kpi.to)}
              className="bg-[#111113] border border-[#242426] rounded-2xl p-5 flex flex-col justify-between h-36 hover:border-[#343438] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${kpi.iconBg} ${kpi.iconColor}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-[#a1a1aa] truncate">
                    {kpi.title}
                  </span>
                </div>
                <span className="text-sm text-[#a1a1aa] shrink-0">↗</span>
              </div>

              <div>
                <div className="text-3xl font-bold text-[#f1f1ee] tabular-nums tracking-tight">
                  {kpi.value}
                </div>
                <p className="text-[11px] text-[#a1a1aa] mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. GRILLA INFERIOR EN 2 COLUMNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Columna Izquierda (lg:col-span-8): Tus carteles activos */}
        <div className="lg:col-span-8 bg-[#111113] border border-[#242426] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-[#a1a1aa] font-semibold">
                  CONEXIÓN CAJA ↔ HUB
                </span>
                <h2 className="text-lg font-bold text-[#f1f1ee] tracking-tight mt-0.5">
                  Tus carteles inteligentes ({activeCarteles.length} activos)
                </h2>
              </div>
              <Link
                to="/panel/carteles"
                className="bg-[#18181b] border border-[#28282a] hover:border-[#343438] text-[#f1f1ee] text-xs font-medium px-3.5 py-2 rounded-xl transition-colors"
              >
                Administrar carteles
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {carteles.slice(0, 4).map((cartel) => {
                const realScans = cartel.scansCount || 0;
                return (
                  <div
                    key={cartel.id}
                    className="bg-[#18181b] border border-[#28282a] hover:border-[#343438] rounded-2xl p-4 flex flex-col justify-between gap-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#111113] border border-[#242426] flex items-center justify-center text-[#bec8ff] shrink-0">
                          <QrCode className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[#f1f1ee] truncate">
                            {cartel.name}
                          </h3>
                          <p className="text-xs text-[#a1a1aa] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-[#a1a1aa]" />
                            <span className="capitalize">{cartel.role}</span>
                            <span>·</span>
                            <span className="font-mono text-[#bec8ff] font-semibold">
                              {cartel.code}
                            </span>
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                          cartel.status === 'active'
                            ? 'bg-[#2fb36a]/20 text-[#34d399] border-[#2fb36a]/40'
                            : 'bg-[#242426] text-[#a1a1aa] border-[#343438]'
                        }`}
                      >
                        {cartel.status === 'active' ? 'Activo' : 'Sin activar'}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-[#242426] flex items-center justify-between text-xs">
                      <span className="text-[#a1a1aa]">
                        <strong className="text-[#f1f1ee] font-bold tabular-nums">
                          {realScans}
                        </strong>{' '}
                        escaneo(s) reales
                      </span>
                      <Link
                        to={`/h/${cartel.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#bec8ff] hover:text-[#d6daf6] font-semibold inline-flex items-center gap-1"
                      >
                        <span>Abrir Hub</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#242426] flex flex-wrap items-center justify-between gap-3 text-xs text-[#a1a1aa]">
            <span>
              Emití un cobro en Caja para ver el comprobante aparecer en vivo en el Hub del cartel.
            </span>
            <Link
              to="/caja"
              className="text-[#bec8ff] hover:text-[#d6daf6] font-semibold transition-colors"
            >
              Abrir Terminal de Caja →
            </Link>
          </div>
        </div>

        {/* Columna Derecha (lg:col-span-4): Tarjeta de acceso rápido y estado RLS */}
        <div className="lg:col-span-4 bg-[#111113] border border-[#242426] rounded-2xl p-6 flex flex-col items-center justify-between text-center">
          <div className="w-full flex flex-col items-center">
            <span className="text-[11px] uppercase tracking-wider text-[#a1a1aa] font-semibold mb-4">
              VISTA PÚBLICA DEL CLIENTE
            </span>

            <div className="w-20 h-20 rounded-full bg-[#18181b] border border-[#28282a] flex items-center justify-center text-2xl font-bold text-[#bec8ff] mb-4">
              {businessInitial}
            </div>

            <h3 className="text-xl font-bold text-[#f1f1ee] tracking-tight">
              {businessName}
            </h3>
            <p className="text-xs text-[#a1a1aa] mt-1">
              Cartel principal:{' '}
              <span className="font-mono font-bold text-[#f1f1ee]">{primaryCartelCode}</span>
            </p>

            <div className="mt-4 w-full p-3 rounded-xl bg-[#18181b] border border-[#28282a] text-left space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#a1a1aa]">Sesión RLS:</span>
                <span className="font-bold text-[#34d399] inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {user?.role === 'superadmin'
                    ? 'Super Admin'
                    : user?.role === 'manager'
                    ? 'Encargado'
                    : 'Dueño'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#a1a1aa]">Facturado 7 días:</span>
                <span className="font-mono font-bold text-[#f1f1ee]">
                  {formatCurrency(summary.weeklySalesAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full space-y-2.5 mt-6">
            <Link
              to={`/h/${primaryCartelCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#bec8ff] hover:bg-[#d6daf6] text-[#0c0c0c] font-bold py-3 rounded-xl text-sm transition-colors block"
            >
              Probar mi cartel público ↗
            </Link>
            <Link
              to="/admin"
              className="w-full bg-[#18181b] hover:bg-[#222226] border border-[#28282a] text-[#f1f1ee] font-semibold py-2.5 rounded-xl text-xs transition-colors block"
            >
              Ver Panel Super Admin Global
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
