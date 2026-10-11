/**
 * Toque — Insignia / Chip de Estado (Badge)
 * Regla de accesibilidad: Ícono + texto siempre presentes (nunca depender únicamente de color).
 * Borde redondeado 999px.
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, RefreshCw } from 'lucide-react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  icon,
  className = '',
}) => {
  const defaultIcons = {
    success: <CheckCircle2 className="w-3 h-3 text-[var(--menta)]" />,
    warning: <AlertTriangle className="w-3 h-3 text-[var(--ambar)]" />,
    error: <AlertCircle className="w-3 h-3 text-[var(--coral)]" />,
    info: <Info className="w-3 h-3 text-[var(--ultramar)]" />,
    neutral: <RefreshCw className="w-3 h-3 text-[var(--text-muted)]" />,
  };

  const variantClasses = {
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    error: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    info: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
    neutral: 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)] border-[var(--border-subtle)]',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-micro font-medium border select-none ${variantClasses} ${className}`}
    >
      <span className="shrink-0">{icon || defaultIcons[variant]}</span>
      <span>{children}</span>
    </span>
  );
};
