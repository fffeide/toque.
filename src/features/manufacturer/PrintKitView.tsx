/**
 * Toque — Kit de Impresión para Fabricante (PrintKitView)
 * Cumple con los requerimientos 6 y 7:
 * - Vista y PDF de QR listo para imprimir con código legible.
 * - Sin selector de tamaño en la plancha (tamaño estandarizado óptimo).
 * - Sin guía de grabación de chips NFC.
 * - Exportación de CSV con URLs directas activas.
 */

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { QRPreview } from '../../components/ui/QRPreview';
import { Cartel, Tenant } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import { getShortUrl, getShortUrlDisplay } from '../../lib/urls';
import {
  Printer,
  Download,
  FileSpreadsheet,
  Check,
} from 'lucide-react';

interface PrintKitViewProps {
  carteles: Cartel[];
  businesses: Tenant[];
}

export const PrintKitView: React.FC<PrintKitViewProps> = ({ carteles, businesses }) => {
  const { success } = useToast();
  const [selectedCartelId, setSelectedCartelId] = useState<string>(carteles[0]?.id || '');

  const selectedCartel = carteles.find((s) => s.id === selectedCartelId) || carteles[0];
  const shortUrl = selectedCartel ? getShortUrl(selectedCartel.shortCode) : '';

  // Descargar CSV con URLs
  const handleExportNfcCsv = () => {
    const headers = 'Nombre Cartel,Negocio,Codigo Corto,URL Dinámica,Fecha\n';
    const rows = carteles
      .map((s) => {
        const biz = businesses.find((b) => b.id === s.businessId)?.name || 'Negocio';
        return `"${s.name}","${biz}","${s.shortCode}","${getShortUrl(s.shortCode)}","${s.createdAt || ''}"`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `toque_carteles_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('CSV descargado', 'Listado de enlaces generado correctamente.');
  };

  const handlePrint = () => {
    window.print();
  };

  if (carteles.length === 0) {
    return (
      <Card className="p-8 text-center space-y-3">
        <Printer className="w-8 h-8 text-white/40 mx-auto" />
        <h3 className="font-headline text-base font-bold text-white">
          Aún no tenés carteles para imprimir
        </h3>
        <p className="text-xs text-white/60 max-w-sm mx-auto">
          Generá tu primer cartel con el enlace de Google Maps para previsualizar la plancha de impresión.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* CABECERA Y ACCIONES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-xl font-bold text-white">
            Kit de Impresión de Carteles
          </h2>
          <p className="text-xs text-white/70 mt-0.5">
            Descargá la plancha de corte para imprimir en alta resolución o exportá la lista de enlaces en CSV.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            onClick={handleExportNfcCsv}
            icon={<FileSpreadsheet className="w-4 h-4 text-white" />}
          >
            Exportar CSV ({carteles.length})
          </Button>
          <Button
            variant="primary"
            onClick={handlePrint}
            icon={<Printer className="w-4 h-4 text-slate-900" />}
            className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
          >
            Imprimir Plancha
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-6 space-y-5 bg-white/10 border-white/20 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-small font-semibold text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-cyan-300" />
              <span>Plancha de Impresión</span>
            </h3>
            <span className="text-micro text-white/60 font-mono">
              Formato estándar 5 x 5 cm
            </span>
          </div>

          {/* Selector de cartel */}
          <div>
            <label className="block text-xs font-medium text-white/80 mb-1.5">
              Elegir cartel para previsualizar:
            </label>
            <select
              value={selectedCartelId}
              onChange={(e) => setSelectedCartelId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-white/25 bg-[#0d1b2e] text-white text-xs focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 cursor-pointer font-medium"
            >
              {carteles.map((s) => {
                const biz = businesses.find((b) => b.id === s.businessId)?.name || 'Directo';
                return (
                  <option key={s.id} value={s.id} className="bg-[#0b1728] text-white py-2">
                    {s.name} ({s.code || s.shortCode}) — {biz}
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
                {selectedCartel?.name || 'Cartel Físico'}
              </p>
            </div>

            <div className="p-3 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center w-48 h-48">
              <QRPreview
                url={shortUrl}
                size={160}
              />
            </div>

            {/* Código corto visible y legible debajo */}
            <div className="text-center space-y-0.5">
              <span className="font-mono text-small font-bold text-slate-900 tracking-wider">
                {getShortUrlDisplay(selectedCartel?.shortCode || '')}
              </span>
              <p className="text-[11px] text-slate-500">
                Acercá tu celular al logo o escaneá el QR con tu cámara
              </p>
            </div>

            <div className="text-[9px] text-slate-400 font-mono pt-2 border-t border-slate-200 w-full text-center">
              Corte sugerido: 50 x 50 mm • Margen seguro: 4 mm
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
