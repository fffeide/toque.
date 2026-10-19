import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import { ThemeProvider } from './lib/themeContext';
import { ToastProvider } from './components/ui/Toast';
import { Skeleton } from './components/ui/Skeleton';
import { RoleRouteGuard } from './components/auth/RoleRouteGuard';

// Lazy loading de todas las vistas para carga ultra rápida en móvil y desktop
const LandingView = lazy(() =>
  import('./features/public/LandingView').then((m) => ({ default: m.LandingView }))
);
const PricingView = lazy(() =>
  import('./features/public/PricingView').then((m) => ({ default: m.PricingView }))
);
const ConsumerVaultView = lazy(() =>
  import('./features/public/ConsumerVaultView').then((m) => ({ default: m.ConsumerVaultView }))
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
const BenefitNetworkView = lazy(() =>
  import('./features/panel/NetworkActivationsView').then((m) => ({
    default: m.NetworkActivationsView,
  }))
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

const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-[#000000] flex items-center justify-center p-6">
    <div className="max-w-sm w-full space-y-4">
      <Skeleton className="h-10 w-44 mx-auto rounded-xl bg-[#111113]" />
      <Skeleton className="h-44 w-full rounded-2xl bg-[#111113]" />
      <Skeleton className="h-28 w-full rounded-2xl bg-[#111113]" />
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
                {/* Rutas Públicas */}
                <Route path="/" element={<LandingView />} />
                <Route path="/precios" element={<PricingView />} />
                <Route path="/toquecitos" element={<ConsumerVaultView />} />
                <Route path="/mi-toque" element={<Navigate to="/toquecitos" replace />} />
                <Route path="/login" element={<LoginView />} />
                <Route path="/registro" element={<RegisterView />} />

                {/* Activación de Cartel Físico */}
                <Route path="/activar" element={<ActivateCartelView />} />
                <Route path="/activar/:code" element={<ActivateCartelView />} />

                {/* Hub Público del Cliente (QR / NFC) — Fondo Blanco + Botones Negros */}
                <Route path="/h/:code" element={<PublicHubView />} />
                <Route path="/hub/:code" element={<PublicHubView />} />

                {/* Comprobante Digital de Compra */}
                <Route path="/r/:id" element={<ReceiptDetailView />} />

                {/* Modo Caja — Accesible para Cajero, Encargado, Dueño y SuperAdmin */}
                <Route
                  path="/caja"
                  element={
                    <RoleRouteGuard allowedRoles={['cashier', 'manager', 'owner', 'superadmin']}>
                      <CashierView />
                    </RoleRouteGuard>
                  }
                />

                {/* Panel del Comercio — Cajero solo ve Resumen y Mis Carteles (sin datos de dinero ni sensibles) */}
                <Route
                  path="/panel"
                  element={
                    <RoleRouteGuard allowedRoles={['owner', 'manager', 'cashier', 'superadmin']}>
                      <PanelLayout />
                    </RoleRouteGuard>
                  }
                >
                  <Route index element={<Navigate to="/panel/resumen" replace />} />
                  <Route path="resumen" element={<DashboardSummaryView />} />
                  <Route path="carteles" element={<CartelesManagementView />} />
                  <Route
                    path="hub"
                    element={
                      <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                        <HubEditorView />
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
                    path="fidelidad"
                    element={
                      <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                        <LoyaltyClubView />
                      </RoleRouteGuard>
                    }
                  />
                  <Route
                    path="club"
                    element={
                      <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                        <LoyaltyClubView />
                      </RoleRouteGuard>
                    }
                  />
                  <Route
                    path="red"
                    element={
                      <RoleRouteGuard allowedRoles={['owner', 'manager', 'superadmin']}>
                        <BenefitNetworkView />
                      </RoleRouteGuard>
                    }
                  />
                  <Route
                    path="equipo"
                    element={
                      <RoleRouteGuard allowedRoles={['owner', 'superadmin']}>
                        <TeamView />
                      </RoleRouteGuard>
                    }
                  />
                  <Route
                    path="cuenta"
                    element={
                      <RoleRouteGuard allowedRoles={['owner', 'superadmin']}>
                        <AccountSettingsView />
                      </RoleRouteGuard>
                    }
                  />
                </Route>

                {/* Super Admin Global — Exclusivo para SuperAdmin */}
                <Route
                  path="/admin"
                  element={
                    <RoleRouteGuard allowedRoles={['superadmin']}>
                      <SuperAdminView />
                    </RoleRouteGuard>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
