/**
 * Toque — Definición de Tipos (ToqueApi)
 * Incluye Toque Club (tarjeta de sellos), Smart Hub, Locales, Correcciones, Avisos, Suscripción,
 * Verificación por código de 6 dígitos (OTP), Importación CSV y Super Admin.
 */

export type CartelRole = 'resena' | 'caja' | 'mostrador' | 'mesa';
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
  howToEarn?: string;
  expirationPolicy?: string;
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
  configured?: boolean;
  provider?: string;
  passId?: string;
  serialNumber?: string;
  shareUrl?: string;
  unchanged?: boolean;
  notifiedDevices?: number;
  walletSyncError?: string;
  validationCode?: string;
  appleWalletUrl?: string;
  googleWalletUrl?: string;
  qrUrl?: string;
  fallbackWebPass?: boolean;
  barcodeValue?: string;
  title?: string;
  memberName?: string;
  memberId?: string;
  stamps?: number;
  stampsRequired?: number;
  reward?: string;
  backgroundColor?: string;
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
  businessName?: string;
  stampsRequired?: number;
  rewardText?: string;
  rewardValueArs?: number;
  colorPreset?: 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
  customColor?: string;
  logoUrl?: string;
  googleReviewUrl?: string;
  socials: HubSocials;
  products: HubProduct[];
  details: HubDetails;
  showToqueFooter: boolean;
  planPaid?: boolean;
  networkEnabled?: boolean;
  hubConfigured?: boolean;
}

export interface Cartel {
  id: string;
  uuid?: string;
  code: string;
  pin: string;
  activationPin?: string;
  businessId?: string;
  name: string;
  location?: string;
  role: CartelRole;
  status: CartelStatus;
  reviewUrl?: string;
  mode: HubMode;
  tileColor?: TileColor;
  claimStatus?: ClaimStatus;
  scans?: number;
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
  cashTendered?: number;
  changeDue?: number;
  discountArs?: number;
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
  businessAddress?: string;
  businessHours?: string;
  items: SaleItem[];
  total: number;
  cashTendered?: number;
  changeDue?: number;
  discountArs?: number;
  currency: 'ARS';
  method: PaymentMethod;
  createdAt: string;
  claimedAt?: string;
  claimedByDeviceId?: string;
  claimedByAccountId?: string;
}

export type ClubRuleType = 'per_amount' | 'per_visit';

export interface ClubReward {
  id: string;
  label: string;
  target: number;
}

export interface ClubConfig {
  id?: string;
  name: string;
  clubName?: string;
  brandColor?: string;
  cardThemeColor?: string;
  logoUrl?: string;
  wideLogoUrl?: string;
  iconUrl?: string;
  logoText?: string;
  organizationName?: string;
  headerFields?: { label: string; value: string }[];
  primaryFields?: { label: string; value: string }[];
  secondaryFields?: { label: string; value: string }[];
  barcodeFormat?: 'QR' | 'CODE128' | 'PDF417' | 'AZTEC';
  barcodeValue?: string;
  overrideTextUnderBarcode?: boolean;
  barcodeAltText?: string;
  colorPreset?: 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
  customColor?: string;
  locations?: { latitude: number; longitude: number; relevantText?: string }[];
  walletSerial?: string;
  shareUrl?: string;
  targetStamps?: number;
  stampsRequired?: number;
  rewardText?: string;
  rewardValueArs?: number;
  loyaltyTitle?: string;
  loyaltyReward?: string;
  howToEarn?: string;
  expirationPolicy?: string;
  welcomeBenefitText?: string;
  pointsPerVisit?: number;
  enabled?: boolean;
  mode?: ClubRuleType;
  amountPerStamp?: number;
  maxStampsPerVisit?: number;
  expirationMonths?: number | null;
  allowCashierScan?: boolean;
  allowSelfScan?: boolean;
  rotatingQrEnabled?: boolean;
  rule: {
    type: ClubRuleType;
    value: number;
  };
  rewards: ClubReward[];
  active: boolean;
}

export interface ClubStampEntry {
  id: string;
  memberId: string;
  localId: string;
  localName: string;
  count: number;
  source: 'cashier' | 'self' | 'adjustment';
  amountArs?: number;
  receiptId?: string;
  actorName: string;
  createdAt: string;
  voided?: boolean;
  voidReason?: string;
}

export interface StampLogEntry {
  id: string;
  businessId: string;
  memberId: string;
  memberCode?: string;
  memberName: string;
  memberEmail?: string;
  memberPhone?: string;
  action: 'stamp_added' | 'reward_redeemed';
  stampsDelta: number;
  localName?: string;
  staffEmail?: string;
  createdAt: string;
}

