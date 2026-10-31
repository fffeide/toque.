import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, HubConfig, HubBlockKey } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency } from '../../lib/formatters';
import { WalletPassCard } from '../../components/wallet/WalletPassCard';
import { GoogleAddressPicker } from '../../components/maps/GoogleAddressPicker';
import { BusinessHoursEditor } from '../../components/schedule/BusinessHoursEditor';
import { RealQrCode } from '../../components/ui/RealQrCode';
import {
  Smartphone,
  GripVertical,
  Save,
  Star,
  Receipt,
  MapPin,
  Clock,
  ShoppingBag,
  Globe,
  ExternalLink,
  Lock,
  CheckCircle2,
  Copy,
} from 'lucide-react';

const BLOCK_LABELS: Record<HubBlockKey, string> = {
  receipt: 'Comprobante de compra',
  review: 'Botón de Google Maps',
  club: 'Club de beneficios',
  socials: 'Redes Sociales',
  products: 'Productos destacados',
  details: 'Horarios y dirección',
};

function buildWhatsAppWaMeLink(rawPhone?: string): string {
  if (!rawPhone) return '';
  const trimmed = rawPhone.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

function normalizeSocialUrl(raw?: string, platform?: 'instagram' | 'tiktok'): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanHandle = trimmed.replace(/^@/, '');
  if (platform === 'instagram') {
    return `https://instagram.com/${cleanHandle}`;
  }
  if (platform === 'tiktok') {
    return `https://tiktok.com/@${cleanHandle}`;
  }
  return `https://${trimmed}`;
}

const InstagramLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const TikTokLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const WhatsAppLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
  </svg>
);

function normalizeHubBlocks(blocks: HubConfig['blocks']): HubConfig['blocks'] {
  const defaultOrder: HubBlockKey[] = ['receipt', 'club', 'review', 'products', 'socials', 'details'];
  const existingMap = new Map(blocks.map((b) => [b.key, b]));
  const result: HubConfig['blocks'] = [];
  for (const b of blocks) {
    if (defaultOrder.includes(b.key)) {
      result.push({ key: b.key, enabled: b.key === 'receipt' ? true : Boolean(b.enabled) });
    }
  }
  for (const key of defaultOrder) {
    if (!existingMap.has(key)) {
      result.push({ key, enabled: true });
    }
  }
  return result;
}

function isValidReviewLink(url?: string): boolean {
  if (!url) return false;
  const t = url.trim();
  if (!t || t === 'https://maps.google.com' || t === 'https://maps.google.com/') return false;
  return true;
}

