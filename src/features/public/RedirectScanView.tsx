/**
 * Toque — Redireccionador Ultrarrápido de Escaneo y Telemetría (/r/:shortCode)
 * - Captura la mayor cantidad de datos en <40ms sin demorar la experiencia del cliente:
 *   dispositivo, sistema operativo, resolución, conexión, idioma, timezone, referrer, touch.
 * - Registra la telemetría en el sistema.
 * - Redirige automáticamente a la ficha de reseñas de Google Maps.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, Cartel, ScanTelemetry } from '../../api';
import { ExternalLink, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

// Ícono de carga animado provisto por el usuario
function AnimatedScanLoader({ size = 42, className = '', ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path strokeDasharray="24" d="M12 20h5c0.5 0 1 -0.5 1 -1v-14M12 20h-5c-0.5 0 -1 -0.5 -1 -1v-14">
          <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.5s" values="24;0" />
        </path>
        <path strokeDasharray="18" strokeDashoffset="18" d="M4 5h16">
          <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.5s" dur="0.3s" to="0" />
        </path>
        <path strokeDasharray="10" strokeDashoffset="10" d="M10 4h4M10 9v7M14 9v7">
          <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.8s" dur="0.2s" to="0" />
        </path>
      </g>
    </svg>
  );
}

export const RedirectScanView: React.FC = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [searchParams] = useSearchParams();
  const [cartel, setCartel] = useState<Cartel | null>(null);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [status, setStatus] = useState<'collecting' | 'redirecting' | 'error'>('collecting');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!shortCode) {
      setStatus('error');
      setErrorMessage('Código de cartel inválido');
      return;
    }

    const processScanAndRedirect = async () => {
      try {
        // 1. Recolección exhaustiva de datos del cliente en microsegundos
        const ua = navigator.userAgent || '';
        const isIOS = /iPhone|iPad|iPod/i.test(ua);
        const isAndroid = /Android/i.test(ua);
        const userAgentDevice = isIOS ? 'ios' : isAndroid ? 'android' : 'other';

        // Detección de navegador
        let browser = 'Other';
        if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
        else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
        else if (/Firefox/i.test(ua)) browser = 'Firefox';
        else if (/Edg/i.test(ua)) browser = 'Edge';
        else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';

        // Conexión de red si está soportada
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        const connectionType = connection ? `${connection.effectiveType || ''} (${connection.downlink || ''}Mbps)` : undefined;

        // Resolución de pantalla y orientación
        const screenRes = typeof window !== 'undefined'
          ? `${window.screen?.width || 0}x${window.screen?.height || 0} (${window.devicePixelRatio || 1}dpr)`
          : undefined;

        // Canal (por query param ?ch=nfc o ?ch=qr, por defecto qr)
        const channelParam = searchParams.get('ch');
        const channel = channelParam === 'nfc' ? 'nfc' : 'qr';

        // Touch support
        const touchSupported = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

        // Telemetría compilada
        const telemetry: ScanTelemetry = {
          channel,
          userAgentDevice,
          browser,
          platform: navigator.platform || (navigator as any).userAgentData?.platform || 'Unknown',
          screenResolution: screenRes,
          language: navigator.language || (navigator.languages ? navigator.languages[0] : 'es'),
          connectionType,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          referrer: document.referrer || 'Direct Scan / Native Camera',
          touchSupported: !!touchSupported,
        };

        // 2. Registro inmediato en base de datos
        const result = await api.recordScan(shortCode, telemetry);
        setCartel(result.cartel);
        setTargetUrl(result.targetUrl);
        setStatus('redirecting');

        // 3. Pausa breve para permitir ver Toque™ y la animación de recolección de datos
        await new Promise((resolve) => setTimeout(resolve, 850));

        if (result.targetUrl) {
          window.location.replace(result.targetUrl);
        }
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err?.message || 'Cartel no encontrado o fuera de servicio.');
      }
    };

    processScanAndRedirect();
  }, [shortCode, searchParams]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#06101e] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center border border-rose-400/30">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h1 className="font-headline text-xl font-bold text-white">Cartel no disponible</h1>
          <p className="text-xs text-white/70 leading-relaxed">
            {errorMessage || 'Este código de cartel no existe o fue retirado temporalmente por el local.'}
          </p>
          <div className="pt-2">
            <a
              href="/"
              className="inline-block px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs text-white font-medium transition"
            >
              Volver al inicio
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040e1b] text-white flex items-center justify-center p-4 selection:bg-white/20 selection:text-white">
      {/* Fondo Aurora estético */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-blue-600/25 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[380px] h-[380px] rounded-full bg-emerald-500/20 blur-[130px]" />
      </div>

      <div className="relative z-10 max-w-sm w-full p-8 rounded-3xl bg-[rgba(10,20,36,0.96)] border border-white/20 backdrop-blur-2xl text-center space-y-5 shadow-2xl">
        {/* Marca Toque™ */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-2xl font-black tracking-tight text-white">
              Toque™
            </span>
          </div>
          <span className="text-[11px] font-medium text-white/60">
            Carteles inteligentes y reseñas en Google
          </span>
        </div>

        {/* Ícono de Carga Animado (Trazo Dinámico SVG) */}
        <div className="flex justify-center py-2 text-blue-400">
          <AnimatedScanLoader size={48} className="text-white drop-shadow-md" />
        </div>

        <div className="space-y-1">
          <h1 className="text-base sm:text-lg font-display font-semibold text-white tracking-tight">
            Abriendo Google Reseñas
          </h1>
          <p className="text-xs text-white/70">
            {cartel?.name ? `${cartel.name} • Redirigiendo...` : 'Redirigiendo a la ficha oficial...'}
          </p>
        </div>

        {/* Botón manual si no redirige automáticamente */}
        {targetUrl && (
          <div className="pt-2">
            <a
              href={targetUrl}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-950 hover:bg-slate-100 font-bold text-xs transition shadow-lg"
            >
              <span>Ir a reseñas ahora</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        <div className="text-[10px] text-white/50 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
          <span>Redirección segura certificada por Toque</span>
        </div>
      </div>
    </div>
  );
};

export default RedirectScanView;
