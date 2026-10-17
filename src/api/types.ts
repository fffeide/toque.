/**
 * Toque — Módulo Recibo: Definición de Tipos
 * Estructuras de datos para Carteles, Ventas, Comprobantes, Club de Fidelidad y Hub Público.
 */

export type CartelRole = 'resena' | 'caja';
export type CartelStatus = 'sin_activar' | 'active' | 'inactive' | 'trash';

export type HubMode = 'direct' | 'hub';

export type HubBlockKey = 'receipt' | 'review' | 'club' | 'socials' | 'products' | 'details';

export interface HubBlockConfig {
  key: HubBlockKey;
  enabled: boolean;
}

export interface HubProduct {
  id: string;
  title: string;
  price?: number;
  url?: string;
  description?: string;
}

export interface HubSocials {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  whatsapp?: string;
}

export interface HubDetails {
  address?: string;
  hours?: string;
  phone?: string;
}

export interface HubConfig {
  mode: HubMode;
  blocks: HubBlockConfig[]; // El orden del array determina el orden visual
  accentColor: string; // Por defecto Ultramar (#3A3FE0)
  logoUrl?: string;
  socials: HubSocials;
  products: HubProduct[];
  details: HubDetails;
  showToqueFooter: boolean;
}

export interface Cartel {
  id: string;
  code: string; // Código corto (ej: "TQ-4829")
  pin: string; // PIN de activación de 6 caracteres
  businessId?: string;
  name: string; // "Caja 1", "Mesa 3"
  role: CartelRole;
  status: CartelStatus;
  reviewUrl?: string;
  mode: HubMode;
  createdAt: string;
  activatedAt?: string;
  lastScannedAt?: string;
  batchId?: string;
}

export interface SaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export type PaymentMethod = 'mp_qr' | 'cash' | 'card_manual';
export type SaleStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export interface Sale {
  id: string;
  cartelId: string;
  cartelName?: string;
  amount: number;
  currency: 'ARS';
  items: SaleItem[];
  method: PaymentMethod;
  status: SaleStatus;
  createdAt: string;
  paidAt?: string;
  cashierName?: string;
}

export type ReceiptStatus = 'ready' | 'claimed' | 'expired' | 'cancelled';

export interface Receipt {
  id: string;
  saleId: string;
  cartelCode: string;
  status: ReceiptStatus;
  expiresAt: string; // 3 minutos desde el cobro
  businessName: string;
  items: SaleItem[];
  total: number;
  currency: 'ARS';
  method: PaymentMethod;
  createdAt: string;
  claimedAt?: string;
  isExample?: boolean;
}

export type ClubRuleType = 'per_amount' | 'per_visit';

export interface ClubReward {
  id: string;
  label: string;
  target: number; // Puntos o visitas requeridas
}

export interface ClubConfig {
  name: string;
  rule: {
    type: ClubRuleType;
    value: number; // Ej: 1 punto cada $1000, o 1 sello por visita
  };
  rewards: ClubReward[];
  active: boolean;
}

export interface ClubMember {
  id: string;
  name?: string;
  contact: string; // Teléfono celular o correo
  points: number;
  joinedAt: string;
  consent: true; // Consentimiento explícito obligatorio
}

export interface BusinessProfile {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  reviewUrl?: string;
  createdAt: string;
  isAssociatedWithManufacturer?: boolean;
  manufacturerName?: string;
}

export interface PublicHub {
  business: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  cartel: {
    code: string;
    name: string;
    role: CartelRole;
    status: CartelStatus;
  };
  reviewUrl: string;
  blocks: HubBlockConfig[];
  receipt?: Receipt | null;
  club?: {
    config: ClubConfig;
    member?: ClubMember | null;
  } | null;
  config: HubConfig;
}

export interface User {
  id: string;
  email: string;
  name: string;
  businessId: string;
  role: 'owner' | 'cashier' | 'admin';
}

export interface MercadoPagoStatus {
  connected: boolean;
  collectorId?: string;
  publicKey?: string;
  connectedAt?: string;
}

export interface DashboardSummary {
  todaySalesAmount: number;
  todaySalesCount: number;
  weeklySalesAmount: number;
  weeklySalesCount: number;
  claimedReceiptsCount: number;
  newClubMembersCount: number;
  reviewButtonClicks: number;
  isExample: boolean;
}

export interface CartelBatch {
  id: string;
  count: number;
  createdAt: string;
  carteles: Array<{
    code: string;
    pin: string;
    status: CartelStatus;
    shortUrl: string;
  }>;
}
