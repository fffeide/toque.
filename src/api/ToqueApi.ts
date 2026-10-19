/**
 * Toque — Contrato de API en Tiempo Real con RLS (ToqueApi)
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
  // Autenticación y Sesión RLS
  register(data: {
    businessName: string;
    ownerName: string;
    email: string;
    password?: string;
  }): Promise<{ user: User; token: string }>;

  login(credentials: {
    email: string;
    password?: string;
    isGoogle?: boolean;
    requirePasswordVerification?: boolean;
  }): Promise<{ user: User; token: string }>;

  logout(): Promise<void>;

  getCurrentUser(): Promise<User | null>;

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

  // Hub del Negocio
  getHubConfig(): Promise<HubConfig>;

  updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig>;

  // Hub Público del Cliente y Recibos en Tiempo Real
  getPublicHub(code: string): Promise<PublicHub>;

  subscribeToCartelHub(
    code: string,
    onUpdate: (hub: PublicHub) => void
  ): () => void;

  getReceiptById(receiptId: string): Promise<Receipt | null>;

  subscribeToReceipt(
    receiptId: string,
    onUpdate: (receipt: Receipt | null) => void
  ): () => void;

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

  // Caja y Cobros en Tiempo Real
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

  // Club de Fidelidad
  getClubConfig(): Promise<ClubConfig>;

  updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig>;

  listClubMembers(): Promise<ClubMember[]>;

  exportClubMembersCsv(): Promise<string>;

  deleteClubMember(id: string): Promise<void>;

  // Equipo y Colaboradores (RLS)
  listTeamMembers(): Promise<TeamMember[]>;

  addTeamMember(data: {
    name: string;
    email?: string;
    role: 'owner' | 'manager' | 'cashier';
    assignedCartelId?: string;
  }): Promise<TeamMember>;

  updateTeamMember(
    id: string,
    patch: Partial<Pick<TeamMember, 'name' | 'role' | 'assignedCartelId' | 'status'>>
  ): Promise<TeamMember>;

  removeTeamMember(id: string): Promise<void>;

  // Red Toque y Formatos de Activación (Estilo Pasito)
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

  // Bóveda del Consumidor ("Mi Toque") — Sincronización Híbrida localStorage + D1 + Firestore
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

  // Mercado Pago
  getMercadoPagoStatus(): Promise<MercadoPagoStatus>;

  connectMercadoPago(): Promise<{ connected: boolean }>;

  disconnectMercadoPago(): Promise<{ connected: boolean }>;

  // Resumen del Panel (Datos 100% Reales)
  getDashboardSummary(): Promise<DashboardSummary>;

  // Perfil del Negocio
  getBusinessProfile(): Promise<BusinessProfile>;

  updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile>;

  // Super Admin Global (Datos 100% Reales de toda la plataforma)
  getSuperAdminSummary(): Promise<SuperAdminSummary>;
}
