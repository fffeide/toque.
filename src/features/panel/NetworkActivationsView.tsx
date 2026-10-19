import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  NetworkActivation,
  NetworkActivationFormat,
} from '../../api';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  Sparkles,
  Flame,
  MapPin,
  Megaphone,
  Check,
  Edit3,
  ExternalLink,
  X,
  Gift,
} from 'lucide-react';

interface FormatBlueprint {
  formatType: NetworkActivationFormat;
  numberLabel: string;
  title: string;
  subtitle: string;
  description: string;
  impactLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FORMAT_BLUEPRINTS: FormatBlueprint[] = [
  {
    formatType: 'cross_benefit',
    numberLabel: '01',
    title: 'Beneficio en Red Toque (Visitas y canjes)',
    subtitle: 'Tráfico cruzado entre comercios vecinos',
    description:
      'Publicá un descuento para aparecer gratis en el ticket digital de los comercios vecinos.',
    impactLabel: 'Aparece al pie del Hub de locales cercanos',
    icon: Sparkles,
  },
  {
    formatType: 'tap_challenge',
    numberLabel: '02',
    title: 'Desafío de Toques (Producto estrella)',
    subtitle: 'Frecuencia semanal o mensual',
    description:
      'Premia a los clientes que visiten tu local X veces en 7 o 30 días.',
    impactLabel: 'Visible en los desafíos de Toquecitos',
    icon: Flame,
  },
  {
    formatType: 'map_pin',
    numberLabel: '03',
    title: 'Punto Destacado en el Mapa (Descubrimiento local)',
    subtitle: 'Visibilidad barrial de alta intención',
    description:
      'Pin destacado con foto y promo para usuarios buscando dónde ir en tu barrio.',
    impactLabel: 'Destacado para compradores a menos de 500 m',
    icon: MapPin,
  },
  {
    formatType: 'receipt_banner',
    numberLabel: '04',
    title: 'Banners y Avisos Post-Compra (Alcance segmentado)',
    subtitle: 'Retención automática post-visita',
    description:
      'Promoción directa a clientes que ya visitaron tu local o locales similares de la zona.',
    impactLabel: 'Mostrado junto al comprobante digital',
    icon: Megaphone,
  },
];

export const NetworkActivationsView: React.FC = () => {
  const { business } = useAuth();
  const { success, error: toastError } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [activations, setActivations] = useState<NetworkActivation[]>([]);
  const [togglingFormat, setTogglingFormat] = useState<NetworkActivationFormat | null>(null);

  // Modal de edición de formato
  const [editingItem, setEditingItem] = useState<NetworkActivation | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDiscount, setFormDiscount] = useState('');
  const [formTerms, setFormTerms] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadActivations = async () => {
    setIsLoading(true);
    try {
      const list = await api.listNetworkActivations();
      setActivations(list);
    } catch (err) {
      toastError(
        'No pudimos cargar las activaciones',
        err instanceof Error ? err.message : 'Intentá de nuevo.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivations();
  }, [business?.id]);

  const handleToggleFormat = async (item: NetworkActivation) => {
    setTogglingFormat(item.formatType);
    try {
      const updated = await api.toggleNetworkActivation(item.formatType, !item.active);
      setActivations((prev) =>
        prev.map((a) => (a.formatType === item.formatType ? updated : a))
      );
      success(
        updated.active ? 'Formato activado en Red Toque' : 'Formato en pausa',
        `${updated.title} (${updated.discountText})`
      );
    } catch (err) {
      toastError(
        'Error al actualizar estado',
        err instanceof Error ? err.message : 'No tenés permisos suficientes.'
      );
    } finally {
      setTogglingFormat(null);
    }
  };

  const handleOpenEdit = (item: NetworkActivation) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDiscount(item.discountText);
    setFormTerms(item.terms);
    setFormActive(item.active);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!formTitle.trim() || !formDiscount.trim()) {
      toastError('Completá el título y el descuento del formato');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await api.saveNetworkActivation({
        formatType: editingItem.formatType,
        title: formTitle.trim(),
        discountText: formDiscount.trim(),
        terms: formTerms.trim(),
        active: formActive,
      });
      setActivations((prev) =>
        prev.map((a) => (a.formatType === editingItem.formatType ? saved : a))
      );
      setEditingItem(null);
      success(
        'Activación actualizada',
        'Los cambios ya impactan en tiempo real en la Red Toque.'
      );
    } catch (err) {
      toastError(
        'No pudimos guardar los cambios',
        err instanceof Error ? err.message : 'Intentá de nuevo.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl bg-[#111113]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-60 w-full rounded-2xl bg-[#111113]" />
          <Skeleton className="h-60 w-full rounded-2xl bg-[#111113]" />
          <Skeleton className="h-60 w-full rounded-2xl bg-[#111113]" />
          <Skeleton className="h-60 w-full rounded-2xl bg-[#111113]" />
        </div>
      </div>
    );
  }

