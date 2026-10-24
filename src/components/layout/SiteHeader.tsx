import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../lib/themeContext';
import { useAuth } from '../../lib/authContext';
import { Menu, X, Type, WifiOff } from 'lucide-react';

export const SiteHeader: React.FC = () => {
  const { largeText, toggleLargeText } = useTheme();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  const handleAnchorNav = (hash: string) => {
    setMobileMenuOpen(false);
    if (location.pathname === '/') {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate(`/#${hash}`);
  };

  return (
    <>
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-[#f59e0b] text-[#0c0c0c] px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Sin conexión a internet. Algunas acciones pueden tardar en actualizarse.</span>
        </div>
      )}

      <header className="sticky top-0 z-40 w-full bg-[#0c0c0c]/95 backdrop-blur border-b border-[#242426]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-[68px] flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-[#f1f1ee] font-bold text-xl tracking-tight whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#bec8ff] rounded-lg py-1"
          >
            <div className="w-9 h-9 rounded-full bg-[#f1f1ee] border border-[#242426] flex items-center justify-center shrink-0">
              <img
                src="/assets/logo.svg"
                alt="Toque"
                referrerPolicy="no-referrer"
                className="w-5 h-5 object-contain"
              />
            </div>
            <span>toque™</span>
          </Link>

          {/* Navegación Desktop */}
          <nav
            aria-label="Navegación principal"
            className="hidden lg:flex items-center gap-6 text-base font-medium text-[#d4d4d8]"
          >
            <button
              type="button"
              onClick={() => handleAnchorNav('como-funciona')}
              className="hover:text-[#f1f1ee] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-[#bec8ff] rounded"
            >
              Cómo funciona
            </button>
            <button
              type="button"
              onClick={() => handleAnchorNav('funciones')}
              className="hover:text-[#f1f1ee] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-[#bec8ff] rounded"
            >
              Funciones
            </button>
            <Link
              to="/precios"
              className="hover:text-[#f1f1ee] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 py-2 focus-visible:outline-2 focus-visible:outline-[#bec8ff] rounded"
            >
              Precios
            </Link>
            <Link
              to="/preguntas"
              className="hover:text-[#f1f1ee] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 py-2 focus-visible:outline-2 focus-visible:outline-[#bec8ff] rounded"
            >
              Preguntas
            </Link>
          </nav>

          {/* Acciones Derecha */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleLargeText}
              aria-pressed={largeText}
              className={`min-h-[48px] px-3.5 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bec8ff] ${
                largeText
                  ? 'bg-[#bec8ff] text-[#0c0c0c] border-[#bec8ff]'
                  : 'bg-[#18181b] text-[#f1f1ee] border-[#28282a] hover:border-[#bec8ff]'
              }`}
            >
              <Type className="w-4 h-4 shrink-0" />
              <span>{largeText ? 'Letra normal' : 'Letra más grande'}</span>
            </button>

            {user ? (
              <Link
                to="/panel/resumen"
                className="min-h-[48px] px-5 rounded-xl bg-[#bec8ff] text-[#0c0c0c] hover:bg-[#d4dcff] font-bold text-base inline-flex items-center justify-center whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bec8ff]"
              >
                Ir a mi panel
              </Link>
            ) : (
              <>
                <Link
                  to="/ingresar"
                  className="min-h-[48px] px-4 rounded-xl border border-[#28282a] bg-[#141416] hover:border-[#bec8ff] text-[#f1f1ee] font-semibold text-base inline-flex items-center justify-center whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bec8ff]"
                >
                  Ingresar
                </Link>
                <Link
                  to="/registro"
                  className="min-h-[48px] px-5 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] hover:bg-white font-bold text-base inline-flex items-center justify-center whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bec8ff]"
                >
                  Probar gratis
                </Link>
              </>
            )}
          </div>

          {/* Botones en Celular */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              type="button"
              onClick={toggleLargeText}
              aria-pressed={largeText}
              aria-label={largeText ? 'Volver a letra normal' : 'Activar letra más grande'}
              className={`min-h-[48px] px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#bec8ff] ${
                largeText
                  ? 'bg-[#bec8ff] text-[#0c0c0c] border-[#bec8ff]'
                  : 'bg-[#18181b] text-[#f1f1ee] border-[#28282a]'
              }`}
            >
              <Type className="w-4 h-4 shrink-0" />
              <span>Letra más grande</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-menu"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              className="min-h-[48px] min-w-[48px] rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#bec8ff]"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Menú desplegable en celular accesible por teclado */}
        {mobileMenuOpen && (
          <nav
            id="mobile-nav-menu"
            aria-label="Menú móvil"
            className="lg:hidden border-t border-[#242426] bg-[#111113] px-4 py-4 space-y-2"
          >
            <button
              type="button"
              onClick={() => handleAnchorNav('como-funciona')}
              className="w-full min-h-[48px] px-4 rounded-xl text-left text-base font-semibold text-[#f1f1ee] hover:bg-[#18181b] flex items-center cursor-pointer"
            >
              Cómo funciona
            </button>
            <button
              type="button"
              onClick={() => handleAnchorNav('funciones')}
              className="w-full min-h-[48px] px-4 rounded-xl text-left text-base font-semibold text-[#f1f1ee] hover:bg-[#18181b] flex items-center cursor-pointer"
            >
              Funciones
            </button>
            <Link
              to="/precios"
              className="w-full min-h-[48px] px-4 rounded-xl text-base font-semibold text-[#f1f1ee] hover:bg-[#18181b] flex items-center"
            >
              Precios
            </Link>
            <Link
              to="/preguntas"
              className="w-full min-h-[48px] px-4 rounded-xl text-base font-semibold text-[#f1f1ee] hover:bg-[#18181b] flex items-center"
            >
              Preguntas
            </Link>
            <Link
              to="/para-clientes"
              className="w-full min-h-[48px] px-4 rounded-xl text-base font-semibold text-[#d4d4d8] hover:bg-[#18181b] flex items-center"
            >
              ¿Sos cliente? Mirá cómo se usa
            </Link>

            <div className="pt-3 border-t border-[#242426] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Link
                to="/ingresar"
                className="min-h-[48px] px-4 rounded-xl border border-[#28282a] bg-[#18181b] text-[#f1f1ee] font-bold text-base flex items-center justify-center"
              >
                Ingresar
              </Link>
              <Link
                to="/registro"
                className="min-h-[48px] px-4 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-base flex items-center justify-center"
              >
                Probar gratis
              </Link>
            </div>
          </nav>
        )}
      </header>
    </>
  );
};

export const SiteFooter: React.FC = () => {
  return (
    <footer className="border-t border-[#242426] bg-[#0c0c0c] text-[#d4d4d8] py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <Link to="/" className="inline-flex items-center gap-2.5 font-bold text-lg text-[#f1f1ee]">
            <div className="w-7 h-7 rounded-full bg-[#f1f1ee] border border-[#242426] flex items-center justify-center">
              <img
                src="/assets/logo.svg"
                alt=""
                referrerPolicy="no-referrer"
                className="w-4 h-4 object-contain"
              />
            </div>
            <span>toque™</span>
          </Link>
          <p className="text-base text-[#a1a1aa] leading-relaxed">
            Tu tarjeta de sellos, en el celular. Sin instalar nada y sin papelitos.
          </p>
          <p className="text-sm text-[#a1a1aa]">
            Contacto:{' '}
            <a href="mailto:hola@toque.ar" className="text-[#f1f1ee] underline">
              hola@toque.ar
            </a>
          </p>
        </div>

        <div className="space-y-2.5">
          <p className="font-bold text-base text-[#f1f1ee]">Funciones</p>
          <ul className="space-y-2 text-base">
            <li>
              <Link to="/club" className="hover:text-[#f1f1ee] hover:underline">
                Toque Club (Disponible hoy)
              </Link>
            </li>
            <li>
              <Link to="/estrellas" className="hover:text-[#f1f1ee] hover:underline">
                Toque Estrellas (Próximamente)
              </Link>
            </li>
            <li>
              <Link to="/recibo" className="hover:text-[#f1f1ee] hover:underline">
                Toque Recibo (Próximamente)
              </Link>
            </li>
            <li>
              <Link to="/toquecitos" className="hover:text-[#f1f1ee] hover:underline">
                Toquecitos (Próximamente)
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-2.5">
          <p className="font-bold text-base text-[#f1f1ee]">Sitio</p>
          <ul className="space-y-2 text-base">
            <li>
              <Link to="/precios" className="hover:text-[#f1f1ee] hover:underline">
                Precios
              </Link>
            </li>
            <li>
              <Link to="/preguntas" className="hover:text-[#f1f1ee] hover:underline">
                Preguntas frecuentes
              </Link>
            </li>
            <li>
              <Link to="/para-clientes" className="hover:text-[#f1f1ee] hover:underline">
                Para clientes
              </Link>
            </li>
            <li>
              <Link to="/ingresar" className="hover:text-[#f1f1ee] hover:underline">
                Ingresar a mi cuenta
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-2.5">
          <p className="font-bold text-base text-[#f1f1ee]">Legales y privacidad</p>
          <ul className="space-y-2 text-base">
            <li>
              <Link to="/privacidad" className="hover:text-[#f1f1ee] hover:underline">
                Política de privacidad
              </Link>
            </li>
            <li>
              <Link to="/terminos" className="hover:text-[#f1f1ee] hover:underline">
                Términos y condiciones
              </Link>
            </li>
            <li>
              <Link to="/cookies" className="hover:text-[#f1f1ee] hover:underline">
                Política de cookies
              </Link>
            </li>
            <li>
              <Link to="/arrepentimiento" className="hover:text-[#f1f1ee] hover:underline">
                Botón de arrepentimiento
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-[#242426] flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#a1a1aa]">
        <p>© {new Date().getFullYear()} Toque. República Argentina. Ley 25.326 de Protección de Datos Personales.</p>
        <p>Hecho para comercios y clientes de todas las edades.</p>
      </div>
    </footer>
  );
};
