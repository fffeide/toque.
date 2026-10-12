/**
 * Toque — Equipo y Reto Mensual (StaffView)
 * Disponible tras feature flag 'staff':
 * - QR y enlace único por empleado
 * - Reto mensual con ranking amigable
 * - Regla ética fija: "Se incentiva al staff, NUNCA al cliente"
 */

import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { api, StaffMember } from '../../api';
import { useDataQuery } from '../../hooks/useDataQuery';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { QRPreview } from '../../components/ui/QRPreview';
import { formatNumber } from '../../lib/formatters';
import { useToast } from '../../components/ui/Toast';
import { getShortUrl, getShortUrlDisplay } from '../../lib/urls';
import {
  Trophy,
  Users,
  QrCode,
  ShieldAlert,
  Copy,
  Check,
  Award,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  UserPlus,
} from 'lucide-react';

export const StaffView: React.FC = () => {
  const { tenant } = useAuth();
  const { success, error: toastError } = useToast();
  const businessId = tenant?.type === 'business' ? tenant.id : 'biz-esquina';
  const [selectedStaffForQr, setSelectedStaffForQr] = useState<StaffMember | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Estados para agregar / editar colaborador
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: staffList,
    isLoading,
    isError,
    error,
    refetch,
  } = useDataQuery<StaffMember[]>({
    queryFn: () => api.listStaff(businessId),
  });

  const handleCopyShortLink = (shortCode: string) => {
    const url = getShortUrl(shortCode);
    navigator.clipboard.writeText(url);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    success('Enlace de empleado copiado', url);
  };

  if (isError) {
    return (
      <div className="py-12">
        <ErrorState
          title="No pudimos cargar la tabla del equipo"
          message={error?.message}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (isLoading || !staffList) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-64 h-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      {/* Cabecera con botón de agregar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-300" />
            <h1 className="text-2xl sm:text-3xl font-headline font-bold text-white tracking-tight">
              Equipo y Reto del Mes
            </h1>
          </div>
          <p className="text-xs text-white/70 mt-1">
            Cada colaborador tiene su enlace o QR personal para medir a quién felicitan más los clientes.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setEditingStaff(null);
            setStaffName('');
            setStaffRole('');
            setIsAddModalOpen(true);
          }}
          icon={<UserPlus className="w-4 h-4 text-slate-900" />}
          className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
        >
          Agregar colaborador
        </Button>
      </div>

      {/* Regla ética y guía consolidada */}
      <div className="p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <Award className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Regla ética de Google y Toque</p>
            <p className="text-white/70 text-[11px] leading-relaxed">
              Incentivá y premiá internamente a tu equipo por invitar cordialmente a opinar, pero nunca condiciones ni des regalos al cliente por 5 estrellas.
            </p>
          </div>
        </div>
      </div>

      {/* Lista del Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {staffList.map((member) => (
          <Card key={member.id} className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-headline font-bold text-base shrink-0 border ${
                member.rank === 1
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                  : member.rank === 2
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-white/10 text-white/60 border-white/10'
              }`}>
                #{member.rank}
              </div>

              <div className="min-w-0">
                <h3 className="font-headline text-body font-semibold text-white truncate">
                  {member.name}
                </h3>
                <p className="text-micro text-white/60">{member.role}</p>
                <p className="text-micro font-mono text-cyan-300 mt-0.5">
                  {getShortUrlDisplay(member.shortCode)}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="text-right">
                <span className="font-display text-title-3 font-bold text-white">
                  {member.scansThisMonth}
                </span>
                <span className="text-micro text-white/60 block">toques este mes</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedStaffForQr(member)}
                  icon={<QrCode className="w-3.5 h-3.5" />}
                  title="Ver código QR personal"
                >
                  QR
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingStaff(member);
                    setStaffName(member.name);
                    setStaffRole(member.role);
                    setIsAddModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
                  title="Editar datos"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setStaffToDelete(member)}
                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 transition cursor-pointer"
                  title="Eliminar colaborador"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal de QR de Empleado */}
      {selectedStaffForQr && (
        <Dialog
          isOpen={!!selectedStaffForQr}
          onClose={() => setSelectedStaffForQr(null)}
          title={`Cartel personal de ${selectedStaffForQr.name}`}
          size="sm"
        >
          <div className="space-y-4 text-center py-2">
            <div className="p-4 bg-white rounded-xl shadow-xs border border-slate-200 inline-block">
              <QRPreview url={getShortUrl(selectedStaffForQr.shortCode)} size={160} />
            </div>

            <div>
              <p className="font-semibold text-small text-[var(--text-main)]">
                {selectedStaffForQr.name} ({selectedStaffForQr.role})
              </p>
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-small font-mono text-[var(--brand)] font-bold">
                <span>{getShortUrlDisplay(selectedStaffForQr.shortCode)}</span>
                <button
                  type="button"
                  onClick={() => handleCopyShortLink(selectedStaffForQr.shortCode)}
                  className="p-1 hover:text-[var(--text-main)] transition cursor-pointer"
                  title="Copiar enlace"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-[var(--menta)]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-micro text-[var(--text-muted)] leading-relaxed">
              Ideal para colocar en el delantal, gafete o credencial personal del colaborador.
            </p>

            <div className="pt-2 flex justify-end">
              <Button variant="ghost" onClick={() => setSelectedStaffForQr(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal de Agregar / Editar Colaborador */}
      {isAddModalOpen && (
        <Dialog
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title={editingStaff ? 'Editar Colaborador' : 'Agregar Colaborador al Equipo'}
          size="sm"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!staffName.trim()) {
                toastError('Nombre requerido', 'Ingresá el nombre del colaborador.');
                return;
              }
              setIsSubmitting(true);
              try {
                if (editingStaff) {
                  if (api.updateStaff) {
                    await api.updateStaff(businessId, editingStaff.id, {
                      name: staffName,
                      role: staffRole || 'Atención',
                    });
                  }
                  success('Colaborador actualizado', staffName);
                } else {
                  if (api.addStaff) {
                    await api.addStaff(businessId, {
                      name: staffName,
                      role: staffRole || 'Atención',
                    });
                  }
                  success('Colaborador agregado', staffName);
                }
                setIsAddModalOpen(false);
                refetch();
              } catch (err) {
                toastError('Error', err instanceof Error ? err.message : 'No se pudo guardar');
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-4 pt-2"
          >
            <div>
              <label className="block text-xs font-medium text-[var(--text-main)] mb-1">
                Nombre y Apellido o Apodo *
              </label>
              <input
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Ej. Sofía R."
                className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 border border-[var(--border-subtle)] text-small text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-main)] mb-1">
                Puesto o Rol
              </label>
              <input
                type="text"
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                placeholder="Ej. Moza Salón, Cajero, Barista"
                className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 border border-[var(--border-subtle)] text-small text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                {editingStaff ? 'Guardar Cambios' : 'Crear Colaborador'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {staffToDelete && (
        <Dialog
          isOpen={!!staffToDelete}
          onClose={() => setStaffToDelete(null)}
          title="Eliminar Colaborador"
          size="sm"
        >
          <div className="space-y-4 pt-2">
            <p className="text-small text-[var(--text-main)] leading-relaxed">
              ¿Estás seguro de que querés eliminar a <strong>{staffToDelete.name}</strong> del equipo?
            </p>
            <p className="text-micro text-[var(--text-muted)]">
              Se eliminará su enlace personal y no sumará más toques al reto del mes.
            </p>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setStaffToDelete(null)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                isLoading={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    if (api.deleteStaff) {
                      await api.deleteStaff(businessId, staffToDelete.id);
                    }
                    success('Colaborador eliminado', staffToDelete.name);
                    setStaffToDelete(null);
                    refetch();
                  } catch {
                    toastError('Error', 'No se pudo eliminar al colaborador');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                Eliminar definitivamente
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
