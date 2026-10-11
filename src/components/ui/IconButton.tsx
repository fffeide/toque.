/**
 * Toque — Botón de Ícono (IconButton)
 * 44px táctiles mínimos, accesible con aria-label obligatorio.
 */

import React, { ButtonHTMLAttributes, forwardRef } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({
  children,
  variant = 'ghost',
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
  disabled,
  ...props
}, ref) => {
  const sizeClasses = {
    sm: 'w-9 h-9 min-h-[36px] min-w-[36px]',
    md: 'w-11 h-11 min-touch',
    lg: 'w-12 h-12 min-h-[48px] min-w-[48px]',
  }[size];

  const variantClasses = {
    primary: 'bg-[var(--brand)] text-white hover:brightness-105 shadow-sm',
    secondary: 'bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
    ghost: 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5',
    glass: 'material-glass text-[var(--text-main)] hover:bg-white/80 dark:hover:bg-white/10 border border-white/20',
  }[variant];

  return (
    <button
      ref={ref}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

IconButton.displayName = 'IconButton';
