import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import {
  ClubMember,
  ConsumerReceipt,
  RecognizedClientAccount,
} from '../../api/types';
import {
  getOrCreateLocalConsumerUser,
  saveLocalConsumerUser,
  getLocalConsumerReceipts,
  replaceLocalConsumerReceipts,
} from '../../lib/consumerStorage';
import { WalletPassCard } from '../../components/wallet/WalletPassCard';
import { ColorPreset } from '../../lib/walletwalletClient';
import { useToast } from '../../components/ui/Toast';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Bell,
  Clock,
  CreditCard,
  ExternalLink,
  Mail,
  Receipt as ReceiptIcon,
  RefreshCw,
  Trash2,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';

interface ActivityMovement {
  id: string;
  businessName: string;
  label: '+1 sello' | 'Premio canjeado' | 'Comprobante guardado';
  amountText?: string;
  createdAt: string;
  type: 'stamp' | 'reward' | 'receipt';
}

function getCooldownStatus(lastStampedAt?: string): {
  inCooldown: boolean;
  remainingMs: number;
  label: string;
} {
  if (!lastStampedAt) {
    return {
      inCooldown: false,
      remainingMs: 0,
      label: 'Disponible al visitar el local',
    };
  }
  const lastMs = new Date(lastStampedAt).getTime();
  if (Number.isNaN(lastMs)) {
    return {
      inCooldown: false,
      remainingMs: 0,
      label: 'Disponible al visitar el local',
    };
  }
  const elapsedMs = Date.now() - lastMs;
  if (elapsedMs >= 86400000) {
    return {
      inCooldown: false,
      remainingMs: 0,
      label: 'Disponible al visitar el local',
    };
  }
  const remainingMs = 86400000 - elapsedMs;
  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.max(1, Math.ceil((remainingMs % 3600000) / 60000));
  return {
    inCooldown: true,
    remainingMs,
    label: `Disponible en ${hours} h ${minutes} min`,
  };
}

