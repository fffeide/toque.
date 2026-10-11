/**
 * Toque — Métrica / Estadística Liquid Glass (Stat)
 * Tipografía nítida en cifras, accesible con alternativa semántica.
 */

import React from 'react';
import { Card } from './Card';
import { HelpCircle } from 'lucide-react';

export interface StatProps {
  label: string;
  value: string | number;
  subtext?: string;
  explanation?: string; // Para explicar métricas estimadas
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  sheen?: boolean;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  subtext,
  explanation,
  icon,
  trend,
  sheen = false,
}) => {
  return (
    <Card sheen={sheen} className="flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="text-small font-medium text-white/70 flex items-center gap-1.5">
          <span>{label}</span>
          {explanation && (
            <span
              title={explanation}
              className="cursor-help text-white/50 hover:text-white"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          )}
        </span>
        {icon && <div className="text-white/80 shrink-0">{icon}</div>}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-headline text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {value}
        </div>
        {trend && (
          <span
            className={`text-micro font-semibold px-2 py-0.5 rounded-full border ${
              trend.isPositive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtext && (
        <div className="mt-1.5 text-micro text-white/60">
          {subtext}
        </div>
      )}
    </Card>
  );
};
