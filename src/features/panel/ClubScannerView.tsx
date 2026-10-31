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
  Barcode,
  Plus,
} from 'lucide-react';

export const ClubScannerView: React.FC = () => {
  const { showToast } = useToast();

  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState<string>('');
  const [codeQuery, setCodeQuery] = useState('');
  const [quickNumericCode, setQuickNumericCode] = useState('');

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

  const handleDirectStampByCode = async (rawCode: string) => {
    const clean = rawCode.replace(/[\s-]/g, '').trim();
    if (!clean) {
      showToast('Ingresá los 8 números debajo del código de barras.', 'error');
      return;
    }

    try {
      setProcessing(true);
      setErrorMessage('');
      setSuccessBanner(null);

      const merchantToken = localStorage.getItem('toque_merchant_token');
      const d1Res = await fetch('/api/merchant/stamp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(merchantToken ? { Authorization: `Bearer ${merchantToken}` } : {}),
        },
        body: JSON.stringify({ code: clean }),
      }).catch(() => null);

      if (d1Res && d1Res.ok) {
        const d1Json = await d1Res.json();
        if (d1Json.member) {
          const m = d1Json.member;
          const target = m.stampsRequired || 10;
          const current = m.stamps || 1;
          const remaining = Math.max(0, target - current);
          const mappedLookup: CashierMemberLookupResult = {
            id: m.id,
            memberId: m.id,
            shortCode: m.barcodeToken || clean,
            memberCode: m.barcodeToken || clean,
            displayName: m.name || 'Cliente',
            stamps: current,
            targetStamps: target,
            remainingStamps: remaining,
            rewardReady: remaining === 0,
            rewardPending: remaining === 0,
            rewardText: 'Premio al completar tus sellos',
            lastStampedAt: m.lastStampedAt || new Date().toISOString(),
            canStampNow: false,
            cooldownMessage: 'Podrá sumar de nuevo mañana',
            programMode: 'per_visit',
          };
          setLookupResult(mappedLookup);
          setViewState('found');
          setQuickNumericCode('');
          setCodeQuery(m.barcodeToken || clean);
          setSuccessBanner({
            title: `Sello sumado a ${m.name || 'Cliente'}`,
            newCountText: `${current} / ${target}`,
            subtitle:
              remaining === 0
                ? 'Completó la tarjeta · Premio disponible'
                : remaining === 1
                ? 'Le falta 1 sello para el premio'
                : `Le faltan ${remaining} sellos para el premio`,
          });
          // Sync with mockApi in background if present
          api.addStampByCashier({ memberCode: m.barcodeToken || clean }).catch(() => {});
          return;
        }
      } else if (d1Res && d1Res.status === 429) {
        const d1Err = await d1Res.json().catch(() => ({}));
        showToast(d1Err.error || 'Podrá sumar de nuevo mañana.', 'info');
        return;
      }

      // Primero consultamos el socio y validamos la regla de 24 horas
      const memberLookup = await api.lookupMemberByCode(clean);
      setLookupResult(memberLookup);
      setViewState('found');

      if (!memberLookup.canStampNow) {
        showToast(memberLookup.cooldownMessage || 'Podrá sumar de nuevo mañana.', 'info');
        return;
      }

      if (memberLookup.programMode === 'per_amount' && ticketAmountNumber <= 0) {
        showToast('Ingresá el monto del ticket antes de sumar.', 'info');
        return;
      }

      const res = await api.addStampByCashier({
        memberCode: memberLookup.shortCode || clean,
        amount: memberLookup.programMode === 'per_amount' ? ticketAmountNumber : undefined,
        localId: selectedLocalId || locals[0]?.id,
      });

      if (res.cooldown) {
        showToast(res.message || 'Podrá sumar de nuevo mañana.', 'info');
        return;
      }

      const refreshed = await api.lookupMemberByCode(memberLookup.shortCode || clean);
      setLookupResult(refreshed);
      setQuickNumericCode('');
      setCodeQuery(refreshed.shortCode || clean);
      setTicketAmountStr('0');

      setSuccessBanner({
        title:
          res.stampsAdded === 1
            ? `Sello sumado a ${refreshed.displayName}`
            : `¡Sumaste ${res.stampsAdded} sellos!`,
        newCountText: `${refreshed.stamps} / ${refreshed.targetStamps}`,
        subtitle: refreshed.rewardReady
          ? `Completó la tarjeta · Premio disponible: ${refreshed.rewardText}`
          : refreshed.remainingStamps === 1
          ? 'Le falta 1 sello para el premio'
          : `Le faltan ${refreshed.remainingStamps} sellos para el premio`,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'No encontramos ese código. Revisalo y probá de nuevo.');
      setViewState('error');
      showToast(err?.message || 'No pudimos sumar el sello.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickNumericSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleDirectStampByCode(quickNumericCode);
  };

  const startCameraScan = async () => {
    setCameraError(null);
    setCameraOpen(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Tu navegador no permite abrir la cámara directamente. Escribí los 8 números debajo del código de barras.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if ('BarcodeDetector' in window) {
        // @ts-expect-error BarcodeDetector en navegadores compatibles
        const detector = new window.BarcodeDetector({ formats: ['code_128', 'qr_code'] });
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
              setCodeQuery(rawVal);
              setQuickNumericCode(rawVal.replace(/\D/g, '').slice(0, 8));
              handleDirectStampByCode(rawVal);
            }
          } catch {
            // continuar escaneando
          }
        }, 350);
      }
    } catch {
      setCameraError(
        'No pudimos acceder a la cámara. Revisá los permisos o escribí los 8 números manualmente.'
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
          ? `Completó la tarjeta · Premio disponible: ${refreshed.rewardText}`
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
            Escaneá el código de barras de la tarjeta con la cámara o ingresá los 8 números debajo del código.
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

      {/* Recuadro de cámara + Campo numérico rápido siempre visible debajo */}
      <div className="rounded-2xl bg-[#141414] border border-[#242424] p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={cameraOpen ? stopCamera : startCameraScan}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0A0A0A] hover:bg-[#1C1C22] border border-[#242424] text-xs font-semibold text-[#F4F4F6] flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4 text-[#D95B26]" />
            <span>{cameraOpen ? 'Cerrar cámara' : 'Abrir cámara para escanear código de barras o QR'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickNumericCode('48291037');
              setCodeQuery('48291037');
              performLookup('48291037', false);
            }}
            className="text-xs text-[#9E9EA8] hover:text-[#F4F4F6] underline cursor-pointer"
          >
            Probar con ejemplo: 48291037
          </button>
        </div>

        {/* Vista de cámara si está abierta */}
        {cameraOpen && (
          <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#242424] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#F4F4F6] flex items-center gap-2">
                <Barcode className="w-4 h-4 text-[#D95B26]" />
                Apuntá al código de barras o QR de la tarjeta del cliente
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

        {/* Campo numérico rápido siempre visible debajo del recuadro de la cámara */}
        <form onSubmit={handleQuickNumericSubmit} className="space-y-2.5 pt-2 border-t border-[#242424]">
          <label
            htmlFor="quick-numeric-code"
            className="block text-xs font-semibold text-[#9E9EA8]"
          >
            Carga rápida por código numérico (8 dígitos)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 text-[#D95B26] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="quick-numeric-code"
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={quickNumericCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setQuickNumericCode(val);
                  setCodeQuery(val);
                }}
                placeholder="Ingresá los 8 números debajo del código de barras"
                autoComplete="off"
                className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-[#0A0A0A] border border-[#242424] text-base sm:text-lg font-mono font-bold tracking-wider text-[#F4F4F6] placeholder-[#52525B] focus:outline-none focus:border-[#D95B26]"
              />
              {quickNumericCode && (
                <button
                  type="button"
                  onClick={() => {
                    setQuickNumericCode('');
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
              disabled={processing || !quickNumericCode.trim()}
              className="px-6 py-3.5 rounded-xl bg-[#D95B26] hover:bg-[#e06530] disabled:opacity-50 text-white font-bold text-sm transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sumando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Sumar sello</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Búsqueda alternativa para ver tarjeta antes de sumar */}
        <form onSubmit={handleSearchSubmit} className="pt-2 border-t border-[#242424] flex flex-col sm:flex-row gap-2.5 items-center">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="short-code-input"
              type="text"
              maxLength={12}
              value={codeQuery}
              onChange={(e) => setCodeQuery(e.target.value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 12))}
              placeholder="Buscar tarjeta sin sumar todavía (ej. 48291037)"
              autoComplete="off"
              spellCheck={false}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#242424] text-xs font-mono font-bold text-[#F4F4F6] placeholder-[#52525B] focus:outline-none focus:border-[#D95B26]"
            />
          </div>
          <button
            type="submit"
            disabled={viewState === 'loading' || !codeQuery.trim()}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#242424] disabled:opacity-50 text-[#F4F4F6] font-semibold text-xs transition-colors cursor-pointer shrink-0"
          >
            Consultar estado
          </button>
        </form>
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
            Pedile a la persona los 8 números que figuran debajo del código de barras en su tarjeta (por ejemplo, 48291037) o escaneá el código con la cámara.
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

      {/* ESTADO 4: ÉXITO */}
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
              <span className="block text-xs font-semibold text-[#9E9EA8]">Sellos acumulados</span>
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
                    Premio disponible: {lookupResult.rewardText}
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
