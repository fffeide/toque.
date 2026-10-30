import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../api';
import { CashierMemberLookupResult, ClubLocal } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/formatters';
import {
  QrCode,
  Search,
  CheckCircle2,
  Gift,
  Store,
  Check,
  Camera,
  X,
  AlertCircle,
  Loader2,
  Delete,
  Calendar,
} from 'lucide-react';

export const ClubScannerView: React.FC = () => {
  const { showToast } = useToast();

  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState<string>('');
  const [codeQuery, setCodeQuery] = useState('');

  // 4 Estados de la pantalla: vacío ('idle'), cargando ('loading'), error ('error'), encontrado/éxito ('found')
  const [viewState, setViewState] = useState<'idle' | 'loading' | 'error' | 'found'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lookupResult, setLookupResult] = useState<CashierMemberLookupResult | null>(null);

  // Estado para programa por monto (teclado numérico del monto del ticket)
  const [ticketAmountStr, setTicketAmountStr] = useState<string>('0');

  // Estado de acción y mensaje grande de éxito con animación corta (transform + opacity)
  const [processing, setProcessing] = useState(false);
  const [successBanner, setSuccessBanner] = useState<{
    title: string;
    newCountText: string;
    subtitle: string;
  } | null>(null);

  // Escáner de cámara
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    api
      .listLocals()
      .then((locs) => {
        setLocals(locs);
        if (locs[0]) {
          setSelectedLocalId(locs[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const performLookup = async (rawCode: string, keepSuccessBanner = false) => {
    const clean = rawCode.trim();
    if (!clean) {
      setViewState('idle');
      setLookupResult(null);
      setErrorMessage('');
      return;
    }

    setViewState('loading');
    setErrorMessage('');
    if (!keepSuccessBanner) {
      setSuccessBanner(null);
    }

    try {
      const res = await api.lookupMemberByCode(clean);
      setLookupResult(res);
      setViewState('found');
    } catch (err: any) {
      setLookupResult(null);
      setErrorMessage(
        err?.message || 'No encontramos ese código. Revisalo y probá de nuevo.'
      );
      setViewState('error');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(codeQuery, false);
  };

  const startCameraScan = async () => {
    setCameraError(null);
    setCameraOpen(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Tu navegador no permite abrir la cámara directamente. Escribí el código corto.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if ('BarcodeDetector' in window) {
        // @ts-expect-error BarcodeDetector API en navegadores compatibles
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const interval = setInterval(async () => {
          if (!videoRef.current || !streamRef.current) {
            clearInterval(interval);
            return;
          }
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              const rawVal = String(barcodes[0].rawValue).trim();
              clearInterval(interval);
              stopCamera();
              setCodeQuery(rawVal.toUpperCase());
              performLookup(rawVal, false);
            }
          } catch {
            // continuar escaneando
          }
        }, 350);
      }
    } catch {
      setCameraError(
        'No pudimos acceder a la cámara. Revisá los permisos o escribí el código corto manualmente.'
      );
    }
  };

  // Teclado numérico para monto del ticket cuando el programa es por monto
  const handleAmountDigit = (digit: string) => {
    setTicketAmountStr((prev) => {
      if (prev === '0') return digit;
      if (prev.length >= 8) return prev;
      return prev + digit;
    });
  };

  const handleAmountBackspace = () => {
    setTicketAmountStr((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  const handleAmountClear = () => {
    setTicketAmountStr('0');
  };

  const ticketAmountNumber = Number(ticketAmountStr) || 0;
  const amountPerStamp = lookupResult?.amountPerStamp || 5000;
  const previewStampsForAmount =
    lookupResult?.programMode === 'per_amount'
      ? Math.floor(ticketAmountNumber / Math.max(1, amountPerStamp))
      : 1;

  // REGLA GENERAL: el navegador NUNCA manda cuántos sellos o puntos sumar.
  // Solo manda el código de la persona (y el monto del ticket cuando el programa es por monto).
  const handleAddStamp = async () => {
    if (!lookupResult) return;
    if (!lookupResult.canStampNow) return;

    if (lookupResult.programMode === 'per_amount' && ticketAmountNumber <= 0) {
      showToast('Ingresá el monto del ticket antes de sumar.', 'error');
      return;
    }

    try {
      setProcessing(true);
      setSuccessBanner(null);

      const res = await api.addStampByCashier({
        memberCode: lookupResult.shortCode,
        amount: lookupResult.programMode === 'per_amount' ? ticketAmountNumber : undefined,
        localId: selectedLocalId || locals[0]?.id,
      });

      const refreshed = await api.lookupMemberByCode(lookupResult.shortCode);
      setLookupResult(refreshed);
      setTicketAmountStr('0');

      setSuccessBanner({
        title:
          res.stampsAdded === 1
            ? '¡Sumaste 1 sello!'
            : `¡Sumaste ${res.stampsAdded} sellos!`,
        newCountText: `${refreshed.stamps} / ${refreshed.targetStamps}`,
        subtitle: refreshed.rewardReady
          ? `Completó la tarjeta · Premio listo: ${refreshed.rewardText}`
          : refreshed.remainingStamps === 1
          ? 'Le falta 1 sello para el premio'
          : `Le faltan ${refreshed.remainingStamps} sellos para el premio`,
      });
    } catch (err: any) {
      showToast(err?.message || 'No pudimos sumar el sello. Probá de nuevo.', 'error');
      if (lookupResult?.shortCode) {
        performLookup(lookupResult.shortCode, true);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleRedeemReward = async () => {
    if (!lookupResult || !lookupResult.rewardReady) return;
    try {
      setProcessing(true);
      setSuccessBanner(null);

      await api.redeemReward(lookupResult.memberId || lookupResult.id);
      const refreshed = await api.lookupMemberByCode(lookupResult.shortCode);
      setLookupResult(refreshed);

      setSuccessBanner({
        title: '¡Premio entregado!',
        newCountText: `${refreshed.stamps} / ${refreshed.targetStamps}`,
        subtitle: `Se entregó: ${refreshed.rewardText}`,
      });
    } catch (err: any) {
      showToast(err?.message || 'No pudimos registrar la entrega del premio.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const remainingText = lookupResult
    ? lookupResult.remainingStamps === 0
      ? '¡Tarjeta completa!'
      : lookupResult.remainingStamps === 1
      ? 'Le falta 1 sello'
      : `Le faltan ${lookupResult.remainingStamps} sellos`
    : '';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#F4F4F6]">Sumar sello</h1>
          <p className="text-xs sm:text-sm text-[#9E9EA8] mt-0.5">
            Escribí el código corto de la persona o escaneá su QR con la cámara.
          </p>
        </div>

        {locals.length > 0 && (
          <div className="flex items-center gap-2 bg-[#141414] border border-[#242424] rounded-xl px-3 py-2 self-start sm:self-auto">
            <Store className="w-4 h-4 text-[#D95B26]" />
            <select
              value={selectedLocalId}
              onChange={(e) => setSelectedLocalId(e.target.value)}
              aria-label="Seleccionar sucursal"
              className="bg-transparent text-xs font-semibold text-[#F4F4F6] focus:outline-none cursor-pointer"
            >
              {locals.map((l) => (
                <option key={l.id} value={l.id} className="bg-[#141414] text-[#F4F4F6]">
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Campo grande de código corto + Botón cámara */}
      <div className="rounded-2xl bg-[#141414] border border-[#242424] p-4 sm:p-6 space-y-4">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <label
            htmlFor="short-code-input"
            className="block text-xs font-semibold text-[#9E9EA8]"
          >
            Código de la persona (formato K7M2-9XQ4)
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-[#9E9EA8] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="short-code-input"
                type="text"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value.toUpperCase())}
                placeholder="K7M2-9XQ4"
                autoComplete="off"
                spellCheck={false}
                className="w-full pl-12 pr-10 py-4 rounded-xl bg-[#0A0A0A] border border-[#242424] text-lg sm:text-xl font-mono font-bold tracking-wider text-[#F4F4F6] placeholder-[#52525B] focus:outline-none focus:border-[#D95B26] uppercase"
              />
              {codeQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setCodeQuery('');
                    setViewState('idle');
                    setLookupResult(null);
                    setErrorMessage('');
                    setSuccessBanner(null);
                  }}
                  aria-label="Limpiar código"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#9E9EA8] hover:text-[#F4F4F6] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={viewState === 'loading' || !codeQuery.trim()}
              className="px-6 py-4 rounded-xl bg-[#D95B26] hover:bg-[#e06530] disabled:opacity-50 text-white font-bold text-sm transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-2"
            >
              {viewState === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <span>Buscar código</span>
              )}
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={cameraOpen ? stopCamera : startCameraScan}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0A0A0A] hover:bg-[#1C1C22] border border-[#242424] text-xs font-semibold text-[#F4F4F6] flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4 text-[#D95B26]" />
            <span>{cameraOpen ? 'Cerrar cámara' : 'Escanear QR con la cámara'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCodeQuery('K7M2-9XQ4');
              performLookup('K7M2-9XQ4', false);
            }}
            className="text-xs text-[#9E9EA8] hover:text-[#F4F4F6] underline cursor-pointer"
          >
            Probar con ejemplo: K7M2-9XQ4
          </button>
        </div>

        {/* Vista de cámara si está abierta */}
        {cameraOpen && (
          <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#242424] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#F4F4F6] flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#D95B26]" />
                Apuntá al código QR de la tarjeta del cliente
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="text-xs text-[#9E9EA8] hover:text-[#F4F4F6] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            {cameraError ? (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                {cameraError}
              </p>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-60 mx-auto flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <div className="absolute inset-6 border-2 border-[#D95B26]/70 rounded-2xl pointer-events-none" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ESTADO 1: VACÍO */}
      {viewState === 'idle' && (
        <div className="rounded-2xl bg-[#141414] border border-[#242424] p-8 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#0A0A0A] border border-[#242424] text-[#D95B26] flex items-center justify-center mx-auto">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold text-[#F4F4F6]">
            Ingresá o escaneá un código para empezar
          </h2>
          <p className="text-xs text-[#9E9EA8] max-w-md mx-auto">
            Pedile a la persona el código corto que figura en su tarjeta (por ejemplo, K7M2-9XQ4) o escaneá su QR desde el celular o la tablet.
          </p>
        </div>
      )}

      {/* ESTADO 2: CARGANDO */}
      {viewState === 'loading' && (
        <div className="rounded-2xl bg-[#141414] border border-[#242424] p-8 text-center space-y-3">
          <Loader2 className="w-7 h-7 text-[#D95B26] animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[#F4F4F6]">Buscando tarjeta...</p>
        </div>
      )}

      {/* ESTADO 3: ERROR */}
      {viewState === 'error' && (
        <div
          role="alert"
          className="rounded-2xl bg-[#141414] border border-red-500/40 p-6 flex items-start gap-3.5"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[#F4F4F6]">
              {errorMessage || 'No encontramos ese código. Revisalo y probá de nuevo.'}
            </h2>
            <p className="text-xs text-[#9E9EA8]">
              Verificá que esté bien escrito y volvé a intentar.
            </p>
          </div>
        </div>
      )}

      {/* ESTADO 4: ÉXITO (Banner grande después de sumar o entregar premio, animación corta transform + opacity) */}
      {successBanner && (
        <div
          role="status"
          className="rounded-2xl bg-[#2FB36A]/15 border-2 border-[#2FB36A] p-5 text-center space-y-1.5 transition-all duration-300 ease-out transform opacity-100 scale-100 motion-reduce:transition-none motion-reduce:transform-none"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#2FB36A] text-[#07150D] flex items-center justify-center mx-auto mb-1">
            <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-[#F4F4F6]">
            {successBanner.title}
          </p>
          <p className="text-3xl sm:text-4xl font-extrabold font-mono text-[#2FB36A] tabular-nums">
            {successBanner.newCountText}
          </p>
          <p className="text-xs sm:text-sm font-medium text-[#F4F4F6]">
            {successBanner.subtitle}
          </p>
        </div>
      )}

      {/* FICHA DE LA PERSONA ENCONTRADA (Sin mail ni cumpleaños para proteger privacidad en caja) */}
      {viewState === 'found' && lookupResult && (
        <div className="rounded-3xl bg-[#141414] border border-[#242424] p-5 sm:p-6 space-y-5">
          {/* Datos principales: Nombre + inicial del apellido, sellos 4 / 5, cuánto le falta, fecha último sello */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
            <div className="space-y-1">
              <span className="inline-block text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-[#0A0A0A] border border-[#242424] text-[#D95B26]">
                {lookupResult.shortCode}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F4F4F6]">
                {lookupResult.displayName}
              </h2>
              <p className="text-xs text-[#9E9EA8] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#9E9EA8]" />
                <span>
                  Último sello:{' '}
                  <strong className="text-[#F4F4F6]">
                    {lookupResult.lastStampedAt
                      ? formatDate(lookupResult.lastStampedAt)
                      : 'Sin sellos previos'}
                  </strong>
                </span>
              </p>
            </div>

            <div className="sm:text-right bg-[#0A0A0A] border border-[#242424] rounded-2xl px-4 py-3">
              <span className="block text-xs font-semibold text-[#9E9EA8]">Sellos</span>
              <span className="text-3xl sm:text-4xl font-extrabold text-[#F4F4F6] font-mono tabular-nums">
                {lookupResult.stamps} / {lookupResult.targetStamps}
              </span>
              <span className="block text-xs font-bold text-[#D95B26] mt-0.5">
                {remainingText}
              </span>
            </div>
          </div>

          {/* Grilla visual de sellos */}
          <div
            className="grid gap-2 p-4 rounded-2xl bg-[#0A0A0A] border border-[#242424]"
            style={{
              gridTemplateColumns: `repeat(${Math.min(5, Math.max(1, lookupResult.targetStamps))}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: lookupResult.targetStamps }).map((_, idx) => {
              const slot = idx + 1;
              const earned = slot <= lookupResult.stamps;
              return (
                <div
                  key={slot}
                  className={`h-11 rounded-xl flex items-center justify-center font-bold text-xs transition-opacity duration-200 motion-reduce:transition-none ${
                    earned
                      ? 'bg-[#2FB36A] text-[#07150D]'
                      : 'bg-[#141414] border border-[#242424] text-[#71717A]'
                  }`}
                >
                  {earned ? <Check className="w-4 h-4 stroke-[3]" /> : slot}
                </div>
              );
            })}
          </div>

          {/* Recuadro destacado si completó la tarjeta y tiene premio listo */}
          {lookupResult.rewardReady && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#2FB36A]/15 border-2 border-[#2FB36A] space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2FB36A] text-[#07150D] flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-extrabold text-[#F4F4F6]">
                    Premio listo: {lookupResult.rewardText}
                  </p>
                  <p className="text-xs text-[#9E9EA8] mt-0.5">
                    Al entregar el premio, la tarjeta vuelve a 0 para empezar una nueva.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={processing}
                onClick={handleRedeemReward}
                className="w-full py-3.5 px-5 rounded-xl bg-[#2FB36A] hover:bg-[#289e5c] disabled:opacity-50 text-[#07150D] font-extrabold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Gift className="w-4 h-4" />
                <span>{processing ? 'Registrando entrega...' : 'Entregar premio'}</span>
              </button>
            </div>
          )}

          {/* Si el programa es por monto, aparece teclado numérico para ingresar el monto del ticket */}
          {lookupResult.programMode === 'per_amount' && lookupResult.canStampNow && (
            <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#242424] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#F4F4F6] block">
                    Monto del ticket
                  </span>
                  <span className="text-[11px] text-[#9E9EA8]">
                    1 sello cada ${(lookupResult.amountPerStamp || 5000).toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold font-mono text-[#F4F4F6] tabular-nums">
                    ${ticketAmountNumber.toLocaleString('es-AR')}
                  </span>
                  <span className="block text-xs font-bold text-[#D95B26]">
                    Sumaría {previewStampsForAmount}{' '}
                    {previewStampsForAmount === 1 ? 'sello' : 'sellos'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleAmountDigit(digit)}
                    className="h-11 rounded-xl bg-[#141414] hover:bg-[#1C1C22] border border-[#242424] text-base font-bold font-mono text-[#F4F4F6] cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleAmountClear}
                  className="h-11 rounded-xl bg-[#141414] hover:bg-[#1C1C22] border border-[#242424] text-xs font-bold text-[#9E9EA8] hover:text-[#F4F4F6] cursor-pointer"
                >
                  Borrar
                </button>
                <button
                  type="button"
                  onClick={() => handleAmountDigit('0')}
                  className="h-11 rounded-xl bg-[#141414] hover:bg-[#1C1C22] border border-[#242424] text-base font-bold font-mono text-[#F4F4F6] cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleAmountBackspace}
                  aria-label="Borrar último número"
                  className="h-11 rounded-xl bg-[#141414] hover:bg-[#1C1C22] border border-[#242424] flex items-center justify-center text-[#9E9EA8] hover:text-[#F4F4F6] cursor-pointer"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Botón principal "Sumar sello" o estado desactivado con mensaje de espera */}
          <button
            type="button"
            disabled={
              processing ||
              !lookupResult.canStampNow ||
              (lookupResult.programMode === 'per_amount' && previewStampsForAmount <= 0)
            }
            onClick={handleAddStamp}
            className={`w-full py-4 px-6 rounded-2xl font-extrabold text-base transition-colors flex items-center justify-center gap-2 ${
              !lookupResult.canStampNow
                ? 'bg-[#1C1C22] border border-[#282830] text-[#9E9EA8] cursor-not-allowed'
                : 'bg-[#D95B26] hover:bg-[#e06530] text-white cursor-pointer shadow-lg'
            } disabled:opacity-60`}
          >
            {!lookupResult.canStampNow ? (
              <span>{lookupResult.cooldownMessage || 'Podrá sumar de nuevo mañana'}</span>
            ) : processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Sumando sello...</span>
              </>
            ) : (
              <span>Sumar sello</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
