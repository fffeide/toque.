/**
 * Toque — Contrato de API (ToqueApi)
 */

import {
  User,
  Cartel,
  HubConfig,
  HubProduct,
  PublicHub,
  Sale,
  Receipt,
  ClubConfig,
  ClubMember,
  ClubPublicInfo,
  RecognizedClientAccount,
  ClubLocal,
  AuditLogEntry,
  StampLogEntry,
  NotificationTemplate,
  NotificationLimits,
  SetupProgress,
  PlanState,
  ToquecitoItem,
  WaitlistEntry,
  WaitlistProduct,
  OtpPurpose,
  MercadoPagoStatus,
  DashboardSummary,
  BusinessProfile,
  CartelRole,
  HubMode,
  PaymentMethod,
  SaleItem,
  TeamMember,
  WalletPassResponse,
  SuperAdminSummary,
  SuperAdminBusinessDetail,
  PlatformUserRecord,
  NetworkActivation,
  NetworkActivationFormat,
  ConsumerUser,
  ConsumerReceipt,
  CashierMemberLookupResult,
} from './types';

export interface ToqueApi {
  // Autenticación por Código de Verificación de 6 dígitos (OTP — Sin contraseñas)
  requestOtp(
    email: string,
    purpose?: OtpPurpose
  ): Promise<{
    sent: boolean;
    emailSent?: boolean;
    deliveryProvider?: string;
    expiresInSeconds: number;
    resendAvailableInSeconds: number;
    demoHintCode?: string;
  }>;

  verifyOtp(
    email: string,
    code: string,
    extra?: {
      businessName?: string;
      ownerName?: string;
      ownerRole?: string;
      businessEmail?: string;
      teamSize?: string;
      category?: string;
    }
  ): Promise<{
    verified: boolean;
    accountExists?: boolean;
    user?: User;
    account?: RecognizedClientAccount;
  }>;

  register(data: {
    businessName: string;
    ownerName: string;
    email: string;
    ownerRole?: string;
    businessEmail?: string;
    teamSize?: string;
    category?: string;
  }): Promise<{ user: User; token: string }>;

  login(credentials: {
    email: string;
    code?: string;
  }): Promise<{ user: User; token: string }>;

  logout(): Promise<void>;

  getCurrentUser(): Promise<User | null>;

  // Club — Alta Pública del Cliente y Reconocimiento de Cuenta
  getClubPublic(localCode: string): Promise<ClubPublicInfo>;

  registerMember(data: {
    localCode?: string;
    name?: string;
    email: string;
    phone?: string;
    birthDate?: string;
    birthDay?: number;
    birthMonth?: number;
    adult?: boolean;
    marketingConsent: boolean;
    age?: number;
    isMinor?: boolean;
  }): Promise<{
    member: ClubMember;
    account: RecognizedClientAccount;
    requiresOtp: boolean;
  }>;

  createAnonymousCard(localCode: string): Promise<{
    member: ClubMember;
  }>;

  recognizeAccount(email?: string): Promise<RecognizedClientAccount>;

  addCardToAccount(data: {
    localCode: string;
    marketingConsent: boolean;
    email?: string;
    name?: string;
    consumerId?: string;
    barcodeToken?: string;
  }): Promise<{
    member: ClubMember;
    account: RecognizedClientAccount;
  }>;

  // Club — Búsqueda y Suma de Sellos en Caja (sin enviar delta de sellos desde el navegador)
  lookupMemberByCode(code: string): Promise<CashierMemberLookupResult>;

  addStampByCashier(data: {
    memberId?: string;
    memberCode?: string;
    email?: string;
    phone?: string;
    amount?: number;
    localId?: string;
    otpCode?: string;
  }): Promise<{
    member: ClubMember;
    stampsAdded: number;
    rewardReady: boolean;
    toquecito?: ToquecitoItem;
    cooldown?: boolean;
    remainingMs?: number;
    message?: string;
  }>;

