/**
 * Toque — Componente Toast y Sistema de Avisos
 * Soporta aria-live, micro-celebración con onda suave, y accesibilidad.
 */

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toast: (options: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string, action?: (() => void) | { label: string; onClick: () => void }) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((options: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const newToast: ToastItem = { ...options, id };
    setToasts(prev => [...prev, newToast]);

    const duration = options.duration ?? 4500;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((title: string, message?: string, action?: (() => void) | { label: string; onClick: () => void }) => {
    const actionObj = typeof action === 'function' ? { label: 'Deshacer', onClick: action } : action;
    addToast({ type: 'success', title, message, action: actionObj });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    addToast({ type: 'error', title, message });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    addToast({ type: 'warning', title, message });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    addToast({ type: 'info', title, message });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, warning, info }}>
      {children}
      {/* Contenedor aria-live para lectores de pantalla */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-20 sm:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 pointer-events-none flex flex-col gap-2.5"
      >
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              role="alert"
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              className="pointer-events-auto material-glass rounded-xl p-3.5 shadow-xl border border-white/20 flex items-start gap-3 backdrop-blur-xl"
            >
              <div className="shrink-0 mt-0.5">
                {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[var(--menta)]" />}
                {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-[var(--ambar)]" />}
                {t.type === 'error' && <AlertCircle className="w-5 h-5 text-[var(--coral)]" />}
                {t.type === 'info' && <Info className="w-5 h-5 text-[var(--ultramar)]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-small font-semibold text-[var(--text-main)]">
                  {t.title}
                </div>
                {t.message && (
                  <div className="text-micro text-[var(--text-muted)] mt-0.5 leading-snug">
                    {t.message}
                  </div>
                )}
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      removeToast(t.id);
                    }}
                    className="mt-2 text-micro font-semibold text-[var(--brand)] hover:underline flex items-center gap-1"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-md transition"
                aria-label="Cerrar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    console.warn('useToast llamado fuera de ToastProvider; usando funciones de contingencia.');
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return context;
};
