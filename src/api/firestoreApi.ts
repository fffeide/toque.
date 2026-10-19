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
  onSnapshot,
  increment,
} from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { db, auth, googleProvider } from '../lib/firebase';
import { generateUUID } from '../lib/uuid';
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
  UserRole,
  NetworkActivation,
  NetworkActivationFormat,
  ConsumerUser,
  ConsumerReceipt,
} from './types';

const SESSION_STORAGE_KEY = 'toque_rls_session_v2';

const DEFAULT_HUB_CONFIG: HubConfig = {
  mode: 'hub',
  blocks: [
    { key: 'receipt', enabled: true },
    { key: 'review', enabled: true },
    { key: 'club', enabled: true },
    { key: 'socials', enabled: true },
    { key: 'products', enabled: true },
    { key: 'details', enabled: true },
  ],
  accentColor: '#bec8ff',
  googleReviewUrl: 'https://maps.google.com',
  socials: {
    instagram: 'https://instagram.com/laesquina.cafe',
    tiktok: 'https://tiktok.com/@laesquina.cafe',
    whatsapp: '+54 9 11 4455-8899',
  },
  products: [
    {
      id: 'prod-1',
      title: 'Café de Especialidad + Medialuna',
      price: 3800,
      universalCode: '7790001',
      featuredInHub: true,
      description: 'Tostado natural con manteca artesanal',
    },
    {
      id: 'prod-2',
      title: 'Tostado de Campo Jamón y Queso',
      price: 5200,
      universalCode: '7790002',
      featuredInHub: true,
      description: 'Pan de masa madre horneado en el día',
    },
    {
      id: 'prod-3',
      title: 'Flat White Doble (Sin código)',
      price: 3400,
      featuredInHub: true,
      description: 'Doble ristretto de especialidad con leche texturizada',
    },
    {
      id: 'prod-4',
      title: 'Avocado Toast con Huevo Mollet',
      price: 6900,
      featuredInHub: true,
      description: 'Pan de masa madre, palta fresca, semillas y aceite de oliva',
    },
    {
      id: 'prod-5',
      title: 'Croissant Relleno de Almendras',
      price: 4100,
      featuredInHub: false,
      description: 'Hojaldre francés horneado en el día con crema de almendras',
    },
    {
      id: 'prod-6',
      title: 'Limonada con Menta y Jengibre (500ml)',
      price: 3600,
      featuredInHub: false,
      description: 'Exprimida en el momento, endulzada con almíbar orgánico',
    },
    {
      id: 'prod-7',
      title: 'Cheesecake de Frutos Rojos',
      price: 5900,
      featuredInHub: false,
      description: 'Porción individual con reducción casera de frutos de estación',
    },
    {
      id: 'prod-8',
      title: 'Menú Ejecutivo Mediodía + Bebida',
      price: 11500,
      featuredInHub: false,
      description: 'Plato principal del día + bebida sin alcohol + café',
    },
  ],
  details: {
    address: 'Av. Corrientes 1450, CABA',
    hours: 'Lunes a Sábado de 07:30 a 20:00 h',
    phone: '+54 11 4371-2233',
  },
  showToqueFooter: true,
  planPaid: false,
  networkEnabled: false,
};

const DEFAULT_CLUB_CONFIG: ClubConfig = {
  name: 'Club de Beneficios',
  clubName: 'Club de Beneficios',
  welcomeBenefitText: 'Café a elección de regalo',
  pointsPerVisit: 1,
  enabled: true,
  rule: {
    type: 'per_visit',
    value: 1,
  },
  rewards: [
    { id: 'rew-1', label: 'Café a elección de regalo', target: 5 },
    { id: 'rew-2', label: 'Desayuno completo para dos', target: 10 },
  ],
  active: true,
};

const NEIGHBOR_CROSS_BENEFITS_FALLBACK: NetworkActivation[] = [
  {
    id: 'act-neighbor-burger',
    uuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    tenantId: 'biz-neighbor-1',
    businessId: 'biz-neighbor-1',
    merchantName: 'Smash Burger Club',
    merchantCategory: 'Gastronomía · A 150 m',
    distanceLabel: 'A 150 m',
    formatType: 'cross_benefit',
    title: '2x1 en Papas Cheddar + Bebida',
    discountText: '20% OFF o 2x1 mostrando tu Toque',
    terms: 'Válido todos los días presentando tu comprobante de la Red Toque en mostrador.',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'act-neighbor-gelato',
    uuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    tenantId: 'biz-neighbor-2',
    businessId: 'biz-neighbor-2',
    merchantName: 'Heladería Artesanal Lucciano',
    merchantCategory: 'Postres y Café · A 220 m',
    distanceLabel: 'A 220 m',
    formatType: 'cross_benefit',
    title: '1/4 Kg de Helado con 25% OFF',
    discountText: '25% OFF con tu Billetera Toque',
    terms: 'Acumulable con desafíos semanales de Toque. Sin mínimo de compra.',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'act-neighbor-libreria',
    uuid: 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
    tenantId: 'biz-neighbor-3',
    businessId: 'biz-neighbor-3',
    merchantName: 'Librería & Vinilos El Solar',
    merchantCategory: 'Cultura y Regalos · A 300 m',
    distanceLabel: 'A 300 m',
    formatType: 'cross_benefit',
    title: '$3.500 de regalo en libros seleccionados',
    discountText: '$3.500 OFF en tu primera visita',
    terms: 'Presentando cualquier ticket digital guardado en Mi Toque.',
    active: true,
    createdAt: new Date().toISOString(),
  },
];

function sanitizeString(val: string | undefined, maxLen = 200): string {
  if (!val) return '';
  return val.trim().slice(0, maxLen);
}

/**
 * Elimina recursivamente propiedades con valor `undefined` para evitar que Firestore falle en setDoc/updateDoc.
 */
function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = stripUndefined(value);
    }
  }
  return result as T;
}

class FirestoreToqueApi implements ToqueApi {
  private currentUser: User | null = null;
  private initPromise: Promise<void> | null = null;
  private pinAttempts: Record<string, number> = {};

  constructor() {
    this.loadSavedSession();
  }

  private loadSavedSession() {
    try {
      const raw =
        typeof window !== 'undefined' ? window.localStorage.getItem(SESSION_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.id &&
          parsed.id !== 'user-owner-default' &&
          parsed.email
        ) {
          if (!parsed.uuid) parsed.uuid = generateUUID();
          this.currentUser = parsed;
        } else {
          this.currentUser = null;
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
      } else {
        this.currentUser = null;
      }
    } catch {
      this.currentUser = null;
    }
  }