  claimSelfStamp(data: {
    localCode: string;
    memberId: string;
    rotatingToken?: string;
    receiptId?: string;
  }): Promise<{
    member: ClubMember;
    stampsAdded: number;
    rewardReady: boolean;
    toquecito?: ToquecitoItem;
    cooldown?: boolean;
    remainingMs?: number;
    message?: string;
  }>;

  getRotatingCode(localId: string): Promise<{
    localId: string;
    localCode: string;
    token: string;
    validForSeconds: number;
    expiresAt: string;
  }>;

  redeemReward(memberId: string): Promise<{
    member: ClubMember;
    rewardsRedeemed: number;
  }>;

  listToquecitos(accountId?: string): Promise<ToquecitoItem[]>;

  // Historial de Sellos y Premios (Stamp Logs & CSV)
  listStampLogs(period?: '30d' | '3m' | '12m' | 'all'): Promise<StampLogEntry[]>;

  exportStampLogsCsv(period?: '30d' | '3m' | '12m' | 'all', reason?: string): Promise<string>;

  // Club — Correcciones (Solo lectura con motivo obligatorio >= 10 caracteres)
  voidStamp(data: {
    stampId: string;
    memberId?: string;
    reason: string;
  }): Promise<{
    member: ClubMember;
    auditEntry: AuditLogEntry;
  }>;

  adjustBalance(data: {
    memberId: string;
    delta: number;
    reason: string;
  }): Promise<{
    member: ClubMember;
    auditEntry: AuditLogEntry;
  }>;

  listAuditLog(filters?: {
    dateFrom?: string;
    dateTo?: string;
    actorName?: string;
  }): Promise<AuditLogEntry[]>;

  // Club — Clientes y Configuración
  listMembers(filters?: {
    search?: string;
    localId?: string;
  }): Promise<ClubMember[]>;

  listClubMembers(): Promise<ClubMember[]>;

  exportClubMembersCsv(reason?: string): Promise<string>;

  deleteClubMember(id: string, reason?: string): Promise<void>;

  revokeMemberCard(memberId: string, reason?: string): Promise<{ revoked: boolean; walletRevoked?: boolean }>;

  getClubConfig(): Promise<ClubConfig>;

  updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig>;

  listClubCards(): Promise<ClubConfig[]>;

  createClubCard(data: {
    name?: string;
    loyaltyTitle?: string;
    rewardText: string;
    targetStamps?: number;
    stampsRequired?: number;
    brandColor: string;
    howToEarn?: string;
    expirationPolicy?: string;
    logoText?: string;
    organizationName?: string;
    barcodeFormat?: 'QR' | 'CODE128' | 'PDF417' | 'AZTEC';
    barcodeValue?: string;
    barcodeAltText?: string;
    colorPreset?: 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
    customColor?: string;
    logoUrl?: string;
    wideLogoUrl?: string;
    iconUrl?: string;
    headerFields?: Array<{ label: string; value: string }>;
    primaryFields?: Array<{ label: string; value: string }>;
    secondaryFields?: Array<{ label: string; value: string }>;
  }): Promise<ClubConfig>;

  selectClubCard(cardId: string): Promise<ClubConfig>;

  deleteClubCard(cardId: string): Promise<ClubConfig[]>;

  // Locales del Comercio
  listLocals(): Promise<ClubLocal[]>;

  createLocal(data: {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
  }): Promise<ClubLocal>;

  updateLocal(
    id: string,
    patch: Partial<Pick<ClubLocal, 'name' | 'address' | 'lat' | 'lng'>>
  ): Promise<ClubLocal>;

  // Avisos y Límites
  listNotificationTemplates(): Promise<{
    templates: NotificationTemplate[];
    limits: NotificationLimits;
    subscribedClientsCount: number;
  }>;

  updateTemplate(
    id: string,
    patch: Partial<Pick<NotificationTemplate, 'title' | 'message' | 'active'>>,
    limitsPatch?: Partial<NotificationLimits>
  ): Promise<{
    templates: NotificationTemplate[];
    limits: NotificationLimits;
  }>;

  scheduleNotification(data: {
    title: string;
    message: string;
    scheduledFor: string;
  }): Promise<NotificationTemplate>;

  // Configuración Inicial y Suscripción
  getSetupProgress(): Promise<SetupProgress>;

