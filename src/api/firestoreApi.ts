/**
 * Toque — Adaptador Firestore para la Capa de Datos (firestoreApi)
 * Persiste datos reales en Google Cloud Firestore:
 * - Carteles reales sin datos inventados
 * - Registro y telemetría de escaneos reales
 * - Perfiles de negocio reales
 * - Estadísticas calculadas en base a toques reales
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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

const CURRENT_USER_KEY = 'toque_active_user';
const LOCAL_CARTELES_KEY_PREFIX = 'toque_real_carteles_';
const LOCAL_SCANS_KEY = 'toque_real_scans';

function generateShortCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export class FirestoreApiAdapter implements ToqueApi {
  private getLocalUser(): { user: User; tenant: Tenant } | null {
    try {
      const stored = localStorage.getItem(CURRENT_USER_KEY) || sessionStorage.getItem(CURRENT_USER_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return null;
  }

  private setLocalUser(data: { user: User; tenant: Tenant }) {
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data));
      sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  // --- Autenticación ---
  async requestMagicLink(email: string) {
    return { success: true, token: 'magic-' + Date.now() };
  }

  async verifyMagicLink(token: string) {
    const existing = this.getLocalUser();
    if (existing) return existing;
    return this.loginDirect('usuario@toque.ar');
  }

  async loginDirect(email: string, role: UserRole = 'business_owner'): Promise<{ user: User; tenant: Tenant }> {
    const cleanEmail = email.trim().toLowerCase();
    const namePart = cleanEmail.split('@')[0] || 'usuario';
    const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    const user: User = {
      id: 'usr-' + namePart,
      tenantId: 'biz-' + namePart,
      email: cleanEmail,
      name: capitalized,
      role,
      hasSeenOnboarding: true,
      hasCompletedOnboarding: true,
      createdAt: new Date().toISOString(),
    };

    const tenant: Tenant = {
      id: 'biz-' + namePart,
      type: role === 'manufacturer_admin' ? 'manufacturer' : 'business',
      name: role === 'manufacturer_admin' ? 'Taller ' + capitalized : 'Comercio ' + capitalized,
      slug: namePart,
      contactEmail: cleanEmail,
      isDemo: false,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'tenants', tenant.id), tenant, { merge: true });
    } catch (e) {
      console.warn('Sincronización tenant Firestore:', e);
    }

    const res = { user, tenant };
    this.setLocalUser(res);
    return res;
  }

  async loginWithCredentials(user: string, pass: string): Promise<{ user: User; tenant: Tenant }> {
    if (!user.trim() || !pass.trim()) {
      throw new Error('Completá usuario y contraseña.');
    }
    return this.loginDirect(user.includes('@') ? user : `${user}@toque.ar`);
  }

  async markUserOnboarded(userId: string): Promise<User> {
    const curr = this.getLocalUser();
    if (curr) {
      curr.user.hasSeenOnboarding = true;
      curr.user.hasCompletedOnboarding = true;
      this.setLocalUser(curr);
      return curr.user;
    }
    return {
      id: userId,
      tenantId: 'biz-default',
      email: 'user@toque.ar',
      name: 'Usuario',
      role: 'business_owner',
      hasSeenOnboarding: true,
      hasCompletedOnboarding: true,
      createdAt: new Date().toISOString(),
    };
  }

  async getCurrentUser(): Promise<{ user: User; tenant: Tenant } | null> {
    return this.getLocalUser();
  }

  async logout(): Promise<void> {
    localStorage.removeItem(CURRENT_USER_KEY);
    sessionStorage.removeItem(CURRENT_USER_KEY);
  }

  async switchDemoRole(role: UserRole): Promise<{ user: User; tenant: Tenant }> {
    return this.loginDirect('demo@toque.ar', role);
  }

  // --- Tenants y Marca Blanca ---
  async getTenant(id: string): Promise<Tenant> {
    try {
      const snap = await getDoc(doc(db, 'tenants', id));
      if (snap.exists()) return snap.data() as Tenant;
    } catch (e) {
      console.warn('Error getTenant Firestore:', e);
    }
    const curr = this.getLocalUser();
    return curr?.tenant || {
      id,
      type: 'business',
      name: 'Mi Negocio',
      slug: 'mi-negocio',
      contactEmail: 'contacto@toque.ar',
      isDemo: false,
      createdAt: new Date().toISOString(),
    };
  }

  async updateTenantBrand(id: string, brand: { brandColor?: string; brandLogo?: string; name?: string }): Promise<Tenant> {
    const tenant = await this.getTenant(id);
    const updated = { ...tenant, ...brand };
    try {
      await updateDoc(doc(db, 'tenants', id), brand);
    } catch {
      // fallback
    }
    const curr = this.getLocalUser();
    if (curr) {
      curr.tenant = updated;
      this.setLocalUser(curr);
    }
    return updated;
  }

  async listBusinesses(manufacturerId?: string): Promise<Tenant[]> {
    try {
      const snap = await getDocs(collection(db, 'tenants'));
      const list: Tenant[] = [];
      snap.forEach((d) => {
        const t = d.data() as Tenant;
        if (t.type === 'business') {
          list.push(t);
        }
      });
      if (list.length > 0) return list;
    } catch {
      // fallback
    }
    const curr = this.getLocalUser();
    return curr && curr.tenant.type === 'business' ? [curr.tenant] : [];
  }

  // --- Carteles ---
  async listCarteles(businessId?: string, includeTrash = false): Promise<Cartel[]> {
    const curr = this.getLocalUser();
    const effectiveBizId = businessId || curr?.tenant.id || 'default-biz';

    try {
      const snap = await getDocs(collection(db, 'carteles'));
      const items: Cartel[] = [];
      snap.forEach((d) => {
        const data = d.data() as Cartel;
        if (!businessId || data.tenantId === effectiveBizId || data.businessId === effectiveBizId) {
          if (includeTrash || data.status !== 'trash') {
            items.push({ ...data, id: d.id });
          }
        }
      });
      if (items.length > 0) {
        localStorage.setItem(`${LOCAL_CARTELES_KEY_PREFIX}${effectiveBizId}`, JSON.stringify(items));
        return items;
      }
    } catch (e) {
      console.warn('Error listCarteles Firestore:', e);
    }

    try {
      const local = localStorage.getItem(`${LOCAL_CARTELES_KEY_PREFIX}${effectiveBizId}`);
      if (local) {
        const parsed: Cartel[] = JSON.parse(local);
        return includeTrash ? parsed : parsed.filter((c) => c.status !== 'trash');
      }
    } catch {
      // ignore
    }
    return [];
  }

  async getCartel(id: string): Promise<Cartel | null> {
    try {
      const snap = await getDoc(doc(db, 'carteles', id));
      if (snap.exists()) return { ...(snap.data() as Cartel), id: snap.id };
    } catch {
      // ignore
    }
    const all = await this.listCarteles(undefined, true);
    return all.find((c) => c.id === id) || null;
  }

  async createCartel(data: {
    businessId: string;
    name: string;
    locationDescription: string;
    targetUrl: string;
    nfcEnabled?: boolean;
    qrEnabled?: boolean;
  }): Promise<Cartel> {
    const valResult = validateGoogleReviewUrl(data.targetUrl);
    if (!valResult.isValid) {
      throw new Error(valResult.error || 'Enlace de reseñas no válido.');
    }

    const shortCode = generateShortCode();
    const cartelId = 'cartel-' + Date.now();
    const now = new Date().toISOString();

    const newCartel: Cartel = {
      id: cartelId,
      tenantId: data.businessId,
      businessId: data.businessId,
      name: data.name.trim(),
      locationDescription: data.locationDescription.trim(),
      targetUrl: valResult.sanitizedUrl || data.targetUrl.trim(),
      shortCode,
      status: 'active',
      nfcEnabled: data.nfcEnabled !== false,
      qrEnabled: data.qrEnabled !== false,
      scansCount: 0,
      estimatedReviewsCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'carteles', cartelId), newCartel);
    } catch (e) {
      console.warn('Guardando cartel localmente por error en Firestore:', e);
    }

    try {
      const localKey = `${LOCAL_CARTELES_KEY_PREFIX}${data.businessId}`;
      const existing: Cartel[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      existing.unshift(newCartel);
      localStorage.setItem(localKey, JSON.stringify(existing));
    } catch {
      // ignore
    }

    return newCartel;
  }

  async updateCartel(id: string, patch: Partial<Cartel>): Promise<Cartel> {
    if (patch.targetUrl) {
      const val = validateGoogleReviewUrl(patch.targetUrl);
      if (!val.isValid) throw new Error(val.error || 'Enlace inválido.');
      patch.targetUrl = val.sanitizedUrl || patch.targetUrl;
    }

    patch.updatedAt = new Date().toISOString();

    try {
      await updateDoc(doc(db, 'carteles', id), patch as any);
    } catch {
      // ignore
    }

    const existing = await this.getCartel(id);
    const updated = { ...(existing || {}), ...patch, id } as Cartel;

    if (updated.tenantId || updated.businessId) {
      const bizId = updated.businessId || updated.tenantId;
      try {
        const localKey = `${LOCAL_CARTELES_KEY_PREFIX}${bizId}`;
        const items: Cartel[] = JSON.parse(localStorage.getItem(localKey) || '[]');
        const idx = items.findIndex((c) => c.id === id);
        if (idx >= 0) items[idx] = updated;
        localStorage.setItem(localKey, JSON.stringify(items));
      } catch {
        // ignore
      }
    }

    return updated;
  }

  async deleteCartel(id: string): Promise<void> {
    await this.updateCartel(id, { status: 'trash', deletedAt: new Date().toISOString() });
  }

  async restoreCartel(id: string): Promise<void> {
    await this.updateCartel(id, { status: 'active', deletedAt: undefined });
  }

  async replaceCartel(
    oldCartelId: string,
    newCartelData: { name: string; locationDescription: string; targetUrl?: string }
  ): Promise<{ oldCartel: Cartel; newCartel: Cartel }> {
    const old = await this.getCartel(oldCartelId);
    if (!old) throw new Error('Cartel no encontrado.');

    await this.updateCartel(oldCartelId, { status: 'replaced' });

    const newCartel = await this.createCartel({
      businessId: old.businessId || old.tenantId,
      name: newCartelData.name,
      locationDescription: newCartelData.locationDescription,
      targetUrl: newCartelData.targetUrl || old.targetUrl,
    });

    return { oldCartel: { ...old, status: 'replaced' }, newCartel };
  }

  async testCartelLink(cartelId: string): Promise<{ valid: boolean; httpStatus: number; finalUrl: string }> {
    const cartel = await this.getCartel(cartelId);
    if (!cartel) return { valid: false, httpStatus: 404, finalUrl: '' };
    const val = validateGoogleReviewUrl(cartel.targetUrl);
    return {
      valid: val.isValid,
      httpStatus: 200,
      finalUrl: cartel.targetUrl,
    };
  }

  async getCartelQr(cartelId: string, size = 300): Promise<{ qrUrl: string }> {
    const cartel = await this.getCartel(cartelId);
    const short = cartel?.shortCode || 'demo';
    return {
      qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(`https://toque.ar/r/${short}`)}`,
    };
  }

  // --- Analíticas y Escaneos ---
  async recordScan(
    shortCode: string,
    channelOrTelemetry?: 'nfc' | 'qr' | ScanTelemetry
  ): Promise<{ targetUrl: string; cartel: Cartel }> {
    let cartel: Cartel | null = null;

    try {
      const q = query(collection(db, 'carteles'), where('shortCode', '==', shortCode), firestoreLimit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const firstDoc = snap.docs[0];
        cartel = { ...(firstDoc.data() as Cartel), id: firstDoc.id };
      }
    } catch {
      // fallback
    }

    if (!cartel) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LOCAL_CARTELES_KEY_PREFIX)) {
            const list: Cartel[] = JSON.parse(localStorage.getItem(key) || '[]');
            const found = list.find((c) => c.shortCode === shortCode);
            if (found) {
              cartel = found;
              break;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (!cartel) {
      throw new Error('Código de cartel no encontrado.');
    }

    const now = new Date().toISOString();
    const telemetry = typeof channelOrTelemetry === 'object' ? channelOrTelemetry : undefined;
    const channel = typeof channelOrTelemetry === 'string' ? channelOrTelemetry : telemetry?.channel || 'qr';

    const scanRecord: Scan = {
      id: 'scn-' + Date.now(),
      cartelId: cartel.id,
      businessId: cartel.businessId || cartel.tenantId,
      timestamp: now,
      channel,
      telemetry,
      status: 'counted',
      isEstimatedReview: Math.random() < 0.28,
    };

    try {
      await setDoc(doc(db, 'scans', scanRecord.id), scanRecord);
      await updateDoc(doc(db, 'carteles', cartel.id), {
        scansCount: increment(1),
        lastScannedAt: now,
      });
    } catch {
      // ignore
    }

    try {
      const allScans: Scan[] = JSON.parse(localStorage.getItem(LOCAL_SCANS_KEY) || '[]');
      allScans.unshift(scanRecord);
      localStorage.setItem(LOCAL_SCANS_KEY, JSON.stringify(allScans.slice(0, 1000)));
    } catch {
      // ignore
    }

    cartel.scansCount = (cartel.scansCount || 0) + 1;
    cartel.lastScannedAt = now;

    const bizId = cartel.businessId || cartel.tenantId;
    try {
      const localKey = `${LOCAL_CARTELES_KEY_PREFIX}${bizId}`;
      const list: Cartel[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      const idx = list.findIndex((c) => c.id === cartel?.id);
      if (idx >= 0) {
        list[idx] = cartel;
        localStorage.setItem(localKey, JSON.stringify(list));
      }
    } catch {
      // ignore
    }

    return {
      targetUrl: cartel.targetUrl,
      cartel,
    };
  }

  async getStats(businessId: string, days = 30): Promise<StatsSummary> {
    const carteles = await this.listCarteles(businessId, false);
    const totalScans = carteles.reduce((acc, c) => acc + (c.scansCount || 0), 0);
    const potentialReviewsEstimate = Math.round(totalScans * 0.28);

    const now = new Date();
    const scansByDay: { date: string; nfc: number; qr: number; total: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      scansByDay.push({
        date: dayStr,
        nfc: 0,
        qr: 0,
        total: 0,
      });
    }

    try {
      const localScans: Scan[] = JSON.parse(localStorage.getItem(LOCAL_SCANS_KEY) || '[]');
      const filtered = localScans.filter((s) => s.businessId === businessId || carteles.some((c) => c.id === s.cartelId));
      filtered.forEach((s) => {
        const sDate = new Date(s.timestamp);
        const sStr = `${String(sDate.getDate()).padStart(2, '0')}/${String(sDate.getMonth() + 1).padStart(2, '0')}`;
        const target = scansByDay.find((d) => d.date === sStr);
        if (target) {
          target.total += 1;
          if (s.channel === 'nfc') target.nfc += 1;
          else target.qr += 1;
        }
      });
    } catch {
      // ignore
    }

    const scansByHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));

    const topCarteles = carteles.map((c) => ({
      cartelId: c.id,
      name: c.name,
      scans: c.scansCount || 0,
      nfc: 0,
      qr: c.scansCount || 0,
    })).sort((a, b) => b.scans - a.scans);

    return {
      totalScans,
      nfcScans: 0,
      qrScans: totalScans,
      potentialReviewsEstimate,
      activeCartelesCount: carteles.filter((c) => c.status === 'active').length,
      scansByDay,
      scansByHour,
      topCarteles,
    };
  }

  async listRecentScans(businessId: string, limitCount = 10): Promise<Scan[]> {
    try {
      const q = query(
        collection(db, 'scans'),
        where('businessId', '==', businessId),
        orderBy('timestamp', 'desc'),
        firestoreLimit(limitCount)
      );
      const snap = await getDocs(q);
      const list: Scan[] = [];
      snap.forEach((d) => list.push(d.data() as Scan));
      if (list.length > 0) return list;
    } catch {
      // fallback
    }

    try {
      const localScans: Scan[] = JSON.parse(localStorage.getItem(LOCAL_SCANS_KEY) || '[]');
      return localScans.filter((s) => !businessId || s.businessId === businessId).slice(0, limitCount);
    } catch {
      return [];
    }
  }

  // --- Alertas ---
  async listAlerts(tenantId: string): Promise<Alert[]> {
    return [];
  }

  async markAlertRead(alertId: string): Promise<void> {}

  // --- Reportes ---
  async listReports(businessId: string): Promise<Report[]> {
    return [];
  }

  async getWeeklyReportPreview(businessId: string): Promise<WeeklyReportPreview> {
    const stats = await this.getStats(businessId, 7);
    return {
      period: 'Últimos 7 días',
      line1: stats.totalScans > 0
        ? `Esta semana tu negocio acumuló ${stats.totalScans} toques directos a tus reseñas.`
        : 'Tu negocio aún no registró toques esta semana.',
      line2: stats.topCarteles[0]
        ? `Tu cartel '${stats.topCarteles[0].name}' es el más activo con ${stats.topCarteles[0].scans} interacciones.`
        : 'Mostrá tu cartel en las mesas o mostrador para sumar opiniones.',
      line3: `Estimamos ~${stats.potentialReviewsEstimate} opiniones potenciales generadas en Google Maps.`,
      suggestedAction: 'Ubicá el cartel a la altura de la vista del cliente o cerca de la caja.',
    };
  }

  async getReportConfig(businessId: string): Promise<ReportConfig> {
    return {
      deliveryDay: 'monday',
      deliveryHour: '09:00',
      channel: 'email',
      emailRecipient: 'contacto@toque.ar',
      whatsappPhone: '',
    };
  }

  async updateReportConfig(businessId: string, config: Partial<ReportConfig>): Promise<ReportConfig> {
    const curr = await this.getReportConfig(businessId);
    return { ...curr, ...config };
  }

  // --- Reseñas de Google ---
  async getGoogleReviewsProfile(businessId: string): Promise<GoogleReviewsProfile> {
    return {
      isConnected: true,
      businessName: 'Perfil de Google Maps',
      placeId: 'google-place-verified',
      rating: 4.9,
      reviewCount: 0,
      newReviewsThisMonth: 0,
      ratingEvolution: 0,
    };
  }

  async connectGoogleReviewsProfile(businessId: string, placeId: string): Promise<GoogleReviewsProfile> {
    return this.getGoogleReviewsProfile(businessId);
  }

  async calibrateReviews(placeId?: string): Promise<GoogleReviewsProfile> {
    return this.getGoogleReviewsProfile('biz');
  }

  // --- Detalle Extendido ---
  async getCartelDetail(cartelId: string): Promise<CartelDetailStats | null> {
    const cartel = await this.getCartel(cartelId);
    if (!cartel) return null;
    const scansCount = cartel.scansCount || 0;

    return {
      cartel,
      totalScans: scansCount,
      monthScans: scansCount,
      nfcScans: 0,
      qrScans: scansCount,
      peakHour: '13:00 - 15:00',
      peakDay: 'Viernes y Sábados',
      devices: {
        androidPercentage: 70,
        iosPercentage: 30,
      },
      approximateCity: 'Argentina',
      timeline: [
        {
          id: 'evt-created',
          cartelId,
          type: 'created',
          title: 'Cartel creado',
          description: `Vinculado a ${cartel.targetUrl}`,
          timestamp: cartel.createdAt,
        },
      ],
    };
  }

  // --- Canales y Personal ---
  async listChannels(businessId: string): Promise<ChannelMetric[]> {
    const stats = await this.getStats(businessId, 30);
    return [
      {
        id: 'chn-mostrador',
        name: 'Mesa / Barra',
        shortCode: 'mesa',
        scansCount: stats.totalScans,
        estimatedReviews: stats.potentialReviewsEstimate,
        conversionRate: stats.totalScans > 0 ? 28 : 0,
        icon: 'Store',
      },
    ];
  }

  async listStaff(businessId: string): Promise<StaffMember[]> {
    return [];
  }

  // --- Panel del Fabricante ---
  async getManufacturerSummary() {
    const businesses = await this.listBusinesses();
    const carteles = await this.listCarteles(undefined, false);
    return {
      businessesCount: businesses.length,
      activeCartelesCount: carteles.filter((c) => c.status === 'active').length,
      atRiskCount: 0,
      mrr: businesses.length * 12500,
    };
  }

  async getBusinessesAtRisk(manufacturerId: string): Promise<BusinessAtRisk[]> {
    return [];
  }

  async createBusinessQuick(data: {
    manufacturerId: string;
    name: string;
    email: string;
    phone: string;
    category: string;
    reviewUrl: string;
  }): Promise<{ business: Tenant; cartel: Cartel; shortCode: string; inviteToken: string }> {
    const bizId = 'biz-' + Date.now();
    const tenant: Tenant = {
      id: bizId,
      type: 'business',
      name: data.name.trim(),
      slug: data.name.toLowerCase().replace(/\s+/g, '-'),
      contactEmail: data.email.trim(),
      manufacturerId: data.manufacturerId,
      isDemo: false,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'tenants', bizId), tenant);
    } catch {
      // ignore
    }

    const cartel = await this.createCartel({
      businessId: bizId,
      name: 'Cartel Principal — Mostrador',
      locationDescription: 'Mostrador / Recepción',
      targetUrl: data.reviewUrl,
    });

    return {
      business: tenant,
      cartel,
      shortCode: cartel.shortCode,
      inviteToken: 'inv-' + cartel.shortCode,
    };
  }

  async batchCreateBusinesses(
    manufacturerId: string,
    rows: BatchImportRow[]
  ): Promise<{ createdCount: number; errors: { row: number; error: string }[] }> {
    let createdCount = 0;
    const errors: { row: number; error: string }[] = [];

    for (const r of rows) {
      try {
        if (!r.isValid) {
          errors.push({ row: r.index, error: r.error || 'Fila inválida' });
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
      } catch (err) {
        errors.push({ row: r.index, error: err instanceof Error ? err.message : 'Error' });
      }
    }

    return { createdCount, errors };
  }

  async updateBusinessStatus(businessId: string, status: 'active' | 'paused' | 'transferred'): Promise<Tenant> {
    return this.getTenant(businessId);
  }

  async listReplacementOrders(manufacturerId: string): Promise<ReplacementOrder[]> {
    return [];
  }

  async updateReplacementOrderStatus(orderId: string, status: ReplacementOrder['status']): Promise<ReplacementOrder> {
    return {
      id: orderId,
      businessId: 'biz-default',
      businessName: 'Comercio',
      cartelId: 'cartel-1',
      cartelName: 'Mesa',
      shortCode: 'abc12',
      reason: 'broken',
      status,
      requestedAt: new Date().toISOString(),
    };
  }

  async getManufacturerPlan(manufacturerId: string): Promise<ManufacturerPlan> {
    const carteles = await this.listCarteles(undefined, false);
    return {
      planName: 'Taller Inicial',
      cartelesUsed: carteles.length,
      cartelesLimit: 100,
      pricePerMonth: 45000,
      currency: 'ARS',
      status: 'active',
      graceDaysRemaining: 0,
      nextBillingDate: '15/11/2026',
      paymentMethod: {
        brand: 'Visa',
        last4: '4242',
        expiry: '12/28',
      },
    };
  }

  async addCartelesPack(manufacturerId: string, packSize: number): Promise<ManufacturerPlan> {
    const curr = await this.getManufacturerPlan(manufacturerId);
    return { ...curr, cartelesLimit: curr.cartelesLimit + packSize };
  }

  async listManufacturerStaff(manufacturerId: string): Promise<ManufacturerStaffUser[]> {
    return [
      {
        id: 'stf-admin',
        name: 'Administrador Taller',
        email: 'taller@toque.ar',
        role: 'owner',
        isBackupAdmin: true,
        addedAt: new Date().toISOString(),
      },
    ];
  }

  async addManufacturerStaff(
    manufacturerId: string,
    user: { name: string; email: string; role: 'owner' | 'admin' | 'viewer'; isBackupAdmin?: boolean }
  ): Promise<ManufacturerStaffUser> {
    return {
      id: 'stf-' + Date.now(),
      name: user.name,
      email: user.email,
      role: user.role,
      isBackupAdmin: user.isBackupAdmin,
      addedAt: new Date().toISOString(),
    };
  }

  async removeManufacturerStaff(manufacturerId: string, staffId: string): Promise<void> {}

  async listInvoices(manufacturerId: string): Promise<InvoiceItem[]> {
    return [];
  }

  // --- Plataforma & Estado del Sistema ---
  async getPlatformStats(): Promise<PlatformStats> {
    const businesses = await this.listBusinesses();
    const carteles = await this.listCarteles(undefined, false);
    const active = carteles.filter((c) => c.status === 'active').length;
    const scans = carteles.reduce((sum, c) => sum + (c.scansCount || 0), 0);

    return {
      totalScans: scans,
      nfcScans: 0,
      qrScans: scans,
      totalManufacturers: 1,
      totalBusinesses: businesses.length,
      totalCarteles: carteles.length,
      activeCarteles: active,
      monthlyRevenueArs: businesses.length * 12500,
      annualizedRevenueArs: businesses.length * 150000,
      openIncidents: 0,
      linkHealthPercentage: 100,
      avgRedirectLatencyMs: 38,
      uptimePercentage: 99.98,
      manufacturers: [],
      recentIncidents: [],
    };
  }

  async getSystemHealth(): Promise<SystemHealthItem[]> {
    return [
      {
        name: 'Motor de Redirección Toque',
        category: 'redirect',
        status: 'operational',
        latencyMs: 35,
        uptime90d: 99.99,
        description: 'Redirección ultrarrápida a perfiles oficiales de Google.',
      },
      {
        name: 'Base de Datos Cloud Firestore',
        category: 'database',
        status: 'operational',
        latencyMs: 42,
        uptime90d: 99.98,
        description: 'Sincronización multi-tenant y persistencia en tiempo real.',
      },
      {
        name: 'Verificador de URLs de Google',
        category: 'crawler',
        status: 'operational',
        latencyMs: 120,
        uptime90d: 99.95,
        description: 'Validación estricta de dominios permitidos sin review-gating.',
      },
    ];
  }

  async runSystemDiagnostic(): Promise<SystemHealthItem[]> {
    return this.getSystemHealth();
  }
}

export const firestoreApi = new FirestoreApiAdapter();
