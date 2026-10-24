import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { HubConfig, HubProduct } from '../../api/types';
import { useToast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatARS } from '../../lib/format';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Barcode,
  Star,
  Save,
  Search,
  Check,
  Upload,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

export const ProductsView: React.FC = () => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [config, setConfig] = useState<HubConfig | null>(null);
  const [products, setProducts] = useState<HubProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const hubCfg = await api.getHubConfig();
        setConfig(hubCfg);
        setProducts(hubCfg.products || []);
      } catch (err: any) {
        showToast(err?.message || 'Error al cargar catálogo de productos', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [showToast]);

  const handleAddProduct = () => {
    const newProd: HubProduct = {
      id: `prod-${Date.now()}`,
      title: 'Nuevo producto',
      price: 15000,
      barcode: '',
      universalCode: '',
      featuredInHub: true,
      description: '',
    };
    setProducts((prev) => [newProd, ...prev]);
  };

  const handleUpdateProduct = (id: string, patch: Partial<HubProduct>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleRemoveProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const updated = await api.updateHubConfig({
        ...config,
        products,
      });
      setConfig(updated);
      showToast('Catálogo de productos guardado y sincronizado con Caja y Hub', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar productos', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const sampleCsv = [
      'nombre,precio,codigo,descripcion,destacado',
      '"Cuerdas Guitarra Eléctrica 010",18500,"779123456001","Encordado níquel calibre 010-046",si',
      '"Cable Plug 3 Metros Profesional",24000,"779123456002","Conectores blindados libre de ruido",si',
      '"Púa Celuloide Pack x6",4500,"779123456003","Mediana 0.71mm varios colores",si',
      '"Afinador Digital Clip Cromático",19800,"779123456004","Pantalla rotativa 360 grados para guitarra/bajo/ukelele",no',
    ].join('\n');

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-productos-toque.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCsvFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportingCsv(true);
      const text = await file.text();
      const res = await api.importProductsCsv(text, replaceOnImport);
      setProducts(res.products);
      showToast(
        `Se cargaron ${res.importedCount} productos desde el CSV (Total: ${res.totalProducts}).`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'No se pudo procesar el archivo CSV', 'error');
    } finally {
      setImportingCsv(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl bg-[#111113]" />
        <Skeleton className="h-96 rounded-2xl bg-[#111113]" />
      </div>
    );
  }

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.universalCode || '').toLowerCase().includes(q)
    );
  });

  const featuredCount = products.filter((p) => p.featuredInHub !== false).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f1ee]">Catálogo de Productos</h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">
            Cargá tus productos individualmente o subí un archivo CSV con todo el inventario del local.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleAddProduct}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#222226] text-[#f1f1ee] border border-[#28282a] text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#bec8ff]" />
            <span>Agregar Producto</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#bec8ff] hover:bg-[#a8b5ff] text-[#0c0c0c] font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : 'Guardar Catálogo'}</span>
          </button>
        </div>
      </div>

      {/* Bloque de Carga Masiva por CSV */}
      <section className="rounded-2xl bg-[#111113] border border-[#242426] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2fb36a]/15 border border-[#2fb36a]/30 text-[#2fb36a] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#f1f1ee]">
                Cargar catálogo completo desde archivo CSV
              </h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Subí un archivo <code className="text-[#bec8ff]">.csv</code> con las columnas{' '}
                <code className="text-[#f1f1ee]">nombre, precio, codigo, descripcion, destacado</code>{' '}
                (acepta comas o punto y coma).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#18181b] hover:bg-[#222226] border border-[#2c2c30] text-xs font-semibold text-[#a1a1aa] hover:text-[#f1f1ee] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#bec8ff]" />
              <span>Descargar plantilla CSV</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.txt"
              onChange={handleCsvFileSelected}
              className="hidden"
            />
            <button
              type="button"
              disabled={importingCsv}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2fb36a] hover:bg-[#269a59] text-[#07150d] font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{importingCsv ? 'Importando CSV...' : 'Subir archivo CSV'}</span>
            </button>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-[#a1a1aa] cursor-pointer">
          <input
            type="checkbox"
            checked={replaceOnImport}
            onChange={(e) => setReplaceOnImport(e.target.checked)}
            className="rounded border-[#2c2c30] bg-[#18181b] text-[#bec8ff] focus:ring-0"
          />
          <span>
            Reemplazar el catálogo actual al subir el CSV (si no lo marcás, los productos nuevos se
            suman a los existentes).
          </span>
        </label>
      </section>

      {/* Buscador y Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código de barras o SKU..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111113] border border-[#242426] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/50 focus:outline-none focus:border-[#bec8ff]"
          />
        </div>
        <div className="rounded-xl bg-[#111113] border border-[#242426] px-4 py-2.5 flex items-center justify-between text-xs">
          <span className="text-[#a1a1aa]">Destacados en Hub:</span>
          <span className="font-bold text-[#bec8ff]">
            {featuredCount} de {products.length} productos
          </span>
        </div>
      </div>

      {/* Lista de Productos */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-[#111113] border border-[#242426] p-10 text-center space-y-3">
            <ShoppingBag className="w-8 h-8 text-[#a1a1aa] mx-auto" />
            <p className="text-sm font-semibold text-[#f1f1ee]">
              No hay productos cargados todavía
            </p>
            <p className="text-xs text-[#a1a1aa] max-w-md mx-auto">
              Podés subir un archivo CSV con todos los productos de tu local o agregar productos
              manualmente.
            </p>
          </div>
        ) : (
          filtered.map((prod) => {
            const isFeatured = prod.featuredInHub !== false;
            return (
              <div
                key={prod.id}
                className="rounded-2xl bg-[#111113] border border-[#242426] p-5 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  {/* Nombre */}
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-medium text-[#a1a1aa] mb-1">
                      Nombre del producto
                    </label>
                    <input
                      type="text"
                      value={prod.title}
                      onChange={(e) => handleUpdateProduct(prod.id, { title: e.target.value })}
                      placeholder="Ej: Guitarra Criolla Estudio"
                      className="w-full px-3 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                    />
                  </div>

                  {/* Precio */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-[#a1a1aa] mb-1">
                      Precio (ARS)
                    </label>
                    <input
                      type="number"
                      value={prod.price ?? ''}
                      onChange={(e) =>
                        handleUpdateProduct(prod.id, {
                          price: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      placeholder="15000"
                      className="w-full px-3 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-sm text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                    />
                  </div>

                  {/* Código de barras / EAN-13 */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-[#a1a1aa] mb-1 flex items-center gap-1">
                      <Barcode className="w-3.5 h-3.5 text-[#bec8ff]" />
                      Código / SKU / EAN
                    </label>
                    <input
                      type="text"
                      value={prod.barcode || ''}
                      onChange={(e) =>
                        handleUpdateProduct(prod.id, {
                          barcode: e.target.value,
                          universalCode: e.target.value,
                        })
                      }
                      placeholder="7791234567890"
                      className="w-full px-3 py-2 rounded-xl bg-[#18181b] border border-[#28282a] text-xs font-mono text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                    />
                  </div>

                  {/* Toggle Destacado en Hub + Eliminar */}
                  <div className="sm:col-span-3 flex items-end justify-between sm:justify-end gap-2 pt-4 sm:pt-5">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateProduct(prod.id, { featuredInHub: !isFeatured })
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        isFeatured
                          ? 'bg-[#bec8ff]/15 border-[#bec8ff]/40 text-[#bec8ff]'
                          : 'bg-[#18181b] border-[#28282a] text-[#a1a1aa]'
                      }`}
                    >
                      {isFeatured ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Star className="w-3.5 h-3.5" />
                      )}
                      <span>{isFeatured ? 'En Hub' : 'Solo Caja'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(prod.id)}
                      className="p-2 text-[#a1a1aa] hover:text-[#f87171] rounded-xl hover:bg-[#18181b] cursor-pointer"
                      aria-label="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Descripción y Precio Formateado */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#1e1e22]">
                  <input
                    type="text"
                    value={prod.description || ''}
                    onChange={(e) =>
                      handleUpdateProduct(prod.id, { description: e.target.value })
                    }
                    placeholder="Descripción corta (opcional, visible en el Hub)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#28282a] text-xs text-[#a1a1aa] focus:outline-none focus:border-[#bec8ff]"
                  />
                  {prod.price !== undefined && (
                    <span className="text-xs font-bold text-[#f1f1ee] shrink-0">
                      Precio público: {formatARS(prod.price)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
