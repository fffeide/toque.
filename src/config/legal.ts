/**
 * Toque™ — Textos Legales, Políticas, Términos y Consentimientos (República Argentina)
 * Adaptados a:
 * - Carteles físicos NFC (NTAG213) + QR y Hub del Comercio
 * - Pantalla de Caja (POS) con lector de productos, catálogo gastronómico y métodos Efectivo / Tarjeta / QR
 * - Comprobante de Compra Digital No Fiscal con ventana de seguridad de 2 minutos (120 segundos) y apertura única
 * - Club de Fidelidad y pases Apple Wallet / Google Wallet
 * - Bóveda del Consumidor ("Toquecitos") y Red de Beneficios cruzados
 * - Niveles de acceso y roles del equipo (Dueño, Encargado, Cajero) con validación de contraseña en cambio de cargo
 * - Analítica de experiencia y mapas de calor con Microsoft Clarity (ID: ywqriqpjun) y consentimiento explícito
 * - Ley 25.326 (Protección de Datos Personales / AAIP), Ley 24.240 (Defensa del Consumidor) y Res. SCI 424/2020
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
export const CONSENT_STORAGE_KEY = 'toque_privacy_clarity_consent_v2';

export interface ConsentPreferences {
  essential: boolean;
  analyticsClarity: boolean;
  updatedAt: string;
}

export const LEGAL_DOCUMENTS: Record<LegalDocKey, LegalDocument> = {
  terminos: {
    key: 'terminos',
    slug: '/terminos',
    title: 'Términos y Condiciones de Uso',
    subtitle:
      'Regulación aplicable al uso de la plataforma SaaS Toque™, carteles físicos NFC + QR, Pantalla de Caja (POS), Comprobantes Digitales, Club de Fidelidad y Toquecitos.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Ley 24.240 · Código Civil y Comercial de la Nación',
    summaryPoints: [
      'El Comprobante Digital emitido por Toque™ es un comprobante de compra no fiscal con una ventana de seguridad de 2 minutos y apertura única.',
      'El bloque de Comprobante de compra permanece siempre fijo en la parte superior del Hub del comercio, incluso si el plan comercial se encuentra pendiente de pago.',
      'Los roles de equipo (Dueño, Encargado y Cajero) poseen permisos diferenciados; el cambio hacia un cargo superior en la Caja requiere contraseña del titular.',
      'Está prohibido condicionar o filtrar reseñas de Google Maps (prohibición de review gating).',
    ],
    sections: [
      {
        title: '1. Objeto y alcance del servicio Toque™',
        paragraphs: [
          'Toque™ es una plataforma tecnológica Software-as-a-Service (SaaS) diseñada para comercios gastronómicos, cafeterías, tiendas minoristas y de servicios en la República Argentina. Permite vincular carteles físicos inteligentes equipados con chips NFC (NTAG213) y códigos QR de respaldo con un Hub digital de mostrador y una Pantalla de Caja (POS).',
          'Al registrarse, activar un cartel físico, operar la Pantalla de Caja o interactuar como consumidor final con un cartel Toque™, el usuario acepta íntegramente los presentes Términos y Condiciones.',
        ],
      },
      {
        title: '2. Pantalla de Caja (POS), Catálogo de Productos y Métodos de Pago',
        paragraphs: [
          'La Pantalla de Caja de Toque™ permite registrar operaciones mediante teclado numérico rápido, lector de productos con código universal y catálogo completo desplegable pensado para cafeterías, restaurantes y comercios con productos con o sin código de barras.',
          'Los métodos de cobro admitidos en el registro operativo son Efectivo, Tarjeta y QR (incluyendo Mercado Pago). En todos los medios de pago, la emisión del comprobante digital en el cartel asignado es inmediata al registrar la operación, sin demoras de confirmación externa.',
        ],
        bullets: [
          'Lector rápido con acceso directo a los 5 productos más vendidos del comercio y botón de Catálogo completo con buscador.',
          'Visualización en Caja de los últimos 3 cobros realizados por la cuenta activa para agilidad en mostrador.',
          'Historial en Panel filtrado por defecto a las operaciones del día en curso, con selector de rango de días exclusivo para el Dueño.',
        ],
      },
      {
        title: '3. Comprobante Digital No Fiscal y Ventana de Seguridad de 2 Minutos',
        paragraphs: [
          'Cada cobro registrado en la Pantalla de Caja genera un Comprobante de Compra Digital que incluye la leyenda reglamentaria visible: "Comprobante de compra. No es una factura." Este documento no reemplaza la factura fiscal exigible ante ARCA / AFIP cuando corresponda emitirla.',
          'Por razones estrictas de seguridad en mostrador y privacidad entre clientes consecutivos, cada comprobante cuenta con una ventana máxima de apertura de dos (2) minutos (120 segundos) desde su emisión.',
        ],
        bullets: [
          'Si el cliente abre o reclama el comprobante dentro de los 2 minutos, el cartel libera inmediatamente el ticket para que ningún tercero posterior pueda visualizarlo.',
          'Si transcurren los 2 minutos sin que el comprobante sea abierto, o si el cajero registra un nuevo cobro en esa misma caja, el comprobante anterior caduca automáticamente en el cartel.',
          'El bloque de Comprobante de compra se ubica siempre en el primer lugar superior del Hub y no puede ocultarse ni desplazarse.',
        ],
      },
      {
        title: '4. Niveles de Acceso del Equipo: Dueño, Encargado y Cajero',
        paragraphs: [
          'El titular del comercio ("Dueño") puede dar de alta miembros de su equipo indicando nombre, apellido y rol ("Cajero", "Encargado" o "Dueño"), asignados por defecto a todas las cajas del local.',
          'Por seguridad operativa, el Dueño no puede degradar su propio rol ni restringir las cajas que administra. Asimismo, el nivel de Cajero accede únicamente a la Pantalla de Caja, a la vista de Carteles y a un Resumen operativo sin montos de facturación ni datos financieros sensibles.',
        ],
        bullets: [
          'Cambio de cuenta en POS: cuando desde la Pantalla de Caja se selecciona cambiar hacia una cuenta de cargo superior (por ejemplo, de Cajero a Encargado o Dueño), el sistema exige ingresar la contraseña de registro de dicha cuenta.',
          'Trazabilidad: cada cobro registra la cuenta que operó la caja para mostrar al cajero sus métricas operativas del día y de los últimos 7 días.',
        ],
      },
      {
        title: '5. Hub del Comercio, Redes Sociales, Google Maps y Estado del Plan',
        paragraphs: [
          'El Hub del comercio permite configurar accesos directos a redes sociales (Instagram, TikTok) mediante enlace, contacto rápido de WhatsApp (generando enlaces oficiales wa.me a partir del número telefónico), productos destacados con foto opcional, horarios/dirección y el Botón de Google Maps.',
          'El Botón de Google Maps redirige de manera neutral y directa al perfil público del comercio para que el cliente califique libremente su experiencia, quedando prohibida cualquier práctica de filtrado de reseñas ("review gating").',
          'Vigencia del Plan Comercial: durante el período de prueba o con el abono mensual al día, todos los bloques habilitados por el comercio se muestran en el Hub. Si el comercio no abona su plan vencido el período correspondiente, todos los bloques secundarios del Hub permanecerán ocultos automáticamente excepto el bloque de Comprobante de compra, que seguirá funcionando hasta la regularización del pago.',
        ],
      },
      {
        title: '6. Club de Fidelidad, Pases Wallet, Toquecitos y Red de Beneficios',
        paragraphs: [
          'Los consumidores pueden sumarse voluntariamente al Club de Fidelidad del comercio o guardar sus comprobantes en su bóveda personal ("Toquecitos") prestando su consentimiento informado explícito.',
          'Por privacidad, cuando un cliente escanea un cartel para entrar al Hub del comercio, terceros no pueden ver su cuenta privada de Toquecitos. La Red de Beneficios cruzados entre comercios funciona únicamente bajo activación expresa y sujeta a la disponibilidad de cada actualización de la plataforma.',
        ],
      },
    ],
  },

  privacidad: {
    key: 'privacidad',
    slug: '/privacidad',
    title: 'Política de Privacidad y Protección de Datos',
    subtitle:
      'Cómo protegemos los datos de comercios, cajeros y consumidores finales bajo la Ley 25.326 de Protección de los Datos Personales y normativas de la AAIP.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Ley 25.326 · Agencia de Acceso a la Información Pública (AAIP)',
    summaryPoints: [
      'No almacenamos direcciones IP ni identificadores invasivos al escanear un cartel NFC o QR en mostrador.',
      'Los cajeros tienen acceso restringido: no visualizan montos de facturación recaudados ni bases de contactos de clientes.',
      'El alta en el Club de Fidelidad y en la bóveda Toquecitos requiere consentimiento expreso (opt-in) del cliente.',
      'Utilizamos Microsoft Clarity con enmascaramiento de datos sensibles para mejorar la usabilidad sin comprometer tu privacidad.',
    ],
    sections: [
      {
        title: '1. Principios generales y minimización de datos',
        paragraphs: [
          'En Toque™ aplicamos el principio de privacidad desde el diseño. Cuando un consumidor acerca su teléfono a un cartel físico NFC o escanea su código QR para ver su comprobante de compra de los últimos 2 minutos o abrir el enlace de Google Maps, no exigimos registro previo ni almacenamos su dirección IP.',
        ],
      },
      {
        title: '2. Datos recolectados según el perfil de usuario',
        paragraphs: [
          'Recolectamos únicamente los datos estrictamente necesarios para prestar cada funcionalidad de la plataforma:',
        ],
        bullets: [
          'Comercios y Dueños: nombre del comercio, nombre del titular, correo electrónico de acceso, configuración del Hub, catálogo de productos (nombre, precio, código universal opcional y fotografía opcional) y enlaces públicos (Google Maps, Instagram, TikTok, WhatsApp).',
          'Equipo del Comercio (Encargados y Cajeros): nombre, apellido, rol asignado y registro interno de operaciones realizadas en caja para métricas de desempeño.',
          'Socios del Club de Fidelidad y Bóveda Toquecitos: nombre o alias y canal de contacto (WhatsApp o correo electrónico) proporcionados voluntariamente mediante casilla de consentimiento explícito para acumular sellos, descargar pases Apple/Google Wallet o sincronizar comprobantes.',
        ],
      },
      {
        title: '3. Aislamiento por Rol y Seguridad en el Punto de Venta',
        paragraphs: [
          'Para resguardar la confidencialidad comercial del negocio, las cuentas con rol "Cajero" tienen bloqueado el acceso a montos en pesos, recaudación diaria/semanal, listado de contactos del Club y configuración sensible de la cuenta.',
          'Asimismo, los comprobantes de compra en mostrador expiran a los 2 minutos o al ser reclamados por el comprador, impidiendo que el siguiente cliente en la fila acceda a los consumos anteriores.',
        ],
      },
      {
        title: '4. Analítica de Experiencia con Microsoft Clarity',
        paragraphs: [
          'Nuestro sitio web y aplicación utilizan Microsoft Clarity (ID de proyecto: ywqriqpjun) para comprender cómo los usuarios interactúan con nuestras pantallas a través de métricas de comportamiento, mapas de calor (heatmaps) y repetición de sesiones agregadas.',
          'Microsoft Clarity opera bajo configuración de privacidad reforzada: los campos de contraseñas, importes sensibles, datos de contacto de clientes y credenciales son enmascarados automáticamente antes de cualquier transmisión. Podés gestionar o revocar tu consentimiento de analítica en cualquier momento desde nuestro banner de consentimiento o en la Política de Cookies.',
        ],
      },
      {
        title: '5. Derechos ARCO (Acceso, Rectificación, Actualización y Supresión)',
        paragraphs: [
          'En cumplimiento del artículo 14 y concordantes de la Ley N° 25.326, todo titular de datos personales tiene derecho a solicitar el acceso a sus datos en forma gratuita a intervalos no inferiores a seis meses, así como su rectificación, actualización o supresión total.',
          'LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',
        ],
      },
    ],
  },

  cookies: {
    key: 'cookies',
    slug: '/cookies',
    title: 'Política de Cookies, Almacenamiento Local y Clarity',
    subtitle:
      'Detalle transparente sobre el uso de almacenamiento técnico en navegador, sesiones seguras y telemetría de usabilidad con Microsoft Clarity.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Transparencia Digital · Microsoft Clarity + LocalStorage',
    summaryPoints: [
      'Usamos almacenamiento local técnico para mantener tu sesión de caja/panel, el modo visual (claro/oscuro) y tu preferencia de consentimiento.',
      'Integramos Microsoft Clarity para detectar fricciones de diseño en mostrador y celulares, respetando tu elección de consentimiento.',
      'No utilizamos cookies publicitarias de terceros para perfilado invasivo ni vendemos datos de navegación.',
    ],
    sections: [
      {
        title: '1. ¿Qué tecnologías de almacenamiento utilizamos?',
        paragraphs: [
          'Toque™ utiliza almacenamiento local del navegador (LocalStorage) y cookies técnicas de primera parte para garantizar que la Pantalla de Caja y el Hub del cliente abran de forma instantánea sin recargas innecesarias.',
        ],
        bullets: [
          'Sesión autenticada y rol activo (toque_rls_session_v2): permite recordar al usuario autenticado y verificar el cambio de cuenta protegido por contraseña en el POS.',
          'Preferencia de Tema Visual (toque_theme_mode): recuerda tu elección entre Modo Oscuro y Modo Claro suavizado (beige cálido de alto contraste y bordes definidos).',
          'Bóveda local del consumidor: permite al comprador conservar sus tickets descargados y preferencia de consentimiento en su propio dispositivo.',
        ],
      },
      {
        title: '2. Uso de Microsoft Clarity y Consentimiento',
        paragraphs: [
          'Incorporamos la herramienta Microsoft Clarity (`https://www.clarity.ms/tag/ywqriqpjun`) con el único propósito de optimizar la velocidad de uso en la Pantalla de Caja y la claridad visual del Hub del cliente.',
          'Clarity captura interacciones de interfaz como clics, desplazamientos (scroll) y tiempos de respuesta de pantalla. Mediante la API oficial de consentimiento (`window.clarity("consent")`), respetamos la preferencia que selecciones en el aviso de privacidad del sitio.',
        ],
        bullets: [
          'Proveedor: Microsoft Corporation (Declaración de privacidad de Microsoft disponible en privacy.microsoft.com).',
          'Finalidad: Detección de errores visuales, cuellos de botella en el teclado numérico o lector de productos y mejora de accesibilidad.',
          'Control del usuario: Podés aceptar o desactivar las cookies analíticas de Clarity en cualquier momento desde el botón de preferencias al pie de esta página.',
        ],
      },
      {
        title: '3. Cómo administrar o borrar tus datos locales',
        paragraphs: [
          'Podés limpiar las cookies y el almacenamiento local desde la configuración de tu navegador (Chrome, Safari, Firefox o Edge) o utilizar los controles de consentimiento integrados en esta misma página para revocar el seguimiento analítico.',
        ],
      },
    ],
  },

  reembolso: {
    key: 'reembolso',
    slug: '/reembolso',
    title: 'Política de Reembolso, Suscripciones y Cancelación',
    subtitle:
      'Condiciones claras sobre los 30 días de prueba beta gratuita, abonos mensuales, baja sin penalidades y continuidad del Comprobante Digital.',
    lastUpdated: 'Octubre 2026',
    normativeBadge: 'Ley 24.240 · Transparencia Comercial en Suscripciones',
    summaryPoints: [
      'Todos los comercios nuevos cuentan con 30 días de prueba beta sin cargo para evaluar el Hub, la Caja y los Carteles.',
      'Si el comercio decide no abonar el plan al finalizar la prueba, el bloque de Comprobante de compra sigue activo en su Hub mientras los demás bloques quedan ocultos hasta que active su pago.',
      'Podés cancelar tu suscripción en cualquier momento sin cargos de permanencia ni multas.',
    ],
    sections: [
      {
        title: '1. Período de Prueba Beta de 30 Días',
        paragraphs: [
          'Los comercios que se registran en Toque™ acceden a treinta (30) días corridos de prueba gratuita para configurar su catálogo de productos, operar la Pantalla de Caja y probar la emisión de comprobantes digitales y reseñas de Google Maps.',
        ],
      },
      {
        title: '2. Efectos de la Falta de Pago del Plan sobre el Hub',
        paragraphs: [
          'En Toque™ nunca bloqueamos la entrega del ticket digital de compra en tu mostrador. Si una cuenta no registra el pago de su plan activo, el sistema aplica automáticamente el modo básico de seguridad:',
        ],
        bullets: [
          'El bloque superior de "Comprobante de compra" (con ventana de 2 minutos) permanece 100% operativo para tus clientes.',
          'Los bloques adicionales del Hub (Botón de Google Maps, Club de fidelidad, Redes Sociales, Productos destacados e Información del local) se ocultan temporalmente en el Hub público y se reactivan de forma instantánea al confirmarse el pago del plan.',
        ],
      },
      {
        title: '3. Cancelación de Suscripción y Reembolsos',
        paragraphs: [
          'No exigimos contratos de permanencia. El Dueño del comercio puede solicitar la baja de su suscripción mensual o anual en cualquier momento desde la sección Cuenta de su panel o mediante el Botón de Arrepentimiento dentro de los diez (10) días corridos de la contratación.',
          'En caso de cobros duplicados por error técnico de la pasarela de pago o ejercicio del derecho de revocación dentro del plazo legal de 10 días (Art. 34 Ley 24.240), se reintegrará el 100% del importe abonado por el mismo medio de pago utilizado.',
        ],
      },
    ],
  },
};

export function getConsentPreferences(): ConsentPreferences | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentPreferences;
  } catch {
    return null;
  }
}

export function saveConsentPreferences(analyticsClarity: boolean): ConsentPreferences {
  const prefs: ConsentPreferences = {
    essential: true,
    analyticsClarity,
    updatedAt: new Date().toISOString(),
  };
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
      const w = window as unknown as { clarity?: (...args: any[]) => void };
      if (typeof w.clarity === 'function') {
        w.clarity('consent', analyticsClarity);
      }
    }
  } catch {
    // ignore storage errors
  }
  return prefs;
}
