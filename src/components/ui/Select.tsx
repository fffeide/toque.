/**
 * Toque — Selector Desplegable (Select)
 * 44px de altura mínima, accesible.
 */

import React, { SelectHTMLAttributes, forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { value: string; label: string; disabled?: boolean }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  helperText,
  options,
  className = '',
  id: customId,
  ...props
}, ref) => {
  const generatedId = useId();
  const selectId = customId || generatedId;

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-small font-medium text-[var(--text-main)] select-none"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          className={`w-full h-11 pl-3.5 pr-10 bg-[#0d1b2e] text-white rounded-xl border transition text-small appearance-none cursor-pointer ${
            error
              ? 'border-[var(--coral)]'
              : 'border-white/20 hover:border-white/40 focus:border-white focus:ring-1 focus:ring-white/40'
          } ${className}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-[#0b1728] text-white py-2">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3.5 pointer-events-none text-[var(--text-muted)]">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {error ? (
        <p className="text-micro text-[var(--coral)] font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-micro text-[var(--text-muted)]">{helperText}</p>
      ) : null}
    </div>
  );
});

Select.displayName = 'Select';
