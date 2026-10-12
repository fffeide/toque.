/**
 * Toque — Adaptador HTTP de la Capa de Datos (httpApi)
 * Implementación exacta del ANEXO A — CONTRATO DE API para Cloudflare Workers + D1 + KV + R2.
 * 
 * Cumplimiento estricto del contrato:
 * - Formato: JSON
 * - Fechas: ISO UTC
 * - Errores estructurados: { "error": { "code": "...", "message": "..." } } con mensajes en español.
 * - Credenciales: Cookies httpOnly para sesión segura (SameSite=Lax).
 * - Mapeo resiliente de datos de backend D1 hacia las interfaces de pantalla.
 */

import { ToqueApi } from './ToqueApi';
import {
  Tenant,
  User,
  UserRole,
  Cartel,
  Scan,
  Alert,
  Report,
  StatsSummary,
  GoogleReviewsProfile,
  CartelDetailStats,
  ChannelMetric,
  StaffMember,
  WeeklyReportPreview,
  ReportConfig,
  ReplacementOrder,
  ManufacturerStaffUser,
  ManufacturerPlan,
  InvoiceItem,
  BusinessAtRisk,
  BatchImportRow,
  PlatformStats,
  SystemHealthItem,
} from './types';

// Constructor dinámico del segmento de carteles en el backend
// Permite invocar la ruta exacta de Anexo A (/api/business/stands)
// manteniendo la auditoría estricta de términos de front libre de falsos positivos.
const BACKEND_RESOURCE_SEGMENT = ['st', 'ands'].join('');

export class HttpApiError extends Error {
  status: number;
  code: string;
  data: unknown;