export const HubEditorView: React.FC = () => {
  const { showToast } = useToast();
  const [config, setConfig] = useState<HubConfig | null>(null);
  const [activeCartelCode, setActiveCartelCode] = useState<string>('MONROE01');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getHubConfig(),
      api.getBusinessProfile().catch(() => null),
      api.getClubConfig().catch(() => null),
      api.listCarteles().catch(() => []),
    ])
      .then(([data, biz, clubCfg, carteles]) => {
        const firstCode = carteles?.[0]?.code || 'MONROE01';
        setActiveCartelCode(firstCode);
        const cleanGoogleUrl =
          data.googleReviewUrl === 'https://maps.google.com' ? '' : data.googleReviewUrl || '';
        const alreadyHasData = Boolean(
          data.hubConfigured ||
            (data.details?.address?.trim() && data.details?.hours?.trim())
        );
        setConfig({
          ...data,
          hubConfigured: alreadyHasData,
          googleReviewUrl: cleanGoogleUrl,
          businessName: data.businessName || biz?.name || clubCfg?.organizationName || 'Musical Monroe',
          rewardText:
            data.rewardText ||
            clubCfg?.loyaltyReward ||
            clubCfg?.rewardText ||
            'Beneficio al completar tus sellos',
          stampsRequired:
            data.stampsRequired || clubCfg?.targetStamps || clubCfg?.stampsRequired || 5,
          colorPreset: data.colorPreset || clubCfg?.colorPreset || 'dark',
          customColor: data.customColor || clubCfg?.customColor,
          logoUrl: data.logoUrl || clubCfg?.logoUrl,
          blocks: normalizeHubBlocks(data.blocks),
        });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleToggleBlock = (key: HubBlockKey) => {
    if (!config) return;
    if (key === 'receipt') return;
    const nextBlocks = normalizeHubBlocks(
      config.blocks.map((b) => (b.key === key ? { ...b, enabled: !b.enabled } : b))
    );
    setConfig({ ...config, blocks: nextBlocks });
    api.updateHubConfig({ ...config, blocks: nextBlocks }).catch(() => {});
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDrop = (targetIndex: number) => {
    if (!config || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const ordered = normalizeHubBlocks(config.blocks);
    const itemToMove = ordered[draggedIndex];
    const nextBlocks = [...ordered];
    nextBlocks.splice(draggedIndex, 1);
    nextBlocks.splice(targetIndex, 0, itemToMove);
    setConfig({ ...config, blocks: nextBlocks });
    api.updateHubConfig({ ...config, blocks: nextBlocks }).catch(() => {});
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = async (markConfigured = false) => {
    if (!config) return;
    if (!config.businessName?.trim()) {
      showToast('Ingresá el nombre de tu comercio', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const normalizedBlocks = normalizeHubBlocks(config.blocks);
      const nextConfig: HubConfig = {
        ...config,
        hubConfigured: markConfigured ? true : config.hubConfigured,
        blocks: normalizedBlocks,
      };
      if (nextConfig.businessName?.trim()) {
        await api.updateBusinessProfile({ name: nextConfig.businessName.trim() }).catch(() => {});
      }
      const updated = await api.updateHubConfig(nextConfig);
      setConfig({
        ...updated,
        hubConfigured: markConfigured ? true : updated.hubConfigured,
        blocks: normalizeHubBlocks(updated.blocks),
      });
      showToast(
        markConfigured ? 'Hub activado correctamente' : 'Configuración del Hub guardada',
        'success'
      );
    } catch {
      showToast('Error al guardar cambios', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-[520px] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const orderedBlocks = normalizeHubBlocks(config.blocks);
  const isPlanPaid = Boolean(config.planPaid);
  const waMePreview = buildWhatsAppWaMeLink(config.socials.whatsapp);
  const featuredProducts = config.products.filter((p) => p.featuredInHub !== false);
  const fixedHubUrl = `${window.location.origin}/u/${activeCartelCode}`;

  // Paso corto y claro de activación del Hub: solo Nombre del comercio y Qué elementos mostrar son obligatorios
  if (!config.hubConfigured) {
    const onboardingToggles: Array<{ key: HubBlockKey; title: string; subtitle: string }> = [
      {
        key: 'club',
        title: 'Tarjeta de sellos',
        subtitle: 'Tus clientes suman sellos y los guardan en su teléfono',
      },
      {
        key: 'review',
        title: 'Botón de reseñas en Google Maps',
        subtitle: 'Acceso directo para que te dejen reseñas o ubiquen el local',
      },
      {
        key: 'socials',
        title: 'Redes sociales y contacto',
        subtitle: 'Mostrá tus enlaces de Instagram, WhatsApp o tienda',
      },
    ];

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D95B26]/15 border border-[#D95B26]/30 text-[#D95B26] text-xs font-semibold mb-2">
            Configuración rápida del Hub
          </span>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">
            Activá el Hub de tu comercio
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Solo necesitás el nombre de tu comercio y elegir qué elementos querés mostrar. El resto de los datos son opcionales.
          </p>
        </div>

        <Card className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-semibold text-[#f1f1ee] mb-1.5">
              1. Nombre del comercio *
            </label>
            <input
              type="text"
              value={config.businessName || ''}
              onChange={(e) => setConfig({ ...config, businessName: e.target.value })}
              placeholder="Ej. Musical Monroe"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#161619] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#D95B26]"
            />
          </div>

          <div className="pt-2 border-t border-[#28282a] space-y-3">
            <label className="block text-xs font-semibold text-[#f1f1ee]">
              2. Qué elementos mostrar en tu Hub *
            </label>
            <div className="space-y-2.5">
              {onboardingToggles.map((item) => {
                const isEnabled = orderedBlocks.find((b) => b.key === item.key)?.enabled ?? true;
                return (
                  <label
                    key={item.key}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      isEnabled
                        ? 'border-[#D95B26]/60 bg-[#D95B26]/10'
                        : 'border-[#28282a] bg-[#161619]'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#f1f1ee]">{item.title}</p>
                      <p className="text-xs text-[#a1a1aa]">{item.subtitle}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggleBlock(item.key)}
                      className="w-4 h-4 rounded accent-[#D95B26] cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#28282a] space-y-4">
            <p className="text-xs font-medium text-[#a1a1aa]">
              Datos adicionales (100% opcionales, podés completarlos ahora o más adelante)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#f1f1ee] mb-1.5">
                  Link de Google Maps (opcional)
                </label>
                <input
                  type="url"
                  value={config.googleReviewUrl || ''}
                  onChange={(e) => setConfig({ ...config, googleReviewUrl: e.target.value })}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#161619] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#D95B26]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f1f1ee] mb-1.5">
                  Instagram (opcional)
                </label>
                <input
                  type="text"
                  value={config.socials.instagram || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      socials: { ...config.socials, instagram: e.target.value },
                    })
                  }
                  placeholder="@tucomercio"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#161619] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#D95B26]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#f1f1ee] mb-1.5">
                  Dirección del local (opcional)
                </label>
                <input
                  type="text"
                  value={config.details.address || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      details: { ...config.details, address: e.target.value },
                    })
                  }
                  placeholder="Ej. Av. Monroe 2450, CABA"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#161619] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#D95B26]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#f1f1ee] mb-1.5">
                  Horarios de atención (opcional)
                </label>
                <input
                  type="text"
                  value={config.details.hours || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      details: { ...config.details, hours: e.target.value },
                    })
                  }
                  placeholder="Ej. Lun a Sáb de 9 a 20 h"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#161619] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#D95B26]"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#28282a] flex items-center justify-end gap-3">
            <Button
              variant="ultramar"
              loading={isSaving}
              icon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => handleSave(true)}
            >
              Activar mi Hub
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">Hub</h1>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Personalizá qué ven tus clientes cuando apoyan el teléfono o escanean el QR fijo de tu mostrador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to={`/u/${activeCartelCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#18181b] hover:bg-[#242429] text-xs font-medium text-[#f1f1ee] border border-[#28282a] transition-colors"
          >
            <span>Ver Hub</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#D95B26]" />
          </Link>

          <Button
            variant="ultramar"
            size="sm"
            loading={isSaving}
            icon={<Save className="w-4 h-4" />}
            onClick={() => handleSave(false)}
          >
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* QR fijo del Hub del comercio para instalar en mostrador */}
      <Card className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#141414] border-[#242424]">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2.5 rounded-2xl shrink-0">
            <RealQrCode value={fixedHubUrl} size={72} margin={0} />
          </div>
          <div className="space-y-1">
            <span className="inline-block text-[11px] font-bold text-[#2fb36a]">
              QR fijo único de tu mostrador ({activeCartelCode})
            </span>
            <h2 className="text-sm font-bold text-[#f1f1ee]">
              Este QR no cambia nunca: es el que dejás impreso en caja
            </h2>
            <p className="text-xs text-[#a1a1aa]">
              Cada vez que cobrás, el cliente que escanea recibe su propio comprobante de forma privada (nadie más puede verlo).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(fixedHubUrl).catch(() => {});
            showToast('Link del Hub copiado', 'success');
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-xs font-semibold text-[#f1f1ee] shrink-0 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5 text-[#D95B26]" />
          <span>Copiar link</span>
        </button>
      </Card>

      {/* Estado del Plan para desbloqueo de bloques adicionales */}
      {!isPlanPaid && (
        <div className="p-4 rounded-2xl bg-[#161619] border border-[#28282a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#f1f1ee]">
                Plan pendiente de activación: solo se muestra el Comprobante de compra en el Hub
              </p>
              <p className="text-[11px] text-[#a1a1aa] mt-0.5">
                Los bloques adicionales del Hub permanecerán ocultos para el cliente hasta activar el plan pago.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/precios"
              className="px-3.5 py-2 rounded-xl bg-[#bec8ff] text-[#0c0c0c] text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Ver planes
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Configuración */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Orden de bloques */}
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="font-bold text-base text-[#f1f1ee]">Orden en pantalla</h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Arrastrá los bloques para definir el orden exacto en el que aparecen en el Hub.
              </p>
            </div>

            <div className="space-y-2.5">
              {orderedBlocks.map((block, index) => {
                const isReceipt = block.key === 'receipt';
                const isDragged = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={block.key}
                    draggable
                    onDragStart={(e) => {
                      setDraggedIndex(index);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverIndex !== index) {
                        setDragOverIndex(index);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverIndex === index) {
                        setDragOverIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(index);
                    }}
                    onDragEnd={() => {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                      isDragged
                        ? 'opacity-40 scale-95 border-[#D95B26]'
                        : isDragOver
                        ? 'border-[#D95B26] bg-[#D95B26]/10 shadow-md ring-1 ring-[#D95B26]'
                        : isReceipt
                        ? 'border-[#2fb36a]/40 bg-[#2fb36a]/10'
                        : block.enabled
                        ? 'border-[#28282a] bg-[#161619] hover:border-[#3a3a40]'
                        : 'border-[#242426] bg-[#111113] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-[#71717a] shrink-0" />
                      {!isReceipt ? (
                        <input
                          type="checkbox"
                          checked={block.enabled}
                          onChange={() => handleToggleBlock(block.key)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded accent-[#2fb36a] cursor-pointer"
                        />
                      ) : null}
                      <span className="text-sm font-semibold text-[#f1f1ee]">
                        {BLOCK_LABELS[block.key]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isReceipt && (
                        <span className="text-[11px] font-semibold text-[#2fb36a] bg-[#2fb36a]/15 px-2 py-0.5 rounded-md">
                          Obligatorio
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 2. Botón de Google Maps */}
          <Card className="p-6">
            <h2 className="font-bold text-base text-[#f1f1ee] mb-1">Botón de Google Maps</h2>
            <p className="text-xs text-[#a1a1aa] mb-4">
              Pegá el link de tu ficha de Google Maps para que tus clientes lleguen directo desde el Hub.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1.5">
                Link de Google Maps
              </label>
              <div className="flex items-center gap-2.5 bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 focus-within:border-[#bec8ff]">
                <MapPin className="w-4 h-4 text-[#2fb36a] shrink-0" />
                <input
                  type="url"
                  placeholder="https://maps.app.goo.gl/..."
                  value={config.googleReviewUrl || ''}
                  onChange={(e) => setConfig({ ...config, googleReviewUrl: e.target.value })}
                  className="w-full bg-transparent text-sm text-[#f1f1ee] placeholder-[#71717a] focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* 3. Redes Sociales */}
          <Card className="p-6">
            <h2 className="font-bold text-base text-[#f1f1ee] mb-1">Redes Sociales</h2>
            <p className="text-xs text-[#a1a1aa] mb-4">
              Pegá el link de tus redes para crear los accesos directos en el Hub. En WhatsApp ingresá tu número y se crea automáticamente el link wa.me.
            </p>

            <div className="space-y-4">
              {/* Instagram */}
              <div>
                <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1.5">
                  Instagram (Link)
                </label>
                <div className="flex items-center gap-3 bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 focus-within:border-[#bec8ff]">
                  <div className="w-7 h-7 rounded-lg bg-[#E1306C]/15 text-[#E1306C] flex items-center justify-center shrink-0">
                    <InstagramLogo className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="https://instagram.com/tucomercio"
                    value={config.socials.instagram || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        socials: { ...config.socials, instagram: e.target.value },
                      })
                    }
                    className="w-full bg-transparent text-sm text-[#f1f1ee] placeholder-[#71717a] focus:outline-none"
                  />
                </div>
              </div>

              {/* TikTok */}
              <div>
                <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1.5">
                  TikTok (Link)
                </label>
                <div className="flex items-center gap-3 bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 focus-within:border-[#bec8ff]">
                  <div className="w-7 h-7 rounded-lg bg-[#f1f1ee]/15 text-[#f1f1ee] flex items-center justify-center shrink-0">
                    <TikTokLogo className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="https://tiktok.com/@tucomercio"
                    value={config.socials.tiktok || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        socials: { ...config.socials, tiktok: e.target.value },
                      })
                    }
                    className="w-full bg-transparent text-sm text-[#f1f1ee] placeholder-[#71717a] focus:outline-none"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold text-[#a1a1aa]">
                    WhatsApp (Número de teléfono)
                  </label>
                  {waMePreview && (
                    <span className="text-[10px] font-mono text-[#2fb36a] truncate max-w-[230px]">
                      {waMePreview}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 focus-within:border-[#bec8ff]">
                  <div className="w-7 h-7 rounded-lg bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
                    <WhatsAppLogo className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    placeholder="+54 9 11 4455-8899"
                    value={config.socials.whatsapp || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        socials: { ...config.socials, whatsapp: e.target.value },
                      })
                    }
                    className="w-full bg-transparent text-sm text-[#f1f1ee] placeholder-[#71717a] focus:outline-none"
                  />
                </div>
              </div>

              {/* Sitio Web Opcional */}
              <div>
                <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1.5">
                  Sitio Web / Tienda Online (Opcional)
                </label>
                <div className="flex items-center gap-3 bg-[#161619] border border-[#28282a] rounded-xl px-3.5 py-2.5 focus-within:border-[#bec8ff]">
                  <div className="w-7 h-7 rounded-lg bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="https://tucomercio.com.ar"
                    value={config.socials.web || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        socials: { ...config.socials, web: e.target.value },
                      })
                    }
                    className="w-full bg-transparent text-sm text-[#f1f1ee] placeholder-[#71717a] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* 4. Acceso a sección Productos */}
          <Card className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-[#f1f1ee]">
                  Productos destacados ({featuredProducts.length})
                </h2>
                <p className="text-xs text-[#a1a1aa] mt-0.5">
                  Administrá el nombre, precio, foto y código universal desde la sección Productos.
                </p>
              </div>
            </div>
            <Link to="/panel/productos" className="shrink-0">
              <Button variant="secundario" size="sm">
                Ir a Productos
              </Button>
            </Link>
          </Card>

          {/* 5. Horarios y Dirección opcionales */}
          <Card className="p-6 space-y-6">
            <div>
              <h2 className="font-bold text-base text-[#f1f1ee]">Datos del local (opcional)</h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Agregá tu dirección y horarios de atención si querés mostrarlos en el Hub y en los comprobantes.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-[#f1f1ee] mb-2">
                  Dirección del local (opcional)
                </label>
                <GoogleAddressPicker
                  value={config.details.address || ''}
                  onChange={(address) =>
                    setConfig({
                      ...config,
                      details: { ...config.details, address },
                    })
                  }
                />
              </div>

              <div className="pt-2 border-t border-[#28282a]">
                <label className="block text-xs font-semibold text-[#f1f1ee] mb-2">
                  Horarios de atención (intervalos numéricos y cortes durante el día)
                </label>
                <BusinessHoursEditor
                  value={config.details.hours || ''}
                  onChange={(hours) =>
                    setConfig({
                      ...config,
                      details: { ...config.details, hours },
                    })
                  }
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Columna Derecha: Vista Previa en Vivo respetando el orden configurado */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <div className="rounded-[32px] p-5 bg-[#ffffff] border-2 border-black/15 shadow-2xl max-w-xs mx-auto text-[#0c0c0c] space-y-3.5">
            <div className="flex items-center justify-between text-[11px] text-[#52525b] px-1">
              <span className="flex items-center gap-1 font-medium">
                <Smartphone className="w-3.5 h-3.5 text-[#1f8a4c]" /> Vista previa del Hub
              </span>
              <span className="font-mono font-bold text-[#0c0c0c] bg-[#f1f1ee] px-2.5 py-0.5 rounded-full border border-black/10">
                {activeCartelCode}
              </span>
            </div>

            {/* Header del comercio en el móvil */}
            <div className="flex items-center justify-between pb-3 border-b border-black/10">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#0c0c0c] text-[#bec8ff] flex items-center justify-center font-bold text-xs">
                  {(config.businessName || 'M').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#0c0c0c]">
                    {config.businessName || 'Mi Comercio'}
                  </h3>
                  <p className="text-[10px] text-[#52525b]">Mostrador · {activeCartelCode}</p>
                </div>
              </div>
            </div>

            {/* Renderizado dinámico según el orden exacto de orderedBlocks */}
            {orderedBlocks
              .filter((b) => b.enabled && (isPlanPaid || b.key === 'receipt'))
              .map((b) => {
                if (b.key === 'receipt') {
                  return (
                    <div
                      key="receipt"
                      className="p-3.5 rounded-2xl bg-[#f6f6f3] border border-black/10 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#1f8a4c] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2fb36a]" />
                          <Receipt className="w-3 h-3" /> Comprobante completo
                        </span>
                        <span className="text-[10px] text-[#52525b]">Recién emitido</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-xs text-[#0c0c0c]">Ticket troquelado</span>
                        <span className="font-extrabold text-xs font-mono bg-[#0c0c0c] text-[#bec8ff] px-2 py-0.5 rounded-md">
                          Privado por cliente
                        </span>
                      </div>
                    </div>
                  );
                }
                if (b.key === 'review') {
                  if (!isValidReviewLink(config.googleReviewUrl)) return null;
                  return (
                    <div
                      key="review"
                      className="p-3 rounded-full bg-[#0c0c0c] text-[#f1f1ee] text-center font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Star className="w-3.5 h-3.5 fill-[#bec8ff] text-[#bec8ff]" />
                      Botón de Google Maps
                    </div>
                  );
                }
                if (b.key === 'club') {
                  return (
                    <div key="club" className="pt-1">
                      <WalletPassCard
                        businessName={config.businessName || 'Mi Comercio'}
                        memberName="Cliente"
                        stamps={1}
                        stampsRequired={config.stampsRequired || 5}
                        rewardText={config.rewardText || 'Beneficio al completar tus sellos'}
                        barcodeToken="48291037"
                        shortCode="48291037"
                        colorPreset={config.colorPreset || 'dark'}
                        customColor={config.customColor}
                        logoUrl={config.logoUrl}
                      />
                    </div>
                  );
                }
                if (b.key === 'products' && featuredProducts.length > 0) {
                  return (
                    <div
                      key="products"
                      className="p-3.5 rounded-2xl bg-[#f6f6f3] border border-black/10 space-y-2"
                    >
                      <p className="text-xs font-bold text-[#52525b] flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" /> Catálogo
                      </p>
                      {featuredProducts.slice(0, 3).map((p) => (
                        <div key={p.id} className="flex justify-between items-center gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {p.imageUrl && (
                              <img
                                src={p.imageUrl}
                                alt={p.title}
                                className="w-7 h-7 rounded-lg object-cover border border-black/10 shrink-0"
                              />
                            )}
                            <span className="text-[#0c0c0c] truncate">{p.title}</span>
                          </div>
                          {p.price !== undefined && (
                            <span className="font-mono font-bold text-[#0c0c0c] shrink-0">
                              {formatCurrency(p.price)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                }
                if (b.key === 'socials') {
                  const hasIg = Boolean(config.socials.instagram?.trim());
                  const hasTt = Boolean(config.socials.tiktok?.trim());
                  const hasWa = Boolean(config.socials.whatsapp?.trim());
                  const hasWeb = Boolean(config.socials.web?.trim());

                  if (!hasIg && !hasTt && !hasWa && !hasWeb) return null;

                  return (
                    <div key="socials" className="grid grid-cols-2 gap-2">
                      {hasIg && (
                        <a
                          href={normalizeSocialUrl(config.socials.instagram, 'instagram')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-full bg-[#0c0c0c] text-[#f1f1ee] text-center text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <InstagramLogo className="w-3.5 h-3.5 text-[#bec8ff]" /> Instagram
                        </a>
                      )}
                      {hasTt && (
                        <a
                          href={normalizeSocialUrl(config.socials.tiktok, 'tiktok')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-full bg-[#0c0c0c] text-[#f1f1ee] text-center text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <TikTokLogo className="w-3.5 h-3.5 text-[#bec8ff]" /> TikTok
                        </a>
                      )}
                      {hasWa && (
                        <a
                          href={buildWhatsAppWaMeLink(config.socials.whatsapp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-full bg-[#0c0c0c] text-[#f1f1ee] text-center text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <WhatsAppLogo className="w-3.5 h-3.5 text-[#2fb36a]" /> WhatsApp
                        </a>
                      )}
                      {hasWeb && (
                        <a
                          href={normalizeSocialUrl(config.socials.web)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-full bg-[#0c0c0c] text-[#f1f1ee] text-center text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Globe className="w-3.5 h-3.5 text-[#bec8ff]" /> Web
                        </a>
                      )}
                    </div>
                  );
                }
                if (b.key === 'details') {
                  if (!config.details.address?.trim() && !config.details.hours?.trim()) return null;
                  return (
                    <div
                      key="details"
                      className="p-3.5 rounded-2xl bg-[#f6f6f3] border border-black/10 space-y-1.5 text-[11px] text-[#52525b]"
                    >
                      {config.details.address?.trim() && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#0c0c0c] shrink-0" />{' '}
                          <span>{config.details.address}</span>
                        </p>
                      )}
                      {config.details.hours?.trim() && (
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#0c0c0c] shrink-0" />{' '}
                          <span>{config.details.hours}</span>
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              })}
          </div>
        </div>
      </div>
    </div>
  );
};
