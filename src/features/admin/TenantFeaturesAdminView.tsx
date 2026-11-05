import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { TenantFeaturesRecord, TenantFeatureKey } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { ToggleLeft, ToggleRight, Store, Sliders } from 'lucide-react';

const FEATURE_LABELS: Record<TenantFeatureKey, { title: string; desc: string }> = {
  menu: {
    title: 'Carta digital y comandas',
    desc: 'Acceso a Toque Carta, mesas, QR y pantalla de cocina',
  },
  club: {
    title: 'Club y tarjeta de sellos',
    desc: 'Programa de fidelización, pases para billeteras y sellos',
  },
  stats: {
    title: 'Estadísticas y reportes',
    desc: 'Resumen de ventas y métricas avanzadas en panel',
  },
};

export const TenantFeaturesAdminView: React.FC = () => {
  const { showToast } = useToast();
  const [tenants, setTenants] = useState<TenantFeaturesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.listTenantsFeatures();
      setTenants(data);
    } catch {
      showToast('No pudimos cargar las funciones por comercio', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (tenantId: string, featureKey: TenantFeatureKey, currentValue: boolean) => {
    const nextValue = !currentValue;
    // Optimistic update
    setTenants((prev) =>
      prev.map((t) =>
        t.tenantId === tenantId
          ? {
              ...t,
              features: {
                ...t.features,
                [featureKey]: nextValue,
              },
            }
          : t
      )
    );

    try {
      await api.setTenantFeature(tenantId, featureKey, nextValue);
      showToast(`Función "${FEATURE_LABELS[featureKey].title}" ${nextValue ? 'activada' : 'desactivada'}`, 'success');
    } catch {
      showToast('No pudimos guardar el cambio', 'error');
      // Revertir
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl bg-[#141418]" />
        <Skeleton className="h-40 w-full rounded-2xl bg-[#141418]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[#F4F4F6]">
            Funciones por comercio
          </h2>
          <p className="text-xs text-[#9E9EA8]">
            Habilitá o deshabilitá módulos contratados (Club, Estadísticas, Carta) de forma inmediata.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {tenants.map((t) => (
          <div
            key={t.tenantId}
            className="bg-[#141418] border border-[#282830] rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#282830] pb-3">
              <div className="flex items-center gap-2.5">
                <Store className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-[#F4F4F6]">{t.businessName}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1C1C24] text-[#9E9EA8]">
                {t.tenantId}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['menu', 'club', 'stats'] as TenantFeatureKey[]).map((key) => {
                const isEnabled = Boolean(t.features[key] ?? true);
                const info = FEATURE_LABELS[key];
                return (
                  <div
                    key={key}
                    onClick={() => handleToggle(t.tenantId, key, isEnabled)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                      isEnabled
                        ? 'bg-amber-500/[0.04] border-amber-500/40 text-[#F4F4F6]'
                        : 'bg-[#101014] border-[#202026] text-[#7E7E8A]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-semibold leading-tight">{info.title}</div>
                      <p className="text-[11px] text-[#9E9EA8] leading-tight">{info.desc}</p>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 pt-0.5"
                      title={isEnabled ? 'Desactivar' : 'Activar'}
                    >
                      {isEnabled ? (
                        <ToggleRight className="w-6 h-6 text-amber-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-[#555562]" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
