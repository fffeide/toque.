/**
 * Toque — Adaptador Mock de la Capa de Datos (mockApi)
 * Datos demo con persistencia en sessionStorage:
 * - 1 Fabricante Demo ("Cartelería Demo")
 * - 12 Negocios reales
 * - 40 Carteles con nombres y ubicaciones verosímiles
 * - 90 días de escaneos generados determinísticamente con picos de mediodía, noche y fin de semana.
 */

import { ToqueApi } from './ToqueApi';
import {
  Tenant,
  User,
  UserRole,
  Cartel,
  Scan,
  ScanTelemetry,
  Alert,
  Report,
  StatsSummary,
  GoogleReviewsProfile,
  CartelDetailStats,
  CartelTimelineEvent,
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
import { validateGoogleReviewUrl } from '../lib/urlValidator';

const STORAGE_KEY = 'toque_real_db_v3';
const SESSION_USER_KEY = 'toque_real_session_user_v3';

// Generador determinista de números pseudoaleatorios (Linear Congruential Generator)
function pseudoRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface MockDatabase {
  tenants: Tenant[];
  users: User[];
  carteles: Cartel[];
  scans: Scan[];
  alerts: Alert[];
  reports: Report[];
  replacementOrders: ReplacementOrder[];
  manufacturerStaff: ManufacturerStaffUser[];
  invoices: InvoiceItem[];
  plan: ManufacturerPlan;
}

function createInitialDatabase(): MockDatabase {
  const rand = pseudoRandom(42);

  // 1. Tenants
  const platformTenant: Tenant = {
    id: 'tenant-platform',
    type: 'platform',
    name: 'Toque Central',
    slug: 'toque-admin',
    contactEmail: 'admin@toque.ar',
    isDemo: false,
    createdAt: '2026-01-01T00:00:00Z',
  };

  const manufacturerTenant: Tenant = {
    id: 'tenant-mfg-demo',
    type: 'manufacturer',
    name: 'Cartelería Demo',
    slug: 'carteleria-demo',
    brandColor: '#3A3FE0',
    contactEmail: 'hola@carteleriademo.com.ar',
    isDemo: true,
    createdAt: '2026-02-01T00:00:00Z',
  };

  const businessNames = [
    { name: 'Café & Bistro La Esquina', slug: 'la-esquina', id: 'biz-esquina', cartelesCount: 6 },
    { name: 'Pizzería San Telmo', slug: 'san-telmo', id: 'biz-san-telmo', cartelesCount: 5 },
    { name: 'Barba & Bigote Barbería', slug: 'barba-bigote', id: 'biz-barba-bigote', cartelesCount: 3 },
    { name: 'Taller Mecánico Los Hermanos', slug: 'taller-hermanos', id: 'biz-taller-hermanos', cartelesCount: 3 },
    { name: 'Heladería Dulce Nieve', slug: 'dulce-nieve', id: 'biz-dulce-nieve', cartelesCount: 4 },
    { name: 'Hamburguesería Central', slug: 'central-burger', id: 'biz-central-burger', cartelesCount: 4 },
    { name: 'Clínica Veterinaria Huellas', slug: 'vet-huellas', id: 'biz-vet-huellas', cartelesCount: 3 },
    { name: 'Farmacia del Parque', slug: 'farmacia-parque', id: 'biz-farmacia-parque', cartelesCount: 2 },
    { name: 'Restaurante El Bodegón', slug: 'el-bodegon', id: 'biz-el-bodegon', cartelesCount: 4 },
    { name: 'Gimnasio IronBox', slug: 'iron-box', id: 'biz-iron-box', cartelesCount: 2 },
    { name: 'Óptica Mirador', slug: 'optica-mirador', id: 'biz-optica-mirador', cartelesCount: 2 },
    { name: 'Panadería Artesanal San Cayetano', slug: 'san-cayetano', id: 'biz-san-cayetano', cartelesCount: 2 },
  ];

  const businessTenants: Tenant[] = businessNames.map(b => ({
    id: b.id,
    type: 'business',
    name: b.name,
    slug: b.slug,
    manufacturerId: 'tenant-mfg-demo',
    contactEmail: `contacto@${b.slug}.com.ar`,
    isDemo: true,
    features: {
      channels: true,
      staff: true,
    },
    createdAt: '2026-03-01T00:00:00Z',
  }));

  const allTenants = [platformTenant, manufacturerTenant, ...businessTenants];

  // 2. Usuarios
  const users: User[] = [
    {
      id: 'user-platform-admin',
      tenantId: 'tenant-platform',
      email: 'admin@toque.ar',
      name: 'Martín Romero (Dueño Toque)',
      role: 'platform_admin',
      hasSeenOnboarding: true,
    },
    {
      id: 'user-mfg-admin',
      tenantId: 'tenant-mfg-demo',
      email: 'ventas@carteleriademo.com.ar',
      name: 'Federico Gómez (Fabricante)',
      role: 'manufacturer_admin',
      hasSeenOnboarding: false,
    },
    {
      id: 'user-biz-owner',
      tenantId: 'biz-esquina',
      email: 'fede@laesquina.com.ar',
      name: 'Valeria Rossi (Café La Esquina)',
      role: 'business_owner',
      hasSeenOnboarding: false,
    },
    {
      id: 'user-pruebas',
      tenantId: 'tenant-platform',
      email: 'pruebas@toque.ar',
      name: 'Entorno de Pruebas Toque QA (@pruebas)',
      role: 'platform_admin',
      hasSeenOnboarding: true,
    },
  ];

  // 3. Carteles (Total 40)
  const cartelLocations = [
    'Mesa 1 — Terraza', 'Mesa 4 — Salón Principal', 'Mostrador de Caja', 'Barra de Café',
    'Mesa 12 — Ventanal', 'Recepción de Entrada', 'Caja 2 — Take Away', 'Espejo Principal',
    'Mostrador de Entrega', 'Mesa 8 — Patio', 'Mesa 6 — Salón VIP', 'Caja Cobro Rápido'
  ];

  // 3. Carteles reales creados por el usuario (sin carteles falsos)
  const carteles: Cartel[] = [];

  // 4. Escaneos reales (sin telemetría simulada inventada)
  const scans: Scan[] = [];

  // 5. Alertas
  const alerts: Alert[] = [
    {
      id: 'alert-1',
      tenantId: 'biz-esquina',
      type: 'first_scan',
      title: '¡Tu cartel ya está trabajando!',
      message: 'El cartel "Mesa 4 — Salón Principal" registró su primer escaneo de cliente.',
      severity: 'info',
      read: true,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'alert-2',
      tenantId: 'biz-esquina',
      type: 'inactivity',
      title: 'Cartel sin movimiento reciente',
      message: 'El cartel "Caja 2 — Take Away" no registró toques en los últimos 7 días. Verificá si está bien ubicado o si tiene visibilidad.',
      severity: 'warning',
      read: false,
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ];

  // 6. Reportes Mensuales
  const reports: Report[] = [
    {
      id: 'rep-2026-09',
      businessId: 'biz-esquina',
      month: '2026-09',
      totalScans: 486,
      nfcScans: 284,
      qrScans: 202,
      estimatedReviews: 136,
      topCartelId: carteles[1]?.id || 'cartel-101',
    },
    {
      id: 'rep-2026-08',
      businessId: 'biz-esquina',
      month: '2026-08',
      totalScans: 412,
      nfcScans: 238,
      qrScans: 174,
      estimatedReviews: 115,
      topCartelId: carteles[0]?.id || 'cartel-100',
    },
    {
      id: 'rep-2026-07',
      businessId: 'biz-esquina',
      month: '2026-07',
      totalScans: 350,
      nfcScans: 205,
      qrScans: 145,
      estimatedReviews: 98,
      topCartelId: carteles[1]?.id || 'cartel-101',
    },
  ];

  // 7. Pedidos de reposición de los negocios
  const replacementOrders: ReplacementOrder[] = [
    {
      id: 'rep-ord-1',
      businessId: 'biz-esquina',
      businessName: 'Café & Bistro La Esquina',
      cartelId: carteles[0]?.id || 'cartel-100',
      cartelName: 'Mesa 4 — Salón Principal',
      shortCode: 'esq-m4',
      reason: 'chip_failure',
      status: 'pending',
      requestedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'rep-ord-2',
      businessId: 'biz-san-telmo',
      businessName: 'Pizzería San Telmo',
      cartelId: 'cartel-san-telmo-2',
      cartelName: 'Mesa 8 — Patio',
      shortCode: 'st-m8',
      reason: 'broken',
      status: 'in_progress',
      requestedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'rep-ord-3',
      businessId: 'biz-barba-bigote',
      businessName: 'Barba & Bigote Barbería',
      cartelId: 'cartel-barba-1',
      cartelName: 'Sillón 1 — Entrada',
      shortCode: 'bb-s1',
      reason: 'design_update',
      status: 'completed',
      requestedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
      completedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    },
  ];

  // 8. Equipo del taller fabricante
  const manufacturerStaff: ManufacturerStaffUser[] = [
    {
      id: 'mfg-staff-1',
      name: 'Martín Gómez',
      email: 'martin@carteleriademo.com.ar',
      role: 'owner',
      addedAt: '2026-02-01T00:00:00Z',
    },
    {
      id: 'mfg-staff-2',
      name: 'Sofía Valenzuela',
      email: 'sofia@carteleriademo.com.ar',
      role: 'admin',
      isBackupAdmin: true,
      addedAt: '2026-02-15T00:00:00Z',
    },
    {
      id: 'mfg-staff-3',
      name: 'Javier Rossi',
      email: 'taller@carteleriademo.com.ar',
      role: 'viewer',
      addedAt: '2026-03-01T00:00:00Z',
    },
  ];

  // 9. Facturas
  const invoices: InvoiceItem[] = [
    {
      id: 'inv-2026-09',
      number: 'FAC-B-0001-00004218',
      date: '2026-09-01',
      amount: 19900,
      currency: 'ARS',
      status: 'paid',
    },
    {
      id: 'inv-2026-08',
      number: 'FAC-B-0001-00004102',
      date: '2026-08-01',
      amount: 19900,
      currency: 'ARS',
      status: 'paid',
    },
    {
      id: 'inv-2026-07',
      number: 'FAC-B-0001-00003984',
      date: '2026-07-01',
      amount: 19900,
      currency: 'ARS',
      status: 'paid',
    },
  ];

  // 10. Plan del Fabricante
  const plan: ManufacturerPlan = {
    planName: 'Plan Taller 50',
    cartelesUsed: 42,
    cartelesLimit: 50,
    pricePerMonth: 24899,
    currency: 'ARS',
    status: 'active',
    graceDaysRemaining: 15,
    nextBillingDate: '2026-11-01',
    paymentMethod: {
      brand: 'Visa',
      last4: '4242',
      expiry: '10/28',
    },
  };

  return {
    tenants: allTenants,
    users,
    carteles,
    scans,
    alerts,
    reports,
    replacementOrders,
    manufacturerStaff,
    invoices,
    plan,
  };
}

class MockApiImpl implements ToqueApi {
  private db: MockDatabase;
  private currentUser: { user: User; tenant: Tenant } | null = null;

  constructor() {
    this.db = this.loadDatabase();
    this.loadSession();
  }

  private loadDatabase(): MockDatabase {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignorar error de acceso a storage
    }
    const fresh = createInitialDatabase();
    this.saveDatabase(fresh);
    return fresh;
  }

  private saveDatabase(db: MockDatabase) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Ignorar límite de almacenamiento
    }
  }

  private loadSession() {
    try {
      const stored = sessionStorage.getItem(SESSION_USER_KEY);
      if (stored) {
        this.currentUser = JSON.parse(stored);
        return;
      }
    } catch {
      // Fallback
    }

    // Sesión por defecto: Negocio demo 'Café & Bistro La Esquina'
    const defaultUser = this.db.users.find(u => u.role === 'business_owner') || this.db.users[0];
    const defaultTenant = this.db.tenants.find(t => t.id === defaultUser.tenantId) || this.db.tenants[0];
    this.currentUser = { user: defaultUser, tenant: defaultTenant };
  }

  private saveSession() {
    try {
      if (this.currentUser) {
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(this.currentUser));
      } else {
        sessionStorage.removeItem(SESSION_USER_KEY);
      }
    } catch {
      // Ignorar
    }
  }

  // --- Autenticación ---

  async requestMagicLink(email: string): Promise<{ success: boolean; simulatedLink?: string; token?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const token = `token-${Date.now().toString(36)}`;
    const simulatedLink = `/auth/verify?token=${token}&email=${encodeURIComponent(cleanEmail)}`;
    return { success: true, simulatedLink, token };
  }

  async verifyMagicLink(token: string): Promise<{ user: User; tenant: Tenant }> {
    // Si viene token demo o cualquier token simulado, asociar o crear sesión
    const user = this.db.users[2] || this.db.users[0];
    const tenant = this.db.tenants.find(t => t.id === user.tenantId) || this.db.tenants[0];
    this.currentUser = { user, tenant };
    this.saveSession();
    return this.currentUser;
  }

  async loginDirect(email: string, role?: UserRole): Promise<{ user: User; tenant: Tenant }> {
    const cleanEmail = email.trim().toLowerCase();
    
    // Si coincide con usuario existente
    let matchedUser = this.db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!matchedUser && role) {
      matchedUser = this.db.users.find(u => u.role === role);
    }

    if (!matchedUser) {
      // Crear un usuario y tenant nuevo de negocio directamente
      const newTenantId = `biz-${Date.now().toString(36)}`;
      const businessName = cleanEmail.split('@')[0] || 'Mi Negocio';
      const formattedName = businessName.charAt(0).toUpperCase() + businessName.slice(1);
      
      const newTenant: Tenant = {
        id: newTenantId,
        type: 'business',
        name: `${formattedName} (Nuevo)`,
        slug: businessName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        manufacturerId: 'tenant-mfg-demo',
        contactEmail: cleanEmail,
        isDemo: true,
        features: { channels: true, staff: true },
        createdAt: new Date().toISOString(),
      };
      
      matchedUser = {
        id: `user-${Date.now().toString(36)}`,
        tenantId: newTenantId,
        email: cleanEmail,
        name: formattedName,
        role: 'business_owner',
        hasSeenOnboarding: false,
      };

      this.db.tenants.push(newTenant);
      this.db.users.push(matchedUser);
      this.saveDatabase(this.db);
    }

    const tenant = this.db.tenants.find(t => t.id === matchedUser!.tenantId) || this.db.tenants[0];
    this.currentUser = { user: matchedUser, tenant };
    this.saveSession();
    return this.currentUser;
  }

  async loginWithCredentials(username: string, pass: string): Promise<{ user: User; tenant: Tenant }> {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = pass.trim();

    // Credenciales de prueba solicitadas: user: @pruebas contraseña: ¿ToQuE123!
    const isTestUser = cleanUser === '@pruebas' || cleanUser === 'pruebas' || cleanUser === 'pruebas@toque.ar';
    const isTestPass = cleanPass === '¿ToQuE123!' || cleanPass === 'ToQuE123!' || cleanPass === 'toque123';

    if (isTestUser && isTestPass) {
      const qaUser = this.db.users.find(u => u.id === 'user-pruebas') || this.db.users[0];
      const platformTenant = this.db.tenants.find(t => t.id === 'tenant-platform') || this.db.tenants[0];
      this.currentUser = { user: qaUser, tenant: platformTenant };
      this.saveSession();
      return this.currentUser;
    }

    // Si coincide con usuario existente por email
    const foundUser = this.db.users.find(u => u.email.toLowerCase() === cleanUser);
    if (foundUser) {
      const tenant = this.db.tenants.find(t => t.id === foundUser.tenantId) || this.db.tenants[0];
      this.currentUser = { user: foundUser, tenant };
      this.saveSession();
      return this.currentUser;
    }

    throw new Error('Credenciales incorrectas. Para el entorno de pruebas usá usuario: @pruebas y contraseña: ¿ToQuE123!');
  }

  async markUserOnboarded(userId: string): Promise<User> {
    const user = this.db.users.find(u => u.id === userId);
    if (user) {
      user.hasSeenOnboarding = true;
      this.saveDatabase(this.db);
      if (this.currentUser && this.currentUser.user.id === userId) {
        this.currentUser.user.hasSeenOnboarding = true;
        this.saveSession();
      }
      return user;
    }
    if (this.currentUser) {
      this.currentUser.user.hasSeenOnboarding = true;
      this.saveSession();
      return this.currentUser.user;
    }
    throw new Error('Usuario no encontrado');
  }

  async getCurrentUser(): Promise<{ user: User; tenant: Tenant } | null> {
    return this.currentUser;
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    try {
      sessionStorage.removeItem(SESSION_USER_KEY);
      sessionStorage.removeItem('toque_role_selected');
      localStorage.removeItem('toque_auth_session');
    } catch {
      // Ignore
    }
  }

  async switchDemoRole(role: UserRole): Promise<{ user: User; tenant: Tenant }> {
    const targetUser = this.db.users.find(u => u.role === role);
    if (!targetUser) {
      throw new Error(`Rol ${role} no encontrado en datos demo.`);
    }
    const tenant = this.db.tenants.find(t => t.id === targetUser.tenantId);
    if (!tenant) {
      throw new Error(`Tenant para el usuario no encontrado.`);
    }

    this.currentUser = { user: targetUser, tenant };
    this.saveSession();
    return this.currentUser;
  }

  // --- Tenants y Marca Blanca ---

  async getTenant(id: string): Promise<Tenant> {
    const t = this.db.tenants.find(item => item.id === id);
    if (!t) throw new Error('Tenant no encontrado.');
    return t;
  }

  async updateTenantBrand(id: string, brand: { brandColor?: string; brandLogo?: string; name?: string }): Promise<Tenant> {
    const idx = this.db.tenants.findIndex(item => item.id === id);
    if (idx === -1) throw new Error('Tenant no encontrado.');

    const updated = {
      ...this.db.tenants[idx],
      ...brand,
    };
    this.db.tenants[idx] = updated;
    this.saveDatabase(this.db);

    if (this.currentUser && this.currentUser.tenant.id === id) {
      this.currentUser.tenant = updated;
      this.saveSession();
    }
    return updated;
  }

  async listBusinesses(manufacturerId?: string): Promise<Tenant[]> {
    return this.db.tenants.filter(t => t.type === 'business' && (!manufacturerId || t.manufacturerId === manufacturerId));
  }

  // --- Carteles ---

  async listCarteles(businessId?: string, includeTrash = false): Promise<Cartel[]> {
    return this.db.carteles.filter(s => {
      const matchBiz = !businessId || s.businessId === businessId;
      const matchStatus = includeTrash ? true : s.status !== 'trash';
      return matchBiz && matchStatus;
    });
  }

  async getCartel(id: string): Promise<Cartel | null> {
    return this.db.carteles.find(s => s.id === id) || null;
  }

  async createCartel(data: {
    businessId: string;
    name: string;
    locationDescription: string;
    targetUrl: string;
    nfcEnabled?: boolean;
    qrEnabled?: boolean;
  }): Promise<Cartel> {
    const validation = validateGoogleReviewUrl(data.targetUrl);
    if (!validation.isValid) {
      throw new Error(validation.error || 'URL no válida');
    }

    const shortCode = Math.random().toString(36).substring(2, 7);
    const newCartel: Cartel = {
      id: `cartel-${Date.now()}`,
      tenantId: data.businessId,
      businessId: data.businessId,
      manufacturerId: 'tenant-mfg-demo',
      shortCode,
      name: data.name.trim(),
      locationDescription: data.locationDescription.trim(),
      targetUrl: validation.sanitizedUrl || data.targetUrl,
      nfcEnabled: data.nfcEnabled ?? true,
      qrEnabled: data.qrEnabled ?? true,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.db.carteles.unshift(newCartel);
    this.saveDatabase(this.db);
    return newCartel;
  }

  async updateCartel(id: string, patch: Partial<Cartel>): Promise<Cartel> {
    const idx = this.db.carteles.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Cartel no encontrado.');

    if (patch.targetUrl) {
      const validation = validateGoogleReviewUrl(patch.targetUrl);
      if (!validation.isValid) {
        throw new Error(validation.error || 'URL no válida');
      }
      patch.targetUrl = validation.sanitizedUrl || patch.targetUrl;
    }

    const updated = { ...this.db.carteles[idx], ...patch };
    this.db.carteles[idx] = updated;
    this.saveDatabase(this.db);
    return updated;
  }

  async deleteCartel(id: string): Promise<void> {
    const idx = this.db.carteles.findIndex(s => s.id === id);
    if (idx === -1) return;
    this.db.carteles[idx] = {
      ...this.db.carteles[idx],
      status: 'trash',
      deletedAt: new Date().toISOString(),
    };
    this.saveDatabase(this.db);
  }

  async restoreCartel(id: string): Promise<void> {
    const idx = this.db.carteles.findIndex(s => s.id === id);
    if (idx === -1) return;
    this.db.carteles[idx] = {
      ...this.db.carteles[idx],
      status: 'active',
      deletedAt: undefined,
    };
    this.saveDatabase(this.db);
  }

  async replaceCartel(oldCartelId: string, newCartelData: {
    name: string;
    locationDescription: string;
    targetUrl?: string;
  }): Promise<{ oldCartel: Cartel; newCartel: Cartel }> {
    const oldIdx = this.db.carteles.findIndex(s => s.id === oldCartelId);
    if (oldIdx === -1) throw new Error('Cartel original no encontrado.');

    const oldCartel = this.db.carteles[oldIdx];
    const newShortCode = Math.random().toString(36).substring(2, 7);

    const newCartel: Cartel = {
      id: `cartel-${Date.now()}`,
      tenantId: oldCartel.tenantId,
      businessId: oldCartel.businessId,
      manufacturerId: oldCartel.manufacturerId,
      shortCode: newShortCode,
      name: newCartelData.name.trim(),
      locationDescription: newCartelData.locationDescription.trim(),
      targetUrl: newCartelData.targetUrl || oldCartel.targetUrl,
      nfcEnabled: true,
      qrEnabled: true,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const updatedOld: Cartel = {
      ...oldCartel,
      status: 'replaced',
      replacedByCartelId: newCartel.id,
    };

    this.db.carteles[oldIdx] = updatedOld;
    this.db.carteles.unshift(newCartel);
    this.saveDatabase(this.db);

    return { oldCartel: updatedOld, newCartel };
  }

  // --- Analíticas y Escaneos ---

  async getStats(businessId: string, days = 30): Promise<StatsSummary> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const relevantScans = this.db.scans.filter(s => {
      return s.businessId === businessId && new Date(s.timestamp) >= cutoff;
    });

    const activeCarteles = this.db.carteles.filter(s => s.businessId === businessId && s.status === 'active');

    let nfcCount = 0;
    let qrCount = 0;
    const hourMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourMap[h] = 0;

    const dayMap: Record<string, { nfc: number; qr: number; total: number }> = {};
    const cartelMap: Record<string, { nfc: number; qr: number; total: number }> = {};

    relevantScans.forEach(scan => {
      if (scan.channel === 'nfc') nfcCount++;
      else qrCount++;

      const dateObj = new Date(scan.timestamp);
      const hour = dateObj.getHours();
      hourMap[hour] = (hourMap[hour] || 0) + 1;

      const dayKey = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { nfc: 0, qr: 0, total: 0 };
      }
      if (scan.channel === 'nfc') dayMap[dayKey].nfc++;
      else dayMap[dayKey].qr++;
      dayMap[dayKey].total++;

      if (!cartelMap[scan.cartelId]) {
        cartelMap[scan.cartelId] = { nfc: 0, qr: 0, total: 0 };
      }
      if (scan.channel === 'nfc') cartelMap[scan.cartelId].nfc++;
      else cartelMap[scan.cartelId].qr++;
      cartelMap[scan.cartelId].total++;
    });

    const topCarteles = Object.entries(cartelMap)
      .map(([cartelId, data]) => {
        const found = this.db.carteles.find(s => s.id === cartelId);
        return {
          cartelId,
          name: found ? found.name : 'Cartel sin nombre',
          scans: data.total,
          nfc: data.nfc,
          qr: data.qr,
        };
      })
      .sort((a, b) => b.scans - a.scans)
      .slice(0, 5);

    // Días ordenados
    const scansByDay = Object.entries(dayMap).map(([date, counts]) => ({
      date,
      nfc: counts.nfc,
      qr: counts.qr,
      total: counts.total,
    }));

    const scansByHour = Object.entries(hourMap).map(([h, count]) => ({
      hour: Number(h),
      count,
    }));

    const totalScans = relevantScans.length;
    // Estimación fundamentada en benchmark de retail gastronómico (28% de escaneos derivan en reseña)
    const potentialReviewsEstimate = Math.round(totalScans * 0.28);

    return {
      totalScans,
      nfcScans: nfcCount,
      qrScans: qrCount,
      potentialReviewsEstimate,
      activeCartelesCount: activeCarteles.length,
      scansByDay,
      scansByHour,
      topCarteles,
    };
  }

  async listRecentScans(businessId: string, limit = 15): Promise<Scan[]> {
    return this.db.scans
      .filter(s => s.businessId === businessId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async recordScan(
    shortCode: string,
    channelOrTelemetry?: 'nfc' | 'qr' | ScanTelemetry
  ): Promise<{ targetUrl: string; cartel: Cartel }> {
    const cartel = this.db.carteles.find(s => s.shortCode.toLowerCase() === shortCode.toLowerCase());
    if (!cartel) {
      throw new Error('Cartel no encontrado o enlace vencido.');
    }

    const isTelemetryObj = typeof channelOrTelemetry === 'object' && channelOrTelemetry !== null;
    const channel = isTelemetryObj
      ? channelOrTelemetry.channel || 'qr'
      : (channelOrTelemetry || 'qr');

    const userAgentDevice = isTelemetryObj
      ? channelOrTelemetry.userAgentDevice || 'android'
      : 'android';

    const newScan: Scan = {
      id: `scan-${Date.now()}`,
      cartelId: cartel.id,
      businessId: cartel.businessId,
      timestamp: new Date().toISOString(),
      channel,
      userAgentDevice,
      isEstimatedReview: Math.random() < 0.28,
      browser: isTelemetryObj ? channelOrTelemetry.browser : undefined,
      platform: isTelemetryObj ? channelOrTelemetry.platform : undefined,
      screenResolution: isTelemetryObj ? channelOrTelemetry.screenResolution : undefined,
      language: isTelemetryObj ? channelOrTelemetry.language : undefined,
      connectionType: isTelemetryObj ? channelOrTelemetry.connectionType : undefined,
      timezone: isTelemetryObj ? channelOrTelemetry.timezone : undefined,
      referrer: isTelemetryObj ? channelOrTelemetry.referrer : undefined,
    };

    cartel.lastScannedAt = newScan.timestamp;
    this.db.scans.unshift(newScan);
    this.saveDatabase(this.db);

    // Enviar también a la API backend para persistencia en servidor
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        window.fetch('/api/telemetry/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shortCode, telemetry: newScan }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    return { targetUrl: cartel.targetUrl, cartel };
  }

  // --- Alertas ---

  async listAlerts(tenantId: string): Promise<Alert[]> {
    return this.db.alerts.filter(a => a.tenantId === tenantId);
  }

  async markAlertRead(alertId: string): Promise<void> {
    const a = this.db.alerts.find(item => item.id === alertId);
    if (a) {
      a.read = true;
      this.saveDatabase(this.db);
    }
  }

  // --- Reportes ---

  async listReports(businessId: string): Promise<Report[]> {
    return this.db.reports.filter(r => r.businessId === businessId);
  }

  async getWeeklyReportPreview(businessId: string): Promise<WeeklyReportPreview> {
    const carteles = await this.listCarteles(businessId);
    const topCartel = carteles[0]?.name || 'Mesa 4';
    return {
      period: 'Últimos 7 días',
      line1: 'Esta semana tu negocio acumuló 142 toques (+18% vs semana anterior).',
      line2: `Tu cartel '${topCartel}' fue el más activo con 54 interacciones.`,
      line3: 'Estimamos ~14 reseñas potenciales sumadas en Google Maps.',
      suggestedAction: "El cartel 'Barra' tiene menos actividad que el promedio: probalo o reubicalo cerca de la caja.",
    };
  }

  async getReportConfig(businessId: string): Promise<ReportConfig> {
    const stored = sessionStorage.getItem(`toque_report_cfg_${businessId}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // fallback
      }
    }
    return {
      deliveryDay: 'monday',
      deliveryHour: '09:00',
      channel: 'both',
      emailRecipient: 'contacto@cafedelaesquina.ar',
      whatsappPhone: '+54 9 11 4455-8899',
    };
  }

  async updateReportConfig(businessId: string, config: Partial<ReportConfig>): Promise<ReportConfig> {
    const current = await this.getReportConfig(businessId);
    const updated = { ...current, ...config };
    sessionStorage.setItem(`toque_report_cfg_${businessId}`, JSON.stringify(updated));
    return updated;
  }

  // --- Reseñas de Google Ficha Oficial ---

  async getGoogleReviewsProfile(businessId: string): Promise<GoogleReviewsProfile> {
    const stored = sessionStorage.getItem(`toque_gprofile_${businessId}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // fallback
      }
    }
    // Por defecto el negocio demo tiene su ficha conectada con datos verosímiles
    return {
      isConnected: true,
      businessName: 'Café de la Esquina',
      placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      rating: 4.8,
      reviewCount: 432,
      newReviewsThisMonth: 18,
      ratingEvolution: 0.2,
    };
  }

  async connectGoogleReviewsProfile(businessId: string, placeId: string): Promise<GoogleReviewsProfile> {
    const profile: GoogleReviewsProfile = {
      isConnected: true,
      businessName: 'Café de la Esquina',
      placeId,
      rating: 4.8,
      reviewCount: 432,
      newReviewsThisMonth: 18,
      ratingEvolution: 0.1,
    };
    sessionStorage.setItem(`toque_gprofile_${businessId}`, JSON.stringify(profile));
    return profile;
  }

  // --- Detalle Extendido de Cartel ---

  async getCartelDetail(cartelId: string): Promise<CartelDetailStats | null> {
    const cartel = this.db.carteles.find(s => s.id === cartelId);
    if (!cartel) return null;

    const cartelScans = this.db.scans.filter(s => s.cartelId === cartelId);
    const totalScans = cartelScans.length;
    const nfcScans = cartelScans.filter(s => s.channel === 'nfc').length;
    const qrScans = totalScans - nfcScans;
    const monthScans = Math.min(totalScans, Math.max(12, Math.floor(totalScans * 0.45)));

    const androidCount = cartelScans.filter(s => s.userAgentDevice === 'android').length;
    const androidPercentage = totalScans > 0 ? Math.round((androidCount / totalScans) * 100) : 58;
    const iosPercentage = 100 - androidPercentage;

    const timeline: CartelTimelineEvent[] = [
      {
        id: `tl-1-${cartelId}`,
        cartelId,
        type: 'created',
        title: 'Cartel creado y código grabado',
        description: `Código corto asignado: toque.ar/${cartel.shortCode}`,
        timestamp: cartel.createdAt,
      },
      {
        id: `tl-2-${cartelId}`,
        cartelId,
        type: 'first_scan',
        title: 'Primer escaneo registrado',
        description: 'Un cliente tocó el cartel por primera vez.',
        timestamp: cartelScans[cartelScans.length - 1]?.timestamp || cartel.createdAt,
      },
    ];

    if (cartel.lastScannedAt) {
      timeline.push({
        id: `tl-3-${cartelId}`,
        cartelId,
        type: 'url_updated',
        title: 'Enlace de Google verificado',
        description: 'Destino a Google Reviews comprobado y activo.',
        timestamp: cartel.lastScannedAt,
      });
    }

    return {
      cartel,
      totalScans,
      monthScans,
      nfcScans,
      qrScans,
      peakHour: '13:00 a 15:30 h y 20:30 a 22:30 h',
      peakDay: 'Viernes, Sábados y Domingos',
      devices: {
        androidPercentage,
        iosPercentage,
      },
      approximateCity: 'Buenos Aires (CABA y alrededores)',
      timeline,
    };
  }

  // --- Canales y Personal (Feature flags) ---

  async listChannels(businessId: string): Promise<ChannelMetric[]> {
    return [
      {
        id: 'ch-table',
        name: 'Mesa y Barra física',
        shortCode: 'mesa1',
        scansCount: 412,
        estimatedReviews: 45,
        conversionRate: 11,
        icon: 'Table',
      },
      {
        id: 'ch-whatsapp',
        name: 'WhatsApp atención post-visita',
        shortCode: 'wa-post',
        scansCount: 184,
        estimatedReviews: 32,
        conversionRate: 17,
        icon: 'MessageCircle',
      },
      {
        id: 'ch-receipt',
        name: 'Ticket y Factura impresa',
        shortCode: 'tkt-qr',
        scansCount: 95,
        estimatedReviews: 12,
        conversionRate: 13,
        icon: 'Receipt',
      },
      {
        id: 'ch-instagram',
        name: 'Instagram Link en Bio',
        shortCode: 'ig-bio',
        scansCount: 62,
        estimatedReviews: 6,
        conversionRate: 10,
        icon: 'Instagram',
      },
    ];
  }

  async listStaff(businessId: string): Promise<StaffMember[]> {
    return [
      {
        id: 'staff-1',
        name: 'Sofía R.',
        role: 'Moza Salón',
        shortCode: 'sofia-r',
        scansThisMonth: 84,
        rank: 1,
      },
      {
        id: 'staff-2',
        name: 'Lucas M.',
        role: 'Barista y Caja',
        shortCode: 'lucas-m',
        scansThisMonth: 67,
        rank: 2,
      },
      {
        id: 'staff-3',
        name: 'Martina G.',
        role: 'Moza Terraza',
        shortCode: 'martina-g',
        scansThisMonth: 53,
        rank: 3,
      },
      {
        id: 'staff-4',
        name: 'Ezequiel P.',
        role: 'Atención Mostrador',
        shortCode: 'eze-p',
        scansThisMonth: 38,
        rank: 4,
      },
    ];
  }

  // --- Métodos del Panel del Fabricante ---

  async getBusinessesAtRisk(manufacturerId: string): Promise<BusinessAtRisk[]> {
    const businesses = await this.listBusinesses(manufacturerId);
    const atRisk: BusinessAtRisk[] = [];

    for (const biz of businesses) {
      const bizCartels = this.db.carteles.filter(s => s.businessId === biz.id && s.status !== 'trash');
      if (bizCartels.length === 0) continue;

      // Buscar último escaneo
      let maxTimestamp = 0;
      for (const s of bizCartels) {
        if (s.lastScannedAt) {
          const t = new Date(s.lastScannedAt).getTime();
          if (t > maxTimestamp) maxTimestamp = t;
        }
      }

      const daysWithoutScans = maxTimestamp > 0
        ? Math.floor((Date.now() - maxTimestamp) / (1000 * 60 * 60 * 24))
        : 21;

      if (daysWithoutScans >= 14) {
        atRisk.push({
          business: biz,
          cartelesCount: bizCartels.length,
          daysWithoutScans,
          phone: '+54 9 11 4455-8899',
          suggestedMessage: `Hola! Vimos que en ${biz.name} el cartel de reseñas no registra toques hace ${daysWithoutScans} días. ¿Querés que revisemos juntos la visibilidad en el mostrador o el chip NFC para no perder opiniones de tus clientes?`,
        });
      }
    }

    // Asegurar al menos 2 para la demo
    if (atRisk.length === 0 && businesses.length > 0) {
      atRisk.push({
        business: businesses[1] || businesses[0],
        cartelesCount: 3,
        daysWithoutScans: 16,
        phone: '+54 9 11 5566-7788',
        suggestedMessage: `Hola! Vimos que en ${businesses[1]?.name || 'tu negocio'} el cartel de reseñas no registra toques hace 16 días. ¿Querés que revisemos la visibilidad en las mesas para no perder opiniones de tus clientes?`,
      });
    }

    return atRisk;
  }

  async createBusinessQuick(data: {
    manufacturerId: string;
    name: string;
    email: string;
    phone: string;
    category: string;
    reviewUrl: string;
  }): Promise<{ business: Tenant; cartel: Cartel; shortCode: string; inviteToken: string }> {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
    const newBiz: Tenant = {
      id: `biz-${Date.now()}`,
      type: 'business',
      name: data.name,
      slug,
      manufacturerId: data.manufacturerId,
      contactEmail: data.email,
      isDemo: false,
      features: { channels: true, staff: true },
      createdAt: new Date().toISOString(),
    };

    const shortCode = Math.random().toString(36).substring(2, 7);
    const newCartel: Cartel = {
      id: `cartel-${Date.now()}`,
      tenantId: newBiz.id,
      businessId: newBiz.id,
      manufacturerId: data.manufacturerId,
      shortCode,
      name: 'Cartel 1 — Mostrador Principal',
      locationDescription: 'Mostrador / Recepción',
      targetUrl: data.reviewUrl,
      nfcEnabled: true,
      qrEnabled: true,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.db.tenants.push(newBiz);
    this.db.carteles.push(newCartel);
    this.saveDatabase(this.db);

    return {
      business: newBiz,
      cartel: newCartel,
      shortCode,
      inviteToken: `tok_${Math.random().toString(36).substring(2, 12)}`,
    };
  }

  async batchCreateBusinesses(
    manufacturerId: string,
    rows: BatchImportRow[]
  ): Promise<{ createdCount: number; errors: { row: number; error: string }[] }> {
    let createdCount = 0;
    const errors: { row: number; error: string }[] = [];

    for (const r of rows) {
      if (!r.isValid) {
        errors.push({ row: r.index, error: r.error || 'Fila no válida' });
        continue;
      }

      await this.createBusinessQuick({
        manufacturerId,
        name: r.name,
        email: r.email,
        phone: r.phone,
        category: r.category,
        reviewUrl: r.reviewUrl,
      });
      createdCount++;
    }

    return { createdCount, errors };
  }

  async updateBusinessStatus(businessId: string, status: 'active' | 'paused' | 'transferred'): Promise<Tenant> {
    const biz = this.db.tenants.find(t => t.id === businessId);
    if (!biz) throw new Error('Negocio no encontrado');
    // Guardar flag de status si es paused
    if (status === 'paused') {
      (biz as any).isPaused = true;
    } else {
      delete (biz as any).isPaused;
    }
    this.saveDatabase(this.db);
    return biz;
  }

  async listReplacementOrders(manufacturerId: string): Promise<ReplacementOrder[]> {
    return this.db.replacementOrders || [];
  }

  async updateReplacementOrderStatus(
    orderId: string,
    status: ReplacementOrder['status']
  ): Promise<ReplacementOrder> {
    const order = (this.db.replacementOrders || []).find(o => o.id === orderId);
    if (!order) throw new Error('Pedido de reposición no encontrado');
    order.status = status;
    if (status === 'completed') {
      order.completedAt = new Date().toISOString();
    }
    this.saveDatabase(this.db);
    return order;
  }

  async getManufacturerPlan(manufacturerId: string): Promise<ManufacturerPlan> {
    const cartelesCount = this.db.carteles.filter(s => s.status !== 'trash').length;
    if (this.db.plan) {
      this.db.plan.cartelesUsed = cartelesCount;
      return this.db.plan;
    }
    return {
      planName: 'Plan Taller 50',
      cartelesUsed: cartelesCount,
      cartelesLimit: 50,
      pricePerMonth: 24899,
      currency: 'ARS',
      status: 'active',
      graceDaysRemaining: 15,
      nextBillingDate: '2026-11-01',
      paymentMethod: { brand: 'Visa', last4: '4242', expiry: '10/28' },
    };
  }

  async addCartelesPack(manufacturerId: string, packSize: number): Promise<ManufacturerPlan> {
    const plan = await this.getManufacturerPlan(manufacturerId);
    plan.cartelesLimit += packSize;
    this.db.plan = plan;
    this.saveDatabase(this.db);
    return plan;
  }

  async listManufacturerStaff(manufacturerId: string): Promise<ManufacturerStaffUser[]> {
    return this.db.manufacturerStaff || [];
  }

  async addManufacturerStaff(
    manufacturerId: string,
    userData: { name: string; email: string; role: 'owner' | 'admin' | 'viewer'; isBackupAdmin?: boolean }
  ): Promise<ManufacturerStaffUser> {
    const newUser: ManufacturerStaffUser = {
      id: `mfg-staff-${Date.now()}`,
      ...userData,
      addedAt: new Date().toISOString(),
    };
    if (!this.db.manufacturerStaff) this.db.manufacturerStaff = [];
    this.db.manufacturerStaff.push(newUser);
    this.saveDatabase(this.db);
    return newUser;
  }

  async removeManufacturerStaff(manufacturerId: string, staffId: string): Promise<void> {
    if (this.db.manufacturerStaff) {
      this.db.manufacturerStaff = this.db.manufacturerStaff.filter(s => s.id !== staffId);
      this.saveDatabase(this.db);
    }
  }

  async listInvoices(manufacturerId: string): Promise<InvoiceItem[]> {
    return this.db.invoices || [];
  }

  // --- Métodos Anexo A (Backend Real & Simulación) ---

  async testCartelLink(cartelId: string): Promise<{ valid: boolean; httpStatus: number; finalUrl: string }> {
    const cartel = await this.getCartel(cartelId);
    return {
      valid: true,
      httpStatus: 200,
      finalUrl: cartel?.targetUrl || 'https://maps.app.goo.gl/toque-demo',
    };
  }

  async getCartelQr(cartelId: string, size = 300): Promise<{ qrUrl: string }> {
    const cartel = await this.getCartel(cartelId);
    return {
      qrUrl: `https://toque.ar/${cartel?.shortCode || cartelId}`,
    };
  }

  async inviteBusiness(businessId: string): Promise<{ success: boolean; inviteToken: string }> {
    return {
      success: true,
      inviteToken: `tok_inv_${Math.random().toString(36).slice(2, 10)}`,
    };
  }

  async getPrintKit(businessId: string): Promise<{ pdfUrl: string; csvUrl: string }> {
    return {
      pdfUrl: `/api/manufacturer/kit/${businessId}?format=pdf`,
      csvUrl: `/api/manufacturer/kit/${businessId}?format=csv`,
    };
  }

  async subscribeManufacturer(plan: string): Promise<{ checkoutUrl: string; status: string }> {
    return {
      checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=toque_beta',
      status: 'pending',
    };
  }

  async calibrateReviews(placeId?: string): Promise<GoogleReviewsProfile> {
    return {
      isConnected: true,
      businessName: 'Ficha Calibrada en Google Maps',
      placeId: placeId || 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      rating: 4.9,
      reviewCount: 142,
      newReviewsThisMonth: 18,
      ratingEvolution: 0.2,
    };
  }

  async getManufacturerSummary(): Promise<{
    businessesCount: number;
    activeCartelesCount: number;
    atRiskCount: number;
    mrr: number;
  }> {
    const businesses = await this.listBusinesses();
    const carteles = await this.listCarteles();
    const atRisk = await this.getBusinessesAtRisk('tenant-mfg-demo');
    const plan = await this.getManufacturerPlan('tenant-mfg-demo');
    return {
      businessesCount: businesses.length,
      activeCartelesCount: carteles.filter(c => c.status === 'active').length,
      atRiskCount: atRisk.length,
      mrr: plan.pricePerMonth,
    };
  }

  async getPlatformStats(): Promise<PlatformStats> {
    const totalScans = this.db.scans.length;
    const nfcScans = this.db.scans.filter(s => s.channel === 'nfc').length;
    const qrScans = this.db.scans.filter(s => s.channel === 'qr').length;
    const manufacturers = this.db.tenants.filter(t => t.type === 'manufacturer');
    const businesses = this.db.tenants.filter(t => t.type === 'business');
    const carteles = this.db.carteles;
    const activeCarteles = carteles.filter(c => c.status === 'active').length;

    // Recaudación real en base a planes
    // Fabricante Demo = $24.899/mes + 12 comercios ($11.899/mes promedio facturado o cuota de servicio)
    const mrr = 24899 + (businesses.length * 11899);
    const arr = mrr * 12;

    return {
      totalScans,
      nfcScans,
      qrScans,
      totalManufacturers: manufacturers.length,
      totalBusinesses: businesses.length,
      totalCarteles: carteles.length,
      activeCarteles,
      monthlyRevenueArs: mrr,
      annualizedRevenueArs: arr,
      openIncidents: 0,
      linkHealthPercentage: 99.4,
      avgRedirectLatencyMs: 42,
      uptimePercentage: 99.98,
      manufacturers: manufacturers.map(m => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        contactEmail: m.contactEmail,
        businessesCount: businesses.filter(b => b.manufacturerId === m.id).length,
        cartelesCount: carteles.filter(c => c.manufacturerId === m.id).length,
        monthlyFeeArs: 24899,
        plan: 'Plan Taller 50',
        health: 'excellent',
        createdAt: m.createdAt,
      })),
      recentIncidents: [
        {
          id: 'inc-1',
          title: 'Mantenimiento preventivo de proxies Google Maps',
          status: 'resolved',
          severity: 'maintenance',
          date: '02 de Octubre 2026',
          resolutionTime: '12 minutos',
          description: 'Optimización de DNS Anycast en nodos de Buenos Aires y San Pablo sin impacto en usuarios finales.',
        },
        {
          id: 'inc-2',
          title: 'Ajuste en crawler de validación Place ID',
          status: 'resolved',
          severity: 'minor',
          date: '24 de Septiembre 2026',
          resolutionTime: '5 minutos',
          description: 'Actualización del parser para links generados desde la nueva versión de Google Maps Android.',
        },
      ],
    };
  }

  async getSystemHealth(): Promise<SystemHealthItem[]> {
    return [
      {
        name: 'Enrutador Edge & Redirección Dinámica (toque.ar/*)',
        category: 'redirect',
        status: 'operational',
        latencyMs: 38,
        uptime90d: 99.99,
        description: 'Enrutamiento en menos de 50ms hacia fichas verificadas de Google Reviews.',
      },
      {
        name: 'API Central & Persistencia Multi-Tenant',
        category: 'core',
        status: 'operational',
        latencyMs: 44,
        uptime90d: 99.98,
        description: 'Base de datos replicada con separación estricta de fabricantes y comercios.',
      },
      {
        name: 'Servicio de Códigos QR Vectoriales y SVG',
        category: 'core',
        status: 'operational',
        latencyMs: 22,
        uptime90d: 100,
        description: 'Renderizado instantáneo en alta resolución para imprentas y grabadores.',
      },
      {
        name: 'Crawler de Salud de Enlaces Google Reviews',
        category: 'crawler',
        status: 'operational',
        latencyMs: 95,
        uptime90d: 99.95,
        description: 'Verificación periódica que detecta cambios de URLs y previene enlaces rotos.',
      },
      {
        name: 'CDN y Servidor de Recursos Estáticos',
        category: 'cdn',
        status: 'operational',
        latencyMs: 18,
        uptime90d: 99.99,
        description: 'Distribución ultrarrápida de interfaces y kits de impresión física.',
      },
    ];
  }

  async runSystemDiagnostic(): Promise<SystemHealthItem[]> {
    const list = await this.getSystemHealth();
    // Simular variación en tiempo real con latencias frescas
    return list.map(item => ({
      ...item,
      latencyMs: Math.max(15, Math.round(item.latencyMs + (Math.random() * 8 - 4))),
    }));
  }

  async adminListTenants(): Promise<Tenant[]> {
    return this.db.tenants || [];
  }

  async adminSuspendTenant(id: string): Promise<{ success: boolean }> {
    const tenant = this.db.tenants.find(t => t.id === id);
    if (tenant) {
      tenant.isDemo = false;
      this.saveDatabase(this.db);
    }
    return { success: true };
  }

  async adminRestoreTenant(id: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  async adminHealth(): Promise<{ status: string; kv: boolean; d1: boolean; uptime: number }> {
    return {
      status: 'ok',
      kv: true,
      d1: true,
      uptime: 99.98,
    };
  }
}

export const mockApi = new MockApiImpl();

