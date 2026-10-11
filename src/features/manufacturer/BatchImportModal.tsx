/**
 * Toque — Alta Masiva por CSV (BatchImportModal)
 * Características:
 * - Soporte para hasta 500 filas
 * - Plantilla CSV descargable
 * - Validación en línea fila por fila (ej. "Fila 14: El link no es de Google")
 * - Vista previa tabulada y procesamiento en lote
 */

import React, { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { BatchImportRow } from '../../api/types';
import { validateGoogleReviewUrl } from '../../lib/urlValidator';
import { api } from '../../api';
import { useToast } from '../../components/ui/Toast';
import {
  UploadCloud,
  Download,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  manufacturerId: string;
  onImportComplete?: (count: number) => void;
}

const CSV_SAMPLE = `Nombre,Email,Telefono,Rubro,LinkGoogle
Café Tortoni,tortoni@buenosaires.ar,+5491143424328,Gastronomía,https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4
Barbería Palermo,contacto@barberiapalermo.com,+5491148312211,Barbería,https://search.google.com/local/writereview?placeid=ChIJo3vK8r_vspUR7eS1Wc96wM4
Heladería Cadore,info@cadore.com.ar,+5491143746420,Gastronomía,https://maps.app.goo.gl/cadore123
Veterinaria Patas,turnos@patas.com.ar,+5491155443322,Salud,https://ejemplo-no-valido.com/reviews
Pizzería Güerrin,pedidos@guerrin.com.ar,+5491143718141,Gastronomía,https://search.google.com/local/writereview?placeid=ChIJt-VfWv_vspURaN_8m7s-zBw`;

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  manufacturerId,
  onImportComplete,
}) => {
  const { success, error: toastError } = useToast();

  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<BatchImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<{
    created: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_SAMPLE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'toque_plantilla_alta_masiva.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    success('Plantilla descargada', 'Completala en Excel o Google Sheets y pegá o subí el archivo acá.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvText(content);
        parseAndValidateCsv(content);
      }
    };
    reader.readAsText(file);
  };

  const parseAndValidateCsv = (text: string) => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      setParsedRows([]);
      return;
    }

    // Omitir cabecera si empieza con "Nombre"
    const dataLines = lines[0].toLowerCase().includes('nombre') ? lines.slice(1) : lines;

    const rows: BatchImportRow[] = dataLines.slice(0, 500).map((line, idx) => {
      // Manejar comas y comillas básicas
      const parts = line.split(',').map((p) => p.replace(/^"|"$/g, '').trim());
      const name = parts[0] || '';
      const email = parts[1] || '';
      const phone = parts[2] || '';
      const category = parts[3] || 'General';
      const reviewUrl = parts[4] || '';

      const validation = validateGoogleReviewUrl(reviewUrl);
      const rowIdx = idx + 2; // Considerando cabecera en fila 1

      if (!name) {
        return { index: rowIdx, name, email, phone, category, reviewUrl, isValid: false, error: 'Falta el nombre del negocio' };
      }
      if (!email.includes('@')) {
        return { index: rowIdx, name, email, phone, category, reviewUrl, isValid: false, error: 'Email con formato inválido' };
      }
      if (!validation.isValid) {
        return { index: rowIdx, name, email, phone, category, reviewUrl, isValid: false, error: `El link no es de Google: ${validation.error || 'Inválido'}` };
      }

      return {
        index: rowIdx,
        name,
        email,
        phone,
        category,
        reviewUrl: validation.sanitizedUrl || reviewUrl,
        isValid: true,
      };
    });

    setParsedRows(rows);
    setImportSummary(null);
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toastError('Sin filas válidas', 'Corregí los errores antes de procesar el lote.');
      return;
    }

    setIsProcessing(true);
    setProgress(15);

    try {
      setProgress(50);
      const result = await api.batchCreateBusinesses(manufacturerId, validRows);
      setProgress(100);

      setImportSummary({
        created: result.createdCount,
        errors: result.errors,
      });

      success(
        'Lote procesado con éxito',
        `Se crearon ${result.createdCount} negocios con sus carteles físicos y códigos cortos.`
      );

      if (onImportComplete) {
        onImportComplete(result.createdCount);
      }
    } catch (err) {
      toastError('Error al importar lote', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        setCsvText('');
        setParsedRows([]);
        setImportSummary(null);
        onClose();
      }}
      title="Alta Masiva de Negocios por CSV"
      description="Cargá hasta 500 comercios de una sola vez. Cada negocio recibe su cartel inicial, token y código corto."
      size="lg"
    >
      <div className="space-y-5 pt-2">
        {/* Acciones de Plantilla */}
        <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-[var(--brand)] shrink-0" />
            <div>
              <p className="font-semibold text-small text-[var(--text-main)]">
                Plantilla oficial de importación
              </p>
              <p className="text-micro text-[var(--text-muted)]">
                Columnas requeridas: Nombre, Email, Teléfono, Rubro, LinkGoogle.
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadTemplate}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Descargar plantilla CSV
          </Button>
        </div>

        {/* Zona de subida o pegar texto */}
        {!importSummary && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-small font-medium text-[var(--text-main)]">
                Subir archivo CSV o pegar contenido
              </label>
              <label className="text-micro font-medium text-[var(--brand)] hover:underline cursor-pointer flex items-center gap-1">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Examinar archivo...</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                parseAndValidateCsv(e.target.value);
              }}
              placeholder="Pegá las filas de tu CSV acá (ej. Café Tortoni,contacto@tortoni.ar,+5491143424328,Gastronomía,https://search.google.com/...)"
              className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] font-mono text-micro text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]"
            />
          </div>
        )}

        {/* Vista previa y Reporte de Errores Fila por Fila */}
        {parsedRows.length > 0 && !importSummary && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-small">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-[var(--text-main)]">
                  Vista previa ({parsedRows.length} filas detectadas)
                </span>
                <span className="text-micro text-[var(--menta)] font-medium">
                  ✓ {validCount} listas
                </span>
                {invalidCount > 0 && (
                  <span className="text-micro text-[var(--coral)] font-medium">
                    ⚠ {invalidCount} con errores
                  </span>
                )}
              </div>
            </div>

            {/* Listado de errores específicos si hay */}
            {invalidCount > 0 && (
              <div className="p-3.5 rounded-xl bg-[var(--coral)]/10 border border-[var(--coral)]/30 space-y-1.5 max-h-36 overflow-y-auto">
                <div className="text-micro font-semibold text-[var(--coral)] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Reporte de validación fila por fila:</span>
                </div>
                {parsedRows
                  .filter((r) => !r.isValid)
                  .map((r) => (
                    <p key={r.index} className="text-micro text-[var(--text-main)] pl-5">
                      • <strong>Fila {r.index} ({r.name || 'Sin nombre'}):</strong> {r.error}
                    </p>
                  ))}
              </div>
            )}

            {/* Tabla resumida con las primeras 6 filas */}
            <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden max-h-48 overflow-y-auto text-micro">
              <table className="w-full text-left">
                <thead className="bg-black/5 dark:bg-white/5 border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                  <tr>
                    <th className="p-2 w-12 text-center">Fila</th>
                    <th className="p-2">Negocio</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Rubro</th>
                    <th className="p-2 w-28 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {parsedRows.slice(0, 15).map((row) => (
                    <tr key={row.index} className={row.isValid ? '' : 'bg-rose-500/5'}>
                      <td className="p-2 text-center font-mono text-[var(--text-muted)]">{row.index}</td>
                      <td className="p-2 font-medium text-[var(--text-main)] truncate max-w-[140px]">
                        {row.name || '—'}
                      </td>
                      <td className="p-2 text-[var(--text-muted)] truncate max-w-[120px] font-mono">
                        {row.email}
                      </td>
                      <td className="p-2 text-[var(--text-muted)]">{row.category}</td>
                      <td className="p-2 text-center">
                        {row.isValid ? (
                          <span className="text-[var(--menta)] font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Válida
                          </span>
                        ) : (
                          <span className="text-[var(--coral)] font-medium inline-flex items-center gap-1" title={row.error}>
                            <AlertCircle className="w-3.5 h-3.5" /> Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 15 && (
              <p className="text-[11px] text-[var(--text-muted)] text-right">
                Mostrando 15 de {parsedRows.length} filas
              </p>
            )}
          </div>
        )}

        {/* Resumen del Lote Procesado */}
        {importSummary && (
          <div className="p-5 rounded-2xl bg-[var(--menta)]/10 border border-[var(--menta)]/30 space-y-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-[var(--menta)] mx-auto" />
            <h4 className="font-display text-body font-bold text-[var(--text-main)]">
              ¡Importación completada!
            </h4>
            <p className="text-small text-[var(--text-muted)]">
              Se crearon con éxito <strong className="text-[var(--text-main)]">{importSummary.created} negocios</strong> con sus carteles asignados. Podés verlos de inmediato en la lista de negocios.
            </p>
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <Button
            variant="ghost"
            onClick={() => {
              setCsvText('');
              setParsedRows([]);
              setImportSummary(null);
              onClose();
            }}
          >
            {importSummary ? 'Cerrar' : 'Cancelar'}
          </Button>

          {!importSummary && (
            <Button
              variant="primary"
              onClick={handleExecuteImport}
              isLoading={isProcessing}
              disabled={parsedRows.length === 0 || validCount === 0}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Procesar {validCount} negocios válidos
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
};
