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
  BusinessProfile,
  CartelRole,
  HubMode,
  PaymentMethod,
  SaleItem,
  TeamMember,
  WalletPassResponse,
  SuperAdminSummary,
  UserRole,
} from './types';

const SUPERADMIN_EMAIL = 'fedeeeloiss@gmail.com';
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
      description: 'Pan de masa madre horneado en el día',
    },
  ],
  details: {
    address: 'Av. Corrientes 1450, CABA',
    hours: 'Lunes a Sábado de 07:30 a 20:00 h',
    phone: '+54 11 4371-2233',
  },
  showToqueFooter: true,
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
        this.currentUser = JSON.parse(raw);
      } else {
        this.currentUser = {
          id: 'user-owner-default',
          email: 'comercio@toque.ar',
          name: 'Martín Gómez',
          businessId: 'biz-toque-1',
          role: 'owner',
          isSuperAdmin: false,
        };
      }
    } catch {
      this.currentUser = {
        id: 'user-owner-default',
        email: 'comercio@toque.ar',
        name: 'Martín Gómez',
        businessId: 'biz-toque-1',
        role: 'owner',
        isSuperAdmin: false,
      };
    }
  }

  private saveSession(user: User | null) {
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

  private assertRoleAccess(allowedRoles: UserRole[]) {
    if (!this.currentUser) {
      throw new Error('RLS: Debés iniciar sesión para realizar esta operación.');
    }
    if (this.currentUser.isSuperAdmin || this.currentUser.role === 'superadmin') {
      return;
    }
    if (!allowedRoles.includes(this.currentUser.role)) {
      throw new Error('RLS: Tu rol actual no tiene permisos para realizar esta acción.');
    }
  }

  private async ensureBaseDataInitialized(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        const defaultBizRef = doc(db, 'businesses', 'biz-toque-1');
        const bizSnap = await getDoc(defaultBizRef);
        if (!bizSnap.exists()) {
          const nowIso = new Date().toISOString();
          await setDoc(
            defaultBizRef,
            stripUndefined({
              id: 'biz-toque-1',
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
          );
        }

        const cajaRef = doc(db, 'carteles', 'cartel-caja-1');
        const cajaSnap = await getDoc(cajaRef);
        if (!cajaSnap.exists()) {
          const nowIso = new Date().toISOString();
          await setDoc(
            cajaRef,
            stripUndefined({
              id: 'cartel-caja-1',
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
          );
        }

        const demoRef = doc(db, 'carteles', 'cartel-demo-1');
        const demoSnap = await getDoc(demoRef);
        if (!demoSnap.exists()) {
          const nowIso = new Date().toISOString();
          await setDoc(
            demoRef,
            stripUndefined({
              id: 'cartel-demo-1',
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
          );
        }

        const ownerTeamRef = doc(db, 'team', 'team-owner-default');
        const ownerTeamSnap = await getDoc(ownerTeamRef);
        if (!ownerTeamSnap.exists()) {
          await setDoc(
            ownerTeamRef,
            stripUndefined({
              id: 'team-owner-default',
              businessId: 'biz-toque-1',
              name: 'Martín Gómez',
              email: 'comercio@toque.ar',
              role: 'owner',
              assignedCartelId: 'cartel-caja-1',
              assignedCartelCode: 'CAJA01',
              status: 'active',
              addedAt: new Date().toISOString(),
            })
          );
        }
      } catch (err) {
        console.warn('Firestore initialization notice:', err);
      }
    })();
    return this.initPromise;
  }

  private getActiveBusinessId(): string {
    return this.currentUser?.businessId || 'biz-toque-1';
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
    const cartelId = `cartel-${Date.now().toString(36)}`;
    const randomSuffix = Math.floor(10 + Math.random() * 89);
    const cartelCode = `CAJA${randomSuffix}`;

    const isSuper = cleanEmail === SUPERADMIN_EMAIL;
    const user: User = {
      id: auth.currentUser?.uid || `user-${Date.now().toString(36)}`,
      email: cleanEmail,
      name: cleanOwnerName,
      businessId: bizId,
      role: isSuper ? 'superadmin' : 'owner',
      assignedCartelId: cartelId,
      assignedCartelCode: cartelCode,
      isSuperAdmin: isSuper,
    };

    await setDoc(
      doc(db, 'businesses', bizId),
      stripUndefined({
        id: bizId,
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

    this.saveSession(user);
    return { user, token: `rls-token-${user.id}` };
  }

  async login(credentials: {
    email: string;
    password?: string;
    isGoogle?: boolean;
  }): Promise<{ user: User; token: string }> {
    await this.ensureBaseDataInitialized();

    let cleanEmail = sanitizeString(credentials.email, 120).toLowerCase();
    let displayName = '';
    let uid = '';

    if (credentials.isGoogle) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user?.email) {
          cleanEmail = result.user.email.toLowerCase();
          displayName = result.user.displayName || cleanEmail.split('@')[0];
          uid = result.user.uid;
        }
      } catch {
        if (!cleanEmail) cleanEmail = 'comercio@toque.ar';
      }
    }

    if (!cleanEmail) {
      cleanEmail = 'comercio@toque.ar';
    }

    const isSuper = cleanEmail === SUPERADMIN_EMAIL;

    // 1. Buscar en la colección team si es colaborador o dueño registrado
    const teamQuery = query(collection(db, 'team'), where('email', '==', cleanEmail));
    const teamSnap = await getDocs(teamQuery);
    const activeTeamDoc = teamSnap.docs
      .map((d) => d.data() as TeamMember)
      .find((m) => m.status === 'active');

    if (activeTeamDoc) {
      const user: User = {
        id: uid || `user-${activeTeamDoc.id}`,
        email: cleanEmail,
        name: displayName || activeTeamDoc.name,
        businessId: activeTeamDoc.businessId,
        role: isSuper ? 'superadmin' : activeTeamDoc.role,
        assignedCartelId: activeTeamDoc.assignedCartelId,
        assignedCartelCode: activeTeamDoc.assignedCartelCode,
        isSuperAdmin: isSuper,
      };
      this.saveSession(user);
      return { user, token: `rls-token-${user.id}` };
    }

    // 2. Buscar si es dueño de un comercio existente en businesses
    const bizQuery = query(collection(db, 'businesses'), where('email', '==', cleanEmail));
    const bizSnap = await getDocs(bizQuery);
    if (!bizSnap.empty) {
      const bizData = bizSnap.docs[0].data() as BusinessProfile;
      const user: User = {
        id: uid || `user-${bizData.id}`,
        email: cleanEmail,
        name: displayName || bizData.ownerName || 'Dueño',
        businessId: bizData.id,
        role: isSuper ? 'superadmin' : 'owner',
        isSuperAdmin: isSuper,
      };
      this.saveSession(user);
      return { user, token: `rls-token-${user.id}` };
    }

    // 3. Si es el Super Admin o un usuario nuevo que ingresa directamente
    const user: User = {
      id: uid || `user-${Date.now().toString(36)}`,
      email: cleanEmail,
      name: displayName || (isSuper ? 'Super Admin Toque' : cleanEmail.split('@')[0]),
      businessId: 'biz-toque-1',
      role: isSuper ? 'superadmin' : 'owner',
      isSuperAdmin: isSuper,
    };
    this.saveSession(user);
    return { user, token: `rls-token-${user.id}` };
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
    await this.ensureBaseDataInitialized();
    if (!this.currentUser) return null;

    try {
      const cleanEmail = this.currentUser.email.toLowerCase();
      const isSuper = cleanEmail === SUPERADMIN_EMAIL;
      const teamQuery = query(collection(db, 'team'), where('email', '==', cleanEmail));
      const snap = await getDocs(teamQuery);
      const activeMember = snap.docs
        .map((d) => d.data() as TeamMember)
        .find((m) => m.status === 'active');

      if (activeMember) {
        const updatedUser: User = {
          ...this.currentUser,
          name: activeMember.name || this.currentUser.name,
          businessId: activeMember.businessId,
          role: isSuper ? 'superadmin' : activeMember.role,
          assignedCartelId: activeMember.assignedCartelId,
          assignedCartelCode: activeMember.assignedCartelCode,
          isSuperAdmin: isSuper,
        };
        this.saveSession(updatedUser);
      } else if (isSuper) {
        this.currentUser.isSuperAdmin = true;
        this.currentUser.role = 'superadmin';
      }
    } catch {
      // conservar sesión local
    }

    return this.currentUser;
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

    const updatedCartel: Cartel = {
      ...cartel,
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
    if (
      current.businessId &&
      current.businessId !== this.getActiveBusinessId() &&
      !this.currentUser?.isSuperAdmin
    ) {
      throw new Error('RLS: No tenés permiso para editar un cartel de otro comercio.');
    }

    const updated: Cartel = {
      ...current,
      ...patch,
    };
    await updateDoc(ref, stripUndefined(patch as Record<string, any>));
    return updated;
  }

  // --- HUB DEL NEGOCIO ---

  async getHubConfig(): Promise<HubConfig> {
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const snap = await getDoc(doc(db, 'businesses', bizId));
    if (snap.exists()) {
      const data = snap.data();
      if (data.hubConfig) {
        return {
          ...DEFAULT_HUB_CONFIG,
          ...data.hubConfig,
          googleReviewUrl: data.hubConfig.googleReviewUrl || data.reviewUrl || 'https://maps.google.com',
        };
      }
    }
    return { ...DEFAULT_HUB_CONFIG };
  }

  async updateHubConfig(patch: Partial<HubConfig>): Promise<HubConfig> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const bizId = this.getActiveBusinessId();
    const current = await this.getHubConfig();
    const next: HubConfig = {
      ...current,
      ...patch,
    };
    await updateDoc(
      doc(db, 'businesses', bizId),
      stripUndefined({
        hubConfig: next,
      })
    );
    return next;
  }

  // --- HUB PÚBLICO DEL CLIENTE Y SINCRONIZACIÓN EN TIEMPO REAL ---

  private async buildPublicHubFromCartel(cartel: Cartel): Promise<PublicHub> {
    const bizId = cartel.businessId || 'biz-toque-1';
    const bizSnap = await getDoc(doc(db, 'businesses', bizId));
    const bizData = bizSnap.exists() ? bizSnap.data() : null;

    const hubConfig: HubConfig = bizData?.hubConfig || DEFAULT_HUB_CONFIG;
    const clubConfig: ClubConfig = bizData?.clubConfig || DEFAULT_CLUB_CONFIG;
    const businessName = bizData?.name || 'Comercio Toque';
    const reviewUrl = cartel.reviewUrl || bizData?.reviewUrl || 'https://maps.google.com';

    let activeReceipt: Receipt | null = null;
    const now = Date.now();

    if (
      cartel.activeReceiptId &&
      cartel.activeReceiptExpiresAt &&
      new Date(cartel.activeReceiptExpiresAt).getTime() > now
    ) {
      const rcpSnap = await getDoc(doc(db, 'receipts', cartel.activeReceiptId));
      if (rcpSnap.exists()) {
        const rcp = rcpSnap.data() as Receipt;
        if (rcp.status !== 'cancelled' && new Date(rcp.expiresAt).getTime() > now) {
          activeReceipt = rcp;
        }
      }
    }

    if (!activeReceipt) {
      const rcpQ = query(
        collection(db, 'receipts'),
        where('cartelCode', '==', cartel.code.toUpperCase())
      );
      const rcpListSnap = await getDocs(rcpQ);
      const candidates = rcpListSnap.docs
        .map((d) => d.data() as Receipt)
        .filter((r) => r.status !== 'cancelled' && new Date(r.expiresAt).getTime() > now)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (candidates.length > 0) {
        activeReceipt = candidates[0];
      }
    }

    return {
      business: {
        id: bizId,
        name: businessName,
        logoUrl: hubConfig.logoUrl,
      },
      cartel: {
        id: cartel.id,
        code: cartel.code,
        name: cartel.name,
        role: cartel.role,
        status: cartel.status,
        mode: cartel.mode,
      },
      reviewUrl,
      blocks: hubConfig.blocks,
      receipt: activeReceipt,
      club: clubConfig.active
        ? {
            config: clubConfig,
            member: null,
          }
        : null,
      config: hubConfig,
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
    const nowIso = new Date().toISOString();

    if (receipt.status === 'ready') {
      await updateDoc(ref, {
        status: 'claimed',
        claimedAt: nowIso,
      });
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
        brandColor: '#bec8ff',
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
        name: sanitizeString(data.name, 80) || existing.name,
        points: nextPoints,
        stamps: nextPoints,
      };
      await updateDoc(
        doc(db, 'members', existing.id),
        stripUndefined({
          name: member.name || '',
          points: nextPoints,
          stamps: nextPoints,
        })
      );
    } else {
      const memberId = `mem-${Date.now().toString(36)}`;
      member = {
        id: memberId,
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

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const shortRand = Math.floor(1000 + Math.random() * 9000);
    const receiptId = `RCP-${cartel.code}-${shortRand}`;

    const receipt: Receipt = {
      id: receiptId,
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

    await setDoc(doc(db, 'receipts', receiptId), stripUndefined(receipt));

    await updateDoc(doc(db, 'carteles', cartel.id), {
      activeReceiptId: receipt.id,
      activeReceiptExpiresAt: receipt.expiresAt,
    });

    await updateDoc(doc(db, 'sales', sale.id), {
      receiptId: receipt.id,
    });

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
    const bizId = cartel.businessId || this.getActiveBusinessId();
    const saleId = `sale-${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();
    const isManual = data.method === 'cash' || data.method === 'card_manual';

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

    const sale: Sale = {
      id: saleId,
      businessId: bizId,
      cartelId: cartel.id,
      cartelCode: cartel.code,
      cartelName: cartel.name,
      amount: data.amount,
      currency: 'ARS',
      items,
      method: data.method,
      status: isManual ? 'paid' : 'pending',
      createdAt: nowIso,
      paidAt: isManual ? nowIso : undefined,
      cashierName: this.currentUser?.name || 'Cajero',
      cashierEmail: this.currentUser?.email || '',
    };

    await setDoc(doc(db, 'sales', saleId), stripUndefined(sale));

    let receipt: Receipt | undefined;
    if (isManual) {
      receipt = await this.emitReceiptForSale(sale, cartel);
      sale.receiptId = receipt.id;
    }

    const qrData =
      data.method === 'mp_qr'
        ? `${window.location.origin}/h/${cartel.code}?sale=${sale.id}&amount=${data.amount}`
        : undefined;

    return { sale, qrData, receipt };
  }

  async getSale(id: string): Promise<Sale> {
    const snap = await getDoc(doc(db, 'sales', id));
    if (!snap.exists()) throw new Error('Venta no encontrada.');
    return snap.data() as Sale;
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
    const nowIso = new Date().toISOString();

    const cartelSnap = await getDoc(doc(db, 'carteles', sale.cartelId));
    const cartel = cartelSnap.exists()
      ? (cartelSnap.data() as Cartel)
      : ({
          id: sale.cartelId,
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
    const members = await this.listClubMembers();
    const header = 'ID,Nombre,Contacto,Puntos,Fecha Alta,Pase Wallet\n';
    const rows = members
      .map(
        (m) =>
          `"${m.id}","${(m.name || 'Cliente Toque').replace(/"/g, '""')}","${m.contact.replace(
            /"/g,
            '""'
          )}",${m.points},"${m.joinedAt}","${m.walletPassUrl || ''}"`
      )
      .join('\n');
    return header + rows;
  }

  async deleteClubMember(id: string): Promise<void> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    await deleteDoc(doc(db, 'members', id));
  }

  // --- EQUIPO Y COLABORADORES (RLS) ---

  async listTeamMembers(): Promise<TeamMember[]> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
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
    email: string;
    role: 'owner' | 'manager' | 'cashier';
    assignedCartelId?: string;
  }): Promise<TeamMember> {
    this.assertRoleAccess(['owner', 'superadmin']);
    await this.ensureBaseDataInitialized();

    const cleanName = sanitizeString(data.name, 80);
    const cleanEmail = sanitizeString(data.email, 120).toLowerCase();
    if (!cleanName || !cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Ingresá un nombre y correo electrónico válidos.');
    }

    const bizId = this.getActiveBusinessId();
    let assignedCartelCode: string | undefined;
    if (data.assignedCartelId) {
      const cSnap = await getDoc(doc(db, 'carteles', data.assignedCartelId));
      if (cSnap.exists()) {
        assignedCartelCode = (cSnap.data() as Cartel).code;
      }
    }

    const existingQ = query(
      collection(db, 'team'),
      where('businessId', '==', bizId)
    );
    const existingSnap = await getDocs(existingQ);
    const duplicate = existingSnap.docs
      .map((d) => d.data() as TeamMember)
      .find((m) => m.email.toLowerCase() === cleanEmail && m.status === 'active');

    if (duplicate) {
      throw new Error('Ese correo ya forma parte del equipo de este comercio.');
    }

    const id = `team-${Date.now().toString(36)}`;
    const member: TeamMember = {
      id,
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
    if (current.businessId !== this.getActiveBusinessId() && !this.currentUser?.isSuperAdmin) {
      throw new Error('RLS: No tenés permisos sobre este colaborador.');
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
    if (current.businessId !== this.getActiveBusinessId() && !this.currentUser?.isSuperAdmin) {
      throw new Error('RLS: No tenés permisos para eliminar este colaborador.');
    }

    await deleteDoc(ref);
  }

  // --- MERCADO PAGO ---

  async getMercadoPagoStatus(): Promise<MercadoPagoStatus> {
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
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();

    const [salesSnap, receiptsSnap, membersSnap, cartelesSnap, teamSnap] = await Promise.all([
      getDocs(query(collection(db, 'sales'), where('businessId', '==', bizId))),
      getDocs(query(collection(db, 'receipts'), where('businessId', '==', bizId))),
      getDocs(query(collection(db, 'members'), where('businessId', '==', bizId))),
      getDocs(query(collection(db, 'carteles'), where('businessId', '==', bizId))),
      getDocs(query(collection(db, 'team'), where('businessId', '==', bizId))),
    ]);

    const sales = salesSnap.docs.map((d) => d.data() as Sale);
    const receipts = receiptsSnap.docs.map((d) => d.data() as Receipt);
    const members = membersSnap.docs.map((d) => d.data() as ClubMember);
    const carteles = cartelesSnap.docs.map((d) => d.data() as Cartel);
    const team = teamSnap.docs
      .map((d) => d.data() as TeamMember)
      .filter((m) => m.status === 'active');

    const todayStr = new Date().toDateString();
    const sevenDaysAgo = Date.now() - 7 * 86400000;

    const paidSales = sales.filter((s) => s.status === 'paid');
    const todaySales = paidSales.filter((s) => new Date(s.createdAt).toDateString() === todayStr);
    const weeklySales = paidSales.filter((s) => new Date(s.createdAt).getTime() >= sevenDaysAgo);

    const todaySalesAmount = todaySales.reduce((acc, s) => acc + s.amount, 0);
    const weeklySalesAmount = weeklySales.reduce((acc, s) => acc + s.amount, 0);

    const claimedReceiptsCount = receipts.filter((r) => r.status === 'claimed').length;
    const walletPassesCount = members.filter((m) =>
      Boolean(m.passId || m.appleWalletUrl || m.googleWalletUrl || m.walletPassUrl)
    ).length;

    const scansCount = carteles.reduce((acc, c) => acc + (c.scansCount || 0), 0);
    const reviewButtonClicks = carteles.reduce((acc, c) => acc + (c.reviewClicksCount || 0), 0);

    return {
      todaySalesAmount,
      todaySalesCount: todaySales.length,
      weeklySalesAmount,
      weeklySalesCount: weeklySales.length,
      totalReceiptsCount: receipts.length,
      claimedReceiptsCount,
      newClubMembersCount: members.length,
      walletPassesCount,
      scansCount,
      reviewButtonClicks,
      teamMembersCount: team.length,
    };
  }

  // --- PERFIL DEL NEGOCIO ---

  async getBusinessProfile(): Promise<BusinessProfile> {
    await this.ensureBaseDataInitialized();
    const bizId = this.getActiveBusinessId();
    const snap = await getDoc(doc(db, 'businesses', bizId));
    if (snap.exists()) {
      const d = snap.data();
      return {
        id: d.id,
        name: d.name,
        ownerName: d.ownerName,
        email: d.email,
        reviewUrl: d.reviewUrl,
        createdAt: d.createdAt,
        scansCount: d.scansCount || 0,
        reviewClicksCount: d.reviewClicksCount || 0,
      };
    }
    return {
      id: bizId,
      name: 'Café & Panadería La Esquina',
      ownerName: 'Martín Gómez',
      email: 'comercio@toque.ar',
      reviewUrl: 'https://maps.google.com',
      createdAt: new Date().toISOString(),
      scansCount: 0,
      reviewClicksCount: 0,
    };
  }

  async updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile> {
    this.assertRoleAccess(['owner', 'manager', 'superadmin']);
    const bizId = this.getActiveBusinessId();
    const cleanPatch: Record<string, any> = {};
    if (patch.name !== undefined) cleanPatch.name = sanitizeString(patch.name, 100);
    if (patch.reviewUrl !== undefined) cleanPatch.reviewUrl = sanitizeString(patch.reviewUrl, 300);
    if (patch.ownerName !== undefined) cleanPatch.ownerName = sanitizeString(patch.ownerName, 100);

    await updateDoc(doc(db, 'businesses', bizId), stripUndefined(cleanPatch));
    return this.getBusinessProfile();
  }

  // --- SUPER ADMIN GLOBAL DE LA PLATAFORMA (100% DATOS REALES) ---

  async getSuperAdminSummary(): Promise<SuperAdminSummary> {
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
