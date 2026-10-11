/**
 * Toque — Hoja Inferior Arrastrable (Sheet)
 * Implementa las directrices 6.4 y 6.5 de "interfaces fluidas":
 * - Seguimiento 1:1 con Pointer Events
 * - Proyección de impulso al soltar: proyeccion = (v / 1000) * 0.998 / (1 - 0.998)
 * - Decisión de cierre por signo de velocidad e impulso
 * - Resistencia progresiva (rubber-band)
 * - Scrim oscuro para enfocar
 */

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
}) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }[size];
  const [dragY, setDragY] = useState<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const startYRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Bloqueo de scroll de fondo cuando la hoja está abierta
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setDragY(0);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Manejo de Gestos Pointer Events 1:1
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY - dragY;
    lastYRef.current = e.clientY;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const currentY = e.clientY;
    const now = performance.now();
    const dt = Math.max(1, now - lastTimeRef.current);
    const dy = currentY - lastYRef.current;

    // Calcular velocidad instantánea (px/s)
    velocityRef.current = (dy / dt) * 1000;
    lastYRef.current = currentY;
    lastTimeRef.current = now;

    let delta = currentY - startYRef.current;
    if (delta < 0) {
      // Resistencia progresiva hacia arriba (rubber-band)
      delta = -Math.pow(-delta, 0.75) * 2;
    }

    setDragY(delta);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar si ya se soltó
    }

    // Fórmula de proyección de impulso: v/1000 * 0.998 / (1 - 0.998)
    const v = velocityRef.current;
    const projectedDistance = (v / 1000) * (0.998 / (1 - 0.998));
    const projectedEnd = dragY + projectedDistance;

    // Si la velocidad es claramente hacia abajo (> 400 px/s) o proyecta más de 120px hacia abajo: CERRAR
    if (v > 400 || projectedEnd > 140) {
      onClose();
    } else {
      // Volver a la posición de apertura
      setDragY(0);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center">
          {/* Scrim Oscuro con desenfoque de fondo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          />

          {/* Hoja Deslizable */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%', opacity: 0.9 }}
            animate={{
              y: dragY > 0 ? dragY : dragY,
              opacity: 1,
            }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className={`relative w-full ${sizeClasses} max-h-[90vh] bg-[var(--bg-card)] rounded-t-3xl sm:rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col z-10 overflow-hidden`}
          >
            {/* Manija táctil arrastrable (Drag Handle) */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="pt-3 pb-2 px-6 flex flex-col items-center cursor-grab active:cursor-grabbing touch-none select-none"
            >
              <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Cabecera */}
            {(title || description) && (
              <div className="px-6 pb-4 pt-1 flex items-start justify-between border-b border-[var(--border-subtle)]">
                <div>
                  {title && (
                    <h3 className="font-display text-title-3 font-semibold text-[var(--text-main)]">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-small text-[var(--text-muted)] mt-1">
                      {description}
                    </p>
                  )}
                </div>
                <IconButton
                  aria-label="Cerrar"
                  onClick={onClose}
                  size="sm"
                  variant="ghost"
                  className="mt-0.5"
                >
                  <X className="w-4 h-4" />
                </IconButton>
              </div>
            )}

            {/* Contenido desplazable */}
            <div className="p-6 overflow-y-auto max-h-[75vh]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
