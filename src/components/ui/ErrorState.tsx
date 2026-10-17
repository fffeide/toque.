import React from 'react';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'No pudimos cargar la información',
  message = 'Hubo un inconveniente al conectar con el servicio. Probá de nuevo en unos instantes.',
  onRetry,
}) => {
  return (
    <div
      role="alert"
      className="p-6 rounded-2xl bg-[#FCE9E6] border border-[#B8332A]/20 text-[#0B1030] max-w-md mx-auto my-6 text-center space-y-3"
    >
      <div className="w-12 h-12 rounded-xl bg-white text-[#B8332A] flex items-center justify-center mx-auto shadow-xs">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="font-display font-bold text-base text-[#B8332A]">
        {title}
      </h3>
      <p className="text-xs text-[#5E6072] leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <div className="pt-2">
          <Button variant="secundario" size="sm" onClick={onRetry}>
            Volver a intentar
          </Button>
        </div>
      )}
    </div>
  );
};
