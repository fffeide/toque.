/**
 * Toque — Sección Red de Fabricantes dentro del Panel del Fabricante
 * Solo disponible para planes 'taller' y 'fabrica' (o demo).
 * Permite al taller o imprenta:
 * - Subirse / publicarse en la Red Nacional de Fabricantes de Toque.
 * - Cargar links, ubicación, contacto directo de WhatsApp.
 * - Configurar materiales, formatos, tiempos estimados de entrega y catálogo de productos con precios.
 * - Ver estado de verificación de Toque (Sello Verificado).
 */

import React, { useState, useEffect } from 'react';
import { Tenant } from '../../api/types';
import { api } from '../../api';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import {
  Globe,
  MapPin,
  Phone,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface ManufacturerNetworkSectionProps {
  tenant: Tenant | null;
  onUpdated?: () => void;
}

export const ManufacturerNetworkSection: React.FC<ManufacturerNetworkSectionProps> = ({
  tenant,
  onUpdated,
}) => {
  const { updateTenantState } = useAuth();
  const { success, error: toastError } = useToast();

  const plan = (tenant?.plan || 'taller').toString().toLowerCase();
  const isAllowedPlan = plan.includes('taller') || plan.includes('fabrica') || tenant?.isDemo;

  const [inNetwork, setInNetwork] = useState(tenant?.inNetwork ?? true);
  const [phone, setPhone] = useState(tenant?.phone || '+54 9 11 5821-4433');
  const [city, setCity] = useState(tenant?.city || 'CABA y Gran Buenos Aires');
  const [address, setAddress] = useState(tenant?.address || 'Av. San Martín 2450');
  const [website, setWebsite] = useState(tenant?.website || 'https://rexitecnologies.com.ar');
  const [leadTime, setLeadTime] = useState(tenant?.leadTime || '48 a 72 hs hábiles');
  const [description, setDescription] = useState(
    tenant?.description ||
      'Taller especializado en soportes acrílicos y de madera para gastronomía con chips NFC antimetal y protección UV.'
  );

  // Materiales y formatos
  const [materialsText, setMaterialsText] = useState(
    (tenant?.materials || ['Acrílico Cristal 3mm', 'Impresión UV Ultra HD', 'Chips NTAG215 Blindados', 'Madera Petiribí']).join(', ')
  );
  const [formatsText, setFormatsText] = useState(
    (tenant?.formats || ['Placa de mostrador 10x15cm', 'Pirámide de mesa', 'Tótem con base de madera', 'Sticker blindado']).join(', ')
  );

  // Catálogo de productos con precios
  const [products, setProducts] = useState<Array<{
    id: string;
    name: string;
    format: string;
    material: string;
    price: number;
    description: string;
    estimatedDays: number;
  }>>(
    tenant?.products && tenant.products.length > 0
      ? tenant.products
      : [
          {
            id: 'prod-1',
            name: 'Cartel Acrílico de Mostrador',
            format: 'Placa L inclinada 10x15 cm',
            material: 'Acrílico cristal 3mm + Chip NFC NTAG215 + QR',
            price: 7900,
            description: 'Ideal para caja y mostrador de atención rápida.',
            estimatedDays: 2,
          },
          {
            id: 'prod-2',
            name: 'Pirámide de Mesa Doble Faz',
            format: 'Pirámide 8x12 cm',
            material: 'Acrílico termoformado reforzado',
            price: 9400,
            description: 'Visible desde ambos lados de la mesa del restaurante.',
            estimatedDays: 3,
          },
          {
            id: 'prod-3',
            name: 'Soporte Premium Base Madera',
            format: 'Base 12x5 cm con placa 10x15 cm',
            material: 'Madera natural tratada + Acrílico esmerilado',
            price: 12500,
            description: 'Para cafeterías de especialidad y hoteles boutique.',
            estimatedDays: 4,
          },
        ]
  );

  const [newProdName, setNewProdName] = useState('');
  const [newProdFormat, setNewProdFormat] = useState('');
  const [newProdMaterial, setNewProdMaterial] = useState('');
  const [newProdPrice, setNewProdPrice] = useState<number>(8500);
  const [newProdDays, setNewProdDays] = useState<number>(3);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (tenant) {
      setInNetwork(tenant.inNetwork ?? true);
      if (tenant.phone) setPhone(tenant.phone);
      if (tenant.city) setCity(tenant.city);
      if (tenant.address) setAddress(tenant.address);
      if (tenant.website) setWebsite(tenant.website);
      if (tenant.leadTime) setLeadTime(tenant.leadTime);
      if (tenant.description) setDescription(tenant.description);
      if (tenant.materials) setMaterialsText(tenant.materials.join(', '));
      if (tenant.formats) setFormatsText(tenant.formats.join(', '));
      if (tenant.products && tenant.products.length > 0) setProducts(tenant.products);
    }
  }, [tenant]);

  // Si el plan no permite estar en la red (ej. plan arranque básico)
  if (!isAllowedPlan) {
    return (
      <Card className="p-8 text-center space-y-4 max-w-2xl mx-auto border-white/20 bg-white/10 backdrop-blur-md">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 mx-auto flex items-center justify-center border border-amber-500/30">
          <Globe className="w-6 h-6" />
        </div>
        <h3 className="font-headline text-xl font-bold text-white">
          Red Nacional de Fabricantes Toque
        </h3>
        <p className="text-xs text-white/70 max-w-md mx-auto leading-relaxed">
          Esta función está reservada para fabricantes en <strong>Plan Taller</strong> y <strong>Plan Fábrica</strong>. Te permite recibir pedidos directos de comercios de todo el país que buscan carteles para su negocio.
        </p>
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={() => window.location.assign('#precios')}
            className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
          >
            Actualizar a Plan Taller
          </Button>
        </div>
      </Card>
    );
  }

  const handleAddProduct = () => {
    if (!newProdName.trim()) {
      toastError('Nombre requerido', 'Ingresá el nombre del producto.');
      return;
    }
    const newProd = {
      id: 'prod-' + Date.now(),
      name: newProdName.trim(),
      format: newProdFormat.trim() || 'Placa estándar',
      material: newProdMaterial.trim() || 'Acrílico cristal',
      price: Number(newProdPrice) || 0,
      description: 'Producto para cartelería inteligente con NFC y QR',
      estimatedDays: Number(newProdDays) || 3,
    };
    setProducts([...products, newProd]);
    setNewProdName('');
    setNewProdFormat('');
    setNewProdMaterial('');
    success('Producto agregado al catálogo', newProd.name);
  };

  const handleRemoveProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const handleSaveNetworkProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    setIsSaving(true);
    try {
      const materials = materialsText.split(',').map(s => s.trim()).filter(Boolean);
      const formats = formatsText.split(',').map(s => s.trim()).filter(Boolean);
      const patch = {
        inNetwork,
        phone: phone.trim(),
        city: city.trim(),
        address: address.trim(),
        website: website.trim(),
        leadTime: leadTime.trim(),
        description: description.trim(),
        materials,
        formats,
        products,
      };

      if (api.updateManufacturerNetwork) {
        await api.updateManufacturerNetwork(tenant.id, patch);
      } else {
        await api.updateTenant(tenant.id, patch);
      }

      updateTenantState(patch);
      success('Perfil de la Red guardado', 'Tus datos, formatos y catálogo de productos ya están visibles para los comercios.');
      if (onUpdated) onUpdated();
    } catch (err) {
      toastError('Error al guardar perfil', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera de la Red */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider">
              {tenant?.isVerified ? '✓ Taller Homologado y Verificado' : 'En revisión de verificación'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-headline font-bold text-white mt-1">
            Tu presencia en la Red de Fabricantes
          </h2>
          <p className="text-xs text-white/70 mt-0.5">
            Configurá tu perfil público donde los dueños de negocios pueden encontrarte, ver tus materiales y pedirte carteles.
          </p>
        </div>

        {/* Switch de Publicación en la Red */}
        <label className="flex items-center gap-3 p-3 rounded-xl bg-white/10 border border-white/20 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={inNetwork}
            onChange={(e) => setInNetwork(e.target.checked)}
            className="w-4 h-4 text-emerald-400 rounded focus:ring-emerald-400 cursor-pointer"
          />
          <div>
            <span className="text-xs font-semibold text-white block">
              {inNetwork ? 'Publicado en la Red' : 'Oculto de la Red'}
            </span>
            <span className="text-[10px] text-white/60">
              {inNetwork ? 'Visible para comercios en la home' : 'No recibirás consultas públicas'}
            </span>
          </div>
        </label>
      </div>

      {/* Formulario Principal de la Red */}
      <form onSubmit={handleSaveNetworkProfile} className="space-y-6">
        <Card className="p-6 space-y-4 border-white/20 bg-white/10 backdrop-blur-md">
          <h3 className="font-headline text-base font-bold text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-300" />
            <span>Ubicación y Contacto Directo</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-white/80 mb-1">WhatsApp de contacto comercial *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+54 9 11 5821-4433"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-white/80 mb-1">Ciudad y Cobertura *</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="CABA, Rosario, Córdoba, Envíos al interior"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-white/80 mb-1">Dirección del taller</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Corrientes 2450, CABA"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-white/80 mb-1">Sitio web o Instagram</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://mitaller.com.ar o instagram.com/mitaller"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono text-[11px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="block text-white/80 mb-1">Tiempos estimados de entrega *</label>
              <input
                type="text"
                required
                value={leadTime}
                onChange={(e) => setLeadTime(e.target.value)}
                placeholder="Ej. 48 a 72 hs hábiles / 5 días"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-white/80 mb-1">Descripción del taller</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contá qué tipo de cartelería hacés, calidad de acrílicos y tecnología NFC..."
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 text-xs"
              />
            </div>
          </div>
        </Card>

        {/* Materiales y Formatos */}
        <Card className="p-6 space-y-4 border-white/20 bg-white/10 backdrop-blur-md">
          <h3 className="font-headline text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-300" />
            <span>Materiales y Formatos que trabajás</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-white/80 mb-1">Materiales disponibles (separados por coma)</label>
              <input
                type="text"
                value={materialsText}
                onChange={(e) => setMaterialsText(e.target.value)}
                placeholder="Acrílico Cristal 3mm, Madera Petiribí, Chips NTAG215 Blindados, Impresión UV Ultra HD"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-white/80 mb-1">Formatos y Soportes (separados por coma)</label>
              <input
                type="text"
                value={formatsText}
                onChange={(e) => setFormatsText(e.target.value)}
                placeholder="Placa L de mostrador, Pirámide de mesa doble faz, Tótem con base de madera, Adhesivo blindado"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>
        </Card>

        {/* Catálogo de Productos y Precios Directos */}
        <Card className="p-6 space-y-5 border-white/20 bg-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Productos y Precios Directos para Comercios</span>
            </h3>
            <span className="text-xs text-white/60">
              {products.length} productos publicados
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {products.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-black/30 border border-white/15 space-y-2 relative group">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-white text-xs">{p.name}</h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveProduct(p.id)}
                    className="text-white/40 hover:text-rose-400 p-1 transition cursor-pointer"
                    title="Eliminar producto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-white/70">{p.format}</p>
                <p className="text-[10px] text-white/50">{p.material}</p>
                <div className="pt-2 flex items-center justify-between border-t border-white/10">
                  <span className="font-bold text-emerald-300 text-sm">
                    ${p.price.toLocaleString('es-AR')} ARS
                  </span>
                  <span className="text-[10px] font-mono text-white/60 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {p.estimatedDays} d
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Formulario rápido para agregar un producto */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 pt-3">
            <h5 className="text-xs font-semibold text-white/90">Agregar nuevo cartel o formato a tu catálogo</h5>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <input
                type="text"
                placeholder="Nombre (ej. Placa A5)"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/20 text-white"
              />
              <input
                type="text"
                placeholder="Formato (ej. 15x21 cm)"
                value={newProdFormat}
                onChange={(e) => setNewProdFormat(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/20 text-white"
              />
              <input
                type="text"
                placeholder="Material (ej. Acrílico 4mm)"
                value={newProdMaterial}
                onChange={(e) => setNewProdMaterial(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/20 text-white"
              />
              <input
                type="number"
                placeholder="Precio ARS"
                value={newProdPrice}
                onChange={(e) => setNewProdPrice(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/20 text-white"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddProduct}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="justify-center"
              >
                Agregar
              </Button>
            </div>
          </div>
        </Card>

        {/* Botón Guardar todo */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            isLoading={isSaving}
            icon={<Save className="w-4 h-4 text-slate-900" />}
            className="bg-white text-slate-900 hover:bg-slate-100 font-semibold px-6 py-2.5"
          >
            Guardar y publicar en la Red de Fabricantes
          </Button>
        </div>
      </form>
    </div>
  );
};