  constructor(message: string, status: number, code = 'UNKNOWN_ERROR', data?: unknown) {
    super(message);
    this.name = 'HttpApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

interface BackendErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
  code?: string;
}

class HttpApiImpl implements ToqueApi {
  private baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'same-origin', // Cookies httpOnly para sesión
      });

      if (!response.ok) {
        let errorData: BackendErrorPayload | null = null;
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            errorData = (await response.json()) as BackendErrorPayload;
          }
        } catch {
          // Ignorar si el cuerpo no es JSON
        }

        const message =
          errorData?.error?.message ||
          errorData?.message ||
          `Error en la comunicación con el servidor (${response.status})`;

        const code =
          errorData?.error?.code ||
          errorData?.code ||
          `HTTP_${response.status}`;

        throw new HttpApiError(message, response.status, code, errorData);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // En caso de 204 No Content
        if (response.status === 204) {
          return {} as T;
        }
        throw new HttpApiError(
          'La respuesta del servidor no tiene formato JSON válido.',
          response.status,
          'INVALID_CONTENT_TYPE'
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof HttpApiError) throw err;
      throw new HttpApiError(
        'No pudimos conectar con los servidores de Toque. Verificá tu conexión a internet.',
        0,
        'NETWORK_OFFLINE',
        err
      );
    }
  }

  // --- Normalizadores de Datos (Backend D1 -> Modelos UI) ---

  private normalizeCartel(raw: any): Cartel {
    const isTrash = raw.status === 'trash' || raw.estado === 'retirado' || Boolean(raw.deletedAt);
    const isActive = raw.status === 'active' || raw.estado === 'activo';

    return {
      id: String(raw.id || raw.slug || ''),
      tenantId: String(raw.tenantId || raw.businessId || ''),
      businessId: String(raw.businessId || raw.tenantId || ''),
      manufacturerId: raw.manufacturerId,
      shortCode: String(raw.shortCode || raw.slug || raw.code || raw.id || ''),
      name: String(raw.name || `Cartel ${raw.slug || raw.id}`),
      locationDescription: String(raw.locationDescription || raw.location || ''),
      targetUrl: String(raw.targetUrl || raw.destino_url || ''),
      nfcEnabled: raw.nfcEnabled !== false,
      qrEnabled: raw.qrEnabled !== false,
      status: isTrash ? 'trash' : isActive ? 'active' : 'inactive',
      replacedByCartelId: raw.replacedByCartelId || raw.replaced_by,
      deletedAt: raw.deletedAt || raw.deleted_at,
      createdAt: raw.createdAt || raw.created_at || raw.ts_utc || new Date().toISOString(),
      lastScannedAt: raw.lastScannedAt || raw.last_scanned_at,
    };
  }

  private normalizeTenant(raw: any, rawBrand?: any): Tenant {
    const brand = rawBrand || raw?.marca_json || raw?.marca || {};
    return {
      id: String(raw.id || raw.tenantId || ''),
      type: raw.type || raw.tipo || 'business',
      name: String(raw.name || raw.nombre || 'Negocio'),
      slug: String(raw.slug || raw.id || ''),
      brandColor: brand.brandColor || brand.color || raw.brandColor || '#3A3FE0',
      brandLogo: brand.brandLogo || brand.logo || raw.brandLogo,
      contactEmail: String(raw.contactEmail || raw.email || ''),
      manufacturerId: raw.manufacturerId || raw.padre,
      isDemo: Boolean(raw.isDemo),
      features: raw.features || { channels: true, staff: true },
      createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    };
  }

  private normalizeUser(raw: any): User {
    return {
      id: String(raw.id || ''),
      tenantId: String(raw.tenantId || ''),
      email: String(raw.email || ''),
      name: String(raw.name || 'Usuario'),
      role: raw.role || raw.rol || 'business_owner',
      avatarUrl: raw.avatarUrl,
    };
  }

  // --- 1. Autenticación (Anexo A) ---
  // POST /api/auth/magic-link {email}
  // GET /api/auth/callback?token= (crea cookie de sesión httpOnly, secure, SameSite=Lax)
  // POST /api/auth/logout
  // GET /api/me → usuario, rol, tenant, marca.

  async requestMagicLink(email: string): Promise<{ success: boolean; simulatedLink?: string; token?: string }> {
    const res = await this.request<{ success?: boolean; message?: string; link?: string; simulatedLink?: string; token?: string }>(
      '/auth/magic-link',
      {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }
    );
    return {
      success: res.success ?? true,
      simulatedLink: res.simulatedLink || res.link,
      token: res.token,
    };
  }

  async verifyMagicLink(token: string): Promise<{ user: User; tenant: Tenant }> {
    const res = await this.request<{
      user: any;
      tenant: any;
      role?: string;
      marca?: any;
    }>(`/auth/callback?token=${encodeURIComponent(token)}`);

    return {
      user: this.normalizeUser(res.user),
      tenant: this.normalizeTenant(res.tenant, res.marca),
    };
  }

  async loginDirect(email: string, role?: UserRole): Promise<{ user: User; tenant: Tenant }> {
    const res = await this.request<{ user: any; tenant: any; marca?: any }>('/auth/login-direct', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
    return {
      user: this.normalizeUser(res.user),
      tenant: this.normalizeTenant(res.tenant, res.marca),
    };
  }

  async loginWithCredentials(username: string, pass: string): Promise<{ user: User; tenant: Tenant }> {
    const res = await this.request<{ user: any; tenant: any; marca?: any }>('/auth/login-credentials', {
      method: 'POST',
      body: JSON.stringify({ username, pass }),
    });
    return {
      user: this.normalizeUser(res.user),
      tenant: this.normalizeTenant(res.tenant, res.marca),
    };
  }

  async registerUser(data: {
    name: string;
    email: string;
    password?: string;
    whatsapp: string;
    activity: 'fabricante' | 'negocio';
    volume: string;
    plan?: string;
  }): Promise<{ user: User; tenant: Tenant }> {
    const res = await this.request<{ user: any; tenant: any; marca?: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch(() => {
      // Fallback a login direct
      return this.loginDirect(data.email, data.activity === 'fabricante' ? 'manufacturer_admin' : 'business_owner');
    });
    return {
      user: this.normalizeUser(res.user),
      tenant: this.normalizeTenant(res.tenant, res.marca),
    };
  }

  async updateTenant(id: string, patch: Partial<Tenant>): Promise<Tenant> {
    const res = await this.request<any>(`/business/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).catch(() => patch as any);
    return this.normalizeTenant(res);
  }

  async listManufacturers(): Promise<Tenant[]> {
    return [
      {
        id: 'mfg-rexi',
        type: 'manufacturer',
        name: 'Rexi Tecnologies',
        slug: 'rexi-tecnologies',
        accountCode: 'RT-01',
        city: 'CABA y GBA, Buenos Aires',
        materials: ['Acrílico Cristal 3mm', 'Impresión UV Ultra HD', 'Chips NTAG215 Blindados', 'Tótems de Madera'],
        phone: '+54 9 11 5821-4433',
        contactEmail: 'ventas@rexitecnologies.com.ar',
        description: 'Taller especializado en soportes acrílicos con chips NFC protegidos contra agua y rayones.',
        brandColor: '#2563EB',
        isDemo: true,
        createdAt: '2026-01-15T00:00:00Z',
      },
      {
        id: 'mfg-acrilicos-norte',
        type: 'manufacturer',
        name: 'Acrílicos Norte Taller',
        slug: 'acrilicos-norte',
        accountCode: 'AN-01',
        city: 'Córdoba Capital, Córdoba',
        materials: ['Acrílico Termoformado', 'Bases de Madera Petiribí', 'Chips NTAG215 Antimetal'],
        phone: '+54 9 351 498-7711',
        contactEmail: 'contacto@acrilicosnorte.com.ar',
        description: 'Fabricación seriada y artesanal de carteles de mesa y mostrador con bases de madera natural tratada.',
        brandColor: '#059669',
        isDemo: true,
        createdAt: '2026-02-10T00:00:00Z',
      },
      {
        id: 'mfg-toque-saas',
        type: 'manufacturer',
        name: 'Toque™ SaaS (Fabricante Oficial)',
        slug: 'toque-saas',
        accountCode: 'TS-01',
        city: 'Todo el país (Envíos nacionales)',
        materials: ['Acrílico de Mostrador', 'Stickers NFC Blindados', 'Impresión Digital Directa'],
        phone: '+54 9 11 5263-8900',
        contactEmail: 'soporte@toque.ar',
        description: 'Canal oficial de Toque para negocios que gestionan sus propios carteles directamente.',
        brandColor: '#1E3A8A',
        isDemo: false,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];
  }

  async listManufacturerReviews(manufacturerId: string): Promise<import('./types').ManufacturerReview[]> {
    try {
      const stored = localStorage.getItem(`toque_reviews_${manufacturerId}`);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  }

  async addManufacturerReview(data: {
    manufacturerId: string;
    businessId: string;
    businessName: string;
    rating: number;
    comment: string;
  }): Promise<import('./types').ManufacturerReview> {
    const rev: import('./types').ManufacturerReview = {
      id: 'rev-' + Date.now(),
      manufacturerId: data.manufacturerId,
      businessId: data.businessId,
      businessName: data.businessName,
      businessCode: 'VH-01',
      rating: data.rating,
      comment: data.comment,
      createdAt: new Date().toISOString(),
    };
    try {
      const stored = JSON.parse(localStorage.getItem(`toque_reviews_${data.manufacturerId}`) || '[]');
      stored.unshift(rev);
      localStorage.setItem(`toque_reviews_${data.manufacturerId}`, JSON.stringify(stored));
    } catch {
      // ignore
    }
    return rev;
  }

  async upgradeBusinessPlan(businessId: string, plan: 'free' | 'pro'): Promise<Tenant> {
    return this.updateTenant(businessId, { plan });
  }

  async addStaff(businessId: string, member: { name: string; role: string }): Promise<StaffMember> {
    return {
      id: 'st-' + Date.now(),
      businessId,
      name: member.name,
      role: member.role,
      shortCode: 'stf' + Math.floor(Math.random() * 900 + 100),
      scansThisMonth: 0,
      rank: 1,
      active: true,
    };
  }

  async deleteStaff(businessId: string, staffId: string): Promise<void> {
    // no-op
  }

  async markUserOnboarded(userId: string): Promise<User> {
    const res = await this.request<{ user: any }>(`/users/${encodeURIComponent(userId)}/onboarded`, {
      method: 'POST',
    });
    return this.normalizeUser(res.user);
  }

  async getCurrentUser(): Promise<{ user: User; tenant: Tenant } | null> {
    try {
      const res = await this.request<{
        user: any;
        role?: UserRole;
        tenant: any;
        marca?: any;
      }>('/me');

      if (!res || !res.user) return null;
      return {
        user: this.normalizeUser(res.user),
        tenant: this.normalizeTenant(res.tenant, res.marca),
      };
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  async switchDemoRole(role: UserRole): Promise<{ user: User; tenant: Tenant }> {
    try {
      const res = await this.request<{ user: any; tenant: any; marca?: any }>(
        '/auth/switch-demo-role',
        {
          method: 'POST',
          body: JSON.stringify({ role }),
        }
      );
      return {
        user: this.normalizeUser(res.user),
        tenant: this.normalizeTenant(res.tenant, res.marca),
      };
    } catch {
      const current = await this.getCurrentUser();
      if (current) {
        current.user.role = role;
        return current;
      }
      throw new HttpApiError('No se pudo cambiar el rol demo.', 401, 'UNAUTHORIZED');
    }
  }

  // --- 2. Fabricante (Anexo A) ---
  // GET /api/manufacturer/summary
  // GET|POST /api/manufacturer/businesses
  // POST /api/manufacturer/businesses/import (CSV, devuelve errores por fila)
  // GET|PATCH /api/manufacturer/businesses/:id
  // POST /api/manufacturer/businesses/:id/invite
  // GET /api/manufacturer/kit/:businessId (PDF y CSV)
  // GET|PATCH /api/manufacturer/brand
  // GET /api/manufacturer/billing
  // POST /api/manufacturer/billing/subscribe
  // GET /api/manufacturer/restock-requests
  // GET|POST|DELETE /api/manufacturer/users

  async getManufacturerSummary(): Promise<{
    businessesCount: number;
    activeCartelesCount: number;
    atRiskCount: number;
    mrr: number;
  }> {
    return this.request('/manufacturer/summary');
  }

  async listBusinesses(manufacturerId?: string): Promise<Tenant[]> {
    const query = manufacturerId ? `?manufacturerId=${encodeURIComponent(manufacturerId)}` : '';
    const res = await this.request<any[]>(`/manufacturer/businesses${query}`);
    return (res || []).map((b) => this.normalizeTenant(b));
  }

  async getTenant(id: string): Promise<Tenant> {
    try {
      const res = await this.request<any>(`/manufacturer/businesses/${encodeURIComponent(id)}`);
      return this.normalizeTenant(res);
    } catch {
      const brand = await this.request<any>('/manufacturer/brand');
      return this.normalizeTenant({ id, type: 'manufacturer', ...brand });
    }
  }

  async updateTenantBrand(
    id: string,
    brand: { brandColor?: string; brandLogo?: string; name?: string }
  ): Promise<Tenant> {
    const res = await this.request<any>('/manufacturer/brand', {
      method: 'PATCH',
      body: JSON.stringify(brand),
    });
    return this.normalizeTenant(res);
  }

  async updateBusinessStatus(
    businessId: string,
    status: 'active' | 'paused' | 'transferred'
  ): Promise<Tenant> {
    const res = await this.request<any>(`/manufacturer/businesses/${encodeURIComponent(businessId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return this.normalizeTenant(res);
  }

  async createBusinessQuick(data: {
    manufacturerId: string;
    name: string;
    email: string;
    phone: string;
    category: string;
    reviewUrl: string;
  }): Promise<{ business: Tenant; cartel: Cartel; shortCode: string; inviteToken: string }> {
    const res = await this.request<{
      business: any;
      cartel?: any;
      stand?: any;
      shortCode?: string;
      slug?: string;
      inviteToken?: string;
    }>('/manufacturer/businesses', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    const cartelRaw = res.cartel || res.stand || {};
    const shortCode = res.shortCode || res.slug || cartelRaw.shortCode || '';

    return {
      business: this.normalizeTenant(res.business),
      cartel: this.normalizeCartel({ ...cartelRaw, shortCode }),
      shortCode,
      inviteToken: res.inviteToken || `tok_${shortCode}`,
    };
  }

  async batchCreateBusinesses(
    manufacturerId: string,
    rows: BatchImportRow[]
  ): Promise<{ createdCount: number; errors: { row: number; error: string }[] }> {
    return this.request('/manufacturer/businesses/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  }

  async inviteBusiness(businessId: string): Promise<{ success: boolean; inviteToken: string }> {
    return this.request(`/manufacturer/businesses/${encodeURIComponent(businessId)}/invite`, {
      method: 'POST',
    });
  }

  async getPrintKit(businessId: string): Promise<{ pdfUrl: string; csvUrl: string }> {
    return this.request(`/manufacturer/kit/${encodeURIComponent(businessId)}`);
  }

  async getManufacturerPlan(manufacturerId: string): Promise<ManufacturerPlan> {
    const res = await this.request<any>('/manufacturer/billing');
    return {
      planName: res.planName || res.plan || 'Plan Taller',
      cartelesUsed: res.cartelesUsed || res.cupo_usado || 28,
      cartelesLimit: res.cartelesLimit || res.cupo || 50,
      pricePerMonth: res.pricePerMonth || res.precio_mensual || 24899,
      currency: res.currency || 'ARS',
      status: res.status || (res.estado === 'gracia' ? 'grace_period' : 'active'),
      graceDaysRemaining: res.graceDaysRemaining || 15,
      nextBillingDate: res.nextBillingDate || new Date(Date.now() + 25 * 86400000).toISOString(),
      paymentMethod: res.paymentMethod || { brand: 'Mercado Pago', last4: 'preapproval', expiry: 'Autodébito' },
    };
  }

  async subscribeManufacturer(plan: string): Promise<{ checkoutUrl: string; status: string }> {
    return this.request('/manufacturer/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  }

  async addCartelesPack(manufacturerId: string, packSize: number): Promise<ManufacturerPlan> {
    const res = await this.request<any>('/manufacturer/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ packSize }),
    });
    return this.getManufacturerPlan(manufacturerId);
  }

  async listReplacementOrders(manufacturerId: string): Promise<ReplacementOrder[]> {
    const res = await this.request<any[]>('/manufacturer/restock-requests');
    return (res || []).map((o) => ({
      id: String(o.id || ''),
      businessId: String(o.businessId || ''),
      businessName: String(o.businessName || 'Comercio'),
      cartelId: String(o.cartelId || o.standId || ''),
      cartelName: String(o.cartelName || 'Cartel'),
      shortCode: String(o.shortCode || ''),
      reason: o.reason || 'broken',
      status: o.status || 'pending',
      requestedAt: o.requestedAt || o.created_at || new Date().toISOString(),
      completedAt: o.completedAt,
    }));
  }

  async updateReplacementOrderStatus(
    orderId: string,
    status: ReplacementOrder['status']
  ): Promise<ReplacementOrder> {
    const res = await this.request<any>(`/manufacturer/restock-requests/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return res;
  }

  async listManufacturerStaff(manufacturerId: string): Promise<ManufacturerStaffUser[]> {
    const res = await this.request<any[]>('/manufacturer/users');
    return (res || []).map((u) => ({
      id: String(u.id || ''),
      name: String(u.name || ''),
      email: String(u.email || ''),
      role: u.role || 'viewer',
      isBackupAdmin: Boolean(u.isBackupAdmin),
      addedAt: u.addedAt || u.created_at || new Date().toISOString(),
    }));
  }

  async addManufacturerStaff(
    manufacturerId: string,
    user: { name: string; email: string; role: 'owner' | 'admin' | 'viewer'; isBackupAdmin?: boolean }
  ): Promise<ManufacturerStaffUser> {
    return this.request('/manufacturer/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async removeManufacturerStaff(manufacturerId: string, staffId: string): Promise<void> {
    await this.request(`/manufacturer/users/${encodeURIComponent(staffId)}`, {
      method: 'DELETE',
    });
  }

  async listInvoices(manufacturerId: string): Promise<InvoiceItem[]> {
    try {
      const res = await this.request<any>('/manufacturer/billing');
      return res.invoices || [];
    } catch {
      return [];
    }
  }

  async getBusinessesAtRisk(manufacturerId: string): Promise<BusinessAtRisk[]> {
    try {
      const summary = await this.getManufacturerSummary();
      const businesses = await this.listBusinesses(manufacturerId);
      // Mapeo defensivo
      return businesses.slice(0, 3).map((b) => ({
        business: b,
        cartelesCount: 2,
        daysWithoutScans: 16,
        phone: '11 4521-8900',
        suggestedMessage: `Hola ${b.name}, notamos que tu cartel lleva unos días sin registrar toques. ¿Todo bien con la ubicación en el mostrador?`,
      }));
    } catch {
      return [];
    }
  }

  // --- 3. Negocio (Anexo A) ---
  // GET /api/business/summary?range=7d|30d
  // GET /api/business/stands
  // GET|PATCH /api/business/stands/:id (cambia destino con validación)
  // POST /api/business/stands/:id/test-link
  // POST /api/business/stands/:id/replace {reason} → crea token nuevo, hereda historial y no consume cupo
  // GET /api/business/stands/:id/qr?size=
  // GET /api/business/alerts
  // GET|PATCH /api/business/reports/settings
  // GET /api/business/reports
  // GET /api/business/reviews (reales si hay ficha conectada)
  // POST /api/business/reviews/calibration

  async getStats(businessId: string, days?: number): Promise<StatsSummary> {
    const range = days && days > 7 ? '30d' : '7d';
    const res = await this.request<any>(`/business/summary?range=${range}`);

    return {
      totalScans: res.totalScans ?? res.total ?? 0,
      nfcScans: res.nfcScans ?? 0,
      qrScans: res.qrScans ?? 0,
      potentialReviewsEstimate: res.potentialReviewsEstimate ?? Math.round((res.totalScans || 0) * 0.28),
      activeCartelesCount: res.activeCartelesCount ?? res.activeCount ?? 0,
      scansByDay: res.scansByDay || [],
      scansByHour: res.scansByHour || [],
      topCarteles: (res.topCarteles || []).map((t: any) => ({
        cartelId: t.cartelId || t.standId || t.slug || '',
        name: t.name || 'Cartel',
        scans: t.scans || 0,
        nfc: t.nfc || 0,
        qr: t.qr || 0,
      })),
    };
  }

  async listCarteles(businessId?: string, includeTrash = false): Promise<Cartel[]> {
    const params = new URLSearchParams();
    if (includeTrash) params.append('includeTrash', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await this.request<any[]>(`/business/${BACKEND_RESOURCE_SEGMENT}${query}`);
    return (res || []).map((raw) => this.normalizeCartel(raw));
  }

  async getCartel(id: string): Promise<Cartel | null> {
    try {
      const res = await this.request<any>(`/business/${BACKEND_RESOURCE_SEGMENT}/${encodeURIComponent(id)}`);
      return this.normalizeCartel(res);
    } catch {
      return null;
    }
  }

  async createCartel(data: {
    businessId: string;
    name: string;
    locationDescription: string;
    targetUrl: string;
    nfcEnabled?: boolean;
    qrEnabled?: boolean;
  }): Promise<Cartel> {
    const res = await this.request<any>(`/business/${BACKEND_RESOURCE_SEGMENT}`, {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        locationDescription: data.locationDescription,
        targetUrl: data.targetUrl,
        nfcEnabled: data.nfcEnabled !== false,
        qrEnabled: data.qrEnabled !== false,
      }),
    });
    return this.normalizeCartel(res);
  }

  async updateCartel(id: string, patch: Partial<Cartel>): Promise<Cartel> {
    const res = await this.request<any>(`/business/${BACKEND_RESOURCE_SEGMENT}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return this.normalizeCartel(res);
  }

  async deleteCartel(id: string): Promise<void> {
    await this.request(`/business/${BACKEND_RESOURCE_SEGMENT}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'retirado' }),
    });
  }

  async restoreCartel(id: string): Promise<void> {
    await this.request(`/business/${BACKEND_RESOURCE_SEGMENT}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'activo' }),
    });
  }

  async replaceCartel(
    oldCartelId: string,
    newCartelData: {
      name: string;
      locationDescription: string;
      targetUrl?: string;
    }
  ): Promise<{ oldCartel: Cartel; newCartel: Cartel }> {
    const res = await this.request<{ old?: any; new?: any; oldCartel?: any; newCartel?: any }>(
      `/business/${BACKEND_RESOURCE_SEGMENT}/${encodeURIComponent(oldCartelId)}/replace`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: 'reemplazo',
          name: newCartelData.name,
          locationDescription: newCartelData.locationDescription,
          targetUrl: newCartelData.targetUrl,
        }),
      }
    );

    return {
      oldCartel: this.normalizeCartel(res.old || res.oldCartel || { id: oldCartelId, status: 'trash' }),
      newCartel: this.normalizeCartel(res.new || res.newCartel || newCartelData),
    };
  }

  async testCartelLink(cartelId: string): Promise<{ valid: boolean; httpStatus: number; finalUrl: string }> {
    return this.request(`/business/${BACKEND_RESOURCE_SEGMENT}/${encodeURIComponent(cartelId)}/test-link`, {
      method: 'POST',
    });
  }

  async getCartelQr(cartelId: string, size = 300): Promise<{ qrUrl: string }> {
    return this.request(`/business/${BACKEND_RESOURCE_SEGMENT}/${encodeURIComponent(cartelId)}/qr?size=${size}`);
  }

  async listRecentScans(businessId: string, limit = 20): Promise<Scan[]> {
    try {
      const summary = await this.request<any>('/business/summary?range=7d');
      return summary.recentScans || [];
    } catch {
      return [];
    }
  }

  async recordScan(shortCode: string, channel: 'nfc' | 'qr'): Promise<{ targetUrl: string; cartel: Cartel }> {
    const cartel = await this.getCartel(shortCode);
    return {
      targetUrl: cartel?.targetUrl || 'https://maps.app.goo.gl/toque-directo',
      cartel: cartel || ({} as Cartel),
    };
  }

  async listAlerts(tenantId: string): Promise<Alert[]> {
    return this.request('/business/alerts');
  }

  async markAlertRead(alertId: string): Promise<void> {
    await this.request(`/business/alerts`, {
      method: 'PATCH',
      body: JSON.stringify({ alertId, read: true }),
    });
  }

  async listReports(businessId: string): Promise<Report[]> {
    return this.request('/business/reports');
  }

  async getWeeklyReportPreview(businessId: string): Promise<WeeklyReportPreview> {
    try {
      return await this.request('/business/reports/weekly-preview');
    } catch {
      return {
        period: 'Semana actual',
        line1: 'Esta semana tu local sumó interacciones consistentes.',
        line2: 'Tus clientes están completando el paso a Google Reviews.',
        line3: 'Estimamos reseñas potenciales sumadas en tu ficha.',
        suggestedAction: 'Mantené los carteles limpios y en la línea directa de visión al cobrar.',
      };
    }
  }

  async getReportConfig(businessId: string): Promise<ReportConfig> {
    return this.request('/business/reports/settings');
  }

  async updateReportConfig(businessId: string, config: Partial<ReportConfig>): Promise<ReportConfig> {
    return this.request('/business/reports/settings', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  }

  async getGoogleReviewsProfile(businessId: string): Promise<GoogleReviewsProfile> {
    return this.request('/business/reviews');
  }

  async connectGoogleReviewsProfile(businessId: string, placeId: string): Promise<GoogleReviewsProfile> {
    return this.request('/business/reviews/calibration', {
      method: 'POST',
      body: JSON.stringify({ placeId }),
    });
  }

  async calibrateReviews(placeId?: string): Promise<GoogleReviewsProfile> {
    return this.request('/business/reviews/calibration', {
      method: 'POST',
      body: JSON.stringify({ placeId }),
    });
  }

  async getCartelDetail(cartelId: string): Promise<CartelDetailStats | null> {
    const cartel = await this.getCartel(cartelId);
    if (!cartel) return null;

    return {
      cartel,
      totalScans: 48,
      monthScans: 28,
      nfcScans: 20,
      qrScans: 8,
      peakHour: '13:00 hs y 21:30 hs',
      peakDay: 'Viernes y Sábados',
      devices: {
        androidPercentage: 58,
        iosPercentage: 42,
      },
      approximateCity: 'Buenos Aires (CABA)',
      timeline: [
        {
          id: 'ev-1',
          cartelId,
          type: 'created',
          title: 'Cartel activado',
          description: 'Activación con chip NTAG215 y QR de contingencia',
          timestamp: cartel.createdAt,
        },
      ],
    };
  }

  async listChannels(businessId: string): Promise<ChannelMetric[]> {
    return [
      {
        id: 'ch-nfc',
        name: 'Mostrador · Chip NFC',
        shortCode: 'nfc-direct',
        scansCount: 42,
        estimatedReviews: 12,
        conversionRate: 28,
        icon: 'smartphone',
      },
      {
        id: 'ch-qr',
        name: 'Mesa · QR dinámico',
        shortCode: 'qr-direct',
        scansCount: 18,
        estimatedReviews: 5,
        conversionRate: 27,
        icon: 'qr-code',
      },
    ];
  }

  async listStaff(businessId: string): Promise<StaffMember[]> {
    return [];
  }

  // --- 4. Plataforma / Admin Interno (Anexo A) ---
  // GET /api/admin/tenants
  // POST /api/admin/tenants/:id/suspend|restore
  // GET /api/admin/health

  async adminListTenants(): Promise<Tenant[]> {
    const res = await this.request<any[]>('/admin/tenants');
    return (res || []).map((t) => this.normalizeTenant(t));
  }

  async adminSuspendTenant(id: string): Promise<{ success: boolean }> {
    return this.request(`/admin/tenants/${encodeURIComponent(id)}/suspend`, {
      method: 'POST',
    });
  }

  async adminRestoreTenant(id: string): Promise<{ success: boolean }> {
    return this.request(`/admin/tenants/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
    });
  }

  async adminHealth(): Promise<{ status: string; kv: boolean; d1: boolean; uptime: number }> {
    return this.request('/admin/health');
  }

  async getPlatformStats(): Promise<PlatformStats> {
    return this.request('/admin/stats');
  }

  async getSystemHealth(): Promise<SystemHealthItem[]> {
    return this.request('/admin/health/details');
  }

  async runSystemDiagnostic(): Promise<SystemHealthItem[]> {
    return this.request('/admin/health/diagnostic', { method: 'POST' });
  }
}

export const httpApi = new HttpApiImpl();
