/**
 * Toque — Configuración Centralizada de Planes y Límites de Funciones
 * - Gratuito (free): 1 sola tarjeta, sin POS, solo 1 local, y hasta 2 usuarios en el panel + el creador (3 en total).
 * - Pago (pago / mensual / anual): Hub + tarjetas + POS, hasta 3 sucursales, hasta 3 tarjetas, equipo ilimitado, mayores estadísticas.
 * - A consultar (a_consultar): Hub + tarjetas + POS, sucursales ilimitadas, tarjetas ilimitadas, equipo ilimitado, y todo a su medida necesaria.
 */

export type PlanId = 'free' | 'mensual' | 'anual' | 'a_consultar';
export type PlanTier = 'free' | 'pro' | 'custom';

export interface PlanLimits {
  label: string;
  maxCards: number;
  posEnabled: boolean;
  maxLocals: number;
  maxTeamTotal: number; // Incluye al creador
  advancedStats: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  tier: PlanTier;
  name: string;
  shortName: string;
  periodLabel: string;
  priceMonthlyArs: number;
  totalPriceArs: number;
  priceArs: number;
  description: string;
  billingNote: string;
  savingsBadge?: string;
  badge?: string;
  trialDays: number;
  limits: PlanLimits;
  features: string[];
}

export const TRIAL_DAYS = 14;
export const BASE_MONTHLY_PRICE_ARS = 34999;
export const ANNUAL_MONTHS_CHARGED = 10;
export const ANNUAL_TOTAL_PRICE_ARS = BASE_MONTHLY_PRICE_ARS * ANNUAL_MONTHS_CHARGED;
export const ANNUAL_EFFECTIVE_MONTHLY_ARS = Math.round(ANNUAL_TOTAL_PRICE_ARS / 12);

export const PLAN_LIMITS_BY_ID: Record<PlanId, PlanLimits> = {
  free: {
    label: 'Gratuito',
    maxCards: 1,
    posEnabled: false,
    maxLocals: 1,
    maxTeamTotal: 3, // 2 usuarios en el panel + el creador
    advancedStats: false,
  },
  mensual: {
    label: 'Pago',
    maxCards: 3,
    posEnabled: true,
    maxLocals: 3,
    maxTeamTotal: 9999,
    advancedStats: true,
  },
  anual: {
    label: 'Pago',
    maxCards: 3,
    posEnabled: true,
    maxLocals: 3,
    maxTeamTotal: 9999,
    advancedStats: true,
  },
  a_consultar: {
    label: 'A consultar',
    maxCards: 9999,
    posEnabled: true,
    maxLocals: 9999,
    maxTeamTotal: 9999,
    advancedStats: true,
  },
};

export function getPlanLimits(planId?: string): PlanLimits {
  if (planId === 'free') return PLAN_LIMITS_BY_ID.free;
  if (planId === 'a_consultar') return PLAN_LIMITS_BY_ID.a_consultar;
  return PLAN_LIMITS_BY_ID.anual;
}

export const TOQUE_PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    tier: 'free',
    name: 'Plan Gratuito',
    shortName: 'Gratuito',
    periodLabel: 'sin cargo',
    priceMonthlyArs: 0,
    totalPriceArs: 0,
    priceArs: 0,
    description: '1 sola tarjeta, sin POS, 1 local y hasta 2 usuarios + el creador (3 en total).',
    billingNote: 'Sin costo mensual.',
    trialDays: 0,
    limits: PLAN_LIMITS_BY_ID.free,
    features: [
      '1 tarjeta de sellos con Wallet',
      'Sin terminal POS de caja',
      '1 solo local habilitado',
      'Hasta 2 usuarios en el panel + el creador (3 en total)',
    ],
  },
  mensual: {
    id: 'mensual',
    tier: 'pro',
    name: 'Plan Pago (Mensual)',
    shortName: 'Pago',
    periodLabel: 'por mes',
    priceMonthlyArs: BASE_MONTHLY_PRICE_ARS,
    totalPriceArs: BASE_MONTHLY_PRICE_ARS,
    priceArs: BASE_MONTHLY_PRICE_ARS,
    description: 'Hub + tarjetas + POS, hasta 3 sucursales, hasta 3 tarjetas, equipo ilimitado y mayores estadísticas.',
    billingNote: 'Suscripción mensual activa.',
    trialDays: 0,
    limits: PLAN_LIMITS_BY_ID.mensual,
    features: [
      'Hub + Tarjetas + Caja POS habilitados',
      'Hasta 3 sucursales',
      'Hasta 3 tarjetas de fidelidad activas',
      'Equipo ilimitado (Dueño, Encargados y Cajeros)',
      'Mayores estadísticas y métricas de retorno',
    ],
  },
  anual: {
    id: 'anual',
    tier: 'pro',
    name: 'Plan Pago (Anual)',
    shortName: 'Pago',
    periodLabel: 'por año (14 días de prueba)',
    priceMonthlyArs: ANNUAL_EFFECTIVE_MONTHLY_ARS,
    totalPriceArs: ANNUAL_TOTAL_PRICE_ARS,
    priceArs: ANNUAL_TOTAL_PRICE_ARS,
    description: 'Hub + tarjetas + POS, hasta 3 sucursales, hasta 3 tarjetas, equipo ilimitado y mayores estadísticas.',
    billingNote: `Incluye ${TRIAL_DAYS} días de prueba y 2 meses bonificados.`,
    savingsBadge: '14 días de prueba + 2 meses sin cargo',
    badge: '14 días de prueba',
    trialDays: TRIAL_DAYS,
    limits: PLAN_LIMITS_BY_ID.anual,
    features: [
      'Hub + Tarjetas + Caja POS habilitados',
      'Hasta 3 sucursales',
      'Hasta 3 tarjetas de fidelidad activas',
      'Equipo ilimitado (Dueño, Encargados y Cajeros)',
      'Mayores estadísticas y métricas de retorno',
    ],
  },
  a_consultar: {
    id: 'a_consultar',
    tier: 'custom',
    name: 'Plan A Consultar',
    shortName: 'A consultar',
    periodLabel: 'a medida',
    priceMonthlyArs: 0,
    totalPriceArs: 0,
    priceArs: 0,
    description: 'Hub + tarjetas + POS, sucursales ilimitadas, tarjetas ilimitadas, equipo ilimitado y todo a su medida.',
    billingNote: 'Plan corporativo a medida.',
    badge: 'A medida',
    trialDays: 0,
    limits: PLAN_LIMITS_BY_ID.a_consultar,
    features: [
      'Hub + Tarjetas + Caja POS completos',
      'Sucursales ilimitadas',
      'Tarjetas ilimitadas',
      'Equipo ilimitado',
      'Configuración y soporte todo a su medida necesaria',
    ],
  },
};

export const TOQUE_PLANS_LIST: PlanDefinition[] = [
  TOQUE_PLANS.mensual,
  TOQUE_PLANS.anual,
  TOQUE_PLANS.a_consultar,
];

export const PLANS: PlanDefinition[] = [
  TOQUE_PLANS.free,
  TOQUE_PLANS.mensual,
  TOQUE_PLANS.anual,
  TOQUE_PLANS.a_consultar,
];

export function formatArsPrice(amount: number): string {
  return `$${amount.toLocaleString('es-AR')}`;
}

export const formatArs = formatArsPrice;
