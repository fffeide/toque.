import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { api } from '../../api';
import {
  ClubConfig,
  ClubMember,
  ClubLocal,
  PlanState,
  DashboardSummary,
} from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { RealQrCode } from '../../components/ui/RealQrCode';
import { WalletPassCard } from '../../components/wallet/WalletPassCard';
import { getPlanLimits } from '../../config/pricing';
import {
  Download,
  Search,
  QrCode,
  Plus,
  Minus,
  X,
  Barcode,
  CheckCircle2,
  ShieldAlert,
  CreditCard,
  Trash2,
  RefreshCw,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Save,
  Smartphone,
  Lock,
} from 'lucide-react';

type WalletPreviewPlatform = 'apple' | 'google';
type PresetColorKey = 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';

const PRESET_HEX_MAP: Record<PresetColorKey, string> = {
  dark: '#141418',
  blue: '#1E3A8A',
  green: '#14532D',
  red: '#7F1D1D',
  purple: '#4C1D95',
  orange: '#D95B26',
};

function formatShortCodeInput(raw: string): string {
  const alnum = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (alnum.length > 4) {
    return `${alnum.slice(0, 4)}-${alnum.slice(4)}`;
  }
  return alnum;
}

export const ClubView: React.FC = () => {
  const { user, business } = useAuth();
  const { showToast } = useToast();
  const scannerInputRef = useRef<HTMLInputElement | null>(null);

  const isCashier = user?.role === 'cashier' && !user?.isSuperAdmin;
  const isManager = user?.role === 'manager' && !user?.isSuperAdmin;
  const isOwner =
    user?.role === 'owner' || user?.role === 'superadmin' || Boolean(user?.isSuperAdmin);

  const formatMemberNameForRole = (fullName?: string): string => {
    const clean = (fullName || 'Cliente').trim();
    if (!isCashier) return clean;
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'Cliente';
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || '';
    return lastInitial ? `${firstName} ${lastInitial}.` : firstName;
  };

  const [activeTab, setActiveTab] = useState<'socios' | 'diseno'>('socios');
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [cards, setCards] = useState<ClubConfig[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLocalId, setSelectedLocalId] = useState('all');

  // Lector de Código Corto (auto-formatea el guión central ABCD-1234)
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [scanningFast, setScanningFast] = useState(false);
  const [lastScannedMember, setLastScannedMember] = useState<ClubMember | null>(null);

  // =========================================================================
  // CONFIGURACIÓN SIMPLE Y UNIFICADA DE LA TARJETA (8 CAMPOS)
  // =========================================================================
  const [previewPlatform, setPreviewPlatform] = useState<WalletPreviewPlatform>('apple');
  const [savingConfig, setSavingConfig] = useState(false);

  // 1. Nombre de tarjeta
  const [logoText, setLogoText] = useState('');
  // 2. Nombre del comercio (predeterminado con el nombre del comercio, editable)
  const [organizationName, setOrganizationName] = useState('');
  // 3. Meta de sellos
  const [targetStamps, setTargetStamps] = useState(10);
  // 4. Premio
  const [rewardText, setRewardText] = useState('');
  // 5. Valor del premio (Opcional)
  const [rewardValueArs, setRewardValueArs] = useState<number>(0);
  // 6. Logo (Opcional)
  const [logoUrl, setLogoUrl] = useState('');
  // 7. Color (Opcional)
  const [colorPreset, setColorPreset] = useState<PresetColorKey>('dark');
  const [customColor, setCustomColor] = useState('');
  // 8. Vencimiento (Opcional)
  const [expirationPolicy, setExpirationPolicy] = useState('No vencen');

  // Modal de resultado al finalizar el proceso: Muestra el QR y el Link para compartir
  const [completedCardResult, setCompletedCardResult] = useState<{
    cardTitle: string;
    hubLink: string;
    walletShareUrl?: string;
    serialNumber?: string;
  } | null>(null);

  // Modal de Nueva Tarjeta
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardReward, setNewCardReward] = useState('');
  const [newCardStamps, setNewCardStamps] = useState(10);
  const [newCardPreset, setNewCardPreset] = useState<PresetColorKey>('dark');
  const [creatingCard, setCreatingCard] = useState(false);

  // Modal de Anulación / Ajuste Manual (con motivo obligatorio >= 10 caracteres)
  const [adjustTarget, setAdjustTarget] = useState<ClubMember | null>(null);
  const [adjustMode, setAdjustMode] = useState<'void' | 'adjust'>('void');
  const [adjustDelta, setAdjustDelta] = useState(-1);
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Modal de Borrar Socio con motivo obligatorio (solo Dueño)
  const [deleteTarget, setDeleteTarget] = useState<ClubMember | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const syncFormWithConfig = (cfg: ClubConfig) => {
    const bizName = business?.name || 'Musical Monroe';
    const defaultTitle =
      cfg.logoText || cfg.loyaltyTitle || `Tarjeta de sellos de ${bizName}`;
    const defaultReward =
      cfg.loyaltyReward ||
      cfg.rewardText ||
      cfg.secondaryFields?.find((f) => f.label.toLowerCase().includes('premio'))?.value ||
      'Beneficio al completar tus sellos';
    const stampsReq = cfg.targetStamps || cfg.stampsRequired || 10;

    setLogoText(defaultTitle);
    setOrganizationName(cfg.organizationName || bizName);
    setTargetStamps(stampsReq);
    setRewardText(defaultReward);
    setRewardValueArs(cfg.rewardValueArs ?? 0);
    setLogoUrl(cfg.logoUrl || '');
    setColorPreset((cfg.colorPreset as PresetColorKey) || 'dark');
    setCustomColor(cfg.customColor || '');
    setExpirationPolicy(cfg.expirationPolicy || 'No vencen');
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [cfg, allCards, mems, locs, plan, sum] = await Promise.all([
        api.getClubConfig(),
        api.listClubCards().catch(() => []),
        api.listMembers(),
        api.listLocals(),
        api.getPlanState().catch(() => null),
        api.getDashboardSummary('all').catch(() => null),
      ]);
      setConfig(cfg);
      setCards(allCards);
      setMembers(mems);
      setLocals(locs);
      setPlanState(plan);
      setSummary(sum);
      syncFormWithConfig(cfg);
    } catch (err: any) {
      showToast(err?.message || 'Error al cargar tarjetas del Club', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'socios' && scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, [activeTab, loading]);

  const planLimits = getPlanLimits(planState?.planId || planState?.status);
  const canCreateMoreCards = cards.length < 1;

  const activeCartelCode = locals[0]?.code || 'MONROE01';
  const publicHubUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/u/${activeCartelCode}`
      : `/u/${activeCartelCode}`;

  const effectiveCardBgColor =
    customColor.trim() && /^#[0-9A-Fa-f]{6}$/.test(customColor.trim())
      ? customColor.trim()
      : PRESET_HEX_MAP[colorPreset] || '#141418';

  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectCard = async (cardId: string) => {
    try {
      const selected = await api.selectClubCard(cardId);
      setConfig(selected);
      syncFormWithConfig(selected);
      showToast(`Tarjeta activa: ${selected.loyaltyTitle || 'Tarjeta de sellos'}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo cambiar la tarjeta', 'error');
    }
  };

  // Guardar la tarjeta unificada + mostrar QR y Link al terminar
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrg = organizationName.trim() || business?.name || 'Mi Comercio';
    const cleanTitle = logoText.trim() || `Tarjeta de sellos de ${cleanOrg}`;
    const cleanReward = rewardText.trim() || 'Beneficio al completar tus sellos';

    // Etiquetas fijas y no editables: Sellos, Premio, Cliente
    const fixedPrimaryFields = [{ label: 'Sellos', value: `1 / ${targetStamps}` }];
    const fixedSecondaryFields = [
      { label: 'Premio', value: cleanReward },
      { label: 'Cliente', value: cleanOrg },
    ];

    try {
      setSavingConfig(true);

      const updated = await api.updateClubConfig({
        id: config?.id,
        name: cleanTitle,
        loyaltyTitle: cleanTitle,
        logoText: cleanTitle,
        organizationName: cleanOrg,
        rewardText: cleanReward,
        loyaltyReward: cleanReward,
        rewardValueArs: Math.max(0, Number(rewardValueArs) || 0),
        targetStamps,
        stampsRequired: targetStamps,
        brandColor: effectiveCardBgColor,
        cardThemeColor: effectiveCardBgColor,
        colorPreset,
        customColor: customColor.trim() || undefined,
        barcodeFormat: 'CODE128',
        logoUrl: logoUrl.trim() || undefined,
        headerFields: [],
        primaryFields: fixedPrimaryFields,
        secondaryFields: fixedSecondaryFields,
        expirationPolicy,
      });

      const passRes = await api
        .createWalletPass({
          cartelCode: activeCartelCode,
          memberId: updated.id || '48291037',
          memberCode: '48291037',
          customerName: cleanOrg,
          stamps: 1,
          stampsRequired: targetStamps,
          logoText: cleanTitle,
          organizationName: cleanOrg,
          rewardText: cleanReward,
          barcodeFormat: 'CODE128',
          barcodeValue: '48291037',
          barcodeAltText: '48291037',
          colorPreset,
          color:
            customColor.trim() && /^#[0-9A-Fa-f]{6}$/.test(customColor.trim())
              ? customColor.trim()
              : undefined,
          logoURL: logoUrl.trim() || undefined,
          primaryFields: fixedPrimaryFields,
          secondaryFields: fixedSecondaryFields,
          serialNumber: config?.walletSerial,
          isUpdate: Boolean(config?.walletSerial),
        })
        .catch(() => null);

      if (passRes?.serialNumber || passRes?.shareUrl) {
        const synced = await api.updateClubConfig({
          id: updated.id,
          walletSerial: passRes.serialNumber || passRes.passId,
          shareUrl: passRes.shareUrl || passRes.appleWalletUrl,
        });
        setConfig(synced);
      } else {
        setConfig(updated);
      }

      const allCards = await api.listClubCards();
      setCards(allCards);

      setCompletedCardResult({
        cardTitle: cleanTitle,
        hubLink: publicHubUrl,
        walletShareUrl: passRes?.shareUrl || passRes?.appleWalletUrl,
        serialNumber: passRes?.serialNumber || passRes?.passId,
      });

      showToast('Tarjeta guardada y lista para compartir', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar la tarjeta', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardReward.trim()) {
      showToast('Escribí cuál es el premio al completar los 10 sellos', 'error');
      return;
    }
    if (cards.length >= 1) {
      showToast(
        'Tenés 1 tarjeta activa en tu local. Si necesitás crear más de una tarjeta, ponete en contacto con nosotros',
        'error'
      );
      return;
    }
    try {
      setCreatingCard(true);
      const presetColorHex = PRESET_HEX_MAP[newCardPreset] || '#141418';
      const cleanOrg = business?.name || 'Mi Comercio';
      const resolvedTitle =
        newCardTitle.trim() || `Tarjeta de sellos de ${cleanOrg}`;
      const fixedStamps = 10;
      const primary = [{ label: 'Sellos', value: `1 / ${fixedStamps}` }];
      const secondary = [
        { label: 'Premio', value: newCardReward.trim() },
        { label: 'Cliente', value: cleanOrg },
      ];

      const created = await api.createClubCard({
        loyaltyTitle: resolvedTitle,
        logoText: resolvedTitle,
        organizationName: cleanOrg,
        rewardText: newCardReward.trim(),
        stampsRequired: fixedStamps,
        targetStamps: fixedStamps,
        brandColor: presetColorHex,
        colorPreset: newCardPreset,
        barcodeFormat: 'CODE128',
        primaryFields: primary,
        secondaryFields: secondary,
      });

      const passRes = await api
        .createWalletPass({
          cartelCode: activeCartelCode,
          memberId: created.id || '48291037',
          memberCode: '48291037',
          customerName: cleanOrg,
          stamps: 1,
          stampsRequired: fixedStamps,
          logoText: resolvedTitle,
          organizationName: cleanOrg,
          rewardText: newCardReward.trim(),
          barcodeFormat: 'CODE128',
          barcodeValue: '48291037',
          barcodeAltText: '48291037',
          colorPreset: newCardPreset,
          primaryFields: primary,
          secondaryFields: secondary,
        })
        .catch(() => null);

      const updatedCards = await api.listClubCards();
      setCards(updatedCards);
      setConfig(created);
      syncFormWithConfig(created);
      setShowNewCardModal(false);
      setNewCardTitle('');
      setNewCardReward('');
      setActiveTab('diseno');

      setCompletedCardResult({
        cardTitle: created.loyaltyTitle || resolvedTitle,
        hubLink: publicHubUrl,
        walletShareUrl: passRes?.shareUrl || passRes?.appleWalletUrl,
        serialNumber: passRes?.serialNumber || passRes?.passId,
      });

      showToast('Tarjeta creada con éxito', 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo crear la tarjeta', 'error');
    } finally {
      setCreatingCard(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (cards.length <= 1) {
      showToast('Debés mantener al menos 1 tarjeta activa.', 'error');
      return;
    }
    try {
      const updated = await api.deleteClubCard(cardId);
      setCards(updated);
      if (updated[0]) {
        setConfig(updated[0]);
        syncFormWithConfig(updated[0]);
      }
      showToast('Tarjeta eliminada', 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo eliminar la tarjeta', 'error');
    }
  };

  const handleDownloadQrPng = async (urlToEncode: string, titleLabel: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(urlToEncode, {
        width: 600,
        margin: 2,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qr-${titleLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'tarjeta'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Código QR descargado en PNG', 'success');
    } catch {
      showToast('No se pudo descargar el QR', 'error');
    }
  };

  const handleBarcodeScannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeQuery.trim().toUpperCase();
    if (!code) return;

    try {
      setScanningFast(true);
      const res = await api.addStampByCashier({
        memberCode: code,
      });
      if (res.cooldown) {
        const remMs = res.remainingMs || 0;
        const hrs = Math.floor(remMs / 3600000);
        const mins = Math.max(1, Math.ceil((remMs % 3600000) / 60000));
        showToast(
          res.message || `Podrá sumar en ${hrs} h ${mins} min.`,
          'info'
        );
        return;
      }
      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      setLastScannedMember(res.member);
      setBarcodeQuery('');
      showToast(
        `Sello sumado a ${formatMemberNameForRole(res.member.name)} (${res.member.stamps}/${
          res.member.targetStamps || 10
        })`,
        'success'
      );
      scannerInputRef.current?.focus();
    } catch (err: any) {
      showToast(
        err?.message || 'No encontramos ese código. Revisalo y probá de nuevo.',
        'error'
      );
    } finally {
      setScanningFast(false);
    }
  };

  const handleQuickPlusStamp = async (member: ClubMember) => {
    try {
      const res = await api.addStampByCashier({
        memberCode: member.shortCode || member.memberCode || member.id,
      });
      if (res.cooldown) {
        const remMs = res.remainingMs || 0;
        const hrs = Math.floor(remMs / 3600000);
        const mins = Math.max(1, Math.ceil((remMs % 3600000) / 60000));
        showToast(
          res.message || `Podrá sumar en ${hrs} h ${mins} min.`,
          'info'
        );
        return;
      }
      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      setLastScannedMember(res.member);
      showToast(
        `Sello sumado a ${formatMemberNameForRole(res.member.name)} (${res.member.stamps}/${
          res.member.targetStamps || 10
        })`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'No se pudo sumar el sello', 'error');
    }
  };

  const handleRedeemReward = async (member: ClubMember) => {
    try {
      const res = await api.redeemReward(member.id);
      setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
      showToast(`¡Premio entregado a ${formatMemberNameForRole(res.member.name)}!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo entregar el premio', 'error');
    }
  };

  const handleDeleteMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;
    if (!isOwner) {
      showToast('Solo el dueño puede borrar un socio.', 'error');
      return;
    }
    if (deleteReason.trim().length < 10) {
      showToast('Escribí el motivo para borrar al socio (mínimo 10 caracteres).', 'error');
      return;
    }
    try {
      setSubmittingDelete(true);
      await api.deleteClubMember(deleteTarget.id, deleteReason.trim());
      setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteReason('');
      showToast('Socio borrado y acción registrada en correcciones.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo borrar el socio', 'error');
    } finally {
      setSubmittingDelete(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    if (adjustReason.trim().length < 10) {
      showToast('El motivo debe tener al menos 10 caracteres.', 'error');
      return;
    }
    try {
      setSubmittingAdjust(true);
      if (adjustMode === 'void') {
        const res = await api.voidStamp({
          stampId: `stamp-${Date.now()}`,
          memberId: adjustTarget.id,
          reason: adjustReason.trim(),
        });
        setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
        showToast('Sello anulado y registrado en la lista de correcciones.', 'success');
      } else {
        const res = await api.adjustBalance({
          memberId: adjustTarget.id,
          delta: adjustDelta,
          reason: adjustReason.trim(),
        });
        setMembers((prev) => prev.map((m) => (m.id === res.member.id ? res.member : m)));
        showToast('Saldo de sellos ajustado y registrado en la lista de correcciones.', 'success');
      }
      setAdjustTarget(null);
      setAdjustReason('');
    } catch (err: any) {
      showToast(err?.message || 'Error al registrar la corrección', 'error');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64 rounded-xl bg-[#141418]" />
        <Skeleton className="h-72 rounded-2xl bg-[#141418]" />
      </div>
    );
  }

  const returningMembersCount = members.filter(
    (m) => (m.stamps || 0) > 1 || (m.rewardsRedeemed || 0) > 0
  ).length;
  const returningRatePercent =
    summary?.returningRatePercent ??
    (members.length > 0 ? Math.round((returningMembersCount / members.length) * 100) : 0);

  const filteredMembers = members.filter((m) => {
    if (selectedLocalId !== 'all' && m.localId !== selectedLocalId) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const qNoHyphen = q.replace(/-/g, '');
    const memberShort = (m.shortCode || m.memberCode || '').toLowerCase();
    const memberShortNoHyphen = memberShort.replace(/-/g, '');
    if (isCashier) {
      return (
        formatMemberNameForRole(m.name).toLowerCase().includes(q) ||
        memberShort.includes(q) ||
        (qNoHyphen.length > 0 && memberShortNoHyphen.includes(qNoHyphen))
      );
    }
    return (
      (m.name || '').toLowerCase().includes(q) ||
      memberShort.includes(q) ||
      (qNoHyphen.length > 0 && memberShortNoHyphen.includes(qNoHyphen)) ||
      (m.maskedEmail || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-16 text-sm">
      {/* Cabecera + Métrica de Clientes que Volvieron + Selector de Sub-Vistas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#F4F4F6]">Tarjetas y Socios</h1>
          <p className="text-xs text-[#9E9EA8] mt-0.5">
            {isCashier
              ? 'Vista de cajero: nombre con inicial, sellos y premios (sin correo ni cumpleaños).'
              : isManager
              ? 'Vista de encargado: lista de socios con mail parcialmente oculto, cumpleaños y anulaciones con motivo.'
              : 'Vista de dueño: gestión de socios y configuración unificada de tu tarjeta de sellos.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isCashier && (
            <div className="px-3 py-2 rounded-xl bg-[#141418] border border-[#282830] flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-[#D95B26]" />
              <span className="text-xs text-[#9E9EA8]">Clientes que volvieron:</span>
              <span className="text-xs font-extrabold text-[#F4F4F6]">{returningRatePercent}%</span>
            </div>
          )}

          {!isCashier && (
            <div className="inline-flex rounded-xl bg-[#141418] p-1 border border-[#282830]">
              <button
                type="button"
                onClick={() => setActiveTab('socios')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'socios'
                    ? 'bg-[#D95B26] text-white'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Socios ({members.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('diseno')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'diseno'
                    ? 'bg-[#D95B26] text-white'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Configurar Tarjeta ({cards.length})
              </button>
            </div>
          )}

          {!isCashier && (
            <Link
              to="/panel/club/auditoria"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xs font-semibold text-[#F4F4F6]"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#BEC8FF]" />
              <span>Correcciones</span>
            </Link>
          )}
        </div>
      </div>

      {/* Barra de Tarjetas Activas (0 tarjetas por defecto, máximo 1 tarjeta por comercio) */}
      {!isCashier && (
        <div className="rounded-2xl bg-[#141418] border border-[#282830] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {cards.length === 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
              <div>
                <p className="text-sm font-bold text-[#F4F4F6]">
                  Todavía no creaste la tarjeta de sellos de tu local
                </p>
                <p className="text-xs text-[#9E9EA8] mt-0.5">
                  Creá tu tarjeta con objetivo de 10 sellos y definí el premio para tus clientes.
                </p>
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowNewCardModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-xs font-bold text-white cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear tarjeta</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#9E9EA8] mr-1">Tarjeta activa:</span>
                  {cards.slice(0, 1).map((c, idx) => (
                    <div
                      key={c.id || idx}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-[#D95B26]/15 border-[#D95B26] text-xs font-bold text-[#F4F4F6]"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.cardThemeColor || c.brandColor || '#D95B26' }}
                      />
                      <span>{c.loyaltyTitle || `Tarjeta de ${business?.name || 'tu local'}`}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#9E9EA8]">
                  Tenés 1 tarjeta activa en tu local. Si necesitás crear más de una tarjeta, ponete en contacto con nosotros
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setCompletedCardResult({
                      cardTitle:
                        logoText.trim() ||
                        config?.loyaltyTitle ||
                        `Tarjeta de ${business?.name || 'Mi Comercio'}`,
                      hubLink: publicHubUrl,
                      walletShareUrl: config?.shareUrl,
                      serialNumber: config?.walletSerial,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2FB36A]/15 hover:bg-[#2FB36A]/25 border border-[#2FB36A]/40 text-xs font-bold text-[#2FB36A] cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Ver QR y link</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODULO 1: LECTOR DE CÓDIGO CORTO + TABLA DE SOCIOS                  */}
      {/* =================================================================== */}
      {activeTab === 'socios' && (
        <div className="space-y-4">
          <form
            onSubmit={handleBarcodeScannerSubmit}
            className="rounded-2xl bg-[#141418] border border-[#D95B26]/50 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#D95B26]">
                <Barcode className="w-4 h-4" />
                <span>Ingresar código corto (el guión se pone solo al escribir)</span>
              </div>
              <Link
                to="/panel/escanear"
                className="text-xs font-bold text-[#BEC8FF] hover:underline flex items-center gap-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Ir a pantalla Sumar sello →</span>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-[#D95B26] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={scannerInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={9}
                  autoFocus
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 9))}
                  placeholder="Ingresá los 8 números debajo del código de barras (ej. 48291037)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] font-mono text-xs font-bold tracking-wider text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
                />
              </div>
              <button
                type="submit"
                disabled={scanningFast || !barcodeQuery.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#2FB36A] hover:bg-[#269a59] text-[#05150c] font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>{scanningFast ? 'Sumando...' : 'Sumar sello'}</span>
              </button>
            </div>

            {lastScannedMember && (
              <div className="p-2.5 rounded-xl bg-[#2FB36A]/15 border border-[#2FB36A]/40 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2FB36A]" />
                  <div className="text-xs">
                    <span className="font-bold text-[#F4F4F6]">
                      Último escaneo: {formatMemberNameForRole(lastScannedMember.name)} (
                      {lastScannedMember.shortCode || lastScannedMember.memberCode})
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
                    className="px-2.5 py-1 rounded-lg bg-[#D95B26] text-white text-xs font-bold cursor-pointer"
                  >
                    🎁 Entregar premio
                  </button>
                )}
              </div>
            )}
          </form>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9E9EA8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isCashier
                    ? 'Buscar por nombre o código corto...'
                    : 'Filtrar por nombre, código corto o mail oculto...'
                }
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#141418] border border-[#282830] text-xs text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
              />
            </div>

            <select
              value={selectedLocalId}
              onChange={(e) => setSelectedLocalId(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-[#141418] border border-[#282830] text-xs text-[#F4F4F6]"
            >
              <option value="all">Todas las sucursales</option>
              {locals.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl bg-[#141418] border border-[#282830] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#242424] text-xs font-semibold text-[#9E9EA8] bg-[#141414]">
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Código corto</th>
                    {!isCashier && <th className="py-3 px-4">Cumpleaños (día/mes)</th>}
                    <th className="py-3 px-4">Sellos y premio</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#282830] text-xs">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isCashier ? 4 : 5}
                        className="py-8 text-center text-[#9E9EA8]"
                      >
                        No encontramos clientes con ese criterio.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const target = m.targetStamps || 10;
                      const isReadyForReward = m.stamps >= target;
                      return (
                        <tr key={m.id} className="hover:bg-[#1C1C22]/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#F4F4F6]">
                              {formatMemberNameForRole(m.name)}
                            </div>
                            {!isCashier && (
                              <div className="text-[11px] text-[#9E9EA8]">
                                {m.maskedEmail || '—'}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-[#0C0C0E] border border-[#282830] font-mono text-[11px] font-bold text-[#BEC8FF]">
                              {m.shortCode || m.memberCode}
                            </span>
                          </td>

                          {!isCashier && (
                            <td className="py-3 px-4 text-xs text-[#9E9EA8]">
                              {m.birthDay && m.birthMonth
                                ? `${String(m.birthDay).padStart(2, '0')}/${String(
                                    m.birthMonth
                                  ).padStart(2, '0')}`
                                : '—'}
                            </td>
                          )}

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-extrabold px-2 py-0.5 rounded-md ${
                                  isReadyForReward
                                    ? 'bg-[#2FB36A]/20 text-[#2FB36A]'
                                    : 'bg-[#1C1C22] text-[#F4F4F6]'
                                }`}
                              >
                                {m.stamps} / {target}
                              </span>
                              <span className="text-[11px] text-[#9E9EA8] truncate max-w-[160px]">
                                {m.rewardText || config?.rewardText || 'Premio del club'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickPlusStamp(m)}
                                className="px-2.5 py-1.5 rounded-xl bg-[#2FB36A]/15 hover:bg-[#2FB36A]/25 border border-[#2FB36A]/40 text-[#2FB36A] font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                                title="Sumar 1 sello"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Sello</span>
                              </button>

                              {isReadyForReward && (
                                <button
                                  type="button"
                                  onClick={() => handleRedeemReward(m)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white font-bold text-xs cursor-pointer"
                                >
                                  Canjear
                                </button>
                              )}

                              {!isCashier && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdjustTarget(m);
                                    setAdjustMode('void');
                                    setAdjustDelta(-1);
                                    setAdjustReason('');
                                  }}
                                  className="p-1.5 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-[#9E9EA8] hover:text-white cursor-pointer"
                                  title="Anular o ajustar sellos (con motivo)"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteTarget(m);
                                    setDeleteReason('');
                                  }}
                                  className="p-1.5 rounded-xl bg-[#1C1C22] hover:bg-[#ef4444]/20 border border-[#282830] hover:border-[#ef4444]/40 text-[#9E9EA8] hover:text-[#f87171] cursor-pointer"
                                  title="Borrar socio (con motivo)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
      {/* MODULO 2: VISTA UNIFICADA Y SIMPLE PARA CONFIGURAR TARJETA          */}
      {/* =================================================================== */}
      {activeTab === 'diseno' && !isCashier && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Panel Izquierdo: Una sola vista simple con los 8 datos */}
          <form
            onSubmit={handleSaveConfig}
            className="lg:col-span-7 rounded-2xl bg-[#141418] border border-[#282830] overflow-hidden"
          >
            <div className="border-b border-[#282830] px-5 py-3.5 flex items-center justify-between gap-3 bg-[#1C1C22]/50">
              <div>
                <h2 className="text-sm font-bold text-[#F4F4F6]">
                  Datos de tu tarjeta de sellos
                </h2>
                <p className="text-[11px] text-[#9E9EA8]">
                  Todo en un solo lugar. Los títulos de los campos (Sellos, Premio y Socio) son fijos.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#2FB36A]/15 text-[#2FB36A] text-[10px] font-bold shrink-0">
                Vista en vivo
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* 1. Nombre de tarjeta y 2. Nombre del comercio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                    Nombre de tarjeta *
                  </label>
                  <input
                    type="text"
                    required
                    value={logoText}
                    onChange={(e) => setLogoText(e.target.value)}
                    placeholder={`Tarjeta de sellos de ${business?.name || 'Mi Comercio'}`}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                    Nombre del comercio *
                  </label>
                  <input
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder={business?.name || 'Mi Comercio'}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
              </div>

              {/* 3. Meta de sellos y 4. Premio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                    Meta de sellos *
                  </label>
                  <input
                    type="number"
                    required
                    min={2}
                    max={25}
                    value={targetStamps}
                    onChange={(e) =>
                      setTargetStamps(Math.max(2, Math.min(25, Number(e.target.value) || 10)))
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] font-mono text-xs font-bold text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                    Premio *
                  </label>
                  <input
                    type="text"
                    required
                    value={rewardText}
                    onChange={(e) => setRewardText(e.target.value)}
                    placeholder="Ej: Encordado o beneficio gratis al completar tus sellos"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                  />
                </div>
              </div>

              {/* Resumen visual de etiquetas fijas (no editables por el comercio) */}
              <div className="rounded-xl bg-[#0C0C0E] border border-[#282830] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#9E9EA8] inline-flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[#D95B26]" />
                    <span>Campos fijos de la tarjeta (no editables)</span>
                  </span>
                  <span className="text-[10px] text-[#9E9EA8]">
                    Código numérico de 8 dígitos siempre visible debajo del código de barras
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-[#141418] border border-[#242428]">
                    <span className="block text-[10px] font-bold text-[#9E9EA8]">Sellos</span>
                    <span className="font-mono font-bold text-[#F4F4F6]">1 / {targetStamps}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#141418] border border-[#242428]">
                    <span className="block text-[10px] font-bold text-[#9E9EA8]">Premio</span>
                    <span className="font-semibold text-[#F4F4F6] truncate block">
                      {rewardText || 'Tu premio'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#141418] border border-[#242428]">
                    <span className="block text-[10px] font-bold text-[#9E9EA8]">Cliente</span>
                    <span className="font-semibold text-[#F4F4F6] truncate block">
                      Nombre del cliente
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Valor del premio (Opcional) y 8. Vencimiento (Opcional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-[#282830]">
                <div>
                  <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                    Valor del premio ($ ARS){' '}
                    <span className="text-[#9E9EA8] font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={rewardValueArs || ''}
                    onChange={(e) => setRewardValueArs(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="Ej: 8500"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                    Vencimiento <span className="text-[#9E9EA8] font-normal">(Opcional)</span>
                  </label>
                  <select
                    value={expirationPolicy}
                    onChange={(e) => setExpirationPolicy(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                  >
                    <option value="No vencen">Sin vencimiento</option>
                    <option value="30 días">30 días</option>
                    <option value="90 días">90 días</option>
                    <option value="365 días">1 año (365 días)</option>
                  </select>
                </div>
              </div>

              {/* 6. Logo (Opcional) y 7. Color (Opcional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-[#282830]">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#F4F4F6]">
                    Color <span className="text-[#9E9EA8] font-normal">(Opcional)</span>
                  </label>
                  <select
                    value={colorPreset}
                    onChange={(e) => {
                      const next = e.target.value as PresetColorKey;
                      setColorPreset(next);
                      setCustomColor('');
                    }}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                  >
                    <option value="dark">Oscuro</option>
                    <option value="blue">Azul</option>
                    <option value="green">Verde</option>
                    <option value="red">Rojo</option>
                    <option value="purple">Violeta</option>
                    <option value="orange">Naranja</option>
                  </select>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      placeholder="Color hex (ej. #D95B26)"
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[#0C0C0E] border border-[#282830] font-mono text-xs text-[#F4F4F6]"
                    />
                    <input
                      type="color"
                      value={effectiveCardBgColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-transparent border border-[#282830] cursor-pointer shrink-0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#F4F4F6]">
                    Logo <span className="text-[#9E9EA8] font-normal">(Opcional)</span>
                  </label>
                  <label className="border border-dashed border-[#282830] hover:border-[#BEC8FF] rounded-xl p-2.5 flex items-center justify-center gap-2 cursor-pointer bg-[#0C0C0E]">
                    <ImageIcon className="w-4 h-4 text-[#9E9EA8]" />
                    <span className="text-xs text-[#9E9EA8]">Subir imagen</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileUpload(e, setLogoUrl)}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="o pegá el link del logo (https://...)"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                  />
                </div>
              </div>

              {/* Botón de Guardar y mostrar QR / Link */}
              <div className="pt-3 border-t border-[#282830] flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-5 py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {savingConfig
                      ? 'Guardando y generando QR...'
                      : 'Guardar cambios y obtener QR / Link'}
                  </span>
                </button>
              </div>
            </div>
          </form>

          {/* Panel Derecho: Vista Previa en Vivo (Apple / Google Phone Mockup) */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-4">
            <div className="inline-flex rounded-xl bg-[#141418] p-1 border border-[#282830]">
              <button
                type="button"
                onClick={() => setPreviewPlatform('apple')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  previewPlatform === 'apple'
                    ? 'bg-[#F4F4F6] text-[#0C0C0E]'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Apple Wallet
              </button>
              <button
                type="button"
                onClick={() => setPreviewPlatform('google')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  previewPlatform === 'google'
                    ? 'bg-[#F4F4F6] text-[#0C0C0E]'
                    : 'text-[#9E9EA8] hover:text-white'
                }`}
              >
                Google Wallet
              </button>
            </div>

            {/* Marco del teléfono */}
            <div className="w-full max-w-[330px] rounded-[42px] bg-[#1C1C22] border-4 border-[#282830] p-4 shadow-2xl space-y-4">
              <div className="flex items-center justify-between px-3 pt-1 text-[11px] font-semibold text-[#9E9EA8]">
                <span>9:41</span>
                <div className="w-20 h-5 rounded-full bg-[#0C0C0E] border border-[#282830]" />
                <span>5G 100%</span>
              </div>

              {/* Tarjeta dentro del teléfono con el código corto SIEMPRE visible debajo del QR */}
              <WalletPassCard
                businessName={
                  logoText || `Tarjeta de sellos de ${organizationName || business?.name || 'Mi Comercio'}`
                }
                memberName={organizationName || business?.name || 'Cliente'}
                stamps={1}
                stampsRequired={targetStamps}
                rewardText={rewardText || 'Beneficio al completar tus sellos'}
                barcodeToken="48291037"
                shortCode="48291037"
                colorPreset={colorPreset}
                customColor={
                  customColor.trim() && /^#[0-9A-Fa-f]{6}$/.test(customColor.trim())
                    ? customColor.trim()
                    : undefined
                }
                logoUrl={logoUrl || undefined}
              />

              <div className="w-24 h-1 rounded-full bg-[#282830] mx-auto" />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL AL TERMINAR EL PROCESO: QR ESCANEABLE Y LINK DE LA TARJETA    */}
      {/* =================================================================== */}
      {completedCardResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#282830] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#2FB36A]/15 text-[#2FB36A] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#F4F4F6]">
                    ¡Tarjeta lista para compartir!
                  </h3>
                  <p className="text-[11px] text-[#9E9EA8]">
                    {completedCardResult.cardTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompletedCardResult(null)}
                className="p-1 text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Código QR escaneable */}
            <div className="rounded-2xl bg-white p-5 flex flex-col items-center justify-center text-center space-y-2">
              <RealQrCode value={completedCardResult.hubLink} size={176} />
              <p className="text-xs font-bold text-[#0C0C0E] pt-1">
                Escaneá este QR para obtener la tarjeta
              </p>
              <button
                type="button"
                onClick={() =>
                  handleDownloadQrPng(
                    completedCardResult.hubLink,
                    completedCardResult.cardTitle
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0C0C0E] text-white text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#BEC8FF]" />
                <span>Descargar QR en PNG</span>
              </button>
            </div>

            {/* Link directo de registro y tarjeta */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#F4F4F6]">
                Link directo de tu tarjeta
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={completedCardResult.hubLink}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] font-mono text-xs text-[#F4F4F6]"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(completedCardResult.hubLink);
                    showToast('Link copiado al portapapeles', 'success');
                  }}
                  className="px-3 py-2 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-xs font-bold text-[#BEC8FF] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </button>
              </div>
            </div>

            {completedCardResult.walletShareUrl &&
              completedCardResult.walletShareUrl !== completedCardResult.hubLink && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-[#F4F4F6]">
                    Link directo de billetera
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={completedCardResult.walletShareUrl}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] font-mono text-xs text-[#2FB36A]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(completedCardResult.walletShareUrl!);
                        showToast('Link copiado', 'success');
                      }}
                      className="px-3 py-2 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-xs font-bold text-[#2FB36A] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </button>
                  </div>
                </div>
              )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#282830]">
              <a
                href={completedCardResult.hubLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-xs font-bold text-[#F4F4F6] inline-flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#D95B26]" />
                <span>Abrir link</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="button"
                onClick={() => setCompletedCardResult(null)}
                className="px-4 py-2 rounded-xl bg-[#D95B26] text-white text-xs font-bold cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear tarjeta (solo cuando el comercio tiene 0 tarjetas) */}
      {showNewCardModal && cards.length === 0 && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#D95B26]" />
                <h3 className="text-sm font-bold text-[#F4F4F6]">Crear tarjeta de sellos</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCardModal(false)}
                className="p-1 text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCard} className="space-y-4">
              <div className="p-3 rounded-xl bg-[#0C0C0E] border border-[#282830] flex items-center justify-between">
                <span className="text-xs text-[#9E9EA8]">Objetivo de la tarjeta</span>
                <span className="text-xs font-bold text-[#F4F4F6]">10 sellos (fijo)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1.5">
                  Premio al completar los 10 sellos *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCardReward}
                  onChange={(e) => setNewCardReward(e.target.value)}
                  placeholder="Ej. Un café o producto sin cargo en tu próxima visita"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6] focus:outline-none focus:border-[#D95B26]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCardModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-[#1C1C22] text-xs font-bold text-[#9E9EA8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingCard}
                  className="px-4 py-2 rounded-xl bg-[#D95B26] text-white text-xs font-bold cursor-pointer"
                >
                  {creatingCard ? 'Creando...' : 'Crear tarjeta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Anular Sello o Ajustar Saldo con Motivo Obligatorio */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F4F4F6]">
                Anular o ajustar sellos de {adjustTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="p-1 text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                  Tipo de acción
                </label>
                <select
                  value={adjustMode}
                  onChange={(e) => {
                    const next = e.target.value as 'void' | 'adjust';
                    setAdjustMode(next);
                    if (next === 'void') setAdjustDelta(-1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                >
                  <option value="void">Anular último sello (-1)</option>
                  <option value="adjust">Ajustar saldo manual</option>
                </select>
              </div>

              {adjustMode === 'adjust' && (
                <div>
                  <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                    Variación de sellos (ej. -1 para descontar o +2 para sumar)
                  </label>
                  <input
                    type="number"
                    required
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                  Motivo obligatorio (mínimo 10 caracteres)
                </label>
                <input
                  type="text"
                  required
                  minLength={10}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ej: Sello cargado por error en ticket anulado"
                  className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                />
                <p className="text-[11px] text-[#9E9EA8] mt-1">
                  Queda registrado en la lista de correcciones.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-3.5 py-2 rounded-xl bg-[#1C1C22] text-xs font-bold text-[#9E9EA8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="px-3.5 py-2 rounded-xl bg-[#D95B26] text-white text-xs font-bold cursor-pointer"
                >
                  {submittingAdjust ? 'Guardando...' : 'Confirmar y registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Borrar Socio con Motivo Obligatorio (solo Dueño) */}
      {deleteTarget && isOwner && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#f87171]">
                Borrar socio: {deleteTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1 text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDeleteMemberSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                  Motivo para borrar al socio (mínimo 10 caracteres)
                </label>
                <input
                  type="text"
                  required
                  minLength={10}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ej: Solicitud de baja de cuenta pedida por el cliente"
                  className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                />
                <p className="text-[11px] text-[#9E9EA8] mt-1">
                  Esta acción queda registrada en la lista de correcciones.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-3.5 py-2 rounded-xl bg-[#1C1C22] text-xs font-bold text-[#9E9EA8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingDelete}
                  className="px-3.5 py-2 rounded-xl bg-[#ef4444] text-white text-xs font-bold cursor-pointer"
                >
                  {submittingDelete ? 'Borrando...' : 'Confirmar borrado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
