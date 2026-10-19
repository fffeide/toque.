/**
 * Toque — Módulo Recibo: Mock API en Memoria (mockApi)
 * Cumple estrictamente la Regla de Oro 1: sin Firebase, sin Firestore y sin localStorage como DB.
 * Los datos viven en variables en memoria durante la sesión.
 * Cifras y registros de muestra se rotulan siempre como "Ejemplo".
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

class MockApi {
  // Estado en memoria
  private currentUser: User | null = {
    id: 'user-demo',
    email: 'comercio@toque.ar',
    name: 'Martín Gómez',
    businessId: 'biz-toque-1',
    role: 'owner',
  };

  private businessProfile: BusinessProfile = {
    id: 'biz-toque-1',
    name: 'Café & Panadería La Esquina',
    ownerName: 'Martín Gómez',
    email: 'comercio@toque.ar',
    reviewUrl: 'https://maps.app.goo.gl/3QW2JkmG88pM7example',
    createdAt: new Date().toISOString(),
  };

  // Carteles iniciales: uno activo para la caja y uno sin activar para probar la activación
  private carteles: Cartel[] = [
    {
      id: 'cartel-caja-1',
      code: 'CAJA01',
      pin: '112233',
      businessId: 'biz-toque-1',
      name: 'Caja Principal (Mostrador)',
      role: 'caja',
      status: 'active',
      reviewUrl: 'https://maps.app.goo.gl/3QW2JkmG88pM7example',
      mode: 'hub',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      activatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'cartel-ejemplo-sin-activar',
      code: 'DEMO01',
      pin: 'ABC123', // Cartel de ejemplo para probar activación en menos de 60 segundos
      name: 'Cartel sin activar (Ejemplo)',
      role: 'caja',
      status: 'sin_activar',
      mode: 'hub',
      createdAt: new Date().toISOString(),
    },
  ];

  // Configuración del Hub
  private hubConfig: HubConfig = {
    mode: 'hub',
    blocks: [
      { key: 'receipt', enabled: true },
      { key: 'review', enabled: true },
      { key: 'club', enabled: true },
      { key: 'socials', enabled: true },
      { key: 'products', enabled: true },
      { key: 'details', enabled: true },
    ],
    accentColor: '#3A3FE0', // Ultramar por defecto
    socials: {
      instagram: 'laesquina.cafe',
      whatsapp: '+5491144558899',
    },
    products: [
      {
        id: 'prod-1',
        title: 'Café de Especialidad + Medialuna',
        price: 3800,
        description: 'Tostado natural con manteca artesanal',
      },
      {
        id: 'prod-2',
        title: 'Tostado de Campo Jamón y Queso',
        price: 5200,
        description: 'Pan de masa madre horneado hoy',
      },
    ],
    details: {
      address: 'Av. Corrientes 1450, CABA',
      hours: 'Lunes a Sábado de 07:30 a 20:00 h',
      phone: '+54 11 4371-2233',
    },
    showToqueFooter: true,
  };

  // Club de fidelidad
  private clubConfig: ClubConfig = {
    name: 'Club La Esquina',
    rule: {
      type: 'per_visit',
      value: 1, // 1 sello por cada visita/compra
    },
    rewards: [
      { id: 'rew-1', label: 'Café a elección de regalo', target: 5 },
      { id: 'rew-2', label: 'Desayuno completo para dos', target: 10 },
    ],
    active: true,
  };

  private clubMembers: ClubMember[] = [];

  // Ventas y Recibos en memoria (base limpia sin cobros previos)
  private sales: Sale[] = [];
  private receipts: Receipt[] = [];

  // Mercado Pago
  private mpStatus: MercadoPagoStatus = {
    connected: true, // Conectado en demo para probar QR
    collectorId: 'MP-99482103',
    connectedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  };

  // Intentos fallidos de PIN por código de cartel
  private pinAttempts: Record<string, number> = {};

  // Lotes para fabricante
  private batches: CartelBatch[] = [
    {
      id: 'lote-101',
      count: 2,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      carteles: [
        { code: 'CAJA01', pin: '112233', status: 'active', shortUrl: 'https://toque.ar/h/CAJA01' },
        { code: 'DEMO01', pin: 'ABC123', status: 'sin_activar', shortUrl: 'https://toque.ar/h/DEMO01' },
      ],
    },
  ];

  // Simulación de toques a reseña
  private reviewClicks = 0;

  // --- MÉTODOS DE AUTENTICACIÓN ---

  async register(data: {
    businessName: string;
    ownerName: string;
    email: string;
    password?: string;
  }): Promise<{ user: User; token: string }> {
    const bizId = `biz-${Date.now()}`;
    const user: User = {
      id: `user-${Date.now()}`,
      email: data.email.trim().toLowerCase(),
      name: data.ownerName.trim(),
      businessId: bizId,
      role: 'owner',
    };

    this.currentUser = user;
    this.businessProfile = {
      id: bizId,
      name: data.businessName.trim(),
      ownerName: data.ownerName.trim(),
      email: data.email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    };

    return { user, token: 'mock-jwt-token-register' };
  }

  async login(credentials: {
    email: string;
    password?: string;
    isGoogle?: boolean;
  }): Promise<{ user: User; token: string }> {
    const user: User = {
      id: this.currentUser?.id || 'user-demo',
      email: credentials.email ? credentials.email.trim().toLowerCase() : 'comercio@toque.ar',
      name: credentials.isGoogle ? 'Usuario Google' : (this.currentUser?.name || 'Martín Gómez'),
      businessId: this.businessProfile.id,
      role: 'owner',
    };
    this.currentUser = user;
    return { user, token: 'mock-jwt-token-login' };
  }

  async logout(): Promise<void> {
    this.currentUser = null;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  // --- ACTIVACIÓN DEL CARTEL ---

  async getActivationState(code: string): Promise<{
    found: boolean;
    status?: Cartel['status'];
    requiresPin?: boolean;
    cartel?: Partial<Cartel>;
  }> {
    const cleanCode = code.trim().toUpperCase();
    const cartel = this.carteles.find(c => c.code.toUpperCase() === cleanCode);

    if (!cartel) {
      return { found: false };
    }

    return {
      found: true,
      status: cartel.status,
      requiresPin: cartel.status === 'sin_activar',
      cartel: {
        code: cartel.code,
        name: cartel.name,
        role: cartel.role,
        status: cartel.status,
      },
    };
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
    const cleanCode = data.code.trim().toUpperCase();
    const cleanPin = data.pin.trim().toUpperCase();

    const cartel = this.carteles.find(c => c.code.toUpperCase() === cleanCode);

    if (!cartel) {
      throw new Error('No encontramos un cartel con ese código.');
    }

    if (cartel.status === 'active') {
      throw new Error('Este cartel ya se encuentra activado.');
    }

    // Control de intentos de PIN (máximo 5)
    const attempts = this.pinAttempts[cleanCode] || 0;
    if (attempts >= 5) {
      throw new Error('Superaste los 5 intentos con el PIN. Por seguridad, la activación quedó temporalmente bloqueada.');
    }

    if (cartel.pin.toUpperCase() !== cleanPin) {
      this.pinAttempts[cleanCode] = attempts + 1;
      const restantes = 5 - (attempts + 1);
      throw new Error(`El PIN ingresado es incorrecto. Te quedan ${restantes} intento(s).`);
    }

    // Validación de URL de Google Maps (rechazar redirectores como google.com/url?q=)
    if (!this.isValidGoogleReviewUrl(data.reviewUrl)) {
      throw new Error('El enlace de reseñas debe ser un link válido de Google Maps (g.page, maps.app.goo.gl o google.com/maps).');
    }

    // Activar cartel
    cartel.businessId = this.businessProfile.id;
    cartel.name = data.cartelName.trim() || 'Caja 1';
    cartel.role = data.role;
    cartel.mode = data.mode;
    cartel.reviewUrl = data.reviewUrl.trim();
    cartel.status = 'active';
    cartel.activatedAt = new Date().toISOString();

    // Actualizar perfil de negocio
    if (data.businessName.trim()) {
      this.businessProfile.name = data.businessName.trim();
    }
    this.businessProfile.reviewUrl = data.reviewUrl.trim();

    delete this.pinAttempts[cleanCode];

    return { success: true, cartel };
  }

  private isValidGoogleReviewUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim().toLowerCase();

    // Rechazar redirectores maliciosos
    if (clean.includes('google.com/url?q=') || clean.includes('/url?q=')) {
      return false;
    }

    return (
      clean.includes('g.page/') ||
      clean.includes('maps.app.goo.gl/') ||
      clean.includes('google.com/maps') ||
      clean.includes('goo.gl/maps')
    );
  }

  // --- CARTELES ---

  async listCarteles(): Promise<Cartel[]> {
    return [...this.carteles];
  }

  async updateCartel(
    id: string,
    patch: Partial<Pick<Cartel, 'name' | 'role' | 'status' | 'mode' | 'reviewUrl'>>
  ): Promise<Cartel> {
    const idx = this.carteles.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Cartel no encontrado.');

    this.carteles[idx] = {
      ...this.carteles[idx],
      ...patch,
    };

    return this.carteles[idx];
  }

  // --- HUB DEL NEGOCIO ---

  async getHubConfig(): Promise<HubConfig> {
    return { ...this.hubConfig };
  }

  async updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig> {
    this.hubConfig = {
      ...this.hubConfig,
      ...patch,
    };
    return { ...this.hubConfig };
  }

  // --- HUB PÚBLICO DEL CLIENTE ---

  async getPublicHub(code: string): Promise<PublicHub> {
    const cleanCode = code.trim().toUpperCase();
    const cartel = this.carteles.find(c => c.code.toUpperCase() === cleanCode);

    if (!cartel) {
      throw new Error('Cartel no encontrado.');
    }

    // Registrar escaneo
    cartel.lastScannedAt = new Date().toISOString();

    // Buscar si hay un recibo listo y no vencido (< 3 min) para este cartel
    const now = Date.now();
    const activeReceipt = this.receipts.find(
      r =>
        r.cartelCode.toUpperCase() === cleanCode &&
        r.status === 'ready' &&
        new Date(r.expiresAt).getTime() > now
    );

    return {
      business: {
        id: this.businessProfile.id,
        name: this.businessProfile.name,
      },
      cartel: {
        id: cartel.id,
        code: cartel.code,
        name: cartel.name,
        role: cartel.role,
        status: cartel.status,
      },
      reviewUrl: cartel.reviewUrl || this.businessProfile.reviewUrl || 'https://maps.google.com',
      blocks: this.hubConfig.blocks,
      receipt: activeReceipt || null,
      club: this.clubConfig.active
        ? {
            config: this.clubConfig,
            member: null,
          }
        : null,
      config: this.hubConfig,
    };
  }

  async claimReceipt(id: string): Promise<{ success: boolean; receipt: Receipt }> {
    const receipt = this.receipts.find(r => r.id === id);
    if (!receipt) throw new Error('El comprobante no está disponible o ya venció.');

    receipt.status = 'claimed';
    receipt.claimedAt = new Date().toISOString();

    // Actualizar estado de la venta vinculada
    const sale = this.sales.find(s => s.id === receipt.saleId);
    if (sale) {
      // Marcamos que el cliente ya vio el recibo
    }

    return { success: true, receipt };
  }

  async joinClub(data: {
    cartelCode: string;
    contact: string;
    name?: string;
    consent: boolean;
  }): Promise<{ member: ClubMember; pointsAwarded: number }> {
    if (!data.consent) {
      throw new Error('Para sumarte al Club necesitás aceptar el consentimiento.');
    }

    const cleanContact = data.contact.trim();
    if (!cleanContact || cleanContact.length < 6) {
      throw new Error('Por favor ingresá un número de WhatsApp o correo electrónico válido.');
    }

    let member = this.clubMembers.find(m => m.contact.toLowerCase() === cleanContact.toLowerCase());
    const pointsAwarded = 1;

    if (member) {
      member.points += pointsAwarded;
    } else {
      member = {
        id: `member-${Date.now()}`,
        name: data.name?.trim(),
        contact: cleanContact,
        points: pointsAwarded,
        joinedAt: new Date().toISOString(),
        consent: true,
      };
      this.clubMembers.push(member);
    }

    return { member, pointsAwarded };
  }

  // --- CAJA Y COBROS ---

  async createSale(data: {
    cartelId: string;
    amount: number;
    items?: SaleItem[];
    method: PaymentMethod;
  }): Promise<{ sale: Sale; qrData?: string; receipt?: Receipt }> {
    if (data.amount <= 0) {
      throw new Error('El importe debe ser mayor a cero.');
    }

    const cartel = this.carteles.find(c => c.id === data.cartelId);
    if (!cartel) throw new Error('Caja o cartel no encontrado.');

    const saleId = `sale-${Date.now()}`;
    const isManual = data.method === 'cash' || data.method === 'card_manual';

    const sale: Sale = {
      id: saleId,
      businessId: this.businessProfile.id,
      cartelId: cartel.id,
      cartelName: cartel.name,
      amount: data.amount,
      currency: 'ARS',
      items: data.items && data.items.length > 0 ? data.items : [{ id: 'item-1', name: 'Consumo en mostrador', price: data.amount, quantity: 1 }],
      method: data.method,
      status: isManual ? 'paid' : 'pending',
      createdAt: new Date().toISOString(),
      paidAt: isManual ? new Date().toISOString() : undefined,
      cashierName: this.currentUser?.name || 'Cajero',
    };

    this.sales.unshift(sale);

    // Si es manual, generamos el recibo efímero listo para que el cliente lo reclame al apoyar el celular
    let receipt: Receipt | undefined;
    if (isManual) {
      receipt = this.createEphemeralReceipt(sale, cartel.code);
    }

    // Si es Mercado Pago, devolvemos los datos para el QR
    const qrData = data.method === 'mp_qr'
      ? `00020101021243650016COM.MERCADOPAGO0224toque-cobro-${sale.id}5204000053030325406${data.amount.toFixed(2)}5802AR5915${this.businessProfile.name.slice(0, 15)}6004CABA62070503***6304`
      : undefined;

    return { sale, qrData, receipt };
  }

  private createEphemeralReceipt(sale: Sale, cartelCode: string): Receipt {
    // Vence en 3 minutos exactos
    const expiresAt = new Date(Date.now() + 180000).toISOString();

    const receipt: Receipt = {
      id: `rcp-${Date.now()}`,
      saleId: sale.id,
      businessId: this.businessProfile.id,
      cartelCode: cartelCode,
      status: 'ready',
      expiresAt,
      businessName: this.businessProfile.name,
      items: sale.items,
      total: sale.amount,
      currency: 'ARS',
      method: sale.method,
      createdAt: new Date().toISOString(),
    };

    // Reemplazar recibo previo del cartel si existía
    this.receipts = this.receipts.filter(r => r.cartelCode !== cartelCode);
    this.receipts.unshift(receipt);

    return receipt;
  }

  async getSale(id: string): Promise<Sale> {
    const sale = this.sales.find(s => s.id === id);
    if (!sale) throw new Error('Venta no encontrada.');
    return sale;
  }

  async confirmManualSale(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    const sale = this.sales.find(s => s.id === id);
    if (!sale) throw new Error('Venta no encontrada.');

    sale.status = 'paid';
    sale.paidAt = new Date().toISOString();

    const cartel = this.carteles.find(c => c.id === sale.cartelId);
    const receipt = this.createEphemeralReceipt(sale, cartel ? cartel.code : 'CAJA01');

    return { sale, receipt };
  }

  async simulatePaymentApproved(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    const sale = this.sales.find(s => s.id === id);
    if (!sale) throw new Error('Venta no encontrada.');

    sale.status = 'paid';
    sale.paidAt = new Date().toISOString();

    const cartel = this.carteles.find(c => c.id === sale.cartelId);
    const receipt = this.createEphemeralReceipt(sale, cartel ? cartel.code : 'CAJA01');

    return { sale, receipt };
  }

  async cancelSale(id: string): Promise<Sale> {
    const sale = this.sales.find(s => s.id === id);
    if (!sale) throw new Error('Venta no encontrada.');

    sale.status = 'cancelled';

    // Cancelar recibo asociado si existía
    const rcp = this.receipts.find(r => r.saleId === id);
    if (rcp) {
      rcp.status = 'cancelled';
    }

    return sale;
  }

  async listSales(filters?: {
    dateFrom?: string;
    dateTo?: string;
    method?: PaymentMethod;
    cartelId?: string;
  }): Promise<Sale[]> {
    let list = [...this.sales];

    if (filters?.method) {
      list = list.filter(s => s.method === filters.method);
    }
    if (filters?.cartelId) {
      list = list.filter(s => s.cartelId === filters.cartelId);
    }

    return list;
  }

  // --- CLUB DE FIDELIDAD ---

  async getClubConfig(): Promise<ClubConfig> {
    return { ...this.clubConfig };
  }

  async updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig> {
    this.clubConfig = {
      ...this.clubConfig,
      ...patch,
    };
    return { ...this.clubConfig };
  }

  async listClubMembers(): Promise<ClubMember[]> {
    return [...this.clubMembers];
  }

  async deleteClubMember(id: string): Promise<void> {
    this.clubMembers = this.clubMembers.filter(m => m.id !== id);
  }

  // --- MERCADO PAGO ---

  async getMercadoPagoStatus(): Promise<MercadoPagoStatus> {
    return { ...this.mpStatus };
  }

  async connectMercadoPago(): Promise<{ connected: boolean }> {
    this.mpStatus = {
      connected: true,
      collectorId: `MP-${Math.floor(10000000 + Math.random() * 90000000)}`,
      connectedAt: new Date().toISOString(),
    };
    return { connected: true };
  }

  async disconnectMercadoPago(): Promise<{ connected: boolean }> {
    this.mpStatus = {
      connected: false,
    };
    return { connected: false };
  }

  // --- RESUMEN DEL PANEL ---

  async getDashboardSummary(): Promise<DashboardSummary> {
    // Calculamos según ventas reales en memoria
    const today = new Date().toDateString();
    const todaySales = this.sales.filter(s => s.status === 'paid' && new Date(s.createdAt).toDateString() === today);
    const todaySalesAmount = todaySales.reduce((acc, s) => acc + s.amount, 0);

    const weeklySales = this.sales.filter(s => s.status === 'paid');
    const weeklySalesAmount = weeklySales.reduce((acc, s) => acc + s.amount, 0);

    const claimedReceiptsCount = this.receipts.filter(r => r.status === 'claimed').length;

    return {
      todaySalesAmount,
      todaySalesCount: todaySales.length,
      weeklySalesAmount,
      weeklySalesCount: weeklySales.length,
      myTodaySalesCount: todaySales.length,
      myWeeklySalesCount: weeklySales.length,
      todayClaimedReceiptsCount: claimedReceiptsCount,
      myClaimedReceiptsCount: claimedReceiptsCount,
      totalReceiptsCount: this.receipts.length,
      claimedReceiptsCount,
      newClubMembersCount: this.clubMembers.length,
      clubMembersCount: this.clubMembers.length,
      walletPassesCount: 0,
      scansCount: this.carteles.reduce((acc, c) => acc + (c.scansCount || 0), 0),
      reviewButtonClicks: this.reviewClicks,
      teamMembersCount: 1,
      activeCartelesCount: this.carteles.filter((c) => c.status === 'active').length,
      totalCartelesCount: this.carteles.length,
      recentSales: this.sales.slice(0, 50),
    };
  }

  // --- LOTES DE CARTELES PARA FABRICANTE ---

  async createCartelBatch(data: { count: number }): Promise<CartelBatch> {
    const count = Math.max(1, Math.min(100, data.count));
    const batchId = `lote-${Date.now().toString(36)}`;
    const newCarteles: CartelBatch['carteles'] = [];

    for (let i = 0; i < count; i++) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      const code = `TQ-${randomSuffix}`;
      const pinChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let pin = '';
      for (let p = 0; p < 6; p++) {
        pin += pinChars.charAt(Math.floor(Math.random() * pinChars.length));
      }

      const cartel: Cartel = {
        id: `cartel-${batchId}-${i}`,
        code,
        pin,
        name: `Cartel ${code}`,
        role: 'caja',
        status: 'sin_activar',
        mode: 'hub',
        createdAt: new Date().toISOString(),
        batchId,
      };

      this.carteles.push(cartel);

      newCarteles.push({
        code,
        pin,
        status: 'sin_activar',
        shortUrl: `https://toque.ar/h/${code}`,
      });
    }

    const batch: CartelBatch = {
      id: batchId,
      count,
      createdAt: new Date().toISOString(),
      carteles: newCarteles,
    };

    this.batches.unshift(batch);
    return batch;
  }

  async listCartelBatch(): Promise<CartelBatch[]> {
    return [...this.batches];
  }

  // --- PERFIL DEL NEGOCIO ---

  async getBusinessProfile(): Promise<BusinessProfile> {
    return { ...this.businessProfile };
  }

  async updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile> {
    this.businessProfile = {
      ...this.businessProfile,
      ...patch,
    };
    return { ...this.businessProfile };
  }

  async requestCartelFromManufacturer(data: {
    quantity: number;
    role: CartelRole;
    notes?: string;
  }): Promise<{ success: boolean; requestId: string }> {
    const requestId = `sol-${Date.now()}`;
    return { success: true, requestId };
  }
}

export const mockApi = new MockApi();
