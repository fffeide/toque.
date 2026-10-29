import React, { useState, useEffect } from 'react';
import { api, TeamMember, Cartel } from '../../api';
import { ClubLocal, PlanState } from '../../api/types';
import { getPlanLimits } from '../../config/pricing';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/formatters';
import {
  Users,
  UserPlus,
  ShieldCheck,
  QrCode,
  Trash2,
  CheckCircle2,
  CreditCard,
  X,
} from 'lucide-react';

export const TeamView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [carteles, setCarteles] = useState<Cartel[]>([]);
  const [locals, setLocals] = useState<ClubLocal[]>([]);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'cashier' | 'manager' | 'owner'>('cashier');
  const [assignedCartelId, setAssignedCartelId] = useState<string>('');
  const [selectedLocalIds, setSelectedLocalIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [teamList, cartelesList, localsList, plan] = await Promise.all([
        api.listTeamMembers(),
        api.listCarteles(),
        api.listLocals(),
        api.getPlanState(),
      ]);
      setMembers(teamList);
      setCarteles(cartelesList);
      setLocals(localsList);
      setPlanState(plan);
    } catch {
      showToast('No se pudo cargar el equipo', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const limits = getPlanLimits(planState?.planId);
  const isTeamLimitReached = members.length >= limits.maxTeamTotal;

  const toggleLocalSelection = (localId: string) => {
    setSelectedLocalIds((prev) =>
      prev.includes(localId) ? prev.filter((id) => id !== localId) : [...prev, localId]
    );
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Ingresá el nombre y apellido', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const created = await api.addTeamMember({
        name: name.trim(),
        // Cajeros NO llevan mail para evitar accesos fuera del comercio
        email: role === 'cashier' ? undefined : email.trim().toLowerCase(),
        role,
        assignedCartelId: assignedCartelId || undefined,
        assignedLocalIds: selectedLocalIds.length > 0 ? selectedLocalIds : locals.map((l) => l.id),
      });
      setMembers((prev) => [...prev, created]);
      showToast(`${created.name} sumado al equipo y sincronizado con Caja POS`, 'success');
      setShowAddModal(false);
      setName('');
      setEmail('');
      setRole('cashier');
      setAssignedCartelId('');
    } catch (err: any) {
      showToast(err.message || 'Error al agregar colaborador', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeCartel = async (member: TeamMember, newCartelId: string) => {
    try {
      const updated = await api.updateTeamMember(member.id, {
        assignedCartelId: newCartelId || '',
      });
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
      showToast(`Caja actualizada para ${member.name}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'No se pudo actualizar la caja', 'error');
    }
  };

  const handleChangeRole = async (
    member: TeamMember,
    newRole: 'owner' | 'manager' | 'cashier'
  ) => {
    try {
      const updated = await api.updateTeamMember(member.id, { role: newRole });
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
      showToast(`Rol actualizado para ${member.name}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'No se pudo actualizar el rol', 'error');
    }
  };

  const handleRemove = async (member: TeamMember) => {
    try {
      await api.removeTeamMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      showToast(`${member.name} fue quitado del equipo`, 'info');
    } catch {
      showToast('No se pudo eliminar al colaborador', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-sm">
      {/* Encabezado compacto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#f1f1ee] tracking-tight">
            Equipo
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Enlazado en tiempo real con Caja POS. Los cajeros no llevan correo ni contraseña para operar únicamente dentro del local.
          </p>
        </div>

        <Button
          variant="ultramar"
          size="sm"
          disabled={isTeamLimitReached}
          icon={<UserPlus className="w-4 h-4" />}
          onClick={() => {
            setName('');
            setEmail('');
            setRole('cashier');
            setAssignedCartelId('');
            setSelectedLocalIds(locals.map((l) => l.id));
            setShowAddModal(true);
          }}
        >
          {isTeamLimitReached ? 'Límite de plan alcanzado' : 'Sumar integrante'}
        </Button>
      </div>

      {/* Explicación compacta de roles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-[#141418] border border-[#282830] flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#f1f1ee]">Dueño (con contraseña)</p>
            <p className="text-[11px] text-[#a1a1aa] mt-0.5">
              Acceso completo al panel y requiere clave en Caja POS.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#141418] border border-[#282830] flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#2fb36a]/15 text-[#34d399] flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#f1f1ee]">Encargado (con contraseña)</p>
            <p className="text-[11px] text-[#a1a1aa] mt-0.5">
              Gestiona el panel operativo y requiere clave al seleccionarse en POS.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#141418] border border-[#282830] flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#1C1C22] text-[#f1f1ee] flex items-center justify-center shrink-0">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#f1f1ee]">Cajero (sin mail ni contraseña)</p>
            <p className="text-[11px] text-[#a1a1aa] mt-0.5">
              Solo opera desde la Caja del comercio; no puede iniciar sesión desde afuera.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Miembros */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-[#282830] flex items-center justify-between">
          <h2 className="font-bold text-xs text-[#f1f1ee]">
            Integrantes activos ({members.length}
            {limits.maxTeamTotal < 999 ? ` / ${limits.maxTeamTotal}` : ''})
          </h2>
          <span className="text-[11px] text-[#a1a1aa]">
            Sincronizado con el selector de perfil en Caja POS
          </span>
        </div>

        <div className="divide-y divide-[#282830]">
          {members.map((member) => {
            const isSelfOwner =
              member.id === 'team-owner-default' ||
              (Boolean(user?.email) &&
                member.email &&
                member.email.toLowerCase() === user?.email.toLowerCase() &&
                member.role === 'owner');

            const roleLabel =
              member.role === 'owner'
                ? 'Dueño'
                : member.role === 'manager'
                ? 'Encargado'
                : 'Cajero';

            return (
              <div
                key={member.id}
                className="p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-[#161619] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#18181b] border border-[#28282a] flex items-center justify-center font-bold text-xs text-[#bec8ff] shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-[#f1f1ee]">
                        {member.name.replace(/\s*\([^)]*\)/g, '').trim()}
                      </p>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          member.role === 'owner'
                            ? 'bg-[#bec8ff]/15 text-[#bec8ff]'
                            : member.role === 'manager'
                            ? 'bg-[#2fb36a]/15 text-[#34d399]'
                            : 'bg-[#18181b] text-[#a1a1aa] border border-[#28282a]'
                        }`}
                      >
                        {roleLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#a1a1aa] mt-0.5">
                      {member.role === 'cashier'
                        ? 'Perfil de Caja POS (sin correo ni acceso externo)'
                        : member.email}{' '}
                      · Alta: {formatDate(member.addedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {isSelfOwner ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl bg-[#161619] border border-[#28282a] text-[11px] font-semibold text-[#f1f1ee]">
                        Creador / Dueño
                      </span>
                    </div>
                  ) : (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleChangeRole(
                            member,
                            e.target.value as 'owner' | 'manager' | 'cashier'
                          )
                        }
                        aria-label="Rol del integrante"
                        className="bg-[#161619] border border-[#28282a] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff] cursor-pointer"
                      >
                        <option value="cashier">Cajero</option>
                        <option value="manager">Encargado</option>
                        <option value="owner">Dueño</option>
                      </select>

                      <div className="flex items-center gap-1.5 bg-[#161619] border border-[#28282a] rounded-xl px-2.5 py-1.5">
                        <QrCode className="w-3.5 h-3.5 text-[#bec8ff]" />
                        <select
                          value={member.assignedCartelId || ''}
                          onChange={(e) => handleChangeCartel(member, e.target.value)}
                          aria-label="Caja asignada"
                          className="bg-transparent text-xs font-medium text-[#f1f1ee] focus:outline-none cursor-pointer"
                        >
                          <option value="" className="bg-[#111113]">
                            Todas las cajas
                          </option>
                          {carteles.map((c) => (
                            <option key={c.id} value={c.id} className="bg-[#111113]">
                              {c.code} · {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemove(member)}
                        title="Quitar del equipo"
                        className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Modal para sumar integrante */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-[#282830] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#bec8ff]/15 text-[#bec8ff] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-[#f1f1ee]">Sumar integrante</h2>
                  <p className="text-[11px] text-[#a1a1aa]">
                    Los cajeros se vinculan directo con Caja POS sin correo electrónico.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#f1f1ee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                    Rol
                  </label>
                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as 'cashier' | 'manager' | 'owner')
                    }
                    className="w-full bg-[#1C1C22] border border-[#282830] rounded-xl px-3 py-2 text-xs font-medium text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  >
                    <option value="cashier">Cajero (sin contraseña ni mail)</option>
                    <option value="manager">Encargado (con contraseña)</option>
                    <option value="owner">Dueño (con contraseña)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                    Caja asignada
                  </label>
                  <select
                    value={assignedCartelId}
                    onChange={(e) => setAssignedCartelId(e.target.value)}
                    className="w-full bg-[#1C1C22] border border-[#282830] rounded-xl px-3 py-2 text-xs font-medium text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  >
                    <option value="">Todas las cajas</option>
                    {carteles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                  Nombre y apellido
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nombre del integrante"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#1C1C22] border border-[#282830] rounded-xl px-3 py-2 text-xs text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                />
              </div>

              {role !== 'cashier' && (
                <div>
                  <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                    Correo electrónico (requerido para Encargado / Dueño)
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="encargado@comercio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1C1C22] border border-[#282830] rounded-xl px-3 py-2 text-xs text-[#f1f1ee] focus:outline-none focus:border-[#bec8ff]"
                  />
                </div>
              )}

              {locals.length > 0 && (
                <div>
                  <span className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                    Locales habilitados
                  </span>
                  <div className="space-y-1">
                    {locals.map((loc) => (
                      <label
                        key={loc.id}
                        className="flex items-center gap-2 text-xs text-[#f1f1ee] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLocalIds.includes(loc.id)}
                          onChange={() => toggleLocalSelection(loc.id)}
                          className="rounded border-[#28282a]"
                        />
                        <span>
                          {loc.name} ({loc.code})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secundario"
                  size="sm"
                  fullWidth
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="ultramar"
                  size="sm"
                  fullWidth
                  loading={isSaving}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
