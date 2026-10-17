import React, { useState, useEffect } from 'react';
import { api, CartelBatch } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/formatters';
import { Link } from 'react-router-dom';
import {
  Layers,
  Plus,
  ArrowLeft,
  FileSpreadsheet,
} from 'lucide-react';

export const BatchAdminView: React.FC = () => {
  const [batches, setBatches] = useState<CartelBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generateCount, setGenerateCount] = useState('5');
  const [isGenerating, setIsGenerating] = useState(false);
  const { success, error: toastError } = useToast();

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const list = await api.listCartelBatch();
      setBatches(list);
    } catch {
      // Ignorar
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(generateCount, 10);
    if (isNaN(count) || count <= 0 || count > 100) {
      toastError('Ingresá una cantidad entre 1 y 100');
      return;
    }

    setIsGenerating(true);
    try {
      const newBatch = await api.createCartelBatch({ count });
      success('Lote generado con éxito', `Se crearon ${count} carteles con código corto y PIN interior.`);
      loadBatches();
    } catch (err) {
      toastError('No pudimos generar el lote', err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportCsv = (batch: CartelBatch) => {
    // Formato CSV estándar: código, PIN, URL corta, estado
    const header = 'Codigo,PIN,URL_Corta,Estado\n';
    const rows = batch.carteles
      .map(c => `"${c.code}","${c.pin}","${c.shortUrl}","${c.status}"`)
      .join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + rows);

    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `lote-toque-${batch.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    success('CSV descargado', `Exportaste el lote ${batch.id} para producción.`);
  };

  return (
    <div className="aurora-stage min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/panel"
              className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition shadow-xs"
              title="Volver al panel"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-2xl text-white">
                  Lotes de Producción (Fabricante)
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FFC21A]/20 text-[#FFC21A] px-2.5 py-0.5 rounded-full border border-[#FFC21A]/40">
                  Taller Toque
                </span>
              </div>
              <p className="text-xs text-white/70 mt-0.5">
                Generá partidas de carteles con PIN secreto para impresión y exportación CSV.
              </p>
            </div>
          </div>
        </div>

        {/* Formulario de Generación */}
        <Card className="p-5 sm:p-6 space-y-3">
          <h2 className="font-display font-bold text-base text-white">
            Generar nueva partida de carteles
          </h2>
          <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-xs font-semibold text-white/80 mb-1" htmlFor="cnt">
                Cantidad de soportes a fabricar
              </label>
              <input
                id="cnt"
                type="number"
                min={1}
                max={100}
                required
                value={generateCount}
                onChange={(e) => setGenerateCount(e.target.value)}
                placeholder="Ej. 10"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-white placeholder-white/40 focus:bg-white/15 focus:outline-none"
              />
            </div>

            <Button
              type="submit"
              variant="estrella"
              size="touch"
              disabled={isGenerating}
              icon={<Plus className="w-4 h-4 text-[#0B1030]" />}
              className="w-full sm:w-auto"
            >
              {isGenerating ? 'Generando…' : 'Generar lote'}
            </Button>
          </form>
        </Card>

        {/* Listado de Lotes */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-44 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <Card className="text-center py-12 text-xs text-white/60">
            Todavía no generaste lotes de carteles.
          </Card>
        ) : (
          <div className="space-y-4">
            {batches.map((batch) => (
              <Card key={batch.id} className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/15">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-white">
                        {batch.id}
                      </span>
                      <span className="text-xs text-white/70">
                        · {batch.count} unidades fabricadas
                      </span>
                    </div>
                    <span className="text-[11px] text-white/50">
                      {formatDate(batch.createdAt)}
                    </span>
                  </div>

                  <Button
                    variant="secundario"
                    size="sm"
                    onClick={() => handleExportCsv(batch)}
                    icon={<FileSpreadsheet className="w-4 h-4 text-[#FFC21A]" />}
                    className="bg-white/10 text-white border-white/20 hover:bg-white/15"
                  >
                    Exportar CSV de Impresión
                  </Button>
                </div>

                {/* Previsualización de Carteles del Lote */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {batch.carteles.map(c => (
                    <div
                      key={c.code}
                      className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-between text-white"
                    >
                      <div>
                        <span className="cartel-code font-bold text-white block">
                          {c.code}
                        </span>
                        <span className="text-[10px] text-white/60">
                          PIN: <strong className="font-mono text-[#FFC21A]">{c.pin}</strong>
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.status === 'active'
                          ? 'bg-[#19C37D]/20 text-[#19C37D] border border-[#19C37D]/30'
                          : 'bg-[#FFC21A]/20 text-[#FFC21A] border border-[#FFC21A]/30'
                      }`}>
                        {c.status === 'active' ? 'Activo' : 'Sin activar'}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
