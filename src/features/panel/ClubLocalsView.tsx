import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { ClubLocal, ClubConfig } from '../../api/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MapPin, Printer, Copy, Check, Plus, Navigation, Store, QrCode } from 'lucide-react';

// Generador SVG determinístico de matriz QR limpia para el cartel
const SimpleQrSvg: React.FC<{ value: string; size?: number }> = ({ value, size = 180 }) => {
  const cells = 15;
  const seed = Array.from(value).reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1), 0);

  const isFinder = (r: number, c: number) => {
    const inTopLeft = r < 4 && c < 4;
    const inTopRight = r < 4 && c >= cells - 4;
    const inBottomLeft = r >= cells - 4 && c < 4;
    return inTopLeft || inTopRight || inBottomLeft;
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cells} ${cells}`}
      className="block mx-auto"
      aria-label={`Código QR para ${value}`}
    >
      <rect width={cells} height={cells} fill="#ffffff" />
      {Array.from({ length: cells }).map((_, r) =>
        Array.from({ length: cells }).map((__, c) => {
          if (isFinder(r, c)) {
            const isBorder =
              r === 0 ||
              r === 3 ||
              c === 0 ||
              c === 3 ||
              r === cells - 1 ||
              r === cells - 4 ||
              c === cells - 1 ||
              c === cells - 4;
            const isCenter =
              (r >= 1 && r <= 2 && c >= 1 && c <= 2) ||
              (r >= 1 && r <= 2 && c >= cells - 3 && c <= cells - 2) ||
              (r >= cells - 3 && r <= cells - 2 && c >= 1 && c <= 2);
            return isBorder || isCenter ? (
              <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0c0c0c" />
            ) : null;
          }
          const bit = (seed + r * 31 + c * 17) % 3 === 0;
          return bit ? (
            <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0c0c0c" />
          ) : null;
        })
      )}
    </svg>
  );
};

export const ClubLocalsView: React.FC = () => {
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [printLocal, setPrintLocal] = useState<ClubLocal | null>(null);

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
      const [localsData, clubCfg] = await Promise.all([
        api.listLocals(),
        api.getClubConfig(),
      ]);
      setLocals(localsData);
      setConfig(clubCfg);
      if (localsData.length > 0 && !printLocal) {
        setPrintLocal(localsData[0]);
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
        setGeoStatus('Ubicación del local guardada para avisos de cercanía en la billetera.');
      },
      () => {
        setGeoStatus('No pudimos leer la ubicación. Podés guardar el local igual sin coordenadas.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleCreateLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    setSaving(true);
    try {
      await api.createLocal({
        name: name.trim(),
        address: address.trim(),
        lat,
        lng,
      });
      setName('');
      setAddress('');
      setLat(undefined);
      setLng(undefined);
      setGeoStatus('');
      setShowNewForm(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const getLocalClubUrl = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://toque.ar';
    return `${origin}/club/${code}`;
  };

  const handleCopyLink = async (local: ClubLocal) => {
    const url = getLocalClubUrl(local.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(local.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handlePrintCartel = async (local: ClubLocal) => {
    setPrintLocal(local);
    await api.markCartelPrinted();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="print:hidden space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#f1f1ee]">
              Tus locales y Cartel QR
            </h1>
            <p className="text-sm text-[#a1a1aa] mt-1">
              Los clientes suman sellos en cualquiera de tus locales. Cada local tiene su propio Cartel QR para el mostrador.
            </p>
          </div>
          <Button onClick={() => setShowNewForm(!showNewForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar local
          </Button>
        </div>

        {showNewForm && (
          <Card className="p-6">
            <form onSubmit={handleCreateLocal} className="space-y-4">
              <h2 className="text-lg font-bold text-[#f1f1ee]">Nuevo local</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#e4e4e7] mb-1.5">
                    Nombre del local
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Sucursal Palermo"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] text-sm focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#e4e4e7] mb-1.5">
                    Dirección
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ej: Av. Santa Fe 3200, CABA"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] text-sm focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="space-y-1">
                  <Button type="button" variant="secondary" onClick={handleUseCurrentLocation}>
                    <Navigation className="w-4 h-4 mr-2" />
                    Usar mi ubicación actual (opcional)
                  </Button>
                  <p className="text-xs text-[#a1a1aa]">
                    Sirve para que la billetera del celular muestre la tarjeta cuando el cliente pase cerca del local.
                  </p>
                  {geoStatus && (
                    <p className="text-xs font-bold text-[#2fb36a]">{geoStatus}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowNewForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar local'}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <Card className="p-8 text-center text-[#a1a1aa]">Cargando locales...</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {locals.map((loc) => {
              const clubUrl = getLocalClubUrl(loc.code);
              return (
                <Card
                  key={loc.id}
                  className="p-6 flex flex-col justify-between gap-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Store className="w-5 h-5 text-[#bec8ff]" />
                        <h3 className="text-xl font-bold text-[#f1f1ee]">
                          {loc.name}
                        </h3>
                      </div>
                      <p className="text-sm text-[#a1a1aa] flex items-center gap-1">
                        <MapPin className="w-4 h-4 shrink-0" />
                        {loc.address}
                      </p>
                      <p className="text-xs font-mono font-bold text-[#bec8ff] pt-1">
                        Código de Cartel: {loc.code}
                      </p>
                    </div>

                    <div className="p-2 bg-white rounded-xl border border-[#242426] shrink-0">
                      <SimpleQrSvg value={clubUrl} size={76} />
                    </div>
                  </div>

                  {/* Métricas del local */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#242426] text-center">
                    <div className="stat-card p-2.5 rounded-xl bg-[#18181b] border border-[#28282a]">
                      <div className="text-lg font-extrabold text-[#f1f1ee]">
                        {loc.visitsCount}
                      </div>
                      <div className="stat-detail text-xs text-[#a1a1aa]">Visitas</div>
                    </div>
                    <div className="stat-card p-2.5 rounded-xl bg-[#18181b] border border-[#28282a]">
                      <div className="text-lg font-extrabold text-[#f1f1ee]">
                        {loc.newMembersCount}
                      </div>
                      <div className="stat-detail text-xs text-[#a1a1aa]">Clientes</div>
                    </div>
                    <div className="stat-card p-2.5 rounded-xl bg-[#18181b] border border-[#28282a]">
                      <div className="text-lg font-extrabold text-[#f1f1ee]">
                        {loc.rewardsRedeemedCount}
                      </div>
                      <div className="stat-detail text-xs text-[#a1a1aa]">Premios</div>
                    </div>
                  </div>

                  {/* Acciones del cartel */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => handlePrintCartel(loc)}
                      className="flex-1"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir cartel (A5)
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleCopyLink(loc)}
                    >
                      {copiedId === loc.id ? (
                        <>
                          <Check className="w-4 h-4 mr-2 text-[#2fb36a]" />
                          Link copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar link
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Plantilla limpia A5 lista para imprimir */}
      {printLocal && (
        <div className="bg-white text-[#0c0c0c] border-2 border-[#242426] rounded-3xl p-8 max-w-md mx-auto text-center space-y-6 print:border-4 print:border-black print:shadow-none print:max-w-none print:w-[148mm] print:min-h-[210mm] print:mx-auto print:flex print:flex-col print:justify-between print:p-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#111113] text-[#f1f1ee] text-xs font-bold uppercase tracking-wider">
              <QrCode className="w-3.5 h-3.5" />
              Club de clientes · {printLocal.name}
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0c0c0c]">
              {config?.name || config?.clubName || 'Musical Monroe'}
            </h2>
            <p className="text-base font-medium text-zinc-700">
              Escaneá con la cámara de tu celular y sumá sellos en cada visita.
            </p>
          </div>

          <div className="my-4 inline-block p-5 bg-white border-4 border-[#0c0c0c] rounded-2xl mx-auto">
            <SimpleQrSvg value={getLocalClubUrl(printLocal.code)} size={210} />
          </div>

          <div className="space-y-2 bg-[#f4f4f5] border-2 border-[#0c0c0c] rounded-2xl p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              Tu premio al completar {config?.targetStamps || 10} sellos
            </div>
            <div className="text-2xl font-extrabold text-[#0c0c0c]">
              {config?.rewardText || config?.welcomeBenefitText || 'Beneficio exclusivo en instrumentos y accesorios'}
            </div>
          </div>

          <div className="text-xs text-zinc-600 font-medium pt-2">
            Sin bajar ninguna app · Guardás tu tarjeta en el celular en 15 segundos
          </div>
        </div>
      )}
    </div>
  );
};
