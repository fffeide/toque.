/**
 * Toque — Tooltip Accesible
 */

import React, { useState, ReactNode } from 'react';

export interface TooltipProps {
  content: string;
  children: ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-[var(--tinta)] text-white text-micro font-medium rounded-lg shadow-md whitespace-nowrap z-50 pointer-events-none"
        >
          {content}
        </div>
      )}
    </div>
  );
};
