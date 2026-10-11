/**
 * Toque — Tarjeta de Contenido Liquid Glass (Card)
 * Basada en la receta oficial de Liquid Glass:
 * Gradiente vertical de vidrio, desenfoque de 26px, borde sutil de 20%,
 * esquinas de 24px y specular sheen opcional.
 */

import React, { HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'solid' | 'subtle' | 'glass';
  interactive?: boolean;
  sheen?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  children,
  variant = 'solid',
  interactive = false,
  sheen = false,
  className = '',
  ...props
}, ref) => {
  const variantClasses = {
    solid: 'aurora-card-glass',
    subtle: 'bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl text-white',
    glass: 'aurora-card-glass',
  }[variant];

  const interactiveClasses = interactive
    ? 'hover:scale-[1.01] hover:border-white/40 cursor-pointer active:scale-[0.99] transition-all'
    : '';

  const sheenClass = sheen ? 'aurora-sheen' : '';

  return (
    <div
      ref={ref}
      className={`p-5 sm:p-6 text-white ${variantClasses} ${interactiveClasses} ${sheenClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';
