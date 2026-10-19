import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#242424] hover:border-[#D95B26] text-[#f1f1ee] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#141414] border border-[#242424] hover:border-[#D95B26] text-[#f1f1ee] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-3.5 h-3.5 text-[#D95B26] shrink-0" />
        <span>{isIOS ? 'Instalar en iPhone' : 'Instalar App'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]/90 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] border border-[#242424] p-5 space-y-4 text-[#f1f1ee]">
            <div className="flex items-center justify-between border-b border-[#242424] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D95B26] text-[#0A0A0A] flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#f1f1ee]">Instalar Toque en tu inicio</h3>
                  <p className="text-[11px] text-[#a1a1aa]">Acceso directo sin tiendas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-8 h-8 rounded-lg bg-[#0A0A0A] border border-[#242424] flex items-center justify-center text-[#a1a1aa] hover:text-[#f1f1ee]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-[#a1a1aa] leading-relaxed">
              <p className="text-[#f1f1ee] font-medium">
                {isIOS
                  ? 'En iPhone / iPad (Safari):'
                  : 'En Android o Chrome de escritorio:'}
              </p>
              <ol className="list-decimal list-inside space-y-1.5">
                {isIOS ? (
                  <>
                    <li>
                      Tocá el botón <strong className="text-[#f1f1ee]">Compartir</strong> en la
                      barra inferior de Safari.
                    </li>
                    <li>
                      Elegí <strong className="text-[#f1f1ee]">Agregar a pantalla de inicio</strong>.
                    </li>
                    <li>
                      Confirmá tocando <strong className="text-[#D95B26]">Agregar</strong>.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      Abrí el menú del navegador (tres puntos arriba a la derecha).
                    </li>
                    <li>
                      Seleccioná <strong className="text-[#f1f1ee]">Instalar aplicación</strong> o{' '}
                      <strong className="text-[#f1f1ee]">Agregar a la pantalla principal</strong>.
                    </li>
                  </>
                )}
              </ol>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#e56934] text-[#0A0A0A] text-xs font-bold transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
