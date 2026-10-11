/**
 * Toque — Esqueleto de Carga (Skeleton)
 * Regla: Usar esqueletos estructurados, nunca spinners sueltos en pantallas.
 */

import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'w-full h-5' }) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200/80 dark:bg-slate-800/80 rounded-xl ${className}`}
    />
  );
};
