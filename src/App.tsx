import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import { ThemeProvider } from './lib/themeContext';
import { ToastProvider } from './components/ui/Toast';
import { Skeleton } from './components/ui/Skeleton';
import { RoleRouteGuard } from './components/auth/RoleRouteGuard';
import { SECURITY_LOCKDOWN } from './lib/lockdown';
import { CookieBanner } from './features/public/CookieBanner';

// Lazy loading de todas las vistas para carga ultra rápida en móvil y desktop
const LandingView = lazy(() =>
  import('./features/public/LandingView').then((m) => ({ default: m.LandingView }))
);
const PricingView = lazy(() =>
  import('./features/public/PricingView').then((m) => ({ default: m.PricingView }))
);
const LegalPageView = lazy(() =>
  import('./features/public/LegalPageView').then((m) => ({ default: m.LegalPageView }))
);
const ArrepentimientoView = lazy(() =>
  import('./features/public/ArrepentimientoView').then((m) => ({ default: m.ArrepentimientoView }))
);
const ConsumerVaultView = lazy(() =>
  import('./features/public/ConsumerVaultView').then((m) => ({ default: m.ConsumerVaultView }))
);
const FaqPageView = lazy(() =>
  import('./features/public/PublicPagesView').then((m) => ({ default: m.FaqPageView }))
);
const ForClientsPageView = lazy(() =>
  import('./features/public/PublicPagesView').then((m) => ({ default: m.ForClientsPageView }))
);
const UpcomingProductPageView = lazy(() =>
  import('./features/public/PublicPagesView').then((m) => ({ default: m.UpcomingProductPageView }))
);
const ClientClubOnboardingView = lazy(() =>
  import('./features/club/ClientClubOnboardingView').then((m) => ({
    default: m.ClientClubOnboardingView,
  }))
);
const LoginView = lazy(() =>
  import('./features/auth/LoginView').then((m) => ({ default: m.LoginView }))
);
const RegisterView = lazy(() =>
  import('./features/auth/RegisterView').then((m) => ({ default: m.RegisterView }))
);
const ActivateCartelView = lazy(() =>
  import('./features/activation/ActivationView').then((m) => ({ default: m.ActivationView }))
);
const PublicHubView = lazy(() =>
  import('./features/hub/PublicHubView').then((m) => ({ default: m.PublicHubView }))
);
const ReceiptDetailView = lazy(() =>
  import('./features/hub/ReceiptDetailView').then((m) => ({ default: m.ReceiptDetailView }))
);
const CashierView = lazy(() =>
  import('./features/cashier/CashierView').then((m) => ({ default: m.CashierView }))
);
const PanelLayout = lazy(() =>
  import('./components/layout/PanelLayout').then((m) => ({ default: m.PanelLayout }))
);
const DashboardSummaryView = lazy(() =>
  import('./features/panel/DashboardSummaryView').then((m) => ({ default: m.DashboardSummaryView }))
);
const CartelesManagementView = lazy(() =>
  import('./features/panel/CartelesManagementView').then((m) => ({
    default: m.CartelesManagementView,
  }))
);
const HubEditorView = lazy(() =>
  import('./features/panel/HubEditorView').then((m) => ({ default: m.HubEditorView }))
);
const ProductsView = lazy(() =>
  import('./features/panel/ProductsView').then((m) => ({ default: m.ProductsView }))
);
const LoyaltyClubView = lazy(() =>
  import('./features/panel/ClubView').then((m) => ({ default: m.ClubView }))
);
const ClubScannerView = lazy(() =>
  import('./features/panel/ClubScannerView').then((m) => ({ default: m.ClubScannerView }))
);
const ClubNotificationsView = lazy(() =>
  import('./features/panel/ClubNotificationsView').then((m) => ({
    default: m.ClubNotificationsView,
  }))
);
const ClubLocalsView = lazy(() =>
  import('./features/panel/ClubLocalsView').then((m) => ({ default: m.ClubLocalsView }))
);
const ClubAuditView = lazy(() =>
  import('./features/panel/ClubAuditView').then((m) => ({ default: m.ClubAuditView }))
);
const TeamView = lazy(() =>
  import('./features/panel/TeamView').then((m) => ({ default: m.TeamView }))
);
const AccountSettingsView = lazy(() =>
  import('./features/panel/AccountSettingsView').then((m) => ({ default: m.AccountSettingsView }))
);
const SuperAdminView = lazy(() =>
  import('./features/admin/SuperAdminView').then((m) => ({ default: m.SuperAdminView }))
);
const ReviewsStatsView = lazy(() =>
  import('./features/panel/ReviewsStatsView').then((m) => ({ default: m.ReviewsStatsView }))
);
const ManufacturerView = lazy(() =>
  import('./features/manufacturer/ManufacturerView').then((m) => ({ default: m.ManufacturerView }))
);
const NotFoundView = lazy(() =>
  import('./features/public/NotFoundView').then((m) => ({ default: m.NotFoundView }))
);

