/**
 * Toque — Gestión de Carteles del Negocio (CartelesView)
 * Glosario: Cartel, Escaneo, Reemplazo.
 * Lista y tarjetas con estado (activo / silencioso / con problema con ícono + texto, zero-pill discipline),
 * último escaneo, escaneos del mes, desglose NFC vs QR.
 * Acciones: Probar, Descargar QR, Ver detalle, Reemplazar (hoja con motivo).
 * Papelera de 30 días con acción directa "Deshacer".
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../lib/authContext';
import { api, Cartel } from '../../api';
import { useDataQuery } from '../../hooks/useDataQuery';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { Dialog } from '../../components/ui/Dialog';
import { QRPreview } from '../../components/ui/QRPreview';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterBar } from '../../components/ui/FilterBar';
import { OneTimeInfoModal } from '../../components/ui/OneTimeInfoModal';
import { useToast } from '../../components/ui/Toast';
import { validateGoogleReviewUrl } from '../../lib/urlValidator';
import { formatDateTime, formatRelativeTime, formatNumber } from '../../lib/formatters';
import { getShortUrl, getShortUrlDisplay } from '../../lib/urls';
import { CartelDetailModal } from './CartelDetailModal';
import { ReplaceCartelSheet } from './ReplaceCartelSheet';
import { TestCartelModal } from './TestCartelModal';
import {
  QrCode,
  Plus,
  Trash2,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  MapPin,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Copy,
  Clock,
  Smartphone,
  Eye,
  Download,
  Search,
  Sparkles,
} from 'lucide-react';

export const CartelesView: React.FC = () => {
  const { tenant } = useAuth();
  const { success, error: toastError, info } = useToast();
  const businessId = tenant?.type === 'business' ? tenant.id : 'biz-esquina';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'silent' | 'trash'>('all');

  // Modales y Hojas
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [detailCartelTarget, setDetailCartelTarget] = useState<Cartel | null>(null);
  const [replaceCartelTarget, setReplaceCartelTarget] = useState<Cartel | null>(null);
  const [quickQrCartel, setQuickQrCartel] = useState<Cartel | null>(null);
  const [testModalCartel, setTestModalCartel] = useState<Cartel | null>(null);

  // Formulario nuevo cartel
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newTargetUrl, setNewTargetUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-abrir si viene con ?crear=1
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('crear')) {
      setIsCreateSheetOpen(true);
    }
  }, []);

  // Consulta de carteles
  const {
    data: carteles,
    isLoading,
    isError,
    error,
    refetch,
  } = useDataQuery<Cartel[]>({
    queryFn: () => api.listCarteles(businessId, true),
  });

  // Crear cartel
  const handleCreateCartel = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    const validation = validateGoogleReviewUrl(newTargetUrl);
    if (!validation.isValid) {
      setUrlError(validation.error || 'Enlace no válido');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createCartel({
        businessId,
        name: newName,
        locationDescription: newLocation,
        targetUrl: validation.sanitizedUrl || newTargetUrl,
      });

      success('Cartel creado con éxito', `El cartel "${newName}" ya está listo para imprimir y usar.`);
      setIsCreateSheetOpen(false);
      setNewName('');
      setNewLocation('');
      refetch();
    } catch (err) {
      toastError('No se pudo crear el cartel', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mover a papelera con opción inmediata de "Deshacer"
  const handleDeleteCartel = async (cartel: Cartel) => {
    try {
      await api.deleteCartel(cartel.id);
      success(
        'Cartel movido a la papelera',
        `El cartel "${cartel.name}" permanecerá 30 días antes de eliminarse.`,
        () => handleRestoreCartel(cartel.id)
      );
      refetch();
    } catch (err) {
      toastError('Error al eliminar', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleRestoreCartel = async (cartelId: string) => {
    try {
      await api.restoreCartel(cartelId);
      success('Cartel restaurado', 'El cartel volvió a estar activo.');
      refetch();
    } catch (err) {
      toastError('No se pudo restaurar', err instanceof Error ? err.message : 'Error');
    }
  };

  // Calcular estado del cartel: activo / silencioso / con problema / reemplazado
  const getCartelState = (cartel: Cartel) => {
    if (cartel.status === 'trash') return { type: 'trash', label: 'En papelera', color: 'text-slate-400' };
    if (cartel.status === 'replaced') return { type: 'replaced', label: 'Reemplazado', color: 'text-slate-400', icon: RotateCcw };
    if (!cartel.lastScannedAt) {
      return {
        type: 'silent',
        label: 'Sin escaneos aún',
        icon: Clock,
        color: 'text-[var(--ambar)]',
      };
    }

    const lastTime = new Date(cartel.lastScannedAt).getTime();
    const daysAgo = (Date.now() - lastTime) / (1000 * 60 * 60 * 24);

    if (daysAgo > 14) {
      return {
        type: 'silent',
        label: `Silencioso (${Math.floor(daysAgo)} d)`,
        icon: AlertCircle,
        color: 'text-[var(--ambar)]',
      };
    }

    return {
      type: 'active',
      label: 'Activo',
      icon: CheckCircle2,
      color: 'text-[var(--menta)]',
    };
  };

  // Filtrado de carteles
  const filteredCartels = useMemo(() => {
    if (!carteles) return [];
    return carteles.filter((cartel) => {
      const isTrash = cartel.status === 'trash';
      const isReplaced = cartel.status === 'replaced';

      if (selectedFilter === 'trash') {
        if (!isTrash) return false;
      } else {
        // En vista normal, los carteles reemplazados/dados de baja no se muestran como activos duplicados
        if (isTrash || isReplaced) return false;
        if (selectedFilter === 'active') {
          const state = getCartelState(cartel);
          if (state.type !== 'active') return false;
        }
        if (selectedFilter === 'silent') {
          const state = getCartelState(cartel);
          if (state.type !== 'silent') return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          cartel.name.toLowerCase().includes(q) ||
          cartel.locationDescription.toLowerCase().includes(q) ||
          cartel.shortCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [carteles, selectedFilter, searchQuery]);

  if (isError) {
    return (
      <div className="py-12">
        <ErrorState
          title="No pudimos cargar los carteles"
          message={error?.message}
          onRetry={refetch}
        />
      </div>
    );
  }

  const trashCount = carteles?.filter((s) => s.status === 'trash').length || 0;

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Tus carteles
          </h1>
          <p className="text-xs text-white/70 mt-0.5">
            Carteles físicos activos con enlace dinámico a reseñas de Google.
          </p>
        </div>
      </div>

      {/* Modal Popup Informativo (Aparece una sola vez) */}
      <OneTimeInfoModal
        id="carteles_dynamic_link_info"
        title="¿Es posible cambiar el link de un QR físico?"
        icon={<Sparkles className="w-5 h-5 text-blue-400" />}
      >
        <p>
          <strong>¡Sí, en cualquier momento!</strong> Como los carteles físicos imprimen una URL corta inteligente (ej: <code>toque.ar/codigo</code>), podés editar el destino de Google Maps desde el botón "Detalle / Editar enlace" sin tener que reimprimir el acrílico ni tirar el cartel.
        </p>
        <p className="text-white/70">
          La redirección se actualiza de manera instantánea en todos los carteles asociados.
        </p>
      </OneTimeInfoModal>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filtros por pestaña (interactive filter buttons) */}
        <div className="flex items-center gap-1.5 p-1 bg-white/10 rounded-xl border border-white/15 backdrop-blur-md overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-white text-slate-900 shadow-md font-semibold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Todos ({carteles?.filter(s => s.status !== 'trash' && s.status !== 'replaced').length || 0})
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('active')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              selectedFilter === 'active'
                ? 'bg-white text-slate-900 shadow-md font-semibold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Activos
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('silent')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              selectedFilter === 'silent'
                ? 'bg-white text-slate-900 shadow-md font-semibold'
                : 'text-white/70 hover:text-white'
            }`}
          >
            Silenciosos
          </button>

          {trashCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedFilter('trash')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedFilter === 'trash'
                  ? 'bg-rose-500/30 text-rose-200 border border-rose-400/30 font-semibold'
                  : 'text-rose-300 hover:underline'
              }`}
            >
              Papelera ({trashCount})
            </button>
          )}
        </div>

        {/* Input de Búsqueda */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-white/50 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cartel o código..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md text-xs text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/40"
          />
        </div>
      </div>

      {/* Lista de Carteles */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      ) : filteredCartels.length === 0 ? (
        <EmptyState
          icon={<QrCode className="w-8 h-8" />}
          title={selectedFilter === 'trash' ? 'La papelera está vacía' : 'No se encontraron carteles'}
          description={
            searchQuery
              ? 'Probá con otro término de búsqueda o código.'
              : selectedFilter === 'trash'
              ? 'Los carteles eliminados permanecen aquí por 30 días.'
              : 'Creá tu primer cartel para empezar a recibir reseñas de tus clientes.'
          }
          actionLabel={searchQuery || selectedFilter === 'trash' ? undefined : 'Crear cartel ahora'}
          onAction={searchQuery || selectedFilter === 'trash' ? undefined : () => setIsCreateSheetOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCartels.map((cartel) => {
            const state = getCartelState(cartel);
            const StateIcon = state.icon;
            const shortUrl = getShortUrl(cartel.shortCode);
            const shortUrlDisplay = getShortUrlDisplay(cartel.shortCode);

            return (
              <Card key={cartel.id} className="p-5 flex flex-col justify-between space-y-4">
                <div>
                  {/* Encabezado: Título + Estado limpio sin cápsula/pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-body font-semibold text-[var(--text-main)] truncate">
                        {cartel.name}
                      </h3>
                      {cartel.locationDescription && (
                        <p className="text-micro text-[var(--text-muted)] flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{cartel.locationDescription}</span>
                        </p>
                      )}
                    </div>

                    {/* Estado con ícono + texto (WCAG AA, anti-pill discipline) */}
                    <div className={`flex items-center gap-1.5 text-micro font-medium shrink-0 ${state.color}`}>
                      {StateIcon && <StateIcon className="w-3.5 h-3.5" />}
                      <span>{state.label}</span>
                    </div>
                  </div>

                  {/* Código corto */}
                  <div className="mt-3 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] flex items-center justify-between text-micro font-mono">
                    <span className="font-bold text-[var(--brand)]">{shortUrlDisplay}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(shortUrl);
                        success('Copiado', shortUrl);
                      }}
                      className="p-1 hover:text-[var(--text-main)] transition cursor-pointer text-[var(--text-muted)]"
                      title="Copiar enlace corto"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Métrica real de visitas */}
                  <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]/70 space-y-1.5 text-micro">
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span>Última visita:</span>
                      <strong className="text-[var(--text-main)]">
                        {cartel.lastScannedAt ? formatRelativeTime(cartel.lastScannedAt) : 'Sin visitas registradas'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span>Total de toques:</span>
                      <span className="font-semibold text-white">{cartel.scansCount || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Acción única: Ver detalles para acceder a todas las funciones */}
                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  {cartel.status === 'trash' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRestoreCartel(cartel.id)}
                      icon={<RotateCcw className="w-3.5 h-3.5" />}
                      className="w-full justify-center"
                    >
                      Restaurar cartel
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDetailCartelTarget(cartel)}
                      icon={<Eye className="w-3.5 h-3.5" />}
                      className="w-full justify-center font-medium"
                    >
                      Ver detalles y funciones
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* HOJA DE DETALLE DEL CARTEL */}
      {detailCartelTarget && (
        <CartelDetailModal
          isOpen={!!detailCartelTarget}
          onClose={() => setDetailCartelTarget(null)}
          cartel={detailCartelTarget}
          onCartelUpdated={refetch}
          onRequestReplacement={(st) => {
            setDetailCartelTarget(null);
            setReplaceCartelTarget(st);
          }}
        />
      )}

      {/* HOJA DE REEMPLAZO (CON MOTIVO, QR Y SIN CONSUMIR CUPO) */}
      {replaceCartelTarget && (
        <ReplaceCartelSheet
          isOpen={!!replaceCartelTarget}
          onClose={() => setReplaceCartelTarget(null)}
          cartel={replaceCartelTarget}
          onSuccess={refetch}
        />
      )}

      {/* MODAL DE PROBAR CARTEL RÁPIDO */}
      {testModalCartel && (
        <TestCartelModal
          isOpen={!!testModalCartel}
          onClose={() => setTestModalCartel(null)}
          carteles={[testModalCartel]}
          onScanRecorded={refetch}
        />
      )}

      {/* MODAL DE DESCARGA RÁPIDA DE QR */}
      {quickQrCartel && (
        <Dialog
          isOpen={!!quickQrCartel}
          onClose={() => setQuickQrCartel(null)}
          title={`Código QR de ${quickQrCartel.name}`}
          description={getShortUrlDisplay(quickQrCartel.shortCode)}
          size="sm"
        >
          <div className="space-y-4 text-center py-2">
            <div className="p-4 bg-white rounded-xl shadow-xs border border-slate-200 inline-block">
              <QRPreview url={getShortUrl(quickQrCartel.shortCode)} size={160} />
            </div>

            <div className="text-micro text-[var(--text-muted)] space-y-1">
              <p>• Impresión mínima recomendada: <strong>2,5 cm x 2,5 cm</strong></p>
              <p>• Deja al menos 4 mm de zona de silencio alrededor.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const targetShort = getShortUrl(quickQrCartel.shortCode);
                  const link = document.createElement('a');
                  link.download = `QR-${quickQrCartel.shortCode}.png`;
                  link.href = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(targetShort)}`;
                  link.click();
                  success('Descarga lista', 'QR en alta resolución descargado.');
                }}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Descargar PNG
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setQuickQrCartel(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* HOJA PARA CREAR NUEVO CARTEL */}
      <Sheet
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
        title="Crear Nuevo Cartel Físico"
        size="md"
      >
        <form onSubmit={handleCreateCartel} className="space-y-4">
          <Input
            label="Nombre del cartel"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej. Mesa 12 - Terraza"
            required
            helperText="Un nombre que te ayude a identificar su ubicación física."
          />

          <Input
            label="Ubicación física"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder="Ej. Sector aire libre, mesa redonda"
            helperText="Opcional. Te servirá si tenés que reubicarlo o reemplazarlo."
          />

          <div className="space-y-1.5">
            <Input
              label="Enlace a Google Reviews"
              value={newTargetUrl}
              onChange={(e) => setNewTargetUrl(e.target.value)}
              placeholder="https://search.google.com/local/writereview?placeid=..."
              error={urlError || undefined}
              helperText="Dominios permitidos: google.com, search.google.com, maps.google.com, maps.app.goo.gl, g.page."
              required
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const val = validateGoogleReviewUrl(newTargetUrl);
                if (val.isValid) {
                  window.open(newTargetUrl, '_blank', 'noopener,noreferrer');
                } else {
                  setUrlError(val.error || 'Enlace inválido');
                }
              }}
              icon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              Probar enlace en Google antes de guardar
            </Button>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsCreateSheetOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              icon={<Plus className="w-4 h-4" />}
            >
              Crear cartel
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
};