  markCartelPrinted(): Promise<SetupProgress>;

  getPlanState(): Promise<PlanState>;

  startTrial(planId?: 'free' | 'mensual' | 'anual' | 'a_consultar'): Promise<PlanState>;

  selectPlan(
    planChoice: 'mensual' | 'anual' | 'trial_14' | 'trial_14d'
  ): Promise<PlanState>;

  // Lista de Espera (Waitlist)
  joinWaitlist(data: {
    email: string;
    product: WaitlistProduct;
    consent: boolean;
    honeypot?: string;
  }): Promise<{
    joined: boolean;
    alreadyRegistered?: boolean;
    entry: WaitlistEntry;
  }>;

  listWaitlist(): Promise<WaitlistEntry[]>;

  // Activación y Gestión de Carteles
  getActivationState(code: string): Promise<{
    found: boolean;
    status?: Cartel['status'];
    requiresPin?: boolean;
    cartel?: Partial<Cartel>;
  }>;

  getCartelByCode(code: string): Promise<Cartel | null>;

  activateCartel(data: {
    code: string;
    pin?: string;
    businessName?: string;
    reviewUrl?: string;
    googleReviewUrl?: string;
    cartelName?: string;
    name?: string;
    role: CartelRole;
    mode?: HubMode;
  }): Promise<{ success: boolean; cartel: Cartel }>;

  listCarteles(): Promise<Cartel[]>;

  createCartelForBusiness(data: {
    name: string;
    code?: string;
    role: CartelRole;
    mode?: HubMode;
    reviewUrl?: string;
    status?: Cartel['status'];
    pin?: string;
    activationPin?: string;
    tileColor?: Cartel['tileColor'];
    location?: string;
  }): Promise<Cartel>;

  updateCartel(
    id: string,
    patch: Partial<Pick<Cartel, 'name' | 'role' | 'status' | 'mode' | 'reviewUrl'>>
  ): Promise<Cartel>;

  // Hub, Productos (con importación CSV) y Recibos
  getHubConfig(): Promise<HubConfig>;

  updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig>;

  importProductsCsv(
    csvContent: string,
    replaceExisting?: boolean
  ): Promise<{
    importedCount: number;
    totalProducts: number;
    products: HubProduct[];
  }>;

  getPublicHub(code: string): Promise<PublicHub>;

  subscribeToCartelHub(code: string, onUpdate: (hub: PublicHub) => void): () => void;

  getReceiptById(receiptId: string): Promise<Receipt | null>;

  subscribeToReceipt(receiptId: string, onUpdate: (receipt: Receipt | null) => void): () => void;

  claimReceipt(id: string): Promise<{ success: boolean; receipt: Receipt }>;

  recordHubEvent(code: string, eventType: 'scan' | 'review_click'): Promise<void>;

  joinClub(data: {
    cartelCode: string;
    contact: string;
    name?: string;
    phone?: string;
    birthDate?: string;
    age?: number;
    isMinor?: boolean;
    consent: boolean;
  }): Promise<{ member: ClubMember; pointsAwarded: number; walletPass?: WalletPassResponse }>;

  getWalletStatus(): Promise<{ configured: boolean; emailConfigured?: boolean; provider: string; passesIssuedCount?: number }>;

  createWalletPass(data: {
    cartelCode?: string;
    memberId?: string;
    memberCode?: string;
    customerName?: string;
    customerContact?: string;
    contact?: string;
    stamps?: number;
    stampsRequired?: number;
    points?: number;
    serialNumber?: string;
    isUpdate?: boolean;
    logoText?: string;
    organizationName?: string;
    rewardText?: string;
    barcodeFormat?: 'QR' | 'CODE128' | 'PDF417' | 'AZTEC';
    barcodeValue?: string;
    barcodeAltText?: string;
    colorPreset?: 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
    color?: string;
    logoURL?: string;
    wideLogoURL?: string;
    iconURL?: string;
    headerFields?: { label: string; value: string }[];
    primaryFields?: { label: string; value: string }[];
    secondaryFields?: { label: string; value: string }[];
    locations?: { latitude: number; longitude: number; relevantText?: string }[];
  }): Promise<WalletPassResponse>;

