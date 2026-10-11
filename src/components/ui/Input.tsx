/**
 * Toque — Campo de Texto (Input)
 * 44px mínimos de altura, etiquetas claras y validación en línea.
 */

import React, { InputHTMLAttributes, forwardRef, useId } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  id: customId,
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = customId || generatedId;

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-small font-medium text-[var(--text-main)] select-none"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 pointer-events-none text-[var(--text-muted)] shrink-0">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`w-full h-11 px-3.5 bg-[var(--bg-card)] text-[var(--text-main)] rounded-xl border transition text-small placeholder:text-[var(--text-muted)] placeholder:opacity-60 disabled:opacity-50 disabled:bg-black/5 dark:disabled:bg-white/5 ${
            leftIcon ? 'pl-10' : ''
          } ${rightIcon ? 'pr-10' : ''} ${
            error
              ? 'border-[var(--coral)] focus:border-[var(--coral)]'
              : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus:border-[var(--brand)]'
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 text-[var(--text-muted)] shrink-0">
            {rightIcon}
          </div>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-micro text-[var(--coral)] font-medium">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-micro text-[var(--text-muted)]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
