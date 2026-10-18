import React, { useState, useEffect } from 'react';
import { api, HubConfig, HubBlockKey } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import {
  ArrowUp,
  ArrowDown,
  Save,
  Share2,
  MapPin,
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
        <Skeleton className="h-8 w-64 bg-[#111113]" />
        <Skeleton className="h-96 w-full rounded-2xl bg-[#111113]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="block text-[11px] uppercase tracking-wider text-[#9c9c98] font-semibold mb-1">
            EXPERIENCIA DEL CLIENTE
          </span>
          <h1 className="font-bold text-2xl sm:text-3xl text-[#f1f1ee] tracking-tight">
            Canales y Hub
          </h1>
          <p className="text-xs text-[#9c9c98] mt-0.5">
            Personalizá el orden de los bloques, redes y datos visibles en tu cartel.
          </p>
        </div>

        <Button
          variant="ultramar"
          size="touch"
          onClick={handleSave}
          disabled={isSaving}
          icon={<Save className="w-4 h-4 text-[#0c0c0c]" />}
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
              <h2 className="font-bold text-base text-[#f1f1ee] tracking-tight">
                Bloques y Orden en Pantalla
              </h2>
              <p className="text-xs text-[#9c9c98] mt-0.5">
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
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                      block.enabled
                        ? 'bg-[#18181b] border-[#28282a] text-[#f1f1ee]'
                        : 'bg-[#0c0c0c] border-dashed border-[#242426] opacity-60 text-[#9c9c98]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#111113] border border-[#242426] flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[#bec8ff]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-[#f1f1ee] truncate">{info.title}</p>
                        <p className="text-[10px] text-[#9c9c98] truncate">{info.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMoveBlock(index, 'up')}
                        aria-label={`Subir bloque ${info.title}`}
                        className="p-1.5 rounded-xl border border-[#28282a] bg-[#111113] hover:bg-[#1f1f23] text-[#9c9c98] hover:text-[#f1f1ee] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMoveBlock(index, 'down')}
                        aria-label={`Bajar bloque ${info.title}`}
                        className="p-1.5 rounded-xl border border-[#28282a] bg-[#111113] hover:bg-[#1f1f23] text-[#9c9c98] hover:text-[#f1f1ee] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleBlock(block.key)}
                        className={`text-xs px-3 py-1 rounded-full font-bold transition-colors cursor-pointer border ${
                          block.enabled
                            ? 'bg-[#2fb36a]/15 text-[#2fb36a] border-[#2fb36a]/30'
                            : 'bg-[#111113] text-[#9c9c98] border-[#28282a]'
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
            <h2 className="font-bold text-base text-[#f1f1ee] tracking-tight">
              Redes Sociales
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[#9c9c98] font-semibold mb-1" htmlFor="ig">
                  Usuario de Instagram
                </label>
                <div className="flex items-center rounded-xl border border-[#28282a] bg-[#18181b] px-3 py-2 text-[#f1f1ee] focus-within:border-[#bec8ff]">
                  <span className="text-[#9c9c98] mr-1">@</span>
                  <input
                    id="ig"
                    type="text"
                    value={config.socials.instagram || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      socials: { ...config.socials, instagram: e.target.value },
                    })}
                    placeholder="laesquina.cafe"
                    className="w-full bg-transparent text-[#f1f1ee] placeholder-[#686865] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#9c9c98] font-semibold mb-1" htmlFor="wsp">
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
                  className="w-full rounded-xl border border-[#28282a] bg-[#18181b] px-3 py-2 text-[#f1f1ee] placeholder-[#686865] focus:border-[#bec8ff] focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Información del Local */}
          <Card className="space-y-4">
            <h2 className="font-bold text-base text-[#f1f1ee] tracking-tight">
              Datos del Local
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#9c9c98] font-semibold mb-1" htmlFor="dir">
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
                  className="w-full rounded-xl border border-[#28282a] bg-[#18181b] px-3 py-2 text-[#f1f1ee] placeholder-[#686865] focus:border-[#bec8ff] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#9c9c98] font-semibold mb-1" htmlFor="hs">
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
                    className="w-full rounded-xl border border-[#28282a] bg-[#18181b] px-3 py-2 text-[#f1f1ee] placeholder-[#686865] focus:border-[#bec8ff] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#9c9c98] font-semibold mb-1" htmlFor="tel">
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
                    className="w-full rounded-xl border border-[#28282a] bg-[#18181b] px-3 py-2 text-[#f1f1ee] placeholder-[#686865] focus:border-[#bec8ff] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Columna Derecha: Vista Previa en Vivo Mobile (lg:col-span-5) */}
        <div className="lg:col-span-5 sticky top-20">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242426]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#f1f1ee]">
                Vista previa en vivo
              </span>
              <span className="text-[10px] text-[#2fb36a] font-medium">
                Actualización instantánea
              </span>
            </div>

            {/* Teléfono simulado Matte Dark Flat con colores del Home (/) */}
            <div className="w-full max-w-[320px] mx-auto bg-[#0c0c0c] rounded-3xl border-2 border-[#28282a] p-4 space-y-3 text-[#f1f1ee]">
              <div className="w-20 h-2.5 bg-[#242426] rounded-full mx-auto mb-2" />

              {/* Encabezado mock */}
              <div className="text-center space-y-1">
                <div className="w-8 h-8 rounded-full bg-[#bec8ff] text-[#0c0c0c] flex items-center justify-center font-bold text-sm mx-auto">
                  t
                </div>
                <p className="font-bold text-xs text-[#f1f1ee]">Café La Esquina</p>
              </div>

              {/* Bloques en el orden configurado */}
              <div className="space-y-2">
                {config.blocks.filter(b => b.enabled).map(b => {
                  if (b.key === 'receipt') {
                    return (
                      <div key="r" className="p-2.5 rounded-xl bg-[#18181b] border border-[#28282a] text-[10px]">
                        <span className="font-bold text-[#34d399] block">Comprobante de compra en vivo</span>
                        <span className="text-[#a1a1aa]">Sincronizado al instante con Caja</span>
                      </div>
                    );
                  }
                  if (b.key === 'review') {
                    return (
                      <div key="rev" className="p-2.5 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-center text-[11px]">
                        Dejar reseña en Google
                      </div>
                    );
                  }
                  if (b.key === 'club') {
                    return (
                      <div key="cl" className="p-2.5 rounded-xl bg-[#18181b] border border-[#28282a] text-[10px] space-y-1">
                        <span className="font-bold text-[#bec8ff] block">Club de Fidelidad</span>
                        <span className="text-[#9c9c98] block">5 sellos = 1 café gratis</span>
                      </div>
                    );
                  }
                  if (b.key === 'socials') {
                    return (
                      <div key="so" className="p-2 rounded-xl bg-[#18181b] border border-[#28282a] text-[10px] text-center text-[#bec8ff] font-semibold">
                        Instagram · WhatsApp
                      </div>
                    );
                  }
                  if (b.key === 'products') {
                    return (
                      <div key="pr" className="p-2 rounded-xl bg-[#18181b] border border-[#28282a] text-[10px]">
                        <span className="font-bold text-[#f1f1ee] block">Productos destacados</span>
                        <span className="text-[#9c9c98]">Café de especialidad + Medialuna</span>
                      </div>
                    );
                  }
                  if (b.key === 'details') {
                    return (
                      <div key="de" className="p-2 rounded-xl bg-[#18181b] border border-[#28282a] text-[9px] text-[#9c9c98]">
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
