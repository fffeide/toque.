import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ClubLocal, Cartel, BusinessProfile, PlanState } from '../../api/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BrandLogo } from '../../components/ui/Avatar';
import { RealQrCode } from '../../components/ui/RealQrCode';
import { getPlanLimits } from '../../config/pricing';
import { useToast } from '../../components/ui/Toast';
import { GoogleAddressPicker } from '../../components/maps/GoogleAddressPicker';
import QRCode from 'qrcode';
import {
  MapPin,
  Printer,
  Download,
  Copy,
  Check,
  Plus,
  Store,
  Wifi,
  Smartphone,
  ShoppingBag,
  ExternalLink,
  QrCode as QrCodeIcon,
  Factory,
} from 'lucide-react';

// Ícono vectorial de Ondas NFC Contactless para el Cartel Imprimible
const NfcWavesIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
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
  const { showToast } = useToast();
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingPng, setDownloadingPng] = useState(false);

  // Configuración de Vista Previa del Cartel
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
      const [localsData, cartelesData, bizData, plan] = await Promise.all([
        api.listLocals(),
        api.listCarteles(),
        api.getBusinessProfile(),
        api.getPlanState().catch(() => null),
      ]);
      setLocals(localsData);
      setCarteles(cartelesData);
      setBusiness(bizData);
      setPlanState(plan);
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

  const planLimits = getPlanLimits(planState?.planId || planState?.status);
  const canCreateMoreLocals = locals.length < planLimits.maxLocals;

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
        setGeoStatus('Ubicación guardada.');
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
      showToast('Sucursal y cartel creados', 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo crear la sucursal', 'error');
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
      showToast('Enlace copiado al portapapeles', 'success');
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback
    }
  };

  // Genera un archivo PNG de alta resolución del cartel vertical y lo descarga
  const generateHighResCartelPng = async (localTarget?: ClubLocal): Promise<string> => {
    const loc = localTarget || selectedLocal || locals[0];
    const code = loc?.code || 'BURGER01';
    const localTitle = loc?.name || 'Mostrador Principal';
    const bizTitle = business?.name || 'La Burger';
    const hubUrl = getHubUrl(code);
    const isDark = printEdition === 'dark';

    const width = 1200;
    const height = printFormat === 'tent_a5' ? 1700 : 1200;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');

    // Fondo
    ctx.fillStyle = isDark ? '#0C0C0E' : '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Barra superior naranja Toque
    ctx.fillStyle = '#D95B26';
    ctx.fillRect(0, 0, width, 28);

    // Marco exterior sutil
    ctx.strokeStyle = isDark ? '#282830' : '#0C0C0E';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    // Badge código local (izquierda) y NFC + QR (derecha)
    ctx.fillStyle = isDark ? '#141418' : '#F4F4F5';
    ctx.beginPath();
    ctx.roundRect(80, 90, 290, 64, 32);
    ctx.fill();

    ctx.fillStyle = '#D95B26';
    ctx.beginPath();
    ctx.arc(118, 122, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isDark ? '#F4F4F0' : '#0C0C0E';
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(code, 144, 131);

    ctx.fillStyle = 'rgba(217, 91, 38, 0.16)';
    ctx.beginPath();
    ctx.roundRect(width - 370, 90, 290, 64, 32);
    ctx.fill();

    ctx.fillStyle = '#D95B26';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NFC + QR ACTIVO', width - 225, 130);

    // Nombre del comercio
    ctx.fillStyle = isDark ? '#F4F4F0' : '#0C0C0E';
    ctx.font = 'bold 68px Sora, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(bizTitle, width / 2, 265);

    ctx.fillStyle = isDark ? '#A1A1AA' : '#52525B';
    ctx.font = '600 28px Inter, sans-serif';
    ctx.fillText(localTitle.toUpperCase(), width / 2, 315);

    // Generar QR Real en DataURL e insertarlo en el centro
    const qrSize = printFormat === 'tent_a5' ? 620 : 500;
    const qrY = printFormat === 'tent_a5' ? 390 : 350;
    const qrBoxPadding = 40;
    const qrBoxSize = qrSize + qrBoxPadding * 2;
    const qrBoxX = (width - qrBoxSize) / 2;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrY, qrBoxSize, qrBoxSize, 48);
    ctx.fill();

    ctx.strokeStyle = isDark ? '#D95B26' : '#0C0C0E';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrY, qrBoxSize, qrBoxSize, 48);
    ctx.stroke();

    const qrDataUrl = await QRCode.toDataURL(hubUrl, {
      width: qrSize,
      margin: 1,
      color: { dark: '#0C0C0E', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    });

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, qrBoxX + qrBoxPadding, qrY + qrBoxPadding, qrSize, qrSize);
        resolve();
      };
      img.onerror = reject;
      img.src = qrDataUrl;
    });

    // Instrucciones inferiores (sin premio fijo, porque puede cambiar)
    const textStartY = qrY + qrBoxSize + 85;
    ctx.fillStyle = isDark ? '#F4F4F0' : '#0C0C0E';
    ctx.font = 'bold 44px Sora, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Apoyá tu celular o escaneá el QR', width / 2, textStartY);

    ctx.fillStyle = isDark ? '#A1A1AA' : '#52525B';
    ctx.font = '500 28px Inter, sans-serif';
    ctx.fillText(
      'Sumá sellos en tu tarjeta digital · guardala en tu Wallet · dejá tu reseña',
      width / 2,
      textStartY + 54
    );

    if (printFormat === 'tent_a5') {
      // Bloque informativo general sin especificar el premio fijo
      const boxY = textStartY + 105;
      ctx.fillStyle = isDark ? '#141418' : '#F4F4F5';
      ctx.beginPath();
      ctx.roundRect(110, boxY, width - 220, 145, 32);
      ctx.fill();

      ctx.strokeStyle = isDark ? '#282830' : '#D4D4D8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(110, boxY, width - 220, 145, 32);
      ctx.stroke();

      ctx.fillStyle = '#D95B26';
      ctx.font = 'bold 24px "JetBrains Mono", monospace';
      ctx.fillText('CLUB DE BENEFICIOS Y COMPROBANTE DIGITAL', width / 2, boxY + 58);

      ctx.fillStyle = isDark ? '#F4F4F0' : '#0C0C0E';
      ctx.font = '600 28px Inter, sans-serif';
      ctx.fillText('Sin bajar ninguna app · Sumás tu sello en segundos', width / 2, boxY + 105);
    }

    // Pie de firma Toque
    ctx.fillStyle = '#D95B26';
    ctx.font = 'bold 28px Sora, Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('● Funciona con Toque', 90, height - 60);

    ctx.fillStyle = isDark ? '#A1A1AA' : '#71717A';
    ctx.font = '500 24px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`toque.com.ar/u/${code}`, width - 90, height - 60);

    return canvas.toDataURL('image/png');
  };

  const handleDownloadCartelPng = async (local?: ClubLocal) => {
    try {
      setDownloadingPng(true);
      if (local) setSelectedLocal(local);
      const dataUrl = await generateHighResCartelPng(local);
      const a = document.createElement('a');
      const code = (local || selectedLocal || locals[0])?.code || 'BURGER01';
      a.href = dataUrl;
      a.download = `cartel-toque-${code.toLowerCase()}-${printFormat}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await api.markCartelPrinted().catch(() => {});
      showToast('Cartel descargado en alta resolución (PNG)', 'success');
    } catch {
      showToast('No se pudo generar la imagen del cartel', 'error');
    } finally {
      setDownloadingPng(false);
    }
  };

  const handlePrintCartel = async (local?: ClubLocal) => {
    if (local) setSelectedLocal(local);
    await api.markCartelPrinted().catch(() => {});
    try {
      // Abrimos o ejecutamos impresión de navegador y también aseguramos que funcione en cualquier entorno
      window.print();
    } catch {
      await handleDownloadCartelPng(local);
    }
  };

  const activeLocal = selectedLocal || locals[0];
  const activeHubUrl = activeLocal ? getHubUrl(activeLocal.code) : getHubUrl('BURGER01');
  const merchantName = business?.name || 'La Burger';

  return (
    <div className="space-y-6 pb-12">
      {/* =================================================================== */}
      {/* SECCIÓN DE GESTIÓN (OCULTA AL IMPRIMIR)                             */}
      {/* =================================================================== */}
      <div className="print:hidden space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#F4F4F6]">Locales y Carteles</h1>
            <p className="text-xs text-[#9E9EA8] mt-0.5">
              Gestioná tus sucursales, tu Hub público y descargá o imprimí tu cartel QR + NFC.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/panel/carteles"
              className="px-3 py-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xs font-bold text-[#F4F4F6] flex items-center gap-1.5 transition-colors"
            >
              <QrCodeIcon className="w-3.5 h-3.5 text-[#D95B26]" />
              <span>Placas QR / NFC</span>
            </Link>
            <Link
              to="/fabricante"
              className="px-3 py-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xs font-bold text-[#F4F4F6] flex items-center gap-1.5 transition-colors"
            >
              <Factory className="w-3.5 h-3.5 text-amber-400" />
              <span>Fabricante</span>
            </Link>
            <Link
              to="/panel/hub"
              className="px-3 py-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xs font-bold text-[#F4F4F6] flex items-center gap-1.5 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#BEC8FF]" />
              <span>Personalizar Hub</span>
            </Link>
            <Link
              to="/panel/productos"
              className="px-3 py-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xs font-bold text-[#F4F4F6] flex items-center gap-1.5 transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#2FB36A]" />
              <span>Catálogo</span>
            </Link>
            <Button
              onClick={() => {
                if (!canCreateMoreLocals) {
                  showToast(
                    `Tu plan (${planLimits.label}) permite hasta ${planLimits.maxLocals} sucursal(es).`,
                    'error'
                  );
                  return;
                }
                setShowNewForm(!showNewForm);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nueva sucursal
            </Button>
          </div>
        </div>

        {/* Formulario de Nueva Sucursal con Google Maps Picker */}
        {showNewForm && (
          <Card className="p-5 border-[#D95B26]/40">
            <form onSubmit={handleCreateLocal} className="space-y-4">
              <h2 className="text-sm font-bold text-[#F4F4F6]">Agregar sucursal y cartel NFC/QR</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                    Nombre de la sucursal
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: La Burger Palermo"
                    className="w-full h-10 px-3.5 rounded-xl border border-[#282830] bg-[#0C0C0E] text-[#F4F4F6] text-xs focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                    Dirección física (buscador integrado con Google Maps)
                  </label>
                  <GoogleAddressPicker
                    value={address}
                    onChange={(addr, coords) => {
                      setAddress(addr);
                      if (coords) {
                        setLat(Number(coords.lat.toFixed(5)));
                        setLng(Number(coords.lng.toFixed(5)));
                        setGeoStatus('Coordenadas de Google Maps guardadas.');
                      }
                    }}
                  />
                  {geoStatus && <p className="text-xs font-bold text-[#2FB36A] mt-1.5">{geoStatus}</p>}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowNewForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creando...' : 'Crear sucursal'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Grilla de Sucursales Activas */}
        {loading ? (
          <Card className="p-6 text-center text-xs text-[#9E9EA8]">
            Cargando sucursales y carteles...
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locals.map((loc) => {
              const hubUrl = getHubUrl(loc.code);
              const isSelected = activeLocal?.id === loc.id;
              const linkedCartel = carteles.find(
                (c) => c.code.toUpperCase() === loc.code.toUpperCase()
              );

              return (
                <Card
                  key={loc.id}
                  className={`p-4 flex flex-col justify-between gap-3 transition-all ${
                    isSelected ? 'border-[#D95B26] ring-1 ring-[#D95B26]/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-[#D95B26] shrink-0" />
                        <h3 className="text-sm font-bold text-[#F4F4F6] truncate">{loc.name}</h3>
                      </div>
                      {loc.address && (
                        <p className="text-xs text-[#9E9EA8] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-[#9E9EA8]" />
                          <span className="truncate">{loc.address}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded-md bg-[#1C1C22] border border-[#282830] font-mono text-[11px] font-bold text-[#D95B26]">
                          NFC / QR: {loc.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#2FB36A]/15 text-[#2FB36A] text-[10px] font-bold">
                          {linkedCartel?.status === 'active' ? 'Activo en mostrador' : 'Listo'}
                        </span>
                      </div>
                    </div>

                    <div className="p-1.5 bg-white rounded-xl border border-[#282830] shrink-0">
                      <RealQrCode value={hubUrl} size={64} />
                    </div>
                  </div>

                  {/* Métricas de la sucursal */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#282830] text-center">
                    <div className="p-2 rounded-lg bg-[#1C1C22] border border-[#282830]">
                      <div className="text-sm font-bold text-[#F4F4F6]">{loc.visitsCount}</div>
                      <div className="text-[10px] text-[#9E9EA8]">Visitas</div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#1C1C22] border border-[#282830]">
                      <div className="text-sm font-bold text-[#F4F4F6]">{loc.newMembersCount}</div>
                      <div className="text-[10px] text-[#9E9EA8]">Socios</div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#1C1C22] border border-[#282830]">
                      <div className="text-sm font-bold text-[#2FB36A]">
                        {loc.rewardsRedeemedCount}
                      </div>
                      <div className="text-[10px] text-[#9E9EA8]">Premios</div>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLocal(loc)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#D95B26] text-white border-[#D95B26]'
                          : 'bg-[#1C1C22] text-[#F4F4F6] border-[#282830] hover:border-[#D95B26]'
                      }`}
                    >
                      {isSelected ? 'En vista previa' : 'Ver cartel'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(loc)}
                      className="py-2 px-2.5 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] border border-[#282830] text-xs font-semibold text-[#F4F4F6] flex items-center gap-1 cursor-pointer"
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
                      className="py-2 px-2.5 rounded-xl bg-[#1C1C22] hover:bg-[#24242C] border border-[#282830] text-xs font-semibold text-[#BEC8FF] flex items-center gap-1"
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
      </div>

      {/* =================================================================== */}
      {/* OPCIONES DE CARTEL A LA IZQUIERDA + CARTEL VERTICAL A LA DERECHA    */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Opciones del cartel (Oculta al imprimir) */}
        <Card className="lg:col-span-5 p-5 border-[#282830] bg-[#141418] space-y-5 print:hidden">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#F4F4F6]">Vista previa del cartel</h2>
            <p className="text-xs text-[#9E9EA8]">
              Configurá el formato y descargá o imprimí el cartel para el mostrador de{' '}
              <strong className="text-[#F4F4F6]">{activeLocal?.name || 'tu local'}</strong>.
            </p>
          </div>

          {/* Selector de Sucursal */}
          {locals.length > 1 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#F4F4F6]">
                Sucursal del cartel
              </label>
              <select
                value={activeLocal?.id || ''}
                onChange={(e) => {
                  const found = locals.find((l) => l.id === e.target.value);
                  if (found) setSelectedLocal(found);
                }}
                className="w-full h-10 px-3 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
              >
                {locals.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Selector de Formato */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#F4F4F6]">Formato</label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0C0C0E] border border-[#282830]">
              <button
                type="button"
                onClick={() => setPrintFormat('tent_a5')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  printFormat === 'tent_a5'
                    ? 'bg-[#D95B26] text-white'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Vertical A5 / A6
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('sticker_10x10')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  printFormat === 'sticker_10x10'
                    ? 'bg-[#D95B26] text-white'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Sticker 10x10cm
              </button>
            </div>
          </div>

          {/* Selector de Edición (Dark / Light) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#F4F4F6]">Acabado</label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0C0C0E] border border-[#282830]">
              <button
                type="button"
                onClick={() => setPrintEdition('dark')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  printEdition === 'dark'
                    ? 'bg-[#1C1C22] text-[#F4F4F6] border border-[#282830]'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Oscuro (#0C0C0E)
              </button>
              <button
                type="button"
                onClick={() => setPrintEdition('light')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  printEdition === 'light'
                    ? 'bg-white text-[#0C0C0E]'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Claro (Blanco)
              </button>
            </div>
          </div>

          {/* Acciones de Impresión y Descarga Directa */}
          <div className="space-y-2.5 pt-2 border-t border-[#282830]">
            <button
              type="button"
              onClick={() => handlePrintCartel(activeLocal)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2FB36A] hover:bg-[#269a59] text-[#05150c] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir cartel ahora</span>
            </button>

            <button
              type="button"
              disabled={downloadingPng}
              onClick={() => handleDownloadCartelPng(activeLocal)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-[#F4F4F6] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#BEC8FF]" />
              <span>
                {downloadingPng ? 'Generando imagen...' : 'Descargar cartel en PNG (Alta resolución)'}
              </span>
            </button>
          </div>
        </Card>

        {/* Columna Derecha: Vista Previa del Cartel Vertical al lado de las opciones */}
        <div className="lg:col-span-7 flex justify-center">
          {printFormat === 'tent_a5' ? (
            /* FORMATO 1: CARPA DE MOSTRADOR VERTICAL A5 / A6 (SIN PREMIO FIJO) */
            <div
              style={{
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact',
              }}
              className={`w-full max-w-[380px] print:max-w-none print:w-[148mm] print:min-h-[205mm] rounded-[28px] p-7 flex flex-col justify-between text-center relative overflow-hidden shadow-2xl border-2 ${
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
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                      printEdition === 'dark'
                        ? 'bg-[#141418] text-[#A1A1AA] border-[#282830]'
                        : 'bg-zinc-100 text-zinc-800 border-zinc-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D95B26]" />
                    {activeLocal?.code || 'BURGER01'}
                  </span>

                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      printEdition === 'dark'
                        ? 'bg-[#D95B26]/15 text-[#D95B26] border-[#D95B26]/40'
                        : 'bg-[#D95B26]/10 text-[#D95B26] border-[#D95B26]/40'
                    }`}
                  >
                    <NfcWavesIcon className="w-3.5 h-3.5" />
                    <span>NFC + QR ACTIVO</span>
                  </div>
                </div>

                <div className="pt-1 space-y-0.5">
                  <h2 className="text-xl font-extrabold tracking-tight leading-tight">
                    {merchantName}
                  </h2>
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-widest ${
                      printEdition === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-500'
                    }`}
                  >
                    {activeLocal?.name || 'Mostrador Principal'}
                  </p>
                </div>
              </div>

              {/* 2. Centro: Código QR 100% Real + Zona de Apoyo NFC */}
              <div className="my-5 flex flex-col items-center space-y-3">
                <div
                  className={`p-4 rounded-3xl bg-white inline-block shadow-xl ${
                    printEdition === 'dark'
                      ? 'border-4 border-[#D95B26]'
                      : 'border-4 border-[#0C0C0E]'
                  }`}
                >
                  <RealQrCode value={activeHubUrl} size={196} />
                </div>

                <div className="max-w-xs mx-auto space-y-1">
                  <p className="text-sm font-extrabold tracking-tight">
                    Apoyá tu celular o escaneá el QR
                  </p>
                  <p
                    className={`text-xs leading-relaxed ${
                      printEdition === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-600'
                    }`}
                  >
                    Recibo digital en vivo · Tarjeta de sellos en Wallet · Reseñas en 1 toque
                  </p>
                </div>
              </div>

              {/* 3. Bloque General del Club (sin texto fijo de premio porque puede cambiar) */}
              <div
                className={`rounded-2xl p-3.5 border text-center space-y-1 ${
                  printEdition === 'dark'
                    ? 'bg-[#141418] border-[#282830]'
                    : 'bg-zinc-50 border-zinc-300'
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#D95B26]">
                  CLUB DE BENEFICIOS Y SELLOS DIGITALES
                </div>
                <div
                  className={`text-xs font-semibold ${
                    printEdition === 'dark' ? 'text-[#F4F4F0]' : 'text-zinc-800'
                  }`}
                >
                  Sin bajar ninguna app · Sumás tu sello en segundos
                </div>
              </div>

              {/* 4. Pie de Firma Oficial Toque */}
              <div className="pt-4 flex items-center justify-between text-xs">
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
            /* FORMATO 2: STICKER NFC CUADRADO 10x10CM (SIN PREMIO FIJO) */
            <div
              style={{
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact',
              }}
              className={`w-full max-w-[360px] aspect-square print:w-[100mm] print:h-[100mm] rounded-[28px] p-6 flex flex-col justify-between text-center relative overflow-hidden shadow-2xl border-2 ${
                printEdition === 'dark'
                  ? 'bg-[#0C0C0E] text-[#F4F4F0] border-[#D95B26]'
                  : 'bg-white text-[#0C0C0E] border-[#0C0C0E]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-sm font-extrabold leading-none">{merchantName}</p>
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

              <div className="my-2 flex items-center justify-center gap-4">
                <div
                  className={`p-3 rounded-2xl bg-white border-2 ${
                    printEdition === 'dark' ? 'border-[#D95B26]' : 'border-[#0C0C0E]'
                  }`}
                >
                  <RealQrCode value={activeHubUrl} size={140} />
                </div>

                <div className="flex flex-col items-center justify-center space-y-2 max-w-[115px] text-left">
                  <div className="w-10 h-10 rounded-2xl bg-[#D95B26]/15 border border-[#D95B26]/40 text-[#D95B26] flex items-center justify-center">
                    <NfcWavesIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-extrabold leading-tight">
                    Apoyá tu celular o escaneá
                  </p>
                  <p
                    className={`text-[10px] leading-snug ${
                      printEdition === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-600'
                    }`}
                  >
                    Comprobante digital, Club de Sellos y Reseñas
                  </p>
                </div>
              </div>

              <div
                className={`pt-2 border-t flex items-center justify-between text-[10px] ${
                  printEdition === 'dark' ? 'border-[#282830]' : 'border-zinc-200'
                }`}
              >
                <span className="font-bold">Club de Beneficios y Sellos</span>
                <span className="font-mono font-bold text-[#D95B26]">● toque</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
