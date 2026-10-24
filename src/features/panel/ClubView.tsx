import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ClubConfig, ClubMember, ClubLocal, PlanState } from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { RealBarcode128 } from '../../components/ui/RealQrCode';
import {
  Download,
  Search,
  QrCode,
  Gift,
  Plus,
  Minus,
  X,
  Palette,
  Mail,
  Send,
  Barcode,
  Lock,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

export const ClubView: React.FC = () => {
  const { user, business } = useAuth();
  const { showToast } = useToast();
  const scannerInputRef = useRef<HTMLInputElement | null>(null);

  const isCashier = user?.role === 'cashier' && !user?.isSuperAdmin;

  const [activeTab, setActiveTab] = useState<'socios' | 'diseno' | 'avisos'>('socios');
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLocalId, setSelectedLocalId] = useState('all');

  // Lector de Código de Barras / Escáner Pistola USB/Bluetooth (<1s con Enter)
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [scanningFast, setScanningFast] = useState(false);
  const [lastScannedMember, setLastScannedMember] = useState<ClubMember | null>(null);

  // Configuración de diseño de tarjeta
  const [savingConfig, setSavingConfig] = useState(false);
  const [rewardText, setRewardText] = useState('');
  const [brandColor, setBrandColor] = useState('#1e1b4b');
  const [howToEarn, setHowToEarn] = useState('1 sello por visita o compra');

  // Envío de Avisos por Email vía Resend (/api/club/broadcast)
  const [broadcastHeadline, setBroadcastHeadline] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastCtaLabel, setBroadcastCtaLabel] = useState('Ver mi tarjeta y beneficio');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Modal de Ajuste / Descuento Manual (con motivo obligatorio >= 10 caracteres)
  const [adjustTarget, setAdjustTarget] = useState<ClubMember | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(-1);
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cfg, mems, locs, plan] = await Promise.all([
        api.getClubConfig(),
        api.listMembers(),
        api.listLocals(),
        api.getPlanState().catch(() => null),
      ]);
      setConfig(cfg);
      setMembers(mems);
      setLocals(locs);
      setPlanState(plan);
      setRewardText(
        cfg.loyaltyReward || cfg.rewardText || 'Combo aniversario sin cargo en tu visita #10'
      );
      setBrandColor(cfg.cardThemeColor || cfg.brandColor || '#1e1b4b');
      setHowToEarn(cfg.howToEarn || '1 sello por visita o compra');
    } catch (err: any) {
      showToast(err?.message || 'Error al cargar tarjetas del Club', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Mantener foco en el lector de pistola cuando está en la pestaña de socios
  useEffect(() => {
    if (activeTab === 'socios' && scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, [activeTab, loading]);

  // Acción instantánea del Lector de Código de Barras (USB/Bluetooth + Enter en <1s)
  const handleBarcodeScannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeQuery.trim();
    if (!code) return;

    try {
      setScanningFast(true);
      const res = await api.addStampByCashier({
        memberCode: code,
        memberId: code,
        email: code,
      });
      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      setLastScannedMember(res.member);
      setBarcodeQuery('');
      showToast(
        `+1 Sello cargado a ${res.member.name || res.member.memberCode} (${res.member.stamps}/${
          res.member.targetStamps || 10
        })`,
        'success'
      );
      scannerInputRef.current?.focus();
    } catch (err: any) {
      showToast(err?.message || 'Código no encontrado. Probá con código (ej. LB-8492) o email.', 'error');
    } finally {
      setScanningFast(false);
    }
  };

  // Sumar +1 sello directo desde la tabla
  const handleQuickPlusStamp = async (member: ClubMember) => {
    try {
      const res = await api.addStampByCashier({ memberId: member.id });
      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      setLastScannedMember(res.member);
      showToast(
        `+1 sello para ${res.member.name || 'Socio'} (${res.member.stamps}/${
          res.member.targetStamps || 10
        })`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'No se pudo sumar el sello', 'error');
    }
  };

  // Canjear premio al completar los 10 sellos
  const handleRedeemReward = async (member: ClubMember) => {
    try {
      const res = await api.redeemReward(member.id);
      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      showToast(`¡Premio canjeado para ${res.member.name || 'Socio'}!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo canjear el premio', 'error');
    }
  };

  const handleExportMembersCsv = async () => {
    try {
      const csv = await api.exportClubMembersCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'socios-tarjetas-toque.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Listado de socios descargado en CSV', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al exportar socios', 'error');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const updated = await api.updateClubConfig({
        rewardText: rewardText.trim(),
        loyaltyReward: rewardText.trim(),
        brandColor,
        cardThemeColor: brandColor,
        howToEarn: howToEarn.trim(),
      });
      setConfig(updated);
      showToast('Diseño de la tarjeta actualizado en tiempo real', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar configuración', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const isFree = planState?.status === 'free' || planState?.planId === 'free';
    if (isFree) {
      showToast('Activá el Plan Pro o el Trial de 14 días para enviar avisos por email.', 'error');
      return;
    }

    const consented = members.filter((m) => m.marketingConsent && !m.anonymous && !m.isMinor);
    if (consented.length === 0) {
      showToast('Todavía no hay socios suscriptos a avisos comerciales.', 'error');
      return;
    }

    try {
      setSendingBroadcast(true);
      const res = await fetch('/api/club/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planStatus: planState?.status || 'trial',
          businessName: business?.name || 'La Burger',
          localCode: locals[0]?.code || 'BURGER01',
          headline: broadcastHeadline.trim(),
          messageBody: broadcastMessage.trim(),
          ctaLabel: broadcastCtaLabel.trim() || 'Ver mi tarjeta y beneficio',
          recipients: consented.map((m) => ({
            email: m.email || m.contact,
            name: m.name || 'Socio',
            consent: m.marketingConsent,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar el aviso');
      }
      setBroadcastHeadline('');
      setBroadcastMessage('');
      showToast(
        `Aviso enviado a ${data.sentCount || consented.length} socio(s) con plantilla Tactile Hardware`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'No se pudo enviar el aviso.', 'error');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    try {
      setSubmittingAdjust(true);
      const res = await api.adjustBalance({
        memberId: adjustTarget.id,
        delta: adjustDelta,
        reason: adjustReason,
      });
      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      setAdjustTarget(null);
      setAdjustReason('');
      showToast('Saldo de sellos ajustado y registrado en auditoría', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al ajustar sellos', 'error');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl bg-[#141418]" />
        <Skeleton className="h-80 rounded-2xl bg-[#141418]" />
      </div>
    );
  }

  const isFreePlan = planState?.status === 'free' || planState?.planId === 'free';
  const consentedMembersCount = members.filter(
    (m) => m.marketingConsent && !m.anonymous && !m.isMinor
  ).length;

  const filteredMembers = members.filter((m) => {
    if (selectedLocalId !== 'all' && m.localId !== selectedLocalId) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.memberCode || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.maskedEmail || m.contact || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Banner de bloqueo si está en Plan Free ("Hub pelado") */}
      {isFreePlan && (
        <div className="p-4 rounded-2xl bg-[#D95B26]/10 border border-[#D95B26]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-[#D95B26] shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#F4F4F6]">
                Tu cuenta está en Plan Free (solo Hub básico)
              </p>
              <p className="text-xs text-[#9E9EA8]">
                Tus socios históricos están guardados. Activá el Plan Pro ($34.999) o el Trial de 14
                días en el Plan Anual para reactivar las tarjetas y avisos.
              </p>
            </div>
          </div>
          <Link
            to="/panel/cuenta"
            className="px-4 py-2 rounded-xl bg-[#D95B26] text-white text-xs font-bold shrink-0"
          >
            Activar Plan Pro / Trial →
          </Link>
        </div>
      )}

      {/* Cabecera + Selector de Sub-Vistas de Tarjetas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#D95B26]">
            Club de Fidelización · Wallet + Lector Pistola
          </span>
          <h1 className="text-2xl font-bold text-[#F4F4F6] mt-0.5">Tarjetas y Socios</h1>
          <p className="text-sm text-[#9E9EA8]">
            Escaneá con pistola USB/Bluetooth en menos de 1 segundo, gestioná sellos y enviá avisos.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isCashier && (
            <div className="inline-flex rounded-xl bg-[#141418] p-1 border border-[#282830]">
              <button
                type="button"
                onClick={() => setActiveTab('socios')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'socios'
                    ? 'bg-[#D95B26] text-white'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Socios y Escáner ({members.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('diseno')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'diseno'
                    ? 'bg-[#D95B26] text-white'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Diseño de Tarjeta
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('avisos')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'avisos'
                    ? 'bg-[#D95B26] text-white'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Avisos por Email
              </button>
            </div>
          )}

          {!isCashier && (
            <button
              type="button"
              onClick={handleExportMembersCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xs font-semibold text-[#F4F4F6] cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#BEC8FF]" />
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODULO 1: LECTOR DE PISTOLA RÁPIDO (<1s) + TABLA DE SOCIOS          */}
      {/* =================================================================== */}
      {activeTab === 'socios' && (
        <div className="space-y-5">
          {/* Barra Lector de Código de Barras / QR con autofocus permanente */}
          <form
            onSubmit={handleBarcodeScannerSubmit}
            className="rounded-2xl bg-[#141418] border-2 border-[#D95B26]/60 p-4 sm:p-5 space-y-3 shadow-lg"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D95B26]">
                <Barcode className="w-4 h-4" />
                <span>Modo Lector de Código de Barras / Pistola USB-Bluetooth (Auto-Focus)</span>
              </div>
              <Link
                to="/panel/escanear"
                className="text-xs font-bold text-[#BEC8FF] hover:underline flex items-center gap-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Usar cámara del celular →</span>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Barcode className="w-5 h-5 text-[#D95B26] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={scannerInputRef}
                  type="text"
                  autoFocus
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  placeholder="Apuntá con la pistola lectora al pase del cliente (ej. LB-8492) o escribí su código y presioná Enter..."
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#0C0C0E] border border-[#282830] font-mono text-sm text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
                />
              </div>
              <button
                type="submit"
                disabled={scanningFast || !barcodeQuery.trim()}
                className="px-6 py-3.5 rounded-xl bg-[#2FB36A] hover:bg-[#269a59] text-[#05150c] font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{scanningFast ? 'Sumando...' : 'Sumar +1 Sello (Enter)'}</span>
              </button>
            </div>

            {lastScannedMember && (
              <div className="p-3 rounded-xl bg-[#2FB36A]/15 border border-[#2FB36A]/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[#2FB36A]" />
                  <div className="text-xs">
                    <span className="font-bold text-[#F4F4F6]">
                      Último escaneo: {lastScannedMember.name} ({lastScannedMember.memberCode})
                    </span>
                    <span className="text-[#2FB36A] font-extrabold ml-2">
                      Sellos: {lastScannedMember.stamps} / {lastScannedMember.targetStamps || 10}
                    </span>
                  </div>
                </div>
                {lastScannedMember.stamps >= (lastScannedMember.targetStamps || 10) && (
                  <button
                    type="button"
                    onClick={() => handleRedeemReward(lastScannedMember)}
                    className="px-3 py-1.5 rounded-lg bg-[#D95B26] text-white text-xs font-bold cursor-pointer"
                  >
                    🎁 Canjear Premio Ahora
                  </button>
                )}
              </div>
            )}
          </form>

          {/* Buscador y filtro por sucursal */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar por nombre, código (ej. LB-8492) o email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#141418] border border-[#282830] text-sm text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
              />
            </div>

            <select
              value={selectedLocalId}
              onChange={(e) => setSelectedLocalId(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-[#141418] border border-[#282830] text-sm text-[#F4F4F6]"
            >
              <option value="all">Todas las sucursales</option>
              {locals.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>

          {/* Tabla de Clientes con Controles Rápidos + / - */}
          <div className="rounded-2xl bg-[#141418] border border-[#282830] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#282830] text-[11px] uppercase tracking-wider text-[#9E9EA8] bg-[#1C1C22]/60">
                    <th className="py-3.5 px-4">Socio</th>
                    <th className="py-3.5 px-4">Código / Barras</th>
                    <th className="py-3.5 px-4">Edad / Cumple</th>
                    <th className="py-3.5 px-4">Progreso Sellos</th>
                    <th className="py-3.5 px-4 text-right">Acciones Rápidas (+ / -)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#282830] text-sm">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[#9E9EA8]">
                        No encontramos socios con ese criterio.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const target = m.targetStamps || 10;
                      const isReadyForReward = m.stamps >= target;
                      return (
                        <tr key={m.id} className="hover:bg-[#1C1C22]/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#F4F4F6]">{m.name || 'Socio'}</div>
                            <div className="text-xs text-[#9E9EA8]">
                              {m.maskedEmail || m.contact}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-[#0C0C0E] border border-[#282830] font-mono text-xs font-bold text-[#BEC8FF]">
                              {m.memberCode || m.id.slice(0, 8).toUpperCase()}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-xs text-[#9E9EA8]">
                            {m.birthDate ? (
                              <div>
                                <span>{m.birthDate}</span>
                                {m.age !== undefined && (
                                  <span
                                    className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      m.isMinor
                                        ? 'bg-[#BEC8FF]/15 text-[#BEC8FF]'
                                        : 'bg-[#2FB36A]/15 text-[#2FB36A]'
                                    }`}
                                  >
                                    {m.age}a
                                  </span>
                                )}
                              </div>
                            ) : m.birthDay && m.birthMonth ? (
                              `${m.birthDay}/${m.birthMonth}`
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-base text-[#F4F4F6]">
                                {m.stamps} / {target}
                              </span>
                              {isReadyForReward && (
                                <span className="px-2 py-0.5 rounded-full bg-[#2FB36A]/20 text-[#2FB36A] text-[10px] font-extrabold">
                                  🎁 Premio listo
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickPlusStamp(m)}
                                className="px-3 py-1.5 rounded-xl bg-[#2FB36A] hover:bg-[#259858] text-[#05150c] font-extrabold text-xs inline-flex items-center gap-1 cursor-pointer"
                                title="Sumar 1 sello"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                <span>1 Sello</span>
                              </button>

                              {isReadyForReward && (
                                <button
                                  type="button"
                                  onClick={() => handleRedeemReward(m)}
                                  className="px-3 py-1.5 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Gift className="w-3.5 h-3.5" />
                                  <span>Canjear</span>
                                </button>
                              )}

                              {!isCashier && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdjustTarget(m);
                                    setAdjustDelta(-1);
                                    setAdjustReason('');
                                  }}
                                  className="p-1.5 rounded-xl bg-[#1C1C22] hover:bg-[#26262e] border border-[#282830] text-[#9E9EA8] hover:text-white cursor-pointer"
                                  title="Ajustar o descontar sellos con motivo"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODULO 2: EDITOR DE DISEÑO DE LA TARJETA Y VISTA PREVIA             */}
      {/* =================================================================== */}
      {activeTab === 'diseno' && !isCashier && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveConfig}
            className="lg:col-span-7 rounded-2xl bg-[#141418] border border-[#282830] p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-base font-bold text-[#F4F4F6]">
              <Palette className="w-4 h-4 text-[#D95B26]" />
              <span>Personalizar Tarjeta Digital y Pase Wallet</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                Premio al completar los 10 sellos
              </label>
              <input
                type="text"
                required
                value={rewardText}
                onChange={(e) => setRewardText(e.target.value)}
                placeholder="Ej: 1 Burger Doble sin cargo"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                Regla de acumulación visible para el cliente
              </label>
              <input
                type="text"
                required
                value={howToEarn}
                onChange={(e) => setHowToEarn(e.target.value)}
                placeholder="Ej: 1 sello por visita o compra"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                Color de fondo de la tarjeta (Hex)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-12 h-10 rounded-xl bg-transparent border border-[#282830] cursor-pointer"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-36 px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs font-mono text-[#F4F4F6]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="px-6 py-3 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white font-bold text-xs cursor-pointer"
            >
              {savingConfig ? 'Guardando...' : 'Guardar diseño de tarjeta'}
            </button>
          </form>

          {/* Vista previa en vivo con Barcode CODE128 real */}
          <div className="lg:col-span-5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#9E9EA8]">
              Vista Previa en Vivo (Hub + Wallet)
            </span>
            <div
              style={{ backgroundColor: brandColor }}
              className="rounded-3xl p-5 text-white border border-white/15 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{business?.name || 'La Burger'}</p>
                  <p className="text-xs text-white/80">🎁 {rewardText}</p>
                </div>
                <span className="font-mono text-xl font-extrabold">3 / 10</span>
              </div>
              <div className="bg-white rounded-2xl p-3 text-[#0C0C0E]">
                <RealBarcode128 value="LB-8492" height={44} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODULO 3: AVISOS Y BENEFICIOS POR EMAIL VÍA RESEND                  */}
      {/* =================================================================== */}
      {activeTab === 'avisos' && !isCashier && (
        <div className="rounded-2xl bg-[#141418] border border-[#282830] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-base font-bold text-[#F4F4F6]">
                <Mail className="w-4 h-4 text-[#D95B26]" />
                <span>Enviar Aviso o Beneficio al Club (vía Resend)</span>
              </div>
              <p className="text-xs text-[#9E9EA8] mt-0.5">
                Se envía con la plantilla oficial Tactile Hardware únicamente a los{' '}
                <strong className="text-[#F4F4F6]">{consentedMembersCount} socios</strong> mayores de
                18 años que aceptaron recibir novedades.
              </p>
            </div>
            <Link
              to="/panel/correcciones"
              className="text-xs font-semibold text-[#BEC8FF] hover:underline flex items-center gap-1"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Ver auditoría de sellos →</span>
            </Link>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                Título del aviso (Asunto)
              </label>
              <input
                type="text"
                required
                value={broadcastHeadline}
                onChange={(e) => setBroadcastHeadline(e.target.value)}
                placeholder="Ej: ¡Este jueves 2x1 para socios del Club!"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                Mensaje para tus socios
              </label>
              <textarea
                rows={4}
                required
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Escribí el beneficio o novedad. El correo incluirá automáticamente el botón para abrir su tarjeta..."
                className="w-full p-3.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                Texto del botón de acción
              </label>
              <input
                type="text"
                value={broadcastCtaLabel}
                onChange={(e) => setBroadcastCtaLabel(e.target.value)}
                placeholder="Ver mi tarjeta y beneficio"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
              />
            </div>

            <button
              type="submit"
              disabled={sendingBroadcast || isFreePlan}
              className="px-6 py-3 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white font-bold text-xs inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {sendingBroadcast
                  ? 'Enviando por Resend...'
                  : `Enviar aviso a ${consentedMembersCount} socio(s)`}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* Modal de Ajuste / Descuento Manual con Motivo Obligatorio */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-[#141418] border border-[#282830] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F4F4F6]">
                Ajustar sellos de {adjustTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="p-1 text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                  Variación de sellos (ej. -1 para descontar o +2 para sumar)
                </label>
                <input
                  type="number"
                  required
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                  Motivo de la corrección (mínimo 10 caracteres)
                </label>
                <input
                  type="text"
                  required
                  minLength={10}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ej: Sello cargado por error en ticket anulado"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-sm text-[#F4F4F6]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 rounded-xl bg-[#1C1C22] text-xs font-bold text-[#9E9EA8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="px-4 py-2 rounded-xl bg-[#D95B26] text-white text-xs font-bold cursor-pointer"
                >
                  {submittingAdjust ? 'Guardando...' : 'Confirmar ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
