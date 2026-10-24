/**
 * Toque — Configuración Centralizada de Planes y Suscripción
 * - Plan Gratuito (free): $0 — Solo Hub básico ("Hub pelado", enlaces y reseñas).
 * - Plan Pago Pro (pro): $34.999 ARS / mes — Todo habilitado (Hub completo, Tarjetas, Wallet, POS Caja, Lector de Barras, Avisos Resend, Equipo).
 * - Prueba Gratuita: 14 días (Exclusiva al seleccionar el Plan Anual). Si vence sin pago confirmado, baja a Plan Gratuito sin borrar datos históricos.
 */

export interface PlanDefinition {
  id: 'free' | 'mensual' | 'anual';
  tier: 'free' | 'pro';
  name: string;
  periodLabel: string;
  priceMonthlyArs: number;
  totalPriceArs: number;
  priceArs: number;
  description: string;
  billingNote: string;
  savingsBadge?: string;
  badge?: string;
  trialDays: number;
  features: string[];
}

export const TRIAL_DAYS = 14;
export const BASE_MONTHLY_PRICE_ARS = 34999;
export const ANNUAL_MONTHS_CHARGED = 10;
export const ANNUAL_TOTAL_PRICE_ARS = BASE_MONTHLY_PRICE_ARS * ANNUAL_MONTHS_CHARGED;
export const ANNUAL_EFFECTIVE_MONTHLY_ARS = Math.round(ANNUAL_TOTAL_PRICE_ARS / 12);

export const TOQUE_PLANS: Record<'free' | 'mensual' | 'anual', PlanDefinition> = {
  free: {
    id: 'free',
    tier: 'free',
    name: 'Plan Gratuito (Hub Básico)',
    periodLabel: 'sin cargo',
    priceMonthlyArs: 0,
    totalPriceArs: 0,
    priceArs: 0,
    description: 'Solo Hub pelado con enlaces básicos y reseñas del comercio.',
    billingNote: 'Sin costo mensual. Funciones Pro bloqueadas.',
    trialDays: 0,
    features: [
      'Hub básico con enlaces de contacto y redes sociales',
      'Acceso directo a reseñas de Google Maps',
      'Conserva todos tus datos históricos de clientes y sellos',
    ],
  },
  mensual: {
    id: 'mensual',
    tier: 'pro',
    name: 'Plan Pro Mensual',
    periodLabel: 'por mes',
    priceMonthlyArs: BASE_MONTHLY_PRICE_ARS,
    totalPriceArs: BASE_MONTHLY_PRICE_ARS,
    priceArs: BASE_MONTHLY_PRICE_ARS,
    description: 'Activación inmediata mes a mes. Cancelás cuando quieras.',
    billingNote: 'Activación directa a $34.999/mes (sin período de prueba).',
    trialDays: 0,
    features: [
      'Smart Hub completo + Comprobantes térmicos digitales en vivo',
      'Tarjeta de sellos interactiva + Auto-sello inteligente en 2° visita',
      'Pases para Apple Wallet, Google Wallet y Tarjeta con Código de Barras/QR real',
      'Terminal Caja (POS) con calculadora matemática por teclado',
      'Lector rápido de código de barras USB/Bluetooth en Tarjetas',
      'Envío de Avisos por correo (Resend) y gestión de Equipo y Locales',
    ],
  },
  anual: {
    id: 'anual',
    tier: 'pro',
    name: 'Plan Pro Anual',
    periodLabel: 'por año (14 días de prueba gratis)',
    priceMonthlyArs: ANNUAL_EFFECTIVE_MONTHLY_ARS,
    totalPriceArs: ANNUAL_TOTAL_PRICE_ARS,
    priceArs: ANNUAL_TOTAL_PRICE_ARS,
    description: `Incluye ${TRIAL_DAYS} días de prueba gratis. Pagás 10 meses ($${ANNUAL_TOTAL_PRICE_ARS.toLocaleString('es-AR')}/año).`,
    billingNote: `Exclusivo Plan Anual: ${TRIAL_DAYS} días de prueba sin cargo. Si vence sin pago, baja a Plan Gratuito sin perder datos.`,
    savingsBadge: '14 días gratis + 2 meses sin cargo',
    badge: '14 días de prueba gratis',
    trialDays: TRIAL_DAYS,
    features: [
      '14 días de prueba gratuita con todas las funciones Pro destrabadas',
      '2 meses bonificados (pagás 10 meses y usás los 12 meses del año)',
      'Smart Hub completo, Tarjeta de Sellos, Auto-sello y Wallet',
      'Terminal Caja (POS) por teclado + Lector de código de barras en menos de 1 seg',
      'Avisos por email vía Resend, Kit de Carteles A5/Sticker y Equipo ilimitado',
    ],
  },
};

export const TOQUE_PLANS_LIST: PlanDefinition[] = [
  TOQUE_PLANS.mensual,
  TOQUE_PLANS.anual,
];

export const PLANS: PlanDefinition[] = [
  TOQUE_PLANS.free,
  TOQUE_PLANS.mensual,
  TOQUE_PLANS.anual,
];

export function formatArsPrice(amount: number): string {
  return `$${amount.toLocaleString('es-AR')}`;
}

export const formatArs = formatArsPrice;
