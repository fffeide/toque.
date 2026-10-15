import React, { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Tenant, ManufacturerReview } from '../../api/types';
import { formatCurrency } from '../../lib/formatters';
import {
  Factory,
  MapPin,
  MessageSquare,
  Globe,
  Phone,
  Mail,
  ShieldCheck,
  Star,
  Clock,
  Layers,
  Sparkles,
  Send,
  X,
} from 'lucide-react';

interface ManufacturerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  manufacturer: Tenant | null;
  reviews?: ManufacturerReview[];
  onAddReview?: (rating: number, comment: string) => Promise<void>;
  canReview?: boolean;
}

export const ManufacturerDetailModal: React.FC<ManufacturerDetailModalProps> = ({
  isOpen,
  onClose,
  manufacturer,
  reviews = [],
  onAddReview,
  canReview = false,
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  if (!manufacturer) return null;

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : '5.0';

  const cleanPhone = (manufacturer.phone || '').replace(/[^0-9]/g, '');

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !onAddReview) return;
    setIsSubmitting(true);
    try {
      await onAddReview(rating, comment.trim());
      setComment('');
      setShowReviewForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
    >
      <div className="space-y-6 pt-1">
        {/* CABECERA DEL FABRICANTE */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{manufacturer.isVerified ? 'Taller Verificado Toque™' : 'Taller Homologado'}</span>
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-white/60 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded">
                {manufacturer.accountCode || 'FAB'}
              </span>
            </div>

            <h3 className="font-headline text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {manufacturer.name}
            </h3>

            <p className="text-xs text-slate-600 dark:text-white/70 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{manufacturer.city || 'Buenos Aires, Argentina'}</span>
              {manufacturer.address && <span>• {manufacturer.address}</span>}
            </p>
          </div>

          {/* Rating general */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-right shrink-0">
            <div className="flex items-center justify-end gap-1 text-amber-500">
              <Star className="w-4 h-4 fill-amber-500" />
              <span className="text-sm font-bold">{avgRating}</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-white/60 block mt-0.5">
              {reviews.length} {reviews.length === 1 ? 'opinión de comercio' : 'opiniones'}
            </span>
          </div>
        </div>

        {/* DESCRIPCIÓN */}
        {manufacturer.description && (
          <p className="text-xs text-slate-700 dark:text-white/80 leading-relaxed">
            {manufacturer.description}
          </p>
        )}

        {/* BOTONES DE CONTACTO DIRECTO */}
        <div className="flex flex-wrap items-center gap-2.5">
          {cleanPhone && (
            <a
              href={`https://wa.me/${cleanPhone}?text=Hola%20${encodeURIComponent(manufacturer.name)},%20te%20contacto%20desde%20la%20Red%20de%20Toque%20para%20consultar%20por%20carteles%20para%20mi%20negocio.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp Directo</span>
            </a>
          )}

          {manufacturer.contactEmail && (
            <a
              href={`mailto:${manufacturer.contactEmail}?subject=Consulta%20de%20Carteles%20Toque`}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-medium text-xs transition cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{manufacturer.contactEmail}</span>
            </a>
          )}

          {manufacturer.website && (
            <a
              href={manufacturer.website.startsWith('http') ? manufacturer.website : `https://${manufacturer.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-medium text-xs transition cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Sitio web / Catálogo</span>
            </a>
          )}
        </div>

        {/* MATERIALES Y FORMATOS OFRECIDOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Materiales Disponibles</span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(manufacturer.materials && manufacturer.materials.length > 0
                ? manufacturer.materials
                : ['Acrílico cristal 3mm', 'Acrílico negro mate', 'Madera grabado láser', 'Chips NTAG215 Blindados']
              ).map((mat, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white"
                >
                  {mat}
                </span>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Tiempos de Fabricación y Formatos</span>
            </h4>
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              Entrega estimada: {manufacturer.leadTime || '3 a 5 días hábiles'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-white/60">
              Formatos: {(manufacturer.formats && manufacturer.formats.length > 0 ? manufacturer.formats : ['Base en L de mesa', 'Placa de mostrador', 'Tótem vertical']).join(', ')}
            </p>
          </div>
        </div>

        {/* CATÁLOGO DE PRODUCTOS Y PRECIOS */}
        {manufacturer.products && manufacturer.products.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white">
              Productos y Precios Estimados
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {manufacturer.products.map((prod) => (
                <div
                  key={prod.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {prod.name}
                    </span>
                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                      {formatCurrency(prod.price)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-white/60 leading-relaxed">
                    {prod.format} • {prod.material} • ~{prod.estimatedDays} días de producción
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESEÑAS VERIFICADAS */}
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Reseñas de Comercios Clientes ({reviews.length})</span>
            </h4>

            {canReview && !showReviewForm && (
              <button
                type="button"
                onClick={() => setShowReviewForm(true)}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                + Dejar opinión
              </button>
            )}
          </div>

          {showReviewForm && (
            <form onSubmit={handleReviewSubmit} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Tu puntuación</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 cursor-pointer"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          s <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-white/20'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                required
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escribí sobre la calidad de los carteles entregados..."
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-black/30 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowReviewForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                  Publicar reseña
                </Button>
              </div>
            </form>
          )}

          {reviews.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 dark:text-white/60">
              Este fabricante aún no posee reseñas públicas.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {rev.businessName}
                    </span>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-500" />
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-white/70 leading-relaxed">
                    "{rev.comment}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-white/10">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
