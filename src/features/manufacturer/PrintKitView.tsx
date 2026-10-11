/**
 * Toque — Kit de Impresión y Grabación de Chips (PrintKitView)
 * Características:
 * - PDF / Vista de QR listo para imprimir en varios tamaños (2.5 cm mesa, 5 cm mostrador, 10 cm vidriera)
 *   con código corto legible debajo (ej. toque.ar/k7m2p).
 * - CSV con las URLs para grabar chips NFC en lote.
 * - Guía física de 1 página para grabadores (chip NTAG215, app NFC Tools, protocolo iPhone/Android).
 */

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { QRPreview } from '../../components/ui/QRPreview';
import { Cartel, Tenant } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import {
  Printer,
  Download,
  FileSpreadsheet,
  Cpu,
  Smartphone,
  ShieldCheck,
  Check,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';

interface PrintKitViewProps {
  carteles: Cartel[];
  businesses: Tenant[];
}

export const PrintKitView: React.FC<PrintKitViewProps> = ({ carteles, businesses }) => {
  const { success } = useToast();
  const [selectedCartelId, setSelectedCartelId] = useState<string>(carteles[0]?.id || '');
  const [selectedSize, setSelectedSize] = useState<'sm' | 'md' | 'lg'>('md');

  const selectedCartel = carteles.find((s) => s.id === selectedCartelId) || carteles[0];
  const shortUrl = selectedCartel ? `https://toque.ar/${selectedCartel.shortCode}` : 'https://toque.ar/demo';

  // Descargar CSV con URLs para grabar chips
  const handleExportNfcCsv = () => {
    const headers = 'Nombre Cartel,Negocio,Codigo Corto,URL NDEF (Chip NFC),Fecha\n';
    const rows = carteles
      .map((s) => {
        const biz = businesses.find((b) => b.id === s.businessId)?.name || 'Negocio';
        return `"${s.name}","${biz}","${s.shortCode}","https://toque.ar/${s.shortCode}","${s.createdAt || ''}"`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `toque_urls_chips_nfc_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    success('Archivo CSV descargado', 'Listo para importar en NFC Tools o grabadores industriales.');
  };

  const handlePrintSheet = () => {
    window.print();
    success('Preparando impresión', 'Enviá a tu impresora o guardá como PDF.');
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-title-2 font-bold text-[var(--text-main)]">
            Kit de Impresión y Grabación de Chips
          </h2>
          <p className="text-small text-[var(--text-muted)] mt-0.5">
            Archivos listos para producción física de carteles acrílicos, madera o metal.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            onClick={handleExportNfcCsv}
            icon={<FileSpreadsheet className="w-4 h-4 text-[var(--brand)]" />}
          >
            Descargar CSV para Chips NFC
          </Button>

          <Button
            variant="primary"
            onClick={handlePrintSheet}
            icon={<Printer className="w-4 h-4" />}
          >
            Imprimir Plantilla / Guardar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: GENERADOR Y VISTA PREVIA IMPRIMIBLE DE QR */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
                <Printer className="w-4 h-4 text-[var(--brand)]" />
                <span>Generador de Plancha de Impresión</span>
              </h3>

              {/* Selector de tamaño */}
              <div className="flex items-center gap-1 p-0.5 bg-black/5 dark:bg-white/5 rounded-lg border border-[var(--border-subtle)] text-micro">
                <button
                  type="button"
                  onClick={() => setSelectedSize('sm')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    selectedSize === 'sm' ? 'bg-[var(--bg-card)] font-semibold shadow-xs' : 'text-[var(--text-muted)]'
                  }`}
                >
                  2,5 cm (Mesa)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSize('md')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    selectedSize === 'md' ? 'bg-[var(--bg-card)] font-semibold shadow-xs' : 'text-[var(--text-muted)]'
                  }`}
                >
                  5 cm (Mostrador)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSize('lg')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    selectedSize === 'lg' ? 'bg-[var(--bg-card)] font-semibold shadow-xs' : 'text-[var(--text-muted)]'
                  }`}
                >
                  10 cm (Vidriera)
                </button>
              </div>
            </div>

            {/* Selector de cartel */}
            <div>
              <label className="block text-small font-medium text-[var(--text-main)] mb-1">
                Elegir cartel para previsualizar:
              </label>
              <select
                value={selectedCartelId}
                onChange={(e) => setSelectedCartelId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-white/25 bg-[#0d1b2e] text-white text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 cursor-pointer font-medium"
              >
                {carteles.map((s) => {
                  const biz = businesses.find((b) => b.id === s.businessId)?.name || 'Negocio';
                  return (
                    <option key={s.id} value={s.id} className="bg-[#0b1728] text-white py-2">
                      {biz} — {s.name} ({s.shortCode})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Muestra imprimible estilo plancha física */}
            <div className="printable-sheet p-8 rounded-2xl bg-white text-slate-900 border border-slate-300 shadow-sm flex flex-col items-center justify-center space-y-4 print:p-0 print:border-none">
              <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                  Toque • Cartel NFC + QR
                </span>
                <p className="font-display text-small font-bold text-slate-900">
                  {selectedCartel?.name || 'Mesa 4 — Salón'}
                </p>
              </div>

              <div
                className={`p-3 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center ${
                  selectedSize === 'sm' ? 'w-32 h-32' : selectedSize === 'md' ? 'w-48 h-48' : 'w-64 h-64'
                }`}
              >
                <QRPreview
                  url={shortUrl}
                  size={selectedSize === 'sm' ? 100 : selectedSize === 'md' ? 150 : 210}
                />
              </div>

              {/* Código corto visible y legible debajo */}
              <div className="text-center space-y-0.5">
                <span className="font-mono text-small font-bold text-slate-900 tracking-wider">
                  toque.ar/{selectedCartel?.shortCode || 'k7m2p'}
                </span>
                <p className="text-[11px] text-slate-500">
                  Acercá tu celular al logo o escaneá el QR con tu cámara
                </p>
              </div>

              <div className="text-[9px] text-slate-400 font-mono pt-2 border-t border-slate-200 w-full text-center">
                Corte sugerido: {selectedSize === 'sm' ? '25 x 25 mm' : selectedSize === 'md' ? '50 x 50 mm' : '100 x 100 mm'} • Margen seguro: 4 mm
              </div>
            </div>
          </Card>
        </div>

        {/* COLUMNA DERECHA: GUÍA DE 1 PÁGINA PARA GRABAR CHIPS */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-6 space-y-4 bg-[var(--bg-card)]">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[var(--brand)]" />
              <h3 className="font-display text-small font-semibold text-[var(--text-main)]">
                Guía de 1 Página para Grabar Chips NFC
              </h3>
            </div>
            <p className="text-micro text-[var(--text-muted)] leading-relaxed">
              Procedimiento estándar de taller para garantizar que el 100% de los chips funcionen en iPhone y Android sin fallas.
            </p>

            <div className="space-y-3 pt-1 text-small">
              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] space-y-1">
                <span className="font-semibold text-micro text-[var(--brand)] uppercase tracking-wider block">
                  1. Chip Recomendado
                </span>
                <p className="text-micro text-[var(--text-main)]">
                  Utilizá chips <strong className="font-semibold">NTAG215</strong> o <strong className="font-semibold">NTAG213</strong> autoadhesivos anti-metal si el cartel tiene base metálica.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] space-y-1">
                <span className="font-semibold text-micro text-[var(--brand)] uppercase tracking-wider block">
                  2. Aplicación de Grabación
                </span>
                <p className="text-micro text-[var(--text-main)]">
                  Descargá gratis <strong className="font-semibold">NFC Tools</strong> (iOS / Android) o usá lectores USB ACR122U en computadora.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] space-y-1">
                <span className="font-semibold text-micro text-[var(--brand)] uppercase tracking-wider block">
                  3. Parámetros NDEF
                </span>
                <p className="text-micro text-[var(--text-main)]">
                  Tipo de registro: <code className="bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[11px]">URI (https://)</code>. Copiá la URL corta de cada cartel (ej. <code className="font-mono text-[11px]">toque.ar/{selectedCartel?.shortCode || 'k7m2p'}</code>).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] space-y-1">
                <span className="font-semibold text-micro text-[var(--menta)] uppercase tracking-wider block">
                  4. Protocolo de Prueba Infalible
                </span>
                <p className="text-micro text-[var(--text-main)]">
                  • <strong>iPhone (iOS):</strong> Acercá la parte superior del celular. Debe saltar notificación Safari sin abrir ninguna app.<br/>
                  • <strong>Android:</strong> Acercá el centro de la espalda. Debe abrir el navegador inmediatamente.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--estrella)]/10 border border-[var(--estrella)]/30 text-micro text-[var(--text-main)] flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[var(--estrella)] shrink-0 mt-0.5" />
              <span>
                <strong>Regla de oro:</strong> Nunca bloquees el chip en modo "solo lectura" hasta haber comprobado físicamente que el enlace abra la ficha correcta.
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