const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-[#0C0C0E] flex items-center justify-center p-6">
    <div className="max-w-sm w-full space-y-4">
      <Skeleton className="h-10 w-44 mx-auto rounded-xl bg-[#141418]" />
      <Skeleton className="h-44 w-full rounded-2xl bg-[#141418]" />
      <Skeleton className="h-28 w-full rounded-2xl bg-[#141418]" />
    </div>
  </div>
);

const MaintenanceLockdownView: React.FC = () => (
  <div className="min-h-screen bg-[#0C0C0E] text-[#F4F4F6] flex flex-col items-center justify-center p-6 text-center">
    <div className="max-w-md w-full rounded-2xl bg-[#141418] border border-[#282830] p-8 space-y-4">
      <p className="text-lg font-semibold text-[#F4F4F6]">
        Estamos reforzando la seguridad. Volvemos pronto.
      </p>
      <div className="pt-2 flex items-center justify-center gap-4 text-xs text-[#9E9EA8]">
        <Link to="/" className="hover:text-[#F4F4F6] underline">
          Inicio
        </Link>
        <span>·</span>
        <Link to="/precios" className="hover:text-[#F4F4F6] underline">
          Precios
        </Link>
        <span>·</span>
        <Link to="/terminos" className="hover:text-[#F4F4F6] underline">
          Legales
        </Link>
      </div>
    </div>
  </div>
);

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Rutas Públicas Permitidas Siempre */}
                <Route path="/" element={<LandingView />} />
                <Route path="/precios" element={<PricingView />} />
                <Route path="/preguntas" element={<FaqPageView />} />
                <Route path="/para-clientes" element={<ForClientsPageView />} />

                {/* Páginas Legales y Consentimientos */}
                <Route path="/terminos" element={<LegalPageView docKey="terminos" />} />
                <Route path="/privacidad" element={<LegalPageView docKey="privacidad" />} />
                <Route path="/cookies" element={<LegalPageView docKey="cookies" />} />
                <Route path="/reembolso" element={<LegalPageView docKey="reembolso" />} />
                <Route path="/arrepentimiento" element={<ArrepentimientoView />} />

                {SECURITY_LOCKDOWN ? (
                  <Route path="*" element={<MaintenanceLockdownView />} />
                ) : (
                  <>
                    <Route path="/club" element={<ClientClubOnboardingView />} />
                    <Route path="/club/:codigoLocal" element={<ClientClubOnboardingView />} />
                    <Route
                      path="/estrellas"
                      element={<UpcomingProductPageView product="estrellas" />}
                    />
                    <Route
                      path="/recibo"
                      element={<UpcomingProductPageView product="recibo" />}
                    />
                    <Route path="/toquecitos" element={<ConsumerVaultView />} />
                    <Route path="/mi-toque" element={<Navigate to="/toquecitos" replace />} />
                    <Route path="/login" element={<LoginView />} />
                    <Route path="/ingresar" element={<LoginView />} />
                    <Route path="/registro" element={<RegisterView />} />

                    {/* Activación de Cartel Físico y Panel de Fabricante */}
                    <Route path="/activar" element={<ActivateCartelView />} />
                    <Route path="/activar/:code" element={<ActivateCartelView />} />
                    <Route path="/fabricante" element={<ManufacturerView />} />

                    {/* Hub Público del Cliente + Tarjeta de Sellos (QR / NFC / Slug) */}
                    <Route path="/u/:code" element={<PublicHubView />} />
                    <Route path="/h/:code" element={<PublicHubView />} />
                    <Route path="/hub/:code" element={<PublicHubView />} />

                    {/* Comprobante Digital de Compra o Redirección Smart Hub */}
                    <Route path="/r/:id" element={<ReceiptDetailView />} />

                    {/* 2. Caja (POS) — Accesible para Cajero, Encargado, Dueño y SuperAdmin */}
                    <Route
                      path="/caja"
                      element={
                        <RoleRouteGuard allowedRoles={['cashier', 'manager', 'owner', 'superadmin']}>
                          <CashierView />
                        </RoleRouteGuard>
                      }
                    />

                    {/* Panel del Comercio (5 Secciones Limpias) */}
                    <Route
                      path="/panel"
                      element={
                        <RoleRouteGuard allowedRoles={['owner', 'manager', 'cashier', 'superadmin']}>
                          <PanelLayout />
                        </RoleRouteGuard>
                      }
                    >
                      <Route index element={<Navigate to="/panel/resumen" replace />} />
                      {/* 1. Resumen */}
                      <Route
                        path="resumen"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <DashboardSummaryView />
                          </RoleRouteGuard>
                        }
                      />
                      {/* 3. Tarjetas (Unifica editor de tarjeta, clientes, escáner pistola y avisos) */}
                      <Route
                        path="tarjetas"
                        element={
                          <RoleRouteGuard
                            allowedRoles={['owner', 'manager', 'cashier', 'superadmin']}
                          >
                            <LoyaltyClubView />
                          </RoleRouteGuard>
                        }
                      />
                      <Route
                        path="fidelidad"
                        element={
                          <RoleRouteGuard
                            allowedRoles={['owner', 'manager', 'cashier', 'superadmin']}
                          >
                            <LoyaltyClubView />
                          </RoleRouteGuard>
                        }
                      />
                      <Route
                        path="clientes"
                        element={<Navigate to="/panel/tarjetas" replace />}
                      />
                      <Route path="club" element={<Navigate to="/panel/tarjetas" replace />} />
                      <Route
                        path="escanear"
                        element={
                          <RoleRouteGuard
                            allowedRoles={['owner', 'manager', 'cashier', 'superadmin']}
                          >
                            <ClubScannerView />
                          </RoleRouteGuard>
                        }
                      />
                      <Route
                        path="avisos"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <ClubNotificationsView />
                          </RoleRouteGuard>
                        }
                      />
                      {/* 4. Locales y Carteles (Unifica sucursales, carteles NFC/QR, Hub y Kit Imprimible) */}
                      <Route
                        path="locales"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <ClubLocalsView />
                          </RoleRouteGuard>
                        }
                      />
                      <Route
                        path="carteles"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <CartelesManagementView />
                          </RoleRouteGuard>
                        }
                      />
                      <Route
                        path="hub"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <HubEditorView />
                          </RoleRouteGuard>
                        }
                      />
                      <Route
                        path="resenas"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <ReviewsStatsView />
                          </RoleRouteGuard>
                        }
                      />
                      <Route
                        path="canales"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <HubEditorView />
                          </RoleRouteGuard>
                        }
                      />
                      <Route
                        path="productos"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <ProductsView />
                          </RoleRouteGuard>
                        }
                      />
                      <Route
                        path="correcciones"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <ClubAuditView />
                          </RoleRouteGuard>
                        }
                      />
                      {/* Red de Beneficios eliminada: redirige a Resumen */}
                      <Route path="red" element={<Navigate to="/panel/resumen" replace />} />

                      {/* 5. Equipo y Cuenta (Unifica colaboradores, roles y Plan/Suscripción) */}
                      <Route
                        path="equipo"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <TeamView />
                          </RoleRouteGuard>
                        }
                      />
                      <Route path="suscripcion" element={<Navigate to="/panel/cuenta" replace />} />
                      <Route
                        path="cuenta"
                        element={
                          <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                            <AccountSettingsView />
                          </RoleRouteGuard>
                        }
                      />
                    </Route>

                    {/* Super Admin Global: Estricto para fedeeeloiss@gmail.com y toque_admins */}
                    <Route
                      path="/admin"
                      element={
                        <RoleRouteGuard allowedRoles={['superadmin']}>
                          <SuperAdminView />
                        </RoleRouteGuard>
                      }
                    />

                    {/* Pantalla 404 */}
                    <Route path="*" element={<NotFoundView />} />
                  </>
                )}
              </Routes>
              <CookieBanner />
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
