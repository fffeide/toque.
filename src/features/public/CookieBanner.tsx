import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, Cookie, X } from 'lucide-react';
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

  const handleAcceptAll = () => {
    saveConsentPreferences(true);
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    saveConsentPreferences(false);
    setVisible(false);
  };

  return (
    <aside
      role="region"
      aria-label="Aviso de privacidad, cookies y analítica Clarity"
      className="fixed bottom-4 left-4 right-4 z-50 max-w-3xl mx-auto rounded-2xl bg-[#111113]/95 backdrop-blur-md border border-[#28282c] p-4 sm:p-5 text-[#f1f1ee] shadow-2xl"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2fb36a]/15 border border-[#2fb36a]/30 text-[#2fb36a] flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs leading-relaxed">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#f1f1ee]">
                Privacidad, Cookies y Analítica Opcional
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#18181b] border border-[#28282c] text-[10px] text-[#bec8ff] font-medium">
                Ley 25.326
              </span>
            </div>
            <p className="text-[#a1a1aa]">
              Usamos cookies técnicas necesarias para tu sesión y, solo si aceptás,{' '}
              <strong className="text-[#f1f1ee] font-medium">Microsoft Clarity</strong> con datos
              enmascarados para mejorar la experiencia. Si elegís &ldquo;Solo necesarias&rdquo;, Clarity permanece desactivado. Consultá{' '}
              <Link to="/terminos" className="text-[#bec8ff] underline hover:text-white">
                Términos
              </Link>
              ,{' '}
              <Link to="/privacidad" className="text-[#bec8ff] underline hover:text-white">
                Privacidad
              </Link>{' '}
              y{' '}
              <Link to="/cookies" className="text-[#bec8ff] underline hover:text-white">
                Política de Cookies
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <button
            type="button"
            onClick={handleEssentialOnly}
            className="px-3.5 py-2 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-xs font-semibold text-[#a1a1aa] hover:text-[#f1f1ee] transition-colors cursor-pointer"
          >
            Solo necesarias
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="px-4 py-2 rounded-xl bg-[#2fb36a] hover:bg-[#269a59] text-xs font-bold text-[#08120c] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Aceptar todo</span>
          </button>
          <button
            type="button"
            onClick={handleEssentialOnly}
            aria-label="Rechazar analítica y cerrar aviso"
            className="p-1.5 rounded-lg text-[#71717a] hover:text-[#f1f1ee] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
