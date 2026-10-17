/**
 * Toque — Módulo Recibo: Contrato de API (ToqueApi)
 * Interfaz que implementan tanto mockApi como httpApi.
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
  CartelBatch,
  BusinessProfile,
  CartelRole,
  HubMode,
  PaymentMethod,
  SaleItem,
} from './types';

export interface ToqueApi {
  // Autenticación
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
  }): Promise<{ user: User; token: string }>;

  logout(): Promise<void>;

  getCurrentUser(): Promise<User | null>;

  // Activación del Cartel
  getActivationState(code: string): Promise<{
    found: boolean;
    status?: Cartel['status'];
    requiresPin?: boolean;
    cartel?: Partial<Cartel>;
  }>;

  activateCartel(data: {
    code: string;
    pin: string;
    businessName: string;
    reviewUrl: string;
    cartelName: string;
    role: CartelRole;
    mode: HubMode;
  }): Promise<{ success: boolean; cartel: Cartel }>;

  // Carteles
  listCarteles(): Promise<Cartel[]>;

  updateCartel(
    id: string,
    patch: Partial<Pick<Cartel, 'name' | 'role' | 'status' | 'mode' | 'reviewUrl'>>
  ): Promise<Cartel>;

  // Hub del Negocio
  getHubConfig(): Promise<HubConfig>;

  updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig>;

  // Hub Público del Cliente
  getPublicHub(code: string): Promise<PublicHub>;

  claimReceipt(id: string): Promise<{ success: boolean; receipt: Receipt }>;

  joinClub(data: {
    cartelCode: string;
    contact: string;
    name?: string;
    consent: boolean;
  }): Promise<{ member: ClubMember; pointsAwarded: number }>;

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

  // Club de Fidelidad
  getClubConfig(): Promise<ClubConfig>;

  updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig>;

  listClubMembers(): Promise<ClubMember[]>;

  deleteClubMember(id: string): Promise<void>;

  // Mercado Pago
  getMercadoPagoStatus(): Promise<MercadoPagoStatus>;

  connectMercadoPago(): Promise<{ connected: boolean }>;

  disconnectMercadoPago(): Promise<{ connected: boolean }>;

  // Resumen del Panel
  getDashboardSummary(): Promise<DashboardSummary>;

  // Lotes para Fabricante
  createCartelBatch(data: { count: number }): Promise<CartelBatch>;

  listCartelBatch(): Promise<CartelBatch[]>;

  // Perfil del Negocio
  getBusinessProfile(): Promise<BusinessProfile>;

  updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile>;

  // Solicitud de cartel al fabricante (si el negocio está asociado a un taller)
  requestCartelFromManufacturer(data: { quantity: number; role: CartelRole; notes?: string }): Promise<{ success: boolean; requestId: string }>;
}
