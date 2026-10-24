import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ClubLocal, ClubConfig, Cartel, BusinessProfile } from '../../api/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BrandLogo } from '../../components/ui/Avatar';
import { RealQrCode } from '../../components/ui/RealQrCode';
import {
  MapPin,
  Printer,
  Copy,
  Check,
  Plus,
  Navigation,
  Store,
  Wifi,
  Smartphone,
  ShoppingBag,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

// Ícono vectorial de Ondas NFC Contactless para el Cartel Imprimible
const NfcWavesIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" />
    <path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
    <path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8" />
    <path d="M16.37 2a20.16 20.16 0 0 1 0 20" />
  </svg>
);

export const ClubLocalsView: React.FC = () => {
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Configuración del Kit Imprimible de Alta Resolución
  const [selectedLocal, setSelectedLocal] = useState<ClubLocal | null>(null);
  const [printFormat, setPrintFormat] = useState<'tent_a5' | 'sticker_10x10'>('tent_a5');
  const [printEdition, setPrintEdition] = useState<'dark' | 'light'>('dark');

  // Formulario de Nuevo Local + Cartel
  const [showNewForm, setShowNewForm] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [geoStatus, setGeoStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [localsData, cartelesData, bizData, clubCfg] = await Promise.all([
        api.listLocals(),
        api.listCarteles(),
        api.getBusinessProfile(),
        api.getClubConfig(),
      ]);
      setLocals(localsData);
      setCarteles(cartelesData);
      setBusiness(bizData);
      setConfig(clubCfg);
      if (localsData.length > 0 && !selectedLocal) {
        setSelectedLocal(localsData[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Tu navegador no permite obtener la ubicación actual.');
      return;
    }
    setGeoStatus('Buscando coordenadas del local...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(5)));
        setLng(Number(pos.coords.longitude.toFixed(5)));
        setGeoStatus('Ubicación guardada para avisos de cercanía en Wallet.');
      },
      () => {
        setGeoStatus('No pudimos leer la ubicación. Podés guardar el local igual.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleCreateLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    setSaving(true);
    try {
      const created = await api.createLocal({
        name: name.trim(),
        address: address.trim(),
        lat,
        lng,
      });
      await api.createCartelForBusiness({
        name: `Mostrador ${created.name}`,
        code: created.code,
        role: 'caja',
        mode: 'smart_hub',
      });
      setName('');
      setAddress('');
      setLat(undefined);
      setLng(undefined);
      setGeoStatus('');
      setShowNewForm(false);
      await loadData();
      setSelectedLocal(created);
    } finally {
      setSaving(false);
    }
  };

  const getHubUrl = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://toque.com.ar';
    return `${origin}/u/${code}`;
  };

  const handleCopyLink = async (local: ClubLocal) => {
    const url = getHubUrl(local.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(local.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handlePrintCartel = async (local?: ClubLocal) => {
    if (local) setSelectedLocal(local);
    await api.markCartelPrinted().catch(() => {});
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const activeLocal = selectedLocal || locals[0];
  const activeHubUrl = activeLocal ? getHubUrl(activeLocal.code) : getHubUrl('BURGER01');
  const merchantName = business?.name || 'La Burger';
  const rewardLabel =
    config?.loyaltyReward ||
    config?.rewardText ||
    'Beneficio exclusivo al completar tu tarjeta';
  const targetStamps = config?.targetStamps || config?.stampsRequired || 10;

  return (
    <div className="space-y-8 pb-16">
      {/* =================================================================== */}
      {/* SECCIÓN DE GESTIÓN (OCULTA AL IMPRIMIR)                             */}
      {/* =================================================================== */}
      <div className="print:hidden space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#D95B26]">
              Sucursales, Mostrador NFC y Kit Imprimible
            </span>
            <h1 className="text-2xl font-bold text-[#F4F4F6] mt-0.5">
              Locales y Carteles Inteligentes
            </h1>
            <p className="text-sm text-[#9E9EA8] mt-1">
              Gestioná tus sucursales, configurá el Hub público y descargá o imprimí tu Cartel QR +
              NFC en formato Carpa A5/A6 o Sticker 10x10cm.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/panel/hub"
              className="px-3.5 py-2.5 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xs font-bold text-[#F4F4F6] flex items-center gap-2 transition-colors"
            >
              <Smartphone className="w-4 h-4 text-[#BEC8FF]" />
              <span>Personalizar Smart Hub</span>
            </Link>
            <Link
              to="/panel/productos"
              className="px-3.5 py-2.5 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xs font-bold text-[#F4F4F6] flex items-center gap-2 transition-colors"
            >
              <ShoppingBag className="w-4 h-4 text-[#2FB36A]" />
              <span>Catálogo CSV</span>
            </Link>
            <Button onClick={() => setShowNewForm(!showNewForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva sucursal
            </Button>
          </div>
        </div>

        {/* Formulario de Nueva Sucursal */}
        {showNewForm && (
          <Card className="p-6 border-[#D95B26]/40">
            <form onSubmit={handleCreateLocal} className="space-y-4">
              <h2 className="text-lg font-bold text-[#F4F4F6]">Agregar sucursal y Cartel NFC/QR</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                    Nombre de la sucursal
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: La Burger Palermo"
                    className="w-full min-h-[46px] px-3.5 rounded-xl border border-[#282830] bg-[#0C0C0E] text-[#F4F4F6] text-sm focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                    Dirección física
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ej: Av. Corrientes 1234, CABA"
                    className="w-full min-h-[46px] px-3.5 rounded-xl border border-[#282830] bg-[#0C0C0E] text-[#F4F4F6] text-sm focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="space-y-1">
                  <Button type="button" variant="secondary" onClick={handleUseCurrentLocation}>
                    <Navigation className="w-4 h-4 mr-2" />
                    Guardar coordenadas GPS (opcional)
                  </Button>
                  {geoStatus && <p className="text-xs font-bold text-[#2FB36A]">{geoStatus}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <Button type="button" variant="secondary" onClick={() => setShowNewForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Creando...' : 'Crear sucursal y cartel'}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        )}

        {/* Grilla de Sucursales y Carteles Activos */}
        {loading ? (
          <Card className="p-8 text-center text-[#9E9EA8]">Cargando sucursales y carteles...</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {locals.map((loc) => {
              const hubUrl = getHubUrl(loc.code);
              const isSelected = activeLocal?.id === loc.id;
              const linkedCartel = carteles.find(
                (c) => c.code.toUpperCase() === loc.code.toUpperCase()
              );

              return (
                <Card
                  key={loc.id}
                  className={`p-5 flex flex-col justify-between gap-4 transition-all ${
                    isSelected ? 'border-[#D95B26] ring-1 ring-[#D95B26]/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-[#D95B26] shrink-0" />
                        <h3 className="text-lg font-bold text-[#F4F4F6] truncate">{loc.name}</h3>
                      </div>
                      <p className="text-xs text-[#9E9EA8] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-[#9E9EA8]" />
                        <span className="truncate">{loc.address}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#1C1C22] border border-[#282830] font-mono text-xs font-bold text-[#D95B26]">
                          NFC / QR: {loc.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#2FB36A]/15 text-[#2FB36A] text-[11px] font-bold">
                          {linkedCartel?.status === 'active' ? 'Activo en mostrador' : 'Listo'}
                        </span>
                      </div>
                    </div>

                    {/* QR Real en miniatura */}
                    <div className="p-2 bg-white rounded-2xl border border-[#282830] shrink-0 shadow-sm">
                      <RealQrCode value={hubUrl} size={76} />
                    </div>
                  </div>

                  {/* Métricas de la sucursal */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#282830] text-center">
                    <div className="p-2 rounded-xl bg-[#1C1C22] border border-[#282830]">
                      <div className="text-base font-extrabold text-[#F4F4F6]">
                        {loc.visitsCount}
                      </div>
                      <div className="text-[11px] text-[#9E9EA8]">Visitas</div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#1C1C22] border border-[#282830]">
                      <div className="text-base font-extrabold text-[#F4F4F6]">
                        {loc.newMembersCount}
                      </div>
                      <div className="text-[11px] text-[#9E9EA8]">Socios</div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#1C1C22] border border-[#282830]">
                      <div className="text-base font-extrabold text-[#2FB36A]">
                        {loc.rewardsRedeemedCount}
                      </div>
                      <div className="text-[11px] text-[#9E9EA8]">Premios</div>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLocal(loc)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#D95B26] text-white border-[#D95B26]'
                          : 'bg-[#1C1C22] text-[#F4F4F6] border-[#282830] hover:border-[#D95B26]'
                      }`}
                    >
                      {isSelected ? 'Seleccionado en vista previa' : 'Ver cartel imprimible'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(loc)}
                      className="py-2.5 px-3 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] border border-[#282830] text-xs font-semibold text-[#F4F4F6] flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === loc.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#2FB36A]" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#9E9EA8]" />
                          <span>Copiar link</span>
                        </>
                      )}
                    </button>

                    <Link
                      to={`/u/${loc.code}`}
                      target="_blank"
                      className="py-2.5 px-3 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] border border-[#282830] text-xs font-semibold text-[#BEC8FF] flex items-center gap-1"
                      title="Abrir Hub Público"
                    >
                      <span>Abrir Hub</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ================================================================= */}
        {/* BARRA DE CONTROLES DEL KIT IMPRIMIBLE (FORMATO + EDICIÓN + PRINT) */}
        {/* ================================================================= */}
        <Card className="p-5 border-[#282830] bg-[#141418]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D95B26]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Estudio de Impresión Toque Hardware</span>
              </div>
              <h2 className="text-lg font-bold text-[#F4F4F6]">
                Diseño listo para imprimir en alta resolución ({activeLocal?.name || 'Casa Central'})
              </h2>
              <p className="text-xs text-[#9E9EA8]">
                Elegí el formato y el acabado. Al tocar &ldquo;Imprimir ahora&rdquo; se genera la
                hoja limpia sin bordes del sistema.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Selector de Formato */}
              <div className="inline-flex rounded-xl bg-[#0C0C0E] p-1 border border-[#282830]">
                <button
                  type="button"
                  onClick={() => setPrintFormat('tent_a5')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    printFormat === 'tent_a5'
                      ? 'bg-[#D95B26] text-white'
                      : 'text-[#9E9EA8] hover:text-white'
                  }`}
                >
                  Carpa A5 / A6
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('sticker_10x10')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    printFormat === 'sticker_10x10'
                      ? 'bg-[#D95B26] text-white'
                      : 'text-[#9E9EA8] hover:text-white'
                  }`}
                >
                  Sticker NFC 10x10cm
                </button>
              </div>

              {/* Selector de Edición (Dark / Light) */}
              <div className="inline-flex rounded-xl bg-[#0C0C0E] p-1 border border-[#282830]">
                <button
                  type="button"
                  onClick={() => setPrintEdition('dark')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    printEdition === 'dark'
                      ? 'bg-[#1C1C22] text-[#F4F4F6] border border-[#282830]'
                      : 'text-[#9E9EA8] hover:text-white'
                  }`}
                >
                  Dark (#0C0C0E)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintEdition('light')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    printEdition === 'light'
                      ? 'bg-white text-[#0C0C0E]'
                      : 'text-[#9E9EA8] hover:text-white'
                  }`}
                >
                  Blanca (Light)
                </button>
              </div>

              <button
                type="button"
                onClick={() => handlePrintCartel(activeLocal)}
                className="px-5 py-2.5 rounded-xl bg-[#2FB36A] hover:bg-[#269a59] text-[#05150c] font-extrabold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir ahora (A5 / Sticker)</span>
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* =================================================================== */}
      {/* LIENZO DE IMPRESIÓN OFICIAL (CARPA A5/A6 O STICKER 10x10CM)         */}
      {/* =================================================================== */}
      <div className="flex justify-center">
        {printFormat === 'tent_a5' ? (
          /* --------------------------------------------------------------- */
          /* FORMATO 1: CARPA DE MOSTRADOR VERTICAL A5 / A6 (148mm x 210mm)  */
          /* --------------------------------------------------------------- */
          <div
            style={{
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
            className={`w-full max-w-[440px] print:max-w-none print:w-[148mm] print:min-h-[205mm] rounded-[32px] p-8 sm:p-9 flex flex-col justify-between text-center relative overflow-hidden shadow-2xl border-2 ${
              printEdition === 'dark'
                ? 'bg-[#0C0C0E] text-[#F4F4F0] border-[#282830] print:border-[#282830]'
                : 'bg-white text-[#0C0C0E] border-[#0C0C0E] print:border-black'
            }`}
          >
            {/* Barra Superior Naranja Toque */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-[#D95B26]" />

            {/* 1. Cabecera: Comercio + Indicador NFC Contactless */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider border ${
                    printEdition === 'dark'
                      ? 'bg-[#141418] text-[#A1A1AA] border-[#282830]'
                      : 'bg-zinc-100 text-zinc-800 border-zinc-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#D95B26]" />
                  {activeLocal?.code || 'BURGER01'}
                </span>

                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                    printEdition === 'dark'
                      ? 'bg-[#D95B26]/15 text-[#D95B26] border-[#D95B26]/40'
                      : 'bg-[#D95B26]/10 text-[#D95B26] border-[#D95B26]/40'
                  }`}
                >
                  <NfcWavesIcon className="w-4 h-4" />
                  <span>NFC + QR ACTIVO</span>
                </div>
              </div>

              <div className="pt-2 space-y-1">
                <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
                  {merchantName}
                </h2>
                <p
                  className={`text-xs font-semibold uppercase tracking-widest ${
                    printEdition === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-500'
                  }`}
                >
                  {activeLocal?.name || 'Mostrador Principal'}
                </p>
              </div>
            </div>

            {/* 2. Centro: Código QR 100% Real + Zona de Apoyo NFC */}
            <div className="my-6 flex flex-col items-center space-y-4">
              <div
                className={`p-5 rounded-3xl bg-white inline-block shadow-xl ${
                  printEdition === 'dark'
                    ? 'border-4 border-[#D95B26]'
                    : 'border-4 border-[#0C0C0E]'
                }`}
              >
                <RealQrCode value={activeHubUrl} size={216} />
              </div>

              <div className="max-w-xs mx-auto space-y-1">
                <p className="text-base font-extrabold tracking-tight">
                  Apoyá tu celular o escaneá el QR
                </p>
                <p
                  className={`text-xs leading-relaxed ${
                    printEdition === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-600'
                  }`}
                >
                  Recibo digital en vivo · Club de Sellos en Wallet · Reseñas en 1 toque
                </p>
              </div>
            </div>

            {/* 3. Caja de Premio del Club */}
            <div
              className={`rounded-2xl p-4 border text-center space-y-1 ${
                printEdition === 'dark'
                  ? 'bg-[#141418] border-[#282830]'
                  : 'bg-zinc-50 border-zinc-300'
              }`}
            >
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#D95B26]">
                PREMIO AL COMPLETAR {targetStamps} SELLOS
              </div>
              <div className="text-base font-extrabold leading-snug">🎁 {rewardLabel}</div>
              <div
                className={`text-[11px] ${
                  printEdition === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-600'
                }`}
              >
                Sin bajar ninguna app · Sumás tu 1° sello en 10 segundos
              </div>
            </div>

            {/* 4. Pie de Firma Oficial Toque */}
            <div className="pt-5 flex items-center justify-between text-xs">
              {printEdition === 'dark' ? (
                <BrandLogo variant="badge" />
              ) : (
                <BrandLogo variant="mono" size="sm" />
              )}
              <span
                className={`font-mono text-[10px] ${
                  printEdition === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-500'
                }`}
              >
                toque.com.ar/u/{activeLocal?.code || 'BURGER01'}
              </span>
            </div>
          </div>
        ) : (
          /* --------------------------------------------------------------- */
          /* FORMATO 2: STICKER NFC CUADRADO 10x10CM (100mm x 100mm)         */
          /* --------------------------------------------------------------- */
          <div
            style={{
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
            className={`w-full max-w-[380px] aspect-square print:w-[100mm] print:h-[100mm] rounded-[28px] p-6 flex flex-col justify-between text-center relative overflow-hidden shadow-2xl border-2 ${
              printEdition === 'dark'
                ? 'bg-[#0C0C0E] text-[#F4F4F0] border-[#D95B26]'
                : 'bg-white text-[#0C0C0E] border-[#0C0C0E]'
            }`}
          >
            {/* Cabecera Compacta del Sticker */}
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-base font-extrabold leading-none">{merchantName}</p>
                <p
                  className={`text-[10px] font-mono mt-0.5 ${
                    printEdition === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-600'
                  }`}
                >
                  CÓDIGO: {activeLocal?.code || 'BURGER01'}
                </p>
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#D95B26] text-white text-[10px] font-extrabold">
                <Wifi className="w-3 h-3 rotate-90" />
                <span>NFC + QR</span>
              </div>
            </div>

            {/* Centro: QR Real + Ícono NFC */}
            <div className="my-2 flex items-center justify-center gap-4">
              <div
                className={`p-3 rounded-2xl bg-white border-2 ${
                  printEdition === 'dark' ? 'border-[#D95B26]' : 'border-[#0C0C0E]'
                }`}
              >
                <RealQrCode value={activeHubUrl} size={146} />
              </div>

              <div className="flex flex-col items-center justify-center space-y-2 max-w-[115px] text-left">
                <div className="w-11 h-11 rounded-2xl bg-[#D95B26]/15 border border-[#D95B26]/40 text-[#D95B26] flex items-center justify-center">
                  <NfcWavesIcon className="w-6 h-6" />
                </div>
                <p className="text-xs font-extrabold leading-tight">
                  Apoyá tu celular o escaneá
                </p>
                <p
                  className={`text-[10px] leading-snug ${
                    printEdition === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-600'
                  }`}
                >
                  Recibo digital, Club de Sellos y Reseñas
                </p>
              </div>
            </div>

            {/* Pie del Sticker */}
            <div
              className={`pt-2 border-t flex items-center justify-between text-[10px] ${
                printEdition === 'dark' ? 'border-[#282830]' : 'border-zinc-200'
              }`}
            >
              <span className="font-bold truncate max-w-[190px]">🎁 {rewardLabel}</span>
              <span className="font-mono font-bold text-[#D95B26]">● toque</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
