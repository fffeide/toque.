/**
 * Toque — Botón Principal Liquid Glass (Button)
 * Respeta 44px táctiles mínimos, respuesta inmediata al presionar (:active),
 * y variantes de jerarquía: primario (blanco puro luminoso), secundario (vidrio),
 * contorno, fantasma y peligro.
 */

import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  icon,
  className = '',
  ...props
}, ref) => {
  const effectiveLeftIcon = leftIcon || icon;
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-full transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none min-touch';

  const sizeClasses = {
    sm: 'text-xs px-3.5 py-1.5 min-h-[36px] gap-1.5',
    md: 'text-sm px-4 py-2 min-h-[44px] gap-2',
    lg: 'text-base px-6 py-2.5 min-h-[48px] gap-2.5 font-semibold',
  }[size];

  const variantClasses = {
    primary: 'bg-white text-slate-950 font-semibold hover:bg-white/90 active:scale-[0.98] shadow-md border border-white',
    secondary: 'aurora-tool-btn px-4 py-2 text-white hover:bg-white/20 active:scale-[0.98] border border-white/20',
    outline: 'bg-transparent text-white border border-white/30 hover:bg-white/10 active:scale-[0.98]',
    ghost: 'bg-transparent text-white/80 hover:text-white hover:bg-white/10 active:scale-[0.98] border border-transparent',
    danger: 'bg-rose-500/80 hover:bg-rose-500 text-white shadow-sm border border-rose-400/30 active:scale-[0.98]',
  }[variant];

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        effectiveLeftIcon && <span className="shrink-0">{effectiveLeftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
});

Button.displayName = 'Button';
