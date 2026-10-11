/**
 * Toque — Interruptor (Switch)
 * Componente accesible para estados binarios (ej. NFC activo / inactivo).
 */

import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id = 'switch-toggle',
}) => {
  return (
    <label
      htmlFor={id}
      className={`flex items-center justify-between gap-3 py-1 cursor-pointer select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {(label || description) && (
        <div className="flex-1 text-left">
          {label && <div className="text-small font-medium text-[var(--text-main)]">{label}</div>}
          {description && <div className="text-micro text-[var(--text-muted)] mt-0.5">{description}</div>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none ${
          checked ? 'bg-[var(--brand)]' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
};