export interface ToquecitoItem {
  id: string;
  accountId: string;
  businessId: string;
  businessName: string;
  initial: string;
  brandColor: string;
  createdAt: string;
  isSample?: boolean;
}

export interface ClubMember {
  id: string;
  uuid?: string;
  accountId?: string;
  tenantId?: string;
  businessId?: string;
  businessName?: string;
  localId?: string;
  localCode?: string;
  localName?: string;
  memberCode?: string;
  shortCode?: string;
  barcodeToken?: string;
  name?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  age?: number;
  isMinor?: boolean;
  contact: string;
  maskedEmail?: string;
  birthDay?: number;
  birthMonth?: number;
  anonymous?: boolean;
  marketingConsent?: boolean;
  points: number;
  stamps: number;
  stampsRequired?: number;
  targetStamps?: number;
  rewardText?: string;
  rewardValueArs?: number;
  brandColor?: string;
  colorPreset?: 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
  customColor?: string;
  logoUrl?: string;
  rewardsRedeemed?: number;
  lastVisitAt?: string;
  lastStampedAt?: string;
  passId?: string;
  passUrl?: string;
  shareUrl?: string;
  walletPassUrl?: string;
  appleWalletUrl?: string;
  googleWalletUrl?: string;
  walletSerial?: string;
  walletLastNotification?: string;
  lastNotifiedAt?: string;
  walletSyncError?: string;
  joinedAt: string;
  consent: boolean;
  isSample?: boolean;
  stampHistory?: ClubStampEntry[];
}

export interface CashierMemberLookupResult {
  id: string;
  memberId?: string;
  shortCode: string;
  memberCode: string;
  displayName: string;
  stamps: number;
  targetStamps: number;
  remainingStamps: number;
  rewardText: string;
  rewardPending: boolean;
  rewardReady?: boolean;
  lastStampedAt?: string;
  canStampNow: boolean;
  cooldownMessage?: string;
  programMode: ClubRuleType;
  amountPerStamp?: number;
  maxStampsPerVisit?: number;
}

export interface ClubPublicInfo {
  businessId: string;
  businessName: string;
  localId: string;
  localCode: string;
  localName: string;
  localAddress?: string;
  programName: string;
  loyaltyTitle?: string;
  brandColor: string;
  colorPreset?: 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
  customColor?: string;
  logoUrl?: string;
  targetStamps: number;
  rewardText: string;
  rewardValueArs?: number;
  howToEarn?: string;
  expirationPolicy?: string;
  mode: ClubRuleType;
  amountPerStamp?: number;
  maxStampsPerVisit?: number;
  allowSelfScan: boolean;
  allowCashierScan: boolean;
  isSample?: boolean;
}

export interface RecognizedClientAccount {
  recognized: boolean;
  accountExists?: boolean;
  accountId?: string;
  name?: string;
  email?: string;
  maskedEmail?: string;
  birthDay?: number;
  birthMonth?: number;
  cards?: ClubMember[];
  toquecitosCount?: number;
}

export interface ClubLocal {
  id: string;
  businessId: string;
  code: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  visitsCount: number;
  newMembersCount: number;
  returningCount: number;
  rewardsRedeemedCount: number;
  createdAt: string;
  isSample?: boolean;
}

export interface AuditLogEntry {
  id: string;
  businessId: string;
  actionType: 'void_stamp' | 'void_reward' | 'adjust_balance' | 'export_csv' | 'delete_member';
  actionLabel: string;
  memberId: string;
  memberName: string;
  delta: number;
  reason: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
  isSample?: boolean;
}

export interface NotificationTemplate {
  id: string;
  type: 'birthday' | 'nearby' | 'custom';
  title: string;
  message: string;
  active: boolean;
  scheduleInfo: string;
  scheduledFor?: string;
  benefitDaysValid?: number;
}

