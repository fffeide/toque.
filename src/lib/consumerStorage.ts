/**
 * Toque — Persistencia Híbrida del Comprador ("Toquecitos")
 * Gestiona `toque_consumer_id` (UUID v4), visitas, sellos, comprobantes y garantías
 * en localStorage con sincronización hacia Cloudflare D1 (/api/consumer/sync) y Firestore.
 */

import { generateUUID } from './uuid';
import {
  ConsumerUser,
  ConsumerReceipt,
  ConsumerAgeGroup,
  Receipt,
} from '../api/types';
import { api } from '../api';

export const CONSUMER_ID_STORAGE_KEY = 'toque_consumer_id';
export const CONSUMER_PROFILE_STORAGE_KEY = 'toque_consumer_profile_v1';
export const CONSUMER_RECEIPTS_STORAGE_KEY = 'toque_consumer_receipts_v1';
export const CONSUMER_STAMPS_STORAGE_KEY = 'toque_consumer_stamps_v1';

export interface MerchantStampRecord {
  tenantId: string;
  merchantName: string;
  cartelCode: string;
  stamps: number;
  targetStamps: number;
  rewardText: string;
  lastVisitAt: string;
}

export interface LocalStampProgress {
  tenantId: string;
  merchantName: string;
  stamps: number;
  targetStamps: number;
  rewardText: string;
  lastTouchAt: string;
}

export interface ConsumerVaultState {
  consumerId: string;
  user: ConsumerUser | null;
  receipts: ConsumerReceipt[];
  stampsByMerchant: Record<string, LocalStampProgress>;
  totalTouches: number;
  weeklyTouches: number;
}

export interface ConsumerVaultKPIs {
  monthlySpentArs: number;
  totalSavedArs: number;
  totalTouches: number;
  unlockableRewardsCount: number;
}

export interface SmartTip {
  id: string;
  title: string;
  description: string;
  potentialSavingArs: number;
  category: string;
}

/**
 * 1. Genera o lee automáticamente `toque_consumer_id` (UUID v4 único) en localStorage.
 */
export function getOrCreateConsumerId(): string {
  try {
    if (typeof window === 'undefined') return generateUUID();
    const existing = window.localStorage.getItem(CONSUMER_ID_STORAGE_KEY);
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }
    const newId = generateUUID();
    window.localStorage.setItem(CONSUMER_ID_STORAGE_KEY, newId);
    return newId;
  } catch {
    return generateUUID();
  }
}

export function getConsumerProfile(): ConsumerUser | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(CONSUMER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsumerUser;
  } catch {
    return null;
  }
}

export function saveConsumerProfileLocal(profile: ConsumerUser): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CONSUMER_ID_STORAGE_KEY, profile.id);
    window.localStorage.setItem(CONSUMER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
}

