/**
 * Toque — Control Segmentado (SegmentedControl)
 * Alternancia fluida con animación spring de pastilla activa.
 */

import React from 'react';
import { motion } from 'motion/react';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={`inline-flex p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-[var(--border-subtle)] ${className}`}
    >
      {options.map(opt => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={`relative flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors cursor-pointer select-none ${
              size === 'sm' ? 'px-2.5 py-1 text-micro' : 'px-3.5 py-1.5 text-small'
            } ${isSelected ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
          >
            {isSelected && (
              <motion.div
                layoutId="segmented-pill"
                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                className="absolute inset-0 bg-[var(--bg-card)] rounded-lg shadow-xs border border-[var(--border-subtle)]"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {opt.icon && <span className="shrink-0">{opt.icon}</span>}
              <span>{opt.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
