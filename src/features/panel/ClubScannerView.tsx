import React, { useState, useEffect } from 'react';
import {
  api,
  ClubConfig,
  ClubMember,
  ClubLocal,
  ToquecitoItem,
} from '../../api';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertCircle,
  Gift,
  Maximize2,
  X,
  Mail,
  Camera,
  Sparkles,
} from 'lucide-react';

export const ClubScannerView: React.FC = () => {
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modo de carga en mostrador: 'qr' | 'email_no_phone'
  const [scanTab, setScanTab] = useState<'qr' | 'email_no_phone'>('qr');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modo por visita vs por monto (permite probar ambos en Escanear)
  const [stampMode, setStampMode] = useState<'per_visit' | 'per_amount'>('per_visit');
  const [ticketAmount, setTicketAmount] = useState<string>('');

  // Cliente sin celular (búsqueda por mail + confirmación OTP)
  const [clientEmail, setClientEmail] = useState('');
  const [clientOtpSent, setClientOtpSent] = useState(false);
  const [clientOtpCode, setClientOtpCode] = useState('');
  const [demoHintCode, setDemoHintCode] = useState<string | null>(null);

  // Pantalla completa: QR del mostrador (cambia cada 30 segundos)
  const [showCounterQrModal, setShowCounterQrModal] = useState(false);
  const [rotatingData, setRotatingData] = useState<{
    token: string;
    localCode: string;
    validForSeconds: number;
  } | null>(null);

  // Resultado y Toquecito
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [recentToquecito, setRecentToquecito] = useState<ToquecitoItem | null>(null);

  const loadInitial = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [cfg, mems, locs] = await Promise.all([
        api.getClubConfig(),
        api.listMembers(),
        api.listLocals(),
      ]);
      setConfig(cfg);
      setMembers(mems);
      setLocals(locs);
      setStampMode(cfg.mode || 'per_visit');
      if (locs[0]) setSelectedLocalId(locs[0].id);
      if (mems[0]) setSelectedMemberId(mems[0].id);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'No pudimos cargar el lector de sellos.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  // Actualizar QR rotativo cada segundo cuando está abierto el modal de mostrador
  useEffect(() => {
    if (!showCounterQrModal || !selectedLocalId) return;
    let active = true;

    const refreshToken = () => {
      api
        .getRotatingCode(selectedLocalId)
        .then((res) => {
          if (active) setRotatingData(res);
        })
        .catch(() => {});
    };

    refreshToken();
    const interval = setInterval(refreshToken, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [showCounterQrModal, selectedLocalId]);

  const selectedMember = members.find((m) => m.id === selectedMemberId) || null;
  const targetStamps = config?.targetStamps || 10;
  const amountPerStamp = config?.amountPerStamp || 4000;
  const maxStampsPerVisit = config?.maxStampsPerVisit || 3;

  const parsedAmount = Number(ticketAmount) || 0;
  const calculatedStampsByAmount =
    stampMode === 'per_amount'
      ? Math.min(maxStampsPerVisit, Math.floor(parsedAmount / amountPerStamp))
      : 1;

  const handleNumpadDigit = (digit: string) => {
    if (digit === 'C') {
      setTicketAmount('');
      return;
    }
    if (digit === 'BACK') {
      setTicketAmount((prev) => prev.slice(0, -1));
      return;
    }
    setTicketAmount((prev) => (prev.length < 8 ? prev + digit : prev));
  };

  const handleAddStamp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setRecentToquecito(null);

    if (!selectedMember) {
      setErrorMsg('Elegí un cliente o escaneá el código QR de su tarjeta.');
      return;
    }

    if (stampMode === 'per_amount' && calculatedStampsByAmount <= 0) {
      setErrorMsg(
        `Ingresá un monto de al menos $${amountPerStamp.toLocaleString('es-AR')} para sumar 1 sello.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Actualizamos temporalmente el modo si el cajero alternó entre visita y monto
      if (config && config.mode !== stampMode) {
        await api.updateClubConfig({ mode: stampMode });
      }

      const res = await api.addStampByCashier({
        memberId: selectedMember.id,
        localId: selectedLocalId,
        amount: stampMode === 'per_amount' ? parsedAmount : undefined,
      });

      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      setRecentToquecito(res.toquecito);
      setTicketAmount('');
      setSuccessMsg(
        `Se sumaron ${res.stampsAdded} sello(s) a ${res.member.name || res.member.contact}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos sumar el sello.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendClientOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!clientEmail.trim() || !clientEmail.includes('@')) {
      setErrorMsg('Escribí el mail del cliente para mandarle el código de confirmación.');
      return;
    }

    setIsSubmitting(true);
    try {
      const otp = await api.requestOtp(clientEmail.trim().toLowerCase(), 'cashier_confirm');
      setDemoHintCode(otp.demoHintCode || null);
      setClientOtpSent(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos enviar el código al cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmClientNoPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!/^\d{6}$/.test(clientOtpCode.trim())) {
      setErrorMsg('Ingresá el código de 6 dígitos que recibió el cliente.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.addStampByCashier({
        email: clientEmail.trim().toLowerCase(),
        localId: selectedLocalId,
        otpCode: clientOtpCode.trim(),
        amount: stampMode === 'per_amount' ? parsedAmount : undefined,
      });
      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      setSelectedMemberId(res.member.id);
      setRecentToquecito(res.toquecito);
      setClientOtpSent(false);
      setClientOtpCode('');
      setSuccessMsg(`Confirmado con código por mail: +${res.stampsAdded} sello(s) sumados.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Código o correo no encontrado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRedeemReward = async (memberId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const res = await api.redeemReward(memberId);
      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      setSuccessMsg(
        `¡Premio canjeado para ${res.member.name}! Lleva ${res.rewardsRedeemed} premio(s) canjeados.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos canjear el premio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64 rounded-xl bg-[#111113]" />
        <Skeleton className="h-80 w-full rounded-2xl bg-[#111113]" />
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="p-6 rounded-2xl bg-[#111113] border border-[#242426] space-y-4">
        <AlertCircle className="w-8 h-8 text-[#f87171]" />
        <p className="text-base text-[#f1f1ee]">{loadError}</p>
        <button
          type="button"
          onClick={loadInitial}
          className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-sm cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.maskedEmail || m.contact || '').toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q)
    );
  });

  const isSelectedRewardReady =
    selectedMember && (selectedMember.stamps || 0) >= targetStamps;

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">
            Escanear y sumar sellos
          </h1>
          <p className="text-base text-[#d4d4d8]">
            Leé el QR de la tarjeta del cliente, buscalo por mail o mostrá el QR del mostrador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {locals.length > 0 && (
            <div>
              <label htmlFor="scanner-local-select" className="sr-only">
                Local activo
              </label>
              <select
                id="scanner-local-select"
                value={selectedLocalId}
                onChange={(e) => setSelectedLocalId(e.target.value)}
                className="min-h-[48px] px-3.5 py-2 rounded-xl border border-[#28282a] bg-[#111113] text-sm font-semibold text-[#f1f1ee]"
              >
                {locals.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    Local: {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowCounterQrModal(true)}
            className="min-h-[48px] px-4 py-2.5 rounded-xl border border-[#bec8ff]/50 bg-[#18181b] hover:border-[#bec8ff] text-sm font-bold text-[#bec8ff] flex items-center gap-2 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
            <span>QR del mostrador (cambia cada 30 s)</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/40 text-base text-[#fca5a5] flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-[#f87171] shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-4 rounded-xl bg-[#2fb36a]/15 border border-[#2fb36a]/40 text-base text-[#86efac] flex items-start gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-[#34d399] shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Toquecito recién generado */}
      {recentToquecito && (
        <div className="p-4 rounded-2xl bg-[#111113] border border-[#bec8ff]/40 flex items-center gap-4 toquecito-pop">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl text-white shrink-0 border border-white/20"
            style={{
              background: `linear-gradient(135deg, ${recentToquecito.brandColor}, #18181b)`,
            }}
          >
            {recentToquecito.initial}
          </div>
          <div>
            <p className="font-bold text-base text-[#f1f1ee]">
              Toquecito sumado en la cuenta del cliente
            </p>
            <p className="text-sm text-[#a1a1aa]">
              {recentToquecito.businessName} · Guardado con fecha de hoy
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Selección de modo y cliente */}
        <div className="lg:col-span-7 space-y-5">
          {/* Pestañas: Escanea el comercio vs Cliente sin celular */}
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#111113] border border-[#242426]">
            <button
              type="button"
              onClick={() => setScanTab('qr')}
              className={`min-h-[48px] px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                scanTab === 'qr'
                  ? 'bg-[#f1f1ee] text-[#0c0c0c]'
                  : 'text-[#d4d4d8] hover:text-[#f1f1ee]'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Leer QR / Elegir cliente</span>
            </button>
            <button
              type="button"
              onClick={() => setScanTab('email_no_phone')}
              className={`min-h-[48px] px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                scanTab === 'email_no_phone'
                  ? 'bg-[#f1f1ee] text-[#0c0c0c]'
                  : 'text-[#d4d4d8] hover:text-[#f1f1ee]'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Cliente sin celular (por mail)</span>
            </button>
          </div>

          {scanTab === 'qr' ? (
            <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-lg text-[#f1f1ee]">
                  1. Seleccioná o escaneá la tarjeta del cliente
                </h2>
                <span className="text-xs text-[#a1a1aa]">Cámara o búsqueda</span>
              </div>

              <div>
                <label htmlFor="member-search-input" className="sr-only">
                  Buscar cliente por nombre o código
                </label>
                <div className="relative">
                  <Search className="w-5 h-5 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="member-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, correo parcial o código de tarjeta..."
                    className="w-full min-h-[48px] pl-11 pr-4 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee] placeholder-[#a1a1aa] focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredMembers.map((m) => {
                  const isSelected = m.id === selectedMemberId;
                  const ready = (m.stamps || 0) >= targetStamps;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMemberId(m.id)}
                      className={`w-full min-h-[56px] p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#bec8ff] bg-[#18181b]'
                          : 'border-[#28282a] bg-[#141416] hover:border-[#3f3f46]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-base text-[#f1f1ee] truncate">
                          {m.name || 'Cliente sin datos'}
                        </p>
                        <p className="text-xs text-[#a1a1aa]">
                          {m.maskedEmail || m.contact} · Código: {m.id}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-base text-[#bec8ff] tabular-nums block">
                          {m.stamps || 0} / {targetStamps} sellos
                        </span>
                        {ready && (
                          <span className="text-xs font-bold text-[#34d399] block">
                            Premio listo
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-4">
              <h2 className="font-bold text-lg text-[#f1f1ee]">
                Cliente sin celular: confirmar por mail
              </h2>
              <p className="text-sm text-[#d4d4d8]">
                Buscá al cliente por su correo. Le llega un código de 6 números en el momento para confirmar su sello.
              </p>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-[#a1a1aa]">Probar con cliente de muestra (Ejemplo):</span>
                <button
                  type="button"
                  onClick={() => setClientEmail('diego@gmail.com')}
                  className="underline text-[#bec8ff] font-semibold cursor-pointer"
                >
                  diego@gmail.com (Ejemplo)
                </button>
                <button
                  type="button"
                  onClick={() => setClientEmail('sofia@hotmail.com')}
                  className="underline text-[#bec8ff] font-semibold cursor-pointer"
                >
                  sofia@hotmail.com (Ejemplo)
                </button>
              </div>

              {!clientOtpSent ? (
                <form onSubmit={handleSendClientOtp} className="space-y-3">
                  <div>
                    <label
                      htmlFor="cashier-client-email"
                      className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                    >
                      Mail del cliente
                    </label>
                    <input
                      id="cashier-client-email"
                      type="email"
                      required
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="cliente@ejemplo.com"
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-base text-[#f1f1ee]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] font-bold text-base cursor-pointer"
                  >
                    Enviar código de confirmación al cliente
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmClientNoPhone} className="space-y-4">
                  {demoHintCode && (
                    <div className="p-3 rounded-xl bg-[#18181b] border border-[#bec8ff]/40 flex items-center justify-between">
                      <span className="text-xs text-[#d4d4d8]">
                        Código recibido por el cliente (Ejemplo):{' '}
                        <strong className="font-mono text-base text-[#bec8ff]">
                          {demoHintCode}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setClientOtpCode(demoHintCode)}
                        className="min-h-[36px] px-3 py-1 rounded-lg bg-[#bec8ff] text-[#0c0c0c] font-bold text-xs cursor-pointer"
                      >
                        Usar código
                      </button>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="cashier-client-otp"
                      className="block text-sm font-semibold text-[#f1f1ee] mb-1.5"
                    >
                      Código de 6 números que dictó el cliente
                    </label>
                    <input
                      id="cashier-client-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={clientOtpCode}
                      onChange={(e) =>
                        setClientOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="000000"
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-xl font-mono tracking-widest text-center text-[#f1f1ee]"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#2fb36a] text-[#0c0c0c] font-bold text-base cursor-pointer"
                    >
                      Confirmar y sumar sello
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientOtpSent(false)}
                      className="min-h-[48px] px-4 py-2.5 text-sm font-semibold text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
                    >
                      Cambiar mail
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Columna Derecha: Modo (Por visita / Por monto con teclado) y Confirmación */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-2xl bg-[#111113] border border-[#242426] space-y-4">
            <h2 className="font-bold text-lg text-[#f1f1ee]">2. Regla para sumar sellos</h2>

            {/* Selector rápido Por visita vs Por monto */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#18181b] border border-[#28282a]">
              <button
                type="button"
                onClick={() => setStampMode('per_visit')}
                className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-bold cursor-pointer ${
                  stampMode === 'per_visit'
                    ? 'bg-[#bec8ff] text-[#0c0c0c]'
                    : 'text-[#d4d4d8]'
                }`}
              >
                Por visita (+1 sello)
              </button>
              <button
                type="button"
                onClick={() => setStampMode('per_amount')}
                className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-bold cursor-pointer ${
                  stampMode === 'per_amount'
                    ? 'bg-[#bec8ff] text-[#0c0c0c]'
                    : 'text-[#d4d4d8]'
                }`}
              >
                Por monto ($ ticket)
              </button>
            </div>

            {stampMode === 'per_amount' ? (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="ticket-amount-input"
                    className="block text-sm font-semibold text-[#f1f1ee] mb-1"
                  >
                    Monto del ticket ($ ARS)
                  </label>
                  <input
                    id="ticket-amount-input"
                    type="number"
                    inputMode="numeric"
                    value={ticketAmount}
                    onChange={(e) => setTicketAmount(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[52px] px-4 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-2xl font-mono font-bold text-right text-[#f1f1ee] tabular-nums"
                  />
                  <p className="text-xs text-[#a1a1aa] mt-1">
                    Regla: 1 sello cada ${amountPerStamp.toLocaleString('es-AR')} (tope de{' '}
                    {maxStampsPerVisit} sellos por visita). Sellos a sumar:{' '}
                    <strong className="text-[#bec8ff]">{calculatedStampsByAmount}</strong>
                  </p>
                </div>

                {/* Teclado numérico accesible (>= 48px) */}
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BACK'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleNumpadDigit(key)}
                      className="min-h-[48px] rounded-xl border border-[#28282a] bg-[#18181b] hover:border-[#bec8ff] font-mono font-bold text-lg text-[#f1f1ee] cursor-pointer active:scale-95 transition-transform"
                    >
                      {key === 'BACK' ? '⌫' : key}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#d4d4d8]">
                Cada confirmación suma <strong className="text-[#f1f1ee]">1 sello</strong> y{' '}
                <strong className="text-[#f1f1ee]">1 toquecito</strong> a la tarjeta del cliente.
              </div>
            )}

            {/* Ficha del cliente seleccionado + Botón Sumar Sello + Botón Canjear Premio */}
            {selectedMember && (
              <div className="p-4 rounded-xl bg-[#18181b] border border-[#28282a] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-base text-[#f1f1ee]">
                      {selectedMember.name || 'Cliente'}
                    </p>
                    <p className="text-xs text-[#a1a1aa]">
                      {selectedMember.maskedEmail || selectedMember.contact}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-lg text-[#bec8ff] tabular-nums">
                    {selectedMember.stamps || 0} / {targetStamps} sellos
                  </span>
                </div>

                {isSelectedRewardReady && (
                  <div className="p-3.5 rounded-xl bg-[#2fb36a]/15 border border-[#2fb36a]/40 space-y-2.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#86efac]">
                      <Gift className="w-5 h-5 text-[#34d399]" />
                      <span>¡Premio listo! ({config.rewardText})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRedeemReward(selectedMember.id)}
                      disabled={isSubmitting}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#2fb36a] text-[#0c0c0c] font-bold text-base cursor-pointer"
                    >
                      Canjear premio ahora
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddStamp}
                  disabled={isSubmitting}
                  className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-[#f1f1ee] text-[#0c0c0c] hover:bg-white font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>
                    {isSubmitting
                      ? 'Sumando...'
                      : stampMode === 'per_amount'
                      ? `Sumar sello (${calculatedStampsByAmount})`
                      : 'Sumar sello'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL PANTALLA COMPLETA: QR DEL MOSTRADOR (Cambia cada 30 segundos) */}
      {showCounterQrModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="QR del mostrador"
          className="fixed inset-0 z-50 bg-[#000000] text-[#f1f1ee] flex flex-col items-center justify-center p-6"
        >
          <div className="max-w-lg w-full rounded-3xl bg-[#111113] border border-[#242426] p-6 sm:p-8 text-center space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#bec8ff] uppercase tracking-wider">
                Modo Más Seguro · Autoservicio
              </span>
              <button
                type="button"
                onClick={() => setShowCounterQrModal(false)}
                className="min-h-[48px] px-4 py-2 rounded-xl border border-[#28282a] bg-[#18181b] text-sm font-bold text-[#f1f1ee] flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Cerrar</span>
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#f1f1ee]">
                QR del mostrador
              </h2>
              <p className="text-base text-[#d4d4d8]">
                Escaneá con tu celular para sumar tu sello de hoy en{' '}
                <strong>{config.name}</strong>.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-[#f1f1ee] text-[#0c0c0c] inline-flex flex-col items-center justify-center space-y-3 mx-auto">
              <QrCode className="w-48 h-48 text-[#0c0c0c]" />
              <span className="font-mono font-bold text-lg tracking-wider">
                {rotatingData?.token || 'TQ30-CAJA01-0001'}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-mono font-bold text-[#34d399] tabular-nums">
                Este código cambia automáticamente en {rotatingData?.validForSeconds ?? 30} segundos
              </p>
              <p className="text-xs text-[#a1a1aa]">
                Evita fotos al cartel y asegura que el cliente esté presente en el local (1 visita por día).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
