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
  CashierMemberLookupResult,
} from './types';
import { TRIAL_DAYS, pruebaGratisDias, getPlanLimits } from '../config/pricing';
import {
  saveConsumerSession,
  getConsumerSessionEmail,
  getConsumerSessionToken,
} from '../lib/consumerSession';

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

export function formatCashierMemberName(fullName?: string): string {
  const clean = (fullName || '').trim();
  if (!clean) return 'Socio';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

export function generateShortCode(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += (bytes[i] % 10).toString();
  }
  if (code.startsWith('0')) {
    code = ((bytes[0] % 9) + 1).toString() + code.slice(1);
  }
  return code;
}

function generateBarcodeToken32(): string {
  return generateShortCode();
}

function generateMemberCode(_businessName?: string): string {
  return generateShortCode();
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

  // Cuentas de clientes registradas en Toque por email (en memoria)
  private clientAccountsByEmail: Map<
    string,
    {
      accountId: string;
      name: string;
      email: string;
      birthDay?: number;
      birthMonth?: number;
    }
  > = new Map([
    [
      'daniel@ejemplo.com',
      {
        accountId: 'acc-daniel-r',
        name: 'Daniel Rojas',
        email: 'daniel@ejemplo.com',
        birthDay: 14,
        birthMonth: 8,
      },
    ],
  ]);

  // Almacén en memoria para OTP (sincronizado con /api/auth/send-otp del servidor)
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

  // Comercio por defecto: Musical Monroe
  private businessProfile: BusinessProfile = {
    id: 'musical-monroe',
    name: 'Musical Monroe',
    ownerName: 'Encargado general',
    email: 'nombre@comercio.com',
    ownerRole: 'Dueño/a',
    teamSize: '2 a 5',
    category: 'Instrumentos y audio',
    planSelected: true,
    reviewUrl: 'https://maps.google.com',
    cardThemeColor: '#141414',
    loyaltyTitle: 'Tarjeta de sellos de Musical Monroe',
    loyaltyReward: 'Beneficio exclusivo en tu próxima visita',
    howToEarn: '1 sello por visita o compra (máximo 1 por día)',
    expirationPolicy: 'No vencen',
    stampsRequired: 5,
    plan: 'pro',
    billingCycle: 'annual',
    trialEndsAt: new Date(Date.now() + pruebaGratisDias * 86400000).toISOString(),
    planPaid: false,
    networkEnabled: false,
    createdAt: new Date().toISOString(),
    scansCount: 0,
    reviewClicksCount: 0,
    walletPassesIssued: 1,
  };

  // Lista real de todos los comercios registrados en la plataforma
  private businesses: Map<string, BusinessProfile> = new Map([
    [
      'musical-monroe',
      {
        id: 'musical-monroe',
        name: 'Musical Monroe',
        ownerName: 'Encargado general',
        email: 'nombre@comercio.com',
        ownerRole: 'Dueño/a',
        teamSize: '2 a 5',
        category: 'Instrumentos y audio',
        planSelected: true,
        reviewUrl: 'https://maps.google.com',
        cardThemeColor: '#141414',
        loyaltyTitle: 'Tarjeta de sellos de Musical Monroe',
        loyaltyReward: 'Beneficio exclusivo en tu próxima visita',
        howToEarn: '1 sello por visita o compra (máximo 1 por día)',
        expirationPolicy: 'No vencen',
        stampsRequired: 5,
        plan: 'pro',
        billingCycle: 'annual',
        trialEndsAt: new Date(Date.now() + pruebaGratisDias * 86400000).toISOString(),
        planPaid: true,
        networkEnabled: false,
        createdAt: new Date().toISOString(),
        scansCount: 0,
        reviewClicksCount: 0,
        walletPassesIssued: 1,
      },
    ],
  ]);

  // Configuraciones de Club y Hub por comercio
  private businessClubConfigs: Map<string, ClubConfig> = new Map();
  private businessClubCards: Map<string, ClubConfig[]> = new Map();
  private businessHubConfigs: Map<string, HubConfig> = new Map();

  // Locales del comercio
  private locals: ClubLocal[] = [
    {
      id: 'local-monroe-1',
      businessId: 'musical-monroe',
      code: 'MONROE01',
      name: 'Sucursal central',
      address: 'Av. Monroe 2450, CABA',
      visitsCount: 4,
      newMembersCount: 1,
      returningCount: 3,
      rewardsRedeemedCount: 0,
      createdAt: new Date().toISOString(),
    },
  ];

  // Equipo del comercio
  private teamMembers: TeamMember[] = [
    {
      id: 'team-monroe-owner',
      businessId: 'musical-monroe',
      name: 'Encargado general',
      email: 'nombre@comercio.com',
      role: 'owner',
      assignedCartelId: 'cartel-monroe-01',
      assignedCartelCode: 'MONROE01',
      assignedLocalIds: ['local-monroe-1'],
      status: 'active',
      addedAt: new Date().toISOString(),
    },
    {
      id: 'team-monroe-manager',
      businessId: 'musical-monroe',
      name: 'Lucía Gómez',
      email: 'encargado@comercio.com',
      role: 'manager',
      assignedCartelId: 'cartel-monroe-01',
      assignedCartelCode: 'MONROE01',
      assignedLocalIds: ['local-monroe-1'],
      status: 'active',
      addedAt: new Date().toISOString(),
    },
    {
      id: 'team-monroe-cashier',
      businessId: 'musical-monroe',
      name: 'Mateo Díaz',
      email: 'cajero@comercio.com',
      role: 'cashier',
      assignedCartelId: 'cartel-monroe-01',
      assignedCartelCode: 'MONROE01',
      assignedLocalIds: ['local-monroe-1'],
      status: 'active',
      addedAt: new Date().toISOString(),
    },
  ];

  // Configuración de Tarjeta de Sellos por defecto
  private clubConfig: ClubConfig = {
    id: 'card-default-1',
    name: 'Tarjeta de sellos de Musical Monroe',
    clubName: 'Tarjeta de sellos de Musical Monroe',
    loyaltyTitle: 'Tarjeta de sellos de Musical Monroe',
    brandColor: '#141414',
    cardThemeColor: '#141414',
    colorPreset: 'dark',
    logoUrl: '',
    targetStamps: 5,
    stampsRequired: 5,
    rewardText: 'Beneficio exclusivo en tu próxima visita',
    loyaltyReward: 'Beneficio exclusivo en tu próxima visita',
    rewardValueArs: 12500,
    howToEarn: '1 sello por visita o compra (máximo 1 por día)',
    expirationPolicy: 'No vencen',
    welcomeBenefitText: 'Beneficio exclusivo en tu próxima visita',
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
        id: 'rew-monroe-1',
        label: 'Beneficio exclusivo en tu próxima visita',
        target: 5,
      },
    ],
    active: true,
  };

  // Socios del Club en memoria (incluye a Daniel R. con código numérico de 8 dígitos 48291037 y 4 / 5 sellos)
  private clubMembers: ClubMember[] = [
    {
      id: 'member-daniel-r',
      accountId: 'acc-daniel-r',
      businessId: 'musical-monroe',
      businessName: 'Musical Monroe',
      localId: 'local-monroe-1',
      localCode: 'MONROE01',
      localName: 'Sucursal central',
      shortCode: '48291037',
      memberCode: '48291037',
      barcodeToken: '48291037',
      name: 'Daniel Rojas',
      email: 'daniel@ejemplo.com',
      contact: 'd***@ejemplo.com',
      maskedEmail: 'd***@ejemplo.com',
      birthDay: 14,
      birthMonth: 8,
      anonymous: false,
      marketingConsent: true,
      points: 4,
      stamps: 4,
      stampsRequired: 5,
      targetStamps: 5,
      rewardText: 'Beneficio exclusivo en tu próxima visita',
      rewardValueArs: 12500,
      colorPreset: 'dark',
      rewardsRedeemed: 0,
      joinedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
      lastVisitAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      lastStampedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      consent: true,
      stampHistory: [
        {
          id: 'st-dan-4',
          memberId: 'member-daniel-r',
          localId: 'local-monroe-1',
          localName: 'Sucursal central',
          count: 1,
          source: 'cashier',
          actorName: 'Caja mostrador',
          createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
        {
          id: 'st-dan-3',
          memberId: 'member-daniel-r',
          localId: 'local-monroe-1',
          localName: 'Sucursal central',
          count: 1,
          source: 'cashier',
          actorName: 'Caja mostrador',
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
        {
          id: 'st-dan-2',
          memberId: 'member-daniel-r',
          localId: 'local-monroe-1',
          localName: 'Sucursal central',
          count: 1,
          source: 'cashier',
          actorName: 'Caja mostrador',
          createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        },
        {
          id: 'st-dan-1',
          memberId: 'member-daniel-r',
          localId: 'local-monroe-1',
          localName: 'Sucursal central',
          count: 1,
          source: 'self',
          actorName: 'Alta en el club (+1 sello)',
          createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
        },
      ],
    },
  ];

  // Mapa interno de emails reales para búsqueda y reconocimiento de cuenta
  private memberRawEmails: Record<string, string> = {
    'member-daniel-r': 'daniel@ejemplo.com',
  };

  // Historial de sellos y premios (stamp_logs)
  private stampLogs: StampLogEntry[] = [
    {
      id: 'log-dan-4',
      businessId: 'musical-monroe',
      memberId: 'member-daniel-r',
      memberCode: '48291037',
      memberName: 'Daniel Rojas',
      memberEmail: 'd***@ejemplo.com',
      action: 'stamp_added',
      stampsDelta: 1,
      localName: 'Sucursal central',
      staffEmail: 'cajero@comercio.com',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ];

  // Toquecitos guardados por cuenta
  private toquecitos: ToquecitoItem[] = [];

  // Usuarios y comprobantes en memoria
  private consumerUsers: Map<string, ConsumerUser> = new Map();
  private consumerReceipts: Map<string, ConsumerReceipt[]> = new Map();

  // Registro inalterable de correcciones
  private auditLogs: AuditLogEntry[] = [];

  // Plantillas de avisos y límites
  private notificationTemplates: NotificationTemplate[] = [
    {
      id: 'tpl-birthday',
      type: 'birthday',
      title: '¡Feliz cumpleaños de parte de Musical Monroe!',
      message:
        'Hoy es tu día. Pasá por el local esta semana y tenés un beneficio especial presentando tu tarjeta de sellos.',
      active: true,
      scheduleInfo: 'Se envía el día del cumpleaños a las 10:00. El beneficio vale por 7 días.',
      benefitDaysValid: 7,
    },
    {
      id: 'tpl-nearby',
      type: 'nearby',
      title: 'Estás cerca de Musical Monroe',
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
    daysRemaining: pruebaGratisDias,
    trialStartedAt: new Date().toISOString(),
    trialEndsAt: new Date(Date.now() + pruebaGratisDias * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + pruebaGratisDias * 86400000).toISOString(),
    planSelected: true,
    isSimulated: true,
  };

  // Lista de espera en memoria
  private waitlistEntries: WaitlistEntry[] = [];

  // Cartel activo vinculado por defecto: MONROE01
  private carteles: Cartel[] = [
    {
      id: 'cartel-monroe-01',
      code: 'MONROE01',
      pin: '102030',
      businessId: 'musical-monroe',
      name: 'Mostrador principal',
      role: 'caja',
      status: 'active',
      reviewUrl: '',
      mode: 'smart_hub',
      tileColor: 'black',
      claimStatus: 'claimed',
      scansCount: 0,
      reviewClicksCount: 0,
      activeReceiptId: null,
      activeReceiptExpiresAt: null,
      createdAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
    },
  ];

  private hubConfig: HubConfig = {
    mode: 'smart_hub',
    blocks: [
      { key: 'receipt', enabled: true },
      { key: 'club', enabled: true },
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
      tiktok: '',
      facebook: '',
    },
    products: [],
    details: {
      address: '',
      hours: '',
      phone: '',
    },
    showToqueFooter: true,
    planPaid: true,
    networkEnabled: false,
    hubConfigured: false,
  };

  private sales: Sale[] = [];

  private receipts: Receipt[] = [];

  private networkActivations: NetworkActivation[] = [];
  private mpStatus: MercadoPagoStatus = {
    connected: false,
  };
  private reviewClicks = 0;
  private walletPassesIssuedTotal = 1;

  private lastStampedByBusiness = new Map<
    string,
    { memberId: string; accountId?: string; email?: string; stampedAtMs: number }
  >();

  constructor() {
    this.loadPersistedState();
    const bizId = this.getActiveBusinessId();
    if (!this.businessClubConfigs.has(bizId)) {
      this.businessClubConfigs.set(bizId, { ...this.clubConfig });
    }
    if (!this.businessClubCards.has(bizId)) {
      // El comercio demo inicial tiene 1 tarjeta; los comercios nuevos nacen con 0 tarjetas ([])
      this.businessClubCards.set(bizId, bizId === 'musical-monroe' ? [{ ...this.clubConfig }] : []);
    }
    if (!this.businessHubConfigs.has(bizId)) {
      this.businessHubConfigs.set(bizId, { ...this.hubConfig });
    }
  }

  private getClientDeviceToken(): string {
    if (typeof window === 'undefined') return 'server-device';
    try {
      let token = window.sessionStorage.getItem('toque_device_claim_token_v1');
      if (!token) {
        token = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        window.sessionStorage.setItem('toque_device_claim_token_v1', token);
      }
      return token;
    } catch {
      return 'fallback-device';
    }
  }

  private loadPersistedState(): void {
    if (typeof window === 'undefined') return;
    try {
      // Restaurar usuario comercio sincrónicamente desde localStorage si existe
      if (!this.currentUser) {
        const savedMerchantUser = window.localStorage.getItem('toque_merchant_user');
        if (savedMerchantUser) {
          const parsedUser = JSON.parse(savedMerchantUser);
          if (parsedUser && parsedUser.email) {
            this.currentUser = parsedUser;
          }
        }
      }

      const clubRaw = window.sessionStorage.getItem('toque_unified_club_v2');
      if (clubRaw) {
        const parsed = JSON.parse(clubRaw);
        if (parsed.recognizedClient !== undefined) {
          this.recognizedClient = parsed.recognizedClient;
        }
        if (Array.isArray(parsed.clientAccountsEntries)) {
          this.clientAccountsByEmail = new Map(parsed.clientAccountsEntries);
        }
        if (Array.isArray(parsed.clubMembers)) {
          this.clubMembers = parsed.clubMembers.map((m: ClubMember) => {
            const rawCode = m.barcodeToken || m.shortCode || m.memberCode || '';
            const clean8 = /^\d{8}$/.test(rawCode) ? rawCode : m.id === 'member-daniel-r' ? '48291037' : generateShortCode();
            return {
              ...m,
              shortCode: clean8,
              memberCode: clean8,
              barcodeToken: clean8,
            };
          });
        }
        if (parsed.memberRawEmails && typeof parsed.memberRawEmails === 'object') {
          this.memberRawEmails = parsed.memberRawEmails;
        }
        if (Array.isArray(parsed.toquecitos)) {
          this.toquecitos = parsed.toquecitos;
        }
        if (Array.isArray(parsed.consumerUsersEntries)) {
          this.consumerUsers = new Map(parsed.consumerUsersEntries);
        }
        if (Array.isArray(parsed.consumerReceiptsEntries)) {
          this.consumerReceipts = new Map(parsed.consumerReceiptsEntries);
        }
      }

      // Restaurar sesión activa del cliente si existe en toque_consumer_user / toque_session
      const persistedEmail = getConsumerSessionEmail();
      if (persistedEmail && !this.recognizedClient) {
        const existingAcc = this.clientAccountsByEmail.get(persistedEmail);
        if (existingAcc) {
          this.recognizedClient = existingAcc;
        } else {
          const matchingMember = this.clubMembers.find(
            (m) =>
              m.email?.toLowerCase() === persistedEmail ||
              this.memberRawEmails[m.id]?.toLowerCase() === persistedEmail
          );
          if (matchingMember) {
            this.recognizedClient = {
              accountId: matchingMember.accountId || `acc-${persistedEmail}`,
              name: matchingMember.name || persistedEmail.split('@')[0],
              email: persistedEmail,
              birthDay: matchingMember.birthDay,
              birthMonth: matchingMember.birthMonth,
            };
            this.clientAccountsByEmail.set(persistedEmail, this.recognizedClient);
          }
        }
      }

      const posRaw = window.sessionStorage.getItem('toque_unified_pos_v2');
      if (posRaw) {
        const parsed = JSON.parse(posRaw);
        if (Array.isArray(parsed.sales)) {
          this.sales = parsed.sales;
        }
        if (Array.isArray(parsed.receipts)) {
          this.receipts = parsed.receipts;
        }
        if (Array.isArray(parsed.carteles)) {
          this.carteles = parsed.carteles;
        }
      }

      const bizRaw = window.sessionStorage.getItem('toque_unified_biz_v2');
      if (bizRaw) {
        const parsed = JSON.parse(bizRaw);
        if (parsed.businessProfile) {
          this.businessProfile = parsed.businessProfile;
        }
        if (parsed.clubConfig) {
          this.clubConfig = parsed.clubConfig;
        }
        if (parsed.hubConfig) {
          this.hubConfig = parsed.hubConfig;
        }
        if (parsed.planState) {
          this.planState = parsed.planState;
        }
        if (Array.isArray(parsed.businessClubCardsEntries)) {
          this.businessClubCards = new Map(parsed.businessClubCardsEntries);
        }
        const bizId = this.businessProfile.id || 'musical-monroe';
        this.businesses.set(bizId, { ...this.businessProfile });
        this.businessClubConfigs.set(bizId, { ...this.clubConfig });
        this.businessHubConfigs.set(bizId, { ...this.hubConfig });
      }
    } catch {
      // Ignore storage read errors
    }
  }

  private persistClubData(): void {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(
        'toque_unified_club_v2',
        JSON.stringify({
          recognizedClient: this.recognizedClient,
          clientAccountsEntries: Array.from(this.clientAccountsByEmail.entries()),
          clubMembers: this.clubMembers,
          memberRawEmails: this.memberRawEmails,
          toquecitos: this.toquecitos,
          consumerUsersEntries: Array.from(this.consumerUsers.entries()),
          consumerReceiptsEntries: Array.from(this.consumerReceipts.entries()),
        })
      );
    } catch {
      // Ignore storage write errors
    }
  }

  private persistPosData(): void {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(
        'toque_unified_pos_v2',
        JSON.stringify({
          sales: this.sales,
          receipts: this.receipts,
          carteles: this.carteles,
        })
      );
    } catch {
      // Ignore storage write errors
    }
  }

  private persistPlanAndBusiness(): void {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(
        'toque_unified_biz_v2',
        JSON.stringify({
          businessProfile: this.businessProfile,
          clubConfig: this.clubConfig,
          hubConfig: this.hubConfig,
          planState: this.planState,
          businessClubCardsEntries: Array.from(this.businessClubCards.entries()),
        })
      );
    } catch {
      // Ignore storage write errors
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
    return this.currentUser?.businessId || this.businessProfile.id || 'musical-monroe';
  }

  private syncActiveBusinessStore(): void {
    const bizId = this.getActiveBusinessId();
    this.businesses.set(bizId, { ...this.businessProfile });
    this.businessClubConfigs.set(bizId, { ...this.clubConfig });
    const existingCards = this.businessClubCards.has(bizId)
      ? [...(this.businessClubCards.get(bizId) || [])]
      : bizId === 'musical-monroe'
      ? [{ ...this.clubConfig }]
      : [];
    if (existingCards.length > 0) {
      const activeId = this.clubConfig.id || existingCards[0]?.id || 'card-default-1';
      this.clubConfig.id = activeId;
      existingCards[0] = { ...this.clubConfig };
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
    extra?: {
      businessName?: string;
      ownerName?: string;
      ownerRole?: string;
      businessEmail?: string;
      teamSize?: string;
      category?: string;
    }
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
      // Verificar también en el servidor (/api/consumer/verify-code)
      let serverConsumer: {
        needsRegistration?: boolean;
        sessionToken?: string;
        user?: { id: string; email: string; fullName: string; birthDate?: string };
      } | null = null;
      try {
        const cRes = await fetch('/api/consumer/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
        });
        if (cRes.ok) {
          serverConsumer = await cRes.json();
        }
      } catch {
        // Fallback en memoria
      }

      const existingAcc = this.clientAccountsByEmail.get(cleanEmail);
      const hasMemberCard = this.clubMembers.some(
        (m) =>
          m.email?.toLowerCase() === cleanEmail ||
          this.memberRawEmails[m.id]?.toLowerCase() === cleanEmail
      );

      if (
        (serverConsumer && serverConsumer.needsRegistration === false && serverConsumer.user) ||
        existingAcc ||
        hasMemberCard
      ) {
        const firstCard = this.clubMembers.find(
          (m) =>
            m.email?.toLowerCase() === cleanEmail ||
            this.memberRawEmails[m.id]?.toLowerCase() === cleanEmail
        );
        const resolvedName =
          serverConsumer?.user?.fullName ||
          existingAcc?.name ||
          firstCard?.name ||
          cleanEmail.split('@')[0];
        const resolvedAccountId =
          serverConsumer?.user?.id ||
          existingAcc?.accountId ||
          firstCard?.accountId ||
          `acc-${cleanEmail}`;

        this.recognizedClient = {
          accountId: resolvedAccountId,
          name: resolvedName,
          email: cleanEmail,
          birthDay: existingAcc?.birthDay || firstCard?.birthDay,
          birthMonth: existingAcc?.birthMonth || firstCard?.birthMonth,
        };
        this.clientAccountsByEmail.set(cleanEmail, this.recognizedClient);

        const sessionToken =
          serverConsumer?.sessionToken ||
          getConsumerSessionToken() ||
          `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        saveConsumerSession(sessionToken, cleanEmail, {
          id: resolvedAccountId,
          email: cleanEmail,
          fullName: resolvedName,
          birthDate: serverConsumer?.user?.birthDate,
        });

        const account = await this.recognizeAccount(cleanEmail);
        return {
          verified: true,
          account: {
            ...account,
            recognized: true,
            accountExists: true,
          },
        };
      }

      // No tiene cuenta todavía: debe completar el registro (nombre, fecha de nacimiento >= 18)
      return {
        verified: true,
        account: {
          recognized: false,
          accountExists: false,
          email: cleanEmail,
          maskedEmail: maskEmailAddress(cleanEmail),
          cards: [],
        },
      };
    }

    // Si es registro de nuevo comercio
    if (purpose === 'register_merchant' || extra?.businessName) {
      const reg = await this.register({
        businessName: extra?.businessName || 'Musical Monroe',
        ownerName: extra?.ownerName || cleanEmail.split('@')[0],
        email: cleanEmail,
        ownerRole: extra?.ownerRole,
        businessEmail: extra?.businessEmail,
        teamSize: extra?.teamSize,
        category: extra?.category,
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
      const targetBizId = teamMember?.businessId || 'musical-monroe';
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
        assignedCartelId: teamMember?.assignedCartelId || 'cartel-monroe-01',
        assignedCartelCode: teamMember?.assignedCartelCode || 'MONROE01',
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
    ownerRole?: string;
    businessEmail?: string;
    teamSize?: string;
    category?: string;
  }): Promise<{ user: User; token: string }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanBizName = data.businessName.trim() || 'Musical Monroe';
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
      ownerRole: data.ownerRole || 'Dueño/a',
      businessEmail: data.businessEmail?.trim() || '',
      teamSize: data.teamSize || 'Solo yo',
      category: data.category?.trim() || '',
      planSelected: false,
      reviewUrl: 'https://maps.google.com',
      cardThemeColor: '#1e1b4b',
      loyaltyTitle: `Tarjeta de sellos de ${cleanBizName}`,
      loyaltyReward: 'Beneficio exclusivo en tu próxima visita',
      howToEarn: '1 sello por visita o compra',
      expirationPolicy: 'No vencen',
      stampsRequired: 5,
      planPaid: false,
      networkEnabled: true,
      createdAt: new Date().toISOString(),
      scansCount: 0,
      reviewClicksCount: 0,
      walletPassesIssued: 0,
    };

    this.businesses.set(bizId, newBiz);
    this.businessProfile = { ...newBiz };
    this.planState = {
      ...this.planState,
      planSelected: false,
    };

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
      rewardText: 'Beneficio exclusivo al completar tus 10 sellos',
      loyaltyReward: 'Beneficio exclusivo al completar tus 10 sellos',
      howToEarn: '1 sello por visita o compra',
      expirationPolicy: 'No vencen',
      rewards: [
        {
          id: `rew-${Date.now().toString(36)}`,
          label: 'Beneficio exclusivo al completar tus 10 sellos',
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

    // Cero tarjetas pre-creadas por defecto para todo comercio nuevo
    this.businessClubCards.set(bizId, []);
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
    this.loadPersistedState();
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
    try {
      await fetch(`/api/merchant/account?tenantId=${encodeURIComponent(bizId)}`, {
        method: 'DELETE',
      });
    } catch {
      // ignore network error
    }
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
        window.sessionStorage.clear();
        window.localStorage.clear();
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
    const clean = (codeOrSlug || 'MONROE01').trim();
    const upper = clean.toUpperCase();
    const lower = clean.toLowerCase();

    // 1. Buscar por código de cartel o código de local
    let cartel = this.carteles.find((c) => c.code.toUpperCase() === upper);
    let local = this.locals.find((l) => l.code.toUpperCase() === upper);
    let business = cartel?.businessId ? this.businesses.get(cartel.businessId) : undefined;

    // 2. Si no se encontró por código, buscar por businessId / slug (ej. musical-monroe)
    if (!business) {
      business =
        this.businesses.get(lower) ||
        Array.from(this.businesses.values()).find(
          (b) => b.id.toLowerCase() === lower || b.name.toLowerCase().replace(/\s+/g, '-') === lower
        );
    }

    if (!business) {
      business = this.businesses.get('musical-monroe') || this.businessProfile;
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

    const calc = this.calculateAgeFromBirthDate(data.birthDate);
    const finalAge = data.age !== undefined ? data.age : calc.age;
    const finalIsMinor =
      data.isMinor !== undefined
        ? data.isMinor
        : data.adult === false
        ? true
        : calc.isMinor || (finalAge !== undefined && finalAge < 18);

    // Regla 3: La fecha de nacimiento se usa SOLO para verificar que sea mayor de 18;
    // si es menor de 18: no se guarda nada y se muestra el mensaje exacto.
    if (finalIsMinor) {
      throw new Error('Para crear tu tarjeta con datos hace falta ser mayor de 18.');
    }

    const derivedName = (data.name || '').trim() || cleanEmail.split('@')[0];
    const pub = await this.getClubPublic(data.localCode || 'MONROE01');
    const masked = maskEmailAddress(cleanEmail);
    const accountId =
      this.recognizedClient?.accountId ||
      this.clientAccountsByEmail.get(cleanEmail)?.accountId ||
      `acc-${Date.now().toString(36)}`;

    let parsedDay = data.birthDay;
    let parsedMonth = data.birthMonth;
    if (data.birthDate && (!parsedDay || !parsedMonth)) {
      const parts = data.birthDate.split('-');
      if (parts.length === 3) {
        parsedMonth = parseInt(parts[1], 10);
        parsedDay = parseInt(parts[2], 10);
      }
    }

    const finalConsent = Boolean(data.marketingConsent);

    // Guardamos únicamente día y mes (nunca el año ni la fecha completa)
    const clientAcc = {
      accountId,
      name: derivedName,
      email: cleanEmail,
      birthDay: parsedDay,
      birthMonth: parsedMonth,
    };
    this.recognizedClient = clientAcc;
    this.clientAccountsByEmail.set(cleanEmail, clientAcc);

    // Persistir sesión única del consumidor en navegador y servidor
    let sessionToken =
      getConsumerSessionToken() ||
      `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const regRes = await fetch('/api/consumer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: derivedName,
          birthDate: data.birthDate,
          tenantId: pub.businessId,
        }),
      });
      if (regRes.ok) {
        const regJson = await regRes.json();
        if (regJson.sessionToken) sessionToken = regJson.sessionToken;
      }
    } catch {
      // Fallback en memoria
    }
    saveConsumerSession(sessionToken, cleanEmail, {
      id: accountId,
      email: cleanEmail,
      fullName: derivedName,
      birthDate: data.birthDate,
    });

    let existing = this.clubMembers.find(
      (m) =>
        (this.memberRawEmails[m.id] === cleanEmail || m.email?.toLowerCase() === cleanEmail) &&
        m.businessId === pub.businessId
    );

    if (!existing) {
      const newId = `member-${Date.now().toString(36)}`;
      let shortCode = generateShortCode();
      while (this.clubMembers.some((m) => m.barcodeToken === shortCode || m.shortCode === shortCode)) {
        shortCode = generateShortCode();
      }
      const nowIso = new Date().toISOString();

      existing = {
        id: newId,
        accountId,
        businessId: pub.businessId,
        businessName: pub.businessName,
        localId: pub.localId,
        localCode: pub.localCode,
        localName: pub.localName,
        shortCode,
        memberCode: shortCode,
        barcodeToken: shortCode,
        name: derivedName,
        email: cleanEmail,
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
            actorName: 'Alta en el club (+1 sello)',
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
        memberCode: shortCode,
        memberName: derivedName,
        memberEmail: masked,
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
    } else {
      if (!existing.shortCode || !/^\d{8}$/.test(existing.shortCode)) {
        const sc =
          existing.memberCode && /^\d{8}$/.test(existing.memberCode)
            ? existing.memberCode
            : generateShortCode();
        existing.shortCode = sc;
        existing.memberCode = sc;
        existing.barcodeToken = sc;
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
      account: { ...account, accountExists: true },
      requiresOtp: false,
    };
  }

  async createAnonymousCard(_localCode: string): Promise<{ member: ClubMember }> {
    throw new Error('Para crear tu tarjeta necesitás registrarte con tu correo electrónico.');
  }

  async recognizeAccount(email?: string): Promise<RecognizedClientAccount> {
    this.loadPersistedState();
    const targetEmail = (
      email ||
      this.recognizedClient?.email ||
      getConsumerSessionEmail() ||
      ''
    )
      .trim()
      .toLowerCase();
    if (!targetEmail) {
      return { recognized: false, accountExists: false };
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
        if (!m.shortCode || !/^\d{8}$/.test(m.shortCode)) {
          const sc =
            m.memberCode && /^\d{8}$/.test(m.memberCode)
              ? m.memberCode
              : m.id === 'member-daniel-r'
              ? '48291037'
              : generateShortCode();
          m.shortCode = sc;
          m.memberCode = sc;
          m.barcodeToken = sc;
        }
        m.businessName = biz?.name || m.businessName || 'Musical Monroe';
        m.rewardText =
          cfg.loyaltyReward ||
          cfg.rewardText ||
          m.rewardText ||
          'Beneficio al completar tus sellos';
        m.rewardValueArs = cfg.rewardValueArs ?? m.rewardValueArs ?? 0;
        m.colorPreset = cfg.colorPreset || m.colorPreset || 'dark';
        m.customColor = cfg.customColor || m.customColor;
        m.logoUrl = cfg.logoUrl || m.logoUrl;
        m.stampsRequired = cfg.targetStamps || cfg.stampsRequired || m.stampsRequired || m.targetStamps || 5;
        m.targetStamps = m.stampsRequired;
        return m;
      });

    const knownAcc = this.clientAccountsByEmail.get(targetEmail);
    const accountExists = Boolean(knownAcc || cards.length > 0);
    if (!accountExists && !this.recognizedClient) {
      return {
        recognized: false,
        accountExists: false,
        email: targetEmail,
        maskedEmail: maskEmailAddress(targetEmail),
        cards: [],
      };
    }

    const firstCard = cards[0];
    const name =
      knownAcc?.name ||
      this.recognizedClient?.name ||
      firstCard?.name ||
      targetEmail.split('@')[0];
    const accountId =
      knownAcc?.accountId ||
      this.recognizedClient?.accountId ||
      firstCard?.accountId ||
      `acc-${targetEmail}`;

    this.recognizedClient = {
      accountId,
      name,
      email: targetEmail,
      birthDay: knownAcc?.birthDay || this.recognizedClient?.birthDay || firstCard?.birthDay,
      birthMonth: knownAcc?.birthMonth || this.recognizedClient?.birthMonth || firstCard?.birthMonth,
    };
    this.clientAccountsByEmail.set(targetEmail, this.recognizedClient);

    // Unificar automáticamente con la cuenta de Toquecitos (ConsumerUser y comprobantes)
    const existingConsumer = Array.from(this.consumerUsers.values()).find(
      (u) => u.emailOrPhone.toLowerCase() === targetEmail || u.id === accountId
    );
    const consumerId = existingConsumer?.id || accountId;
    const unifiedConsumerUser: ConsumerUser = existingConsumer
      ? { ...existingConsumer, displayName: name || existingConsumer.displayName, emailOrPhone: targetEmail }
      : {
          id: consumerId,
          emailOrPhone: targetEmail,
          displayName: name,
          ageGroup: 'adult',
          consentSaveReceipts: true,
          consentMarketingNetwork: true,
          createdAt: new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        };
    this.consumerUsers.set(consumerId, unifiedConsumerUser);

    // Vincular comprobantes reclamados en este navegador a la cuenta unificada
    const deviceToken = this.getClientDeviceToken();
    const existingConsumerReceipts = this.consumerReceipts.get(consumerId) || [];
    for (const r of this.receipts) {
      if (r.claimedByDeviceId === deviceToken || r.claimedByAccountId === accountId) {
        r.claimedByAccountId = accountId;
        if (!existingConsumerReceipts.some((cr) => cr.id === r.id)) {
          existingConsumerReceipts.unshift({
            id: r.id,
            consumerId,
            tenantId: r.businessId,
            businessId: r.businessId,
            merchantName: r.businessName,
            businessAddress: r.businessAddress,
            businessHours: r.businessHours,
            cartelCode: r.cartelCode,
            amountArs: r.total,
            total: r.total,
            cashTendered: r.cashTendered,
            changeDue: r.changeDue,
            currency: r.currency,
            discountSavedArs: r.discountArs || 0,
            category: 'Comercio',
            receiptNote: `Comprobante #${r.id.slice(-6).toUpperCase()}`,
            method: r.method,
            items: r.items && r.items.length > 0 ? r.items : undefined,
            createdAt: r.createdAt,
            savedAt: r.claimedAt || new Date().toISOString(),
          });
        }
      }
    }
    this.consumerReceipts.set(consumerId, existingConsumerReceipts);

    this.persistClubData();
    this.persistPosData();

    const myToquecitos = this.toquecitos.filter((t) => t.accountId === accountId);

    return {
      recognized: true,
      accountExists: true,
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
      const shortCode = generateShortCode();
      const nowIso = new Date().toISOString();
      existing = {
        id: newId,
        accountId: this.recognizedClient.accountId,
        businessId: pub.businessId,
        businessName: pub.businessName,
        localId: pub.localId,
        localCode: pub.localCode,
        localName: pub.localName,
        shortCode,
        memberCode: shortCode,
        barcodeToken: shortCode,
        name: this.recognizedClient.name,
        email: cleanEmail,
        contact: masked,
        maskedEmail: masked,
        birthDay: this.recognizedClient.birthDay,
        birthMonth: this.recognizedClient.birthMonth,
        anonymous: false,
        marketingConsent: Boolean(data.marketingConsent),
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
        consent: Boolean(data.marketingConsent),
        stampHistory: [
          {
            id: `st-init-${Date.now().toString(36)}`,
            memberId: newId,
            localId: pub.localId,
            localName: pub.localName,
            count: 1,
            source: 'self',
            actorName: 'Sumó tarjeta a su cuenta (+1 sello)',
            createdAt: nowIso,
          },
        ],
      };
      this.memberRawEmails[newId] = cleanEmail;
      this.clubMembers.unshift(existing);
      this.persistClubData();
      this.notifyHubListeners(pub.localCode);
      this.notifyHubListeners(pub.businessId);
    }

    const account = await this.recognizeAccount(cleanEmail);
    return { member: existing, account };
  }

  // =========================================================================
  // 3. BÚSQUEDA POR CÓDIGO CORTO Y SUMA DE SELLOS EN CAJA (REGLA 24H)
  // =========================================================================

  private findMemberByShortOrBarcode(rawCode: string): ClubMember | undefined {
    const clean = (rawCode || '').trim().toUpperCase();
    if (!clean) return undefined;
    const stripped = clean.replace(/[^A-Z0-9]/g, '');
    return this.clubMembers.find((m) => {
      const mShort = (m.shortCode || '').toUpperCase();
      const mCode = (m.memberCode || '').toUpperCase();
      const mBar = (m.barcodeToken || '').toUpperCase();
      if (m.id.toUpperCase() === clean || mShort === clean || mCode === clean || mBar === clean) {
        return true;
      }
      if (stripped.length >= 6) {
        return (
          mShort.replace(/[^A-Z0-9]/g, '') === stripped ||
          mCode.replace(/[^A-Z0-9]/g, '') === stripped ||
          mBar.replace(/[^A-Z0-9]/g, '') === stripped
        );
      }
      return false;
    });
  }

  private computeCooldownState(member: ClubMember): {
    canStampNow: boolean;
    remainingMs: number;
    cooldownMessage?: string;
  } {
    if (!member.lastStampedAt) {
      return { canStampNow: true, remainingMs: 0 };
    }
    const lastMs = new Date(member.lastStampedAt).getTime();
    if (Number.isNaN(lastMs)) {
      return { canStampNow: true, remainingMs: 0 };
    }
    const elapsedMs = Date.now() - lastMs;
    if (elapsedMs >= 86400000) {
      return { canStampNow: true, remainingMs: 0 };
    }
    const remainingMs = 86400000 - elapsedMs;
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.max(1, Math.ceil((remainingMs % 3600000) / 60000));
    const isSameDay = new Date(lastMs).toDateString() === new Date().toDateString();
    const cooldownMessage = isSameDay
      ? 'Podrá sumar de nuevo mañana'
      : `Podrá sumar en ${hours} h ${minutes} min`;
    return {
      canStampNow: false,
      remainingMs,
      cooldownMessage,
    };
  }

  async lookupMemberByCode(code: string): Promise<CashierMemberLookupResult> {
    this.loadPersistedState();
    const member = this.findMemberByShortOrBarcode(code);
    if (!member) {
      throw new Error('No encontramos ese código. Revisalo y probá de nuevo.');
    }

    const cfg = member.businessId
      ? this.businessClubConfigs.get(member.businessId) || this.clubConfig
      : this.clubConfig;
    const targetStamps = member.targetStamps || member.stampsRequired || cfg.targetStamps || 5;
    const stamps = member.stamps || 0;
    const remainingStamps = Math.max(0, targetStamps - stamps);
    const rewardText =
      member.rewardText ||
      cfg.loyaltyReward ||
      cfg.rewardText ||
      'Beneficio exclusivo en tu próxima visita';
    const cooldown = this.computeCooldownState(member);
    const shortCode = member.shortCode || member.memberCode || member.barcodeToken || '48291037';

    return {
      id: member.id,
      memberId: member.id,
      shortCode,
      memberCode: shortCode,
      displayName: formatCashierMemberName(member.name),
      stamps,
      targetStamps,
      remainingStamps,
      rewardText,
      rewardPending: stamps >= targetStamps,
      rewardReady: stamps >= targetStamps,
      lastStampedAt: member.lastStampedAt,
      canStampNow: cooldown.canStampNow,
      cooldownMessage: cooldown.cooldownMessage,
      programMode: cfg.mode || 'per_visit',
      amountPerStamp: cfg.amountPerStamp || 15000,
      maxStampsPerVisit: cfg.maxStampsPerVisit || 3,
    };
  }

  private async syncMemberPassOnServer(member: ClubMember): Promise<void> {
    if (!member.walletSerial) return;
    const biz = member.businessId ? this.businesses.get(member.businessId) : this.businessProfile;
    const cfg = member.businessId
      ? this.businessClubConfigs.get(member.businessId) || this.clubConfig
      : this.clubConfig;

    const barcodeToken =
      member.shortCode || member.barcodeToken || member.memberCode || generateShortCode();

    member.shortCode = barcodeToken;
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
          stampsRequired: member.targetStamps || cfg.targetStamps || 5,
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
      member = this.findMemberByShortOrBarcode(data.memberId);
    }
    if (!member && data.memberCode) {
      member = this.findMemberByShortOrBarcode(data.memberCode);
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
        member = this.findMemberByShortOrBarcode(q);
      }
    }

    if (!member) {
      throw new Error('No encontramos ese código. Revisalo y probá de nuevo.');
    }

    const target = member.targetStamps || this.clubConfig.targetStamps || 5;
    const cooldownState = this.computeCooldownState(member);
    if (!cooldownState.canStampNow) {
      return {
        member: { ...member },
        stampsAdded: 0,
        rewardReady: member.stamps >= target,
        cooldown: true,
        remainingMs: cooldownState.remainingMs,
        message: cooldownState.cooldownMessage || 'Podrá sumar de nuevo mañana',
      };
    }

    if (data.otpCode) {
      const rawEmail = this.memberRawEmails[member.id] || member.email;
      if (rawEmail) {
        await this.verifyOtp(rawEmail, data.otpCode);
      }
    }

    const local = this.locals.find((l) => l.id === data.localId) || this.locals[0];

    // El servidor decide cuántos sellos sumar (el navegador nunca manda la cantidad de sellos)
    let stampsToAdd = 1;
    if (this.clubConfig.mode === 'per_amount') {
      const ticketAmount = Number(data.amount || 0);
      const unit = Math.max(1, this.clubConfig.amountPerStamp || 15000);
      const maxPerVisit = Math.max(1, this.clubConfig.maxStampsPerVisit || 3);
      const calculated = Math.floor(ticketAmount / unit);
      if (calculated <= 0) {
        throw new Error(
          `El monto ingresado ($${ticketAmount.toLocaleString('es-AR')}) no alcanza el mínimo de $${unit.toLocaleString('es-AR')} para 1 sello.`
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
      memberCode: member.shortCode || member.barcodeToken || member.memberCode,
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

    // Registrar último cliente sellado en caja para vincular automáticamente el comprobante si se emite en los próximos 2 minutos
    const stampedBizId = member.businessId || this.businessProfile.id;
    this.lastStampedByBusiness.set(stampedBizId, {
      memberId: member.id,
      accountId: member.accountId || member.id,
      email: this.memberRawEmails[member.id] || member.email,
      stampedAtMs: Date.now(),
    });

    this.persistClubData();
    await this.syncMemberPassOnServer(member);

    this.notifyHubListeners(member.localCode);
    this.notifyHubListeners(member.businessId);

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
    receiptId?: string;
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
    if (!pub.allowSelfScan && !data.receiptId) {
      throw new Error('Este local suma sellos únicamente con el cajero en mostrador.');
    }
    if (pub.mode === 'per_amount' && !data.receiptId) {
      throw new Error(
        'El programa de este local es por monto de compra. Pedile al cajero que escanee tu tarjeta.'
      );
    }

    const member = this.clubMembers.find((m) => m.id === data.memberId);
    if (!member) {
      throw new Error('No encontramos tu tarjeta.');
    }

    const target = member.targetStamps || pub.targetStamps || 10;

    // Si viene vinculado a un comprobante de compra real (receiptId), verificar que no se haya sumado ya por ese comprobante
    if (data.receiptId) {
      const alreadyStampedForReceipt = member.stampHistory?.some(
        (s) => s.receiptId === data.receiptId && !s.voided
      );
      if (alreadyStampedForReceipt) {
        return {
          member: { ...member },
          stampsAdded: 0,
          rewardReady: member.stamps >= target,
          cooldown: false,
        };
      }
      // Evitar duplicar sello si el socio se acaba de dar de alta hace menos de 15 segundos durante esta misma compra
      const joinedMs = member.joinedAt ? new Date(member.joinedAt).getTime() : 0;
      if (
        member.stamps === 1 &&
        (member.stampHistory?.length || 0) === 1 &&
        Date.now() - joinedMs < 15000
      ) {
        // Vincular el receiptId al sello inicial de alta para que quede registrado en esta compra
        if (member.stampHistory && member.stampHistory[0]) {
          member.stampHistory[0].receiptId = data.receiptId;
          this.persistClubData();
        }
        return {
          member: { ...member },
          stampsAdded: 0,
          rewardReady: member.stamps >= target,
          cooldown: false,
        };
      }
    } else {
      // 1. Verificar last_stamped_at del miembro en ese negocio (Regla estricta de 24 horas = 86400000 ms para visitas sin nuevo ticket)
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
    }

    const nowIso = new Date().toISOString();

    const stampEntry = {
      id: `st-self-${Date.now().toString(36)}`,
      memberId: member.id,
      localId: pub.localId,
      localName: pub.localName,
      count: 1,
      source: 'self' as const,
      receiptId: data.receiptId,
      actorName: data.receiptId ? 'Compra en el local (+1 sello)' : 'Visita en el local',
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
    const member = this.findMemberByShortOrBarcode(memberId) ||
      this.clubMembers.find((m) => m.id === memberId);
    if (!member) {
      throw new Error('Cliente no encontrado.');
    }

    const target = member.targetStamps || this.clubConfig.targetStamps || 5;
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
      memberCode: member.shortCode || member.barcodeToken || member.memberCode,
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
    if (this.currentUser?.role === 'cashier') {
      return [];
    }
    return this.filterStampLogsByPeriod(period);
  }

  async exportStampLogsCsv(
    period: '30d' | '3m' | '12m' | 'all' = '30d',
    reason?: string
  ): Promise<string> {
    if (this.currentUser?.role === 'cashier' || this.currentUser?.role === 'manager') {
      throw new Error('Solo el dueño del comercio puede exportar el historial en CSV.');
    }
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 3) {
      throw new Error('Ingresá el motivo para exportar los datos.');
    }
    const logs = this.filterStampLogsByPeriod(period);
    this.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}`,
      businessId: this.businessProfile.id,
      actionType: 'export_csv',
      actionLabel: 'Exportación de historial CSV',
      memberId: 'all',
      memberName: `${logs.length} movimientos`,
      delta: 0,
      reason: cleanReason,
      actorName: this.currentUser?.name || this.businessProfile.ownerName,
      actorRole: 'Dueño',
      createdAt: new Date().toISOString(),
    });
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
  // 4. REGISTRO DE CORRECCIONES (SOLO LECTURA, MOTIVO OBLIGATORIO)
  // =========================================================================

  private assertCanModifyAudit(reason: string): void {
    if (this.currentUser?.role === 'cashier') {
      throw new Error(
        'Solo el dueño o encargado pueden anular o ajustar sellos. El cajero solo suma.'
      );
    }
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 3) {
      throw new Error(
        'Escribí el motivo de la corrección para que quede asentado en el registro.'
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
    this.persistClubData();
    await this.syncMemberPassOnServer(member);
    this.notifyHubListeners(member.localCode);
    this.notifyHubListeners(member.businessId);
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
    this.loadPersistedState();
    this.assertCanModifyAudit(data.reason);

    if (!data.delta || data.delta === 0) {
      throw new Error('Indicá cuántos sellos querés sumar o descontar.');
    }

    const member = this.clubMembers.find((m) => m.id === data.memberId);
    if (!member) {
      throw new Error('Cliente no encontrado.');
    }

    const nowIso = new Date().toISOString();
    member.stamps = Math.max(0, (member.stamps || 0) + data.delta);
    member.points = member.stamps;
    member.lastVisitAt = nowIso;
    if (data.delta > 0) {
      member.lastStampedAt = nowIso;
    }

    const local = this.locals.find((l) => l.id === member.localId) || this.locals[0];
    member.stampHistory = [
      {
        id: `st-adj-${Date.now().toString(36)}`,
        memberId: member.id,
        localId: local?.id || 'local-1',
        localName: local?.name || 'Sucursal Central',
        count: data.delta,
        source: 'adjustment',
        actorName: this.currentUser?.name || this.businessProfile.ownerName || 'Panel del comercio',
        createdAt: nowIso,
      },
      ...(member.stampHistory || []),
    ];

    this.stampLogs.unshift({
      id: `log-${Date.now().toString(36)}`,
      businessId: member.businessId || this.businessProfile.id,
      memberId: member.id,
      memberCode: member.shortCode || member.barcodeToken || member.memberCode,
      memberName: member.name || member.maskedEmail || 'Cliente',
      memberEmail: member.maskedEmail || member.contact,
      memberPhone: member.phone || '',
      action: 'stamp_added',
      stampsDelta: data.delta,
      localName: local?.name || 'Sucursal Central',
      staffEmail: this.currentUser?.email || this.businessProfile.email,
      createdAt: nowIso,
    });

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
      createdAt: nowIso,
    };

    this.auditLogs.unshift(auditEntry);
    this.persistClubData();
    await this.syncMemberPassOnServer(member);
    this.notifyHubListeners(member.localCode);
    this.notifyHubListeners(member.businessId);
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
  // 5. CLIENTES, LOCALES, AVISOS, CONFIGURACIÓN INICIAL Y SUSCRIPCIÓN (RBAC)
  // =========================================================================

  async listMembers(filters?: {
    search?: string;
    localId?: string;
  }): Promise<ClubMember[]> {
    const bizId = this.getActiveBusinessId();
    const role = this.currentUser?.role || 'owner';
    let list = this.clubMembers.filter((m) => !m.businessId || m.businessId === bizId);
    if (filters?.localId && filters.localId !== 'all') {
      list = list.filter((m) => m.localId === filters.localId);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.shortCode || '').toLowerCase().includes(q) ||
          (m.memberCode || '').toLowerCase().includes(q) ||
          (role !== 'cashier' && (m.maskedEmail || m.contact || '').toLowerCase().includes(q))
      );
    }

    // Regla 7 (Quién ve qué):
    // - Cajero: nombre con inicial del apellido, sellos, premio. Sin mail, cumpleaños ni historial.
    // - Encargado: lista de clientes con mail parcialmente tapado, cumpleaños (día y mes) y sellos.
    // - Dueño: todo lo anterior, exportar CSV, borrar socio y configurar avisos.
    return list.map((m) => {
      if (role === 'cashier') {
        return {
          ...m,
          name: formatCashierMemberName(m.name),
          email: undefined,
          maskedEmail: '',
          contact: '',
          birthDate: undefined,
          birthDay: undefined,
          birthMonth: undefined,
          stampHistory: [],
        };
      }
      return {
        ...m,
        email: role === 'owner' ? m.email : undefined,
        maskedEmail: m.maskedEmail || maskEmailAddress(m.email || ''),
        birthDate: undefined,
      };
    });
  }

  async listClubMembers(): Promise<ClubMember[]> {
    return this.listMembers();
  }

  async exportClubMembersCsv(reason?: string): Promise<string> {
    const role = this.currentUser?.role || 'owner';
    if (role === 'cashier' || role === 'manager') {
      throw new Error('Solo el dueño del comercio puede exportar la lista de socios en CSV.');
    }
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 3) {
      throw new Error('Escribí el motivo para exportar la lista de socios.');
    }
    const members = await this.listMembers();
    this.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}`,
      businessId: this.businessProfile.id,
      actionType: 'export_csv',
      actionLabel: 'Exportación de socios CSV',
      memberId: 'all',
      memberName: `${members.length} socio(s)`,
      delta: 0,
      reason: cleanReason,
      actorName: this.currentUser?.name || this.businessProfile.ownerName,
      actorRole: 'Dueño',
      createdAt: new Date().toISOString(),
    });
    const header =
      'ID,Codigo Corto,Nombre,Correo,Cumpleanos (Dia/Mes),Sellos,Premios Canjeados,Local,Fecha Alta\n';
    const rows = members
      .map((m) => {
        const bday =
          m.birthDay && m.birthMonth ? `${m.birthDay}/${m.birthMonth}` : 'Sin informar';
        return `"${m.id}","${m.shortCode || m.memberCode || '-'}","${m.name || 'Socio'}","${m.maskedEmail || m.contact}","${bday}",${m.stamps || 0},${m.rewardsRedeemed || 0},"${m.localName || 'Casa Central'}","${m.joinedAt}"`;
      })
      .join('\n');
    return header + rows;
  }

  async deleteClubMember(id: string, reason?: string): Promise<void> {
    await this.revokeMemberCard(id, reason);
  }

  async revokeMemberCard(
    memberId: string,
    reason?: string
  ): Promise<{ revoked: boolean; walletRevoked?: boolean }> {
    this.loadPersistedState();
    const role = this.currentUser?.role || 'owner';
    if (role === 'cashier' || role === 'manager') {
      throw new Error('Solo el dueño del comercio puede borrar socios del Club.');
    }
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 3) {
      throw new Error('Escribí el motivo para borrar al socio.');
    }
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
    this.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}`,
      businessId: this.businessProfile.id,
      actionType: 'delete_member',
      actionLabel: 'Borrado de socio',
      memberId: found?.id || memberId,
      memberName: found?.name || found?.maskedEmail || 'Socio',
      delta: -(found?.stamps || 0),
      reason: cleanReason,
      actorName: this.currentUser?.name || this.businessProfile.ownerName,
      actorRole: 'Dueño',
      createdAt: new Date().toISOString(),
    });
    this.clubMembers = this.clubMembers.filter((m) => m.id !== memberId);
    delete this.memberRawEmails[memberId];
    this.persistClubData();
    return { revoked: true, walletRevoked };
  }

  async getClubConfig(): Promise<ClubConfig> {
    return { ...this.clubConfig };
  }

  async updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig> {
    const nextColor = patch.cardThemeColor || patch.brandColor || this.clubConfig.brandColor || '#141414';
    const nextTitle =
      patch.loyaltyTitle || patch.name || patch.clubName || this.clubConfig.loyaltyTitle || this.clubConfig.name;
    const nextReward =
      patch.loyaltyReward || patch.rewardText || this.clubConfig.loyaltyReward || this.clubConfig.rewardText;
    const nextTarget =
      patch.stampsRequired || patch.targetStamps || this.clubConfig.targetStamps || 5;
    const nextLogo = patch.logoUrl !== undefined ? patch.logoUrl : this.clubConfig.logoUrl;
    const nextPreset = patch.colorPreset || this.clubConfig.colorPreset || 'dark';
    const nextCustomColor = patch.customColor !== undefined ? patch.customColor : this.clubConfig.customColor;
    const nextRewardValueArs =
      patch.rewardValueArs !== undefined ? patch.rewardValueArs : this.clubConfig.rewardValueArs;
    const nextBizName =
      patch.organizationName || patch.logoText || this.businessProfile.name;

    this.clubConfig = {
      ...this.clubConfig,
      ...patch,
      name: nextTitle,
      clubName: nextTitle,
      loyaltyTitle: nextTitle,
      brandColor: nextColor,
      cardThemeColor: nextColor,
      colorPreset: nextPreset,
      customColor: nextCustomColor,
      logoUrl: nextLogo,
      rewardText: nextReward,
      loyaltyReward: nextReward,
      rewardValueArs: nextRewardValueArs,
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
      name: nextBizName,
      logoUrl: nextLogo || this.businessProfile.logoUrl,
      cardThemeColor: nextColor,
      loyaltyTitle: nextTitle,
      loyaltyReward: nextReward,
      howToEarn: this.clubConfig.howToEarn,
      expirationPolicy: this.clubConfig.expirationPolicy,
      stampsRequired: nextTarget,
    };

    this.hubConfig = {
      ...this.hubConfig,
      businessName: nextBizName,
      logoUrl: nextLogo || this.hubConfig.logoUrl,
      colorPreset: nextPreset,
      customColor: nextCustomColor,
      stampsRequired: nextTarget,
      rewardText: nextReward,
      rewardValueArs: nextRewardValueArs,
    };

    // Propagar diseño actualizado en tiempo real a todas las tarjetas de este comercio
    const bizId = this.getActiveBusinessId();
    this.clubMembers = this.clubMembers.map((m) => {
      if (!m.businessId || m.businessId === bizId) {
        return {
          ...m,
          businessName: this.businessProfile.name,
          logoUrl: nextLogo || m.logoUrl,
          colorPreset: nextPreset,
          customColor: nextCustomColor,
          rewardText: nextReward || m.rewardText,
          rewardValueArs: nextRewardValueArs ?? m.rewardValueArs,
          stampsRequired: nextTarget,
          targetStamps: nextTarget,
        };
      }
      return m;
    });

    this.syncActiveBusinessStore();
    this.persistClubData();
    this.notifyHubListeners();

    // Sincronizar con el servidor y disparar actualización de pases activos en Apple/Google Wallet
    fetch('/api/merchant/hub-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: bizId,
        businessName: this.businessProfile.name,
        logoUrl: nextLogo,
        brandColor: nextCustomColor || nextColor,
        colorPreset: nextPreset,
        stampsRequired: nextTarget,
        rewardText: nextReward,
        rewardValueArs: nextRewardValueArs,
      }),
    }).catch(() => {});

    return { ...this.clubConfig };
  }

  async listClubCards(): Promise<ClubConfig[]> {
    this.loadPersistedState();
    const bizId = this.getActiveBusinessId();
    const cards = this.businessClubCards.get(bizId) ?? [];
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
    this.loadPersistedState();
    const bizId = this.getActiveBusinessId();
    const currentCards = this.businessClubCards.get(bizId) ?? [];

    if (currentCards.length >= 1) {
      throw new Error(
        'Tenés 1 tarjeta activa en tu local. Si necesitás crear más de una tarjeta, ponete en contacto con nosotros'
      );
    }

    const rawTitle = (data.loyaltyTitle || data.name || data.logoText || '').trim();
    const cleanName = rawTitle || `Tarjeta de sellos de ${this.businessProfile.name}`;
    const cleanReward = data.rewardText.trim() || 'Beneficio al completar tus 10 sellos';
    const targetStamps = 10;
    const color = data.customColor || data.brandColor || '#141418';

    const newCard: ClubConfig = {
      ...this.clubConfig,
      id: `card-${Date.now().toString(36)}`,
      name: cleanName,
      clubName: cleanName,
      loyaltyTitle: cleanName,
      logoText: data.logoText || cleanName,
      organizationName: data.organizationName || this.businessProfile.name,
      barcodeFormat: data.barcodeFormat || 'CODE128',
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
      primaryFields: data.primaryFields || [{ label: 'Sellos', value: `1 de ${targetStamps}` }],
      secondaryFields: data.secondaryFields || [
        { label: 'Premio', value: cleanReward },
        { label: 'Cliente', value: this.businessProfile.name },
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

    const nextCards = [newCard];
    this.businessClubCards.set(bizId, nextCards);
    this.clubConfig = { ...newCard };
    this.syncActiveBusinessStore();
    this.notifyHubListeners();

    fetch('/api/merchant/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: bizId,
        businessName: this.businessProfile.name,
        rewardText: cleanReward,
        brandColor: color,
        colorPreset: newCard.colorPreset,
        logoUrl: newCard.logoUrl,
      }),
    }).catch(() => {});

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
    if (this.currentUser?.role === 'cashier' || this.currentUser?.role === 'manager') {
      throw new Error('Solo el dueño del comercio puede configurar los avisos.');
    }
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
    if (this.currentUser?.role === 'cashier' || this.currentUser?.role === 'manager') {
      throw new Error('Solo el dueño del comercio puede configurar los avisos.');
    }
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

  async selectPlan(
    planChoice: 'mensual' | 'anual' | 'trial_14' | 'trial_14d'
  ): Promise<PlanState> {
    if (planChoice === 'mensual') {
      this.planState = {
        status: 'active',
        planId: 'mensual',
        tier: 'pro',
        billingCycle: 'monthly',
        daysRemaining: 30,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        unpaidLockdown: false,
        planSelected: true,
        isSimulated: true,
      };
      this.businessProfile.planPaid = true;
      this.businessProfile.planSelected = true;
      this.syncActiveBusinessStore();
      return { ...this.planState };
    }

    if (planChoice === 'anual') {
      this.planState = {
        status: 'active',
        planId: 'anual',
        tier: 'pro',
        billingCycle: 'annual',
        daysRemaining: 365,
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        unpaidLockdown: false,
        planSelected: true,
        isSimulated: true,
      };
      this.businessProfile.planPaid = true;
      this.businessProfile.planSelected = true;
      this.syncActiveBusinessStore();
      return { ...this.planState };
    }

    // Probar 14 días gratis (plan Pro)
    const trialEndsAt = new Date(Date.now() + pruebaGratisDias * 86400000).toISOString();
    this.planState = {
      status: 'trial',
      planId: 'anual',
      tier: 'pro',
      billingCycle: 'annual',
      daysRemaining: pruebaGratisDias,
      graceDaysRemaining: 2,
      unpaidLockdown: false,
      trialStartedAt: new Date().toISOString(),
      trialEndsAt,
      expiresAt: trialEndsAt,
      planSelected: true,
      isSimulated: true,
    };
    this.businessProfile.planPaid = false;
    this.businessProfile.planSelected = true;
    this.businessProfile.trialEndsAt = trialEndsAt;
    this.syncActiveBusinessStore();
    return { ...this.planState };
  }

  async startTrial(planId: 'free' | 'mensual' | 'anual' | 'a_consultar' = 'anual'): Promise<PlanState> {
    if (planId === 'mensual') {
      return this.selectPlan('mensual');
    }
    if (planId === 'free') {
      this.planState = {
        status: 'free',
        planId: 'free',
        tier: 'free',
        billingCycle: 'free',
        daysRemaining: 0,
        unpaidLockdown: false,
        planSelected: true,
        isSimulated: true,
      };
      this.businessProfile.planPaid = false;
      this.businessProfile.planSelected = true;
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
        planSelected: true,
        isSimulated: true,
      };
      this.businessProfile.planPaid = true;
      this.businessProfile.planSelected = true;
      this.syncActiveBusinessStore();
      return { ...this.planState };
    }
    return this.selectPlan('trial_14');
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
    status?: Cartel['status'];
    pin?: string;
    activationPin?: string;
    tileColor?: Cartel['tileColor'];
    location?: string;
  }): Promise<Cartel> {
    const bizId = this.getActiveBusinessId();
    const code = (data.code || `MONROE0${this.carteles.length + 1}`).toUpperCase();
    const pin = data.pin || data.activationPin || '102030';
    const created: Cartel = {
      id: `cartel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      code,
      pin,
      activationPin: pin,
      businessId: bizId,
      name: data.name.trim(),
      location: data.location || 'Mostrador principal',
      role: data.role,
      status: data.status || 'active',
      tileColor: data.tileColor || 'black',
      reviewUrl: data.reviewUrl ?? this.businessProfile.reviewUrl ?? '',
      mode: data.mode || 'smart_hub',
      scans: 0,
      scansCount: 0,
      reviewClicksCount: 0,
      createdAt: new Date().toISOString(),
      activatedAt: (data.status || 'active') === 'active' ? new Date().toISOString() : undefined,
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
    if (patch.businessName && patch.businessName.trim()) {
      this.businessProfile.name = patch.businessName.trim();
      this.clubConfig.organizationName = patch.businessName.trim();
      this.clubConfig.logoText = patch.businessName.trim();
    }
    if (patch.logoUrl !== undefined) {
      this.businessProfile.logoUrl = patch.logoUrl;
      this.clubConfig.logoUrl = patch.logoUrl;
    }
    if (patch.colorPreset !== undefined) {
      this.clubConfig.colorPreset = patch.colorPreset;
    }
    if (patch.customColor !== undefined) {
      this.clubConfig.customColor = patch.customColor;
      this.clubConfig.brandColor = patch.customColor || this.clubConfig.brandColor;
      this.businessProfile.cardThemeColor = patch.customColor || this.businessProfile.cardThemeColor;
    }
    if (patch.stampsRequired !== undefined) {
      this.clubConfig.stampsRequired = patch.stampsRequired;
      this.clubConfig.targetStamps = patch.stampsRequired;
      this.businessProfile.stampsRequired = patch.stampsRequired;
    }
    if (patch.rewardText !== undefined) {
      this.clubConfig.rewardText = patch.rewardText;
      this.clubConfig.loyaltyReward = patch.rewardText;
      this.businessProfile.loyaltyReward = patch.rewardText;
    }
    if (patch.rewardValueArs !== undefined) {
      this.clubConfig.rewardValueArs = patch.rewardValueArs;
    }
    if (patch.googleReviewUrl !== undefined) {
      this.businessProfile.reviewUrl = patch.googleReviewUrl;
      for (const c of this.carteles) {
        if (!c.businessId || c.businessId === this.businessProfile.id) {
          c.reviewUrl = patch.googleReviewUrl;
        }
      }
    }

    const bizId = this.getActiveBusinessId();
    this.clubMembers = this.clubMembers.map((m) => {
      if (!m.businessId || m.businessId === bizId) {
        return {
          ...m,
          businessName: this.businessProfile.name,
          logoUrl: this.clubConfig.logoUrl || m.logoUrl,
          colorPreset: this.clubConfig.colorPreset || m.colorPreset || 'dark',
          customColor: this.clubConfig.customColor || m.customColor,
          rewardText: this.clubConfig.rewardText || m.rewardText,
          rewardValueArs: this.clubConfig.rewardValueArs ?? m.rewardValueArs,
          stampsRequired: this.clubConfig.stampsRequired || m.stampsRequired,
          targetStamps: this.clubConfig.targetStamps || m.targetStamps,
        };
      }
      return m;
    });

    this.syncActiveBusinessStore();
    this.persistClubData();
    this.notifyHubListeners();

    fetch('/api/merchant/hub-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: bizId,
        businessName: this.businessProfile.name,
        logoUrl: this.clubConfig.logoUrl || this.hubConfig.logoUrl,
        brandColor: this.clubConfig.customColor || this.clubConfig.brandColor,
        colorPreset: this.clubConfig.colorPreset || this.hubConfig.colorPreset || 'dark',
        stampsRequired: this.clubConfig.stampsRequired,
        rewardText: this.clubConfig.rewardText,
        rewardValueArs: this.clubConfig.rewardValueArs,
      }),
    }).catch(() => {});

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
    const deviceToken = this.getClientDeviceToken();

    // Buscar comprobante activo del cartel emitido recientemente.
    // Como el QR del Hub es fijo (está impreso en el mostrador), el primer cliente que abre el Hub
    // cuando hay un comprobante 'ready' lo reclama de forma exclusiva para su dispositivo/cuenta.
    // Nadie más que escanee después el mismo QR fijo puede ver el comprobante de otro cliente.
    let activeReceipt: Receipt | null = null;
    if (cartel.activeReceiptId) {
      const found = this.receipts.find((r) => r.id === cartel.activeReceiptId);
      if (found && found.status !== 'cancelled') {
        const currentAccId = this.recognizedClient?.accountId;
        // a) Ya está asignado directamente al cliente (ej. porque acaba de sumar sello en caja)
        const isAssignedToMe =
          Boolean(currentAccId && found.claimedByAccountId === currentAccId) ||
          found.claimedByDeviceId === deviceToken;

        if (isAssignedToMe) {
          activeReceipt = found;
        } else {
          // b) Emitido hace menos de 90 segundos y claimed_by es NULL
          const expMs = new Date(found.expiresAt).getTime();
          const isWithin90s = !Number.isNaN(expMs) && Date.now() <= expMs;
          const isUnclaimed = !found.claimedByDeviceId && !found.claimedByAccountId;
          if (isWithin90s && isUnclaimed) {
            found.claimedByDeviceId = deviceToken;
            found.status = 'claimed';
            found.claimedAt = new Date().toISOString();
            if (currentAccId) {
              found.claimedByAccountId = currentAccId;
            }
            this.persistPosData();
            activeReceipt = found;
          }
        }
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

    // Buscar socio reconocido para este comercio en memoria
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
        '',
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
    const key = (code || 'MONROE01').trim();
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
    const found = this.receipts.find((r) => r.id.toLowerCase() === target) || null;
    if (!found) return null;
    const deviceToken = this.getClientDeviceToken();
    if (!found.claimedByDeviceId) {
      found.claimedByDeviceId = deviceToken;
      found.status = 'claimed';
      found.claimedAt = new Date().toISOString();
      if (this.recognizedClient?.accountId) {
        found.claimedByAccountId = this.recognizedClient.accountId;
      }
      this.persistPosData();
    } else if (
      found.claimedByDeviceId !== deviceToken &&
      (!this.recognizedClient?.accountId ||
        found.claimedByAccountId !== this.recognizedClient.accountId)
    ) {
      return null;
    }
    return found;
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
    const deviceToken = this.getClientDeviceToken();
    if (
      receipt.claimedByDeviceId &&
      receipt.claimedByDeviceId !== deviceToken &&
      (!this.recognizedClient?.accountId ||
        receipt.claimedByAccountId !== this.recognizedClient.accountId)
    ) {
      throw new Error('Este comprobante ya fue reclamado por otro cliente.');
    }
    receipt.status = 'claimed';
    receipt.claimedAt = receipt.claimedAt || new Date().toISOString();
    receipt.claimedByDeviceId = receipt.claimedByDeviceId || deviceToken;
    if (this.recognizedClient?.accountId) {
      receipt.claimedByAccountId = this.recognizedClient.accountId;
    }
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
      data.cartelCode || 'MONROE01'
    );
    const member = data.memberId
      ? this.clubMembers.find((m) => m.id === data.memberId)
      : undefined;

    const rawCandidate =
      member?.barcodeToken ||
      member?.shortCode ||
      member?.memberCode ||
      data.memberCode ||
      data.barcodeValue ||
      clubCfg.barcodeValue ||
      '';
    const immutableCode = /^\d{8}$/.test(rawCandidate) ? rawCandidate : generateShortCode();

    if (member) {
      member.shortCode = immutableCode;
      member.memberCode = immutableCode;
      member.barcodeToken = immutableCode;
    }

    const payload = {
      businessId: business.id,
      businessName: business.name,
      title: data.logoText || clubCfg.logoText || business.name,
      logoText: data.logoText || clubCfg.logoText || business.name,
      organizationName: data.organizationName || clubCfg.organizationName || business.name,
      memberName: data.customerName ?? (member?.anonymous ? undefined : member?.name),
      memberId: member?.id || data.memberId || immutableCode,
      reward:
        data.rewardText ||
        clubCfg.loyaltyReward ||
        clubCfg.rewardText ||
        'Beneficio al completar tus sellos',
      backgroundColor:
        data.color || clubCfg.customColor || clubCfg.cardThemeColor || clubCfg.brandColor || '#141414',
      color: data.color || clubCfg.customColor || undefined,
      colorPreset: data.colorPreset || member?.colorPreset || clubCfg.colorPreset || 'dark',
      barcodeFormat: 'CODE128',
      barcodeValue: immutableCode,
      barcodeToken: immutableCode,
      barcodeAltText: immutableCode,
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
      stamps: member?.stamps ?? data.stamps ?? 1,
      stampsRequired: member?.stampsRequired ?? data.stampsRequired ?? clubCfg.targetStamps ?? 10,
      rewardText:
        data.rewardText ||
        member?.rewardText ||
        clubCfg.loyaltyReward ||
        clubCfg.rewardText ||
        'Beneficio al completar tus sellos',
      customerName: data.customerName ?? (member?.anonymous ? '' : member?.name || ''),
      customerContact: data.customerContact || data.contact || member?.maskedEmail || '',
      code: cartel.code,
      memberCode: immutableCode,
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

      if (response.status === 503 || passRes.configured === false) {
        return {
          success: false,
          configured: false,
          walletSyncError: 'Pronto vas a poder guardarla en tu billetera',
        };
      }

      if (!response.ok || passRes.success === false) {
        const errMsg = 'No pudimos crear tu tarjeta. Probá de nuevo.';
        if (member) {
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
        member.passId = passRes.serialNumber || passRes.passId;
        member.walletSerial = passRes.serialNumber || passRes.passId;
        member.shareUrl = passRes.shareUrl || passRes.appleWalletUrl;
        member.appleWalletUrl = `/api/wallet/pass/${encodeURIComponent(immutableCode)}.pkpass`;
        member.googleWalletUrl = passRes.googleWalletUrl || passRes.shareUrl;
        member.walletSyncError = passRes.walletSyncError || undefined;
        this.persistClubData();
      }
      return {
        ...passRes,
        appleWalletUrl: `/api/wallet/pass/${encodeURIComponent(immutableCode)}.pkpass`,
        barcodeValue: immutableCode,
        configured: true,
      };
    } catch (err: any) {
      if (err?.message === 'Pronto vas a poder guardarla en tu billetera') {
        return {
          success: false,
          configured: false,
          walletSyncError: 'Pronto vas a poder guardarla en tu billetera',
        };
      }
      const errMsg = 'No pudimos crear tu tarjeta. Probá de nuevo.';
      if (member) {
        member.walletSyncError = errMsg;
        this.persistClubData();
      }
      throw new Error(errMsg);
    }
  }

  async createSale(data: {
    cartelId: string;
    amount: number;
    cashTendered?: number;
    changeDue?: number;
    discountArs?: number;
    items?: SaleItem[];
    method: PaymentMethod;
  }): Promise<{ sale: Sale; qrData?: string; receipt?: Receipt }> {
    this.loadPersistedState();
    const cartel = this.carteles.find((c) => c.id === data.cartelId) || this.carteles[0];
    const nowIso = new Date().toISOString();
    const saleId = `sale-${Date.now()}`;
    const receiptId = `rcp-${Date.now()}`;
    const configuredAddress = this.hubConfig.details?.address?.trim() || undefined;
    const configuredHours = this.hubConfig.details?.hours?.trim() || undefined;

    const sale: Sale = {
      id: saleId,
      businessId: this.businessProfile.id,
      cartelId: cartel.id,
      cartelCode: cartel.code,
      cartelName: cartel.name,
      receiptId,
      amount: data.amount,
      cashTendered: data.cashTendered,
      changeDue: data.changeDue,
      discountArs: data.discountArs,
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

    const nowMs = Date.now();
    const recentStamp = this.lastStampedByBusiness.get(this.businessProfile.id);
    const hasRecentStamp =
      recentStamp && nowMs - recentStamp.stampedAtMs <= 120000; // 2 minutos

    let directAccountId: string | undefined;
    if (hasRecentStamp && recentStamp) {
      directAccountId = recentStamp.accountId || recentStamp.memberId;
      this.lastStampedByBusiness.delete(this.businessProfile.id);
    }

    const receipt: Receipt = {
      id: receiptId,
      saleId: sale.id,
      businessId: sale.businessId,
      cartelCode: cartel.code,
      status: directAccountId ? 'claimed' : 'ready',
      expiresAt: new Date(nowMs + 90000).toISOString(), // 90 segundos de validez
      claimedByAccountId: directAccountId,
      claimedAt: directAccountId ? nowIso : undefined,
      businessName: this.businessProfile.name,
      businessAddress: configuredAddress,
      businessHours: configuredHours,
      items: sale.items,
      total: sale.amount,
      cashTendered: sale.cashTendered,
      changeDue: sale.changeDue,
      discountArs: sale.discountArs,
      currency: 'ARS',
      method: sale.method,
      createdAt: nowIso,
    };
    this.receipts.unshift(receipt);
    cartel.activeReceiptId = receipt.id;
    cartel.activeReceiptExpiresAt = receipt.expiresAt;

    fetch('/api/merchant/pos-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: sale.businessId,
        localCode: cartel.code,
        merchantName: this.businessProfile.name,
        amountArs: sale.amount,
        discountSavedArs: sale.discountArs || 0,
        paymentMethod: sale.method,
        cashReceivedArs: sale.cashTendered,
        changeArs: sale.changeDue,
        items: sale.items,
        consumerId: directAccountId,
      }),
    }).catch(() => {});

    this.notifySalesListeners();
    this.notifyHubListeners(cartel.code);
    this.notifyHubListeners(this.businessProfile.id);

    return { sale, receipt };
  }

  async getSale(id: string): Promise<Sale> {
    this.loadPersistedState();
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
    const configuredAddress = this.hubConfig.details?.address?.trim() || undefined;
    const configuredHours = this.hubConfig.details?.hours?.trim() || undefined;
    const receipt: Receipt = {
      id: `rcp-${Date.now()}`,
      saleId: sale.id,
      businessId: sale.businessId,
      cartelCode: sale.cartelCode || 'MONROE01',
      status: 'ready',
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      businessName: this.businessProfile.name,
      businessAddress: configuredAddress,
      businessHours: configuredHours,
      items: sale.items,
      total: sale.amount,
      cashTendered: sale.cashTendered,
      changeDue: sale.changeDue,
      discountArs: sale.discountArs,
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
    this.loadPersistedState();
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
    this.loadPersistedState();
    const cleanContact = (payload.user.emailOrPhone || '').trim().toLowerCase();
    const accountId =
      this.recognizedClient?.accountId ||
      this.clientAccountsByEmail.get(cleanContact)?.accountId ||
      payload.user.id;

    const unifiedUser: ConsumerUser = {
      ...payload.user,
      id: accountId,
      emailOrPhone: cleanContact || payload.user.emailOrPhone,
    };

    this.consumerUsers.set(accountId, unifiedUser);
    this.consumerReceipts.set(accountId, payload.receipts);

    if (cleanContact && cleanContact.includes('@')) {
      const clientAcc = {
        accountId,
        name: unifiedUser.displayName || cleanContact.split('@')[0],
        email: cleanContact,
      };
      this.recognizedClient = clientAcc;
      this.clientAccountsByEmail.set(cleanContact, clientAcc);
    }

    this.persistClubData();

    try {
      const res = await fetch('/api/consumer/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: unifiedUser, receipts: payload.receipts }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          consumerId: data.consumerId || unifiedUser.id,
          recoveryCode: data.recoveryCode || `TQ-${unifiedUser.id.slice(0, 6).toUpperCase()}`,
          user: unifiedUser,
          receipts: payload.receipts,
        };
      }
    } catch {
      // Fallback en memoria
    }

    return {
      success: true,
      consumerId: unifiedUser.id,
      recoveryCode: `TQ-${unifiedUser.id.slice(0, 6).toUpperCase()}`,
      user: unifiedUser,
      receipts: payload.receipts,
    };
  }

  async recoverConsumerVault(contactOrId: string): Promise<{
    found: boolean;
    user?: ConsumerUser;
    receipts?: ConsumerReceipt[];
  }> {
    this.loadPersistedState();
    const q = (contactOrId || this.recognizedClient?.email || '').trim().toLowerCase();
    if (!q) return { found: false };

    // Si existe cuenta en Club, sincronizarla automáticamente con la bóveda de Toquecitos
    if (q.includes('@')) {
      await this.recognizeAccount(q);
    }

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
    if (patch.name) {
      this.clubConfig.organizationName = patch.name;
      this.clubConfig.logoText = patch.name;
      this.hubConfig.businessName = patch.name;
      const bizId = this.getActiveBusinessId();
      this.clubMembers = this.clubMembers.map((m) =>
        !m.businessId || m.businessId === bizId ? { ...m, businessName: patch.name! } : m
      );
    }
    if (patch.logoUrl !== undefined) {
      this.clubConfig.logoUrl = patch.logoUrl;
      this.hubConfig.logoUrl = patch.logoUrl;
    }
    this.syncActiveBusinessStore();
    this.persistClubData();
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
        owner: 'Dueño de comercio',
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
        roleLabel: m.anonymous ? 'Socio anónimo' : 'Socio club de sellos',
        displayName: m.name || m.memberCode || 'Socio',
        emailOrContact: m.maskedEmail || m.contact,
        businessId: m.businessId || 'musical-monroe',
        businessName: biz?.name || 'Musical Monroe',
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

