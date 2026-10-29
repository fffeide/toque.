import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, DashboardSummary, HubConfig, Cartel } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Star, QrCode, ExternalLink, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export const ReviewsStatsView: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [hubConfig, setHubConfig] = useState<HubConfig | null>(null);
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDashboardSummary(), api.getHubConfig(), api.listCarteles()])
      .then(([sum, hub, cartelesList]) => {
        setSummary(sum);
        setHubConfig(hub);
        setCarteles(cartelesList.filter((c) => c.status !== 'trash'));
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !summary || !hubConfig) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56 bg-[#111113]" />
        <Skeleton className="h-64 w-full bg-[#111113]" />
      </div>
    );
  }

  const conversionRate =
    summary.scansCount > 0
      ? Math.round((summary.reviewButtonClicks / summary.scansCount) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="block text-xs text-[#9E9B95] font-medium mb-1">
            Métricas en vivo de tus carteles físicos
          </span>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">
            Reseñas de Google Maps
          </h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">
            Seguimiento de escaneos y clics al botón de calificación desde tus carteles NFC y QR.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/panel/carteles">
            <Button variant="outline" size="sm">
              Mis carteles QR / NFC
            </Button>
          </Link>
          <Link to="/fabricante">
            <Button variant="outline" size="sm">
              Panel de fabricante
            </Button>
          </Link>
          <Link to="/panel/hub">
            <Button variant="primary" size="sm">
              Configurar link de Google Maps
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs Reales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <span className="text-xs font-semibold text-[#a1a1aa]">
            Clics a "Dejar reseña"
          </span>
          <p className="text-3xl font-bold font-mono text-[#D95B26] mt-2">
            {summary.reviewButtonClicks}
          </p>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Contabilizados desde aperturas reales del Hub
          </p>
        </Card>

        <Card>
          <span className="text-xs font-semibold text-[#a1a1aa]">
            Escaneos totales QR / NFC
          </span>
          <p className="text-3xl font-bold font-mono text-[#f1f1ee] mt-2">
            {summary.scansCount}
          </p>
          <p className="text-xs text-[#a1a1aa] mt-1">
            En tus {carteles.length} cartel(es) registrados
          </p>
        </Card>

        <Card>
          <span className="text-xs font-semibold text-[#a1a1aa]">
            Conversión de escaneo a reseña
          </span>
          <p className="text-3xl font-bold font-mono text-[#34d399] mt-2">
            {conversionRate}%
          </p>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Porcentaje de visitantes que tocaron calificar
          </p>
        </Card>
      </div>

      {/* Rendimiento real por cartel */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#f1f1ee]">
              Rendimiento por cartel
            </h2>
            <p className="text-xs text-[#a1a1aa]">
              Cada vez que un cliente apoya su celular o escanea el QR y toca calificar en Google Maps se suma acá al instante.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {carteles.map((cartel) => {
            const scans = cartel.scansCount || 0;
            const reviews = cartel.reviewClicksCount || 0;
            const ratio = scans > 0 ? Math.min(100, Math.round((reviews / scans) * 100)) : 0;

            return (
              <div
                key={cartel.id}
                className="p-4 rounded-xl bg-[#18181b] border border-[#28282a] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#bec8ff]" />
                    <span className="font-bold text-sm text-[#f1f1ee]">{cartel.name}</span>
                    <span className="font-mono text-xs text-[#bec8ff] bg-[#111113] px-2 py-0.5 rounded border border-[#242426]">
                      {cartel.code}
                    </span>
                  </div>
                  <p className="text-xs text-[#a1a1aa]">
                    {scans} escaneo(s) · {reviews} clic(s) a Google Maps ({ratio}% conversión)
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to={`/h/${cartel.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#bec8ff] hover:text-[#d6daf6] inline-flex items-center gap-1"
                  >
                    <span>Probar cartel</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#f1f1ee] flex items-center gap-2">
              <Star className="w-4 h-4 text-[#34d399]" />
              <span>Enlace directo de Google Maps configurado</span>
            </h3>
            <p className="text-xs text-[#a1a1aa] font-mono break-all">
              {hubConfig.googleReviewUrl || 'No configurado aún'}
            </p>
          </div>
          {hubConfig.googleReviewUrl && (
            <a
              href={hubConfig.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#28282a] text-xs font-bold text-[#f1f1ee] inline-flex items-center gap-1.5 shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399]" />
              <span>Probar enlace</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </Card>
    </div>
  );
};
