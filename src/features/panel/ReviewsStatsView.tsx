import React, { useState, useEffect } from 'react';
import { api, DashboardSummary } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Star, Info, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ReviewsStatsView: React.FC = () => {
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
        <Skeleton className="h-44 w-full rounded-2xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
          Reseñas
        </h1>
        <p className="text-xs text-white/70 mt-0.5">
          Medición de clientes que abrieron el botón para calificar en Google Maps.
        </p>
      </div>

      {/* Tarjeta de Toques a Reseña en Liquid Glass */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FFC21A]/20 text-[#FFC21A] flex items-center justify-center border border-[#FFC21A]/30">
            <Star className="w-6 h-6 text-[#FFC21A] fill-[#FFC21A]" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#FFC21A]">
              Derivación directa a Google
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display font-bold text-3xl sm:text-4xl text-white tabular-nums">
                {summary.reviewButtonClicks}
              </span>
              <span className="text-xs text-white/60">toques registrados en el botón</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/70 leading-relaxed">
          Cada vez que un comensal apoya su teléfono o escanea el cartel físico y pulsa <strong>"Dejar reseña en Google"</strong>, Toque registra la interacción y abre la ficha de tu negocio en Google Maps.
        </p>
      </Card>

      {/* Aviso Institucional Requerido por la especificación */}
      <Card className="p-6 space-y-3 bg-white/[0.07] border border-white/15">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#FFC21A] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-display font-bold text-sm text-white">
              Módulo de Analítica Avanzada de Reseñas
            </h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Las estadísticas completas de reseñas van a vivir en el módulo Reseñas (comparativas por mozo, auditorías de rating, canales de salón e historial histórico).
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Link to="/panel/carteles">
            <Button variant="secundario" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} className="bg-white/10 text-white border-white/20 hover:bg-white/15">
              Administrar carteles de reseñas
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
