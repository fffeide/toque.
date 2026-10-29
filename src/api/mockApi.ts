/**
 * Toque — Capa de Datos de Producción (mockApi + sincronización con servidor Node/Express)
 * Configurada con el comercio oficial de lanzamiento "Musical Monroe" (musical-monroe / MONROE01).
 * Cero datos falsos: todas las métricas, pases de Wallet, ventas y escaneos reflejan actividad 100% real.
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
  ToqueAdminStaff,
  ToqueAdminLevel,
} from './types';
import { TRIAL_DAYS, getPlanLimits } from '../config/pricing';

interface OtpRecord {
  email: string;
  code: string;
  purpose: OtpPurpose;
  createdAtMs: number;
  expiresAtMs: number;
  lastSentAtMs: number;
  attempts: number;
  used: boolean;
}

export function maskEmailAddress(email: string): string {
  const clean = (email || '').trim().toLowerCase();
  if (!clean.includes('@')) return 'Sin datos';
  const [localPart, domain] = clean.split('@');
  if (!localPart || !domain) return 'Sin datos';
  const firstChar = localPart.charAt(0);
  return `${firstChar}***@${domain}`;
}

function generateBarcodeToken32(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return (
    Math.random().toString(36).substring(2, 18) +
    Math.random().toString(36).substring(2, 18) +
    Math.random().toString(36).substring(2, 18)
  ).slice(0, 32);
}

function generateMemberCode(_businessName?: string): string {
  return generateBarcodeToken32();
}

class MockApi implements ToqueApi {
  // Sin sesión por defecto: el usuario ingresa con su correo y código de 6 dígitos
  private currentUser: User | null = null;

  // Cuenta reconocida del cliente en memoria
  private recognizedClient: {
    accountId: string;
    name: string;
    email: string;
    birthDay?: number;
    birthMonth?: number;
  } | null = null;

  // Almacén local de respaldo para OTP (sincronizado con /api/auth/send-otp del servidor)
  private otpStore: Map<string, OtpRecord> = new Map();

  // Control de 1 visita por día en autoservicio: key = `${memberId}_${localCode}_${YYYY-MM-DD}`
  private selfStampDailyLog: Set<string> = new Set();

  // Suscriptores en tiempo real por código de cartel/comercio y por recibo
  private hubListeners: Map<string, Set<(hub: PublicHub) => void>> = new Map();
  private receiptListeners: Map<string, Set<(receipt: Receipt | null) => void>> = new Map();
  private salesListeners: Set<(sales: Sale[]) => void> = new Set();

  // Lista de staff interno de Toque (toque_admins) autorizados para Super Admin
  private toqueAdmins: import('./types').ToqueAdminStaff[] = [
    {
      id: 'toque-admin-root',
      email: 'fedeeeloiss@gmail.com',
      name: 'Fede (Root Super Admin)',
      level: 'admin',
      addedByEmail: 'system',
      createdAt: new Date().toISOString(),
      active: true,
    },
  ];

  private isAuthorizedSuperAdmin(email: string): boolean {
    const clean = (email || '').trim().toLowerCase();
    if (clean === 'fedeeeloiss@gmail.com') return true;
    return this.toqueAdmins.some(
      (a) => a.active && a.email.trim().toLowerCase() === clean
    );
  }

  // Comercio por defecto: ejemplo neutro La Burger
  private businessProfile: BusinessProfile = {
    id: 'la-burger',
    name: 'La Burger',
    ownerName: 'Encargado General',
    email: 'nombre@comercio.com',
    reviewUrl: 'https://maps.google.com',
    cardThemeColor: '#141418',
    loyaltyTitle: 'Tarjeta de sellos de La Burger',
    loyaltyReward: '1 Combo Burger sin cargo al completar 10 sellos',
    howToEarn: '1 sello por visita o compra',
    expirationPolicy: 'No vencen',
    stampsRequired: 10,
    plan: 'pro',
    billingCycle: 'annual',
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
    planPaid: false,
    networkEnabled: false,
    createdAt: new Date().toISOString(),
    scansCount: 0,
    reviewClicksCount: 0,
    walletPassesIssued: 0,
  };

  // Lista real de todos los comercios registrados en la plataforma
  private businesses: Map<string, BusinessProfile> = new Map([
    [
      'la-burger',
      {
        id: 'la-burger',
        name: 'La Burger',
        ownerName: 'Encargado General',
        email: 'nombre@comercio.com',
        reviewUrl: 'https://maps.google.com',
        cardThemeColor: '#141418',
        loyaltyTitle: 'Tarjeta de sellos de La Burger',
        loyaltyReward: '1 Combo Burger sin cargo al completar 10 sellos',
        howToEarn: '1 sello por visita o compra',
        expirationPolicy: 'No vencen',
        stampsRequired: 10,
        plan: 'pro',
        billingCycle: 'annual',
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
        planPaid: true,
        networkEnabled: false,
        createdAt: new Date().toISOString(),
        scansCount: 0,
        reviewClicksCount: 0,
        walletPassesIssued: 0,
      },
    ],
  ]);

  // Configuraciones de Club y Hub por comercio
  private businessClubConfigs: Map<string, ClubConfig> = new Map();
  private businessClubCards: Map<string, ClubConfig[]> = new Map();
  private businessHubConfigs: Map<string, HubConfig> = new Map();

  // Locales reales (inician en 0 visitas/altas para reflejar únicamente actividad real)
  private locals: ClubLocal[] = [
    {
      id: 'local-burger-1',
      businessId: 'la-burger',
      code: 'BURGER01',
      name: 'Sucursal Central',
      address: '',
      visitsCount: 0,
      newMembersCount: 0,
      returningCount: 0,
      rewardsRedeemedCount: 0,
      createdAt: new Date().toISOString(),
    },
  ];

  // Equipo real del comercio
  private teamMembers: TeamMember[] = [
    {
      id: 'team-burger-owner',
      businessId: 'la-burger',
      name: 'Encargado General',
      email: 'nombre@comercio.com',
      role: 'owner',
      assignedCartelId: 'cartel-burger-01',
      assignedCartelCode: 'BURGER01',
      assignedLocalIds: ['local-burger-1'],
      status: 'active',
      addedAt: new Date().toISOString(),
    },
  ];

  // Configuración de Tarjeta de Sellos por defecto
  private clubConfig: ClubConfig = {
    id: 'card-default-1',
    name: 'Tarjeta de sellos de La Burger',
    clubName: 'Tarjeta de sellos de La Burger',
    loyaltyTitle: 'Tarjeta de sellos de La Burger',
    brandColor: '#141418',
    cardThemeColor: '#141418',
    logoUrl: '',
    targetStamps: 10,
    stampsRequired: 10,
    rewardText: '1 Combo Burger sin cargo al completar 10 sellos',
    loyaltyReward: '1 Combo Burger sin cargo al completar 10 sellos',
    howToEarn: '1 sello por visita o compra',
    expirationPolicy: 'No vencen',
    welcomeBenefitText: '1 Combo Burger sin cargo al completar 10 sellos',
    pointsPerVisit: 1,
    enabled: true,
    mode: 'per_visit',
    amountPerStamp: 15000,
    maxStampsPerVisit: 3,
    expirationMonths: null,
    allowCashierScan: true,
    allowSelfScan: true,
    rotatingQrEnabled: false,
    rule: {
      type: 'per_visit',
      value: 1,
    },
    rewards: [
      {
        id: 'rew-burger-1',
        label: '1 Combo Burger sin cargo al completar 10 sellos',
        target: 10,
      },
    ],
    active: true,
  };

  // Socios reales del Club (inicia vacío, sin datos falsos)
  private clubMembers: ClubMember[] = [];

  // Mapa interno de emails reales para búsqueda por cajero y reconocimiento de cuenta
  private memberRawEmails: Record<string, string> = {};

  // Historial real de sellos y premios (stamp_logs)
  private stampLogs: StampLogEntry[] = [];

  // Toquecitos reales guardados por cuenta
  private toquecitos: ToquecitoItem[] = [];

  // Usuarios reales de Bóveda del Consumidor (Mi Toque)
  private consumerUsers: Map<string, ConsumerUser> = new Map();
  private consumerReceipts: Map<string, ConsumerReceipt[]> = new Map();

  // Registro inalterable de correcciones
  private auditLogs: AuditLogEntry[] = [];

  // Plantillas de avisos y límites
  private notificationTemplates: NotificationTemplate[] = [
    {
      id: 'tpl-birthday',
      type: 'birthday',
      title: '¡Feliz cumpleaños de parte de La Burger!',
      message:
        'Hoy es tu día. Pasá por el local esta semana y tenés un beneficio especial presentando tu tarjeta de sellos.',
      active: true,
      scheduleInfo: 'Se envía el día del cumpleaños a las 10:00. El beneficio vale por 7 días.',
      benefitDaysValid: 7,
    },
    {
      id: 'tpl-nearby',
      type: 'nearby',
      title: 'Estás cerca de La Burger',
      message: 'Mostrá tu tarjeta en mostrador y sumá tu sello en tu visita.',
      active: true,
      scheduleInfo:
        'El celular muestra la tarjeta en la pantalla de bloqueo cerca del local (Toque no recibe la ubicación del cliente).',
    },
  ];

  private notificationLimits: NotificationLimits = {
    maxPerClientDays: 7,
    quietHoursStart: '21:00',
    quietHoursEnd: '09:00',
  };

  private cartelPrinted = true;

  private planState: PlanState = {
    status: 'trial',
    planId: 'anual',
    tier: 'pro',
    billingCycle: 'annual',
    daysRemaining: TRIAL_DAYS,
    trialStartedAt: new Date().toISOString(),
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
    isSimulated: false,
  };

  // Lista de espera real (inicia vacía)
  private waitlistEntries: WaitlistEntry[] = [];

  // Cartel activo vinculado por defecto: BURGER01
  private carteles: Cartel[] = [
    {
      id: 'cartel-burger-01',
      code: 'BURGER01',
      pin: '102030',
      businessId: 'la-burger',
      name: 'Mostrador Principal',
      role: 'caja',
      status: 'active',
      reviewUrl: 'https://maps.google.com',
      mode: 'smart_hub',
      tileColor: 'black',
      claimStatus: 'claimed',
      scansCount: 0,
      reviewClicksCount: 0,
      createdAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
    },
  ];

  private hubConfig: HubConfig = {
    mode: 'smart_hub',
    blocks: [
      { key: 'club', enabled: true },
      { key: 'receipt', enabled: true },
      { key: 'review', enabled: true },
      { key: 'products', enabled: true },
      { key: 'socials', enabled: true },
      { key: 'details', enabled: true },
    ],
    accentColor: '#D95B26',
    googleReviewUrl: '',
    socials: {
      instagram: '',
      whatsapp: '',
      web: '',
    },
    products: [],
    details: {
      address: '',
      hours: '',
    },
    showToqueFooter: true,
    planPaid: true,
    networkEnabled: false,
  };

  private sales: Sale[] = [];
  private receipts: Receipt[] = [];
  private networkActivations: NetworkActivation[] = [];
  private mpStatus: MercadoPagoStatus = {
    connected: false,
  };
  private reviewClicks = 0;
  private walletPassesIssuedTotal = 0;

  constructor() {
    this.loadPersistedState();
    this.businessClubConfigs.set('la-burger', { ...this.clubConfig });
    this.businessClubCards.set('la-burger', [{ ...this.clubConfig }]);
    this.businessHubConfigs.set('la-burger', { ...this.hubConfig });
  }

  private loadPersistedState(): void {
    if (typeof window === 'undefined') return;
    try {
      const savedReceipts = window.localStorage.getItem('toque_pos_receipts_v1');
      if (savedReceipts) {
        const parsed = JSON.parse(savedReceipts);
        if (Array.isArray(parsed)) {
          this.receipts = parsed;
        }
      }
      const savedSales = window.localStorage.getItem('toque_pos_sales_v1');
      if (savedSales) {
        const parsed = JSON.parse(savedSales);
        if (Array.isArray(parsed)) {
          this.sales = parsed;
        }
      }
      const savedPlan = window.localStorage.getItem('toque_plan_state_v1');
      if (savedPlan) {
        const parsed = JSON.parse(savedPlan);
        if (parsed && typeof parsed === 'object') {
          this.planState = { ...this.planState, ...parsed };
        }
      } else {
        window.localStorage.setItem('toque_plan_state_v1', JSON.stringify(this.planState));
      }
      const savedBiz = window.localStorage.getItem('toque_business_profile_v1');
      if (savedBiz) {
        const parsed = JSON.parse(savedBiz);
        if (parsed && typeof parsed === 'object') {
          this.businessProfile = { ...this.businessProfile, ...parsed };
          this.businesses.set(this.businessProfile.id, { ...this.businessProfile });
        }
      }
      const savedClubCfg = window.localStorage.getItem('toque_club_config_v1');
      if (savedClubCfg) {
        const parsed = JSON.parse(savedClubCfg);
        if (parsed && typeof parsed === 'object') {
          this.clubConfig = { ...this.clubConfig, ...parsed };
          this.businessClubConfigs.set(this.businessProfile.id, { ...this.clubConfig });
        }
      }
      const savedHubCfg = window.localStorage.getItem('toque_hub_config_v1');
      if (savedHubCfg) {
        const parsed = JSON.parse(savedHubCfg);
        if (parsed && typeof parsed === 'object') {
          this.hubConfig = { ...this.hubConfig, ...parsed };
          this.businessHubConfigs.set(this.businessProfile.id, { ...this.hubConfig });
        }
      }
      const savedMembers = window.localStorage.getItem('toque_club_members_v1');
      if (savedMembers) {
        const parsed = JSON.parse(savedMembers);
        if (Array.isArray(parsed)) {
          this.clubMembers = parsed;
        }
      }
      const savedRawEmails = window.localStorage.getItem('toque_member_emails_v1');
      if (savedRawEmails) {
        const parsed = JSON.parse(savedRawEmails);
        if (parsed && typeof parsed === 'object') {
          this.memberRawEmails = parsed;
        }
      }
      const savedStampLogs = window.localStorage.getItem('toque_stamp_logs_v1');
      if (savedStampLogs) {
        const parsed = JSON.parse(savedStampLogs);
        if (Array.isArray(parsed)) {
          this.stampLogs = parsed;
        }
      }
      const savedRecognized = window.localStorage.getItem('toque_recognized_client_v1');
      if (savedRecognized) {
        const parsed = JSON.parse(savedRecognized);
        if (parsed && typeof parsed === 'object' && parsed.email) {
          this.recognizedClient = parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  private persistClubData(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('toque_club_members_v1', JSON.stringify(this.clubMembers));
      window.localStorage.setItem('toque_member_emails_v1', JSON.stringify(this.memberRawEmails));
      window.localStorage.setItem('toque_stamp_logs_v1', JSON.stringify(this.stampLogs));
      window.localStorage.setItem('toque_club_config_v1', JSON.stringify(this.clubConfig));
      window.localStorage.setItem('toque_hub_config_v1', JSON.stringify(this.hubConfig));
      if (this.recognizedClient) {
        window.localStorage.setItem(
          'toque_recognized_client_v1',
          JSON.stringify(this.recognizedClient)
        );
      } else {
        window.localStorage.removeItem('toque_recognized_client_v1');
      }
    } catch {
      // ignore
    }
  }

  private persistPosData(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        'toque_pos_receipts_v1',
        JSON.stringify(this.receipts.slice(0, 100))
      );
      window.localStorage.setItem(
        'toque_pos_sales_v1',
        JSON.stringify(this.sales.slice(0, 100))
      );
    } catch {
      // ignore
    }
  }

  private persistPlanAndBusiness(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('toque_plan_state_v1', JSON.stringify(this.planState));
      window.localStorage.setItem(
        'toque_business_profile_v1',
        JSON.stringify(this.businessProfile)
      );
      window.localStorage.setItem('toque_club_config_v1', JSON.stringify(this.clubConfig));
      window.localStorage.setItem('toque_hub_config_v1', JSON.stringify(this.hubConfig));
    } catch {
      // ignore
    }
  }

  private isUnpaidLockdownActive(): boolean {
    if (this.planState.status === 'active' || this.planState.status === 'custom') {
      return false;
    }
    if (this.planState.unpaidLockdown) {
      return true;
    }
    const trialEndIso =
      this.planState.trialEndsAt ||
      this.planState.expiresAt ||
      this.businessProfile.trialEndsAt;
    if (!trialEndIso) return false;
    const endMs = new Date(trialEndIso).getTime();
    if (Number.isNaN(endMs)) return false;
    const twoDaysAfterTrialMs = endMs + 2 * 86400000;
    return !this.businessProfile.planPaid && Date.now() >= twoDaysAfterTrialMs;
  }

  private getActiveBusinessId(): string {
    return this.currentUser?.businessId || this.businessProfile.id || 'la-burger';
  }

  private syncActiveBusinessStore(): void {
    const bizId = this.getActiveBusinessId();
    this.businesses.set(bizId, { ...this.businessProfile });
    this.businessClubConfigs.set(bizId, { ...this.clubConfig });
    const existingCards = this.businessClubCards.get(bizId) || [{ ...this.clubConfig }];
    const activeId = this.clubConfig.id || existingCards[0]?.id || 'card-default-1';
    this.clubConfig.id = activeId;
    const cardIdx = existingCards.findIndex((c) => c.id === activeId);
    if (cardIdx !== -1) {
      existingCards[cardIdx] = { ...this.clubConfig };
    } else {
      existingCards.unshift({ ...this.clubConfig });
    }
    this.businessClubCards.set(bizId, existingCards);
    this.businessHubConfigs.set(bizId, { ...this.hubConfig });
    this.persistPlanAndBusiness();
  }

  private notifyHubListeners(codeOrBusinessId?: string): void {
    for (const [key, listeners] of this.hubListeners.entries()) {
      if (
        !codeOrBusinessId ||
        key.toUpperCase() === codeOrBusinessId.toUpperCase() ||
        key.toLowerCase() === codeOrBusinessId.toLowerCase()
      ) {
        this.getPublicHub(key)
          .then((hub) => {
            listeners.forEach((cb) => cb(hub));
          })
          .catch(() => {});
      }
    }
  }

  private notifySalesListeners(): void {
    this.persistPosData();
    const current = [...this.sales];
    this.salesListeners.forEach((cb) => cb(current));
  }

  // =========================================================================
  // 1. AUTENTICACIÓN SIN CONTRASEÑAS (CÓDIGO DE 6 DÍGITOS POR CORREO REAL)
  // =========================================================================

  async requestOtp(
    email: string,
    purpose: OtpPurpose = 'login'
  ): Promise<{
    sent: boolean;
    emailSent?: boolean;
    deliveryProvider?: string;
    expiresInSeconds: number;
    resendAvailableInSeconds: number;
    demoHintCode?: string;
  }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Escribí un correo electrónico válido.');
    }

    const now = Date.now();
    const existing = this.otpStore.get(cleanEmail);
    if (existing && now - existing.lastSentAtMs < 60000) {
      const waitSec = Math.ceil((60000 - (now - existing.lastSentAtMs)) / 1000);
      throw new Error(`Esperá ${waitSec} segundos antes de pedir otro código.`);
    }

    let code = Math.floor(100000 + Math.random() * 900000).toString();
    let emailSent = false;
    let deliveryProvider = 'local';

    // Llamada real al servidor (/api/auth/send-otp) para enviar el correo de verificación
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          purpose,
          contextLabel: this.businessProfile.name || 'Toque',
        }),
      });
      const data = await response.json();
      if (!response.ok && data?.error) {
        throw new Error(data.error);
      }
      if (data?.previewCode) {
        code = String(data.previewCode);
      }
      emailSent = Boolean(data?.emailSent);
      deliveryProvider = data?.deliveryProvider || 'server';
    } catch (err: any) {
      if (err?.message && err.message.includes('Esperá')) {
        throw err;
      }
      // Si la llamada HTTP falla en modo offline, mantenemos el código generado en memoria
    }

    this.otpStore.set(cleanEmail, {
      email: cleanEmail,
      code,
      purpose,
      createdAtMs: now,
      expiresAtMs: now + 10 * 60 * 1000,
      lastSentAtMs: now,
      attempts: 0,
      used: false,
    });

    return {
      sent: true,
      emailSent,
      deliveryProvider,
      expiresInSeconds: 600,
      resendAvailableInSeconds: 60,
      demoHintCode: emailSent ? undefined : code,
    };
  }

  async verifyOtp(
    email: string,
    code: string,
    extra?: { businessName?: string; ownerName?: string }
  ): Promise<{
    verified: boolean;
    user?: User;
    account?: RecognizedClientAccount;
  }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      throw new Error('El código tiene que tener 6 números.');
    }

    const record = this.otpStore.get(cleanEmail);
    let verifiedOnServer = false;

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      });
      if (res.ok) {
        verifiedOnServer = true;
      } else if (!record) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Código incorrecto o vencido.');
      }
    } catch (err: any) {
      if (!record && err?.message) {
        throw err;
      }
    }

    if (!verifiedOnServer) {
      if (!record) {
        throw new Error('Primero pedí un código para tu correo electrónico.');
      }
      if (record.used) {
        throw new Error('Este código ya fue usado. Pedí uno nuevo.');
      }
      if (Date.now() > record.expiresAtMs) {
        throw new Error('El código venció (dura 10 minutos). Pedí uno nuevo.');
      }
      if (record.attempts >= 5) {
        throw new Error('Superaste los 5 intentos permitidos. Pedí un código nuevo.');
      }
      if (record.code !== cleanCode) {
        record.attempts += 1;
        const remaining = 5 - record.attempts;
        if (remaining <= 0) {
          throw new Error(
            'Código incorrecto. Superaste los 5 intentos permitidos. Pedí un código nuevo.'
          );
        }
        throw new Error(`El código no coincide. Te quedan ${remaining} intento(s).`);
      }
      record.used = true;
    } else if (record) {
      record.used = true;
    }

    const purpose = record?.purpose || 'login';

    // Si es flujo de cliente del Club
    if (purpose === 'register_client' || purpose === 'cashier_confirm') {
      if (!this.recognizedClient || this.recognizedClient.email !== cleanEmail) {
        this.recognizedClient = {
          accountId: `acc-${Date.now().toString(36)}`,
          name: extra?.ownerName || cleanEmail.split('@')[0],
          email: cleanEmail,
        };
      }
      const account = await this.recognizeAccount(cleanEmail);
      return { verified: true, account };
    }

    // Si es registro de nuevo comercio
    if (purpose === 'register_merchant' || extra?.businessName) {
      const reg = await this.register({
        businessName: extra?.businessName || 'La Burger',
        ownerName: extra?.ownerName || cleanEmail.split('@')[0],
        email: cleanEmail,
      });
      return { verified: true, user: reg.user };
    }

    // Buscar miembro del equipo en memoria
    const teamMember = this.teamMembers.find(
      (m) => m.email.toLowerCase() === cleanEmail && m.status === 'active'
    );

    // BLINDAJE SUPER ADMIN: Únicamente fedeeeloiss@gmail.com o correos dados de alta en toque_admins
    const isSuperAdmin = this.isAuthorizedSuperAdmin(cleanEmail);

    if (teamMember || isSuperAdmin) {
      const targetBizId = teamMember?.businessId || 'la-burger';
      const biz = this.businesses.get(targetBizId);
      if (biz) {
        this.businessProfile = { ...biz };
        const savedClub = this.businessClubConfigs.get(targetBizId);
        const savedHub = this.businessHubConfigs.get(targetBizId);
        if (savedClub) this.clubConfig = { ...savedClub };
        if (savedHub) this.hubConfig = { ...savedHub };
      }

      const user: User = {
        id: teamMember ? `user-${teamMember.id}` : 'user-superadmin-root',
        email: cleanEmail,
        name: teamMember ? teamMember.name : 'Fede (Super Admin Toque)',
        businessId: targetBizId,
        role: isSuperAdmin ? 'superadmin' : teamMember!.role,
        assignedCartelId: teamMember?.assignedCartelId || 'cartel-burger-01',
        assignedCartelCode: teamMember?.assignedCartelCode || 'BURGER01',
        assignedLocalIds:
          teamMember?.assignedLocalIds ||
          this.locals.filter((l) => l.businessId === targetBizId).map((l) => l.id),
        isSuperAdmin,
      };
      this.currentUser = user;
      return { verified: true, user };
    }

    // Si ingresa un correo no registrado aún como otro comercio, lo vinculamos al comercio activo
    const newUser: User = {
      id: `user-${Date.now().toString(36)}`,
      email: cleanEmail,
      name: cleanEmail.split('@')[0],
      businessId: this.businessProfile.id,
      role: 'owner',
      assignedCartelId: this.carteles[0]?.id,
      assignedCartelCode: this.carteles[0]?.code,
      assignedLocalIds: this.locals.map((l) => l.id),
      isSuperAdmin: false,
    };
    this.currentUser = newUser;
    return { verified: true, user: newUser };
  }

  async register(data: {
    businessName: string;
    ownerName: string;
    email: string;
  }): Promise<{ user: User; token: string }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanBizName = data.businessName.trim() || 'La Burger';
    const cleanOwnerName = data.ownerName.trim() || cleanEmail.split('@')[0];

    const slug =
      cleanBizName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `comercio-${Date.now().toString(36)}`;

    const bizId = this.businesses.has(slug) ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug;
    const cartelCode = `${cleanBizName
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase() || 'LOCAL'}01`;

    const newLocalId = `local-${Date.now().toString(36)}`;
    const newCartelId = `cartel-${Date.now().toString(36)}`;

    const newBiz: BusinessProfile = {
      id: bizId,
      name: cleanBizName,
      ownerName: cleanOwnerName,
      email: cleanEmail,
      reviewUrl: 'https://maps.google.com',
      cardThemeColor: '#1e1b4b',
      loyaltyTitle: `Tarjeta de sellos de ${cleanBizName}`,
      loyaltyReward: 'Beneficio exclusivo en tu próxima visita',
      howToEarn: '1 sello por visita o compra',
      expirationPolicy: 'No vencen',
      stampsRequired: 10,
      planPaid: false,
      networkEnabled: true,
      createdAt: new Date().toISOString(),
      scansCount: 0,
      reviewClicksCount: 0,
      walletPassesIssued: 0,
    };

    this.businesses.set(bizId, newBiz);
    this.businessProfile = { ...newBiz };

    const newLocal: ClubLocal = {
      id: newLocalId,
      businessId: bizId,
      code: cartelCode,
      name: `Sucursal ${cleanBizName}`,
      address: '',
      visitsCount: 0,
      newMembersCount: 0,
      returningCount: 0,
      rewardsRedeemedCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.locals.push(newLocal);

    const newCartel: Cartel = {
      id: newCartelId,
      code: cartelCode,
      pin: '112233',
      businessId: bizId,
      name: `Mostrador ${cleanBizName}`,
      role: 'caja',
      status: 'active',
      reviewUrl: '',
      mode: 'smart_hub',
      tileColor: 'black',
      claimStatus: 'claimed',
      scansCount: 0,
      reviewClicksCount: 0,
      createdAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
    };
    this.carteles.push(newCartel);

    const newTeamMember: TeamMember = {
      id: `team-${Date.now().toString(36)}`,
      businessId: bizId,
      name: cleanOwnerName,
      email: cleanEmail,
      role: 'owner',
      assignedCartelId: newCartelId,
      assignedCartelCode: cartelCode,
      assignedLocalIds: [newLocalId],
      status: 'active',
      addedAt: new Date().toISOString(),
    };
    this.teamMembers.push(newTeamMember);

    this.clubConfig = {
      ...this.clubConfig,
      id: `card-${Date.now().toString(36)}`,
      name: `Tarjeta de sellos de ${cleanBizName}`,
      clubName: `Tarjeta de sellos de ${cleanBizName}`,
      loyaltyTitle: `Tarjeta de sellos de ${cleanBizName}`,
      brandColor: '#141418',
      cardThemeColor: '#141418',
      targetStamps: 10,
      stampsRequired: 10,
      rewardText: 'Beneficio exclusivo en tu próxima visita',
      loyaltyReward: 'Beneficio exclusivo en tu próxima visita',
      howToEarn: '1 sello por visita o compra',
      expirationPolicy: 'No vencen',
      rewards: [
        {
          id: `rew-${Date.now().toString(36)}`,
          label: 'Beneficio exclusivo en tu próxima visita',
          target: 10,
        },
      ],
    };

    this.hubConfig = {
      ...this.hubConfig,
      accentColor: '#D95B26',
      googleReviewUrl: '',
      socials: {
        instagram: '',
        whatsapp: '',
        web: '',
      },
      products: [],
      details: {
        address: '',
        hours: '',
      },
    };

    this.businessClubCards.set(bizId, [{ ...this.clubConfig }]);
    this.syncActiveBusinessStore();

    const user: User = {
      id: `user-${newTeamMember.id}`,
      email: cleanEmail,
      name: cleanOwnerName,
      businessId: bizId,
      role: 'owner',
      assignedCartelId: newCartelId,
      assignedCartelCode: cartelCode,
      assignedLocalIds: [newLocalId],
    };
    this.currentUser = user;

    return { user, token: 'toque-session-active' };
  }

  async login(credentials: {
    email: string;
    code?: string;
  }): Promise<{ user: User; token: string }> {
    const cleanEmail = credentials.email.trim().toLowerCase();
    if (credentials.code) {
      const res = await this.verifyOtp(cleanEmail, credentials.code);
      if (res.user) {
        return { user: res.user, token: 'toque-session-active' };
      }
    }

    const teamMember = this.teamMembers.find(
      (m) => m.email.toLowerCase() === cleanEmail && m.status === 'active'
    );
    const isSuperAdmin = this.isAuthorizedSuperAdmin(cleanEmail);
    const user: User = {
      id: teamMember ? `user-${teamMember.id}` : `user-${Date.now().toString(36)}`,
      email: cleanEmail,
      name: teamMember ? teamMember.name : cleanEmail.split('@')[0],
      businessId: teamMember?.businessId || this.businessProfile.id,
      role: isSuperAdmin ? 'superadmin' : teamMember ? teamMember.role : 'owner',
      assignedCartelId: teamMember?.assignedCartelId || this.carteles[0]?.id,
      assignedCartelCode: teamMember?.assignedCartelCode || this.carteles[0]?.code,
      assignedLocalIds: teamMember?.assignedLocalIds || this.locals.map((l) => l.id),
      isSuperAdmin,
    };
    this.currentUser = user;
    return { user, token: 'toque-session-active' };
  }

  async logout(): Promise<void> {
    this.currentUser = null;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  async updateAccountEmail(newEmail: string): Promise<{ user: User; business: BusinessProfile }> {
    const cleanEmail = (newEmail || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Ingresá un correo electrónico válido.');
    }

    const oldEmail = (this.currentUser?.email || this.businessProfile.email || '').toLowerCase();
    this.businessProfile.email = cleanEmail;

    if (this.currentUser) {
      this.currentUser = {
        ...this.currentUser,
        email: cleanEmail,
      };
    }

    this.teamMembers = this.teamMembers.map((tm) => {
      if (tm.email.toLowerCase() === oldEmail || tm.role === 'owner') {
        return { ...tm, email: cleanEmail };
      }
      return tm;
    });

    this.syncActiveBusinessStore();

    const userObj: User = this.currentUser || {
      id: 'user-owner',
      email: cleanEmail,
      name: this.businessProfile.ownerName || cleanEmail.split('@')[0],
      businessId: this.businessProfile.id,
      role: 'owner',
    };

    return {
      user: { ...userObj },
      business: { ...this.businessProfile },
    };
  }

  async deleteAccount(): Promise<{ deleted: boolean }> {
    const bizId = this.getActiveBusinessId();
    this.businesses.delete(bizId);
    this.businessClubConfigs.delete(bizId);
    this.businessClubCards.delete(bizId);
    this.businessHubConfigs.delete(bizId);
    this.locals = this.locals.filter((l) => l.businessId !== bizId);
    this.carteles = this.carteles.filter((c) => c.businessId !== bizId);
    this.teamMembers = this.teamMembers.filter((t) => t.businessId !== bizId);
    this.clubMembers = this.clubMembers.filter((m) => m.businessId !== bizId);
    this.sales = this.sales.filter((s) => s.businessId !== bizId);
    this.receipts = this.receipts.filter((r) => r.businessId !== bizId);
    this.currentUser = null;

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('toque_plan_state_v1');
        window.localStorage.removeItem('toque_business_profile_v1');
        window.localStorage.removeItem('toque_pos_active_profile_v1');
        window.localStorage.removeItem('toque_pos_receipts_v1');
        window.localStorage.removeItem('toque_pos_sales_v1');
      } catch {
        // ignore
      }
    }

    return { deleted: true };
  }

  // =========================================================================
  // 2. ALTA PÚBLICA DEL CLIENTE (/club/:codigoLocal o /u/:businessId)
  // =========================================================================

  private resolveCartelAndBusiness(codeOrSlug: string): {
    business: BusinessProfile;
    cartel: Cartel;
    local: ClubLocal;
    clubCfg: ClubConfig;
    hubCfg: HubConfig;
  } {
    const clean = (codeOrSlug || 'BURGER01').trim();
    const upper = clean.toUpperCase();
    const lower = clean.toLowerCase();

    // 1. Buscar por código de cartel o código de local
    let cartel = this.carteles.find((c) => c.code.toUpperCase() === upper);
    let local = this.locals.find((l) => l.code.toUpperCase() === upper);
    let business = cartel?.businessId ? this.businesses.get(cartel.businessId) : undefined;

    // 2. Si no se encontró por código, buscar por businessId / slug (ej. la-burger)
    if (!business) {
      business =
        this.businesses.get(lower) ||
        Array.from(this.businesses.values()).find(
          (b) => b.id.toLowerCase() === lower || b.name.toLowerCase().replace(/\s+/g, '-') === lower
        );
    }

    if (!business) {
      business = this.businesses.get('la-burger') || this.businessProfile;
    }

    if (!cartel) {
      cartel =
        this.carteles.find((c) => c.businessId === business!.id) || this.carteles[0];
    }

    if (!local) {
      local =
        this.locals.find((l) => l.businessId === business!.id) || this.locals[0];
    }

    const clubCfg = this.businessClubConfigs.get(business.id) || this.clubConfig;
    const hubCfg = this.businessHubConfigs.get(business.id) || this.hubConfig;

    return { business, cartel, local, clubCfg, hubCfg };
  }

  async getClubPublic(localCode: string): Promise<ClubPublicInfo> {
    const { business, local, clubCfg } = this.resolveCartelAndBusiness(localCode);

    return {
      businessId: business.id,
      businessName: business.name,
      localId: local.id,
      localCode: local.code,
      localName: local.name,
      localAddress: local.address,
      programName: clubCfg.loyaltyTitle || clubCfg.name || `Tarjeta de sellos de ${business.name}`,
      loyaltyTitle: clubCfg.loyaltyTitle || clubCfg.name || `Tarjeta de sellos de ${business.name}`,
      brandColor: clubCfg.cardThemeColor || clubCfg.brandColor || '#141414',
      colorPreset: clubCfg.colorPreset || 'dark',
      customColor: clubCfg.customColor || undefined,
      logoUrl: clubCfg.logoUrl,
      targetStamps: clubCfg.targetStamps || clubCfg.stampsRequired || 10,
      rewardText:
        clubCfg.loyaltyReward ||
        clubCfg.rewardText ||
        clubCfg.rewards[0]?.label ||
        'Beneficio al completar tus sellos',
      rewardValueArs: clubCfg.rewardValueArs || 0,
      howToEarn: clubCfg.howToEarn || '1 sello por visita o compra',
      expirationPolicy: clubCfg.expirationPolicy || 'No vencen',
      mode: clubCfg.mode || 'per_visit',
      amountPerStamp: clubCfg.amountPerStamp || 15000,
      maxStampsPerVisit: clubCfg.maxStampsPerVisit || 3,
      allowSelfScan: clubCfg.allowSelfScan ?? true,
      allowCashierScan: clubCfg.allowCashierScan ?? true,
    };
  }

  private calculateAgeFromBirthDate(birthDate?: string): { age?: number; isMinor: boolean } {
    if (!birthDate) return { age: undefined, isMinor: false };
    const parsed = new Date(birthDate);
    if (isNaN(parsed.getTime())) return { age: undefined, isMinor: false };
    const today = new Date();
    let age = today.getFullYear() - parsed.getFullYear();
    const monthDiff = today.getMonth() - parsed.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
      age -= 1;
    }
    const cleanAge = Math.max(0, age);
    return { age: cleanAge, isMinor: cleanAge < 18 };
  }

  async registerMember(data: {
    localCode?: string;
    name?: string;
    email: string;
    phone?: string;
    birthDate?: string;
    age?: number;
    isMinor?: boolean;
    birthDay?: number;
    birthMonth?: number;
    adult?: boolean;
    marketingConsent: boolean;
  }): Promise<{
    member: ClubMember;
    account: RecognizedClientAccount;
    requiresOtp: boolean;
  }> {
    this.loadPersistedState();
    await this.getPlanState();
    if (this.isUnpaidLockdownActive()) {
      throw new Error(
        'El registro al Club de este comercio se encuentra suspendido temporalmente.'
      );
    }

    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Ingresá un correo electrónico válido.');
    }

    const derivedName = (data.name || '').trim() || cleanEmail.split('@')[0];
    const pub = await this.getClubPublic(data.localCode || 'BURGER01');
    const masked = maskEmailAddress(cleanEmail);
    const accountId = this.recognizedClient?.accountId || `acc-${Date.now().toString(36)}`;

    const calc = this.calculateAgeFromBirthDate(data.birthDate);
    const finalAge = data.age !== undefined ? data.age : calc.age;
    const finalIsMinor = data.isMinor !== undefined ? data.isMinor : calc.isMinor;
    const finalConsent = finalIsMinor ? false : Boolean(data.marketingConsent);

    let parsedDay = data.birthDay;
    let parsedMonth = data.birthMonth;
    if (data.birthDate && (!parsedDay || !parsedMonth)) {
      const parts = data.birthDate.split('-');
      if (parts.length === 3) {
        parsedMonth = parseInt(parts[1], 10);
        parsedDay = parseInt(parts[2], 10);
      }
    }

    this.recognizedClient = {
      accountId,
      name: derivedName,
      email: cleanEmail,
      birthDay: parsedDay,
      birthMonth: parsedMonth,
    };

    let existing = this.clubMembers.find(
      (m) =>
        (this.memberRawEmails[m.id] === cleanEmail || m.email?.toLowerCase() === cleanEmail) &&
        m.businessId === pub.businessId
    );

    if (!existing) {
      const newId = `member-${Date.now().toString(36)}`;
      const barcodeToken = generateBarcodeToken32();
      const nowIso = new Date().toISOString();

      existing = {
        id: newId,
        accountId,
        businessId: pub.businessId,
        businessName: pub.businessName,
        localId: pub.localId,
        localCode: pub.localCode,
        localName: pub.localName,
        memberCode: barcodeToken,
        barcodeToken,
        name: derivedName,
        email: cleanEmail,
        phone: data.phone?.trim() || '',
        birthDate: data.birthDate || '',
        age: finalAge,
        isMinor: finalIsMinor,
        contact: masked,
        maskedEmail: masked,
        birthDay: parsedDay,
        birthMonth: parsedMonth,
        anonymous: false,
        marketingConsent: finalConsent,
        points: 1,
        stamps: 1,
        stampsRequired: pub.targetStamps,
        targetStamps: pub.targetStamps,
        rewardText: pub.rewardText,
        rewardValueArs: pub.rewardValueArs || 0,
        colorPreset: pub.colorPreset || 'dark',
        customColor: pub.customColor,
        logoUrl: pub.logoUrl,
        rewardsRedeemed: 0,
        joinedAt: nowIso,
        lastVisitAt: nowIso,
        lastStampedAt: nowIso,
        consent: finalConsent,
        stampHistory: [
          {
            id: `st-init-${Date.now().toString(36)}`,
            memberId: newId,
            localId: pub.localId,
            localName: pub.localName,
            count: 1,
            source: 'self',
            actorName: 'Alta en el Club (+1 sello)',
            createdAt: nowIso,
          },
        ],
      };
      this.memberRawEmails[newId] = cleanEmail;
      this.clubMembers.unshift(existing);

      this.stampLogs.unshift({
        id: `log-${Date.now().toString(36)}`,
        businessId: pub.businessId,
        memberId: newId,
        memberCode: barcodeToken,
        memberName: derivedName,
        memberEmail: masked,
        memberPhone: data.phone?.trim() || '',
        action: 'stamp_added',
        stampsDelta: 1,
        localName: pub.localName,
        staffEmail: 'registro-hub@toque.com.ar',
        createdAt: nowIso,
      });

      const localObj = this.locals.find((l) => l.id === pub.localId);
      if (localObj) {
        localObj.newMembersCount += 1;
        localObj.visitsCount += 1;
      }
      this.persistClubData();
      this.notifyHubListeners(pub.localCode);
      this.notifyHubListeners(pub.businessId);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      fetch('/api/club/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          customerName: derivedName,
          name: derivedName,
          businessName: pub.businessName,
          localCode: pub.localCode,
          memberCode: barcodeToken,
          stamps: 1,
          stampsRequired: pub.targetStamps,
          rewardText: pub.rewardText,
          hubUrl: `${origin}/u/${pub.localCode}`,
          walletUrl: `${origin}/toquecitos`,
        }),
      }).catch(() => {});
    } else {
      if (!existing.barcodeToken || existing.barcodeToken.length < 16) {
        existing.barcodeToken = generateBarcodeToken32();
        existing.memberCode = existing.barcodeToken;
      }
      existing.businessName = pub.businessName;
      existing.rewardText = pub.rewardText;
      existing.rewardValueArs = pub.rewardValueArs || existing.rewardValueArs || 0;
      existing.colorPreset = pub.colorPreset || existing.colorPreset || 'dark';
      existing.customColor = pub.customColor || existing.customColor;
      existing.logoUrl = pub.logoUrl || existing.logoUrl;
      this.persistClubData();
    }

    const account = await this.recognizeAccount(cleanEmail);
    return {
      member: existing,
      account,
      requiresOtp: false,
    };
  }

  async createAnonymousCard(localCode: string): Promise<{ member: ClubMember }> {
    this.loadPersistedState();
    await this.getPlanState();
    if (this.isUnpaidLockdownActive()) {
      throw new Error(
        'El registro al Club de este comercio se encuentra suspendido temporalmente.'
      );
    }
    const pub = await this.getClubPublic(localCode || 'BURGER01');
    const barcodeToken = generateBarcodeToken32();
    const member: ClubMember = {
      id: `anon-${Date.now().toString(36)}`,
      accountId: `acc-anon-${barcodeToken.slice(0, 8)}`,
      businessId: pub.businessId,
      businessName: pub.businessName,
      localId: pub.localId,
      localCode: pub.localCode,
      localName: pub.localName,
      memberCode: barcodeToken,
      barcodeToken,
      name: '',
      contact: 'Sin correo',
      maskedEmail: 'Sin datos',
      anonymous: true,
      marketingConsent: false,
      points: 0,
      stamps: 0,
      stampsRequired: pub.targetStamps,
      targetStamps: pub.targetStamps,
      rewardText: pub.rewardText,
      rewardValueArs: pub.rewardValueArs || 0,
      colorPreset: pub.colorPreset || 'dark',
      customColor: pub.customColor,
      logoUrl: pub.logoUrl,
      rewardsRedeemed: 0,
      joinedAt: new Date().toISOString(),
      consent: false,
      stampHistory: [],
    };

    this.clubMembers.unshift(member);
    const localObj = this.locals.find((l) => l.id === pub.localId);
    if (localObj) {
      localObj.newMembersCount += 1;
    }
    this.persistClubData();
    this.notifyHubListeners(pub.localCode);
    return { member };
  }

  async recognizeAccount(email?: string): Promise<RecognizedClientAccount> {
    this.loadPersistedState();
    const targetEmail = (email || this.recognizedClient?.email || '').trim().toLowerCase();
    if (!targetEmail) {
      return { recognized: false };
    }

    const matchingIds = Object.entries(this.memberRawEmails)
      .filter(([, raw]) => raw.toLowerCase() === targetEmail)
      .map(([id]) => id);

    const cards = this.clubMembers
      .filter((m) => matchingIds.includes(m.id) || m.email?.toLowerCase() === targetEmail)
      .map((m) => {
        const biz = m.businessId ? this.businesses.get(m.businessId) : this.businessProfile;
        const cfg = m.businessId
          ? this.businessClubConfigs.get(m.businessId) || this.clubConfig
          : this.clubConfig;
        if (!m.barcodeToken || m.barcodeToken.length < 16) {
          m.barcodeToken =
            m.memberCode && m.memberCode.length >= 16
              ? m.memberCode
              : generateBarcodeToken32();
          m.memberCode = m.barcodeToken;
        }
        m.businessName = m.businessName || biz?.name || 'La Burger';
        m.rewardText =
          m.rewardText ||
          cfg.loyaltyReward ||
          cfg.rewardText ||
          'Beneficio al completar tus sellos';
        m.rewardValueArs = m.rewardValueArs ?? cfg.rewardValueArs ?? 0;
        m.colorPreset = m.colorPreset || cfg.colorPreset || 'dark';
        m.customColor = m.customColor || cfg.customColor;
        m.logoUrl = m.logoUrl || cfg.logoUrl;
        m.stampsRequired = m.stampsRequired || m.targetStamps || cfg.targetStamps || 10;
        m.targetStamps = m.stampsRequired;
        return m;
      });

    const firstCard = cards[0];
    const name = this.recognizedClient?.name || firstCard?.name || targetEmail.split('@')[0];
    const accountId =
      this.recognizedClient?.accountId || firstCard?.accountId || `acc-${targetEmail}`;

    this.recognizedClient = {
      accountId,
      name,
      email: targetEmail,
      birthDay: this.recognizedClient?.birthDay || firstCard?.birthDay,
      birthMonth: this.recognizedClient?.birthMonth || firstCard?.birthMonth,
    };
    this.persistClubData();

    const myToquecitos = this.toquecitos.filter((t) => t.accountId === accountId);

    return {
      recognized: true,
      accountId,
      name,
      email: targetEmail,
      maskedEmail: maskEmailAddress(targetEmail),
      birthDay: this.recognizedClient.birthDay,
      birthMonth: this.recognizedClient.birthMonth,
      cards,
      toquecitosCount: myToquecitos.length,
    };
  }

  async addCardToAccount(data: {
    localCode: string;
    marketingConsent: boolean;
  }): Promise<{
    member: ClubMember;
    account: RecognizedClientAccount;
  }> {
    this.loadPersistedState();
    await this.getPlanState();
    if (this.isUnpaidLockdownActive()) {
      throw new Error(
        'El registro al Club de este comercio se encuentra suspendido temporalmente.'
      );
    }
    if (!this.recognizedClient) {
      throw new Error('Primero ingresá con tu correo para reconocer tu cuenta.');
    }

    const pub = await this.getClubPublic(data.localCode);
    const cleanEmail = this.recognizedClient.email;
    const masked = maskEmailAddress(cleanEmail);

    let existing = this.clubMembers.find(
      (m) =>
        (this.memberRawEmails[m.id] === cleanEmail || m.email?.toLowerCase() === cleanEmail) &&
        m.businessId === pub.businessId
    );

    if (!existing) {
      const newId = `member-${Date.now().toString(36)}`;
      const barcodeToken = generateBarcodeToken32();
      existing = {
        id: newId,
        accountId: this.recognizedClient.accountId,
        businessId: pub.businessId,
        businessName: pub.businessName,
        localId: pub.localId,
        localCode: pub.localCode,
        localName: pub.localName,
        memberCode: barcodeToken,
        barcodeToken,
        name: this.recognizedClient.name,
        email: cleanEmail,
        contact: masked,
        maskedEmail: masked,
        birthDay: this.recognizedClient.birthDay,
        birthMonth: this.recognizedClient.birthMonth,
        anonymous: false,
        marketingConsent: Boolean(data.marketingConsent),
        points: 0,
        stamps: 0,
        stampsRequired: pub.targetStamps,
        targetStamps: pub.targetStamps,
        rewardText: pub.rewardText,
        rewardValueArs: pub.rewardValueArs || 0,
        colorPreset: pub.colorPreset || 'dark',
        customColor: pub.customColor,
        logoUrl: pub.logoUrl,
        rewardsRedeemed: 0,
        joinedAt: new Date().toISOString(),
        consent: Boolean(data.marketingConsent),
        stampHistory: [],
      };
      this.memberRawEmails[newId] = cleanEmail;
      this.clubMembers.unshift(existing);
      this.persistClubData();
    }

    const account = await this.recognizeAccount(cleanEmail);
    return { member: existing, account };
  }

  // =========================================================================
  // 3. SUMAR SELLOS (REGLA ESTRICTA DE 24H), HISTORIAL Y CANJEO DE PREMIOS
  // =========================================================================

  private async syncMemberPassOnServer(member: ClubMember): Promise<void> {
    if (!member.walletSerial) return;
    const biz = member.businessId ? this.businesses.get(member.businessId) : this.businessProfile;
    const cfg = member.businessId
      ? this.businessClubConfigs.get(member.businessId) || this.clubConfig
      : this.clubConfig;

    const barcodeToken =
      member.barcodeToken && member.barcodeToken.length >= 16
        ? member.barcodeToken
        : member.memberCode && member.memberCode.length >= 16
        ? member.memberCode
        : generateBarcodeToken32();

    member.barcodeToken = barcodeToken;
    member.memberCode = barcodeToken;

    try {
      const res = await fetch(`/api/wallet/pass/${encodeURIComponent(member.walletSerial)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumber: member.walletSerial,
          walletSerial: member.walletSerial,
          isUpdate: true,
          businessId: member.businessId || this.businessProfile.id,
          businessName: member.businessName || biz?.name || this.businessProfile.name,
          memberName: member.anonymous ? undefined : member.name,
          memberId: member.id,
          stamps: member.stamps,
          stampsRequired: member.targetStamps || cfg.targetStamps || 10,
          rewardText:
            member.rewardText ||
            cfg.loyaltyReward ||
            cfg.rewardText ||
            'Beneficio al completar tus sellos',
          barcodeToken,
          colorPreset: member.colorPreset || cfg.colorPreset || 'dark',
          color: member.customColor || cfg.customColor || undefined,
          logoURL: member.logoUrl || cfg.logoUrl || undefined,
          notification: member.walletLastNotification ?? ' ',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        member.walletSyncError =
          data?.walletSyncError ||
          data?.error ||
          'No se pudo actualizar la tarjeta en tu billetera.';
      } else {
        member.walletSyncError = data?.walletSyncError || undefined;
      }
      this.persistClubData();
    } catch {
      member.walletSyncError = 'No pudimos conectar con el servicio de billetera.';
      this.persistClubData();
    }
  }

  async addStampByCashier(data: {
    memberId?: string;
    memberCode?: string;
    email?: string;
    phone?: string;
    amount?: number;
    localId?: string;
    otpCode?: string;
  }): Promise<{
    member: ClubMember;
    stampsAdded: number;
    rewardReady: boolean;
    toquecito?: ToquecitoItem;
    cooldown?: boolean;
    remainingMs?: number;
    message?: string;
  }> {
    this.loadPersistedState();
    let member: ClubMember | undefined;

    if (data.memberId) {
      const qUpper = data.memberId.trim().toUpperCase();
      member = this.clubMembers.find(
        (m) =>
          m.id === data.memberId ||
          m.barcodeToken?.toUpperCase() === qUpper ||
          m.memberCode?.toUpperCase() === qUpper
      );
    }
    if (!member && data.memberCode) {
      const codeUpper = data.memberCode.trim().toUpperCase();
      member = this.clubMembers.find(
        (m) =>
          m.barcodeToken?.toUpperCase() === codeUpper ||
          m.memberCode?.toUpperCase() === codeUpper
      );
    }
    if (!member && data.email) {
      const q = data.email.trim().toLowerCase();
      const foundId = Object.entries(this.memberRawEmails).find(
        ([, raw]) => raw.toLowerCase() === q
      )?.[0];
      if (foundId) {
        member = this.clubMembers.find((m) => m.id === foundId);
      }
      if (!member) {
        member = this.clubMembers.find(
          (m) =>
            m.email?.toLowerCase() === q ||
            m.barcodeToken?.toLowerCase() === q ||
            m.memberCode?.toLowerCase() === q ||
            m.phone?.toLowerCase() === q ||
            m.id.toLowerCase() === q
        );
      }
    }

    if (!member) {
      throw new Error(
        'No encontramos una tarjeta para ese cliente. Podés buscar por correo o escanear el código QR de su tarjeta.'
      );
    }

    // Regla estricta de 24 horas para sumar sellos
    if (member.lastStampedAt) {
      const elapsedMs = Date.now() - new Date(member.lastStampedAt).getTime();
      if (!Number.isNaN(elapsedMs) && elapsedMs < 86400000) {
        const remainingMs = 86400000 - elapsedMs;
        const hours = Math.floor(remainingMs / 3600000);
        const minutes = Math.max(1, Math.ceil((remainingMs % 3600000) / 60000));
        return {
          member: { ...member },
          stampsAdded: 0,
          rewardReady: member.stamps >= (member.targetStamps || 10),
          cooldown: true,
          remainingMs,
          message: `Próximo sello disponible en ${hours} h ${minutes} min`,
        };
      }
    }

    if (data.otpCode) {
      const rawEmail = this.memberRawEmails[member.id] || member.email;
      if (rawEmail) {
        await this.verifyOtp(rawEmail, data.otpCode);
      }
    }

    const local = this.locals.find((l) => l.id === data.localId) || this.locals[0];

    let stampsToAdd = 1;
    if (this.clubConfig.mode === 'per_amount' && data.amount !== undefined) {
      const unit = Math.max(1, this.clubConfig.amountPerStamp || 15000);
      const maxPerVisit = Math.max(1, this.clubConfig.maxStampsPerVisit || 3);
      const calculated = Math.floor(data.amount / unit);
      if (calculated <= 0) {
        throw new Error(
          `El monto ingresado ($${data.amount.toLocaleString('es-AR')}) no alcanza el mínimo de $${unit.toLocaleString('es-AR')} para 1 sello.`
        );
      }
      stampsToAdd = Math.min(maxPerVisit, calculated);
    }

    const nowIso = new Date().toISOString();
    const stampEntry = {
      id: `st-${Date.now().toString(36)}`,
      memberId: member.id,
      localId: local.id,
      localName: local.name,
      count: stampsToAdd,
      source: 'cashier' as const,
      amountArs: data.amount,
      actorName: this.currentUser?.name || 'Cajero en mostrador',
      createdAt: nowIso,
    };

    member.stamps = (member.stamps || 0) + stampsToAdd;
    member.points = member.stamps;
    member.lastVisitAt = nowIso;
    member.lastStampedAt = nowIso;
    member.stampHistory = [stampEntry, ...(member.stampHistory || [])];

    local.visitsCount += 1;
    local.returningCount += 1;

    const logEntry: StampLogEntry = {
      id: `log-${Date.now().toString(36)}`,
      businessId: member.businessId || this.businessProfile.id,
      memberId: member.id,
      memberCode: member.barcodeToken || member.memberCode,
      memberName: member.name || member.maskedEmail || 'Cliente',
      memberEmail: member.maskedEmail || member.contact,
      memberPhone: member.phone || '',
      action: 'stamp_added',
      stampsDelta: stampsToAdd,
      localName: local.name,
      staffEmail: this.currentUser?.email || this.businessProfile.email,
      createdAt: nowIso,
    };
    this.stampLogs.unshift(logEntry);

    const toquecito: ToquecitoItem = {
      id: `toq-${Date.now().toString(36)}`,
      accountId: member.accountId || member.id,
      businessId: this.businessProfile.id,
      businessName: this.businessProfile.name,
      initial: this.businessProfile.name.charAt(0).toUpperCase(),
      brandColor: this.clubConfig.brandColor || '#141414',
      createdAt: nowIso,
    };
    this.toquecitos.unshift(toquecito);

    this.persistClubData();
    await this.syncMemberPassOnServer(member);

    this.notifyHubListeners(member.localCode);
    this.notifyHubListeners(member.businessId);

    const target = member.targetStamps || this.clubConfig.targetStamps || 10;
    return {
      member: { ...member },
      stampsAdded: stampsToAdd,
      rewardReady: member.stamps >= target,
      toquecito,
    };
  }

  async claimSelfStamp(data: {
    localCode: string;
    memberId: string;
    rotatingToken?: string;
  }): Promise<{
    member: ClubMember;
    stampsAdded: number;
    rewardReady: boolean;
    toquecito?: ToquecitoItem;
    cooldown?: boolean;
    remainingMs?: number;
  }> {
    this.loadPersistedState();
    await this.getPlanState();
    if (this.isUnpaidLockdownActive()) {
      throw new Error('El Club de este comercio no está disponible en este momento.');
    }
    const pub = await this.getClubPublic(data.localCode);
    if (!pub.allowSelfScan) {
      throw new Error('Este local suma sellos únicamente con el cajero en mostrador.');
    }
    if (pub.mode === 'per_amount') {
      throw new Error(
        'El programa de este local es por monto de compra. Pedile al cajero que escanee tu tarjeta.'
      );
    }

    const member = this.clubMembers.find((m) => m.id === data.memberId);
    if (!member) {
      throw new Error('No encontramos tu tarjeta.');
    }

    const target = member.targetStamps || pub.targetStamps || 10;

    // 1. Verificar last_stamped_at del miembro en ese negocio (Regla estricta de 24 horas = 86400000 ms)
    if (member.lastStampedAt) {
      const elapsedMs = Date.now() - new Date(member.lastStampedAt).getTime();
      if (!Number.isNaN(elapsedMs) && elapsedMs < 86400000) {
        const remainingMs = 86400000 - elapsedMs;
        return {
          member: { ...member },
          stampsAdded: 0,
          rewardReady: member.stamps >= target,
          cooldown: true,
          remainingMs,
        };
      }
    }

    const nowIso = new Date().toISOString();

    const stampEntry = {
      id: `st-self-${Date.now().toString(36)}`,
      memberId: member.id,
      localId: pub.localId,
      localName: pub.localName,
      count: 1,
      source: 'self' as const,
      actorName: 'Visita en el local',
      createdAt: nowIso,
    };

    member.stamps = (member.stamps || 0) + 1;
    member.points = member.stamps;
    member.lastVisitAt = nowIso;
    member.lastStampedAt = nowIso;
    member.stampHistory = [stampEntry, ...(member.stampHistory || [])];

    const localObj = this.locals.find((l) => l.id === pub.localId);
    if (localObj) {
      localObj.visitsCount += 1;
    }

    this.stampLogs.unshift({
      id: `log-${Date.now().toString(36)}`,
      businessId: pub.businessId,
      memberId: member.id,
      memberCode: member.barcodeToken || member.memberCode,
      memberName: member.name || member.maskedEmail || 'Cliente',
      memberEmail: member.maskedEmail || member.contact,
      action: 'stamp_added',
      stampsDelta: 1,
      localName: pub.localName,
      staffEmail: 'visita@toque.com.ar',
      createdAt: nowIso,
    });

    const toquecito: ToquecitoItem = {
      id: `toq-${Date.now().toString(36)}`,
      accountId: member.accountId || member.id,
      businessId: pub.businessId,
      businessName: pub.businessName,
      initial: pub.businessName.charAt(0).toUpperCase(),
      brandColor: pub.brandColor || '#141414',
      createdAt: nowIso,
    };
    this.toquecitos.unshift(toquecito);

    this.persistClubData();
    await this.syncMemberPassOnServer(member);

    this.notifyHubListeners(pub.localCode);
    this.notifyHubListeners(pub.businessId);

    return {
      member: { ...member },
      stampsAdded: 1,
      rewardReady: member.stamps >= target,
      toquecito,
      cooldown: false,
      remainingMs: 86400000,
    };
  }

  async getRotatingCode(localId: string): Promise<{
    localId: string;
    localCode: string;
    token: string;
    validForSeconds: number;
    expiresAt: string;
  }> {
    const local = this.locals.find((l) => l.id === localId) || this.locals[0];
    const windowSlot = Math.floor(Date.now() / 30000);
    const token = `TQ30-${local.code}-${(windowSlot % 10000).toString().padStart(4, '0')}`;
    const secondsElapsed = Math.floor((Date.now() % 30000) / 1000);
    const validForSeconds = Math.max(1, 30 - secondsElapsed);
    const expiresAt = new Date((windowSlot + 1) * 30000).toISOString();

    return {
      localId: local.id,
      localCode: local.code,
      token,
      validForSeconds,
      expiresAt,
    };
  }

  async redeemReward(memberId: string): Promise<{
    member: ClubMember;
    rewardsRedeemed: number;
  }> {
    this.loadPersistedState();
    const member = this.clubMembers.find(
      (m) =>
        m.id === memberId ||
        m.barcodeToken?.toUpperCase() === memberId.toUpperCase() ||
        m.memberCode?.toUpperCase() === memberId.toUpperCase()
    );
    if (!member) {
      throw new Error('Cliente no encontrado.');
    }

    const target = member.targetStamps || this.clubConfig.targetStamps || 10;
    if (member.stamps < target) {
      throw new Error(
        `Al cliente todavía le faltan ${target - member.stamps} sello(s) para el premio.`
      );
    }

    const nowIso = new Date().toISOString();
    member.stamps = Math.max(0, member.stamps - target);
    member.points = member.stamps;
    member.rewardsRedeemed = (member.rewardsRedeemed || 0) + 1;

    const local = this.locals.find((l) => l.id === member.localId) || this.locals[0];
    if (local) {
      local.rewardsRedeemedCount += 1;
    }

    this.stampLogs.unshift({
      id: `log-${Date.now().toString(36)}`,
      businessId: member.businessId || this.businessProfile.id,
      memberId: member.id,
      memberCode: member.barcodeToken || member.memberCode,
      memberName: member.name || member.maskedEmail || 'Cliente',
      memberEmail: member.maskedEmail || member.contact,
      memberPhone: member.phone || '',
      action: 'reward_redeemed',
      stampsDelta: -target,
      localName: local?.name || 'Sucursal Central',
      staffEmail: this.currentUser?.email || this.businessProfile.email,
      createdAt: nowIso,
    });

    this.persistClubData();
    await this.syncMemberPassOnServer(member);

    this.notifyHubListeners(member.localCode);
    this.notifyHubListeners(member.businessId);

    return {
      member: { ...member },
      rewardsRedeemed: member.rewardsRedeemed,
    };
  }

  async listToquecitos(accountId?: string): Promise<ToquecitoItem[]> {
    const targetAcc = accountId || this.recognizedClient?.accountId;
    if (!targetAcc) return [...this.toquecitos];
    return this.toquecitos.filter((t) => t.accountId === targetAcc);
  }

  private filterStampLogsByPeriod(period: '30d' | '3m' | '12m' | 'all' = '30d'): StampLogEntry[] {
    const bizId = this.getActiveBusinessId();
    const list = this.stampLogs.filter((l) => l.businessId === bizId);
    if (period === 'all') return list;

    const days = period === '30d' ? 30 : period === '3m' ? 90 : 365;
    const cutoff = Date.now() - days * 86400000;
    return list.filter((l) => new Date(l.createdAt).getTime() >= cutoff);
  }

  async listStampLogs(period: '30d' | '3m' | '12m' | 'all' = '30d'): Promise<StampLogEntry[]> {
    return this.filterStampLogsByPeriod(period);
  }

  async exportStampLogsCsv(period: '30d' | '3m' | '12m' | 'all' = '30d'): Promise<string> {
    const logs = this.filterStampLogsByPeriod(period);
    const header =
      'ID,Fecha,Accion,Codigo Socio,Cliente,Correo,Variacion Sellos,Local,Operador\n';
    const rows = logs
      .map((l) => {
        const actionLabel = l.action === 'reward_redeemed' ? 'Premio canjeado' : 'Sello sumado';
        return `"${l.id}","${l.createdAt}","${actionLabel}","${l.memberCode || '-'}","${l.memberName}","${l.memberEmail || '-'}",${l.stampsDelta},"${l.localName || 'Casa Central'}","${l.staffEmail || '-'}"`;
      })
      .join('\n');
    return header + rows;
  }

  // =========================================================================
  // 4. REGISTRO DE CORRECCIONES (SOLO LECTURA, MOTIVO >= 10 CARACTERES)
  // =========================================================================

  private assertCanModifyAudit(reason: string): void {
    if (this.currentUser?.role === 'cashier') {
      throw new Error(
        'Solo el dueño o encargado pueden anular o ajustar sellos. El cajero solo suma.'
      );
    }
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 10) {
      throw new Error(
        'Para anular un sello o un premio hay que escribir el motivo (mínimo 10 caracteres). Así cualquier error queda explicado.'
      );
    }
  }

  async voidStamp(data: {
    stampId: string;
    memberId?: string;
    reason: string;
  }): Promise<{
    member: ClubMember;
    auditEntry: AuditLogEntry;
  }> {
    this.assertCanModifyAudit(data.reason);

    const member = this.clubMembers.find(
      (m) =>
        m.id === data.memberId || m.stampHistory?.some((s) => s.id === data.stampId)
    );

    if (!member) {
      throw new Error('No encontramos al cliente asociado a ese sello.');
    }

    const stamp = member.stampHistory?.find((s) => s.id === data.stampId);
    const countToSubtract = stamp && !stamp.voided ? stamp.count : 1;
    if (stamp) {
      stamp.voided = true;
      stamp.voidReason = data.reason.trim();
    }

    member.stamps = Math.max(0, (member.stamps || 0) - countToSubtract);
    member.points = member.stamps;

    const actorRole = this.currentUser?.role === 'manager' ? 'Encargado' : 'Dueño';

    const auditEntry: AuditLogEntry = {
      id: `aud-${Date.now().toString(36)}`,
      businessId: this.businessProfile.id,
      actionType: 'void_stamp',
      actionLabel: 'Anulación de sello',
      memberId: member.id,
      memberName: member.name || member.contact,
      delta: -countToSubtract,
      reason: data.reason.trim(),
      actorName: this.currentUser?.name || this.businessProfile.ownerName,
      actorRole,
      createdAt: new Date().toISOString(),
    };

    this.auditLogs.unshift(auditEntry);
    return { member: { ...member }, auditEntry };
  }

  async adjustBalance(data: {
    memberId: string;
    delta: number;
    reason: string;
  }): Promise<{
    member: ClubMember;
    auditEntry: AuditLogEntry;
  }> {
    this.assertCanModifyAudit(data.reason);

    if (!data.delta || data.delta === 0) {
      throw new Error('Indicá cuántos sellos querés sumar o descontar.');
    }

    const member = this.clubMembers.find((m) => m.id === data.memberId);
    if (!member) {
      throw new Error('Cliente no encontrado.');
    }

    member.stamps = Math.max(0, (member.stamps || 0) + data.delta);
    member.points = member.stamps;

    const actorRole = this.currentUser?.role === 'manager' ? 'Encargado' : 'Dueño';

    const auditEntry: AuditLogEntry = {
      id: `aud-${Date.now().toString(36)}`,
      businessId: this.businessProfile.id,
      actionType: data.delta < 0 ? 'void_reward' : 'adjust_balance',
      actionLabel: data.delta < 0 ? 'Descuento / Anulación manual' : 'Ajuste manual de sellos',
      memberId: member.id,
      memberName: member.name || member.contact,
      delta: data.delta,
      reason: data.reason.trim(),
      actorName: this.currentUser?.name || this.businessProfile.ownerName,
      actorRole,
      createdAt: new Date().toISOString(),
    };

    this.auditLogs.unshift(auditEntry);
    return { member: { ...member }, auditEntry };
  }

  async listAuditLog(filters?: {
    dateFrom?: string;
    dateTo?: string;
    actorName?: string;
  }): Promise<AuditLogEntry[]> {
    let list = [...this.auditLogs];
    if (filters?.actorName && filters.actorName.trim()) {
      const q = filters.actorName.trim().toLowerCase();
      list = list.filter((a) => a.actorName.toLowerCase().includes(q));
    }
    if (filters?.dateFrom) {
      const fromMs = new Date(filters.dateFrom).getTime();
      if (!isNaN(fromMs)) {
        list = list.filter((a) => new Date(a.createdAt).getTime() >= fromMs);
      }
    }
    if (filters?.dateTo) {
      const toMs = new Date(filters.dateTo).getTime() + 86400000;
      if (!isNaN(toMs)) {
        list = list.filter((a) => new Date(a.createdAt).getTime() <= toMs);
      }
    }
    return list;
  }

  // =========================================================================
  // 5. CLIENTES, LOCALES, AVISOS, CONFIGURACIÓN INICIAL Y SUSCRIPCIÓN
  // =========================================================================

  async listMembers(filters?: {
    search?: string;
    localId?: string;
  }): Promise<ClubMember[]> {
    const bizId = this.getActiveBusinessId();
    let list = this.clubMembers.filter((m) => !m.businessId || m.businessId === bizId);
    if (filters?.localId && filters.localId !== 'all') {
      list = list.filter((m) => m.localId === filters.localId);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.memberCode || '').toLowerCase().includes(q) ||
          (m.email || '').toLowerCase().includes(q) ||
          (this.memberRawEmails[m.id] || '').toLowerCase().includes(q) ||
          (m.maskedEmail || m.contact || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  async listClubMembers(): Promise<ClubMember[]> {
    return this.listMembers();
  }

  async exportClubMembersCsv(): Promise<string> {
    const members = await this.listMembers();
    const header =
      'ID,Codigo Tarjeta,Nombre,Correo,Cumpleanos,Sellos,Premios Canjeados,Local,Fecha Alta\n';
    const rows = members
      .map((m) => {
        const bday =
          m.birthDate ||
          (m.birthDay && m.birthMonth ? `${m.birthDay}/${m.birthMonth}` : 'Sin informar');
        return `"${m.id}","${m.memberCode || '-'}","${m.name || 'Socio'}","${m.maskedEmail || m.contact}","${bday}",${m.stamps || 0},${m.rewardsRedeemed || 0},"${m.localName || 'Casa Central'}","${m.joinedAt}"`;
      })
      .join('\n');
    return header + rows;
  }

  async deleteClubMember(id: string): Promise<void> {
    this.clubMembers = this.clubMembers.filter((m) => m.id !== id);
    this.persistClubData();
  }

  async revokeMemberCard(memberId: string): Promise<{ revoked: boolean; walletRevoked?: boolean }> {
    this.loadPersistedState();
    const found = this.clubMembers.find((m) => m.id === memberId);
    let walletRevoked = false;
    if (found?.walletSerial) {
      try {
        const res = await fetch('/api/club/member/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: found.id,
            walletSerial: found.walletSerial,
          }),
        });
        const data = await res.json().catch(() => ({}));
        walletRevoked = Boolean(data?.walletRevoked);
      } catch {
        walletRevoked = false;
      }
    }
    this.clubMembers = this.clubMembers.filter((m) => m.id !== memberId);
    delete this.memberRawEmails[memberId];
    this.persistClubData();
    return { revoked: true, walletRevoked };
  }

  async getClubConfig(): Promise<ClubConfig> {
    return { ...this.clubConfig };
  }

  async updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig> {
    const nextColor = patch.cardThemeColor || patch.brandColor || this.clubConfig.brandColor || '#1e1b4b';
    const nextTitle =
      patch.loyaltyTitle || patch.name || patch.clubName || this.clubConfig.loyaltyTitle || this.clubConfig.name;
    const nextReward =
      patch.loyaltyReward || patch.rewardText || this.clubConfig.loyaltyReward || this.clubConfig.rewardText;
    const nextTarget =
      patch.stampsRequired || patch.targetStamps || this.clubConfig.targetStamps || 10;

    this.clubConfig = {
      ...this.clubConfig,
      ...patch,
      name: nextTitle,
      clubName: nextTitle,
      loyaltyTitle: nextTitle,
      brandColor: nextColor,
      cardThemeColor: nextColor,
      rewardText: nextReward,
      loyaltyReward: nextReward,
      targetStamps: nextTarget,
      stampsRequired: nextTarget,
      howToEarn: patch.howToEarn ?? this.clubConfig.howToEarn ?? '1 sello por visita o compra',
      expirationPolicy: patch.expirationPolicy ?? this.clubConfig.expirationPolicy ?? 'No vencen',
      rule: {
        type: patch.mode || patch.rule?.type || this.clubConfig.mode || 'per_visit',
        value: patch.amountPerStamp || patch.rule?.value || 1,
      },
    };

    this.clubConfig.rewards = [
      {
        id: 'rew-1',
        label: nextReward || 'Premio exclusivo',
        target: nextTarget,
      },
    ];

    this.businessProfile = {
      ...this.businessProfile,
      cardThemeColor: nextColor,
      loyaltyTitle: nextTitle,
      loyaltyReward: nextReward,
      howToEarn: this.clubConfig.howToEarn,
      expirationPolicy: this.clubConfig.expirationPolicy,
      stampsRequired: nextTarget,
    };

    this.syncActiveBusinessStore();
    this.notifyHubListeners();
    return { ...this.clubConfig };
  }

  async listClubCards(): Promise<ClubConfig[]> {
    const bizId = this.getActiveBusinessId();
    const cards = this.businessClubCards.get(bizId) || [{ ...this.clubConfig }];
    return cards.map((c) => ({ ...c }));
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
    barcodeFormat?: 'QR' | 'CODE128' | 'PDF417' | 'AZTEC';
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
    const bizId = this.getActiveBusinessId();
    const currentCards = this.businessClubCards.get(bizId) || [{ ...this.clubConfig }];
    const limits = getPlanLimits(this.planState.planId);

    if (currentCards.length >= limits.maxCards) {
      throw new Error(
        `Tu plan actual permite hasta ${limits.maxCards} tarjeta(s). Pasate a un plan superior para crear más tarjetas.`
      );
    }

    const rawTitle = (data.loyaltyTitle || data.name || data.logoText || '').trim();
    const cleanName = rawTitle || `Tarjeta #${currentCards.length + 1}`;
    const cleanReward = data.rewardText.trim() || 'Beneficio al completar tus sellos';
    const targetStamps = Math.max(
      3,
      Math.min(20, Number(data.targetStamps ?? data.stampsRequired) || 10)
    );
    const color = data.customColor || data.brandColor || '#141418';

    const newCard: ClubConfig = {
      ...this.clubConfig,
      id: `card-${Date.now().toString(36)}`,
      name: cleanName,
      clubName: cleanName,
      loyaltyTitle: cleanName,
      logoText: data.logoText || cleanName,
      organizationName: data.organizationName || this.businessProfile.name,
      barcodeFormat: data.barcodeFormat || 'QR',
      barcodeValue: data.barcodeValue || '',
      barcodeAltText: data.barcodeAltText || '',
      colorPreset: data.colorPreset || 'dark',
      customColor: data.customColor || color,
      brandColor: color,
      cardThemeColor: color,
      logoUrl: data.logoUrl ?? this.clubConfig.logoUrl,
      wideLogoUrl: data.wideLogoUrl || '',
      iconUrl: data.iconUrl || '',
      headerFields: data.headerFields || [],
      primaryFields: data.primaryFields || [{ label: 'SELLOS', value: `1 / ${targetStamps}` }],
      secondaryFields: data.secondaryFields || [
        { label: 'PREMIO', value: cleanReward },
        { label: 'SOCIO', value: this.businessProfile.name },
      ],
      targetStamps,
      stampsRequired: targetStamps,
      rewardText: cleanReward,
      loyaltyReward: cleanReward,
      howToEarn: data.howToEarn || '1 sello por visita o compra',
      expirationPolicy: data.expirationPolicy || 'No vencen',
      rewards: [
        {
          id: `rew-${Date.now().toString(36)}`,
          label: cleanReward,
          target: targetStamps,
        },
      ],
      active: true,
    };

    const nextCards = [...currentCards, newCard];
    this.businessClubCards.set(bizId, nextCards);
    this.clubConfig = { ...newCard };
    this.syncActiveBusinessStore();
    this.notifyHubListeners();
    return { ...newCard };
  }

  async selectClubCard(cardId: string): Promise<ClubConfig> {
    const bizId = this.getActiveBusinessId();
    const currentCards = this.businessClubCards.get(bizId) || [{ ...this.clubConfig }];
    const found = currentCards.find((c) => c.id === cardId);
    if (!found) {
      throw new Error('Tarjeta no encontrada.');
    }
    this.clubConfig = { ...found };
    this.syncActiveBusinessStore();
    this.notifyHubListeners();
    return { ...this.clubConfig };
  }

  async deleteClubCard(cardId: string): Promise<ClubConfig[]> {
    const bizId = this.getActiveBusinessId();
    const currentCards = this.businessClubCards.get(bizId) || [{ ...this.clubConfig }];
    if (currentCards.length <= 1) {
      throw new Error('Tenés que mantener al menos 1 tarjeta activa.');
    }
    const filtered = currentCards.filter((c) => c.id !== cardId);
    this.businessClubCards.set(bizId, filtered);
    if (this.clubConfig.id === cardId) {
      this.clubConfig = { ...filtered[0] };
    }
    this.syncActiveBusinessStore();
    this.notifyHubListeners();
    return filtered.map((c) => ({ ...c }));
  }

  async listLocals(): Promise<ClubLocal[]> {
    const bizId = this.getActiveBusinessId();
    return this.locals.filter((l) => l.businessId === bizId);
  }

  async createLocal(data: {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
  }): Promise<ClubLocal> {
    const cleanName = data.name.trim();
    if (!cleanName) {
      throw new Error('Escribí el nombre del local.');
    }
    const bizId = this.getActiveBusinessId();
    const myLocals = this.locals.filter((l) => l.businessId === bizId);
    const limits = getPlanLimits(this.planState.planId);
    if (myLocals.length >= limits.maxLocals) {
      throw new Error(
        `Tu plan permite hasta ${limits.maxLocals} sucursal(es). Mejorá tu plan para agregar más sucursales.`
      );
    }

    const code = `${cleanName
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase() || 'LOCAL'}0${this.locals.length + 1}`;

    const newLocal: ClubLocal = {
      id: `local-${Date.now().toString(36)}`,
      businessId: bizId,
      code,
      name: cleanName,
      address: data.address.trim(),
      lat: data.lat,
      lng: data.lng,
      visitsCount: 0,
      newMembersCount: 0,
      returningCount: 0,
      rewardsRedeemedCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.locals.push(newLocal);
    return newLocal;
  }

  async updateLocal(
    id: string,
    patch: Partial<Pick<ClubLocal, 'name' | 'address' | 'lat' | 'lng'>>
  ): Promise<ClubLocal> {
    const idx = this.locals.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error('Local no encontrado.');
    this.locals[idx] = { ...this.locals[idx], ...patch };
    return this.locals[idx];
  }

  async listNotificationTemplates(): Promise<{
    templates: NotificationTemplate[];
    limits: NotificationLimits;
    subscribedClientsCount: number;
  }> {
    const bizId = this.getActiveBusinessId();
    const subscribedClientsCount = this.clubMembers.filter(
      (m) => (!m.businessId || m.businessId === bizId) && m.marketingConsent && !m.anonymous
    ).length;
    return {
      templates: [...this.notificationTemplates],
      limits: { ...this.notificationLimits },
      subscribedClientsCount,
    };
  }

  async updateTemplate(
    id: string,
    patch: Partial<Pick<NotificationTemplate, 'title' | 'message' | 'active'>>,
    limitsPatch?: Partial<NotificationLimits>
  ): Promise<{
    templates: NotificationTemplate[];
    limits: NotificationLimits;
  }> {
    const idx = this.notificationTemplates.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.notificationTemplates[idx] = {
        ...this.notificationTemplates[idx],
        ...patch,
      };
    }
    if (limitsPatch) {
      this.notificationLimits = {
        ...this.notificationLimits,
        ...limitsPatch,
      };
    }
    return {
      templates: [...this.notificationTemplates],
      limits: { ...this.notificationLimits },
    };
  }

  async scheduleNotification(data: {
    title: string;
    message: string;
    scheduledFor: string;
  }): Promise<NotificationTemplate> {
    if (!data.title.trim() || !data.message.trim()) {
      throw new Error('Completá el título y el mensaje del aviso.');
    }
    const created: NotificationTemplate = {
      id: `tpl-custom-${Date.now().toString(36)}`,
      type: 'custom',
      title: data.title.trim(),
      message: data.message.trim(),
      active: true,
      scheduleInfo: `Programado para ${data.scheduledFor}`,
      scheduledFor: data.scheduledFor,
    };
    this.notificationTemplates.push(created);
    return created;
  }

  async getSetupProgress(): Promise<SetupProgress> {
    const step1Brand = Boolean(this.clubConfig.name && this.clubConfig.brandColor);
    const step2Reward = Boolean(
      this.clubConfig.rewardText && (this.clubConfig.targetStamps || 0) > 0
    );
    const step3Local = (await this.listLocals()).length > 0;
    const step4Printed = this.cartelPrinted;

    const steps = [step1Brand, step2Reward, step3Local, step4Printed];
    const completedCount = steps.filter(Boolean).length;
    const totalSteps = 4;
    const percent = Math.round((completedCount / totalSteps) * 100);

    return {
      step1Brand,
      step2Reward,
      step3Local,
      step4Printed,
      completedCount,
      totalSteps,
      percent,
    };
  }

  async markCartelPrinted(): Promise<SetupProgress> {
    this.cartelPrinted = true;
    return this.getSetupProgress();
  }

  async getPlanState(): Promise<PlanState> {
    this.loadPersistedState();
    const endIso =
      this.planState.trialEndsAt ||
      this.planState.expiresAt ||
      this.businessProfile.trialEndsAt;

    if (
      (this.planState.status === 'trial' || this.planState.status === 'expired_trial') &&
      endIso
    ) {
      const endMs = new Date(endIso).getTime();
      const nowMs = Date.now();
      const remainingMs = endMs - nowMs;
      const daysLeft = Math.max(0, Math.ceil(remainingMs / 86400000));

      if (daysLeft <= 0 && !this.businessProfile.planPaid) {
        const twoDaysGraceEndMs = endMs + 2 * 86400000;
        const graceDaysRemaining = Math.max(
          0,
          Math.ceil((twoDaysGraceEndMs - nowMs) / 86400000)
        );
        const unpaidLockdown = nowMs >= twoDaysGraceEndMs;

        this.planState = {
          ...this.planState,
          status: 'expired_trial',
          daysRemaining: 0,
          graceDaysRemaining,
          unpaidLockdown,
          trialEndsAt: endIso,
          expiresAt: endIso,
        };
        this.persistPlanAndBusiness();
      } else {
        this.planState = {
          ...this.planState,
          status: 'trial',
          daysRemaining: daysLeft,
          graceDaysRemaining: 2,
          unpaidLockdown: false,
          trialEndsAt: endIso,
          expiresAt: endIso,
        };
        this.persistPlanAndBusiness();
      }
    }
    return { ...this.planState };
  }

  async startTrial(planId: 'free' | 'mensual' | 'anual' | 'a_consultar' = 'anual'): Promise<PlanState> {
    if (planId === 'free') {
      this.planState = {
        status: 'free',
        planId: 'free',
        tier: 'free',
        billingCycle: 'free',
        daysRemaining: 0,
        unpaidLockdown: false,
        isSimulated: false,
      };
      this.businessProfile.planPaid = false;
      this.syncActiveBusinessStore();
      return { ...this.planState };
    }

    if (planId === 'a_consultar') {
      this.planState = {
        status: 'custom',
        planId: 'a_consultar',
        tier: 'custom',
        billingCycle: 'custom',
        daysRemaining: 365,
        unpaidLockdown: false,
        isSimulated: false,
      };
      this.businessProfile.planPaid = true;
      this.syncActiveBusinessStore();
      return { ...this.planState };
    }

    if (planId === 'mensual') {
      this.planState = {
        status: 'active',
        planId: 'mensual',
        tier: 'pro',
        billingCycle: 'monthly',
        daysRemaining: 30,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        unpaidLockdown: false,
        isSimulated: false,
      };
      this.businessProfile.planPaid = true;
      this.syncActiveBusinessStore();
      return { ...this.planState };
    }

    // Plan Anual incluye 14 días de prueba gratis con contador real persistente
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
    this.planState = {
      status: 'trial',
      planId: 'anual',
      tier: 'pro',
      billingCycle: 'annual',
      daysRemaining: TRIAL_DAYS,
      graceDaysRemaining: 2,
      unpaidLockdown: false,
      trialStartedAt: new Date().toISOString(),
      trialEndsAt,
      expiresAt: trialEndsAt,
      isSimulated: false,
    };
    this.businessProfile.planPaid = false;
    this.businessProfile.trialEndsAt = trialEndsAt;
    this.syncActiveBusinessStore();
    return { ...this.planState };
  }

  // =========================================================================
  // 6. LISTA DE ESPERA (WAITLIST)
  // =========================================================================

  async joinWaitlist(data: {
    email: string;
    product: WaitlistProduct;
    consent: boolean;
    honeypot?: string;
  }): Promise<{
    joined: boolean;
    alreadyRegistered?: boolean;
    entry: WaitlistEntry;
  }> {
    if (data.honeypot && data.honeypot.trim().length > 0) {
      throw new Error('No pudimos procesar la solicitud.');
    }

    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Escribí un correo electrónico válido.');
    }

    if (!data.consent) {
      throw new Error('Marcá la casilla para autorizar que te avisemos cuando esté disponible.');
    }

    const existing = this.waitlistEntries.find(
      (e) => e.email.toLowerCase() === cleanEmail && e.product === data.product
    );
    if (existing) {
      return {
        joined: true,
        alreadyRegistered: true,
        entry: existing,
      };
    }

    const entry: WaitlistEntry = {
      id: `wl-${Date.now().toString(36)}`,
      email: cleanEmail,
      product: data.product,
      consent: true,
      createdAt: new Date().toISOString(),
      unsubscribeToken: `unsub-${Date.now().toString(36)}`,
    };
    this.waitlistEntries.unshift(entry);

    return {
      joined: true,
      alreadyRegistered: false,
      entry,
    };
  }

  async listWaitlist(): Promise<WaitlistEntry[]> {
    return [...this.waitlistEntries];
  }

  // =========================================================================
  // 7. CARTELES, PRODUCTOS (CON CARGA CSV), CAJA, EQUIPO Y SUPER ADMIN
  // =========================================================================

  async getActivationState(code: string): Promise<{
    found: boolean;
    status?: Cartel['status'];
    requiresPin?: boolean;
    cartel?: Partial<Cartel>;
  }> {
    const cleanCode = code.trim().toUpperCase();
    const cartel = this.carteles.find((c) => c.code.toUpperCase() === cleanCode);
    if (!cartel) return { found: false };
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

  async getCartelByCode(code: string): Promise<Cartel | null> {
    const cleanCode = code.trim().toUpperCase();
    return this.carteles.find((c) => c.code.toUpperCase() === cleanCode) || null;
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
    const cleanCode = data.code.trim().toUpperCase();
    let cartel = this.carteles.find((c) => c.code.toUpperCase() === cleanCode);
    if (!cartel) {
      cartel = {
        id: `cartel-${Date.now().toString(36)}`,
        code: cleanCode,
        pin: data.pin || '102030',
        businessId: this.getActiveBusinessId(),
        name: data.cartelName || data.name || `Cartel ${cleanCode}`,
        role: data.role || 'caja',
        status: 'active',
        reviewUrl: data.reviewUrl || data.googleReviewUrl || this.businessProfile.reviewUrl,
        mode: data.mode || 'smart_hub',
        scansCount: 0,
        reviewClicksCount: 0,
        createdAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
      };
      this.carteles.push(cartel);
    } else {
      cartel.status = 'active';
      cartel.name = data.cartelName || data.name || cartel.name;
      cartel.role = data.role || cartel.role;
      cartel.mode = data.mode || cartel.mode;
      cartel.reviewUrl = data.reviewUrl || data.googleReviewUrl || cartel.reviewUrl;
      cartel.activatedAt = new Date().toISOString();
    }
    return { success: true, cartel };
  }

  async listCarteles(): Promise<Cartel[]> {
    const bizId = this.getActiveBusinessId();
    return this.carteles.filter((c) => !c.businessId || c.businessId === bizId);
  }

  async createCartelForBusiness(data: {
    name: string;
    code?: string;
    role: CartelRole;
    mode?: HubMode;
    reviewUrl?: string;
  }): Promise<Cartel> {
    const bizId = this.getActiveBusinessId();
    const code = (data.code || `BURGER0${this.carteles.length + 1}`).toUpperCase();
    const created: Cartel = {
      id: `cartel-${Date.now().toString(36)}`,
      code,
      pin: '102030',
      businessId: bizId,
      name: data.name.trim(),
      role: data.role,
      status: 'active',
      reviewUrl: data.reviewUrl || this.businessProfile.reviewUrl || 'https://maps.google.com',
      mode: data.mode || 'smart_hub',
      scansCount: 0,
      reviewClicksCount: 0,
      createdAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
    };
    this.carteles.push(created);
    return created;
  }

  async updateCartel(
    id: string,
    patch: Partial<Pick<Cartel, 'name' | 'role' | 'status' | 'mode' | 'reviewUrl'>>
  ): Promise<Cartel> {
    const idx = this.carteles.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Cartel no encontrado.');
    this.carteles[idx] = { ...this.carteles[idx], ...patch };
    this.notifyHubListeners(this.carteles[idx].code);
    return this.carteles[idx];
  }

  async getHubConfig(): Promise<HubConfig> {
    return { ...this.hubConfig };
  }

  async updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig> {
    this.hubConfig = { ...this.hubConfig, ...patch };
    this.syncActiveBusinessStore();
    this.notifyHubListeners();
    return { ...this.hubConfig };
  }

  async importProductsCsv(
    csvContent: string,
    replaceExisting = false
  ): Promise<{
    importedCount: number;
    totalProducts: number;
    products: HubProduct[];
  }> {
    const rawLines = (csvContent || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length === 0) {
      throw new Error('El archivo CSV está vacío.');
    }

    // Detectar separador (; o ,)
    const firstLine = rawLines[0];
    const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

    const parseRow = (line: string): string[] => {
      const cols: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
          cols.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cols.push(current.trim());
      return cols;
    };

    const headerCandidate = parseRow(rawLines[0]).map((c) =>
      c
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    );

    const hasHeader = headerCandidate.some((h) =>
      ['nombre', 'producto', 'titulo', 'title', 'name', 'precio', 'price', 'codigo', 'sku', 'ean'].includes(h)
    );

    const dataLines = hasHeader ? rawLines.slice(1) : rawLines;

    const findIdx = (keywords: string[], fallback: number): number => {
      if (!hasHeader) return fallback;
      const found = headerCandidate.findIndex((h) => keywords.some((k) => h.includes(k)));
      return found !== -1 ? found : fallback;
    };

    const idxName = findIdx(['nombre', 'producto', 'titulo', 'title', 'name'], 0);
    const idxPrice = findIdx(['precio', 'price', 'valor', 'importe', 'monto'], 1);
    const idxCode = findIdx(['codigo', 'sku', 'ean', 'barcode', 'barra', 'code'], 2);
    const idxDesc = findIdx(['descripcion', 'detalle', 'categoria', 'marca', 'description'], 3);
    const idxFeatured = findIdx(['destacado', 'hub', 'featured', 'mostrar'], 4);

    const imported: HubProduct[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const cols = parseRow(dataLines[i]);
      const title = (cols[idxName] || '').trim();
      if (!title) continue;

      const rawPrice = (cols[idxPrice] || '')
        .replace(/[^0-9.,]/g, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.');
      const parsedPrice = rawPrice ? parseFloat(rawPrice) : undefined;
      const price = parsedPrice !== undefined && !isNaN(parsedPrice) && parsedPrice >= 0 ? parsedPrice : undefined;

      const code = (cols[idxCode] || '').trim() || undefined;
      const description = (cols[idxDesc] || '').trim() || undefined;
      const featuredRaw = (cols[idxFeatured] || '').trim().toLowerCase();
      const featuredInHub =
        featuredRaw === 'si' ||
        featuredRaw === 'sí' ||
        featuredRaw === 'true' ||
        featuredRaw === '1' ||
        featuredRaw === 'destacado';

      imported.push({
        id: `prod-csv-${Date.now().toString(36)}-${i}`,
        title,
        price,
        barcode: code,
        universalCode: code,
        description,
        featuredInHub,
      });
    }

    if (imported.length === 0) {
      throw new Error(
        'No encontramos productos válidos en el CSV. Asegurate de incluir al menos la columna "nombre" y "precio".'
      );
    }

    const baseProducts = replaceExisting ? [] : [...(this.hubConfig.products || [])];
    this.hubConfig = {
      ...this.hubConfig,
      products: [...imported, ...baseProducts],
    };
    this.syncActiveBusinessStore();
    this.notifyHubListeners();

    return {
      importedCount: imported.length,
      totalProducts: this.hubConfig.products.length,
      products: [...this.hubConfig.products],
    };
  }

  async getPublicHub(code: string): Promise<PublicHub> {
    this.loadPersistedState();
    await this.getPlanState();
    const { business, cartel, clubCfg, hubCfg } = this.resolveCartelAndBusiness(code);
    const lockdown = this.isUnpaidLockdownActive();

    // Buscar comprobante activo del cartel si no expiró (o el último comprobante listo en los últimos 2 min)
    let activeReceipt: Receipt | null = null;
    if (cartel.activeReceiptId) {
      const found = this.receipts.find((r) => r.id === cartel.activeReceiptId);
      if (
        found &&
        found.status === 'ready' &&
        new Date(found.expiresAt).getTime() >= Date.now()
      ) {
        activeReceipt = found;
      }
    }
    if (!activeReceipt) {
      const recentReady = this.receipts.find(
        (r) =>
          r.cartelCode.toUpperCase() === cartel.code.toUpperCase() &&
          r.status === 'ready' &&
          new Date(r.expiresAt).getTime() >= Date.now()
      );
      if (recentReady) {
        activeReceipt = recentReady;
      }
    }

    // Si terminó la prueba + 2 días sin pago: en el HUB solo se muestra el comprobante, sin club ni nada
    if (lockdown) {
      return {
        business: {
          id: business.id,
          name: business.name,
          logoUrl: clubCfg.logoUrl || hubCfg.logoUrl,
        },
        cartel: {
          id: cartel.id,
          code: cartel.code,
          name: cartel.name,
          role: cartel.role,
          status: cartel.status,
          mode: cartel.mode,
          tileColor: cartel.tileColor,
          claimStatus: cartel.claimStatus,
        },
        reviewUrl: '',
        blocks: [{ key: 'receipt', enabled: true }],
        receipt: activeReceipt,
        activeReceipt,
        club: null,
        unpaidLockdown: true,
        config: {
          ...hubCfg,
          blocks: [{ key: 'receipt', enabled: true }],
          products: [],
        },
        crossBenefits: [],
      };
    }

    // Buscar socio reconocido para este comercio
    let recognizedMember: ClubMember | null = null;
    if (this.recognizedClient?.email) {
      const targetEmail = this.recognizedClient.email.toLowerCase();
      recognizedMember =
        this.clubMembers.find(
          (m) =>
            (m.email?.toLowerCase() === targetEmail ||
              this.memberRawEmails[m.id]?.toLowerCase() === targetEmail) &&
            m.businessId === business.id
        ) || null;
    }

    return {
      business: {
        id: business.id,
        name: business.name,
        logoUrl: clubCfg.logoUrl || hubCfg.logoUrl,
      },
      cartel: {
        id: cartel.id,
        code: cartel.code,
        name: cartel.name,
        role: cartel.role,
        status: cartel.status,
        mode: cartel.mode,
        tileColor: cartel.tileColor,
        claimStatus: cartel.claimStatus,
      },
      reviewUrl:
        cartel.reviewUrl ||
        hubCfg.googleReviewUrl ||
        business.reviewUrl ||
        'https://maps.google.com',
      blocks: hubCfg.blocks,
      receipt: activeReceipt,
      activeReceipt,
      club: {
        config: clubCfg,
        member: recognizedMember,
      },
      unpaidLockdown: false,
      config: hubCfg,
      smartHubConfig: {
        tenantId: business.id,
        sectionsOrder: [
          { key: 'loyalty', enabled: true },
          { key: 'receipt', enabled: true },
          { key: 'reviews', enabled: true },
          { key: 'offers', enabled: true },
          { key: 'socials', enabled: true },
          { key: 'footer', enabled: true },
        ],
        brandColor: clubCfg.cardThemeColor || clubCfg.brandColor || '#1e1b4b',
        logoUrl: clubCfg.logoUrl || hubCfg.logoUrl,
        reviewPrompt: '¿Cómo fue tu experiencia hoy en el local?',
        loyaltyTitle: clubCfg.loyaltyTitle || clubCfg.name || `Tarjeta de sellos de ${business.name}`,
        loyaltyReward:
          clubCfg.loyaltyReward ||
          clubCfg.rewardText ||
          'Combo aniversario sin cargo en tu visita #10',
        howToEarn: clubCfg.howToEarn || '1 sello por visita o compra',
        expirationPolicy: clubCfg.expirationPolicy || 'No vencen',
        stampsRequired: clubCfg.targetStamps || clubCfg.stampsRequired || 10,
        offerTitle: 'Beneficio para socios del Club',
        offerDesc:
          clubCfg.loyaltyReward ||
          clubCfg.rewardText ||
          'Combo aniversario sin cargo en tu visita #10',
        offerCta: 'Mostrá tu tarjeta en caja',
        socials: hubCfg.socials,
      },
      crossBenefits: this.networkActivations.filter((n) => n.active),
    };
  }

  subscribeToCartelHub(code: string, onUpdate: (hub: PublicHub) => void): () => void {
    const key = (code || 'BURGER01').trim();
    if (!this.hubListeners.has(key)) {
      this.hubListeners.set(key, new Set());
    }
    this.hubListeners.get(key)!.add(onUpdate);
    this.getPublicHub(key).then(onUpdate).catch(() => {});
    return () => {
      this.hubListeners.get(key)?.delete(onUpdate);
    };
  }

  async getReceiptById(receiptId: string): Promise<Receipt | null> {
    this.loadPersistedState();
    const target = (receiptId || '').trim().toLowerCase();
    return (
      this.receipts.find((r) => r.id.toLowerCase() === target) || null
    );
  }

  subscribeToReceipt(
    receiptId: string,
    onUpdate: (receipt: Receipt | null) => void
  ): () => void {
    if (!this.receiptListeners.has(receiptId)) {
      this.receiptListeners.set(receiptId, new Set());
    }
    this.receiptListeners.get(receiptId)!.add(onUpdate);
    this.getReceiptById(receiptId).then(onUpdate).catch(() => {});
    return () => {
      this.receiptListeners.get(receiptId)?.delete(onUpdate);
    };
  }

  async claimReceipt(id: string): Promise<{ success: boolean; receipt: Receipt }> {
    this.loadPersistedState();
    const target = (id || '').trim().toLowerCase();
    const receipt = this.receipts.find((r) => r.id.toLowerCase() === target);
    if (!receipt) throw new Error('El comprobante no está disponible.');
    receipt.status = 'claimed';
    receipt.claimedAt = new Date().toISOString();
    this.persistPosData();
    this.receiptListeners.get(receipt.id)?.forEach((cb) => cb({ ...receipt }));
    this.notifyHubListeners(receipt.cartelCode);
    return { success: true, receipt };
  }

  async recordHubEvent(code: string, eventType: 'scan' | 'review_click'): Promise<void> {
    const { business, cartel } = this.resolveCartelAndBusiness(code);
    if (eventType === 'scan') {
      cartel.scansCount = (cartel.scansCount || 0) + 1;
      cartel.lastScannedAt = new Date().toISOString();
      business.scansCount = (business.scansCount || 0) + 1;
      if (business.id === this.businessProfile.id) {
        this.businessProfile.scansCount = business.scansCount;
      }
    } else if (eventType === 'review_click') {
      this.reviewClicks += 1;
      cartel.reviewClicksCount = (cartel.reviewClicksCount || 0) + 1;
      business.reviewClicksCount = (business.reviewClicksCount || 0) + 1;
      if (business.id === this.businessProfile.id) {
        this.businessProfile.reviewClicksCount = business.reviewClicksCount;
      }
    }
  }

  async joinClub(data: {
    cartelCode: string;
    contact: string;
    name?: string;
    phone?: string;
    birthDate?: string;
    consent: boolean;
  }): Promise<{ member: ClubMember; pointsAwarded: number; walletPass?: WalletPassResponse }> {
    const res = await this.registerMember({
      localCode: data.cartelCode,
      name: data.name || data.contact.split('@')[0],
      email: data.contact,
      phone: data.phone,
      birthDate: data.birthDate,
      adult: true,
      marketingConsent: data.consent,
    });
    return { member: res.member, pointsAwarded: 0 };
  }

  async getWalletStatus(): Promise<{
    configured: boolean;
    emailConfigured?: boolean;
    provider: string;
    passesIssuedCount?: number;
  }> {
    try {
      const res = await fetch('/api/wallet/status');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.passesIssuedCount === 'number') {
          this.walletPassesIssuedTotal = Math.max(
            this.walletPassesIssuedTotal,
            data.passesIssuedCount
          );
        }
        return data;
      }
    } catch {
      // Fallback
    }
    return {
      configured: false,
      emailConfigured: false,
      provider: 'https://api.walletwallet.dev',
      passesIssuedCount: this.walletPassesIssuedTotal,
    };
  }

  async createWalletPass(data: {
    cartelCode?: string;
    memberId?: string;
    memberCode?: string;
    customerName?: string;
    customerContact?: string;
    contact?: string;
    stamps?: number;
    stampsRequired?: number;
    points?: number;
    logoText?: string;
    organizationName?: string;
    rewardText?: string;
    barcodeFormat?: 'QR' | 'CODE128' | 'PDF417' | 'AZTEC';
    barcodeValue?: string;
    barcodeAltText?: string;
    colorPreset?: 'dark' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
    color?: string;
    logoURL?: string;
    wideLogoURL?: string;
    iconURL?: string;
    headerFields?: Array<{ label: string; value: string }>;
    primaryFields?: Array<{ label: string; value: string }>;
    secondaryFields?: Array<{ label: string; value: string }>;
    locations?: Array<{ latitude: number; longitude: number; relevantText?: string }>;
    serialNumber?: string;
    isUpdate?: boolean;
  }): Promise<WalletPassResponse> {
    this.loadPersistedState();
    const { business, cartel, clubCfg } = this.resolveCartelAndBusiness(
      data.cartelCode || 'BURGER01'
    );
    const member = data.memberId
      ? this.clubMembers.find((m) => m.id === data.memberId)
      : undefined;

    const rawCandidate =
      data.barcodeValue ||
      data.memberCode ||
      member?.barcodeToken ||
      member?.memberCode ||
      clubCfg.barcodeValue ||
      '';
    const barcodeToken =
      rawCandidate.trim().length >= 16 ? rawCandidate.trim() : generateBarcodeToken32();

    const payload = {
      businessId: business.id,
      businessName: business.name,
      title: data.logoText || clubCfg.logoText || business.name,
      logoText: data.logoText || clubCfg.logoText || business.name,
      organizationName: data.organizationName || clubCfg.organizationName || business.name,
      memberName: data.customerName ?? (member?.anonymous ? undefined : member?.name),
      memberId: member?.id || data.memberId || barcodeToken,
      reward:
        data.rewardText ||
        clubCfg.loyaltyReward ||
        clubCfg.rewardText ||
        'Beneficio al completar tus sellos',
      backgroundColor:
        data.color || clubCfg.customColor || clubCfg.cardThemeColor || clubCfg.brandColor || '#141414',
      color: data.color || clubCfg.customColor || undefined,
      colorPreset: data.colorPreset || member?.colorPreset || clubCfg.colorPreset || 'dark',
      barcodeFormat: 'QR',
      barcodeValue: barcodeToken,
      barcodeToken,
      barcodeAltText: '',
      logoURL: data.logoURL || member?.logoUrl || clubCfg.logoUrl || undefined,
      wideLogoURL: data.wideLogoURL || clubCfg.wideLogoUrl || undefined,
      iconURL: data.iconURL || clubCfg.iconUrl || undefined,
      headerFields: data.headerFields || clubCfg.headerFields,
      primaryFields: data.primaryFields || clubCfg.primaryFields,
      secondaryFields: data.secondaryFields || clubCfg.secondaryFields,
      locations: data.locations || clubCfg.locations,
      serialNumber: data.serialNumber || member?.walletSerial || clubCfg.walletSerial,
      isUpdate: data.isUpdate,
      brandColor: data.color || clubCfg.cardThemeColor || clubCfg.brandColor || '#141414',
      stamps: data.stamps ?? member?.stamps ?? 1,
      stampsRequired: data.stampsRequired ?? member?.stampsRequired ?? clubCfg.targetStamps ?? 10,
      rewardText:
        data.rewardText ||
        member?.rewardText ||
        clubCfg.loyaltyReward ||
        clubCfg.rewardText ||
        'Beneficio al completar tus sellos',
      customerName: data.customerName ?? (member?.anonymous ? '' : member?.name || ''),
      customerContact: data.customerContact || data.contact || member?.maskedEmail || '',
      code: cartel.code,
      memberCode: barcodeToken,
      notification: member?.walletLastNotification ?? ' ',
    };

    try {
      const response = await fetch('/api/wallet/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const passRes: WalletPassResponse & { totalPassesIssued?: number; error?: string } =
        await response.json();

      if (!response.ok || passRes.success === false) {
        const errMsg =
          passRes.walletSyncError ||
          passRes.error ||
          'No se pudo guardar la tarjeta en tu billetera.';
        if (member) {
          member.barcodeToken = barcodeToken;
          member.memberCode = barcodeToken;
          member.walletSyncError = errMsg;
          this.persistClubData();
        }
        throw new Error(errMsg);
      }

      this.walletPassesIssuedTotal =
        typeof passRes.totalPassesIssued === 'number'
          ? passRes.totalPassesIssued
          : this.walletPassesIssuedTotal + 1;

      business.walletPassesIssued = (business.walletPassesIssued || 0) + 1;
      if (business.id === this.businessProfile.id) {
        this.businessProfile.walletPassesIssued = business.walletPassesIssued;
      }
      if (member) {
        member.barcodeToken = barcodeToken;
        member.memberCode = barcodeToken;
        member.passId = passRes.serialNumber || passRes.passId;
        member.walletSerial = passRes.serialNumber || passRes.passId;
        member.shareUrl = passRes.shareUrl || passRes.appleWalletUrl;
        member.appleWalletUrl = passRes.shareUrl || passRes.appleWalletUrl;
        member.googleWalletUrl = passRes.googleWalletUrl || passRes.shareUrl;
        member.walletSyncError = passRes.walletSyncError || undefined;
        this.persistClubData();
      }
      return passRes;
    } catch (err: any) {
      const errMsg = err?.message || 'No se pudo conectar con el servicio de billetera.';
      if (member) {
        member.barcodeToken = barcodeToken;
        member.memberCode = barcodeToken;
        member.walletSyncError = errMsg;
        this.persistClubData();
      }
      throw new Error(errMsg);
    }
  }

  async createSale(data: {
    cartelId: string;
    amount: number;
    items?: SaleItem[];
    method: PaymentMethod;
  }): Promise<{ sale: Sale; qrData?: string; receipt?: Receipt }> {
    const cartel = this.carteles.find((c) => c.id === data.cartelId) || this.carteles[0];
    const nowIso = new Date().toISOString();
    const saleId = `sale-${Date.now()}`;
    const receiptId = `rcp-${Date.now()}`;

    const sale: Sale = {
      id: saleId,
      businessId: this.businessProfile.id,
      cartelId: cartel.id,
      cartelCode: cartel.code,
      cartelName: cartel.name,
      receiptId,
      amount: data.amount,
      currency: 'ARS',
      items: data.items || [],
      method: data.method,
      status: 'paid',
      createdAt: nowIso,
      paidAt: nowIso,
      cashierName: this.currentUser?.name || 'Caja',
      cashierEmail: this.currentUser?.email || this.businessProfile.email,
    };
    this.sales.unshift(sale);

    const receipt: Receipt = {
      id: receiptId,
      saleId: sale.id,
      businessId: sale.businessId,
      cartelCode: cartel.code,
      status: 'ready',
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      businessName: this.businessProfile.name,
      items: sale.items,
      total: sale.amount,
      currency: 'ARS',
      method: sale.method,
      createdAt: nowIso,
    };
    this.receipts.unshift(receipt);
    cartel.activeReceiptId = receipt.id;
    cartel.activeReceiptExpiresAt = receipt.expiresAt;

    this.notifySalesListeners();
    this.notifyHubListeners(cartel.code);
    this.notifyHubListeners(this.businessProfile.id);

    return { sale, receipt };
  }

  async getSale(id: string): Promise<Sale> {
    const sale = this.sales.find((s) => s.id === id);
    if (!sale) throw new Error('Operación no encontrada.');
    return sale;
  }

  async confirmManualSale(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    const sale = await this.getSale(id);
    sale.status = 'paid';
    sale.paidAt = new Date().toISOString();
    const existingReceipt = this.receipts.find((r) => r.saleId === sale.id);
    if (existingReceipt) {
      return { sale, receipt: existingReceipt };
    }
    const receipt: Receipt = {
      id: `rcp-${Date.now()}`,
      saleId: sale.id,
      businessId: sale.businessId,
      cartelCode: sale.cartelCode || 'BURGER01',
      status: 'ready',
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      businessName: this.businessProfile.name,
      items: sale.items,
      total: sale.amount,
      currency: 'ARS',
      method: sale.method,
      createdAt: new Date().toISOString(),
    };
    this.receipts.unshift(receipt);
    this.notifySalesListeners();
    this.notifyHubListeners(receipt.cartelCode);
    return { sale, receipt };
  }

  async simulatePaymentApproved(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    return this.confirmManualSale(id);
  }

  async cancelSale(id: string): Promise<Sale> {
    const sale = await this.getSale(id);
    sale.status = 'cancelled';
    this.notifySalesListeners();
    return sale;
  }

  async listSales(): Promise<Sale[]> {
    const bizId = this.getActiveBusinessId();
    return this.sales.filter((s) => s.businessId === bizId);
  }

  subscribeToBusinessSales(onUpdate: (sales: Sale[]) => void): () => void {
    this.salesListeners.add(onUpdate);
    this.listSales().then(onUpdate).catch(() => {});
    return () => {
      this.salesListeners.delete(onUpdate);
    };
  }

  async listTeamMembers(): Promise<TeamMember[]> {
    const bizId = this.getActiveBusinessId();
    return this.teamMembers.filter((t) => t.businessId === bizId);
  }

  async addTeamMember(data: {
    name: string;
    email?: string;
    role: 'owner' | 'manager' | 'cashier';
    assignedCartelId?: string;
    assignedLocalIds?: string[];
  }): Promise<TeamMember> {
    const cleanName = data.name.trim();
    if (!cleanName) throw new Error('Escribí el nombre de la persona.');

    const bizId = this.getActiveBusinessId();
    const activeTeam = this.teamMembers.filter(
      (t) => t.businessId === bizId && t.status === 'active'
    );
    const limits = getPlanLimits(this.planState.planId);
    if (activeTeam.length >= limits.maxTeamTotal) {
      throw new Error(
        `El plan Gratuito permite hasta ${limits.maxTeamTotal} personas en total (2 usuarios + el creador). Pasate al plan Pago para tener equipo ilimitado.`
      );
    }

    // Los cajeros no llevan correo electrónico por seguridad (solo operan desde el POS del local)
    const cleanEmail =
      data.role === 'cashier' ? '' : (data.email || '').trim().toLowerCase();
    if (data.role !== 'cashier' && (!cleanEmail || !cleanEmail.includes('@'))) {
      throw new Error('Ingresá un correo electrónico válido para Encargado o Dueño.');
    }

    const myCarteles = await this.listCarteles();
    const myLocals = await this.listLocals();

    const created: TeamMember = {
      id: `team-${Date.now().toString(36)}`,
      businessId: bizId,
      name: cleanName,
      email: cleanEmail,
      role: data.role,
      assignedCartelId: data.assignedCartelId || myCarteles[0]?.id,
      assignedCartelCode: myCarteles.find((c) => c.id === data.assignedCartelId)?.code || myCarteles[0]?.code,
      assignedLocalIds: data.assignedLocalIds || myLocals.map((l) => l.id),
      status: 'active',
      addedAt: new Date().toISOString(),
      addedByEmail: this.currentUser?.email || this.businessProfile.email,
    };
    this.teamMembers.push(created);
    return created;
  }

  async updateTeamMember(
    id: string,
    patch: Partial<
      Pick<TeamMember, 'name' | 'role' | 'assignedCartelId' | 'assignedLocalIds' | 'status'>
    >
  ): Promise<TeamMember> {
    const idx = this.teamMembers.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error('Integrante no encontrado.');
    this.teamMembers[idx] = { ...this.teamMembers[idx], ...patch };
    return this.teamMembers[idx];
  }

  async removeTeamMember(id: string): Promise<void> {
    this.teamMembers = this.teamMembers.filter((m) => m.id !== id);
  }

  async listNetworkActivations(): Promise<NetworkActivation[]> {
    const bizId = this.getActiveBusinessId();
    return this.networkActivations.filter((n) => n.tenantId === bizId);
  }

  async getPublicCrossBenefits(excludeBusinessId?: string): Promise<NetworkActivation[]> {
    return this.networkActivations.filter(
      (n) => n.active && (!excludeBusinessId || n.tenantId !== excludeBusinessId)
    );
  }

  async saveNetworkActivation(data: {
    formatType: NetworkActivationFormat;
    title: string;
    discountText: string;
    terms: string;
    active: boolean;
  }): Promise<NetworkActivation> {
    const bizId = this.getActiveBusinessId();
    const existingIdx = this.networkActivations.findIndex(
      (n) => n.tenantId === bizId && n.formatType === data.formatType
    );
    const record: NetworkActivation = {
      id: existingIdx !== -1 ? this.networkActivations[existingIdx].id : `net-${Date.now()}`,
      tenantId: bizId,
      businessId: bizId,
      merchantName: this.businessProfile.name,
      ...data,
      createdAt: new Date().toISOString(),
    };
    if (existingIdx !== -1) {
      this.networkActivations[existingIdx] = record;
    } else {
      this.networkActivations.push(record);
    }
    return record;
  }

  async toggleNetworkActivation(
    formatType: NetworkActivationFormat,
    active: boolean
  ): Promise<NetworkActivation> {
    const bizId = this.getActiveBusinessId();
    const existing = this.networkActivations.find(
      (n) => n.tenantId === bizId && n.formatType === formatType
    );
    if (existing) {
      existing.active = active;
      return { ...existing };
    }
    return this.saveNetworkActivation({
      formatType,
      title: `Beneficio ${this.businessProfile.name}`,
      discountText: 'Beneficio exclusivo',
      terms: 'Presentando tu comprobante o tarjeta Toque',
      active,
    });
  }

  async syncConsumerVault(payload: {
    user: ConsumerUser;
    receipts: ConsumerReceipt[];
  }) {
    this.consumerUsers.set(payload.user.id, payload.user);
    this.consumerReceipts.set(payload.user.id, payload.receipts);

    try {
      const res = await fetch('/api/consumer/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          consumerId: data.consumerId || payload.user.id,
          recoveryCode: data.recoveryCode || `TQ-${payload.user.id.slice(0, 6).toUpperCase()}`,
          user: payload.user,
          receipts: payload.receipts,
        };
      }
    } catch {
      // Fallback en memoria
    }

    return {
      success: true,
      consumerId: payload.user.id,
      recoveryCode: `TQ-${payload.user.id.slice(0, 6).toUpperCase()}`,
      user: payload.user,
      receipts: payload.receipts,
    };
  }

  async recoverConsumerVault(contactOrId: string): Promise<{
    found: boolean;
    user?: ConsumerUser;
    receipts?: ConsumerReceipt[];
  }> {
    const q = contactOrId.trim().toLowerCase();
    for (const u of this.consumerUsers.values()) {
      if (u.id.toLowerCase() === q || u.emailOrPhone.toLowerCase() === q) {
        return {
          found: true,
          user: u,
          receipts: this.consumerReceipts.get(u.id) || [],
        };
      }
    }
    return { found: false };
  }

  async getMercadoPagoStatus(): Promise<MercadoPagoStatus> {
    return { ...this.mpStatus };
  }

  async connectMercadoPago(): Promise<{ connected: boolean }> {
    this.mpStatus = {
      connected: true,
      collectorId: `MP-${this.businessProfile.id.toUpperCase()}`,
      connectedAt: new Date().toISOString(),
    };
    return { connected: true };
  }

  async disconnectMercadoPago(): Promise<{ connected: boolean }> {
    this.mpStatus.connected = false;
    return { connected: false };
  }

  async getDashboardSummary(period: '30d' | '3m' | '12m' | 'all' = '30d'): Promise<DashboardSummary> {
    const bizId = this.getActiveBusinessId();
    const myLocals = this.locals.filter((l) => l.businessId === bizId);
    const myMembers = this.clubMembers.filter((m) => !m.businessId || m.businessId === bizId);
    const mySales = this.sales.filter((s) => s.businessId === bizId && s.status === 'paid');
    const myReceipts = this.receipts.filter((r) => r.businessId === bizId);
    const myCarteles = this.carteles.filter((c) => !c.businessId || c.businessId === bizId);
    const myTeam = this.teamMembers.filter((t) => t.businessId === bizId);
    const periodLogs = this.filterStampLogsByPeriod(period);

    const todayPrefix = new Date().toISOString().slice(0, 10);
    const todaySales = mySales.filter((s) => s.createdAt.startsWith(todayPrefix));
    const todaySalesAmount = todaySales.reduce((acc, s) => acc + s.amount, 0);
    const weeklySalesAmount = mySales.reduce((acc, s) => acc + s.amount, 0);

    const stampsAddedCount = periodLogs
      .filter((l) => l.action === 'stamp_added')
      .reduce((acc, l) => acc + Math.max(0, l.stampsDelta), 0);
    const rewardsRedeemedCount = periodLogs.filter((l) => l.action === 'reward_redeemed').length;

    const totalVisits = myLocals.reduce((acc, l) => acc + l.visitsCount, 0);
    const returningMembersByCard = myMembers.filter(
      (m) => (m.stamps || 0) >= 2 || (m.rewardsRedeemed || 0) > 0
    ).length;
    const totalReturning = Math.max(
      myLocals.reduce((acc, l) => acc + l.returningCount, 0),
      returningMembersByCard
    );
    const returningRatePercent =
      myMembers.length > 0 ? Math.round((returningMembersByCard / myMembers.length) * 100) : 0;
    const totalScans = myCarteles.reduce((acc, c) => acc + (c.scansCount || 0), 0);

    const days = period === '30d' ? 30 : period === '3m' ? 90 : period === '12m' ? 365 : 3650;
    const cutoff = Date.now() - days * 86400000;
    const newMembersInPeriod = myMembers.filter(
      (m) => new Date(m.joinedAt).getTime() >= cutoff
    ).length;

    const walletPassesForBiz = this.businesses.get(bizId)?.walletPassesIssued || 0;

    return {
      todaySalesAmount,
      todaySalesCount: todaySales.length,
      weeklySalesAmount,
      weeklySalesCount: mySales.length,
      myTodaySalesCount: todaySales.length,
      myWeeklySalesCount: mySales.length,
      todayClaimedReceiptsCount: myReceipts.filter(
        (r) => r.status === 'claimed' && r.claimedAt?.startsWith(todayPrefix)
      ).length,
      myClaimedReceiptsCount: myReceipts.filter((r) => r.status === 'claimed').length,
      totalReceiptsCount: myReceipts.length,
      claimedReceiptsCount: myReceipts.filter((r) => r.status === 'claimed').length,
      newClubMembersCount: newMembersInPeriod,
      clubMembersCount: myMembers.length,
      walletPassesCount: walletPassesForBiz,
      scansCount: totalScans,
      reviewButtonClicks: this.businessProfile.reviewClicksCount || 0,
      teamMembersCount: myTeam.length,
      activeCartelesCount: myCarteles.filter((c) => c.status === 'active').length,
      totalCartelesCount: myCarteles.length,
      recentSales: mySales.slice(0, 20),
      visitsCount: totalVisits,
      returningMembersCount: totalReturning,
      returningRatePercent,
      rewardsRedeemedCount,
      stampsAddedCount,
    };
  }

  async getBusinessProfile(): Promise<BusinessProfile> {
    return { ...this.businessProfile };
  }

  async updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile> {
    this.businessProfile = { ...this.businessProfile, ...patch };
    this.syncActiveBusinessStore();
    this.notifyHubListeners();
    return { ...this.businessProfile };
  }

  // =========================================================================
  // 8. SUPER ADMIN — ESTADÍSTICAS REALES, PERFILES DETALLADOS Y DIRECTORIO DE USUARIOS
  // =========================================================================

  async listAllPlatformUsers(): Promise<PlatformUserRecord[]> {
    const records: PlatformUserRecord[] = [];

    // 1. Usuarios de comercios y miembros de equipo
    for (const tm of this.teamMembers) {
      const biz = this.businesses.get(tm.businessId);
      const roleMap: Record<string, string> = {
        owner: 'Dueño de Comercio',
        manager: 'Encargado',
        cashier: 'Cajero',
      };
      records.push({
        id: `usr-team-${tm.id}`,
        category: 'merchant_team',
        roleLabel: roleMap[tm.role] || tm.role,
        displayName: tm.name,
        emailOrContact: tm.email,
        businessId: tm.businessId,
        businessName: biz?.name || tm.businessId,
        createdAt: tm.addedAt,
        statusLabel: tm.status === 'active' ? 'Activo' : 'Revocado',
      });
    }

    // 2. Socios de Tarjetas de Sellos (Club) — Con correo enmascarado por privacidad
    for (const m of this.clubMembers) {
      const biz = m.businessId ? this.businesses.get(m.businessId) : this.businessProfile;
      records.push({
        id: `usr-member-${m.id}`,
        category: 'club_member',
        roleLabel: m.anonymous ? 'Socio Anónimo' : 'Socio Club de Sellos',
        displayName: m.name || m.memberCode || 'Socio',
        emailOrContact: m.maskedEmail || m.contact,
        businessId: m.businessId || 'la-burger',
        businessName: biz?.name || 'La Burger',
        stamps: m.stamps,
        rewardsRedeemed: m.rewardsRedeemed || 0,
        walletPassIssued: Boolean(m.passId),
        createdAt: m.joinedAt,
        statusLabel: `${m.stamps}/${m.targetStamps || 10} sellos`,
      });
    }

    // 3. Usuarios de Bóveda del Consumidor / Toquecitos
    for (const cu of this.consumerUsers.values()) {
      records.push({
        id: `usr-vault-${cu.id}`,
        category: 'consumer_vault',
        roleLabel: 'Usuario Bóveda / Toquecitos',
        displayName: cu.displayName,
        emailOrContact: maskEmailAddress(cu.emailOrPhone),
        createdAt: cu.createdAt,
        statusLabel: 'Bóveda sincronizada',
      });
    }

    // 4. Suscriptores en Lista de Espera
    for (const wl of this.waitlistEntries) {
      records.push({
        id: `usr-wl-${wl.id}`,
        category: 'waitlist',
        roleLabel: `Lista de espera (${wl.product})`,
        displayName: wl.email.split('@')[0],
        emailOrContact: maskEmailAddress(wl.email),
        createdAt: wl.createdAt,
        statusLabel: 'Suscripto',
      });
    }

    return records.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getSuperAdminBusinessDetail(businessId: string): Promise<SuperAdminBusinessDetail> {
    const biz =
      this.businesses.get(businessId) ||
      Array.from(this.businesses.values()).find((b) => b.id === businessId) ||
      this.businessProfile;

    const clubCfg = this.businessClubConfigs.get(biz.id) || this.clubConfig;
    const hubCfg = this.businessHubConfigs.get(biz.id) || this.hubConfig;
    const bizLocals = this.locals.filter((l) => l.businessId === biz.id);
    const bizCarteles = this.carteles.filter((c) => c.businessId === biz.id);
    const bizTeam = this.teamMembers
      .filter((t) => t.businessId === biz.id)
      .map((t) => ({
        id: t.id,
        name: t.name,
        role: t.role,
        status: t.status,
        assignedCartelCode: t.assignedCartelCode,
        addedAt: t.addedAt,
      }));
    const bizMembers = this.clubMembers.filter((m) => m.businessId === biz.id);
    const bizSales = this.sales.filter((s) => s.businessId === biz.id && s.status === 'paid');
    const bizLogs = this.stampLogs.filter((l) => l.businessId === biz.id);

    const stampsAddedCount = bizLogs
      .filter((l) => l.action === 'stamp_added')
      .reduce((acc, l) => acc + Math.max(0, l.stampsDelta), 0);
    const rewardsRedeemedCount = bizLogs.filter((l) => l.action === 'reward_redeemed').length;

    return {
      business: { ...biz },
      clubConfig: { ...clubCfg },
      hubConfig: { ...hubCfg },
      locals: bizLocals,
      carteles: bizCarteles,
      team: bizTeam,
      productsCount: hubCfg.products?.length || 0,
      products: [...(hubCfg.products || [])],
      membersCount: bizMembers.length,
      walletPassesIssued: biz.walletPassesIssued || 0,
      salesCount: bizSales.length,
      salesAmount: bizSales.reduce((acc, s) => acc + s.amount, 0),
      stampsAddedCount,
      rewardsRedeemedCount,
    };
  }

  async getSuperAdminSummary(): Promise<SuperAdminSummary> {
    // Sincronizar contador real de pases emitidos por el servidor
    await this.getWalletStatus().catch(() => {});

    const allBiz = Array.from(this.businesses.values());
    const paidSales = this.sales.filter((s) => s.status === 'paid');
    const totalSalesAmount = paidSales.reduce((acc, s) => acc + s.amount, 0);
    const totalScansCount = this.carteles.reduce((acc, c) => acc + (c.scansCount || 0), 0);
    const totalReviewClicks = this.carteles.reduce((acc, c) => acc + (c.reviewClicksCount || 0), 0);
    const allUsers = await this.listAllPlatformUsers();

    const businessesSummary = allBiz.map((b) => {
      const bCarteles = this.carteles.filter((c) => c.businessId === b.id);
      const bSales = paidSales.filter((s) => s.businessId === b.id);
      const bMembers = this.clubMembers.filter((m) => m.businessId === b.id);
      const bTeam = this.teamMembers.filter((t) => t.businessId === b.id);
      const bLocals = this.locals.filter((l) => l.businessId === b.id);
      const bHub = this.businessHubConfigs.get(b.id);
      return {
        ...b,
        cartelesCount: bCarteles.length,
        salesCount: bSales.length,
        salesAmount: bSales.reduce((acc, s) => acc + s.amount, 0),
        membersCount: bMembers.length,
        teamCount: bTeam.length,
        walletPassesIssued: b.walletPassesIssued || 0,
        productsCount: bHub?.products?.length || 0,
        localsCount: bLocals.length,
      };
    });

    return {
      totalBusinesses: allBiz.length,
      totalCarteles: this.carteles.length,
      activeCarteles: this.carteles.filter((c) => c.status === 'active').length,
      totalSalesCount: paidSales.length,
      totalSalesAmount,
      totalReceiptsEmitted: this.receipts.length,
      claimedReceiptsCount: this.receipts.filter((r) => r.status === 'claimed').length,
      totalClubMembers: this.clubMembers.length,
      walletPassesIssued: this.walletPassesIssuedTotal,
      totalScansCount,
      totalReviewClicks,
      businesses: businessesSummary,
      carteles: [...this.carteles],
      recentSales: paidSales.slice(0, 25),
      allUsers,
      toqueAdmins: [...this.toqueAdmins],
    };
  }

  async listToqueAdmins(): Promise<ToqueAdminStaff[]> {
    return [...this.toqueAdmins];
  }

  async addToqueAdmin(data: {
    email: string;
    name: string;
    level?: 'admin' | 'soporte' | 'operaciones';
    role?: 'admin' | 'soporte' | 'operaciones';
  }): Promise<ToqueAdminStaff> {
    const callerEmail = (this.currentUser?.email || '').toLowerCase();
    if (!this.isAuthorizedSuperAdmin(callerEmail)) {
      throw new Error('Acceso denegado: Solo Super Admins de Toque pueden gestionar el Equipo Toque.');
    }
    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Ingresá un correo electrónico válido.');
    }
    const targetLevel = data.level || data.role || 'soporte';
    const existing = this.toqueAdmins.find((a) => a.email.toLowerCase() === cleanEmail);
    if (existing) {
      existing.name = data.name.trim() || existing.name;
      existing.level = targetLevel;
      existing.role = targetLevel;
      return { ...existing };
    }
    const created: ToqueAdminStaff = {
      id: `tqa-${Date.now().toString(36)}`,
      email: cleanEmail,
      name: data.name.trim() || cleanEmail.split('@')[0],
      level: targetLevel,
      role: targetLevel,
      addedBy: callerEmail || 'fedeeeloiss@gmail.com',
      createdAt: new Date().toISOString(),
    };
    this.toqueAdmins.push(created);
    return created;
  }

  async removeToqueAdmin(email: string): Promise<void> {
    const callerEmail = (this.currentUser?.email || '').toLowerCase();
    if (!this.isAuthorizedSuperAdmin(callerEmail)) {
      throw new Error('Acceso denegado: Solo Super Admins de Toque pueden gestionar el Equipo Toque.');
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail === 'fedeeeloiss@gmail.com') {
      throw new Error('No se puede eliminar la cuenta raíz principal de Super Admin (fedeeeloiss@gmail.com).');
    }
    this.toqueAdmins = this.toqueAdmins.filter((a) => a.email.toLowerCase() !== cleanEmail);
  }
}

export const mockApi = new MockApi();

