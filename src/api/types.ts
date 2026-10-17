/**
 * Toque — Smart Receipt & Post-Purchase Hub: Definición de Tipos
 * Estructuras de datos para Carteles, Ventas, Comprobantes, Club de Fidelidad, Smart Hub, Wallet y Partners.
 */

export type CartelRole = 'resena' | 'caja';
export type CartelStatus = 'sin_activar' | 'active' | 'inactive' | 'trash';

export type HubMode = 'direct' | 'hub' | 'direct_review' | 'smart_hub';
export type TileColor = 'white' | 'black';
export type ClaimStatus = 'unclaimed' | 'claimed';

export type HubBlockKey = 'receipt' | 'review' | 'club' | 'socials' | 'products' | 'details';

// Los 7 bloques del modelo Smart Receipt & Post-Purchase Hub
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
  socials: HubSocials;
  products: HubProduct[];
  details: HubDetails;
  showToqueFooter: boolean;
}

export interface Cartel {
  id: string;
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
  expiresAt: string;
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
  target: number;
}

export interface ClubConfig {
  name: string;
  rule: {
    type: ClubRuleType;
    value: number;
  };
  rewards: ClubReward[];
  active: boolean;
}

export interface ClubMember {
  id: string;
  name?: string;
  contact: string;
  points: number;
  stamps?: number;
  passUrl?: string;
  joinedAt: string;
  consent: true;
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
    mode?: HubMode;
    tileColor?: TileColor;
    claimStatus?: ClaimStatus;
  };
  reviewUrl: string;
  blocks: HubBlockConfig[];
  receipt?: Receipt | null;
  club?: {
    config: ClubConfig;
    member?: ClubMember | null;
  } | null;
  config: HubConfig;
  smartHubConfig?: SmartHubConfig;
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
    tileColor?: TileColor;
    claimStatus?: ClaimStatus;
  }>;
}
