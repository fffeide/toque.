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

        // 3. Redirección automática inmediata sin demora artificial
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

      <div className="relative z-10 max-w-sm w-full p-8 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-2xl text-center space-y-6 shadow-2xl">
        {/* Logo / Ondas de Toque */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg border border-white/30 animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider">
            <Zap className="w-3 h-3 text-emerald-300" />
            Telemetría de Toque &lt;40ms
          </span>
          <h1 className="text-xl sm:text-2xl font-headline font-bold text-white tracking-tight">
            Conectando con Google Reseñas
          </h1>
          <p className="text-xs text-white/75">
            {cartel?.name || 'Abriendo ficha oficial del salón...'}
          </p>
        </div>

        {/* Micro-loader animado */}
        <div className="flex items-center justify-center gap-2 py-1">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" />
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.15s]" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.3s]" />
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
