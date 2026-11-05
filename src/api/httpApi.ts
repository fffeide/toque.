/**
 * Toque — Cliente HTTP REST (httpApi)
 * Realiza peticiones a /api/... con credentials: 'include' (sesión en cookie del servidor).
 */

import { ToqueApi } from './ToqueApi';
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
  CashierMemberLookupResult,
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
  TenantFeaturesRecord,
  MenuCategory,
  MenuItem,
  RestaurantTable,
  OrderSlip,
  OrderStatus,
  OrderType,
  WaiterCall,
  TableReservation,
  MenuBranding,
  PublicMenuData,
} from './types';

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  } | string;
}

class HttpApi implements ToqueApi {
  private baseUrl = '/api';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch {
      throw new Error('No pudimos conectar con el servidor. Revisá tu conexión a internet.');
    }

    if (!response.ok) {
      let errBody: ApiErrorResponse | null = null;
      try {
        errBody = await response.json();
      } catch {
        // Fallback
      }

      const errorMessage =
        typeof errBody?.error === 'string'
          ? errBody.error
          : errBody?.error?.message || `Error en la solicitud (${response.status})`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Autenticación OTP
  async requestOtp(email: string, purpose: OtpPurpose = 'login') {
    return this.request<{
      sent: boolean;
      emailSent?: boolean;
      deliveryProvider?: string;
      expiresInSeconds: number;
      resendAvailableInSeconds: number;
      demoHintCode?: string;
    }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    });
  }

  async verifyOtp(
    email: string,
    code: string,
    extra?: {
      businessName?: string;
      ownerName?: string;
      ownerRole?: 'Dueño/a' | 'Encargado/a' | 'Administración' | 'Otro';
      businessEmail?: string;
      teamSize?: 'Solo yo' | '2 a 5' | '6 a 15' | '16 o más';
      category?: string;
    }
  ) {
    return this.request<{
      verified: boolean;
      user?: User;
      account?: RecognizedClientAccount;
      accountExists?: boolean;
    }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code, ...extra }),
    });
  }

  async register(data: {
    businessName: string;
    ownerName: string;
    email: string;
    ownerRole?: 'Dueño/a' | 'Encargado/a' | 'Administración' | 'Otro';
    businessEmail?: string;
    teamSize?: 'Solo yo' | '2 a 5' | '6 a 15' | '16 o más';
    category?: string;
  }): Promise<{ user: User; token: string }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(credentials: {
    email: string;
    code?: string;
  }): Promise<{ user: User; token: string }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const res = await this.request<{ user: User }>('/auth/me');
      return res.user;
    } catch {
      return null;
    }
  }

  // Club Público y Alta del Cliente
  async getClubPublic(localCode: string): Promise<ClubPublicInfo> {
    return this.request(`/club/public/${encodeURIComponent(localCode)}`);
  }

  async registerMember(data: {
    localCode?: string;
    name?: string;
    email: string;
    phone?: string;
    birthDate?: string;
    birthDay?: number;
    birthMonth?: number;
    adult?: boolean;
    marketingConsent: boolean;
  }): Promise<{ member: ClubMember; account: RecognizedClientAccount; requiresOtp: boolean }> {
    const localCode = String(data.localCode || '').trim();
    if (!localCode) throw new Error('No encontramos el código del comercio.');

    // El Worker crea la cuenta de consumidor usando el OTP ya verificado
    // y establece la cookie HttpOnly de sesión.
    const registration = await this.request<{
      user: { id: string; email: string; fullName: string; birthDate?: string };
    }>('/consumer/register', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        fullName: data.name,
        birthDate: data.birthDate,
      }),
    });

    // La tarjeta se crea en D1 bajo la identidad validada por la cookie,
    // nunca usando el email/consumerId enviado libremente por el navegador.
    const claimed = await this.request<{
      card?: ClubMember;
      member?: ClubMember;
      user?: { id: string; email: string; fullName: string; birthDate?: string };
    }>('/consumer/cards/claim', {
      method: 'POST',
      body: JSON.stringify({ code: localCode }),
    });
    const member = claimed.card || claimed.member;
    if (!member) throw new Error('La cuenta se creó, pero no pudimos guardar la tarjeta.');

    const user = claimed.user || registration.user;
    return {
      member,
      account: {
        recognized: true,
        accountExists: true,
        accountId: user.id,
        name: user.fullName,
        email: user.email,
        cards: [member],
      },
      requiresOtp: false,
    };
  }

  async createAnonymousCard(localCode: string) {
    return this.request<{ member: ClubMember }>('/club/anonymous-card', {
      method: 'POST',
      body: JSON.stringify({ localCode }),
    });
  }

  async recognizeAccount(_email?: string): Promise<RecognizedClientAccount> {
    // La identidad se obtiene exclusivamente de la cookie HttpOnly.
    const session = await this.request<{
      authenticated: boolean;
      user: { id: string; email: string; fullName: string; birthDate?: string } | null;
      cards: ClubMember[];
    }>('/consumer/me');
    if (!session.authenticated || !session.user) {
      return { recognized: false, accountExists: false, cards: [] };
    }
    return {
      recognized: true,
      accountExists: true,
      accountId: session.user.id,
      name: session.user.fullName,
      email: session.user.email,
      cards: session.cards || [],
    };
  }

  async addCardToAccount(data: {
    localCode: string;
    marketingConsent: boolean;
    email?: string;
    name?: string;
    consumerId?: string;
    barcodeToken?: string;
  }): Promise<{ member: ClubMember; account: RecognizedClientAccount }> {
    const claimed = await this.request<{
      card?: ClubMember;
      member?: ClubMember;
      user?: { id: string; email: string; fullName: string };
    }>('/consumer/cards/claim', {
      method: 'POST',
      body: JSON.stringify({ code: data.localCode }),
    });
    const member = claimed.card || claimed.member;
    if (!member || !claimed.user) {
      throw new Error('No pudimos asociar la tarjeta a tu cuenta.');
    }
    return {
      member,
      account: {
        recognized: true,
        accountExists: true,
        accountId: claimed.user.id,
        name: claimed.user.fullName,
        email: claimed.user.email,
        cards: [member],
      },
    };
  }

  // Sellos, Canje y Toquecitos
  async lookupMemberByCode(code: string): Promise<CashierMemberLookupResult> {
    return this.request(`/club/members/lookup?code=${encodeURIComponent(code)}`);
  }

  async addStampByCashier(data: {
    memberId?: string;
    memberCode?: string;
    email?: string;
    phone?: string;
    amount?: number;
    localId?: string;
    otpCode?: string;
  }) {
    return this.request<{
      member: ClubMember;
      stampsAdded: number;
      rewardReady: boolean;
      toquecito: ToquecitoItem;
    }>('/club/stamps/cashier', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async claimSelfStamp(data: {
    localCode: string;
    memberId: string;
    rotatingToken?: string;
    receiptId?: string;
  }) {
    return this.request<{
      member: ClubMember;
      stampsAdded: number;
      rewardReady: boolean;
      toquecito?: ToquecitoItem;
      cooldown?: boolean;
      remainingMs?: number;
    }>('/club/stamps/self', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRotatingCode(localId: string) {
    return this.request<{
      localId: string;
      localCode: string;
      token: string;
      validForSeconds: number;
      expiresAt: string;
    }>(`/club/locals/${encodeURIComponent(localId)}/rotating-code`);
  }

  async redeemReward(memberId: string) {
    return this.request<{
      member: ClubMember;
      rewardsRedeemed: number;
    }>(`/club/members/${encodeURIComponent(memberId)}/redeem`, {
      method: 'POST',
    });
  }

  async listToquecitos(accountId?: string): Promise<ToquecitoItem[]> {
    const q = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
    return this.request(`/club/toquecitos${q}`);
  }

  async listStampLogs(period: '30d' | '3m' | '12m' | 'all' = '30d'): Promise<StampLogEntry[]> {
    return this.request(`/club/stamp-logs?period=${encodeURIComponent(period)}`);
  }

  async exportStampLogsCsv(
    period: '30d' | '3m' | '12m' | 'all' = '30d',
    reason?: string
  ): Promise<string> {
    const params = new URLSearchParams({ period });
    if (reason) params.set('reason', reason);
    return this.request(`/club/stamp-logs/export-csv?${params.toString()}`);
  }

  // Correcciones
  async voidStamp(data: { stampId: string; memberId?: string; reason: string }) {
    return this.request<{
      member: ClubMember;
      auditEntry: AuditLogEntry;
    }>('/club/audit/void-stamp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adjustBalance(data: { memberId: string; delta: number; reason: string }) {
    return this.request<{
      member: ClubMember;
      auditEntry: AuditLogEntry;
    }>('/club/audit/adjust-balance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listAuditLog(filters?: {
    dateFrom?: string;
    dateTo?: string;
    actorName?: string;
  }): Promise<AuditLogEntry[]> {
    const params = new URLSearchParams();
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.set('dateTo', filters.dateTo);
    if (filters?.actorName) params.set('actorName', filters.actorName);
    return this.request(`/club/audit?${params.toString()}`);
  }

  // Clientes y Configuración del Club
  async listMembers(filters?: { search?: string; localId?: string }): Promise<ClubMember[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.localId) params.set('localId', filters.localId);
    return this.request(`/club/members?${params.toString()}`);
  }

  async listClubMembers(): Promise<ClubMember[]> {
    return this.listMembers();
  }

  async exportClubMembersCsv(reason?: string): Promise<string> {
    const q = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return this.request(`/club/members/export-csv${q}`);
  }

  async deleteClubMember(id: string, reason?: string): Promise<void> {
    await this.request(`/club/members/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: reason ? JSON.stringify({ reason }) : undefined,
    });
  }

  async revokeMemberCard(
    memberId: string,
    reason?: string
  ): Promise<{ revoked: boolean; walletRevoked?: boolean }> {
    return this.request(`/club/members/${encodeURIComponent(memberId)}/revoke`, {
      method: 'DELETE',
      body: reason ? JSON.stringify({ reason }) : undefined,
    });
  }

  async getClubConfig(): Promise<ClubConfig> {
    return this.request('/club/config');
  }

  async updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig> {
    return this.request('/club/config', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async listClubCards(): Promise<ClubConfig[]> {
    return this.request('/club/cards');
  }

  async createClubCard(data: {
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
    barcodeFormat?: 'QR' | 'Code128' | 'PDF417' | 'AZTEC';
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
  }): Promise<ClubConfig> {
    return this.request('/club/cards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async selectClubCard(cardId: string): Promise<ClubConfig> {
    return this.request(`/club/cards/${encodeURIComponent(cardId)}/select`, {
      method: 'POST',
    });
  }

  async deleteClubCard(cardId: string): Promise<ClubConfig[]> {
    return this.request(`/club/cards/${encodeURIComponent(cardId)}`, {
      method: 'DELETE',
    });
  }

  // Locales
  async listLocals(): Promise<ClubLocal[]> {
    return this.request('/club/locals');
  }

  async createLocal(data: {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
  }): Promise<ClubLocal> {
    return this.request('/club/locals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLocal(
    id: string,
    patch: Partial<Pick<ClubLocal, 'name' | 'address' | 'lat' | 'lng'>>
  ): Promise<ClubLocal> {
    return this.request(`/club/locals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // Avisos
  async listNotificationTemplates() {
    return this.request<{
      templates: NotificationTemplate[];
      limits: NotificationLimits;
      subscribedClientsCount: number;
    }>('/club/notifications/templates');
  }

  async updateTemplate(
    id: string,
    patch: Partial<Pick<NotificationTemplate, 'title' | 'message' | 'active'>>,
    limitsPatch?: Partial<NotificationLimits>
  ) {
    return this.request<{
      templates: NotificationTemplate[];
      limits: NotificationLimits;
    }>(`/club/notifications/templates/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ patch, limitsPatch }),
    });
  }

  async scheduleNotification(data: {
    title: string;
    message: string;
    scheduledFor: string;
  }): Promise<NotificationTemplate> {
    return this.request('/club/notifications/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Configuración Inicial y Suscripción
  async getSetupProgress(): Promise<SetupProgress> {
    return this.request('/club/setup-progress');
  }

  async markCartelPrinted(): Promise<SetupProgress> {
    return this.request('/club/setup-progress/printed', { method: 'POST' });
  }

  async getPlanState(): Promise<PlanState> {
    return this.request('/subscription/state');
  }

  async startTrial(planId: 'free' | 'mensual' | 'anual' | 'a_consultar' = 'anual'): Promise<PlanState> {
    return this.request('/subscription/start-trial', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  }

  async selectPlan(planChoice: 'mensual' | 'anual' | 'trial_14' | 'trial_14d'): Promise<PlanState> {
    return this.request('/subscription/select-plan', {
      method: 'POST',
      body: JSON.stringify({ planChoice }),
    });
  }

  // Lista de Espera
  async joinWaitlist(data: {
    email: string;
    product: WaitlistProduct;
    consent: boolean;
    honeypot?: string;
  }) {
    return this.request<{
      joined: boolean;
      alreadyRegistered?: boolean;
      entry: WaitlistEntry;
    }>('/waitlist', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listWaitlist(): Promise<WaitlistEntry[]> {
    return this.request('/admin/waitlist');
  }

  // Carteles, Hub, Caja, Equipo
  async getActivationState(code: string) {
    return this.request<{
      found: boolean;
      status?: Cartel['status'];
      requiresPin?: boolean;
      cartel?: Partial<Cartel>;
    }>(`/carteles/activation-state?code=${encodeURIComponent(code)}`);
  }

  async getCartelByCode(code: string): Promise<Cartel | null> {
    return this.request(`/carteles/by-code/${encodeURIComponent(code)}`);
  }

  async activateCartel(data: {
    code: string;
    pin?: string;
    businessName?: string;
    reviewUrl?: string;
    googleReviewUrl?: string;
    cartelName?: string;
    name?: string;
    role: CartelRole;
    mode?: HubMode;
  }): Promise<{ success: boolean; cartel: Cartel }> {
    return this.request('/carteles/activate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listCarteles(): Promise<Cartel[]> {
    return this.request('/carteles');
  }

  async createCartelForBusiness(data: {
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
  }): Promise<Cartel> {
    return this.request('/carteles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCartel(
    id: string,
    patch: Partial<Pick<Cartel, 'name' | 'role' | 'status' | 'mode' | 'reviewUrl'>>
  ): Promise<Cartel> {
    return this.request(`/carteles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async getHubConfig(): Promise<HubConfig> {
    return this.request('/hub/config');
  }

  async updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig> {
    return this.request('/hub/config', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async importProductsCsv(csvContent: string, replaceExisting = false) {
    return this.request<{
      importedCount: number;
      totalProducts: number;
      products: HubProduct[];
    }>('/hub/products/import-csv', {
      method: 'POST',
      body: JSON.stringify({ csvContent, replaceExisting }),
    });
  }

  async getPublicHub(code: string): Promise<PublicHub> {
    return this.request(`/public/hub/${encodeURIComponent(code)}`);
  }

  subscribeToCartelHub(code: string, onUpdate: (hub: PublicHub) => void): () => void {
    this.getPublicHub(code).then(onUpdate).catch(() => {});
    return () => {};
  }

  async getReceiptById(receiptId: string): Promise<Receipt | null> {
    return this.request(`/receipts/${encodeURIComponent(receiptId)}`);
  }

  subscribeToReceipt(
    receiptId: string,
    onUpdate: (receipt: Receipt | null) => void
  ): () => void {
    this.getReceiptById(receiptId).then(onUpdate).catch(() => {});
    return () => {};
  }

  async claimReceipt(id: string): Promise<{ success: boolean; receipt: Receipt }> {
    return this.request(`/receipts/${encodeURIComponent(id)}/claim`, { method: 'POST' });
  }

  async recordHubEvent(code: string, eventType: 'scan' | 'review_click'): Promise<void> {
    await this.request(`/public/hub/${encodeURIComponent(code)}/events`, {
      method: 'POST',
      body: JSON.stringify({ eventType }),
    });
  }

  async joinClub(data: {
    cartelCode: string;
    contact: string;
    name?: string;
    phone?: string;
    birthDate?: string;
    age?: number;
    isMinor?: boolean;
    consent: boolean;
  }): Promise<{ member: ClubMember; pointsAwarded: number; walletPass?: WalletPassResponse }> {
    return this.request('/club/join', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWalletStatus(): Promise<{ configured: boolean; emailConfigured?: boolean; provider: string; passesIssuedCount?: number }> {
    return this.request('/wallet/status');
  }

  async createWalletPass(data: {
    cartelCode?: string;
    memberId?: string;
    memberCode?: string;
    customerName?: string;
    customerContact?: string;
    contact?: string;
    stamps?: number;
    points?: number;
  }): Promise<WalletPassResponse> {
    return this.request('/wallet/pass', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createSale(data: {
    cartelId: string;
    amount: number;
    cashTendered?: number;
    changeDue?: number;
    discountArs?: number;
    items?: SaleItem[];
    method: PaymentMethod;
  }): Promise<{ sale: Sale; qrData?: string; receipt?: Receipt }> {
    return this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSale(id: string): Promise<Sale> {
    return this.request(`/sales/${encodeURIComponent(id)}`);
  }

  async confirmManualSale(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    return this.request(`/sales/${encodeURIComponent(id)}/confirm-manual`, { method: 'POST' });
  }

  async simulatePaymentApproved(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    return this.request(`/sales/${encodeURIComponent(id)}/simulate-approval`, {
      method: 'POST',
    });
  }

  async cancelSale(id: string): Promise<Sale> {
    return this.request(`/sales/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
  }

  async listSales(filters?: {
    dateFrom?: string;
    dateTo?: string;
    method?: PaymentMethod;
    cartelId?: string;
  }): Promise<Sale[]> {
    const params = new URLSearchParams();
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.set('dateTo', filters.dateTo);
    if (filters?.method) params.set('method', filters.method);
    if (filters?.cartelId) params.set('cartelId', filters.cartelId);
    return this.request(`/sales?${params.toString()}`);
  }

  subscribeToBusinessSales(onUpdate: (sales: Sale[]) => void): () => void {
    this.listSales().then(onUpdate).catch(() => {});
    return () => {};
  }

  async listTeamMembers(): Promise<TeamMember[]> {
    return this.request('/team');
  }

  async addTeamMember(data: {
    name: string;
    email?: string;
    role: 'owner' | 'manager' | 'cashier';
    assignedCartelId?: string;
    assignedLocalIds?: string[];
  }): Promise<TeamMember> {
    return this.request('/team', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTeamMember(
    id: string,
    patch: Partial<
      Pick<TeamMember, 'name' | 'role' | 'assignedCartelId' | 'assignedLocalIds' | 'status'>
    >
  ): Promise<TeamMember> {
    return this.request(`/team/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async removeTeamMember(id: string): Promise<void> {
    await this.request(`/team/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async listNetworkActivations(): Promise<NetworkActivation[]> {
    return this.request('/network/activations');
  }

  async getPublicCrossBenefits(): Promise<NetworkActivation[]> {
    return this.request('/network/cross-benefits');
  }

  async saveNetworkActivation(data: {
    formatType: NetworkActivationFormat;
    title: string;
    discountText: string;
    terms: string;
    active: boolean;
  }): Promise<NetworkActivation> {
    return this.request('/network/activations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async toggleNetworkActivation(
    formatType: NetworkActivationFormat,
    active: boolean
  ): Promise<NetworkActivation> {
    return this.request(`/network/activations/${encodeURIComponent(formatType)}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
  }

  async syncConsumerVault(payload: {
    user: ConsumerUser;
    receipts: ConsumerReceipt[];
  }) {
    return this.request<{
      success: boolean;
      consumerId: string;
      recoveryCode: string;
      user: ConsumerUser;
      receipts: ConsumerReceipt[];
    }>('/consumer/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async recoverConsumerVault(contactOrId: string) {
    return this.request<{
      found: boolean;
      user?: ConsumerUser;
      receipts?: ConsumerReceipt[];
    }>(`/consumer/sync?contact=${encodeURIComponent(contactOrId)}`);
  }

  async getMercadoPagoStatus(): Promise<MercadoPagoStatus> {
    return this.request('/integrations/mercadopago/status');
  }

  async connectMercadoPago(): Promise<{ connected: boolean }> {
    return this.request('/integrations/mercadopago/connect', { method: 'POST' });
  }

  async disconnectMercadoPago(): Promise<{ connected: boolean }> {
    return this.request('/integrations/mercadopago/disconnect', { method: 'POST' });
  }

  async getDashboardSummary(period: '30d' | '3m' | '12m' | 'all' = '30d'): Promise<DashboardSummary> {
    return this.request(`/dashboard/summary?period=${encodeURIComponent(period)}`);
  }

  async getBusinessProfile(): Promise<BusinessProfile> {
    return this.request('/business/profile');
  }

  async updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile> {
    return this.request('/business/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async updateAccountEmail(newEmail: string): Promise<{ user: User; business: BusinessProfile }> {
    return this.request('/account/email', {
      method: 'PATCH',
      body: JSON.stringify({ email: newEmail }),
    });
  }

  async deleteAccount(code?: string): Promise<{ deleted: boolean }> {
    return this.request('/merchant/account', {
      method: 'DELETE',
      body: JSON.stringify({ code }),
    });
  }

  async cleanOrphanData(): Promise<{ cleaned: boolean; message: string }> {
    return {
      cleaned: true,
      message: 'Cuenta sincronizada.',
    };
  }

  async getSuperAdminSummary(): Promise<SuperAdminSummary> {
    return this.request('/admin/summary');
  }

  async getSuperAdminBusinessDetail(businessId: string): Promise<SuperAdminBusinessDetail> {
    return this.request(`/admin/businesses/${encodeURIComponent(businessId)}`);
  }

  async listAllPlatformUsers(): Promise<PlatformUserRecord[]> {
    return this.request('/admin/users');
  }

  async listToqueAdmins(): Promise<import('./types').ToqueAdminStaff[]> {
    return this.request('/admin/toque-team');
  }

  async addToqueAdmin(data: {
    email: string;
    name: string;
    level?: import('./types').ToqueAdminLevel;
    role?: import('./types').ToqueAdminLevel;
  }): Promise<import('./types').ToqueAdminStaff> {
    return this.request('/admin/toque-team', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeToqueAdmin(idOrEmail: string): Promise<void> {
    await this.request(`/admin/toque-team/${encodeURIComponent(idOrEmail)}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // Toque Carta — Funciones por comercio y flags
  // ==========================================
  async getFeatures(): Promise<Record<string, boolean>> {
    return this.request('/features');
  }

  async listTenantsFeatures(): Promise<TenantFeaturesRecord[]> {
    return this.request('/admin/tenant-features');
  }

  async setTenantFeature(tenantId: string, key: string, enabled: boolean): Promise<void> {
    await this.request('/admin/tenant-features', {
      method: 'POST',
      body: JSON.stringify({ tenantId, key, enabled }),
    });
  }

  // Toque Carta — Gestión de Carta
  async listMenu(): Promise<{ categories: MenuCategory[]; items: MenuItem[]; branding?: MenuBranding }> {
    return this.request('/menu');
  }

  async createCategory(data: { name: string }): Promise<MenuCategory> {
    return this.request('/menu/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, patch: Partial<MenuCategory>): Promise<MenuCategory> {
    return this.request(`/menu/categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.request(`/menu/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async createItem(data: {
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    available?: boolean;
    imageUrl?: string;
  }): Promise<MenuItem> {
    return this.request('/menu/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateItem(id: string, patch: Partial<MenuItem>): Promise<MenuItem> {
    return this.request(`/menu/items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async deleteItem(id: string): Promise<void> {
    await this.request(`/menu/items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async updateMenuBranding(patch: Partial<MenuBranding>): Promise<MenuBranding> {
    return this.request('/menu/branding', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // Toque Carta — Gestión de Mesas
  async listTables(): Promise<RestaurantTable[]> {
    return this.request('/menu/tables');
  }

  async createTables(data: { labels: string[] }): Promise<RestaurantTable[]> {
    return this.request('/menu/tables', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTable(id: string, patch: Partial<RestaurantTable>): Promise<RestaurantTable> {
    return this.request(`/menu/tables/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async deleteTable(id: string): Promise<void> {
    await this.request(`/menu/tables/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // Toque Carta — Vista Pública del Cliente
  async getPublicMenu(tableCode: string): Promise<PublicMenuData> {
    return this.request(`/public/menu/${encodeURIComponent(tableCode)}`);
  }

  async createOrder(data: {
    tableCode?: string;
    tableLabel?: string;
    orderType?: OrderType;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    paymentMethod?: string;
    items: Array<{ itemId: string; qty: number; note?: string }>;
    note?: string;
  }): Promise<OrderSlip> {
    return this.request('/pedidos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Toque Carta — Llamar al mozo
  async callWaiter(data: {
    tableCode?: string;
    tableLabel: string;
  }): Promise<WaiterCall> {
    return this.request('/mozo', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listWaiterCalls(): Promise<WaiterCall[]> {
    return this.request('/mozo');
  }

  async dismissWaiterCall(id: string): Promise<void> {
    await this.request(`/mozo/${encodeURIComponent(id)}/dismiss`, {
      method: 'POST',
    });
  }

  // Toque Carta — Reservas
  async createReservation(data: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    peopleCount: number;
    reservationDate: string;
    reservationTime: string;
    note?: string;
  }): Promise<TableReservation> {
    return this.request('/reservas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Toque Carta — Comandas
  async listOrders(filter?: { area?: 'salon' | 'cocina' }): Promise<OrderSlip[]> {
    const params = new URLSearchParams();
    if (filter?.area) params.set('area', filter.area);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/menu/orders${qs}`);
  }

  async setOrderStatus(orderId: string, status: OrderStatus, reason?: string): Promise<OrderSlip> {
    return this.request(`/menu/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  }

  async payOrder(orderId: string): Promise<OrderSlip> {
    return this.request(`/menu/orders/${encodeURIComponent(orderId)}/pay`, {
      method: 'POST',
    });
  }
}

export const httpApi = new HttpApi();

