import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, DashboardSummary } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCurrency } from '../../lib/formatters';
import {
  CreditCard,
  Receipt,
  Award,
  Star,
  QrCode,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const DashboardSummaryView: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getDashboardSummary()
      .then(setSummary)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-white/10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 rounded-2xl bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
            Resumen
          </h1>
          <p className="text-xs text-white/70 mt-0.5">
            Cobros en caja, comprobantes entregados y captación de opiniones.
          </p>
        </div>

        <Link to="/caja">
          <Button
            variant="estrella"
            size="touch"
            icon={<CreditCard className="w-5 h-5 text-[#0B1030]" />}
          >
            Abrir Caja
          </Button>
        </Link>
      </div>

      {/* Rótulo de datos si la base está limpia (Regla de Oro 4) */}
      {summary.isExample && (
        <div className="p-3.5 rounded-2xl bg-[#FFF1C7]/15 border border-[#FFC21A]/40 text-xs text-white flex items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FFC21A] shrink-0" />
            <span>
              <strong>Base limpia:</strong> Todavía no registraste cobros hoy. Las cifras a continuación son de <strong>Ejemplo</strong>.
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#FFC21A] text-[#0B1030] rounded-lg">
            Ejemplo
          </span>
        </div>
      )}

      {/* Período de Prueba Beta de 30 Días */}
      <div className="p-3.5 rounded-2xl bg-white/[0.08] border border-white/15 text-xs text-white/80 flex items-center justify-between gap-3 flex-wrap backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#19C37D] animate-pulse"></span>
          <span>
            <strong className="text-white">Prueba beta gratuita:</strong> 30 días de acceso completo sin costo. Luego podés continuar con Comercio Pro a $7.899/mes.
          </span>
        </div>
        <Link to="/precios" className="text-xs font-bold text-[#FFC21A] hover:underline shrink-0">
          Ver planes y precios →
        </Link>
      </div>

      {/* Grilla de Métricas Principales en Liquid Glass */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cobros de Hoy */}
        <Card className="space-y-2">
          <div className="flex items-center justify-between text-white/70">
            <span className="text-xs font-semibold">Cobros de hoy</span>
            <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center border border-white/15">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-bold text-2xl text-white tabular-nums">
            {formatCurrency(summary.todaySalesAmount)}
          </p>
          <p className="text-[11px] text-white/60">
            {summary.todaySalesCount} venta(s) registrada(s)
          </p>
        </Card>

        {/* Cobros de la Semana */}
        <Card className="space-y-2">
          <div className="flex items-center justify-between text-white/70">
            <span className="text-xs font-semibold">Semana actual</span>
            <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center border border-white/15">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-bold text-2xl text-white tabular-nums">
            {formatCurrency(summary.weeklySalesAmount)}
          </p>
          <p className="text-[11px] text-white/60">
            {summary.weeklySalesCount} venta(s) acumulada(s)
          </p>
        </Card>

        {/* Recibos Reclamados */}
        <Card className="space-y-2">
          <div className="flex items-center justify-between text-white/70">
            <span className="text-xs font-semibold">Comprobantes vistos</span>
            <div className="w-7 h-7 rounded-lg bg-[#FFC21A]/20 text-[#FFC21A] flex items-center justify-center border border-[#FFC21A]/30">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-bold text-2xl text-white tabular-nums">
            {summary.claimedReceiptsCount}
          </p>
          <p className="text-[11px] text-white/60">
            Clientes que abrieron su recibo
          </p>
        </Card>

        {/* Socios del Club y Reseñas */}
        <Card className="space-y-2">
          <div className="flex items-center justify-between text-white/70">
            <span className="text-xs font-semibold">Club & Opiniones</span>
            <div className="w-7 h-7 rounded-lg bg-[#FF6B6B]/20 text-[#FF6B6B] flex items-center justify-center border border-[#FF6B6B]/30">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-2xl text-white tabular-nums">
              {summary.newClubMembersCount}
            </span>
            <span className="text-xs text-white/60">socios</span>
          </div>
          <p className="text-[11px] text-white/60">
            {summary.reviewButtonClicks} toques al botón de Google
          </p>
        </Card>
      </div>

      {/* Accesos Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#FFC21A] block mb-1">
              Carteles NFC + QR
            </span>
            <h3 className="font-display font-bold text-lg text-white">
              Administrá tus puntos de contacto
            </h3>
            <p className="text-xs text-white/70 mt-1 leading-relaxed">
              Configurá si tus carteles abren el Hub con recibos o van directo a Google Reviews.
            </p>
          </div>
          <Link to="/panel/carteles">
            <Button variant="secundario" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} className="bg-white/10 text-white border-white/20 hover:bg-white/15">
              Ver mis carteles
            </Button>
          </Link>
        </Card>

        <Card className="p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#FFC21A] block mb-1">
              Personalizá tu Hub
            </span>
            <h3 className="font-display font-bold text-lg text-white">
              Diseñá la experiencia del cliente
            </h3>
            <p className="text-xs text-white/70 mt-1 leading-relaxed">
              Reordená bloques, sumá redes sociales y mostrá tus productos destacados con vista previa en vivo.
            </p>
          </div>
          <Link to="/panel/hub">
            <Button variant="secundario" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} className="bg-white/10 text-white border-white/20 hover:bg-white/15">
              Editar Hub
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
};
