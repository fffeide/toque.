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

// Estado de consentimiento en memoria (sin usar localStorage como base de datos)
let memoryConsentPrefs: ConsentPreferences | null = null;

export const LEGAL_DOCUMENTS: Record<LegalDocKey, LegalDocument> = {
  terminos: {
    key: 'terminos',
    slug: '/terminos',
    title: 'Términos y Condiciones de Uso',
    subtitle:
      'Condiciones aplicables al uso del Club de fidelización Toque, Carteles QR de mostrador y cuenta de clientes y comercios.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Ley 24.240 · Código Civil y Comercial de la Nación',
    summaryPoints: [
      'El ingreso para comercios, equipo y clientes funciona exclusivamente mediante código de verificación de 6 dígitos enviado por mail (sin contraseñas).',
      'Los roles del equipo (Dueño, Encargado y Cajero) tienen permisos diferenciados; el Cajero no puede anular ni borrar movimientos.',
      'Toda anulación o ajuste realizado por un Dueño o Encargado exige un motivo obligatorio y queda asentado en el registro inmutable de Correcciones.',
      'Si vence la suscripción del comercio, el Cartel QR y las tarjetas de los clientes siguen funcionando.',
    ],
    sections: [
      {
        title: '1. Objeto del servicio Toque',
        paragraphs: [
          'Toque brinda un programa de fidelización con tarjeta de sellos digital para comercios de cercanía en la República Argentina. Permite que los clientes sumen sellos en sus visitas y canjeen premios desde su celular sin instalar aplicaciones.',
        ],
      },
      {
        title: '2. Ingreso sin contraseñas (Código por mail)',
        paragraphs: [
          'Para proteger la seguridad de las cuentas, Toque no utiliza contraseñas. Cada ingreso se valida mediante un código numérico de 6 dígitos enviado al mail del titular, con vencimiento a los 10 minutos, de uso único y un máximo de 5 intentos.',
        ],
      },
      {
        title: '3. Roles del equipo y registro de Correcciones',
        paragraphs: [
          'El Dueño del comercio puede invitar por mail a integrantes con rol Dueño, Encargado o Cajero y asignarlos a uno o varios locales.',
          'El Cajero accede únicamente a la pantalla Escanear para sumar sellos y canjear premios. Las anulaciones o ajustes de saldo requieren rol de Encargado o Dueño y un motivo obligatorio de al menos 10 caracteres que queda guardado de forma permanente en la sección Correcciones.',
        ],
      },
    ],
  },

  privacidad: {
    key: 'privacidad',
    slug: '/privacidad',
    title: 'Política de Privacidad y Protección de Datos',
    subtitle:
      'Cómo cuidamos los datos de clientes y comercios bajo la Ley 25.326 de Protección de los Datos Personales.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Ley 25.326 · Agencia de Acceso a la Información Pública (AAIP)',
    summaryPoints: [
      'Solo pedimos nombre (como te conocen), mail y opcionalmente día y mes de cumpleaños. No pedimos teléfono, apellido ni año de nacimiento.',
      'No recolectamos datos personales de menores de 18 años: ofrecemos la opción "Prefiero no dar mis datos" para usar la tarjeta sin datos.',
      'No pedimos ni guardamos la dirección IP ni rastreamos la ubicación del cliente.',
      'El comercio ve el mail del cliente parcialmente oculto (por ejemplo d***@gmail.com).',
    ],
    sections: [
      {
        title: '1. Minimización de datos y menores de 18 años',
        paragraphs: [
          'Para crear una tarjeta con datos personales es obligatorio confirmar ser mayor de 18 años. Los menores de 18 años o cualquier persona que prefiera no compartir información personal pueden elegir el botón "Prefiero no dar mis datos", que genera una tarjeta anónima identificada únicamente por un código al azar.',
        ],
      },
      {
        title: '2. Sin recolección de IP ni ubicación del cliente',
        paragraphs: [
          'Toque no solicita ni almacena la dirección IP ni la ubicación geográfica de los clientes. Cuando un cliente guarda su tarjeta en la billetera del celular, los avisos de cercanía al local son resueltos por el propio teléfono del usuario sin informar su posición a Toque.',
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
      'Información clara sobre las cookies técnicas de sesión y analítica opcional.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Transparencia Digital',
    summaryPoints: [
      'La sesión de usuario se gestiona mediante una cookie segura establecida por el servidor.',
      'No guardamos sesiones ni roles en el almacenamiento local del navegador.',
      'No vendemos datos a terceros ni usamos publicidad invasiva.',
    ],
    sections: [
      {
        title: '1. Cookies de sesión del servidor',
        paragraphs: [
          'Para mantener tu sesión activa de forma segura luego de validar el código de 6 dígitos enviado por mail, el servidor utiliza una cookie técnica de sesión. Los permisos y el rol los determina exclusivamente el servidor en cada consulta.',
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
  return memoryConsentPrefs;
}

export function saveConsentPreferences(analyticsClarity: boolean): ConsentPreferences {
  memoryConsentPrefs = {
    essential: true,
    analyticsClarity,
    updatedAt: new Date().toISOString(),
  };
  return memoryConsentPrefs;
}
