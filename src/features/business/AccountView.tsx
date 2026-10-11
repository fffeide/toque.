/**
 * Toque — Mi Cuenta y Preferencias (AccountView)
 * Características:
 * - Datos del negocio
 * - Marca del fabricante visible con soporte directo a su WhatsApp
 * - Apariencia: tema (claro/oscuro/sistema), color de acento, densidad, tamaño de texto
 * - Preferencias de notificaciones
 * - Exportar mis datos (descarga en CSV/JSON)
 * - Botón para repasar el tutorial de bienvenida (Onboarding)
 * - Cerrar sesión
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { useTheme } from '../../lib/themeContext';
import { api, Tenant } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Avatar, BrandLogo } from '../../components/ui/Avatar';
import { BusinessOnboardingModal } from './BusinessOnboardingModal';
import { useToast } from '../../components/ui/Toast';
import {
  User,
  Sun,
  Sliders,
  Building,
  LogOut,
  Check,
  MessageSquare,
  Download,
  Bell,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Type,
  Palette,
  Phone,
  Edit2,
} from 'lucide-react';

export const AccountView: React.FC = () => {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const { density, setDensity, brandColor, setBrandColor, contrastInfo } = useTheme();
  const { success } = useToast();

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [textSize, setTextSize] = useState<'normal' | 'large'>('normal');
  const [assignedMfg, setAssignedMfg] = useState<{
    name: string;
    phone: string;
    city: string;
    email: string;
  }>({
    name: 'Red Oficial Toque Fabricantes — Taller Buenos Aires',
    phone: '+54 9 11 5263-8900',
    city: 'CABA y GBA, Argentina',
    email: 'fabricantes@toque.ar',
  });
  const [isEditingMfg, setIsEditingMfg] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      success('Sesión cerrada', 'Has cerrado sesión correctamente.');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  // Notificaciones
  const [notifyInactivity, setNotifyInactivity] = useState(true);
  const [notifyWeeklyReport, setNotifyWeeklyReport] = useState(true);

  // Funcionalidades opcionales (Feature flags: channels, staff)
  const [featureChannels, setFeatureChannels] = useState<boolean>(() => {
    const saved = localStorage.getItem(`toque_flag_channels_${tenant?.id || 'default'}`);
    return saved !== null ? saved === 'true' : (tenant?.features?.channels ?? true);
  });
  const [featureStaff, setFeatureStaff] = useState<boolean>(() => {
    const saved = localStorage.getItem(`toque_flag_staff_${tenant?.id || 'default'}`);
    return saved !== null ? saved === 'true' : (tenant?.features?.staff ?? true);
  });

  const handleToggleFeature = (feature: 'channels' | 'staff', value: boolean) => {
    if (feature === 'channels') {
      setFeatureChannels(value);
      localStorage.setItem(`toque_flag_channels_${tenant?.id || 'default'}`, String(value));
      if (tenant) {
        if (!tenant.features) tenant.features = {};
        tenant.features.channels = value;
      }
      success(value ? 'Módulo Canales activado' : 'Módulo Canales desactivado');
    } else {
      setFeatureStaff(value);
      localStorage.setItem(`toque_flag_staff_${tenant?.id || 'default'}`, String(value));
      if (tenant) {
        if (!tenant.features) tenant.features = {};
        tenant.features.staff = value;
      }
      success(value ? 'Módulo Equipo activado' : 'Módulo Equipo desactivado');
    }
    // Disparar evento para actualizar barra de navegación
    window.dispatchEvent(new Event('storage'));
  };

  // Paleta de acentos sugeridos con contraste garantizado
  const accentColors = [
    { name: 'Ultramar Toque', hex: '#3A3FE0' },
    { name: 'Zafiro Profundo', hex: '#1E3A8A' },
    { name: 'Esmeralda', hex: '#047857' },
    { name: 'Índigo Real', hex: '#4338CA' },
    { name: 'Vino Tinto', hex: '#881337' },
    { name: 'Carbón', hex: '#1E293B' },
  ];

  const handleExportData = async () => {
    try {
      const carteles = await api.listCarteles(tenant?.id);
      const stats = await api.getStats(tenant?.id || 'biz-esquina', 30);
      const exportPayload = {
        negocio: tenant?.name,
        fecha_exportacion: new Date().toISOString(),
        total_carteles: carteles.length,
        carteles: carteles.map((s) => ({
          nombre: s.name,
          codigo: s.shortCode,
          ubicacion: s.locationDescription,
          url_google: s.targetUrl,
          ultimo_escaneo: s.lastScannedAt,
        })),
        resumen_estadisticas: stats,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `datos-toque-${tenant?.slug || 'negocio'}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      success('Datos exportados', 'Se descargó el archivo JSON con tu historial de carteles y métricas.');
    } catch {
      // fallback
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-white">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-headline font-bold text-white tracking-tight">
          Mi Cuenta y Preferencias
        </h1>
        <p className="text-xs text-white/70 mt-0.5">
          Configuración visual, datos de tu comercio y asistencia técnica.
        </p>
      </div>

      {/* 1. MARCA DEL FABRICANTE Y SOPORTE DIRECTO (Verificado y Vinculado) */}
      <Card className="p-6 border-white/20 bg-white/10 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 border border-white/20">
              <BrandLogo
                name={assignedMfg.name}
                size="md"
                showToqueBadge={false}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 block">
                  Fabricante oficial asignado
                </span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                  ✓ Verificado Toque
                </span>
              </div>
              <h3 className="font-headline text-base font-bold text-white mt-0.5">
                {assignedMfg.name}
              </h3>
              <p className="text-xs text-white/70 mt-0.5">
                Ubicación: {assignedMfg.city} • Garantía física de acrílico y chip NTAG215.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`https://wa.me/${assignedMfg.phone.replace(/[^0-9]/g, '')}?text=Hola,%20necesito%20soporte%20sobre%20mis%20carteles%20de%20Toque%20para%20${encodeURIComponent(tenant?.name || 'mi negocio')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-xs cursor-pointer shrink-0"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp de Soporte</span>
            </a>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditingMfg(!isEditingMfg)}
              icon={<Edit2 className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              {isEditingMfg ? 'Cerrar' : 'Vincular otro'}
            </Button>
          </div>
        </div>

        {/* Editor / Vinculador de Fabricante */}
        {isEditingMfg && (
          <div className="p-4 rounded-xl bg-black/30 border border-white/15 space-y-3 pt-3 animate-in fade-in">
            <h4 className="text-xs font-bold text-white">
              Vincular o cambiar mi fabricante de carteles
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-white/70 mb-1">Nombre o Taller</label>
                <input
                  type="text"
                  value={assignedMfg.name}
                  onChange={(e) => setAssignedMfg({ ...assignedMfg, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-white/70 mb-1">WhatsApp oficial</label>
                <input
                  type="text"
                  value={assignedMfg.phone}
                  onChange={(e) => setAssignedMfg({ ...assignedMfg, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setIsEditingMfg(false);
                  success('Fabricante actualizado', 'Se guardaron los datos del fabricante para tu negocio.');
                }}
              >
                Guardar fabricante
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 2. APARIENCIA Y VISUALIZACIÓN */}
      <Card className="p-6 space-y-6">
        <h3 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
          <Sun className="w-4 h-4 text-[var(--text-muted)]" />
          <span>Apariencia y Accesibilidad</span>
        </h3>

        {/* Modo Claro / Oscuro / Sistema */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-small font-medium text-[var(--text-main)] block">
              Tema de color
            </label>
            <span className="text-micro text-[var(--text-muted)]">
              Claro, oscuro o sincronizado con tu sistema operativo.
            </span>
          </div>
          <ThemeToggle />
        </div>

        {/* Color de Acento Personalizado */}
        <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-small font-medium text-[var(--text-main)] block">
                Color de acento de marca
              </label>
              <span className="text-micro text-[var(--text-muted)]">
                Elegí el tono principal de la interfaz con contraste validado.
              </span>
            </div>

            <span className={`text-micro font-medium px-2 py-0.5 rounded-full ${contrastInfo.passesAA ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-50 text-rose-700'}`}>
              {contrastInfo.passesAA ? 'Contraste AA Seguro' : 'Ajustar contraste'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {accentColors.map((color) => (
              <button
                key={color.hex}
                type="button"
                onClick={() => {
                  setBrandColor(color.hex);
                  success('Color de marca actualizado', color.name);
                }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer shadow-xs ${
                  brandColor.toLowerCase() === color.hex.toLowerCase()
                    ? 'ring-2 ring-offset-2 ring-[var(--brand)] scale-105'
                    : 'opacity-85 hover:opacity-100'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              >
                {brandColor.toLowerCase() === color.hex.toLowerCase() && (
                  <Check className="w-4 h-4 text-white" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Densidad de Pantalla */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4">
          <div>
            <label className="text-small font-medium text-[var(--text-main)] block">
              Densidad de pantalla
            </label>
            <span className="text-micro text-[var(--text-muted)]">
              Ajusta el espaciado para ver más elementos a la vez.
            </span>
          </div>
          <SegmentedControl
            value={density}
            onChange={(d) => {
              setDensity(d);
              success('Preferencia de densidad actualizada');
            }}
            size="sm"
            options={[
              { value: 'comfortable', label: 'Cómoda' },
              { value: 'compact', label: 'Compacta' },
            ]}
          />
        </div>

        {/* Tamaño de Texto */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4">
          <div>
            <label className="text-small font-medium text-[var(--text-main)] block">
              Tamaño de tipografía
            </label>
            <span className="text-micro text-[var(--text-muted)]">
              Escala de lectura general de la interfaz.
            </span>
          </div>
          <SegmentedControl
            value={textSize}
            onChange={(s) => {
              setTextSize(s);
              document.documentElement.style.fontSize = s === 'large' ? '18px' : '16px';
              success('Tamaño de texto actualizado');
            }}
            size="sm"
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Grande' },
            ]}
          />
        </div>
      </Card>

      {/* 3. PREFERENCIAS DE NOTIFICACIONES */}
      <Card className="p-6 space-y-4">
        <h3 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
          <Bell className="w-4 h-4 text-[var(--text-muted)]" />
          <span>Alertas y Notificaciones</span>
        </h3>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-subtle)] cursor-pointer">
            <div>
              <p className="font-medium text-small text-[var(--text-main)]">
                Aviso de carteles silenciosos
              </p>
              <p className="text-micro text-[var(--text-muted)]">
                Te avisamos si un cartel pasa más de 14 días sin recibir ningún toque.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifyInactivity}
              onChange={(e) => setNotifyInactivity(e.target.checked)}
              className="w-4 h-4 text-[var(--brand)] rounded focus:ring-[var(--brand)] cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-subtle)] cursor-pointer">
            <div>
              <p className="font-medium text-small text-[var(--text-main)]">
                Resumen semanal condensado
              </p>
              <p className="text-micro text-[var(--text-muted)]">
                Reporte de 3 líneas con una sugerencia accionable cada semana.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifyWeeklyReport}
              onChange={(e) => setNotifyWeeklyReport(e.target.checked)}
              className="w-4 h-4 text-[var(--brand)] rounded focus:ring-[var(--brand)] cursor-pointer"
            />
          </label>
        </div>
      </Card>

      {/* 4. FUNCIONALIDADES AVANZADAS (FEATURE FLAGS) */}
      <Card className="p-6 space-y-4">
        <h3 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[var(--text-muted)]" />
          <span>Módulos y Funcionalidades Opcionales (Feature Flags)</span>
        </h3>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-subtle)] cursor-pointer">
            <div>
              <p className="font-medium text-small text-[var(--text-main)]">
                Canales de escaneo (WhatsApp, Ticket, Instagram, Mesa)
              </p>
              <p className="text-micro text-[var(--text-muted)]">
                Permite medir y comparar qué canal genera más reseñas en Google.
              </p>
            </div>
            <input
              type="checkbox"
              checked={featureChannels}
              onChange={(e) => handleToggleFeature('channels', e.target.checked)}
              className="w-4 h-4 text-[var(--brand)] rounded focus:ring-[var(--brand)] cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-subtle)] cursor-pointer">
            <div>
              <p className="font-medium text-small text-[var(--text-main)]">
                Equipo y reto del mes (Staff)
              </p>
              <p className="text-micro text-[var(--text-muted)]">
                QR y enlace por empleado con ranking amigable para incentivar al equipo.
              </p>
            </div>
            <input
              type="checkbox"
              checked={featureStaff}
              onChange={(e) => handleToggleFeature('staff', e.target.checked)}
              className="w-4 h-4 text-[var(--brand)] rounded focus:ring-[var(--brand)] cursor-pointer"
            />
          </label>
        </div>
      </Card>

      {/* 5. DATOS DEL COMERCIO Y ASISTENTE */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-small font-semibold text-[var(--text-main)] flex items-center gap-2">
            <Building className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Datos del Comercio</span>
          </h3>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOnboardingOpen(true)}
            icon={<Sparkles className="w-3.5 h-3.5 text-[var(--estrella)]" />}
          >
            Repasar bienvenida
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-small">
          <div>
            <span className="text-micro text-[var(--text-muted)] block">Nombre comercial</span>
            <span className="font-medium text-[var(--text-main)]">{tenant?.name}</span>
          </div>
          <div>
            <span className="text-micro text-[var(--text-muted)] block">Correo de contacto</span>
            <span className="font-medium text-[var(--text-main)]">{tenant?.contactEmail}</span>
          </div>
          <div>
            <span className="text-micro text-[var(--text-muted)] block">Identificador de cuenta</span>
            <span className="font-mono text-micro text-[var(--text-muted)]">{tenant?.id}</span>
          </div>
          <div>
            <span className="text-micro text-[var(--text-muted)] block">Estado del servicio</span>
            <span className="font-medium text-[var(--menta)]">Activo y con datos</span>
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportData}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Exportar mis datos (JSON)
          </Button>
        </div>
      </Card>

      {/* 5. CERRAR SESIÓN */}
      <div className="flex justify-end pt-2">
        <Button
          variant="secondary"
          onClick={handleLogout}
          icon={<LogOut className="w-4 h-4 text-rose-400" />}
          className="text-rose-300 hover:bg-rose-500/15 border-rose-500/30"
        >
          Cerrar sesión en este dispositivo
        </Button>
      </div>

      {/* MODAL DE ONBOARDING */}
      <BusinessOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        tenant={tenant}
      />
    </div>
  );
};
