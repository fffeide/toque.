/**
 * Toque — Configuración y Datos Legales Centralizados
 * Cumplimiento con la normativa argentina (Ley 24.240, Ley 25.326, Res. SCI 424/2020)
 */

export const LEGAL_CONFIG = {
  TITULAR: 'Toque Tecnologías S.A.S. (en constitución)',
  CUIT: '30-71829401-4',
  DOMICILIO: 'Av. Corrientes 1234, Piso 4, Ciudad Autónoma de Buenos Aires, República Argentina',
  EMAIL_LEGAL: 'legal@toque.com.ar',
  EMAIL_SOPORTE: 'hola@toque.com.ar',
  WHATSAPP_SOPORTE: '+54 11 5263-8900',
  FECHA_ACTUALIZACION: '10 de octubre de 2026',
  JURISDICCION: 'Tribunales Ordinarios en lo Comercial de la Ciudad Autónoma de Buenos Aires',
  AUTORIDAD_DATOS: 'Agencia de Acceso a la Información Pública (AAIP)',
};

export interface LegalDocument {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  badge: string;
  markdownContent: string;
}

export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  terminos: {
    id: 'terminos',
    slug: 'terminos',
    title: 'Términos y Condiciones de Uso del Servicio',
    subtitle: 'Regulaciones aplicables a fabricantes de carteles y comercios usuarios de la plataforma Toque',
    badge: 'Borrador — pendiente de revisión legal',
    markdownContent: `
# 12.1 Términos y Condiciones de Uso del Servicio

**Borrador — pendiente de revisión legal**  
*Última actualización: [FECHA]*

---

### 1. Partes y Aceptación
El presente contrato regula la utilización del software provisto bajo la modalidad SaaS denominado **"Toque"** (en adelante, el "Servicio"), desarrollado y operado por **[TITULAR]**, CUIT **[CUIT]**, con domicilio legal en **[DOMICILIO]** (en adelante, "LA EMPRESA").

La suscripción, acceso o uso del Servicio por parte de cualquier fabricante de carteles, imprenta o taller (en adelante, "EL FABRICANTE") o de cualquier titular de un establecimiento comercial (en adelante, "EL NEGOCIO") implica la aceptación plena e incondicional de estos Términos.

---

### 2. Objeto del Servicio
Toque brinda una plataforma tecnológica orientada a:
1. La vinculación de carteles físicos provistos de chips NFC y códigos QR con páginas de destino de reseñas en plataformas de terceros (principalmente Google Business Profile).
2. El registro estadístico agregado de escaneos y toques de interacción física.
3. Herramientas de marca blanca, gestión de clientes y alertas proactivas de actividad para fabricantes e imprentas.

**Importante:** Toque es un proveedor de tecnología independiente y **no se encuentra afiliado, asociado ni respaldado por Google LLC** ni por Alphabet Inc. Las marcas comerciales mencionadas se utilizan exclusivamente con fines de interoperabilidad y referencia descriptiva.

---

### 3. Redirección Continua y Compromiso de Disponibilidad
Toque asume el compromiso fundamental de preservar la continuidad operativa del cartel físico:
- **Respaldo ante vencimiento:** En caso de que un Fabricante o Negocio discontinúe su suscripción o su período de gracia finalice, **los carteles físicos existentes continuarán redirigiendo a los clientes finales hacia el enlace de reseñas configurado**. El panel de control pasará a modo de solo lectura, pero la función primaria del cartel físico nunca quedará truncada o inhabilitada unilateralmente.
- **Período de gracia:** Los planes impagos gozan de un período de gracia de quince (15) días corridos previo a cualquier limitación de acceso a las interfaces analíticas.

---

### 4. Responsabilidad sobre los Enlaces y Políticas de Google
EL NEGOCIO y EL FABRICANTE son los únicos responsables de configurar URLs legítimas correspondientes a sus propios perfiles comerciales. Queda expresamente prohibido:
- Redirigir a sitios que alojen malware, phishing, estafas o contenido ilícito.
- Implementar mecanismos de "gating de reseñas" (solicitar una calificación interna previa para filtrar clientes descontentos), en contravención con las políticas públicas de Google Reviews. Toque promueve el acceso directo, transparente y neutral a la ficha pública de reseñas.

---

### 5. Precios, Facturación y Ajustes Trimestrales
- **Período Beta:** Durante la fase beta pública, el uso de las funciones básicas es gratuito y no genera cargos retroactivos.
- **Planes Comerciales:** Finalizada la beta, los servicios se facturarán conforme a la modalidad mensual o anual elegida en pesos argentinos (ARS).
- **Ajustes:** Dado el contexto macroeconómico, los aranceles podrán ser ajustados trimestralmente, notificando fehacientemente al usuario con una antelación mínima de treinta (30) días corridos. Si el usuario no estuviere conforme, podrá rescindir el servicio sin penalidad antes de la entrada en vigencia del nuevo cuadro tarifario.

---

### 6. Limitación de Responsabilidad
LA EMPRESA garantiza la disponibilidad razonable del servicio de redirección (SLA objetivo 99.8% anual), excluyendo interrupciones causadas por fallas generales de infraestructura en la red de Internet global, bloqueos por parte de los proveedores de telecomunicaciones del usuario o modificaciones unilaterales en las APIs públicas de Google.

---

### 7. Legislación Aplicable y Jurisdicción
Para todos los efectos legales emergentes del presente contrato, las partes se someten a las leyes de la República Argentina y a la jurisdicción de los **[JURISDICCION]**, con renuncia expresa a cualquier otro fuero o jurisdicción que pudiera corresponderles.
    `,
  },

  privacidad: {
    id: 'privacidad',
    slug: 'privacidad',
    title: 'Política de Privacidad y No Tratamiento de Datos Personales',
    subtitle: 'Nuestra promesa de privacidad: sin cookies en el cartel, sin guardar IPs y sin saber quién califica',
    badge: 'Borrador — pendiente de revisión legal',
    markdownContent: `
# 12.2 Política de Privacidad y Protección de Datos

**Borrador — pendiente de revisión legal**  
*Última actualización: [FECHA]*

---

### 1. Principio Fundamental: Privacidad Silenciosa
En **Toque** ([TITULAR], CUIT [CUIT], [DOMICILIO]) creemos que la mejor política de privacidad es no recolectar datos innecesarios en primer término ("Privacidad por Diseño y por Defecto").

Nuestra propuesta comercial se fundamenta en un principio inquebrantable:
**El cliente final que acerca su teléfono o escanea un cartel en un mostrador NO debe ser rastreado, perfilado ni identificado.**

---

### 2. Qué NO recolectamos al escanear un cartel
Cuando una persona apoya su teléfono sobre el chip NFC o escanea el código QR de un cartel Toque:
- **NO almacenamos la dirección IP:** La dirección IP se procesa de manera efímera y no persistente en la memoria volátil del servidor para resolver el encabezado de geolocalización aproximada a nivel ciudad/provincia y se descarta de inmediato sin volcarse a disco.
- **NO utilizamos cookies de rastreo:** El endpoint de redirección rápida no deposita cookies de terceros, ni cookies de sesión, ni píxeles de seguimiento (Meta Pixel, Google Analytics o similares).
- **NO accedemos a datos del dispositivo:** No solicitamos acceso a libreta de contactos, cámara, micrófono ni identificadores únicos de hardware (IMEI, IDFA, GAID).
- **NO sabemos quién deja la reseña:** La interacción en Toque finaliza en la redirección directa hacia Google Maps / Google Reviews. La redacción de la reseña ocurre bajo el ecosistema y la cuenta personal del usuario en Google, a la cual Toque jamás tiene acceso.

---

### 3. Datos que SÍ tratamos de Fabricantes y Comercios
Para la prestación del panel de administración SaaS, tratamos exclusivamente los siguientes datos de contacto y facturación:
- Nombre y apellido o razón social del titular o responsable.
- Correo electrónico para acceso mediante enlaces mágicos de autenticación.
- Número de WhatsApp o telefonía móvil para el envío opcional de resúmenes semanales y alertas operativas.
- Datos de facturación (CUIT, condición fiscal, domicilio).

Estos datos se almacenan en servidores con cifrado en reposo (AES-256) y en tránsito (TLS 1.3).

---

### 4. Cumplimiento de la Ley 25.326 (República Argentina)
En cumplimiento de la Ley de Protección de los Datos Personales N° 25.326 y sus normas complementarias:
- El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses.
- El usuario puede solicitar la actualización, rectificación o supresión de sus datos de contacto en cualquier momento escribiendo a **[EMAIL LEGAL]**.
- La Dirección Nacional de Protección de Datos Personales, Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.

---

### 5. Transferencias a Terceros
Toque no comercializa, no alquila y no comparte bases de datos con anunciantes ni centrales de riesgo crediticio. Los proveedores tecnológicos de infraestructura (alojamiento en la nube y correo transaccional) operan bajo estrictas cláusulas de confidencialidad y procesamiento de datos.
    `,
  },

  cookies: {
    id: 'cookies',
    slug: 'cookies',
    title: 'Política de Cookies y Almacenamiento Local',
    subtitle: 'Explicación clara sobre las tecnologías de almacenamiento empleadas en Toque',
    badge: 'Borrador — pendiente de revisión legal',
    markdownContent: `
# 12.3 Política de Cookies y Almacenamiento Local

**Borrador — pendiente de revisión legal**  
*Última actualización: [FECHA]*

---

### 1. Resumen Ejecutivo
- **En los enlaces del cartel físico (NFC / QR): CERO cookies.** No se instala ningún elemento de rastreo en el navegador de quien interactúa en el mostrador.
- **En la plataforma web y panel de control (toque.com / paneles): Solo cookies técnicas y almacenamiento local esencial.**

---

### 2. Qué tecnologías empleamos en la aplicación
1. **Cookies Técnicas y de Autenticación:**  
   Necesarias para verificar que eres tú cuando inicias sesión con tu enlace mágico y proteger tu cuenta contra ataques de tipo CSRF.
2. **Local Storage (Almacenamiento Local del Navegador):**  
   Utilizamos la memoria local de tu propio navegador para recordar:
   - Tu preferencia de tema visual (modo claro o modo oscuro).
   - Tus preferencias de visualización y filtros en el panel de carteles.
   - La confirmación de lectura del aviso informativo de cookies.

---

### 3. Ausencia de Cookies Publicitarias
No empleamos cookies de redes publicitarias, ni herramientas de retargeting, ni compartimos identificadores con corredores de datos (data brokers).

---

### 4. Cómo gestionar o deshabilitar cookies
Puedes configurar tu navegador (Chrome, Safari, Firefox, Edge) para bloquear o alertarte sobre la presencia de cookies. Ten en cuenta que si bloqueas las cookies técnicas esenciales, algunas funcionalidades del panel administrativo podrían verse afectadas.
    `,
  },

  reembolso: {
    id: 'reembolso',
    slug: 'reembolso',
    title: 'Política de Reembolso, Garantía y Cancelación',
    subtitle: 'Condiciones claras para suscripciones de software y reposición de carteles físicos',
    badge: 'Borrador — pendiente de revisión legal',
    markdownContent: `
# 12.4 Política de Reembolso y Cancelación

**Borrador — pendiente de revisión legal**  
*Última actualización: [FECHA]*

---

### 1. Período de Prueba y Cancelación sin Compromiso
- Durante la etapa de Beta y en los períodos promocionales, los planes de Toque no devengan costo alguno.
- En planes de facturación mensual paga, el usuario puede cancelar la renovación automática en cualquier momento desde su panel de cuenta, sin necesidad de trámites engorrosos ni penalizaciones. El servicio continuará activo hasta el fin del ciclo mensual abonado.

---

### 2. Derecho de Arrepentimiento (Ley 24.240 y Res. 424/2020)
De conformidad con el artículo 34 de la Ley 24.240 de Defensa del Consumidor y la Resolución 424/2020 de la Secretaría de Comercio Interior:
- El consumidor tiene derecho a revocar la aceptación del servicio contratado durante el plazo de **diez (10) días corridos** contados a partir de la fecha de contratación.
- A tales efectos, Toque pone a disposición en todo momento el **Botón de Arrepentimiento** accesible desde la página principal y a través del enlace directo **/arrepentimiento**.
- Al ejercer este derecho, se procederá al reintegro inmediato del 100% de los importes abonados mediante el mismo medio de pago utilizado, sin costos ni comisiones a cargo del usuario.

---

### 3. Carteles Físicos y Reemplazos
- Si un cartel físico sufre rotura, extravío o deterioro del código QR o chip NFC, el sistema permite su **reemplazo digital inmediato**: se genera un nuevo código o se graba un nuevo chip transfiriendo todo el historial acumulado al nuevo soporte físico sin consumo adicional de cupo.
- Las garantías sobre el material físico (acrílico, madera, impresión) son provistas directamente por EL FABRICANTE o imprenta proveedora de la pieza.
    `,
  },
};
