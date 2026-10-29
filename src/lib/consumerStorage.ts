import { ConsumerUser, ConsumerReceipt } from '../api/types';

const USER_STORAGE_KEY = 'toque_consumer_user_v1';
const RECEIPTS_STORAGE_KEY = 'toque_consumer_receipts_v1';
const STAMPS_STORAGE_KEY = 'toque_consumer_stamps_v1';

export interface LocalConsumerStampProgress {
  tenantId: string;
  merchantName: string;
  stamps: number;
  stampsRequired: number;
  rewardText: string;
  brandColor: string;
  updatedAt: string;
}

export function getOrCreateLocalConsumerUser(): ConsumerUser {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ConsumerUser;
      if (parsed && parsed.id) {
        return parsed;
      }
    }
  } catch {
    // ignore storage read errors
  }

  const newUser: ConsumerUser = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `cons-${crypto.randomUUID().slice(0, 8)}`
        : `cons-${Date.now().toString(36)}`,
    emailOrPhone: '',
    displayName: 'Tus tarjetas',
    ageGroup: 'all',
    consentSaveReceipts: true,
    consentMarketingNetwork: false,
    createdAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
  } catch {
    // ignore
  }
  return newUser;
}

export const getLocalConsumerUser = getOrCreateLocalConsumerUser;

export function saveLocalConsumerUser(user: ConsumerUser): ConsumerUser {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
  return user;
}

export function getLocalConsumerReceipts(): ConsumerReceipt[] {
  try {
    const raw = localStorage.getItem(RECEIPTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function addLocalConsumerReceipt(
  receiptInput: Omit<ConsumerReceipt, 'id' | 'consumerId' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  }
): ConsumerReceipt {
  const user = getOrCreateLocalConsumerUser();
  const list = getLocalConsumerReceipts();
  const newReceipt: ConsumerReceipt = {
    id: receiptInput.id || `rcp-cons-${Date.now().toString(36)}`,
    consumerId: user.id,
    tenantId: receiptInput.tenantId,
    merchantName: receiptInput.merchantName,
    cartelCode: receiptInput.cartelCode,
    amountArs: receiptInput.amountArs,
    discountSavedArs: receiptInput.discountSavedArs,
    category: receiptInput.category || 'Gastronomía',
    receiptNote: receiptInput.receiptNote,
    items: receiptInput.items,
    createdAt: receiptInput.createdAt || new Date().toISOString(),
  };

  const filtered = list.filter((r) => r.id !== newReceipt.id);
  const next = [newReceipt, ...filtered];
  try {
    localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return newReceipt;
}

export function replaceLocalConsumerReceipts(receipts: ConsumerReceipt[]): void {
  try {
    localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(receipts));
  } catch {
    // ignore
  }
}

export function getLocalConsumerStamps(): LocalConsumerStampProgress[] {
  try {
    const raw = localStorage.getItem(STAMPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function upsertLocalConsumerStamp(
  entry: Omit<LocalConsumerStampProgress, 'updatedAt'>
): LocalConsumerStampProgress[] {
  const current = getLocalConsumerStamps();
  const updated: LocalConsumerStampProgress = {
    ...entry,
    updatedAt: new Date().toISOString(),
  };
  const next = [
    updated,
    ...current.filter((item) => item.tenantId !== entry.tenantId),
  ];
  try {
    localStorage.setItem(STAMPS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export interface ConsumerVaultStampEntry {
  merchantName: string;
  stamps: number;
  target?: number;
  targetStamps?: number;
  rewardLabel?: string;
  rewardText?: string;
  brandColor?: string;
}

export interface ConsumerVaultState {
  user: ConsumerUser;
  receipts: ConsumerReceipt[];
  stampsByMerchant: Record<string, ConsumerVaultStampEntry>;
}

export function loadConsumerVault(): ConsumerVaultState {
  const user = getOrCreateLocalConsumerUser();
  const receipts = getLocalConsumerReceipts();
  const stampsList = getLocalConsumerStamps();
  const stampsByMerchant: Record<string, ConsumerVaultStampEntry> = {};

  for (const item of stampsList) {
    stampsByMerchant[item.tenantId] = {
      merchantName: item.merchantName,
      stamps: item.stamps,
      target: item.stampsRequired,
      targetStamps: item.stampsRequired,
      rewardLabel: item.rewardText,
      rewardText: item.rewardText,
      brandColor: item.brandColor,
    };
  }

  return {
    user,
    receipts,
    stampsByMerchant,
  };
}

export function computeConsumerKPIs(vault: ConsumerVaultState): {
  totalSpentArs: number;
  savedWithToqueArs: number;
  activeCardsCount: number;
  receiptsCount: number;
} {
  const totalSpentArs = vault.receipts.reduce((acc, r) => acc + (r.amountArs || 0), 0);
  const savedWithToqueArs = vault.receipts.reduce((acc, r) => acc + (r.discountSavedArs || 0), 0);
  return {
    totalSpentArs,
    savedWithToqueArs,
    activeCardsCount: Object.keys(vault.stampsByMerchant || {}).length,
    receiptsCount: vault.receipts.length,
  };
}

