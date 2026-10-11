/**
 * Toque — Equipo del Taller Fabricante (ManufacturerStaffView)
 * Características:
 * - Usuarios y roles: Dueño, Administrador, Lector
 * - Recomendación clara: "2º administrador de respaldo recomendado"
 * - Alta y baja de colaboradores
 */

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { ManufacturerStaffUser } from '../../api/types';
import { api } from '../../api';
import { useToast } from '../../components/ui/Toast';
import {
  Users,
  Shield,
  ShieldCheck,
  UserPlus,
  Trash2,
  Mail,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface ManufacturerStaffViewProps {
  staff: ManufacturerStaffUser[];
  manufacturerId: string;
  onStaffUpdated?: () => void;
}

export const ManufacturerStaffView: React.FC<ManufacturerStaffViewProps> = ({
  staff,
  manufacturerId,
  onStaffUpdated,
}) => {
  const { success, error: toastError } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'admin' | 'viewer'>('admin');
  const [isBackupAdmin, setIsBackupAdmin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasBackupAdmin = staff.some((s) => s.isBackupAdmin || (s.role === 'admin' && staff.length > 1));

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addManufacturerStaff(manufacturerId, {
        name,
        email,
        role,
        isBackupAdmin,
      });
      success('Colaborador agregado', `${name} ahora tiene acceso al panel de cartelería.`);
      setIsAddModalOpen(false);
      setName('');
      setEmail('');
      if (onStaffUpdated) onStaffUpdated();
    } catch (err) {
      toastError('No se pudo agregar', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (staffId: string, memberName: string) => {
    try {
      await api.removeManufacturerStaff(manufacturerId, staffId);
      success('Acceso revocado', `Se eliminó a ${memberName} del equipo.`);
      if (onStaffUpdated) onStaffUpdated();
    } catch (err) {
      toastError('Error al eliminar', err instanceof Error ? err.message : 'Error');
    }
  };

  const roleLabels: Record<string, string> = {
    owner: 'Dueño / Titular',
    admin: 'Administrador de Taller',
    viewer: 'Lector / Operario',
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-title-2 font-bold text-[var(--text-main)]">
            Equipo y Accesos del Taller
          </h2>
          <p className="text-small text-[var(--text-muted)] mt-0.5">
            Gestioná los usuarios con permisos para dar de alta clientes y generar carteles.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsAddModalOpen(true)}
          icon={<UserPlus className="w-4 h-4" />}
        >
          Agregar usuario
        </Button>
      </div>

      {/* AVISO DE 2º ADMINISTRADOR DE RESPALDO RECOMENDADO */}
      <div
        className={`p-4 rounded-2xl border flex items-start gap-3 ${
          hasBackupAdmin
            ? 'bg-[var(--menta)]/10 border-[var(--menta)]/30 text-[var(--text-main)]'
            : 'bg-[var(--ambar)]/10 border-[var(--ambar)]/30 text-[var(--text-main)]'
        }`}
      >
        {hasBackupAdmin ? (
          <ShieldCheck className="w-5 h-5 text-[var(--menta)] shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-[var(--ambar)] shrink-0 mt-0.5" />
        )}
        <div className="text-small leading-relaxed">
          <strong className="font-semibold block">
            {hasBackupAdmin
              ? 'Equipo seguro: 2º administrador de respaldo configurado'
              : 'Recomendación importante de Toque: 2º administrador de respaldo'}
          </strong>
          <span className="text-micro text-[var(--text-muted)] mt-0.5 block">
            {hasBackupAdmin
              ? 'Tu cuenta tiene cobertura operativa para que el taller nunca quede bloqueado si un titular no está disponible.'
              : 'Te sugerimos designar a un socio o encargado de confianza como 2º administrador para garantizar la continuidad ante vacaciones o imprevistos.'}
          </span>
        </div>
      </div>

      {/* Lista de Miembros */}
      <div className="space-y-3">
        {staff.map((member) => (
          <Card key={member.id} className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] font-display font-bold text-small flex items-center justify-center shrink-0">
                {member.name.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-body font-semibold text-[var(--text-main)] truncate">
                    {member.name}
                  </span>
                  {member.isBackupAdmin && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--brand)]/15 text-[var(--brand)]">
                      Admin de respaldo
                    </span>
                  )}
                </div>
                <p className="text-micro text-[var(--text-muted)] font-mono truncate">
                  {member.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-micro font-medium text-[var(--text-muted)] hidden sm:inline">
                {roleLabels[member.role] || member.role}
              </span>

              {member.role !== 'owner' && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.id, member.name)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--coral)] rounded-lg transition cursor-pointer"
                  title="Eliminar usuario"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* MODAL AGREGAR USUARIO */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Invitar Colaborador al Taller"
        description="El usuario recibirá un enlace para ingresar a este panel con el rol asignado."
        size="md"
      >
        <form onSubmit={handleAddMember} className="space-y-4 pt-2">
          <Input
            label="Nombre y apellido"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Carla Martínez"
            required
          />

          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="carla@carteleriademo.com.ar"
            required
          />

          <div>
            <label className="block text-small font-medium text-[var(--text-main)] mb-1.5">
              Rol de permisos
            </label>
            <div className="space-y-2">
              {[
                { id: 'admin', title: 'Administrador', desc: 'Puede dar de alta comercios, generar carteles y modificar marca.' },
                { id: 'viewer', title: 'Lector / Operario', desc: 'Solo puede consultar códigos y descargar archivos de impresión.' },
              ].map((r) => (
                <label
                  key={r.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-small transition cursor-pointer ${
                    role === r.id
                      ? 'border-[var(--brand)] bg-[var(--brand)]/5 font-medium'
                      : 'border-[var(--border-subtle)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <input
                    type="radio"
                    name="user_role"
                    checked={role === r.id}
                    onChange={() => setRole(r.id as any)}
                    className="mt-0.5 text-[var(--brand)]"
                  />
                  <div>
                    <span className="text-[var(--text-main)] font-semibold">{r.title}</span>
                    <p className="text-micro text-[var(--text-muted)]">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[var(--border-subtle)] cursor-pointer text-small">
            <input
              type="checkbox"
              checked={isBackupAdmin}
              onChange={(e) => setIsBackupAdmin(e.target.checked)}
              className="w-4 h-4 text-[var(--brand)] rounded focus:ring-[var(--brand)]"
            />
            <span className="text-[var(--text-main)] font-medium">
              Designar como 2º administrador de respaldo (Recomendado)
            </span>
          </label>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Enviar invitación
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
