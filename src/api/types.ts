/**
 * Toque — Smart Receipt & Post-Purchase Hub: Definición de Tipos
 * Estructuras de datos 100% reales con soporte RLS, UUID v4 único, Equipo, WalletWallet,
 * Red de Beneficios estilo Pasito y Bóveda del Consumidor ("Mi Toque").
 */

export type CartelRole = 'resena' | 'caja';
export type CartelStatus = 'sin_activar' | 'active' | 'inactive' | 'trash';

export type HubMode = 'direct' | 'hub' | 'direct_review' | 'smart_hub';
export type TileColor = 'white' | 'black';
export type ClaimStatus = 'unclaimed' | 'claimed';

export type HubBlockKey = 'receipt' | 'review' | 'club' | 'socials' | 'products' | 'details';

export type SmartHubSectionKey =
  | 'loyalty'
  | 'reviews'
  | 'receipt'
  | 'offers'
  | 'socials'
  | 'signup'
  | 'footer';

export interface SmartHubSectionItem {
  key: SmartHubSectionKey;
  enabled: boolean;
}

export interface SmartHubConfig {
  tenantId: string;
  sectionsOrder: SmartHubSectionItem[];
  brandColor: string;
  logoUrl?: string;
  reviewPrompt: string;
  loyaltyTitle: string;
  loyaltyReward: string;
  stampsRequired: number;
  offerTitle: string;
  offerDesc: string;
  offerCta: string;
  offerUrl?: string;
  offerImage?: string;
  socials: {
    instagram?: string;
    tiktok?: string;
    facebook?: string;
    whatsapp?: string;
    web?: string;
  };
}

export interface WalletPassResponse {
  success: boolean;
  provider: string;
  passId?: string;
  validationCode: string;
  appleWalletUrl: string;
  googleWalletUrl: string;
  qrUrl?: string;
}

export interface PartnerReferral {
  id: string;
  uuid?: string;
  partnerCode: string;
  merchantName: string;
  merchantEmail: string;
  status: 'pending' | 'activated' | 'paid';
  commissionRate: number;
  createdAt: string;
}

export interface HubBlockConfig {
  key: HubBlockKey;
  enabled: boolean;
}

export interface HubProduct {
  id: string;
  title: string;
  price?: number;
  url?: string;
  imageUrl?: string;
  barcode?: string;
  universalCode?: string;
  featuredInHub?: boolean;
  description?: string;
}

export interface HubSocials {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  whatsapp?: string;
  web?: string;
}

export interface HubDetails {
  address?: string;
  hours?: string;
  phone?: string;
}

export interface HubConfig {
  mode: HubMode;
  blocks: HubBlockConfig[];
  accentColor: string;
  logoUrl?: string;
  googleReviewUrl?: string;
  socials: HubSocials;
  products: HubProduct[];
  details: HubDetails;
  showToqueFooter: boolean;
  planPaid?: boolean;
  networkEnabled?: boolean;
}

