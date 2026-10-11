/**
 * Toque — Estado de Error (ErrorState)
 * Mensaje humano comprensible y botón directo "Reintentar".
 */

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'No pudimos cargar la información',
  message = 'Ocurrió un problema de conexión al consultar los datos. Podés volver a intentar en unos segundos.',
  onRetry,
  className = '',
}) => {
  return (
    <Card className={`text-center py-10 px-6 flex flex-col items-center justify-center max-w-lg mx-auto border-rose-500/20 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-[var(--coral)] flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="font-display text-title-3 font-semibold text-[var(--text-main)]">
        {title}
      </h3>
      <p className="text-small text-[var(--text-muted)] mt-1.5 max-w-md mx-auto">
        {message}
      </p>
      {onRetry && (
        <div className="mt-5">
          <Button
            variant="secondary"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Reintentar
          </Button>
        </div>
      )}
    </Card>
  );
};
