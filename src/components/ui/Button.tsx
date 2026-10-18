import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'estrella'
  | 'ultramar'
  | 'secundario'
  | 'peligro'
  | 'fantasma'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'touch' | 'md' | 'sm';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'ultramar',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles: Record<ButtonVariant, string> = {
    estrella:
      'bg-[#f1f1ee] text-[#0c0c0c] hover:bg-white active:bg-[#e4e4e0] font-semibold',
    ultramar:
      'bg-[#bec8ff] text-[#0c0c0c] hover:bg-[#d6daf6] active:bg-[#a9b6ff] font-semibold',
    primary:
      'bg-[#bec8ff] text-[#0c0c0c] hover:bg-[#d6daf6] active:bg-[#a9b6ff] font-semibold',
    secundario:
      'bg-[#18181b] text-[#f1f1ee] border border-[#28282a] hover:border-[#3a3a3e] hover:bg-[#222226] font-medium',
    secondary:
      'bg-[#18181b] text-[#f1f1ee] border border-[#28282a] hover:border-[#3a3a3e] hover:bg-[#222226] font-medium',
    outline:
      'bg-[#141416] text-[#f1f1ee] border border-[#28282a] hover:border-[#3a3a3e] hover:bg-[#1f1f23] font-medium',
    peligro:
      'bg-[#28282a] text-[#f1f1ee] border border-[#3a3a3e] hover:bg-[#323236] font-semibold',
    danger:
      'bg-[#28282a] text-[#f1f1ee] border border-[#3a3a3e] hover:bg-[#323236] font-semibold',
    fantasma:
      'bg-transparent text-[#a1a1aa] hover:text-[#f1f1ee] hover:bg-[#18181b] font-medium',
    ghost:
      'bg-transparent text-[#a1a1aa] hover:text-[#f1f1ee] hover:bg-[#18181b] font-medium',
  };

  const sizeStyles = {
    touch: 'min-h-[44px] px-5 text-sm rounded-xl',
    md: 'min-h-[40px] px-4 text-sm rounded-xl',
    sm: 'min-h-[34px] px-3.5 text-xs rounded-xl',
  }[size];

  const isDisabled = Boolean(disabled || isLoading);
  const widthStyle = fullWidth ? 'w-full' : '';
  const disabledStyle = isDisabled
    ? 'opacity-50 cursor-not-allowed pointer-events-none'
    : 'cursor-pointer';

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-colors duration-150 select-none ${variantStyles[variant] || variantStyles.ultramar} ${sizeStyles} ${widthStyle} ${disabledStyle} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