  private saveSession(user: User | null) {
    if (user && !user.uuid) {
      user.uuid = generateUUID();
    }
    this.currentUser = user;
    try {
      if (typeof window !== 'undefined') {
        if (user) {
          window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
        } else {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  /**
   * Verificación de permisos por nivel (Dueño = owner, Encargado = manager, Cajero = cashier)
   */
  private assertRoleAccess(allowedRoles: UserRole[]) {
    if (!this.currentUser) {
      throw new Error('Debés iniciar sesión para acceder a esta sección.');
    }
    if (this.currentUser.isSuperAdmin || this.currentUser.role === 'superadmin') {
      return;
    }
    if (!allowedRoles.includes(this.currentUser.role)) {
      throw new Error('Tu nivel de acceso no tiene permisos para realizar esta acción.');
    }
  }

  /**
   * Aislamiento por organización (Multi-Tenant)
   */
  private assertOrganizationScope(targetBusinessId: string | undefined) {
    if (!this.currentUser) {
      throw new Error('Debés iniciar sesión para acceder a los datos de tu local.');
    }
    if (this.currentUser.isSuperAdmin || this.currentUser.role === 'superadmin') {
      return;
    }
    if (targetBusinessId && targetBusinessId !== this.getActiveBusinessId()) {
      throw new Error('No tenés permisos para acceder a otro comercio.');
    }
  }

  private async ensureBaseDataInitialized(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        const defaultBizRef = doc(db, 'businesses', 'biz-toque-1');
        const bizSnap = await getDoc(defaultBizRef);
        if (bizSnap.exists()) {
          return;
        }

        const nowIso = new Date().toISOString();
        await Promise.all([
          setDoc(
            defaultBizRef,
            stripUndefined({
              id: 'biz-toque-1',
              uuid: '10000000-0000-4000-8000-000000000001',
              name: 'Café & Panadería La Esquina',
              ownerName: 'Martín Gómez',
              email: 'comercio@toque.ar',
              reviewUrl: 'https://maps.google.com',
              createdAt: nowIso,
              scansCount: 0,
              reviewClicksCount: 0,
              hubConfig: DEFAULT_HUB_CONFIG,
              clubConfig: DEFAULT_CLUB_CONFIG,
              mpStatus: {
                connected: true,
                collectorId: 'MP-99482103',
                connectedAt: nowIso,
              },
            })
          ),
          setDoc(
            doc(db, 'carteles', 'cartel-caja-1'),
            stripUndefined({
              id: 'cartel-caja-1',
              uuid: '20000000-0000-4000-8000-000000000001',
              code: 'CAJA01',
              pin: '112233',
              businessId: 'biz-toque-1',
              name: 'Caja Principal (Mostrador)',
              role: 'caja',
              status: 'active',
              reviewUrl: 'https://maps.google.com',
              mode: 'hub',
              scansCount: 0,
              reviewClicksCount: 0,
              activeReceiptId: null,
              activeReceiptExpiresAt: null,
              createdAt: nowIso,
              activatedAt: nowIso,
            })
          ),
          setDoc(
            doc(db, 'carteles', 'cartel-demo-1'),
            stripUndefined({
              id: 'cartel-demo-1',
              uuid: '20000000-0000-4000-8000-000000000002',
              code: 'DEMO01',
              pin: 'ABC123',
              businessId: 'biz-toque-1',
              name: 'Cartel Mostrador 2',
              role: 'caja',
              status: 'sin_activar',
              reviewUrl: 'https://maps.google.com',
              mode: 'hub',
              scansCount: 0,
              reviewClicksCount: 0,
              activeReceiptId: null,
              activeReceiptExpiresAt: null,
              createdAt: nowIso,
            })
          ),
          setDoc(
            doc(db, 'team', 'team-owner-default'),
            stripUndefined({
              id: 'team-owner-default',
              uuid: '30000000-0000-4000-8000-000000000001',
              businessId: 'biz-toque-1',
              name: 'Martín Gómez',
              email: 'comercio@toque.ar',
              role: 'owner',
              assignedCartelId: 'cartel-caja-1',
              assignedCartelCode: 'CAJA01',
              status: 'active',
              addedAt: nowIso,
            })
          ),
          setDoc(
            doc(db, 'team', 'team-demo-owner'),
            stripUndefined({
              id: 'team-demo-owner',
              uuid: '30000000-0000-4000-8000-000000000002',
              businessId: 'biz-toque-1',
              name: 'Dueño Demo',
              email: 'demo@toque.ar',
              role: 'owner',
              assignedCartelId: 'cartel-caja-1',
              assignedCartelCode: 'CAJA01',
              status: 'active',
              addedAt: nowIso,
            })
          ),
          setDoc(
            doc(db, 'team', 'team-demo-encargado'),
            stripUndefined({
              id: 'team-demo-encargado',
              uuid: '30000000-0000-4000-8000-000000000003',
              businessId: 'biz-toque-1',
              name: 'Laura (Encargada)',
              email: 'encargado@toque.ar',
              role: 'manager',
              assignedCartelId: 'cartel-caja-1',
              assignedCartelCode: 'CAJA01',
              status: 'active',
              addedAt: nowIso,
            })
          ),
          setDoc(
            doc(db, 'team', 'team-demo-cajero'),
            stripUndefined({
              id: 'team-demo-cajero',
              uuid: '30000000-0000-4000-8000-000000000004',
              businessId: 'biz-toque-1',
              name: 'Lucas (Cajero)',
              email: 'caja@toque.ar',
              role: 'cashier',
              assignedCartelId: 'cartel-caja-1',
              assignedCartelCode: 'CAJA01',
              status: 'active',
              addedAt: nowIso,
            })
          ),
          setDoc(
            doc(db, 'team', 'team-demo-admin'),
            stripUndefined({
              id: 'team-demo-admin',
              uuid: '30000000-0000-4000-8000-000000000005',
              businessId: 'biz-toque-1',
              name: 'Super Admin',
              email: 'admin@toque.ar',
              role: 'superadmin',
              status: 'active',
              addedAt: nowIso,
            })
          ),
          setDoc(
            doc(db, 'team', 'team-owner-user'),
            stripUndefined({
              id: 'team-owner-user',
              uuid: '30000000-0000-4000-8000-000000000006',
              businessId: 'biz-toque-1',
              name: 'Federico Eloiss',
              email: 'fedeeeloiss@gmail.com',
              role: 'owner',
              assignedCartelId: 'cartel-caja-1',
              assignedCartelCode: 'CAJA01',
              status: 'active',
              addedAt: nowIso,
            })
          ),
          ...NEIGHBOR_CROSS_BENEFITS_FALLBACK.map((neighborAct) =>
            setDoc(doc(db, 'network_activations', neighborAct.id), stripUndefined(neighborAct))
          ),
        ]);
      } catch (err) {
        console.warn('Firestore initialization notice:', err);
      }
    })();
    return this.initPromise;
  }

  private getActiveBusinessId(): string {
    if (!this.currentUser?.businessId) {
      throw new Error('Debés iniciar sesión para acceder a los datos de tu comercio.');
    }
    return this.currentUser.businessId;
  }

  // --- AUTENTICACIÓN Y RESOLUCIÓN DE ROL RLS ---

  async register(data: {
    businessName: string;
    ownerName: string;
    email: string;
    password?: string;
  }): Promise<{ user: User; token: string }> {
    await this.ensureBaseDataInitialized();
    const cleanEmail = sanitizeString(data.email, 120).toLowerCase();
    const cleanBizName = sanitizeString(data.businessName, 100);
    const cleanOwnerName = sanitizeString(data.ownerName || cleanBizName, 100);
    const nowIso = new Date().toISOString();

    const bizId = `biz-${Date.now().toString(36)}`;
    const bizUuid = generateUUID();
    const cartelId = `cartel-${Date.now().toString(36)}`;
    const cartelUuid = generateUUID();
    const userUuid = generateUUID();
    const randomSuffix = Math.floor(10 + Math.random() * 89);
    const cartelCode = `CAJA${randomSuffix}`;

    const user: User = {
      id: auth.currentUser?.uid || `user-${Date.now().toString(36)}`,
      uuid: userUuid,
      email: cleanEmail,
      name: cleanOwnerName,
      businessId: bizId,
      role: 'owner',
      assignedCartelId: cartelId,
      assignedCartelCode: cartelCode,
      isSuperAdmin: false,
    };

    await setDoc(
      doc(db, 'businesses', bizId),
      stripUndefined({
        id: bizId,
        uuid: bizUuid,
        name: cleanBizName,
        ownerName: cleanOwnerName,
        email: cleanEmail,
        ownerUid: user.id,
        reviewUrl: 'https://maps.google.com',
        createdAt: nowIso,
        scansCount: 0,
        reviewClicksCount: 0,
        hubConfig: {
          ...DEFAULT_HUB_CONFIG,
          socials: {},
          products: [],
          details: {},
        },
        clubConfig: {
          ...DEFAULT_CLUB_CONFIG,
          name: `Club ${cleanBizName}`,
          clubName: `Club ${cleanBizName}`,
        },
        mpStatus: {
          connected: false,
        },
      })
    );

    await setDoc(
      doc(db, 'carteles', cartelId),
      stripUndefined({
        id: cartelId,
        uuid: cartelUuid,
        code: cartelCode,
        pin: '112233',
        businessId: bizId,
        name: 'Caja Principal',
        role: 'caja',
        status: 'active',
        reviewUrl: 'https://maps.google.com',
        mode: 'hub',
        scansCount: 0,
        reviewClicksCount: 0,
        activeReceiptId: null,
        activeReceiptExpiresAt: null,
        createdAt: nowIso,
        activatedAt: nowIso,
      })
    );

    const teamId = `team-${Date.now().toString(36)}`;
    await setDoc(
      doc(db, 'team', teamId),
      stripUndefined({
        id: teamId,
        uuid: generateUUID(),
        businessId: bizId,
        name: cleanOwnerName,
        email: cleanEmail,
        role: 'owner',
        assignedCartelId: cartelId,
        assignedCartelCode: cartelCode,
        status: 'active',
        addedAt: nowIso,
      })
    );

    const cleanPassword = sanitizeString(data.password, 100) || '123456';
    try {
      if (typeof window !== 'undefined') {
        const rawMap = window.localStorage.getItem('toque_registered_passwords_v1');
        const map = rawMap ? JSON.parse(rawMap) : {};
        map[cleanEmail] = cleanPassword;
        map[bizId] = cleanPassword;
        window.localStorage.setItem('toque_registered_passwords_v1', JSON.stringify(map));
      }
    } catch {
      // ignore
    }

    this.saveSession(user);
    return { user, token: `rls-token-${user.uuid}` };
  }

  private verifyStoredPassword(email: string, bizId: string, inputPassword?: string): boolean {
    const cleanInput = (inputPassword || '').trim();
    if (!cleanInput) return false;
    try {
      if (typeof window !== 'undefined') {
        const rawMap = window.localStorage.getItem('toque_registered_passwords_v1');
        const map = rawMap ? JSON.parse(rawMap) : {};
        const storedForEmail = map[email.toLowerCase()];
        const storedForBiz = map[bizId];
        if (storedForEmail) {
          return cleanInput === storedForEmail;
        }
        if (storedForBiz) {
          return cleanInput === storedForBiz;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  async login(credentials: {
    email: string;
    password?: string;
    isGoogle?: boolean;
    requirePasswordVerification?: boolean;
  }): Promise<{ user: User; token: string }> {
    await this.ensureBaseDataInitialized();

    let cleanEmail = sanitizeString(credentials.email, 120).toLowerCase();
    let displayName = '';
    let uid = '';

    if (credentials.requirePasswordVerification) {
      const activeBizId = this.currentUser?.businessId || '';
      const isValidPwd = this.verifyStoredPassword(cleanEmail, activeBizId, credentials.password);
      if (!isValidPwd) {
        throw new Error('Contraseña incorrecta. Ingresá la contraseña con la que te registraste.');
      }
    } else if (credentials.password && !credentials.isGoogle) {
      try {
        if (typeof window !== 'undefined') {
          const rawMap = window.localStorage.getItem('toque_registered_passwords_v1');
          const map = rawMap ? JSON.parse(rawMap) : {};
          if (!map[cleanEmail]) {
            map[cleanEmail] = credentials.password.trim();
            window.localStorage.setItem('toque_registered_passwords_v1', JSON.stringify(map));
          }
        }
      } catch {
        // ignore
      }
    }

    if (credentials.isGoogle) {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user?.email) {
        cleanEmail = result.user.email.toLowerCase();
        displayName = result.user.displayName || cleanEmail.split('@')[0];
        uid = result.user.uid;
      }
    }

    if (!cleanEmail) {
      throw new Error('Debés ingresar un correo electrónico válido para iniciar sesión.');
    }

    // 1. Buscar en la colección team si es colaborador o dueño registrado
    const teamQuery = query(collection(db, 'team'), where('email', '==', cleanEmail));
    const teamSnap = await getDocs(teamQuery);
    const activeTeamDoc = teamSnap.docs
      .map((d) => d.data() as TeamMember)
      .find((m) => m.status === 'active');

    if (activeTeamDoc) {
      const user: User = {
        id: uid || `user-${activeTeamDoc.id}`,
        uuid: activeTeamDoc.uuid || generateUUID(),
        email: cleanEmail,
        name: displayName || activeTeamDoc.name,
        businessId: activeTeamDoc.businessId,
        role: activeTeamDoc.role,
        assignedCartelId: activeTeamDoc.assignedCartelId,
        assignedCartelCode: activeTeamDoc.assignedCartelCode,
        isSuperAdmin: false,
      };
      this.saveSession(user);
      return { user, token: `session-${user.uuid}` };
    }

    // 2. Buscar si es dueño de un comercio existente en businesses
    const bizQuery = query(collection(db, 'businesses'), where('email', '==', cleanEmail));
    const bizSnap = await getDocs(bizQuery);
    if (!bizSnap.empty) {
      const bizData = bizSnap.docs[0].data() as BusinessProfile;
      const user: User = {
        id: uid || `user-${bizData.id}`,
        uuid: bizData.uuid || generateUUID(),
        email: cleanEmail,
        name: displayName || bizData.ownerName || 'Dueño',
        businessId: bizData.id,
        role: 'owner',
        isSuperAdmin: false,
      };
      this.saveSession(user);
      return { user, token: `session-${user.uuid}` };
    }

    // 3. Si ingresa con Google por primera vez, registrarlo automáticamente
    if (credentials.isGoogle) {
      return this.register({
        businessName: displayName ? `Local de ${displayName}` : 'Mi Comercio Toque',
        ownerName: displayName || 'Dueño',
        email: cleanEmail,
      });
    }

    throw new Error('No existe una sesión o cuenta válida para este usuario.');
  }

  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    this.saveSession(null);
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.currentUser || !this.currentUser.id || !this.currentUser.email) {
      return null;
    }

    try {
      const cleanEmail = this.currentUser.email.toLowerCase();
      const teamQuery = query(collection(db, 'team'), where('email', '==', cleanEmail));
      const snap = await getDocs(teamQuery);
      const activeMember = snap.docs
        .map((d) => d.data() as TeamMember)
        .find((m) => m.status === 'active');

      if (activeMember) {
        const updatedUser: User = {
          ...this.currentUser,
          uuid: this.currentUser.uuid || activeMember.uuid || generateUUID(),
          name: activeMember.name || this.currentUser.name,
          businessId: activeMember.businessId,
          role: activeMember.role,
          assignedCartelId: activeMember.assignedCartelId,
          assignedCartelCode: activeMember.assignedCartelCode,
          isSuperAdmin: false,
        };
        this.saveSession(updatedUser);
        return updatedUser;
      }

      const bizQuery = query(collection(db, 'businesses'), where('email', '==', cleanEmail));
      const bizSnap = await getDocs(bizQuery);
      if (!bizSnap.empty) {
        const bizData = bizSnap.docs[0].data() as BusinessProfile;
        const updatedUser: User = {
          ...this.currentUser,
          uuid: this.currentUser.uuid || bizData.uuid || generateUUID(),
          name: bizData.ownerName || this.currentUser.name,
          businessId: bizData.id,
          role: 'owner',
          isSuperAdmin: false,
        };
        this.saveSession(updatedUser);
        return updatedUser;
      }

      this.saveSession(null);
      return null;
    } catch {
      return this.currentUser;
    }
  }

  // --- ACTIVACIÓN Y GESTIÓN DE CARTELES ---

  async getCartelByCode(code: string): Promise<Cartel | null> {
    await this.ensureBaseDataInitialized();
    const cleanCode = sanitizeString(code, 32).toUpperCase();
    const q = query(collection(db, 'carteles'), where('code', '==', cleanCode));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as Cartel;
  }

  async getActivationState(code: string): Promise<{
    found: boolean;
    status?: Cartel['status'];
    requiresPin?: boolean;
    cartel?: Partial<Cartel>;
  }> {
    const cartel = await this.getCartelByCode(code);
    if (!cartel) {
      return { found: false };
    }

    return {
      found: true,
      status: cartel.status,
      requiresPin: cartel.status === 'sin_activar',
      cartel: {
        id: cartel.id,
        uuid: cartel.uuid,
        code: cartel.code,
        name: cartel.name,
        role: cartel.role,
        status: cartel.status,
      },
    };
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
    await this.ensureBaseDataInitialized();
    const cleanCode = sanitizeString(data.code, 32).toUpperCase();
    const cleanPin = sanitizeString(data.pin, 16).toUpperCase();

    const q = query(collection(db, 'carteles'), where('code', '==', cleanCode));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error('No encontramos un cartel con ese código.');
    }

    const cartelDoc = snap.docs[0];
    const cartel = cartelDoc.data() as Cartel;

    if (cartel.status === 'active') {
      throw new Error('Este cartel ya se encuentra activado.');
    }

    if (cleanPin) {
      const attempts = this.pinAttempts[cleanCode] || 0;
      if (attempts >= 5) {
        throw new Error(
          'Superaste los 5 intentos con el PIN. Por seguridad, la activación quedó bloqueada.'
        );
      }

      if (cartel.pin.toUpperCase() !== cleanPin) {
        this.pinAttempts[cleanCode] = attempts + 1;
        const restantes = 5 - (attempts + 1);
        throw new Error(`El PIN ingresado es incorrecto. Te quedan ${restantes} intento(s).`);
      }
    }

    const finalReviewUrl =
      sanitizeString(data.reviewUrl || data.googleReviewUrl, 300) ||
      cartel.reviewUrl ||
      'https://maps.google.com';

    const bizId = this.getActiveBusinessId();
    const nowIso = new Date().toISOString();
    const cartelUuid = cartel.uuid || generateUUID();

    const updatedCartel: Cartel = {
      ...cartel,
      uuid: cartelUuid,
      businessId: bizId,
      name: sanitizeString(data.cartelName || data.name, 80) || 'Caja 1',
      role: data.role,
      mode: data.mode || 'hub',
      reviewUrl: finalReviewUrl,
      status: 'active',
      activatedAt: nowIso,
    };

    await updateDoc(
      doc(db, 'carteles', cartel.id),
      stripUndefined({
        uuid: cartelUuid,
        businessId: updatedCartel.businessId,
        name: updatedCartel.name,
        role: updatedCartel.role,
        mode: updatedCartel.mode,
        reviewUrl: updatedCartel.reviewUrl,
        status: 'active',
        activatedAt: nowIso,
      })
    );

    const bizRef = doc(db, 'businesses', bizId);
    const bizSnap = await getDoc(bizRef);
    if (bizSnap.exists()) {
      await updateDoc(
        bizRef,
        stripUndefined({
          name: sanitizeString(data.businessName, 100) || bizSnap.data().name,
          reviewUrl: updatedCartel.reviewUrl,
        })
      );
    }

    delete this.pinAttempts[cleanCode];
    return { success: true, cartel: updatedCartel };
  }

  async listCarteles(): Promise<Cartel[]> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const q = query(collection(db, 'carteles'), where('businessId', '==', bizId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => d.data() as Cartel);

    if (this.currentUser?.role === 'cashier' && this.currentUser.assignedCartelId) {
      const assigned = list.filter((c) => c.id === this.currentUser?.assignedCartelId);
      if (assigned.length > 0) return assigned;
    }

    return list.sort((a, b) => a.code.localeCompare(b.code));
  }

  async createCartelForBusiness(data: {
    name: string;
    code?: string;
    role: CartelRole;
    mode?: HubMode;
    reviewUrl?: string;
  }): Promise<Cartel> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    await this.ensureBaseDataInitialized();

    const bizId = this.getActiveBusinessId();
    const biz = await this.getBusinessProfile();
    const cleanName = sanitizeString(data.name, 80) || 'Nuevo Cartel';
    const rawCode = data.code
      ? sanitizeString(data.code, 20).toUpperCase().replace(/[^A-Z0-9-]/g, '')
      : `CAJA${Math.floor(10 + Math.random() * 89)}`;

    const existingQ = query(collection(db, 'carteles'), where('code', '==', rawCode));
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      throw new Error(`El código ${rawCode} ya está en uso por otro cartel.`);
    }

