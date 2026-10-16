/**
 * Toque — Mi Cuenta y Preferencias (AccountView)
 * Características:
 * - Datos del negocio editables y guardables (Nombre, Rubro, WhatsApp, Ciudad, Dirección, Enlace de Google Reviews)
 * - Si es fabricante: No muestra "Fabricante oficial asignado" (ellos son el fabricante)
 * - Si es negocio: Muestra fabricante asignado con WhatsApp directo
 * - Selector de color de acento con paleta visual y campo directo de HEX (#RRGGBB)
 * - Módulos opcionales eliminados de configuraciones (punto 9 y 12)
 * - Exportar datos (JSON)
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
import { BrandLogo } from '../../components/ui/Avatar';
import { BusinessOnboardingModal } from './BusinessOnboardingModal';
import { ManufacturerNetworkSection } from '../manufacturer/ManufacturerNetworkSection';
import { useToast } from '../../components/ui/Toast';
import { validateGoogleReviewUrl } from '../../lib/urlValidator';
import {
  Sun,
  Building,
  LogOut,
  Check,
  MessageSquare,
  Download,
  Bell,
  Sparkles,
  Phone,
  Edit2,
  MapPin,
  Globe,
  Tag,
  Save,
  ShieldCheck,
  Factory,
} from 'lucide-react';

export const AccountView: React.FC = () => {
  const { user, tenant, logout, updateTenantState } = useAuth();
  const navigate = useNavigate();
  const { density, setDensity, brandColor, setBrandColor, contrastInfo } = useTheme();
  const { success, error: toastError } = useToast();

  const isManufacturer = 
    tenant?.type === 'manufacturer' || 
    user?.role === 'manufacturer_admin' || 
    user?.email?.toLowerCase().includes('fabricante') ||
    tenant?.plan === 'taller' ||
    tenant?.plan === 'fabrica' ||
    tenant?.plan === 'arranque';

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [textSize, setTextSize] = useState<'normal' | 'large'>('normal');

  // Datos editables del comercio / cuenta
  const [bizName, setBizName] = useState(tenant?.name || '');
  const [bizCategory, setBizCategory] = useState(tenant?.category || 'Gastronomía y Cafetería');
  const [bizPhone, setBizPhone] = useState(tenant?.phone || '');
  const [bizCity, setBizCity] = useState(tenant?.city || 'Buenos Aires, Argentina');
  const [bizAddress, setBizAddress] = useState(tenant?.address || '');
  const [bizReviewUrl, setBizReviewUrl] = useState(tenant?.reviewUrl || '');
  const [isSavingBiz, setIsSavingBiz] = useState(false);
  const [hexInput, setHexInput] = useState(brandColor || '#3A3FE0');

  // Identidad y personalización del taller (trasladado a Mi Cuenta, sin llamarse Marca Blanca)
  const [mfgBrandName, setMfgBrandName] = useState(tenant?.name || '');
  const [mfgBrandLogo, setMfgBrandLogo] = useState(tenant?.brandLogo || '');
  const [mfgSupportPhone, setMfgSupportPhone] = useState(tenant?.phone || '+54 9 11 4455-8899');
  const [mfgSupportEmail, setMfgSupportEmail] = useState(tenant?.contactEmail || 'soporte@taller.com.ar');
  const [mfgWebsite, setMfgWebsite] = useState(tenant?.website || '');
  const [isSavingMfgBrand, setIsSavingMfgBrand] = useState(false);

  useEffect(() => {
    if (tenant) {
      setBizName(tenant.name || '');
      setBizCategory(tenant.category || 'Gastronomía y Cafetería');
      setBizPhone(tenant.phone || '');
      setBizCity(tenant.city || 'Buenos Aires, Argentina');
      setBizAddress(tenant.address || '');
      setBizReviewUrl(tenant.reviewUrl || '');

      setMfgBrandName(tenant.name || '');
      setMfgBrandLogo(tenant.brandLogo || '');
      if (tenant.phone) setMfgSupportPhone(tenant.phone);
      if (tenant.contactEmail) setMfgSupportEmail(tenant.contactEmail);
      if (tenant.website) setMfgWebsite(tenant.website);
    }
  }, [tenant]);

  useEffect(() => {
    if (brandColor) setHexInput(brandColor);
  }, [brandColor]);

  // Soporte de fabricante asignado (solo para negocios)
  const [assignedMfg, setAssignedMfg] = useState<{
    name: string;
    phone: string;
    city: string;
  }>({
    name: tenant?.assignedManufacturerName || 'Toque™ SaaS (Fabricante Oficial)',
    phone: '+54 9 11 5263-8900',
    city: 'Envíos a todo el país',
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

  // Guardar datos comerciales editables
  const handleSaveBusinessData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;

    if (bizReviewUrl.trim()) {
      const val = validateGoogleReviewUrl(bizReviewUrl.trim());
      if (!val.isValid) {
        toastError('Enlace inválido', val.error || 'Verificá el enlace de Google Maps');
        return;
      }
    }

    setIsSavingBiz(true);
    try {
      const patch = {
        name: bizName.trim(),
        category: bizCategory.trim(),
        phone: bizPhone.trim(),
        city: bizCity.trim(),
        address: bizAddress.trim(),
        reviewUrl: bizReviewUrl.trim(),
      };
      await api.updateTenant(tenant.id, patch);
      updateTenantState(patch);
      success('Datos guardados', 'Los datos comerciales se actualizaron con éxito.');
    } catch (err) {
      toastError('Error al guardar', err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSavingBiz(false);
    }
  };

  // Guardar identidad y personalización del taller (anteriormente Marca Blanca)
  const handleSaveMfgBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    setIsSavingMfgBrand(true);
    try {
      await api.updateTenantBrand(tenant.id, {
        name: mfgBrandName.trim(),
        brandLogo: mfgBrandLogo.trim(),
        brandColor: brandColor,
      });
      const patch = {
        name: mfgBrandName.trim(),
        brandLogo: mfgBrandLogo.trim(),
        phone: mfgSupportPhone.trim(),
        contactEmail: mfgSupportEmail.trim(),
        website: mfgWebsite.trim(),
      };
      await api.updateTenant(tenant.id, patch);
      updateTenantState(patch);
      success('Identidad del taller guardada', 'Los datos y personalización de tu taller se actualizaron correctamente.');
    } catch (err) {
      toastError('No se pudo guardar la identidad', err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSavingMfgBrand(false);
    }
  };

  // Paleta de colores sugeridos
  const accentColors = [
    { name: 'Ultramar Toque', hex: '#3A3FE0' },
    { name: 'Zafiro Profundo', hex: '#1E3A8A' },
    { name: 'Esmeralda', hex: '#047857' },
    { name: 'Índigo Real', hex: '#4338CA' },
    { name: 'Vino Tinto', hex: '#881337' },
    { name: 'Carbón', hex: '#1E293B' },
    { name: 'Ámbar Cálido', hex: '#D97706' },
  ];

  const handleApplyHex = (val: string) => {
    setHexInput(val);
    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
      setBrandColor(val);
      if (tenant?.id) {
        api.updateTenant(tenant.id, { brandColor: val }).catch(() => {});
        updateTenantState({ brandColor: val });
      }
    }
  };

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
          codigo: s.code || s.shortCode,
          ubicacion: s.locationDescription,
          url_google: s.targetUrl,
          ultimo_escaneo: s.lastScannedAt,
        })),
        resumen_estadisticas: stats,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `datos-toque-${tenant?.slug || 'cuenta'}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      success('Datos exportados', 'Se descargó el archivo JSON con tu historial.');
    } catch {
      // fallback
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-white pb-12">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-headline font-bold text-white tracking-tight">
          Mi Cuenta y Preferencias
        </h1>
        <p className="text-xs text-white/70 mt-0.5">
          Configuración visual, datos de contacto comercial y personalización de marca.
        </p>
      </div>

      {/* 1. SECCIÓN FABRICANTE ASIGNADO (Solo visible si es negocio) O PERFIL DE TALLER (Si es fabricante) */}
      {!isManufacturer ? (
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

          {isEditingMfg && (
            <div className="p-4 rounded-xl bg-black/30 border border-white/15 space-y-3 pt-3 animate-in fade-in">
              <h4 className="text-xs font-bold text-white">
                Vincular o cambiar fabricante de carteles
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
                    success('Fabricante actualizado', 'Se guardaron los datos del fabricante asignado.');
                  }}
                >
                  Guardar fabricante
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-6 border-white/20 bg-white/10 backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300">
                <Factory className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-300 block">
                    Tu Cuenta de Fabricante / Taller Productor
                  </span>
                  <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                    {tenant?.accountCode || 'RT-01'}
                  </span>
                </div>
                <h3 className="font-headline text-base font-bold text-white mt-0.5">
                  {tenant?.name || 'Taller de Cartelería'}
                </h3>
                <p className="text-xs text-white/70 mt-0.5">
                  Sos fabricante homologado en Toque. Comercializás carteles con chips NFC y QR para tus comercios clientes.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/fabricante')}
              icon={<Factory className="w-4 h-4 text-slate-900" />}
              className="bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs"
            >
              Ir a Panel de Fabricante
            </Button>
          </div>
        </Card>
      )}

      {/* RED DE FABRICANTES 100% EDITABLE DENTRO DE MI CUENTA (Puntos 5 y 8) */}
      {isManufacturer && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            <h3 className="font-headline text-lg font-bold text-white">
              Tu Perfil en la Red Oficial de Fabricantes
            </h3>
          </div>
          <ManufacturerNetworkSection tenant={tenant} />
        </div>
      )}

      {/* IDENTIDAD Y PERSONALIZACIÓN DEL TALLER (Trasladado a Mi Cuenta, sin nombrarse Marca Blanca) */}
      {isManufacturer && (
        <Card className="p-6 space-y-5 border-white/20 bg-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-300" />
              <h3 className="font-headline text-base font-bold text-white">
                Identidad y Personalización del Taller
              </h3>
            </div>
            <span className="text-[11px] font-mono text-white/50">
              Personalización activa
            </span>
          </div>

          <p className="text-xs text-white/70">
            Configurá el nombre, logotipo y canales de soporte con los que tus clientes interactúan. Tus carteles y panel preservan 100% tu identidad.
          </p>

          <form onSubmit={handleSaveMfgBrand} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Nombre de tu taller / marca *
                </label>
                <input
                  type="text"
                  required
                  value={mfgBrandName}
                  onChange={(e) => setMfgBrandName(e.target.value)}
                  placeholder="Ej. Taller Gráfico & Cartelería"
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  URL del Logotipo (PNG / SVG)
                </label>
                <input
                  type="url"
                  value={mfgBrandLogo}
                  onChange={(e) => setMfgBrandLogo(e.target.value)}
                  placeholder="https://tudominio.com/logo.png"
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  WhatsApp / Teléfono de atención al cliente
                </label>
                <input
                  type="text"
                  value={mfgSupportPhone}
                  onChange={(e) => setMfgSupportPhone(e.target.value)}
                  placeholder="+54 9 11 4455-8899"
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Email de soporte para consultas
                </label>
                <input
                  type="email"
                  value={mfgSupportEmail}
                  onChange={(e) => setMfgSupportEmail(e.target.value)}
                  placeholder="soporte@tutaller.com.ar"
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Sitio web oficial o dominio
              </label>
              <input
                type="text"
                value={mfgWebsite}
                onChange={(e) => setMfgWebsite(e.target.value)}
                placeholder="https://tutaller.com.ar"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                isLoading={isSavingMfgBrand}
                icon={<Save className="w-4 h-4 text-slate-900" />}
                className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
              >
                Guardar personalización de identidad
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* 2. DATOS DEL COMERCIO EDITABLES Y GUARDABLES (Punto 10 y 13) */}
      <Card className="p-6 space-y-5 border-white/20 bg-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-cyan-300" />
            <h3 className="font-headline text-base font-bold text-white">
              {isManufacturer ? 'Datos del Taller / Fábrica' : 'Datos del Comercio'}
            </h3>
          </div>
          <span className="text-[11px] font-mono text-white/50">
            Código: {tenant?.accountCode || 'S/C'}
          </span>
        </div>

        <form onSubmit={handleSaveBusinessData} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Nombre comercial *
              </label>
              <input
                type="text"
                required
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="Ej. Vanish Helados"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Rubro o Categoría
              </label>
              <input
                type="text"
                value={bizCategory}
                onChange={(e) => setBizCategory(e.target.value)}
                placeholder="Ej. Heladería Artesanal, Cafetería, Bar"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Teléfono / WhatsApp de contacto
              </label>
              <input
                type="text"
                value={bizPhone}
                onChange={(e) => setBizPhone(e.target.value)}
                placeholder="+54 9 11 5263-8900"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                Ciudad y Provincia
              </label>
              <input
                type="text"
                value={bizCity}
                onChange={(e) => setBizCity(e.target.value)}
                placeholder="Buenos Aires, Argentina"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/80 mb-1">
              Dirección física del local
            </label>
            <input
              type="text"
              value={bizAddress}
              onChange={(e) => setBizAddress(e.target.value)}
              placeholder="Av. Corrientes 1540, CABA"
              className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/80 mb-1">
              Enlace directo de reseñas en Google Maps
            </label>
            <input
              type="url"
              value={bizReviewUrl}
              onChange={(e) => setBizReviewUrl(e.target.value)}
              placeholder="https://search.google.com/local/writereview?placeid=..."
              className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono text-[11px]"
            />
            <p className="text-[11px] text-white/50 mt-1">
              URL donde los carteles redirigen a los comensales cuando apoyan el móvil en la mesa.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              isLoading={isSavingBiz}
              icon={<Save className="w-4 h-4 text-slate-900" />}
              className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
            >
              Guardar datos del comercio
            </Button>
          </div>
        </form>
      </Card>

      {/* 3. COLOR DE ACENTO DE MARCA CON PICKER Y HEX (Puntos 14) */}
      <Card className="p-6 space-y-6 border-white/20 bg-white/10 backdrop-blur-md">
        <h3 className="font-headline text-base font-bold text-white flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-300" />
          <span>Apariencia y Color de Acento de Marca</span>
        </h3>

        {/* Modo Claro / Oscuro / Sistema */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="text-small font-medium text-white block">
              Tema de color
            </label>
            <span className="text-micro text-white/60">
              Claro, oscuro o sincronizado con tu sistema operativo.
            </span>
          </div>
          <ThemeToggle />
        </div>

        {/* Selector de color con paleta y campo HEX */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-small font-medium text-white block">
                Color de acento de marca
              </label>
              <span className="text-micro text-white/60">
                Elegí una muestra o escribí el código HEX exacto de tu marca (#RRGGBB).
              </span>
            </div>

            <span className={`text-micro font-medium px-2 py-0.5 rounded-full ${contrastInfo.passesAA ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
              {contrastInfo.passesAA ? 'Contraste AA Seguro' : 'Ajustar contraste'}
            </span>
          </div>

          {/* Paleta rápida */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {accentColors.map((color) => (
              <button
                key={color.hex}
                type="button"
                onClick={() => handleApplyHex(color.hex)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer shadow-xs ${
                  brandColor.toLowerCase() === color.hex.toLowerCase()
                    ? 'ring-2 ring-offset-2 ring-white scale-105'
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

          {/* Entrada de Color HEX y Color Picker Nativo Integrado */}
          <div className="flex items-center gap-3 pt-2">
            <div className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/20">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => handleApplyHex(e.target.value)}
                className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                title="Seleccionar en la paleta"
              />
              <span className="text-xs text-white/60 font-mono">HEX:</span>
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleApplyHex(e.target.value)}
                placeholder="#3A3FE0"
                className="w-24 text-xs font-mono font-bold uppercase text-white bg-transparent focus:outline-none"
              />
            </div>
            <div
              className="h-9 w-9 rounded-xl border border-white/20 shrink-0"
              style={{ backgroundColor: brandColor }}
              title="Vista previa del acento"
            />
          </div>
        </div>
      </Card>

      {/* 4. EXPORTAR DATOS Y ACCIONES */}
      <Card className="p-6 space-y-4 border-white/20 bg-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-base font-bold text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-300" />
            <span>Copia de Seguridad y Exportación</span>
          </h3>
        </div>

        <p className="text-xs text-white/70">
          Podés descargar una copia completa de tus carteles, identificadores únicos y métricas de escaneos en formato JSON estándar.
        </p>

        <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
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
