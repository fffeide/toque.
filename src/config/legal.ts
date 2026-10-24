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

// Estado de consentimiento en memoria + cookie técnica de primera parte (toque_cookie_consent)
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
    // Si el usuario rechaza ("Solo necesarias"), informamos a Clarity que detenga cookies y borramos _clck / _clsk
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
      'El ingreso para comercios, equipo y clientes funciona exclusivamente mediante código de verificación de 6 dígitos enviado por correo electrónico (sin contraseñas).',
      'Los roles del equipo (Dueño, Encargado y Cajero) tienen permisos diferenciados; el Cajero no puede anular ni borrar movimientos.',
      'Toda anulación o ajuste realizado por un Dueño o Encargado exige un motivo obligatorio y queda asentado en el registro inmutable de Correcciones.',
      'Si vence la suscripción del comercio, el Cartel QR y las tarjetas de los clientes siguen funcionando.',
    ],
    sections: [
      {
        title: '1. Objeto del servicio Toque',
        paragraphs: [
          'Toque brinda una plataforma de Carteles Inteligentes (QR + NFC), Comprobantes Digitales y Fidelización por Tarjeta de Sellos Digital para comercios en la República Argentina. Permite que los clientes sumen sellos en sus visitas, reciban su comprobante digital y canjeen premios desde su celular sin instalar aplicaciones.',
        ],
      },
      {
        title: '2. Ingreso sin contraseñas (Código de 6 dígitos por correo)',
        paragraphs: [
          'Para proteger la seguridad de las cuentas, Toque no solicita ni almacena contraseñas. Cada ingreso o alta de tarjeta se valida mediante un código numérico de 6 dígitos enviado al correo electrónico del titular, con vencimiento a los 10 minutos, de uso único y un máximo de 5 intentos.',
        ],
      },
      {
        title: '3. Roles del equipo y registro de Correcciones',
        paragraphs: [
          'El Dueño del comercio puede invitar por correo electrónico a integrantes con rol Dueño, Encargado o Cajero y asignarlos a uno o varios locales.',
          'El Cajero accede a la pantalla Escanear y Caja para sumar sellos, emitir cobros y canjear premios. Las anulaciones o ajustes de saldo requieren rol de Encargado o Dueño y un motivo obligatorio de al menos 10 caracteres que queda guardado de forma permanente en la sección Correcciones.',
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
      'Para activar la tarjeta de sellos digital solo pedimos tu correo electrónico (y opcionalmente cómo te llaman). No existen contraseñas en toda la plataforma.',
      'No recolectamos datos personales de menores de 18 años: ofrecemos la opción "Prefiero no dar mis datos" para usar la tarjeta de forma anónima.',
      'No pedimos ni guardamos la dirección IP ni rastreamos la ubicación GPS del cliente.',
      'El comercio solo accede a los datos de su propio programa de fidelización y nunca a los de otros comercios.',
    ],
    sections: [
      {
        title: '1. Qué datos recolectamos y para qué los usamos',
        paragraphs: [
          'Aplicamos el principio de minimización de datos (Art. 4 Ley 25.326). Recolectamos únicamente la información indispensable para cada funcionalidad:',
        ],
        bullets: [
          'Clientes de la Tarjeta de Sellos: Correo electrónico (obligatorio para enviar el código de verificación de 6 dígitos y recuperar la tarjeta), nombre o apodo (opcional), día y mes de cumpleaños sin año (opcional, solo si el cliente desea recibir un saludo del local), saldo de sellos, premios canjeados y preferencia de consentimiento para recibir novedades del comercio.',
          'Modo Anónimo ("Prefiero no dar mis datos"): Genera únicamente un identificador al azar (código corto) sin correo, nombre ni cumpleaños. Pensado para menores de 18 años o clientes que prefieren privacidad total.',
          'Comercios y Equipo (Dueño, Encargado, Cajero): Correo electrónico laboral, nombre, rol asignado, nombre del comercio, configuración del Cartel QR/NFC y catálogo de productos.',
          'Operaciones de Caja y Sellos: Monto del comprobante digital, método de pago referencial (efectivo, QR o tarjeta), fecha/hora del movimiento y correo del colaborador que registró el sello o cobro.',
          'Pases de Billetera (Apple Wallet / Google Wallet): Al tocar "Agregar a Apple Wallet" o "Agregar a Google Wallet", se envía al proveedor técnico WalletWallet (api.walletwallet.dev) el nombre del comercio, el contador de sellos, el beneficio y el código QR del socio para generar el archivo del pase.',
        ],
      },
      {
        title: '2. Datos que NUNCA recolectamos',
        paragraphs: [
          'Por diseño de seguridad y privacidad, Toque NO solicita ni almacena en ningún caso:',
        ],
        bullets: [
          'Contraseñas o claves de acceso (toda autenticación es mediante código temporal de 6 dígitos por correo).',
          'Dirección IP de los clientes ni huella digital del dispositivo (fingerprinting).',
          'Ubicación geográfica (GPS) de los clientes.',
          'Datos de tarjetas de crédito, débito o cuentas bancarias de los clientes que compran en el local.',
          'Año de nacimiento ni documento de identidad (DNI) de los clientes.',
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
    title: 'Política de Cookies',
    subtitle:
      'Detalle técnico de cookies estrictamente necesarias y analítica opcional con bloqueo previo.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Consentimiento Previo · Transparencia Digital',
    summaryPoints: [
      'Si elegís "Solo necesarias", Microsoft Clarity NO se carga ni ejecuta, y se eliminan inmediatamente sus cookies (_clck y _clsk).',
      'La sesión de usuario se gestiona mediante cookie técnica del servidor y memoria de ejecución, sin guardar roles ni sesiones en localStorage.',
      'No utilizamos cookies publicitarias ni compartimos perfiles de navegación con redes de anuncios.',
    ],
    sections: [
      {
        title: '1. Cookies estrictamente necesarias (Siempre activas)',
        paragraphs: [
          'Son indispensables para que la plataforma funcione y para recordar tu decisión sobre el uso de cookies:',
        ],
        bullets: [
          'toque_cookie_consent (Duración: 180 días, Propia): Guarda tu elección en el banner de cookies ("essential" cuando rechazás analítica o "all" cuando aceptás) para no volver a cargarte scripts no autorizados.',
          'Cookie de sesión del servidor (Propia, HttpOnly): Mantiene activa la sesión luego de verificar el código de 6 dígitos enviado por correo electrónico.',
        ],
      },
      {
        title: '2. Cookies de analítica opcional (Microsoft Clarity — Bloqueadas por defecto)',
        paragraphs: [
          'Solo se activan si hacés clic expresamente en el botón "Aceptar todo". Si elegís "Solo necesarias" o cerrás el aviso con la X, el script de Microsoft Clarity no se descarga ni se ejecuta en tu navegador.',
        ],
        bullets: [
          '_clck (Duración: 1 año, Microsoft Clarity): Conserva el identificador anónimo de usuario de Clarity entre visitas para distinguir sesiones recurrentes con datos de texto enmascarados.',
          '_clsk (Duración: 1 día, Microsoft Clarity): Conecta múltiples vistas de página de un usuario dentro de una única grabación de sesión anónima para detectar errores de interfaz.',
        ],
      },
    ],
  },

  reembolso: {
    key: 'reembolso',
    slug: '/reembolso',
    title: 'Política de Suscripción y Cancelación',
    subtitle:
      'Condiciones sobre los 30 días de prueba gratis, planes mensual y anual, y continuidad de las tarjetas.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Ley 24.240 · Defensa del Consumidor',
    summaryPoints: [
      '30 días de prueba gratuita sin tarjeta de crédito.',
      'Todos los locales del comercio están incluidos en la suscripción.',
      'Si vence la suscripción, el Cartel QR y las tarjetas de los clientes siguen funcionando.',
    ],
    sections: [
      {
        title: '1. Prueba gratis y continuidad del servicio',
        paragraphs: [
          'Todo comercio nuevo cuenta con 30 días de prueba sin cargo. Si al finalizar la prueba o un período pago el comercio no renueva, el Cartel QR del mostrador y las tarjetas de los clientes continúan activos para no perjudicar a los clientes; únicamente se pausan el panel de administración y los avisos.',
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