  // Caja y Cobros
  createSale(data: {
    cartelId: string;
    amount: number;
    cashTendered?: number;
    changeDue?: number;
    discountArs?: number;
    items?: SaleItem[];
    method: PaymentMethod;
  }): Promise<{ sale: Sale; qrData?: string; receipt?: Receipt }>;

  getSale(id: string): Promise<Sale>;

  confirmManualSale(id: string): Promise<{ sale: Sale; receipt: Receipt }>;

  simulatePaymentApproved(id: string): Promise<{ sale: Sale; receipt: Receipt }>;

  cancelSale(id: string): Promise<Sale>;

  listSales(filters?: {
    dateFrom?: string;
    dateTo?: string;
    method?: PaymentMethod;
    cartelId?: string;
  }): Promise<Sale[]>;

  subscribeToBusinessSales(onUpdate: (sales: Sale[]) => void): () => void;

  // Equipo y Colaboradores
  listTeamMembers(): Promise<TeamMember[]>;

  addTeamMember(data: {
    name: string;
    email?: string;
    role: 'owner' | 'manager' | 'cashier';
    assignedCartelId?: string;
    assignedLocalIds?: string[];
  }): Promise<TeamMember>;

  updateTeamMember(
    id: string,
    patch: Partial<
      Pick<TeamMember, 'name' | 'role' | 'assignedCartelId' | 'assignedLocalIds' | 'status'>
    >
  ): Promise<TeamMember>;

  removeTeamMember(id: string): Promise<void>;

  // Red y Consumidor
  listNetworkActivations(): Promise<NetworkActivation[]>;

  getPublicCrossBenefits(excludeBusinessId?: string): Promise<NetworkActivation[]>;

  saveNetworkActivation(data: {
    formatType: NetworkActivationFormat;
    title: string;
    discountText: string;
    terms: string;
    active: boolean;
  }): Promise<NetworkActivation>;

  toggleNetworkActivation(
    formatType: NetworkActivationFormat,
    active: boolean
  ): Promise<NetworkActivation>;

  syncConsumerVault(payload: {
    user: ConsumerUser;
    receipts: ConsumerReceipt[];
  }): Promise<{
    success: boolean;
    consumerId: string;
    recoveryCode: string;
    user: ConsumerUser;
    receipts: ConsumerReceipt[];
  }>;

  recoverConsumerVault(contactOrId: string): Promise<{
    found: boolean;
    user?: ConsumerUser;
    receipts?: ConsumerReceipt[];
  }>;

  getMercadoPagoStatus(): Promise<MercadoPagoStatus>;

  connectMercadoPago(): Promise<{ connected: boolean }>;

  disconnectMercadoPago(): Promise<{ connected: boolean }>;

  // Resumen del Panel
  getDashboardSummary(period?: '30d' | '3m' | '12m' | 'all'): Promise<DashboardSummary>;

  // Perfil del Negocio y Cuenta
  getBusinessProfile(): Promise<BusinessProfile>;

  updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile>;

  updateAccountEmail(newEmail: string): Promise<{ user: User; business: BusinessProfile }>;

  deleteAccount(): Promise<{ deleted: boolean }>;

  cleanOrphanData(): Promise<{ cleaned: boolean; message: string }>;

  // Super Admin & Equipo Toque (toque_admins)
  getSuperAdminSummary(): Promise<SuperAdminSummary>;

  getSuperAdminBusinessDetail(businessId: string): Promise<SuperAdminBusinessDetail>;

  listAllPlatformUsers(): Promise<PlatformUserRecord[]>;

  listToqueAdmins(): Promise<import('./types').ToqueAdminStaff[]>;

  addToqueAdmin(data: {
    email: string;
    name: string;
    level?: import('./types').ToqueAdminLevel;
    role?: import('./types').ToqueAdminLevel;
  }): Promise<import('./types').ToqueAdminStaff>;

  removeToqueAdmin(idOrEmail: string): Promise<void>;
}