    const nowIso = new Date().toISOString();
    const id = `cartel-${Date.now().toString(36)}`;
    const cartel: Cartel = {
      id,
      uuid: generateUUID(),
      code: rawCode,
      pin: Math.floor(100000 + Math.random() * 900000).toString(),
      businessId: bizId,
      name: cleanName,
      role: data.role,
      status: 'active',
      reviewUrl:
        sanitizeString(data.reviewUrl, 300) || biz.reviewUrl || 'https://maps.google.com',
      mode: data.mode || 'hub',
      scansCount: 0,
      reviewClicksCount: 0,
      activeReceiptId: null,
      activeReceiptExpiresAt: null,
      createdAt: nowIso,
      activatedAt: nowIso,
    };

    await setDoc(doc(db, 'carteles', id), stripUndefined(cartel));
    return cartel;
  }

  async updateCartel(
    id: string,
    patch: Partial<Pick<Cartel, 'name' | 'role' | 'status' | 'mode' | 'reviewUrl'>>
  ): Promise<Cartel> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const ref = doc(db, 'carteles', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Cartel no encontrado.');

    const current = snap.data() as Cartel;
    this.assertOrganizationScope(current.businessId);

    const updated: Cartel = {
      ...current,
      ...patch,
    };
    await updateDoc(ref, stripUndefined(patch as Record<string, any>));
    return updated;
  }

  // --- HUB DEL NEGOCIO ---

  private normalizeBlocksOrder(blocks?: HubConfig['blocks']): HubConfig['blocks'] {
    const source = Array.isArray(blocks) && blocks.length > 0 ? blocks : DEFAULT_HUB_CONFIG.blocks;
    const receiptBlock = source.find((b) => b.key === 'receipt') || { key: 'receipt', enabled: true };
    const others = source.filter((b) => b.key !== 'receipt');
    return [{ ...receiptBlock, key: 'receipt', enabled: true }, ...others];
  }

  async getHubConfig(): Promise<HubConfig> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const snap = await getDoc(doc(db, 'businesses', bizId));
    if (snap.exists()) {
      const data = snap.data();
      const isPlanPaid = Boolean(data.planPaid || data.hubConfig?.planPaid);
      const isNetworkEnabled = Boolean(data.networkEnabled || data.hubConfig?.networkEnabled);
      if (data.hubConfig) {
        const storedProducts: HubProduct[] = Array.isArray(data.hubConfig.products)
          ? data.hubConfig.products
          : [];
        const mergedProducts =
          storedProducts.length <= 2 &&
          bizId === 'biz-toque-1' &&
          (!storedProducts[0] || storedProducts[0].id === 'prod-1')
            ? DEFAULT_HUB_CONFIG.products
            : storedProducts;

        return {
          ...DEFAULT_HUB_CONFIG,
          ...data.hubConfig,
          products: mergedProducts,
          blocks: this.normalizeBlocksOrder(data.hubConfig.blocks),
          socials: {
            ...DEFAULT_HUB_CONFIG.socials,
            ...(data.hubConfig.socials || {}),
          },
          googleReviewUrl: data.hubConfig.googleReviewUrl || data.reviewUrl || 'https://maps.google.com',
          planPaid: isPlanPaid,
          networkEnabled: isNetworkEnabled,
        };
      }
      return {
        ...DEFAULT_HUB_CONFIG,
        blocks: this.normalizeBlocksOrder(DEFAULT_HUB_CONFIG.blocks),
        planPaid: isPlanPaid,
        networkEnabled: isNetworkEnabled,
      };
    }
    return {
      ...DEFAULT_HUB_CONFIG,
      blocks: this.normalizeBlocksOrder(DEFAULT_HUB_CONFIG.blocks),
    };
  }

  async updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const bizId = this.getActiveBusinessId();
    const current = await this.getHubConfig();
    const next: HubConfig = {
      ...current,
      ...patch,
      blocks: this.normalizeBlocksOrder(patch.blocks || current.blocks),
    };
    await updateDoc(
      doc(db, 'businesses', bizId),
      stripUndefined({
        hubConfig: next,
        ...(next.googleReviewUrl ? { reviewUrl: next.googleReviewUrl } : {}),
        ...(patch.planPaid !== undefined ? { planPaid: patch.planPaid } : {}),
        ...(patch.networkEnabled !== undefined ? { networkEnabled: patch.networkEnabled } : {}),
      })
    );
    return next;
  }

  // --- HUB PÚBLICO DEL CLIENTE Y SINCRONIZACIÓN EN TIEMPO REAL ---

  private async buildPublicHubFromCartel(cartel: Cartel): Promise<PublicHub> {
    const bizId = cartel.businessId || 'biz-toque-1';
    const bizSnap = await getDoc(doc(db, 'businesses', bizId));
    const bizData = bizSnap.exists() ? bizSnap.data() : null;

    const isPlanPaid = Boolean(bizData?.planPaid || bizData?.hubConfig?.planPaid);
    const rawHubConfig: HubConfig = bizData?.hubConfig || DEFAULT_HUB_CONFIG;
    const hubConfig: HubConfig = {
      ...DEFAULT_HUB_CONFIG,
      ...rawHubConfig,
      blocks: this.normalizeBlocksOrder(rawHubConfig.blocks),
      planPaid: isPlanPaid,
    };
    const clubConfig: ClubConfig = bizData?.clubConfig || DEFAULT_CLUB_CONFIG;
    const businessName = bizData?.name || 'Comercio Toque';
    const reviewUrl = cartel.reviewUrl || bizData?.reviewUrl || 'https://maps.google.com';

    let activeReceipt: Receipt | null = null;
    const now = Date.now();

    // Ventana estricta de 2 minutos: solo si el recibo activo en el cartel sigue en 'ready' y no venció
    if (
      cartel.activeReceiptId &&
      cartel.activeReceiptExpiresAt &&
      new Date(cartel.activeReceiptExpiresAt).getTime() > now
    ) {
      const rcpSnap = await getDoc(doc(db, 'receipts', cartel.activeReceiptId));
      if (rcpSnap.exists()) {
        const rcp = rcpSnap.data() as Receipt;
        const createdMs = new Date(rcp.createdAt).getTime();
        const withinTwoMinutes = now - createdMs <= 2 * 60 * 1000 && new Date(rcp.expiresAt).getTime() > now;
        if (rcp.status === 'ready' && withinTwoMinutes) {
          activeReceipt = rcp;
        }
      }
    }

    const crossBenefits = await this.getPublicCrossBenefits(bizId);

    return {
      business: {
        id: bizId,
        uuid: bizData?.uuid,
        name: businessName,
        logoUrl: hubConfig.logoUrl,
      },
      cartel: {
        id: cartel.id,
        uuid: cartel.uuid,
        code: cartel.code,
        name: cartel.name,
        role: cartel.role,
        status: cartel.status,
        mode: cartel.mode,
      },
      reviewUrl,
      blocks: hubConfig.blocks,
      receipt: activeReceipt,
      activeReceipt,
      club: clubConfig.active
        ? {
            config: clubConfig,
            member: null,
          }
        : null,
      config: hubConfig,
      crossBenefits,
    };
  }

  async getPublicHub(code: string): Promise<PublicHub> {
    await this.ensureBaseDataInitialized();
    const cleanCode = sanitizeString(code, 32).toUpperCase();
    const q = query(collection(db, 'carteles'), where('code', '==', cleanCode));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error('Cartel no encontrado.');
    }

    const cartel = snap.docs[0].data() as Cartel;
    return this.buildPublicHubFromCartel(cartel);
  }

  subscribeToCartelHub(code: string, onUpdate: (hub: PublicHub) => void): () => void {
    const cleanCode = sanitizeString(code, 32).toUpperCase();
    const q = query(collection(db, 'carteles'), where('code', '==', cleanCode));

    const unsubscribe = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty) return;
        const cartel = snap.docs[0].data() as Cartel;
        try {
          const hub = await this.buildPublicHubFromCartel(cartel);
          onUpdate(hub);
        } catch (err) {
          console.error('Error building realtime hub:', err);
        }
      },
      (err) => {
        console.warn('Realtime hub listener error:', err);
      }
    );

    return unsubscribe;
  }

  async getReceiptById(receiptId: string): Promise<Receipt | null> {
    await this.ensureBaseDataInitialized();
    const cleanId = sanitizeString(receiptId, 64);
    const directSnap = await getDoc(doc(db, 'receipts', cleanId));
    if (directSnap.exists()) {
      return directSnap.data() as Receipt;
    }

    const allSnap = await getDocs(collection(db, 'receipts'));
    const match = allSnap.docs
      .map((d) => d.data() as Receipt)
      .find((r) => r.id.toUpperCase() === cleanId.toUpperCase());

    return match || null;
  }

  subscribeToReceipt(
    receiptId: string,
    onUpdate: (receipt: Receipt | null) => void
  ): () => void {
    const cleanId = sanitizeString(receiptId, 64);
    const ref = doc(db, 'receipts', cleanId);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data() as Receipt);
        } else {
          onUpdate(null);
        }
      },
      () => {
        // ignore listener error
      }
    );
  }

  async claimReceipt(id: string): Promise<{ success: boolean; receipt: Receipt }> {
    const ref = doc(db, 'receipts', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error('El comprobante no está disponible o ya venció.');
    }

    const receipt = snap.data() as Receipt;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    if (receipt.status === 'ready') {
      await updateDoc(ref, {
        status: 'claimed',
        claimedAt: nowIso,
      });

      // Al abrirse/reclamarse el comprobante, liberamos el cartel para que nadie más pueda abrirlo
      try {
        const q = query(
          collection(db, 'carteles'),
          where('code', '==', receipt.cartelCode.toUpperCase())
        );
        const cSnap = await getDocs(q);
        if (!cSnap.empty) {
          const cDoc = cSnap.docs[0];
          if (cDoc.data().activeReceiptId === receipt.id) {
            await updateDoc(doc(db, 'carteles', cDoc.id), {
              activeReceiptId: null,
              activeReceiptExpiresAt: null,
            });
          }
        }
      } catch {
        // ignore
      }
    }

    const updated: Receipt = {
      ...receipt,
      status: 'claimed',
      claimedAt: receipt.claimedAt || nowIso,
    };

    return { success: true, receipt: updated };
  }

  async recordHubEvent(code: string, eventType: 'scan' | 'review_click'): Promise<void> {
    try {
      const cleanCode = sanitizeString(code, 32).toUpperCase();
      const q = query(collection(db, 'carteles'), where('code', '==', cleanCode));
      const snap = await getDocs(q);
      if (snap.empty) return;

      const cartel = snap.docs[0].data() as Cartel;
      const nowIso = new Date().toISOString();

      if (eventType === 'scan') {
        await updateDoc(doc(db, 'carteles', cartel.id), {
          scansCount: increment(1),
          lastScannedAt: nowIso,
        });
        if (cartel.businessId) {
          await updateDoc(doc(db, 'businesses', cartel.businessId), {
            scansCount: increment(1),
          });
        }
      } else if (eventType === 'review_click') {
        await updateDoc(doc(db, 'carteles', cartel.id), {
          reviewClicksCount: increment(1),
        });
        if (cartel.businessId) {
          await updateDoc(doc(db, 'businesses', cartel.businessId), {
            reviewClicksCount: increment(1),
          });
        }
      }
    } catch {
      // No interrumpir experiencia pública si falla telemetría
    }
  }

  async getWalletStatus(): Promise<{ configured: boolean; provider: string }> {
    try {
      const res = await fetch('/api/wallet/status');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return { configured: true, provider: 'WalletWallet' };
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
    const cleanCode = sanitizeString(data.cartelCode || 'CAJA01', 32).toUpperCase();
    let businessName = 'Comercio Toque';
    let targetReward = 'Beneficio exclusivo';
    let stampsRequired = 5;

    try {
      const hub = await this.getPublicHub(cleanCode);
      businessName = hub.business.name;
      const clubCfg = hub.club?.config || DEFAULT_CLUB_CONFIG;
      targetReward =
        clubCfg.welcomeBenefitText || clubCfg.rewards[0]?.label || 'Beneficio exclusivo';
      stampsRequired = clubCfg.rewards[0]?.target || 5;
    } catch {
      const biz = await this.getBusinessProfile();
      businessName = biz.name;
    }

    const response = await fetch('/api/wallet/pass', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessName,
        brandColor: '#D95B26',
        stamps: data.stamps || data.points || 1,
        stampsRequired,
        rewardText: targetReward,
        customerName: data.customerName || 'Socio Toque',
        customerContact: data.customerContact || data.contact || '',
        code: cleanCode,
        qrUrl: `${window.location.origin}/h/${cleanCode}`,
      }),
    });

    if (!response.ok) {
      throw new Error('No pudimos generar el pase con WalletWallet.');
    }

    const passResult: WalletPassResponse = await response.json();
    const primaryPassUrl = passResult.appleWalletUrl || passResult.googleWalletUrl;

    if (data.memberId) {
      try {
        await updateDoc(
          doc(db, 'members', data.memberId),
          stripUndefined({
            passId: passResult.passId || passResult.validationCode,
            passUrl: primaryPassUrl,
            walletPassUrl: primaryPassUrl,
            appleWalletUrl: passResult.appleWalletUrl,
            googleWalletUrl: passResult.googleWalletUrl,
          })
        );
      } catch {
        // ignore update error
      }
    }

    return passResult;
  }

  async joinClub(data: {
    cartelCode: string;
    contact: string;
    name?: string;
    consent: boolean;
  }): Promise<{ member: ClubMember; pointsAwarded: number; walletPass?: WalletPassResponse }> {
    if (!data.consent) {
      throw new Error('Para sumarte al Club necesitás aceptar el consentimiento.');
    }

    const cleanContact = sanitizeString(data.contact, 100);
    if (!cleanContact || cleanContact.length < 5) {
      throw new Error('Ingresá un número de WhatsApp o correo electrónico válido.');
    }

    const cleanCode = sanitizeString(data.cartelCode, 32).toUpperCase();
    const cartelQ = query(collection(db, 'carteles'), where('code', '==', cleanCode));
    const cartelSnap = await getDocs(cartelQ);
    const businessId = !cartelSnap.empty
      ? (cartelSnap.docs[0].data() as Cartel).businessId || 'biz-toque-1'
      : 'biz-toque-1';

    const membersQ = query(
      collection(db, 'members'),
      where('businessId', '==', businessId)
    );
    const membersSnap = await getDocs(membersQ);
    const existing = membersSnap.docs
      .map((d) => d.data() as ClubMember)
      .find((m) => m.contact.toLowerCase() === cleanContact.toLowerCase());

    const pointsAwarded = 1;
    let member: ClubMember;

    if (existing) {
      const nextPoints = (existing.points || 0) + pointsAwarded;
      member = {
        ...existing,
        uuid: existing.uuid || generateUUID(),
        name: sanitizeString(data.name, 80) || existing.name,
        points: nextPoints,
        stamps: nextPoints,
      };
      await updateDoc(
        doc(db, 'members', existing.id),
        stripUndefined({
          uuid: member.uuid,
          name: member.name || '',
          points: nextPoints,
          stamps: nextPoints,
        })
      );
    } else {
      const memberId = `mem-${Date.now().toString(36)}`;
      member = {
        id: memberId,
        uuid: generateUUID(),
        businessId,
        name: sanitizeString(data.name, 80) || 'Socio Toque',
        contact: cleanContact,
        points: pointsAwarded,
        stamps: pointsAwarded,
        joinedAt: new Date().toISOString(),
        consent: true,
      };
      await setDoc(doc(db, 'members', memberId), stripUndefined(member));
    }

    let walletPass: WalletPassResponse | undefined;
    try {
      walletPass = await this.createWalletPass({
        cartelCode: cleanCode,
        memberId: member.id,
        customerName: member.name || member.contact,
        customerContact: member.contact,
        stamps: member.points,
      });
      member.passId = walletPass.passId;
      member.passUrl = walletPass.appleWalletUrl || walletPass.googleWalletUrl;
      member.walletPassUrl = member.passUrl;
      member.appleWalletUrl = walletPass.appleWalletUrl;
      member.googleWalletUrl = walletPass.googleWalletUrl;
    } catch {
      // Wallet pass optional on join if offline
    }

    return { member, pointsAwarded, walletPass };
  }

  // --- CAJA Y COBROS EN TIEMPO REAL ---

  private async emitReceiptForSale(sale: Sale, cartel: Cartel): Promise<Receipt> {
    const bizSnap = await getDoc(doc(db, 'businesses', sale.businessId));
    const businessName = bizSnap.exists() ? bizSnap.data().name : 'Comercio Toque';

    // Límite estricto de seguridad de 2 minutos (120 segundos) para abrir el comprobante
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const shortRand = Math.floor(1000 + Math.random() * 9000);
    const receiptId = `RCP-${cartel.code}-${shortRand}`;

    const receipt: Receipt = {
      id: receiptId,
      uuid: generateUUID(),
      saleId: sale.id,
      businessId: sale.businessId,
      cartelCode: cartel.code.toUpperCase(),
      status: 'ready',
      expiresAt,
      businessName,
      items: sale.items,
      total: sale.amount,
      currency: 'ARS',
      method: sale.method,
      createdAt: new Date().toISOString(),
    };

    const previousReceiptId = cartel.activeReceiptId;

    await Promise.all([
      setDoc(doc(db, 'receipts', receiptId), stripUndefined(receipt)),
      updateDoc(doc(db, 'carteles', cartel.id), {
        activeReceiptId: receipt.id,
        activeReceiptExpiresAt: receipt.expiresAt,
      }),
      updateDoc(doc(db, 'sales', sale.id), {
        receiptId: receipt.id,
      }),
      ...(previousReceiptId && previousReceiptId !== receiptId
        ? [
            updateDoc(doc(db, 'receipts', previousReceiptId), {
              status: 'expired',
            }).catch(() => {}),
          ]
        : []),
    ]);

    return receipt;
  }

  async createSale(data: {
    cartelId: string;
    amount: number;
    items?: SaleItem[];
    method: PaymentMethod;
  }): Promise<{ sale: Sale; qrData?: string; receipt?: Receipt }> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    await this.ensureBaseDataInitialized();

    if (data.amount <= 0) {
      throw new Error('El importe debe ser mayor a cero.');
    }

    const cartelRef = doc(db, 'carteles', data.cartelId);
    const cartelSnap = await getDoc(cartelRef);
    if (!cartelSnap.exists()) {
      throw new Error('Caja o cartel no encontrado.');
    }

    const cartel = cartelSnap.data() as Cartel;
    this.assertOrganizationScope(cartel.businessId);

    const bizId = cartel.businessId || this.getActiveBusinessId();
    const saleId = `sale-${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();

    const items: SaleItem[] =
      data.items && data.items.length > 0
        ? data.items
        : [
            {
              id: 'item-1',
              name: 'Consumo en mostrador',
              price: data.amount,
              quantity: 1,
            },
          ];

    // Todos los métodos (Efectivo, Tarjeta y QR) emiten el comprobante al instante sin esperar confirmación
    const sale: Sale = {
      id: saleId,
      uuid: generateUUID(),
      businessId: bizId,
      cartelId: cartel.id,
      cartelCode: cartel.code,
      cartelName: cartel.name,
      amount: data.amount,
      currency: 'ARS',
      items,
      method: data.method,
      status: 'paid',
      createdAt: nowIso,
      paidAt: nowIso,
      cashierName: this.currentUser?.name || 'Cajero',
      cashierEmail: this.currentUser?.email || '',
    };

    await setDoc(doc(db, 'sales', saleId), stripUndefined(sale));

    const receipt = await this.emitReceiptForSale(sale, cartel);
    sale.receiptId = receipt.id;

    const qrData = `${window.location.origin}/r/${receipt.id}`;

    return { sale, qrData, receipt };
  }

  async getSale(id: string): Promise<Sale> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    const snap = await getDoc(doc(db, 'sales', id));
    if (!snap.exists()) throw new Error('Venta no encontrada.');
    const sale = snap.data() as Sale;
    this.assertOrganizationScope(sale.businessId);
    return sale;
  }

  async confirmManualSale(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    return this.simulatePaymentApproved(id);
  }

  async simulatePaymentApproved(id: string): Promise<{ sale: Sale; receipt: Receipt }> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    const saleRef = doc(db, 'sales', id);
    const saleSnap = await getDoc(saleRef);
    if (!saleSnap.exists()) throw new Error('Venta no encontrada.');

    const sale = saleSnap.data() as Sale;
    this.assertOrganizationScope(sale.businessId);
    const nowIso = new Date().toISOString();

    const cartelSnap = await getDoc(doc(db, 'carteles', sale.cartelId));
    const cartel = cartelSnap.exists()
      ? (cartelSnap.data() as Cartel)
      : ({
          id: sale.cartelId,
          uuid: generateUUID(),
          code: sale.cartelCode || 'CAJA01',
          businessId: sale.businessId,
          name: sale.cartelName || 'Caja Principal',
          role: 'caja',
          status: 'active',
          mode: 'hub',
          pin: '112233',
          createdAt: nowIso,
        } as Cartel);

    await updateDoc(saleRef, {
      status: 'paid',
      paidAt: nowIso,
    });

    const updatedSale: Sale = {
      ...sale,
      status: 'paid',
      paidAt: nowIso,
    };

    const receipt = await this.emitReceiptForSale(updatedSale, cartel);
    updatedSale.receiptId = receipt.id;

    return { sale: updatedSale, receipt };
  }

  async cancelSale(id: string): Promise<Sale> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    const saleRef = doc(db, 'sales', id);
    const saleSnap = await getDoc(saleRef);
    if (!saleSnap.exists()) throw new Error('Venta no encontrada.');

    const sale = saleSnap.data() as Sale;
    this.assertOrganizationScope(sale.businessId);

    await updateDoc(saleRef, {
      status: 'cancelled',
    });

    if (sale.receiptId) {
      try {
        await updateDoc(doc(db, 'receipts', sale.receiptId), {
          status: 'cancelled',
        });
      } catch {
        // ignore
      }
    }

    try {
      const cartelRef = doc(db, 'carteles', sale.cartelId);
      const cartelSnap = await getDoc(cartelRef);
      if (cartelSnap.exists() && cartelSnap.data().activeReceiptId === sale.receiptId) {
        await updateDoc(cartelRef, {
          activeReceiptId: null,
          activeReceiptExpiresAt: null,
        });
      }
    } catch {
      // ignore
    }

    return {
      ...sale,
      status: 'cancelled',
    };
  }

  async listSales(filters?: {
    dateFrom?: string;
    dateTo?: string;
    method?: PaymentMethod;
    cartelId?: string;
  }): Promise<Sale[]> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const q = query(collection(db, 'sales'), where('businessId', '==', bizId));
    const snap = await getDocs(q);

    let list = snap.docs
      .map((d) => d.data() as Sale)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.method) {
      list = list.filter((s) => s.method === filters.method);
    }
    if (filters?.cartelId) {
      list = list.filter((s) => s.cartelId === filters.cartelId);
    }

    return list;
  }

  subscribeToBusinessSales(onUpdate: (sales: Sale[]) => void): () => void {
    const bizId = this.getActiveBusinessId();
    const q = query(collection(db, 'sales'), where('businessId', '==', bizId));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Sale)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(list);
      },
      () => {
        // ignore listener error
      }
    );
  }

  // --- CLUB DE FIDELIDAD ---

  async getClubConfig(): Promise<ClubConfig> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const snap = await getDoc(doc(db, 'businesses', bizId));
    if (snap.exists() && snap.data().clubConfig) {
      const cfg = snap.data().clubConfig as ClubConfig;
      return {
        ...DEFAULT_CLUB_CONFIG,
        ...cfg,
        clubName: cfg.clubName || cfg.name || DEFAULT_CLUB_CONFIG.name,
        welcomeBenefitText:
          cfg.welcomeBenefitText ||
          cfg.rewards?.[0]?.label ||
          DEFAULT_CLUB_CONFIG.welcomeBenefitText,
        pointsPerVisit: cfg.pointsPerVisit || cfg.rule?.value || 1,
        enabled: cfg.enabled !== undefined ? cfg.enabled : cfg.active,
      };
    }
    return { ...DEFAULT_CLUB_CONFIG };
  }

  async updateClubConfig(patch: Partial<ClubConfig>): Promise<ClubConfig> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const bizId = this.getActiveBusinessId();
    const current = await this.getClubConfig();
    const nextName = patch.clubName || patch.name || current.name;
    const nextActive = patch.enabled !== undefined ? patch.enabled : (patch.active ?? current.active);
    const nextBenefit =
      patch.welcomeBenefitText || current.welcomeBenefitText || 'Café a elección de regalo';
    const nextPoints = patch.pointsPerVisit || current.pointsPerVisit || 1;

    const next: ClubConfig = {
      ...current,
      ...patch,
      name: nextName,
      clubName: nextName,
      active: nextActive,
      enabled: nextActive,
      welcomeBenefitText: nextBenefit,
      pointsPerVisit: nextPoints,
      rule: {
        type: 'per_visit',
        value: nextPoints,
      },
      rewards: [
        { id: 'rew-1', label: nextBenefit, target: 5 },
        ...(current.rewards?.slice(1) || []),
      ],
    };
    await updateDoc(
      doc(db, 'businesses', bizId),
      stripUndefined({
        clubConfig: next,
      })
    );
    return next;
  }

  async listClubMembers(): Promise<ClubMember[]> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const q = query(collection(db, 'members'), where('businessId', '==', bizId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const m = d.data() as ClubMember;
        return {
          ...m,
          walletPassUrl: m.walletPassUrl || m.passUrl || m.appleWalletUrl || m.googleWalletUrl,
        };
      })
      .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
  }

  async exportClubMembersCsv(): Promise<string> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const members = await this.listClubMembers();
    const header = 'ID,UUID,Nombre,Contacto,Puntos,Fecha Alta,Pase Wallet\n';
    const rows = members
      .map(
        (m) =>
          `"${m.id}","${m.uuid || ''}","${(m.name || 'Cliente Toque').replace(/"/g, '""')}","${m.contact.replace(
            /"/g,
            '""'
          )}",${m.points},"${m.joinedAt}","${m.walletPassUrl || ''}"`
      )
      .join('\n');
    return header + rows;
  }

  async deleteClubMember(id: string): Promise<void> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const ref = doc(db, 'members', id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const member = snap.data() as ClubMember;
      this.assertOrganizationScope(member.businessId);
      await deleteDoc(ref);
    }
  }

  // --- EQUIPO Y COLABORADORES (RLS) ---

  async listTeamMembers(): Promise<TeamMember[]> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const q = query(collection(db, 'team'), where('businessId', '==', bizId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as TeamMember)
      .filter((m) => m.status !== 'revoked')
      .sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
  }

  async addTeamMember(data: {
    name: string;
    email?: string;
    role: 'owner' | 'manager' | 'cashier';
    assignedCartelId?: string;
  }): Promise<TeamMember> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    await this.ensureBaseDataInitialized();

    const cleanName = sanitizeString(data.name, 80);
    if (!cleanName) {
      throw new Error('Ingresá el nombre y apellido.');
    }

    const generatedSlug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '');

    const cleanEmail = data.email?.trim()
      ? sanitizeString(data.email, 120).toLowerCase()
      : `${generatedSlug || 'cajero'}.${Math.floor(100 + Math.random() * 900)}@toque.ar`;

    const bizId = this.getActiveBusinessId();
    let assignedCartelCode: string | undefined;
    if (data.assignedCartelId) {
      const cSnap = await getDoc(doc(db, 'carteles', data.assignedCartelId));
      if (cSnap.exists()) {
        const cData = cSnap.data() as Cartel;
        this.assertOrganizationScope(cData.businessId);
        assignedCartelCode = cData.code;
      }
    }

    const id = `team-${Date.now().toString(36)}`;
    const member: TeamMember = {
      id,
      uuid: generateUUID(),
      businessId: bizId,
      name: cleanName,
      email: cleanEmail,
      role: data.role,
      assignedCartelId: data.assignedCartelId || undefined,
      assignedCartelCode,
      status: 'active',
      addedAt: new Date().toISOString(),
      addedByEmail: this.currentUser?.email,
    };

    await setDoc(doc(db, 'team', id), stripUndefined(member));
    return member;
  }

  async updateTeamMember(
    id: string,
    patch: Partial<Pick<TeamMember, 'name' | 'role' | 'assignedCartelId' | 'status'>>
  ): Promise<TeamMember> {
    this.assertRoleAccess(['owner', 'superadmin']);
    const ref = doc(db, 'team', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Colaborador no encontrado.');

    const current = snap.data() as TeamMember;
    this.assertOrganizationScope(current.businessId);

    // El dueño no puede cambiar su propio rol ni qué cajas administra
    if (
      this.currentUser &&
      current.email.toLowerCase() === this.currentUser.email.toLowerCase() &&
      (patch.role !== undefined || patch.assignedCartelId !== undefined)
    ) {
      throw new Error('El dueño no puede modificar su propio rol ni sus cajas administradas.');
    }

    let assignedCartelCode = current.assignedCartelCode;
    if (patch.assignedCartelId !== undefined) {
      if (patch.assignedCartelId) {
        const cSnap = await getDoc(doc(db, 'carteles', patch.assignedCartelId));
        assignedCartelCode = cSnap.exists() ? (cSnap.data() as Cartel).code : undefined;
      } else {
        assignedCartelCode = undefined;
      }
    }

    const updated: TeamMember = {
      ...current,
      ...patch,
      assignedCartelCode,
    };

    await updateDoc(
      ref,
      stripUndefined({
        ...patch,
        assignedCartelCode: assignedCartelCode || null,
      })
    );

    return updated;
  }

  async removeTeamMember(id: string): Promise<void> {
    this.assertRoleAccess(['owner', 'superadmin']);
    const ref = doc(db, 'team', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const current = snap.data() as TeamMember;
    this.assertOrganizationScope(current.businessId);

    await deleteDoc(ref);
  }

  // --- RED TOQUE Y FORMATOS DE ACTIVACIÓN (ESTILO PASITO) ---

  private getDefaultMerchantActivations(
    tenantId: string,
    merchantName: string
  ): NetworkActivation[] {
    return [
      {
        id: `act-${tenantId}-cross_benefit`,
        uuid: '40000000-0000-4000-8000-000000000001',
        tenantId,
        businessId: tenantId,
        merchantName,
        merchantCategory: 'Gastronomía & Café',
        distanceLabel: 'A 100 m',
        formatType: 'cross_benefit',
        title: '15% OFF o Café de Cortesía en tu 1ra visita',
        discountText: '15% OFF en Red Toque',
        terms: 'Presentando el ticket digital de cualquier comercio vecino adherido a la Red Toque.',
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: `act-${tenantId}-tap_challenge`,
        uuid: '40000000-0000-4000-8000-000000000002',
        tenantId,
        businessId: tenantId,
        merchantName,
        merchantCategory: 'Gastronomía & Café',
        formatType: 'tap_challenge',
        title: 'Desafío 3 Toques en 7 días: Producto Estrella Gratis',
        discountText: 'Premio sorpresa al 3er toque',
        terms: 'Escaneá el cartel Toque del mostrador en 3 visitas dentro de los últimos 7 o 30 días.',
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: `act-${tenantId}-map_pin`,
        uuid: '40000000-0000-4000-8000-000000000003',
        tenantId,
        businessId: tenantId,
        merchantName,
        merchantCategory: 'Gastronomía & Café',
        distanceLabel: 'Destacado en tu zona',
        formatType: 'map_pin',
        title: 'Pin Destacado con Promo de Bienvenida',
        discountText: '2x1 en Medialunas de Manteca',
        terms: 'Exclusivo para usuarios descubriendo locales cercanos desde Mi Billetera Toque.',
        active: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: `act-${tenantId}-receipt_banner`,
        uuid: '40000000-0000-4000-8000-000000000004',
        tenantId,
        businessId: tenantId,
        merchantName,
        merchantCategory: 'Gastronomía & Café',
        formatType: 'receipt_banner',
        title: 'Banner Post-Compra para Clientes Frecuentes',
        discountText: '$2.000 de regalo en tu próxima compra',
        terms: 'Aparece automáticamente al pie del comprobante digital para incentivar la recompra.',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  async listNetworkActivations(): Promise<NetworkActivation[]> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const biz = await this.getBusinessProfile();
    const defaults = this.getDefaultMerchantActivations(bizId, biz.name);

    try {
      const q = query(collection(db, 'network_activations'), where('tenantId', '==', bizId));
      const snap = await getDocs(q);
      const savedMap = new Map<NetworkActivationFormat, NetworkActivation>();
      snap.docs.forEach((d) => {
        const data = d.data() as NetworkActivation;
        savedMap.set(data.formatType, data);
      });

      const merged: NetworkActivation[] = [];
      for (const def of defaults) {
        const existing = savedMap.get(def.formatType);
        if (existing) {
          merged.push({
            ...def,
            ...existing,
            merchantName: existing.merchantName || biz.name,
          });
        } else {
          await setDoc(doc(db, 'network_activations', def.id), stripUndefined(def));
          merged.push(def);
        }
      }
      return merged;
    } catch {
      return defaults;
    }
  }

  async getPublicCrossBenefits(excludeBusinessId?: string): Promise<NetworkActivation[]> {
    await this.ensureBaseDataInitialized();
    try {
      const q = query(
        collection(db, 'network_activations'),
        where('formatType', '==', 'cross_benefit')
      );
      const snap = await getDocs(q);
      const activeList = snap.docs
        .map((d) => d.data() as NetworkActivation)
        .filter((a) => a.active && (!excludeBusinessId || a.tenantId !== excludeBusinessId));

      if (activeList.length >= 2) {
        return activeList.slice(0, 2);
      }
    } catch {
      // fallback
    }
    return NEIGHBOR_CROSS_BENEFITS_FALLBACK.filter(
      (a) => !excludeBusinessId || a.tenantId !== excludeBusinessId
    ).slice(0, 2);
  }

  async saveNetworkActivation(data: {
    formatType: NetworkActivationFormat;
    title: string;
    discountText: string;
    terms: string;
    active: boolean;
  }): Promise<NetworkActivation> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const bizId = this.getActiveBusinessId();
    const biz = await this.getBusinessProfile();
    const id = `act-${bizId}-${data.formatType}`;

    const activation: NetworkActivation = {
      id,
      uuid: generateUUID(),
      tenantId: bizId,
      businessId: bizId,
      merchantName: biz.name,
      merchantCategory: 'Comercio Adherido Red Toque',
      distanceLabel: 'A 150 m',
      formatType: data.formatType,
      title: sanitizeString(data.title, 120) || 'Beneficio Red Toque',
      discountText: sanitizeString(data.discountText, 120) || '15% OFF con Toque',
      terms:
        sanitizeString(data.terms, 300) ||
        'Presentando tu comprobante digital en mostrador.',
      active: Boolean(data.active),
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'network_activations', id), stripUndefined(activation));

    // Sincronizar en paralelo con Worker / D1 endpoint si está disponible
    fetch('/api/network/activations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activation),
    }).catch(() => {});

    return activation;
  }

  async toggleNetworkActivation(
    formatType: NetworkActivationFormat,
    active: boolean
  ): Promise<NetworkActivation> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const list = await this.listNetworkActivations();
    const target = list.find((a) => a.formatType === formatType) || list[0];
    return this.saveNetworkActivation({
      formatType,
      title: target.title,
      discountText: target.discountText,
      terms: target.terms,
      active,
    });
  }

  // --- BÓVEDA DEL CONSUMIDOR ("MI TOQUE") — PERSISTENCIA HÍBRIDA ---

  async syncConsumerVault(payload: {
    user: ConsumerUser;
    receipts: ConsumerReceipt[];
  }): Promise<{
    success: boolean;
    consumerId: string;
    recoveryCode: string;
    user: ConsumerUser;
    receipts: ConsumerReceipt[];
  }> {
    const cleanContact = sanitizeString(payload.user.emailOrPhone, 120).toLowerCase();
    const cleanName = sanitizeString(payload.user.displayName, 100) || 'Comprador Toque';
    const consumerId = payload.user.id || generateUUID();
    const userUuid = payload.user.uuid || ( consumerId.length === 36 ? consumerId : generateUUID() );
    const nowIso = new Date().toISOString();

    const normalizedUser: ConsumerUser = {
      id: consumerId,
      uuid: userUuid,
      emailOrPhone: cleanContact,
      displayName: cleanName,
      ageGroup: payload.user.ageGroup || 'all',
      consentSaveReceipts: payload.user.consentSaveReceipts !== false,
      consentMarketingNetwork: payload.user.consentMarketingNetwork !== false,
      createdAt: payload.user.createdAt || nowIso,
      syncedAt: nowIso,
    };

    // 1. Intentar sincronizar con el Worker de Hono / Cloudflare D1 (/api/consumer/sync)
    try {
      const res = await fetch('/api/consumer/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: normalizedUser,
          receipts: payload.receipts,
        }),
      });
      if (res.ok) {
        const d1Data = await res.json();
        if (d1Data?.user) {
          normalizedUser.id = d1Data.user.id || normalizedUser.id;
        }
      }
    } catch {
      // Continuar con respaldo en Firestore
    }

    // 2. Respaldar en Firestore (consumer_users y consumer_receipts)
    try {
      await setDoc(
        doc(db, 'consumer_users', normalizedUser.id),
        stripUndefined(normalizedUser)
      );

      for (const r of payload.receipts) {
        const cleanReceipt: ConsumerReceipt = {
          id: r.id,
          uuid: r.uuid || generateUUID(),
          consumerId: normalizedUser.id,
          tenantId: r.tenantId || 'biz-toque-1',
          merchantName: sanitizeString(r.merchantName, 100) || 'Comercio Toque',
          cartelCode: r.cartelCode,
          amountArs: Number(r.amountArs) || 0,
          discountSavedArs: Number(r.discountSavedArs) || 0,
          category: sanitizeString(r.category, 64) || 'Gastronomía',
          receiptNote: sanitizeString(r.receiptNote, 240) || 'Visita registrada con Toque',
          createdAt: r.createdAt || nowIso,
        };
        await setDoc(
          doc(db, 'consumer_receipts', cleanReceipt.id),
          stripUndefined(cleanReceipt)
        );
      }
    } catch (err) {
      console.warn('Consumer Firestore backup notice:', err);
    }

    const recoveryCode = `TQ-${normalizedUser.id.slice(0, 8).toUpperCase()}`;
    return {
      success: true,
      consumerId: normalizedUser.id,
      recoveryCode,
      user: normalizedUser,
      receipts: payload.receipts,
    };
  }

  async recoverConsumerVault(contactOrId: string): Promise<{
    found: boolean;
    user?: ConsumerUser;
    receipts?: ConsumerReceipt[];
  }> {
    const clean = sanitizeString(contactOrId, 120).toLowerCase();
    if (!clean) return { found: false };

    // 1. Intentar recuperar desde el Worker / D1
    try {
      const res = await fetch(`/api/consumer/sync?contact=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.found && data?.user) {
          return {
            found: true,
            user: data.user,
            receipts: data.receipts || [],
          };
        }
      }
    } catch {
      // Fallback a Firestore
    }

    // 2. Buscar en Firestore por emailOrPhone o id
    try {
      const q = query(
        collection(db, 'consumer_users'),
        where('emailOrPhone', '==', clean)
      );
      const snap = await getDocs(q);
      let foundUser: ConsumerUser | undefined;

      if (!snap.empty) {
        foundUser = snap.docs[0].data() as ConsumerUser;
      } else {
        const directSnap = await getDoc(doc(db, 'consumer_users', contactOrId.trim()));
        if (directSnap.exists()) {
          foundUser = directSnap.data() as ConsumerUser;
        }
      }

      if (foundUser) {
        const rSnap = await getDocs(
          query(
            collection(db, 'consumer_receipts'),
            where('consumerId', '==', foundUser.id)
          )
        );
        const receipts = rSnap.docs
          .map((d) => d.data() as ConsumerReceipt)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return {
          found: true,
          user: foundUser,
          receipts,
        };
      }
    } catch {
      // ignore
    }

    return { found: false };
  }

  // --- MERCADO PAGO ---

  async getMercadoPagoStatus(): Promise<MercadoPagoStatus> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const snap = await getDoc(doc(db, 'businesses', bizId));
    if (snap.exists() && snap.data().mpStatus) {
      return snap.data().mpStatus as MercadoPagoStatus;
    }
    return { connected: false };
  }

  async connectMercadoPago(): Promise<{ connected: boolean }> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const bizId = this.getActiveBusinessId();
    const mpStatus: MercadoPagoStatus = {
      connected: true,
      collectorId: `MP-${Math.floor(10000000 + Math.random() * 90000000)}`,
      connectedAt: new Date().toISOString(),
    };
    await updateDoc(doc(db, 'businesses', bizId), stripUndefined({ mpStatus }));
    return { connected: true };
  }

  async disconnectMercadoPago(): Promise<{ connected: boolean }> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const bizId = this.getActiveBusinessId();
    await updateDoc(doc(db, 'businesses', bizId), {
      mpStatus: { connected: false },
    });
    return { connected: false };
  }

  // --- RESUMEN DEL PANEL (100% DATOS REALES, CERO INVENTADOS) ---

  async getDashboardSummary(): Promise<DashboardSummary> {
    this.assertRoleAccess(['owner', 'manager', 'cashier', 'superadmin']);
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const isCashier = this.currentUser?.role === 'cashier';

    const safeGetDocs = async (q: ReturnType<typeof query>) => {
      try {
        return await getDocs(q);
      } catch {
        return { docs: [] as any[] };
      }
    };

    const [salesSnap, receiptsSnap, membersSnap, cartelesSnap, teamSnap] = await Promise.all([
      safeGetDocs(query(collection(db, 'sales'), where('businessId', '==', bizId))),
      safeGetDocs(query(collection(db, 'receipts'), where('businessId', '==', bizId))),
      safeGetDocs(query(collection(db, 'members'), where('businessId', '==', bizId))),
      safeGetDocs(query(collection(db, 'carteles'), where('businessId', '==', bizId))),
      safeGetDocs(query(collection(db, 'team'), where('businessId', '==', bizId))),
    ]);

    const sales = salesSnap.docs.map((d: any) => d.data() as Sale);
    const receipts = receiptsSnap.docs.map((d: any) => d.data() as Receipt);
    const members = membersSnap.docs.map((d: any) => d.data() as ClubMember);
    const carteles = cartelesSnap.docs.map((d: any) => d.data() as Cartel);
    const team = teamSnap.docs
      .map((d: any) => d.data() as TeamMember)
      .filter((m: TeamMember) => m.status === 'active');

    const todayStr = new Date().toDateString();
    const sevenDaysAgo = Date.now() - 7 * 86400000;

    const paidSales = sales.filter((s: Sale) => s.status === 'paid');
    const todaySales = paidSales.filter(
      (s: Sale) => new Date(s.createdAt).toDateString() === todayStr
    );
    const weeklySales = paidSales.filter(
      (s: Sale) => new Date(s.createdAt).getTime() >= sevenDaysAgo
    );

    const currentEmail = (this.currentUser?.email || '').toLowerCase();
    const currentName = (this.currentUser?.name || '').toLowerCase();
    const isMySale = (s: Sale) => {
      const matchEmail = Boolean(
        currentEmail && s.cashierEmail && s.cashierEmail.toLowerCase() === currentEmail
      );
      const matchName = Boolean(
        currentName && s.cashierName && s.cashierName.toLowerCase() === currentName
      );
      return matchEmail || matchName;
    };

    const myTodaySalesCount = todaySales.filter(isMySale).length;
    const myWeeklySalesCount = weeklySales.filter(isMySale).length;

    const mySaleIds = new Set(paidSales.filter(isMySale).map((s) => s.id));
    const todayClaimedReceiptsCount = receipts.filter(
      (r: Receipt) =>
        r.status === 'claimed' && new Date(r.createdAt).toDateString() === todayStr
    ).length;
    const myClaimedReceiptsCount = receipts.filter(
      (r: Receipt) => r.status === 'claimed' && mySaleIds.has(r.saleId)
    ).length;

    const todaySalesAmount = isCashier
      ? 0
      : todaySales.reduce((acc: number, s: Sale) => acc + s.amount, 0);
    const weeklySalesAmount = isCashier
      ? 0
      : weeklySales.reduce((acc: number, s: Sale) => acc + s.amount, 0);

    const claimedReceiptsCount = receipts.filter((r: Receipt) => r.status === 'claimed').length;
    const walletPassesCount = members.filter((m: ClubMember) =>
      Boolean(m.passId || m.appleWalletUrl || m.googleWalletUrl || m.walletPassUrl)
    ).length;

    const scansCount = carteles.reduce((acc: number, c: Cartel) => acc + (c.scansCount || 0), 0);
    const reviewButtonClicks = carteles.reduce(
      (acc: number, c: Cartel) => acc + (c.reviewClicksCount || 0),
      0
    );

    const nonTrashCarteles = carteles.filter((c: Cartel) => c.status !== 'trash');
    const activeCartelesCount = nonTrashCarteles.filter((c: Cartel) => c.status === 'active').length;
    const recentSales = [...sales]
      .sort((a: Sale, b: Sale) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 200);

    return {
      todaySalesAmount,
      todaySalesCount: todaySales.length,
      weeklySalesAmount,
      weeklySalesCount: weeklySales.length,
      myTodaySalesCount,
      myWeeklySalesCount,
      todayClaimedReceiptsCount,
      myClaimedReceiptsCount,
      totalReceiptsCount: receipts.length,
      claimedReceiptsCount,
      newClubMembersCount: isCashier ? 0 : members.length,
      clubMembersCount: isCashier ? 0 : members.length,
      walletPassesCount: isCashier ? 0 : walletPassesCount,
      scansCount,
      reviewButtonClicks,
      teamMembersCount: Math.max(1, team.length),
      activeCartelesCount,
      totalCartelesCount: nonTrashCarteles.length,
      recentSales,
    };
  }

  // --- PERFIL DEL NEGOCIO ---

  async getBusinessProfile(): Promise<BusinessProfile> {
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    try {
      const snap = await getDoc(doc(db, 'businesses', bizId));
      if (snap.exists()) {
        const d = snap.data();
        return {
          id: d.id,
          uuid: d.uuid,
          name: d.name,
          ownerName: d.ownerName,
          email: d.email,
          reviewUrl: d.reviewUrl,
          planPaid: Boolean(d.planPaid || d.hubConfig?.planPaid),
          networkEnabled: Boolean(d.networkEnabled || d.hubConfig?.networkEnabled),
          createdAt: d.createdAt,
          scansCount: d.scansCount || 0,
          reviewClicksCount: d.reviewClicksCount || 0,
        };
      }
    } catch {
      // fallback
    }
    return {
      id: bizId,
      uuid: '10000000-0000-4000-8000-000000000001',
      name: 'Café & Panadería La Esquina',
      ownerName: 'Martín Gómez',
      email: 'comercio@toque.ar',
      reviewUrl: 'https://maps.google.com',
      planPaid: false,
      networkEnabled: false,
      createdAt: new Date().toISOString(),
      scansCount: 0,
      reviewClicksCount: 0,
    };
  }

  async updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile> {
    this.assertRoleAccess(['owner', 'superadmin']);
    const bizId = this.getActiveBusinessId();
    const cleanPatch: Record<string, any> = {};
    if (patch.name !== undefined) cleanPatch.name = sanitizeString(patch.name, 100);
    if (patch.reviewUrl !== undefined) cleanPatch.reviewUrl = sanitizeString(patch.reviewUrl, 300);
    if (patch.ownerName !== undefined) cleanPatch.ownerName = sanitizeString(patch.ownerName, 100);
    if (patch.planPaid !== undefined) cleanPatch.planPaid = Boolean(patch.planPaid);
    if (patch.networkEnabled !== undefined) cleanPatch.networkEnabled = Boolean(patch.networkEnabled);

    await updateDoc(doc(db, 'businesses', bizId), stripUndefined(cleanPatch));
    return this.getBusinessProfile();
  }

  // --- SUPER ADMIN GLOBAL DE LA PLATAFORMA (SOLO NIVEL SUPERADMIN) ---

  async getSuperAdminSummary(): Promise<SuperAdminSummary> {
    this.assertRoleAccess(['superadmin']);
    await this.ensureBaseDataInitialized();

    const [bizSnap, cartelesSnap, salesSnap, receiptsSnap, membersSnap, teamSnap] =
      await Promise.all([
        getDocs(collection(db, 'businesses')),
        getDocs(collection(db, 'carteles')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'receipts')),
        getDocs(collection(db, 'members')),
        getDocs(collection(db, 'team')),
      ]);

    const businessesRaw = bizSnap.docs.map((d) => d.data() as BusinessProfile);
    const carteles = cartelesSnap.docs
      .map((d) => d.data() as Cartel)
      .filter((c) => c.status !== 'trash');
    const sales = salesSnap.docs
      .map((d) => d.data() as Sale)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const receipts = receiptsSnap.docs.map((d) => d.data() as Receipt);
    const members = membersSnap.docs.map((d) => d.data() as ClubMember);
    const team = teamSnap.docs
      .map((d) => d.data() as TeamMember)
      .filter((t) => t.status === 'active');

    const paidSales = sales.filter((s) => s.status === 'paid');
    const totalSalesAmount = paidSales.reduce((acc, s) => acc + s.amount, 0);
    const claimedReceiptsCount = receipts.filter((r) => r.status === 'claimed').length;
    const walletPassesIssued = members.filter((m) =>
      Boolean(m.passId || m.appleWalletUrl || m.googleWalletUrl || m.walletPassUrl)
    ).length;
    const totalScansCount = carteles.reduce((acc, c) => acc + (c.scansCount || 0), 0);
    const totalReviewClicks = carteles.reduce((acc, c) => acc + (c.reviewClicksCount || 0), 0);

    const businesses = businessesRaw.map((b) => {
      const bCarteles = carteles.filter((c) => c.businessId === b.id);
      const bSales = paidSales.filter((s) => s.businessId === b.id);
      const bMembers = members.filter((m) => m.businessId === b.id);
      const bTeam = team.filter((t) => t.businessId === b.id);

      return {
        ...b,
        cartelesCount: bCarteles.length,
        salesCount: bSales.length,
        salesAmount: bSales.reduce((acc, s) => acc + s.amount, 0),
        membersCount: bMembers.length,
        teamCount: bTeam.length,
      };
    });

    return {
      totalBusinesses: businesses.length,
      totalCarteles: carteles.length,
      activeCarteles: carteles.filter((c) => c.status === 'active').length,
      totalSalesCount: paidSales.length,
      totalSalesAmount,
      totalReceiptsEmitted: receipts.length,
      claimedReceiptsCount,
      totalClubMembers: members.length,
      walletPassesIssued,
      totalScansCount,
      totalReviewClicks,
      businesses,
      carteles,
      recentSales: sales.slice(0, 20),
    };
  }
}

export const firestoreApi = new FirestoreToqueApi();
