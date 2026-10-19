import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  Lock,
  Cookie,
  RefreshCcw,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import {
  LEGAL_DOCUMENTS,
  LegalDocKey,
  CLARITY_PROJECT_ID,
  getConsentPreferences,
  saveConsentPreferences,
} from '../../config/legal';

interface LegalPageViewProps {
  docKey: LegalDocKey;
}

export const LegalPageView: React.FC<LegalPageViewProps> = ({ docKey }) => {
  const doc = LEGAL_DOCUMENTS[docKey] || LEGAL_DOCUMENTS.terminos;
  const [clarityEnabled, setClarityEnabled] = useState<boolean>(true);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const prefs = getConsentPreferences();
    if (prefs) {
      setClarityEnabled(prefs.analyticsClarity);
    }
  }, [docKey]);

  const handleToggleClarity = (enabled: boolean) => {
    setClarityEnabled(enabled);
    saveConsentPreferences(enabled);
    setSavedNotice(
      enabled
        ? 'Consentimiento de Microsoft Clarity activado.'
        : 'Analítica de Microsoft Clarity desactivada en este navegador.'
    );
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const navItems: Array<{ key: LegalDocKey; label: string; to: string; icon: React.ElementType }> = [
    { key: 'terminos', label: 'Términos y Condiciones', to: '/terminos', icon: FileText },
    { key: 'privacidad', label: 'Privacidad (Ley 25.326)', to: '/privacidad', icon: Lock },
    { key: 'cookies', label: 'Cookies y Clarity', to: '/cookies', icon: Cookie },
    { key: 'reembolso', label: 'Reembolsos y Planes', to: '/reembolso', icon: RefreshCcw },
  ];

  return (
    <div className="min-h-screen bg-[#000000] text-[#f1f1ee] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#000000]/90 backdrop-blur-md border-b border-[#242426]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#f1f1ee] flex items-center justify-center">
              <img src="/assets/logo.svg" alt="" className="w-4 h-4 object-contain" />
            </div>
            <span className="font-bold text-lg tracking-tight text-[#f1f1ee]">toque™</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#18181b] border border-[#28282c] text-[#a1a1aa]">
              Centro Legal
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/precios"
              className="text-xs font-medium text-[#a1a1aa] hover:text-[#f1f1ee] transition-colors"
            >
              Precios
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-[#111113] border border-[#242426] hover:border-[#343438] text-[#f1f1ee] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al inicio</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        {/* Navegación entre páginas legales */}
        <nav
          aria-label="Documentos legales"
          className="flex flex-wrap items-center gap-2 pb-2 border-b border-[#1f1f23]"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.key === doc.key;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-[#f1f1ee] text-[#0c0c0c]'
                    : 'bg-[#111113] text-[#a1a1aa] border border-[#242426] hover:text-[#f1f1ee]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <Link
            to="/arrepentimiento"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#111113] text-[#bec8ff] border border-[#bec8ff]/30 hover:bg-[#18181d] transition-all ml-auto"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Botón de Arrepentimiento</span>
          </Link>
        </nav>

        {/* Encabezado del documento */}
        <div className="rounded-3xl bg-[#111113] border border-[#242426] p-6 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2fb36a]/15 text-[#2fb36a] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{doc.normativeBadge}</span>
            </span>
            <span className="text-xs text-[#a1a1aa]">
              Última actualización: {doc.lastUpdated}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#f1f1ee]">
            {doc.title}
          </h1>
          <p className="text-sm text-[#a1a1aa] leading-relaxed">{doc.subtitle}</p>

          {/* Resumen rápido en lenguaje claro */}
          <div className="pt-4 border-t border-[#242426] space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#bec8ff]">
              Resumen en lenguaje claro
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {doc.summaryPoints.map((pt, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-[#18181b] border border-[#242426] text-xs text-[#e4e4e7]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#2fb36a] shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Secciones completas */}
        <div className="space-y-5">
          {doc.sections.map((section, idx) => (
            <section
              key={idx}
              className="rounded-2xl bg-[#111113] border border-[#242426] p-6 sm:p-7 space-y-3"
            >
              <h2 className="text-lg font-bold text-[#f1f1ee]">{section.title}</h2>
              {section.paragraphs.map((p, pIdx) => (
                <p key={pIdx} className="text-xs sm:text-sm text-[#c4c2c3] leading-relaxed">
                  {p}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="space-y-2 pt-2">
                  {section.bullets.map((b, bIdx) => (
                    <li
                      key={bIdx}
                      className="flex items-start gap-2.5 text-xs sm:text-sm text-[#d4d4d8]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2fb36a] shrink-0 mt-2" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Panel interactivo de Consentimiento y Microsoft Clarity */}
        <section className="rounded-2xl bg-[#111113] border border-[#28282c] p-6 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Cookie className="w-4 h-4 text-[#bec8ff]" />
                <h3 className="text-base font-bold text-[#f1f1ee]">
                  Preferencias de Consentimiento y Microsoft Clarity (ID: {CLARITY_PROJECT_ID})
                </h3>
              </div>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Podés activar o desactivar en cualquier momento la analítica de experiencia de
                usuario de Microsoft Clarity en este navegador. Las cookies técnicas de sesión y
                seguridad permanecen activas por ser indispensables.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleClarity(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  clarityEnabled
                    ? 'bg-[#2fb36a] text-[#08120c]'
                    : 'bg-[#18181b] text-[#a1a1aa] border border-[#2c2c30]'
                }`}
              >
                Permitir Clarity
              </button>
              <button
                type="button"
                onClick={() => handleToggleClarity(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  !clarityEnabled
                    ? 'bg-[#f1f1ee] text-[#0c0c0c]'
                    : 'bg-[#18181b] text-[#a1a1aa] border border-[#2c2c30]'
                }`}
              >
                Solo técnicas
              </button>
            </div>
          </div>

          {savedNotice && (
            <p className="text-xs text-[#2fb36a] font-medium">{savedNotice}</p>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#242426] bg-[#0c0c0c] py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#a1a1aa]">
          <p>© {new Date().getFullYear()} toque™ — Todos los derechos reservados · República Argentina.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/terminos" className="hover:text-[#f1f1ee]">
              Términos
            </Link>
            <Link to="/privacidad" className="hover:text-[#f1f1ee]">
              Privacidad
            </Link>
            <Link to="/cookies" className="hover:text-[#f1f1ee]">
              Cookies y Clarity
            </Link>
            <Link to="/reembolso" className="hover:text-[#f1f1ee]">
              Reembolsos
            </Link>
            <Link to="/arrepentimiento" className="hover:text-[#f1f1ee]">
              Botón de Arrepentimiento
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
