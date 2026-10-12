/**
 * Toque — Tipos de la Capa de Datos (Anexo A)
 * Modelo multi-tenant de 3 niveles: Plataforma, Fabricante, Negocio.
 */

export type TenantType = 'platform' | 'manufacturer' | 'business';

export interface TenantFeatures {
  channels?: boolean;
  staff?: boolean;
}

export type BusinessPlan = 'free' | 'pro';
export type ManufacturerPlanType = 'taller' | 'fabrica';

export interface Tenant {
  id: string;
  type: TenantType;
  name: string;
  slug: string;
  accountCode?: string; // ej. 'VH-01' para Vanish Helados o 'RT-01' para Rexi Tecnologies
  plan?: BusinessPlan | ManufacturerPlanType | string;
  brandColor?: string; // Formato hex, ej. #3A3FE0
  brandLogo?: string;  // URL o SVG base64
  contactEmail: string;
  phone?: string;
  address?: string;
  category?: string;
  reviewUrl?: string;
  materials?: string[]; // Para fabricantes: acrílico, madera, metal, etc.
  formats?: string[];   // Formatos: pirámide, placa de mostrador, base de madera, colgante, etc.
  city?: string;
  description?: string;
  website?: string;
  inNetwork?: boolean; // Si el fabricante está subido a la red de fabricantes
  isVerified?: boolean; // Si Toque verificó su calidad y clientes
  verifiedAt?: string;
  verificationNotes?: string;
  leadTime?: string; // Tiempos estimados ej. "48 a 72 hs hábiles"
  products?: {
    id: string;
    name: string;
    format: string;
    material: string;
    price: number;
    description: string;
    estimatedDays: number;
  }[];
  manufacturerId?: string; // Si es 'business', a qué fabricante pertenece (ej. 'TS-01' o 'RT-01')
  assignedManufacturerName?: string;
  isDemo: boolean;
  features?: TenantFeatures;
  createdAt: string;
}

export type UserRole = 
  | 'platform_admin' 
  | 'manufacturer_admin' 
  | 'business_owner' 
  | 'business_staff';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  hasSeenOnboarding?: boolean;
  hasCompletedOnboarding?: boolean;
  createdAt?: string;
}

export type CartelStatus = 'active' | 'inactive' | 'replaced' | 'trash';

export interface Cartel {
  id: string;
  tenantId: string;
  businessId: string;
  manufacturerId?: string;
  code?: string;      // Código único de tracking, ej: 'RT-VH-01' o 'TQ-VH-01'
  shortCode: string; // ej. 'k7m2p'
  name: string;      // ej. 'Mesa 4 - Salón Principal'
  locationDescription: string;
  targetUrl: string; // URL directa de reseñas en Google
  nfcEnabled: boolean;
  qrEnabled: boolean;
  status: CartelStatus;
  replacedByCartelId?: string;
  replacedCartelId?: string;
  replacementReason?: string;
  deletedAt?: string; // Para papelera de 30 días
  createdAt: string;
  updatedAt?: string;
  lastScannedAt?: string;
  scansCount?: number;
  estimatedReviewsCount?: number;
}

