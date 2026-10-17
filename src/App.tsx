import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './components/ui/Skeleton';
import { PanelLayout } from './components/layout/PanelLayout';

// Carga perezosa de todas las pantallas con React.lazy según requerimiento
const LoginView = lazy(() => import('./features/auth/LoginView').then(m => ({ default: m.LoginView })));
const RegisterView = lazy(() => import('./features/auth/RegisterView').then(m => ({ default: m.RegisterView })));
const ActivationView = lazy(() => import('./features/activation/ActivationView').then(m => ({ default: m.ActivationView })));
const PublicHubView = lazy(() => import('./features/hub/PublicHubView').then(m => ({ default: m.PublicHubView })));
const CashierView = lazy(() => import('./features/cashier/CashierView').then(m => ({ default: m.CashierView })));

// Vistas del Panel
const DashboardSummaryView = lazy(() => import('./features/panel/DashboardSummaryView').then(m => ({ default: m.DashboardSummaryView })));
const SalesView = lazy(() => import('./features/panel/SalesView').then(m => ({ default: m.SalesView })));
const CartelesManagementView = lazy(() => import('./features/panel/CartelesManagementView').then(m => ({ default: m.CartelesManagementView })));
const HubEditorView = lazy(() => import('./features/panel/HubEditorView').then(m => ({ default: m.HubEditorView })));
const ClubView = lazy(() => import('./features/panel/ClubView').then(m => ({ default: m.ClubView })));
const ConnectionsView = lazy(() => import('./features/panel/ConnectionsView').then(m => ({ default: m.ConnectionsView })));
const ReviewsStatsView = lazy(() => import('./features/panel/ReviewsStatsView').then(m => ({ default: m.ReviewsStatsView })));
const AccountSettingsView = lazy(() => import('./features/panel/AccountSettingsView').then(m => ({ default: m.AccountSettingsView })));

// Fabricante Admin
const BatchAdminView = lazy(() => import('./features/admin/BatchAdminView').then(m => ({ default: m.BatchAdminView })));

// Precios y Planes
const PricingView = lazy(() => import('./features/public/PricingView').then(m => ({ default: m.PricingView })));

// Landing Page Oficial
const LandingView = lazy(() => import('./features/public/LandingView').then(m => ({ default: m.LandingView })));

const PageFallback: React.FC = () => (
  <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center p-6">
    <div className="max-w-sm w-full space-y-4">
      <Skeleton className="h-10 w-44 mx-auto rounded-xl" />
      <Skeleton className="h-44 w-full rounded-2xl" />
    </div>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                {/* Landing Page Principal */}
                <Route path="/" element={<LandingView />} />
                <Route path="/landing" element={<LandingView />} />

                {/* Autenticación */}
                <Route path="/login" element={<LoginView />} />
                <Route path="/registro" element={<RegisterView />} />

                {/* Activación guiada de cartel (/activar/:code) */}
                <Route path="/activar/:code" element={<ActivationView />} />

                {/* Hub público del cliente (/h/:code) */}
                <Route path="/h/:code" element={<PublicHubView />} />

                {/* Pantalla del cajero (/caja) */}
                <Route path="/caja" element={<CashierView />} />

                {/* Panel de administración del negocio (/panel) */}
                <Route path="/panel" element={<PanelLayout />}>
                  <Route index element={<DashboardSummaryView />} />
                  <Route path="ventas" element={<SalesView />} />
                  <Route path="carteles" element={<CartelesManagementView />} />
                  <Route path="hub" element={<HubEditorView />} />
                  <Route path="club" element={<ClubView />} />
                  <Route path="conexiones" element={<ConnectionsView />} />
                  <Route path="resenas" element={<ReviewsStatsView />} />
                  <Route path="cuenta" element={<AccountSettingsView />} />
                </Route>

                {/* Admin del fabricante (/admin/lotes) */}
                <Route path="/admin/lotes" element={<BatchAdminView />} />

                {/* Planes y Precios (/precios) */}
                <Route path="/precios" element={<PricingView />} />

                {/* 404 No encontrado */}
                <Route path="*" element={<Navigate to="/panel" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
