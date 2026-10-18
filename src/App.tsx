import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './components/ui/Skeleton';
import { PanelLayout } from './components/layout/PanelLayout';

const LoginView = lazy(() => import('./features/auth/LoginView').then((m) => ({ default: m.LoginView })));
const RegisterView = lazy(() => import('./features/auth/RegisterView').then((m) => ({ default: m.RegisterView })));
const ActivationView = lazy(() => import('./features/activation/ActivationView').then((m) => ({ default: m.ActivationView })));
const PublicHubView = lazy(() => import('./features/hub/PublicHubView').then((m) => ({ default: m.PublicHubView })));
const ReceiptDetailView = lazy(() => import('./features/hub/ReceiptDetailView').then((m) => ({ default: m.ReceiptDetailView })));
const CashierView = lazy(() => import('./features/cashier/CashierView').then((m) => ({ default: m.CashierView })));

// Vistas del Panel
const DashboardSummaryView = lazy(() => import('./features/panel/DashboardSummaryView').then((m) => ({ default: m.DashboardSummaryView })));
const SalesView = lazy(() => import('./features/panel/SalesView').then((m) => ({ default: m.SalesView })));
const CartelesManagementView = lazy(() => import('./features/panel/CartelesManagementView').then((m) => ({ default: m.CartelesManagementView })));
const HubEditorView = lazy(() => import('./features/panel/HubEditorView').then((m) => ({ default: m.HubEditorView })));
const ClubView = lazy(() => import('./features/panel/ClubView').then((m) => ({ default: m.ClubView })));
const TeamView = lazy(() => import('./features/panel/TeamView').then((m) => ({ default: m.TeamView })));
const ReviewsStatsView = lazy(() => import('./features/panel/ReviewsStatsView').then((m) => ({ default: m.ReviewsStatsView })));
const AccountSettingsView = lazy(() => import('./features/panel/AccountSettingsView').then((m) => ({ default: m.AccountSettingsView })));

// Super Admin Global de la Plataforma
const SuperAdminView = lazy(() => import('./features/admin/SuperAdminView').then((m) => ({ default: m.SuperAdminView })));

// Precios y Planes
const PricingView = lazy(() => import('./features/public/PricingView').then((m) => ({ default: m.PricingView })));

// Landing Page Oficial
const LandingView = lazy(() => import('./features/public/LandingView').then((m) => ({ default: m.LandingView })));

const PageFallback: React.FC = () => (
  <div className="min-h-screen bg-[#000000] flex items-center justify-center p-6">
    <div className="max-w-sm w-full space-y-4">
      <Skeleton className="h-10 w-44 mx-auto rounded-xl bg-[#111113]" />
      <Skeleton className="h-44 w-full rounded-2xl bg-[#111113]" />
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

                {/* Hub público del cliente (/h/:code y /hub/:code) */}
                <Route path="/h/:code" element={<PublicHubView />} />
                <Route path="/hub/:code" element={<PublicHubView />} />

                {/* Comprobante Digital Directo (/r/:code y /recibo/:code) */}
                <Route path="/r/:code" element={<ReceiptDetailView />} />
                <Route path="/recibo/:code" element={<ReceiptDetailView />} />

                {/* Pantalla del cajero (/caja) */}
                <Route path="/caja" element={<CashierView />} />

                {/* Acceso directo a /resumen */}
                <Route path="/resumen" element={<PanelLayout />}>
                  <Route index element={<DashboardSummaryView />} />
                </Route>

                {/* Panel de administración del negocio (/panel/*) */}
                <Route path="/panel" element={<PanelLayout />}>
                  <Route index element={<DashboardSummaryView />} />
                  <Route path="resumen" element={<DashboardSummaryView />} />
                  <Route path="ventas" element={<SalesView />} />
                  <Route path="reportes" element={<SalesView />} />
                  <Route path="carteles" element={<CartelesManagementView />} />
                  <Route path="hub" element={<HubEditorView />} />
                  <Route path="canales" element={<HubEditorView />} />
                  <Route path="club" element={<ClubView />} />
                  <Route path="equipo" element={<TeamView />} />
                  <Route path="resenas" element={<ReviewsStatsView />} />
                  <Route path="cuenta" element={<AccountSettingsView />} />
                </Route>

                {/* Panel Super Admin Global (/admin) */}
                <Route path="/admin" element={<SuperAdminView />} />

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
