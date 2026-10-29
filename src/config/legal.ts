/**
 * Toque — Textos Legales, Políticas, Términos y Consentimientos (República Argentina)
 * Cumple con Ley 25.326 (Protección de Datos Personales / AAIP) y Ley 24.240 (Defensa del Consumidor).
 */

export type LegalDocKey = 'terminos' | 'privacidad' | 'cookies' | 'reembolso';

export interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocument {
  key: LegalDocKey;
  slug: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  normativeBadge: string;
  summaryPoints: string[];
  sections: LegalSection[];
}

export const CLARITY_PROJECT_ID = 'ywqriqpjun';

export interface ConsentPreferences {
  essential: boolean;
  analyticsClarity: boolean;
  updatedAt: string;
}

// Estado de consentimiento en memoria + cookie técnica de primera parte (toque_cookie_consent, 180 días)
let memoryConsentPrefs: ConsentPreferences | null = null;

function readConsentCookie(): ConsentPreferences | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('toque_cookie_consent='));
  if (!match) return null;
  const value = match.split('=')[1];
  if (value === 'all' || value === 'essential') {
    return {
      essential: true,
      analyticsClarity: value === 'all',
      updatedAt: new Date().toISOString(),
    };
  }
  return null;
}

function applyClarityConsentState(analyticsClarity: boolean): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const w = window as unknown as {
    clarity?: (...args: any[]) => void;
    __loadToqueClarity?: () => void;
  };

  if (analyticsClarity) {
    if (typeof w.__loadToqueClarity === 'function') {
      w.__loadToqueClarity();
    }
    if (typeof w.clarity === 'function') {
      w.clarity('consent', true);
    }
  } else {
    if (typeof w.clarity === 'function') {
      try {
        w.clarity('consent', false);
        w.clarity('stop');
      } catch {
        // Ignorar si clarity aún no inicializó
      }
    }
    document.cookie = '_clck=; Max-Age=0; path=/; SameSite=Lax';
    document.cookie = '_clsk=; Max-Age=0; path=/; SameSite=Lax';
  }
}

