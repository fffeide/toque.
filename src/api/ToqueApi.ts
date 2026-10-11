/**
 * Toque — Interfaz de la Capa de Datos (ToqueApi)
 * Contrato estricto para adaptadores mockApi y httpApi.
 * Cumple rigurosamente con el CONTRATO DE API (Anexo A).
 */

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

export interface ToqueApi {
  // --- Autenticación (Directa, Credenciales & Sesión) ---
  requestMagicLink(email: string): Promise<{ success: boolean; simulatedLink?: string; token?: string }>;
  verifyMagicLink(token: string): Promise<{ user: User; tenant: Tenant }>;
  loginDirect(email: string, role?: UserRole): Promise<{ user: User; tenant: Tenant }>;
  loginWithCredentials(user: string, pass: string): Promise<{ user: User; tenant: Tenant }>;
  markUserOnboarded(userId: string): Promise<User>;
  getCurrentUser(): Promise<{ user: User; tenant: Tenant } | null>;
  logout(): Promise<void>;
  switchDemoRole(role: UserRole): Promise<{ user: User; tenant: Tenant }>;

  // --- Tenants y Marca Blanca ---
  getTenant(id: string): Promise<Tenant>;
  updateTenantBrand(id: string, brand: { brandColor?: string; brandLogo?: string; name?: string }): Promise<Tenant>;
  listBusinesses(manufacturerId?: string): Promise<Tenant[]>;

  // --- Carteles (stands en backend) ---
  listCarteles(businessId?: string, includeTrash?: boolean): Promise<Cartel[]>;
  getCartel(id: string): Promise<Cartel | null>;
  createCartel(data: {
    businessId: string;
    name: string;
    locationDescription: string;
    targetUrl: string;
    nfcEnabled?: boolean;
    qrEnabled?: boolean;
  }): Promise<Cartel>;
  updateCartel(id: string, patch: Partial<Cartel>): Promise<Cartel>;
  deleteCartel(id: string): Promise<void>; // Papelera / Retirado
  restoreCartel(id: string): Promise<void>; // Deshacer borrado
  replaceCartel(oldCartelId: string, newCartelData: {
    name: string;
    locationDescription: string;
    targetUrl?: string;
  }): Promise<{ oldCartel: Cartel; newCartel: Cartel }>;
  testCartelLink?(cartelId: string): Promise<{ valid: boolean; httpStatus: number; finalUrl: string }>;
  getCartelQr?(cartelId: string, size?: number): Promise<{ qrUrl: string }>;

  // --- Analíticas y Escaneos ---
  getStats(businessId: string, days?: number): Promise<StatsSummary>;
  listRecentScans(businessId: string, limit?: number): Promise<Scan[]>;
  recordScan(shortCode: string, channelOrTelemetry?: 'nfc' | 'qr' | ScanTelemetry): Promise<{ targetUrl: string; cartel: Cartel }>;

  // --- Alertas del Sistema ---
  listAlerts(tenantId: string): Promise<Alert[]>;
  markAlertRead(alertId: string): Promise<void>;

  // --- Reportes y Configuración de Envíos ---
  listReports(businessId: string): Promise<Report[]>;
  getWeeklyReportPreview(businessId: string): Promise<WeeklyReportPreview>;
  getReportConfig(businessId: string): Promise<ReportConfig>;
  updateReportConfig(businessId: string, config: Partial<ReportConfig>): Promise<ReportConfig>;

  // --- Reseñas de Google y Calibración ---
  getGoogleReviewsProfile(businessId: string): Promise<GoogleReviewsProfile>;
  connectGoogleReviewsProfile(businessId: string, placeId: string): Promise<GoogleReviewsProfile>;
  calibrateReviews?(placeId?: string): Promise<GoogleReviewsProfile>;

  // --- Detalle Extendido de Cartel ---
  getCartelDetail(cartelId: string): Promise<CartelDetailStats | null>;

  // --- Canales y Personal (Feature flags) ---
  listChannels(businessId: string): Promise<ChannelMetric[]>;
  listStaff(businessId: string): Promise<StaffMember[]>;

  // --- Panel del Fabricante ---
  getManufacturerSummary?(): Promise<{
    businessesCount: number;
    activeCartelesCount: number;
    atRiskCount: number;
    mrr: number;
  }>;
  getBusinessesAtRisk(manufacturerId: string): Promise<BusinessAtRisk[]>;
  createBusinessQuick(data: {
    manufacturerId: string;
    name: string;
    email: string;
    phone: string;
    category: string;
    reviewUrl: string;
  }): Promise<{ business: Tenant; cartel: Cartel; shortCode: string; inviteToken: string }>;
  batchCreateBusinesses(
    manufacturerId: string,
    rows: BatchImportRow[]
  ): Promise<{ createdCount: number; errors: { row: number; error: string }[] }>;
  updateBusinessStatus(businessId: string, status: 'active' | 'paused' | 'transferred'): Promise<Tenant>;
  inviteBusiness?(businessId: string): Promise<{ success: boolean; inviteToken: string }>;
  getPrintKit?(businessId: string): Promise<{ pdfUrl: string; csvUrl: string }>;
  listReplacementOrders(manufacturerId: string): Promise<ReplacementOrder[]>;
  updateReplacementOrderStatus(orderId: string, status: ReplacementOrder['status']): Promise<ReplacementOrder>;
  getManufacturerPlan(manufacturerId: string): Promise<ManufacturerPlan>;
  subscribeManufacturer?(plan: string): Promise<{ checkoutUrl: string; status: string }>;
  addCartelesPack(manufacturerId: string, packSize: number): Promise<ManufacturerPlan>;
  listManufacturerStaff(manufacturerId: string): Promise<ManufacturerStaffUser[]>;
  addManufacturerStaff(
    manufacturerId: string,
    user: { name: string; email: string; role: 'owner' | 'admin' | 'viewer'; isBackupAdmin?: boolean }
  ): Promise<ManufacturerStaffUser>;
  removeManufacturerStaff(manufacturerId: string, staffId: string): Promise<void>;
  listInvoices(manufacturerId: string): Promise<InvoiceItem[]>;

  // --- Plataforma / Administración Interna & Estado del Sistema ---
  getPlatformStats(): Promise<PlatformStats>;
  getSystemHealth(): Promise<SystemHealthItem[]>;
  runSystemDiagnostic(): Promise<SystemHealthItem[]>;
  adminListTenants?(): Promise<Tenant[]>;
  adminSuspendTenant?(id: string): Promise<{ success: boolean }>;
  adminRestoreTenant?(id: string): Promise<{ success: boolean }>;
  adminHealth?(): Promise<{ status: string; kv: boolean; d1: boolean; uptime: number }>;
}
