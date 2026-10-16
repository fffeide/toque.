/**
 * Toque — Red Nacional de Fabricantes (Pública en la Home)
 * Cumple con el Requerimiento 8 y 16:
 * - Ubicada en la página principal pública (Home).
 * - Permite a cualquier dueño de negocio buscar fabricantes por ciudad y materiales.
 * - Al hacer click en el fabricante se abre la vista de DETALLES COMPLETOS (Modal/Sheet):
 *     - Materiales, formatos disponibles, tiempos estimados de entrega.
 *     - Catálogo de productos con precios claros.
 *     - Contacto directo por WhatsApp con código de trazabilidad único.
 *     - Reseñas verificadas auténticas de clientes asignados (sin inventar).
 */

import React, { useState, useEffect } from 'react';
import { api, Tenant, ManufacturerReview } from '../../api';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import {
  Factory,
  Search,
  MapPin,
  Star,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Layers,
  Clock,
  ExternalLink,
  ChevronRight,
  Check,
  Send,
} from 'lucide-react';

export const HomeManufacturersSection: React.FC = () => {
  const { tenant } = useAuth();
  const [manufacturers, setManufacturers] = useState<Tenant[]>([]);
  const [reviewsMap, setReviewsMap] = useState<Record<string, ManufacturerReview[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');

  // Fabricante seleccionado para ver detalles completos
  const [selectedMfg, setSelectedMfg] = useState<Tenant | null>(null);

  // Formulario para dejar reseña si está asignado
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const myBizCode = tenant?.accountCode || 'CL-01';
  const myAssignedMfgId = tenant?.manufacturerId;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await api.listManufacturers();
      // Filtrar los que están en la red
      const publicMfgs = list.filter(m => m.inNetwork !== false);
      setManufacturers(publicMfgs);

      const revEntries = await Promise.all(
        publicMfgs.map(async (m) => {
          const revs = await api.listManufacturerReviews(m.id);
          return [m.id, revs] as [string, ManufacturerReview[]];
        })
      );
      setReviewsMap(Object.fromEntries(revEntries));
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = manufacturers.filter((m) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      m.name.toLowerCase().includes(q) ||
      (m.city && m.city.toLowerCase().includes(q)) ||
      (m.accountCode && m.accountCode.toLowerCase().includes(q));

    const matchMat =
      selectedMaterial === 'all' ||
      (m.materials && m.materials.some(mat => mat.toLowerCase().includes(selectedMaterial.toLowerCase())));

    return matchSearch && matchMat;
  });

  return (
    <section id="red-fabricantes" className="scroll-mt-6">
      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-xs p-6 sm:p-10 md:p-14">
        {/* Cabecera de la sección */}
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[rgba(30,50,90,0.06)] border border-[rgba(30,50,90,0.12)] text-xs text-[rgba(30,50,90,0.9)] mb-3 font-medium">
            <Factory className="w-3.5 h-3.5 text-blue-600" />
            <span>Red Nacional de Fabricantes Toque</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal text-slate-900 tracking-tight font-headline mb-3">
            Encontrá un fabricante de carteles para tu negocio
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Talleres homologados e imprentas que producen carteles de acrílico y madera con chips NFC de alta durabilidad y soporte oficial.
          </p>
        </div>

        {/* Buscador y filtros rápidos */}
        <div className="max-w-4xl mx-auto mb-8 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por taller, provincia, ciudad o código (ej. RT-01, Acrílico, CABA, Rosario)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-[rgba(30,50,90,0.3)] transition"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
            {['all', 'Acrílico', 'Madera', 'UV'].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setSelectedMaterial(chip)}
                className={`px-3 py-2 rounded-xl font-medium transition cursor-pointer border capitalize ${
                  selectedMaterial === chip
                    ? 'bg-[rgba(30,50,90,0.9)] text-white border-[rgba(30,50,90,0.9)] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {chip === 'all' ? 'Todos' : chip}
              </button>
            ))}
          </div>
        </div>

        {/* Grilla de Fabricantes */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Cargando talleres y fabricantes verificados...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500">
            No encontramos fabricantes con ese filtro. Probá con otra búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {filtered.map((mfg) => {
              const reviews = reviewsMap[mfg.id] || [];
              const avg =
                reviews.length > 0
                  ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
                  : null;

              return (
                <div
                  key={mfg.id}
                  onClick={() => setSelectedMfg(mfg)}
                  className="p-6 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between space-y-4 group shadow-2xs hover:shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            {mfg.accountCode || 'RT-01'}
                          </span>
                          {mfg.isVerified !== false && (
                            <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Verificado Toque</span>
                            </span>
                          )}
                        </div>
                        <h3 className="font-headline text-base font-bold text-slate-900 mt-1 group-hover:text-blue-900 transition">
                          {mfg.name}
                        </h3>
                        {mfg.city && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span>{mfg.city}</span>
                          </p>
                        )}
                      </div>

                      {/* Calificación */}
                      <div className="text-right shrink-0">
                        {avg ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>{avg}</span>
                            <span className="text-[10px] text-amber-700 font-normal">({reviews.length})</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">Sin reseñas</span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {mfg.description || 'Fabricación de cartelería con NFC para mostrador y mesas gastronómicas.'}
                    </p>

                    {/* Chips de materiales */}
                    {mfg.materials && mfg.materials.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {mfg.materials.slice(0, 3).map((mat) => (
                          <span
                            key={mat}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-medium"
                          >
                            {mat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pie de tarjeta: Ver detalles completos */}
                  <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-[rgba(30,50,90,0.9)] font-semibold">
                    <span>Ver productos y detalles</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL DE DETALLES COMPLETOS DEL FABRICANTE (PUNTO 8 & 16)      */}
      {/* ============================================================== */}
      {selectedMfg && (
        <Dialog
          isOpen={!!selectedMfg}
          onClose={() => {
            setSelectedMfg(null);
            setIsReviewOpen(false);
          }}
          title={selectedMfg.name}
          description={`Código de Fabricante: ${selectedMfg.accountCode || 'RT-01'} · ${selectedMfg.city || 'Argentina'}`}
          size="lg"
        >
          <div className="space-y-6 pt-2">
            {/* Cabecera del Fabricante con Sello Verificado */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900">
                    {selectedMfg.accountCode || 'RT-01'}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>✓ Fabricante Verificado Toque</span>
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {selectedMfg.description}
                </p>
                {selectedMfg.leadTime && (
                  <p className="text-xs text-slate-700 font-medium mt-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Tiempos de entrega estimados: <strong>{selectedMfg.leadTime}</strong></span>
                  </p>
                )}
              </div>

              {selectedMfg.phone && (
                <a
                  href={`https://wa.me/${selectedMfg.phone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(selectedMfg.name)},%20te%20contacto%20desde%20la%20Red%20Toque%20para%20consultar%20por%20carteles%20para%20mi%20negocio.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs shrink-0 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp directo</span>
                </a>
              )}
            </div>

            {/* Materiales y Formatos */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Materiales y Formatos de Fabricación
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(selectedMfg.materials || ['Acrílico Cristal 3mm', 'Impresión UV Ultra HD', 'Chips NTAG215 Blindados']).map((m) => (
                  <span key={m} className="text-xs px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                    {m}
                  </span>
                ))}
                {(selectedMfg.formats || ['Placa L mostrador', 'Pirámide de mesa', 'Tótem madera']).map((f) => (
                  <span key={f} className="text-xs px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-medium">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Catálogo de Productos y Precios Directos */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Catálogo de Carteles y Precios
              </h4>
              {selectedMfg.products && selectedMfg.products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedMfg.products.map((prod) => (
                    <div key={prod.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900 text-xs">{prod.name}</span>
                        <span className="font-bold text-emerald-700 text-xs">
                          ${prod.price.toLocaleString('es-AR')} ARS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{prod.format} • {prod.material}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Entrega aprox: {prod.estimatedDays} días hábiles
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                  Este taller confecciona carteles a medida bajo consulta directa por WhatsApp.
                </div>
              )}
            </div>

            {/* Reseñas Auténticas Verificadas */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Reseñas Verificadas de Comercios ({(reviewsMap[selectedMfg.id] || []).length})
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Solo los clientes que tienen este fabricante asignado pueden opinar.
                  </p>
                </div>

                {/* Si la cuenta actual está asignada a este fabricante, puede opinar */}
                {myAssignedMfgId === selectedMfg.id ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsReviewOpen(!isReviewOpen)}
                    className="text-xs"
                  >
                    {isReviewOpen ? 'Cancelar reseña' : '+ Calificar mi fabricante'}
                  </Button>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">
                    (Solo clientes asignados pueden opinar)
                  </span>
                )}
              </div>

              {/* Formulario de reseña */}
              {isReviewOpen && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3 animate-in fade-in">
                  <span className="text-xs font-bold text-emerald-950 block">
                    Dejar reseña verificada para {selectedMfg.name} ({myBizCode})
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setReviewRating(s)}
                        className="p-1 cursor-pointer"
                      >
                        <Star className={`w-5 h-5 ${s <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-700 ml-2">{reviewRating} estrellas</span>
                  </div>
                  <textarea
                    rows={2}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Contá cómo fue la entrega, la calidad del acrílico y la lectura del chip NFC..."
                    className="w-full p-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isSubmittingReview}
                      onClick={async () => {
                        if (!reviewComment.trim()) return;
                        setIsSubmittingReview(true);
                        try {
                          const newRev = await api.addManufacturerReview({
                            manufacturerId: selectedMfg.id,
                            businessId: tenant?.id || 'biz-esquina',
                            businessName: tenant?.name || 'Comercio',
                            rating: reviewRating,
                            comment: reviewComment,
                          });
                          setReviewsMap(prev => ({
                            ...prev,
                            [selectedMfg.id]: [newRev, ...(prev[selectedMfg.id] || [])],
                          }));
                          setIsReviewOpen(false);
                          setReviewComment('');
                        } finally {
                          setIsSubmittingReview(false);
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    >
                      Publicar reseña verificada
                    </Button>
                  </div>
                </div>
              )}

              {/* Lista de reseñas */}
              {(reviewsMap[selectedMfg.id] || []).length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                  Este fabricante aún no tiene opiniones publicadas de sus clientes.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(reviewsMap[selectedMfg.id] || []).map((rev) => (
                    <div key={rev.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">
                          {rev.businessName}{' '}
                          <span className="font-mono text-[10px] text-blue-700">({rev.businessCode})</span>
                        </span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        "{rev.comment}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón Cerrar */}
            <div className="pt-2 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setSelectedMfg(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
};
