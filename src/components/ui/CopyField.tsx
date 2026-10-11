/**
 * Toque — Campo con Copiado Rápido (CopyField)
 */

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './Toast';

export interface CopyFieldProps {
  label?: string;
  value: string;
  className?: string;
}

export const CopyField: React.FC<CopyFieldProps> = ({
  label,
  value,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const { success } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      success('Copiado al portapapeles', value);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className={`space-y-1.5 text-left ${className}`}>
      {label && (
        <label className="block text-small font-medium text-[var(--text-main)]">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          className="flex-1 h-11 px-3.5 bg-[var(--bg-card)] text-[var(--text-main)] rounded-xl border border-[var(--border-subtle)] text-small font-mono truncate"
        />
        <Button
          variant="secondary"
          onClick={handleCopy}
          leftIcon={copied ? <Check className="w-4 h-4 text-[var(--menta)]" /> : <Copy className="w-4 h-4" />}
          className="shrink-0 min-touch"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </div>
  );
};
