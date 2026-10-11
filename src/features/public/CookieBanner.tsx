/**
 * Toque — Aviso de Cookies Sobrio e Informativo (CookieBanner)
 * No es un muro invasivo. Explica con claridad que solo se usan cookies esenciales
 * y de preferencias, y destaca que el enlace del cartel físico NO USA NINGUNA cookie.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY = 'toque_cookie_notice_accepted';

export const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) {
        setIsVisible(true);
      }
    } catch {
      // LocalStorage deshabilitado o restringido
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Aviso informativo de cookies y almacenamiento"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <div className="p-4 rounded-2xl bg-[var(--bg-card)]/95 backdrop-blur-md border border-[var(--border-subtle)] shadow-xl text-[var(--text-main)]">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[var(--brand)] flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>

          <div className="flex-1 text-small leading-relaxed">
            <p className="font-semibold text-body mb-0.5">
              Sin rastreo en tus carteles
            </p>
            <p className="text-micro text-[var(--text-muted)]">
              En este sitio solo usamos cookies técnicas y de preferencias. <strong>El enlace que tocan tus clientes en el cartel físico no usa ninguna cookie ni guarda IPs.</strong>
            </p>

            <div className="mt-3 flex items-center gap-3">
              <Button
                size="sm"
                variant="primary"
                onClick={handleDismiss}
                className="py-1 px-3 text-micro"
              >
                Entendido
              </Button>
              <Link
                to="/cookies"
                className="text-micro text-[var(--brand)] hover:underline font-medium"
              >
                Ver política
              </Link>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded-lg transition"
            aria-label="Cerrar aviso informativo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