export interface NotificationLimits {
  maxPerClientDays: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface SetupProgress {
  step1Brand: boolean;
  step2Reward: boolean;
  step3Local: boolean;
  step4Printed: boolean;
  completedCount: number;
  totalSteps: number;
  percent: number;
}

export interface PlanState {
  status: 'trial' | 'active' | 'expired' | 'expired_trial' | 'past_due' | 'free' | 'custom';
  planId: 'free' | 'mensual' | 'anual' | 'a_consultar';
  tier?: 'free' | 'pro' | 'custom';
  billingCycle?: 'free' | 'monthly' | 'annual' | 'custom';
  daysRemaining: number;
  graceDaysRemaining?: number;
  unpaidLockdown?: boolean;
  trialStartedAt?: string;
  trialEndsAt?: string;
  expiresAt?: string;
  planSelected?: boolean;
  isSimulated: boolean;
}

export type WaitlistProduct = 'estrellas' | 'recibo' | 'toquecitos';

export interface WaitlistEntry {
  id: string;
  email: string;
  product: WaitlistProduct;
  consent: boolean;
  createdAt: string;
  unsubscribeToken: string;
  isSample?: boolean;
}

export type OtpPurpose = 'login' | 'register_merchant' | 'register_client' | 'client_card' | 'cashier_confirm';

export interface BusinessProfile {
  id: string;
  uuid?: string;
  name: string;
  ownerName: string;
  email: string;
  ownerRole?: string;
  businessEmail?: string;
  teamSize?: string;
  category?: string;
  planSelected?: boolean;
  ownerUid?: string;
  reviewUrl?: string;
  logoUrl?: string;
  brandColor?: string;
  colorPreset?: 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
  cardThemeColor?: string;
  loyaltyTitle?: string;
  loyaltyReward?: string;
  rewardValueArs?: number;
  howToEarn?: string;
  expirationPolicy?: string;
  stampsRequired?: number;
  plan?: 'free' | 'pro';
  billingCycle?: 'free' | 'monthly' | 'annual';
  trialEndsAt?: string;
  planPaid?: boolean;
  networkEnabled?: boolean;
  createdAt: string;
  scansCount?: number;
  reviewClicksCount?: number;
  walletPassesIssued?: number;
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
  birthDate?: string;
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
  businessId?: string;
  merchantName: string;
  businessAddress?: string;
  businessHours?: string;
  cartelCode?: string;
  amountArs: number;
  total?: number;
  cashTendered?: number;
  changeDue?: number;
  currency?: string;
  discountSavedArs: number;
  category: string;
  receiptNote: string;
  method?: PaymentMethod;
  items?: SaleItem[];
  createdAt: string;
  savedAt?: string;
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
  unpaidLockdown?: boolean;
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
  assignedLocalIds?: string[];
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
  assignedLocalIds?: string[];
  status: 'active' | 'revoked';
  addedAt: string;
  addedByEmail?: string;
  isSample?: boolean;
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
  myTodaySalesCount: number;
  myWeeklySalesCount: number;
  todayClaimedReceiptsCount: number;
  myClaimedReceiptsCount: number;
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
  // Métricas de Club por período
  visitsCount?: number;
  returningMembersCount?: number;
  returningRatePercent?: number;
  rewardsRedeemedCount?: number;
  stampsAddedCount?: number;
}

export type PlatformUserCategory = 'merchant_team' | 'club_member' | 'consumer_vault' | 'waitlist';

export interface PlatformUserRecord {
  id: string;
  category: PlatformUserCategory;
  roleLabel: string;
  displayName: string;
  emailOrContact: string;
  businessId?: string;
  businessName?: string;
  stamps?: number;
  rewardsRedeemed?: number;
  walletPassIssued?: boolean;
  createdAt: string;
  statusLabel: string;
}

export interface SuperAdminBusinessDetail {
  business: BusinessProfile;
  clubConfig: ClubConfig;
  hubConfig: HubConfig;
  locals: ClubLocal[];
  carteles: Cartel[];
  team: Array<Pick<TeamMember, 'id' | 'name' | 'role' | 'status' | 'assignedCartelCode' | 'addedAt'>>;
  productsCount: number;
  products: HubProduct[];
  membersCount: number;
  walletPassesIssued: number;
  salesCount: number;
  salesAmount: number;
  stampsAddedCount: number;
  rewardsRedeemedCount: number;
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
      walletPassesIssued: number;
      productsCount: number;
      localsCount: number;
    }
  >;
  carteles: Cartel[];
  recentSales: Sale[];
  allUsers: PlatformUserRecord[];
  toqueAdmins?: ToqueAdminStaff[];
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

export type ToqueAdminLevel = 'admin' | 'soporte' | 'operaciones';

export interface ToqueAdminStaff {
  id: string;
  email: string;
  name: string;
  level: ToqueAdminLevel;
  role?: ToqueAdminLevel;
  addedBy?: string;
  addedByEmail?: string;
  createdAt: string;
  active?: boolean;
}

export type ToqueAdminMember = ToqueAdminStaff;