export const ToquecitosView: React.FC = () => {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const fromHubCode = useMemo(() => {
    const qFrom = searchParams.get('from')?.trim();
    if (qFrom) return qFrom;
    try {
      return localStorage.getItem('toque_last_hub_code') || '';
    } catch {
      return '';
    }
  }, [searchParams]);

  const [consumerUser, setConsumerUser] = useState(() => getOrCreateLocalConsumerUser());
  const [receipts, setReceipts] = useState<ConsumerReceipt[]>(() => getLocalConsumerReceipts());
  const [account, setAccount] = useState<RecognizedClientAccount>({ recognized: false });
  const [cards, setCards] = useState<ClubMember[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal de verificación de correo (OTP de 6 dígitos)
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState(consumerUser.emailOrPhone || '');
  const [nameInput, setNameInput] = useState(
    consumerUser.displayName !== 'Tus tarjetas' ? consumerUser.displayName : ''
  );
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpPreviewCode, setOtpPreviewCode] = useState<string | undefined>(undefined);
  const [authBusy, setAuthBusy] = useState(false);

  // Estado de guardado en Apple / Google Wallet y baja de tarjeta
  const [walletBusy, setWalletBusy] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);

  // Reloj en vivo para actualizar la cuenta regresiva de 24h cada 30 segundos
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((t) => t + 1);
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const readHubLocalCards = (): ClubMember[] => {
    const found: ClubMember[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('toque_member_') && key !== 'toque_member_emails_v1') {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as ClubMember;
            if (parsed && parsed.id) {
              found.push(parsed);
            }
          }
        }
      }
      const rawGlobal = localStorage.getItem('toque_club_members_v1');
      if (rawGlobal) {
        const list = JSON.parse(rawGlobal);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.id) {
              found.push(item as ClubMember);
            }
          }
        }
      }
    } catch {
      // ignore storage errors
    }
    return found;
  };

  const loadData = async (overrideEmail?: string) => {
    setLoading(true);
    try {
      const hubLocalCards = readHubLocalCards();
      const hubEmail = hubLocalCards.find((c) => c.email && c.email.includes('@'))?.email || '';

      const targetEmail = (
        overrideEmail ??
        (consumerUser.emailOrPhone || hubEmail)
      )
        .trim()
        .toLowerCase();

      const rec = await api.recognizeAccount(targetEmail || undefined);
      setAccount(rec);

      const allMembers = await api.listClubMembers().catch(() => []);
      const mergedMap = new Map<string, ClubMember>();

      // 1. Tarjetas activas guardadas desde el Hub en este dispositivo
      for (const c of hubLocalCards) {
        mergedMap.set(c.id, c);
      }

      // 2. Tarjetas reconocidas por cuenta
      if (rec.recognized && Array.isArray(rec.cards)) {
        for (const c of rec.cards) {
          mergedMap.set(c.id, c);
        }
      }

      // 3. Tarjetas generales del club que coincidan con el email (o todas si no hay filtro)
      for (const m of allMembers) {
        if (!targetEmail || (m.email || '').toLowerCase() === targetEmail || m.anonymous) {
          if (!mergedMap.has(m.id)) {
            mergedMap.set(m.id, m);
          }
        }
      }

      const finalCards = Array.from(mergedMap.values());
      setCards(finalCards);

      const resolvedEmail = rec.email || targetEmail;
      const resolvedName =
        rec.name ||
        finalCards.find((c) => c.name && !c.anonymous)?.name ||
        consumerUser.displayName;

      if (resolvedEmail && resolvedEmail !== consumerUser.emailOrPhone) {
        const updated = saveLocalConsumerUser({
          ...consumerUser,
          emailOrPhone: resolvedEmail,
          displayName: resolvedName || consumerUser.displayName,
          syncedAt: new Date().toISOString(),
        });
        setConsumerUser(updated);
      }

      setReceipts(getLocalConsumerReceipts());

      if (resolvedEmail) {
        const vaultRes = await api
          .recoverConsumerVault(resolvedEmail)
          .catch(() => ({ found: false }));
        if (vaultRes.found && 'receipts' in vaultRes && Array.isArray(vaultRes.receipts) && vaultRes.receipts.length > 0) {
          setReceipts(vaultRes.receipts);
          replaceLocalConsumerReceipts(vaultRes.receipts);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) || null,
    [cards, selectedCardId]
  );

  // Ahorro acumulado real: suma de rewardValueArs de premios completados y canjeados + descuentos reales en comprobantes
  const totalSavingsArs = useMemo(() => {
    const rewardsSavings = cards.reduce((acc, card) => {
      const redeemed = card.rewardsRedeemed || 0;
      const valueArs = card.rewardValueArs || 0;
      return acc + redeemed * valueArs;
    }, 0);
    const receiptsSavings = receipts.reduce(
      (acc, r) => acc + (Number(r.discountSavedArs) || 0),
      0
    );
    return rewardsSavings + receiptsSavings;
  }, [cards, receipts]);

  // Cantidad de sellos activos reales
  const activeStampsCount = useMemo(() => {
    return cards.reduce((acc, card) => acc + (card.stamps || 0), 0);
  }, [cards]);

  // Lista cronológica de últimos movimientos reales (sellos sumados, premios canjeados y comprobantes)
  const recentMovements = useMemo<ActivityMovement[]>(() => {
    const items: ActivityMovement[] = [];

    for (const card of cards) {
      const bizName = card.businessName || card.localName || 'Comercio';
      for (const entry of card.stampHistory || []) {
        if (entry.voided) continue;
        items.push({
          id: `mov-st-${entry.id}`,
          businessName: bizName,
          label: '+1 sello',
          createdAt: entry.createdAt,
          type: 'stamp',
        });
      }
    }

    for (const r of receipts) {
      items.push({
        id: `mov-rcp-${r.id}`,
        businessName: r.merchantName || 'Comercio',
        label: 'Comprobante guardado',
        amountText: `$${(Number(r.amountArs) || 0).toLocaleString('es-AR')}`,
        createdAt: r.createdAt,
        type: 'receipt',
      });
    }

    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [cards, receipts]);

  const greetingName = useMemo(() => {
    if (account.recognized && account.name) {
      return `Hola, ${account.name.split(' ')[0]}`;
    }
    if (
      consumerUser.displayName &&
      consumerUser.displayName !== 'Tus tarjetas' &&
      consumerUser.displayName !== 'Comprador Toque'
    ) {
      return `Hola, ${consumerUser.displayName.split(' ')[0]}`;
    }
    return 'Tus tarjetas';
  }, [account, consumerUser]);

  const isEmailVerified = Boolean(
    (account.recognized && account.email) || consumerUser.emailOrPhone
  );

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showToast('Ingresá un correo electrónico válido.', 'error');
      return;
    }

    setAuthBusy(true);
    try {
      const res = await api.requestOtp(cleanEmail, 'register_client');
      setOtpPreviewCode(res.demoHintCode);
      setOtpStep('code');
      showToast('Te enviamos un código de 6 números a tu correo.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'No pudimos enviar el código.', 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      showToast('Ingresá el código de 6 números.', 'error');
      return;
    }

    setAuthBusy(true);
    try {
      const res = await api.verifyOtp(cleanEmail, cleanCode, {
        ownerName: nameInput.trim() || cleanEmail.split('@')[0],
      });

      const updatedUser = saveLocalConsumerUser({
        ...consumerUser,
        emailOrPhone: cleanEmail,
        displayName:
          nameInput.trim() ||
          res.account?.name ||
          cleanEmail.split('@')[0],
        syncedAt: new Date().toISOString(),
      });
      setConsumerUser(updatedUser);

      await api.syncConsumerVault({
        user: updatedUser,
        receipts,
      });

      await loadData(cleanEmail);
      setAuthModalOpen(false);
      setOtpStep('email');
      setOtpCode('');
      showToast('Guardado en tu cuenta.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'El código ingresado no es válido.', 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const downloadCardPassImage = async (card: ClubMember) => {
    try {
      const codeVal = card.barcodeToken || card.memberCode || card.id || 'LB-1001';
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1100;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, 800, 1100);

      ctx.fillStyle = card.customColor || '#D95B26';
      ctx.fillRect(0, 0, 800, 260);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillText('TARJETA DE SELLOS · TOQUE', 50, 70);

      ctx.font = 'bold 54px Sora, Inter, sans-serif';
      ctx.fillText(card.businessName || 'Mi Comercio', 50, 145);

      ctx.font = '600 30px Inter, sans-serif';
      ctx.fillText(
        `${card.name || 'Socio'} · SELLOS: ${card.stamps || 0} / ${
          card.stampsRequired || card.targetStamps || 10
        }`,
        50,
        205
      );

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(70, 320, 660, 640, 40);
      ctx.fill();

      const qrDataUrl = await QRCode.toDataURL(codeVal, {
        width: 440,
        margin: 1,
      });

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 180, 370, 440, 440);
          resolve();
        };
        img.src = qrDataUrl;
      });

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `tarjeta-${(card.businessName || 'toque').toLowerCase().replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // ignore canvas errors
    }
  };

  const handleSaveToWallet = async (card: ClubMember) => {
    setWalletBusy(true);
    try {
      const passRes = await api.createWalletPass({
        cartelCode: card.localCode || fromHubCode || 'BURGER01',
        memberId: card.id,
        memberCode: card.barcodeToken || card.memberCode,
        barcodeValue: card.barcodeToken || card.memberCode,
        customerName: card.anonymous ? undefined : card.name,
        customerContact: card.email || consumerUser.emailOrPhone,
        stamps: card.stamps,
        stampsRequired: card.stampsRequired || card.targetStamps || 10,
        rewardText: card.rewardText || 'Beneficio al completar tus sellos',
        colorPreset: (card.colorPreset as ColorPreset) || 'dark',
        color: card.customColor,
        logoURL: card.logoUrl,
        serialNumber: card.walletSerial,
        isUpdate: Boolean(card.walletSerial),
      });

      const rawTargetUrl =
        passRes.shareUrl || passRes.googleWalletUrl || passRes.appleWalletUrl || '';
      const cleanUrl = rawTargetUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');

      await loadData();

      if (
        cleanUrl &&
        (cleanUrl.includes('/api/wallet/pkpass/') ||
          cleanUrl.startsWith('data:application/vnd.apple.pkpass'))
      ) {
        const a = document.createElement('a');
        a.href = cleanUrl;
        a.download = `toque-${passRes.passId || 'card'}.pkpass`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Descargando tarjeta para Apple Wallet.', 'success');
        return;
      }

      if (
        !passRes.fallbackWebPass &&
        cleanUrl &&
        (cleanUrl.startsWith('https://walletwallet.dev') ||
          cleanUrl.startsWith('https://pay.google.com'))
      ) {
        window.location.href = cleanUrl;
        return;
      }

      await downloadCardPassImage(card);
      showToast('Tarjeta descargada y guardada en tu teléfono.', 'success');
    } catch {
      await downloadCardPassImage(card);
      showToast('Tarjeta guardada en tu teléfono.', 'success');
    } finally {
      setWalletBusy(false);
    }
  };

  const handleRevokeCard = async (card: ClubMember) => {
    setRevokeBusy(true);
    try {
      await api.revokeMemberCard(card.id);
      try {
        if (card.businessId) {
          localStorage.removeItem(`toque_member_${card.businessId}`);
        }
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('toque_member_') && key !== 'toque_member_emails_v1') {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.id === card.id) {
                localStorage.removeItem(key);
              }
            }
          }
        }
      } catch {
        // ignore
      }
      setRevokeConfirmOpen(false);
      setSelectedCardId(null);
      await loadData();
      showToast('Dimos de baja tu tarjeta y borramos tus datos en este local.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo dar de baja la tarjeta.', 'error');
    } finally {
      setRevokeBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-[#D95B26] selection:text-white">
      <div className="max-w-md mx-auto min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-between px-4 py-6">
        {/* =====================================================================
            VISTA B: DETALLE DE TARJETA (ESPEJO EXACTO DE WALLETWALLET + VAULTA)
        ===================================================================== */}
        {selectedCard ? (
          <div className="space-y-5">
            {/* Barra superior de navegación */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSelectedCardId(null);
                  setRevokeConfirmOpen(false);
                }}
                className="inline-flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-white py-1.5 px-3 rounded-xl bg-[#141414] border border-[#242424] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a mis tarjetas
              </button>

              {selectedCard.localCode ? (
                <Link
                  to={`/u/${selectedCard.localCode}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white py-1.5 px-3 rounded-xl bg-[#141414] border border-[#242424] transition-colors"
                >
                  Ver local
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : null}
            </div>

            {/* La Tarjeta (Espejo Exacto de WalletWallet) */}
            <WalletPassCard
              businessName={selectedCard.businessName || selectedCard.localName || 'La Burger'}
              memberName={
                selectedCard.anonymous
                  ? undefined
                  : selectedCard.name ||
                    (consumerUser.displayName !== 'Tus tarjetas'
                      ? consumerUser.displayName
                      : undefined)
              }
              stamps={selectedCard.stamps || 0}
              stampsRequired={selectedCard.stampsRequired || selectedCard.targetStamps || 10}
              rewardText={
                selectedCard.rewardText || 'Beneficio al completar tus sellos'
              }
              barcodeToken={
                selectedCard.barcodeToken ||
                selectedCard.memberCode ||
                'a1b2c3d4e5f60718293a4b5c6d7e8f90'
              }
              colorPreset={(selectedCard.colorPreset as ColorPreset) || 'dark'}
              customColor={selectedCard.customColor}
              logoURL={selectedCard.logoUrl}
            />

            {/* Dos tarjetas de estado estilo Vaulta debajo del pase */}
            {(() => {
              const stamps = selectedCard.stamps || 0;
              const required = Math.max(
                1,
                selectedCard.stampsRequired || selectedCard.targetStamps || 10
              );
              const percent = Math.min(100, Math.round((stamps / required) * 100));
              const cooldown = getCooldownStatus(selectedCard.lastStampedAt);

              return (
                <div className="grid grid-cols-1 gap-3">
                  {/* 1. Progreso de la tarjeta */}
                  <div className="rounded-2xl bg-[#141414] border border-[#242424] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-neutral-400">
                        Progreso de la tarjeta
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {stamps} / {required} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#0A0A0A] overflow-hidden border border-[#242424]">
                      <div
                        className="h-full rounded-full bg-[#D95B26] transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-neutral-400 mt-2">
                      {stamps >= required
                        ? '¡Ya completaste los sellos! Mostrá tu tarjeta en caja para canjear tu premio.'
                        : `Te faltan ${required - stamps} sello(s) para: ${
                            selectedCard.rewardText || 'tu premio'
                          }.`}
                    </p>
                  </div>

                  {/* 2. Próximo sello disponible (Reloj de 24h) */}
                  <div className="rounded-2xl bg-[#141414] border border-[#242424] p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#0A0A0A] border border-[#242424] flex items-center justify-center shrink-0">
                        <Clock
                          className={`w-4 h-4 ${
                            cooldown.inCooldown ? 'text-[#D95B26]' : 'text-emerald-400'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-neutral-400">
                          Próximo sello disponible
                        </div>
                        <div className="text-sm font-semibold text-white truncate">
                          {cooldown.label}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border shrink-0 ${
                        cooldown.inCooldown
                          ? 'bg-[#D95B26]/10 border-[#D95B26]/30 text-[#D95B26]'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      {cooldown.inCooldown ? 'En espera' : 'Listo'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Último aviso del local (si existe wallet_last_notification distinto de ' ') */}
            {selectedCard.walletLastNotification &&
            selectedCard.walletLastNotification.trim() !== '' ? (
              <div className="rounded-2xl bg-[#141414] border border-[#242424] p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#D95B26]/15 border border-[#D95B26]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4 text-[#D95B26]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-neutral-400 mb-0.5">
                    Último aviso del local
                  </div>
                  <p className="text-sm text-white leading-snug">
                    {selectedCard.walletLastNotification}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Aviso si hubo un error al sincronizar con la billetera */}
            {selectedCard.walletSyncError ? (
              <div className="rounded-2xl bg-[#141414] border border-red-500/30 p-4 space-y-2.5">
                <div className="text-xs font-medium text-red-300 leading-relaxed">
                  {selectedCard.walletSyncError}
                </div>
                <button
                  type="button"
                  disabled={walletBusy}
                  onClick={() => handleSaveToWallet(selectedCard)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0A0A0A] hover:bg-[#242424] border border-[#242424] px-3 py-1.5 rounded-xl transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${walletBusy ? 'animate-spin' : ''}`} />
                  Reintentar guardado en billetera
                </button>
              </div>
            ) : null}

            {/* Botón principal: Guardar en Apple / Google Wallet */}
            <div className="space-y-3 pt-1">
              {selectedCard.shareUrl &&
              selectedCard.shareUrl.startsWith('https://walletwallet.dev') ? (
                <a
                  href={selectedCard.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#D95B26] hover:bg-[#c24f1f] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors"
                >
                  <Wallet className="w-4 h-4" />
                  Guardar en Apple / Google Wallet
                </a>
              ) : (
                <button
                  type="button"
                  disabled={walletBusy}
                  onClick={() => handleSaveToWallet(selectedCard)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#D95B26] hover:bg-[#c24f1f] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors"
                >
                  <Wallet className="w-4 h-4" />
                  {walletBusy
                    ? 'Generando tarjeta para tu celular...'
                    : 'Guardar en Apple / Google Wallet'}
                </button>
              )}

              {/* Acción de pie: Dar de baja esta tarjeta */}
              {!revokeConfirmOpen ? (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setRevokeConfirmOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-red-400 py-2 px-3 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Dar de baja esta tarjeta
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#141414] border border-red-500/30 p-4 space-y-3">
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    ¿Querés dar de baja esta tarjeta? Se invalidará en tu celular y se borrarán tus sellos y datos en{' '}
                    <span className="font-semibold text-white">
                      {selectedCard.businessName || 'este comercio'}
                    </span>
                    .
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={revokeBusy}
                      onClick={() => handleRevokeCard(selectedCard)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
                    >
                      {revokeBusy ? 'Dando de baja...' : 'Sí, dar de baja'}
                    </button>
                    <button
                      type="button"
                      disabled={revokeBusy}
                      onClick={() => setRevokeConfirmOpen(false)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#0A0A0A] border border-[#242424] text-neutral-300 hover:text-white text-xs font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =====================================================================
              VISTA A: VISTA PRINCIPAL (MIS TARJETAS Y RESUMEN REAL)
          ===================================================================== */
          <div className="space-y-6">
            {fromHubCode ? (
              <div className="flex items-center justify-between">
                <Link
                  to={`/u/${fromHubCode}`}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-white py-2 px-3 rounded-xl bg-[#141414] border border-[#242424] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#D95B26]" />
                  <span>Volver al Hub del local</span>
                </Link>
              </div>
            ) : null}

            {/* Cabecera limpia */}
            <header className="flex items-center justify-between gap-3 pt-1">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {greetingName}
                </h1>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {isEmailVerified
                    ? `Guardado en tu cuenta (${account.maskedEmail || consumerUser.emailOrPhone})`
                    : 'Ingresá tu mail para no perder tus sellos si cambiás de celular'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOtpStep('email');
                  setAuthModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#141414] border border-[#242424] text-neutral-200 hover:border-[#D95B26]/50 hover:text-white transition-colors shrink-0"
              >
                {isEmailVerified ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5 text-[#D95B26]" />
                    Cambiar cuenta
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5 text-[#D95B26]" />
                    Ingresar con mail
                  </>
                )}
              </button>
            </header>

            {/* Resumen superior real */}
            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#141414] border border-[#242424] p-4">
                <div className="text-xs text-neutral-400 mb-1">Ahorro acumulado</div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  ${totalSavingsArs.toLocaleString('es-AR')}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Premios y beneficios reales
                </div>
              </div>

              <div className="rounded-2xl bg-[#141414] border border-[#242424] p-4">
                <div className="text-xs text-neutral-400 mb-1">Sellos activos</div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {activeStampsCount}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  En {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
                </div>
              </div>
            </section>

            {/* Carrusel / Lista de "Mis tarjetas" */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Mis tarjetas</h2>
                <span className="text-xs text-neutral-400">
                  {cards.length} {cards.length === 1 ? 'activa' : 'activas'}
                </span>
              </div>

              {loading ? (
                <div className="rounded-2xl bg-[#141414] border border-[#242424] p-6 text-center text-xs text-neutral-400">
                  Cargando tus tarjetas...
                </div>
              ) : cards.length === 0 ? (
                <div className="rounded-2xl bg-[#141414] border border-[#242424] p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#0A0A0A] border border-[#242424] flex items-center justify-center mx-auto text-[#D95B26]">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">
                      Todavía no tenés tarjetas activas
                    </h3>
                    <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                      Cuando visites un comercio adherido y apoyes tu celular en su cartel, tu tarjeta de sellos aparecerá acá.
                    </p>
                  </div>
                  {!isEmailVerified ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('email');
                        setAuthModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D95B26] hover:underline pt-1"
                    >
                      Ya tengo sellos con mi correo
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {cards.map((card) => (
                    <WalletPassCard
                      key={card.id}
                      compact
                      onClick={() => setSelectedCardId(card.id)}
                      businessName={card.businessName || card.localName || 'La Burger'}
                      memberName={card.anonymous ? undefined : card.name}
                      stamps={card.stamps || 0}
                      stampsRequired={card.stampsRequired || card.targetStamps || 10}
                      rewardText={
                        card.rewardText || 'Beneficio al completar tus sellos'
                      }
                      barcodeToken={
                        card.barcodeToken ||
                        card.memberCode ||
                        'a1b2c3d4e5f60718293a4b5c6d7e8f90'
                      }
                      colorPreset={(card.colorPreset as ColorPreset) || 'dark'}
                      customColor={card.customColor}
                      logoURL={card.logoUrl}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Actividad reciente ("Últimos movimientos") */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Últimos movimientos</h2>
              </div>

              {recentMovements.length === 0 ? (
                <div className="rounded-2xl bg-[#141414] border border-[#242424] p-5 text-center">
                  <p className="text-xs text-neutral-400">
                    Aún no hay sellos ni premios registrados en tu cuenta.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#141414] border border-[#242424] divide-y divide-[#242424]">
                  {recentMovements.slice(0, 10).map((mov) => (
                    <div
                      key={mov.id}
                      className="p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#0A0A0A] border border-[#242424] flex items-center justify-center shrink-0">
                          {mov.type === 'receipt' ? (
                            <ReceiptIcon className="w-4 h-4 text-neutral-400" />
                          ) : (
                            <CreditCard className="w-4 h-4 text-[#D95B26]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {mov.businessName}
                          </div>
                          <div className="text-xs text-neutral-400">
                            {new Date(mov.createdAt).toLocaleString('es-AR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                            mov.label === '+1 sello'
                              ? 'bg-[#D95B26]/10 border-[#D95B26]/30 text-[#D95B26]'
                              : 'bg-white/5 border-[#242424] text-neutral-200'
                          }`}
                        >
                          {mov.amountText || mov.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Pie discreto */}
        <footer className="pt-8 pb-2 flex items-center justify-between text-xs text-neutral-500 border-t border-[#242424] mt-8">
          <span>Toque · Tus tarjetas y sellos</span>
          <Link to="/" className="hover:text-neutral-300 transition-colors">
            Inicio
          </Link>
        </footer>
      </div>

      {/* Modal para vincular o cambiar correo con código de 6 dígitos */}
      {authModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] border border-[#242424] p-5 space-y-4 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {otpStep === 'email' ? 'Guardá tus sellos en tu cuenta' : 'Ingresá tu código'}
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  {otpStep === 'email'
                    ? 'Ingresá tu mail para no perder tus sellos si cambiás de celular.'
                    : `Enviamos un código de 6 números a ${emailInput.trim()}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {otpStep === 'email' ? (
              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Tu nombre
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Ej. Valentina"
                    className="w-full rounded-xl bg-[#0A0A0A] border border-[#242424] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Tu correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full rounded-xl bg-[#0A0A0A] border border-[#242424] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full py-3 rounded-xl bg-[#D95B26] hover:bg-[#c24f1f] disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {authBusy ? 'Enviando código...' : 'Recibir código por mail'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                {otpPreviewCode ? (
                  <div className="rounded-xl bg-[#0A0A0A] border border-[#242424] p-3 text-xs text-neutral-300">
                    Código de verificación:{' '}
                    <span className="font-mono font-bold text-[#D95B26]">
                      {otpPreviewCode}
                    </span>
                  </div>
                ) : null}
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Código de 6 números
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full rounded-xl bg-[#0A0A0A] border border-[#242424] px-3.5 py-2.5 text-center font-mono text-lg tracking-widest text-white focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOtpStep('email')}
                    className="py-2.5 px-3 rounded-xl bg-[#0A0A0A] border border-[#242424] text-xs font-medium text-neutral-300 hover:text-white"
                  >
                    Cambiar mail
                  </button>
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#D95B26] hover:bg-[#c24f1f] disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                  >
                    {authBusy ? 'Verificando...' : 'Confirmar código'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ToquecitosView;