  const activeCount = activations.filter((a) => a.active).length;

  return (
    <div className="space-y-6 text-[#f1f1ee]">
      {/* ENCABEZADO */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111113] border border-[#242426] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#bec8ff]">
            <Sparkles className="w-4 h-4" />
            <span>RED DE BENEFICIOS · {business?.name || 'Tu Comercio'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#f1f1ee] tracking-tight">
            Activaciones y Red Toque
          </h1>
          <p className="text-xs sm:text-sm text-[#a1a1aa] max-w-2xl leading-relaxed">
            Configurá los 4 formatos de activación para atraer clientes de comercios vecinos,
            premiar visitas frecuentes y destacar tu local en Toquecitos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-xs">
            <span className="text-[#a1a1aa]">Formatos activos: </span>
            <strong className="font-mono text-[#2fb36a] tabular-nums">{activeCount}/4</strong>
          </div>
          <Link
            to="/toquecitos"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-[#bec8ff] hover:bg-[#d6daf6] text-[#0c0c0c] text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <span>Ver Toquecitos</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* GRILLA DE LAS 4 TARJETAS DE ACTIVACIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FORMAT_BLUEPRINTS.map((bp) => {
          const record =
            activations.find((a) => a.formatType === bp.formatType) || {
              id: `act-${bp.formatType}`,
              tenantId: business?.id || 'biz-toque-1',
              merchantName: business?.name || 'Mi Comercio',
              formatType: bp.formatType,
              title: bp.title,
              discountText: '15% OFF con Toque',
              terms: 'Presentando tu comprobante digital en mostrador.',
              active: false,
            };

          const Icon = bp.icon;
          const isToggling = togglingFormat === bp.formatType;

          return (
            <div
              key={bp.formatType}
              className={`p-5 sm:p-6 rounded-2xl bg-[#111113] border transition-colors flex flex-col justify-between space-y-5 ${
                record.active ? 'border-[#bec8ff]' : 'border-[#242426]'
              }`}
            >
              <div className="space-y-3">
                {/* Fila superior: Índice + Icono + Switch Activo/Pausado */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                        record.active
                          ? 'bg-[#bec8ff] border-[#bec8ff] text-[#0c0c0c]'
                          : 'bg-[#18181b] border-[#28282a] text-[#bec8ff]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-[#a1a1aa]">
                        {bp.numberLabel}. {bp.subtitle}
                      </span>
                      <h2 className="text-base font-bold text-[#f1f1ee] leading-snug">
                        {bp.title}
                      </h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggleFormat(record)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      record.active
                        ? 'bg-[#2fb36a]/20 border-[#2fb36a]/40 text-[#2fb36a]'
                        : 'bg-[#18181b] border-[#28282a] text-[#a1a1aa] hover:text-[#f1f1ee]'
                    }`}
                  >
                    {isToggling
                      ? 'Actualizando…'
                      : record.active
                      ? '✓ Activo en Red'
                      : 'Activar formato'}
                  </button>
                </div>

                <p className="text-xs text-[#a1a1aa] leading-relaxed">{bp.description}</p>

                {/* Vista previa de la oferta configurada */}
                <div className="p-4 rounded-xl bg-[#18181b] border border-[#28282a] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#2fb36a]">
                      {record.discountText}
                    </span>
                    <span className="text-[11px] text-[#a1a1aa]">{bp.impactLabel}</span>
                  </div>
                  <p className="text-xs font-semibold text-[#f1f1ee]">{record.title}</p>
                  <p className="text-[11px] text-[#a1a1aa] leading-relaxed">{record.terms}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#242426] flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#a1a1aa]">
                  {record.active ? 'Visible para clientes' : 'Pausado temporalmente'}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(record)}
                  className="px-3.5 py-2 rounded-xl bg-[#18181b] border border-[#28282a] hover:border-[#bec8ff] text-xs font-bold text-[#f1f1ee] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#bec8ff]" />
                  <span>Configurar promoción</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* PREVISUALIZACIÓN EN VIVO DE CÓMO APARECE TU LOCAL EN EL TICKET DE COMERCIOS VECINOS */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#f1f1ee]">
              Vista previa en el Hub de Comercios Vecinos
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Así ven los compradores tu beneficio dentro del bloque "Beneficios Red Toque cerca tuyo".
            </p>
          </div>
          <Link
            to="/hub/CAJA01"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-[#bec8ff] hover:underline inline-flex items-center gap-1"
          >
            <span>Probar en mi cartel</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {(() => {
          const cross = activations.find((a) => a.formatType === 'cross_benefit');
          if (!cross) return null;
          return (
            <div className="max-w-md p-4 rounded-2xl bg-[#18181b] border border-[#28282a] space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-[#2fb36a]">{cross.discountText}</span>
                  <h4 className="font-bold text-sm text-[#f1f1ee] mt-0.5">
                    {business?.name || cross.merchantName}
                  </h4>
                  <span className="text-[11px] text-[#a1a1aa]">
                    Comercio Adherido Red Toque · A 150 m
                  </span>
                </div>
                <Gift className="w-4 h-4 text-[#bec8ff]" />
              </div>
              <p className="text-xs font-medium text-[#f1f1ee]">{cross.title}</p>
              <p className="text-[11px] text-[#a1a1aa]">{cross.terms}</p>
            </div>
          );
        })()}
      </div>

      {/* MODAL PARA EDITAR CUALQUIERA DE LOS 4 FORMATOS */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#111113] border border-[#242426] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#242426] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#f1f1ee]">
                  Configurar Promoción
                </h3>
                <p className="text-xs text-[#a1a1aa]">Personalizá tu beneficio en la Red Toque</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-lg bg-[#18181b] border border-[#28282a] flex items-center justify-center text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#f1f1ee] mb-1">
                  Texto destacado del descuento
                </label>
                <input
                  type="text"
                  required
                  value={formDiscount}
                  onChange={(e) => setFormDiscount(e.target.value)}
                  placeholder="Ej: 20% OFF o Café de Cortesía"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] focus:border-[#bec8ff] focus:outline-none text-xs text-[#f1f1ee]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f1f1ee] mb-1">
                  Título de la promoción o desafío
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ej: 15% OFF presentando tu ticket vecino"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] focus:border-[#bec8ff] focus:outline-none text-xs text-[#f1f1ee]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f1f1ee] mb-1">
                  Condiciones / Términos breves
                </label>
                <textarea
                  rows={3}
                  value={formTerms}
                  onChange={(e) => setFormTerms(e.target.value)}
                  placeholder="Ej: Válido de lunes a sábado mostrando Toquecitos."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] focus:border-[#bec8ff] focus:outline-none text-xs text-[#f1f1ee]"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-[#f1f1ee] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-[#28282a] bg-[#18181b] accent-[#bec8ff]"
                />
                <span>Mantener esta activación encendida en la Red Toque</span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#18181b] border border-[#28282a] text-xs font-semibold text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl bg-[#bec8ff] hover:bg-[#d6daf6] text-[#0c0c0c] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Guardando…' : 'Guardar Activación'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
