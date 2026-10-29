import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Factory,
  Plus,
  QrCode,
  Download,
  ExternalLink,
  CheckCircle2,
  Package,
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
  Layers,
  Tag,
} from 'lucide-react';
import QRCode from 'qrcode';
import { api, Cartel } from '../../api';

export const ManufacturerView: React.FC = () => {
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Batch generator state
  const [batchPrefix, setBatchPrefix] = useState('TQ');
  const [batchQuantity, setBatchQuantity] = useState(5);
  const [batchRole, setBatchRole] = useState<'caja' | 'mostrador' | 'mesa' | 'resena'>('caja');
  const [batchTileColor, setBatchTileColor] = useState<'black' | 'white'>('black');
  const [batchMode, setBatchMode] = useState<'sin_activar' | 'active'>('sin_activar');
  const [batchTargetUrl, setBatchTargetUrl] = useState('https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4');
  const [selectedQrCartel, setSelectedQrCartel] = useState<Cartel | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!selectedQrCartel) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(`${window.location.origin}/r/${selectedQrCartel.code}`, {
      width: 220,
      margin: 1,
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [selectedQrCartel]);

  const loadCarteles = async () => {
    setLoading(true);
    try {
      const list = await api.listCarteles();
      setCarteles(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCarteles();
  }, []);

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFeedback(null);
    try {
      const qty = Math.max(1, Math.min(50, Number(batchQuantity) || 1));
      const cleanPrefix = (batchPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TQ').slice(0, 6);
      const createdCodes: string[] = [];

      for (let i = 0; i < qty; i++) {
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        const code = `${cleanPrefix}-${randSuffix}`;
        const pin = String(Math.floor(1000 + Math.random() * 9000));
        await api.createCartelForBusiness({
          code,
          name:
            batchMode === 'sin_activar'
              ? `Placa virgen ${code}`
              : `Cartel ${batchRole === 'resena' ? 'Reseñas' : 'Hub'} ${code}`,
          location:
            batchRole === 'caja'
              ? 'Caja principal'
              : batchRole === 'mostrador'
              ? 'Mostrador'
              : batchRole === 'mesa'
              ? 'Salón / Mesas'
              : 'Entrada / Reseñas',
          reviewUrl: batchMode === 'active' ? batchTargetUrl.trim() : '',
          status: batchMode,
          role: batchRole,
          tileColor: batchTileColor,
          pin,
          activationPin: pin,
        });
        createdCodes.push(code);
      }

      await loadCarteles();
      setFeedback(
        `Se fabricaron ${createdCodes.length} placas (${createdCodes.slice(0, 4).join(', ')}${
          createdCodes.length > 4 ? '...' : ''
        }) listas para grabado NFC y QR.`
      );
    } finally {
      setCreating(false);
    }
  };

  const handleExportCsv = () => {
    const origin = window.location.origin;
    const headers = ['Codigo', 'PIN_Activacion', 'Estado', 'Rol', 'Color_Placa', 'URL_Grabacion_NFC_QR', 'URL_Activacion'];
    const rows = carteles.map((c) => [
      c.code,
      c.activationPin || '1234',
      c.status,
      c.role || 'caja',
      c.tileColor || 'black',
      `${origin}/r/${c.code}`,
      `${origin}/activar/${c.code}`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lote-placas-toque-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyUrl = (code: string) => {
    const url = `${window.location.origin}/r/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const unactivatedCount = carteles.filter((c) => c.status === 'sin_activar').length;
  const activeCount = carteles.filter((c) => c.status === 'active').length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F2] font-sans pb-16">
      <header className="border-b border-[#242424] bg-[#141414]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D95B26]/15 border border-[#D95B26]/30 flex items-center justify-center text-[#D95B26]">
              <Factory size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Panel de fabricante Toque</h1>
              <p className="text-xs text-[#9E9B95]">Producción de lotes QR + NFC, códigos vírgenes, reseñas y activación</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/panel/carteles"
              className="px-3.5 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#242424] border border-[#242424] text-xs font-semibold text-[#F5F5F2] transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Panel del comercio
            </Link>
            <Link
              to="/activar"
              className="px-3.5 py-2 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={14} />
              Probar activación
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Resumen de producción */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-5">
            <div className="flex items-center justify-between text-[#9E9B95] mb-2">
              <span className="text-xs font-medium">Total de placas fabricadas</span>
              <Layers size={16} className="text-[#D95B26]" />
            </div>
            <p className="text-2xl font-bold text-white">{carteles.length}</p>
            <p className="text-xs text-[#9E9B95] mt-1">Compatibles con Hub, Club, POS y Reseñas</p>
          </div>

          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-5">
            <div className="flex items-center justify-between text-[#9E9B95] mb-2">
              <span className="text-xs font-medium">Placas vírgenes (listas para vender)</span>
              <Package size={16} className="text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-white">{unactivatedCount}</p>
            <p className="text-xs text-[#9E9B95] mt-1">Al escanear abren el flujo de activación del comercio</p>
          </div>

          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-5">
            <div className="flex items-center justify-between text-[#9E9B95] mb-2">
              <span className="text-xs font-medium">Placas activas en comercios</span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white">{activeCount}</p>
            <p className="text-xs text-[#9E9B95] mt-1">Vinculadas a Hub o link directo de reseñas</p>
          </div>
        </div>

        {/* Generador de lote */}
        <div className="bg-[#141414] border border-[#242424] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Fabricar nuevo lote de carteles QR / NFC</h2>
              <p className="text-sm text-[#9E9B95]">
                Generá códigos únicos con PIN de activación para grabar en chips NTAG213 o imprimir en acrílico.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2.5 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] border border-[#2E2E2E] text-xs font-semibold text-white flex items-center gap-2 self-start sm:self-auto transition-colors"
            >
              <Download size={15} />
              Exportar lote para grabado (CSV)
            </button>
          </div>

          {feedback && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 size={16} className=" shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <form onSubmit={handleGenerateBatch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#9E9B95] mb-1.5">Prefijo de serie</label>
              <input
                type="text"
                value={batchPrefix}
                onChange={(e) => setBatchPrefix(e.target.value)}
                maxLength={6}
                placeholder="TQ"
                className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-[#242424] rounded-xl text-sm text-white focus:outline-none focus:border-[#D95B26]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9E9B95] mb-1.5">Cantidad de placas</label>
              <input
                type="number"
                min={1}
                max={50}
                value={batchQuantity}
                onChange={(e) => setBatchQuantity(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-[#242424] rounded-xl text-sm text-white focus:outline-none focus:border-[#D95B26]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9E9B95] mb-1.5">Función predeterminada</label>
              <select
                value={batchRole}
                onChange={(e) => setBatchRole(e.target.value as 'caja' | 'mostrador' | 'mesa' | 'resena')}
                className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-[#242424] rounded-xl text-sm text-white focus:outline-none focus:border-[#D95B26]"
              >
                <option value="caja">Caja (Hub + Recibo + Club + Reseñas)</option>
                <option value="mostrador">Mostrador (Hub + Club + Reseñas)</option>
                <option value="mesa">Mesa / Salón (Catálogo + Reseñas)</option>
                <option value="resena">Solo Reseñas de Google Maps</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9E9B95] mb-1.5">Acabado físico</label>
              <select
                value={batchTileColor}
                onChange={(e) => setBatchTileColor(e.target.value as 'black' | 'white')}
                className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-[#242424] rounded-xl text-sm text-white focus:outline-none focus:border-[#D95B26]"
              >
                <option value="black">Acrílico Negro Mate</option>
                <option value="white">Acrílico Blanco Marfil</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9E9B95] mb-1.5">Estado de fábrica</label>
              <select
                value={batchMode}
                onChange={(e) => setBatchMode(e.target.value as 'sin_activar' | 'active')}
                className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-[#242424] rounded-xl text-sm text-white focus:outline-none focus:border-[#D95B26]"
              >
                <option value="sin_activar">Virgen (el comercio lo activa)</option>
                <option value="active">Pre-activado para el comercio actual</option>
              </select>
            </div>

            {batchMode === 'active' && (
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-medium text-[#9E9B95] mb-1.5">
                  Link de Google Maps Reseñas asignado (opcional, si el comercio ya lo informó)
                </label>
                <input
                  type="url"
                  value={batchTargetUrl}
                  onChange={(e) => setBatchTargetUrl(e.target.value)}
                  placeholder="https://g.page/r/.../review"
                  className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-[#242424] rounded-xl text-sm text-white focus:outline-none focus:border-[#D95B26]"
                />
              </div>
            )}

            <div className={batchMode === 'active' ? 'sm:col-span-2 lg:col-span-1 flex items-end' : 'sm:col-span-2 lg:col-span-5 flex justify-end'}>
              <button
                type="submit"
                disabled={creating}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#ea6730] disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={16} />
                {creating ? 'Fabricando...' : 'Generar lote de placas'}
              </button>
            </div>
          </form>
        </div>

        {/* Tabla de placas */}
        <div className="bg-[#141414] border border-[#242424] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[#242424] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Inventario de carteles y chips NFC</h3>
              <p className="text-xs text-[#9E9B95]">
                Cada placa apunta a <span className="text-white font-mono">/r/CODIGO</span>. Si está virgen redirige automáticamente a <span className="text-white font-mono">/activar/CODIGO</span>.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[#9E9B95]">Cargando inventario de placas...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#242424] text-xs text-[#9E9B95] bg-[#0A0A0A]/60">
                    <th className="py-3.5 px-4 font-semibold">Código y PIN</th>
                    <th className="py-3.5 px-4 font-semibold">Nombre / Ubicación</th>
                    <th className="py-3.5 px-4 font-semibold">Rol</th>
                    <th className="py-3.5 px-4 font-semibold">Estado</th>
                    <th className="py-3.5 px-4 font-semibold">Escaneos</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242424] text-sm">
                  {carteles.map((c) => (
                    <tr key={c.id} className="hover:bg-[#1B1B1B]/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white">{c.code}</div>
                        <div className="text-xs text-[#9E9B95]">PIN: {c.activationPin || '1234'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{c.name}</div>
                        <div className="text-xs text-[#9E9B95]">{c.location}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1F1F1F] text-[#D5D2CD] border border-[#2C2C2C]">
                          <Tag size={12} className="text-[#D95B26]" />
                          {c.role === 'resena'
                            ? 'Solo reseñas'
                            : c.role === 'mesa'
                            ? 'Mesa'
                            : c.role === 'mostrador'
                            ? 'Mostrador'
                            : 'Caja / Hub'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {c.status === 'sin_activar' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                            Virgen (Sin activar)
                          </span>
                        ) : c.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/25">
                            Pausado
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">{c.scans || 0}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedQrCartel(c)}
                            className="p-2 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#F5F5F2] transition-colors"
                            title="Ver QR para impresión"
                          >
                            <QrCode size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(c.code)}
                            className="p-2 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#F5F5F2] transition-colors"
                            title="Copiar link de grabación NFC"
                          >
                            {copiedCode === c.code ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                          </button>
                          <Link
                            to={c.status === 'sin_activar' ? `/activar/${c.code}` : `/r/${c.code}`}
                            className="px-2.5 py-1.5 rounded-lg bg-[#D95B26]/15 hover:bg-[#D95B26]/25 text-[#D95B26] text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <span>{c.status === 'sin_activar' ? 'Activar' : 'Abrir'}</span>
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal QR */}
      {selectedQrCartel && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedQrCartel(null)}
        >
          <div
            className="bg-[#141414] border border-[#242424] rounded-3xl max-w-sm w-full p-6 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#9E9B95]">Placa física Toque</span>
              <span className="font-mono text-xs font-bold text-[#D95B26]">{selectedQrCartel.code}</span>
            </div>
            <div className="bg-white p-5 rounded-2xl inline-block mx-auto">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR ${selectedQrCartel.code}`} className="w-[200px] h-[200px]" />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center text-xs text-black">
                  Generando QR...
                </div>
              )}
            </div>
            <div>
              <p className="text-base font-bold text-white">{selectedQrCartel.name}</p>
              <p className="text-xs text-[#9E9B95] mt-1">
                PIN de activación impreso en dorso: <strong className="text-white">{selectedQrCartel.activationPin || '1234'}</strong>
              </p>
            </div>
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedQrCartel(null)}
                className="w-full py-2.5 rounded-xl bg-[#242424] hover:bg-[#2E2E2E] text-white text-xs font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