export function getConsumerReceipts(): ConsumerReceipt[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(CONSUMER_RECEIPTS_STORAGE_KEY);
    if (!raw) {
      const consumerId = getOrCreateConsumerId();
      const now = Date.now();
      const seeded: ConsumerReceipt[] = [
        {
          id: 'rcp-local-seed-1',
          uuid: generateUUID(),
          consumerId,
          tenantId: 'biz-toque-1',
          merchantName: 'Café & Panadería La Esquina',
          cartelCode: 'CAJA01',
          amountArs: 8400,
          discountSavedArs: 1260,
          category: 'Cafetería',
          receiptNote: '2x Café de Especialidad + Medialunas · Sello #1 sumado',
          createdAt: new Date(now - 2 * 86400000).toISOString(),
        },
        {
          id: 'rcp-local-seed-2',
          uuid: generateUUID(),
          consumerId,
          tenantId: 'biz-neighbor-1',
          merchantName: 'Smash Burger Club',
          cartelCode: 'BURGER01',
          amountArs: 14500,
          discountSavedArs: 2900,
          category: 'Gastronomía',
          receiptNote: 'Combo Doble Smash + 20% OFF Red Toque · Garantía de compra',
          createdAt: new Date(now - 5 * 86400000).toISOString(),
        },
      ];
      window.localStorage.setItem(CONSUMER_RECEIPTS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as ConsumerReceipt[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : [];
  } catch {
    return [];
  }
}

export function saveConsumerReceiptsLocal(receipts: ConsumerReceipt[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CONSUMER_RECEIPTS_STORAGE_KEY, JSON.stringify(receipts));
  } catch {
    // ignore
  }
}

export function getMerchantStamps(): MerchantStampRecord[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(CONSUMER_STAMPS_STORAGE_KEY);
    if (!raw) {
      const initial: MerchantStampRecord[] = [
        {
          tenantId: 'biz-toque-1',
          merchantName: 'Café & Panadería La Esquina',
          cartelCode: 'CAJA01',
          stamps: 2,
          targetStamps: 5,
          rewardText: 'Café a elección de regalo',
          lastVisitAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ];
      window.localStorage.setItem(CONSUMER_STAMPS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as MerchantStampRecord[];
  } catch {
    return [];
  }
}

export function saveMerchantStampsLocal(stamps: MerchantStampRecord[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CONSUMER_STAMPS_STORAGE_KEY, JSON.stringify(stamps));
  } catch {
    // ignore
  }
}

/**
 * Carga el estado completo de la billetera "Toquecitos" desde localStorage
 */
export function loadConsumerVault(): ConsumerVaultState {
  const consumerId = getOrCreateConsumerId();
  const user = getConsumerProfile();
  const receipts = getConsumerReceipts();
  const stampsList = getMerchantStamps();

  const stampsByMerchant: Record<string, LocalStampProgress> = {};
  stampsList.forEach((s) => {
    stampsByMerchant[s.tenantId] = {
      tenantId: s.tenantId,
      merchantName: s.merchantName,
      stamps: s.stamps,
      targetStamps: s.targetStamps,
      rewardText: s.rewardText,
      lastTouchAt: s.lastVisitAt,
    };
  });

  const stampTouches = stampsList.reduce((acc, s) => acc + (s.stamps || 0), 0);
  const totalTouches = Math.max(receipts.length, stampTouches);
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const recentReceipts = receipts.filter(
    (r) => new Date(r.createdAt).getTime() >= sevenDaysAgo
  ).length;
  const weeklyTouches = Math.max(1, recentReceipts);

  return {
    consumerId,
    user,
    receipts,
    stampsByMerchant,
    totalTouches,
    weeklyTouches,
  };
}

/**
 * 2. Registra automáticamente el escaneo en `/hub/:code`:
 *    - Genera/lee `toque_consumer_id`
 *    - Suma sello/visita del comercio
 *    - Si hay un comprobante activo en vivo o visita, lo guarda en localStorage al instante sin obligar a loguearse
 */
export function recordLocalHubTouch(params: {
  cartelCode: string;
  tenantId: string;
  merchantName: string;
  rewardText?: string;
  targetStamps?: number;
  liveReceipt?: Receipt | null;
}): {
  consumerId: string;
  stampRecord: MerchantStampRecord;
  savedReceipt: ConsumerReceipt;
} {
  const consumerId = getOrCreateConsumerId();
  const nowIso = new Date().toISOString();
  const cleanCode = (params.cartelCode || 'CAJA01').toUpperCase();

  const allStamps = getMerchantStamps();
  const existingIdx = allStamps.findIndex(
    (s) => s.tenantId === params.tenantId || s.cartelCode === cleanCode
  );

  const sessionTouchKey = `toque_last_touch_${cleanCode}`;
  let isNewVisitInSession = true;
  try {
    const lastTs = Number(window.sessionStorage.getItem(sessionTouchKey) || '0');
    if (Date.now() - lastTs < 120000) {
      isNewVisitInSession = false;
    } else {
      window.sessionStorage.setItem(sessionTouchKey, String(Date.now()));
    }
  } catch {
    // ignore
  }

  let stampRecord: MerchantStampRecord;
  if (existingIdx >= 0) {
    const current = allStamps[existingIdx];
    stampRecord = {
      ...current,
      merchantName: params.merchantName || current.merchantName,
      rewardText: params.rewardText || current.rewardText,
      targetStamps: params.targetStamps || current.targetStamps || 5,
      stamps: isNewVisitInSession ? current.stamps + 1 : current.stamps,
      lastVisitAt: nowIso,
    };
    allStamps[existingIdx] = stampRecord;
  } else {
    stampRecord = {
      tenantId: params.tenantId || 'biz-toque-1',
      merchantName: params.merchantName || 'Comercio Toque',
      cartelCode: cleanCode,
      stamps: 1,
      targetStamps: params.targetStamps || 5,
      rewardText: params.rewardText || 'Beneficio del Club Toque',
      lastVisitAt: nowIso,
    };
    allStamps.unshift(stampRecord);
  }
  saveMerchantStampsLocal(allStamps);

  const receipts = getConsumerReceipts();
  const liveReceipt = params.liveReceipt;

  if (liveReceipt) {
    const existingReceipt = receipts.find((r) => r.id === liveReceipt.id);
    if (existingReceipt) {
      return { consumerId, stampRecord, savedReceipt: existingReceipt };
    }
    const itemsSummary =
      liveReceipt.items?.map((i) => `${i.quantity}x ${i.name}`).join(', ') ||
      'Comprobante digital validado';
    const estimatedSaving = Math.round(liveReceipt.total * 0.15);
    const newReceipt: ConsumerReceipt = {
      id: liveReceipt.id,
      uuid: liveReceipt.uuid || generateUUID(),
      consumerId,
      tenantId: liveReceipt.businessId || params.tenantId,
      merchantName: liveReceipt.businessName || params.merchantName,
      cartelCode: cleanCode,
      amountArs: liveReceipt.total,
      discountSavedArs: estimatedSaving,
      category: 'Consumo Verificado',
      receiptNote: `${itemsSummary} · Ticket #${liveReceipt.id}`,
      createdAt: liveReceipt.createdAt || nowIso,
    };
    const updated = [newReceipt, ...receipts];
    saveConsumerReceiptsLocal(updated);
    return { consumerId, stampRecord, savedReceipt: newReceipt };
  }

  const todayStr = new Date().toDateString();
  const todayVisit = receipts.find(
    (r) =>
      (r.tenantId === params.tenantId || r.cartelCode === cleanCode) &&
      new Date(r.createdAt).toDateString() === todayStr
  );

  if (todayVisit) {
    return { consumerId, stampRecord, savedReceipt: todayVisit };
  }

  const visitReceipt: ConsumerReceipt = {
    id: `visit-${cleanCode.toLowerCase()}-${Date.now().toString(36)}`,
    uuid: generateUUID(),
    consumerId,
    tenantId: params.tenantId || 'biz-toque-1',
    merchantName: params.merchantName || 'Comercio Toque',
    cartelCode: cleanCode,
    amountArs: 0,
    discountSavedArs: 850,
    category: 'Toque / Visita Presencial',
    receiptNote: `Visita registrada en cartel ${cleanCode} · Podés anotar el monto pagado`,
    createdAt: nowIso,
  };

  const updated = [visitReceipt, ...receipts];
  saveConsumerReceiptsLocal(updated);
  return { consumerId, stampRecord, savedReceipt: visitReceipt };
}

/**
 * Wrapper para PublicHubView: registra la visita localmente y devuelve el estado completo de la billetera
 */
export function recordHubVisitLocally(params: {
  tenantId: string;
  merchantName: string;
  cartelCode: string;
  rewardText?: string;
  targetStamps?: number;
  amountArs?: number;
  discountSavedArs?: number;
  category?: string;
  receiptNote?: string;
}): {
  vault: ConsumerVaultState;
  savedReceipt: ConsumerReceipt;
  stampProgress: LocalStampProgress;
} {
  const res = recordLocalHubTouch({
    cartelCode: params.cartelCode,
    tenantId: params.tenantId,
    merchantName: params.merchantName,
    rewardText: params.rewardText,
    targetStamps: params.targetStamps,
  });

  if (params.amountArs && params.amountArs > 0 && res.savedReceipt.amountArs === 0) {
    updateConsumerReceiptLocal(res.savedReceipt.id, {
      amountArs: params.amountArs,
      discountSavedArs: params.discountSavedArs || Math.round(params.amountArs * 0.12),
      category: params.category || res.savedReceipt.category,
      receiptNote: params.receiptNote || res.savedReceipt.receiptNote,
    });
  }

  const vault = loadConsumerVault();
  const stampProgress: LocalStampProgress = vault.stampsByMerchant[params.tenantId] || {
    tenantId: res.stampRecord.tenantId,
    merchantName: res.stampRecord.merchantName,
    stamps: res.stampRecord.stamps,
    targetStamps: res.stampRecord.targetStamps,
    rewardText: res.stampRecord.rewardText,
    lastTouchAt: res.stampRecord.lastVisitAt,
  };

  return {
    vault,
    savedReceipt: res.savedReceipt,
    stampProgress,
  };
}

/**
 * Guarda los datos de registro del comprador en localStorage y devuelve el ConsumerVaultState actualizado
 */
export function saveConsumerRegistration(params: {
  displayName: string;
  emailOrPhone: string;
  ageGroup?: ConsumerAgeGroup;
  consentSaveReceipts: boolean;
  consentMarketingNetwork: boolean;
}): ConsumerVaultState {
  const consumerId = getOrCreateConsumerId();
  const existing = getConsumerProfile();
  const nowIso = new Date().toISOString();

  const profile: ConsumerUser = {
    id: consumerId,
    uuid: existing?.uuid || consumerId,
    displayName: params.displayName.trim() || 'Cliente Toque',
    emailOrPhone: params.emailOrPhone.trim().toLowerCase(),
    ageGroup: params.ageGroup || existing?.ageGroup || 'all',
    consentSaveReceipts: params.consentSaveReceipts,
    consentMarketingNetwork: params.consentMarketingNetwork,
    createdAt: existing?.createdAt || nowIso,
    syncedAt: nowIso,
  };

  saveConsumerProfileLocal(profile);
  return loadConsumerVault();
}

/**
 * Permite al comprador cargar o editar el monto pagado, categoría o nota de garantía
 */
export function updateConsumerReceiptLocal(
  receiptId: string,
  patch: {
    amountArs?: number;
    discountSavedArs?: number;
    category?: string;
    receiptNote?: string;
  }
): ConsumerReceipt[] {
  const receipts = getConsumerReceipts();
  const next = receipts.map((r) => {
    if (r.id !== receiptId) return r;
    const nextAmount =
      patch.amountArs !== undefined ? Math.max(0, Number(patch.amountArs) || 0) : r.amountArs;
    const nextSaved =
      patch.discountSavedArs !== undefined
        ? Math.max(0, Number(patch.discountSavedArs) || 0)
        : nextAmount > 0 && r.discountSavedArs === 0
        ? Math.round(nextAmount * 0.12)
        : r.discountSavedArs;

    return {
      ...r,
      amountArs: nextAmount,
      discountSavedArs: nextSaved,
      category: patch.category !== undefined ? patch.category : r.category,
      receiptNote: patch.receiptNote !== undefined ? patch.receiptNote : r.receiptNote,
    };
  });
  saveConsumerReceiptsLocal(next);
  return next;
}

export function updateReceiptAmount(
  receiptId: string,
  amountArs: number,
  receiptNote?: string
): ConsumerVaultState {
  updateConsumerReceiptLocal(receiptId, {
    amountArs,
    receiptNote,
  });
  return loadConsumerVault();
}

/**
 * Agrega un nuevo comprobante manual o un beneficio reclamado de la Red Toque.
 */
export function addConsumerReceiptLocal(data: {
  tenantId: string;
  merchantName: string;
  amountArs: number;
  discountSavedArs: number;
  category: string;
  receiptNote: string;
  cartelCode?: string;
}): ConsumerReceipt {
  const consumerId = getOrCreateConsumerId();
  const receipts = getConsumerReceipts();
  const item: ConsumerReceipt = {
    id: `rcp-${Date.now().toString(36)}`,
    uuid: generateUUID(),
    consumerId,
    tenantId: data.tenantId || 'biz-toque-1',
    merchantName: data.merchantName.trim() || 'Comercio Red Toque',
    cartelCode: data.cartelCode || 'TOQUE',
    amountArs: Math.max(0, Number(data.amountArs) || 0),
    discountSavedArs: Math.max(0, Number(data.discountSavedArs) || 0),
    category: data.category || 'Gastronomía',
    receiptNote: data.receiptNote || 'Guardado en Toquecitos',
    createdAt: new Date().toISOString(),
  };
  saveConsumerReceiptsLocal([item, ...receipts]);
  return item;
}

export function addManualConsumerReceipt(data: {
  merchantName: string;
  amountArs: number;
  discountSavedArs?: number;
  category: string;
  receiptNote: string;
}): ConsumerVaultState {
  addConsumerReceiptLocal({
    tenantId: 'biz-toque-manual',
    merchantName: data.merchantName,
    amountArs: data.amountArs,
    discountSavedArs: data.discountSavedArs || 0,
    category: data.category,
    receiptNote: data.receiptNote,
  });
  return loadConsumerVault();
}

export function overwriteVaultFromRecovery(
  user: ConsumerUser,
  receipts: ConsumerReceipt[]
): ConsumerVaultState {
  saveConsumerProfileLocal(user);
  if (receipts && receipts.length > 0) {
    const local = getConsumerReceipts();
    const map = new Map<string, ConsumerReceipt>();
    [...receipts, ...local].forEach((r) => map.set(r.id, r));
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    saveConsumerReceiptsLocal(merged);
  }
  return loadConsumerVault();
}

/**
 * Calcula los 4 KPIs del Comprador para `/toquecitos` (acepta ConsumerVaultState o arrays directos)
 */
export function computeConsumerKPIs(
  vaultOrReceipts: ConsumerVaultState | ConsumerReceipt[],
  stampsOptional?: MerchantStampRecord[]
): ConsumerVaultKPIs {
  const receipts = Array.isArray(vaultOrReceipts)
    ? vaultOrReceipts
    : vaultOrReceipts.receipts;

  const stamps: MerchantStampRecord[] = Array.isArray(vaultOrReceipts)
    ? stampsOptional || getMerchantStamps()
    : Object.values(vaultOrReceipts.stampsByMerchant).map((s) => ({
        tenantId: s.tenantId,
        merchantName: s.merchantName,
        cartelCode: 'CAJA01',
        stamps: s.stamps,
        targetStamps: s.targetStamps,
        rewardText: s.rewardText,
        lastVisitAt: s.lastTouchAt,
      }));

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlySpentArs = receipts
    .filter((r) => {
      const d = new Date(r.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, r) => acc + (Number(r.amountArs) || 0), 0);

  const totalSavedArs = receipts.reduce(
    (acc, r) => acc + (Number(r.discountSavedArs) || 0),
    0
  );

  const stampTouches = stamps.reduce((acc, s) => acc + (s.stamps || 0), 0);
  const totalTouches = Math.max(receipts.length, stampTouches);

  const stampRewards = stamps.filter((s) => s.stamps >= s.targetStamps - 2).length;
  const challengeRewards = totalTouches >= 3 ? 2 : 1;
  const unlockableRewardsCount = Math.max(1, stampRewards + challengeRewards);

  return {
    monthlySpentArs,
    totalSavedArs,
    totalTouches,
    unlockableRewardsCount,
  };
}

/**
 * Genera Tips Inteligentes de ahorro basados en las visitas reales del comprador
 */
export function generateSmartSavingsTips(
  receipts: ConsumerReceipt[],
  stamps: MerchantStampRecord[],
  ageGroup: ConsumerAgeGroup = 'all'
): SmartTip[] {
  const kpis = computeConsumerKPIs(receipts, stamps);
  const tips: SmartTip[] = [];

  const mainStamp = stamps[0];
  if (mainStamp) {
    const remaining = Math.max(1, mainStamp.targetStamps - mainStamp.stamps);
    tips.push({
      id: 'tip-loyalty-unlock',
      title: `Te faltan ${remaining} toque(s) en ${mainStamp.merchantName}`,
      description: `Tu próximo premio ("${mainStamp.rewardText}") equivale a un ahorro directo en tu próxima visita.`,
      potentialSavingArs: 4200,
      category: 'Fidelidad Activa',
    });
  }

  if (ageGroup === 'teen') {
    tips.push({
      id: 'tip-teen-combo',
      title: 'Modo Joven (13+): Desafío de 3 Toques Semanales',
      description:
        'Escaneando en 3 locales adheridos con tus amigos destrabás 2x1 en meriendas, burgers y heladerías de tu barrio sin usar tarjeta de crédito.',
      potentialSavingArs: 5500,
      category: 'Beneficio Joven 13+',
    });
  } else {
    tips.push({
      id: 'tip-cross-network',
      title: 'Usá los Beneficios Cruzados al pie de cada ticket',
      description:
        'Cada vez que escaneás un cartel Toque desbloqueás entre 15% y 25% OFF en comercios vecinos a menos de 250 metros.',
      potentialSavingArs: Math.max(3500, Math.round(kpis.monthlySpentArs * 0.15)),
      category: 'Red Toque',
    });
  }

  const unpricedCount = receipts.filter((r) => r.amountArs === 0).length;
  if (unpricedCount > 0) {
    tips.push({
      id: 'tip-complete-amounts',
      title: `Tenés ${unpricedCount} visita(s) sin monto cargado`,
      description:
        'Anotá cuánto pagaste en cada visita para llevar el control exacto de tu presupuesto mensual y respaldar tus garantías.',
      potentialSavingArs: 2400,
      category: 'Control de Gastos',
    });
  }

  return tips;
}

export function computeSmartTips(
  vault: ConsumerVaultState,
  ageGroup: ConsumerAgeGroup = 'all'
): Array<{ id: string; title: string; detail: string; tag: string }> {
  const stamps: MerchantStampRecord[] = Object.values(vault.stampsByMerchant).map((s) => ({
    tenantId: s.tenantId,
    merchantName: s.merchantName,
    cartelCode: 'CAJA01',
    stamps: s.stamps,
    targetStamps: s.targetStamps,
    rewardText: s.rewardText,
    lastVisitAt: s.lastTouchAt,
  }));
  const tips = generateSmartSavingsTips(vault.receipts, stamps, ageGroup);
  return tips.map((t) => ({
    id: t.id,
    title: t.title,
    detail: t.description,
    tag: t.category,
  }));
}

/**
 * Sincroniza `localStorage` con D1 (`POST /api/consumer/sync`) y Firestore
 */
export async function syncConsumerVaultToCloud(params: {
  displayName: string;
  emailOrPhone: string;
  ageGroup?: ConsumerAgeGroup;
  consentSaveReceipts: boolean;
  consentMarketingNetwork: boolean;
}): Promise<{
  success: boolean;
  consumerId: string;
  recoveryCode: string;
  user: ConsumerUser;
}> {
  const consumerId = getOrCreateConsumerId();
  const existingProfile = getConsumerProfile();
  const receipts = getConsumerReceipts();
  const nowIso = new Date().toISOString();

  const user: ConsumerUser = {
    id: consumerId,
    uuid: existingProfile?.uuid || consumerId,
    displayName: params.displayName.trim() || 'Comprador Toque',
    emailOrPhone: params.emailOrPhone.trim().toLowerCase(),
    ageGroup: params.ageGroup || existingProfile?.ageGroup || 'all',
    consentSaveReceipts: params.consentSaveReceipts,
    consentMarketingNetwork: params.consentMarketingNetwork,
    createdAt: existingProfile?.createdAt || nowIso,
    syncedAt: nowIso,
  };

  const result = await api.syncConsumerVault({
    user,
    receipts,
  });

  saveConsumerProfileLocal(result.user);
  return {
    success: true,
    consumerId: result.consumerId,
    recoveryCode: result.recoveryCode,
    user: result.user,
  };
}

/**
 * Recupera la cuenta del comprador desde cualquier navegador mediante su email/WhatsApp o código
 */
export async function recoverConsumerVaultFromCloud(contactOrCode: string): Promise<{
  found: boolean;
  user?: ConsumerUser;
  receipts?: ConsumerReceipt[];
}> {
  const res = await api.recoverConsumerVault(contactOrCode);
  if (res.found && res.user) {
    saveConsumerProfileLocal(res.user);
    if (res.receipts && res.receipts.length > 0) {
      const local = getConsumerReceipts();
      const map = new Map<string, ConsumerReceipt>();
      [...res.receipts, ...local].forEach((r) => map.set(r.id, r));
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      saveConsumerReceiptsLocal(merged);
      return { found: true, user: res.user, receipts: merged };
    }
    return { found: true, user: res.user, receipts: getConsumerReceipts() };
  }
  return { found: false };
}
