/**
 * Toque — Directorio de Fabricantes Homologados y Reseñas Verificadas (ManufacturersDirectoryView)
 * Cumple con el Requerimiento 16:
 * - Buscador de fabricantes por ciudad, material o especialidad.
 * - Códigos únicos visibles: Fabricante (ej. RT-01), Comercio (ej. VH-01), Carteles (ej. RT-VH-01, RT-VH-02).
 * - Contacto directo vía WhatsApp con código de cuenta prellenado.
 * - Reseñas REALES (sin reseñas inventadas): Solo los comercios asignados a ese fabricante pueden opinar.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/authContext';
import { api, Tenant, ManufacturerReview } from '../../api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { Dialog } from '../../components/ui/Dialog';
import {
  Factory,
  Search,
  Star,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Check,
  Sparkles,
  Link2,
  AlertCircle,
  ExternalLink,
  Layers,
  Send,
  Info,
  Clock,
} from 'lucide-react';

export const ManufacturersDirectoryView: React.FC = () => {
  const { tenant, user } = useAuth();
  const { success, error: toastError } = useToast();

  const [manufacturers, setManufacturers] = useState<Tenant[]>([]);
  const [reviewsMap, setReviewsMap] = useState<Record<string, ManufacturerReview[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [selectedMfgForDetails, setSelectedMfgForDetails] = useState<Tenant | null>(null);

  // Estado del formulario de nueva reseña
  const [reviewModalMfg, setReviewModalMfg] = useState<Tenant | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Código de cuenta del negocio actual
  const myBizCode = tenant?.accountCode || 'VH-01';
  const myAssignedMfgId = tenant?.manufacturerId || 'mfg-toque-saas';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const mfgList = await api.listManufacturers();
      setManufacturers(mfgList);

      // Cargar reseñas reales para cada fabricante
      const reviewsEntries = await Promise.all(
        mfgList.map(async (mfg) => {
          const revs = await api.listManufacturerReviews(mfg.id);
          return [mfg.id, revs] as [string, ManufacturerReview[]];
        })
      );
      setReviewsMap(Object.fromEntries(reviewsEntries));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenReviewModal = (mfg: Tenant) => {
    setReviewModalMfg(mfg);
    setRating(5);
    setComment('');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalMfg) return;
    if (!comment.trim()) {
      toastError('Comentario vacío', 'Escribí tu experiencia sobre los carteles entregados.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const newRev = await api.addManufacturerReview({
        manufacturerId: reviewModalMfg.id,
        businessId: tenant?.id || 'biz-esquina',
        businessName: tenant?.name || 'Comercio',
        rating,
        comment,
      });

      success('Reseña verificada publicada', 'Gracias por compartir tu experiencia con el taller.');
      setReviewsMap((prev) => ({
        ...prev,
        [reviewModalMfg.id]: [newRev, ...(prev[reviewModalMfg.id] || [])],
      }));
      setReviewModalMfg(null);
    } catch (err) {
      toastError('Error al guardar reseña', err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Filtrado de fabricantes
  const filteredManufacturers = manufacturers.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.city && m.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.accountCode && m.accountCode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMaterial =
      selectedMaterial === 'all' ||
      (m.materials && m.materials.some((mat) => mat.toLowerCase().includes(selectedMaterial.toLowerCase())));

    return matchesSearch && matchesMaterial;
  });

  return (
    <div className="space-y-6 text-white max-w-6xl mx-auto">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl sm:text-3xl font-headline font-bold text-white tracking-tight">
              Red Oficial de Fabricantes
            </h1>
          </div>
          <p className="text-xs text-white/70 mt-1">
            Encontrá talleres e imprentas verificadas que producen carteles de acrílico y madera con chips NFC de alta durabilidad.
          </p>
        </div>

        {/* Badge con Código Único del Comercio */}
        <div className="p-3 rounded-2xl bg-white/10 border border-white/20 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs font-mono">
            {myBizCode}
          </div>
          <div>
            <p className="text-[10px] text-white/60 uppercase font-medium">
              Tu Código de Comercio
            </p>
            <p className="text-xs font-mono font-bold text-white">
              {myBizCode} · {tenant?.name || 'Mi Comercio'}
            </p>
          </div>
        </div>
      </div>

      {/* Explicación del Esquema de Códigos Relacionales (Requerimiento 16) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-400/30 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
          <Link2 className="w-4 h-4 shrink-0" />
          <span>Sistema de Códigos Relacionales Toque™</span>
        </div>
        <p className="text-xs text-white/80 leading-relaxed">
          Cada cuenta, cartel y pedido tiene un código único vinculado entre sí para agilizar reemplazos por rotura, mantenimientos y garantías físicas:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs font-mono">
          <div className="p-3 rounded-xl bg-black/40 border border-white/10">
            <span className="text-[10px] text-blue-300 block font-sans">Fabricante</span>
            <strong className="text-white text-sm">RT-01</strong>
            <p className="text-[11px] text-white/50 font-sans mt-0.5">Rexi Tecnologies</p>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-white/10">
            <span className="text-[10px] text-emerald-300 block font-sans">Comercio cliente</span>
            <strong className="text-white text-sm">{myBizCode}</strong>
            <p className="text-[11px] text-white/50 font-sans mt-0.5">{tenant?.name || 'Tu Comercio'}</p>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-white/10">
            <span className="text-[10px] text-amber-300 block font-sans">Carteles vinculados</span>
            <strong className="text-white text-sm">RT-{myBizCode}-01, RT-{myBizCode}-02</strong>
            <p className="text-[11px] text-white/50 font-sans mt-0.5">Trazabilidad física total</p>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre de taller, ciudad o código (ej. RT-01, Córdoba, Acrílico)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/30 border border-white/20 text-white placeholder-white/40 text-xs focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 transition"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'acrílico', label: 'Acrílico' },
            { id: 'madera', label: 'Madera' },
            { id: 'tótems', label: 'Tótems' },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSelectedMaterial(chip.id)}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer border ${
                selectedMaterial === chip.id
                  ? 'bg-white text-slate-900 border-white font-bold'
                  : 'bg-white/5 text-white/70 border-white/15 hover:bg-white/10'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listado de Fabricantes */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-white/60">
          Cargando red de fabricantes homologados...
        </div>
      ) : filteredManufacturers.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Factory className="w-10 h-10 text-white/30 mx-auto" />
          <h3 className="font-headline text-base font-bold text-white">
            No se encontraron fabricantes con esa búsqueda
          </h3>
          <p className="text-xs text-white/60 max-w-sm mx-auto">
            Probá buscando por otra ciudad, material o seleccioná "Todos".
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredManufacturers.map((mfg) => {
            const mfgReviews = reviewsMap[mfg.id] || [];
            const avgRating =
              mfgReviews.length > 0
                ? (mfgReviews.reduce((sum, r) => sum + r.rating, 0) / mfgReviews.length).toFixed(1)
                : null;
            const isMyAssignedMfg = myAssignedMfgId === mfg.id;

            return (
              <Card key={mfg.id} className="p-6 border-white/20 bg-white/10 backdrop-blur-md space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Cabecera del fabricante */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30">
                          {mfg.accountCode || 'RT-01'}
                        </span>
                        <span className="text-[11px] text-emerald-300 font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Taller Homologado</span>
                        </span>
                        {isMyAssignedMfg && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/40">
                            ✓ Tu taller asignado
                          </span>
                        )}
                      </div>
                      <h3 className="font-headline text-lg font-bold text-white mt-1">
                        {mfg.name}
                      </h3>
                      {mfg.city && (
                        <p className="text-xs text-white/70 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-white/40" />
                          <span>{mfg.city}</span>
                        </p>
                      )}
                    </div>

                    {/* Calificación Promedio Real */}
                    <div className="text-right shrink-0">
                      {avgRating ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400/20 border border-amber-400/30">
                          <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                          <span className="font-bold text-xs text-amber-200">{avgRating}</span>
                          <span className="text-[10px] text-white/60">({mfgReviews.length})</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-white/50 block font-mono">
                          Sin reseñas aún
                        </span>
                      )}
                    </div>
                  </div>

                  {mfg.description && (
                    <p className="text-xs text-white/80 leading-relaxed">
                      {mfg.description}
                    </p>
                  )}

                  {/* Materiales que fabrica */}
                  {mfg.materials && mfg.materials.length > 0 && (
                    <div>
                      <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 font-medium">
                        Materiales y formatos:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {mfg.materials.map((mat) => (
                          <span
                            key={mat}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-white/80"
                          >
                            {mat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reseñas Reales (NO inventadas) */}
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-300" />
                        <span>Reseñas Verificadas de Comercios ({mfgReviews.length})</span>
                      </span>

                      {/* Botón Dejar Reseña: Solo si el comercio está asignado a este fabricante */}
                      {isMyAssignedMfg ? (
                        <button
                          type="button"
                          onClick={() => handleOpenReviewModal(mfg)}
                          className="text-[11px] text-emerald-300 hover:underline font-semibold cursor-pointer"
                        >
                          + Dejar mi reseña
                        </button>
                      ) : (
                        <span className="text-[10px] text-white/40 italic">
                          (Solo clientes asignados)
                        </span>
                      )}
                    </div>

                    {mfgReviews.length === 0 ? (
                      <div className="p-3 rounded-xl bg-black/20 border border-white/10 text-center text-xs text-white/50">
                        No hay reseñas aún para este taller.
                        {isMyAssignedMfg && (
                          <button
                            type="button"
                            onClick={() => handleOpenReviewModal(mfg)}
                            className="text-emerald-300 underline ml-1 cursor-pointer"
                          >
                            Sé el primero en calificarlo.
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {mfgReviews.map((rev) => (
                          <div
                            key={rev.id}
                            className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">
                                {rev.businessName}{' '}
                                <span className="font-mono text-[10px] text-emerald-300">
                                  ({rev.businessCode})
                                </span>
                              </span>
                              <div className="flex items-center gap-0.5 text-amber-300">
                                {Array.from({ length: rev.rating }).map((_, i) => (
                                  <Star key={i} className="w-3 h-3 fill-amber-300" />
                                ))}
                              </div>
                            </div>
                            <p className="text-white/70 text-[11px] leading-relaxed">
                              "{rev.comment}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones de Contacto */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-white/50 font-mono">
                    Código de pedido: {mfg.accountCode || 'RT-01'}-{myBizCode}
                  </span>

                  {mfg.phone && (
                    <a
                      href={`https://wa.me/${mfg.phone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(mfg.name)},%20te%20contacto%20desde%20Toque%20por%20mi%20comercio%20${encodeURIComponent(tenant?.name || 'mi negocio')}%20(Código:%20${myBizCode}).%20Necesito%20consultar%20por%20carteles.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Contactar por WhatsApp</span>
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal para Dejar Reseña Verificada */}
      {reviewModalMfg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md p-6 bg-[rgba(10,20,36,0.98)] border-white/20 shadow-2xl space-y-4">
            <div>
              <span className="text-[10px] font-mono text-emerald-300 font-bold uppercase tracking-wider block">
                Reseña de cliente verificado · {myBizCode}
              </span>
              <h3 className="font-headline text-lg font-bold text-white mt-0.5">
                Calificar a {reviewModalMfg.name}
              </h3>
              <p className="text-xs text-white/70 mt-1">
                Tu opinión ayuda a otros comercios a conocer la calidad de los acrílicos y chips del taller.
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/80 mb-2">
                  Puntuación general
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setRating(starVal)}
                      className="p-1 hover:scale-110 transition cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          starVal <= rating
                            ? 'text-amber-300 fill-amber-300'
                            : 'text-white/20'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-amber-300 ml-2">
                    {rating} de 5 estrellas
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  Tu experiencia con el cartel físico y la atención *
                </label>
                <textarea
                  required
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ej. Excelente calidad de acrílico y grabado. Los chips leen al instante y resistieron la lluvia en la terraza..."
                  className="w-full p-3 rounded-xl bg-black/40 border border-white/20 text-white placeholder-white/30 text-xs focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReviewModalMfg(null)}
                  disabled={isSubmittingReview}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingReview}
                  icon={<Send className="w-3.5 h-3.5" />}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Publicar reseña
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