export interface ManufacturerReview {
  id: string;
  manufacturerId: string;
  businessId: string;
  businessName: string;
  businessCode: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface Token {
  token: string;
  type: 'magic_link' | 'session';
  userId: string;
  expiresAt: string;
}

export type ScanChannel = 'nfc' | 'qr';
export type DeviceType = 'ios' | 'android' | 'other';

export interface ScanTelemetry {
  channel?: ScanChannel;
  userAgentDevice?: DeviceType;
  browser?: string;
  platform?: string;
  screenResolution?: string;
  language?: string;
  connectionType?: string;
  timezone?: string;
  referrer?: string;
  touchSupported?: boolean;
}

export interface Scan {
  id: string;
  cartelId: string;
  businessId?: string;
  timestamp: string;
  channel: ScanChannel;
  userAgentDevice?: DeviceType;
  isEstimatedReview?: boolean;
  browser?: string;
  platform?: string;
  screenResolution?: string;
  language?: string;
  connectionType?: string;
  timezone?: string;
  referrer?: string;
  telemetry?: ScanTelemetry;
  status?: string;
}

export interface LinkCheck {
  id: string;
  cartelId: string;
  checkedAt: string;
  httpStatus: number;
  finalUrl: string;
  isValidGoogleReviewUrl: boolean;
  error?: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'link_broken' | 'inactivity' | 'first_scan';

export interface Alert {
  id: string;
  tenantId: string;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  read: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  amount: number;
  currency: 'ARS';
  status: 'paid' | 'pending';
  period: string; // ej. '2026-09'
  paidAt?: string;
  pdfUrl?: string;
}

export interface GoogleReviewsProfile {
  isConnected: boolean;
  businessName?: string;
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  newReviewsThisMonth?: number;
  ratingEvolution?: number; // ej. +0.2
}

export interface CartelTimelineEvent {
  id: string;
  cartelId: string;
  type: 'created' | 'first_scan' | 'alert' | 'replaced' | 'url_updated';
  title: string;
  description: string;
  timestamp: string;
}

export interface CartelDetailStats {
  cartel: Cartel;
  totalScans: number;
  monthScans: number;
  nfcScans: number;
  qrScans: number;
  peakHour: string; // ej. "13:30 h y 21:00 h"
  peakDay: string;  // ej. "Viernes y Sábados"
  devices: {
    androidPercentage: number;
    iosPercentage: number;
  };
  approximateCity: string; // ej. "Buenos Aires (CABA)"
  timeline: CartelTimelineEvent[];
}

export interface ChannelMetric {
  id: string;
  name: string; // 'WhatsApp', 'Ticket / Factura', 'Instagram', 'Mesa / Barra'
  shortCode: string;
  scansCount: number;
  estimatedReviews: number;
  conversionRate: number; // porcentaje ej 14%
  icon: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string; // 'Mozo salón', 'Cajero', 'Barista'
  shortCode: string;
  scansThisMonth: number;
  rank: number;
  avatar?: string;
}

export interface WeeklyReportPreview {
  period: string; // '29/09/2026 - 05/10/2026'
  line1: string;  // "Esta semana tu negocio acumuló 142 toques (+18% vs semana anterior)."
  line2: string;  // "Tu cartel 'Mesa 4' fue el más activo con 54 interacciones."
  line3: string;  // "Estimamos ~14 reseñas potenciales sumadas en Google Maps."
  suggestedAction: string; // "El cartel 'Barra' tiene menos actividad que el promedio: probalo o reubicalo cerca de la caja."
}

export interface ReportConfig {
  deliveryDay: 'monday' | 'friday' | 'sunday';
  deliveryHour: string; // '09:00'
  channel: 'email' | 'whatsapp' | 'both';
  emailRecipient: string;
  whatsappPhone: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  plan: 'starter' | 'pro' | 'custom';
  status: 'active' | 'past_due' | 'canceled';
  currentPeriodEnd: string;
}

export interface Report {
  id: string;
  businessId: string;
  month: string; // 'aaaa-mm'
  totalScans: number;
  nfcScans: number;
  qrScans: number;
  estimatedReviews: number;
  topCartelId: string;
}

export interface StatsSummary {
  totalScans: number;
  nfcScans: number;
  qrScans: number;
  potentialReviewsEstimate: number; // 28% de escaneos según benchmark gastronómico y comercial
  activeCartelesCount: number;
  scansByDay: {
    date: string; // dd/mm
    nfc: number;
    qr: number;
    total: number;
  }[];
  scansByHour: {
    hour: number;
    count: number;
  }[];
  topCarteles: {
    cartelId: string;
    name: string;
    scans: number;
    nfc: number;
    qr: number;
  }[];
}

export interface ReplacementOrder {
  id: string;
  businessId: string;
  businessName: string;
  cartelId: string;
  cartelName: string;
  shortCode: string;
  reason: 'broken' | 'lost' | 'chip_failure' | 'design_update';
  status: 'pending' | 'in_progress' | 'completed';
  requestedAt: string;
  completedAt?: string;
}

export interface ManufacturerStaffUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'viewer';
  isBackupAdmin?: boolean;
  addedAt: string;
}

export interface ManufacturerPlan {
  planName: string;
  cartelesUsed: number;
  cartelesLimit: number;
  pricePerMonth: number;
  currency: string;
  status: 'active' | 'grace_period' | 'past_due';
  graceDaysRemaining: number;
  nextBillingDate: string;
  paymentMethod: {
    brand: string;
    last4: string;
    expiry: string;
  };
}

export interface InvoiceItem {
  id: string;
  number: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending';
}

export interface BusinessAtRisk {
  business: Tenant;
  cartelesCount: number;
  daysWithoutScans: number;
  phone: string;
  suggestedMessage: string;
}

export interface BatchImportRow {
  index: number;
  name: string;
  email: string;
  phone: string;
  category: string;
  reviewUrl: string;
  isValid: boolean;
  error?: string;
}

export interface SystemHealthItem {
  name: string;
  category: 'core' | 'redirect' | 'database' | 'crawler' | 'cdn';
  status: 'operational' | 'degraded' | 'outage';
  latencyMs: number;
  uptime90d: number;
  description: string;
}

export interface PlatformStats {
  totalScans: number;
  nfcScans: number;
  qrScans: number;
  totalManufacturers: number;
  totalBusinesses: number;
  totalCarteles: number;
  activeCarteles: number;
  monthlyRevenueArs: number;
  annualizedRevenueArs: number;
  openIncidents: number;
  linkHealthPercentage: number;
  avgRedirectLatencyMs: number;
  uptimePercentage: number;
  manufacturers: Array<{
    id: string;
    name: string;
    slug: string;
    contactEmail: string;
    businessesCount: number;
    cartelesCount: number;
    monthlyFeeArs: number;
    plan: string;
    health: 'healthy' | 'at_risk' | 'excellent';
    createdAt: string;
  }>;
  recentIncidents: Array<{
    id: string;
    title: string;
    status: 'resolved' | 'investigating' | 'scheduled';
    severity: 'minor' | 'major' | 'maintenance';
    date: string;
    resolutionTime?: string;
    description: string;
  }>;
}

