/**
 * Toque — Diálogo Modal (Dialog)
 * Usado exclusivamente para acciones críticas o irreversibles.
 */

import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
}) => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 aurora-modal-scrim"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className={`relative w-full ${sizeClasses} aurora-modal-surface rounded-[var(--radius-lg,24px)] p-6 z-10 text-white`}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-title-3 font-semibold text-[var(--text-main)]">
                  {title}
                </h3>
                {description && (
                  <p className="text-small text-[var(--text-muted)] mt-1">
                    {description}
                  </p>
                )}
              </div>
              <IconButton aria-label="Cerrar ventana" onClick={onClose} size="sm">
                <X className="w-4 h-4" />
              </IconButton>
            </div>

            <div>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
