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
  Gift,
  Plus,
  Minus,
  X,
  Mail,
  Send,
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
} from 'lucide-react';

type StudioSubTab = 'content' | 'barcode' | 'style';
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

  const [activeTab, setActiveTab] = useState<'socios' | 'diseno' | 'avisos'>('socios');
  const [config, setConfig] = useState<ClubConfig | null>(null);
  const [cards, setCards] = useState<ClubConfig[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLocalId, setSelectedLocalId] = useState('all');

  // Lector de Código de Barras / Escáner Pistola USB/Bluetooth (<1s con Enter)
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [scanningFast, setScanningFast] = useState(false);
  const [lastScannedMember, setLastScannedMember] = useState<ClubMember | null>(null);

  // =========================================================================
  // ESTUDIO DE TARJETA WALLETWALLET (3 Pestañas: Contenido, Código, Estilo)
  // =========================================================================
  const [studioTab, setStudioTab] = useState<StudioSubTab>('content');
  const [previewPlatform, setPreviewPlatform] = useState<WalletPreviewPlatform>('apple');
  const [savingConfig, setSavingConfig] = useState(false);

  // Pestaña 1: Contenido (Content)
  const [logoText, setLogoText] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [headerFields, setHeaderFields] = useState<Array<{ label: string; value: string }>>([]);
  const [primaryFields, setPrimaryFields] = useState<Array<{ label: string; value: string }>>([
    { label: 'SELLOS', value: '1 / 10' },
  ]);
  const [secondaryFields, setSecondaryFields] = useState<Array<{ label: string; value: string }>>([
    { label: 'PREMIO', value: '' },
    { label: 'SOCIO', value: '' },
  ]);
  const [targetStamps, setTargetStamps] = useState(10);
  const [rewardValueArs, setRewardValueArs] = useState<number>(0);
  const [howToEarn, setHowToEarn] = useState('1 sello por visita o compra');

  // Pestaña 2: Código (Barcode)
  const [barcodeFormat, setBarcodeFormat] = useState<'QR' | 'CODE128' | 'PDF417' | 'AZTEC'>('QR');
  const [barcodeValue, setBarcodeValue] = useState('');
  const [overrideBarcodeText, setOverrideBarcodeText] = useState(false);
  const [barcodeAltText, setBarcodeAltText] = useState('');
  const [expirationPolicy, setExpirationPolicy] = useState('No vencen');

  // Pestaña 3: Estilo (Style)
  const [colorPreset, setColorPreset] = useState<PresetColorKey>('dark');
  const [customColor, setCustomColor] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [wideLogoUrl, setWideLogoUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');

  // Modal de resultado al finalizar el proceso: Muestra el QR y el Link para compartir
  const [completedCardResult, setCompletedCardResult] = useState<{
    cardTitle: string;
    hubLink: string;
    walletShareUrl?: string;
    serialNumber?: string;
    barcodeValue: string;
  } | null>(null);

  // Modal de Nueva Tarjeta
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardReward, setNewCardReward] = useState('');
  const [newCardStamps, setNewCardStamps] = useState(10);
  const [newCardPreset, setNewCardPreset] = useState<PresetColorKey>('dark');
  const [creatingCard, setCreatingCard] = useState(false);

  // Envío de Avisos por Email
  const [broadcastHeadline, setBroadcastHeadline] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastCtaLabel, setBroadcastCtaLabel] = useState('Ver mi tarjeta y beneficio');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Modal de Anulación / Ajuste Manual (con motivo obligatorio >= 10 caracteres)
  const [adjustTarget, setAdjustTarget] = useState<ClubMember | null>(null);
  const [adjustMode, setAdjustMode] = useState<'void' | 'adjust'>('void');
  const [adjustDelta, setAdjustDelta] = useState(-1);
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Modal de Exportar CSV con motivo obligatorio (solo Dueño)
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportReason, setExportReason] = useState('');
  const [submittingExport, setSubmittingExport] = useState(false);

  // Modal de Borrar Socio con motivo obligatorio (solo Dueño)
  const [deleteTarget, setDeleteTarget] = useState<ClubMember | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const syncFormWithConfig = (cfg: ClubConfig) => {
    const bizName = business?.name || '';
    const defaultTitle = cfg.logoText || cfg.loyaltyTitle || (bizName ? `Tarjeta de sellos de ${bizName}` : '');
    const defaultReward = cfg.loyaltyReward || cfg.rewardText || '';
    const stampsReq = cfg.targetStamps || cfg.stampsRequired || 10;

    setLogoText(defaultTitle);
    setOrganizationName(cfg.organizationName || bizName);
    setTargetStamps(stampsReq);
    setRewardValueArs(cfg.rewardValueArs ?? 0);
    setHowToEarn(cfg.howToEarn || '1 sello por visita o compra');

    setHeaderFields(Array.isArray(cfg.headerFields) ? [...cfg.headerFields] : []);
    setPrimaryFields(
      Array.isArray(cfg.primaryFields) && cfg.primaryFields.length > 0
        ? [...cfg.primaryFields]
        : [{ label: 'SELLOS', value: `1 / ${stampsReq}` }]
    );
    setSecondaryFields(
      Array.isArray(cfg.secondaryFields) && cfg.secondaryFields.length > 0
        ? [...cfg.secondaryFields]
        : [
            { label: 'PREMIO', value: defaultReward },
            { label: 'SOCIO', value: bizName },
          ]
    );

    setBarcodeFormat(cfg.barcodeFormat || 'QR');
    setBarcodeValue(cfg.barcodeValue || cfg.id || '');
    setOverrideBarcodeText(Boolean(cfg.barcodeAltText));
    setBarcodeAltText(cfg.barcodeAltText || '');
    setExpirationPolicy(cfg.expirationPolicy || 'No vencen');

    setColorPreset((cfg.colorPreset as PresetColorKey) || 'dark');
    setCustomColor(cfg.customColor || cfg.cardThemeColor || cfg.brandColor || '');
    setLogoUrl(cfg.logoUrl || '');
    setWideLogoUrl(cfg.wideLogoUrl || '');
    setIconUrl(cfg.iconUrl || '');
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
      setCards(allCards.length > 0 ? allCards : [cfg]);
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
  const canCreateMoreCards = cards.length < planLimits.maxCards;
  const isFreePlan = planState?.status === 'free' || planState?.planId === 'free';

  const activeCartelCode = locals[0]?.code || 'BURGER01';
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

  // Seleccionar una de las tarjetas creadas
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

  // Guardar y sincronizar la tarjeta en el Estudio WalletWallet + mostrar QR y Link al terminar
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle =
      logoText.trim() || `Tarjeta de sellos de ${business?.name || 'Mi Comercio'}`;
    const rewardFromFields =
      secondaryFields.find((f) => f.label.toUpperCase().includes('PREMIO'))?.value?.trim() ||
      secondaryFields[0]?.value?.trim() ||
      'Beneficio al completar tus sellos';

    try {
      setSavingConfig(true);

      const cleanPrimary = primaryFields.filter((f) => f.label.trim() || f.value.trim());
      const cleanSecondary = secondaryFields.filter((f) => f.label.trim() || f.value.trim());
      const cleanHeader = headerFields.filter((f) => f.label.trim() || f.value.trim());
      const finalBarcodeValue = barcodeValue.trim() || config?.id || `card-${Date.now().toString(36)}`;

      const updated = await api.updateClubConfig({
        id: config?.id,
        name: cleanTitle,
        loyaltyTitle: cleanTitle,
        logoText: cleanTitle,
        organizationName: organizationName.trim() || business?.name || '',
        rewardText: rewardFromFields,
        loyaltyReward: rewardFromFields,
        rewardValueArs: Math.max(0, Number(rewardValueArs) || 0),
        targetStamps,
        stampsRequired: targetStamps,
        brandColor: effectiveCardBgColor,
        cardThemeColor: effectiveCardBgColor,
        colorPreset,
        customColor: customColor.trim() || undefined,
        barcodeFormat: 'QR',
        barcodeValue: finalBarcodeValue,
        barcodeAltText: '',
        logoUrl: logoUrl.trim() || undefined,
        wideLogoUrl: wideLogoUrl.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        headerFields: cleanHeader,
        primaryFields: cleanPrimary,
        secondaryFields: cleanSecondary,
        howToEarn: howToEarn.trim(),
        expirationPolicy,
      });

      const passRes = await api
        .createWalletPass({
          cartelCode: activeCartelCode,
          memberId: updated.id || finalBarcodeValue,
          memberCode: finalBarcodeValue,
          customerName: organizationName.trim() || business?.name || 'Socio',
          stamps: 1,
          logoText: cleanTitle,
          organizationName: organizationName.trim() || business?.name,
          barcodeFormat,
          barcodeValue: finalBarcodeValue,
          barcodeAltText: overrideBarcodeText ? barcodeAltText.trim() : undefined,
          colorPreset,
          color:
            customColor.trim() && /^#[0-9A-Fa-f]{6}$/.test(customColor.trim())
              ? customColor.trim()
              : undefined,
          logoURL: logoUrl.trim() || undefined,
          wideLogoURL: wideLogoUrl.trim() || undefined,
          iconURL: iconUrl.trim() || undefined,
          headerFields: cleanHeader,
          primaryFields: cleanPrimary,
          secondaryFields: cleanSecondary,
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

      // Mostrar modal con el QR y Link al terminar el proceso
      setCompletedCardResult({
        cardTitle: cleanTitle,
        hubLink: publicHubUrl,
        walletShareUrl: passRes?.shareUrl || passRes?.appleWalletUrl,
        serialNumber: passRes?.serialNumber || passRes?.passId,
        barcodeValue: finalBarcodeValue,
      });

      showToast('Tarjeta guardada y lista para compartir', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar la tarjeta', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Crear nueva tarjeta de sellos + sincronizar con WalletWallet + mostrar QR y Link
  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim() || !newCardReward.trim()) return;
    try {
      setCreatingCard(true);
      const presetColorHex = PRESET_HEX_MAP[newCardPreset] || '#141418';
      const generatedBarcode = `card-${Date.now().toString(36)}`;
      const primary = [{ label: 'SELLOS', value: `1 / ${newCardStamps}` }];
      const secondary = [
        { label: 'PREMIO', value: newCardReward.trim() },
        { label: 'SOCIO', value: business?.name || 'Socio' },
      ];

      const created = await api.createClubCard({
        loyaltyTitle: newCardTitle.trim(),
        logoText: newCardTitle.trim(),
        organizationName: business?.name || '',
        rewardText: newCardReward.trim(),
        stampsRequired: newCardStamps,
        brandColor: presetColorHex,
        colorPreset: newCardPreset,
        barcodeFormat: 'QR',
        barcodeValue: generatedBarcode,
        primaryFields: primary,
        secondaryFields: secondary,
      });

      const passRes = await api
        .createWalletPass({
          cartelCode: activeCartelCode,
          memberId: created.id || generatedBarcode,
          memberCode: generatedBarcode,
          customerName: business?.name || 'Socio',
          stamps: 1,
          logoText: newCardTitle.trim(),
          organizationName: business?.name || undefined,
          barcodeFormat: 'QR',
          barcodeValue: generatedBarcode,
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

      // Mostrar el QR y el Link al finalizar la creación
      setCompletedCardResult({
        cardTitle: created.loyaltyTitle || newCardTitle.trim(),
        hubLink: publicHubUrl,
        walletShareUrl: passRes?.shareUrl || passRes?.appleWalletUrl,
        serialNumber: passRes?.serialNumber || passRes?.passId,
        barcodeValue: generatedBarcode,
      });

      showToast('Tarjeta creada. Compartí el QR o el link con tus clientes.', 'success');
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

  const handleExportMembersCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      showToast('Solo el dueño puede exportar la lista de socios.', 'error');
      return;
    }
    if (exportReason.trim().length < 10) {
      showToast('Escribí el motivo para exportar (mínimo 10 caracteres).', 'error');
      return;
    }
    try {
      setSubmittingExport(true);
      const csv = await api.exportClubMembersCsv(exportReason.trim());
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'socios-tarjetas-toque.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportModal(false);
      setExportReason('');
      showToast('Listado exportado en CSV y registrado en correcciones.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al exportar socios', 'error');
    } finally {
      setSubmittingExport(false);
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

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      showToast('Solo el dueño puede enviar y configurar avisos.', 'error');
      return;
    }
    if (isFreePlan) {
      showToast('El envío masivo por email está disponible en el Plan Pago.', 'error');
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
          businessName: business?.name || 'Mi Comercio',
          localCode: activeCartelCode,
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
      showToast(`Aviso enviado a ${data.sentCount || consented.length} socio(s)`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'No se pudo enviar el aviso.', 'error');
    } finally {
      setSendingBroadcast(false);
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

  const consentedMembersCount = members.filter(
    (m) => m.marketingConsent && !m.anonymous && !m.isMinor
  ).length;

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
    if (isCashier) {
      return (
        formatMemberNameForRole(m.name).toLowerCase().includes(q) ||
        (m.shortCode || '').toLowerCase().includes(q) ||
        (m.memberCode || '').toLowerCase().includes(q)
      );
    }
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.shortCode || '').toLowerCase().includes(q) ||
      (m.memberCode || '').toLowerCase().includes(q) ||
      (m.maskedEmail || '').toLowerCase().includes(q)
    );
  });

  const previewBarcodeText = barcodeValue.trim() || config?.id || 'CARD-01';

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
              : 'Vista de dueño: gestión completa de socios, exportación con motivo, avisos y diseño de tarjeta.'}
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
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setActiveTab('avisos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === 'avisos'
                      ? 'bg-[#D95B26] text-white'
                      : 'text-[#9E9EA8] hover:text-white'
                  }`}
                >
                  Avisos
                </button>
              )}
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

          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setExportReason('');
                setShowExportModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#282830] text-xs font-semibold text-[#F4F4F6] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#BEC8FF]" />
              <span>Exportar CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Tarjetas Activas + Botón directo para ver QR / Link */}
      {!isCashier && (
        <div className="rounded-2xl bg-[#141418] border border-[#282830] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#9E9EA8] mr-1">Tarjetas del comercio:</span>
            {cards.map((c, idx) => {
              const isSelected = c.id === config?.id || (!c.id && idx === 0);
              return (
                <div
                  key={c.id || idx}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-[#D95B26]/15 border-[#D95B26] text-[#F4F4F6]'
                      : 'bg-[#0C0C0E] border-[#282830] text-[#9E9EA8] hover:text-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => c.id && handleSelectCard(c.id)}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.cardThemeColor || c.brandColor || '#D95B26' }}
                    />
                    <span>{c.loyaltyTitle || `Tarjeta #${idx + 1}`}</span>
                  </button>
                  {isOwner && cards.length > 1 && c.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(c.id!)}
                      className="text-[#9E9EA8] hover:text-[#f87171] ml-1 cursor-pointer"
                      title="Eliminar tarjeta"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
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
                  barcodeValue: previewBarcodeText,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2FB36A]/15 hover:bg-[#2FB36A]/25 border border-[#2FB36A]/40 text-xs font-bold text-[#2FB36A] cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Ver QR y Link</span>
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  if (!canCreateMoreCards) {
                    showToast(
                      `Tu plan (${planLimits.label}) permite hasta ${planLimits.maxCards} tarjeta(s).`,
                      'error'
                    );
                    return;
                  }
                  setShowNewCardModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-xs font-bold text-[#BEC8FF] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  Nueva tarjeta ({cards.length}/
                  {planLimits.maxCards > 99 ? '∞' : planLimits.maxCards})
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODULO 1: LECTOR DE PISTOLA RÁPIDO (<1s) + TABLA DE SOCIOS          */}
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
                <span>Ingresar código corto (ej. K7M2-9XQ4) o escanear con lector</span>
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
                  autoFocus
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value.toUpperCase())}
                  placeholder="Escribí el código corto (K7M2-9XQ4) o escaneá el QR..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0C0C0E] border border-[#282830] font-mono text-xs text-[#F4F4F6] placeholder-[#666672] focus:outline-none focus:border-[#D95B26]"
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs text-[#F4F4F6]">
                                {m.stamps} / {target}
                              </span>
                              {isReadyForReward && (
                                <span className="px-2 py-0.5 rounded-full bg-[#2FB36A]/20 text-[#2FB36A] text-[10px] font-bold">
                                  🎁 Premio listo: {config?.rewardText || 'Beneficio'}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickPlusStamp(m)}
                                className="px-2.5 py-1.5 rounded-xl bg-[#2FB36A] hover:bg-[#259858] text-[#05150c] font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                                title="Sumar sello"
                              >
                                <Plus className="w-3 h-3 stroke-[3]" />
                                <span>Sumar sello</span>
                              </button>

                              {isReadyForReward && (
                                <button
                                  type="button"
                                  onClick={() => handleRedeemReward(m)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Gift className="w-3 h-3" />
                                  <span>Entregar premio</span>
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
                                  className="px-2.5 py-1.5 rounded-xl bg-[#1C1C22] hover:bg-[#26262e] border border-[#282830] text-xs font-bold text-[#9E9EA8] hover:text-white cursor-pointer"
                                  title="Anular sello o ajustar con motivo"
                                >
                                  Anular
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
      {/* MODULO 2: ESTUDIO DE TARJETA WALLETWALLET (Content / Barcode / Style)*/}
      {/* =================================================================== */}
      {activeTab === 'diseno' && !isCashier && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Panel Izquierdo: Formulario de 3 pestañas (Content, Barcode, Style) */}
          <form
            onSubmit={handleSaveConfig}
            className="lg:col-span-7 rounded-2xl bg-[#141418] border border-[#282830] overflow-hidden"
          >
            {/* Cabecera de pestañas del diseñador */}
            <div className="border-b border-[#282830] px-5 pt-4 flex items-center justify-between gap-3 bg-[#1C1C22]/50">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => setStudioTab('content')}
                  className={`pb-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    studioTab === 'content'
                      ? 'border-[#D95B26] text-[#F4F4F6]'
                      : 'border-transparent text-[#9E9EA8] hover:text-white'
                  }`}
                >
                  Contenido
                </button>
                <button
                  type="button"
                  onClick={() => setStudioTab('barcode')}
                  className={`pb-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    studioTab === 'barcode'
                      ? 'border-[#D95B26] text-[#F4F4F6]'
                      : 'border-transparent text-[#9E9EA8] hover:text-white'
                  }`}
                >
                  Código QR / Barras
                </button>
                <button
                  type="button"
                  onClick={() => setStudioTab('style')}
                  className={`pb-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    studioTab === 'style'
                      ? 'border-[#D95B26] text-[#F4F4F6]'
                      : 'border-transparent text-[#9E9EA8] hover:text-white'
                  }`}
                >
                  Estilo
                </button>
              </div>

              <span className="mb-2 px-2.5 py-0.5 rounded-full bg-[#2FB36A]/15 text-[#2FB36A] text-[10px] font-bold">
                Vista en tiempo real
              </span>
            </div>

            <div className="p-5 space-y-5">
              {/* PESTAÑA 1: CONTENIDO */}
              {studioTab === 'content' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                      Título de la tarjeta
                    </label>
                    <input
                      type="text"
                      required
                      value={logoText}
                      onChange={(e) => setLogoText(e.target.value)}
                      placeholder="Título visible arriba en la tarjeta"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                    />
                    <p className="text-[11px] text-[#9E9EA8] mt-1">
                      Texto que aparece en la esquina superior izquierda del pase.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                      Nombre del comercio <span className="text-[#9E9EA8] font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Nombre comercial para avisos"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                    />
                    <p className="text-[11px] text-[#9E9EA8] mt-1">
                      Título que ven tus clientes cuando se actualizan sus sellos.
                    </p>
                  </div>

                  {/* Header Fields */}
                  <div className="space-y-2 pt-1 border-t border-[#282830]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#F4F4F6]">
                          Campo superior derecho (SOCIO)
                        </span>
                        <span className="text-[11px] text-[#9E9EA8] ml-1.5">(arriba a la derecha)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setHeaderFields((prev) => [...prev, { label: 'NIVEL', value: 'SOCIO' }])
                        }
                        className="p-1 rounded-lg bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-[#F4F4F6] cursor-pointer"
                        title="Agregar campo de cabecera"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {headerFields.length === 0 ? (
                      <p className="text-[11px] text-[#9E9EA8]">Sin campos de cabecera</p>
                    ) : (
                      headerFields.map((field, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) =>
                              setHeaderFields((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, label: e.target.value } : item
                                )
                              )
                            }
                            placeholder="Etiqueta"
                            className="w-1/3 px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                          />
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) =>
                              setHeaderFields((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, value: e.target.value } : item
                                )
                              )
                            }
                            placeholder="Valor"
                            className="flex-1 px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setHeaderFields((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-2 rounded-xl bg-[#1C1C22] border border-[#282830] text-[#9E9EA8] hover:text-[#f87171] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Primary Fields */}
                  <div className="space-y-2 pt-2 border-t border-[#282830]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#F4F4F6]">
                          Campos principales (Primary Fields)
                        </span>
                        <span className="text-[11px] text-[#9E9EA8] ml-1.5">(contenido central)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPrimaryFields((prev) => [
                            ...prev,
                            { label: 'SELLOS', value: `1 / ${targetStamps}` },
                          ])
                        }
                        className="p-1 rounded-lg bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-[#F4F4F6] cursor-pointer"
                        title="Agregar campo principal"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {primaryFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) =>
                            setPrimaryFields((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, label: e.target.value } : item
                              )
                            )
                          }
                          placeholder="SELLOS"
                          className="w-1/3 px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                        />
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) =>
                            setPrimaryFields((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, value: e.target.value } : item
                              )
                            )
                          }
                          placeholder={`1 / ${targetStamps}`}
                          className="flex-1 px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPrimaryFields((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-2 rounded-xl bg-[#1C1C22] border border-[#282830] text-[#9E9EA8] hover:text-[#f87171] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Secondary Fields */}
                  <div className="space-y-2 pt-2 border-t border-[#282830]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#F4F4F6]">
                          Campos secundarios (Secondary Fields)
                        </span>
                        <span className="text-[11px] text-[#9E9EA8] ml-1.5">(debajo del principal)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSecondaryFields((prev) => [
                            ...prev,
                            { label: 'CAMPO', value: '' },
                          ])
                        }
                        className="p-1 rounded-lg bg-[#1C1C22] hover:bg-[#26262E] border border-[#282830] text-[#F4F4F6] cursor-pointer"
                        title="Agregar campo secundario"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {secondaryFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) =>
                            setSecondaryFields((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, label: e.target.value } : item
                              )
                            )
                          }
                          placeholder="PREMIO / SOCIO"
                          className="w-1/3 px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                        />
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) =>
                            setSecondaryFields((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, value: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Valor visible en la tarjeta"
                          className="flex-1 px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSecondaryFields((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-2 rounded-xl bg-[#1C1C22] border border-[#282830] text-[#9E9EA8] hover:text-[#f87171] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Meta de sellos, valor del premio y regla */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#282830]">
                    <div>
                      <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                        Meta de sellos para el premio
                      </label>
                      <input
                        type="number"
                        min={3}
                        max={20}
                        value={targetStamps}
                        onChange={(e) => {
                          const next = Math.max(3, Math.min(20, Number(e.target.value) || 10));
                          setTargetStamps(next);
                          setPrimaryFields((prev) =>
                            prev.map((f, idx) =>
                              idx === 0 && f.label.toUpperCase() === 'SELLOS'
                                ? { ...f, value: `1 / ${next}` }
                                : f
                            )
                          );
                        }}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                        Valor estimado del premio ($ ARS)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={rewardValueArs || ''}
                        onChange={(e) => setRewardValueArs(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="Ej: 4500"
                        className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                        Cómo sumar sellos
                      </label>
                      <input
                        type="text"
                        value={howToEarn}
                        onChange={(e) => setHowToEarn(e.target.value)}
                        placeholder="1 sello por visita o compra"
                        className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PESTAÑA 2: CÓDIGO (BARCODE) */}
              {studioTab === 'barcode' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                      Formato de código (Barcode)
                    </label>
                    <select
                      value={barcodeFormat}
                      onChange={(e) =>
                        setBarcodeFormat(
                          e.target.value as 'QR' | 'CODE128' | 'PDF417' | 'AZTEC'
                        )
                      }
                      className="w-48 px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                    >
                      <option value="QR">QR</option>
                      <option value="CODE128">CODE128 (Barras)</option>
                      <option value="PDF417">PDF417</option>
                      <option value="AZTEC">AZTEC</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                      Valor del código (Barcode Value)
                    </label>
                    <textarea
                      rows={2}
                      value={barcodeValue}
                      onChange={(e) => setBarcodeValue(e.target.value)}
                      placeholder="Identificador único de la tarjeta o URL"
                      className="w-full p-3 rounded-xl bg-[#0C0C0E] border border-[#282830] font-mono text-xs text-[#F4F4F6]"
                    />
                    <p className="text-[11px] text-[#9E9EA8] mt-1">
                      Para cada socio nuevo, Toque genera automáticamente su código único escaneable en caja.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#282830] space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#F4F4F6] block">
                          Personalizar texto debajo del código
                        </span>
                        <span className="text-[11px] text-[#9E9EA8]">
                          Por defecto Google muestra el valor debajo del código y Apple no muestra texto.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={overrideBarcodeText}
                        onChange={(e) => setOverrideBarcodeText(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#D95B26] cursor-pointer"
                      />
                    </div>
                    {overrideBarcodeText && (
                      <input
                        type="text"
                        value={barcodeAltText}
                        onChange={(e) => setBarcodeAltText(e.target.value)}
                        placeholder="Texto visible debajo del QR"
                        className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                      />
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#282830]">
                    <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                      Vencimiento (Expiration)
                    </label>
                    <select
                      value={expirationPolicy}
                      onChange={(e) => setExpirationPolicy(e.target.value)}
                      className="w-56 px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                    >
                      <option value="No vencen">Sin vencimiento</option>
                      <option value="30 días">30 días</option>
                      <option value="90 días">90 días</option>
                      <option value="365 días">1 año (365 días)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* PESTAÑA 3: ESTILO (STYLE) */}
              {studioTab === 'style' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                      Color predefinido (Color Preset)
                    </label>
                    <select
                      value={colorPreset}
                      onChange={(e) => {
                        const next = e.target.value as PresetColorKey;
                        setColorPreset(next);
                        setCustomColor('');
                      }}
                      className="w-48 px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                    >
                      <option value="dark">Dark (Oscuro)</option>
                      <option value="blue">Blue (Azul)</option>
                      <option value="green">Green (Verde)</option>
                      <option value="red">Red (Rojo)</option>
                      <option value="purple">Purple (Violeta)</option>
                      <option value="orange">Orange (Naranja)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#F4F4F6] mb-1">
                      Color personalizado (Custom Color)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        placeholder="#FF5733"
                        className="flex-1 px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] font-mono text-xs text-[#F4F4F6]"
                      />
                      <input
                        type="color"
                        value={effectiveCardBgColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="w-10 h-9 rounded-full bg-transparent border border-[#282830] cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-[#9E9EA8] mt-1">
                      Si ingresás un código hexadecimal, reemplaza al color predefinido.
                    </p>
                  </div>

                  {/* Logo 160x160 */}
                  <div className="pt-2 border-t border-[#282830] space-y-2">
                    <label className="block text-xs font-bold text-[#F4F4F6]">
                      Logo <span className="text-[#9E9EA8] font-normal">160×160</span>
                    </label>
                    <label className="border border-dashed border-[#282830] hover:border-[#BEC8FF] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-[#0C0C0E]">
                      <ImageIcon className="w-4 h-4 text-[#9E9EA8]" />
                      <span className="text-xs text-[#9E9EA8]">
                        Subir imagen desde tu dispositivo
                      </span>
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
                      placeholder="o pegá la URL de la imagen (https://...)"
                      className="w-full px-3 py-1.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                    />
                  </div>

                  {/* Wide logo 1280x400 */}
                  <div className="pt-2 border-t border-[#282830] space-y-2">
                    <div>
                      <label className="block text-xs font-bold text-[#F4F4F6]">
                        Logo ancho (Wide logo) <span className="text-[#9E9EA8] font-normal">1280×400</span>
                      </label>
                      <p className="text-[11px] text-[#9E9EA8]">
                        Reemplaza el logo y el texto en Google Wallet sin recortarse.
                      </p>
                    </div>
                    <label className="border border-dashed border-[#282830] hover:border-[#BEC8FF] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-[#0C0C0E]">
                      <ImageIcon className="w-4 h-4 text-[#9E9EA8]" />
                      <span className="text-xs text-[#9E9EA8]">
                        Subir imagen ancha
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFileUpload(e, setWideLogoUrl)}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      value={wideLogoUrl}
                      onChange={(e) => setWideLogoUrl(e.target.value)}
                      placeholder="o pegá la URL de la imagen ancha (https://...)"
                      className="w-full px-3 py-1.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                    />
                  </div>

                  {/* Icon 120x120 */}
                  <div className="pt-2 border-t border-[#282830] space-y-2">
                    <div>
                      <label className="block text-xs font-bold text-[#F4F4F6]">
                        Ícono (Icon) <span className="text-[#9E9EA8] font-normal">120×120</span>
                      </label>
                      <p className="text-[11px] text-[#9E9EA8]">
                        Imagen de notificaciones en pantalla de bloqueo (Apple Wallet).
                      </p>
                    </div>
                    <label className="border border-dashed border-[#282830] hover:border-[#BEC8FF] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-[#0C0C0E]">
                      <ImageIcon className="w-4 h-4 text-[#9E9EA8]" />
                      <span className="text-xs text-[#9E9EA8]">
                        Subir ícono
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFileUpload(e, setIconUrl)}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      value={iconUrl}
                      onChange={(e) => setIconUrl(e.target.value)}
                      placeholder="o pegá la URL del ícono (https://...)"
                      className="w-full px-3 py-1.5 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                    />
                  </div>
                </div>
              )}

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

              {/* Tarjeta dentro del teléfono: Espejo idéntico de WalletWallet Pass */}
              <WalletPassCard
                businessName={
                  logoText || `Tarjeta de sellos de ${business?.name || 'Mi Comercio'}`
                }
                memberName={
                  headerFields[0]?.value ||
                  secondaryFields.find((f) => f.label.toUpperCase() === 'SOCIO')?.value ||
                  'Socio'
                }
                stamps={1}
                stampsRequired={targetStamps}
                rewardText={
                  secondaryFields.find((f) => f.label.toUpperCase().includes('PREMIO'))?.value ||
                  secondaryFields[0]?.value ||
                  'Beneficio al completar tus sellos'
                }
                barcodeToken={previewBarcodeText}
                colorPreset={colorPreset}
                customColor={
                  customColor.trim() && /^#[0-9A-Fa-f]{6}$/.test(customColor.trim())
                    ? customColor.trim()
                    : undefined
                }
                logoUrl={logoUrl || undefined}
                wideLogoUrl={previewPlatform === 'google' ? wideLogoUrl || undefined : undefined}
              />

              <div className="w-24 h-1 rounded-full bg-[#282830] mx-auto" />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODULO 3: AVISOS Y BENEFICIOS POR EMAIL (SOLO DUEÑO)                */}
      {/* =================================================================== */}
      {activeTab === 'avisos' && isOwner && (
        <div className="rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[#F4F4F6]">
                <Mail className="w-4 h-4 text-[#D95B26]" />
                <span>Enviar aviso o beneficio por correo a tus socios</span>
              </div>
              <p className="text-xs text-[#9E9EA8] mt-0.5">
                Se envía únicamente a los{' '}
                <strong className="text-[#F4F4F6]">{consentedMembersCount} socios</strong> que
                aceptaron recibir novedades.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/panel/club/avisos"
                className="text-xs font-semibold text-[#D95B26] hover:underline"
              >
                Configurar avisos automáticos →
              </Link>
              <Link
                to="/panel/club/auditoria"
                className="text-xs font-semibold text-[#BEC8FF] hover:underline flex items-center gap-1"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Ver correcciones →</span>
              </Link>
            </div>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3.5 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                Título del aviso (Asunto)
              </label>
              <input
                type="text"
                required
                value={broadcastHeadline}
                onChange={(e) => setBroadcastHeadline(e.target.value)}
                placeholder="Ej: ¡Este jueves 2x1 para socios del Club!"
                className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                Mensaje para tus socios
              </label>
              <textarea
                rows={4}
                required
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Escribí el beneficio o novedad..."
                className="w-full p-3 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                Texto del botón de acción
              </label>
              <input
                type="text"
                value={broadcastCtaLabel}
                onChange={(e) => setBroadcastCtaLabel(e.target.value)}
                placeholder="Ver mi tarjeta y beneficio"
                className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
              />
            </div>

            <button
              type="submit"
              disabled={sendingBroadcast || isFreePlan}
              className="px-5 py-2.5 rounded-xl bg-[#D95B26] hover:bg-[#e56732] text-white font-bold text-xs inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {sendingBroadcast
                  ? 'Enviando...'
                  : `Enviar aviso a ${consentedMembersCount} socio(s)`}
              </span>
            </button>
          </form>
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

      {/* Modal: Crear Nueva Tarjeta */}
      {showNewCardModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#D95B26]" />
                <h3 className="text-sm font-bold text-[#F4F4F6]">Crear nueva tarjeta de sellos</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCardModal(false)}
                className="p-1 text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCard} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                  Texto junto al logo (Nombre de la tarjeta)
                </label>
                <input
                  type="text"
                  required
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  placeholder="Título visible en la tarjeta"
                  className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                  Premio al completar la tarjeta
                </label>
                <input
                  type="text"
                  required
                  value={newCardReward}
                  onChange={(e) => setNewCardReward(e.target.value)}
                  placeholder="Beneficio al completar los sellos"
                  className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                    Sellos requeridos
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={newCardStamps}
                    onChange={(e) => setNewCardStamps(Number(e.target.value) || 10)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                    Color
                  </label>
                  <select
                    value={newCardPreset}
                    onChange={(e) => setNewCardPreset(e.target.value as PresetColorKey)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                  >
                    <option value="dark">Oscuro</option>
                    <option value="blue">Azul</option>
                    <option value="green">Verde</option>
                    <option value="red">Rojo</option>
                    <option value="purple">Violeta</option>
                    <option value="orange">Naranja</option>
                  </select>
                </div>
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
                  {creatingCard ? 'Creando...' : 'Crear y ver QR / Link'}
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

      {/* Modal de Exportar CSV con Motivo Obligatorio (solo Dueño) */}
      {showExportModal && isOwner && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F4F4F6]">
                Exportar socios en CSV
              </h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="p-1 text-[#9E9EA8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExportMembersCsvSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#F4F4F6] mb-1">
                  Motivo de la exportación (mínimo 10 caracteres)
                </label>
                <input
                  type="text"
                  required
                  minLength={10}
                  value={exportReason}
                  onChange={(e) => setExportReason(e.target.value)}
                  placeholder="Ej: Respaldo mensual de socios del club"
                  className="w-full px-3 py-2 rounded-xl bg-[#0C0C0E] border border-[#282830] text-xs text-[#F4F4F6]"
                />
                <p className="text-[11px] text-[#9E9EA8] mt-1">
                  Toda exportación pide un motivo y queda registrada en la lista de correcciones.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-[#1C1C22] text-xs font-bold text-[#9E9EA8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingExport}
                  className="px-3.5 py-2 rounded-xl bg-[#D95B26] text-white text-xs font-bold cursor-pointer"
                >
                  {submittingExport ? 'Exportando...' : 'Descargar CSV'}
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
