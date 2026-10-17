import React, { useState, useEffect } from 'react';
import { api, HubConfig, HubBlockKey } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Save,
  Palette,
  Share2,
  MapPin,
  Clock,
  Phone,
  Receipt,
  Star,
  Award,
  Sparkles,
} from 'lucide-react';

export const HubEditorView: React.FC = () => {
  const [config, setConfig] = useState<HubConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const data = await api.getHubConfig();
      setConfig(data);
    } catch {
      // Ignorar
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleToggleBlock = (key: HubBlockKey) => {
    if (!config) return;
    const nextBlocks = config.blocks.map(b =>
      b.key === key ? { ...b, enabled: !b.enabled } : b
    );
    setConfig({ ...config, blocks: nextBlocks });
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (!config) return;
    const newBlocks = [...config.blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;

    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;

    setConfig({ ...config, blocks: newBlocks });
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await api.updateHubConfig(config);
      success('Hub actualizado', 'Los cambios ya se ven reflejados en todos tus carteles.');
    } catch (err) {
      toastError('No pudimos guardar los cambios', err instanceof Error ? err.message : 'Probá de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const blockLabels: Record<HubBlockKey, { title: string; desc: string; icon: any }> = {
    receipt: { title: 'Comprobante de compra', desc: 'Muestra el recibo recién cobrado en caja', icon: Receipt },
    review: { title: 'Botón de Google Reviews', desc: 'Acceso directo a calificar con 5 estrellas', icon: Star },
    club: { title: 'Club de Fidelidad', desc: 'Tarjeta de sellos y puntos para tus clientes', icon: Award },
    socials: { title: 'Redes Sociales', desc: 'Accesos a Instagram, WhatsApp y más', icon: Share2 },
    products: { title: 'Productos Destacados', desc: 'Platos o combos sugeridos de tu local', icon: Sparkles },
    details: { title: 'Datos del Local', desc: 'Dirección, horarios y teléfono del comercio', icon: MapPin },
  };

  if (isLoading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-white/10" />
        <Skeleton className="h-96 w-full rounded-2xl bg-white/10" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
            Hub
          </h1>
          <p className="text-xs text-white/70 mt-0.5">
            Personalizá el orden de los bloques, redes, productos y color de tu cartel.
          </p>
        </div>

        <Button
          variant="estrella"
          size="touch"
          onClick={handleSave}
          disabled={isSaving}
          icon={<Save className="w-4 h-4 text-[#0B1030]" />}
        >
          {isSaving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Configuración de Bloques y Contenido (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Orden y Visibilidad de Bloques (Accesible con teclado) */}
          <Card className="space-y-4">
            <div>
              <h2 className="font-display font-bold text-base text-white">
                Bloques y Orden en Pantalla
              </h2>
              <p className="text-xs text-white/70 mt-0.5">
                Usá las flechas arriba y abajo para cambiar el orden en que tus clientes ven el contenido.
              </p>
            </div>

            <div className="space-y-2">
              {config.blocks.map((block, index) => {
                const info = blockLabels[block.key];
                const Icon = info.icon;
                const isFirst = index === 0;
                const isLast = index === config.blocks.length - 1;

                return (
                  <div
                    key={block.key}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                      block.enabled
                        ? 'bg-white/[0.08] border-white/20 shadow-xs text-white'
                        : 'bg-white/[0.02] border-dashed border-white/10 opacity-50 text-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[#FFC21A]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-white truncate">{info.title}</p>
                        <p className="text-[10px] text-white/60 truncate">{info.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botones de accesibilidad por teclado */}
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMoveBlock(index, 'up')}
                        aria-label={`Subir bloque ${info.title}`}
                        className="p-1.5 rounded-xl border border-white/15 hover:bg-white/10 text-white/70 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMoveBlock(index, 'down')}
                        aria-label={`Bajar bloque ${info.title}`}
                        className="p-1.5 rounded-xl border border-white/15 hover:bg-white/10 text-white/70 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleBlock(block.key)}
                        className={`text-xs px-3 py-1 rounded-full font-bold transition cursor-pointer border ${
                          block.enabled
                            ? 'bg-[#19C37D]/20 text-[#19C37D] border-[#19C37D]/40'
                            : 'bg-white/10 text-white/60 border-white/15'
                        }`}
                      >
                        {block.enabled ? 'Visible' : 'Oculto'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Redes Sociales */}
          <Card className="space-y-4">
            <h2 className="font-display font-bold text-base text-white">
              Redes Sociales
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-white/80 font-semibold mb-1" htmlFor="ig">
                  Usuario de Instagram
                </label>
                <div className="flex items-center rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white">
                  <span className="text-white/60 mr-1">@</span>
                  <input
                    id="ig"
                    type="text"
                    value={config.socials.instagram || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      socials: { ...config.socials, instagram: e.target.value },
                    })}
                    placeholder="laesquina.cafe"
                    className="w-full bg-transparent text-white placeholder-white/40 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/80 font-semibold mb-1" htmlFor="wsp">
                  WhatsApp de Contacto
                </label>
                <input
                  id="wsp"
                  type="text"
                  value={config.socials.whatsapp || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    socials: { ...config.socials, whatsapp: e.target.value },
                  })}
                  placeholder="+54 9 11 4455-8899"
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:bg-white/15 focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Información del Local */}
          <Card className="space-y-4">
            <h2 className="font-display font-bold text-base text-white">
              Datos del Local
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-white/80 font-semibold mb-1" htmlFor="dir">
                  Dirección física
                </label>
                <input
                  id="dir"
                  type="text"
                  value={config.details.address || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    details: { ...config.details, address: e.target.value },
                  })}
                  placeholder="Av. Corrientes 1450, CABA"
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:bg-white/15 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/80 font-semibold mb-1" htmlFor="hs">
                    Horarios de atención
                  </label>
                  <input
                    id="hs"
                    type="text"
                    value={config.details.hours || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      details: { ...config.details, hours: e.target.value },
                    })}
                    placeholder="Lun a Sáb 08:00 a 20:00"
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:bg-white/15 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-white/80 font-semibold mb-1" htmlFor="tel">
                    Teléfono fijo
                  </label>
                  <input
                    id="tel"
                    type="text"
                    value={config.details.phone || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      details: { ...config.details, phone: e.target.value },
                    })}
                    placeholder="+54 11 4371-2233"
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:bg-white/15 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Columna Derecha: Vista Previa en Vivo Mobile (lg:col-span-5) */}
        <div className="lg:col-span-5 sticky top-20">
          <Card className="p-4 bg-white/[0.08] border border-white/20 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/15">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Vista previa en vivo
              </span>
              <span className="text-[10px] text-white/60">
                Actualización instantánea
              </span>
            </div>

            {/* Teléfono simulado */}
            <div className="w-full max-w-[320px] mx-auto bg-[#141824] rounded-3xl border-4 border-white/20 p-4 shadow-2xl space-y-3 text-white">
              <div className="w-20 h-3 bg-white/20 rounded-full mx-auto mb-2" />

              {/* Encabezado mock */}
              <div className="text-center space-y-1">
                <div className="w-8 h-8 rounded-lg bg-[#3A3FE0] text-white flex items-center justify-center font-bold text-sm mx-auto">
                  T
                </div>
                <p className="font-display font-bold text-xs text-white">Café La Esquina</p>
              </div>

              {/* Bloques en el orden configurado */}
              <div className="space-y-2">
                {config.blocks.filter(b => b.enabled).map(b => {
                  if (b.key === 'receipt') {
                    return (
                      <div key="r" className="p-2.5 rounded-xl bg-white/[0.08] border border-white/15 text-[10px]">
                        <span className="font-bold text-[#FFC21A] block">Comprobante de compra</span>
                        <span className="text-white/60">Total: $14.500 (Ejemplo)</span>
                      </div>
                    );
                  }
                  if (b.key === 'review') {
                    return (
                      <div key="rev" className="p-2.5 rounded-xl bg-[#FFC21A] text-[#0B1030] font-bold text-center text-[11px] shadow-xs">
                        Dejar reseña en Google
                      </div>
                    );
                  }
                  if (b.key === 'club') {
                    return (
                      <div key="cl" className="p-2.5 rounded-xl bg-white/[0.08] border border-white/15 text-[10px] space-y-1">
                        <span className="font-bold text-white block">Club de Fidelidad</span>
                        <span className="text-white/60 block">5 sellos = 1 café gratis</span>
                      </div>
                    );
                  }
                  if (b.key === 'socials') {
                    return (
                      <div key="so" className="p-2 rounded-xl bg-white/[0.08] text-[10px] text-center text-[#FFC21A] font-semibold">
                        Instagram · WhatsApp
                      </div>
                    );
                  }
                  if (b.key === 'products') {
                    return (
                      <div key="pr" className="p-2 rounded-xl bg-white/[0.08] border border-white/15 text-[10px]">
                        <span className="font-bold text-white block">Productos destacados</span>
                        <span className="text-white/60">Café de especialidad + Medialuna</span>
                      </div>
                    );
                  }
                  if (b.key === 'details') {
                    return (
                      <div key="de" className="p-2 rounded-xl bg-white/[0.08] text-[9px] text-white/60">
                        {config.details.address || 'Av. Corrientes 1450'}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
