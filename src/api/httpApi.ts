/**
 * Toque — Módulo Recibo: Cliente HTTP REST (httpApi)
 * Cumple estrictamente la Regla de Oro 1:
 * - Realiza peticiones a /api/...
 * - Envía credentials: 'include'
 * - Maneja errores estructurados con la forma { error: { code, message } }
 */

import { ToqueApi } from './ToqueApi';
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

interface ApiErrorResponse {
  error?: {
    code: string;
    message: string;
  };
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
        // Fallback si no es JSON
      }

      const errorMessage = errBody?.error?.message || `Error en la solicitud (${response.status})`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Autenticación
  async register(data: {
    businessName: string;
    ownerName: string;
    email: string;
    password?: string;
  }): Promise<{ user: User; token: string }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(credentials: {
    email: string;
    password?: string;
    isGoogle?: boolean;
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

  // Activación
  async getActivationState(code: string): Promise<{
    found: boolean;
    status?: Cartel['status'];
    requiresPin?: boolean;
    cartel?: Partial<Cartel>;
  }> {
    return this.request(`/carteles/activation-state?code=${encodeURIComponent(code)}`);
  }

  async activateCartel(data: {
    code: string;
    pin: string;
    businessName: string;
    reviewUrl: string;
    cartelName: string;
    role: CartelRole;
    mode: HubMode;
  }): Promise<{ success: boolean; cartel: Cartel }> {
    return this.request('/carteles/activate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Carteles
  async listCarteles(): Promise<Cartel[]> {
    return this.request('/carteles');
  }

  async updateCartel(
    id: string,
    patch: Partial<Pick<Cartel, 'name' | 'role' | 'status' | 'mode' | 'reviewUrl'>>
  ): Promise<Cartel> {
    return this.request(`/carteles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // Hub del Negocio
  async getHubConfig(): Promise<HubConfig> {
    return this.request('/hub/config');
  }

  async updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig> {
    return this.request('/hub/config', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // Hub Público del Cliente
  async getPublicHub(code: string): Promise<PublicHub> {
    return this.request(`/public/hub/${encodeURIComponent(code)}`);
  }

  async claimReceipt(id: string): Promise<{ success: boolean; receipt: Receipt }> {
    return this.request(`/receipts/${id}/claim`, { method: 'POST' });
  }

  async joinClub(data: {
    cartelCode: string;
    contact: string;
    name?: string;
    consent: boolean;
  }): Promise<{ member: ClubMember; pointsAwarded: number }> {
    return this.request('/club/join', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Caja y Cobros
  async createSale(data: {
    cartelId: string;
    amount: number;
    items?: SaleItem[];
    method: PaymentMethod;
  }): Promise<{ sale: Sale; qrData?: string; receipt?: Receipt }> {
    return this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSale(id: string): Promise<Sale> {
    return this.request(`/sales/${id}`);
  }

  async confirmManualSale(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    return this.request(`/sales/${id}/confirm-manual`, { method: 'POST' });
  }

  async simulatePaymentApproved(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    return this.request(`/sales/${id}/simulate-approval`, { method: 'POST' });
  }

  async cancelSale(id: string): Promise<Sale> {
    return this.request(`/sales/${id}/cancel`, { method: 'POST' });
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

  // Club de Fidelidad
  async getClubConfig(): Promise<ClubConfig> {
    return this.request('/club/config');
  }

  async updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig> {
    return this.request('/club/config', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async listClubMembers(): Promise<ClubMember[]> {
    return this.request('/club/members');
  }

  async deleteClubMember(id: string): Promise<void> {
    await this.request(`/club/members/${id}`, { method: 'DELETE' });
  }

  // Mercado Pago
  async getMercadoPagoStatus(): Promise<MercadoPagoStatus> {
    return this.request('/integrations/mercadopago/status');
  }

  async connectMercadoPago(): Promise<{ connected: boolean }> {
    return this.request('/integrations/mercadopago/connect', { method: 'POST' });
  }

  async disconnectMercadoPago(): Promise<{ connected: boolean }> {
    return this.request('/integrations/mercadopago/disconnect', { method: 'POST' });
  }

  // Resumen del Panel
  async getDashboardSummary(): Promise<DashboardSummary> {
    return this.request('/dashboard/summary');
  }

  // Lotes para Fabricante
  async createCartelBatch(data: { count: number }): Promise<CartelBatch> {
    return this.request('/admin/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listCartelBatch(): Promise<CartelBatch[]> {
    return this.request('/admin/batches');
  }

  // Perfil del Negocio
  async getBusinessProfile(): Promise<BusinessProfile> {
    return this.request('/business/profile');
  }

  async updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile> {
    return this.request('/business/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async requestCartelFromManufacturer(data: {
    quantity: number;
    role: CartelRole;
    notes?: string;
  }): Promise<{ success: boolean; requestId: string }> {
    return this.request('/carteles/request-from-manufacturer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const httpApi = new HttpApi();
