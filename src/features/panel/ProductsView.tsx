import React, { useState, useEffect, useRef } from 'react';
import { api, HubConfig, HubProduct } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatCurrency } from '../../lib/formatters';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Barcode,
  Image as ImageIcon,
  Upload,
  Check,
  X,
  Star,
  Pencil,
} from 'lucide-react';

/**
 * Comprime y redimensiona una imagen seleccionada de la galería o archivos
 * para guardarla de forma rápida y liviana.
 */
async function compressImageFile(file: File, maxSizePx = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxSizePx) {
          height = Math.round((height * maxSizePx) / width);
          width = maxSizePx;
        } else if (height > maxSizePx) {
          width = Math.round((width * maxSizePx) / height);
          height = maxSizePx;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(e.target?.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
      img.src = String(e.target?.result || '');
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
}

export const ProductsView: React.FC = () => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [config, setConfig] = useState<HubConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Estado del formulario de alta/edición
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [universalCode, setUniversalCode] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [featuredInHub, setFeaturedInHub] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await api.getHubConfig();
      setConfig(data);
    } catch {
      showToast('No se pudieron cargar los productos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setPriceStr('');
    setUniversalCode('');
    setImageUrl('');
    setFeaturedInHub(true);
    setShowForm(false);
  };

  const openEditProduct = (prod: HubProduct) => {
    setEditingId(prod.id);
    setTitle(prod.title);
    setPriceStr(prod.price !== undefined ? String(prod.price) : '');
    setUniversalCode(prod.universalCode || '');
    setImageUrl(prod.imageUrl || '');
    setFeaturedInHub(prod.featuredInHub !== false);
    setShowForm(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Seleccioná un archivo de imagen válido', 'error');
      return;
    }

    setIsUploadingImage(true);
    try {
      const compressed = await compressImageFile(file);
      setImageUrl(compressed);
      showToast('Foto cargada correctamente', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al cargar la foto', 'error');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      showToast('Ingresá el nombre del producto', 'error');
      return;
    }

    const numericPrice = Number(priceStr);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      showToast('Ingresá un precio válido', 'error');
      return;
    }

    const cleanCode = universalCode.trim();

    setIsSaving(true);
    try {
      let nextProducts: HubProduct[];
      if (editingId) {
        nextProducts = config.products.map((p) =>
          p.id === editingId
            ? {
                ...p,
                title: cleanTitle,
                price: numericPrice,
                universalCode: cleanCode || undefined,
                imageUrl: imageUrl || undefined,
                featuredInHub,
              }
            : p
        );
      } else {
        const newProduct: HubProduct = {
          id: `prod-${Date.now().toString(36)}`,
          title: cleanTitle,
          price: numericPrice,
          universalCode: cleanCode || undefined,
          imageUrl: imageUrl || undefined,
          featuredInHub,
        };
        nextProducts = [...config.products, newProduct];
      }

      const updated = await api.updateHubConfig({
        ...config,
        products: nextProducts,
      });
      setConfig(updated);
      showToast(
        editingId ? 'Producto actualizado correctamente' : 'Producto agregado al catálogo y conectado a Caja',
        'success'
      );
      resetForm();
    } catch (err: any) {
      showToast(err.message || 'No se pudo guardar el producto', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFeatured = async (prod: HubProduct) => {
    if (!config) return;
    const nextProducts = config.products.map((p) =>
      p.id === prod.id ? { ...p, featuredInHub: p.featuredInHub === false } : p
    );
    try {
      const updated = await api.updateHubConfig({
        ...config,
        products: nextProducts,
      });
      setConfig(updated);
      showToast('Visibilidad en el Hub actualizada', 'success');
    } catch {
      showToast('Error al actualizar el producto', 'error');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!config) return;
    const nextProducts = config.products.filter((p) => p.id !== id);
    try {
      const updated = await api.updateHubConfig({
        ...config,
        products: nextProducts,
      });
      setConfig(updated);
      showToast('Producto eliminado', 'info');
    } catch {
      showToast('Error al eliminar el producto', 'error');
    }
  };

  if (isLoading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee] tracking-tight">Productos</h1>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Cargá tus productos con su código universal para escanearlos en la Caja y mostrarlos en el Hub.
          </p>
        </div>

        <Button
          variant="ultramar"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            if (showForm && !editingId) {
              resetForm();
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
        >
          {showForm && !editingId ? 'Cerrar formulario' : 'Agregar producto'}
        </Button>
      </div>

      {/* Formulario de alta / edición */}
      {showForm && (
        <Card className="p-6 border-[#bec8ff]/40">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#242426]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-base text-[#f1f1ee]">
                  {editingId ? 'Editar producto' : 'Nuevo producto'}
                </h2>
                <p className="text-xs text-[#a1a1aa]">
                  Se sincroniza automáticamente con el lector de la Caja y con los productos destacados del Hub.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="w-8 h-8 rounded-lg bg-[#18181b] border border-[#242426] flex items-center justify-center text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveProduct} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Nombre del producto"
                placeholder="Ej: Café de Especialidad + Medialuna"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <Input
                label="Precio ($ ARS)"
                type="number"
                min="0"
                step="any"
                placeholder="Ej: 3800"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                required
              />

              <Input
                label="Código universal (conectado con la caja)"
                placeholder="Ej: 7790001234567"
                value={universalCode}
                onChange={(e) => setUniversalCode(e.target.value)}
              />
            </div>

            {/* Carga de foto opcional desde galería o archivos */}
            <div className="p-4 rounded-2xl bg-[#161619] border border-[#242426] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                {imageUrl ? (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#28282a] shrink-0 bg-[#0c0c0c]">
                    <img
                      src={imageUrl}
                      alt={title || 'Vista previa'}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      title="Quitar foto"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#111113] border border-dashed border-[#343438] flex items-center justify-center text-[#a1a1aa] shrink-0">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#f1f1ee]">
                    Foto del producto <span className="text-[#a1a1aa] font-normal">(opcional)</span>
                  </p>
                  <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                    Se recomienda agregar una foto para mostrar en el Hub en la parte de productos destacados. Podés elegir una foto de tu galería o de tu app nativa de archivos.
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secundario"
                  size="sm"
                  loading={isUploadingImage}
                  icon={<Upload className="w-3.5 h-3.5" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imageUrl ? 'Cambiar foto' : 'Elegir foto de galería o archivos'}
                </Button>
              </div>
            </div>

            {/* Opción de mostrar en el Hub */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={featuredInHub}
                onChange={(e) => setFeaturedInHub(e.target.checked)}
                className="w-4 h-4 rounded accent-[#2fb36a]"
              />
              <span className="text-xs font-medium text-[#f1f1ee]">
                Destacar este producto en el Hub del comercio
              </span>
            </label>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#242426]">
              <Button type="button" variant="fantasma" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="ultramar"
                size="sm"
                loading={isSaving}
                icon={<Check className="w-4 h-4" />}
              >
                {editingId ? 'Guardar cambios' : 'Guardar producto'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Listado de productos */}
      {config.products.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-[#242426] flex items-center justify-center mx-auto text-[#a1a1aa]">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-[#f1f1ee]">Todavía no cargaste productos</h3>
            <p className="text-xs text-[#a1a1aa]">
              Agregá productos con su nombre, precio, foto opcional y código universal para poder leerlos desde la Caja y destacarlos en tu Hub.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="ultramar"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowForm(true)}
            >
              Agregar primer producto
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.products.map((prod) => {
            const isFeatured = prod.featuredInHub !== false;
            return (
              <Card
                key={prod.id}
                className="p-4 flex flex-col justify-between gap-4 hover:border-[#343438] transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.title}
                      className="w-16 h-16 rounded-xl object-cover border border-[#242426] shrink-0 bg-[#0c0c0c]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[#161619] border border-[#242426] flex items-center justify-center text-[#a1a1aa] shrink-0">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-[#f1f1ee] leading-snug truncate">
                        {prod.title}
                      </h3>
                    </div>
                    <p className="text-base font-extrabold text-[#bec8ff] font-mono tabular-nums">
                      {prod.price !== undefined ? formatCurrency(prod.price) : '$0'}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#161619] border border-[#242426] text-[#c4c2c3]">
                        <Barcode className="w-3 h-3 text-[#2fb36a]" />
                        {prod.universalCode || 'Sin código'}
                      </span>
                      {isFeatured && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#2fb36a]/15 text-[#34d399]">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          En el Hub
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#242426] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleFeatured(prod)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                      isFeatured
                        ? 'border-[#2fb36a]/40 bg-[#2fb36a]/10 text-[#34d399]'
                        : 'border-[#242426] bg-[#161619] text-[#a1a1aa] hover:text-[#f1f1ee]'
                    }`}
                  >
                    {isFeatured ? 'Destacado en Hub' : 'Oculto en Hub'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditProduct(prod)}
                      title="Editar producto"
                      className="p-2 rounded-lg bg-[#161619] border border-[#242426] text-[#a1a1aa] hover:text-[#f1f1ee] hover:border-[#343438] transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(prod.id)}
                      title="Eliminar producto"
                      className="p-2 rounded-lg bg-[#161619] border border-[#242426] text-[#a1a1aa] hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
