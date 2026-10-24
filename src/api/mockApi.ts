/**
 * Toque — Mock API en Memoria (mockApi)
 * Cumple estrictamente las Reglas de Oro:
 * 1. Sin Firebase, sin Firestore y sin localStorage como base de datos.
 * 2. Sin contraseñas: ingreso y confirmación por código de 6 dígitos (OTP) por mail.
 * 3. Sin usuario por defecto: sin sesión activa devuelve null.
 * 4. Cifras y registros de muestra siempre rotulados como "Ejemplo".
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
  ClubPublicInfo,
  RecognizedClientAccount,
  ClubLocal,
  AuditLogEntry,
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
  CartelBatch,
  BusinessProfile,
  CartelRole,
  HubMode,
  PaymentMethod,
  SaleItem,
  TeamMember,
  WalletPassResponse,
  SuperAdminSummary,
  NetworkActivation,
  NetworkActivationFormat,
  ConsumerUser,
  ConsumerReceipt,
} from './types';
import { TRIAL_DAYS } from '../config/pricing';

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

class MockApi implements ToqueApi {
  // Regla de Oro 3: Sin sesión válida al inicio, no hay usuario por defecto.
  private currentUser: User | null = null;

  // Cuenta reconocida del cliente en memoria (para probar reconocimiento entre comercios)
  private recognizedClient: {
    accountId: string;
    name: string;
    email: string;
    birthDay?: number;
    birthMonth?: number;
  } | null = null;

  // Almacén de códigos OTP de 6 dígitos en memoria
  private otpStore: Map<string, OtpRecord> = new Map();

  // Control de 1 visita por día en autoservicio: key = `${memberId}_${localCode}_${YYYY-MM-DD}`
  private selfStampDailyLog: Set<string> = new Set();

  // Perfil del comercio de ejemplo
  private businessProfile: BusinessProfile = {
    id: 'biz-ejemplo-1',
    name: 'Café La Esquina (Ejemplo)',
    ownerName: 'Martín Gómez (Ejemplo)',
    email: 'comercio@toque.ar',
    reviewUrl: 'https://maps.google.com',
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  };

  // Otros comercios para probar escaneo de un segundo local con cuenta reconocida
  private externalPublicClubs: Record<string, ClubPublicInfo> = {
    HELADO01: {
      businessId: 'biz-ejemplo-2',
      businessName: 'Heladería Del Parque (Ejemplo)',
      localId: 'local-ext-1',
      localCode: 'HELADO01',
      localName: 'Sucursal Parque Centenario (Ejemplo)',
      localAddress: 'Av. Díaz Vélez 4820, CABA',
      programName: 'Club Del Parque (Ejemplo)',
      brandColor: '#0D9488',
      targetStamps: 8,
      rewardText: '1/4 kg de helado artesanal sin cargo',
      mode: 'per_visit',
      allowSelfScan: true,
      allowCashierScan: true,
      isSample: true,
    },
    LIBRO01: {
      businessId: 'biz-ejemplo-3',
      businessName: 'Librería & Café Sur (Ejemplo)',
      localId: 'local-ext-2',
      localCode: 'LIBRO01',
      localName: 'Local San Telmo (Ejemplo)',
      localAddress: 'Defensa 940, CABA',
      programName: 'Club Lectores Sur (Ejemplo)',
      brandColor: '#B45309',
      targetStamps: 6,
      rewardText: 'Libro de bolsillo o merienda a elección',
      mode: 'per_visit',
      allowSelfScan: true,
      allowCashierScan: true,
      isSample: true,
    },
  };

  // Locales del comercio
  private locals: ClubLocal[] = [
    {
      id: 'local-1',
      businessId: 'biz-ejemplo-1',
      code: 'CAJA01',
      name: 'Local Centro (Ejemplo)',
      address: 'Av. Corrientes 1450, CABA',
      lat: -34.6037,
      lng: -58.3816,
      visitsCount: 42,
      newMembersCount: 18,
      returningCount: 24,
      rewardsRedeemedCount: 5,
      createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
      isSample: true,
    },
    {
      id: 'local-2',
      businessId: 'biz-ejemplo-1',
      code: 'BELGRANO02',
      name: 'Local Belgrano (Ejemplo)',
      address: 'Av. Cabildo 2180, CABA',
      lat: -34.5614,
      lng: -58.4566,
      visitsCount: 19,
      newMembersCount: 9,
      returningCount: 10,
      rewardsRedeemedCount: 2,
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      isSample: true,
    },
  ];

  // Equipo del comercio (rotulados Ejemplo)
  private teamMembers: TeamMember[] = [
    {
      id: 'team-1',
      businessId: 'biz-ejemplo-1',
      name: 'Martín Gómez (Ejemplo)',
      email: 'comercio@toque.ar',
      role: 'owner',
      assignedCartelId: 'cartel-caja-1',
      assignedCartelCode: 'CAJA01',
      assignedLocalIds: ['local-1', 'local-2'],
      status: 'active',
      addedAt: new Date(Date.now() - 86400000 * 20).toISOString(),
      isSample: true,
    },
    {
      id: 'team-2',
      businessId: 'biz-ejemplo-1',
      name: 'Laura Méndez (Ejemplo)',
      email: 'encargado@toque.ar',
      role: 'manager',
      assignedCartelId: 'cartel-caja-1',
      assignedCartelCode: 'CAJA01',
      assignedLocalIds: ['local-1', 'local-2'],
      status: 'active',
      addedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      isSample: true,
    },
    {
      id: 'team-3',
      businessId: 'biz-ejemplo-1',
      name: 'Lucas Silva (Ejemplo)',
      email: 'caja@toque.ar',
      role: 'cashier',
      assignedCartelId: 'cartel-caja-1',
      assignedCartelCode: 'CAJA01',
      assignedLocalIds: ['local-1'],
      status: 'active',
      addedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
      isSample: true,
    },
    {
      id: 'team-admin',
      businessId: 'biz-ejemplo-1',
      name: 'Administrador Toque (Ejemplo)',
      email: 'admin@toque.ar',
      role: 'owner',
      assignedLocalIds: ['local-1', 'local-2'],
      status: 'active',
      addedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      isSample: true,
    },
  ];

  // Configuración del Club
  private clubConfig: ClubConfig = {
    name: 'Club Café La Esquina (Ejemplo)',
    clubName: 'Club Café La Esquina (Ejemplo)',
    brandColor: '#3A3FE0',
    logoUrl: '',
    targetStamps: 10,
    rewardText: 'Un café grande + 2 medialunas sin cargo',
    welcomeBenefitText: 'Un café grande + 2 medialunas sin cargo',
    pointsPerVisit: 1,
    enabled: true,
    mode: 'per_visit',
    amountPerStamp: 4000,
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
      { id: 'rew-1', label: 'Un café grande + 2 medialunas sin cargo', target: 10 },
    ],
    active: true,
  };

  // Clientes de ejemplo del Club (con mail parcialmente oculto para el comercio)
  private clubMembers: ClubMember[] = [
    {
      id: 'member-ejemplo-1',
      accountId: 'acc-ejemplo-1',
      businessId: 'biz-ejemplo-1',
      localId: 'local-1',
      localCode: 'CAJA01',
      localName: 'Local Centro (Ejemplo)',
      name: 'Diego Morales (Ejemplo)',
      contact: 'd***@gmail.com',
      maskedEmail: 'd***@gmail.com',
      birthDay: 14,
      birthMonth: 5,
      anonymous: false,
      marketingConsent: true,
      points: 7,
      stamps: 7,
      targetStamps: 10,
      rewardsRedeemed: 1,
      lastVisitAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      joinedAt: new Date(Date.now() - 86400000 * 18).toISOString(),
      consent: true,
      isSample: true,
      stampHistory: [
        {
          id: 'st-ej-1',
          memberId: 'member-ejemplo-1',
          localId: 'local-1',
          localName: 'Local Centro (Ejemplo)',
          count: 1,
          source: 'cashier',
          actorName: 'Lucas Silva (Ejemplo)',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
        {
          id: 'st-ej-2',
          memberId: 'member-ejemplo-1',
          localId: 'local-1',
          localName: 'Local Centro (Ejemplo)',
          count: 1,
          source: 'self',
          actorName: 'Autoservicio en cartel',
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        },
      ],
    },
    {
      id: 'member-ejemplo-2',
      accountId: 'acc-ejemplo-2',
      businessId: 'biz-ejemplo-1',
      localId: 'local-1',
      localCode: 'CAJA01',
      localName: 'Local Centro (Ejemplo)',
      name: 'Sofía Pereyra (Ejemplo)',
      contact: 's***@hotmail.com',
      maskedEmail: 's***@hotmail.com',
      birthDay: 22,
      birthMonth: 10,
      anonymous: false,
      marketingConsent: true,
      points: 10,
      stamps: 10,
      targetStamps: 10,
      rewardsRedeemed: 0,
      lastVisitAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      joinedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      consent: true,
      isSample: true,
      stampHistory: [
        {
          id: 'st-ej-3',
          memberId: 'member-ejemplo-2',
          localId: 'local-1',
          localName: 'Local Centro (Ejemplo)',
          count: 2,
          source: 'cashier',
          amountArs: 8500,
          actorName: 'Martín Gómez (Ejemplo)',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
      ],
    },
    {
      id: 'member-ejemplo-3',
      accountId: 'acc-anon-1',
      businessId: 'biz-ejemplo-1',
      localId: 'local-2',
      localCode: 'BELGRANO02',
      localName: 'Local Belgrano (Ejemplo)',
      name: 'Tarjeta sin datos #4821 (Ejemplo)',
      contact: 'Sin datos',
      maskedEmail: 'Sin datos',
      anonymous: true,
      marketingConsent: false,
      points: 3,
      stamps: 3,
      targetStamps: 10,
      rewardsRedeemed: 0,
      lastVisitAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      joinedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
      consent: true,
      isSample: true,
      stampHistory: [
        {
          id: 'st-ej-4',
          memberId: 'member-ejemplo-3',
          localId: 'local-2',
          localName: 'Local Belgrano (Ejemplo)',
          count: 1,
          source: 'self',
          actorName: 'Autoservicio en cartel',
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
      ],
    },
  ];

  // Mapa interno de emails reales para búsqueda por cajero (el comercio nunca ve el mail completo en la tabla)
  private memberRawEmails: Record<string, string> = {
    'member-ejemplo-1': 'diego@gmail.com',
    'member-ejemplo-2': 'sofia@hotmail.com',
  };

  // Toquecitos guardados por cuenta
  private toquecitos: ToquecitoItem[] = [
    {
      id: 'toq-ej-1',
      accountId: 'acc-ejemplo-1',
      businessId: 'biz-ejemplo-1',
      businessName: 'Café La Esquina (Ejemplo)',
      initial: 'C',
      brandColor: '#3A3FE0',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      isSample: true,
    },
    {
      id: 'toq-ej-2',
      accountId: 'acc-ejemplo-1',
      businessId: 'biz-ejemplo-1',
      businessName: 'Café La Esquina (Ejemplo)',
      initial: 'C',
      brandColor: '#3A3FE0',
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      isSample: true,
    },
  ];

  // Registro inalterable de correcciones (Solo lectura)
  private auditLogs: AuditLogEntry[] = [
    {
      id: 'aud-ej-1',
      businessId: 'biz-ejemplo-1',
      actionType: 'void_stamp',
      actionLabel: 'Anulación de sello',
      memberId: 'member-ejemplo-1',
      memberName: 'Diego Morales (Ejemplo)',
      delta: -1,
      reason: 'Se cargó dos veces por error al escanear en mostrador (Ejemplo).',
      actorName: 'Laura Méndez (Ejemplo)',
      actorRole: 'Encargado',
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      isSample: true,
    },
    {
      id: 'aud-ej-2',
      businessId: 'biz-ejemplo-1',
      actionType: 'adjust_balance',
      actionLabel: 'Ajuste manual de sellos',
      memberId: 'member-ejemplo-2',
      memberName: 'Sofía Pereyra (Ejemplo)',
      delta: 1,
      reason: 'Pasó ayer cuando estaba cortada la luz en el local (Ejemplo).',
      actorName: 'Martín Gómez (Ejemplo)',
      actorRole: 'Dueño',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      isSample: true,
    },
  ];

  // Plantillas de avisos y límites
  private notificationTemplates: NotificationTemplate[] = [
    {
      id: 'tpl-birthday',
      type: 'birthday',
      title: '¡Feliz cumpleaños de parte de Café La Esquina!',
      message: 'Hoy es tu día. Pasá por el local esta semana y tenés un café grande de regalo mostrando tu tarjeta.',
      active: true,
      scheduleInfo: 'Se envía el día del cumpleaños a las 10:00. El beneficio vale por 7 días.',
      benefitDaysValid: 7,
    },
    {
      id: 'tpl-nearby',
      type: 'nearby',
      title: 'Estás cerca de Café La Esquina',
      message: 'Mostrá tu tarjeta al pasar y sumá un sello para tu premio.',
      active: true,
      scheduleInfo: 'El celular muestra la tarjeta en la pantalla de bloqueo cerca del local (Toque no recibe la ubicación del cliente).',
    },
  ];

  private notificationLimits: NotificationLimits = {
    maxPerClientDays: 7,
    quietHoursStart: '21:00',
    quietHoursEnd: '09:00',
  };

  // Estado del asistente de configuración inicial
  private cartelPrinted = false;

  // Estado de la suscripción
  private planState: PlanState = {
    status: 'trial',
    planId: 'mensual',
    daysRemaining: 24,
    trialStartedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 24).toISOString(),
    isSimulated: true,
  };

  // Lista de espera (Waitlist)
  private waitlistEntries: WaitlistEntry[] = [
    {
      id: 'wl-ej-1',
      email: 'panaderia.sol@ejemplo.ar',
      product: 'estrellas',
      consent: true,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      unsubscribeToken: 'unsub-ej-1',
      isSample: true,
    },
    {
      id: 'wl-ej-2',
      email: 'helados.barrio@ejemplo.ar',
      product: 'recibo',
      consent: true,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      unsubscribeToken: 'unsub-ej-2',
      isSample: true,
    },
    {
      id: 'wl-ej-3',
      email: 'cliente.fiel@ejemplo.ar',
      product: 'toquecitos',
      consent: true,
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      unsubscribeToken: 'unsub-ej-3',
      isSample: true,
    },
  ];

  // Carteles
  private carteles: Cartel[] = [
    {
      id: 'cartel-caja-1',
      code: 'CAJA01',
      pin: '112233',
      businessId: 'biz-ejemplo-1',
      name: 'Local Centro (Ejemplo)',
      role: 'caja',
      status: 'active',
      reviewUrl: 'https://maps.google.com',
      mode: 'hub',
      createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
      activatedAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    },
    {
      id: 'cartel-belgrano-2',
      code: 'BELGRANO02',
      pin: '445566',
      businessId: 'biz-ejemplo-1',
      name: 'Local Belgrano (Ejemplo)',
      role: 'caja',
      status: 'active',
      reviewUrl: 'https://maps.google.com',
      mode: 'hub',
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      activatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
  ];

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
    accentColor: '#3A3FE0',
    socials: {
      instagram: 'laesquina.cafe',
      whatsapp: '+5491144558899',
    },
    products: [
      {
        id: 'prod-1',
        title: 'Café de especialidad + medialuna (Ejemplo)',
        price: 3800,
        description: 'Tostado natural con manteca artesanal',
      },
    ],
    details: {
      address: 'Av. Corrientes 1450, CABA',
      hours: 'Lunes a Sábado de 08:00 a 20:00',
    },
    showToqueFooter: true,
    planPaid: true,
  };

  private sales: Sale[] = [];
  private receipts: Receipt[] = [];
  private mpStatus: MercadoPagoStatus = {
    connected: true,
    collectorId: 'MP-EJEMPLO',
    connectedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  };
  private pinAttempts: Record<string, number> = {};
  private batches: CartelBatch[] = [];
  private reviewClicks = 0;

  // =========================================================================
  // 1. AUTENTICACIÓN SIN CONTRASEÑAS (CÓDIGO DE 6 DÍGITOS POR MAIL)
  // =========================================================================

  async requestOtp(
    email: string,
    purpose: OtpPurpose = 'login'
  ): Promise<{
    sent: boolean;
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

    // Generamos código de 6 dígitos que vence en 10 minutos (600 s) y se usa una sola vez
    const code = Math.floor(100000 + Math.random() * 900000).toString();
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
      expiresInSeconds: 600,
      resendAvailableInSeconds: 60,
      demoHintCode: code,
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
    if (!record) {
      throw new Error('Primero pedí un código para tu mail.');
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
        throw new Error('Código incorrecto. Superaste los 5 intentos permitidos. Pedí un código nuevo.');
      }
      throw new Error(`El código no coincide. Te quedan ${remaining} intento(s).`);
    }

    // Marcar como usado (un solo uso)
    record.used = true;

    // Si es flujo de cliente del Club
    if (record.purpose === 'register_client' || record.purpose === 'cashier_confirm') {
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
    if (record.purpose === 'register_merchant' || extra?.businessName) {
      const reg = await this.register({
        businessName: extra?.businessName || 'Mi Local',
        ownerName: extra?.ownerName || cleanEmail.split('@')[0],
        email: cleanEmail,
      });
      return { verified: true, user: reg.user };
    }

    // Buscar miembro del equipo en memoria
    const teamMember = this.teamMembers.find(
      (m) => m.email.toLowerCase() === cleanEmail && m.status === 'active'
    );

    if (teamMember) {
      const isSuperAdmin = cleanEmail === 'admin@toque.ar';
      const user: User = {
        id: `user-${teamMember.id}`,
        email: cleanEmail,
        name: teamMember.name,
        businessId: teamMember.businessId,
        role: isSuperAdmin ? 'superadmin' : teamMember.role,
        assignedCartelId: teamMember.assignedCartelId,
        assignedCartelCode: teamMember.assignedCartelCode,
        assignedLocalIds: teamMember.assignedLocalIds,
        isSuperAdmin,
      };
      this.currentUser = user;
      return { verified: true, user };
    }

    // Si ingresa un mail nuevo en la demo, le creamos sesión como dueño de su local en memoria
    const newUser: User = {
      id: `user-${Date.now().toString(36)}`,
      email: cleanEmail,
      name: cleanEmail.split('@')[0],
      businessId: this.businessProfile.id,
      role: 'owner',
      assignedLocalIds: this.locals.map((l) => l.id),
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
    const bizId = `biz-${Date.now().toString(36)}`;
    const user: User = {
      id: `user-${Date.now().toString(36)}`,
      email: cleanEmail,
      name: data.ownerName.trim(),
      businessId: bizId,
      role: 'owner',
      assignedLocalIds: ['local-1'],
    };

    this.currentUser = user;
    this.businessProfile = {
      id: bizId,
      name: data.businessName.trim(),
      ownerName: data.ownerName.trim(),
      email: cleanEmail,
      createdAt: new Date().toISOString(),
    };
    this.clubConfig.name = `Club ${data.businessName.trim()}`;
    this.clubConfig.clubName = `Club ${data.businessName.trim()}`;

    return { user, token: 'cookie-session-simulada' };
  }

  async login(credentials: {
    email: string;
    code?: string;
  }): Promise<{ user: User; token: string }> {
    const cleanEmail = credentials.email.trim().toLowerCase();
    if (credentials.code) {
      const res = await this.verifyOtp(cleanEmail, credentials.code);
      if (res.user) {
        return { user: res.user, token: 'cookie-session-simulada' };
      }
    }

    const teamMember = this.teamMembers.find(
      (m) => m.email.toLowerCase() === cleanEmail && m.status === 'active'
    );
    const isSuperAdmin = cleanEmail === 'admin@toque.ar';
    const user: User = {
      id: teamMember ? `user-${teamMember.id}` : `user-${Date.now().toString(36)}`,
      email: cleanEmail,
      name: teamMember ? teamMember.name : cleanEmail.split('@')[0],
      businessId: this.businessProfile.id,
      role: isSuperAdmin ? 'superadmin' : teamMember ? teamMember.role : 'owner',
      assignedCartelId: teamMember?.assignedCartelId,
      assignedCartelCode: teamMember?.assignedCartelCode,
      assignedLocalIds: teamMember?.assignedLocalIds || this.locals.map((l) => l.id),
      isSuperAdmin,
    };
    this.currentUser = user;
    return { user, token: 'cookie-session-simulada' };
  }

  async logout(): Promise<void> {
    this.currentUser = null;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  // =========================================================================
  // 2. ALTA PÚBLICA DEL CLIENTE (/club/:codigoLocal) Y RECONOCIMIENTO
  // =========================================================================

  async getClubPublic(localCode: string): Promise<ClubPublicInfo> {
    const cleanCode = (localCode || 'CAJA01').trim().toUpperCase();

    if (this.externalPublicClubs[cleanCode]) {
      return { ...this.externalPublicClubs[cleanCode] };
    }

    const local =
      this.locals.find((l) => l.code.toUpperCase() === cleanCode) || this.locals[0];

    return {
      businessId: this.businessProfile.id,
      businessName: this.businessProfile.name,
      localId: local.id,
      localCode: local.code,
      localName: local.name,
      localAddress: local.address,
      programName: this.clubConfig.name || this.businessProfile.name,
      brandColor: this.clubConfig.brandColor || '#3A3FE0',
      logoUrl: this.clubConfig.logoUrl,
      targetStamps: this.clubConfig.targetStamps || 10,
      rewardText:
        this.clubConfig.rewardText ||
        this.clubConfig.rewards[0]?.label ||
        'Premio en tu local',
      mode: this.clubConfig.mode || 'per_visit',
      amountPerStamp: this.clubConfig.amountPerStamp || 4000,
      maxStampsPerVisit: this.clubConfig.maxStampsPerVisit || 3,
      allowSelfScan: this.clubConfig.allowSelfScan ?? true,
      allowCashierScan: this.clubConfig.allowCashierScan ?? true,
      isSample: true,
    };
  }

  async registerMember(data: {
    localCode?: string;
    name: string;
    email: string;
    birthDay?: number;
    birthMonth?: number;
    adult: boolean;
    marketingConsent: boolean;
  }): Promise<{
    member: ClubMember;
    account: RecognizedClientAccount;
    requiresOtp: boolean;
  }> {
    if (!data.adult) {
      throw new Error(
        'Para crear tu tarjeta con datos hace falta ser mayor de 18. Podés usarla sin datos.'
      );
    }

    const cleanName = (data.name || '').trim();
    const cleanEmail = (data.email || '').trim().toLowerCase();

    if (!cleanName) {
      throw new Error('Escribí tu nombre (como te conocen).');
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Escribí un correo electrónico válido.');
    }

    const pub = await this.getClubPublic(data.localCode || 'CAJA01');
    const masked = maskEmailAddress(cleanEmail);
    const accountId = this.recognizedClient?.accountId || `acc-${Date.now().toString(36)}`;

    this.recognizedClient = {
      accountId,
      name: cleanName,
      email: cleanEmail,
      birthDay: data.birthDay,
      birthMonth: data.birthMonth,
    };

    let existing = this.clubMembers.find(
      (m) =>
        this.memberRawEmails[m.id] === cleanEmail &&
        m.businessId === pub.businessId
    );

    if (!existing) {
      const newId = `member-${Date.now().toString(36)}`;
      existing = {
        id: newId,
        accountId,
        businessId: pub.businessId,
        localId: pub.localId,
        localCode: pub.localCode,
        localName: pub.localName,
        name: cleanName,
        contact: masked,
        maskedEmail: masked,
        birthDay: data.birthDay,
        birthMonth: data.birthMonth,
        anonymous: false,
        marketingConsent: Boolean(data.marketingConsent),
        points: 0,
        stamps: 0,
        targetStamps: pub.targetStamps,
        rewardsRedeemed: 0,
        joinedAt: new Date().toISOString(),
        consent: true,
        stampHistory: [],
      };
      this.memberRawEmails[newId] = cleanEmail;
      this.clubMembers.unshift(existing);

      const localObj = this.locals.find((l) => l.id === pub.localId);
      if (localObj) {
        localObj.newMembersCount += 1;
      }
    }

    const account = await this.recognizeAccount(cleanEmail);
    return {
      member: existing,
      account,
      requiresOtp: true,
    };
  }

  async createAnonymousCard(localCode: string): Promise<{ member: ClubMember }> {
    const pub = await this.getClubPublic(localCode || 'CAJA01');
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const member: ClubMember = {
      id: `anon-${Date.now().toString(36)}-${randomCode}`,
      accountId: `acc-anon-${randomCode}`,
      businessId: pub.businessId,
      localId: pub.localId,
      localCode: pub.localCode,
      localName: pub.localName,
      name: `Tarjeta sin datos #${randomCode}`,
      contact: 'Sin datos',
      maskedEmail: 'Sin datos',
      anonymous: true,
      marketingConsent: false,
      points: 0,
      stamps: 0,
      targetStamps: pub.targetStamps,
      rewardsRedeemed: 0,
      joinedAt: new Date().toISOString(),
      consent: true,
      stampHistory: [],
    };

    this.clubMembers.unshift(member);
    return { member };
  }

  async recognizeAccount(email?: string): Promise<RecognizedClientAccount> {
    const targetEmail = (email || this.recognizedClient?.email || '').trim().toLowerCase();
    if (!targetEmail) {
      return { recognized: false };
    }

    const matchingIds = Object.entries(this.memberRawEmails)
      .filter(([, raw]) => raw.toLowerCase() === targetEmail)
      .map(([id]) => id);

    const cards = this.clubMembers.filter((m) => matchingIds.includes(m.id));
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
    if (!this.recognizedClient) {
      throw new Error('Primero ingresá con tu mail para reconocer tu cuenta.');
    }

    const pub = await this.getClubPublic(data.localCode);
    const cleanEmail = this.recognizedClient.email;
    const masked = maskEmailAddress(cleanEmail);

    let existing = this.clubMembers.find(
      (m) =>
        this.memberRawEmails[m.id] === cleanEmail &&
        m.businessId === pub.businessId
    );

    if (!existing) {
      const newId = `member-${Date.now().toString(36)}`;
      existing = {
        id: newId,
        accountId: this.recognizedClient.accountId,
        businessId: pub.businessId,
        localId: pub.localId,
        localCode: pub.localCode,
        localName: pub.localName,
        name: this.recognizedClient.name,
        contact: masked,
        maskedEmail: masked,
        birthDay: this.recognizedClient.birthDay,
        birthMonth: this.recognizedClient.birthMonth,
        anonymous: false,
        marketingConsent: Boolean(data.marketingConsent),
        points: 0,
        stamps: 0,
        targetStamps: pub.targetStamps,
        rewardsRedeemed: 0,
        joinedAt: new Date().toISOString(),
        consent: true,
        stampHistory: [],
      };
      this.memberRawEmails[newId] = cleanEmail;
      this.clubMembers.unshift(existing);
    }

    const account = await this.recognizeAccount(cleanEmail);
    return { member: existing, account };
  }

  // =========================================================================
  // 3. SUMAR SELLOS, TOQUECITOS Y CANJEO DE PREMIOS
  // =========================================================================

  async addStampByCashier(data: {
    memberId?: string;
    email?: string;
    amount?: number;
    localId?: string;
    otpCode?: string;
  }): Promise<{
    member: ClubMember;
    stampsAdded: number;
    rewardReady: boolean;
    toquecito: ToquecitoItem;
  }> {
    let member: ClubMember | undefined;

    if (data.memberId) {
      member = this.clubMembers.find((m) => m.id === data.memberId);
    } else if (data.email) {
      const cleanEmail = data.email.trim().toLowerCase();
      const foundId = Object.entries(this.memberRawEmails).find(
        ([, raw]) => raw.toLowerCase() === cleanEmail
      )?.[0];
      if (foundId) {
        member = this.clubMembers.find((m) => m.id === foundId);
      }
    }

    if (!member) {
      throw new Error('No encontramos una tarjeta para ese cliente. Revisá el código o el mail.');
    }

    if (data.otpCode) {
      const rawEmail = this.memberRawEmails[member.id];
      if (rawEmail) {
        await this.verifyOtp(rawEmail, data.otpCode);
      }
    }

    const local =
      this.locals.find((l) => l.id === data.localId) || this.locals[0];

    let stampsToAdd = 1;
    if (this.clubConfig.mode === 'per_amount' && data.amount !== undefined) {
      const unit = Math.max(1, this.clubConfig.amountPerStamp || 4000);
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
    member.stampHistory = [stampEntry, ...(member.stampHistory || [])];

    local.visitsCount += 1;
    local.returningCount += 1;

    const toquecito: ToquecitoItem = {
      id: `toq-${Date.now().toString(36)}`,
      accountId: member.accountId || member.id,
      businessId: this.businessProfile.id,
      businessName: this.businessProfile.name,
      initial: this.businessProfile.name.charAt(0).toUpperCase(),
      brandColor: this.clubConfig.brandColor || '#3A3FE0',
      createdAt: nowIso,
    };
    this.toquecitos.unshift(toquecito);

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
    toquecito: ToquecitoItem;
  }> {
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

    const todayKey = new Date().toISOString().slice(0, 10);
    const visitKey = `${member.id}_${pub.localCode.toUpperCase()}_${todayKey}`;

    if (this.selfStampDailyLog.has(visitKey)) {
      throw new Error(
        'Ya sumaste tu sello de hoy en este local. Se permite 1 visita por día en autoservicio.'
      );
    }

    this.selfStampDailyLog.add(visitKey);
    const nowIso = new Date().toISOString();

    const stampEntry = {
      id: `st-self-${Date.now().toString(36)}`,
      memberId: member.id,
      localId: pub.localId,
      localName: pub.localName,
      count: 1,
      source: 'self' as const,
      actorName: 'Autoservicio en cartel',
      createdAt: nowIso,
    };

    member.stamps = (member.stamps || 0) + 1;
    member.points = member.stamps;
    member.lastVisitAt = nowIso;
    member.stampHistory = [stampEntry, ...(member.stampHistory || [])];

    const localObj = this.locals.find((l) => l.id === pub.localId);
    if (localObj) {
      localObj.visitsCount += 1;
    }

    const toquecito: ToquecitoItem = {
      id: `toq-${Date.now().toString(36)}`,
      accountId: member.accountId || member.id,
      businessId: pub.businessId,
      businessName: pub.businessName,
      initial: pub.businessName.charAt(0).toUpperCase(),
      brandColor: pub.brandColor || '#3A3FE0',
      createdAt: nowIso,
    };
    this.toquecitos.unshift(toquecito);

    const target = member.targetStamps || pub.targetStamps || 10;
    return {
      member: { ...member },
      stampsAdded: 1,
      rewardReady: member.stamps >= target,
      toquecito,
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
    const member = this.clubMembers.find((m) => m.id === memberId);
    if (!member) {
      throw new Error('Cliente no encontrado.');
    }

    const target = member.targetStamps || this.clubConfig.targetStamps || 10;
    if (member.stamps < target) {
      throw new Error(`Al cliente todavía le faltan ${target - member.stamps} sello(s) para el premio.`);
    }

    member.stamps = Math.max(0, member.stamps - target);
    member.points = member.stamps;
    member.rewardsRedeemed = (member.rewardsRedeemed || 0) + 1;

    const local = this.locals.find((l) => l.id === member.localId) || this.locals[0];
    if (local) {
      local.rewardsRedeemedCount += 1;
    }

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

  // =========================================================================
  // 4. REGISTRO DE CORRECCIONES (SOLO LECTURA, MOTIVO >= 10 CARACTERES)
  // =========================================================================

  private assertCanModifyAudit(reason: string): void {
    if (this.currentUser?.role === 'cashier') {
      throw new Error('Solo el dueño o encargado pueden anular o ajustar sellos. El cajero solo suma.');
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
        m.id === data.memberId ||
        m.stampHistory?.some((s) => s.id === data.stampId)
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

    const actorRole =
      this.currentUser?.role === 'manager' ? 'Encargado' : 'Dueño';

    const auditEntry: AuditLogEntry = {
      id: `aud-${Date.now().toString(36)}`,
      businessId: this.businessProfile.id,
      actionType: 'void_stamp',
      actionLabel: 'Anulación de sello',
      memberId: member.id,
      memberName: member.name || member.contact,
      delta: -countToSubtract,
      reason: data.reason.trim(),
      actorName: this.currentUser?.name || 'Martín Gómez (Ejemplo)',
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

    const actorRole =
      this.currentUser?.role === 'manager' ? 'Encargado' : 'Dueño';

    const auditEntry: AuditLogEntry = {
      id: `aud-${Date.now().toString(36)}`,
      businessId: this.businessProfile.id,
      actionType: data.delta < 0 ? 'void_reward' : 'adjust_balance',
      actionLabel: data.delta < 0 ? 'Descuento / Anulación manual' : 'Ajuste manual de sellos',
      memberId: member.id,
      memberName: member.name || member.contact,
      delta: data.delta,
      reason: data.reason.trim(),
      actorName: this.currentUser?.name || 'Martín Gómez (Ejemplo)',
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
    let list = [...this.clubMembers];
    if (filters?.localId && filters.localId !== 'all') {
      list = list.filter((m) => m.localId === filters.localId);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.maskedEmail || m.contact || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  async listClubMembers(): Promise<ClubMember[]> {
    return this.listMembers();
  }

  async exportClubMembersCsv(): Promise<string> {
    const header = 'ID,Nombre,Correo Parcial,Cumpleanos,Sellos,Premios Canjeados,Local,Fecha Alta\n';
    const rows = this.clubMembers
      .map((m) => {
        const bday =
          m.birthDay && m.birthMonth ? `${m.birthDay}/${m.birthMonth}` : 'Sin informar';
        return `"${m.id}","${m.name || 'Sin datos'}","${m.maskedEmail || m.contact}","${bday}",${m.stamps || 0},${m.rewardsRedeemed || 0},"${m.localName || 'Local Centro'}","${m.joinedAt}"`;
      })
      .join('\n');
    return header + rows;
  }

  async deleteClubMember(id: string): Promise<void> {
    this.clubMembers = this.clubMembers.filter((m) => m.id !== id);
  }

  async getClubConfig(): Promise<ClubConfig> {
    return { ...this.clubConfig };
  }

  async updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig> {
    this.clubConfig = {
      ...this.clubConfig,
      ...patch,
      name: patch.name || patch.clubName || this.clubConfig.name,
      clubName: patch.clubName || patch.name || this.clubConfig.clubName,
      rule: {
        type: patch.mode || patch.rule?.type || this.clubConfig.mode || 'per_visit',
        value: patch.amountPerStamp || patch.rule?.value || 1,
      },
    };
    if (patch.rewardText || patch.targetStamps) {
      this.clubConfig.rewards = [
        {
          id: 'rew-1',
          label: patch.rewardText || this.clubConfig.rewardText || 'Premio',
          target: patch.targetStamps || this.clubConfig.targetStamps || 10,
        },
      ];
    }
    return { ...this.clubConfig };
  }

  async listLocals(): Promise<ClubLocal[]> {
    return [...this.locals];
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
    const code = `${cleanName
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase() || 'LOCAL'}${this.locals.length + 1}`;

    const newLocal: ClubLocal = {
      id: `local-${Date.now().toString(36)}`,
      businessId: this.businessProfile.id,
      code,
      name: cleanName,
      address: data.address.trim() || 'Dirección sin especificar',
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
    const subscribedClientsCount = this.clubMembers.filter(
      (m) => m.marketingConsent && !m.anonymous
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
    const step3Local = this.locals.length > 0;
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
    return { ...this.planState };
  }

  async startTrial(planId: 'mensual' | 'anual' = 'mensual'): Promise<PlanState> {
    this.planState = {
      status: 'active',
      planId,
      daysRemaining: TRIAL_DAYS,
      trialStartedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
      isSimulated: true,
    };
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
    // Campo oculto anti-robots
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

    // Mismo mail y misma función no se duplica
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
  // 7. MÉTODOS EXISTENTES DE CARTELES, CAJA, EQUIPO Y RESUMEN
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
    const cartel =
      this.carteles.find((c) => c.code.toUpperCase() === cleanCode) || this.carteles[0];
    cartel.status = 'active';
    cartel.name = data.cartelName || data.name || cartel.name;
    cartel.activatedAt = new Date().toISOString();
    return { success: true, cartel };
  }

  async listCarteles(): Promise<Cartel[]> {
    return [...this.carteles];
  }

  async createCartelForBusiness(data: {
    name: string;
    code?: string;
    role: CartelRole;
    mode?: HubMode;
    reviewUrl?: string;
  }): Promise<Cartel> {
    const code = (data.code || `CARTEL${this.carteles.length + 1}`).toUpperCase();
    const created: Cartel = {
      id: `cartel-${Date.now().toString(36)}`,
      code,
      pin: '112233',
      businessId: this.businessProfile.id,
      name: data.name.trim(),
      role: data.role,
      status: 'active',
      reviewUrl: data.reviewUrl || 'https://maps.google.com',
      mode: data.mode || 'hub',
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
    return this.carteles[idx];
  }

  async getHubConfig(): Promise<HubConfig> {
    return { ...this.hubConfig };
  }

  async updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig> {
    this.hubConfig = { ...this.hubConfig, ...patch };
    return { ...this.hubConfig };
  }

  async getPublicHub(code: string): Promise<PublicHub> {
    const cleanCode = code.trim().toUpperCase();
    const cartel =
      this.carteles.find((c) => c.code.toUpperCase() === cleanCode) || this.carteles[0];
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
      reviewUrl: cartel.reviewUrl || 'https://maps.google.com',
      blocks: this.hubConfig.blocks,
      receipt: null,
      club: {
        config: this.clubConfig,
        member: null,
      },
      config: this.hubConfig,
    };
  }

  subscribeToCartelHub(code: string, onUpdate: (hub: PublicHub) => void): () => void {
    this.getPublicHub(code).then(onUpdate).catch(() => {});
    return () => {};
  }

  async getReceiptById(receiptId: string): Promise<Receipt | null> {
    return this.receipts.find((r) => r.id === receiptId) || null;
  }

  subscribeToReceipt(
    receiptId: string,
    onUpdate: (receipt: Receipt | null) => void
  ): () => void {
    this.getReceiptById(receiptId).then(onUpdate).catch(() => {});
    return () => {};
  }

  async claimReceipt(id: string): Promise<{ success: boolean; receipt: Receipt }> {
    const receipt = this.receipts.find((r) => r.id === id);
    if (!receipt) throw new Error('El comprobante no está disponible.');
    receipt.status = 'claimed';
    receipt.claimedAt = new Date().toISOString();
    return { success: true, receipt };
  }

  async recordHubEvent(_code: string, eventType: 'scan' | 'review_click'): Promise<void> {
    if (eventType === 'review_click') this.reviewClicks += 1;
  }

  async joinClub(data: {
    cartelCode: string;
    contact: string;
    name?: string;
    consent: boolean;
  }): Promise<{ member: ClubMember; pointsAwarded: number; walletPass?: WalletPassResponse }> {
    const res = await this.registerMember({
      localCode: data.cartelCode,
      name: data.name || 'Cliente',
      email: data.contact,
      adult: true,
      marketingConsent: data.consent,
    });
    return { member: res.member, pointsAwarded: 1 };
  }

  async getWalletStatus(): Promise<{ configured: boolean; provider: string }> {
    return { configured: false, provider: 'billetera-celular' };
  }

  async createWalletPass(data: {
    cartelCode?: string;
    memberId?: string;
    customerName?: string;
    customerContact?: string;
    contact?: string;
    stamps?: number;
    points?: number;
  }): Promise<WalletPassResponse> {
    return {
      success: true,
      provider: 'billetera-celular',
      passId: `pass-${data.memberId || Date.now()}`,
      validationCode: 'DEMO',
      appleWalletUrl: '#',
      googleWalletUrl: '#',
    };
  }

  async createSale(data: {
    cartelId: string;
    amount: number;
    items?: SaleItem[];
    method: PaymentMethod;
  }): Promise<{ sale: Sale; qrData?: string; receipt?: Receipt }> {
    const cartel = this.carteles.find((c) => c.id === data.cartelId) || this.carteles[0];
    const sale: Sale = {
      id: `sale-${Date.now()}`,
      businessId: this.businessProfile.id,
      cartelId: cartel.id,
      cartelName: cartel.name,
      amount: data.amount,
      currency: 'ARS',
      items: data.items || [],
      method: data.method,
      status: 'paid',
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
      cashierName: this.currentUser?.name || 'Cajero',
    };
    this.sales.unshift(sale);
    return { sale };
  }

  async getSale(id: string): Promise<Sale> {
    const sale = this.sales.find((s) => s.id === id);
    if (!sale) throw new Error('Operación no encontrada.');
    return sale;
  }

  async confirmManualSale(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    const sale = await this.getSale(id);
    const receipt: Receipt = {
      id: `rcp-${Date.now()}`,
      saleId: sale.id,
      businessId: sale.businessId,
      cartelCode: 'CAJA01',
      status: 'ready',
      expiresAt: new Date(Date.now() + 120000).toISOString(),
      businessName: this.businessProfile.name,
      items: sale.items,
      total: sale.amount,
      currency: 'ARS',
      method: sale.method,
      createdAt: new Date().toISOString(),
    };
    return { sale, receipt };
  }

  async simulatePaymentApproved(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    return this.confirmManualSale(id);
  }

  async cancelSale(id: string): Promise<Sale> {
    const sale = await this.getSale(id);
    sale.status = 'cancelled';
    return sale;
  }

  async listSales(): Promise<Sale[]> {
    return [...this.sales];
  }

  subscribeToBusinessSales(onUpdate: (sales: Sale[]) => void): () => void {
    onUpdate([...this.sales]);
    return () => {};
  }

  async listTeamMembers(): Promise<TeamMember[]> {
    return [...this.teamMembers];
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
    const cleanEmail =
      (data.email || '').trim().toLowerCase() ||
      `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@ejemplo.ar`;

    const created: TeamMember = {
      id: `team-${Date.now().toString(36)}`,
      businessId: this.businessProfile.id,
      name: cleanName,
      email: cleanEmail,
      role: data.role,
      assignedCartelId: data.assignedCartelId || 'cartel-caja-1',
      assignedLocalIds: data.assignedLocalIds || this.locals.map((l) => l.id),
      status: 'active',
      addedAt: new Date().toISOString(),
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
    return [];
  }

  async getPublicCrossBenefits(): Promise<NetworkActivation[]> {
    return [];
  }

  async saveNetworkActivation(data: {
    formatType: NetworkActivationFormat;
    title: string;
    discountText: string;
    terms: string;
    active: boolean;
  }): Promise<NetworkActivation> {
    return {
      id: `net-${Date.now()}`,
      tenantId: this.businessProfile.id,
      merchantName: this.businessProfile.name,
      ...data,
    };
  }

  async toggleNetworkActivation(
    formatType: NetworkActivationFormat,
    active: boolean
  ): Promise<NetworkActivation> {
    return {
      id: `net-${formatType}`,
      tenantId: this.businessProfile.id,
      merchantName: this.businessProfile.name,
      formatType,
      title: 'Beneficio',
      discountText: '10%',
      terms: '',
      active,
    };
  }

  async syncConsumerVault(payload: {
    user: ConsumerUser;
    receipts: ConsumerReceipt[];
  }) {
    return {
      success: true,
      consumerId: payload.user.id,
      recoveryCode: 'DEMO',
      user: payload.user,
      receipts: payload.receipts,
    };
  }

  async recoverConsumerVault(): Promise<{
    found: boolean;
    user?: ConsumerUser;
    receipts?: ConsumerReceipt[];
  }> {
    return { found: false };
  }

  async getMercadoPagoStatus(): Promise<MercadoPagoStatus> {
    return { ...this.mpStatus };
  }

  async connectMercadoPago(): Promise<{ connected: boolean }> {
    this.mpStatus.connected = true;
    return { connected: true };
  }

  async disconnectMercadoPago(): Promise<{ connected: boolean }> {
    this.mpStatus.connected = false;
    return { connected: false };
  }

  async getDashboardSummary(period: '30d' | '3m' | '12m' | 'all' = '30d'): Promise<DashboardSummary> {
    const multiplier =
      period === '30d' ? 1 : period === '3m' ? 2.6 : period === '12m' ? 8.5 : 10;

    const baseVisits = this.locals.reduce((acc, l) => acc + l.visitsCount, 0);
    const baseNew = this.locals.reduce((acc, l) => acc + l.newMembersCount, 0);
    const baseReturning = this.locals.reduce((acc, l) => acc + l.returningCount, 0);
    const baseRedeemed = this.locals.reduce((acc, l) => acc + l.rewardsRedeemedCount, 0);

    return {
      todaySalesAmount: 0,
      todaySalesCount: Math.round(baseVisits * 0.2),
      weeklySalesAmount: 0,
      weeklySalesCount: baseVisits,
      myTodaySalesCount: 4,
      myWeeklySalesCount: 18,
      todayClaimedReceiptsCount: 0,
      myClaimedReceiptsCount: 0,
      totalReceiptsCount: 0,
      claimedReceiptsCount: 0,
      newClubMembersCount: Math.round(baseNew * multiplier),
      clubMembersCount: this.clubMembers.length,
      walletPassesCount: this.clubMembers.length,
      scansCount: Math.round(baseVisits * multiplier),
      reviewButtonClicks: this.reviewClicks,
      teamMembersCount: this.teamMembers.length,
      activeCartelesCount: this.carteles.filter((c) => c.status === 'active').length,
      totalCartelesCount: this.carteles.length,
      recentSales: this.sales.slice(0, 20),
      visitsCount: Math.round(baseVisits * multiplier),
      returningMembersCount: Math.round(baseReturning * multiplier),
      rewardsRedeemedCount: Math.round(baseRedeemed * multiplier),
    };
  }

  async getBusinessProfile(): Promise<BusinessProfile> {
    return { ...this.businessProfile };
  }

  async updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile> {
    this.businessProfile = { ...this.businessProfile, ...patch };
    return { ...this.businessProfile };
  }

  async getSuperAdminSummary(): Promise<SuperAdminSummary> {
    return {
      totalBusinesses: 1,
      totalCarteles: this.carteles.length,
      activeCarteles: this.carteles.length,
      totalSalesCount: this.sales.length,
      totalSalesAmount: 0,
      totalReceiptsEmitted: 0,
      claimedReceiptsCount: 0,
      totalClubMembers: this.clubMembers.length,
      walletPassesIssued: this.clubMembers.length,
      totalScansCount: 61,
      totalReviewClicks: this.reviewClicks,
      businesses: [
        {
          ...this.businessProfile,
          cartelesCount: this.carteles.length,
          salesCount: this.sales.length,
          salesAmount: 0,
          membersCount: this.clubMembers.length,
          teamCount: this.teamMembers.length,
        },
      ],
      carteles: this.carteles,
      recentSales: this.sales,
    };
  }
}

export const mockApi = new MockApi();