export const LEGAL_DOCUMENTS: Record<LegalDocKey, LegalDocument> = {
  terminos: {
    key: 'terminos',
    slug: '/terminos',
    title: 'Términos y Condiciones de Uso',
    subtitle:
      'Condiciones aplicables al uso del Smart Hub, Tarjeta de Sellos Digital, Carteles QR/NFC de mostrador y cuentas de clientes y comercios.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Ley 24.240 · Código Civil y Comercial de la Nación',
    summaryPoints: [
      'El ingreso y alta de tarjeta con datos funciona mediante código de verificación enviado por correo electrónico.',
      'Los roles del equipo (Dueño, Encargado y Cajero) tienen permisos diferenciados; el Cajero opera desde el POS local sin acceso fuera del comercio.',
      'Toda anulación o ajuste realizado por un Dueño o Encargado exige un motivo obligatorio y queda asentado en el registro inmutable de Correcciones.',
      'Si vence la suscripción del comercio, el Cartel QR y las tarjetas de los clientes siguen funcionando.',
    ],
    sections: [
      {
        title: '1. Objeto del servicio Toque',
        paragraphs: [
          'Toque brinda una plataforma de Carteles QR + NFC, Comprobantes Digitales y Fidelización por Tarjeta de Sellos Digital para comercios en la República Argentina. Permite que los clientes sumen sellos en sus visitas, reciban su comprobante digital y canjeen premios desde su celular sin instalar aplicaciones.',
        ],
      },
      {
        title: '2. Verificación por correo electrónico',
        paragraphs: [
          'Cada alta de tarjeta nominada o ingreso se valida mediante un código numérico enviado al correo electrónico del titular, con vencimiento a los 10 minutos y de uso único.',
        ],
      },
      {
        title: '3. Roles del equipo y registro de Correcciones',
        paragraphs: [
          'El Dueño del comercio puede crear perfiles de Dueño, Encargado o Cajero y asignarlos a su local.',
          'El Cajero opera la pantalla de Caja POS y Escanear dentro del comercio sin necesidad de correo externo. Las anulaciones o ajustes de saldo requieren rol de Encargado o Dueño y un motivo obligatorio de al menos 10 caracteres que queda guardado en Correcciones.',
        ],
      },
    ],
  },

  privacidad: {
    key: 'privacidad',
    slug: '/privacidad',
    title: 'Política de Privacidad y Protección de Datos',
    subtitle:
      'Inventario transparente de datos y protección bajo la Ley 25.326 de Protección de los Datos Personales.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Ley 25.326 · Agencia de Acceso a la Información Pública (AAIP)',
    summaryPoints: [
      'Para activar la tarjeta de sellos digital con datos pedimos tu correo electrónico verificado, nombre y opcionalmente día y mes de cumpleaños (sin año).',
      'No pedimos datos a menores. Si sos menor de 18, usá la tarjeta sin datos.',
      'No guardamos la IP en nuestra base de datos (Cloudflare procesa la IP para enrutar el tráfico).',
      'El comercio solo accede a los datos de su propio programa de fidelización y nunca a los de otros comercios.',
    ],
    sections: [
      {
        title: '1. Qué datos recolectamos y para qué los usamos',
        paragraphs: [
          'Aplicamos el principio de minimización de datos (Art. 4 Ley 25.326). Recolectamos únicamente la información indispensable para cada funcionalidad:',
        ],
        bullets: [
          'Clientes de la Tarjeta de Sellos: Correo electrónico (para enviar el código de verificación y recuperar la tarjeta), nombre o apodo, día y mes de cumpleaños sin año (birthDay y birthMonth), saldo de sellos, premios canjeados y preferencia de consentimiento (desmarcada por defecto) para recibir novedades del comercio.',
          'Tarjeta sin datos (Pensada para quien prefiere no dar datos): Genera únicamente un identificador al azar (código corto) sin correo, nombre ni cumpleaños. No pedimos datos a menores. Si sos menor de 18, usá la tarjeta sin datos.',
          'Comercios y Equipo (Dueño, Encargado, Cajero): Nombre, rol asignado, correo electrónico (solo para Dueño y Encargado), nombre del comercio, configuración del Cartel QR/NFC y catálogo de productos.',
          'Operaciones de Caja y Sellos: Monto del comprobante digital, método de pago referencial, fecha/hora del movimiento e identificador del socio (member_id) sin duplicar su nombre, correo ni teléfono en la bitácora de sellos.',
        ],
      },
      {
        title: '2. Proveedores técnicos (Encargados de tratamiento)',
        paragraphs: [
          'Para prestar el servicio utilizamos los siguientes proveedores de infraestructura:',
        ],
        bullets: [
          'Cloudflare (Workers y D1): Aloja la aplicación y la base de datos. No guardamos la IP en nuestra base de datos (Cloudflare procesa la IP para enrutar el tráfico).',
          'Google Fonts y Font Awesome (Cloudflare CDN): Tipografías e íconos de interfaz.',
          'WalletWallet (api.walletwallet.dev): Al tocar "Guardar en Wallet", recibe el nombre del comercio, el contador de sellos, el beneficio y el código del socio para generar el pase.',
          'Resend (api.resend.com): Envía los códigos de verificación por correo electrónico y los avisos a socios que dieron su consentimiento expreso.',
          'Microsoft Clarity (clarity.ms): Analítica de uso cargada únicamente si el usuario acepta las cookies de analítica.',
          'Mercado Pago: Procesamiento de pagos de suscripción de comercios.',
        ],
      },
      {
        title: '3. Derechos del titular (Ley 25.326)',
        paragraphs: [
          'El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis (6) meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.',
          'LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',
        ],
      },
    ],
  },

  cookies: {
    key: 'cookies',
    slug: '/cookies',
    title: 'Política de Cookies y Almacenamiento Local',
    subtitle:
      'Detalle técnico de cookies propias, claves en localStorage y analítica opcional con bloqueo previo.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Consentimiento Previo · Transparencia Digital',
    summaryPoints: [
      'La cookie propia toque_cookie_consent dura 180 días y guarda tu elección ("essential" o "all").',
      'Si elegís "Solo necesarias", Microsoft Clarity NO se carga ni ejecuta, y se eliminan inmediatamente sus cookies (_clck y _clsk).',
      'En tu navegador (localStorage) guardamos tu tarjeta activa para que no tengas que volver a cargar tus datos en cada visita.',
    ],
    sections: [
      {
        title: '1. Cookies y claves en tu dispositivo (Siempre activas para el funcionamiento)',
        paragraphs: [
          'Son indispensables para recordar tu tarjeta de sellos y tu preferencia de privacidad:',
        ],
        bullets: [
          'toque_cookie_consent (Cookie propia, Duración: 180 días): Guarda tu elección sobre cookies ("essential" o "all").',
          'toque_member_<idComercio> (localStorage): Conserva tu tarjeta de sellos activa en ese comercio para reconocer tu visita.',
          'toque_client_cards_v2 y toque_opened_receipts_v1 (localStorage): Guardan en tu teléfono el listado de tus tarjetas y comprobantes abiertos en Toquecito.',
        ],
      },
      {
        title: '2. Cookies de analítica opcional (Microsoft Clarity — Bloqueadas por defecto)',
        paragraphs: [
          'Solo se activan si aceptás las cookies de analítica:',
        ],
        bullets: [
          '_clck (Duración: 1 año, Microsoft Clarity): Identificador anónimo de sesión recurrente.',
          '_clsk (Duración: 1 día, Microsoft Clarity): Agrupa vistas de página dentro de una misma sesión anónima.',
        ],
      },
    ],
  },

  reembolso: {
    key: 'reembolso',
    slug: '/reembolso',
    title: 'Política de Suscripción y Cancelación',
    subtitle:
      'Condiciones sobre los planes Gratuito, Pago y A consultar, y continuidad de las tarjetas.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Ley 24.240 · Defensa del Consumidor',
    summaryPoints: [
      'Plan Gratuito con 1 tarjeta, 1 local y hasta 3 usuarios sin costo.',
      'Plan Pago con hasta 3 sucursales, hasta 3 tarjetas, Caja POS y equipo ilimitado.',
      'Si vence la suscripción, el Cartel QR y las tarjetas de los clientes siguen funcionando.',
    ],
    sections: [
      {
        title: '1. Continuidad del servicio',
        paragraphs: [
          'Si un comercio pasa al plan Gratuito o no renueva su período pago, el Cartel QR del mostrador y las tarjetas emitidas continúan funcionando para no perjudicar a los clientes.',
        ],
      },
    ],
  },
};

export function getConsentPreferences(): ConsentPreferences | null {
  if (memoryConsentPrefs) return memoryConsentPrefs;
  const fromCookie = readConsentCookie();
  if (fromCookie) {
    memoryConsentPrefs = fromCookie;
    return fromCookie;
  }
  return null;
}

export function saveConsentPreferences(analyticsClarity: boolean): ConsentPreferences {
  memoryConsentPrefs = {
    essential: true,
    analyticsClarity,
    updatedAt: new Date().toISOString(),
  };
  if (typeof document !== 'undefined') {
    const val = analyticsClarity ? 'all' : 'essential';
    document.cookie = `toque_cookie_consent=${val}; Max-Age=${180 * 24 * 60 * 60}; path=/; SameSite=Lax`;
  }
  applyClarityConsentState(analyticsClarity);
  return memoryConsentPrefs;
}
