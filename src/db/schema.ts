import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Tenants (Plataforma, Fabricantes, Negocios)
export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'platform' | 'manufacturer' | 'business'
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  brandColor: text('brand_color'),
  brandLogo: text('brand_logo'),
  contactEmail: text('contact_email').notNull(),
  manufacturerId: text('manufacturer_id'),
  isDemo: boolean('is_demo').default(false),
  features: jsonb('features'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Users (RBAC)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'platform_admin' | 'manufacturer_admin' | 'business_owner' | 'business_staff'
  avatarUrl: text('avatar_url'),
  hasSeenOnboarding: boolean('has_seen_onboarding').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Carteles Físicos
export const carteles = pgTable('carteles', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  businessId: text('business_id').notNull(),
  manufacturerId: text('manufacturer_id'),
  shortCode: text('short_code').notNull().unique(),
  name: text('name').notNull(),
  locationDescription: text('location_description'),
  targetUrl: text('target_url').notNull(),
  nfcEnabled: boolean('nfc_enabled').default(true),
  qrEnabled: boolean('qr_enabled').default(true),
  status: text('status').default('active'), // 'active' | 'inactive' | 'replaced' | 'trash'
  lastScannedAt: timestamp('last_scanned_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Telemetría de Escaneos (datos capturados en <45ms)
export const scans = pgTable('scans', {
  id: serial('id').primaryKey(),
  cartelId: text('cartel_id').notNull(),
  businessId: text('business_id').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  channel: text('channel').default('qr'), // 'nfc' | 'qr'
  userAgentDevice: text('user_agent_device'),
  browser: text('browser'),
  platform: text('platform'),
  screenResolution: text('screen_resolution'),
  language: text('language'),
  connectionType: text('connection_type'),
  timezone: text('timezone'),
  referrer: text('referrer'),
  isEstimatedReview: boolean('is_estimated_review').default(false),
});

// 5. Equipo / Staff del Salón (sin QRs)
export const staff = pgTable('staff', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(), // Mozo, Barista, Encargado, etc.
  shift: text('shift'), // Mañana, Tarde, Noche
  scansThisMonth: integer('scans_this_month').default(0),
  rank: integer('rank').default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relaciones
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  carteles: many(carteles),
}));

export const cartelesRelations = relations(carteles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [carteles.tenantId],
    references: [tenants.id],
  }),
  scans: many(scans),
}));

export const scansRelations = relations(scans, ({ one }) => ({
  cartel: one(carteles, {
    fields: [scans.cartelId],
    references: [carteles.id],
  }),
}));
