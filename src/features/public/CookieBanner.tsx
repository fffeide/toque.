import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getConsentPreferences, saveConsentPreferences } from '../../config/legal';

export const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getConsentPreferences();
    if (!existing) {
      setVisible(true);
    } else {
      saveConsentPreferences(existing.analyticsClarity);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    saveConsentPreferences(true);
    setVisible(false);
  };

  return (
    <aside
      role="region"
      aria-label="Aviso de privacidad y cookies"
      className="fixed bottom-3 left-3 right-3 z-50 max-w-xl mx-auto h-[42px] max-h-[44px] px-3.5 rounded-full bg-[#141418]/95 backdrop-blur-md border border-[#282830] text-[#F4F4F6] shadow-xl flex items-center justify-between gap-3"
    >
      <p className="text-xs text-[#9E9EA8] truncate">
        Usamos cookies propias para recordar tu tarjeta. Al continuar aceptás nuestra{' '}
        <Link to="/privacidad" className="text-[#BEC8FF] underline hover:text-white">
          Privacidad
        </Link>
        .
      </p>

      <button
        type="button"
        onClick={handleAccept}
        className="shrink-0 h-7 px-3 rounded-full bg-[#D95B26] hover:bg-[#e56732] text-[11px] font-bold text-white transition-colors cursor-pointer"
      >
        Entendido
      </button>
    </aside>
  );
};
