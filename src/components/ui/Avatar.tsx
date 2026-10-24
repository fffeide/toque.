import React from 'react';

export interface BrandLogoProps {
  variant?: 'full' | 'isotipo' | 'badge' | 'mono';
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
  className?: string;
}

/**
 * Componente Oficial <BrandLogo /> de Toque ("Tactile Hardware")
 * Variantes:
 * - full: Squircle con píldora inferior #D95B26 + texto "toque" en Sora bold
 * - isotipo: Solo el símbolo (Squircle con píldora #D95B26)
 * - badge: Insignia compacta "Funciona con Toque" para pie del Hub y carteles
 * - mono: Versión blanco/negro de alto contraste para impresión
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  subtitle,
  className = '',
}) => {
  const iconDimensions =
    size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const textSize =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  const renderIsotipo = (isMono = false) => (
    <svg
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${iconDimensions} shrink-0`}
      aria-hidden="true"
    >
      <rect
        x="4"
        y="4"
        width="44"
        height="44"
        rx="12"
        fill={isMono ? '#0C0C0E' : '#141418'}
        stroke={isMono ? '#0C0C0E' : '#282830'}
        strokeWidth="2"
      />
      <rect
        x="11"
        y="33"
        width="30"
        height="7.5"
        rx="3.75"
        fill={isMono ? '#FFFFFF' : '#D95B26'}
      />
    </svg>
  );

  if (variant === 'isotipo') {
    return (
      <span className={`inline-flex items-center ${className}`}>
        {renderIsotipo(false)}
      </span>
    );
  }

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141418] border border-[#282830] text-xs font-medium text-[#A1A1AA] ${className}`}
      >
        <svg
          viewBox="0 0 52 52"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 shrink-0"
          aria-hidden="true"
        >
          <rect
            x="4"
            y="4"
            width="44"
            height="44"
            rx="12"
            fill="#0C0C0E"
            stroke="#282830"
            strokeWidth="2.5"
          />
          <rect x="11" y="33" width="30" height="8" rx="4" fill="#D95B26" />
        </svg>
        <span>
          Funciona con <strong className="text-[#F1F1EE] font-bold tracking-tight">toque</strong>
        </span>
      </span>
    );
  }

  if (variant === 'mono') {
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`}>
        {renderIsotipo(true)}
        <span
          className={`font-extrabold tracking-tight leading-none ${textSize}`}
          style={{ fontFamily: "'Sora', 'Inter', system-ui, sans-serif" }}
        >
          toque
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {renderIsotipo(false)}
      <span className="flex flex-col">
        <span
          className={`font-extrabold tracking-tight text-[#F1F1EE] leading-none ${textSize}`}
          style={{ fontFamily: "'Sora', 'Inter', system-ui, sans-serif" }}
        >
          toque
        </span>
        {subtitle && (
          <span className="text-[11px] text-[#A1A1AA] font-medium mt-0.5 leading-none">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
};

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = 'Comercio',
  src,
  size = 'md',
  className = '',
}) => {
  const dim =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
      ? 'w-14 h-14 text-lg'
      : 'w-10 h-10 text-sm';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} rounded-xl object-cover border border-[#282830] shrink-0 ${className}`}
      />
    );
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <div
      className={`${dim} rounded-xl bg-[#1C1C22] border border-[#282830] text-[#F1F1EE] font-bold flex items-center justify-center shrink-0 ${className}`}
    >
      {initials || 'TQ'}
    </div>
  );
};

export default BrandLogo;