export interface Cartel {
  id: string;
  uuid?: string;
  code: string;
  pin: string;
  businessId?: string;
  name: string;
  role: CartelRole;
  status: CartelStatus;
  reviewUrl?: string;
  mode: HubMode;
  tileColor?: TileColor;
  claimStatus?: ClaimStatus;
  scansCount?: number;
  reviewClicksCount?: number;
  activeReceiptId?: string | null;
  activeReceiptExpiresAt?: string | null;
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

export type PaymentMethod = 'mp_qr' | 'mercadopago' | 'cash' | 'card_manual' | 'card' | 'transfer';
export type SaleStatus = 'pending' | 'paid' | 'cancelled' | 'expired';

export interface Sale {
  id: string;
  uuid?: string;
  businessId: string;
  cartelId: string;
  cartelCode?: string;
  cartelName?: string;
  receiptId?: string;
  amount: number;
  currency: 'ARS';
  items: SaleItem[];
  method: PaymentMethod;
  status: SaleStatus;
  note?: string;
  createdAt: string;
  paidAt?: string;
  cashierName?: string;
  cashierEmail?: string;
}

export type ReceiptStatus = 'ready' | 'claimed' | 'expired' | 'cancelled';

export interface Receipt {
  id: string;
  uuid?: string;
  saleId: string;
  businessId: string;
  cartelCode: string;
  status: ReceiptStatus;
  expiresAt: string;
  businessName: string;
  items: SaleItem[];
  total: number;
  currency: 'ARS';
  method: PaymentMethod;
  createdAt: string;
  claimedAt?: string;
}

export type ClubRuleType = 'per_amount' | 'per_visit';

export interface ClubReward {
  id: string;
  label: string;
  target: number;
}

export interface ClubConfig {
  name: string;
  clubName?: string;
  welcomeBenefitText?: string;
  pointsPerVisit?: number;
  enabled?: boolean;
  rule: {
    type: ClubRuleType;
    value: number;
  };
  rewards: ClubReward[];
  active: boolean;
}

export interface ClubMember {
  id: string;
  uuid?: string;
  businessId?: string;
  name?: string;
  contact: string;
  points: number;
  stamps?: number;
  passId?: string;
  passUrl?: string;
  walletPassUrl?: string;
  appleWalletUrl?: string;
  googleWalletUrl?: string;
  joinedAt: string;
  consent: true;
}

export interface BusinessProfile {
  id: string;
  uuid?: string;
  name: string;
  ownerName: string;
  email: string;
  ownerUid?: string;
  reviewUrl?: string;
  planPaid?: boolean;
  networkEnabled?: boolean;
  createdAt: string;
  scansCount?: number;
  reviewClicksCount?: number;
}

export type NetworkActivationFormat =
  | 'cross_benefit'
  | 'tap_challenge'
  | 'map_pin'
  | 'receipt_banner';

export interface NetworkActivation {
  id: string;
  uuid?: string;
  tenantId: string;
  businessId?: string;
  merchantName: string;
  merchantCategory?: string;
  distanceLabel?: string;
  formatType: NetworkActivationFormat;
  title: string;
  discountText: string;
  terms: string;
  active: boolean;
  createdAt?: string;
}

export type ConsumerAgeGroup = 'teen' | 'adult' | 'all';

export interface ConsumerUser {
  id: string;
  uuid?: string;
  emailOrPhone: string;
  displayName: string;
  ageGroup: ConsumerAgeGroup;
  consentSaveReceipts: boolean;
  consentMarketingNetwork: boolean;
  createdAt: string;
  syncedAt?: string;
}

export interface ConsumerReceipt {
  id: string;
  uuid?: string;
  consumerId: string;
  tenantId: string;
  merchantName: string;
  cartelCode?: string;
  amountArs: number;
  discountSavedArs: number;
  category: string;
  receiptNote: string;
  createdAt: string;
}

export interface PublicHub {
  business: {
    id: string;
    uuid?: string;
    name: string;
    logoUrl?: string;
  };
  cartel: {
    id: string;
    uuid?: string;
    code: string;
    name: string;
    role: CartelRole;
    status: CartelStatus;
    mode?: HubMode;
    tileColor?: TileColor;
    claimStatus?: ClaimStatus;
  };
  reviewUrl: string;
  blocks: HubBlockConfig[];
  receipt?: Receipt | null;
  activeReceipt?: Receipt | null;
  club?: {
    config: ClubConfig;
    member?: ClubMember | null;
  } | null;
  config: HubConfig;
  smartHubConfig?: SmartHubConfig;
  crossBenefits?: NetworkActivation[];
}

export type UserRole = 'owner' | 'manager' | 'cashier' | 'superadmin';

export interface User {
  id: string;
  uuid?: string;
  email: string;
  name: string;
  businessId: string;
  role: UserRole;
  assignedCartelId?: string;
  assignedCartelCode?: string;
  isSuperAdmin?: boolean;
}

export interface TeamMember {
  id: string;
  uuid?: string;
  businessId: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'cashier';
  assignedCartelId?: string;
  assignedCartelCode?: string;
  status: 'active' | 'revoked';
  addedAt: string;
  addedByEmail?: string;
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
  totalReceiptsCount: number;
  claimedReceiptsCount: number;
  newClubMembersCount: number;
  clubMembersCount: number;
  walletPassesCount: number;
  scansCount: number;
  reviewButtonClicks: number;
  teamMembersCount: number;
  activeCartelesCount: number;
  totalCartelesCount: number;
  recentSales: Sale[];
}

export interface SuperAdminSummary {
  totalBusinesses: number;
  totalCarteles: number;
  activeCarteles: number;
  totalSalesCount: number;
  totalSalesAmount: number;
  totalReceiptsEmitted: number;
  claimedReceiptsCount: number;
  totalClubMembers: number;
  walletPassesIssued: number;
  totalScansCount: number;
  totalReviewClicks: number;
  businesses: Array<
    BusinessProfile & {
      cartelesCount: number;
      salesCount: number;
      salesAmount: number;
      membersCount: number;
      teamCount: number;
    }
  >;
  carteles: Cartel[];
  recentSales: Sale[];
}

export interface CartelBatch {
  id: string;
  uuid?: string;
  name?: string;
  prefix?: string;
  count: number;
  createdAt: string;
  status?: 'pending' | 'printed' | 'delivered';
  carteles?: Array<{ code: string; pin?: string; status?: string; shortUrl?: string }>;
}
