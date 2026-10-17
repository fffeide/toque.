import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'glass' | 'solid';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  variant = 'glass',
  ...props
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  }[padding];

  const variantStyles = variant === 'glass'
    ? 'bg-white/[0.09] backdrop-blur-xl border border-white/[0.16] shadow-lg text-white'
    : 'bg-white border border-[#E3DDD2] shadow-xs text-[#0B1030]';

  return (
    <div
      className={`rounded-2xl transition-all duration-200 relative overflow-hidden ${variantStyles} ${paddingStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
