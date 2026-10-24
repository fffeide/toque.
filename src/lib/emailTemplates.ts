// Generador de plantillas HTML para Resend — Estética Tactile Hardware de Toque

const BASE_STYLES = {
  bgCanvas: '#0C0C0E',
  surface: '#141418',
  surfaceElevated: '#1C1C22',
  border: '#282830',
  brandOrange: '#D95B26',
  emerald: '#2FB36A',
  textPrimary: '#F4F4F0',
  textSecondary: '#A1A1AA',
  fontSans:
    "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontMono: "'JetBrains Mono', 'Courier New', monospace",
};

/**
 * Renderiza el contenedor base con el logo de Toque (Squircle + píldora #D95B26)
 * y el pie legal resumido (Ley 25.326).
 */
export function wrapToqueEmail(
  businessName: string,
  bodyContentHtml: string,
  unsubscribeUrl?: string
): string {
  return `
<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${businessName} — Toque</title>
</head>
<body style="margin:0;padding:0;background-color:${BASE_STYLES.bgCanvas};color:${BASE_STYLES.textPrimary};font-family:${BASE_STYLES.fontSans};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BASE_STYLES.bgCanvas};padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal (Max 480px estilo móvil/mostrador) -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;background-color:${BASE_STYLES.surface};border:1px solid ${BASE_STYLES.border};border-radius:24px;overflow:hidden;">
          
          <!-- Barra superior de acento Naranja Toque -->
          <tr>
            <td style="height:4px;background-color:${BASE_STYLES.brandOrange};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Cabecera: Nombre del Comercio + Badge Toque -->
          <tr>
            <td style="padding:24px 28px 16px 28px;border-bottom:1px solid ${BASE_STYLES.border};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <span style="font-size:18px;font-weight:700;color:${BASE_STYLES.textPrimary};letter-spacing:-0.02em;">
                      ${businessName}
                    </span>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;background-color:${BASE_STYLES.surfaceElevated};border:1px solid ${BASE_STYLES.border};border-radius:999px;padding:4px 10px;font-family:${BASE_STYLES.fontMono};font-size:11px;color:${BASE_STYLES.textSecondary};">
                      <span style="color:${BASE_STYLES.brandOrange};">●</span> toque
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo Dinámico -->
          <tr>
            <td style="padding:28px;">
              ${bodyContentHtml}
            </td>
          </tr>

          <!-- Pie del Correo -->
          <tr>
            <td style="padding:20px 28px;background-color:#101014;border-top:1px solid ${BASE_STYLES.border};text-align:center;">
              <p style="margin:0 0 6px 0;font-size:11px;color:${BASE_STYLES.textSecondary};line-height:1.5;">
                Tus datos son exclusivos del programa de <strong>${businessName}</strong> (Ley 25.326).
              </p>
              ${
                unsubscribeUrl
                  ? `<p style="margin:0;font-size:11px;"><a href="${unsubscribeUrl}" style="color:${BASE_STYLES.textSecondary};text-decoration:underline;">Darme de baja de los avisos</a></p>`
                  : ''
              }
            </td>
          </tr>

        </table>

        <!-- Firma Externa Minimalista -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;margin-top:16px;">
          <tr>
            <td align="center" style="font-family:${BASE_STYLES.fontMono};font-size:11px;color:#52525B;">
              Enviado de forma segura mediante <strong>toque</strong>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ============================================================================
// 1. PLANTILLA: BIENVENIDA + TARJETA ACTIVA (1ra Visita al Hub)
// ============================================================================
export function renderWelcomeCardEmail(params: {
  businessName: string;
  customerName: string;
  stamps: number;
  stampsRequired: number;
  rewardText: string;
  memberCode: string;
  hubUrl: string;
  walletUrl?: string;
}) {
  const {
    businessName,
    customerName,
    stamps,
    stampsRequired,
    rewardText,
    memberCode,
    hubUrl,
    walletUrl,
  } = params;
  const remaining = Math.max(0, stampsRequired - stamps);

  // Construimos los 10 círculos visuales en tabla compatible con Gmail
  const circlesHtml = Array.from({ length: stampsRequired }, (_, idx) => {
    const pos = idx + 1;
    const isCompleted = pos <= stamps;
    const isGoal = pos === stampsRequired;
    const bg = isCompleted ? BASE_STYLES.emerald : BASE_STYLES.surfaceElevated;
    const color = isCompleted ? '#0C0C0E' : BASE_STYLES.textSecondary;
    const border =
      pos === stamps + 1
        ? `2px solid ${BASE_STYLES.brandOrange}`
        : `1px solid ${BASE_STYLES.border}`;
    const symbol = isCompleted ? '✓' : isGoal ? '🎁' : String(pos);

    return `
      <td align="center" style="padding:4px;">
        <div style="width:32px;height:32px;line-height:32px;border-radius:999px;background-color:${bg};border:${border};color:${color};font-family:${BASE_STYLES.fontMono};font-size:12px;font-weight:700;text-align:center;">
          ${symbol}
        </div>
      </td>
    `;
  });

  const row1 = circlesHtml.slice(0, 5).join('');
  const row2 = circlesHtml.slice(5, 10).join('');

  const body = `
    <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BASE_STYLES.textPrimary};letter-spacing:-0.02em;">
      ¡Ya sos parte, ${customerName}!
    </h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:${BASE_STYLES.textSecondary};line-height:1.5;">
      Tu tarjeta de sellos en <strong>${businessName}</strong> ya está activa y sumaste tu primer sello. Cuando vuelvas a apoyar tu celular en el mostrador, se cargará automáticamente.
    </p>

    <!-- Tarjeta Digital Visual -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BASE_STYLES.surfaceElevated};border:1px solid ${BASE_STYLES.border};border-radius:18px;padding:20px;margin-bottom:24px;">
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:14px;">
            <tr>
              <td align="left" style="font-family:${BASE_STYLES.fontMono};font-size:11px;color:${BASE_STYLES.textSecondary};text-transform:uppercase;letter-spacing:0.08em;">
                TUS SELLOS
              </td>
              <td align="right" style="font-family:${BASE_STYLES.fontMono};font-size:20px;font-weight:700;color:${BASE_STYLES.textPrimary};">
                ${stamps} <span style="color:${BASE_STYLES.textSecondary};font-size:14px;">/ ${stampsRequired}</span>
              </td>
            </tr>
          </table>

          <!-- Grilla 2x5 de Sellos -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:14px;">
            <tr>${row1}</tr>
            ${row2 ? `<tr>${row2}</tr>` : ''}
          </table>

          <p style="margin:0;font-size:12px;color:${BASE_STYLES.textSecondary};text-align:center;">
            Premio: <strong style="color:${BASE_STYLES.textPrimary};">${rewardText}</strong> (Faltan ${remaining} sellos)
          </p>
        </td>
      </tr>
    </table>

    <!-- Botones de Acción -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom:12px;">
          <a href="${hubUrl}" style="display:block;width:100%;box-sizing:border-box;background-color:${BASE_STYLES.brandOrange};color:#0C0C0E;font-weight:700;font-size:14px;text-decoration:none;padding:14px 20px;border-radius:14px;text-align:center;">
            Abrir mi tarjeta en el celular →
          </a>
        </td>
      </tr>
      ${
        walletUrl
          ? `
      <tr>
        <td align="center">
          <a href="${walletUrl}" style="display:block;width:100%;box-sizing:border-box;background-color:${BASE_STYLES.surfaceElevated};border:1px solid ${BASE_STYLES.border};color:${BASE_STYLES.textPrimary};font-weight:600;font-size:13px;text-decoration:none;padding:12px 20px;border-radius:14px;text-align:center;">
            Guardar pase en Wallet (Código: ${memberCode})
          </a>
        </td>
      </tr>`
          : ''
      }
    </table>
  `;

  return wrapToqueEmail(businessName, body);
}

// ============================================================================
// 2. PLANTILLA: RECUPERAR TARJETA ("¿Ya tenés tarjeta? Ingresar →")
// ============================================================================
export function renderRecoverCardEmail(params: {
  businessName: string;
  customerName: string;
  otpCode: string;
  magicLinkUrl: string;
  currentStamps: number;
  stampsRequired: number;
}) {
  const { businessName, customerName, otpCode, magicLinkUrl, currentStamps, stampsRequired } =
    params;

  const body = `
    <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:${BASE_STYLES.textPrimary};">
      Recuperá tu tarjeta, ${customerName}
    </h1>
    <p style="margin:0 0 20px 0;font-size:14px;color:${BASE_STYLES.textSecondary};line-height:1.5;">
      Tenés <strong>${currentStamps} de ${stampsRequired} sellos</strong> acumulados en <strong>${businessName}</strong>. Tocá el botón de abajo o ingresá este código en la pantalla para vincular este dispositivo:
    </p>

    <!-- Caja de Código OTP -->
    <div style="background-color:${BASE_STYLES.surfaceElevated};border:1px solid ${BASE_STYLES.border};border-radius:16px;padding:18px;text-align:center;margin-bottom:20px;">
      <div style="font-family:${BASE_STYLES.fontMono};font-size:11px;color:${BASE_STYLES.textSecondary};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
        CÓDIGO DE ACCESO RÁPIDO
      </div>
      <div style="font-family:${BASE_STYLES.fontMono};font-size:32px;font-weight:700;letter-spacing:0.25em;color:${BASE_STYLES.brandOrange};">
        ${otpCode}
      </div>
    </div>

    <a href="${magicLinkUrl}" style="display:block;width:100%;box-sizing:border-box;background-color:${BASE_STYLES.brandOrange};color:#0C0C0E;font-weight:700;font-size:14px;text-decoration:none;padding:14px 20px;border-radius:14px;text-align:center;">
      Entrar a mi tarjeta con 1 toque →
    </a>
  `;

  return wrapToqueEmail(businessName, body);
}

// ============================================================================
// 3. PLANTILLA: AVISOS Y BENEFICIOS DEL COMERCIO (Sección "Tarjetas")
// ============================================================================
export function renderMerchantBroadcastEmail(params: {
  businessName: string;
  customerName: string;
  headline: string;
  messageBody: string;
  ctaLabel: string;
  ctaUrl: string;
  unsubscribeUrl: string;
}) {
  const { businessName, customerName, headline, messageBody, ctaLabel, ctaUrl, unsubscribeUrl } =
    params;

  const body = `
    <div style="display:inline-block;background-color:rgba(217,91,38,0.15);border:1px solid ${BASE_STYLES.brandOrange};color:${BASE_STYLES.brandOrange};font-family:${BASE_STYLES.fontMono};font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:14px;text-transform:uppercase;">
      NOVEDAD EXCLUSIVA DEL CLUB
    </div>

    <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:${BASE_STYLES.textPrimary};line-height:1.3;">
      ${headline}
    </h1>

    <p style="margin:0 0 24px 0;font-size:15px;color:${BASE_STYLES.textSecondary};line-height:1.6;white-space:pre-line;">
      Hola ${customerName},
      
      ${messageBody}
    </p>

    <a href="${ctaUrl}" style="display:block;width:100%;box-sizing:border-box;background-color:${BASE_STYLES.emerald};color:#0C0C0E;font-weight:700;font-size:14px;text-decoration:none;padding:14px 20px;border-radius:14px;text-align:center;">
      ${ctaLabel} →
    </a>
  `;

  return wrapToqueEmail(businessName, body, unsubscribeUrl);
}
