/**
 * Toque — Modal Informativo de Visualización Única (OneTimeInfoModal)
 * Muestra información conceptual o reglamentaria solo una vez usando localStorage.
 * Permite cerrar y marcar como "Entendido", evitando saturar la interfaz diaria.
 * Incluye botón discreto o método para volver a consultarlo si el usuario lo necesita.
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Check } from 'lucide-react';

interface OneTimeInfoModalProps {
  id: string; // Clave única para localStorage
  title: string;
  description?: string;
  children: ReactNode;
  icon?: ReactNode;
  isOpenControlled?: boolean;
  onCloseControlled?: () => void;
}

export const OneTimeInfoModal: React.FC<OneTimeInfoModalProps> = ({
  id,
  title,
  description,
  children,
  icon,
  isOpenControlled,
  onCloseControlled,
}) => {
  const storageKey = `toque_seen_info_${id}`;
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Si no está controlado externamente, comprobar si ya fue visto
    if (isOpenControlled === undefined) {
      const hasSeen = localStorage.getItem(storageKey) === 'true';
      if (!hasSeen) {
        // Breve retraso para transición suave
        const timer = setTimeout(() => setIsOpen(true), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [id, storageKey, isOpenControlled]);

  const activeIsOpen = isOpenControlled !== undefined ? isOpenControlled : isOpen;

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // Ignorar fallos de cuota o cookies
    }
    if (onCloseControlled) {
      onCloseControlled();
    } else {
      setIsOpen(false);
    }
  };

  if (!activeIsOpen) return null;

  return (
    <Dialog
      isOpen={activeIsOpen}
      onClose={handleDismiss}
      title={title}
      description={description}
      size="md"
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-3">
          {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
          <div className="text-small text-[var(--text-main)] leading-relaxed space-y-2 flex-1">
            {children}
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <span className="text-micro text-[var(--text-muted)]">
            Este mensaje no volverá a aparecer automáticamente.
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={handleDismiss}
            icon={<Check className="w-3.5 h-3.5" />}
          >
            Entendido
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
