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
  ...props
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  }[padding];

  return (
    <div
      className={`rounded-2xl bg-[#111113] border border-[#242426] hover:border-[#343438] text-[#f1f1ee] transition-colors duration-150 relative overflow-hidden ${paddingStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
