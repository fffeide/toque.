import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'estrella' | 'ultramar' | 'secundario' | 'peligro' | 'fantasma';
  size?: 'touch' | 'md' | 'sm';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'ultramar',
  size = 'md',
  fullWidth = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  // Regla de Oro: Botón estrella SIEMPRE con texto Tinta (#0B1030)
  const variantStyles = {
    estrella: 'bg-[#FFC21A] text-[#0B1030] hover:bg-[#F0B412] active:bg-[#E0A40A] font-bold shadow-xs',
    ultramar: 'bg-[#3A3FE0] text-white hover:bg-[#2F33C2] active:bg-[#25289E] font-semibold shadow-xs',
    secundario: 'bg-white text-[#0B1030] border border-[#E3DDD2] hover:bg-[#F7F4EE] active:bg-[#EAE4D9] font-medium',
    peligro: 'bg-[#B8332A] text-white hover:bg-[#9E2A22] active:bg-[#85221C] font-semibold',
    fantasma: 'bg-transparent text-[#0B1030] hover:bg-[#F7F4EE] font-medium',
  }[variant];

  const sizeStyles = {
    touch: 'min-h-[48px] px-6 text-base rounded-xl',
    md: 'min-h-[40px] px-4 text-sm rounded-lg',
    sm: 'min-h-[34px] px-3 text-xs rounded-md',
  }[size];

  const widthStyle = fullWidth ? 'w-full' : '';
  const disabledStyle = disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:scale-[0.98]';

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 select-none ${variantStyles} ${sizeStyles} ${widthStyle} ${disabledStyle} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
