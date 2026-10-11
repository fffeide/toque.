/**
 * Toque — Vista Previa de Marca Blanca (BrandPreview)
 * Muestra el logo, color primario y verificación automática de contraste WCAG AA.
 */

import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { BrandLogo } from './Avatar';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export interface BrandPreviewProps {
  brandName: string;
  brandColor: string;
  logoUrl?: string;
  contrastRatio: number;
  passesAA: boolean;
  recommendedColor?: string;
  onApplyRecommended?: () => void;
}

export const BrandPreview: React.FC<BrandPreviewProps> = ({
  brandName,
  brandColor,
  logoUrl,
  contrastRatio,
  passesAA,
  recommendedColor,
  onApplyRecommended,
}) => {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-small font-semibold text-[var(--text-main)]">
          Vista previa para tus clientes
        </h4>
        <Badge variant={passesAA ? 'success' : 'warning'}>
          {passesAA ? `Contraste ${contrastRatio}:1 (Pasa AA)` : `Contraste ${contrastRatio}:1 (Bajo)`}
        </Badge>
      </div>

      {/* Simulación de cabecera de cliente con marca blanca */}
      <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
        <BrandLogo name={brandName || 'Tu Marca'} logoUrl={logoUrl} showToqueBadge={true} />
        <div className="flex items-center gap-2">
          <div
            style={{ backgroundColor: brandColor }}
            className="w-4 h-4 rounded-full shadow-xs border border-white/20"
          />
          <span className="text-micro font-mono text-[var(--text-muted)]">{brandColor}</span>
        </div>
      </div>

      {!passesAA && recommendedColor && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-small text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-[var(--ambar)] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-micro leading-relaxed">
              El color seleccionado tiene bajo contraste con el texto blanco. Te sugerimos usar{' '}
              <span className="font-mono font-bold">{recommendedColor}</span> para garantizar accesibilidad.
            </p>
            {onApplyRecommended && (
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={onApplyRecommended}>
                  Aplicar color sugerido ({recommendedColor})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {passesAA && (
        <div className="flex items-center gap-2 text-micro text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-[var(--menta)]" />
          <span>Excelente legibilidad garantizada en celulares y escritorios.</span>
        </div>
      )}
    </Card>
  );
};
