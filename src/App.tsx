import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import { ThemeProvider } from './lib/themeContext';
import { ToastProvider } from './components/ui/Toast';

import { AppLayout } from './components/layout/AppLayout';
import { LandingView } from './features/public/LandingView';
import { LoginView } from './features/auth/LoginView';
import { ArrepentimientoView } from './features/public/ArrepentimientoView';
import { UiGalleryView } from './features/public/UiGalleryView';
import { LegalPageView } from './features/public/LegalPageView';
import { NotFoundView } from './features/public/NotFoundView';
import { RedirectScanView } from './features/public/RedirectScanView';

import { RoleProtectedRoute } from './components/auth/RoleProtectedRoute';

// Business views (wrapped inside AppLayout)
import { BusinessDashboard } from './features/business/BusinessDashboard';
import { CartelesView } from './features/business/CartelesView';
import { ChannelsView } from './features/business/ChannelsView';
import { ReportsView } from './features/business/ReportsView';
import { StaffView } from './features/business/StaffView';
import { AccountView } from './features/business/AccountView';

// Manufacturer view (wrapped inside AppLayout)
import { ManufacturerDashboard } from './features/manufacturer/ManufacturerDashboard';

// Super Admin & Status views
import { AdminDashboard } from './features/admin/AdminDashboard';
import { StatusPageView } from './features/status/StatusPageView';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Página Principal (Home con Hero RIVR + Secciones Toque) */}
              <Route path="/" element={<LandingView />} />

              {/* Acceso y autenticación */}
              <Route path="/login" element={<LoginView />} />

              {/* Redirección rápida de escaneo de cartel físico (/r/:shortCode) */}
              <Route path="/r/:shortCode" element={<RedirectScanView />} />

              {/* Rutas de Paneles con Liquid Glass montadas sobre AppLayout con protección estricta por rol */}
              <Route element={<AppLayout />}>
                {/* 1. Panel de Negocio (Exclusivo comercios y staff) */}
                <Route element={<RoleProtectedRoute allowedRoles={['business_owner', 'business_staff']} />}>
                  <Route path="/resumen" element={<BusinessDashboard />} />
                  <Route path="/carteles" element={<CartelesView />} />
                  <Route path="/canales" element={<ChannelsView />} />
                  <Route path="/reportes" element={<ReportsView />} />
                  <Route path="/equipo" element={<StaffView />} />
                </Route>

                {/* 2. Panel de Fabricante (Exclusivo imprentas y talleres) */}
                <Route element={<RoleProtectedRoute allowedRoles={['manufacturer_admin']} />}>
                  <Route path="/fabricante" element={<ManufacturerDashboard />} />
                  <Route path="/fabricante/*" element={<ManufacturerDashboard />} />
                </Route>

                {/* Redirección preventiva de /admin (bloqueado) */}
                <Route path="/admin" element={<Navigate to="/resumen" replace />} />
                <Route path="/admin/*" element={<Navigate to="/resumen" replace />} />

                {/* 4. Configuración de Cuenta y Perfil (Para cualquier usuario autenticado) */}
                <Route element={<RoleProtectedRoute allowedRoles={['business_owner', 'business_staff', 'manufacturer_admin', 'platform_admin']} />}>
                  <Route path="/cuenta" element={<AccountView />} />
                </Route>
              </Route>

              {/* Redirecciones canónicas auxiliares */}
              <Route
                path="/panel"
                element={
                  <RoleProtectedRoute allowedRoles={['business_owner', 'business_staff', 'manufacturer_admin', 'platform_admin']}>
                    <Navigate to="/resumen" replace />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['business_owner', 'business_staff', 'manufacturer_admin', 'platform_admin']}>
                    <Navigate to="/resumen" replace />
                  </RoleProtectedRoute>
                }
              />

              {/* Monitor de Estado en Vivo */}
              <Route path="/status" element={<StatusPageView />} />

              {/* Páginas Legales y Auxiliares */}
              <Route path="/terminos" element={<LegalPageView forcedDocId="terminos" />} />
              <Route path="/privacidad" element={<LegalPageView forcedDocId="privacidad" />} />
              <Route path="/cookies" element={<LegalPageView forcedDocId="cookies" />} />
              <Route path="/reembolso" element={<LegalPageView forcedDocId="reembolso" />} />
              <Route path="/legal/:docId" element={<LegalPageView />} />
              <Route path="/arrepentimiento" element={<ArrepentimientoView />} />
              <Route path="/ui" element={<UiGalleryView />} />
              <Route path="/ui-gallery" element={<UiGalleryView />} />

              {/* 404 Not Found */}
              <Route path="*" element={<NotFoundView />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
