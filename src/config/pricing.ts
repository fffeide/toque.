/**
 * Toque — Configuración Centralizada de Planes y Suscripción
 * Un único lugar para definir precios, períodos y condiciones de prueba.
 * Regla: Anual = se pagan 10 meses (2 meses sin cargo). Prueba gratis de 30 días, sin tarjeta.
 */

export interface PlanDefinition {
  id: 'mensual' | 'anual';
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

export const TRIAL_DAYS = 30;
export const BASE_MONTHLY_PRICE_ARS = 12900;
export const ANNUAL_MONTHS_CHARGED = 10;
export const ANNUAL_TOTAL_PRICE_ARS = BASE_MONTHLY_PRICE_ARS * ANNUAL_MONTHS_CHARGED;
export const ANNUAL_EFFECTIVE_MONTHLY_ARS = Math.round(ANNUAL_TOTAL_PRICE_ARS / 12);

export const TOQUE_PLANS: Record<'mensual' | 'anual', PlanDefinition> = {
  mensual: {
    id: 'mensual',
    name: 'Plan Mensual',
    periodLabel: 'por mes',
    priceMonthlyArs: BASE_MONTHLY_PRICE_ARS,
    totalPriceArs: BASE_MONTHLY_PRICE_ARS,
    priceArs: BASE_MONTHLY_PRICE_ARS,
    description: 'Se abona mes a mes. Cancelás cuando quieras.',
    billingNote: 'Se abona mes a mes. Cancelás cuando quieras.',
    trialDays: TRIAL_DAYS,
    features: [
      'Tarjeta de sellos en el celular sin instalar nada',
      'Cartel con código QR listo para imprimir en hoja A5',
      'Suma de sellos por visita o por monto de compra',
      'Avisos automáticos de cumpleaños y cercanía al local',
      'Varios locales y cuentas para dueño, encargado y cajeros',
      'Registro de correcciones inalterable y exportación CSV',
    ],
  },
  anual: {
    id: 'anual',
    name: 'Plan Anual',
    periodLabel: 'por año (pagás 10 meses)',
    priceMonthlyArs: ANNUAL_EFFECTIVE_MONTHLY_ARS,
    totalPriceArs: ANNUAL_TOTAL_PRICE_ARS,
    priceArs: ANNUAL_TOTAL_PRICE_ARS,
    description: `Un pago anual de $${ANNUAL_TOTAL_PRICE_ARS.toLocaleString('es-AR')} (equivalente a 10 meses).`,
    billingNote: `Un pago anual de $${ANNUAL_TOTAL_PRICE_ARS.toLocaleString('es-AR')} (equivalente a 10 meses).`,
    savingsBadge: 'Ahorrás 2 meses',
    badge: 'Ahorrás 2 meses',
    trialDays: TRIAL_DAYS,
    features: [
      'Todo lo incluido en el Plan Mensual',
      '2 meses bonificados (pagás 10 meses y usás 12)',
      'Tarjeta de sellos ilimitada para todos tus clientes',
      'Carteles y códigos QR para todos tus locales',
      'Avisos programados y recordatorios de cumpleaños',
      'Exportación completa de clientes y correcciones en CSV',
    ],
  },
};

export const TOQUE_PLANS_LIST: PlanDefinition[] = [TOQUE_PLANS.mensual, TOQUE_PLANS.anual];
export const PLANS: PlanDefinition[] = TOQUE_PLANS_LIST;

export function formatArsPrice(amount: number): string {
  return `$${amount.toLocaleString('es-AR')}`;
}

export const formatArs = formatArsPrice;

