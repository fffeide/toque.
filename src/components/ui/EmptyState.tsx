import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'estrella' | 'ultramar' | 'secundario';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'ultramar',
}) => {
  return (
    <div className="py-12 px-6 text-center max-w-md mx-auto flex flex-col items-center">
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-[#ECEDFC] text-[#3A3FE0] flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="font-display font-bold text-lg text-[#0B1030] mb-2">
        {title}
      </h3>
      <p className="text-sm text-[#5E6072] leading-relaxed mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant={actionVariant} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
