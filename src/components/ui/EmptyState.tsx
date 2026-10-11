/**
 * Toque — Estado Vacío (EmptyState)
 * Incluye título claro, explicación orientadora y una acción principal.
 */

import React from 'react';
import { Button } from './Button';
import { Card } from './Card';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <Card className={`text-center py-12 px-6 flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="font-display text-title-3 font-semibold text-[var(--text-main)]">
        {title}
      </h3>
      <p className="text-small text-[var(--text-muted)] mt-2 max-w-md mx-auto">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </Card>
  );
};
