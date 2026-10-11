/**
 * Toque — Gráfico de Barras Accesible (BarChart)
 * Regla de accesibilidad: Alternativa en tabla semántica para lectores de pantalla.
 * Canales: NFC en ultramar, QR en estrella (con textura/patrón diferenciado, no solo color).
 */

import React, { useState } from 'react';
import { Table as TableIcon, BarChart3 } from 'lucide-react';
import { IconButton } from './IconButton';

export interface BarChartDataPoint {
  label: string;
  nfc: number;
  qr: number;
  total?: number;
  prevWeekTotal?: number;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  title?: string;
  className?: string;
  showComparison?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  className = '',
  showComparison = false,
}) => {
  const [showTable, setShowTable] = useState(false);
  const [comparePrevWeek, setComparePrevWeek] = useState(showComparison);

  // Consideramos tanto el valor actual como el de la semana anterior para la escala
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.nfc + d.qr, d.prevWeekTotal || 0)),
    1
  );

  return (
    <div className={`w-full ${className}`}>
      {/* Controles y leyenda */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        {title && (
          <h4 className="font-display text-small font-semibold text-[var(--text-main)]">
            {title}
          </h4>
        )}
        <div className="flex items-center gap-4 text-micro">
          {/* Leyenda con patrón táctil / visual */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[var(--ultramar)]" />
            <span className="text-[var(--text-muted)] font-medium">NFC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[var(--estrella)] border border-amber-500" />
            <span className="text-[var(--text-muted)] font-medium">QR</span>
          </div>
          {data.some(d => d.prevWeekTotal !== undefined) && (
            <button
              type="button"
              onClick={() => setComparePrevWeek(!comparePrevWeek)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-micro transition cursor-pointer ${
                comparePrevWeek
                  ? 'bg-black/10 dark:bg-white/15 text-[var(--text-main)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <span className="w-3 h-3 rounded-xs bg-slate-400/40 border border-dashed border-slate-400" />
              <span>Sem. anterior</span>
            </button>
          )}

          <IconButton
            size="sm"
            variant="ghost"
            aria-label={showTable ? 'Ver gráfico de barras' : 'Ver datos en tabla accesible'}
            onClick={() => setShowTable(!showTable)}
            title={showTable ? 'Ver gráfico' : 'Ver tabla de datos'}
          >
            {showTable ? <BarChart3 className="w-4 h-4" /> : <TableIcon className="w-4 h-4" />}
          </IconButton>
        </div>
      </div>

      {showTable ? (
        /* Alternativa en Tabla Semántica Accesible (WCAG AA) */
        <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-xl">
          <table className="w-full text-left text-small">
            <caption className="sr-only">Datos de escaneos por día divididos en NFC y QR</caption>
            <thead className="bg-black/5 dark:bg-white/5 border-b border-[var(--border-subtle)]">
              <tr>
                <th scope="col" className="p-2.5 font-semibold">Día</th>
                <th scope="col" className="p-2.5 font-semibold text-right">Toques NFC</th>
                <th scope="col" className="p-2.5 font-semibold text-right">Escaneos QR</th>
                <th scope="col" className="p-2.5 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {data.map(d => (
                <tr key={d.label} className="hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="p-2.5 font-medium">{d.label}</td>
                  <td className="p-2.5 text-right font-mono">{d.nfc}</td>
                  <td className="p-2.5 text-right font-mono">{d.qr}</td>
                  <td className="p-2.5 text-right font-mono font-semibold">{d.nfc + d.qr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Vista de Gráfico de Barras CSS Fluido */
        <div className="space-y-2.5">
          <div className="h-48 flex items-end gap-1.5 sm:gap-2.5 pt-6 pb-2 px-1 border-b border-[var(--border-subtle)]">
            {data.slice(-14).map((d) => {
              const total = d.nfc + d.qr;
              const nfcHeight = (d.nfc / maxValue) * 100;
              const qrHeight = (d.qr / maxValue) * 100;

              return (
                <div
                  key={d.label}
                  className="flex-1 flex flex-col items-center h-full justify-end group relative"
                >
                  {/* Tooltip al pasar el cursor */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                    <div className="material-glass px-2 py-1 rounded-md text-micro font-mono shadow-md border border-white/20 whitespace-nowrap text-center">
                      <span className="font-semibold">{total} toques</span>
                      <span className="text-slate-400 block text-[10px]">
                        NFC: {d.nfc} • QR: {d.qr}
                      </span>
                    </div>
                  </div>

                  {/* Barra(s) */}
                  <div className="w-full flex items-end justify-center gap-1 h-full">
                    {/* Barra de semana anterior (si está activa la comparación) */}
                    {comparePrevWeek && d.prevWeekTotal !== undefined && (
                      <div
                        style={{ height: `${(d.prevWeekTotal / maxValue) * 100}%` }}
                        className="w-full max-w-3 bg-slate-400/40 border border-dashed border-slate-400/60 rounded-t-xs transition-all duration-300"
                        title={`Semana anterior: ${d.prevWeekTotal} toques`}
                      />
                    )}

                    {/* Barra actual apilada (NFC + QR) */}
                    <div className="w-full max-w-5 flex flex-col justify-end h-full">
                      <div
                        style={{ height: `${qrHeight}%` }}
                        className="w-full bg-[var(--estrella)] rounded-t-xs transition-all duration-300"
                      />
                      <div
                        style={{ height: `${nfcHeight}%` }}
                        className="w-full bg-[var(--ultramar)] rounded-b-xs transition-all duration-300"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] text-[var(--text-muted)] font-mono mt-1.5 truncate max-w-full">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
