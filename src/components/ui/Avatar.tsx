/**
 * Toque — Avatar y Logo de Marca Blanca
 */

import React from 'react';

export interface AvatarProps {
  name: string;
  url?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({ name, url, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-micro',
    md: 'w-10 h-10 text-small',
    lg: 'w-12 h-12 text-body',
  }[size];

  const initials = name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClasses} rounded-full object-cover border border-[var(--border-subtle)]`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-[var(--brand)] text-white font-semibold flex items-center justify-center select-none shadow-xs`}
    >
      {initials || 'TQ'}
    </div>
  );
};

export interface BrandLogoProps {
  name?: string;
  logoUrl?: string;
  showToqueBadge?: boolean;
  size?: 'sm' | 'md' | 'lg' | string;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  name = 'Toque',
  logoUrl,
  showToqueBadge = false,
  size = 'md',
  className = '',
}) => {
  const iconSize = size === 'sm' ? 'w-6 h-6 rounded-lg' : size === 'lg' ? 'w-10 h-10 rounded-2xl' : 'w-8 h-8 rounded-xl';
  const starSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-small' : size === 'lg' ? 'text-title-2' : 'text-title-3';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className={`${size === 'sm' ? 'h-6' : size === 'lg' ? 'h-10' : 'h-8'} max-w-40 object-contain`}
        />
      ) : (
        <div className="flex items-center gap-2">
          {/* Sello Toque: Estrella acento dorada con anillo sutil */}
          <div className={`${iconSize} bg-[var(--brand)] text-white flex items-center justify-center font-display font-bold text-small shadow-sm`}>
            <svg
              className={`${starSize} fill-[var(--estrella)]`}
              viewBox="0 0 24 24"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <span className={`font-display font-bold ${textSize} tracking-tight text-[var(--text-main)]`}>
            {name}
          </span>
        </div>
      )}

      {showToqueBadge && name !== 'Toque' && (
        <span className="text-[10px] text-[var(--text-muted)] font-medium px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)]">
          con Toque
        </span>
      )}
    </div>
  );
};
