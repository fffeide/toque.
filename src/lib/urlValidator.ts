/**
 * Toque — Validador de URLs de Reseñas de Google
 * Regla de seguridad: solo HTTPS y dominios oficiales de Google.
 * Prohibido el review-gating y redirecciones a dominios terceros no verificados.
 */

const ALLOWED_GOOGLE_DOMAINS = [
  'google.com',
  'google.com.ar',
  'search.google.com',
  'maps.google.com',
  'maps.google.com.ar',
  'maps.app.goo.gl',
  'g.page',
  'goo.gl',
];

export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

export function validateGoogleReviewUrl(inputUrl: string): UrlValidationResult {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Ingresá el enlace de reseñas de Google de tu negocio.' };
  }

  try {
    const url = new URL(trimmed);

    // Debe ser HTTPS estrictamente
    if (url.protocol !== 'https:') {
      return { isValid: false, error: 'El enlace debe comenzar con https:// por seguridad.' };
    }

    const hostname = url.hostname.toLowerCase();

    // Comprobar si el hostname coincide o termina con alguno de los dominios permitidos
    const isAllowed = ALLOWED_GOOGLE_DOMAINS.some(domain => {
      return hostname === domain || hostname.endsWith('.' + domain);
    });

    if (!isAllowed) {
      return {
        isValid: false,
        error: 'El enlace debe pertenecer a Google Maps o Perfil de Negocio (ej. g.page/..., maps.app.goo.gl/..., search.google.com/local/writereview).',
      };
    }

    return { isValid: true, sanitizedUrl: url.toString() };
  } catch {
    return { isValid: false, error: 'Formato de enlace no válido. Verificá que esté completo.' };
  }
}
