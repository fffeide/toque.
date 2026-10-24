/**
 * Toque — Contrato de API (ToqueApi)
 */

import {
  User,
  Cartel,
  HubConfig,
  PublicHub,
  Sale,
  Receipt,
  ClubConfig,
  ClubMember,
  ClubPublicInfo,
  RecognizedClientAccount,
  ClubLocal,
  AuditLogEntry,
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
  NetworkActivation,
  NetworkActivationFormat,
  ConsumerUser,
  ConsumerReceipt,
} from './types';

export interface ToqueApi {
  // Autenticación por Código de Verificación de 6 dígitos (OTP — Sin contraseñas)
  requestOtp(
    email: string,
    purpose?: OtpPurpose
  ): Promise<{
    sent: boolean;
    expiresInSeconds: number;
    resendAvailableInSeconds: number;
    demoHintCode?: string;
  }>;

  verifyOtp(
    email: string,
    code: string,
    extra?: { businessName?: string; ownerName?: string }
  ): Promise<{
    verified: boolean;
    user?: User;
    account?: RecognizedClientAccount;
  }>;

  register(data: {
    businessName: string;
    ownerName: string;
    email: string;
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
    name: string;
    email: string;
    birthDay?: number;
    birthMonth?: number;
    adult: boolean;
    marketingConsent: boolean;
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
  }): Promise<{
    member: ClubMember;
    account: RecognizedClientAccount;
  }>;

  // Club — Suma de Sellos, Canje y Toquecitos
  addStampByCashier(data: {
    memberId?: string;
    email?: string;
    amount?: number;
    localId?: string;
    otpCode?: string;
  }): Promise<{
    member: ClubMember;
    stampsAdded: number;
    rewardReady: boolean;
    toquecito: ToquecitoItem;
  }>;

  claimSelfStamp(data: {
    localCode: string;
    memberId: string;
    rotatingToken?: string;
  }): Promise<{
    member: ClubMember;
    stampsAdded: number;
    rewardReady: boolean;
    toquecito: ToquecitoItem;
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

  exportClubMembersCsv(): Promise<string>;

  deleteClubMember(id: string): Promise<void>;

  getClubConfig(): Promise<ClubConfig>;

  updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig>;

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

  startTrial(planId?: 'mensual' | 'anual'): Promise<PlanState>;

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
  }): Promise<Cartel>;

  updateCartel(
    id: string,
    patch: Partial<Pick<Cartel, 'name' | 'role' | 'status' | 'mode' | 'reviewUrl'>>
  ): Promise<Cartel>;

  // Hub y Recibos
  getHubConfig(): Promise<HubConfig>;

  updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig>;

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
    consent: boolean;
  }): Promise<{ member: ClubMember; pointsAwarded: number; walletPass?: WalletPassResponse }>;

  getWalletStatus(): Promise<{ configured: boolean; provider: string }>;

  createWalletPass(data: {
    cartelCode?: string;
    memberId?: string;
    customerName?: string;
    customerContact?: string;
    contact?: string;
    stamps?: number;
    points?: number;
  }): Promise<WalletPassResponse>;

  // Caja y Cobros
  createSale(data: {
    cartelId: string;
    amount: number;
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

  // Perfil del Negocio
  getBusinessProfile(): Promise<BusinessProfile>;

  updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile>;

  // Super Admin
  getSuperAdminSummary(): Promise<SuperAdminSummary>;
}
